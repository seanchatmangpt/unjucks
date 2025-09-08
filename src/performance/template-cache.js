/**
 * Template Cache System
 * High-performance template caching and generation optimization
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

class TemplateCache {
  constructor() {
    this.cache = new Map();
    this.stats = new Map();
    this.options = {
      maxSize: 100, // Maximum cached templates
      ttl: 300000,  // 5 minutes TTL
      compressionThreshold: 1024, // Compress templates > 1KB
      enableStats: true
    };
  }

  /**
   * Generate cache key from template path and context
   */
  generateKey(templatePath, context = {}) {
    const contextHash = createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return `${templatePath}:${contextHash}`;
  }

  /**
   * Get cached template or load and cache it
   */
  async getTemplate(templatePath, context = {}) {
    const key = this.generateKey(templatePath, context);
    const start = performance.now();
    
    try {
      // Check cache first
      const cached = this.cache.get(key);
      if (cached && this.isValidCache(cached)) {
        this.recordStats(key, 'hit', performance.now() - start);
        return cached.content;
      }

      // Load and cache template
      const content = await this.loadTemplate(templatePath);
      const cacheEntry = {
        content,
        timestamp: Date.now(),
        path: templatePath,
        size: Buffer.byteLength(content, 'utf8'),
        accessed: 1
      };

      this.cache.set(key, cacheEntry);
      this.evictIfNecessary();
      
      this.recordStats(key, 'miss', performance.now() - start);
      return content;

    } catch (error) {
      this.recordStats(key, 'error', performance.now() - start);
      throw new Error(`Template cache error for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Load template from filesystem with error handling
   */
  async loadTemplate(templatePath) {
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    try {
      const content = readFileSync(templatePath, 'utf-8');
      
      // Validate template content
      if (!content.trim()) {
        throw new Error(`Template is empty: ${templatePath}`);
      }

      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template file not found: ${templatePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied reading template: ${templatePath}`);
      }
      throw error;
    }
  }

  /**
   * Check if cached entry is still valid
   */
  isValidCache(cached) {
    const now = Date.now();
    const expired = (now - cached.timestamp) > this.options.ttl;
    
    if (expired) {
      return false;
    }

    // Check file modification time if available
    try {
      const stat = statSync(cached.path);
      const fileModified = stat.mtime.getTime() > cached.timestamp;
      return !fileModified;
    } catch (error) {
      // If we can't stat the file, assume cache is invalid
      return false;
    }
  }

  /**
   * Evict oldest entries if cache is full
   */
  evictIfNecessary() {
    if (this.cache.size <= this.options.maxSize) {
      return;
    }

    // Sort by last accessed time and remove oldest
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.options.maxSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  /**
   * Record cache statistics
   */
  recordStats(key, type, duration) {
    if (!this.options.enableStats) return;

    const stats = this.stats.get(key) || {
      hits: 0,
      misses: 0,
      errors: 0,
      totalTime: 0,
      averageTime: 0
    };

    stats[type === 'hit' ? 'hits' : type === 'miss' ? 'misses' : 'errors']++;
    stats.totalTime += duration;
    stats.averageTime = stats.totalTime / (stats.hits + stats.misses + stats.errors);

    this.stats.set(key, stats);
  }

  /**
   * Preload frequently used templates
   */
  async preloadTemplates(templatePaths) {
    const preloadPromises = templatePaths.map(async (path) => {
      try {
        await this.getTemplate(path);
        return { path, success: true };
      } catch (error) {
        return { path, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(preloadPromises);
    return results.map(result => result.value || { success: false, error: result.reason });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalEntries = this.cache.size;
    const totalHits = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.hits, 0);
    const totalMisses = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.misses, 0);
    const totalErrors = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.errors, 0);
    
    const hitRate = totalHits / (totalHits + totalMisses) || 0;
    const averageTime = Array.from(this.stats.values())
      .reduce((sum, stats) => sum + stats.averageTime, 0) / this.stats.size || 0;

    return {
      totalEntries,
      totalHits,
      totalMisses,
      totalErrors,
      hitRate: `${(hitRate * 100).toFixed(2)}%`,
      averageTime: `${averageTime.toFixed(2)}ms`,
      cacheSize: this.getCacheSize()
    };
  }

  /**
   * Calculate total cache size in bytes
   */
  getCacheSize() {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
    }
    return `${(totalSize / 1024).toFixed(2)}KB`;
  }

  /**
   * Clear cache entries
   */
  clear(pattern) {
    if (!pattern) {
      this.cache.clear();
      this.stats.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.path)) {
        this.cache.delete(key);
        this.stats.delete(key);
      }
    }
  }

  /**
   * Invalidate specific template
   */
  invalidate(templatePath) {
    const keysToDelete = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.path === templatePath) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.stats.delete(key);
    });
  }

  /**
   * Set cache options
   */
  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
}

// Global template cache instance
export const templateCache = new TemplateCache();

// Preload common templates on startup
const commonTemplates = [
  '_templates/component/new/component.js.ejs',
  '_templates/api/new/endpoint.js.ejs',
  '_templates/database/new/migration.sql.ejs'
];

// Async preload without blocking
templateCache.preloadTemplates(commonTemplates.map(t => join(process.cwd(), t)))
  .catch(error => {
    // Silent fail for preloading - not critical
    console.warn('Template preload warning:', error.message);
  });

export default TemplateCache;