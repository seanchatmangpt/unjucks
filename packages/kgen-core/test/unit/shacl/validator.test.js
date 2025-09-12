/**
 * SHACL Validator Test Suite
 * Comprehensive tests for pure JavaScript SHACL validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { SHACLEngine } from '../../../src/shacl/validator.js';

const { namedNode, literal, quad, defaultGraph } = DataFactory;

describe('SHACL Validator', () => {
  let validator;
  let dataStore;
  let shapesStore;

  beforeEach(async () => {
    validator = new SHACLEngine({
      strictMode: false,
      enableCaching: true
    });
    
    dataStore = new Store();
    shapesStore = new Store();
    
    await validator.initialize();
  });

  afterEach(() => {
    validator = null;
    dataStore = null;
    shapesStore = null;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newValidator = new SHACLEngine();
      await newValidator.initialize();
      expect(newValidator.initialized).toBe(true);
    });

    it('should handle multiple initializations', async () => {
      await validator.initialize();
      await validator.initialize(); // Should not throw
      expect(validator.initialized).toBe(true);
    });
  });

  describe('Basic Validation', () => {
    it('should validate empty data against empty shapes', async () => {
      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.engine).toBe('kgen-shacl-validator');
    });

    it('should handle missing shapes gracefully', async () => {
      // Add some data but no shapes
      dataStore.addQuad(quad(
        namedNode('http://example.org/person1'),
        namedNode('http://example.org/name'),
        literal('John Doe')
      ));

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.statistics.shapesValidated).toBe(0);
    });
  });

  describe('Node Shape Validation', () => {
    beforeEach(() => {
      // Create a simple node shape
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
    });

    it('should validate nodes with target class', async () => {
      // Add a person instance
      const person = namedNode('http://example.org/person1');
      dataStore.addQuad(quad(
        person,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://example.org/Person')
      ));

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.statistics.shapesValidated).toBe(1);
    });

    it('should validate with target nodes', async () => {
      // Add target node constraint
      const shapeNode = namedNode('http://example.org/PersonShape');
      const targetPerson = namedNode('http://example.org/john');
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/ns/shacl#targetNode'),
        targetPerson
      ));

      // Add the target node to data
      dataStore.addQuad(quad(
        targetPerson,
        namedNode('http://example.org/name'),
        literal('John Doe')
      ));

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('Property Shape Validation', () => {
    let personShape;
    let namePropertyShape;

    beforeEach(() => {
      // Create node shape for Person
      personShape = namedNode('http://example.org/PersonShape');
      
      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));

      // Create property shape for name
      namePropertyShape = namedNode('http://example.org/PersonNameShape');
      
      shapesStore.addQuad(quad(
        namePropertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        namePropertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));

      // Link property shape to node shape
      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/ns/shacl#property'),
        namePropertyShape
      ));
    });

    it('should validate property shapes', async () => {
      // Add person with name
      const person = namedNode('http://example.org/person1');
      
      dataStore.addQuad(quad(
        person,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://example.org/Person')
      ));
      
      dataStore.addQuad(quad(
        person,
        namedNode('http://example.org/name'),
        literal('John Doe')
      ));

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('Constraint Validation', () => {
    let personShape;
    let namePropertyShape;
    let person;

    beforeEach(() => {
      // Setup basic shapes and person
      personShape = namedNode('http://example.org/PersonShape');
      namePropertyShape = namedNode('http://example.org/PersonNameShape');
      person = namedNode('http://example.org/person1');

      // Node shape
      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/Person')
      ));

      // Property shape
      shapesStore.addQuad(quad(
        namePropertyShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      
      shapesStore.addQuad(quad(
        namePropertyShape,
        namedNode('http://www.w3.org/ns/shacl#path'),
        namedNode('http://example.org/name')
      ));

      shapesStore.addQuad(quad(
        personShape,
        namedNode('http://www.w3.org/ns/shacl#property'),
        namePropertyShape
      ));

      // Person instance
      dataStore.addQuad(quad(
        person,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://example.org/Person')
      ));
    });

    describe('minCount constraint', () => {
      it('should pass when minCount is satisfied', async () => {
        // Add minCount constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minCount'),
          literal('1')
        ));

        // Add name to person
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail when minCount is not satisfied', async () => {
        // Add minCount constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minCount'),
          literal('1')
        ));

        // Don't add name to person
        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#minCount');
        expect(violation.focusNode).toBe('http://example.org/person1');
        expect(violation.resultMessage).toContain('requires at least 1');
      });
    });

    describe('maxCount constraint', () => {
      it('should pass when maxCount is satisfied', async () => {
        // Add maxCount constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#maxCount'),
          literal('1')
        ));

        // Add one name to person
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail when maxCount is exceeded', async () => {
        // Add maxCount constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#maxCount'),
          literal('1')
        ));

        // Add two names to person
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe')
        ));
        
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('Johnny')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#maxCount');
        expect(violation.resultMessage).toContain('allows at most 1');
      });
    });

    describe('datatype constraint', () => {
      it('should pass when datatype matches', async () => {
        // Add datatype constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#datatype'),
          namedNode('http://www.w3.org/2001/XMLSchema#string')
        ));

        // Add string name
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe', namedNode('http://www.w3.org/2001/XMLSchema#string'))
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail when datatype does not match', async () => {
        // Add datatype constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#datatype'),
          namedNode('http://www.w3.org/2001/XMLSchema#int')
        ));

        // Add string value instead of int
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe', namedNode('http://www.w3.org/2001/XMLSchema#string'))
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#datatype');
        expect(violation.resultMessage).toContain('does not have datatype');
      });
    });

    describe('nodeKind constraint', () => {
      it('should validate IRI nodeKind', async () => {
        // Add nodeKind constraint for IRI
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#nodeKind'),
          namedNode('http://www.w3.org/ns/shacl#IRI')
        ));

        // Add IRI value
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          namedNode('http://example.org/john-doe')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail when nodeKind does not match', async () => {
        // Add nodeKind constraint for IRI
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#nodeKind'),
          namedNode('http://www.w3.org/ns/shacl#IRI')
        ));

        // Add literal value instead of IRI
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John Doe')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#nodeKind');
        expect(violation.resultMessage).toContain('not of node kind');
      });
    });

    describe('pattern constraint', () => {
      it('should pass when pattern matches', async () => {
        // Add pattern constraint for email
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#pattern'),
          literal('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
        ));

        // Add valid email
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('john.doe@example.com')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail when pattern does not match', async () => {
        // Add pattern constraint for email
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#pattern'),
          literal('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
        ));

        // Add invalid email
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('not-an-email')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#pattern');
        expect(violation.resultMessage).toContain('does not match pattern');
      });
    });

    describe('minLength/maxLength constraints', () => {
      it('should validate minLength', async () => {
        // Add minLength constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minLength'),
          literal('3')
        ));

        // Add name with sufficient length
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('John')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail minLength validation', async () => {
        // Add minLength constraint
        shapesStore.addQuad(quad(
          namePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minLength'),
          literal('5')
        ));

        // Add name with insufficient length
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/name'),
          literal('Jo')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#minLength');
        expect(violation.resultMessage).toContain('requires at least 5');
      });
    });

    describe('numeric constraints', () => {
      let agePropertyShape;

      beforeEach(() => {
        agePropertyShape = namedNode('http://example.org/PersonAgeShape');
        
        shapesStore.addQuad(quad(
          agePropertyShape,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/ns/shacl#PropertyShape')
        ));
        
        shapesStore.addQuad(quad(
          agePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#path'),
          namedNode('http://example.org/age')
        ));

        shapesStore.addQuad(quad(
          personShape,
          namedNode('http://www.w3.org/ns/shacl#property'),
          agePropertyShape
        ));
      });

      it('should validate minInclusive constraint', async () => {
        // Add minInclusive constraint
        shapesStore.addQuad(quad(
          agePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minInclusive'),
          literal('18')
        ));

        // Add valid age
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/age'),
          literal('25')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(true);
        expect(report.violations).toHaveLength(0);
      });

      it('should fail minInclusive validation', async () => {
        // Add minInclusive constraint
        shapesStore.addQuad(quad(
          agePropertyShape,
          namedNode('http://www.w3.org/ns/shacl#minInclusive'),
          literal('18')
        ));

        // Add invalid age
        dataStore.addQuad(quad(
          person,
          namedNode('http://example.org/age'),
          literal('16')
        ));

        const report = await validator.validateGraph(dataStore, shapesStore);
        
        expect(report.conforms).toBe(false);
        expect(report.violations).toHaveLength(1);
        
        const violation = report.violations[0];
        expect(violation.sourceConstraintComponent).toBe('http://www.w3.org/ns/shacl#minInclusive');
        expect(violation.resultMessage).toContain('less than minimum allowed');
      });
    });
  });

  describe('File Validation', () => {
    it('should handle file validation errors gracefully', async () => {
      const report = await validator.validateFile(
        '/nonexistent/data.ttl',
        '/nonexistent/shapes.ttl'
      );
      
      expect(report.conforms).toBe(false);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].resultMessage).toContain('Failed to load files');
    });
  });

  describe('Performance and Statistics', () => {
    it('should provide validation statistics', async () => {
      // Add a simple shape and data
      const shapeNode = namedNode('http://example.org/TestShape');
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#NodeShape')
      ));
      
      shapesStore.addQuad(quad(
        shapeNode,
        namedNode('http://www.w3.org/ns/shacl#targetClass'),
        namedNode('http://example.org/TestClass')
      ));

      const instance = namedNode('http://example.org/test1');
      dataStore.addQuad(quad(
        instance,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://example.org/TestClass')
      ));

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      expect(report.statistics).toBeDefined();
      expect(report.statistics.shapesValidated).toBe(1);
      expect(report.statistics.violationsFound).toBe(0);
      expect(typeof report.statistics.validationTime).toBe('number');
      expect(report.statistics.validationTime).toBeGreaterThan(0);
    });

    it('should handle large datasets efficiently', async () => {
      // Create multiple shapes and instances
      for (let i = 0; i < 10; i++) {
        const shapeNode = namedNode(`http://example.org/Shape${i}`);
        const targetClass = namedNode(`http://example.org/Class${i}`);
        
        shapesStore.addQuad(quad(
          shapeNode,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/ns/shacl#NodeShape')
        ));
        
        shapesStore.addQuad(quad(
          shapeNode,
          namedNode('http://www.w3.org/ns/shacl#targetClass'),
          targetClass
        ));

        // Add multiple instances
        for (let j = 0; j < 5; j++) {
          const instance = namedNode(`http://example.org/instance${i}_${j}`);
          dataStore.addQuad(quad(
            instance,
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            targetClass
          ));
        }
      }

      const startTime = Date.now();
      const report = await validator.validateGraph(dataStore, shapesStore);
      const duration = Date.now() - startTime;
      
      expect(report.conforms).toBe(true);
      expect(report.statistics.shapesValidated).toBe(10);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed shapes gracefully', async () => {
      // Add a shape with missing required properties
      const malformedShape = namedNode('http://example.org/MalformedShape');
      
      shapesStore.addQuad(quad(
        malformedShape,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/ns/shacl#PropertyShape')
      ));
      // Missing sh:path property

      const report = await validator.validateGraph(dataStore, shapesStore);
      
      // Should not crash, just skip the malformed shape
      expect(report).toBeDefined();
      expect(report.conforms).toBe(true);
    });

    it('should handle data graph loading errors', async () => {
      const invalidDataGraph = { invalid: 'structure' };
      
      const report = await validator.validateGraph(invalidDataGraph, shapesStore);
      
      expect(report).toBeDefined();
      expect(report.conforms).toBe(true); // Empty data, no violations
    });
  });
});