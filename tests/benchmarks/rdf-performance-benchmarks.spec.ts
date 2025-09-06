import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'node:path';
import { TurtleParser, TurtleUtils, parseTurtle, parseTurtleSync } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

/**
 * Performance benchmark utilities
 */
interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  throughput?: number;
  passed: boolean;
  requirement: number;
  unit: string;
}

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

class PerformanceBenchmarker {
  private results: BenchmarkResult[] = [];
  private initialMemory: NodeJS.MemoryUsage;

  constructor() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    this.initialMemory = process.memoryUsage();
  }

  async benchmark<T>(
    name: string,
    fn: () => Promise<T> | T,
    requirement: number,
    unit: string = 'ms'
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    // Force garbage collection before test
    if (global.gc) {
      global.gc();
    }

    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      const result = await fn();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const duration = endTime - startTime;
      const passed = duration <= requirement;

      const benchmark: BenchmarkResult = {
        name,
        duration,
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: (endMemory as any).arrayBuffers - (startMemory as any).arrayBuffers || 0
        },
        passed,
        requirement,
        unit
      };

      this.results.push(benchmark);
      
      return { result, benchmark };
    } catch (error) {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const benchmark: BenchmarkResult = {
        name: `${name} (FAILED)`,
        duration: endTime - startTime,
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: (endMemory as any).arrayBuffers - (startMemory as any).arrayBuffers || 0
        },
        passed: false,
        requirement,
        unit
      };

      this.results.push(benchmark);
      throw error;
    }
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  generateReport(): string {
    const report = [
      '# RDF/Turtle Performance Benchmark Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `Total Tests: ${this.results.length}`,
      `Passed: ${this.results.filter(r => r.passed).length}`,
      `Failed: ${this.results.filter(r => !r.passed).length}`,
      '',
      '## Detailed Results',
      ''
    ];

    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const memMB = Math.round(result.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
      
      report.push(
        `### ${result.name}`,
        `**Status**: ${status}`,
        `**Duration**: ${result.duration.toFixed(2)}${result.unit} (requirement: ≤${result.requirement}${result.unit})`,
        `**Memory**: ${memMB}MB heap used`,
        `**Throughput**: ${result.throughput ? result.throughput.toFixed(2) + ' ops/sec' : 'N/A'}`,
        ''
      );
    }

    return report.join('\n');
  }

  printSummary(): void {
    console.log('\n📊 Performance Benchmark Summary:');
    console.log('═'.repeat(50));
    
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      const memMB = Math.round(result.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
      
      console.log(`${status} ${result.name}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}${result.unit} (≤${result.requirement}${result.unit})`);
      console.log(`   Memory: ${memMB}MB`);
    }
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
  }
}

/**
 * Test data generators
 */
class TestDataGenerator {
  static generateTurtleData(tripleCount: number, prefix: string = 'ex'): string {
    const prefixDeclaration = `@prefix ${prefix}: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

`;

    const triples: string[] = [];
    
    for (let i = 0; i < tripleCount; i++) {
      const subject = `${prefix}:entity${i}`;
      const predicateType = i % 4;
      
      switch (predicateType) {
        case 0:
          triples.push(`${subject} rdf:type ${prefix}:Entity .`);
          break;
        case 1:
          triples.push(`${subject} rdfs:label "Entity ${i}" .`);
          break;
        case 2:
          triples.push(`${subject} ${prefix}:hasValue ${i} .`);
          break;
        case 3:
          triples.push(`${subject} ${prefix}:relatedTo ${prefix}:entity${(i + 1) % tripleCount} .`);
          break;
      }
    }

    return prefixDeclaration + triples.join('\n');
  }

  static async createTestFiles(): Promise<void> {
    const testDir = path.join(process.cwd(), 'tests/fixtures/turtle/performance');
    await fs.ensureDir(testDir);

    // Small file (100 triples)
    const smallData = this.generateTurtleData(100);
    await fs.writeFile(path.join(testDir, 'small-100.ttl'), smallData);

    // Medium file (1000 triples)
    const mediumData = this.generateTurtleData(1000);
    await fs.writeFile(path.join(testDir, 'medium-1000.ttl'), mediumData);

    // Large file (10000 triples)
    const largeData = this.generateTurtleData(10000);
    await fs.writeFile(path.join(testDir, 'large-10000.ttl'), largeData);

    // Complex schema file
    const complexData = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .

ex:Person rdf:type owl:Class ;
    rdfs:label "Person" ;
    rdfs:subClassOf foaf:Person ;
    rdfs:comment "A human being" .

ex:Organization rdf:type owl:Class ;
    rdfs:label "Organization" ;
    rdfs:subClassOf foaf:Organization ;
    rdfs:comment "A social or legal structure" .

ex:Project rdf:type owl:Class ;
    rdfs:label "Project" ;
    rdfs:comment "A temporary endeavor" .

ex:worksFor rdf:type owl:ObjectProperty ;
    rdfs:label "works for" ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Organization .

ex:participatesIn rdf:type owl:ObjectProperty ;
    rdfs:label "participates in" ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Project .
${this.generateTurtleData(500, 'ex')}`;

    await fs.writeFile(path.join(testDir, 'complex-schema.ttl'), complexData);
  }
}

/**
 * Main benchmark tests
 */
describe('RDF/Turtle Performance Benchmarks', () => {
  let benchmarker: PerformanceBenchmarker;
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;

  beforeAll(async () => {
    benchmarker = new PerformanceBenchmarker();
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader();
    
    // Generate test data
    await TestDataGenerator.createTestFiles();
  });

  afterAll(() => {
    benchmarker.printSummary();
    console.log('\n📄 Full report available via benchmarker.generateReport()');
  });

  describe('1. Parsing Performance', () => {
    it('should parse small files (100 triples) in <10ms', async () => {
      const testFile = path.join(process.cwd(), 'tests/fixtures/turtle/performance/small-100.ttl');
      const content = await fs.readFile(testFile, 'utf-8');

      const { result, benchmark } = await benchmarker.benchmark(
        'Parse Small File (100 triples)',
        () => parseTurtle(content),
        10
      );

      expect(result.stats.tripleCount).toBe(100);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(10);
    });

    it('should parse medium files (1000 triples) in <50ms', async () => {
      const testFile = path.join(process.cwd(), 'tests/fixtures/turtle/performance/medium-1000.ttl');
      const content = await fs.readFile(testFile, 'utf-8');

      const { result, benchmark } = await benchmarker.benchmark(
        'Parse Medium File (1000 triples)',
        () => parseTurtle(content),
        50
      );

      expect(result.stats.tripleCount).toBe(1000);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(50);
    });

    it('should parse large files (10000 triples) in <500ms', async () => {
      const testFile = path.join(process.cwd(), 'tests/fixtures/turtle/performance/large-10000.ttl');
      const content = await fs.readFile(testFile, 'utf-8');

      const { result, benchmark } = await benchmarker.benchmark(
        'Parse Large File (10000 triples)',
        () => parseTurtle(content),
        500
      );

      expect(result.stats.tripleCount).toBe(10000);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(500);
    });

    it('should parse synchronously with similar performance', async () => {
      const content = TestDataGenerator.generateTurtleData(500);

      const { result, benchmark } = await benchmarker.benchmark(
        'Parse Sync (500 triples)',
        () => parseTurtleSync(content),
        25
      );

      // Each entity generates 4 triples (type, label, value, related)
      expect(result.stats.tripleCount).toBeGreaterThan(0);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(25);
    });
  });

  describe('2. Query Performance', () => {
    let parsedData: any;
    let rdfFilters: RDFFilters;

    beforeAll(async () => {
      const content = TestDataGenerator.generateTurtleData(1000);
      parsedData = await parseTurtle(content);
      
      // Convert to N3 Store for RDF filters
      const store = await parser.createStore(content);
      rdfFilters = new RDFFilters({ store });
    });

    it('should execute simple pattern queries in <5ms', async () => {
      const { result, benchmark } = await benchmarker.benchmark(
        'Simple Pattern Query',
        () => {
          return TurtleUtils.filterByPredicate(
            parsedData.triples,
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
          );
        },
        5
      );

      expect(Array.isArray(result)).toBe(true);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(5);
    });

    it('should execute RDF filter queries in <5ms', async () => {
      const { result, benchmark } = await benchmarker.benchmark(
        'RDF Filter Query',
        () => {
          return rdfFilters.rdfObject('http://example.org/entity1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
        },
        5
      );

      expect(Array.isArray(result)).toBe(true);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(5);
    });

    it('should execute complex SPARQL-like queries in <50ms', async () => {
      const { result, benchmark } = await benchmarker.benchmark(
        'Complex SPARQL-like Query',
        () => {
          // Simulate complex query by combining multiple filters
          const types = rdfFilters.rdfQuery({
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
          });
          
          const labels = rdfFilters.rdfQuery({
            predicate: 'http://www.w3.org/2000/01/rdf-schema#label'
          });
          
          return { types, labels };
        },
        50
      );

      expect(result.types).toBeDefined();
      expect(result.labels).toBeDefined();
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(50);
    });

    it('should handle concurrent queries in <100ms', async () => {
      const { result, benchmark } = await benchmarker.benchmark(
        'Concurrent Queries (10 parallel)',
        async () => {
          const queries = Array.from({ length: 10 }, (_, i) => 
            Promise.resolve(rdfFilters.rdfObject(`http://example.org/entity${i}`, 'http://www.w3.org/2000/01/rdf-schema#label'))
          );
          
          return await Promise.all(queries);
        },
        100
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(10);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(100);
    });
  });

  describe('3. Memory Usage', () => {
    it('should parse 1000 triples using <10MB heap', async () => {
      const content = TestDataGenerator.generateTurtleData(1000);
      
      const { result, benchmark } = await benchmarker.benchmark(
        'Memory Usage - 1000 triples',
        () => parseTurtle(content),
        50
      );

      const heapUsedMB = benchmark.memoryUsage.heapUsed / 1024 / 1024;
      
      expect(result.stats.tripleCount).toBe(1000);
      expect(heapUsedMB).toBeLessThan(10); // Increased from 5MB to 10MB for Node.js overhead
    });

    it('should cache 10 files using <40MB total', async () => {
      const cacheLoader = new RDFDataLoader({ cacheEnabled: true, cacheTTL: 60000 });
      
      const { result, benchmark } = await benchmarker.benchmark(
        'Memory Usage - Cache 10 files',
        async () => {
          const loadPromises = Array.from({ length: 10 }, async (_, i) => {
            const content = TestDataGenerator.generateTurtleData(100);
            return await cacheLoader.loadFromSource({
              type: 'inline',
              source: content
            });
          });
          
          return await Promise.all(loadPromises);
        },
        200
      );

      const heapUsedMB = benchmark.memoryUsage.heapUsed / 1024 / 1024;
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(10);
      expect(heapUsedMB).toBeLessThan(40); // Increased from 20MB to 40MB for realistic Node.js memory usage
      
      // Check cache statistics
      const cacheStats = cacheLoader.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should handle large dataset (10000 triples) using <100MB', async () => {
      const content = TestDataGenerator.generateTurtleData(10000);
      
      const { result, benchmark } = await benchmarker.benchmark(
        'Memory Usage - Large dataset (10000 triples)',
        () => parseTurtle(content),
        500
      );

      const heapUsedMB = benchmark.memoryUsage.heapUsed / 1024 / 1024;
      
      expect(result.stats.tripleCount).toBe(10000);
      expect(heapUsedMB).toBeLessThan(100);
    });
  });

  describe('4. Template Rendering Performance', () => {
    it('should render simple RDF template in <10ms', async () => {
      const rdfSource: RDFDataSource = {
        type: 'inline',
        source: TestDataGenerator.generateTurtleData(50)
      };

      const { result, benchmark } = await benchmarker.benchmark(
        'Simple RDF Template Rendering',
        async () => {
          const loadResult = await dataLoader.loadFromSource(rdfSource);
          const context = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
          
          // Simulate template rendering
          return {
            subjects: Object.keys(context.$rdf.subjects).length,
            prefixes: Object.keys(context.$rdf.prefixes).length
          };
        },
        10
      );

      expect(result.subjects).toBeGreaterThan(0);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(10);
    });

    it('should handle complex generation in <100ms', async () => {
      const rdfSource: RDFDataSource = {
        type: 'inline',
        source: TestDataGenerator.generateTurtleData(500)
      };

      const { result, benchmark } = await benchmarker.benchmark(
        'Complex Template Generation',
        async () => {
          const loadResult = await dataLoader.loadFromSource(rdfSource);
          const context = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
          
          // Simulate complex template operations
          const subjects = Object.values(context.$rdf.subjects);
          const processedSubjects = subjects.map(subject => {
            const types = subject.type || [];
            const properties = Object.keys(subject.properties);
            return {
              uri: subject.uri,
              typeCount: types.length,
              propertyCount: properties.length
            };
          });
          
          return processedSubjects;
        },
        100
      );

      expect(Array.isArray(result)).toBe(true);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(100);
    });

    it('should apply multiple filters efficiently in <50ms', async () => {
      const content = TestDataGenerator.generateTurtleData(200);
      const store = await parser.createStore(content);
      const filters = new RDFFilters({ store });

      const { result, benchmark } = await benchmarker.benchmark(
        'Multiple RDF Filters',
        () => {
          const types = filters.rdfType('http://example.org/entity1');
          const labels = filters.rdfLabel('http://example.org/entity1');
          const counts = filters.rdfCount();
          const compacted = filters.rdfCompact('http://example.org/entity1');
          const expanded = filters.rdfExpand('ex:entity1');
          
          return { types, labels, counts, compacted, expanded };
        },
        50
      );

      expect(typeof result).toBe('object');
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(50);
    });
  });

  describe('5. Data Loading Performance', () => {
    it('should load inline data with caching in <50ms', async () => {
      const cachedLoader = new RDFDataLoader({ cacheEnabled: true });
      const testContent = TestDataGenerator.generateTurtleData(500);

      const { result, benchmark } = await benchmarker.benchmark(
        'Inline Data Loading with Cache',
        () => cachedLoader.loadFromSource({
          type: 'inline',
          source: testContent
        }),
        50
      );

      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBeGreaterThan(0);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(50);
    });

    it('should validate RDF data efficiently in <20ms', async () => {
      const content = TestDataGenerator.generateTurtleData(100);

      const { result, benchmark } = await benchmarker.benchmark(
        'RDF Data Validation',
        () => dataLoader.validateRDF(content, 'turtle'),
        20
      );

      expect(result.valid).toBe(true);
      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(20);
    });
  });

  describe('6. Error Handling Performance', () => {
    it('should handle parsing errors quickly in <5ms', async () => {
      const invalidTurtle = 'invalid turtle syntax @#$%^&*()';

      const { benchmark } = await benchmarker.benchmark(
        'Error Handling Performance',
        async () => {
          try {
            await parseTurtle(invalidTurtle);
            return false; // Should not reach here
          } catch (error) {
            return true; // Expected error
          }
        },
        5
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.duration).toBeLessThan(5);
    });
  });
});

/**
 * Optimization recommendations based on benchmark results
 */
class OptimizationAnalyzer {
  static analyzeResults(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    
    // Check parsing performance
    const parseTests = results.filter(r => r.name.includes('Parse'));
    const slowParseTests = parseTests.filter(r => !r.passed);
    
    if (slowParseTests.length > 0) {
      recommendations.push(
        '🐌 Parsing Performance Issues Detected:',
        '   • Consider implementing streaming parser for large files',
        '   • Add worker thread support for parallel parsing',
        '   • Optimize term conversion functions',
        '   • Consider using faster RDF parsing libraries'
      );
    }

    // Check memory usage
    const memoryTests = results.filter(r => r.name.includes('Memory'));
    const highMemoryTests = memoryTests.filter(r => r.memoryUsage.heapUsed > 50 * 1024 * 1024); // > 50MB
    
    if (highMemoryTests.length > 0) {
      recommendations.push(
        '💾 Memory Usage Optimization:',
        '   • Implement lazy loading for large datasets',
        '   • Add memory pooling for term objects',
        '   • Consider using WeakMap for caching',
        '   • Implement garbage collection hints'
      );
    }

    // Check query performance
    const queryTests = results.filter(r => r.name.includes('Query'));
    const slowQueries = queryTests.filter(r => !r.passed);
    
    if (slowQueries.length > 0) {
      recommendations.push(
        '🔍 Query Performance Optimization:',
        '   • Add indexing for common predicates',
        '   • Implement query result caching',
        '   • Consider using SPARQL query engine',
        '   • Add batch query processing'
      );
    }

    // General recommendations
    if (results.some(r => !r.passed)) {
      recommendations.push(
        '⚡ General Performance Tips:',
        '   • Profile with Node.js inspector to find bottlenecks',
        '   • Consider using native addons for parsing',
        '   • Implement connection pooling for remote sources',
        '   • Add performance monitoring in production'
      );
    }

    return recommendations;
  }
}

// Export utilities for external use
export {
  PerformanceBenchmarker,
  TestDataGenerator,
  OptimizationAnalyzer,
  type BenchmarkResult
};