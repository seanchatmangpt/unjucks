/**
 * Standardized LRU Cache Implementation
 * Based on the pattern from SPARQL query cache with improvements
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

export class LRUCache extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || null; // TTL in milliseconds, null = no expiration
    this.enableStats = options.enableStats !== false; // Default true
    this.namespace = options.namespace || 'cache';
    
    // Storage
    this.cache = new Map();
    this.accessOrder = new Map(); // Track access times for LRU
    this.accessCounter = 0;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      size: 0,
      maxSize: this.maxSize
    };
    
    // Setup TTL cleanup if enabled
    if (this.ttl) {
      this.cleanupInterval = setInterval(() => {
        this._cleanupExpired();
      }, Math.min(this.ttl / 10, 60000)); // Check every minute max
    }
  }
  
  /**
   * Get value from cache with LRU update
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      this.emit('miss', key);
      return null;
    }
    
    // Check TTL expiration
    if (this.ttl && this._isExpired(entry)) {
      this.delete(key);
      if (this.enableStats) this.stats.misses++;
      this.emit('miss', key);
      return null;
    }
    
    // Update access order (LRU)
    this.accessOrder.set(key, ++this.accessCounter);
    entry.lastAccessed = this.getDeterministicTimestamp();
    
    if (this.enableStats) this.stats.hits++;
    this.emit('hit', key);
    return entry.value;
  }
  
  /**
   * Set value in cache with LRU eviction if needed
   */
  set(key, value, options = {}) {
    // Check if we need to evict first
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }
    
    const entry = {
      value,
      cachedAt: this.getDeterministicTimestamp(),
      lastAccessed: this.getDeterministicTimestamp(),
      ttl: options.ttl || this.ttl,
      size: this._calculateSize(value)
    };
    
    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
    
    if (this.enableStats) {
      this.stats.sets++;
      this.stats.size = this.cache.size;
    }
    
    this.emit('set', key, value);
    return true;
  }
  
  /**
   * Check if key exists in cache
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check TTL expiration
    if (this.ttl && this._isExpired(entry)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete key from cache
   */
  delete(key) {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (existed && this.enableStats) {
      this.stats.size = this.cache.size;
    }
    
    if (existed) {
      this.emit('delete', key);
    }
    
    return existed;
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    
    if (this.enableStats) {
      this.stats.size = 0;
    }
    
    this.emit('clear', size);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      memoryUsage: this._calculateTotalSize(),
      oldestEntry: this._getOldestEntry(),
      newestEntry: this._getNewestEntry()
    };
  }
  
  /**
   * Get cache size info
   */
  size() {
    return this.cache.size;
  }
  
  /**
   * Get all keys (for debugging)
   */
  keys() {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Export cache state
   */
  export() {
    const entries = [];
    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        value: entry.value,
        cachedAt: entry.cachedAt,
        lastAccessed: entry.lastAccessed,
        ttl: entry.ttl
      });
    }
    
    return {
      namespace: this.namespace,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries,
      stats: this.stats,
      exportedAt: this.getDeterministicTimestamp()
    };
  }
  
  /**
   * Import cache state
   */
  import(data) {
    this.clear();
    
    if (data.entries) {
      for (const entry of data.entries) {
        // Only import non-expired entries
        if (!this.ttl || !this._isExpired({ cachedAt: entry.cachedAt, ttl: entry.ttl })) {
          this.cache.set(entry.key, {
            value: entry.value,
            cachedAt: entry.cachedAt,
            lastAccessed: entry.lastAccessed || entry.cachedAt,
            ttl: entry.ttl,
            size: this._calculateSize(entry.value)
          });
          this.accessOrder.set(entry.key, ++this.accessCounter);
        }
      }
    }
    
    if (this.enableStats && data.stats) {
      this.stats = { ...this.stats, ...data.stats };
      this.stats.size = this.cache.size;
    }
    
    this.emit('import', data.entries?.length || 0);
  }
  
  /**
   * Evict least recently used entry
   */
  _evictLRU() {
    if (this.cache.size === 0) return;
    
    // Find the key with the smallest access counter (oldest)
    let oldestKey = null;
    let oldestCounter = Infinity;
    
    for (const [key, counter] of this.accessOrder.entries()) {
      if (counter < oldestCounter) {
        oldestCounter = counter;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      
      if (this.enableStats) {
        this.stats.evictions++;
        this.stats.size = this.cache.size;
      }
      
      this.emit('evict', oldestKey);
    }
  }
  
  /**
   * Clean up expired entries
   */
  _cleanupExpired() {
    if (!this.ttl) return;
    
    let cleaned = 0;
    const now = this.getDeterministicTimestamp();
    
    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry, now)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      if (this.enableStats) {
        this.stats.size = this.cache.size;
      }
      this.emit('cleanup', cleaned);
    }
  }
  
  /**
   * Check if entry is expired
   */
  _isExpired(entry, now = this.getDeterministicTimestamp()) {
    if (!entry.ttl) return false;
    return (now - entry.cachedAt) > entry.ttl;
  }
  
  /**
   * Calculate size of value (rough estimate)
   */
  _calculateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // Unicode chars are 2 bytes
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // Rough estimate for primitives
    }
  }
  
  /**
   * Calculate total memory usage
   */
  _calculateTotalSize() {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size || 0;
    }
    return total;
  }
  
  /**
   * Get oldest entry info
   */
  _getOldestEntry() {
    if (this.cache.size === 0) return null;
    
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    return oldestKey ? {
      key: oldestKey,
      lastAccessed: oldestTime,
      age: this.getDeterministicTimestamp() - oldestTime
    } : null;
  }
  
  /**
   * Get newest entry info
   */
  _getNewestEntry() {
    if (this.cache.size === 0) return null;
    
    let newestKey = null;
    let newestTime = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed > newestTime) {
        newestTime = entry.lastAccessed;
        newestKey = key;
      }
    }
    
    return newestKey ? {
      key: newestKey,
      lastAccessed: newestTime,
      age: this.getDeterministicTimestamp() - newestTime
    } : null;
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
    this.removeAllListeners();
  }
}

/**
 * Create an LRU cache with SPARQL query-specific enhancements
 */
export class SPARQLQueryCache extends LRUCache {
  constructor(options = {}) {
    super({
      maxSize: options.maxCacheSize || 1000,
      ttl: options.cacheTTL || 60000, // 1 minute default
      namespace: 'sparql-query',
      ...options
    });
  }
  
  /**
   * Generate cache key for SPARQL query
   */
  generateKey(query, options = {}) {
    const optionsString = JSON.stringify(options, null, 0);
    return crypto.createHash('sha256').update(query + optionsString).digest('hex');
  }
  
  /**
   * Cache query results with metadata
   */
  cacheResults(query, results, options = {}) {
    const key = this.generateKey(query, options);
    const value = {
      ...results,
      cachedAt: this.getDeterministicDate(),
      query: options.includeQuery ? query : undefined
    };
    
    return this.set(key, value, options);
  }
  
  /**
   * Get cached query results
   */
  getCachedResults(query, options = {}) {
    const key = this.generateKey(query, options);
    return this.get(key);
  }
}

/**
 * Create an LRU cache for template caching
 */
export class TemplateCache extends LRUCache {
  constructor(options = {}) {
    super({
      maxSize: options.maxSize || 100,
      ttl: options.ttl || 300000, // 5 minutes
      namespace: 'template',
      ...options
    });
  }
  
  /**
   * Generate cache key for template
   */
  generateKey(templatePath, context = {}) {
    const contextHash = crypto.createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return `${templatePath}:${contextHash}`;
  }
  
  /**
   * Cache template with file modification check
   */
  cacheTemplate(templatePath, content, context = {}, fileStats = null) {
    const key = this.generateKey(templatePath, context);
    const value = {
      content,
      path: templatePath,
      context,
      fileStats,
      size: Buffer.byteLength(content, 'utf8')
    };
    
    return this.set(key, value);
  }
  
  /**
   * Get cached template with validation
   */
  getCachedTemplate(templatePath, context = {}) {
    const key = this.generateKey(templatePath, context);
    return this.get(key);
  }
}

export default LRUCache;