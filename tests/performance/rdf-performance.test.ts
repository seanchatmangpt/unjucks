/**
 * RDF Performance Optimization Tests
 * 
 * Tests the 80/20 optimization strategies for RDF/Turtle processing
 * Focus on performance bottlenecks that impact 80% of users
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { Store, DataFactory } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { memoryOptimizer } from '../../src/lib/performance/memory-optimizer.js';
import { performanceMonitor } from '../../src/lib/performance/performance-monitor.js';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Performance Optimization Tests', () => {
  let store: Store;
  let rdfFilters: RDFFilters;
  const benchmarkResults: any[] = [];

  beforeAll(() => {
    // Create a test store with typical RDF data
    store = new Store();
    
    // Generate typical RDF triples (representing 80% of common use cases)
    for (let i = 1; i <= 1000; i++) {
      // Person data
      store.add(quad(
        namedNode(`http://example.org/person${i}`),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person')
      ));
      
      store.add(quad(
        namedNode(`http://example.org/person${i}`),
        namedNode('http://xmlns.com/foaf/0.1/name'),
        literal(`Person ${i}`)
      ));
      
      store.add(quad(
        namedNode(`http://example.org/person${i}`),
        namedNode('http://xmlns.com/foaf/0.1/age'),
        literal(String(20 + (i % 50)))
      ));
      
      // Department relationships (common pattern)
      store.add(quad(
        namedNode(`http://example.org/person${i}`),
        namedNode('http://example.org/department'),
        namedNode(`http://example.org/dept${(i % 10) + 1}`)
      ));
    }
    
    rdfFilters = new RDFFilters({ store });
    
    // Start performance monitoring
    performanceMonitor.startMonitoring();
    memoryOptimizer.startMonitoring();
  });

  afterAll(() => {
    performanceMonitor.stopMonitoring();
    memoryOptimizer.stopMonitoring();
    
    // Generate comprehensive performance report
    console.log('\n=== RDF PERFORMANCE OPTIMIZATION RESULTS ===');
    
    benchmarkResults.forEach(result => {
      if (result.throughput && result.time !== undefined) {
        console.log(`  ${result.test}: ${result.time.toFixed(2)}ms (${Math.round(result.throughput)} ops/sec)`);
      } else if (result.time !== undefined) {
        console.log(`  ${result.test}: ${result.time.toFixed(2)}ms`);
      } else {
        console.log(`  ${result.test}: ${JSON.stringify(result)}`);
      }
    });
    
    const dashboard = performanceMonitor.getDashboard();
    console.log('\n📊 PERFORMANCE DASHBOARD:');
    console.log(`  Status: ${dashboard.status}`);
    console.log(`  Total Operations: ${dashboard.totalOperations}`);
    console.log(`  Memory Usage: ${dashboard.memoryUsage.current}MB`);
    console.log(`  Cache Hit Rate: ${dashboard.cachePerformance.hitRate * 100}%`);
    
    console.log('\n=== END RDF PERFORMANCE REPORT ===\n');
  });

  describe('Query Performance - 80% Common Patterns', () => {
    it('should execute type queries efficiently (most common pattern)', () => {
      const startTime = performance.now();
      
      // Most common pattern: find all entities of a type
      const results = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1000);
      expect(duration).toBeLessThan(20); // Should be very fast for common queries
      
      benchmarkResults.push({
        test: 'type-query-foaf-person',
        time: duration,
        resultCount: results.length,
        throughput: results.length / duration * 1000
      });
      
      // Record performance metric
      performanceMonitor.recordMetric({
        parseTime: 0,
        queryTime: duration,
        renderTime: 0,
        memoryUsage: {
          before: process.memoryUsage().heapUsed,
          after: process.memoryUsage().heapUsed,
          peak: process.memoryUsage().heapUsed
        },
        cacheHits: 0,
        cacheMisses: 1,
        operationType: 'type-query',
        tripleCount: results.length,
        timestamp: Date.now()
      });
    });

    it('should handle property queries efficiently', () => {
      const startTime = performance.now();
      
      // Common pattern: get all names
      const results = rdfFilters.rdfObject('ex:person1', 'foaf:name');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(duration).toBeLessThan(5); // Should be very fast for single entity
      
      benchmarkResults.push({
        test: 'property-query-single',
        time: duration,
        resultCount: results.length
      });
    });

    it('should demonstrate query caching benefits', () => {
      // First query - no cache
      const startTime1 = performance.now();
      const results1 = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      const endTime1 = performance.now();
      const time1 = endTime1 - startTime1;
      
      // Second query - same pattern (simulated cache behavior)
      const startTime2 = performance.now();
      const results2 = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      const endTime2 = performance.now();
      const time2 = endTime2 - startTime2;
      
      expect(results1).toEqual(results2);
      // Second query should be similar or faster due to warm-up effects
      expect(time2).toBeLessThanOrEqual(time1 * 1.1); // Allow 10% variance
      
      benchmarkResults.push({
        test: 'query-caching-demo',
        firstQuery: time1,
        secondQuery: time2,
        improvement: time1 > time2 ? ((time1 - time2) / time1 * 100) : 0
      });
    });

    it('should handle batch queries efficiently', () => {
      const entities = [
        'ex:person1', 'ex:person2', 'ex:person3', 'ex:person4', 'ex:person5'
      ];
      
      const startTime = performance.now();
      
      const results = entities.map(entity => ({
        entity,
        name: rdfFilters.rdfObject(entity, 'foaf:name'),
        age: rdfFilters.rdfObject(entity, 'foaf:age'),
        department: rdfFilters.rdfObject(entity, 'ex:department')
      }));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(10); // Batch should be efficient
      
      benchmarkResults.push({
        test: 'batch-query-5-entities',
        time: duration,
        entitiesQueried: entities.length,
        avgTimePerEntity: duration / entities.length
      });
    });
  });

  describe('Memory Optimization - Common Scenarios', () => {
    it('should optimize memory usage for large result sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create large result set (common in real applications)
      const allPersons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      const detailedResults = allPersons.slice(0, 500).map(person => ({
        uri: person,
        name: rdfFilters.rdfObject(person, 'foaf:name')[0]?.value || '',
        age: rdfFilters.rdfObject(person, 'foaf:age')[0]?.value || '',
        department: rdfFilters.rdfObject(person, 'ex:department')[0]?.value || ''
      }));
      
      const peakMemory = process.memoryUsage().heapUsed;
      
      // Optimize memory
      const optimizationResult = await memoryOptimizer.optimizeMemory('comprehensive');
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (peakMemory - initialMemory) / 1024 / 1024; // MB
      const memoryReduced = (peakMemory - finalMemory) / 1024 / 1024; // MB
      
      expect(detailedResults).toHaveLength(500);
      expect(memoryGrowth).toBeLessThan(50); // Should not use excessive memory
      expect(optimizationResult.success).toBe(true);
      
      benchmarkResults.push({
        test: 'memory-optimization-large-dataset',
        datasetSize: detailedResults.length,
        memoryGrowthMB: memoryGrowth,
        memoryReducedMB: memoryReduced,
        optimizationSuccess: optimizationResult.success
      });
    });

    it('should demonstrate object pooling benefits', () => {
      const pool = memoryOptimizer.createObjectPool(
        'test-query-result',
        () => ({ results: [], metadata: {} }),
        (obj) => { obj.results = []; obj.metadata = {}; },
        50
      );
      
      const startTime = performance.now();
      
      // Simulate frequent query result object creation/disposal
      const operations = 1000;
      for (let i = 0; i < operations; i++) {
        const resultObj = pool.acquire();
        resultObj.results = [`result-${i}`];
        resultObj.metadata = { timestamp: Date.now() };
        
        // Simulate some processing
        if (i % 10 === 0) {
          // Occasionally create some data
          resultObj.results.push(`extra-${i}`);
        }
        
        pool.release(resultObj);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(pool.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // Should be efficient with pooling
      
      benchmarkResults.push({
        test: 'object-pooling-demo',
        operations,
        time: duration,
        poolSize: pool.size,
        opsPerSecond: operations / duration * 1000
      });
    });

    it('should validate string interning for common URIs', () => {
      const startTime = performance.now();
      
      // Common URIs that appear frequently (80% use case)
      const commonUris = [
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://xmlns.com/foaf/0.1/Person',
        'http://xmlns.com/foaf/0.1/name',
        'http://xmlns.com/foaf/0.1/age',
        'http://example.org/department'
      ];
      
      // Simulate frequent string operations
      const internedUris = [];
      for (let i = 0; i < 10000; i++) {
        const uri = commonUris[i % commonUris.length];
        const interned = memoryOptimizer.internString(uri);
        internedUris.push(interned);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(internedUris).toHaveLength(10000);
      expect(duration).toBeLessThan(20); // String interning should be fast
      
      // Verify interning works (same reference for same string)
      const first = memoryOptimizer.internString('test-string');
      const second = memoryOptimizer.internString('test-string');
      expect(first).toBe(second); // Same reference
      
      benchmarkResults.push({
        test: 'string-interning-performance',
        operations: internedUris.length,
        time: duration,
        uniqueStrings: commonUris.length
      });
    });
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle typical web application query pattern', () => {
      // Simulate typical web app: get user profile data
      const startTime = performance.now();
      
      const userId = 'ex:person42';
      const profile = {
        id: userId,
        name: rdfFilters.rdfObject(userId, 'foaf:name')[0]?.value || 'Unknown',
        age: rdfFilters.rdfObject(userId, 'foaf:age')[0]?.value || 'Unknown',
        department: rdfFilters.rdfObject(userId, 'ex:department')[0]?.value || 'Unknown',
        type: rdfFilters.rdfType(userId)[0] || 'Unknown'
      };
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(profile.name).toBe('Person 42');
      expect(profile.age).toBe('62'); // 20 + (42 % 50) = 20 + 42 = 62
      expect(duration).toBeLessThan(5); // Profile loading should be very fast
      
      benchmarkResults.push({
        test: 'web-app-profile-query',
        time: duration,
        profileComplete: profile.name !== 'Unknown'
      });
    });

    it('should handle search/filter scenario efficiently', () => {
      const startTime = performance.now();
      
      // Simulate search: find people in specific departments
      const targetDepts = ['ex:dept1', 'ex:dept2', 'ex:dept3'];
      const searchResults = targetDepts.flatMap(dept => 
        rdfFilters.rdfSubject('ex:department', dept)
      );
      
      // Get detailed info for results
      const detailedResults = searchResults.slice(0, 20).map(person => ({
        uri: person,
        name: rdfFilters.rdfObject(person, 'foaf:name')[0]?.value || '',
        department: rdfFilters.rdfObject(person, 'ex:department')[0]?.value || ''
      }));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(searchResults.length).toBeGreaterThan(0);
      expect(detailedResults.length).toBeLessThanOrEqual(20);
      expect(duration).toBeLessThan(15); // Search should be reasonably fast
      
      benchmarkResults.push({
        test: 'search-filter-scenario',
        time: duration,
        totalResults: searchResults.length,
        detailedResults: detailedResults.length,
        searchTerms: targetDepts.length
      });
    });

    it('should demonstrate CI/CD performance requirements', () => {
      // Simulate CI/CD scenario: quick validation queries
      const startTime = performance.now();
      
      const validationQueries = [
        () => rdfFilters.rdfCount(null, 'rdf:type', 'foaf:Person'), // Count people
        () => rdfFilters.rdfExists('ex:person1', 'foaf:name'), // Check if person has name
        () => rdfFilters.rdfSubject('rdf:type', 'foaf:Person').length, // Get all people count
        () => rdfFilters.rdfObject('ex:person1', 'foaf:age').length > 0, // Check if person has age
        () => rdfFilters.rdfNamespace('foaf') === 'http://xmlns.com/foaf/0.1/' // Check namespace
      ];
      
      const results = validationQueries.map(query => query());
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(validationQueries.length);
      expect(results[0]).toBe(1000); // Count of people
      expect(results[1]).toBe(true); // Person1 has name
      expect(results[2]).toBe(1000); // All people count
      expect(results[3]).toBe(true); // Person1 has age
      expect(results[4]).toBe(true); // Namespace check
      expect(duration).toBeLessThan(10); // CI/CD validation should be very fast
      
      benchmarkResults.push({
        test: 'cicd-validation-queries',
        time: duration,
        queryCount: validationQueries.length,
        avgTimePerQuery: duration / validationQueries.length,
        allValidationsPassed: results.every((r, i) => 
          i === 4 ? r === true : (typeof r === 'number' ? r > 0 : r === true)
        )
      });
    });
  });
});