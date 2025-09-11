#!/usr/bin/env node

/**
 * KGEN Validation Integration Tests
 * End-to-end tests with real SHACL shapes and compliance schemas
 */

import { strict as assert } from 'assert';
import fs from 'fs-extra';
import path from 'path';
import { KGenValidationEngine } from '../../../packages/kgen-core/src/validation/index.js';

// Test configuration
const TEST_DIR = '/tmp/kgen-integration-tests';
const SCHEMAS_DIR = path.join(TEST_DIR, 'schemas');
const REPORTS_DIR = path.join(TEST_DIR, 'reports');

// Real-world compliance schemas for testing
const GDPR_SHAPES = `@prefix gdpr: <http://example.org/gdpr/> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

gdpr:DataProcessingShape a sh:NodeShape ;
    sh:targetClass gdpr:DataProcessing ;
    sh:property [
        sh:path gdpr:hasLegalBasis ;
        sh:minCount 1 ;
        sh:message "Data processing must have a legal basis under GDPR" ;
    ] ;
    sh:property [
        sh:path gdpr:hasDataSubject ;
        sh:class foaf:Person ;
        sh:minCount 1 ;
        sh:message "Data processing must identify data subjects" ;
    ] ;
    sh:property [
        sh:path gdpr:retentionPeriod ;
        sh:datatype xsd:duration ;
        sh:maxCount 1 ;
        sh:message "Retention period must be specified as duration" ;
    ] .

gdpr:ConsentShape a sh:NodeShape ;
    sh:targetClass gdpr:Consent ;
    sh:property [
        sh:path gdpr:consentGiven ;
        sh:datatype xsd:boolean ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Consent status must be explicitly recorded" ;
    ] ;
    sh:property [
        sh:path gdpr:consentDate ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Consent date must be recorded" ;
    ] ;
    sh:property [
        sh:path gdpr:purpose ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:message "Purpose of data processing must be specified" ;
    ] .`;

const HIPAA_SHAPES = `@prefix hipaa: <http://example.org/hipaa/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

hipaa:ProtectedHealthInfoShape a sh:NodeShape ;
    sh:targetClass hipaa:ProtectedHealthInfo ;
    sh:property [
        sh:path hipaa:hasEncryption ;
        sh:datatype xsd:boolean ;
        sh:hasValue true ;
        sh:message "PHI must be encrypted" ;
    ] ;
    sh:property [
        sh:path hipaa:accessLog ;
        sh:class hipaa:AccessLog ;
        sh:minCount 1 ;
        sh:message "PHI access must be logged" ;
    ] ;
    sh:property [
        sh:path hipaa:authorizedPersonnel ;
        sh:class foaf:Person ;
        sh:minCount 1 ;
        sh:message "PHI access must be limited to authorized personnel" ;
    ] .

hipaa:AccessLogShape a sh:NodeShape ;
    sh:targetClass hipaa:AccessLog ;
    sh:property [
        sh:path hipaa:accessTime ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Access time must be recorded" ;
    ] ;
    sh:property [
        sh:path hipaa:accessedBy ;
        sh:class foaf:Person ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Person accessing PHI must be identified" ;
    ] ;
    sh:property [
        sh:path hipaa:purpose ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:message "Purpose of PHI access must be documented" ;
    ] .`;

const SOX_SHAPES = `@prefix sox: <http://example.org/sox/> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

sox:FinancialRecordShape a sh:NodeShape ;
    sh:targetClass sox:FinancialRecord ;
    sh:property [
        sh:path sox:hasDigitalSignature ;
        sh:datatype xsd:boolean ;
        sh:hasValue true ;
        sh:message "Financial records must be digitally signed" ;
    ] ;
    sh:property [
        sh:path sox:retentionYears ;
        sh:datatype xsd:integer ;
        sh:minInclusive 7 ;
        sh:message "Financial records must be retained for at least 7 years" ;
    ] ;
    sh:property [
        sh:path sox:auditTrail ;
        sh:class sox:AuditTrail ;
        sh:minCount 1 ;
        sh:message "Financial records must have audit trail" ;
    ] .

sox:AuditTrailShape a sh:NodeShape ;
    sh:targetClass sox:AuditTrail ;
    sh:property [
        sh:path sox:createdBy ;
        sh:class foaf:Person ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Audit trail must identify creator" ;
    ] ;
    sh:property [
        sh:path sox:createdDate ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Audit trail must record creation date" ;
    ] ;
    sh:property [
        sh:path sox:immutable ;
        sh:datatype xsd:boolean ;
        sh:hasValue true ;
        sh:message "Audit trails must be immutable" ;
    ] .`;

// Test data samples
const COMPLIANT_GDPR_DATA = `@prefix gdpr: <http://example.org/gdpr/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

gdpr:processing1 a gdpr:DataProcessing ;
    gdpr:hasLegalBasis gdpr:consent ;
    gdpr:hasDataSubject gdpr:subject1 ;
    gdpr:retentionPeriod "P2Y"^^xsd:duration .

gdpr:subject1 a foaf:Person ;
    foaf:name "John Doe" .

gdpr:consent1 a gdpr:Consent ;
    gdpr:consentGiven true ;
    gdpr:consentDate "2024-01-15T10:30:00Z"^^xsd:dateTime ;
    gdpr:purpose "Newsletter subscription" .`;

const NON_COMPLIANT_GDPR_DATA = `@prefix gdpr: <http://example.org/gdpr/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

gdpr:processing1 a gdpr:DataProcessing ;
    gdpr:hasDataSubject gdpr:subject1 .

gdpr:subject1 a foaf:Person ;
    foaf:name "John Doe" .

gdpr:consent1 a gdpr:Consent ;
    gdpr:purpose "Newsletter subscription" .`;

const COMPLIANT_HIPAA_DATA = `@prefix hipaa: <http://example.org/hipaa/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

hipaa:phi1 a hipaa:ProtectedHealthInfo ;
    hipaa:hasEncryption true ;
    hipaa:accessLog hipaa:log1 ;
    hipaa:authorizedPersonnel hipaa:doctor1 .

hipaa:log1 a hipaa:AccessLog ;
    hipaa:accessTime "2024-01-15T14:30:00Z"^^xsd:dateTime ;
    hipaa:accessedBy hipaa:doctor1 ;
    hipaa:purpose "Patient treatment review" .

hipaa:doctor1 a foaf:Person ;
    foaf:name "Dr. Smith" .`;

const COMPLIANT_SOX_DATA = `@prefix sox: <http://example.org/sox/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

sox:record1 a sox:FinancialRecord ;
    sox:hasDigitalSignature true ;
    sox:retentionYears 10 ;
    sox:auditTrail sox:trail1 .

sox:trail1 a sox:AuditTrail ;
    sox:createdBy sox:accountant1 ;
    sox:createdDate "2024-01-15T09:00:00Z"^^xsd:dateTime ;
    sox:immutable true .

sox:accountant1 a foaf:Person ;
    foaf:name "Jane Accountant" .`;

let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  testCount++;
  console.log(`\n🧪 Integration Test ${testCount}: ${name}`);
  
  return testFn()
    .then(() => {
      passedTests++;
      console.log(`✅ PASSED: ${name}`);
    })
    .catch(error => {
      failedTests++;
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
      if (process.env.VERBOSE) {
        console.log(`   Stack: ${error.stack}`);
      }
    });
}

async function setup() {
  console.log('🔧 Setting up integration test environment...');
  await fs.ensureDir(TEST_DIR);
  await fs.ensureDir(SCHEMAS_DIR);
  await fs.ensureDir(REPORTS_DIR);
  await fs.emptyDir(TEST_DIR);
  await fs.ensureDir(SCHEMAS_DIR);
  await fs.ensureDir(REPORTS_DIR);
}

async function cleanup() {
  console.log('🧹 Cleaning up integration test environment...');
  await fs.remove(TEST_DIR);
}

async function createComplianceSchemas() {
  const gdprPath = path.join(SCHEMAS_DIR, 'gdpr-shapes.ttl');
  const hipaaPath = path.join(SCHEMAS_DIR, 'hipaa-shapes.ttl');
  const soxPath = path.join(SCHEMAS_DIR, 'sox-shapes.ttl');
  
  await fs.writeFile(gdprPath, GDPR_SHAPES);
  await fs.writeFile(hipaaPath, HIPAA_SHAPES);
  await fs.writeFile(soxPath, SOX_SHAPES);
  
  return { gdprPath, hipaaPath, soxPath };
}

async function createTestData() {
  const compliantGdprPath = path.join(TEST_DIR, 'compliant-gdpr.ttl');
  const nonCompliantGdprPath = path.join(TEST_DIR, 'non-compliant-gdpr.ttl');
  const compliantHipaaPath = path.join(TEST_DIR, 'compliant-hipaa.ttl');
  const compliantSoxPath = path.join(TEST_DIR, 'compliant-sox.ttl');
  
  await fs.writeFile(compliantGdprPath, COMPLIANT_GDPR_DATA);
  await fs.writeFile(nonCompliantGdprPath, NON_COMPLIANT_GDPR_DATA);
  await fs.writeFile(compliantHipaaPath, COMPLIANT_HIPAA_DATA);
  await fs.writeFile(compliantSoxPath, COMPLIANT_SOX_DATA);
  
  return {
    compliantGdprPath,
    nonCompliantGdprPath,
    compliantHipaaPath,
    compliantSoxPath
  };
}

// Test: GDPR compliance validation (compliant data)
async function testGDPRComplianceValidation() {
  const { gdprPath } = await createComplianceSchemas();
  const { compliantGdprPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { strictMode: true }
  });
  
  await engine.initialize();
  
  const gdprShapes = await fs.readFile(gdprPath, 'utf8');
  const gdprData = await fs.readFile(compliantGdprPath, 'utf8');
  
  const result = await engine.validateSHACL(gdprData, gdprShapes);
  
  assert.strictEqual(result.conforms, true, 'GDPR compliant data should pass validation');
  assert.strictEqual(result.totalViolations, 0, 'No violations expected for compliant data');
  
  await engine.shutdown();
}

// Test: GDPR compliance validation (non-compliant data)
async function testGDPRNonComplianceValidation() {
  const { gdprPath } = await createComplianceSchemas();
  const { nonCompliantGdprPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { strictMode: true }
  });
  
  await engine.initialize();
  
  const gdprShapes = await fs.readFile(gdprPath, 'utf8');
  const gdprData = await fs.readFile(nonCompliantGdprPath, 'utf8');
  
  const result = await engine.validateSHACL(gdprData, gdprShapes);
  
  assert.strictEqual(result.conforms, false, 'Non-compliant GDPR data should fail validation');
  assert(result.totalViolations > 0, 'Violations expected for non-compliant data');
  
  // Check specific violations
  const violations = result.results.filter(r => r.severity?.includes('Violation'));
  assert(violations.length > 0, 'Should have SHACL violations');
  
  // Verify violation messages contain GDPR-specific requirements
  const violationMessages = violations.flatMap(v => v.message);
  const gdprMessages = violationMessages.filter(msg => 
    msg.includes('legal basis') || msg.includes('consent')
  );
  assert(gdprMessages.length > 0, 'Should have GDPR-specific violation messages');
  
  await engine.shutdown();
}

// Test: HIPAA compliance validation
async function testHIPAAComplianceValidation() {
  const { hipaaPath } = await createComplianceSchemas();
  const { compliantHipaaPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { strictMode: true }
  });
  
  await engine.initialize();
  
  const hipaaShapes = await fs.readFile(hipaaPath, 'utf8');
  const hipaaData = await fs.readFile(compliantHipaaPath, 'utf8');
  
  const result = await engine.validateSHACL(hipaaData, hipaaShapes);
  
  assert.strictEqual(result.conforms, true, 'HIPAA compliant data should pass validation');
  assert.strictEqual(result.totalViolations, 0, 'No violations expected for compliant data');
  
  await engine.shutdown();
}

// Test: SOX compliance validation
async function testSOXComplianceValidation() {
  const { soxPath } = await createComplianceSchemas();
  const { compliantSoxPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { strictMode: true }
  });
  
  await engine.initialize();
  
  const soxShapes = await fs.readFile(soxPath, 'utf8');
  const soxData = await fs.readFile(compliantSoxPath, 'utf8');
  
  const result = await engine.validateSHACL(soxData, soxShapes);
  
  assert.strictEqual(result.conforms, true, 'SOX compliant data should pass validation');
  assert.strictEqual(result.totalViolations, 0, 'No violations expected for compliant data');
  
  await engine.shutdown();
}

// Test: Multi-compliance validation
async function testMultiComplianceValidation() {
  const { gdprPath, hipaaPath, soxPath } = await createComplianceSchemas();
  const { compliantGdprPath, compliantHipaaPath, compliantSoxPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { strictMode: true, parallelValidation: true }
  });
  
  await engine.initialize();
  
  // Combine all shapes
  const gdprShapes = await fs.readFile(gdprPath, 'utf8');
  const hipaaShapes = await fs.readFile(hipaaPath, 'utf8');
  const soxShapes = await fs.readFile(soxPath, 'utf8');
  const combinedShapes = [gdprShapes, hipaaShapes, soxShapes].join('\n\n');
  
  // Combine all data
  const gdprData = await fs.readFile(compliantGdprPath, 'utf8');
  const hipaaData = await fs.readFile(compliantHipaaPath, 'utf8');
  const soxData = await fs.readFile(compliantSoxPath, 'utf8');
  const combinedData = [gdprData, hipaaData, soxData].join('\n\n');
  
  const result = await engine.validateSHACL(combinedData, combinedShapes);
  
  assert.strictEqual(result.conforms, true, 'Multi-compliance data should pass validation');
  assert.strictEqual(result.totalViolations, 0, 'No violations expected for compliant data');
  
  // Verify statistics
  assert(result.statistics, 'Should include validation statistics');
  assert(result.statistics.violationsBySeverity, 'Should group violations by severity');
  assert(result.statistics.violationsByShape, 'Should group violations by shape');
  
  await engine.shutdown();
}

// Test: Comprehensive validation with drift detection
async function testComprehensiveComplianceValidation() {
  const { gdprPath } = await createComplianceSchemas();
  const { compliantGdprPath, nonCompliantGdprPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { 
      outputPath: REPORTS_DIR,
      includeStatistics: true,
      timestamped: true
    },
    driftDetection: { 
      enabled: true,
      tolerance: 0.95
    },
    validation: { 
      strictMode: true 
    },
    exitCodes: {
      success: 0,
      warnings: 0,
      violations: 3,
      errors: 1
    }
  });
  
  await engine.initialize();
  
  const gdprShapes = await fs.readFile(gdprPath, 'utf8');
  const compliantData = await fs.readFile(compliantGdprPath, 'utf8');
  
  const options = {
    dataGraph: compliantData,
    shapesGraph: gdprShapes,
    targetPath: compliantGdprPath,
    expectedData: compliantData,
    validationOptions: {
      checkOWLConstraints: true
    }
  };
  
  const result = await engine.validateWithDriftDetection(options);
  
  // Comprehensive assertions
  assert(result.validationId, 'Should have validation ID');
  assert(result.timestamp, 'Should have timestamp');
  assert.strictEqual(result.exitCode, 0, 'Should succeed with compliant data');
  assert.strictEqual(result.summary.driftDetected, false, 'No drift expected');
  assert(result.validation.conforms, 'SHACL validation should pass');
  assert.strictEqual(result.validation.totalViolations, 0, 'No violations expected');
  assert(result.reportPath, 'Should generate report');
  
  // Verify report exists and contains expected content
  assert(await fs.pathExists(result.reportPath), 'Report file should exist');
  
  const report = await fs.readJson(result.reportPath);
  assert(report.metadata, 'Report should have metadata');
  assert(report.summary, 'Report should have summary');
  assert(report.validation, 'Report should have validation results');
  assert(report.drift, 'Report should have drift results');
  assert(report.statistics, 'Report should have statistics');
  assert(report.humanReadable, 'Report should have human-readable summary');
  
  await engine.shutdown();
}

// Test: Compliance drift detection
async function testComplianceDriftDetection() {
  const { gdprPath } = await createComplianceSchemas();
  const { compliantGdprPath } = await createTestData();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { 
      enabled: true,
      tolerance: 0.90,
      autoFix: false
    }
  });
  
  await engine.initialize();
  
  // Establish baseline
  const originalData = await fs.readFile(compliantGdprPath, 'utf8');
  await engine.updateBaseline(compliantGdprPath, originalData);
  
  // Modify data to introduce drift
  const modifiedData = originalData + `\n
gdpr:processing2 a gdpr:DataProcessing ;
    gdpr:hasDataSubject gdpr:subject2 .

gdpr:subject2 a foaf:Person ;
    foaf:name "Jane Doe" .`;
  
  await fs.writeFile(compliantGdprPath, modifiedData);
  
  const driftResult = await engine.detectDrift(compliantGdprPath, originalData);
  
  assert.strictEqual(driftResult.driftDetected, true, 'Should detect drift');
  assert(driftResult.driftScore < 1.0, 'Drift score should be less than 1.0');
  assert(driftResult.differences.length > 0, 'Should identify differences');
  
  // Check for recommendations
  assert(driftResult.recommendations, 'Should provide recommendations');
  assert(driftResult.recommendations.length > 0, 'Should have at least one recommendation');
  
  await engine.shutdown();
}

// Test: Performance with large compliance datasets
async function testPerformanceWithLargeDatasets() {
  const { gdprPath } = await createComplianceSchemas();
  
  // Generate large dataset
  const largeDataset = [];
  largeDataset.push(`@prefix gdpr: <http://example.org/gdpr/> .`);
  largeDataset.push(`@prefix foaf: <http://xmlns.com/foaf/0.1/> .`);
  largeDataset.push(`@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`);
  
  for (let i = 1; i <= 1000; i++) {
    largeDataset.push(`
gdpr:processing${i} a gdpr:DataProcessing ;
    gdpr:hasLegalBasis gdpr:consent ;
    gdpr:hasDataSubject gdpr:subject${i} ;
    gdpr:retentionPeriod "P2Y"^^xsd:duration .

gdpr:subject${i} a foaf:Person ;
    foaf:name "Person ${i}" .

gdpr:consent${i} a gdpr:Consent ;
    gdpr:consentGiven true ;
    gdpr:consentDate "2024-01-15T10:30:00Z"^^xsd:dateTime ;
    gdpr:purpose "Data processing purpose ${i}" .`);
  }
  
  const largePath = path.join(TEST_DIR, 'large-gdpr-dataset.ttl');
  await fs.writeFile(largePath, largeDataset.join('\n'));
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    validation: { parallelValidation: true, maxConcurrency: 4 }
  });
  
  await engine.initialize();
  
  const startTime = Date.now();
  const gdprShapes = await fs.readFile(gdprPath, 'utf8');
  const largeData = await fs.readFile(largePath, 'utf8');
  
  const result = await engine.validateSHACL(largeData, gdprShapes);
  const validationTime = Date.now() - startTime;
  
  assert.strictEqual(result.conforms, true, 'Large dataset should be valid');
  assert(validationTime < 30000, 'Validation should complete within 30 seconds');
  
  console.log(`   ⏱️  Large dataset validation completed in ${validationTime}ms`);
  console.log(`   📊 Processed ${largeDataset.length} entities`);
  
  await engine.shutdown();
}

// Test: Error resilience with malformed compliance data
async function testErrorResilienceWithMalformedData() {
  const { gdprPath } = await createComplianceSchemas();
  
  const malformedData = `@prefix gdpr: <http://example.org/gdpr/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

gdpr:processing1 a gdpr:DataProcessing
    gdpr:hasLegalBasis gdpr:consent ; # Missing semicolon
    gdpr:hasDataSubject "not-a-resource" .`;
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  try {
    const gdprShapes = await fs.readFile(gdprPath, 'utf8');
    await engine.validateSHACL(malformedData, gdprShapes);
    assert.fail('Should have thrown an error for malformed data');
  } catch (error) {
    assert(error.message.includes('SHACL validation failed'), 'Should report SHACL validation failure');
  }
  
  await engine.shutdown();
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 Starting KGEN Validation Integration Tests');
  console.log('=' .repeat(60));
  
  await setup();
  
  // Run all integration tests
  await test('GDPR Compliance Validation', testGDPRComplianceValidation);
  await test('GDPR Non-Compliance Validation', testGDPRNonComplianceValidation);
  await test('HIPAA Compliance Validation', testHIPAAComplianceValidation);
  await test('SOX Compliance Validation', testSOXComplianceValidation);
  await test('Multi-Compliance Validation', testMultiComplianceValidation);
  await test('Comprehensive Compliance Validation', testComprehensiveComplianceValidation);
  await test('Compliance Drift Detection', testComplianceDriftDetection);
  await test('Performance with Large Datasets', testPerformanceWithLargeDatasets);
  await test('Error Resilience with Malformed Data', testErrorResilienceWithMalformedData);
  
  await cleanup();
  
  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Some integration tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All integration tests passed!');
    console.log('🎉 KGEN Validation Engine is ready for production compliance validation!');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch(error => {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  });
}

export { 
  runIntegrationTests, 
  test, 
  setup, 
  cleanup,
  GDPR_SHAPES,
  HIPAA_SHAPES,
  SOX_SHAPES,
  COMPLIANT_GDPR_DATA,
  NON_COMPLIANT_GDPR_DATA
};