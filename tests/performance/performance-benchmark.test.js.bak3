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

describe('Performance Benchmarks - 80/20 Optimization', () => { const benchmarkResults = [];
  
  // Generate test data representing common use cases
  const generateSmallTurtleData = (tripleCount = 100) => {
    const prefixes = `
@prefix ex } rdf:type foaf:Person .
ex:person${i} foaf:name "Person ${i}" .
ex:person${i} foaf:age ${20 + (i % 50)} .
ex:person${i} ex:department ex:dept${(i % 10) + 1} .
`;
    }
    return prefixes + triples;
  };

  const generateMediumTurtleData = (tripleCount = 1000) => { const prefixes = `
@prefix ex } rdf:type schema:Thing .
ex:entity${i} rdfs:label "Entity ${i}" .
ex:entity${i} dc:created "2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}"^^xsd:date .
ex:entity${i} ex:category ex:cat${(i % 20) + 1} .
ex:entity${i} ex:priority ${(i % 5) + 1} .
`;
    }
    return prefixes + triples;
  };

  const generateLargeTurtleData = (tripleCount = 5000) => { const prefixes = `
@prefix ex } rdf:type owl:Thing .
ex:resource${i} rdfs:label "Resource ${i}"@en .
ex:resource${i} rdfs:comment "Description for resource ${i}"@en .
ex:resource${i} dc:created "2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z"^^xsd:dateTime .
ex:resource${i} ex:weight ${(Math.random() * 100).toFixed(2)} .
ex:resource${i} ex:active ${ i % 2 === 0 ? 'true'  }^^xsd:boolean .
ex:resource${i} ex:connects ex:resource${((i % tripleCount) + 1)} .
`;
    }
    return prefixes + triples;
  };

  describe('Parser Performance - Critical 80% Use Cases', () => {
    it('should parse small files (100 triples) in under 10ms', async () => {
      const data = generateSmallTurtleData(100);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, { useCache);
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples).toHaveLength(400); // 4 triples per person * 100 persons
      expect(endTime - startTime).toBeLessThan(10);
      
      benchmarkResults.push({
        test });
    });

    it('should parse medium files (1000 triples) in under 50ms', async () => {
      const data = generateMediumTurtleData(1000);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, { useCache });
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples).toHaveLength(5000); // 5 triples per entity * 1000 entities
      expect(endTime - startTime).toBeLessThan(50);
      
      benchmarkResults.push({ test });
    });

    it('should use streaming for large files (5000+ triples)', async () => {
      const data = generateLargeTurtleData(5000);
      
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, { useCache,
        enableStreaming });
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(result.triples.length).toBeGreaterThan(30000); // 7 triples per resource * 5000 resources
      expect(metrics.operationType).toBe('parse-streaming');
      
      benchmarkResults.push({ test });
    });

    it('should show significant cache performance improvement', async () => { const data = generateSmallTurtleData(100);
      
      // First parse - cache miss
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, { useCache });
      
      // Second parse - cache hit
      const startTime = performance.now();
      const { result, metrics } = await performanceOptimizer.parseOptimized(data, { useCache });
      const endTime = performance.now();
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.cacheMisses).toBe(0);
      expect(metrics2.parseTime).toBeLessThan(1); // Cache hit should be sub-millisecond
      
      benchmarkResults.push({ test });
    });
  });

  describe('Query Performance - Common Patterns', () => {
    let store;
    let rdfFilters;
    
    beforeAll(async () => {
      const parser = new TurtleParser();
      const data = generateMediumTurtleData(1000);
      const result = await parser.parse(data);
      
      store = await parser.createStore(data);
      rdfFilters = new RDFFilters({ store });
    });

    it('should execute simple subject queries quickly', async () => { const startTime = performance.now();
      
      // Test common pattern });

    it('should execute type queries efficiently', async () => { const startTime = performance.now();
      
      // Common pattern });

    it('should handle predicate filtering efficiently', async () => { const startTime = performance.now();
      
      // Common pattern });

    it('should optimize cached queries', async () => { const pattern = { subject };
      
      // First query - cache miss
      const { results, metrics } = await performanceOptimizer.queryOptimized(
        store, pattern, { useCache }
      );
      
      // Second query - cache hit
      const { results, metrics } = await performanceOptimizer.queryOptimized(
        store, pattern, { useCache }
      );
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.queryTime).toBeLessThan(1);
      
      benchmarkResults.push({ test });
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
      
      benchmarkResults.push({ test });

    it('should demonstrate garbage collection efficiency', async () => { const runs = 5;
      const memoryGrowth = [];
      
      for (let i = 0; i < runs; i++) {
        const beforeMemory = process.memoryUsage().heapUsed;
        
        const data = generateMediumTurtleData(500);
        await performanceOptimizer.parseOptimized(data, { useCache });
        
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
      
      benchmarkResults.push({ test });
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
      
      const testData = { entities }`,
          type: 'schema:Thing',
          created) + 1).padStart(2, '0')}`
        }))
      };
      
      const { result, metrics } = await templateOptimizer.optimizeRendering(
        template, testData, { useCache }
      );
      
      expect(result).toBeDefined();
      expect(metrics.renderTime).toBeLessThan(20);
      
      benchmarkResults.push({ test });

    it('should demonstrate template caching benefits', async () => {
      const template = 'Hello {{ name }}!';
      const data = { name };
      
      // First render - cache miss
      const { result, metrics } = await templateOptimizer.optimizeRendering(
        template, data, { useCache }
      );
      
      // Second render - cache hit
      const { result, metrics } = await templateOptimizer.optimizeRendering(
        template, data, { useCache }
      );
      
      expect(metrics2.cacheHits).toBe(1);
      expect(metrics2.renderTime).toBeLessThan(1);
      
      benchmarkResults.push({ test });
    });
  });

  describe('Real-World Scenarios', () => { it('should handle CI/CD pipeline scenario efficiently', async () => {
      // Simulate CI/CD, query, render cycle
      const startTime = performance.now();
      
      // 1. Parse typical dataset
      const data = generateMediumTurtleData(800);
      const { result } = await performanceOptimizer.parseOptimized(data, { useCache });
      
      // 2. Execute common queries
      const store = new Store();
      const rdfFilters = new RDFFilters({ store });
      const entities = rdfFilters.rdfSubject('rdf:type', 'schema:Thing').slice(0, 50);
      
      // 3. Render template with results
      const template = '{% for entity in entities %}{{ entity }}\\n{% endfor %}';
      const { result } = await templateOptimizer.optimizeRendering(
        template, { entities }, { useCache }
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Total pipeline should complete in reasonable time
      expect(totalTime).toBeLessThan(100); // Less than 100ms for typical CI/CD
      
      benchmarkResults.push({ test });

    it('should handle interactive development scenario', async () => { // Simulate interactive development });
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      
      // Interactive development should be fast
      expect(avgTime).toBeLessThan(15);
      
      benchmarkResults.push({ test });
  });

  afterAll(() => { // Generate comprehensive performance report
    console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===');
    console.log('Testing 80/20 optimization scenarios for common use cases\n');
    
    const parseTests = benchmarkResults.filter(r => r.test.includes('parse'));
    const queryTests = benchmarkResults.filter(r => r.test.includes('query'));
    const memoryTests = benchmarkResults.filter(r => r.test.includes('memory'));
    const cacheTests = benchmarkResults.filter(r => r.test.includes('cache'));
    
    console.log('📊 PARSING PERFORMANCE })}ms (${Math.round(test.throughput)} triples/sec)`);
      } else {
        console.log(`  ${test.test})}ms`);
      }
    });
    
    console.log('\n🔍 QUERY PERFORMANCE:');
    queryTests.forEach(test => {
      console.log(`  ${test.test})}ms (${test.resultCount || 0} results)`);
    });
    
    console.log('\n💾 MEMORY EFFICIENCY:');
    memoryTests.forEach(test => {
      if (test.memoryIncreaseMB) {
        console.log(`  ${test.test})}MB for ${test.tripleCount} triples`);
        console.log(`    (${(test.memoryPerTriple / 1024).toFixed(1)} KB per triple)`);
      } else if (test.variance !== undefined) {
        console.log(`  ${test.test})}MB avg, ${test.variance.toFixed(2)}MB variance`);
      }
    });
    
    console.log('\n⚡ CACHE EFFECTIVENESS:');
    cacheTests.forEach(test => {
      if (test.improvement !== undefined) {
        console.log(`  ${test.test})}% improvement (${test.uncachedTime.toFixed(2)}ms → ${test.cachedTime.toFixed(2)}ms)`);
      }
    });
    
    // Generate performance summary
    const allParseTimes = parseTests.filter(t => t.time).map(t => t.time);
    const allQueryTimes = queryTests.filter(t => t.time).map(t => t.time);
    const cacheImprovements = cacheTests.filter(t => t.improvement).map(t => t.improvement);
    
    console.log('\n📋 SUMMARY:');
    console.log(`  Average parse time, b) => a + b, 0) / allParseTimes.length).toFixed(2)}ms`);
    console.log(`  Average query time, b) => a + b, 0) / allQueryTimes.length).toFixed(2)}ms`);
    console.log(`  Average cache improvement, b) => a + b, 0) / cacheImprovements.length).toFixed(1)}%`);
    
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
    
    console.log(`\n🎯 PERFORMANCE TARGETS);
    
    // Generate performance report for optimizer
    const report = performanceOptimizer.generatePerformanceReport();
    console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    
    console.log('\n=== END PERFORMANCE REPORT ===\n');
  });
});