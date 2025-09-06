#!/usr/bin/env tsx

/**
 * Quick Performance Test - Real measurements for immediate analysis
 */

import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'path';

interface QuickBenchmark {
  operation: string;
  command: string;
  iterations: number;
  times: number[];
  average: number;
  min: number;
  max: number;
  median: number;
  success: boolean;
  errorRate: number;
}

class QuickPerformanceTest {
  private cliPath: string;
  private projectRoot: string;
  private results: QuickBenchmark[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
  }

  async measureCommand(name: string, command: string, iterations = 10): Promise<QuickBenchmark> {
    console.log(`📊 Testing: ${name} (${iterations} iterations)`);
    
    const times: number[] = [];
    let errors = 0;

    // Warmup
    try {
      execSync(`node ${this.cliPath} ${command}`, { stdio: 'pipe', timeout: 5000 });
    } catch (e) { /* ignore warmup errors */ }

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        execSync(`node ${this.cliPath} ${command}`, { 
          stdio: 'pipe', 
          timeout: 5000,
          cwd: this.projectRoot
        });
        times.push(performance.now() - start);
      } catch (error) {
        times.push(performance.now() - start);
        errors++;
      }
      
      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const sortedTimes = [...times].sort((a, b) => a - b);
    const result: QuickBenchmark = {
      operation: name,
      command,
      iterations,
      times,
      average,
      min: Math.min(...times),
      max: Math.max(...times),
      median: sortedTimes[Math.floor(sortedTimes.length / 2)],
      success: errors === 0,
      errorRate: (errors / iterations) * 100
    };

    this.results.push(result);
    console.log(`   ⏱️  ${average.toFixed(2)}ms avg (${result.min.toFixed(2)}-${result.max.toFixed(2)}ms)`);
    if (errors > 0) console.log(`   ❌ ${errors}/${iterations} errors`);

    return result;
  }

  async runQuickTests(): Promise<void> {
    console.log('🚀 Running Quick Performance Tests\n');

    // Test basic CLI operations
    await this.measureCommand('Version Check', '--version', 15);
    await this.measureCommand('Help Display', '--help', 10);
    await this.measureCommand('List Generators', 'list', 10);
    await this.measureCommand('Template Help', 'help command citty', 5);

    // Memory usage test
    await this.measureMemoryUsage();
    
    // Bundle size analysis
    await this.analyzeBundleSize();
  }

  async measureMemoryUsage(): Promise<void> {
    console.log('\n🧠 Memory Usage Test');
    
    const commands = ['--version', 'list', '--help'];
    const memoryResults: any[] = [];

    for (const cmd of commands) {
      const initialMem = process.memoryUsage();
      const start = performance.now();
      
      try {
        execSync(`node ${this.cliPath} ${cmd}`, { stdio: 'pipe', timeout: 5000 });
        const finalMem = process.memoryUsage();
        const duration = performance.now() - start;
        
        const memDelta = {
          rss: (finalMem.rss - initialMem.rss) / 1024 / 1024, // MB
          heapUsed: (finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024,
          duration
        };
        
        memoryResults.push({ command: cmd, memory: memDelta });
        console.log(`   💾 ${cmd}: ${Math.abs(memDelta.rss).toFixed(2)}MB RSS, ${Math.abs(memDelta.heapUsed).toFixed(2)}MB heap`);
      } catch (error) {
        console.log(`   ❌ ${cmd}: Failed`);
      }
    }
  }

  async analyzeBundleSize(): Promise<void> {
    console.log('\n📦 Bundle Analysis');
    
    try {
      const cliStats = await fs.stat(this.cliPath);
      const indexPath = path.join(this.projectRoot, 'dist/index.mjs');
      const indexStats = await fs.stat(indexPath);
      
      console.log(`   📏 CLI bundle: ${(cliStats.size / 1024).toFixed(2)} KB`);
      console.log(`   📏 Main bundle: ${(indexStats.size / 1024).toFixed(2)} KB`);
      console.log(`   📏 Total dist: ${((cliStats.size + indexStats.size) / 1024).toFixed(2)} KB`);
      
      // Check dependencies
      const packageJson = await fs.readJSON(path.join(this.projectRoot, 'package.json'));
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      console.log(`   📦 Dependencies: ${depCount}`);
      
    } catch (error) {
      console.log(`   ❌ Bundle analysis failed: ${error}`);
    }
  }

  generateReport(): void {
    console.log('\n📋 Quick Performance Report');
    console.log('============================');
    
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    console.log(`✅ Successful tests: ${successfulTests.length}/${this.results.length}`);
    console.log(`❌ Failed tests: ${failedTests.length}/${this.results.length}`);
    
    if (successfulTests.length > 0) {
      const avgStartupTime = successfulTests.reduce((acc, r) => acc + r.average, 0) / successfulTests.length;
      console.log(`⏱️  Average startup time: ${avgStartupTime.toFixed(2)}ms`);
      
      const fastestOp = successfulTests.reduce((prev, curr) => prev.average < curr.average ? prev : curr);
      const slowestOp = successfulTests.reduce((prev, curr) => prev.average > curr.average ? prev : curr);
      
      console.log(`🏃 Fastest: ${fastestOp.operation} (${fastestOp.average.toFixed(2)}ms)`);
      console.log(`🐌 Slowest: ${slowestOp.operation} (${slowestOp.average.toFixed(2)}ms)`);
    }

    // Performance assessment
    const concerns = [];
    for (const result of this.results) {
      if (result.average > 200) concerns.push(`${result.operation} is slow (${result.average.toFixed(2)}ms)`);
      if (result.errorRate > 0) concerns.push(`${result.operation} has ${result.errorRate.toFixed(1)}% error rate`);
    }

    if (concerns.length > 0) {
      console.log('\n⚠️  Performance Concerns:');
      concerns.forEach(concern => console.log(`   • ${concern}`));
    } else {
      console.log('\n✨ No major performance concerns detected!');
    }

    // Save results
    this.saveResults();
  }

  async saveResults(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        averageTime: this.results.reduce((acc, r) => acc + r.average, 0) / this.results.length
      }
    };

    const reportPath = path.join(this.projectRoot, 'reports', `quick-perf-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJSON(reportPath, report, { spaces: 2 });
    
    console.log(`\n📄 Report saved: ${reportPath}`);
  }
}

// Run the test
const test = new QuickPerformanceTest();
test.runQuickTests().then(() => test.generateReport()).catch(console.error);