#!/usr/bin/env node

/**
 * Load Testing for System Throughput
 * Measures concurrent operations and system performance
 */

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

class LoadTester {
  constructor() {
    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      loadTests: [],
      throughputMetrics: {},
      summary: {}
    };
  }

  async simulateLoad(testName, concurrency, operations, operationFn) {
    console.log(`🚀 Running ${testName} with ${concurrency} concurrent operations...`);
    
    const startTime = performance.now();
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      const promise = this.runOperations(operations, operationFn, i);
      promises.push(promise);
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalDuration = endTime - startTime;
    const totalOperations = concurrency * operations;
    const throughput = totalOperations / (totalDuration / 1000); // ops/sec

    const testResult = {
      name: testName,
      concurrency,
      operations,
      totalOperations,
      duration: totalDuration,
      throughput,
      avgLatency: totalDuration / totalOperations,
      results
    };

    this.results.loadTests.push(testResult);
    
    console.log(`📈 ${testName}: ${throughput.toFixed(2)} ops/sec`);
    return testResult;
  }

  async runOperations(count, operationFn, workerId) {
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const startTime = performance.now();
      try {
        await operationFn(workerId, i);
        const endTime = performance.now();
        results.push({
          success: true,
          duration: endTime - startTime
        });
      } catch (error) {
        const endTime = performance.now();
        results.push({
          success: false,
          duration: endTime - startTime,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async runLoadTests() {
    console.log('⚡ Starting Load Performance Tests...');

    // Test 1: Template rendering load
    await this.simulateLoad(
      'Template Rendering Load',
      10, // 10 concurrent workers
      100, // 100 operations each
      async (workerId, opId) => {
        const template = `Hello {{ name }}-${workerId}-${opId}!`;
        // Simulate template processing
        return template.replace(/\{\{\s*name\s*\}\}/g, 'World');
      }
    );

    // Test 2: File operations load
    await this.simulateLoad(
      'File Operations Load',
      5, // 5 concurrent workers
      50, // 50 operations each
      async (workerId, opId) => {
        const content = `Test content ${workerId}-${opId}`;
        // Simulate file processing without actually writing
        return content.length;
      }
    );

    // Test 3: Cache operations load
    await this.simulateLoad(
      'Cache Operations Load',
      20, // 20 concurrent workers
      200, // 200 operations each
      async (workerId, opId) => {
        const cache = new Map();
        cache.set(`key-${workerId}-${opId}`, `value-${workerId}-${opId}`);
        const value = cache.get(`key-${workerId}-${opId}`);
        cache.delete(`key-${workerId}-${opId}`);
        return value;
      }
    );

    this.calculateThroughputMetrics();
    this.generateLoadSummary();
    return this.results;
  }

  calculateThroughputMetrics() {
    const tests = this.results.loadTests;
    
    this.results.throughputMetrics = {
      totalThroughput: tests.reduce((sum, test) => sum + test.throughput, 0),
      avgThroughput: tests.reduce((sum, test) => sum + test.throughput, 0) / tests.length,
      maxThroughput: Math.max(...tests.map(t => t.throughput)),
      minThroughput: Math.min(...tests.map(t => t.throughput)),
      avgLatency: tests.reduce((sum, test) => sum + test.avgLatency, 0) / tests.length
    };
  }

  generateLoadSummary() {
    const metrics = this.results.throughputMetrics;
    const targetThroughput = 100; // 100 ops/sec target
    
    this.results.summary = {
      totalTests: this.results.loadTests.length,
      performanceTarget: targetThroughput,
      meetsTarget: metrics.avgThroughput >= targetThroughput,
      improvementNeeded: targetThroughput - metrics.avgThroughput,
      scalability: metrics.maxThroughput / metrics.minThroughput,
      efficiency: metrics.avgThroughput / metrics.maxThroughput
    };

    console.log('📊 Load Test Summary:');
    console.log(`Average Throughput: ${metrics.avgThroughput.toFixed(2)} ops/sec`);
    console.log(`Max Throughput: ${metrics.maxThroughput.toFixed(2)} ops/sec`);
    console.log(`Average Latency: ${metrics.avgLatency.toFixed(2)}ms`);
    console.log(`Target Met: ${this.results.summary.meetsTarget ? '✅' : '❌'}`);
    console.log(`Scalability Ratio: ${this.results.summary.scalability.toFixed(2)}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LoadTester();
  tester.runLoadTests()
    .then(results => {
      console.log('✅ Load tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Load test failed:', error);
      process.exit(1);
    });
}

export default LoadTester;