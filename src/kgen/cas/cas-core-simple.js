/**
 * Simple Content-Addressed Storage (CAS) Core Module
 * 
 * Simplified but performant CAS implementation with:
 * - multiformats CID for future-proof addressing  
 * - Node.js crypto for reliable hashing (fallback from hash-wasm)
 * - Efficient LRU cache with ≥80% hit rate target
 */

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { createHash } from 'crypto';

/**
 * Simple Content-Addressed Storage Engine
 */
export class SimpleCASEngine {
  constructor(config = {}) {
    this.config = {
      defaultHashAlgorithm: 'sha256',
      cacheSize: 10000,
      enableMetrics: true,
      performanceTarget: {
        hashTimeP95: 5, // ms
        cacheHitRate: 0.80 // 80%
      },
      ...config
    };
    
    // Cache storage with LRU
    this.cache = new Map();
    this.cacheAccess = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    // Performance tracking
    this.metrics = {
      hashTimes: [],
      cacheHitRate: 0,
      lastUpdate: this.getDeterministicTimestamp()
    };
  }

  /**
   * Generate Content Identifier (CID) for data
   */
  async generateCID(data, options = {}) {
    const startTime = performance.now();
    
    try {
      const algorithm = options.algorithm || this.config.defaultHashAlgorithm;
      const content = this._normalizeContent(data);
      
      // Check cache first
      const cacheKey = `${algorithm}:${content.length}:${this._quickHash(content)}`;
      const cached = this._getCached(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Create CID using multiformats
      const digest = await sha256.digest(content);
      const cid = CID.create(1, raw.code, digest);
      
      // Cache the result
      this._setCached(cacheKey, cid);
      
      // Record performance
      this._recordHashTime(performance.now() - startTime);
      
      return cid;
      
    } catch (error) {
      throw new Error(`CID generation failed: ${error.message}`);
    }
  }

  /**
   * Store content with CID addressing
   */
  async store(data, options = {}) {
    const cid = await this.generateCID(data, options);
    const content = this._normalizeContent(data);
    
    const storageKey = cid.toString();
    if (!this.cache.has(storageKey)) {
      this._setCached(storageKey, content);
      return { cid, stored: true };
    }
    
    return { cid, stored: false };
  }

  /**
   * Retrieve content by CID
   */
  async retrieve(cid) {
    const cidStr = cid.toString ? cid.toString() : cid;
    return this._getCached(cidStr) || null;
  }

  /**
   * Calculate hash for drift detection
   */
  async calculateHash(data, algorithm = 'sha256') {
    const content = this._normalizeContent(data);
    
    // Use Node.js crypto for reliable hashing
    const validAlgorithms = ['sha256', 'sha512', 'md5'];
    const hashAlg = validAlgorithms.includes(algorithm) ? algorithm : 'sha256';
    
    return createHash(hashAlg).update(content).digest('hex');
  }

  /**
   * Compare two pieces of content
   */
  async compareContent(content1, content2) {
    const [cid1, cid2] = await Promise.all([
      this.generateCID(content1),
      this.generateCID(content2)
    ]);
    
    return {
      identical: cid1.equals(cid2),
      cid1,
      cid2,
      drift: !cid1.equals(cid2)
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? this.cacheStats.hits / this.cacheStats.totalRequests 
      : 0;
    
    const p95HashTime = this._calculatePercentile(this.metrics.hashTimes, 0.95);
    
    return {
      cache: {
        hitRate,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        evictions: this.cacheStats.evictions,
        size: this.cache.size,
        maxSize: this.config.cacheSize
      },
      performance: {
        hashTimeP95: p95HashTime,
        averageHashTime: this._average(this.metrics.hashTimes),
        meetsTargets: {
          hitRate: hitRate >= this.config.performanceTarget.cacheHitRate,
          hashTime: p95HashTime <= this.config.performanceTarget.hashTimeP95
        }
      },
      lastUpdated: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Garbage collect cache entries (LRU eviction)
   */
  gc(force = false) {
    const shouldGC = force || this.cache.size > this.config.cacheSize;
    
    if (!shouldGC) return;
    
    // Sort by access time (LRU)
    const entries = Array.from(this.cacheAccess.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const targetSize = Math.floor(this.config.cacheSize * 0.8);
    const toEvict = this.cache.size - targetSize;
    
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.cacheAccess.delete(key);
      this.cacheStats.evictions++;
    }
  }

  // Private methods

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

  _quickHash(data) {
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 1024); i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return hash.toString(36);
  }

  _getCached(key) {
    this.cacheStats.totalRequests++;
    
    if (this.cache.has(key)) {
      this.cacheStats.hits++;
      this.cacheAccess.set(key, this.getDeterministicTimestamp());
      return this.cache.get(key);
    }
    
    this.cacheStats.misses++;
    return null;
  }

  _setCached(key, value) {
    if (this.cache.size >= this.config.cacheSize) {
      this.gc();
    }
    
    this.cache.set(key, value);
    this.cacheAccess.set(key, this.getDeterministicTimestamp());
  }

  _recordHashTime(time) {
    this.metrics.hashTimes.push(time);
    
    // Keep only recent measurements
    if (this.metrics.hashTimes.length > 1000) {
      this.metrics.hashTimes = this.metrics.hashTimes.slice(-500);
    }
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
}

// Export singleton instance
export const cas = new SimpleCASEngine();

// Export CID utilities
export { CID } from 'multiformats/cid';