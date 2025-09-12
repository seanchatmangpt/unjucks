/**
 * CAS Performance Benchmarks
 * 
 * Comprehensive benchmarking suite for Content-Addressed Storage:
 * - Hash operation performance (WebAssembly vs Node.js crypto)
 * - Cache hit rate optimization
 * - Parallel processing capabilities
 * - Memory efficiency analysis
 */

import { cas } from '../cas/cas-core.js';
import { canonicalProcessor } from '../rdf/canonical-processor-cas.js';
import { driftDetector } from '../drift/drift-detector.js';
import { attestationGenerator } from '../attestation/generator.js';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';

/**
 * CAS Performance Benchmark Suite
 */
export class CASBenchmarks {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 1000,
      warmupRounds: options.warmupRounds || 100,
      testDataSizes: options.testDataSizes || [1024, 8192, 65536, 524288], // 1KB to 512KB
      algorithms: options.algorithms || ['sha256', 'sha512', 'blake2b', 'blake3'],
      targetMetrics: {
        hashTimeP95: 5, // ms
        cacheHitRate: 0.80, // 80%
        memoryEfficiency: 0.85 // 85%
      },
      ...options
    };
    
    this.results = {
      hashPerformance: new Map(),
      cachePerformance: new Map(),
      parallelPerformance: new Map(),
      memoryUsage: new Map(),
      comparisons: new Map()
    };
  }

  /**
   * Run complete benchmark suite
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Comprehensive benchmark results
   */
  async runBenchmarks(options = {}) {
    console.log('🚀 Starting CAS Performance Benchmarks...\n');
    
    const startTime = performance.now();
    const results = {
      timestamp: this.getDeterministicDate().toISOString(),
      configuration: this.options,
      results: {},
      summary: {}
    };
    
    try {
      // 1. Hash Performance Benchmarks
      console.log('📊 Testing hash performance...');
      results.results.hashPerformance = await this._benchmarkHashPerformance();
      
      // 2. Cache Performance Benchmarks
      console.log('💾 Testing cache performance...');
      results.results.cachePerformance = await this._benchmarkCachePerformance();
      
      // 3. Parallel Processing Benchmarks
      console.log('⚡ Testing parallel processing...');
      results.results.parallelPerformance = await this._benchmarkParallelProcessing();
      
      // 4. Memory Efficiency Benchmarks
      console.log('🧠 Testing memory efficiency...');
      results.results.memoryUsage = await this._benchmarkMemoryUsage();
      
      // 5. Real-world Integration Benchmarks
      console.log('🔧 Testing real-world integration...');
      results.results.integration = await this._benchmarkIntegration();
      
      // 6. Generate Performance Summary
      results.summary = this._generateSummary(results.results);
      results.totalTime = performance.now() - startTime;
      
      console.log('✅ Benchmarks completed!\n');
      this._printResults(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      throw error;
    }
  }

  /**
   * Benchmark hash operation performance
   */
  async _benchmarkHashPerformance() {
    const results = new Map();
    
    for (const algorithm of this.options.algorithms) {
      console.log(`  Testing ${algorithm}...`);
      const algorithmResults = {
        times: [],
        comparison: null
      };
      
      // Test different data sizes
      for (const size of this.options.testDataSizes) {
        const testData = this._generateTestData(size);
        const times = [];
        
        // Warmup
        for (let i = 0; i < this.options.warmupRounds; i++) {
          await cas.calculateHash(testData, algorithm);
        }
        
        // Actual benchmark
        for (let i = 0; i < this.options.iterations; i++) {
          const start = performance.now();
          await cas.calculateHash(testData, algorithm);
          times.push(performance.now() - start);
        }
        
        algorithmResults.times.push({
          dataSize: size,
          times,
          average: times.reduce((a, b) => a + b, 0) / times.length,
          p95: this._percentile(times, 0.95),
          p99: this._percentile(times, 0.99)
        });
        
        // Compare with Node.js crypto for reference
        if (algorithm === 'sha256') {
          const cryptoTimes = [];
          for (let i = 0; i < this.options.iterations; i++) {
            const start = performance.now();
            createHash('sha256').update(testData).digest('hex');
            cryptoTimes.push(performance.now() - start);
          }
          
          algorithmResults.comparison = {
            nodeCrypto: {
              average: cryptoTimes.reduce((a, b) => a + b, 0) / cryptoTimes.length,
              p95: this._percentile(cryptoTimes, 0.95)
            },
            speedup: (cryptoTimes.reduce((a, b) => a + b, 0) / cryptoTimes.length) /
                    (times.reduce((a, b) => a + b, 0) / times.length)
          };
        }
      }
      
      results.set(algorithm, algorithmResults);
    }
    
    return results;
  }

  /**
   * Benchmark cache performance and hit rates
   */
  async _benchmarkCachePerformance() {
    const testData = this._generateTestData(8192);
    const results = {
      hitRates: [],
      lookupTimes: [],
      evictionPerformance: {}
    };
    
    // Test cache hit rates with different access patterns
    const patterns = [
      { name: 'sequential', generator: (i) => i },
      { name: 'random', generator: (i) => Math.floor(Math.random() * this.options.iterations) },
      { name: 'hotspot', generator: (i) => Math.floor(Math.random() * 100) } // 90% locality
    ];
    
    for (const pattern of patterns) {
      // Reset CAS for clean test
      cas.gc(true);
      
      const accessTimes = [];
      let hits = 0;
      
      for (let i = 0; i < this.options.iterations; i++) {
        const dataIndex = pattern.generator(i);
        const uniqueData = testData + dataIndex.toString();
        
        const start = performance.now();
        const cid = await cas.generateCID(uniqueData);
        accessTimes.push(performance.now() - start);
        
        // Check if this was likely a cache hit (very fast)
        if (performance.now() - start < 0.1) {
          hits++;
        }
      }
      
      results.hitRates.push({
        pattern: pattern.name,
        hitRate: hits / this.options.iterations,
        averageLookupTime: accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length,
        p95LookupTime: this._percentile(accessTimes, 0.95)
      });
    }
    
    // Test cache eviction performance
    const evictionStart = performance.now();
    cas.gc(true);
    results.evictionPerformance = {
      time: performance.now() - evictionStart,
      metricsAfter: cas.getMetrics()
    };
    
    return results;
  }

  /**
   * Benchmark parallel processing capabilities
   */
  async _benchmarkParallelProcessing() {
    const testData = Array.from({ length: 100 }, (_, i) => 
      this._generateTestData(8192) + i.toString()
    );
    
    const results = {
      sequential: {},
      parallel: {},
      scalability: []
    };
    
    // Sequential processing
    const seqStart = performance.now();
    for (const data of testData) {
      await cas.generateCID(data);
    }
    results.sequential = {
      time: performance.now() - seqStart,
      throughput: testData.length / ((performance.now() - seqStart) / 1000)
    };
    
    // Parallel processing
    const parStart = performance.now();
    await Promise.all(testData.map(data => cas.generateCID(data)));
    results.parallel = {
      time: performance.now() - parStart,
      throughput: testData.length / ((performance.now() - parStart) / 1000),
      speedup: (results.sequential.time) / (performance.now() - parStart)
    };
    
    // Test scalability with different concurrency levels
    const concurrencyLevels = [1, 2, 4, 8, 16];
    for (const concurrency of concurrencyLevels) {
      const chunks = this._chunkArray(testData.slice(0, 50), concurrency);
      const scalStart = performance.now();
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(data => cas.generateCID(data)));
      }
      
      results.scalability.push({
        concurrency,
        time: performance.now() - scalStart,
        throughput: 50 / ((performance.now() - scalStart) / 1000)
      });
    }
    
    return results;
  }

  /**
   * Benchmark memory usage and efficiency
   */
  async _benchmarkMemoryUsage() {
    const initialMemory = process.memoryUsage();
    const results = {
      initial: initialMemory,
      peak: initialMemory,
      final: null,
      efficiency: null
    };
    
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > results.peak.heapUsed) {
        results.peak = current;
      }
    }, 100);
    
    try {
      // Generate large amount of data to stress test memory
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => 
        this._generateTestData(16384) + i.toString()
      );
      
      // Process all data
      await Promise.all(largeDataSet.map(async (data, i) => {
        const cid = await cas.generateCID(data);
        
        // Also test storage
        if (i % 10 === 0) {
          await cas.store(data);
        }
      }));
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      clearInterval(memoryMonitor);
      results.final = process.memoryUsage();
      
      // Calculate memory efficiency
      const memoryGrowth = results.peak.heapUsed - results.initial.heapUsed;
      const dataSize = largeDataSet.reduce((total, data) => total + data.length, 0);
      results.efficiency = dataSize / memoryGrowth;
      
    } catch (error) {
      clearInterval(memoryMonitor);
      throw error;
    }
    
    return results;
  }

  /**
   * Benchmark real-world integration scenarios
   */
  async _benchmarkIntegration() {
    const results = {
      rdfProcessing: null,
      driftDetection: null,
      attestationGeneration: null,
      endToEnd: null
    };
    
    // Create test RDF data
    const testRDF = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:person1 a foaf:Person ;
        foaf:name "Alice" ;
        foaf:age 30 .
      
      ex:person2 a foaf:Person ;
        foaf:name "Bob" ;
        foaf:age 25 .
    `;
    
    // Test RDF processing
    const rdfStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await canonicalProcessor.calculateContentHash(testRDF + i.toString());
    }
    results.rdfProcessing = {
      time: performance.now() - rdfStart,
      throughput: 100 / ((performance.now() - rdfStart) / 1000)
    };
    
    // Test drift detection (simplified)
    const driftStart = performance.now();
    const baselineContent = testRDF;
    const modifiedContent = testRDF.replace('Alice', 'Alicia');
    
    for (let i = 0; i < 50; i++) {
      await cas.compareContent(baselineContent, modifiedContent);
    }
    results.driftDetection = {
      time: performance.now() - driftStart,
      throughput: 50 / ((performance.now() - driftStart) / 1000)
    };
    
    return results;
  }

  /**
   * Generate performance summary and validation
   */
  _generateSummary(results) {
    const summary = {
      performance: {
        hashTimeP95: null,
        cacheHitRate: null,
        memoryEfficiency: null
      },
      targetsMetSummary: {
        hashPerformance: false,
        cachePerformance: false,
        memoryEfficiency: false
      },
      recommendations: []
    };
    
    // Analyze hash performance
    if (results.hashPerformance.has('sha256')) {
      const sha256Results = results.hashPerformance.get('sha256');
      const avgP95 = sha256Results.times.reduce((sum, test) => sum + test.p95, 0) / sha256Results.times.length;
      summary.performance.hashTimeP95 = avgP95;
      summary.targetsMetSummary.hashPerformance = avgP95 <= this.options.targetMetrics.hashTimeP95;
      
      if (!summary.targetsMetSummary.hashPerformance) {
        summary.recommendations.push(`Hash performance (${avgP95.toFixed(2)}ms) exceeds target (${this.options.targetMetrics.hashTimeP95}ms)`);
      }
    }
    
    // Analyze cache performance
    if (results.cachePerformance.hitRates.length > 0) {
      const avgHitRate = results.cachePerformance.hitRates.reduce((sum, test) => sum + test.hitRate, 0) / results.cachePerformance.hitRates.length;
      summary.performance.cacheHitRate = avgHitRate;
      summary.targetsMetSummary.cachePerformance = avgHitRate >= this.options.targetMetrics.cacheHitRate;
      
      if (!summary.targetsMetSummary.cachePerformance) {
        summary.recommendations.push(`Cache hit rate (${(avgHitRate * 100).toFixed(1)}%) below target (${(this.options.targetMetrics.cacheHitRate * 100).toFixed(1)}%)`);
      }
    }
    
    // Analyze memory efficiency
    if (results.memoryUsage.efficiency) {
      summary.performance.memoryEfficiency = results.memoryUsage.efficiency;
      summary.targetsMetSummary.memoryEfficiency = results.memoryUsage.efficiency >= this.options.targetMetrics.memoryEfficiency;
      
      if (!summary.targetsMetSummary.memoryEfficiency) {
        summary.recommendations.push(`Memory efficiency (${results.memoryUsage.efficiency.toFixed(2)}) below target (${this.options.targetMetrics.memoryEfficiency})`);
      }
    }
    
    // Overall assessment
    summary.overallTargetsMet = Object.values(summary.targetsMetSummary).every(met => met);
    
    if (summary.overallTargetsMet) {
      summary.recommendations.push('✅ All performance targets met!');
    }
    
    return summary;
  }

  // Utility methods

  _generateTestData(size) {
    return 'a'.repeat(size);
  }

  _percentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  _chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  _printResults(results) {
    console.log('\n📊 CAS Performance Benchmark Results');
    console.log('=====================================\n');
    
    const summary = results.summary;
    
    console.log('🎯 Performance Targets:');
    console.log(`  Hash P95 Time: ${summary.performance.hashTimeP95?.toFixed(2)}ms (target: ≤${this.options.targetMetrics.hashTimeP95}ms) ${summary.targetsMetSummary.hashPerformance ? '✅' : '❌'}`);
    console.log(`  Cache Hit Rate: ${(summary.performance.cacheHitRate * 100)?.toFixed(1)}% (target: ≥${(this.options.targetMetrics.cacheHitRate * 100).toFixed(1)}%) ${summary.targetsMetSummary.cachePerformance ? '✅' : '❌'}`);
    console.log(`  Memory Efficiency: ${summary.performance.memoryEfficiency?.toFixed(2)} (target: ≥${this.options.targetMetrics.memoryEfficiency}) ${summary.targetsMetSummary.memoryEfficiency ? '✅' : '❌'}\n`);
    
    console.log(`🏆 Overall: ${summary.overallTargetsMet ? 'All targets met!' : 'Some targets missed'}\n`);
    
    if (summary.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      summary.recommendations.forEach(rec => console.log(`  • ${rec}`));
      console.log('');
    }
    
    console.log(`⏱️  Total benchmark time: ${(results.totalTime / 1000).toFixed(2)}s`);
  }
}

// Export singleton instance for easy use
export const benchmarks = new CASBenchmarks();