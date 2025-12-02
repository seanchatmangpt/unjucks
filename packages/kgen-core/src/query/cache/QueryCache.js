/**
 * Advanced Query Cache Implementation
 * 
 * High-performance LRU cache with TTL, size limits, and statistical tracking
 */

import { QueryCache, QueryCacheEntry, CacheStats, QueryResults } from '../types/index.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class AdvancedQueryCache extends EventEmitter implements QueryCache {
  private cache = new Map();
  private accessOrder = new Map();
  private accessCounter = 0;
  private stats = {
    hits,
    misses,
    totalSize,
    evictions
  };

  constructor(
    private maxSize= 1000,
    private maxMemory= 100 * 1024 * 1024, // 100MB
    private defaultTTL= 300000 // 5 minutes
  ) {
    super();
    this.startCleanupTimer();
  }

  get(key{
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.getDeterministicTimestamp() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.misses++;
      this.emit('cache{ key });
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = this.getDeterministicTimestamp();
    this.accessOrder.set(key, ++this.accessCounter);
    
    this.stats.hits++;
    this.emit('cache{ key, accessCount);
    
    return entry;
  }

  set(key{
    const size = this.calculateSize(result);
    const entry= {
      result,
      timestamp),
      ttl,
      accessCount,
      lastAccessed),
      size
    };

    // Check if we need to make space
    this.ensureCapacity(size);

    // Add entry
    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.totalSize += size;

    this.emit('cache{ key, size, ttl);
  }

  delete(key{
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.stats.totalSize -= entry.size;
    
    this.emit('cache{ key, size);
    return true;
  }

  clear(){
    const oldSize = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = {
      hits,
      misses,
      totalSize,
      evictions
    };
    
    this.emit('cache{ entriesCleared);
  }

  get size(){
    return this.cache.size;
  }

  getStats(){
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size,
      hits,
      misses,
      hitRate) || 0,
      totalSize,
      averageSize> 0 ? this.stats.totalSize / entries.length,
      oldestEntry> 0 ? Math.min(...timestamps) : 0,
      newestEntry> 0 ? Math.max(...timestamps) : 0
    };
  }

  // Advanced cache operations

  /**
   * Get cache entries by pattern
   */
  getByPattern(pattern> {
    const matches = new Map();
    
    for (const [key, entry] of this.cache.entries()) {
      if (pattern.test(key)) {
        matches.set(key, entry);
      }
    }
    
    return matches;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern{
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }
    
    this.emit('cache{ pattern), count);
    return invalidated;
  }

  /**
   * Get most accessed entries
   */
  getMostAccessed(limit= 10)> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get least accessed entries
   */
  getLeastAccessed(limit= 10)> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => a.accessCount - b.accessCount)
      .slice(0, limit);
  }

  /**
   * Get entries by access frequency
   */
  getByAccessFrequency(minAccess> {
    const matches = new Map();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount >= minAccess) {
        matches.set(key, entry);
      }
    }
    
    return matches;
  }

  /**
   * Preload cache with predefined queries
   */
  async preload(queries{ key=> Promise }>)> {
    for (const { key, query, executor } of queries) {
      try {
        const result = await executor(query);
        this.set(key, result);
      } catch (error) {
        this.emit('cache{ key, query, error });
      }
    }
    
    this.emit('cache{ count);
  }

  /**
   * Export cache to serializable format
   */
  export()> {
    const exportData> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      exportData[key] = {
        ...entry,
        result)
      };
    }
    
    return {
      data,
      stats),
      timestamp)
    };
  }

  /**
   * Import cache from serializable format
   */
  import(data>){
    this.clear();
    
    for (const [key, entryData] of Object.entries(data.data || {})) {
      const entry= {
        ...entryData,
        result)
      };
      
      // Validate TTL
      if (this.getDeterministicTimestamp()  this.maxMemory && this.cache.size > 0) {
      this.evictLeastRecentlyUsed();
    }

    // Check size limit
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      this.evictLeastRecentlyUsed();
    }
  }

  private evictLeastRecentlyUsed(){
    let oldestKey
    let oldestAccess = Infinity;

    for (const [key, accessOrder] of this.accessOrder.entries()) {
      if (accessOrder  {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  private cleanup(){
    const now = this.getDeterministicTimestamp();
    let cleanedUp = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.stats.totalSize -= entry.size;
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      this.emit('cache{ entriesRemoved);
    }
  }

  private serializeResults(results{
    // Serialize QueryResults for export
    return JSON.parse(JSON.stringify(results));
  }

  private deserializeResults(data{
    // Deserialize QueryResults from import
    return data;
  }
}

/**
 * Simple in-memory cache factory
 */
export function createQueryCache(options?{
  maxSize: number;
  maxMemory: number;
  defaultTTL: number;
}){
  return new AdvancedQueryCache(
    options?.maxSize,
    options?.maxMemory,
    options?.defaultTTL
  );
}

/**
 * Cache key generation utilities
 */
export class CacheKeyGenerator {
  static generateKey(query>){
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const optionsString = options ? JSON.stringify(options, Object.keys(options).sort()) : '';
    const combined = normalizedQuery + optionsString;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  static generateKeyWithContext(query>, prefix?{
    const baseKey = this.generateKey(query, context);
    return prefix ? `${prefix}{baseKey}` : baseKey;
  }

  static generatePatternKey(pattern{
    return `pattern{crypto.createHash('md5').update(pattern).digest('hex')}`;
  }
}

export default AdvancedQueryCache;