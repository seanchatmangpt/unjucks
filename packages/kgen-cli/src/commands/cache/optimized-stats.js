import { defineCommand } from 'citty'
import { OptimizedCacheManager } from '@kgen/core/src/cache/optimized-cache-manager'
import { loadConfig } from '@kgen/core/config/config-entry'

export default defineCommand({
  meta: {
    name: 'stats',
    description: 'Show optimized cache statistics with performance metrics'
  },
  args: {
    'json': {
      type: 'boolean',
      description: 'Output as JSON'
    },
    'detailed': {
      type: 'boolean',
      description: 'Show detailed breakdown',
      alias: 'd'
    },
    'performance': {
      type: 'boolean',
      description: 'Show performance analysis',
      alias: 'p'
    },
    'timing': {
      type: 'boolean',
      description: 'Include timing measurements',
      alias: 't'
    }
  },
  async run({ args }) {
    const startTime = performance.now()
    
    try {
      const config = await loadConfig()
      const cacheConfig = config.cache || {}
      
      // Use optimized cache manager
      const cacheManager = new OptimizedCacheManager({
        ...cacheConfig,
        enablePredictiveWarm: true,
        warmupBatchSize: 50,
        memCacheMaxSize: 500
      })
      
      await cacheManager.init()
      
      const stats = await cacheManager.stats()
      const entries = await cacheManager.list()
      
      // Calculate enhanced statistics
      const now = Date.now()
      let sizeByType = {}
      let entriesByAge = {
        'last24h': 0,
        'last7d': 0,
        'last30d': 0,
        'older': 0
      }
      let accessStats = {
        'recent': 0,
        'old': 0,
        'never': 0
      }
      let performanceBreakdown = {
        smallFiles: { count: 0, avgSize: 0 },
        mediumFiles: { count: 0, avgSize: 0 },
        largeFiles: { count: 0, avgSize: 0 }
      }
      
      for (const entry of entries.filter(e => e.exists)) {
        // Size by type
        const type = entry.metadata?.type || 'unknown'
        sizeByType[type] = (sizeByType[type] || 0) + (entry.metadata?.size || 0)
        
        // Age distribution
        const age = now - (entry.metadata?.createdAt || 0)
        const ageInDays = age / (24 * 60 * 60 * 1000)
        
        if (ageInDays < 1) entriesByAge.last24h++
        else if (ageInDays < 7) entriesByAge.last7d++
        else if (ageInDays < 30) entriesByAge.last30d++
        else entriesByAge.older++
        
        // Access patterns
        const lastAccess = entry.metadata?.accessedAt || entry.metadata?.createdAt || 0
        const timeSinceAccess = now - lastAccess
        const daysSinceAccess = timeSinceAccess / (24 * 60 * 60 * 1000)
        
        if (daysSinceAccess < 7) accessStats.recent++
        else if (daysSinceAccess < 30) accessStats.old++
        else accessStats.never++
        
        // Performance breakdown by file size
        const size = entry.metadata?.size || 0
        if (size < 1024) {
          performanceBreakdown.smallFiles.count++
          performanceBreakdown.smallFiles.avgSize += size
        } else if (size < 1024 * 1024) {
          performanceBreakdown.mediumFiles.count++
          performanceBreakdown.mediumFiles.avgSize += size
        } else {
          performanceBreakdown.largeFiles.count++
          performanceBreakdown.largeFiles.avgSize += size
        }
      }
      
      // Calculate averages
      Object.keys(performanceBreakdown).forEach(key => {
        const bucket = performanceBreakdown[key]
        if (bucket.count > 0) {
          bucket.avgSize = Math.round(bucket.avgSize / bucket.count)
        }
      })
      
      // Cache efficiency metrics
      const maxSize = OptimizedCacheManager.parseSize(cacheConfig.maxSize || '5GB')
      const maxAge = OptimizedCacheManager.parseAge(cacheConfig.maxAge || '90d')
      const utilization = stats.totalSize / maxSize
      
      const executionTime = performance.now() - startTime
      
      const output = {
        overview: {
          totalEntries: stats.fileCount,
          totalSize: stats.totalSize,
          totalSizeFormatted: formatBytes(stats.totalSize),
          indexSize: stats.indexSize,
          cacheDirectory: stats.cacheDir,
          oldestEntry: stats.oldestEntry,
          newestEntry: stats.newestEntry,
          executionTime: Math.round(executionTime * 100) / 100
        },
        performance: stats.performance,
        memoryCache: stats.memoryCache,
        configuration: {
          maxSize: cacheConfig.maxSize || '5GB',
          maxSizeBytes: maxSize,
          maxAge: cacheConfig.maxAge || '90d',
          maxAgeMs: maxAge,
          strategy: cacheConfig.strategy || 'lru',
          hashAlgorithm: cacheConfig.hashAlgorithm || 'sha256',
          optimizationsEnabled: true,
          predictiveWarming: true
        },
        utilization: {
          sizeUtilization: utilization,
          sizeUtilizationPercent: Math.round(utilization * 100),
          averageEntrySize: stats.fileCount > 0 ? stats.totalSize / stats.fileCount : 0,
          averageEntrySizeFormatted: stats.fileCount > 0 ? formatBytes(stats.totalSize / stats.fileCount) : '0 B',
          memCacheUtilization: stats.performance?.memCacheUtilization || 0
        },
        breakdown: {
          sizeByType,
          entriesByAge,
          accessPatterns: accessStats,
          performanceBreakdown
        }
      }

      if (args.json) {
        console.log(JSON.stringify(output, null, 2))
        return output
      }

      // Display formatted statistics with enhanced performance info
      console.log('📊 Optimized Cache Statistics (ALPHA-8)')
      console.log('═'.repeat(60))
      
      // Performance Status
      const perf = stats.performance?.performance || {}
      console.log('\n🚀 Performance Status:')
      console.log(`  • Hit Rate: ${stats.performance?.hitRate || 0}% (Target: ${perf.hitRateTarget || 80}%) ${getStatusEmoji(perf.hitRateStatus)}`)
      console.log(`  • Storage Operations: ${stats.performance?.recentAvgStorageTime || 0}ms avg (Target: <${perf.storageTarget || 5}ms) ${getStatusEmoji(perf.storageStatus)}`)
      console.log(`  • Retrieval Operations: ${stats.performance?.recentAvgRetrievalTime || 0}ms avg (Target: <${perf.retrievalTarget || 2}ms) ${getStatusEmoji(perf.retrievalStatus)}`)
      console.log(`  • Memory Cache: ${stats.memoryCache?.size || 0}/${stats.memoryCache?.maxSize || 0} entries (${output.utilization.memCacheUtilization}%)`)
      
      // Request Statistics
      console.log('\n📈 Request Statistics:')
      console.log(`  • Total requests: ${stats.performance?.totalRequests || 0}`)
      console.log(`  • Cache hits: ${stats.performance?.hits || 0}`)
      console.log(`  • Cache misses: ${stats.performance?.misses || 0}`)
      console.log(`  • Warming events: ${stats.performance?.warmingEvents || 0}`)
      
      // Overview
      console.log('\n📋 Storage Overview:')
      console.log(`  • Total entries: ${stats.fileCount.toLocaleString()}`)
      console.log(`  • Total size: ${formatBytes(stats.totalSize)}`)
      console.log(`  • Index entries: ${stats.indexSize.toLocaleString()}`)
      console.log(`  • Cache directory: ${stats.cacheDir}`)
      
      // Configuration
      console.log('\n⚙️  Configuration:')
      console.log(`  • Max size: ${cacheConfig.maxSize || '5GB'} (${formatBytes(maxSize)})`)
      console.log(`  • Max age: ${cacheConfig.maxAge || '90d'}`)
      console.log(`  • Strategy: ${cacheConfig.strategy || 'lru'} (optimized)`)
      console.log(`  • Hash algorithm: ${cacheConfig.hashAlgorithm || 'sha256'}`)
      console.log(`  • Predictive warming: ✅ Enabled`)
      console.log(`  • Memory cache: ✅ Enabled`)

      // Utilization with progress bar
      console.log('\n📈 Utilization:')
      console.log(`  • Size utilization: ${Math.round(utilization * 100)}% (${formatBytes(stats.totalSize)} / ${formatBytes(maxSize)})`)
      const utilizationBar = createProgressBar(utilization, 30)
      console.log(`  • Usage: ${utilizationBar}`)

      if (args.detailed) {
        // Performance breakdown by file size
        console.log('\n⚡ Performance Breakdown:')
        console.log(`  • Small files (<1KB): ${performanceBreakdown.smallFiles.count} entries, avg ${formatBytes(performanceBreakdown.smallFiles.avgSize)}`)
        console.log(`  • Medium files (1KB-1MB): ${performanceBreakdown.mediumFiles.count} entries, avg ${formatBytes(performanceBreakdown.mediumFiles.avgSize)}`)
        console.log(`  • Large files (>1MB): ${performanceBreakdown.largeFiles.count} entries, avg ${formatBytes(performanceBreakdown.largeFiles.avgSize)}`)
        
        // Size by type
        if (Object.keys(sizeByType).length > 0) {
          console.log('\n📊 Size by Type:')
          const sortedTypes = Object.entries(sizeByType)
            .sort(([,a], [,b]) => b - a)
          
          for (const [type, size] of sortedTypes) {
            const percentage = Math.round((size / stats.totalSize) * 100)
            console.log(`  • ${type}: ${formatBytes(size)} (${percentage}%)`)
          }
        }

        // Access patterns
        console.log('\n👁️  Access Patterns:')
        console.log(`  • Recently accessed (< 7 days): ${accessStats.recent.toLocaleString()}`)
        console.log(`  • Old access (7-30 days): ${accessStats.old.toLocaleString()}`)
        console.log(`  • Rarely accessed (> 30 days): ${accessStats.never.toLocaleString()}`)
        console.log(`  • Tracked access patterns: ${stats.performance?.accessPatternsTracked || 0}`)
      }

      // Performance recommendations
      console.log('\n💡 Performance Insights:')
      const insights = generatePerformanceInsights(output)
      insights.forEach(insight => console.log(`  • ${insight}`))

      // Timing information
      if (args.timing) {
        console.log('\n⏱️  Command Timing:')
        console.log(`  • Stats collection: ${Math.round(executionTime)}ms`)
        console.log(`  • Status: ${executionTime < 100 ? '🟢 Fast' : executionTime < 500 ? '🟡 Moderate' : '🔴 Slow'}`)
      }

      return output

    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        executionTime: performance.now() - startTime
      }
      
      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.error('❌ Failed to get optimized cache statistics:', error.message)
      }
      
      process.exit(1)
    }
  }
})

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Create a progress bar
 */
function createProgressBar(percentage, width = 20) {
  const filled = Math.round(percentage * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(percentage * 100)}%`
}

/**
 * Get status emoji
 */
function getStatusEmoji(status) {
  return status === 'PASS' ? '✅' : '❌'
}

/**
 * Generate performance insights
 */
function generatePerformanceInsights(stats) {
  const insights = []
  const perf = stats.performance?.performance || {}
  
  if (perf.hitRateStatus === 'PASS') {
    insights.push('✅ Excellent cache hit rate - predictive warming is working')
  } else {
    insights.push('⚠️  Low cache hit rate - consider running more operations to warm cache')
  }
  
  if (perf.retrievalStatus === 'PASS') {
    insights.push('✅ Fast retrieval times - memory cache optimization effective')
  } else {
    insights.push('⚠️  Slow retrieval times - check disk I/O performance')
  }
  
  if (perf.storageStatus === 'PASS') {
    insights.push('✅ Fast storage operations - async optimization working')
  } else {
    insights.push('⚠️  Slow storage operations - consider reducing content size or checking disk space')
  }
  
  if (stats.utilization.memCacheUtilization > 90) {
    insights.push('⚠️  Memory cache nearly full - consider increasing memCacheMaxSize')
  }
  
  if (stats.breakdown.accessPatterns.never > stats.overview.totalEntries * 0.4) {
    insights.push('🧹 Many unused entries - run garbage collection to free space')
  }
  
  return insights
}