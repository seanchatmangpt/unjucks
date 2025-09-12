/**
 * Production Scalability Stress Tests - RDF/Turtle Filters
 * Tests system behavior under extreme load and large data volumes
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { Store, DataFactory } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { SemanticFilters } from '../../src/lib/semantic/semantic-filters.js';

const { namedNode, literal, quad } = DataFactory;

// Stress test configuration
const STRESS_CONFIG = {
  MILLION_RECORD_SIZE: process.env.CI ? 50000 : 100000, // Reduced for CI
  CONCURRENT_USERS: process.env.CI ? 25 : 100,
  PEAK_LOAD_MULTIPLIER: 10,
  MAX_MEMORY_GROWTH_MB: 500,
  MAX_RESPONSE_TIME_MS: 30000,
  MIN_THROUGHPUT_OPS_SEC: 100
};

describe('Production Scalability Stress Tests', () => {
  let baselineMemory;
  let stressResults = {
    memoryPeaks: [],
    responseTimes: [],
    throughputs: [],
    errors: []
  };

  beforeAll(() => {
    baselineMemory = process.memoryUsage().heapUsed;
    console.log('🚀 Starting scalability stress tests...');
    console.log(`Baseline memory: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB`);
  });

  afterAll(() => {
    console.log('\n=== SCALABILITY STRESS TEST REPORT ===');
    console.log(`Memory peaks: ${stressResults.memoryPeaks.map(m => m.toFixed(2)).join(', ')}MB`);
    console.log(`Response times: min=${Math.min(...stressResults.responseTimes).toFixed(2)}ms, max=${Math.max(...stressResults.responseTimes).toFixed(2)}ms`);
    console.log(`Throughputs: ${stressResults.throughputs.map(t => t.toFixed(0)).join(', ')} ops/sec`);
    console.log(`Total errors: ${stressResults.errors.length}`);
    
    // Generate stress test metrics file
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      config: STRESS_CONFIG,
      results: stressResults,
      summary: {
        maxMemoryMB: Math.max(...stressResults.memoryPeaks),
        avgResponseTimeMs: stressResults.responseTimes.reduce((a, b) => a + b, 0) / stressResults.responseTimes.length,
        minThroughput: Math.min(...stressResults.throughputs)
      }
    };
    
    console.log('\n=== SUMMARY METRICS ===');
    console.log(JSON.stringify(report.summary, null, 2));
  });

  describe('Million-Record Dataset Processing', () => {
    test('Handle large dataset creation and queries', async () => {
      console.log(`Creating dataset with ${STRESS_CONFIG.MILLION_RECORD_SIZE} records...`);
      
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      // Create large dataset
      const largeStore = await createMassiveDataset(STRESS_CONFIG.MILLION_RECORD_SIZE);
      const rdfFilters = new RDFFilters({ store: largeStore });
      
      const creationTime = performance.now() - startTime;
      const afterCreationMemory = process.memoryUsage().heapUsed;
      const memoryUsedMB = (afterCreationMemory - startMemory) / 1024 / 1024;
      
      console.log(`Dataset created in ${creationTime.toFixed(2)}ms, using ${memoryUsedMB.toFixed(2)}MB`);
      
      // Test basic queries on large dataset
      const queryStart = performance.now();
      
      // Query 1: Count all persons
      const personCount = rdfFilters.rdfCount('?s', 'rdf:type', 'foaf:Person');
      
      // Query 2: Find all managers
      const managers = rdfFilters.rdfObject('?person', 'ex:role');
      
      // Query 3: Complex relationship query
      const relationships = largeStore.getQuads(null, namedNode('http://xmlns.com/foaf/0.1/knows'), null, null);
      
      const queryTime = performance.now() - queryStart;
      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryMB = (finalMemory - baselineMemory) / 1024 / 1024;
      
      // Validate results
      expect(personCount).toBeGreaterThan(STRESS_CONFIG.MILLION_RECORD_SIZE * 0.9); // Allow for some variance
      expect(queryTime).toBeLessThan(STRESS_CONFIG.MAX_RESPONSE_TIME_MS);
      expect(totalMemoryMB).toBeLessThan(STRESS_CONFIG.MAX_MEMORY_GROWTH_MB);
      
      // Record metrics
      stressResults.memoryPeaks.push(totalMemoryMB);
      stressResults.responseTimes.push(queryTime);
      
      console.log(`✅ Large dataset test: ${personCount} persons, ${relationships.length} relationships`);
      console.log(`   Query time: ${queryTime.toFixed(2)}ms`);
      console.log(`   Memory usage: ${totalMemoryMB.toFixed(2)}MB`);
    }, 60000); // 60 second timeout

    test('Sustained query load on large dataset', async () => {
      console.log('Testing sustained query load...');
      
      const store = await createMassiveDataset(STRESS_CONFIG.MILLION_RECORD_SIZE / 10); // Smaller for sustained test
      const rdfFilters = new RDFFilters({ store });
      
      const testDuration = 10000; // 10 seconds
      const startTime = this.getDeterministicTimestamp();
      let queryCount = 0;
      let errors = 0;
      
      const memoryCheckInterval = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryMB = (currentMemory - baselineMemory) / 1024 / 1024;
        stressResults.memoryPeaks.push(memoryMB);
      }, 1000);
      
      while (this.getDeterministicTimestamp() - startTime < testDuration) {
        try {
          // Rotate through different query types
          const queryType = queryCount % 4;
          
          switch (queryType) {
            case 0:
              rdfFilters.rdfType(`ex:person${queryCount % 1000}`);
              break;
            case 1:
              rdfFilters.rdfLabel(`ex:person${queryCount % 1000}`);
              break;
            case 2:
              rdfFilters.rdfExists(`ex:person${queryCount % 1000}`, 'foaf:name', null);
              break;
            case 3:
              rdfFilters.rdfObject(`ex:person${queryCount % 1000}`, 'foaf:knows');
              break;
          }
          
          queryCount++;
        } catch (error) {
          errors++;
          stressResults.errors.push({
            error: error.message,
            queryCount,
            timestamp: this.getDeterministicTimestamp()
          });
        }
      }
      
      clearInterval(memoryCheckInterval);
      
      const actualDuration = this.getDeterministicTimestamp() - startTime;
      const throughput = (queryCount * 1000) / actualDuration; // queries per second
      const errorRate = (errors / queryCount) * 100;
      
      stressResults.throughputs.push(throughput);
      
      expect(throughput).toBeGreaterThan(STRESS_CONFIG.MIN_THROUGHPUT_OPS_SEC);
      expect(errorRate).toBeLessThan(1); // Less than 1% error rate
      
      console.log(`✅ Sustained load test: ${queryCount} queries in ${actualDuration}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} ops/sec`);
      console.log(`   Error rate: ${errorRate.toFixed(2)}%`);
    }, 30000); // 30 second timeout
  });

  describe('Concurrent User Simulation', () => {
    test('Handle concurrent users without degradation', async () => {
      console.log(`Simulating ${STRESS_CONFIG.CONCURRENT_USERS} concurrent users...`);
      
      const store = await createMassiveDataset(10000); // Moderate size for concurrency test
      const promises = [];
      const userResults = [];
      
      const startTime = performance.now();
      
      // Create concurrent user simulations
      for (let userId = 0; userId < STRESS_CONFIG.CONCURRENT_USERS; userId++) {
        promises.push(simulateUser(store, userId, userResults));
      }
      
      await Promise.all(promises);
      
      const totalTime = performance.now() - startTime;
      const avgUserTime = userResults.reduce((sum, result) => sum + result.duration, 0) / userResults.length;
      const maxUserTime = Math.max(...userResults.map(r => r.duration));
      const minUserTime = Math.min(...userResults.map(r => r.duration));
      
      stressResults.responseTimes.push(avgUserTime, maxUserTime, minUserTime);
      
      // Validate concurrent performance
      expect(maxUserTime).toBeLessThan(10000); // No user should wait more than 10 seconds
      expect(avgUserTime).toBeLessThan(5000);   // Average should be under 5 seconds
      
      // Check for fairness - no user should be significantly slower
      const timeVariance = maxUserTime / minUserTime;
      expect(timeVariance).toBeLessThan(5); // Max 5x difference between fastest and slowest
      
      console.log(`✅ Concurrent users test: ${STRESS_CONFIG.CONCURRENT_USERS} users`);
      console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`   Avg user time: ${avgUserTime.toFixed(2)}ms`);
      console.log(`   Time range: ${minUserTime.toFixed(2)}ms - ${maxUserTime.toFixed(2)}ms`);
      console.log(`   Time variance: ${timeVariance.toFixed(2)}x`);
    }, 45000); // 45 second timeout

    test('Peak load handling (10x normal load)', async () => {
      console.log('Testing peak load handling...');
      
      const store = await createMassiveDataset(5000); // Smaller dataset for peak load test
      const peakUsers = STRESS_CONFIG.CONCURRENT_USERS * STRESS_CONFIG.PEAK_LOAD_MULTIPLIER;
      
      console.log(`Simulating ${peakUsers} concurrent peak users...`);
      
      const promises = [];
      const peakResults = [];
      const startMemory = process.memoryUsage().heapUsed;
      
      const startTime = performance.now();
      
      // Create peak load
      for (let userId = 0; userId < peakUsers; userId++) {
        promises.push(simulatePeakUser(store, userId, peakResults));
      }
      
      // Monitor memory during peak
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryMB = (currentMemory - startMemory) / 1024 / 1024;
        stressResults.memoryPeaks.push(memoryMB);
      }, 500);
      
      await Promise.allSettled(promises); // Use allSettled to handle potential failures gracefully
      clearInterval(memoryMonitor);
      
      const totalTime = performance.now() - startTime;
      const successfulUsers = peakResults.filter(r => r.success).length;
      const failedUsers = peakResults.filter(r => !r.success).length;
      const successRate = (successfulUsers / peakUsers) * 100;
      
      const avgSuccessfulTime = successfulUsers > 0 
        ? peakResults.filter(r => r.success).reduce((sum, result) => sum + result.duration, 0) / successfulUsers
        : 0;
      
      // Record peak load metrics
      stressResults.throughputs.push((successfulUsers * 1000) / totalTime);
      if (avgSuccessfulTime > 0) {
        stressResults.responseTimes.push(avgSuccessfulTime);
      }
      
      // Peak load should handle at least 70% of requests successfully
      expect(successRate).toBeGreaterThan(70);
      
      console.log(`✅ Peak load test: ${peakUsers} peak users`);
      console.log(`   Success rate: ${successRate.toFixed(2)}% (${successfulUsers}/${peakUsers})`);
      console.log(`   Failed users: ${failedUsers}`);
      console.log(`   Avg successful time: ${avgSuccessfulTime.toFixed(2)}ms`);
      console.log(`   Total test time: ${totalTime.toFixed(2)}ms`);
    }, 60000); // 60 second timeout
  });

  describe('Memory Stress and Leak Detection', () => {
    test('Memory stability under repeated operations', async () => {
      console.log('Testing memory stability...');
      
      const iterations = 1000;
      const memoryCheckpoints = [];
      
      // Create moderate dataset
      const store = await createMassiveDataset(5000);
      const rdfFilters = new RDFFilters({ store });
      
      // Record initial memory
      memoryCheckpoints.push(process.memoryUsage().heapUsed);
      
      // Perform repeated operations with periodic memory checks
      for (let i = 0; i < iterations; i++) {
        // Mix of different operations
        rdfFilters.rdfType(`ex:person${i % 1000}`);
        rdfFilters.rdfLabel(`ex:person${i % 1000}`);
        rdfFilters.rdfQuery({ subject: `ex:person${i % 1000}`, predicate: 'foaf:knows', object: null });
        
        // Check memory every 100 iterations
        if (i % 100 === 0) {
          // Force GC if available
          if (global.gc) {
            global.gc();
          }
          memoryCheckpoints.push(process.memoryUsage().heapUsed);
        }
      }
      
      // Final memory check
      if (global.gc) {
        global.gc();
      }
      memoryCheckpoints.push(process.memoryUsage().heapUsed);
      
      // Analyze memory growth
      const initialMemory = memoryCheckpoints[0];
      const finalMemory = memoryCheckpoints[memoryCheckpoints.length - 1];
      const maxMemory = Math.max(...memoryCheckpoints);
      
      const totalGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      const maxGrowthMB = (maxMemory - initialMemory) / 1024 / 1024;
      
      stressResults.memoryPeaks.push(totalGrowthMB, maxGrowthMB);
      
      // Memory growth should be reasonable
      expect(totalGrowthMB).toBeLessThan(200); // Less than 200MB total growth
      expect(maxGrowthMB).toBeLessThan(300);   // Less than 300MB peak growth
      
      console.log(`✅ Memory stability test: ${iterations} iterations`);
      console.log(`   Total growth: ${totalGrowthMB.toFixed(2)}MB`);
      console.log(`   Peak growth: ${maxGrowthMB.toFixed(2)}MB`);
      console.log(`   Memory checkpoints: ${memoryCheckpoints.length}`);
    });

    test('Resource cleanup after bulk operations', async () => {
      console.log('Testing resource cleanup...');
      
      const initialMemory = process.memoryUsage().heapUsed;
      let peakMemory = initialMemory;
      
      // Perform bulk operations that should be cleaned up
      for (let batch = 0; batch < 10; batch++) {
        // Create temporary large data
        const tempStore = await createMassiveDataset(2000);
        const tempFilters = new RDFFilters({ store: tempStore });
        
        // Perform intensive operations
        for (let i = 0; i < 100; i++) {
          tempFilters.rdfQuery('?s ?p ?o');
          tempFilters.rdfCount('?s', 'rdf:type', 'foaf:Person');
        }
        
        // Check peak memory
        const currentMemory = process.memoryUsage().heapUsed;
        peakMemory = Math.max(peakMemory, currentMemory);
        
        // Clear references (simulating cleanup)
        tempStore.removeQuads(tempStore.getQuads(null, null, null, null));
      }
      
      // Force cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100)); // Let GC complete
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      
      const peakGrowthMB = (peakMemory - initialMemory) / 1024 / 1024;
      const residualGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      const cleanupEfficiency = ((peakGrowthMB - residualGrowthMB) / peakGrowthMB) * 100;
      
      stressResults.memoryPeaks.push(peakGrowthMB, residualGrowthMB);
      
      // Most memory should be cleaned up
      expect(cleanupEfficiency).toBeGreaterThan(50); // At least 50% cleanup
      expect(residualGrowthMB).toBeLessThan(100);    // Less than 100MB residual
      
      console.log(`✅ Resource cleanup test:`);
      console.log(`   Peak growth: ${peakGrowthMB.toFixed(2)}MB`);
      console.log(`   Residual growth: ${residualGrowthMB.toFixed(2)}MB`);
      console.log(`   Cleanup efficiency: ${cleanupEfficiency.toFixed(2)}%`);
    });
  });
});

// Helper function to create massive dataset for stress testing
async function createMassiveDataset(size) {
  console.log(`Creating massive dataset with ${size} entities...`);
  const store = new Store();
  
  const batchSize = 1000;
  let processed = 0;
  
  while (processed < size) {
    const currentBatch = Math.min(batchSize, size - processed);
    
    for (let i = 0; i < currentBatch; i++) {
      const id = processed + i;
      const person = namedNode(`http://example.org/person${id}`);
      
      // Basic properties
      store.addQuad(quad(person, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person')));
      store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/name'), literal(`Person ${id}`)));
      store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/age'), literal(String(20 + (id % 60)))));
      store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/mbox'), literal(`person${id}@example.org`)));
      
      // Additional properties for complexity
      if (id % 5 === 0) {
        store.addQuad(quad(person, namedNode('http://example.org/role'), literal('Manager')));
        store.addQuad(quad(person, namedNode('http://example.org/salary'), literal(String(50000 + (id % 50000)))));
      }
      
      if (id % 3 === 0) {
        store.addQuad(quad(person, namedNode('http://example.org/department'), literal(`Dept${id % 20}`)));
      }
      
      // Relationships
      if (id > 0) {
        const colleague = namedNode(`http://example.org/person${id - 1}`);
        store.addQuad(quad(person, namedNode('http://xmlns.com/foaf/0.1/knows'), colleague));
      }
      
      if (id > 10) {
        const manager = namedNode(`http://example.org/person${Math.floor(id / 10)}`);
        store.addQuad(quad(person, namedNode('http://example.org/reportsTo'), manager));
      }
    }
    
    processed += currentBatch;
    
    // Progress indicator for large datasets
    if (processed % 10000 === 0 || processed === size) {
      console.log(`  Created ${processed}/${size} entities (${((processed/size)*100).toFixed(1)}%)`);
    }
  }
  
  console.log(`✅ Dataset created: ${store.size} triples for ${size} entities`);
  return store;
}

// Simulate a normal user performing typical operations
async function simulateUser(store, userId, results) {
  const startTime = performance.now();
  let success = true;
  
  try {
    const rdfFilters = new RDFFilters({ store });
    
    // Simulate user workflow: browse, search, query
    for (let operation = 0; operation < 10; operation++) {
      const entityId = Math.floor(Math.random() * 1000);
      
      // Random operations
      switch (operation % 5) {
        case 0:
          rdfFilters.rdfType(`ex:person${entityId}`);
          break;
        case 1:
          rdfFilters.rdfLabel(`ex:person${entityId}`);
          break;
        case 2:
          rdfFilters.rdfObject(`ex:person${entityId}`, 'foaf:knows');
          break;
        case 3:
          rdfFilters.rdfExists(`ex:person${entityId}`, 'foaf:name', null);
          break;
        case 4:
          rdfFilters.rdfQuery({ subject: `ex:person${entityId}`, predicate: null, object: null });
          break;
      }
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    success = false;
    console.warn(`User ${userId} failed:`, error.message);
  }
  
  const duration = performance.now() - startTime;
  results.push({ userId, duration, success });
}

// Simulate a peak load user with faster operations
async function simulatePeakUser(store, userId, results) {
  const startTime = performance.now();
  let success = true;
  
  try {
    const rdfFilters = new RDFFilters({ store });
    
    // Faster operations for peak load
    for (let operation = 0; operation < 5; operation++) {
      const entityId = Math.floor(Math.random() * 1000);
      rdfFilters.rdfExists(`ex:person${entityId}`, 'rdf:type', 'foaf:Person');
      
      // No delay - peak load
    }
  } catch (error) {
    success = false;
  }
  
  const duration = performance.now() - startTime;
  results.push({ userId, duration, success });
}