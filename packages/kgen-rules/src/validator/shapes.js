#!/usr/bin/env node

import { readFile, access } from 'fs/promises';
import { resolve, dirname, basename } from 'path';
import { Parser as N3Parser } from 'n3';
import rdfDataModel from '@rdfjs/data-model';
import rdfDataset from '@rdfjs/dataset';

const { factory } = rdfDataModel;
const { dataset } = rdfDataset;

/**
 * SHACL Shapes Manager
 * 
 * Loads, manages, and caches SHACL shapes from .ttl files
 * Supports shape composition and modular shape libraries
 * Provides efficient caching and validation of shape files
 */
export class SHACLShapesManager {
  constructor(options = {}) {
    this.shapesCache = new Map();
    this.compositeCache = new Map();
    this.factory = factory;
    this.dataset = dataset;
    this.options = {
      maxCacheSize: options.maxCacheSize || 100,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      autoValidate: options.autoValidate !== false,
      ...options
    };
    this.parser = new N3Parser({ 
      format: 'turtle',
      factory: this.factory 
    });
  }

  /**
   * Load SHACL shapes from a TTL file
   * @param {string} filePath - Path to the TTL file containing SHACL shapes
   * @param {Object} options - Loading options
   * @returns {Dataset} Parsed SHACL shapes dataset
   */
  async loadShapesFromFile(filePath, options = {}) {
    const resolvedPath = resolve(filePath);
    const cacheKey = `file:${resolvedPath}`;
    
    // Check cache first
    if (!options.skipCache && this.shapesCache.has(cacheKey)) {
      const cached = this.shapesCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        return cached.dataset;
      } else {
        this.shapesCache.delete(cacheKey);
      }
    }

    try {
      // Verify file exists
      await access(resolvedPath);
      
      // Read and parse file
      const content = await readFile(resolvedPath, 'utf8');
      const shapes = this.parseShapes(content, resolvedPath);
      
      // Validate shapes if auto-validation is enabled
      if (this.options.autoValidate) {
        this.validateShapesStructure(shapes);
      }

      // Cache the result
      if (!options.skipCache) {
        this.cacheShapes(cacheKey, shapes, {
          filePath: resolvedPath,
          loadTime: Date.now(),
          source: 'file'
        });
      }

      return shapes;
    } catch (error) {
      throw new Error(`Failed to load SHACL shapes from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load SHACL shapes from string content
   * @param {string} content - TTL content containing SHACL shapes
   * @param {string} baseIRI - Base IRI for parsing (optional)
   * @param {Object} options - Loading options
   * @returns {Dataset} Parsed SHACL shapes dataset
   */
  async loadShapesFromString(content, baseIRI = '', options = {}) {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid shapes content: must be a non-empty string');
    }

    const cacheKey = `string:${this.hashString(content)}`;
    
    // Check cache
    if (!options.skipCache && this.shapesCache.has(cacheKey)) {
      const cached = this.shapesCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        return cached.dataset;
      } else {
        this.shapesCache.delete(cacheKey);
      }
    }

    try {
      const shapes = this.parseShapes(content, baseIRI);
      
      // Validate shapes if auto-validation is enabled
      if (this.options.autoValidate) {
        this.validateShapesStructure(shapes);
      }

      // Cache the result
      if (!options.skipCache) {
        this.cacheShapes(cacheKey, shapes, {
          baseIRI,
          loadTime: Date.now(),
          source: 'string'
        });
      }

      return shapes;
    } catch (error) {
      throw new Error(`Failed to parse SHACL shapes: ${error.message}`);
    }
  }

  /**
   * Compose multiple SHACL shape files into a single dataset
   * @param {string[]} filePaths - Array of file paths to compose
   * @param {Object} options - Composition options
   * @returns {Dataset} Composite dataset containing all shapes
   */
  async composeShapes(filePaths, options = {}) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('File paths must be a non-empty array');
    }

    const compositeKey = `composite:${this.hashString(filePaths.sort().join('|'))}`;
    
    // Check composite cache
    if (!options.skipCache && this.compositeCache.has(compositeKey)) {
      const cached = this.compositeCache.get(compositeKey);
      if (this.isCacheValid(cached)) {
        return cached.dataset;
      } else {
        this.compositeCache.delete(compositeKey);
      }
    }

    try {
      // Load all shape files concurrently
      const shapeDatasets = await Promise.all(
        filePaths.map(filePath => this.loadShapesFromFile(filePath, { skipCache: options.skipCache }))
      );

      // Create composite dataset
      const composite = this.dataset();
      let totalQuads = 0;

      for (const shapeDataset of shapeDatasets) {
        for (const quad of shapeDataset) {
          // Check for conflicts (same subject-predicate pair with different object)
          if (options.detectConflicts) {
            const existing = [...composite.match(quad.subject, quad.predicate)];
            if (existing.length > 0 && !existing.some(q => q.object.equals(quad.object))) {
              throw new Error(`Shape conflict detected: ${this.termToString(quad.subject)} ${this.termToString(quad.predicate)}`);
            }
          }
          
          composite.add(quad);
          totalQuads++;
        }
      }

      // Validate composite shapes
      if (this.options.autoValidate) {
        this.validateShapesStructure(composite);
      }

      // Cache composite
      if (!options.skipCache) {
        this.cacheShapes(compositeKey, composite, {
          filePaths,
          loadTime: Date.now(),
          source: 'composite',
          quadCount: totalQuads
        });
      }

      return composite;
    } catch (error) {
      throw new Error(`Failed to compose SHACL shapes: ${error.message}`);
    }
  }

  /**
   * Parse RDF content into shapes dataset
   * @param {string} content - RDF content
   * @param {string} baseIRI - Base IRI for parsing
   * @returns {Dataset} Parsed dataset
   * @private
   */
  parseShapes(content, baseIRI = '') {
    try {
      const quads = this.parser.parse(content, baseIRI);
      const shapesDataset = this.dataset();
      
      for (const quad of quads) {
        shapesDataset.add(quad);
      }

      if (shapesDataset.size === 0) {
        throw new Error('No RDF triples found in content');
      }

      return shapesDataset;
    } catch (error) {
      throw new Error(`RDF parsing error: ${error.message}`);
    }
  }

  /**
   * Validate SHACL shapes structure
   * @param {Dataset} shapesDataset - Dataset to validate
   * @returns {Object} Validation results
   * @private
   */
  validateShapesStructure(shapesDataset) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      shapeCount: 0,
      constraints: {
        nodeShapes: 0,
        propertyShapes: 0,
        constraints: 0
      }
    };

    try {
      // Count shapes and basic structure validation
      const shType = this.factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      const nodeShape = this.factory.namedNode('http://www.w3.org/ns/shacl#NodeShape');
      const propertyShape = this.factory.namedNode('http://www.w3.org/ns/shacl#PropertyShape');
      
      // Count node shapes
      const nodeShapes = [...shapesDataset.match(null, shType, nodeShape)];
      validation.constraints.nodeShapes = nodeShapes.length;
      
      // Count property shapes
      const propertyShapes = [...shapesDataset.match(null, shType, propertyShape)];
      validation.constraints.propertyShapes = propertyShapes.length;
      
      validation.shapeCount = nodeShapes.length + propertyShapes.length;

      // Basic validation: ensure we have at least some shapes
      if (validation.shapeCount === 0) {
        validation.errors.push('No SHACL shapes found in dataset');
        validation.valid = false;
      }

      // Warn if dataset seems too small
      if (shapesDataset.size < 3) {
        validation.warnings.push(`Dataset seems small (${shapesDataset.size} triples). Verify content is complete.`);
      }

    } catch (error) {
      validation.errors.push(`Shape validation error: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Cache shapes dataset with metadata
   * @param {string} key - Cache key
   * @param {Dataset} dataset - Dataset to cache
   * @param {Object} metadata - Cache metadata
   * @private
   */
  cacheShapes(key, dataset, metadata) {
    // Implement cache size limit
    if (this.shapesCache.size >= this.options.maxCacheSize) {
      this.evictOldestCache();
    }

    this.shapesCache.set(key, {
      dataset,
      metadata: {
        ...metadata,
        cacheTime: Date.now(),
        quadCount: dataset.size
      }
    });
  }

  /**
   * Check if cached entry is still valid
   * @param {Object} cached - Cached entry
   * @returns {boolean} True if cache is valid
   * @private
   */
  isCacheValid(cached) {
    if (!cached || !cached.metadata) return false;
    
    const age = Date.now() - cached.metadata.cacheTime;
    return age < this.options.cacheTTL;
  }

  /**
   * Evict oldest cache entry
   * @private
   */
  evictOldestCache() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.shapesCache.entries()) {
      if (value.metadata && value.metadata.cacheTime < oldestTime) {
        oldestTime = value.metadata.cacheTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.shapesCache.delete(oldestKey);
    }
  }

  /**
   * Simple string hash function
   * @param {string} str - String to hash
   * @returns {string} Hash value
   * @private
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Convert RDF term to string
   * @param {Object} term - RDF term
   * @returns {string} String representation
   * @private
   */
  termToString(term) {
    if (!term) return '';
    
    if (term.termType === 'NamedNode') {
      return term.value;
    } else if (term.termType === 'Literal') {
      return term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    
    return term.value || term.toString();
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.shapesCache.clear();
    this.compositeCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      shapesCache: {
        size: this.shapesCache.size,
        maxSize: this.options.maxCacheSize,
        entries: Array.from(this.shapesCache.keys())
      },
      compositeCache: {
        size: this.compositeCache.size,
        entries: Array.from(this.compositeCache.keys())
      },
      options: this.options
    };
  }

  /**
   * Get detailed information about cached shapes
   * @returns {Array} Array of cache entry details
   */
  getCacheDetails() {
    const details = [];
    
    for (const [key, value] of this.shapesCache.entries()) {
      details.push({
        key,
        quadCount: value.dataset.size,
        metadata: value.metadata,
        age: Date.now() - value.metadata.cacheTime,
        valid: this.isCacheValid(value)
      });
    }
    
    return details;
  }
}

// Default export
export default SHACLShapesManager;