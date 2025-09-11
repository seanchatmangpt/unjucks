/**
 * Advanced Query Cache Implementation
 * 
 * High-performance LRU cache with TTL, size limits, and statistical tracking
 */

import { QueryCache, QueryCacheEntry, CacheStats, QueryResults } from '../types/index.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class AdvancedQueryCache extends EventEmitter implements QueryCache {
  private cache = new Map<string, QueryCacheEntry>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private stats = {
    hits: 0,
    misses: 0,
    totalSize: 0,
    evictions: 0
  };

  constructor(
    private maxSize: number = 1000,
    private maxMemory: number = 100 * 1024 * 1024, // 100MB
    private defaultTTL: number = 300000 // 5 minutes
  ) {
    super();
    this.startCleanupTimer();
  }

  get(key: string): QueryCacheEntry | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.misses++;
      this.emit('cache:expired', { key });
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.accessCounter);
    
    this.stats.hits++;
    this.emit('cache:hit', { key, accessCount: entry.accessCount });
    
    return entry;
  }

  set(key: string, result: QueryResults, ttl?: number): void {
    const size = this.calculateSize(result);
    const entry: QueryCacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    };

    // Check if we need to make space
    this.ensureCapacity(size);

    // Add entry
    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.totalSize += size;

    this.emit('cache:set', { key, size, ttl: entry.ttl });
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.stats.totalSize -= entry.size;
    
    this.emit('cache:deleted', { key, size: entry.size });
    return true;
  }

  clear(): void {
    const oldSize = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalSize: 0,
      evictions: 0
    };
    
    this.emit('cache:cleared', { entriesCleared: oldSize });
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      totalSize: this.stats.totalSize,
      averageSize: entries.length > 0 ? this.stats.totalSize / entries.length : 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  // Advanced cache operations

  /**
   * Get cache entries by pattern
   */
  getByPattern(pattern: RegExp): Map<string, QueryCacheEntry> {
    const matches = new Map<string, QueryCacheEntry>();
    
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
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }
    
    this.emit('cache:pattern_invalidated', { pattern: pattern.toString(), count: invalidated });
    return invalidated;
  }

  /**
   * Get most accessed entries
   */
  getMostAccessed(limit: number = 10): Array<[string, QueryCacheEntry]> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get least accessed entries
   */
  getLeastAccessed(limit: number = 10): Array<[string, QueryCacheEntry]> {
    const entries = Array.from(this.cache.entries());
    return entries
      .sort(([, a], [, b]) => a.accessCount - b.accessCount)
      .slice(0, limit);
  }

  /**
   * Get entries by access frequency
   */
  getByAccessFrequency(minAccess: number): Map<string, QueryCacheEntry> {
    const matches = new Map<string, QueryCacheEntry>();
    
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
  async preload(queries: Array<{ key: string; query: string; executor: (query: string) => Promise<QueryResults> }>): Promise<void> {
    for (const { key, query, executor } of queries) {
      try {
        const result = await executor(query);
        this.set(key, result);
      } catch (error) {
        this.emit('cache:preload_error', { key, query, error });
      }
    }
    
    this.emit('cache:preloaded', { count: queries.length });
  }

  /**
   * Export cache to serializable format
   */
  export(): Record<string, any> {
    const exportData: Record<string, any> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      exportData[key] = {
        ...entry,
        result: this.serializeResults(entry.result)
      };
    }
    
    return {
      data: exportData,
      stats: this.getStats(),
      timestamp: Date.now()
    };
  }

  /**
   * Import cache from serializable format
   */
  import(data: Record<string, any>): void {
    this.clear();
    
    for (const [key, entryData] of Object.entries(data.data || {})) {
      const entry: QueryCacheEntry = {
        ...entryData,
        result: this.deserializeResults(entryData.result)
      };
      
      // Validate TTL
      if (Date.now() <= entry.timestamp + entry.ttl) {
        this.cache.set(key, entry);
        this.stats.totalSize += entry.size;
      }
    }
    
    this.emit('cache:imported', { count: this.cache.size });
  }

  // Private methods

  private ensureCapacity(newEntrySize: number): void {
    // Check memory limit
    while (this.stats.totalSize + newEntrySize > this.maxMemory && this.cache.size > 0) {
      this.evictLeastRecentlyUsed();
    }

    // Check size limit
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      this.evictLeastRecentlyUsed();
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, accessOrder] of this.accessOrder.entries()) {
      if (accessOrder < oldestAccess) {
        oldestAccess = accessOrder;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      
      if (entry) {
        this.stats.totalSize -= entry.size;
      }
      
      this.stats.evictions++;
      this.emit('cache:evicted', { key: oldestKey, reason: 'lru' });
    }
  }

  private calculateSize(result: QueryResults): number {
    // Rough size calculation in bytes
    const jsonString = JSON.stringify(result);
    return jsonString.length * 2; // Approximate UTF-16 encoding
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now();
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
      this.emit('cache:cleanup', { entriesRemoved: cleanedUp });
    }
  }

  private serializeResults(results: QueryResults): any {
    // Serialize QueryResults for export
    return JSON.parse(JSON.stringify(results));
  }

  private deserializeResults(data: any): QueryResults {
    // Deserialize QueryResults from import
    return data as QueryResults;
  }
}

/**
 * Simple in-memory cache factory
 */
export function createQueryCache(options?: {
  maxSize?: number;
  maxMemory?: number;
  defaultTTL?: number;
}): QueryCache {
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
  static generateKey(query: string, options?: Record<string, any>): string {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const optionsString = options ? JSON.stringify(options, Object.keys(options).sort()) : '';
    const combined = normalizedQuery + optionsString;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  static generateKeyWithContext(query: string, context?: Record<string, any>, prefix?: string): string {
    const baseKey = this.generateKey(query, context);
    return prefix ? `${prefix}:${baseKey}` : baseKey;
  }

  static generatePatternKey(pattern: string): string {
    return `pattern:${crypto.createHash('md5').update(pattern).digest('hex')}`;
  }
}

export default AdvancedQueryCache;