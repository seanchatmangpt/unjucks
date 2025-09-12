/**
 * KGEN Performance Test Suite - Validates Charter Performance Requirements
 * 
 * Tests:
 * - p95 render ≤150ms on dev laptops
 * - Cold start ≤2s including git operations
 * - ≥80% cache hit rate
 * - Performance telemetry integration
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { consola } from 'consola';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class KGenPerformanceTestSuite {
  constructor(options = {}) {
    this.config = {
      // Charter targets
      targetP95RenderMs: options.targetP95RenderMs || 150,
      targetColdStartMs: options.targetColdStartMs || 2000,
      targetCacheHitRate: options.targetCacheHitRate || 0.8,
      
      // Test configuration
      renderTestIterations: options.renderTestIterations || 100,
      coldStartTestIterations: options.coldStartTestIterations || 10,
      cacheTestIterations: options.cacheTestIterations || 50,
      
      // System info
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      platform: os.platform(),
      nodeVersion: process.version,
      
      debug: options.debug === true
    };
    
    this.logger = consola.withTag('kgen-perf-test');
    
    // Test results
    this.results = {
      system: {
        cpu: `${os.cpus()[0]?.model || 'Unknown'} (${this.config.cpuCount} cores)`,
        memory: `${Math.round(this.config.totalMemory / 1024 / 1024 / 1024)}GB`,
        platform: this.config.platform,
        nodeVersion: this.config.nodeVersion,
        timestamp: this.getDeterministicDate().toISOString()
      },
      coldStart: {},
      rendering: {},
      caching: {},
      overall: {}
    };
    
    // Test data
    this.testData = {
      templates: [],
      graphs: [],
      contexts: []
    };
  }
  
  /**
   * Run complete performance test suite
   */
  async runFullSuite() {
    this.logger.info('🚀 Starting KGEN Performance Test Suite');
    this.logger.info(`Target: p95 ≤${this.config.targetP95RenderMs}ms, Cold start ≤${this.config.targetColdStartMs}ms, Cache ≥${this.config.targetCacheHitRate * 100}%`);
    
    const suiteStartTime = performance.now();
    
    try {
      // Setup test data
      await this._setupTestData();
      
      // Run individual test suites
      await this._testColdStartPerformance();
      await this._testRenderingPerformance();
      await this._testCachingPerformance();
      await this._testMemoryUsage();
      await this._testConcurrentPerformance();
      
      // Calculate overall results
      this._calculateOverallResults();
      
      const suiteTime = performance.now() - suiteStartTime;
      this.results.overall.totalTestTime = suiteTime;
      
      // Generate performance report
      const report = this._generatePerformanceReport();
      
      this.logger.success(`Performance test suite completed in ${suiteTime.toFixed(2)}ms`);
      
      return {
        success: true,
        results: this.results,
        report,
        meetingTargets: this._checkTargetCompliance()
      };
      
    } catch (error) {
      this.logger.error(`Performance test suite failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: this.results
      };
    }
  }
  
  /**
   * Setup test data for performance tests
   */
  async _setupTestData() {
    this.logger.info('📊 Setting up test data...');
    
    // Create test templates
    const templateDir = path.join(__dirname, '../../tests/performance/templates');
    await fs.mkdir(templateDir, { recursive: true });
    
    // Simple template
    const simpleTemplate = `
# {{title}}

Generated at: {{timestamp}}
Items: {{items.length}}

{{#each items}}
- {{name}}: {{value}}
{{/each}}
`;
    
    // Complex template with RDF data
    const complexTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{metadata.title}}</title>
    <meta name="generator" content="KGEN v{{version}}">
</head>
<body>
    <h1>{{title}}</h1>
    
    {{#if graph}}
    <section class="rdf-data">
        <h2>RDF Graph Data</h2>
        <p>Triples: {{graph.triples}}</p>
        <p>Subjects: {{graph.subjects}}</p>
        <p>Generated: {{buildTime}}</p>
    </section>
    {{/if}}
    
    <section class="items">
        {{#each items}}
        <div class="item" data-id="{{id}}">
            <h3>{{name}}</h3>
            <p>{{description}}</p>
            {{#if properties}}
            <ul>
            {{#each properties}}
            <li>{{key}}: {{value}}</li>
            {{/each}}
            </ul>
            {{/if}}
        </div>
        {{/each}}
    </section>
    
    <footer>
        <p>Performance test generated at {{timestamp}}</p>
    </footer>
</body>
</html>
`;
    
    // RDF test graph
    const testGraph = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:TestEntity rdf:type ex:Entity ;
    rdfs:label "Test Entity" ;
    ex:property1 "Value 1" ;
    ex:property2 42 ;
    ex:relatedTo ex:OtherEntity .

ex:OtherEntity rdf:type ex:Entity ;
    rdfs:label "Other Entity" ;
    ex:property3 "Value 3" .
`;
    
    // Write test files
    await fs.writeFile(path.join(templateDir, 'simple.njk'), simpleTemplate);
    await fs.writeFile(path.join(templateDir, 'complex.njk'), complexTemplate);
    await fs.writeFile(path.join(templateDir, 'test-graph.ttl'), testGraph);
    
    // Create test contexts
    this.testData.contexts = [
      // Small context
      {
        title: 'Simple Test',
        timestamp: '2024-01-01T00:00:00Z',
        items: Array.from({ length: 5 }, (_, i) => ({
          name: `Item ${i + 1}`,
          value: `Value ${i + 1}`
        }))
      },
      // Medium context
      {
        title: 'Medium Test',
        timestamp: '2024-01-01T00:00:00Z',
        items: Array.from({ length: 50 }, (_, i) => ({
          name: `Item ${i + 1}`,
          value: `Value ${i + 1}`,
          id: `item-${i + 1}`
        }))
      },
      // Large context
      {
        title: 'Large Test',
        version: '1.0.0',
        buildTime: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: {
          title: 'Performance Test Document',
          description: 'Generated for KGEN performance testing'
        },
        graph: {
          triples: 100,
          subjects: 25,
          predicates: 15
        },
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item-${i + 1}`,
          name: `Complex Item ${i + 1}`,
          description: `This is a detailed description for item ${i + 1} with multiple properties and nested data.`,
          properties: Array.from({ length: 5 }, (_, j) => ({
            key: `prop${j + 1}`,
            value: `Property ${j + 1} value for item ${i + 1}`
          }))
        }))
      }
    ];
    
    this.testData.templates = [
      { path: path.join(templateDir, 'simple.njk'), type: 'simple' },
      { path: path.join(templateDir, 'complex.njk'), type: 'complex' }
    ];
    
    this.testData.graphs = [
      { path: path.join(templateDir, 'test-graph.ttl'), type: 'small' }
    ];
    
    this.logger.success('Test data setup complete');
  }
  
  /**
   * Test cold start performance
   */
  async _testColdStartPerformance() {
    this.logger.info('🚀 Testing cold start performance...');
    
    const kgenBinary = path.join(__dirname, '../../../bin/kgen.mjs');
    const coldStartTimes = [];
    
    for (let i = 0; i < this.config.coldStartTestIterations; i++) {
      // Clear Node.js module cache to simulate cold start
      Object.keys(require.cache).forEach(key => {
        if (key.includes('kgen') || key.includes('src/')) {
          delete require.cache[key];
        }
      });
      
      const startTime = performance.now();
      
      try {
        // Test basic help command for cold start
        execSync(`node "${kgenBinary}" --help`, { 
          stdio: 'pipe',
          timeout: this.config.targetColdStartMs + 1000
        });
        
        const coldStartTime = performance.now() - startTime;
        coldStartTimes.push(coldStartTime);
        
        if (this.config.debug) {
          this.logger.debug(`Cold start ${i + 1}: ${coldStartTime.toFixed(2)}ms`);
        }
        
      } catch (error) {
        this.logger.warn(`Cold start test ${i + 1} failed: ${error.message}`);
        coldStartTimes.push(this.config.targetColdStartMs + 500); // Penalty
      }
    }
    
    // Calculate statistics
    const sortedTimes = coldStartTimes.sort((a, b) => a - b);
    const p50 = this._calculatePercentile(sortedTimes, 50);
    const p95 = this._calculatePercentile(sortedTimes, 95);
    const mean = coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length;
    const min = Math.min(...coldStartTimes);
    const max = Math.max(...coldStartTimes);
    
    this.results.coldStart = {
      iterations: this.config.coldStartTestIterations,
      times: coldStartTimes,
      statistics: {
        min,
        max,
        mean,
        p50,
        p95
      },
      target: this.config.targetColdStartMs,
      meetingTarget: p95 <= this.config.targetColdStartMs,
      improvement: this.config.targetColdStartMs - p95
    };
    
    this.logger.info(`Cold start p95: ${p95.toFixed(2)}ms (target: ${this.config.targetColdStartMs}ms) - ${this.results.coldStart.meetingTarget ? '✅' : '❌'}`);
  }
  
  /**
   * Test rendering performance
   */
  async _testRenderingPerformance() {
    this.logger.info('⚡ Testing rendering performance...');
    
    // Import KGEN components for testing
    const { KGenPerformanceOptimizer } = await import('./kgen-performance-optimizer.js');
    const optimizer = new KGenPerformanceOptimizer({ debug: this.config.debug });
    
    const renderTimes = [];
    const cacheHits = [];
    
    // Test with various template/context combinations
    for (let i = 0; i < this.config.renderTestIterations; i++) {
      const templateIndex = i % this.testData.templates.length;
      const contextIndex = i % this.testData.contexts.length;
      
      const template = this.testData.templates[templateIndex];
      const context = this.testData.contexts[contextIndex];
      
      const startTime = performance.now();
      
      try {
        const result = await optimizer.optimizedRender(template.path, context, {
          useCache: true
        });
        
        const renderTime = performance.now() - startTime;
        renderTimes.push(renderTime);
        cacheHits.push(result.cached);
        
        if (this.config.debug && i % 10 === 0) {
          this.logger.debug(`Render ${i + 1}: ${renderTime.toFixed(2)}ms ${result.cached ? '(cached)' : '(fresh)'}`);
        }
        
      } catch (error) {
        this.logger.warn(`Render test ${i + 1} failed: ${error.message}`);
        renderTimes.push(this.config.targetP95RenderMs + 100); // Penalty
        cacheHits.push(false);
      }
    }
    
    // Calculate statistics
    const sortedTimes = renderTimes.sort((a, b) => a - b);
    const p50 = this._calculatePercentile(sortedTimes, 50);
    const p95 = this._calculatePercentile(sortedTimes, 95);
    const mean = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const min = Math.min(...renderTimes);
    const max = Math.max(...renderTimes);
    
    // Cache hit rate
    const cacheHitCount = cacheHits.filter(hit => hit).length;
    const cacheHitRate = cacheHitCount / cacheHits.length;
    
    this.results.rendering = {
      iterations: this.config.renderTestIterations,
      times: renderTimes.slice(0, 20), // Store sample for reporting
      statistics: {
        min,
        max,
        mean,
        p50,
        p95
      },
      target: this.config.targetP95RenderMs,
      meetingTarget: p95 <= this.config.targetP95RenderMs,
      improvement: this.config.targetP95RenderMs - p95,
      cacheHitRate,
      cacheHitTarget: this.config.targetCacheHitRate,
      meetingCacheTarget: cacheHitRate >= this.config.targetCacheHitRate
    };
    
    await optimizer.shutdown();
    
    this.logger.info(`Render p95: ${p95.toFixed(2)}ms (target: ${this.config.targetP95RenderMs}ms) - ${this.results.rendering.meetingTarget ? '✅' : '❌'}`);
    this.logger.info(`Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (target: ${this.config.targetCacheHitRate * 100}%) - ${this.results.rendering.meetingCacheTarget ? '✅' : '❌'}`);
  }
  
  /**
   * Test caching performance specifically
   */
  async _testCachingPerformance() {
    this.logger.info('💾 Testing caching performance...');
    
    // Import caching components
    const { KGenPerformanceOptimizer } = await import('./kgen-performance-optimizer.js');
    const optimizer = new KGenPerformanceOptimizer({ 
      debug: this.config.debug,
      enableCaching: true
    });
    
    const template = this.testData.templates[0];
    const context = this.testData.contexts[0];
    
    // First render to populate cache
    await optimizer.optimizedRender(template.path, context, { useCache: true });
    
    // Test cache hit performance
    const cacheHitTimes = [];
    for (let i = 0; i < this.config.cacheTestIterations; i++) {
      const startTime = performance.now();
      
      const result = await optimizer.optimizedRender(template.path, context, { useCache: true });
      
      const renderTime = performance.now() - startTime;
      if (result.cached) {
        cacheHitTimes.push(renderTime);
      }
    }
    
    // Test cache miss performance (different contexts)
    const cacheMissTimes = [];
    for (let i = 0; i < 10; i++) {
      const uniqueContext = { ...context, uniqueId: `test-${i}` };
      
      const startTime = performance.now();
      
      await optimizer.optimizedRender(template.path, uniqueContext, { useCache: true });
      
      const renderTime = performance.now() - startTime;
      cacheMissTimes.push(renderTime);
    }
    
    const cacheHitMean = cacheHitTimes.length > 0 
      ? cacheHitTimes.reduce((a, b) => a + b, 0) / cacheHitTimes.length 
      : 0;
    const cacheMissMean = cacheMissTimes.reduce((a, b) => a + b, 0) / cacheMissTimes.length;
    
    const speedup = cacheMissMean > 0 ? cacheMissMean / cacheHitMean : 0;
    
    this.results.caching = {
      cacheHitTimes: cacheHitTimes.slice(0, 10),
      cacheMissTimes: cacheMissTimes.slice(0, 10),
      cacheHitMean,
      cacheMissMean,
      speedup,
      efficiency: cacheHitTimes.length / this.config.cacheTestIterations
    };
    
    await optimizer.shutdown();
    
    this.logger.info(`Cache speedup: ${speedup.toFixed(2)}x (hit: ${cacheHitMean.toFixed(2)}ms, miss: ${cacheMissMean.toFixed(2)}ms)`);
  }
  
  /**
   * Test memory usage patterns
   */
  async _testMemoryUsage() {
    this.logger.info('🧠 Testing memory usage...');
    
    const initialMemory = process.memoryUsage();
    
    // Import performance optimizer
    const { KGenPerformanceOptimizer } = await import('./kgen-performance-optimizer.js');
    const optimizer = new KGenPerformanceOptimizer({ 
      debug: this.config.debug,
      enableMemoryPooling: true
    });
    
    const memorySnapshots = [initialMemory];
    
    // Perform multiple renders and track memory
    for (let i = 0; i < 20; i++) {
      const template = this.testData.templates[i % this.testData.templates.length];
      const context = this.testData.contexts[i % this.testData.contexts.length];
      
      await optimizer.optimizedRender(template.path, context);
      
      if (i % 5 === 0) {
        memorySnapshots.push(process.memoryUsage());
      }
    }
    
    const finalMemory = process.memoryUsage();
    
    const memoryGrowth = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    this.results.memory = {
      initial: initialMemory,
      final: finalMemory,
      growth: memoryGrowth,
      snapshots: memorySnapshots,
      growthMB: {
        heapUsed: memoryGrowth.heapUsed / 1024 / 1024,
        heapTotal: memoryGrowth.heapTotal / 1024 / 1024,
        rss: memoryGrowth.rss / 1024 / 1024
      }
    };
    
    await optimizer.shutdown();
    
    this.logger.info(`Memory growth: ${this.results.memory.growthMB.heapUsed.toFixed(2)}MB heap, ${this.results.memory.growthMB.rss.toFixed(2)}MB RSS`);
  }
  
  /**
   * Test concurrent performance
   */
  async _testConcurrentPerformance() {
    this.logger.info('⚡ Testing concurrent performance...');
    
    const { KGenPerformanceOptimizer } = await import('./kgen-performance-optimizer.js');
    const optimizer = new KGenPerformanceOptimizer({ 
      debug: this.config.debug,
      maxConcurrentTasks: this.config.cpuCount
    });
    
    const concurrentTasks = 10;
    const template = this.testData.templates[1]; // Complex template
    const context = this.testData.contexts[2]; // Large context
    
    const startTime = performance.now();
    
    // Run concurrent renders
    const promises = Array.from({ length: concurrentTasks }, (_, i) => {
      return optimizer.optimizedRender(template.path, {
        ...context,
        taskId: i
      });
    });
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    const successfulResults = results.filter(r => r.success);
    const averageRenderTime = successfulResults.reduce((sum, r) => sum + r.renderTime, 0) / successfulResults.length;
    
    this.results.concurrent = {
      tasks: concurrentTasks,
      totalTime,
      successful: successfulResults.length,
      failed: results.length - successfulResults.length,
      averageRenderTime,
      throughput: successfulResults.length / (totalTime / 1000), // renders per second
      efficiency: successfulResults.length / concurrentTasks
    };
    
    await optimizer.shutdown();
    
    this.logger.info(`Concurrent: ${concurrentTasks} tasks in ${totalTime.toFixed(2)}ms (${this.results.concurrent.throughput.toFixed(2)} renders/sec)`);
  }
  
  /**
   * Calculate percentile from sorted array
   */
  _calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
  
  /**
   * Calculate overall test results
   */
  _calculateOverallResults() {
    const coldStartPassing = this.results.coldStart.meetingTarget;
    const renderingPassing = this.results.rendering.meetingTarget;
    const cachingPassing = this.results.rendering.meetingCacheTarget;
    
    const totalTests = 3;
    const passingTests = [coldStartPassing, renderingPassing, cachingPassing].filter(Boolean).length;
    
    this.results.overall = {
      ...this.results.overall,
      totalTests,
      passingTests,
      failingTests: totalTests - passingTests,
      overallPass: passingTests === totalTests,
      score: (passingTests / totalTests) * 100,
      compliance: {
        coldStart: coldStartPassing,
        rendering: renderingPassing,
        caching: cachingPassing
      }
    };
  }
  
  /**
   * Check compliance with Charter targets
   */
  _checkTargetCompliance() {
    return {
      coldStart: {
        target: this.config.targetColdStartMs,
        actual: this.results.coldStart.statistics?.p95,
        passing: this.results.coldStart.meetingTarget,
        margin: this.results.coldStart.improvement
      },
      rendering: {
        target: this.config.targetP95RenderMs,
        actual: this.results.rendering.statistics?.p95,
        passing: this.results.rendering.meetingTarget,
        margin: this.results.rendering.improvement
      },
      caching: {
        target: this.config.targetCacheHitRate * 100,
        actual: (this.results.rendering.cacheHitRate || 0) * 100,
        passing: this.results.rendering.meetingCacheTarget,
        margin: ((this.results.rendering.cacheHitRate || 0) - this.config.targetCacheHitRate) * 100
      }
    };
  }
  
  /**
   * Generate comprehensive performance report
   */
  _generatePerformanceReport() {
    const compliance = this._checkTargetCompliance();
    
    const report = {
      summary: {
        timestamp: this.results.system.timestamp,
        platform: `${this.results.system.platform} (${this.results.system.cpu})`,
        memory: this.results.system.memory,
        nodeVersion: this.results.system.nodeVersion,
        overallScore: this.results.overall.score,
        passing: this.results.overall.overallPass
      },
      performance: {
        coldStart: {
          p95: this.results.coldStart.statistics?.p95,
          target: this.config.targetColdStartMs,
          status: compliance.coldStart.passing ? 'PASS' : 'FAIL',
          margin: compliance.coldStart.margin
        },
        rendering: {
          p95: this.results.rendering.statistics?.p95,
          target: this.config.targetP95RenderMs,
          status: compliance.rendering.passing ? 'PASS' : 'FAIL',
          margin: compliance.rendering.margin
        },
        caching: {
          hitRate: (this.results.rendering.cacheHitRate || 0) * 100,
          target: this.config.targetCacheHitRate * 100,
          status: compliance.caching.passing ? 'PASS' : 'FAIL',
          margin: compliance.caching.margin
        }
      },
      recommendations: this._generateRecommendations()
    };
    
    return report;
  }
  
  /**
   * Generate performance optimization recommendations
   */
  _generateRecommendations() {
    const recommendations = [];
    
    // Cold start recommendations
    if (!this.results.coldStart.meetingTarget) {
      recommendations.push({
        type: 'cold-start',
        priority: 'high',
        issue: `Cold start p95 ${this.results.coldStart.statistics.p95.toFixed(2)}ms exceeds target ${this.config.targetColdStartMs}ms`,
        recommendation: 'Implement lazy loading for heavy modules (N3.js, Nunjucks)',
        expectedImprovement: '30-50% startup time reduction'
      });
    }
    
    // Rendering recommendations
    if (!this.results.rendering.meetingTarget) {
      recommendations.push({
        type: 'rendering',
        priority: 'high',
        issue: `Render p95 ${this.results.rendering.statistics.p95.toFixed(2)}ms exceeds target ${this.config.targetP95RenderMs}ms`,
        recommendation: 'Enable template compilation caching and worker thread processing',
        expectedImprovement: '40-60% render time reduction'
      });
    }
    
    // Caching recommendations
    if (!this.results.rendering.meetingCacheTarget) {
      const currentRate = (this.results.rendering.cacheHitRate || 0) * 100;
      recommendations.push({
        type: 'caching',
        priority: 'medium',
        issue: `Cache hit rate ${currentRate.toFixed(1)}% below target ${this.config.targetCacheHitRate * 100}%`,
        recommendation: 'Optimize cache key generation and increase cache size limits',
        expectedImprovement: '15-25% cache hit rate improvement'
      });
    }
    
    // Memory recommendations
    if (this.results.memory?.growthMB?.heapUsed > 50) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        issue: `High memory growth: ${this.results.memory.growthMB.heapUsed.toFixed(2)}MB`,
        recommendation: 'Implement memory pooling and periodic garbage collection',
        expectedImprovement: '30-40% memory usage reduction'
      });
    }
    
    return recommendations;
  }
}

export default KGenPerformanceTestSuite;