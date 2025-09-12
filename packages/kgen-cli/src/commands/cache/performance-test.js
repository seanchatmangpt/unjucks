import { defineCommand } from 'citty'
import { OptimizedCacheManager } from '@kgen/core/cache/optimized-cache-manager'
import { CacheManager } from '@kgen/core/cache'
import { loadConfig } from '@kgen/core/config'

export default defineCommand({
  meta: {
    name: 'perf-test',
    description: 'Run performance tests and benchmarks on cache system'
  },
  args: {
    'operations': {
      type: 'number',
      description: 'Number of operations to perform',
      default: 1000,
      alias: 'n'
    },
    'size': {
      type: 'string',
      description: 'Content size (e.g., 1KB, 1MB)',
      default: '1KB',
      alias: 's'
    },
    'concurrency': {
      type: 'number',
      description: 'Concurrent operations',
      default: 10,
      alias: 'c'
    },
    'ratio': {
      type: 'number',
      description: 'Read/write ratio (0.0 to 1.0)',
      default: 0.7
    },
    'compare': {
      type: 'boolean',
      description: 'Compare optimized vs standard cache',
      alias: 'comp'
    },
    'json': {
      type: 'boolean',
      description: 'Output as JSON'
    },
    'warmup': {
      type: 'boolean',
      description: 'Test cache warming behavior',
      alias: 'w'
    }
  },
  async run({ args }) {
    const startTime = performance.now()
    
    try {
      const config = await loadConfig()
      const cacheConfig = config.cache || {}
      
      // Parse content size
      const contentSize = parseSize(args.size)
      
      console.log(`🚀 Cache Performance Test (ALPHA-8)`)
      console.log('═'.repeat(50))
      console.log(`Parameters:`)
      console.log(`  • Operations: ${args.operations}`)
      console.log(`  • Content size: ${args.size} (${contentSize} bytes)`)
      console.log(`  • Concurrency: ${args.concurrency}`)
      console.log(`  • Read/write ratio: ${Math.round(args.ratio * 100)}%/${Math.round((1-args.ratio) * 100)}%`)
      console.log(`  • Compare modes: ${args.compare ? 'Yes' : 'No'}`)
      console.log('')
      
      const results = {}
      
      // Test optimized cache
      console.log('🔥 Testing Optimized Cache Manager...')
      const optimizedCache = new OptimizedCacheManager({
        ...cacheConfig,
        cacheDir: `${cacheConfig.cacheDir || '~/.kgen/cache'}/perf-test-optimized`,
        enablePredictiveWarm: true,
        warmupBatchSize: 50,
        memCacheMaxSize: 500
      })
      
      const optimizedResult = await optimizedCache.stressTest({
        operations: args.operations,
        contentSize,
        keyPrefix: 'perf-opt',
        readWriteRatio: args.ratio,
        concurrency: args.concurrency
      })
      
      results.optimized = optimizedResult
      
      if (args.compare) {
        console.log('📊 Testing Standard Cache Manager...')
        const standardCache = new CacheManager({
          ...cacheConfig,
          cacheDir: `${cacheConfig.cacheDir || '~/.kgen/cache'}/perf-test-standard`
        })
        
        // Manual stress test for standard cache
        const standardResult = await runStandardStressTest(standardCache, {
          operations: args.operations,
          contentSize,
          keyPrefix: 'perf-std',
          readWriteRatio: args.ratio,
          concurrency: args.concurrency
        })
        
        results.standard = standardResult
      }
      
      // Warmup test
      if (args.warmup) {
        console.log('🔄 Testing Cache Warming...')
        const warmupResult = await testCacheWarming(optimizedCache, {
          operations: Math.min(args.operations, 200),
          contentSize
        })
        results.warming = warmupResult
      }
      
      const totalTime = performance.now() - startTime
      results.meta = {
        totalTestTime: Math.round(totalTime),
        timestamp: new Date().toISOString(),
        parameters: {
          operations: args.operations,
          contentSize: args.size,
          concurrency: args.concurrency,
          readWriteRatio: args.ratio
        }
      }
      
      if (args.json) {
        console.log(JSON.stringify(results, null, 2))
        return results
      }
      
      // Display results
      displayResults(results, args)
      
      return results
      
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
      
      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.error('❌ Performance test failed:', error.message)
      }
      
      process.exit(1)
    }
  }
})

/**
 * Run stress test on standard cache manager
 */
async function runStandardStressTest(cacheManager, options) {
  const {
    operations,
    contentSize,
    keyPrefix,
    readWriteRatio,
    concurrency
  } = options
  
  const startTime = performance.now()
  
  // Clear any existing data
  await cacheManager.clear()
  
  // Generate test content
  const testContent = 'x'.repeat(contentSize)
  const testKeys = Array.from({ length: operations }, (_, i) => `${keyPrefix}-${i}`)
  
  // Pre-populate some data
  const prePopulate = Math.floor(operations * 0.3)
  for (let i = 0; i < prePopulate; i++) {
    await cacheManager.set(testKeys[i], testContent, { type: 'stress-test' })
  }
  
  // Create operation mix
  const ops = []
  for (let i = 0; i < operations; i++) {
    if (Math.random() < readWriteRatio && i < prePopulate) {
      ops.push({ type: 'read', key: testKeys[i] })
    } else {
      ops.push({ type: 'write', key: testKeys[i], content: testContent })
    }
  }
  
  // Run operations
  const results = []
  let hits = 0
  let misses = 0
  
  for (let i = 0; i < ops.length; i += concurrency) {
    const batch = ops.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async op => {
        const opStart = performance.now()
        try {
          if (op.type === 'read') {
            const result = await cacheManager.get(op.key)
            if (result) hits++
            else misses++
          } else {
            await cacheManager.set(op.key, op.content, { type: 'stress-test' })
          }
          return { success: true, duration: performance.now() - opStart }
        } catch (error) {
          return { success: false, error: error.message, duration: performance.now() - opStart }
        }
      })
    )
    results.push(...batchResults)
  }
  
  const totalTime = performance.now() - startTime
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  
  // Get cache stats
  const stats = await cacheManager.stats()
  
  return {
    summary: {
      totalOperations: operations,
      successful: successful.length,
      failed: failed.length,
      successRate: Math.round((successful.length / operations) * 100),
      totalTime: Math.round(totalTime),
      opsPerSecond: Math.round(operations / (totalTime / 1000))
    },
    performance: {
      hitRate: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
      totalRequests: hits + misses,
      hits,
      misses,
      avgOperationTime: successful.length > 0 ? 
        Math.round((successful.reduce((sum, r) => sum + r.duration, 0) / successful.length) * 100) / 100 : 0
    },
    config: {
      contentSize: options.contentSize,
      readWriteRatio: options.readWriteRatio,
      concurrency: options.concurrency,
      prePopulated: prePopulate
    },
    cacheStats: stats
  }
}

/**
 * Test cache warming behavior
 */
async function testCacheWarming(cacheManager, options) {
  const { operations, contentSize } = options
  
  const startTime = performance.now()
  await cacheManager.clear()
  
  const testContent = 'x'.repeat(contentSize)
  const testKeys = Array.from({ length: operations }, (_, i) => `warm-test-${i}`)
  
  // Phase 1: Initial operations (cold cache)
  console.log('  Phase 1: Cold cache operations...')
  const coldPhase = []
  for (let i = 0; i < Math.min(operations, 50); i++) {
    const key = testKeys[i]
    
    // Write
    const writeStart = performance.now()
    await cacheManager.set(key, testContent, { type: 'warming-test' })
    coldPhase.push({ type: 'write', duration: performance.now() - writeStart })
    
    // Read
    const readStart = performance.now()
    await cacheManager.get(key)
    coldPhase.push({ type: 'read', duration: performance.now() - readStart })
  }
  
  // Phase 2: Repeated operations (should trigger warming)
  console.log('  Phase 2: Repeated operations (warming should occur)...')
  await new Promise(resolve => setTimeout(resolve, 200)) // Let warming happen
  
  const warmPhase = []
  for (let i = 0; i < Math.min(operations, 50); i++) {
    const key = testKeys[i]
    
    // Multiple reads to trigger patterns
    for (let j = 0; j < 3; j++) {
      const readStart = performance.now()
      await cacheManager.get(key)
      warmPhase.push({ type: 'read', duration: performance.now() - readStart })
    }
  }
  
  // Phase 3: New operations (should benefit from warming)
  console.log('  Phase 3: New operations (should benefit from warming)...')
  await new Promise(resolve => setTimeout(resolve, 200)) // Let warming propagate
  
  const warmedPhase = []
  for (let i = 50; i < Math.min(operations, 100); i++) {
    const key = testKeys[i]
    
    // Write and immediate read
    await cacheManager.set(key, testContent, { type: 'warming-test' })
    
    const readStart = performance.now()
    const result = await cacheManager.get(key)
    warmedPhase.push({ 
      type: 'read', 
      duration: performance.now() - readStart,
      fromMemory: result?.fromMemory || false
    })
  }
  
  const totalTime = performance.now() - startTime
  const stats = await cacheManager.stats()
  
  return {
    phases: {
      cold: {
        operations: coldPhase.length,
        avgWriteTime: calculateAverage(coldPhase.filter(op => op.type === 'write')),
        avgReadTime: calculateAverage(coldPhase.filter(op => op.type === 'read'))
      },
      warm: {
        operations: warmPhase.length,
        avgReadTime: calculateAverage(warmPhase.filter(op => op.type === 'read'))
      },
      warmed: {
        operations: warmedPhase.length,
        avgReadTime: calculateAverage(warmedPhase.filter(op => op.type === 'read')),
        memoryHits: warmedPhase.filter(op => op.fromMemory).length,
        memoryHitRate: Math.round((warmedPhase.filter(op => op.fromMemory).length / warmedPhase.length) * 100)
      }
    },
    improvement: {
      readTimeImprovement: calculateImprovement(
        calculateAverage(coldPhase.filter(op => op.type === 'read')),
        calculateAverage(warmedPhase.filter(op => op.type === 'read'))
      )
    },
    totalTime: Math.round(totalTime),
    finalStats: stats.performance
  }
}

/**
 * Display formatted results
 */
function displayResults(results, args) {
  console.log('\n📊 Performance Test Results')
  console.log('═'.repeat(50))
  
  // Optimized results
  const opt = results.optimized
  console.log('\n🔥 Optimized Cache Manager:')
  console.log(`  • Total operations: ${opt.summary.totalOperations}`)
  console.log(`  • Success rate: ${opt.summary.successRate}%`)
  console.log(`  • Operations/sec: ${opt.summary.opsPerSecond}`)
  console.log(`  • Total time: ${opt.summary.totalTime}ms`)
  console.log(`  • Hit rate: ${opt.performance.hitRate}%`)
  console.log(`  • Avg storage time: ${opt.performance.avgStorageTime}ms`)
  console.log(`  • Avg retrieval time: ${opt.performance.avgRetrievalTime}ms`)
  
  // Performance targets
  const perf = opt.performance.performance
  console.log('\n📈 Performance Targets:')
  console.log(`  • Storage: ${getStatusEmoji(perf.storageStatus)} ${opt.performance.recentAvgStorageTime}ms (target: <${perf.storageTarget}ms)`)
  console.log(`  • Retrieval: ${getStatusEmoji(perf.retrievalStatus)} ${opt.performance.recentAvgRetrievalTime}ms (target: <${perf.retrievalTarget}ms)`)
  console.log(`  • Hit Rate: ${getStatusEmoji(perf.hitRateStatus)} ${opt.performance.hitRate}% (target: >${perf.hitRateTarget}%)`)
  
  // Comparison
  if (args.compare && results.standard) {
    const std = results.standard
    console.log('\n📊 Standard Cache Manager:')
    console.log(`  • Operations/sec: ${std.summary.opsPerSecond}`)
    console.log(`  • Hit rate: ${std.performance.hitRate}%`)
    console.log(`  • Avg operation time: ${std.performance.avgOperationTime}ms`)
    
    console.log('\n🚀 Performance Comparison:')
    const speedup = opt.summary.opsPerSecond / std.summary.opsPerSecond
    const hitRateImprovement = opt.performance.hitRate - std.performance.hitRate
    console.log(`  • Speed improvement: ${Math.round(speedup * 100)}% faster`)
    console.log(`  • Hit rate improvement: +${hitRateImprovement}% points`)
    console.log(`  • Memory cache benefit: ${opt.performance.memoryCacheSize} entries cached`)
  }
  
  // Warming results
  if (results.warming) {
    const warm = results.warming
    console.log('\n🔄 Cache Warming Analysis:')
    console.log(`  • Cold read time: ${warm.phases.cold.avgReadTime}ms`)
    console.log(`  • Warmed read time: ${warm.phases.warmed.avgReadTime}ms`)
    console.log(`  • Memory hit rate: ${warm.phases.warmed.memoryHitRate}%`)
    console.log(`  • Read improvement: ${warm.improvement.readTimeImprovement}% faster`)
  }
  
  console.log(`\n⏱️  Total test time: ${results.meta.totalTestTime}ms`)
}

/**
 * Helper functions
 */
function parseSize(sizeStr) {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/i)
  if (!match) throw new Error(`Invalid size format: ${sizeStr}`)
  
  const [, num, unit = 'B'] = match
  const value = parseFloat(num)
  
  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4
  }
  
  return Math.floor(value * (multipliers[unit.toUpperCase()] || 1))
}

function calculateAverage(items) {
  if (!items.length) return 0
  return Math.round((items.reduce((sum, item) => sum + item.duration, 0) / items.length) * 100) / 100
}

function calculateImprovement(before, after) {
  if (before === 0) return 0
  return Math.round(((before - after) / before) * 100)
}

function getStatusEmoji(status) {
  return status === 'PASS' ? '✅' : '❌'
}