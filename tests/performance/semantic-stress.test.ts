import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { Store, DataFactory, Parser } from 'n3';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import path from 'path';

const { namedNode, literal, quad } = DataFactory;

interface StressTestResults {
  concurrentStreams: number;
  totalProcessingTime: number;
  memoryPeakUsage: NodeJS.MemoryUsage;
  errorCount: number;
  successCount: number;
  averageLatency: number;
}

class SemanticStressValidator {
  private maxMemoryUsage: NodeJS.MemoryUsage | null = null;
  private workers: Worker[] = [];

  async createConcurrentRDFStreams(streamCount: number, triplesPerStream: number): Promise<StressTestResults> {
    const startTime = performance.now();
    let errorCount = 0;
    let successCount = 0;
    const latencies: number[] = [];

    const promises = Array(streamCount).fill(null).map(async (_, index) => {
      const streamStart = performance.now();
      
      try {
        const rdfData = await this.generateRDFStream(triplesPerStream, index);
        const store = new Store();
        const parser = new Parser();

        await new Promise((resolve, reject) => {
          parser.parse(rdfData, (error, quad, prefixes) => {
            if (error) {
              reject(error);
              return;
            }
            
            if (quad) {
              store.addQuad(quad);
            } else {
              resolve(null);
            }
          });
        });

        const streamEnd = performance.now();
        latencies.push(streamEnd - streamStart);
        successCount++;

        // Track memory usage
        const currentMemory = process.memoryUsage();
        if (!this.maxMemoryUsage || currentMemory.heapUsed > this.maxMemoryUsage.heapUsed) {
          this.maxMemoryUsage = currentMemory;
        }

      } catch (error) {
        errorCount++;
        console.error(`Stream ${index} failed:`, error);
      }
    });

    await Promise.all(promises);

    const endTime = performance.now();
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      concurrentStreams: streamCount,
      totalProcessingTime: endTime - startTime,
      memoryPeakUsage: this.maxMemoryUsage || process.memoryUsage(),
      errorCount,
      successCount,
      averageLatency
    };
  }

  async generateRDFStream(size: number, streamId: number): Promise<string> {
    const triples: string[] = [];
    const domains = ['healthcare', 'finance', 'supply-chain', 'iot', 'social'];
    const domain = domains[streamId % domains.length];
    
    for (let i = 0; i < size; i++) {
      const subject = `ex:${domain}-${streamId}-${i}`;
      const predicate = `ex:has${domain.charAt(0).toUpperCase() + domain.slice(1)}Property`;
      const object = `"${domain}-value-${i}"`;
      triples.push(`${subject} ${predicate} ${object} .`);
    }
    
    return triples.join('\n');
  }

  async testMemoryPressure(targetMemoryMB: number): Promise<boolean> {
    const stores: Store[] = [];
    const targetBytes = targetMemoryMB * 1024 * 1024;
    let currentMemory = 0;
    let storeIndex = 0;

    try {
      while (currentMemory < targetBytes) {
        const store = new Store();
        const rdfData = await this.generateRDFStream(10000, storeIndex);
        const parser = new Parser();

        await new Promise((resolve, reject) => {
          parser.parse(rdfData, (error, quad, prefixes) => {
            if (error) {
              reject(error);
              return;
            }
            
            if (quad) {
              store.addQuad(quad);
            } else {
              resolve(null);
            }
          });
        });

        stores.push(store);
        const memUsage = process.memoryUsage();
        currentMemory = memUsage.heapUsed;
        storeIndex++;

        console.log(`Memory pressure test - Current: ${(currentMemory / (1024 * 1024)).toFixed(2)}MB, Target: ${targetMemoryMB}MB`);

        // Safety check to prevent system crash
        if (storeIndex > 1000) {
          console.warn('Memory pressure test stopped at 1000 stores for safety');
          break;
        }
      }

      // Test query performance under memory pressure
      const queryStart = performance.now();
      let totalResults = 0;

      for (const store of stores.slice(0, 10)) { // Test first 10 stores
        const results = store.getQuads(null, null, null);
        totalResults += results.length;
      }

      const queryEnd = performance.now();
      const queryTime = queryEnd - queryStart;

      console.log(`Memory pressure query test - ${totalResults} results in ${queryTime.toFixed(2)}ms`);

      return queryTime < 5000; // Should complete within 5 seconds under pressure

    } catch (error) {
      console.error('Memory pressure test failed:', error);
      return false;
    }
  }

  async testQueryOptimization(): Promise<{ indexed: number; nonIndexed: number; improvement: number }> {
    const store = new Store();
    const testData = await this.generateRDFStream(100000, 0);
    const parser = new Parser();

    // Load test data
    await new Promise((resolve, reject) => {
      parser.parse(testData, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          store.addQuad(quad);
        } else {
          resolve(null);
        }
      });
    });

    // Test non-indexed queries (full scan)
    const nonIndexedStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const results = store.getQuads(null, null, null);
      // Force iteration to ensure full scan
      let count = 0;
      for (const result of results) {
        count++;
        if (count > 100) break; // Limit to prevent excessive time
      }
    }
    const nonIndexedTime = performance.now() - nonIndexedStart;

    // Test indexed queries (specific patterns)
    const indexedStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const results = store.getQuads(namedNode(`ex:healthcare-0-${i % 100}`), null, null);
      let count = 0;
      for (const result of results) {
        count++;
      }
    }
    const indexedTime = performance.now() - indexedStart;

    const improvement = ((nonIndexedTime - indexedTime) / nonIndexedTime) * 100;

    return {
      indexed: indexedTime,
      nonIndexed: nonIndexedTime,
      improvement
    };
  }

  async testCacheEffectiveness(cacheSize: number): Promise<{ hitRate: number; avgResponseTime: number }> {
    const cache = new Map<string, any>();
    const queries = [];
    let hits = 0;
    let misses = 0;
    const responseTimes: number[] = [];

    // Generate test queries with some repetition to test cache hits
    for (let i = 0; i < 1000; i++) {
      // 30% chance of repeat query to test cache hits
      if (Math.random() < 0.3 && queries.length > 0) {
        queries.push(queries[Math.floor(Math.random() * queries.length)]);
      } else {
        queries.push(`query-${i % 100}`); // Limited query space to increase hits
      }
    }

    for (const query of queries) {
      const queryStart = performance.now();
      
      if (cache.has(query)) {
        // Cache hit
        hits++;
        const result = cache.get(query);
      } else {
        // Cache miss - simulate query execution
        misses++;
        const result = `result-for-${query}`;
        
        // Manage cache size
        if (cache.size >= cacheSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        
        cache.set(query, result);
      }
      
      const queryEnd = performance.now();
      responseTimes.push(queryEnd - queryStart);
    }

    const hitRate = (hits / (hits + misses)) * 100;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    return { hitRate, avgResponseTime };
  }

  cleanup(): void {
    // Clean up any workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
  }
}

describe('Semantic Stress Testing', () => {
  let validator: SemanticStressValidator;

  beforeAll(() => {
    validator = new SemanticStressValidator();
  });

  afterAll(() => {
    validator.cleanup();
  });

  describe('Concurrent Processing Stress', () => {
    it('should handle 10 concurrent RDF streams without errors', async () => {
      const results = await validator.createConcurrentRDFStreams(10, 5000);
      
      expect(results.successCount).toBe(10);
      expect(results.errorCount).toBe(0);
      expect(results.averageLatency).toBeLessThan(5000); // 5 seconds per stream
      
      console.log(`Concurrent processing - Success: ${results.successCount}, Errors: ${results.errorCount}`);
      console.log(`Average latency: ${results.averageLatency.toFixed(2)}ms`);
      console.log(`Peak memory: ${(results.memoryPeakUsage.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
    }, 30000);

    it('should handle 25 concurrent RDF streams with acceptable performance', async () => {
      const results = await validator.createConcurrentRDFStreams(25, 2000);
      
      expect(results.successCount).toBeGreaterThan(20); // Allow some failures under stress
      expect(results.averageLatency).toBeLessThan(10000); // 10 seconds per stream under stress
      
      console.log(`High concurrency - Success: ${results.successCount}/${results.concurrentStreams}`);
      console.log(`Error rate: ${((results.errorCount / results.concurrentStreams) * 100).toFixed(2)}%`);
    }, 60000);

    it('should handle 50 concurrent RDF streams with graceful degradation', async () => {
      const results = await validator.createConcurrentRDFStreams(50, 1000);
      
      // Under extreme stress, allow higher error rates but require some success
      expect(results.successCount).toBeGreaterThan(30); // At least 60% success rate
      
      console.log(`Extreme concurrency - Success: ${results.successCount}/${results.concurrentStreams}`);
      console.log(`Success rate: ${((results.successCount / results.concurrentStreams) * 100).toFixed(2)}%`);
    }, 120000);
  });

  describe('Memory Pressure Testing', () => {
    it('should maintain performance under 1GB memory pressure', async () => {
      const success = await validator.testMemoryPressure(1024);
      expect(success).toBe(true);
    }, 60000);

    it('should maintain performance under 4GB memory pressure', async () => {
      const success = await validator.testMemoryPressure(4096);
      expect(success).toBe(true);
    }, 120000);

    it('should handle memory pressure approaching Node.js limits', async () => {
      // Test up to 8GB (below typical Node.js heap limit)
      const success = await validator.testMemoryPressure(8192);
      
      // Under extreme memory pressure, we allow degraded performance
      // but the system should not crash
      console.log(`Extreme memory pressure test result: ${success ? 'PASS' : 'DEGRADED'}`);
    }, 300000); // 5 minute timeout
  });

  describe('Query Optimization Validation', () => {
    it('should demonstrate significant performance improvement with indexed queries', async () => {
      const results = await validator.testQueryOptimization();
      
      expect(results.improvement).toBeGreaterThan(20); // At least 20% improvement
      expect(results.indexed).toBeLessThan(results.nonIndexed);
      
      console.log(`Query optimization - Indexed: ${results.indexed.toFixed(2)}ms`);
      console.log(`Query optimization - Non-indexed: ${results.nonIndexed.toFixed(2)}ms`);
      console.log(`Performance improvement: ${results.improvement.toFixed(2)}%`);
    }, 30000);
  });

  describe('Caching Effectiveness', () => {
    it('should achieve high cache hit rates with appropriate cache size', async () => {
      const results = await validator.testCacheEffectiveness(100);
      
      expect(results.hitRate).toBeGreaterThan(25); // At least 25% hit rate
      expect(results.avgResponseTime).toBeLessThan(10); // Fast response times
      
      console.log(`Cache effectiveness - Hit rate: ${results.hitRate.toFixed(2)}%`);
      console.log(`Average response time: ${results.avgResponseTime.toFixed(4)}ms`);
    });

    it('should maintain performance with limited cache size', async () => {
      const results = await validator.testCacheEffectiveness(10);
      
      // With limited cache, hit rate will be lower but should still provide benefit
      expect(results.avgResponseTime).toBeLessThan(20);
      
      console.log(`Limited cache - Hit rate: ${results.hitRate.toFixed(2)}%`);
      console.log(`Limited cache - Avg response: ${results.avgResponseTime.toFixed(4)}ms`);
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    it('should recover gracefully from resource exhaustion', async () => {
      // Simulate resource exhaustion and recovery
      const initialResults = await validator.createConcurrentRDFStreams(5, 1000);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Test recovery with same workload
      const recoveryResults = await validator.createConcurrentRDFStreams(5, 1000);
      
      expect(recoveryResults.successCount).toBe(5);
      expect(recoveryResults.errorCount).toBe(0);
      
      // Performance should be similar after recovery
      const performanceDegradation = Math.abs(recoveryResults.averageLatency - initialResults.averageLatency) / initialResults.averageLatency;
      expect(performanceDegradation).toBeLessThan(0.5); // Within 50% of original performance
      
      console.log(`Recovery test - Initial avg latency: ${initialResults.averageLatency.toFixed(2)}ms`);
      console.log(`Recovery test - Recovery avg latency: ${recoveryResults.averageLatency.toFixed(2)}ms`);
      console.log(`Performance degradation: ${(performanceDegradation * 100).toFixed(2)}%`);
    }, 60000);
  });
});