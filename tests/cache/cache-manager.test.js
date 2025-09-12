import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { CacheManager } from '../../packages/kgen-core/src/cache/index.js'

describe('CacheManager', () => {
  let cacheManager
  let testCacheDir

  beforeEach(async () => {
    // Create unique test cache directory
    testCacheDir = path.join(os.tmpdir(), 'kgen-cache-test-' + this.getDeterministicTimestamp())
    
    cacheManager = new CacheManager({
      cacheDir: testCacheDir,
      maxAge: '1d',
      maxSize: '100MB',
      strategy: 'lru'
    })
    
    await cacheManager.init()
  })

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('content hashing', () => {
    it('should generate consistent hashes for same content', () => {
      const content = 'test content'
      const hash1 = cacheManager.generateHash(content)
      const hash2 = cacheManager.generateHash(content)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('should generate different hashes for different content', () => {
      const hash1 = cacheManager.generateHash('content 1')
      const hash2 = cacheManager.generateHash('content 2')
      
      expect(hash1).not.toBe(hash2)
    })

    it('should include metadata in hash when provided', () => {
      const content = 'test'
      const hash1 = cacheManager.generateHash(content)
      const hash2 = cacheManager.generateHash(content, { version: '1.0' })
      
      expect(hash1).not.toBe(hash2)
    })

    it('should handle different content types', () => {
      const stringHash = cacheManager.generateHash('test')
      const bufferHash = cacheManager.generateHash(Buffer.from('test'))
      const objectHash = cacheManager.generateHash({ test: 'data' })
      
      expect(stringHash).toMatch(/^[a-f0-9]{64}$/)
      expect(bufferHash).toMatch(/^[a-f0-9]{64}$/)
      expect(objectHash).toMatch(/^[a-f0-9]{64}$/)
      expect(stringHash).toBe(bufferHash) // Same content
      expect(stringHash).not.toBe(objectHash) // Different content
    })
  })

  describe('cache operations', () => {
    it('should store and retrieve content', async () => {
      const key = 'test-key'
      const content = 'test content'
      const metadata = { type: 'text', version: '1.0' }
      
      const hash = await cacheManager.set(key, content, metadata)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
      
      const retrieved = await cacheManager.get(key)
      expect(retrieved).not.toBeNull()
      expect(retrieved.content).toBe(content)
      expect(retrieved.hash).toBe(hash)
      expect(retrieved.metadata.type).toBe('text')
      expect(retrieved.metadata.version).toBe('1.0')
    })

    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent-key')
      expect(result).toBeNull()
    })

    it('should check existence of entries', async () => {
      const key = 'test-key'
      
      expect(await cacheManager.has(key)).toBe(false)
      
      await cacheManager.set(key, 'content')
      expect(await cacheManager.has(key)).toBe(true)
    })

    it('should retrieve content by hash', async () => {
      const key = 'test-key'
      const content = 'test content'
      
      const hash = await cacheManager.set(key, content)
      
      const retrieved = await cacheManager.getByHash(hash)
      expect(retrieved).not.toBeNull()
      expect(retrieved.content).toBe(content)
      expect(retrieved.hash).toBe(hash)
    })

    it('should delete entries', async () => {
      const key = 'test-key'
      
      await cacheManager.set(key, 'content')
      expect(await cacheManager.has(key)).toBe(true)
      
      const deleted = await cacheManager.delete(key)
      expect(deleted).toBe(true)
      expect(await cacheManager.has(key)).toBe(false)
    })

    it('should handle deletion of non-existent keys', async () => {
      const deleted = await cacheManager.delete('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('metadata tracking', () => {
    it('should track creation and access times', async () => {
      const key = 'test-key'
      const beforeTime = this.getDeterministicTimestamp()
      
      await cacheManager.set(key, 'content')
      
      const entry = await cacheManager.get(key)
      expect(entry.metadata.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(entry.metadata.accessedAt).toBeGreaterThanOrEqual(entry.metadata.createdAt)
    })

    it('should update access time on retrieval', async () => {
      const key = 'test-key'
      
      await cacheManager.set(key, 'content')
      const firstAccess = await cacheManager.get(key)
      
      // Wait a bit and access again
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const secondAccess = await cacheManager.get(key)
      expect(secondAccess.metadata.accessedAt).toBeGreaterThan(firstAccess.metadata.accessedAt)
    })

    it('should calculate content size', async () => {
      const key = 'test-key'
      const content = 'test content'
      
      await cacheManager.set(key, content)
      
      const entry = await cacheManager.get(key)
      expect(entry.metadata.size).toBe(Buffer.byteLength(content, 'utf8'))
    })
  })

  describe('cache listing and statistics', () => {
    beforeEach(async () => {
      // Add some test entries
      await cacheManager.set('key1', 'content1', { type: 'text' })
      await cacheManager.set('key2', { data: 'value' }, { type: 'json' })
      await cacheManager.set('key3', Buffer.from('binary'), { type: 'binary' })
    })

    it('should list all entries', async () => {
      const entries = await cacheManager.list()
      
      expect(entries).toHaveLength(3)
      expect(entries.every(e => e.exists)).toBe(true)
      expect(entries.every(e => e.hash && e.key && e.metadata)).toBe(true)
    })

    it('should provide cache statistics', async () => {
      const stats = await cacheManager.stats()
      
      expect(stats.fileCount).toBe(3)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.cacheDir).toBe(testCacheDir)
      expect(stats.oldestEntry).toBeInstanceOf(Date)
      expect(stats.newestEntry).toBeInstanceOf(Date)
    })
  })

  describe('cache clearing', () => {
    it('should clear all entries', async () => {
      // Add some entries
      await cacheManager.set('key1', 'content1')
      await cacheManager.set('key2', 'content2')
      
      let stats = await cacheManager.stats()
      expect(stats.fileCount).toBe(2)
      
      await cacheManager.clear()
      
      stats = await cacheManager.stats()
      expect(stats.fileCount).toBe(0)
      expect(stats.totalSize).toBe(0)
    })
  })

  describe('size and age parsing', () => {
    it('should parse size strings correctly', () => {
      expect(CacheManager.parseSize('100')).toBe(100)
      expect(CacheManager.parseSize('1KB')).toBe(1024)
      expect(CacheManager.parseSize('1MB')).toBe(1024 * 1024)
      expect(CacheManager.parseSize('1GB')).toBe(1024 * 1024 * 1024)
      expect(CacheManager.parseSize('2.5GB')).toBe(Math.floor(2.5 * 1024 * 1024 * 1024))
    })

    it('should handle invalid size strings', () => {
      expect(() => CacheManager.parseSize('invalid')).toThrow()
    })

    it('should parse age strings correctly', () => {
      expect(CacheManager.parseAge('30')).toBe(30000) // 30 seconds
      expect(CacheManager.parseAge('30s')).toBe(30000)
      expect(CacheManager.parseAge('5m')).toBe(5 * 60 * 1000)
      expect(CacheManager.parseAge('2h')).toBe(2 * 60 * 60 * 1000)
      expect(CacheManager.parseAge('7d')).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('should handle invalid age strings', () => {
      expect(() => CacheManager.parseAge('invalid')).toThrow()
    })
  })

  describe('garbage collection integration', () => {
    it('should run garbage collection', async () => {
      // Add some entries
      await cacheManager.set('key1', 'content1')
      await cacheManager.set('key2', 'content2')
      
      const result = await cacheManager.gc({
        maxSize: '1B', // Force removal
        strategy: 'size'
      })
      
      expect(result).toHaveProperty('before')
      expect(result).toHaveProperty('after')
      expect(result).toHaveProperty('removed')
      expect(result).toHaveProperty('kept')
      expect(result.strategy).toBe('size')
      expect(result.removed.length).toBeGreaterThan(0)
    })
  })
})