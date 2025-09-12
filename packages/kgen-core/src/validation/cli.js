#!/usr/bin/env node

/**
 * KGEN Validation CLI
 * Command-line interface for validation engine with CI/CD integration
 */

import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import fs from 'fs-extra';
import path from 'path';
import { KGenValidationEngine, ValidationExitCodes } from './index.js';

const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Run KGEN validation with drift detection and SHACL validation'
  },
  args: {
    data: {
      type: 'string',
      description: 'Path to RDF data file or directory'
    },
    shapes: {
      type: 'string',
      description: 'Path to SHACL shapes file'
    },
    target: {
      type: 'string',
      description: 'Target file path for drift detection'
    },
    expected: {
      type: 'string',
      description: 'Expected data for drift comparison'
    },
    config: {
      type: 'string',
      description: 'Path to validation configuration file'
    },
    'auto-fix': {
      type: 'boolean',
      description: 'Enable automatic drift fixing'
    },
    'strict-mode': {
      type: 'boolean',
      description: 'Enable strict validation mode'
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for validation reports',
      default: './validation-reports'
    },
    'format': {
      type: 'string',
      description: 'Data format (turtle, rdf/xml, n-triples, json-ld)',
      default: 'turtle'
    },
    'exit-on-violations': {
      type: 'boolean',
      description: 'Exit with code 3 on violations (CI/CD mode)',
      default: true
    },
    'quiet': {
      type: 'boolean',
      description: 'Suppress non-essential output'
    },
    'verbose': {
      type: 'boolean',
      description: 'Enable verbose logging'
    }
  },
  async run({ args }) {
    try {
      // Configure logging
      if (args.quiet) {
        consola.level = 1; // Errors only
      } else if (args.verbose) {
        consola.level = 5; // Debug
      }

      // Load configuration
      const config = await loadConfiguration(args);
      
      // Initialize validation engine
      const engine = new KGenValidationEngine(config);
      await engine.initialize();

      // Prepare validation options
      const validationOptions = {
        dataGraph: args.data ? await fs.readFile(args.data, 'utf8') : null,
        shapesGraph: args.shapes ? await fs.readFile(args.shapes, 'utf8') : null,
        targetPath: args.target,
        expectedData: args.expected ? await fs.readFile(args.expected, 'utf8') : null,
        validationOptions: {
          dataFormat: args.format,
          shapesFormat: args.format,
          checkOWLConstraints: true
        }
      };

      // Run validation
      consola.start('🚀 Starting KGEN validation...');
      const results = await engine.validateWithDriftDetection(validationOptions);

      // Display results
      displayResults(results, args);

      // Shutdown engine
      await engine.shutdown();

      // Exit with appropriate code for CI/CD
      if (args['exit-on-violations']) {
        process.exit(results.exitCode);
      }

      return results;

    } catch (error) {
      consola.error('❌ Validation failed:', error.message);
      if (args.verbose) {
        consola.error(error.stack);
      }
      process.exit(ValidationExitCodes.ERRORS);
    }
  }
});

const artifactDriftCommand = defineCommand({
  meta: {
    name: 'drift',
    description: 'Enhanced drift detection with 100% unauthorized modification detection and fail/warn/fix modes'
  },
  args: {
    target: {
      type: 'string',
      description: 'Target file path for drift detection',
      required: true
    },
    expected: {
      type: 'string',
      description: 'Expected data file for comparison'
    },
    baseline: {
      type: 'string',
      description: 'Update baseline after successful validation'
    },
    mode: {
      type: 'string',
      description: 'Drift detection mode: fail|warn|fix',
      default: 'fail'
    },
    'auto-fix': {
      type: 'boolean',
      description: 'Enable automatic drift fixing'
    },
    'tolerance': {
      type: 'string',
      description: 'Drift tolerance level (strict|normal|relaxed)',
      default: 'normal'
    },
    'state-consistency': {
      type: 'boolean',
      description: 'Enable state consistency checking',
      default: true
    },
    'detect-unauthorized': {
      type: 'boolean',
      description: 'Enable unauthorized modification detection',
      default: true
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for reports',
      default: './validation-reports'
    },
    'verbose': {
      type: 'boolean',
      description: 'Enable verbose output'
    },
    'quiet': {
      type: 'boolean',
      description: 'Suppress non-essential output'
    }
  },
  async run({ args }) {
    try {
      // Configure logging
      if (args.quiet) {
        consola.level = 1; // Errors only
      } else if (args.verbose) {
        consola.level = 5; // Debug
      }
      
      const toleranceMap = {
        strict: 0.99,
        normal: 0.95,
        relaxed: 0.90
      };

      const config = {
        driftDetection: {
          enabled: true,
          autoFix: args['auto-fix'] || false,
          tolerance: toleranceMap[args.tolerance] || 0.95,
          failMode: args.mode || 'fail',
          stateConsistency: args['state-consistency'] !== false,
          detectUnauthorized: args['detect-unauthorized'] !== false,
          backupOriginal: true
        },
        reporting: {
          outputPath: args['output-dir'],
          format: 'json',
          includeStatistics: true,
          timestamped: true,
          humanReadable: true
        },
        exitCodes: {
          success: 0,
          warnings: 0,
          violations: 3,
          driftDetected: 3,
          errors: 1
        }
      };

      const engine = new KGenValidationEngine(config);
      await engine.initialize();

      const options = {
        targetPath: args.target,
        expectedData: args.expected ? await fs.readFile(args.expected, 'utf8') : null
      };

      consola.start(`🔍 Running enhanced drift detection in ${config.driftDetection.failMode} mode...`);
      const results = await engine.validateWithDriftDetection(options);

      displayEnhancedDriftResults(results, args);

      // Update baseline if requested and no drift detected
      if (args.baseline && !results.summary.driftDetected) {
        consola.success('📝 Updating drift baseline...');
        await engine.updateBaseline(args.target, results.drift?.current?.content || '');
      }

      await engine.shutdown();
      
      // Exit with appropriate code based on drift detection mode
      let exitCode = results.exitCode;
      
      if (args.mode === 'warn' && results.summary.driftDetected) {
        exitCode = 0; // Don't fail on warnings
      } else if (args.mode === 'fix' && results.summary.fixesApplied > 0) {
        exitCode = 0; // Don't fail if fixes were applied
      }
      
      process.exit(exitCode);

    } catch (error) {
      consola.error('❌ Enhanced drift detection failed:', error.message);
      if (args.verbose) {
        consola.error(error.stack);
      }
      process.exit(ValidationExitCodes.ERRORS);
    }
  }
});

const baselineCommand = defineCommand({
  meta: {
    name: 'baseline',
    description: 'Manage drift detection baselines'
  },
  args: {
    action: {
      type: 'string',
      description: 'Action: create, update, list, clear',
      required: true
    },
    target: {
      type: 'string',
      description: 'Target file path for baseline operations'
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for baseline data',
      default: './validation-reports'
    }
  },
  async run({ args }) {
    try {
      const config = {
        reporting: { outputPath: args['output-dir'] }
      };

      const engine = new KGenValidationEngine(config);
      await engine.initialize();

      switch (args.action) {
        case 'create':
        case 'update':
          if (!args.target) {
            throw new Error('Target file path required for create/update');
          }
          if (!await fs.pathExists(args.target)) {
            throw new Error(`Target file does not exist: ${args.target}`);
          }
          const content = await fs.readFile(args.target, 'utf8');
          await engine.updateBaseline(args.target, content);
          consola.success(`✅ Baseline ${args.action}d for ${args.target}`);
          break;

        case 'list':
          await engine.loadDriftBaseline();
          const baselines = Array.from(engine.driftBaseline.entries());
          if (baselines.length === 0) {
            consola.info('📭 No baselines found');
          } else {
            consola.info('📋 Current baselines:');
            baselines.forEach(([key, baseline]) => {
              consola.info(`  - ${baseline.path} (${baseline.timestamp})`);
            });
          }
          break;

        case 'clear':
          engine.driftBaseline.clear();
          await engine.saveDriftBaseline();
          consola.success('🗑️ All baselines cleared');
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

      await engine.shutdown();

    } catch (error) {
      consola.error('❌ Baseline operation failed:', error.message);
      process.exit(ValidationExitCodes.ERRORS);
    }
  }
});

const reportCommand = defineCommand({
  meta: {
    name: 'report',
    description: 'Generate or view validation reports'
  },
  args: {
    action: {
      type: 'string',
      description: 'Action: view, list, cleanup',
      default: 'list'
    },
    'report-id': {
      type: 'string',
      description: 'Specific report ID to view'
    },
    'output-dir': {
      type: 'string',
      description: 'Reports directory',
      default: './validation-reports'
    },
    'days': {
      type: 'string',
      description: 'Number of days to keep reports (for cleanup)',
      default: '30'
    }
  },
  async run({ args }) {
    try {
      const reportsDir = args['output-dir'];
      
      switch (args.action) {
        case 'list':
          if (!await fs.pathExists(reportsDir)) {
            consola.info('📭 No reports directory found');
            return;
          }

          const files = await fs.readdir(reportsDir);
          const reportFiles = files.filter(f => f.startsWith('validation-report-') && f.endsWith('.json'));
          
          if (reportFiles.length === 0) {
            consola.info('📭 No validation reports found');
          } else {
            consola.info('📋 Validation reports:');
            for (const file of reportFiles.sort().reverse().slice(0, 10)) {
              const reportPath = path.join(reportsDir, file);
              const stats = await fs.stat(reportPath);
              consola.info(`  - ${file} (${stats.mtime.toISOString()})`);
            }
            if (reportFiles.length > 10) {
              consola.info(`  ... and ${reportFiles.length - 10} more`);
            }
          }
          break;

        case 'view':
          if (!args['report-id']) {
            throw new Error('Report ID required for view action');
          }
          
          const reportPath = path.join(reportsDir, `validation-report-${args['report-id']}.json`);
          if (!await fs.pathExists(reportPath)) {
            throw new Error(`Report not found: ${reportPath}`);
          }

          const report = await fs.readJson(reportPath);
          consola.info('📊 Validation Report:');
          consola.info(JSON.stringify(report, null, 2));
          break;

        case 'cleanup':
          const daysToKeep = parseInt(args.days);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

          if (!await fs.pathExists(reportsDir)) {
            consola.info('📭 No reports directory found');
            return;
          }

          const allFiles = await fs.readdir(reportsDir);
          const reportFilesToClean = allFiles.filter(f => 
            f.startsWith('validation-report-') && (f.endsWith('.json') || f.endsWith('.txt'))
          );

          let cleanedCount = 0;
          for (const file of reportFilesToClean) {
            const filePath = path.join(reportsDir, file);
            const stats = await fs.stat(filePath);
            if (stats.mtime < cutoffDate) {
              await fs.remove(filePath);
              cleanedCount++;
            }
          }

          consola.success(`🗑️ Cleaned up ${cleanedCount} old report files`);
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      consola.error('❌ Report operation failed:', error.message);
      process.exit(ValidationExitCodes.ERRORS);
    }
  }
});

const main = defineCommand({
  meta: {
    name: 'kgen-validate',
    description: 'KGEN Validation Engine CLI',
    version: '1.0.0'
  },
  subCommands: {
    validate: validateCommand,
    drift: artifactDriftCommand,
    baseline: baselineCommand,
    report: reportCommand
  }
});

async function loadConfiguration(args) {
  let config = {
    exitCodes: {
      success: 0,
      warnings: 0,
      violations: args['exit-on-violations'] ? 3 : 0,
      errors: 1
    },
    driftDetection: {
      enabled: true,
      autoFix: args['auto-fix'] || false,
      backupOriginal: true,
      tolerance: 0.95
    },
    validation: {
      strictMode: args['strict-mode'] || false,
      parallelValidation: true,
      maxConcurrency: 4
    },
    reporting: {
      format: 'json',
      outputPath: args['output-dir'],
      includeStatistics: true,
      timestamped: true
    }
  };

  // Load config file if specified
  if (args.config && await fs.pathExists(args.config)) {
    const fileConfig = await fs.readJson(args.config);
    config = { ...config, ...fileConfig };
  }

  return config;
}

function displayResults(results, args) {
  if (args.quiet) {
    // Only show critical information in quiet mode
    if (results.exitCode !== 0) {
      consola.error(`❌ Validation failed (exit code: ${results.exitCode})`);
    } else {
      consola.success('✅ Validation passed');
    }
    return;
  }

  // Display comprehensive results
  consola.info('\n📊 VALIDATION RESULTS:');
  consola.info('='.repeat(50));
  
  consola.info(`🆔 Validation ID: ${results.validationId?.slice(0, 8)}`);
  consola.info(`⏱️  Timestamp: ${results.timestamp}`);
  consola.info(`🚦 Exit Code: ${results.exitCode}`);
  
  if (results.summary) {
    consola.info('\n📈 SUMMARY:');
    consola.info(`  Violations: ${results.summary.totalViolations}`);
    consola.info(`  Warnings: ${results.summary.totalWarnings}`);
    consola.info(`  Drift Detected: ${results.summary.driftDetected ? '⚠️  YES' : '✅ NO'}`);
    consola.info(`  Auto-fixes Applied: ${results.summary.fixesApplied}`);
  }

  if (results.validation) {
    consola.info('\n🔍 SHACL VALIDATION:');
    consola.info(`  Conforms: ${results.validation.conforms ? '✅ YES' : '❌ NO'}`);
    consola.info(`  Violations: ${results.validation.totalViolations}`);
    consola.info(`  Warnings: ${results.validation.totalWarnings}`);
    consola.info(`  Validation Time: ${results.validation.validationTime}ms`);
  }

  if (results.drift?.driftDetected) {
    consola.info('\n🔄 DRIFT DETECTION:');
    consola.info(`  Drift Score: ${results.drift.driftScore.toFixed(3)}`);
    consola.info(`  Differences: ${results.drift.differences.length}`);
    
    if (results.drift.differences.length > 0 && args.verbose) {
      consola.info('  Details:');
      results.drift.differences.slice(0, 5).forEach(diff => {
        consola.info(`    - ${diff.type}: ${diff.message}`);
      });
      if (results.drift.differences.length > 5) {
        consola.info(`    ... and ${results.drift.differences.length - 5} more`);
      }
    }
  }

  if (results.reportPath) {
    consola.info(`\n📋 Report saved to: ${results.reportPath}`);
  }

  consola.info('='.repeat(50));

  // Final status
  if (results.exitCode === 0) {
    consola.success('✅ Validation completed successfully');
  } else if (results.exitCode === 3) {
    consola.error('❌ Validation failed with violations');
  } else {
    consola.warn('⚠️  Validation completed with issues');
  }
}

function displayEnhancedDriftResults(results, args) {
  if (args.quiet) {
    // Only show critical information in quiet mode
    if (results.exitCode !== 0) {
      if (results.summary.driftDetected) {
        consola.error(`❌ Drift detected (exit code: ${results.exitCode})`);
      } else {
        consola.error(`❌ Validation failed (exit code: ${results.exitCode})`);
      }
    } else {
      consola.success('✅ No drift detected');
    }
    return;
  }

  // Display comprehensive drift detection results
  consola.info('\n🔍 ENHANCED DRIFT DETECTION RESULTS:');
  consola.info('='.repeat(60));
  
  consola.info(`🆔 Validation ID: ${results.validationId?.slice(0, 8)}`);
  consola.info(`⏱️  Timestamp: ${results.timestamp}`);
  consola.info(`🚦 Exit Code: ${results.exitCode}`);
  consola.info(`🎯 Detection Mode: ${results.drift?.metadata?.detectionMode?.toUpperCase() || 'N/A'}`);
  
  if (results.summary) {
    consola.info('\n📈 SUMMARY:');
    consola.info(`  Drift Detected: ${results.summary.driftDetected ? '⚠️  YES' : '✅ NO'}`);
    if (results.drift?.driftScore !== undefined) {
      consola.info(`  Drift Score: ${results.drift.driftScore.toFixed(3)}`);
    }
    consola.info(`  Unauthorized Modifications: ${results.drift?.unauthorizedModification ? '🚨 YES' : '✅ NO'}`);
    consola.info(`  Auto-fixes Applied: ${results.summary.fixesApplied}`);
    consola.info(`  Violations: ${results.summary.totalViolations}`);
    consola.info(`  Warnings: ${results.summary.totalWarnings}`);
  }

  if (results.drift?.stateConsistency) {
    consola.info('\n🏗️  STATE CONSISTENCY:');
    consola.info(`  Valid: ${results.drift.stateConsistency.valid ? '✅ YES' : '❌ NO'}`);
    consola.info(`  Checks Performed: ${results.drift.stateConsistency.checks?.length || 0}`);
    if (results.drift.stateConsistency.errors?.length > 0) {
      consola.info(`  Errors: ${results.drift.stateConsistency.errors.length}`);
    }
    if (results.drift.stateConsistency.warnings?.length > 0) {
      consola.info(`  Warnings: ${results.drift.stateConsistency.warnings.length}`);
    }
  }

  if (results.drift?.differences && results.drift.differences.length > 0) {
    consola.info('\n🔄 DIFFERENCES DETECTED:');
    consola.info(`  Total Differences: ${results.drift.differences.length}`);
    
    if (args.verbose) {
      consola.info('  Details:');
      results.drift.differences.slice(0, 10).forEach((diff, index) => {
        const icon = diff.type === 'added' ? '➕' : diff.type === 'removed' ? '➖' : '✏️';
        consola.info(`    ${icon} ${diff.message || diff.type}`);
        if (diff.line) {
          consola.info(`       Line ${diff.line}`);
        }
      });
      
      if (results.drift.differences.length > 10) {
        consola.info(`    ... and ${results.drift.differences.length - 10} more differences`);
      }
    }
  }

  if (results.drift?.current && results.drift?.expected) {
    consola.info('\n📊 FILE COMPARISON:');
    consola.info(`  Current Size: ${results.drift.current.size} bytes`);
    consola.info(`  Expected Size: ${results.drift.expected.size} bytes`);
    consola.info(`  Current Hash: ${results.drift.current.hash.slice(0, 16)}...`);
    consola.info(`  Expected Hash: ${results.drift.expected.hash.slice(0, 16)}...`);
    consola.info(`  File Exists: ${results.drift.current.exists ? '✅ YES' : '❌ NO'}`);
  }

  if (results.drift?.metadata) {
    consola.info('\n🔧 DETECTION METADATA:');
    consola.info(`  Target Path: ${results.drift.metadata.targetPath}`);
    consola.info(`  Detection Time: ${results.drift.metadata.detectionTime}ms`);
    consola.info(`  Tolerance: ${results.drift.metadata.tolerance}`);
  }

  if (results.reportPath) {
    consola.info(`\n📋 Detailed report saved to: ${results.reportPath}`);
  }

  consola.info('='.repeat(60));

  // Final status with mode-specific messaging
  const mode = results.drift?.metadata?.detectionMode || 'fail';
  
  if (results.exitCode === 0) {
    if (results.summary.fixesApplied > 0) {
      consola.success(`✅ Drift detected and ${results.summary.fixesApplied} fixes applied (${mode} mode)`);
    } else {
      consola.success('✅ No drift detected - files are consistent');
    }
  } else if (results.exitCode === 3) {
    if (mode === 'warn') {
      consola.warn(`⚠️  Drift detected but proceeding (${mode} mode)`);
    } else {
      consola.error(`❌ Drift detection failed (${mode} mode)`);
    }
  } else {
    consola.error(`❌ Validation error (exit code: ${results.exitCode})`);
  }
}

// Export for testing
export { main, validateCommand, driftCommand, baselineCommand, reportCommand };

// Run main if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMain(main);
}