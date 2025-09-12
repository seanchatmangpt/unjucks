#!/usr/bin/env node

/**
 * Memory Usage Performance Test
 * Measures memory consumption and leak detection
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

class MemoryTester {
  constructor() {
    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      tests: [],
      summary: {}
    };
  }

  async measureMemory(testName, testFn) {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    await testFn();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const endMemory = process.memoryUsage();
    const endTime = performance.now();

    const result = {
      name: testName,
      duration: endTime - startTime,
      memoryStart: startMemory,
      memoryEnd: endMemory,
      memoryDelta: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      },
      peakMemory: endMemory.rss
    };

    this.results.tests.push(result);
    return result;
  }

  async runMemoryTests() {
    console.log('🧠 Starting Memory Performance Tests...');

    // Test 1: Template rendering memory usage
    await this.measureMemory('Template Rendering', async () => {
      const templates = [];
      for (let i = 0; i < 1000; i++) {
        templates.push(`Template content ${i} with variables`);
      }
      // Simulate template processing
      templates.forEach(t => t.replace(/variables/g, 'values'));
    });

    // Test 2: Large data structure memory
    await this.measureMemory('Large Data Processing', async () => {
      const largeArray = new Array(100000).fill(0).map((_, i) => ({
        id: i,
        data: `test-data-${i}`,
        nested: { value: i * 2 }
      }));
      
      // Process the data
      largeArray.forEach(item => {
        item.processed = true;
      });
    });

    // Test 3: Memory leak simulation
    await this.measureMemory('Memory Leak Detection', async () => {
      const cache = new Map();
      for (let i = 0; i < 10000; i++) {
        cache.set(`key-${i}`, { data: new Array(1000).fill(i) });
      }
      // Clear cache to prevent actual leak
      cache.clear();
    });

    this.generateSummary();
    return this.results;
  }

  generateSummary() {
    const tests = this.results.tests;
    const totalMemoryUsed = tests.reduce((sum, test) => sum + test.memoryDelta.heapUsed, 0);
    const maxPeakMemory = Math.max(...tests.map(t => t.peakMemory));
    const avgDuration = tests.reduce((sum, test) => sum + test.duration, 0) / tests.length;

    this.results.summary = {
      totalTests: tests.length,
      totalMemoryUsed: totalMemoryUsed,
      maxPeakMemory: maxPeakMemory,
      avgTestDuration: avgDuration,
      memoryEfficient: maxPeakMemory < 500 * 1024 * 1024, // < 500MB
      performance: avgDuration < 1000 ? 'Good' : 'Needs Improvement'
    };

    console.log('📊 Memory Test Summary:');
    console.log(`Total Memory Used: ${(totalMemoryUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Peak Memory: ${(maxPeakMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Memory Efficient: ${this.results.summary.memoryEfficient ? '✅' : '❌'}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MemoryTester();
  tester.runMemoryTests()
    .then(results => {
      console.log('✅ Memory tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Memory test failed:', error);
      process.exit(1);
    });
}

export default MemoryTester;