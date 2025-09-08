/**
 * Memory Optimizer
 * Memory leak detection and optimization for CLI performance
 */

import { performance } from 'perf_hooks';

class MemoryOptimizer {
  constructor() {
    this.memorySnapshots = [];
    this.objectPools = new Map();
    this.weakRefs = new Set();
    this.cleanupTasks = [];
    this.gcScheduled = false;
    
    // Memory thresholds
    this.thresholds = {
      heapUsed: 50 * 1024 * 1024,    // 50MB
      rss: 100 * 1024 * 1024,       // 100MB
      external: 10 * 1024 * 1024     // 10MB
    };
    
    this.setupMemoryMonitoring();
  }

  /**
   * Set up automatic memory monitoring
   */
  setupMemoryMonitoring() {
    // Monitor memory every 30 seconds in production
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => this.checkMemoryUsage(), 30000);
    }
    
    // Clean up on process exit
    process.on('beforeExit', () => this.cleanup());
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Take memory snapshot
   */
  takeSnapshot(label = 'unnamed') {
    const usage = process.memoryUsage();
    const snapshot = {
      label,
      timestamp: Date.now(),
      performance: performance.now(),
      ...usage,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100
    };
    
    this.memorySnapshots.push(snapshot);
    
    // Keep only last 20 snapshots
    if (this.memorySnapshots.length > 20) {
      this.memorySnapshots.shift();
    }
    
    return snapshot;
  }

  /**
   * Check current memory usage against thresholds
   */
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const warnings = [];
    
    if (usage.heapUsed > this.thresholds.heapUsed) {
      warnings.push(`Heap usage high: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    }
    
    if (usage.rss > this.thresholds.rss) {
      warnings.push(`RSS usage high: ${Math.round(usage.rss / 1024 / 1024)}MB`);
    }
    
    if (usage.external > this.thresholds.external) {
      warnings.push(`External usage high: ${Math.round(usage.external / 1024 / 1024)}MB`);
    }
    
    if (warnings.length > 0) {
      console.warn('⚠️  Memory usage warnings:', warnings.join(', '));
      this.scheduleGarbageCollection();
    }
    
    return warnings.length === 0;
  }

  /**
   * Schedule garbage collection if available
   */
  scheduleGarbageCollection() {
    if (this.gcScheduled || typeof global.gc !== 'function') {
      return;
    }
    
    this.gcScheduled = true;
    
    // Schedule GC on next tick to avoid blocking
    process.nextTick(() => {
      try {
        const beforeGC = process.memoryUsage();
        global.gc();
        const afterGC = process.memoryUsage();
        
        const freed = beforeGC.heapUsed - afterGC.heapUsed;
        if (freed > 1024 * 1024) { // > 1MB freed
          console.log(`♻️  GC freed ${Math.round(freed / 1024 / 1024)}MB`);
        }
      } catch (error) {
        console.warn('GC failed:', error.message);
      } finally {
        this.gcScheduled = false;
      }
    });
  }

  /**
   * Create object pool for reusable objects
   */
  createObjectPool(name, factory, resetFn = null) {
    if (this.objectPools.has(name)) {
      return this.objectPools.get(name);
    }
    
    const pool = {
      objects: [],
      factory,
      resetFn,
      created: 0,
      reused: 0,
      
      get() {
        if (this.objects.length > 0) {
          const obj = this.objects.pop();
          this.reused++;
          return obj;
        }
        
        this.created++;
        return factory();
      },
      
      release(obj) {
        if (resetFn) {
          resetFn(obj);
        }
        this.objects.push(obj);
      },
      
      clear() {
        this.objects.length = 0;
      },
      
      getStats() {
        return {
          created: this.created,
          reused: this.reused,
          poolSize: this.objects.length,
          reuseRate: `${((this.reused / (this.created + this.reused)) * 100 || 0).toFixed(1)}%`
        };
      }
    };
    
    this.objectPools.set(name, pool);
    return pool;
  }

  /**
   * Create weak reference to avoid memory leaks
   */
  createWeakRef(target, callback) {
    if (typeof WeakRef === 'undefined') {
      // Fallback for older Node.js versions
      return { deref: () => target };
    }
    
    const ref = new WeakRef(target);
    this.weakRefs.add(ref);
    
    if (callback && typeof FinalizationRegistry !== 'undefined') {
      const registry = new FinalizationRegistry(callback);
      registry.register(target, target);
    }
    
    return ref;
  }

  /**
   * Add cleanup task to run on exit
   */
  addCleanupTask(task) {
    this.cleanupTasks.push(task);
  }

  /**
   * Run all cleanup tasks
   */
  cleanup() {
    try {
      // Run cleanup tasks
      for (const task of this.cleanupTasks) {
        try {
          task();
        } catch (error) {
          console.warn('Cleanup task failed:', error.message);
        }
      }
      
      // Clear object pools
      for (const pool of this.objectPools.values()) {
        pool.clear();
      }
      
      // Clear weak references
      this.weakRefs.clear();
      
      // Clear snapshots
      this.memorySnapshots.length = 0;
      
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  /**
   * Analyze memory usage trends
   */
  analyzeMemoryTrends() {
    if (this.memorySnapshots.length < 2) {
      return { trend: 'insufficient-data' };
    }
    
    const recent = this.memorySnapshots.slice(-5);
    const heapTrend = recent.map(s => s.heapUsed);
    const rssTrend = recent.map(s => s.rss);
    
    const heapIncrease = heapTrend[heapTrend.length - 1] - heapTrend[0];
    const rssIncrease = rssTrend[rssTrend.length - 1] - rssTrend[0];
    
    const analysis = {
      heapTrend: heapIncrease > 0 ? 'increasing' : 'stable',
      rssTrend: rssIncrease > 0 ? 'increasing' : 'stable',
      heapChange: `${(heapIncrease / 1024 / 1024).toFixed(2)}MB`,
      rssChange: `${(rssIncrease / 1024 / 1024).toFixed(2)}MB`,
      snapshots: recent.length,
      timeSpan: `${((recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000).toFixed(1)}s`
    };
    
    // Check for potential leaks
    if (heapIncrease > 5 * 1024 * 1024) { // 5MB increase
      analysis.warnings = ['Potential memory leak detected in heap'];
    }
    
    if (rssIncrease > 10 * 1024 * 1024) { // 10MB increase
      analysis.warnings = analysis.warnings || [];
      analysis.warnings.push('Potential memory leak detected in RSS');
    }
    
    return analysis;
  }

  /**
   * Get comprehensive memory report
   */
  getMemoryReport() {
    const current = process.memoryUsage();
    const analysis = this.analyzeMemoryTrends();
    
    const poolStats = {};
    for (const [name, pool] of this.objectPools) {
      poolStats[name] = pool.getStats();
    }
    
    return {
      current: {
        heapUsed: `${Math.round(current.heapUsed / 1024 / 1024 * 100) / 100}MB`,
        heapTotal: `${Math.round(current.heapTotal / 1024 / 1024 * 100) / 100}MB`,
        rss: `${Math.round(current.rss / 1024 / 1024 * 100) / 100}MB`,
        external: `${Math.round(current.external / 1024 / 1024 * 100) / 100}MB`
      },
      thresholds: {
        heapUsed: `${Math.round(this.thresholds.heapUsed / 1024 / 1024)}MB`,
        rss: `${Math.round(this.thresholds.rss / 1024 / 1024)}MB`,
        external: `${Math.round(this.thresholds.external / 1024 / 1024)}MB`
      },
      analysis,
      objectPools: poolStats,
      snapshots: this.memorySnapshots.length,
      weakRefs: this.weakRefs.size
    };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    const report = this.getMemoryReport();
    
    // Check current usage
    const heapUsed = process.memoryUsage().heapUsed;
    if (heapUsed > this.thresholds.heapUsed) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        issue: `High heap usage: ${report.current.heapUsed}`,
        solution: 'Implement object pooling and aggressive garbage collection'
      });
    }
    
    // Check object pool efficiency
    for (const [name, stats] of Object.entries(report.objectPools)) {
      const reuseRate = parseFloat(stats.reuseRate);
      if (reuseRate < 50) {
        recommendations.push({
          type: 'pooling',
          priority: 'medium',
          issue: `Low object pool reuse rate for ${name}: ${stats.reuseRate}`,
          solution: 'Review object lifecycle and pooling strategy'
        });
      }
    }
    
    // Check for memory trends
    if (report.analysis.warnings) {
      for (const warning of report.analysis.warnings) {
        recommendations.push({
          type: 'leak',
          priority: 'high',
          issue: warning,
          solution: 'Investigate memory leaks and implement proper cleanup'
        });
      }
    }
    
    return recommendations;
  }
}

// Global memory optimizer instance
export const memoryOptimizer = new MemoryOptimizer();

// Pre-configured object pools
export const objectPools = {
  // Template context pool
  templateContext: memoryOptimizer.createObjectPool(
    'templateContext',
    () => ({}),
    (obj) => {
      for (const key in obj) {
        delete obj[key];
      }
    }
  ),
  
  // Array pool for reusable arrays
  arrays: memoryOptimizer.createObjectPool(
    'arrays',
    () => [],
    (arr) => arr.length = 0
  ),
  
  // String buffer pool
  stringBuffers: memoryOptimizer.createObjectPool(
    'stringBuffers',
    () => [],
    (buffer) => buffer.length = 0
  )
};

export default MemoryOptimizer;