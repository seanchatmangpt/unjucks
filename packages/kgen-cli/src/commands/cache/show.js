/**
 * Cache Show Command
 * 
 * Show detailed information about specific cache entry.
 * Essential for debugging cache behavior in autonomous systems.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { createHash } from 'crypto';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Show detailed information about cache entry'
  },
  args: {
    hash: {
      type: 'string',
      description: 'Hash of cache entry to show (full or partial)',
      required: true,
      alias: 'h'
    },
    content: {
      type: 'boolean',
      description: 'Include content preview',
      default: false,
      alias: 'c'
    },
    verify: {
      type: 'boolean',
      description: 'Verify content integrity',
      default: true,
      alias: 'v'
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
      
      // Get cache directory
      const cacheDir = resolve(config.directories.cache);
      
      if (!existsSync(cacheDir)) {
        throw new Error(`Cache directory not found: ${cacheDir}`);
      }
      
      // Find matching cache entry
      const entries = require('fs').readdirSync(cacheDir);
      const matchingEntries = entries.filter(entry => 
        entry.startsWith(args.hash) && !entry.startsWith('.')
      );
      
      if (matchingEntries.length === 0) {
        throw new Error(`No cache entry found matching hash: ${args.hash}`);
      }
      
      if (matchingEntries.length > 1) {
        throw new Error(`Hash prefix ${args.hash} matches multiple entries: ${matchingEntries.slice(0, 5).join(', ')}${matchingEntries.length > 5 ? '...' : ''}`);
      }
      
      const entryFile = matchingEntries[0];
      const entryPath = join(cacheDir, entryFile);
      const stats = statSync(entryPath);
      
      // Read and analyze content
      const content = readFileSync(entryPath, 'utf8');
      let contentPreview = null;
      let contentSample = null;
      
      if (args.content) {
        const lines = content.split('\n');
        contentPreview = {
          totalLines: lines.length,
          firstLines: lines.slice(0, 10),
          lastLines: lines.length > 20 ? lines.slice(-10) : [],
          truncated: lines.length > 20
        };
        
        // Safe content sample (first 500 chars)
        contentSample = content.length > 500 
          ? content.substring(0, 500) + '...'
          : content;
      }
      
      // Verify integrity if requested
      let integrity = null;
      if (args.verify) {
        const computedHash = createHash('sha256').update(content).digest('hex');
        const expectedHash = entryFile;
        
        integrity = {
          valid: computedHash === expectedHash,
          computedHash,
          expectedHash,
          algorithm: 'sha256'
        };
      }
      
      // Detect content type
      const contentType = detectContentType(content, entryFile);
      
      // Try to parse structured content
      let parsed = null;
      if (contentType.structured) {
        try {
          switch (contentType.format) {
            case 'json':
              parsed = JSON.parse(content);
              break;
            case 'yaml':
              parsed = require('yaml').parse(content);
              break;
          }
        } catch (e) {
          // Not valid structured content
          contentType.parseError = e.message;
        }
      }
      
      // Check for related files
      const relatedFiles = [];
      const accessLogPath = join(cacheDir, '.access.log');
      
      if (existsSync(accessLogPath)) {
        try {
          const accessLog = readFileSync(accessLogPath, 'utf8');
          const logEntries = accessLog
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => entry.hash === entryFile)
            .slice(-10); // Last 10 access records
            
          if (logEntries.length > 0) {
            relatedFiles.push({
              type: 'access_log',
              path: accessLogPath,
              entries: logEntries
            });
          }
        } catch (e) {
          // Access log parsing error is non-critical
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result = success({
        entry: {
          hash: entryFile,
          shortHash: entryFile.substring(0, 12),
          path: entryPath,
          found: true
        },
        file: {
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          accessed: stats.atime.toISOString(),
          age: Date.now() - stats.birthtime.getTime(),
          ageHuman: formatAge(Date.now() - stats.birthtime.getTime())
        },
        content: {
          type: contentType,
          length: content.length,
          preview: contentPreview,
          sample: args.content ? contentSample : null,
          parsed: parsed
        },
        integrity,
        related: relatedFiles,
        cache: {
          directory: cacheDir
        },
        metrics: {
          durationMs: duration
        }
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'CACHE_SHOW_FAILED', {
        hash: args.hash,
        cacheDir: config?.directories?.cache,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Detect content type and format
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @returns {object} Content type information
 */
function detectContentType(content) {
  const trimmed = content.trim();
  
  // JSON detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return {
      format: 'json',
      structured: true,
      binary: false,
      encoding: 'utf8'
    };
  }
  
  // YAML detection
  if (trimmed.includes('---') || /^\w+:\s*/.test(trimmed)) {
    return {
      format: 'yaml',
      structured: true,
      binary: false,
      encoding: 'utf8'
    };
  }
  
  // TTL/RDF detection
  if (trimmed.includes('@prefix') || trimmed.includes('@base') || 
      trimmed.includes('PREFIX') || trimmed.includes('BASE')) {
    return {
      format: 'turtle',
      structured: true,
      binary: false,
      encoding: 'utf8'
    };
  }
  
  // Binary detection
  const isBinary = content.includes('\0') || 
    Buffer.from(content, 'utf8').toString('utf8') !== content;
  
  return {
    format: isBinary ? 'binary' : 'text',
    structured: false,
    binary: isBinary,
    encoding: isBinary ? 'binary' : 'utf8'
  };
}

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