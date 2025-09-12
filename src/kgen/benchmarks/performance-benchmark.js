/**
 * KGEN Performance Benchmark Suite
 * Validates 2x speed improvement through optimized implementations
 */

import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { consola } from 'consola';

// Import optimized implementations
import ProductionContentCache from '../optimized/production-cache.js';
import ParallelRDFProcessor from '../optimized/parallel-rdf-processor.js';

// Import baseline implementations for comparison
import ContentAddressedCache from '../deterministic/content-cache.js';
import { StandaloneKGenBridge } from '../rdf/standalone-bridge.js';

export class PerformanceBenchmark {
  constructor(options = {}) {
    this.config = {
      iterations: options.iterations || 10,
      warmupRuns: options.warmupRuns || 3,
      testDataDir: options.testDataDir || './tests/fixtures/performance',
      reportDir: options.reportDir || './benchmarks/reports',
      enableProfiling: options.enableProfiling || false
    };
    
    this.logger = consola.withTag('benchmark');
    this.results = {};
    
    // Test cases with expected performance targets
    this.testCases = [
      {
        name: 'small-graph',
        file: 'small-100.ttl',
        target: 50, // ms
        description: 'Small RDF graph (100 triples)'
      },
      {
        name: 'medium-graph', 
        file: 'medium-1000.ttl',
        target: 80, // ms
        description: 'Medium RDF graph (1000 triples)'
      },
      {
        name: 'large-graph',
        file: 'large-10000.ttl', 
        target: 120, // ms
        description: 'Large RDF graph (10000 triples)'
      },
      {
        name: 'massive-graph',
        file: 'massive-enterprise-graph.ttl',
        target: 200, // ms
        description: 'Massive enterprise graph (70k+ triples)'
      }
    ];
  }
  
  /**
   * Run complete benchmark suite
   */
  async runBenchmarkSuite() {
    this.logger.info('Starting KGEN performance benchmark suite...');
    
    try {
      // Initialize benchmark environment
      await this._initializeBenchmarkEnvironment();
      
      // Run baseline benchmarks
      this.logger.info('Running baseline benchmarks...');
      const baselineResults = await this._runBaselineBenchmarks();
      
      // Run optimized benchmarks  
      this.logger.info('Running optimized benchmarks...');
      const optimizedResults = await this._runOptimizedBenchmarks();
      
      // Compare results and generate report
      const comparison = this._compareResults(baselineResults, optimizedResults);
      const report = await this._generatePerformanceReport(comparison);
      
      this.logger.success('Benchmark suite completed successfully');
      return report;
      
    } catch (error) {
      this.logger.error('Benchmark suite failed:', error);
      throw error;
    }
  }
  
  /**
   * Run cache performance benchmarks
   */
  async benchmarkCachePerformance() {
    this.logger.info('Benchmarking cache performance...');
    
    const baselineCache = new ContentAddressedCache();
    const optimizedCache = new ProductionContentCache({
      maxMemoryEntries: 1000,
      enablePrefetch: true
    });
    
    const testData = await this._generateCacheTestData();
    
    // Baseline cache benchmark
    const baselineTime = await this._benchmarkCache(baselineCache, testData, 'baseline');
    
    // Optimized cache benchmark
    const optimizedTime = await this._benchmarkCache(optimizedCache, testData, 'optimized');
    
    const improvement = ((baselineTime - optimizedTime) / baselineTime * 100).toFixed(2);
    
    return {
      baseline: baselineTime,
      optimized: optimizedTime,
      improvement: `${improvement}%`,
      targetMet: optimizedTime < (baselineTime * 0.7), // 30% improvement target
      cacheStats: {
        baseline: baselineCache.getStatistics(),
        optimized: optimizedCache.getStatistics()
      }
    };
  }
  
  /**
   * Run RDF processing benchmarks
   */
  async benchmarkRDFProcessing() {
    this.logger.info('Benchmarking RDF processing performance...');
    
    const baselineProcessor = new StandaloneKGenBridge();
    const optimizedProcessor = new ParallelRDFProcessor();
    
    const results = {};
    
    for (const testCase of this.testCases) {
      const filePath = path.join(this.config.testDataDir, testCase.file);
      
      if (!(await this._fileExists(filePath))) {
        this.logger.warn(`Test file not found: ${filePath}, skipping ${testCase.name}`);
        continue;
      }
      
      this.logger.info(`Testing ${testCase.name}: ${testCase.description}`);
      
      // Warmup
      await this._warmupRDFProcessing(baselineProcessor, optimizedProcessor, filePath);
      
      // Baseline benchmark
      const baselineTime = await this._benchmarkRDFOperation(
        () => baselineProcessor.graphIndex(filePath),
        testCase.name + '_baseline'
      );
      
      // Optimized benchmark  
      const optimizedTime = await this._benchmarkRDFOperation(
        () => optimizedProcessor.graphIndexParallel(filePath),
        testCase.name + '_optimized'
      );
      
      const improvement = ((baselineTime - optimizedTime) / baselineTime * 100).toFixed(2);
      const targetMet = optimizedTime <= testCase.target;
      
      results[testCase.name] = {
        description: testCase.description,
        baseline: `${baselineTime.toFixed(2)}ms`,
        optimized: `${optimizedTime.toFixed(2)}ms`,
        improvement: `${improvement}%`,
        target: `${testCase.target}ms`,
        targetMet: targetMet,
        speedup: `${(baselineTime / optimizedTime).toFixed(2)}x`
      };
    }
    
    await optimizedProcessor.shutdown();
    
    return results;
  }
  
  /**
   * Memory usage benchmark
   */
  async benchmarkMemoryUsage() {
    this.logger.info('Benchmarking memory usage...');
    
    const initialMemory = process.memoryUsage();
    
    // Test memory usage with large dataset
    const largeGraphPath = path.join(this.config.testDataDir, 'massive-enterprise-graph.ttl');
    
    if (!(await this._fileExists(largeGraphPath))) {
      return { error: 'Large test file not available for memory benchmark' };
    }
    
    const processor = new ParallelRDFProcessor();
    
    const memoryBefore = process.memoryUsage();
    await processor.processGraphParallel(largeGraphPath);
    const memoryAfter = process.memoryUsage();
    
    await processor.shutdown();
    
    const memoryUsed = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      external: memoryAfter.external - memoryBefore.external
    };
    
    return {
      memoryUsedMB: {
        rss: (memoryUsed.rss / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsed.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memoryUsed.heapTotal / 1024 / 1024).toFixed(2),
        external: (memoryUsed.external / 1024 / 1024).toFixed(2)
      },
      efficient: memoryUsed.heapUsed < 100 * 1024 * 1024 // Under 100MB heap growth
    };
  }
  
  // Private methods
  
  async _initializeBenchmarkEnvironment() {
    // Ensure test data directory exists
    try {
      await fs.access(this.config.testDataDir);
    } catch (error) {
      this.logger.warn(`Test data directory not found: ${this.config.testDataDir}`);
      this.logger.info('Using available test files from fixtures directory');
      this.config.testDataDir = './tests/fixtures/turtle/performance';
    }
    
    // Create report directory
    await fs.mkdir(this.config.reportDir, { recursive: true });
  }
  
  async _runBaselineBenchmarks() {
    const baselineProcessor = new StandaloneKGenBridge();
    const baselineCache = new ContentAddressedCache();
    
    const results = {};
    
    // RDF processing benchmarks
    for (const testCase of this.testCases) {
      const filePath = path.join(this.config.testDataDir, testCase.file);
      
      if (await this._fileExists(filePath)) {
        const time = await this._benchmarkRDFOperation(
          () => baselineProcessor.graphIndex(filePath),
          `baseline_${testCase.name}`
        );
        results[testCase.name] = time;
      }
    }
    
    return results;
  }
  
  async _runOptimizedBenchmarks() {
    const optimizedProcessor = new ParallelRDFProcessor();
    const optimizedCache = new ProductionContentCache();
    
    const results = {};
    
    // RDF processing benchmarks
    for (const testCase of this.testCases) {
      const filePath = path.join(this.config.testDataDir, testCase.file);
      
      if (await this._fileExists(filePath)) {
        const time = await this._benchmarkRDFOperation(
          () => optimizedProcessor.graphIndexParallel(filePath),
          `optimized_${testCase.name}`
        );
        results[testCase.name] = time;
      }
    }
    
    await optimizedProcessor.shutdown();
    
    return results;
  }
  
  async _benchmarkRDFOperation(operation, name) {
    const times = [];
    
    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      try {
        await operation();
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Actual benchmark runs
    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = performance.now();
      
      try {
        await operation();
        const endTime = performance.now();
        times.push(endTime - startTime);
      } catch (error) {
        this.logger.warn(`Benchmark iteration ${i + 1} failed for ${name}:`, error.message);
        times.push(Infinity); // Mark as failed
      }
    }
    
    // Calculate statistics (excluding failed runs)
    const validTimes = times.filter(t => t !== Infinity);
    if (validTimes.length === 0) {
      return Infinity;
    }
    
    validTimes.sort((a, b) => a - b);
    const average = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
    const median = validTimes[Math.floor(validTimes.length / 2)];
    const p95 = validTimes[Math.floor(validTimes.length * 0.95)];
    
    this.results[name] = {
      times: validTimes,
      average,
      median,
      p95,
      min: validTimes[0],
      max: validTimes[validTimes.length - 1],
      successRate: (validTimes.length / this.config.iterations * 100).toFixed(2) + '%'
    };
    
    return average;
  }
  
  async _benchmarkCache(cache, testData, name) {
    const startTime = performance.now();
    
    // Store operations
    for (const data of testData) {
      await cache.store(data.content, data.metadata);
    }
    
    // Retrieve operations (simulating cache hits)
    for (const data of testData) {
      await cache.retrieve(data.key || data.content);
    }
    
    const endTime = performance.now();
    return endTime - startTime;
  }
  
  async _generateCacheTestData() {
    const testData = [];
    
    // Generate varied test content
    for (let i = 0; i < 100; i++) {
      testData.push({
        content: `test-content-${i}-${Math.random().toString(36)}`,
        metadata: { 
          size: Math.random() * 1000,
          type: 'test-data',
          index: i
        }
      });
    }
    
    return testData;
  }
  
  async _warmupRDFProcessing(baseline, optimized, filePath) {
    try {
      await baseline.graphIndex(filePath);
      await optimized.graphIndexParallel(filePath);
    } catch (error) {
      // Ignore warmup errors
    }
  }
  
  _compareResults(baseline, optimized) {
    const comparison = {};
    
    for (const testName of Object.keys(baseline)) {
      if (optimized[testName]) {
        const improvement = ((baseline[testName] - optimized[testName]) / baseline[testName] * 100);
        const speedup = baseline[testName] / optimized[testName];
        
        comparison[testName] = {
          baseline: baseline[testName].toFixed(2) + 'ms',
          optimized: optimized[testName].toFixed(2) + 'ms', 
          improvement: improvement.toFixed(2) + '%',
          speedup: speedup.toFixed(2) + 'x',
          targetMet: speedup >= 2.0 // 2x improvement target
        };
      }
    }
    
    return comparison;
  }
  
  async _generatePerformanceReport(comparison) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.config.reportDir, `performance-report-${timestamp}.json`);
    
    // Calculate overall metrics
    const improvements = Object.values(comparison)
      .map(c => parseFloat(c.improvement.replace('%', '')))
      .filter(i => !isNaN(i));
      
    const speedups = Object.values(comparison)
      .map(c => parseFloat(c.speedup.replace('x', '')))
      .filter(s => !isNaN(s));
    
    const avgImprovement = improvements.length > 0 
      ? improvements.reduce((sum, i) => sum + i, 0) / improvements.length
      : 0;
      
    const avgSpeedup = speedups.length > 0
      ? speedups.reduce((sum, s) => sum + s, 0) / speedups.length  
      : 0;
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        iterations: this.config.iterations,
        warmupRuns: this.config.warmupRuns,
        testCases: this.testCases.length
      },
      summary: {
        averageImprovement: avgImprovement.toFixed(2) + '%',
        averageSpeedup: avgSpeedup.toFixed(2) + 'x',
        targetMet: avgSpeedup >= 2.0,
        testsSuccessful: Object.values(comparison).filter(c => c.targetMet).length,
        testsTotal: Object.keys(comparison).length
      },
      detailedResults: comparison,
      rawData: this.results
    };
    
    // Write report to file
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    this.logger.success(`Performance report generated: ${reportPath}`);
    return report;
  }
  
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default PerformanceBenchmark;