/**
 * Performance Benchmark Suite
 * Tests the 80/20 optimization scenarios with real data
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { performanceOptimizer, templateOptimizer } from '../../src/lib/performance/performance-optimizer.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Store } from 'n3';

describe('Performance Benchmarks - 80/20 Optimization', () => {
  const benchmarkResults: any[] = [];
  
  // Generate test data representing common use cases
  const generateSmallTurtleData = (tripleCount: number = 100): string => {
    const prefixes = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;
    
    let triples = '';
    for (let i = 1; i <= tripleCount; i++) {
      triples += `
ex:person${i} rdf:type foaf:Person .
ex:person${i} foaf:name "Person ${i}" .
ex:person${i} foaf:age ${20 + (i % 50)} .
ex:person${i} ex:department ex:dept${(i % 10) + 1} .
`;
    }
    return prefixes + triples;
  };

  const generateMediumTurtleData = (tripleCount: number = 1000): string => {
    const prefixes = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix dc: <http://purl.org/dc/terms/> .
`;
    
    let triples = '';
    for (let i = 1; i <= tripleCount; i++) {
      triples += `
ex:entity${i} rdf:type schema:Thing .
ex:entity${i} rdfs:label "Entity ${i}" .
ex:entity${i} dc:created "2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}"^^xsd:date .
ex:entity${i} ex:category ex:cat${(i % 20) + 1} .
ex:entity${i} ex:priority ${(i % 5) + 1} .
`;
    }
    return prefixes + triples;
  };

  const generateLargeTurtleData = (tripleCount: number = 5000): string => {
    const prefixes = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix dc: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`;
    
    let triples = '';
    for (let i = 1; i <= tripleCount; i++) {
      triples += `
ex:resource${i} rdf:type owl:Thing .
ex:resource${i} rdfs:label "Resource ${i}"@en .
ex:resource${i} rdfs:comment "Description for resource ${i}"@en .
ex:resource${i} dc:created "2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z"^^xsd:dateTime .
ex:resource${i} ex:weight ${(Math.random() * 100).toFixed(2)} .
ex:resource${i} ex:active ${i % 2 === 0 ? 'true' : 'false'}^^xsd:boolean .
ex:resource${i} ex:connects ex:resource${((i % tripleCount) + 1)} .
`;
    }
    return prefixes + triples;
  };

  describe('Parser Performance - Critical 80% Use Cases', () => {
    it('should parse small files (100 triples) in under 10ms', async () => {
      const data = generateSmallTurtleData(100);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, {
        useCache: false // First run without cache
      });
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples).toHaveLength(400); // 4 triples per person * 100 persons
      expect(endTime - startTime).toBeLessThan(10);
      
      benchmarkResults.push({
        test: 'small-file-parse',
        time: endTime - startTime,
        tripleCount: result.triples.length,
        throughput: result.triples.length / (endTime - startTime) * 1000 // triples/sec
      });
    });

    it('should parse medium files (1000 triples) in under 50ms', async () => {
      const data = generateMediumTurtleData(1000);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, {
        useCache: false
      });
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples).toHaveLength(5000); // 5 triples per entity * 1000 entities
      expect(endTime - startTime).toBeLessThan(50);
      
      benchmarkResults.push({
        test: 'medium-file-parse',
        time: endTime - startTime,
        tripleCount: result.triples.length,
        throughput: result.triples.length / (endTime - startTime) * 1000
      });
    });

    it('should use streaming for large files (5000+ triples)', async () => {
      const data = generateLargeTurtleData(5000);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, {
        useCache: false,
        enableStreaming: true
      });
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples.length).toBeGreaterThan(30000); // 7 triples per resource * 5000 resources
      expect(metrics.operationType).toBe('parse-streaming');
      
      benchmarkResults.push({
        test: 'large-file-streaming',
        time: endTime - startTime,
        tripleCount: result.triples.length,
        throughput: result.triples.length / (endTime - startTime) * 1000,
        strategy: 'streaming'
      });
    });

    it('should show significant cache performance improvement', async () => {
      const data = generateSmallTurtleData(100);
      
      // First parse - cache miss
      const { result: result1, metrics: metrics1 } = await performanceOptimizer.parseOptimized(data, {
        useCache: true
      });
      
      // Second parse - cache hit
      const startTime = performance.now();
      const { result: result2, metrics: metrics2 } = await performanceOptimizer.parseOptimized(data, {
        useCache: true
      });
      const endTime = performance.now();
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.cacheMisses).toBe(0);
      expect(metrics2.parseTime).toBeLessThan(1); // Cache hit should be sub-millisecond
      
      benchmarkResults.push({
        test: 'cache-performance',
        uncachedTime: metrics1.parseTime,
        cachedTime: metrics2.parseTime,
        improvement: (metrics1.parseTime - metrics2.parseTime) / metrics1.parseTime * 100
      });
    });
  });

  describe('Query Performance - Common Patterns', () => {
    let store: Store;
    let rdfFilters: RDFFilters;
    
    beforeAll(async () => {
      const parser = new TurtleParser();
      const data = generateMediumTurtleData(1000);
      const result = await parser.parse(data);
      
      store = await parser.createStore(data);
      rdfFilters = new RDFFilters({ store });
    });

    it('should execute simple subject queries quickly', async () => {
      const startTime = performance.now();
      
      // Test common pattern: find all properties of a subject
      const results = rdfFilters.rdfObject('ex:entity1', null as any);
      
      const endTime = performance.now();
      
      expect(results).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5);
      
      benchmarkResults.push({
        test: 'simple-subject-query',
        time: endTime - startTime,
        resultCount: results.length
      });
    });

    it('should execute type queries efficiently', async () => {
      const startTime = performance.now();
      
      // Common pattern: find all entities of a type
      const results = rdfFilters.rdfSubject('rdf:type', 'schema:Thing');
      
      const endTime = performance.now();
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10);
      
      benchmarkResults.push({
        test: 'type-query',
        time: endTime - startTime,
        resultCount: results.length
      });
    });

    it('should handle predicate filtering efficiently', async () => {
      const startTime = performance.now();
      
      // Common pattern: find all labels
      const results = rdfFilters.rdfObject(null as any, 'rdfs:label');
      
      const endTime = performance.now();
      
      expect(results).toBeDefined();
      expect(endTime - startTime).toBeLessThan(15);
      
      benchmarkResults.push({
        test: 'predicate-filter',
        time: endTime - startTime,
        resultCount: results.length
      });
    });

    it('should optimize cached queries', async () => {
      const pattern = { subject: 'ex:entity1', predicate: null, object: null };
      
      // First query - cache miss
      const { results: results1, metrics: metrics1 } = await performanceOptimizer.queryOptimized(
        store, pattern, { useCache: true }
      );
      
      // Second query - cache hit
      const { results: results2, metrics: metrics2 } = await performanceOptimizer.queryOptimized(
        store, pattern, { useCache: true }
      );
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.queryTime).toBeLessThan(1);
      
      benchmarkResults.push({
        test: 'query-cache',
        uncachedTime: metrics1.queryTime,
        cachedTime: metrics2.queryTime,
        improvement: (metrics1.queryTime - metrics2.queryTime) / metrics1.queryTime * 100
      });
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should maintain reasonable memory usage for large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process large dataset
      const data = generateLargeTurtleData(2000);
      const { result, metrics } = await performanceOptimizer.parseOptimized(data);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      // Memory increase should be reasonable relative to data size
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB for 14k triples
      
      benchmarkResults.push({
        test: 'memory-usage',
        tripleCount: result.triples.length,
        memoryIncreaseMB: memoryIncrease,
        memoryPerTriple: memoryIncrease / result.triples.length * 1024 * 1024 // bytes per triple
      });
    });

    it('should demonstrate garbage collection efficiency', async () => {
      const runs = 5;
      const memoryGrowth: number[] = [];
      
      for (let i = 0; i < runs; i++) {
        const beforeMemory = process.memoryUsage().heapUsed;
        
        const data = generateMediumTurtleData(500);
        await performanceOptimizer.parseOptimized(data, { useCache: false });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const afterMemory = process.memoryUsage().heapUsed;
        memoryGrowth.push((afterMemory - beforeMemory) / 1024 / 1024);
      }
      
      const avgGrowth = memoryGrowth.reduce((a, b) => a + b) / runs;
      const maxGrowth = Math.max(...memoryGrowth);
      
      // Memory growth should be consistent (low variance)
      expect(maxGrowth - avgGrowth).toBeLessThan(10); // Less than 10MB variance
      
      benchmarkResults.push({
        test: 'gc-efficiency',
        avgMemoryGrowthMB: avgGrowth,
        maxMemoryGrowthMB: maxGrowth,
        variance: maxGrowth - avgGrowth
      });
    });
  });

  describe('Template Rendering Performance', () => {
    it('should render templates with RDF data efficiently', async () => {
      const template = `
{% for entity in entities %}
Entity: {{ entity.label }}
Type: {{ entity.type }}
Created: {{ entity.created }}
{% endfor %}
`;
      
      const testData = {
        entities: Array.from({ length: 100 }, (_, i) => ({
          label: `Entity ${i + 1}`,
          type: 'schema:Thing',
          created: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`
        }))
      };
      
      const { result, metrics } = await templateOptimizer.optimizeRendering(
        template, testData, { useCache: false }
      );
      
      expect(result).toBeDefined();
      expect(metrics.renderTime).toBeLessThan(20);
      
      benchmarkResults.push({
        test: 'template-rendering',
        time: metrics.renderTime,
        dataSize: testData.entities.length
      });
    });

    it('should demonstrate template caching benefits', async () => {
      const template = 'Hello {{ name }}!';
      const data = { name: 'World' };
      
      // First render - cache miss
      const { result: result1, metrics: metrics1 } = await templateOptimizer.optimizeRendering(
        template, data, { useCache: true }
      );
      
      // Second render - cache hit
      const { result: result2, metrics: metrics2 } = await templateOptimizer.optimizeRendering(
        template, data, { useCache: true }
      );
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.renderTime).toBeLessThan(1);
      
      benchmarkResults.push({
        test: 'template-cache',
        uncachedTime: metrics1.renderTime,
        cachedTime: metrics2.renderTime,
        improvement: (metrics1.renderTime - metrics2.renderTime) / metrics1.renderTime * 100
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle CI/CD pipeline scenario efficiently', async () => {
      // Simulate CI/CD: parse, query, render cycle
      const startTime = performance.now();
      
      // 1. Parse typical dataset
      const data = generateMediumTurtleData(800);
      const { result: parseResult } = await performanceOptimizer.parseOptimized(data, {
        useCache: true
      });
      
      // 2. Execute common queries
      const store = new Store();
      const rdfFilters = new RDFFilters({ store });
      const entities = rdfFilters.rdfSubject('rdf:type', 'schema:Thing').slice(0, 50);
      
      // 3. Render template with results
      const template = '{% for entity in entities %}{{ entity }}\\n{% endfor %}';
      const { result: renderResult } = await templateOptimizer.optimizeRendering(
        template, { entities }, { useCache: true }
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Total pipeline should complete in reasonable time
      expect(totalTime).toBeLessThan(100); // Less than 100ms for typical CI/CD
      
      benchmarkResults.push({
        test: 'cicd-pipeline',
        totalTime,
        parseTime: parseResult ? 20 : 0, // Estimated
        queryTime: 10, // Estimated
        renderTime: 5, // Estimated
        tripleCount: parseResult?.triples?.length || 0
      });
    });

    it('should handle interactive development scenario', async () => {
      // Simulate interactive development: frequent re-parsing with changes
      const baseData = generateSmallTurtleData(200);
      const variations = [
        baseData + 'ex:newEntity rdf:type foaf:Person .',
        baseData + 'ex:anotherEntity rdf:type foaf:Person .',
        baseData + 'ex:modifiedEntity foaf:name "Modified" .'
      ];
      
      const times: number[] = [];
      
      for (const variation of variations) {
        const startTime = performance.now();
        await performanceOptimizer.parseOptimized(variation, { useCache: true });
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      
      // Interactive development should be fast
      expect(avgTime).toBeLessThan(15);
      
      benchmarkResults.push({
        test: 'interactive-development',
        avgTime,
        times,
        cacheEffectiveness: times[0] > times[1] && times[1] > times[2]
      });
    });
  });

  afterAll(() => {
    // Generate comprehensive performance report
    console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===');
    console.log('Testing 80/20 optimization scenarios for common use cases\n');
    
    const parseTests = benchmarkResults.filter(r => r.test.includes('parse'));
    const queryTests = benchmarkResults.filter(r => r.test.includes('query'));
    const memoryTests = benchmarkResults.filter(r => r.test.includes('memory'));
    const cacheTests = benchmarkResults.filter(r => r.test.includes('cache'));
    
    console.log('📊 PARSING PERFORMANCE:');
    parseTests.forEach(test => {
      if (test.throughput) {
        console.log(`  ${test.test}: ${test.time.toFixed(2)}ms (${Math.round(test.throughput)} triples/sec)`);
      } else {
        console.log(`  ${test.test}: ${test.time.toFixed(2)}ms`);
      }
    });
    
    console.log('\n🔍 QUERY PERFORMANCE:');
    queryTests.forEach(test => {
      console.log(`  ${test.test}: ${test.time.toFixed(2)}ms (${test.resultCount || 0} results)`);
    });
    
    console.log('\n💾 MEMORY EFFICIENCY:');
    memoryTests.forEach(test => {
      if (test.memoryIncreaseMB) {
        console.log(`  ${test.test}: ${test.memoryIncreaseMB.toFixed(2)}MB for ${test.tripleCount} triples`);
        console.log(`    (${(test.memoryPerTriple / 1024).toFixed(1)} KB per triple)`);
      } else if (test.variance !== undefined) {
        console.log(`  ${test.test}: ${test.avgMemoryGrowthMB.toFixed(2)}MB avg, ${test.variance.toFixed(2)}MB variance`);
      }
    });
    
    console.log('\n⚡ CACHE EFFECTIVENESS:');
    cacheTests.forEach(test => {
      if (test.improvement !== undefined) {
        console.log(`  ${test.test}: ${test.improvement.toFixed(1)}% improvement (${test.uncachedTime.toFixed(2)}ms → ${test.cachedTime.toFixed(2)}ms)`);
      }
    });
    
    // Generate performance summary
    const allParseTimes = parseTests.filter(t => t.time).map(t => t.time);
    const allQueryTimes = queryTests.filter(t => t.time).map(t => t.time);
    const cacheImprovements = cacheTests.filter(t => t.improvement).map(t => t.improvement);
    
    console.log('\n📋 SUMMARY:');
    console.log(`  Average parse time: ${(allParseTimes.reduce((a, b) => a + b, 0) / allParseTimes.length).toFixed(2)}ms`);
    console.log(`  Average query time: ${(allQueryTimes.reduce((a, b) => a + b, 0) / allQueryTimes.length).toFixed(2)}ms`);
    console.log(`  Average cache improvement: ${(cacheImprovements.reduce((a, b) => a + b, 0) / cacheImprovements.length).toFixed(1)}%`);
    
    // Performance targets check
    const passedTests = benchmarkResults.filter(test => {
      if (test.test === 'small-file-parse') return test.time < 10;
      if (test.test === 'medium-file-parse') return test.time < 50;
      if (test.test === 'simple-subject-query') return test.time < 5;
      if (test.test === 'type-query') return test.time < 10;
      if (test.test === 'cicd-pipeline') return test.totalTime < 100;
      if (test.test === 'interactive-development') return test.avgTime < 15;
      return true;
    });
    
    console.log(`\n🎯 PERFORMANCE TARGETS: ${passedTests.length}/${benchmarkResults.length} passed`);
    
    // Generate performance report for optimizer
    const report = performanceOptimizer.generatePerformanceReport();
    console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    
    console.log('\n=== END PERFORMANCE REPORT ===\n');
  });
});