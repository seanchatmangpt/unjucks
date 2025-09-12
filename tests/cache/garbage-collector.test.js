import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { CacheManager } from '../../packages/kgen-core/src/cache/index.js'
import { GarbageCollector } from '../../packages/kgen-core/src/cache/gc.js'

describe('GarbageCollector', () => {
  let cacheManager
  let testCacheDir

  beforeEach(async () => {
    testCacheDir = path.join(os.tmpdir(), 'kgen-gc-test-' + Date.now())
    
    cacheManager = new CacheManager({
      cacheDir: testCacheDir,
      maxAge: '1d',
      maxSize: '1MB',
      strategy: 'lru'
    })
    
    await cacheManager.init()
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('LRU strategy', () => {
    it('should remove least recently accessed entries when over size limit', async () => {
      // Add entries with different access patterns
      await cacheManager.set('old', 'x'.repeat(1000))
      await cacheManager.set('recent', 'y'.repeat(1000))
      await cacheManager.set('newest', 'z'.repeat(1000))
      
      // Access 'recent' and 'newest' to make 'old' the LRU
      await cacheManager.get('recent')
      await cacheManager.get('newest')
      
      // Force garbage collection with very small limit
      const result = await cacheManager.gc({
        maxSize: '1500B', // Should keep only newest entries
        strategy: 'lru'
      })
      
      expect(result.removed.length).toBeGreaterThan(0)
      expect(result.strategy).toBe('lru')
      
      // 'old' should be removed (LRU)
      const oldEntry = await cacheManager.get('old')
      expect(oldEntry).toBeNull()
      
      // More recent entries should remain
      const recentEntry = await cacheManager.get('recent')
      const newestEntry = await cacheManager.get('newest')
      expect(recentEntry || newestEntry).not.toBeNull()
    })

    it('should remove expired entries regardless of LRU', async () => {
      // Add entry that will be "expired"
      await cacheManager.set('old', 'content')
      
      const result = await cacheManager.gc({
        maxAge: '1ms', // Everything is expired
        strategy: 'lru'
      })
      
      expect(result.removed.length).toBe(1)
      expect(result.removed[0].reason).toBe('expired')
      
      const entry = await cacheManager.get('old')
      expect(entry).toBeNull()
    })
  })

  describe('FIFO strategy', () => {
    it('should remove oldest entries first', async () => {
      // Add entries with small delays to ensure different timestamps
      await cacheManager.set('first', 'content1')
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await cacheManager.set('second', 'content2')
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await cacheManager.set('third', 'content3')
      
      // Access first entry to make it recently used (but still oldest by creation)
      await cacheManager.get('first')
      
      const result = await cacheManager.gc({
        maxSize: '20B', // Force removal
        strategy: 'fifo'
      })
      
      expect(result.removed.length).toBeGreaterThan(0)
      expect(result.strategy).toBe('fifo')
      
      // First entry should be removed despite being recently accessed
      const firstEntry = await cacheManager.get('first')
      expect(firstEntry).toBeNull()
    })
  })

  describe('size-based strategy', () => {
    it('should remove largest entries first', async () => {
      // Add entries of different sizes
      await cacheManager.set('small', 'x'.repeat(10))
      await cacheManager.set('large', 'y'.repeat(1000))
      await cacheManager.set('medium', 'z'.repeat(100))
      
      const result = await cacheManager.gc({
        maxSize: '50B', // Should remove largest entries first
        strategy: 'size'
      })
      
      expect(result.removed.length).toBeGreaterThan(0)
      expect(result.strategy).toBe('size')
      
      // Large entry should be removed first
      const largeEntry = await cacheManager.get('large')
      expect(largeEntry).toBeNull()
      
      // Small entry should likely remain
      const smallEntry = await cacheManager.get('small')
      expect(smallEntry).not.toBeNull()
    })
  })

  describe('age-based strategy', () => {
    it('should remove only expired entries', async () => {
      await cacheManager.set('entry1', 'content1')
      await cacheManager.set('entry2', 'content2')
      
      const result = await cacheManager.gc({
        maxAge: '1ms', // Everything is expired
        strategy: 'age'
      })
      
      expect(result.removed.length).toBe(2)
      expect(result.removed.every(r => r.reason === 'age-expired')).toBe(true)
      
      const stats = await cacheManager.stats()
      expect(stats.fileCount).toBe(0)
    })

    it('should not remove non-expired entries', async () => {
      await cacheManager.set('entry1', 'content1')
      
      const result = await cacheManager.gc({
        maxAge: '1h', // Not expired
        strategy: 'age'
      })
      
      expect(result.removed.length).toBe(0)
      
      const entry = await cacheManager.get('entry1')
      expect(entry).not.toBeNull()
    })
  })

  describe('hybrid strategy', () => {
    it('should apply multiple criteria', async () => {
      // Add a mix of entries
      await cacheManager.set('old-large', 'x'.repeat(1000))
      await cacheManager.set('new-small', 'y'.repeat(10))
      
      const result = await cacheManager.gc({
        maxAge: '1ms', // Make old-large "expired"
        maxSize: '500B', // Force size-based removal
        strategy: 'hybrid'
      })
      
      expect(result.removed.length).toBeGreaterThan(0)
      expect(result.strategy).toBe('hybrid')
    })
  })

  describe('analysis mode', () => {
    beforeEach(async () => {
      // Add test data
      await cacheManager.set('key1', 'x'.repeat(500), { type: 'text' })
      await cacheManager.set('key2', 'y'.repeat(1000), { type: 'binary' })
      await cacheManager.set('key3', 'z'.repeat(100), { type: 'json' })
    })

    it('should analyze without removing entries', async () => {
      const analysis = await cacheManager.gc.analyze({
        maxSize: '800B',
        strategy: 'lru'
      })
      
      expect(analysis).toHaveProperty('stats')
      expect(analysis).toHaveProperty('totalEntries')
      expect(analysis).toHaveProperty('recommendations')
      expect(analysis).toHaveProperty('potentialSavings')
      
      expect(analysis.totalEntries).toBe(3)
      expect(analysis.recommendations.length).toBeGreaterThan(0)
      expect(analysis.potentialSavings).toBeGreaterThan(0)
      
      // Entries should still exist after analysis
      const stats = await cacheManager.stats()
      expect(stats.fileCount).toBe(3)
    })

    it('should provide detailed recommendations', async () => {
      const analysis = await cacheManager.gc.analyze({
        maxSize: '500B',
        strategy: 'size'
      })
      
      expect(analysis.recommendations.length).toBeGreaterThan(0)
      
      for (const rec of analysis.recommendations) {
        expect(rec).toHaveProperty('hash')
        expect(rec).toHaveProperty('size')
        expect(rec).toHaveProperty('age')
        expect(rec).toHaveProperty('reason')
        expect(typeof rec.size).toBe('number')
        expect(typeof rec.age).toBe('number')
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty cache', async () => {
      const result = await cacheManager.gc()
      
      expect(result.removed.length).toBe(0)
      expect(result.kept.length).toBe(0)
    })

    it('should handle corrupted entries gracefully', async () => {
      // Add a valid entry
      await cacheManager.set('valid', 'content')
      
      // Manually corrupt the storage by removing a file but keeping metadata
      const entries = await cacheManager.storage.getAllEntries()
      if (entries.length > 0) {
        const entry = entries[0]
        const storePath = cacheManager.storage.getStoragePath(entry.hash)
        
        try {
          await fs.unlink(storePath)
        } catch (error) {
          // File might not exist, that's fine for this test
        }
      }
      
      // GC should handle the corruption
      const result = await cacheManager.gc()
      
      // Should complete without throwing
      expect(result).toHaveProperty('removed')
      expect(result).toHaveProperty('kept')
    })

    it('should respect configuration limits', async () => {
      // Test with zero limits
      await cacheManager.set('test', 'content')
      
      const result = await cacheManager.gc({
        maxSize: '0B',
        maxAge: '0ms'
      })
      
      expect(result.removed.length).toBe(1)
      
      const stats = await cacheManager.stats()
      expect(stats.fileCount).toBe(0)
    })
  })

  describe('performance', () => {
    it('should handle large number of entries efficiently', async () => {
      // Add many small entries
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cacheManager.set(`key${i}`, `content${i}`))
      }
      await Promise.all(promises)
      
      const startTime = Date.now()
      
      const result = await cacheManager.gc({
        maxSize: '1KB',
        strategy: 'lru'
      })
      
      const duration = Date.now() - startTime
      
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.removed.length).toBeGreaterThan(0)
    })
  })
})