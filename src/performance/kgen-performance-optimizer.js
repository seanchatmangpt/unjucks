/**
 * KGEN Performance Optimizer - Agent 9 Implementation
 * 
 * Optimizes KGEN to meet Charter requirements:
 * - p95 render ≤150ms on dev laptops  
 * - Cold start ≤2s including git operations
 * - ≥80% cache hit rate
 * - Performance telemetry integration
 */

import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import EventEmitter from 'events';
import { consola } from 'consola';
import os from 'os';

export class KGenPerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Performance targets from Charter
      targetP95RenderMs: options.targetP95RenderMs || 150,
      targetColdStartMs: options.targetColdStartMs || 2000,
      targetCacheHitRate: options.targetCacheHitRate || 0.8,
      
      // Optimization settings
      enableLazyLoading: options.enableLazyLoading !== false,
      enableMemoryPooling: options.enableMemoryPooling !== false,
      enableWorkerThreads: options.enableWorkerThreads !== false,
      enableProfiling: options.enableProfiling === true,
      
      // Resource limits
      maxConcurrentTasks: options.maxConcurrentTasks || Math.max(2, os.cpus().length - 1),
      memoryPoolSizeMB: options.memoryPoolSizeMB || 64,
      cacheMaxSizeMB: options.cacheMaxSizeMB || 256,
      
      debug: options.debug === true
    };
    
    this.logger = consola.withTag('kgen-perf');
    
    // Performance metrics
    this.metrics = {
      renders: [],
      cacheHits: 0,
      cacheMisses: 0,
      startupTime: null,
      memoryUsage: [],
      workerTasks: 0,
      lastCleanup: this.getDeterministicTimestamp()
    };
    
    // Lazy-loaded modules cache
    this.lazyModules = new Map();
    
    // Memory pools for common operations
    this.memoryPools = {
      buffers: [],
      objects: [],
      strings: []
    };
    
    // Worker thread pool for heavy operations
    this.workerPool = [];
    this.activeWorkers = 0;
    
    // Performance monitoring
    this.performanceObserver = null;
    
    this._initializeOptimizer();
  }
  
  /**
   * Initialize optimizer with lazy loading and memory pools
   */
  _initializeOptimizer() {
    const startTime = performance.now();
    
    if (this.config.debug) {
      this.logger.info('Initializing KGEN Performance Optimizer...');
    }
    
    // Setup lazy loading registry
    this._setupLazyLoading();
    
    // Initialize memory pools
    if (this.config.enableMemoryPooling) {
      this._initializeMemoryPools();
    }
    
    // Setup worker thread pool
    if (this.config.enableWorkerThreads) {
      this._initializeWorkerPool();
    }
    
    // Setup performance monitoring
    if (this.config.enableProfiling) {
      this._setupPerformanceMonitoring();
    }
    
    // Periodic cleanup
    this._setupPeriodicCleanup();
    
    this.metrics.startupTime = performance.now() - startTime;
    
    if (this.config.debug) {
      this.logger.success(`Optimizer initialized in ${this.metrics.startupTime.toFixed(2)}ms`);
    }
  }
  
  /**
   * Setup lazy loading for heavy dependencies
   */
  _setupLazyLoading() {
    const lazyModules = {
      'n3': () => import('n3'),
      'nunjucks': () => import('nunjucks'), 
      'sparqljs': () => import('sparqljs'),
      'yaml': () => import('yaml'),
      'gray-matter': () => import('gray-matter'),
      'fs-extra': () => import('fs-extra')
    };
    
    for (const [name, loader] of Object.entries(lazyModules)) {
      this.lazyModules.set(name, {
        loader,
        loaded: null,
        loading: false
      });
    }
  }
  
  /**
   * Lazy load module with caching
   */
  async loadModule(moduleName) {
    const moduleInfo = this.lazyModules.get(moduleName);
    
    if (!moduleInfo) {
      throw new Error(`Unknown lazy module: ${moduleName}`);
    }
    
    // Return cached module
    if (moduleInfo.loaded) {
      return moduleInfo.loaded;
    }
    
    // Wait if already loading
    if (moduleInfo.loading) {
      while (moduleInfo.loading) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      return moduleInfo.loaded;
    }
    
    // Load module
    moduleInfo.loading = true;
    const startTime = performance.now();
    
    try {
      moduleInfo.loaded = await moduleInfo.loader();
      const loadTime = performance.now() - startTime;
      
      if (this.config.debug) {
        this.logger.debug(`Lazy loaded ${moduleName} in ${loadTime.toFixed(2)}ms`);
      }
      
      return moduleInfo.loaded;
    } finally {
      moduleInfo.loading = false;
    }
  }
  
  /**
   * Initialize memory pools for common operations
   */
  _initializeMemoryPools() {
    const poolSizeBytes = this.config.memoryPoolSizeMB * 1024 * 1024;
    
    // Pre-allocate buffer pool
    for (let i = 0; i < 10; i++) {
      this.memoryPools.buffers.push(Buffer.allocUnsafe(poolSizeBytes / 10));
    }
    
    // Pre-allocate object pool
    for (let i = 0; i < 100; i++) {
      this.memoryPools.objects.push({});
    }
    
    // Pre-allocate string arrays
    for (let i = 0; i < 50; i++) {
      this.memoryPools.strings.push([]);
    }
    
    if (this.config.debug) {
      this.logger.debug(`Memory pools initialized: ${poolSizeBytes / 1024 / 1024}MB`);
    }
  }
  
  /**
   * Get pooled buffer for operations
   */
  getPooledBuffer(size) {
    const availableBuffer = this.memoryPools.buffers.find(buf => 
      buf.length >= size && !buf._inUse
    );
    
    if (availableBuffer) {
      availableBuffer._inUse = true;
      return availableBuffer.subarray(0, size);
    }
    
    // Fallback to new allocation
    return Buffer.allocUnsafe(size);
  }
  
  /**
   * Return buffer to pool
   */
  returnPooledBuffer(buffer) {
    if (buffer._inUse) {
      buffer._inUse = false;
      buffer.fill(0); // Clear for security
    }
  }
  
  /**
   * Initialize worker thread pool for CPU-intensive tasks
   */
  _initializeWorkerPool() {
    // Pre-spawn workers for RDF processing
    const workerScript = `
      const { parentPort } = require('worker_threads');
      
      parentPort.on('message', async ({ task, data }) => {
        try {
          let result;
          
          switch (task) {
            case 'rdf-parse':
              // Fast RDF parsing without full N3 overhead
              result = await parseRDFFast(data);
              break;
            case 'template-compile':
              // Template compilation without full Nunjucks overhead
              result = await compileTemplateFast(data);
              break;
            case 'hash-compute':
              // Crypto hashing in worker
              result = await computeHashFast(data);
              break;
            default:
              throw new Error('Unknown task: ' + task);
          }
          
          parentPort.postMessage({ success: true, result });
        } catch (error) {
          parentPort.postMessage({ success: false, error: error.message });
        }
      });
      
      async function parseRDFFast(content) {
        // Minimal RDF parsing for performance
        const lines = content.split('\\n').filter(line => 
          line.trim() && !line.startsWith('#')
        );
        
        const triples = [];
        for (const line of lines) {
          const match = line.match(/^\\s*(<[^>]+>|\\w+:\\w+)\\s+(<[^>]+>|\\w+:\\w+)\\s+(.+?)\\s*\\.?\\s*$/);
          if (match) {
            triples.push({
              subject: match[1],
              predicate: match[2], 
              object: match[3]
            });
          }
        }
        
        return { triples, count: triples.length };
      }
      
      async function compileTemplateFast(template) {
        // Fast template compilation without full Nunjucks
        const variables = [];
        const regex = /\\{\\{\\s*([a-zA-Z_][a-zA-Z0-9_.]*)\\s*\\}\\}/g;
        let match;
        
        while ((match = regex.exec(template)) !== null) {
          variables.push(match[1]);
        }
        
        return { 
          compiled: true, 
          variables: [...new Set(variables)],
          hash: require('crypto').createHash('sha256').update(template).digest('hex')
        };
      }
      
      async function computeHashFast(data) {
        const crypto = require('crypto');
        return {
          hash: crypto.createHash('sha256').update(data).digest('hex'),
          algorithm: 'sha256'
        };
      }
    `;
    
    // Don't actually create workers during initialization to keep cold start fast
    // Workers will be created on-demand
    this.workerPool = [];
    
    if (this.config.debug) {
      this.logger.debug(`Worker pool prepared (on-demand spawning)`);
    }
  }
  
  /**
   * Execute task in worker thread for CPU-intensive operations
   */
  async executeInWorker(task, data, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      // For startup performance, skip workers for small tasks
      if (typeof data === 'string' && data.length < 1000) {
        // Execute inline for small tasks to avoid worker overhead
        this._executeInlineTask(task, data).then(resolve).catch(reject);
        return;
      }
      
      let worker;
      
      // Reuse available worker or create new one
      if (this.workerPool.length > 0) {
        worker = this.workerPool.pop();
      } else if (this.activeWorkers < this.config.maxConcurrentTasks) {
        worker = new Worker(eval(`\`${workerScript}\``), { eval: true });
        this.activeWorkers++;
      } else {
        // Queue limit reached, execute inline
        this._executeInlineTask(task, data).then(resolve).catch(reject);
        return;
      }
      
      const timeout = setTimeout(() => {
        worker.terminate();
        this.activeWorkers--;
        reject(new Error(`Worker task ${task} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      worker.once('message', (result) => {
        clearTimeout(timeout);
        
        // Return worker to pool
        this.workerPool.push(worker);
        
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error));
        }
      });
      
      worker.once('error', (error) => {
        clearTimeout(timeout);
        worker.terminate();
        this.activeWorkers--;
        reject(error);
      });
      
      worker.postMessage({ task, data });
      this.metrics.workerTasks++;
    });
  }
  
  /**
   * Execute task inline for small operations
   */
  async _executeInlineTask(task, data) {
    switch (task) {
      case 'rdf-parse':
        return this._parseRDFInline(data);
      case 'template-compile':
        return this._compileTemplateInline(data);
      case 'hash-compute':
        return this._computeHashInline(data);
      default:
        throw new Error(`Unknown inline task: ${task}`);
    }
  }
  
  /**
   * Fast inline RDF parsing for small graphs
   */
  _parseRDFInline(content) {
    const lines = content.split('\n').filter(line => 
      line.trim() && !line.startsWith('#')
    );
    
    const triples = [];
    const subjectSet = new Set();
    const predicateSet = new Set();
    const objectSet = new Set();
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const subject = parts[0];
        const predicate = parts[1];
        const object = parts.slice(2).join(' ').replace(/\s*\.\s*$/, '');
        
        triples.push({ subject, predicate, object });
        subjectSet.add(subject);
        predicateSet.add(predicate);
        objectSet.add(object);
      }
    }
    
    return {
      triples,
      count: triples.length,
      subjects: Array.from(subjectSet),
      predicates: Array.from(predicateSet),
      objects: Array.from(objectSet)
    };
  }
  
  /**
   * Fast inline template compilation
   */
  _compileTemplateInline(template) {
    const variables = new Set();
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    const crypto = require('crypto');
    return {
      compiled: true,
      variables: Array.from(variables),
      hash: crypto.createHash('sha256').update(template).digest('hex')
    };
  }
  
  /**
   * Fast inline hash computation
   */
  _computeHashInline(data) {
    const crypto = require('crypto');
    return {
      hash: crypto.createHash('sha256').update(data).digest('hex'),
      algorithm: 'sha256'
    };
  }
  
  /**
   * Setup performance monitoring and telemetry
   */
  _setupPerformanceMonitoring() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.startsWith('kgen-')) {
            this.metrics.renders.push({
              name: entry.name,
              duration: entry.duration,
              timestamp: entry.startTime
            });
            
            // Keep only recent metrics
            if (this.metrics.renders.length > 1000) {
              this.metrics.renders = this.metrics.renders.slice(-500);
            }
          }
        }
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
    
    // Memory usage tracking
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        ...memUsage,
        timestamp: this.getDeterministicTimestamp()
      });
      
      // Keep only recent memory metrics
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
      }
    }, 1000);
  }
  
  /**
   * Setup periodic cleanup for optimal performance
   */
  _setupPeriodicCleanup() {
    setInterval(() => {
      // Clean up old metrics
      const cutoff = this.getDeterministicTimestamp() - (5 * 60 * 1000); // 5 minutes
      this.metrics.renders = this.metrics.renders.filter(r => 
        r.timestamp > cutoff
      );
      
      // Force garbage collection if available
      if (global.gc && this.metrics.memoryUsage.length > 50) {
        global.gc();
      }
      
      this.metrics.lastCleanup = this.getDeterministicTimestamp();
    }, 60000); // Every minute
  }
  
  /**
   * Optimized template render with performance tracking
   */
  async optimizedRender(templatePath, context = {}, options = {}) {
    const renderId = `kgen-render-${this.getDeterministicTimestamp()}`;
    const startTime = performance.now();
    
    try {
      performance.mark(`${renderId}-start`);
      
      // Fast path for cached renders
      const cacheKey = this._getCacheKey(templatePath, context);
      if (options.useCache !== false) {
        const cached = await this._getCachedRender(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          performance.mark(`${renderId}-end`);
          performance.measure(renderId, `${renderId}-start`, `${renderId}-end`);
          
          return {
            ...cached,
            cached: true,
            renderTime: performance.now() - startTime
          };
        }
        this.metrics.cacheMisses++;
      }
      
      // Optimized template processing
      let result;
      
      if (templatePath.endsWith('.ttl') || templatePath.endsWith('.rdf')) {
        // RDF graph processing
        result = await this._optimizedRDFProcess(templatePath, context, options);
      } else {
        // Template rendering
        result = await this._optimizedTemplateRender(templatePath, context, options);
      }
      
      // Cache successful renders
      if (result.success && options.useCache !== false) {
        await this._setCachedRender(cacheKey, result);
      }
      
      performance.mark(`${renderId}-end`);
      performance.measure(renderId, `${renderId}-start`, `${renderId}-end`);
      
      return {
        ...result,
        cached: false,
        renderTime: performance.now() - startTime
      };
      
    } catch (error) {
      performance.mark(`${renderId}-end`);
      performance.measure(renderId, `${renderId}-start`, `${renderId}-end`);
      
      return {
        success: false,
        error: error.message,
        renderTime: performance.now() - startTime,
        cached: false
      };
    }
  }
  
  /**
   * Optimized RDF graph processing
   */
  async _optimizedRDFProcess(filePath, context, options) {
    const fs = await this.loadModule('fs-extra');
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Use worker for large RDF files, inline for small ones
    const result = await this.executeInWorker('rdf-parse', content);
    
    return {
      success: true,
      content: JSON.stringify(result, null, 2),
      contentHash: require('crypto')
        .createHash('sha256')
        .update(content)
        .digest('hex'),
      metadata: {
        filePath,
        triples: result.count,
        subjects: result.subjects?.length || 0,
        predicates: result.predicates?.length || 0,
        objects: result.objects?.length || 0,
        optimized: true
      }
    };
  }
  
  /**
   * Optimized template rendering
   */
  async _optimizedTemplateRender(templatePath, context, options) {
    const fs = await this.loadModule('fs-extra');
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const template = await fs.readFile(templatePath, 'utf-8');
    
    // Use worker for complex templates, inline for simple ones
    const compiled = await this.executeInWorker('template-compile', template);
    
    // Simple variable substitution for performance
    let rendered = template;
    for (const variable of compiled.variables) {
      const value = this._getNestedValue(context, variable);
      if (value !== undefined) {
        const regex = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
    }
    
    return {
      success: true,
      content: rendered,
      contentHash: require('crypto')
        .createHash('sha256')
        .update(rendered)
        .digest('hex'),
      metadata: {
        templatePath,
        variables: compiled.variables,
        templateHash: compiled.hash,
        optimized: true
      }
    };
  }
  
  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }
  
  /**
   * Generate cache key for render
   */
  _getCacheKey(templatePath, context) {
    const data = JSON.stringify({ templatePath, context }, null, 0);
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Simple in-memory cache for renders
   */
  async _getCachedRender(key) {
    // Simplified cache implementation
    return this._renderCache?.get(key) || null;
  }
  
  async _setCachedRender(key, result) {
    if (!this._renderCache) {
      this._renderCache = new Map();
    }
    
    // Limit cache size
    if (this._renderCache.size > 1000) {
      const firstKey = this._renderCache.keys().next().value;
      this._renderCache.delete(firstKey);
    }
    
    this._renderCache.set(key, result);
  }
  
  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics() {
    const recentRenders = this.metrics.renders.slice(-100);
    const renderTimes = recentRenders.map(r => r.duration);
    
    // Calculate p95 render time
    const p95 = this._calculatePercentile(renderTimes, 95);
    const p50 = this._calculatePercentile(renderTimes, 50);
    const mean = renderTimes.length > 0 
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
      : 0;
    
    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = cacheTotal > 0 
      ? this.metrics.cacheHits / cacheTotal 
      : 0;
    
    const latestMemory = this.metrics.memoryUsage.slice(-1)[0] || {};
    
    return {
      performance: {
        startupTime: this.metrics.startupTime,
        p95RenderTime: p95,
        p50RenderTime: p50,
        meanRenderTime: mean,
        totalRenders: recentRenders.length,
        targetP95: this.config.targetP95RenderMs,
        meetingTarget: p95 <= this.config.targetP95RenderMs
      },
      caching: {
        hitRate: cacheHitRate,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        targetHitRate: this.config.targetCacheHitRate,
        meetingTarget: cacheHitRate >= this.config.targetCacheHitRate
      },
      resources: {
        memoryUsage: latestMemory,
        activeWorkers: this.activeWorkers,
        workerTasks: this.metrics.workerTasks,
        lazyModulesLoaded: Array.from(this.lazyModules.values())
          .filter(m => m.loaded).length,
        pooledBuffers: this.memoryPools.buffers.length
      },
      optimization: {
        lazyLoadingEnabled: this.config.enableLazyLoading,
        memoryPoolingEnabled: this.config.enableMemoryPooling,
        workerThreadsEnabled: this.config.enableWorkerThreads,
        profilingEnabled: this.config.enableProfiling
      }
    };
  }
  
  /**
   * Calculate percentile from array of numbers
   */
  _calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Shutdown optimizer and cleanup resources
   */
  async shutdown() {
    if (this.config.debug) {
      this.logger.info('Shutting down performance optimizer...');
    }
    
    // Stop performance monitoring
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    // Terminate all workers
    for (const worker of this.workerPool) {
      await worker.terminate();
    }
    this.activeWorkers = 0;
    
    // Clear caches
    if (this._renderCache) {
      this._renderCache.clear();
    }
    
    // Clear lazy modules
    this.lazyModules.clear();
    
    this.emit('optimizer:shutdown');
    
    if (this.config.debug) {
      this.logger.success('Performance optimizer shut down');
    }
  }
}

export default KGenPerformanceOptimizer;