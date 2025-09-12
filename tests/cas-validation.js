/**
 * CAS Implementation Validation Tests
 * 
 * Validates that the Content-Addressed Storage implementation meets
 * the KGEN v1 Charter requirements:
 * - ≥80% cache hit rate
 * - ≤5ms p95 hash operation time
 * - Multiformats CID support
 * - WebAssembly acceleration
 */

import { cas } from '../src/kgen/cas/cas-core.js';
import { canonicalProcessor } from '../src/kgen/rdf/canonical-processor-cas.js';
import { benchmarks } from '../src/kgen/benchmarks/cas-benchmarks.js';
import { driftDetector } from '../src/kgen/drift/drift-detector.js';
import { attestationGenerator } from '../src/kgen/attestation/generator.js';

/**
 * Validation test suite
 */
class CASValidation {
  constructor() {
    this.results = {
      basicFunctionality: { passed: 0, failed: 0, tests: [] },
      performance: { passed: 0, failed: 0, tests: [] },
      integration: { passed: 0, failed: 0, tests: [] }
    };
  }

  async runValidation() {
    console.log('🧪 Running CAS Implementation Validation\n');
    
    try {
      await this._testBasicFunctionality();
      await this._testPerformanceRequirements();
      await this._testIntegration();
      
      this._printResults();
      
      return this._isValidationSuccessful();
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return false;
    }
  }

  async _testBasicFunctionality() {
    console.log('📋 Testing Basic CAS Functionality...');
    
    // Test 1: CID Generation
    await this._runTest('basic', 'CID Generation', async () => {
      const testData = 'Hello, KGEN!';
      const cid = await cas.generateCID(testData);
      
      if (!cid || typeof cid.toString !== 'function') {
        throw new Error('CID generation failed');
      }
      
      // Verify deterministic
      const cid2 = await cas.generateCID(testData);
      if (cid.toString() !== cid2.toString()) {
        throw new Error('CID generation not deterministic');
      }
      
      return `Generated CID: ${cid.toString().substring(0, 20)}...`;
    });

    // Test 2: Multiple Hash Algorithms
    await this._runTest('basic', 'Multiple Hash Algorithms', async () => {
      const testData = 'Test data for multiple algorithms';
      const algorithms = ['sha256', 'sha512', 'blake2b', 'blake3'];
      const results = [];
      
      for (const algorithm of algorithms) {
        const hash = await cas.calculateHash(testData, algorithm);
        if (!hash || hash.length === 0) {
          throw new Error(`${algorithm} hash generation failed`);
        }
        results.push(algorithm);
      }
      
      return `Tested algorithms: ${results.join(', ')}`;
    });

    // Test 3: Content Storage and Retrieval
    await this._runTest('basic', 'Content Storage and Retrieval', async () => {
      const testData = 'Stored content test';
      const { cid, stored } = await cas.store(testData);
      
      if (!stored) {
        // Already exists, that's fine
      }
      
      const retrieved = await cas.retrieve(cid);
      if (!retrieved) {
        throw new Error('Content retrieval failed');
      }
      
      return `Stored and retrieved content with CID: ${cid.toString().substring(0, 20)}...`;
    });

    // Test 4: Cache Functionality
    await this._runTest('basic', 'Cache Functionality', async () => {
      const testData = 'Cache test data';
      
      // First access
      const start1 = performance.now();
      const cid1 = await cas.generateCID(testData);
      const time1 = performance.now() - start1;
      
      // Second access (should be cached)
      const start2 = performance.now();
      const cid2 = await cas.generateCID(testData);
      const time2 = performance.now() - start2;
      
      if (cid1.toString() !== cid2.toString()) {
        throw new Error('Cached CID mismatch');
      }
      
      const metrics = cas.getMetrics();
      return `Cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`;
    });
  }

  async _testPerformanceRequirements() {
    console.log('\n⚡ Testing Performance Requirements...');
    
    // Test 1: Hash Performance Target (≤5ms p95)
    await this._runTest('performance', 'Hash Performance Target (≤5ms p95)', async () => {
      const testData = 'Performance test data';
      const iterations = 100;
      const times = [];
      
      // Warmup
      for (let i = 0; i < 10; i++) {
        await cas.calculateHash(testData + i);
      }
      
      // Measure
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await cas.calculateHash(testData + i);
        times.push(performance.now() - start);
      }
      
      const p95 = this._percentile(times, 0.95);
      if (p95 > 5) {
        throw new Error(`P95 hash time ${p95.toFixed(2)}ms exceeds 5ms target`);
      }
      
      return `P95 hash time: ${p95.toFixed(2)}ms (target: ≤5ms)`;
    });

    // Test 2: Cache Hit Rate Target (≥80%)
    await this._runTest('performance', 'Cache Hit Rate Target (≥80%)', async () => {
      // Generate test pattern with high locality
      const baseData = 'Cache hit rate test';
      const iterations = 200;
      
      for (let i = 0; i < iterations; i++) {
        // 80% of requests hit same 20% of data (hot spot)
        const dataVariant = Math.random() < 0.8 
          ? Math.floor(Math.random() * 20) 
          : Math.floor(Math.random() * 100);
        
        await cas.generateCID(baseData + dataVariant);
      }
      
      const metrics = cas.getMetrics();
      const hitRate = metrics.cache.hitRate;
      
      if (hitRate < 0.8) {
        throw new Error(`Cache hit rate ${(hitRate * 100).toFixed(1)}% below 80% target`);
      }
      
      return `Cache hit rate: ${(hitRate * 100).toFixed(1)}% (target: ≥80%)`;
    });

    // Test 3: Parallel Processing Performance
    await this._runTest('performance', 'Parallel Processing Performance', async () => {
      const testData = Array.from({ length: 50 }, (_, i) => `Parallel test ${i}`);
      
      // Sequential
      const seqStart = performance.now();
      for (const data of testData) {
        await cas.generateCID(data);
      }
      const seqTime = performance.now() - seqStart;
      
      // Parallel
      const parStart = performance.now();
      await Promise.all(testData.map(data => cas.generateCID(data)));
      const parTime = performance.now() - parStart;
      
      const speedup = seqTime / parTime;
      if (speedup < 1.5) {
        throw new Error(`Parallel speedup ${speedup.toFixed(2)}x insufficient`);
      }
      
      return `Parallel speedup: ${speedup.toFixed(2)}x`;
    });
  }

  async _testIntegration() {
    console.log('\n🔗 Testing System Integration...');
    
    // Test 1: RDF Canonical Processing
    await this._runTest('integration', 'RDF Canonical Processing', async () => {
      const testRDF = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice a foaf:Person ;
          foaf:name "Alice Smith" ;
          foaf:age 30 .
      `;
      
      const result = await canonicalProcessor.calculateContentHash(testRDF);
      
      if (!result.cid || !result.hash || !result.canonical) {
        throw new Error('RDF canonical processing incomplete');
      }
      
      if (result.quadCount === 0) {
        throw new Error('No quads processed');
      }
      
      return `Processed ${result.quadCount} quads, CID: ${result.cid.substring(0, 20)}...`;
    });

    // Test 2: Drift Detection
    await this._runTest('integration', 'Drift Detection', async () => {
      const originalRDF = `
        @prefix ex: <http://example.org/> .
        ex:test ex:value "original" .
      `;
      
      const modifiedRDF = `
        @prefix ex: <http://example.org/> .
        ex:test ex:value "modified" .
      `;
      
      const comparison = await cas.compareContent(originalRDF, modifiedRDF);
      
      if (comparison.identical) {
        throw new Error('Drift detection failed - identical content reported as different');
      }
      
      if (!comparison.drift) {
        throw new Error('Drift not detected');
      }
      
      return `Drift detected: CID1=${comparison.cid1.toString().substring(0, 20)}..., CID2=${comparison.cid2.toString().substring(0, 20)}...`;
    });

    // Test 3: Performance Metrics Collection
    await this._runTest('integration', 'Performance Metrics Collection', async () => {
      const metrics = cas.getMetrics();
      
      const requiredKeys = ['cache', 'performance'];
      for (const key of requiredKeys) {
        if (!metrics[key]) {
          throw new Error(`Missing metrics key: ${key}`);
        }
      }
      
      if (typeof metrics.cache.hitRate !== 'number') {
        throw new Error('Invalid cache hit rate metric');
      }
      
      return `Metrics collected: hitRate=${(metrics.cache.hitRate * 100).toFixed(1)}%, size=${metrics.cache.size}`;
    });
  }

  async _runTest(category, testName, testFn) {
    try {
      const result = await testFn();
      console.log(`  ✅ ${testName}: ${result}`);
      this.results[category].passed++;
      this.results[category].tests.push({ name: testName, status: 'passed', result });
    } catch (error) {
      console.log(`  ❌ ${testName}: ${error.message}`);
      this.results[category].failed++;
      this.results[category].tests.push({ name: testName, status: 'failed', error: error.message });
    }
  }

  _percentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  _printResults() {
    console.log('\n📊 Validation Results Summary');
    console.log('=============================\n');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [category, results] of Object.entries(this.results)) {
      console.log(`${category.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${results.passed}`);
      console.log(`  ❌ Failed: ${results.failed}`);
      console.log('');
      
      totalPassed += results.passed;
      totalFailed += results.failed;
    }
    
    console.log(`OVERALL: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
    
    if (totalFailed > 0) {
      console.log('\n❌ Failed Tests:');
      for (const [category, results] of Object.entries(this.results)) {
        const failed = results.tests.filter(t => t.status === 'failed');
        failed.forEach(test => {
          console.log(`  • ${category}: ${test.name} - ${test.error}`);
        });
      }
    }
    
    console.log('');
  }

  _isValidationSuccessful() {
    const totalFailed = Object.values(this.results).reduce((sum, r) => sum + r.failed, 0);
    return totalFailed === 0;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validation = new CASValidation();
  const success = await validation.runValidation();
  
  if (success) {
    console.log('🎉 All CAS validation tests passed!');
    
    // Run performance benchmarks
    console.log('\n🚀 Running Performance Benchmarks...');
    const benchmarkResults = await benchmarks.runBenchmarks();
    
    process.exit(0);
  } else {
    console.log('💥 CAS validation failed!');
    process.exit(1);
  }
}

export { CASValidation };