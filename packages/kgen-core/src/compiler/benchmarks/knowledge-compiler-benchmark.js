/**
 * Knowledge Compiler Performance Benchmarks
 * Tests compilation performance with varying graph sizes and rule complexity
 */

import { KnowledgeCompiler } from '../knowledge-compiler.js';
import { performance } from 'perf_hooks';

/**
 * Generate synthetic RDF graph for testing
 */
function generateSyntheticGraph(nodeCount, tripleCount) {
  const triples = [];
  const predicates = [
    'http://unjucks.dev/template/hasVariable',
    'http://unjucks.dev/api/hasEndpoint',
    'http://unjucks.dev/data/hasField',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    'http://www.w3.org/2000/01/rdf-schema#comment'
  ];
  
  for (let i = 0; i < tripleCount; i++) {
    const subjectId = Math.floor(Math.random() * nodeCount);
    const predicateId = Math.floor(Math.random() * predicates.length);
    
    triples.push({
      subject: `http://unjucks.dev/entity/node${subjectId}`,
      predicate: predicates[predicateId],
      object: { 
        type: 'literal', 
        value: `value${i}`,
        datatype: i % 3 === 0 ? 'http://www.w3.org/2001/XMLSchema#integer' : undefined
      }
    });
  }
  
  return { triples };
}

/**
 * Generate synthetic N3 rules for testing
 */
function generateSyntheticRules(ruleCount, complexity = 'simple') {
  const rules = [];
  
  for (let i = 0; i < ruleCount; i++) {
    const ruleBody = complexity === 'simple' ? 
      generateSimpleRule(i) : 
      generateComplexRule(i);
    
    rules.push({
      name: `Rule ${i}`,
      body: ruleBody
    });
  }
  
  return rules;
}

function generateSimpleRule(index) {
  return `{
    ?entity <http://unjucks.dev/template/hasVariable> ?var${index}
  } => {
    ?entity <http://unjucks.dev/template/isCompiled> true
  }`;
}

function generateComplexRule(index) {
  return `{
    ?entity <http://unjucks.dev/template/hasVariable> ?var .
    ?entity <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type .
    ?entity <http://unjucks.dev/api/hasEndpoint> ?endpoint
  } => {
    ?entity <http://unjucks.dev/template/isCompiled> true .
    ?entity <http://unjucks.dev/api/requiresValidation> true .
    ?entity <http://unjucks.dev/security/threatLevel> "medium"
  }`;
}

/**
 * Benchmark compilation performance
 */
export async function benchmarkCompilationPerformance() {
  console.log('🏃‍♂️ Starting Knowledge Compiler Performance Benchmarks\n');
  
  const results = {
    smallGraph: null,
    mediumGraph: null,
    largeGraph: null,
    ruleComplexity: null,
    cachePerformance: null
  };

  // Test 1: Small graph (100 nodes, 500 triples)
  console.log('📊 Test 1: Small Graph Performance');
  results.smallGraph = await benchmarkGraphSize(100, 500, 5);
  
  // Test 2: Medium graph (1000 nodes, 5000 triples)
  console.log('📊 Test 2: Medium Graph Performance');
  results.mediumGraph = await benchmarkGraphSize(1000, 5000, 10);
  
  // Test 3: Large graph (10000 nodes, 50000 triples)
  console.log('📊 Test 3: Large Graph Performance');
  results.largeGraph = await benchmarkGraphSize(10000, 50000, 20);
  
  // Test 4: Rule complexity impact
  console.log('📊 Test 4: Rule Complexity Impact');
  results.ruleComplexity = await benchmarkRuleComplexity();
  
  // Test 5: Cache performance
  console.log('📊 Test 5: Cache Performance');
  results.cachePerformance = await benchmarkCachePerformance();
  
  // Print summary
  printBenchmarkSummary(results);
  
  return results;
}

/**
 * Benchmark specific graph size
 */
async function benchmarkGraphSize(nodeCount, tripleCount, ruleCount) {
  const compiler = new KnowledgeCompiler({ enableCaching: false });
  await compiler.initialize();
  
  const graph = generateSyntheticGraph(nodeCount, tripleCount);
  const rules = generateSyntheticRules(ruleCount, 'simple');
  
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await compiler.compileContext(graph, rules);
    const end = performance.now();
    times.push(end - start);
  }
  
  const metrics = compiler.getMetrics();
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  const result = {
    nodeCount,
    tripleCount,
    ruleCount,
    avgTimeMs: Math.round(avgTime * 100) / 100,
    minTimeMs: Math.round(minTime * 100) / 100,
    maxTimeMs: Math.round(maxTime * 100) / 100,
    variablesExtracted: metrics.variablesExtracted,
    factsInferred: metrics.factsInferred,
    throughput: Math.round((tripleCount / avgTime) * 1000) // triples per second
  };
  
  console.log(`  Nodes: ${nodeCount}, Triples: ${tripleCount}, Rules: ${ruleCount}`);
  console.log(`  Avg Time: ${result.avgTimeMs}ms`);
  console.log(`  Throughput: ${result.throughput} triples/sec`);
  console.log(`  Variables: ${result.variablesExtracted}, Facts: ${result.factsInferred}\n`);
  
  return result;
}

/**
 * Benchmark rule complexity impact
 */
async function benchmarkRuleComplexity() {
  const compiler = new KnowledgeCompiler({ enableCaching: false });
  await compiler.initialize();
  
  const graph = generateSyntheticGraph(1000, 5000);
  const ruleCount = 10;
  
  // Test simple rules
  const simpleRules = generateSyntheticRules(ruleCount, 'simple');
  const simpleStart = performance.now();
  await compiler.compileContext(graph, simpleRules);
  const simpleEnd = performance.now();
  const simpleTime = simpleEnd - simpleStart;
  const simpleMetrics = compiler.getMetrics();
  
  // Reset compiler
  compiler.clearCaches();
  
  // Test complex rules
  const complexRules = generateSyntheticRules(ruleCount, 'complex');
  const complexStart = performance.now();
  await compiler.compileContext(graph, complexRules);
  const complexEnd = performance.now();
  const complexTime = complexEnd - complexStart;
  const complexMetrics = compiler.getMetrics();
  
  const result = {
    simple: {
      timeMs: Math.round(simpleTime * 100) / 100,
      factsInferred: simpleMetrics.factsInferred
    },
    complex: {
      timeMs: Math.round(complexTime * 100) / 100,
      factsInferred: complexMetrics.factsInferred
    },
    complexityOverhead: Math.round(((complexTime / simpleTime) - 1) * 100)
  };
  
  console.log(`  Simple Rules: ${result.simple.timeMs}ms, ${result.simple.factsInferred} facts`);
  console.log(`  Complex Rules: ${result.complex.timeMs}ms, ${result.complex.factsInferred} facts`);
  console.log(`  Complexity Overhead: +${result.complexityOverhead}%\n`);
  
  return result;
}

/**
 * Benchmark cache performance
 */
async function benchmarkCachePerformance() {
  const graph = generateSyntheticGraph(1000, 5000);
  const rules = generateSyntheticRules(10, 'simple');
  
  // Test without cache
  const noCacheCompiler = new KnowledgeCompiler({ enableCaching: false });
  await noCacheCompiler.initialize();
  
  const noCacheStart = performance.now();
  await noCacheCompiler.compileContext(graph, rules);
  const noCacheEnd = performance.now();
  const noCacheTime = noCacheEnd - noCacheStart;
  
  // Test with cache (first run - cache miss)
  const cacheCompiler = new KnowledgeCompiler({ enableCaching: true });
  await cacheCompiler.initialize();
  
  const cacheMissStart = performance.now();
  await cacheCompiler.compileContext(graph, rules);
  const cacheMissEnd = performance.now();
  const cacheMissTime = cacheMissEnd - cacheMissStart;
  
  // Second run - cache hit
  const cacheHitStart = performance.now();
  await cacheCompiler.compileContext(graph, rules);
  const cacheHitEnd = performance.now();
  const cacheHitTime = cacheHitEnd - cacheHitStart;
  
  const metrics = cacheCompiler.getMetrics();
  
  const result = {
    noCache: Math.round(noCacheTime * 100) / 100,
    cacheMiss: Math.round(cacheMissTime * 100) / 100,
    cacheHit: Math.round(cacheHitTime * 100) / 100,
    speedupRatio: Math.round((cacheMissTime / cacheHitTime) * 10) / 10,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses
  };
  
  console.log(`  No Cache: ${result.noCache}ms`);
  console.log(`  Cache Miss: ${result.cacheMiss}ms`);
  console.log(`  Cache Hit: ${result.cacheHit}ms`);
  console.log(`  Cache Speedup: ${result.speedupRatio}x\n`);
  
  return result;
}

/**
 * Print benchmark summary
 */
function printBenchmarkSummary(results) {
  console.log('📈 Benchmark Summary');
  console.log('===================');
  
  console.log('\n🏃‍♂️ Graph Size Performance:');
  console.log(`Small Graph:  ${results.smallGraph.avgTimeMs}ms (${results.smallGraph.throughput} triples/sec)`);
  console.log(`Medium Graph: ${results.mediumGraph.avgTimeMs}ms (${results.mediumGraph.throughput} triples/sec)`);
  console.log(`Large Graph:  ${results.largeGraph.avgTimeMs}ms (${results.largeGraph.throughput} triples/sec)`);
  
  console.log('\n🧠 Rule Complexity Impact:');
  console.log(`Simple Rules: ${results.ruleComplexity.simple.timeMs}ms`);
  console.log(`Complex Rules: ${results.ruleComplexity.complex.timeMs}ms (+${results.ruleComplexity.complexityOverhead}%)`);
  
  console.log('\n💾 Cache Performance:');
  console.log(`Cache Hit Speedup: ${results.cachePerformance.speedupRatio}x faster`);
  console.log(`Cache Hit Time: ${results.cachePerformance.cacheHit}ms`);
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  
  if (results.cachePerformance.speedupRatio > 5) {
    console.log('✅ Caching is highly effective - keep enabled in production');
  }
  
  if (results.ruleComplexity.complexityOverhead > 50) {
    console.log('⚠️  Complex rules have significant overhead - optimize critical paths');
  }
  
  if (results.largeGraph.throughput < 1000) {
    console.log('⚠️  Large graph processing is slow - consider parallel processing');
  } else {
    console.log('✅ Graph processing performance is good');
  }
  
  console.log();
}

/**
 * Memory usage benchmark
 */
export async function benchmarkMemoryUsage() {
  console.log('🧠 Memory Usage Benchmark\n');
  
  const compiler = new KnowledgeCompiler({ enableCaching: true });
  await compiler.initialize();
  
  const initialMemory = process.memoryUsage();
  
  // Process increasingly large graphs
  const sizes = [
    { nodes: 100, triples: 500 },
    { nodes: 500, triples: 2500 },
    { nodes: 1000, triples: 5000 },
    { nodes: 2000, triples: 10000 }
  ];
  
  const memoryResults = [];
  
  for (const size of sizes) {
    const graph = generateSyntheticGraph(size.nodes, size.triples);
    const rules = generateSyntheticRules(5);
    
    await compiler.compileContext(graph, rules);
    
    const currentMemory = process.memoryUsage();
    const memoryDelta = {
      heapUsed: currentMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: currentMemory.heapTotal - initialMemory.heapTotal,
      rss: currentMemory.rss - initialMemory.rss
    };
    
    memoryResults.push({
      size,
      memory: memoryDelta,
      memoryPerTriple: Math.round(memoryDelta.heapUsed / size.triples)
    });
    
    console.log(`Graph: ${size.nodes} nodes, ${size.triples} triples`);
    console.log(`  Heap Used: ${Math.round(memoryDelta.heapUsed / 1024 / 1024 * 100) / 100} MB`);
    console.log(`  Memory/Triple: ${memoryResults[memoryResults.length - 1].memoryPerTriple} bytes`);
    console.log();
  }
  
  return memoryResults;
}

/**
 * Concurrent compilation benchmark
 */
export async function benchmarkConcurrentCompilation() {
  console.log('🔄 Concurrent Compilation Benchmark\n');
  
  const graph = generateSyntheticGraph(1000, 5000);
  const rules = generateSyntheticRules(10);
  
  const concurrencyLevels = [1, 2, 4, 8];
  const results = [];
  
  for (const concurrency of concurrencyLevels) {
    const start = performance.now();
    
    const promises = Array.from({ length: concurrency }, async () => {
      const compiler = new KnowledgeCompiler({ enableCaching: false });
      await compiler.initialize();
      return compiler.compileContext(graph, rules);
    });
    
    await Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;
    const throughput = Math.round((concurrency / totalTime) * 1000);
    
    results.push({
      concurrency,
      totalTimeMs: Math.round(totalTime * 100) / 100,
      avgTimePerCompilation: Math.round((totalTime / concurrency) * 100) / 100,
      compilationsPerSecond: throughput
    });
    
    console.log(`Concurrency: ${concurrency}`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput} compilations/sec`);
    console.log();
  }
  
  return results;
}

// Export all benchmark functions
export {
  generateSyntheticGraph,
  generateSyntheticRules,
  benchmarkGraphSize,
  benchmarkRuleComplexity,
  benchmarkCachePerformance
};

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.all([
    benchmarkCompilationPerformance(),
    benchmarkMemoryUsage(),
    benchmarkConcurrentCompilation()
  ]).catch(console.error);
}