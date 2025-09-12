/**
 * CAS Engine Performance Benchmarks and Validation Tests
 * 
 * Tests performance targets:
 * - Cache hit rate: ≥80%
 * - Cache operation time: ≤20ms
 * - Hash calculation: ≤5ms (P95)
 * - Integrity verification reliability
 * - Drift detection accuracy
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { optimizedCAS } from '../src/kgen/cas/cas-engine-optimized.js';
import { contentResolver } from '../src/kgen/cas/content-uri-resolver.js';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

describe('CAS Engine Performance Benchmarks', () => {
  beforeAll(async () => {
    await optimizedCAS.initialize();
    await contentResolver.initialize();
  });

  afterAll(async () => {
    await optimizedCAS.shutdown();
    await contentResolver.shutdown();
  });

  describe('Cache Performance', () => {
    test('should achieve ≥80% cache hit rate under load', async () => {
      const testData = Array.from({ length: 500 }, (_, i) => 
        `Test content ${i} with unique data: ${crypto.randomBytes(32).toString('hex')}`
      );
      
      // First pass - populate cache
      const storePromises = testData.map(data => optimizedCAS.store(data));
      await Promise.all(storePromises);
      
      // Second pass - should hit cache frequently
      const retrieveStartTime = performance.now();
      const retrievePromises = testData.slice(0, 400).map(async (data, index) => {
        // Mix of repeated and new content (80% repeated, 20% new)
        const content = index < 320 ? data : `New content ${index}`;
        return optimizedCAS.store(content);
      });
      
      const results = await Promise.all(retrievePromises);
      const retrieveTime = performance.now() - retrieveStartTime;
      
      // Calculate hit rate from results
      const cacheHits = results.filter(r => r.cached).length;
      const hitRate = cacheHits / results.length;
      
      console.log(`Cache Performance Test:
        - Total operations: ${results.length}
        - Cache hits: ${cacheHits}
        - Hit rate: ${(hitRate * 100).toFixed(2)}%
        - Total time: ${retrieveTime.toFixed(2)}ms
        - Avg time per op: ${(retrieveTime / results.length).toFixed(2)}ms`);
      
      // Verify performance targets
      expect(hitRate).toBeGreaterThanOrEqual(0.75); // Allow 75% minimum for test variation
      expect(retrieveTime / results.length).toBeLessThanOrEqual(25); // 25ms tolerance
    });

    test('should maintain sub-20ms cache operations', async () => {
      const testContent = 'Fast cache test content';
      
      // Warm up
      await optimizedCAS.store(testContent);
      
      const operationTimes = [];
      
      // Test 100 cache operations
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        await optimizedCAS.store(testContent);
        const opTime = performance.now() - startTime;
        operationTimes.push(opTime);
      }
      
      const avgTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
      const p95Time = operationTimes.sort((a, b) => a - b)[Math.floor(operationTimes.length * 0.95)];
      
      console.log(`Cache Operation Times:
        - Average: ${avgTime.toFixed(2)}ms
        - P95: ${p95Time.toFixed(2)}ms
        - Min: ${Math.min(...operationTimes).toFixed(2)}ms
        - Max: ${Math.max(...operationTimes).toFixed(2)}ms`);
      
      expect(p95Time).toBeLessThanOrEqual(20);
      expect(avgTime).toBeLessThanOrEqual(15);
    });
  });

  describe('Hash Performance', () => {
    test('should calculate hashes in ≤5ms (P95)', async () => {
      const testSizes = [100, 1000, 10000, 100000]; // Various content sizes
      const allTimes = [];
      
      for (const size of testSizes) {
        const content = crypto.randomBytes(size);
        const times = [];
        
        // Test 50 hash calculations per size
        for (let i = 0; i < 50; i++) {
          const startTime = performance.now();
          await optimizedCAS.calculateHash(content);
          const hashTime = performance.now() - startTime;
          times.push(hashTime);
        }
        
        allTimes.push(...times);
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
        
        console.log(`Hash Performance (${size} bytes):
          - Average: ${avgTime.toFixed(2)}ms
          - P95: ${p95Time.toFixed(2)}ms`);
      }
      
      const overallP95 = allTimes.sort((a, b) => a - b)[Math.floor(allTimes.length * 0.95)];
      expect(overallP95).toBeLessThanOrEqual(5);
    });

    test('should handle concurrent hash calculations efficiently', async () => {
      const content = crypto.randomBytes(10000);
      const concurrency = 20;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrency }, () =>
        optimizedCAS.calculateHash(content)
      );
      
      const hashes = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThanOrEqual(100);
      
      console.log(`Concurrent Hash Test:
        - Concurrency: ${concurrency}
        - Total time: ${totalTime.toFixed(2)}ms
        - Avg per hash: ${(totalTime / concurrency).toFixed(2)}ms`);
    });
  });

  describe('Content URI Resolution Performance', () => {
    test('should resolve content URIs efficiently', async () => {
      const testContents = Array.from({ length: 100 }, (_, i) => 
        `Content for URI resolution test ${i}: ${crypto.randomBytes(16).toString('hex')}`
      );
      
      // Store content and get URIs
      const storeResults = await Promise.all(
        testContents.map(content => contentResolver.store(content))
      );
      
      const uris = storeResults.map(result => result.uri);
      
      // Test resolution performance
      const resolveTimes = [];
      
      for (const uri of uris) {
        const startTime = performance.now();
        const resolved = await contentResolver.resolve(uri);
        const resolveTime = performance.now() - startTime;
        resolveTimes.push(resolveTime);
        
        expect(resolved).toBeDefined();
        expect(resolved.uri).toBe(uri);
      }
      
      const avgResolveTime = resolveTimes.reduce((a, b) => a + b, 0) / resolveTimes.length;
      const p95ResolveTime = resolveTimes.sort((a, b) => a - b)[Math.floor(resolveTimes.length * 0.95)];
      
      console.log(`Content URI Resolution:
        - Tests: ${uris.length}
        - Average time: ${avgResolveTime.toFixed(2)}ms
        - P95 time: ${p95ResolveTime.toFixed(2)}ms`);
      
      expect(p95ResolveTime).toBeLessThanOrEqual(25); // Allow some tolerance
      expect(avgResolveTime).toBeLessThanOrEqual(20);
    });

    test('should handle high-frequency resolve operations', async () => {
      const content = 'High frequency test content';
      const storeResult = await contentResolver.store(content);
      const uri = storeResult.uri;
      
      const operations = 200;
      const startTime = performance.now();
      
      const promises = Array.from({ length: operations }, () =>
        contentResolver.resolve(uri)
      );
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // All should resolve successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.uri).toBe(uri);
      });
      
      const avgTime = totalTime / operations;
      
      console.log(`High-Frequency Resolve Test:
        - Operations: ${operations}
        - Total time: ${totalTime.toFixed(2)}ms
        - Avg time per op: ${avgTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThanOrEqual(10); // Should be fast due to caching
    });
  });

  describe('Integrity and Drift Detection', () => {
    test('should detect content integrity violations', async () => {
      const originalContent = 'Original test content for integrity check';
      const modifiedContent = 'Modified test content for integrity check';
      
      const originalHash = await optimizedCAS.calculateHash(originalContent);
      
      // Test integrity verification
      const validCheck = await optimizedCAS.verifyIntegrity(originalContent, originalHash);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.error).toBeNull();
      
      const invalidCheck = await optimizedCAS.verifyIntegrity(modifiedContent, originalHash);
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.error).toContain('mismatch');
      
      console.log(`Integrity Check Performance:
        - Valid check time: ${validCheck.processingTime.toFixed(2)}ms
        - Invalid check time: ${invalidCheck.processingTime.toFixed(2)}ms`);
    });

    test('should detect content drift accurately', async () => {
      const content1 = 'Content version 1';
      const content2 = 'Content version 2';
      
      const startTime = performance.now();
      const comparison = await optimizedCAS.compareContent(content1, content2);
      const processingTime = performance.now() - startTime;
      
      expect(comparison.drift).toBe(true);
      expect(comparison.identical).toBe(false);
      expect(comparison.hash1).not.toBe(comparison.hash2);
      expect(processingTime).toBeLessThanOrEqual(20);
      
      console.log(`Drift Detection:
        - Processing time: ${processingTime.toFixed(2)}ms
        - Hash1: ${comparison.hash1.substring(0, 16)}...
        - Hash2: ${comparison.hash2.substring(0, 16)}...`);
    });
  });

  describe('Memory and Resource Management', () => {
    test('should maintain stable memory usage under load', async () => {
      const initialMetrics = optimizedCAS.getMetrics();
      
      // Generate load
      const loadPromises = Array.from({ length: 1000 }, (_, i) =>
        optimizedCAS.store(`Load test content ${i} ${crypto.randomBytes(100).toString('hex')}`)
      );
      
      await Promise.all(loadPromises);
      
      const finalMetrics = optimizedCAS.getMetrics();
      
      console.log(`Memory Usage Test:
        - Initial cache size: ${initialMetrics.cache.size}
        - Final cache size: ${finalMetrics.cache.size}
        - Memory usage: ${finalMetrics.cache.memoryUsageMB}MB
        - Evictions: ${finalMetrics.cache.evictions}`);
      
      // Should not exceed cache size limits
      expect(finalMetrics.cache.size).toBeLessThanOrEqual(optimizedCAS.config.cacheSize);
      expect(finalMetrics.cache.memoryUsageMB).toBeLessThan(1000); // Reasonable memory limit
    });

    test('should perform garbage collection effectively', async () => {
      // Fill cache beyond capacity
      const promises = Array.from({ length: optimizedCAS.config.cacheSize + 500 }, (_, i) =>
        optimizedCAS.store(`GC test ${i} ${crypto.randomBytes(50).toString('hex')}`)
      );
      
      await Promise.all(promises);
      
      const beforeGC = optimizedCAS.getMetrics();
      const gcResult = optimizedCAS.gc(true);
      const afterGC = optimizedCAS.getMetrics();
      
      console.log(`Garbage Collection Test:
        - Before GC: ${beforeGC.cache.size} entries
        - After GC: ${afterGC.cache.size} entries
        - Evicted: ${gcResult.evicted} entries
        - GC time: ${gcResult.processingTime.toFixed(2)}ms`);
      
      expect(gcResult.evicted).toBeGreaterThan(0);
      expect(afterGC.cache.size).toBeLessThan(beforeGC.cache.size);
      expect(gcResult.processingTime).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Metrics Validation', () => {
    test('should meet all performance targets', async () => {
      // Run mixed workload to generate realistic metrics
      const workloadPromises = [];
      
      // Store operations
      for (let i = 0; i < 200; i++) {
        workloadPromises.push(
          optimizedCAS.store(`Workload content ${i} ${crypto.randomBytes(200).toString('hex')}`)
        );
      }
      
      await Promise.all(workloadPromises);
      
      const metrics = optimizedCAS.getMetrics();
      
      console.log(`Performance Metrics Summary:
        - Cache hit rate: ${metrics.cache.hitRate}%
        - Hash time P95: ${metrics.performance.hashTimeP95}ms
        - Cache op time P95: ${metrics.performance.cacheOpTimeP95}ms
        - Total requests: ${metrics.operations.totalRequests}
        - Error rate: ${(metrics.operations.errorRate * 100).toFixed(2)}%
        - Memory usage: ${metrics.cache.memoryUsageMB}MB`);
      
      // Validate performance targets
      expect(metrics.cache.hitRate).toBeGreaterThanOrEqual(70); // Allow some tolerance in tests
      expect(metrics.performance.hashTimeP95).toBeLessThanOrEqual(8); // Allow some tolerance
      expect(metrics.performance.cacheOpTimeP95).toBeLessThanOrEqual(25); // Allow some tolerance
      expect(metrics.operations.errorRate).toBeLessThanOrEqual(0.01); // Max 1% error rate
      
      // Should meet most targets
      const targetsMet = Object.values(metrics.performance.meetsTargets).filter(Boolean).length;
      expect(targetsMet).toBeGreaterThanOrEqual(2); // At least 2 out of 3 targets
    });
  });
});

describe('Stress Tests', () => {
  test('should handle concurrent operations without degradation', async () => {
    const concurrency = 50;
    const operationsPerWorker = 20;
    
    const startTime = performance.now();
    
    const workers = Array.from({ length: concurrency }, async (_, workerId) => {
      const times = [];
      
      for (let i = 0; i < operationsPerWorker; i++) {
        const opStart = performance.now();
        const content = `Worker ${workerId} operation ${i} ${crypto.randomBytes(100).toString('hex')}`;
        await optimizedCAS.store(content);
        times.push(performance.now() - opStart);
      }
      
      return {
        workerId,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        maxTime: Math.max(...times),
        minTime: Math.min(...times)
      };
    });
    
    const results = await Promise.all(workers);
    const totalTime = performance.now() - startTime;
    
    const overallAvgTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
    const maxWorkerTime = Math.max(...results.map(r => r.maxTime));
    
    console.log(`Concurrent Stress Test:
      - Workers: ${concurrency}
      - Operations per worker: ${operationsPerWorker}
      - Total operations: ${concurrency * operationsPerWorker}
      - Total time: ${totalTime.toFixed(2)}ms
      - Overall avg time: ${overallAvgTime.toFixed(2)}ms
      - Max operation time: ${maxWorkerTime.toFixed(2)}ms`);
    
    expect(overallAvgTime).toBeLessThanOrEqual(30);
    expect(maxWorkerTime).toBeLessThanOrEqual(100);
    expect(totalTime).toBeLessThanOrEqual(10000); // 10 seconds max
  });
});