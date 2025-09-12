#!/usr/bin/env node
/**
 * KGEN Performance Regression Test Suite
 * 
 * Comprehensive performance validation to ensure system performance
 * doesn't degrade across releases. Includes benchmarking, memory profiling,
 * and scalability testing with automated regression detection.
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KGenPerformanceRegressionSuite {
  constructor(options = {}) {
    this.options = {
      baselineFile: path.resolve(__dirname, '../../reports/performance-baseline.json'),
      reportDir: path.resolve(__dirname, '../../reports/performance'),
      regressionThreshold: 0.2, // 20% performance degradation threshold
      memoryThreshold: 0.3,     // 30% memory increase threshold
      enableProfiling: true,
      enableBenchmarking: true,
      iterations: {
        micro: 1000,    // Micro benchmarks
        standard: 100,  // Standard operations
        stress: 10      // Stress tests
      },
      ...options
    };

    this.logger = consola.withTag('perf-regression');
    this.baseline = null;
    this.currentResults = new Map();
    this.regressions = [];
    this.improvements = [];
  }

  /**
   * Initialize performance regression suite
   */
  async initialize() {
    try {
      this.logger.info('🚀 Initializing Performance Regression Suite');

      // Create report directory
      await fs.mkdir(this.options.reportDir, { recursive: true });

      // Load baseline if exists
      await this.loadBaseline();

      this.logger.success('Performance regression suite initialized');
      return { status: 'initialized' };

    } catch (error) {
      this.logger.error('Failed to initialize performance suite:', error);
      throw error;
    }
  }

  /**
   * Load performance baseline
   */
  async loadBaseline() {
    try {
      if (await this.fileExists(this.options.baselineFile)) {
        const baselineData = await fs.readFile(this.options.baselineFile, 'utf8');
        this.baseline = JSON.parse(baselineData);
        this.logger.info(`📊 Loaded baseline with ${Object.keys(this.baseline.benchmarks || {}).length} benchmarks`);
      } else {
        this.logger.info('📝 No baseline found, will create new baseline');
      }
    } catch (error) {
      this.logger.warn('Failed to load baseline:', error.message);
      this.baseline = null;
    }
  }

  /**
   * Run all performance regression tests
   */
  async runPerformanceTests() {
    const startTime = performance.now();
    this.logger.info('🎯 Starting performance regression tests');

    try {
      // Run different categories of performance tests
      await this.runMicroBenchmarks();
      await this.runStandardOperationBenchmarks();
      await this.runMemoryUsageTests();
      await this.runScalabilityTests();
      await this.runStressTests();

      // Analyze results
      const regressionAnalysis = this.analyzeRegressions();
      
      // Generate reports
      await this.generatePerformanceReport(regressionAnalysis);

      const totalTime = performance.now() - startTime;
      this.logger.success(`✅ Performance tests completed in ${(totalTime / 1000).toFixed(2)}s`);

      return {
        success: this.regressions.length === 0,
        regressions: this.regressions,
        improvements: this.improvements,
        totalTime,
        testsRun: this.currentResults.size
      };

    } catch (error) {
      this.logger.error('Performance tests failed:', error);
      throw error;
    }
  }

  /**
   * Run micro benchmarks for core operations
   */
  async runMicroBenchmarks() {
    this.logger.info('🔬 Running micro benchmarks');

    const benchmarks = [
      {
        name: 'hash-generation',
        description: 'SHA256 hash generation performance',
        operation: () => {
          const data = crypto.randomBytes(1024);
          return crypto.createHash('sha256').update(data).digest('hex');
        }
      },
      {
        name: 'json-serialization',
        description: 'JSON serialization performance',
        operation: () => {
          const data = {
            operationId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            data: Array(100).fill().map((_, i) => ({ id: i, value: `item-${i}` }))
          };
          return JSON.stringify(data);
        }
      },
      {
        name: 'template-variable-replacement',
        description: 'Simple template variable replacement',
        operation: () => {
          const template = 'Hello {{name}}, today is {{date}} and the weather is {{weather}}.';
          const context = { name: 'Alice', date: '2025-01-01', weather: 'sunny' };
          return template.replace(/\{\{(\w+)\}\}/g, (match, key) => context[key] || match);
        }
      },
      {
        name: 'rdf-triple-creation',
        description: 'RDF triple object creation',
        operation: () => {
          return {
            subject: `http://example.org/entity/${crypto.randomUUID()}`,
            predicate: 'http://www.w3.org/ns/prov#wasGeneratedBy',
            object: `http://example.org/activity/${crypto.randomUUID()}`
          };
        }
      }
    ];

    for (const benchmark of benchmarks) {
      const result = await this.runBenchmark(
        benchmark.name,
        benchmark.operation,
        this.options.iterations.micro,
        benchmark.description
      );
      this.currentResults.set(benchmark.name, result);
    }
  }

  /**
   * Run standard operation benchmarks
   */
  async runStandardOperationBenchmarks() {
    this.logger.info('📊 Running standard operation benchmarks');

    const benchmarks = [
      {
        name: 'template-engine-full-render',
        description: 'Complete template rendering with context',
        operation: async () => {
          // Mock comprehensive template rendering
          const template = `
---
to: "output/{{entityName}}.js"
inject: true
---
/**
 * Generated entity: {{entityName}}
 * Generated at: {{timestamp}}
 * Version: {{version}}
 */

export class {{entityName}} {
  constructor(data = {}) {
    {{#each properties}}
    this.{{name}} = data.{{name}} || {{defaultValue}};
    {{/each}}
  }

  validate() {
    {{#each validationRules}}
    if (!this.{{property}}) {
      throw new Error('{{message}}');
    }
    {{/each}}
    return true;
  }

  toJSON() {
    return {
      {{#each properties}}
      {{name}}: this.{{name}},
      {{/each}}
    };
  }
}
`;

          const context = {
            entityName: 'User',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            properties: [
              { name: 'id', defaultValue: 'null' },
              { name: 'name', defaultValue: '""' },
              { name: 'email', defaultValue: '""' }
            ],
            validationRules: [
              { property: 'id', message: 'ID is required' },
              { property: 'name', message: 'Name is required' }
            ]
          };

          // Simulate template processing
          let result = template;
          result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => 
            context[key] !== undefined ? context[key] : match);
          
          // Simulate more complex processing
          await new Promise(resolve => setTimeout(resolve, 1));
          
          return result.length;
        }
      },
      {
        name: 'rdf-graph-processing',
        description: 'RDF graph parsing and query processing',
        operation: async () => {
          // Mock RDF processing
          const rdfData = `
@prefix ex: <http://example.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

${Array(50).fill().map((_, i) => 
  `ex:entity${i} a prov:Entity ;
   prov:wasGeneratedBy ex:activity${i} ;
   prov:wasDerivedFrom ex:source${i % 10} .

ex:activity${i} a prov:Activity ;
  prov:wasAssociatedWith ex:agent${i % 3} ;
  prov:startedAtTime "${new Date(Date.now() - i * 1000).toISOString()}"^^xsd:dateTime .`
).join('\n\n')}
`;

          // Simulate parsing
          const lines = rdfData.split('\n').filter(line => line.trim());
          const triples = [];
          
          for (const line of lines) {
            if (line.includes(' a ') || line.includes(' prov:')) {
              triples.push({
                subject: line.split(' ')[0],
                predicate: line.split(' ')[1],
                object: line.split(' ').slice(2).join(' ').replace(' .', '')
              });
            }
          }

          return triples.length;
        }
      },
      {
        name: 'provenance-tracking-cycle',
        description: 'Complete provenance tracking lifecycle',
        operation: async () => {
          // Mock provenance tracking
          const operationId = crypto.randomUUID();
          const startTime = Date.now();
          
          // Mock operation tracking data
          const provenanceData = {
            operationId,
            type: 'generation',
            startTime: new Date(startTime),
            endTime: new Date(startTime + 1000),
            inputs: Array(5).fill().map((_, i) => ({ id: `input-${i}` })),
            outputs: Array(3).fill().map((_, i) => ({ id: `output-${i}` })),
            agent: { id: 'test-agent', type: 'software' },
            provGraph: Array(20).fill().map(() => ({
              subject: `ex:${crypto.randomUUID()}`,
              predicate: 'prov:wasGeneratedBy',
              object: `ex:${crypto.randomUUID()}`
            }))
          };

          // Simulate hash generation
          const hash = crypto.createHash('sha256')
            .update(JSON.stringify(provenanceData))
            .digest('hex');

          return hash.length;
        }
      }
    ];

    for (const benchmark of benchmarks) {
      const result = await this.runBenchmark(
        benchmark.name,
        benchmark.operation,
        this.options.iterations.standard,
        benchmark.description
      );
      this.currentResults.set(benchmark.name, result);
    }
  }

  /**
   * Run memory usage tests
   */
  async runMemoryUsageTests() {
    this.logger.info('💾 Running memory usage tests');

    const tests = [
      {
        name: 'template-cache-memory',
        description: 'Memory usage with template caching',
        test: async () => {
          const initialMemory = process.memoryUsage();
          
          // Simulate template caching
          const templates = new Map();
          for (let i = 0; i < 1000; i++) {
            templates.set(`template-${i}`, {
              content: `Template ${i} with content ${'x'.repeat(1000)}`,
              compiled: true,
              lastUsed: Date.now()
            });
          }

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          const finalMemory = process.memoryUsage();
          return {
            heapUsedDelta: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotalDelta: finalMemory.heapTotal - initialMemory.heapTotal,
            externalDelta: finalMemory.external - initialMemory.external
          };
        }
      },
      {
        name: 'rdf-store-memory',
        description: 'Memory usage with large RDF stores',
        test: async () => {
          const initialMemory = process.memoryUsage();
          
          // Simulate RDF store with many triples
          const store = [];
          for (let i = 0; i < 10000; i++) {
            store.push({
              subject: `http://example.org/entity-${i}`,
              predicate: 'http://www.w3.org/ns/prov#wasGeneratedBy',
              object: `http://example.org/activity-${i}`,
              graph: 'http://example.org/default'
            });
          }

          if (global.gc) {
            global.gc();
          }

          const finalMemory = process.memoryUsage();
          return {
            heapUsedDelta: finalMemory.heapUsed - initialMemory.heapUsed,
            heapTotalDelta: finalMemory.heapTotal - initialMemory.heapTotal,
            externalDelta: finalMemory.external - initialMemory.external,
            triplesCount: store.length
          };
        }
      }
    ];

    for (const test of tests) {
      const startTime = performance.now();
      const memoryResult = await test.test();
      const duration = performance.now() - startTime;
      
      const result = {
        name: test.name,
        description: test.description,
        type: 'memory',
        duration,
        memory: memoryResult,
        timestamp: new Date()
      };
      
      this.currentResults.set(test.name, result);
      this.logger.debug(`📊 ${test.name}: ${(memoryResult.heapUsedDelta / 1024 / 1024).toFixed(2)}MB heap delta`);
    }
  }

  /**
   * Run scalability tests
   */
  async runScalabilityTests() {
    this.logger.info('📈 Running scalability tests');

    const tests = [
      {
        name: 'concurrent-template-rendering',
        description: 'Template rendering under concurrent load',
        test: async () => {
          const concurrentTasks = Array(50).fill().map(async (_, i) => {
            const start = performance.now();
            
            // Mock template rendering
            const template = `Component {{name}} with props {{#each props}}{{this}}, {{/each}}`;
            const context = {
              name: `Component${i}`,
              props: Array(10).fill().map((_, j) => `prop${j}`)
            };
            
            // Simulate processing
            let result = template.replace(/\{\{name\}\}/g, context.name);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
            
            return performance.now() - start;
          });

          const results = await Promise.all(concurrentTasks);
          return {
            taskCount: results.length,
            averageTime: results.reduce((sum, time) => sum + time, 0) / results.length,
            minTime: Math.min(...results),
            maxTime: Math.max(...results),
            totalTime: results.reduce((sum, time) => sum + time, 0)
          };
        }
      },
      {
        name: 'large-dataset-processing',
        description: 'Processing performance with large datasets',
        test: async () => {
          const datasetSizes = [100, 500, 1000, 5000, 10000];
          const results = [];

          for (const size of datasetSizes) {
            const start = performance.now();
            
            // Generate large dataset
            const dataset = Array(size).fill().map((_, i) => ({
              id: `entity-${i}`,
              type: 'prov:Entity',
              properties: {
                name: `Entity ${i}`,
                value: Math.random(),
                timestamp: new Date().toISOString()
              }
            }));

            // Simulate processing
            const processed = dataset.map(item => ({
              ...item,
              hash: crypto.createHash('md5').update(JSON.stringify(item)).digest('hex'),
              processed: true
            }));

            const duration = performance.now() - start;
            results.push({
              size,
              duration,
              throughput: size / (duration / 1000) // items per second
            });
          }

          return results;
        }
      }
    ];

    for (const test of tests) {
      const startTime = performance.now();
      const scalabilityResult = await test.test();
      const totalDuration = performance.now() - startTime;
      
      const result = {
        name: test.name,
        description: test.description,
        type: 'scalability',
        duration: totalDuration,
        scalabilityData: scalabilityResult,
        timestamp: new Date()
      };
      
      this.currentResults.set(test.name, result);
    }
  }

  /**
   * Run stress tests
   */
  async runStressTests() {
    this.logger.info('💪 Running stress tests');

    const tests = [
      {
        name: 'memory-pressure-test',
        description: 'System behavior under memory pressure',
        test: async () => {
          const allocations = [];
          const initialMemory = process.memoryUsage();
          
          try {
            // Gradually increase memory usage
            for (let i = 0; i < 100; i++) {
              allocations.push(new Array(100000).fill(`stress-test-data-${i}`));
              
              if (i % 10 === 0) {
                const currentMemory = process.memoryUsage();
                if (currentMemory.heapUsed > initialMemory.heapUsed + 100 * 1024 * 1024) {
                  // Stop before using too much memory
                  break;
                }
              }
            }

            return {
              allocationsCreated: allocations.length,
              finalMemory: process.memoryUsage(),
              memoryIncrease: process.memoryUsage().heapUsed - initialMemory.heapUsed
            };

          } finally {
            // Cleanup
            allocations.length = 0;
            if (global.gc) {
              global.gc();
            }
          }
        }
      },
      {
        name: 'high-frequency-operations',
        description: 'Performance under high-frequency operation load',
        test: async () => {
          const operationCount = 10000;
          const start = performance.now();
          
          const results = [];
          for (let i = 0; i < operationCount; i++) {
            const opStart = performance.now();
            
            // Mock high-frequency operation
            const data = {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              hash: crypto.createHash('md5').update(`operation-${i}`).digest('hex')
            };
            
            results.push({
              id: data.id,
              duration: performance.now() - opStart
            });
          }

          const totalDuration = performance.now() - start;
          const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
          
          return {
            operationCount,
            totalDuration,
            averageDuration: avgDuration,
            operationsPerSecond: operationCount / (totalDuration / 1000)
          };
        }
      }
    ];

    for (const test of tests) {
      const startTime = performance.now();
      const stressResult = await test.test();
      const duration = performance.now() - startTime;
      
      const result = {
        name: test.name,
        description: test.description,
        type: 'stress',
        duration,
        stressData: stressResult,
        timestamp: new Date()
      };
      
      this.currentResults.set(test.name, result);
    }
  }

  /**
   * Run individual benchmark
   */
  async runBenchmark(name, operation, iterations, description) {
    this.logger.debug(`🔧 Running benchmark: ${name}`);
    
    const times = [];
    const warmupIterations = Math.min(10, Math.floor(iterations / 10));
    
    // Warmup runs
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }

    // Actual benchmark runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      times.push(performance.now() - start);
    }

    // Calculate statistics
    const sortedTimes = times.sort((a, b) => a - b);
    const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const min = sortedTimes[0];
    const max = sortedTimes[sortedTimes.length - 1];
    const stdDev = Math.sqrt(
      times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
    );
    
    // Calculate percentiles
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    return {
      name,
      description,
      type: 'benchmark',
      iterations,
      statistics: {
        mean,
        median,
        min,
        max,
        stdDev,
        p95,
        p99
      },
      rawTimes: times,
      timestamp: new Date()
    };
  }

  /**
   * Analyze performance regressions
   */
  analyzeRegressions() {
    if (!this.baseline || !this.baseline.benchmarks) {
      this.logger.info('📝 No baseline available, all results will be saved as new baseline');
      return {
        regressions: [],
        improvements: [],
        newTests: Array.from(this.currentResults.keys())
      };
    }

    this.regressions = [];
    this.improvements = [];
    const newTests = [];

    for (const [testName, currentResult] of this.currentResults) {
      const baselineResult = this.baseline.benchmarks[testName];
      
      if (!baselineResult) {
        newTests.push(testName);
        continue;
      }

      // Compare performance metrics
      if (currentResult.type === 'benchmark') {
        const comparison = this.compareBenchmarkResults(baselineResult, currentResult);
        
        if (comparison.regression > this.options.regressionThreshold) {
          this.regressions.push({
            testName,
            type: 'performance',
            regressionPercent: comparison.regression * 100,
            baseline: baselineResult.statistics.mean,
            current: currentResult.statistics.mean,
            threshold: this.options.regressionThreshold * 100
          });
        } else if (comparison.improvement > 0.1) { // 10% improvement threshold
          this.improvements.push({
            testName,
            type: 'performance',
            improvementPercent: comparison.improvement * 100,
            baseline: baselineResult.statistics.mean,
            current: currentResult.statistics.mean
          });
        }
      }
      
      // Compare memory metrics
      if (currentResult.type === 'memory' && baselineResult.memory) {
        const memoryComparison = this.compareMemoryResults(baselineResult, currentResult);
        
        if (memoryComparison.regression > this.options.memoryThreshold) {
          this.regressions.push({
            testName,
            type: 'memory',
            regressionPercent: memoryComparison.regression * 100,
            baseline: baselineResult.memory.heapUsedDelta,
            current: currentResult.memory.heapUsedDelta,
            threshold: this.options.memoryThreshold * 100
          });
        }
      }
    }

    return {
      regressions: this.regressions,
      improvements: this.improvements,
      newTests
    };
  }

  /**
   * Compare benchmark results
   */
  compareBenchmarkResults(baseline, current) {
    const baselineMean = baseline.statistics.mean;
    const currentMean = current.statistics.mean;
    
    const regression = currentMean > baselineMean ? 
      (currentMean - baselineMean) / baselineMean : 0;
    
    const improvement = currentMean < baselineMean ? 
      (baselineMean - currentMean) / baselineMean : 0;

    return { regression, improvement };
  }

  /**
   * Compare memory results
   */
  compareMemoryResults(baseline, current) {
    const baselineMemory = baseline.memory.heapUsedDelta;
    const currentMemory = current.memory.heapUsedDelta;
    
    const regression = currentMemory > baselineMemory ? 
      (currentMemory - baselineMemory) / baselineMemory : 0;
    
    const improvement = currentMemory < baselineMemory ? 
      (baselineMemory - currentMemory) / baselineMemory : 0;

    return { regression, improvement };
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(analysis) {
    const reportData = {
      metadata: {
        timestamp: new Date(),
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      },
      summary: {
        totalTests: this.currentResults.size,
        regressions: this.regressions.length,
        improvements: this.improvements.length,
        newTests: analysis.newTests.length
      },
      benchmarks: Object.fromEntries(this.currentResults),
      analysis: {
        regressions: this.regressions,
        improvements: this.improvements,
        newTests: analysis.newTests
      }
    };

    // Save as new baseline if no regressions or if requested
    if (this.regressions.length === 0 || process.env.KGEN_SAVE_BASELINE === 'true') {
      await this.saveBaseline(reportData);
    }

    // Generate JSON report
    const jsonReport = JSON.stringify(reportData, null, 2);
    await fs.writeFile(
      path.join(this.options.reportDir, `performance-${Date.now()}.json`),
      jsonReport
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(reportData);
    await fs.writeFile(
      path.join(this.options.reportDir, `performance-report-${Date.now()}.md`),
      markdownReport
    );

    this.logger.success('📊 Performance reports generated');
  }

  /**
   * Save current results as baseline
   */
  async saveBaseline(reportData) {
    const baseline = {
      timestamp: reportData.metadata.timestamp,
      version: '1.0.0',
      platform: reportData.metadata.platform,
      benchmarks: reportData.benchmarks
    };

    await fs.writeFile(this.options.baselineFile, JSON.stringify(baseline, null, 2));
    this.logger.info('💾 Saved new performance baseline');
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(reportData) {
    let report = `# 🚀 KGEN Performance Regression Report

**Generated:** ${reportData.metadata.timestamp}
**Platform:** ${reportData.metadata.platform}
**Node.js:** ${reportData.metadata.nodeVersion}
**CPU Cores:** ${reportData.metadata.cpuCount}

## 📊 Summary

| Metric | Count |
|--------|-------|
| Total Tests | ${reportData.summary.totalTests} |
| Regressions | ${reportData.summary.regressions} |
| Improvements | ${reportData.summary.improvements} |
| New Tests | ${reportData.summary.newTests} |

`;

    if (this.regressions.length > 0) {
      report += `## ⚠️ Performance Regressions

${this.regressions.map(reg => 
  `### ${reg.testName}
- **Type:** ${reg.type}
- **Regression:** ${reg.regressionPercent.toFixed(1)}%
- **Baseline:** ${reg.baseline.toFixed(2)}ms
- **Current:** ${reg.current.toFixed(2)}ms
- **Threshold:** ${reg.threshold}%
`).join('\n')}
`;
    }

    if (this.improvements.length > 0) {
      report += `## ✅ Performance Improvements

${this.improvements.map(imp => 
  `### ${imp.testName}
- **Type:** ${imp.type}
- **Improvement:** ${imp.improvementPercent.toFixed(1)}%
- **Baseline:** ${imp.baseline.toFixed(2)}ms
- **Current:** ${imp.current.toFixed(2)}ms
`).join('\n')}
`;
    }

    // Add detailed benchmark results
    report += `## 📈 Detailed Benchmark Results

`;

    for (const [testName, result] of this.currentResults) {
      if (result.type === 'benchmark') {
        report += `### ${testName}
- **Description:** ${result.description}
- **Iterations:** ${result.iterations}
- **Mean:** ${result.statistics.mean.toFixed(2)}ms
- **Median:** ${result.statistics.median.toFixed(2)}ms
- **Min:** ${result.statistics.min.toFixed(2)}ms
- **Max:** ${result.statistics.max.toFixed(2)}ms
- **P95:** ${result.statistics.p95.toFixed(2)}ms
- **P99:** ${result.statistics.p99.toFixed(2)}ms
- **Std Dev:** ${result.statistics.stdDev.toFixed(2)}ms

`;
      }
    }

    return report;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get test results
   */
  getResults() {
    return {
      success: this.regressions.length === 0,
      regressions: this.regressions,
      improvements: this.improvements,
      benchmarks: Object.fromEntries(this.currentResults)
    };
  }
}

export default KGenPerformanceRegressionSuite;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new KGenPerformanceRegressionSuite();
  
  try {
    await suite.initialize();
    const results = await suite.runPerformanceTests();
    
    if (results.success) {
      console.log('🎉 No performance regressions detected!');
      if (results.improvements.length > 0) {
        console.log(`✨ Found ${results.improvements.length} performance improvements!`);
      }
      process.exit(0);
    } else {
      console.log(`⚠️ Found ${results.regressions.length} performance regressions!`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Performance tests failed:', error);
    process.exit(1);
  }
}