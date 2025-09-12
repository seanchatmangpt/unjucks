/**
 * SHACL Shapes Parser and Management
 * Provides advanced parsing and management of SHACL shapes
 */

import { DataFactory } from 'n3';
import { consola } from 'consola';

const { namedNode } = DataFactory;

// SHACL vocabulary for shapes parsing
const SHACL = {
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  path: 'http://www.w3.org/ns/shacl#path',
  property: 'http://www.w3.org/ns/shacl#property',
  
  // Shape metadata
  name: 'http://www.w3.org/ns/shacl#name',
  description: 'http://www.w3.org/ns/shacl#description',
  order: 'http://www.w3.org/ns/shacl#order',
  group: 'http://www.w3.org/ns/shacl#group',
  
  // Advanced targeting
  targetObjectsOf: 'http://www.w3.org/ns/shacl#targetObjectsOf',
  targetSubjectsOf: 'http://www.w3.org/ns/shacl#targetSubjectsOf',
  
  // Logical operators
  and: 'http://www.w3.org/ns/shacl#and',
  or: 'http://www.w3.org/ns/shacl#or',
  not: 'http://www.w3.org/ns/shacl#not',
  xone: 'http://www.w3.org/ns/shacl#xone',
  
  // Property paths
  alternativePath: 'http://www.w3.org/ns/shacl#alternativePath',
  inversePath: 'http://www.w3.org/ns/shacl#inversePath',
  zeroOrMorePath: 'http://www.w3.org/ns/shacl#zeroOrMorePath',
  oneOrMorePath: 'http://www.w3.org/ns/shacl#oneOrMorePath',
  zeroOrOnePath: 'http://www.w3.org/ns/shacl#zeroOrOnePath',
  
  // Shape references
  node: 'http://www.w3.org/ns/shacl#node',
  qualifiedValueShape: 'http://www.w3.org/ns/shacl#qualifiedValueShape',
  qualifiedMinCount: 'http://www.w3.org/ns/shacl#qualifiedMinCount',
  qualifiedMaxCount: 'http://www.w3.org/ns/shacl#qualifiedMaxCount',
  
  // Closed shapes
  closed: 'http://www.w3.org/ns/shacl#closed',
  ignoredProperties: 'http://www.w3.org/ns/shacl#ignoredProperties',
  
  // Deactivation
  deactivated: 'http://www.w3.org/ns/shacl#deactivated'
};

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';

/**
 * Advanced SHACL Shapes Parser
 */
export class SHACLShapeParser {
  constructor(config = {}) {
    this.config = {
      enableAdvancedFeatures: config.enableAdvancedFeatures !== false,
      parseMetadata: config.parseMetadata !== false,
      validateShapes: config.validateShapes !== false,
      ...config
    };
    
    this.logger = consola.withTag('shacl-shapes');
    this.parsedShapes = new Map();
    this.shapeIndex = new Map();
  }

  /**
   * Parse all shapes from a shapes store
   * @param {Store} shapesStore - N3 Store containing SHACL shapes
   * @returns {Array} Array of parsed shape objects
   */
  async parseShapes(shapesStore) {
    this.logger.info('Parsing SHACL shapes...');
    
    const shapes = [];
    this.parsedShapes.clear();
    this.shapeIndex.clear();
    
    try {
      // First pass: identify all shape nodes
      const shapeNodes = this._identifyShapeNodes(shapesStore);
      this.logger.debug(`Found ${shapeNodes.length} shape nodes`);
      
      // Second pass: parse each shape
      for (const shapeNode of shapeNodes) {
        try {
          const shape = await this._parseShape(shapeNode, shapesStore);
          if (shape) {
            shapes.push(shape);
            this.parsedShapes.set(shape.id, shape);
            this._indexShape(shape);
          }
        } catch (error) {
          this.logger.error(`Failed to parse shape ${shapeNode.value}:`, error.message);
        }
      }
      
      // Third pass: resolve shape references
      if (this.config.enableAdvancedFeatures) {
        this._resolveShapeReferences(shapes);
      }
      
      this.logger.success(`Successfully parsed ${shapes.length} SHACL shapes`);
      return shapes;
      
    } catch (error) {
      this.logger.error('Failed to parse SHACL shapes:', error);
      throw error;
    }
  }

  /**
   * Identify all shape nodes in the store
   * @param {Store} shapesStore - N3 Store
   * @returns {Array} Array of shape node terms
   */
  _identifyShapeNodes(shapesStore) {
    const shapeNodes = new Set();
    
    // Find explicit NodeShapes
    const nodeShapeQuads = shapesStore.getQuads(null, namedNode(RDF_TYPE), namedNode(SHACL.NodeShape));
    nodeShapeQuads.forEach(quad => shapeNodes.add(quad.subject));
    
    // Find explicit PropertyShapes
    const propertyShapeQuads = shapesStore.getQuads(null, namedNode(RDF_TYPE), namedNode(SHACL.PropertyShape));
    propertyShapeQuads.forEach(quad => shapeNodes.add(quad.subject));
    
    // Find implicit shapes (nodes with shape-defining properties)
    const shapeProperties = [
      SHACL.targetClass, SHACL.targetNode, SHACL.property, SHACL.path,
      SHACL.minCount, SHACL.maxCount, SHACL.datatype, SHACL.nodeKind
    ];
    
    for (const property of shapeProperties) {
      const quads = shapesStore.getQuads(null, namedNode(property), null);
      quads.forEach(quad => shapeNodes.add(quad.subject));
    }
    
    return Array.from(shapeNodes);
  }

  /**
   * Parse a single shape node
   * @param {NamedNode} shapeNode - Shape node to parse
   * @param {Store} shapesStore - N3 Store
   * @returns {Object} Parsed shape object
   */
  async _parseShape(shapeNode, shapesStore) {
    // Determine shape type
    const shapeType = this._determineShapeType(shapeNode, shapesStore);
    
    if (shapeType === 'NodeShape') {
      return this._parseNodeShape(shapeNode, shapesStore);
    } else if (shapeType === 'PropertyShape') {
      return this._parsePropertyShape(shapeNode, shapesStore);
    } else {
      this.logger.warn(`Unknown shape type for ${shapeNode.value}`);
      return null;
    }
  }

  /**
   * Determine the type of a shape
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @returns {string} Shape type
   */
  _determineShapeType(shapeNode, shapesStore) {
    // Check explicit type declarations
    const typeQuads = shapesStore.getQuads(shapeNode, namedNode(RDF_TYPE), null);
    
    for (const quad of typeQuads) {
      if (quad.object.value === SHACL.NodeShape) return 'NodeShape';
      if (quad.object.value === SHACL.PropertyShape) return 'PropertyShape';
    }
    
    // Infer type from properties
    const pathQuads = shapesStore.getQuads(shapeNode, namedNode(SHACL.path), null);
    if (pathQuads.length > 0) return 'PropertyShape';
    
    const targetQuads = shapesStore.getQuads(shapeNode, namedNode(SHACL.targetClass), null);
    if (targetQuads.length > 0) return 'NodeShape';
    
    return 'NodeShape'; // Default fallback
  }

  /**
   * Parse a node shape
   * @param {NamedNode} shapeNode - Node shape node
   * @param {Store} shapesStore - N3 Store
   * @returns {Object} Parsed node shape
   */
  _parseNodeShape(shapeNode, shapesStore) {
    const shape = {
      id: shapeNode.value,
      type: 'NodeShape',
      
      // Core targeting properties
      targetClasses: this._getStringValues(shapesStore, shapeNode, SHACL.targetClass),
      targetNodes: this._getStringValues(shapesStore, shapeNode, SHACL.targetNode),
      
      // Advanced targeting
      targetObjectsOf: this._getStringValues(shapesStore, shapeNode, SHACL.targetObjectsOf),
      targetSubjectsOf: this._getStringValues(shapesStore, shapeNode, SHACL.targetSubjectsOf),
      
      // Property shapes
      properties: [],
      
      // Constraints
      constraints: {},
      
      // Logical operators
      logical: {},
      
      // Shape metadata
      metadata: {},
      
      // Advanced features
      closed: false,
      ignoredProperties: [],
      deactivated: false
    };
    
    // Parse metadata
    if (this.config.parseMetadata) {
      this._parseShapeMetadata(shapeNode, shapesStore, shape);
    }
    
    // Parse property shapes
    const propertyQuads = shapesStore.getQuads(shapeNode, namedNode(SHACL.property), null);
    for (const propertyQuad of propertyQuads) {
      try {
        const propertyShape = this._parsePropertyShape(propertyQuad.object, shapesStore);
        if (propertyShape) {
          shape.properties.push(propertyShape);
        }
      } catch (error) {
        this.logger.error(`Failed to parse property shape ${propertyQuad.object.value}:`, error.message);
      }
    }
    
    // Parse direct constraints
    this._parseConstraints(shapeNode, shapesStore, shape.constraints);
    
    // Parse logical operators
    if (this.config.enableAdvancedFeatures) {
      this._parseLogicalOperators(shapeNode, shapesStore, shape.logical);
    }
    
    // Parse advanced features
    this._parseAdvancedFeatures(shapeNode, shapesStore, shape);
    
    return shape;
  }

  /**
   * Parse a property shape
   * @param {NamedNode} shapeNode - Property shape node
   * @param {Store} shapesStore - N3 Store
   * @returns {Object} Parsed property shape
   */
  _parsePropertyShape(shapeNode, shapesStore) {
    const shape = {
      id: shapeNode.value,
      type: 'PropertyShape',
      
      // Core properties
      path: null,
      pathType: 'simple', // simple, sequence, alternative, inverse, etc.
      
      // Constraints
      constraints: {},
      
      // Logical operators
      logical: {},
      
      // Shape metadata
      metadata: {},
      
      // Shape references
      nodeShapes: [],
      qualifiedValueShapes: [],
      
      // Advanced features
      deactivated: false
    };
    
    // Parse path
    this._parsePropertyPath(shapeNode, shapesStore, shape);
    
    // Parse metadata
    if (this.config.parseMetadata) {
      this._parseShapeMetadata(shapeNode, shapesStore, shape);
    }
    
    // Parse constraints
    this._parseConstraints(shapeNode, shapesStore, shape.constraints);
    
    // Parse logical operators
    if (this.config.enableAdvancedFeatures) {
      this._parseLogicalOperators(shapeNode, shapesStore, shape.logical);
    }
    
    // Parse shape references
    if (this.config.enableAdvancedFeatures) {
      this._parseShapeReferences(shapeNode, shapesStore, shape);
    }
    
    // Parse advanced features
    this._parseAdvancedFeatures(shapeNode, shapesStore, shape);
    
    return shape;
  }

  /**
   * Parse property path from shape node
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} shape - Shape object to populate
   */
  _parsePropertyPath(shapeNode, shapesStore, shape) {
    const pathQuads = shapesStore.getQuads(shapeNode, namedNode(SHACL.path), null);
    
    if (pathQuads.length === 0) return;
    
    const pathNode = pathQuads[0].object;
    
    if (pathNode.termType === 'NamedNode') {
      // Simple property path
      shape.path = pathNode.value;
      shape.pathType = 'simple';
    } else if (pathNode.termType === 'BlankNode') {
      // Complex property path - simplified parsing
      shape.path = pathNode.value;
      shape.pathType = 'complex';
      
      // TODO: Parse sequence paths, alternative paths, etc.
      // For now, just store the blank node reference
    }
  }

  /**
   * Parse shape metadata
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} shape - Shape object to populate
   */
  _parseShapeMetadata(shapeNode, shapesStore, shape) {
    // Parse basic metadata
    shape.metadata.name = this._getStringValue(shapesStore, shapeNode, SHACL.name);
    shape.metadata.description = this._getStringValue(shapesStore, shapeNode, SHACL.description);
    shape.metadata.label = this._getStringValue(shapesStore, shapeNode, RDFS_LABEL);
    shape.metadata.comment = this._getStringValue(shapesStore, shapeNode, RDFS_COMMENT);
    
    // Parse ordering and grouping
    const orderValue = this._getStringValue(shapesStore, shapeNode, SHACL.order);
    if (orderValue) {
      shape.metadata.order = parseInt(orderValue) || 0;
    }
    
    shape.metadata.group = this._getStringValue(shapesStore, shapeNode, SHACL.group);
  }

  /**
   * Parse constraints from shape node
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} constraints - Constraints object to populate
   */
  _parseConstraints(shapeNode, shapesStore, constraints) {
    const constraintProperties = [
      'minCount', 'maxCount', 'datatype', 'nodeKind', 'class', 'pattern',
      'minLength', 'maxLength', 'minInclusive', 'maxInclusive',
      'minExclusive', 'maxExclusive', 'hasValue', 'in',
      'languageIn', 'uniqueLang', 'equals', 'disjoint',
      'lessThan', 'lessThanOrEquals'
    ];
    
    for (const property of constraintProperties) {
      const propertyUri = SHACL[property];
      if (propertyUri) {
        const value = this._getStringValue(shapesStore, shapeNode, propertyUri);
        if (value !== null) {
          constraints[propertyUri] = value;
        }
      }
    }
  }

  /**
   * Parse logical operators
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} logical - Logical operators object to populate
   */
  _parseLogicalOperators(shapeNode, shapesStore, logical) {
    const logicalOperators = ['and', 'or', 'not', 'xone'];
    
    for (const operator of logicalOperators) {
      const operatorUri = SHACL[operator];
      if (operatorUri) {
        const values = this._getStringValues(shapesStore, shapeNode, operatorUri);
        if (values.length > 0) {
          logical[operator] = values;
        }
      }
    }
  }

  /**
   * Parse shape references
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} shape - Shape object to populate
   */
  _parseShapeReferences(shapeNode, shapesStore, shape) {
    // Parse node shape references
    shape.nodeShapes = this._getStringValues(shapesStore, shapeNode, SHACL.node);
    
    // Parse qualified value shapes
    const qualifiedShapes = this._getStringValues(shapesStore, shapeNode, SHACL.qualifiedValueShape);
    if (qualifiedShapes.length > 0) {
      shape.qualifiedValueShapes = qualifiedShapes.map(shapeUri => {
        return {
          shape: shapeUri,
          minCount: parseInt(this._getStringValue(shapesStore, shapeNode, SHACL.qualifiedMinCount)) || 0,
          maxCount: parseInt(this._getStringValue(shapesStore, shapeNode, SHACL.qualifiedMaxCount)) || Infinity
        };
      });
    }
  }

  /**
   * Parse advanced features
   * @param {NamedNode} shapeNode - Shape node
   * @param {Store} shapesStore - N3 Store
   * @param {Object} shape - Shape object to populate
   */
  _parseAdvancedFeatures(shapeNode, shapesStore, shape) {
    // Parse closed shape
    const closedValue = this._getStringValue(shapesStore, shapeNode, SHACL.closed);
    shape.closed = closedValue === 'true';
    
    // Parse ignored properties
    shape.ignoredProperties = this._getStringValues(shapesStore, shapeNode, SHACL.ignoredProperties);
    
    // Parse deactivated flag
    const deactivatedValue = this._getStringValue(shapesStore, shapeNode, SHACL.deactivated);
    shape.deactivated = deactivatedValue === 'true';
  }

  /**
   * Get string values for a property
   * @param {Store} store - N3 Store
   * @param {NamedNode} subject - Subject node
   * @param {string} predicateUri - Predicate URI
   * @returns {Array} Array of string values
   */
  _getStringValues(store, subject, predicateUri) {
    const quads = store.getQuads(subject, namedNode(predicateUri), null);
    return quads.map(quad => quad.object.value);
  }

  /**
   * Get single string value for a property
   * @param {Store} store - N3 Store
   * @param {NamedNode} subject - Subject node
   * @param {string} predicateUri - Predicate URI
   * @returns {string|null} String value or null
   */
  _getStringValue(store, subject, predicateUri) {
    const values = this._getStringValues(store, subject, predicateUri);
    return values.length > 0 ? values[0] : null;
  }

  /**
   * Index shape for efficient lookup
   * @param {Object} shape - Parsed shape
   */
  _indexShape(shape) {
    // Index by target classes
    if (shape.targetClasses) {
      for (const targetClass of shape.targetClasses) {
        if (!this.shapeIndex.has(targetClass)) {
          this.shapeIndex.set(targetClass, []);
        }
        this.shapeIndex.get(targetClass).push(shape.id);
      }
    }
    
    // Index by property paths
    if (shape.path) {
      const pathKey = `path:${shape.path}`;
      if (!this.shapeIndex.has(pathKey)) {
        this.shapeIndex.set(pathKey, []);
      }
      this.shapeIndex.get(pathKey).push(shape.id);
    }
  }

  /**
   * Resolve shape references between shapes
   * @param {Array} shapes - Array of parsed shapes
   */
  _resolveShapeReferences(shapes) {
    this.logger.debug('Resolving shape references...');
    
    for (const shape of shapes) {
      // Resolve node shape references
      if (shape.nodeShapes && shape.nodeShapes.length > 0) {
        shape.nodeShapes = shape.nodeShapes.map(shapeUri => {
          const referencedShape = this.parsedShapes.get(shapeUri);
          return referencedShape || shapeUri;
        });
      }
      
      // Resolve logical operator references
      if (shape.logical) {
        for (const [operator, references] of Object.entries(shape.logical)) {
          if (Array.isArray(references)) {
            shape.logical[operator] = references.map(ref => {
              const referencedShape = this.parsedShapes.get(ref);
              return referencedShape || ref;
            });
          }
        }
      }
    }
  }

  /**
   * Get shapes by target class
   * @param {string} targetClass - Target class URI
   * @returns {Array} Array of shape IDs
   */
  getShapesByTargetClass(targetClass) {
    return this.shapeIndex.get(targetClass) || [];
  }

  /**
   * Get shapes by property path
   * @param {string} propertyPath - Property path URI
   * @returns {Array} Array of shape IDs
   */
  getShapesByPath(propertyPath) {
    return this.shapeIndex.get(`path:${propertyPath}`) || [];
  }

  /**
   * Get parsed shape by ID
   * @param {string} shapeId - Shape ID
   * @returns {Object|null} Parsed shape or null
   */
  getShapeById(shapeId) {
    return this.parsedShapes.get(shapeId) || null;
  }

  /**
   * Validate shape consistency
   * @param {Array} shapes - Array of parsed shapes
   * @returns {Array} Array of validation issues
   */
  validateShapes(shapes) {
    if (!this.config.validateShapes) return [];
    
    const issues = [];
    
    for (const shape of shapes) {
      // Check for required properties
      if (shape.type === 'PropertyShape' && !shape.path) {
        issues.push({
          shapeId: shape.id,
          type: 'error',
          message: 'PropertyShape must have a path'
        });
      }
      
      if (shape.type === 'NodeShape' && 
          (!shape.targetClasses || shape.targetClasses.length === 0) &&
          (!shape.targetNodes || shape.targetNodes.length === 0)) {
        issues.push({
          shapeId: shape.id,
          type: 'warning',
          message: 'NodeShape has no target classes or nodes'
        });
      }
      
      // Check for constraint conflicts
      if (shape.constraints) {
        const minCount = shape.constraints[SHACL.minCount];
        const maxCount = shape.constraints[SHACL.maxCount];
        
        if (minCount && maxCount && parseInt(minCount) > parseInt(maxCount)) {
          issues.push({
            shapeId: shape.id,
            type: 'error',
            message: `minCount (${minCount}) cannot be greater than maxCount (${maxCount})`
          });
        }
      }
    }
    
    return issues;
  }

  /**
   * Generate shape statistics
   * @param {Array} shapes - Array of parsed shapes
   * @returns {Object} Shape statistics
   */
  generateStatistics(shapes) {
    const stats = {
      totalShapes: shapes.length,
      nodeShapes: 0,
      propertyShapes: 0,
      constraintTypes: new Set(),
      targetClasses: new Set(),
      hasMetadata: 0,
      hasLogicalOperators: 0,
      isDeactivated: 0,
      isClosed: 0
    };
    
    for (const shape of shapes) {
      if (shape.type === 'NodeShape') stats.nodeShapes++;
      if (shape.type === 'PropertyShape') stats.propertyShapes++;
      
      if (shape.targetClasses) {
        shape.targetClasses.forEach(tc => stats.targetClasses.add(tc));
      }
      
      if (shape.constraints) {
        Object.keys(shape.constraints).forEach(constraint => 
          stats.constraintTypes.add(constraint));
      }
      
      if (shape.metadata && Object.keys(shape.metadata).length > 0) {
        stats.hasMetadata++;
      }
      
      if (shape.logical && Object.keys(shape.logical).length > 0) {
        stats.hasLogicalOperators++;
      }
      
      if (shape.deactivated) stats.isDeactivated++;
      if (shape.closed) stats.isClosed++;
    }
    
    stats.constraintTypes = Array.from(stats.constraintTypes);
    stats.targetClasses = Array.from(stats.targetClasses);
    
    return stats;
  }
}

/**
 * Create default SHACL shape parser
 */
export function createSHACLShapeParser(config) {
  return new SHACLShapeParser(config);
}

export default SHACLShapeParser;