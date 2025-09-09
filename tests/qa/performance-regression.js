#!/usr/bin/env node

/**
 * Performance Regression Testing Framework
 * Monitors performance metrics and detects regressions
 */

import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class PerformanceBenchmark {
  constructor(name, description, testFunction, thresholds = {}) {
    this.name = name;
    this.description = description;
    this.testFunction = testFunction;
    this.thresholds = {
      maxDuration: 5000, // 5 seconds default
      maxMemoryMB: 100,  // 100MB default
      ...thresholds
    };
    this.results = [];
  }

  async run(iterations = 5) {
    console.log(`\n⏱️  Running ${this.name} (${iterations} iterations)`);
    console.log(`   ${this.description}`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.runSingleIteration(i + 1);
      results.push(result);
      
      // Show progress
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      process.stdout.write(`\r   Iteration ${i + 1}/${iterations} - Avg: ${avgDuration.toFixed(0)}ms`);
    }
    
    console.log(''); // New line
    
    this.results = results;
    return this.analyzeResults();
  }

  async runSingleIteration(iteration) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      await this.testFunction();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      return {
        iteration,
        duration: endTime - startTime,
        memoryUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024, // MB
        memoryPeak: endMemory.heapUsed / 1024 / 1024, // MB
        success: true
      };
    } catch (error) {
      return {
        iteration,
        duration: performance.now() - startTime,
        memoryUsed: 0,
        memoryPeak: 0,
        success: false,
        error: error.message
      };
    }
  }

  analyzeResults() {
    const successful = this.results.filter(r => r.success);
    
    if (successful.length === 0) {
      return {
        name: this.name,
        passed: false,
        error: 'All iterations failed',
        metrics: {}
      };
    }
    
    const durations = successful.map(r => r.duration);
    const memoryUsages = successful.map(r => r.memoryUsed);
    
    const metrics = {
      avgDuration: durations.reduce((a, b) => a + b) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.percentile(durations, 95),
      avgMemory: memoryUsages.reduce((a, b) => a + b) / memoryUsages.length,
      maxMemory: Math.max(...memoryUsages),
      successRate: (successful.length / this.results.length) * 100
    };
    
    const passed = this.validateMetrics(metrics);
    
    return {
      name: this.name,
      passed,
      metrics,
      thresholds: this.thresholds,
      rawResults: this.results
    };
  }

  percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (p / 100)) - 1;
    return sorted[index] || 0;
  }

  validateMetrics(metrics) {
    const checks = {
      duration: metrics.p95Duration <= this.thresholds.maxDuration,
      memory: metrics.maxMemory <= this.thresholds.maxMemoryMB,
      success: metrics.successRate >= 80 // At least 80% success rate
    };
    
    return Object.values(checks).every(Boolean);
  }
}

class PerformanceRegressionTester {
  constructor() {
    this.benchmarks = [];
    this.baselineFile = path.join(projectRoot, 'tests/reports/performance-baseline.json');
    this.reportsDir = path.join(projectRoot, 'tests/reports');
  }

  addBenchmark(benchmark) {
    this.benchmarks.push(benchmark);
  }

  async runAllBenchmarks() {
    console.log('🚀 Running Performance Regression Tests\n');
    
    await fs.ensureDir(this.reportsDir);
    
    const results = [];
    let totalPassed = 0;
    
    for (const benchmark of this.benchmarks) {
      const result = await benchmark.run();
      results.push(result);
      
      if (result.passed) {
        totalPassed++;
        console.log(`   ✅ ${result.name} - PASSED`);
      } else {
        console.log(`   ❌ ${result.name} - FAILED`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      }
      
      this.displayMetrics(result);
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      totalBenchmarks: this.benchmarks.length,
      passed: totalPassed,
      failed: this.benchmarks.length - totalPassed,
      results
    };
    
    await this.saveReport(report);
    await this.checkForRegressions(report);
    
    return report;
  }

  displayMetrics(result) {
    if (result.metrics && Object.keys(result.metrics).length > 0) {
      console.log(`      Avg Duration: ${result.metrics.avgDuration?.toFixed(1)}ms`);
      console.log(`      P95 Duration: ${result.metrics.p95Duration?.toFixed(1)}ms`);
      console.log(`      Max Memory: ${result.metrics.maxMemory?.toFixed(1)}MB`);
      console.log(`      Success Rate: ${result.metrics.successRate?.toFixed(1)}%`);
    }
  }

  async saveReport(report) {
    // Save current report
    await fs.writeJSON(
      path.join(this.reportsDir, 'performance-report.json'),
      report,
      { spaces: 2 }
    );
    
    // Update baseline if all tests passed
    if (report.passed === report.totalBenchmarks) {
      await this.updateBaseline(report);
    }
    
    // Save to history
    await this.saveToHistory(report);
  }

  async updateBaseline(report) {
    const baseline = {
      timestamp: report.timestamp,
      benchmarks: report.results.reduce((acc, result) => {
        acc[result.name] = {
          avgDuration: result.metrics.avgDuration,
          p95Duration: result.metrics.p95Duration,
          maxMemory: result.metrics.maxMemory
        };
        return acc;
      }, {})
    };
    
    await fs.writeJSON(this.baselineFile, baseline, { spaces: 2 });
    console.log('\n📊 Baseline updated with current results');
  }

  async saveToHistory(report) {
    const historyFile = path.join(this.reportsDir, 'performance-history.json');
    let history = [];
    
    if (await fs.pathExists(historyFile)) {
      history = await fs.readJSON(historyFile);
    }
    
    history.push({
      timestamp: report.timestamp,
      passed: report.passed,
      failed: report.failed,
      summary: report.results.map(r => ({
        name: r.name,
        passed: r.passed,
        avgDuration: r.metrics?.avgDuration
      }))
    });
    
    // Keep last 50 entries
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    await fs.writeJSON(historyFile, history, { spaces: 2 });
  }

  async checkForRegressions(report) {
    if (!await fs.pathExists(this.baselineFile)) {
      console.log('\n📄 No baseline found - current results will be used as baseline');
      return;
    }
    
    const baseline = await fs.readJSON(this.baselineFile);
    const regressions = [];
    
    report.results.forEach(result => {
      const baselineMetrics = baseline.benchmarks[result.name];
      if (!baselineMetrics || !result.metrics) return;
      
      const durationRegression = this.calculateRegression(
        baselineMetrics.avgDuration,
        result.metrics.avgDuration
      );
      
      const memoryRegression = this.calculateRegression(
        baselineMetrics.maxMemory,
        result.metrics.maxMemory
      );
      
      if (durationRegression > 20 || memoryRegression > 20) {
        regressions.push({
          benchmark: result.name,
          durationRegression,
          memoryRegression,
          baseline: baselineMetrics,
          current: result.metrics
        });
      }
    });
    
    if (regressions.length > 0) {
      console.log('\n⚠️  Performance Regressions Detected:');
      regressions.forEach(reg => {
        console.log(`   ${reg.benchmark}:`);
        if (reg.durationRegression > 20) {
          console.log(`     Duration: +${reg.durationRegression.toFixed(1)}% slower`);
        }
        if (reg.memoryRegression > 20) {
          console.log(`     Memory: +${reg.memoryRegression.toFixed(1)}% more`);
        }
      });
      
      // Save regression report
      await fs.writeJSON(
        path.join(this.reportsDir, 'performance-regressions.json'),
        { timestamp: new Date().toISOString(), regressions },
        { spaces: 2 }
      );
    } else {
      console.log('\n✅ No significant performance regressions detected');
    }
  }

  calculateRegression(baseline, current) {
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }
}

// Define performance benchmarks
const createBenchmarks = () => {
  const tester = new PerformanceRegressionTester();
  
  // CLI Command Performance
  tester.addBenchmark(new PerformanceBenchmark(
    'CLI Help Command',
    'Time to execute unjucks --help',
    async () => {
      await executeCommand('node bin/unjucks.cjs --help');
    },
    { maxDuration: 2000, maxMemoryMB: 50 }
  ));
  
  // Template Discovery Performance
  tester.addBenchmark(new PerformanceBenchmark(
    'Template Discovery',
    'Time to discover and list all templates',
    async () => {
      await executeCommand('node bin/unjucks.cjs list');
    },
    { maxDuration: 3000, maxMemoryMB: 75 }
  ));
  
  // File Generation Performance
  tester.addBenchmark(new PerformanceBenchmark(
    'File Generation',
    'Time to generate a simple template',
    async () => {
      // Create a temporary template for testing
      await fs.ensureDir('/tmp/perf-test/_templates/test');
      await fs.writeFile('/tmp/perf-test/_templates/test/new.js.ejs', 'console.log("Hello <%= name %>!");');
      
      await executeCommand('node bin/unjucks.cjs generate test new --name TestPerf', '/tmp/perf-test');
      
      // Cleanup
      await fs.remove('/tmp/perf-test');
    },
    { maxDuration: 4000, maxMemoryMB: 100 }
  ));
  
  // Memory Stress Test
  tester.addBenchmark(new PerformanceBenchmark(
    'Memory Stress Test',
    'Generate multiple files in sequence',
    async () => {
      const tempDir = '/tmp/memory-stress-test';
      await fs.ensureDir(`${tempDir}/_templates/component`);
      
      // Create template
      await fs.writeFile(
        `${tempDir}/_templates/component/new.tsx.ejs`,
        `import React from 'react';

export const <%= name %> = () => {
  return <div><%= name %> Component</div>;
};
`
      );
      
      // Generate multiple components
      for (let i = 0; i < 10; i++) {
        await executeCommand(`node bin/unjucks.cjs generate component new --name Component${i}`, tempDir);
      }
      
      await fs.remove(tempDir);
    },
    { maxDuration: 8000, maxMemoryMB: 150 }
  ));
  
  return tester;
};

async function executeCommand(command, cwd = projectRoot) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });
  });
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const tester = createBenchmarks();
  
  tester.runAllBenchmarks().then(report => {
    console.log('\n📊 Performance Testing Summary:');
    console.log(`   ✅ Passed: ${report.passed}/${report.totalBenchmarks}`);
    console.log(`   ❌ Failed: ${report.failed}/${report.totalBenchmarks}`);
    
    if (report.failed > 0) {
      console.log('\n💥 Some performance tests failed!');
      process.exit(1);
    } else {
      console.log('\n🎉 All performance tests passed!');
      process.exit(0);
    }
  }).catch(error => {
    console.error('Performance testing failed:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmark, PerformanceRegressionTester };
