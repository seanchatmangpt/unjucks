import { performance } from 'node:perf_hooks';
import { memoryUsage } from 'node:process';
import fs from 'fs-extra';
import path from 'path';

// Global performance monitoring setup
global.performanceMetrics = {
  testStartTime: null,
  memoryBaseline: null,
  cpuBaseline: null,
  measurements: [],
  thresholds: {
    // Fortune 5 scale thresholds
    maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
    maxExecutionTime: 5000, // 5 seconds
    maxCpuUsage: 80, // 80%
    throughputMin: 1000, // ops/sec
    latencyMax: 100, // milliseconds
  }
};

// Memory tracking utilities
global.trackMemory = (label) => {
  const usage = memoryUsage();
  const timestamp = performance.now();
  
  const measurement = {
    label,
    timestamp,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    arrayBuffers: usage.arrayBuffers
  };
  
  global.performanceMetrics.measurements.push(measurement);
  return measurement;
};

// CPU monitoring (approximation using process.hrtime)
global.trackCPU = (label) => {
  const cpuUsage = process.cpuUsage();
  const timestamp = performance.now();
  
  const measurement = {
    label,
    timestamp,
    user: cpuUsage.user,
    system: cpuUsage.system
  };
  
  global.performanceMetrics.measurements.push(measurement);
  return measurement;
};

// Performance timer utilities
global.startPerformanceTimer = (label) => {
  const startTime = performance.now();
  return {
    label,
    startTime,
    end: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const measurement = {
        label,
        startTime,
        endTime,
        duration,
        type: 'timer'
      };
      
      global.performanceMetrics.measurements.push(measurement);
      return measurement;
    }
  };
};

// Throughput measurement utilities
global.measureThroughput = (operationCount, durationMs) => {
  return (operationCount / durationMs) * 1000; // ops/sec
};

// Latency percentile calculations
global.calculatePercentiles = (latencies) => {
  const sorted = latencies.sort((a, b) => a - b);
  const count = sorted.length;
  
  return {
    p50: sorted[Math.floor(count * 0.5)],
    p90: sorted[Math.floor(count * 0.9)],
    p95: sorted[Math.floor(count * 0.95)],
    p99: sorted[Math.floor(count * 0.99)],
    p99_9: sorted[Math.floor(count * 0.999)],
    min: sorted[0],
    max: sorted[count - 1],
    mean: sorted.reduce((sum, val) => sum + val, 0) / count
  };
};

// Performance regression detection
global.detectRegression = (current, baseline, threshold = 0.1) => {
  if (!baseline) return { isRegression: false, change: 0 };
  
  const change = (current - baseline) / baseline;
  const isRegression = change > threshold;
  
  return {
    isRegression,
    change,
    percentChange: change * 100,
    current,
    baseline
  };
};

// Performance report generation
global.generatePerformanceReport = () => {
  const report = {
    timestamp: this.getDeterministicDate().toISOString(),
    testDuration: global.performanceMetrics.testStartTime ? 
      performance.now() - global.performanceMetrics.testStartTime : 0,
    measurements: global.performanceMetrics.measurements,
    summary: {
      totalMeasurements: global.performanceMetrics.measurements.length,
      memoryPeak: Math.max(...global.performanceMetrics.measurements
        .filter(m => m.heapUsed)
        .map(m => m.heapUsed)),
      averageLatency: 0,
      throughputPeak: 0
    }
  };
  
  // Calculate summary statistics
  const timers = global.performanceMetrics.measurements.filter(m => m.type === 'timer');
  if (timers.length > 0) {
    report.summary.averageLatency = timers.reduce((sum, t) => sum + t.duration, 0) / timers.length;
  }
  
  return report;
};

// Baseline management
global.savePerformanceBaseline = async (testName, metrics) => {
  const baselineDir = 'tests/performance/baselines';
  await fs.ensureDir(baselineDir);
  
  const baselinePath = path.join(baselineDir, `${testName}.json`);
  await fs.writeJson(baselinePath, {
    timestamp: this.getDeterministicDate().toISOString(),
    metrics,
    version: process.env.npm_package_version || 'unknown'
  }, { spaces: 2 });
};

global.loadPerformanceBaseline = async (testName) => {
  const baselinePath = path.join('tests/performance/baselines', `${testName}.json`);
  
  try {
    return await fs.readJson(baselinePath);
  } catch (error) {
    console.warn(`No baseline found for test: ${testName}`);
    return null;
  }
};

// Setup hooks
beforeAll(() => {
  global.performanceMetrics.testStartTime = performance.now();
  global.performanceMetrics.memoryBaseline = global.trackMemory('test-start');
  console.log('Performance monitoring initialized');
});

afterAll(async () => {
  const report = global.generatePerformanceReport();
  
  // Ensure reports directory exists
  await fs.ensureDir('reports/performance');
  
  // Save detailed performance report
  const reportPath = `reports/performance/test-run-${this.getDeterministicTimestamp()}.json`;
  await fs.writeJson(reportPath, report, { spaces: 2 });
  
  console.log(`Performance report saved to: ${reportPath}`);
  console.log(`Total test duration: ${report.testDuration.toFixed(2)}ms`);
  console.log(`Memory peak: ${(report.summary.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
});

// Global error handler for performance issues
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning' || 
      warning.name === 'DeprecationWarning') {
    console.warn('Performance Warning:', warning.message);
  }
});