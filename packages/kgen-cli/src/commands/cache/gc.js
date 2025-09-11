/**
 * Cache Garbage Collection Command
 * 
 * Clean old and unused cache entries based on policy.
 * Essential for maintaining reasonable disk usage in autonomous systems.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, parseDuration, parseSize } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'gc',
    description: 'Run garbage collection to clean old cache entries'
  },
  args: {
    maxAge: {
      type: 'string',
      description: 'Maximum age for cache entries (e.g., 90d, 30d, 7d)',
      alias: 'age'
    },
    maxSize: {
      type: 'string',
      description: 'Maximum total cache size (e.g., 5GB, 1GB)',
      alias: 'size'
    },
    strategy: {
      type: 'string',
      description: 'GC strategy: lru|fifo|size',
      default: 'lru',
      alias: 's'
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview what would be deleted without actually deleting',
      alias: 'dry'
    },
    force: {
      type: 'boolean',
      description: 'Force deletion without confirmation',
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
      
      // Get cache directory and GC settings
      const cacheDir = resolve(config.directories.cache);
      const gcConfig = config.cache.gc;
      
      const maxAge = args.maxAge ? parseDuration(args.maxAge) : parseDuration(gcConfig.maxAge);
      const maxSize = args.maxSize ? parseSize(args.maxSize) : parseSize(gcConfig.maxSize);
      const strategy = args.strategy || gcConfig.strategy;
      
      if (!existsSync(cacheDir)) {
        const result = success({
          operation: 'gc',
          status: 'no_cache',
          message: 'Cache directory does not exist',
          cacheDir,
          deleted: { files: 0, bytes: 0 },
          remaining: { files: 0, bytes: 0 }
        });
        
        output(result, args.format);
        return;
      }
      
      // Scan cache directory
      const entries = scanCacheEntries(cacheDir);
      
      if (entries.length === 0) {
        const result = success({
          operation: 'gc',
          status: 'empty_cache',
          message: 'Cache is empty',
          cacheDir,
          deleted: { files: 0, bytes: 0 },
          remaining: { files: 0, bytes: 0 }
        });
        
        output(result, args.format);
        return;
      }
      
      // Calculate current cache stats
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      const now = Date.now();
      
      // Determine what to delete
      let toDelete = [];
      
      // Age-based cleanup
      const ageThreshold = now - maxAge;
      const oldEntries = entries.filter(entry => entry.accessed < ageThreshold);
      toDelete = [...toDelete, ...oldEntries];
      
      // Size-based cleanup if still over limit
      if (totalSize > maxSize) {
        const remainingEntries = entries.filter(entry => !toDelete.includes(entry));
        
        // Sort by strategy
        switch (strategy) {
          case 'lru':
            remainingEntries.sort((a, b) => a.accessed - b.accessed);
            break;
          case 'fifo':
            remainingEntries.sort((a, b) => a.created - b.created);
            break;
          case 'size':
            remainingEntries.sort((a, b) => b.size - a.size);
            break;
        }
        
        let currentSize = totalSize;
        for (const entry of remainingEntries) {
          if (currentSize <= maxSize) break;
          if (!toDelete.includes(entry)) {
            toDelete.push(entry);
            currentSize -= entry.size;
          }
        }
      }
      
      // Remove duplicates
      toDelete = [...new Set(toDelete)];
      
      // Calculate deletion stats
      const deletedBytes = toDelete.reduce((sum, entry) => sum + entry.size, 0);
      const remainingEntries = entries.filter(entry => !toDelete.includes(entry));
      const remainingBytes = remainingEntries.reduce((sum, entry) => sum + entry.size, 0);
      
      // Perform deletion (unless dry run)
      let actuallyDeleted = 0;
      if (!args.dryRun) {
        for (const entry of toDelete) {
          try {
            unlinkSync(entry.path);
            actuallyDeleted++;
            
            // Update access log if it exists
            updateAccessLog(cacheDir, entry.hash, 'deleted');
          } catch (e) {
            // File might have been deleted by another process
            console.warn(`Warning: Could not delete ${entry.path}: ${e.message}`);
          }
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result = success({
        operation: 'gc',
        status: 'completed',
        policy: {
          maxAge: args.maxAge || gcConfig.maxAge,
          maxSize: args.maxSize || gcConfig.maxSize,
          strategy
        },
        cache: {
          directory: cacheDir,
          totalEntries: entries.length
        },
        deleted: {
          files: args.dryRun ? toDelete.length : actuallyDeleted,
          bytes: deletedBytes,
          entries: args.dryRun ? toDelete.map(e => ({
            hash: e.hash,
            size: e.size,
            age: now - e.created,
            reason: e.accessed < ageThreshold ? 'age' : 'size'
          })) : undefined
        },
        remaining: {
          files: remainingEntries.length,
          bytes: remainingBytes
        },
        metrics: {
          durationMs: duration,
          spaceFreed: deletedBytes,
          compressionRatio: totalSize > 0 ? (deletedBytes / totalSize) : 0
        },
        dryRun: args.dryRun || false
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'GC_FAILED', {
        cacheDir: config?.directories?.cache,
        strategy: args.strategy,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Scan cache directory and collect entry information
 * @param {string} cacheDir - Cache directory path
 * @returns {Array} Array of cache entries
 */
function scanCacheEntries(cacheDir) {
  const entries = [];
  
  try {
    const files = readdirSync(cacheDir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile() && !file.name.startsWith('.')) {
        const filePath = join(cacheDir, file.name);
        const stats = statSync(filePath);
        
        entries.push({
          hash: file.name,
          path: filePath,
          size: stats.size,
          created: stats.birthtime.getTime(),
          modified: stats.mtime.getTime(),
          accessed: stats.atime.getTime()
        });
      }
    }
  } catch (e) {
    // Directory might be inaccessible
    console.warn(`Warning: Could not scan cache directory ${cacheDir}: ${e.message}`);
  }
  
  return entries;
}

/**
 * Update access log for cache entry
 * @param {string} cacheDir - Cache directory
 * @param {string} hash - Entry hash
 * @param {string} action - Action performed
 */
function updateAccessLog(cacheDir, hash, action) {
  const logPath = join(cacheDir, '.access.log');
  const logEntry = {
    timestamp: new Date().toISOString(),
    hash,
    action
  };
  
  try {
    // Append to log file
    const logLine = JSON.stringify(logEntry) + '\n';
    require('fs').appendFileSync(logPath, logLine);
  } catch (e) {
    // Log update is not critical
  }
}