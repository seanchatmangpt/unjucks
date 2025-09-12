/**
 * Content URI Resolver Deep Test Suite
 * 
 * Tests content:// URI scheme with focus on:
 * - CAS (Content Addressed Storage) functionality
 * - Hardlink optimization
 * - Extension preservation
 * - Drift detection
 * - Sharding performance
 * - Cache efficiency
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

describe('Content URI Resolver Deep Tests', () => {
  let resolver;
  let testDir;
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), 'content-uri-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    resolver = new ContentUriResolver({
      casDir: path.join(testDir, 'cas'),
      enableHardlinks: true,
      enableExtensionPreservation: true,
      enableDriftDetection: true,
      cacheSize: 100,
      integrityChecks: true
    });
    
    await resolver.initialize();
  });
  
  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('CAS Core Functionality', () => {
    test('should create sharded directory structure', async () => {
      // Check that sharding directories were created (00-ff)
      const casDir = path.join(testDir, 'cas');
      
      const shardDirs = ['00', '01', 'ff', 'a7', '3c'];
      for (const shard of shardDirs) {
        const shardPath = path.join(casDir, shard);
        expect(await fs.pathExists(shardPath)).toBe(true);
      }
      
      const metadataDir = path.join(casDir, '.metadata');
      expect(await fs.pathExists(metadataDir)).toBe(true);
    });

    test('should handle different content types correctly', async () => {
      const testCases = [
        { content: 'Plain text content', type: 'text' },
        { content: JSON.stringify({ key: 'value' }), type: 'json' },
        { content: Buffer.from([0x89, 0x50, 0x4E, 0x47]), type: 'binary' },
        { content: '<html><body>Test</body></html>', type: 'html' },
        { content: 'export const test = true;', type: 'javascript' }
      ];
      
      for (const testCase of testCases) {
        const result = await resolver.store(testCase.content, {
          metadata: { contentType: testCase.type }
        });
        
        expect(result.uri).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
        expect(result.stored).toBe(true);
        
        const resolved = await resolver.resolve(result.uri);
        expect(resolved.metadata.contentType).toBe(testCase.type);
      }
    });

    test('should handle empty and null content', async () => {
      const emptyString = '';
      const emptyBuffer = Buffer.alloc(0);
      
      const stringResult = await resolver.store(emptyString);
      const bufferResult = await resolver.store(emptyBuffer);
      
      expect(stringResult.size).toBe(0);
      expect(bufferResult.size).toBe(0);
      expect(stringResult.hash).toBe(bufferResult.hash); // Same hash for empty content
      
      const resolvedString = await resolver.getContentAsString(stringResult.uri);
      expect(resolvedString).toBe('');
    });
  });

  describe('Extension Preservation', () => {
    test('should preserve file extensions when specified', async () => {
      const testCases = [
        { content: 'console.log("test");', ext: '.js' },
        { content: '{"test": true}', ext: '.json' },
        { content: 'Hello World', ext: '.txt' },
        { content: '# Header', ext: '.md' },
        { content: 'body { color: red; }', ext: '.css' }
      ];
      
      for (const testCase of testCases) {
        const result = await resolver.store(testCase.content, {
          extension: testCase.ext,
          preserveExtension: true
        });
        
        expect(result.extension).toBe(testCase.ext);
        expect(result.path).toMatch(new RegExp(`\\${testCase.ext}$`));
        expect(await fs.pathExists(result.path)).toBe(true);
      }
    });

    test('should infer extension from source path', async () => {
      const sourcePath = '/fake/path/test.ts';
      const content = 'const test: string = "hello";';
      
      const result = await resolver.store(content, {
        source: sourcePath,
        preserveExtension: true
      });
      
      expect(result.extension).toBe('.ts');
      expect(result.path).toMatch(/\.ts$/);
    });

    test('should find files with extensions during resolution', async () => {
      const content = 'Test file with extension';
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Manually create file with extension to test finding logic
      const shardDir = hash.substring(0, 2);
      const casPath = path.join(testDir, 'cas', shardDir);
      await fs.ensureDir(casPath);
      
      const filePath = path.join(casPath, hash + '.test');
      await fs.writeFile(filePath, content);
      
      const uri = `content://sha256/${hash}`;
      const resolved = await resolver.resolve(uri);
      
      expect(resolved.path).toBe(filePath);
      expect(resolved.extension).toBe('.test');
    });
  });

  describe('Hardlink Optimization', () => {
    test('should create hardlinks when enabled', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const content = 'Hardlink test content';
      
      await fs.writeFile(sourcePath, content);
      
      const result = await resolver.store(content, {
        source: sourcePath
      });
      
      expect(result.hardlinked).toBe(true);
      
      // Check that hardlink was created
      const sourceStats = await fs.stat(sourcePath);
      const casStats = await fs.stat(result.path);
      
      expect(sourceStats.ino).toBe(casStats.ino); // Same inode = hardlink
    });

    test('should handle hardlink failures gracefully', async () => {
      const nonExistentSource = path.join(testDir, 'nonexistent.txt');
      const content = 'Content for failed hardlink test';
      
      const result = await resolver.store(content, {
        source: nonExistentSource
      });
      
      // Should still store successfully even if hardlink fails
      expect(result.stored).toBe(true);
      expect(result.hardlinked).toBe(false);
    });

    test('should track hardlink statistics', async () => {
      const content = 'Hardlink stats test';
      const sourcePath = path.join(testDir, 'stats-test.txt');
      await fs.writeFile(sourcePath, content);
      
      await resolver.store(content, { source: sourcePath });
      
      const stats = resolver.getStats();
      expect(stats.resolver.hardlinkCreated).toBe(1);
      expect(stats.performance.hardlinkRate).toBeGreaterThan(0);
    });
  });

  describe('Drift Detection', () => {
    test('should detect when stored content differs from expected', async () => {
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      
      // Store original
      const originalResult = await resolver.store(originalContent);
      
      // Manually modify the file to simulate drift
      await fs.writeFile(originalResult.path, modifiedContent);
      
      // Try to store original again - should detect drift
      const driftResult = await resolver.store(originalContent, {
        metadata: { expectDrift: true }
      });
      
      expect(driftResult.existed).toBe(true);
      const stats = resolver.getStats();
      expect(stats.resolver.driftDetections).toBeGreaterThan(0);
    });

    test('should verify content integrity during resolution', async () => {
      const content = 'Integrity test content';
      const result = await resolver.store(content);
      
      // Corrupt the stored file
      await fs.writeFile(result.path, 'Corrupted content');
      
      // Resolution should fail integrity check
      await expect(resolver.resolve(result.uri)).rejects.toThrow(/integrity/i);
    });

    test('should allow corrupted content with flag', async () => {
      const content = 'Content to be corrupted';
      const result = await resolver.store(content);
      
      // Corrupt the file
      await fs.writeFile(result.path, 'Corrupted');
      
      // Should resolve with allowCorrupted flag
      const resolved = await resolver.resolve(result.uri, { allowCorrupted: true });
      expect(resolved.integrity.valid).toBe(false);
    });
  });

  describe('Cache Management', () => {
    test('should implement LRU cache behavior', async () => {
      // Set small cache size for testing
      resolver.options.cacheSize = 3;
      
      const contents = ['content1', 'content2', 'content3', 'content4'];
      const results = [];
      
      // Store and resolve to populate cache
      for (const content of contents) {
        const result = await resolver.store(content);
        await resolver.resolve(result.uri); // Populate cache
        results.push(result);
      }
      
      // Cache should be at max size
      expect(resolver.contentCache.size).toBe(3);
      
      // First item should be evicted
      const firstResolve = await resolver.resolve(results[0].uri);
      expect(firstResolve.cached).toBe(false); // Cache miss due to LRU eviction
    });

    test('should provide cache statistics', async () => {
      const content = 'Cache stats test';
      const result = await resolver.store(content);
      
      // First resolve - cache miss
      await resolver.resolve(result.uri);
      // Second resolve - cache hit  
      await resolver.resolve(result.uri);
      
      const stats = resolver.getStats();
      expect(stats.cache.contentCacheSize).toBeGreaterThan(0);
      expect(stats.cache.hitRate).toBeGreaterThan(0);
    });

    test('should clear cache on command', () => {
      // Populate cache
      resolver.contentCache.set('test-key', { data: 'test' });
      resolver.metadataCache.set('test-meta', { meta: 'test' });
      
      expect(resolver.contentCache.size).toBe(1);
      expect(resolver.metadataCache.size).toBe(1);
      
      resolver.clearCache();
      
      expect(resolver.contentCache.size).toBe(0);
      expect(resolver.metadataCache.size).toBe(0);
    });
  });

  describe('Metadata Management', () => {
    test('should store and retrieve content metadata', async () => {
      const content = 'Metadata test content';
      const metadata = {
        author: 'test-suite',
        created: this.getDeterministicDate().toISOString(),
        tags: ['test', 'metadata'],
        version: '1.0.0'
      };
      
      const result = await resolver.store(content, { metadata });
      
      expect(result.metadata.author).toBe('test-suite');
      expect(result.metadata.tags).toEqual(['test', 'metadata']);
      
      const resolved = await resolver.resolve(result.uri);
      expect(resolved.metadata.author).toBe('test-suite');
      expect(resolved.metadata.version).toBe('1.0.0');
    });

    test('should handle missing metadata gracefully', async () => {
      const content = 'No metadata content';
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Store content without metadata
      const result = await resolver.store(content);
      
      // Delete metadata file
      const metadataPath = path.join(resolver.options.casDir, '.metadata', `${hash}.json`);
      if (await fs.pathExists(metadataPath)) {
        await fs.remove(metadataPath);
      }
      
      const resolved = await resolver.resolve(result.uri);
      expect(resolved.metadata).toEqual({}); // Empty metadata
    });
  });

  describe('Performance Optimizations', () => {
    test('should handle large files efficiently', async () => {
      const largeContent = 'Large file content: ' + 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const startTime = this.getDeterministicTimestamp();
      const result = await resolver.store(largeContent);
      const storeTime = this.getDeterministicTimestamp() - startTime;
      
      expect(result.size).toBe(largeContent.length);
      expect(storeTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const resolveStart = this.getDeterministicTimestamp();
      const resolved = await resolver.resolve(result.uri);
      const resolveTime = this.getDeterministicTimestamp() - resolveStart;
      
      expect(resolveTime).toBeLessThan(1000); // Fast resolution
      expect(resolved.size).toBe(largeContent.length);
    });

    test('should distribute files across shards evenly', async () => {
      const contents = [];
      const shardCounts = {};
      
      // Generate content for different shards
      for (let i = 0; i < 100; i++) {
        const content = `Shard test content ${i} with random data ${Math.random()}`;
        contents.push(content);
      }
      
      // Store all content
      for (const content of contents) {
        const result = await resolver.store(content);
        const shard = result.hash.substring(0, 2);
        shardCounts[shard] = (shardCounts[shard] || 0) + 1;
      }
      
      // Should have reasonable distribution across shards
      const shardCount = Object.keys(shardCounts).length;
      expect(shardCount).toBeGreaterThan(10); // At least 10 different shards used
    });

    test('should handle concurrent operations safely', async () => {
      const content = 'Concurrent test content';
      const concurrentStores = [];
      
      // Start 10 concurrent store operations
      for (let i = 0; i < 10; i++) {
        concurrentStores.push(resolver.store(content + i));
      }
      
      const results = await Promise.all(concurrentStores);
      
      // All should succeed
      results.forEach(result => {
        expect(result.stored).toBe(true);
        expect(result.uri).toMatch(/^content:\/\/sha256\//);
      });
      
      // All should have different hashes (different content)
      const hashes = results.map(r => r.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(10);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid hash algorithms', () => {
      expect(() => {
        resolver.parseContentURI('content://invalid-algo/hash123');
      }).toThrow(/Unsupported hash algorithm/);
    });

    test('should handle invalid hash lengths', () => {
      expect(() => {
        resolver.parseContentURI('content://sha256/tooshort');
      }).toThrow(/Invalid hash length/);
      
      expect(() => {
        resolver.parseContentURI('content://sha256/' + 'a'.repeat(128));
      }).toThrow(/Invalid hash length/);
    });

    test('should handle filesystem permission errors gracefully', async () => {
      // Create a read-only directory to simulate permission error
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444); // Read-only
      
      const restrictedResolver = new ContentUriResolver({
        casDir: readOnlyDir,
        enableHardlinks: false
      });
      
      await expect(restrictedResolver.initialize()).rejects.toThrow();
    });

    test('should validate URI format strictly', () => {
      const invalidUris = [
        'content://',
        'content://sha256',
        'content://sha256/',
        'content://sha256/invalid-hex-chars',
        'content://sha256/123', // Too short
        'not-a-uri'
      ];
      
      invalidUris.forEach(uri => {
        const validation = resolver.validateContentURI(uri);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      });
    });

    test('should handle corrupted metadata files', async () => {
      const content = 'Corrupted metadata test';
      const result = await resolver.store(content, {
        metadata: { test: 'data' }
      });
      
      // Corrupt metadata file
      const metadataPath = path.join(
        resolver.options.casDir,
        '.metadata',
        `${result.hash}.json`
      );
      
      await fs.writeFile(metadataPath, 'invalid json {');
      
      // Should handle gracefully
      const resolved = await resolver.resolve(result.uri);
      expect(resolved.metadata).toEqual({}); // Fallback to empty metadata
    });
  });

  describe('Listing and Discovery', () => {
    test('should list stored content with filters', async () => {
      const testData = [
        { content: 'Small file', extension: '.txt' },
        { content: 'console.log("hello");', extension: '.js' },
        { content: 'Large content: ' + 'x'.repeat(10000), extension: '.txt' }
      ];
      
      // Store test data
      for (const data of testData) {
        await resolver.store(data.content, { 
          extension: data.extension,
          preserveExtension: true 
        });
      }
      
      // List all
      const allEntries = await resolver.list();
      expect(allEntries.length).toBe(3);
      
      // Filter by extension
      const txtEntries = await resolver.list({ extension: '.txt' });
      expect(txtEntries.length).toBe(2);
      
      // Filter by size
      const largeEntries = await resolver.list({ minSize: 5000 });
      expect(largeEntries.length).toBe(1);
    });

    test('should handle empty CAS directory', async () => {
      const emptyResolver = new ContentUriResolver({
        casDir: path.join(testDir, 'empty-cas')
      });
      await emptyResolver.initialize();
      
      const entries = await emptyResolver.list();
      expect(entries).toEqual([]);
    });
  });

  describe('URI Creation and Validation', () => {
    test('should create valid content URIs', () => {
      const hash = 'a'.repeat(64);
      
      const uri = resolver.createContentURI(hash);
      expect(uri).toBe(`content://sha256/${hash}`);
      
      const uriWithAlgo = resolver.createContentURI(hash, 'sha512');
      expect(uriWithAlgo).toBe(`content://sha512/${hash}`);
    });

    test('should validate content URI components', () => {
      const validUri = 'content://sha256/' + 'a'.repeat(64);
      const parsed = resolver.parseContentURI(validUri);
      
      expect(parsed.algorithm).toBe('sha256');
      expect(parsed.hash).toBe('a'.repeat(64));
      expect(parsed.uri).toBe(validUri);
    });

    test('should normalize hash case', () => {
      const upperHash = 'A'.repeat(64);
      const lowerHash = 'a'.repeat(64);
      
      const upperUri = resolver.createContentURI(upperHash);
      const lowerUri = resolver.createContentURI(lowerHash);
      
      expect(upperUri).toBe(lowerUri); // Should normalize to lowercase
    });
  });
});