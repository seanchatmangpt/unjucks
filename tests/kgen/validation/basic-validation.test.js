#!/usr/bin/env node

/**
 * Basic KGEN Validation Test
 * Tests core functionality without external dependencies
 */

import { strict as assert } from 'assert';
import fs from 'fs-extra';
import path from 'path';

// Test configuration
const TEST_DIR = '/tmp/kgen-basic-validation-tests';

let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  testCount++;
  console.log(`\n🧪 Basic Test ${testCount}: ${name}`);
  
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
  console.log('🔧 Setting up basic validation tests...');
  await fs.ensureDir(TEST_DIR);
  await fs.emptyDir(TEST_DIR);
}

async function cleanup() {
  console.log('🧹 Cleaning up basic validation tests...');
  await fs.remove(TEST_DIR);
}

// Test: Directory structure
async function testDirectoryStructure() {
  const validationDir = '/Users/sac/unjucks/packages/kgen-core/src/validation';
  
  assert(await fs.pathExists(validationDir), 'Validation directory should exist');
  assert(await fs.pathExists(path.join(validationDir, 'index.js')), 'Main validation file should exist');
  assert(await fs.pathExists(path.join(validationDir, 'cli.js')), 'CLI file should exist');
  assert(await fs.pathExists(path.join(validationDir, 'package.json')), 'Package.json should exist');
  assert(await fs.pathExists(path.join(validationDir, 'config/default.json')), 'Default config should exist');
  assert(await fs.pathExists(path.join(validationDir, 'schemas/compliance-shapes.ttl')), 'Compliance shapes should exist');
}

// Test: Configuration structure
async function testConfigurationStructure() {
  const configPath = '/Users/sac/unjucks/packages/kgen-core/src/validation/config/default.json';
  const config = await fs.readJson(configPath);
  
  assert(config.exitCodes, 'Config should have exit codes');
  assert(config.driftDetection, 'Config should have drift detection settings');
  assert(config.validation, 'Config should have validation settings');
  assert(config.reporting, 'Config should have reporting settings');
  assert(config.compliance, 'Config should have compliance frameworks');
  
  assert.strictEqual(config.exitCodes.success, 0, 'Success exit code should be 0');
  assert.strictEqual(config.exitCodes.violations, 3, 'Violations exit code should be 3');
  assert.strictEqual(config.exitCodes.errors, 1, 'Errors exit code should be 1');
}

// Test: SHACL shapes structure
async function testSHACLShapesStructure() {
  const shapesPath = '/Users/sac/unjucks/packages/kgen-core/src/validation/schemas/compliance-shapes.ttl';
  const shapesContent = await fs.readFile(shapesPath, 'utf8');
  
  // Check for required SHACL namespaces
  assert(shapesContent.includes('@prefix sh:'), 'Should include SHACL namespace');
  assert(shapesContent.includes('@prefix xsd:'), 'Should include XSD namespace');
  
  // Check for compliance frameworks
  assert(shapesContent.includes('gdpr:'), 'Should include GDPR shapes');
  assert(shapesContent.includes('hipaa:'), 'Should include HIPAA shapes');
  assert(shapesContent.includes('sox:'), 'Should include SOX shapes');
  assert(shapesContent.includes('iso:'), 'Should include ISO shapes');
  
  // Check for specific shape definitions
  assert(shapesContent.includes('DataProcessingShape'), 'Should include GDPR data processing shape');
  assert(shapesContent.includes('ProtectedHealthInfoShape'), 'Should include HIPAA PHI shape');
  assert(shapesContent.includes('FinancialRecordShape'), 'Should include SOX financial record shape');
}

// Test: CLI structure
async function testCLIStructure() {
  const cliPath = '/Users/sac/unjucks/packages/kgen-core/src/validation/cli.js';
  const cliContent = await fs.readFile(cliPath, 'utf8');
  
  // Check for required CLI commands
  assert(cliContent.includes('validateCommand'), 'Should include validate command');
  assert(cliContent.includes('driftCommand'), 'Should include drift command');
  assert(cliContent.includes('baselineCommand'), 'Should include baseline command');
  assert(cliContent.includes('reportCommand'), 'Should include report command');
  
  // Check for exit code handling
  assert(cliContent.includes('ValidationExitCodes'), 'Should include exit codes');
  assert(cliContent.includes('process.exit'), 'Should handle process exit');
}

// Test: Package structure
async function testPackageStructure() {
  const packagePath = '/Users/sac/unjucks/packages/kgen-core/src/validation/package.json';
  const packageData = await fs.readJson(packagePath);
  
  assert.strictEqual(packageData.name, '@kgen/validation', 'Package name should be correct');
  assert(packageData.bin, 'Should have binary definition');
  assert(packageData.bin['kgen-validate'], 'Should have kgen-validate binary');
  assert(packageData.dependencies, 'Should have dependencies');
  assert(packageData.scripts, 'Should have scripts');
}

// Test: Test files structure
async function testTestFilesStructure() {
  const testDir = '/Users/sac/unjucks/tests/kgen/validation';
  
  assert(await fs.pathExists(testDir), 'Test directory should exist');
  assert(await fs.pathExists(path.join(testDir, 'validation-engine.test.js')), 'Engine tests should exist');
  assert(await fs.pathExists(path.join(testDir, 'cli.test.js')), 'CLI tests should exist');
  assert(await fs.pathExists(path.join(testDir, 'integration.test.js')), 'Integration tests should exist');
}

// Test: File permissions
async function testFilePermissions() {
  const cliPath = '/Users/sac/unjucks/packages/kgen-core/src/validation/cli.js';
  const stats = await fs.stat(cliPath);
  
  // Check if file is executable (at least for owner)
  const isExecutable = (stats.mode & parseInt('100', 8)) !== 0;
  assert(isExecutable, 'CLI file should be executable');
}

// Test: Content validation
async function testContentValidation() {
  const indexPath = '/Users/sac/unjucks/packages/kgen-core/src/validation/index.js';
  const indexContent = await fs.readFile(indexPath, 'utf8');
  
  // Check for key classes and exports
  assert(indexContent.includes('class KGenValidationEngine'), 'Should export main validation class');
  assert(indexContent.includes('validateWithDriftDetection'), 'Should include comprehensive validation method');
  assert(indexContent.includes('detectDrift'), 'Should include drift detection');
  assert(indexContent.includes('validateSHACL'), 'Should include SHACL validation');
  assert(indexContent.includes('calculateExitCode'), 'Should include exit code calculation');
  assert(indexContent.includes('generateReport'), 'Should include report generation');
  
  // Check for exports
  assert(indexContent.includes('export class KGenValidationEngine'), 'Should export main class');
  assert(indexContent.includes('export const ValidationExitCodes'), 'Should export exit codes');
  assert(indexContent.includes('export default KGenValidationEngine'), 'Should have default export');
}

// Main test runner
async function runBasicTests() {
  console.log('🚀 Starting KGEN Validation Basic Tests');
  console.log('=' .repeat(60));
  
  await setup();
  
  // Run all basic tests
  await test('Directory Structure', testDirectoryStructure);
  await test('Configuration Structure', testConfigurationStructure);
  await test('SHACL Shapes Structure', testSHACLShapesStructure);
  await test('CLI Structure', testCLIStructure);
  await test('Package Structure', testPackageStructure);
  await test('Test Files Structure', testTestFilesStructure);
  await test('File Permissions', testFilePermissions);
  await test('Content Validation', testContentValidation);
  
  await cleanup();
  
  // Test summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BASIC TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Some basic tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All basic tests passed!');
    console.log('🎉 KGEN Validation Engine structure is correctly implemented!');
    process.exit(0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicTests().catch(error => {
    console.error('❌ Basic test runner failed:', error);
    process.exit(1);
  });
}

export { runBasicTests, test, setup, cleanup };