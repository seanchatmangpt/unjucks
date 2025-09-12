import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { Storage } from './storage.js'
import { GarbageCollector } from './gc.js'

/**
 * KGEN Cache Manager
 * 
 * Provides content-addressed caching with LRU eviction,
 * deterministic hash-based lookups, and configurable policies.
 */
export class CacheManager {
  constructor(options = {}) {
    this.options = {
      cacheDir: options.cacheDir || path.join(os.homedir(), '.kgen', 'cache'),
      maxAge: options.maxAge || '90d',
      maxSize: options.maxSize || '5GB',
      strategy: options.strategy || 'lru',
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      ...options
    }
    
    this.storage = new Storage(this.options)
    this.gc = new GarbageCollector(this.options)
    this.initialized = false
  }

  /**
   * Initialize cache system
   */
  async init() {
    if (this.initialized) return
    
    await this.storage.init()
    await this.gc.init()
    this.gc.setStorage(this.storage)
    this.initialized = true
  }

  /**
   * Generate content hash for deterministic lookup
   */
  generateHash(content, metadata = {}) {
    const hash = createHash(this.options.hashAlgorithm)
    
    // Hash content
    if (typeof content === 'string') {
      hash.update(content, 'utf8')
    } else if (Buffer.isBuffer(content)) {
      hash.update(content)
    } else {
      hash.update(JSON.stringify(content), 'utf8')
    }
    
    // Include relevant metadata in hash
    const hashableMetadata = {
      version: metadata.version,
      type: metadata.type,
      dependencies: metadata.dependencies
    }
    
    if (Object.keys(hashableMetadata).some(key => hashableMetadata[key] !== undefined)) {
      hash.update(JSON.stringify(hashableMetadata), 'utf8')
    }
    
    return hash.digest('hex')
  }

  /**
   * Store content in cache with metadata
   */
  async set(key, content, metadata = {}) {
    await this.init()
    
    const hash = this.generateHash(content, metadata)
    const entry = {
      key,
      hash,
      content,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        size: this.calculateSize(content)
      }
    }
    
    await this.storage.store(hash, entry)
    await this.storage.updateIndex(key, hash)
    
    return hash
  }

  /**
   * Retrieve content from cache
   */
  async get(key) {
    await this.init()
    
    const hash = await this.storage.getHashByKey(key)
    if (!hash) return null
    
    const entry = await this.storage.retrieve(hash)
    if (!entry) return null
    
    // Update access time for LRU
    entry.metadata.accessedAt = Date.now()
    await this.storage.store(hash, entry)
    
    return {
      content: entry.content,
      metadata: entry.metadata,
      hash: entry.hash
    }
  }

  /**
   * Check if content exists in cache
   */
  async has(key) {
    await this.init()
    
    const hash = await this.storage.getHashByKey(key)
    return hash ? await this.storage.exists(hash) : false
  }

  /**
   * Get content by hash directly
   */
  async getByHash(hash) {
    await this.init()
    
    const entry = await this.storage.retrieve(hash)
    if (!entry) return null
    
    // Update access time
    entry.metadata.accessedAt = Date.now()
    await this.storage.store(hash, entry)
    
    return {
      content: entry.content,
      metadata: entry.metadata,
      hash: entry.hash
    }
  }

  /**
   * Remove entry from cache
   */
  async delete(key) {
    await this.init()
    
    const hash = await this.storage.getHashByKey(key)
    if (!hash) return false
    
    await this.storage.remove(hash)
    await this.storage.removeFromIndex(key)
    
    return true
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    await this.init()
    await this.storage.clear()
  }

  /**
   * List all cache entries
   */
  async list() {
    await this.init()
    return await this.storage.list()
  }

  /**
   * Get cache statistics
   */
  async stats() {
    await this.init()
    return await this.storage.stats()
  }

  /**
   * Run garbage collection
   */
  async gc(options = {}) {
    await this.init()
    return await this.gc.run({
      ...this.options,
      ...options
    })
  }

  /**
   * Calculate size of content
   */
  calculateSize(content) {
    if (typeof content === 'string') {
      return Buffer.byteLength(content, 'utf8')
    } else if (Buffer.isBuffer(content)) {
      return content.length
    } else {
      return Buffer.byteLength(JSON.stringify(content), 'utf8')
    }
  }

  /**
   * Parse size string to bytes
   */
  static parseSize(sizeStr) {
    if (typeof sizeStr === 'number') return sizeStr
    
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/i)
    if (!match) throw new Error(`Invalid size format: ${sizeStr}`)
    
    const [, num, unit = 'B'] = match
    const value = parseFloat(num)
    
    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4
    }
    
    const multiplier = multipliers[unit.toUpperCase()] || 1
    return Math.floor(value * multiplier)
  }

  /**
   * Parse age string to milliseconds
   */
  static parseAge(ageStr) {
    if (typeof ageStr === 'number') return ageStr
    
    const match = ageStr.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i)
    if (!match) throw new Error(`Invalid age format: ${ageStr}`)
    
    const [, num, unit = 's'] = match
    const value = parseFloat(num)
    
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    }
    
    const multiplier = multipliers[unit.toLowerCase()] || 1000
    return Math.floor(value * multiplier)
  }
}

export default CacheManager