/**
 * Content-Addressed Storage (CAS) - Retrieval System
 * 
 * High-performance content retrieval with caching and verification.
 */

import { CASStorage } from './storage.js';

/**
 * CAS Retrieval Engine with intelligent caching and verification
 */
export class CASRetrieval {
  constructor(options = {}) {
    this.storage = options.storage || new CASStorage(options);
    
    this.config = {
      enableVerification: options.enableVerification !== false,
      enableCaching: options.enableCaching !== false,
      maxBatchSize: options.maxBatchSize || 100,
      ...options
    };

    // Query cache for complex lookups
    this.queryCache = new Map();
    this.metrics = {
      retrievals: 0,
      verifications: 0,
      batchRetrievals: 0,
      errors: 0,
      cacheHits: 0
    };
  }

  /**
   * Retrieve content by hash with optional verification
   * @param {string} hash - SHA256 hash
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieval result
   */
  async retrieve(hash, options = {}) {
    const startTime = Date.now();
    this.metrics.retrievals++;

    try {
      // Validate hash format
      if (!this._isValidHash(hash)) {
        throw new Error('Invalid SHA256 hash format');
      }

      // Retrieve content from storage
      const content = await this.storage.retrieve(hash);
      
      if (!content) {
        return {
          success: false,
          hash,
          content: null,
          verified: false,
          error: 'Content not found',
          retrievalTime: Date.now() - startTime
        };
      }

      // Verify content integrity if requested
      let verified = true;
      if (this.config.enableVerification && options.verify !== false) {
        verified = this._verifyContent(hash, content);
        this.metrics.verifications++;
        
        if (!verified) {
          return {
            success: false,
            hash,
            content: null,
            verified: false,
            error: 'Content verification failed - hash mismatch',
            retrievalTime: Date.now() - startTime
          };
        }
      }

      return {
        success: true,
        hash,
        content,
        verified,
        size: content.length,
        retrievalTime: Date.now() - startTime
      };

    } catch (error) {
      this.metrics.errors++;
      return {
        success: false,
        hash,
        content: null,
        verified: false,
        error: error.message,
        retrievalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Retrieve multiple contents by hashes
   * @param {string[]} hashes - Array of SHA256 hashes
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object[]>} Array of retrieval results
   */
  async retrieveBatch(hashes, options = {}) {
    const startTime = Date.now();
    this.metrics.batchRetrievals++;

    if (!Array.isArray(hashes)) {
      throw new Error('Hashes must be an array');
    }

    if (hashes.length > this.config.maxBatchSize) {
      throw new Error(`Batch size ${hashes.length} exceeds maximum ${this.config.maxBatchSize}`);
    }

    // Process in parallel but with concurrency control
    const batchSize = Math.min(10, hashes.length);
    const results = [];
    
    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.slice(i, i + batchSize);
      const batchPromises = batch.map(hash => this.retrieve(hash, options));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      success: true,
      results,
      totalItems: hashes.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
      batchTime: Date.now() - startTime
    };
  }

  /**
   * Find content by partial hash prefix
   * @param {string} prefix - Hash prefix (minimum 6 characters)
   * @returns {Promise<Object[]>} Matching content results
   */
  async findByPrefix(prefix) {
    if (!prefix || prefix.length < 6) {
      throw new Error('Prefix must be at least 6 characters');
    }

    // Check query cache first
    const cacheKey = `prefix:${prefix}`;
    if (this.queryCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.queryCache.get(cacheKey);
    }

    const allHashes = await this.storage.list();
    const matches = allHashes.filter(hash => hash.startsWith(prefix.toLowerCase()));

    if (matches.length === 0) {
      const result = { matches: [], count: 0 };
      this.queryCache.set(cacheKey, result);
      return result;
    }

    // Retrieve matching contents
    const retrievalResults = await Promise.all(
      matches.map(hash => this.retrieve(hash))
    );

    const result = {
      matches: retrievalResults.filter(r => r.success),
      count: retrievalResults.filter(r => r.success).length,
      prefix
    };

    // Cache result for a short time
    this.queryCache.set(cacheKey, result);
    setTimeout(() => this.queryCache.delete(cacheKey), 60000); // 1 minute cache

    return result;
  }

  /**
   * Get content metadata without retrieving full content
   * @param {string} hash - SHA256 hash
   * @returns {Promise<Object>} Content metadata
   */
  async getMetadata(hash) {
    if (!this._isValidHash(hash)) {
      throw new Error('Invalid SHA256 hash format');
    }

    const exists = await this.storage.exists(hash);
    
    if (!exists) {
      return {
        exists: false,
        hash,
        size: null,
        lastAccessed: null
      };
    }

    // For file storage, we can get size without reading full content
    let size = null;
    try {
      const content = await this.storage.retrieve(hash);
      size = content ? content.length : null;
    } catch (error) {
      // Size unavailable
    }

    return {
      exists: true,
      hash,
      size,
      lastAccessed: Date.now()
    };
  }

  /**
   * Verify content exists and is valid
   * @param {string} hash - SHA256 hash
   * @param {Buffer} expectedContent - Expected content for verification
   * @returns {Promise<Object>} Verification result
   */
  async verify(hash, expectedContent = null) {
    const result = await this.retrieve(hash, { verify: true });
    
    if (!result.success) {
      return {
        valid: false,
        exists: false,
        hash,
        error: result.error
      };
    }

    let contentMatches = true;
    if (expectedContent) {
      contentMatches = Buffer.compare(result.content, this.storage._normalizeContent(expectedContent)) === 0;
    }

    return {
      valid: result.verified && contentMatches,
      exists: true,
      hash,
      size: result.size,
      hashVerified: result.verified,
      contentMatches
    };
  }

  /**
   * Get retrieval metrics
   * @returns {Object} Retrieval performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.retrievals > 0 
        ? Math.round((this.metrics.cacheHits / this.metrics.retrievals) * 10000) / 100
        : 0,
      errorRate: this.metrics.retrievals > 0
        ? Math.round((this.metrics.errors / this.metrics.retrievals) * 10000) / 100
        : 0,
      queryCacheSize: this.queryCache.size
    };
  }

  /**
   * Clear internal caches
   */
  clearCache() {
    this.queryCache.clear();
  }

  // Private methods

  /**
   * Validate SHA256 hash format
   */
  _isValidHash(hash) {
    return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
  }

  /**
   * Verify content matches hash
   */
  _verifyContent(hash, content) {
    const actualHash = this.storage.calculateHash(content);
    return hash.toLowerCase() === actualHash.toLowerCase();
  }
}

// Export singleton instance
export const casRetrieval = new CASRetrieval();

export default CASRetrieval;