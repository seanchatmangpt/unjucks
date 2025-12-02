/**
 * Registry caching layer with TTL-based invalidation and offline support
 * Provides intelligent caching for package metadata, search results, and content
 */

import { readFile, writeFile, mkdir, readdir, stat, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';

export class RegistryCacheError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryCacheError';
    this.code = code;
  }
}

export class RegistryCache extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.cacheDir = options.directory || join(process.cwd(), '.kgen', 'registry-cache');
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.cleanupInterval = options.cleanupInterval || 60 * 60 * 1000; // 1 hour
    
    // TTL settings in milliseconds
    this.ttl = {
      packageInfo: options.ttl?.packageInfo || 60 * 60 * 1000,    // 1 hour
      searchResults: options.ttl?.searchResults || 30 * 60 * 1000, // 30 minutes
      packageContent: options.ttl?.packageContent || 24 * 60 * 60 * 1000, // 24 hours
      ...options.ttl
    };
    
    // In-memory cache for frequently accessed items
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes in memory
      updateAgeOnGet: true
    });
    
    this.enabled = options.enabled !== false;
    this.compressionLevel = options.compressionLevel || 6;
    this.initialized = false;
    this.cleanupTimer = null;
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      errors: 0
    };
  }

  /**
   * Initialize the cache system
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.enabled) {
      this.initialized = true;
      return;
    }

    try {
      // Ensure cache directory exists
      await mkdir(this.cacheDir, { recursive: true });
      
      // Create subdirectories for different cache types
      const subdirs = ['packages', 'search', 'content', 'metadata'];
      await Promise.all(subdirs.map(dir => 
        mkdir(join(this.cacheDir, dir), { recursive: true })
      ));
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.initialized = true;
      this.emit('initialized', { cacheDir: this.cacheDir });
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryCacheError(`Failed to initialize cache: ${error.message}`, 'INIT_FAILED');
    }
  }

  /**
   * Get cached package information
   * @param {string} registry - Registry name
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @returns {Promise<Object|null>} Cached package info or null
   */
  async getPackageInfo(registry, name, version) {
    if (!this.enabled || !this.initialized) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('package', registry, name, version);
      
      // Check memory cache first
      const memoryCached = this.memoryCache.get(cacheKey);
      if (memoryCached) {
        this.stats.hits++;
        this.emit('hit', { type: 'package', source: 'memory', key: cacheKey });
        return memoryCached;
      }
      
      // Check disk cache
      const cacheEntry = await this.getCacheEntry('packages', cacheKey);
      if (cacheEntry && !this.isExpired(cacheEntry, this.ttl.packageInfo)) {
        this.stats.hits++;
        
        // Update memory cache
        this.memoryCache.set(cacheKey, cacheEntry.data);
        
        this.emit('hit', { type: 'package', source: 'disk', key: cacheKey });
        return cacheEntry.data;
      }
      
      this.stats.misses++;
      this.emit('miss', { type: 'package', key: cacheKey });
      return null;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'getPackageInfo', error });
      return null;
    }
  }

  /**
   * Cache package information
   * @param {string} registry - Registry name
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @param {Object} data - Package data to cache
   * @returns {Promise<void>}
   */
  async setPackageInfo(registry, name, version, data) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey('package', registry, name, version);
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, data);
      
      // Store in disk cache
      await this.setCacheEntry('packages', cacheKey, data);
      
      this.stats.writes++;
      this.emit('write', { type: 'package', key: cacheKey, size: JSON.stringify(data).length });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'setPackageInfo', error });
    }
  }

  /**
   * Get cached search results
   * @param {string} registry - Registry name
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array|null>} Cached search results or null
   */
  async getSearchResults(registry, query, options = {}) {
    if (!this.enabled || !this.initialized) {
      return null;
    }

    try {
      const cacheKey = this.generateSearchKey(registry, query, options);
      
      // Check memory cache first
      const memoryCached = this.memoryCache.get(cacheKey);
      if (memoryCached) {
        this.stats.hits++;
        this.emit('hit', { type: 'search', source: 'memory', key: cacheKey });
        return memoryCached;
      }
      
      // Check disk cache
      const cacheEntry = await this.getCacheEntry('search', cacheKey);
      if (cacheEntry && !this.isExpired(cacheEntry, this.ttl.searchResults)) {
        this.stats.hits++;
        
        // Update memory cache
        this.memoryCache.set(cacheKey, cacheEntry.data);
        
        this.emit('hit', { type: 'search', source: 'disk', key: cacheKey });
        return cacheEntry.data;
      }
      
      this.stats.misses++;
      this.emit('miss', { type: 'search', key: cacheKey });
      return null;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'getSearchResults', error });
      return null;
    }
  }

  /**
   * Cache search results
   * @param {string} registry - Registry name
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {Array} results - Search results to cache
   * @returns {Promise<void>}
   */
  async setSearchResults(registry, query, options, results) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      const cacheKey = this.generateSearchKey(registry, query, options);
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, results);
      
      // Store in disk cache
      await this.setCacheEntry('search', cacheKey, results);
      
      this.stats.writes++;
      this.emit('write', { type: 'search', key: cacheKey, size: JSON.stringify(results).length });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'setSearchResults', error });
    }
  }

  /**
   * Get cached package content
   * @param {string} registry - Registry name
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @returns {Promise<Buffer|null>} Cached package content or null
   */
  async getPackageContent(registry, name, version) {
    if (!this.enabled || !this.initialized) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey('content', registry, name, version);
      const cacheEntry = await this.getCacheEntry('content', cacheKey, true); // Binary content
      
      if (cacheEntry && !this.isExpired(cacheEntry, this.ttl.packageContent)) {
        this.stats.hits++;
        this.emit('hit', { type: 'content', source: 'disk', key: cacheKey });
        return cacheEntry.data;
      }
      
      this.stats.misses++;
      this.emit('miss', { type: 'content', key: cacheKey });
      return null;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'getPackageContent', error });
      return null;
    }
  }

  /**
   * Cache package content
   * @param {string} registry - Registry name
   * @param {string} name - Package name
   * @param {string} version - Package version
   * @param {Buffer} content - Package content to cache
   * @returns {Promise<void>}
   */
  async setPackageContent(registry, name, version, content) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey('content', registry, name, version);
      await this.setCacheEntry('content', cacheKey, content, true); // Binary content
      
      this.stats.writes++;
      this.emit('write', { type: 'content', key: cacheKey, size: content.length });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'setPackageContent', error });
    }
  }

  /**
   * Invalidate cache entries for a specific package
   * @param {string} registry - Registry name
   * @param {string} name - Package name
   * @param {string} version - Package version (optional, invalidates all versions if not provided)
   * @returns {Promise<void>}
   */
  async invalidatePackage(registry, name, version = null) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      const patterns = [];
      
      if (version) {
        patterns.push(this.generateCacheKey('package', registry, name, version));
        patterns.push(this.generateCacheKey('content', registry, name, version));
      } else {
        // Invalidate all versions
        patterns.push(`package-${registry}-${name}-`);
        patterns.push(`content-${registry}-${name}-`);
      }
      
      for (const pattern of patterns) {
        if (version) {
          // Remove specific entry
          await this.removeCacheEntry('packages', pattern);
          await this.removeCacheEntry('content', pattern);
          this.memoryCache.delete(pattern);
        } else {
          // Remove entries matching pattern
          await this.removeCacheEntriesMatching('packages', pattern);
          await this.removeCacheEntriesMatching('content', pattern);
          
          // Remove from memory cache
          for (const key of this.memoryCache.keys()) {
            if (key.startsWith(pattern)) {
              this.memoryCache.delete(key);
            }
          }
        }
      }
      
      this.emit('invalidated', { registry, name, version });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'invalidatePackage', error });
    }
  }

  /**
   * Clear entire cache
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Clear disk cache
      const subdirs = ['packages', 'search', 'content', 'metadata'];
      for (const subdir of subdirs) {
        const dirPath = join(this.cacheDir, subdir);
        try {
          const files = await readdir(dirPath);
          await Promise.all(files.map(file => unlink(join(dirPath, file))));
        } catch (error) {
          // Directory might not exist or be empty
        }
      }
      
      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        writes: 0,
        evictions: 0,
        errors: 0
      };
      
      this.emit('cleared');
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'clear', error });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getStats() {
    const diskUsage = await this.calculateDiskUsage();
    const memoryUsage = this.memoryCache.calculatedSize || 0;
    
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      diskUsage: diskUsage,
      memoryUsage: memoryUsage,
      memoryEntries: this.memoryCache.size,
      enabled: this.enabled,
      initialized: this.initialized
    };
  }

  /**
   * Perform cache cleanup (remove expired entries)
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup() {
    if (!this.enabled || !this.initialized) {
      return { removed: 0, freed: 0 };
    }

    try {
      let removed = 0;
      let freed = 0;
      
      const subdirs = ['packages', 'search', 'content', 'metadata'];
      
      for (const subdir of subdirs) {
        const dirPath = join(this.cacheDir, subdir);
        
        try {
          const files = await readdir(dirPath);
          
          for (const file of files) {
            const filePath = join(dirPath, file);
            const stats = await stat(filePath);
            
            // Check if file is expired based on its type
            const ttl = this.getTtlForFile(file);
            const age = Date.now() - stats.mtime.getTime();
            
            if (age > ttl) {
              freed += stats.size;
              await unlink(filePath);
              removed++;
            }
          }
        } catch (error) {
          // Directory might not exist
        }
      }
      
      // Check total disk usage and remove oldest files if over limit
      const totalUsage = await this.calculateDiskUsage();
      if (totalUsage > this.maxSize) {
        const freedFromSizeLimit = await this.enforceMaxSize();
        freed += freedFromSizeLimit.freed;
        removed += freedFromSizeLimit.removed;
      }
      
      this.stats.evictions += removed;
      this.emit('cleanup', { removed, freed });
      
      return { removed, freed };
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'cleanup', error });
      return { removed: 0, freed: 0 };
    }
  }

  /**
   * Enable or disable the cache
   * @param {boolean} enabled - Enable state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.emit('enabledChanged', { enabled });
  }

  /**
   * Get a cache entry from disk
   * @private
   */
  async getCacheEntry(subdir, key, binary = false) {
    const filePath = join(this.cacheDir, subdir, this.sanitizeKey(key));
    
    try {
      await access(filePath);
      const content = await readFile(filePath);
      
      if (binary) {
        // For binary content, the file is the data itself with metadata in a separate file
        const metaPath = filePath + '.meta';
        const metaContent = await readFile(metaPath, 'utf8');
        const metadata = JSON.parse(metaContent);
        
        return {
          data: content,
          timestamp: metadata.timestamp,
          ttl: metadata.ttl
        };
      } else {
        const parsed = JSON.parse(content.toString());
        return parsed;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Set a cache entry on disk
   * @private
   */
  async setCacheEntry(subdir, key, data, binary = false) {
    const filePath = join(this.cacheDir, subdir, this.sanitizeKey(key));
    
    const entry = {
      data: data,
      timestamp: Date.now(),
      ttl: this.getTtlForType(subdir)
    };
    
    if (binary) {
      // Store binary data directly and metadata separately
      await writeFile(filePath, data);
      await writeFile(filePath + '.meta', JSON.stringify({
        timestamp: entry.timestamp,
        ttl: entry.ttl
      }));
    } else {
      await writeFile(filePath, JSON.stringify(entry));
    }
  }

  /**
   * Remove a cache entry from disk
   * @private
   */
  async removeCacheEntry(subdir, key) {
    const filePath = join(this.cacheDir, subdir, this.sanitizeKey(key));
    
    try {
      await unlink(filePath);
      await unlink(filePath + '.meta').catch(() => {}); // Meta file might not exist
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * Remove cache entries matching a pattern
   * @private
   */
  async removeCacheEntriesMatching(subdir, pattern) {
    const dirPath = join(this.cacheDir, subdir);
    
    try {
      const files = await readdir(dirPath);
      const matchingFiles = files.filter(file => file.includes(pattern));
      
      await Promise.all(matchingFiles.map(file => 
        unlink(join(dirPath, file)).catch(() => {})
      ));
    } catch (error) {
      // Directory might not exist
    }
  }

  /**
   * Generate cache key for package operations
   * @private
   */
  generateCacheKey(type, registry, name, version) {
    return `${type}-${registry}-${name}-${version}`;
  }

  /**
   * Generate cache key for search operations
   * @private
   */
  generateSearchKey(registry, query, options) {
    const optionsHash = createHash('md5')
      .update(JSON.stringify(options))
      .digest('hex')
      .substring(0, 8);
      
    const queryHash = createHash('md5')
      .update(query)
      .digest('hex')
      .substring(0, 8);
      
    return `search-${registry}-${queryHash}-${optionsHash}`;
  }

  /**
   * Check if a cache entry is expired
   * @private
   */
  isExpired(entry, ttl) {
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Sanitize cache key for filesystem
   * @private
   */
  sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9-_.]/g, '_');
  }

  /**
   * Get TTL for a file based on its name
   * @private
   */
  getTtlForFile(filename) {
    if (filename.startsWith('package-')) return this.ttl.packageInfo;
    if (filename.startsWith('search-')) return this.ttl.searchResults;
    if (filename.startsWith('content-')) return this.ttl.packageContent;
    return this.ttl.packageInfo; // Default
  }

  /**
   * Get TTL for a cache type
   * @private
   */
  getTtlForType(type) {
    const typeMap = {
      'packages': this.ttl.packageInfo,
      'search': this.ttl.searchResults,
      'content': this.ttl.packageContent
    };
    
    return typeMap[type] || this.ttl.packageInfo;
  }

  /**
   * Calculate total disk usage
   * @private
   */
  async calculateDiskUsage() {
    let total = 0;
    const subdirs = ['packages', 'search', 'content', 'metadata'];
    
    for (const subdir of subdirs) {
      const dirPath = join(this.cacheDir, subdir);
      
      try {
        const files = await readdir(dirPath);
        
        for (const file of files) {
          const filePath = join(dirPath, file);
          const stats = await stat(filePath);
          total += stats.size;
        }
      } catch (error) {
        // Directory might not exist
      }
    }
    
    return total;
  }

  /**
   * Enforce maximum cache size by removing oldest files
   * @private
   */
  async enforceMaxSize() {
    const files = [];
    const subdirs = ['packages', 'search', 'content', 'metadata'];
    
    // Collect all files with their stats
    for (const subdir of subdirs) {
      const dirPath = join(this.cacheDir, subdir);
      
      try {
        const dirFiles = await readdir(dirPath);
        
        for (const file of dirFiles) {
          const filePath = join(dirPath, file);
          const stats = await stat(filePath);
          
          files.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime.getTime()
          });
        }
      } catch (error) {
        // Directory might not exist
      }
    }
    
    // Sort by modification time (oldest first)
    files.sort((a, b) => a.mtime - b.mtime);
    
    let currentSize = files.reduce((sum, file) => sum + file.size, 0);
    let removed = 0;
    let freed = 0;
    
    // Remove files until we're under the limit
    for (const file of files) {
      if (currentSize <= this.maxSize) {
        break;
      }
      
      try {
        await unlink(file.path);
        currentSize -= file.size;
        freed += file.size;
        removed++;
      } catch (error) {
        // File might have been removed already
      }
    }
    
    return { removed, freed };
  }

  /**
   * Start the cleanup timer
   * @private
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.emit('error', { operation: 'automaticCleanup', error });
      });
    }, this.cleanupInterval);
  }

  /**
   * Stop the cleanup timer
   * @private
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Cleanup cache resources
   */
  async destroy() {
    this.stopCleanupTimer();
    this.memoryCache.clear();
    this.removeAllListeners();
  }
}

export default RegistryCache;