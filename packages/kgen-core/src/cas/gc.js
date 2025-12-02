/**
 * Content-Addressed Storage (CAS) - Garbage Collection
 * 
 * Efficient garbage collection for unused content with configurable policies.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { CASStorage } from './storage.js';

/**
 * CAS Garbage Collection Engine
 */
export class CASGarbageCollector {
  constructor(options = {}) {
    this.storage = options.storage || new CASStorage(options);
    
    this.config = {
      // GC policies
      maxAge: options.maxAge || 30 * 24 * 60 * 60 * 1000, // 30 days
      maxStorageSize: options.maxStorageSize || 1024 * 1024 * 1024, // 1GB
      maxItems: options.maxItems || 10000,
      
      // Safety settings
      minRetentionPeriod: options.minRetentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      dryRun: options.dryRun || false,
      
      // Performance settings
      batchSize: options.batchSize || 100,
      concurrency: options.concurrency || 10,
      
      ...options
    };

    this.metrics = {
      lastRun: null,
      itemsScanned: 0,
      itemsRemoved: 0,
      bytesReclaimed: 0,
      duration: 0,
      errors: 0
    };
  }

  /**
   * Run garbage collection
   * @param {Object} options - GC run options
   * @returns {Promise<Object>} GC results
   */
  async run(options = {}) {
    const startTime = Date.now();
    const config = { ...this.config, ...options };
    
    console.log(`Starting CAS garbage collection ${config.dryRun ? '(DRY RUN)' : ''}`);

    try {
      await this.storage.initialize();

      // Get all stored items with metadata
      const items = await this._getAllItems();
      this.metrics.itemsScanned = items.length;

      if (items.length === 0) {
        return this._createResult(startTime, 'No items found for garbage collection');
      }

      // Apply GC policies to find candidates for removal
      const candidates = await this._findRemovalCandidates(items, config);

      if (candidates.length === 0) {
        return this._createResult(startTime, 'No items eligible for garbage collection');
      }

      console.log(`Found ${candidates.length} items eligible for removal`);

      // Remove candidates in batches
      const removedItems = config.dryRun 
        ? await this._dryRunRemoval(candidates)
        : await this._performRemoval(candidates, config);

      this.metrics.itemsRemoved = removedItems.length;
      this.metrics.bytesReclaimed = removedItems.reduce((sum, item) => sum + (item.size || 0), 0);
      this.metrics.lastRun = Date.now();

      return this._createResult(startTime, `Garbage collection completed successfully`);

    } catch (error) {
      this.metrics.errors++;
      throw new Error(`Garbage collection failed: ${error.message}`);
    }
  }

  /**
   * Get garbage collection statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStats() {
    await this.storage.initialize();

    const items = await this._getAllItems();
    const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
    
    // Calculate age distribution
    const now = Date.now();
    const ageGroups = {
      recent: 0,    // < 1 day
      medium: 0,    // 1-7 days
      old: 0,       // 7-30 days
      ancient: 0    // > 30 days
    };

    for (const item of items) {
      const age = now - item.lastAccessed;
      if (age < 24 * 60 * 60 * 1000) ageGroups.recent++;
      else if (age < 7 * 24 * 60 * 60 * 1000) ageGroups.medium++;
      else if (age < 30 * 24 * 60 * 60 * 1000) ageGroups.old++;
      else ageGroups.ancient++;
    }

    return {
      totalItems: items.length,
      totalSize,
      ageDistribution: ageGroups,
      averageSize: items.length > 0 ? Math.round(totalSize / items.length) : 0,
      oldestItem: items.length > 0 ? Math.min(...items.map(i => i.lastAccessed)) : null,
      newestItem: items.length > 0 ? Math.max(...items.map(i => i.lastAccessed)) : null,
      lastGC: this.metrics.lastRun,
      metrics: this.metrics
    };
  }

  /**
   * Perform targeted cleanup of specific items
   * @param {string[]} hashes - Specific hashes to remove
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup(hashes, options = {}) {
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    if (!Array.isArray(hashes) || hashes.length === 0) {
      throw new Error('Must provide array of hashes to cleanup');
    }

    console.log(`Cleaning up ${hashes.length} specific items ${config.dryRun ? '(DRY RUN)' : ''}`);

    const items = [];
    for (const hash of hashes) {
      const metadata = await this._getItemMetadata(hash);
      if (metadata) {
        items.push({ hash, ...metadata });
      }
    }

    if (items.length === 0) {
      return this._createResult(startTime, 'No valid items found for cleanup');
    }

    const removedItems = config.dryRun 
      ? await this._dryRunRemoval(items)
      : await this._performRemoval(items, config);

    this.metrics.itemsRemoved += removedItems.length;
    this.metrics.bytesReclaimed += removedItems.reduce((sum, item) => sum + (item.size || 0), 0);

    return this._createResult(startTime, `Cleanup completed for ${removedItems.length} items`);
  }

  /**
   * Mark items as recently accessed to prevent GC
   * @param {string[]} hashes - Hashes to mark as accessed
   * @returns {Promise<number>} Number of items marked
   */
  async markAccessed(hashes) {
    let marked = 0;
    
    for (const hash of hashes) {
      // Retrieve content to mark as accessed in cache
      const content = await this.storage.retrieve(hash);
      if (content) {
        marked++;
      }
    }

    return marked;
  }

  /**
   * Get current memory cache usage that could be GC'd
   * @returns {Object} Cache usage info
   */
  getCacheUsage() {
    const metrics = this.storage.getMetrics();
    
    return {
      cacheSize: metrics.cacheSize,
      maxCacheSize: metrics.maxCacheSize,
      cacheUtilization: metrics.maxCacheSize > 0 
        ? Math.round((metrics.cacheSize / metrics.maxCacheSize) * 100)
        : 0,
      canClearCache: metrics.cacheSize > 0
    };
  }

  /**
   * Clear memory cache to free up memory
   * @returns {Promise<Object>} Clear results
   */
  async clearCache() {
    const beforeSize = this.storage.cache.size;
    await this.storage.clear(false); // Don't clear files, just memory
    const afterSize = this.storage.cache.size;

    return {
      itemsCleared: beforeSize - afterSize,
      beforeSize,
      afterSize
    };
  }

  // Private methods

  /**
   * Get all items with metadata
   */
  async _getAllItems() {
    const hashes = await this.storage.list();
    const items = [];

    for (const hash of hashes) {
      const metadata = await this._getItemMetadata(hash);
      if (metadata) {
        items.push({ hash, ...metadata });
      }
    }

    return items;
  }

  /**
   * Get metadata for a single item
   */
  async _getItemMetadata(hash) {
    try {
      const exists = await this.storage.exists(hash);
      if (!exists) return null;

      let size = 0;
      let lastAccessed = Date.now();

      // Try to get file stats if using file storage
      if (this.storage.config.enableFileStorage) {
        try {
          const filePath = this.storage._getFilePath(hash);
          const stats = await fs.stat(filePath);
          size = stats.size;
          lastAccessed = Math.max(stats.atime.getTime(), stats.mtime.getTime());
        } catch (error) {
          // File might not exist or be accessible
        }
      }

      return {
        size,
        lastAccessed,
        exists: true
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find items eligible for removal based on policies
   */
  async _findRemovalCandidates(items, config) {
    const now = Date.now();
    const candidates = [];

    // Sort by last accessed time (oldest first)
    const sortedItems = items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const item of sortedItems) {
      const age = now - item.lastAccessed;
      let shouldRemove = false;
      let reason = '';

      // Age-based removal
      if (age > config.maxAge && age > config.minRetentionPeriod) {
        shouldRemove = true;
        reason = `Exceeds max age (${Math.round(age / (24 * 60 * 60 * 1000))} days)`;
      }

      // Size-based removal (remove oldest if over limit)
      const totalSize = sortedItems.reduce((sum, i) => sum + (i.size || 0), 0);
      if (totalSize > config.maxStorageSize && age > config.minRetentionPeriod) {
        shouldRemove = true;
        reason = reason || 'Storage size limit exceeded';
      }

      // Count-based removal (remove oldest if over limit)
      if (items.length > config.maxItems && age > config.minRetentionPeriod) {
        shouldRemove = true;
        reason = reason || 'Item count limit exceeded';
      }

      if (shouldRemove) {
        candidates.push({ ...item, reason });
      }
    }

    return candidates;
  }

  /**
   * Perform dry run removal (just log what would be removed)
   */
  async _dryRunRemoval(candidates) {
    console.log('DRY RUN - Items that would be removed:');
    
    for (const item of candidates) {
      const ageInDays = Math.round((Date.now() - item.lastAccessed) / (24 * 60 * 60 * 1000));
      console.log(`  - ${item.hash.substring(0, 12)}... (${item.size || 0} bytes, ${ageInDays} days old) - ${item.reason}`);
    }

    return candidates; // Return as if removed for metrics
  }

  /**
   * Actually remove the candidate items
   */
  async _performRemoval(candidates, config) {
    const removed = [];
    const batchSize = config.batchSize;

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            // Remove from file storage
            if (this.storage.config.enableFileStorage) {
              const filePath = this.storage._getFilePath(item.hash);
              await fs.unlink(filePath);
            }

            // Remove from memory cache
            if (this.storage.cache.has(item.hash)) {
              this.storage.cache.delete(item.hash);
              this.storage.cacheAccess.delete(item.hash);
            }

            return item;
          } catch (error) {
            console.warn(`Failed to remove ${item.hash}: ${error.message}`);
            this.metrics.errors++;
            return null;
          }
        })
      );

      // Collect successfully removed items
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          removed.push(result.value);
        }
      }
    }

    console.log(`Successfully removed ${removed.length} items`);
    return removed;
  }

  /**
   * Create standardized result object
   */
  _createResult(startTime, message) {
    this.metrics.duration = Date.now() - startTime;
    
    return {
      success: true,
      message,
      duration: this.metrics.duration,
      itemsScanned: this.metrics.itemsScanned,
      itemsRemoved: this.metrics.itemsRemoved,
      bytesReclaimed: this.metrics.bytesReclaimed,
      errors: this.metrics.errors,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const casGC = new CASGarbageCollector();

export default CASGarbageCollector;