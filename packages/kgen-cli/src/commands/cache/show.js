/**
 * Cache Show Command
 * 
 * Show detailed information about cache entries and statistics
 * using the unified content-addressed cache system.
 */

import { defineCommand } from 'citty';
import { resolve } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig } from '../../lib/utils.js';
import { ContentAddressedCache } from '../../../../kgen-core/src/cache/content-addressable-cache.js';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Show cache statistics and optionally specific entries'
  },
  args: {
    key: {
      type: 'string',
      description: 'Specific cache key to show (optional)',
      alias: 'k'
    },
    layer: {
      type: 'string',
      description: 'Show entries from specific layer: memory|disk|template|all',
      default: 'all',
      alias: 'l'
    },
    stats: {
      type: 'boolean',
      description: 'Show detailed cache statistics',
      default: true,
      alias: 's'
    },
    entries: {
      type: 'boolean',
      description: 'List cache entries',
      default: false,
      alias: 'e'
    },
    limit: {
      type: 'number',
      description: 'Limit number of entries to show',
      default: 20,
      alias: 'n'
    },
    content: {
      type: 'boolean',
      description: 'Include content preview for specific entries',
      default: false,
      alias: 'c'
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
      const startTime = this.getDeterministicTimestamp();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Initialize cache system
      const cacheConfig = {
        cacheDir: resolve(config.directories?.cache || './cache'),
        ...config.cache
      };
      
      const cache = new ContentAddressedCache(cacheConfig);
      await cache.initialize();
      
      let result = {
        operation: 'show',
        status: 'success',
        cache: {
          directory: cacheConfig.cacheDir
        },
        metrics: {
          durationMs: 0
        }
      };
      
      // Show statistics if requested
      if (args.stats) {
        const statistics = cache.getStatistics();
        result.statistics = statistics;
      }
      
      // Show specific key if provided
      if (args.key) {
        try {
          const content = await cache.retrieve(args.key);
          const hasEntry = await cache.has(args.key);
          
          result.entry = {
            key: args.key,
            found: hasEntry,
            content: args.content ? content : null,
            content_preview: args.content && content ? 
              (typeof content === 'string' ? content.substring(0, 500) : JSON.stringify(content).substring(0, 500)) : null
          };
          
          if (!hasEntry) {
            result.status = 'not_found';
            result.message = `Cache entry not found for key: ${args.key}`;
          }
        } catch (error) {
          result.entry = {
            key: args.key,
            found: false,
            error: error.message
          };
        }
      }
      
      // List entries if requested
      if (args.entries) {
        const listOptions = {
          layer: args.layer === 'all' ? null : args.layer,
          limit: args.limit,
          sortBy: 'accessed_at',
          order: 'desc'
        };
        
        const entries = await cache.listEntries(listOptions);
        result.entries = {
          total: entries.length,
          limit: args.limit,
          layer: args.layer,
          items: entries
        };
      }
      
      const duration = this.getDeterministicTimestamp() - startTime;
      result.metrics.durationMs = duration;
      
      const successResult = success(result);
      output(successResult, args.format);
      
      // Cleanup
      await cache.shutdown();
      
    } catch (err) {
      const result = error(err.message, 'CACHE_SHOW_FAILED', {
        key: args.key,
        layer: args.layer,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});