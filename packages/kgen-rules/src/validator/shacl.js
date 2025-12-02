#!/usr/bin/env node

import rdfDataModel from '@rdfjs/data-model';
import rdfDataset from '@rdfjs/dataset';
import { Parser as N3Parser } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';

const { factory } = rdfDataModel;
const { dataset } = rdfDataset;

/**
 * SHACL Validation System using rdf-validate-shacl
 * 
 * Provides zero-tick reject semantics for fast failure
 * Uses industry-standard rdf-validate-shacl library
 * Returns JSON validation reports
 */
export class SHACLValidationEngine {
  constructor() {
    this.validator = null;
    this.shapesCache = new Map();
    this.factory = factory;
    this.dataset = dataset;
  }

  /**
   * Parse RDF content into a dataset
   * @param {string} content - RDF content (Turtle, N3, etc.)
   * @param {string} format - RDF format (default: 'turtle')
   * @param {string} baseIRI - Base IRI for parsing
   * @returns {Dataset} RDF Dataset
   */
  parseRDF(content, format = 'turtle', baseIRI = '') {
    try {
      // Zero-tick reject: immediate validation of input
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid RDF content: content must be a non-empty string');
      }

      if (content.trim().length === 0) {
        throw new Error('Invalid RDF content: content cannot be empty');
      }

      const quadStream = this.dataset();
      const parser = new N3Parser({ 
        format: format,
        baseIRI: baseIRI,
        factory: this.factory
      });

      const quads = parser.parse(content);
      
      for (const quad of quads) {
        quadStream.add(quad);
      }

      return quadStream;
    } catch (error) {
      // Zero-tick reject: fail fast on parse errors
      throw new Error(`RDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Load SHACL shapes from TTL content
   * @param {string} shapesContent - SHACL shapes in TTL format
   * @param {string} cacheKey - Optional cache key for shapes
   * @returns {Dataset} Parsed SHACL shapes dataset
   */
  loadShapes(shapesContent, cacheKey = null) {
    // Check cache first
    if (cacheKey && this.shapesCache.has(cacheKey)) {
      return this.shapesCache.get(cacheKey);
    }

    try {
      const shapesDataset = this.parseRDF(shapesContent, 'turtle');
      
      // Validate that this is actually SHACL shapes
      if (shapesDataset.size === 0) {
        throw new Error('No SHACL shapes found in provided content');
      }

      // Cache the parsed shapes
      if (cacheKey) {
        this.shapesCache.set(cacheKey, shapesDataset);
      }

      return shapesDataset;
    } catch (error) {
      throw new Error(`Failed to load SHACL shapes: ${error.message}`);
    }
  }

  /**
   * Validate RDF graph against SHACL shapes
   * @param {string} dataContent - RDF data content (TTL format)
   * @param {string} shapesContent - SHACL shapes content (TTL format)
   * @param {Object} options - Validation options
   * @returns {Object} Validation report in JSON format
   */
  async validateGraph(dataContent, shapesContent, options = {}) {
    const startTime = Date.now();

    try {
      // Zero-tick reject: validate inputs immediately
      if (!dataContent || typeof dataContent !== 'string') {
        return {
          conforms: false,
          violationCount: 1,
          violations: [{
            type: 'InputValidationError',
            message: 'Invalid data content: must be non-empty string',
            severity: 'critical',
            focusNode: null,
            resultPath: null,
            value: null
          }],
          warnings: [],
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      if (!shapesContent || typeof shapesContent !== 'string') {
        return {
          conforms: false,
          violationCount: 1,
          violations: [{
            type: 'InputValidationError',
            message: 'Invalid shapes content: must be non-empty string',
            severity: 'critical',
            focusNode: null,
            resultPath: null,
            value: null
          }],
          warnings: [],
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      // Parse data and shapes
      const dataDataset = this.parseRDF(dataContent, 'turtle');
      const shapesDataset = this.loadShapes(shapesContent, options.cacheKey);

      // Create SHACL validator
      const validator = new SHACLValidator(shapesDataset, { 
        factory: this.factory,
        maxErrors: options.maxErrors || -1, // -1 = no limit
        debug: options.debug || false
      });

      // Run validation
      const report = validator.validate(dataDataset);
      
      // Convert to our JSON format
      const violations = [];
      const warnings = [];

      if (report.results) {
        for (const result of report.results) {
          const violation = {
            type: this.extractConstraintType(result),
            message: this.extractMessage(result),
            severity: this.extractSeverity(result),
            focusNode: this.termToString(result.focusNode),
            resultPath: this.termToString(result.path),
            value: this.termToString(result.value),
            sourceConstraintComponent: this.termToString(result.sourceConstraintComponent),
            sourceShape: this.termToString(result.sourceShape)
          };

          if (violation.severity === 'warning') {
            warnings.push(violation);
          } else {
            violations.push(violation);
          }
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        conforms: report.conforms,
        violationCount: violations.length,
        warningCount: warnings.length,
        violations,
        warnings,
        shapesCount: shapesDataset.size,
        dataTriples: dataDataset.size,
        executionTime,
        timestamp: new Date().toISOString(),
        metadata: {
          validationEngine: 'rdf-validate-shacl',
          version: '0.5.5',
          options: options
        }
      };

    } catch (error) {
      // Zero-tick reject: immediate error response
      return {
        conforms: false,
        violationCount: 1,
        violations: [{
          type: 'ValidationEngineError',
          message: `SHACL validation failed: ${error.message}`,
          severity: 'critical',
          focusNode: null,
          resultPath: null,
          value: null
        }],
        warnings: [],
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Extract constraint type from SHACL result
   * @param {Object} result - SHACL validation result
   * @returns {string} Constraint type
   */
  extractConstraintType(result) {
    if (result.sourceConstraintComponent) {
      const component = this.termToString(result.sourceConstraintComponent);
      // Extract the local name from the IRI
      const match = component.match(/[#/]([^#/]*)$/);
      return match ? match[1] : component;
    }
    return 'UnknownConstraint';
  }

  /**
   * Extract message from SHACL result
   * @param {Object} result - SHACL validation result
   * @returns {string} Human-readable message
   */
  extractMessage(result) {
    if (result.message && result.message.value) {
      return result.message.value;
    }
    
    // Generate default message based on constraint type
    const constraintType = this.extractConstraintType(result);
    const path = this.termToString(result.path);
    const value = this.termToString(result.value);
    
    return `${constraintType} constraint violation${path ? ` on path ${path}` : ''}${value ? ` with value ${value}` : ''}`;
  }

  /**
   * Extract severity from SHACL result
   * @param {Object} result - SHACL validation result
   * @returns {string} Severity level
   */
  extractSeverity(result) {
    if (result.severity) {
      const severity = this.termToString(result.severity);
      if (severity.includes('Warning')) return 'warning';
      if (severity.includes('Info')) return 'info';
    }
    return 'violation';
  }

  /**
   * Convert RDF term to string representation
   * @param {Object} term - RDF term
   * @returns {string|null} String representation or null
   */
  termToString(term) {
    if (!term) return null;
    
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
   * Clear shapes cache
   */
  clearCache() {
    this.shapesCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.shapesCache.size,
      cachedShapes: Array.from(this.shapesCache.keys())
    };
  }
}

// Default export
export default SHACLValidationEngine;

/**
 * Convenience function for quick validation
 * @param {string} dataContent - RDF data content
 * @param {string} shapesContent - SHACL shapes content
 * @param {Object} options - Validation options
 * @returns {Object} Validation report
 */
export async function validateWithSHACL(dataContent, shapesContent, options = {}) {
  const engine = new SHACLValidationEngine();
  return await engine.validateGraph(dataContent, shapesContent, options);
}