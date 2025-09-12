#!/usr/bin/env node

/**
 * Simple 10-iteration validation test for KGEN Core deterministic system
 */

import crypto from 'crypto';
import { getDeterministicTimestamp, deterministicRandom, canonicalStringify } from './index.js';

async function runSimpleTest() {
  console.log('🧪 KGEN Core 10-Iteration SHA-256 Hash Validation');
  console.log('='.repeat(50));
  
  const TEST_CONTENT = `Hello World! Time: ${getDeterministicTimestamp()}
UUID: ${deterministicRandom.uuid('test', 'content')}
Random: ${deterministicRandom.random('seed')}
Canonical: ${canonicalStringify({ b: 2, a: 1 })}`;
  
  const hashes = new Set();
  
  console.log('Running 10 iterations...\n');
  
  for (let i = 0; i < 10; i++) {
    // Generate the same content each time (should be deterministic)
    const content = `Hello World! Time: ${getDeterministicTimestamp()}
UUID: ${deterministicRandom.uuid('test', 'content')}
Random: ${deterministicRandom.random('seed')}
Canonical: ${canonicalStringify({ b: 2, a: 1 })}`;
    
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    hashes.add(hash);
    
    console.log(`Iteration ${i + 1}: ${hash.substring(0, 16)}...`);
  }
  
  const isDeterministic = hashes.size === 1;
  
  console.log('\n' + '='.repeat(50));
  console.log('RESULTS:');
  console.log(`Total iterations: 10`);
  console.log(`Unique hashes: ${hashes.size}`);
  
  if (isDeterministic) {
    console.log('✅ DETERMINISTIC: All iterations produced identical SHA-256 hash');
    console.log(`SHA-256: ${Array.from(hashes)[0]}`);
    return true;
  } else {
    console.log('❌ NON-DETERMINISTIC: Found multiple different hashes');
    return false;
  }
}

// Run test
runSimpleTest()
  .then(success => {
    console.log(`\nTest ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });