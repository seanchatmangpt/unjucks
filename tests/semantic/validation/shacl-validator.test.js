/**
 * Comprehensive Unit Tests for SHACL Validator
 * Tests constraint validation, shape loading, and violation reporting
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { SHACLValidator } from '../../../src/kgen/semantic/validation/shacl-validator.js';
import { Store, Parser, Writer } from 'n3';

describe('SHACLValidator', () => {
  let validator;
  let mockConfig;
  let testDataStore;
  let testShapesStore;

  beforeEach(() => {
    mockConfig = {
      reasoning: {
        shacl: {
          enabled: true,
          validationLevel: 'strict',
          reportFormat: 'detailed',
          enableInferences: true,
          customShapesDir: 'shapes/'
        }
      }
    };

    validator = new SHACLValidator(mockConfig);
    testDataStore = new Store();
    testShapesStore = new Store();

    // Setup test data
    const parser = new Parser();
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:john rdf:type ex:Person .
      ex:john ex:name "John Doe" .
      ex:john ex:age "25"^^xsd:integer .
      ex:john ex:email "john@example.com" .

      ex:mary rdf:type ex:Person .
      ex:mary ex:name "Mary Smith" .
      ex:mary ex:age "abc" .  # Invalid age (string instead of integer)
      
      ex:company rdf:type ex:Organization .
      ex:company ex:name "ACME Corp" .
    `;

    const dataQuads = parser.parse(testData);
    testDataStore.addQuads(dataQuads);

    // Setup test shapes
    const testShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

      ex:PersonShape rdf:type sh:NodeShape .
      ex:PersonShape sh:targetClass ex:Person .
      
      ex:PersonShape sh:property [
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minLength 2 ;
        sh:maxLength 50 ;
      ] .

      ex:PersonShape sh:property [
        sh:path ex:age ;
        sh:datatype xsd:integer ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
      ] .

      ex:PersonShape sh:property [
        sh:path ex:email ;
        sh:datatype xsd:string ;
        sh:maxCount 1 ;
        sh:pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
      ] .

      ex:OrganizationShape rdf:type sh:NodeShape .
      ex:OrganizationShape sh:targetClass ex:Organization .
      
      ex:OrganizationShape sh:property [
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minLength 1 ;
      ] .
    `;

    const shapesQuads = parser.parse(testShapes);
    testShapesStore.addQuads(shapesQuads);
  });

  afterEach(() => {
    if (validator.isInitialized) {
      validator.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await validator.initialize();
      expect(validator.isInitialized).toBe(true);
      expect(validator.validationLevel).toBe('strict');
    });

    it('should throw error when SHACL is disabled', async () => {
      const invalidValidator = new SHACLValidator({ reasoning: { shacl: { enabled: false } } });
      await expect(invalidValidator.initialize()).rejects.toThrow('SHACL validation is not enabled');
    });

    it('should emit initialization events', async () => {
      const initSpy = vi.fn();
      validator.on('initialized', initSpy);
      
      await validator.initialize();
      expect(initSpy).toHaveBeenCalledWith({ component: 'SHACLValidator' });
    });

    it('should load built-in constraint types', async () => {
      await validator.initialize();
      expect(validator.constraintTypes.size).toBeGreaterThan(20);
      expect(validator.constraintTypes.has('minCount')).toBe(true);
      expect(validator.constraintTypes.has('datatype')).toBe(true);
      expect(validator.constraintTypes.has('pattern')).toBe(true);
    });
  });

  describe('Shape Loading', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should load shapes from store', async () => {
      await validator.loadShapes(testShapesStore);
      
      expect(validator.shapes.size).toBe(2);
      expect(validator.shapes.has('http://example.org/PersonShape')).toBe(true);
      expect(validator.shapes.has('http://example.org/OrganizationShape')).toBe(true);
    });

    it('should parse node shape properties correctly', async () => {
      await validator.loadShapes(testShapesStore);
      
      const personShape = validator.shapes.get('http://example.org/PersonShape');
      expect(personShape.targetClass).toBe('http://example.org/Person');
      expect(personShape.properties).toHaveLength(3);
      
      const nameProperty = personShape.properties.find(p => p.path === 'http://example.org/name');
      expect(nameProperty).toBeDefined();
      expect(nameProperty.datatype).toBe('http://www.w3.org/2001/XMLSchema#string');
      expect(nameProperty.minCount).toBe(1);
      expect(nameProperty.maxCount).toBe(1);
    });

    it('should handle shape inheritance', async () => {
      const inheritanceShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:BaseShape rdf:type sh:NodeShape .
        ex:BaseShape sh:property [
          sh:path ex:id ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
        ] .

        ex:ExtendedShape rdf:type sh:NodeShape .
        ex:ExtendedShape sh:node ex:BaseShape .
        ex:ExtendedShape sh:targetClass ex:ExtendedClass .
        ex:ExtendedShape sh:property [
          sh:path ex:extendedProp ;
          sh:datatype xsd:integer ;
        ] .
      `;

      const parser = new Parser();
      const inheritanceStore = new Store();
      inheritanceStore.addQuads(parser.parse(inheritanceShapes));

      await validator.loadShapes(inheritanceStore);
      
      const extendedShape = validator.shapes.get('http://example.org/ExtendedShape');
      expect(extendedShape).toBeDefined();
      expect(extendedShape.inheritedShapes).toContain('http://example.org/BaseShape');
    });

    it('should emit shape loading events', async () => {
      const shapeSpy = vi.fn();
      validator.on('shape:loaded', shapeSpy);
      
      await validator.loadShapes(testShapesStore);
      
      expect(shapeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Basic Constraint Validation', () => {
    beforeEach(async () => {
      await validator.initialize();
      await validator.loadShapes(testShapesStore);
    });

    describe('Cardinality Constraints', () => {
      it('should validate minCount constraint', async () => {
        const testData = `
          @prefix ex: <http://example.org/> .
          ex:incomplete rdf:type ex:Person .
          # Missing required name property
        `;

        const parser = new Parser();
        const incompleteStore = new Store();
        incompleteStore.addQuads(parser.parse(testData));

        const result = await validator.validateGraph(incompleteStore);
        
        expect(result.conforms).toBe(false);
        expect(result.violations).toHaveLength(2); // Missing name and age
        
        const nameViolation = result.violations.find(v => 
          v.path === 'http://example.org/name' && 
          v.constraint === 'minCount'
        );
        expect(nameViolation).toBeDefined();
        expect(nameViolation.severity).toBe('violation');
      });

      it('should validate maxCount constraint', async () => {
        const testData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:duplicate rdf:type ex:Person .
          ex:duplicate ex:name "First Name" .
          ex:duplicate ex:name "Second Name" .  # Violates maxCount 1
          ex:duplicate ex:age "30"^^xsd:integer .
        `;

        const parser = new Parser();
        const duplicateStore = new Store();
        duplicateStore.addQuads(parser.parse(testData));

        const result = await validator.validateGraph(duplicateStore);
        
        expect(result.conforms).toBe(false);
        const maxCountViolation = result.violations.find(v => 
          v.path === 'http://example.org/name' && 
          v.constraint === 'maxCount'
        );
        expect(maxCountViolation).toBeDefined();
      });
    });

    describe('Datatype Constraints', () => {
      it('should validate datatype constraint', async () => {
        const result = await validator.validateGraph(testDataStore);
        
        expect(result.conforms).toBe(false);
        const datatypeViolation = result.violations.find(v => 
          v.focusNode === 'http://example.org/mary' &&
          v.path === 'http://example.org/age' &&
          v.constraint === 'datatype'
        );
        expect(datatypeViolation).toBeDefined();
        expect(datatypeViolation.value).toBe('abc');
      });

      it('should accept valid datatypes', async () => {
        const validData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:valid rdf:type ex:Person .
          ex:valid ex:name "Valid Person" .
          ex:valid ex:age "25"^^xsd:integer .
        `;

        const parser = new Parser();
        const validStore = new Store();
        validStore.addQuads(parser.parse(validData));

        const result = await validator.validateGraph(validStore);
        
        const personViolations = result.violations.filter(v => 
          v.focusNode === 'http://example.org/valid'
        );
        expect(personViolations).toHaveLength(0);
      });
    });

    describe('String Constraints', () => {
      it('should validate minLength constraint', async () => {
        const shortNameData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:short rdf:type ex:Person .
          ex:short ex:name "X" .  # Too short (minLength 2)
          ex:short ex:age "25"^^xsd:integer .
        `;

        const parser = new Parser();
        const shortStore = new Store();
        shortStore.addQuads(parser.parse(shortNameData));

        const result = await validator.validateGraph(shortStore);
        
        const minLengthViolation = result.violations.find(v => 
          v.path === 'http://example.org/name' && 
          v.constraint === 'minLength'
        );
        expect(minLengthViolation).toBeDefined();
      });

      it('should validate maxLength constraint', async () => {
        const longNameData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:long rdf:type ex:Person .
          ex:long ex:name "${'A'.repeat(60)}" .  # Too long (maxLength 50)
          ex:long ex:age "25"^^xsd:integer .
        `;

        const parser = new Parser();
        const longStore = new Store();
        longStore.addQuads(parser.parse(longNameData));

        const result = await validator.validateGraph(longStore);
        
        const maxLengthViolation = result.violations.find(v => 
          v.path === 'http://example.org/name' && 
          v.constraint === 'maxLength'
        );
        expect(maxLengthViolation).toBeDefined();
      });

      it('should validate pattern constraint', async () => {
        const invalidEmailData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:invalid rdf:type ex:Person .
          ex:invalid ex:name "Invalid Person" .
          ex:invalid ex:age "25"^^xsd:integer .
          ex:invalid ex:email "invalid-email" .  # Invalid email pattern
        `;

        const parser = new Parser();
        const invalidStore = new Store();
        invalidStore.addQuads(parser.parse(invalidEmailData));

        const result = await validator.validateGraph(invalidStore);
        
        const patternViolation = result.violations.find(v => 
          v.path === 'http://example.org/email' && 
          v.constraint === 'pattern'
        );
        expect(patternViolation).toBeDefined();
      });
    });

    describe('Numeric Constraints', () => {
      it('should validate minInclusive constraint', async () => {
        const negativeAgeData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:negative rdf:type ex:Person .
          ex:negative ex:name "Negative Person" .
          ex:negative ex:age "-5"^^xsd:integer .  # Below minInclusive 0
        `;

        const parser = new Parser();
        const negativeStore = new Store();
        negativeStore.addQuads(parser.parse(negativeAgeData));

        const result = await validator.validateGraph(negativeStore);
        
        const minInclusiveViolation = result.violations.find(v => 
          v.path === 'http://example.org/age' && 
          v.constraint === 'minInclusive'
        );
        expect(minInclusiveViolation).toBeDefined();
      });

      it('should validate maxInclusive constraint', async () => {
        const oldAgeData = `
          @prefix ex: <http://example.org/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

          ex:old rdf:type ex:Person .
          ex:old ex:name "Very Old Person" .
          ex:old ex:age "200"^^xsd:integer .  # Above maxInclusive 150
        `;

        const parser = new Parser();
        const oldStore = new Store();
        oldStore.addQuads(parser.parse(oldAgeData));

        const result = await validator.validateGraph(oldStore);
        
        const maxInclusiveViolation = result.violations.find(v => 
          v.path === 'http://example.org/age' && 
          v.constraint === 'maxInclusive'
        );
        expect(maxInclusiveViolation).toBeDefined();
      });
    });
  });

  describe('Advanced Constraint Validation', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should validate sh:in constraint', async () => {
      const enumShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:StatusShape rdf:type sh:NodeShape .
        ex:StatusShape sh:targetClass ex:Task .
        ex:StatusShape sh:property [
          sh:path ex:status ;
          sh:in ("pending" "active" "completed" "cancelled") ;
          sh:minCount 1 ;
        ] .
      `;

      const invalidStatusData = `
        @prefix ex: <http://example.org/> .
        ex:task1 rdf:type ex:Task .
        ex:task1 ex:status "invalid" .  # Not in allowed values
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(enumShapes));
      dataStore.addQuads(parser.parse(invalidStatusData));

      await validator.loadShapes(shapesStore);
      const result = await validator.validateGraph(dataStore);
      
      expect(result.conforms).toBe(false);
      const inViolation = result.violations.find(v => v.constraint === 'in');
      expect(inViolation).toBeDefined();
    });

    it('should validate sh:class constraint', async () => {
      const classShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:PersonShape rdf:type sh:NodeShape .
        ex:PersonShape sh:targetClass ex:Person .
        ex:PersonShape sh:property [
          sh:path ex:manager ;
          sh:class ex:Manager ;
          sh:maxCount 1 ;
        ] .
      `;

      const invalidClassData = `
        @prefix ex: <http://example.org/> .
        ex:employee rdf:type ex:Person .
        ex:employee ex:manager ex:notAManager .
        ex:notAManager rdf:type ex:Intern .  # Wrong class
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(classShapes));
      dataStore.addQuads(parser.parse(invalidClassData));

      await validator.loadShapes(shapesStore);
      const result = await validator.validateGraph(dataStore);
      
      expect(result.conforms).toBe(false);
      const classViolation = result.violations.find(v => v.constraint === 'class');
      expect(classViolation).toBeDefined();
    });

    it('should validate sh:node constraint for nested validation', async () => {
      const nestedShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:AddressShape rdf:type sh:NodeShape .
        ex:AddressShape sh:property [
          sh:path ex:street ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
        ] .

        ex:PersonShape rdf:type sh:NodeShape .
        ex:PersonShape sh:targetClass ex:Person .
        ex:PersonShape sh:property [
          sh:path ex:address ;
          sh:node ex:AddressShape ;
          sh:minCount 1 ;
        ] .
      `;

      const incompleteAddressData = `
        @prefix ex: <http://example.org/> .
        ex:person1 rdf:type ex:Person .
        ex:person1 ex:address ex:addr1 .
        # ex:addr1 ex:street missing - should cause violation
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(nestedShapes));
      dataStore.addQuads(parser.parse(incompleteAddressData));

      await validator.loadShapes(shapesStore);
      const result = await validator.validateGraph(dataStore);
      
      expect(result.conforms).toBe(false);
      // Should have violation for missing street in nested address validation
      expect(result.violations.some(v => v.path === 'http://example.org/street')).toBe(true);
    });
  });

  describe('Validation Results and Reporting', () => {
    beforeEach(async () => {
      await validator.initialize();
      await validator.loadShapes(testShapesStore);
    });

    it('should generate detailed violation reports', async () => {
      const result = await validator.validateGraph(testDataStore);
      
      expect(result).toHaveProperty('conforms');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('statistics');
      
      const violation = result.violations[0];
      expect(violation).toHaveProperty('focusNode');
      expect(violation).toHaveProperty('path');
      expect(violation).toHaveProperty('constraint');
      expect(violation).toHaveProperty('severity');
      expect(violation).toHaveProperty('message');
      expect(violation).toHaveProperty('shape');
    });

    it('should include validation statistics', async () => {
      const result = await validator.validateGraph(testDataStore);
      
      expect(result.statistics).toHaveProperty('totalNodes');
      expect(result.statistics).toHaveProperty('totalShapes');
      expect(result.statistics).toHaveProperty('totalConstraints');
      expect(result.statistics).toHaveProperty('violationsCount');
      expect(result.statistics).toHaveProperty('validationTime');
    });

    it('should support different severity levels', async () => {
      const severityShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape rdf:type sh:NodeShape .
        ex:PersonShape sh:targetClass ex:Person .
        ex:PersonShape sh:property [
          sh:path ex:name ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
          sh:severity sh:Violation ;
        ] .
        ex:PersonShape sh:property [
          sh:path ex:nickname ;
          sh:datatype xsd:string ;
          sh:maxLength 20 ;
          sh:severity sh:Warning ;
        ] .
      `;

      const warningData = `
        @prefix ex: <http://example.org/> .
        ex:person rdf:type ex:Person .
        ex:person ex:name "John Doe" .
        ex:person ex:nickname "${'Long'.repeat(10)}" .  # Warning: too long
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(severityShapes));
      dataStore.addQuads(parser.parse(warningData));

      await validator.loadShapes(shapesStore);
      const result = await validator.validateGraph(dataStore);
      
      const warning = result.violations.find(v => v.severity === 'warning');
      expect(warning).toBeDefined();
      expect(warning.constraint).toBe('maxLength');
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should validate large datasets efficiently', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape rdf:type sh:NodeShape .
        ex:PersonShape sh:targetClass ex:Person .
        ex:PersonShape sh:property [
          sh:path ex:id ;
          sh:datatype xsd:integer ;
          sh:minCount 1 ;
        ] .
      `;

      // Generate large dataset
      let largeData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      `;
      
      for (let i = 0; i < 1000; i++) {
        largeData += `
          ex:person${i} rdf:type ex:Person .
          ex:person${i} ex:id "${i}"^^xsd:integer .
        `;
      }

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(shapes));
      dataStore.addQuads(parser.parse(largeData));

      await validator.loadShapes(shapesStore);
      
      const start = Date.now();
      const result = await validator.validateGraph(dataStore);
      const time = Date.now() - start;
      
      expect(result.conforms).toBe(true);
      expect(time).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.statistics.totalNodes).toBe(1000);
    });

    it('should support incremental validation', async () => {
      await validator.loadShapes(testShapesStore);
      
      // Initial validation
      const initialResult = await validator.validateGraph(testDataStore);
      
      // Add new data
      const additionalData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:newPerson rdf:type ex:Person .
        ex:newPerson ex:name "New Person" .
        ex:newPerson ex:age "invalid" .  # Should cause violation
      `;
      
      const parser = new Parser();
      const newQuads = parser.parse(additionalData);
      testDataStore.addQuads(newQuads);
      
      const incrementalResult = await validator.validateIncremental(testDataStore, newQuads);
      
      expect(incrementalResult.violations.length).toBeGreaterThan(0);
      expect(incrementalResult.statistics.incrementalMode).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should handle malformed shapes gracefully', async () => {
      const malformedShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:BadShape rdf:type sh:NodeShape .
        # Missing required properties
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      shapesStore.addQuads(parser.parse(malformedShapes));

      await expect(validator.loadShapes(shapesStore)).rejects.toThrow();
    });

    it('should handle empty data gracefully', async () => {
      await validator.loadShapes(testShapesStore);
      
      const emptyStore = new Store();
      const result = await validator.validateGraph(emptyStore);
      
      expect(result.conforms).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.statistics.totalNodes).toBe(0);
    });

    it('should emit error events for validation failures', async () => {
      const errorSpy = vi.fn();
      validator.on('error', errorSpy);

      // Force an error by corrupting validator state
      validator.shapes = null;
      
      await expect(validator.validateGraph(testDataStore)).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Custom Constraints', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should register custom constraint types', async () => {
      const customConstraint = {
        name: 'customRange',
        validator: (value, constraint) => {
          const num = parseInt(value);
          return num >= constraint.min && num <= constraint.max;
        }
      };

      validator.registerConstraintType(customConstraint);
      expect(validator.constraintTypes.has('customRange')).toBe(true);
    });

    it('should apply custom constraints during validation', async () => {
      const customConstraint = {
        name: 'evenNumber',
        validator: (value) => {
          const num = parseInt(value);
          return num % 2 === 0;
        }
      };

      validator.registerConstraintType(customConstraint);

      const customShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix custom: <http://example.org/custom#> .

        ex:EvenNumberShape rdf:type sh:NodeShape .
        ex:EvenNumberShape sh:targetClass ex:Number .
        ex:EvenNumberShape sh:property [
          sh:path ex:value ;
          custom:evenNumber true ;
        ] .
      `;

      const testData = `
        @prefix ex: <http://example.org/> .
        ex:oddNum rdf:type ex:Number .
        ex:oddNum ex:value "3" .  # Odd number - should violate custom constraint
      `;

      const parser = new Parser();
      const shapesStore = new Store();
      const dataStore = new Store();
      
      shapesStore.addQuads(parser.parse(customShapes));
      dataStore.addQuads(parser.parse(testData));

      await validator.loadShapes(shapesStore);
      const result = await validator.validateGraph(dataStore);
      
      expect(result.conforms).toBe(false);
      const customViolation = result.violations.find(v => v.constraint === 'evenNumber');
      expect(customViolation).toBeDefined();
    });
  });
});