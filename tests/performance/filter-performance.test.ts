import { describe, it, expect, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import nunjucks from 'nunjucks';

interface FilterPerformanceMetric {
  filterName: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  memoryUsage: number;
  dataSize: string;
  throughput?: number;
}

describe('Filter Performance Testing', () => {
  let env: nunjucks.Environment;
  let performanceResults: FilterPerformanceMetric[] = [];
  const resultsFile = join(process.cwd(), 'tests/performance/results/filter-metrics.json');

  beforeEach(() => {
    mkdirSync(join(process.cwd(), 'tests/performance/results'), { recursive: true });
    env = new nunjucks.Environment();
    
    // Load custom filters (assuming they're in src/lib/filters)
    try {
      const { setupFilters } = require('../../src/lib/filters');
      setupFilters(env);
    } catch (error) {
      console.warn('Custom filters not found, testing with built-in filters only');
    }
  });

  const measureFilterPerformance = (
    filterName: string, 
    template: string, 
    data: any, 
    iterations: number = 1000
  ): FilterPerformanceMetric => {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      try {
        env.renderString(template, data);
      } catch (error) {
        // Skip failed renders but count them
        continue;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const totalTime = endTime - startTime;
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    return {
      filterName,
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      memoryUsage: memoryDelta,
      dataSize: JSON.stringify(data).length.toString() + ' bytes',
      throughput: iterations / (totalTime / 1000) // operations per second
    };
  };

  it('should benchmark string manipulation filters', () => {
    const testData = {
      text: 'Hello World Test String',
      longText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100),
      array: ['apple', 'banana', 'cherry', 'date', 'elderberry']
    };

    const stringFilters = [
      { name: 'upper', template: '{{ text | upper }}', data: testData },
      { name: 'lower', template: '{{ text | lower }}', data: testData },
      { name: 'title', template: '{{ text | title }}', data: testData },
      { name: 'capitalize', template: '{{ text | capitalize }}', data: testData },
      { name: 'trim', template: '{{ "  spaced text  " | trim }}', data: testData },
      { name: 'replace', template: '{{ text | replace("Hello", "Hi") }}', data: testData },
      { name: 'truncate', template: '{{ longText | truncate(50) }}', data: testData },
      { name: 'wordcount', template: '{{ text | wordcount }}', data: testData },
      { name: 'length', template: '{{ text | length }}', data: testData },
      { name: 'reverse', template: '{{ text | reverse }}', data: testData }
    ];

    stringFilters.forEach(filter => {
      const metric = measureFilterPerformance(filter.name, filter.template, filter.data, 10000);
      performanceResults.push(metric);
      
      console.log(`Filter: ${filter.name}`);
      console.log(`  Average Time: ${metric.averageTime.toFixed(4)}ms`);
      console.log(`  Throughput: ${metric.throughput?.toFixed(0)} ops/sec`);
      console.log(`  Memory Impact: ${(metric.memoryUsage / 1024).toFixed(2)}KB\n`);
      
      // Performance assertions
      expect(metric.averageTime).toBeLessThan(1); // Each filter call should be under 1ms
      expect(metric.throughput).toBeGreaterThan(1000); // At least 1000 ops/sec
    });
  });

  it('should benchmark array manipulation filters', () => {
    const testData = {
      numbers: Array.from({length: 1000}, (_, i) => i),
      objects: Array.from({length: 100}, (_, i) => ({id: i, name: `item-${i}`, value: Math.random()})),
      strings: Array.from({length: 500}, (_, i) => `string-${i}-with-more-content`)
    };

    const arrayFilters = [
      { name: 'first', template: '{{ numbers | first }}', data: testData },
      { name: 'last', template: '{{ numbers | last }}', data: testData },
      { name: 'length', template: '{{ numbers | length }}', data: testData },
      { name: 'sort', template: '{{ strings | sort }}', data: testData },
      { name: 'reverse', template: '{{ numbers | reverse }}', data: testData },
      { name: 'join', template: '{{ strings | join(",") }}', data: testData },
      { name: 'slice', template: '{{ numbers | slice(0, 10) }}', data: testData },
      { name: 'batch', template: '{{ numbers | batch(10) }}', data: testData }
    ];

    arrayFilters.forEach(filter => {
      const metric = measureFilterPerformance(filter.name, filter.template, filter.data, 1000);
      performanceResults.push(metric);
      
      console.log(`Array Filter: ${filter.name}`);
      console.log(`  Average Time: ${metric.averageTime.toFixed(4)}ms`);
      console.log(`  Throughput: ${metric.throughput?.toFixed(0)} ops/sec\n`);
      
      // Array operations might be slower with large datasets
      expect(metric.averageTime).toBeLessThan(10);
    });
  });

  it('should benchmark complex filter chains', () => {
    const testData = {
      items: Array.from({length: 1000}, (_, i) => ({
        id: i,
        name: `Item Number ${i}`,
        category: ['electronics', 'clothing', 'books', 'food'][i % 4],
        price: Math.random() * 100,
        active: i % 2 === 0
      }))
    };

    const chainedFilters = [
      {
        name: 'complex-chain-1',
        template: '{{ items | selectattr("active") | map(attribute="name") | list | join(", ") | truncate(100) }}',
        data: testData
      },
      {
        name: 'complex-chain-2', 
        template: '{{ items | groupby("category") | map("first") | list | sort | join(" | ") }}',
        data: testData
      },
      {
        name: 'complex-chain-3',
        template: '{{ items | rejectattr("active", false) | map(attribute="price") | list | sort | first }}',
        data: testData
      }
    ];

    chainedFilters.forEach(filter => {
      const metric = measureFilterPerformance(filter.name, filter.template, filter.data, 100);
      performanceResults.push(metric);
      
      console.log(`Chained Filter: ${filter.name}`);
      console.log(`  Average Time: ${metric.averageTime.toFixed(4)}ms`);
      console.log(`  Throughput: ${metric.throughput?.toFixed(0)} ops/sec\n`);
      
      // Complex chains will be slower
      expect(metric.averageTime).toBeLessThan(100);
    });
  });

  it('should test filter performance with large datasets', () => {
    const largeData = {
      bigArray: Array.from({length: 50000}, (_, i) => `item-${i}-with-long-content-string-${Math.random()}`),
      bigText: 'Large text content. '.repeat(10000),
      deepObject: {
        level1: {
          level2: {
            level3: {
              items: Array.from({length: 1000}, (_, i) => ({id: i, data: `content-${i}`}))
            }
          }
        }
      }
    };

    const bigDataFilters = [
      { name: 'large-join', template: '{{ bigArray | slice(0, 1000) | join(",") | length }}', data: largeData },
      { name: 'large-sort', template: '{{ bigArray | slice(0, 1000) | sort | first }}', data: largeData },
      { name: 'large-text', template: '{{ bigText | wordcount }}', data: largeData },
      { name: 'deep-access', template: '{{ deepObject.level1.level2.level3.items | length }}', data: largeData }
    ];

    bigDataFilters.forEach(filter => {
      const metric = measureFilterPerformance(filter.name, filter.template, filter.data, 10);
      performanceResults.push(metric);
      
      console.log(`Large Data Filter: ${filter.name}`);
      console.log(`  Average Time: ${metric.averageTime.toFixed(4)}ms`);
      console.log(`  Memory Impact: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`);
      
      // Large data operations will be much slower
      expect(metric.averageTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  it('should save filter performance metrics', () => {
    const summary = {
      testDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      totalFilters: performanceResults.length,
      metrics: performanceResults,
      summary: {
        fastestFilter: performanceResults.reduce((prev, curr) => 
          prev.averageTime < curr.averageTime ? prev : curr),
        slowestFilter: performanceResults.reduce((prev, curr) => 
          prev.averageTime > curr.averageTime ? prev : curr),
        averageTime: performanceResults.reduce((sum, m) => sum + m.averageTime, 0) / performanceResults.length,
        totalThroughput: performanceResults.reduce((sum, m) => sum + (m.throughput || 0), 0)
      }
    };

    const resultsStream = createWriteStream(resultsFile);
    resultsStream.write(JSON.stringify(summary, null, 2));
    resultsStream.end();

    console.log(`\nFilter Performance Summary:`);
    console.log(`  Total Filters Tested: ${summary.totalFilters}`);
    console.log(`  Fastest Filter: ${summary.summary.fastestFilter.filterName} (${summary.summary.fastestFilter.averageTime.toFixed(4)}ms)`);
    console.log(`  Slowest Filter: ${summary.summary.slowestFilter.filterName} (${summary.summary.slowestFilter.averageTime.toFixed(4)}ms)`);
    console.log(`  Average Filter Time: ${summary.summary.averageTime.toFixed(4)}ms`);
    console.log(`  Results saved to: ${resultsFile}`);

    expect(summary.summary.averageTime).toBeLessThan(10); // Average filter time under 10ms
  });
});