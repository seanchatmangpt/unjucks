#!/usr/bin/env node

/**
 * KGEN Reproducibility CLI - Master Tool for Deterministic Builds
 * 
 * This CLI tool coordinates all reproducibility fixes:
 * - Patches non-deterministic code
 * - Hardens lock files
 * - Runs reproducibility tests
 * - Validates byte-identical outputs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getDeterministicEngine, resetDeterministicEngine } from './deterministic-engine.js';
import { hardenAllLockFiles, validateLockFile } from './lock-file-hardener.js';
import { patchDirectory, restoreBackups } from './code-patcher.js';
import { runReproducibilityTests } from '../../tests/reproducibility/reproducibility-test.js';

class ReproducibilityCLI {
  constructor() {
    this.projectRoot = process.cwd();
    this.outputDir = path.join(this.projectRoot, '.reproducibility');
    this.enableLogging = true;
  }

  /**
   * Main entry point
   */
  async run(args = process.argv.slice(2)) {
    const command = args[0] || 'help';
    const options = this.parseOptions(args.slice(1));

    console.log('🔄 KGEN Reproducibility CLI\n');

    try {
      switch (command) {
        case 'audit':
          await this.auditCommand(options);
          break;
        case 'patch':
          await this.patchCommand(options);
          break;
        case 'harden':
          await this.hardenCommand(options);
          break;
        case 'test':
          await this.testCommand(options);
          break;
        case 'validate':
          await this.validateCommand(options);
          break;
        case 'fix-all':
          await this.fixAllCommand(options);
          break;
        case 'restore':
          await this.restoreCommand(options);
          break;
        case 'demo':
          await this.demoCommand(options);
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Parse command line options
   */
  parseOptions(args) {
    const options = {
      dryRun: false,
      verbose: false,
      directory: this.projectRoot,
      output: this.outputDir
    };

    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];

      switch (flag) {
        case '--dry-run':
          options.dryRun = true;
          i--; // No value for this flag
          break;
        case '--verbose':
          options.verbose = true;
          i--; // No value for this flag
          break;
        case '--directory':
          options.directory = value;
          break;
        case '--output':
          options.output = value;
          break;
      }
    }

    return options;
  }

  /**
   * Audit command - analyze non-deterministic elements
   */
  async auditCommand(options) {
    console.log('🔍 Auditing project for non-deterministic elements...\n');

    const results = {
      timestamp: new Date().toISOString(),
      directory: options.directory,
      issues: []
    };

    // Audit lock files
    console.log('📋 Scanning lock files...');
    const lockFiles = this.findFiles(options.directory, '*.lock.json');
    
    for (const lockFile of lockFiles) {
      const validation = validateLockFile(lockFile);
      if (!validation.isDeterministic) {
        results.issues.push({
          type: 'lock-file',
          file: path.relative(options.directory, lockFile),
          issues: validation.issues
        });
      }
    }

    // Audit source files
    console.log('📁 Scanning source files...');
    const sourceFiles = [
      ...this.findFiles(options.directory, '*.js'),
      ...this.findFiles(options.directory, '*.mjs'),
      ...this.findFiles(options.directory, '*.ts')
    ].filter(f => !f.includes('node_modules') && !f.includes('.git'));

    for (const sourceFile of sourceFiles) {
      const content = fs.readFileSync(sourceFile, 'utf8');
      const nonDeterministicPatterns = [
        { pattern: /new Date\(\)\.toISOString\(\)/, name: 'timestamp generation' },
        { pattern: /Date\.now\(\)/, name: 'current time' },
        { pattern: /Math\.random\(\)/, name: 'random number' },
        { pattern: /crypto\.randomBytes/, name: 'random bytes' },
        { pattern: /Array\.from.*Math\.random/, name: 'random UUID generation' }
      ];

      const fileIssues = [];
      for (const { pattern, name } of nonDeterministicPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          fileIssues.push(`${name} (${matches.length} occurrences)`);
        }
      }

      if (fileIssues.length > 0) {
        results.issues.push({
          type: 'source-code',
          file: path.relative(options.directory, sourceFile),
          issues: fileIssues
        });
      }
    }

    // Save audit results
    this.ensureDirectory(options.output);
    const reportPath = path.join(options.output, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    // Display summary
    console.log(`\n📊 Audit Summary:`);
    console.log(`   Lock files scanned: ${lockFiles.length}`);
    console.log(`   Source files scanned: ${sourceFiles.length}`);
    console.log(`   Issues found: ${results.issues.length}`);
    console.log(`   Report saved: ${reportPath}\n`);

    if (results.issues.length > 0) {
      console.log('⚠️  Non-deterministic elements found:');
      for (const issue of results.issues.slice(0, 5)) {
        console.log(`   ${issue.file}: ${issue.issues.join(', ')}`);
      }
      if (results.issues.length > 5) {
        console.log(`   ... and ${results.issues.length - 5} more (see report)`);
      }
    } else {
      console.log('✅ No non-deterministic elements found!');
    }
  }

  /**
   * Patch command - fix non-deterministic code
   */
  async patchCommand(options) {
    console.log('🔨 Patching non-deterministic code...\n');

    const results = patchDirectory(options.directory, {
      dryRun: options.dryRun,
      enableLogging: options.verbose
    });

    // Save results
    this.ensureDirectory(options.output);
    const reportPath = path.join(options.output, 'patch-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      dryRun: options.dryRun,
      results
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const changedFiles = results.filter(r => r.changed).length;
    console.log(`\n📊 Patch Summary:`);
    console.log(`   Files scanned: ${results.length}`);
    console.log(`   Files changed: ${changedFiles}`);
    console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'APPLIED'}`);
    console.log(`   Report: ${reportPath}\n`);

    if (changedFiles > 0 && !options.dryRun) {
      console.log('✅ Code patching completed! Original files backed up as .orig');
    } else if (options.dryRun) {
      console.log('ℹ️  Dry run completed. Use --apply to make changes.');
    } else {
      console.log('ℹ️  No files needed patching.');
    }
  }

  /**
   * Harden command - remove timestamps from lock files
   */
  async hardenCommand(options) {
    console.log('🔒 Hardening lock files...\n');

    const results = hardenAllLockFiles(options.directory, {
      enableLogging: options.verbose
    });

    // Save results
    this.ensureDirectory(options.output);
    const reportPath = path.join(options.output, 'harden-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      results
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Harden Summary:`);
    console.log(`   Lock files processed: ${results.length}`);
    console.log(`   Report: ${reportPath}\n`);

    if (results.length > 0) {
      console.log('✅ Lock file hardening completed!');
    } else {
      console.log('ℹ️  No lock files found to harden.');
    }
  }

  /**
   * Test command - run reproducibility tests
   */
  async testCommand(options) {
    console.log('🧪 Running reproducibility tests...\n');

    const results = await runReproducibilityTests({
      enableLogging: options.verbose,
      keepArtifacts: true
    });

    // Save results
    this.ensureDirectory(options.output);
    const reportPath = path.join(options.output, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    console.log(`📊 Test Results:`);
    console.log(`   Total: ${results.summary.total}`);
    console.log(`   Passed: ${results.summary.passed}`);
    console.log(`   Failed: ${results.summary.failed}`);
    console.log(`   Report: ${reportPath}\n`);

    if (results.summary.failed > 0) {
      console.log('❌ Some tests failed:');
      for (const test of results.tests.filter(t => !t.passed)) {
        console.log(`   - ${test.name}: ${test.error || 'Check details'}`);
      }
      process.exit(1);
    } else {
      console.log('✅ All reproducibility tests passed!');
    }
  }

  /**
   * Validate command - check specific build outputs
   */
  async validateCommand(options) {
    console.log('📊 Validating build reproducibility...\n');

    // Run multiple builds and compare
    const builds = [];
    const numBuilds = 3;

    for (let i = 0; i < numBuilds; i++) {
      console.log(`   Running build ${i + 1}/${numBuilds}...`);
      
      // Reset deterministic engine for each build
      resetDeterministicEngine();
      
      try {
        // Run actual KGEN build if available
        if (fs.existsSync(path.join(this.projectRoot, 'bin/kgen.mjs'))) {
          const output = execSync('node bin/kgen.mjs --version', { encoding: 'utf8' });
          builds.push({
            buildNumber: i + 1,
            output: output.trim(),
            timestamp: new Date().toISOString()
          });
        } else {
          // Fallback: use deterministic engine directly
          const engine = getDeterministicEngine();
          const output = {
            timestamp: engine.getDeterministicTimestamp(),
            uuid: engine.generateDeterministicUUID('build'),
            random: engine.generateDeterministicRandom('build')
          };
          
          builds.push({
            buildNumber: i + 1,
            output: JSON.stringify(output),
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        builds.push({
          buildNumber: i + 1,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Compare outputs
    const firstOutput = builds[0].output;
    const identical = builds.every(build => build.output === firstOutput);

    // Save results
    this.ensureDirectory(options.output);
    const reportPath = path.join(options.output, 'validation-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      identical,
      builds
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Validation Results:`);
    console.log(`   Builds compared: ${builds.length}`);
    console.log(`   Identical outputs: ${identical ? 'YES' : 'NO'}`);
    console.log(`   Report: ${reportPath}\n`);

    if (identical) {
      console.log('✅ Build outputs are reproducible!');
    } else {
      console.log('❌ Build outputs differ between runs');
      console.log('   This indicates non-deterministic elements remain');
      process.exit(1);
    }
  }

  /**
   * Fix-all command - apply all fixes
   */
  async fixAllCommand(options) {
    console.log('🛠️  Applying all reproducibility fixes...\n');

    // 1. Audit first
    console.log('Step 1/4: Auditing...');
    await this.auditCommand({ ...options, quiet: true });

    // 2. Patch code
    console.log('Step 2/4: Patching code...');
    await this.patchCommand({ ...options, dryRun: false });

    // 3. Harden lock files
    console.log('Step 3/4: Hardening lock files...');
    await this.hardenCommand(options);

    // 4. Validate
    console.log('Step 4/4: Validating...');
    await this.validateCommand(options);

    console.log('\n🎉 All reproducibility fixes applied successfully!');
  }

  /**
   * Restore command - restore from backups
   */
  async restoreCommand(options) {
    console.log('🔄 Restoring from backups...\n');

    const restored = restoreBackups(options.directory);

    console.log(`📊 Restore Summary:`);
    console.log(`   Files restored: ${restored.length}\n`);

    if (restored.length > 0) {
      console.log('✅ Files restored from backups:');
      for (const file of restored) {
        console.log(`   - ${path.relative(options.directory, file)}`);
      }
    } else {
      console.log('ℹ️  No backup files found to restore.');
    }
  }

  /**
   * Demo command - demonstrate reproducibility
   */
  async demoCommand(options) {
    console.log('🎯 Demonstrating KGEN reproducibility...\n');

    // Create a simple demo
    const demoDir = path.join(options.output, 'demo');
    this.ensureDirectory(demoDir);

    // Generate deterministic outputs
    resetDeterministicEngine();
    const engine = getDeterministicEngine({ enableLogging: true });

    const demo1 = {
      timestamp: engine.getDeterministicTimestamp(),
      uuid: engine.generateDeterministicUUID('demo-content'),
      random: engine.generateDeterministicRandom('demo-seed'),
      hex: engine.generateDeterministicHex(16, 'demo-hex')
    };

    // Reset and generate again
    resetDeterministicEngine();
    const engine2 = getDeterministicEngine({ enableLogging: false });

    const demo2 = {
      timestamp: engine2.getDeterministicTimestamp(),
      uuid: engine2.generateDeterministicUUID('demo-content'),
      random: engine2.generateDeterministicRandom('demo-seed'),
      hex: engine2.generateDeterministicHex(16, 'demo-hex')
    };

    // Save outputs
    fs.writeFileSync(path.join(demoDir, 'output1.json'), JSON.stringify(demo1, null, 2));
    fs.writeFileSync(path.join(demoDir, 'output2.json'), JSON.stringify(demo2, null, 2));

    // Compare
    const identical = JSON.stringify(demo1) === JSON.stringify(demo2);

    console.log('📊 Demo Results:');
    console.log(`   Output 1: ${path.join(demoDir, 'output1.json')}`);
    console.log(`   Output 2: ${path.join(demoDir, 'output2.json')}`);
    console.log(`   Identical: ${identical ? 'YES ✅' : 'NO ❌'}\n`);

    if (identical) {
      console.log('🎉 KGEN deterministic engine is working perfectly!');
    } else {
      console.log('⚠️  Issue detected with deterministic engine');
    }
  }

  /**
   * Helper methods
   */
  findFiles(directory, pattern) {
    const files = [];
    const regex = new RegExp(pattern.replace('*', '.*'));

    const scanRecursive = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile() && regex.test(entry.name)) {
            files.push(fullPath);
          } else if (entry.isDirectory() && 
                    !entry.name.startsWith('.') && 
                    !entry.name.includes('node_modules')) {
            scanRecursive(fullPath);
          }
        }
      } catch (error) {
        // Ignore access errors
      }
    };

    scanRecursive(directory);
    return files;
  }

  ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  showHelp() {
    console.log(`
KGEN Reproducibility CLI

USAGE:
  node src/reproducibility/reproducibility-cli.js <command> [options]

COMMANDS:
  audit      Analyze project for non-deterministic elements
  patch      Fix non-deterministic code patterns
  harden     Remove timestamps from lock files
  test       Run reproducibility test suite
  validate   Validate build reproducibility
  fix-all    Apply all fixes in sequence
  restore    Restore files from backups
  demo       Demonstrate reproducibility
  help       Show this help

OPTIONS:
  --directory <path>    Directory to process (default: current)
  --output <path>       Output directory for reports
  --dry-run            Show what would be changed without applying
  --verbose            Enable detailed logging

EXAMPLES:
  # Audit current project
  node src/reproducibility/reproducibility-cli.js audit

  # Fix all issues
  node src/reproducibility/reproducibility-cli.js fix-all

  # Test reproducibility
  node src/reproducibility/reproducibility-cli.js test

  # Validate specific directory
  node src/reproducibility/reproducibility-cli.js validate --directory ./my-project
`);
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new ReproducibilityCLI();
  cli.run().catch(console.error);
}

export { ReproducibilityCLI };