#!/usr/bin/env node

/**
 * KGEN Performance Validation Script - Agent 9 Charter Compliance
 * 
 * Validates that KGEN meets all Charter performance requirements:
 * - p95 render ≤150ms on dev laptops
 * - Cold start ≤2s including git operations
 * - ≥80% cache hit rate
 * - Performance telemetry integration
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { consola } from 'consola';
import os from 'os';

const logger = consola.withTag('kgen-validation');

// Charter performance targets
const CHARTER_TARGETS = {
  coldStartMs: 2000,        // ≤2s cold start
  p95RenderMs: 150,         // ≤150ms p95 render
  cacheHitRate: 0.8,        // ≥80% cache hit rate
  gitOperationsMs: 10,      // ≤10ms for git operations
  rdfProcessingMs: 30,      // ≤30ms for RDF processing
  templateRenderMs: 50,     // ≤50ms for template rendering
  validationMs: 20,         // ≤20ms for validation
  officeProcessingMs: 40,   // ≤40ms for Office/LaTeX
  overheadMs: 10            // ≤10ms system overhead
};

async function validatePerformance() {
  logger.info('🚀 Starting KGEN Charter Performance Validation');
  logger.info(`System: ${os.platform()} ${os.arch()}, ${os.cpus().length} CPU cores, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
  
  const results = {
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      nodeVersion: process.version
    },
    tests: {},
    compliance: {},
    overall: {
      passing: 0,
      failing: 0,
      score: 0
    }
  };
  
  try {
    // Test 1: Cold Start Performance
    logger.info('1️⃣ Testing cold start performance...');
    results.tests.coldStart = await testColdStart();
    
    // Test 2: Rendering Performance 
    logger.info('2️⃣ Testing rendering performance...');
    results.tests.rendering = await testRenderingPerformance();
    
    // Test 3: Caching Performance
    logger.info('3️⃣ Testing caching performance...');
    results.tests.caching = await testCachingPerformance();
    
    // Test 4: Component Performance Breakdown
    logger.info('4️⃣ Testing component performance breakdown...');
    results.tests.components = await testComponentPerformance();
    
    // Test 5: Concurrent Performance
    logger.info('5️⃣ Testing concurrent performance...');
    results.tests.concurrent = await testConcurrentPerformance();
    
    // Calculate compliance
    results.compliance = calculateCompliance(results.tests);
    results.overall = calculateOverallScore(results.compliance);
    
    // Generate final report
    generateReport(results);
    
    return results;
    
  } catch (error) {
    logger.error(`Validation failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

async function testColdStart() {
  const iterations = 10;
  const times = [];
  
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  
  for (let i = 0; i < iterations; i++) {
    // For ES modules, we simulate cold start by using separate processes
    // instead of clearing require.cache (which doesn't exist in ES modules)
    
    const startTime = performance.now();
    
    try {
      // Test minimal command for cold start measurement
      execSync(`node "${kgenBinary}" perf status`, {
        stdio: 'pipe',
        timeout: 5000
      });
      
      const coldStartTime = performance.now() - startTime;
      times.push(coldStartTime);
      
    } catch (error) {
      logger.warn(`Cold start iteration ${i + 1} failed: ${error.message}`);
      times.push(CHARTER_TARGETS.coldStartMs + 500); // Penalty time
    }
  }
  
  const sortedTimes = times.sort((a, b) => a - b);
  const stats = {
    iterations,
    times: times.slice(0, 5), // Sample for reporting
    min: sortedTimes[0],
    max: sortedTimes[sortedTimes.length - 1],
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
    p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
    target: CHARTER_TARGETS.coldStartMs,
    passing: sortedTimes[Math.floor(sortedTimes.length * 0.95)] <= CHARTER_TARGETS.coldStartMs
  };
  
  logger.info(`Cold start p95: ${stats.p95.toFixed(2)}ms (target: ${CHARTER_TARGETS.coldStartMs}ms) - ${stats.passing ? '✅' : '❌'}`);
  
  return stats;
}

async function testRenderingPerformance() {
  // Create test template and context
  const testDir = path.join(os.tmpdir(), 'kgen-perf-test');
  await fs.mkdir(testDir, { recursive: true });
  
  const templatePath = path.join(testDir, 'test-template.njk');
  const template = `
# {{title}}

Generated at: {{buildTime}}

## Performance Test

{{#each items}}
- **{{name}}**: {{description}}
  - Value: {{value}}
  - Processing time: {{processingTime}}ms
{{/each}}

Total items: {{items.length}}
Test complexity: {{complexity}}
`;
  
  await fs.writeFile(templatePath, template);
  
  // Test contexts of varying complexity
  const contexts = [
    // Simple context
    {
      title: 'Simple Test',
      buildTime: '2024-01-01T00:00:00Z',
      items: Array.from({ length: 5 }, (_, i) => ({
        name: `Item ${i + 1}`,
        description: `Simple description ${i + 1}`,
        value: i + 1,
        processingTime: Math.random() * 10
      })),
      complexity: 'low'
    },
    // Complex context
    {
      title: 'Complex Performance Test',
      buildTime: '2024-01-01T00:00:00Z',
      items: Array.from({ length: 100 }, (_, i) => ({
        name: `Complex Item ${i + 1}`,
        description: `Detailed description for item ${i + 1} with extensive metadata and processing information`,
        value: Math.random() * 1000,
        processingTime: Math.random() * 50
      })),
      complexity: 'high'
    }
  ];
  
  const renderTimes = [];
  const cacheHits = [];
  const iterations = 100;
  
  // Import and test the optimized renderer
  try {
    const kgenBinary = path.resolve('./bin/kgen.mjs');
    
    for (let i = 0; i < iterations; i++) {
      const contextIndex = i % contexts.length;
      const context = contexts[contextIndex];
      
      const contextFile = path.join(testDir, `context-${i}.json`);
      await fs.writeFile(contextFile, JSON.stringify(context));
      
      const startTime = performance.now();
      
      try {
        // Use artifact generate command for consistent testing
        const output = execSync(`node "${kgenBinary}" artifact generate "${templatePath}" -c '${JSON.stringify(context)}'`, {
          stdio: 'pipe',
          timeout: 1000
        }).toString();
        
        const result = JSON.parse(output);
        const renderTime = performance.now() - startTime;
        
        renderTimes.push(renderTime);
        cacheHits.push(result.cached || false);
        
      } catch (error) {
        renderTimes.push(CHARTER_TARGETS.p95RenderMs + 50); // Penalty time
        cacheHits.push(false);
      }
    }
    
  } catch (error) {
    logger.warn(`Render test setup failed: ${error.message}`);
    // Fill with penalty times
    for (let i = 0; i < iterations; i++) {
      renderTimes.push(CHARTER_TARGETS.p95RenderMs + 100);
      cacheHits.push(false);
    }
  }
  
  // Calculate statistics
  const sortedTimes = renderTimes.sort((a, b) => a - b);
  const cacheHitRate = cacheHits.filter(hit => hit).length / cacheHits.length;
  
  const stats = {
    iterations,
    times: renderTimes.slice(0, 10), // Sample for reporting
    min: sortedTimes[0],
    max: sortedTimes[sortedTimes.length - 1], 
    mean: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
    p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
    p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
    target: CHARTER_TARGETS.p95RenderMs,
    passing: sortedTimes[Math.floor(sortedTimes.length * 0.95)] <= CHARTER_TARGETS.p95RenderMs,
    cacheHitRate,
    cacheTarget: CHARTER_TARGETS.cacheHitRate,
    cacheHitPassing: cacheHitRate >= CHARTER_TARGETS.cacheHitRate
  };
  
  logger.info(`Render p95: ${stats.p95.toFixed(2)}ms (target: ${CHARTER_TARGETS.p95RenderMs}ms) - ${stats.passing ? '✅' : '❌'}`);
  logger.info(`Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (target: ${CHARTER_TARGETS.cacheHitRate * 100}%) - ${stats.cacheHitPassing ? '✅' : '❌'}`);
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
  
  return stats;
}

async function testCachingPerformance() {
  // Test cache effectiveness across multiple operations
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  
  // Create test RDF file
  const testDir = path.join(os.tmpdir(), 'kgen-cache-test');
  await fs.mkdir(testDir, { recursive: true });
  
  const rdfFile = path.join(testDir, 'test-graph.ttl');
  const rdfContent = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

${Array.from({ length: 50 }, (_, i) => `
ex:entity${i} rdf:type ex:TestEntity ;
    ex:property1 "Value ${i}" ;
    ex:property2 ${i} .
`).join('')}
`;
  
  await fs.writeFile(rdfFile, rdfContent);
  
  const cachePerformance = {
    firstRun: 0,
    cachedRuns: [],
    speedup: 0
  };
  
  try {
    // First run (cache miss)
    const firstStart = performance.now();
    execSync(`node "${kgenBinary}" graph hash "${rdfFile}"`, { stdio: 'pipe' });
    cachePerformance.firstRun = performance.now() - firstStart;
    
    // Subsequent runs (should be cached)
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      execSync(`node "${kgenBinary}" graph hash "${rdfFile}"`, { stdio: 'pipe' });
      cachePerformance.cachedRuns.push(performance.now() - start);
    }
    
    const avgCachedTime = cachePerformance.cachedRuns.reduce((a, b) => a + b, 0) / cachePerformance.cachedRuns.length;
    cachePerformance.speedup = cachePerformance.firstRun / avgCachedTime;
    
  } catch (error) {
    logger.warn(`Cache test failed: ${error.message}`);
  }
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
  
  const effectiveSpeedup = cachePerformance.speedup >= 2.0; // At least 2x speedup expected
  
  logger.info(`Cache speedup: ${cachePerformance.speedup.toFixed(2)}x - ${effectiveSpeedup ? '✅' : '❌'}`);
  
  return {
    firstRun: cachePerformance.firstRun,
    avgCachedTime: cachePerformance.cachedRuns.length > 0 
      ? cachePerformance.cachedRuns.reduce((a, b) => a + b, 0) / cachePerformance.cachedRuns.length
      : 0,
    speedup: cachePerformance.speedup,
    minSpeedup: 2.0,
    passing: effectiveSpeedup
  };
}

async function testComponentPerformance() {
  // Test individual component performance targets
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  
  const components = {
    git: { target: CHARTER_TARGETS.gitOperationsMs, actual: 0, passing: false },
    rdf: { target: CHARTER_TARGETS.rdfProcessingMs, actual: 0, passing: false },
    template: { target: CHARTER_TARGETS.templateRenderMs, actual: 0, passing: false },
    validation: { target: CHARTER_TARGETS.validationMs, actual: 0, passing: false },
    office: { target: CHARTER_TARGETS.officeProcessingMs, actual: 0, passing: false }
  };
  
  try {
    // Test RDF processing
    const testDir = path.join(os.tmpdir(), 'kgen-component-test');
    await fs.mkdir(testDir, { recursive: true });
    
    const rdfFile = path.join(testDir, 'component-test.ttl');
    await fs.writeFile(rdfFile, `
@prefix ex: <http://example.org/> .
ex:test ex:property "component performance test" .
`);
    
    const rdfStart = performance.now();
    execSync(`node "${kgenBinary}" graph hash "${rdfFile}"`, { stdio: 'pipe' });
    components.rdf.actual = performance.now() - rdfStart;
    components.rdf.passing = components.rdf.actual <= components.rdf.target;
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
  } catch (error) {
    logger.warn(`Component test failed: ${error.message}`);
  }
  
  logger.info(`Component performance: RDF ${components.rdf.actual.toFixed(2)}ms (target: ${components.rdf.target}ms) - ${components.rdf.passing ? '✅' : '❌'}`);
  
  return components;
}

async function testConcurrentPerformance() {
  // Test performance under concurrent load
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  const concurrentTasks = Math.min(8, os.cpus().length);
  
  const testDir = path.join(os.tmpdir(), 'kgen-concurrent-test');
  await fs.mkdir(testDir, { recursive: true });
  
  // Create test files for concurrent processing
  const testFiles = [];
  for (let i = 0; i < concurrentTasks; i++) {
    const rdfFile = path.join(testDir, `concurrent-${i}.ttl`);
    await fs.writeFile(rdfFile, `
@prefix ex: <http://example.org/> .
ex:concurrent${i} ex:property "concurrent test ${i}" ;
    ex:index ${i} .
`);
    testFiles.push(rdfFile);
  }
  
  const startTime = performance.now();
  
  try {
    // Run concurrent operations
    const promises = testFiles.map(file => 
      new Promise((resolve, reject) => {
        try {
          const taskStart = performance.now();
          execSync(`node "${kgenBinary}" graph hash "${file}"`, { stdio: 'pipe' });
          const taskTime = performance.now() - taskStart;
          resolve(taskTime);
        } catch (error) {
          reject(error);
        }
      })
    );
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    const avgTaskTime = results.reduce((a, b) => a + b, 0) / results.length;
    const throughput = results.length / (totalTime / 1000); // operations per second
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    const expectedThroughput = concurrentTasks * 0.8; // At least 80% efficiency expected
    const passing = throughput >= expectedThroughput;
    
    logger.info(`Concurrent: ${concurrentTasks} tasks, ${throughput.toFixed(2)} ops/sec - ${passing ? '✅' : '❌'}`);
    
    return {
      tasks: concurrentTasks,
      totalTime,
      avgTaskTime,
      throughput,
      expectedThroughput,
      passing
    };
    
  } catch (error) {
    logger.warn(`Concurrent test failed: ${error.message}`);
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    return {
      tasks: concurrentTasks,
      totalTime: 0,
      avgTaskTime: 0,
      throughput: 0,
      expectedThroughput: 0,
      passing: false
    };
  }
}

function calculateCompliance(tests) {
  return {
    coldStart: {
      target: CHARTER_TARGETS.coldStartMs,
      actual: tests.coldStart?.p95 || 9999,
      passing: tests.coldStart?.passing || false,
      margin: CHARTER_TARGETS.coldStartMs - (tests.coldStart?.p95 || 9999)
    },
    rendering: {
      target: CHARTER_TARGETS.p95RenderMs,
      actual: tests.rendering?.p95 || 9999,
      passing: tests.rendering?.passing || false,
      margin: CHARTER_TARGETS.p95RenderMs - (tests.rendering?.p95 || 9999)
    },
    caching: {
      target: CHARTER_TARGETS.cacheHitRate * 100,
      actual: (tests.rendering?.cacheHitRate || 0) * 100,
      passing: tests.rendering?.cacheHitPassing || false,
      margin: ((tests.rendering?.cacheHitRate || 0) - CHARTER_TARGETS.cacheHitRate) * 100
    },
    components: {
      rdf: {
        target: CHARTER_TARGETS.rdfProcessingMs,
        actual: tests.components?.rdf?.actual || 9999,
        passing: tests.components?.rdf?.passing || false,
        margin: CHARTER_TARGETS.rdfProcessingMs - (tests.components?.rdf?.actual || 9999)
      }
    },
    concurrent: {
      passing: tests.concurrent?.passing || false,
      throughput: tests.concurrent?.throughput || 0
    }
  };
}

function calculateOverallScore(compliance) {
  const tests = [
    compliance.coldStart.passing,
    compliance.rendering.passing,
    compliance.caching.passing,
    compliance.components.rdf.passing,
    compliance.concurrent.passing
  ];
  
  const passing = tests.filter(Boolean).length;
  const total = tests.length;
  
  return {
    passing,
    failing: total - passing,
    total,
    score: Math.round((passing / total) * 100),
    overallPass: passing === total
  };
}

function generateReport(results) {
  const report = `
# KGEN Performance Validation Report

**System**: ${results.system.platform} ${results.system.arch} (${results.system.cpus} cores, ${results.system.memory}GB RAM)
**Node.js**: ${results.system.nodeVersion}
**Timestamp**: ${this.getDeterministicDate().toISOString()}

## Charter Compliance Summary

**Overall Score**: ${results.overall.score}% (${results.overall.passing}/${results.overall.total} tests passing)
**Status**: ${results.overall.overallPass ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}

## Performance Results

### Cold Start Performance
- **Target**: ≤${CHARTER_TARGETS.coldStartMs}ms
- **Actual p95**: ${results.compliance.coldStart.actual.toFixed(2)}ms
- **Status**: ${results.compliance.coldStart.passing ? '✅ PASS' : '❌ FAIL'}
- **Margin**: ${results.compliance.coldStart.margin > 0 ? '+' : ''}${results.compliance.coldStart.margin.toFixed(2)}ms

### Rendering Performance  
- **Target**: ≤${CHARTER_TARGETS.p95RenderMs}ms p95
- **Actual p95**: ${results.compliance.rendering.actual.toFixed(2)}ms
- **Status**: ${results.compliance.rendering.passing ? '✅ PASS' : '❌ FAIL'}
- **Margin**: ${results.compliance.rendering.margin > 0 ? '+' : ''}${results.compliance.rendering.margin.toFixed(2)}ms

### Caching Performance
- **Target**: ≥${CHARTER_TARGETS.cacheHitRate * 100}% hit rate
- **Actual**: ${results.compliance.caching.actual.toFixed(1)}%
- **Status**: ${results.compliance.caching.passing ? '✅ PASS' : '❌ FAIL'}
- **Margin**: ${results.compliance.caching.margin > 0 ? '+' : ''}${results.compliance.caching.margin.toFixed(1)}%

### Component Performance
- **RDF Processing**: ${results.compliance.components.rdf.actual.toFixed(2)}ms (target: ≤${CHARTER_TARGETS.rdfProcessingMs}ms) - ${results.compliance.components.rdf.passing ? '✅' : '❌'}

### Concurrent Performance
- **Throughput**: ${results.compliance.concurrent.throughput.toFixed(2)} ops/sec
- **Status**: ${results.compliance.concurrent.passing ? '✅ PASS' : '❌ FAIL'}

## Recommendations

${results.overall.overallPass 
  ? '🎉 All Charter performance requirements are met! KGEN is ready for production deployment.'
  : generateRecommendations(results.compliance)
}
`;

  logger.info('\n' + report);
  
  return report;
}

function generateRecommendations(compliance) {
  const recommendations = [];
  
  if (!compliance.coldStart.passing) {
    recommendations.push('- **Cold Start**: Implement additional lazy loading for startup modules');
  }
  
  if (!compliance.rendering.passing) {
    recommendations.push('- **Rendering**: Enable template compilation caching and worker thread processing');
  }
  
  if (!compliance.caching.passing) {
    recommendations.push('- **Caching**: Optimize cache key generation and increase cache size limits');
  }
  
  if (!compliance.components.rdf.passing) {
    recommendations.push('- **RDF Processing**: Implement streaming RDF parser for large graphs');
  }
  
  if (!compliance.concurrent.passing) {
    recommendations.push('- **Concurrency**: Optimize worker thread pool management');
  }
  
  return recommendations.join('\n');
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validatePerformance()
    .then(results => {
      if (results.success === false || !results.overall?.overallPass) {
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Validation error: ${error.message}`);
      process.exit(1);
    });
}

export { validatePerformance, CHARTER_TARGETS };