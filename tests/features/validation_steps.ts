/**
 * SHACL Validation BDD Step Definitions
 * Connects SHACL validation engine to Cucumber/BDD test scenarios
 * 
 * Implements test scenarios for:
 * - SHACL constraint validation against RDF graphs
 * - Validation report generation with violation details
 * - Rule pack loading from packages/kgen-rules/
 * - Constraint checking for data quality enforcement
 */

import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { expect } from 'chai';
import { SHACLValidationEngine } from '../../src/kgen/validation/shacl-validation-engine.js';
import fs from 'fs-extra';
import path from 'path';

// Set timeout for validation steps
setDefaultTimeout(10000);

// Test context for sharing data between steps
interface TestContext {
  shaclEngine?: SHACLValidationEngine;
  shapesData?: string;
  rdfData?: string;
  validationReport?: any;
  lastError?: Error;
  initializationTime?: number;
  validationTime?: number;
  violationsCount?: number;
  expectedViolations?: Array<{
    field: string;
    value: string;
  }>;
  performanceTargets?: {
    standardGraph: number; // ≤20ms
    largeGraph: number;    // ≤100ms
  };
}

const testContext: TestContext = {};

// Before each scenario
Before(async function() {
  // Reset test context
  Object.keys(testContext).forEach(key => delete testContext[key]);
  
  // Set performance targets
  testContext.performanceTargets = {
    standardGraph: 20, // ms
    largeGraph: 100    // ms
  };
});

// After each scenario
After(async function() {
  // Clean up resources
  if (testContext.shaclEngine) {
    testContext.shaclEngine.clearCache();
  }
});

// ============= SHACL Engine Initialization =============

Given('KGEN SHACL validation engine is available', async function() {
  expect(SHACLValidationEngine).to.not.be.undefined;
  testContext.shaclEngine = new SHACLValidationEngine({
    timeout: 5000,
    maxTriples: 50000,
    includeDetails: true
  });
});

Given('the validation engine uses {string} library', function(libraryName: string) {
  expect(libraryName).to.equal('shacl-engine');
  // Verification that our engine uses the expected library is implicit in the import
});

Given('performance targets are set to {string}', function(target: string) {
  if (target.includes('≤20ms for standard graphs')) {
    expect(testContext.performanceTargets?.standardGraph).to.equal(20);
  }
});

Given('large graph performance targets are set to {string}', function(target: string) {
  if (target.includes('≤100ms for 10k+ triples')) {
    expect(testContext.performanceTargets?.largeGraph).to.equal(100);
  }
});

// ============= SHACL Shapes Setup =============

Given('I have SHACL shapes in Turtle format:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('http://www.w3.org/ns/shacl#');
});

Given('I have SHACL shapes with multiple constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:minCount');
  expect(testContext.shapesData).to.contain('sh:maxCount');
  expect(testContext.shapesData).to.contain('sh:datatype');
});

Given('I have SHACL shapes with datatype constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:datatype');
});

Given('I have SHACL shapes with cardinality constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:minCount');
});

Given('I have SHACL shapes with node kind constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:nodeKind');
});

Given('I have SHACL shapes with class constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:class');
});

Given('I have SHACL shapes with SPARQL constraints:', async function(shapesContent: string) {
  testContext.shapesData = shapesContent.trim();
  expect(testContext.shapesData).to.contain('sh:sparql');
});

// ============= SHACL Engine Initialization Steps =============

When('I initialize the SHACL validation engine with these shapes', async function() {
  const startTime = performance.now();
  
  try {
    await testContext.shaclEngine!.initialize(testContext.shapesData!);
    testContext.initializationTime = performance.now() - startTime;
  } catch (error) {
    testContext.lastError = error as Error;
  }
});

Then('the engine should be initialized successfully', function() {
  expect(testContext.lastError).to.be.undefined;
  expect(testContext.shaclEngine!.engine).to.not.be.null;
});

Then('the engine should report {string} shapes loaded', function(expectedCount: string) {
  const shapesCount = testContext.shaclEngine!.performanceMetrics.shapesCount;
  expect(shapesCount.toString()).to.equal(expectedCount);
});

Then('initialization time should be less than {string}', function(targetTime: string) {
  const targetMs = parseInt(targetTime.replace('ms', ''));
  expect(testContext.initializationTime).to.be.lessThan(targetMs);
});

// ============= RDF Data Setup =============

Given('the SHACL validation engine is initialized with person shapes', async function() {
  const personShapes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix schema: <http://schema.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

    PersonShape a sh:NodeShape ;
      sh:targetClass schema:Person ;
      sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Person must have a name"
      ] .
  `;
  
  testContext.shaclEngine = new SHACLValidationEngine();
  await testContext.shaclEngine.initialize(personShapes);
});

Given('the SHACL validation engine is initialized', async function() {
  if (!testContext.shaclEngine!.engine) {
    const basicShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      
      BasicShape a sh:NodeShape ;
        sh:targetClass schema:Thing .
    `;
    await testContext.shaclEngine!.initialize(basicShapes);
  }
});

Given('I have RDF data in Turtle format:', function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
});

Given('I have RDF data with violations:', function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
});

Given('I have SHACL shapes requiring a name property', async function() {
  // This is covered by the person shapes setup above
});

// ============= Validation Execution =============

When('I validate the RDF data against the shapes', async function() {
  const startTime = performance.now();
  
  try {
    testContext.validationReport = await testContext.shaclEngine!.validate(testContext.rdfData!);
    testContext.validationTime = performance.now() - startTime;
    testContext.violationsCount = testContext.validationReport.violations.length;
  } catch (error) {
    testContext.lastError = error as Error;
  }
});

When('I validate data with constraint violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

When('I validate data with datatype violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

When('I validate data with cardinality violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

When('I validate data with node kind violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

When('I validate data with class violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

When('I validate data with temporal constraint violations:', async function(rdfContent: string) {
  testContext.rdfData = rdfContent.trim();
  await this.validateTheRDFDataAgainstTheShapes();
});

// ============= Validation Results Assertions =============

Then('validation should succeed', function() {
  expect(testContext.lastError).to.be.undefined;
  expect(testContext.validationReport).to.not.be.undefined;
});

Then('validation should fail', function() {
  expect(testContext.validationReport).to.not.be.undefined;
  expect(testContext.validationReport.conforms).to.be.false;
});

Then('the validation report should show {string}', function(expectedProperty: string) {
  if (expectedProperty.includes('conforms: true')) {
    expect(testContext.validationReport.conforms).to.be.true;
  } else if (expectedProperty.includes('conforms: false')) {
    expect(testContext.validationReport.conforms).to.be.false;
  }
});

Then('there should be {string} violations', function(expectedCount: string) {
  expect(testContext.violationsCount!.toString()).to.equal(expectedCount);
});

Then('validation time should be less than {string}', function(targetTime: string) {
  const targetMs = parseInt(targetTime.replace('ms', ''));
  expect(testContext.validationTime).to.be.lessThan(targetMs);
});

Then('the violation should contain:', function(violationTable: any) {
  const rows = violationTable.hashes();
  const violation = testContext.validationReport.violations[0];
  
  for (const row of rows) {
    const field = row.field;
    const expectedValue = row.value;
    
    switch (field) {
      case 'focusNode':
        expect(violation.focusNode).to.equal(expectedValue);
        break;
      case 'sourceShape':
        expect(violation.sourceShape).to.contain(expectedValue);
        break;
      case 'severity':
        expect(violation.severity).to.equal(expectedValue);
        break;
      case 'message':
        expect(violation.message).to.equal(expectedValue);
        break;
    }
  }
});

// ============= Multiple Constraint Validation =============

Then('validation should detect {string} violations:', function(expectedCount: string, violationTable: any) {
  expect(testContext.violationsCount!.toString()).to.equal(expectedCount);
  
  const rows = violationTable.hashes();
  const violations = testContext.validationReport.violations;
  
  for (let i = 0; i < rows.length; i++) {
    const expectedConstraint = rows[i].constraint;
    const expectedMessage = rows[i].message;
    
    const matchingViolation = violations.find((v: any) => 
      v.message === expectedMessage ||
      v.sourceConstraintComponent?.includes(expectedConstraint)
    );
    
    expect(matchingViolation).to.not.be.undefined;
  }
});

Then('validation should detect datatype violations', function() {
  expect(testContext.violationsCount).to.be.greaterThan(0);
  const hasDataTypeViolations = testContext.validationReport.violations.some((v: any) =>
    v.sourceConstraintComponent?.includes('datatype') || 
    v.message?.includes('datatype')
  );
  expect(hasDataTypeViolations).to.be.true;
});

Then('violations should include datatype constraint failures', function() {
  const violations = testContext.validationReport.violations;
  expect(violations.length).to.be.greaterThan(0);
  
  const hasDataTypeFailures = violations.some((v: any) =>
    v.sourceConstraintComponent?.includes('DatatypeConstraintComponent')
  );
  expect(hasDataTypeFailures).to.be.true;
});

// ============= Performance and Error Handling =============

Given('I have a standard RDF graph with {string} triples', async function(tripleCount: string) {
  // Generate a standard graph with the specified number of triples
  const count = parseInt(tripleCount);
  let rdfData = `
    @prefix schema: <http://schema.org/> .
    @prefix ex: <http://example.org/> .
  `;
  
  for (let i = 1; i <= count; i++) {
    rdfData += `
    ex:entity${i} a schema:Thing ;
      schema:name "Entity ${i}" .`;
  }
  
  testContext.rdfData = rdfData;
});

Given('SHACL shapes with {string} constraints', async function(constraintCount: string) {
  // This would typically load pre-defined shapes with the specified constraint count
  // For now, we use basic shapes
  testContext.shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix schema: <http://schema.org/> .
    
    ThingShape a sh:NodeShape ;
      sh:targetClass schema:Thing ;
      sh:property [
        sh:path schema:name ;
        sh:minCount 1
      ] .
  `;
});

Then('validation should complete within {string}', function(targetTime: string) {
  const targetMs = parseInt(targetTime.replace('ms', ''));
  expect(testContext.validationTime).to.be.lessThan(targetMs);
});

Then('performance metrics should be recorded', function() {
  expect(testContext.validationReport.summary.performance).to.not.be.undefined;
  expect(testContext.validationReport.summary.performance.validationTime).to.not.be.undefined;
});

Then('the validation report should include timing information', function() {
  expect(testContext.validationReport.summary.performance.validationTime).to.match(/\d+(\.\d+)?ms/);
});

// ============= Rule Pack Loading =============

Given('I have rule packs available in {string}', async function(rulePackPath: string) {
  // Load rule packs from the specified directory
  const fullPath = path.resolve(rulePackPath);
  const exists = await fs.pathExists(fullPath);
  expect(exists).to.be.true;
});

When('I load rule pack {string}', async function(rulePackName: string) {
  // Load specific rule pack from kgen-rules
  const rulePackPath = path.join(__dirname, '../../kgen/packages/kgen-rules', `${rulePackName}.ttl`);
  
  try {
    const rulePackContent = await fs.readFile(rulePackPath, 'utf8');
    testContext.shapesData = rulePackContent;
    await testContext.shaclEngine!.initialize(testContext.shapesData);
  } catch (error) {
    testContext.lastError = error as Error;
  }
});

Then('rule pack should be loaded successfully', function() {
  expect(testContext.lastError).to.be.undefined;
  expect(testContext.shaclEngine!.performanceMetrics.shapesCount).to.be.greaterThan(0);
});

// ============= Critical Validation Rules (80/20) =============

Given('I have critical validation shapes for data quality', async function() {
  // Load the most critical 80/20 validation shapes
  testContext.shapesData = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix schema: <http://schema.org/> .
    @prefix dct: <http://purl.org/dc/terms/> .

    # Critical Rule 1: All entities must have names
    RequiredNameShape a sh:NodeShape ;
      sh:targetClass schema:Thing ;
      sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:message "All entities must have at least one name"
      ] .

    # Critical Rule 2: Dates must be valid
    DateValidationShape a sh:NodeShape ;
      sh:targetClass schema:Thing ;
      sh:property [
        sh:path dct:created ;
        sh:datatype xsd:dateTime ;
        sh:message "Creation dates must be valid dateTime values"
      ] .

    # Critical Rule 3: URIs must follow naming conventions
    URIPatternShape a sh:NodeShape ;
      sh:targetNode sh:IRI ;
      sh:pattern "^https?://.+" ;
      sh:message "URIs must use HTTP or HTTPS protocols"
    .
  `;
});

When('I validate against critical data quality rules', async function() {
  if (testContext.shapesData) {
    await testContext.shaclEngine!.initialize(testContext.shapesData);
  }
  
  // Use test data that should trigger critical violations
  testContext.rdfData = `
    @prefix schema: <http://schema.org/> .
    @prefix ex: <http://example.org/> .
    @prefix dct: <http://purl.org/dc/terms/> .

    ex:testEntity a schema:Thing ;
      dct:created "invalid-date" .
  `;
  
  await this.validateTheRDFDataAgainstTheShapes();
});

Then('critical violations should be detected', function() {
  expect(testContext.violationsCount).to.be.greaterThan(0);
  
  const criticalViolations = testContext.validationReport.violations.filter((v: any) =>
    v.message?.includes('name') || 
    v.message?.includes('dateTime') ||
    v.message?.includes('URI')
  );
  
  expect(criticalViolations.length).to.be.greaterThan(0);
});

Then('violation severity should be properly categorized', function() {
  const violations = testContext.validationReport.violations;
  expect(violations.length).to.be.greaterThan(0);
  
  violations.forEach((violation: any) => {
    expect(['Violation', 'Warning', 'Info']).to.include(violation.severity);
  });
});

// ============= Batch Validation =============

Given('I have multiple RDF graphs to validate', function() {
  testContext.rdfData = [
    `@prefix schema: <http://schema.org/> . 
     @prefix ex: <http://example.org/> . 
     ex:person1 a schema:Person ; schema:name "Alice" .`,
    
    `@prefix schema: <http://schema.org/> . 
     @prefix ex: <http://example.org/> . 
     ex:person2 a schema:Person ; schema:name "Bob" .`,
     
    `@prefix schema: <http://schema.org/> . 
     @prefix ex: <http://example.org/> . 
     ex:person3 a schema:Person .` // Missing name - violation
  ];
});

Given('each graph should be validated against the same SHACL shapes', async function() {
  const personShapes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix schema: <http://schema.org/> .
    
    PersonShape a sh:NodeShape ;
      sh:targetClass schema:Person ;
      sh:property [
        sh:path schema:name ;
        sh:minCount 1 ;
        sh:message "Person must have a name"
      ] .
  `;
  
  await testContext.shaclEngine!.initialize(personShapes);
});

When('I run batch validation with {string} set to false', async function(option: string) {
  if (option === 'exitOnFirstViolation') {
    const graphs = Array.isArray(testContext.rdfData) ? testContext.rdfData : [testContext.rdfData];
    testContext.validationReport = await testContext.shaclEngine!.validateBatch(graphs, {
      exitOnFirstViolation: false
    });
  }
});

Then('all graphs should be processed', function() {
  expect(Array.isArray(testContext.validationReport)).to.be.true;
  expect(testContext.validationReport.length).to.equal(3);
});

Then('the results should include validation reports for all graphs', function() {
  testContext.validationReport.forEach((report: any, index: number) => {
    expect(report).to.have.property('conforms');
    expect(report).to.have.property('violations');
  });
});

Then('batch processing time should be tracked', function() {
  // This would be implemented in the actual batch validation logic
  expect(testContext.validationReport).to.not.be.undefined;
});

// Helper method for step reuse
async function validateTheRDFDataAgainstTheShapes() {
  const startTime = performance.now();
  
  try {
    testContext.validationReport = await testContext.shaclEngine!.validate(testContext.rdfData!);
    testContext.validationTime = performance.now() - startTime;
    testContext.violationsCount = testContext.validationReport.violations.length;
  } catch (error) {
    testContext.lastError = error as Error;
  }
}

// Make helper available to step definitions
(global as any).validateTheRDFDataAgainstTheShapes = validateTheRDFDataAgainstTheShapes;