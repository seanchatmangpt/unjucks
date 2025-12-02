#!/usr/bin/env node

import { SHACLValidationEngine } from '../packages/kgen-rules/src/validator/shacl.js';
import { SHACLShapesManager } from '../packages/kgen-rules/src/validator/shapes.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Test SHACL Validation System
 * Verifies that the implementation works correctly with rdf-validate-shacl
 */

const testDir = resolve(process.cwd(), 'tests');

async function runTests() {
  console.log('🧪 Testing SHACL Validation System');
  console.log('━'.repeat(40));

  let passed = 0;
  let failed = 0;

  // Test 1: Valid data should pass validation
  try {
    console.log('\n1️⃣ Testing valid data...');
    
    const validData = readFileSync(resolve(testDir, 'valid-data.ttl'), 'utf8');
    const shapes = readFileSync(resolve(testDir, 'sample-shapes.ttl'), 'utf8');
    
    const engine = new SHACLValidationEngine();
    const result = await engine.validateGraph(validData, shapes);
    
    if (result.conforms && result.violationCount === 0) {
      console.log('✅ Valid data passed validation');
      passed++;
    } else {
      console.log('❌ Valid data failed validation');
      console.log('Violations:', result.violations);
      failed++;
    }
  } catch (error) {
    console.log('❌ Error testing valid data:', error.message);
    failed++;
  }

  // Test 2: Invalid data should fail validation
  try {
    console.log('\n2️⃣ Testing invalid data...');
    
    const invalidData = readFileSync(resolve(testDir, 'sample-data.ttl'), 'utf8');
    const shapes = readFileSync(resolve(testDir, 'sample-shapes.ttl'), 'utf8');
    
    const engine = new SHACLValidationEngine();
    const result = await engine.validateGraph(invalidData, shapes);
    
    if (!result.conforms && result.violationCount > 0) {
      console.log('✅ Invalid data correctly failed validation');
      console.log(`   Found ${result.violationCount} violations as expected`);
      passed++;
    } else {
      console.log('❌ Invalid data incorrectly passed validation');
      failed++;
    }
  } catch (error) {
    console.log('❌ Error testing invalid data:', error.message);
    failed++;
  }

  // Test 3: Shapes Manager
  try {
    console.log('\n3️⃣ Testing Shapes Manager...');
    
    const shapesManager = new SHACLShapesManager();
    const shapes = await shapesManager.loadShapesFromFile(resolve(testDir, 'sample-shapes.ttl'));
    
    if (shapes && shapes.size > 0) {
      console.log('✅ Shapes Manager loaded shapes successfully');
      console.log(`   Loaded ${shapes.size} triples`);
      passed++;
    } else {
      console.log('❌ Shapes Manager failed to load shapes');
      failed++;
    }
  } catch (error) {
    console.log('❌ Error testing Shapes Manager:', error.message);
    failed++;
  }

  // Test 4: Zero-tick reject (invalid input)
  try {
    console.log('\n4️⃣ Testing zero-tick reject...');
    
    const engine = new SHACLValidationEngine();
    const result = await engine.validateGraph('', 'invalid shapes');
    
    if (!result.conforms && result.violations.length > 0 && result.violations[0].type === 'InputValidationError') {
      console.log('✅ Zero-tick reject working correctly');
      passed++;
    } else {
      console.log('❌ Zero-tick reject not working correctly');
      failed++;
    }
  } catch (error) {
    console.log('❌ Error testing zero-tick reject:', error.message);
    failed++;
  }

  // Test 5: Cache functionality
  try {
    console.log('\n5️⃣ Testing cache functionality...');
    
    const shapesManager = new SHACLShapesManager();
    
    // Load shapes twice
    await shapesManager.loadShapesFromFile(resolve(testDir, 'sample-shapes.ttl'));
    await shapesManager.loadShapesFromFile(resolve(testDir, 'sample-shapes.ttl'));
    
    const cacheStats = shapesManager.getCacheStats();
    
    if (cacheStats.shapesCache.size > 0) {
      console.log('✅ Cache functionality working');
      console.log(`   Cache size: ${cacheStats.shapesCache.size}`);
      passed++;
    } else {
      console.log('❌ Cache functionality not working');
      failed++;
    }
  } catch (error) {
    console.log('❌ Error testing cache:', error.message);
    failed++;
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('━'.repeat(20));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! SHACL validation system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});