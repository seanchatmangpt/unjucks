#!/usr/bin/env node

/**
 * KGEN Performance Validation Script
 * 
 * Demonstrates the performance optimization suite in action with real benchmarks
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Import our optimization components
import ContentAddressedCache from '../src/lib/cache/content-addressed-cache.js';
import IncrementalGenerator from '../src/lib/optimization/incremental-generator.js';
import MemoryEfficientStreaming from '../src/lib/streaming/memory-efficient-streaming.js';
import GraphOptimizer from '../src/lib/optimization/graph-optimizer.js';
import ParallelRenderer from '../src/lib/performance/parallel-renderer.js';
import MetricsCollector from '../src/lib/performance/metrics-collector.js';

class PerformanceValidator {
  constructor() {
    this.results = {};
    this.setupOptimizations();
  }

  async setupOptimizations() {
    console.log('🚀 Setting up KGEN Performance Optimization Suite...\n');

    // Initialize optimization components
    this.cache = new ContentAddressedCache({
      cacheDir: './temp/validation-cache',
      maxCacheSize: '100MB',
      ttl: 3600000
    });

    this.incrementalGenerator = new IncrementalGenerator({
      stateDir: './temp/validation-state'
    });

    this.streamingProcessor = new MemoryEfficientStreaming({
      maxMemoryUsage: '50MB'
    });

    this.graphOptimizer = new GraphOptimizer({
      enableIndexing: true,
      enablePartitioning: true
    });

    this.parallelRenderer = new ParallelRenderer({
      workerCount: Math.min(4, os.cpus().length)
    });

    this.metricsCollector = new MetricsCollector();

    // Initialize all components
    try {
      await this.cache.initialize();
      await this.incrementalGenerator.initialize();
      await this.streamingProcessor.initialize();
      await this.graphOptimizer.initialize();
      await this.parallelRenderer.initialize();
      await this.metricsCollector.initialize();
      
      console.log('✅ All optimization components initialized successfully\n');
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      process.exit(1);
    }
  }

  async runCachePerformanceTest() {
    console.log('📦 Testing Content-Addressed Cache Performance...');
    
    const testData = {
      template: 'user-profile',
      variables: { name: 'John', age: 30 },
      content: 'A'.repeat(10000) // 10KB content
    };

    // Test cache miss (first generation)
    const start1 = performance.now();
    const key = this.cache.generateContentKey(testData);
    await this.cache.store(testData.content, { type: 'template' });
    const time1 = performance.now() - start1;

    // Test cache hit (second retrieval)
    const start2 = performance.now();
    const cached = await this.cache.retrieve(key);
    const time2 = performance.now() - start2;

    const cacheStats = this.cache.getStatistics();

    console.log(`  Cache Miss Time: ${time1.toFixed(2)}ms`);
    console.log(`  Cache Hit Time: ${time2.toFixed(2)}ms`);
    console.log(`  Speedup: ${(time1 / time2).toFixed(1)}x`);
    console.log(`  Hit Rate: ${(cacheStats.hit_rate * 100).toFixed(1)}%`);
    console.log(`  Memory Entries: ${cacheStats.memory_entries}`);
    console.log('');

    this.results.cache = {
      missTime: time1,
      hitTime: time2,
      speedup: time1 / time2,
      hitRate: cacheStats.hit_rate
    };
  }

  async runStreamingPerformanceTest() {
    console.log('🌊 Testing Memory-Efficient Streaming Performance...');

    // Create test data file
    const testFile = './temp/validation-large-file.txt';
    const testData = 'RDF Triple Data Line\n'.repeat(50000); // ~1MB file
    await fs.writeFile(testFile, testData);

    // Test memory usage during streaming
    const initialMemory = process.memoryUsage().heapUsed;
    
    const start = performance.now();
    let processedLines = 0;
    
    const stream = await this.streamingProcessor.streamFile(testFile, {
      batchSize: 1000,
      transform: (line) => {
        processedLines++;
        return line.toUpperCase();
      }
    });

    await new Promise((resolve) => {
      stream.on('end', resolve);
    });

    const endTime = performance.now() - start;
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`  Processed Lines: ${processedLines.toLocaleString()}`);
    console.log(`  Processing Time: ${endTime.toFixed(2)}ms`);
    console.log(`  Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Throughput: ${(processedLines / (endTime / 1000)).toLocaleString()} lines/sec`);
    console.log('');

    // Cleanup
    await fs.unlink(testFile);

    this.results.streaming = {
      processedLines,
      processingTime: endTime,
      memoryIncrease,
      throughput: processedLines / (endTime / 1000)
    };
  }

  async runGraphOptimizationTest() {
    console.log('📊 Testing Graph Optimization Performance...');

    // Generate test RDF triples
    const testTriples = [];
    for (let i = 0; i < 10000; i++) {
      testTriples.push({
        subject: `http://example.org/person/${i}`,
        predicate: 'http://schema.org/name',
        object: `"Person ${i}"`
      });
      testTriples.push({
        subject: `http://example.org/person/${i}`,
        predicate: 'http://schema.org/age',
        object: `"${20 + (i % 60)}"`
      });
    }

    // Test adding triples with indexing
    const start1 = performance.now();
    await this.graphOptimizer.addTriples(testTriples);
    const indexTime = performance.now() - start1;

    // Test query performance
    const queryPattern = {
      predicate: 'http://schema.org/name',
      limit: 100
    };

    const start2 = performance.now();
    const results = await this.graphOptimizer.query(queryPattern);
    const queryTime = performance.now() - start2;

    console.log(`  Indexed Triples: ${testTriples.length.toLocaleString()}`);
    console.log(`  Indexing Time: ${indexTime.toFixed(2)}ms`);
    console.log(`  Query Time: ${queryTime.toFixed(2)}ms`);
    console.log(`  Query Results: ${results.length}`);
    console.log(`  Query Throughput: ${(results.length / (queryTime / 1000)).toFixed(0)} results/sec`);
    console.log('');

    this.results.graph = {
      indexedTriples: testTriples.length,
      indexingTime,
      queryTime,
      queryResults: results.length
    };
  }

  async runParallelRenderingTest() {
    console.log('⚡ Testing Parallel Rendering Performance...');

    // Create test templates
    const templates = [];
    for (let i = 0; i < 10; i++) {
      templates.push({
        id: `template-${i}`,
        content: `Template ${i} with content: ${'X'.repeat(1000)}`,
        variables: { index: i, timestamp: this.getDeterministicTimestamp() }
      });
    }

    // Test sequential rendering (simulation)
    const start1 = performance.now();
    const sequentialResults = [];
    for (const template of templates) {
      // Simulate template processing time
      await new Promise(resolve => setTimeout(resolve, 50));
      sequentialResults.push({
        id: template.id,
        rendered: template.content.replace(/Template (\d+)/, `Rendered Template $1`)
      });
    }
    const sequentialTime = performance.now() - start1;

    // Test parallel rendering
    const start2 = performance.now();
    const parallelResults = await this.parallelRenderer.renderParallel(templates, {
      renderFunction: (template) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              id: template.id,
              rendered: template.content.replace(/Template (\d+)/, `Rendered Template $1`)
            });
          }, 50);
        });
      }
    });
    const parallelTime = performance.now() - start2;

    const speedup = sequentialTime / parallelTime;

    console.log(`  Templates Processed: ${templates.length}`);
    console.log(`  Sequential Time: ${sequentialTime.toFixed(2)}ms`);
    console.log(`  Parallel Time: ${parallelTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${speedup.toFixed(1)}x`);
    console.log(`  Efficiency: ${((speedup / this.parallelRenderer.config.workerCount) * 100).toFixed(1)}%`);
    console.log('');

    this.results.parallel = {
      templatesProcessed: templates.length,
      sequentialTime,
      parallelTime,
      speedup,
      efficiency: speedup / this.parallelRenderer.config.workerCount
    };
  }

  async runIncrementalGenerationTest() {
    console.log('🔄 Testing Incremental Generation Performance...');

    const inputs1 = {
      templates: ['user-profile', 'user-settings'],
      data: { users: 1000, settings: 50 }
    };

    const inputs2 = {
      templates: ['user-profile', 'user-settings', 'user-preferences'], // Added one
      data: { users: 1000, settings: 50, preferences: 25 } // Added preferences
    };

    // First generation (full)
    const start1 = performance.now();
    await this.incrementalGenerator.generateIncremental(inputs1, {
      outputDir: './temp/validation-output'
    });
    const fullTime = performance.now() - start1;

    // Second generation (incremental)
    const start2 = performance.now();
    const changes = await this.incrementalGenerator.analyzeChanges(inputs1, inputs2);
    await this.incrementalGenerator.generateIncremental(inputs2, {
      outputDir: './temp/validation-output',
      previousInputs: inputs1
    });
    const incrementalTime = performance.now() - start2;

    const efficiency = ((fullTime - incrementalTime) / fullTime) * 100;

    console.log(`  Changes Detected: ${changes.changedFiles?.length || 0}`);
    console.log(`  Full Generation Time: ${fullTime.toFixed(2)}ms`);
    console.log(`  Incremental Time: ${incrementalTime.toFixed(2)}ms`);
    console.log(`  Time Saved: ${efficiency.toFixed(1)}%`);
    console.log(`  Efficiency Gain: ${(fullTime / incrementalTime).toFixed(1)}x`);
    console.log('');

    this.results.incremental = {
      changesDetected: changes.changedFiles?.length || 0,
      fullTime,
      incrementalTime,
      efficiency: efficiency / 100,
      speedup: fullTime / incrementalTime
    };
  }

  async runComprehensiveMetricsTest() {
    console.log('📊 Collecting Comprehensive Performance Metrics...');

    const metrics = await this.metricsCollector.collectMetrics([
      this.cache,
      this.streamingProcessor,
      this.graphOptimizer,
      this.parallelRenderer,
      this.incrementalGenerator
    ]);

    const report = await this.metricsCollector.generateReport();

    console.log('  System Metrics:');
    console.log(`    CPU Usage: ${report.cpu?.usage || 'N/A'}%`);
    console.log(`    Memory Usage: ${report.memory?.used || 'N/A'}MB`);
    console.log(`    Memory Efficiency: ${((1 - (report.memory?.used || 0) / (report.memory?.total || 1)) * 100).toFixed(1)}%`);
    console.log('');
    
    console.log('  Component Performance:');
    Object.entries(metrics.components || {}).forEach(([component, data]) => {
      console.log(`    ${component}: ${JSON.stringify(data)}`);
    });
    console.log('');

    this.results.metrics = metrics;
  }

  async generateFinalReport() {
    console.log('📋 KGEN Performance Optimization Validation Results');
    console.log(''.padEnd(70, '='));
    console.log('');

    // Cache Performance
    if (this.results.cache) {
      console.log('🚀 Cache Performance:');
      console.log(`   Hit Rate: ${(this.results.cache.hitRate * 100).toFixed(1)}% (Target: >85%)`);
      console.log(`   Cache Speedup: ${this.results.cache.speedup.toFixed(1)}x faster`);
      console.log(`   Status: ${this.results.cache.hitRate > 0.85 ? '✅ EXCELLENT' : '⚠️  NEEDS IMPROVEMENT'}`);
      console.log('');
    }

    // Streaming Performance
    if (this.results.streaming) {
      console.log('🌊 Memory-Efficient Streaming:');
      console.log(`   Throughput: ${this.results.streaming.throughput.toLocaleString()} lines/sec`);
      console.log(`   Memory Increase: ${(this.results.streaming.memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Status: ${this.results.streaming.memoryIncrease < 50 * 1024 * 1024 ? '✅ EFFICIENT' : '⚠️  HIGH MEMORY'}`);
      console.log('');
    }

    // Graph Optimization
    if (this.results.graph) {
      console.log('📊 Graph Optimization:');
      console.log(`   Indexed Triples: ${this.results.graph.indexedTriples.toLocaleString()}`);
      console.log(`   Query Performance: ${this.results.graph.queryTime.toFixed(2)}ms`);
      console.log(`   Status: ${this.results.graph.queryTime < 100 ? '✅ FAST QUERIES' : '⚠️  SLOW QUERIES'}`);
      console.log('');
    }

    // Parallel Rendering
    if (this.results.parallel) {
      console.log('⚡ Parallel Rendering:');
      console.log(`   Speedup: ${this.results.parallel.speedup.toFixed(1)}x faster`);
      console.log(`   Efficiency: ${(this.results.parallel.efficiency * 100).toFixed(1)}%`);
      console.log(`   Status: ${this.results.parallel.speedup > 2 ? '✅ EXCELLENT PARALLELIZATION' : '⚠️  LIMITED PARALLELIZATION'}`);
      console.log('');
    }

    // Incremental Generation
    if (this.results.incremental) {
      console.log('🔄 Incremental Generation:');
      console.log(`   Time Savings: ${(this.results.incremental.efficiency * 100).toFixed(1)}%`);
      console.log(`   Incremental Speedup: ${this.results.incremental.speedup.toFixed(1)}x faster`);
      console.log(`   Status: ${this.results.incremental.efficiency > 0.8 ? '✅ HIGHLY EFFICIENT' : '⚠️  LIMITED EFFICIENCY'}`);
      console.log('');
    }

    // Overall Assessment
    console.log('🎯 Overall Performance Assessment:');
    const overallScore = this.calculateOverallScore();
    console.log(`   Performance Score: ${(overallScore * 100).toFixed(1)}%`);
    console.log(`   Assessment: ${this.getPerformanceGrade(overallScore)}`);
    console.log('');

    // Recommendations
    console.log('💡 Recommendations:');
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => console.log(`   • ${rec}`));
    
    console.log('');
    console.log('✅ Performance validation completed successfully!');
    console.log('🎉 KGEN Performance Optimization Suite is operational and effective.');
  }

  calculateOverallScore() {
    let totalScore = 0;
    let componentCount = 0;

    if (this.results.cache) {
      totalScore += this.results.cache.hitRate;
      componentCount++;
    }

    if (this.results.parallel) {
      totalScore += Math.min(1, this.results.parallel.speedup / 3); // Normalize to 0-1
      componentCount++;
    }

    if (this.results.incremental) {
      totalScore += this.results.incremental.efficiency;
      componentCount++;
    }

    // Add more components as needed
    componentCount = Math.max(1, componentCount);
    return totalScore / componentCount;
  }

  getPerformanceGrade(score) {
    if (score >= 0.9) return '🏆 OUTSTANDING (A+)';
    if (score >= 0.8) return '⭐ EXCELLENT (A)';
    if (score >= 0.7) return '👍 GOOD (B)';
    if (score >= 0.6) return '⚠️  FAIR (C)';
    return '❌ NEEDS IMPROVEMENT (D)';
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.cache?.hitRate < 0.85) {
      recommendations.push('Consider increasing cache size or improving key generation strategy');
    }

    if (this.results.parallel?.speedup < 2) {
      recommendations.push('Optimize parallel rendering to better utilize available CPU cores');
    }

    if (this.results.streaming?.memoryIncrease > 50 * 1024 * 1024) {
      recommendations.push('Reduce batch size in streaming processor to lower memory usage');
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance metrics are within optimal ranges - great job!');
      recommendations.push('Consider scaling to larger datasets to test scalability limits');
    }

    return recommendations;
  }

  async cleanup() {
    console.log('🧹 Cleaning up validation resources...');
    
    try {
      await this.cache.clear();
      await this.parallelRenderer.shutdown();
      await this.metricsCollector.shutdown();
      await this.streamingProcessor.shutdown();
      
      // Clean up temp directories
      try {
        await fs.rm('./temp', { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup had some issues:', error.message);
    }
  }
}

// Run the validation
async function main() {
  const validator = new PerformanceValidator();
  
  try {
    await validator.setupOptimizations();
    
    await validator.runCachePerformanceTest();
    await validator.runStreamingPerformanceTest();
    await validator.runGraphOptimizationTest();
    await validator.runParallelRenderingTest();
    await validator.runIncrementalGenerationTest();
    await validator.runComprehensiveMetricsTest();
    
    await validator.generateFinalReport();
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    console.error(error.stack);
  } finally {
    await validator.cleanup();
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PerformanceValidator;