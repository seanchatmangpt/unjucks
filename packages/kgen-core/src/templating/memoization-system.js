/**
 * KGEN Template Memoization System
 * 
 * Advanced memoization and caching system for template rendering results,
 * function calls, and computed values with intelligent cache management.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Cache strategies
 */
export const CacheStrategy = {
  LRU: 'lru',           // Least Recently Used
  LFU: 'lfu',           // Least Frequently Used
  FIFO: 'fifo',         // First In, First Out
  TTL: 'ttl',           // Time To Live
  ADAPTIVE: 'adaptive'   // Adaptive based on usage patterns
};

/**
 * Cache levels
 */
export const CacheLevel = {
  MEMORY: 'memory',     // In-memory caching
  DISK: 'disk',         // Persistent disk caching
  DISTRIBUTED: 'distributed' // Distributed caching
};

/**
 * Memoization scopes
 */
export const MemoScope = {
  GLOBAL: 'global',     // Global across all templates
  TEMPLATE: 'template', // Per-template memoization
  CONTEXT: 'context',   // Per-context memoization
  SESSION: 'session'    // Per-session memoization
};

/**
 * Template Memoization System
 */
export class TemplateMemoizationSystem {
  constructor(options = {}) {
    this.options = {
      strategy: options.strategy || CacheStrategy.ADAPTIVE,
      level: options.level || CacheLevel.MEMORY,
      scope: options.scope || MemoScope.TEMPLATE,
      maxMemorySize: options.maxMemorySize || 100 * 1024 * 1024, // 100MB
      maxDiskSize: options.maxDiskSize || 500 * 1024 * 1024, // 500MB
      ttl: options.ttl || 1000 * 60 * 60, // 1 hour
      gcInterval: options.gcInterval || 1000 * 60 * 5, // 5 minutes
      compressionEnabled: options.compressionEnabled !== false,
      cacheDirectory: options.cacheDirectory || '.kgen/cache',
      enablePersistence: options.enablePersistence !== false,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };

    // Multi-level cache storage
    this.memoryCache = new Map();
    this.diskCache = new Map();
    this.metadataCache = new Map();
    
    // Cache strategy implementations
    this.strategies = {
      [CacheStrategy.LRU]: new LRUCache(this.options),
      [CacheStrategy.LFU]: new LFUCache(this.options),
      [CacheStrategy.FIFO]: new FIFOCache(this.options),
      [CacheStrategy.TTL]: new TTLCache(this.options),
      [CacheStrategy.ADAPTIVE]: new AdaptiveCache(this.options)
    };

    this.currentStrategy = this.strategies[this.options.strategy];

    // Memory management
    this.currentMemoryUsage = 0;
    this.maxMemoryReached = false;
    
    // Performance metrics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryHits: 0,
      diskHits: 0,
      compressionRatio: 0,
      averageLatency: 0,
      totalLatency: 0,
      operations: 0,
      memoryUsage: 0,
      diskUsage: 0
    };

    // Garbage collection
    this.gcTimer = null;
    this.startGarbageCollection();

    // Context and dependency tracking
    this.dependencyTracker = new DependencyTracker();
    this.contextHasher = new ContextHasher();
  }

  /**
   * Memoize a function call
   */
  async memoize(key, fn, options = {}) {
    const startTime = performance.now();
    this.stats.operations++;

    try {
      const memoKey = this.createMemoKey(key, options);
      
      // Check cache
      const cached = await this.get(memoKey, options);
      if (cached !== undefined) {
        this.stats.hits++;
        const latency = performance.now() - startTime;
        this.updateLatencyStats(latency);
        return cached.value;
      }

      this.stats.misses++;

      // Execute function
      const result = await fn();
      
      // Store in cache
      await this.set(memoKey, result, options);

      const latency = performance.now() - startTime;
      this.updateLatencyStats(latency);

      return result;

    } catch (error) {
      throw new Error(`Memoization failed for key ${key}: ${error.message}`);
    }
  }

  /**
   * Memoize template rendering result
   */
  async memoizeTemplate(templatePath, context, renderFn, options = {}) {
    const contextHash = this.contextHasher.hash(context);
    const key = `template:${templatePath}:${contextHash}`;
    
    return this.memoize(key, renderFn, {
      ...options,
      scope: MemoScope.TEMPLATE,
      dependencies: [templatePath]
    });
  }

  /**
   * Memoize filter result
   */
  async memoizeFilter(filterName, input, args, filterFn, options = {}) {
    const argsHash = this.contextHasher.hash(args);
    const inputHash = this.contextHasher.hash(input);
    const key = `filter:${filterName}:${inputHash}:${argsHash}`;
    
    return this.memoize(key, filterFn, {
      ...options,
      scope: MemoScope.GLOBAL,
      ttl: this.options.ttl * 2 // Filters can be cached longer
    });
  }

  /**
   * Memoize computation result
   */
  async memoizeComputation(computationId, inputs, computeFn, options = {}) {
    const inputHash = this.contextHasher.hash(inputs);
    const key = `compute:${computationId}:${inputHash}`;
    
    return this.memoize(key, computeFn, {
      ...options,
      scope: MemoScope.CONTEXT
    });
  }

  /**
   * Get value from cache
   */
  async get(key, options = {}) {
    const startTime = performance.now();

    try {
      // Check memory cache first
      const memoryResult = this.currentStrategy.get(key);
      if (memoryResult !== undefined) {
        this.stats.memoryHits++;
        return memoryResult;
      }

      // Check disk cache if enabled
      if (this.options.level === CacheLevel.DISK || this.options.level === CacheLevel.DISTRIBUTED) {
        const diskResult = await this.getDiskCache(key);
        if (diskResult !== undefined) {
          this.stats.diskHits++;
          
          // Promote to memory cache
          this.currentStrategy.set(key, diskResult, options);
          
          return diskResult;
        }
      }

      return undefined;

    } catch (error) {
      console.warn(`Cache get failed for key ${key}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, options = {}) {
    try {
      const metadata = {
        timestamp: Date.now(),
        accessCount: 0,
        lastAccess: Date.now(),
        size: this.estimateSize(value),
        ttl: options.ttl || this.options.ttl,
        scope: options.scope || this.options.scope,
        dependencies: options.dependencies || []
      };

      // Store in memory cache
      const success = this.currentStrategy.set(key, { value, metadata }, options);
      
      if (success) {
        this.currentMemoryUsage += metadata.size;
        this.stats.memoryUsage = this.currentMemoryUsage;
        
        // Track dependencies
        if (metadata.dependencies.length > 0) {
          this.dependencyTracker.track(key, metadata.dependencies);
        }
      }

      // Store in disk cache if enabled
      if (this.options.level === CacheLevel.DISK || this.options.level === CacheLevel.DISTRIBUTED) {
        await this.setDiskCache(key, { value, metadata });
      }

      return success;

    } catch (error) {
      console.warn(`Cache set failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    try {
      // Remove from memory
      const deleted = this.currentStrategy.delete(key);
      
      if (deleted && deleted.metadata) {
        this.currentMemoryUsage -= deleted.metadata.size;
        this.stats.memoryUsage = this.currentMemoryUsage;
      }

      // Remove from disk
      if (this.options.level === CacheLevel.DISK || this.options.level === CacheLevel.DISTRIBUTED) {
        await this.deleteDiskCache(key);
      }

      // Remove dependency tracking
      this.dependencyTracker.untrack(key);

      return true;

    } catch (error) {
      console.warn(`Cache delete failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Invalidate cache entries by dependency
   */
  async invalidateByDependency(dependency) {
    const dependentKeys = this.dependencyTracker.getDependents(dependency);
    
    for (const key of dependentKeys) {
      await this.delete(key);
    }

    return dependentKeys.length;
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];

    // Check memory cache
    for (const key of this.currentStrategy.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    // Delete matched keys
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Get from disk cache
   */
  async getDiskCache(key) {
    try {
      const cacheFile = join(this.options.cacheDirectory, `${this.hashKey(key)}.cache`);
      
      const data = await fs.readFile(cacheFile);
      let content = data;

      // Decompress if needed
      if (this.options.compressionEnabled) {
        const zlib = await import('zlib');
        content = await new Promise((resolve, reject) => {
          zlib.gunzip(data, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      const cached = JSON.parse(content.toString());
      
      // Check TTL
      if (this.isExpired(cached.metadata)) {
        await this.deleteDiskCache(key);
        return undefined;
      }

      return cached;

    } catch (error) {
      return undefined;
    }
  }

  /**
   * Set disk cache
   */
  async setDiskCache(key, data) {
    try {
      await fs.mkdir(this.options.cacheDirectory, { recursive: true });
      
      const cacheFile = join(this.options.cacheDirectory, `${this.hashKey(key)}.cache`);
      let content = JSON.stringify(data);

      // Compress if enabled
      if (this.options.compressionEnabled) {
        const zlib = await import('zlib');
        content = await new Promise((resolve, reject) => {
          zlib.gzip(Buffer.from(content), (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      await fs.writeFile(cacheFile, content);
      
      // Update disk usage stats
      const stats = await fs.stat(cacheFile);
      this.stats.diskUsage += stats.size;

    } catch (error) {
      console.warn(`Disk cache write failed: ${error.message}`);
    }
  }

  /**
   * Delete from disk cache
   */
  async deleteDiskCache(key) {
    try {
      const cacheFile = join(this.options.cacheDirectory, `${this.hashKey(key)}.cache`);
      const stats = await fs.stat(cacheFile);
      await fs.unlink(cacheFile);
      
      this.stats.diskUsage -= stats.size;

    } catch (error) {
      // File might not exist, ignore
    }
  }

  /**
   * Create memoization key
   */
  createMemoKey(key, options = {}) {
    const parts = [key];
    
    if (options.scope) {
      parts.push(`scope:${options.scope}`);
    }
    
    if (options.version) {
      parts.push(`v:${options.version}`);
    }

    return parts.join('|');
  }

  /**
   * Hash key for disk storage
   */
  hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Estimate memory size of value
   */
  estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }
    
    if (typeof value === 'number') {
      return 8;
    }
    
    if (typeof value === 'boolean') {
      return 1;
    }
    
    if (value === null || value === undefined) {
      return 0;
    }

    // Rough estimate for objects
    return JSON.stringify(value).length * 2;
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(metadata) {
    if (!metadata.ttl) return false;
    return Date.now() - metadata.timestamp > metadata.ttl;
  }

  /**
   * Update latency statistics
   */
  updateLatencyStats(latency) {
    this.stats.totalLatency += latency;
    this.stats.averageLatency = this.stats.totalLatency / this.stats.operations;
  }

  /**
   * Start garbage collection
   */
  startGarbageCollection() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.runGarbageCollection();
    }, this.options.gcInterval);
  }

  /**
   * Run garbage collection
   */
  runGarbageCollection() {
    const startTime = performance.now();
    let cleaned = 0;

    // Clean expired entries
    for (const key of this.currentStrategy.keys()) {
      const entry = this.currentStrategy.get(key);
      if (entry && entry.metadata && this.isExpired(entry.metadata)) {
        this.delete(key);
        cleaned++;
      }
    }

    // Memory pressure management
    if (this.currentMemoryUsage > this.options.maxMemorySize * 0.9) {
      const evicted = this.currentStrategy.evict(0.1); // Evict 10%
      this.stats.evictions += evicted;
      this.maxMemoryReached = true;
    } else {
      this.maxMemoryReached = false;
    }

    const gcTime = performance.now() - startTime;
    if (this.options.enableMetrics && cleaned > 0) {
      console.log(`GC: Cleaned ${cleaned} entries in ${gcTime.toFixed(2)}ms`);
    }
  }

  /**
   * Stop garbage collection
   */
  stopGarbageCollection() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /**
   * Clear all caches
   */
  async clear() {
    // Clear memory cache
    this.currentStrategy.clear();
    this.currentMemoryUsage = 0;
    
    // Clear disk cache
    try {
      const files = await fs.readdir(this.options.cacheDirectory);
      for (const file of files) {
        if (file.endsWith('.cache')) {
          await fs.unlink(join(this.options.cacheDirectory, file));
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    this.stats.diskUsage = 0;
    this.dependencyTracker.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses),
      memoryHitRate: this.stats.memoryHits / Math.max(this.stats.hits, 1),
      diskHitRate: this.stats.diskHits / Math.max(this.stats.hits, 1),
      memoryUsagePercent: this.currentMemoryUsage / this.options.maxMemorySize,
      cacheSize: this.currentStrategy.size(),
      strategy: this.options.strategy,
      level: this.options.level,
      maxMemoryReached: this.maxMemoryReached
    };
  }

  /**
   * Export cache contents
   */
  async exportCache() {
    const entries = [];
    
    for (const key of this.currentStrategy.keys()) {
      const entry = this.currentStrategy.get(key);
      if (entry) {
        entries.push({
          key,
          value: entry.value,
          metadata: entry.metadata
        });
      }
    }

    return {
      entries,
      stats: this.getStats(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopGarbageCollection();
    this.clear();
  }
}

/**
 * LRU Cache Strategy
 */
class LRUCache {
  constructor(options) {
    this.options = options;
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recent)
      this.cache.delete(key);
      this.cache.set(key, entry);
      entry.metadata.lastAccess = Date.now();
      entry.metadata.accessCount++;
      return entry;
    }
    return undefined;
  }

  set(key, value, options = {}) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove least recently used
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
    return true;
  }

  delete(key) {
    const entry = this.cache.get(key);
    this.cache.delete(key);
    return entry;
  }

  keys() {
    return this.cache.keys();
  }

  size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }

  evict(percentage) {
    const evictCount = Math.floor(this.cache.size * percentage);
    const keys = Array.from(this.cache.keys()).slice(0, evictCount);
    
    for (const key of keys) {
      this.cache.delete(key);
    }
    
    return evictCount;
  }
}

/**
 * LFU Cache Strategy
 */
class LFUCache extends LRUCache {
  evict(percentage) {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.metadata.accessCount - b.metadata.accessCount);
    
    const evictCount = Math.floor(entries.length * percentage);
    
    for (let i = 0; i < evictCount; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    return evictCount;
  }
}

/**
 * FIFO Cache Strategy
 */
class FIFOCache extends LRUCache {
  constructor(options) {
    super(options);
    this.insertOrder = [];
  }

  set(key, value, options = {}) {
    if (!this.cache.has(key)) {
      this.insertOrder.push(key);
    }
    
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.insertOrder.shift();
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, value);
    return true;
  }

  delete(key) {
    const entry = this.cache.get(key);
    this.cache.delete(key);
    
    const index = this.insertOrder.indexOf(key);
    if (index > -1) {
      this.insertOrder.splice(index, 1);
    }
    
    return entry;
  }
}

/**
 * TTL Cache Strategy
 */
class TTLCache extends LRUCache {
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() - entry.metadata.timestamp > entry.metadata.ttl) {
        this.cache.delete(key);
        return undefined;
      }
      entry.metadata.lastAccess = Date.now();
      entry.metadata.accessCount++;
      return entry;
    }
    return undefined;
  }
}

/**
 * Adaptive Cache Strategy
 */
class AdaptiveCache extends LRUCache {
  constructor(options) {
    super(options);
    this.hitPattern = new Map();
    this.currentStrategy = 'lru';
  }

  get(key) {
    const entry = super.get(key);
    if (entry) {
      this.recordHit(key);
    }
    return entry;
  }

  recordHit(key) {
    const pattern = this.hitPattern.get(key) || { hits: 0, lastHit: 0 };
    pattern.hits++;
    pattern.lastHit = Date.now();
    this.hitPattern.set(key, pattern);

    // Adapt strategy based on hit patterns
    this.adaptStrategy();
  }

  adaptStrategy() {
    // Simple adaptation logic - can be enhanced
    const avgHits = Array.from(this.hitPattern.values())
      .reduce((sum, pattern) => sum + pattern.hits, 0) / this.hitPattern.size;

    if (avgHits > 10) {
      this.currentStrategy = 'lfu'; // Favor frequently used items
    } else {
      this.currentStrategy = 'lru'; // Favor recently used items
    }
  }
}

/**
 * Dependency Tracker
 */
class DependencyTracker {
  constructor() {
    this.dependencies = new Map(); // key -> [dependencies]
    this.dependents = new Map();   // dependency -> [keys]
  }

  track(key, dependencies) {
    this.dependencies.set(key, dependencies);
    
    for (const dep of dependencies) {
      if (!this.dependents.has(dep)) {
        this.dependents.set(dep, []);
      }
      if (!this.dependents.get(dep).includes(key)) {
        this.dependents.get(dep).push(key);
      }
    }
  }

  untrack(key) {
    const deps = this.dependencies.get(key);
    if (deps) {
      for (const dep of deps) {
        const dependentKeys = this.dependents.get(dep);
        if (dependentKeys) {
          const index = dependentKeys.indexOf(key);
          if (index > -1) {
            dependentKeys.splice(index, 1);
          }
        }
      }
    }
    
    this.dependencies.delete(key);
  }

  getDependents(dependency) {
    return this.dependents.get(dependency) || [];
  }

  clear() {
    this.dependencies.clear();
    this.dependents.clear();
  }
}

/**
 * Context Hasher
 */
class ContextHasher {
  hash(obj) {
    const sortedObj = this.sortObject(obj);
    const str = JSON.stringify(sortedObj);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObject(obj[key]);
    }

    return sortedObj;
  }
}

/**
 * Factory function to create memoization system
 */
export function createMemoizationSystem(options = {}) {
  return new TemplateMemoizationSystem(options);
}

export default TemplateMemoizationSystem;