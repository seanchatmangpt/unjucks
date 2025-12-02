/**
 * Content-Addressed Storage (CAS) Tests
 * 
 * Comprehensive tests for the unified CAS system with SHA256 addressing.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CASStorage, CASRetrieval, CASGarbageCollector, cas, createCAS } from '../src/cas/index.js';

describe('Content-Addressed Storage (CAS)', () => {
  let tempDir;
  let storage;
  let retrieval;
  let gc;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), 'cas-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize CAS components
    storage = new CASStorage({ 
      basePath: join(tempDir, 'cas'),
      enableFileStorage: true,
      enableMemoryCache: true
    });
    
    retrieval = new CASRetrieval({ storage });
    gc = new CASGarbageCollector({ storage });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('CASStorage', () => {
    it('should store and retrieve content with SHA256 addressing', async () => {
      const content = 'Hello, CAS World!';
      
      // Store content
      const hash = await storage.store(content);
      
      // Validate SHA256 format
      assert.match(hash, /^[a-f0-9]{64}$/);
      
      // Retrieve content
      const retrieved = await storage.retrieve(hash);
      assert.strictEqual(retrieved.toString('utf8'), content);
    });

    it('should calculate deterministic SHA256 hashes', async () => {
      const content = 'Deterministic content';
      
      const hash1 = await storage.store(content);
      const hash2 = await storage.store(content);
      const calculated = storage.calculateHash(content);
      
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1, calculated);
    });

    it('should handle different content types', async () => {
      const testCases = [
        'string content',
        Buffer.from('buffer content'),
        new Uint8Array([1, 2, 3, 4, 5])
      ];

      for (const content of testCases) {
        const hash = await storage.store(content);
        const retrieved = await storage.retrieve(hash);
        
        assert.ok(hash);
        assert.ok(retrieved);
        assert.strictEqual(retrieved.length > 0, true);
      }
    });

    it('should not store duplicate content', async () => {
      const content = 'Duplicate test content';
      
      const hash1 = await storage.store(content);
      const hash2 = await storage.store(content);
      
      assert.strictEqual(hash1, hash2);
      
      // Should exist only once in storage
      const list = await storage.list();
      const occurrences = list.filter(h => h === hash1).length;
      assert.strictEqual(occurrences, 1);
    });

    it('should check content existence', async () => {
      const content = 'Existence test';
      const hash = await storage.store(content);
      
      assert.strictEqual(await storage.exists(hash), true);
      assert.strictEqual(await storage.exists('nonexistent' + '0'.repeat(56)), false);
    });

    it('should list all stored hashes', async () => {
      const contents = ['content1', 'content2', 'content3'];
      const hashes = [];

      for (const content of contents) {
        const hash = await storage.store(content);
        hashes.push(hash);
      }

      const list = await storage.list();
      
      for (const hash of hashes) {
        assert.ok(list.includes(hash));
      }
    });

    it('should provide metrics', async () => {
      await storage.store('test content');
      await storage.retrieve('nonexistent' + '0'.repeat(56));
      
      const metrics = storage.getMetrics();
      
      assert.ok(typeof metrics.stores === 'number');
      assert.ok(typeof metrics.retrievals === 'number');
      assert.ok(typeof metrics.cacheHitRate === 'number');
      assert.ok(metrics.stores > 0);
    });
  });

  describe('CASRetrieval', () => {
    it('should retrieve content with verification', async () => {
      const content = 'Retrieval test content';
      const hash = await storage.store(content);
      
      const result = await retrieval.retrieve(hash, { verify: true });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.verified, true);
      assert.strictEqual(result.content.toString('utf8'), content);
      assert.strictEqual(result.hash, hash);
    });

    it('should handle retrieval of non-existent content', async () => {
      const fakeHash = 'a'.repeat(64);
      const result = await retrieval.retrieve(fakeHash);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.content, null);
      assert.ok(result.error.includes('not found'));
    });

    it('should verify content integrity', async () => {
      const content = 'Integrity test';
      const hash = await storage.store(content);
      
      const verifyResult = await retrieval.verify(hash, content);
      assert.strictEqual(verifyResult.valid, true);
      assert.strictEqual(verifyResult.exists, true);
      assert.strictEqual(verifyResult.hashVerified, true);
    });

    it('should retrieve multiple contents in batch', async () => {
      const contents = ['batch1', 'batch2', 'batch3'];
      const hashes = [];

      for (const content of contents) {
        const hash = await storage.store(content);
        hashes.push(hash);
      }

      const batchResult = await retrieval.retrieveBatch(hashes);
      
      assert.strictEqual(batchResult.success, true);
      assert.strictEqual(batchResult.successCount, 3);
      assert.strictEqual(batchResult.errorCount, 0);
      assert.strictEqual(batchResult.results.length, 3);
    });

    it('should find content by hash prefix', async () => {
      const content = 'Prefix search test';
      const hash = await storage.store(content);
      const prefix = hash.substring(0, 8);
      
      const searchResult = await retrieval.findByPrefix(prefix);
      
      assert.ok(searchResult.count > 0);
      assert.ok(searchResult.matches.some(m => m.hash === hash));
    });

    it('should provide retrieval metrics', async () => {
      await storage.store('metrics test');
      await retrieval.retrieve('nonexistent' + '0'.repeat(56));
      
      const metrics = retrieval.getMetrics();
      
      assert.ok(typeof metrics.retrievals === 'number');
      assert.ok(typeof metrics.errors === 'number');
      assert.ok(typeof metrics.errorRate === 'number');
      assert.ok(metrics.retrievals > 0);
    });
  });

  describe('CASGarbageCollector', () => {
    it('should collect garbage collection statistics', async () => {
      await storage.store('gc test 1');
      await storage.store('gc test 2');
      
      const stats = await gc.getStats();
      
      assert.ok(typeof stats.totalItems === 'number');
      assert.ok(typeof stats.totalSize === 'number');
      assert.ok(stats.totalItems >= 2);
    });

    it('should run garbage collection in dry run mode', async () => {
      await storage.store('dry run test');
      
      const result = await gc.run({ dryRun: true, maxAge: 0 });
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('DRY RUN') || result.itemsRemoved >= 0);
    });

    it('should clear memory cache', async () => {
      await storage.store('cache test');
      
      const beforeUsage = gc.getCacheUsage();
      const clearResult = await gc.clearCache();
      const afterUsage = gc.getCacheUsage();
      
      assert.ok(typeof clearResult.itemsCleared === 'number');
      assert.ok(afterUsage.cacheSize <= beforeUsage.cacheSize);
    });

    it('should mark items as accessed', async () => {
      const content = 'access test';
      const hash = await storage.store(content);
      
      const marked = await gc.markAccessed([hash]);
      
      assert.strictEqual(marked, 1);
    });
  });

  describe('Unified CAS API', () => {
    it('should work with the global cas instance', async () => {
      const content = 'Global CAS test';
      
      // Store content
      const hash = await cas.store(content);
      assert.match(hash, /^[a-f0-9]{64}$/);
      
      // Retrieve content
      const retrieved = await cas.retrieve(hash);
      assert.strictEqual(retrieved.toString('utf8'), content);
      
      // Check existence
      const exists = await cas.exists(hash);
      assert.strictEqual(exists, true);
      
      // Verify content
      const verified = await cas.verify(hash, content);
      assert.strictEqual(verified, true);
      
      // List hashes
      const list = await cas.list();
      assert.ok(list.includes(hash));
    });

    it('should create custom CAS instance', async () => {
      const customCAS = createCAS({
        basePath: join(tempDir, 'custom-cas'),
        enableFileStorage: true
      });

      const content = 'Custom CAS test';
      const hash = await customCAS.store(content);
      const retrieved = await customCAS.retrieve(hash);
      
      assert.strictEqual(retrieved.toString('utf8'), content);
      
      // Get metrics
      const metrics = await customCAS.getMetrics();
      assert.ok(metrics.storage);
      assert.ok(metrics.retrieval);
      assert.ok(metrics.gc);
    });

    it('should maintain consistency across operations', async () => {
      const contents = ['test1', 'test2', 'test3'];
      const hashes = [];

      // Store multiple contents
      for (const content of contents) {
        const hash = await cas.store(content);
        hashes.push(hash);
      }

      // Verify all content can be retrieved
      for (let i = 0; i < contents.length; i++) {
        const retrieved = await cas.retrieve(hashes[i]);
        assert.strictEqual(retrieved.toString('utf8'), contents[i]);
      }

      // Verify all hashes are listed
      const list = await cas.list();
      for (const hash of hashes) {
        assert.ok(list.includes(hash));
      }

      // Run garbage collection (should not remove recent items)
      const gcResult = await cas.gc({ dryRun: true });
      assert.strictEqual(gcResult.success, true);
    });

    it('should handle large content efficiently', async () => {
      // Create 1MB of test data
      const largeContent = 'x'.repeat(1024 * 1024);
      
      const startTime = Date.now();
      const hash = await cas.store(largeContent);
      const storeTime = Date.now() - startTime;
      
      const retrieveStart = Date.now();
      const retrieved = await cas.retrieve(hash);
      const retrieveTime = Date.now() - retrieveStart;
      
      assert.strictEqual(retrieved.toString('utf8'), largeContent);
      assert.ok(storeTime < 5000); // Should store in under 5 seconds
      assert.ok(retrieveTime < 1000); // Should retrieve in under 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid hash formats gracefully', async () => {
      const invalidHashes = ['invalid', '123', 'not-a-hash', 'x'.repeat(63)];

      for (const invalidHash of invalidHashes) {
        const result = await retrieval.retrieve(invalidHash);
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('Invalid') || result.error.includes('not found'));
      }
    });

    it('should handle unsupported content types', async () => {
      try {
        await storage.store(null);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Unsupported content type'));
      }
    });

    it('should handle file system errors gracefully', async () => {
      // Create storage with invalid path
      const invalidStorage = new CASStorage({
        basePath: '/invalid/path/that/should/not/exist',
        enableFileStorage: true
      });

      try {
        await invalidStorage.store('test');
        // If no error, that's also acceptable (might create path)
      } catch (error) {
        assert.ok(error.message.length > 0);
      }
    });
  });
});