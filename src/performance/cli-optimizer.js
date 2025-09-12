/**
 * CLI Performance Optimizer
 * Comprehensive startup and runtime performance optimizations
 */

import { performance } from 'perf_hooks';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CliOptimizer {
  constructor() {
    this.startTime = performance.now();
    this.metrics = {
      imports: new Map(),
      commands: new Map(),
      memory: [],
      cached: new Map()
    };
    
    // Lazy loading cache
    this.cache = new Map();
    this.moduleCache = new Map();
    
    this.initializeCache();
  }

  /**
   * Initialize performance cache
   */
  initializeCache() {
    // Cache frequently accessed data
    this.cache.set('version', this.getCachedVersion());
    this.cache.set('packageJson', this.getCachedPackageJson());
  }

  /**
   * Lazy load modules with performance tracking
   */
  async lazyImport(moduleName, importPath) {
    const key = `${moduleName}:${importPath}`;
    
    if (this.moduleCache.has(key)) {
      return this.moduleCache.get(key);
    }

    const start = performance.now();
    
    try {
      const module = await import(importPath);
      const loadTime = performance.now() - start;
      
      this.metrics.imports.set(moduleName, loadTime);
      this.moduleCache.set(key, module);
      
      if (loadTime > 50) {
        console.warn(`⚠️  Slow import detected: ${moduleName} (${loadTime.toFixed(2)}ms)`);
      }
      
      return module;
    } catch (error) {
      console.error(`❌ Failed to import ${moduleName}:`, error.message);
      throw error;
    }
  }

  /**
   * Memoized version getter
   */
  getCachedVersion() {
    if (this.cache.has('version-resolved')) {
      return this.cache.get('version-resolved');
    }

    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      const version = packageJson.version;
      
      this.cache.set('version-resolved', version);
      return version;
    } catch (error) {
      const fallback = '2025.9.08.1';
      this.cache.set('version-resolved', fallback);
      return fallback;
    }
  }

  /**
   * Cached package.json reader
   */
  getCachedPackageJson() {
    if (this.cache.has('package-resolved')) {
      return this.cache.get('package-resolved');
    }

    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      this.cache.set('package-resolved', packageJson);
      return packageJson;
    } catch (error) {
      console.error('❌ Failed to read package.json:', error.message);
      return {};
    }
  }

  /**
   * Optimize dependency loading with conditional imports
   */
  async optimizeImports() {
    const essentialModules = {
      citty: () => import('citty'),
      chalk: () => import('chalk')
    };

    const lazyModules = {
      n3: () => import('n3'),
      nunjucks: () => import('nunjucks'),
      inquirer: () => import('inquirer'),
      glob: () => import('glob')
    };

    // Load essential modules first
    const essentialPromises = Object.entries(essentialModules).map(async ([name, loader]) => {
      const start = performance.now();
      const module = await loader();
      this.metrics.imports.set(name, performance.now() - start);
      return { name, module };
    });

    const essential = await Promise.all(essentialPromises);
    
    // Store lazy loaders for later use
    this.lazyLoaders = lazyModules;
    
    return essential.reduce((acc, { name, module }) => {
      acc[name] = module;
      return acc;
    }, {});
  }

  /**
   * Memory usage monitoring
   */
  recordMemoryUsage(label) {
    const usage = process.memoryUsage();
    this.metrics.memory.push({
      label,
      timestamp: performance.now(),
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external
    });
  }

  /**
   * Command performance tracking
   */
  trackCommand(command, fn) {
    return async (...args) => {
      const start = performance.now();
      this.recordMemoryUsage(`${command}-start`);
      
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        
        this.metrics.commands.set(command, duration);
        this.recordMemoryUsage(`${command}-end`);
        
        if (duration > 100) {
          console.warn(`⚠️  Slow command: ${command} (${duration.toFixed(2)}ms)`);
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        this.metrics.commands.set(`${command}-error`, duration);
        throw error;
      }
    };
  }

  /**
   * Template caching system
   */
  async cacheTemplate(templatePath, templateName) {
    const key = `template:${templateName}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    try {
      const content = readFileSync(templatePath, 'utf-8');
      this.cache.set(key, content);
      return content;
    } catch (error) {
      console.error(`❌ Failed to cache template ${templateName}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const totalTime = performance.now() - this.startTime;
    const memoryPeak = Math.max(...this.metrics.memory.map(m => m.heapUsed));
    
    return {
      totalTime: `${totalTime.toFixed(2)}ms`,
      memoryPeak: `${(memoryPeak / 1024 / 1024).toFixed(2)}MB`,
      imports: Object.fromEntries(
        Array.from(this.metrics.imports.entries()).map(([name, time]) => [
          name,
          `${time.toFixed(2)}ms`
        ])
      ),
      commands: Object.fromEntries(
        Array.from(this.metrics.commands.entries()).map(([name, time]) => [
          name,
          `${time.toFixed(2)}ms`
        ])
      ),
      cacheHits: this.cache.size,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check slow imports
    for (const [module, time] of this.metrics.imports) {
      if (time > 50) {
        recommendations.push({
          type: 'import',
          issue: `Slow import: ${module} (${time.toFixed(2)}ms)`,
          solution: 'Consider lazy loading or tree shaking'
        });
      }
    }

    // Check slow commands
    for (const [command, time] of this.metrics.commands) {
      if (time > 100) {
        recommendations.push({
          type: 'command',
          issue: `Slow command: ${command} (${time.toFixed(2)}ms)`,
          solution: 'Optimize command logic or add caching'
        });
      }
    }

    // Check memory usage
    const memoryUsage = Math.max(...this.metrics.memory.map(m => m.heapUsed));
    if (memoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push({
        type: 'memory',
        issue: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        solution: 'Implement memory cleanup and object pooling'
      });
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.cache.clear();
    this.moduleCache.clear();
    this.metrics.imports.clear();
    this.metrics.commands.clear();
    this.metrics.memory = [];
  }
}

// Global optimizer instance
export const cliOptimizer = new CliOptimizer();

/**
 * Performance monitoring decorators
 */
export function monitor(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args) {
    return cliOptimizer.trackCommand(propertyKey, originalMethod.bind(this))(...args);
  };
  
  return descriptor;
}

/**
 * Memoization decorator
 */
export function memoize(ttl = 60000) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map();
    
    descriptor.value = function (...args) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      
      if (cached && this.getDeterministicTimestamp() - cached.timestamp < ttl) {
        return cached.value;
      }
      
      const result = originalMethod.apply(this, args);
      cache.set(key, { value: result, timestamp: this.getDeterministicTimestamp() });
      
      return result;
    };
    
    return descriptor;
  };
}

export default CliOptimizer;