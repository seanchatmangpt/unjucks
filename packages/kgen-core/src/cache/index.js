/**
 * Cache Manager
 * Handles Redis caching, query result caching, and memory management
 */

import Redis from 'ioredis';
import consola from 'consola';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.redis = null;
    this.status = 'uninitialized';
    
    // Memory cache for frequently accessed items
    this.memoryCache = new Map();
    this.memoryCacheSize = 0;
    this.maxMemoryCache = config.maxMemoryCache || 100 * 1024 * 1024; // 100MB
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      memoryHits: 0,
      redisHits: 0
    };
    
    // Configuration
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour
    this.compressionThreshold = config.compressionThreshold || 1024; // 1KB
    this.maxKeyLength = config.maxKeyLength || 250;
    
    // Cleanup intervals
    this.memoryCleanupInterval = null;
    this.statsReportInterval = null;
  }

  /**
   * Initialize cache manager
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Initialize Redis connection
      await this.initializeRedis();
      
      // Setup memory cache cleanup
      this.setupMemoryCacheCleanup();
      
      // Setup statistics reporting
      this.setupStatsReporting();
      
      this.status = 'ready';
      consola.success('✅ Cache Manager initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Cache Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    const redisConfig = this.config.redis || {};
    
    try {
      // Handle cluster vs single instance
      if (redisConfig.cluster) {
        this.redis = new Redis.Cluster(redisConfig.cluster.nodes || [
          { host: redisConfig.host, port: redisConfig.port }
        ], redisConfig.cluster);
      } else {
        this.redis = new Redis({
          host: redisConfig.host || 'localhost',
          port: redisConfig.port || 6379,
          password: redisConfig.password,
          db: redisConfig.db || 0,
          ...redisConfig
        });
      }
      
      // Test connection
      await this.redis.ping();
      
      // Setup event handlers
      this.redis.on('connect', () => {
        consola.success('✅ Redis connected');
        this.emit('redis-connected');
      });
      
      this.redis.on('error', (error) => {
        consola.error('❌ Redis error:', error);
        this.stats.errors++;
        this.emit('redis-error', error);
      });
      
      this.redis.on('close', () => {
        consola.warn('⚠️ Redis connection closed');
        this.emit('redis-disconnected');
      });
      
      this.redis.on('reconnecting', () => {
        consola.info('🔄 Redis reconnecting...');
        this.emit('redis-reconnecting');
      });
      
      consola.success('✅ Redis connection established');
      
    } catch (error) {
      // If Redis fails, continue without it (graceful degradation)
      consola.warn('⚠️ Redis connection failed, continuing with memory cache only:', error.message);
      this.redis = null;
    }
  }

  /**
   * Setup memory cache cleanup
   */
  setupMemoryCacheCleanup() {
    this.memoryCleanupInterval = setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Setup statistics reporting
   */
  setupStatsReporting() {
    this.statsReportInterval = setInterval(() => {
      this.reportStats();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Generate cache key
   */
  generateKey(key, namespace = 'kgen') {
    const fullKey = `${namespace}:${key}`;
    
    // Hash long keys
    if (fullKey.length > this.maxKeyLength) {
      const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
      return `${namespace}:hash:${hash}`;
    }
    
    return fullKey;
  }

  /**
   * Set cache value
   */
  async set(key, value, ttl = null, options = {}) {
    try {
      const actualTTL = ttl || this.defaultTTL;
      const cacheKey = this.generateKey(key, options.namespace);
      
      // Serialize value
      const serialized = JSON.stringify(value);
      let data = Buffer.from(serialized, 'utf8');
      
      // Compress if needed
      let compressed = false;
      if (data.length > this.compressionThreshold) {
        data = await gzip(data);
        compressed = true;
      }
      
      // Store metadata
      const cacheEntry = {
        data: data.toString('base64'),
        compressed,
        timestamp: Date.now(),
        ttl: actualTTL,
        size: data.length
      };
      
      // Try Redis first
      if (this.redis && !options.memoryOnly) {
        try {
          await this.redis.setex(cacheKey, actualTTL, JSON.stringify(cacheEntry));
          this.stats.sets++;
          this.emit('cache-set', { key: cacheKey, size: data.length, redis: true });
        } catch (error) {
          consola.warn('Redis set failed, falling back to memory:', error.message);
          this.stats.errors++;
        }
      }
      
      // Also store in memory cache for frequently accessed items
      if (options.alsoMemory || !this.redis) {
        this.setMemoryCache(cacheKey, cacheEntry);
      }
      
      return true;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('cache-error', { operation: 'set', key, error });
      throw error;
    }
  }

  /**
   * Get cache value
   */
  async get(key, options = {}) {
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      
      // Try memory cache first
      const memoryResult = this.getMemoryCache(cacheKey);
      if (memoryResult !== null) {
        this.stats.hits++;
        this.stats.memoryHits++;
        this.emit('cache-hit', { key: cacheKey, source: 'memory' });
        return memoryResult;
      }
      
      // Try Redis
      if (this.redis) {
        try {
          const redisData = await this.redis.get(cacheKey);
          if (redisData) {
            const cacheEntry = JSON.parse(redisData);
            const value = await this.deserializeCacheEntry(cacheEntry);
            
            // Store in memory cache for next time
            this.setMemoryCache(cacheKey, cacheEntry);
            
            this.stats.hits++;
            this.stats.redisHits++;
            this.emit('cache-hit', { key: cacheKey, source: 'redis' });
            
            return value;
          }
        } catch (error) {
          consola.warn('Redis get failed:', error.message);
          this.stats.errors++;
        }
      }
      
      // Cache miss
      this.stats.misses++;
      this.emit('cache-miss', { key: cacheKey });
      return null;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('cache-error', { operation: 'get', key, error });
      return null; // Graceful degradation
    }
  }

  /**
   * Delete cache value
   */
  async delete(key, options = {}) {
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      let deleted = false;
      
      // Delete from memory cache
      if (this.memoryCache.has(cacheKey)) {
        const entry = this.memoryCache.get(cacheKey);
        this.memoryCacheSize -= entry.size;
        this.memoryCache.delete(cacheKey);
        deleted = true;
      }
      
      // Delete from Redis
      if (this.redis) {
        try {
          const result = await this.redis.del(cacheKey);
          if (result > 0) deleted = true;
        } catch (error) {
          consola.warn('Redis delete failed:', error.message);
          this.stats.errors++;
        }
      }
      
      if (deleted) {
        this.stats.deletes++;
        this.emit('cache-delete', { key: cacheKey });
      }
      
      return deleted;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('cache-error', { operation: 'delete', key, error });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key, options = {}) {
    try {
      const cacheKey = this.generateKey(key, options.namespace);
      
      // Check memory cache first
      if (this.memoryCache.has(cacheKey)) {
        const entry = this.memoryCache.get(cacheKey);
        if (this.isExpired(entry)) {
          this.memoryCache.delete(cacheKey);
          this.memoryCacheSize -= entry.size;
        } else {
          return true;
        }
      }
      
      // Check Redis
      if (this.redis) {
        try {
          const result = await this.redis.exists(cacheKey);
          return result > 0;
        } catch (error) {
          consola.warn('Redis exists check failed:', error.message);
          this.stats.errors++;
        }
      }
      
      return false;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('cache-error', { operation: 'exists', key, error });
      return false;
    }
  }

  /**
   * Clear cache (optionally by pattern)
   */
  async clear(pattern = null, options = {}) {
    try {
      let cleared = 0;
      
      if (pattern) {
        // Clear by pattern
        const cachePattern = this.generateKey(pattern, options.namespace);
        
        // Clear from memory cache
        for (const [key, entry] of this.memoryCache.entries()) {
          if (key.includes(pattern)) {
            this.memoryCache.delete(key);
            this.memoryCacheSize -= entry.size;
            cleared++;
          }
        }
        
        // Clear from Redis
        if (this.redis) {
          try {
            const keys = await this.redis.keys(cachePattern);
            if (keys.length > 0) {
              const result = await this.redis.del(...keys);
              cleared += result;
            }
          } catch (error) {
            consola.warn('Redis pattern clear failed:', error.message);
            this.stats.errors++;
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();
        this.memoryCacheSize = 0;
        cleared = this.memoryCache.size;
        
        if (this.redis) {
          try {
            await this.redis.flushdb();
          } catch (error) {
            consola.warn('Redis flush failed:', error.message);
            this.stats.errors++;
          }
        }
      }
      
      this.emit('cache-cleared', { pattern, cleared });
      return cleared;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('cache-error', { operation: 'clear', pattern, error });
      return 0;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet(key, factory, ttl = null, options = {}) {
    // Try to get existing value
    let value = await this.get(key, options);
    
    if (value !== null) {
      return value;
    }
    
    // Generate new value
    try {
      if (typeof factory === 'function') {
        value = await factory();
      } else {
        value = factory;
      }
      
      // Cache the new value
      await this.set(key, value, ttl, options);
      
      return value;
    } catch (error) {
      this.emit('cache-factory-error', { key, error });
      throw error;
    }
  }

  /**
   * Memory cache operations
   */
  setMemoryCache(key, cacheEntry) {
    // Check memory limits
    if (this.memoryCacheSize + cacheEntry.size > this.maxMemoryCache) {
      this.evictMemoryCache();
    }
    
    this.memoryCache.set(key, {
      ...cacheEntry,
      lastAccessed: Date.now()
    });
    this.memoryCacheSize += cacheEntry.size;
  }

  getMemoryCache(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    // Check expiration
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      this.memoryCacheSize -= entry.size;
      return null;
    }
    
    // Update access time
    entry.lastAccessed = Date.now();
    
    return this.deserializeCacheEntrySync(entry);
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }

  /**
   * Evict memory cache (LRU)
   */
  evictMemoryCache() {
    const sortedEntries = Array.from(this.memoryCache.entries())
      .sort(([,a], [,b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(sortedEntries.length * 0.25);
    
    for (let i = 0; i < toRemove && sortedEntries.length > 0; i++) {
      const [key, entry] = sortedEntries[i];
      this.memoryCache.delete(key);
      this.memoryCacheSize -= entry.size;
    }
    
    this.emit('memory-cache-evicted', { removed: toRemove });
  }

  /**
   * Cleanup expired memory cache entries
   */
  cleanupMemoryCache() {
    let cleaned = 0;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.memoryCacheSize -= entry.size;
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.emit('memory-cache-cleaned', { removed: cleaned });
      consola.info(`🧹 Cleaned ${cleaned} expired memory cache entries`);
    }
  }

  /**
   * Deserialize cache entry
   */
  async deserializeCacheEntry(entry) {
    let data = Buffer.from(entry.data, 'base64');
    
    if (entry.compressed) {
      data = await gunzip(data);
    }
    
    return JSON.parse(data.toString('utf8'));
  }

  /**
   * Deserialize cache entry synchronously
   */
  deserializeCacheEntrySync(entry) {
    let data = Buffer.from(entry.data, 'base64');
    
    if (entry.compressed) {
      data = zlib.gunzipSync(data);
    }
    
    return JSON.parse(data.toString('utf8'));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryCache: {
        size: this.memoryCache.size,
        sizeBytes: this.memoryCacheSize,
        maxSizeBytes: this.maxMemoryCache
      },
      redis: {
        connected: this.redis?.status === 'ready'
      }
    };
  }

  /**
   * Report statistics
   */
  reportStats() {
    const stats = this.getStats();
    this.emit('stats-report', stats);
    
    consola.info('📊 Cache Statistics:', {
      hitRate: `${stats.hitRate}%`,
      hits: stats.hits,
      misses: stats.misses,
      memoryEntries: stats.memoryCache.size,
      memorySizeMB: Math.round(stats.memoryCache.sizeBytes / 1024 / 1024)
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: this.status,
      redis: {
        connected: false,
        latency: null
      },
      memory: {
        entries: this.memoryCache.size,
        sizeBytes: this.memoryCacheSize,
        utilization: (this.memoryCacheSize / this.maxMemoryCache) * 100
      },
      stats: this.getStats()
    };
    
    // Test Redis connection
    if (this.redis) {
      try {
        const start = Date.now();
        await this.redis.ping();
        health.redis.connected = true;
        health.redis.latency = Date.now() - start;
      } catch (error) {
        health.redis.error = error.message;
      }
    }
    
    return health;
  }

  /**
   * Shutdown cache manager
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear intervals
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    if (this.statsReportInterval) {
      clearInterval(this.statsReportInterval);
    }
    
    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        consola.info('🛑 Redis connection closed');
      } catch (error) {
        consola.warn('Error closing Redis connection:', error);
      }
    }
    
    // Clear memory cache
    this.memoryCache.clear();
    this.memoryCacheSize = 0;
    
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Cache Manager shutdown complete');
  }

  /**
   * Cache SPARQL query results
   */
  async cacheQuery(queryText, result, ttl = null) {
    const queryHash = crypto.createHash('sha256')
      .update(queryText)
      .digest('hex');
    
    const cacheKey = `query:${queryHash}`;
    
    return this.set(cacheKey, {
      query: queryText,
      result,
      timestamp: Date.now()
    }, ttl || this.config.queryTTL || 1800); // 30 minutes default
  }

  /**
   * Get cached query results
   */
  async getCachedQuery(queryText) {
    const queryHash = crypto.createHash('sha256')
      .update(queryText)
      .digest('hex');
    
    const cacheKey = `query:${queryHash}`;
    const cached = await this.get(cacheKey);
    
    return cached?.result || null;
  }

  /**
   * Cache RDF parsing results
   */
  async cacheRDFParsing(dataHash, format, result, ttl = null) {
    const cacheKey = `rdf:${format}:${dataHash}`;
    
    return this.set(cacheKey, result, ttl || 3600); // 1 hour default
  }

  /**
   * Get cached RDF parsing results
   */
  async getCachedRDFParsing(dataHash, format) {
    const cacheKey = `rdf:${format}:${dataHash}`;
    return this.get(cacheKey);
  }
}