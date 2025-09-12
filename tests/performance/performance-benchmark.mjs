#!/usr/bin/env node

/**
 * KGEN Performance Benchmarking Suite
 * 
 * Measures actual performance characteristics vs architectural assumptions
 * - Command execution times
 * - File size/complexity scaling
 * - Memory usage patterns
 * - Concurrent operation performance
 * - Cache effectiveness
 * - Large RDF graph processing
 * 
 * Reports real measured data vs claims
 */

import { performance } from 'perf_hooks';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PROJECT_ROOT = path.resolve(process.cwd());
const KGEN_BINARY = path.join(PROJECT_ROOT, 'bin/kgen.mjs');
const TEST_DATA_DIR = path.join(PROJECT_ROOT, 'tests/performance/data');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'tests/performance/results');

class PerformanceBenchmark {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.iterations = options.iterations || 10;
    this.warmupIterations = options.warmupIterations || 3;
    this.results = new Map();
    this.systemInfo = null;
    
    this.testSizes = [
      { name: 'tiny', triples: 10, fileSize: '~1KB' },
      { name: 'small', triples: 100, fileSize: '~10KB' },
      { name: 'medium', triples: 1000, fileSize: '~100KB' },
      { name: 'large', triples: 10000, fileSize: '~1MB' },
      { name: 'huge', triples: 100000, fileSize: '~10MB' }
    ];
  }

  async initialize() {
    await this.collectSystemInfo();
    await this.setupTestData();
    await this.ensureDirectories();
    
    console.log('🚀 KGEN Performance Benchmark Suite');
    console.log('=====================================');
    console.log(`System: ${this.systemInfo.platform} ${this.systemInfo.arch}`);
    console.log(`CPU: ${this.systemInfo.cpus} cores @ ${this.systemInfo.cpuModel}`);
    console.log(`Memory: ${this.systemInfo.totalMemory}GB`);
    console.log(`Node.js: ${this.systemInfo.nodeVersion}`);
    console.log(`Iterations: ${this.iterations} (warmup: ${this.warmupIterations})`);
    console.log('=====================================\n');
  }

  async collectSystemInfo() {
    const cpus = os.cpus();
    this.systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      totalMemory: Math.round(os.totalmem() / (1024 ** 3)),
      freeMemory: Math.round(os.freemem() / (1024 ** 3)),
      nodeVersion: process.version,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async ensureDirectories() {
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(RESULTS_DIR, { recursive: true });
  }

  async setupTestData() {
    console.log('📊 Generating test data...');
    
    for (const size of this.testSizes) {
      const filename = `test-${size.name}.ttl`;
      const filepath = path.join(TEST_DATA_DIR, filename);
      
      // Check if test data already exists with correct size
      try {
        const stats = await fs.stat(filepath);
        const content = await fs.readFile(filepath, 'utf8');
        const actualTriples = (content.match(/\s+\./g) || []).length;
        
        if (Math.abs(actualTriples - size.triples) > size.triples * 0.1) {
          throw new Error('Regenerate test data');
        }
        
        if (this.verbose) {
          console.log(`  ✅ ${filename} exists (${actualTriples} triples, ${Math.round(stats.size/1024)}KB)`);
        }
        continue;
      } catch (error) {
        // Generate new test data
      }
      
      const rdfContent = this.generateRDFData(size.triples, size.name);
      await fs.writeFile(filepath, rdfContent);
      
      const stats = await fs.stat(filepath);
      console.log(`  📝 Generated ${filename} (${size.triples} triples, ${Math.round(stats.size/1024)}KB)`);
    }
  }

  generateRDFData(tripleCount, sizeName) {
    const prefixes = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

`;
    
    const triples = [];
    const baseUri = 'http://example.org/';
    
    for (let i = 0; i < tripleCount; i++) {
      const subject = `ex:entity${i}`;
      const predicates = [
        `rdfs:label "Entity ${i} for ${sizeName} test dataset"`,
        `ex:hasId ${i}`,
        `ex:createdAt "${this.getDeterministicDate().toISOString()}"^^xsd:dateTime`,
        `ex:belongsToDataset ex:${sizeName}Dataset`,
        `rdf:type ex:TestEntity`
      ];
      
      // Add one random predicate per triple to reach target count
      const predicate = predicates[i % predicates.length];
      triples.push(`${subject} ${predicate} .`);
      
      // Add extra complexity for larger datasets
      if (tripleCount > 1000 && i % 10 === 0) {
        triples.push(`ex:collection${Math.floor(i/10)} ex:contains ${subject} .`);
        triples.push(`${subject} ex:relatedTo ex:entity${(i + 1) % tripleCount} .`);
      }
    }
    
    return prefixes + triples.join('\n') + '\n';
  }

  async measureCommandExecution(command, args = [], options = {}) {
    const fullCommand = `node ${KGEN_BINARY} ${command} ${args.join(' ')}`;
    const measurements = [];
    
    // Warmup runs
    for (let i = 0; i < this.warmupIterations; i++) {
      try {
        execSync(fullCommand, { 
          stdio: this.verbose ? 'inherit' : 'pipe',
          timeout: 30000,
          ...options 
        });
      } catch (error) {
        console.warn(`Warmup ${i + 1} failed for "${fullCommand}": ${error.message}`);
      }
    }
    
    // Actual measurements
    for (let i = 0; i < this.iterations; i++) {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      
      try {
        const result = execSync(fullCommand, {
          stdio: 'pipe',
          timeout: 60000,
          encoding: 'utf8',
          ...options
        });
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const executionTime = endTime - startTime;
        
        measurements.push({
          iteration: i + 1,
          executionTime,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external
          },
          success: true,
          outputSize: result.length
        });
        
        if (this.verbose) {
          console.log(`  Run ${i + 1}: ${executionTime.toFixed(2)}ms`);
        }
        
      } catch (error) {
        measurements.push({
          iteration: i + 1,
          executionTime: null,
          error: error.message,
          success: false
        });
        
        console.warn(`  Run ${i + 1}: FAILED - ${error.message}`);
      }
    }
    
    return this.analyzeTimingMeasurements(measurements);
  }

  analyzeTimingMeasurements(measurements) {
    const successful = measurements.filter(m => m.success);
    const failed = measurements.filter(m => !m.success);
    
    if (successful.length === 0) {
      return {
        success: false,
        error: 'All iterations failed',
        failureRate: 1.0,
        failedMeasurements: failed
      };
    }
    
    const times = successful.map(m => m.executionTime);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const sortedTimes = [...times].sort((a, b) => a - b);
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;
    
    // Memory analysis
    const memoryDeltas = successful.map(m => m.memoryDelta);
    const avgMemoryDelta = {
      rss: memoryDeltas.reduce((sum, m) => sum + m.rss, 0) / memoryDeltas.length,
      heapUsed: memoryDeltas.reduce((sum, m) => sum + m.heapUsed, 0) / memoryDeltas.length,
      external: memoryDeltas.reduce((sum, m) => sum + m.external, 0) / memoryDeltas.length
    };
    
    return {
      success: true,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      failureRate: failed.length / measurements.length,
      timing: {
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        p95: parseFloat(p95.toFixed(2)),
        p99: parseFloat(p99.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        coefficientOfVariation: parseFloat(coefficientOfVariation.toFixed(3))
      },
      memory: {
        avgRssDelta: Math.round(avgMemoryDelta.rss / 1024), // KB
        avgHeapDelta: Math.round(avgMemoryDelta.heapUsed / 1024), // KB
        avgExternalDelta: Math.round(avgMemoryDelta.external / 1024) // KB
      },
      rawMeasurements: measurements
    };
  }

  async benchmarkBasicCommands() {
    console.log('⏱️ Benchmarking basic commands...');
    
    const commands = [
      { name: 'version', command: '--version', args: [] },
      { name: 'help', command: '--help', args: [] },
      { name: 'validate-small', command: 'validate', args: ['graph', path.join(TEST_DATA_DIR, 'test-small.ttl')] },
      { name: 'graph-hash-small', command: 'graph', args: ['hash', path.join(TEST_DATA_DIR, 'test-small.ttl')] },
      { name: 'templates-list', command: 'templates', args: ['list'] }
    ];
    
    const results = new Map();
    
    for (const { name, command, args } of commands) {
      console.log(`  📋 Testing: ${name}`);
      try {
        const result = await this.measureCommandExecution(command, args);
        results.set(name, result);
        
        if (result.success) {
          console.log(`    ✅ Mean: ${result.timing.mean}ms, P95: ${result.timing.p95}ms`);
        } else {
          console.log(`    ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        results.set(name, { success: false, error: error.message });
      }
    }
    
    this.results.set('basicCommands', results);
    return results;
  }

  async benchmarkFileSizeScaling() {
    console.log('📈 Benchmarking file size scaling...');
    
    const scalingResults = new Map();
    
    for (const size of this.testSizes) {
      console.log(`  📊 Testing ${size.name} dataset (${size.triples} triples, ${size.fileSize})`);
      const filepath = path.join(TEST_DATA_DIR, `test-${size.name}.ttl`);
      
      try {
        // Test multiple operations on each dataset
        const operations = [
          { name: 'validate', command: 'validate', args: ['graph', filepath] },
          { name: 'graph-hash', command: 'graph', args: ['hash', filepath] },
          { name: 'graph-index', command: 'graph', args: ['index', filepath] }
        ];
        
        const sizeResults = new Map();
        
        for (const { name, command, args } of operations) {
          console.log(`    🔧 ${name}`);
          const result = await this.measureCommandExecution(command, args);
          sizeResults.set(name, result);
          
          if (result.success) {
            console.log(`      ⏱️ Mean: ${result.timing.mean}ms, Memory: ${result.memory.avgRssDelta}KB`);
          } else {
            console.log(`      ❌ Failed: ${result.error}`);
          }
        }
        
        scalingResults.set(size.name, {
          metadata: size,
          results: sizeResults
        });
        
      } catch (error) {
        console.log(`    ❌ Error with ${size.name}: ${error.message}`);
        scalingResults.set(size.name, { 
          metadata: size, 
          error: error.message, 
          success: false 
        });
      }
    }
    
    this.results.set('fileSizeScaling', scalingResults);
    return scalingResults;
  }

  async benchmarkConcurrentOperations() {
    console.log('🔄 Benchmarking concurrent operations...');
    
    const testFile = path.join(TEST_DATA_DIR, 'test-medium.ttl');
    const concurrencyLevels = [1, 2, 4, 8];
    const concurrentResults = new Map();
    
    for (const concurrency of concurrencyLevels) {
      console.log(`  👥 Testing concurrency level: ${concurrency}`);
      
      try {
        const promises = [];
        const startTime = performance.now();
        
        for (let i = 0; i < concurrency; i++) {
          const promise = new Promise((resolve, reject) => {
            const child = spawn('node', [KGEN_BINARY, 'validate', 'graph', testFile], {
              stdio: 'pipe'
            });
            
            const start = performance.now();
            let output = '';
            let error = '';
            
            child.stdout.on('data', (data) => { output += data; });
            child.stderr.on('data', (data) => { error += data; });
            
            child.on('close', (code) => {
              const end = performance.now();
              resolve({
                processId: i,
                executionTime: end - start,
                exitCode: code,
                success: code === 0,
                output: output.length,
                error: error.length
              });
            });
            
            child.on('error', (err) => {
              reject(err);
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
              child.kill();
              reject(new Error('Process timeout'));
            }, 30000);
          });
          
          promises.push(promise);
        }
        
        const results = await Promise.allSettled(promises);
        const totalTime = performance.now() - startTime;
        
        const successful = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value);
        
        const failed = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason);
        
        if (successful.length > 0) {
          const avgExecutionTime = successful.reduce((sum, r) => sum + r.executionTime, 0) / successful.length;
          const throughput = successful.length / (totalTime / 1000); // operations per second
          
          concurrentResults.set(concurrency, {
            concurrencyLevel: concurrency,
            totalTime: parseFloat(totalTime.toFixed(2)),
            avgExecutionTime: parseFloat(avgExecutionTime.toFixed(2)),
            throughput: parseFloat(throughput.toFixed(2)),
            successfulOperations: successful.length,
            failedOperations: failed.length,
            successRate: successful.length / (successful.length + failed.length)
          });
          
          console.log(`    ⚡ Throughput: ${throughput.toFixed(2)} ops/sec, Avg time: ${avgExecutionTime.toFixed(2)}ms`);
        } else {
          console.log(`    ❌ All ${concurrency} operations failed`);
          concurrentResults.set(concurrency, {
            concurrencyLevel: concurrency,
            success: false,
            error: 'All operations failed'
          });
        }
        
      } catch (error) {
        console.log(`    ❌ Error at concurrency ${concurrency}: ${error.message}`);
        concurrentResults.set(concurrency, {
          concurrencyLevel: concurrency,
          success: false,
          error: error.message
        });
      }
    }
    
    this.results.set('concurrentOperations', concurrentResults);
    return concurrentResults;
  }

  async benchmarkLargeGraphProcessing() {
    console.log('🐘 Benchmarking large graph processing...');
    
    // Test with existing large files from fixtures
    const largeFiles = [
      { name: 'performance-large-10k', path: 'tests/fixtures/turtle/performance/large-10000.ttl' },
      { name: 'massive-enterprise', path: 'tests/fixtures/performance/massive-enterprise-graph.ttl' },
      { name: 'large-api-ontology', path: 'tests/fixtures/performance/large-api-ontology.ttl' }
    ];
    
    const largeGraphResults = new Map();
    
    for (const file of largeFiles) {
      const filepath = path.join(PROJECT_ROOT, file.path);
      
      try {
        const stats = await fs.stat(filepath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        console.log(`  🗂️ Testing ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        
        const operations = [
          { name: 'validate', command: 'validate', args: ['graph'], timeout: 120000 },
          { name: 'graph-hash', command: 'graph', args: ['hash'], timeout: 60000 },
          { name: 'graph-index', command: 'graph', args: ['index'], timeout: 180000 }
        ];
        
        const fileResults = new Map();
        
        for (const { name, command, args, timeout } of operations) {
          console.log(`    🔧 ${name} (timeout: ${timeout/1000}s)`);
          
          try {
            const result = await this.measureCommandExecution(command, [...args, filepath], { timeout });
            fileResults.set(name, result);
            
            if (result.success) {
              console.log(`      ⏱️ Mean: ${result.timing.mean}ms, P95: ${result.timing.p95}ms`);
              console.log(`      💾 Memory: RSS +${result.memory.avgRssDelta}KB, Heap +${result.memory.avgHeapDelta}KB`);
            } else {
              console.log(`      ❌ Failed: ${result.error}`);
            }
          } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
            fileResults.set(name, { success: false, error: error.message });
          }
        }
        
        largeGraphResults.set(file.name, {
          filepath: file.path,
          fileSizeMB: parseFloat(fileSizeMB.toFixed(2)),
          results: fileResults
        });
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`    ⚠️ File not found: ${file.path}`);
        } else {
          console.log(`    ❌ Error accessing ${file.name}: ${error.message}`);
        }
        largeGraphResults.set(file.name, {
          filepath: file.path,
          error: error.message,
          success: false
        });
      }
    }
    
    this.results.set('largeGraphProcessing', largeGraphResults);
    return largeGraphResults;
  }

  async benchmarkCacheEffectiveness() {
    console.log('🗄️ Benchmarking cache effectiveness...');
    
    const testFile = path.join(TEST_DATA_DIR, 'test-medium.ttl');
    const cacheResults = new Map();
    
    try {
      // First run (cold cache)
      console.log('  ❄️ Cold cache run');
      const coldRun = await this.measureCommandExecution('validate', ['graph', testFile]);
      cacheResults.set('cold', coldRun);
      
      if (coldRun.success) {
        console.log(`    ⏱️ Cold: ${coldRun.timing.mean}ms`);
      }
      
      // Warm cache runs
      console.log('  🔥 Warm cache runs');
      const warmRuns = [];
      
      for (let i = 0; i < 5; i++) {
        const warmRun = await this.measureCommandExecution('validate', ['graph', testFile]);
        warmRuns.push(warmRun);
        
        if (warmRun.success) {
          console.log(`    ⏱️ Warm ${i + 1}: ${warmRun.timing.mean}ms`);
        }
      }
      
      // Analyze cache effectiveness
      const successfulWarmRuns = warmRuns.filter(r => r.success);
      
      if (successfulWarmRuns.length > 0 && coldRun.success) {
        const avgWarmTime = successfulWarmRuns.reduce((sum, r) => sum + r.timing.mean, 0) / successfulWarmRuns.length;
        const cacheSpeedupRatio = coldRun.timing.mean / avgWarmTime;
        const cacheHitImprovement = ((coldRun.timing.mean - avgWarmTime) / coldRun.timing.mean) * 100;
        
        cacheResults.set('effectiveness', {
          coldCacheMean: coldRun.timing.mean,
          warmCacheMean: parseFloat(avgWarmTime.toFixed(2)),
          speedupRatio: parseFloat(cacheSpeedupRatio.toFixed(2)),
          improvementPercent: parseFloat(cacheHitImprovement.toFixed(1)),
          cacheEffective: cacheSpeedupRatio > 1.1 // At least 10% improvement
        });
        
        console.log(`  📊 Cache speedup: ${cacheSpeedupRatio.toFixed(2)}x (${cacheHitImprovement.toFixed(1)}% improvement)`);
      }
      
      cacheResults.set('warmRuns', successfulWarmRuns);
      
    } catch (error) {
      console.log(`  ❌ Cache benchmark error: ${error.message}`);
      cacheResults.set('error', error.message);
    }
    
    this.results.set('cacheEffectiveness', cacheResults);
    return cacheResults;
  }

  generatePerformanceReport() {
    const report = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        system: this.systemInfo,
        testConfiguration: {
          iterations: this.iterations,
          warmupIterations: this.warmupIterations,
          kgenBinary: KGEN_BINARY
        }
      },
      results: Object.fromEntries(this.results),
      summary: this.generateSummary()
    };
    
    return report;
  }

  generateSummary() {
    const summary = {
      overallStatus: 'UNKNOWN',
      keyFindings: [],
      performanceIssues: [],
      recommendations: []
    };
    
    // Analyze basic commands
    const basicCommands = this.results.get('basicCommands');
    if (basicCommands) {
      const versionResult = basicCommands.get('version');
      if (versionResult && versionResult.success) {
        summary.keyFindings.push(`Version command: ${versionResult.timing.mean}ms (target: <50ms)`);
        if (versionResult.timing.mean > 50) {
          summary.performanceIssues.push('Version command slower than expected');
        }
      }
    }
    
    // Analyze file size scaling
    const scalingResults = this.results.get('fileSizeScaling');
    if (scalingResults) {
      const scalingAnalysis = this.analyzeScalingBehavior(scalingResults);
      summary.keyFindings.push(`File scaling: ${scalingAnalysis.complexity} complexity`);
      
      if (scalingAnalysis.hasPerformanceCliff) {
        summary.performanceIssues.push('Performance cliff detected in file size scaling');
      }
    }
    
    // Analyze concurrency
    const concurrentResults = this.results.get('concurrentOperations');
    if (concurrentResults) {
      const maxThroughput = Math.max(...Array.from(concurrentResults.values())
        .filter(r => r.throughput)
        .map(r => r.throughput));
      
      summary.keyFindings.push(`Max throughput: ${maxThroughput.toFixed(2)} ops/sec`);
    }
    
    // Analyze cache effectiveness
    const cacheResults = this.results.get('cacheEffectiveness');
    if (cacheResults) {
      const effectiveness = cacheResults.get('effectiveness');
      if (effectiveness) {
        summary.keyFindings.push(`Cache speedup: ${effectiveness.speedupRatio}x`);
        if (!effectiveness.cacheEffective) {
          summary.performanceIssues.push('Cache not providing significant performance benefits');
        }
      }
    }
    
    // Overall status determination
    if (summary.performanceIssues.length === 0) {
      summary.overallStatus = 'GOOD';
    } else if (summary.performanceIssues.length <= 2) {
      summary.overallStatus = 'ACCEPTABLE';
    } else {
      summary.overallStatus = 'NEEDS_IMPROVEMENT';
    }
    
    return summary;
  }

  analyzeScalingBehavior(scalingResults) {
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge'];
    const validateTimes = [];
    
    for (const size of sizes) {
      const sizeResult = scalingResults.get(size);
      if (sizeResult && sizeResult.results) {
        const validateResult = sizeResult.results.get('validate');
        if (validateResult && validateResult.success) {
          validateTimes.push({
            size: size,
            triples: sizeResult.metadata.triples,
            time: validateResult.timing.mean
          });
        }
      }
    }
    
    if (validateTimes.length < 3) {
      return { complexity: 'INSUFFICIENT_DATA', hasPerformanceCliff: false };
    }
    
    // Simple analysis: check if timing grows faster than linear
    const ratios = [];
    for (let i = 1; i < validateTimes.length; i++) {
      const prev = validateTimes[i - 1];
      const curr = validateTimes[i];
      
      const timeRatio = curr.time / prev.time;
      const sizeRatio = curr.triples / prev.triples;
      const scalingRatio = timeRatio / sizeRatio;
      
      ratios.push(scalingRatio);
    }
    
    const avgScalingRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    const hasPerformanceCliff = ratios.some(r => r > 5); // 5x worse than linear
    
    let complexity;
    if (avgScalingRatio < 1.2) {
      complexity = 'SUB_LINEAR';
    } else if (avgScalingRatio < 2) {
      complexity = 'LINEAR';
    } else if (avgScalingRatio < 5) {
      complexity = 'SUPER_LINEAR';
    } else {
      complexity = 'EXPONENTIAL';
    }
    
    return { complexity, hasPerformanceCliff, avgScalingRatio };
  }

  async saveReport(report) {
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(RESULTS_DIR, `performance-report-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Performance report saved: ${reportPath}`);
    
    // Also save a latest report
    const latestPath = path.join(RESULTS_DIR, 'performance-report-latest.json');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }

  async runAllBenchmarks() {
    console.log('🚀 Running comprehensive performance benchmarks...\n');
    
    await this.initialize();
    
    try {
      await this.benchmarkBasicCommands();
      await this.benchmarkFileSizeScaling();
      await this.benchmarkConcurrentOperations();
      await this.benchmarkLargeGraphProcessing();
      await this.benchmarkCacheEffectiveness();
      
      const report = this.generatePerformanceReport();
      const reportPath = await this.saveReport(report);
      
      // Print summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
      console.log('='.repeat(50));
      console.log(`Overall Status: ${report.summary.overallStatus}`);
      console.log('\n🔍 Key Findings:');
      report.summary.keyFindings.forEach(finding => console.log(`  • ${finding}`));
      
      if (report.summary.performanceIssues.length > 0) {
        console.log('\n⚠️ Performance Issues:');
        report.summary.performanceIssues.forEach(issue => console.log(`  • ${issue}`));
      }
      
      console.log(`\n📄 Full report: ${reportPath}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark({ 
    verbose: process.argv.includes('--verbose'),
    iterations: parseInt(process.argv.find(arg => arg.startsWith('--iterations='))?.split('=')[1]) || 10
  });
  
  benchmark.runAllBenchmarks()
    .then(report => {
      console.log('\n✅ Performance benchmark completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Performance benchmark failed:', error);
      process.exit(1);
    });
}

export { PerformanceBenchmark };