/**
 * Final CAS Implementation Test
 * 
 * Tests the simplified CAS implementation to validate KGEN v1 Charter requirements
 */

import { cas } from '../src/kgen/cas/cas-core-simple.js';

async function runFinalTest() {
  console.log('🧪 Final CAS Implementation Test\n');
  console.log('Testing Charter Requirements:');
  console.log('- Content-addresses everything (CAS) using multiformats');
  console.log('- ≥80% cache hit rate');
  console.log('- ≤5ms p95 hash operation time');
  console.log('- Support multiple hash algorithms\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Basic CID Generation
  total++;
  try {
    console.log('📝 Test 1: Multiformats CID Generation');
    const testData = 'Hello, KGEN Charter!';
    const cid = await cas.generateCID(testData);
    
    console.log(`  🆔 Generated CID: ${cid.toString()}`);
    console.log(`  📊 CID Version: ${cid.version}, Codec: ${cid.code}`);
    
    // Test deterministic
    const cid2 = await cas.generateCID(testData);
    if (cid.equals(cid2)) {
      console.log('  ✅ Deterministic generation confirmed');
      passed++;
    } else {
      console.log('  ❌ Non-deterministic generation');
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 2: Multiple Hash Algorithms
  total++;
  try {
    console.log('\n🔢 Test 2: Multiple Hash Algorithm Support');
    const testData = 'Algorithm test';
    const algorithms = ['sha256', 'sha512', 'md5'];
    
    for (const alg of algorithms) {
      const hash = await cas.calculateHash(testData, alg);
      console.log(`  🔐 ${alg.toUpperCase()}: ${hash.substring(0, 16)}...`);
    }
    
    console.log('  ✅ Multiple algorithms supported');
    passed++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 3: Performance - Hash Time ≤5ms P95
  total++;
  try {
    console.log('\n⚡ Test 3: Hash Performance (Charter: ≤5ms P95)');
    const baseData = 'Performance benchmark';
    const iterations = 200;
    const times = [];
    
    // Warmup
    for (let i = 0; i < 20; i++) {
      await cas.generateCID(baseData + i);
    }
    
    // Benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await cas.generateCID(baseData + Math.random());
      times.push(performance.now() - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(iterations * 0.95)];
    
    console.log(`  📊 Average time: ${avg.toFixed(3)}ms`);
    console.log(`  📈 P95 time: ${p95.toFixed(3)}ms`);
    console.log(`  🎯 Charter target: ≤5ms`);
    
    if (p95 <= 5) {
      console.log('  ✅ Performance target MET');
      passed++;
    } else {
      console.log('  ❌ Performance target MISSED');
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 4: Cache Hit Rate ≥80%
  total++;
  try {
    console.log('\n💾 Test 4: Cache Performance (Charter: ≥80% hit rate)');
    const baseData = 'Cache efficiency test';
    const iterations = 300;
    
    // Generate access pattern with 80% locality
    for (let i = 0; i < iterations; i++) {
      // 80% of accesses hit 20% of data (Pareto principle)
      const hotData = Math.random() < 0.8;
      const dataVariant = hotData 
        ? Math.floor(Math.random() * 20)    // Hot 20%
        : Math.floor(Math.random() * 100);  // Cold 80%
      
      await cas.generateCID(baseData + dataVariant);
    }
    
    const metrics = cas.getMetrics();
    const hitRate = metrics.cache.hitRate * 100;
    
    console.log(`  📊 Cache size: ${metrics.cache.size}/${metrics.cache.maxSize}`);
    console.log(`  📈 Hit rate: ${hitRate.toFixed(1)}%`);
    console.log(`  🎯 Charter target: ≥80%`);
    
    if (metrics.cache.hitRate >= 0.8) {
      console.log('  ✅ Cache performance target MET');
      passed++;
    } else {
      console.log('  ❌ Cache performance target MISSED');
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 5: Content-Addressed Storage
  total++;
  try {
    console.log('\n🗄️  Test 5: Content-Addressed Storage');
    const content1 = 'First content';
    const content2 = 'Second content';
    const content3 = 'First content'; // Same as content1
    
    const { cid: cid1 } = await cas.store(content1);
    const { cid: cid2 } = await cas.store(content2);
    const { cid: cid3 } = await cas.store(content3);
    
    console.log(`  🆔 Content1 CID: ${cid1.toString().substring(0, 30)}...`);
    console.log(`  🆔 Content2 CID: ${cid2.toString().substring(0, 30)}...`);
    console.log(`  🆔 Content3 CID: ${cid3.toString().substring(0, 30)}...`);
    
    // Test retrieval
    const retrieved1 = await cas.retrieve(cid1);
    const retrieved2 = await cas.retrieve(cid2);
    
    if (retrieved1 && retrieved2 && cid1.equals(cid3) && !cid1.equals(cid2)) {
      console.log('  ✅ Content-addressed storage working correctly');
      passed++;
    } else {
      console.log('  ❌ Content-addressed storage issues detected');
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Test 6: Drift Detection
  total++;
  try {
    console.log('\n🔍 Test 6: Drift Detection via CID Comparison');
    const original = 'Original content for drift detection';
    const modified = 'Modified content for drift detection';
    const identical = 'Original content for drift detection';
    
    const noDrift = await cas.compareContent(original, identical);
    const withDrift = await cas.compareContent(original, modified);
    
    console.log(`  📊 No drift detected: ${!noDrift.drift}`);
    console.log(`  📊 Drift detected: ${withDrift.drift}`);
    
    if (!noDrift.drift && withDrift.drift && noDrift.identical && !withDrift.identical) {
      console.log('  ✅ Drift detection functioning correctly');
      passed++;
    } else {
      console.log('  ❌ Drift detection issues');
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
  }

  // Final Results
  console.log('\n' + '='.repeat(50));
  console.log('📊 KGEN v1 Charter Compliance Results');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${passed}/${total}`);
  console.log(`📈 Success Rate: ${((passed/total)*100).toFixed(1)}%`);
  
  const finalMetrics = cas.getMetrics();
  console.log('\n📈 Final Performance Metrics:');
  console.log(`💾 Cache Hit Rate: ${(finalMetrics.cache.hitRate*100).toFixed(1)}% ${finalMetrics.performance.meetsTargets.hitRate ? '✅' : '❌'}`);
  console.log(`⚡ Hash Time P95: ${finalMetrics.performance.hashTimeP95.toFixed(3)}ms ${finalMetrics.performance.meetsTargets.hashTime ? '✅' : '❌'}`);
  console.log(`🗄️  Cache Size: ${finalMetrics.cache.size}/${finalMetrics.cache.maxSize}`);
  
  const charterCompliant = passed === total && 
    finalMetrics.performance.meetsTargets.hitRate && 
    finalMetrics.performance.meetsTargets.hashTime;
  
  console.log(`\n🏆 KGEN v1 Charter Compliance: ${charterCompliant ? 'ACHIEVED ✅' : 'NOT MET ❌'}`);
  
  if (charterCompliant) {
    console.log('\n🎉 Content-Addressed Storage implementation successfully meets all Charter requirements!');
    console.log('✨ Ready for enterprise CAS operations with multiformats CID support');
  } else {
    console.log('\n⚠️  Some Charter requirements not met. Review implementation.');
  }
  
  return charterCompliant;
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = await runFinalTest();
  process.exit(success ? 0 : 1);
}