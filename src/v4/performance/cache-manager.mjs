/**
 * @file Cache Manager
 * @module unjucks-v4/performance/cache-manager
 * @description Content-addressed caching with 80/20 optimization
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';

/**
 * Cache Manager - Manages content-addressed cache
 * 
 * @class CacheManager
 * @extends EventEmitter
 */
export class CacheManager extends EventEmitter {
  /**
   * Create a new CacheManager instance
   * @param {Object} options - Cache options
   * @param {number} options.maxSize - Maximum cache size
   * @param {number} options.ttl - Time to live in ms
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      maxSize: options.maxSize || 10000,
      ttl: options.ttl || 3600000, // 1 hour default
      ...options
    };

    this.cache = new Map();
    this.accessOrder = []; // For LRU eviction
  }

  /**
   * Generate content hash
   * @param {string} content - Content to hash
   * @returns {string} Hash
   */
  hash(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Object|null} Cached value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access order (LRU)
    this._updateAccessOrder(key);

    this.emit('cache:hit', { key });
    return entry.value;
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Cache options
   * @returns {void}
   */
  set(key, value, options = {}) {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (options.ttl || this.config.ttl),
      accessCount: 0
    };

    this.cache.set(key, entry);
    this._updateAccessOrder(key);

    this.emit('cache:set', { key });
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.emit('cache:cleared');
  }

  /**
   * Update access order for LRU
   * @private
   * @param {string} key - Cache key
   */
  _updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
      this.emit('cache:evicted', { key: lruKey });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses
      entries: Array.from(this.cache.keys())
    };
  }
}


