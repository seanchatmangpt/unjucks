/**
 * Simplified CAS Validation Test
 * 
 * Core validation of Content-Addressed Storage implementation
 * without complex dependencies
 */

import { cas } from '../src/kgen/cas/cas-core.js';
import { canonicalProcessor } from '../src/kgen/rdf/canonical-processor-cas.js';

async function runSimpleValidation() {
  console.log('🧪 Running Simple CAS Validation\n');
  
  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Basic CID Generation
  try {
    console.log('📝 Test 1: CID Generation...');
    const testData = 'Hello, KGEN CAS!';
    const cid = await cas.generateCID(testData);
    
    if (!cid || typeof cid.toString !== 'function') {
      throw new Error('CID generation failed');
    }
    
    // Test deterministic behavior
    const cid2 = await cas.generateCID(testData);
    if (cid.toString() !== cid2.toString()) {
      throw new Error('CID generation not deterministic');
    }
    
    console.log(`  ✅ CID Generated: ${cid.toString()}`);
    passedTests++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Test 2: Multiple Hash Algorithms
  try {
    console.log('\n🔢 Test 2: Multiple Hash Algorithms...');
    const testData = 'Test data for algorithms';
    const algorithms = ['sha256', 'sha512'];
    
    for (const algorithm of algorithms) {
      const hash = await cas.calculateHash(testData, algorithm);
      if (!hash || hash.length === 0) {
        throw new Error(`${algorithm} failed`);
      }
      console.log(`  📊 ${algorithm}: ${hash.substring(0, 16)}...`);
    }
    
    console.log('  ✅ All algorithms working');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Test 3: Performance - Hash Time
  try {
    console.log('\n⚡ Test 3: Hash Performance (≤5ms p95)...');
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
    
    const sorted = times.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(iterations * 0.95)];
    const average = times.reduce((a, b) => a + b, 0) / times.length;
    
    console.log(`  📈 Average: ${average.toFixed(3)}ms`);
    console.log(`  📊 P95: ${p95.toFixed(3)}ms`);
    
    if (p95 <= 5) {
      console.log('  ✅ Performance target met (≤5ms p95)');
      passedTests++;
    } else {
      console.log('  ❌ Performance target missed (>5ms p95)');
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Test 4: Cache Hit Rate
  try {
    console.log('\n💾 Test 4: Cache Performance (≥80% hit rate)...');
    const baseData = 'Cache test';
    const iterations = 200;
    
    // Create access pattern with high locality (80% hot data)
    for (let i = 0; i < iterations; i++) {
      const variant = Math.random() < 0.8 
        ? Math.floor(Math.random() * 20)  // 80% access to 20% of data
        : Math.floor(Math.random() * 100); // 20% access to 80% of data
      
      await cas.generateCID(baseData + variant);
    }
    
    const metrics = cas.getMetrics();
    const hitRate = metrics.cache.hitRate;
    
    console.log(`  📊 Cache size: ${metrics.cache.size}`);
    console.log(`  📈 Hit rate: ${(hitRate * 100).toFixed(1)}%`);
    
    if (hitRate >= 0.8) {
      console.log('  ✅ Cache performance target met (≥80%)');
      passedTests++;
    } else {
      console.log('  ❌ Cache performance target missed (<80%)');
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Test 5: RDF Canonical Processing
  try {
    console.log('\n🔗 Test 5: RDF Canonical Processing...');
    const testRDF = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:alice a foaf:Person ;
        foaf:name "Alice Smith" ;
        foaf:age 30 .
    `;
    
    const result = await canonicalProcessor.calculateContentHash(testRDF);
    
    if (!result.cid || !result.hash || !result.canonical) {
      throw new Error('Incomplete RDF processing');
    }
    
    if (result.quadCount === 0) {
      throw new Error('No RDF quads processed');
    }
    
    console.log(`  📊 Processed ${result.quadCount} quads`);
    console.log(`  🆔 CID: ${result.cid.substring(0, 40)}...`);
    console.log('  ✅ RDF canonical processing working');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Test 6: Drift Detection
  try {
    console.log('\n🔍 Test 6: Drift Detection...');
    const originalContent = 'Original content';
    const modifiedContent = 'Modified content';
    
    const comparison = await cas.compareContent(originalContent, modifiedContent);
    
    if (comparison.identical) {
      throw new Error('Failed to detect drift');
    }
    
    if (!comparison.drift) {
      throw new Error('Drift flag not set');
    }
    
    console.log(`  🆔 CID1: ${comparison.cid1.toString().substring(0, 20)}...`);
    console.log(`  🆔 CID2: ${comparison.cid2.toString().substring(0, 20)}...`);
    console.log('  ✅ Drift detection working');
    passedTests++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failedTests++;
  }

  // Results Summary
  console.log('\n📊 Validation Results');
  console.log('=====================');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  const casMetrics = cas.getMetrics();
  console.log('\n📈 Final CAS Metrics:');
  console.log(`💾 Cache Hit Rate: ${(casMetrics.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`⚡ Hash Time P95: ${casMetrics.performance.hashTimeP95?.toFixed(3)}ms`);
  console.log(`🎯 Targets Met: Hash=${casMetrics.performance.meetsTargets?.hashTime ? '✅' : '❌'}, Cache=${casMetrics.performance.meetsTargets?.hitRate ? '✅' : '❌'}`);
  
  const success = failedTests === 0;
  console.log(`\n${success ? '🎉 All tests passed!' : '💥 Some tests failed!'}`);
  
  return success;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = await runSimpleValidation();
  process.exit(success ? 0 : 1);
}