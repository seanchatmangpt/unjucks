/**
 * Memory Optimization Module
 * 
 * Focuses on memory efficiency, garbage collection hints, and leak prevention
 * for the 80% of common RDF/Turtle processing scenarios
 */

import { performance } from 'perf_hooks';

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  timestamp: number;
}

export interface MemoryOptimizationResult {
  beforeOptimization: MemoryMetrics;
  afterOptimization: MemoryMetrics;
  memoryReduced: number;
  strategy: string;
  success: boolean;
}

/**
 * Object Pool for reusing frequently created objects
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn?: (obj: T) => void, maxSize: number = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

/**
 * Weak Reference Cache for automatic cleanup
 */
class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>();
  private hits = 0;
  private misses = 0;

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return value;
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }

  clearStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Memory-efficient string interning for common RDF URIs and literals
 */
class StringInterning {
  private internedStrings = new Map<string, string>();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  intern(str: string): string {
    if (this.internedStrings.has(str)) {
      return this.internedStrings.get(str)!;
    }

    if (this.internedStrings.size >= this.maxSize) {
      // Remove oldest entries using FIFO
      const firstKey = this.internedStrings.keys().next().value;
      this.internedStrings.delete(firstKey);
    }

    this.internedStrings.set(str, str);
    return str;
  }

  clear(): void {
    this.internedStrings.clear();
  }

  get size(): number {
    return this.internedStrings.size;
  }
}

/**
 * Memory Monitor for tracking usage patterns
 */
class MemoryMonitor {
  private snapshots: MemoryMetrics[] = [];
  private isMonitoring = false;
  private monitorInterval?: NodeJS.Timeout;
  private thresholds = {
    heapUsedMB: 500,
    heapGrowthRate: 0.1 // 10% growth per interval
  };

  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.captureSnapshot();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    this.isMonitoring = false;
  }

  captureSnapshot(): MemoryMetrics {
    const usage = process.memoryUsage();
    const snapshot: MemoryMetrics = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      rss: usage.rss,
      timestamp: Date.now()
    };

    this.snapshots.push(snapshot);
    
    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  getLatestSnapshot(): MemoryMetrics | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  detectMemoryLeak(): {
    isLeak: boolean;
    growthRate: number;
    recommendation: string;
  } {
    if (this.snapshots.length < 10) {
      return {
        isLeak: false,
        growthRate: 0,
        recommendation: 'Not enough data to detect memory leaks'
      };
    }

    const recent = this.snapshots.slice(-10);
    const growthRates = [];

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const rate = (curr.heapUsed - prev.heapUsed) / prev.heapUsed;
      growthRates.push(rate);
    }

    const avgGrowthRate = growthRates.reduce((a, b) => a + b) / growthRates.length;
    const isLeak = avgGrowthRate > this.thresholds.heapGrowthRate;

    return {
      isLeak,
      growthRate: avgGrowthRate,
      recommendation: isLeak 
        ? 'Possible memory leak detected. Consider clearing caches and checking for circular references.'
        : 'Memory usage appears stable.'
    };
  }

  generateReport(): {
    current: MemoryMetrics;
    peak: MemoryMetrics;
    trend: 'increasing' | 'decreasing' | 'stable';
    efficiency: number;
    recommendations: string[];
  } {
    if (this.snapshots.length === 0) {
      const current = this.captureSnapshot();
      return {
        current,
        peak: current,
        trend: 'stable',
        efficiency: 100,
        recommendations: ['Start monitoring to get better insights']
      };
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const peak = this.snapshots.reduce((max, snap) => 
      snap.heapUsed > max.heapUsed ? snap : max
    );

    // Determine trend
    const recentSnapshots = this.snapshots.slice(-5);
    const avgRecent = recentSnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / recentSnapshots.length;
    const earlierSnapshots = this.snapshots.slice(-10, -5);
    const avgEarlier = earlierSnapshots.length > 0 
      ? earlierSnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / earlierSnapshots.length
      : avgRecent;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const trendThreshold = 0.05; // 5% change threshold
    
    if (avgRecent > avgEarlier * (1 + trendThreshold)) {
      trend = 'increasing';
    } else if (avgRecent < avgEarlier * (1 - trendThreshold)) {
      trend = 'decreasing';
    }

    // Calculate efficiency (heap utilization)
    const efficiency = Math.max(0, Math.min(100, 
      (current.heapUsed / current.heapTotal) * 100
    ));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (trend === 'increasing') {
      recommendations.push('Memory usage is increasing. Consider implementing periodic cleanup.');
    }
    
    if (efficiency < 60) {
      recommendations.push('Heap utilization is low. Consider adjusting heap limits.');
    } else if (efficiency > 90) {
      recommendations.push('Heap utilization is high. Consider increasing heap size or optimizing memory usage.');
    }

    const currentMB = current.heapUsed / 1024 / 1024;
    if (currentMB > this.thresholds.heapUsedMB) {
      recommendations.push('High memory usage detected. Consider enabling garbage collection hints.');
    }

    return {
      current,
      peak,
      trend,
      efficiency,
      recommendations
    };
  }

  clearHistory(): void {
    this.snapshots = [];
  }
}

/**
 * Main Memory Optimizer Class
 */
export class MemoryOptimizer {
  private monitor = new MemoryMonitor();
  private stringInterning = new StringInterning();
  private objectPools = new Map<string, ObjectPool<any>>();
  private weakCaches = new Map<string, WeakCache<any, any>>();
  private optimizationHistory: MemoryOptimizationResult[] = [];

  constructor() {
    // Set up common object pools
    this.createObjectPool('triple', () => ({ subject: null, predicate: null, object: null }));
    this.createObjectPool('term', () => ({ type: '', value: '', datatype: '', language: '' }));
    this.createObjectPool('query-result', () => ([]));
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 5000): void {
    this.monitor.startMonitoring(intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    this.monitor.stopMonitoring();
  }

  /**
   * Optimize memory usage with various strategies
   */
  async optimizeMemory(strategy: 'gc' | 'cache-clear' | 'pool-reset' | 'comprehensive' = 'comprehensive'): Promise<MemoryOptimizationResult> {
    const before = this.monitor.captureSnapshot();
    let success = false;

    try {
      switch (strategy) {
        case 'gc':
          success = await this.forceGarbageCollection();
          break;
        case 'cache-clear':
          success = this.clearCaches();
          break;
        case 'pool-reset':
          success = this.resetObjectPools();
          break;
        case 'comprehensive':
          success = await this.comprehensiveOptimization();
          break;
      }
    } catch (error) {
      console.warn('Memory optimization failed:', error);
      success = false;
    }

    // Wait a bit for memory changes to take effect
    await this.sleep(100);
    
    const after = this.monitor.captureSnapshot();
    const memoryReduced = before.heapUsed - after.heapUsed;

    const result: MemoryOptimizationResult = {
      beforeOptimization: before,
      afterOptimization: after,
      memoryReduced,
      strategy,
      success
    };

    this.optimizationHistory.push(result);
    return result;
  }

  /**
   * Get or create an object pool
   */
  getObjectPool<T>(name: string): ObjectPool<T> | undefined {
    return this.objectPools.get(name);
  }

  /**
   * Create a new object pool
   */
  createObjectPool<T>(name: string, createFn: () => T, resetFn?: (obj: T) => void, maxSize: number = 100): ObjectPool<T> {
    const pool = new ObjectPool(createFn, resetFn, maxSize);
    this.objectPools.set(name, pool);
    return pool;
  }

  /**
   * Get or create a weak cache
   */
  getWeakCache<K extends object, V>(name: string): WeakCache<K, V> {
    if (!this.weakCaches.has(name)) {
      this.weakCaches.set(name, new WeakCache<K, V>());
    }
    return this.weakCaches.get(name)!;
  }

  /**
   * Intern a string to reduce memory usage
   */
  internString(str: string): string {
    return this.stringInterning.intern(str);
  }

  /**
   * Generate memory optimization report
   */
  generateOptimizationReport(): {
    currentMemory: MemoryMetrics;
    monitoringReport: any;
    optimizationHistory: MemoryOptimizationResult[];
    poolStats: Array<{ name: string; size: number; maxSize: number }>;
    cacheStats: Array<{ name: string; hitRate: number; hits: number; misses: number }>;
    recommendations: string[];
  } {
    const currentMemory = this.monitor.captureSnapshot();
    const monitoringReport = this.monitor.generateReport();
    
    // Pool statistics
    const poolStats: Array<{ name: string; size: number; maxSize: number }> = [];
    this.objectPools.forEach((pool, name) => {
      poolStats.push({
        name,
        size: pool.size,
        maxSize: (pool as any).maxSize || 0
      });
    });

    // Cache statistics
    const cacheStats: Array<{ name: string; hitRate: number; hits: number; misses: number }> = [];
    this.weakCaches.forEach((cache, name) => {
      const stats = cache.getStats();
      cacheStats.push({
        name,
        hitRate: stats.hitRate,
        hits: stats.hits,
        misses: stats.misses
      });
    });

    // Generate recommendations
    const recommendations: string[] = [...monitoringReport.recommendations];
    
    // Add pool-specific recommendations
    poolStats.forEach(pool => {
      if (pool.size === 0) {
        recommendations.push(`Object pool '${pool.name}' is not being used - consider removing it`);
      } else if (pool.size / pool.maxSize > 0.9) {
        recommendations.push(`Object pool '${pool.name}' is near capacity - consider increasing maxSize`);
      }
    });

    // Add cache-specific recommendations
    cacheStats.forEach(cache => {
      if (cache.hitRate < 0.5 && cache.hits + cache.misses > 100) {
        recommendations.push(`Cache '${cache.name}' has low hit rate (${(cache.hitRate * 100).toFixed(1)}%) - consider review caching strategy`);
      }
    });

    // String interning recommendations
    const internedStrings = this.stringInterning.size;
    if (internedStrings > 5000) {
      recommendations.push('String interning cache is large - consider periodic cleanup');
    }

    return {
      currentMemory,
      monitoringReport,
      optimizationHistory: [...this.optimizationHistory],
      poolStats,
      cacheStats,
      recommendations
    };
  }

  /**
   * Detect and suggest memory optimizations
   */
  suggestOptimizations(): {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    suggestions: Array<{
      strategy: string;
      reason: string;
      estimatedSaving: string;
    }>;
  } {
    const report = this.monitor.generateReport();
    const currentMB = report.current.heapUsed / 1024 / 1024;
    
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const suggestions: Array<{ strategy: string; reason: string; estimatedSaving: string }> = [];

    // Determine urgency
    if (currentMB > 1000) {
      urgency = 'critical';
    } else if (currentMB > 500) {
      urgency = 'high';
    } else if (currentMB > 200 || report.trend === 'increasing') {
      urgency = 'medium';
    }

    // Generate suggestions based on urgency and patterns
    if (report.trend === 'increasing') {
      suggestions.push({
        strategy: 'Enable periodic garbage collection',
        reason: 'Memory usage is steadily increasing',
        estimatedSaving: '10-30%'
      });
    }

    if (report.efficiency > 90) {
      suggestions.push({
        strategy: 'Clear caches and reset object pools',
        reason: 'High heap utilization detected',
        estimatedSaving: '20-40%'
      });
    }

    if (this.stringInterning.size > 5000) {
      suggestions.push({
        strategy: 'Clear string interning cache',
        reason: 'Large number of interned strings',
        estimatedSaving: '5-15%'
      });
    }

    const leakDetection = this.monitor.detectMemoryLeak();
    if (leakDetection.isLeak) {
      urgency = 'critical';
      suggestions.push({
        strategy: 'Investigate memory leak',
        reason: `High growth rate detected: ${(leakDetection.growthRate * 100).toFixed(1)}%`,
        estimatedSaving: 'Variable - depends on leak source'
      });
    }

    return { urgency, suggestions };
  }

  // Private helper methods

  private async forceGarbageCollection(): Promise<boolean> {
    if (global.gc) {
      global.gc();
      await this.sleep(50); // Allow time for GC
      return true;
    }
    return false;
  }

  private clearCaches(): boolean {
    try {
      this.weakCaches.forEach(cache => cache.clearStats());
      this.stringInterning.clear();
      return true;
    } catch (error) {
      return false;
    }
  }

  private resetObjectPools(): boolean {
    try {
      this.objectPools.forEach(pool => pool.clear());
      return true;
    } catch (error) {
      return false;
    }
  }

  private async comprehensiveOptimization(): Promise<boolean> {
    try {
      // 1. Clear caches
      this.clearCaches();
      
      // 2. Reset object pools
      this.resetObjectPools();
      
      // 3. Force garbage collection
      await this.forceGarbageCollection();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizer();

export default {
  MemoryOptimizer,
  memoryOptimizer,
  ObjectPool,
  WeakCache,
  StringInterning,
  MemoryMonitor
};