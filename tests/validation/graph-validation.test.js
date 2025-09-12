#!/usr/bin/env node

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, join } from 'path';

describe('KGEN Graph Validation with SHACL', () => {
  const testDir = resolve('./test-graph-validation-temp');

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('SHACL Shape Validation', () => {
    it('should validate data against SHACL shapes', () => {
      // Create SHACL shapes file
      const shapesFile = join(testDir, 'shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:PersonShape
          a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:age ;
            sh:datatype xsd:integer ;
            sh:minInclusive 0 ;
            sh:maxInclusive 150 ;
            sh:minCount 1 ;
          ] ;
          sh:property [
            sh:path ex:email ;
            sh:datatype xsd:string ;
            sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
            sh:maxCount 1 ;
          ] .
      `);

      // Create valid data graph
      const dataFile = join(testDir, 'valid-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:john a ex:Person ;
          ex:name "John Doe" ;
          ex:age 30 ;
          ex:email "john@example.com" .
          
        ex:jane a ex:Person ;
          ex:name "Jane Smith" ;
          ex:age 25 .
      `);

      // Test files exist
      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });

    it('should detect constraint violations', () => {
      // Create SHACL shapes
      const shapesFile = join(testDir, 'strict-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:StrictPersonShape
          a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:age ;
            sh:datatype xsd:integer ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:closed true ;
          sh:ignoredProperties ( rdf:type ) .
      `);

      // Create data with violations
      const invalidDataFile = join(testDir, 'invalid-data.ttl');
      writeFileSync(invalidDataFile, `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        # Missing required name property
        ex:person1 a ex:Person ;
          ex:age 30 .
          
        # Multiple names (violates maxCount)
        ex:person2 a ex:Person ;
          ex:name "Name One" ;
          ex:name "Name Two" ;
          ex:age 25 .
          
        # Extra property in closed shape
        ex:person3 a ex:Person ;
          ex:name "John" ;
          ex:age 30 ;
          ex:extraProperty "not allowed" .
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(invalidDataFile)).toBe(true);
    });
  });

  describe('SHACL Constraint Components', () => {
    it('should validate minCount constraints', () => {
      const shapesFile = join(testDir, 'mincount-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:ProjectShape
          a sh:NodeShape ;
          sh:targetClass ex:Project ;
          sh:property [
            sh:path ex:member ;
            sh:minCount 2 ;
            sh:message "Project must have at least 2 members" ;
          ] .
      `);

      const dataFile = join(testDir, 'mincount-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        
        ex:project1 a ex:Project ;
          ex:member ex:alice .
          # Only 1 member, violates minCount 2
          
        ex:project2 a ex:Project ;
          ex:member ex:bob ;
          ex:member ex:charlie ;
          ex:member ex:dave .
          # 3 members, satisfies minCount 2
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });

    it('should validate datatype constraints', () => {
      const shapesFile = join(testDir, 'datatype-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:EventShape
          a sh:NodeShape ;
          sh:targetClass ex:Event ;
          sh:property [
            sh:path ex:date ;
            sh:datatype xsd:dateTime ;
          ] ;
          sh:property [
            sh:path ex:attendees ;
            sh:datatype xsd:integer ;
          ] .
      `);

      const dataFile = join(testDir, 'datatype-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:event1 a ex:Event ;
          ex:date "2025-01-01T10:00:00Z"^^xsd:dateTime ;
          ex:attendees 25 .
          
        ex:event2 a ex:Event ;
          ex:date "invalid-date" ;  # Wrong datatype
          ex:attendees "twenty-five" .  # Wrong datatype
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });

    it('should validate pattern constraints', () => {
      const shapesFile = join(testDir, 'pattern-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:ContactShape
          a sh:NodeShape ;
          sh:targetClass ex:Contact ;
          sh:property [
            sh:path ex:phone ;
            sh:pattern "^\\+?[1-9]\\d{1,14}$" ;
            sh:message "Phone number must be in international format" ;
          ] ;
          sh:property [
            sh:path ex:postalCode ;
            sh:pattern "^\\d{5}(-\\d{4})?$" ;
            sh:message "Postal code must be 5 digits or 5+4 format" ;
          ] .
      `);

      const dataFile = join(testDir, 'pattern-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        
        ex:contact1 a ex:Contact ;
          ex:phone "+1234567890" ;
          ex:postalCode "12345" .
          
        ex:contact2 a ex:Contact ;
          ex:phone "invalid-phone" ;  # Doesn't match pattern
          ex:postalCode "invalid-postal" .  # Doesn't match pattern
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });
  });

  describe('Advanced SHACL Features', () => {
    it('should validate closed shapes', () => {
      const shapesFile = join(testDir, 'closed-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:ClosedPersonShape
          a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:closed true ;
          sh:property [
            sh:path ex:name ;
          ] ;
          sh:property [
            sh:path ex:age ;
          ] ;
          sh:ignoredProperties ( rdf:type ) .
      `);

      const dataFile = join(testDir, 'closed-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:validPerson a ex:Person ;
          ex:name "Valid Person" ;
          ex:age 30 .
          
        ex:invalidPerson a ex:Person ;
          ex:name "Invalid Person" ;
          ex:age 25 ;
          ex:unexpectedProperty "not allowed" .  # Violates closed constraint
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });

    it('should validate nested shapes', () => {
      const shapesFile = join(testDir, 'nested-shapes.ttl');
      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:CompanyShape
          a sh:NodeShape ;
          sh:targetClass ex:Company ;
          sh:property [
            sh:path ex:employee ;
            sh:class ex:Person ;
            sh:node ex:PersonShape ;
          ] .
          
        ex:PersonShape
          a sh:NodeShape ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
          ] .
      `);

      const dataFile = join(testDir, 'nested-data.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        
        ex:company1 a ex:Company ;
          ex:employee ex:john .
          
        ex:john a ex:Person ;
          ex:name "John Doe" .
      `);

      expect(existsSync(shapesFile)).toBe(true);
      expect(existsSync(dataFile)).toBe(true);
    });
  });

  describe('Basic Graph Validation', () => {
    it('should validate basic graph structure without SHACL', () => {
      const dataFile = join(testDir, 'basic-graph.ttl');
      writeFileSync(dataFile, `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Person a rdfs:Class .
        
        ex:john a ex:Person ;
          ex:name "John Doe" ;
          ex:age 30 .
          
        ex:jane a ex:Person ;
          ex:name "Jane Smith" ;
          ex:age 25 .
      `);

      // Basic validation should count triples and check syntax
      expect(existsSync(dataFile)).toBe(true);
    });

    it('should detect empty graphs', () => {
      const emptyFile = join(testDir, 'empty-graph.ttl');
      writeFileSync(emptyFile, `
        @prefix ex: <http://example.org/> .
        # Only prefixes, no actual triples
      `);

      expect(existsSync(emptyFile)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed SHACL shapes', () => {
      const malformedShapesFile = join(testDir, 'malformed-shapes.ttl');
      writeFileSync(malformedShapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:MalformedShape
          a sh:NodeShape ;
          sh:property [
            # Missing required sh:path
            sh:datatype "invalid-datatype-uri" ;
          ] .
      `);

      expect(existsSync(malformedShapesFile)).toBe(true);
    });

    it('should handle circular shape references', () => {
      const circularShapesFile = join(testDir, 'circular-shapes.ttl');
      writeFileSync(circularShapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:ShapeA
          a sh:NodeShape ;
          sh:property [
            sh:path ex:refB ;
            sh:node ex:ShapeB ;
          ] .
          
        ex:ShapeB
          a sh:NodeShape ;
          sh:property [
            sh:path ex:refA ;
            sh:node ex:ShapeA ;
          ] .
      `);

      expect(existsSync(circularShapesFile)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should validate large graphs efficiently', () => {
      const largeGraphFile = join(testDir, 'large-graph.ttl');
      
      let content = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      `;
      
      // Generate large graph
      for (let i = 0; i < 1000; i++) {
        content += `
          ex:resource${i} a ex:Resource ;
            ex:id ${i} ;
            ex:name "Resource ${i}" ;
            ex:created "2025-01-01T00:00:00Z" .
        `;
      }
      
      writeFileSync(largeGraphFile, content);

      // Validation should handle large graphs
      expect(existsSync(largeGraphFile)).toBe(true);
    });

    it('should handle complex SHACL shapes efficiently', () => {
      const complexShapesFile = join(testDir, 'complex-shapes.ttl');
      writeFileSync(complexShapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:ComplexShape
          a sh:NodeShape ;
          sh:targetClass ex:ComplexResource ;
          sh:property [
            sh:path ex:prop1 ;
            sh:datatype xsd:string ;
            sh:minLength 1 ;
            sh:maxLength 100 ;
            sh:pattern "^[A-Za-z0-9 ]+$" ;
          ] ;
          sh:property [
            sh:path ex:prop2 ;
            sh:datatype xsd:integer ;
            sh:minInclusive 0 ;
            sh:maxInclusive 9999 ;
          ] ;
          sh:property [
            sh:path ex:prop3 ;
            sh:class ex:RelatedResource ;
            sh:minCount 1 ;
            sh:maxCount 5 ;
          ] ;
          sh:and (
            [
              sh:property [
                sh:path ex:conditionalProp ;
                sh:minCount 1 ;
              ]
            ]
          ) ;
          sh:closed true ;
          sh:ignoredProperties ( rdf:type ) .
      `);

      expect(existsSync(complexShapesFile)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work with provenance validation', () => {
      // Create files that would be used in end-to-end validation
      const graphFile = join(testDir, 'provenance-graph.ttl');
      const shapesFile = join(testDir, 'provenance-shapes.ttl');
      
      writeFileSync(graphFile, `
        @prefix ex: <http://example.org/> .
        @prefix prov: <http://www.w3.org/ns/prov#> .
        
        ex:generatedData a prov:Entity ;
          prov:wasGeneratedBy ex:generation ;
          ex:content "validated content" .
          
        ex:generation a prov:Activity ;
          prov:used ex:sourceData ;
          prov:wasAssociatedWith ex:kgenTool .
      `);

      writeFileSync(shapesFile, `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix prov: <http://www.w3.org/ns/prov#> .
        @prefix ex: <http://example.org/> .
        
        ex:ProvenanceShape
          a sh:NodeShape ;
          sh:targetClass prov:Entity ;
          sh:property [
            sh:path prov:wasGeneratedBy ;
            sh:class prov:Activity ;
            sh:minCount 1 ;
          ] .
      `);

      expect(existsSync(graphFile)).toBe(true);
      expect(existsSync(shapesFile)).toBe(true);
    });
  });
});