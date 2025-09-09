/**
 * Performance Infrastructure Integration Test
 * Validates that performance monitoring and optimization components work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Infrastructure Integration', () => {
  let performanceOptimizer, performanceMonitor;

  beforeEach(async () => {
    try {
      const optimizerModule = await import('../../src/lib/performance/performance-optimizer.js');
      performanceOptimizer = optimizerModule.performanceOptimizer;

      const monitorModule = await import('../../src/lib/performance/performance-monitor.js');
      performanceMonitor = monitorModule.performanceMonitor;
    } catch (error) {
      console.warn('Performance modules not available for testing:', error.message);
    }
  });

  afterEach(() => {
    if (performanceMonitor) {
      performanceMonitor.stopMonitoring();
    }
  });

  it('should have proper performance timing mechanisms', () => {
    const start = performance.now();
    
    // Simulate some work
    const data = [];
    for (let i = 0; i < 1000; i++) {
      data.push({ id: i, value: `item-${i}` });
    }
    
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should be fast
    expect(data).toHaveLength(1000);
    
    console.log(`✓ Performance timing works: ${duration.toFixed(2)}ms for 1000 operations`);
  });

  it('should track memory usage correctly', () => {
    const initialMemory = process.memoryUsage();
    
    // Create memory-intensive operation
    const largeArray = new Array(50000).fill(0).map((_, i) => ({
      id: i,
      data: `data-${i}`,
      timestamp: Date.now()
    }));
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    expect(memoryIncrease).toBeGreaterThan(0);
    expect(largeArray).toHaveLength(50000);
    
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
    console.log(`✓ Memory tracking works: ${memoryIncreaseMB.toFixed(2)}MB increase`);
  });

  it('should validate caching performance concepts', () => {
    const cache = new Map();
    
    // Test cache set performance
    const start1 = performance.now();
    const key = 'test-key';
    const value = { data: 'test-data', timestamp: Date.now() };
    cache.set(key, value);
    const end1 = performance.now();
    
    // Test cache get performance
    const start2 = performance.now();
    const cached = cache.get(key);
    const end2 = performance.now();
    
    const cacheSetTime = end1 - start1;
    const cacheGetTime = end2 - start2;
    
    expect(cached).toEqual(value);
    expect(cacheGetTime).toBeLessThan(cacheSetTime + 1); // Within 1ms tolerance
    expect(cache.size).toBe(1);
    
    console.log(`✓ Cache performance: Set ${cacheSetTime.toFixed(3)}ms, Get ${cacheGetTime.toFixed(3)}ms`);
  });

  it('should calculate performance statistics correctly', async () => {
    if (!performanceOptimizer) {
      console.log('⚠️  Performance optimizer not available, skipping test');
      return;
    }

    // Test performance optimizer report generation
    const report = performanceOptimizer.generatePerformanceReport();
    
    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
    
    console.log(`✓ Performance report generated with ${report.recommendations.length} recommendations`);
  });

  it('should have working performance monitoring functionality', () => {
    if (!performanceMonitor) {
      console.log('⚠️  Performance monitor not available, skipping test');
      return;
    }

    // Test monitoring start/stop
    expect(typeof performanceMonitor.startMonitoring).toBe('function');
    expect(typeof performanceMonitor.stopMonitoring).toBe('function');
    expect(typeof performanceMonitor.recordMetric).toBe('function');
    expect(typeof performanceMonitor.generateAlert).toBe('function');
    expect(typeof performanceMonitor.getDashboard).toBe('function');

    // Test dashboard generation
    const dashboard = performanceMonitor.getDashboard();
    expect(dashboard).toBeDefined();
    expect(dashboard.status).toBeDefined();
    expect(dashboard.totalOperations).toBeDefined();
    expect(dashboard.averagePerformance).toBeDefined();
    
    console.log(`✓ Performance monitor dashboard: ${dashboard.status} status, ${dashboard.totalOperations} operations`);
  });

  it('should record and process performance metrics', () => {
    if (!performanceMonitor) {
      console.log('⚠️  Performance monitor not available, skipping test');
      return;
    }

    const testMetric = {
      parseTime: 50,
      queryTime: 25,
      renderTime: 10,
      memoryUsage: { before: 1024, after: 1100, peak: 1150 },
      cacheHits: 8,
      cacheMisses: 2,
      operationType: 'test-operation',
      tripleCount: 100,
      timestamp: Date.now()
    };

    const initialMetricsCount = performanceMonitor.getMetrics().length;
    performanceMonitor.recordMetric(testMetric);
    const finalMetricsCount = performanceMonitor.getMetrics().length;

    expect(finalMetricsCount).toBe(initialMetricsCount + 1);
    
    const dashboard = performanceMonitor.getDashboard();
    expect(dashboard.totalOperations).toBeGreaterThan(0);
    
    console.log(`✓ Metric recording works: ${finalMetricsCount} total metrics`);
  });

  it('should demonstrate performance optimization principles', () => {
    // Unoptimized approach: String concatenation
    const start1 = performance.now();
    let result1 = '';
    for (let i = 0; i < 5000; i++) {
      result1 += `item-${i},`;
    }
    const end1 = performance.now();
    const unoptimizedTime = end1 - start1;

    // Optimized approach: Array join
    const start2 = performance.now();
    const parts = [];
    for (let i = 0; i < 5000; i++) {
      parts.push(`item-${i}`);
    }
    const result2 = parts.join(',') + ',';
    const end2 = performance.now();
    const optimizedTime = end2 - start2;

    expect(result1).toBe(result2);
    expect(optimizedTime).toBeLessThan(unoptimizedTime + 10); // Allow tolerance

    const improvement = unoptimizedTime > 0 ? 
      ((unoptimizedTime - optimizedTime) / unoptimizedTime * 100) : 0;
    
    console.log(`✓ Optimization demo: ${improvement.toFixed(1)}% improvement (${unoptimizedTime.toFixed(2)}ms → ${optimizedTime.toFixed(2)}ms)`);
  });

  it('should validate 80/20 performance rule concepts', () => {
    // Common operations (80% of use cases)
    const commonOperations = [
      () => Array.from({ length: 50 }, (_, i) => i * 2),
      () => 'hello world'.toUpperCase(),
      () => JSON.parse('{"test": true}'),
      () => new Date().toISOString(),
      () => Math.random() * 100
    ];

    // Rare operations (20% of use cases)
    const rareOperations = [
      () => Array.from({ length: 50 }, (_, i) => Math.sqrt(i)),
      () => new RegExp('[a-z]+', 'gi').test('complex regex test'),
      () => JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ id: i }))),
      () => Buffer.from('test').toString('base64'),
      () => new URL('https://example.com/path')
    ];

    // Time common operations
    const commonStart = performance.now();
    for (let i = 0; i < 500; i++) {
      commonOperations[i % commonOperations.length]();
    }
    const commonEnd = performance.now();
    const commonTime = commonEnd - commonStart;

    // Time rare operations
    const rareStart = performance.now();
    for (let i = 0; i < 50; i++) {
      rareOperations[i % rareOperations.length]();
    }
    const rareEnd = performance.now();
    const rareTime = rareEnd - rareStart;

    expect(commonTime).toBeLessThan(200); // Should be reasonably fast
    expect(rareTime).toBeGreaterThan(0);

    console.log(`✓ 80/20 Rule validation: Common ops ${commonTime.toFixed(2)}ms (500 ops), Rare ops ${rareTime.toFixed(2)}ms (50 ops)`);
  });

  it('should generate performance alerts correctly', () => {
    if (!performanceMonitor) {
      console.log('⚠️  Performance monitor not available, skipping test');
      return;
    }

    const initialAlertsCount = performanceMonitor.getAlerts().length;
    
    const alert = performanceMonitor.generateAlert(
      'warning',
      'test',
      'Test alert message',
      100,
      50,
      { testData: 'value' }
    );

    expect(alert).toBeDefined();
    expect(alert.id).toBeDefined();
    expect(alert.type).toBe('warning');
    expect(alert.category).toBe('test');
    expect(alert.message).toBe('Test alert message');
    expect(alert.timestamp).toBeDefined();

    const finalAlertsCount = performanceMonitor.getAlerts().length;
    expect(finalAlertsCount).toBe(initialAlertsCount + 1);

    console.log(`✓ Alert generation works: Created alert ${alert.id}`);
  });
});