#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
// Note: Import validation engine for advanced drift detection
// import { KGenValidationEngine } from '../../../kgen-core/src/validation/index.js';

/**
 * Calculate SHA-256 hash of file content
 * @param {string} filePath - Path to file
 * @returns {string} SHA-256 hash
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
 * Load kgen.lock.json file
 * @param {string} lockPath - Path to lock file
 * @returns {Object|null} Parsed lock file or null
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
 * Detect drift between current state and lock file
 * @param {Object} options - Detection options
 * @returns {Object} Drift detection results
 */
async function detectDrift(options) {
  const lockPath = resolve(options.lockFile || 'kgen.lock.json');
  const lockData = loadLockFile(lockPath);
  
  if (!lockData) {
    return { success: false, error: 'Could not load lock file' };
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
    changes: []
  };

  // Check files tracked in lock file
  if (lockData.files) {
    results.totalFiles = Object.keys(lockData.files).length;

    for (const [filePath, lockInfo] of Object.entries(lockData.files)) {
      const fullPath = resolve(filePath);
      const relativePath = relative(process.cwd(), fullPath);

      if (!existsSync(fullPath)) {
        results.deleted++;
        results.changes.push({
          type: 'deleted',
          path: relativePath,
          expected: lockInfo,
          current: null
        });
        continue;
      }

      const currentStat = statSync(fullPath);
      const currentHash = calculateFileHash(fullPath);
      
      if (!currentHash) {
        continue; // Skip files we can't read
      }

      const currentInfo = {
        hash: currentHash,
        size: currentStat.size,
        modified: currentStat.mtime.toISOString()
      };

      if (currentHash !== lockInfo.hash) {
        results.modified++;
        results.changes.push({
          type: 'modified',
          path: relativePath,
          expected: lockInfo,
          current: currentInfo,
          hashMatch: false,
          sizeMatch: currentStat.size === lockInfo.size,
          modifiedTimeChanged: currentStat.mtime.toISOString() !== lockInfo.modified
        });
      } else {
        results.unchanged++;
      }
    }
  }

  // Check for new files not in lock file
  if (options.scanNew) {
    const patterns = options.patterns || ['**/*.ttl', '**/*.n3', '**/*.jsonld', '**/*.rdf'];
    const currentFiles = new Set();
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { ignore: options.ignore || [] });
      files.forEach(file => currentFiles.add(resolve(file)));
    }

    const trackedFiles = new Set(Object.keys(lockData.files || {}).map(f => resolve(f)));
    
    for (const currentFile of currentFiles) {
      if (!trackedFiles.has(currentFile)) {
        const relativePath = relative(process.cwd(), currentFile);
        const stat = statSync(currentFile);
        const hash = calculateFileHash(currentFile);
        
        if (hash) {
          results.added++;
          results.changes.push({
            type: 'added',
            path: relativePath,
            expected: null,
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

  return results;
}

/**
 * Format drift detection results for display
 * @param {Object} results - Detection results
 * @param {Object} options - Display options
 */
function formatResults(results, options) {
  if (!results.success) {
    console.error(chalk.red('Drift detection failed:'), results.error);
    return;
  }

  const { unchanged, modified, deleted, added, totalFiles } = results;
  const hasDrift = modified > 0 || deleted > 0 || added > 0;

  console.log(chalk.blue('🔍 Drift Detection Results'));
  console.log(chalk.blue('━'.repeat(50)));
  console.log(`📊 Summary:`);
  console.log(`  Total tracked files: ${totalFiles}`);
  console.log(`  ${chalk.green('✓')} Unchanged: ${unchanged}`);
  console.log(`  ${chalk.yellow('⚠')} Modified: ${modified}`);
  console.log(`  ${chalk.red('✗')} Deleted: ${deleted}`);
  console.log(`  ${chalk.cyan('+')} Added: ${added}`);
  
  if (!hasDrift) {
    console.log(chalk.green('\n🎉 No drift detected - all files match expected state'));
    return;
  }

  console.log(chalk.yellow(`\n⚠️  Drift detected in ${modified + deleted + added} files`));

  if (options.verbose || options.detailed) {
    console.log(chalk.blue('\n📋 Detailed Changes:'));
    console.log(chalk.blue('━'.repeat(30)));

    results.changes.forEach(change => {
      const icon = {
        modified: chalk.yellow('⚠ '),
        deleted: chalk.red('✗ '),
        added: chalk.cyan('+ ')
      }[change.type];

      console.log(`${icon}${change.type.toUpperCase()}: ${change.path}`);
      
      if (change.type === 'modified') {
        console.log(`  Expected hash: ${change.expected.hash.substring(0, 16)}...`);
        console.log(`  Current hash:  ${change.current.hash.substring(0, 16)}...`);
        console.log(`  Size changed:  ${change.sizeMatch ? 'No' : 'Yes'} (${change.expected.size} → ${change.current.size})`);
        console.log(`  Time changed:  ${change.modifiedTimeChanged ? 'Yes' : 'No'}`);
      } else if (change.type === 'deleted') {
        console.log(`  Expected hash: ${change.expected.hash.substring(0, 16)}...`);
        console.log(`  Expected size: ${change.expected.size} bytes`);
      } else if (change.type === 'added') {
        console.log(`  Current hash:  ${change.current.hash.substring(0, 16)}...`);
        console.log(`  Current size:  ${change.current.size} bytes`);
      }
      console.log('');
    });
  }

  if (options.json) {
    console.log(chalk.blue('\n📄 JSON Output:'));
    console.log(JSON.stringify(results, null, 2));
  }
}

/**
 * Create drift detection command
 * @returns {Command} The configured drift detect command
 */
export function createDriftDetectCommand() {
  return new Command('detect')
    .description('Detect drift between current artifacts and lockfile state')
    .option('-l, --lock-file <path>', 'Path to kgen.lock.json file', 'kgen.lock.json')
    .option('-v, --verbose', 'Show detailed change information')
    .option('-d, --detailed', 'Show detailed diff analysis')
    .option('-j, --json', 'Output results in JSON format')
    .option('-s, --scan-new', 'Scan for new files not in lockfile', false)
    .option('-p, --patterns <patterns...>', 'File patterns to scan for new files')
    .option('-i, --ignore <patterns...>', 'Patterns to ignore when scanning')
    .option('--exit-code', 'Exit with non-zero code if drift detected', false)
    .option('--ci', 'CI-friendly output with machine-readable format', false)
    .action(async (options) => {
      try {
        const results = await detectDrift(options);
        
        if (options.ci) {
          // CI-friendly output
          const hasDrift = results.modified > 0 || results.deleted > 0 || results.added > 0;
          console.log(`DRIFT_DETECTED=${hasDrift}`);
          console.log(`TOTAL_FILES=${results.totalFiles}`);
          console.log(`UNCHANGED=${results.unchanged}`);
          console.log(`MODIFIED=${results.modified}`);
          console.log(`DELETED=${results.deleted}`);
          console.log(`ADDED=${results.added}`);
          
          if (options.exitCode && hasDrift) {
            process.exit(1);
          }
        } else {
          formatResults(results, options);
          
          if (options.exitCode && (results.modified > 0 || results.deleted > 0 || results.added > 0)) {
            process.exit(1);
          }
        }
      } catch (error) {
        console.error(chalk.red('Error during drift detection:'), error.message);
        process.exit(1);
      }
    });
}