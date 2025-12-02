/**
 * Content-Addressed Storage (CAS) API
 * 
 * Single source of truth for content addressing with SHA256:
 * - Deterministic storage with SHA256 addressing
 * - High-performance retrieval with caching  
 * - Garbage collection for unused content
 * - Integration with provenance system
 */

import { CASStorage, casStorage } from './storage.js';
import { CASRetrieval, casRetrieval } from './retrieval.js';
import { CASGarbageCollector, casGC } from './gc.js';

// Export main classes and instances
export { CASStorage, casStorage };
export { CASRetrieval, casRetrieval };
export { CASGarbageCollector, casGC };

/**
 * Create a complete CAS system with all components
 * @param {Object} options - Configuration options
 * @returns {Object} Complete CAS system
 */
export function createCAS(options = {}) {
  const storage = new CASStorage(options);
  const retrieval = new CASRetrieval({ storage, ...options });
  const gc = new CASGarbageCollector({ storage, ...options });

  return {
    storage,
    retrieval,
    gc,
    
    // Unified API
    async store(content) {
      return storage.store(content);
    },

    async retrieve(hash) {
      const result = await retrieval.retrieve(hash);
      return result.success ? result.content : null;
    },

    async exists(hash) {
      return storage.exists(hash);
    },

    calculateHash(content) {
      return storage.calculateHash(content);
    },

    async verify(hash, content) {
      const result = await retrieval.verify(hash, content);
      return result.valid;
    },

    async list() {
      return storage.list();
    },

    async gc(options = {}) {
      return gc.run(options);
    },

    async getMetrics() {
      return {
        storage: storage.getMetrics(),
        retrieval: retrieval.getMetrics(),
        gc: await gc.getStats()
      };
    }
  };
}

/**
 * Default CAS instance for global use
 */
export const cas = {
  /**
   * Store content and return SHA256 hash
   * @param {string|Buffer} content - Content to store
   * @returns {Promise<string>} SHA256 hash
   */
  async store(content) {
    return casStorage.store(content);
  },

  /**
   * Retrieve content by hash
   * @param {string} hash - SHA256 hash
   * @returns {Promise<Buffer|null>} Content or null
   */
  async retrieve(hash) {
    const result = await casRetrieval.retrieve(hash);
    return result.success ? result.content : null;
  },

  /**
   * Check if content exists
   * @param {string} hash - SHA256 hash
   * @returns {Promise<boolean>} True if exists
   */
  async exists(hash) {
    return casStorage.exists(hash);
  },

  /**
   * Calculate SHA256 hash for content
   * @param {string|Buffer} content - Content to hash
   * @returns {string} SHA256 hash
   */
  calculateHash(content) {
    return casStorage.calculateHash(content);
  },

  /**
   * Verify content matches hash
   * @param {string} hash - Expected hash
   * @param {string|Buffer} content - Content to verify
   * @returns {Promise<boolean>} True if valid
   */
  async verify(hash, content) {
    const result = await casRetrieval.verify(hash, content);
    return result.valid;
  },

  /**
   * List all stored hashes
   * @returns {Promise<string[]>} Array of SHA256 hashes
   */
  async list() {
    return casStorage.list();
  },

  /**
   * Run garbage collection
   * @param {Object} options - GC options
   * @returns {Promise<Object>} GC results
   */
  async gc(options = {}) {
    return casGC.run(options);
  },

  /**
   * Get comprehensive metrics
   * @returns {Promise<Object>} System metrics
   */
  async getMetrics() {
    return {
      storage: casStorage.getMetrics(),
      retrieval: casRetrieval.getMetrics(),
      gc: await casGC.getStats()
    };
  }
};

// Export everything for convenience
export * from './storage.js';
export * from './retrieval.js';
export * from './gc.js';