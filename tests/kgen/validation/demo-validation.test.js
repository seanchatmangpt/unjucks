#!/usr/bin/env node

/**
 * Demo KGEN Validation Test
 * Demonstrates validation functionality using project dependencies
 */

import { strict as assert } from 'assert';
import fs from 'fs-extra';
import path from 'path';
import { Parser, Store, Writer } from 'n3';

// Test configuration
const TEST_DIR = '/tmp/kgen-demo-validation';
const REPORTS_DIR = path.join(TEST_DIR, 'reports');

// Mock validation engine for demonstration
class MockKGenValidationEngine {
  constructor(config = {}) {
    this.config = {
      exitCodes: { success: 0, warnings: 0, violations: 3, errors: 1 },
      reporting: { outputPath: './validation-reports' },
      driftDetection: { enabled: true, tolerance: 0.95 },
      ...config
    };
    this.status = 'uninitialized';
    this.stats = {
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      driftDetections: 0,
      totalValidationTime: 0
    };
  }

  async initialize() {
    await fs.ensureDir(this.config.reporting.outputPath);
    this.status = 'ready';
    return { success: true, status: this.status };
  }

  async parseRDF(data, format = 'turtle') {
    return new Promise((resolve, reject) => {
      const parser = new Parser({ format });
      const store = new Store();
      
      parser.parse(data, (error, quad, prefixes) => {
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

  async validateMockSHACL(dataGraph, shapesGraph) {
    const startTime = Date.now();
    
    try {
      // Parse the data to ensure it's valid RDF
      const store = await this.parseRDF(dataGraph);
      
      // Mock validation logic - check for basic patterns
      const quads = Array.from(store);
      const hasPersons = quads.some(q => q.object.value?.includes('Person'));
      const hasNames = quads.some(q => q.predicate.value?.includes('name'));
      
      const conforms = hasPersons && hasNames;
      const violations = conforms ? [] : [
        {
          focusNode: 'ex:person1',
          message: ['Missing required name property'],
          severity: 'Violation'
        }
      ];

      const result = {
        conforms,
        results: violations,
        totalViolations: violations.length,
        totalWarnings: 0,
        validationTime: Date.now() - startTime,
        statistics: {
          triplesValidated: quads.length,
          shapesChecked: 1
        }
      };

      this.stats.validationsPerformed++;
      if (conforms) {
        this.stats.validationsPassed++;
      } else {
        this.stats.validationsFailed++;
      }
      this.stats.totalValidationTime += result.validationTime;

      return result;
    } catch (error) {
      throw new Error(`Mock SHACL validation failed: ${error.message}`);
    }
  }

  async detectMockDrift(targetPath, expectedData) {
    const driftResults = {
      driftDetected: false,
      driftScore: 1.0,
      differences: [],
      recommendations: []
    };

    try {
      if (await fs.pathExists(targetPath)) {
        const currentContent = await fs.readFile(targetPath, 'utf8');
        
        if (expectedData && currentContent !== expectedData) {
          driftResults.driftDetected = true;
          driftResults.driftScore = 0.8; // Mock score
          driftResults.differences = [
            {
              type: 'content-difference',
              message: 'File content differs from expected',
              severity: 'warning'
            }
          ];
          driftResults.recommendations = [
            {
              type: 'recommendation',
              message: 'Consider updating the baseline or reviewing changes',
              action: 'Review and update if intentional'
            }
          ];
        }
      } else {
        driftResults.driftDetected = true;
        driftResults.differences = [
          {
            type: 'missing-file',
            message: `Target file ${targetPath} does not exist`,
            severity: 'violation'
          }
        ];
      }

      this.stats.driftDetections++;
      return driftResults;
    } catch (error) {
      throw new Error(`Mock drift detection failed: ${error.message}`);
    }
  }

  async validateWithDriftDetection(options = {}) {
    const validationId = 'demo-' + Math.random().toString(36).substr(2, 8);
    const startTime = Date.now();

    try {
      const results = {
        validationId,
        timestamp: new Date().toISOString(),
        validation: null,
        drift: null,
        exitCode: this.config.exitCodes.success,
        summary: {
          totalViolations: 0,
          totalWarnings: 0,
          driftDetected: false,
          fixesApplied: 0
        }
      };

      // Mock SHACL validation
      if (options.dataGraph && options.shapesGraph) {
        results.validation = await this.validateMockSHACL(options.dataGraph, options.shapesGraph);
        results.summary.totalViolations = results.validation.totalViolations;
        results.summary.totalWarnings = results.validation.totalWarnings;
      }

      // Mock drift detection
      if (options.targetPath) {
        results.drift = await this.detectMockDrift(options.targetPath, options.expectedData);
        results.summary.driftDetected = results.drift.driftDetected;
      }

      // Calculate exit code
      if (results.summary.totalViolations > 0) {
        results.exitCode = this.config.exitCodes.violations;
      } else if (results.summary.driftDetected && this.config.driftDetection.strictMode) {
        results.exitCode = this.config.exitCodes.violations;
      }

      // Generate mock report
      const reportPath = await this.generateMockReport(results);
      results.reportPath = reportPath;
      results.validationTime = Date.now() - startTime;

      return results;
    } catch (error) {
      return {
        validationId,
        timestamp: new Date().toISOString(),
        error: error.message,
        exitCode: this.config.exitCodes.errors,
        validationTime: Date.now() - startTime
      };
    }
  }

  async generateMockReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `validation-report-${timestamp}.json`;
    const reportPath = path.join(this.config.reporting.outputPath, reportFilename);

    const report = {
      metadata: {
        kgenVersion: '1.0.0-demo',
        timestamp: results.timestamp,
        validationId: results.validationId
      },
      summary: results.summary,
      validation: results.validation,
      drift: results.drift,
      statistics: this.getStats(),
      humanReadable: this.generateHumanReadableSummary(results)
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  }

  generateHumanReadableSummary(results) {
    let summary = `Demo Validation ${results.validationId} `;
    
    if (results.exitCode === 0) {
      summary += '✅ PASSED';
    } else if (results.exitCode === 3) {
      summary += '❌ FAILED (violations detected)';
    } else {
      summary += '⚠️ COMPLETED WITH ISSUES';
    }

    return summary;
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.validationsPerformed > 0 
        ? (this.stats.validationsPassed / this.stats.validationsPerformed) * 100 
        : 0
    };
  }

  async shutdown() {
    this.status = 'shutdown';
  }
}

// Sample test data
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
    ] .`;

let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  testCount++;
  console.log(`\n🧪 Demo Test ${testCount}: ${name}`);
  
  return testFn()
    .then(() => {
      passedTests++;
      console.log(`✅ PASSED: ${name}`);
    })
    .catch(error => {
      failedTests++;
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
    });
}

async function setup() {
  console.log('🔧 Setting up demo validation tests...');
  await fs.ensureDir(TEST_DIR);
  await fs.ensureDir(REPORTS_DIR);
  await fs.emptyDir(TEST_DIR);
  await fs.ensureDir(REPORTS_DIR);
}

async function cleanup() {
  console.log('🧹 Cleaning up demo validation tests...');
  await fs.remove(TEST_DIR);
}

// Test: Engine initialization
async function testEngineInitialization() {
  const engine = new MockKGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  const result = await engine.initialize();
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(engine.status, 'ready');
  
  await engine.shutdown();
}

// Test: RDF parsing
async function testRDFParsing() {
  const engine = new MockKGenValidationEngine();
  await engine.initialize();
  
  const store = await engine.parseRDF(SAMPLE_DATA);
  
  assert(store.size > 0, 'Should parse RDF data into store');
  assert(store.size >= 4, 'Should have at least 4 triples');
  
  await engine.shutdown();
}

// Test: Mock SHACL validation
async function testMockSHACLValidation() {
  const engine = new MockKGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  const result = await engine.validateMockSHACL(SAMPLE_DATA, SAMPLE_SHAPES);
  
  assert.strictEqual(result.conforms, true, 'Sample data should conform to shapes');
  assert.strictEqual(result.totalViolations, 0, 'Should have no violations');
  assert(result.validationTime >= 0, 'Should track validation time');
  assert(result.statistics, 'Should include statistics');
  
  await engine.shutdown();
}

// Test: Mock drift detection
async function testMockDriftDetection() {
  const testFile = path.join(TEST_DIR, 'test-data.ttl');
  await fs.writeFile(testFile, SAMPLE_DATA);
  
  const engine = new MockKGenValidationEngine();
  await engine.initialize();
  
  // Test no drift (same content)
  const noDriftResult = await engine.detectMockDrift(testFile, SAMPLE_DATA);
  assert.strictEqual(noDriftResult.driftDetected, false, 'Should not detect drift for same content');
  
  // Test drift (different content)
  const driftResult = await engine.detectMockDrift(testFile, 'different content');
  assert.strictEqual(driftResult.driftDetected, true, 'Should detect drift for different content');
  assert(driftResult.differences.length > 0, 'Should identify differences');
  
  await engine.shutdown();
}

// Test: Comprehensive validation
async function testComprehensiveValidation() {
  const testFile = path.join(TEST_DIR, 'comprehensive-test.ttl');
  await fs.writeFile(testFile, SAMPLE_DATA);
  
  const engine = new MockKGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  const options = {
    dataGraph: SAMPLE_DATA,
    shapesGraph: SAMPLE_SHAPES,
    targetPath: testFile,
    expectedData: SAMPLE_DATA
  };
  
  const result = await engine.validateWithDriftDetection(options);
  
  assert(result.validationId, 'Should have validation ID');
  assert(result.timestamp, 'Should have timestamp');
  assert.strictEqual(result.exitCode, 0, 'Should succeed');
  assert(result.validation, 'Should have validation results');
  assert(result.drift, 'Should have drift results');
  assert(result.reportPath, 'Should generate report');
  
  // Verify report exists
  assert(await fs.pathExists(result.reportPath), 'Report file should exist');
  
  const report = await fs.readJson(result.reportPath);
  assert(report.metadata, 'Report should have metadata');
  assert(report.summary, 'Report should have summary');
  assert(report.humanReadable, 'Report should have human-readable summary');
  
  await engine.shutdown();
}

// Test: Statistics tracking
async function testStatisticsTracking() {
  const engine = new MockKGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  // Initial stats
  let stats = engine.getStats();
  assert.strictEqual(stats.validationsPerformed, 0);
  
  // Perform validation
  await engine.validateMockSHACL(SAMPLE_DATA, SAMPLE_SHAPES);
  
  // Updated stats
  stats = engine.getStats();
  assert.strictEqual(stats.validationsPerformed, 1);
  assert.strictEqual(stats.validationsPassed, 1);
  assert.strictEqual(stats.successRate, 100);
  
  await engine.shutdown();
}

// Test: Configuration handling
async function testConfigurationHandling() {
  const customConfig = {
    exitCodes: { success: 0, violations: 5, errors: 2 },
    reporting: { outputPath: REPORTS_DIR },
    driftDetection: { enabled: true, tolerance: 0.8 }
  };
  
  const engine = new MockKGenValidationEngine(customConfig);
  
  assert.strictEqual(engine.config.exitCodes.violations, 5);
  assert.strictEqual(engine.config.driftDetection.tolerance, 0.8);
  assert.strictEqual(engine.config.reporting.outputPath, REPORTS_DIR);
}

// Test: Error handling
async function testErrorHandling() {
  const engine = new MockKGenValidationEngine({
    reporting: { outputPath: REPORTS_DIR }
  });
  
  await engine.initialize();
  
  try {
    // Test with invalid RDF
    await engine.validateMockSHACL('invalid rdf data', SAMPLE_SHAPES);
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert(error.message.includes('Mock SHACL validation failed'));
  }
  
  await engine.shutdown();
}

// Main test runner
async function runDemoTests() {
  console.log('🚀 Starting KGEN Validation Demo Tests');
  console.log('=' .repeat(60));
  
  await setup();
  
  // Run all demo tests
  await test('Engine Initialization', testEngineInitialization);
  await test('RDF Parsing', testRDFParsing);
  await test('Mock SHACL Validation', testMockSHACLValidation);
  await test('Mock Drift Detection', testMockDriftDetection);
  await test('Comprehensive Validation', testComprehensiveValidation);
  await test('Statistics Tracking', testStatisticsTracking);
  await test('Configuration Handling', testConfigurationHandling);
  await test('Error Handling', testErrorHandling);
  
  await cleanup();
  
  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DEMO TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Some demo tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All demo tests passed!');
    console.log('🎉 KGEN Validation Engine demo completed successfully!');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Install full dependencies: npm install rdf-validate-shacl');
    console.log('2. Run full test suite: npm test');
    console.log('3. Test CLI: ./packages/kgen-core/src/validation/cli.js --help');
    console.log('4. Check compliance shapes: cat packages/kgen-core/src/validation/schemas/compliance-shapes.ttl');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemoTests().catch(error => {
    console.error('❌ Demo test runner failed:', error);
    process.exit(1);
  });
}

export { runDemoTests, MockKGenValidationEngine };