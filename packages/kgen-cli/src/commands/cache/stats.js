import { defineCommand } from 'citty'
import { CacheManager } from '@kgen/core/cache'
import { loadConfig } from '@kgen/core/config'
import { logger } from '@kgen/core/utils'
import { createStandardOutput, handleStandardError, ErrorCodes } from '../../../../../src/kgen/cli/standardized-output.js'

export default defineCommand({
  meta: {
    name: 'stats',
    description: 'Show cache statistics and health information'
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
    'analyze': {
      type: 'boolean',
      description: 'Include garbage collection analysis',
      alias: 'a'
    }
  },
  async run({ args }) {
    const output = createStandardOutput();
    
    try {
      const config = await loadConfig()
      const cacheConfig = config.cache || {}
      
      const cacheManager = new CacheManager(cacheConfig)
      await cacheManager.init()

      const stats = await cacheManager.stats()
      const entries = await cacheManager.list()

      // Calculate additional statistics
      const now = this.getDeterministicTimestamp()
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
      }

      // Calculate cache efficiency
      const maxSize = CacheManager.parseSize(cacheConfig.maxSize || '5GB')
      const maxAge = CacheManager.parseAge(cacheConfig.maxAge || '90d')
      const utilization = stats.totalSize / maxSize
      
      const statsData = {
        overview: {
          totalEntries: stats.fileCount,
          totalSize: stats.totalSize,
          totalSizeFormatted: formatBytes(stats.totalSize),
          indexSize: stats.indexSize,
          cacheDirectory: stats.cacheDir,
          oldestEntry: stats.oldestEntry,
          newestEntry: stats.newestEntry
        },
        configuration: {
          maxSize: cacheConfig.maxSize || '5GB',
          maxSizeBytes: maxSize,
          maxAge: cacheConfig.maxAge || '90d',
          maxAgeMs: maxAge,
          strategy: cacheConfig.strategy || 'lru',
          hashAlgorithm: cacheConfig.hashAlgorithm || 'sha256'
        },
        utilization: {
          sizeUtilization: utilization,
          sizeUtilizationPercent: Math.round(utilization * 100),
          averageEntrySize: stats.fileCount > 0 ? stats.totalSize / stats.fileCount : 0,
          averageEntrySizeFormatted: stats.fileCount > 0 ? formatBytes(stats.totalSize / stats.fileCount) : '0 B'
        },
        breakdown: {
          sizeByType,
          entriesByAge,
          accessPatterns: accessStats
        }
      }

      if (args.analyze) {
        const analysis = await cacheManager.gc.analyze()
        statsData.analysis = {
          potentialRemovals: analysis.recommendations.length,
          potentialSavings: analysis.potentialSavings,
          potentialSavingsFormatted: formatBytes(analysis.potentialSavings),
          reasons: analysis.recommendations.reduce((acc, rec) => {
            acc[rec.reason] = (acc[rec.reason] || 0) + 1
            return acc
          }, {})
        }
      }

      if (args.json) {
        return output.success('cache:stats', statsData);
      }

      // Display formatted statistics
      logger.info('📊 Cache Statistics')
      logger.info('═'.repeat(50))
      
      // Overview
      logger.info('\n📋 Overview:')
      logger.info(`  • Total entries: ${stats.fileCount.toLocaleString()}`)
      logger.info(`  • Total size: ${formatBytes(stats.totalSize)}`)
      logger.info(`  • Index entries: ${stats.indexSize.toLocaleString()}`)
      logger.info(`  • Cache directory: ${stats.cacheDir}`)
      
      if (stats.oldestEntry && stats.newestEntry) {
        logger.info(`  • Date range: ${stats.oldestEntry.toLocaleDateString()} - ${stats.newestEntry.toLocaleDateString()}`)
      }

      // Configuration
      logger.info('\n⚙️  Configuration:')
      logger.info(`  • Max size: ${cacheConfig.maxSize || '5GB'} (${formatBytes(maxSize)})`)
      logger.info(`  • Max age: ${cacheConfig.maxAge || '90d'}`)
      logger.info(`  • Strategy: ${cacheConfig.strategy || 'lru'}`)
      logger.info(`  • Hash algorithm: ${cacheConfig.hashAlgorithm || 'sha256'}`)

      // Utilization
      logger.info('\n📈 Utilization:')
      logger.info(`  • Size utilization: ${Math.round(utilization * 100)}% (${formatBytes(stats.totalSize)} / ${formatBytes(maxSize)})`)
      logger.info(`  • Average entry size: ${formatBytes(statsData.utilization.averageEntrySize)}`)
      
      const utilizationBar = createProgressBar(utilization, 20)
      logger.info(`  • Usage: ${utilizationBar}`)

      if (args.detailed) {
        // Size by type
        if (Object.keys(sizeByType).length > 0) {
          logger.info('\n📊 Size by Type:')
          const sortedTypes = Object.entries(sizeByType)
            .sort(([,a], [,b]) => b - a)
          
          for (const [type, size] of sortedTypes) {
            const percentage = Math.round((size / stats.totalSize) * 100)
            logger.info(`  • ${type}: ${formatBytes(size)} (${percentage}%)`)
          }
        }

        // Entries by age
        logger.info('\n📅 Entries by Age:')
        logger.info(`  • Last 24 hours: ${entriesByAge.last24h.toLocaleString()}`)
        logger.info(`  • Last 7 days: ${entriesByAge.last7d.toLocaleString()}`)
        logger.info(`  • Last 30 days: ${entriesByAge.last30d.toLocaleString()}`)
        logger.info(`  • Older than 30 days: ${entriesByAge.older.toLocaleString()}`)

        // Access patterns
        logger.info('\n👁️  Access Patterns:')
        logger.info(`  • Recently accessed (< 7 days): ${accessStats.recent.toLocaleString()}`)
        logger.info(`  • Old access (7-30 days): ${accessStats.old.toLocaleString()}`)
        logger.info(`  • Rarely accessed (> 30 days): ${accessStats.never.toLocaleString()}`)
      }

      if (args.analyze && statsData.analysis) {
        logger.info('\n🧹 Garbage Collection Analysis:')
        logger.info(`  • Entries that could be removed: ${statsData.analysis.potentialRemovals.toLocaleString()}`)
        logger.info(`  • Potential space savings: ${statsData.analysis.potentialSavingsFormatted}`)
        
        if (Object.keys(statsData.analysis.reasons).length > 0) {
          logger.info('  • Removal reasons:')
          for (const [reason, count] of Object.entries(statsData.analysis.reasons)) {
            logger.info(`    - ${reason}: ${count} entries`)
          }
        }
        
        if (statsData.analysis.potentialSavings > 0) {
          logger.info('\n💡 Recommendation: Run `kgen cache gc` to reclaim space')
        }
      }

      // Health assessment
      logger.info('\n🏥 Health Assessment:')
      const healthScore = calculateHealthScore(statsData)
      const healthEmoji = healthScore > 80 ? '🟢' : healthScore > 60 ? '🟡' : '🔴'
      logger.info(`  • Overall health: ${healthEmoji} ${healthScore}%`)
      
      if (utilization > 0.9) {
        logger.info('  ⚠️  High disk usage - consider running garbage collection')
      }
      if (entriesByAge.older > stats.fileCount * 0.5) {
        logger.info('  ⚠️  Many old entries - consider more aggressive cleanup')
      }
      if (accessStats.never > stats.fileCount * 0.3) {
        logger.info('  ⚠️  Many unused entries - review access patterns')
      }

      // Notify hooks
      await notifyHooks('cache-stats-viewed', {
        totalEntries: stats.fileCount,
        totalSize: stats.totalSize,
        utilization: Math.round(utilization * 100),
        healthScore
      })

    } catch (error) {
      return handleStandardError('cache:stats', error, output);
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
 * Calculate overall cache health score
 */
function calculateHealthScore(stats) {
  let score = 100
  
  // Penalize high utilization
  if (stats.utilization.sizeUtilization > 0.9) score -= 20
  else if (stats.utilization.sizeUtilization > 0.7) score -= 10
  
  // Penalize too many old entries
  const totalEntries = stats.overview.totalEntries
  if (totalEntries > 0) {
    const oldEntries = stats.breakdown.entriesByAge.older
    if (oldEntries / totalEntries > 0.5) score -= 15
    
    const unusedEntries = stats.breakdown.accessPatterns.never
    if (unusedEntries / totalEntries > 0.3) score -= 15
  }
  
  // Reward good access patterns
  if (stats.breakdown.accessPatterns.recent > totalEntries * 0.6) score += 5
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Notify hooks about cache operations
 */
async function notifyHooks(event, data) {
  try {
    const { execSync } = await import('child_process')
    execSync(`npx claude-flow@alpha hooks notify --message "${event}" --data '${JSON.stringify(data)}'`, {
      stdio: 'pipe'
    })
  } catch (error) {
    // Hooks are optional
  }
}