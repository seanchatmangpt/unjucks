/**
 * KGEN CLI Commands for Content URI Management
 * 
 * Provides CLI interface for content:// URI operations:
 * - Store files as content-addressed URIs
 * - Resolve URIs to filesystem paths
 * - List stored content with filtering
 * - Migrate existing attestations to use content URIs
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { promises as fs } from 'fs';
import { join, resolve, extname } from 'path';
import { contentResolver } from '../cas/content-uri-resolver.js';
import { contentProvenanceIntegration } from '../cas/provenance-integration.js';
import { glob } from 'glob';

// Store file as content URI
export const storeCommand = defineCommand({
  meta: {
    name: 'store',
    description: 'Store file as content-addressed URI'
  },
  args: {
    input: {
      type: 'positional',
      description: 'Input file or directory to store',
      required: true
    },
    algorithm: {
      type: 'string',
      description: 'Hash algorithm to use',
      default: 'sha256',
      valueHint: 'sha256|sha512|blake2b|blake3'
    },
    'preserve-extension': {
      type: 'boolean',
      description: 'Preserve file extension in CAS storage',
      default: true
    },
    hardlink: {
      type: 'boolean',
      description: 'Create hardlinks to original files',
      default: true
    },
    metadata: {
      type: 'string',
      description: 'Additional metadata as JSON string'
    },
    recursive: {
      type: 'boolean',
      description: 'Process directories recursively',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be stored without actually storing'
    }
  },
  async run(ctx) {
    const { args } = ctx;
    
    try {
      await contentResolver.initialize();
      consola.info(`Storing content with algorithm: ${args.algorithm}`);
      
      const inputPath = resolve(args.input);
      const stat = await fs.stat(inputPath);
      const results = [];
      
      if (stat.isDirectory()) {
        if (!args.recursive) {
          consola.error('Input is directory but --recursive not specified');
          return;
        }
        
        // Process directory recursively
        const pattern = join(inputPath, '**/*');
        const files = await glob(pattern, { nodir: true });
        
        consola.info(`Found ${files.length} files to process`);
        
        for (const file of files) {
          const result = await processFile(file, args);
          results.push(result);
        }
      } else {
        // Process single file
        const result = await processFile(inputPath, args);
        results.push(result);
      }
      
      // Display results
      consola.success(`Processed ${results.length} files`);
      
      for (const result of results) {
        if (result.success) {
          consola.info(`${result.file}:`);
          consola.info(`  URI: ${result.uri}`);
          consola.info(`  Hash: ${result.hash}`);
          consola.info(`  Size: ${result.size} bytes`);
          consola.info(`  CAS Path: ${result.casPath}`);
          if (result.hardlinked) {
            consola.info(`  Hardlinked: yes`);
          }
          if (result.existed) {
            consola.info(`  Status: already exists`);
          } else {
            consola.info(`  Status: stored`);
          }
        } else {
          consola.error(`${result.file}: ${result.error}`);
        }
      }
      
      // Show statistics
      const stats = contentResolver.getStats();
      consola.box({
        title: 'Content URI Statistics',
        message: [
          `Total stored: ${stats.resolver.stores}`,
          `Cache hits: ${stats.resolver.cacheHits}`,
          `Hardlinks created: ${stats.resolver.hardlinkCreated}`,
          `Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`
        ].join('\n')
      });
      
    } catch (error) {
      consola.error('Store operation failed:', error.message);
      process.exit(1);
    }
  }
});

// Resolve content URI to filesystem path
export const resolveCommand = defineCommand({
  meta: {
    name: 'resolve',
    description: 'Resolve content URI to filesystem path'
  },
  args: {
    uri: {
      type: 'positional',
      description: 'Content URI to resolve',
      required: true
    },
    'verify-integrity': {
      type: 'boolean',
      description: 'Verify content integrity during resolution',
      default: true
    },
    'show-metadata': {
      type: 'boolean',
      description: 'Show stored metadata',
      default: false
    }
  },
  async run(ctx) {
    const { args } = ctx;
    
    try {
      await contentResolver.initialize();
      
      // Validate URI format
      const validation = contentResolver.validateContentURI(args.uri);
      if (!validation.valid) {
        consola.error(`Invalid content URI: ${validation.error}`);
        return;
      }
      
      // Resolve URI
      const resolved = await contentResolver.resolve(args.uri, {
        skipCache: false
      });
      
      consola.success(`Resolved: ${args.uri}`);
      consola.info(`Path: ${resolved.path}`);
      consola.info(`Hash: ${resolved.hash}`);
      consola.info(`Algorithm: ${resolved.algorithm}`);
      consola.info(`Size: ${resolved.size} bytes`);
      
      if (resolved.extension) {
        consola.info(`Extension: ${resolved.extension}`);
      }
      
      if (resolved.integrity) {
        if (resolved.integrity.valid) {
          consola.success(`Integrity: verified ✓`);
        } else {
          consola.warn(`Integrity: failed - ${resolved.integrity.error}`);
        }
      }
      
      if (args['show-metadata'] && resolved.metadata) {
        consola.info('Metadata:');
        console.log(JSON.stringify(resolved.metadata, null, 2));
      }
      
      consola.info(`Shard: ${resolved.shardDir}`);
      consola.info(`Cached: ${resolved.cached ? 'yes' : 'no'}`);
      
    } catch (error) {
      consola.error('Resolve operation failed:', error.message);
      process.exit(1);
    }
  }
});

// List stored content
export const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List stored content with optional filtering'
  },
  args: {
    algorithm: {
      type: 'string',
      description: 'Filter by hash algorithm'
    },
    extension: {
      type: 'string',
      description: 'Filter by file extension'
    },
    'min-size': {
      type: 'string',
      description: 'Minimum file size (e.g., 1kb, 10mb)'
    },
    'max-size': {
      type: 'string',
      description: 'Maximum file size (e.g., 1kb, 10mb)'
    },
    format: {
      type: 'string',
      description: 'Output format',
      default: 'table',
      valueHint: 'table|json|uris'
    },
    limit: {
      type: 'string',
      description: 'Limit number of results',
      default: '100'
    }
  },
  async run(ctx) {
    const { args } = ctx;
    
    try {
      await contentResolver.initialize();
      
      // Parse size arguments
      const filters = {
        algorithm: args.algorithm,
        extension: args.extension,
        minSize: args['min-size'] ? parseSize(args['min-size']) : undefined,
        maxSize: args['max-size'] ? parseSize(args['max-size']) : undefined
      };
      
      // Get content list
      const entries = await contentResolver.list(filters);
      const limit = parseInt(args.limit);
      const limitedEntries = entries.slice(0, limit);
      
      if (limitedEntries.length === 0) {
        consola.info('No content found matching filters');
        return;
      }
      
      consola.info(`Found ${entries.length} entries${limit < entries.length ? ` (showing first ${limit})` : ''}`);
      
      // Display results based on format
      switch (args.format) {
        case 'json':
          console.log(JSON.stringify(limitedEntries, null, 2));
          break;
          
        case 'uris':
          for (const entry of limitedEntries) {
            console.log(entry.uri);
          }
          break;
          
        case 'table':
        default:
          // Display as table
          console.log('');
          console.log('URI'.padEnd(50) + ' Size'.padEnd(12) + ' Extension'.padEnd(12) + 'Shard');
          console.log('-'.repeat(80));
          
          for (const entry of limitedEntries) {
            const uri = entry.uri.length > 47 ? entry.uri.substring(0, 44) + '...' : entry.uri;
            const size = formatSize(entry.size);
            const ext = entry.extension || '-';
            const shard = entry.shard;
            
            console.log(
              uri.padEnd(50) + 
              size.padEnd(12) + 
              ext.padEnd(12) + 
              shard
            );
          }
          break;
      }
      
    } catch (error) {
      consola.error('List operation failed:', error.message);
      process.exit(1);
    }
  }
});

// Migrate attestations to use content URIs
export const migrateCommand = defineCommand({
  meta: {
    name: 'migrate',
    description: 'Migrate existing attestations to use content URIs'
  },
  args: {
    path: {
      type: 'positional',
      description: 'Path to attestation file or directory',
      required: true
    },
    recursive: {
      type: 'boolean',
      description: 'Process directories recursively',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be migrated without making changes'
    },
    backup: {
      type: 'boolean',
      description: 'Create backup of original attestations',
      default: true
    }
  },
  async run(ctx) {
    const { args } = ctx;
    
    try {
      await contentProvenanceIntegration.initialize();
      
      const inputPath = resolve(args.path);
      const stat = await fs.stat(inputPath);
      let attestationFiles = [];
      
      if (stat.isDirectory()) {
        if (!args.recursive) {
          consola.error('Input is directory but --recursive not specified');
          return;
        }
        
        // Find all .attest.json files
        const pattern = join(inputPath, args.recursive ? '**/*.attest.json' : '*.attest.json');
        attestationFiles = await glob(pattern);
      } else if (inputPath.endsWith('.attest.json')) {
        attestationFiles = [inputPath];
      } else {
        consola.error('Input must be .attest.json file or directory containing them');
        return;
      }
      
      if (attestationFiles.length === 0) {
        consola.info('No attestation files found');
        return;
      }
      
      consola.info(`Found ${attestationFiles.length} attestation files to process`);
      
      const results = {
        migrated: [],
        skipped: [],
        errors: []
      };
      
      for (const file of attestationFiles) {
        try {
          // Create backup if requested
          if (args.backup && !args['dry-run']) {
            await fs.copyFile(file, `${file}.backup`);
          }
          
          const result = await contentProvenanceIntegration.migrateAttestationToContentURI(file, {
            dryRun: args['dry-run']
          });
          
          if (result.migrated) {
            results.migrated.push({ file, contentURI: result.contentURI });
            consola.success(`${args['dry-run'] ? '[DRY RUN] ' : ''}Migrated: ${file}`);
            consola.info(`  Content URI: ${result.contentURI}`);
          } else {
            results.skipped.push({ file, reason: result.reason });
            consola.info(`Skipped: ${file} (${result.reason})`);
          }
        } catch (error) {
          results.errors.push({ file, error: error.message });
          consola.error(`Failed: ${file} - ${error.message}`);
        }
      }
      
      // Summary
      consola.box({
        title: 'Migration Summary',
        message: [
          `Total files: ${attestationFiles.length}`,
          `Migrated: ${results.migrated.length}`,
          `Skipped: ${results.skipped.length}`,
          `Errors: ${results.errors.length}`,
          args['dry-run'] ? 'Mode: DRY RUN (no changes made)' : 'Mode: LIVE (changes applied)',
          args.backup && !args['dry-run'] ? 'Backups: created' : ''
        ].filter(Boolean).join('\n')
      });
      
    } catch (error) {
      consola.error('Migration operation failed:', error.message);
      process.exit(1);
    }
  }
});

// Show content URI statistics
export const statsCommand = defineCommand({
  meta: {
    name: 'stats',
    description: 'Show content URI system statistics'
  },
  args: {
    format: {
      type: 'string',
      description: 'Output format',
      default: 'summary',
      valueHint: 'summary|detailed|json'
    }
  },
  async run(ctx) {
    const { args } = ctx;
    
    try {
      await contentResolver.initialize();
      await contentProvenanceIntegration.initialize();
      
      const resolverStats = contentResolver.getStats();
      const integrationStats = contentProvenanceIntegration.getStats();
      
      switch (args.format) {
        case 'json':
          console.log(JSON.stringify({
            resolver: resolverStats,
            integration: integrationStats
          }, null, 2));
          break;
          
        case 'detailed':
          consola.info('Content URI Resolver Statistics:');
          console.log(JSON.stringify(resolverStats, null, 2));
          consola.info('\nProvenance Integration Statistics:');
          console.log(JSON.stringify(integrationStats, null, 2));
          break;
          
        case 'summary':
        default:
          consola.box({
            title: 'Content URI System Statistics',
            message: [
              'Resolver:',
              `  Total resolves: ${resolverStats.resolver.resolves}`,
              `  Total stores: ${resolverStats.resolver.stores}`,
              `  Cache hits: ${resolverStats.resolver.cacheHits}`,
              `  Cache hit rate: ${(resolverStats.cache.hitRate * 100).toFixed(1)}%`,
              `  Hardlinks created: ${resolverStats.resolver.hardlinkCreated}`,
              `  Integrity checks: ${resolverStats.resolver.integrityChecks}`,
              `  Errors: ${resolverStats.resolver.errors}`,
              '',
              'Integration:',
              `  Attestations with URIs: ${integrationStats.integration.attestationsWithContentURIs}`,
              `  Content items stored: ${integrationStats.integration.contentItemsStored}`,
              `  Provenance links created: ${integrationStats.integration.provenanceLinksCreated}`,
              `  Drift detections: ${integrationStats.integration.driftDetected}`,
              '',
              'Performance:',
              `  Error rate: ${(resolverStats.performance.errorRate * 100).toFixed(1)}%`,
              `  Hardlink rate: ${(resolverStats.performance.hardlinkRate * 100).toFixed(1)}%`,
              `  Content usage rate: ${(integrationStats.performance.contentUriUsageRate * 100).toFixed(1)}%`
            ].join('\n')
          });
          break;
      }
      
    } catch (error) {
      consola.error('Stats operation failed:', error.message);
      process.exit(1);
    }
  }
});

// Helper functions

async function processFile(filePath, args) {
  try {
    if (args['dry-run']) {
      const content = await fs.readFile(filePath);
      const hash = require('crypto').createHash(args.algorithm).update(content).digest('hex');
      
      return {
        success: true,
        file: filePath,
        uri: `content://${args.algorithm}/${hash}`,
        hash,
        size: content.length,
        casPath: '[dry-run]',
        hardlinked: args.hardlink,
        existed: false,
        dryRun: true
      };
    }
    
    const content = await fs.readFile(filePath);
    const metadata = args.metadata ? JSON.parse(args.metadata) : {};
    
    const result = await contentResolver.store(content, {
      algorithm: args.algorithm,
      extension: args['preserve-extension'] ? extname(filePath) : null,
      metadata: {
        originalPath: filePath,
        ...metadata
      },
      source: args.hardlink ? filePath : null
    });
    
    return {
      success: true,
      file: filePath,
      uri: result.uri,
      hash: result.hash,
      size: result.size,
      casPath: result.path,
      hardlinked: result.hardlinked,
      existed: result.existed
    };
    
  } catch (error) {
    return {
      success: false,
      file: filePath,
      error: error.message
    };
  }
}

function parseSize(sizeStr) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}gb`;
}

// Export main command that groups all subcommands
export const contentCommand = defineCommand({
  meta: {
    name: 'content',
    description: 'Content URI management commands'
  },
  subCommands: {
    store: storeCommand,
    resolve: resolveCommand,
    list: listCommand,
    migrate: migrateCommand,
    stats: statsCommand
  }
});

export default contentCommand;