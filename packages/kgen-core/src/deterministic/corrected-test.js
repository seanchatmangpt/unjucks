#!/usr/bin/env node

/**
 * Corrected 10-iteration validation test - identical content each time
 */

import crypto from 'crypto';
import { getDeterministicTimestamp } from './time.js';
import { deterministicRandom, validateDeterministicRandom } from './random.js';
import { canonicalStringify } from './canonicalize.js';

console.log('🧪 KGEN Core 10-Iteration SHA-256 Hash Validation (CORRECTED)');
console.log('=' .repeat(60));

console.log('\n🔒 Running 10-iteration deterministic hash test...');
console.log('Each iteration should produce IDENTICAL content and hash\n');

const hashes = new Set();

for (let i = 0; i < 10; i++) {
  // IMPORTANT: All content must be identical for each iteration
  const deterministicContent = `
Timestamp: ${getDeterministicTimestamp()}
UUID: ${deterministicRandom.uuid('test', 'content')}
Random: ${deterministicRandom.random('test-seed')}
Canonical: ${canonicalStringify({ deterministic: true, static: 'value' })}
  `.trim();
  
  const hash = crypto.createHash('sha256').update(deterministicContent).digest('hex');
  hashes.add(hash);
  
  console.log(`   Iteration ${i + 1}: ${hash.substring(0, 16)}...`);
}

const isDeterministic = hashes.size === 1;

console.log('\n' + '=' .repeat(60));
console.log('RESULTS:');
console.log(`Total iterations: 10`);
console.log(`Unique hashes: ${hashes.size}`);

if (isDeterministic) {
  console.log('✅ SUCCESS: All iterations produced identical SHA-256 hash!');
  console.log(`Final SHA-256 Hash: ${Array.from(hashes)[0]}`);
  console.log('\n🎉 DETERMINISTIC VALIDATION: PASSED');
  console.log('Migration of unjucks deterministic system to kgen-core: COMPLETE');
} else {
  console.log('❌ FAILURE: Found multiple different hashes');
  console.log('All hashes found:');
  Array.from(hashes).forEach((hash, idx) => {
    console.log(`   Hash ${idx + 1}: ${hash}`);
  });
}

process.exit(isDeterministic ? 0 : 1);