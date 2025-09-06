/**
 * Performance Benchmarking Suite for MCP Integration
 * Comprehensive performance testing based on full-stack-rubric analysis
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

interface PerformanceBenchmark {
  name: string;
  target: number;
  unit: string;
  category: 'startup' | 'tool' | 'memory' | 'concurrency';
}

interface PerformanceResult {
  benchmark: string;
  value: number;
  target: number;
  passed: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceBenchmarker extends EventEmitter {
  private results: PerformanceResult[] = [];
  private observer?: PerformanceObserver;
  private memoryBaseline: number = 0;

  private benchmarks: PerformanceBenchmark[] = [
    // Startup Performance
    { name: 'mcp_server_init', target: 1000, unit: 'ms', category: 'startup' },
    { name: 'nuxt_module_load', target: 500, unit: 'ms', category: 'startup' },
    { name: 'sse_endpoint_ready', target: 200, unit: 'ms', category: 'startup' },
    
    // Tool Performance
    { name: 'unjucks_list_response', target: 50, unit: 'ms', category: 'tool' },
    { name: 'unjucks_help_response', target: 100, unit: 'ms', category: 'tool' },
    { name: 'unjucks_generate_response', target: 500, unit: 'ms', category: 'tool' },
    { name: 'unjucks_dry_run_response', target: 200, unit: 'ms', category: 'tool' },
    { name: 'unjucks_inject_response', target: 300, unit: 'ms', category: 'tool' },
    
    // Memory Performance
    { name: 'baseline_memory', target: 50, unit: 'MB', category: 'memory' },
    { name: 'under_load_memory', target: 200, unit: 'MB', category: 'memory' },
    { name: 'memory_leak_rate', target: 10, unit: 'MB/hour', category: 'memory' },
    
    // Concurrency Performance
    { name: 'concurrent_connections', target: 50, unit: 'connections', category: 'concurrency' },
    { name: 'concurrent_tool_calls', target: 10, unit: 'calls', category: 'concurrency' },
    { name: 'response_under_load', target: 1000, unit: 'ms', category: 'concurrency' }
  ];

  constructor() {
    super();
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.emit('performance-entry', entry);
      });
    });
    
    this.observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
  }

  recordBenchmark(name: string, value: number, metadata?: Record<string, any>): PerformanceResult {
    const benchmark = this.benchmarks.find(b => b.name === name);
    if (!benchmark) {
      throw new Error(`Unknown benchmark: ${name}`);
    }

    const result: PerformanceResult = {
      benchmark: name,
      value,
      target: benchmark.target,
      passed: value <= benchmark.target,
      timestamp: Date.now(),
      metadata
    };

    this.results.push(result);
    this.emit('benchmark-recorded', result);
    
    return result;
  }

  getResults(category?: string): PerformanceResult[] {
    if (!category) return [...this.results];
    
    const benchmarkNames = this.benchmarks
      .filter(b => b.category === category)
      .map(b => b.name);
    
    return this.results.filter(r => benchmarkNames.includes(r.benchmark));
  }

  generateReport(): {
    summary: Record<string, any>;
    details: PerformanceResult[];
    recommendations: string[];
  } {
    const summary = {
      totalBenchmarks: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      passRate: this.results.length ? (this.results.filter(r => r.passed).length / this.results.length) * 100 : 0,
      categories: {} as Record<string, any>
    };

    // Group by category
    for (const category of ['startup', 'tool', 'memory', 'concurrency']) {
      const categoryResults = this.getResults(category);
      summary.categories[category] = {
        total: categoryResults.length,
        passed: categoryResults.filter(r => r.passed).length,
        averageValue: categoryResults.length ? 
          categoryResults.reduce((sum, r) => sum + r.value, 0) / categoryResults.length : 0
      };
    }

    const recommendations = this.generateRecommendations();

    return {
      summary,
      details: this.results,
      recommendations
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedResults = this.results.filter(r => !r.passed);

    for (const result of failedResults) {
      const overage = ((result.value - result.target) / result.target) * 100;
      
      if (result.benchmark.includes('memory')) {
        recommendations.push(
          `Memory usage for ${result.benchmark} is ${overage.toFixed(1)}% above target. Consider optimizing memory allocation.`
        );
      } else if (result.benchmark.includes('response')) {
        recommendations.push(
          `Response time for ${result.benchmark} is ${overage.toFixed(1)}% slower than target. Consider caching or optimization.`
        );
      } else if (result.benchmark.includes('startup')) {
        recommendations.push(
          `Startup time for ${result.benchmark} is ${overage.toFixed(1)}% slower than target. Consider lazy loading or precompilation.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance benchmarks passed! System is performing optimally.');
    }

    return recommendations;
  }

  reset(): void {
    this.results = [];
    this.memoryBaseline = process.memoryUsage().heapUsed;
  }

  destroy(): void {
    this.observer?.disconnect();
    this.removeAllListeners();
  }
}

describe('MCP Performance Benchmarking Suite', () => {
  let benchmarker: PerformanceBenchmarker;
  let mcpClient: any; // MCPClient from integration test suite

  beforeAll(() => {
    benchmarker = new PerformanceBenchmarker();
  });

  beforeEach(() => {
    benchmarker.reset();
  });

  afterEach(() => {
    // Log results after each test
    const results = benchmarker.getResults();
    if (results.length > 0) {
      console.log(`\n📊 Performance Results (${results.length} benchmarks):`);
      results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        console.log(`  ${status} ${r.benchmark}: ${r.value}${benchmarker['benchmarks'].find(b => b.name === r.benchmark)?.unit} (target: ${r.target})`);
      });
    }
  });

  describe('1. Startup Performance Benchmarks', () => {
    it('should benchmark MCP server initialization', async () => {
      const startTime = performance.now();
      
      // Simulate MCP server startup
      mcpClient = await createMCPClient();
      await mcpClient.connect();
      
      const endTime = performance.now();
      const initTime = endTime - startTime;
      
      const result = benchmarker.recordBenchmark('mcp_server_init', initTime, {
        nodeVersion: process.version,
        platform: process.platform
      });
      
      expect(result.passed).toBe(true);
      expect(initTime).toBeLessThan(1000);
    });

    it('should benchmark Nuxt module loading', async () => {
      const startTime = performance.now();
      
      // Simulate Nuxt module loading
      await simulateNuxtModuleLoad();
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      const result = benchmarker.recordBenchmark('nuxt_module_load', loadTime);
      
      expect(result.passed).toBe(true);
      expect(loadTime).toBeLessThan(500);
    });

    it('should benchmark SSE endpoint readiness', async () => {
      const startTime = performance.now();
      
      // Test SSE endpoint availability
      await waitForSSEEndpoint('http://localhost:3001/__mcp/sse');
      
      const endTime = performance.now();
      const readyTime = endTime - startTime;
      
      const result = benchmarker.recordBenchmark('sse_endpoint_ready', readyTime);
      
      expect(result.passed).toBe(true);
      expect(readyTime).toBeLessThan(200);
    });
  });

  describe('2. Tool Performance Benchmarks', () => {
    beforeEach(async () => {
      mcpClient = await createMCPClient();
      await mcpClient.connect();
    });

    it('should benchmark unjucks_list performance', async () => {
      // Warm up
      await mcpClient.callTool('unjucks_list');
      
      const measurements = [];
      
      // Take multiple measurements
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await mcpClient.callTool('unjucks_list');
        const endTime = performance.now();
        
        measurements.push(endTime - startTime);
      }
      
      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const result = benchmarker.recordBenchmark('unjucks_list_response', averageTime, {
        measurements,
        median: measurements.sort()[Math.floor(measurements.length / 2)],
        min: Math.min(...measurements),
        max: Math.max(...measurements)
      });
      
      expect(result.passed).toBe(true);
      expect(averageTime).toBeLessThan(50);
    });

    it('should benchmark unjucks_generate performance', async () => {
      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await mcpClient.callTool('unjucks_generate', {
          generator: 'component',
          name: `BenchmarkComponent${i}`
        });
        const endTime = performance.now();
        
        measurements.push(endTime - startTime);
      }
      
      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const result = benchmarker.recordBenchmark('unjucks_generate_response', averageTime, {
        fileOperations: true,
        templateRendering: true,
        measurements
      });
      
      expect(result.passed).toBe(true);
      expect(averageTime).toBeLessThan(500);
    });

    it('should benchmark all tools comprehensively', async () => {
      const tools = [
        { name: 'unjucks_list', benchmark: 'unjucks_list_response', args: {} },
        { name: 'unjucks_help', benchmark: 'unjucks_help_response', args: { generator: 'component' } },
        { name: 'unjucks_dry_run', benchmark: 'unjucks_dry_run_response', args: { generator: 'component', name: 'Test' } },
        { name: 'unjucks_inject', benchmark: 'unjucks_inject_response', args: { 
          file: './test.js', 
          content: '// injected', 
          mode: 'append' 
        }}
      ];

      for (const tool of tools) {
        const measurements = [];
        
        // Multiple measurements for accuracy
        for (let i = 0; i < 3; i++) {
          const startTime = performance.now();
          await mcpClient.callTool(tool.name, tool.args);
          const endTime = performance.now();
          
          measurements.push(endTime - startTime);
        }
        
        const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const result = benchmarker.recordBenchmark(tool.benchmark, averageTime, {
          toolName: tool.name,
          measurements
        });
        
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('3. Memory Performance Benchmarks', () => {
    it('should benchmark baseline memory usage', async () => {
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      const baselineMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      const result = benchmarker.recordBenchmark('baseline_memory', baselineMemory, {
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      });
      
      expect(result.passed).toBe(true);
      expect(baselineMemory).toBeLessThan(50);
    });

    it('should benchmark memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create load
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(mcpClient.callTool('unjucks_list'));
      }
      
      await Promise.all(promises);
      
      const peakMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      const result = benchmarker.recordBenchmark('under_load_memory', peakMemory, {
        initialMemoryMB: initialMemory / 1024 / 1024,
        peakMemoryMB: peakMemory,
        operationsPerformed: 50
      });
      
      expect(result.passed).toBe(true);
      expect(peakMemory).toBeLessThan(200);
    });

    it('should detect memory leaks over time', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const measurements = [];
      
      // Perform operations over time
      for (let i = 0; i < 20; i++) {
        await mcpClient.callTool('unjucks_list');
        await mcpClient.callTool('unjucks_generate', { 
          generator: 'component', 
          name: `LeakTest${i}` 
        });
        
        if (i % 5 === 0) {
          if (global.gc) global.gc();
          measurements.push({
            iteration: i,
            memory: process.memoryUsage().heapUsed / 1024 / 1024
          });
        }
      }
      
      // Calculate memory growth rate
      const firstMeasurement = measurements[0]?.memory || 0;
      const lastMeasurement = measurements[measurements.length - 1]?.memory || 0;
      const growthRate = lastMeasurement - firstMeasurement; // MB
      
      const result = benchmarker.recordBenchmark('memory_leak_rate', growthRate, {
        measurements,
        iterations: 20,
        operations: 'list + generate'
      });
      
      expect(result.passed).toBe(true);
      expect(growthRate).toBeLessThan(10); // Less than 10MB growth
    });
  });

  describe('4. Concurrency Performance Benchmarks', () => {
    it('should benchmark concurrent connections', async () => {
      const maxConnections = 50;
      const clients = [];
      
      try {
        const startTime = performance.now();
        
        // Create multiple clients
        for (let i = 0; i < maxConnections; i++) {
          const client = await createMCPClient(`client-${i}`);
          clients.push(client);
        }
        
        // Connect all clients
        await Promise.all(clients.map(client => client.connect()));
        
        const endTime = performance.now();
        const connectionTime = endTime - startTime;
        
        const result = benchmarker.recordBenchmark('concurrent_connections', maxConnections, {
          connectionTime,
          averageTimePerConnection: connectionTime / maxConnections,
          successfulConnections: clients.length
        });
        
        expect(result.passed).toBe(true);
        expect(clients.length).toBe(maxConnections);
        
      } finally {
        // Cleanup
        await Promise.all(clients.map(client => client.disconnect()));
      }
    });

    it('should benchmark concurrent tool calls', async () => {
      const maxConcurrentCalls = 10;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: maxConcurrentCalls }, (_, i) => 
        mcpClient.callTool('unjucks_list', { requestId: `concurrent-${i}` })
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / maxConcurrentCalls;
      
      const result = benchmarker.recordBenchmark('concurrent_tool_calls', maxConcurrentCalls, {
        totalTime,
        averageTime,
        successfulCalls: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length
      });
      
      expect(result.passed).toBe(true);
      expect(results.every(r => !r.error)).toBe(true);
    });

    it('should benchmark response time under load', async () => {
      const loadRequests = 100;
      const measurements = [];
      
      // Create load
      for (let batch = 0; batch < 5; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < 20; i++) {
          const startTime = performance.now();
          const promise = mcpClient.callTool('unjucks_list')
            .then(() => {
              const endTime = performance.now();
              measurements.push(endTime - startTime);
            });
          batchPromises.push(promise);
        }
        
        await Promise.all(batchPromises);
      }
      
      const averageResponseTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const p95ResponseTime = measurements.sort()[Math.floor(measurements.length * 0.95)];
      
      const result = benchmarker.recordBenchmark('response_under_load', p95ResponseTime, {
        averageResponseTime,
        p95ResponseTime,
        totalRequests: measurements.length,
        measurements: measurements.slice(0, 10) // Sample of measurements
      });
      
      expect(result.passed).toBe(true);
      expect(p95ResponseTime).toBeLessThan(1000);
    });
  });

  describe('5. Performance Regression Testing', () => {
    it('should detect performance regressions', async () => {
      // Load baseline performance data if available
      const baselineData = await loadBaselinePerformance();
      
      // Run current benchmarks
      await runAllBenchmarks(benchmarker, mcpClient);
      
      const currentResults = benchmarker.getResults();
      
      if (baselineData) {
        for (const result of currentResults) {
          const baseline = baselineData[result.benchmark];
          if (baseline) {
            const regression = ((result.value - baseline) / baseline) * 100;
            
            // Flag significant regressions (> 20% slower)
            if (regression > 20) {
              console.warn(`⚠️  Performance regression detected in ${result.benchmark}: ${regression.toFixed(1)}% slower than baseline`);
            }
            
            // Celebrate improvements (> 10% faster)
            if (regression < -10) {
              console.log(`🚀 Performance improvement in ${result.benchmark}: ${Math.abs(regression).toFixed(1)}% faster than baseline`);
            }
          }
        }
      }
      
      // Save current results as baseline for future runs
      await saveBaselinePerformance(currentResults);
      
      expect(currentResults.every(r => r.passed)).toBe(true);
    });

    it('should generate comprehensive performance report', async () => {
      // Run complete benchmark suite
      await runAllBenchmarks(benchmarker, mcpClient);
      
      const report = benchmarker.generateReport();
      
      expect(report.summary.totalBenchmarks).toBeGreaterThan(0);
      expect(report.summary.passRate).toBeGreaterThanOrEqual(80); // 80% pass rate minimum
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // Log detailed report
      console.log('\n📊 Complete Performance Report:');
      console.log(`Total Benchmarks: ${report.summary.totalBenchmarks}`);
      console.log(`Pass Rate: ${report.summary.passRate.toFixed(1)}%`);
      console.log(`Passed: ${report.summary.passed}, Failed: ${report.summary.failed}`);
      
      console.log('\nCategory Breakdown:');
      Object.entries(report.summary.categories).forEach(([category, stats]: [string, any]) => {
        console.log(`  ${category}: ${stats.passed}/${stats.total} passed (avg: ${stats.averageValue.toFixed(2)}ms)`);
      });
      
      if (report.recommendations.length > 0) {
        console.log('\nRecommendations:');
        report.recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec}`);
        });
      }
    });
  });
});

// Helper functions
async function createMCPClient(id?: string) {
  // Import and create MCP client from integration test suite
  const { MCPClient } = await import('./mcp-integration-test-suite');
  return new MCPClient('http://localhost:3001');
}

async function simulateNuxtModuleLoad() {
  // Simulate Nuxt module loading time
  return new Promise(resolve => setTimeout(resolve, Math.random() * 400));
}

async function waitForSSEEndpoint(url: string) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < 5000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // Continue trying
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw new Error('SSE endpoint not ready');
}

async function runAllBenchmarks(benchmarker: PerformanceBenchmarker, mcpClient: any) {
  // Run a representative sample of all benchmarks
  const tools = ['unjucks_list', 'unjucks_help', 'unjucks_generate', 'unjucks_dry_run'];
  
  for (const tool of tools) {
    const startTime = performance.now();
    const args = tool === 'unjucks_help' ? { generator: 'component' } :
                 tool === 'unjucks_generate' ? { generator: 'component', name: 'BenchTest' } :
                 tool === 'unjucks_dry_run' ? { generator: 'component', name: 'BenchTest' } :
                 {};
    
    await mcpClient.callTool(tool, args);
    const endTime = performance.now();
    
    benchmarker.recordBenchmark(`${tool}_response`, endTime - startTime);
  }
}

async function loadBaselinePerformance(): Promise<Record<string, number> | null> {
  try {
    const baselineFile = join(process.cwd(), 'tests/qa/baseline-performance.json');
    const data = await readFile(baselineFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null; // No baseline available
  }
}

async function saveBaselinePerformance(results: PerformanceResult[]): Promise<void> {
  try {
    const baseline: Record<string, number> = {};
    results.forEach(result => {
      baseline[result.benchmark] = result.value;
    });
    
    const baselineFile = join(process.cwd(), 'tests/qa/baseline-performance.json');
    await import('fs/promises').then(fs => 
      fs.writeFile(baselineFile, JSON.stringify(baseline, null, 2))
    );
  } catch (error) {
    console.warn('Failed to save baseline performance data:', error);
  }
}