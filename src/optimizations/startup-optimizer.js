/**
 * CLI Startup Optimizer
 * Agent DELTA-12: Reduces CLI initialization time through lazy loading
 */

import consola from 'consola';
import { performance } from 'perf_hooks';

export class StartupOptimizer {
  constructor(config = {}) {
    this.config = {
      enableLazyLoading: config.enableLazyLoading !== false,
      enableModuleCaching: config.enableModuleCaching !== false,
      enablePreloading: config.enablePreloading || false,
      measureStartupTime: config.measureStartupTime || false,
      ...config
    };

    this.logger = consola.withTag('startup-optimizer');
    this.moduleCache = new Map();
    this.loadTimes = new Map();
    this.startupTime = performance.now();
  }

  /**
   * Lazy load module with caching
   */
  async lazyLoad(modulePath, exportName = null) {
    const cacheKey = `${modulePath}${exportName ? `:${exportName}` : ''}`;
    
    if (this.config.enableModuleCaching && this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey);
    }

    const loadStart = performance.now();
    
    try {
      const module = await import(modulePath);
      const result = exportName ? module[exportName] : module;
      const loadTime = performance.now() - loadStart;
      
      if (this.config.measureStartupTime) {
        this.loadTimes.set(cacheKey, loadTime);
      }
      
      if (this.config.enableModuleCaching) {
        this.moduleCache.set(cacheKey, result);
      }
      
      this.logger.debug(`Loaded ${modulePath} in ${loadTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to load ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Lazy load multiple modules concurrently
   */
  async lazyLoadBatch(moduleSpecs) {
    const loadPromises = moduleSpecs.map(spec => {
      if (typeof spec === 'string') {
        return this.lazyLoad(spec);
      } else {
        return this.lazyLoad(spec.path, spec.export);
      }
    });

    return Promise.all(loadPromises);
  }

  /**
   * Preload critical modules for faster access
   */
  async preloadCriticalModules() {
    if (!this.config.enablePreloading) {
      return;
    }

    const criticalModules = [
      'consola',
      'n3',
      'nunjucks',
      { path: '../kgen/provenance/tracker.js', export: 'ProvenanceTracker' }
    ];

    this.logger.info('Preloading critical modules...');
    const preloadStart = performance.now();
    
    await this.lazyLoadBatch(criticalModules);
    
    const preloadTime = performance.now() - preloadStart;
    this.logger.success(`Preloaded ${criticalModules.length} modules in ${preloadTime.toFixed(2)}ms`);
  }

  /**
   * Create lazy-loaded service factory
   */
  createLazyService(modulePath, exportName, initOptions = {}) {
    let serviceInstance = null;
    let loadPromise = null;

    return {
      async getInstance() {
        if (serviceInstance) {
          return serviceInstance;
        }

        if (!loadPromise) {
          loadPromise = this._createServiceInstance(modulePath, exportName, initOptions);
        }

        serviceInstance = await loadPromise;
        return serviceInstance;
      },

      isLoaded() {
        return serviceInstance !== null;
      },

      getCacheKey() {
        return `${modulePath}:${exportName}`;
      }
    };
  }

  async _createServiceInstance(modulePath, exportName, initOptions) {
    const ServiceClass = await this.lazyLoad(modulePath, exportName);
    const instance = new ServiceClass(initOptions);
    
    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }
    
    return instance;
  }

  /**
   * Create optimized CLI initialization
   */
  createOptimizedInit() {
    const services = new Map();
    
    return {
      // Register lazy services
      registerService(name, modulePath, exportName, options = {}) {
        services.set(name, this.createLazyService(modulePath, exportName, options));
      },

      // Get service instance (loads on first access)
      async getService(name) {
        const lazyService = services.get(name);
        if (!lazyService) {
          throw new Error(`Service ${name} not registered`);
        }
        return await lazyService.getInstance();
      },

      // Check if service is loaded
      isServiceLoaded(name) {
        const lazyService = services.get(name);
        return lazyService ? lazyService.isLoaded() : false;
      },

      // Get all registered services
      getRegisteredServices() {
        return Array.from(services.keys());
      }
    };
  }

  /**
   * Measure and report startup performance
   */
  getStartupMetrics() {
    const currentTime = performance.now();
    const totalStartupTime = currentTime - this.startupTime;

    const metrics = {
      totalStartupTime,
      moduleLoadTimes: Object.fromEntries(this.loadTimes),
      modulesLoaded: this.moduleCache.size,
      cacheHits: 0, // Would need to track this
      recommendations: []
    };

    // Generate recommendations
    if (totalStartupTime > 100) {
      metrics.recommendations.push('Consider enabling preloading for critical modules');
    }

    const slowModules = Array.from(this.loadTimes.entries())
      .filter(([_, time]) => time > 50)
      .sort(([_, a], [__, b]) => b - a);

    if (slowModules.length > 0) {
      metrics.recommendations.push(`Slow modules detected: ${slowModules.map(([name]) => name).join(', ')}`);
    }

    return metrics;
  }

  /**
   * Create startup timer for profiling
   */
  createTimer(name) {
    const start = performance.now();
    
    return {
      end() {
        const duration = performance.now() - start;
        if (this.config.measureStartupTime) {
          this.loadTimes.set(`timer:${name}`, duration);
        }
        return duration;
      }
    };
  }

  /**
   * Clear module cache (useful for development)
   */
  clearCache() {
    this.moduleCache.clear();
    this.loadTimes.clear();
    this.logger.debug('Module cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.moduleCache.size,
      totalLoadTimes: Array.from(this.loadTimes.values()).reduce((a, b) => a + b, 0),
      averageLoadTime: this.loadTimes.size > 0 ? 
        Array.from(this.loadTimes.values()).reduce((a, b) => a + b, 0) / this.loadTimes.size : 0
    };
  }
}

/**
 * Global startup optimizer instance
 */
export const globalStartupOptimizer = new StartupOptimizer({
  enableLazyLoading: true,
  enableModuleCaching: true,
  measureStartupTime: process.env.NODE_ENV !== 'production'
});

/**
 * Decorator for lazy loading methods
 */
export function lazyLoad(modulePath, exportName) {
  return function(target, propertyName, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const module = await globalStartupOptimizer.lazyLoad(modulePath, exportName);
      return originalMethod.call(this, module, ...args);
    };
    
    return descriptor;
  };
}

/**
 * Utility function for creating CLI with optimized startup
 */
export function createOptimizedCLI(config = {}) {
  const optimizer = new StartupOptimizer(config);
  const init = optimizer.createOptimizedInit();
  
  return {
    optimizer,
    
    // Register common KGEN services
    async setupKGenServices() {
      init.registerService('provenance', '../kgen/provenance/tracker.js', 'ProvenanceTracker', {
        enableBlockchainIntegrity: false,
        storageBackend: 'memory'
      });
      
      init.registerService('blockchain', '../kgen/provenance/blockchain/anchor.js', 'BlockchainAnchor', {
        enableDigitalSignatures: false
      });
      
      init.registerService('compliance', '../kgen/provenance/compliance/logger.js', 'ComplianceLogger');
      
      init.registerService('storage', '../kgen/provenance/storage/index.js', 'ProvenanceStorage');
      
      await optimizer.preloadCriticalModules();
    },
    
    // Get service with lazy loading
    async getService(name) {
      return await init.getService(name);
    },
    
    // Get startup metrics
    getMetrics() {
      return optimizer.getStartupMetrics();
    },
    
    // Create performance timer
    timer(name) {
      return optimizer.createTimer(name);
    }
  };
}

export default StartupOptimizer;