/**
 * Drift URI Performance Benchmarks
 * 
 * Benchmarks for drift:// URI scheme operations:
 * - Patch generation and storage performance
 * - Semantic analysis throughput
 * - RDF canonical comparison efficiency
 * - Memory usage optimization
 */

import { DriftURIResolver } from '../drift/drift-uri-resolver.js';
import { rdfCanonicalDriftProcessor } from '../drift/rdf-canonical-drift.js';
import { cas } from '../cas/cas-core.js';
import { performance, PerformanceObserver } from 'perf_hooks';
import { consola } from 'consola';

/**
 * Drift URI Benchmark Suite
 */
export class DriftURIBenchmarks {
  constructor(config = {}) {
    this.config = {
      iterations: config.iterations || 100,
      dataSize: config.dataSize || 'medium', // small, medium, large
      includeRDF: config.includeRDF !== false,
      includeJSON: config.includeJSON !== false,
      warmupIterations: config.warmupIterations || 10,
      ...config
    };
    
    this.logger = consola.withTag('drift-benchmarks');
    this.results = {
      patchGeneration: [],
      patchRetrieval: [],
      semanticAnalysis: [],
      rdfComparison: [],
      memoryUsage: []
    };
    
    // Test data generators
    this.dataGenerators = {
      small: () => this.generateSmallData(),
      medium: () => this.generateMediumData(),
      large: () => this.generateLargeData()
    };
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmarks() {
    this.logger.info('🚀 Starting Drift URI Benchmark Suite');
    this.logger.info(`⚙️ Configuration: ${JSON.stringify(this.config, null, 2)}`);
    
    const resolver = new DriftURIResolver();
    await resolver.initializeStorage();
    
    try {
      // Warmup
      await this.warmup(resolver);
      
      // Core benchmarks
      if (this.config.includeJSON) {
        await this.benchmarkPatchGeneration(resolver);
        await this.benchmarkPatchRetrieval(resolver);
        await this.benchmarkSemanticAnalysis(resolver);
      }
      
      if (this.config.includeRDF) {
        await this.benchmarkRDFComparison();
      }
      
      await this.benchmarkMemoryUsage(resolver);
      
      // Generate report
      const report = this.generateReport();
      this.logger.info('📊 Benchmark Results:', report);
      
      return report;
      
    } catch (error) {
      this.logger.error('Benchmark failed:', error);
      throw error;
    } finally {
      await resolver.shutdown();
    }
  }

  /**
   * Warmup phase to stabilize performance
   */
  async warmup(resolver) {
    this.logger.info(`🔥 Warming up (${this.config.warmupIterations} iterations)...`);
    
    const generator = this.dataGenerators[this.config.dataSize];
    
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const { baseline, current } = generator();
      await resolver.storePatch(baseline, current);
    }
    
    this.logger.success('✅ Warmup completed');
  }

  /**
   * Benchmark patch generation performance
   */
  async benchmarkPatchGeneration(resolver) {
    this.logger.info(`📦 Benchmarking patch generation (${this.config.iterations} iterations)...`);
    
    const generator = this.dataGenerators[this.config.dataSize];
    const times = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const { baseline, current } = generator();
      
      const start = performance.now();
      const result = await resolver.storePatch(baseline, current, {
        source: `benchmark-${i}`,
        format: 'json'
      });
      const end = performance.now();
      
      times.push({
        duration: end - start,
        patchSize: result.patch ? JSON.stringify(result.patch).length : 0,
        significance: result.metadata?.semantic?.significance || 0,
        uri: result.uri
      });
    }
    
    this.results.patchGeneration = times;
    
    const avgTime = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
    const avgPatchSize = times.reduce((sum, t) => sum + t.patchSize, 0) / times.length;
    
    this.logger.success(`✅ Patch generation: ${avgTime.toFixed(2)}ms avg, ${avgPatchSize.toFixed(0)} bytes avg`);
  }

  /**
   * Benchmark patch retrieval performance
   */
  async benchmarkPatchRetrieval(resolver) {
    this.logger.info(`📥 Benchmarking patch retrieval (${this.config.iterations} iterations)...`);
    
    // Generate patches first
    const generator = this.dataGenerators[this.config.dataSize];
    const uris = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const { baseline, current } = generator();
      const result = await resolver.storePatch(baseline, current);
      if (result.uri) uris.push(result.uri);
    }
    
    // Benchmark retrieval
    const times = [];
    
    for (const uri of uris) {
      const start = performance.now();
      const result = await resolver.retrievePatch(uri);
      const end = performance.now();
      
      times.push({
        duration: end - start,
        uri,
        cacheHit: result.metadata?.cacheHit || false
      });
    }
    
    this.results.patchRetrieval = times;
    
    const avgTime = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
    const cacheHitRate = times.filter(t => t.cacheHit).length / times.length;
    
    this.logger.success(`✅ Patch retrieval: ${avgTime.toFixed(2)}ms avg, ${(cacheHitRate * 100).toFixed(1)}% cache hits`);
  }

  /**
   * Benchmark semantic analysis performance
   */
  async benchmarkSemanticAnalysis(resolver) {
    this.logger.info(`🧠 Benchmarking semantic analysis (${this.config.iterations} iterations)...`);
    
    const times = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const baseline = this.generateStructuredData();
      const current = this.mutateStructuredData(baseline, i % 4); // Different mutation types
      
      const start = performance.now();
      const semanticAnalysis = await resolver.analyzeSemanticChange(baseline, current, {});
      const end = performance.now();
      
      times.push({
        duration: end - start,
        type: semanticAnalysis.type,
        significance: semanticAnalysis.significance,
        hasStructuralChanges: semanticAnalysis.hasStructuralChanges
      });
    }
    
    this.results.semanticAnalysis = times;
    
    const avgTime = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
    const semanticChanges = times.filter(t => t.type === 'semantic').length;
    
    this.logger.success(`✅ Semantic analysis: ${avgTime.toFixed(2)}ms avg, ${semanticChanges}/${times.length} semantic`);
  }

  /**
   * Benchmark RDF canonical comparison
   */
  async benchmarkRDFComparison() {
    this.logger.info(`🔄 Benchmarking RDF comparison (${this.config.iterations} iterations)...`);
    
    const times = [];
    
    for (let i = 0; i < this.config.iterations; i++) {
      const { rdf1, rdf2 } = this.generateRDFPair(i);
      
      const start = performance.now();
      const result = await rdfCanonicalDriftProcessor.analyzeCanonicalDrift(rdf1, rdf2, {
        format: 'turtle'
      });
      const end = performance.now();
      
      times.push({
        duration: end - start,
        canonicallyEquivalent: result.canonicallyEquivalent,
        significance: result.significance,
        tripleCount: result.baseline.quadCount + result.current.quadCount
      });
    }
    
    this.results.rdfComparison = times;
    
    const avgTime = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
    const avgTriples = times.reduce((sum, t) => sum + t.tripleCount, 0) / times.length;
    
    this.logger.success(`✅ RDF comparison: ${avgTime.toFixed(2)}ms avg, ${avgTriples.toFixed(0)} triples avg`);
  }

  /**
   * Benchmark memory usage patterns
   */
  async benchmarkMemoryUsage(resolver) {
    this.logger.info('💾 Benchmarking memory usage...');
    
    const memorySnapshots = [];
    const generator = this.dataGenerators[this.config.dataSize];
    
    // Initial memory
    memorySnapshots.push({
      stage: 'initial',
      ...process.memoryUsage()
    });
    
    // Generate many patches
    for (let i = 0; i < Math.min(this.config.iterations, 50); i++) {
      const { baseline, current } = generator();
      await resolver.storePatch(baseline, current);
      
      if (i % 10 === 0) {
        memorySnapshots.push({
          stage: `after-${i}-patches`,
          ...process.memoryUsage()
        });
      }
    }
    
    // Memory after operations
    memorySnapshots.push({
      stage: 'final',
      ...process.memoryUsage()
    });
    
    this.results.memoryUsage = memorySnapshots;
    
    const initial = memorySnapshots[0];
    const final = memorySnapshots[memorySnapshots.length - 1];
    const heapGrowth = (final.heapUsed - initial.heapUsed) / (1024 * 1024);
    
    this.logger.success(`✅ Memory usage: ${heapGrowth.toFixed(2)}MB heap growth`);
  }

  /**
   * Generate test data - small size
   */
  generateSmallData() {
    const baseline = {
      id: Math.random().toString(36),
      type: 'TestEntity',
      value: Math.floor(Math.random() * 100)
    };
    
    const current = {
      ...baseline,
      value: baseline.value + Math.floor(Math.random() * 10),
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    return { baseline, current };
  }

  /**
   * Generate test data - medium size
   */
  generateMediumData() {
    const baseline = {
      id: Math.random().toString(36),
      metadata: {
        type: 'Document',
        version: 1,
        tags: ['test', 'benchmark', 'medium']
      },
      content: {
        title: 'Test Document',
        body: 'Lorem ipsum '.repeat(50),
        sections: Array.from({ length: 5 }, (_, i) => ({
          id: i,
          title: `Section ${i}`,
          content: 'Content '.repeat(20)
        }))
      }
    };
    
    const current = JSON.parse(JSON.stringify(baseline));
    current.metadata.version = 2;
    current.content.sections.push({
      id: 5,
      title: 'New Section',
      content: 'New content '.repeat(15)
    });
    
    return { baseline, current };
  }

  /**
   * Generate test data - large size
   */
  generateLargeData() {
    const baseline = {
      id: Math.random().toString(36),
      dataset: {
        name: 'Large Dataset',
        records: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Record ${i}`,
          data: {
            values: Array.from({ length: 20 }, () => Math.random()),
            metadata: {
              created: this.getDeterministicDate().toISOString(),
              tags: ['data', 'test', `batch-${Math.floor(i / 10)}`]
            }
          }
        }))
      }
    };
    
    const current = JSON.parse(JSON.stringify(baseline));
    current.dataset.records = current.dataset.records.slice(0, 80); // Remove some
    current.dataset.records.push(...Array.from({ length: 30 }, (_, i) => ({ // Add new ones
      id: i + 100,
      name: `New Record ${i}`,
      data: {
        values: Array.from({ length: 25 }, () => Math.random()),
        metadata: {
          created: this.getDeterministicDate().toISOString(),
          tags: ['data', 'test', 'new']
        }
      }
    })));
    
    return { baseline, current };
  }

  /**
   * Generate structured data for semantic analysis
   */
  generateStructuredData() {
    return {
      '@context': 'http://schema.org',
      '@id': `http://example.org/entity/${Math.random().toString(36)}`,
      '@type': 'Thing',
      'name': `Entity ${Math.floor(Math.random() * 1000)}`,
      'properties': {
        'category': 'TestCategory',
        'status': 'active',
        'metadata': {
          'created': this.getDeterministicDate().toISOString(),
          'version': 1
        }
      }
    };
  }

  /**
   * Mutate structured data in different ways
   */
  mutateStructuredData(data, mutationType) {
    const mutated = JSON.parse(JSON.stringify(data));
    
    switch (mutationType) {
      case 0: // Type change (semantic)
        mutated['@type'] = 'Person';
        break;
      case 1: // Property addition (cosmetic)
        mutated.properties.newProperty = 'newValue';
        break;
      case 2: // Value change (cosmetic)
        mutated.properties.status = 'inactive';
        break;
      case 3: // Structural change (semantic)
        mutated.properties = {
          ...mutated.properties,
          relationships: [{ type: 'relatedTo', target: 'other-entity' }]
        };
        break;
    }
    
    return mutated;
  }

  /**
   * Generate RDF test pairs
   */
  generateRDFPair(index) {
    const basePrefix = `@prefix ex: <http://example.org/> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`;
    
    const rdf1 = `
      ${basePrefix}
      ex:entity${index} a ex:TestClass ;
                       rdfs:label "Entity ${index}" ;
                       ex:value ${index} .
    `;
    
    // Vary the second RDF based on index
    const rdf2 = index % 3 === 0 ? 
      // Equivalent but different syntax
      `
        ${basePrefix}
        ex:entity${index} ex:value ${index} ;
                         rdfs:label "Entity ${index}" ;
                         a ex:TestClass .
      ` :
      // Actually different
      `
        ${basePrefix}
        ex:entity${index} a ex:TestClass ;
                         rdfs:label "Entity ${index}" ;
                         ex:value ${index + 1} .
      `;
    
    return { rdf1, rdf2 };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const report = {
      configuration: this.config,
      timestamp: this.getDeterministicDate().toISOString(),
      results: {},
      summary: {},
      recommendations: []
    };
    
    // Patch generation statistics
    if (this.results.patchGeneration.length > 0) {
      const times = this.results.patchGeneration.map(r => r.duration);
      report.results.patchGeneration = {
        averageTime: this.average(times),
        medianTime: this.median(times),
        p95Time: this.percentile(times, 0.95),
        throughput: 1000 / this.average(times), // ops/second
        averagePatchSize: this.average(this.results.patchGeneration.map(r => r.patchSize))
      };
    }
    
    // Patch retrieval statistics
    if (this.results.patchRetrieval.length > 0) {
      const times = this.results.patchRetrieval.map(r => r.duration);
      report.results.patchRetrieval = {
        averageTime: this.average(times),
        medianTime: this.median(times),
        throughput: 1000 / this.average(times),
        cacheHitRate: this.results.patchRetrieval.filter(r => r.cacheHit).length / this.results.patchRetrieval.length
      };
    }
    
    // Semantic analysis statistics
    if (this.results.semanticAnalysis.length > 0) {
      const times = this.results.semanticAnalysis.map(r => r.duration);
      report.results.semanticAnalysis = {
        averageTime: this.average(times),
        throughput: 1000 / this.average(times),
        semanticDetectionRate: this.results.semanticAnalysis.filter(r => r.type === 'semantic').length / this.results.semanticAnalysis.length
      };
    }
    
    // RDF comparison statistics
    if (this.results.rdfComparison.length > 0) {
      const times = this.results.rdfComparison.map(r => r.duration);
      report.results.rdfComparison = {
        averageTime: this.average(times),
        throughput: 1000 / this.average(times),
        averageTripleCount: this.average(this.results.rdfComparison.map(r => r.tripleCount))
      };
    }
    
    // Memory usage analysis
    if (this.results.memoryUsage.length > 0) {
      const initial = this.results.memoryUsage[0];
      const final = this.results.memoryUsage[this.results.memoryUsage.length - 1];
      
      report.results.memoryUsage = {
        heapGrowthMB: (final.heapUsed - initial.heapUsed) / (1024 * 1024),
        maxHeapUsedMB: Math.max(...this.results.memoryUsage.map(m => m.heapUsed)) / (1024 * 1024),
        memoryEfficiency: this.config.iterations / ((final.heapUsed - initial.heapUsed) / 1024)
      };
    }
    
    // Overall summary
    report.summary = {
      overallPerformance: this.calculateOverallPerformance(report.results),
      bottlenecks: this.identifyBottlenecks(report.results),
      scalabilityScore: this.calculateScalabilityScore(report.results)
    };
    
    // Performance recommendations
    report.recommendations = this.generateRecommendations(report.results);
    
    return report;
  }

  /**
   * Statistical helper functions
   */
  average(numbers) {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  median(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  percentile(numbers, p) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  calculateOverallPerformance(results) {
    // Simple performance score based on throughput
    let score = 0;
    let factors = 0;
    
    if (results.patchGeneration?.throughput) {
      score += Math.min(results.patchGeneration.throughput / 100, 1) * 100;
      factors++;
    }
    
    if (results.patchRetrieval?.throughput) {
      score += Math.min(results.patchRetrieval.throughput / 1000, 1) * 100;
      factors++;
    }
    
    return factors > 0 ? score / factors : 0;
  }

  identifyBottlenecks(results) {
    const bottlenecks = [];
    
    if (results.patchGeneration?.p95Time > 100) {
      bottlenecks.push('Patch generation P95 > 100ms');
    }
    
    if (results.patchRetrieval?.cacheHitRate < 0.8) {
      bottlenecks.push('Low cache hit rate < 80%');
    }
    
    if (results.memoryUsage?.heapGrowthMB > 100) {
      bottlenecks.push('High memory growth > 100MB');
    }
    
    return bottlenecks;
  }

  calculateScalabilityScore(results) {
    // Score based on throughput and memory efficiency
    let score = 100;
    
    if (results.memoryUsage?.memoryEfficiency < 100) {
      score -= 20;
    }
    
    if (results.patchGeneration?.throughput < 50) {
      score -= 30;
    }
    
    return Math.max(score, 0);
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    if (results.patchGeneration?.averageTime > 50) {
      recommendations.push('Consider optimizing patch generation algorithm');
    }
    
    if (results.patchRetrieval?.cacheHitRate < 0.9) {
      recommendations.push('Increase cache size or improve cache policies');
    }
    
    if (results.memoryUsage?.heapGrowthMB > 50) {
      recommendations.push('Implement garbage collection or memory pooling');
    }
    
    if (results.semanticAnalysis?.averageTime > 20) {
      recommendations.push('Optimize semantic analysis with pre-computed heuristics');
    }
    
    return recommendations;
  }
}

// Export benchmarking utilities
export async function runQuickBenchmark() {
  const benchmarks = new DriftURIBenchmarks({
    iterations: 20,
    dataSize: 'small',
    warmupIterations: 5
  });
  
  return await benchmarks.runBenchmarks();
}

export async function runFullBenchmark() {
  const benchmarks = new DriftURIBenchmarks({
    iterations: 100,
    dataSize: 'medium',
    warmupIterations: 10
  });
  
  return await benchmarks.runBenchmarks();
}

export default DriftURIBenchmarks;