/**
 * @fileoverview Performance tests for Office batch operations
 * Tests performance, memory usage, and scalability of Office document processing
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: 0,
      endTime: 0,
      memoryUsage: {
        start: null,
        end: null,
        peak: null
      },
      operations: [],
      errors: []
    };
  }

  start() {
    this.metrics.startTime = process.hrtime.bigint();
    this.metrics.memoryUsage.start = process.memoryUsage();
    
    // Monitor memory usage periodically
    this.memoryInterval = setInterval(() => {
      const current = process.memoryUsage();
      if (!this.metrics.memoryUsage.peak || current.heapUsed > this.metrics.memoryUsage.peak.heapUsed) {
        this.metrics.memoryUsage.peak = current;
      }
    }, 100);
  }

  end() {
    this.metrics.endTime = process.hrtime.bigint();
    this.metrics.memoryUsage.end = process.memoryUsage();
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }

  recordOperation(operation, duration, success = true) {
    this.metrics.operations.push({
      operation,
      duration,
      success,
      timestamp: this.getDeterministicTimestamp()
    });
  }

  recordError(error) {
    this.metrics.errors.push({
      error: error.message,
      timestamp: this.getDeterministicTimestamp()
    });
  }

  getResults() {
    const totalDuration = Number(this.metrics.endTime - this.metrics.startTime) / 1000000; // Convert to milliseconds
    const successfulOps = this.metrics.operations.filter(op => op.success);
    const failedOps = this.metrics.operations.filter(op => !op.success);

    return {
      totalDuration,
      totalOperations: this.metrics.operations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageOpDuration: successfulOps.length > 0 ? 
        successfulOps.reduce((sum, op) => sum + op.duration, 0) / successfulOps.length : 0,
      operationsPerSecond: successfulOps.length > 0 ? 
        (successfulOps.length / (totalDuration / 1000)) : 0,
      memoryUsage: {
        initial: this.metrics.memoryUsage.start ? Math.round(this.metrics.memoryUsage.start.heapUsed / 1024 / 1024) : 0,
        final: this.metrics.memoryUsage.end ? Math.round(this.metrics.memoryUsage.end.heapUsed / 1024 / 1024) : 0,
        peak: this.metrics.memoryUsage.peak ? Math.round(this.metrics.memoryUsage.peak.heapUsed / 1024 / 1024) : 0,
        growth: this.metrics.memoryUsage.end && this.metrics.memoryUsage.start ? 
          Math.round((this.metrics.memoryUsage.end.heapUsed - this.metrics.memoryUsage.start.heapUsed) / 1024 / 1024) : 0
      },
      errors: this.metrics.errors.length
    };
  }
}

/**
 * Mock Office Batch Processor for performance testing
 */
class OfficePerformanceProcessor {
  constructor(options = {}) {
    this.options = {
      concurrency: 4,
      chunkSize: 10,
      memoryLimit: 500, // MB
      timeout: 30000, // 30 seconds
      ...options
    };
    
    this.stats = {
      totalProcessed: 0,
      batchesProcessed: 0,
      averageProcessingTime: 0,
      peakMemoryUsage: 0
    };
  }

  /**
   * Process multiple documents in batches with performance monitoring
   */
  async processBatch(documents, options = {}) {
    const monitor = new PerformanceMonitor();
    monitor.start();

    const batchOptions = { ...this.options, ...options };
    const results = [];
    const batches = this.createBatches(documents, batchOptions.chunkSize);

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartTime = this.getDeterministicTimestamp();

        // Process batch with concurrency control
        const batchResults = await this.processBatchChunk(batch, batchOptions.concurrency);
        results.push(...batchResults);

        const batchDuration = this.getDeterministicTimestamp() - batchStartTime;
        monitor.recordOperation(`batch_${i}`, batchDuration, true);

        this.stats.batchesProcessed++;

        // Memory check
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        if (currentMemory > this.stats.peakMemoryUsage) {
          this.stats.peakMemoryUsage = currentMemory;
        }

        if (currentMemory > batchOptions.memoryLimit) {
          throw new Error(`Memory limit exceeded: ${Math.round(currentMemory)}MB > ${batchOptions.memoryLimit}MB`);
        }

        // Small delay between batches to prevent overwhelming the system
        await TestUtils.sleep(10);
      }

      monitor.end();
      
      this.stats.totalProcessed += documents.length;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime + monitor.getResults().averageOpDuration) / 2;

      return {
        success: true,
        results,
        performance: monitor.getResults(),
        stats: { ...this.stats }
      };

    } catch (error) {
      monitor.recordError(error);
      monitor.end();

      return {
        success: false,
        error: error.message,
        results,
        performance: monitor.getResults(),
        stats: { ...this.stats }
      };
    }
  }

  /**
   * Simulate intensive document processing
   */
  async processDocumentIntensive(document, processingTime = 50) {
    const startTime = this.getDeterministicTimestamp();

    // Simulate memory allocation
    const largeArray = new Array(100000).fill(0).map(() => Math.random());
    
    // Simulate processing time
    await TestUtils.sleep(processingTime);

    // Simulate some CPU work
    let sum = 0;
    for (let i = 0; i < largeArray.length; i++) {
      sum += largeArray[i];
    }

    return {
      document: document.name || 'unknown',
      processingTime: this.getDeterministicTimestamp() - startTime,
      memoryFootprint: largeArray.length * 8, // Rough estimate
      result: sum
    };
  }

  /**
   * Test memory usage patterns
   */
  async testMemoryUsage(iterations = 1000) {
    const monitor = new PerformanceMonitor();
    monitor.start();

    const results = [];
    const memorySnapshots = [];

    for (let i = 0; i < iterations; i++) {
      const startMem = process.memoryUsage();
      
      // Simulate document processing with memory allocation
      const data = new Array(1000).fill(0).map(() => ({
        id: i,
        content: 'Sample document content '.repeat(10),
        metadata: { created: this.getDeterministicDate(), size: Math.random() * 1000 }
      }));

      // Process the data
      const processed = data.map(item => ({
        ...item,
        processed: true,
        timestamp: this.getDeterministicTimestamp()
      }));

      results.push(processed);

      const endMem = process.memoryUsage();
      memorySnapshots.push({
        iteration: i,
        heapUsed: endMem.heapUsed,
        heapTotal: endMem.heapTotal,
        growth: endMem.heapUsed - startMem.heapUsed
      });

      // Periodic garbage collection trigger
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }

      monitor.recordOperation(`memory_test_${i}`, this.getDeterministicTimestamp() - startMem, true);
    }

    monitor.end();

    return {
      results: monitor.getResults(),
      memorySnapshots,
      finalResultsLength: results.length
    };
  }

  // Helper methods

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async processBatchChunk(batch, concurrency) {
    const results = [];
    const promises = [];

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (document, index) => {
        try {
          return await this.processDocumentIntensive(document, Math.random() * 50 + 10);
        } catch (error) {
          return {
            document: document.name || 'unknown',
            error: error.message,
            success: false
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }
}

/**
 * Register performance tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('Office Batch Performance Tests', async () => {
    let processor;
    
    beforeEach(() => {
      processor = new OfficePerformanceProcessor();
    });

    describe('Small Batch Processing', () => {
      test('should process small batch efficiently', async () => {
        const documents = Array.from({ length: 10 }, (_, i) => ({
          name: `document_${i}.docx`,
          type: 'word',
          size: Math.random() * 1000000
        }));

        const result = await processor.processBatch(documents, {
          concurrency: 2,
          chunkSize: 5
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.results.length, 10);
        
        const perf = result.performance;
        assert.ok(perf.totalDuration > 0);
        assert.ok(perf.totalDuration < 5000); // Should complete in under 5 seconds
        assert.strictEqual(perf.totalOperations, 2); // 2 batches
        assert.strictEqual(perf.successfulOperations, 2);
        assert.ok(perf.memoryUsage.peak > 0);
        
        TestUtils.logProgress(`Small batch: ${perf.totalDuration}ms, ${perf.operationsPerSecond.toFixed(2)} ops/sec, Peak memory: ${perf.memoryUsage.peak}MB`);
      });

      test('should handle concurrent processing correctly', async () => {
        const documents = Array.from({ length: 20 }, (_, i) => ({
          name: `concurrent_doc_${i}.docx`,
          type: 'word',
          size: 500000
        }));

        const concurrencyLevels = [1, 2, 4, 8];
        const results = [];

        for (const concurrency of concurrencyLevels) {
          const result = await processor.processBatch(documents, {
            concurrency,
            chunkSize: 10
          });

          assert.strictEqual(result.success, true);
          results.push({
            concurrency,
            duration: result.performance.totalDuration,
            opsPerSec: result.performance.operationsPerSecond,
            peakMemory: result.performance.memoryUsage.peak
          });
        }

        // Verify that higher concurrency generally improves performance
        // (though this may not always be true due to overhead)
        const baseline = results[0]; // concurrency = 1
        const optimized = results[2]; // concurrency = 4
        
        TestUtils.logProgress(`Concurrency impact: 1-thread: ${baseline.duration}ms, 4-thread: ${optimized.duration}ms`);
        
        // At minimum, we should be able to handle all concurrency levels
        assert.ok(results.every(r => r.duration > 0));
      });
    });

    describe('Medium Batch Processing', () => {
      test('should process medium batch within performance limits', async () => {
        const documents = Array.from({ length: 100 }, (_, i) => ({
          name: `medium_doc_${i}.docx`,
          type: i % 3 === 0 ? 'word' : i % 3 === 1 ? 'excel' : 'powerpoint',
          size: Math.random() * 2000000
        }));

        const result = await processor.processBatch(documents, {
          concurrency: 4,
          chunkSize: 10,
          memoryLimit: 200
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.results.length, 100);
        
        const perf = result.performance;
        assert.ok(perf.totalDuration > 0);
        assert.ok(perf.totalDuration < 30000); // Should complete in under 30 seconds
        assert.ok(perf.memoryUsage.peak < 200); // Should stay under memory limit
        assert.ok(perf.operationsPerSecond > 1); // At least 1 operation per second
        
        TestUtils.logProgress(`Medium batch: ${perf.totalDuration}ms, ${perf.operationsPerSecond.toFixed(2)} ops/sec, Memory: ${perf.memoryUsage.initial}→${perf.memoryUsage.final}MB (peak: ${perf.memoryUsage.peak}MB)`);
      });

      test('should maintain performance with different document types', async () => {
        const documentTypes = ['word', 'excel', 'powerpoint'];
        const results = [];

        for (const docType of documentTypes) {
          const documents = Array.from({ length: 50 }, (_, i) => ({
            name: `${docType}_doc_${i}`,
            type: docType,
            size: Math.random() * 1500000
          }));

          const result = await processor.processBatch(documents, {
            concurrency: 3,
            chunkSize: 10
          });

          assert.strictEqual(result.success, true);
          results.push({
            type: docType,
            duration: result.performance.totalDuration,
            avgOpDuration: result.performance.averageOpDuration,
            peakMemory: result.performance.memoryUsage.peak
          });
        }

        // All document types should complete successfully
        assert.ok(results.every(r => r.duration > 0));
        
        // Log performance comparison
        results.forEach(r => {
          TestUtils.logProgress(`${r.type}: ${r.duration}ms total, ${r.avgOpDuration.toFixed(2)}ms avg, ${r.peakMemory}MB peak`);
        });
      });
    });

    describe('Large Batch Processing', () => {
      test('should process large batch with memory management', async () => {
        const documents = Array.from({ length: 500 }, (_, i) => ({
          name: `large_doc_${i}.docx`,
          type: ['word', 'excel', 'powerpoint'][i % 3],
          size: Math.random() * 1000000 + 500000
        }));

        const result = await processor.processBatch(documents, {
          concurrency: 6,
          chunkSize: 20,
          memoryLimit: 300
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.results.length, 500);
        
        const perf = result.performance;
        assert.ok(perf.totalDuration > 0);
        assert.ok(perf.memoryUsage.peak < 300); // Should stay under memory limit
        assert.ok(perf.memoryUsage.growth < 100); // Memory growth should be reasonable
        
        // Performance should be reasonable for large batch
        assert.ok(perf.operationsPerSecond > 0.5); // At least 0.5 ops/sec for large batch
        
        TestUtils.logProgress(`Large batch: ${(perf.totalDuration/1000).toFixed(1)}s, ${perf.operationsPerSecond.toFixed(2)} ops/sec, Memory growth: ${perf.memoryUsage.growth}MB`);
      });

      test('should handle memory pressure gracefully', async () => {
        const documents = Array.from({ length: 200 }, (_, i) => ({
          name: `memory_test_doc_${i}.docx`,
          type: 'word',
          size: 1000000 // 1MB each
        }));

        const result = await processor.processBatch(documents, {
          concurrency: 8,
          chunkSize: 25,
          memoryLimit: 150 // Tight memory limit
        });

        // Should either succeed or fail gracefully with memory error
        if (result.success) {
          assert.strictEqual(result.results.length, 200);
          assert.ok(result.performance.memoryUsage.peak <= 150);
        } else {
          assert.ok(result.error.includes('Memory limit exceeded'));
        }
        
        TestUtils.logProgress(`Memory pressure test: ${result.success ? 'Passed' : 'Failed as expected'} - Peak memory: ${result.performance.memoryUsage.peak}MB`);
      });
    });

    describe('Stress Testing', () => {
      test('should handle rapid successive batches', async () => {
        const batchCount = 5;
        const documentsPerBatch = 20;
        const results = [];

        const overallStart = this.getDeterministicTimestamp();

        for (let batch = 0; batch < batchCount; batch++) {
          const documents = Array.from({ length: documentsPerBatch }, (_, i) => ({
            name: `stress_batch${batch}_doc${i}.docx`,
            type: 'word',
            size: Math.random() * 500000
          }));

          const result = await processor.processBatch(documents, {
            concurrency: 4,
            chunkSize: 5
          });

          results.push({
            batch,
            success: result.success,
            duration: result.performance.totalDuration,
            peakMemory: result.performance.memoryUsage.peak
          });

          assert.strictEqual(result.success, true);
        }

        const overallDuration = this.getDeterministicTimestamp() - overallStart;
        const totalDocuments = batchCount * documentsPerBatch;
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        const maxMemory = Math.max(...results.map(r => r.peakMemory));

        TestUtils.logProgress(`Stress test: ${batchCount} batches, ${totalDocuments} documents, ${overallDuration}ms total, ${avgDuration.toFixed(2)}ms avg, ${maxMemory}MB max memory`);

        // All batches should succeed
        assert.ok(results.every(r => r.success));
        assert.ok(overallDuration < 60000); // Should complete within 1 minute
        assert.ok(maxMemory < 250); // Memory should stay reasonable
      });

      test('should handle memory usage patterns over time', async () => {
        const memoryTest = await processor.testMemoryUsage(500);
        
        const results = memoryTest.results;
        const snapshots = memoryTest.memorySnapshots;
        
        assert.ok(results.totalOperations, 500);
        assert.ok(results.successfulOperations, 500);
        assert.strictEqual(snapshots.length, 500);
        
        // Analyze memory growth patterns
        const firstQuarter = snapshots.slice(0, 125);
        const lastQuarter = snapshots.slice(375);
        
        const avgStartMemory = firstQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / firstQuarter.length;
        const avgEndMemory = lastQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / lastQuarter.length;
        
        const memoryGrowthMB = (avgEndMemory - avgStartMemory) / 1024 / 1024;
        
        TestUtils.logProgress(`Memory pattern: ${(avgStartMemory/1024/1024).toFixed(1)}MB → ${(avgEndMemory/1024/1024).toFixed(1)}MB (${memoryGrowthMB.toFixed(1)}MB growth)`);
        
        // Memory growth should be reasonable (less than 100MB over 500 operations)
        assert.ok(memoryGrowthMB < 100);
        
        // Operations per second should be reasonable
        assert.ok(results.operationsPerSecond > 50);
      });
    });

    describe('Performance Benchmarks', () => {
      test('should meet minimum performance benchmarks', async () => {
        const benchmarks = {
          smallBatch: { size: 10, maxDuration: 2000, minOpsPerSec: 5 },
          mediumBatch: { size: 50, maxDuration: 10000, minOpsPerSec: 3 },
          largeBatch: { size: 100, maxDuration: 20000, minOpsPerSec: 2 }
        };

        const results = {};

        for (const [benchmarkName, benchmark] of Object.entries(benchmarks)) {
          const documents = Array.from({ length: benchmark.size }, (_, i) => ({
            name: `benchmark_${benchmarkName}_${i}.docx`,
            type: 'word',
            size: Math.random() * 1000000
          }));

          const result = await processor.processBatch(documents, {
            concurrency: 4,
            chunkSize: Math.min(10, benchmark.size)
          });

          assert.strictEqual(result.success, true);
          
          const perf = result.performance;
          results[benchmarkName] = {
            duration: perf.totalDuration,
            opsPerSec: perf.operationsPerSecond,
            peakMemory: perf.memoryUsage.peak
          };

          // Verify benchmarks
          assert.ok(perf.totalDuration < benchmark.maxDuration, 
            `${benchmarkName} took ${perf.totalDuration}ms, should be under ${benchmark.maxDuration}ms`);
          assert.ok(perf.operationsPerSecond >= benchmark.minOpsPerSec, 
            `${benchmarkName} achieved ${perf.operationsPerSecond.toFixed(2)} ops/sec, should be at least ${benchmark.minOpsPerSec}`);
          
          TestUtils.logProgress(`${benchmarkName}: ${perf.totalDuration}ms (${perf.operationsPerSecond.toFixed(2)} ops/sec) - ${perf.totalDuration < benchmark.maxDuration ? 'PASS' : 'FAIL'}`);
        }

        // Overall benchmark summary
        const totalOps = Object.values(benchmarks).reduce((sum, b) => sum + b.size, 0);
        const totalTime = Object.values(results).reduce((sum, r) => sum + r.duration, 0);
        const overallOpsPerSec = (totalOps / totalTime) * 1000;

        TestUtils.logProgress(`Overall benchmark: ${totalOps} documents in ${totalTime}ms (${overallOpsPerSec.toFixed(2)} ops/sec)`);
      });

      test('should demonstrate scalability', async () => {
        const sizes = [10, 25, 50, 100];
        const scalabilityResults = [];

        for (const size of sizes) {
          const documents = Array.from({ length: size }, (_, i) => ({
            name: `scale_test_${size}_${i}.docx`,
            type: 'word',
            size: Math.random() * 800000
          }));

          const result = await processor.processBatch(documents, {
            concurrency: 4,
            chunkSize: Math.min(10, size)
          });

          assert.strictEqual(result.success, true);
          
          scalabilityResults.push({
            size,
            duration: result.performance.totalDuration,
            avgDuration: result.performance.averageOpDuration,
            opsPerSec: result.performance.operationsPerSecond,
            memoryPeak: result.performance.memoryUsage.peak
          });
        }

        // Analyze scalability - duration should scale roughly linearly
        const baseline = scalabilityResults[0];
        const largest = scalabilityResults[scalabilityResults.length - 1];
        
        const sizeRatio = largest.size / baseline.size;
        const durationRatio = largest.duration / baseline.duration;
        
        TestUtils.logProgress(`Scalability: ${baseline.size}→${largest.size} docs (${sizeRatio}x), ${baseline.duration}→${largest.duration}ms (${durationRatio.toFixed(2)}x)`);
        
        // Duration ratio should be less than 2x the size ratio (indicating good scalability)
        assert.ok(durationRatio < sizeRatio * 2, `Poor scalability: duration grew ${durationRatio.toFixed(2)}x for ${sizeRatio}x more documents`);
        
        // Memory usage should scale reasonably
        const memoryRatio = largest.memoryPeak / baseline.memoryPeak;
        assert.ok(memoryRatio < sizeRatio * 1.5, `Memory usage scaled poorly: ${memoryRatio.toFixed(2)}x for ${sizeRatio}x more documents`);
      });
    });

    describe('Resource Management', () => {
      test('should clean up resources properly', async () => {
        const initialMemory = process.memoryUsage();
        
        // Process several batches
        for (let i = 0; i < 3; i++) {
          const documents = Array.from({ length: 20 }, (_, j) => ({
            name: `cleanup_test_${i}_${j}.docx`,
            type: 'word',
            size: Math.random() * 1000000
          }));

          await processor.processBatch(documents, {
            concurrency: 4,
            chunkSize: 5
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          await TestUtils.sleep(100);
        }

        const finalMemory = process.memoryUsage();
        const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

        TestUtils.logProgress(`Resource cleanup: ${initialMemory.heapUsed/1024/1024}MB → ${finalMemory.heapUsed/1024/1024}MB (${memoryGrowth.toFixed(1)}MB growth)`);

        // Memory growth should be reasonable after processing and cleanup
        assert.ok(memoryGrowth < 50, `Excessive memory growth: ${memoryGrowth.toFixed(1)}MB`);
      });
    });
  });
}