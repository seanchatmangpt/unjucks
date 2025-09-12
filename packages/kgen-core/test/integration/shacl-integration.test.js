/**
 * SHACL Integration Test Suite
 * Tests SHACL validation with real-world knowledge graph scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Store, Parser } from 'n3';
import { SHACLEngine } from '../../src/shacl/validator.js';
import { SHACLShapeParser } from '../../src/shacl/shapes.js';

describe('SHACL Integration Tests', () => {
  let validator;
  let shapeParser;

  beforeEach(async () => {
    validator = new SHACLEngine({
      strictMode: false,
      enableCaching: true
    });
    
    shapeParser = new SHACLShapeParser({
      enableAdvancedFeatures: true,
      parseMetadata: true
    });
    
    await validator.initialize();
  });

  describe('Real-world Knowledge Graph Validation', () => {
    it('should validate a person knowledge graph', async () => {
      // Create comprehensive person shapes
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        ex:PersonShape
          a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:name "Person Shape" ;
          sh:description "Validates person entities in the knowledge graph" ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
            sh:minLength 2 ;
            sh:maxLength 50 ;
          ] ;
          sh:property [
            sh:path ex:age ;
            sh:datatype xsd:integer ;
            sh:minInclusive 0 ;
            sh:maxInclusive 150 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:email ;
            sh:datatype xsd:string ;
            sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:knows ;
            sh:class ex:Person ;
          ] .

        ex:OrganizationShape
          a sh:NodeShape ;
          sh:targetClass ex:Organization ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:foundedYear ;
            sh:datatype xsd:integer ;
            sh:minInclusive 1800 ;
            sh:maxInclusive 2024 ;
          ] .
      `;

      // Create valid knowledge graph data
      const validData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:john
          a ex:Person ;
          ex:name "John Doe" ;
          ex:age 30 ;
          ex:email "john.doe@example.com" ;
          ex:knows ex:jane .

        ex:jane
          a ex:Person ;
          ex:name "Jane Smith" ;
          ex:age 28 ;
          ex:email "jane.smith@example.com" ;
          ex:knows ex:john .

        ex:acme
          a ex:Organization ;
          ex:name "ACME Corporation" ;
          ex:foundedYear 1995 .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(validData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.statistics.shapesValidated).toBeGreaterThan(0);
    });

    it('should detect violations in invalid knowledge graph', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PersonShape
          a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:minLength 2 ;
          ] ;
          sh:property [
            sh:path ex:age ;
            sh:datatype xsd:integer ;
            sh:minInclusive 0 ;
            sh:maxInclusive 150 ;
          ] ;
          sh:property [
            sh:path ex:email ;
            sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
          ] .
      `;

      // Invalid data with multiple constraint violations
      const invalidData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:person1
          a ex:Person ;
          ex:name "A" ;
          ex:age 200 ;
          ex:email "not-an-email" .

        ex:person2
          a ex:Person ;
          ex:age -5 .

        ex:person3
          a ex:Person ;
          ex:name "Valid Name" ;
          ex:age "not-a-number" .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(invalidData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(false);
      expect(report.violations.length).toBeGreaterThan(0);

      // Check for specific violations
      const violations = report.violations;
      
      // Should have minLength violation for "A"
      const minLengthViolation = violations.find(v => 
        v.sourceConstraintComponent === 'http://www.w3.org/ns/shacl#minLength'
      );
      expect(minLengthViolation).toBeDefined();

      // Should have maxInclusive violation for age 200
      const maxInclusiveViolation = violations.find(v => 
        v.sourceConstraintComponent === 'http://www.w3.org/ns/shacl#maxInclusive'
      );
      expect(maxInclusiveViolation).toBeDefined();

      // Should have pattern violation for invalid email
      const patternViolation = violations.find(v => 
        v.sourceConstraintComponent === 'http://www.w3.org/ns/shacl#pattern'
      );
      expect(patternViolation).toBeDefined();

      // Should have minCount violation for missing name
      const minCountViolation = violations.find(v => 
        v.sourceConstraintComponent === 'http://www.w3.org/ns/shacl#minCount'
      );
      expect(minCountViolation).toBeDefined();
    });

    it('should validate complex organizational knowledge graph', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:EmployeeShape
          a sh:NodeShape ;
          sh:targetClass ex:Employee ;
          sh:property [
            sh:path ex:employeeId ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
            sh:pattern "^EMP-\\d{4}$" ;
          ] ;
          sh:property [
            sh:path ex:department ;
            sh:class ex:Department ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:salary ;
            sh:datatype xsd:decimal ;
            sh:minInclusive 0 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:manager ;
            sh:class ex:Employee ;
            sh:maxCount 1 ;
          ] .

        ex:DepartmentShape
          a sh:NodeShape ;
          sh:targetClass ex:Department ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:budget ;
            sh:datatype xsd:decimal ;
            sh:minInclusive 0 ;
          ] .
      `;

      const organizationData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:engineering
          a ex:Department ;
          ex:name "Engineering" ;
          ex:budget 1000000.00 .

        ex:marketing
          a ex:Department ;
          ex:name "Marketing" ;
          ex:budget 500000.00 .

        ex:emp001
          a ex:Employee ;
          ex:employeeId "EMP-0001" ;
          ex:department ex:engineering ;
          ex:salary 85000.00 .

        ex:emp002
          a ex:Employee ;
          ex:employeeId "EMP-0002" ;
          ex:department ex:engineering ;
          ex:salary 95000.00 ;
          ex:manager ex:emp001 .

        ex:emp003
          a ex:Employee ;
          ex:employeeId "EMP-0003" ;
          ex:department ex:marketing ;
          ex:salary 70000.00 .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(organizationData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.statistics.shapesValidated).toBe(2); // Employee and Department shapes
    });

    it('should validate research publication knowledge graph', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:PublicationShape
          a sh:NodeShape ;
          sh:targetClass ex:Publication ;
          sh:property [
            sh:path ex:title ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
            sh:minLength 5 ;
          ] ;
          sh:property [
            sh:path ex:author ;
            sh:class ex:Author ;
            sh:minCount 1 ;
          ] ;
          sh:property [
            sh:path ex:publicationYear ;
            sh:datatype xsd:integer ;
            sh:minInclusive 1900 ;
            sh:maxInclusive 2024 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:doi ;
            sh:datatype xsd:string ;
            sh:pattern "^10\\\.\\d{4,}" ;
            sh:maxCount 1 ;
          ] .

        ex:AuthorShape
          a sh:NodeShape ;
          sh:targetClass ex:Author ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:orcid ;
            sh:datatype xsd:string ;
            sh:pattern "^\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]$" ;
            sh:maxCount 1 ;
          ] .
      `;

      const publicationData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:author1
          a ex:Author ;
          ex:name "Dr. Alice Johnson" ;
          ex:orcid "0000-0002-1825-0097" .

        ex:author2
          a ex:Author ;
          ex:name "Prof. Bob Smith" ;
          ex:orcid "0000-0003-4567-890X" .

        ex:publication1
          a ex:Publication ;
          ex:title "Machine Learning Applications in Knowledge Graphs" ;
          ex:author ex:author1 ;
          ex:author ex:author2 ;
          ex:publicationYear 2023 ;
          ex:doi "10.1234/example.2023.001" .

        ex:publication2
          a ex:Publication ;
          ex:title "Semantic Web Technologies for Data Integration" ;
          ex:author ex:author1 ;
          ex:publicationYear 2022 ;
          ex:doi "10.1234/example.2022.005" .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(publicationData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle large knowledge graphs efficiently', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:ItemShape
          a sh:NodeShape ;
          sh:targetClass ex:Item ;
          sh:property [
            sh:path ex:id ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
          ] .
      `;

      // Generate large dataset programmatically
      let largeDataset = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      `;

      for (let i = 1; i <= 100; i++) {
        largeDataset += `
          ex:item${i}
            a ex:Item ;
            ex:id "ITEM-${i.toString().padStart(3, '0')}" ;
            ex:name "Item ${i}" .
        `;
      }

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(largeDataset);

      const startTime = Date.now();
      const report = await validator.validateGraph(dataStore, shapesStore);
      const duration = Date.now() - startTime;

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(report.statistics.shapesValidated).toBe(1);
    });
  });

  describe('Complex Constraint Scenarios', () => {
    it('should handle interdependent constraints correctly', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:ContractShape
          a sh:NodeShape ;
          sh:targetClass ex:Contract ;
          sh:property [
            sh:path ex:startDate ;
            sh:datatype xsd:date ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:endDate ;
            sh:datatype xsd:date ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:value ;
            sh:datatype xsd:decimal ;
            sh:minInclusive 0 ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] ;
          sh:property [
            sh:path ex:status ;
            sh:in ( "active" "completed" "cancelled" ) ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] .
      `;

      const contractData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:contract1
          a ex:Contract ;
          ex:startDate "2023-01-01"^^xsd:date ;
          ex:endDate "2023-12-31"^^xsd:date ;
          ex:value 50000.00 ;
          ex:status "active" .

        ex:contract2
          a ex:Contract ;
          ex:startDate "2022-06-15"^^xsd:date ;
          ex:value 25000.00 ;
          ex:status "completed" .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(contractData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
    });

    it('should validate class constraints with inheritance', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:VehicleOwnerShape
          a sh:NodeShape ;
          sh:targetClass ex:VehicleOwner ;
          sh:property [
            sh:path ex:owns ;
            sh:class ex:Vehicle ;
            sh:minCount 1 ;
          ] .

        ex:VehicleShape
          a sh:NodeShape ;
          sh:targetClass ex:Vehicle ;
          sh:property [
            sh:path ex:licensePlate ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] .
      `;

      const vehicleData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:john
          a ex:VehicleOwner ;
          ex:owns ex:car1 ;
          ex:owns ex:bike1 .

        ex:car1
          a ex:Vehicle ;
          ex:licensePlate "ABC-123" .

        ex:bike1
          a ex:Vehicle ;
          ex:licensePlate "BIKE-456" .
      `;

      const shapesStore = await parseRDF(shapesData);
      const dataStore = await parseRDF(vehicleData);

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should handle malformed RDF gracefully', async () => {
      const shapesData = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:TestShape
          a sh:NodeShape ;
          sh:targetClass ex:TestClass .
      `;

      const shapesStore = await parseRDF(shapesData);
      
      // Create a partially malformed data store
      const dataStore = new Store();
      // Add some valid triples and some that might cause issues
      dataStore.addQuad({
        subject: { termType: 'NamedNode', value: 'http://example.org/test1' },
        predicate: { termType: 'NamedNode', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
        object: { termType: 'NamedNode', value: 'http://example.org/TestClass' },
        graph: { termType: 'DefaultGraph', value: '' }
      });

      const report = await validator.validateGraph(dataStore, shapesStore);

      expect(report).toBeDefined();
      expect(report.conforms).toBe(true);
    });
  });

  // Helper function to parse RDF data
  async function parseRDF(rdfData) {
    return new Promise((resolve, reject) => {
      const store = new Store();
      const parser = new Parser();
      
      parser.parse(rdfData, (error, quad, prefixes) => {
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
});