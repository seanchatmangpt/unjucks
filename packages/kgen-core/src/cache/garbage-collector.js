/**
 * Garbage Collector for KGEN Cache System
 * 
 * Advanced garbage collection with multiple strategies for efficient
 * cache management and disk space optimization.
 */

import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import { EventEmitter } from 'events';

/**
 * Garbage collection strategies
 */
export const GCStrategy = {
  AUTO: 'auto',                    // Automatic strategy selection
  AGGRESSIVE: 'aggressive',        // Remove 50% of entries
  MEMORY_PRESSURE: 'memory',       // Focus on memory cache
  DISK_PRESSURE: 'disk',          // Focus on disk cache
  TEMPLATE_CLEANUP: 'templates',   // Focus on template cache
  EXPIRED_ONLY: 'expired',        // Remove only expired entries
  LRU: 'lru',                     // Least recently used
  SIZE_BASED: 'size',             // Remove largest entries first
  ACCESS_BASED: 'access'          // Remove least accessed entries
};

/**
 * Collection priorities for different content types
 */
export const CollectionPriority = {
  CRITICAL: 1,    // Remove immediately
  HIGH: 2,        // Remove in next collection
  MEDIUM: 3,      // Remove when memory pressure
  LOW: 4,         // Remove when disk pressure  
  PRESERVE: 5     // Never remove automatically
};

/**
 * Advanced Garbage Collector for Cache Management
 */
export class GarbageCollector extends EventEmitter {
  constructor(cache, config = {}) {
    super();
    
    this.cache = cache;
    this.config = {
      // Collection intervals
      autoCollectionInterval: config.autoCollectionInterval || 300000, // 5 minutes
      aggressiveThreshold: config.aggressiveThreshold || 0.90,         // 90% full
      memoryThreshold: config.memoryThreshold || 0.85,                 // 85% memory usage
      diskThreshold: config.diskThreshold || 0.80,                     // 80% disk usage
      
      // Collection targets
      memoryTargetReduction: config.memoryTargetReduction || 0.30,     // Remove 30%
      diskTargetReduction: config.diskTargetReduction || 0.25,         // Remove 25%
      templateTargetReduction: config.templateTargetReduction || 0.40, // Remove 40%
      
      // Collection rules
      minEntriesToKeep: config.minEntriesToKeep || 100,
      maxCollectionTime: config.maxCollectionTime || 30000,            // 30 seconds max
      enableParallelCollection: config.enableParallelCollection || true,
      
      // Content type priorities
      contentTypePriorities: {
        'template': CollectionPriority.LOW,
        'rdf-store': CollectionPriority.MEDIUM,
        'json': CollectionPriority.MEDIUM,
        'turtle': CollectionPriority.MEDIUM,
        'text': CollectionPriority.HIGH,
        'array': CollectionPriority.HIGH,
        'object': CollectionPriority.HIGH
      },
      
      // Age-based collection rules
      agingRules: {
        immediate: 60000,      // 1 minute - collect immediately
        short: 300000,         // 5 minutes - collect when pressure
        medium: 1800000,       // 30 minutes - collect in regular cleanup
        long: 7200000,         // 2 hours - collect in major cleanup
        permanent: 86400000    // 24 hours - only collect when critical
      },
      
      ...config
    };

    this.logger = consola.withTag('gc');
    
    // Collection state
    this.isCollecting = false;
    this.collectionTimer = null;
    this.collectionHistory = [];
    this.lastCollection = null;
    
    // Collection statistics
    this.stats = {
      total_collections: 0,
      total_items_collected: 0,
      total_bytes_freed: 0,
      average_collection_time: 0,
      memory_collections: 0,
      disk_collections: 0,
      template_collections: 0,
      aggressive_collections: 0,
      start_time: this.getDeterministicTimestamp()
    };

    // Collection candidates tracking
    this.candidates = {
      memory: new Set(),
      disk: new Set(),
      templates: new Set()
    };

    this.enableAutoCollection = config.enableAutoCollection !== false;
  }

  /**
   * Initialize garbage collector
   */
  async initialize() {
    try {
      this.logger.info('Initializing garbage collector...');

      // Load collection history if available
      await this._loadCollectionHistory();

      // Start automatic collection if enabled
      if (this.enableAutoCollection) {
        this.startAutoCollection();
      }

      this.logger.success('Garbage collector initialized');
      return { status: 'success' };

    } catch (error) {
      this.logger.error('Failed to initialize garbage collector:', error);
      throw error;
    }
  }

  /**
   * Start automatic garbage collection
   */
  startAutoCollection() {
    if (this.collectionTimer) {
      this.logger.warn('Auto collection already running');
      return;
    }

    this.collectionTimer = setInterval(async () => {
      try {
        await this.collect(GCStrategy.AUTO);
      } catch (error) {
        this.logger.error('Auto collection failed:', error);
      }
    }, this.config.autoCollectionInterval);

    this.logger.info('Started automatic garbage collection', {
      interval: this.config.autoCollectionInterval
    });

    this.emit('auto-collection-started');
  }

  /**
   * Stop automatic garbage collection
   */
  stopAutoCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
      
      this.logger.info('Stopped automatic garbage collection');
      this.emit('auto-collection-stopped');
    }
  }

  /**
   * Main garbage collection method
   */
  async collect(strategy = GCStrategy.AUTO, options = {}) {
    if (this.isCollecting) {
      this.logger.warn('Collection already in progress');
      return null;
    }

    const startTime = this.getDeterministicTimestamp();
    this.isCollecting = true;

    try {
      this.logger.info(`Starting garbage collection (${strategy})...`);
      
      // Determine collection strategy
      const resolvedStrategy = await this._resolveStrategy(strategy);
      
      // Analyze current cache state
      const cacheState = await this._analyzeCacheState();
      
      // Execute collection based on strategy
      const collectionResult = await this._executeCollection(resolvedStrategy, cacheState, options);
      
      // Update statistics
      const duration = this.getDeterministicTimestamp() - startTime;
      this._updateStatistics(resolvedStrategy, collectionResult, duration);
      
      // Record collection history
      const historyEntry = {
        timestamp: startTime,
        strategy: resolvedStrategy,
        duration,
        result: collectionResult,
        cache_state_before: cacheState,
        cache_state_after: await this._analyzeCacheState()
      };
      
      this.collectionHistory.push(historyEntry);
      this._trimCollectionHistory();
      
      this.lastCollection = historyEntry;
      
      this.logger.success(`Garbage collection completed in ${duration}ms`, {
        strategy: resolvedStrategy,
        collected: collectionResult.total_collected,
        freed: this._formatBytes(collectionResult.bytes_freed)
      });
      
      this.emit('collection-completed', historyEntry);
      
      return collectionResult;

    } catch (error) {
      this.logger.error('Garbage collection failed:', error);
      this.emit('collection-failed', { strategy, error: error.message });
      throw error;
      
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Analyze cache pressure and recommend collection strategy
   */
  async analyzePressure() {
    const cacheState = await this._analyzeCacheState();
    const analysis = {
      timestamp: this.getDeterministicTimestamp(),
      cache_state: cacheState,
      pressure: {},
      recommendations: []
    };

    // Memory pressure analysis
    const memoryPressure = cacheState.memory.usage_ratio;
    analysis.pressure.memory = {
      level: memoryPressure,
      severity: this._categorizePressure(memoryPressure, this.config.memoryThreshold)
    };

    if (memoryPressure > this.config.memoryThreshold) {
      analysis.recommendations.push({
        strategy: GCStrategy.MEMORY_PRESSURE,
        priority: 'high',
        reason: `Memory usage at ${(memoryPressure * 100).toFixed(1)}%`
      });
    }

    // Disk pressure analysis
    const diskPressure = cacheState.disk.usage_ratio;
    analysis.pressure.disk = {
      level: diskPressure,
      severity: this._categorizePressure(diskPressure, this.config.diskThreshold)
    };

    if (diskPressure > this.config.diskThreshold) {
      analysis.recommendations.push({
        strategy: GCStrategy.DISK_PRESSURE,
        priority: 'high',
        reason: `Disk usage at ${(diskPressure * 100).toFixed(1)}%`
      });
    }

    // Template cache analysis
    const templatePressure = cacheState.templates.count / this.cache.config.templateCacheOptions.maxSize;
    analysis.pressure.templates = {
      level: templatePressure,
      severity: this._categorizePressure(templatePressure, 0.90)
    };

    if (templatePressure > 0.90) {
      analysis.recommendations.push({
        strategy: GCStrategy.TEMPLATE_CLEANUP,
        priority: 'medium',
        reason: `Template cache at ${(templatePressure * 100).toFixed(1)}%`
      });
    }

    // Overall system pressure
    const overallPressure = Math.max(memoryPressure, diskPressure);
    analysis.pressure.overall = {
      level: overallPressure,
      severity: this._categorizePressure(overallPressure, this.config.aggressiveThreshold)
    };

    if (overallPressure > this.config.aggressiveThreshold) {
      analysis.recommendations.unshift({
        strategy: GCStrategy.AGGRESSIVE,
        priority: 'critical',
        reason: `Critical system pressure at ${(overallPressure * 100).toFixed(1)}%`
      });
    }

    // Age-based recommendations
    const expiredCount = await this._countExpiredEntries();
    if (expiredCount > 0) {
      analysis.recommendations.push({
        strategy: GCStrategy.EXPIRED_ONLY,
        priority: 'low',
        reason: `${expiredCount} expired entries found`
      });
    }

    return analysis;
  }

  /**
   * Get garbage collection statistics
   */
  getStatistics() {
    const uptime = this.getDeterministicTimestamp() - this.stats.start_time;
    
    return {
      ...this.stats,
      uptime,
      uptime_formatted: this._formatDuration(uptime),
      collection_frequency: this.stats.total_collections / (uptime / 1000 / 3600), // per hour
      bytes_freed_formatted: this._formatBytes(this.stats.total_bytes_freed),
      last_collection: this.lastCollection ? {
        ...this.lastCollection,
        time_ago: this.getDeterministicTimestamp() - this.lastCollection.timestamp,
        time_ago_formatted: this._formatDuration(this.getDeterministicTimestamp() - this.lastCollection.timestamp)
      } : null,
      cache_efficiency: this._calculateCacheEfficiency()
    };
  }

  /**
   * List collection candidates without actually collecting
   */
  async listCandidates(strategy = GCStrategy.AUTO, options = {}) {
    const resolvedStrategy = await this._resolveStrategy(strategy);
    const cacheState = await this._analyzeCacheState();
    
    return await this._identifyCollectionCandidates(resolvedStrategy, cacheState, {
      ...options,
      dryRun: true
    });
  }

  /**
   * Force collection of specific entries
   */
  async collectSpecific(keys = [], options = {}) {
    if (this.isCollecting) {
      throw new Error('Collection already in progress');
    }

    const startTime = this.getDeterministicTimestamp();
    this.isCollecting = true;

    try {
      let collectedCount = 0;
      let bytesFreed = 0;

      for (const key of keys) {
        try {
          const entry = await this._getEntryInfo(key);
          if (entry) {
            bytesFreed += entry.size || 0;
            await this.cache.remove(key);
            collectedCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to collect specific entry ${key}:`, error);
        }
      }

      const result = {
        strategy: 'specific',
        total_collected: collectedCount,
        bytes_freed: bytesFreed,
        duration: this.getDeterministicTimestamp() - startTime,
        keys_requested: keys.length,
        keys_collected: collectedCount
      };

      this.logger.info(`Collected ${collectedCount}/${keys.length} specific entries`, {
        freed: this._formatBytes(bytesFreed)
      });

      this.emit('specific-collection-completed', result);
      return result;

    } finally {
      this.isCollecting = false;
    }
  }

  // Private implementation methods

  async _resolveStrategy(strategy) {
    if (strategy !== GCStrategy.AUTO) {
      return strategy;
    }

    const analysis = await this.analyzePressure();
    
    if (analysis.recommendations.length === 0) {
      return GCStrategy.EXPIRED_ONLY;
    }

    // Return highest priority recommendation
    const sorted = analysis.recommendations.sort((a, b) => {
      const priorities = { critical: 1, high: 2, medium: 3, low: 4 };
      return priorities[a.priority] - priorities[b.priority];
    });

    return sorted[0].strategy;
  }

  async _analyzeCacheState() {
    const stats = this.cache.getStatistics();
    
    return {
      timestamp: this.getDeterministicTimestamp(),
      memory: {
        entries: stats.entries.memory,
        bytes: stats.size.memory_bytes,
        usage_ratio: stats.size.memory_bytes / this.cache._parseSize(this.cache.config.maxCacheSize)
      },
      disk: {
        entries: stats.entries.disk,
        bytes: stats.size.disk_bytes,
        usage_ratio: stats.entries.disk / this.cache.config.maxEntries
      },
      templates: {
        count: stats.entries.template,
        usage_ratio: stats.entries.template / this.cache.config.templateCacheOptions.maxSize
      },
      total: {
        entries: stats.entries.total,
        bytes: stats.size.memory_bytes + stats.size.disk_bytes,
        hit_rate: stats.hit_rate,
        template_hit_rate: stats.template_hit_rate
      }
    };
  }

  async _executeCollection(strategy, cacheState, options) {
    const candidates = await this._identifyCollectionCandidates(strategy, cacheState, options);
    
    let collectedCount = 0;
    let bytesFreed = 0;
    const collectionResults = {
      memory: 0,
      disk: 0,
      templates: 0
    };

    // Execute collection based on strategy
    switch (strategy) {
      case GCStrategy.AGGRESSIVE:
        ({ collectedCount, bytesFreed } = await this._executeAggressiveCollection(candidates));
        break;
        
      case GCStrategy.MEMORY_PRESSURE:
        ({ collectedCount, bytesFreed } = await this._executeMemoryCollection(candidates));
        collectionResults.memory = collectedCount;
        break;
        
      case GCStrategy.DISK_PRESSURE:
        ({ collectedCount, bytesFreed } = await this._executeDiskCollection(candidates));
        collectionResults.disk = collectedCount;
        break;
        
      case GCStrategy.TEMPLATE_CLEANUP:
        ({ collectedCount, bytesFreed } = await this._executeTemplateCollection(candidates));
        collectionResults.templates = collectedCount;
        break;
        
      case GCStrategy.EXPIRED_ONLY:
        ({ collectedCount, bytesFreed } = await this._executeExpiredCollection(candidates));
        break;
        
      case GCStrategy.LRU:
        ({ collectedCount, bytesFreed } = await this._executeLRUCollection(candidates));
        break;
        
      case GCStrategy.SIZE_BASED:
        ({ collectedCount, bytesFreed } = await this._executeSizeBasedCollection(candidates));
        break;
        
      case GCStrategy.ACCESS_BASED:
        ({ collectedCount, bytesFreed } = await this._executeAccessBasedCollection(candidates));
        break;
        
      default:
        throw new Error(`Unknown collection strategy: ${strategy}`);
    }

    return {
      strategy,
      total_collected: collectedCount,
      bytes_freed: bytesFreed,
      collection_breakdown: collectionResults,
      candidates_identified: candidates.total,
      collection_efficiency: collectedCount / candidates.total || 0
    };
  }

  async _identifyCollectionCandidates(strategy, cacheState, options = {}) {
    const candidates = {
      memory: [],
      disk: [],
      templates: [],
      total: 0
    };

    const now = this.getDeterministicTimestamp();

    // Memory cache candidates
    for (const [key, entry] of this.cache.memoryCache) {
      const candidate = {
        key,
        layer: 'memory',
        size: entry.metadata.size,
        age: now - entry.metadata.created_at,
        last_accessed: now - entry.metadata.accessed_at,
        access_count: entry.metadata.access_count,
        content_type: entry.metadata.content_type,
        priority: this._calculateCollectionPriority(entry, strategy)
      };

      if (this._shouldIncludeCandidate(candidate, strategy, options)) {
        candidates.memory.push(candidate);
      }
    }

    // Disk cache candidates
    for (const [key, info] of this.cache.diskCache) {
      const candidate = {
        key,
        layer: 'disk',
        size: info.size,
        age: now - info.created_at,
        last_accessed: now - info.accessed_at,
        priority: this._calculateDiskPriority(info, strategy)
      };

      if (this._shouldIncludeCandidate(candidate, strategy, options)) {
        candidates.disk.push(candidate);
      }
    }

    // Template candidates
    for (const [key, entry] of this.cache.templateCache) {
      const candidate = {
        key,
        layer: 'template',
        size: entry.size,
        age: now - entry.timestamp,
        access_count: entry.accessed,
        path: entry.path,
        priority: this._calculateTemplatePriority(entry, strategy)
      };

      if (this._shouldIncludeCandidate(candidate, strategy, options)) {
        candidates.templates.push(candidate);
      }
    }

    // Sort candidates by priority
    candidates.memory.sort((a, b) => a.priority - b.priority);
    candidates.disk.sort((a, b) => a.priority - b.priority);
    candidates.templates.sort((a, b) => a.priority - b.priority);

    candidates.total = candidates.memory.length + candidates.disk.length + candidates.templates.length;

    return candidates;
  }

  _calculateCollectionPriority(entry, strategy) {
    const age = this.getDeterministicTimestamp() - entry.metadata.created_at;
    const lastAccessed = this.getDeterministicTimestamp() - entry.metadata.accessed_at;
    const contentTypePriority = this.config.contentTypePriorities[entry.metadata.content_type] || CollectionPriority.MEDIUM;
    
    let priority = contentTypePriority;

    // Age-based adjustments
    if (age > this.config.agingRules.permanent) priority -= 2;
    else if (age > this.config.agingRules.long) priority -= 1;
    else if (age < this.config.agingRules.immediate) priority += 2;

    // Access-based adjustments
    if (entry.metadata.access_count === 0) priority -= 1;
    else if (entry.metadata.access_count > 10) priority += 1;
    
    if (lastAccessed > this.config.agingRules.long) priority -= 1;

    // Strategy-specific adjustments
    switch (strategy) {
      case GCStrategy.AGGRESSIVE:
        priority -= 1; // More aggressive collection
        break;
      case GCStrategy.SIZE_BASED:
        priority += entry.metadata.size > 1024 * 1024 ? -2 : 1; // Prefer large entries
        break;
    }

    return Math.max(1, Math.min(5, priority));
  }

  _calculateDiskPriority(info, strategy) {
    const age = this.getDeterministicTimestamp() - info.created_at;
    const lastAccessed = this.getDeterministicTimestamp() - info.accessed_at;
    
    let priority = CollectionPriority.MEDIUM;

    if (age > this.config.agingRules.permanent) priority = CollectionPriority.HIGH;
    if (lastAccessed > this.config.agingRules.long) priority = CollectionPriority.HIGH;

    return priority;
  }

  _calculateTemplatePriority(entry, strategy) {
    const age = this.getDeterministicTimestamp() - entry.timestamp;
    
    let priority = CollectionPriority.LOW; // Templates are generally kept longer
    
    if (age > this.config.agingRules.permanent) priority = CollectionPriority.MEDIUM;
    if (entry.accessed === 1) priority = CollectionPriority.MEDIUM; // Only used once

    return priority;
  }

  _shouldIncludeCandidate(candidate, strategy, options) {
    // Skip if below minimum priority
    if (candidate.priority > CollectionPriority.LOW && strategy !== GCStrategy.AGGRESSIVE) {
      return false;
    }

    // Strategy-specific inclusion rules
    switch (strategy) {
      case GCStrategy.EXPIRED_ONLY:
        return candidate.age > this.cache.config.defaultTTL;
        
      case GCStrategy.MEMORY_PRESSURE:
        return candidate.layer === 'memory';
        
      case GCStrategy.DISK_PRESSURE:
        return candidate.layer === 'disk';
        
      case GCStrategy.TEMPLATE_CLEANUP:
        return candidate.layer === 'template';
        
      default:
        return true;
    }
  }

  // Collection execution methods

  async _executeAggressiveCollection(candidates) {
    const targetReduction = 0.50; // Remove 50%
    let collectedCount = 0;
    let bytesFreed = 0;

    // Collect from all layers
    const memoryTarget = Math.floor(candidates.memory.length * targetReduction);
    const diskTarget = Math.floor(candidates.disk.length * targetReduction);
    const templateTarget = Math.floor(candidates.templates.length * targetReduction);

    // Execute in parallel if enabled
    if (this.config.enableParallelCollection) {
      const results = await Promise.allSettled([
        this._collectFromLayer(candidates.memory.slice(0, memoryTarget)),
        this._collectFromLayer(candidates.disk.slice(0, diskTarget)),
        this._collectFromLayer(candidates.templates.slice(0, templateTarget))
      ]);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          collectedCount += result.value.count;
          bytesFreed += result.value.bytes;
        }
      }
    } else {
      // Sequential collection
      const memoryResult = await this._collectFromLayer(candidates.memory.slice(0, memoryTarget));
      const diskResult = await this._collectFromLayer(candidates.disk.slice(0, diskTarget));
      const templateResult = await this._collectFromLayer(candidates.templates.slice(0, templateTarget));
      
      collectedCount = memoryResult.count + diskResult.count + templateResult.count;
      bytesFreed = memoryResult.bytes + diskResult.bytes + templateResult.bytes;
    }

    return { collectedCount, bytesFreed };
  }

  async _executeMemoryCollection(candidates) {
    const target = Math.floor(candidates.memory.length * this.config.memoryTargetReduction);
    return await this._collectFromLayer(candidates.memory.slice(0, target));
  }

  async _executeDiskCollection(candidates) {
    const target = Math.floor(candidates.disk.length * this.config.diskTargetReduction);
    return await this._collectFromLayer(candidates.disk.slice(0, target));
  }

  async _executeTemplateCollection(candidates) {
    const target = Math.floor(candidates.templates.length * this.config.templateTargetReduction);
    return await this._collectFromLayer(candidates.templates.slice(0, target));
  }

  async _executeExpiredCollection(candidates) {
    const expiredCandidates = [
      ...candidates.memory,
      ...candidates.disk,
      ...candidates.templates
    ].filter(c => c.age > this.cache.config.defaultTTL);

    return await this._collectFromLayer(expiredCandidates);
  }

  async _executeLRUCollection(candidates) {
    const allCandidates = [
      ...candidates.memory,
      ...candidates.disk,
      ...candidates.templates
    ].sort((a, b) => b.last_accessed - a.last_accessed);

    const target = Math.floor(allCandidates.length * 0.25); // Remove 25% LRU
    return await this._collectFromLayer(allCandidates.slice(0, target));
  }

  async _executeSizeBasedCollection(candidates) {
    const allCandidates = [
      ...candidates.memory,
      ...candidates.disk,
      ...candidates.templates
    ].sort((a, b) => b.size - a.size); // Largest first

    const target = Math.floor(allCandidates.length * 0.20); // Remove 20% largest
    return await this._collectFromLayer(allCandidates.slice(0, target));
  }

  async _executeAccessBasedCollection(candidates) {
    const accessCandidates = [
      ...candidates.memory,
      ...candidates.disk,
      ...candidates.templates
    ].filter(c => c.access_count <= 1); // Never or rarely accessed

    return await this._collectFromLayer(accessCandidates);
  }

  async _collectFromLayer(candidateList) {
    let collectedCount = 0;
    let bytesFreed = 0;

    for (const candidate of candidateList) {
      try {
        // Use cache's remove method to ensure proper cleanup
        await this.cache.remove(candidate.key);
        collectedCount++;
        bytesFreed += candidate.size || 0;
      } catch (error) {
        this.logger.warn(`Failed to collect entry ${candidate.key}:`, error);
      }
    }

    return { count: collectedCount, bytes: bytesFreed };
  }

  // Helper methods

  async _countExpiredEntries() {
    const now = this.getDeterministicTimestamp();
    const ttl = this.cache.config.defaultTTL;
    let expiredCount = 0;

    for (const [, entry] of this.cache.memoryCache) {
      if (now - entry.metadata.created_at > ttl) {
        expiredCount++;
      }
    }

    for (const [, info] of this.cache.diskCache) {
      if (now - info.created_at > ttl) {
        expiredCount++;
      }
    }

    return expiredCount;
  }

  async _getEntryInfo(key) {
    // Check all cache layers for entry information
    if (this.cache.memoryCache.has(key)) {
      return this.cache.memoryCache.get(key).metadata;
    }
    
    if (this.cache.diskCache.has(key)) {
      return this.cache.diskCache.get(key);
    }
    
    if (this.cache.templateCache.has(key)) {
      return this.cache.templateCache.get(key);
    }
    
    return null;
  }

  _categorizePressure(level, threshold) {
    if (level < threshold * 0.5) return 'low';
    if (level < threshold * 0.75) return 'medium';
    if (level < threshold) return 'high';
    return 'critical';
  }

  _calculateCacheEfficiency() {
    const stats = this.cache.getStatistics();
    
    const efficiency = {
      hit_rate: stats.hit_rate,
      template_hit_rate: stats.template_hit_rate,
      memory_utilization: stats.health.memory_pressure,
      collection_frequency: this.stats.total_collections / ((this.getDeterministicTimestamp() - this.stats.start_time) / 3600000),
      bytes_per_collection: this.stats.total_bytes_freed / (this.stats.total_collections || 1)
    };

    // Calculate overall efficiency score
    efficiency.overall_score = (
      efficiency.hit_rate * 0.4 +
      efficiency.template_hit_rate * 0.3 +
      Math.min(1, efficiency.memory_utilization) * 0.2 +
      Math.min(1, 1 / (efficiency.collection_frequency || 1)) * 0.1
    );

    return efficiency;
  }

  _updateStatistics(strategy, result, duration) {
    this.stats.total_collections++;
    this.stats.total_items_collected += result.total_collected;
    this.stats.total_bytes_freed += result.bytes_freed;
    this.stats.average_collection_time = (
      (this.stats.average_collection_time * (this.stats.total_collections - 1) + duration) /
      this.stats.total_collections
    );

    // Strategy-specific stats
    switch (strategy) {
      case GCStrategy.AGGRESSIVE:
        this.stats.aggressive_collections++;
        break;
      case GCStrategy.MEMORY_PRESSURE:
        this.stats.memory_collections++;
        break;
      case GCStrategy.DISK_PRESSURE:
        this.stats.disk_collections++;
        break;
      case GCStrategy.TEMPLATE_CLEANUP:
        this.stats.template_collections++;
        break;
    }
  }

  _trimCollectionHistory() {
    const maxHistory = 100;
    if (this.collectionHistory.length > maxHistory) {
      this.collectionHistory = this.collectionHistory.slice(-maxHistory);
    }
  }

  async _loadCollectionHistory() {
    try {
      const historyFile = path.join(this.cache.config.cacheDir, 'gc-history.json');
      const data = await fs.readFile(historyFile, 'utf8');
      this.collectionHistory = JSON.parse(data);
      
      this.logger.debug(`Loaded ${this.collectionHistory.length} collection history entries`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load collection history:', error);
      }
    }
  }

  async _saveCollectionHistory() {
    try {
      const historyFile = path.join(this.cache.config.cacheDir, 'gc-history.json');
      await fs.writeFile(historyFile, JSON.stringify(this.collectionHistory, null, 2));
    } catch (error) {
      this.logger.error('Failed to save collection history:', error);
    }
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Shutdown garbage collector
   */
  async shutdown() {
    this.logger.info('Shutting down garbage collector...');

    // Stop auto collection
    this.stopAutoCollection();

    // Save collection history
    await this._saveCollectionHistory();

    // Clear state
    this.candidates.memory.clear();
    this.candidates.disk.clear();
    this.candidates.templates.clear();
    this.collectionHistory = [];

    this.logger.success('Garbage collector shutdown completed');
  }
}

export default GarbageCollector;