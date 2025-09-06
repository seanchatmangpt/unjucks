#!/usr/bin/env tsx

/**
 * Performance Regression Benchmarks for CI/CD
 * Establishes baseline performance metrics and monitors for regressions
 */

import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'path';

interface RegressionBenchmark {
  name: string;
  command: string;
  category: 'startup' | 'template' | 'memory' | 'throughput';
  iterations: number;
  currentMetrics: {
    averageTime: number;
    medianTime: number;
    p95Time: number;
    minTime: number;
    maxTime: number;
    memoryUsage: number;
    throughput: number;
    stdDeviation: number;
  };
  baselineMetrics?: {
    averageTime: number;
    medianTime: number;
    memoryUsage: number;
    timestamp: string;
  };
  regressionThresholds: {
    timeIncrease: number;    // % increase allowed
    memoryIncrease: number;  // % increase allowed
    throughputDecrease: number; // % decrease allowed
  };
  status: 'pass' | 'warning' | 'fail';
  regressionDetails?: {
    timeRegression: number;
    memoryRegression: number;
    throughputRegression: number;
  };
}

interface RegressionReport {
  timestamp: string;
  commit?: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuCores: number;
    totalMemory: number;
  };
  benchmarks: RegressionBenchmark[];
  summary: {
    totalBenchmarks: number;
    passed: number;
    warnings: number;
    failed: number;
    overallStatus: 'pass' | 'warning' | 'fail';
    worstRegression?: {
      benchmark: string;
      type: 'time' | 'memory' | 'throughput';
      regression: number;
    };
  };
}

class RegressionBenchmarker {
  private cliPath: string;
  private projectRoot: string;
  private baselinePath: string;
  private benchmarks: RegressionBenchmark[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
    this.baselinePath = path.join(this.projectRoot, 'docs', 'performance-baselines.json');
  }

  /**
   * Define regression benchmarks with thresholds
   */
  private defineBenchmarks(): RegressionBenchmark[] {
    return [
      {
        name: 'CLI Cold Start - Version',
        command: '--version',
        category: 'startup',
        iterations: 20,
        currentMetrics: {} as any,
        regressionThresholds: {
          timeIncrease: 20,    // 20% slower allowed
          memoryIncrease: 25,  // 25% more memory allowed
          throughputDecrease: 15 // 15% less throughput allowed
        },
        status: 'pass'
      },
      {
        name: 'CLI Help Display',
        command: '--help',
        category: 'startup',
        iterations: 15,
        currentMetrics: {} as any,
        regressionThresholds: {
          timeIncrease: 15,
          memoryIncrease: 20,
          throughputDecrease: 15
        },
        status: 'pass'
      },
      {
        name: 'Template Listing',
        command: 'list',
        category: 'template',
        iterations: 10,
        currentMetrics: {} as any,
        regressionThresholds: {
          timeIncrease: 25,    // Template scanning can vary
          memoryIncrease: 30,
          throughputDecrease: 20
        },
        status: 'pass'
      },
      {
        name: 'Help Command Generation',
        command: 'help command citty',
        category: 'template',
        iterations: 8,
        currentMetrics: {} as any,
        regressionThresholds: {
          timeIncrease: 30,    // Dynamic generation more variable
          memoryIncrease: 35,
          throughputDecrease: 25
        },
        status: 'pass'
      }
    ];
  }

  /**
   * Load baseline metrics from previous runs
   */
  private async loadBaselines(): Promise<void> {
    try {
      if (await fs.pathExists(this.baselinePath)) {
        const baselines = await fs.readJSON(this.baselinePath);
        
        this.benchmarks.forEach(benchmark => {
          const baselineKey = benchmark.name.toLowerCase().replace(/\s+/g, '_');
          if (baselines[baselineKey]) {
            benchmark.baselineMetrics = baselines[baselineKey];
          }
        });
        
        console.log('📊 Loaded baseline metrics for regression comparison');
      } else {
        console.log('📏 No baselines found - will establish new baseline');
      }
    } catch (error) {
      console.log('⚠️  Could not load baselines:', error);
    }
  }

  /**
   * Run a single benchmark with detailed metrics
   */
  private async runBenchmark(benchmark: RegressionBenchmark): Promise<void> {
    console.log(`🧪 Running: ${benchmark.name} (${benchmark.iterations} iterations)`);

    const times: number[] = [];
    const memoryUsages: number[] = [];
    let errors = 0;

    // Warmup run
    try {
      execSync(`node ${this.cliPath} ${benchmark.command}`, { 
        stdio: 'pipe', 
        timeout: 5000 
      });
    } catch (e) { /* ignore warmup errors */ }

    // Actual benchmark runs
    for (let i = 0; i < benchmark.iterations; i++) {
      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      try {
        execSync(`node ${this.cliPath} ${benchmark.command}`, {
          stdio: 'pipe',
          timeout: 10000,
          cwd: this.projectRoot
        });

        const endTime = performance.now();
        const finalMemory = process.memoryUsage();
        
        times.push(endTime - startTime);
        memoryUsages.push(Math.abs(finalMemory.rss - initialMemory.rss) / 1024 / 1024); // MB
        
      } catch (error) {
        errors++;
        times.push(performance.now() - startTime); // Include failed attempts
      }

      // Small delay to prevent resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate metrics
    const sortedTimes = [...times].sort((a, b) => a - b);
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95Time = sortedTimes[p95Index];
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = 1000 / averageTime; // operations per second
    
    // Standard deviation
    const variance = times.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / times.length;
    const stdDeviation = Math.sqrt(variance);
    
    const averageMemory = memoryUsages.length > 0 ? 
      memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0;

    benchmark.currentMetrics = {
      averageTime,
      medianTime,
      p95Time,
      minTime,
      maxTime,
      memoryUsage: averageMemory,
      throughput,
      stdDeviation
    };

    console.log(`   ⏱️  Avg: ${averageTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms, σ: ${stdDeviation.toFixed(2)}ms`);
    console.log(`   💾 Memory: ${averageMemory.toFixed(2)}MB, Throughput: ${throughput.toFixed(2)} ops/sec`);
    
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}/${benchmark.iterations}`);
    }
  }

  /**
   * Compare current metrics against baseline and detect regressions
   */
  private analyzeRegressions(benchmark: RegressionBenchmark): void {
    if (!benchmark.baselineMetrics) {
      benchmark.status = 'pass'; // No baseline to compare against
      return;
    }

    const baseline = benchmark.baselineMetrics;
    const current = benchmark.currentMetrics;
    const thresholds = benchmark.regressionThresholds;

    // Calculate regression percentages
    const timeRegression = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
    const memoryRegression = baseline.memoryUsage > 0 ? 
      ((current.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage) * 100 : 0;
    const throughputRegression = ((baseline.medianTime - current.medianTime) / baseline.medianTime) * 100;

    benchmark.regressionDetails = {
      timeRegression,
      memoryRegression,
      throughputRegression
    };

    // Determine status based on thresholds
    const timeExceeded = timeRegression > thresholds.timeIncrease;
    const memoryExceeded = memoryRegression > thresholds.memoryIncrease;
    const throughputExceeded = throughputRegression < -thresholds.throughputDecrease;

    if (timeExceeded || memoryExceeded || throughputExceeded) {
      // Severe regression
      if (timeRegression > thresholds.timeIncrease * 2 || memoryRegression > thresholds.memoryIncrease * 2) {
        benchmark.status = 'fail';
      } else {
        benchmark.status = 'warning';
      }
    } else {
      benchmark.status = 'pass';
    }
  }

  /**
   * Update baseline metrics with current results (if they're not regressions)
   */
  private async updateBaselines(): Promise<void> {
    const baselines: any = {};
    
    // Load existing baselines
    try {
      if (await fs.pathExists(this.baselinePath)) {
        Object.assign(baselines, await fs.readJSON(this.baselinePath));
      }
    } catch (e) { /* ignore */ }

    // Update with current metrics (only for passing benchmarks)
    this.benchmarks.forEach(benchmark => {
      if (benchmark.status === 'pass' || !benchmark.baselineMetrics) {
        const baselineKey = benchmark.name.toLowerCase().replace(/\s+/g, '_');
        baselines[baselineKey] = {
          averageTime: benchmark.currentMetrics.averageTime,
          medianTime: benchmark.currentMetrics.medianTime,
          memoryUsage: benchmark.currentMetrics.memoryUsage,
          timestamp: new Date().toISOString()
        };
      }
    });

    // Save updated baselines
    await fs.ensureDir(path.dirname(this.baselinePath));
    await fs.writeJSON(this.baselinePath, baselines, { spaces: 2 });
  }

  /**
   * Generate regression report
   */
  private generateReport(): RegressionReport {
    const passed = this.benchmarks.filter(b => b.status === 'pass').length;
    const warnings = this.benchmarks.filter(b => b.status === 'warning').length;
    const failed = this.benchmarks.filter(b => b.status === 'fail').length;

    let worstRegression: any = undefined;
    let maxRegression = 0;

    this.benchmarks.forEach(benchmark => {
      if (benchmark.regressionDetails) {
        const timeReg = Math.abs(benchmark.regressionDetails.timeRegression);
        const memReg = Math.abs(benchmark.regressionDetails.memoryRegression);
        const throughputReg = Math.abs(benchmark.regressionDetails.throughputRegression);
        
        if (timeReg > maxRegression) {
          maxRegression = timeReg;
          worstRegression = { 
            benchmark: benchmark.name, 
            type: 'time', 
            regression: timeReg 
          };
        }
        if (memReg > maxRegression) {
          maxRegression = memReg;
          worstRegression = { 
            benchmark: benchmark.name, 
            type: 'memory', 
            regression: memReg 
          };
        }
      }
    });

    const overallStatus: 'pass' | 'warning' | 'fail' = 
      failed > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';

    return {
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCores: (await import('os')).cpus().length,
        totalMemory: (await import('os')).totalmem()
      },
      benchmarks: this.benchmarks,
      summary: {
        totalBenchmarks: this.benchmarks.length,
        passed,
        warnings,
        failed,
        overallStatus,
        worstRegression
      }
    };
  }

  /**
   * Display regression analysis results
   */
  private displayResults(report: RegressionReport): void {
    console.log('\n🏁 Regression Benchmark Results');
    console.log('===============================');

    const statusEmoji = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌'
    };

    console.log(`📊 Overall Status: ${statusEmoji[report.summary.overallStatus]} ${report.summary.overallStatus.toUpperCase()}`);
    console.log(`📈 Results: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`);

    if (report.summary.worstRegression) {
      const worst = report.summary.worstRegression;
      console.log(`🔥 Worst regression: ${worst.benchmark} (${worst.type}: +${worst.regression.toFixed(1)}%)`);
    }

    console.log('\n📊 Detailed Results:');
    this.benchmarks.forEach(benchmark => {
      console.log(`\n${statusEmoji[benchmark.status]} ${benchmark.name}:`);
      console.log(`   ⏱️  Current: ${benchmark.currentMetrics.averageTime.toFixed(2)}ms`);
      
      if (benchmark.baselineMetrics) {
        const baseline = benchmark.baselineMetrics.averageTime;
        const diff = benchmark.currentMetrics.averageTime - baseline;
        const diffSymbol = diff >= 0 ? '+' : '';
        console.log(`   📊 Baseline: ${baseline.toFixed(2)}ms (${diffSymbol}${diff.toFixed(2)}ms, ${diffSymbol}${((diff/baseline)*100).toFixed(1)}%)`);
      } else {
        console.log(`   📊 Baseline: Not established`);
      }
      
      if (benchmark.regressionDetails) {
        const reg = benchmark.regressionDetails;
        if (Math.abs(reg.timeRegression) > benchmark.regressionThresholds.timeIncrease) {
          console.log(`   ⚠️  Time regression: ${reg.timeRegression.toFixed(1)}%`);
        }
        if (Math.abs(reg.memoryRegression) > benchmark.regressionThresholds.memoryIncrease) {
          console.log(`   ⚠️  Memory regression: ${reg.memoryRegression.toFixed(1)}%`);
        }
      }
    });
  }

  /**
   * Save regression report for CI/CD consumption
   */
  private async saveReport(report: RegressionReport): Promise<void> {
    // Save detailed report
    const detailedPath = path.join(this.projectRoot, 'reports', `regression-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(detailedPath));
    await fs.writeJSON(detailedPath, report, { spaces: 2 });

    // Save summary for CI
    const summaryPath = path.join(this.projectRoot, 'reports', 'regression-summary.json');
    await fs.writeJSON(summaryPath, {
      status: report.summary.overallStatus,
      timestamp: report.timestamp,
      commit: report.commit,
      summary: report.summary
    }, { spaces: 2 });

    console.log(`\n📋 Regression report saved: ${detailedPath}`);
    console.log(`📋 CI summary saved: ${summaryPath}`);
  }

  /**
   * Run complete regression benchmark suite
   */
  async runRegressionBenchmarks(): Promise<void> {
    console.log('🧪 Starting Regression Benchmark Suite...\n');

    try {
      // Verify CLI is built
      if (!await fs.pathExists(this.cliPath)) {
        console.log('🔨 Building CLI for benchmarks...');
        execSync('npm run build', { stdio: 'inherit', cwd: this.projectRoot });
      }

      // Initialize benchmarks and load baselines
      this.benchmarks = this.defineBenchmarks();
      await this.loadBaselines();

      // Run all benchmarks
      for (const benchmark of this.benchmarks) {
        await this.runBenchmark(benchmark);
        this.analyzeRegressions(benchmark);
        
        // Small delay between benchmarks
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update baselines and generate report
      await this.updateBaselines();
      const report = this.generateReport();
      
      this.displayResults(report);
      await this.saveReport(report);

      // Exit with appropriate code for CI/CD
      if (report.summary.overallStatus === 'fail') {
        console.log('\n💥 Regression benchmarks FAILED - performance has degraded significantly');
        process.exit(1);
      } else if (report.summary.overallStatus === 'warning') {
        console.log('\n⚠️  Regression benchmarks show WARNING - performance may have degraded');
        process.exit(0); // Don't fail CI, but log warning
      } else {
        console.log('\n✨ All regression benchmarks PASSED');
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Regression benchmark suite failed:', error);
      process.exit(1);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmarker = new RegressionBenchmarker();
  benchmarker.runRegressionBenchmarks().catch(console.error);
}

export { RegressionBenchmarker };