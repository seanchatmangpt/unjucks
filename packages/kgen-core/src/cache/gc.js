import { CacheManager } from './index.js'

/**
 * Garbage Collection System
 * 
 * Implements LRU, size-based, and age-based eviction policies
 * with configurable strategies for cache maintenance.
 */
export class GarbageCollector {
  constructor(options = {}) {
    this.options = options
    this.storage = null
  }

  /**
   * Initialize garbage collector
   */
  async init() {
    // Will be set by CacheManager
  }

  /**
   * Set storage reference
   */
  setStorage(storage) {
    this.storage = storage
  }

  /**
   * Run garbage collection with specified policies
   */
  async run(options = {}) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }

    const config = {
      ...this.options,
      ...options
    }

    const results = {
      before: await this.storage.stats(),
      removed: [],
      kept: [],
      strategy: config.strategy || 'lru'
    }

    // Get all entries
    const entries = await this.storage.getAllEntries()
    
    if (entries.length === 0) {
      results.after = results.before
      return results
    }

    // Apply eviction strategies
    let toRemove = []
    
    switch (config.strategy) {
      case 'lru':
        toRemove = await this.applyLRU(entries, config)
        break
      case 'fifo':
        toRemove = await this.applyFIFO(entries, config)
        break
      case 'size':
        toRemove = await this.applySizeBased(entries, config)
        break
      case 'age':
        toRemove = await this.applyAgeBased(entries, config)
        break
      case 'hybrid':
        toRemove = await this.applyHybrid(entries, config)
        break
      default:
        toRemove = await this.applyLRU(entries, config)
    }

    // Remove selected entries
    for (const entry of toRemove) {
      try {
        await this.storage.remove(entry.hash)
        
        // Remove from index if key exists
        if (entry.key) {
          await this.storage.removeFromIndex(entry.key)
        }
        
        results.removed.push({
          hash: entry.hash,
          key: entry.key,
          size: entry.metadata?.size || 0,
          age: Date.now() - (entry.metadata?.createdAt || 0),
          reason: entry.removeReason
        })
      } catch (error) {
        // Continue with other entries if one fails
        console.warn(`Failed to remove cache entry ${entry.hash}:`, error.message)
      }
    }

    // Track kept entries
    const removedHashes = new Set(toRemove.map(e => e.hash))
    results.kept = entries
      .filter(e => !removedHashes.has(e.hash))
      .map(e => ({
        hash: e.hash,
        key: e.key,
        size: e.metadata?.size || 0,
        age: Date.now() - (e.metadata?.createdAt || 0)
      }))

    results.after = await this.storage.stats()
    
    return results
  }

  /**
   * Apply Least Recently Used (LRU) eviction
   */
  async applyLRU(entries, config) {
    const maxSize = CacheManager.parseSize(config.maxSize)
    const maxAge = CacheManager.parseAge(config.maxAge)
    const now = Date.now()
    
    const toRemove = []
    let totalSize = 0
    
    // First pass: remove expired entries
    for (const entry of entries) {
      const age = now - (entry.metadata?.createdAt || 0)
      if (age > maxAge) {
        entry.removeReason = 'expired'
        toRemove.push(entry)
        continue
      }
      totalSize += entry.metadata?.size || 0
    }
    
    // Second pass: apply LRU if over size limit
    if (totalSize > maxSize) {
      const validEntries = entries.filter(e => !toRemove.includes(e))
      
      // Sort by last accessed time (LRU first)
      validEntries.sort((a, b) => {
        const aAccessed = a.metadata?.accessedAt || a.metadata?.createdAt || 0
        const bAccessed = b.metadata?.accessedAt || b.metadata?.createdAt || 0
        return aAccessed - bAccessed
      })
      
      let currentSize = validEntries.reduce((sum, e) => sum + (e.metadata?.size || 0), 0)
      
      for (const entry of validEntries) {
        if (currentSize <= maxSize) break
        
        entry.removeReason = 'lru-size'
        toRemove.push(entry)
        currentSize -= entry.metadata?.size || 0
      }
    }
    
    return toRemove
  }

  /**
   * Apply First In, First Out (FIFO) eviction
   */
  async applyFIFO(entries, config) {
    const maxSize = CacheManager.parseSize(config.maxSize)
    const maxAge = CacheManager.parseAge(config.maxAge)
    const now = Date.now()
    
    const toRemove = []
    
    // Remove expired entries
    for (const entry of entries) {
      const age = now - (entry.metadata?.createdAt || 0)
      if (age > maxAge) {
        entry.removeReason = 'expired'
        toRemove.push(entry)
      }
    }
    
    const validEntries = entries.filter(e => !toRemove.includes(e))
    const totalSize = validEntries.reduce((sum, e) => sum + (e.metadata?.size || 0), 0)
    
    if (totalSize > maxSize) {
      // Sort by creation time (oldest first)
      validEntries.sort((a, b) => {
        return (a.metadata?.createdAt || 0) - (b.metadata?.createdAt || 0)
      })
      
      let currentSize = totalSize
      
      for (const entry of validEntries) {
        if (currentSize <= maxSize) break
        
        entry.removeReason = 'fifo-size'
        toRemove.push(entry)
        currentSize -= entry.metadata?.size || 0
      }
    }
    
    return toRemove
  }

  /**
   * Apply size-based eviction (largest files first)
   */
  async applySizeBased(entries, config) {
    const maxSize = CacheManager.parseSize(config.maxSize)
    const maxAge = CacheManager.parseAge(config.maxAge)
    const now = Date.now()
    
    const toRemove = []
    
    // Remove expired entries first
    for (const entry of entries) {
      const age = now - (entry.metadata?.createdAt || 0)
      if (age > maxAge) {
        entry.removeReason = 'expired'
        toRemove.push(entry)
      }
    }
    
    const validEntries = entries.filter(e => !toRemove.includes(e))
    const totalSize = validEntries.reduce((sum, e) => sum + (e.metadata?.size || 0), 0)
    
    if (totalSize > maxSize) {
      // Sort by size (largest first)
      validEntries.sort((a, b) => {
        return (b.metadata?.size || 0) - (a.metadata?.size || 0)
      })
      
      let currentSize = totalSize
      
      for (const entry of validEntries) {
        if (currentSize <= maxSize) break
        
        entry.removeReason = 'size-based'
        toRemove.push(entry)
        currentSize -= entry.metadata?.size || 0
      }
    }
    
    return toRemove
  }

  /**
   * Apply age-based eviction
   */
  async applyAgeBased(entries, config) {
    const maxAge = CacheManager.parseAge(config.maxAge)
    const now = Date.now()
    
    const toRemove = []
    
    for (const entry of entries) {
      const age = now - (entry.metadata?.createdAt || 0)
      if (age > maxAge) {
        entry.removeReason = 'age-expired'
        toRemove.push(entry)
      }
    }
    
    return toRemove
  }

  /**
   * Apply hybrid strategy (age + LRU + size)
   */
  async applyHybrid(entries, config) {
    const maxSize = CacheManager.parseSize(config.maxSize)
    const maxAge = CacheManager.parseAge(config.maxAge)
    const now = Date.now()
    
    const toRemove = []
    
    // Phase 1: Remove expired entries
    const expiredEntries = entries.filter(entry => {
      const age = now - (entry.metadata?.createdAt || 0)
      return age > maxAge
    })
    
    expiredEntries.forEach(entry => {
      entry.removeReason = 'expired'
      toRemove.push(entry)
    })
    
    // Phase 2: Check size constraints
    const validEntries = entries.filter(e => !toRemove.includes(e))
    let totalSize = validEntries.reduce((sum, e) => sum + (e.metadata?.size || 0), 0)
    
    if (totalSize > maxSize) {
      // Sort by composite score: recency + size efficiency
      validEntries.forEach(entry => {
        const age = now - (entry.metadata?.accessedAt || entry.metadata?.createdAt || 0)
        const size = entry.metadata?.size || 0
        
        // Higher score = more likely to be removed
        entry.hybridScore = (age / (24 * 60 * 60 * 1000)) + (size / (1024 * 1024))
      })
      
      validEntries.sort((a, b) => b.hybridScore - a.hybridScore)
      
      for (const entry of validEntries) {
        if (totalSize <= maxSize) break
        
        entry.removeReason = 'hybrid-optimization'
        toRemove.push(entry)
        totalSize -= entry.metadata?.size || 0
      }
    }
    
    return toRemove
  }

  /**
   * Get eviction recommendations without removing entries
   */
  async analyze(options = {}) {
    if (!this.storage) {
      throw new Error('Storage not initialized')
    }

    const config = {
      ...this.options,
      ...options
    }

    const entries = await this.storage.getAllEntries()
    const stats = await this.storage.stats()
    
    const analysis = {
      stats,
      totalEntries: entries.length,
      recommendations: [],
      potentialSavings: 0
    }

    if (entries.length === 0) return analysis

    // Analyze what would be removed
    let toRemove = []
    
    switch (config.strategy || 'lru') {
      case 'lru':
        toRemove = await this.applyLRU(entries, config)
        break
      case 'fifo':
        toRemove = await this.applyFIFO(entries, config)
        break
      case 'size':
        toRemove = await this.applySizeBased(entries, config)
        break
      case 'age':
        toRemove = await this.applyAgeBased(entries, config)
        break
      case 'hybrid':
        toRemove = await this.applyHybrid(entries, config)
        break
    }

    analysis.recommendations = toRemove.map(entry => ({
      hash: entry.hash,
      key: entry.key,
      size: entry.metadata?.size || 0,
      age: Date.now() - (entry.metadata?.createdAt || 0),
      reason: entry.removeReason
    }))

    analysis.potentialSavings = toRemove.reduce((sum, e) => sum + (e.metadata?.size || 0), 0)

    return analysis
  }
}

export default GarbageCollector