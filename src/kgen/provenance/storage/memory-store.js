/**
 * In-Memory Storage Implementation for Performance Testing
 * Agent DELTA-12: Performance Optimizer
 */

import consola from 'consola';
import { EventEmitter } from 'events';

export class MemoryStorage extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 10000,
      enableCompression: config.enableCompression || false,
      enableMetrics: config.enableMetrics || true,
      ...config
    };

    this.logger = consola.withTag('memory-storage');
    this.store = new Map();
    this.metadata = new Map();
    this.metrics = {
      totalOperations: 0,
      storeOperations: 0,
      retrieveOperations: 0,
      deleteOperations: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialize memory storage
   */
  async initialize() {
    this.logger.info('Initializing memory storage backend');
    return { status: 'success', type: 'memory' };
  }

  /**
   * Store data in memory
   */
  async store(key, data, metadata = {}) {
    try {
      // Check size limits
      if (this.store.size >= this.config.maxSize) {
        await this._evictOldestEntries();
      }

      // Store data with timestamp
      const entry = {
        data,
        timestamp: this.getDeterministicTimestamp(),
        metadata: {
          ...metadata,
          size: this._calculateSize(data)
        }
      };

      this.store.set(key, entry);
      this.metadata.set(key, entry.metadata);

      this.metrics.storeOperations++;
      this.metrics.totalOperations++;

      this.emit('stored', { key, size: entry.metadata.size });

      return { 
        status: 'success', 
        key,
        size: entry.metadata.size,
        totalEntries: this.store.size
      };

    } catch (error) {
      this.logger.error(`Failed to store key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve data from memory
   */
  async retrieve(key) {
    try {
      const entry = this.store.get(key);
      
      if (entry) {
        this.metrics.cacheHits++;
        this.emit('retrieved', { key, hit: true });
        return { 
          status: 'success', 
          data: entry.data,
          metadata: entry.metadata,
          age: this.getDeterministicTimestamp() - entry.timestamp
        };
      } else {
        this.metrics.cacheMisses++;
        this.emit('retrieved', { key, hit: false });
        return { 
          status: 'not_found', 
          key 
        };
      }

    } finally {
      this.metrics.retrieveOperations++;
      this.metrics.totalOperations++;
    }
  }

  /**
   * Delete data from memory
   */
  async delete(key) {
    try {
      const existed = this.store.has(key);
      this.store.delete(key);
      this.metadata.delete(key);

      this.metrics.deleteOperations++;
      this.metrics.totalOperations++;

      this.emit('deleted', { key, existed });

      return { 
        status: 'success', 
        key, 
        existed,
        totalEntries: this.store.size
      };

    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    return {
      status: 'success',
      exists: this.store.has(key),
      key
    };
  }

  /**
   * List all keys
   */
  async list(options = {}) {
    const { prefix, limit = 1000 } = options;
    let keys = Array.from(this.store.keys());

    if (prefix) {
      keys = keys.filter(key => key.startsWith(prefix));
    }

    if (limit && keys.length > limit) {
      keys = keys.slice(0, limit);
    }

    return {
      status: 'success',
      keys,
      total: keys.length
    };
  }

  /**
   * Clear all data
   */
  async clear() {
    const count = this.store.size;
    this.store.clear();
    this.metadata.clear();

    this.emit('cleared', { count });

    return {
      status: 'success',
      clearedCount: count
    };
  }

  /**
   * Get storage statistics
   */
  getStatistics() {
    const totalSize = Array.from(this.metadata.values())
      .reduce((sum, meta) => sum + (meta.size || 0), 0);

    return {
      totalEntries: this.store.size,
      totalSizeBytes: totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
      maxSize: this.config.maxSize,
      utilizationPercent: (this.store.size / this.config.maxSize) * 100,
      metrics: { ...this.metrics },
      hitRate: this.metrics.totalOperations > 0 ? 
        this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) : 0
    };
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const entries = Array.from(this.store.entries());
    let totalSize = 0;
    let largestEntry = 0;
    
    entries.forEach(([key, entry]) => {
      const entrySize = this._calculateSize(entry);
      totalSize += entrySize;
      if (entrySize > largestEntry) {
        largestEntry = entrySize;
      }
    });

    return {
      totalEntries: entries.length,
      totalSizeBytes: totalSize,
      averageSizeBytes: entries.length > 0 ? totalSize / entries.length : 0,
      largestEntryBytes: largestEntry,
      estimatedOverheadBytes: entries.length * 100 // Rough estimate for Map overhead
    };
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory() {
    const startSize = this.store.size;
    const startMemory = this.getMemoryUsage().totalSizeBytes;

    // Remove expired entries (if TTL was implemented)
    // For now, just trim to max size
    if (this.store.size > this.config.maxSize) {
      await this._evictOldestEntries();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const endSize = this.store.size;
    const endMemory = this.getMemoryUsage().totalSizeBytes;

    return {
      entriesRemoved: startSize - endSize,
      memoryFreed: startMemory - endMemory,
      currentEntries: endSize,
      currentMemoryBytes: endMemory
    };
  }

  /**
   * Shutdown storage
   */
  async shutdown() {
    await this.clear();
    this.logger.info('Memory storage shutdown completed');
  }

  // Private methods

  _calculateSize(data) {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 1000; // Fallback estimate
    }
  }

  async _evictOldestEntries() {
    const entries = Array.from(this.store.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.store.delete(key);
      this.metadata.delete(key);
    }

    this.logger.debug(`Evicted ${toRemove} oldest entries`);
  }
}

export default MemoryStorage;