/**
 * Cache Behavior Tests
 * Tests cache hit/miss behavior, invalidation, and performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { CacheManager } from '../../src/cache/manager.js';
import { KGenEngine } from '../../src/engine.js';

describe('Cache Behavior', () => {
  let cacheManager;
  let engine;
  let cacheDir;
  let testData;

  beforeEach(() => {
    cacheDir = testUtils.createTempDir();
    
    cacheManager = new CacheManager({
      cacheDir,
      maxSize: '100MB',
      ttl: 3600000, // 1 hour
      enableCompression: true
    });
    
    engine = new KGenEngine({
      mode: 'test',
      cache: {
        enabled: true,
        manager: cacheManager
      }
    });
    
    testData = {
      simpleGraph: readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'simple-person.ttl'), 'utf-8'),
      complexGraph: readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'complex-hierarchy.ttl'), 'utf-8'),
      personTemplate: JSON.parse(readFileSync(resolve(__TEST_FIXTURES__, 'templates', 'person-template.json'), 'utf-8'))
    };
  });

  afterEach(() => {
    testUtils.cleanupTempDir(cacheDir);
  });

  describe('cache key generation', () => {
    it('should generate deterministic cache keys', () => {
      const input1 = { graph: 'test-graph', template: 'test-template' };
      const input2 = { graph: 'test-graph', template: 'test-template' };
      const input3 = { graph: 'different-graph', template: 'test-template' };
      
      const key1 = cacheManager.generateKey(input1);
      const key2 = cacheManager.generateKey(input2);
      const key3 = cacheManager.generateKey(input3);
      
      expect(key1).toBe(key2); // Same input = same key
      expect(key1).not.toBe(key3); // Different input = different key
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA-256 hash
    });

    it('should include all relevant parameters in key', () => {
      const baseInput = { graph: 'test', template: 'test' };
      const inputWithOptions = { ...baseInput, options: { deterministic: true } };
      const inputWithDifferentOptions = { ...baseInput, options: { deterministic: false } };
      
      const key1 = cacheManager.generateKey(baseInput);
      const key2 = cacheManager.generateKey(inputWithOptions);
      const key3 = cacheManager.generateKey(inputWithDifferentOptions);
      
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
    });

    it('should normalize input for consistent keys', () => {
      const input1 = { graph: 'test', template: 'template', extra: undefined };
      const input2 = { template: 'template', graph: 'test' }; // Different order
      const input3 = { graph: 'test', template: 'template', extra: null };
      
      const key1 = cacheManager.generateKey(input1);
      const key2 = cacheManager.generateKey(input2);
      const key3 = cacheManager.generateKey(input3);
      
      expect(key1).toBe(key2); // Order shouldn't matter
      expect(key1).toBe(key3); // Null/undefined should be normalized
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve cache entries', async () => {
      const key = 'test-cache-key';
      const data = { result: 'test-data', timestamp: Date.now() };
      
      // Store data
      const stored = await cacheManager.set(key, data);
      expect(stored.success).toBe(true);
      
      // Retrieve data
      const retrieved = await cacheManager.get(key);
      expect(retrieved.found).toBe(true);
      expect(retrieved.data).toEqual(data);
      expect(retrieved.metadata.createdAt).toBeDefined();
    });

    it('should handle cache misses', async () => {
      const result = await cacheManager.get('nonexistent-key');
      
      expect(result.found).toBe(false);
      expect(result.data).toBeNull();
      expect(result.reason).toBe('not_found');
    });

    it('should respect TTL settings', async () => {
      const shortTTLCache = new CacheManager({
        cacheDir: testUtils.createTempDir(),
        ttl: 100 // 100ms TTL
      });
      
      const key = 'ttl-test-key';
      const data = { test: 'data' };
      
      // Store data
      await shortTTLCache.set(key, data);
      
      // Should be found immediately
      const immediate = await shortTTLCache.get(key);
      expect(immediate.found).toBe(true);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      const expired = await shortTTLCache.get(key);
      expect(expired.found).toBe(false);
      expect(expired.reason).toBe('expired');
    }, 1000);

    it('should handle concurrent access safely', async () => {
      const key = 'concurrent-test-key';
      const data = { test: 'concurrent-data' };
      
      // Start multiple concurrent operations
      const operations = [];
      
      // Multiple sets
      for (let i = 0; i < 10; i++) {
        operations.push(cacheManager.set(`${key}-${i}`, { ...data, index: i }));
      }
      
      // Multiple gets (some will miss)
      for (let i = 0; i < 10; i++) {
        operations.push(cacheManager.get(`${key}-${i}`));
      }
      
      const results = await Promise.all(operations);
      
      // All operations should complete without errors
      expect(results).toHaveLength(20);
      expect(results.every(r => r.success !== false || r.found !== undefined)).toBe(true);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache when input changes', async () => {
      await engine.initialize();
      
      const generateOptions = {
        graph: testData.simpleGraph,
        template: testData.personTemplate,
        outputPath: resolve(cacheDir, 'test-output.ts')
      };
      
      // First generation - cache miss
      const result1 = await engine.generate(generateOptions);
      expect(result1.success).toBe(true);
      expect(result1.cacheHit).toBe(false);
      
      // Second generation - cache hit
      const result2 = await engine.generate(generateOptions);
      expect(result2.success).toBe(true);
      expect(result2.cacheHit).toBe(true);
      
      // Modify graph and regenerate - cache miss
      const modifiedOptions = {
        ...generateOptions,
        graph: testData.simpleGraph.replace('John Doe', 'Jane Doe')
      };
      
      const result3 = await engine.generate(modifiedOptions);
      expect(result3.success).toBe(true);
      expect(result3.cacheHit).toBe(false);
    });

    it('should support manual cache invalidation', async () => {
      const key = 'manual-invalidation-test';
      const data = { test: 'data' };
      
      // Store data
      await cacheManager.set(key, data);
      expect((await cacheManager.get(key)).found).toBe(true);
      
      // Invalidate manually
      const invalidated = await cacheManager.invalidate(key);
      expect(invalidated.success).toBe(true);
      
      // Should no longer be found
      const afterInvalidation = await cacheManager.get(key);
      expect(afterInvalidation.found).toBe(false);
    });

    it('should support pattern-based invalidation', async () => {
      // Store multiple related entries
      await cacheManager.set('user:123:profile', { name: 'John' });
      await cacheManager.set('user:123:settings', { theme: 'dark' });
      await cacheManager.set('user:456:profile', { name: 'Jane' });
      await cacheManager.set('other:data', { value: 'test' });
      
      // Invalidate all user:123:* entries
      const invalidated = await cacheManager.invalidatePattern('user:123:*');
      expect(invalidated.success).toBe(true);
      expect(invalidated.count).toBe(2);
      
      // Check invalidation results
      expect((await cacheManager.get('user:123:profile')).found).toBe(false);
      expect((await cacheManager.get('user:123:settings')).found).toBe(false);
      expect((await cacheManager.get('user:456:profile')).found).toBe(true);
      expect((await cacheManager.get('other:data')).found).toBe(true);
    });
  });

  describe('cache performance', () => {
    it('should significantly improve generation performance', async () => {
      await engine.initialize();
      
      const generateOptions = {
        graph: testData.complexGraph,
        template: testData.personTemplate,
        outputPath: resolve(cacheDir, 'perf-test.ts')
      };
      
      // First generation (cache miss)
      const start1 = Date.now();
      const result1 = await engine.generate(generateOptions);
      const duration1 = Date.now() - start1;
      
      expect(result1.success).toBe(true);
      expect(result1.cacheHit).toBe(false);
      
      // Second generation (cache hit)
      const start2 = Date.now();
      const result2 = await engine.generate(generateOptions);
      const duration2 = Date.now() - start2;
      
      expect(result2.success).toBe(true);
      expect(result2.cacheHit).toBe(true);
      
      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.1); // At least 10x faster
    });

    it('should handle large cache entries efficiently', async () => {
      // Create large data structure
      const largeData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100),
          metadata: { created: new Date(), index: i }
        }))
      };
      
      const key = 'large-data-test';
      
      // Store large data
      const start1 = Date.now();
      const stored = await cacheManager.set(key, largeData);
      const storeTime = Date.now() - start1;
      
      expect(stored.success).toBe(true);
      expect(storeTime).toBeLessThan(1000); // Should store within 1 second
      
      // Retrieve large data
      const start2 = Date.now();
      const retrieved = await cacheManager.get(key);
      const retrieveTime = Date.now() - start2;
      
      expect(retrieved.found).toBe(true);
      expect(retrieved.data.items).toHaveLength(10000);
      expect(retrieveTime).toBeLessThan(1000); // Should retrieve within 1 second
    });

    it('should compress cache entries when enabled', async () => {
      const compressedCache = new CacheManager({
        cacheDir: testUtils.createTempDir(),
        enableCompression: true
      });
      
      const uncompressedCache = new CacheManager({
        cacheDir: testUtils.createTempDir(),
        enableCompression: false
      });
      
      // Create repetitive data that compresses well
      const repetitiveData = {
        content: 'This is a repeated string. '.repeat(1000)
      };
      
      const key = 'compression-test';
      
      // Store in both caches
      await compressedCache.set(key, repetitiveData);
      await uncompressedCache.set(key, repetitiveData);
      
      // Get file sizes (this is implementation-specific)
      const compressedSize = compressedCache.getEntrySize(key);
      const uncompressedSize = uncompressedCache.getEntrySize(key);
      
      // Compressed should be significantly smaller
      expect(compressedSize).toBeLessThan(uncompressedSize * 0.5);
    });
  });

  describe('cache size management', () => {
    it('should respect maximum cache size', async () => {
      const limitedCache = new CacheManager({
        cacheDir: testUtils.createTempDir(),
        maxSize: '1MB' // Very small limit
      });
      
      // Fill cache beyond limit
      const largeData = { content: 'x'.repeat(100000) }; // 100KB each
      
      const entries = [];
      for (let i = 0; i < 15; i++) { // 1.5MB total
        const key = `large-entry-${i}`;
        await limitedCache.set(key, largeData);
        entries.push(key);
      }
      
      // Check that some entries have been evicted
      const status = await limitedCache.getStatus();
      expect(status.totalSize).toBeLessThanOrEqual(1024 * 1024); // 1MB limit
      
      // Some early entries should be evicted
      const firstEntry = await limitedCache.get(entries[0]);
      expect(firstEntry.found).toBe(false);
      
      // Recent entries should still be available
      const lastEntry = await limitedCache.get(entries[entries.length - 1]);
      expect(lastEntry.found).toBe(true);
    });

    it('should use LRU eviction strategy', async () => {
      const lruCache = new CacheManager({
        cacheDir: testUtils.createTempDir(),
        maxEntries: 5,
        evictionPolicy: 'lru'
      });
      
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        await lruCache.set(`key-${i}`, { value: i });
      }
      
      // Access some entries to update LRU order
      await lruCache.get('key-0'); // Make key-0 most recently used
      await lruCache.get('key-2'); // Make key-2 second most recent
      
      // Add new entry (should evict least recently used)
      await lruCache.set('key-5', { value: 5 });
      
      // key-1 should be evicted (least recently used)
      expect((await lruCache.get('key-1')).found).toBe(false);
      
      // key-0 and key-2 should still be available
      expect((await lruCache.get('key-0')).found).toBe(true);
      expect((await lruCache.get('key-2')).found).toBe(true);
    });
  });

  describe('cache warming', () => {
    it('should pre-populate cache with common queries', async () => {
      await engine.initialize();
      
      const warmingData = [
        {
          graph: testData.simpleGraph,
          template: testData.personTemplate
        },
        {
          graph: testData.complexGraph,
          template: testData.personTemplate
        }
      ];
      
      // Warm cache
      const warmResult = await cacheManager.warm(warmingData);
      expect(warmResult.success).toBe(true);
      expect(warmResult.entriesWarmed).toBe(2);
      
      // Subsequent generations should be cache hits
      const result1 = await engine.generate({
        graph: testData.simpleGraph,
        template: testData.personTemplate,
        outputPath: resolve(cacheDir, 'warm-test-1.ts')
      });
      
      expect(result1.success).toBe(true);
      expect(result1.cacheHit).toBe(true);
    });

    it('should handle warming failures gracefully', async () => {
      const invalidWarmingData = [
        {
          graph: 'invalid-graph-data',
          template: testData.personTemplate
        }
      ];
      
      const warmResult = await cacheManager.warm(invalidWarmingData);
      expect(warmResult.success).toBe(true); // Partial success
      expect(warmResult.entriesWarmed).toBe(0);
      expect(warmResult.failures).toHaveLength(1);
    });
  });

  describe('cache statistics', () => {
    it('should track hit/miss ratios', async () => {
      await engine.initialize();
      
      const generateOptions = {
        graph: testData.simpleGraph,
        template: testData.personTemplate,
        outputPath: resolve(cacheDir, 'stats-test.ts')
      };
      
      // Clear any existing stats
      cacheManager.clearStats();
      
      // Generate 5 times (1 miss + 4 hits)
      for (let i = 0; i < 5; i++) {
        await engine.generate(generateOptions);
      }
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(4);
      expect(stats.misses).toBe(1);
      expect(stats.hitRatio).toBeCloseTo(0.8); // 4/5 = 0.8
    });

    it('should track cache size and entry count', async () => {
      const initialStatus = await cacheManager.getStatus();
      expect(initialStatus.entryCount).toBe(0);
      expect(initialStatus.totalSize).toBe(0);
      
      // Add some entries
      await cacheManager.set('test-1', { data: 'x'.repeat(1000) });
      await cacheManager.set('test-2', { data: 'y'.repeat(2000) });
      
      const updatedStatus = await cacheManager.getStatus();
      expect(updatedStatus.entryCount).toBe(2);
      expect(updatedStatus.totalSize).toBeGreaterThan(3000);
    });
  });

  describe('cache persistence', () => {
    it('should persist cache across restarts', async () => {
      const persistentCacheDir = testUtils.createTempDir();
      
      // Create first cache instance
      const cache1 = new CacheManager({
        cacheDir: persistentCacheDir,
        persistent: true
      });
      
      const key = 'persistence-test';
      const data = { value: 'persistent-data' };
      
      await cache1.set(key, data);
      
      // Create second cache instance (simulating restart)
      const cache2 = new CacheManager({
        cacheDir: persistentCacheDir,
        persistent: true
      });
      
      const retrieved = await cache2.get(key);
      expect(retrieved.found).toBe(true);
      expect(retrieved.data).toEqual(data);
      
      testUtils.cleanupTempDir(persistentCacheDir);
    });

    it('should handle corrupt cache files gracefully', async () => {
      const corruptCacheDir = testUtils.createTempDir();
      
      const cache = new CacheManager({
        cacheDir: corruptCacheDir,
        persistent: true
      });
      
      // Add valid entry
      await cache.set('valid-key', { data: 'valid' });
      
      // Manually corrupt a cache file
      const cacheFiles = await cache.listCacheFiles();
      if (cacheFiles.length > 0) {
        writeFileSync(resolve(corruptCacheDir, cacheFiles[0]), 'corrupted data');
      }
      
      // Cache should handle corruption gracefully
      const result = await cache.get('valid-key');
      expect(result.found).toBe(false); // Entry should be considered invalid
      
      // New entries should still work
      await cache.set('new-key', { data: 'new' });
      const newResult = await cache.get('new-key');
      expect(newResult.found).toBe(true);
      
      testUtils.cleanupTempDir(corruptCacheDir);
    });
  });
});
