/**
 * KGEN Performance Benchmark Suite
 * Agent DELTA-12: Performance Optimizer
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import consola from 'consola';
import { ProvenanceTracker } from '../src/kgen/provenance/tracker.js';
import { BlockchainAnchor } from '../src/kgen/provenance/blockchain/anchor.js';
import { ComplianceLogger } from '../src/kgen/provenance/compliance/logger.js';

const logger = consola.withTag('perf-benchmark');

class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.config = {
      iterations: 100,
      warmupIterations: 10,
      memoryTrackingInterval: 100, // ms
      bigDatasetSize: 10000,
      smallDatasetSize: 100
    };
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark() {
    logger.info('Starting KGEN Performance Benchmark Suite');
    
    // System baseline
    const baseline = await this.measureSystemBaseline();
    logger.info('System Baseline:', baseline);

    // Memory usage tracking
    this.startMemoryTracking();

    // Core benchmarks
    const benchmarks = [
      this.benchmarkCliStartup,
      this.benchmarkProvenanceTracker,
      this.benchmarkBlockchainAnchor,
      this.benchmarkHashGeneration,
      this.benchmarkRDFGraphProcessing,
      this.benchmarkTemplateRendering,
      this.benchmarkLargeDatasetProcessing,
      this.benchmarkMemoryEfficiency,
      this.benchmarkConcurrentOperations
    ];

    for (const benchmark of benchmarks) {
      await this.runSingleBenchmark(benchmark.name, benchmark.bind(this));
    }

    this.stopMemoryTracking();

    // Generate performance report
    const report = this.generatePerformanceReport();
    await this.saveReport(report);
    
    return report;
  }

  /**
   * Measure system baseline performance
   */
  async measureSystemBaseline() {
    const start = performance.now();
    
    // CPU intensive operation
    let cpuWork = 0;
    for (let i = 0; i < 1000000; i++) {
      cpuWork += Math.random();
    }

    const cpuTime = performance.now() - start;

    // Memory allocation test
    const memStart = process.memoryUsage();
    const largeArray = new Array(1000000).fill(0).map(() => Math.random());
    const memEnd = process.memoryUsage();
    
    // Clean up
    largeArray.length = 0;
    
    // I/O test
    const ioStart = performance.now();
    const testData = 'performance test data';
    await fs.writeFile('/tmp/perf-test.tmp', testData);
    await fs.readFile('/tmp/perf-test.tmp');
    await fs.unlink('/tmp/perf-test.tmp');
    const ioTime = performance.now() - ioStart;

    return {
      cpuTimeMs: cpuTime,
      memoryAllocatedMB: (memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024,
      ioTimeMs: ioTime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Benchmark CLI startup time
   */
  async benchmarkCliStartup() {
    // Actual measurements
    const measurements = [];
    for (let i = 0; i < Math.min(10, this.config.iterations); i++) {
      const start = performance.now();
      
      // Simulate CLI module loading
      const { ProvenanceTracker } = await import('../src/kgen/provenance/tracker.js');
      const tracker = new ProvenanceTracker({
        enableBlockchainIntegrity: false,
        enableDigitalSignatures: false,
        storageBackend: 'memory'
      });
      await tracker.initialize();
      await tracker.shutdown();
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: 'CLI Startup Time',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark provenance tracker performance
   */
  async benchmarkProvenanceTracker() {
    const tracker = new ProvenanceTracker({
      enableBlockchainIntegrity: false,
      enableDigitalSignatures: false,
      storageBackend: 'memory'
    });
    
    await tracker.initialize();

    const measurements = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      
      // Simulate operation tracking
      const context = await tracker.startOperation({
        type: 'test-operation',
        user: { id: 'test-user', username: 'test' },
        inputs: [{ id: 'input-1', name: 'test-input' }]
      });
      
      await tracker.completeOperation(context.operationId, {
        status: 'success',
        outputs: [{ id: 'output-1', name: 'test-output' }],
        metrics: { executionTime: 100 }
      });
      
      measurements.push(performance.now() - start);
    }

    await tracker.shutdown();

    return {
      metric: 'Provenance Operation Tracking',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark blockchain anchor performance
   */
  async benchmarkBlockchainAnchor() {
    const anchor = new BlockchainAnchor({
      enableDigitalSignatures: false,
      batchSize: 10
    });
    
    await anchor.initialize();

    const measurements = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      
      // Queue record for anchoring
      const recordId = `record-${i}`;
      const hash = crypto.createHash('sha256').update(recordId).digest('hex');
      
      await anchor.queueForAnchoring(recordId, hash, { test: true });
      
      measurements.push(performance.now() - start);
    }

    await anchor.shutdown();

    return {
      metric: 'Blockchain Anchoring',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark hash generation performance
   */
  async benchmarkHashGeneration() {
    const measurements = [];
    const testData = 'test data for hash generation benchmark';
    
    for (let i = 0; i < this.config.iterations * 10; i++) {
      const start = performance.now();
      
      // Test different hash algorithms
      const sha256 = crypto.createHash('sha256').update(testData).digest('hex');
      const sha512 = crypto.createHash('sha512').update(testData).digest('hex');
      const md5 = crypto.createHash('md5').update(testData).digest('hex');
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: 'Hash Generation (SHA256+SHA512+MD5)',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark RDF graph processing
   */
  async benchmarkRDFGraphProcessing() {
    const { Store, Parser, Writer } = await import('n3');
    
    const measurements = [];
    
    // Generate test RDF data
    const testTriples = [];
    for (let i = 0; i < 1000; i++) {
      testTriples.push(`<http://example.org/entity${i}> <http://example.org/predicate> "value${i}" .`);
    }
    const rdfData = testTriples.join('\n');

    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      
      // Parse RDF data
      const store = new Store();
      const parser = new Parser();
      const quads = parser.parse(rdfData);
      store.addQuads(quads);
      
      // Query data
      const results = store.getQuads(null, null, null);
      
      // Write data
      const writer = new Writer();
      const output = writer.quadsToString(results);
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: 'RDF Graph Processing (1000 triples)',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark template rendering performance
   */
  async benchmarkTemplateRendering() {
    const nunjucks = await import('nunjucks');
    
    const measurements = [];
    const template = `
Hello {{ name }}!
{% for item in items %}
  - {{ item.name }}: {{ item.value }}
{% endfor %}
Total: {{ items.length }} items
    `.trim();

    const data = {
      name: 'Performance Test',
      items: Array.from({ length: 100 }, (_, i) => ({
        name: `Item ${i}`,
        value: Math.random() * 1000
      }))
    };

    // Create a Nunjucks environment
    const env = new nunjucks.Environment();

    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      
      const rendered = env.renderString(template, data);
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: 'Template Rendering (100 items)',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark large dataset processing
   */
  async benchmarkLargeDatasetProcessing() {
    const measurements = [];
    
    // Generate large dataset
    const largeDataset = Array.from({ length: this.config.bigDatasetSize }, (_, i) => ({
      id: `entity-${i}`,
      name: `Entity ${i}`,
      value: Math.random() * 1000,
      data: `data-${i}`.repeat(100) // Simulate larger records
    }));

    for (let i = 0; i < Math.min(10, this.config.iterations); i++) {
      const start = performance.now();
      
      // Process dataset - simulate common operations
      const filtered = largeDataset.filter(item => item.value > 500);
      const mapped = filtered.map(item => ({
        ...item,
        processed: true,
        hash: crypto.createHash('md5').update(item.data).digest('hex')
      }));
      const sorted = mapped.sort((a, b) => b.value - a.value);
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: `Large Dataset Processing (${this.config.bigDatasetSize} records)`,
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Benchmark memory efficiency
   */
  async benchmarkMemoryEfficiency() {
    const measurements = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const memStart = process.memoryUsage();
      
      // Memory intensive operations
      const data = [];
      for (let j = 0; j < 10000; j++) {
        data.push({
          id: j,
          data: new Array(100).fill(Math.random()),
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Process data
      const processed = data.map(item => ({
        ...item,
        processed: true,
        sum: item.data.reduce((a, b) => a + b, 0)
      }));
      
      const memEnd = process.memoryUsage();
      const memoryUsed = (memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024; // MB
      
      measurements.push(memoryUsed);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    return {
      metric: 'Memory Efficiency',
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'MB'
    };
  }

  /**
   * Benchmark concurrent operations
   */
  async benchmarkConcurrentOperations() {
    const measurements = [];
    const concurrency = 10;
    
    for (let i = 0; i < Math.min(20, this.config.iterations); i++) {
      const start = performance.now();
      
      // Create concurrent operations
      const promises = [];
      for (let j = 0; j < concurrency; j++) {
        promises.push(this.simulateAsyncOperation(j));
      }
      
      await Promise.all(promises);
      
      measurements.push(performance.now() - start);
    }

    return {
      metric: `Concurrent Operations (${concurrency} parallel)`,
      measurements,
      stats: this.calculateStats(measurements),
      unit: 'ms'
    };
  }

  /**
   * Simulate async operation
   */
  async simulateAsyncOperation(id) {
    // Simulate I/O and CPU work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    
    // CPU work
    let result = 0;
    for (let i = 0; i < 10000; i++) {
      result += Math.random() * i;
    }
    
    return { id, result };
  }

  /**
   * Run single benchmark with error handling
   */
  async runSingleBenchmark(name, benchmarkFn) {
    try {
      logger.info(`Running benchmark: ${name}`);
      const start = performance.now();
      
      const result = await benchmarkFn();
      const totalTime = performance.now() - start;
      
      result.benchmarkName = name;
      result.totalBenchmarkTime = totalTime;
      result.timestamp = this.getDeterministicDate().toISOString();
      
      this.results.push(result);
      
      logger.success(`Completed ${name}: ${result.stats.mean.toFixed(2)}${result.unit} (avg)`);
      
    } catch (error) {
      logger.error(`Benchmark ${name} failed:`, error);
      this.results.push({
        benchmarkName: name,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      });
    }
  }

  /**
   * Calculate statistics for measurements
   */
  calculateStats(measurements) {
    if (measurements.length === 0) return {};
    
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(measurements.reduce((acc, val) => acc + Math.pow(val - (sum / measurements.length), 2), 0) / measurements.length),
      count: measurements.length
    };
  }

  /**
   * Start memory usage tracking
   */
  startMemoryTracking() {
    this.memorySnapshots = [];
    this.memoryTrackingInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.memorySnapshots.push({
        timestamp: this.getDeterministicTimestamp(),
        heapUsed: usage.heapUsed / 1024 / 1024, // MB
        heapTotal: usage.heapTotal / 1024 / 1024, // MB
        external: usage.external / 1024 / 1024, // MB
        rss: usage.rss / 1024 / 1024 // MB
      });
    }, this.config.memoryTrackingInterval);
  }

  /**
   * Stop memory usage tracking
   */
  stopMemoryTracking() {
    if (this.memoryTrackingInterval) {
      clearInterval(this.memoryTrackingInterval);
      this.memoryTrackingInterval = null;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport() {
    const report = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024),
        freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
        cpuCount: require('os').cpus().length
      },
      configuration: this.config,
      results: this.results,
      memoryProfile: this.analyzeMemoryUsage(),
      recommendations: this.generateRecommendations(),
      bottlenecks: this.identifyBottlenecks()
    };

    return report;
  }

  /**
   * Analyze memory usage patterns
   */
  analyzeMemoryUsage() {
    if (!this.memorySnapshots || this.memorySnapshots.length === 0) {
      return null;
    }

    const heapUsages = this.memorySnapshots.map(s => s.heapUsed);
    const peakMemory = Math.max(...heapUsages);
    const avgMemory = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length;
    
    return {
      peakHeapUsage: peakMemory,
      averageHeapUsage: avgMemory,
      memoryGrowth: heapUsages[heapUsages.length - 1] - heapUsages[0],
      snapshots: this.memorySnapshots.length,
      analysis: {
        memoryEfficient: peakMemory < 100, // Less than 100MB
        steadyState: Math.abs(heapUsages[heapUsages.length - 1] - avgMemory) < 10,
        growthRate: (heapUsages[heapUsages.length - 1] - heapUsages[0]) / this.memorySnapshots.length
      }
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze CLI startup time
    const cliResult = this.results.find(r => r.benchmarkName === 'benchmarkCliStartup');
    if (cliResult && cliResult.stats.mean > 100) {
      recommendations.push({
        category: 'Startup Performance',
        issue: 'CLI startup time is slow',
        impact: 'High',
        recommendation: 'Implement lazy loading for heavy dependencies',
        currentValue: `${cliResult.stats.mean.toFixed(2)}ms`,
        targetValue: '<50ms'
      });
    }

    // Analyze memory efficiency
    const memoryResult = this.results.find(r => r.benchmarkName === 'benchmarkMemoryEfficiency');
    if (memoryResult && memoryResult.stats.mean > 50) {
      recommendations.push({
        category: 'Memory Usage',
        issue: 'High memory consumption',
        impact: 'Medium',
        recommendation: 'Implement object pooling and streaming for large datasets',
        currentValue: `${memoryResult.stats.mean.toFixed(2)}MB`,
        targetValue: '<20MB'
      });
    }

    // Analyze RDF processing
    const rdfResult = this.results.find(r => r.benchmarkName === 'benchmarkRDFGraphProcessing');
    if (rdfResult && rdfResult.stats.mean > 50) {
      recommendations.push({
        category: 'RDF Processing',
        issue: 'RDF graph processing is slow',
        impact: 'High',
        recommendation: 'Implement incremental parsing and indexing',
        currentValue: `${rdfResult.stats.mean.toFixed(2)}ms`,
        targetValue: '<20ms'
      });
    }

    // Analyze template rendering
    const templateResult = this.results.find(r => r.benchmarkName === 'benchmarkTemplateRendering');
    if (templateResult && templateResult.stats.mean > 20) {
      recommendations.push({
        category: 'Template Rendering',
        issue: 'Template rendering could be optimized',
        impact: 'Medium',
        recommendation: 'Enable template caching and pre-compilation',
        currentValue: `${templateResult.stats.mean.toFixed(2)}ms`,
        targetValue: '<10ms'
      });
    }

    return recommendations;
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks() {
    const bottlenecks = [];
    
    this.results.forEach(result => {
      if (result.error) {
        bottlenecks.push({
          type: 'Error',
          benchmark: result.benchmarkName,
          description: `Benchmark failed: ${result.error}`,
          severity: 'Critical'
        });
        return;
      }

      if (!result.stats) return;

      // Identify slow operations
      if (result.stats.p95 > result.stats.mean * 2) {
        bottlenecks.push({
          type: 'Performance Variance',
          benchmark: result.benchmarkName,
          description: `High variance in execution times (P95: ${result.stats.p95.toFixed(2)}${result.unit}, Mean: ${result.stats.mean.toFixed(2)}${result.unit})`,
          severity: 'Medium'
        });
      }

      // Identify memory issues
      if (result.benchmarkName.includes('Memory') && result.stats.mean > 100) {
        bottlenecks.push({
          type: 'Memory Usage',
          benchmark: result.benchmarkName,
          description: `High memory usage: ${result.stats.mean.toFixed(2)}${result.unit}`,
          severity: 'High'
        });
      }

      // Identify extremely slow operations
      if (result.stats.mean > 1000 && result.unit === 'ms') {
        bottlenecks.push({
          type: 'Slow Operation',
          benchmark: result.benchmarkName,
          description: `Very slow operation: ${result.stats.mean.toFixed(2)}${result.unit}`,
          severity: 'High'
        });
      }
    });

    return bottlenecks;
  }

  /**
   * Save performance report
   */
  async saveReport(report) {
    const reportPath = `/Users/sac/unjucks/tests/performance-report-${this.getDeterministicTimestamp()}.json`;
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      logger.success(`Performance report saved to: ${reportPath}`);
      
      // Also save a summary
      const summaryPath = reportPath.replace('.json', '-summary.txt');
      const summary = this.generateTextSummary(report);
      await fs.writeFile(summaryPath, summary);
      
      return { reportPath, summaryPath };
    } catch (error) {
      logger.error('Failed to save performance report:', error);
      throw error;
    }
  }

  /**
   * Generate text summary of performance report
   */
  generateTextSummary(report) {
    let summary = `KGEN Performance Benchmark Report
Generated: ${report.metadata.timestamp}
Platform: ${report.metadata.platform} ${report.metadata.arch}
Node.js: ${report.metadata.nodeVersion}

BENCHMARK RESULTS:
==================
`;

    report.results.forEach(result => {
      if (result.error) {
        summary += `❌ ${result.benchmarkName}: FAILED (${result.error})\n`;
      } else {
        summary += `✅ ${result.benchmarkName}:
   Mean: ${result.stats.mean.toFixed(2)}${result.unit}
   Median: ${result.stats.median.toFixed(2)}${result.unit}
   P95: ${result.stats.p95.toFixed(2)}${result.unit}
   Min/Max: ${result.stats.min.toFixed(2)}/${result.stats.max.toFixed(2)}${result.unit}
`;
      }
    });

    summary += `\nBOTTLENECKS IDENTIFIED:
=======================
`;

    if (report.bottlenecks.length === 0) {
      summary += "No significant bottlenecks detected.\n";
    } else {
      report.bottlenecks.forEach(bottleneck => {
        summary += `🔍 [${bottleneck.severity}] ${bottleneck.type}: ${bottleneck.description}\n`;
      });
    }

    summary += `\nRECOMMENDATE OPTIMIZATIONS:
===========================
`;

    if (report.recommendations.length === 0) {
      summary += "No optimization recommendations at this time.\n";
    } else {
      report.recommendations.forEach((rec, index) => {
        summary += `${index + 1}. ${rec.category}: ${rec.recommendation}
   Current: ${rec.currentValue} → Target: ${rec.targetValue}
   Impact: ${rec.impact}
`;
      });
    }

    if (report.memoryProfile) {
      summary += `\nMEMORY ANALYSIS:
================
Peak Heap Usage: ${report.memoryProfile.peakHeapUsage.toFixed(2)}MB
Average Heap Usage: ${report.memoryProfile.averageHeapUsage.toFixed(2)}MB
Memory Growth: ${report.memoryProfile.memoryGrowth.toFixed(2)}MB
Memory Efficient: ${report.memoryProfile.analysis.memoryEfficient ? 'Yes' : 'No'}
Steady State: ${report.memoryProfile.analysis.steadyState ? 'Yes' : 'No'}
`;
    }

    return summary;
  }
}

// Export for use in other modules
export { PerformanceBenchmark };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  
  try {
    const report = await benchmark.runBenchmark();
    console.log('\nBenchmark completed successfully!');
    console.log(`Results saved to performance reports in tests/ directory`);
    
    // Print summary
    console.log('\nQUICK SUMMARY:');
    report.results.forEach(result => {
      if (!result.error && result.stats) {
        console.log(`${result.benchmarkName}: ${result.stats.mean.toFixed(2)}${result.unit} (avg)`);
      }
    });
    
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}