#!/usr/bin/env node

/**
 * KGEN Validation Engine Tests
 * Comprehensive test suite for validation, drift detection, and CI/CD integration
 */

import { strict as assert } from 'assert';
import fs from 'fs-extra';
import path from 'path';
import { KGenValidationEngine, ValidationExitCodes } from '../../../packages/kgen-core/src/validation/index.js';

// Test configuration
const TEST_DIR = '/tmp/kgen-validation-tests';
const REPORTS_DIR = path.join(TEST_DIR, 'reports');

// Sample RDF data for testing
const SAMPLE_DATA = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:person1 a schema:Person ;
    schema:name "John Doe" ;
    schema:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> .

ex:person2 a schema:Person ;
    schema:name "Jane Smith" ;
    schema:email "jane@example.com" .`;

const SAMPLE_SHAPES = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:PersonShape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:path schema:name ;
        sh:datatype <http://www.w3.org/2001/XMLSchema#string> ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path schema:age ;
        sh:datatype <http://www.w3.org/2001/XMLSchema#integer> ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
    ] .`;

const INVALID_DATA = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:person1 a schema:Person ;
    schema:age "invalid"^^<http://www.w3.org/2001/XMLSchema#integer> .`;

let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  testCount++;
  console.log(`\n🧪 Test ${testCount}: ${name}`);
  
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
  console.log('🔧 Setting up test environment...');
  await fs.ensureDir(TEST_DIR);
  await fs.ensureDir(REPORTS_DIR);
  await fs.emptyDir(TEST_DIR);
}

async function cleanup() {
  console.log('🧹 Cleaning up test environment...');
  await fs.remove(TEST_DIR);
}

async function createTestFiles() {
  const dataPath = path.join(TEST_DIR, 'test-data.ttl');
  const shapesPath = path.join(TEST_DIR, 'test-shapes.ttl');
  const invalidDataPath = path.join(TEST_DIR, 'invalid-data.ttl');
  
  await fs.writeFile(dataPath, SAMPLE_DATA);
  await fs.writeFile(shapesPath, SAMPLE_SHAPES);
  await fs.writeFile(invalidDataPath, INVALID_DATA);
  
  return { dataPath, shapesPath, invalidDataPath };
}

// Test: Engine initialization
async function testEngineInitialization() {
  const config = {
    reporting: { outputPath: REPORTS_DIR }
  };
  
  const engine = new KGenValidationEngine(config);
  const result = await engine.initialize();
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(engine.status, 'ready');
  
  await engine.shutdown();
}

// Test: SHACL validation with valid data
async function testValidSHACLValidation() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  const result = await engine.validateSHACL(SAMPLE_DATA, SAMPLE_SHAPES);
  
  assert.strictEqual(result.conforms, true);
  assert.strictEqual(result.totalViolations, 0);
  assert(result.validationTime >= 0);
  
  await engine.shutdown();
}

// Test: SHACL validation with invalid data
async function testInvalidSHACLValidation() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  const result = await engine.validateSHACL(INVALID_DATA, SAMPLE_SHAPES);
  
  assert.strictEqual(result.conforms, false);
  assert(result.totalViolations > 0);
  assert(result.results.length > 0);
  
  await engine.shutdown();
}

// Test: Drift detection with identical data
async function testNoDriftDetection() {
  const { dataPath } = await createTestFiles();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { enabled: true }
  });
  
  await engine.initialize();
  
  const result = await engine.detectDrift(dataPath, SAMPLE_DATA);
  
  assert.strictEqual(result.driftDetected, false);
  assert.strictEqual(result.driftScore, 1.0);
  assert.strictEqual(result.differences.length, 0);
  
  await engine.shutdown();
}

// Test: Drift detection with different data
async function testDriftDetection() {
  const { dataPath } = await createTestFiles();
  const modifiedData = SAMPLE_DATA + '\nex:person3 a schema:Person ; schema:name "New Person" .';
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { enabled: true, tolerance: 0.95 }
  });
  
  await engine.initialize();
  
  const result = await engine.detectDrift(dataPath, modifiedData);
  
  assert.strictEqual(result.driftDetected, true);
  assert(result.driftScore < 1.0);
  assert(result.differences.length > 0);
  
  await engine.shutdown();
}

// Test: Missing file drift detection
async function testMissingFileDrift() {
  const nonExistentPath = path.join(TEST_DIR, 'nonexistent.ttl');
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { enabled: true }
  });
  
  await engine.initialize();
  
  const result = await engine.detectDrift(nonExistentPath, SAMPLE_DATA);
  
  assert.strictEqual(result.driftDetected, true);
  assert(result.differences.some(d => d.type === 'missing-file'));
  
  await engine.shutdown();
}

// Test: Comprehensive validation with all features
async function testComprehensiveValidation() {
  const { dataPath, shapesPath } = await createTestFiles();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { enabled: true },
    validation: { strictMode: false }
  });
  
  await engine.initialize();
  
  const options = {
    dataGraph: SAMPLE_DATA,
    shapesGraph: SAMPLE_SHAPES,
    targetPath: dataPath,
    expectedData: SAMPLE_DATA,
    validationOptions: {
      checkOWLConstraints: true
    }
  };
  
  const result = await engine.validateWithDriftDetection(options);
  
  assert(result.validationId);
  assert(result.timestamp);
  assert.strictEqual(result.exitCode, ValidationExitCodes.SUCCESS);
  assert.strictEqual(result.summary.driftDetected, false);
  assert(result.validation.conforms);
  assert(result.reportPath);
  
  // Verify report file exists
  assert(await fs.pathExists(result.reportPath));
  
  const report = await fs.readJson(result.reportPath);
  assert(report.metadata);
  assert(report.summary);
  assert(report.validation);
  assert(report.drift);
  
  await engine.shutdown();
}

// Test: Exit code calculation
async function testExitCodeCalculation() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR },
    exitCodes: {
      success: 0,
      warnings: 0,
      violations: 3,
      errors: 1
    }
  });
  
  await engine.initialize();
  
  // Test success case
  let results = {
    summary: { totalViolations: 0, totalWarnings: 0, driftDetected: false }
  };
  assert.strictEqual(engine.calculateExitCode(results), 0);
  
  // Test violation case
  results = {
    summary: { totalViolations: 1, totalWarnings: 0, driftDetected: false }
  };
  assert.strictEqual(engine.calculateExitCode(results), 3);
  
  // Test warning case
  results = {
    summary: { totalViolations: 0, totalWarnings: 1, driftDetected: false }
  };
  assert.strictEqual(engine.calculateExitCode(results), 0);
  
  // Test error case
  results = { error: 'Something went wrong' };
  assert.strictEqual(engine.calculateExitCode(results), 1);
  
  await engine.shutdown();
}

// Test: Baseline management
async function testBaselineManagement() {
  const { dataPath } = await createTestFiles();
  
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  // Update baseline
  await engine.updateBaseline(dataPath, SAMPLE_DATA);
  assert(engine.driftBaseline.size > 0);
  
  // Load baseline
  await engine.loadDriftBaseline();
  const baselineKey = engine.getBaselineKey(dataPath);
  assert(engine.driftBaseline.has(baselineKey));
  
  const baseline = engine.driftBaseline.get(baselineKey);
  assert.strictEqual(baseline.path, dataPath);
  assert.strictEqual(baseline.content, SAMPLE_DATA);
  assert(baseline.timestamp);
  assert(baseline.hash);
  
  await engine.shutdown();
}

// Test: Statistics tracking
async function testStatisticsTracking() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  // Initial stats
  let stats = engine.getStats();
  assert.strictEqual(stats.validationsPerformed, 0);
  assert.strictEqual(stats.validationsPassed, 0);
  assert.strictEqual(stats.validationsFailed, 0);
  
  // Perform validation
  await engine.validateSHACL(SAMPLE_DATA, SAMPLE_SHAPES);
  
  // Updated stats
  stats = engine.getStats();
  assert.strictEqual(stats.validationsPerformed, 1);
  assert.strictEqual(stats.validationsPassed, 1);
  assert.strictEqual(stats.validationsFailed, 0);
  assert(stats.averageValidationTime > 0);
  assert.strictEqual(stats.successRate, 100);
  
  await engine.shutdown();
}

// Test: Error handling
async function testErrorHandling() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  try {
    // Invalid RDF data
    await engine.validateSHACL('invalid rdf data', SAMPLE_SHAPES);
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert(error.message.includes('SHACL validation failed'));
  }
  
  try {
    // Invalid shapes
    await engine.validateSHACL(SAMPLE_DATA, 'invalid shapes data');
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert(error.message.includes('SHACL validation failed'));
  }
  
  await engine.shutdown();
}

// Test: Configuration validation
async function testConfigurationValidation() {
  // Valid configuration
  const validConfig = {
    exitCodes: { success: 0, warnings: 0, violations: 3, errors: 1 },
    driftDetection: { enabled: true, autoFix: false, tolerance: 0.95 },
    validation: { strictMode: false, parallelValidation: true },
    reporting: { format: 'json', outputPath: REPORTS_DIR }
  };
  
  const engine = new KGenValidationEngine(validConfig);
  await engine.initialize();
  
  assert.strictEqual(engine.config.exitCodes.violations, 3);
  assert.strictEqual(engine.config.driftDetection.tolerance, 0.95);
  assert.strictEqual(engine.config.validation.strictMode, false);
  
  await engine.shutdown();
}

// Test: Report generation
async function testReportGeneration() {
  const engine = new KGenValidationEngine({
    reporting: { 
      outputPath: REPORTS_DIR,
      timestamped: true,
      includeStatistics: true
    }
  });
  
  await engine.initialize();
  
  const mockResults = {
    validationId: 'test-validation-123',
    timestamp: this.getDeterministicDate().toISOString(),
    exitCode: 0,
    summary: {
      totalViolations: 0,
      totalWarnings: 1,
      driftDetected: false,
      fixesApplied: 0
    },
    validation: {
      conforms: true,
      totalViolations: 0,
      totalWarnings: 1,
      validationTime: 123
    },
    drift: {
      driftDetected: false,
      driftScore: 1.0,
      differences: []
    }
  };
  
  const reportPath = await engine.generateReport(mockResults);
  
  assert(await fs.pathExists(reportPath));
  assert(reportPath.includes('validation-report-'));
  assert(reportPath.endsWith('.json'));
  
  // Verify report content
  const report = await fs.readJson(reportPath);
  assert(report.metadata);
  assert(report.summary);
  assert(report.validation);
  assert(report.drift);
  assert(report.statistics);
  assert(report.humanReadable);
  
  // Verify text summary exists
  const textReportPath = reportPath.replace('.json', '.txt');
  assert(await fs.pathExists(textReportPath));
  
  const textContent = await fs.readFile(textReportPath, 'utf8');
  assert(textContent.includes('KGEN VALIDATION REPORT'));
  assert(textContent.includes('test-validation-123'));
  
  await engine.shutdown();
}

// Test: Engine health check
async function testHealthCheck() {
  const engine = new KGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  const health = await engine.healthCheck();
  
  assert.strictEqual(health.status, 'ready');
  assert(health.stats);
  assert(health.config);
  assert(Array.isArray(health.activeValidations));
  
  await engine.shutdown();
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting KGEN Validation Engine Tests');
  console.log('=' .repeat(60));
  
  await setup();
  
  // Run all tests
  await test('Engine Initialization', testEngineInitialization);
  await test('Valid SHACL Validation', testValidSHACLValidation);
  await test('Invalid SHACL Validation', testInvalidSHACLValidation);
  await test('No Drift Detection', testNoDriftDetection);
  await test('Drift Detection', testDriftDetection);
  await test('Missing File Drift', testMissingFileDrift);
  await test('Comprehensive Validation', testComprehensiveValidation);
  await test('Exit Code Calculation', testExitCodeCalculation);
  await test('Baseline Management', testBaselineManagement);
  await test('Statistics Tracking', testStatisticsTracking);
  await test('Error Handling', testErrorHandling);
  await test('Configuration Validation', testConfigurationValidation);
  await test('Report Generation', testReportGeneration);
  await test('Health Check', testHealthCheck);
  
  await cleanup();
  
  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export {
  runTests,
  test,
  setup,
  cleanup,
  SAMPLE_DATA,
  SAMPLE_SHAPES,
  INVALID_DATA
};