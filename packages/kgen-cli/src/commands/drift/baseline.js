#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

/**
 * Create or update lockfile baseline
 * @param {Object} options - Baseline creation options
 * @returns {Object} Baseline creation results
 */
async function createBaseline(options) {
  const results = {
    success: true,
    lockFile: resolve(options.output),
    scannedFiles: 0,
    trackedFiles: 0,
    errors: [],
    warnings: []
  };

  try {
    console.log(chalk.blue('📋 Creating baseline lockfile...'));

    // Load existing lockfile if updating
    let existingLock = null;
    if (options.update && existsSync(results.lockFile)) {
      try {
        const content = readFileSync(results.lockFile, 'utf8');
        existingLock = JSON.parse(content);
        console.log(chalk.yellow(`  ↻ Updating existing lockfile (${Object.keys(existingLock.files || {}).length} files)`));
      } catch (error) {
        results.warnings.push(`Could not parse existing lockfile: ${error.message}`);
      }
    }

    // Determine file patterns to scan
    const patterns = options.patterns || [
      '**/*.ttl', '**/*.turtle',
      '**/*.n3',
      '**/*.jsonld', 
      '**/*.rdf',
      '**/templates/**/*',
      '**/rules/**/*',
      '**/schemas/**/*'
    ];

    const ignorePatterns = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.kgen/cache/**'
    ].concat(options.ignore || []);

    // Scan for files
    const allFiles = new Set();
    console.log(chalk.blue('🔍 Scanning for files...'));
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        ignore: ignorePatterns,
        dot: false // Don't include hidden files by default
      });
      files.forEach(file => allFiles.add(file));
    }

    results.scannedFiles = allFiles.size;
    console.log(chalk.green(`  ✓ Found ${results.scannedFiles} files`));

    // Process files
    const lockData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      directory: process.cwd(),
      files: {}
    };

    // Copy metadata from existing lock if updating
    if (existingLock) {
      lockData.project = existingLock.project;
      lockData.source = existingLock.source;
      lockData.dependencies = existingLock.dependencies;
      lockData.templates = existingLock.templates;
      lockData.rules = existingLock.rules;
      lockData.artifacts = existingLock.artifacts;
    }

    console.log(chalk.blue('⚡ Processing files...'));
    
    for (const file of allFiles) {
      try {
        const filePath = resolve(file);
        const relativePath = relative(process.cwd(), filePath);
        
        // Skip if file doesn't exist (broken symlink, etc.)
        if (!existsSync(filePath)) {
          results.warnings.push(`File not found: ${relativePath}`);
          continue;
        }

        const stat = statSync(filePath);
        
        // Skip directories
        if (stat.isDirectory()) {
          continue;
        }

        // Calculate hash
        const content = readFileSync(filePath);
        const hash = createHash('sha256').update(content).digest('hex');

        // Add to lockfile
        lockData.files[relativePath] = {
          hash,
          size: stat.size,
          modified: stat.mtime.toISOString()
        };

        results.trackedFiles++;
        
        if (options.verbose && results.trackedFiles % 10 === 0) {
          console.log(chalk.gray(`    Processed ${results.trackedFiles} files...`));
        }

      } catch (error) {
        results.errors.push(`Error processing ${file}: ${error.message}`);
      }
    }

    // Calculate integrity hash
    if (lockData.files && Object.keys(lockData.files).length > 0) {
      const sortedFiles = Object.keys(lockData.files).sort();
      const combinedHash = createHash('sha256');
      
      sortedFiles.forEach(file => {
        combinedHash.update(`${file}:${lockData.files[file].hash}`);
      });

      lockData.integrity = {
        combined: combinedHash.digest('hex'),
        files: Object.keys(lockData.files).length,
        timestamp: lockData.timestamp
      };
    }

    // Write lockfile
    console.log(chalk.blue('💾 Writing lockfile...'));
    const lockContent = JSON.stringify(lockData, null, 2);
    writeFileSync(results.lockFile, lockContent);

    console.log(chalk.green('✅ Baseline created successfully'));
    console.log(chalk.gray(`    Lockfile: ${results.lockFile}`));
    console.log(chalk.gray(`    Tracked files: ${results.trackedFiles}`));
    console.log(chalk.gray(`    Integrity hash: ${lockData.integrity?.combined.substring(0, 16)}...`));

  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Validate baseline against existing lockfile
 * @param {string} baselinePath - Path to baseline lockfile
 * @param {string} existingPath - Path to existing lockfile
 * @returns {Object} Validation results
 */
function validateBaseline(baselinePath, existingPath) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    differences: {
      added: [],
      removed: [],
      modified: []
    }
  };

  try {
    if (!existsSync(baselinePath)) {
      results.valid = false;
      results.errors.push(`Baseline file not found: ${baselinePath}`);
      return results;
    }

    if (!existsSync(existingPath)) {
      results.warnings.push(`No existing lockfile found: ${existingPath}`);
      return results;
    }

    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const existing = JSON.parse(readFileSync(existingPath, 'utf8'));

    const baselineFiles = new Set(Object.keys(baseline.files || {}));
    const existingFiles = new Set(Object.keys(existing.files || {}));

    // Find differences
    for (const file of baselineFiles) {
      if (!existingFiles.has(file)) {
        results.differences.added.push(file);
      } else if (baseline.files[file].hash !== existing.files[file].hash) {
        results.differences.modified.push({
          file,
          baseline: baseline.files[file],
          existing: existing.files[file]
        });
      }
    }

    for (const file of existingFiles) {
      if (!baselineFiles.has(file)) {
        results.differences.removed.push(file);
      }
    }

    // Check integrity
    if (baseline.integrity?.combined !== existing.integrity?.combined) {
      results.warnings.push('Overall integrity hash differs between baseline and existing lockfile');
    }

  } catch (error) {
    results.valid = false;
    results.errors.push(`Validation error: ${error.message}`);
  }

  return results;
}

/**
 * Create drift baseline command
 * @returns {Command} The configured drift baseline command
 */
export function createDriftBaselineCommand() {
  return new Command('baseline')
    .description('Create or update drift detection baseline (lockfile)')
    .option('-o, --output <file>', 'Output lockfile path', 'kgen.lock.json')
    .option('-u, --update', 'Update existing lockfile instead of creating new', false)
    .option('-p, --patterns <patterns...>', 'File patterns to include in baseline')
    .option('-i, --ignore <patterns...>', 'File patterns to ignore')
    .option('-v, --verbose', 'Show detailed progress information')
    .option('-f, --force', 'Overwrite existing lockfile without confirmation', false)
    .option('--validate <existing>', 'Validate new baseline against existing lockfile')
    .option('--dry-run', 'Show what would be included without creating lockfile', false)
    .action(async (options) => {
      try {
        const lockPath = resolve(options.output);

        // Check if lockfile exists and we're not updating
        if (existsSync(lockPath) && !options.update && !options.force && !options.dryRun) {
          console.error(chalk.red(`Lockfile already exists: ${lockPath}`));
          console.error(chalk.yellow('Use --update to update existing lockfile or --force to overwrite'));
          process.exit(1);
        }

        if (options.dryRun) {
          console.log(chalk.blue('🔍 Dry Run - Scanning files that would be included:'));
          console.log(chalk.blue('━'.repeat(50)));
        } else {
          console.log(chalk.blue('📋 KGEN Drift Baseline Creation'));
          console.log(chalk.blue('━'.repeat(35)));
        }

        // Create baseline
        const results = await createBaseline(options);

        if (!results.success) {
          console.error(chalk.red('Baseline creation failed:'));
          results.errors.forEach(error => {
            console.error(chalk.red(`  ✗ ${error}`));
          });
          process.exit(1);
        }

        // Show warnings
        if (results.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          results.warnings.forEach(warning => {
            console.log(chalk.yellow(`  ⚠ ${warning}`));
          });
        }

        // Validate against existing if requested
        if (options.validate) {
          console.log(chalk.blue('\n🔍 Validating baseline...'));
          const validation = validateBaseline(results.lockFile, resolve(options.validate));
          
          if (validation.valid) {
            console.log(chalk.green('✅ Baseline validation passed'));
          } else {
            console.log(chalk.red('❌ Baseline validation failed'));
            validation.errors.forEach(error => {
              console.log(chalk.red(`  ✗ ${error}`));
            });
          }

          if (validation.differences.added.length > 0) {
            console.log(chalk.cyan(`\n📁 Added files (${validation.differences.added.length}):`));
            validation.differences.added.slice(0, 10).forEach(file => {
              console.log(chalk.cyan(`  + ${file}`));
            });
            if (validation.differences.added.length > 10) {
              console.log(chalk.gray(`  ... and ${validation.differences.added.length - 10} more`));
            }
          }

          if (validation.differences.removed.length > 0) {
            console.log(chalk.red(`\n📁 Removed files (${validation.differences.removed.length}):`));
            validation.differences.removed.slice(0, 10).forEach(file => {
              console.log(chalk.red(`  - ${file}`));
            });
            if (validation.differences.removed.length > 10) {
              console.log(chalk.gray(`  ... and ${validation.differences.removed.length - 10} more`));
            }
          }

          if (validation.differences.modified.length > 0) {
            console.log(chalk.yellow(`\n📁 Modified files (${validation.differences.modified.length}):`));
            validation.differences.modified.slice(0, 10).forEach(diff => {
              console.log(chalk.yellow(`  ~ ${diff.file}`));
              console.log(chalk.gray(`    Old: ${diff.existing.hash.substring(0, 16)}...`));
              console.log(chalk.gray(`    New: ${diff.baseline.hash.substring(0, 16)}...`));
            });
            if (validation.differences.modified.length > 10) {
              console.log(chalk.gray(`  ... and ${validation.differences.modified.length - 10} more`));
            }
          }
        }

        // Summary
        console.log(chalk.blue('\n📊 Summary:'));
        console.log(`  Files scanned: ${results.scannedFiles}`);
        console.log(`  Files tracked: ${results.trackedFiles}`);
        console.log(`  Errors: ${results.errors.length}`);
        console.log(`  Warnings: ${results.warnings.length}`);

        if (!options.dryRun) {
          console.log(chalk.green(`\n✅ Baseline lockfile created: ${relative(process.cwd(), results.lockFile)}`));
          console.log(chalk.blue('\nNext steps:'));
          console.log(chalk.blue('  1. Commit the lockfile to version control'));
          console.log(chalk.blue('  2. Use "kgen drift detect" to check for changes'));
          console.log(chalk.blue('  3. Use "kgen drift report" for detailed analysis'));
        }

      } catch (error) {
        console.error(chalk.red('Baseline creation failed:'), error.message);
        process.exit(1);
      }
    });
}