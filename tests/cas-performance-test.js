#!/usr/bin/env node

/**
 * CAS Performance and Validation Test
 * Comprehensive testing of Content-Addressed Storage with real file operations
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { CASEngine } from '../src/kgen/cas/cas-core.js';

async function performanceTest() {
  console.log('🚀 CAS Performance and Validation Test\n');
  
  const cas = new CASEngine({
    cacheSize: 5000,
    enableMetrics: true,
    performanceTarget: {
      hashTimeP95: 5, // ms
      cacheHitRate: 0.80
    }
  });
  
  const results = {
    timestamp: this.getDeterministicDate().toISOString(),
    test_environment: {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    performance_tests: [],
    validation_tests: [],
    cache_tests: [],
    summary: {
      performance_passed: 0,
      validation_passed: 0,
      cache_passed: 0,
      total_tests: 0
    }
  };
  
  // Performance Test 1: Hash Speed with Different File Sizes
  console.log('⚡ Performance Test 1: Hash Speed vs File Size');
  
  const testSizes = [
    { name: 'tiny', content: 'x'.repeat(10) },
    { name: 'small', content: 'x'.repeat(1000) },
    { name: 'medium', content: 'x'.repeat(10000) },
    { name: 'large', content: 'x'.repeat(100000) }
  ];
  
  for (const test of testSizes) {
    try {
      const times = [];
      const iterations = 10;
      
      // Warm up
      await cas.calculateHash(test.content);
      
      // Measure
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await cas.calculateHash(test.content);
        times.push(performance.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      const throughput = test.content.length / (avgTime / 1000); // bytes per second
      
      console.log(`   ${test.name} (${test.content.length} bytes):`);
      console.log(`     Average: ${avgTime.toFixed(2)}ms`);
      console.log(`     P95: ${p95Time.toFixed(2)}ms`);
      console.log(`     Throughput: ${(throughput / 1024 / 1024).toFixed(2)} MB/s`);
      
      const performancePassed = p95Time <= cas.config.performanceTarget.hashTimeP95;
      console.log(`     Performance: ${performancePassed ? '✅' : '❌'}\n`);
      
      results.performance_tests.push({
        name: `Hash Speed - ${test.name}`,
        content_size: test.content.length,
        average_time: avgTime,
        p95_time: p95Time,
        throughput_mbps: throughput / 1024 / 1024,
        performance_target_met: performancePassed,
        iterations
      });
      
      if (performancePassed) results.summary.performance_passed++;
      results.summary.total_tests++;
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}\n`);
      results.performance_tests.push({
        name: `Hash Speed - ${test.name}`,
        error: error.message
      });
    }
  }
  
  // Performance Test 2: Cache Hit Rate Optimization
  console.log('💾 Performance Test 2: Cache Hit Rate Optimization');
  
  try {
    const testContent = 'Repeated content for cache testing';
    const cacheTestIterations = 100;
    
    // Clear metrics
    cas.cacheStats = { hits: 0, misses: 0, evictions: 0, totalRequests: 0 };
    
    // First round - populate cache
    for (let i = 0; i < 10; i++) {
      await cas.generateCID(testContent + i);
    }
    
    // Second round - should hit cache frequently
    for (let i = 0; i < cacheTestIterations; i++) {
      await cas.generateCID(testContent + (i % 10)); // Repeat content
    }
    
    const metrics = cas.getMetrics();
    const hitRate = metrics.cache.hitRate;
    const hitRateTarget = cas.config.performanceTarget.cacheHitRate;
    const hitRatePassed = hitRate >= hitRateTarget;
    
    console.log(`   Cache Hit Rate: ${(hitRate * 100).toFixed(1)}%`);
    console.log(`   Target: ${(hitRateTarget * 100).toFixed(1)}%`);
    console.log(`   Cache Performance: ${hitRatePassed ? '✅' : '❌'}\n`);
    
    results.cache_tests.push({
      name: 'Cache Hit Rate Optimization',
      hit_rate: hitRate,
      target_hit_rate: hitRateTarget,
      performance_target_met: hitRatePassed,
      cache_hits: metrics.cache.hits,
      cache_misses: metrics.cache.misses,
      cache_size: metrics.cache.size
    });
    
    if (hitRatePassed) results.summary.cache_passed++;
    results.summary.total_tests++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    results.cache_tests.push({
      name: 'Cache Hit Rate Optimization',
      error: error.message
    });
  }
  
  // Validation Test 1: Hash Consistency Across Runs
  console.log('🔍 Validation Test 1: Hash Consistency');
  
  try {
    const testContent = 'Consistency test content with special chars: åéîöü\n多字节字符测试';
    const hashes = [];
    
    for (let i = 0; i < 5; i++) {
      const hash = await cas.calculateHash(testContent);
      hashes.push(hash);
    }
    
    const allSame = hashes.every(h => h === hashes[0]);
    const nodeHash = crypto.createHash('sha256').update(testContent).digest('hex');
    const matchesNode = hashes[0] === nodeHash;
    
    console.log(`   All hashes identical: ${allSame ? '✅' : '❌'}`);
    console.log(`   Matches Node.js crypto: ${matchesNode ? '✅' : '❌'}`);
    console.log(`   Hash: ${hashes[0]}`);
    console.log(`   Expected: ${nodeHash}\n`);
    
    const validationPassed = allSame && matchesNode;
    
    results.validation_tests.push({
      name: 'Hash Consistency',
      all_hashes_identical: allSame,
      matches_nodejs_crypto: matchesNode,
      test_passed: validationPassed,
      hash_value: hashes[0],
      expected_hash: nodeHash,
      test_runs: hashes.length
    });
    
    if (validationPassed) results.summary.validation_passed++;
    results.summary.total_tests++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    results.validation_tests.push({
      name: 'Hash Consistency',
      error: error.message
    });
  }
  
  // Validation Test 2: Real File Hash Validation
  console.log('📁 Validation Test 2: Real File Hash Validation');
  
  try {
    const testFiles = [
      'tests/cas-test-files/small-text.txt',
      'tests/cas-test-files/json-data.json',
      'tests/cas-test-files/large-content.txt'
    ];
    
    for (const filePath of testFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const casHash = await cas.calculateHash(content);
        const nodeHash = crypto.createHash('sha256').update(content).digest('hex');
        const fileSize = (await fs.stat(filePath)).size;
        
        const hashMatches = casHash === nodeHash;
        console.log(`   ${path.basename(filePath)} (${fileSize} bytes): ${hashMatches ? '✅' : '❌'}`);
        
        results.validation_tests.push({
          name: `File Hash - ${path.basename(filePath)}`,
          file_path: filePath,
          file_size: fileSize,
          hash_matches: hashMatches,
          cas_hash: casHash,
          node_hash: nodeHash
        });
        
        if (hashMatches) results.summary.validation_passed++;
        results.summary.total_tests++;
      } catch (fileError) {
        console.log(`   ${path.basename(filePath)}: ❌ ${fileError.message}`);
        results.validation_tests.push({
          name: `File Hash - ${path.basename(filePath)}`,
          file_path: filePath,
          error: fileError.message
        });
      }
    }
    console.log();
  } catch (error) {
    console.log(`   ❌ Overall error: ${error.message}\n`);
  }
  
  // Cache Test: Garbage Collection Validation
  console.log('🗑️ Cache Test: Garbage Collection Validation');
  
  try {
    // Fill cache with many entries
    const originalSize = cas.cache.size;
    const contentPrefix = 'GC test content - ';
    
    // Add entries beyond cache limit
    const entriesToAdd = cas.config.cacheSize + 100;
    for (let i = 0; i < entriesToAdd; i++) {
      await cas.store(contentPrefix + i);
    }
    
    const beforeGC = cas.cache.size;
    const beforeEvictions = cas.cacheStats.evictions;
    
    // Force garbage collection
    cas.gc(true);
    
    const afterGC = cas.cache.size;
    const afterEvictions = cas.cacheStats.evictions;
    
    const entriesEvicted = afterEvictions - beforeEvictions;
    const sizeReduced = beforeGC > afterGC;
    const gcWorked = entriesEvicted > 0;
    
    console.log(`   Entries before GC: ${beforeGC}`);
    console.log(`   Entries after GC: ${afterGC}`);
    console.log(`   Entries evicted: ${entriesEvicted}`);
    console.log(`   Size reduced: ${sizeReduced ? '✅' : '❌'}`);
    console.log(`   GC functional: ${gcWorked ? '✅' : '❌'}\n`);
    
    results.cache_tests.push({
      name: 'Garbage Collection Validation',
      entries_before_gc: beforeGC,
      entries_after_gc: afterGC,
      entries_evicted: entriesEvicted,
      size_reduced: sizeReduced,
      gc_functional: gcWorked,
      cache_limit: cas.config.cacheSize
    });
    
    if (gcWorked) results.summary.cache_passed++;
    results.summary.total_tests++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    results.cache_tests.push({
      name: 'Garbage Collection Validation',
      error: error.message
    });
  }
  
  // Final Summary
  console.log('📊 Comprehensive Test Results');
  console.log('='.repeat(60));
  console.log(`Performance Tests: ${results.summary.performance_passed}/${results.performance_tests.length} passed`);
  console.log(`Validation Tests: ${results.summary.validation_passed}/${results.validation_tests.length} passed`);
  console.log(`Cache Tests: ${results.summary.cache_passed}/${results.cache_tests.length} passed`);
  console.log(`Overall: ${results.summary.performance_passed + results.summary.validation_passed + results.summary.cache_passed}/${results.summary.total_tests} passed`);
  
  const overallSuccessRate = ((results.summary.performance_passed + results.summary.validation_passed + results.summary.cache_passed) / results.summary.total_tests) * 100;
  console.log(`Success Rate: ${overallSuccessRate.toFixed(1)}%`);
  
  // Get final system metrics
  const finalMetrics = cas.getMetrics();
  console.log(`\\nFinal System State:`);
  console.log(`Cache Hit Rate: ${(finalMetrics.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`Cache Utilization: ${finalMetrics.cache.size}/${finalMetrics.cache.maxSize} (${((finalMetrics.cache.size / finalMetrics.cache.maxSize) * 100).toFixed(1)}%)`);
  console.log(`Average Hash Time: ${finalMetrics.performance.averageHashTime.toFixed(2)}ms`);
  
  results.final_metrics = finalMetrics;
  
  // Write comprehensive results
  await fs.writeFile('tests/cas-performance-results.json', JSON.stringify(results, null, 2));
  console.log(`\\nDetailed results: tests/cas-performance-results.json`);
  
  return results;
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  performanceTest()
    .then((results) => {
      const successRate = ((results.summary.performance_passed + results.summary.validation_passed + results.summary.cache_passed) / results.summary.total_tests) * 100;
      process.exit(successRate >= 80 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

export { performanceTest };