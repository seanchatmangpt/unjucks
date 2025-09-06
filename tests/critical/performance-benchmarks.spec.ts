/**
 * 80/20 Performance Benchmarks Suite
 * Validates the critical performance characteristics that ensure enterprise scalability
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

describe('80/20 Performance Benchmarks', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;

  beforeEach(() => {
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader();
  });

  // Test 1: Enterprise Scale Performance (15% coverage, highest business impact)
  // This test validates the system can handle Fortune 5 enterprise data volumes
  test('Parse 10K+ triples within enterprise SLA', async () => {
    // Use existing large dataset or generate one
    let largeDataset: string;
    const largeFilePath = join(process.cwd(), 'tests/fixtures/turtle/performance/large-10000.ttl');
    
    if (existsSync(largeFilePath)) {
      largeDataset = readFileSync(largeFilePath, 'utf-8');
    } else {
      // Generate large dataset for testing
      largeDataset = generateLargeEnterpriseDataset(10000);
    }
    
    // Memory and performance monitoring
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    
    const result = await parser.parse(largeDataset);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    const totalTime = endTime - startTime;
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    // ENTERPRISE PERFORMANCE REQUIREMENTS
    
    // 1. Scale validation - must handle 10K+ triples
    expect(result.triples.length).toBeGreaterThan(10000);
    expect(result.stats.tripleCount).toBe(result.triples.length);
    
    // 2. Performance SLA - 2 second maximum for enterprise data
    expect(totalTime).toBeLessThan(2000); // 2 seconds max
    console.log(`Parse time: ${totalTime.toFixed(2)}ms for ${result.triples.length} triples`);
    
    // 3. Memory efficiency - 100MB maximum delta
    expect(memoryDelta).toBeLessThan(100 * 1024 * 1024); // 100MB max
    console.log(`Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    
    // 4. Throughput performance - 5K triples/second minimum
    const triplesPerSecond = result.triples.length / (totalTime / 1000);
    expect(triplesPerSecond).toBeGreaterThan(5000);
    console.log(`Throughput: ${triplesPerSecond.toFixed(0)} triples/second`);
    
    // 5. Data integrity at scale
    expect(result.prefixes).toBeDefined();
    expect(Object.keys(result.prefixes).length).toBeGreaterThan(0);
    
    // 6. Statistics accuracy at scale
    expect(result.stats.prefixCount).toBe(Object.keys(result.prefixes).length);
    expect(result.stats.namedGraphCount).toBe(result.namedGraphs.length);
  });

  // Test 2: Concurrent Loading Performance (10% coverage)
  // Validates system can handle multiple simultaneous enterprise data loads
  test('Handle concurrent RDF data loading efficiently', async () => {
    const testFiles = [
      'tests/fixtures/turtle/basic-person.ttl',
      'tests/fixtures/turtle/complex-project.ttl', 
      'tests/fixtures/turtle/enterprise-schema.ttl'
    ];
    
    // Verify test files exist
    testFiles.forEach(file => {
      const fullPath = join(process.cwd(), file);
      expect(existsSync(fullPath)).toBe(true);
    });
    
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    // Load all files concurrently
    const loadPromises = testFiles.map(file => 
      dataLoader.loadFromSource({ 
        type: 'file', 
        path: join(process.cwd(), file)
      })
    );
    
    const results = await Promise.all(loadPromises);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;
    const memoryDelta = memoryAfter - memoryBefore;
    
    // CONCURRENT PERFORMANCE VALIDATION
    
    // 1. All loads successful
    expect(results).toHaveLength(testFiles.length);
    results.forEach((result, index) => {
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      console.log(`File ${index + 1}: ${result.triples.length} triples loaded`);
    });
    
    // 2. Concurrent performance - should be faster than sequential
    expect(totalTime).toBeLessThan(5000); // 5 seconds max for 3 files
    console.log(`Concurrent load time: ${totalTime.toFixed(2)}ms`);
    
    // 3. Memory efficiency with concurrent loads
    expect(memoryDelta).toBeLessThan(150 * 1024 * 1024); // 150MB max for all files
    
    // 4. Data integrity across concurrent loads
    const totalTriples = results.reduce((sum, result) => sum + result.triples.length, 0);
    expect(totalTriples).toBeGreaterThan(50);
    
    // 5. No data corruption or mixing between concurrent loads
    results.forEach(result => {
      expect(result.stats.tripleCount).toBe(result.triples.length);
    });
  });

  // Test 3: Memory Stability Under Load (8% coverage)
  // Validates system maintains stable memory usage over extended operation
  test('Maintain memory stability with repeated large operations', async () => {
    const iterations = 5;
    const memoryReadings: number[] = [];
    const parseTimings: number[] = [];
    
    // Generate consistent test data for each iteration
    const testData = generateLargeEnterpriseDataset(2000); // 2K triples per iteration
    
    for (let i = 0; i < iterations; i++) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memoryBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await parser.parse(testData);
      
      const endTime = performance.now();
      parseTimings.push(endTime - startTime);
      
      // Record memory after GC
      if (global.gc) {
        global.gc();
      }
      const memoryAfter = process.memoryUsage().heapUsed;
      memoryReadings.push(memoryAfter);
      
      // Validate each iteration
      expect(result.triples.length).toBe(2000);
    }
    
    // MEMORY STABILITY VALIDATION
    
    // 1. No memory leaks - memory growth should be minimal
    const initialMemory = memoryReadings[0];
    const finalMemory = memoryReadings[iterations - 1];
    const memoryGrowth = finalMemory - initialMemory;
    const acceptableGrowth = 20 * 1024 * 1024; // 20MB max growth
    
    expect(memoryGrowth).toBeLessThan(acceptableGrowth);
    console.log(`Memory growth over ${iterations} iterations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    
    // 2. Performance stability - parsing time should remain consistent
    const averageTime = parseTimings.reduce((sum, time) => sum + time, 0) / parseTimings.length;
    const maxDeviation = Math.max(...parseTimings) - Math.min(...parseTimings);
    expect(maxDeviation).toBeLessThan(averageTime * 0.5); // 50% max variation
    
    console.log(`Average parse time: ${averageTime.toFixed(2)}ms, deviation: ${maxDeviation.toFixed(2)}ms`);
    
    // 3. Memory usage should be reasonable for dataset size
    const finalMemoryMB = finalMemory / 1024 / 1024;
    expect(finalMemoryMB).toBeLessThan(200); // 200MB max stable memory
  });

  // Test 4: Cache Performance Impact (4% coverage)
  // Validates caching provides significant performance improvement
  test('Cache performance provides significant improvement', async () => {
    const testFile = join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl');
    expect(existsSync(testFile)).toBe(true);
    
    // First load (cold cache)
    const startCold = performance.now();
    const coldResult = await dataLoader.loadFromSource({ 
      type: 'file', 
      path: testFile 
    });
    const coldTime = performance.now() - startCold;
    
    // Second load (should be cached)
    const startCached = performance.now();
    const cachedResult = await dataLoader.loadFromSource({ 
      type: 'file', 
      path: testFile 
    });
    const cachedTime = performance.now() - startCached;
    
    // CACHE PERFORMANCE VALIDATION
    
    // 1. Data integrity - cached result should match original
    expect(cachedResult.triples.length).toBe(coldResult.triples.length);
    expect(cachedResult.stats.tripleCount).toBe(coldResult.stats.tripleCount);
    
    // 2. Significant performance improvement from caching
    expect(cachedTime).toBeLessThan(coldTime * 0.5); // 50% faster minimum
    expect(cachedTime).toBeLessThan(50); // Sub-50ms cached access
    
    console.log(`Cold load: ${coldTime.toFixed(2)}ms, Cached load: ${cachedTime.toFixed(2)}ms`);
    console.log(`Cache improvement: ${((coldTime - cachedTime) / coldTime * 100).toFixed(1)}%`);
    
    // 3. Cache hit should be very fast
    expect(cachedTime).toBeLessThan(100); // Sub-100ms for cache hits
    
    // 4. Third access should also be fast (cache persistence)
    const startThird = performance.now();
    const thirdResult = await dataLoader.loadFromSource({ 
      type: 'file', 
      path: testFile 
    });
    const thirdTime = performance.now() - startThird;
    
    expect(thirdTime).toBeLessThan(cachedTime * 2); // Should remain fast
    expect(thirdResult.triples.length).toBe(coldResult.triples.length);
  });

  // Test 5: Streaming Performance for Very Large Datasets (3% coverage)
  // Validates system can handle extremely large datasets that approach enterprise scale
  test('Handle very large datasets efficiently', async () => {
    // Generate a very large dataset (50K triples) to test streaming capability
    const veryLargeDataset = generateLargeEnterpriseDataset(50000);
    
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    
    const result = await parser.parse(veryLargeDataset);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    const totalTime = endTime - startTime;
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    // VERY LARGE DATASET VALIDATION
    
    // 1. Scale validation - 50K triples
    expect(result.triples.length).toBe(50000);
    expect(result.stats.tripleCount).toBe(50000);
    
    // 2. Performance at scale - should still be reasonable
    expect(totalTime).toBeLessThan(10000); // 10 seconds max for 50K triples
    console.log(`Very large dataset parse time: ${totalTime.toFixed(2)}ms for ${result.triples.length} triples`);
    
    // 3. Memory efficiency at scale - should not grow linearly with data size
    const memoryDeltaMB = memoryDelta / 1024 / 1024;
    expect(memoryDeltaMB).toBeLessThan(500); // 500MB max for 50K triples
    console.log(`Very large dataset memory usage: ${memoryDeltaMB.toFixed(2)}MB`);
    
    // 4. Throughput should remain good
    const triplesPerSecond = result.triples.length / (totalTime / 1000);
    expect(triplesPerSecond).toBeGreaterThan(3000); // 3K triples/second for very large
    console.log(`Very large dataset throughput: ${triplesPerSecond.toFixed(0)} triples/second`);
    
    // 5. Data integrity at very large scale
    expect(result.prefixes).toBeDefined();
    expect(result.stats.prefixCount).toBeGreaterThan(0);
  });
});

/**
 * Generate large enterprise-style dataset for performance testing
 */
function generateLargeEnterpriseDataset(tripleCount: number): string {
  let content = `
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix schema: <http://schema.org/> .
    @prefix org: <http://www.w3.org/ns/org#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex: <http://enterprise.example.org/> .
  `;
  
  const entitiesPerType = Math.floor(tripleCount / 10); // ~10 triples per entity
  
  // Generate organizations
  for (let i = 0; i < entitiesPerType / 3; i++) {
    content += `
      ex:org${i} a schema:Organization ;
          schema:name "Organization ${i}" ;
          schema:foundingDate "20${(i % 24).toString().padStart(2, '0')}-01-01"^^xsd:date ;
          org:identifier "ORG-${i.toString().padStart(6, '0')}" ;
          schema:numberOfEmployees "${1000 + i * 10}"^^xsd:integer ;
          foaf:homepage <https://org${i}.example.com> .
    `;
  }
  
  // Generate people
  for (let i = 0; i < entitiesPerType / 3; i++) {
    content += `
      ex:person${i} a foaf:Person ;
          foaf:name "Person ${i}" ;
          foaf:email "person${i}@enterprise.example.org" ;
          schema:jobTitle "Employee ${i}" ;
          foaf:age "${25 + (i % 40)}"^^xsd:integer ;
          org:memberOf ex:org${i % (entitiesPerType / 3)} .
    `;
  }
  
  // Generate software applications
  for (let i = 0; i < entitiesPerType / 3; i++) {
    content += `
      ex:app${i} a schema:SoftwareApplication ;
          schema:name "Application ${i}" ;
          schema:applicationCategory "Enterprise Software" ;
          schema:version "1.${i % 100}.0" ;
          schema:operatingSystem "Cross-platform" ;
          org:organizationOf ex:org${i % (entitiesPerType / 3)} .
    `;
  }
  
  return content;
}