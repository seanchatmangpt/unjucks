/**
 * Inference Cache - High-Performance Caching System for Reproducible Generation
 * 
 * Provides comprehensive caching of inference results for:
 * - Deterministic and reproducible reasoning outcomes
 * - Multi-level caching (memory, disk, distributed)
 * - Cache invalidation and dependency tracking
 * - Compression and serialization optimization
 * - Cache warming and precomputation
 * - Analytics and performance monitoring
 * - Cache partitioning and sharding
 * - TTL and eviction policies
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class InferenceCache extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Cache levels and storage
      enableMemoryCache: config.enableMemoryCache !== false,
      enableDiskCache: config.enableDiskCache !== false,
      enableDistributedCache: config.enableDistributedCache || false,
      
      // Memory cache settings
      memoryCacheSize: config.memoryCacheSize || 10000,
      maxMemoryUsage: config.maxMemoryUsage || '500MB',
      
      // Disk cache settings
      diskCacheDirectory: config.diskCacheDirectory || './cache/inference',
      maxDiskCacheSize: config.maxDiskCacheSize || '2GB',
      diskCachePartitions: config.diskCachePartitions || 16,
      
      // Distributed cache settings
      distributedCacheEndpoints: config.distributedCacheEndpoints || [],
      distributedCacheReplication: config.distributedCacheReplication || 2,
      
      // Compression settings
      enableCompression: config.enableCompression !== false,
      compressionLevel: config.compressionLevel || 6,
      compressionThreshold: config.compressionThreshold || 1024, // bytes
      
      // TTL and eviction
      defaultTTL: config.defaultTTL || 24 * 60 * 60 * 1000, // 24 hours
      maxAge: config.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      evictionPolicy: config.evictionPolicy || 'lru', // lru, lfu, fifo
      
      // Cache warming
      enableCacheWarming: config.enableCacheWarming || false,
      warmupPatterns: config.warmupPatterns || [],
      precomputeCommonQueries: config.precomputeCommonQueries || false,
      
      // Invalidation and dependencies
      enableDependencyTracking: config.enableDependencyTracking !== false,
      invalidationStrategy: config.invalidationStrategy || 'eager', // eager, lazy, scheduled
      
      // Performance and monitoring
      enableAnalytics: config.enableAnalytics !== false,
      metricsInterval: config.metricsInterval || 60000, // 1 minute
      enableProfiling: config.enableProfiling || false,
      
      // Concurrency and thread safety
      maxConcurrentOperations: config.maxConcurrentOperations || 100,
      lockTimeout: config.lockTimeout || 5000,
      
      ...config
    };
    
    this.logger = consola.withTag('inference-cache');
    
    // Multi-level cache storage
    this.memoryCache = null;
    this.diskCacheMap = new Map(); // partition -> cache info
    this.distributedCacheClients = new Map();
    
    // Cache metadata and indexing
    this.cacheIndex = new Map(); // key -> cache location info
    this.dependencyGraph = new Map(); // cache key -> dependencies
    this.inverseDependencyGraph = new Map(); // dependency -> dependent cache keys
    this.accessLog = [];
    
    // Performance monitoring
    this.metrics = {
      // Hit/miss statistics
      memoryHits: 0,
      diskHits: 0,
      distributedHits: 0,
      misses: 0,
      
      // Operation statistics
      puts: 0,
      gets: 0,
      deletes: 0,
      invalidations: 0,
      
      // Performance metrics
      totalAccessTime: 0,
      totalCompressionTime: 0,
      totalSerializationTime: 0,
      
      // Storage metrics
      memoryUsage: 0,
      diskUsage: 0,
      distributedUsage: 0,
      
      // Efficiency metrics
      compressionRatio: 0,
      deduplicationSavings: 0
    };
    
    // Cache warming and precomputation
    this.warmupQueue = [];
    this.precomputeQueue = [];
    
    // Locks for thread safety
    this.operationLocks = new Map();
    
    // Analytics and profiling
    this.analyticsBuffer = [];
    this.performanceProfiles = new Map();
    
    this.state = 'initialized';
  }

  /**
   * Initialize the inference cache
   */
  async initialize() {
    try {
      this.logger.info('Initializing inference cache...');
      
      // Initialize memory cache
      if (this.config.enableMemoryCache) {
        await this._initializeMemoryCache();
      }
      
      // Initialize disk cache
      if (this.config.enableDiskCache) {
        await this._initializeDiskCache();
      }
      
      // Initialize distributed cache
      if (this.config.enableDistributedCache) {
        await this._initializeDistributedCache();
      }
      
      // Start analytics if enabled
      if (this.config.enableAnalytics) {
        await this._startAnalytics();
      }
      
      // Start cache warming if enabled
      if (this.config.enableCacheWarming) {
        await this._startCacheWarming();
      }
      
      this.state = 'ready';
      this.logger.success('Inference cache initialized successfully');
      
      return {
        status: 'success',
        memoryCache: !!this.memoryCache,
        diskCache: this.config.enableDiskCache,
        distributedCache: this.config.enableDistributedCache,
        cacheSize: await this._calculateTotalCacheSize()
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize inference cache:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Get cached inference result
   * @param {string} key - Cache key
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object|null>} Cached result or null if not found
   */
  async get(key, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.debug(`Getting cache entry: ${key}`);
      
      // Check operation lock
      if (await this._isLocked(key, 'get')) {
        throw new Error(`Cache key is locked: ${key}`);
      }
      
      this.metrics.gets++;
      
      let result = null;
      let hitLevel = null;
      
      // Try memory cache first
      if (this.config.enableMemoryCache && this.memoryCache) {
        result = this.memoryCache.get(key);
        if (result) {
          hitLevel = 'memory';
          this.metrics.memoryHits++;
        }
      }
      
      // Try disk cache if not in memory
      if (!result && this.config.enableDiskCache) {
        result = await this._getDiskCache(key);
        if (result) {
          hitLevel = 'disk';
          this.metrics.diskHits++;
          
          // Promote to memory cache
          if (this.config.enableMemoryCache && this.memoryCache) {
            this.memoryCache.set(key, result);
          }
        }
      }
      
      // Try distributed cache if not found locally
      if (!result && this.config.enableDistributedCache) {
        result = await this._getDistributedCache(key);
        if (result) {
          hitLevel = 'distributed';
          this.metrics.distributedHits++;
          
          // Promote to local caches
          await this._promoteToLocalCaches(key, result);
        }
      }
      
      // Record miss if not found
      if (!result) {
        this.metrics.misses++;
      }
      
      // Update access log and analytics
      const accessTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.totalAccessTime += accessTime;
      
      await this._recordAccess(key, hitLevel, accessTime, operationId);
      
      this.emit('cache:get', {
        key,
        hit: !!result,
        level: hitLevel,
        accessTime,
        operationId
      });
      
      if (result) {
        this.logger.debug(`Cache hit (${hitLevel}): ${key} in ${accessTime}ms`);
      } else {
        this.logger.debug(`Cache miss: ${key} in ${accessTime}ms`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Cache get failed for key ${key}:`, error);
      this.emit('cache:error', { operation: 'get', key, error, operationId });
      return null;
    }
  }

  /**
   * Put inference result in cache
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result
   */
  async put(key, value, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.debug(`Putting cache entry: ${key}`);
      
      // Acquire operation lock
      await this._acquireLock(key, 'put');
      
      try {
        this.metrics.puts++;
        
        // Validate and prepare value
        const preparedValue = await this._prepareValueForStorage(value, options);
        
        // Determine storage levels based on value size and options
        const storageStrategy = await this._determineStorageStrategy(key, preparedValue, options);
        
        const storageResults = {
          memory: false,
          disk: false,
          distributed: false,
          compressed: false,
          size: preparedValue.size || 0,
          ttl: options.ttl || this.config.defaultTTL
        };
        
        // Store in memory cache
        if (storageStrategy.memory && this.config.enableMemoryCache && this.memoryCache) {
          this.memoryCache.set(key, preparedValue.data, {
            ttl: storageResults.ttl,
            size: preparedValue.size
          });
          storageResults.memory = true;
        }
        
        // Store in disk cache
        if (storageStrategy.disk && this.config.enableDiskCache) {
          await this._putDiskCache(key, preparedValue, options);
          storageResults.disk = true;
        }
        
        // Store in distributed cache
        if (storageStrategy.distributed && this.config.enableDistributedCache) {
          await this._putDistributedCache(key, preparedValue, options);
          storageResults.distributed = true;
        }
        
        // Update cache index
        await this._updateCacheIndex(key, storageResults, options);
        
        // Track dependencies if enabled
        if (this.config.enableDependencyTracking && options.dependencies) {
          await this._trackDependencies(key, options.dependencies);
        }
        
        const putTime = this.getDeterministicTimestamp() - startTime;
        
        this.emit('cache:put', {
          key,
          size: preparedValue.size,
          storageResults,
          putTime,
          operationId
        });
        
        this.logger.debug(`Cache put completed: ${key} (${preparedValue.size} bytes) in ${putTime}ms`);
        
        return storageResults;
        
      } finally {
        await this._releaseLock(key, 'put');
      }
      
    } catch (error) {
      this.logger.error(`Cache put failed for key ${key}:`, error);
      this.emit('cache:error', { operation: 'put', key, error, operationId });
      throw error;
    }
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key to delete
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async delete(key, options = {}) {
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.debug(`Deleting cache entry: ${key}`);
      
      await this._acquireLock(key, 'delete');
      
      try {
        this.metrics.deletes++;
        
        const deletionResult = {
          memory: false,
          disk: false,
          distributed: false
        };
        
        // Delete from memory cache
        if (this.config.enableMemoryCache && this.memoryCache) {
          const deleted = this.memoryCache.delete(key);
          deletionResult.memory = deleted;
        }
        
        // Delete from disk cache
        if (this.config.enableDiskCache) {
          const deleted = await this._deleteDiskCache(key);
          deletionResult.disk = deleted;
        }
        
        // Delete from distributed cache
        if (this.config.enableDistributedCache) {
          const deleted = await this._deleteDistributedCache(key);
          deletionResult.distributed = deleted;
        }
        
        // Remove from cache index
        this.cacheIndex.delete(key);
        
        // Handle dependency cleanup
        if (this.config.enableDependencyTracking) {
          await this._cleanupDependencies(key);
        }
        
        this.emit('cache:delete', { key, deletionResult, operationId });
        
        return deletionResult;
        
      } finally {
        await this._releaseLock(key, 'delete');
      }
      
    } catch (error) {
      this.logger.error(`Cache delete failed for key ${key}:`, error);
      this.emit('cache:error', { operation: 'delete', key, error, operationId });
      throw error;
    }
  }

  /**
   * Invalidate cache entries based on dependencies
   * @param {Array} dependencies - Dependencies that changed
   * @param {Object} options - Invalidation options
   * @returns {Promise<Object>} Invalidation result
   */
  async invalidate(dependencies, options = {}) {
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Invalidating cache entries for ${dependencies.length} dependencies`);
      
      this.metrics.invalidations++;
      
      const invalidatedKeys = new Set();
      
      // Find all cache entries that depend on the changed dependencies
      for (const dependency of dependencies) {
        const dependentKeys = this.inverseDependencyGraph.get(dependency) || new Set();
        
        for (const key of dependentKeys) {
          invalidatedKeys.add(key);
        }
      }
      
      // Strategy-based invalidation
      const invalidationResults = {
        invalidatedCount: 0,
        strategy: options.strategy || this.config.invalidationStrategy
      };
      
      switch (invalidationResults.strategy) {
        case 'eager':
          // Immediately delete all dependent entries
          for (const key of invalidatedKeys) {
            await this.delete(key, { operationId, reason: 'dependency-invalidation' });
            invalidationResults.invalidatedCount++;
          }
          break;
          
        case 'lazy':
          // Mark entries for lazy invalidation
          for (const key of invalidatedKeys) {
            await this._markForLazyInvalidation(key, dependencies);
            invalidationResults.invalidatedCount++;
          }
          break;
          
        case 'scheduled':
          // Schedule invalidation for later
          for (const key of invalidatedKeys) {
            await this._scheduleInvalidation(key, dependencies, options.scheduleTime);
            invalidationResults.invalidatedCount++;
          }
          break;
      }
      
      this.emit('cache:invalidate', {
        dependencies,
        invalidatedKeys: Array.from(invalidatedKeys),
        strategy: invalidationResults.strategy,
        operationId
      });
      
      this.logger.info(`Invalidated ${invalidationResults.invalidatedCount} cache entries`);
      
      return invalidationResults;
      
    } catch (error) {
      this.logger.error('Cache invalidation failed:', error);
      this.emit('cache:error', { operation: 'invalidate', dependencies, error, operationId });
      throw error;
    }
  }

  /**
   * Warm cache with precomputed values
   * @param {Array} warmupEntries - Entries to warm up
   * @param {Object} options - Warmup options
   * @returns {Promise<Object>} Warmup result
   */
  async warmCache(warmupEntries, options = {}) {
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Warming cache with ${warmupEntries.length} entries`);
      
      const warmupResults = {
        warmedCount: 0,
        errors: [],
        totalTime: 0
      };
      
      const startTime = this.getDeterministicTimestamp();
      
      // Process warmup entries in batches
      const batchSize = options.batchSize || 100;
      const batches = this._createBatches(warmupEntries, batchSize);
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (entry) => {
          try {
            await this.put(entry.key, entry.value, {
              ...entry.options,
              operationId,
              reason: 'cache-warmup'
            });
            warmupResults.warmedCount++;
          } catch (error) {
            warmupResults.errors.push({
              key: entry.key,
              error: error.message
            });
          }
        });
        
        await Promise.all(batchPromises);
        
        // Rate limiting for cache warmup
        if (options.rateLimitMs) {
          await this._sleep(options.rateLimitMs);
        }
      }
      
      warmupResults.totalTime = this.getDeterministicTimestamp() - startTime;
      
      this.emit('cache:warmup', {
        warmupResults,
        operationId
      });
      
      this.logger.success(`Cache warmup completed: ${warmupResults.warmedCount} entries in ${warmupResults.totalTime}ms`);
      
      return warmupResults;
      
    } catch (error) {
      this.logger.error('Cache warmup failed:', error);
      throw error;
    }
  }

  /**
   * Clear all cache levels
   * @param {Object} options - Clear options
   * @returns {Promise<Object>} Clear result
   */
  async clear(options = {}) {
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info('Clearing all cache levels');
      
      const clearResult = {
        memory: false,
        disk: false,
        distributed: false
      };
      
      // Clear memory cache
      if (this.config.enableMemoryCache && this.memoryCache) {
        this.memoryCache.clear();
        clearResult.memory = true;
      }
      
      // Clear disk cache
      if (this.config.enableDiskCache) {
        await this._clearDiskCache();
        clearResult.disk = true;
      }
      
      // Clear distributed cache
      if (this.config.enableDistributedCache) {
        await this._clearDistributedCache();
        clearResult.distributed = true;
      }
      
      // Clear metadata
      this.cacheIndex.clear();
      this.dependencyGraph.clear();
      this.inverseDependencyGraph.clear();
      this.accessLog = [];
      
      // Reset metrics
      this._resetMetrics();
      
      this.emit('cache:clear', { clearResult, operationId });
      this.logger.success('All cache levels cleared');
      
      return clearResult;
      
    } catch (error) {
      this.logger.error('Cache clear failed:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics and metrics
   * @returns {Object} Cache statistics
   */
  getStatistics() {
    const totalRequests = this.metrics.gets;
    const totalHits = this.metrics.memoryHits + this.metrics.diskHits + this.metrics.distributedHits;
    
    return {
      requests: {
        total: totalRequests,
        hits: totalHits,
        misses: this.metrics.misses,
        hitRatio: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
      },
      hitsByLevel: {
        memory: this.metrics.memoryHits,
        disk: this.metrics.diskHits,
        distributed: this.metrics.distributedHits
      },
      operations: {
        puts: this.metrics.puts,
        gets: this.metrics.gets,
        deletes: this.metrics.deletes,
        invalidations: this.metrics.invalidations
      },
      performance: {
        averageAccessTime: totalRequests > 0 ? this.metrics.totalAccessTime / totalRequests : 0,
        compressionRatio: this.metrics.compressionRatio,
        deduplicationSavings: this.metrics.deduplicationSavings
      },
      storage: {
        memoryUsage: this.metrics.memoryUsage,
        diskUsage: this.metrics.diskUsage,
        distributedUsage: this.metrics.distributedUsage,
        totalEntries: this.cacheIndex.size
      },
      efficiency: {
        memoryHitRate: totalRequests > 0 ? (this.metrics.memoryHits / totalRequests) * 100 : 0,
        diskHitRate: totalRequests > 0 ? (this.metrics.diskHits / totalRequests) * 100 : 0,
        distributedHitRate: totalRequests > 0 ? (this.metrics.distributedHits / totalRequests) * 100 : 0
      }
    };
  }

  /**
   * Get cache status and configuration
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        enableMemoryCache: this.config.enableMemoryCache,
        enableDiskCache: this.config.enableDiskCache,
        enableDistributedCache: this.config.enableDistributedCache,
        enableCompression: this.config.enableCompression,
        enableDependencyTracking: this.config.enableDependencyTracking
      },
      cacheInfo: {
        memoryCacheSize: this.memoryCache ? this.memoryCache.size : 0,
        diskCachePartitions: this.diskCacheMap.size,
        distributedCacheClients: this.distributedCacheClients.size,
        totalIndexedEntries: this.cacheIndex.size
      },
      dependencies: {
        trackedDependencies: this.dependencyGraph.size,
        inverseDependencies: this.inverseDependencyGraph.size
      },
      analytics: {
        enabled: this.config.enableAnalytics,
        bufferSize: this.analyticsBuffer.length,
        profilesTracked: this.performanceProfiles.size
      }
    };
  }

  /**
   * Shutdown the cache system
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down inference cache...');
      
      // Flush any pending analytics
      if (this.config.enableAnalytics) {
        await this._flushAnalytics();
      }
      
      // Close distributed cache connections
      if (this.config.enableDistributedCache) {
        await this._shutdownDistributedCache();
      }
      
      // Clear all data
      await this.clear({ reason: 'shutdown' });
      
      this.state = 'shutdown';
      this.logger.success('Inference cache shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during inference cache shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Initialize memory cache
   */
  async _initializeMemoryCache() {
    const maxSize = this._parseMemorySize(this.config.maxMemoryUsage);
    
    this.memoryCache = new LRUCache({
      max: this.config.memoryCacheSize,
      maxSize: maxSize,
      ttl: this.config.defaultTTL,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      allowStale: false,
      sizeCalculation: (value) => {
        return Buffer.byteLength(JSON.stringify(value), 'utf8');
      },
      dispose: (value, key, reason) => {
        this.emit('cache:evict', { level: 'memory', key, reason });
      }
    });
    
    this.logger.debug(`Memory cache initialized with ${this.config.memoryCacheSize} entries max`);
  }

  /**
   * Initialize disk cache
   */
  async _initializeDiskCache() {
    // Create cache directory
    await fs.mkdir(this.config.diskCacheDirectory, { recursive: true });
    
    // Initialize cache partitions
    for (let i = 0; i < this.config.diskCachePartitions; i++) {
      const partitionDir = path.join(this.config.diskCacheDirectory, `partition-${i}`);
      await fs.mkdir(partitionDir, { recursive: true });
      
      this.diskCacheMap.set(i, {
        directory: partitionDir,
        entryCount: 0,
        size: 0
      });
    }
    
    // Scan existing entries
    await this._scanDiskCache();
    
    this.logger.debug(`Disk cache initialized with ${this.config.diskCachePartitions} partitions`);
  }

  /**
   * Initialize distributed cache
   */
  async _initializeDistributedCache() {
    for (const endpoint of this.config.distributedCacheEndpoints) {
      try {
        // Initialize distributed cache client (Redis, Memcached, etc.)
        const client = await this._createDistributedCacheClient(endpoint);
        this.distributedCacheClients.set(endpoint, client);
      } catch (error) {
        this.logger.warn(`Failed to connect to distributed cache endpoint ${endpoint}:`, error.message);
      }
    }
    
    this.logger.debug(`Distributed cache initialized with ${this.distributedCacheClients.size} endpoints`);
  }

  /**
   * Start analytics collection
   */
  async _startAnalytics() {
    setInterval(() => {
      this._collectAnalytics();
    }, this.config.metricsInterval);
  }

  /**
   * Start cache warming
   */
  async _startCacheWarming() {
    if (this.config.warmupPatterns.length > 0) {
      // Process warmup patterns in background
      setImmediate(async () => {
        await this._processWarmupPatterns();
      });
    }
  }

  /**
   * Get from disk cache
   */
  async _getDiskCache(key) {
    try {
      const partition = this._getPartitionForKey(key);
      const partitionInfo = this.diskCacheMap.get(partition);
      const filePath = path.join(partitionInfo.directory, `${this._hashKey(key)}.json`);
      
      const data = await fs.readFile(filePath, 'utf8');
      let cacheEntry = JSON.parse(data);
      
      // Check TTL
      if (cacheEntry.expiresAt && this.getDeterministicTimestamp() > cacheEntry.expiresAt) {
        await fs.unlink(filePath).catch(() => {}); // Ignore errors
        return null;
      }
      
      // Decompress if needed
      if (cacheEntry.compressed) {
        cacheEntry.value = await this._decompress(cacheEntry.value);
      }
      
      return cacheEntry.value;
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.debug(`Disk cache read error for key ${key}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Put to disk cache
   */
  async _putDiskCache(key, preparedValue, options) {
    const partition = this._getPartitionForKey(key);
    const partitionInfo = this.diskCacheMap.get(partition);
    const filePath = path.join(partitionInfo.directory, `${this._hashKey(key)}.json`);
    
    const cacheEntry = {
      key,
      value: preparedValue.data,
      compressed: preparedValue.compressed,
      createdAt: this.getDeterministicTimestamp(),
      expiresAt: options.ttl ? this.getDeterministicTimestamp() + options.ttl : null,
      metadata: options.metadata || {}
    };
    
    await fs.writeFile(filePath, JSON.stringify(cacheEntry), 'utf8');
    
    // Update partition info
    partitionInfo.entryCount++;
    partitionInfo.size += preparedValue.size;
  }

  /**
   * Delete from disk cache
   */
  async _deleteDiskCache(key) {
    try {
      const partition = this._getPartitionForKey(key);
      const partitionInfo = this.diskCacheMap.get(partition);
      const filePath = path.join(partitionInfo.directory, `${this._hashKey(key)}.json`);
      
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      
      // Update partition info
      partitionInfo.entryCount = Math.max(0, partitionInfo.entryCount - 1);
      partitionInfo.size = Math.max(0, partitionInfo.size - stats.size);
      
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.debug(`Disk cache delete error for key ${key}:`, error.message);
      }
      return false;
    }
  }

  /**
   * Prepare value for storage
   */
  async _prepareValueForStorage(value, options) {
    const startTime = this.getDeterministicTimestamp();
    
    let serializedValue = JSON.stringify(value);
    let size = Buffer.byteLength(serializedValue, 'utf8');
    let compressed = false;
    
    // Compress if enabled and above threshold
    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      const compressionStart = this.getDeterministicTimestamp();
      const compressedBuffer = await gzipAsync(Buffer.from(serializedValue, 'utf8'));
      const compressedValue = compressedBuffer.toString('base64');
      
      this.metrics.totalCompressionTime += this.getDeterministicTimestamp() - compressionStart;
      
      // Use compressed version if it's smaller
      if (compressedValue.length < serializedValue.length) {
        serializedValue = compressedValue;
        size = compressedValue.length;
        compressed = true;
        
        // Update compression ratio metric
        this.metrics.compressionRatio = (this.metrics.compressionRatio + (size / Buffer.byteLength(JSON.stringify(value), 'utf8'))) / 2;
      }
    }
    
    this.metrics.totalSerializationTime += this.getDeterministicTimestamp() - startTime;
    
    return {
      data: value,
      serialized: serializedValue,
      size,
      compressed
    };
  }

  /**
   * Determine storage strategy
   */
  async _determineStorageStrategy(key, preparedValue, options) {
    const strategy = {
      memory: false,
      disk: false,
      distributed: false
    };
    
    // Memory storage for small, frequently accessed items
    if (preparedValue.size < 1024 * 10) { // < 10KB
      strategy.memory = true;
    }
    
    // Disk storage for medium-sized items
    if (preparedValue.size < 1024 * 1024) { // < 1MB
      strategy.disk = true;
    }
    
    // Distributed storage for large items or explicit requirement
    if (preparedValue.size > 1024 * 100 || options.distributed) { // > 100KB
      strategy.distributed = true;
    }
    
    // Override based on options
    if (options.memoryOnly) {
      strategy.disk = false;
      strategy.distributed = false;
    }
    
    if (options.persistOnly) {
      strategy.memory = false;
    }
    
    return strategy;
  }

  // Utility methods

  /**
   * Parse memory size string to bytes
   */
  _parseMemorySize(sizeStr) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.match(/^(\d+)([A-Z]+)$/);
    if (!match) return parseInt(sizeStr);
    
    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || 1);
  }

  /**
   * Get partition for cache key
   */
  _getPartitionForKey(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % this.config.diskCachePartitions;
  }

  /**
   * Hash cache key for filename
   */
  _hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Compress data
   */
  async _compress(data) {
    const buffer = Buffer.from(JSON.stringify(data), 'utf8');
    const compressed = await gzipAsync(buffer);
    return compressed.toString('base64');
  }

  /**
   * Decompress data
   */
  async _decompress(compressedData) {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = await gunzipAsync(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  }

  /**
   * Create batches from array
   */
  _createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep for specified milliseconds
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Additional stub methods for completeness

  async _getDistributedCache(key) { return null; }
  async _putDistributedCache(key, value, options) { /* Implementation */ }
  async _deleteDistributedCache(key) { return false; }
  async _clearDistributedCache() { /* Implementation */ }
  async _promoteToLocalCaches(key, value) { /* Implementation */ }
  async _updateCacheIndex(key, storageResults, options) { /* Implementation */ }
  async _trackDependencies(key, dependencies) { /* Implementation */ }
  async _cleanupDependencies(key) { /* Implementation */ }
  async _recordAccess(key, level, accessTime, operationId) { /* Implementation */ }
  async _acquireLock(key, operation) { /* Implementation */ }
  async _releaseLock(key, operation) { /* Implementation */ }
  async _isLocked(key, operation) { return false; }
  async _markForLazyInvalidation(key, dependencies) { /* Implementation */ }
  async _scheduleInvalidation(key, dependencies, scheduleTime) { /* Implementation */ }
  async _calculateTotalCacheSize() { return 0; }
  async _scanDiskCache() { /* Implementation */ }
  async _createDistributedCacheClient(endpoint) { return {}; }
  async _collectAnalytics() { /* Implementation */ }
  async _processWarmupPatterns() { /* Implementation */ }
  async _flushAnalytics() { /* Implementation */ }
  async _shutdownDistributedCache() { /* Implementation */ }
  async _clearDiskCache() { /* Implementation */ }
  _resetMetrics() {
    Object.keys(this.metrics).forEach(key => {
      if (typeof this.metrics[key] === 'number') {
        this.metrics[key] = 0;
      }
    });
  }
}

export default InferenceCache;