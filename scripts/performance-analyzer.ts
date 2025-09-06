#!/usr/bin/env tsx

/**
 * Comprehensive Performance Analysis Tool for Unjucks CLI
 * Provides real measurements across multiple scenarios and metrics
 */

import { performance } from 'node:perf_hooks';
import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

interface PerformanceMetric {
  operation: string;
  iterations: number;
  times: number[];
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  standardDeviation: number;
  memoryUsage?: MemoryUsage;
  success: boolean;
  errors?: string[];
}

interface MemoryUsage {
  rss: number;        // Resident Set Size
  heapUsed: number;   // Used heap memory
  heapTotal: number;  // Total heap memory
  external: number;   // External memory
  arrayBuffers: number;
}

interface BundleAnalysis {
  totalSize: number;
  minifiedSize: number;
  gzippedSize: number;
  dependencies: string[];
  sideEffects: number;
}

class PerformanceAnalyzer {
  private cliPath: string;
  private results: PerformanceMetric[] = [];
  private bundleInfo: BundleAnalysis | null = null;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
  }

  /**
   * Measure CLI startup time across different scenarios
   */
  async measureStartupPerformance(): Promise<void> {
    console.log('📊 Measuring CLI startup performance...');

    const scenarios = [
      { name: 'Cold Start (--version)', command: ['--version'] },
      { name: 'Help Display (--help)', command: ['--help'] },
      { name: 'List Generators', command: ['list'] },
      { name: 'Generator Help', command: ['help', 'command', 'citty'] }
    ];

    for (const scenario of scenarios) {
      await this.measureCommand(scenario.name, scenario.command, 10);
      // Add delay to avoid resource contention
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Measure template generation performance with various complexities
   */
  async measureTemplateGeneration(): Promise<void> {
    console.log('🎨 Measuring template generation performance...');

    // Ensure output directory exists
    const outputDir = path.join(this.projectRoot, 'perf-output');
    await fs.ensureDir(outputDir);

    const scenarios = [
      {
        name: 'Simple Template Generation',
        command: ['generate', 'command', 'citty', '--commandName=PerfTest', '--description=Performance test', '--dest=' + outputDir, '--force']
      },
      {
        name: 'Dry Run Generation',
        command: ['generate', 'command', 'citty', '--commandName=DryTest', '--description=Dry run test', '--dest=' + outputDir, '--dry']
      }
    ];

    for (const scenario of scenarios) {
      await this.measureCommand(scenario.name, scenario.command, 5);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Cleanup
    await fs.remove(outputDir).catch(() => {});
  }

  /**
   * Measure memory usage patterns
   */
  async measureMemoryUsage(): Promise<void> {
    console.log('🧠 Measuring memory usage patterns...');

    const scenarios = [
      { name: 'Memory - Version Command', command: ['--version'] },
      { name: 'Memory - List Command', command: ['list'] },
      { name: 'Memory - Help Command', command: ['--help'] }
    ];

    for (const scenario of scenarios) {
      await this.measureCommandWithMemory(scenario.name, scenario.command, 3);
    }
  }

  /**
   * Analyze bundle size and composition
   */
  async analyzeBundleSize(): Promise<void> {
    console.log('📦 Analyzing bundle size and composition...');

    try {
      // Re-build with verbose output to capture bundle info
      const buildOutput = execSync('npm run build', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });

      // Parse bundle information from build output
      const bundleLines = buildOutput.split('\n').filter(line => 
        line.includes('Size:') || line.includes('Dependencies:') || line.includes('Side effects:')
      );

      // Extract CLI bundle info
      const cliBundleMatch = buildOutput.match(/\[bundle\] \.\/dist\/cli\.mjs\n.*Size: ([\d.]+) kB, ([\d.]+) kB minified, ([\d.]+) kB min\+gzipped.*Side effects: ([\d.]+) kB\)/);
      
      if (cliBundleMatch) {
        this.bundleInfo = {
          totalSize: parseFloat(cliBundleMatch[1]) * 1024,
          minifiedSize: parseFloat(cliBundleMatch[2]) * 1024,
          gzippedSize: parseFloat(cliBundleMatch[3]) * 1024,
          sideEffects: parseFloat(cliBundleMatch[4]) * 1024,
          dependencies: this.extractDependencies(buildOutput)
        };
      }

      // Measure actual file sizes on disk
      const cliStats = await fs.stat(this.cliPath);
      console.log(`📏 Actual CLI file size: ${(cliStats.size / 1024).toFixed(2)} KB`);

    } catch (error) {
      console.error('❌ Bundle analysis failed:', error);
    }
  }

  /**
   * Measure command execution with detailed timing
   */
  private async measureCommand(name: string, command: string[], iterations: number): Promise<void> {
    const times: number[] = [];
    const errors: string[] = [];
    let success = false;

    console.log(`  🎯 Testing: ${name} (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        await execAsync(`node ${this.cliPath} ${command.join(' ')}`, {
          timeout: 10000,
          cwd: this.projectRoot
        });
        
        const endTime = performance.now();
        times.push(endTime - startTime);
        success = true;
        
      } catch (error: any) {
        const errorTime = performance.now();
        // Even failed commands can provide timing data
        if (error.code !== 'ETIMEDOUT') {
          times.push(errorTime);
        }
        errors.push(error.message || error.toString());
      }
    }

    if (times.length > 0) {
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const sortedTimes = [...times].sort((a, b) => a - b);
      const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
      
      const variance = times.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / times.length;
      const standardDeviation = Math.sqrt(variance);

      this.results.push({
        operation: name,
        iterations: times.length,
        times,
        averageTime,
        minTime,
        maxTime,
        medianTime,
        standardDeviation,
        success: success && errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      });

      console.log(`    ⏱️  Average: ${averageTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      if (errors.length > 0) {
        console.log(`    ⚠️  Errors: ${errors.length}/${iterations}`);
      }
    }
  }

  /**
   * Measure command with memory profiling
   */
  private async measureCommandWithMemory(name: string, command: string[], iterations: number): Promise<void> {
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    console.log(`  🧠 Memory profiling: ${name}`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const initialMemory = process.memoryUsage();

      try {
        const child = execSync(`node ${this.cliPath} ${command.join(' ')}`, {
          encoding: 'utf8',
          timeout: 10000,
          cwd: this.projectRoot
        });

        const endTime = performance.now();
        const finalMemory = process.memoryUsage();
        
        times.push(endTime - startTime);
        
        // Capture memory delta
        if (!memoryUsage) {
          memoryUsage = {
            rss: Math.abs(finalMemory.rss - initialMemory.rss) / (1024 * 1024),
            heapUsed: Math.abs(finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024),
            heapTotal: Math.abs(finalMemory.heapTotal - initialMemory.heapTotal) / (1024 * 1024),
            external: Math.abs(finalMemory.external - initialMemory.external) / (1024 * 1024),
            arrayBuffers: Math.abs(finalMemory.arrayBuffers - initialMemory.arrayBuffers) / (1024 * 1024)
          };
        }
      } catch (error) {
        console.error(`    ❌ Memory test failed: ${error}`);
      }
    }

    if (times.length > 0) {
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const sortedTimes = [...times].sort((a, b) => a - b);
      const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const standardDeviation = Math.sqrt(times.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / times.length);

      this.results.push({
        operation: name,
        iterations: times.length,
        times,
        averageTime,
        minTime,
        maxTime,
        medianTime,
        standardDeviation,
        memoryUsage,
        success: true
      });

      console.log(`    ⏱️  Time: ${averageTime.toFixed(2)}ms (±${standardDeviation.toFixed(2)}ms)`);
      if (memoryUsage) {
        console.log(`    💾 Memory: RSS ${memoryUsage.rss.toFixed(2)}MB, Heap ${memoryUsage.heapUsed.toFixed(2)}MB`);
      }
    }
  }

  /**
   * Extract dependencies from build output
   */
  private extractDependencies(buildOutput: string): string[] {
    const depMatches = buildOutput.match(/Dependencies: \[(.*?)\]/g);
    const dependencies = new Set<string>();
    
    if (depMatches) {
      for (const match of depMatches) {
        const deps = match.replace('Dependencies: [', '').replace(']', '').split(', ');
        deps.forEach(dep => dependencies.add(dep.trim()));
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Generate performance regression test thresholds
   */
  private generateRegressionThresholds(): any {
    const thresholds: any = {
      startupTime: {
        cold_start_max: 300,      // Max acceptable cold start time (ms)
        warm_start_max: 150,      // Max acceptable warm start time (ms)
        memory_max: 50            // Max acceptable memory usage (MB)
      },
      template_generation: {
        simple_template_max: 500,  // Max time for simple template (ms)
        complex_template_max: 2000, // Max time for complex template (ms)
        memory_per_template: 10    // Max memory per template (MB)
      },
      bundle_size: {
        cli_max_kb: 90,           // Max CLI bundle size (KB)
        total_max_kb: 200,        // Max total bundle size (KB)
        gzipped_max_kb: 20        // Max gzipped size (KB)
      }
    };

    return thresholds;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(): Promise<void> {
    const timestamp = new Date().toISOString();
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;

    const report = {
      metadata: {
        timestamp,
        nodeVersion,
        platform,
        architecture: arch,
        projectRoot: this.projectRoot,
        cliPath: this.cliPath
      },
      bundleAnalysis: this.bundleInfo,
      performanceMetrics: this.results,
      regressionThresholds: this.generateRegressionThresholds(),
      summary: this.generateSummary()
    };

    // Save detailed report
    const reportPath = path.join(this.projectRoot, 'reports', `performance-analysis-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJSON(reportPath, report, { spaces: 2 });

    // Save summary report
    const summaryPath = path.join(this.projectRoot, 'docs', 'performance-analysis.json');
    await fs.ensureDir(path.dirname(summaryPath));
    await fs.writeJSON(summaryPath, report, { spaces: 2 });

    console.log(`\n📋 Performance report saved to: ${reportPath}`);
    console.log(`📋 Summary report saved to: ${summaryPath}`);

    // Display summary
    this.displaySummary();
  }

  /**
   * Generate performance summary
   */
  private generateSummary(): any {
    const successfulMetrics = this.results.filter(m => m.success);
    const failedMetrics = this.results.filter(m => !m.success);

    const summary = {
      totalTests: this.results.length,
      successfulTests: successfulMetrics.length,
      failedTests: failedMetrics.length,
      successRate: successfulMetrics.length / this.results.length,
      averageStartupTime: 0,
      averageMemoryUsage: 0,
      bottlenecks: [] as string[]
    };

    if (successfulMetrics.length > 0) {
      summary.averageStartupTime = successfulMetrics.reduce((acc, m) => acc + m.averageTime, 0) / successfulMetrics.length;
      
      const memoryMetrics = successfulMetrics.filter(m => m.memoryUsage);
      if (memoryMetrics.length > 0) {
        summary.averageMemoryUsage = memoryMetrics.reduce((acc, m) => acc + (m.memoryUsage?.rss || 0), 0) / memoryMetrics.length;
      }

      // Identify bottlenecks (operations taking >200ms on average)
      const slowOperations = successfulMetrics.filter(m => m.averageTime > 200);
      summary.bottlenecks = slowOperations.map(m => `${m.operation}: ${m.averageTime.toFixed(2)}ms`);
    }

    return summary;
  }

  /**
   * Display performance summary to console
   */
  private displaySummary(): void {
    console.log('\n🎯 Performance Analysis Summary');
    console.log('==============================');
    
    const summary = this.generateSummary();
    
    console.log(`📊 Tests: ${summary.successfulTests}/${summary.totalTests} passed (${(summary.successRate * 100).toFixed(1)}%)`);
    console.log(`⏱️  Average startup time: ${summary.averageStartupTime.toFixed(2)}ms`);
    console.log(`💾 Average memory usage: ${summary.averageMemoryUsage.toFixed(2)}MB`);

    if (this.bundleInfo) {
      console.log(`📦 Bundle size: ${(this.bundleInfo.totalSize / 1024).toFixed(2)}KB (${(this.bundleInfo.gzippedSize / 1024).toFixed(2)}KB gzipped)`);
    }

    if (summary.bottlenecks.length > 0) {
      console.log('\n🐌 Performance bottlenecks identified:');
      summary.bottlenecks.forEach(bottleneck => console.log(`   • ${bottleneck}`));
    }

    console.log('\n✨ Performance analysis complete!');
  }

  /**
   * Run complete performance analysis
   */
  async runAnalysis(): Promise<void> {
    console.log('🚀 Starting comprehensive performance analysis...\n');

    try {
      // Verify CLI build exists
      if (!await fs.pathExists(this.cliPath)) {
        console.error('❌ CLI not found. Running build first...');
        execSync('npm run build', { stdio: 'inherit', cwd: this.projectRoot });
      }

      await this.analyzeBundleSize();
      await this.measureStartupPerformance();
      await this.measureTemplateGeneration();
      await this.measureMemoryUsage();
      await this.generateReport();

    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      process.exit(1);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.runAnalysis().catch(console.error);
}

export { PerformanceAnalyzer };