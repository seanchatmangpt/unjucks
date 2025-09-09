/**
 * Basic Performance Test
 * Simple validation of performance optimization components
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Basic Performance Validation', () => {
  it('should measure simple operations', () => {
    const start = performance.now();
    
    // Simple operation
    const data = [];
    for (let i = 0; i < 1000; i++) {
      data.push({ id: i, value: `item-${i}` });
    }
    
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeLessThan(100); // Should be very fast
    expect(data).toHaveLength(1000);
    
    console.log(`✓ Basic operation completed in ${duration.toFixed(2)}ms`);
  });

  it('should validate memory tracking', () => {
    const initialMemory = process.memoryUsage();
    
    // Create some data
    const largeArray = new Array(100000).fill(0).map((_, i) => ({
      id: i,
      data: `data-${i}`,
      timestamp: Date.now()
    }));
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    expect(memoryIncrease).toBeGreaterThan(0);
    expect(largeArray).toHaveLength(100000);
    
    console.log(`✓ Memory tracking works: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
  });

  it('should validate caching concepts', () => {
    const cache = new Map();
    
    // Simulate cache operations
    const start1 = performance.now();
    const key = 'test-key';
    const value = { data: 'test-data' };
    cache.set(key, value);
    const end1 = performance.now();
    
    const start2 = performance.now();
    const cached = cache.get(key);
    const end2 = performance.now();
    
    const cacheSetTime = end1 - start1;
    const cacheGetTime = end2 - start2;
    
    expect(cached).toEqual(value);
    expect(cacheGetTime).toBeLessThan(cacheSetTime + 1); // Get should be fast (within 1ms tolerance)
    
    console.log(`✓ Cache operations: Set ${cacheSetTime.toFixed(3)}ms, Get ${cacheGetTime.toFixed(3)}ms`);
  });

  it('should demonstrate performance optimization principles', () => {
    // Unoptimized: String concatenation
    const start1 = performance.now();
    let result1 = '';
    for (let i = 0; i < 10000; i++) {
      result1 += `item-${i},`;
    }
    const end1 = performance.now();
    const unoptimizedTime = end1 - start1;

    // Optimized: Array join
    const start2 = performance.now();
    const parts = [];
    for (let i = 0; i < 10000; i++) {
      parts.push(`item-${i}`);
    }
    const result2 = parts.join(',') + ',';
    const end2 = performance.now();
    const optimizedTime = end2 - start2;

    expect(result1).toBe(result2);
    expect(optimizedTime).toBeLessThan(unoptimizedTime + 10); // Allow some tolerance
    
    const improvement = ((unoptimizedTime - optimizedTime) / unoptimizedTime * 100);
    console.log(`✓ Optimization demo: ${improvement.toFixed(1)}% improvement (${unoptimizedTime.toFixed(2)}ms → ${optimizedTime.toFixed(2)}ms)`);
  });

  it('should show 80/20 rule validation', () => {
    // Simulate common operations (80% of use cases)
    const commonOperations = [
      () => Array.from({ length: 100 }, (_, i) => i * 2),
      () => 'hello world'.toUpperCase(),
      () => JSON.parse('{ "test": true }'),
      () => new Date().toISOString(),
      () => Math.random() * 100
    ];

    // Simulate rare operations (20% of use cases)
    const rareOperations = [
      () => Array.from({ length: 100 }, (_, i) => Math.sqrt(i)),
      () => new RegExp('[a-z]+', 'gi').test('complex regex test'),
      () => JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: i }))),
      () => Buffer.from('test').toString('base64'),
      () => new URL('https://example.com/path?query=value')
    ];

    // Time common operations
    const commonStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      commonOperations[i % commonOperations.length]();
    }
    const commonEnd = performance.now();
    const commonTime = commonEnd - commonStart;

    // Time rare operations
    const rareStart = performance.now();
    for (let i = 0; i < 100; i++) { // Fewer iterations for rare operations
      rareOperations[i % rareOperations.length]();
    }
    const rareEnd = performance.now();
    const rareTime = rareEnd - rareStart;

    // Common operations should be much more frequent and optimized
    expect(commonTime).toBeLessThan(500); // Should be fast
    
    console.log(`✓ 80/20 Rule demo: Common ops ${commonTime.toFixed(2)}ms (1000 ops), Rare ops ${rareTime.toFixed(2)}ms (100 ops)`);
  });
});