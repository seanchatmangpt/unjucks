#!/usr/bin/env node

/**
 * ALPHA-8 Cache Performance Validation Script
 * 
 * Tests the optimized cache system to validate performance improvements:
 * - Cache warming and hit rates (target: 80%+)
 * - Storage operation performance (<5ms for small content)
 * - Retrieval operation performance (<2ms for cache hits)
 * - Stress testing under load
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { performance } from 'perf_hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import the optimized cache manager
const { OptimizedCacheManager } = await import('../../packages/kgen-core/src/cache/optimized-cache-manager.js')

console.log('🚀 ALPHA-8 Cache Performance Validation')
console.log('═'.repeat(50))

/**
 * Test 1: Basic Performance Metrics
 */
async function testBasicPerformance() {
  console.log('\n📊 Test 1: Basic Performance Metrics')
  
  const cacheManager = new OptimizedCacheManager({
    cacheDir: join(__dirname, '../temp/cache-perf-test'),
    enablePredictiveWarm: true,
    memCacheMaxSize: 100
  })
  
  await cacheManager.clear()
  
  // Test storage performance with small content
  const smallContent = 'x'.repeat(500) // 500 bytes
  const storageResults = []
  
  console.log('  Testing storage operations (small content)...')
  for (let i = 0; i < 50; i++) {
    const start = performance.now()
    await cacheManager.set(`test-key-${i}`, smallContent, { type: 'perf-test' })
    const duration = performance.now() - start
    storageResults.push(duration)
  }
  
  const avgStorage = storageResults.reduce((a, b) => a + b, 0) / storageResults.length
  const maxStorage = Math.max(...storageResults)
  
  console.log(`    ✓ Average storage time: ${avgStorage.toFixed(2)}ms`)
  console.log(`    ✓ Max storage time: ${maxStorage.toFixed(2)}ms`)
  console.log(`    ${avgStorage <= 5 ? '✅ PASS' : '❌ FAIL'} Storage target (<5ms): ${avgStorage.toFixed(2)}ms`)
  
  // Test retrieval performance
  const retrievalResults = []
  
  console.log('  Testing retrieval operations...')
  for (let i = 0; i < 50; i++) {
    const start = performance.now()
    const result = await cacheManager.get(`test-key-${i}`)
    const duration = performance.now() - start
    if (result) retrievalResults.push({ duration, fromMemory: result.fromMemory })
  }
  
  const avgRetrieval = retrievalResults.reduce((a, b) => a + b.duration, 0) / retrievalResults.length
  const memoryHits = retrievalResults.filter(r => r.fromMemory).length
  const memoryHitRate = (memoryHits / retrievalResults.length) * 100
  
  console.log(`    ✓ Average retrieval time: ${avgRetrieval.toFixed(2)}ms`)
  console.log(`    ✓ Memory hits: ${memoryHits}/${retrievalResults.length} (${memoryHitRate.toFixed(1)}%)`)
  console.log(`    ${avgRetrieval <= 2 ? '✅ PASS' : '❌ FAIL'} Retrieval target (<2ms): ${avgRetrieval.toFixed(2)}ms`)
  
  return {
    avgStorage,
    maxStorage,
    avgRetrieval,
    memoryHitRate,
    storagePass: avgStorage <= 5,
    retrievalPass: avgRetrieval <= 2
  }
}

/**
 * Test 2: Cache Warming and Hit Rates
 */
async function testCacheWarming() {
  console.log('\n🔥 Test 2: Cache Warming and Hit Rates')
  
  const cacheManager = new OptimizedCacheManager({
    cacheDir: join(__dirname, '../temp/cache-warming-test'),
    enablePredictiveWarm: true,
    accessCountThreshold: 3,
    warmupBatchSize: 20,
    memCacheMaxSize: 50
  })
  
  await cacheManager.clear()
  
  const testContent = 'y'.repeat(1024) // 1KB content
  const keys = Array.from({ length: 30 }, (_, i) => `warm-key-${i}`)
  
  console.log('  Phase 1: Initial operations (cold cache)...')
  // Initial writes
  for (const key of keys) {
    await cacheManager.set(key, testContent, { type: 'warming-test' })
  }
  
  console.log('  Phase 2: Access pattern establishment...')
  // Create access patterns for first 10 keys
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < 10; i++) {
      await cacheManager.get(keys[i])
    }
  }
  
  // Wait for warming to trigger
  console.log('  Phase 3: Waiting for predictive warming...')
  await new Promise(resolve => setTimeout(resolve, 300))
  
  console.log('  Phase 4: Testing warmed cache performance...')
  const warmTestResults = []
  
  for (let i = 0; i < 10; i++) {
    const start = performance.now()
    const result = await cacheManager.get(keys[i])
    const duration = performance.now() - start
    warmTestResults.push({
      duration,
      fromMemory: result?.fromMemory || false,
      hit: !!result
    })
  }
  
  const stats = cacheManager.getPerformanceStats()
  const memoryHits = warmTestResults.filter(r => r.fromMemory).length
  const cacheHits = warmTestResults.filter(r => r.hit).length
  const avgWarmTime = warmTestResults.reduce((a, b) => a + b.duration, 0) / warmTestResults.length
  
  console.log(`    ✓ Total cache hit rate: ${stats.hitRate}%`)
  console.log(`    ✓ Memory cache hits: ${memoryHits}/${warmTestResults.length} (${(memoryHits/warmTestResults.length*100).toFixed(1)}%)`)
  console.log(`    ✓ Warming events: ${stats.warmingEvents}`)
  console.log(`    ✓ Average warmed retrieval: ${avgWarmTime.toFixed(2)}ms`)
  console.log(`    ${stats.hitRate >= 80 ? '✅ PASS' : '❌ FAIL'} Hit rate target (>80%): ${stats.hitRate}%`)
  
  return {
    hitRate: stats.hitRate,
    memoryHitRate: (memoryHits/warmTestResults.length*100),
    warmingEvents: stats.warmingEvents,
    avgWarmTime,
    hitRatePass: stats.hitRate >= 80
  }
}

/**
 * Test 3: Stress Test with Large Dataset
 */
async function testStressPerformance() {
  console.log('\n⚡ Test 3: Stress Test Performance')
  
  const cacheManager = new OptimizedCacheManager({
    cacheDir: join(__dirname, '../temp/cache-stress-test'),
    enablePredictiveWarm: true,
    memCacheMaxSize: 200
  })
  
  console.log('  Running stress test (500 operations)...')
  const stressResult = await cacheManager.stressTest({
    operations: 500,
    contentSize: 2048, // 2KB
    concurrency: 15,
    readWriteRatio: 0.75
  })
  
  const perf = stressResult.performance
  console.log(`    ✓ Operations/sec: ${stressResult.summary.opsPerSecond}`)
  console.log(`    ✓ Success rate: ${stressResult.summary.successRate}%`)
  console.log(`    ✓ Hit rate: ${perf.hitRate}%`)
  console.log(`    ✓ Avg storage: ${perf.recentAvgStorageTime}ms`)
  console.log(`    ✓ Avg retrieval: ${perf.recentAvgRetrievalTime}ms`)
  console.log(`    ${stressResult.summary.successRate >= 95 ? '✅ PASS' : '❌ FAIL'} Success rate (>95%): ${stressResult.summary.successRate}%`)
  console.log(`    ${perf.performance.storageStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'} Storage performance: ${perf.recentAvgStorageTime}ms`)
  console.log(`    ${perf.performance.retrievalStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'} Retrieval performance: ${perf.recentAvgRetrievalTime}ms`)
  
  return {
    opsPerSecond: stressResult.summary.opsPerSecond,
    successRate: stressResult.summary.successRate,
    hitRate: perf.hitRate,
    storageTime: perf.recentAvgStorageTime,
    retrievalTime: perf.recentAvgRetrievalTime,
    storagePass: perf.performance.storageStatus === 'PASS',
    retrievalPass: perf.performance.retrievalStatus === 'PASS',
    successPass: stressResult.summary.successRate >= 95
  }
}

/**
 * Test 4: Timeout and Reliability
 */
async function testTimeoutReliability() {
  console.log('\n🔒 Test 4: Timeout and Reliability')
  
  const cacheManager = new OptimizedCacheManager({
    cacheDir: join(__dirname, '../temp/cache-timeout-test'),
    enablePredictiveWarm: true
  })
  
  await cacheManager.clear()
  
  // Test with various content sizes
  const tests = [
    { name: 'tiny', size: 100, count: 20 },
    { name: 'small', size: 1024, count: 15 },
    { name: 'medium', size: 10240, count: 10 },
    { name: 'large', size: 102400, count: 5 }
  ]
  
  const results = {}
  
  for (const test of tests) {
    console.log(`    Testing ${test.name} files (${test.size} bytes)...`)
    const content = 'z'.repeat(test.size)
    const times = []
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 10000) // 10s timeout
    )
    
    try {
      for (let i = 0; i < test.count; i++) {
        const start = performance.now()
        const operation = cacheManager.set(`${test.name}-${i}`, content, { type: test.name })
        await Promise.race([operation, timeout])
        const duration = performance.now() - start
        times.push(duration)
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      
      results[test.name] = {
        avgTime,
        maxTime,
        success: true,
        timeoutPass: maxTime < 5000 // 5s max
      }
      
      console.log(`      ✓ Average: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
      console.log(`      ${maxTime < 5000 ? '✅ PASS' : '❌ FAIL'} No timeouts (<5s): ${maxTime.toFixed(2)}ms`)
      
    } catch (error) {
      results[test.name] = {
        success: false,
        error: error.message,
        timeoutPass: false
      }
      console.log(`      ❌ FAIL: ${error.message}`)
    }
  }
  
  return results
}

/**
 * Run all tests and generate report
 */
async function runAllTests() {
  console.log('\n⏱️  Starting comprehensive performance validation...\n')
  
  const testResults = {}
  const startTime = performance.now()
  
  try {
    testResults.basicPerformance = await testBasicPerformance()
    testResults.cacheWarming = await testCacheWarming()
    testResults.stressPerformance = await testStressPerformance()
    testResults.timeoutReliability = await testTimeoutReliability()
    
    const totalTime = performance.now() - startTime
    
    // Generate summary report
    console.log('\n📋 ALPHA-8 PERFORMANCE SUMMARY')
    console.log('═'.repeat(50))
    
    const basic = testResults.basicPerformance
    const warming = testResults.cacheWarming
    const stress = testResults.stressPerformance
    
    console.log('\n🎯 Performance Targets:')
    console.log(`  Storage Operations:  ${basic.storagePass ? '✅' : '❌'} ${basic.avgStorage.toFixed(2)}ms (target: <5ms)`)
    console.log(`  Retrieval Operations: ${basic.retrievalPass ? '✅' : '❌'} ${basic.avgRetrieval.toFixed(2)}ms (target: <2ms)`)
    console.log(`  Cache Hit Rate:      ${warming.hitRatePass ? '✅' : '❌'} ${warming.hitRate}% (target: >80%)`)
    console.log(`  Stress Success Rate: ${stress.successPass ? '✅' : '❌'} ${stress.successRate}% (target: >95%)`)
    
    console.log('\n🚀 Cache Warming Results:')
    console.log(`  Hit Rate Improvement: ${warming.hitRate}%`)
    console.log(`  Memory Cache Benefits: ${warming.memoryHitRate.toFixed(1)}% memory hits`)
    console.log(`  Warming Events: ${warming.warmingEvents} triggered`)
    console.log(`  Average Warm Time: ${warming.avgWarmTime.toFixed(2)}ms`)
    
    console.log('\n⚡ Stress Test Results:')
    console.log(`  Operations/Second: ${stress.opsPerSecond}`)
    console.log(`  Final Hit Rate: ${stress.hitRate}%`)
    console.log(`  Storage Performance: ${stress.storageTime}ms`)
    console.log(`  Retrieval Performance: ${stress.retrievalTime}ms`)
    
    // Overall assessment
    const allTargetsMet = basic.storagePass && basic.retrievalPass && warming.hitRatePass && stress.successPass
    console.log('\n🏆 Overall Assessment:')
    console.log(`  Status: ${allTargetsMet ? '✅ ALL TARGETS MET' : '⚠️  SOME TARGETS MISSED'}`)
    console.log(`  Total test time: ${(totalTime/1000).toFixed(2)}s`)
    
    const report = {
      timestamp: new Date().toISOString(),
      version: 'ALPHA-8',
      totalTestTime: Math.round(totalTime),
      allTargetsMet,
      summary: {
        storagePerformance: `${basic.avgStorage.toFixed(2)}ms (${basic.storagePass ? 'PASS' : 'FAIL'})`,
        retrievalPerformance: `${basic.avgRetrieval.toFixed(2)}ms (${basic.retrievalPass ? 'PASS' : 'FAIL'})`,
        hitRate: `${warming.hitRate}% (${warming.hitRatePass ? 'PASS' : 'FAIL'})`,
        stressTest: `${stress.successRate}% success, ${stress.opsPerSecond} ops/sec`,
        cacheWarming: `${warming.warmingEvents} events, ${warming.memoryHitRate.toFixed(1)}% memory hits`
      },
      detailed: testResults
    }
    
    // Write report to file
    const reportPath = join(__dirname, '../reports/alpha8-performance-report.json')
    await import('fs').then(fs => fs.promises.mkdir(dirname(reportPath), { recursive: true }))
    await import('fs').then(fs => fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2)))
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`)
    
    return report
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message)
    throw error
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(report => {
      console.log('\n✅ Performance validation completed successfully!')
      process.exit(report.allTargetsMet ? 0 : 1)
    })
    .catch(error => {
      console.error('💥 Performance validation failed:', error.message)
      process.exit(1)
    })
}

export { runAllTests, testBasicPerformance, testCacheWarming, testStressPerformance, testTimeoutReliability }