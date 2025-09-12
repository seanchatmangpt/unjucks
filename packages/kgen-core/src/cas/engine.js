/**
 * Content-Addressed Storage (CAS) Engine - Pure JavaScript Implementation
 * 
 * Provides high-performance content addressing without external dependencies:
 * - SHA256 hashing implementation
 * - Memory and file-based storage backends
 * - Efficient cache layer with LRU eviction
 * - Clean API for integration with other modules
 */

import { createHash } from 'crypto';
import { CASStore } from './store.js';

/**
 * Pure JavaScript CAS Engine
 */
export class CASEngine {
  constructor(options = {}) {
    this.config = {
      defaultHashAlgorithm: 'sha256',
      cacheSize: 1000,
      cacheTTL: 3600000, // 1 hour
      enableMetrics: true,
      ...options
    };
    
    // Initialize storage backend
    this.storage = new CASStore({
      storageType: options.storageType || 'memory',
      basePath: options.basePath || '.kgen/cas'
    });
    
    // Cache for fast lookups
    this.cache = new Map();
    this.cacheAccess = new Map(); // LRU tracking
    
    // Metrics tracking
    this.metrics = {
      stores: 0,
      retrievals: 0,
      hits: 0,
      misses: 0,
      hashCalculations: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the CAS engine
   */
  async initialize() {
    if (this.initialized) return;
    
    await this.storage.initialize();
    this.initialized = true;
  }

  /**
   * Store content and return hash
   * @param {string|Buffer|Uint8Array} content - Content to store
   * @param {Object} options - Storage options
   * @returns {Promise<string>} Content hash
   */
  async store(content, options = {}) {
    await this.initialize();
    
    const normalized = this._normalizeContent(content);
    const algorithm = options.algorithm || this.config.defaultHashAlgorithm;
    const hash = this._calculateHash(normalized, algorithm);
    
    // Store in backend
    await this.storage.store(hash, normalized);
    
    // Cache the content for fast retrieval
    this._cacheContent(hash, normalized);
    
    this.metrics.stores++;
    return hash;
  }

  /**
   * Get content by hash
   * @param {string} hash - Content hash
   * @returns {Promise<Buffer|null>} Content or null if not found
   */
  async retrieve(hash) {
    await this.initialize();
    
    // Check cache first
    const cached = this._getCached(hash);
    if (cached) {
      this.metrics.hits++;
      this.metrics.retrievals++;
      return cached;
    }
    
    // Retrieve from backend
    const content = await this.storage.retrieve(hash);
    
    if (content) {
      this._cacheContent(hash, content);
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
    
    this.metrics.retrievals++;
    return content;
  }

  /**
   * Verify content matches hash
   * @param {string} hash - Expected hash
   * @param {string|Buffer|Uint8Array} content - Content to verify
   * @param {Object} options - Verification options
   * @returns {boolean} True if content matches hash
   */
  verify(hash, content, options = {}) {
    const normalized = this._normalizeContent(content);
    const algorithm = options.algorithm || this.config.defaultHashAlgorithm;
    const actualHash = this._calculateHash(normalized, algorithm);
    
    return hash === actualHash;
  }

  /**
   * Calculate hash for content
   * @param {string|Buffer|Uint8Array} content - Content to hash
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {string} Content hash
   */
  calculateHash(content, algorithm = 'sha256') {
    const normalized = this._normalizeContent(content);
    return this._calculateHash(normalized, algorithm);
  }

  /**
   * Get engine metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const hitRate = this.metrics.retrievals > 0 
      ? this.metrics.hits / this.metrics.retrievals 
      : 0;
    
    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      cacheSize: this.cache.size,
      maxCacheSize: this.config.cacheSize
    };
  }

  /**
   * Clear cache and optionally storage
   * @param {boolean} clearStorage - Also clear persistent storage
   */
  async clear(clearStorage = false) {
    this.cache.clear();
    this.cacheAccess.clear();
    
    if (clearStorage) {
      await this.storage.clear();
    }
    
    // Reset metrics
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
  }

  // Private methods

  _normalizeContent(content) {
    if (typeof content === 'string') {
      return Buffer.from(content, 'utf8');
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(content);
    }
    if (Buffer.isBuffer(content)) {
      return content;
    }
    throw new Error(`Unsupported content type: ${typeof content}`);
  }

  _calculateHash(content, algorithm) {
    this.metrics.hashCalculations++;
    
    try {
      return createHash(algorithm)
        .update(content)
        .digest('hex');
    } catch (error) {
      throw new Error(`Hash calculation failed: ${error.message}`);
    }
  }

  _cacheContent(hash, content) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      this._evictLRU();
    }
    
    this.cache.set(hash, content);
    this.cacheAccess.set(hash, Date.now());
  }

  _getCached(hash) {
    if (this.cache.has(hash)) {
      // Update access time for LRU
      this.cacheAccess.set(hash, Date.now());
      return this.cache.get(hash);
    }
    return null;
  }

  _evictLRU() {
    // Find least recently used entry
    let oldestTime = Date.now();
    let oldestKey = null;
    
    for (const [key, time] of this.cacheAccess.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheAccess.delete(oldestKey);
    }
  }
}

// Export singleton instance
export const casEngine = new CASEngine();

// Export for custom configurations
export default CASEngine;
