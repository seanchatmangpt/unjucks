#!/usr/bin/env node

/**
 * CAS Engine Setup Validation Script
 * 
 * This script validates that the CAS engine, step definitions, and test fixtures
 * are properly configured and can be loaded successfully.
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateSetup() {
  console.log('🔍 Validating CAS Engine BDD Test Setup...\n');

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  }

  // Test 1: Check if main feature file exists
  const featureFile = join(__dirname, '01-core-generation.feature');
  const featureExists = await fs.access(featureFile).then(() => true).catch(() => false);
  test('Core generation feature file exists', featureExists);

  // Test 2: Check if step definitions exist
  const stepsFile = join(__dirname, 'step_definitions/core_steps.ts');
  const stepsExists = await fs.access(stepsFile).then(() => true).catch(() => false);
  test('Step definitions file exists', stepsExists);

  // Test 3: Check if test helpers exist
  const helpersFile = join(__dirname, 'fixtures/cas-test-helpers.ts');
  const helpersExists = await fs.access(helpersFile).then(() => true).catch(() => false);
  test('Test helpers file exists', helpersExists);

  // Test 4: Check if fixtures exist
  const fixturesFile = join(__dirname, 'fixtures/cas-test-templates.ts');
  const fixturesExists = await fs.access(fixturesFile).then(() => true).catch(() => false);
  test('Test fixtures file exists', fixturesExists);

  // Test 5: Check if RDF sample data exists
  const rdfFile = join(__dirname, 'fixtures/sample-rdf-data.ttl');
  const rdfExists = await fs.access(rdfFile).then(() => true).catch(() => false);
  test('Sample RDF data exists', rdfExists);

  // Test 6: Check if template fixtures exist
  const entityTemplate = join(__dirname, 'fixtures/templates/entity.njk');
  const entityExists = await fs.access(entityTemplate).then(() => true).catch(() => false);
  test('Entity template fixture exists', entityExists);

  const serviceTemplate = join(__dirname, 'fixtures/templates/service.njk');
  const serviceExists = await fs.access(serviceTemplate).then(() => true).catch(() => false);
  test('Service template fixture exists', serviceExists);

  // Test 7: Check if cucumber config exists
  const cucumberConfig = join(__dirname, 'cucumber.config.ts');
  const configExists = await fs.access(cucumberConfig).then(() => true).catch(() => false);
  test('Cucumber configuration exists', configExists);

  // Test 8: Validate CAS engine imports (basic syntax check)
  try {
    const stepsContent = await fs.readFile(stepsFile, 'utf-8');
    const hasImports = stepsContent.includes('CASEngine') && 
                       stepsContent.includes('KgenTemplateEngine') &&
                       stepsContent.includes('PerformanceTracker');
    test('Step definitions have correct imports', hasImports);
  } catch {
    test('Step definitions have correct imports', false);
  }

  // Test 9: Validate feature file has required scenarios
  try {
    const featureContent = await fs.readFile(featureFile, 'utf-8');
    const hasCoreScenarios = featureContent.includes('@deterministic') &&
                             featureContent.includes('@cas') &&
                             featureContent.includes('@performance') &&
                             featureContent.includes('@rdf');
    test('Feature file has core test scenarios', hasCoreScenarios);
  } catch {
    test('Feature file has core test scenarios', false);
  }

  // Test 10: Validate RDF data format
  try {
    const rdfContent = await fs.readFile(rdfFile, 'utf-8');
    const hasValidRDF = rdfContent.includes('@prefix') && 
                        rdfContent.includes('ex:Person') &&
                        rdfContent.includes('ex:Project');
    test('RDF sample data has valid format', hasValidRDF);
  } catch {
    test('RDF sample data has valid format', false);
  }

  // Summary
  console.log(`\n📊 Validation Summary:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All validations passed! CAS Engine BDD setup is ready.');
    console.log('\n📝 Next steps:');
    console.log('   1. Install required dependencies: npm install @cucumber/cucumber chai ts-node typescript');
    console.log('   2. Run smoke tests: npm run test:cas:smoke');
    console.log('   3. Run full test suite: npm run test:cas');
    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed. Please check the issues above.');
    process.exit(1);
  }
}

validateSetup().catch(error => {
  console.error('💥 Validation script failed:', error.message);
  process.exit(1);
});