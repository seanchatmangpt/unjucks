/**
 * KGEN SHACL-Only Validation Engine
 * 
 * Pure SHACL validation implementation using shacl-engine and rdf-ext.
 * Replaces all mixed validation approaches with deterministic SHACL-only validation.
 * 
 * Performance Targets:
 * - Standard graphs: ≤20ms validation
 * - Large graphs (10k+ triples): ≤100ms
 * - Violation reporting: ≤5ms
 */

import { Validator } from 'shacl-engine';
import rdfExt from 'rdf-ext';
import clownfaceImport from 'clownface';
const clownface = clownfaceImport.default || clownfaceImport;

// rdf-ext itself is the factory object with DataFactory methods
const factory = rdfExt;
import { Parser } from 'n3';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

// factory is rdf-ext which contains all DataFactory methods

/**
 * SHACL validation exit codes for CLI integration
 */
export const SHACLValidationCodes = {
  SUCCESS: 0,
  WARNINGS: 0, 
  VIOLATIONS: 3,
  ERRORS: 1,
  CRITICAL: 2
};

/**
 * Pure SHACL validation engine for KGEN
 * Provides fast, deterministic validation with JSON-only reporting
 */
export class SHACLValidationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Performance settings
      timeout: options.timeout || 30000, // 30s max validation time
      maxTriples: options.maxTriples || 50000, // Limit graph size
      
      // Validation behavior
      exitOnFirstViolation: options.exitOnFirstViolation || false,
      validateShapes: options.validateShapes !== false,
      
      // Reporting
      includeDetails: options.includeDetails !== false,
      includeTrace: options.includeTrace || false,
      
      // SHACL engine configuration
      factory,
      logger: options.logger || consola,
      
      ...options
    };

    this.engine = null;
    this.shapesGraph = null;
    this.validationCache = new Map();
    this.performanceMetrics = {
      validationTime: 0,
      reportingTime: 0,
      graphSize: 0,
      shapesCount: 0
    };
  }

  /**
   * Initialize SHACL engine with shapes graph
   * @param {string|Buffer|Array} shapesData - SHACL shapes (Turtle, N-Triples, or quads)
   * @returns {Promise<void>}
   */
  async initialize(shapesData) {
    try {
      const startTime = performance.now();
      
      // Parse shapes data into quads
      const shapesQuads = await this._parseToQuads(shapesData);
      
      // Create proper dataset for SHACL engine
      const shapesDataset = factory.dataset(shapesQuads);
      
      // Create shapes graph with clownface
      this.shapesGraph = clownface({ factory, dataset: shapesDataset });
      
      // Initialize SHACL engine - dataset first, options second
      this.engine = new Validator(shapesDataset, {
        factory
      });

      // Count shapes for metrics
      this.performanceMetrics.shapesCount = this._countShapes(shapesQuads);
      
      const initTime = performance.now() - startTime;
      this.options.logger.debug(`SHACL engine initialized in ${initTime.toFixed(2)}ms with ${this.performanceMetrics.shapesCount} shapes`);
      
      this.emit('initialized', { 
        shapesCount: this.performanceMetrics.shapesCount,
        initTime 
      });
      
    } catch (error) {
      this.options.logger.error('Failed to initialize SHACL engine:', error);
      throw new Error(`SHACL engine initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate RDF data against SHACL shapes
   * @param {string|Buffer|Array} dataGraph - RDF data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation report
   */
  async validate(dataGraph, options = {}) {
    if (!this.engine) {
      throw new Error('SHACL engine not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    
    try {
      // Parse data graph
      const dataQuads = await this._parseToQuads(dataGraph);
      this.performanceMetrics.graphSize = dataQuads.length;
      
      // Check size limits
      if (dataQuads.length > this.options.maxTriples) {
        throw new Error(`Graph too large: ${dataQuads.length} triples (max: ${this.options.maxTriples})`);
      }

      // Create proper dataset for validation
      const dataDataset = factory.dataset(dataQuads);
      
      // Run SHACL validation
      const validationReport = await this._runValidation(dataDataset);
      
      this.performanceMetrics.validationTime = performance.now() - startTime;
      
      // Generate JSON report
      const reportStartTime = performance.now();
      const jsonReport = this._generateJSONReport(validationReport, options);
      this.performanceMetrics.reportingTime = performance.now() - reportStartTime;
      
      // Log performance metrics
      this._logPerformanceMetrics();
      
      // Emit validation completed event
      this.emit('validated', {
        conforms: jsonReport.conforms,
        violationsCount: jsonReport.violations.length,
        performance: this.performanceMetrics
      });

      return jsonReport;
      
    } catch (error) {
      this.options.logger.error('SHACL validation failed:', error);
      throw new Error(`SHACL validation failed: ${error.message}`);
    }
  }

  /**
   * Validate multiple data graphs in batch
   * @param {Array} dataGraphs - Array of data graphs to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Array>} Array of validation reports
   */
  async validateBatch(dataGraphs, options = {}) {
    const results = [];
    const startTime = performance.now();
    
    for (const [index, dataGraph] of dataGraphs.entries()) {
      try {
        const result = await this.validate(dataGraph, {
          ...options,
          batchIndex: index,
          batchTotal: dataGraphs.length
        });
        results.push(result);
        
        // Exit early if requested and violations found
        if (options.exitOnFirstViolation && !result.conforms) {
          break;
        }
      } catch (error) {
        results.push({
          conforms: false,
          error: error.message,
          batchIndex: index
        });
      }
    }
    
    const totalTime = performance.now() - startTime;
    this.options.logger.info(`Batch validation completed in ${totalTime.toFixed(2)}ms`);
    
    return results;
  }

  /**
   * Get validation exit code for CLI integration
   * @param {Object} report - Validation report
   * @returns {number} Exit code
   */
  getExitCode(report) {
    if (report.error) return SHACLValidationCodes.ERRORS;
    if (!report.conforms) {
      const hasViolations = report.violations.some(v => v.severity === 'Violation');
      const hasWarnings = report.violations.some(v => v.severity === 'Warning');
      
      if (hasViolations) return SHACLValidationCodes.VIOLATIONS;
      if (hasWarnings) return SHACLValidationCodes.WARNINGS;
    }
    
    return SHACLValidationCodes.SUCCESS;
  }

  /**
   * Load SHACL shapes from file or directory
   * @param {string} shapesPath - Path to shapes file or directory
   * @returns {Promise<void>}
   */
  async loadShapes(shapesPath) {
    try {
      const stats = await fs.stat(shapesPath);
      let shapesData = '';
      
      if (stats.isDirectory()) {
        // Load all .ttl files from directory
        const files = await fs.readdir(shapesPath);
        const shapeFiles = files.filter(f => f.endsWith('.ttl') || f.endsWith('.n3'));
        
        for (const file of shapeFiles) {
          const filePath = path.join(shapesPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          shapesData += `\n# From: ${file}\n${content}\n`;
        }
      } else {
        shapesData = await fs.readFile(shapesPath, 'utf8');
      }
      
      await this.initialize(shapesData);
      
    } catch (error) {
      throw new Error(`Failed to load SHACL shapes from ${shapesPath}: ${error.message}`);
    }
  }

  /**
   * Parse RDF data to quads array
   * @private
   */
  async _parseToQuads(data) {
    if (Array.isArray(data)) {
      return data; // Already quads
    }
    
    return new Promise((resolve, reject) => {
      const parser = new Parser();
      const quads = [];
      
      parser.parse(data.toString(), (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  /**
   * Run SHACL validation using the engine
   * @private
   */
  async _runValidation(dataDataset) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Validation timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        const report = this.engine.validate(dataDataset);
        clearTimeout(timeout);
        resolve(report);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Generate JSON validation report
   * @private
   */
  _generateJSONReport(validationReport, options = {}) {
    const report = {
      conforms: validationReport.conforms,
      timestamp: this.getDeterministicDate().toISOString(),
      violations: [],
      summary: {
        totalViolations: 0,
        violationsBySeverity: {
          'Violation': 0,
          'Warning': 0,
          'Info': 0
        },
        performance: {
          validationTime: `${this.performanceMetrics.validationTime.toFixed(2)}ms`,
          reportingTime: `${this.performanceMetrics.reportingTime.toFixed(2)}ms`,
          graphSize: this.performanceMetrics.graphSize,
          shapesCount: this.performanceMetrics.shapesCount
        }
      }
    };

    // Extract violations from SHACL report
    if (validationReport.results) {
      for (const result of validationReport.results) {
        const violation = {
          focusNode: result.focusNode?.value || null,
          resultPath: result.resultPath?.value || null,
          sourceConstraintComponent: result.sourceConstraintComponent?.value || null,
          sourceShape: result.sourceShape?.value || null,
          severity: this._getSeverityLabel(result.resultSeverity),
          message: result.resultMessage?.value || 'No message provided',
          value: result.value?.value || null
        };

        if (this.options.includeDetails) {
          violation.details = {
            constraint: result.sourceConstraint?.value || null,
            sourceConstraintComponent: result.sourceConstraintComponent?.value || null
          };
        }

        report.violations.push(violation);
        report.summary.totalViolations++;
        report.summary.violationsBySeverity[violation.severity]++;
      }
    }

    return report;
  }

  /**
   * Convert SHACL severity URI to label
   * @private
   */
  _getSeverityLabel(severityNode) {
    if (!severityNode) return 'Violation';
    
    const severityURI = severityNode.value || severityNode;
    if (severityURI.includes('Violation')) return 'Violation';
    if (severityURI.includes('Warning')) return 'Warning';
    if (severityURI.includes('Info')) return 'Info';
    
    return 'Violation';
  }

  /**
   * Count shapes in shapes graph
   * @private
   */
  _countShapes(quads) {
    const shapeTypes = [
      'http://www.w3.org/ns/shacl#NodeShape',
      'http://www.w3.org/ns/shacl#PropertyShape'
    ];
    
    const shapes = new Set();
    for (const quad of quads) {
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
          shapeTypes.includes(quad.object.value)) {
        shapes.add(quad.subject.value);
      }
    }
    
    return shapes.size;
  }

  /**
   * Log performance metrics
   * @private
   */
  _logPerformanceMetrics() {
    const { validationTime, reportingTime, graphSize, shapesCount } = this.performanceMetrics;
    
    if (validationTime > 20) {
      this.options.logger.warn(`Validation time ${validationTime.toFixed(2)}ms exceeds 20ms target`);
    }
    
    if (reportingTime > 5) {
      this.options.logger.warn(`Reporting time ${reportingTime.toFixed(2)}ms exceeds 5ms target`);
    }
    
    this.options.logger.debug(`SHACL validation metrics: ${validationTime.toFixed(2)}ms validation, ${reportingTime.toFixed(2)}ms reporting, ${graphSize} triples, ${shapesCount} shapes`);
  }

  /**
   * Execute SHACL validation with shape execution
   * @param {Object} dataGraph - RDF data graph
   * @param {Object} shapesGraph - SHACL shapes graph
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Detailed validation report
   */
  async executeShapeValidation(dataGraph, shapesGraph, options = {}) {
    const startTime = performance.now();
    
    try {
      // Parse data and shapes graphs
      const dataQuads = await this._parseToQuads(dataGraph);
      const shapesQuads = await this._parseToQuads(shapesGraph);
      
      // Create SHACL engine if not initialized
      if (!this.engine) {
        await this.initialize(shapesGraph);
      }
      
      // Execute shape-by-shape validation for detailed reporting
      const shapeResults = [];
      const shapes = this._extractShapes(shapesQuads);
      
      for (const shape of shapes) {
        const shapeResult = await this._validateAgainstShape(dataQuads, shape, options);
        shapeResults.push(shapeResult);
        
        // Early exit if requested and violations found
        if (options.exitOnFirstViolation && !shapeResult.conforms) {
          break;
        }
      }
      
      // Generate comprehensive report
      const report = this._generateDetailedReport(shapeResults, options);
      report.executionTime = performance.now() - startTime;
      
      // Check performance target (≤20ms)
      if (report.executionTime > 20) {
        this.options.logger.warn(
          `⚠️ SHACL validation took ${report.executionTime.toFixed(2)}ms (target: ≤20ms)`
        );
      }
      
      return report;
      
    } catch (error) {
      throw new Error(`SHACL shape execution failed: ${error.message}`);
    }
  }
  
  /**
   * Extract individual shapes from shapes graph
   * @private
   */
  _extractShapes(shapesQuads) {
    const shapes = new Map();
    const shapeTypes = [
      'http://www.w3.org/ns/shacl#NodeShape',
      'http://www.w3.org/ns/shacl#PropertyShape'
    ];
    
    for (const quad of shapesQuads) {
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
          shapeTypes.includes(quad.object.value)) {
        const shapeIRI = quad.subject.value;
        if (!shapes.has(shapeIRI)) {
          shapes.set(shapeIRI, {
            iri: shapeIRI,
            type: quad.object.value,
            properties: [],
            constraints: new Map()
          });
        }
      }
    }
    
    // Collect shape properties and constraints
    for (const quad of shapesQuads) {
      const shapeIRI = quad.subject.value;
      if (shapes.has(shapeIRI)) {
        const shape = shapes.get(shapeIRI);
        
        // Collect constraint properties
        if (quad.predicate.value.startsWith('http://www.w3.org/ns/shacl#')) {
          shape.constraints.set(quad.predicate.value, quad.object);
        }
      }
    }
    
    return Array.from(shapes.values());
  }
  
  /**
   * Validate data against a specific shape
   * @private
   */
  async _validateAgainstShape(dataQuads, shape, options) {
    try {
      // Create temporary dataset with only relevant data
      const relevantData = this._filterRelevantData(dataQuads, shape);
      
      // Create shape-specific dataset
      const shapeQuads = this._createShapeDataset(shape);
      const shapeDataset = this.options.factory.dataset(shapeQuads);
      
      // Run validation with temporary engine
      const tempEngine = new Validator(shapeDataset, {
        factory: this.options.factory
      });
      
      const dataDataset = this.options.factory.dataset(relevantData);
      
      const report = tempEngine.validate(dataDataset);
      
      return {
        shapeIRI: shape.iri,
        shapeType: shape.type,
        conforms: report.conforms,
        results: report.results || [],
        targetNodes: this._countTargetNodes(relevantData, shape),
        constraintsChecked: shape.constraints.size
      };
      
    } catch (error) {
      return {
        shapeIRI: shape.iri,
        shapeType: shape.type,
        conforms: false,
        error: error.message,
        results: []
      };
    }
  }
  
  /**
   * Generate detailed validation report with shape execution details
   * @private
   */
  _generateDetailedReport(shapeResults, options = {}) {
    const overallConforms = shapeResults.every(result => result.conforms);
    const allViolations = [];
    const shapeStats = {
      totalShapes: shapeResults.length,
      conformingShapes: 0,
      violatingShapes: 0,
      totalConstraintsChecked: 0,
      totalTargetNodes: 0
    };
    
    // Aggregate results from all shapes
    for (const shapeResult of shapeResults) {
      if (shapeResult.conforms) {
        shapeStats.conformingShapes++;
      } else {
        shapeStats.violatingShapes++;
      }
      
      shapeStats.totalConstraintsChecked += shapeResult.constraintsChecked || 0;
      shapeStats.totalTargetNodes += shapeResult.targetNodes || 0;
      
      // Collect violations with shape context
      if (shapeResult.results) {
        for (const violation of shapeResult.results) {
          allViolations.push({
            ...this._formatViolation(violation),
            sourceShape: shapeResult.shapeIRI,
            shapeType: shapeResult.shapeType
          });
        }
      }
    }
    
    return {
      conforms: overallConforms,
      timestamp: this.getDeterministicDate().toISOString(),
      violations: allViolations,
      summary: {
        totalViolations: allViolations.length,
        violationsBySeverity: this._groupViolationsBySeverity(allViolations),
        shapeExecution: shapeStats,
        performance: {
          validationTime: '0ms', // Will be set by caller
          avgTimePerShape: shapeResults.length > 0 ? '0ms' : '0ms'
        }
      },
      shapeResults: options.includeShapeDetails ? shapeResults : undefined
    };
  }
  
  /**
   * Format individual violation for reporting
   * @private
   */
  _formatViolation(violation) {
    return {
      focusNode: violation.focusNode?.value || null,
      resultPath: violation.resultPath?.value || null,
      sourceConstraintComponent: violation.sourceConstraintComponent?.value || null,
      severity: this._getSeverityLabel(violation.resultSeverity),
      message: violation.resultMessage?.value || 'No message provided',
      value: violation.value?.value || null
    };
  }
  
  /**
   * Group violations by severity
   * @private
   */
  _groupViolationsBySeverity(violations) {
    const groups = { 'Violation': 0, 'Warning': 0, 'Info': 0 };
    
    for (const violation of violations) {
      groups[violation.severity] = (groups[violation.severity] || 0) + 1;
    }
    
    return groups;
  }
  
  /**
   * Filter data relevant to specific shape
   * @private
   */
  _filterRelevantData(dataQuads, shape) {
    // For now, return all data - can be optimized based on shape targets
    return dataQuads;
  }
  
  /**
   * Create dataset for specific shape
   * @private
   */
  _createShapeDataset(shape) {
    const quads = [];
    
    // Add shape type declaration
    quads.push({
      subject: { value: shape.iri },
      predicate: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
      object: { value: shape.type }
    });
    
    // Add shape constraints
    for (const [predicate, object] of shape.constraints) {
      quads.push({
        subject: { value: shape.iri },
        predicate: { value: predicate },
        object: object
      });
    }
    
    return quads;
  }
  
  /**
   * Count target nodes for shape
   * @private
   */
  _countTargetNodes(dataQuads, shape) {
    // Simplified implementation - count all subjects
    const subjects = new Set();
    for (const quad of dataQuads) {
      if (quad.subject.termType === 'NamedNode' || quad.subject.termType === 'BlankNode') {
        subjects.add(quad.subject.value);
      }
    }
    return subjects.size;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return { ...this.performanceMetrics };
  }
}

export default SHACLValidationEngine;