/**
 * Content-Addressable Caching System for KGEN
 * 
 * Unified caching system that combines patterns from existing cache implementations
 * with content-addressed storage and efficient garbage collection.
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import { performance } from 'perf_hooks';
import { Store, Parser, Writer } from 'n3';

export class ContentAddressedCache {
  constructor(config = {}) {
    this.config = {
      // Core settings
      cacheDir: config.cacheDir || './cache/kgen',
      hashAlgorithm: 'sha256',
      compressionEnabled: true,
      maxCacheSize: config.maxCacheSize || '1GB',
      maxEntries: config.maxEntries || 10000,
      
      // TTL and lifecycle
      defaultTTL: config.defaultTTL || 86400000, // 24 hours
      cleanupInterval: config.cleanupInterval || 3600000, // 1 hour
      
      // Performance options
      enableIntegrity: true,
      enableMetrics: true,
      enableCompression: true,
      compressionLevel: 6,
      writeBehind: true,
      batchWrites: true,
      
      // Template cache integration
      templateCacheOptions: {
        maxSize: 100,
        ttl: 300000, // 5 minutes
        compressionThreshold: 1024
      },
      
      ...config
    };

    this.logger = consola.withTag('content-cache');
    
    // Metrics tracking
    this.metrics = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      integrity_failures: 0,
      template_hits: 0,
      template_misses: 0,
      gc_runs: 0,
      bytes_written: 0,
      bytes_read: 0,
      start_time: Date.now()
    };

    // Cache layers
    this.memoryCache = new Map(); // L1 cache - hot data
    this.diskCache = new Map();   // L2 cache index
    this.templateCache = new Map(); // Template-specific cache
    
    // Maintenance
    this.cleanupTimer = null;
    this.writeQueue = [];
    this.writeBatch = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Initialize cache system with all layers
   */
  async initialize() {
    try {
      this.logger.info('Initializing content-addressed cache system...');

      // Create cache directory structure
      await this._createCacheStructure();

      // Load existing cache index
      await this._loadCacheIndex();
      
      // Load template cache
      await this._loadTemplateCache();

      // Start maintenance processes
      this._startMaintenanceLoop();
      this._startBatchWriter();

      this.logger.success(`Content-addressed cache initialized with ${this.diskCache.size} entries`);
      return { 
        status: 'success', 
        cacheDir: this.config.cacheDir,
        entries: this.diskCache.size,
        templateEntries: this.templateCache.size
      };

    } catch (error) {
      this.logger.error('Failed to initialize cache:', error);
      throw error;
    }
  }

  /**
   * Generate content-addressed key with context awareness
   */
  generateContentKey(content, context = {}) {
    const normalizedContent = this._normalizeContent(content);
    const contextKey = this._normalizeContext(context);
    
    const combinedInput = JSON.stringify({
      content: normalizedContent,
      context: contextKey,
      version: '2.0', // Updated version for new implementation
      timestamp: Math.floor(Date.now() / 1000) // Rounded timestamp for cache stability
    }, Object.keys({ content: null, context: null, version: null, timestamp: null }).sort());

    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(combinedInput)
      .digest('hex');
  }

  /**
   * Store content with automatic layer selection
   */
  async store(content, metadata = {}, context = {}) {
    if (this.isShuttingDown) return null;

    try {
      const contentKey = this.generateContentKey(content, context);
      const timestamp = Date.now();
      const size = this._calculateSize(content);

      const cacheEntry = {
        key: contentKey,
        content,
        metadata: {
          ...metadata,
          created_at: timestamp,
          accessed_at: timestamp,
          access_count: 0,
          content_type: this._detectContentType(content),
          size,
          context,
          layer: this._selectOptimalLayer(size, context)
        },
        integrity_hash: this._generateIntegrityHash(content)
      };

      // Store based on content type and size
      if (cacheEntry.metadata.content_type === 'template' || context.isTemplate) {
        await this._storeTemplate(contentKey, cacheEntry, context);
      } else {
        // Store in memory cache (L1)
        this.memoryCache.set(contentKey, cacheEntry);
        
        // Queue for disk storage if enabled
        if (this.config.writeBehind) {
          this._queueDiskWrite(contentKey, cacheEntry);
        } else {
          await this._storeToDisk(contentKey, cacheEntry);
        }
      }

      this.metrics.writes++;
      this.metrics.bytes_written += size;
      
      this.logger.debug(`Cached content with key: ${contentKey.substring(0, 12)}...`);

      return contentKey;

    } catch (error) {
      this.logger.error('Failed to store cache entry:', error);
      throw error;
    }
  }

  /**
   * Retrieve content with automatic layer detection
   */
  async retrieve(contentKey, generator = null, context = {}) {
    try {
      const startTime = performance.now();
      let entry = null;
      let hitLayer = 'miss';

      // Check template cache first for template content
      if (context.isTemplate || this.templateCache.has(contentKey)) {
        entry = await this._retrieveTemplate(contentKey);
        if (entry) {
          hitLayer = 'template';
          this.metrics.template_hits++;
        }
      }

      // Check memory cache (L1)
      if (!entry) {
        entry = this.memoryCache.get(contentKey);
        if (entry) {
          hitLayer = 'memory';
        }
      }

      // Check disk cache (L2)
      if (!entry) {
        entry = await this._retrieveFromDisk(contentKey);
        if (entry) {
          hitLayer = 'disk';
          // Promote to memory cache
          this.memoryCache.set(contentKey, entry);
        }
      }

      if (entry) {
        // Verify integrity
        if (this.config.enableIntegrity && !this._verifyIntegrity(entry)) {
          this.logger.warn(`Integrity verification failed for key: ${contentKey.substring(0, 12)}...`);
          this.metrics.integrity_failures++;
          await this._removeCacheEntry(contentKey);
          entry = null;
        } else {
          // Update access metrics
          entry.metadata.accessed_at = Date.now();
          entry.metadata.access_count++;
          this.metrics.hits++;
          this.metrics.bytes_read += entry.metadata.size;
          
          const duration = performance.now() - startTime;
          this.logger.debug(`Cache hit (${hitLayer}) for key: ${contentKey.substring(0, 12)}... (${duration.toFixed(2)}ms)`);
          
          return entry.content;
        }
      }

      // Cache miss - generate if generator provided
      if (generator && typeof generator === 'function') {
        this.logger.debug(`Cache miss, generating content for key: ${contentKey.substring(0, 12)}...`);
        this.metrics.misses++;
        
        const generatedContent = await generator();
        if (generatedContent) {
          await this.store(generatedContent, { generated: true, generator: generator.name }, context);
          return generatedContent;
        }
      }

      this.metrics.misses++;
      return null;

    } catch (error) {
      this.logger.error(`Failed to retrieve cache entry ${contentKey.substring(0, 12)}...:`, error);
      throw error;
    }
  }

  /**
   * Template-specific retrieval with performance optimization
   */
  async getTemplate(templatePath, context = {}) {
    const key = this._generateTemplateKey(templatePath, context);
    const startTime = performance.now();
    
    try {
      // Check template cache
      const cached = this.templateCache.get(key);
      if (cached && this._isValidTemplateCache(cached, templatePath)) {
        this.metrics.template_hits++;
        const duration = performance.now() - startTime;
        this.logger.debug(`Template cache hit: ${templatePath} (${duration.toFixed(2)}ms)`);
        return cached.content;
      }

      // Load template and cache
      const content = await this._loadTemplateFromDisk(templatePath);
      const templateEntry = {
        content,
        path: templatePath,
        timestamp: Date.now(),
        size: Buffer.byteLength(content, 'utf8'),
        context_hash: this._hashContext(context),
        accessed: 1
      };

      this.templateCache.set(key, templateEntry);
      this._evictTemplatesIfNecessary();
      
      this.metrics.template_misses++;
      const duration = performance.now() - startTime;
      this.logger.debug(`Template loaded and cached: ${templatePath} (${duration.toFixed(2)}ms)`);
      
      return content;

    } catch (error) {
      this.metrics.template_misses++;
      throw new Error(`Template cache error for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Garbage collection with multiple strategies
   */
  async garbageCollect(strategy = 'auto') {
    try {
      this.logger.info(`Starting garbage collection (strategy: ${strategy})...`);
      const startTime = performance.now();
      let evicted = { memory: 0, disk: 0, templates: 0, bytes: 0 };

      switch (strategy) {
        case 'aggressive':
          evicted = await this._aggressiveGC();
          break;
        case 'memory':
          evicted = await this._memoryGC();
          break;
        case 'disk':
          evicted = await this._diskGC();
          break;
        case 'templates':
          evicted = await this._templateGC();
          break;
        case 'expired':
          evicted = await this._expiredGC();
          break;
        default: // 'auto'
          evicted = await this._autoGC();
      }

      this.metrics.gc_runs++;
      const duration = performance.now() - startTime;
      
      this.logger.info(`Garbage collection completed in ${duration.toFixed(2)}ms`, evicted);
      
      return {
        strategy,
        duration,
        evicted,
        remaining: {
          memory: this.memoryCache.size,
          disk: this.diskCache.size,
          templates: this.templateCache.size
        }
      };

    } catch (error) {
      this.logger.error('Garbage collection failed:', error);
      throw error;
    }
  }

  /**
   * List cache contents with filtering
   */
  async listEntries(options = {}) {
    const {
      layer = 'all',
      contentType = null,
      since = null,
      limit = 100,
      sortBy = 'accessed_at',
      order = 'desc'
    } = options;

    const entries = [];

    // Collect from requested layers
    if (layer === 'all' || layer === 'memory') {
      for (const [key, entry] of this.memoryCache) {
        if (this._matchesFilter(entry, { contentType, since })) {
          entries.push({
            key: key.substring(0, 16) + '...',
            layer: 'memory',
            ...this._getEntryInfo(entry)
          });
        }
      }
    }

    if (layer === 'all' || layer === 'disk') {
      for (const [key, info] of this.diskCache) {
        if (this._matchesFilter(info, { contentType, since })) {
          entries.push({
            key: key.substring(0, 16) + '...',
            layer: 'disk',
            ...this._getDiskEntryInfo(info)
          });
        }
      }
    }

    if (layer === 'all' || layer === 'template') {
      for (const [key, entry] of this.templateCache) {
        entries.push({
          key: key.substring(0, 16) + '...',
          layer: 'template',
          path: entry.path,
          size: entry.size,
          accessed: entry.accessed,
          timestamp: entry.timestamp
        });
      }
    }

    // Sort and limit
    entries.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return entries.slice(0, limit);
  }

  /**
   * Purge cache entries based on criteria
   */
  async purge(criteria = {}) {
    const {
      olderThan = null,
      contentType = null,
      layer = 'all',
      pattern = null,
      unused = false
    } = criteria;

    let purged = { count: 0, bytes: 0 };

    // Purge from memory
    if (layer === 'all' || layer === 'memory') {
      const memoryPurged = await this._purgeMemory(criteria);
      purged.count += memoryPurged.count;
      purged.bytes += memoryPurged.bytes;
    }

    // Purge from disk
    if (layer === 'all' || layer === 'disk') {
      const diskPurged = await this._purgeDisk(criteria);
      purged.count += diskPurged.count;
      purged.bytes += diskPurged.bytes;
    }

    // Purge templates
    if (layer === 'all' || layer === 'template') {
      const templatePurged = await this._purgeTemplates(criteria);
      purged.count += templatePurged.count;
      purged.bytes += templatePurged.bytes;
    }

    this.logger.info(`Purged ${purged.count} entries (${this._formatBytes(purged.bytes)})`);
    
    return purged;
  }

  /**
   * Check if a key exists in the cache
   */
  async has(contentKey) {
    try {
      // Check memory cache first
      if (this.memoryCache.has(contentKey)) {
        return true;
      }
      
      // Check disk cache
      if (this.diskCache.has(contentKey)) {
        return true;
      }
      
      // Check template cache
      for (const [key] of this.templateCache) {
        if (key.includes(contentKey) || contentKey.includes(key)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to check key existence ${contentKey}:`, error);
      return false;
    }
  }

  /**
   * Remove content from cache
   */
  async remove(contentKey) {
    try {
      let removed = false;
      let bytesFreed = 0;
      
      // Remove from memory cache
      if (this.memoryCache.has(contentKey)) {
        const entry = this.memoryCache.get(contentKey);
        bytesFreed += entry.metadata.size || 0;
        this.memoryCache.delete(contentKey);
        removed = true;
      }
      
      // Remove from disk cache  
      if (this.diskCache.has(contentKey)) {
        await this._removeCacheEntry(contentKey);
        removed = true;
      }
      
      // Remove from template cache
      for (const [key] of this.templateCache) {
        if (key.includes(contentKey) || contentKey.includes(key)) {
          const entry = this.templateCache.get(key);
          bytesFreed += entry.size || 0;
          this.templateCache.delete(key);
          removed = true;
          break;
        }
      }
      
      if (removed) {
        this.metrics.evictions++;
        this.logger.debug(`Removed cache entry: ${contentKey.substring(0, 12)}...`);
      }
      
      return { removed, bytesFreed };
      
    } catch (error) {
      this.logger.error(`Failed to remove cache entry ${contentKey}:`, error);
      return { removed: false, bytesFreed: 0 };
    }
  }

  /**
   * Clear entire cache
   */
  async clear() {
    try {
      let totalFreed = 0;
      
      // Clear memory cache
      for (const [, entry] of this.memoryCache) {
        totalFreed += entry.metadata.size || 0;
      }
      this.memoryCache.clear();
      
      // Clear disk cache
      for (const [key] of this.diskCache) {
        await this._removeCacheEntry(key);
      }
      
      // Clear template cache
      for (const [, entry] of this.templateCache) {
        totalFreed += entry.size || 0;
      }
      this.templateCache.clear();
      
      this.logger.info(`Cleared entire cache, freed ${this._formatBytes(totalFreed)}`);
      return { bytesFreed: totalFreed };
      
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Show cache statistics and health
   */
  getStatistics() {
    const now = Date.now();
    const uptime = now - this.metrics.start_time;
    const hitRate = this.metrics.hits + this.metrics.misses > 0 ? 
      this.metrics.hits / (this.metrics.hits + this.metrics.misses) : 0;
    const templateHitRate = this.metrics.template_hits + this.metrics.template_misses > 0 ?
      this.metrics.template_hits / (this.metrics.template_hits + this.metrics.template_misses) : 0;

    // Calculate sizes
    let memorySize = 0;
    let diskSize = 0;
    
    for (const entry of this.memoryCache.values()) {
      memorySize += entry.metadata.size || 0;
    }
    
    for (const info of this.diskCache.values()) {
      diskSize += info.size || 0;
    }

    return {
      // Operational metrics
      uptime,
      hit_rate: Number(hitRate.toFixed(4)),
      template_hit_rate: Number(templateHitRate.toFixed(4)),
      
      // Cache metrics
      entries: {
        memory: this.memoryCache.size,
        disk: this.diskCache.size,
        template: this.templateCache.size,
        total: this.memoryCache.size + this.diskCache.size + this.templateCache.size
      },
      
      // Size metrics
      size: {
        memory_bytes: memorySize,
        disk_bytes: diskSize,
        memory_formatted: this._formatBytes(memorySize),
        disk_formatted: this._formatBytes(diskSize),
        total_formatted: this._formatBytes(memorySize + diskSize)
      },
      
      // Performance metrics
      operations: {
        ...this.metrics,
        bytes_per_write: this.metrics.writes > 0 ? Math.round(this.metrics.bytes_written / this.metrics.writes) : 0,
        bytes_per_read: this.metrics.hits > 0 ? Math.round(this.metrics.bytes_read / this.metrics.hits) : 0
      },
      
      // Health indicators
      health: {
        integrity_failure_rate: this.metrics.integrity_failures / (this.metrics.hits + this.metrics.misses) || 0,
        memory_pressure: memorySize / this._parseSize(this.config.maxCacheSize),
        gc_frequency: this.metrics.gc_runs / (uptime / 3600000) // GC runs per hour
      }
    };
  }

  // Private helper methods

  _selectOptimalLayer(size, context) {
    if (context.isTemplate || context.template) return 'template';
    if (size > 1024 * 1024) return 'disk'; // > 1MB goes to disk
    return 'memory';
  }

  async _storeTemplate(key, entry, context) {
    const templateKey = this._generateTemplateKey(context.templatePath || key, context);
    
    const templateEntry = {
      content: entry.content,
      path: context.templatePath,
      timestamp: Date.now(),
      size: entry.metadata.size,
      context_hash: this._hashContext(context),
      accessed: 1
    };

    this.templateCache.set(templateKey, templateEntry);
    this._evictTemplatesIfNecessary();
  }

  async _retrieveTemplate(key) {
    const entry = this.templateCache.get(key);
    if (entry) {
      entry.accessed++;
      return {
        content: entry.content,
        metadata: {
          size: entry.size,
          accessed_at: Date.now(),
          access_count: entry.accessed
        }
      };
    }
    return null;
  }

  _generateTemplateKey(templatePath, context = {}) {
    const contextHash = crypto
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return `${templatePath}:${contextHash}`;
  }

  _isValidTemplateCache(cached, templatePath) {
    const now = Date.now();
    const expired = (now - cached.timestamp) > this.config.templateCacheOptions.ttl;
    
    if (expired) return false;

    try {
      const stat = require('fs').statSync(templatePath);
      return stat.mtime.getTime() <= cached.timestamp;
    } catch (error) {
      return false;
    }
  }

  async _loadTemplateFromDisk(templatePath) {
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  _evictTemplatesIfNecessary() {
    if (this.templateCache.size <= this.config.templateCacheOptions.maxSize) {
      return;
    }

    const entries = Array.from(this.templateCache.entries());
    entries.sort((a, b) => a[1].accessed - b[1].accessed); // Least recently used
    
    const toRemove = entries.slice(0, entries.length - this.config.templateCacheOptions.maxSize);
    toRemove.forEach(([key]) => this.templateCache.delete(key));
  }

  _hashContext(context) {
    return crypto.createHash('md5').update(JSON.stringify(context)).digest('hex');
  }

  // Garbage collection strategies

  async _autoGC() {
    const stats = this.getStatistics();
    let evicted = { memory: 0, disk: 0, templates: 0, bytes: 0 };

    // Memory pressure?
    if (stats.health.memory_pressure > 0.8) {
      const memEvicted = await this._memoryGC();
      evicted.memory += memEvicted.count;
      evicted.bytes += memEvicted.bytes;
    }

    // Too many entries?
    if (stats.entries.total > this.config.maxEntries) {
      const diskEvicted = await this._diskGC();
      evicted.disk += diskEvicted.count;
      evicted.bytes += diskEvicted.bytes;
    }

    // Clean up expired
    const expiredEvicted = await this._expiredGC();
    evicted.memory += expiredEvicted.memory;
    evicted.disk += expiredEvicted.disk;
    evicted.templates += expiredEvicted.templates;
    evicted.bytes += expiredEvicted.bytes;

    return evicted;
  }

  async _aggressiveGC() {
    let evicted = { memory: 0, disk: 0, templates: 0, bytes: 0 };

    // Clear 50% of each cache layer
    const memoryEntries = Array.from(this.memoryCache.entries());
    const toEvictMemory = memoryEntries
      .sort((a, b) => a[1].metadata.accessed_at - b[1].metadata.accessed_at)
      .slice(0, Math.floor(memoryEntries.length / 2));
    
    for (const [key, entry] of toEvictMemory) {
      this.memoryCache.delete(key);
      evicted.memory++;
      evicted.bytes += entry.metadata.size;
    }

    // Similar for disk and templates
    const diskEntries = Array.from(this.diskCache.entries());
    const toEvictDisk = diskEntries.slice(0, Math.floor(diskEntries.length / 2));
    
    for (const [key, info] of toEvictDisk) {
      await this._removeCacheEntry(key);
      evicted.disk++;
      evicted.bytes += info.size;
    }

    const templateEntries = Array.from(this.templateCache.entries());
    const toEvictTemplates = templateEntries.slice(0, Math.floor(templateEntries.length / 2));
    
    for (const [key, entry] of toEvictTemplates) {
      this.templateCache.delete(key);
      evicted.templates++;
      evicted.bytes += entry.size;
    }

    return evicted;
  }

  async _memoryGC() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].metadata.accessed_at - b[1].metadata.accessed_at);
    
    const targetSize = Math.floor(entries.length * 0.7); // Remove 30%
    const toEvict = entries.slice(0, entries.length - targetSize);
    
    let evicted = { count: 0, bytes: 0 };
    for (const [key, entry] of toEvict) {
      this.memoryCache.delete(key);
      evicted.count++;
      evicted.bytes += entry.metadata.size;
    }
    
    return evicted;
  }

  async _diskGC() {
    const entries = Array.from(this.diskCache.entries());
    entries.sort((a, b) => a[1].accessed_at - b[1].accessed_at);
    
    const targetSize = Math.floor(entries.length * 0.8); // Remove 20%
    const toEvict = entries.slice(0, entries.length - targetSize);
    
    let evicted = { count: 0, bytes: 0 };
    for (const [key, info] of toEvict) {
      await this._removeCacheEntry(key);
      evicted.count++;
      evicted.bytes += info.size;
    }
    
    return evicted;
  }

  async _templateGC() {
    const entries = Array.from(this.templateCache.entries());
    entries.sort((a, b) => a[1].accessed - b[1].accessed);
    
    const targetSize = Math.floor(entries.length * 0.6); // Remove 40%
    const toEvict = entries.slice(0, entries.length - targetSize);
    
    let evicted = { count: 0, bytes: 0 };
    for (const [key, entry] of toEvict) {
      this.templateCache.delete(key);
      evicted.count++;
      evicted.bytes += entry.size;
    }
    
    return evicted;
  }

  async _expiredGC() {
    const now = Date.now();
    let evicted = { memory: 0, disk: 0, templates: 0, bytes: 0 };

    // Memory cache
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.metadata.created_at > this.config.defaultTTL) {
        this.memoryCache.delete(key);
        evicted.memory++;
        evicted.bytes += entry.metadata.size;
      }
    }

    // Disk cache
    for (const [key, info] of this.diskCache) {
      if (now - info.created_at > this.config.defaultTTL) {
        await this._removeCacheEntry(key);
        evicted.disk++;
        evicted.bytes += info.size;
      }
    }

    // Template cache
    for (const [key, entry] of this.templateCache) {
      if (now - entry.timestamp > this.config.templateCacheOptions.ttl) {
        this.templateCache.delete(key);
        evicted.templates++;
        evicted.bytes += entry.size;
      }
    }

    return evicted;
  }

  // Inherited and enhanced methods from original implementation
  
  async _createCacheStructure() {
    const dirs = [
      this.config.cacheDir,
      path.join(this.config.cacheDir, 'content'),
      path.join(this.config.cacheDir, 'index'),
      path.join(this.config.cacheDir, 'metadata'),
      path.join(this.config.cacheDir, 'templates')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _loadCacheIndex() {
    try {
      const indexPath = path.join(this.config.cacheDir, 'index', 'cache-index.json');
      const indexData = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(indexData);
      
      for (const [key, metadata] of Object.entries(index)) {
        this.diskCache.set(key, metadata);
      }

      this.logger.debug(`Loaded cache index with ${this.diskCache.size} entries`);

    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load cache index:', error);
      }
    }
  }

  async _loadTemplateCache() {
    try {
      const templateIndexPath = path.join(this.config.cacheDir, 'templates', 'template-index.json');
      const indexData = await fs.readFile(templateIndexPath, 'utf8');
      const templateIndex = JSON.parse(indexData);
      
      for (const [key, metadata] of Object.entries(templateIndex)) {
        this.templateCache.set(key, metadata);
      }

      this.logger.debug(`Loaded template cache with ${this.templateCache.size} entries`);

    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load template cache:', error);
      }
    }
  }

  _queueDiskWrite(contentKey, entry) {
    if (this.config.batchWrites) {
      this.writeBatch.set(contentKey, entry);
    } else {
      this.writeQueue.push({ key: contentKey, entry });
    }
  }

  _startBatchWriter() {
    if (!this.config.writeBehind) return;

    setInterval(async () => {
      if (this.writeBatch.size > 0) {
        const batch = new Map(this.writeBatch);
        this.writeBatch.clear();
        
        for (const [key, entry] of batch) {
          try {
            await this._storeToDisk(key, entry);
          } catch (error) {
            this.logger.error(`Batch write failed for key ${key}:`, error);
          }
        }
      }

      // Process write queue
      if (this.writeQueue.length > 0) {
        const writes = this.writeQueue.splice(0, 10); // Process 10 at a time
        
        for (const { key, entry } of writes) {
          try {
            await this._storeToDisk(key, entry);
          } catch (error) {
            this.logger.error(`Queue write failed for key ${key}:`, error);
          }
        }
      }
    }, 1000); // Write every second
  }

  _startMaintenanceLoop() {
    this.cleanupTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        try {
          await this.garbageCollect('auto');
        } catch (error) {
          this.logger.error('Scheduled garbage collection failed:', error);
        }
      }
    }, this.config.cleanupInterval);
  }

  // Enhanced utility methods

  _normalizeContent(content) {
    if (typeof content === 'string') {
      return content.trim();
    }
    
    if (content instanceof Store) {
      const quads = content.getQuads().sort((a, b) => {
        return a.subject.value.localeCompare(b.subject.value) ||
               a.predicate.value.localeCompare(b.predicate.value) ||
               a.object.value.localeCompare(b.object.value);
      });
      return JSON.stringify(quads.map(q => ({
        subject: q.subject.value,
        predicate: q.predicate.value,
        object: q.object.value,
        graph: q.graph.value
      })));
    }

    if (Array.isArray(content)) {
      return content.sort().map(item => this._normalizeContent(item));
    }

    if (typeof content === 'object' && content !== null) {
      const normalized = {};
      for (const key of Object.keys(content).sort()) {
        normalized[key] = this._normalizeContent(content[key]);
      }
      return normalized;
    }

    return content;
  }

  _normalizeContext(context) {
    const relevantKeys = [
      'template', 'templatePath', 'variables', 'filters', 'ontology',
      'validation_rules', 'output_format', 'generation_mode', 'isTemplate'
    ];

    const normalized = {};
    for (const key of relevantKeys) {
      if (context[key] !== undefined) {
        normalized[key] = this._normalizeContent(context[key]);
      }
    }

    return normalized;
  }

  _generateIntegrityHash(content) {
    const normalized = this._normalizeContent(content);
    const contentStr = typeof normalized === 'string' ? normalized : JSON.stringify(normalized);
    
    return crypto
      .createHash('sha256')
      .update(contentStr)
      .digest('hex');
  }

  _verifyIntegrity(entry) {
    try {
      const computedHash = this._generateIntegrityHash(entry.content);
      return computedHash === entry.integrity_hash;
    } catch (error) {
      this.logger.error('Integrity verification error:', error);
      return false;
    }
  }

  _detectContentType(content) {
    if (typeof content === 'string') {
      if (content.includes('@prefix') || content.includes('<http')) {
        return 'turtle';
      }
      if (content.startsWith('{') || content.startsWith('[')) {
        return 'json';
      }
      if (content.includes('<%') || content.includes('{{')) {
        return 'template';
      }
      return 'text';
    }
    
    if (content instanceof Store) {
      return 'rdf-store';
    }
    
    if (Array.isArray(content)) {
      return 'array';
    }
    
    return 'object';
  }

  _calculateSize(content) {
    return Buffer.byteLength(JSON.stringify(content), 'utf8');
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  _parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3 };
    const match = sizeStr.match(/^(\d+)\s*([A-Z]+)$/);
    
    if (!match) return 1024**3; // Default 1GB
    
    const [, number, unit] = match;
    return parseInt(number) * (units[unit] || 1);
  }

  // Async cleanup on shutdown
  async shutdown() {
    this.logger.info('Shutting down content-addressed cache...');
    this.isShuttingDown = true;

    // Clear maintenance timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Flush pending writes
    if (this.writeBatch.size > 0 || this.writeQueue.length > 0) {
      this.logger.info('Flushing pending writes...');
      
      // Process batch writes
      for (const [key, entry] of this.writeBatch) {
        try {
          await this._storeToDisk(key, entry);
        } catch (error) {
          this.logger.error(`Final batch write failed for key ${key}:`, error);
        }
      }
      
      // Process queue writes
      for (const { key, entry } of this.writeQueue) {
        try {
          await this._storeToDisk(key, entry);
        } catch (error) {
          this.logger.error(`Final queue write failed for key ${key}:`, error);
        }
      }
    }

    // Save indexes
    await this._saveCacheIndex();
    await this._saveTemplateIndex();

    this.logger.success('Content-addressed cache shutdown completed');
  }

  async _saveCacheIndex() {
    try {
      const indexPath = path.join(this.config.cacheDir, 'index', 'cache-index.json');
      const index = Object.fromEntries(this.diskCache);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      this.logger.error('Failed to save cache index:', error);
    }
  }

  async _saveTemplateIndex() {
    try {
      const templateIndexPath = path.join(this.config.cacheDir, 'templates', 'template-index.json');
      const templateIndex = Object.fromEntries(this.templateCache);
      await fs.writeFile(templateIndexPath, JSON.stringify(templateIndex, null, 2));
    } catch (error) {
      this.logger.error('Failed to save template index:', error);
    }
  }

  // Additional disk and memory operations from original
  async _storeToDisk(contentKey, entry) {
    try {
      const contentPath = path.join(this.config.cacheDir, 'content', `${contentKey}.json`);
      
      let data = JSON.stringify(entry, null, 0);
      
      if (this.config.enableCompression && data.length > 1024) {
        const zlib = await import('zlib');
        data = await new Promise((resolve, reject) => {
          zlib.gzip(Buffer.from(data), { level: this.config.compressionLevel }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      await fs.writeFile(contentPath, data);
      
      this.diskCache.set(contentKey, {
        path: contentPath,
        size: data.length,
        created_at: entry.metadata.created_at,
        accessed_at: entry.metadata.accessed_at,
        compressed: this.config.enableCompression && data.length > 1024
      });

    } catch (error) {
      this.logger.error(`Failed to store to disk: ${contentKey}`, error);
    }
  }

  async _retrieveFromDisk(contentKey) {
    try {
      const diskInfo = this.diskCache.get(contentKey);
      if (!diskInfo) return null;

      let data = await fs.readFile(diskInfo.path);

      if (diskInfo.compressed) {
        const zlib = await import('zlib');
        data = await new Promise((resolve, reject) => {
          zlib.gunzip(data, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      const entry = JSON.parse(data.toString());
      return entry;

    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to retrieve from disk: ${contentKey}`, error);
      }
      return null;
    }
  }

  async _removeCacheEntry(contentKey) {
    try {
      this.memoryCache.delete(contentKey);
      
      const diskInfo = this.diskCache.get(contentKey);
      if (diskInfo) {
        await fs.unlink(diskInfo.path);
        this.diskCache.delete(contentKey);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to remove cache entry: ${contentKey}`, error);
      }
    }
  }

  // Filter and utility methods for listing/purging
  _matchesFilter(entry, { contentType, since }) {
    if (contentType && entry.content_type !== contentType) return false;
    if (since && entry.created_at < since) return false;
    return true;
  }

  _getEntryInfo(entry) {
    return {
      content_type: entry.metadata.content_type,
      size: entry.metadata.size,
      created_at: entry.metadata.created_at,
      accessed_at: entry.metadata.accessed_at,
      access_count: entry.metadata.access_count
    };
  }

  _getDiskEntryInfo(info) {
    return {
      size: info.size,
      created_at: info.created_at,
      accessed_at: info.accessed_at,
      compressed: info.compressed || false
    };
  }

  async _purgeMemory(criteria) {
    let purged = { count: 0, bytes: 0 };
    
    for (const [key, entry] of this.memoryCache) {
      if (this._shouldPurgeEntry(entry.metadata, criteria)) {
        this.memoryCache.delete(key);
        purged.count++;
        purged.bytes += entry.metadata.size;
      }
    }
    
    return purged;
  }

  async _purgeDisk(criteria) {
    let purged = { count: 0, bytes: 0 };
    
    for (const [key, info] of this.diskCache) {
      if (this._shouldPurgeEntry(info, criteria)) {
        await this._removeCacheEntry(key);
        purged.count++;
        purged.bytes += info.size;
      }
    }
    
    return purged;
  }

  async _purgeTemplates(criteria) {
    let purged = { count: 0, bytes: 0 };
    
    for (const [key, entry] of this.templateCache) {
      if (this._shouldPurgeTemplateEntry(entry, criteria)) {
        this.templateCache.delete(key);
        purged.count++;
        purged.bytes += entry.size;
      }
    }
    
    return purged;
  }

  _shouldPurgeEntry(entryInfo, criteria) {
    const { olderThan, contentType, pattern, unused } = criteria;
    
    if (olderThan && entryInfo.created_at > Date.now() - olderThan) return false;
    if (contentType && entryInfo.content_type !== contentType) return false;
    if (unused && entryInfo.access_count > 1) return false;
    if (pattern) {
      const regex = new RegExp(pattern);
      return regex.test(entryInfo.path || '');
    }
    
    return true;
  }

  _shouldPurgeTemplateEntry(entry, criteria) {
    const { olderThan, pattern, unused } = criteria;
    
    if (olderThan && entry.timestamp > Date.now() - olderThan) return false;
    if (unused && entry.accessed > 1) return false;
    if (pattern) {
      const regex = new RegExp(pattern);
      return regex.test(entry.path || '');
    }
    
    return true;
  }
}

export default ContentAddressedCache;