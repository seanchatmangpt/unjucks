#!/usr/bin/env tsx
// Performance monitoring script for test execution optimization
// Measures and reports performance improvements

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';

interface PerformanceMetrics {
  testSuite: string;
  duration: number;
  parallelism: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuCores: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private baseline: PerformanceMetrics | null = null;

  async measureTestSuite(suiteName: string, command: string): Promise<PerformanceMetrics> {
    console.log(chalk.blue(`🔍 Measuring performance for: ${suiteName}`));
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      // Execute test command
      execSync(command, { 
        stdio: 'pipe',
        timeout: 300000 // 5 minute timeout
      });
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const metrics: PerformanceMetrics = {
        testSuite: suiteName,
        duration: endTime - startTime,
        parallelism: this.getParallelismLevel(command),
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
        },
        cpuCores: os.cpus().length,
        timestamp: Date.now()
      };
      
      this.metrics.push(metrics);
      this.reportMetrics(metrics);
      
      return metrics;
      
    } catch (error) {
      console.error(chalk.red(`❌ Test suite failed: ${suiteName}`));
      throw error;
    }
  }

  setBaseline(metrics: PerformanceMetrics): void {
    this.baseline = metrics;
    console.log(chalk.yellow(`📊 Baseline set: ${(metrics.duration / 1000).toFixed(2)}s`));
  }

  async runPerformanceComparison(): Promise<void> {
    console.log(chalk.green('🚀 Starting Performance Comparison'));
    console.log(chalk.gray('=' .repeat(60)));
    
    // Measure baseline (sequential execution)
    console.log(chalk.blue('\n📏 Measuring baseline performance (sequential)...'));
    const baselineMetrics = await this.measureSequentialBaseline();
    this.setBaseline(baselineMetrics);
    
    // Measure optimized configuration
    console.log(chalk.blue('\n⚡ Measuring optimized performance (parallel)...'));
    const optimizedMetrics = await this.measureOptimizedExecution();
    
    // Generate comparison report
    this.generateComparisonReport(baselineMetrics, optimizedMetrics);
  }

  private async measureSequentialBaseline(): Promise<PerformanceMetrics> {
    // Create temporary config for sequential execution
    const tempConfig = this.createSequentialConfig();
    
    try {
      return await this.measureTestSuite(
        'baseline-sequential', 
        'VITEST_CONFIG_PATH=vitest.baseline.config.ts vitest run --reporter=silent'
      );
    } finally {
      this.cleanupTempConfig();
    }
  }

  private async measureOptimizedExecution(): Promise<PerformanceMetrics> {
    return await this.measureTestSuite(
      'optimized-parallel',
      'vitest run --reporter=silent'
    );
  }

  private createSequentialConfig(): void {
    const sequentialConfig = `
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 1, // Sequential execution
      },
    },
    sequence: {
      concurrent: false,
    },
    isolate: true,
    cache: false,
    include: ["tests/**/*.test.ts", "tests/features/**/*.spec.ts"],
    exclude: ["node_modules/**", "dist/**"],
    testTimeout: 30000,
    hookTimeout: 10000,
    reporters: ["silent"],
  },
});
`;
    require('fs').writeFileSync('vitest.baseline.config.ts', sequentialConfig);
  }

  private cleanupTempConfig(): void {
    try {
      require('fs').unlinkSync('vitest.baseline.config.ts');
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private getParallelismLevel(command: string): number {
    // Estimate parallelism from command and system
    if (command.includes('maxThreads: 1') || command.includes('concurrent: false')) {
      return 1;
    }
    return Math.min(8, Math.max(2, Math.floor(os.cpus().length * 0.8)));
  }

  private reportMetrics(metrics: PerformanceMetrics): void {
    console.log(chalk.green(`✅ ${metrics.testSuite} completed`));
    console.log(chalk.gray(`   Duration: ${(metrics.duration / 1000).toFixed(2)}s`));
    console.log(chalk.gray(`   Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`));
    console.log(chalk.gray(`   Parallelism: ${metrics.parallelism} threads`));
  }

  private generateComparisonReport(baseline: PerformanceMetrics, optimized: PerformanceMetrics): void {
    const speedImprovement = baseline.duration / optimized.duration;
    const memoryDifference = (optimized.memoryUsage.heapUsed - baseline.memoryUsage.heapUsed) / 1024 / 1024;
    
    console.log(chalk.green('\n🎯 PERFORMANCE IMPROVEMENT REPORT'));
    console.log(chalk.gray('=' .repeat(60)));
    
    // Speed improvement
    console.log(chalk.blue('\n📈 Speed Improvement:'));
    console.log(`   Baseline: ${(baseline.duration / 1000).toFixed(2)}s`);
    console.log(`   Optimized: ${(optimized.duration / 1000).toFixed(2)}s`);
    
    if (speedImprovement >= 3.0) {
      console.log(chalk.green(`   ✅ Improvement: ${speedImprovement.toFixed(1)}x faster (Target: 3x+ achieved!)`));
    } else if (speedImprovement >= 2.8) {
      console.log(chalk.yellow(`   ⚠️  Improvement: ${speedImprovement.toFixed(1)}x faster (Close to target)`));
    } else {
      console.log(chalk.red(`   ❌ Improvement: ${speedImprovement.toFixed(1)}x faster (Below 2.8x target)`));
    }
    
    // Memory usage
    console.log(chalk.blue('\n💾 Memory Usage:'));
    console.log(`   Difference: ${memoryDifference >= 0 ? '+' : ''}${memoryDifference.toFixed(2)}MB`);
    
    if (Math.abs(memoryDifference) < 10) {
      console.log(chalk.green(`   ✅ Memory usage stable`));
    } else if (memoryDifference > 0) {
      console.log(chalk.yellow(`   ⚠️  Slightly higher memory usage`));
    } else {
      console.log(chalk.green(`   ✅ Memory usage improved`));
    }
    
    // Parallelism effectiveness  
    console.log(chalk.blue('\n⚡ Parallelism:'));
    console.log(`   Baseline: ${baseline.parallelism} thread(s)`);
    console.log(`   Optimized: ${optimized.parallelism} thread(s)`);
    console.log(`   CPU Cores: ${optimized.cpuCores}`);
    
    // Overall assessment
    console.log(chalk.blue('\n🎯 Overall Assessment:'));
    if (speedImprovement >= 3.0 && Math.abs(memoryDifference) < 20) {
      console.log(chalk.green('   ✅ OPTIMIZATION SUCCESS - Targets achieved!'));
    } else if (speedImprovement >= 2.8) {
      console.log(chalk.yellow('   ⚠️  PARTIAL SUCCESS - Good improvement, minor tuning needed'));
    } else {
      console.log(chalk.red('   ❌ OPTIMIZATION NEEDED - Performance targets not met'));
    }
    
    console.log(chalk.gray('\n' + '=' .repeat(60)));
  }

  exportMetrics(filename: string = 'performance-metrics.json'): void {
    const report = {
      timestamp: Date.now(),
      system: {
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch(),
        memory: os.totalmem()
      },
      metrics: this.metrics,
      baseline: this.baseline
    };
    
    require('fs').writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(chalk.green(`📊 Metrics exported to ${filename}`));
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  monitor.runPerformanceComparison()
    .then(() => {
      monitor.exportMetrics('tests/performance/performance-metrics.json');
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red('❌ Performance monitoring failed:'), error);
      process.exit(1);
    });
}

export { PerformanceMonitor };