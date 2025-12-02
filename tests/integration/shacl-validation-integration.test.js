/**
 * SHACL Validation Integration Tests
 * Tests the complete integration between SHACL engine and BDD step definitions
 */

import { expect } from 'chai';
import { SHACLValidationEngine } from '../../src/kgen/validation/shacl-validation-engine.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SHACL Validation Integration', function() {
  this.timeout(10000);
  
  let engine;
  let fixturesPath;

  before(async function() {
    fixturesPath = path.join(__dirname, '../fixtures/shacl');
    
    // Verify fixture files exist
    const requiredFixtures = [
      'critical-validation-shapes.ttl',
      'valid-test-data.ttl',
      'invalid-test-data.ttl',
      'rule-packs/data-quality-rules.ttl',
      'rule-packs/security-rules.ttl'
    ];

    for (const fixture of requiredFixtures) {
      const fixturePath = path.join(fixturesPath, fixture);
      const exists = await fs.pathExists(fixturePath);
      if (!exists) {
        throw new Error(`Required fixture file missing: ${fixture}`);
      }
    }
  });

  beforeEach(function() {
    engine = new SHACLValidationEngine({
      timeout: 5000,
      maxTriples: 10000,
      includeDetails: true
    });
  });

  afterEach(function() {
    if (engine) {
      engine.clearCache();
    }
  });

  describe('Critical Validation Shapes Integration', function() {
    
    it('should initialize engine with critical validation shapes', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      
      const startTime = performance.now();
      await engine.initialize(shapesContent);
      const initTime = performance.now() - startTime;
      
      expect(engine.engine).to.not.be.null;
      expect(engine.performanceMetrics.shapesCount).to.be.greaterThan(5);
      expect(initTime).to.be.lessThan(50); // ≤50ms initialization target
    });

    it('should validate compliant data successfully', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const dataPath = path.join(fixturesPath, 'valid-test-data.ttl');
      
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      const dataContent = await fs.readFile(dataPath, 'utf8');
      
      await engine.initialize(shapesContent);
      
      const startTime = performance.now();
      const report = await engine.validate(dataContent);
      const validationTime = performance.now() - startTime;
      
      expect(report.conforms).to.be.true;
      expect(report.violations).to.be.an('array');
      expect(report.violations.length).to.equal(0);
      expect(validationTime).to.be.lessThan(20); // ≤20ms validation target
      expect(report.summary.performance).to.exist;
    });

    it('should detect violations in invalid data', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const dataPath = path.join(fixturesPath, 'invalid-test-data.ttl');
      
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      const dataContent = await fs.readFile(dataPath, 'utf8');
      
      await engine.initialize(shapesContent);
      const report = await engine.validate(dataContent);
      
      expect(report.conforms).to.be.false;
      expect(report.violations.length).to.be.greaterThan(10);
      
      // Verify violation structure
      const violation = report.violations[0];
      expect(violation).to.have.property('focusNode');
      expect(violation).to.have.property('severity');
      expect(violation).to.have.property('message');
      
      // Check for specific violation types
      const nameViolations = report.violations.filter(v => 
        v.message && v.message.includes('name'));
      const dateViolations = report.violations.filter(v => 
        v.message && v.message.includes('date'));
      const emailViolations = report.violations.filter(v => 
        v.message && v.message.includes('email'));
        
      expect(nameViolations.length).to.be.greaterThan(0);
      expect(dateViolations.length).to.be.greaterThan(0);
      expect(emailViolations.length).to.be.greaterThan(0);
    });

    it('should categorize violations by severity', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const dataPath = path.join(fixturesPath, 'invalid-test-data.ttl');
      
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      const dataContent = await fs.readFile(dataPath, 'utf8');
      
      await engine.initialize(shapesContent);
      const report = await engine.validate(dataContent);
      
      expect(report.summary.violationsBySeverity).to.exist;
      expect(report.summary.violationsBySeverity.Violation).to.be.greaterThan(0);
      
      // Verify all violations have valid severity
      report.violations.forEach(violation => {
        expect(['Violation', 'Warning', 'Info']).to.include(violation.severity);
      });
    });

  });

  describe('Rule Pack Loading Integration', function() {
    
    it('should load data quality rule pack', async function() {
      const rulePackPath = path.join(fixturesPath, 'rule-packs/data-quality-rules.ttl');
      const rulePackContent = await fs.readFile(rulePackPath, 'utf8');
      
      await engine.initialize(rulePackContent);
      
      expect(engine.engine).to.not.be.null;
      expect(engine.performanceMetrics.shapesCount).to.be.greaterThan(3);
    });

    it('should load security rule pack', async function() {
      const rulePackPath = path.join(fixturesPath, 'rule-packs/security-rules.ttl');
      const rulePackContent = await fs.readFile(rulePackPath, 'utf8');
      
      await engine.initialize(rulePackContent);
      
      expect(engine.engine).to.not.be.null;
      expect(engine.performanceMetrics.shapesCount).to.be.greaterThan(2);
    });

    it('should validate against data quality rules', async function() {
      const rulePackPath = path.join(fixturesPath, 'rule-packs/data-quality-rules.ttl');
      const rulePackContent = await fs.readFile(rulePackPath, 'utf8');
      
      await engine.initialize(rulePackContent);
      
      // Test data that violates data quality rules
      const testData = `
        @prefix schema: <http://schema.org/> .
        @prefix ex: <http://example.org/> .
        @prefix dct: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:person1 a schema:Person ;
          schema:name "Test Person" ;
          schema:email "invalid-email-format" ;
          dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime ;
          dct:modified "2023-12-31T00:00:00Z"^^xsd:dateTime .
      `;
      
      const report = await engine.validate(testData);
      
      expect(report.conforms).to.be.false;
      expect(report.violations.length).to.be.greaterThan(0);
      
      // Should detect email format violation and temporal consistency violation
      const emailViolations = report.violations.filter(v => 
        v.message && v.message.includes('email'));
      const consistencyViolations = report.violations.filter(v => 
        v.message && v.message.includes('Consistency'));
        
      expect(emailViolations.length).to.be.greaterThan(0);
      expect(consistencyViolations.length).to.be.greaterThan(0);
    });

  });

  describe('Performance Testing', function() {
    
    it('should meet performance targets for standard graphs', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      
      await engine.initialize(shapesContent);
      
      // Generate standard test graph (≤1000 triples)
      let testData = `
        @prefix schema: <http://schema.org/> .
        @prefix ex: <http://example.org/> .
        @prefix dct: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      `;
      
      for (let i = 1; i <= 100; i++) {
        testData += `
        ex:entity${i} a schema:Thing ;
          schema:name "Entity ${i}" ;
          dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime .`;
      }
      
      const startTime = performance.now();
      const report = await engine.validate(testData);
      const validationTime = performance.now() - startTime;
      
      expect(validationTime).to.be.lessThan(20); // ≤20ms target
      expect(report.summary.performance.validationTime).to.match(/\d+(\.\d+)?ms/);
    });

    it('should handle batch validation efficiently', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      
      await engine.initialize(shapesContent);
      
      // Create multiple small graphs
      const graphs = [];
      for (let i = 1; i <= 5; i++) {
        graphs.push(`
          @prefix schema: <http://schema.org/> .
          @prefix ex: <http://example.org/> .
          @prefix dct: <http://purl.org/dc/terms/> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
          
          ex:person${i} a schema:Person ;
            schema:name "Person ${i}" ;
            dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime .
        `);
      }
      
      const startTime = performance.now();
      const reports = await engine.validateBatch(graphs);
      const totalTime = performance.now() - startTime;
      
      expect(reports).to.have.length(5);
      expect(totalTime).to.be.lessThan(100); // Reasonable batch processing time
      
      // All should conform to basic person shape
      reports.forEach(report => {
        expect(report.conforms).to.be.true;
      });
    });

  });

  describe('Critical Validation Rules (80/20)', function() {
    
    it('should detect 80% of common data quality issues', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      
      await engine.initialize(shapesContent);
      
      // Test data covering the most common validation issues
      const criticalIssuesData = `
        @prefix schema: <http://schema.org/> .
        @prefix ex: <http://example.org/> .
        @prefix dct: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        # Missing required name
        ex:entity1 a schema:Thing ;
          dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime .
          
        # Invalid date format  
        ex:entity2 a schema:Thing ;
          schema:name "Entity 2" ;
          dct:created "not-a-date" .
          
        # Missing creation timestamp
        ex:entity3 a schema:Thing ;
          schema:name "Entity 3" .
          
        # Invalid email format
        ex:person1 a schema:Person ;
          schema:name "Person 1" ;
          schema:email "invalid-email" ;
          dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime .
          
        # Age out of range
        ex:person2 a schema:Person ;
          schema:name "Person 2" ;
          schema:age 200 ;
          dct:created "2024-01-01T00:00:00Z"^^xsd:dateTime .
      `;
      
      const report = await engine.validate(criticalIssuesData);
      
      expect(report.conforms).to.be.false;
      expect(report.violations.length).to.be.greaterThan(5);
      
      // Should detect all the critical issues
      const issueTypes = {
        missingName: report.violations.filter(v => v.message.includes('name')),
        invalidDate: report.violations.filter(v => v.message.includes('date')),
        missingCreation: report.violations.filter(v => v.message.includes('creation')),
        invalidEmail: report.violations.filter(v => v.message.includes('email')),
        invalidAge: report.violations.filter(v => v.message.includes('age'))
      };
      
      expect(issueTypes.missingName.length).to.be.greaterThan(0);
      expect(issueTypes.invalidDate.length).to.be.greaterThan(0);
      expect(issueTypes.missingCreation.length).to.be.greaterThan(0);
      expect(issueTypes.invalidEmail.length).to.be.greaterThan(0);
      expect(issueTypes.invalidAge.length).to.be.greaterThan(0);
    });

    it('should provide comprehensive validation reports', async function() {
      const shapesPath = path.join(fixturesPath, 'critical-validation-shapes.ttl');
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      
      await engine.initialize(shapesContent);
      
      const testData = `
        @prefix schema: <http://schema.org/> .
        @prefix ex: <http://example.org/> .
        @prefix dct: <http://purl.org/dc/terms/> .
        
        ex:invalidEntity a schema:Thing ;
          dct:created "invalid-date" .
      `;
      
      const report = await engine.validate(testData);
      
      // Verify comprehensive report structure
      expect(report).to.have.property('conforms');
      expect(report).to.have.property('timestamp');
      expect(report).to.have.property('violations');
      expect(report).to.have.property('summary');
      
      expect(report.summary).to.have.property('totalViolations');
      expect(report.summary).to.have.property('violationsBySeverity');
      expect(report.summary).to.have.property('performance');
      
      expect(report.summary.performance).to.have.property('validationTime');
      expect(report.summary.performance).to.have.property('reportingTime');
      expect(report.summary.performance).to.have.property('graphSize');
      expect(report.summary.performance).to.have.property('shapesCount');
      
      // Verify violation detail structure
      if (report.violations.length > 0) {
        const violation = report.violations[0];
        expect(violation).to.have.property('focusNode');
        expect(violation).to.have.property('severity');
        expect(violation).to.have.property('message');
      }
    });

  });

  describe('Error Handling and Edge Cases', function() {
    
    it('should handle malformed SHACL shapes gracefully', async function() {
      const malformedShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        
        MalformedShape a sh:NodeShape ;
          sh:property [
            sh:path "not-a-valid-path" ;
            sh:minCount "not-a-number"
          ] .
      `;
      
      let error;
      try {
        await engine.initialize(malformedShapes);
      } catch (e) {
        error = e;
      }
      
      expect(error).to.exist;
      expect(error.message).to.include('initialization failed');
    });

    it('should handle malformed RDF data gracefully', async function() {
      const basicShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <http://schema.org/> .
        
        BasicShape a sh:NodeShape ;
          sh:targetClass schema:Thing .
      `;
      
      await engine.initialize(basicShapes);
      
      const malformedData = `
        @prefix schema: <http://schema.org/> .
        
        <incomplete-triple> schema:name
      `;
      
      let error;
      try {
        await engine.validate(malformedData);
      } catch (e) {
        error = e;
      }
      
      expect(error).to.exist;
      expect(error.message).to.include('validation failed');
    });

    it('should enforce size limits', async function() {
      const basicShapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix schema: <http://schema.org/> .
        
        BasicShape a sh:NodeShape ;
          sh:targetClass schema:Thing .
      `;
      
      await engine.initialize(basicShapes);
      
      // Create graph that exceeds size limit (default 10000 for this test engine)
      let largeData = `
        @prefix schema: <http://schema.org/> .
        @prefix ex: <http://example.org/> .
      `;
      
      for (let i = 1; i <= 15000; i++) {
        largeData += `ex:entity${i} a schema:Thing . `;
      }
      
      let error;
      try {
        await engine.validate(largeData);
      } catch (e) {
        error = e;
      }
      
      expect(error).to.exist;
      expect(error.message).to.include('Graph too large');
    });

  });
  
});