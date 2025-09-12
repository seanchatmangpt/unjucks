#!/usr/bin/env node

/**
 * Direct CAS Implementation Test
 * Tests the Content-Addressed Storage functionality with real files
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { CASEngine } from '../src/kgen/cas/cas-core.js';

async function testCASDirectly() {
  console.log('🧪 Testing CAS Implementation Directly\n');
  
  const cas = new CASEngine({
    cacheSize: 1000,
    enableMetrics: true,
    performanceTarget: {
      hashTimeP95: 10, // ms
      cacheHitRate: 0.80
    }
  });
  
  const testResults = {
    timestamp: this.getDeterministicDate().toISOString(),
    tests: [],
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  };
  
  // Test 1: Hash Generation with Small File
  try {
    console.log('📝 Test 1: Hash Generation - Small Text File');
    const smallContent = await fs.readFile('tests/cas-test-files/small-text.txt', 'utf8');
    const startTime = performance.now();
    
    const hash = await cas.calculateHash(smallContent);
    const hashTime = performance.now() - startTime;
    
    // Verify with Node.js crypto for validation
    const expectedHash = crypto.createHash('sha256').update(smallContent).digest('hex');
    const hashMatch = hash === expectedHash;
    
    console.log(`   Hash: ${hash}`);
    console.log(`   Expected: ${expectedHash}`);
    console.log(`   Match: ${hashMatch ? '✅' : '❌'}`);
    console.log(`   Time: ${hashTime.toFixed(2)}ms\n`);
    
    testResults.tests.push({
      name: 'Small File Hash Generation',
      passed: hashMatch,
      hash,
      expectedHash,
      hashTime,
      content_length: smallContent.length
    });
    
    if (hashMatch) testResults.summary.passed++;
    else testResults.summary.failed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'Small File Hash Generation',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Test 2: CID Generation
  try {
    console.log('📝 Test 2: CID Generation - JSON Data');
    const jsonContent = await fs.readFile('tests/cas-test-files/json-data.json', 'utf8');
    const startTime = performance.now();
    
    const cid = await cas.generateCID(jsonContent);
    const cidTime = performance.now() - startTime;
    
    console.log(`   CID: ${cid.toString()}`);
    console.log(`   CID Version: ${cid.version}`);
    console.log(`   Codec: ${cid.code}`);
    console.log(`   Hash Algorithm: ${cid.multihash.code}`);
    console.log(`   Time: ${cidTime.toFixed(2)}ms\n`);
    
    testResults.tests.push({
      name: 'CID Generation',
      passed: true,
      cid: cid.toString(),
      cid_version: cid.version,
      codec: cid.code,
      hash_algorithm: cid.multihash.code,
      cidTime,
      content_length: jsonContent.length
    });
    
    testResults.summary.passed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'CID Generation',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Test 3: Storage and Retrieval
  try {
    console.log('📝 Test 3: Storage and Retrieval Operations');
    const testData = "Test content for storage validation";
    const startTime = performance.now();
    
    // Store content
    const storeResult = await cas.store(testData);
    const storeTime = performance.now() - startTime;
    
    // Retrieve content
    const retrieveStart = performance.now();
    const retrieved = await cas.retrieve(storeResult.cid);
    const retrieveTime = performance.now() - retrieveStart;
    
    const textDecoder = new TextDecoder();
    const retrievedText = retrieved ? textDecoder.decode(retrieved) : null;
    const contentMatch = retrievedText === testData;
    
    console.log(`   Stored CID: ${storeResult.cid.toString()}`);
    console.log(`   Retrieved: ${contentMatch ? '✅' : '❌'}`);
    console.log(`   Store Time: ${storeTime.toFixed(2)}ms`);
    console.log(`   Retrieve Time: ${retrieveTime.toFixed(2)}ms\n`);
    
    testResults.tests.push({
      name: 'Storage and Retrieval',
      passed: contentMatch,
      cid: storeResult.cid.toString(),
      content_match: contentMatch,
      store_time: storeTime,
      retrieve_time: retrieveTime,
      was_stored: storeResult.stored
    });
    
    if (contentMatch) testResults.summary.passed++;
    else testResults.summary.failed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'Storage and Retrieval',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Test 4: Content Comparison (Drift Detection)
  try {
    console.log('📝 Test 4: Content Comparison - Drift Detection');
    const content1 = "Original content";
    const content2 = "Modified content";
    const content3 = "Original content"; // Same as content1
    
    const comparison1 = await cas.compareContent(content1, content2);
    const comparison2 = await cas.compareContent(content1, content3);
    
    console.log(`   Different content drift detected: ${comparison1.drift ? '✅' : '❌'}`);
    console.log(`   Same content identical: ${!comparison2.drift ? '✅' : '❌'}`);
    console.log(`   CID1: ${comparison1.cid1.toString()}`);
    console.log(`   CID2: ${comparison1.cid2.toString()}\n`);
    
    const testPassed = comparison1.drift && !comparison2.drift;
    
    testResults.tests.push({
      name: 'Content Comparison',
      passed: testPassed,
      drift_detected_different: comparison1.drift,
      drift_detected_same: comparison2.drift,
      cid1: comparison1.cid1.toString(),
      cid2: comparison1.cid2.toString()
    });
    
    if (testPassed) testResults.summary.passed++;
    else testResults.summary.failed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'Content Comparison',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Test 5: Performance Metrics
  try {
    console.log('📝 Test 5: Performance Metrics and Cache Statistics');
    const metrics = cas.getMetrics();
    
    console.log(`   Cache Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`   Cache Size: ${metrics.cache.size}/${metrics.cache.maxSize}`);
    console.log(`   P95 Hash Time: ${metrics.performance.hashTimeP95.toFixed(2)}ms`);
    console.log(`   Average Hash Time: ${metrics.performance.averageHashTime.toFixed(2)}ms`);
    console.log(`   Meets Hit Rate Target: ${metrics.performance.meetsTargets.hitRate ? '✅' : '❌'}`);
    console.log(`   Meets Hash Time Target: ${metrics.performance.meetsTargets.hashTime ? '✅' : '❌'}\n`);
    
    testResults.tests.push({
      name: 'Performance Metrics',
      passed: true,
      metrics: {
        cache_hit_rate: metrics.cache.hitRate,
        cache_size: metrics.cache.size,
        hash_time_p95: metrics.performance.hashTimeP95,
        average_hash_time: metrics.performance.averageHashTime,
        meets_targets: metrics.performance.meetsTargets
      }
    });
    
    testResults.summary.passed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'Performance Metrics',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Test 6: Garbage Collection
  try {
    console.log('📝 Test 6: Garbage Collection Operations');
    
    // Fill cache beyond capacity
    for (let i = 0; i < 50; i++) {
      await cas.store(`test content ${i}`);
    }
    
    const beforeGC = cas.getMetrics();
    cas.gc(true); // Force GC
    const afterGC = cas.getMetrics();
    
    const entriesRemoved = beforeGC.cache.size - afterGC.cache.size;
    const gcWorked = afterGC.cache.evictions > beforeGC.cache.evictions;
    
    console.log(`   Before GC: ${beforeGC.cache.size} entries`);
    console.log(`   After GC: ${afterGC.cache.size} entries`);
    console.log(`   Entries Removed: ${entriesRemoved}`);
    console.log(`   GC Worked: ${gcWorked ? '✅' : '❌'}\n`);
    
    testResults.tests.push({
      name: 'Garbage Collection',
      passed: gcWorked,
      before_gc_size: beforeGC.cache.size,
      after_gc_size: afterGC.cache.size,
      entries_removed: entriesRemoved,
      evictions: afterGC.cache.evictions
    });
    
    if (gcWorked) testResults.summary.passed++;
    else testResults.summary.failed++;
    testResults.summary.total++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    testResults.tests.push({
      name: 'Garbage Collection',
      passed: false,
      error: error.message
    });
    testResults.summary.failed++;
    testResults.summary.total++;
  }
  
  // Final Summary
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed} ✅`);
  console.log(`Failed: ${testResults.summary.failed} ${testResults.summary.failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
  
  // Write detailed results
  await fs.writeFile('tests/cas-test-results.json', JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed results written to: tests/cas-test-results.json`);
  
  return testResults;
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCASDirectly()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

export { testCASDirectly };