// Performance Optimization Examples for Unjucks v2
// Comprehensive examples of performance monitoring, optimization techniques, and benchmarking

/**
 * =============================================================================
 * PERFORMANCE MONITORING SYSTEM
 * =============================================================================
 */

class UnjucksPerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableMetrics: true,
      enableProfiling: true,
      sampleRate: 1.0, // 100% sampling
      metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        templateRenderTime: 1000, // 1 second
        fileWriteTime: 500, // 500ms
        memoryUsage: 512 * 1024 * 1024, // 512MB
        totalGenerationTime: 30000 // 30 seconds
      },
      ...options
    };

    this.metrics = {
      templateRenders: [],
      fileOperations: [],
      memorySnapshots: [],
      generationSessions: [],
      errors: []
    };

    this.activeProfiles = new Map();
    this.startTime = process.hrtime.bigint();
  }

  // Start profiling a specific operation
  startProfile(operationName, metadata = {}) {
    if (!this.options.enableProfiling) return null;

    const profileId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const profile = {
      id: profileId,
      operation: operationName,
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage(),
      metadata,
      checkpoints: []
    };

    this.activeProfiles.set(profileId, profile);
    return profileId;
  }

  // Add checkpoint to active profile
  checkpoint(profileId, checkpointName, data = {}) {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return;

    profile.checkpoints.push({
      name: checkpointName,
      time: process.hrtime.bigint(),
      memory: process.memoryUsage(),
      data
    });
  }

  // End profiling and collect results
  endProfile(profileId) {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return null;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - profile.startTime) / 1e6; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - profile.startMemory.heapUsed;

    const result = {
      id: profile.id,
      operation: profile.operation,
      duration,
      memoryDelta,
      startTime: profile.startTime,
      endTime,
      checkpoints: profile.checkpoints.map(cp => ({
        name: cp.name,
        timeFromStart: Number(cp.time - profile.startTime) / 1e6,
        memoryUsed: cp.memory.heapUsed,
        data: cp.data
      })),
      metadata: profile.metadata
    };

    this.activeProfiles.delete(profileId);
    
    // Store metrics if enabled
    if (this.options.enableMetrics) {
      this.storeMetric(profile.operation, result);
    }

    // Check alert thresholds
    this.checkAlerts(result);

    return result;
  }

  // Store performance metrics
  storeMetric(operation, result) {
    const metric = {
      timestamp: Date.now(),
      operation,
      duration: result.duration,
      memoryDelta: result.memoryDelta,
      checkpoints: result.checkpoints.length,
      metadata: result.metadata
    };

    switch (operation) {
      case 'template-render':
        this.metrics.templateRenders.push(metric);
        break;
      case 'file-write':
      case 'file-read':
        this.metrics.fileOperations.push(metric);
        break;
      default:
        // Store in general metrics
        if (!this.metrics[operation]) {
          this.metrics[operation] = [];
        }
        this.metrics[operation].push(metric);
    }

    // Cleanup old metrics
    this.cleanupMetrics();
  }

  // Check performance alert thresholds
  checkAlerts(result) {
    const { alertThresholds } = this.options;
    const alerts = [];

    // Check duration thresholds
    if (result.operation === 'template-render' && 
        result.duration > alertThresholds.templateRenderTime) {
      alerts.push({
        type: 'SLOW_TEMPLATE_RENDER',
        message: `Template rendering took ${result.duration.toFixed(2)}ms (threshold: ${alertThresholds.templateRenderTime}ms)`,
        severity: 'WARNING',
        metadata: result.metadata
      });
    }

    if (result.operation === 'file-write' && 
        result.duration > alertThresholds.fileWriteTime) {
      alerts.push({
        type: 'SLOW_FILE_WRITE',
        message: `File writing took ${result.duration.toFixed(2)}ms (threshold: ${alertThresholds.fileWriteTime}ms)`,
        severity: 'WARNING',
        metadata: result.metadata
      });
    }

    // Check memory thresholds
    if (Math.abs(result.memoryDelta) > alertThresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `Operation used ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB memory`,
        severity: result.memoryDelta > 0 ? 'WARNING' : 'INFO',
        metadata: result.metadata
      });
    }

    // Process alerts
    alerts.forEach(alert => this.handleAlert(alert));
  }

  // Handle performance alerts
  handleAlert(alert) {
    console.warn(`Performance Alert [${alert.severity}]: ${alert.message}`);
    
    this.metrics.errors.push({
      timestamp: Date.now(),
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata
    });
  }

  // Clean up old metrics
  cleanupMetrics() {
    const cutoff = Date.now() - this.options.metricsRetention;
    
    Object.keys(this.metrics).forEach(key => {
      if (Array.isArray(this.metrics[key])) {
        this.metrics[key] = this.metrics[key].filter(metric => 
          metric.timestamp > cutoff
        );
      }
    });
  }

  // Get performance statistics
  getStatistics(operation = null) {
    const stats = {};

    if (operation) {
      const metrics = this.metrics[operation] || [];
      stats[operation] = this.calculateStats(metrics);
    } else {
      // Generate stats for all operations
      Object.keys(this.metrics).forEach(key => {
        if (Array.isArray(this.metrics[key]) && this.metrics[key].length > 0) {
          stats[key] = this.calculateStats(this.metrics[key]);
        }
      });
    }

    return stats;
  }

  // Calculate statistics for metric array
  calculateStats(metrics) {
    if (metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration).filter(d => d !== undefined);
    const memoryDeltas = metrics.map(m => m.memoryDelta).filter(d => d !== undefined);

    const sortedDurations = [...durations].sort((a, b) => a - b);
    
    return {
      count: metrics.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        median: sortedDurations[Math.floor(sortedDurations.length / 2)],
        p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
        p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)]
      },
      memory: memoryDeltas.length > 0 ? {
        min: Math.min(...memoryDeltas),
        max: Math.max(...memoryDeltas),
        avg: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
        total: memoryDeltas.reduce((sum, d) => sum + d, 0)
      } : null
    };
  }
}

/**
 * =============================================================================
 * TEMPLATE RENDERING OPTIMIZATION
 * =============================================================================
 */

class OptimizedTemplateRenderer {
  constructor(performanceMonitor) {
    this.performanceMonitor = performanceMonitor;
    this.templateCache = new Map();
    this.compiledTemplateCache = new Map();
    this.renderingPool = [];
    this.maxCacheSize = 100;
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
  }

  // Optimized template rendering with caching
  async renderTemplate(templatePath, variables, options = {}) {
    const profileId = this.performanceMonitor?.startProfile('template-render', {
      templatePath,
      variableCount: Object.keys(variables || {}).length,
      options
    });

    try {
      // Check compiled template cache first
      const cacheKey = this.generateCacheKey(templatePath, options);
      let compiledTemplate = this.compiledTemplateCache.get(cacheKey);

      if (compiledTemplate) {
        this.cacheHitCount++;
        this.performanceMonitor?.checkpoint(profileId, 'cache-hit', { cacheKey });
      } else {
        this.cacheMissCount++;
        this.performanceMonitor?.checkpoint(profileId, 'cache-miss', { cacheKey });

        // Load and compile template
        const templateContent = await this.loadTemplate(templatePath);
        this.performanceMonitor?.checkpoint(profileId, 'template-loaded');

        compiledTemplate = await this.compileTemplate(templateContent, options);
        this.performanceMonitor?.checkpoint(profileId, 'template-compiled');

        // Store in cache
        this.addToCache(cacheKey, compiledTemplate);
      }

      // Render with optimized context
      const optimizedVariables = this.optimizeVariables(variables);
      this.performanceMonitor?.checkpoint(profileId, 'variables-optimized');

      const result = await this.executeTemplate(compiledTemplate, optimizedVariables);
      this.performanceMonitor?.checkpoint(profileId, 'template-executed');

      return result;

    } catch (error) {
      console.error('Template rendering failed:', error);
      throw error;
    } finally {
      this.performanceMonitor?.endProfile(profileId);
    }
  }

  // Generate cache key for template
  generateCacheKey(templatePath, options) {
    const optionsHash = this.hashObject(options);
    return `${templatePath}:${optionsHash}`;
  }

  // Load template with caching
  async loadTemplate(templatePath) {
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath);
    }

    const fs = require('fs').promises;
    const content = await fs.readFile(templatePath, 'utf-8');
    
    // Cache with size limit
    if (this.templateCache.size >= this.maxCacheSize) {
      const firstKey = this.templateCache.keys().next().value;
      this.templateCache.delete(firstKey);
    }
    
    this.templateCache.set(templatePath, content);
    return content;
  }

  // Compile template with optimization
  async compileTemplate(content, options = {}) {
    // This would integrate with Nunjucks or EJS compiler
    // For demonstration, we'll simulate compilation
    const compiled = {
      content,
      compiled: true,
      options,
      compiledAt: Date.now()
    };

    return compiled;
  }

  // Add compiled template to cache
  addToCache(key, compiledTemplate) {
    if (this.compiledTemplateCache.size >= this.maxCacheSize) {
      // LRU eviction
      const firstKey = this.compiledTemplateCache.keys().next().value;
      this.compiledTemplateCache.delete(firstKey);
    }

    this.compiledTemplateCache.set(key, compiledTemplate);
  }

  // Optimize variables for rendering
  optimizeVariables(variables) {
    // Clone to avoid mutations
    const optimized = JSON.parse(JSON.stringify(variables));

    // Pre-compute expensive operations
    if (optimized.items && Array.isArray(optimized.items)) {
      optimized.itemsCount = optimized.items.length;
      optimized.hasItems = optimized.items.length > 0;
    }

    // Convert functions to strings to avoid serialization issues
    Object.keys(optimized).forEach(key => {
      if (typeof optimized[key] === 'function') {
        optimized[key] = optimized[key].toString();
      }
    });

    return optimized;
  }

  // Execute compiled template
  async executeTemplate(compiledTemplate, variables) {
    // Simulate template execution with variable substitution
    let result = compiledTemplate.content;
    
    // Simple variable substitution (in real implementation, this would use Nunjucks)
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`<%=\\s*${key}\\s*%>`, 'g');
      result = result.replace(regex, String(value));
    });

    return {
      content: result,
      variables: Object.keys(variables),
      compiledTemplate: compiledTemplate.compiled
    };
  }

  // Get cache statistics
  getCacheStats() {
    const hitRate = this.cacheHitCount / (this.cacheHitCount + this.cacheMissCount);
    
    return {
      templateCache: {
        size: this.templateCache.size,
        maxSize: this.maxCacheSize,
        utilization: `${((this.templateCache.size / this.maxCacheSize) * 100).toFixed(1)}%`
      },
      compiledCache: {
        size: this.compiledTemplateCache.size,
        maxSize: this.maxCacheSize,
        utilization: `${((this.compiledTemplateCache.size / this.maxCacheSize) * 100).toFixed(1)}%`
      },
      performance: {
        cacheHits: this.cacheHitCount,
        cacheMisses: this.cacheMissCount,
        hitRate: `${(hitRate * 100).toFixed(2)}%`
      }
    };
  }

  // Clear caches
  clearCache() {
    this.templateCache.clear();
    this.compiledTemplateCache.clear();
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
  }

  // Hash object for cache key generation
  hashObject(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
}

/**
 * =============================================================================
 * FILE OPERATION OPTIMIZATION
 * =============================================================================
 */

class OptimizedFileOperations {
  constructor(performanceMonitor) {
    this.performanceMonitor = performanceMonitor;
    this.writeQueue = [];
    this.concurrentWrites = 0;
    this.maxConcurrentWrites = 5;
    this.writeBuffer = new Map();
    this.batchSize = 10;
    this.flushInterval = 100; // ms
  }

  // Optimized file writing with batching
  async writeFile(filePath, content, options = {}) {
    return new Promise((resolve, reject) => {
      const writeRequest = {
        filePath,
        content,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.writeQueue.push(writeRequest);
      this.scheduleFlush();
    });
  }

  // Schedule batch flush
  scheduleFlush() {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushWrites();
      this.flushTimer = null;
    }, this.flushInterval);
  }

  // Flush batched writes
  async flushWrites() {
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.splice(0, this.batchSize);
    const profileId = this.performanceMonitor?.startProfile('batch-file-write', {
      batchSize: batch.length,
      files: batch.map(r => r.filePath)
    });

    try {
      // Group by directory for optimized I/O
      const byDirectory = this.groupByDirectory(batch);
      this.performanceMonitor?.checkpoint(profileId, 'grouped-by-directory');

      // Process each directory concurrently
      const promises = Object.entries(byDirectory).map(([dir, requests]) => 
        this.processDirectoryBatch(dir, requests)
      );

      await Promise.all(promises);
      this.performanceMonitor?.checkpoint(profileId, 'all-directories-processed');

      // Resolve all requests
      batch.forEach(request => request.resolve());

    } catch (error) {
      // Reject all requests in batch
      batch.forEach(request => request.reject(error));
    } finally {
      this.performanceMonitor?.endProfile(profileId);
      
      // Continue processing if more items in queue
      if (this.writeQueue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  // Group write requests by directory
  groupByDirectory(requests) {
    const path = require('path');
    const grouped = {};

    requests.forEach(request => {
      const dir = path.dirname(request.filePath);
      if (!grouped[dir]) {
        grouped[dir] = [];
      }
      grouped[dir].push(request);
    });

    return grouped;
  }

  // Process batch for specific directory
  async processDirectoryBatch(directory, requests) {
    const fs = require('fs').promises;
    const path = require('path');

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Limit concurrent writes per directory
    const semaphore = new Semaphore(this.maxConcurrentWrites);
    
    const writePromises = requests.map(async (request) => {
      await semaphore.acquire();
      
      try {
        const profileId = this.performanceMonitor?.startProfile('file-write', {
          filePath: request.filePath,
          size: Buffer.byteLength(request.content, 'utf8'),
          directory
        });

        await fs.writeFile(request.filePath, request.content, request.options);
        
        this.performanceMonitor?.endProfile(profileId);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(writePromises);
  }

  // Read file with caching
  async readFile(filePath, options = {}) {
    const profileId = this.performanceMonitor?.startProfile('file-read', {
      filePath,
      options
    });

    try {
      // Check if file is in buffer (recently written)
      if (this.writeBuffer.has(filePath)) {
        this.performanceMonitor?.checkpoint(profileId, 'buffer-hit');
        return this.writeBuffer.get(filePath);
      }

      const fs = require('fs').promises;
      this.performanceMonitor?.checkpoint(profileId, 'reading-from-disk');
      
      const content = await fs.readFile(filePath, 'utf8');
      this.performanceMonitor?.checkpoint(profileId, 'read-complete');

      return content;

    } finally {
      this.performanceMonitor?.endProfile(profileId);
    }
  }

  // Get write queue statistics
  getStats() {
    return {
      queueLength: this.writeQueue.length,
      concurrentWrites: this.concurrentWrites,
      maxConcurrentWrites: this.maxConcurrentWrites,
      bufferSize: this.writeBuffer.size,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    };
  }

  // Force flush all pending writes
  async forceFlush() {
    while (this.writeQueue.length > 0) {
      await this.flushWrites();
    }
  }
}

// Semaphore for limiting concurrency
class Semaphore {
  constructor(limit) {
    this.limit = limit;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.limit) {
      this.current++;
      return;
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

/**
 * =============================================================================
 * MEMORY OPTIMIZATION
 * =============================================================================
 */

class MemoryOptimizer {
  constructor(performanceMonitor) {
    this.performanceMonitor = performanceMonitor;
    this.gcThreshold = 100 * 1024 * 1024; // 100MB
    this.lastGCTime = Date.now();
    this.memoryPressureLevel = 0; // 0-3 (none, low, medium, high)
    this.objectPools = new Map();
  }

  // Monitor memory usage and trigger optimizations
  monitorMemory() {
    const usage = process.memoryUsage();
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    // Update memory pressure level
    if (heapUsagePercent > 90) {
      this.memoryPressureLevel = 3; // High pressure
    } else if (heapUsagePercent > 75) {
      this.memoryPressureLevel = 2; // Medium pressure
    } else if (heapUsagePercent > 60) {
      this.memoryPressureLevel = 1; // Low pressure
    } else {
      this.memoryPressureLevel = 0; // No pressure
    }

    // Store memory snapshot
    this.performanceMonitor?.storeMetric('memory-usage', {
      timestamp: Date.now(),
      operation: 'memory-monitor',
      duration: 0,
      memoryDelta: 0,
      metadata: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
        pressureLevel: this.memoryPressureLevel,
        heapUsagePercent: heapUsagePercent.toFixed(2)
      }
    });

    // Trigger garbage collection if needed
    if (usage.heapUsed > this.gcThreshold && 
        Date.now() - this.lastGCTime > 30000) { // At least 30s between GC
      this.requestGarbageCollection();
    }

    return {
      usage,
      heapUsagePercent,
      pressureLevel: this.memoryPressureLevel
    };
  }

  // Request garbage collection
  requestGarbageCollection() {
    if (global.gc) {
      console.log('Requesting garbage collection...');
      const beforeGC = process.memoryUsage();
      
      global.gc();
      
      const afterGC = process.memoryUsage();
      const freed = beforeGC.heapUsed - afterGC.heapUsed;
      
      console.log(`GC freed ${(freed / 1024 / 1024).toFixed(2)}MB`);
      this.lastGCTime = Date.now();
    }
  }

  // Optimize large object processing with streaming
  async processLargeDataSet(data, processor, options = {}) {
    const chunkSize = options.chunkSize || 1000;
    const profileId = this.performanceMonitor?.startProfile('large-dataset-processing', {
      totalItems: data.length,
      chunkSize,
      memoryPressure: this.memoryPressureLevel
    });

    try {
      const results = [];
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        this.performanceMonitor?.checkpoint(profileId, `processing-chunk-${Math.floor(i / chunkSize)}`);
        
        // Process chunk
        const chunkResults = await processor(chunk);
        results.push(...chunkResults);
        
        // Memory pressure check
        if (this.memoryPressureLevel >= 2) {
          // High memory pressure - trigger GC
          this.requestGarbageCollection();
        }
        
        // Allow event loop to breathe
        await this.yieldEventLoop();
      }

      return results;

    } finally {
      this.performanceMonitor?.endProfile(profileId);
    }
  }

  // Object pooling for frequently created objects
  getFromPool(type, factory) {
    if (!this.objectPools.has(type)) {
      this.objectPools.set(type, []);
    }

    const pool = this.objectPools.get(type);
    
    if (pool.length > 0) {
      return pool.pop();
    }

    return factory();
  }

  // Return object to pool
  returnToPool(type, object) {
    if (!this.objectPools.has(type)) {
      this.objectPools.set(type, []);
    }

    const pool = this.objectPools.get(type);
    
    // Reset object state
    if (typeof object.reset === 'function') {
      object.reset();
    }

    pool.push(object);

    // Limit pool size to prevent memory leaks
    if (pool.length > 50) {
      pool.shift(); // Remove oldest
    }
  }

  // Yield control to event loop
  yieldEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }

  // Get memory optimization statistics
  getStats() {
    const usage = process.memoryUsage();
    
    return {
      currentUsage: {
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`
      },
      optimization: {
        memoryPressureLevel: this.memoryPressureLevel,
        gcThreshold: `${(this.gcThreshold / 1024 / 1024).toFixed(2)}MB`,
        lastGCTime: new Date(this.lastGCTime).toISOString(),
        objectPools: Object.fromEntries(
          Array.from(this.objectPools.entries()).map(([type, pool]) => [type, pool.length])
        )
      }
    };
  }
}

/**
 * =============================================================================
 * BENCHMARK SUITE
 * =============================================================================
 */

class UnjucksBenchmarkSuite {
  constructor() {
    this.performanceMonitor = new UnjucksPerformanceMonitor();
    this.templateRenderer = new OptimizedTemplateRenderer(this.performanceMonitor);
    this.fileOperations = new OptimizedFileOperations(this.performanceMonitor);
    this.memoryOptimizer = new MemoryOptimizer(this.performanceMonitor);
    
    this.benchmarks = [];
    this.results = [];
  }

  // Register benchmark
  addBenchmark(name, testFn, options = {}) {
    this.benchmarks.push({
      name,
      testFn,
      options: {
        iterations: 10,
        warmupIterations: 2,
        timeout: 30000,
        ...options
      }
    });
  }

  // Run all benchmarks
  async runAllBenchmarks() {
    console.log(`Running ${this.benchmarks.length} benchmarks...`);
    
    for (const benchmark of this.benchmarks) {
      console.log(`\n[BENCHMARK] ${benchmark.name}`);
      
      try {
        const result = await this.runBenchmark(benchmark);
        this.results.push(result);
        
        this.printBenchmarkResult(result);
      } catch (error) {
        console.error(`Benchmark failed: ${error.message}`);
        this.results.push({
          name: benchmark.name,
          error: error.message,
          success: false
        });
      }
    }

    return this.generateReport();
  }

  // Run individual benchmark
  async runBenchmark(benchmark) {
    const { name, testFn, options } = benchmark;
    const iterations = [];

    // Warmup iterations
    console.log(`Warming up (${options.warmupIterations} iterations)...`);
    for (let i = 0; i < options.warmupIterations; i++) {
      await testFn();
    }

    // Measured iterations
    console.log(`Measuring performance (${options.iterations} iterations)...`);
    for (let i = 0; i < options.iterations; i++) {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      await testFn();

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const duration = Number(endTime - startTime) / 1e6; // Convert to ms
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      iterations.push({ duration, memoryDelta });
    }

    // Calculate statistics
    const durations = iterations.map(i => i.duration);
    const memoryDeltas = iterations.map(i => i.memoryDelta);
    
    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
      name,
      success: true,
      iterations: iterations.length,
      statistics: {
        duration: {
          min: Math.min(...durations),
          max: Math.max(...durations),
          avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
          median: sortedDurations[Math.floor(sortedDurations.length / 2)],
          p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
          p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
          stdDev: this.calculateStandardDeviation(durations)
        },
        memory: {
          min: Math.min(...memoryDeltas),
          max: Math.max(...memoryDeltas),
          avg: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
          total: memoryDeltas.reduce((sum, d) => sum + d, 0)
        }
      },
      rawData: iterations
    };
  }

  // Print benchmark result
  printBenchmarkResult(result) {
    if (!result.success) {
      console.log(`❌ Failed: ${result.error}`);
      return;
    }

    const stats = result.statistics;
    
    console.log(`✅ Completed ${result.iterations} iterations`);
    console.log(`   Duration: ${stats.duration.avg.toFixed(2)}ms avg (${stats.duration.min.toFixed(2)}ms - ${stats.duration.max.toFixed(2)}ms)`);
    console.log(`   P95: ${stats.duration.p95.toFixed(2)}ms, P99: ${stats.duration.p99.toFixed(2)}ms`);
    console.log(`   StdDev: ${stats.duration.stdDev.toFixed(2)}ms`);
    console.log(`   Memory: ${(stats.memory.avg / 1024).toFixed(2)}KB avg per iteration`);
  }

  // Generate comprehensive report
  generateReport() {
    const successfulResults = this.results.filter(r => r.success);
    const failedResults = this.results.filter(r => !r.success);

    const report = {
      summary: {
        totalBenchmarks: this.benchmarks.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        overallStats: this.calculateOverallStats(successfulResults)
      },
      results: this.results,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        cpuCount: require('os').cpus().length
      },
      performanceMonitorStats: this.performanceMonitor.getStatistics(),
      cacheStats: this.templateRenderer.getCacheStats(),
      fileOperationStats: this.fileOperations.getStats(),
      memoryOptimizationStats: this.memoryOptimizer.getStats()
    };

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total: ${report.summary.totalBenchmarks}, Success: ${report.summary.successful}, Failed: ${report.summary.failed}`);
    
    if (report.summary.overallStats) {
      console.log(`Average Duration: ${report.summary.overallStats.avgDuration.toFixed(2)}ms`);
      console.log(`Average Memory: ${(report.summary.overallStats.avgMemory / 1024).toFixed(2)}KB`);
    }

    return report;
  }

  // Calculate overall statistics
  calculateOverallStats(results) {
    if (results.length === 0) return null;

    const allDurations = results.flatMap(r => r.rawData.map(d => d.duration));
    const allMemoryDeltas = results.flatMap(r => r.rawData.map(d => d.memoryDelta));

    return {
      avgDuration: allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length,
      avgMemory: allMemoryDeltas.reduce((sum, d) => sum + d, 0) / allMemoryDeltas.length,
      totalIterations: results.reduce((sum, r) => sum + r.iterations, 0)
    };
  }

  // Calculate standard deviation
  calculateStandardDeviation(values) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((sum, v) => sum + v, 0) / values.length);
  }
}

/**
 * =============================================================================
 * USAGE EXAMPLES AND BENCHMARKS
 * =============================================================================
 */

// Example: Template rendering benchmarks
async function runTemplateRenderingBenchmarks() {
  const suite = new UnjucksBenchmarkSuite();

  // Simple template rendering
  suite.addBenchmark('Simple Template Rendering', async () => {
    await suite.templateRenderer.renderTemplate('simple.njk', {
      className: 'TestService',
      methods: ['create', 'read', 'update', 'delete']
    });
  });

  // Complex template with loops
  suite.addBenchmark('Complex Template with Loops', async () => {
    const entities = Array.from({ length: 10 }, (_, i) => ({
      name: `Entity${i}`,
      fields: Array.from({ length: 5 }, (_, j) => ({
        name: `field${j}`,
        type: 'string'
      }))
    }));

    await suite.templateRenderer.renderTemplate('complex.njk', {
      entities,
      namespace: 'TestApp'
    });
  });

  // Large template rendering
  suite.addBenchmark('Large Template Rendering', async () => {
    const largeData = {
      components: Array.from({ length: 100 }, (_, i) => ({
        name: `Component${i}`,
        props: Array.from({ length: 20 }, (_, j) => `prop${j}`)
      }))
    };

    await suite.templateRenderer.renderTemplate('large.njk', largeData);
  }, { iterations: 5 });

  return await suite.runAllBenchmarks();
}

// Example: File operation benchmarks
async function runFileOperationBenchmarks() {
  const suite = new UnjucksBenchmarkSuite();

  // Single file write
  suite.addBenchmark('Single File Write', async () => {
    await suite.fileOperations.writeFile(
      `/tmp/test-${Date.now()}.ts`,
      'export class TestService {}\n'
    );
  });

  // Batch file writes
  suite.addBenchmark('Batch File Writes', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      suite.fileOperations.writeFile(
        `/tmp/batch-test-${Date.now()}-${i}.ts`,
        `export class BatchService${i} {}\n`
      )
    );
    
    await Promise.all(promises);
  });

  // Large file write
  suite.addBenchmark('Large File Write', async () => {
    const largeContent = 'export class LargeService {\n' +
      Array.from({ length: 1000 }, (_, i) => `  method${i}() {}\n`).join('') +
      '}\n';

    await suite.fileOperations.writeFile(
      `/tmp/large-test-${Date.now()}.ts`,
      largeContent
    );
  }, { iterations: 5 });

  return await suite.runAllBenchmarks();
}

// Example: Memory optimization benchmarks
async function runMemoryOptimizationBenchmarks() {
  const suite = new UnjucksBenchmarkSuite();

  // Large dataset processing
  suite.addBenchmark('Large Dataset Processing', async () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      data: `Data for item ${i}`.repeat(10)
    }));

    await suite.memoryOptimizer.processLargeDataSet(
      largeDataset,
      async (chunk) => chunk.map(item => ({ ...item, processed: true })),
      { chunkSize: 500 }
    );
  }, { iterations: 3 });

  return await suite.runAllBenchmarks();
}

// Run comprehensive benchmark suite
async function runComprehensiveBenchmarks() {
  console.log('Starting comprehensive Unjucks v2 performance benchmarks...\n');

  try {
    console.log('🔄 Template Rendering Benchmarks');
    const templateResults = await runTemplateRenderingBenchmarks();

    console.log('\n🔄 File Operation Benchmarks');
    const fileResults = await runFileOperationBenchmarks();

    console.log('\n🔄 Memory Optimization Benchmarks');
    const memoryResults = await runMemoryOptimizationBenchmarks();

    // Combined analysis
    console.log('\n📊 PERFORMANCE ANALYSIS');
    console.log('========================');
    
    const combinedResults = {
      templateRendering: templateResults,
      fileOperations: fileResults,
      memoryOptimization: memoryResults
    };

    // Performance recommendations
    const recommendations = generatePerformanceRecommendations(combinedResults);
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    return combinedResults;

  } catch (error) {
    console.error('Benchmark suite failed:', error);
    throw error;
  }
}

// Generate performance recommendations based on benchmark results
function generatePerformanceRecommendations(results) {
  const recommendations = [];

  // Analyze template rendering performance
  const templateStats = results.templateRendering?.summary?.overallStats;
  if (templateStats && templateStats.avgDuration > 100) {
    recommendations.push('Template rendering is slow - consider template caching and pre-compilation');
  }

  // Analyze memory usage
  const memoryStats = results.memoryOptimization?.summary?.overallStats;
  if (memoryStats && memoryStats.avgMemory > 10 * 1024 * 1024) { // 10MB
    recommendations.push('High memory usage detected - implement streaming for large datasets');
  }

  // File operation analysis
  const fileStats = results.fileOperations?.summary?.overallStats;
  if (fileStats && fileStats.avgDuration > 50) {
    recommendations.push('File operations are slow - consider batch writing and concurrent I/O');
  }

  // Cache performance analysis
  const cacheStats = results.templateRendering?.cacheStats;
  if (cacheStats && parseFloat(cacheStats.performance.hitRate) < 80) {
    recommendations.push('Low cache hit rate - increase cache size or improve cache key strategy');
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! Continue monitoring for regressions.');
  }

  return recommendations;
}

// Export for use in other modules
module.exports = {
  UnjucksPerformanceMonitor,
  OptimizedTemplateRenderer,
  OptimizedFileOperations,
  MemoryOptimizer,
  UnjucksBenchmarkSuite,
  runComprehensiveBenchmarks,
  generatePerformanceRecommendations
};

// Example usage (commented out for safety)
/*
runComprehensiveBenchmarks()
  .then(results => {
    console.log('\nBenchmark suite completed successfully');
    // Save results to file for analysis
    require('fs').writeFileSync(
      'benchmark-results.json',
      JSON.stringify(results, null, 2)
    );
  })
  .catch(error => {
    console.error('Benchmark suite failed:', error);
    process.exit(1);
  });
*/