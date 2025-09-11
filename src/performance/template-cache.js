/**
 * Template Cache System
 * High-performance template caching and generation optimization
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { TemplateCache as LRUTemplateCache } from '../src/kgen/cache/lru-cache.js';

class TemplateCache {
  constructor() {
    // Use standardized LRU cache with enhanced statistics
    this.cache = new LRUTemplateCache({
      maxSize: 100, // Maximum cached templates
      ttl: 300000,  // 5 minutes TTL
      enableStats: true
    });
    
    this.options = {
      compressionThreshold: 1024, // Compress templates > 1KB
      enableFileValidation: true
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
    const start = performance.now();
    
    try {
      // Check cache first using LRU cache
      const cached = this.cache.getCachedTemplate(templatePath, context);
      
      if (cached && this.isValidCache(cached)) {
        return cached.content;
      }

      // Load and cache template
      const content = await this.loadTemplate(templatePath);
      const fileStats = this.options.enableFileValidation ? 
        await this.getFileStats(templatePath) : null;
      
      // Cache using LRU cache with file validation
      this.cache.cacheTemplate(templatePath, content, context, fileStats);
      
      return content;

    } catch (error) {
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
    if (!cached || !this.options.enableFileValidation) {
      return !!cached;
    }

    // Check file modification time if file stats were cached
    if (cached.fileStats && cached.path) {
      try {
        const currentStats = statSync(cached.path);
        const fileModified = currentStats.mtime.getTime() > cached.fileStats.mtime.getTime();
        return !fileModified;
      } catch (error) {
        // If we can't stat the file, assume cache is invalid
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get file statistics for cache validation
   */
  async getFileStats(templatePath) {
    try {
      const stats = statSync(templatePath);
      return {
        mtime: stats.mtime,
        size: stats.size,
        ctime: stats.ctime
      };
    } catch (error) {
      return null;
    }
  }

  // Statistics are now handled by LRU cache

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
    const lruStats = this.cache.getStats();
    
    return {
      ...lruStats,
      hitRate: `${lruStats.hitRate.toFixed(2)}%`,
      memoryUsage: `${(lruStats.memoryUsage / 1024).toFixed(2)}KB`,
      options: this.options
    };
  }

  // Size calculation handled by LRU cache

  /**
   * Clear cache entries
   */
  clear(pattern) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // For pattern matching, need to check all cached entries
    // Since LRU cache doesn't expose internal structure, clear all for now
    // TODO: Enhance LRU cache to support pattern-based clearing
    this.cache.clear();
  }

  /**
   * Invalidate specific template
   */
  invalidate(templatePath) {
    // Since LRU cache doesn't expose internal structure for searching,
    // clear entire cache for now
    // TODO: Enhance LRU cache to support path-based invalidation
    this.cache.clear();
  }

  /**
   * Set cache options
   */
  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Note: LRU cache options (maxSize, ttl) cannot be changed after creation
    // This would require recreating the cache instance
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