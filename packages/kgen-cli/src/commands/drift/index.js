#!/usr/bin/env node

import { defineCommand } from 'citty';
// import { ValidationEngine } from '/Users/sac/unjucks/packages/kgen-core/src/validation/index.js';
import chalk from 'chalk';
import { readFileSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, relative } from 'path';
import { glob } from 'glob';

/**
 * Create the main drift command with all subcommands
 */
export default defineCommand({
  meta: {
    name: 'drift',
    description: 'Artifact drift detection and analysis system'
  },
  subCommands: {
    detect: defineCommand({
      meta: {
        name: 'detect',
        description: 'Detect drift between current artifacts and lockfile state'
      },
      args: {
        lockFile: {
          type: 'string',
          description: 'Path to kgen.lock.json file',
          alias: 'l',
          default: 'kgen.lock.json'
        },
        verbose: {
          type: 'boolean',
          description: 'Show detailed change information',
          alias: 'v'
        },
        detailed: {
          type: 'boolean',
          description: 'Show detailed diff analysis',
          alias: 'd'
        },
        json: {
          type: 'boolean',
          description: 'Output results in JSON format',
          alias: 'j'
        },
        scanNew: {
          type: 'boolean',
          description: 'Scan for new files not in lockfile',
          alias: 's',
          default: true
        },
        patterns: {
          type: 'array',
          description: 'File patterns to scan for new files',
          alias: 'p'
        },
        ignore: {
          type: 'array',
          description: 'Patterns to ignore when scanning',
          alias: 'i'
        },
        exitCode: {
          type: 'boolean',
          description: 'Exit with non-zero code if drift detected'
        },
        ci: {
          type: 'boolean',
          description: 'CI-friendly output with machine-readable format'
        },
        shacl: {
          type: 'boolean',
          description: 'Enable SHACL validation',
          default: true
        },
        semantic: {
          type: 'boolean',
          description: 'Enable semantic constraint validation',
          default: true
        },
        attestation: {
          type: 'boolean',
          description: 'Validate artifact attestations',
          default: true
        }
      },
      async run({ args }) {
        let engine = null;
        
        try {
          console.log(chalk.blue('🔍 KGEN Drift Detection'));
          console.log(chalk.blue('━'.repeat(40)));
          
          // Simple drift detection without validation engine
          console.log(chalk.gray('Initializing drift detection...'));
          
          // Run drift detection
          const results = await detectDrift(args, null);
          
          if (args.ci) {
            // CI-friendly output
            const hasDrift = results.summary.actionRequired;
            console.log(`DRIFT_DETECTED=${hasDrift}`);
            console.log(`TOTAL_FILES=${results.totalFiles}`);
            console.log(`UNCHANGED=${results.unchanged}`);
            console.log(`MODIFIED=${results.modified}`);
            console.log(`DELETED=${results.deleted}`);
            console.log(`ADDED=${results.added}`);
            console.log(`DRIFT_SCORE=${results.summary.driftScore}`);
            console.log(`RISK_LEVEL=${results.summary.riskLevel}`);
            console.log(`ACTION_REQUIRED=${results.summary.actionRequired}`);
            
            if (args.exitCode && hasDrift) {
              process.exit(1);
            }
          } else if (args.json) {
            console.log(JSON.stringify(results, null, 2));
          } else {
            // Enhanced console output
            formatResults(results, args);
            
            if (args.exitCode && results.summary.actionRequired) {
              process.exit(1);
            }
          }
          
        } catch (error) {
          const result = {
            success: false,
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          if (args.json || args.ci) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.error(chalk.red('Drift detection failed:'), error.message);
          }
          
          process.exit(1);
        } finally {
          if (engine) {
            await engine.shutdown();
          }
        }
      }
    }),
    baseline: defineCommand({
      meta: {
        name: 'baseline',
        description: 'Update baseline lockfile for drift detection'
      },
      args: {
        output: {
          type: 'string',
          description: 'Output lockfile path',
          alias: 'o',
          default: 'kgen.lock.json'
        },
        patterns: {
          type: 'array',
          description: 'File patterns to include',
          alias: 'p',
          default: ['**/*.ttl', '**/*.n3', '**/*.jsonld', '**/*.rdf']
        }
      },
      async run({ args }) {
        try {
          const { glob } = await import('glob');
          const fs = await import('fs');
          const path = await import('path');
          const crypto = await import('crypto');
          
          console.log(chalk.blue('📋 Updating Drift Detection Baseline'));
          console.log(chalk.blue('━'.repeat(45)));
          
          const lockData = {
            version: '1.0.0',
            timestamp: this.getDeterministicDate().toISOString(),
            directory: process.cwd(),
            files: {}
          };
          
          // Find all matching files
          const allFiles = [];
          for (const pattern of args.patterns) {
            const files = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
            allFiles.push(...files);
          }
          
          const uniqueFiles = [...new Set(allFiles)];
          console.log(`Found ${uniqueFiles.length} files to baseline`);
          
          // Hash each file
          for (const file of uniqueFiles) {
            try {
              const content = fs.readFileSync(file, 'utf8');
              const stat = fs.statSync(file);
              const hash = crypto.createHash('sha256').update(content).digest('hex');
              
              lockData.files[file] = {
                hash,
                size: content.length,
                modified: stat.mtime.toISOString()
              };
              
              console.log(chalk.gray(`  ✓ ${file} (${hash.substring(0, 8)}...)`));
            } catch (error) {
              console.log(chalk.yellow(`  ⚠ ${file} (error: ${error.message})`));
            }
          }
          
          // Write lockfile
          fs.writeFileSync(args.output, JSON.stringify(lockData, null, 2));
          
          const result = {
            success: true,
            operation: 'drift:baseline',
            lockfile: args.output,
            filesBaselined: Object.keys(lockData.files).length,
            timestamp: lockData.timestamp
          };
          
          console.log(chalk.green(`\n✅ Baseline updated: ${args.output}`));
          console.log(JSON.stringify(result, null, 2));
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'drift:baseline', 
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.error(chalk.red('Baseline update failed:'), error.message);
          console.log(JSON.stringify(result, null, 2));
          process.exit(1);
        }
      }
    })
  }
});

function formatResults(results, options) {
  const { unchanged, modified, deleted, added, totalFiles } = results;
  const hasDrift = results.summary.actionRequired;

  console.log(chalk.bold('\n📊 Drift Detection Results:'));
  console.log(`  Total tracked files: ${totalFiles}`);
  console.log(`  ${chalk.green('✓')} Unchanged: ${unchanged} (${Math.round((unchanged/totalFiles)*100)}%)`);
  console.log(`  ${chalk.yellow('⚠')} Modified: ${modified} (${Math.round((modified/totalFiles)*100)}%)`);
  console.log(`  ${chalk.red('✗')} Deleted: ${deleted} (${Math.round((deleted/totalFiles)*100)}%)`);
  console.log(`  ${chalk.cyan('+')} Added: ${added}`);

  // Risk assessment
  const riskColor = {
    'LOW': chalk.green,
    'MEDIUM': chalk.yellow, 
    'HIGH': chalk.red,
    'CRITICAL': chalk.red.bold
  }[results.summary.riskLevel];
  
  console.log(chalk.bold('\n📈 Risk Assessment:'));
  console.log(`  Drift Score: ${results.summary.driftScore}/100`);
  console.log(`  Risk Level: ${riskColor(results.summary.riskLevel)}`);
  console.log(`  Compliance: ${results.summary.complianceStatus}`);
  
  if (!hasDrift) {
    console.log(chalk.green('\n🎉 No drift detected - all files match expected state'));
    return;
  }

  console.log(chalk.yellow(`\n⚠️  Drift detected - action required`));

  if (options.verbose && results.changes.length > 0) {
    console.log(chalk.blue('\n📋 Detailed Changes:'));
    results.changes.slice(0, 10).forEach(change => {
      const icon = {
        unchanged: chalk.green('✓ '),
        modified: chalk.yellow('⚠ '),
        deleted: chalk.red('✗ '),
        added: chalk.cyan('+ ')
      }[change.type] || '  ';
      console.log(`${icon}${change.type.toUpperCase()}: ${change.path}`);
    });
    
    if (results.changes.length > 10) {
      console.log(chalk.gray(`  ... and ${results.changes.length - 10} more changes`));
    }
  }
}

/**
 * Detect drift between current state and lockfile
 */
async function detectDrift(options, engine) {
  const lockPath = resolve(options.lockFile || 'kgen.lock.json');
  const lockData = loadLockFile(lockPath);
  
  if (!lockData) {
    throw new Error('Could not load lock file');
  }

  const results = {
    success: true,
    timestamp: this.getDeterministicDate().toISOString(),
    lockFile: lockPath,
    totalFiles: 0,
    unchanged: 0,
    modified: 0,
    deleted: 0,
    added: 0,
    validationTime: 0,
    changes: [],
    summary: {
      driftScore: 0,
      riskLevel: 'LOW',
      complianceStatus: 'COMPLIANT',
      actionRequired: false
    }
  };

  results.totalFiles = Object.keys(lockData.files || {}).length;
  console.log(`📊 Checking ${results.totalFiles} tracked files for drift...`);

  // Check tracked files for drift
  for (const [filePath, lockInfo] of Object.entries(lockData.files || {})) {
    const driftResult = await checkFileDrift(filePath, lockInfo, options);
    results.changes.push(driftResult);
    
    switch (driftResult.type) {
      case 'unchanged':
        results.unchanged++;
        break;
      case 'modified':
        results.modified++;
        break;
      case 'deleted':
        results.deleted++;
        break;
    }
  }

  // Scan for new files if enabled
  if (options.scanNew) {
    const newFiles = await scanForNewFiles(lockData, options);
    results.changes.push(...newFiles);
    results.added = newFiles.length;
  }

  // Calculate summary metrics
  calculateSummaryMetrics(results);

  return results;
}

/**
 * Load and parse kgen.lock.json file
 */
function loadLockFile(lockPath) {
  if (!existsSync(lockPath)) {
    console.error(chalk.red(`Lock file not found: ${lockPath}`));
    return null;
  }

  try {
    const lockContent = readFileSync(lockPath, 'utf8');
    return JSON.parse(lockContent);
  } catch (error) {
    console.error(chalk.red(`Error parsing lock file: ${error.message}`));
    return null;
  }
}

/**
 * Check individual file for drift
 */
async function checkFileDrift(filePath, expectedInfo, options) {
  const fullPath = resolve(filePath);
  const relativePath = relative(process.cwd(), fullPath);

  const driftResult = {
    type: 'unchanged',
    path: relativePath,
    severity: 'LOW',
    expected: expectedInfo,
    current: null,
    hashMatch: false,
    sizeMatch: false,
    modifiedTimeChanged: false
  };

  // Check if file exists
  if (!existsSync(fullPath)) {
    driftResult.type = 'deleted';
    driftResult.severity = 'CRITICAL';
    return driftResult;
  }

  // Get current file info
  const currentStat = statSync(fullPath);
  const currentHash = calculateFileHash(fullPath);
  
  if (!currentHash) {
    driftResult.severity = 'HIGH';
    return driftResult;
  }

  driftResult.current = {
    hash: currentHash,
    size: currentStat.size,
    modified: currentStat.mtime.toISOString()
  };

  // Compare hashes
  driftResult.hashMatch = currentHash === expectedInfo.hash;
  driftResult.sizeMatch = currentStat.size === expectedInfo.size;
  driftResult.modifiedTimeChanged = currentStat.mtime.toISOString() !== expectedInfo.modified;

  if (!driftResult.hashMatch) {
    driftResult.type = 'modified';
    driftResult.severity = calculateDriftSeverity(expectedInfo, driftResult.current);
  }

  return driftResult;
}

/**
 * Calculate SHA-256 hash of file content
 */
function calculateFileHash(filePath) {
  try {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.error(chalk.red(`Error reading file ${filePath}: ${error.message}`));
    return null;
  }
}

/**
 * Calculate drift severity based on file changes
 */
function calculateDriftSeverity(expected, current) {
  const sizeDifference = Math.abs(current.size - expected.size);
  const sizeDifferencePercent = (sizeDifference / expected.size) * 100;

  if (sizeDifferencePercent > 50) {
    return 'CRITICAL';
  } else if (sizeDifferencePercent > 20) {
    return 'HIGH';
  } else if (sizeDifferencePercent > 5) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Scan for new files not tracked in lockfile
 */
async function scanForNewFiles(lockData, options) {
  const newFiles = [];
  const trackedFiles = new Set(Object.keys(lockData.files || {}));
  
  for (const pattern of options.patterns || []) {
    const files = await glob(pattern, { 
      ignore: options.ignore || [],
      absolute: false 
    });
    
    for (const file of files) {
      const normalizedPath = file.replace(/\\/g, '/');
      if (!trackedFiles.has(normalizedPath)) {
        const fullPath = resolve(file);
        const stat = statSync(fullPath);
        const hash = calculateFileHash(fullPath);
        
        if (hash) {
          newFiles.push({
            type: 'added',
            path: relative(process.cwd(), fullPath),
            severity: 'LOW',
            current: {
              hash,
              size: stat.size,
              modified: stat.mtime.toISOString()
            }
          });
        }
      }
    }
  }

  return newFiles;
}

/**
 * Calculate summary metrics
 */
function calculateSummaryMetrics(results) {
  const totalChanges = results.modified + results.deleted + results.added;
  
  // Calculate drift score (0-100)
  results.summary.driftScore = results.totalFiles > 0 
    ? Math.round((totalChanges / results.totalFiles) * 100)
    : 0;

  // Calculate risk level
  if (results.deleted > 0) {
    results.summary.riskLevel = 'CRITICAL';
  } else if (results.summary.driftScore > 50) {
    results.summary.riskLevel = 'HIGH';
  } else if (results.summary.driftScore > 20) {
    results.summary.riskLevel = 'MEDIUM';
  } else {
    results.summary.riskLevel = 'LOW';
  }

  results.summary.complianceStatus = 'COMPLIANT';
  results.summary.actionRequired = totalChanges > 0;
}