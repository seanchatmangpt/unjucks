import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'path';
import { performance } from 'perf_hooks';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource, RDFDataLoaderOptions } from '../../src/lib/types/turtle-types.js';

/**
 * RDF Performance and Caching Integration Tests
 * Validates performance characteristics and caching behavior
 * under realistic and stress conditions
 */
describe('RDF Performance and Caching Integration Tests', () => {
  let dataLoader: RDFDataLoader;
  let fastLoader: RDFDataLoader;
  let parser: TurtleParser;
  let rdfFilters: RDFFilters;
  
  const fixturesPath = resolve(__dirname, '../fixtures/turtle');

  beforeEach(() => {
    const standardOptions: RDFDataLoaderOptions = {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      templateDir: fixturesPath,
      httpTimeout: 10000,
      maxRetries: 3
    };
    
    const fastOptions: RDFDataLoaderOptions = {
      ...standardOptions,
      cacheTTL: 60000, // 1 minute for faster tests
    };
    
    dataLoader = new RDFDataLoader(standardOptions);
    fastLoader = new RDFDataLoader(fastOptions);
    parser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterEach(() => {
    dataLoader.clearCache();
    fastLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('Parsing Performance Benchmarks', () => {
    it('should parse small datasets within performance thresholds', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      // Warm-up run
      await dataLoader.loadFromSource(dataSource);
      dataLoader.clearCache();
      
      // Benchmark run
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = await dataLoader.loadFromSource(dataSource);
        const end = performance.now();
        
        expect(result.success).toBe(true);
        times.push(end - start);
        dataLoader.clearCache(); // Ensure no caching between iterations
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Small dataset parsing - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxTime).toBeLessThan(500); // No single parsing should exceed 500ms
    });

    it('should parse complex schema datasets efficiently', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      const start = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const end = performance.now();
      
      expect(result.success).toBe(true);
      
      const parseTime = end - start;
      const triplesPerMs = result.data.triples.length / parseTime;
      
      console.log(`Complex schema parsing: ${parseTime.toFixed(2)}ms for ${result.data.triples.length} triples (${triplesPerMs.toFixed(2)} triples/ms)`);
      
      expect(parseTime).toBeLessThan(1000); // Should parse within 1 second
      expect(triplesPerMs).toBeGreaterThan(0.1); // Should process at reasonable rate
    });

    it('should handle large datasets with acceptable performance', async () => {
      // Use the large-dataset.ttl fixture if available, otherwise create inline
      let dataSource: RDFDataSource;
      
      try {
        dataSource = {
          type: 'file',
          source: 'large-dataset.ttl',
          format: 'text/turtle'
        };
        
        const testResult = await dataLoader.loadFromSource(dataSource);
        if (!testResult.success) {
          throw new Error('Large dataset fixture not available');
        }
      } catch {
        // Create synthetic large dataset
        const tripleCount = 5000;
        let largeTurtle = '@prefix ex: <http://example.org/> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n';
        
        for (let i = 0; i < tripleCount; i++) {
          largeTurtle += `ex:entity${i} rdfs:label "Entity ${i}" ;\n`;
          largeTurtle += `                ex:type "Type${i % 10}" ;\n`;
          largeTurtle += `                ex:value ${i} .\n`;
        }
        
        dataSource = {
          type: 'inline',
          source: largeTurtle,
          format: 'text/turtle'
        };
      }

      const start = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const end = performance.now();
      
      expect(result.success).toBe(true);
      
      const parseTime = end - start;
      const triplesPerSecond = (result.data.triples.length / parseTime) * 1000;
      const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      console.log(`Large dataset: ${parseTime.toFixed(2)}ms for ${result.data.triples.length} triples`);
      console.log(`Performance: ${triplesPerSecond.toFixed(0)} triples/second`);
      console.log(`Memory usage: ${memoryUsed.toFixed(2)} MB`);
      
      expect(parseTime).toBeLessThan(30000); // 30 seconds max for large datasets
      expect(triplesPerSecond).toBeGreaterThan(100); // Minimum throughput
      expect(memoryUsed).toBeLessThan(1000); // Memory usage should be reasonable
    });
  });

  describe('Caching Performance and Behavior', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      // First load (cold cache)
      const coldStart = performance.now();
      const coldResult = await dataLoader.loadFromSource(dataSource);
      const coldEnd = performance.now();
      const coldTime = coldEnd - coldStart;
      
      expect(coldResult.success).toBe(true);

      // Second load (warm cache)
      const warmStart = performance.now();
      const warmResult = await dataLoader.loadFromSource(dataSource);
      const warmEnd = performance.now();
      const warmTime = warmEnd - warmStart;
      
      expect(warmResult.success).toBe(true);
      
      console.log(`Cold load: ${coldTime.toFixed(2)}ms, Warm load: ${warmTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(coldTime / warmTime).toFixed(2)}x`);
      
      // Cached load should be significantly faster
      expect(warmTime).toBeLessThan(coldTime / 2); // At least 2x speedup
      expect(warmTime).toBeLessThan(10); // Cached loads should be very fast
      
      // Data should be identical
      expect(warmResult.data.triples.length).toBe(coldResult.data.triples.length);
      expect(Object.keys(warmResult.data.subjects)).toEqual(Object.keys(coldResult.data.subjects));
    });

    it('should handle cache expiration correctly', async () => {
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled: true,
        cacheTTL: 100, // 100ms TTL
        templateDir: fixturesPath
      });

      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      // First load
      const result1 = await shortTTLLoader.loadFromSource(dataSource);
      expect(result1.success).toBe(true);
      
      let stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(1);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Cache should still contain entry but it's expired
      stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(1);
      
      // Second load should re-parse due to expiration
      const start = performance.now();
      const result2 = await shortTTLLoader.loadFromSource(dataSource);
      const end = performance.now();
      
      expect(result2.success).toBe(true);
      expect(end - start).toBeGreaterThan(1); // Should take time to re-parse
      
      // Clean up expired entries
      const removed = shortTTLLoader.cleanupCache();
      expect(removed).toBe(1);
      
      stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(1); // Should have new entry
    });

    it('should handle concurrent cache access safely', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      // Launch multiple concurrent loads
      const concurrentCount = 20;
      const promises = Array(concurrentCount).fill(null).map((_, index) => {
        return dataLoader.loadFromSource(dataSource);
      });

      const start = performance.now();
      const results = await Promise.all(promises);
      const end = performance.now();
      
      const totalTime = end - start;
      const averageTime = totalTime / concurrentCount;
      
      console.log(`${concurrentCount} concurrent loads completed in ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms each)`);
      
      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.triples.length).toBeGreaterThan(0);
      });
      
      // Should only have one cache entry despite multiple requests
      const stats = dataLoader.getCacheStats();
      expect(stats.size).toBe(1);
      
      // Concurrent access should be efficient
      expect(averageTime).toBeLessThan(50); // Each request should be fast due to caching
    });

    it('should manage cache size and memory efficiently', async () => {
      const sources: RDFDataSource[] = [];
      
      // Create many different data sources
      for (let i = 0; i < 50; i++) {
        sources.push({
          type: 'inline',
          source: `@prefix ex: <http://example.org/> . ex:entity${i} ex:name "Entity ${i}" .`,
          format: 'text/turtle'
        });
      }

      // Load all sources
      for (const source of sources) {
        const result = await dataLoader.loadFromSource(source);
        expect(result.success).toBe(true);
      }
      
      const stats = dataLoader.getCacheStats();
      expect(stats.size).toBe(50);
      expect(stats.keys).toHaveLength(50);
      
      console.log(`Cache contains ${stats.size} entries, total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
      
      // Cache size should be reasonable
      expect(stats.totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
      
      // Cleanup should work
      dataLoader.clearCache();
      const clearedStats = dataLoader.getCacheStats();
      expect(clearedStats.size).toBe(0);
      expect(clearedStats.totalSize).toBe(0);
    });

    it('should prioritize cache entries under memory pressure', async () => {
      // This test would require a more sophisticated cache implementation
      // For now, we test basic cache behavior
      
      const sources: RDFDataSource[] = [];
      
      // Create sources of varying sizes
      for (let i = 0; i < 10; i++) {
        const tripleCount = (i + 1) * 100; // 100, 200, 300, ... triples
        let turtle = '@prefix ex: <http://example.org/> .\n';
        
        for (let j = 0; j < tripleCount; j++) {
          turtle += `ex:entity${i}_${j} ex:value "${j}" .\n`;
        }
        
        sources.push({
          type: 'inline',
          source: turtle,
          format: 'text/turtle'
        });
      }

      const loadTimes: number[] = [];
      
      // Load all sources and measure times
      for (const [index, source] of sources.entries()) {
        const start = performance.now();
        const result = await dataLoader.loadFromSource(source);
        const end = performance.now();
        
        expect(result.success).toBe(true);
        loadTimes.push(end - start);
        
        console.log(`Source ${index}: ${result.data.triples.length} triples, ${(end - start).toFixed(2)}ms`);
      }
      
      // Reload first source (should be cached and fast)
      const cachedStart = performance.now();
      const cachedResult = await dataLoader.loadFromSource(sources[0]);
      const cachedEnd = performance.now();
      
      expect(cachedResult.success).toBe(true);
      expect(cachedEnd - cachedStart).toBeLessThan(loadTimes[0] / 2);
      
      console.log(`Cached reload: ${(cachedEnd - cachedStart).toFixed(2)}ms vs original ${loadTimes[0].toFixed(2)}ms`);
    });
  });

  describe('Query Performance Optimization', () => {
    it('should execute queries efficiently on cached data', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      const queryTypes = [
        // Subject queries
        () => rdfFilters.rdfObject('ex:acmeOrg', 'rdfs:label'),
        () => rdfFilters.rdfObject('ex:project1', 'ex:projectBudget'),
        
        // Type queries  
        () => rdfFilters.rdfSubject('rdf:type', 'ex:Organization'),
        () => rdfFilters.rdfSubject('rdf:type', 'ex:Project'),
        
        // Complex pattern queries
        () => rdfFilters.rdfQuery({ subject: null, predicate: 'ex:priority', object: 'high' }),
        () => rdfFilters.rdfQuery({ subject: null, predicate: 'ex:projectBudget', object: null }),
        
        // Count operations
        () => rdfFilters.rdfCount('ex:acmeOrg', 'ex:hasProject'),
        () => rdfFilters.rdfCount(null, 'rdf:type'),
        
        // Existence checks
        () => rdfFilters.rdfExists('ex:project1', 'ex:startDate'),
        () => rdfFilters.rdfExists('ex:nonexistent', 'ex:someProperty')
      ];
      
      const queryTimes: number[] = [];
      
      // Execute each query type multiple times
      for (const queryFn of queryTypes) {
        const iterations = 100;
        const start = performance.now();
        
        for (let i = 0; i < iterations; i++) {
          const queryResult = queryFn();
          expect(queryResult).toBeDefined();
        }
        
        const end = performance.now();
        const avgTime = (end - start) / iterations;
        queryTimes.push(avgTime);
      }
      
      const overallAvg = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);
      
      console.log(`Query performance - Average: ${overallAvg.toFixed(3)}ms, Max: ${maxQueryTime.toFixed(3)}ms`);
      
      expect(overallAvg).toBeLessThan(1); // Queries should be very fast
      expect(maxQueryTime).toBeLessThan(10); // Even complex queries should be fast
    });

    it('should maintain query performance with large result sets', async () => {
      // Create dataset with many matching results
      const tripleCount = 2000;
      let largeTurtle = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n';
      
      for (let i = 0; i < tripleCount; i++) {
        largeTurtle += `ex:person${i} a foaf:Person ;\n`;
        largeTurtle += `              foaf:name "Person ${i}" ;\n`;
        largeTurtle += `              ex:category "Category${i % 20}" .\n`;
      }

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: largeTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      // Query that returns many results
      const start1 = performance.now();
      const allPersons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      const end1 = performance.now();
      
      expect(allPersons).toHaveLength(tripleCount);
      
      // Query that returns fewer results
      const start2 = performance.now();
      const category0 = rdfFilters.rdfSubject('ex:category', 'Category0');
      const end2 = performance.now();
      
      expect(category0.length).toBe(tripleCount / 20); // 100 people in each category
      
      console.log(`Large result set query: ${(end1 - start1).toFixed(2)}ms for ${allPersons.length} results`);
      console.log(`Filtered query: ${(end2 - start2).toFixed(2)}ms for ${category0.length} results`);
      
      expect(end1 - start1).toBeLessThan(100); // Should handle large result sets efficiently
      expect(end2 - start2).toBeLessThan(50); // Filtered queries should be fast
    });

    it('should demonstrate filter performance with complex data structures', async () => {
      const complexTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix org: <http://www.w3.org/ns/org#> .
        
        ex:company a org:Organization ;
                   rdfs:label "Tech Corp" .
        
        ${Array(500).fill(0).map((_, i) => `
        ex:employee${i} a foaf:Person ;
                        foaf:name "Employee ${i}" ;
                        org:memberOf ex:company ;
                        ex:department "Dept${i % 10}" ;
                        ex:level "Level${Math.floor(i / 100) + 1}" ;
                        ex:salary "${30000 + i * 100}" .
        `).join('\n')}
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: complexTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      // Complex multi-step filtering
      const start = performance.now();
      
      const allEmployees = rdfFilters.rdfSubject('org:memberOf', 'ex:company');
      const dept0Employees = rdfFilters.rdfSubject('ex:department', 'Dept0');
      const level1Employees = rdfFilters.rdfSubject('ex:level', 'Level1');
      
      // Find employees in both Dept0 and Level1
      const intersection = dept0Employees.filter(emp => level1Employees.includes(emp));
      
      const end = performance.now();
      
      console.log(`Complex filtering completed in ${(end - start).toFixed(2)}ms`);
      console.log(`Results: ${allEmployees.length} total, ${dept0Employees.length} in Dept0, ${level1Employees.length} at Level1, ${intersection.length} intersection`);
      
      expect(allEmployees).toHaveLength(500);
      expect(dept0Employees).toHaveLength(50); // 10% of employees
      expect(end - start).toBeLessThan(100); // Should complete complex filtering quickly
    });
  });

  describe('Memory Efficiency and Cleanup', () => {
    it('should handle repeated cache operations without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many cache operations
      for (let cycle = 0; cycle < 5; cycle++) {
        console.log(`Memory test cycle ${cycle + 1}/5`);
        
        const sources: RDFDataSource[] = [];
        
        // Create multiple data sources
        for (let i = 0; i < 20; i++) {
          sources.push({
            type: 'inline',
            source: `@prefix ex: <http://example.org/> . ex:test${cycle}_${i} ex:value "${i}" .`,
            format: 'text/turtle'
          });
        }
        
        // Load all sources
        for (const source of sources) {
          const result = await dataLoader.loadFromSource(source);
          expect(result.success).toBe(true);
        }
        
        // Check cache size
        const stats = dataLoader.getCacheStats();
        expect(stats.size).toBeGreaterThan(0);
        
        // Clear cache
        dataLoader.clearCache();
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (currentMemory - initialMemory) / 1024 / 1024; // MB
        
        console.log(`Memory after cycle ${cycle + 1}: ${memoryIncrease.toFixed(2)}MB increase`);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const totalIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Total memory increase: ${totalIncrease.toFixed(2)}MB`);
      
      // Memory increase should be minimal
      expect(totalIncrease).toBeLessThan(20); // Less than 20MB increase
    });

    it('should efficiently handle cache cleanup under different load patterns', async () => {
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled: true,
        cacheTTL: 200, // 200ms
        templateDir: fixturesPath
      });

      // Pattern 1: Burst loading
      console.log('Testing burst load pattern...');
      const burstSources: RDFDataSource[] = [];
      for (let i = 0; i < 30; i++) {
        burstSources.push({
          type: 'inline',
          source: `@prefix ex: <http://example.org/> . ex:burst${i} ex:value ${i} .`,
          format: 'text/turtle'
        });
      }
      
      const burstStart = performance.now();
      const burstResults = await Promise.all(
        burstSources.map(source => shortTTLLoader.loadFromSource(source))
      );
      const burstEnd = performance.now();
      
      expect(burstResults.every(r => r.success)).toBe(true);
      console.log(`Burst load: ${burstSources.length} sources in ${(burstEnd - burstStart).toFixed(2)}ms`);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Cleanup expired entries
      const cleanedUp = shortTTLLoader.cleanupCache();
      console.log(`Cleaned up ${cleanedUp} expired entries`);
      expect(cleanedUp).toBe(burstSources.length);
      
      // Pattern 2: Steady state loading
      console.log('Testing steady state pattern...');
      for (let i = 0; i < 10; i++) {
        const source: RDFDataSource = {
          type: 'inline',
          source: `@prefix ex: <http://example.org/> . ex:steady${i} ex:value ${i} .`,
          format: 'text/turtle'
        };
        
        const result = await shortTTLLoader.loadFromSource(source);
        expect(result.success).toBe(true);
        
        // Small delay between loads
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const steadyStats = shortTTLLoader.getCacheStats();
      console.log(`Steady state: ${steadyStats.size} entries in cache`);
      expect(steadyStats.size).toBeGreaterThan(0);
      expect(steadyStats.size).toBeLessThanOrEqual(10);
    });
  });
});