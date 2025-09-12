/**
 * Content-Addressed Cache for KGEN RDF Processing
 * 
 * Provides content-addressed storage and caching with:
 * - Hash-based storage
 * - Integrity verification
 * - Efficient retrieval
 * - Cache management
 */

import { createHash } from 'crypto';
import { consola } from 'consola';
import fs from 'fs/promises';
import path from 'path';

export class ContentAddressedCache {
  constructor(options = {}) {
    this.logger = consola.withTag('rdf-cache');
    this.options = {
      cacheDir: options.cacheDir || '.kgen/cache/content-addressed',
      maxCacheSize: options.maxCacheSize || 1000,
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      compressionEnabled: options.compressionEnabled !== false,
      enableIntegrityChecks: options.enableIntegrityChecks !== false,
      ...options
    };
    
    // In-memory cache for frequently accessed items
    this.memoryCache = new Map();
    
    // Cache metadata
    this.metadata = {
      version: '1.0',
      hashAlgorithm: this.options.hashAlgorithm,
      entries: new Map(),
      stats: {
        totalEntries: 0,
        totalSize: 0,
        memoryHits: 0,
        diskHits: 0,
        misses: 0,
        writes: 0
      }
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the cache system
   */
  async initialize() {
    try {
      this.logger.debug('Initializing content-addressed cache');
      
      // Ensure cache directory exists
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      
      // Load existing metadata
      await this._loadMetadata();
      
      this.initialized = true;
      this.logger.success(`Cache initialized: ${this.metadata.stats.totalEntries} entries`);
      
    } catch (error) {
      this.logger.error('Failed to initialize cache:', error);
      throw error;
    }
  }

  /**
   * Store content in cache using content-addressed storage
   * @param {string|Buffer} content - Content to store
   * @param {Object} options - Storage options
   * @returns {Promise<string>} Content hash
   */
  async store(content, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      const hash = this._calculateHash(contentBuffer);
      
      // Check if already exists
      if (await this._exists(hash)) {
        this.logger.debug(`Content already exists in cache: ${hash.substring(0, 8)}`);
        this._updateAccessTime(hash);
        return hash;
      }
      
      // Store to disk
      const filePath = this._getFilePath(hash);
      await this._ensureDirectoryExists(path.dirname(filePath));
      
      let finalContent = contentBuffer;
      
      // Apply compression if enabled
      if (this.options.compressionEnabled && options.compress !== false) {
        finalContent = await this._compress(contentBuffer);
      }
      
      await fs.writeFile(filePath, finalContent);
      
      // Store in memory cache if small enough
      if (contentBuffer.length < 1024 * 100) { // 100KB threshold
        this.memoryCache.set(hash, {
          content: contentBuffer,
          compressed: this.options.compressionEnabled,
          storedAt: this.getDeterministicDate(),
          accessCount: 1
        });
        
        this._trimMemoryCache();
      }
      
      // Update metadata
      this.metadata.entries.set(hash, {
        hash,
        size: contentBuffer.length,
        compressedSize: finalContent.length,
        compressed: this.options.compressionEnabled,
        storedAt: this.getDeterministicDate(),
        lastAccessed: this.getDeterministicDate(),
        accessCount: 1,
        contentType: options.contentType || 'application/octet-stream',
        tags: options.tags || []
      });
      
      this.metadata.stats.totalEntries++;
      this.metadata.stats.totalSize += contentBuffer.length;
      this.metadata.stats.writes++;
      
      await this._saveMetadata();
      
      this.logger.debug(`Content stored: ${hash.substring(0, 8)} (${contentBuffer.length} bytes)`);
      return hash;
      
    } catch (error) {
      this.logger.error('Failed to store content:', error);
      throw error;
    }
  }

  /**
   * Retrieve content from cache by hash
   * @param {string} hash - Content hash
   * @param {Object} options - Retrieval options
   * @returns {Promise<Buffer|null>} Content or null if not found
   */
  async retrieve(hash, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check memory cache first
      if (this.memoryCache.has(hash)) {
        const cached = this.memoryCache.get(hash);
        cached.accessCount++;
        this.metadata.stats.memoryHits++;
        this.logger.debug(`Memory cache hit: ${hash.substring(0, 8)}`);
        return cached.content;
      }
      
      // Check if exists on disk
      if (!await this._exists(hash)) {
        this.metadata.stats.misses++;
        return null;
      }
      
      // Load from disk
      const filePath = this._getFilePath(hash);
      let content = await fs.readFile(filePath);
      
      const entry = this.metadata.entries.get(hash);
      
      // Decompress if necessary
      if (entry && entry.compressed) {
        content = await this._decompress(content);
      }
      
      // Verify integrity if enabled
      if (this.options.enableIntegrityChecks) {
        const calculatedHash = this._calculateHash(content);
        if (calculatedHash !== hash) {
          throw new Error(`Content integrity check failed: ${hash}`);
        }
      }
      
      // Update access metadata
      this._updateAccessTime(hash);
      this.metadata.stats.diskHits++;
      
      // Cache in memory if small enough
      if (content.length < 1024 * 100) {
        this.memoryCache.set(hash, {
          content,
          compressed: entry?.compressed || false,
          storedAt: entry?.storedAt || this.getDeterministicDate(),
          accessCount: entry?.accessCount || 1
        });
      }
      
      this.logger.debug(`Content retrieved: ${hash.substring(0, 8)} (${content.length} bytes)`);
      return content;
      
    } catch (error) {
      this.logger.error('Failed to retrieve content:', error);
      throw error;
    }
  }

  /**
   * Check if content exists in cache
   * @param {string} hash - Content hash
   * @returns {Promise<boolean>} True if exists
   */
  async exists(hash) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.memoryCache.has(hash) || await this._exists(hash);
  }

  /**
   * Delete content from cache
   * @param {string} hash - Content hash
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(hash) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      let deleted = false;
      
      // Remove from memory cache
      if (this.memoryCache.has(hash)) {
        this.memoryCache.delete(hash);
        deleted = true;
      }
      
      // Remove from disk
      if (await this._exists(hash)) {
        const filePath = this._getFilePath(hash);
        await fs.unlink(filePath);
        deleted = true;
      }
      
      // Update metadata
      if (this.metadata.entries.has(hash)) {
        const entry = this.metadata.entries.get(hash);
        this.metadata.stats.totalSize -= entry.size;
        this.metadata.stats.totalEntries--;
        this.metadata.entries.delete(hash);
        await this._saveMetadata();
      }
      
      if (deleted) {
        this.logger.debug(`Content deleted: ${hash.substring(0, 8)}`);
      }
      
      return deleted;
      
    } catch (error) {
      this.logger.error('Failed to delete content:', error);
      throw error;
    }
  }

  /**
   * List all cached content with metadata
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} Array of cache entries
   */
  async list(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const entries = Array.from(this.metadata.entries.values());
    
    // Apply filters
    let filtered = entries;
    
    if (options.contentType) {
      filtered = filtered.filter(entry => entry.contentType === options.contentType);
    }
    
    if (options.tags) {
      filtered = filtered.filter(entry => 
        options.tags.some(tag => entry.tags.includes(tag))
      );
    }
    
    if (options.minSize) {
      filtered = filtered.filter(entry => entry.size >= options.minSize);
    }
    
    if (options.maxSize) {
      filtered = filtered.filter(entry => entry.size <= options.maxSize);
    }
    
    // Apply sorting
    if (options.sortBy === 'size') {
      filtered.sort((a, b) => b.size - a.size);
    } else if (options.sortBy === 'accessed') {
      filtered.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
    } else if (options.sortBy === 'stored') {
      filtered.sort((a, b) => new Date(b.storedAt) - new Date(a.storedAt));
    }
    
    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  /**
   * Clean up old or unused cache entries
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logger.info('Starting cache cleanup');
      
      const cleanupOptions = {
        maxAge: options.maxAge || 30 * 24 * 60 * 60 * 1000, // 30 days
        maxEntries: options.maxEntries || this.options.maxCacheSize,
        minAccessCount: options.minAccessCount || 1,
        ...options
      };
      
      const entries = Array.from(this.metadata.entries.values());
      const now = this.getDeterministicDate();
      let deletedCount = 0;
      let freedSpace = 0;
      
      // Find entries to delete
      const toDelete = [];
      
      for (const entry of entries) {
        const age = now - new Date(entry.lastAccessed);
        
        // Delete if too old
        if (age > cleanupOptions.maxAge) {
          toDelete.push(entry);
        }
        // Delete if access count is too low
        else if (entry.accessCount < cleanupOptions.minAccessCount) {
          toDelete.push(entry);
        }
      }
      
      // If still over limit, delete least recently accessed
      if (entries.length - toDelete.length > cleanupOptions.maxEntries) {
        const remaining = entries.filter(e => !toDelete.includes(e));
        remaining.sort((a, b) => new Date(a.lastAccessed) - new Date(b.lastAccessed));
        
        const excessCount = remaining.length - cleanupOptions.maxEntries;
        toDelete.push(...remaining.slice(0, excessCount));
      }
      
      // Delete entries
      for (const entry of toDelete) {
        if (await this.delete(entry.hash)) {
          deletedCount++;
          freedSpace += entry.size;
        }
      }
      
      const result = {
        deletedEntries: deletedCount,
        freedSpace,
        remainingEntries: this.metadata.stats.totalEntries,
        remainingSize: this.metadata.stats.totalSize
      };
      
      this.logger.success(`Cache cleanup completed: ${deletedCount} entries deleted, ${this._formatBytes(freedSpace)} freed`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Cache cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...this.metadata.stats,
      memoryCache: {
        entries: this.memoryCache.size,
        estimatedSize: Array.from(this.memoryCache.values())
          .reduce((sum, entry) => sum + entry.content.length, 0)
      },
      hitRate: {
        memory: this.metadata.stats.memoryHits / (this.metadata.stats.memoryHits + this.metadata.stats.diskHits + this.metadata.stats.misses),
        disk: this.metadata.stats.diskHits / (this.metadata.stats.diskHits + this.metadata.stats.misses),
        total: (this.metadata.stats.memoryHits + this.metadata.stats.diskHits) / 
               (this.metadata.stats.memoryHits + this.metadata.stats.diskHits + this.metadata.stats.misses)
      }
    };
  }

  // Private methods

  _calculateHash(content) {
    return createHash(this.options.hashAlgorithm).update(content).digest('hex');
  }

  _getFilePath(hash) {
    // Use first 2 characters for directory structure to avoid too many files in one directory
    const dir = hash.substring(0, 2);
    const filename = hash.substring(2);
    return path.join(this.options.cacheDir, dir, filename);
  }

  async _exists(hash) {
    try {
      const filePath = this._getFilePath(hash);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async _compress(content) {
    // Simple compression placeholder - in practice you'd use zlib or similar
    return content;
  }

  async _decompress(content) {
    // Decompression placeholder
    return content;
  }

  _updateAccessTime(hash) {
    if (this.metadata.entries.has(hash)) {
      const entry = this.metadata.entries.get(hash);
      entry.lastAccessed = this.getDeterministicDate();
      entry.accessCount++;
    }
  }

  _trimMemoryCache() {
    if (this.memoryCache.size <= this.options.maxCacheSize) {
      return;
    }
    
    // Remove least recently used entries
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    const toRemove = entries.slice(0, entries.length - this.options.maxCacheSize);
    for (const [hash] of toRemove) {
      this.memoryCache.delete(hash);
    }
  }

  async _loadMetadata() {
    try {
      const metadataPath = path.join(this.options.cacheDir, 'metadata.json');
      const data = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      this.metadata = {
        ...this.metadata,
        ...data,
        entries: new Map(data.entries || [])
      };
      
      this.logger.debug(`Cache metadata loaded: ${this.metadata.stats.totalEntries} entries`);
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load cache metadata:', error);
      }
    }
  }

  async _saveMetadata() {
    try {
      const metadataPath = path.join(this.options.cacheDir, 'metadata.json');
      const data = {
        ...this.metadata,
        entries: Array.from(this.metadata.entries.entries())
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      this.logger.warn('Failed to save cache metadata:', error);
    }
  }

  _formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default ContentAddressedCache;