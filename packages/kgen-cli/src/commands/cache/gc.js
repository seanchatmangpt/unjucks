/**
 * Cache Garbage Collection Command
 * 
 * Clean old and unused cache entries based on policy using the unified
 * content-addressed cache and garbage collector.
 */

import { defineCommand } from 'citty';
import { resolve } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig } from '../../lib/utils.js';
import { ContentAddressedCache } from '../../../../kgen-core/src/cache/content-addressable-cache.js';
import { GarbageCollector, GCStrategy } from '../../../../kgen-core/src/cache/garbage-collector.js';

export default defineCommand({
  meta: {
    name: 'gc',
    description: 'Run garbage collection to clean old cache entries'
  },
  args: {
    strategy: {
      type: 'string',
      description: 'GC strategy: auto|aggressive|memory|disk|templates|expired|lru|size|access',
      default: 'auto',
      alias: 's'
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview what would be collected without actually collecting',
      alias: 'dry'
    },
    analyze: {
      type: 'boolean',
      description: 'Analyze cache pressure before collection',
      alias: 'a'
    },
    force: {
      type: 'boolean',
      description: 'Force collection without confirmation',
      default: false
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Initialize cache system
      const cacheConfig = {
        cacheDir: resolve(config.directories?.cache || './cache'),
        ...config.cache
      };
      
      const cache = new ContentAddressedCache(cacheConfig);
      await cache.initialize();
      
      // Initialize garbage collector
      const gc = new GarbageCollector(cache, {
        enableAutoCollection: false, // Manual collection only
        ...config.cache?.gc
      });
      await gc.initialize();
      
      // Analyze cache pressure if requested
      let analysis = null;
      if (args.analyze) {
        analysis = await gc.analyzePressure();
      }
      
      // Map strategy names to GCStrategy constants
      const strategyMap = {
        auto: GCStrategy.AUTO,
        aggressive: GCStrategy.AGGRESSIVE,
        memory: GCStrategy.MEMORY_PRESSURE,
        disk: GCStrategy.DISK_PRESSURE,
        templates: GCStrategy.TEMPLATE_CLEANUP,
        expired: GCStrategy.EXPIRED_ONLY,
        lru: GCStrategy.LRU,
        size: GCStrategy.SIZE_BASED,
        access: GCStrategy.ACCESS_BASED
      };
      
      const strategy = strategyMap[args.strategy] || GCStrategy.AUTO;
      
      // List candidates if dry run
      let candidates = null;
      if (args.dryRun) {
        candidates = await gc.listCandidates(strategy);
      }
      
      // Perform garbage collection
      const collectionResult = await gc.collect(strategy, { dryRun: args.dryRun });
      
      // Get final statistics
      const cacheStats = cache.getStatistics();
      const gcStats = gc.getStatistics();
      
      const duration = Date.now() - startTime;
      
      const result = success({
        operation: 'gc',
        status: 'completed',
        strategy: args.strategy,
        cache: {
          directory: cacheConfig.cacheDir,
          before_collection: analysis?.cache_state || null,
          after_collection: {
            entries: cacheStats.entries,
            size: cacheStats.size,
            health: cacheStats.health
          }
        },
        collection: {
          strategy: collectionResult.strategy,
          total_collected: collectionResult.total_collected,
          bytes_freed: collectionResult.bytes_freed,
          candidates_identified: candidates?.total || collectionResult.candidates_identified,
          collection_efficiency: collectionResult.collection_efficiency,
          breakdown: collectionResult.collection_breakdown
        },
        analysis: analysis || null,
        candidates: args.dryRun ? candidates : null,
        gc_statistics: {
          total_collections: gcStats.total_collections,
          collection_frequency: gcStats.collection_frequency,
          cache_efficiency: gcStats.cache_efficiency
        },
        metrics: {
          durationMs: duration,
          bytes_freed_formatted: cache._formatBytes(collectionResult.bytes_freed)
        },
        dryRun: args.dryRun || false
      });
      
      output(result, args.format);
      
      // Cleanup
      await gc.shutdown();
      await cache.shutdown();
      
    } catch (err) {
      const result = error(err.message, 'GC_FAILED', {
        strategy: args.strategy,
        dryRun: args.dryRun,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});