/**
 * Cache List Command
 * 
 * List cache contents and provide detailed statistics.
 * Essential for monitoring cache usage in autonomous systems.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

import { success, error, output, paginated } from '../../lib/output.js';
import { loadKgenConfig } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'ls',
    description: 'List cache contents and statistics'
  },
  args: {
    sort: {
      type: 'string',
      description: 'Sort by: size|age|name|accessed',
      default: 'accessed',
      alias: 's'
    },
    order: {
      type: 'string',
      description: 'Sort order: asc|desc',
      default: 'desc',
      alias: 'ord'
    },
    limit: {
      type: 'number',
      description: 'Maximum entries to show',
      default: 50,
      alias: 'l'
    },
    page: {
      type: 'number',
      description: 'Page number for pagination',
      default: 1,
      alias: 'p'
    },
    filter: {
      type: 'string',
      description: 'Filter entries by hash prefix',
      alias: 'f'
    },
    details: {
      type: 'boolean',
      description: 'Show detailed information for each entry',
      alias: 'd'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'fmt'
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
          cache: {
            directory: cacheDir,
            exists: false,
            entries: [],
            statistics: {
              totalEntries: 0,
              totalSize: 0,
              averageSize: 0,
              oldestEntry: null,
              newestEntry: null
            }
          }
        });
        
        output(result, args.format);
        return;
      }
      
      // Scan cache directory
      const entries = [];
      const files = readdirSync(cacheDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && !file.name.startsWith('.')) {
          const filePath = join(cacheDir, file.name);
          const stats = statSync(filePath);
          
          const entry = {
            hash: file.name,
            shortHash: file.name.substring(0, 12),
            path: filePath,
            size: stats.size,
            sizeHuman: formatBytes(stats.size),
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
            age: this.getDeterministicTimestamp() - stats.birthtime.getTime(),
            ageHuman: formatAge(this.getDeterministicTimestamp() - stats.birthtime.getTime())
          };
          
          // Apply filter if specified
          if (!args.filter || entry.hash.startsWith(args.filter)) {
            entries.push(entry);
          }
        }
      }
      
      // Sort entries
      entries.sort((a, b) => {
        let aVal, bVal;
        
        switch (args.sort) {
          case 'size':
            aVal = a.size;
            bVal = b.size;
            break;
          case 'age':
            aVal = a.age;
            bVal = b.age;
            break;
          case 'name':
            aVal = a.hash;
            bVal = b.hash;
            break;
          default: // 'accessed'
            aVal = new Date(a.accessed).getTime();
            bVal = new Date(b.accessed).getTime();
        }
        
        if (args.order === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      // Calculate statistics
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      const averageSize = entries.length > 0 ? totalSize / entries.length : 0;
      
      let oldestEntry = null;
      let newestEntry = null;
      
      if (entries.length > 0) {
        const sortedByAge = [...entries].sort((a, b) => b.age - a.age);
        oldestEntry = {
          hash: sortedByAge[0].shortHash,
          age: sortedByAge[0].ageHuman,
          size: sortedByAge[0].sizeHuman
        };
        newestEntry = {
          hash: sortedByAge[sortedByAge.length - 1].shortHash,
          age: sortedByAge[sortedByAge.length - 1].ageHuman,
          size: sortedByAge[sortedByAge.length - 1].sizeHuman
        };
      }
      
      // Paginate results
      const startIndex = (args.page - 1) * args.limit;
      const endIndex = startIndex + args.limit;
      const pageEntries = entries.slice(startIndex, endIndex);
      
      // Format entries for output
      const formattedEntries = pageEntries.map(entry => {
        const base = {
          hash: entry.shortHash,
          size: entry.sizeHuman,
          age: entry.ageHuman,
          accessed: entry.accessed
        };
        
        if (args.details) {
          base.fullHash = entry.hash;
          base.path = entry.path;
          base.sizeBytes = entry.size;
          base.created = entry.created;
          base.modified = entry.modified;
        }
        
        return base;
      });
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      const result = paginated(
        formattedEntries,
        entries.length,
        args.page,
        args.limit
      );
      
      // Add cache statistics
      result.data.statistics = {
        totalEntries: entries.length,
        totalSize: formatBytes(totalSize),
        totalSizeBytes: totalSize,
        averageSize: formatBytes(averageSize),
        averageSizeBytes: Math.round(averageSize),
        oldestEntry,
        newestEntry,
        directory: cacheDir
      };
      
      // Add metadata
      result.metadata = {
        ...result.metadata,
        sort: args.sort,
        order: args.order,
        filter: args.filter,
        durationMs: duration
      };
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'CACHE_LIST_FAILED', {
        cacheDir: config?.directories?.cache,
        sort: args.sort,
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
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}