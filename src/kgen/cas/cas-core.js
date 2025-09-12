/**
 * Content-Addressed Storage (CAS) Core Module
 * 
 * Provides high-performance content addressing using:
 * - multiformats CID for future-proof addressing
 * - hash-wasm for WebAssembly-accelerated hashing
 * - Efficient cache layer with ≥80% hit rate target
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 as hasher } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { sha256, sha512, blake2b, blake3 } from 'hash-wasm';

/**
 * CAS Configuration
 */
const DEFAULT_CONFIG = {
  defaultHashAlgorithm: 'sha256',
  cacheSize: 10000,
  cacheTTL: 3600000, // 1 hour
  enableMetrics: true,
  performanceTarget: {
    hashTimeP95: 5, // ms
    cacheHitRate: 0.80 // 80%
  }
};

/**
 * Content-Addressed Storage Engine
 * 
 * Features:
 * - Multiple hash algorithm support
 * - High-performance WebAssembly hashing
 * - LRU cache with metrics tracking
 * - Future-proof CID addressing
 */
export class CASEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Cache storage
    this.cache = new Map();
    this.cacheAccess = new Map(); // Track access times for LRU
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    // Performance metrics
    this.metrics = {
      hashTimes: [],
      cacheHitRate: 0,
      lastUpdate: Date.now()
    };
    
    // Supported hash algorithms
    this.hashers = {
      sha256: this._createHasher(sha256),
      sha512: this._createHasher(sha512),
      blake2b: this._createHasher(blake2b),
      blake3: this._createHasher(blake3)
    };
  }

  /**
   * Generate Content Identifier (CID) for data
   * @param {Buffer|Uint8Array|string} data - Content to address
   * @param {Object} options - Hashing options
   * @returns {Promise<CID>} Content identifier
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
      
      // Generate hash using WebAssembly hasher
      const hashBytes = await this._hash(content, algorithm);
      
      // Create CID using multiformats
      const digest = await hasher.digest(content);
      const cid = CID.create(1, raw.code, digest);
      
      // Cache the result
      this._setCached(cacheKey, cid);
      
      // Record performance metrics
      this._recordHashTime(performance.now() - startTime);
      
      return cid;
      
    } catch (error) {
      throw new Error(`CID generation failed: ${error.message}`);
    }
  }

  /**
   * Store content with CID addressing
   * @param {Buffer|Uint8Array|string} data - Content to store
   * @param {Object} options - Storage options
   * @returns {Promise<{cid: CID, stored: boolean}>} Storage result
   */
  async store(data, options = {}) {
    const cid = await this.generateCID(data, options);
    const content = this._normalizeContent(data);
    
    // Store in cache if not present
    const storageKey = cid.toString();
    if (!this.cache.has(storageKey)) {
      this._setCached(storageKey, content);
      return { cid, stored: true };
    }
    
    return { cid, stored: false }; // Already exists
  }

  /**
   * Retrieve content by CID
   * @param {CID|string} cid - Content identifier
   * @returns {Buffer|null} Content or null if not found
   */
  async retrieve(cid) {
    const cidStr = cid.toString ? cid.toString() : cid;
    const content = this._getCached(cidStr);
    
    return content || null;
  }

  /**
   * Calculate hash for drift detection
   * @param {Buffer|Uint8Array|string} data - Content to hash
   * @param {string} algorithm - Hash algorithm
   * @returns {Promise<string>} Hex-encoded hash
   */
  async calculateHash(data, algorithm = 'sha256') {
    const content = this._normalizeContent(data);
    const hashBytes = await this._hash(content, algorithm);
    return Buffer.from(hashBytes).toString('hex');
  }

  /**
   * Compare two pieces of content for drift detection
   * @param {Buffer|string} content1 - First content
   * @param {Buffer|string} content2 - Second content
   * @returns {Promise<{identical: boolean, cid1: CID, cid2: CID}>} Comparison result
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
   * Get cache performance metrics
   * @returns {Object} Performance and cache statistics
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
   * Garbage collect cache entries
   * @param {boolean} force - Force GC even if under limits
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

  _createHasher(hashFn) {
    return async (data) => {
      try {
        const hasher = await hashFn();
        hasher.init();
        hasher.update(data);
        return hasher.digest();
      } catch (error) {
        // Fallback to Node.js crypto for reliability
        const crypto = await import('crypto');
        const algorithm = hashFn === blake2b ? 'sha256' : 
                         hashFn === blake3 ? 'sha256' : 
                         hashFn.name.replace('bound ', '');
        return crypto.createHash(algorithm).update(data).digest();
      }
    };
  }

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

  async _hash(data, algorithm) {
    const hasher = this.hashers[algorithm];
    if (!hasher) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    
    return await hasher(data);
  }

  _quickHash(data) {
    // Simple checksum for cache key generation
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
    // Trigger GC if needed
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

// Singleton instance for global use
export const cas = new CASEngine();

// Note: Circular dependency avoided - import these separately if needed
// export { contentResolver, ContentUriResolver } from './content-uri-resolver.js';
// export { contentProvenanceIntegration, ContentProvenanceIntegration } from './provenance-integration.js';

// Export utilities
export { CID } from 'multiformats/cid';
export * from 'multiformats/hashes/sha2';