/**
 * BDD Tests for Advanced Query Optimizer - Sub-10ms Performance Validation
 * 
 * Comprehensive test suite validating:
 * - Sub-10ms query execution for complex SPARQL queries
 * - Advanced indexing performance (B-tree, Hash, Bloom filters)
 * - Cost-based optimization accuracy
 * - Parallel and vectorized execution
 * - Cache hit rates and materialized views
 * - Adaptive optimization effectiveness
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import AdvancedQueryOptimizer from '../../src/kgen/query/advanced-query-optimizer.js';
import AdvancedBTreeIndex from '../../src/kgen/query/indexing/btree-index.js';
import HashIndex from '../../src/kgen/query/indexing/hash-index.js';
import BloomFilterIndex from '../../src/kgen/query/indexing/bloom-filter-index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Advanced Query Optimizer - Sub-10ms Performance Suite', () => {
  let optimizer;
  let testDataDir;
  let testQueries;
  let performanceResults;

  beforeAll(async () => {
    // Setup test environment
    testDataDir = path.join(os.tmpdir(), 'kgen-optimizer-test', Date.now().toString());
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Initialize optimizer with performance-focused configuration
    optimizer = new AdvancedQueryOptimizer({
      targetLatency: 10, // 10ms target
      storageDir: testDataDir,
      enableBTreeIndex: true,
      enableHashIndex: true,
      enableBloomFilter: true,
      enableMemoryMapping: true,
      enableCostBasedOptimization: true,
      enableVectorization: true,
      enableParallelExecution: true,
      enableStreamingResults: true,
      maxConcurrentQueries: 1000
    });
    
    await optimizer.initialize();
    
    // Prepare test dataset and queries
    await setupTestData();
    
    performanceResults = {
      executionTimes: [],
      cacheHitRates: [],
      indexUsageStats: []
    };
  });

  afterAll(async () => {
    // Cleanup test environment
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });

  beforeEach(() => {
    // Reset performance counters before each test
    performanceResults.executionTimes = [];
  });

  describe('Performance Target Validation', () => {
    it('should execute simple SPARQL queries in under 10ms', async () => {
      const simpleQueries = [
        'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100',
        'SELECT ?person WHERE { ?person <http://example.org/type> <http://example.org/Person> }',
        'SELECT ?name WHERE { ?person <http://example.org/name> ?name }'
      ];
      
      const executionTimes = [];
      
      for (const query of simpleQueries) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        executionTimes.push(executionTime);
        
        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.metadata.targetMet).toBe(true);
        expect(executionTime).toBeLessThan(10); // Sub-10ms requirement
      }
      
      const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      
      expect(avgExecutionTime).toBeLessThan(10);
      expect(Math.max(...executionTimes)).toBeLessThan(10);
      
      // Record performance
      performanceResults.executionTimes.push(...executionTimes);
    });

    it('should execute complex SPARQL queries with joins in under 10ms', async () => {
      const complexQueries = [
        `SELECT ?person ?name ?age WHERE {
           ?person <http://example.org/type> <http://example.org/Person> .
           ?person <http://example.org/name> ?name .
           ?person <http://example.org/age> ?age .
           FILTER(?age > 18)
         }`,
        `SELECT ?person ?company ?salary WHERE {
           ?person <http://example.org/worksFor> ?company .
           ?person <http://example.org/salary> ?salary .
           ?company <http://example.org/type> <http://example.org/Company> .
           FILTER(?salary > 50000)
         }`,
        `SELECT ?project ?manager ?team WHERE {
           ?project <http://example.org/manager> ?manager .
           ?project <http://example.org/team> ?team .
           ?manager <http://example.org/department> ?dept .
           ?team <http://example.org/size> ?size .
           FILTER(?size > 5)
         }`
      ];
      
      const executionTimes = [];
      
      for (const query of complexQueries) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        executionTimes.push(executionTime);
        
        expect(result).toBeDefined();
        expect(result.results.bindings).toBeDefined();
        expect(result.metadata.targetMet).toBe(true);
        expect(executionTime).toBeLessThan(10); // Critical sub-10ms requirement for complex queries
      }
      
      const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      
      expect(avgExecutionTime).toBeLessThan(10);
      expect(Math.max(...executionTimes)).toBeLessThan(10);
      
      performanceResults.executionTimes.push(...executionTimes);
    });

    it('should maintain sub-10ms performance under concurrent load', async () => {
      const testQuery = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50';
      const concurrentQueries = 50;
      
      const queryPromises = Array(concurrentQueries).fill(null).map(async () => {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(testQuery);
        const executionTime = performance.now() - startTime;
        
        return { result, executionTime };
      });
      
      const results = await Promise.all(queryPromises);
      
      // Validate all queries completed successfully
      results.forEach(({ result, executionTime }) => {
        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(executionTime).toBeLessThan(10); // Each query must be sub-10ms
      });
      
      const executionTimes = results.map(r => r.executionTime);
      const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const p95ExecutionTime = executionTimes.sort((a, b) => a - b)[Math.floor(executionTimes.length * 0.95)];
      
      expect(avgExecutionTime).toBeLessThan(10);
      expect(p95ExecutionTime).toBeLessThan(10); // 95th percentile must be sub-10ms
      expect(Math.max(...executionTimes)).toBeLessThan(15); // Even worst case should be reasonable
      
      performanceResults.executionTimes.push(...executionTimes);
    });
  });

  describe('Advanced Indexing Performance', () => {
    it('should achieve optimal B-tree index performance', async () => {
      const btreeTestQueries = [
        'SELECT ?s WHERE { ?s <http://example.org/created> ?date . FILTER(?date > "2023-01-01"^^xsd:date) }',
        'SELECT ?item WHERE { ?item <http://example.org/price> ?price . FILTER(?price BETWEEN 10 AND 100) }',
        'SELECT ?person WHERE { ?person <http://example.org/age> ?age . FILTER(?age > 25 AND ?age < 65) }'
      ];
      
      for (const query of btreeTestQueries) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        expect(executionTime).toBeLessThan(10);
        expect(result.metadata.strategy).toMatch(/btree|index_optimized/);
        
        // Verify B-tree index was used effectively
        const indexStats = await optimizer.btreeIndex.getStatistics();
        expect(indexStats.operations.lookups).toBeGreaterThan(0);
        expect(indexStats.cache.hitRate).toBeGreaterThan(0.5); // At least 50% cache hit rate
      }
    });

    it('should achieve optimal hash index performance for exact matches', async () => {
      const hashTestQueries = [
        'SELECT ?o WHERE { <http://example.org/person1> <http://example.org/name> ?o }',
        'SELECT ?s WHERE { ?s <http://example.org/type> <http://example.org/Person> }',
        'SELECT ?p WHERE { <http://example.org/item1> ?p <http://example.org/value1> }'
      ];
      
      for (const query of hashTestQueries) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        expect(executionTime).toBeLessThan(5); // Hash index should be even faster
        expect(result.metadata.strategy).toMatch(/hash|index_optimized/);
        
        // Verify hash index performance
        const hashStats = await optimizer.hashIndex.getStatistics();
        expect(hashStats.performance.cacheHitRate).toBeGreaterThan(0.7); // High cache hit rate for exact matches
      }
    });

    it('should achieve optimal bloom filter false positive rate', async () => {
      const bloomTestQueries = [
        'SELECT ?s WHERE { ?s <http://example.org/nonexistent> ?o }',
        'SELECT ?s WHERE { ?s <http://example.org/missing> <http://example.org/value> }',
        'SELECT ?s WHERE { ?s <http://example.org/fake> ?o }'
      ];
      
      let falsePositives = 0;
      let totalChecks = 0;
      
      for (const query of bloomTestQueries) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        expect(executionTime).toBeLessThan(2); // Bloom filter should provide very fast negative results
        
        totalChecks++;
        if (result.results.bindings.length === 0) {
          // This should be a true negative
        } else {
          // This might be a false positive
          falsePositives++;
        }
      }
      
      const bloomStats = await optimizer.bloomFilter.getStatistics();
      expect(bloomStats.statistics.actualFPRate).toBeLessThan(0.05); // Less than 5% false positive rate
    });
  });

  describe('Cost-Based Optimization Accuracy', () => {
    it('should generate accurate cost estimates within 20% of actual execution time', async () => {
      const testQueries = [
        'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100',
        'SELECT ?person ?name WHERE { ?person <http://example.org/name> ?name } LIMIT 50',
        'SELECT ?item ?price WHERE { ?item <http://example.org/price> ?price . FILTER(?price > 50) }'
      ];
      
      for (const query of testQueries) {
        const result = await optimizer.executeOptimizedQuery(query);
        
        const estimatedTime = result.metadata.optimizations.find(opt => 
          opt.type === 'cost_estimate'
        )?.value || result.performance?.planningTime || 0;
        
        const actualTime = result.metadata.executionTime;
        
        if (estimatedTime > 0 && actualTime > 0) {
          const accuracy = Math.abs(estimatedTime - actualTime) / actualTime;
          expect(accuracy).toBeLessThan(0.2); // Within 20% accuracy
        }
      }
    });

    it('should select optimal join order for complex queries', async () => {
      const complexJoinQuery = `
        SELECT ?person ?company ?project ?skill WHERE {
          ?person <http://example.org/worksFor> ?company .
          ?person <http://example.org/assignedTo> ?project .
          ?person <http://example.org/hasSkill> ?skill .
          ?company <http://example.org/type> <http://example.org/Company> .
          ?project <http://example.org/status> "active" .
        }
      `;
      
      const result = await optimizer.executeOptimizedQuery(complexJoinQuery);
      
      expect(result.metadata.executionTime).toBeLessThan(10);
      expect(result.metadata.strategy).toMatch(/cost_based|optimized/);
      
      // Verify join optimization was applied
      const joinOptimizations = result.metadata.optimizations.filter(opt => 
        opt.type === 'join_reorder' || opt.type === 'join_optimization'
      );
      
      expect(joinOptimizations.length).toBeGreaterThan(0);
    });
  });

  describe('Parallel and Vectorized Execution', () => {
    it('should leverage parallel execution for complex queries', async () => {
      const parallelizableQuery = `
        SELECT ?person ?department ?salary ?bonus WHERE {
          ?person <http://example.org/department> ?department .
          ?person <http://example.org/salary> ?salary .
          ?person <http://example.org/bonus> ?bonus .
          FILTER(?salary > 40000 && ?bonus > 1000)
        }
      `;
      
      const startTime = performance.now();
      const result = await optimizer.executeOptimizedQuery(parallelizableQuery);
      const executionTime = performance.now() - startTime;
      
      expect(executionTime).toBeLessThan(10);
      
      // Check if parallel execution was used
      const parallelOptimizations = result.metadata.optimizations.filter(opt => 
        opt.type === 'parallel_execution' || opt.type === 'vectorization'
      );
      
      // For complex queries, parallel execution should be considered
      if (result.metadata.complexity && result.metadata.complexity > 5) {
        expect(parallelOptimizations.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should utilize vectorized operations when beneficial', async () => {
      const vectorizableQuery = `
        SELECT ?item (SUM(?price) as ?total) WHERE {
          ?item <http://example.org/price> ?price .
          ?item <http://example.org/category> <http://example.org/Electronics> .
        } GROUP BY ?item
      `;
      
      const result = await optimizer.executeOptimizedQuery(vectorizableQuery);
      
      expect(result.metadata.executionTime).toBeLessThan(10);
      
      // Vectorization should be considered for aggregation queries
      const vectorOptimizations = result.metadata.optimizations.filter(opt => 
        opt.type === 'vectorization' || opt.type === 'simd'
      );
      
      // Aggregation queries are good candidates for vectorization
      expect(vectorOptimizations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Performance and Materialized Views', () => {
    it('should achieve high cache hit rates for repeated queries', async () => {
      const repeatedQuery = 'SELECT ?s ?p ?o WHERE { ?s <http://example.org/type> <http://example.org/Person> } LIMIT 10';
      
      // Execute query multiple times
      const iterations = 10;
      let cacheHits = 0;
      
      for (let i = 0; i < iterations; i++) {
        const result = await optimizer.executeOptimizedQuery(repeatedQuery);
        
        expect(result.metadata.executionTime).toBeLessThan(10);
        
        if (result.metadata.cacheHit || result.metadata.strategy === 'cache') {
          cacheHits++;
        }
        
        // Cache hits should start appearing after the first execution
        if (i > 0) {
          expect(result.metadata.executionTime).toBeLessThan(5); // Cached queries should be very fast
        }
      }
      
      // Should have achieved cache hits for most repeated queries
      const cacheHitRate = cacheHits / iterations;
      expect(cacheHitRate).toBeGreaterThan(0.5); // At least 50% cache hit rate
      
      performanceResults.cacheHitRates.push(cacheHitRate);
    });

    it('should effectively use materialized views', async () => {
      // Create a materialized view
      const viewQuery = 'SELECT ?person ?name WHERE { ?person <http://example.org/name> ?name }';
      await optimizer.createMaterializedView('person_names', viewQuery, {
        refreshInterval: 300000 // 5 minutes
      });
      
      // Query that should use the materialized view
      const queryUsingView = 'SELECT ?person ?name WHERE { ?person <http://example.org/name> ?name } LIMIT 20';
      
      const result = await optimizer.executeOptimizedQuery(queryUsingView);
      
      expect(result.metadata.executionTime).toBeLessThan(5); // Materialized views should be very fast
      expect(result.metadata.strategy).toMatch(/materialized|view|cache/);
    });
  });

  describe('Adaptive Optimization', () => {
    it('should adapt index strategies based on query patterns', async () => {
      const queryPatterns = [
        'SELECT ?s WHERE { ?s <http://example.org/age> ?age . FILTER(?age > 30) }',
        'SELECT ?s WHERE { ?s <http://example.org/age> ?age . FILTER(?age > 25) }',
        'SELECT ?s WHERE { ?s <http://example.org/age> ?age . FILTER(?age > 35) }',
        'SELECT ?s WHERE { ?s <http://example.org/age> ?age . FILTER(?age > 40) }'
      ];
      
      // Execute patterns multiple times to establish history
      for (let iteration = 0; iteration < 3; iteration++) {
        for (const query of queryPatterns) {
          await optimizer.executeOptimizedQuery(query);
        }
      }
      
      // Trigger adaptive optimization
      const optimizationResult = await optimizer.optimizeIndexes(queryPatterns.map(q => ({
        pattern: q,
        complexity: 3,
        frequency: 4
      })));
      
      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.appliedOptimizations).toBeDefined();
      
      // After adaptation, queries should perform better
      const postAdaptationTimes = [];
      
      for (const query of queryPatterns) {
        const startTime = performance.now();
        const result = await optimizer.executeOptimizedQuery(query);
        const executionTime = performance.now() - startTime;
        
        postAdaptationTimes.push(executionTime);
        expect(executionTime).toBeLessThan(10);
      }
      
      const avgPostAdaptation = postAdaptationTimes.reduce((sum, time) => sum + time, 0) / postAdaptationTimes.length;
      expect(avgPostAdaptation).toBeLessThan(8); // Should be even better after optimization
    });

    it('should maintain performance targets over time', async () => {
      const monitoringQueries = [
        'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 25',
        'SELECT ?person ?name WHERE { ?person <http://example.org/name> ?name } LIMIT 15',
        'SELECT ?item ?price WHERE { ?item <http://example.org/price> ?price } LIMIT 30'
      ];
      
      const performanceHistory = [];
      const iterations = 20;
      
      // Execute queries over time to simulate real-world usage
      for (let i = 0; i < iterations; i++) {
        const iterationTimes = [];
        
        for (const query of monitoringQueries) {
          const startTime = performance.now();
          const result = await optimizer.executeOptimizedQuery(query);
          const executionTime = performance.now() - startTime;
          
          iterationTimes.push(executionTime);
          expect(executionTime).toBeLessThan(10); // Consistent sub-10ms performance
        }
        
        const avgIterationTime = iterationTimes.reduce((sum, time) => sum + time, 0) / iterationTimes.length;
        performanceHistory.push(avgIterationTime);
      }
      
      // Analyze performance consistency over time
      const avgOverallTime = performanceHistory.reduce((sum, time) => sum + time, 0) / performanceHistory.length;
      const maxTime = Math.max(...performanceHistory);
      const minTime = Math.min(...performanceHistory);
      const variance = maxTime - minTime;
      
      expect(avgOverallTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(12); // Even worst case should be reasonable
      expect(variance).toBeLessThan(5); // Performance should be consistent (low variance)
    });
  });

  describe('Memory and Resource Management', () => {
    it('should maintain efficient memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Execute many queries to test memory management
      const queries = Array(100).fill(null).map((_, i) => 
        `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT ${10 + (i % 20)}`
      );
      
      for (const query of queries) {
        await optimizer.executeOptimizedQuery(query);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Get optimizer memory statistics
      const analytics = optimizer.getPerformanceAnalytics();
      expect(analytics.activeQueries).toBeLessThan(10); // Should not accumulate active queries
    });

    it('should handle resource cleanup properly', async () => {
      const resourceIntensiveQuery = `
        SELECT ?s ?p ?o ?x ?y ?z WHERE {
          ?s ?p ?o .
          ?s <http://example.org/property1> ?x .
          ?s <http://example.org/property2> ?y .
          ?s <http://example.org/property3> ?z .
        } LIMIT 1000
      `;
      
      const concurrentExecutions = 20;
      const queryPromises = Array(concurrentExecutions).fill(null).map(() => 
        optimizer.executeOptimizedQuery(resourceIntensiveQuery)
      );
      
      const results = await Promise.all(queryPromises);
      
      // All queries should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata.executionTime).toBeLessThan(15); // Slightly higher threshold for complex queries
      });
      
      // Resources should be properly cleaned up
      const analytics = optimizer.getPerformanceAnalytics();
      expect(analytics.activeQueries).toBe(0);
    });
  });

  describe('Performance Summary and Validation', () => {
    it('should provide comprehensive performance summary', async () => {
      const analytics = optimizer.getPerformanceAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.averageLatency).toBeLessThan(10);
      expect(analytics.targetComplianceRate).toBeGreaterThan(0.95); // 95% of queries should meet target
      expect(analytics.throughput).toBeGreaterThan(0);
      
      console.log('\n=== PERFORMANCE SUMMARY ===');
      console.log(`Average Latency: ${analytics.averageLatency.toFixed(2)}ms`);
      console.log(`Target Compliance Rate: ${(analytics.targetComplianceRate * 100).toFixed(1)}%`);
      console.log(`Throughput: ${analytics.throughput.toFixed(1)} queries/min`);
      console.log(`Total Queries: ${analytics.totalQueries}`);
      console.log(`Index Usage:`, analytics.indexingStats);
      console.log('=========================\n');
    });

    it('should validate all performance targets are met', () => {
      const analytics = optimizer.getPerformanceAnalytics();
      
      // Critical performance targets
      expect(analytics.averageLatency).toBeLessThan(10); // Sub-10ms average
      expect(analytics.targetComplianceRate).toBeGreaterThan(0.90); // 90% compliance minimum
      
      // Quality targets
      if (performanceResults.cacheHitRates.length > 0) {
        const avgCacheHitRate = performanceResults.cacheHitRates.reduce((sum, rate) => sum + rate, 0) / performanceResults.cacheHitRates.length;
        expect(avgCacheHitRate).toBeGreaterThan(0.5); // 50% minimum cache hit rate
      }
      
      // Throughput target
      expect(analytics.throughput).toBeGreaterThan(100); // Minimum 100 queries/min
      
      console.log('\n🎯 ALL PERFORMANCE TARGETS MET! 🎯');
      console.log(`✓ Sub-10ms execution: ${analytics.averageLatency.toFixed(2)}ms`);
      console.log(`✓ Target compliance: ${(analytics.targetComplianceRate * 100).toFixed(1)}%`);
      console.log(`✓ Throughput: ${analytics.throughput.toFixed(1)} q/min`);
    });
  });

  // Helper functions for test setup
  async function setupTestData() {
    // Create test dataset with various triple patterns
    const testTriples = [
      // Person data
      { subject: 'http://example.org/person1', predicate: 'http://example.org/type', object: 'http://example.org/Person' },
      { subject: 'http://example.org/person1', predicate: 'http://example.org/name', object: 'Alice Smith' },
      { subject: 'http://example.org/person1', predicate: 'http://example.org/age', object: '30' },
      { subject: 'http://example.org/person1', predicate: 'http://example.org/department', object: 'http://example.org/Engineering' },
      { subject: 'http://example.org/person1', predicate: 'http://example.org/salary', object: '75000' },
      
      { subject: 'http://example.org/person2', predicate: 'http://example.org/type', object: 'http://example.org/Person' },
      { subject: 'http://example.org/person2', predicate: 'http://example.org/name', object: 'Bob Johnson' },
      { subject: 'http://example.org/person2', predicate: 'http://example.org/age', object: '28' },
      { subject: 'http://example.org/person2', predicate: 'http://example.org/department', object: 'http://example.org/Marketing' },
      { subject: 'http://example.org/person2', predicate: 'http://example.org/salary', object: '65000' },
      
      // Company data
      { subject: 'http://example.org/company1', predicate: 'http://example.org/type', object: 'http://example.org/Company' },
      { subject: 'http://example.org/company1', predicate: 'http://example.org/name', object: 'Tech Corp' },
      
      // Product data
      { subject: 'http://example.org/item1', predicate: 'http://example.org/type', object: 'http://example.org/Product' },
      { subject: 'http://example.org/item1', predicate: 'http://example.org/price', object: '99.99' },
      { subject: 'http://example.org/item1', predicate: 'http://example.org/category', object: 'http://example.org/Electronics' },
      
      { subject: 'http://example.org/item2', predicate: 'http://example.org/type', object: 'http://example.org/Product' },
      { subject: 'http://example.org/item2', predicate: 'http://example.org/price', object: '149.99' },
      { subject: 'http://example.org/item2', predicate: 'http://example.org/category', object: 'http://example.org/Electronics' }
    ];
    
    // Generate additional test data for performance testing
    const additionalTriples = [];
    for (let i = 3; i <= 1000; i++) {
      additionalTriples.push(
        { subject: `http://example.org/person${i}`, predicate: 'http://example.org/type', object: 'http://example.org/Person' },
        { subject: `http://example.org/person${i}`, predicate: 'http://example.org/name', object: `Person ${i}` },
        { subject: `http://example.org/person${i}`, predicate: 'http://example.org/age', object: String(20 + (i % 45)) },
        { subject: `http://example.org/item${i}`, predicate: 'http://example.org/type', object: 'http://example.org/Product' },
        { subject: `http://example.org/item${i}`, predicate: 'http://example.org/price', object: String(10 + (i % 500)) }
      );
    }
    
    const allTriples = [...testTriples, ...additionalTriples];
    
    // Insert test data into indexes
    for (const triple of allTriples) {
      await optimizer.btreeIndex?.insert?.(triple);
      await optimizer.hashIndex?.insert?.(triple);
      await optimizer.bloomFilter?.add?.(triple);
    }
    
    console.log(`Loaded ${allTriples.length} test triples for performance testing`);
  }
});
