import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ContentAddressedStorage } from '../../src/cas/storage.js';
import { GarbageCollector } from '../../src/cas/gc.js';

describe('GarbageCollector', () => {
  let storage: ContentAddressedStorage;
  let gc: GarbageCollector;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cas-gc-test-${Date.now()}-${Math.random().toString(36)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    storage = new ContentAddressedStorage({
      cacheDir: tempDir,
      compression: false
    });
    
    gc = new GarbageCollector(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('reference counting', () => {
    it('should track reference counts', () => {
      const hash = 'a'.repeat(64);
      
      expect(gc.getRefCount(hash)).toBe(0);
      
      gc.incrementRef(hash);
      expect(gc.getRefCount(hash)).toBe(1);
      
      gc.incrementRef(hash);
      expect(gc.getRefCount(hash)).toBe(2);
      
      gc.decrementRef(hash);
      expect(gc.getRefCount(hash)).toBe(1);
      
      gc.decrementRef(hash);
      expect(gc.getRefCount(hash)).toBe(0);
      
      // Should not go below 0
      gc.decrementRef(hash);
      expect(gc.getRefCount(hash)).toBe(0);
    });

    it('should mark content as accessed', () => {
      const hash = 'b'.repeat(64);
      
      // markAccessed should work without errors
      expect(() => gc.markAccessed(hash)).not.toThrow();
    });
  });

  describe('findOrphans', () => {
    it('should find orphaned content', async () => {
      // Store some content
      const content1 = 'orphan content 1';
      const content2 = 'referenced content';
      
      const hash1 = await storage.store(content1, 'templates');
      const hash2 = await storage.store(content2, 'templates');
      
      // Manually set reference counts (simulating normal usage)
      gc.decrementRef(hash1); // Make hash1 an orphan (ref count = 0)
      gc.incrementRef(hash2); // Keep hash2 referenced (ref count = 2)
      
      const orphans = await gc.findOrphans();
      
      expect(orphans).toHaveLength(1);
      expect(orphans[0].hash).toBe(hash1);
    });

    it('should return empty array when no orphans exist', async () => {
      const content = 'referenced content';
      const hash = await storage.store(content, 'templates');
      
      // Content stored through storage automatically gets ref count = 1
      const orphans = await gc.findOrphans();
      
      expect(orphans).toEqual([]);
    });
  });

  describe('getAllRefCounts', () => {
    it('should return reference count entries for all content', async () => {
      const content1 = 'content 1';
      const content2 = 'content 2';
      
      const hash1 = await storage.store(content1, 'templates');
      const hash2 = await storage.store(content2, 'graphs');
      
      const refCounts = await gc.getAllRefCounts();
      
      expect(refCounts).toHaveLength(2);
      
      const entry1 = refCounts.find(e => e.hash === hash1);
      const entry2 = refCounts.find(e => e.hash === hash2);
      
      expect(entry1).toBeTruthy();
      expect(entry1!.type).toBe('templates');
      expect(entry1!.refCount).toBe(1);
      expect(entry1!.size).toBe(Buffer.from(content1).length);
      
      expect(entry2).toBeTruthy();
      expect(entry2!.type).toBe('graphs');
      expect(entry2!.refCount).toBe(1);
      expect(entry2!.size).toBe(Buffer.from(content2).length);
    });

    it('should sort entries by reference count descending', async () => {
      const content = 'test content';
      const hash1 = await storage.store(content, 'templates');
      const hash2 = await storage.store('different content', 'graphs');
      
      // Increase ref count for hash2
      gc.incrementRef(hash2);
      gc.incrementRef(hash2);
      
      const refCounts = await gc.getAllRefCounts();
      
      expect(refCounts[0].hash).toBe(hash2);
      expect(refCounts[0].refCount).toBe(3); // 1 from store + 2 manual increments
      expect(refCounts[1].hash).toBe(hash1);
      expect(refCounts[1].refCount).toBe(1);
    });
  });

  describe('getCacheSize', () => {
    it('should calculate cache size correctly', async () => {
      const content1 = 'small content';
      const content2 = 'larger content with more text';
      
      await storage.store(content1, 'templates');
      await storage.store(content2, 'graphs');
      
      const cacheSize = await gc.getCacheSize();
      
      expect(cacheSize.itemCount).toBe(2);
      expect(cacheSize.totalSize).toBe(
        Buffer.from(content1).length + Buffer.from(content2).length
      );
      expect(cacheSize.sizeByType.templates).toBe(Buffer.from(content1).length);
      expect(cacheSize.sizeByType.graphs).toBe(Buffer.from(content2).length);
      expect(cacheSize.sizeByType.artifacts).toBe(0);
      expect(cacheSize.sizeByType.packs).toBe(0);
    });

    it('should return zero for empty cache', async () => {
      const cacheSize = await gc.getCacheSize();
      
      expect(cacheSize.itemCount).toBe(0);
      expect(cacheSize.totalSize).toBe(0);
      expect(cacheSize.sizeByType.templates).toBe(0);
    });
  });

  describe('collect', () => {
    it('should perform dry run garbage collection', async () => {
      const content = 'gc test content';
      const hash = await storage.store(content, 'templates');
      
      // Make it an orphan
      gc.decrementRef(hash);
      
      const stats = await gc.collect({ 
        dryRun: true, 
        minRefCount: 1,
        verbose: false 
      });
      
      expect(stats.totalItems).toBe(1);
      expect(stats.deletedItems).toBe(1);
      expect(stats.bytesFreed).toBe(Buffer.from(content).length);
      expect(stats.errors).toEqual([]);
      
      // Content should still exist after dry run
      expect(await storage.exists(hash, 'templates')).toBe(true);
    });

    it('should actually delete content when not in dry run mode', async () => {
      const content = 'delete test content';
      const hash = await storage.store(content, 'templates');
      
      // Make it an orphan
      gc.decrementRef(hash);
      
      const stats = await gc.collect({ 
        dryRun: false, 
        minRefCount: 1,
        verbose: false 
      });
      
      expect(stats.deletedItems).toBe(1);
      
      // Content should be deleted
      expect(await storage.exists(hash, 'templates')).toBe(false);
    });

    it('should preserve content with sufficient references', async () => {
      const content = 'preserve test content';
      const hash = await storage.store(content, 'templates');
      
      // Keep it referenced (already has 1 ref from store)
      gc.incrementRef(hash);
      
      const stats = await gc.collect({ 
        dryRun: false, 
        minRefCount: 1,
        verbose: false 
      });
      
      expect(stats.deletedItems).toBe(0);
      
      // Content should still exist
      expect(await storage.exists(hash, 'templates')).toBe(true);
    });

    it('should preserve specified content types', async () => {
      const content = 'preserve type test';
      const hash1 = await storage.store(content, 'templates');
      const hash2 = await storage.store(content, 'graphs');
      
      // Make both orphans
      gc.decrementRef(hash1);
      gc.decrementRef(hash2);
      
      const stats = await gc.collect({ 
        dryRun: false, 
        minRefCount: 1,
        preserveTypes: ['templates'],
        verbose: false 
      });
      
      expect(stats.deletedItems).toBe(1);
      
      // Templates should be preserved, graphs should be deleted
      expect(await storage.exists(hash1, 'templates')).toBe(true);
      expect(await storage.exists(hash2, 'graphs')).toBe(false);
    });

    it('should delete content older than max age', async () => {
      // Mock Date.now to control time
      const now = Date.now();
      const oldTime = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      vi.spyOn(Date, 'now').mockReturnValue(oldTime);
      
      const content = 'old content';
      const hash = await storage.store(content, 'templates');
      
      // Restore current time
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const stats = await gc.collect({ 
        dryRun: false, 
        maxAge: 5, // 5 days max age
        verbose: false 
      });
      
      expect(stats.deletedItems).toBe(1);
      expect(await storage.exists(hash, 'templates')).toBe(false);
      
      vi.restoreAllMocks();
    });
  });

  describe('cleanupByCacheSize', () => {
    it('should not clean up when under size limit', async () => {
      const content = 'small content';
      await storage.store(content, 'templates');
      
      const stats = await gc.cleanupByCacheSize(1024 * 1024, { verbose: false }); // 1MB limit
      
      expect(stats.deletedItems).toBe(0);
    });

    it('should clean up oldest content when over size limit', async () => {
      // Store content with some delay to ensure different timestamps
      const content1 = 'A'.repeat(500);
      const content2 = 'B'.repeat(500);
      
      const hash1 = await storage.store(content1, 'templates');
      
      // Small delay to ensure different creation times
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const hash2 = await storage.store(content2, 'templates');
      
      // Set a small cache limit
      const stats = await gc.cleanupByCacheSize(600, { dryRun: false, verbose: false });
      
      expect(stats.deletedItems).toBeGreaterThan(0);
      expect(stats.bytesFreed).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully during collection', async () => {
      const content = 'error test content';
      const hash = await storage.store(content, 'templates');
      
      // Make it an orphan
      gc.decrementRef(hash);
      
      // Mock fs.unlink to throw an error
      const originalUnlink = fs.unlink;
      vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('Mock deletion error'));
      
      const stats = await gc.collect({ 
        dryRun: false, 
        minRefCount: 1,
        verbose: false 
      });
      
      expect(stats.errors.length).toBeGreaterThan(0);
      expect(stats.errors[0]).toContain('Mock deletion error');
      
      // Restore original function
      vi.spyOn(fs, 'unlink').mockImplementation(originalUnlink);
      vi.restoreAllMocks();
    });
  });
});