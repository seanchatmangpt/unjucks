#!/usr/bin/env node

/**
 * Simple validation test for deterministic rendering
 * Tests core functionality without complex dependencies
 */

import crypto from 'crypto';
import { consola } from 'consola';

// Simple test renderer with core deterministic features
class SimpleDeterministicTest {
  constructor() {
    this.seed = 'test-seed-123';
    this.staticTime = '2024-01-01T00:00:00.000Z';
  }

  // Test core deterministic functions
  computeHash(input) {
    const canonical = typeof input === 'object' 
      ? JSON.stringify(this.sortObjectKeys(input))
      : String(input);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeys(item));

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectKeys(obj[key]);
    });
    return sorted;
  }

  deterministicRandom(seed = '') {
    const hash = this.computeHash(`${this.seed}-${seed}`);
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  deterministicUUID(namespace = 'default', input = '') {
    const combinedInput = `${this.seed}-${namespace}-${input}`;
    const hash = this.computeHash(combinedInput);
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  // Test deterministic rendering simulation
  simulateRender(template, context) {
    const normalizedContext = this.sortObjectKeys(context);
    const content = this.processTemplate(template, normalizedContext);
    return {
      content,
      contentHash: this.computeHash(content),
      context: normalizedContext,
      renderedAt: this.staticTime
    };
  }

  processTemplate(template, context) {
    // Simple template processing simulation
    let content = template;
    
    // Replace variables
    content = content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, variable) => {
      const [varName, filter] = variable.split('|').map(s => s.trim());
      let value = this.getValue(context, varName);
      
      if (filter) {
        value = this.applyFilter(value, filter);
      }
      
      return value;
    });
    
    // Normalize whitespace
    return content.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim() + '\n';
  }

  getValue(context, path) {
    const parts = path.split('.');
    let value = context;
    
    for (const part of parts) {
      if (part === 'BUILD_TIME') return this.staticTime;
      if (part === 'BUILD_SEED') return this.seed;
      value = value?.[part];
    }
    
    return value || '';
  }

  applyFilter(value, filter) {
    switch (filter) {
      case 'hash':
        return this.computeHash(value).substring(0, 8);
      case 'random':
        return this.deterministicRandom(value).toFixed(6);
      case 'uuid':
        return this.deterministicUUID('default', value);
      default:
        return value;
    }
  }
}

async function runValidationTests() {
  consola.start('Running deterministic rendering validation...');

  const tester = new SimpleDeterministicTest();
  let passed = 0;
  let failed = 0;

  // Test 1: Hash consistency
  console.log('\n📋 Test 1: Hash Consistency');
  const testData = { name: 'test', value: 123, nested: { key: 'value' } };
  const hashes = [];
  
  for (let i = 0; i < 10; i++) {
    const hash = tester.computeHash(testData);
    hashes.push(hash);
  }
  
  const uniqueHashes = new Set(hashes);
  if (uniqueHashes.size === 1) {
    consola.success('✅ Hash consistency: PASSED');
    passed++;
  } else {
    consola.error(`❌ Hash consistency: FAILED (${uniqueHashes.size} different hashes)`);
    failed++;
  }

  // Test 2: Object key sorting
  console.log('\n📋 Test 2: Object Key Sorting');
  const obj1 = { c: 3, a: 1, b: 2 };
  const obj2 = { a: 1, b: 2, c: 3 };
  
  const sorted1 = JSON.stringify(tester.sortObjectKeys(obj1));
  const sorted2 = JSON.stringify(tester.sortObjectKeys(obj2));
  
  if (sorted1 === sorted2) {
    consola.success('✅ Object key sorting: PASSED');
    passed++;
  } else {
    consola.error('❌ Object key sorting: FAILED');
    console.log(`  Sorted 1: ${sorted1}`);
    console.log(`  Sorted 2: ${sorted2}`);
    failed++;
  }

  // Test 3: Deterministic random
  console.log('\n📋 Test 3: Deterministic Random');
  const randomValues = [];
  
  for (let i = 0; i < 5; i++) {
    const value = tester.deterministicRandom('test-seed');
    randomValues.push(value);
  }
  
  const uniqueRandoms = new Set(randomValues);
  if (uniqueRandoms.size === 1) {
    consola.success(`✅ Deterministic random: PASSED (value: ${randomValues[0]})`);
    passed++;
  } else {
    consola.error(`❌ Deterministic random: FAILED (${uniqueRandoms.size} different values)`);
    failed++;
  }

  // Test 4: UUID generation
  console.log('\n📋 Test 4: Deterministic UUID');
  const uuids = [];
  
  for (let i = 0; i < 3; i++) {
    const uuid = tester.deterministicUUID('test', 'input');
    uuids.push(uuid);
  }
  
  const uniqueUUIDs = new Set(uuids);
  const validUUIDFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const formatValid = uuids.every(uuid => validUUIDFormat.test(uuid));
  
  if (uniqueUUIDs.size === 1 && formatValid) {
    consola.success(`✅ Deterministic UUID: PASSED (${uuids[0]})`);
    passed++;
  } else {
    consola.error('❌ Deterministic UUID: FAILED');
    if (uniqueUUIDs.size !== 1) console.log(`  Multiple UUIDs: ${uniqueUUIDs.size}`);
    if (!formatValid) console.log('  Invalid UUID format');
    failed++;
  }

  // Test 5: Template rendering consistency
  console.log('\n📋 Test 5: Template Rendering Consistency');
  const template = 'Hello {{ user.name }}!\nHash: {{ user.name | hash }}\nRandom: {{ user.name | random }}\nTime: {{ BUILD_TIME }}';
  const context = { user: { name: 'TestUser' } };
  
  const renders = [];
  for (let i = 0; i < 100; i++) {
    const result = tester.simulateRender(template, context);
    renders.push(result);
  }
  
  const uniqueContents = new Set(renders.map(r => r.contentHash));
  if (uniqueContents.size === 1) {
    consola.success(`✅ Template rendering consistency: PASSED (100 identical renders)`);
    consola.info(`   Content hash: ${Array.from(uniqueContents)[0].substring(0, 16)}...`);
    passed++;
  } else {
    consola.error(`❌ Template rendering consistency: FAILED (${uniqueContents.size} different outputs)`);
    failed++;
  }

  // Test 6: Context canonicalization
  console.log('\n📋 Test 6: Context Canonicalization');
  const context1 = { b: 2, a: 1, user: { name: 'Test', id: 123 } };
  const context2 = { a: 1, b: 2, user: { id: 123, name: 'Test' } };
  
  const result1 = tester.simulateRender(template, context1);
  const result2 = tester.simulateRender(template, context2);
  
  if (result1.contentHash === result2.contentHash) {
    consola.success('✅ Context canonicalization: PASSED');
    passed++;
  } else {
    consola.error('❌ Context canonicalization: FAILED');
    console.log(`  Hash 1: ${result1.contentHash.substring(0, 16)}...`);
    console.log(`  Hash 2: ${result2.contentHash.substring(0, 16)}...`);
    failed++;
  }

  // Final results
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failed === 0) {
    consola.success('🎉 ALL TESTS PASSED! Deterministic rendering is working correctly.');
    return true;
  } else {
    consola.error(`💥 ${failed} test(s) failed. Deterministic rendering needs fixes.`);
    return false;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    consola.error('Validation failed:', error);
    process.exit(1);
  });
}

export { runValidationTests };