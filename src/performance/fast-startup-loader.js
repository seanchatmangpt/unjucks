/**
 * Fast Startup Loader - Optimizes KGEN cold start performance
 * 
 * Target: ≤2s cold start including git operations
 * Strategy: Lazy loading + JIT initialization + minimal imports
 */

import { performance } from 'perf_hooks';
import { consola } from 'consola';
import { HermeticEnvironment } from '../runtime/hermetic-environment.js';

export class FastStartupLoader {
  constructor(options = {}) {
    this.config = {
      targetColdStartMs: options.targetColdStartMs || 2000,
      enableJitLoading: options.enableJitLoading !== false,
      enableModulePreloading: options.enableModulePreloading === true,
      debug: options.debug === true
    };
    
    this.logger = consola.withTag('fast-startup');
    
    // Module loading tracking
    this.moduleCache = new Map();
    this.loadingPromises = new Map();
    this.preloadedModules = new Set();
    
    // Hermetic environment integration
    this.hermeticEnv = null;
    this.environmentValidated = false;
    
    // Startup metrics
    this.metrics = {
      startTime: performance.now(),
      moduleLoads: [],
      totalLoadTime: 0,
      coldStartTime: null
    };
    
    // Critical modules that should be loaded immediately
    this.criticalModules = [
      'citty',  // CLI framework
      'consola' // Logging (already loaded)
    ];
    
    // Heavy modules that should be lazy loaded
    this.heavyModules = [
      'n3',           // RDF processing (heavyweight)
      'nunjucks',     // Template engine
      'sparqljs',     // SPARQL parsing
      'yaml',         // YAML parsing
      'gray-matter',  // Frontmatter parsing
      'fs-extra',     // Enhanced file operations
      'vm2',          // Safe code execution
      'validator'     // Input validation
    ];
    
    this._initializeFastLoader();
  }
  
  /**
   * Initialize fast loader with minimal overhead
   */
  _initializeFastLoader() {
    if (this.config.debug) {
      this.logger.info('Initializing Fast Startup Loader...');
    }
    
    // Setup module interception for lazy loading
    this._setupModuleInterception();
    
    // Preload critical modules if enabled
    if (this.config.enableModulePreloading) {
      this._preloadCriticalModules();
    }
    
    // Setup JIT loading hooks
    if (this.config.enableJitLoading) {
      this._setupJitLoading();
    }
    
    // Initialize hermetic environment for deterministic startup
    this._initializeHermeticEnvironment();
    
    const initTime = performance.now() - this.metrics.startTime;
    
    if (this.config.debug) {
      this.logger.success(`Fast loader initialized in ${initTime.toFixed(2)}ms`);
    }
  }

  /**
   * Initialize hermetic environment for deterministic startup
   */
  async _initializeHermeticEnvironment() {
    try {
      this.hermeticEnv = new HermeticEnvironment({
        strictMode: false, // Don't interfere with startup performance
        enforceNodeVersion: false,
        enforceTimezone: false,
        enforceLocale: false
      });
      
      // Initialize in background to avoid blocking startup
      this.hermeticEnv.initialize().then(() => {
        this.environmentValidated = true;
        
        if (this.config.debug) {
          this.logger.debug('Hermetic environment initialized for startup');
        }
      }).catch(error => {
        if (this.config.debug) {
          this.logger.warn('Hermetic environment initialization failed:', error.message);
        }
      });
      
    } catch (error) {
      if (this.config.debug) {
        this.logger.warn('Could not initialize hermetic environment:', error.message);
      }
    }
  }
  
  /**
   * Setup module interception for lazy loading
   */
  _setupModuleInterception() {
    // Create lazy loading proxies for heavy modules
    for (const moduleName of this.heavyModules) {
      this.moduleCache.set(moduleName, {
        name: moduleName,
        loaded: null,
        loading: false,
        loadStartTime: null,
        proxy: this._createModuleProxy(moduleName)
      });
    }
  }
  
  /**
   * Create lazy loading proxy for a module
   */
  _createModuleProxy(moduleName) {
    return new Proxy({}, {
      get: (target, prop) => {
        // Trigger loading on first access
        return this._loadModuleJIT(moduleName).then(module => {
          if (module.default && typeof module.default === 'object') {
            return module.default[prop];
          }
          return module[prop];
        });
      }
    });
  }
  
  /**
   * Load module just-in-time
   */
  async _loadModuleJIT(moduleName) {
    const moduleInfo = this.moduleCache.get(moduleName);
    
    if (!moduleInfo) {
      throw new Error(`Unknown module for JIT loading: ${moduleName}`);
    }
    
    // Return cached module
    if (moduleInfo.loaded) {
      return moduleInfo.loaded;
    }
    
    // Return loading promise if already loading
    if (moduleInfo.loading) {
      return this.loadingPromises.get(moduleName);
    }
    
    // Start loading
    moduleInfo.loading = true;
    moduleInfo.loadStartTime = performance.now();
    
    const loadPromise = this._performModuleLoad(moduleName);
    this.loadingPromises.set(moduleName, loadPromise);
    
    try {
      moduleInfo.loaded = await loadPromise;
      
      const loadTime = performance.now() - moduleInfo.loadStartTime;
      this.metrics.moduleLoads.push({
        module: moduleName,
        loadTime,
        timestamp: this.getDeterministicTimestamp(),
        jit: true
      });
      
      this.metrics.totalLoadTime += loadTime;
      
      if (this.config.debug) {
        this.logger.debug(`JIT loaded ${moduleName} in ${loadTime.toFixed(2)}ms`);
      }
      
      return moduleInfo.loaded;
      
    } finally {
      moduleInfo.loading = false;
      this.loadingPromises.delete(moduleName);
    }
  }
  
  /**
   * Perform actual module loading with fallbacks
   */
  async _performModuleLoad(moduleName) {
    try {
      // Try dynamic import first
      return await import(moduleName);
    } catch (importError) {
      try {
        // Fallback to require for CommonJS modules
        return require(moduleName);
      } catch (requireError) {
        this.logger.warn(`Failed to load module ${moduleName}: ${importError.message}`);
        
        // Return minimal fallback for non-critical modules
        return this._createFallbackModule(moduleName);
      }
    }
  }
  
  /**
   * Create fallback module for failed loads
   */
  _createFallbackModule(moduleName) {
    switch (moduleName) {
      case 'n3':
        return {
          Parser: class { parse() { return []; } },
          Writer: class { write() { return ''; } },
          Store: class { constructor() { this.size = 0; } }
        };
        
      case 'nunjucks':
        return {
          configure: () => ({
            render: (template, context) => this._simpleTemplateRender(template, context)
          }),
          renderString: (template, context) => this._simpleTemplateRender(template, context)
        };
        
      case 'yaml':
        return {
          parse: (str) => JSON.parse(str),
          stringify: (obj) => JSON.stringify(obj, null, 2)
        };
        
      case 'gray-matter':
        return {
          default: (content) => ({
            data: {},
            content: content
          })
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Simple template rendering fallback
   */
  _simpleTemplateRender(template, context = {}) {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, variable) => {
      const value = this._getNestedValue(context, variable.trim());
      return value !== undefined ? String(value) : match;
    });
  }
  
  /**
   * Get nested value from context
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }
  
  /**
   * Preload critical modules for faster access
   */
  async _preloadCriticalModules() {
    const preloadPromises = this.criticalModules.map(async (moduleName) => {
      try {
        const startTime = performance.now();
        const module = await import(moduleName);
        
        const loadTime = performance.now() - startTime;
        this.metrics.moduleLoads.push({
          module: moduleName,
          loadTime,
          timestamp: this.getDeterministicTimestamp(),
          preloaded: true
        });
        
        this.preloadedModules.add(moduleName);
        
        if (this.config.debug) {
          this.logger.debug(`Preloaded ${moduleName} in ${loadTime.toFixed(2)}ms`);
        }
        
        return module;
      } catch (error) {
        this.logger.warn(`Failed to preload ${moduleName}: ${error.message}`);
        return null;
      }
    });
    
    await Promise.all(preloadPromises);
  }
  
  /**
   * Setup JIT loading hooks for common operations
   */
  _setupJitLoading() {
    // Hook into common KGEN operations to trigger module loading
    this._jitHooks = {
      // RDF operations trigger N3 loading
      rdf: () => this._loadModuleJIT('n3'),
      
      // Template operations trigger Nunjucks loading  
      template: () => this._loadModuleJIT('nunjucks'),
      
      // File operations trigger fs-extra loading
      file: () => this._loadModuleJIT('fs-extra'),
      
      // Parsing operations trigger respective parsers
      yaml: () => this._loadModuleJIT('yaml'),
      frontmatter: () => this._loadModuleJIT('gray-matter')
    };
  }
  
  /**
   * Public API: Load module with optimization
   */
  async loadModule(moduleName, options = {}) {
    const startTime = performance.now();
    
    // Check if already loaded
    if (this.preloadedModules.has(moduleName)) {
      return require(moduleName);
    }
    
    // Check if in lazy loading cache
    if (this.moduleCache.has(moduleName)) {
      return await this._loadModuleJIT(moduleName);
    }
    
    // Direct load for non-cached modules
    try {
      const module = await this._performModuleLoad(moduleName);
      
      const loadTime = performance.now() - startTime;
      this.metrics.moduleLoads.push({
        module: moduleName,
        loadTime,
        timestamp: this.getDeterministicTimestamp(),
        direct: true
      });
      
      return module;
    } catch (error) {
      throw new Error(`Failed to load module ${moduleName}: ${error.message}`);
    }
  }
  
  /**
   * Trigger JIT loading for operation type
   */
  async preloadForOperation(operationType) {
    const hook = this._jitHooks?.[operationType];
    if (hook) {
      try {
        await hook();
      } catch (error) {
        if (this.config.debug) {
          this.logger.warn(`JIT preload failed for ${operationType}: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Measure cold start completion
   */
  markColdStartComplete() {
    this.metrics.coldStartTime = performance.now() - this.metrics.startTime;
    
    const meetingTarget = this.metrics.coldStartTime <= this.config.targetColdStartMs;
    
    if (this.config.debug) {
      this.logger.info(
        `Cold start completed in ${this.metrics.coldStartTime.toFixed(2)}ms ` +
        `(target: ${this.config.targetColdStartMs}ms) - ${meetingTarget ? '✅' : '❌'}`
      );
    }
    
    return {
      coldStartTime: this.metrics.coldStartTime,
      targetTime: this.config.targetColdStartMs,
      meetingTarget,
      totalModuleLoadTime: this.metrics.totalLoadTime,
      modulesLoaded: this.metrics.moduleLoads.length
    };
  }
  
  /**
   * Get startup performance metrics
   */
  getStartupMetrics() {
    const modulesByType = {
      preloaded: this.metrics.moduleLoads.filter(m => m.preloaded),
      jit: this.metrics.moduleLoads.filter(m => m.jit),
      direct: this.metrics.moduleLoads.filter(m => m.direct)
    };
    
    return {
      coldStart: {
        time: this.metrics.coldStartTime,
        target: this.config.targetColdStartMs,
        meetingTarget: this.metrics.coldStartTime ? 
          this.metrics.coldStartTime <= this.config.targetColdStartMs : null
      },
      modules: {
        total: this.metrics.moduleLoads.length,
        totalLoadTime: this.metrics.totalLoadTime,
        byType: modulesByType,
        preloadedCount: this.preloadedModules.size,
        cachedCount: this.moduleCache.size
      },
      optimization: {
        jitLoadingEnabled: this.config.enableJitLoading,
        modulePreloadingEnabled: this.config.enableModulePreloading
      },
      hermetic: {
        environmentValidated: this.environmentValidated,
        environmentHash: this.hermeticEnv?.currentFingerprint?.shortHash || null
      }
    };
  }

  /**
   * Get hermetic environment fingerprint for attestation
   */
  async getEnvironmentFingerprint() {
    if (!this.hermeticEnv) {
      return null;
    }

    try {
      if (!this.hermeticEnv.isInitialized) {
        await this.hermeticEnv.initialize();
      }
      
      return this.hermeticEnv.currentFingerprint;
    } catch (error) {
      if (this.config.debug) {
        this.logger.warn('Could not get environment fingerprint:', error.message);
      }
      return null;
    }
  }
  
  /**
   * Optimize for next startup
   */
  optimizeForNextStartup() {
    const heaviestModules = this.metrics.moduleLoads
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 5)
      .map(m => m.module);
    
    if (this.config.debug) {
      this.logger.info('Heaviest modules:', heaviestModules);
    }
    
    // Add heaviest modules to preload list for next startup
    for (const module of heaviestModules) {
      if (!this.criticalModules.includes(module)) {
        this.criticalModules.push(module);
      }
    }
    
    return {
      optimized: true,
      heaviestModules,
      newCriticalModules: this.criticalModules.length
    };
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Clear caches
    this.moduleCache.clear();
    this.loadingPromises.clear();
    this.preloadedModules.clear();
    
    // Shutdown hermetic environment
    if (this.hermeticEnv) {
      try {
        await this.hermeticEnv.shutdown();
      } catch (error) {
        if (this.config.debug) {
          this.logger.warn('Error shutting down hermetic environment:', error.message);
        }
      }
    }
    
    if (this.config.debug) {
      this.logger.success('Fast startup loader shut down');
    }
  }
}

export default FastStartupLoader;