/**
 * Content-Addressed Storage (CAS) - Deterministic Storage Implementation
 * 
 * Single source of truth for content addressing using SHA256 hashing.
 * Provides deterministic storage, retrieval, and garbage collection.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * Deterministic Content-Addressed Storage Engine
 */
export class CASStorage {
  constructor(options = {}) {
    this.config = {
      basePath: options.basePath || '.kgen/cas',
      enableFileStorage: options.enableFileStorage !== false,
      enableMemoryCache: options.enableMemoryCache !== false,
      maxCacheSize: options.maxCacheSize || 1000,
      hashAlgorithm: 'sha256', // Fixed to SHA256 for deterministic addressing
      ...options
    };
    
    // Memory cache for fast access
    this.cache = new Map();
    this.cacheAccess = new Map(); // For LRU tracking
    
    // Storage metrics
    this.metrics = {
      stores: 0,
      retrievals: 0,
      cacheHits: 0,
      cacheMisses: 0,
      filesStored: 0,
      lastGC: null
    };
    
    this.initialized = false;
  }

  /**
   * Initialize storage backend
   */
  async initialize() {
    if (this.initialized) return;

    if (this.config.enableFileStorage) {
      await fs.mkdir(this.config.basePath, { recursive: true });
    }

    this.initialized = true;
  }

  /**
   * Store content with SHA256 addressing
   * @param {string|Buffer} content - Content to store
   * @returns {Promise<string>} SHA256 hash of content
   */
  async store(content) {
    await this.initialize();

    const buffer = this._normalizeContent(content);
    const hash = this._calculateSHA256(buffer);

    // Store in memory cache if enabled
    if (this.config.enableMemoryCache) {
      this._cacheContent(hash, buffer);
    }

    // Store in file system if enabled and not already exists
    if (this.config.enableFileStorage) {
      const filePath = this._getFilePath(hash);
      
      try {
        await fs.access(filePath);
        // File already exists, no need to write again
      } catch {
        // File doesn't exist, create it
        await fs.mkdir(dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, buffer);
        this.metrics.filesStored++;
      }
    }

    this.metrics.stores++;
    return hash;
  }

  /**
   * Retrieve content by SHA256 hash
   * @param {string} hash - SHA256 hash
   * @returns {Promise<Buffer|null>} Content buffer or null if not found
   */
  async retrieve(hash) {
    await this.initialize();
    this.metrics.retrievals++;

    // Check memory cache first
    if (this.config.enableMemoryCache) {
      const cached = this._getCached(hash);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
    }

    // Try file system
    if (this.config.enableFileStorage) {
      try {
        const filePath = this._getFilePath(hash);
        const content = await fs.readFile(filePath);
        
        // Cache the content for future use
        if (this.config.enableMemoryCache) {
          this._cacheContent(hash, content);
        }
        
        return content;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw new Error(`Failed to retrieve content: ${error.message}`);
        }
      }
    }

    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Check if content exists by hash
   * @param {string} hash - SHA256 hash
   * @returns {Promise<boolean>} True if content exists
   */
  async exists(hash) {
    await this.initialize();

    // Check memory cache
    if (this.config.enableMemoryCache && this.cache.has(hash)) {
      return true;
    }

    // Check file system
    if (this.config.enableFileStorage) {
      try {
        const filePath = this._getFilePath(hash);
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Calculate SHA256 hash for content
   * @param {string|Buffer} content - Content to hash
   * @returns {string} SHA256 hash
   */
  calculateHash(content) {
    const buffer = this._normalizeContent(content);
    return this._calculateSHA256(buffer);
  }

  /**
   * List all stored hashes
   * @returns {Promise<string[]>} Array of SHA256 hashes
   */
  async list() {
    await this.initialize();
    const hashes = new Set();

    // Add cached hashes
    if (this.config.enableMemoryCache) {
      for (const hash of this.cache.keys()) {
        hashes.add(hash);
      }
    }

    // Add file system hashes
    if (this.config.enableFileStorage) {
      try {
        const files = await this._listAllFiles(this.config.basePath);
        for (const filePath of files) {
          const hash = this._extractHashFromPath(filePath);
          if (hash) {
            hashes.add(hash);
          }
        }
      } catch (error) {
        // Directory might not exist yet
      }
    }

    return Array.from(hashes).sort();
  }

  /**
   * Get storage metrics
   * @returns {Object} Storage metrics
   */
  getMetrics() {
    const hitRate = this.metrics.retrievals > 0 
      ? this.metrics.cacheHits / this.metrics.retrievals 
      : 0;

    return {
      ...this.metrics,
      cacheHitRate: Math.round(hitRate * 10000) / 100,
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize
    };
  }

  /**
   * Clear all stored content
   * @param {boolean} includeFiles - Also clear file storage
   */
  async clear(includeFiles = false) {
    // Clear memory cache
    this.cache.clear();
    this.cacheAccess.clear();

    // Clear file storage if requested
    if (includeFiles && this.config.enableFileStorage) {
      try {
        await fs.rm(this.config.basePath, { recursive: true, force: true });
        await fs.mkdir(this.config.basePath, { recursive: true });
      } catch (error) {
        // Directory might not exist
      }
    }

    // Reset metrics
    this.metrics = {
      stores: 0,
      retrievals: 0,
      cacheHits: 0,
      cacheMisses: 0,
      filesStored: 0,
      lastGC: null
    };
  }

  // Private methods

  /**
   * Normalize content to Buffer
   */
  _normalizeContent(content) {
    if (Buffer.isBuffer(content)) {
      return content;
    }
    if (typeof content === 'string') {
      return Buffer.from(content, 'utf8');
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(content);
    }
    throw new Error(`Unsupported content type: ${typeof content}`);
  }

  /**
   * Calculate deterministic SHA256 hash
   */
  _calculateSHA256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get file path for hash
   */
  _getFilePath(hash) {
    // Use first 2 chars as subdirectory to avoid too many files in one dir
    const prefix = hash.substring(0, 2);
    const suffix = hash.substring(2);
    return join(this.config.basePath, prefix, suffix);
  }

  /**
   * Extract hash from file path
   */
  _extractHashFromPath(filePath) {
    const relativePath = filePath.replace(this.config.basePath + '/', '');
    const hash = relativePath.replace('/', '');
    
    // Validate it's a valid SHA256 hash (64 hex chars)
    if (/^[a-f0-9]{64}$/i.test(hash)) {
      return hash.toLowerCase();
    }
    
    return null;
  }

  /**
   * Cache content in memory with LRU eviction
   */
  _cacheContent(hash, content) {
    if (!this.config.enableMemoryCache) return;

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      this._evictLRU();
    }

    this.cache.set(hash, content);
    this.cacheAccess.set(hash, Date.now());
  }

  /**
   * Get cached content and update access time
   */
  _getCached(hash) {
    if (!this.config.enableMemoryCache) return null;

    if (this.cache.has(hash)) {
      this.cacheAccess.set(hash, Date.now());
      return this.cache.get(hash);
    }

    return null;
  }

  /**
   * Evict least recently used cache entry
   */
  _evictLRU() {
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

  /**
   * Recursively list all files in directory
   */
  async _listAllFiles(dir, allFiles = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this._listAllFiles(fullPath, allFiles);
        } else {
          allFiles.push(fullPath);
        }
      }
      
      return allFiles;
    } catch (error) {
      return allFiles;
    }
  }
}

// Export singleton instance
export const casStorage = new CASStorage();

export default CASStorage;