import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { Storage } from './storage.js'
import { GarbageCollector } from './gc.js'

/**
 * KGEN Optimized Cache Manager - ALPHA-8 Performance Enhanced
 * 
 * Provides content-addressed caching with:
 * - L1 memory cache for sub-millisecond access
 * - Predictive cache warming
 * - Intelligent access pattern tracking
 * - Performance metrics and monitoring
 * - Async storage operations for better throughput
 */
export class OptimizedCacheManager {
  constructor(options = {}) {
    this.options = {
      cacheDir: options.cacheDir || path.join(os.homedir(), '.kgen', 'cache'),
      maxAge: options.maxAge || '90d',
      maxSize: options.maxSize || '5GB',
      strategy: options.strategy || 'lru',
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      enablePredictiveWarm: options.enablePredictiveWarm !== false,
      warmupBatchSize: options.warmupBatchSize || 100,
      accessCountThreshold: options.accessCountThreshold || 3,
      memCacheMaxSize: options.memCacheMaxSize || 1000,
      asyncStorageThreshold: options.asyncStorageThreshold || 1024, // 1KB
      ...options
    }
    
    this.storage = new Storage(this.options)
    this.gc = new GarbageCollector(this.options)
    this.initialized = false
    
    // Performance optimizations
    this.memoryCache = new Map() // L1 cache for frequently accessed items
    this.accessPatterns = new Map() // Track access patterns for predictive warming
    this.hitStats = { hits: 0, misses: 0, totalRequests: 0 }
    this.performanceMetrics = {
      storageOps: [],
      retrievalOps: [],
      warmingEvents: []
    }
    
    // Warming state
    this.warmupScheduled = false
    this.lastWarmup = 0
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
    
    // Perform initial warmup if enabled
    if (this.options.enablePredictiveWarm) {
      setTimeout(() => this.initialWarmup(), 1000)
    }
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
   * Store content in cache with metadata (optimized for performance)
   */
  async set(key, content, metadata = {}) {
    const startTime = performance.now()
    await this.init()
    
    const hash = this.generateHash(content, metadata)
    const timestamp = Date.now()
    const size = this.calculateSize(content)
    
    const entry = {
      key,
      hash,
      content,
      metadata: {
        ...metadata,
        createdAt: timestamp,
        accessedAt: timestamp,
        accessCount: 1,
        size
      }
    }
    
    // Store in memory cache for immediate access
    this.memoryCache.set(key, {
      content,
      metadata: entry.metadata,
      hash
    })
    
    // Manage memory cache size
    this.evictMemoryCacheIfNeeded()
    
    // Choose storage strategy based on content size
    const storePromise = Promise.all([
      this.storage.store(hash, entry),
      this.storage.updateIndex(key, hash)
    ])
    
    // Track performance
    const duration = performance.now() - startTime
    this.performanceMetrics.storageOps.push(duration)
    
    // Small content stores synchronously for consistency
    if (size < this.options.asyncStorageThreshold) {
      await storePromise
    } else {
      // Large content stores async to avoid blocking
      storePromise.catch(err => console.warn('Async cache storage failed:', err))
    }
    
    return hash
  }

  /**
   * Retrieve content from cache (optimized with L1 cache and warming)
   */
  async get(key) {
    const startTime = performance.now()
    await this.init()
    
    this.hitStats.totalRequests++
    
    // Check L1 memory cache first (sub-millisecond access)
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key)
      this.hitStats.hits++
      
      // Update access patterns
      this.updateAccessPattern(key, true)
      
      const duration = performance.now() - startTime
      this.performanceMetrics.retrievalOps.push(duration)
      
      // Move to front for LRU
      this.memoryCache.delete(key)
      this.memoryCache.set(key, cached)
      
      return {
        content: cached.content,
        metadata: { ...cached.metadata, accessedAt: Date.now() },
        hash: cached.hash,
        fromMemory: true
      }
    }
    
    const hash = await this.storage.getHashByKey(key)
    if (!hash) {
      this.hitStats.misses++
      this.updateAccessPattern(key, false)
      return null
    }
    
    const entry = await this.storage.retrieve(hash)
    if (!entry) {
      this.hitStats.misses++
      return null
    }
    
    this.hitStats.hits++
    
    // Update access metadata
    const now = Date.now()
    entry.metadata.accessedAt = now
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1
    
    // Store in memory cache for future access
    this.memoryCache.set(key, {
      content: entry.content,
      metadata: entry.metadata,
      hash: entry.hash
    })
    
    // Manage memory cache size
    this.evictMemoryCacheIfNeeded()
    
    // Update access patterns and trigger warming if needed
    this.updateAccessPattern(key, true)
    
    // Async update to storage (don't block retrieval)
    this.storage.store(hash, entry).catch(err => 
      console.warn('Cache access update failed:', err)
    )
    
    const duration = performance.now() - startTime
    this.performanceMetrics.retrievalOps.push(duration)
    
    return {
      content: entry.content,
      metadata: entry.metadata,
      hash: entry.hash,
      fromMemory: false
    }
  }

  /**
   * Check if content exists in cache (optimized)
   */
  async has(key) {
    await this.init()
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return true
    }
    
    const hash = await this.storage.getHashByKey(key)
    return hash ? await this.storage.exists(hash) : false
  }

  /**
   * Get content by hash directly (optimized)
   */
  async getByHash(hash) {
    await this.init()
    
    // Check if any memory cache entries match this hash
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.hash === hash) {
        return {
          content: cached.content,
          metadata: { ...cached.metadata, accessedAt: Date.now() },
          hash: cached.hash,
          fromMemory: true
        }
      }
    }
    
    const entry = await this.storage.retrieve(hash)
    if (!entry) return null
    
    // Update access time
    const now = Date.now()
    entry.metadata.accessedAt = now
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1
    
    // Async update to storage
    this.storage.store(hash, entry).catch(err => 
      console.warn('Cache access update failed:', err)
    )
    
    return {
      content: entry.content,
      metadata: entry.metadata,
      hash: entry.hash,
      fromMemory: false
    }
  }

  /**
   * Remove entry from cache (optimized)
   */
  async delete(key) {
    await this.init()
    
    // Remove from memory cache
    this.memoryCache.delete(key)
    
    // Remove access patterns
    this.accessPatterns.delete(key)
    
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
    
    // Clear memory structures
    this.memoryCache.clear()
    this.accessPatterns.clear()
    this.clearMetrics()
    
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
   * Get cache statistics (enhanced with performance metrics)
   */
  async stats() {
    await this.init()
    const baseStats = await this.storage.stats()
    const perfStats = this.getPerformanceStats()
    
    return {
      ...baseStats,
      performance: perfStats,
      memoryCache: {
        size: this.memoryCache.size,
        maxSize: this.options.memCacheMaxSize
      },
      accessPatterns: {
        tracked: this.accessPatterns.size
      }
    }
  }

  /**
   * Run garbage collection
   */
  async gc(options = {}) {
    await this.init()
    
    // Clean memory cache first
    this.evictMemoryCacheIfNeeded(true)
    
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
   * Update access patterns for predictive warming
   */
  updateAccessPattern(key, hit) {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, {
        count: 0,
        lastAccess: Date.now(),
        hits: 0,
        misses: 0
      })
    }
    
    const pattern = this.accessPatterns.get(key)
    pattern.count++
    pattern.lastAccess = Date.now()
    
    if (hit) {
      pattern.hits++
    } else {
      pattern.misses++
    }
    
    // Trigger predictive warming for frequently accessed items
    if (this.options.enablePredictiveWarm && 
        pattern.count >= this.options.accessCountThreshold &&
        !this.warmupScheduled) {
      this.scheduleWarmup()
    }
  }

  /**
   * Schedule cache warmup for frequently accessed items
   */
  scheduleWarmup() {
    if (this.warmupScheduled || Date.now() - this.lastWarmup < 30000) return
    
    this.warmupScheduled = true
    setTimeout(async () => {
      try {
        await this.performWarmup()
        this.lastWarmup = Date.now()
      } catch (error) {
        console.warn('Cache warmup failed:', error.message)
      } finally {
        this.warmupScheduled = false
      }
    }, 100) // Delay to batch warmup operations
  }

  /**
   * Perform predictive cache warming
   */
  async performWarmup() {
    const startTime = performance.now()
    
    // Find frequently accessed items not in memory cache
    const candidates = []
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (!this.memoryCache.has(key) && 
          pattern.hits > pattern.misses && 
          pattern.count >= this.options.accessCountThreshold) {
        candidates.push({ 
          key, 
          score: pattern.hits / pattern.count,
          lastAccess: pattern.lastAccess
        })
      }
    }
    
    // Sort by access score and recency
    candidates.sort((a, b) => {
      const scoreCompare = b.score - a.score
      if (Math.abs(scoreCompare) < 0.1) {
        return b.lastAccess - a.lastAccess // More recent first
      }
      return scoreCompare
    })
    
    const toWarm = candidates.slice(0, this.options.warmupBatchSize)
    
    let warmed = 0
    for (const { key } of toWarm) {
      try {
        const hash = await this.storage.getHashByKey(key)
        if (hash && !this.memoryCache.has(key)) {
          const entry = await this.storage.retrieve(hash)
          if (entry) {
            this.memoryCache.set(key, {
              content: entry.content,
              metadata: entry.metadata,
              hash: entry.hash
            })
            warmed++
            
            // Check if we need to evict to make room
            if (this.memoryCache.size >= this.options.memCacheMaxSize) {
              break
            }
          }
        }
      } catch (error) {
        console.warn(`Warmup failed for key ${key}:`, error.message)
      }
    }
    
    const duration = performance.now() - startTime
    this.performanceMetrics.warmingEvents.push({
      timestamp: Date.now(),
      candidates: candidates.length,
      warmed,
      duration
    })
    
    // Manage memory cache size after warming
    this.evictMemoryCacheIfNeeded()
  }

  /**
   * Initial warmup from existing cache entries
   */
  async initialWarmup() {
    try {
      const entries = await this.storage.list()
      const recentEntries = entries
        .filter(e => e.exists && e.metadata?.accessedAt)
        .sort((a, b) => (b.metadata?.accessedAt || 0) - (a.metadata?.accessedAt || 0))
        .slice(0, Math.min(this.options.warmupBatchSize, this.options.memCacheMaxSize))
      
      let warmed = 0
      for (const entry of recentEntries) {
        try {
          const fullEntry = await this.storage.retrieve(entry.hash)
          if (fullEntry) {
            this.memoryCache.set(entry.key, {
              content: fullEntry.content,
              metadata: fullEntry.metadata,
              hash: fullEntry.hash
            })
            warmed++
          }
        } catch (error) {
          console.warn(`Initial warmup failed for ${entry.key}:`, error.message)
        }
      }
      
      if (warmed > 0) {
        this.performanceMetrics.warmingEvents.push({
          timestamp: Date.now(),
          type: 'initial',
          warmed,
          duration: 0
        })
      }
    } catch (error) {
      console.warn('Initial warmup failed:', error.message)
    }
  }

  /**
   * Evict items from memory cache using LRU
   */
  evictMemoryCacheIfNeeded(aggressive = false) {
    const maxSize = aggressive ? 
      Math.floor(this.options.memCacheMaxSize * 0.7) : 
      this.options.memCacheMaxSize
      
    while (this.memoryCache.size > maxSize) {
      // Remove oldest entry (first in Map iteration order)
      const firstKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(firstKey)
    }
  }

  /**
   * Get cache hit rate and performance statistics
   */
  getPerformanceStats() {
    const hitRate = this.hitStats.totalRequests > 0 
      ? (this.hitStats.hits / this.hitStats.totalRequests) * 100 
      : 0
    
    const avgStorageTime = this.performanceMetrics.storageOps.length > 0
      ? this.performanceMetrics.storageOps.reduce((a, b) => a + b, 0) / this.performanceMetrics.storageOps.length
      : 0
      
    const avgRetrievalTime = this.performanceMetrics.retrievalOps.length > 0
      ? this.performanceMetrics.retrievalOps.reduce((a, b) => a + b, 0) / this.performanceMetrics.retrievalOps.length
      : 0
    
    // Get recent performance (last 100 operations)
    const recentStorage = this.performanceMetrics.storageOps.slice(-100)
    const recentRetrieval = this.performanceMetrics.retrievalOps.slice(-100)
    
    const recentAvgStorage = recentStorage.length > 0
      ? recentStorage.reduce((a, b) => a + b, 0) / recentStorage.length
      : avgStorageTime
      
    const recentAvgRetrieval = recentRetrieval.length > 0
      ? recentRetrieval.reduce((a, b) => a + b, 0) / recentRetrieval.length
      : avgRetrievalTime
    
    return {
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests: this.hitStats.totalRequests,
      hits: this.hitStats.hits,
      misses: this.hitStats.misses,
      memoryCacheSize: this.memoryCache.size,
      accessPatternsTracked: this.accessPatterns.size,
      avgStorageTime: Math.round(avgStorageTime * 100) / 100,
      avgRetrievalTime: Math.round(avgRetrievalTime * 100) / 100,
      recentAvgStorageTime: Math.round(recentAvgStorage * 100) / 100,
      recentAvgRetrievalTime: Math.round(recentAvgRetrieval * 100) / 100,
      warmingEvents: this.performanceMetrics.warmingEvents.length,
      performance: {
        storageTarget: 5, // ms
        retrievalTarget: 2, // ms
        hitRateTarget: 80, // %
        storageStatus: recentAvgStorage <= 5 ? 'PASS' : 'FAIL',
        retrievalStatus: recentAvgRetrieval <= 2 ? 'PASS' : 'FAIL',
        hitRateStatus: hitRate >= 80 ? 'PASS' : 'FAIL'
      },
      lastWarmup: this.lastWarmup,
      memCacheUtilization: Math.round((this.memoryCache.size / this.options.memCacheMaxSize) * 100)
    }
  }

  /**
   * Clear performance metrics (for testing)
   */
  clearMetrics() {
    this.hitStats = { hits: 0, misses: 0, totalRequests: 0 }
    this.performanceMetrics = {
      storageOps: [],
      retrievalOps: [],
      warmingEvents: []
    }
  }

  /**
   * Stress test the cache with configurable load
   */
  async stressTest(options = {}) {
    const {
      operations = 1000,
      contentSize = 1024,
      keyPrefix = 'stress-test',
      readWriteRatio = 0.7, // 70% reads, 30% writes
      concurrency = 10
    } = options
    
    const startTime = performance.now()
    this.clearMetrics()
    
    // Generate test content
    const testContent = 'x'.repeat(contentSize)
    const testKeys = Array.from({ length: operations }, (_, i) => `${keyPrefix}-${i}`)
    
    // Pre-populate some data for reads
    const prePopulate = Math.floor(operations * 0.3)
    for (let i = 0; i < prePopulate; i++) {
      await this.set(testKeys[i], testContent, { type: 'stress-test' })
    }
    
    // Create operation mix
    const ops = []
    for (let i = 0; i < operations; i++) {
      if (Math.random() < readWriteRatio && i < prePopulate) {
        // Read operation
        ops.push({ type: 'read', key: testKeys[i] })
      } else {
        // Write operation
        ops.push({ type: 'write', key: testKeys[i], content: testContent })
      }
    }
    
    // Run operations with concurrency
    const results = []
    for (let i = 0; i < ops.length; i += concurrency) {
      const batch = ops.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async op => {
          const opStart = performance.now()
          try {
            if (op.type === 'read') {
              await this.get(op.key)
            } else {
              await this.set(op.key, op.content, { type: 'stress-test' })
            }
            return { success: true, duration: performance.now() - opStart }
          } catch (error) {
            return { success: false, error: error.message, duration: performance.now() - opStart }
          }
        })
      )
      results.push(...batchResults)
    }
    
    const totalTime = performance.now() - startTime
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    
    const perfStats = this.getPerformanceStats()
    
    return {
      summary: {
        totalOperations: operations,
        successful: successful.length,
        failed: failed.length,
        successRate: Math.round((successful.length / operations) * 100),
        totalTime: Math.round(totalTime),
        opsPerSecond: Math.round(operations / (totalTime / 1000))
      },
      performance: perfStats,
      config: {
        contentSize,
        readWriteRatio,
        concurrency,
        prePopulated: prePopulate
      },
      failures: failed.slice(0, 10) // First 10 failures for analysis
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

export default OptimizedCacheManager