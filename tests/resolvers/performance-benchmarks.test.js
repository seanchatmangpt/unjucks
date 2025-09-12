/**
 * Performance Benchmark Test Suite for URI Resolvers
 * 
 * Validates Charter performance requirements:
 * - Content resolution < 50ms average, < 100ms maximum
 * - Git operations < 200ms average
 * - Attestation verification < 100ms average
 * - Drift patch application < 150ms average
 * - Memory usage within limits
 * - Concurrent operation handling
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

// Import resolver classes
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import { GitUriResolver } from '../../packages/kgen-core/src/resolvers/git-uri-resolver.js';
import { AttestResolver } from '../../src/kgen/attestation/attest-resolver.js';
import { DriftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';

describe('Performance Benchmark Tests', () => {
  let testDir;
  let resolvers;
  let performanceResults = {};
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), 'perf-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    resolvers = {
      content: new ContentUriResolver({
        casDir: path.join(testDir, 'cas'),
        enableHardlinks: false, // Disable for consistent benchmarking
        enableExtensionPreservation: true,
        cacheSize: 1000,
        integrityChecks: true
      }),
      git: new GitUriResolver({
        cacheDir: path.join(testDir, 'git-cache'),
        enableAttestation: true,
        allowRemoteRepos: false
      }),
      attest: new AttestResolver({
        storageDir: path.join(testDir, 'attest'),
        cacheSize: 500,
        verificationEnabled: true
      }),
      drift: new DriftURIResolver({
        storage: {
          patchDirectory: path.join(testDir, 'patches'),
          maxPatchSize: 10 * 1024 * 1024 // 10MB limit
        },
        performance: {
          cachePatches: true,
          enableCompression: true
        }
      })
    };
    
    // Initialize resolvers
    for (const [name, resolver] of Object.entries(resolvers)) {
      try {
        const startTime = performance.now();
        await resolver.initialize();
        const initTime = performance.now() - startTime;
        
        performanceResults[`${name}_init_time`] = initTime;
      } catch (error) {
        console.warn(`${name} resolver init warning:`, error.message);
      }
    }
  });
  
  afterEach(async () => {
    // Log performance results for analysis
    console.log('Performance Results:', JSON.stringify(performanceResults, null, 2));
    
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Content URI Performance', () => {
    test('should meet Charter requirement: content resolution < 50ms average', async () => {
      const testContent = 'Performance test content for Charter compliance validation';
      const iterations = 100;
      const times = [];
      
      // First, store the content
      const storeResult = await resolvers.content.store(testContent);
      
      // Warm up the cache
      await resolvers.content.resolve(storeResult.uri);
      
      // Clear cache to test cold performance
      resolvers.content.clearCache();
      
      // Benchmark resolution times
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const resolved = await resolvers.content.resolve(storeResult.uri);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        expect(resolved.uri).toBe(storeResult.uri);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      
      performanceResults.content_resolution = {
        average: avgTime,
        maximum: maxTime,
        minimum: minTime,
        p95: p95Time,
        iterations
      };
      
      // Charter requirement: < 50ms average, < 100ms maximum
      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100);
    });

    test('should handle large content efficiently', async () => {
      const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
      const results = {};
      
      for (const size of sizes) {
        const largeContent = 'x'.repeat(size);
        
        const storeStartTime = performance.now();
        const storeResult = await resolvers.content.store(largeContent);
        const storeTime = performance.now() - storeStartTime;
        
        const resolveStartTime = performance.now();
        const resolved = await resolvers.content.resolve(storeResult.uri);
        const resolveTime = performance.now() - resolveStartTime;
        
        results[`${size}_bytes`] = {
          storeTime,
          resolveTime,
          totalTime: storeTime + resolveTime,
          throughputMBps: (size / 1024 / 1024) / ((storeTime + resolveTime) / 1000)
        };
        
        expect(resolved.size).toBe(size);
        
        // Large files should still be handled efficiently
        if (size >= 1048576) { // 1MB
          expect(storeTime + resolveTime).toBeLessThan(5000); // < 5 seconds
        } else {
          expect(storeTime + resolveTime).toBeLessThan(1000); // < 1 second
        }
      }
      
      performanceResults.content_large_files = results;
    });

    test('should demonstrate cache performance improvement', async () => {
      const content = 'Cache performance test content';
      const storeResult = await resolvers.content.store(content);
      const iterations = 50;
      
      // Measure cold cache performance
      resolvers.content.clearCache();
      const coldTimes = [];
      
      for (let i = 0; i < 5; i++) {
        resolvers.content.clearCache();
        const startTime = performance.now();
        await resolvers.content.resolve(storeResult.uri);
        const endTime = performance.now();
        coldTimes.push(endTime - startTime);
      }
      
      // Measure warm cache performance
      const warmTimes = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await resolvers.content.resolve(storeResult.uri);
        const endTime = performance.now();
        warmTimes.push(endTime - startTime);
      }
      
      const coldAvg = coldTimes.reduce((sum, time) => sum + time, 0) / coldTimes.length;
      const warmAvg = warmTimes.reduce((sum, time) => sum + time, 0) / warmTimes.length;
      const speedupRatio = coldAvg / warmAvg;
      
      performanceResults.cache_performance = {
        coldAverage: coldAvg,
        warmAverage: warmAvg,
        speedupRatio
      };
      
      // Warm cache should be significantly faster
      expect(speedupRatio).toBeGreaterThan(2); // At least 2x faster
      expect(warmAvg).toBeLessThan(10); // < 10ms when cached
    });

    test('should handle concurrent operations efficiently', async () => {
      const concurrencyLevels = [1, 5, 10, 20, 50];
      const results = {};
      
      for (const concurrency of concurrencyLevels) {
        const content = 'Concurrent test content';
        const promises = [];
        
        const startTime = performance.now();
        
        // Start concurrent operations
        for (let i = 0; i < concurrency; i++) {
          promises.push(async () => {
            const storeResult = await resolvers.content.store(content + i);
            const resolved = await resolvers.content.resolve(storeResult.uri);
            return resolved.hash === storeResult.hash;
          });
        }
        
        const operationResults = await Promise.all(promises.map(fn => fn()));
        const totalTime = performance.now() - startTime;
        
        const avgTimePerOp = totalTime / concurrency;
        const throughputOpsPerSec = concurrency / (totalTime / 1000);
        
        results[`concurrency_${concurrency}`] = {
          totalTime,
          averageTimePerOperation: avgTimePerOp,
          throughputOpsPerSecond: throughputOpsPerSec,
          allSuccessful: operationResults.every(result => result === true)
        };
        
        expect(operationResults.every(result => result === true)).toBe(true);
        
        // Performance should scale reasonably
        expect(avgTimePerOp).toBeLessThan(500); // < 500ms per operation even at high concurrency
      }
      
      performanceResults.concurrent_operations = results;
    });
  });

  describe('Git URI Performance', () => {
    test('should meet Charter requirement: git operations < 200ms average', async () => {
      const iterations = 20;
      const operations = [];
      
      // Test URI validation performance
      for (let i = 0; i < iterations; i++) {
        const uri = `git://perf-test-${i}@${'a'.repeat(40)}/file-${i}.js`;
        
        const startTime = performance.now();
        const validation = resolvers.git.validateGitUri(uri);
        const endTime = performance.now();
        
        operations.push({
          operation: 'validate',
          time: endTime - startTime,
          success: validation.valid
        });
        
        expect(validation.valid).toBe(true);
      }
      
      // Test URI parsing performance
      for (let i = 0; i < iterations; i++) {
        const uri = `git://parse-test-${i}@${'b'.repeat(40)}/src/index-${i}.ts`;
        
        const startTime = performance.now();
        const parsed = resolvers.git._parseGitUri(uri);
        const endTime = performance.now();
        
        operations.push({
          operation: 'parse',
          time: endTime - startTime,
          success: parsed.type === 'file'
        });
        
        expect(parsed.dir).toBe(`parse-test-${i}`);
      }
      
      // Test URI creation performance
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const uri = resolvers.git.createGitUri(`create-test-${i}`, 'c'.repeat(40), `file-${i}.js`);
        const endTime = performance.now();
        
        operations.push({
          operation: 'create',
          time: endTime - startTime,
          success: uri.includes(`create-test-${i}`)
        });
        
        expect(uri).toMatch(/^git:\/\//);
      }
      
      const avgTime = operations.reduce((sum, op) => sum + op.time, 0) / operations.length;
      const maxTime = Math.max(...operations.map(op => op.time));
      const successRate = operations.filter(op => op.success).length / operations.length;
      
      performanceResults.git_operations = {
        average: avgTime,
        maximum: maxTime,
        successRate,
        totalOperations: operations.length
      };
      
      // Charter requirement: < 200ms average
      expect(avgTime).toBeLessThan(200);
      expect(successRate).toBe(1.0); // 100% success rate
    });

    test('should handle cache operations efficiently', () => {
      const iterations = 1000;
      const cacheOperations = [];
      
      // Test cache key generation performance
      for (let i = 0; i < iterations; i++) {
        const uri = `git://cache-perf-${i}@${'d'.repeat(40)}/cache-test-${i}.js`;
        
        const startTime = performance.now();
        const cacheKey = resolvers.git._generateCacheKey(uri);
        const endTime = performance.now();
        
        cacheOperations.push(endTime - startTime);
        
        expect(cacheKey).toMatch(/^[a-f0-9]{16}$/);
      }
      
      const avgCacheTime = cacheOperations.reduce((sum, time) => sum + time, 0) / iterations;
      const maxCacheTime = Math.max(...cacheOperations);
      
      performanceResults.git_cache_operations = {
        average: avgCacheTime,
        maximum: maxCacheTime,
        iterations
      };
      
      // Cache operations should be very fast
      expect(avgCacheTime).toBeLessThan(1); // < 1ms average
      expect(maxCacheTime).toBeLessThan(10); // < 10ms maximum
    });
  });

  describe('Attestation Performance', () => {
    test('should meet Charter requirement: attestation verification < 100ms average', async () => {
      const iterations = 50;
      const verificationTimes = [];
      
      // Create test attestations
      const testAttestations = [];
      for (let i = 0; i < iterations; i++) {
        const testData = {
          subject: `perf-test-artifact-${i}`,
          timestamp: this.getDeterministicDate().toISOString(),
          validator: 'performance-suite',
          claims: [`urn:perf:test-${i}`, 'urn:perf:benchmark']
        };
        
        const attestation = await resolvers.attest.createAttestation(testData, {
          issuer: 'performance-authority',
          includeContent: false
        });
        
        testAttestations.push(attestation);
      }
      
      // Benchmark verification times
      for (const attestation of testAttestations) {
        const hash = crypto.createHash('sha256')
          .update(JSON.stringify(attestation))
          .digest('hex');
        
        const startTime = performance.now();
        const verification = await resolvers.attest.verifyAttestation(attestation, hash);
        const endTime = performance.now();
        
        const verifyTime = endTime - startTime;
        verificationTimes.push(verifyTime);
        
        expect(verification.valid).toBe(true);
      }
      
      const avgTime = verificationTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...verificationTimes);
      const p95Time = verificationTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      
      performanceResults.attestation_verification = {
        average: avgTime,
        maximum: maxTime,
        p95: p95Time,
        iterations
      };
      
      // Charter requirement: < 100ms average
      expect(avgTime).toBeLessThan(100);
    });

    test('should create attestations efficiently', async () => {
      const iterations = 30;
      const creationTimes = [];
      const storeTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const testData = {
          subject: `creation-perf-test-${i}`,
          validator: 'creation-benchmark',
          data: { iteration: i, timestamp: this.getDeterministicTimestamp() }
        };
        
        // Benchmark attestation creation
        const createStartTime = performance.now();
        const attestation = await resolvers.attest.createAttestation(testData, {
          issuer: 'creation-authority'
        });
        const createEndTime = performance.now();
        
        creationTimes.push(createEndTime - createStartTime);
        
        // Benchmark attestation storage
        const storeStartTime = performance.now();
        const uri = await resolvers.attest.store(attestation);
        const storeEndTime = performance.now();
        
        storeTimes.push(storeEndTime - storeStartTime);
        
        expect(uri).toMatch(/^attest:\/\//);
      }
      
      const avgCreateTime = creationTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const avgStoreTime = storeTimes.reduce((sum, time) => sum + time, 0) / iterations;
      
      performanceResults.attestation_creation = {
        averageCreateTime: avgCreateTime,
        averageStoreTime: avgStoreTime,
        totalAverage: avgCreateTime + avgStoreTime,
        iterations
      };
      
      // Attestation creation should be reasonably fast
      expect(avgCreateTime + avgStoreTime).toBeLessThan(200); // < 200ms total
    });
  });

  describe('Drift URI Performance', () => {
    test('should meet Charter requirement: patch application < 150ms average', async () => {
      const iterations = 20;
      const applicationTimes = [];
      
      // Create test data pairs for patching
      const testCases = [];
      for (let i = 0; i < iterations; i++) {
        const baseline = {
          id: `entity-${i}`,
          version: '1.0.0',
          data: {
            counter: i * 10,
            items: Array(i + 1).fill().map((_, idx) => `item-${idx}`),
            metadata: { created: '2024-01-01', updated: '2024-01-01' }
          }
        };
        
        const modified = {
          ...baseline,
          version: '1.1.0',
          data: {
            ...baseline.data,
            counter: baseline.data.counter + 5,
            items: [...baseline.data.items, `new-item-${i}`],
            metadata: { ...baseline.data.metadata, updated: '2024-01-02' }
          }
        };
        
        testCases.push({ baseline, modified });
      }
      
      // Create patches
      const patches = [];
      for (const { baseline, modified } of testCases) {
        const patchResult = await resolvers.drift.storePatch(baseline, modified);
        patches.push({ patch: patchResult.patch, baseline });
      }
      
      // Benchmark patch application
      for (const { patch, baseline } of patches) {
        const startTime = performance.now();
        const applyResult = await resolvers.drift.applyPatch(baseline, patch);
        const endTime = performance.now();
        
        const applyTime = endTime - startTime;
        applicationTimes.push(applyTime);
        
        expect(applyResult.result).toBeDefined();
        expect(applyResult.metadata.baselineHash).toBeDefined();
      }
      
      const avgTime = applicationTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...applicationTimes);
      
      performanceResults.patch_application = {
        average: avgTime,
        maximum: maxTime,
        iterations
      };
      
      // Charter requirement: < 150ms average
      expect(avgTime).toBeLessThan(150);
    });

    test('should generate patches efficiently', async () => {
      const iterations = 25;
      const generationTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const baseline = {
          entity: `perf-entity-${i}`,
          data: Array(50).fill().map((_, idx) => ({ id: idx, value: idx * 2 })),
          config: { mode: 'baseline', version: i }
        };
        
        const modified = {
          ...baseline,
          data: baseline.data.map(item => ({ ...item, value: item.value + 1 })),
          config: { ...baseline.config, mode: 'modified', lastUpdate: this.getDeterministicTimestamp() }
        };
        
        const startTime = performance.now();
        const patchResult = await resolvers.drift.storePatch(baseline, modified, {
          source: `performance-test-${i}`
        });
        const endTime = performance.now();
        
        generationTimes.push(endTime - startTime);
        
        expect(patchResult.uri).toMatch(/^drift:\/\//);
        expect(patchResult.patch).toBeDefined();
      }
      
      const avgTime = generationTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...generationTimes);
      
      performanceResults.patch_generation = {
        average: avgTime,
        maximum: maxTime,
        iterations
      };
      
      // Patch generation should be efficient
      expect(avgTime).toBeLessThan(300); // < 300ms average
    });

    test('should handle complex object diffs efficiently', async () => {
      const complexBaseline = {
        schema: 'complex-schema-v1',
        entities: Array(100).fill().map((_, i) => ({
          id: `entity-${i}`,
          type: i % 3 === 0 ? 'TypeA' : i % 3 === 1 ? 'TypeB' : 'TypeC',
          properties: {
            name: `Entity ${i}`,
            values: Array(10).fill().map((_, j) => i * 10 + j),
            metadata: {
              created: new Date(2024, 0, i % 31 + 1).toISOString(),
              tags: [`tag-${i % 5}`, `category-${i % 3}`]
            }
          }
        })),
        relationships: Array(50).fill().map((_, i) => ({
          from: `entity-${i}`,
          to: `entity-${(i + 1) % 100}`,
          type: 'relates-to'
        }))
      };
      
      const complexModified = {
        ...complexBaseline,
        entities: complexBaseline.entities.map((entity, i) => ({
          ...entity,
          properties: {
            ...entity.properties,
            values: [...entity.properties.values, 999], // Add value to each
            metadata: {
              ...entity.properties.metadata,
              updated: this.getDeterministicDate().toISOString()
            }
          }
        })),
        relationships: [
          ...complexBaseline.relationships,
          { from: 'entity-0', to: 'entity-99', type: 'new-relationship' }
        ]
      };
      
      const startTime = performance.now();
      const complexPatchResult = await resolvers.drift.storePatch(
        complexBaseline, 
        complexModified,
        { source: 'complex-perf-test' }
      );
      const patchTime = performance.now() - startTime;
      
      const applyStartTime = performance.now();
      const applyResult = await resolvers.drift.applyPatch(
        complexBaseline, 
        complexPatchResult.patch
      );
      const applyTime = performance.now() - applyStartTime;
      
      performanceResults.complex_object_diff = {
        patchTime,
        applyTime,
        totalTime: patchTime + applyTime,
        entityCount: complexBaseline.entities.length,
        relationshipCount: complexBaseline.relationships.length
      };
      
      expect(applyResult.result).toBeDefined();
      expect(applyResult.result.entities).toHaveLength(100);
      
      // Complex diffs should still be handled efficiently
      expect(patchTime + applyTime).toBeLessThan(2000); // < 2 seconds
    });
  });

  describe('Memory Usage Performance', () => {
    test('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const operations = [];
      const contentCount = 100;
      
      for (let i = 0; i < contentCount; i++) {
        const content = `Memory test content ${i}: ` + 'x'.repeat(1024 * 10); // 10KB each
        operations.push(resolvers.content.store(content));
      }
      
      const storeResults = await Promise.all(operations);
      
      // Resolve all stored content
      const resolveOperations = storeResults.map(result => 
        resolvers.content.resolve(result.uri)
      );
      
      await Promise.all(resolveOperations);
      
      const peakMemory = process.memoryUsage();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      const memoryAfterGC = finalMemory.heapUsed - initialMemory.heapUsed;
      
      performanceResults.memory_usage = {
        initialHeapMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        peakHeapMB: Math.round(peakMemory.heapUsed / 1024 / 1024),
        finalHeapMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024),
        memoryAfterGCMB: Math.round(memoryAfterGC / 1024 / 1024),
        contentCount
      };
      
      // Memory usage should be reasonable (< 100MB for 100 * 10KB = 1MB of content)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB
    });

    test('should handle cache memory efficiently', async () => {
      const cacheTestResolver = new ContentUriResolver({
        casDir: path.join(testDir, 'cache-memory-test'),
        cacheSize: 1000, // Large cache for testing
        enableHardlinks: false
      });
      
      await cacheTestResolver.initialize();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Fill cache with content
      const cacheOperations = [];
      for (let i = 0; i < 500; i++) {
        const content = `Cache memory test ${i}: ` + 'data'.repeat(100);
        cacheOperations.push(async () => {
          const result = await cacheTestResolver.store(content);
          await cacheTestResolver.resolve(result.uri); // Cache the result
          return result;
        });
      }
      
      await Promise.all(cacheOperations.map(op => op()));
      
      const cacheMemory = process.memoryUsage().heapUsed;
      const cacheStats = cacheTestResolver.getStats();
      
      // Clear cache
      cacheTestResolver.clearCache();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const clearedMemory = process.memoryUsage().heapUsed;
      
      performanceResults.cache_memory = {
        initialMemoryMB: Math.round(initialMemory / 1024 / 1024),
        cacheMemoryMB: Math.round(cacheMemory / 1024 / 1024),
        clearedMemoryMB: Math.round(clearedMemory / 1024 / 1024),
        cacheSize: cacheStats.cache.contentCacheSize,
        cacheHitRate: cacheStats.cache.hitRate
      };
      
      // Cache memory should be bounded
      const cacheMemoryIncrease = cacheMemory - initialMemory;
      expect(cacheMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB for cache
    });
  });

  describe('Stress Testing', () => {
    test('should maintain performance under sustained load', async () => {
      const sustainedLoadDuration = 5000; // 5 seconds
      const startTime = this.getDeterministicTimestamp();
      const operations = [];
      let operationCount = 0;
      
      // Run operations continuously for the duration
      while (this.getDeterministicTimestamp() - startTime < sustainedLoadDuration) {
        const content = `Sustained load test ${operationCount}: ${this.getDeterministicTimestamp()}`;
        
        const operationPromise = (async () => {
          const storeResult = await resolvers.content.store(content);
          const resolveResult = await resolvers.content.resolve(storeResult.uri);
          return resolveResult.hash === storeResult.hash;
        })();
        
        operations.push(operationPromise);
        operationCount++;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const actualDuration = this.getDeterministicTimestamp() - startTime;
      const results = await Promise.all(operations);
      const successCount = results.filter(result => result === true).length;
      const successRate = successCount / operationCount;
      const throughput = operationCount / (actualDuration / 1000);
      
      performanceResults.sustained_load = {
        durationMs: actualDuration,
        operationCount,
        successCount,
        successRate,
        throughputOpsPerSecond: throughput
      };
      
      // Should maintain high success rate under load
      expect(successRate).toBeGreaterThan(0.95); // > 95% success rate
      expect(throughput).toBeGreaterThan(10); // > 10 ops/second
    });
  });
});