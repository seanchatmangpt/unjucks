/**
 * SHACL Validation Engine for KGEN
 * Pure JavaScript SHACL validation without external dependencies
 * Implements core SHACL constraints for reliable validation
 */

import { Store, Parser, DataFactory } from 'n3';
import fs from 'fs/promises';
import path from 'path';
import { consola } from 'consola';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

// SHACL vocabulary constants
const SHACL = {
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  path: 'http://www.w3.org/ns/shacl#path',
  property: 'http://www.w3.org/ns/shacl#property',
  
  // Core constraints
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
  hasValue: 'http://www.w3.org/ns/shacl#hasValue',
  in: 'http://www.w3.org/ns/shacl#in',
  
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

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Pure JavaScript SHACL Validation Engine
 */
export class SHACLEngine {
  constructor(config = {}) {
    this.config = {
      strictMode: config.strictMode || false,
      enableCaching: config.enableCaching !== false,
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.logger = consola.withTag('shacl-validator');
    this.shapesStore = new Store();
    this.dataStore = new Store();
    this.validationCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the SHACL validator
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.logger.info('Initializing pure JavaScript SHACL validator...');
      this.initialized = true;
      this.logger.success('SHACL validator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SHACL validator:', error);
      throw error;
    }
  }

  /**
   * Validate RDF data against SHACL shapes
   * @param {Dataset|Store} dataGraph - RDF dataset to validate  
   * @param {Dataset|Store} shapesGraph - SHACL shapes dataset
   * @returns {Promise<ValidationReport>} Validation report
   */
  async validateGraph(dataGraph, shapesGraph) {
    await this.initialize();
    
    const startTime = Date.now();
    this.logger.info('Starting SHACL validation...');
    
    try {
      // Load data and shapes into stores
      await this._loadDataGraph(dataGraph);
      await this._loadShapesGraph(shapesGraph);
      
      // Parse shapes from the shapes graph
      const shapes = await this._parseAllShapes();
      
      if (shapes.length === 0) {
        this.logger.warn('No SHACL shapes found for validation');
        return this._createEmptyValidationReport();
      }
      
      // Perform validation
      const violations = [];
      
      for (const shape of shapes) {
        try {
          const shapeViolations = await this._validateShape(shape);
          violations.push(...shapeViolations);
        } catch (error) {
          this.logger.error(`Error validating shape ${shape.id}:`, error.message);
        }
      }
      
      const validationTime = Date.now() - startTime;
      const report = {
        conforms: violations.length === 0,
        violations,
        timestamp: new Date().toISOString(),
        engine: 'kgen-shacl-validator',
        statistics: {
          shapesValidated: shapes.length,
          violationsFound: violations.length,
          validationTime
        }
      };
      
      this.logger.success(`SHACL validation completed in ${validationTime}ms: ${violations.length} violations found`);
      return report;
      
    } catch (error) {
      this.logger.error('SHACL validation failed:', error);
      throw error;
    }
  }

  /**
   * Load data graph into internal store
   * @param {Dataset|Store|Array} dataGraph - RDF data
   */
  async _loadDataGraph(dataGraph) {
    this.dataStore.removeQuads(this.dataStore.getQuads());
    
    if (dataGraph && typeof dataGraph.getQuads === 'function') {
      // It's a Store
      this.dataStore.addQuads(dataGraph.getQuads());
    } else if (dataGraph && Array.isArray(dataGraph)) {
      // It's an array of quads
      this.dataStore.addQuads(dataGraph);
    } else if (dataGraph && dataGraph.triples) {
      // It's a data structure with triples
      for (const triple of dataGraph.triples) {
        const quad = this._tripleToQuad(triple);
        this.dataStore.addQuad(quad);
      }
    }
    
    this.logger.debug(`Loaded ${this.dataStore.size} triples into data store`);
  }

  /**
   * Load shapes graph into internal store
   * @param {Dataset|Store|Array} shapesGraph - SHACL shapes
   */
  async _loadShapesGraph(shapesGraph) {
    this.shapesStore.removeQuads(this.shapesStore.getQuads());
    
    if (shapesGraph && typeof shapesGraph.getQuads === 'function') {
      // It's a Store
      this.shapesStore.addQuads(shapesGraph.getQuads());
    } else if (shapesGraph && Array.isArray(shapesGraph)) {
      // It's an array of quads
      this.shapesStore.addQuads(shapesGraph);
    }
    
    this.logger.debug(`Loaded ${this.shapesStore.size} triples into shapes store`);
  }

  /**
   * Parse all shapes from shapes store
   * @returns {Array} Array of parsed shapes
   */
  async _parseAllShapes() {
    const shapes = [];
    
    // Get all node shapes
    const nodeShapeQuads = this.shapesStore.getQuads(null, namedNode(RDF_TYPE), namedNode(SHACL.NodeShape));
    for (const quad of nodeShapeQuads) {
      const shape = await this._parseNodeShape(quad.subject);
      if (shape) shapes.push(shape);
    }
    
    // Get all property shapes
    const propertyShapeQuads = this.shapesStore.getQuads(null, namedNode(RDF_TYPE), namedNode(SHACL.PropertyShape));
    for (const quad of propertyShapeQuads) {
      const shape = await this._parsePropertyShape(quad.subject);
      if (shape) shapes.push(shape);
    }
    
    this.logger.debug(`Parsed ${shapes.length} SHACL shapes`);
    return shapes;
  }

  /**
   * Parse a node shape
   * @param {NamedNode} shapeNode - Shape node
   * @returns {Object} Parsed node shape
   */
  async _parseNodeShape(shapeNode) {
    const shape = {
      id: shapeNode.value,
      type: 'NodeShape',
      targetClasses: [],
      targetNodes: [],
      properties: [],
      constraints: {}
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
    
    // Parse direct constraints
    this._parseConstraints(shapeNode, shape.constraints);
    
    return shape;
  }

  /**
   * Parse a property shape
   * @param {NamedNode} shapeNode - Shape node
   * @returns {Object} Parsed property shape
   */
  async _parsePropertyShape(shapeNode) {
    const shape = {
      id: shapeNode.value,
      type: 'PropertyShape',
      path: null,
      constraints: {}
    };
    
    // Get path
    const pathQuads = this.shapesStore.getQuads(shapeNode, namedNode(SHACL.path), null);
    if (pathQuads.length > 0) {
      shape.path = pathQuads[0].object.value;
    }
    
    // Parse constraints
    this._parseConstraints(shapeNode, shape.constraints);
    
    return shape;
  }

  /**
   * Parse constraints from a shape node
   * @param {NamedNode} shapeNode - Shape node
   * @param {Object} constraints - Constraints object to populate
   */
  _parseConstraints(shapeNode, constraints) {
    const constraintProperties = [
      SHACL.minCount, SHACL.maxCount, SHACL.datatype, SHACL.nodeKind,
      SHACL.class, SHACL.pattern, SHACL.minLength, SHACL.maxLength,
      SHACL.minInclusive, SHACL.maxInclusive, SHACL.minExclusive,
      SHACL.maxExclusive, SHACL.hasValue, SHACL.in
    ];
    
    for (const constraintProperty of constraintProperties) {
      const constraintQuads = this.shapesStore.getQuads(shapeNode, namedNode(constraintProperty), null);
      if (constraintQuads.length > 0) {
        constraints[constraintProperty] = constraintQuads[0].object.value;
      }
    }
  }

  /**
   * Validate a shape against the data
   * @param {Object} shape - Parsed shape
   * @returns {Array} Array of violations
   */
  async _validateShape(shape) {
    const violations = [];
    
    // Get target nodes for this shape
    const targetNodes = this._getTargetNodes(shape);
    
    // Validate each target node
    for (const targetNode of targetNodes) {
      if (shape.type === 'NodeShape') {
        violations.push(...await this._validateNodeShape(targetNode, shape));
      } else if (shape.type === 'PropertyShape') {
        violations.push(...await this._validatePropertyShape(targetNode, shape));
      }
    }
    
    return violations;
  }

  /**
   * Get target nodes for a shape
   * @param {Object} shape - Parsed shape
   * @returns {Array} Array of target node URIs
   */
  _getTargetNodes(shape) {
    const targetNodes = new Set();
    
    // Add explicit target nodes
    if (shape.targetNodes) {
      shape.targetNodes.forEach(node => targetNodes.add(node));
    }
    
    // Add instances of target classes
    if (shape.targetClasses) {
      shape.targetClasses.forEach(targetClass => {
        const instanceQuads = this.dataStore.getQuads(null, namedNode(RDF_TYPE), namedNode(targetClass));
        instanceQuads.forEach(quad => targetNodes.add(quad.subject.value));
      });
    }
    
    return Array.from(targetNodes);
  }

  /**
   * Validate a node shape
   * @param {string} nodeUri - Node URI
   * @param {Object} shape - Node shape
   * @returns {Array} Array of violations
   */
  async _validateNodeShape(nodeUri, shape) {
    const violations = [];
    const focusNode = namedNode(nodeUri);
    
    // Validate direct constraints
    violations.push(...this._validateConstraints(focusNode, null, shape.constraints, shape));
    
    // Validate property shapes
    for (const propertyShape of shape.properties || []) {
      violations.push(...await this._validatePropertyShape(nodeUri, propertyShape));
    }
    
    return violations;
  }

  /**
   * Validate a property shape
   * @param {string} nodeUri - Focus node URI
   * @param {Object} shape - Property shape
   * @returns {Array} Array of violations
   */
  async _validatePropertyShape(nodeUri, shape) {
    if (!shape.path) return [];
    
    const violations = [];
    const focusNode = namedNode(nodeUri);
    const propertyPath = namedNode(shape.path);
    
    // Get property values
    const propertyQuads = this.dataStore.getQuads(focusNode, propertyPath, null);
    const propertyValues = propertyQuads.map(q => q.object);
    
    // Validate constraints
    violations.push(...this._validateConstraints(focusNode, propertyPath, shape.constraints, shape, propertyValues));
    
    return violations;
  }

  /**
   * Validate constraints
   * @param {NamedNode} focusNode - Focus node
   * @param {NamedNode} propertyPath - Property path (null for node constraints)
   * @param {Object} constraints - Constraints to validate
   * @param {Object} shape - Shape context
   * @param {Array} propertyValues - Property values (for property constraints)
   * @returns {Array} Array of violations
   */
  _validateConstraints(focusNode, propertyPath, constraints, shape, propertyValues = []) {
    const violations = [];
    
    for (const [constraintType, constraintValue] of Object.entries(constraints)) {
      try {
        const constraintViolations = this._validateConstraint(
          constraintType, constraintValue, focusNode, propertyPath, 
          shape, propertyValues
        );
        violations.push(...constraintViolations);
      } catch (error) {
        this.logger.error(`Error validating constraint ${constraintType}:`, error.message);
      }
    }
    
    return violations;
  }

  /**
   * Validate a single constraint
   * @param {string} constraintType - Constraint type URI
   * @param {string} constraintValue - Constraint value
   * @param {NamedNode} focusNode - Focus node
   * @param {NamedNode} propertyPath - Property path
   * @param {Object} shape - Shape context
   * @param {Array} propertyValues - Property values
   * @returns {Array} Array of violations
   */
  _validateConstraint(constraintType, constraintValue, focusNode, propertyPath, shape, propertyValues) {
    switch (constraintType) {
      case SHACL.minCount:
        return this._validateMinCount(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.maxCount:
        return this._validateMaxCount(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.datatype:
        return this._validateDatatype(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.nodeKind:
        return this._validateNodeKind(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.class:
        return this._validateClass(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.pattern:
        return this._validatePattern(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.minLength:
        return this._validateMinLength(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.maxLength:
        return this._validateMaxLength(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.minInclusive:
        return this._validateMinInclusive(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.maxInclusive:
        return this._validateMaxInclusive(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.minExclusive:
        return this._validateMinExclusive(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.maxExclusive:
        return this._validateMaxExclusive(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.hasValue:
        return this._validateHasValue(constraintValue, focusNode, propertyPath, shape, propertyValues);
      case SHACL.in:
        return this._validateIn(constraintValue, focusNode, propertyPath, shape, propertyValues);
      default:
        this.logger.warn(`Unsupported constraint type: ${constraintType}`);
        return [];
    }
  }

  // Constraint validation methods

  _validateMinCount(minCount, focusNode, propertyPath, shape, propertyValues) {
    const min = parseInt(minCount);
    if (propertyValues.length < min) {
      return [{
        focusNode: focusNode.value,
        resultPath: propertyPath?.value,
        sourceShape: shape.id,
        sourceConstraintComponent: SHACL.minCount,
        resultSeverity: SHACL.Violation,
        resultMessage: `Property has ${propertyValues.length} values but requires at least ${min}`,
        constraintValue: minCount
      }];
    }
    return [];
  }

  _validateMaxCount(maxCount, focusNode, propertyPath, shape, propertyValues) {
    const max = parseInt(maxCount);
    if (propertyValues.length > max) {
      return [{
        focusNode: focusNode.value,
        resultPath: propertyPath?.value,
        sourceShape: shape.id,
        sourceConstraintComponent: SHACL.maxCount,
        resultSeverity: SHACL.Violation,
        resultMessage: `Property has ${propertyValues.length} values but allows at most ${max}`,
        constraintValue: maxCount
      }];
    }
    return [];
  }

  _validateDatatype(datatype, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    for (const value of propertyValues) {
      if (value.termType === 'Literal' && value.datatype.value !== datatype) {
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.datatype,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" does not have datatype ${datatype}`,
          constraintValue: datatype
        });
      }
    }
    return violations;
  }

  _validateNodeKind(nodeKind, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
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
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.nodeKind,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" is not of node kind ${nodeKind}`,
          constraintValue: nodeKind
        });
      }
    }
    return violations;
  }

  _validateClass(classUri, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    for (const value of propertyValues) {
      if (value.termType === 'NamedNode') {
        const typeQuads = this.dataStore.getQuads(value, namedNode(RDF_TYPE), namedNode(classUri));
        if (typeQuads.length === 0) {
          violations.push({
            focusNode: focusNode.value,
            resultPath: propertyPath?.value,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.class,
            resultSeverity: SHACL.Violation,
            resultMessage: `Value "${value.value}" is not an instance of class ${classUri}`,
            constraintValue: classUri
          });
        }
      }
    }
    return violations;
  }

  _validatePattern(pattern, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const regex = new RegExp(pattern);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal' && !regex.test(value.value)) {
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.pattern,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" does not match pattern ${pattern}`,
          constraintValue: pattern
        });
      }
    }
    return violations;
  }

  _validateMinLength(minLength, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const min = parseInt(minLength);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal' && value.value.length < min) {
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.minLength,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" has length ${value.value.length} but requires at least ${min}`,
          constraintValue: minLength
        });
      }
    }
    return violations;
  }

  _validateMaxLength(maxLength, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const max = parseInt(maxLength);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal' && value.value.length > max) {
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.maxLength,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" has length ${value.value.length} but allows at most ${max}`,
          constraintValue: maxLength
        });
      }
    }
    return violations;
  }

  _validateMinInclusive(minInclusive, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const min = parseFloat(minInclusive);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal') {
        const numValue = parseFloat(value.value);
        if (!isNaN(numValue) && numValue < min) {
          violations.push({
            focusNode: focusNode.value,
            resultPath: propertyPath?.value,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.minInclusive,
            resultSeverity: SHACL.Violation,
            resultMessage: `Value ${value.value} is less than minimum allowed value ${minInclusive}`,
            constraintValue: minInclusive
          });
        }
      }
    }
    return violations;
  }

  _validateMaxInclusive(maxInclusive, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const max = parseFloat(maxInclusive);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal') {
        const numValue = parseFloat(value.value);
        if (!isNaN(numValue) && numValue > max) {
          violations.push({
            focusNode: focusNode.value,
            resultPath: propertyPath?.value,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.maxInclusive,
            resultSeverity: SHACL.Violation,
            resultMessage: `Value ${value.value} is greater than maximum allowed value ${maxInclusive}`,
            constraintValue: maxInclusive
          });
        }
      }
    }
    return violations;
  }

  _validateMinExclusive(minExclusive, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const min = parseFloat(minExclusive);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal') {
        const numValue = parseFloat(value.value);
        if (!isNaN(numValue) && numValue <= min) {
          violations.push({
            focusNode: focusNode.value,
            resultPath: propertyPath?.value,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.minExclusive,
            resultSeverity: SHACL.Violation,
            resultMessage: `Value ${value.value} must be greater than ${minExclusive}`,
            constraintValue: minExclusive
          });
        }
      }
    }
    return violations;
  }

  _validateMaxExclusive(maxExclusive, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    const max = parseFloat(maxExclusive);
    
    for (const value of propertyValues) {
      if (value.termType === 'Literal') {
        const numValue = parseFloat(value.value);
        if (!isNaN(numValue) && numValue >= max) {
          violations.push({
            focusNode: focusNode.value,
            resultPath: propertyPath?.value,
            value: value.value,
            sourceShape: shape.id,
            sourceConstraintComponent: SHACL.maxExclusive,
            resultSeverity: SHACL.Violation,
            resultMessage: `Value ${value.value} must be less than ${maxExclusive}`,
            constraintValue: maxExclusive
          });
        }
      }
    }
    return violations;
  }

  _validateHasValue(hasValue, focusNode, propertyPath, shape, propertyValues) {
    const hasRequiredValue = propertyValues.some(value => value.value === hasValue);
    if (!hasRequiredValue) {
      return [{
        focusNode: focusNode.value,
        resultPath: propertyPath?.value,
        sourceShape: shape.id,
        sourceConstraintComponent: SHACL.hasValue,
        resultSeverity: SHACL.Violation,
        resultMessage: `Property must have value "${hasValue}"`,
        constraintValue: hasValue
      }];
    }
    return [];
  }

  _validateIn(inValues, focusNode, propertyPath, shape, propertyValues) {
    const violations = [];
    // Simplified - in production would need proper RDF list parsing
    const allowedValues = inValues.split(',').map(v => v.trim());
    
    for (const value of propertyValues) {
      if (!allowedValues.includes(value.value)) {
        violations.push({
          focusNode: focusNode.value,
          resultPath: propertyPath?.value,
          value: value.value,
          sourceShape: shape.id,
          sourceConstraintComponent: SHACL.in,
          resultSeverity: SHACL.Violation,
          resultMessage: `Value "${value.value}" is not in allowed list: [${allowedValues.join(', ')}]`,
          constraintValue: inValues
        });
      }
    }
    return violations;
  }

  // Utility methods

  /**
   * Create empty validation report
   */
  _createEmptyValidationReport() {
    return {
      conforms: true,
      violations: [],
      timestamp: new Date().toISOString(),
      engine: 'kgen-shacl-validator',
      statistics: {
        shapesValidated: 0,
        violationsFound: 0,
        validationTime: 0
      }
    };
  }

  /**
   * Convert triple to quad
   */
  _tripleToQuad(triple) {
    const subject = triple.subject.startsWith('_:') ? 
      DataFactory.blankNode(triple.subject.slice(2)) : 
      namedNode(triple.subject);
      
    const predicate = namedNode(triple.predicate);
    
    let object;
    if (triple.object.startsWith('http') || triple.object.startsWith('_:')) {
      object = triple.object.startsWith('_:') ? 
        DataFactory.blankNode(triple.object.slice(2)) : 
        namedNode(triple.object);
    } else {
      object = literal(triple.object);
    }
    
    return quad(subject, predicate, object, defaultGraph());
  }

  // Legacy compatibility methods
  
  async validate(dataGraph, shapesGraph) {
    return this.validateGraph(dataGraph, shapesGraph);
  }

  /**
   * Validate file against SHACL shapes
   * @param {string} dataFilePath - Path to RDF data file
   * @param {string} shapesFilePath - Path to SHACL shapes file
   * @returns {Promise<ValidationReport>} Validation report
   */
  async validateFile(dataFilePath, shapesFilePath) {
    try {
      const [dataContent, shapesContent] = await Promise.all([
        fs.readFile(dataFilePath, 'utf-8'),
        fs.readFile(shapesFilePath, 'utf-8')
      ]);

      const [dataStore, shapesStore] = await Promise.all([
        this._parseRDFToStore(dataContent),
        this._parseRDFToStore(shapesContent)
      ]);

      return await this.validateGraph(dataStore, shapesStore);
    } catch (error) {
      return {
        conforms: false,
        violations: [{
          focusNode: 'file',
          resultPath: 'loading',
          value: error.message,
          resultMessage: `Failed to load files: ${error.message}`,
          resultSeverity: SHACL.Violation,
          sourceConstraintComponent: 'file-access',
          sourceShape: 'file-structure'
        }],
        timestamp: new Date().toISOString(),
        engine: 'kgen-shacl-validator'
      };
    }
  }

  /**
   * Parse RDF content to store
   */
  async _parseRDFToStore(content) {
    return new Promise((resolve, reject) => {
      const store = new Store();
      const parser = new Parser();
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          resolve(store);
        }
      });
    });
  }
}

/**
 * Create default SHACL engine instance
 */
export function createSHACLEngine(config) {
  return new SHACLEngine(config);
}

export default SHACLEngine;