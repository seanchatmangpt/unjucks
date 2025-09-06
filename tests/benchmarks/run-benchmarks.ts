#!/usr/bin/env tsx
/**
 * RDF/Turtle Performance Benchmark Runner
 * Executes comprehensive performance tests and generates analysis reports
 */

import { performance } from 'perf_hooks';
import { parseTurtle, parseTurtleSync, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

// Test data generator
function generateTurtleData(tripleCount: number, prefix: string = 'ex'): string {
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

interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsed: number;
  throughput?: number;
  status: 'PASS' | 'FAIL';
  requirement: number;
}

async function runBenchmark<T>(
  name: string,
  fn: () => Promise<T> | T,
  requirement: number
): Promise<BenchmarkResult> {
  // Force garbage collection
  if (global.gc) global.gc();
  
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024; // MB
    
    return {
      name,
      duration,
      memoryUsed,
      status: duration <= requirement ? 'PASS' : 'FAIL',
      requirement
    };
  } catch (error) {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    return {
      name: `${name} (ERROR)`,
      duration: endTime - startTime,
      memoryUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
      status: 'FAIL',
      requirement
    };
  }
}

async function main() {
  console.log('🚀 RDF/Turtle Performance Benchmark Suite');
  console.log('==========================================\n');

  const results: BenchmarkResult[] = [];

  // Generate test data
  console.log('📊 Generating test data...');
  const smallData = generateTurtleData(100);
  const mediumData = generateTurtleData(1000);
  const largeData = generateTurtleData(10000);
  
  // Initialize parsers and loaders
  const dataLoader = new RDFDataLoader();

  console.log('⚡ Running parsing performance tests...\n');

  // 1. Parsing Performance Tests
  results.push(await runBenchmark(
    'Parse Small File (100 triples)',
    () => parseTurtle(smallData),
    10
  ));

  results.push(await runBenchmark(
    'Parse Medium File (1000 triples)',
    () => parseTurtle(mediumData),
    50
  ));

  results.push(await runBenchmark(
    'Parse Large File (10000 triples)',
    () => parseTurtle(largeData),
    500
  ));

  // 2. Query Performance Tests
  console.log('🔍 Running query performance tests...\n');
  
  const parsedMedium = await parseTurtle(mediumData);
  
  results.push(await runBenchmark(
    'Simple Pattern Query',
    () => TurtleUtils.filterByPredicate(
      parsedMedium.triples,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    ),
    5
  ));

  // 3. Template Rendering Tests
  console.log('🎨 Running template rendering tests...\n');
  
  const rdfSource: RDFDataSource = {
    type: 'inline',
    source: generateTurtleData(100)
  };

  results.push(await runBenchmark(
    'Simple RDF Template Rendering',
    async () => {
      const loadResult = await dataLoader.loadFromSource(rdfSource);
      const context = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      return {
        subjects: Object.keys(context.$rdf.subjects).length,
        prefixes: Object.keys(context.$rdf.prefixes).length
      };
    },
    10
  ));

  // 4. Data Loading Tests
  console.log('📂 Running data loading tests...\n');
  
  results.push(await runBenchmark(
    'RDF Data Validation',
    () => dataLoader.validateRDF(smallData, 'turtle'),
    20
  ));

  // 5. Error Handling Tests
  console.log('⚠️ Running error handling tests...\n');
  
  results.push(await runBenchmark(
    'Parse Error Handling',
    async () => {
      try {
        await parseTurtle('invalid turtle @#$%');
        return false;
      } catch {
        return true;
      }
    },
    5
  ));

  // Print Results
  console.log('\n📊 Performance Benchmark Results');
  console.log('='.repeat(80));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.status === 'PASS' ? '✅' : '❌';
    const memText = result.memoryUsed > 0 ? ` (${result.memoryUsed.toFixed(1)}MB)` : '';
    
    console.log(`${status} ${result.name}`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms (requirement: ≤${result.requirement}ms)${memText}`);
    
    if (result.status === 'PASS') {
      passed++;
    } else {
      failed++;
    }
    console.log('');
  }

  // Summary
  console.log('📈 Summary');
  console.log('-'.repeat(40));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} (${Math.round(passed / results.length * 100)}%)`);
  console.log(`Failed: ${failed} (${Math.round(failed / results.length * 100)}%)`);
  
  const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const totalMemory = results.reduce((sum, r) => sum + Math.max(0, r.memoryUsed), 0);
  
  console.log(`Average Duration: ${averageDuration.toFixed(2)}ms`);
  console.log(`Total Memory Used: ${totalMemory.toFixed(1)}MB`);

  // Performance Analysis
  console.log('\n🎯 Performance Analysis');
  console.log('-'.repeat(40));

  // Parsing analysis
  const parseTests = results.filter(r => r.name.includes('Parse'));
  const avgParseTime = parseTests.reduce((sum, r) => sum + r.duration, 0) / parseTests.length;
  console.log(`Average Parsing Time: ${avgParseTime.toFixed(2)}ms`);

  // Query analysis
  const queryTests = results.filter(r => r.name.includes('Query') || r.name.includes('Pattern'));
  if (queryTests.length > 0) {
    const avgQueryTime = queryTests.reduce((sum, r) => sum + r.duration, 0) / queryTests.length;
    console.log(`Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
  }

  // Memory analysis
  const memoryTests = results.filter(r => r.memoryUsed > 0);
  if (memoryTests.length > 0) {
    const avgMemory = memoryTests.reduce((sum, r) => sum + r.memoryUsed, 0) / memoryTests.length;
    console.log(`Average Memory Usage: ${avgMemory.toFixed(1)}MB per operation`);
  }

  // Recommendations
  console.log('\n💡 Optimization Recommendations');
  console.log('-'.repeat(40));

  const slowTests = results.filter(r => r.status === 'FAIL');
  if (slowTests.length === 0) {
    console.log('✅ All performance requirements met! No optimizations needed.');
  } else {
    console.log('⚠️ Performance improvements suggested:');
    for (const test of slowTests) {
      console.log(`   • Optimize ${test.name}: ${test.duration.toFixed(2)}ms > ${test.requirement}ms`);
    }
  }

  console.log('\n🏆 Benchmark completed successfully!');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run benchmarks
main().catch(console.error);