/**
 * Test suite for Registry Cache
 * Tests caching functionality, TTL expiration, cleanup, and offline support
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { RegistryCache } from '../../../src/registry/cache/registry-cache.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm, mkdir, stat, writeFile } from 'fs/promises';

describe('RegistryCache', () => {
  let cache;
  let testDir;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cache-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    cache = new RegistryCache({
      directory: testDir,
      enabled: true,
      maxSize: 1024 * 1024, // 1MB
      ttl: {
        packageInfo: 1000,     // 1 second for testing
        searchResults: 500,    // 0.5 seconds
        packageContent: 2000   // 2 seconds
      },
      cleanupInterval: 100 // 100ms for testing
    });
  });

  afterEach(async () => {
    if (cache) {
      await cache.destroy();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    test('should initialize cache successfully', async () => {
      await cache.initialize();
      
      expect(cache.initialized).toBe(true);
    });

    test('should create cache subdirectories', async () => {
      await cache.initialize();
      
      const subdirs = ['packages', 'search', 'content', 'metadata'];
      for (const subdir of subdirs) {
        const stats = await stat(join(testDir, subdir));
        expect(stats.isDirectory()).toBe(true);
      }
    });

    test('should not initialize when disabled', async () => {
      cache.enabled = false;
      await cache.initialize();
      
      expect(cache.initialized).toBe(true);
      // Should not create directories when disabled
    });

    test('should emit initialized event', async () => {
      const initSpy = vi.fn();
      cache.on('initialized', initSpy);
      
      await cache.initialize();
      
      expect(initSpy).toHaveBeenCalledWith({ cacheDir: testDir });
    });
  });

  describe('package info caching', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should cache and retrieve package info', async () => {
      const packageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package'
      };

      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      const retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      expect(retrieved).toEqual(packageInfo);
    });

    test('should return null for non-existent package info', async () => {
      const retrieved = await cache.getPackageInfo('npm', 'nonexistent', '1.0.0');
      
      expect(retrieved).toBeNull();
    });

    test('should use memory cache for recently accessed items', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      
      // First retrieval should populate memory cache
      await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      // Second retrieval should hit memory cache
      const hitSpy = vi.fn();
      cache.on('hit', hitSpy);
      
      const retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      expect(retrieved).toEqual(packageInfo);
      expect(hitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'memory' })
      );
    });

    test('should expire package info based on TTL', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      
      // Should be available immediately
      let retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      expect(retrieved).toEqual(packageInfo);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired now
      retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      expect(retrieved).toBeNull();
    });

    test('should emit write event when caching', async () => {
      const writeSpy = vi.fn();
      cache.on('write', writeSpy);
      
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      
      expect(writeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'package' })
      );
    });
  });

  describe('search results caching', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should cache and retrieve search results', async () => {
      const searchResults = [
        { name: 'package1', version: '1.0.0' },
        { name: 'package2', version: '2.0.0' }
      ];

      await cache.setSearchResults('npm', 'test query', { limit: 10 }, searchResults);
      const retrieved = await cache.getSearchResults('npm', 'test query', { limit: 10 });
      
      expect(retrieved).toEqual(searchResults);
    });

    test('should generate different cache keys for different search options', async () => {
      const searchResults = [{ name: 'package1', version: '1.0.0' }];

      await cache.setSearchResults('npm', 'test', { limit: 10 }, searchResults);
      await cache.setSearchResults('npm', 'test', { limit: 20 }, searchResults);
      
      const retrieved1 = await cache.getSearchResults('npm', 'test', { limit: 10 });
      const retrieved2 = await cache.getSearchResults('npm', 'test', { limit: 20 });
      
      expect(retrieved1).toEqual(searchResults);
      expect(retrieved2).toEqual(searchResults);
    });

    test('should expire search results based on TTL', async () => {
      const searchResults = [{ name: 'package1', version: '1.0.0' }];
      
      await cache.setSearchResults('npm', 'test', {}, searchResults);
      
      // Should be available immediately
      let retrieved = await cache.getSearchResults('npm', 'test', {});
      expect(retrieved).toEqual(searchResults);
      
      // Wait for expiration (TTL is 500ms for search results)
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should be expired now
      retrieved = await cache.getSearchResults('npm', 'test', {});
      expect(retrieved).toBeNull();
    });
  });

  describe('package content caching', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should cache and retrieve package content', async () => {
      const content = Buffer.from('package content data');

      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      const retrieved = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      
      expect(retrieved).toEqual(content);
    });

    test('should handle large binary content', async () => {
      const largeContent = Buffer.alloc(1024 * 100); // 100KB
      largeContent.fill('test data');

      await cache.setPackageContent('npm', 'large-package', '1.0.0', largeContent);
      const retrieved = await cache.getPackageContent('npm', 'large-package', '1.0.0');
      
      expect(retrieved).toEqual(largeContent);
    });

    test('should expire package content based on TTL', async () => {
      const content = Buffer.from('package content');
      
      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      
      // Should be available immediately
      let retrieved = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      expect(retrieved).toEqual(content);
      
      // Wait for expiration (TTL is 2000ms for content)
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      // Should be expired now
      retrieved = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      expect(retrieved).toBeNull();
    });
  });

  describe('cache invalidation', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should invalidate specific package version', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      const content = Buffer.from('content');

      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      
      await cache.invalidatePackage('npm', 'test-package', '1.0.0');
      
      const retrievedInfo = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      const retrievedContent = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      
      expect(retrievedInfo).toBeNull();
      expect(retrievedContent).toBeNull();
    });

    test('should invalidate all versions of a package', async () => {
      const packageInfo1 = { name: 'test-package', version: '1.0.0' };
      const packageInfo2 = { name: 'test-package', version: '2.0.0' };

      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo1);
      await cache.setPackageInfo('npm', 'test-package', '2.0.0', packageInfo2);
      
      await cache.invalidatePackage('npm', 'test-package');
      
      const retrieved1 = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      const retrieved2 = await cache.getPackageInfo('npm', 'test-package', '2.0.0');
      
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });

    test('should emit invalidated event', async () => {
      const invalidatedSpy = vi.fn();
      cache.on('invalidated', invalidatedSpy);
      
      await cache.invalidatePackage('npm', 'test-package', '1.0.0');
      
      expect(invalidatedSpy).toHaveBeenCalledWith({
        registry: 'npm',
        name: 'test-package',
        version: '1.0.0'
      });
    });
  });

  describe('cache cleanup', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should remove expired entries during cleanup', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const cleanupResult = await cache.cleanup();
      
      expect(cleanupResult.removed).toBeGreaterThan(0);
    });

    test('should enforce maximum cache size', async () => {
      // Set very small max size
      cache.maxSize = 1024; // 1KB
      
      // Add content that exceeds max size
      const largeContent = Buffer.alloc(2048); // 2KB
      await cache.setPackageContent('npm', 'large-package', '1.0.0', largeContent);
      
      const cleanupResult = await cache.cleanup();
      
      // Should have removed content to stay under limit
      expect(cleanupResult.freed).toBeGreaterThan(0);
    });

    test('should emit cleanup event', async () => {
      const cleanupSpy = vi.fn();
      cache.on('cleanup', cleanupSpy);
      
      await cache.cleanup();
      
      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          removed: expect.any(Number),
          freed: expect.any(Number)
        })
      );
    });

    test('should run automatic cleanup periodically', async () => {
      const cleanupSpy = vi.spyOn(cache, 'cleanup');
      
      // Wait for automatic cleanup to run
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('cache statistics', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should track hit/miss statistics', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      // Miss
      await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      // Set and hit
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      const stats = await cache.getStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.writes).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    test('should calculate disk usage', async () => {
      const content = Buffer.from('test content');
      
      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      
      const stats = await cache.getStats();
      
      expect(stats.diskUsage).toBeGreaterThan(0);
    });

    test('should track memory usage', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      await cache.getPackageInfo('npm', 'test-package', '1.0.0'); // Load into memory
      
      const stats = await cache.getStats();
      
      expect(stats.memoryEntries).toBeGreaterThan(0);
    });
  });

  describe('cache clearing', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should clear all cache data', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      const content = Buffer.from('content');
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      
      await cache.clear();
      
      const retrievedInfo = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      const retrievedContent = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      
      expect(retrievedInfo).toBeNull();
      expect(retrievedContent).toBeNull();
    });

    test('should reset statistics when clearing', async () => {
      // Generate some stats
      await cache.getPackageInfo('npm', 'test-package', '1.0.0'); // Miss
      
      await cache.clear();
      
      const stats = await cache.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(0);
    });

    test('should emit cleared event', async () => {
      const clearedSpy = vi.fn();
      cache.on('cleared', clearedSpy);
      
      await cache.clear();
      
      expect(clearedSpy).toHaveBeenCalled();
    });
  });

  describe('disabled cache', () => {
    test('should not cache when disabled', async () => {
      cache.enabled = false;
      await cache.initialize();
      
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      const retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      expect(retrieved).toBeNull();
    });

    test('should return null for all operations when disabled', async () => {
      cache.enabled = false;
      await cache.initialize();
      
      const content = Buffer.from('content');
      
      await cache.setPackageContent('npm', 'test-package', '1.0.0', content);
      const retrievedContent = await cache.getPackageContent('npm', 'test-package', '1.0.0');
      
      await cache.setSearchResults('npm', 'query', {}, []);
      const retrievedSearch = await cache.getSearchResults('npm', 'query', {});
      
      expect(retrievedContent).toBeNull();
      expect(retrievedSearch).toBeNull();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should handle file system errors gracefully', async () => {
      // Mock file system error
      vi.spyOn(cache, 'setCacheEntry').mockRejectedValue(new Error('Disk full'));
      
      const errorSpy = vi.fn();
      cache.on('error', errorSpy);
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', { name: 'test' });
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should return null on cache read errors', async () => {
      // Corrupt cache by writing invalid JSON
      const cacheFile = join(testDir, 'packages', cache.sanitizeKey('package-npm-test-package-1.0.0'));
      await writeFile(cacheFile, 'invalid json');
      
      const retrieved = await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      expect(retrieved).toBeNull();
    });

    test('should handle cleanup errors gracefully', async () => {
      const errorSpy = vi.fn();
      cache.on('error', errorSpy);
      
      // Mock cleanup error
      vi.spyOn(cache, 'calculateDiskUsage').mockRejectedValue(new Error('Permission denied'));
      
      const result = await cache.cleanup();
      
      expect(result.removed).toBe(0);
      expect(result.freed).toBe(0);
    });
  });

  describe('key generation and sanitization', () => {
    test('should generate consistent cache keys', () => {
      const key1 = cache.generateCacheKey('package', 'npm', 'test-package', '1.0.0');
      const key2 = cache.generateCacheKey('package', 'npm', 'test-package', '1.0.0');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('package-npm-test-package-1.0.0');
    });

    test('should generate different keys for different parameters', () => {
      const key1 = cache.generateCacheKey('package', 'npm', 'test-package', '1.0.0');
      const key2 = cache.generateCacheKey('package', 'npm', 'test-package', '2.0.0');
      
      expect(key1).not.toBe(key2);
    });

    test('should sanitize keys for filesystem safety', () => {
      const unsafeKey = 'package-npm-@scope/package-1.0.0';
      const sanitized = cache.sanitizeKey(unsafeKey);
      
      expect(sanitized).toBe('package-npm-_scope_package-1_0_0');
    });

    test('should generate consistent search keys', () => {
      const key1 = cache.generateSearchKey('npm', 'test query', { limit: 10 });
      const key2 = cache.generateSearchKey('npm', 'test query', { limit: 10 });
      
      expect(key1).toBe(key2);
    });

    test('should generate different search keys for different options', () => {
      const key1 = cache.generateSearchKey('npm', 'test', { limit: 10 });
      const key2 = cache.generateSearchKey('npm', 'test', { limit: 20 });
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('memory management', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('should evict old entries from memory cache', async () => {
      // Fill memory cache beyond its limit
      for (let i = 0; i < 1500; i++) {
        const key = cache.generateCacheKey('package', 'npm', `package-${i}`, '1.0.0');
        cache.memoryCache.set(key, { name: `package-${i}` });
      }
      
      // Memory cache should have evicted old entries
      expect(cache.memoryCache.size).toBeLessThanOrEqual(1000);
    });

    test('should update age on cache access', async () => {
      const packageInfo = { name: 'test-package', version: '1.0.0' };
      
      await cache.setPackageInfo('npm', 'test-package', '1.0.0', packageInfo);
      
      // Access the item to update its age
      await cache.getPackageInfo('npm', 'test-package', '1.0.0');
      
      // The item should still be in memory cache
      const key = cache.generateCacheKey('package', 'npm', 'test-package', '1.0.0');
      expect(cache.memoryCache.has(key)).toBe(true);
    });
  });
});