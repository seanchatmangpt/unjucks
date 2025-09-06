#!/usr/bin/env tsx

/**
 * Benchmark Suite for Unjucks - Comprehensive Performance Testing
 * Tests various scenarios and generates regression benchmarks
 */

import { performance } from 'node:perf_hooks';
import { execSync, spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'path';
import { Worker } from 'node:worker_threads';

interface BenchmarkResult {
  name: string;
  category: 'startup' | 'template' | 'memory' | 'concurrency' | 'stress';
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number; // operations per second
  memoryPeak: number; // MB
  memoryAverage: number; // MB
  cpuUsage: number; // percentage
  success: boolean;
  errorRate: number; // percentage of failed operations
  metadata: Record<string, any>;
}

interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: BenchmarkResult[];
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuCores: number;
    totalMemory: number;
    freeMemory: number;
    timestamp: string;
  };
  summary: {
    totalBenchmarks: number;
    totalTime: number;
    avgThroughput: number;
    avgMemoryUsage: number;
    successRate: number;
  };
}

class BenchmarkRunner {
  private cliPath: string;
  private results: BenchmarkResult[] = [];
  private projectRoot: string;
  private tempDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
    this.tempDir = path.join(this.projectRoot, 'benchmark-temp');
  }

  async setup(): Promise<void> {
    // Ensure CLI is built
    if (!await fs.pathExists(this.cliPath)) {
      console.log('🔨 Building CLI for benchmarks...');
      execSync('npm run build', { stdio: 'inherit', cwd: this.projectRoot });
    }

    // Setup temp directory
    await fs.ensureDir(this.tempDir);
    await fs.emptyDir(this.tempDir);
  }

  async cleanup(): Promise<void> {
    await fs.remove(this.tempDir);
  }

  /**
   * Benchmark startup times under various conditions
   */
  async benchmarkStartup(): Promise<void> {
    console.log('🚀 Benchmarking startup performance...');

    const scenarios = [
      { name: 'Cold Start - Version', command: ['--version'], category: 'startup' as const },
      { name: 'Cold Start - Help', command: ['--help'], category: 'startup' as const },
      { name: 'Warm Start - List', command: ['list'], category: 'startup' as const },
      { name: 'Warm Start - Help Command', command: ['help', 'command', 'citty'], category: 'startup' as const }
    ];

    for (const scenario of scenarios) {
      await this.runBenchmark(
        scenario.name,
        scenario.category,
        20, // iterations
        async () => {
          const startTime = performance.now();
          try {
            execSync(`node ${this.cliPath} ${scenario.command.join(' ')}`, {
              stdio: 'pipe',
              timeout: 5000,
              cwd: this.projectRoot
            });
            return performance.now() - startTime;
          } catch (error) {
            throw error;
          }
        }
      );
    }
  }

  /**
   * Benchmark template operations with varying complexity
   */
  async benchmarkTemplateOperations(): Promise<void> {
    console.log('🎨 Benchmarking template operations...');

    const scenarios = [
      {
        name: 'Simple Template - Dry Run',
        category: 'template' as const,
        command: ['generate', 'command', 'citty', '--commandName=BenchTest', '--dry'],
        setup: null
      },
      {
        name: 'Simple Template - File Generation',
        category: 'template' as const,
        command: ['generate', 'command', 'citty', '--commandName=FileTest', '--dest=' + this.tempDir, '--force'],
        setup: null
      },
      {
        name: 'Complex Template - Multiple Files',
        category: 'template' as const,
        command: ['generate', 'command', 'citty', '--commandName=ComplexTest', '--dest=' + this.tempDir, '--force'],
        setup: async () => {
          // Create a more complex template scenario
          const complexDir = path.join(this.tempDir, 'complex');
          await fs.ensureDir(complexDir);
        }
      }
    ];

    for (const scenario of scenarios) {
      if (scenario.setup) {
        await scenario.setup();
      }

      await this.runBenchmark(
        scenario.name,
        scenario.category,
        10,
        async () => {
          const startTime = performance.now();
          try {
            execSync(`node ${this.cliPath} ${scenario.command.join(' ')}`, {
              stdio: 'pipe',
              timeout: 10000,
              cwd: this.projectRoot
            });
            return performance.now() - startTime;
          } catch (error) {
            throw error;
          }
        }
      );

      // Cleanup between runs
      await fs.emptyDir(this.tempDir);
    }
  }

  /**
   * Benchmark memory usage patterns
   */
  async benchmarkMemoryUsage(): Promise<void> {
    console.log('🧠 Benchmarking memory usage...');

    const scenarios = [
      { name: 'Memory - Basic Operations', command: ['--version'] },
      { name: 'Memory - Template Listing', command: ['list'] },
      { name: 'Memory - Help Generation', command: ['help', 'command', 'citty'] }
    ];

    for (const scenario of scenarios) {
      await this.runMemoryBenchmark(scenario.name, scenario.command, 5);
    }
  }

  /**
   * Benchmark concurrency handling
   */
  async benchmarkConcurrency(): Promise<void> {
    console.log('🔄 Benchmarking concurrency...');

    const concurrencyLevels = [1, 5, 10, 20];
    
    for (const level of concurrencyLevels) {
      await this.runConcurrencyBenchmark(
        `Concurrent Operations - ${level} workers`,
        level,
        ['--version'],
        5 // iterations per worker
      );
    }
  }

  /**
   * Run stress tests to identify breaking points
   */
  async benchmarkStressTests(): Promise<void> {
    console.log('💪 Running stress tests...');

    // Large template generation stress test
    await this.runBenchmark(
      'Stress Test - Rapid Generation',
      'stress',
      100,
      async () => {
        const startTime = performance.now();
        try {
          execSync(`node ${this.cliPath} generate command citty --commandName=Stress${Math.random().toString(36).substr(2)} --dest=${this.tempDir} --force`, {
            stdio: 'pipe',
            timeout: 15000,
            cwd: this.projectRoot
          });
          return performance.now() - startTime;
        } catch (error) {
          throw error;
        }
      }
    );
  }

  /**
   * Run a single benchmark with timing and memory measurements
   */
  private async runBenchmark(
    name: string,
    category: BenchmarkResult['category'],
    iterations: number,
    operation: () => Promise<number>
  ): Promise<void> {
    const times: number[] = [];
    const memoryUsages: number[] = [];
    let errors = 0;
    
    console.log(`  📊 ${name} (${iterations} iterations)`);

    // Warmup
    try {
      await operation();
    } catch (e) {
      // Ignore warmup errors
    }

    for (let i = 0; i < iterations; i++) {
      const initialMemory = process.memoryUsage();
      
      try {
        const executionTime = await operation();
        times.push(executionTime);
        
        const finalMemory = process.memoryUsage();
        const memoryDelta = (finalMemory.rss - initialMemory.rss) / 1024 / 1024; // MB
        memoryUsages.push(Math.abs(memoryDelta));
        
      } catch (error) {
        errors++;
        // Still measure memory even on error
        const finalMemory = process.memoryUsage();
        const memoryDelta = (finalMemory.rss - initialMemory.rss) / 1024 / 1024;
        memoryUsages.push(Math.abs(memoryDelta));
      }

      // Small delay to prevent resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (times.length > 0) {
      const sortedTimes = [...times].sort((a, b) => a - b);
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99Time = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      
      const throughput = 1000 / averageTime; // operations per second
      const memoryPeak = Math.max(...memoryUsages);
      const memoryAverage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
      const errorRate = (errors / iterations) * 100;

      const result: BenchmarkResult = {
        name,
        category,
        iterations: times.length,
        averageTime,
        minTime,
        maxTime,
        medianTime,
        p95Time,
        p99Time,
        throughput,
        memoryPeak,
        memoryAverage,
        cpuUsage: 0, // TODO: Implement CPU monitoring
        success: errors === 0,
        errorRate,
        metadata: {
          totalIterations: iterations,
          errorCount: errors,
          memoryMeasurements: memoryUsages.length
        }
      };

      this.results.push(result);
      
      console.log(`    ⏱️  Avg: ${averageTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms, P99: ${p99Time.toFixed(2)}ms`);
      console.log(`    📈 Throughput: ${throughput.toFixed(2)} ops/sec`);
      console.log(`    💾 Memory: Avg ${memoryAverage.toFixed(2)}MB, Peak ${memoryPeak.toFixed(2)}MB`);
      if (errorRate > 0) {
        console.log(`    ❌ Error rate: ${errorRate.toFixed(2)}%`);
      }
    }
  }

  /**
   * Run memory-specific benchmark
   */
  private async runMemoryBenchmark(name: string, command: string[], iterations: number): Promise<void> {
    const memorySnapshots: number[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      try {
        execSync(`node ${this.cliPath} ${command.join(' ')}`, {
          stdio: 'pipe',
          timeout: 5000,
          cwd: this.projectRoot
        });
      } catch (error) {
        // Continue measuring even on error
      }

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      times.push(endTime - startTime);
      memorySnapshots.push(finalMemory.rss / 1024 / 1024); // MB
    }

    if (times.length > 0) {
      const result: BenchmarkResult = {
        name,
        category: 'memory',
        iterations,
        averageTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        medianTime: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
        p95Time: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
        p99Time: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)],
        throughput: 1000 / (times.reduce((a, b) => a + b, 0) / times.length),
        memoryPeak: Math.max(...memorySnapshots),
        memoryAverage: memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length,
        cpuUsage: 0,
        success: true,
        errorRate: 0,
        metadata: {
          memorySnapshots: memorySnapshots.length
        }
      };

      this.results.push(result);
    }
  }

  /**
   * Run concurrency benchmark
   */
  private async runConcurrencyBenchmark(
    name: string,
    concurrency: number,
    command: string[],
    iterations: number
  ): Promise<void> {
    const startTime = performance.now();
    const promises: Promise<number>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const promise = this.runConcurrentWorker(command, iterations);
      promises.push(promise);
    }

    const results = await Promise.allSettled(promises);
    const totalTime = performance.now() - startTime;
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const totalOperations = concurrency * iterations;

    const result: BenchmarkResult = {
      name,
      category: 'concurrency',
      iterations: totalOperations,
      averageTime: totalTime / totalOperations,
      minTime: totalTime,
      maxTime: totalTime,
      medianTime: totalTime,
      p95Time: totalTime,
      p99Time: totalTime,
      throughput: (totalOperations / totalTime) * 1000,
      memoryPeak: process.memoryUsage().rss / 1024 / 1024,
      memoryAverage: process.memoryUsage().rss / 1024 / 1024,
      cpuUsage: 0,
      success: successful === concurrency,
      errorRate: ((concurrency - successful) / concurrency) * 100,
      metadata: {
        concurrency,
        successfulWorkers: successful,
        totalWorkers: concurrency
      }
    };

    this.results.push(result);
    
    console.log(`    🔄 ${name}: ${successful}/${concurrency} workers succeeded`);
    console.log(`    📈 Throughput: ${result.throughput.toFixed(2)} ops/sec`);
  }

  /**
   * Run a concurrent worker
   */
  private async runConcurrentWorker(command: string[], iterations: number): Promise<number> {
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        execSync(`node ${this.cliPath} ${command.join(' ')}`, {
          stdio: 'pipe',
          timeout: 5000,
          cwd: this.projectRoot
        });
        totalTime += performance.now() - startTime;
      } catch (error) {
        // Continue on error
        totalTime += performance.now() - startTime;
      }
    }

    return totalTime;
  }

  /**
   * Generate comprehensive benchmark report
   */
  async generateReport(): Promise<void> {
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCores: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      timestamp: new Date().toISOString()
    };

    const summary = {
      totalBenchmarks: this.results.length,
      totalTime: this.results.reduce((acc, r) => acc + r.averageTime * r.iterations, 0),
      avgThroughput: this.results.reduce((acc, r) => acc + r.throughput, 0) / this.results.length,
      avgMemoryUsage: this.results.reduce((acc, r) => acc + r.memoryAverage, 0) / this.results.length,
      successRate: this.results.filter(r => r.success).length / this.results.length
    };

    const suite: BenchmarkSuite = {
      name: 'Unjucks Performance Benchmark Suite',
      description: 'Comprehensive performance benchmarks for Unjucks CLI',
      benchmarks: this.results,
      environment,
      summary
    };

    // Save detailed report
    const timestamp = Date.now();
    const reportPath = path.join(this.projectRoot, 'reports', `benchmark-suite-${timestamp}.json`);
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJSON(reportPath, suite, { spaces: 2 });

    // Save summary for CI/CD
    const summaryPath = path.join(this.projectRoot, 'docs', 'benchmark-results.json');
    await fs.ensureDir(path.dirname(summaryPath));
    await fs.writeJSON(summaryPath, suite, { spaces: 2 });

    console.log(`\n📋 Benchmark report saved to: ${reportPath}`);
    console.log(`📋 Summary saved to: ${summaryPath}`);

    this.displayResults(suite);
  }

  /**
   * Display benchmark results
   */
  private displayResults(suite: BenchmarkSuite): void {
    console.log('\n🏆 Benchmark Results Summary');
    console.log('============================');
    
    console.log(`📊 Total benchmarks: ${suite.summary.totalBenchmarks}`);
    console.log(`⏱️  Total time: ${(suite.summary.totalTime / 1000).toFixed(2)}s`);
    console.log(`📈 Average throughput: ${suite.summary.avgThroughput.toFixed(2)} ops/sec`);
    console.log(`💾 Average memory: ${suite.summary.avgMemoryUsage.toFixed(2)}MB`);
    console.log(`✅ Success rate: ${(suite.summary.successRate * 100).toFixed(1)}%`);

    // Display category summaries
    const categories = ['startup', 'template', 'memory', 'concurrency', 'stress'] as const;
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      if (categoryResults.length > 0) {
        console.log(`\n📂 ${category.toUpperCase()} Results:`);
        for (const result of categoryResults) {
          console.log(`   • ${result.name}: ${result.averageTime.toFixed(2)}ms avg, ${result.throughput.toFixed(2)} ops/sec`);
        }
      }
    }

    // Identify performance issues
    const slowBenchmarks = this.results.filter(r => r.averageTime > 200);
    const highMemoryBenchmarks = this.results.filter(r => r.memoryPeak > 50);
    const errorBenchmarks = this.results.filter(r => r.errorRate > 0);

    if (slowBenchmarks.length > 0) {
      console.log('\n🐌 Performance concerns (>200ms):');
      slowBenchmarks.forEach(b => console.log(`   • ${b.name}: ${b.averageTime.toFixed(2)}ms`));
    }

    if (highMemoryBenchmarks.length > 0) {
      console.log('\n💾 Memory concerns (>50MB):');
      highMemoryBenchmarks.forEach(b => console.log(`   • ${b.name}: ${b.memoryPeak.toFixed(2)}MB`));
    }

    if (errorBenchmarks.length > 0) {
      console.log('\n❌ Error concerns:');
      errorBenchmarks.forEach(b => console.log(`   • ${b.name}: ${b.errorRate.toFixed(2)}% error rate`));
    }

    console.log('\n✨ Benchmark suite complete!');
  }

  /**
   * Run the complete benchmark suite
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Unjucks Benchmark Suite...\n');

    try {
      await this.setup();
      
      await this.benchmarkStartup();
      await this.benchmarkTemplateOperations();
      await this.benchmarkMemoryUsage();
      await this.benchmarkConcurrency();
      await this.benchmarkStressTests();
      
      await this.generateReport();
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new BenchmarkRunner();
  runner.run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export { BenchmarkRunner };