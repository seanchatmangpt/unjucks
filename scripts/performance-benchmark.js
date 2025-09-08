#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

class PerformanceBenchmarker {
  constructor() {
    this.results = {
      testDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      tests: []
    };
    
    // Ensure results directory exists
    mkdirSync('tests/performance/results', { recursive: true });
  }

  async measureCommand(command, iterations = 5) {
    console.log(`📊 Benchmarking: ${command}`);
    
    const measurements = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();
      
      try {
        const { stdout, stderr } = await execAsync(`node src/cli/index.js ${command}`, {
          cwd: process.cwd(),
          timeout: 30000
        });
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(startCpu);
        
        measurements.push({
          executionTime: endTime - startTime,
          memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
          cpuUser: endCpu.user,
          cpuSystem: endCpu.system,
          success: true,
          outputLength: stdout ? stdout.length : 0
        });
        
        console.log(`  Run ${i + 1}: ${(endTime - startTime).toFixed(2)}ms`);
        
      } catch (error) {
        const endTime = performance.now();
        measurements.push({
          executionTime: endTime - startTime,
          memoryUsed: 0,
          cpuUser: 0,
          cpuSystem: 0,
          success: false,
          error: error.message
        });
        console.log(`  Run ${i + 1}: ERROR - ${error.message}`);
      }
    }
    
    // Calculate statistics
    const successfulRuns = measurements.filter(m => m.success);
    const stats = {
      command,
      iterations,
      successCount: successfulRuns.length,
      successRate: (successfulRuns.length / iterations) * 100,
      averageTime: successfulRuns.length > 0 ? 
        successfulRuns.reduce((sum, m) => sum + m.executionTime, 0) / successfulRuns.length : 0,
      minTime: successfulRuns.length > 0 ? 
        Math.min(...successfulRuns.map(m => m.executionTime)) : 0,
      maxTime: successfulRuns.length > 0 ? 
        Math.max(...successfulRuns.map(m => m.executionTime)) : 0,
      averageMemory: successfulRuns.length > 0 ? 
        successfulRuns.reduce((sum, m) => sum + m.memoryUsed, 0) / successfulRuns.length : 0,
      measurements
    };
    
    console.log(`  ✅ Average: ${stats.averageTime.toFixed(2)}ms`);
    console.log(`  📊 Range: ${stats.minTime.toFixed(2)}ms - ${stats.maxTime.toFixed(2)}ms`);
    console.log(`  💾 Memory: ${(stats.averageMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  🎯 Success Rate: ${stats.successRate.toFixed(1)}%\n`);
    
    return stats;
  }

  async runCLIPerformanceTests() {
    console.log('🚀 Starting CLI Performance Benchmarks\n');
    
    const commands = [
      '--help',
      '--version',
      'list',
      'help',
      'help generate',
      'generate --help'
    ];
    
    for (const command of commands) {
      const result = await this.measureCommand(command);
      this.results.tests.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async measureFilterPerformance() {
    console.log('🔧 Testing Filter Performance\n');
    
    // Create a test template with various filters
    const testTemplate = `
{{ "hello world" | upper }}
{{ [1,2,3,4,5] | length }}
{{ "test string with spaces" | replace(" ", "_") }}
{{ range(100) | list | join(",") | length }}
    `.trim();
    
    const nunjucks = await import('nunjucks');
    const env = new nunjucks.Environment();
    
    const filterTests = [
      { name: 'upper', template: '{{ "test" | upper }}' },
      { name: 'length', template: '{{ [1,2,3] | length }}' },
      { name: 'replace', template: '{{ "hello world" | replace("world", "test") }}' },
      { name: 'join', template: '{{ ["a","b","c"] | join("-") }}' }
    ];
    
    const filterResults = [];
    
    for (const test of filterTests) {
      console.log(`Testing filter: ${test.name}`);
      
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        try {
          env.renderString(test.template);
        } catch (error) {
          console.warn(`Filter ${test.name} error:`, error.message);
          break;
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      const result = {
        filterName: test.name,
        iterations,
        totalTime,
        averageTime: avgTime,
        throughput: iterations / (totalTime / 1000)
      };
      
      filterResults.push(result);
      
      console.log(`  Average: ${avgTime.toFixed(4)}ms per operation`);
      console.log(`  Throughput: ${result.throughput.toFixed(0)} ops/sec\n`);
    }
    
    this.results.filterPerformance = filterResults;
  }

  async measureConcurrentExecution() {
    console.log('⚡ Testing Concurrent Execution\n');
    
    const concurrentCount = 5;
    const command = 'list';
    
    console.log(`Running ${concurrentCount} concurrent "${command}" commands...`);
    
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrentCount }, (_, i) => 
      this.measureSingleExecution(command, `concurrent-${i}`)
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const concurrentResult = {
      command,
      concurrentCount,
      totalTime: endTime - startTime,
      results,
      averageTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
      successRate: (results.filter(r => r.success).length / results.length) * 100
    };
    
    console.log(`  Total time: ${concurrentResult.totalTime.toFixed(2)}ms`);
    console.log(`  Average per command: ${concurrentResult.averageTime.toFixed(2)}ms`);
    console.log(`  Success rate: ${concurrentResult.successRate.toFixed(1)}%\n`);
    
    this.results.concurrentExecution = concurrentResult;
  }

  async measureSingleExecution(command, id) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const { stdout, stderr } = await execAsync(`node src/cli/index.js ${command}`, {
        cwd: process.cwd(),
        timeout: 15000
      });
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      return {
        id,
        executionTime: endTime - startTime,
        memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
        success: true,
        outputLength: stdout ? stdout.length : 0
      };
      
    } catch (error) {
      const endTime = performance.now();
      return {
        id,
        executionTime: endTime - startTime,
        memoryUsed: 0,
        success: false,
        error: error.message
      };
    }
  }

  generateReport() {
    const summary = {
      totalTests: this.results.tests.length,
      averageStartupTime: this.results.tests.reduce((sum, t) => sum + t.averageTime, 0) / this.results.tests.length,
      overallSuccessRate: this.results.tests.reduce((sum, t) => sum + t.successRate, 0) / this.results.tests.length,
      fastestCommand: this.results.tests.reduce((prev, curr) => 
        prev.averageTime < curr.averageTime ? prev : curr),
      slowestCommand: this.results.tests.reduce((prev, curr) => 
        prev.averageTime > curr.averageTime ? prev : curr)
    };
    
    this.results.summary = summary;
    
    // Save results
    const resultsFile = 'tests/performance/results/benchmark-results.json';
    writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    // Generate report
    console.log('📋 PERFORMANCE BENCHMARK REPORT');
    console.log('═'.repeat(50));
    console.log(`Test Date: ${this.results.testDate}`);
    console.log(`Node Version: ${this.results.nodeVersion}`);
    console.log(`Platform: ${this.results.platform} (${this.results.arch})`);
    console.log(`\n📊 CLI PERFORMANCE SUMMARY:`);
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Average Startup Time: ${summary.averageStartupTime.toFixed(2)}ms`);
    console.log(`  Overall Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`);
    console.log(`  Fastest Command: ${summary.fastestCommand.command} (${summary.fastestCommand.averageTime.toFixed(2)}ms)`);
    console.log(`  Slowest Command: ${summary.slowestCommand.command} (${summary.slowestCommand.averageTime.toFixed(2)}ms)`);
    
    if (this.results.filterPerformance) {
      console.log(`\n🔧 FILTER PERFORMANCE:`);
      this.results.filterPerformance.forEach(filter => {
        console.log(`  ${filter.filterName}: ${filter.averageTime.toFixed(4)}ms avg, ${filter.throughput.toFixed(0)} ops/sec`);
      });
    }
    
    if (this.results.concurrentExecution) {
      console.log(`\n⚡ CONCURRENT EXECUTION:`);
      console.log(`  ${this.results.concurrentExecution.concurrentCount} concurrent processes`);
      console.log(`  Total time: ${this.results.concurrentExecution.totalTime.toFixed(2)}ms`);
      console.log(`  Average per process: ${this.results.concurrentExecution.averageTime.toFixed(2)}ms`);
      console.log(`  Success rate: ${this.results.concurrentExecution.successRate.toFixed(1)}%`);
    }
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    console.log('═'.repeat(50));
    
    // Performance assertions
    console.log('\n🎯 PERFORMANCE ASSESSMENT:');
    
    const assessments = [
      {
        metric: 'Average Startup Time',
        value: summary.averageStartupTime,
        target: 5000,
        unit: 'ms',
        passed: summary.averageStartupTime < 5000
      },
      {
        metric: 'Success Rate', 
        value: summary.overallSuccessRate,
        target: 95,
        unit: '%',
        passed: summary.overallSuccessRate >= 95
      },
      {
        metric: 'Fastest Command',
        value: summary.fastestCommand.averageTime,
        target: 3000,
        unit: 'ms',
        passed: summary.fastestCommand.averageTime < 3000
      }
    ];
    
    assessments.forEach(assessment => {
      const status = assessment.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} ${assessment.metric}: ${assessment.value.toFixed(2)}${assessment.unit} (target: ${assessment.target}${assessment.unit})`);
    });
    
    const overallGrade = assessments.every(a => a.passed) ? 'A+' : 
                        assessments.filter(a => a.passed).length >= 2 ? 'B+' : 'C';
    
    console.log(`\n🏆 OVERALL PERFORMANCE GRADE: ${overallGrade}`);
    
    return this.results;
  }

  async run() {
    try {
      await this.runCLIPerformanceTests();
      await this.measureFilterPerformance();
      await this.measureConcurrentExecution();
      return this.generateReport();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      throw error;
    }
  }
}

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmarker = new PerformanceBenchmarker();
  benchmarker.run().catch(error => {
    console.error('Benchmark execution failed:', error);
    process.exit(1);
  });
}

export default PerformanceBenchmarker;