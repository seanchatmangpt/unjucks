/**
 * Cache Purge Command
 * 
 * Clear entire cache or specific entries by pattern.
 * Nuclear option for cache management in autonomous systems.
 */

import { defineCommand } from 'citty';
import { existsSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'purge',
    description: 'Clear entire cache or specific entries'
  },
  args: {
    all: {
      type: 'boolean',
      description: 'Purge entire cache directory',
      alias: 'a'
    },
    pattern: {
      type: 'string',
      description: 'Hash pattern/prefix to match for deletion',
      alias: 'p'
    },
    older: {
      type: 'string',
      description: 'Purge entries older than duration (e.g., 30d, 7d)',
      alias: 'o'
    },
    larger: {
      type: 'string',
      description: 'Purge entries larger than size (e.g., 100MB, 1GB)',
      alias: 'l'
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview what would be deleted without actually deleting',
      alias: 'dry'
    },
    force: {
      type: 'boolean',
      description: 'Skip confirmation prompt',
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
      const startTime = this.getDeterministicTimestamp();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Get cache directory
      const cacheDir = resolve(config.directories.cache);
      
      if (!existsSync(cacheDir)) {
        const result = success({
          operation: 'purge',
          status: 'no_cache',
          message: 'Cache directory does not exist',
          cacheDir,
          deleted: { files: 0, bytes: 0 }
        });
        
        output(result, args.format);
        return;
      }
      
      // Validate arguments
      if (!args.all && !args.pattern && !args.older && !args.larger) {
        throw new Error('Must specify --all, --pattern, --older, or --larger');
      }
      
      let toDelete = [];
      let totalDeleted = 0;
      let bytesDeleted = 0;
      
      if (args.all) {
        // Purge entire cache directory
        const files = readdirSync(cacheDir, { withFileTypes: true });
        
        for (const file of files) {
          if (file.isFile() && !file.name.startsWith('.')) {
            const filePath = join(cacheDir, file.name);
            const stats = require('fs').statSync(filePath);
            
            toDelete.push({
              path: filePath,
              hash: file.name,
              size: stats.size,
              reason: 'all'
            });
          }
        }
        
      } else {
        // Selective purging
        const files = readdirSync(cacheDir, { withFileTypes: true });
        const now = this.getDeterministicTimestamp();
        
        for (const file of files) {
          if (file.isFile() && !file.name.startsWith('.')) {
            const filePath = join(cacheDir, file.name);
            const stats = require('fs').statSync(filePath);
            
            let shouldDelete = false;
            let reason = '';
            
            // Check pattern match
            if (args.pattern && file.name.startsWith(args.pattern)) {
              shouldDelete = true;
              reason = 'pattern';
            }
            
            // Check age
            if (args.older) {
              const maxAge = require('../../lib/utils.js').parseDuration(args.older);
              const age = now - stats.birthtime.getTime();
              if (age > maxAge) {
                shouldDelete = true;
                reason = reason ? `${reason},age` : 'age';
              }
            }
            
            // Check size
            if (args.larger) {
              const maxSize = require('../../lib/utils.js').parseSize(args.larger);
              if (stats.size > maxSize) {
                shouldDelete = true;
                reason = reason ? `${reason},size` : 'size';
              }
            }
            
            if (shouldDelete) {
              toDelete.push({
                path: filePath,
                hash: file.name,
                size: stats.size,
                age: now - stats.birthtime.getTime(),
                reason
              });
            }
          }
        }
      }
      
      // Calculate deletion stats
      bytesDeleted = toDelete.reduce((sum, entry) => sum + entry.size, 0);
      
      // Perform deletion (unless dry run)
      if (!args.dryRun) {
        if (args.all && !args.force) {
          // In a real CLI, this would prompt for confirmation
          // For autonomous agents, we require explicit --force
          throw new Error('Purging entire cache requires --force flag');
        }
        
        for (const entry of toDelete) {
          try {
            unlinkSync(entry.path);
            totalDeleted++;
          } catch (e) {
            // File might have been deleted by another process
            console.warn(`Warning: Could not delete ${entry.path}: ${e.message}`);
          }
        }
        
        // If purging all, also remove any remaining dot files
        if (args.all && args.force) {
          try {
            const remainingFiles = readdirSync(cacheDir);
            for (const file of remainingFiles) {
              if (file.startsWith('.')) {
                unlinkSync(join(cacheDir, file));
              }
            }
          } catch (e) {
            // Non-critical
          }
        }
      }
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      const result = success({
        operation: 'purge',
        status: 'completed',
        criteria: {
          all: args.all,
          pattern: args.pattern,
          older: args.older,
          larger: args.larger
        },
        cache: {
          directory: cacheDir
        },
        deleted: {
          files: args.dryRun ? toDelete.length : totalDeleted,
          bytes: bytesDeleted,
          bytesHuman: formatBytes(bytesDeleted),
          entries: args.dryRun ? toDelete.map(e => ({
            hash: e.hash.substring(0, 12),
            size: formatBytes(e.size),
            reason: e.reason,
            age: e.age ? formatAge(e.age) : undefined
          })) : undefined
        },
        metrics: {
          durationMs: duration,
          spaceFreed: bytesDeleted
        },
        dryRun: args.dryRun || false
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'PURGE_FAILED', {
        cacheDir: config?.directories?.cache,
        criteria: {
          all: args.all,
          pattern: args.pattern,
          older: args.older,
          larger: args.larger
        },
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Format bytes into human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format age duration into human-readable string
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted string
 */
function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}