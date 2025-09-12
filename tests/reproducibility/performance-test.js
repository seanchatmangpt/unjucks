#!/usr/bin/env node

/**
 * KGEN Reproducibility Performance Impact Test
 * 
 * Measures the performance impact of determinism measures
 * Validates that reproducibility overhead stays within the 10% threshold
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';

class ReproducibilityPerformanceTest {
  constructor() {
    this.results = {
      baseline: { avgTime: 0, operations: 0 },
      deterministic: { avgTime: 0, operations: 0 },
      performanceImpact: 0,
      withinThreshold: false,
      threshold: 10.0 // 10% max impact
    };
  }

  async runPerformanceTest() {
    console.log('🔬 KGEN Reproducibility Performance Impact Test');
    console.log('===============================================\n');

    try {
      // Create test environment
      const testDir = './tests/reproducibility/reports/perf-test';
      await fs.mkdir(testDir, { recursive: true });

      // Create test data
      const testGraph = join(testDir, 'perf-test.ttl');
      const testRDF = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:PerfTest rdfs:label "Performance Test Dataset" .
${Array.from({ length: 100 }, (_, i) => 
  `ex:entity${i} a ex:TestEntity ;\n  ex:value ${i} ;\n  ex:description "Test entity ${i}" .`
).join('\n')}`;

      await fs.writeFile(testGraph, testRDF);

      console.log('📊 Running baseline performance measurements...');
      const baselineTimes = await this.measureBaselinePerformance(testGraph, 20);
      
      console.log('🎯 Running deterministic performance measurements...');
      const deterministicTimes = await this.measureDeterministicPerformance(testGraph, 20);

      // Calculate results
      this.results.baseline.avgTime = baselineTimes.reduce((a, b) => a + b) / baselineTimes.length;
      this.results.baseline.operations = baselineTimes.length;
      
      this.results.deterministic.avgTime = deterministicTimes.reduce((a, b) => a + b) / deterministicTimes.length;
      this.results.deterministic.operations = deterministicTimes.length;
      
      this.results.performanceImpact = ((this.results.deterministic.avgTime - this.results.baseline.avgTime) / this.results.baseline.avgTime) * 100;
      this.results.withinThreshold = Math.abs(this.results.performanceImpact) <= this.results.threshold;

      // Output results
      this.outputResults();

      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true });

      process.exit(this.results.withinThreshold ? 0 : 1);

    } catch (error) {
      console.error(`❌ Performance test failed: ${error.message}`);
      process.exit(1);
    }
  }

  async measureBaselinePerformance(testGraph, iterations) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.executeKGenCommand(['graph', 'hash', testGraph], {
        // Normal environment
      });
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
      if (i % 5 === 0) {
        process.stdout.write(`\r   Progress: ${i}/${iterations}`);
      }
    }
    
    console.log(`\r   ✅ Baseline: ${iterations} iterations completed`);
    return times;
  }

  async measureDeterministicPerformance(testGraph, iterations) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.executeKGenCommand(['graph', 'hash', testGraph], {
        // Deterministic environment with isolation
        env: {
          ...process.env,
          TZ: 'UTC',
          LANG: 'en-US.UTF-8',
          LC_ALL: 'en-US.UTF-8',
          SOURCE_DATE_EPOCH: '1704067200',
          KGEN_BUILD_TIME: '2024-01-01T00:00:00.000Z'
        }
      });
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
      if (i % 5 === 0) {
        process.stdout.write(`\r   Progress: ${i}/${iterations}`);
      }
    }
    
    console.log(`\r   ✅ Deterministic: ${iterations} iterations completed`);
    return times;
  }

  async executeKGenCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['./bin/kgen.mjs', ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  outputResults() {
    console.log('\n===============================================');
    console.log('📊 PERFORMANCE IMPACT RESULTS');
    console.log('===============================================\n');

    console.log(`Baseline Performance:`);
    console.log(`   Average Time: ${this.results.baseline.avgTime.toFixed(2)}ms`);
    console.log(`   Operations: ${this.results.baseline.operations}`);

    console.log(`\nDeterministic Performance:`);
    console.log(`   Average Time: ${this.results.deterministic.avgTime.toFixed(2)}ms`);
    console.log(`   Operations: ${this.results.deterministic.operations}`);

    console.log(`\nPerformance Impact:`);
    console.log(`   Impact: ${this.results.performanceImpact >= 0 ? '+' : ''}${this.results.performanceImpact.toFixed(2)}%`);
    console.log(`   Threshold: ±${this.results.threshold}%`);
    console.log(`   Status: ${this.results.withinThreshold ? '✅ WITHIN THRESHOLD' : '❌ EXCEEDS THRESHOLD'}`);

    if (this.results.performanceImpact > 0) {
      console.log(`\n   Deterministic mode adds ${this.results.performanceImpact.toFixed(2)}% overhead`);
    } else {
      console.log(`\n   Deterministic mode improves performance by ${Math.abs(this.results.performanceImpact).toFixed(2)}%`);
    }

    console.log('\n===============================================');
    if (this.results.withinThreshold) {
      console.log('🎉 PERFORMANCE IMPACT ACCEPTABLE');
      console.log('Determinism measures meet performance requirements');
    } else {
      console.log('⚠️  PERFORMANCE IMPACT EXCEEDS THRESHOLD');
      console.log('Consider optimizing determinism implementation');
    }
    console.log('===============================================\n');
  }
}

// Run performance test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ReproducibilityPerformanceTest();
  test.runPerformanceTest();
}

export default ReproducibilityPerformanceTest;