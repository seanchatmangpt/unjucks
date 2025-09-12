/**
 * KGEN Performance Benchmarking Suite
 * 
 * Comprehensive performance tests for all optimization components
 * with large knowledge graph validation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Store, Parser, Writer, DataFactory } from 'n3';
import { OptimizedKGEN } from '../../src/lib/index.js';
import ContentAddressedCache from '../../src/lib/cache/content-addressed-cache.js';
import IncrementalGenerator from '../../src/lib/optimization/incremental-generator.js';
import GraphOptimizer from '../../src/lib/optimization/graph-optimizer.js';
import ParallelRenderer from '../../src/lib/performance/parallel-renderer.js';
import MemoryEfficientStreaming from '../../src/lib/streaming/memory-efficient-streaming.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const { namedNode, literal, quad } = DataFactory;

// Performance thresholds for validation
const PERFORMANCE_THRESHOLDS = {
  cache_hit_rate_min: 0.8,
  parallel_speedup_min: 1.5,
  memory_efficiency_min: 0.7,
  large_graph_processing_time_max: 30000, // 30 seconds for 1M triples
  incremental_improvement_min: 0.5, // 50% time reduction
  streaming_memory_max: 1024 * 1024 * 1024 // 1GB
};

describe('KGEN Performance Benchmarking Suite', () => {
  let optimizedKGEN;
  let testDataDir;

  beforeAll(async () => {
    // Setup test environment
    testDataDir = path.join(__dirname, '../test-data/performance');
    await fs.mkdir(testDataDir, { recursive: true });

    // Initialize optimized KGEN
    optimizedKGEN = new OptimizedKGEN({
      cacheDir: path.join(testDataDir, 'cache'),
      stateDir: path.join(testDataDir, 'state'),
      tempDir: path.join(testDataDir, 'temp'),
      metricsPath: path.join(testDataDir, 'metrics'),
      workerCount: 4
    });

    await optimizedKGEN.initialize();
  });

  afterAll(async () => {
    if (optimizedKGEN) {
      await optimizedKGEN.shutdown();
    }

    // Cleanup test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Content-Addressed Caching Performance', () => {
    let cache;

    beforeEach(async () => {
      cache = new ContentAddressedCache({
        cacheDir: path.join(testDataDir, 'cache-test'),
        maxCacheSize: '100MB',
        enableIntegrity: true
      });
      await cache.initialize();
    });

    it('should achieve high cache hit rate with repeated content', async () => {
      const testData = generateTestContent(1000);
      const startTime = this.getDeterministicTimestamp();

      // First round - populate cache
      const firstRoundPromises = testData.map(async (content, index) => {
        const contentKey = cache.generateContentKey(content, { round: 1 });
        return await cache.store(content, { index });
      });
      await Promise.all(firstRoundPromises);

      // Second round - should hit cache
      const secondRoundPromises = testData.map(async (content, index) => {
        const contentKey = cache.generateContentKey(content, { round: 1 });
        return await cache.retrieve(contentKey);
      });
      await Promise.all(secondRoundPromises);

      const totalTime = this.getDeterministicTimestamp() - startTime;
      const stats = cache.getStats();

      console.log(`Cache Performance:`, {
        hit_rate: stats.hit_rate,
        total_time: totalTime,
        entries: stats.memory_entries + stats.disk_entries
      });

      expect(stats.hit_rate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.cache_hit_rate_min);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle deterministic content addressing', async () => {
      const content1 = { data: "test content", timestamp: "2023-01-01" };
      const content2 = { timestamp: "2023-01-01", data: "test content" }; // Same content, different order

      const key1 = cache.generateContentKey(content1);
      const key2 = cache.generateContentKey(content2);

      expect(key1).toBe(key2); // Should generate same key for same content
    });

    it('should efficiently handle large content volumes', async () => {
      const largeTestData = generateTestContent(10000);
      const startTime = this.getDeterministicTimestamp();

      // Store large volume
      const storePromises = largeTestData.map(async (content, index) => {
        return await cache.store(content, { index, generated_at: this.getDeterministicTimestamp() });
      });
      await Promise.all(storePromises);

      // Retrieve subset
      const retrievePromises = largeTestData.slice(0, 1000).map(async (content) => {
        const contentKey = cache.generateContentKey(content);
        return await cache.retrieve(contentKey);
      });
      await Promise.all(retrievePromises);

      const totalTime = this.getDeterministicTimestamp() - startTime;
      const stats = cache.getStats();

      console.log(`Large Volume Cache Performance:`, {
        total_items: largeTestData.length,
        processing_time: totalTime,
        hit_rate: stats.hit_rate,
        memory_usage: `${Math.round(stats.memory_entries)} entries`
      });

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(stats.hit_rate).toBeGreaterThan(0.9); // High hit rate expected
    });
  });

  describe('Incremental Generation Performance', () => {
    let incrementalGen;

    beforeEach(async () => {
      incrementalGen = new IncrementalGenerator({
        stateDir: path.join(testDataDir, 'incremental-test'),
        enableFingerprinting: true,
        enableDependencyTracking: true
      });
      await incrementalGen.initialize();
    });

    it('should significantly reduce regeneration time for unchanged content', async () => {
      const testInputs = generateTestInputs(1000);

      // First generation (full)
      const firstGenStart = this.getDeterministicTimestamp();
      const changeAnalysis1 = await incrementalGen.analyzeChanges(testInputs);
      await incrementalGen.generateIncremental(
        mockGenerator,
        testInputs,
        changeAnalysis1
      );
      const firstGenTime = this.getDeterministicTimestamp() - firstGenStart;

      // Second generation (should be mostly incremental)
      const secondGenStart = this.getDeterministicTimestamp();
      const changeAnalysis2 = await incrementalGen.analyzeChanges(testInputs);
      await incrementalGen.generateIncremental(
        mockGenerator,
        testInputs,
        changeAnalysis2
      );
      const secondGenTime = this.getDeterministicTimestamp() - secondGenStart;

      const improvementRatio = (firstGenTime - secondGenTime) / firstGenTime;
      const stats = incrementalGen.getStatistics();

      console.log(`Incremental Generation Performance:`, {
        first_generation_time: firstGenTime,
        second_generation_time: secondGenTime,
        improvement_ratio: improvementRatio,
        cache_hit_rate: stats.cache_hit_rate
      });

      expect(improvementRatio).toBeGreaterThan(PERFORMANCE_THRESHOLDS.incremental_improvement_min);
      expect(secondGenTime).toBeLessThan(firstGenTime * 0.3); // At least 70% improvement
    });

    it('should accurately track dependencies and affected artifacts', async () => {
      const dependentInputs = generateDependentInputs(100);
      
      // Build dependency graph
      await incrementalGen.buildDependencyGraph(dependentInputs);
      
      // Modify a root dependency
      const modifiedInputs = new Map(dependentInputs);
      const rootKey = modifiedInputs.keys().next().value;
      modifiedInputs.get(rootKey).content = 'modified content';

      const changeAnalysis = await incrementalGen.analyzeChanges(modifiedInputs);

      console.log(`Dependency Tracking:`, {
        total_inputs: dependentInputs.size,
        modified: changeAnalysis.modified.size,
        affected: changeAnalysis.affected.size,
        unchanged: changeAnalysis.unchanged.size
      });

      expect(changeAnalysis.affected.size).toBeGreaterThan(0); // Should detect affected artifacts
      expect(changeAnalysis.modified.size).toBe(1); // Only one direct modification
    });
  });

  describe('Graph Optimization Performance', () => {
    let graphOptimizer;

    beforeEach(async () => {
      graphOptimizer = new GraphOptimizer({
        enableIndexing: true,
        enablePartitioning: true,
        enableBloomFilters: true,
        workerThreads: 2
      });
      await graphOptimizer.initialize();
    });

    it('should efficiently process large knowledge graphs (1M+ triples)', async () => {
      const largeGraph = generateLargeKnowledgeGraph(1000000); // 1M triples
      const startTime = this.getDeterministicTimestamp();

      // Add triples to optimizer
      await graphOptimizer.addTriples(largeGraph);

      // Perform optimization
      await graphOptimizer.optimize();

      // Execute test queries
      const queryResults = await executeTestQueries(graphOptimizer, 100);

      const totalTime = this.getDeterministicTimestamp() - startTime;
      const stats = graphOptimizer.getStatistics();

      console.log(`Large Graph Processing Performance:`, {
        total_triples: largeGraph.length,
        processing_time: totalTime,
        indexing_time: stats.indexing_time,
        avg_query_time: stats.avg_query_time,
        cache_hit_rate: stats.cache_hit_rate,
        partitions: stats.partitions
      });

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.large_graph_processing_time_max);
      expect(stats.avg_query_time).toBeLessThan(100); // Queries should be fast
      expect(stats.cache_hit_rate).toBeGreaterThan(0.5); // Reasonable cache performance
    });

    it('should demonstrate query performance improvements with indexing', async () => {
      const testGraph = generateLargeKnowledgeGraph(100000); // 100K triples
      await graphOptimizer.addTriples(testGraph);

      // Test queries without optimization
      const unoptimizedStart = this.getDeterministicTimestamp();
      const unoptimizedResults = await executeDirectQueries(testGraph, 50);
      const unoptimizedTime = this.getDeterministicTimestamp() - unoptimizedStart;

      // Optimize graph
      await graphOptimizer.optimize();

      // Test same queries with optimization
      const optimizedStart = this.getDeterministicTimestamp();
      const optimizedResults = await executeTestQueries(graphOptimizer, 50);
      const optimizedTime = this.getDeterministicTimestamp() - optimizedStart;

      const speedup = unoptimizedTime / optimizedTime;

      console.log(`Query Optimization Performance:`, {
        unoptimized_time: unoptimizedTime,
        optimized_time: optimizedTime,
        speedup: speedup,
        queries_executed: 50
      });

      expect(speedup).toBeGreaterThan(2); // Should be at least 2x faster
      expect(optimizedTime).toBeLessThan(unoptimizedTime);
    });
  });

  describe('Parallel Rendering Performance', () => {
    let parallelRenderer;

    beforeEach(async () => {
      parallelRenderer = new ParallelRenderer({
        workerCount: 4,
        enableLoadBalancing: true,
        batchSize: 20
      });
      await parallelRenderer.initialize();
    });

    it('should achieve significant speedup with parallel processing', async () => {
      const renderTasks = generateRenderTasks(100);

      // Serial rendering (simulated)
      const serialStart = this.getDeterministicTimestamp();
      const serialResults = await simulateSerialRendering(renderTasks);
      const serialTime = this.getDeterministicTimestamp() - serialStart;

      // Parallel rendering
      const parallelStart = this.getDeterministicTimestamp();
      const parallelResults = await parallelRenderer.renderParallel(renderTasks);
      const parallelTime = this.getDeterministicTimestamp() - parallelStart;

      const speedup = serialTime / parallelTime;
      const stats = parallelRenderer.getStatistics();

      console.log(`Parallel Rendering Performance:`, {
        serial_time: serialTime,
        parallel_time: parallelTime,
        speedup: speedup,
        parallel_efficiency: stats.performance.parallel_speedup,
        worker_utilization: stats.workers.utilization
      });

      expect(speedup).toBeGreaterThan(PERFORMANCE_THRESHOLDS.parallel_speedup_min);
      expect(parallelResults.metrics.completed_tasks).toBe(renderTasks.length);
      expect(parallelResults.metrics.failed_tasks).toBe(0);
    });

    it('should handle worker load balancing effectively', async () => {
      const unevenTasks = generateUnevenRenderTasks(50); // Tasks with different complexity
      
      const results = await parallelRenderer.renderParallel(unevenTasks);
      const stats = parallelRenderer.getStatistics();

      console.log(`Load Balancing Performance:`, {
        total_tasks: unevenTasks.length,
        completed: results.metrics.completed_tasks,
        worker_utilization: stats.workers.utilization,
        queue_health: stats.queue.health
      });

      expect(results.metrics.completed_tasks).toBe(unevenTasks.length);
      expect(stats.workers.utilization).toBeGreaterThan(0.5); // Good utilization
      expect(stats.queue.health).toBe('healthy');
    });
  });

  describe('Memory-Efficient Streaming Performance', () => {
    let streaming;

    beforeEach(async () => {
      streaming = new MemoryEfficientStreaming({
        maxMemoryUsage: '256MB',
        tempDir: path.join(testDataDir, 'streaming-test'),
        enableCompression: true
      });
      await streaming.initialize();
    });

    it('should process large files without excessive memory usage', async () => {
      const largeFile = await generateLargeTestFile(path.join(testDataDir, 'large-test.ttl'), 100000); // 100K triples
      
      const initialMemory = process.memoryUsage().heapUsed;
      let peakMemoryUsage = initialMemory;

      // Monitor memory usage during processing
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        peakMemoryUsage = Math.max(peakMemoryUsage, currentMemory);
      }, 100);

      const startTime = this.getDeterministicTimestamp();
      let processedTriples = 0;

      await streaming.streamRDF(
        largeFile,
        async (quad, index) => {
          processedTriples++;
          // Simulate processing
          return quad;
        }
      );

      clearInterval(memoryMonitor);
      const processingTime = this.getDeterministicTimestamp() - startTime;
      const memoryIncrease = peakMemoryUsage - initialMemory;
      const stats = streaming.getStatistics();

      console.log(`Large File Streaming Performance:`, {
        file_size: (await fs.stat(largeFile)).size,
        processing_time: processingTime,
        processed_triples: processedTriples,
        memory_increase: memoryIncrease,
        peak_memory: peakMemoryUsage,
        memory_efficiency: stats.memory_efficiency
      });

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.streaming_memory_max);
      expect(stats.memory_efficiency).toBeGreaterThan(PERFORMANCE_THRESHOLDS.memory_efficiency_min);
      expect(processedTriples).toBeGreaterThan(90000); // Should process most triples
    });

    it('should handle concurrent streaming efficiently', async () => {
      const testFiles = await Promise.all([
        generateLargeTestFile(path.join(testDataDir, 'test1.ttl'), 50000),
        generateLargeTestFile(path.join(testDataDir, 'test2.ttl'), 50000),
        generateLargeTestFile(path.join(testDataDir, 'test3.ttl'), 50000)
      ]);

      const startTime = this.getDeterministicTimestamp();
      const initialMemory = process.memoryUsage().heapUsed;

      const streamingPromises = testFiles.map(async (file, index) => {
        return await streaming.streamFile(
          file,
          async (chunk, chunkIndex) => {
            // Simulate processing
            await new Promise(resolve => setTimeout(resolve, 1));
            return chunk;
          }
        );
      });

      const results = await Promise.all(streamingPromises);
      const totalTime = this.getDeterministicTimestamp() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Concurrent Streaming Performance:`, {
        files_processed: testFiles.length,
        total_time: totalTime,
        memory_increase: memoryIncrease,
        avg_time_per_file: totalTime / testFiles.length
      });

      expect(results).toHaveLength(testFiles.length);
      expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
    });
  });

  describe('Integrated Performance Tests', () => {
    it('should demonstrate end-to-end optimization benefits', async () => {
      const largeInputSet = generateComplexInputSet(1000);
      
      // Test without optimizations (simulated)
      const unoptimizedStart = this.getDeterministicTimestamp();
      const unoptimizedResults = await simulateUnoptimizedGeneration(largeInputSet);
      const unoptimizedTime = this.getDeterministicTimestamp() - unoptimizedStart;

      // Test with full optimizations
      const optimizedStart = this.getDeterministicTimestamp();
      const optimizedResults = await optimizedKGEN.generate(largeInputSet, {
        template: 'test-template',
        enableAllOptimizations: true
      });
      const optimizedTime = this.getDeterministicTimestamp() - optimizedStart;

      const overallSpeedup = unoptimizedTime / optimizedTime;
      const performanceStats = optimizedKGEN.getPerformanceStatistics();

      console.log(`End-to-End Performance Comparison:`, {
        input_size: largeInputSet.size,
        unoptimized_time: unoptimizedTime,
        optimized_time: optimizedTime,
        overall_speedup: overallSpeedup,
        cache_hit_rate: optimizedResults.performance.cache_hit_rate,
        overall_score: performanceStats.overall.overall_score
      });

      expect(overallSpeedup).toBeGreaterThan(2); // At least 2x improvement
      expect(optimizedResults.performance.cache_hit_rate).toBeGreaterThan(0.1);
      expect(performanceStats.overall.overall_score).toBeGreaterThan(60); // Good performance score
    });

    it('should maintain performance under load', async () => {
      const loadTestInputs = generateComplexInputSet(2000);
      const concurrentRequests = 5;

      const startTime = this.getDeterministicTimestamp();
      
      // Execute multiple concurrent generation requests
      const loadTestPromises = Array(concurrentRequests).fill().map(async (_, index) => {
        const subset = new Map(Array.from(loadTestInputs.entries()).slice(
          index * 400,
          (index + 1) * 400
        ));
        
        return await optimizedKGEN.generate(subset, {
          template: `load-test-${index}`,
          requestId: index
        });
      });

      const results = await Promise.all(loadTestPromises);
      const totalTime = this.getDeterministicTimestamp() - startTime;
      const finalStats = optimizedKGEN.getPerformanceStatistics();

      console.log(`Load Test Performance:`, {
        concurrent_requests: concurrentRequests,
        total_inputs: loadTestInputs.size,
        total_time: totalTime,
        avg_request_time: totalTime / concurrentRequests,
        overall_score: finalStats.overall.overall_score,
        memory_efficiency: finalStats.overall.memory_efficiency
      });

      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
      expect(finalStats.overall.overall_score).toBeGreaterThan(50); // Maintain decent performance
    });
  });
});

// Helper functions for test data generation

function generateTestContent(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `content-${i}`,
    data: `Test content ${i}`,
    value: Math.random() * 1000,
    timestamp: this.getDeterministicDate().toISOString()
  }));
}

function generateTestInputs(count) {
  const inputs = new Map();
  
  for (let i = 0; i < count; i++) {
    inputs.set(`input-${i}`, {
      id: `input-${i}`,
      content: `Input content ${i}`,
      metadata: {
        type: 'test',
        index: i,
        generated: false
      }
    });
  }
  
  return inputs;
}

function generateDependentInputs(count) {
  const inputs = new Map();
  
  for (let i = 0; i < count; i++) {
    const dependencies = i > 0 ? [`input-${Math.floor(Math.random() * i)}`] : [];
    
    inputs.set(`input-${i}`, {
      id: `input-${i}`,
      content: `Dependent content ${i}`,
      dependencies,
      metadata: { type: 'dependent' }
    });
  }
  
  return inputs;
}

function generateLargeKnowledgeGraph(tripleCount) {
  const triples = [];
  
  for (let i = 0; i < tripleCount; i++) {
    const subject = namedNode(`http://example.org/entity/${i}`);
    const predicate = namedNode(`http://example.org/property/${i % 100}`);
    const object = Math.random() > 0.5 ? 
      namedNode(`http://example.org/entity/${(i + 1) % tripleCount}`) :
      literal(`Value ${i}`);
    
    triples.push(quad(subject, predicate, object));
  }
  
  return triples;
}

function generateRenderTasks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i}`,
    template: 'test-template',
    context: {
      title: `Task ${i}`,
      content: `Content for task ${i}`,
      data: { value: Math.random() * 100 }
    }
  }));
}

function generateUnevenRenderTasks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `uneven-task-${i}`,
    template: 'test-template',
    context: {
      title: `Uneven Task ${i}`,
      complexity: Math.random() > 0.7 ? 'high' : 'low', // 30% high complexity
      data: { value: Math.random() * 100 }
    }
  }));
}

function generateComplexInputSet(count) {
  const inputs = new Map();
  
  for (let i = 0; i < count; i++) {
    inputs.set(`complex-${i}`, {
      id: `complex-${i}`,
      type: i % 3 === 0 ? 'entity' : i % 3 === 1 ? 'relationship' : 'attribute',
      content: {
        data: `Complex data ${i}`,
        properties: Array.from({ length: 10 }, (_, j) => ({
          key: `prop-${j}`,
          value: `value-${i}-${j}`
        })),
        references: Array.from({ length: 3 }, (_, k) => `complex-${(i + k + 1) % count}`)
      },
      metadata: {
        complexity: Math.random(),
        size: Math.floor(Math.random() * 1000)
      }
    });
  }
  
  return inputs;
}

async function generateLargeTestFile(filePath, tripleCount) {
  const writer = new Writer();
  let content = '';
  
  for (let i = 0; i < tripleCount; i++) {
    const subject = `<http://example.org/entity/${i}>`;
    const predicate = `<http://example.org/property/${i % 100}>`;
    const object = Math.random() > 0.5 ? 
      `<http://example.org/entity/${(i + 1) % tripleCount}>` :
      `"Value ${i}"`;
    
    content += `${subject} ${predicate} ${object} .\n`;
  }
  
  await fs.writeFile(filePath, content);
  return filePath;
}

// Mock functions for testing

async function mockGenerator(key, input, context) {
  // Simulate generation time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  
  return {
    key,
    content: `Generated content for ${key}`,
    metadata: {
      generated_at: this.getDeterministicTimestamp(),
      input_type: input.type || 'unknown'
    }
  };
}

async function executeTestQueries(optimizer, queryCount) {
  const queries = [];
  
  for (let i = 0; i < queryCount; i++) {
    const pattern = {
      subject: Math.random() > 0.5 ? namedNode(`http://example.org/entity/${i}`) : null,
      predicate: Math.random() > 0.7 ? namedNode(`http://example.org/property/${i % 10}`) : null,
      object: null,
      graph: null
    };
    
    queries.push(optimizer.query(pattern));
  }
  
  return await Promise.all(queries);
}

async function executeDirectQueries(triples, queryCount) {
  const store = new Store(triples);
  const queries = [];
  
  for (let i = 0; i < queryCount; i++) {
    const subject = Math.random() > 0.5 ? namedNode(`http://example.org/entity/${i}`) : null;
    const predicate = Math.random() > 0.7 ? namedNode(`http://example.org/property/${i % 10}`) : null;
    
    queries.push(store.getQuads(subject, predicate, null, null));
  }
  
  return queries;
}

async function simulateSerialRendering(tasks) {
  const results = [];
  
  for (const task of tasks) {
    // Simulate rendering time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
    
    results.push({
      id: task.id,
      content: `Rendered: ${task.context.title}`,
      renderTime: Math.random() * 20 + 10
    });
  }
  
  return { results, total_time: this.getDeterministicTimestamp() };
}

async function simulateUnoptimizedGeneration(inputs) {
  const results = {};
  
  // Simulate slow, sequential processing without any optimizations
  for (const [key, input] of inputs) {
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow processing
    
    results[key] = {
      content: `Unoptimized result for ${key}`,
      metadata: { generated_at: this.getDeterministicTimestamp() }
    };
  }
  
  return { results };
}