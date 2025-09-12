/**
 * RDF Bridge - Unified interface for RDF operations in KGEN
 * 
 * Provides a unified API that combines GraphProcessor, GraphIndexer, and GraphDiffEngine
 * for seamless RDF graph operations with content-addressed caching.
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { consola } from 'consola';
import { GraphProcessor } from './graph-processor.js';
import { GraphIndexer } from './graph-indexer.js';
import { GraphDiffEngine } from './graph-diff-engine.js';

export class RDFBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableCaching: config.enableCaching !== false,
      cacheDir: config.cacheDir || '.kgen/cache',
      enableIndexing: config.enableIndexing !== false,
      enableDiffEngine: config.enableDiffEngine !== false,
      maxCacheSize: config.maxCacheSize || 1000,
      ...config
    };
    
    // Core components
    this.processor = new GraphProcessor(config.processor);
    this.indexer = config.enableIndexing ? new GraphIndexer(config.indexer) : null;
    this.diffEngine = config.enableDiffEngine ? new GraphDiffEngine(config.diffEngine) : null;
    
    // Content-addressed cache
    this.cache = new Map();
    this.hashCache = new Map(); // Hash -> GraphProcessor mapping
    
    this.logger = consola.withTag('rdf-bridge');
    this.stats = {
      graphsLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      diffsCalculated: 0,
      indexesBuilt: 0
    };
  }

  /**
   * Load RDF graph from file with content-addressed caching
   * @param {string} filePath - Path to RDF file
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Graph metadata with hash and processor
   */
  async loadGraph(filePath, options = {}) {
    try {
      const startTime = Date.now();
      
      // Read file content
      const content = await readFile(filePath, 'utf8');
      const format = options.format || this._detectFormat(filePath);
      
      // Generate content hash for caching
      const contentHash = this.processor.calculateContentHash
        ? this._hashContent(content) 
        : this._simpleHash(content);
      
      // Check cache first
      if (this.config.enableCaching && this.hashCache.has(contentHash)) {
        this.stats.cacheHits++;
        this.logger.debug(`Cache hit for graph: ${filePath}`);
        
        return {
          hash: contentHash,
          processor: this.hashCache.get(contentHash),
          cached: true,
          loadTime: Date.now() - startTime
        };
      }
      
      this.stats.cacheMisses++;
      
      // Create new processor and parse
      const processor = new GraphProcessor(this.config.processor);
      const parseResult = await processor.parseRDF(content, format, options.parseOptions);
      
      // Add quads to processor
      processor.addQuads(parseResult.quads);
      
      // Calculate canonical hash
      const graphHash = processor.calculateContentHash(options.hashOptions);
      
      // Index if enabled
      let indexResult = null;
      if (this.indexer) {
        indexResult = await this.indexer.indexQuads(parseResult.quads, options.indexOptions);
        this.stats.indexesBuilt++;
      }
      
      // Cache the processor
      if (this.config.enableCaching) {
        this._addToCache(contentHash, processor);
        this._addToCache(graphHash, processor);
      }
      
      const result = {
        filePath,
        contentHash,
        graphHash, 
        processor,
        parseResult,
        indexResult,
        cached: false,
        loadTime: Date.now() - startTime,
        stats: processor.getStats()
      };
      
      this.stats.graphsLoaded++;
      this.emit('graph-loaded', result);
      this.logger.success(`Loaded graph: ${filePath} (${parseResult.count} quads, ${result.loadTime}ms)`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to load graph ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Generate canonical hash for any RDF content
   * @param {string|Buffer} content - RDF content
   * @param {Object} options - Hash options
   * @returns {Promise<string>} Canonical hash
   */
  async graphHash(content, options = {}) {
    try {
      const format = options.format || 'turtle';
      const algorithm = options.algorithm || 'sha256';
      
      // Create temporary processor
      const processor = new GraphProcessor();
      const parseResult = await processor.parseRDF(content.toString(), format);
      processor.addQuads(parseResult.quads);
      
      // Generate canonical hash
      const hash = processor.calculateContentHash({ algorithm });
      
      this.logger.debug(`Generated graph hash: ${hash} (${parseResult.count} quads)`);
      return hash;
      
    } catch (error) {
      this.logger.error('Failed to generate graph hash:', error);
      throw error;
    }
  }

  /**
   * Compare two graphs and generate comprehensive diff
   * @param {string|Object} graph1 - First graph (file path or loaded graph)
   * @param {string|Object} graph2 - Second graph (file path or loaded graph)
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Comprehensive diff result
   */
  async diffGraphs(graph1, graph2, options = {}) {
    try {
      if (!this.diffEngine) {
        throw new Error('Diff engine not enabled. Set enableDiffEngine: true in config.');
      }
      
      const startTime = Date.now();
      
      // Load graphs if they're file paths
      const processor1 = typeof graph1 === 'string' 
        ? (await this.loadGraph(graph1, options)).processor
        : graph1.processor || graph1;
        
      const processor2 = typeof graph2 === 'string'
        ? (await this.loadGraph(graph2, options)).processor  
        : graph2.processor || graph2;
      
      // Calculate diff using diff engine
      const diff = await this.diffEngine.calculateDiff(processor1, processor2, options);
      
      this.stats.diffsCalculated++;
      this.emit('diff-calculated', diff);
      
      this.logger.success(`Diff calculated in ${Date.now() - startTime}ms: ${diff.changes.total} changes`);
      return diff;
      
    } catch (error) {
      this.logger.error('Failed to calculate graph diff:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive index for multiple graphs
   * @param {Array} graphPaths - Array of RDF file paths
   * @param {Object} options - Index options  
   * @returns {Promise<Object>} Index result
   */
  async buildIndex(graphPaths, options = {}) {
    try {
      if (!this.indexer) {
        throw new Error('Indexer not enabled. Set enableIndexing: true in config.');
      }
      
      const startTime = Date.now();
      const processors = [];
      
      // Load all graphs
      for (const path of graphPaths) {
        const result = await this.loadGraph(path, options);
        processors.push(result.processor);
      }
      
      // Build subject index if diff engine available
      let subjectIndex = null;
      if (this.diffEngine) {
        subjectIndex = await this.diffEngine.buildSubjectIndex(processors);
      }
      
      // Generate comprehensive index report
      const indexReport = this.indexer.generateReport();
      
      const result = {
        processors,
        subjectIndex,
        indexReport,
        processingTime: Date.now() - startTime,
        graphCount: processors.length
      };
      
      // Save index if output path specified
      if (options.outputPath) {
        await this._saveIndex(result, options.outputPath);
      }
      
      this.emit('index-built', result);
      this.logger.success(`Index built for ${processors.length} graphs in ${result.processingTime}ms`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to build index:', error);
      throw error;
    }
  }

  /**
   * Query graphs using indexed search
   * @param {Object} pattern - Query pattern { subject?, predicate?, object? }
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async query(pattern, options = {}) {
    try {
      if (!this.indexer) {
        // Fall back to processor query
        return this.processor.query(pattern, options);
      }
      
      return await this.indexer.query(pattern, options);
      
    } catch (error) {
      this.logger.error('Query failed:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   * @returns {Object} Bridge statistics
   */
  getStats() {
    return {
      bridge: { ...this.stats },
      processor: this.processor.getStats(),
      indexer: this.indexer?.getStats() || null,
      diffEngine: this.diffEngine?.getStats() || null,
      cache: {
        size: this.cache.size,
        hashCacheSize: this.hashCache.size,
        maxSize: this.config.maxCacheSize
      }
    };
  }

  /**
   * Clear all caches and reset state
   */
  clear() {
    this.cache.clear();
    this.hashCache.clear();
    this.processor.clear();
    this.indexer?.clear();
    
    this.stats = {
      graphsLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      diffsCalculated: 0,
      indexesBuilt: 0
    };
    
    this.emit('cleared');
  }

  // Private methods

  _detectFormat(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const formatMap = {
      'ttl': 'turtle',
      'turtle': 'turtle', 
      'n3': 'n3',
      'nt': 'ntriples',
      'ntriples': 'ntriples',
      'rdf': 'rdfxml',
      'xml': 'rdfxml',
      'jsonld': 'jsonld',
      'json': 'jsonld'
    };
    
    return formatMap[ext] || 'turtle';
  }

  _hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  _simpleHash(content) {
    // Fallback simple hash if crypto not available
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  _addToCache(key, processor) {
    if (this.hashCache.size >= this.config.maxCacheSize) {
      // Simple LRU eviction - remove first entry
      const firstKey = this.hashCache.keys().next().value;
      this.hashCache.delete(firstKey);
    }
    
    this.hashCache.set(key, processor);
  }

  async _saveIndex(indexResult, outputPath) {
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });
    
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      ...indexResult
    };
    
    await writeFile(outputPath, JSON.stringify(data, null, 2));
    this.logger.info(`Index saved to: ${outputPath}`);
  }
}

export default RDFBridge;