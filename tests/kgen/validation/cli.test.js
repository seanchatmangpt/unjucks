#!/usr/bin/env node

/**
 * KGEN Validation CLI Tests
 * Test suite for command-line interface functionality
 */

import { strict as assert } from 'assert';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

// Test configuration
const TEST_DIR = '/tmp/kgen-cli-tests';
const CLI_PATH = path.resolve('./packages/kgen-core/src/validation/cli.js');

// Sample test data
const SAMPLE_DATA = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:person1 a schema:Person ;
    schema:name "John Doe" ;
    schema:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> .`;

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
  console.log(`\n🧪 CLI Test ${testCount}: ${name}`);
  
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
  console.log('🔧 Setting up CLI test environment...');
  await fs.ensureDir(TEST_DIR);
  await fs.emptyDir(TEST_DIR);
}

async function cleanup() {
  console.log('🧹 Cleaning up CLI test environment...');
  await fs.remove(TEST_DIR);
}

function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: TEST_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Set timeout for tests
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('CLI command timed out'));
    }, 10000);
  });
}

async function createTestFiles() {
  const dataPath = path.join(TEST_DIR, 'test-data.ttl');
  const shapesPath = path.join(TEST_DIR, 'test-shapes.ttl');
  const reportsDir = path.join(TEST_DIR, 'reports');
  
  await fs.writeFile(dataPath, SAMPLE_DATA);
  await fs.writeFile(shapesPath, SAMPLE_SHAPES);
  await fs.ensureDir(reportsDir);
  
  return { dataPath, shapesPath, reportsDir };
}

// Test: CLI help command
async function testCLIHelp() {
  const result = await runCLI(['--help']);
  
  assert.strictEqual(result.success, true);
  assert(result.stdout.includes('KGEN Validation Engine CLI'));
  assert(result.stdout.includes('validate'));
  assert(result.stdout.includes('drift'));
  assert(result.stdout.includes('baseline'));
  assert(result.stdout.includes('report'));
}

// Test: Validate command with valid data
async function testValidateCommandSuccess() {
  const { dataPath, shapesPath, reportsDir } = await createTestFiles();
  
  const result = await runCLI([
    'validate',
    '--data', dataPath,
    '--shapes', shapesPath,
    '--output-dir', reportsDir,
    '--quiet'
  ]);
  
  assert.strictEqual(result.code, 0); // Success exit code
  assert(result.stdout.includes('Validation passed') || result.stderr.includes('initialized'));
  
  // Check that report was generated
  const reportFiles = await fs.readdir(reportsDir);
  const jsonReports = reportFiles.filter(f => f.endsWith('.json'));
  assert(jsonReports.length > 0);
}

// Test: Validate command with violations (should exit with code 3)
async function testValidateCommandViolations() {
  const { shapesPath, reportsDir } = await createTestFiles();
  
  // Create invalid data
  const invalidDataPath = path.join(TEST_DIR, 'invalid-data.ttl');
  const invalidData = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:person1 a schema:Person .`; // Missing required name property
  
  await fs.writeFile(invalidDataPath, invalidData);
  
  const result = await runCLI([
    'validate',
    '--data', invalidDataPath,
    '--shapes', shapesPath,
    '--output-dir', reportsDir,
    '--exit-on-violations',
    '--quiet'
  ]);
  
  assert.strictEqual(result.code, 3); // Violations exit code
}

// Test: Drift detection command
async function testDriftCommand() {
  const { dataPath, reportsDir } = await createTestFiles();
  
  // Create modified data for drift detection
  const modifiedData = SAMPLE_DATA + '\nex:person2 a schema:Person ; schema:name "Jane Doe" .';
  const expectedPath = path.join(TEST_DIR, 'expected-data.ttl');
  await fs.writeFile(expectedPath, modifiedData);
  
  const result = await runCLI([
    'drift',
    '--target', dataPath,
    '--expected', expectedPath,
    '--output-dir', reportsDir,
    '--tolerance', 'strict'
  ]);
  
  // Should detect drift and exit with appropriate code
  assert(result.code === 0 || result.code === 3);
  assert(result.stdout.includes('drift') || result.stderr.includes('drift'));
}

// Test: Baseline creation command
async function testBaselineCommands() {
  const { dataPath, reportsDir } = await createTestFiles();
  
  // Create baseline
  const createResult = await runCLI([
    'baseline',
    'create',
    '--target', dataPath,
    '--output-dir', reportsDir
  ]);
  
  assert.strictEqual(createResult.success, true);
  assert(createResult.stdout.includes('Baseline created') || createResult.stderr.includes('created'));
  
  // List baselines
  const listResult = await runCLI([
    'baseline',
    'list',
    '--output-dir', reportsDir
  ]);
  
  assert.strictEqual(listResult.success, true);
  assert(listResult.stdout.includes('baseline') || listResult.stderr.includes('baseline'));
}

// Test: Report listing command
async function testReportCommands() {
  const { reportsDir } = await createTestFiles();
  
  // Create a sample report file
  const sampleReport = {
    metadata: { validationId: 'test-123', timestamp: this.getDeterministicDate().toISOString() },
    summary: { totalViolations: 0, totalWarnings: 0 }
  };
  
  const reportPath = path.join(reportsDir, 'validation-report-test.json');
  await fs.writeJson(reportPath, sampleReport);
  
  // List reports
  const listResult = await runCLI([
    'report',
    'list',
    '--output-dir', reportsDir
  ]);
  
  assert.strictEqual(listResult.success, true);
  assert(listResult.stdout.includes('validation-report') || listResult.stderr.includes('report'));
}

// Test: Configuration file support
async function testConfigurationFile() {
  const { dataPath, shapesPath, reportsDir } = await createTestFiles();
  
  // Create configuration file
  const configPath = path.join(TEST_DIR, 'validation-config.json');
  const config = {
    exitCodes: { violations: 2 }, // Custom exit code
    driftDetection: { enabled: true, tolerance: 0.9 },
    validation: { strictMode: true },
    reporting: { includeStatistics: true }
  };
  
  await fs.writeJson(configPath, config);
  
  const result = await runCLI([
    'validate',
    '--data', dataPath,
    '--shapes', shapesPath,
    '--config', configPath,
    '--output-dir', reportsDir,
    '--quiet'
  ]);
  
  assert.strictEqual(result.success, true);
}

// Test: Verbose and quiet modes
async function testLoggingModes() {
  const { dataPath, shapesPath, reportsDir } = await createTestFiles();
  
  // Test verbose mode
  const verboseResult = await runCLI([
    'validate',
    '--data', dataPath,
    '--shapes', shapesPath,
    '--output-dir', reportsDir,
    '--verbose'
  ]);
  
  assert.strictEqual(verboseResult.success, true);
  // Verbose mode should produce more output
  assert(verboseResult.stdout.length > 0 || verboseResult.stderr.length > 0);
  
  // Test quiet mode
  const quietResult = await runCLI([
    'validate',
    '--data', dataPath,
    '--shapes', shapesPath,
    '--output-dir', reportsDir,
    '--quiet'
  ]);
  
  assert.strictEqual(quietResult.success, true);
  // Quiet mode should produce minimal output
}

// Test: Auto-fix functionality
async function testAutoFixMode() {
  const { dataPath, reportsDir } = await createTestFiles();
  
  const result = await runCLI([
    'drift',
    '--target', dataPath,
    '--auto-fix',
    '--output-dir', reportsDir
  ]);
  
  // Should complete successfully (even if no fixes needed)
  assert(result.code === 0 || result.code === 3);
}

// Test: Error handling for missing files
async function testErrorHandling() {
  const reportsDir = path.join(TEST_DIR, 'reports');
  await fs.ensureDir(reportsDir);
  
  // Test with non-existent data file
  const result = await runCLI([
    'validate',
    '--data', '/non/existent/file.ttl',
    '--shapes', '/non/existent/shapes.ttl',
    '--output-dir', reportsDir,
    '--quiet'
  ]);
  
  assert.strictEqual(result.code, 1); // Error exit code
}

// Test: Format specification
async function testFormatSpecification() {
  const { dataPath, shapesPath, reportsDir } = await createTestFiles();
  
  const result = await runCLI([
    'validate',
    '--data', dataPath,
    '--shapes', shapesPath,
    '--format', 'turtle',
    '--output-dir', reportsDir,
    '--quiet'
  ]);
  
  assert.strictEqual(result.success, true);
}

// Test: Report cleanup command
async function testReportCleanup() {
  const { reportsDir } = await createTestFiles();
  
  // Create some old report files
  const oldReport = path.join(reportsDir, 'validation-report-old.json');
  await fs.writeJson(oldReport, { timestamp: '2020-01-01T00:00:00Z' });
  
  // Change file modification time to make it old
  const oldDate = new Date('2020-01-01');
  await fs.utimes(oldReport, oldDate, oldDate);
  
  const result = await runCLI([
    'report',
    'cleanup',
    '--output-dir', reportsDir,
    '--days', '1' // Clean reports older than 1 day
  ]);
  
  assert.strictEqual(result.success, true);
  assert(result.stdout.includes('Cleaned') || result.stderr.includes('Cleaned'));
}

// Main test runner
async function runCLITests() {
  console.log('🚀 Starting KGEN Validation CLI Tests');
  console.log('=' .repeat(60));
  
  await setup();
  
  // Run all tests
  await test('CLI Help Command', testCLIHelp);
  await test('Validate Command Success', testValidateCommandSuccess);
  await test('Validate Command Violations', testValidateCommandViolations);
  await test('Drift Detection Command', testDriftCommand);
  await test('Baseline Commands', testBaselineCommands);
  await test('Report Commands', testReportCommands);
  await test('Configuration File Support', testConfigurationFile);
  await test('Logging Modes', testLoggingModes);
  await test('Auto-fix Mode', testAutoFixMode);
  await test('Error Handling', testErrorHandling);
  await test('Format Specification', testFormatSpecification);
  await test('Report Cleanup', testReportCleanup);
  
  await cleanup();
  
  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLI TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Some CLI tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All CLI tests passed!');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLITests().catch(error => {
    console.error('❌ CLI test runner failed:', error);
    process.exit(1);
  });
}

export { runCLITests, test, setup, cleanup };