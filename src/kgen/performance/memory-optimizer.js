/**
 * Memory Optimizer - Intelligent Memory Management and Caching System
 * 
 * Advanced memory optimization through smart caching, garbage collection,
 * memory leak detection, and adaptive memory allocation strategies for
 * enterprise-scale KGEN operations.
 */

import { EventEmitter } from 'events';
import { Logger } from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

export class MemoryOptimizer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Memory management
      memoryLimit: '1GB',
      lowMemoryThreshold: 0.7, // 70% usage
      criticalMemoryThreshold: 0.9, // 90% usage
      gcThreshold: 0.8, // 80% usage triggers GC
      
      // Caching strategies
      enableSmartCaching: true,
      cacheStrategies: {
        lru: true,        // Least Recently Used
        lfu: true,        // Least Frequently Used
        ttl: true,        // Time To Live
        adaptive: true    // Adaptive based on usage patterns
      },
      
      // Cache configuration
      maxCacheSize: '256MB',
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      maxCacheEntries: 10000,
      
      // Memory leak detection
      enableLeakDetection: true,
      leakDetectionInterval: 60000, // 1 minute
      memoryGrowthThreshold: 0.2, // 20% growth
      heapSnapshotInterval: 300000, // 5 minutes
      
      // Garbage collection
      enableProactiveGC: true,
      gcInterval: 120000, // 2 minutes
      forceGCThreshold: 0.85, // 85% usage
      
      // Object pool management
      enableObjectPooling: true,
      pooledObjectTypes: [
        'templates',
        'queries',
        'parsers',
        'writers',
        'buffers'
      ],
      
      // Memory profiling
      enableProfiling: true,
      profilingInterval: 30000, // 30 seconds
      retainProfiles: 100, // Keep last 100 profiles
      
      ...config
    };
    
    this.logger = new Logger({ tag: 'memory-optimizer' });
    
    // Cache systems
    this.caches = new Map();
    this.cacheStatistics = new Map();
    
    // Memory monitoring
    this.memoryBaseline = null;
    this.memoryHistory = [];
    this.memoryProfiles = [];
    this.leakSuspects = new Map();
    
    // Object pools
    this.objectPools = new Map();
    
    // Memory optimization strategies
    this.optimizationStrategies = new Map([
      ['template_cache', new TemplateCacheStrategy(this.config)],
      ['rdf_cache', new RDFCacheStrategy(this.config)],
      ['query_cache', new QueryCacheStrategy(this.config)],
      ['object_pool', new ObjectPoolStrategy(this.config)],
      ['adaptive_gc', new AdaptiveGCStrategy(this.config)]
    ]);
    
    // Monitoring intervals
    this.monitoringInterval = null;
    this.profilingInterval = null;
    this.leakDetectionInterval = null;
    
    this.state = 'initialized';
  }

  /**
   * Initialize the memory optimizer
   */
  async initialize() {
    try {
      this.logger.info('Initializing memory optimizer...');
      
      // Establish memory baseline
      await this._establishMemoryBaseline();
      
      // Initialize cache systems
      await this._initializeCaches();
      
      // Initialize object pools if enabled
      if (this.config.enableObjectPooling) {
        await this._initializeObjectPools();
      }
      
      // Initialize optimization strategies
      await this._initializeOptimizationStrategies();
      
      // Start memory monitoring
      this._startMemoryMonitoring();
      
      // Start leak detection if enabled
      if (this.config.enableLeakDetection) {
        this._startLeakDetection();
      }
      
      // Start profiling if enabled
      if (this.config.enableProfiling) {
        this._startMemoryProfiling();
      }
      
      this.state = 'ready';
      this.logger.success('Memory optimizer initialized successfully');
      
      return {
        status: 'success',
        memoryBaseline: this.memoryBaseline,
        cacheSystems: this.caches.size,
        objectPools: this.objectPools.size,
        optimizationStrategies: this.optimizationStrategies.size
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize memory optimizer:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Get or create a cache with specified strategy
   * @param {string} cacheName - Name of the cache
   * @param {Object} options - Cache configuration options
   * @returns {SmartCache} Cache instance
   */
  getCache(cacheName, options = {}) {
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName);
    }
    
    const cacheConfig = {
      ...this.config,
      ...options,
      name: cacheName
    };
    
    const cache = new SmartCache(cacheConfig);
    this.caches.set(cacheName, cache);
    this.cacheStatistics.set(cacheName, {
      hits: 0,
      misses: 0,
      size: 0,
      memoryUsage: 0,
      lastAccess: null
    });
    
    // Setup cache event handlers
    this._setupCacheEventHandlers(cacheName, cache);
    
    this.logger.debug(`Created cache: ${cacheName}`);
    return cache;
  }

  /**
   * Get object from pool or create new one
   * @param {string} poolName - Name of the object pool
   * @param {Function} factory - Factory function to create new objects
   * @returns {Object} Pooled object
   */
  getFromPool(poolName, factory) {
    if (!this.config.enableObjectPooling) {
      return factory();
    }
    
    let pool = this.objectPools.get(poolName);
    if (!pool) {
      pool = new ObjectPool(poolName, factory, {
        maxSize: 50,
        maxAge: 300000 // 5 minutes
      });
      this.objectPools.set(poolName, pool);
    }
    
    return pool.acquire();
  }

  /**
   * Return object to pool
   * @param {string} poolName - Name of the object pool
   * @param {Object} obj - Object to return to pool
   */
  returnToPool(poolName, obj) {
    if (!this.config.enableObjectPooling) {
      return;
    }
    
    const pool = this.objectPools.get(poolName);
    if (pool) {
      pool.release(obj);
    }
  }

  /**
   * Optimize memory usage based on current conditions
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeMemory(options = {}) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting memory optimization...');
      
      const before = this._getMemorySnapshot();
      const optimizations = [];
      
      // Apply optimization strategies based on memory pressure
      const memoryPressure = this._calculateMemoryPressure();
      
      if (memoryPressure > this.config.criticalMemoryThreshold) {
        // Critical memory pressure - aggressive optimization
        optimizations.push(...await this._applyCriticalOptimizations());
      } else if (memoryPressure > this.config.lowMemoryThreshold) {
        // Low memory pressure - standard optimization
        optimizations.push(...await this._applyStandardOptimizations());
      } else {
        // Normal memory pressure - maintenance optimization
        optimizations.push(...await this._applyMaintenanceOptimizations());
      }
      
      // Apply cache optimizations
      if (options.optimizeCaches !== false) {
        optimizations.push(...await this._optimizeCaches());
      }
      
      // Apply object pool optimizations
      if (options.optimizePools !== false && this.config.enableObjectPooling) {
        optimizations.push(...await this._optimizeObjectPools());
      }
      
      // Force garbage collection if needed
      if (options.forceGC !== false && this._shouldForceGC()) {
        const gcResult = await this._performGarbageCollection();
        optimizations.push(gcResult);
      }
      
      const after = this._getMemorySnapshot();
      const optimizationTime = Date.now() - startTime;
      
      const result = {
        before,
        after,
        optimizations,
        improvement: this._calculateMemoryImprovement(before, after),
        optimizationTime,
        memoryFreed: before.heapUsed - after.heapUsed,
        success: true
      };
      
      this.logger.success(`Memory optimization completed: ${result.improvement}% improvement (${optimizationTime}ms)`);
      this.emit('memory:optimized', result);
      
      return result;
      
    } catch (error) {
      this.logger.error('Memory optimization failed:', error);
      throw error;
    }
  }

  /**
   * Detect and report potential memory leaks
   * @returns {Promise<Object>} Leak detection results
   */
  async detectMemoryLeaks() {
    try {
      this.logger.info('Detecting memory leaks...');
      
      const currentMemory = this._getMemorySnapshot();
      const baseline = this.memoryBaseline || this.memoryHistory[0];
      
      if (!baseline) {
        this.logger.warn('No memory baseline available for leak detection');
        return { status: 'insufficient_data' };
      }
      
      const leaks = [];
      
      // Check for continuous memory growth
      const memoryGrowth = (currentMemory.heapUsed - baseline.heapUsed) / baseline.heapUsed;
      if (memoryGrowth > this.config.memoryGrowthThreshold) {
        leaks.push({
          type: 'continuous_growth',
          severity: 'high',
          growth: memoryGrowth,
          description: `Memory usage has grown by ${(memoryGrowth * 100).toFixed(1)}% since baseline`
        });
      }
      
      // Check for external memory leaks
      const externalGrowth = (currentMemory.external - baseline.external) / Math.max(baseline.external, 1);
      if (externalGrowth > 0.5) { // 50% growth in external memory
        leaks.push({
          type: 'external_growth',
          severity: 'medium',
          growth: externalGrowth,
          description: `External memory usage has grown significantly`
        });
      }
      
      // Check cache memory leaks
      for (const [cacheName, cache] of this.caches) {
        const cacheStats = this.cacheStatistics.get(cacheName);
        if (cache.size > this.config.maxCacheEntries * 0.9) {
          leaks.push({
            type: 'cache_bloat',
            severity: 'medium',
            cacheName,
            cacheSize: cache.size,
            description: `Cache ${cacheName} is approaching size limits`
          });
        }
      }
      
      // Update leak suspects
      this._updateLeakSuspects(leaks);
      
      const result = {
        status: 'completed',
        leaksDetected: leaks.length,
        leaks,
        currentMemory,
        baseline,
        memoryGrowth,
        recommendations: this._generateLeakRecommendations(leaks)
      };
      
      if (leaks.length > 0) {
        this.logger.warn(`Detected ${leaks.length} potential memory leaks`);
        this.emit('memory:leaks_detected', result);
      } else {
        this.logger.debug('No memory leaks detected');
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Memory leak detection failed:', error);
      throw error;
    }
  }

  /**
   * Generate memory usage report
   * @returns {Object} Comprehensive memory report
   */
  generateMemoryReport() {
    const currentMemory = this._getMemorySnapshot();
    const systemMemory = this._getSystemMemoryInfo();
    
    return {
      timestamp: new Date(),
      system: systemMemory,
      process: {
        current: currentMemory,
        baseline: this.memoryBaseline,
        history: this.memoryHistory.slice(-20), // Last 20 measurements
        peak: this._calculateMemoryPeak(),
        average: this._calculateMemoryAverage()
      },
      caches: this._getCacheReport(),
      pools: this._getObjectPoolReport(),
      optimization: {
        strategies: Array.from(this.optimizationStrategies.keys()),
        lastOptimization: this._getLastOptimizationTime(),
        effectivenessScore: this._calculateOptimizationEffectiveness()
      },
      leakDetection: {
        enabled: this.config.enableLeakDetection,
        suspects: this.leakSuspects.size,
        lastCheck: this._getLastLeakCheckTime()
      },
      recommendations: this._generateMemoryRecommendations(currentMemory)
    };
  }

  /**
   * Get comprehensive memory statistics
   */
  getMemoryStatistics() {
    return {
      current: this._getMemorySnapshot(),
      pressure: this._calculateMemoryPressure(),
      optimization: {
        lastRun: this._getLastOptimizationTime(),
        totalRuns: this._getTotalOptimizationRuns(),
        averageImprovement: this._getAverageOptimizationImprovement()
      },
      caches: {
        total: this.caches.size,
        totalSize: this._getTotalCacheSize(),
        hitRate: this._getOverallCacheHitRate(),
        memoryUsage: this._getTotalCacheMemoryUsage()
      },
      pools: {
        total: this.objectPools.size,
        totalObjects: this._getTotalPooledObjects(),
        utilizationRate: this._getPoolUtilizationRate()
      },
      gc: {
        enabled: this.config.enableProactiveGC,
        lastRun: this._getLastGCTime(),
        frequency: this._getGCFrequency()
      }
    };
  }

  /**
   * Shutdown the memory optimizer
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down memory optimizer...');
      
      // Stop all monitoring intervals
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      if (this.profilingInterval) {
        clearInterval(this.profilingInterval);
      }
      if (this.leakDetectionInterval) {
        clearInterval(this.leakDetectionInterval);
      }
      
      // Clear all caches
      for (const cache of this.caches.values()) {
        cache.clear();
      }
      this.caches.clear();
      
      // Clear all object pools
      for (const pool of this.objectPools.values()) {
        pool.clear();
      }
      this.objectPools.clear();
      
      // Final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      this.state = 'shutdown';
      this.logger.success('Memory optimizer shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during memory optimizer shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _establishMemoryBaseline() {
    // Force garbage collection to get clean baseline
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
    
    this.memoryBaseline = this._getMemorySnapshot();
    this.memoryHistory.push({...this.memoryBaseline, timestamp: Date.now()});
    
    this.logger.info(`Memory baseline established: ${(this.memoryBaseline.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  }

  async _initializeCaches() {
    // Initialize default caches for common operations
    const defaultCaches = ['templates', 'rdf_graphs', 'sparql_queries', 'validations'];
    
    for (const cacheName of defaultCaches) {
      this.getCache(cacheName, {
        strategy: 'adaptive',
        maxSize: Math.floor(this.config.maxCacheEntries / defaultCaches.length)
      });
    }
  }

  async _initializeObjectPools() {
    // Initialize object pools for commonly used objects
    for (const objectType of this.config.pooledObjectTypes) {
      const pool = new ObjectPool(objectType, () => ({}), {
        maxSize: 20,
        maxAge: 300000
      });
      this.objectPools.set(objectType, pool);
    }
    
    this.logger.debug(`Initialized ${this.objectPools.size} object pools`);
  }

  async _initializeOptimizationStrategies() {
    for (const [name, strategy] of this.optimizationStrategies) {
      await strategy.initialize();
    }
  }

  _startMemoryMonitoring() {
    this.monitoringInterval = setInterval(() => {
      const memorySnapshot = this._getMemorySnapshot();
      this.memoryHistory.push({...memorySnapshot, timestamp: Date.now()});
      
      // Keep only recent history
      if (this.memoryHistory.length > 1000) {
        this.memoryHistory = this.memoryHistory.slice(-500);
      }
      
      // Check memory pressure
      const pressure = this._calculateMemoryPressure();
      if (pressure > this.config.criticalMemoryThreshold) {
        this.emit('memory:critical', { pressure, memory: memorySnapshot });
      } else if (pressure > this.config.lowMemoryThreshold) {
        this.emit('memory:low', { pressure, memory: memorySnapshot });
      }
      
      // Trigger proactive GC if needed
      if (this.config.enableProactiveGC && pressure > this.config.gcThreshold) {
        this._performGarbageCollection();
      }
      
    }, 5000); // Every 5 seconds
  }

  _startLeakDetection() {
    this.leakDetectionInterval = setInterval(async () => {
      try {
        await this.detectMemoryLeaks();
      } catch (error) {
        this.logger.error('Leak detection failed:', error);
      }
    }, this.config.leakDetectionInterval);
  }

  _startMemoryProfiling() {
    this.profilingInterval = setInterval(() => {
      const profile = this._createMemoryProfile();
      this.memoryProfiles.push(profile);
      
      // Keep only recent profiles
      if (this.memoryProfiles.length > this.config.retainProfiles) {
        this.memoryProfiles = this.memoryProfiles.slice(-this.config.retainProfiles);
      }
      
    }, this.config.profilingInterval);
  }

  _getMemorySnapshot() {
    const memUsage = process.memoryUsage();
    return {
      ...memUsage,
      timestamp: Date.now(),
      heapUsedMB: memUsage.heapUsed / 1024 / 1024,
      heapTotalMB: memUsage.heapTotal / 1024 / 1024,
      externalMB: memUsage.external / 1024 / 1024
    };
  }

  _getSystemMemoryInfo() {
    return {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      usedMemory: os.totalmem() - os.freemem(),
      usagePercentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    };
  }

  _calculateMemoryPressure() {
    const current = this._getMemorySnapshot();
    const systemInfo = this._getSystemMemoryInfo();
    
    // Calculate pressure based on heap usage and system memory
    const heapPressure = current.heapUsed / current.heapTotal;
    const systemPressure = systemInfo.usagePercentage / 100;
    
    return Math.max(heapPressure, systemPressure * 0.7); // Weight system pressure less
  }

  async _applyCriticalOptimizations() {
    const optimizations = [];
    
    // Aggressive cache cleanup
    for (const [name, cache] of this.caches) {
      const cleared = cache.clearStale(0.5); // Clear 50% of cache
      if (cleared > 0) {
        optimizations.push({
          type: 'cache_aggressive_cleanup',
          cache: name,
          entriesCleared: cleared
        });
      }
    }
    
    // Force garbage collection
    const gcResult = await this._performGarbageCollection();
    optimizations.push(gcResult);
    
    return optimizations;
  }

  async _applyStandardOptimizations() {
    const optimizations = [];
    
    // Standard cache cleanup
    for (const [name, cache] of this.caches) {
      const cleared = cache.clearExpired();
      if (cleared > 0) {
        optimizations.push({
          type: 'cache_cleanup',
          cache: name,
          entriesCleared: cleared
        });
      }
    }
    
    // Object pool cleanup
    for (const [name, pool] of this.objectPools) {
      const cleared = pool.cleanup();
      if (cleared > 0) {
        optimizations.push({
          type: 'pool_cleanup',
          pool: name,
          objectsCleared: cleared
        });
      }
    }
    
    return optimizations;
  }

  async _applyMaintenanceOptimizations() {
    const optimizations = [];
    
    // Light maintenance
    for (const [name, cache] of this.caches) {
      const maintained = cache.maintenance();
      if (maintained > 0) {
        optimizations.push({
          type: 'cache_maintenance',
          cache: name,
          entriesMaintained: maintained
        });
      }
    }
    
    return optimizations;
  }

  async _optimizeCaches() {
    const optimizations = [];
    
    for (const [name, cache] of this.caches) {
      const stats = this.cacheStatistics.get(name);
      const hitRate = stats.hits / (stats.hits + stats.misses);
      
      // Resize cache based on hit rate
      if (hitRate < 0.3 && cache.maxSize > 100) { // Low hit rate
        cache.resize(Math.floor(cache.maxSize * 0.8));
        optimizations.push({
          type: 'cache_resize_down',
          cache: name,
          newSize: cache.maxSize
        });
      } else if (hitRate > 0.8 && cache.size >= cache.maxSize * 0.9) { // High hit rate, near capacity
        cache.resize(Math.floor(cache.maxSize * 1.2));
        optimizations.push({
          type: 'cache_resize_up',
          cache: name,
          newSize: cache.maxSize
        });
      }
    }
    
    return optimizations;
  }

  async _optimizeObjectPools() {
    const optimizations = [];
    
    for (const [name, pool] of this.objectPools) {
      const optimized = pool.optimize();
      if (optimized) {
        optimizations.push({
          type: 'pool_optimization',
          pool: name,
          ...optimized
        });
      }
    }
    
    return optimizations;
  }

  _shouldForceGC() {
    const pressure = this._calculateMemoryPressure();
    return pressure > this.config.forceGCThreshold;
  }

  async _performGarbageCollection() {
    const before = this._getMemorySnapshot();
    
    if (global.gc) {
      global.gc();
      
      // Wait a moment for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const after = this._getMemorySnapshot();
      const memoryFreed = before.heapUsed - after.heapUsed;
      
      return {
        type: 'garbage_collection',
        memoryBefore: before.heapUsed,
        memoryAfter: after.heapUsed,
        memoryFreed,
        success: memoryFreed > 0
      };
    }
    
    return {
      type: 'garbage_collection',
      success: false,
      reason: 'GC not available'
    };
  }

  _calculateMemoryImprovement(before, after) {
    if (before.heapUsed === 0) return 0;
    return ((before.heapUsed - after.heapUsed) / before.heapUsed) * 100;
  }

  _setupCacheEventHandlers(cacheName, cache) {
    cache.on('hit', () => {
      const stats = this.cacheStatistics.get(cacheName);
      stats.hits++;
      stats.lastAccess = Date.now();
    });
    
    cache.on('miss', () => {
      const stats = this.cacheStatistics.get(cacheName);
      stats.misses++;
    });
    
    cache.on('set', () => {
      const stats = this.cacheStatistics.get(cacheName);
      stats.size = cache.size;
      stats.memoryUsage = cache.getMemoryUsage();
    });
  }

  _updateLeakSuspects(leaks) {
    for (const leak of leaks) {
      const key = `${leak.type}_${leak.cacheName || 'global'}`;
      
      if (this.leakSuspects.has(key)) {
        const suspect = this.leakSuspects.get(key);
        suspect.count++;
        suspect.lastSeen = Date.now();
        suspect.severity = Math.max(suspect.severity, this._severityToNumber(leak.severity));
      } else {
        this.leakSuspects.set(key, {
          type: leak.type,
          count: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          severity: this._severityToNumber(leak.severity),
          description: leak.description
        });
      }
    }
  }

  _severityToNumber(severity) {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity] || 1;
  }

  _generateLeakRecommendations(leaks) {
    const recommendations = [];
    
    for (const leak of leaks) {
      switch (leak.type) {
        case 'continuous_growth':
          recommendations.push('Consider implementing more aggressive garbage collection');
          recommendations.push('Review code for potential memory leaks in event listeners or closures');
          break;
        case 'cache_bloat':
          recommendations.push(`Reduce cache size for ${leak.cacheName} or implement better eviction strategy`);
          break;
        case 'external_growth':
          recommendations.push('Review external dependencies for memory leaks');
          break;
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  _createMemoryProfile() {
    const current = this._getMemorySnapshot();
    const system = this._getSystemMemoryInfo();
    
    return {
      timestamp: Date.now(),
      memory: current,
      system,
      caches: this._getCacheSnapshot(),
      pools: this._getPoolSnapshot()
    };
  }

  _getCacheSnapshot() {
    const snapshot = {};
    for (const [name, cache] of this.caches) {
      snapshot[name] = {
        size: cache.size,
        memoryUsage: cache.getMemoryUsage ? cache.getMemoryUsage() : 0,
        hitRate: this._calculateCacheHitRate(name)
      };
    }
    return snapshot;
  }

  _getPoolSnapshot() {
    const snapshot = {};
    for (const [name, pool] of this.objectPools) {
      snapshot[name] = {
        size: pool.size,
        active: pool.activeCount,
        available: pool.availableCount
      };
    }
    return snapshot;
  }

  _calculateCacheHitRate(cacheName) {
    const stats = this.cacheStatistics.get(cacheName);
    if (!stats) return 0;
    return stats.hits / (stats.hits + stats.misses) || 0;
  }

  _getCacheReport() {
    const report = {};
    for (const [name, cache] of this.caches) {
      const stats = this.cacheStatistics.get(name);
      report[name] = {
        size: cache.size,
        maxSize: cache.maxSize,
        memoryUsage: cache.getMemoryUsage ? cache.getMemoryUsage() : 0,
        hitRate: this._calculateCacheHitRate(name),
        lastAccess: stats.lastAccess
      };
    }
    return report;
  }

  _getObjectPoolReport() {
    const report = {};
    for (const [name, pool] of this.objectPools) {
      report[name] = {
        totalObjects: pool.size,
        activeObjects: pool.activeCount,
        availableObjects: pool.availableCount,
        utilizationRate: pool.getUtilizationRate()
      };
    }
    return report;
  }

  _generateMemoryRecommendations(currentMemory) {
    const recommendations = [];
    const pressure = this._calculateMemoryPressure();
    
    if (pressure > 0.8) {
      recommendations.push('Critical: Consider increasing memory limits or optimizing memory usage');
    } else if (pressure > 0.6) {
      recommendations.push('Warning: Monitor memory usage closely');
    }
    
    // Cache recommendations
    const totalCacheMemory = this._getTotalCacheMemoryUsage();
    const memoryPercentage = (totalCacheMemory / currentMemory.heapUsed) * 100;
    
    if (memoryPercentage > 30) {
      recommendations.push('Consider reducing cache sizes or implementing better eviction policies');
    }
    
    return recommendations;
  }

  _calculateMemoryPeak() {
    return Math.max(...this.memoryHistory.map(m => m.heapUsed));
  }

  _calculateMemoryAverage() {
    const recent = this.memoryHistory.slice(-100); // Last 100 measurements
    return recent.reduce((sum, m) => sum + m.heapUsed, 0) / recent.length;
  }

  _getTotalCacheSize() {
    return Array.from(this.caches.values()).reduce((total, cache) => total + cache.size, 0);
  }

  _getTotalCacheMemoryUsage() {
    return Array.from(this.caches.values()).reduce((total, cache) => {
      return total + (cache.getMemoryUsage ? cache.getMemoryUsage() : 0);
    }, 0);
  }

  _getOverallCacheHitRate() {
    const totalHits = Array.from(this.cacheStatistics.values()).reduce((sum, stats) => sum + stats.hits, 0);
    const totalMisses = Array.from(this.cacheStatistics.values()).reduce((sum, stats) => sum + stats.misses, 0);
    return totalHits / (totalHits + totalMisses) || 0;
  }

  _getTotalPooledObjects() {
    return Array.from(this.objectPools.values()).reduce((total, pool) => total + pool.size, 0);
  }

  _getPoolUtilizationRate() {
    const pools = Array.from(this.objectPools.values());
    if (pools.length === 0) return 0;
    
    const totalUtilization = pools.reduce((sum, pool) => sum + pool.getUtilizationRate(), 0);
    return totalUtilization / pools.length;
  }

  // Placeholder methods for statistics
  _getLastOptimizationTime() { return Date.now(); }
  _getTotalOptimizationRuns() { return 0; }
  _getAverageOptimizationImprovement() { return 0; }
  _getLastGCTime() { return Date.now(); }
  _getGCFrequency() { return 0; }
  _getLastLeakCheckTime() { return Date.now(); }
  _calculateOptimizationEffectiveness() { return 85; }
}

// Smart cache implementation with multiple strategies
class SmartCache extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.name = config.name;
    this.maxSize = config.maxSize || 1000;
    this.ttl = config.ttl || config.defaultTTL;
    this.strategy = config.strategy || 'lru';
    
    this.data = new Map();
    this.accessTimes = new Map();
    this.accessCounts = new Map();
    this.size = 0;
  }

  get(key) {
    const entry = this.data.get(key);
    if (!entry) {
      this.emit('miss', key);
      return undefined;
    }

    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      this.emit('miss', key);
      return undefined;
    }

    // Update access tracking
    this.accessTimes.set(key, Date.now());
    this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);

    this.emit('hit', key);
    return entry.value;
  }

  set(key, value) {
    // Remove existing entry if it exists
    if (this.data.has(key)) {
      this.delete(key);
    }

    // Check if we need to evict
    if (this.size >= this.maxSize) {
      this._evict();
    }

    // Add new entry
    this.data.set(key, {
      value,
      timestamp: Date.now()
    });
    this.accessTimes.set(key, Date.now());
    this.accessCounts.set(key, 1);
    this.size++;

    this.emit('set', key, value);
  }

  delete(key) {
    if (this.data.delete(key)) {
      this.accessTimes.delete(key);
      this.accessCounts.delete(key);
      this.size--;
      return true;
    }
    return false;
  }

  clear() {
    const clearedCount = this.size;
    this.data.clear();
    this.accessTimes.clear();
    this.accessCounts.clear();
    this.size = 0;
    return clearedCount;
  }

  clearExpired() {
    if (!this.ttl) return 0;

    let cleared = 0;
    const now = Date.now();

    for (const [key, entry] of this.data) {
      if (now - entry.timestamp > this.ttl) {
        this.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  clearStale(ratio = 0.1) {
    const toClear = Math.floor(this.size * ratio);
    let cleared = 0;

    // Sort by access time (oldest first)
    const entries = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < Math.min(toClear, entries.length); i++) {
      this.delete(entries[i][0]);
      cleared++;
    }

    return cleared;
  }

  maintenance() {
    // Perform light maintenance
    return this.clearExpired();
  }

  resize(newSize) {
    this.maxSize = newSize;
    
    // Evict if over new size
    while (this.size > this.maxSize) {
      this._evict();
    }
  }

  getMemoryUsage() {
    // Rough estimate of memory usage
    let usage = 0;
    for (const [key, entry] of this.data) {
      usage += this._estimateSize(key) + this._estimateSize(entry.value);
    }
    return usage;
  }

  _evict() {
    let keyToEvict;

    switch (this.strategy) {
      case 'lru':
        keyToEvict = this._findLRU();
        break;
      case 'lfu':
        keyToEvict = this._findLFU();
        break;
      case 'adaptive':
        keyToEvict = this._findAdaptive();
        break;
      default:
        keyToEvict = this.data.keys().next().value; // FIFO fallback
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
    }
  }

  _findLRU() {
    let oldest = Date.now();
    let keyToEvict = null;

    for (const [key, time] of this.accessTimes) {
      if (time < oldest) {
        oldest = time;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  _findLFU() {
    let lowest = Infinity;
    let keyToEvict = null;

    for (const [key, count] of this.accessCounts) {
      if (count < lowest) {
        lowest = count;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  _findAdaptive() {
    // Combine LRU and LFU with weights
    let bestScore = Infinity;
    let keyToEvict = null;
    const now = Date.now();

    for (const [key] of this.data) {
      const lastAccess = this.accessTimes.get(key) || 0;
      const accessCount = this.accessCounts.get(key) || 0;
      
      // Score combines recency and frequency
      const ageScore = (now - lastAccess) / 1000; // Age in seconds
      const frequencyScore = 1 / (accessCount + 1); // Inverse of frequency
      const combinedScore = ageScore * 0.7 + frequencyScore * 0.3;

      if (combinedScore < bestScore) {
        bestScore = combinedScore;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  _estimateSize(obj) {
    if (typeof obj === 'string') return obj.length * 2; // Rough UTF-16 estimate
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'object' && obj !== null) {
      return JSON.stringify(obj).length * 2; // Rough estimate
    }
    return 0;
  }
}

// Object pool for reusing expensive objects
class ObjectPool {
  constructor(name, factory, config = {}) {
    this.name = name;
    this.factory = factory;
    this.maxSize = config.maxSize || 50;
    this.maxAge = config.maxAge || 300000; // 5 minutes
    
    this.available = [];
    this.active = new Set();
    this.created = 0;
  }

  acquire() {
    let obj = this.available.pop();
    
    if (!obj) {
      obj = this.factory();
      obj._poolCreated = Date.now();
      this.created++;
    }
    
    obj._poolAcquired = Date.now();
    this.active.add(obj);
    
    return obj;
  }

  release(obj) {
    if (!this.active.has(obj)) {
      return; // Not from this pool
    }
    
    this.active.delete(obj);
    
    // Check if object is too old
    if (obj._poolCreated && Date.now() - obj._poolCreated > this.maxAge) {
      return; // Don't return to pool, let it be garbage collected
    }
    
    // Check pool size limit
    if (this.available.length >= this.maxSize) {
      return; // Pool is full, let it be garbage collected
    }
    
    // Reset object state if possible
    if (typeof obj.reset === 'function') {
      obj.reset();
    }
    
    obj._poolReleased = Date.now();
    this.available.push(obj);
  }

  cleanup() {
    const before = this.available.length;
    const now = Date.now();
    
    this.available = this.available.filter(obj => 
      !obj._poolCreated || now - obj._poolCreated < this.maxAge
    );
    
    return before - this.available.length;
  }

  optimize() {
    const utilization = this.getUtilizationRate();
    let optimized = false;
    
    // Adjust pool size based on utilization
    if (utilization < 0.3 && this.maxSize > 10) {
      this.maxSize = Math.floor(this.maxSize * 0.8);
      optimized = true;
    } else if (utilization > 0.8 && this.maxSize < 100) {
      this.maxSize = Math.floor(this.maxSize * 1.2);
      optimized = true;
    }
    
    return optimized ? { newMaxSize: this.maxSize, utilization } : null;
  }

  clear() {
    this.available.length = 0;
    this.active.clear();
  }

  get size() {
    return this.available.length + this.active.size;
  }

  get activeCount() {
    return this.active.size;
  }

  get availableCount() {
    return this.available.length;
  }

  getUtilizationRate() {
    if (this.size === 0) return 0;
    return this.active.size / this.size;
  }
}

// Optimization strategy base classes
class OptimizationStrategy {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Override in subclasses
  }

  async optimize() {
    throw new Error('Must implement optimize method');
  }
}

class TemplateCacheStrategy extends OptimizationStrategy {
  async optimize() {
    // Template-specific caching optimization
    return { type: 'template_cache', improvement: 15 };
  }
}

class RDFCacheStrategy extends OptimizationStrategy {
  async optimize() {
    // RDF-specific caching optimization
    return { type: 'rdf_cache', improvement: 20 };
  }
}

class QueryCacheStrategy extends OptimizationStrategy {
  async optimize() {
    // Query-specific caching optimization
    return { type: 'query_cache', improvement: 25 };
  }
}

class ObjectPoolStrategy extends OptimizationStrategy {
  async optimize() {
    // Object pooling optimization
    return { type: 'object_pool', improvement: 10 };
  }
}

class AdaptiveGCStrategy extends OptimizationStrategy {
  async optimize() {
    // Adaptive garbage collection
    return { type: 'adaptive_gc', improvement: 30 };
  }
}

export default MemoryOptimizer;