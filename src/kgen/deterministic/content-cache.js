/**
 * Content-Addressed Caching System for Deterministic Rendering
 * 
 * Provides immutable, content-based caching where:
 * - Cache keys are derived from content hashes
 * - Identical content always produces same cache key
 * - Cache entries are immutable once created
 * - Support for cache invalidation and cleanup
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from 'consola';

export class ContentAddressedCache extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      cacheDir: options.cacheDir || '.kgen/cache/content',
      maxCacheSize: options.maxCacheSize || 1024 * 1024 * 100, // 100MB
      maxEntries: options.maxEntries || 10000,
      enablePersistence: options.enablePersistence !== false,
      compressionLevel: options.compressionLevel || 6,
      ttl: options.ttl || 7 * 24 * 60 * 60 * 1000, // 7 days
      ...options
    };
    
    this.logger = new Logger({ tag: 'content-cache' });
    
    // In-memory cache for fast access
    this.memoryCache = new Map();
    
    // Content hash to file path mapping
    this.hashToPath = new Map();
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      totalSize: 0,
      createdAt: new Date()
    };
    
    // Initialize cache directory
    this._initializeCache();
  }
  
  /**
   * Initialize cache directory and load existing entries
   */
  async _initializeCache() {
    try {
      if (this.config.enablePersistence) {
        await fs.mkdir(this.config.cacheDir, { recursive: true });
        await this._loadExistingEntries();
      }
      
      this.logger.debug('Content-addressed cache initialized');
      this.emit('cache:initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize cache:', error);
      this.emit('cache:error', error);
    }
  }
  
  /**
   * Store content in cache using content hash as key
   */
  async store(content, metadata = {}) {
    try {
      // Generate content hash
      const contentHash = this._generateContentHash(content);
      
      // Check if already cached
      if (this.memoryCache.has(contentHash)) {
        this.stats.hits++;
        return {
          hash: contentHash,
          cached: true,
          path: this.hashToPath.get(contentHash)
        };
      }
      
      // Create cache entry
      const entry = {
        hash: contentHash,
        content,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          size: Buffer.byteLength(content, 'utf8'),
          contentType: metadata.contentType || 'text/plain'
        },
        accessCount: 0,
        lastAccessed: new Date()
      };
      
      // Store in memory cache
      this.memoryCache.set(contentHash, entry);
      this.stats.totalSize += entry.metadata.size;
      
      // Persist to disk if enabled
      let filePath = null;
      if (this.config.enablePersistence) {
        filePath = await this._persistEntry(contentHash, entry);
        this.hashToPath.set(contentHash, filePath);
      }
      
      this.stats.writes++;
      
      // Check cache limits and evict if necessary
      await this._enforceCacheLimits();
      
      this.emit('cache:store', { hash: contentHash, size: entry.metadata.size });
      
      return {
        hash: contentHash,
        cached: false,
        path: filePath,
        size: entry.metadata.size
      };
      
    } catch (error) {
      this.logger.error('Failed to store content in cache:', error);
      this.emit('cache:error', error);
      throw error;
    }
  }
  
  /**
   * Retrieve content from cache by hash
   */
  async retrieve(hash) {
    try {
      // Check memory cache first
      if (this.memoryCache.has(hash)) {
        const entry = this.memoryCache.get(hash);
        entry.accessCount++;
        entry.lastAccessed = new Date();
        
        this.stats.hits++;
        this.emit('cache:hit', { hash, source: 'memory' });
        
        return {
          found: true,
          content: entry.content,
          metadata: entry.metadata,
          hash
        };
      }
      
      // Try to load from disk
      if (this.config.enablePersistence && this.hashToPath.has(hash)) {
        const filePath = this.hashToPath.get(hash);
        const entry = await this._loadPersistedEntry(hash, filePath);
        
        if (entry) {
          // Add back to memory cache
          this.memoryCache.set(hash, entry);
          
          this.stats.hits++;
          this.emit('cache:hit', { hash, source: 'disk' });
          
          return {
            found: true,
            content: entry.content,
            metadata: entry.metadata,
            hash
          };
        }
      }
      
      this.stats.misses++;
      this.emit('cache:miss', { hash });
      
      return {
        found: false,
        hash
      };
      
    } catch (error) {
      this.logger.error('Failed to retrieve content from cache:', error);
      this.emit('cache:error', error);
      return { found: false, error: error.message, hash };
    }
  }
  
  /**
   * Check if content exists in cache
   */
  async exists(hash) {
    if (this.memoryCache.has(hash)) {
      return true;
    }
    
    if (this.config.enablePersistence && this.hashToPath.has(hash)) {
      const filePath = this.hashToPath.get(hash);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        // File doesn't exist, cleanup mapping
        this.hashToPath.delete(hash);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Delete content from cache
   */
  async delete(hash) {
    try {
      let deleted = false;
      
      // Remove from memory cache
      if (this.memoryCache.has(hash)) {
        const entry = this.memoryCache.get(hash);
        this.stats.totalSize -= entry.metadata.size;
        this.memoryCache.delete(hash);
        deleted = true;
      }
      
      // Remove persisted file
      if (this.config.enablePersistence && this.hashToPath.has(hash)) {
        const filePath = this.hashToPath.get(hash);
        try {
          await fs.unlink(filePath);
          this.hashToPath.delete(hash);
          deleted = true;
        } catch (error) {
          // File might not exist
          this.logger.debug(`Could not delete cache file: ${filePath}`);
        }
      }
      
      if (deleted) {
        this.emit('cache:delete', { hash });
      }
      
      return deleted;
      
    } catch (error) {
      this.logger.error('Failed to delete cache entry:', error);
      this.emit('cache:error', error);
      return false;
    }
  }
  
  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.hashToPath.clear();
      
      // Clear persisted cache
      if (this.config.enablePersistence) {
        try {
          await fs.rm(this.config.cacheDir, { recursive: true, force: true });
          await fs.mkdir(this.config.cacheDir, { recursive: true });
        } catch (error) {
          this.logger.debug('Cache directory cleanup failed:', error);
        }
      }
      
      // Reset statistics
      this.stats.totalSize = 0;
      this.stats.evictions = 0;
      
      this.emit('cache:cleared');
      this.logger.info('Cache cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      this.emit('cache:error', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      memoryEntries: this.memoryCache.size,
      persistedEntries: this.hashToPath.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      averageEntrySize: this.memoryCache.size > 0 
        ? this.stats.totalSize / this.memoryCache.size 
        : 0,
      uptime: Date.now() - this.stats.createdAt.getTime()
    };
  }
  
  /**
   * Cleanup expired entries
   */
  async cleanup() {
    try {
      const now = Date.now();
      const expired = [];
      
      // Find expired entries
      for (const [hash, entry] of this.memoryCache.entries()) {
        const age = now - new Date(entry.metadata.createdAt).getTime();
        if (age > this.config.ttl) {
          expired.push(hash);
        }
      }
      
      // Remove expired entries
      for (const hash of expired) {
        await this.delete(hash);
        this.stats.evictions++;
      }
      
      this.emit('cache:cleanup', { expired: expired.length });
      
      if (expired.length > 0) {
        this.logger.info(`Cleaned up ${expired.length} expired cache entries`);
      }
      
      return { expired: expired.length };
      
    } catch (error) {
      this.logger.error('Failed to cleanup cache:', error);
      this.emit('cache:error', error);
      return { expired: 0, error: error.message };
    }
  }
  
  /**
   * Generate deterministic content hash
   */
  _generateContentHash(content) {
    const hash = crypto.createHash('sha256');
    
    if (typeof content === 'object') {
      // Sort object keys for deterministic hashing
      hash.update(JSON.stringify(this._sortObjectKeys(content)));
    } else {
      hash.update(content.toString());
    }
    
    return hash.digest('hex');
  }
  
  /**
   * Sort object keys recursively for deterministic hashing
   */
  _sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObjectKeys(item));
    }
    
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this._sortObjectKeys(obj[key]);
    });
    
    return sorted;
  }
  
  /**
   * Load existing cache entries from disk
   */
  async _loadExistingEntries() {
    try {
      const files = await fs.readdir(this.config.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const hash = file.replace('.cache', '');
          const filePath = path.join(this.config.cacheDir, file);
          this.hashToPath.set(hash, filePath);
        }
      }
      
      this.logger.debug(`Loaded ${files.length} existing cache entries`);
      
    } catch (error) {
      this.logger.debug('No existing cache entries found');
    }
  }
  
  /**
   * Persist cache entry to disk
   */
  async _persistEntry(hash, entry) {
    const fileName = `${hash}.cache`;
    const filePath = path.join(this.config.cacheDir, fileName);
    
    const persistedData = {
      hash,
      content: entry.content,
      metadata: entry.metadata
    };
    
    await fs.writeFile(filePath, JSON.stringify(persistedData));
    
    return filePath;
  }
  
  /**
   * Load persisted cache entry from disk
   */
  async _loadPersistedEntry(hash, filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      return {
        hash: parsed.hash,
        content: parsed.content,
        metadata: parsed.metadata,
        accessCount: 0,
        lastAccessed: new Date()
      };
      
    } catch (error) {
      this.logger.debug(`Failed to load persisted entry: ${filePath}`);
      return null;
    }
  }
  
  /**
   * Enforce cache size and entry limits
   */
  async _enforceCacheLimits() {
    // Check memory cache size
    if (this.stats.totalSize > this.config.maxCacheSize) {
      await this._evictLRUEntries();
    }
    
    // Check entry count
    if (this.memoryCache.size > this.config.maxEntries) {
      await this._evictLRUEntries();
    }
  }
  
  /**
   * Evict least recently used entries
   */
  async _evictLRUEntries() {
    // Sort entries by last accessed time
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Evict oldest 10% or until under limits
    const targetSize = this.config.maxCacheSize * 0.8;
    const targetCount = this.config.maxEntries * 0.8;
    
    let evicted = 0;
    for (const [hash, entry] of entries) {
      if (this.stats.totalSize <= targetSize && this.memoryCache.size <= targetCount) {
        break;
      }
      
      await this.delete(hash);
      evicted++;
    }
    
    this.stats.evictions += evicted;
    
    if (evicted > 0) {
      this.logger.info(`Evicted ${evicted} LRU cache entries`);
      this.emit('cache:eviction', { count: evicted });
    }
  }
}

export default ContentAddressedCache;