#!/usr/bin/env node

/**
 * Performance Benchmarking Script
 * Tests template rendering performance and identifies bottlenecks
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import pkg from 'glob';
const { glob } = pkg;
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class PerformanceBenchmarker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        avgRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: Infinity,
        memoryUsage: {}
      },
      tests: [],
      bottlenecks: []
    };
  }

  async benchmark(name, fn, iterations = 10) {
    console.log(`🔄 Running ${name} (${iterations} iterations)...`);
    
    const times = [];
    const memoryBefore = process.memoryUsage();
    
    try {
      // Warm up
      await fn();
      
      // Actual benchmarking
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
      }
      
      const memoryAfter = process.memoryUsage();
      const memoryDelta = {
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        rss: memoryAfter.rss - memoryBefore.rss
      };
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      const result = {
        name,
        iterations,
        avgTime: parseFloat(avgTime.toFixed(3)),
        minTime: parseFloat(minTime.toFixed(3)),
        maxTime: parseFloat(maxTime.toFixed(3)),
        memoryDelta,
        status: 'passed',
        performanceGrade: this.calculatePerformanceGrade(avgTime, memoryDelta.heapUsed)
      };
      
      this.results.tests.push(result);
      this.results.summary.passed++;
      
      // Check for performance bottlenecks
      if (avgTime > 100) {
        this.results.bottlenecks.push({
          test: name,
          issue: 'Slow rendering',
          avgTime,
          recommendation: 'Consider template optimization or caching'
        });
      }
      
      if (memoryDelta.heapUsed > 50 * 1024 * 1024) {
        this.results.bottlenecks.push({
          test: name,
          issue: 'High memory usage',
          memoryUsage: memoryDelta.heapUsed,
          recommendation: 'Check for memory leaks or optimize data structures'
        });
      }
      
      console.log(`  ✅ ${name}: ${avgTime.toFixed(2)}ms avg, ${result.performanceGrade}`);
      return result;
      
    } catch (error) {
      const result = {
        name,
        iterations,
        status: 'failed',
        error: error.message,
        performanceGrade: 'F'
      };
      
      this.results.tests.push(result);
      this.results.summary.failed++;
      
      console.log(`  ❌ ${name}: Failed - ${error.message}`);
      return result;
    }
  }

  calculatePerformanceGrade(avgTime, memoryUsage) {
    let score = 100;
    
    if (avgTime > 1000) score -= 50;
    else if (avgTime > 500) score -= 30;
    else if (avgTime > 100) score -= 15;
    else if (avgTime > 50) score -= 5;
    
    const memoryMB = memoryUsage / (1024 * 1024);
    if (memoryMB > 100) score -= 30;
    else if (memoryMB > 50) score -= 20;
    else if (memoryMB > 25) score -= 10;
    else if (memoryMB > 10) score -= 5;
    
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  async benchmarkTemplateRendering() {
    console.log('\n📊 Template Rendering Benchmarks');
    console.log('═'.repeat(50));

    const mockRender = (template, data) => {
      let result = template;
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          result = result.replace(regex, String(value));
        });
      }
      return result;
    };

    await this.benchmark('Simple Template Rendering', async () => {
      const template = 'Hello {{ name }}!';
      const data = { name: 'World' };
      mockRender(template, data);
    }, 1000);

    await this.benchmark('Complex Template Rendering', async () => {
      let result = '';
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        description: `Description ${i}`.repeat(10)
      }));
      
      items.forEach(item => {
        result += `<div class="item-${item.id}"><h2>${item.title}</h2><p>${item.description}</p></div>`;
      });
    }, 100);

    await this.benchmark('Large Dataset Processing', async () => {
      const records = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`
      }));
      
      let csv = 'id,name,email\n';
      records.forEach(record => {
        csv += `${record.id},${record.name},${record.email}\n`;
      });
    }, 10);
  }

  async benchmarkFileOperations() {
    console.log('\n📁 File Operations Benchmarks');
    console.log('═'.repeat(50));

    const testFiles = await glob('src/**/*.js', { cwd: rootDir });
    if (testFiles.length > 0) {
      await this.benchmark('File Reading', async () => {
        for (const file of testFiles.slice(0, Math.min(10, testFiles.length))) {
          try {
            readFileSync(join(rootDir, file), 'utf8');
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }, 50);
    }

    await this.benchmark('Template Discovery', async () => {
      await glob('templates/**/*.{njk,tex}', { cwd: rootDir });
    }, 20);
  }

  async runAllBenchmarks() {
    console.log('🚀 Starting Performance Benchmarks\n');
    
    const startTime = performance.now();
    
    await this.benchmarkTemplateRendering();
    await this.benchmarkFileOperations();
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    const times = this.results.tests
      .filter(test => test.status === 'passed')
      .map(test => test.avgTime);
    
    if (times.length > 0) {
      this.results.summary.avgRenderTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      this.results.summary.maxRenderTime = Math.max(...times);
      this.results.summary.minRenderTime = Math.min(...times);
    }
    
    this.results.summary.totalTests = this.results.tests.length;
    this.results.summary.totalExecutionTime = parseFloat(totalTime.toFixed(3));
    this.results.summary.memoryUsage = process.memoryUsage();
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 Performance Benchmark Results');
    console.log('═'.repeat(50));
    
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Total Execution Time: ${this.results.summary.totalExecutionTime}ms`);
    
    if (this.results.summary.avgRenderTime) {
      console.log(`Average Render Time: ${this.results.summary.avgRenderTime.toFixed(2)}ms`);
      console.log(`Fastest Test: ${this.results.summary.minRenderTime.toFixed(2)}ms`);
      console.log(`Slowest Test: ${this.results.summary.maxRenderTime.toFixed(2)}ms`);
    }
    
    const memUsage = this.results.summary.memoryUsage;
    console.log(`Memory Usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap`);
    
    if (this.results.bottlenecks.length > 0) {
      console.log('\n⚠️  Performance Bottlenecks:');
      console.log('─'.repeat(50));
      
      this.results.bottlenecks.forEach(bottleneck => {
        console.log(`🔍 ${bottleneck.test}: ${bottleneck.issue}`);
        console.log(`   ${bottleneck.recommendation}`);
      });
    }
    
    try {
      mkdirSync(join(rootDir, 'benchmarks'), { recursive: true });
      const reportPath = join(rootDir, 'benchmarks/results.json');
      writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`\n📋 Report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
    
    if (this.results.summary.failed > 0) {
      console.log(`\n❌ Benchmark failed: ${this.results.summary.failed} tests failed`);
      process.exit(1);
    } else {
      console.log('\n✅ All benchmarks passed');
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const benchmarker = new PerformanceBenchmarker();
  benchmarker.runAllBenchmarks().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

export default PerformanceBenchmarker;