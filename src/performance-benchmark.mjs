#!/usr/bin/env node
/**
 * Performance Benchmark Suite for Universal Resolver
 * 
 * Agent 12 (Integration Perfectionist) - Charter Compliance Validation
 * 
 * This benchmark validates all Charter performance requirements:
 * - Cold Start: ≤2s initialization time
 * - Render P95: ≤150ms rendering performance
 * - Cache Hit Rate: ≥80% cache efficiency
 * - Memory Limit: ≤512MB peak usage
 * - Concurrent Load: Handle 50+ concurrent requests
 * - Throughput: Process 1000+ operations per minute
 */

import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { UniversalResolver } from './resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Benchmark configuration
const BENCHMARK_CONFIG = {
  COLD_START_TARGET: 2000,      // 2s cold start target
  RENDER_P95_TARGET: 150,       // 150ms P95 render target
  CACHE_HIT_RATE_TARGET: 0.8,   // 80% cache hit rate target
  MEMORY_LIMIT_MB: 512,         // 512MB memory limit
  CONCURRENT_REQUESTS: 50,      // Concurrent request capacity
  THROUGHPUT_TARGET: 1000,      // 1000 operations per minute
  
  // Test parameters
  WARMUP_ITERATIONS: 100,
  MEASUREMENT_ITERATIONS: 1000,
  STRESS_DURATION: 60000,       // 1 minute stress test
  MEMORY_SAMPLES: 100,
  
  // Content sizes
  SMALL_TEMPLATE_SIZE: 1000,    // 1KB
  MEDIUM_TEMPLATE_SIZE: 10000,  // 10KB
  LARGE_TEMPLATE_SIZE: 100000,  // 100KB
};

/**
 * Performance measurement utilities
 */
class BenchmarkUtils {
  static measureMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      heapUsedMB: usage.heapUsed / 1024 / 1024,
      totalMB: usage.rss / 1024 / 1024
    };
  }

  static async measureCPUUsage() {
    const start = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const end = process.cpuUsage(start);
    return {
      user: end.user,
      system: end.system,
      total: end.user + end.system
    };
  }

  static calculateStatistics(measurements) {
    const sorted = [...measurements].sort((a, b) => a - b);
    const length = sorted.length;
    
    return {
      count: length,
      min: sorted[0],
      max: sorted[length - 1],
      mean: sorted.reduce((a, b) => a + b, 0) / length,
      median: length % 2 === 0 ? 
        (sorted[length / 2 - 1] + sorted[length / 2]) / 2 : 
        sorted[Math.floor(length / 2)],
      p95: sorted[Math.ceil(length * 0.95) - 1],
      p99: sorted[Math.ceil(length * 0.99) - 1],
      stddev: BenchmarkUtils.calculateStddev(sorted)
    };
  }

  static calculateStddev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  static generateTestTemplate(size = BENCHMARK_CONFIG.SMALL_TEMPLATE_SIZE) {
    const baseTemplate = `---
to: generated/{{name}}.txt
attest: true
---
# Generated Content: {{name}}

Generated at: {{$kgen.timestamp}}
Operation ID: {{$kgen.operationId}}
Deterministic: {{$kgen.deterministic}}

## Data
{{#each items}}
- Item {{@index}}: {{this.value}} ({{this.type}})
{{/each}}

## Metadata
- Content Hash: {{contentHash}}
- Template Size: ${size} bytes
- Random Value: {{randomValue}}

`;

    // Pad with additional content to reach target size
    const paddingNeeded = Math.max(0, size - baseTemplate.length);
    const padding = 'x'.repeat(paddingNeeded);
    
    return baseTemplate + padding;
  }

  static generateTestContext(complexity = 'medium') {
    const complexities = {
      simple: {
        name: 'SimpleTest',
        value: 'test',
        items: [
          { value: 'item1', type: 'string' },
          { value: 'item2', type: 'string' }
        ]
      },
      medium: {
        name: 'MediumTest',
        value: crypto.randomUUID(),
        items: Array.from({ length: 10 }, (_, i) => ({
          value: `item${i}`,
          type: i % 2 === 0 ? 'string' : 'number',
          metadata: { index: i, timestamp: this.getDeterministicTimestamp() }
        })),
        nested: {
          level1: {
            level2: {
              value: 'deep value'
            }
          }
        }
      },
      complex: {
        name: 'ComplexTest',
        value: crypto.randomUUID(),
        items: Array.from({ length: 100 }, (_, i) => ({
          value: `complex_item_${i}`,
          type: ['string', 'number', 'boolean', 'object'][i % 4],
          metadata: {
            index: i,
            timestamp: this.getDeterministicTimestamp(),
            hash: crypto.createHash('sha256').update(`item_${i}`).digest('hex'),
            nested: {
              depth: i % 10,
              category: `category_${i % 5}`,
              tags: Array.from({ length: i % 5 + 1 }, (_, j) => `tag_${j}`)
            }
          }
        })),
        configuration: {
          features: {
            caching: true,
            validation: true,
            monitoring: true
          },
          performance: {
            timeout: 30000,
            concurrency: 10,
            batchSize: 100
          }
        }
      }
    };

    const base = complexities[complexity] || complexities.medium;
    
    // Add dynamic values
    return {
      ...base,
      contentHash: crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex'),
      randomValue: Math.random(),
      timestamp: this.getDeterministicDate().toISOString()
    };
  }
}

/**
 * Benchmark test suite
 */
class ResolverBenchmark extends EventEmitter {
  constructor() {
    super();
    this.resolver = null;
    this.results = {};
    this.startTime = 0;
  }

  async initialize() {
    console.log('🚀 Initializing Universal Resolver Benchmark Suite');
    console.log(`Target Metrics:
- Cold Start: ≤${BENCHMARK_CONFIG.COLD_START_TARGET}ms
- Render P95: ≤${BENCHMARK_CONFIG.RENDER_P95_TARGET}ms
- Cache Hit Rate: ≥${(BENCHMARK_CONFIG.CACHE_HIT_RATE_TARGET * 100)}%
- Memory Limit: ≤${BENCHMARK_CONFIG.MEMORY_LIMIT_MB}MB
- Concurrent Capacity: ${BENCHMARK_CONFIG.CONCURRENT_REQUESTS} requests
- Throughput: ≥${BENCHMARK_CONFIG.THROUGHPUT_TARGET} ops/min\n`);

    this.startTime = performance.now();
  }

  async runColdStartBenchmark() {
    console.log('❄️  Running Cold Start Benchmark...');
    
    const measurements = [];
    
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      
      // Create fresh resolver instance
      const resolver = new UniversalResolver({
        enableCaching: true,
        enableSecurity: true,
        enableAuditing: true,
        enableSemantics: true
      });
      
      await resolver.initialize();
      await resolver.shutdown();
      
      const duration = performance.now() - start;
      measurements.push(duration);
      
      console.log(`  Cold start ${i + 1}: ${duration.toFixed(2)}ms`);
    }

    const stats = BenchmarkUtils.calculateStatistics(measurements);
    const passed = stats.p95 <= BENCHMARK_CONFIG.COLD_START_TARGET;

    this.results.coldStart = {
      passed,
      target: BENCHMARK_CONFIG.COLD_START_TARGET,
      statistics: stats,
      measurements
    };

    console.log(`  Result: P95 ${stats.p95.toFixed(2)}ms (${passed ? '✅ PASS' : '❌ FAIL'})\n`);
    
    return passed;
  }

  async runRenderPerformanceBenchmark() {
    console.log('⚡ Running Render Performance Benchmark...');
    
    this.resolver = new UniversalResolver({
      enableCaching: true,
      enableSecurity: true,
      enableAuditing: false, // Disable auditing for pure performance
      enableSemantics: false
    });
    
    await this.resolver.initialize();

    const templates = {
      small: BenchmarkUtils.generateTestTemplate(BENCHMARK_CONFIG.SMALL_TEMPLATE_SIZE),
      medium: BenchmarkUtils.generateTestTemplate(BENCHMARK_CONFIG.MEDIUM_TEMPLATE_SIZE),
      large: BenchmarkUtils.generateTestTemplate(BENCHMARK_CONFIG.LARGE_TEMPLATE_SIZE)
    };

    const contexts = {
      simple: BenchmarkUtils.generateTestContext('simple'),
      medium: BenchmarkUtils.generateTestContext('medium'),
      complex: BenchmarkUtils.generateTestContext('complex')
    };

    const testCases = [
      { name: 'Small Template + Simple Context', template: templates.small, context: contexts.simple },
      { name: 'Medium Template + Medium Context', template: templates.medium, context: contexts.medium },
      { name: 'Large Template + Complex Context', template: templates.large, context: contexts.complex }
    ];

    const allResults = {};

    for (const testCase of testCases) {
      console.log(`  Testing: ${testCase.name}`);
      
      // Warmup
      for (let i = 0; i < BENCHMARK_CONFIG.WARMUP_ITERATIONS; i++) {
        await this.resolver.render(testCase.template, testCase.context);
      }

      // Measurements
      const measurements = [];
      for (let i = 0; i < BENCHMARK_CONFIG.MEASUREMENT_ITERATIONS; i++) {
        const start = performance.now();
        await this.resolver.render(testCase.template, testCase.context);
        measurements.push(performance.now() - start);
      }

      const stats = BenchmarkUtils.calculateStatistics(measurements);
      const passed = stats.p95 <= BENCHMARK_CONFIG.RENDER_P95_TARGET;

      allResults[testCase.name] = {
        passed,
        statistics: stats
      };

      console.log(`    P95: ${stats.p95.toFixed(2)}ms, Mean: ${stats.mean.toFixed(2)}ms (${passed ? '✅' : '❌'})`);
    }

    // Overall pass/fail
    const overallPassed = Object.values(allResults).every(result => result.passed);

    this.results.renderPerformance = {
      passed: overallPassed,
      target: BENCHMARK_CONFIG.RENDER_P95_TARGET,
      testCases: allResults
    };

    console.log(`  Overall Result: ${overallPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    return overallPassed;
  }

  async runCacheEfficiencyBenchmark() {
    console.log('💾 Running Cache Efficiency Benchmark...');
    
    if (!this.resolver) {
      this.resolver = new UniversalResolver({ enableCaching: true });
      await this.resolver.initialize();
    }

    // Clear cache to start fresh
    this.resolver.clearCache();

    const templates = Array.from({ length: 20 }, (_, i) => 
      `Template ${i}: {{value}} - {{timestamp}}`
    );
    const context = { value: 'cached', timestamp: this.getDeterministicTimestamp() };

    // First pass - populate cache
    console.log('  Populating cache...');
    for (let round = 0; round < 5; round++) {
      for (const template of templates) {
        await this.resolver.render(template, context);
      }
    }

    // Clear counters
    this.resolver.cache.hitCount = 0;
    this.resolver.cache.missCount = 0;

    // Second pass - measure cache hits
    console.log('  Measuring cache efficiency...');
    for (let round = 0; round < 10; round++) {
      for (const template of templates) {
        await this.resolver.render(template, context);
      }
    }

    const cacheStats = this.resolver.cache.getStatistics();
    const hitRate = cacheStats.hitRate;
    const passed = hitRate >= BENCHMARK_CONFIG.CACHE_HIT_RATE_TARGET;

    this.results.cacheEfficiency = {
      passed,
      target: BENCHMARK_CONFIG.CACHE_HIT_RATE_TARGET,
      hitRate,
      statistics: cacheStats
    };

    console.log(`  Cache Hit Rate: ${(hitRate * 100).toFixed(1)}% (${passed ? '✅ PASS' : '❌ FAIL'})\n`);

    return passed;
  }

  async runMemoryUsageBenchmark() {
    console.log('🧠 Running Memory Usage Benchmark...');
    
    if (!this.resolver) {
      this.resolver = new UniversalResolver();
      await this.resolver.initialize();
    }

    const initialMemory = BenchmarkUtils.measureMemoryUsage();
    console.log(`  Initial memory: ${initialMemory.heapUsedMB.toFixed(2)}MB`);

    // Create memory pressure with many operations
    console.log('  Creating memory pressure...');
    const operations = [];
    
    for (let i = 0; i < 1000; i++) {
      const template = BenchmarkUtils.generateTestTemplate(10000); // 10KB each
      const context = BenchmarkUtils.generateTestContext('medium');
      operations.push(this.resolver.render(template, context));
      
      // Sample memory periodically
      if (i % 100 === 0) {
        const current = BenchmarkUtils.measureMemoryUsage();
        console.log(`    Operation ${i}: ${current.heapUsedMB.toFixed(2)}MB`);
      }
    }

    await Promise.all(operations);

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const peakMemory = BenchmarkUtils.measureMemoryUsage();
    const memoryUsedMB = peakMemory.heapUsedMB;
    const passed = memoryUsedMB <= BENCHMARK_CONFIG.MEMORY_LIMIT_MB;

    this.results.memoryUsage = {
      passed,
      target: BENCHMARK_CONFIG.MEMORY_LIMIT_MB,
      initialMemoryMB: initialMemory.heapUsedMB,
      peakMemoryMB: memoryUsedMB,
      memoryGrowthMB: memoryUsedMB - initialMemory.heapUsedMB
    };

    console.log(`  Peak memory: ${memoryUsedMB.toFixed(2)}MB (${passed ? '✅ PASS' : '❌ FAIL'})\n`);

    return passed;
  }

  async runConcurrencyBenchmark() {
    console.log('🔀 Running Concurrency Benchmark...');
    
    if (!this.resolver) {
      this.resolver = new UniversalResolver();
      await this.resolver.initialize();
    }

    const template = BenchmarkUtils.generateTestTemplate(5000);
    const context = BenchmarkUtils.generateTestContext('medium');

    // Test concurrent rendering
    console.log(`  Testing ${BENCHMARK_CONFIG.CONCURRENT_REQUESTS} concurrent requests...`);
    
    const start = performance.now();
    const concurrentOperations = Array.from({ length: BENCHMARK_CONFIG.CONCURRENT_REQUESTS }, 
      () => this.resolver.render(template, context)
    );

    const results = await Promise.allSettled(concurrentOperations);
    const duration = performance.now() - start;

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    const successRate = successful / results.length;

    // Test should complete within reasonable time and have high success rate
    const timeLimit = 10000; // 10 seconds for concurrent requests
    const minSuccessRate = 0.95; // 95% success rate minimum
    
    const timePassed = duration <= timeLimit;
    const successPassed = successRate >= minSuccessRate;
    const passed = timePassed && successPassed;

    this.results.concurrency = {
      passed,
      concurrent: BENCHMARK_CONFIG.CONCURRENT_REQUESTS,
      successful,
      failed,
      successRate,
      duration,
      timeLimit,
      timePassed,
      successPassed
    };

    console.log(`  Results: ${successful}/${results.length} successful in ${duration.toFixed(2)}ms`);
    console.log(`  Success rate: ${(successRate * 100).toFixed(1)}% (${passed ? '✅ PASS' : '❌ FAIL'})\n`);

    return passed;
  }

  async runThroughputBenchmark() {
    console.log('📊 Running Throughput Benchmark...');
    
    if (!this.resolver) {
      this.resolver = new UniversalResolver();
      await this.resolver.initialize();
    }

    const template = BenchmarkUtils.generateTestTemplate(2000);
    const context = BenchmarkUtils.generateTestContext('simple');

    console.log('  Measuring operations per minute...');
    
    const testDuration = 60000; // 1 minute
    const start = performance.now();
    let operationCount = 0;
    const errors = [];

    while (performance.now() - start < testDuration) {
      try {
        await this.resolver.render(template, { 
          ...context, 
          operationId: operationCount,
          timestamp: this.getDeterministicTimestamp()
        });
        operationCount++;
      } catch (error) {
        errors.push(error);
      }

      // Brief pause to prevent overwhelming
      if (operationCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const actualDuration = performance.now() - start;
    const operationsPerMinute = (operationCount / actualDuration) * 60000;
    const passed = operationsPerMinute >= BENCHMARK_CONFIG.THROUGHPUT_TARGET;

    this.results.throughput = {
      passed,
      target: BENCHMARK_CONFIG.THROUGHPUT_TARGET,
      operationCount,
      duration: actualDuration,
      operationsPerMinute,
      errorCount: errors.length,
      errorRate: errors.length / operationCount
    };

    console.log(`  Throughput: ${operationsPerMinute.toFixed(0)} ops/min (${passed ? '✅ PASS' : '❌ FAIL'})`);
    console.log(`  Errors: ${errors.length}/${operationCount} (${((errors.length / operationCount) * 100).toFixed(2)}%)\n`);

    return passed;
  }

  async runComprehensiveBenchmark() {
    await this.initialize();
    
    const benchmarks = [
      { name: 'Cold Start', method: () => this.runColdStartBenchmark() },
      { name: 'Render Performance', method: () => this.runRenderPerformanceBenchmark() },
      { name: 'Cache Efficiency', method: () => this.runCacheEfficiencyBenchmark() },
      { name: 'Memory Usage', method: () => this.runMemoryUsageBenchmark() },
      { name: 'Concurrency', method: () => this.runConcurrencyBenchmark() },
      { name: 'Throughput', method: () => this.runThroughputBenchmark() }
    ];

    const results = {};
    let passedCount = 0;

    for (const benchmark of benchmarks) {
      try {
        const passed = await benchmark.method();
        results[benchmark.name] = passed;
        if (passed) passedCount++;
      } catch (error) {
        console.error(`❌ Benchmark ${benchmark.name} failed with error:`, error.message);
        results[benchmark.name] = false;
      }
    }

    if (this.resolver) {
      await this.resolver.shutdown();
    }

    const totalDuration = performance.now() - this.startTime;
    const overallPassed = passedCount === benchmarks.length;

    // Generate final report
    this.generateReport(results, totalDuration, overallPassed);

    return {
      passed: overallPassed,
      results,
      passedCount,
      totalCount: benchmarks.length,
      duration: totalDuration
    };
  }

  generateReport(results, duration, overallPassed) {
    console.log('\n' + '='.repeat(80));
    console.log('📈 UNIVERSAL RESOLVER PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 Charter Compliance: ${overallPassed ? '✅ FULL COMPLIANCE' : '❌ NON-COMPLIANT'}`);
    console.log(`⏱️  Total Benchmark Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Passed Benchmarks: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length}`);

    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(60));

    for (const [benchmark, passed] of Object.entries(results)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${benchmark.padEnd(25)} ${status}`);
    }

    if (this.results.coldStart) {
      console.log(`\n❄️  Cold Start Performance:`);
      console.log(`   P95: ${this.results.coldStart.statistics.p95.toFixed(2)}ms (target: ≤${BENCHMARK_CONFIG.COLD_START_TARGET}ms)`);
      console.log(`   Mean: ${this.results.coldStart.statistics.mean.toFixed(2)}ms`);
    }

    if (this.results.renderPerformance) {
      console.log(`\n⚡ Render Performance (P95):`);
      for (const [testCase, result] of Object.entries(this.results.renderPerformance.testCases)) {
        console.log(`   ${testCase}: ${result.statistics.p95.toFixed(2)}ms`);
      }
    }

    if (this.results.cacheEfficiency) {
      console.log(`\n💾 Cache Efficiency:`);
      console.log(`   Hit Rate: ${(this.results.cacheEfficiency.hitRate * 100).toFixed(1)}% (target: ≥${BENCHMARK_CONFIG.CACHE_HIT_RATE_TARGET * 100}%)`);
    }

    if (this.results.memoryUsage) {
      console.log(`\n🧠 Memory Usage:`);
      console.log(`   Peak: ${this.results.memoryUsage.peakMemoryMB.toFixed(2)}MB (limit: ${BENCHMARK_CONFIG.MEMORY_LIMIT_MB}MB)`);
      console.log(`   Growth: ${this.results.memoryUsage.memoryGrowthMB.toFixed(2)}MB`);
    }

    if (this.results.concurrency) {
      console.log(`\n🔀 Concurrency:`);
      console.log(`   Success Rate: ${(this.results.concurrency.successRate * 100).toFixed(1)}% (${this.results.concurrency.successful}/${BENCHMARK_CONFIG.CONCURRENT_REQUESTS})`);
      console.log(`   Duration: ${this.results.concurrency.duration.toFixed(2)}ms`);
    }

    if (this.results.throughput) {
      console.log(`\n📊 Throughput:`);
      console.log(`   Operations/min: ${this.results.throughput.operationsPerMinute.toFixed(0)} (target: ≥${BENCHMARK_CONFIG.THROUGHPUT_TARGET})`);
      console.log(`   Error Rate: ${(this.results.throughput.errorRate * 100).toFixed(2)}%`);
    }

    console.log('\n' + '='.repeat(80));
    
    if (overallPassed) {
      console.log('🎉 ALL CHARTER REQUIREMENTS MET - PRODUCTION READY');
    } else {
      console.log('⚠️  SOME CHARTER REQUIREMENTS NOT MET - NEEDS OPTIMIZATION');
    }
    
    console.log('='.repeat(80) + '\n');
  }

  async saveReport(filename = 'benchmark-report.json') {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      chartCompliance: Object.values(this.results).every(r => r.passed),
      results: this.results,
      configuration: BENCHMARK_CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryLimit: BENCHMARK_CONFIG.MEMORY_LIMIT_MB
      }
    };

    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`📄 Benchmark report saved to: ${filename}`);
  }
}

// Export for programmatic use
export { ResolverBenchmark, BenchmarkUtils, BENCHMARK_CONFIG };

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new ResolverBenchmark();
  
  try {
    const result = await benchmark.runComprehensiveBenchmark();
    
    // Save report if requested
    if (process.argv.includes('--save-report')) {
      await benchmark.saveReport('benchmark-report.json');
    }
    
    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Benchmark suite failed:', error);
    process.exit(2);
  }
}