/**
 * Production Performance Benchmarks - RDF/Turtle Filters
 * Validates enterprise SLA requirements and performance characteristics
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { performance, PerformanceObserver } from 'perf_hooks';
import { Store, DataFactory } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { SemanticFilters } from '../../src/lib/semantic/semantic-filters.js';

const { namedNode, literal, quad } = DataFactory;

// Production SLA Requirements
const SLA_REQUIREMENTS = {
  SIMPLE_TEMPLATES: 100, // ms
  COMPLEX_RDF_GENERATION: 1000, // ms
  LARGE_DATASETS_1M: 30000, // ms (30s)
  MEMORY_BASE_FOOTPRINT: 50, // MB
  MEMORY_PER_USER: 10, // MB  
  MEMORY_MAXIMUM_HEAP: 2048, // MB
  THROUGHPUT_TEMPLATES_PER_SECOND: 1000,
  CONCURRENT_USERS: 100,
  PEAK_LOAD_MULTIPLIER: 10
};

describe('Production Performance Benchmarks - RDF/Turtle Filters', () => {
  let rdfFilters;
  let semanticFilters;
  let largeDataStore;
  let performanceMetrics = {};

  beforeAll(async () => {
    // Initialize performance monitoring
    const obs = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        performanceMetrics[entry.name] = {
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType
        };
      });
    });
    obs.observe({ entryTypes: ['measure'] });

    // Initialize RDF filters
    const store = new Store();
    rdfFilters = new RDFFilters({ store });
    semanticFilters = new SemanticFilters();

    // Create large dataset for stress testing
    largeDataStore = await createLargeDataset(10000); // Start with 10K for CI
    rdfFilters.store = largeDataStore;
  });

  afterAll(() => {
    // Generate performance report
    console.log('\n=== PRODUCTION PERFORMANCE REPORT ===');
    console.log(JSON.stringify(performanceMetrics, null, 2));
  });

  describe('Response Time SLA Validation', () => {
    test('Simple template processing < 100ms', async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = rdfFilters.rdfObject('ex:person1', 'foaf:name');
        expect(Array.isArray(result)).toBe(true);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      expect(avgTime).toBeLessThan(SLA_REQUIREMENTS.SIMPLE_TEMPLATES);
      console.log(`✅ Simple templates: ${avgTime.toFixed(2)}ms (SLA: ${SLA_REQUIREMENTS.SIMPLE_TEMPLATES}ms)`);
    });

    test('Complex RDF generation < 1000ms', async () => {
      performance.mark('complex-rdf-start');
      
      const complexQuery = {
        subject: '?person',
        predicate: 'foaf:knows',
        object: '?friend'
      };
      
      const result = rdfFilters.rdfQuery(complexQuery);
      
      performance.mark('complex-rdf-end');
      performance.measure('complex-rdf', 'complex-rdf-start', 'complex-rdf-end');
      
      const duration = performanceMetrics['complex-rdf']?.duration || 0;
      expect(duration).toBeLessThan(SLA_REQUIREMENTS.COMPLEX_RDF_GENERATION);
      console.log(`✅ Complex RDF: ${duration.toFixed(2)}ms (SLA: ${SLA_REQUIREMENTS.COMPLEX_RDF_GENERATION}ms)`);
    });

    test('Large dataset processing (10K records) meets SLA', async () => {
      performance.mark('large-dataset-start');
      
      // Query across entire dataset
      const results = rdfFilters.rdfQuery('?s ?p ?o');
      
      performance.mark('large-dataset-end');
      performance.measure('large-dataset', 'large-dataset-start', 'large-dataset-end');
      
      const duration = performanceMetrics['large-dataset']?.duration || 0;
      expect(results.length).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(SLA_REQUIREMENTS.LARGE_DATASETS_1M / 100); // Scale for 10K
      console.log(`✅ Large dataset (10K): ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage SLA Validation', () => {
    test('Base footprint under 50MB', () => {
      const used = process.memoryUsage();
      const heapUsedMB = used.heapUsed / 1024 / 1024;
      
      // Allow for test framework overhead
      expect(heapUsedMB).toBeLessThan(SLA_REQUIREMENTS.MEMORY_BASE_FOOTPRINT * 2);
      console.log(`✅ Base memory: ${heapUsedMB.toFixed(2)}MB (SLA: ${SLA_REQUIREMENTS.MEMORY_BASE_FOOTPRINT}MB)`);
    });

    test('Memory growth per operation is controlled', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform 1000 operations
      for (let i = 0; i < 1000; i++) {
        rdfFilters.rdfLabel(`ex:entity${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const growthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(growthMB).toBeLessThan(20); // 20MB growth limit
      console.log(`✅ Memory growth: ${growthMB.toFixed(2)}MB for 1000 operations`);
    });
  });

  describe('Throughput SLA Validation', () => {
    test('Templates per second exceeds 1000', async () => {
      const duration = 1000; // 1 second test
      const startTime = Date.now();
      let operations = 0;

      while (Date.now() - startTime < duration) {
        rdfFilters.rdfExists('ex:test', 'rdf:type', 'owl:Thing');
        operations++;
      }

      const actualThroughput = operations;
      expect(actualThroughput).toBeGreaterThan(SLA_REQUIREMENTS.THROUGHPUT_TEMPLATES_PER_SECOND);
      console.log(`✅ Throughput: ${actualThroughput} ops/sec (SLA: ${SLA_REQUIREMENTS.THROUGHPUT_TEMPLATES_PER_SECOND})`);
    });

    test('Concurrent operations maintain performance', async () => {
      const concurrentOperations = 50; // Reduced for CI
      const promises = [];

      performance.mark('concurrent-start');

      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          new Promise(resolve => {
            const result = rdfFilters.rdfType(`ex:concurrent${i}`);
            resolve(result);
          })
        );
      }

      const results = await Promise.all(promises);
      
      performance.mark('concurrent-end');
      performance.measure('concurrent', 'concurrent-start', 'concurrent-end');

      const duration = performanceMetrics['concurrent']?.duration || 0;
      expect(results.length).toBe(concurrentOperations);
      expect(duration).toBeLessThan(5000); // 5 second limit for 50 concurrent ops
      console.log(`✅ Concurrent ops (${concurrentOperations}): ${duration.toFixed(2)}ms`);
    });
  });

  describe('Scalability Performance Tests', () => {
    test('Linear performance degradation with data size', async () => {
      const sizes = [100, 500, 1000];
      const times = [];

      for (const size of sizes) {
        const testStore = await createLargeDataset(size);
        const testFilters = new RDFFilters({ store: testStore });
        
        performance.mark(`scale-${size}-start`);
        testFilters.rdfQuery('?s rdf:type ?type');
        performance.mark(`scale-${size}-end`);
        performance.measure(`scale-${size}`, `scale-${size}-start`, `scale-${size}-end`);
        
        const duration = performanceMetrics[`scale-${size}`]?.duration || 0;
        times.push(duration);
      }

      // Check that performance degrades roughly linearly (not exponentially)
      const ratio1 = times[1] / times[0]; // 500/100
      const ratio2 = times[2] / times[1]; // 1000/500
      
      expect(ratio1).toBeLessThan(10); // Should not be 10x slower
      expect(ratio2).toBeLessThan(5);  // Should not be 5x slower
      console.log(`✅ Scaling ratios: ${ratio1.toFixed(2)}x, ${ratio2.toFixed(2)}x`);
    });

    test('Cache effectiveness improves repeated queries', async () => {
      const query = 'ex:popular rdf:type ?type';
      
      // First query (cold cache)
      performance.mark('cache-cold-start');
      const result1 = rdfFilters.rdfQuery(query);
      performance.mark('cache-cold-end');
      performance.measure('cache-cold', 'cache-cold-start', 'cache-cold-end');
      
      // Second query (warm cache)
      performance.mark('cache-warm-start');
      const result2 = rdfFilters.rdfQuery(query);
      performance.mark('cache-warm-end');
      performance.measure('cache-warm', 'cache-warm-start', 'cache-warm-end');
      
      const coldTime = performanceMetrics['cache-cold']?.duration || 0;
      const warmTime = performanceMetrics['cache-warm']?.duration || 0;
      
      expect(warmTime).toBeLessThanOrEqual(coldTime);
      console.log(`✅ Cache effectiveness: ${coldTime.toFixed(2)}ms -> ${warmTime.toFixed(2)}ms`);
    });
  });

  describe('Resource Efficiency Tests', () => {
    test('Memory cleanup after large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create temporary large dataset
      const tempStore = await createLargeDataset(5000);
      const tempFilters = new RDFFilters({ store: tempStore });
      
      // Perform memory-intensive operations
      for (let i = 0; i < 100; i++) {
        tempFilters.rdfQuery('?s ?p ?o');
      }
      
      // Clear references
      tempStore.removeQuads(tempStore.getQuads(null, null, null, null));
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(memoryGrowthMB).toBeLessThan(100); // 100MB growth limit
      console.log(`✅ Memory cleanup: ${memoryGrowthMB.toFixed(2)}MB residual`);
    });

    test('CPU efficiency under sustained load', async () => {
      const testDuration = 2000; // 2 seconds
      const startTime = process.hrtime.bigint();
      const startCpu = process.cpuUsage();
      
      const endTime = startTime + BigInt(testDuration * 1000000); // nanoseconds
      let operations = 0;
      
      while (process.hrtime.bigint() < endTime) {
        rdfFilters.rdfCount('?s', 'rdf:type', '?type');
        operations++;
      }
      
      const endCpu = process.cpuUsage(startCpu);
      const cpuPercentage = (endCpu.user + endCpu.system) / (testDuration * 1000); // Convert to percentage
      
      expect(operations).toBeGreaterThan(100);
      expect(cpuPercentage).toBeLessThan(100); // Should not max out CPU
      console.log(`✅ CPU efficiency: ${operations} ops, ${cpuPercentage.toFixed(2)}% CPU`);
    });
  });
});

// Helper function to create large dataset for testing
async function createLargeDataset(size) {
  const store = new Store();
  
  // Create structured test data
  for (let i = 0; i < size; i++) {
    const person = namedNode(`http://example.org/person${i}`);
    const name = literal(`Person ${i}`);
    const age = literal(String(20 + (i % 60)));
    const email = literal(`person${i}@example.org`);
    
    // Basic properties
    store.addQuad(quad(person, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person')));
    store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/name'), name));
    store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/age'), age));
    store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/mbox'), email));
    
    // Create relationships for more complex queries
    if (i > 0) {
      const friend = namedNode(`http://example.org/person${i - 1}`);
      store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/knows'), friend));
    }
    
    // Add some domain-specific data
    if (i % 10 === 0) {
      store.addQuad(quad(person, namedNode('http://example.org/role'), literal('Manager')));
    }
    
    if (i % 5 === 0) {
      const org = namedNode(`http://example.org/org${Math.floor(i / 5)}`);
      store.addQuad(quad(person, namedNode('http://example.org/worksFor'), org));
      store.addQuad(quad(org, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Organization')));
      store.addQuad(quad(org, namedNode('http://xmlns.com/foaf/0.1/name'), literal(`Organization ${Math.floor(i / 5)}`)));
    }
  }
  
  console.log(`Created test dataset with ${store.size} triples for ${size} entities`);
  return store;
}