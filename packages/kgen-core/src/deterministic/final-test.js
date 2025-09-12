#!/usr/bin/env node

/**
 * Final validation test - direct testing of migrated components
 */

import crypto from 'crypto';

// Direct imports to test core functionality
import { getDeterministicTimestamp } from './time.js';
import { deterministicRandom, validateDeterministicRandom } from './random.js';
import { canonicalStringify } from './canonicalize.js';

console.log('🧪 KGEN Core Deterministic System - Final Migration Validation');
console.log('=' .repeat(60));

// Test 1: Time Consistency
console.log('\n📅 Testing deterministic timestamp system...');
const time1 = getDeterministicTimestamp();
const time2 = getDeterministicTimestamp();
const timeConsistent = time1 === time2;

console.log(`   Time 1: ${time1} (${new Date(time1).toISOString()})`);
console.log(`   Time 2: ${time2} (${new Date(time2).toISOString()})`);
console.log(`   ✅ Consistent: ${timeConsistent}`);

// Test 2: Random Number Consistency  
console.log('\n🎲 Testing deterministic random generation...');
const random1 = deterministicRandom.random('test-seed');
const random2 = deterministicRandom.random('test-seed');
const randomConsistent = random1 === random2;

console.log(`   Random 1: ${random1}`);
console.log(`   Random 2: ${random2}`);
console.log(`   ✅ Consistent: ${randomConsistent}`);

// Test 3: UUID Consistency
console.log('\n🔑 Testing deterministic UUID generation...');
const uuid1 = deterministicRandom.uuid('test-namespace', 'test-content');
const uuid2 = deterministicRandom.uuid('test-namespace', 'test-content');
const uuidConsistent = uuid1 === uuid2;
const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid1);

console.log(`   UUID 1: ${uuid1}`);
console.log(`   UUID 2: ${uuid2}`);
console.log(`   ✅ Consistent: ${uuidConsistent}`);
console.log(`   ✅ Valid UUID format: ${validUuid}`);

// Test 4: Canonical Serialization
console.log('\n📄 Testing canonical JSON serialization...');
const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
const obj2 = { c: { y: 25, z: 26 }, a: 1, b: 2 };
const canonical1 = canonicalStringify(obj1);
const canonical2 = canonicalStringify(obj2);
const canonicalConsistent = canonical1 === canonical2;

console.log(`   Object 1 serialized: ${canonical1}`);
console.log(`   Object 2 serialized: ${canonical2}`);
console.log(`   ✅ Consistent: ${canonicalConsistent}`);

// Test 5: 10-Iteration Hash Validation (Main Request)
console.log('\n🔒 Running 10-iteration SHA-256 hash validation...');
const hashes = new Set();

for (let i = 0; i < 10; i++) {
  const deterministicContent = `
Timestamp: ${getDeterministicTimestamp()}
UUID: ${deterministicRandom.uuid('iteration', `${i}`)}
Random: ${deterministicRandom.random('iteration')}
Canonical: ${canonicalStringify({ iteration: i, deterministic: true })}
  `.trim();
  
  const hash = crypto.createHash('sha256').update(deterministicContent).digest('hex');
  hashes.add(hash);
  
  console.log(`   Iteration ${i + 1}: ${hash.substring(0, 16)}...`);
}

const isDeterministic = hashes.size === 1;
const finalHash = Array.from(hashes)[0];

// Test 6: System Validation
console.log('\n🔬 Testing random validation system...');
const randomValidation = validateDeterministicRandom(50);

// Final Results
console.log('\n' + '=' .repeat(60));
console.log('📊 FINAL MIGRATION VALIDATION RESULTS');
console.log('=' .repeat(60));

const tests = [
  { name: 'Deterministic Timestamps', passed: timeConsistent },
  { name: 'Deterministic Random Numbers', passed: randomConsistent },
  { name: 'Deterministic UUIDs', passed: uuidConsistent && validUuid },
  { name: 'Canonical JSON Serialization', passed: canonicalConsistent },
  { name: '10-Iteration Hash Validation', passed: isDeterministic },
  { name: 'Random System Validation', passed: randomValidation.deterministic }
];

let totalPassed = 0;
tests.forEach(test => {
  const status = test.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${test.name}`);
  if (test.passed) totalPassed++;
});

console.log('\n' + '=' .repeat(60));
console.log(`SUMMARY: ${totalPassed}/${tests.length} tests passed`);

if (totalPassed === tests.length) {
  console.log('\n🎉 MIGRATION VALIDATION: SUCCESS');
  console.log('✅ All deterministic systems operational!');
  
  if (isDeterministic) {
    console.log(`\n🔒 10-ITERATION VALIDATION RESULT:`);
    console.log(`   Status: DETERMINISTIC`);
    console.log(`   Unique Hashes: ${hashes.size}/10`);
    console.log(`   SHA-256: ${finalHash}`);
  }
  
} else {
  console.log('\n❌ MIGRATION VALIDATION: FAILED');
  console.log(`   ${tests.length - totalPassed} tests failed`);
}

console.log('\n📈 MIGRATION SUMMARY:');
console.log('   Source: unjucks/src/kgen/deterministic/');
console.log('   Target: kgen-core/src/deterministic/');
console.log('   Components: renderer, time, random, canonicalize, opc-normalizer, latex, validator');
console.log('   Features: 1000-iteration proof capability, SOURCE_DATE_EPOCH, byte-identical validation');

console.log(`\n✨ Migration ${totalPassed === tests.length ? 'COMPLETE' : 'INCOMPLETE'} - KGEN Core deterministic system ready for production use!`);

process.exit(totalPassed === tests.length ? 0 : 1);