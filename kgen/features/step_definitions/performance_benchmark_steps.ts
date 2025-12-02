/**
 * Performance Benchmark Step Definitions for KGEN E2E Testing
 * 
 * Comprehensive performance testing and benchmarking against KPIs:
 * - Template render time targets (150ms p95)
 * - Memory usage constraints
 * - Cache performance metrics
 * - Throughput and concurrency testing
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { Worker } from 'worker_threads';
import crypto from 'crypto';

interface BenchmarkContext {
  // Performance tracking
  benchmarkResults: Map<string, {
    operation: string;
    iterations: number;
    durations: number[];
    averageTime: number;
    p50Time: number;
    p95Time: number;
    p99Time: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
    timestamp: number;
    metadata: any;
  }>;
  
  // Memory tracking
  memorySnapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  }>;
  
  // Throughput testing
  throughputResults: Map<string, {
    operation: string;
    duration: number;
    totalOperations: number;
    operationsPerSecond: number;
    bytesProcessed: number;
    bytesPerSecond: number;
  }>;
  
  // Concurrency testing
  concurrencyResults: Map<string, {
    operation: string;
    workers: number;
    totalTime: number;
    averageWorkerTime: number;
    successfulOperations: number;
    failedOperations: number;
    errorsPerWorker: Map<number, string[]>;
  }>;
  
  // Cache performance
  cacheMetrics: {
    hits: number;
    misses: number;
    hitRate: number;
    averageRetrievalTime: number;
    cacheSize: number;
    evictions: number;
  };
  
  // Test workspace
  benchmarkWorkspace: string;
  tempFiles: Set<string>;
  
  // Performance observers
  performanceObserver: PerformanceObserver | null;
  memoryMonitorInterval: NodeJS.Timeout | null;
  
  // Load testing state
  loadTestActive: boolean;
  loadTestResults: Array<{
    timestamp: number;
    responseTime: number;
    success: boolean;
    memoryUsage: number;
  }>;
}

// Global benchmark context
let benchmarkContext: BenchmarkContext = {
  benchmarkResults: new Map(),
  memorySnapshots: [],
  throughputResults: new Map(),
  concurrencyResults: new Map(),
  cacheMetrics: {
    hits: 0,
    misses: 0,
    hitRate: 0,
    averageRetrievalTime: 0,
    cacheSize: 0,
    evictions: 0
  },
  benchmarkWorkspace: '',
  tempFiles: new Set(),
  performanceObserver: null,
  memoryMonitorInterval: null,
  loadTestActive: false,
  loadTestResults: []
};

// =============================================================================
// BENCHMARK SETUP AND UTILITIES
// =============================================================================

Before(async function() {
  // Setup benchmark workspace
  benchmarkContext.benchmarkWorkspace = path.join(__dirname, '../../../test-workspace', 
    `benchmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  await fs.mkdir(benchmarkContext.benchmarkWorkspace, { recursive: true });
  
  // Clear previous results
  benchmarkContext.benchmarkResults.clear();
  benchmarkContext.memorySnapshots = [];
  benchmarkContext.throughputResults.clear();
  benchmarkContext.concurrencyResults.clear();
  benchmarkContext.tempFiles.clear();
  benchmarkContext.loadTestResults = [];
  benchmarkContext.loadTestActive = false;
  
  // Reset cache metrics
  benchmarkContext.cacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    averageRetrievalTime: 0,
    cacheSize: 0,
    evictions: 0
  };
  
  // Setup performance monitoring
  benchmarkContext.performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    for (const entry of entries) {
      if (entry.name.startsWith('kgen-benchmark-')) {
        console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
      }
    }
  });
  benchmarkContext.performanceObserver.observe({ entryTypes: ['measure'] });
  
  // Start memory monitoring
  benchmarkContext.memoryMonitorInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    benchmarkContext.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });
    
    // Keep only last 1000 snapshots
    if (benchmarkContext.memorySnapshots.length > 1000) {
      benchmarkContext.memorySnapshots.shift();
    }
  }, 100); // Sample every 100ms
});

After(async function() {
  // Stop monitoring
  if (benchmarkContext.performanceObserver) {
    benchmarkContext.performanceObserver.disconnect();
  }
  
  if (benchmarkContext.memoryMonitorInterval) {
    clearInterval(benchmarkContext.memoryMonitorInterval);
  }
  
  benchmarkContext.loadTestActive = false;
  
  // Cleanup temp files
  for (const filePath of benchmarkContext.tempFiles) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might already be deleted
    }
  }
  
  // Cleanup workspace
  try {
    await fs.rm(benchmarkContext.benchmarkWorkspace, { recursive: true, force: true });
  } catch (error) {
    console.warn('Could not clean up benchmark workspace:', error.message);
  }
  
  // Force garbage collection for clean memory baseline
  if (global.gc) global.gc();
});

// Utility functions
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
  return sorted[Math.max(0, index)];
}

async function createTestFile(size: number, name?: string): Promise<string> {
  const fileName = name || `test-file-${size}-${Date.now()}.txt`;
  const filePath = path.join(benchmarkContext.benchmarkWorkspace, fileName);
  
  // Generate test content of specified size
  const chunkSize = 1024;
  const content = 'A'.repeat(Math.min(size, chunkSize));
  let totalWritten = 0;
  
  const fileHandle = await fs.open(filePath, 'w');
  try {
    while (totalWritten < size) {
      const writeSize = Math.min(chunkSize, size - totalWritten);
      await fileHandle.write(content.substring(0, writeSize));
      totalWritten += writeSize;
    }
  } finally {
    await fileHandle.close();
  }
  
  benchmarkContext.tempFiles.add(filePath);
  return filePath;
}

// =============================================================================
// PERFORMANCE BENCHMARK STEPS
// =============================================================================

Given('I have a performance test environment ready', async function() {
  // Verify benchmark workspace is ready
  expect(benchmarkContext.benchmarkWorkspace).to.not.be.empty;
  
  // Verify monitoring is active
  expect(benchmarkContext.performanceObserver).to.not.be.null;
  expect(benchmarkContext.memoryMonitorInterval).to.not.be.null;
  
  // Create baseline memory snapshot
  const memUsage = process.memoryUsage();
  benchmarkContext.memorySnapshots = [{
    timestamp: Date.now(),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
    rss: memUsage.rss
  }];
  
  console.log(`Benchmark environment ready. Baseline memory: ${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
});

Given('I have {int} test templates of varying complexity', async function(templateCount: number) {
  const templatesDir = path.join(benchmarkContext.benchmarkWorkspace, '_templates');
  await fs.mkdir(templatesDir, { recursive: true });
  
  const complexityLevels = ['simple', 'medium', 'complex', 'extreme'];
  
  for (let i = 1; i <= templateCount; i++) {
    const complexity = complexityLevels[(i - 1) % complexityLevels.length];
    const templateDir = path.join(templatesDir, `template-${i}-${complexity}`);
    await fs.mkdir(templateDir, { recursive: true });
    
    let templateContent = '';
    
    switch (complexity) {
      case 'simple':
        templateContent = `---
to: output/simple-{{ name }}-${i}.txt
---
Simple template ${i}: {{ name }}`;
        break;
        
      case 'medium':
        templateContent = `---
to: output/medium-{{ name }}-${i}.html
---
<!DOCTYPE html>
<html>
<head><title>{{ name }} - ${i}</title></head>
<body>
  <h1>{{ name.toUpperCase() }}</h1>
  {% for item in items %}
    <p>Item {{ loop.index }}: {{ item.name }} - {{ item.description }}</p>
  {% endfor %}
  <footer>Generated at {{ timestamp }} (${i})</footer>
</body>
</html>`;
        break;
        
      case 'complex':
        templateContent = `---
to: output/complex-{{ name }}-${i}.js
---
// Complex template ${i} with nested loops and conditionals
class {{ name.capitalize() }}Generator${i} {
  constructor(options = {}) {
    this.options = options;
    this.data = {{ JSON.stringify(data, null, 2) }};
  }
  
  generate() {
    const results = [];
    {% for category in categories %}
    // Category: {{ category.name }}
    {% if category.enabled %}
    {% for item in category.items %}
    {% if item.active %}
    results.push({
      category: '{{ category.name }}',
      item: '{{ item.name }}',
      value: {{ item.value | default(0) }},
      computed: this.compute('{{ item.type }}', {{ item.value | default(0) }}),
      metadata: {
        generated: '{{ timestamp }}',
        template: '${i}',
        index: {{ loop.index }}
      }
    });
    {% endif %}
    {% endfor %}
    {% endif %}
    {% endfor %}
    return results;
  }
  
  compute(type, value) {
    switch (type) {
      {% for computation in computations %}
      case '{{ computation.type }}':
        return value * {{ computation.multiplier }} + {{ computation.offset }};
      {% endfor %}
      default:
        return value;
    }
  }
}

module.exports = {{ name.capitalize() }}Generator${i};`;
        break;
        
      case 'extreme':
        // Generate deeply nested template with many iterations
        let extremeContent = `---
to: output/extreme-{{ name }}-${i}.json
---
{
  "generator": "extreme-${i}",
  "name": "{{ name }}",
  "timestamp": "{{ timestamp }}",
  "data": {`;
        
        // Create 5 levels of nested loops
        for (let level = 1; level <= 5; level++) {
          extremeContent += `
    "level${level}": {
      {% for l${level} in range(${level * 2}) %}
      "item_{{ l${level} }}": {
        "index": {{ l${level} }},
        "name": "{{ name }}_level${level}_{{ l${level} }}",`;
        }
        
        extremeContent += `
        "value": "final_value"`;
        
        // Close all nested structures
        for (let level = 5; level >= 1; level--) {
          extremeContent += `
      }{{ "," if not loop.last }}
      {% endfor %}
    }`;
        }
        
        extremeContent += `
  }
}`;
        templateContent = extremeContent;
        break;
    }
    
    await fs.writeFile(path.join(templateDir, 'index.njk'), templateContent, 'utf-8');
  }
});

// =============================================================================
// RENDERING PERFORMANCE TESTS
// =============================================================================

When('I benchmark template rendering {int} times', async function(iterations: number) {
  const operation = 'template_rendering';
  const durations: number[] = [];
  
  // Import the template engine dynamically
  const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
  
  const engine = new KgenTemplateEngine({
    templateDirs: [path.join(benchmarkContext.benchmarkWorkspace, '_templates')],
    outputDir: path.join(benchmarkContext.benchmarkWorkspace, 'output'),
    deterministic: true,
    enableCache: false // Disable cache for pure rendering benchmark
  });
  
  await engine.initialize();
  
  // Prepare template variables
  const templateVars = {
    name: 'BenchmarkTest',
    timestamp: new Date().toISOString(),
    items: Array.from({ length: 10 }, (_, i) => ({
      name: `Item${i}`,
      description: `Description for item ${i}`,
      value: Math.random() * 100,
      active: i % 2 === 0,
      type: ['string', 'number', 'boolean'][i % 3]
    })),
    categories: Array.from({ length: 5 }, (_, i) => ({
      name: `Category${i}`,
      enabled: i % 3 !== 0,
      items: Array.from({ length: 8 }, (_, j) => ({
        name: `CategoryItem${i}_${j}`,
        value: Math.random() * 50,
        active: j % 2 === 0,
        type: ['alpha', 'beta', 'gamma'][j % 3]
      }))
    })),
    computations: Array.from({ length: 10 }, (_, i) => ({
      type: ['alpha', 'beta', 'gamma'][i % 3],
      multiplier: Math.random() * 2,
      offset: Math.random() * 10
    })),
    data: {
      version: '1.0.0',
      config: { debug: true, verbose: false },
      features: ['feature1', 'feature2', 'feature3']
    }
  };
  
  const generators = await engine.discoverGenerators();
  expect(generators.generators.length).to.be.greaterThan(0, 'No templates found for benchmarking');
  
  console.log(`Starting benchmark: ${iterations} iterations across ${generators.generators.length} templates`);
  
  const benchmarkStart = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();
    
    try {
      // Randomly select a template to render
      const template = generators.generators[i % generators.generators.length];
      
      performance.mark(`kgen-benchmark-render-start-${i}`);
      await engine.generateFromTemplate(template.name, templateVars);
      performance.mark(`kgen-benchmark-render-end-${i}`);
      
      performance.measure(`kgen-benchmark-render-${i}`, 
        `kgen-benchmark-render-start-${i}`, 
        `kgen-benchmark-render-end-${i}`);
      
      const iterationEnd = performance.now();
      durations.push(iterationEnd - iterationStart);
      
    } catch (error) {
      console.warn(`Benchmark iteration ${i} failed:`, error.message);
      durations.push(NaN);
    }
  }
  
  const benchmarkEnd = performance.now();
  const validDurations = durations.filter(d => !isNaN(d));
  
  if (validDurations.length === 0) {
    throw new Error('All benchmark iterations failed');
  }
  
  // Calculate statistics
  const averageTime = validDurations.reduce((a, b) => a + b) / validDurations.length;
  const p50Time = calculatePercentile(validDurations, 50);
  const p95Time = calculatePercentile(validDurations, 95);
  const p99Time = calculatePercentile(validDurations, 99);
  const minTime = Math.min(...validDurations);
  const maxTime = Math.max(...validDurations);
  const totalTime = benchmarkEnd - benchmarkStart;
  
  benchmarkContext.benchmarkResults.set(operation, {
    operation,
    iterations,
    durations: validDurations,
    averageTime,
    p50Time,
    p95Time,
    p99Time,
    minTime,
    maxTime,
    totalTime,
    timestamp: Date.now(),
    metadata: {
      templatesUsed: generators.generators.length,
      successfulIterations: validDurations.length,
      failedIterations: iterations - validDurations.length,
      throughput: validDurations.length / (totalTime / 1000) // operations per second
    }
  });
  
  console.log(`Benchmark completed: ${validDurations.length}/${iterations} successful iterations`);
  console.log(`Average: ${averageTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms, P99: ${p99Time.toFixed(2)}ms`);
});

When('I run concurrent rendering with {int} workers', async function(workerCount: number) {
  const operation = 'concurrent_rendering';
  
  // Create worker script
  const workerScript = `
const { parentPort, workerData } = require('worker_threads');
const path = require('path');

async function runWorker() {
  try {
    const { KgenTemplateEngine } = await import('${path.resolve(__dirname, '../../../packages/kgen-templates/src/template-engine.js')}');
    
    const engine = new KgenTemplateEngine({
      templateDirs: [workerData.templatesDir],
      outputDir: path.join(workerData.outputDir, 'worker-' + workerData.workerId),
      deterministic: true,
      enableCache: false
    });
    
    await engine.initialize();
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < workerData.iterations; i++) {
      const start = performance.now();
      try {
        await engine.generateFromTemplate(workerData.templateName, {
          ...workerData.templateVars,
          workerId: workerData.workerId,
          iteration: i
        });
        const end = performance.now();
        results.push(end - start);
      } catch (error) {
        errors.push(error.message);
      }
    }
    
    parentPort.postMessage({
      workerId: workerData.workerId,
      results,
      errors,
      totalTime: results.reduce((a, b) => a + b, 0)
    });
    
  } catch (error) {
    parentPort.postMessage({
      workerId: workerData.workerId,
      results: [],
      errors: [error.message],
      totalTime: 0
    });
  }
}

runWorker();`;
  
  const workerScriptPath = path.join(benchmarkContext.benchmarkWorkspace, 'benchmark-worker.js');
  await fs.writeFile(workerScriptPath, workerScript, 'utf-8');
  benchmarkContext.tempFiles.add(workerScriptPath);
  
  // Setup worker data
  const iterationsPerWorker = 50;
  const templateVars = {
    name: 'ConcurrencyTest',
    timestamp: new Date().toISOString(),
    items: Array.from({ length: 20 }, (_, i) => ({ name: `Item${i}`, value: i }))
  };
  
  const workers: Promise<any>[] = [];
  const concurrencyStart = performance.now();
  
  // Launch workers
  for (let workerId = 0; workerId < workerCount; workerId++) {
    const workerPromise = new Promise((resolve, reject) => {
      const worker = new Worker(workerScriptPath, {
        workerData: {
          workerId,
          iterations: iterationsPerWorker,
          templatesDir: path.join(benchmarkContext.benchmarkWorkspace, '_templates'),
          outputDir: path.join(benchmarkContext.benchmarkWorkspace, 'output'),
          templateName: 'template-1-simple',
          templateVars
        }
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
    });
    
    workers.push(workerPromise);
  }
  
  // Wait for all workers to complete
  const workerResults = await Promise.allSettled(workers);
  const concurrencyEnd = performance.now();
  
  // Aggregate results
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalWorkerTime = 0;
  const errorsPerWorker = new Map<number, string[]>();
  
  for (const result of workerResults) {
    if (result.status === 'fulfilled') {
      const workerData = result.value;
      totalSuccessful += workerData.results.length;
      totalFailed += workerData.errors.length;
      totalWorkerTime += workerData.totalTime;
      errorsPerWorker.set(workerData.workerId, workerData.errors);
    } else {
      totalFailed += iterationsPerWorker;
      errorsPerWorker.set(-1, [result.reason.message]);
    }
  }
  
  benchmarkContext.concurrencyResults.set(operation, {
    operation,
    workers: workerCount,
    totalTime: concurrencyEnd - concurrencyStart,
    averageWorkerTime: totalWorkerTime / workerCount,
    successfulOperations: totalSuccessful,
    failedOperations: totalFailed,
    errorsPerWorker
  });
  
  console.log(`Concurrency test completed: ${workerCount} workers, ${totalSuccessful} successful operations`);
});

// =============================================================================
// THROUGHPUT AND LOAD TESTING
// =============================================================================

When('I run throughput test for {int} seconds', async function(durationSeconds: number) {
  const operation = 'throughput_test';
  benchmarkContext.loadTestActive = true;
  benchmarkContext.loadTestResults = [];
  
  // Import required modules
  const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
  const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
  
  const templateEngine = new KgenTemplateEngine({
    templateDirs: [path.join(benchmarkContext.benchmarkWorkspace, '_templates')],
    outputDir: path.join(benchmarkContext.benchmarkWorkspace, 'throughput-output'),
    deterministic: true,
    enableCache: true
  });
  
  const casEngine = new CASEngine({
    storageType: 'memory',
    cacheSize: 10000,
    enableMetrics: true
  });
  
  await Promise.all([
    templateEngine.initialize(),
    casEngine.initialize()
  ]);
  
  const templateVars = {
    name: 'ThroughputTest',
    timestamp: new Date().toISOString()
  };
  
  let operationCount = 0;
  let bytesProcessed = 0;
  const startTime = performance.now();
  const endTime = startTime + (durationSeconds * 1000);
  
  console.log(`Starting throughput test for ${durationSeconds} seconds...`);
  
  while (performance.now() < endTime && benchmarkContext.loadTestActive) {
    const operationStart = performance.now();
    const memBefore = process.memoryUsage().heapUsed;
    
    try {
      // Perform template rendering
      const result = await templateEngine.render('{{ name }}-{{ timestamp }}-{{ index }}', {
        ...templateVars,
        index: operationCount
      });
      
      // Store result in CAS
      const hash = await casEngine.store(result);
      
      const operationEnd = performance.now();
      const responseTime = operationEnd - operationStart;
      const memAfter = process.memoryUsage().heapUsed;
      
      bytesProcessed += result.length;
      operationCount++;
      
      benchmarkContext.loadTestResults.push({
        timestamp: operationEnd,
        responseTime,
        success: true,
        memoryUsage: memAfter
      });
      
      // Update cache metrics
      const cacheMetrics = await casEngine.getMetrics();
      benchmarkContext.cacheMetrics = {
        hits: cacheMetrics.hits || 0,
        misses: cacheMetrics.misses || 0,
        hitRate: cacheMetrics.hitRate || 0,
        averageRetrievalTime: cacheMetrics.averageRetrievalTime || 0,
        cacheSize: cacheMetrics.cacheSize || 0,
        evictions: cacheMetrics.evictions || 0
      };
      
    } catch (error) {
      const operationEnd = performance.now();
      const responseTime = operationEnd - operationStart;
      
      benchmarkContext.loadTestResults.push({
        timestamp: operationEnd,
        responseTime,
        success: false,
        memoryUsage: process.memoryUsage().heapUsed
      });
    }
    
    // Small delay to prevent overwhelming the system
    if (operationCount % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  
  const totalTime = performance.now() - startTime;
  const operationsPerSecond = operationCount / (totalTime / 1000);
  const bytesPerSecond = bytesProcessed / (totalTime / 1000);
  
  benchmarkContext.throughputResults.set(operation, {
    operation,
    duration: totalTime,
    totalOperations: operationCount,
    operationsPerSecond,
    bytesProcessed,
    bytesPerSecond
  });
  
  benchmarkContext.loadTestActive = false;
  
  console.log(`Throughput test completed: ${operationCount} operations in ${(totalTime/1000).toFixed(2)}s`);
  console.log(`Throughput: ${operationsPerSecond.toFixed(2)} ops/sec, ${(bytesPerSecond/1024).toFixed(2)} KB/sec`);
});

// =============================================================================
// MEMORY AND RESOURCE TESTING
// =============================================================================

When('I run memory stress test with {int}MB data', async function(dataSizeMB: number) {
  const operation = 'memory_stress';
  const dataSizeBytes = dataSizeMB * 1024 * 1024;
  
  // Create large test file
  const largeFilePath = await createTestFile(dataSizeBytes, 'large-test-file.txt');
  
  const memoryStart = process.memoryUsage();
  const testStart = performance.now();
  
  try {
    // Read large file
    const largeContent = await fs.readFile(largeFilePath, 'utf-8');
    
    // Process through template system
    const { KgenTemplateEngine } = await import('../../../packages/kgen-templates/src/template-engine.js');
    const engine = new KgenTemplateEngine({
      templateDirs: [path.join(benchmarkContext.benchmarkWorkspace, '_templates')],
      outputDir: path.join(benchmarkContext.benchmarkWorkspace, 'memory-output'),
      deterministic: true
    });
    
    await engine.initialize();
    
    // Render template with large data
    const result = await engine.render('Large content size: {{ content.length }}', {
      content: largeContent
    });
    
    // Store in CAS
    const { CASEngine } = await import('../../../packages/kgen-core/src/cas/index.js');
    const casEngine = new CASEngine({ storageType: 'memory' });
    await casEngine.initialize();
    await casEngine.store(largeContent);
    
    const testEnd = performance.now();
    const memoryEnd = process.memoryUsage();
    
    benchmarkContext.benchmarkResults.set(operation, {
      operation,
      iterations: 1,
      durations: [testEnd - testStart],
      averageTime: testEnd - testStart,
      p50Time: testEnd - testStart,
      p95Time: testEnd - testStart,
      p99Time: testEnd - testStart,
      minTime: testEnd - testStart,
      maxTime: testEnd - testStart,
      totalTime: testEnd - testStart,
      timestamp: Date.now(),
      metadata: {
        dataSizeMB,
        memoryStartMB: memoryStart.heapUsed / (1024 * 1024),
        memoryEndMB: memoryEnd.heapUsed / (1024 * 1024),
        memoryIncreaseMB: (memoryEnd.heapUsed - memoryStart.heapUsed) / (1024 * 1024),
        success: true
      }
    });
    
  } catch (error) {
    const testEnd = performance.now();
    const memoryEnd = process.memoryUsage();
    
    benchmarkContext.benchmarkResults.set(operation, {
      operation,
      iterations: 1,
      durations: [testEnd - testStart],
      averageTime: testEnd - testStart,
      p50Time: testEnd - testStart,
      p95Time: testEnd - testStart,
      p99Time: testEnd - testStart,
      minTime: testEnd - testStart,
      maxTime: testEnd - testStart,
      totalTime: testEnd - testStart,
      timestamp: Date.now(),
      metadata: {
        dataSizeMB,
        memoryStartMB: memoryStart.heapUsed / (1024 * 1024),
        memoryEndMB: memoryEnd.heapUsed / (1024 * 1024),
        memoryIncreaseMB: (memoryEnd.heapUsed - memoryStart.heapUsed) / (1024 * 1024),
        success: false,
        error: error.message
      }
    });
    
    throw error;
  }
});

// =============================================================================
// PERFORMANCE ASSERTIONS AND VALIDATION
// =============================================================================

Then('template rendering should meet p95 target of {int}ms', function(targetP95: number) {
  const renderingResult = benchmarkContext.benchmarkResults.get('template_rendering');
  expect(renderingResult).to.not.be.undefined, 'Template rendering benchmark not found');
  
  expect(renderingResult.p95Time).to.be.lessThan(targetP95,
    `P95 rendering time ${renderingResult.p95Time.toFixed(2)}ms exceeds target ${targetP95}ms`);
  
  console.log(`✓ P95 rendering time: ${renderingResult.p95Time.toFixed(2)}ms (target: ${targetP95}ms)`);
});

Then('average rendering time should be under {int}ms', function(targetAverage: number) {
  const renderingResult = benchmarkContext.benchmarkResults.get('template_rendering');
  expect(renderingResult).to.not.be.undefined, 'Template rendering benchmark not found');
  
  expect(renderingResult.averageTime).to.be.lessThan(targetAverage,
    `Average rendering time ${renderingResult.averageTime.toFixed(2)}ms exceeds target ${targetAverage}ms`);
});

Then('concurrent rendering should scale efficiently with {float} efficiency', function(targetEfficiency: number) {
  const concurrencyResult = benchmarkContext.concurrencyResults.get('concurrent_rendering');
  expect(concurrencyResult).to.not.be.undefined, 'Concurrent rendering benchmark not found');
  
  // Calculate efficiency: (successful operations / total possible operations)
  const totalPossibleOps = concurrencyResult.workers * 50; // 50 iterations per worker
  const efficiency = concurrencyResult.successfulOperations / totalPossibleOps;
  
  expect(efficiency).to.be.greaterThan(targetEfficiency,
    `Concurrency efficiency ${efficiency.toFixed(3)} below target ${targetEfficiency}`);
  
  console.log(`✓ Concurrency efficiency: ${(efficiency * 100).toFixed(1)}% (target: ${(targetEfficiency * 100).toFixed(1)}%)`);
});

Then('throughput should exceed {int} operations per second', function(targetThroughput: number) {
  const throughputResult = benchmarkContext.throughputResults.get('throughput_test');
  expect(throughputResult).to.not.be.undefined, 'Throughput test not found');
  
  expect(throughputResult.operationsPerSecond).to.be.greaterThan(targetThroughput,
    `Throughput ${throughputResult.operationsPerSecond.toFixed(2)} ops/sec below target ${targetThroughput} ops/sec`);
  
  console.log(`✓ Throughput: ${throughputResult.operationsPerSecond.toFixed(2)} ops/sec (target: ${targetThroughput} ops/sec)`);
});

Then('cache hit rate should be above {float}', function(targetHitRate: number) {
  expect(benchmarkContext.cacheMetrics.hitRate).to.be.greaterThan(targetHitRate,
    `Cache hit rate ${benchmarkContext.cacheMetrics.hitRate.toFixed(3)} below target ${targetHitRate}`);
  
  console.log(`✓ Cache hit rate: ${(benchmarkContext.cacheMetrics.hitRate * 100).toFixed(1)}% (target: ${(targetHitRate * 100).toFixed(1)}%)`);
});

Then('memory usage should remain stable during load test', function() {
  if (benchmarkContext.loadTestResults.length === 0) {
    throw new Error('No load test results available');
  }
  
  const memoryUsages = benchmarkContext.loadTestResults.map(r => r.memoryUsage);
  const startMemory = memoryUsages[0];
  const endMemory = memoryUsages[memoryUsages.length - 1];
  const maxMemory = Math.max(...memoryUsages);
  
  // Memory should not grow more than 50% from start to end
  const memoryGrowthPercent = ((endMemory - startMemory) / startMemory) * 100;
  expect(memoryGrowthPercent).to.be.lessThan(50,
    `Memory grew ${memoryGrowthPercent.toFixed(1)}% during load test`);
  
  // Peak memory should not exceed 2x start memory
  const peakGrowthPercent = ((maxMemory - startMemory) / startMemory) * 100;
  expect(peakGrowthPercent).to.be.lessThan(100,
    `Peak memory exceeded 2x baseline (${peakGrowthPercent.toFixed(1)}% growth)`);
  
  console.log(`✓ Memory stable: ${memoryGrowthPercent.toFixed(1)}% growth, peak ${peakGrowthPercent.toFixed(1)}%`);
});

Then('memory stress test should complete within {int}MB increase', function(maxIncreaseM: number) {
  const stressResult = benchmarkContext.benchmarkResults.get('memory_stress');
  expect(stressResult).to.not.be.undefined, 'Memory stress test not found');
  
  const memoryIncrease = stressResult.metadata.memoryIncreaseMB;
  expect(memoryIncrease).to.be.lessThan(maxIncreaseM,
    `Memory increased ${memoryIncrease.toFixed(2)}MB, expected under ${maxIncreaseM}MB`);
  
  console.log(`✓ Memory stress test: ${memoryIncrease.toFixed(2)}MB increase (limit: ${maxIncreaseM}MB)`);
});

// Export context for external access
export { benchmarkContext };