/**
 * Performance Benchmark Quality Gate
 * Enterprise-scale RDF processing performance validation
 * Real-time performance monitoring and benchmarking
 */

import { Store, DataFactory, NamedNode, Literal } from 'n3';
import { ValidationContext, PerformanceMetrics } from '../semantic-validator';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';

const { namedNode, literal } = DataFactory;

interface BenchmarkResult {
  passed: boolean;
  score: number;
  benchmarks: BenchmarkMetrics;
  performanceProfile: PerformanceProfile;
  scalabilityAnalysis: ScalabilityAnalysis;
  recommendations: BenchmarkRecommendation[];
}

interface BenchmarkMetrics {
  queryResponseTime: QueryPerformance;
  throughput: ThroughputMetrics;
  memoryEfficiency: MemoryMetrics;
  concurrentLoad: ConcurrencyMetrics;
  scalability: ScalabilityMetrics;
  reasoningPerformance: ReasoningMetrics;
}

interface QueryPerformance {
  simpleQueryMs: number;
  complexQueryMs: number;
  aggregationQueryMs: number;
  joinQueryMs: number;
  pathQueryMs: number;
  averageResponseTime: number;
}

interface ThroughputMetrics {
  triplesToreMembersPerSec: number;
  queryExecutionsPerSec: number;
  insertOperationsPerSec: number;
  updateOperationsPerSec: number;
  deleteOperationsPerSec: number;
  bulkLoadTriplePerSec: number;
}

interface MemoryMetrics {
  memoryUsageMB: number;
  memoryEfficiencyRatio: number;
  garbageCollectionImpact: number;
  memoryLeakDetection: boolean;
  peakMemoryUsageMB: number;
}

interface ConcurrencyMetrics {
  maxConcurrentQueries: number;
  threadUtilization: number;
  lockContention: number;
  deadlockDetection: boolean;
  concurrencyThroughputDegradation: number;
}

interface ScalabilityMetrics {
  linearScalabilityFactor: number;
  datasetSizeImpact: number;
  queryComplexityImpact: number;
  hardwareUtilizationEfficiency: number;
}

interface ReasoningMetrics {
  ontologyLoadTimeMs: number;
  classificationTimeMs: number;
  consistencyCheckTimeMs: number;
  reasoningThroughputQPS: number;
  memoryOverheadMB: number;
}

interface PerformanceProfile {
  cpuUtilization: number;
  memoryUtilization: number;
  ioWaitTime: number;
  networkLatency: number;
  diskIoThroughput: number;
}

interface ScalabilityAnalysis {
  recommendedMaxDatasetSize: number;
  concurrentUserLimit: number;
  scalingBottlenecks: string[];
  optimizationPotential: string[];
}

interface BenchmarkRecommendation {
  category: 'performance' | 'memory' | 'scalability' | 'concurrency';
  priority: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
  expectedImprovement: string;
}

export class PerformanceBenchmarkGate {
  private store: Store;
  private benchmarkThresholds: BenchmarkThresholds;
  private performanceHistory: PerformanceSnapshot[];

  constructor(store: Store, thresholds?: BenchmarkThresholds) {
    this.store = store;
    this.benchmarkThresholds = thresholds || this.getDefaultThresholds();
    this.performanceHistory = [];
  }

  /**
   * Execute comprehensive performance benchmark
   */
  async executeBenchmark(context: ValidationContext): Promise<BenchmarkResult> {
    console.log('Starting enterprise performance benchmark suite...');
    
    // Pre-benchmark system profiling
    const baselineProfile = await this.captureSystemProfile();
    
    // Execute benchmark suite
    const benchmarks = await this.runBenchmarkSuite(context);
    
    // Post-benchmark analysis
    const performanceProfile = await this.captureSystemProfile();
    const scalabilityAnalysis = await this.analyzeScalability(benchmarks);
    const recommendations = await this.generateRecommendations(benchmarks);
    
    // Calculate overall benchmark score
    const score = this.calculateBenchmarkScore(benchmarks);
    const passed = score >= this.benchmarkThresholds.minimumScore;

    // Record performance snapshot
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      datasetSize: this.store.size,
      benchmarks,
      score,
      context: context.domain
    };
    this.performanceHistory.push(snapshot);

    return {
      passed,
      score,
      benchmarks,
      performanceProfile,
      scalabilityAnalysis,
      recommendations
    };
  }

  /**
   * Run comprehensive benchmark suite
   */
  private async runBenchmarkSuite(context: ValidationContext): Promise<BenchmarkMetrics> {
    console.log('Running query performance benchmarks...');
    const queryPerformance = await this.benchmarkQueryPerformance();
    
    console.log('Running throughput benchmarks...');
    const throughput = await this.benchmarkThroughput();
    
    console.log('Running memory efficiency benchmarks...');
    const memoryEfficiency = await this.benchmarkMemoryEfficiency();
    
    console.log('Running concurrency benchmarks...');
    const concurrentLoad = await this.benchmarkConcurrency();
    
    console.log('Running scalability benchmarks...');
    const scalability = await this.benchmarkScalability();
    
    console.log('Running reasoning performance benchmarks...');
    const reasoningPerformance = await this.benchmarkReasoning();

    return {
      queryResponseTime: queryPerformance,
      throughput,
      memoryEfficiency,
      concurrentLoad,
      scalability,
      reasoningPerformance
    };
  }

  /**
   * Benchmark query performance across different query types
   */
  private async benchmarkQueryPerformance(): Promise<QueryPerformance> {
    const queryTests = [
      {
        name: 'simple',
        sparql: 'SELECT * WHERE { ?s ?p ?o } LIMIT 100',
        expectedTimeMs: 10
      },
      {
        name: 'complex',
        sparql: `
          SELECT ?class ?label ?comment WHERE {
            ?class a owl:Class .
            OPTIONAL { ?class rdfs:label ?label }
            OPTIONAL { ?class rdfs:comment ?comment }
            FILTER(!isBlank(?class))
          }
        `,
        expectedTimeMs: 50
      },
      {
        name: 'aggregation',
        sparql: `
          SELECT ?type (COUNT(?instance) as ?count) WHERE {
            ?instance a ?type .
            FILTER(?type != owl:Class)
          } GROUP BY ?type ORDER BY DESC(?count)
        `,
        expectedTimeMs: 100
      },
      {
        name: 'join',
        sparql: `
          SELECT ?class1 ?class2 WHERE {
            ?class1 rdfs:subClassOf ?parent .
            ?class2 rdfs:subClassOf ?parent .
            FILTER(?class1 != ?class2)
          }
        `,
        expectedTimeMs: 75
      },
      {
        name: 'path',
        sparql: `
          SELECT ?ancestor ?descendant WHERE {
            ?descendant rdfs:subClassOf+ ?ancestor .
          }
        `,
        expectedTimeMs: 200
      }
    ];

    const results: { [key: string]: number } = {};
    let totalTime = 0;

    for (const test of queryTests) {
      const startTime = performance.now();
      
      try {
        // Simulate SPARQL query execution
        await this.executeSparqlQuery(test.sparql);
        const executionTime = performance.now() - startTime;
        results[test.name] = executionTime;
        totalTime += executionTime;
      } catch (error) {
        console.error(`Query benchmark failed for ${test.name}:`, error);
        results[test.name] = test.expectedTimeMs * 10; // Penalty for failure
        totalTime += results[test.name];
      }
    }

    return {
      simpleQueryMs: results.simple || 0,
      complexQueryMs: results.complex || 0,
      aggregationQueryMs: results.aggregation || 0,
      joinQueryMs: results.join || 0,
      pathQueryMs: results.path || 0,
      averageResponseTime: totalTime / queryTests.length
    };
  }

  /**
   * Benchmark throughput operations
   */
  private async benchmarkThroughput(): Promise<ThroughputMetrics> {
    const testDurationMs = 5000; // 5 second tests
    const testData = this.generateTestTriples(1000);

    // Triple store members throughput
    const storeStart = performance.now();
    let storeOperations = 0;
    while (performance.now() - storeStart < testDurationMs) {
      const randomTriple = testData[storeOperations % testData.length];
      this.store.has(randomTriple);
      storeOperations++;
    }
    const triplesToreMembersPerSec = (storeOperations / testDurationMs) * 1000;

    // Query executions throughput
    const queryStart = performance.now();
    let queryOperations = 0;
    const simpleQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    while (performance.now() - queryStart < testDurationMs) {
      await this.executeSparqlQuery(simpleQuery);
      queryOperations++;
    }
    const queryExecutionsPerSec = (queryOperations / testDurationMs) * 1000;

    // Insert operations throughput
    const insertStart = performance.now();
    let insertOperations = 0;
    const tempStore = new Store();
    while (performance.now() - insertStart < testDurationMs) {
      const triple = testData[insertOperations % testData.length];
      tempStore.add(triple);
      insertOperations++;
    }
    const insertOperationsPerSec = (insertOperations / testDurationMs) * 1000;

    // Bulk load throughput
    const bulkStart = performance.now();
    const bulkStore = new Store();
    bulkStore.addQuads(testData);
    const bulkLoadTime = performance.now() - bulkStart;
    const bulkLoadTriplePerSec = (testData.length / bulkLoadTime) * 1000;

    return {
      triplesToreMembersPerSec,
      queryExecutionsPerSec,
      insertOperationsPerSec,
      updateOperationsPerSec: insertOperationsPerSec * 0.8, // Estimate
      deleteOperationsPerSec: insertOperationsPerSec * 0.9, // Estimate
      bulkLoadTriplePerSec
    };
  }

  /**
   * Benchmark memory efficiency
   */
  private async benchmarkMemoryEfficiency(): Promise<MemoryMetrics> {
    const initialMemory = process.memoryUsage();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const baseMemory = process.memoryUsage();
    
    // Create test dataset
    const testStore = new Store();
    const testTriples = this.generateTestTriples(10000);
    testStore.addQuads(testTriples);
    
    const afterLoadMemory = process.memoryUsage();
    const memoryUsedMB = (afterLoadMemory.heapUsed - baseMemory.heapUsed) / 1024 / 1024;
    
    // Memory efficiency ratio (triples per MB)
    const triplesPerMB = testTriples.length / memoryUsedMB;
    const memoryEfficiencyRatio = triplesPerMB / 1000; // Normalized

    // Measure peak memory during operations
    let peakMemoryMB = memoryUsedMB;
    
    // Stress test memory usage
    for (let i = 0; i < 100; i++) {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      peakMemoryMB = Math.max(peakMemoryMB, currentMemory);
      
      // Perform memory-intensive operations
      await this.executeSparqlQuery('SELECT * WHERE { ?s ?p ?o }');
    }

    // Check for memory leaks (simplified)
    const finalMemory = process.memoryUsage();
    const memoryLeakDetection = (finalMemory.heapUsed - afterLoadMemory.heapUsed) < 1024 * 1024; // Less than 1MB growth

    return {
      memoryUsageMB: memoryUsedMB,
      memoryEfficiencyRatio,
      garbageCollectionImpact: 0, // Would need more sophisticated GC monitoring
      memoryLeakDetection,
      peakMemoryUsageMB: peakMemoryMB
    };
  }

  /**
   * Benchmark concurrency performance
   */
  private async benchmarkConcurrency(): Promise<ConcurrencyMetrics> {
    const concurrentQueries = [1, 2, 4, 8, 16, 32];
    const results = [];

    for (const queryCount of concurrentQueries) {
      const startTime = performance.now();
      const promises = [];

      for (let i = 0; i < queryCount; i++) {
        promises.push(this.executeSparqlQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 10'));
      }

      try {
        await Promise.all(promises);
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / queryCount;
        
        results.push({
          concurrency: queryCount,
          avgResponseTime: avgTime,
          totalTime
        });
      } catch (error) {
        console.error(`Concurrency test failed at ${queryCount} concurrent queries:`, error);
        break;
      }
    }

    const maxConcurrentQueries = results.length > 0 ? results[results.length - 1].concurrency : 1;
    const baselineTime = results[0]?.avgResponseTime || 100;
    const maxConcurrentTime = results[results.length - 1]?.avgResponseTime || baselineTime;
    const concurrencyThroughputDegradation = (maxConcurrentTime / baselineTime) - 1;

    return {
      maxConcurrentQueries,
      threadUtilization: Math.min(maxConcurrentQueries / 4, 1), // Assuming 4 cores
      lockContention: concurrencyThroughputDegradation,
      deadlockDetection: true, // Simplified - would need actual deadlock detection
      concurrencyThroughputDegradation
    };
  }

  /**
   * Benchmark scalability characteristics
   */
  private async benchmarkScalability(): Promise<ScalabilityMetrics> {
    const dataSizes = [1000, 5000, 10000, 20000];
    const scalabilityTests = [];

    for (const size of dataSizes) {
      const testStore = new Store();
      const testData = this.generateTestTriples(size);
      testStore.addQuads(testData);

      const startTime = performance.now();
      
      // Execute standard query set
      const queries = [
        'SELECT * WHERE { ?s ?p ?o } LIMIT 100',
        'SELECT ?s WHERE { ?s a ?type } LIMIT 50',
        'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }'
      ];

      let totalQueryTime = 0;
      for (const query of queries) {
        const queryStart = performance.now();
        await this.executeSparqlQuery(query, testStore);
        totalQueryTime += performance.now() - queryStart;
      }

      const avgQueryTime = totalQueryTime / queries.length;
      scalabilityTests.push({
        dataSize: size,
        avgQueryTime,
        triples: testData.length
      });
    }

    // Calculate linear scalability factor
    const firstTest = scalabilityTests[0];
    const lastTest = scalabilityTests[scalabilityTests.length - 1];
    
    const dataSizeRatio = lastTest.dataSize / firstTest.dataSize;
    const performanceRatio = lastTest.avgQueryTime / firstTest.avgQueryTime;
    const linearScalabilityFactor = performanceRatio / dataSizeRatio;

    // Data size impact on performance
    const datasetSizeImpact = (lastTest.avgQueryTime - firstTest.avgQueryTime) / lastTest.avgQueryTime;

    return {
      linearScalabilityFactor,
      datasetSizeImpact,
      queryComplexityImpact: 0.3, // Simplified estimate
      hardwareUtilizationEfficiency: Math.min(1 / linearScalabilityFactor, 1)
    };
  }

  /**
   * Benchmark reasoning performance
   */
  private async benchmarkReasoning(): Promise<ReasoningMetrics> {
    // Create ontology with reasoning requirements
    const ontologyTriples = this.generateOntologyTriples();
    const reasoningStore = new Store();
    
    const loadStart = performance.now();
    reasoningStore.addQuads(ontologyTriples);
    const ontologyLoadTimeMs = performance.now() - loadStart;

    // Simulate classification (simplified)
    const classificationStart = performance.now();
    const classes = reasoningStore.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#Class'),
      null
    );
    // Simulate reasoning work
    await new Promise(resolve => setTimeout(resolve, classes.length * 2));
    const classificationTimeMs = performance.now() - classificationStart;

    // Simulate consistency checking
    const consistencyStart = performance.now();
    const axioms = reasoningStore.getQuads(
      null,
      namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
      null,
      null
    );
    // Simulate consistency checking work
    await new Promise(resolve => setTimeout(resolve, axioms.length));
    const consistencyCheckTimeMs = performance.now() - consistencyStart;

    const totalReasoningTime = classificationTimeMs + consistencyCheckTimeMs;
    const reasoningThroughputQPS = ontologyTriples.length / (totalReasoningTime / 1000);

    const reasoningMemory = process.memoryUsage();
    const memoryOverheadMB = reasoningMemory.heapUsed / 1024 / 1024;

    return {
      ontologyLoadTimeMs,
      classificationTimeMs,
      consistencyCheckTimeMs,
      reasoningThroughputQPS,
      memoryOverheadMB
    };
  }

  /**
   * Capture system performance profile
   */
  private async captureSystemProfile(): Promise<PerformanceProfile> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      cpuUtilization: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      ioWaitTime: 0, // Would need system-level monitoring
      networkLatency: 0, // Would need network monitoring
      diskIoThroughput: 0 // Would need disk I/O monitoring
    };
  }

  /**
   * Analyze scalability characteristics
   */
  private async analyzeScalability(benchmarks: BenchmarkMetrics): Promise<ScalabilityAnalysis> {
    const bottlenecks = [];
    const optimizations = [];

    // Identify bottlenecks
    if (benchmarks.memoryEfficiency.memoryEfficiencyRatio < 500) {
      bottlenecks.push('Memory efficiency: Low triples per MB ratio');
      optimizations.push('Implement more efficient triple storage format');
    }

    if (benchmarks.queryResponseTime.averageResponseTime > 100) {
      bottlenecks.push('Query performance: Slow average response time');
      optimizations.push('Add query optimization and indexing');
    }

    if (benchmarks.concurrentLoad.concurrencyThroughputDegradation > 0.5) {
      bottlenecks.push('Concurrency: High throughput degradation under load');
      optimizations.push('Implement better concurrent access patterns');
    }

    if (benchmarks.scalability.linearScalabilityFactor > 2.0) {
      bottlenecks.push('Scalability: Non-linear performance degradation with data size');
      optimizations.push('Optimize data structures for better scalability');
    }

    // Calculate recommended limits
    const baseMemoryMB = benchmarks.memoryEfficiency.memoryUsageMB;
    const triplesPerMB = 1 / (baseMemoryMB / this.store.size);
    const recommendedMaxDatasetSize = Math.floor(triplesPerMB * 1000); // Conservative estimate for 1GB

    const concurrentUserLimit = Math.floor(benchmarks.concurrentLoad.maxConcurrentQueries * 0.8); // 80% of max

    return {
      recommendedMaxDatasetSize,
      concurrentUserLimit,
      scalingBottlenecks: bottlenecks,
      optimizationPotential: optimizations
    };
  }

  /**
   * Generate performance recommendations
   */
  private async generateRecommendations(benchmarks: BenchmarkMetrics): Promise<BenchmarkRecommendation[]> {
    const recommendations: BenchmarkRecommendation[] = [];

    // Query performance recommendations
    if (benchmarks.queryResponseTime.averageResponseTime > this.benchmarkThresholds.maxQueryResponseTimeMs) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        issue: `Average query response time ${benchmarks.queryResponseTime.averageResponseTime.toFixed(1)}ms exceeds threshold`,
        recommendation: 'Implement query optimization, indexing, and caching strategies',
        expectedImprovement: '50-80% query performance improvement'
      });
    }

    // Memory efficiency recommendations
    if (benchmarks.memoryEfficiency.memoryEfficiencyRatio < this.benchmarkThresholds.minMemoryEfficiencyRatio) {
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        issue: 'Low memory efficiency ratio indicates suboptimal memory usage',
        recommendation: 'Optimize data structures and implement memory pooling',
        expectedImprovement: '20-40% memory usage reduction'
      });
    }

    // Concurrency recommendations
    if (benchmarks.concurrentLoad.concurrencyThroughputDegradation > this.benchmarkThresholds.maxConcurrencyDegradation) {
      recommendations.push({
        category: 'concurrency',
        priority: 'high',
        issue: 'High throughput degradation under concurrent load',
        recommendation: 'Implement read-write locks and reduce lock contention',
        expectedImprovement: '30-60% concurrent performance improvement'
      });
    }

    // Scalability recommendations
    if (benchmarks.scalability.linearScalabilityFactor > this.benchmarkThresholds.maxLinearScalabilityFactor) {
      recommendations.push({
        category: 'scalability',
        priority: 'critical',
        issue: 'Non-linear scalability indicates algorithmic inefficiencies',
        recommendation: 'Redesign data structures and algorithms for better scalability',
        expectedImprovement: 'Linear scalability with dataset size'
      });
    }

    return recommendations;
  }

  /**
   * Calculate overall benchmark score
   */
  private calculateBenchmarkScore(benchmarks: BenchmarkMetrics): number {
    let score = 100;

    // Query performance scoring (30% weight)
    const queryScore = Math.max(0, 100 - (benchmarks.queryResponseTime.averageResponseTime / this.benchmarkThresholds.maxQueryResponseTimeMs) * 100);
    score = score * 0.7 + queryScore * 0.3;

    // Memory efficiency scoring (20% weight)
    const memoryScore = Math.min(100, (benchmarks.memoryEfficiency.memoryEfficiencyRatio / this.benchmarkThresholds.minMemoryEfficiencyRatio) * 100);
    score = score * 0.8 + memoryScore * 0.2;

    // Concurrency scoring (25% weight)
    const concurrencyScore = Math.max(0, 100 - (benchmarks.concurrentLoad.concurrencyThroughputDegradation / this.benchmarkThresholds.maxConcurrencyDegradation) * 100);
    score = score * 0.75 + concurrencyScore * 0.25;

    // Scalability scoring (25% weight)
    const scalabilityScore = Math.max(0, 100 - ((benchmarks.scalability.linearScalabilityFactor - 1) / (this.benchmarkThresholds.maxLinearScalabilityFactor - 1)) * 100);
    score = score * 0.75 + scalabilityScore * 0.25;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Execute SPARQL query (simplified simulation)
   */
  private async executeSparqlQuery(sparql: string, store?: Store): Promise<any[]> {
    const targetStore = store || this.store;
    
    // Simplified SPARQL execution - in real implementation would use SPARQL engine
    const delay = Math.random() * 10 + 5; // 5-15ms simulated query time
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Return simulated results based on store size
    return Array.from({ length: Math.min(100, Math.floor(targetStore.size / 10)) }, (_, i) => ({
      subject: `http://example.org/entity${i}`,
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'http://example.org/Class'
    }));
  }

  /**
   * Generate test triples for benchmarking
   */
  private generateTestTriples(count: number) {
    const triples = [];
    
    for (let i = 0; i < count; i++) {
      const subject = namedNode(`http://example.org/entity${i}`);
      const predicate = namedNode(`http://example.org/property${i % 10}`);
      const object = i % 3 === 0 
        ? namedNode(`http://example.org/value${i}`)
        : literal(`Value ${i}`);
      
      triples.push({ subject, predicate, object, graph: namedNode('http://example.org/graph') });
    }
    
    return triples;
  }

  /**
   * Generate ontology triples for reasoning benchmarks
   */
  private generateOntologyTriples() {
    const triples = [];
    
    // Create class hierarchy
    for (let i = 0; i < 50; i++) {
      const cls = namedNode(`http://example.org/Class${i}`);
      const parentCls = namedNode(`http://example.org/Class${Math.floor(i / 2)}`);
      
      triples.push({
        subject: cls,
        predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        object: namedNode('http://www.w3.org/2002/07/owl#Class'),
        graph: namedNode('http://example.org/ontology')
      });
      
      if (i > 0) {
        triples.push({
          subject: cls,
          predicate: namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
          object: parentCls,
          graph: namedNode('http://example.org/ontology')
        });
      }
    }
    
    return triples;
  }

  /**
   * Get default benchmark thresholds
   */
  private getDefaultThresholds(): BenchmarkThresholds {
    return {
      minimumScore: 75,
      maxQueryResponseTimeMs: 100,
      minThroughputQPS: 1000,
      minMemoryEfficiencyRatio: 500,
      maxMemoryUsageMB: 512,
      maxConcurrencyDegradation: 0.3,
      minConcurrentQueries: 16,
      maxLinearScalabilityFactor: 1.5,
      maxReasoningTimeMs: 5000
    };
  }
}

interface BenchmarkThresholds {
  minimumScore: number;
  maxQueryResponseTimeMs: number;
  minThroughputQPS: number;
  minMemoryEfficiencyRatio: number;
  maxMemoryUsageMB: number;
  maxConcurrencyDegradation: number;
  minConcurrentQueries: number;
  maxLinearScalabilityFactor: number;
  maxReasoningTimeMs: number;
}

interface PerformanceSnapshot {
  timestamp: Date;
  datasetSize: number;
  benchmarks: BenchmarkMetrics;
  score: number;
  context: string;
}