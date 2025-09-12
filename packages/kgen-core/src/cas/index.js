/**
 * Content-Addressed Storage (CAS) API
 * 
 * Clean API for kgen-core CAS functionality:
 * - Simple store/retrieve/verify interface
 * - Multiple storage backends (memory, file)
 * - Pure JavaScript implementation
 * - High-performance caching
 */

import { CASEngine, casEngine } from './engine.js';
import { CASStore, MemoryStore, FileStore, casStore } from './store.js';

// Export classes and instances
export { CASEngine, casEngine };
export { CASStore, MemoryStore, FileStore, casStore };

/**
 * Create a CAS instance with custom configuration
 * @param {Object} options - Configuration options
 * @returns {CASEngine} Configured CAS engine
 */
export function createCAS(options = {}) {
  return new CASEngine(options);
}

/**
 * Quick utility functions for simple use cases
 */
export const cas = {
  /**
   * Store content and return hash
   * @param {string|Buffer} content - Content to store
   * @returns {Promise<string>} Content hash
   */
  async store(content) {
    return casEngine.store(content);
  },

  /**
   * Retrieve content by hash
   * @param {string} hash - Content hash
   * @returns {Promise<Buffer|null>} Content or null
   */
  async retrieve(hash) {
    return casEngine.retrieve(hash);
  },

  /**
   * Verify content matches hash
   * @param {string} hash - Expected hash
   * @param {string|Buffer} content - Content to verify
   * @returns {boolean} True if valid
   */
  verify(hash, content) {
    return casEngine.verify(hash, content);
  },

  /**
   * Calculate hash for content
   * @param {string|Buffer} content - Content to hash
   * @returns {string} Content hash
   */
  hash(content) {
    return casEngine.calculateHash(content);
  }
};

// Re-export everything for convenience
export * from './engine.js';
export * from './store.js';