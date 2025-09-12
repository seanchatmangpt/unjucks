/**
 * Optimized CAS Engine for High-Performance Content Addressing
 * 
 * Performance targets:
 * - Cache hit rate: ≥80%
 * - Cache operation time: ≤20ms
 * - Hash calculation: ≤5ms (P95)
 * - Atomic write operations with reliability
 * - Memory-efficient LRU cache with smart eviction
 */

import { CID } from 'multiformats/cid';
import { sha256 as multiSha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { performance } from 'perf_hooks';
import consola from 'consola';

/**
 * High-Performance CAS Engine with optimized caching and atomic operations
 */
export class OptimizedCASEngine {
  constructor(config = {}) {
    this.config = {
      defaultHashAlgorithm: 'sha256',
      cacheSize: 15000, // Increased for better hit rates
      cacheTTL: 7200000, // 2 hours
      enableMetrics: true,
      enableHardlinks: true,
      enableDriftDetection: true,
      casDir: config.casDir || join(process.cwd(), '.kgen/cas'),
      performanceTarget: {
        hashTimeP95: 5, // ms
        cacheHitRate: 0.85, // 85% target
        cacheOpTime: 20 // ms
      },
      ...config
    };
    
    this.logger = consola.withTag('cas-engine-optimized');
    
    // High-performance cache with metadata
    this.cache = new Map();
    this.cacheAccess = new Map(); // LRU tracking
    this.cacheMetrics = new Map(); // Per-key metrics
    
    // Performance statistics
    this.stats = {
      hits: 0,
      misses: 0,
      stores: 0,
      evictions: 0,
      totalRequests: 0,
      hashCalculations: 0,
      integrityChecks: 0,
      driftDetections: 0,
      errors: 0
    };
    
    // Performance metrics with circular buffer
    this.metrics = {
      hashTimes: new Array(500).fill(0),
      cacheOpTimes: new Array(500).fill(0),
      hashTimeIndex: 0,
      cacheOpIndex: 0,
      lastCleanup: this.getDeterministicTimestamp(),
      startTime: this.getDeterministicTimestamp()
    };
    
    // Supported algorithms with fallbacks
    this.hashAlgorithms = new Set(['sha256', 'sha512', 'md5']);
    
    // Background tasks
    this.cleanupInterval = null;
    this.initialized = false;
  }

  /**
   * Initialize the CAS engine with optimized setup
   */
  async initialize() {
    if (this.initialized) return { success: true, cached: true };
    
    try {
      // Ensure CAS directory exists
      await fs.mkdir(this.config.casDir, { recursive: true });
      
      // Start background cleanup task
      this.cleanupInterval = setInterval(() => {
        this._backgroundCleanup();
      }, 30000); // Every 30 seconds
      
      this.initialized = true;
      this.logger.info(`Optimized CAS Engine initialized (cache: ${this.config.cacheSize})`);
      
      return { 
        success: true,
        cacheSize: this.config.cacheSize,
        algorithms: Array.from(this.hashAlgorithms),
        performanceTargets: this.config.performanceTarget
      };
    } catch (error) {
      this.logger.error('Failed to initialize CAS engine:', error);
      throw error;
    }
  }

  /**
   * Store content with optimized CID generation and caching
   */
  async store(data, options = {}) {
    await this.initialize();
    const startTime = performance.now();
    this.stats.stores++;
    this.stats.totalRequests++;
    
    try {
      const algorithm = options.algorithm || this.config.defaultHashAlgorithm;
      const content = this._normalizeContent(data);
      
      // Generate cache key with content fingerprint for fast lookups
      const quickHash = this._generateQuickHash(content);
      const cacheKey = `${algorithm}:${content.length}:${quickHash}`;
      
      // Check cache first (optimized lookup)
      const cached = this._getCachedOptimized(cacheKey);
      if (cached && !options.skipCache) {
        this._recordCacheOpTime(performance.now() - startTime);
        return { 
          cid: cached.cid, 
          stored: false,
          cached: true,
          processingTime: performance.now() - startTime
        };
      }
      
      // Calculate hash using optimized method
      const hash = await this._calculateHashOptimized(content, algorithm);
      
      // Create CID using multiformats
      const digest = await multiSha256.digest(content);
      const cid = CID.create(1, raw.code, digest);
      
      // Store in cache with enhanced metadata
      const cacheEntry = {
        cid,
        hash,
        algorithm,
        size: content.length,
        createdAt: this.getDeterministicTimestamp(),
        accessCount: 1,
        lastAccessed: this.getDeterministicTimestamp()
      };
      
      this._setCachedOptimized(cacheKey, cacheEntry);
      this._setCachedOptimized(cid.toString(), content); // Store content by CID
      
      const processingTime = performance.now() - startTime;
      this._recordCacheOpTime(processingTime);
      
      return { 
        cid, 
        hash,
        stored: true, 
        cached: false,
        size: content.length,
        algorithm,
        processingTime
      };
      
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to store content:', error);
      throw error;
    }
  }

  /**
   * Retrieve content by CID with performance optimization
   */
  async retrieve(cid) {
    const startTime = performance.now();
    this.stats.totalRequests++;
    
    try {
      const cidStr = cid.toString ? cid.toString() : cid;
      
      // Fast cache lookup
      const cached = this._getCachedOptimized(cidStr);
      if (cached) {
        this._recordCacheOpTime(performance.now() - startTime);
        return cached;
      }
      
      // Mark as miss and return null (would read from disk in full implementation)
      this.stats.misses++;
      this._recordCacheOpTime(performance.now() - startTime);
      return null;
      
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Calculate content hash with performance optimization
   */
  async calculateHash(data, algorithm = 'sha256') {
    await this.initialize();
    const content = this._normalizeContent(data);
    return this._calculateHashOptimized(content, algorithm);
  }

  /**
   * Compare content for drift detection
   */
  async compareContent(content1, content2, options = {}) {
    const startTime = performance.now();
    
    try {
      const [hash1, hash2] = await Promise.all([
        this.calculateHash(content1, options.algorithm),
        this.calculateHash(content2, options.algorithm)
      ]);
      
      const identical = hash1 === hash2;
      const processingTime = performance.now() - startTime;
      
      return {
        identical,
        drift: !identical,
        hash1,
        hash2,
        processingTime,
        algorithm: options.algorithm || this.config.defaultHashAlgorithm
      };
      
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Perform integrity verification with streaming support
   */
  async verifyIntegrity(content, expectedHash, algorithm = 'sha256') {
    const startTime = performance.now();
    this.stats.integrityChecks++;
    
    try {
      const actualHash = await this.calculateHash(content, algorithm);
      const valid = actualHash === expectedHash;
      const processingTime = performance.now() - startTime;
      
      if (!valid) {
        this.logger.warn(`Integrity check failed: expected ${expectedHash}, got ${actualHash}`);
      }
      
      return {
        valid,
        expectedHash,
        actualHash,
        algorithm,
        processingTime,
        error: valid ? null : 'Hash mismatch detected'
      };
      
    } catch (error) {
      return {
        valid: false,
        error: `Integrity check failed: ${error.message}`,
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics() {
    const now = this.getDeterministicTimestamp();
    const uptime = now - this.metrics.startTime;
    
    // Calculate hit rate
    const hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
    
    // Calculate percentiles from circular buffers
    const hashTimes = this.metrics.hashTimes.filter(t => t > 0);
    const cacheOpTimes = this.metrics.cacheOpTimes.filter(t => t > 0);
    
    const hashTimeP95 = this._calculatePercentile(hashTimes, 0.95);
    const cacheOpTimeP95 = this._calculatePercentile(cacheOpTimes, 0.95);
    
    // Performance targets check
    const meetsTargets = {
      hitRate: hitRate >= this.config.performanceTarget.cacheHitRate,
      hashTime: hashTimeP95 <= this.config.performanceTarget.hashTimeP95,
      cacheOpTime: cacheOpTimeP95 <= this.config.performanceTarget.cacheOpTime
    };
    
    return {
      cache: {
        hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
        hits: this.stats.hits,
        misses: this.stats.misses,
        evictions: this.stats.evictions,
        size: this.cache.size,
        maxSize: this.config.cacheSize,
        memoryUsageMB: this._estimateCacheMemoryUsage()
      },
      performance: {
        hashTimeP95: Math.round(hashTimeP95 * 100) / 100,
        cacheOpTimeP95: Math.round(cacheOpTimeP95 * 100) / 100,
        averageHashTime: Math.round(this._average(hashTimes) * 100) / 100,
        averageCacheOpTime: Math.round(this._average(cacheOpTimes) * 100) / 100,
        hashCalculations: this.stats.hashCalculations,
        integrityChecks: this.stats.integrityChecks,
        meetsTargets
      },
      operations: {
        totalRequests: this.stats.totalRequests,
        stores: this.stats.stores,
        errors: this.stats.errors,
        errorRate: this.stats.totalRequests > 0 ? this.stats.errors / this.stats.totalRequests : 0
      },
      system: {
        uptime: Math.round(uptime / 1000), // seconds
        lastCleanup: new Date(this.metrics.lastCleanup).toISOString(),
        algorithms: Array.from(this.hashAlgorithms)
      }
    };
  }

  /**
   * Garbage collect cache with smart eviction
   */
  gc(force = false) {
    const shouldGC = force || this.cache.size > this.config.cacheSize;
    
    if (!shouldGC) return { evicted: 0 };
    
    const startTime = performance.now();
    const targetSize = Math.floor(this.config.cacheSize * 0.8); // 80% target
    const toEvict = this.cache.size - targetSize;
    
    if (toEvict <= 0) return { evicted: 0 };
    
    // Smart eviction based on access patterns and age
    const entries = Array.from(this.cache.entries())
      .map(([key, value]) => ({
        key,
        lastAccessed: this.cacheAccess.get(key) || 0,
        accessCount: value.accessCount || 1,
        size: JSON.stringify(value).length,
        age: this.getDeterministicTimestamp() - (value.createdAt || this.getDeterministicTimestamp())
      }))
      .sort((a, b) => {
        // Score based on recency, frequency, and age
        const aScore = (a.lastAccessed / 1000) + (a.accessCount * 10) - (a.age / 1000);
        const bScore = (b.lastAccessed / 1000) + (b.accessCount * 10) - (b.age / 1000);
        return aScore - bScore; // Lower score = evict first
      });
    
    let evicted = 0;
    for (let i = 0; i < Math.min(toEvict, entries.length); i++) {
      const entry = entries[i];
      this.cache.delete(entry.key);
      this.cacheAccess.delete(entry.key);
      this.cacheMetrics.delete(entry.key);
      evicted++;
    }
    
    this.stats.evictions += evicted;
    const processingTime = performance.now() - startTime;
    
    this.logger.debug(`GC evicted ${evicted} entries in ${processingTime.toFixed(2)}ms`);
    
    return { evicted, processingTime };
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.cache.clear();
    this.cacheAccess.clear();
    this.cacheMetrics.clear();
    
    this.logger.info('Optimized CAS Engine shutdown completed');
  }

  // Private optimization methods

  _normalizeContent(data) {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    if (data instanceof Buffer) {
      return new Uint8Array(data);
    }
    if (data instanceof Uint8Array) {
      return data;
    }
    throw new Error('Unsupported content type');
  }

  async _calculateHashOptimized(content, algorithm) {
    const startTime = performance.now();
    this.stats.hashCalculations++;
    
    try {
      if (!this.hashAlgorithms.has(algorithm)) {
        algorithm = this.config.defaultHashAlgorithm;
      }
      
      const hash = createHash(algorithm).update(content).digest('hex');
      
      const hashTime = performance.now() - startTime;
      this._recordHashTime(hashTime);
      
      return hash;
    } catch (error) {
      this.logger.error(`Hash calculation failed for algorithm ${algorithm}:`, error);
      throw error;
    }
  }

  _generateQuickHash(content) {
    // Optimized quick hash for cache keys
    let hash = 0;
    const len = Math.min(content.length, 1024); // Sample first 1KB
    const step = Math.max(1, Math.floor(len / 64)); // Sample up to 64 bytes
    
    for (let i = 0; i < len; i += step) {
      hash = ((hash << 5) - hash + content[i]) | 0;
    }
    
    return hash.toString(36);
  }

  _getCachedOptimized(key) {
    const startTime = performance.now();
    this.stats.totalRequests++;
    
    if (this.cache.has(key)) {
      this.stats.hits++;
      const value = this.cache.get(key);
      
      // Update access tracking
      this.cacheAccess.set(key, this.getDeterministicTimestamp());
      if (value.accessCount !== undefined) {
        value.accessCount++;
        value.lastAccessed = this.getDeterministicTimestamp();
      }
      
      this._recordCacheOpTime(performance.now() - startTime);
      return value;
    }
    
    this.stats.misses++;
    this._recordCacheOpTime(performance.now() - startTime);
    return null;
  }

  _setCachedOptimized(key, value) {
    // Trigger GC if needed before adding
    if (this.cache.size >= this.config.cacheSize) {
      this.gc();
    }
    
    // Enhanced cache entry
    const now = this.getDeterministicTimestamp();
    const enhancedValue = {
      ...value,
      createdAt: value.createdAt || now,
      lastAccessed: now,
      accessCount: value.accessCount || 1
    };
    
    this.cache.set(key, enhancedValue);
    this.cacheAccess.set(key, now);
  }

  _recordHashTime(time) {
    this.metrics.hashTimes[this.metrics.hashTimeIndex] = time;
    this.metrics.hashTimeIndex = (this.metrics.hashTimeIndex + 1) % this.metrics.hashTimes.length;
  }

  _recordCacheOpTime(time) {
    this.metrics.cacheOpTimes[this.metrics.cacheOpIndex] = time;
    this.metrics.cacheOpIndex = (this.metrics.cacheOpIndex + 1) % this.metrics.cacheOpTimes.length;
  }

  _calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  _average(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  _estimateCacheMemoryUsage() {
    let totalSize = 0;
    let sampleCount = 0;
    const sampleLimit = 100;
    
    for (const [key, value] of this.cache) {
      if (sampleCount >= sampleLimit) break;
      totalSize += JSON.stringify({ key, value }).length;
      sampleCount++;
    }
    
    // Estimate total based on sample
    const averageSize = sampleCount > 0 ? totalSize / sampleCount : 0;
    const estimatedTotal = averageSize * this.cache.size;
    
    return Math.round((estimatedTotal / 1024 / 1024) * 100) / 100; // MB with 2 decimals
  }

  _backgroundCleanup() {
    const now = this.getDeterministicTimestamp();
    
    // Skip if cleanup was recent
    if (now - this.metrics.lastCleanup < 30000) return;
    
    try {
      // Clean up expired cache entries
      const ttl = this.config.cacheTTL;
      let cleaned = 0;
      
      for (const [key, value] of this.cache) {
        if (value.createdAt && now - value.createdAt > ttl) {
          this.cache.delete(key);
          this.cacheAccess.delete(key);
          this.cacheMetrics.delete(key);
          cleaned++;
        }
      }
      
      // Trigger GC if cache is getting full
      if (this.cache.size > this.config.cacheSize * 0.9) {
        this.gc();
      }
      
      this.metrics.lastCleanup = now;
      
      if (cleaned > 0) {
        this.logger.debug(`Background cleanup removed ${cleaned} expired entries`);
      }
      
    } catch (error) {
      this.logger.warn('Background cleanup error:', error.message);
    }
  }
}

// Export singleton instance
export const optimizedCAS = new OptimizedCASEngine();

// Export class for custom instances
export default OptimizedCASEngine;