/**
 * SHACL Shapes Parser Test Suite
 * Tests for SHACL shape parsing and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store, DataFactory } from 'n3';
import { SHACLShapeParser } from '../../../src/shacl/shapes.js';

const { namedNode, literal, quad, defaultGraph } = DataFactory;

describe('SHACL Shapes Parser', () => {
  let parser;
  let shapesStore;

  beforeEach(() => {
    parser = new SHACLShapeParser({
      enableAdvancedFeatures: true,
      parseMetadata: true,
      validateShapes: true
    });
    
    shapesStore = new Store();
  });

  afterEach(() => {
    parser = null;
    shapesStore = null;
  });

  describe('Basic Shape Parsing', () => {
    it('should parse empty shapes store', async () => {
      const shapes = await parser.parseShapes(shapesStore);
      
      expect(shapes).toHaveLength(0);
    });

    it('should identify node shapes', async () => {
      // Add a node shape
      const shapeNode = namedNode('http://example.org/PersonShape');
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe('NodeShape');
      expect(shapes[0].id).toBe('http://example.org/PersonShape');
      expect(shapes[0].targetClasses).toContain('http://example.org/Person');
    });

    it('should identify property shapes', async () => {
      // Add a property shape
      const propertyShape = namedNode('http://example.org/NamePropertyShape');
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe('PropertyShape');
      expect(shapes[0].id).toBe('http://example.org/NamePropertyShape');
      expect(shapes[0].path).toBe('http://example.org/name');
      expect(shapes[0].pathType).toBe('simple');
    });

    it('should identify implicit shapes', async () => {
      // Add shape with targeting properties but no explicit type
      const implicitShape = namedNode('http://example.org/ImplicitShape');
      
      shapesStore.addQuad(quad(
        implicitShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/SomeClass')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      
      expect(shapes).toHaveLength(1);
      expect(shapes[0].type).toBe('NodeShape');
    });
  });

  describe('Node Shape Parsing', () => {
    let nodeShape;

    beforeEach(() => {
      nodeShape = namedNode('http://example.org/PersonShape');
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
    });

    it('should parse target classes', async () => {
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Employee')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.targetClasses).toHaveLength(2);
      expect(shape.targetClasses).toContain('http://example.org/Person');
      expect(shape.targetClasses).toContain('http://example.org/Employee');
    });

    it('should parse target nodes', async () => {
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetNode'),
        namedNode('http://example.org/john')
      ));
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetNode'),
        namedNode('http://example.org/jane')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.targetNodes).toHaveLength(2);
      expect(shape.targetNodes).toContain('http://example.org/john');
      expect(shape.targetNodes).toContain('http://example.org/jane');
    });

    it('should parse advanced targeting', async () => {
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetObjectsOf'),
        namedNode('http://example.org/knows')
      ));
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetSubjectsOf'),
        namedNode('http://example.org/createdBy')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.targetObjectsOf).toContain('http://example.org/knows');
      expect(shape.targetSubjectsOf).toContain('http://example.org/createdBy');
    });

    it('should parse property shapes', async () => {
      // Add property shape
      const propertyShape = namedNode('http://example.org/NameProperty');
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));
      
      // Link to node shape
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#property'),
        propertyShape
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes.find(s => s.type === 'NodeShape');
      
      expect(shape.properties).toHaveLength(1);
      expect(shape.properties[0].path).toBe('http://example.org/name');
    });
  });

  describe('Metadata Parsing', () => {
    let shape;

    beforeEach(() => {
      shape = namedNode('http://example.org/TestShape');
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
    });

    it('should parse shape names and descriptions', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#name'),
        literal('Person Shape')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#description'),
        literal('Validates person data')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.metadata.name).toBe('Person Shape');
      expect(parsedShape.metadata.description).toBe('Validates person data');
    });

    it('should parse RDFS labels and comments', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal('Person')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/2000/01/rdf-schema#comment'),
        literal('A person entity')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.metadata.label).toBe('Person');
      expect(parsedShape.metadata.comment).toBe('A person entity');
    });

    it('should parse order and grouping', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#order'),
        literal('1')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#group'),
        namedNode('http://example.org/PersonGroup')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.metadata.order).toBe(1);
      expect(parsedShape.metadata.group).toBe('http://example.org/PersonGroup');
    });
  });

  describe('Constraint Parsing', () => {
    let propertyShape;

    beforeEach(() => {
      propertyShape = namedNode('http://example.org/PropertyShape');
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));
    });

    it('should parse cardinality constraints', async () => {
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#minCount'),
        literal('1')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#maxCount'),
        literal('1')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.constraints['http://www.w3.org/ns/shacl#minCount']).toBe('1');
      expect(shape.constraints['http://www.w3.org/ns/shacl#maxCount']).toBe('1');
    });

    it('should parse datatype constraints', async () => {
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#datatype'),
        namedNode('http://www.w3.org/2001/XMLSchema#string')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.constraints['http://www.w3.org/ns/shacl#datatype']).toBe('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should parse string constraints', async () => {
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#pattern'),
        literal('^[A-Za-z]+$')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#minLength'),
        literal('3')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#maxLength'),
        literal('50')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const shape = shapes[0];
      
      expect(shape.constraints['http://www.w3.org/ns/shacl#pattern']).toBe('^[A-Za-z]+$');
      expect(shape.constraints['http://www.w3.org/ns/shacl#minLength']).toBe('3');
      expect(shape.constraints['http://www.w3.org/ns/shacl#maxLength']).toBe('50');
    });
  });

  describe('Advanced Features', () => {
    let shape;

    beforeEach(() => {
      shape = namedNode('http://example.org/AdvancedShape');
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
    });

    it('should parse closed shapes', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#closed'),
        literal('true')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#ignoredProperties'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.closed).toBe(true);
      expect(parsedShape.ignoredProperties).toContain('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    });

    it('should parse deactivated shapes', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#deactivated'),
        literal('true')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.deactivated).toBe(true);
    });

    it('should parse logical operators', async () => {
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#and'),
        namedNode('http://example.org/Shape1')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#or'),
        namedNode('http://example.org/Shape2')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.logical.and).toContain('http://example.org/Shape1');
      expect(parsedShape.logical.or).toContain('http://example.org/Shape2');
    });
  });

  describe('Shape Indexing', () => {
    it('should index shapes by target class', async () => {
      const shape1 = namedNode('http://example.org/PersonShape');
      const shape2 = namedNode('http://example.org/EmployeeShape');
      
      // Shape 1
      shapesStore.addQuad(quad(
        shape1,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shape1,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));
      
      // Shape 2
      shapesStore.addQuad(quad(
        shape2,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shape2,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));

      await parser.parseShapes(shapesStore);
      
      const personShapes = parser.getShapesByTargetClass('http://example.org/Person');
      expect(personShapes).toHaveLength(2);
      expect(personShapes).toContain('http://example.org/PersonShape');
      expect(personShapes).toContain('http://example.org/EmployeeShape');
    });

    it('should index property shapes by path', async () => {
      const propertyShape = namedNode('http://example.org/NameProperty');
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));

      await parser.parseShapes(shapesStore);
      
      const nameShapes = parser.getShapesByPath('http://example.org/name');
      expect(nameShapes).toHaveLength(1);
      expect(nameShapes).toContain('http://example.org/NameProperty');
    });

    it('should retrieve shapes by ID', async () => {
      const shapeNode = namedNode('http://example.org/TestShape');
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));

      await parser.parseShapes(shapesStore);
      
      const shape = parser.getShapeById('http://example.org/TestShape');
      expect(shape).toBeDefined();
      expect(shape.id).toBe('http://example.org/TestShape');
      expect(shape.type).toBe('NodeShape');
    });
  });

  describe('Shape Validation', () => {
    it('should validate shape consistency', async () => {
      // Create a valid shape
      const validShape = namedNode('http://example.org/ValidShape');
      
      shapesStore.addQuad(quad(
        validShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        validShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));

      // Create an invalid property shape (missing path)
      const invalidShape = namedNode('http://example.org/InvalidShape');
      
      shapesStore.addQuad(quad(
        invalidShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      // Missing sh:path

      const shapes = await parser.parseShapes(shapesStore);
      const issues = parser.validateShapes(shapes);
      
      expect(issues.length).toBeGreaterThan(0);
      const errorIssue = issues.find(issue => issue.type === 'error');
      expect(errorIssue).toBeDefined();
      expect(errorIssue.message).toContain('PropertyShape must have a path');
    });

    it('should detect constraint conflicts', async () => {
      const shape = namedNode('http://example.org/ConflictShape');
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/count')
      ));
      
      // Conflicting constraints
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#minCount'),
        literal('5')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#maxCount'),
        literal('3')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const issues = parser.validateShapes(shapes);
      
      const conflictIssue = issues.find(issue => 
        issue.message.includes('minCount') && issue.message.includes('maxCount')
      );
      
      expect(conflictIssue).toBeDefined();
      expect(conflictIssue.type).toBe('error');
    });
  });

  describe('Statistics Generation', () => {
    it('should generate comprehensive statistics', async () => {
      // Add various types of shapes
      const nodeShape = namedNode('http://example.org/NodeShape');
      const propertyShape = namedNode('http://example.org/PropertyShape');
      
      // Node shape
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));
      
      shapesStore.addQuad(quad(
        nodeShape,
        namedNode('http://www.w3.org/ns/shacl#name'),
        literal('Person Shape')
      ));

      // Property shape with constraints
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#minCount'),
        literal('1')
      ));
      
      shapesStore.addQuad(quad(
        propertyShape,
        namedNode('http://www.w3.org/ns/shacl#datatype'),
        namedNode('http://www.w3.org/2001/XMLSchema#string')
      ));

      const shapes = await parser.parseShapes(shapesStore);
      const stats = parser.generateStatistics(shapes);
      
      expect(stats.totalShapes).toBe(2);
      expect(stats.nodeShapes).toBe(1);
      expect(stats.propertyShapes).toBe(1);
      expect(stats.targetClasses).toContain('http://example.org/Person');
      expect(stats.constraintTypes).toContain('http://www.w3.org/ns/shacl#minCount');
      expect(stats.constraintTypes).toContain('http://www.w3.org/ns/shacl#datatype');
      expect(stats.hasMetadata).toBe(1);
    });
  });

  describe('Configuration Options', () => {
    it('should respect parseMetadata option', async () => {
      const noMetadataParser = new SHACLShapeParser({ parseMetadata: false });
      
      const shape = namedNode('http://example.org/TestShape');
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#name'),
        literal('Test Shape')
      ));

      const shapes = await noMetadataParser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(parsedShape.metadata.name).toBeUndefined();
    });

    it('should respect enableAdvancedFeatures option', async () => {
      const basicParser = new SHACLShapeParser({ enableAdvancedFeatures: false });
      
      const shape = namedNode('http://example.org/TestShape');
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shape,
        namedNode('http://www.w3.org/ns/shacl#and'),
        namedNode('http://example.org/AnotherShape')
      ));

      const shapes = await basicParser.parseShapes(shapesStore);
      const parsedShape = shapes[0];
      
      expect(Object.keys(parsedShape.logical)).toHaveLength(0);
    });
  });
});