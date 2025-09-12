#!/usr/bin/env node
/**
 * CAS Engine Validation Script
 * 
 * Tests the basic functionality of the ported CAS engine
 */

import { createCAS, cas } from '../packages/kgen-core/src/cas/index.js';
import { promises as fs } from 'fs';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testMemoryStorage() {
  console.log('\n=== Testing Memory Storage ===');
  
  try {
    const engine = createCAS({ storageType: 'memory' });
    await engine.initialize();
    
    // Test content storage and retrieval
    const testContent = 'Hello, CAS World!';
    log('yellow', `Storing content: "${testContent}"`);
    
    const hash = await engine.store(testContent);
    log('green', `✓ Content stored with hash: ${hash}`);
    
    const retrieved = await engine.retrieve(hash);
    const retrievedText = retrieved.toString('utf8');
    
    if (retrievedText === testContent) {
      log('green', `✓ Content retrieved successfully: "${retrievedText}"`);
    } else {
      log('red', `✗ Content mismatch: expected "${testContent}", got "${retrievedText}"`);
      return false;
    }
    
    // Test hash verification
    const isValid = engine.verify(hash, testContent);
    if (isValid) {
      log('green', '✓ Hash verification passed');
    } else {
      log('red', '✗ Hash verification failed');
      return false;
    }
    
    // Test metrics
    const metrics = engine.getMetrics();
    log('green', `✓ Metrics: ${metrics.stores} stores, ${metrics.retrievals} retrievals, ${metrics.hitRate}% hit rate`);
    
    return true;
    
  } catch (error) {
    log('red', `✗ Memory storage test failed: ${error.message}`);
    return false;
  }
}

async function testFileStorage() {
  console.log('\n=== Testing File Storage ===');
  const testDir = './test-cas-validation';
  
  try {
    const engine = createCAS({ 
      storageType: 'file',
      basePath: testDir
    });
    await engine.initialize();
    
    // Test content storage
    const testContent = 'File storage test content!';
    log('yellow', `Storing content in file system: "${testContent}"`);
    
    const hash = await engine.store(testContent);
    log('green', `✓ Content stored with hash: ${hash}`);
    
    // Verify file exists
    const prefix = hash.substring(0, 2);
    const suffix = hash.substring(2);
    const expectedPath = `${testDir}/${prefix}/${suffix}`;
    
    try {
      await fs.access(expectedPath);
      log('green', `✓ File exists at expected path: ${expectedPath}`);
    } catch {
      log('red', `✗ File not found at expected path: ${expectedPath}`);
      return false;
    }
    
    // Test retrieval
    const retrieved = await engine.retrieve(hash);
    const retrievedText = retrieved.toString('utf8');
    
    if (retrievedText === testContent) {
      log('green', `✓ Content retrieved from file: "${retrievedText}"`);
    } else {
      log('red', `✗ File content mismatch`);
      return false;
    }
    
    // Cleanup
    await engine.clear(true);
    try {
      await fs.rmdir(testDir, { recursive: true });
      log('green', '✓ Test directory cleaned up');
    } catch {}
    
    return true;
    
  } catch (error) {
    log('red', `✗ File storage test failed: ${error.message}`);
    
    // Cleanup on error
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch {}
    
    return false;
  }
}

async function testUtilityFunctions() {
  console.log('\n=== Testing Utility Functions ===');
  
  try {
    const testContent = 'Utility test content';
    
    // Test hash calculation
    const hash = cas.hash(testContent);
    if (hash && hash.length === 64) {
      log('green', `✓ Hash calculated: ${hash}`);
    } else {
      log('red', '✗ Hash calculation failed');
      return false;
    }
    
    // Test verification
    const isValid = cas.verify(hash, testContent);
    if (isValid) {
      log('green', '✓ Verification passed');
    } else {
      log('red', '✗ Verification failed');
      return false;
    }
    
    // Test store and retrieve utilities
    const storeHash = await cas.store(testContent);
    if (storeHash === hash) {
      log('green', `✓ Store utility returned consistent hash`);
    } else {
      log('red', '✗ Store utility hash mismatch');
      return false;
    }
    
    const retrieved = await cas.retrieve(storeHash);
    const retrievedText = retrieved.toString('utf8');
    
    if (retrievedText === testContent) {
      log('green', `✓ Retrieve utility successful`);
    } else {
      log('red', '✗ Retrieve utility failed');
      return false;
    }
    
    return true;
    
  } catch (error) {
    log('red', `✗ Utility functions test failed: ${error.message}`);
    return false;
  }
}

async function testBinaryContent() {
  console.log('\n=== Testing Binary Content ===');
  
  try {
    const engine = createCAS({ storageType: 'memory' });
    await engine.initialize();
    
    // Test binary data
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
    log('yellow', `Storing binary data: [${Array.from(binaryData).join(', ')}]`);
    
    const hash = await engine.store(binaryData);
    log('green', `✓ Binary data stored with hash: ${hash}`);
    
    const retrieved = await engine.retrieve(hash);
    
    if (Buffer.compare(retrieved, binaryData) === 0) {
      log('green', `✓ Binary data retrieved correctly`);
    } else {
      log('red', '✗ Binary data corruption detected');
      return false;
    }
    
    return true;
    
  } catch (error) {
    log('red', `✗ Binary content test failed: ${error.message}`);
    return false;
  }
}

async function runValidation() {
  console.log('🚀 Starting CAS Engine Validation');
  
  const tests = [
    { name: 'Memory Storage', fn: testMemoryStorage },
    { name: 'File Storage', fn: testFileStorage },
    { name: 'Utility Functions', fn: testUtilityFunctions },
    { name: 'Binary Content', fn: testBinaryContent }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        log('green', `\n✅ ${test.name} - PASSED`);
      } else {
        failed++;
        log('red', `\n❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      failed++;
      log('red', `\n❌ ${test.name} - ERROR: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  if (failed === 0) {
    log('green', `🎉 ALL TESTS PASSED! (${passed}/${tests.length})`);
    log('green', '✅ CAS Engine is ready for use in kgen-core');
  } else {
    log('red', `❌ ${failed} tests failed, ${passed} tests passed`);
    process.exit(1);
  }
}

// Run validation
runValidation().catch(error => {
  log('red', `Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
