/**
 * SHACL Validator - Comprehensive Constraint Validation System
 * 
 * Implements SHACL (Shapes Constraint Language) validation for:
 * - Node shape validation
 * - Property shape validation
 * - Constraint checking (cardinality, datatype, class, etc.)
 * - Custom constraint validation
 * - Validation reporting with detailed messages
 * - Performance-optimized validation for large graphs
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { Store, Parser, Writer, Util, DataFactory } from 'n3';
import fs from 'fs/promises';
import crypto from 'crypto';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

// SHACL vocabulary
const SHACL = {
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  path: 'http://www.w3.org/ns/shacl#path',
  property: 'http://www.w3.org/ns/shacl#property',
  
  // Constraint properties
  minCount: 'http://www.w3.org/ns/shacl#minCount',
  maxCount: 'http://www.w3.org/ns/shacl#maxCount',
  datatype: 'http://www.w3.org/ns/shacl#datatype',
  nodeKind: 'http://www.w3.org/ns/shacl#nodeKind',
  class: 'http://www.w3.org/ns/shacl#class',
  pattern: 'http://www.w3.org/ns/shacl#pattern',
  minLength: 'http://www.w3.org/ns/shacl#minLength',
  maxLength: 'http://www.w3.org/ns/shacl#maxLength',
  minInclusive: 'http://www.w3.org/ns/shacl#minInclusive',
  maxInclusive: 'http://www.w3.org/ns/shacl#maxInclusive',
  minExclusive: 'http://www.w3.org/ns/shacl#minExclusive',
  maxExclusive: 'http://www.w3.org/ns/shacl#maxExclusive',
  
  // Logical constraints
  and: 'http://www.w3.org/ns/shacl#and',
  or: 'http://www.w3.org/ns/shacl#or',
  not: 'http://www.w3.org/ns/shacl#not',
  xone: 'http://www.w3.org/ns/shacl#xone',
  
  // Advanced constraints
  hasValue: 'http://www.w3.org/ns/shacl#hasValue',
  in: 'http://www.w3.org/ns/shacl#in',
  languageIn: 'http://www.w3.org/ns/shacl#languageIn',
  uniqueLang: 'http://www.w3.org/ns/shacl#uniqueLang',
  equals: 'http://www.w3.org/ns/shacl#equals',
  disjoint: 'http://www.w3.org/ns/shacl#disjoint',
  lessThan: 'http://www.w3.org/ns/shacl#lessThan',
  lessThanOrEquals: 'http://www.w3.org/ns/shacl#lessThanOrEquals',
  
  // Validation results
  ValidationResult: 'http://www.w3.org/ns/shacl#ValidationResult',
  conforms: 'http://www.w3.org/ns/shacl#conforms',
  result: 'http://www.w3.org/ns/shacl#result',
  focusNode: 'http://www.w3.org/ns/shacl#focusNode',
  resultPath: 'http://www.w3.org/ns/shacl#resultPath',
  value: 'http://www.w3.org/ns/shacl#value',
  sourceConstraintComponent: 'http://www.w3.org/ns/shacl#sourceConstraintComponent',
  sourceShape: 'http://www.w3.org/ns/shacl#sourceShape',
  resultMessage: 'http://www.w3.org/ns/shacl#resultMessage',
  resultSeverity: 'http://www.w3.org/ns/shacl#resultSeverity',
  
  // Severity levels
  Violation: 'http://www.w3.org/ns/shacl#Violation',
  Warning: 'http://www.w3.org/ns/shacl#Warning',
  Info: 'http://www.w3.org/ns/shacl#Info',
  
  // Node kinds
  BlankNode: 'http://www.w3.org/ns/shacl#BlankNode',
  IRI: 'http://www.w3.org/ns/shacl#IRI',
  Literal: 'http://www.w3.org/ns/shacl#Literal',
  BlankNodeOrIRI: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI',
  BlankNodeOrLiteral: 'http://www.w3.org/ns/shacl#BlankNodeOrLiteral',
  IRIOrLiteral: 'http://www.w3.org/ns/shacl#IRIOrLiteral'
};

export class SHACLValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Validation configuration
      strictMode: config.strictMode || false,
      enableCustomConstraints: config.enableCustomConstraints !== false,
      maxValidationDepth: config.maxValidationDepth || 10,
      validationTimeout: config.validationTimeout || 30000,
      
      // Performance settings
      enableParallelValidation: config.enableParallelValidation || false,
      batchSize: config.batchSize || 1000,
      enableCaching: config.enableCaching !== false,
      
      // Reporting settings
      detailedReports: config.detailedReports !== false,
      includeWarnings: config.includeWarnings !== false,
      includeInfo: config.includeInfo || false,
      
      // Custom constraint settings
      customConstraintDirectory: config.customConstraintDirectory || './constraints',
      
      ...config
    };
    
    this.logger = consola.withTag('shacl-validator');
    
    // SHACL shapes store
    this.shapesStore = new Store();
    this.dataStore = new Store();
    
    // Validation cache
    this.validationCache = new Map();
    this.shapeCache = new Map();
    
    // Custom constraints
    this.customConstraints = new Map();
    
    // Performance metrics
    this.metrics = {
      validationsPerformed: 0,
      constraintsChecked: 0,
      violationsFound: 0,
      warningsGenerated: 0,
      validationTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Built-in constraint handlers
    this.constraintHandlers = new Map([
      [SHACL.minCount, this._validateMinCount.bind(this)],
      [SHACL.maxCount, this._validateMaxCount.bind(this)],
      [SHACL.datatype, this._validateDatatype.bind(this)],
      [SHACL.nodeKind, this._validateNodeKind.bind(this)],
      [SHACL.class, this._validateClass.bind(this)],
      [SHACL.pattern, this._validatePattern.bind(this)],
      [SHACL.minLength, this._validateMinLength.bind(this)],
      [SHACL.maxLength, this._validateMaxLength.bind(this)],
      [SHACL.minInclusive, this._validateMinInclusive.bind(this)],
      [SHACL.maxInclusive, this._validateMaxInclusive.bind(this)],
      [SHACL.minExclusive, this._validateMinExclusive.bind(this)],
      [SHACL.maxExclusive, this._validateMaxExclusive.bind(this)],
      [SHACL.hasValue, this._validateHasValue.bind(this)],
      [SHACL.in, this._validateIn.bind(this)],
      [SHACL.languageIn, this._validateLanguageIn.bind(this)],
      [SHACL.uniqueLang, this._validateUniqueLang.bind(this)],
      [SHACL.equals, this._validateEquals.bind(this)],
      [SHACL.disjoint, this._validateDisjoint.bind(this)],
      [SHACL.lessThan, this._validateLessThan.bind(this)],
      [SHACL.lessThanOrEquals, this._validateLessThanOrEquals.bind(this)],
      [SHACL.and, this._validateAnd.bind(this)],
      [SHACL.or, this._validateOr.bind(this)],
      [SHACL.not, this._validateNot.bind(this)],
      [SHACL.xone, this._validateXone.bind(this)]
    ]);
    
    this.state = 'initialized';
  }

  /**
   * Initialize the SHACL validator
   */
  async initialize() {
    try {
      this.logger.info('Initializing SHACL validator...');
      
      // Load built-in shapes if any
      await this._loadBuiltinShapes();
      
      // Load custom constraints
      if (this.config.enableCustomConstraints) {
        await this._loadCustomConstraints();
      }
      
      this.state = 'ready';
      this.logger.success('SHACL validator initialized successfully');
      
      return {
        status: 'success',
        shapesLoaded: this.shapesStore.size,
        customConstraints: this.customConstraints.size,
        constraintHandlers: this.constraintHandlers.size
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize SHACL validator:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Load SHACL shapes from various sources
   * @param {Object} source - Shapes source configuration
   * @returns {Promise<Object>} Loading result
   */
  async loadShapes(source) {
    try {
      this.logger.info(`Loading SHACL shapes from: ${source.uri || source.path}`);
      
      let shapesData;
      
      switch (source.type) {
        case 'url':
          shapesData = await this._loadFromURL(source.uri);
          break;
        case 'file':
          shapesData = await this._loadFromFile(source.path);
          break;
        case 'string':
          shapesData = source.content;
          break;
        default:
          throw new Error(`Unsupported shapes source type: ${source.type}`);
      }
      
      // Parse SHACL shapes
      const quads = await this._parseRDF(shapesData, source.format || 'turtle');
      
      // Add to shapes store
      this.shapesStore.addQuads(quads);
      
      // Parse and cache shapes
      const shapes = await this._parseShapes(quads);
      
      this.emit('shapes:loaded', { source, shapes: shapes.length, quads: quads.length });
      this.logger.success(`SHACL shapes loaded: ${shapes.length} shapes, ${quads.length} triples`);
      
      return {
        shapesLoaded: shapes.length,
        triplesLoaded: quads.length,
        source
      };
      
    } catch (error) {
      this.logger.error('Failed to load SHACL shapes:', error);
      this.emit('shapes:error', { source, error });
      throw error;
    }
  }

  /**
   * Validate data graph against loaded SHACL shapes
   * @param {Object} dataGraph - Data graph to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation report
   */
  async validateGraph(dataGraph, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Starting SHACL validation: ${operationId}`);
      
      // Load data into store
      await this._loadDataGraph(dataGraph);
      
      // Get all shapes for validation
      const shapes = await this._getAllShapes();
      
      if (shapes.length === 0) {
        this.logger.warn('No SHACL shapes loaded for validation');
        return this._createEmptyValidationReport(operationId);
      }
      
      // Perform validation
      const validationResults = [];
      const context = {
        operationId,
        startTime,
        shapesValidated: 0,
        nodesValidated: 0,
        constraintsChecked: 0
      };
      
      // Validate each shape
      for (const shape of shapes) {
        try {
          const shapeResults = await this._validateShape(shape, context, options);
          validationResults.push(...shapeResults);
          context.shapesValidated++;
          
          // Check timeout
          if (Date.now() - startTime > this.config.validationTimeout) {
            this.logger.warn(`Validation timeout reached after ${Date.now() - startTime}ms`);
            break;
          }
          
        } catch (error) {
          this.logger.error(`Failed to validate shape ${shape.id}:`, error.message);
        }
      }
      
      // Build validation report
      const validationTime = Date.now() - startTime;
      const report = await this._buildValidationReport(validationResults, context, validationTime);
      
      // Update metrics
      this._updateMetrics(context, validationTime, validationResults);
      
      // Emit validation complete event
      this.emit('validation:complete', { operationId, report });
      
      this.logger.success(
        `SHACL validation completed in ${validationTime}ms: ` +
        `${report.violations.length} violations, ${report.warnings.length} warnings`
      );
      
      return report;
      
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.logger.error(`SHACL validation failed after ${validationTime}ms:`, error);
      this.emit('validation:error', { operationId, error, validationTime });
      throw error;
    }
  }

  /**
   * Validate specific nodes against shapes
   * @param {Array} nodes - Target nodes to validate
   * @param {Array} shapes - Shapes to validate against
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateNodes(nodes, shapes, options = {}) {
    const validationResults = [];
    const context = {
      operationId: options.operationId || crypto.randomUUID(),
      startTime: Date.now(),
      shapesValidated: 0,
      nodesValidated: 0,
      constraintsChecked: 0
    };
    
    for (const node of nodes) {
      for (const shape of shapes) {
        try {
          const results = await this._validateNodeAgainstShape(node, shape, context, options);
          validationResults.push(...results);
          
        } catch (error) {
          this.logger.error(`Failed to validate node ${node} against shape ${shape.id}:`, error.message);
        }
      }
      context.nodesValidated++;
    }
    
    const validationTime = Date.now() - context.startTime;
    return this._buildValidationReport(validationResults, context, validationTime);
  }

  /**
   * Add custom constraint handler
   * @param {string} constraintUri - Constraint URI
   * @param {Function} handler - Constraint validation handler
   */
  addConstraintHandler(constraintUri, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Constraint handler must be a function');
    }
    
    this.constraintHandlers.set(constraintUri, handler);
    this.logger.info(`Custom constraint handler added: ${constraintUri}`);
  }

  /**
   * Get validator status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        strictMode: this.config.strictMode,
        enableCustomConstraints: this.config.enableCustomConstraints,
        maxValidationDepth: this.config.maxValidationDepth,
        validationTimeout: this.config.validationTimeout,
        enableParallelValidation: this.config.enableParallelValidation
      },
      shapes: {
        loaded: this._getShapesCount(),
        nodeShapes: this._getNodeShapesCount(),
        propertyShapes: this._getPropertyShapesCount()
      },
      constraints: {
        builtin: this.constraintHandlers.size,
        custom: this.customConstraints.size
      },
      cache: {
        validationCache: this.validationCache.size,
        shapeCache: this.shapeCache.size
      },
      metrics: { ...this.metrics },
      performance: {
        averageValidationTime: this.metrics.validationsPerformed > 0 ?
          Math.round(this.metrics.validationTime / this.metrics.validationsPerformed) : 0,
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0
      }
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    this.shapeCache.clear();
    this.logger.info('Validation cache cleared');
  }

  /**
   * Shutdown the validator
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down SHACL validator...');
      
      // Clear all stores and caches
      this.shapesStore.removeQuads(this.shapesStore.getQuads());
      this.dataStore.removeQuads(this.dataStore.getQuads());
      this.clearCache();
      this.customConstraints.clear();
      
      this.state = 'shutdown';
      this.logger.success('SHACL validator shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during SHACL validator shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Load built-in shapes
   */
  async _loadBuiltinShapes() {
    // Load any built-in SHACL shapes
    this.logger.debug('No built-in shapes to load');
  }

  /**
   * Load custom constraints
   */
  async _loadCustomConstraints() {
    try {
      const constraintsDir = this.config.customConstraintDirectory;
      const files = await fs.readdir(constraintsDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const constraintPath = path.join(constraintsDir, file);
          try {
            const constraint = await import(constraintPath);
            this.customConstraints.set(constraint.uri, constraint);
          } catch (error) {
            this.logger.warn(`Failed to load custom constraint ${file}:`, error.message);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.customConstraints.size} custom constraints`);
      
    } catch (error) {
      this.logger.debug('Custom constraints directory not found or accessible');
    }
  }

  /**
   * Load data graph into store
   */
  async _loadDataGraph(dataGraph) {
    // Clear existing data
    this.dataStore.removeQuads(this.dataStore.getQuads());
    
    if (dataGraph.triples && Array.isArray(dataGraph.triples)) {
      for (const triple of dataGraph.triples) {
        try {
          const quad = this._tripleToQuad(triple);
          this.dataStore.addQuad(quad);
        } catch (error) {
          this.logger.warn(`Failed to load triple: ${JSON.stringify(triple)}`, error.message);
        }
      }
    }
    
    if (dataGraph.quads && Array.isArray(dataGraph.quads)) {
      this.dataStore.addQuads(dataGraph.quads);
    }
    
    this.logger.debug(`Loaded ${this.dataStore.size} triples into data store`);
  }

  /**
   * Get all shapes from shapes store
   */
  async _getAllShapes() {
    if (this.shapeCache.has('all-shapes')) {
      this.metrics.cacheHits++;
      return this.shapeCache.get('all-shapes');
    }
    
    this.metrics.cacheMisses++;
    
    const shapes = [];
    
    // Get node shapes
    const nodeShapeQuads = this.shapesStore.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode(SHACL.NodeShape)
    );
    
    for (const quad of nodeShapeQuads) {
      const shape = await this._parseNodeShape(quad.subject);
      if (shape) {
        shapes.push(shape);
      }
    }
    
    // Get property shapes
    const propertyShapeQuads = this.shapesStore.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode(SHACL.PropertyShape)
    );
    
    for (const quad of propertyShapeQuads) {
      const shape = await this._parsePropertyShape(quad.subject);
      if (shape) {
        shapes.push(shape);
      }
    }
    
    // Cache results
    if (this.config.enableCaching) {
      this.shapeCache.set('all-shapes', shapes);
    }
    
    return shapes;
  }

  /**
   * Parse node shape
   */
  async _parseNodeShape(shapeNode) {
    const shape = {
      id: shapeNode.value,
      type: 'NodeShape',
      targetClasses: [],
      targetNodes: [],
      properties: [],
      constraints: new Map()
    };
    
    // Get target classes
    const targetClassQuads = this.shapesStore.getQuads(shapeNode, namedNode(SHACL.targetClass), null);
    shape.targetClasses = targetClassQuads.map(q => q.object.value);
    
    // Get target nodes
    const targetNodeQuads = this.shapesStore.getQuads(shapeNode, namedNode(SHACL.targetNode), null);
    shape.targetNodes = targetNodeQuads.map(q => q.object.value);
    
    // Get property shapes
    const propertyQuads = this.shapesStore.getQuads(shapeNode, namedNode(SHACL.property), null);
    for (const propertyQuad of propertyQuads) {
      const propertyShape = await this._parsePropertyShape(propertyQuad.object);
      if (propertyShape) {
        shape.properties.push(propertyShape);
      }
    }
    
    // Parse constraints directly on node shape
    await this._parseConstraints(shapeNode, shape.constraints);
    
    return shape;
  }

  /**
   * Parse property shape
   */
  async _parsePropertyShape(shapeNode) {
    const shape = {
      id: shapeNode.value,
      type: 'PropertyShape',
      path: null,
      constraints: new Map()
    };
    
    // Get path
    const pathQuads = this.shapesStore.getQuads(shapeNode, namedNode(SHACL.path), null);
    if (pathQuads.length > 0) {
      shape.path = pathQuads[0].object.value;
    }
    
    // Parse constraints
    await this._parseConstraints(shapeNode, shape.constraints);
    
    return shape;
  }

  /**
   * Parse constraints for a shape
   */
  async _parseConstraints(shapeNode, constraints) {
    // Parse all constraint properties
    for (const [constraintProperty, handler] of this.constraintHandlers) {
      const constraintQuads = this.shapesStore.getQuads(shapeNode, namedNode(constraintProperty), null);
      
      if (constraintQuads.length > 0) {
        constraints.set(constraintProperty, {
          value: constraintQuads[0].object.value,
          handler
        });
      }
    }
  }

  /**
   * Validate shape against data
   */
  async _validateShape(shape, context, options) {
    const validationResults = [];
    
    // Get target nodes for this shape
    const targetNodes = await this._getTargetNodes(shape);
    
    // Validate each target node
    for (const targetNode of targetNodes) {
      try {
        const nodeResults = await this._validateNodeAgainstShape(targetNode, shape, context, options);
        validationResults.push(...nodeResults);
        
      } catch (error) {
        this.logger.error(`Failed to validate node ${targetNode} against shape ${shape.id}:`, error.message);
      }
    }
    
    return validationResults;
  }

  /**
   * Get target nodes for shape
   */
  async _getTargetNodes(shape) {
    const targetNodes = new Set();
    
    // Add explicit target nodes
    for (const targetNode of shape.targetNodes || []) {
      targetNodes.add(targetNode);
    }
    
    // Add instances of target classes
    for (const targetClass of shape.targetClasses || []) {
      const instanceQuads = this.dataStore.getQuads(
        null,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode(targetClass)
      );
      
      for (const quad of instanceQuads) {
        targetNodes.add(quad.subject.value);
      }
    }
    
    return Array.from(targetNodes);
  }

  /**
   * Validate node against shape
   */
  async _validateNodeAgainstShape(nodeUri, shape, context, options) {
    const validationResults = [];
    const node = namedNode(nodeUri);
    
    // Check cache
    const cacheKey = `${nodeUri}:${shape.id}`;
    if (this.config.enableCaching && this.validationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.validationCache.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    try {
      // Validate node-level constraints
      if (shape.constraints && shape.constraints.size > 0) {
        for (const [constraintProperty, constraint] of shape.constraints) {
          try {
            const constraintResults = await constraint.handler(
              node,
              constraint.value,
              { shape, constraintProperty, context }
            );
            
            validationResults.push(...constraintResults);
            context.constraintsChecked++;
            
          } catch (error) {
            this.logger.error(`Constraint validation failed for ${constraintProperty}:`, error.message);
          }
        }
      }
      
      // Validate property shapes
      if (shape.properties && Array.isArray(shape.properties)) {
        for (const propertyShape of shape.properties) {
          try {
            const propertyResults = await this._validatePropertyShape(node, propertyShape, context, options);
            validationResults.push(...propertyResults);
            
          } catch (error) {
            this.logger.error(`Property shape validation failed for ${propertyShape.id}:`, error.message);
          }
        }
      }
      
      // Cache results
      if (this.config.enableCaching) {
        this.validationCache.set(cacheKey, validationResults);
      }
      
    } catch (error) {
      this.logger.error(`Node validation failed for ${nodeUri}:`, error.message);
    }
    
    return validationResults;
  }

  /**
   * Validate property shape
   */
  async _validatePropertyShape(focusNode, propertyShape, context, options) {
    const validationResults = [];
    
    if (!propertyShape.path) {
      return validationResults;
    }
    
    // Get property values
    const propertyQuads = this.dataStore.getQuads(focusNode, namedNode(propertyShape.path), null);
    const propertyValues = propertyQuads.map(q => q.object);
    
    // Validate constraints
    for (const [constraintProperty, constraint] of propertyShape.constraints) {
      try {
        const constraintResults = await constraint.handler(
          focusNode,
          constraint.value,
          {
            shape: propertyShape,
            constraintProperty,
            context,
            propertyPath: propertyShape.path,
            propertyValues
          }
        );
        
        validationResults.push(...constraintResults);
        context.constraintsChecked++;
        
      } catch (error) {
        this.logger.error(`Property constraint validation failed for ${constraintProperty}:`, error.message);
      }
    }
    
    return validationResults;
  }

  /**
   * Build validation report
   */
  async _buildValidationReport(validationResults, context, validationTime) {
    const violations = [];
    const warnings = [];
    const infos = [];
    
    for (const result of validationResults) {
      switch (result.severity) {
        case SHACL.Violation:
          violations.push(result);
          break;
        case SHACL.Warning:
          if (this.config.includeWarnings) {
            warnings.push(result);
          }
          break;
        case SHACL.Info:
          if (this.config.includeInfo) {
            infos.push(result);
          }
          break;
      }
    }
    
    return {
      conforms: violations.length === 0,
      violations,
      warnings,
      infos,
      statistics: {
        shapesValidated: context.shapesValidated,
        nodesValidated: context.nodesValidated,
        constraintsChecked: context.constraintsChecked,
        validationTime
      },
      validatedAt: new Date().toISOString(),
      operationId: context.operationId
    };
  }

  /**
   * Create empty validation report
   */
  _createEmptyValidationReport(operationId) {
    return {
      conforms: true,
      violations: [],
      warnings: [],
      infos: [],
      statistics: {
        shapesValidated: 0,
        nodesValidated: 0,
        constraintsChecked: 0,
        validationTime: 0
      },
      validatedAt: new Date().toISOString(),
      operationId
    };
  }

  // Constraint validation methods

  /**
   * Validate minCount constraint
   */
  async _validateMinCount(focusNode, minCount, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues && propertyValues.length < parseInt(minCount)) {
      results.push({
        focusNode: focusNode.value,
        resultPath: propertyPath,
        sourceShape: shape.id,
        sourceConstraintComponent: SHACL.minCount,
        severity: SHACL.Violation,
        resultMessage: `Property ${propertyPath} has ${propertyValues.length} values but requires at least ${minCount}`,
        constraintValue: minCount
      });
    }
    
    return results;
  }

  /**
   * Validate maxCount constraint
   */
  async _validateMaxCount(focusNode, maxCount, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues && propertyValues.length > parseInt(maxCount)) {
      results.push({
        focusNode: focusNode.value,
        resultPath: propertyPath,
        sourceShape: shape.id,
        sourceConstraintComponent: SHACL.maxCount,
        severity: SHACL.Violation,
        resultMessage: `Property ${propertyPath} has ${propertyValues.length} values but allows at most ${maxCount}`,
        constraintValue: maxCount
      });
    }
    
    return results;
  }

  /**
   * Validate datatype constraint
   */
  async _validateDatatype(focusNode, datatype, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && value.datatype.value !== datatype) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.datatype,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" does not have datatype ${datatype}`,
            constraintValue: datatype
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate nodeKind constraint
   */
  async _validateNodeKind(focusNode, nodeKind, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      for (const value of propertyValues) {
        let isValidKind = false;
        
        switch (nodeKind) {
          case SHACL.IRI:
            isValidKind = value.termType === 'NamedNode';
            break;
          case SHACL.Literal:
            isValidKind = value.termType === 'Literal';
            break;
          case SHACL.BlankNode:
            isValidKind = value.termType === 'BlankNode';
            break;
          case SHACL.BlankNodeOrIRI:
            isValidKind = value.termType === 'BlankNode' || value.termType === 'NamedNode';
            break;
          case SHACL.BlankNodeOrLiteral:
            isValidKind = value.termType === 'BlankNode' || value.termType === 'Literal';
            break;
          case SHACL.IRIOrLiteral:
            isValidKind = value.termType === 'NamedNode' || value.termType === 'Literal';
            break;
        }
        
        if (!isValidKind) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.nodeKind,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" is not of node kind ${nodeKind}`,
            constraintValue: nodeKind
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate class constraint
   */
  async _validateClass(focusNode, classUri, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      for (const value of propertyValues) {
        if (value.termType === 'NamedNode') {
          // Check if value is instance of required class
          const typeQuads = this.dataStore.getQuads(
            value,
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode(classUri)
          );
          
          if (typeQuads.length === 0) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.class,
              severity: SHACL.Violation,
              resultMessage: `Value "${value.value}" is not an instance of class ${classUri}`,
              constraintValue: classUri
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate pattern constraint
   */
  async _validatePattern(focusNode, pattern, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const regex = new RegExp(pattern);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && !regex.test(value.value)) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.pattern,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" does not match pattern ${pattern}`,
            constraintValue: pattern
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate minLength constraint
   */
  async _validateMinLength(focusNode, minLength, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const minLen = parseInt(minLength);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && value.value.length < minLen) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.minLength,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" has length ${value.value.length} but requires at least ${minLen}`,
            constraintValue: minLength
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate maxLength constraint
   */
  async _validateMaxLength(focusNode, maxLength, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const maxLen = parseInt(maxLength);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && value.value.length > maxLen) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.maxLength,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" has length ${value.value.length} but allows at most ${maxLen}`,
            constraintValue: maxLength
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate minInclusive constraint
   */
  async _validateMinInclusive(focusNode, minInclusive, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const minVal = parseFloat(minInclusive);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          if (!isNaN(numValue) && numValue < minVal) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.minInclusive,
              severity: SHACL.Violation,
              resultMessage: `Value ${value.value} is less than minimum allowed value ${minInclusive}`,
              constraintValue: minInclusive
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate maxInclusive constraint
   */
  async _validateMaxInclusive(focusNode, maxInclusive, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const maxVal = parseFloat(maxInclusive);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          if (!isNaN(numValue) && numValue > maxVal) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.maxInclusive,
              severity: SHACL.Violation,
              resultMessage: `Value ${value.value} is greater than maximum allowed value ${maxInclusive}`,
              constraintValue: maxInclusive
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate minExclusive constraint
   */
  async _validateMinExclusive(focusNode, minExclusive, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const minVal = parseFloat(minExclusive);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          if (!isNaN(numValue) && numValue <= minVal) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.minExclusive,
              severity: SHACL.Violation,
              resultMessage: `Value ${value.value} must be greater than ${minExclusive}`,
              constraintValue: minExclusive
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate maxExclusive constraint
   */
  async _validateMaxExclusive(focusNode, maxExclusive, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const maxVal = parseFloat(maxExclusive);
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          if (!isNaN(numValue) && numValue >= maxVal) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.maxExclusive,
              severity: SHACL.Violation,
              resultMessage: `Value ${value.value} must be less than ${maxExclusive}`,
              constraintValue: maxExclusive
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate hasValue constraint
   */
  async _validateHasValue(focusNode, hasValue, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (propertyValues) {
      const hasRequiredValue = propertyValues.some(value => value.value === hasValue);
      
      if (!hasRequiredValue) {
        results.push({
          focusNode: focusNode.value,
          resultPath: propertyPath,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.hasValue,
          severity: SHACL.Violation,
          resultMessage: `Property ${propertyPath} must have value "${hasValue}"`,
          constraintValue: hasValue
        });
      }
    }
    
    return results;
  }

  /**
   * Validate in constraint
   */
  async _validateIn(focusNode, inValues, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    // Parse allowed values (simplified - would need full RDF list parsing)
    const allowedValues = inValues.split(',').map(v => v.trim());
    
    if (propertyValues) {
      for (const value of propertyValues) {
        if (!allowedValues.includes(value.value)) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.in,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" is not in allowed list: [${allowedValues.join(', ')}]`,
            constraintValue: inValues
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate languageIn constraint
   */
  async _validateLanguageIn(focusNode, languageIn, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    const allowedLanguages = languageIn.split(',').map(lang => lang.trim());
    
    if (propertyValues) {
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && value.language && !allowedLanguages.includes(value.language)) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.languageIn,
            severity: SHACL.Violation,
            resultMessage: `Language tag "${value.language}" is not in allowed list: [${allowedLanguages.join(', ')}]`,
            constraintValue: languageIn
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate uniqueLang constraint
   */
  async _validateUniqueLang(focusNode, uniqueLang, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    if (uniqueLang === 'true' && propertyValues) {
      const languages = new Set();
      
      for (const value of propertyValues) {
        if (value.termType === 'Literal' && value.language) {
          if (languages.has(value.language)) {
            results.push({
              focusNode: focusNode.value,
              resultPath: propertyPath,
              value: value.value,
              sourceShape: shape.id,
              sourceConstraintComponent: SHACL.uniqueLang,
              severity: SHACL.Violation,
              resultMessage: `Duplicate language tag "${value.language}" found`,
              constraintValue: uniqueLang
            });
          }
          languages.add(value.language);
        }
      }
    }
    
    return results;
  }

  /**
   * Validate equals constraint
   */
  async _validateEquals(focusNode, equalsProperty, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    // Get values of the property we should be equal to
    const equalsQuads = this.dataStore.getQuads(focusNode, namedNode(equalsProperty), null);
    const equalsValues = equalsQuads.map(q => q.object.value);
    
    if (propertyValues) {
      const currentValues = propertyValues.map(v => v.value);
      
      if (JSON.stringify(currentValues.sort()) !== JSON.stringify(equalsValues.sort())) {
        results.push({
          focusNode: focusNode.value,
          resultPath: propertyPath,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.equals,
          severity: SHACL.Violation,
          resultMessage: `Property ${propertyPath} must have same values as ${equalsProperty}`,
          constraintValue: equalsProperty
        });
      }
    }
    
    return results;
  }

  /**
   * Validate disjoint constraint
   */
  async _validateDisjoint(focusNode, disjointProperty, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    // Get values of the disjoint property
    const disjointQuads = this.dataStore.getQuads(focusNode, namedNode(disjointProperty), null);
    const disjointValues = new Set(disjointQuads.map(q => q.object.value));
    
    if (propertyValues) {
      for (const value of propertyValues) {
        if (disjointValues.has(value.value)) {
          results.push({
            focusNode: focusNode.value,
            resultPath: propertyPath,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.disjoint,
            severity: SHACL.Violation,
            resultMessage: `Value "${value.value}" appears in both ${propertyPath} and disjoint property ${disjointProperty}`,
            constraintValue: disjointProperty
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Validate lessThan constraint
   */
  async _validateLessThan(focusNode, lessThanProperty, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    // Get values to compare against
    const lessThanQuads = this.dataStore.getQuads(focusNode, namedNode(lessThanProperty), null);
    
    if (propertyValues && lessThanQuads.length > 0) {
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          
          for (const compareQuad of lessThanQuads) {
            if (compareQuad.object.termType === 'Literal') {
              const compareValue = parseFloat(compareQuad.object.value);
              
              if (!isNaN(numValue) && !isNaN(compareValue) && numValue >= compareValue) {
                results.push({
                  focusNode: focusNode.value,
                  resultPath: propertyPath,
                  value: value.value,
                  sourceShape: shape.id,
                  sourceConstraintComponent: SHACL.lessThan,
                  severity: SHACL.Violation,
                  resultMessage: `Value ${value.value} must be less than ${compareValue} from ${lessThanProperty}`,
                  constraintValue: lessThanProperty
                });
              }
            }
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Validate lessThanOrEquals constraint
   */
  async _validateLessThanOrEquals(focusNode, lessThanOrEqualsProperty, validationContext) {
    const results = [];
    const { propertyValues, propertyPath, shape } = validationContext;
    
    // Get values to compare against
    const lessThanOrEqualsQuads = this.dataStore.getQuads(focusNode, namedNode(lessThanOrEqualsProperty), null);
    
    if (propertyValues && lessThanOrEqualsQuads.length > 0) {
      for (const value of propertyValues) {
        if (value.termType === 'Literal') {
          const numValue = parseFloat(value.value);
          
          for (const compareQuad of lessThanOrEqualsQuads) {
            if (compareQuad.object.termType === 'Literal') {
              const compareValue = parseFloat(compareQuad.object.value);
              
              if (!isNaN(numValue) && !isNaN(compareValue) && numValue > compareValue) {
                results.push({
                  focusNode: focusNode.value,
                  resultPath: propertyPath,
                  value: value.value,
                  sourceShape: shape.id,
                  sourceConstraintComponent: SHACL.lessThanOrEquals,
                  severity: SHACL.Violation,
                  resultMessage: `Value ${value.value} must be less than or equal to ${compareValue} from ${lessThanOrEqualsProperty}`,
                  constraintValue: lessThanOrEqualsProperty
                });
              }
            }
          }
        }
      }
    }
    
    return results;
  }

  // Logical constraint validators (simplified implementations)

  /**
   * Validate and constraint
   */
  async _validateAnd(focusNode, andConstraints, validationContext) {
    // Simplified - would need full logical constraint implementation
    return [];
  }

  /**
   * Validate or constraint
   */
  async _validateOr(focusNode, orConstraints, validationContext) {
    // Simplified - would need full logical constraint implementation
    return [];
  }

  /**
   * Validate not constraint
   */
  async _validateNot(focusNode, notConstraint, validationContext) {
    // Simplified - would need full logical constraint implementation
    return [];
  }

  /**
   * Validate xone constraint
   */
  async _validateXone(focusNode, xoneConstraints, validationContext) {
    // Simplified - would need full logical constraint implementation
    return [];
  }

  // Helper methods

  /**
   * Parse RDF data
   */
  async _parseRDF(data, format) {
    return new Promise((resolve, reject) => {
      const quads = [];
      const parser = new Parser();
      
      parser.parse(data, (error, quad, prefixes) => {
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
   * Parse shapes from quads
   */
  async _parseShapes(quads) {
    const shapes = [];
    
    // This would parse shapes from quads
    // Simplified implementation
    
    return shapes;
  }

  /**
   * Load from URL
   */
  async _loadFromURL(uri) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Load from file
   */
  async _loadFromFile(path) {
    return await fs.readFile(path, 'utf8');
  }

  /**
   * Convert triple to quad
   */
  _tripleToQuad(triple) {
    return quad(
      namedNode(triple.subject),
      namedNode(triple.predicate),
      triple.object.startsWith('http') ? namedNode(triple.object) : literal(triple.object),
      defaultGraph()
    );
  }

  /**
   * Get shapes count
   */
  _getShapesCount() {
    const nodeShapes = this.shapesStore.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(SHACL.NodeShape)).length;
    const propertyShapes = this.shapesStore.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(SHACL.PropertyShape)).length;
    return nodeShapes + propertyShapes;
  }

  /**
   * Get node shapes count
   */
  _getNodeShapesCount() {
    return this.shapesStore.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(SHACL.NodeShape)).length;
  }

  /**
   * Get property shapes count
   */
  _getPropertyShapesCount() {
    return this.shapesStore.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(SHACL.PropertyShape)).length;
  }

  /**
   * Update performance metrics
   */
  _updateMetrics(context, validationTime, validationResults) {
    this.metrics.validationsPerformed++;
    this.metrics.constraintsChecked += context.constraintsChecked;
    this.metrics.validationTime += validationTime;
    
    for (const result of validationResults) {
      if (result.severity === SHACL.Violation) {
        this.metrics.violationsFound++;
      } else if (result.severity === SHACL.Warning) {
        this.metrics.warningsGenerated++;
      }
    }
  }
}

export default SHACLValidator;