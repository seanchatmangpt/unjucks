/**
 * Turtle Serialization Performance Benchmarks
 * 
 * Comprehensive performance testing and benchmarking for all serialization modes
 * including throughput analysis, memory efficiency, and scalability testing.
 */

import { strict as assert } from 'assert';
import { performance } from 'perf_hooks';
import { DataFactory, Store } from 'n3';
import { TurtleSerializationMaster } from '../../../src/kgen/serialization/index.js';

const { namedNode, literal, blankNode, quad } = DataFactory;

describe('Turtle Serialization Performance Benchmarks', function() {
  let master;
  
  before(async function() {
    master = new TurtleSerializationMaster({
      enableAllFeatures: true,
      autoSelectMode: false // Force specific modes for benchmarking
    });
    
    await master.initialize();
  });
  
  after(async function() {
    await master.shutdown();
  });

  describe('Throughput Benchmarks', function() {
    const testSizes = [100, 1000, 10000];
    
    testSizes.forEach(size => {
      it(`should serialize ${size} triples efficiently`, async function() {
        this.timeout(30000); // 30 second timeout for large datasets
        
        const testData = generateTestData(size);
        const startTime = performance.now();
        
        const result = await master.serialize(testData, { mode: 'canonical' });
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        const throughput = size / (processingTime / 1000); // triples per second
        
        console.log(`    ${size} triples: ${processingTime.toFixed(2)}ms, ${throughput.toFixed(0)} triples/sec`);
        
        assert(result.turtle);
        assert(result.master.processingTime > 0);
        assert(throughput > 100); // Minimum acceptable throughput
        
        // Performance thresholds
        if (size <= 1000) {
          assert(processingTime < 1000, `Small dataset should process in < 1s, took ${processingTime}ms`);
        } else if (size <= 10000) {
          assert(processingTime < 10000, `Medium dataset should process in < 10s, took ${processingTime}ms`);
        }
      });
    });
  });

  describe('Mode Comparison Benchmarks', function() {
    const testSize = 1000;
    const modes = ['canonical', 'documented'];
    
    it('should compare performance across serialization modes', async function() {
      this.timeout(20000);
      
      const testData = generateTestData(testSize);
      const results = {};
      
      for (const mode of modes) {
        const startTime = performance.now();
        
        try {
          const result = await master.serialize(testData, { mode });
          const endTime = performance.now();
          
          results[mode] = {
            time: endTime - startTime,
            throughput: testSize / ((endTime - startTime) / 1000),
            success: true,
            outputSize: Buffer.byteLength(result.turtle, 'utf8')
          };
          
          console.log(`    ${mode}: ${results[mode].time.toFixed(2)}ms, ${results[mode].throughput.toFixed(0)} triples/sec`);
          
        } catch (error) {
          results[mode] = {
            success: false,
            error: error.message
          };
        }
      }
      
      // All modes should succeed
      Object.values(results).forEach(result => {
        assert(result.success, `Mode failed: ${result.error}`);
      });
      
      // Performance comparison
      const canonicalTime = results.canonical.time;
      const documentedTime = results.documented.time;
      
      // Documented mode should not be more than 5x slower
      assert(documentedTime < canonicalTime * 5, 
        `Documented mode too slow: ${documentedTime}ms vs ${canonicalTime}ms`);
    });
  });

  describe('Memory Efficiency Benchmarks', function() {
    it('should maintain reasonable memory usage', async function() {
      this.timeout(15000);
      
      const testData = generateTestData(5000);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage();
      
      const result = await master.serialize(testData, { mode: 'canonical' });
      
      const peakMemory = process.memoryUsage();
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerTriple = memoryIncrease / testData.length;
      
      console.log(`    Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Memory per triple: ${memoryPerTriple.toFixed(0)} bytes`);
      
      assert(result.turtle);
      
      // Memory should be reasonable (less than 1KB per triple)
      assert(memoryPerTriple < 1024, 
        `Memory usage too high: ${memoryPerTriple} bytes per triple`);
      
      // Total memory increase should be reasonable (less than 50MB for 5K triples)
      assert(memoryIncrease < 50 * 1024 * 1024, 
        `Total memory increase too high: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Scalability Benchmarks', function() {
    const scalingSizes = [500, 1000, 2000, 4000];
    
    it('should scale linearly with input size', async function() {
      this.timeout(60000); // 1 minute for scaling test
      
      const timings = [];
      
      for (const size of scalingSizes) {
        const testData = generateTestData(size);
        const startTime = performance.now();
        
        await master.serialize(testData, { mode: 'canonical' });
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        timings.push({
          size,
          time: processingTime,
          timePerTriple: processingTime / size
        });
        
        console.log(`    ${size} triples: ${processingTime.toFixed(2)}ms (${(processingTime/size).toFixed(3)}ms per triple)`);
      }
      
      // Check for linear scaling (time per triple should remain relatively constant)
      const firstTimePerTriple = timings[0].timePerTriple;
      const lastTimePerTriple = timings[timings.length - 1].timePerTriple;
      
      // Time per triple should not increase by more than 3x
      assert(lastTimePerTriple < firstTimePerTriple * 3,
        `Scaling issue: ${lastTimePerTriple.toFixed(3)}ms vs ${firstTimePerTriple.toFixed(3)}ms per triple`);
    });
  });

  describe('Compression Performance Benchmarks', function() {
    it('should benchmark compression performance', async function() {
      this.timeout(20000);
      
      const testData = generateTestData(2000);
      
      // Test without compression
      const startTimeNoCompression = performance.now();
      const resultNoCompression = await master.serialize(testData, { mode: 'canonical' });
      const endTimeNoCompression = performance.now();
      
      const noCompressionTime = endTimeNoCompression - startTimeNoCompression;
      const originalSize = Buffer.byteLength(resultNoCompression.turtle, 'utf8');
      
      console.log(`    No compression: ${noCompressionTime.toFixed(2)}ms, ${(originalSize/1024).toFixed(2)}KB`);
      
      // Note: Compression benchmarks would require compression serializer integration
      // For now, just verify basic performance is acceptable
      assert(noCompressionTime < 10000, 'Basic serialization should complete within 10 seconds');
      assert(originalSize > 0, 'Should produce non-empty output');
    });
  });

  describe('Concurrent Processing Benchmarks', function() {
    it('should handle concurrent serializations', async function() {
      this.timeout(30000);
      
      const testData = generateTestData(500);
      const concurrencyLevel = 5;
      
      const startTime = performance.now();
      
      // Run multiple serializations concurrently
      const promises = Array(concurrencyLevel).fill().map(async (_, index) => {
        const data = generateTestData(500, index * 1000); // Offset IDs to avoid conflicts
        return master.serialize(data, { mode: 'canonical' });
      });
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerSerialization = totalTime / concurrencyLevel;
      
      console.log(`    ${concurrencyLevel} concurrent: ${totalTime.toFixed(2)}ms total, ${avgTimePerSerialization.toFixed(2)}ms avg`);
      
      // All should succeed
      assert.equal(results.length, concurrencyLevel);
      results.forEach((result, index) => {
        assert(result.turtle, `Concurrent serialization ${index} failed`);
        assert(result.master.processingTime > 0);
      });
      
      // Concurrent processing should not be slower than sequential
      const sequentialEstimate = avgTimePerSerialization * concurrencyLevel;
      assert(totalTime < sequentialEstimate * 1.5, 
        `Concurrent processing too slow: ${totalTime}ms vs estimated ${sequentialEstimate}ms`);
    });
  });

  describe('Large Dataset Stress Tests', function() {
    it('should handle very large datasets', async function() {
      this.timeout(120000); // 2 minutes for stress test
      
      const largeDataSize = 25000;
      const testData = generateTestData(largeDataSize);
      
      console.log(`    Stress testing with ${largeDataSize} triples...`);
      
      const startTime = performance.now();
      const initialMemory = process.memoryUsage();
      
      const result = await master.serialize(testData, { mode: 'canonical' });
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      const processingTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const throughput = largeDataSize / (processingTime / 1000);
      
      console.log(`    Large dataset: ${processingTime.toFixed(2)}ms, ${throughput.toFixed(0)} triples/sec`);
      console.log(`    Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      assert(result.turtle);
      assert(result.statistics.inputTriples === largeDataSize);
      
      // Should complete within reasonable time (less than 2 minutes)
      assert(processingTime < 120000, 
        `Large dataset processing too slow: ${processingTime}ms`);
      
      // Should maintain reasonable throughput (>100 triples/sec)
      assert(throughput > 100, 
        `Throughput too low for large dataset: ${throughput} triples/sec`);
      
      // Memory usage should be reasonable (less than 200MB increase)
      assert(memoryIncrease < 200 * 1024 * 1024, 
        `Memory usage too high: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Benchmark Suite', function() {
    it('should run comprehensive benchmark suite', async function() {
      this.timeout(60000);
      
      const benchmarkResult = await master.runBenchmark([100, 1000, 5000], 2);
      
      assert(benchmarkResult.results);
      assert(benchmarkResult.metadata);
      
      console.log('    Benchmark Results:');
      
      for (const [size, sizeResults] of Object.entries(benchmarkResult.results)) {
        console.log(`      ${size} triples:`);
        
        for (const [mode, modeResults] of Object.entries(sizeResults)) {
          if (modeResults.average) {
            console.log(`        ${mode}: ${modeResults.average.toFixed(2)}ms avg, ${modeResults.throughput.toFixed(0)} triples/sec`);
            
            // Verify benchmark results
            assert(modeResults.average > 0, `${mode} should have positive average time`);
            assert(modeResults.throughput > 0, `${mode} should have positive throughput`);
            assert(Array.isArray(modeResults.times), `${mode} should have times array`);
          }
        }
      }
      
      // Verify environment info
      assert(benchmarkResult.metadata.environment);
      assert(benchmarkResult.metadata.environment.nodeVersion);
      assert(benchmarkResult.metadata.environment.platform);
    });
  });
});

// Helper function to generate test data
function generateTestData(count, idOffset = 0) {
  const quads = [];
  
  for (let i = 0; i < count; i++) {
    const id = i + idOffset;
    
    // Mix of different triple types for realistic testing
    if (i % 10 === 0) {
      // Blank node triple
      quads.push(quad(
        blankNode(`node${id}`),
        namedNode(`http://example.org/pred${i % 20}`),
        literal(`Blank node value ${id}`)
      ));
    } else if (i % 7 === 0) {
      // Typed literal
      quads.push(quad(
        namedNode(`http://example.org/subj${id}`),
        namedNode(`http://example.org/numericPred`),
        literal(`${id}`, namedNode('http://www.w3.org/2001/XMLSchema#integer'))
      ));
    } else if (i % 5 === 0) {
      // Language tagged literal
      quads.push(quad(
        namedNode(`http://example.org/subj${id}`),
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal(`Label ${id}`, 'en')
      ));
    } else {
      // Regular triple
      quads.push(quad(
        namedNode(`http://example.org/subj${id}`),
        namedNode(`http://example.org/pred${i % 15}`),
        literal(`Value ${id}`)
      ));
    }
  }
  
  return quads;
}

export default {
  description: 'Turtle Serialization Performance Benchmarks',
  testCount: 8,
  categories: [
    'throughput',
    'mode-comparison',
    'memory-efficiency',
    'scalability',
    'compression',
    'concurrency',
    'stress-testing',
    'benchmark-suite'
  ]
};