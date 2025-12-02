/**
 * Benchmarking and Load Testing Step Definitions
 * 
 * These step definitions provide comprehensive benchmarking capabilities
 * for stress testing, load testing, and performance regression detection.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { performance, PerformanceObserver } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Import performance infrastructure
import { CASEngine } from '../../packages/kgen-core/src/cas/index.js';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';
import PerformanceTracker from '../../packages/kgen-core/dist/metrics/performance-tracker.js';

// Import test fixtures
import {
  PerformanceScenarios,
  CacheTestPatterns,
  PerformanceBenchmarkRunner
} from '../fixtures/performance-test-data.js';

// Benchmarking test context
interface BenchmarkContext {
  casEngine: CASEngine;
  templateEngine: KgenTemplateEngine;
  performanceTracker: PerformanceTracker;
  benchmarkRunner: PerformanceBenchmarkRunner;
  baselineMetrics: Map<string, any>;
  currentMetrics: Map<string, any>;
  loadTestResults: Array<any>;
  concurrencyResults: Array<any>;
  memoryProfileData: Array<any>;
  regressionResults: Map<string, any>;
  testConfiguration: any;
  performanceObserver: PerformanceObserver | null;
  gcStats: Array<any>;
  systemMetrics: Array<any>;
}

let benchmarkContext: BenchmarkContext = {
  casEngine: new CASEngine({
    storageType: 'memory',
    cacheSize: 10000,
    enableMetrics: true,
    performanceTarget: {
      hashTimeP95: 5,
      cacheHitRate: 0.80,
      renderTimeP95: 150,
      memoryGrowthRate: 1048576 // 1MB/s
    }
  }),
  templateEngine: new KgenTemplateEngine({
    deterministic: true,
    enablePerformanceMetrics: true,
    cacheSize: 5000
  }),
  performanceTracker: new PerformanceTracker({
    enableRealtimeCollection: true,
    collectionInterval: 100,
    enableHistoricalStorage: true,
    performanceThresholds: {
      memory_warning: 80,
      cpu_warning: 70,
      latency_warning: 200,
      cache_hit_warning: 75,
      error_rate_warning: 0.001
    }
  }),
  benchmarkRunner: new PerformanceBenchmarkRunner(),
  baselineMetrics: new Map(),
  currentMetrics: new Map(),
  loadTestResults: [],
  concurrencyResults: [],
  memoryProfileData: [],
  regressionResults: new Map(),
  testConfiguration: {},
  performanceObserver: null,
  gcStats: [],
  systemMetrics: []
};

// =============================================================================
// High-Load Performance Testing Steps
// =============================================================================

Given('I have configured high-load test parameters', function() {
  benchmarkContext.testConfiguration = {
    highLoad: {
      operations: 50000,
      concurrency: 20,
      rampUpTime: 30000, // 30 seconds
      sustainTime: 120000, // 2 minutes
      rampDownTime: 30000, // 30 seconds
      maxMemoryGrowth: 0.20, // 20% above baseline
      maxErrorRate: 0.001 // 0.1%
    },
    monitoring: {
      sampleInterval: 1000, // 1 second
      memoryCheckInterval: 5000, // 5 seconds
      gcMonitoring: true,
      systemResourceMonitoring: true
    }
  };
  
  console.log('High-load test parameters configured');
});

When('I execute {int} operations across all performance categories', async function(totalOperations: number) {
  const config = benchmarkContext.testConfiguration.highLoad;
  const categories = ['template_rendering', 'cas_operations', 'cache_operations', 'rdf_processing'];
  const operationsPerCategory = Math.floor(totalOperations / categories.length);
  
  // Start system monitoring
  await startSystemMonitoring();
  
  // Start performance observation
  startPerformanceObservation();
  
  // Initialize baseline memory
  const baselineMemory = process.memoryUsage();
  benchmarkContext.baselineMetrics.set('memory_baseline', baselineMemory);
  
  console.log(`Starting high-load test: ${totalOperations} operations across ${categories.length} categories`);
  
  try {
    // Ramp up phase
    console.log('Ramp-up phase starting...');
    await rampUpOperations(operationsPerCategory, config.rampUpTime);
    
    // Sustained load phase
    console.log('Sustained load phase starting...');
    await sustainedLoadOperations(operationsPerCategory, config.sustainTime);
    
    // Ramp down phase
    console.log('Ramp-down phase starting...');
    await rampDownOperations(operationsPerCategory, config.rampDownTime);
    
  } finally {
    // Stop monitoring
    stopPerformanceObservation();
    await stopSystemMonitoring();
  }
  
  console.log(`High-load test completed: ${benchmarkContext.loadTestResults.length} results recorded`);
});

async function rampUpOperations(operations: number, duration: number): Promise<void> {
  const startTime = Date.now();
  const endTime = startTime + duration;
  let operationsCompleted = 0;
  
  while (Date.now() < endTime && operationsCompleted < operations) {
    const currentTime = Date.now();
    const progress = (currentTime - startTime) / duration;
    const targetOpsPerSecond = Math.floor(progress * (operations / (duration / 1000)));
    
    const batchSize = Math.min(10, Math.ceil(targetOpsPerSecond / 10));
    
    await Promise.all(Array.from({ length: batchSize }, () => executeRandomOperation()));
    
    operationsCompleted += batchSize;
    
    // Small delay to control rate
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function sustainedLoadOperations(operations: number, duration: number): Promise<void> {
  const startTime = Date.now();
  const endTime = startTime + duration;
  const opsPerSecond = operations / (duration / 1000);
  const batchSize = Math.max(1, Math.floor(opsPerSecond / 10)); // 10 batches per second
  const batchInterval = 100; // 100ms between batches
  
  let operationsCompleted = 0;
  
  while (Date.now() < endTime && operationsCompleted < operations) {
    const batchStartTime = performance.now();
    
    await Promise.all(Array.from({ length: batchSize }, () => executeRandomOperation()));
    
    operationsCompleted += batchSize;
    
    const batchDuration = performance.now() - batchStartTime;
    const remainingTime = Math.max(0, batchInterval - batchDuration);
    
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
  }
}

async function rampDownOperations(operations: number, duration: number): Promise<void> {
  const startTime = Date.now();
  const endTime = startTime + duration;
  let operationsCompleted = 0;
  
  while (Date.now() < endTime && operationsCompleted < operations) {
    const currentTime = Date.now();
    const progress = (currentTime - startTime) / duration;
    const remainingProgress = 1 - progress;
    const targetOpsPerSecond = Math.floor(remainingProgress * (operations / (duration / 1000)));
    
    if (targetOpsPerSecond > 0) {
      const batchSize = Math.min(5, Math.ceil(targetOpsPerSecond / 10));
      
      await Promise.all(Array.from({ length: batchSize }, () => executeRandomOperation()));
      
      operationsCompleted += batchSize;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function executeRandomOperation(): Promise<void> {
  const operations = [
    async () => {
      // Template rendering operation
      const scenario = PerformanceScenarios[Math.floor(Math.random() * PerformanceScenarios.length)];
      const result = await benchmarkContext.templateEngine.render(scenario.template, scenario.variables);
      return { type: 'template_render', size: result.content.length };
    },
    async () => {
      // CAS storage operation
      const content = `test-content-${Date.now()}-${Math.random()}`;
      const hash = await benchmarkContext.casEngine.store(content);
      return { type: 'cas_store', hash, size: content.length };
    },
    async () => {
      // Cache operation
      const key = `cache-key-${Math.floor(Math.random() * 1000)}`;
      const content = await benchmarkContext.casEngine.retrieveByKey(key);
      return { type: 'cache_retrieve', found: content !== null };
    }
  ];
  
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    benchmarkContext.loadTestResults.push({
      ...result,
      duration,
      success: true,
      timestamp: Date.now()
    });
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    benchmarkContext.loadTestResults.push({
      type: 'error',
      duration,
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

// =============================================================================
// System Monitoring Functions
// =============================================================================

async function startSystemMonitoring(): Promise<void> {
  const monitoringInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    benchmarkContext.systemMetrics.push({
      timestamp: Date.now(),
      memory: memUsage,
      cpu: cpuUsage,
      load: os.loadavg(),
      uptime: process.uptime()
    });
  }, benchmarkContext.testConfiguration.monitoring.sampleInterval);
  
  benchmarkContext.testConfiguration.monitoringInterval = monitoringInterval;
}

async function stopSystemMonitoring(): Promise<void> {
  if (benchmarkContext.testConfiguration.monitoringInterval) {
    clearInterval(benchmarkContext.testConfiguration.monitoringInterval);
  }
}

function startPerformanceObservation(): void {
  benchmarkContext.performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    for (const entry of entries) {
      if (entry.entryType === 'gc') {
        benchmarkContext.gcStats.push({
          timestamp: Date.now(),
          kind: (entry as any).kind,
          duration: entry.duration,
          flags: (entry as any).flags
        });
      }
    }
  });
  
  benchmarkContext.performanceObserver.observe({ entryTypes: ['gc'] });
}

function stopPerformanceObservation(): void {
  if (benchmarkContext.performanceObserver) {
    benchmarkContext.performanceObserver.disconnect();
    benchmarkContext.performanceObserver = null;
  }
}

// =============================================================================
// Validation Steps for High-Load Testing
// =============================================================================

Then('system should maintain KPI compliance under load', function() {
  const results = benchmarkContext.loadTestResults;
  const successfulResults = results.filter(r => r.success);
  const errorRate = (results.length - successfulResults.length) / results.length;
  
  // Validate error rate
  expect(errorRate).to.be.below(0.001, `Error rate ${errorRate} should be below 0.1%`);
  
  // Validate performance consistency
  const durations = successfulResults.map(r => r.duration);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const p95Duration = durations.sort((a, b) => a - b)[Math.ceil(durations.length * 0.95) - 1];
  
  expect(p95Duration).to.be.below(200, `P95 duration ${p95Duration}ms should remain below 200ms under load`);
  
  console.log(`Load test validation: ${errorRate * 100}% error rate, ${p95Duration.toFixed(2)}ms P95 duration`);
});

Then('memory usage should not exceed baseline by more than {float}% threshold', function(threshold: number) {
  const baseline = benchmarkContext.baselineMetrics.get('memory_baseline');
  const currentMetrics = benchmarkContext.systemMetrics;
  
  if (currentMetrics.length === 0) {
    throw new Error('No system metrics collected during test');
  }
  
  const maxMemoryUsage = Math.max(...currentMetrics.map(m => m.memory.heapUsed));
  const memoryGrowthRatio = (maxMemoryUsage - baseline.heapUsed) / baseline.heapUsed;
  const memoryGrowthPercent = memoryGrowthRatio * 100;
  
  expect(memoryGrowthPercent).to.be.below(threshold, 
    `Memory growth ${memoryGrowthPercent.toFixed(1)}% should not exceed ${threshold}%`);
  
  benchmarkContext.currentMetrics.set('memory_growth', {
    baseline: baseline.heapUsed,
    peak: maxMemoryUsage,
    growthPercent: memoryGrowthPercent,
    withinThreshold: memoryGrowthPercent < threshold
  });
  
  console.log(`Memory validation: ${memoryGrowthPercent.toFixed(1)}% growth (threshold: ${threshold}%)`);
});

Then('error rate should remain below {float}%', function(maxErrorRate: number) {
  const results = benchmarkContext.loadTestResults;
  const errorCount = results.filter(r => !r.success).length;
  const actualErrorRate = (errorCount / results.length) * 100;
  
  expect(actualErrorRate).to.be.below(maxErrorRate, 
    `Error rate ${actualErrorRate.toFixed(3)}% should be below ${maxErrorRate}%`);
  
  benchmarkContext.currentMetrics.set('error_rate', {
    total: results.length,
    errors: errorCount,
    rate: actualErrorRate,
    withinThreshold: actualErrorRate < maxErrorRate
  });
  
  console.log(`Error rate validation: ${actualErrorRate.toFixed(3)}% (threshold: ${maxErrorRate}%)`);
});

// =============================================================================
// Performance Regression Detection Steps
// =============================================================================

Given('I have baseline performance metrics', async function() {
  // Load or generate baseline metrics
  const baselineFile = path.join(process.cwd(), 'test-workspace', 'baseline-metrics.json');
  
  try {
    const baselineData = await fs.readFile(baselineFile, 'utf-8');
    const baseline = JSON.parse(baselineData);
    
    for (const [key, value] of Object.entries(baseline)) {
      benchmarkContext.baselineMetrics.set(key, value);
    }
    
    console.log(`Loaded baseline metrics: ${benchmarkContext.baselineMetrics.size} metrics`);
    
  } catch (error) {
    // Generate baseline metrics if file doesn't exist
    console.log('Generating new baseline metrics...');
    await generateBaselineMetrics();
    
    // Save baseline for future use
    const baselineData = Object.fromEntries(benchmarkContext.baselineMetrics);
    await fs.writeFile(baselineFile, JSON.stringify(baselineData, null, 2));
  }
});

async function generateBaselineMetrics(): Promise<void> {
  const scenarios = PerformanceScenarios.slice(0, 3); // Use first 3 scenarios for baseline
  
  for (const scenario of scenarios) {
    const stats = await benchmarkContext.benchmarkRunner.runScenario(scenario, benchmarkContext.templateEngine);
    
    benchmarkContext.baselineMetrics.set(`${scenario.name}_p95`, stats.p95Duration);
    benchmarkContext.baselineMetrics.set(`${scenario.name}_avg`, stats.avgDuration);
    benchmarkContext.baselineMetrics.set(`${scenario.name}_success_rate`, 
      stats.successfulIterations / stats.totalIterations);
  }
  
  // Add system-level baselines
  const memUsage = process.memoryUsage();
  benchmarkContext.baselineMetrics.set('memory_baseline', memUsage.heapUsed);
  benchmarkContext.baselineMetrics.set('cache_baseline', 0.8); // 80% hit rate
}

When('I compare current performance against baseline', async function() {
  const scenarios = PerformanceScenarios.slice(0, 3);
  
  for (const scenario of scenarios) {
    const currentStats = await benchmarkContext.benchmarkRunner.runScenario(
      scenario, 
      benchmarkContext.templateEngine
    );
    
    benchmarkContext.currentMetrics.set(`${scenario.name}_p95`, currentStats.p95Duration);
    benchmarkContext.currentMetrics.set(`${scenario.name}_avg`, currentStats.avgDuration);
    benchmarkContext.currentMetrics.set(`${scenario.name}_success_rate`, 
      currentStats.successfulIterations / currentStats.totalIterations);
    
    // Calculate regression percentages
    const baselineP95 = benchmarkContext.baselineMetrics.get(`${scenario.name}_p95`);
    const regressionPercent = ((currentStats.p95Duration - baselineP95) / baselineP95) * 100;
    
    benchmarkContext.regressionResults.set(scenario.name, {
      baselineP95,
      currentP95: currentStats.p95Duration,
      regressionPercent,
      isRegression: regressionPercent > 5 // 5% threshold
    });
  }
  
  console.log(`Regression analysis completed for ${scenarios.length} scenarios`);
});

Then('performance degradation should be below {float}% threshold', function(threshold: number) {
  const regressions = Array.from(benchmarkContext.regressionResults.values());
  
  regressions.forEach(regression => {
    expect(regression.regressionPercent).to.be.below(threshold,
      `Regression ${regression.regressionPercent.toFixed(1)}% should be below ${threshold}%`);
  });
  
  const avgRegression = regressions.reduce((sum, r) => sum + r.regressionPercent, 0) / regressions.length;
  
  benchmarkContext.currentMetrics.set('regression_analysis', {
    averageRegression: avgRegression,
    maxRegression: Math.max(...regressions.map(r => r.regressionPercent)),
    scenarios: regressions.length,
    withinThreshold: avgRegression < threshold
  });
  
  console.log(`Performance regression validation: ${avgRegression.toFixed(1)}% average regression`);
});

Then('any significant regressions should be flagged', function() {
  const significantRegressions = Array.from(benchmarkContext.regressionResults.entries())
    .filter(([_, regression]) => regression.isRegression);
  
  if (significantRegressions.length > 0) {
    console.warn(`⚠️  ${significantRegressions.length} significant regressions detected:`);
    significantRegressions.forEach(([scenario, regression]) => {
      console.warn(`  - ${scenario}: ${regression.regressionPercent.toFixed(1)}% slower (${regression.baselineP95}ms → ${regression.currentP95}ms)`);
    });
  }
  
  benchmarkContext.currentMetrics.set('flagged_regressions', significantRegressions.length);
});

Then('regression analysis report should be generated', async function() {
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      scenarios_tested: benchmarkContext.regressionResults.size,
      significant_regressions: Array.from(benchmarkContext.regressionResults.values())
        .filter(r => r.isRegression).length,
      average_regression: Array.from(benchmarkContext.regressionResults.values())
        .reduce((sum, r) => sum + r.regressionPercent, 0) / benchmarkContext.regressionResults.size
    },
    details: Object.fromEntries(benchmarkContext.regressionResults),
    recommendations: generateRegressionRecommendations()
  };
  
  const reportPath = path.join(process.cwd(), 'test-workspace', 'regression-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  benchmarkContext.currentMetrics.set('regression_report', report);
  
  console.log(`Regression analysis report saved to: ${reportPath}`);
});

function generateRegressionRecommendations(): string[] {
  const recommendations: string[] = [];
  const regressions = Array.from(benchmarkContext.regressionResults.values());
  
  const avgRegression = regressions.reduce((sum, r) => sum + r.regressionPercent, 0) / regressions.length;
  
  if (avgRegression > 10) {
    recommendations.push('Consider profiling recent code changes for performance bottlenecks');
    recommendations.push('Review template complexity and optimization opportunities');
  }
  
  if (regressions.some(r => r.regressionPercent > 20)) {
    recommendations.push('Critical performance regression detected - immediate investigation required');
  }
  
  const memoryGrowth = benchmarkContext.currentMetrics.get('memory_growth');
  if (memoryGrowth && memoryGrowth.growthPercent > 15) {
    recommendations.push('Memory usage increased significantly - check for memory leaks');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance is stable - no immediate action required');
  }
  
  return recommendations;
}

// =============================================================================
// Concurrency Testing Steps
// =============================================================================

Given('I have configured concurrent execution', function() {
  benchmarkContext.testConfiguration.concurrency = {
    threads: 10,
    operationsPerThread: 100,
    rampUpDelay: 100, // ms delay between thread starts
    syncPoints: true, // Use synchronization points
    sharedResources: true // Test shared resource access
  };
  
  console.log('Concurrent execution configuration set');
});

When('I execute {int} operations with {int} concurrent threads', async function(totalOps: number, threadCount: number) {
  const opsPerThread = Math.floor(totalOps / threadCount);
  const promises: Promise<any>[] = [];
  
  console.log(`Starting ${threadCount} concurrent threads with ${opsPerThread} operations each`);
  
  for (let threadId = 0; threadId < threadCount; threadId++) {
    const promise = executeConcurrentThread(threadId, opsPerThread);
    promises.push(promise);
    
    // Small stagger to prevent thundering herd
    if (benchmarkContext.testConfiguration.concurrency.rampUpDelay > 0) {
      await new Promise(resolve => 
        setTimeout(resolve, benchmarkContext.testConfiguration.concurrency.rampUpDelay)
      );
    }
  }
  
  const results = await Promise.all(promises);
  
  // Flatten results from all threads
  results.forEach((threadResults, threadId) => {
    threadResults.forEach((result: any) => {
      benchmarkContext.concurrencyResults.push({
        ...result,
        threadId
      });
    });
  });
  
  console.log(`Concurrency test completed: ${benchmarkContext.concurrencyResults.length} total operations`);
});

async function executeConcurrentThread(threadId: number, operations: number): Promise<any[]> {
  const results: any[] = [];
  
  for (let opId = 0; opId < operations; opId++) {
    const startTime = performance.now();
    
    try {
      // Mix of operations to test different concurrency scenarios
      let result;
      const opType = opId % 3;
      
      switch (opType) {
        case 0:
          // Template rendering (CPU intensive)
          result = await benchmarkContext.templateEngine.render(
            'const {{name}} = "{{value}}";',
            { name: `thread${threadId}_var${opId}`, value: `value${opId}` }
          );
          break;
          
        case 1:
          // CAS operations (I/O intensive)
          const content = `thread-${threadId}-content-${opId}`;
          const hash = await benchmarkContext.casEngine.store(content);
          result = { hash, content };
          break;
          
        case 2:
          // Shared resource access
          const sharedKey = `shared-resource-${opId % 10}`; // 10 shared keys
          result = await benchmarkContext.casEngine.retrieveByKey(sharedKey);
          break;
      }
      
      const duration = performance.now() - startTime;
      
      results.push({
        operationId: opId,
        type: ['template', 'cas_store', 'cas_retrieve'][opType],
        duration,
        success: true,
        timestamp: Date.now()
      });
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      results.push({
        operationId: opId,
        type: 'error',
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
  
  return results;
}

Then('throughput should scale linearly with concurrency', function() {
  const results = benchmarkContext.concurrencyResults;
  const successfulOps = results.filter(r => r.success);
  
  // Calculate ops per second per thread
  const threadGroups = new Map<number, any[]>();
  successfulOps.forEach(result => {
    const threadId = result.threadId;
    if (!threadGroups.has(threadId)) {
      threadGroups.set(threadId, []);
    }
    threadGroups.get(threadId)!.push(result);
  });
  
  const threadThroughputs = Array.from(threadGroups.entries()).map(([threadId, ops]) => {
    const durations = ops.map(op => op.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const throughput = 1000 / avgDuration; // ops per second
    
    return { threadId, throughput, operations: ops.length };
  });
  
  // Check that throughput variance is reasonable (within 30%)
  const throughputs = threadThroughputs.map(t => t.throughput);
  const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length;
  const maxVariance = Math.max(...throughputs.map(t => Math.abs(t - avgThroughput) / avgThroughput));
  
  expect(maxVariance).to.be.below(0.3, 
    `Throughput variance ${(maxVariance * 100).toFixed(1)}% should be below 30%`);
  
  benchmarkContext.currentMetrics.set('concurrency_throughput', {
    avgThroughputPerThread: avgThroughput,
    maxVariance,
    totalThreads: threadGroups.size,
    scalingEfficiency: 1 - maxVariance
  });
  
  console.log(`Concurrency scaling: ${avgThroughput.toFixed(1)} ops/sec/thread, ${(maxVariance * 100).toFixed(1)}% variance`);
});

Then('resource contention should be minimal', function() {
  const results = benchmarkContext.concurrencyResults;
  
  // Analyze operations that access shared resources
  const sharedResourceOps = results.filter(r => r.type === 'cas_retrieve');
  
  if (sharedResourceOps.length > 0) {
    const durations = sharedResourceOps.map(op => op.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Duration = durations.sort((a, b) => a - b)[Math.ceil(durations.length * 0.95) - 1];
    
    // Resource contention is minimal if P95 is not significantly higher than average
    const contentionRatio = p95Duration / avgDuration;
    
    expect(contentionRatio).to.be.below(3, 
      `Resource contention ratio ${contentionRatio.toFixed(2)} should be below 3.0`);
    
    benchmarkContext.currentMetrics.set('resource_contention', {
      avgDuration,
      p95Duration,
      contentionRatio,
      operations: sharedResourceOps.length
    });
    
    console.log(`Resource contention: ${contentionRatio.toFixed(2)} ratio (P95/avg duration)`);
  }
});

Then('thread safety should be maintained', function() {
  const results = benchmarkContext.concurrencyResults;
  const errorRate = results.filter(r => !r.success).length / results.length;
  
  // Thread safety issues typically manifest as errors or data corruption
  expect(errorRate).to.be.below(0.001, 
    `Error rate ${(errorRate * 100).toFixed(3)}% indicates potential thread safety issues`);
  
  // Check for data consistency in CAS operations
  const storeOps = results.filter(r => r.type === 'cas_store' && r.success);
  const uniqueHashes = new Set(storeOps.map(op => op.hash));
  
  // Each store operation should produce a unique hash (no collisions)
  expect(uniqueHashes.size).to.equal(storeOps.length, 
    'Hash collisions detected - potential thread safety issue');
  
  benchmarkContext.currentMetrics.set('thread_safety', {
    errorRate,
    storeOperations: storeOps.length,
    uniqueHashes: uniqueHashes.size,
    threadsafe: errorRate < 0.001 && uniqueHashes.size === storeOps.length
  });
  
  console.log(`Thread safety: ${(errorRate * 100).toFixed(3)}% error rate, ${storeOps.length} unique hashes`);
});