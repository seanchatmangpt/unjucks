/**
 * Dependency Optimizer
 * Lazy loading and bundle optimization for CLI dependencies
 */

import { performance } from 'perf_hooks';

class DependencyOptimizer {
  constructor() {
    this.loadedModules = new Map();
    this.loadTimes = new Map();
    this.pendingImports = new Map();
    
    // Module priorities for loading order
    this.priorities = {
      critical: ['citty', 'chalk'],
      important: ['fs-extra', 'path'],
      optional: ['n3', 'nunjucks', 'inquirer', 'glob', 'yaml', 'gray-matter']
    };
  }

  /**
   * Lazy import with caching and performance tracking
   */
  async lazyImport(moduleName, importPath) {
    // Return cached module immediately
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    // Check if import is already pending
    if (this.pendingImports.has(moduleName)) {
      return this.pendingImports.get(moduleName);
    }

    const start = performance.now();
    
    // Create import promise and cache it
    const importPromise = this.performImport(moduleName, importPath);
    this.pendingImports.set(moduleName, importPromise);

    try {
      const module = await importPromise;
      const loadTime = performance.now() - start;
      
      // Cache the loaded module
      this.loadedModules.set(moduleName, module);
      this.loadTimes.set(moduleName, loadTime);
      this.pendingImports.delete(moduleName);
      
      // Warn about slow imports
      if (loadTime > 100) {
        console.warn(`⚠️  Slow import: ${moduleName} (${loadTime.toFixed(2)}ms)`);
      }
      
      return module;
    } catch (error) {
      this.pendingImports.delete(moduleName);
      throw new Error(`Failed to import ${moduleName}: ${error.message}`);
    }
  }

  /**
   * Perform the actual module import
   */
  async performImport(moduleName, importPath) {
    try {
      // Handle different import types
      if (importPath) {
        return await import(importPath);
      }
      
      // Try dynamic import for npm modules
      return await import(moduleName);
    } catch (error) {
      // Fallback for CommonJS modules
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        return require(moduleName);
      } catch (fallbackError) {
        throw new Error(`Could not import ${moduleName}: ${error.message}`);
      }
    }
  }

  /**
   * Batch load critical dependencies in parallel
   */
  async preloadCritical() {
    const criticalImports = this.priorities.critical.map(moduleName => 
      this.lazyImport(moduleName)
    );

    try {
      const results = await Promise.allSettled(criticalImports);
      const failed = results.filter(r => r.status === 'rejected');
      
      if (failed.length > 0) {
        console.warn(`⚠️  Failed to preload ${failed.length} critical dependencies`);
      }
      
      return results;
    } catch (error) {
      console.error('Critical dependency preload failed:', error.message);
      throw error;
    }
  }

  /**
   * Create module factory for lazy loading
   */
  createModuleFactory(moduleName, importPath) {
    return () => this.lazyImport(moduleName, importPath);
  }

  /**
   * Get module with automatic lazy loading
   */
  async getModule(moduleName, importPath) {
    return this.lazyImport(moduleName, importPath);
  }

  /**
   * Check if module is loaded
   */
  isLoaded(moduleName) {
    return this.loadedModules.has(moduleName);
  }

  /**
   * Get loading statistics
   */
  getLoadingStats() {
    const stats = {
      totalLoaded: this.loadedModules.size,
      loadTimes: {},
      totalLoadTime: 0,
      averageLoadTime: 0,
      slowestModule: null,
      fastestModule: null
    };

    let maxTime = 0;
    let minTime = Infinity;
    let totalTime = 0;

    for (const [moduleName, loadTime] of this.loadTimes) {
      stats.loadTimes[moduleName] = `${loadTime.toFixed(2)}ms`;
      totalTime += loadTime;

      if (loadTime > maxTime) {
        maxTime = loadTime;
        stats.slowestModule = { name: moduleName, time: `${loadTime.toFixed(2)}ms` };
      }

      if (loadTime < minTime) {
        minTime = loadTime;
        stats.fastestModule = { name: moduleName, time: `${loadTime.toFixed(2)}ms` };
      }
    }

    stats.totalLoadTime = `${totalTime.toFixed(2)}ms`;
    stats.averageLoadTime = `${(totalTime / this.loadTimes.size || 0).toFixed(2)}ms`;

    return stats;
  }

  /**
   * Clear all cached modules (for testing)
   */
  clearCache() {
    this.loadedModules.clear();
    this.loadTimes.clear();
    this.pendingImports.clear();
  }

  /**
   * Get module loading recommendations
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    
    for (const [moduleName, loadTime] of this.loadTimes) {
      if (loadTime > 100) {
        recommendations.push({
          type: 'slow-import',
          module: moduleName,
          loadTime: `${loadTime.toFixed(2)}ms`,
          suggestion: 'Consider tree shaking or splitting into smaller chunks'
        });
      }
    }

    // Check for unused loaded modules
    const optionalModules = this.priorities.optional.filter(mod => 
      this.loadedModules.has(mod)
    );
    
    if (optionalModules.length > 3) {
      recommendations.push({
        type: 'memory-usage',
        issue: `${optionalModules.length} optional modules loaded`,
        suggestion: 'Implement more aggressive lazy loading'
      });
    }

    return recommendations;
  }
}

// Create optimized module loaders
export const dependencyOptimizer = new DependencyOptimizer();

// Pre-configured lazy loaders for common modules
export const lazyModules = {
  citty: () => dependencyOptimizer.getModule('citty'),
  chalk: () => dependencyOptimizer.getModule('chalk'),
  n3: () => dependencyOptimizer.getModule('n3'),
  nunjucks: () => dependencyOptimizer.getModule('nunjucks'),
  inquirer: () => dependencyOptimizer.getModule('inquirer'),
  glob: () => dependencyOptimizer.getModule('glob'),
  yaml: () => dependencyOptimizer.getModule('yaml'),
  'fs-extra': () => dependencyOptimizer.getModule('fs-extra'),
  'gray-matter': () => dependencyOptimizer.getModule('gray-matter')
};

/**
 * Convenience function for getting modules with fallbacks
 */
export async function getModule(moduleName, fallback = null) {
  try {
    return await dependencyOptimizer.getModule(moduleName);
  } catch (error) {
    if (fallback) {
      console.warn(`Using fallback for ${moduleName}: ${error.message}`);
      return fallback;
    }
    throw error;
  }
}

// Preload critical dependencies
dependencyOptimizer.preloadCritical().catch(error => {
  console.warn('Critical dependency preload warning:', error.message);
});

export default DependencyOptimizer;