/**
 * Performance Benchmark Tests for KGEN Core
 * Validates performance characteristics and scaling behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('KGEN Performance Benchmarks', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await global.testUtils.createTempDir();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTempDir(tempDir);
  });

  describe('RDF Processing Performance', () => {
    it('should process small graphs efficiently', async () => {
      const operation = async () => {
        const rdf = global.testUtils.createSampleRDF('Person', 'Test Person', {
          email: 'test@example.com',
          department: 'Engineering'
        });
        return global.testUtils.calculateHash(rdf);
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 10);

      expect(perfStats.successfulIterations).toBe(10);
      expect(perfStats.averageDuration).toBeLessThan(50); // < 50ms
      expect(perfStats.standardDeviation / perfStats.averageDuration).toBeLessThan(0.3); // CV < 30%
    });

    it('should scale linearly with graph size', async () => {
      const sizes = [10, 50, 100, 200];
      const results = [];

      for (const size of sizes) {
        const operation = async () => {
          const entities = Array.from({ length: size }, (_, i) => 
            global.testUtils.createSampleRDF('Entity', `Entity${i}`, { index: i })
          ).join('\n\n');
          
          return global.testUtils.calculateHash(entities);
        };

        const perfStats = await global.testUtils.measurePerformance(operation, 5);
        results.push({
          size,
          averageDuration: perfStats.averageDuration,
          memoryUsage: perfStats.averageMemoryUsage
        });
      }

      // Verify scaling characteristics
      expect(results[1].averageDuration).toBeGreaterThan(results[0].averageDuration);
      expect(results[2].averageDuration).toBeGreaterThan(results[1].averageDuration);
      expect(results[3].averageDuration).toBeGreaterThan(results[2].averageDuration);

      // Should maintain reasonable performance
      expect(results[3].averageDuration).toBeLessThan(500); // < 500ms for 200 entities
    });

    it('should handle complex graphs within time limits', async () => {
      const operation = async () => {
        const complexGraph = global.testUtils.createComplexRDFGraph();
        
        // Simulate complex processing
        const processed = complexGraph
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('@'))
          .sort()
          .join('\n');
          
        return global.testUtils.calculateHash(processed);
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageDuration).toBeLessThan(100); // < 100ms
      expect(perfStats.failedIterations).toBe(0);
    });

    it('should maintain consistent performance across iterations', async () => {
      const rdf = global.testUtils.createComplexRDFGraph();
      
      const operation = async () => {
        // Simulate multiple processing steps
        const hash1 = global.testUtils.calculateHash(rdf);
        const hash2 = global.testUtils.calculateHash(hash1);
        return hash2;
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 20);

      expect(perfStats.successfulIterations).toBe(20);
      
      // Performance should be consistent (CV < 40%)
      const cv = perfStats.standardDeviation / perfStats.averageDuration;
      expect(cv).toBeLessThan(0.4);
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should maintain stable memory usage', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;
      
      // Process multiple operations
      for (let i = 0; i < 50; i++) {
        const rdf = global.testUtils.createSampleRDF('Entity', `Entity${i}`);
        global.testUtils.calculateHash(rdf);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Should not have significant memory accumulation
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // < 5MB
    });

    it('should handle memory-intensive operations efficiently', async () => {
      const operation = async () => {
        // Create large temporary data structures
        const largeData = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: `data-${i}`.repeat(10),
          timestamp: new Date().toISOString()
        }));
        
        const hash = global.testUtils.calculateHash(largeData);
        
        // Clear reference to allow GC
        largeData.length = 0;
        return hash;
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageMemoryUsage).toBeLessThan(50 * 1024 * 1024); // < 50MB
    });

    it('should not leak memory across operations', async () => {
      const measurements = [];
      
      for (let i = 0; i < 10; i++) {
        const rdf = global.testUtils.createComplexRDFGraph();
        global.testUtils.calculateHash(rdf);
        
        if (global.gc && i % 3 === 0) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        measurements.push(process.memoryUsage().heapUsed);
      }

      // Memory usage should not consistently increase
      const firstHalf = measurements.slice(0, 5);
      const secondHalf = measurements.slice(5);
      
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Second half should not be significantly larger
      const increase = (avgSecond - avgFirst) / avgFirst;
      expect(increase).toBeLessThan(0.2); // < 20% increase
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle concurrent operations efficiently', async () => {
      const concurrentOperations = 10;
      
      const operation = async (id) => {
        const rdf = global.testUtils.createSampleRDF('ConcurrentEntity', `Entity${id}`);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // Simulate async work
        return global.testUtils.calculateHash(rdf);
      };

      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentOperations }, (_, i) => operation(i));
      const results = await Promise.all(promises);
      
      const duration = performance.now() - startTime;

      expect(results.length).toBe(concurrentOperations);
      expect(results.every(r => typeof r === 'string')).toBe(true);
      expect(duration).toBeLessThan(200); // Should complete quickly despite randomness
    });

    it('should maintain determinism under concurrent load', async () => {
      const sharedData = global.testUtils.createComplexRDFGraph();
      
      const operation = async () => {
        // Multiple operations on shared data
        const hash1 = global.testUtils.calculateHash(sharedData);
        const hash2 = global.testUtils.calculateHash(hash1);
        return hash2;
      };

      const concurrentRuns = 5;
      const promises = Array.from({ length: concurrentRuns }, () => operation());
      const results = await Promise.all(promises);

      // All concurrent operations should produce identical results
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Stress Testing', () => {
    it('should handle sustained load', async () => {
      const sustainedOperations = 100;
      const results = [];
      const durations = [];

      for (let i = 0; i < sustainedOperations; i++) {
        const startTime = performance.now();
        
        const rdf = global.testUtils.createSampleRDF('StressEntity', `Entity${i}`);
        const result = global.testUtils.calculateHash(rdf);
        
        const duration = performance.now() - startTime;
        
        results.push(result);
        durations.push(duration);
      }

      expect(results.length).toBe(sustainedOperations);
      expect(results.every(r => typeof r === 'string')).toBe(true);

      // Performance should remain stable throughout
      const firstQuartile = durations.slice(0, 25);
      const lastQuartile = durations.slice(-25);
      
      const avgFirst = firstQuartile.reduce((a, b) => a + b, 0) / firstQuartile.length;
      const avgLast = lastQuartile.reduce((a, b) => a + b, 0) / lastQuartile.length;
      
      // Performance degradation should be minimal
      const degradation = (avgLast - avgFirst) / avgFirst;
      expect(degradation).toBeLessThan(0.5); // < 50% degradation
    });

    it('should recover from memory pressure', async () => {
      let memoryPeakReached = false;
      const results = [];

      for (let i = 0; i < 20; i++) {
        // Create increasingly large data
        const size = Math.min(1000, 100 * (i + 1));
        const largeRDF = Array.from({ length: size }, (_, j) => 
          global.testUtils.createSampleRDF('LargeEntity', `Entity${i}_${j}`)
        ).join('\n\n');
        
        const memoryBefore = process.memoryUsage().heapUsed;
        const result = global.testUtils.calculateHash(largeRDF);
        const memoryAfter = process.memoryUsage().heapUsed;
        
        results.push(result);
        
        if (memoryAfter > 100 * 1024 * 1024) { // > 100MB
          memoryPeakReached = true;
          
          // Force garbage collection
          if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      expect(results.length).toBe(20);
      expect(results.every(r => typeof r === 'string')).toBe(true);
      
      // Should handle memory pressure gracefully
      const finalMemory = process.memoryUsage().heapUsed;
      expect(finalMemory).toBeLessThan(200 * 1024 * 1024); // < 200MB
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up temporary resources', async () => {
      const tempResources = [];
      
      const operation = async () => {
        // Simulate temporary resource creation
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        tempResources.push(tempId);
        
        const rdf = global.testUtils.createSampleRDF('TempEntity', tempId);
        const result = global.testUtils.calculateHash(rdf);
        
        // Simulate cleanup
        const index = tempResources.indexOf(tempId);
        if (index > -1) {
          tempResources.splice(index, 1);
        }
        
        return result;
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 10);

      expect(perfStats.successfulIterations).toBe(10);
      expect(tempResources.length).toBe(0); // All resources should be cleaned up
    });

    it('should handle cleanup failures gracefully', async () => {
      let cleanupFailures = 0;
      
      const operation = async () => {
        try {
          const rdf = global.testUtils.createSampleRDF('CleanupTest', 'TestEntity');
          const result = global.testUtils.calculateHash(rdf);
          
          // Simulate occasional cleanup failure
          if (Math.random() < 0.3) {
            throw new Error('Cleanup failed');
          }
          
          return result;
        } catch (error) {
          if (error.message === 'Cleanup failed') {
            cleanupFailures++;
            // Continue despite cleanup failure
            const rdf = global.testUtils.createSampleRDF('CleanupTest', 'FailedCleanup');
            return global.testUtils.calculateHash(rdf);
          }
          throw error;
        }
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 20);

      expect(perfStats.successfulIterations).toBe(20);
      expect(cleanupFailures).toBeGreaterThan(0); // Some failures expected
      expect(cleanupFailures).toBeLessThan(10); // But not too many
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain baseline performance characteristics', async () => {
      // Define baseline expectations
      const baselines = {
        smallGraphProcessing: { maxDuration: 50, maxMemory: 10 * 1024 * 1024 },
        mediumGraphProcessing: { maxDuration: 200, maxMemory: 50 * 1024 * 1024 },
        largeGraphProcessing: { maxDuration: 1000, maxMemory: 100 * 1024 * 1024 }
      };

      // Test small graph processing
      const smallOp = async () => {
        const rdf = global.testUtils.createSampleRDF('BaselineTest', 'SmallEntity');
        return global.testUtils.calculateHash(rdf);
      };
      const smallStats = await global.testUtils.measurePerformance(smallOp, 5);

      expect(smallStats.averageDuration).toBeLessThan(baselines.smallGraphProcessing.maxDuration);

      // Test medium graph processing
      const mediumOp = async () => {
        const rdf = global.testUtils.createComplexRDFGraph();
        return global.testUtils.calculateHash(rdf);
      };
      const mediumStats = await global.testUtils.measurePerformance(mediumOp, 5);

      expect(mediumStats.averageDuration).toBeLessThan(baselines.mediumGraphProcessing.maxDuration);

      // Test large graph processing
      const largeOp = async () => {
        const entities = Array.from({ length: 50 }, (_, i) => 
          global.testUtils.createSampleRDF('LargeTest', `Entity${i}`)
        ).join('\n\n');
        return global.testUtils.calculateHash(entities);
      };
      const largeStats = await global.testUtils.measurePerformance(largeOp, 3);

      expect(largeStats.averageDuration).toBeLessThan(baselines.largeGraphProcessing.maxDuration);
    });

    it('should detect performance anomalies', async () => {
      const measurements = [];
      
      for (let i = 0; i < 30; i++) {
        const operation = async () => {
          const rdf = global.testUtils.createSampleRDF('AnomalyTest', `Entity${i}`);
          return global.testUtils.calculateHash(rdf);
        };

        const perfStats = await global.testUtils.measurePerformance(operation, 1);
        measurements.push(perfStats.averageDuration);
      }

      // Calculate statistics
      const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const variance = measurements.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / measurements.length;
      const stdDev = Math.sqrt(variance);

      // Check for outliers (values > 2 standard deviations from mean)
      const outliers = measurements.filter(m => Math.abs(m - mean) > 2 * stdDev);
      
      // Should have minimal outliers (< 10% of measurements)
      expect(outliers.length / measurements.length).toBeLessThan(0.1);
      
      // Standard deviation should be reasonable (< 50% of mean)
      expect(stdDev / mean).toBeLessThan(0.5);
    });
  });
});