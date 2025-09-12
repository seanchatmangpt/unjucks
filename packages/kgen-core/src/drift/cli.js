#!/usr/bin/env node

/**
 * KGEN Artifact Drift Detection CLI
 * Command-line interface for drift detection with CI/CD integration
 * 
 * Features:
 * - kgen artifact drift - Main drift detection command
 * - Baseline management (create, update, list, clear)
 * - CI/CD friendly exit codes
 * - Comprehensive reporting
 */

import { defineCommand, runMain } from 'citty';
import consola from 'consola';
import fs from 'fs-extra';
import path from 'path';
import DriftDetector, { DriftExitCodes } from './detector.js';

const driftCommand = defineCommand({
  meta: {
    name: 'drift',
    description: 'Detect drift between current artifacts and expected/baseline state'
  },
  args: {
    target: {
      type: 'string',
      description: 'Target file or directory path for drift detection',
      default: process.cwd()
    },
    expected: {
      type: 'string',
      description: 'Directory containing expected artifact states'
    },
    baseline: {
      type: 'boolean',
      description: 'Use baseline comparison (default: true)',
      default: true
    },
    'tolerance': {
      type: 'string',
      description: 'Similarity tolerance (0.0-1.0) or preset (strict|normal|relaxed)',
      default: 'normal'
    },
    'algorithm': {
      type: 'string',
      description: 'Comparison algorithm (semantic-hash|content-hash)',
      default: 'semantic-hash'
    },
    'include': {
      type: 'string',
      description: 'File patterns to include (comma-separated)',
      default: '*.js,*.ts,*.ttl,*.json,*.md'
    },
    'ignore': {
      type: 'string',
      description: 'Paths to ignore (comma-separated)',
      default: '.git,node_modules,.cache,dist,build'
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for reports',
      default: './.kgen/drift-reports'
    },
    'baseline-dir': {
      type: 'string',
      description: 'Baseline storage directory',
      default: './.kgen/baselines'
    },
    'auto-update': {
      type: 'boolean',
      description: 'Auto-update baselines for new files'
    },
    'exit-on-drift': {
      type: 'boolean',
      description: 'Exit with code 3 on drift detection (CI/CD mode)',
      default: true
    },
    'format': {
      type: 'string',
      description: 'Report format (json|text|both)',
      default: 'both'
    },
    'quiet': {
      type: 'boolean',
      description: 'Suppress non-essential output'
    },
    'verbose': {
      type: 'boolean',
      description: 'Enable verbose logging'
    },
    'parallel': {
      type: 'string',
      description: 'Parallel processing concurrency',
      default: '4'
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

      // Parse tolerance
      const toleranceMap = {
        strict: 0.99,
        normal: 0.95,
        relaxed: 0.90
      };
      const tolerance = toleranceMap[args.tolerance] || parseFloat(args.tolerance) || 0.95;

      // Prepare configuration
      const config = {
        tolerance,
        algorithm: args.algorithm,
        enableBaseline: args.baseline,
        autoUpdate: args['auto-update'],
        includePatterns: args.include.split(',').map(p => p.trim()),
        ignorePaths: args.ignore.split(',').map(p => p.trim()),
        storage: {
          baselinePath: args['baseline-dir'],
          reportsPath: args['output-dir'],
          fingerprintsPath: path.join(args['baseline-dir'], '../fingerprints')
        },
        performance: {
          maxConcurrency: parseInt(args.parallel) || 4
        },
        exitCodes: {
          success: 0,
          drift: args['exit-on-drift'] ? DriftExitCodes.DRIFT_DETECTED : 0,
          error: DriftExitCodes.ERROR
        }
      };

      // Initialize drift detector
      const detector = new DriftDetector(config);
      await detector.initialize();

      // Load expected data if provided
      let expectedData = null;
      if (args.expected) {
        expectedData = await loadExpectedData(args.expected);
      }

      // Prepare detection options
      const options = {
        targetPath: args.target,
        expectedData,
        format: args.format
      };

      // Run drift detection
      consola.start('🚀 Starting artifact drift detection...');
      const results = await detector.detectArtifactDrift(options);

      // Display results
      displayDriftResults(results, args);

      // Shutdown detector
      await detector.shutdown();

      // Exit with appropriate code for CI/CD
      if (args['exit-on-drift'] && results.driftDetected) {
        consola.error(`🚨 Exiting with code ${results.exitCode} due to drift detection`);
        process.exit(results.exitCode);
      }

      return results;

    } catch (error) {
      consola.error('❌ Drift detection failed:', error.message);
      if (args.verbose) {
        consola.error(error.stack);
      }
      process.exit(DriftExitCodes.ERROR);
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
      description: 'Action: create, update, list, clear, import, export',
      required: true
    },
    target: {
      type: 'string',
      description: 'Target file or directory path'
    },
    'baseline-dir': {
      type: 'string',
      description: 'Baseline storage directory',
      default: './.kgen/baselines'
    },
    'import-file': {
      type: 'string',
      description: 'File to import baselines from (JSON)'
    },
    'export-file': {
      type: 'string',
      description: 'File to export baselines to (JSON)'
    },
    'force': {
      type: 'boolean',
      description: 'Force overwrite existing baselines'
    }
  },
  async run({ args }) {
    try {
      const config = {
        storage: {
          baselinePath: args['baseline-dir'],
          reportsPath: path.join(args['baseline-dir'], '../reports'),
          fingerprintsPath: path.join(args['baseline-dir'], '../fingerprints')
        }
      };

      const detector = new DriftDetector(config);
      await detector.initialize();

      switch (args.action) {
        case 'create':
        case 'update':
          if (!args.target) {
            throw new Error('Target path required for create/update');
          }
          
          await createOrUpdateBaseline(detector, args.target, args.action, args.force);
          break;

        case 'list':
          await listBaselines(detector);
          break;

        case 'clear':
          await clearBaselines(detector, args.force);
          break;

        case 'import':
          if (!args['import-file']) {
            throw new Error('Import file required');
          }
          await importBaselines(detector, args['import-file'], args.force);
          break;

        case 'export':
          if (!args['export-file']) {
            throw new Error('Export file required');
          }
          await exportBaselines(detector, args['export-file']);
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

      await detector.shutdown();

    } catch (error) {
      consola.error('❌ Baseline operation failed:', error.message);
      process.exit(DriftExitCodes.ERROR);
    }
  }
});

const reportCommand = defineCommand({
  meta: {
    name: 'report',
    description: 'View and manage drift detection reports'
  },
  args: {
    action: {
      type: 'string',
      description: 'Action: list, view, cleanup, summary',
      default: 'list'
    },
    'report-id': {
      type: 'string',
      description: 'Specific report ID to view'
    },
    'output-dir': {
      type: 'string',
      description: 'Reports directory',
      default: './.kgen/drift-reports'
    },
    'days': {
      type: 'string',
      description: 'Number of days to keep reports (for cleanup)',
      default: '30'
    },
    'format': {
      type: 'string',
      description: 'Display format (table|json|text)',
      default: 'table'
    }
  },
  async run({ args }) {
    try {
      const reportsDir = args['output-dir'];
      
      switch (args.action) {
        case 'list':
          await listReports(reportsDir, args.format);
          break;

        case 'view':
          if (!args['report-id']) {
            throw new Error('Report ID required for view action');
          }
          await viewReport(reportsDir, args['report-id'], args.format);
          break;

        case 'cleanup':
          const daysToKeep = parseInt(args.days);
          await cleanupReports(reportsDir, daysToKeep);
          break;

        case 'summary':
          await generateSummary(reportsDir, args.format);
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      consola.error('❌ Report operation failed:', error.message);
      process.exit(DriftExitCodes.ERROR);
    }
  }
});

const main = defineCommand({
  meta: {
    name: 'kgen-drift',
    description: 'KGEN Artifact Drift Detection CLI',
    version: '1.0.0'
  },
  subCommands: {
    drift: driftCommand,
    baseline: baselineCommand,
    report: reportCommand
  }
});

/**
 * Helper functions
 */

async function loadExpectedData(expectedDir) {
  if (!await fs.pathExists(expectedDir)) {
    throw new Error(`Expected data directory does not exist: ${expectedDir}`);
  }

  const expectedData = {};
  const files = await fs.readdir(expectedDir, { recursive: true });
  
  for (const file of files) {
    const filePath = path.join(expectedDir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      expectedData[file] = await fs.readFile(filePath, 'utf8');
    }
  }

  consola.info(`📂 Loaded ${Object.keys(expectedData).length} expected artifact(s)`);
  return expectedData;
}

function displayDriftResults(results, args) {
  if (args.quiet) {
    // Only show critical information in quiet mode
    if (results.driftDetected) {
      consola.error(`❌ Drift detected (exit code: ${results.exitCode})`);
    } else {
      consola.success('✅ No drift detected');
    }
    return;
  }

  // Display comprehensive results
  consola.info('\n📊 DRIFT DETECTION RESULTS:');
  consola.info('='.repeat(60));
  
  consola.info(`🆔 Detection ID: ${results.detectionId?.slice(0, 8)}`);
  consola.info(`⏱️  Timestamp: ${results.timestamp}`);
  consola.info(`🚦 Exit Code: ${results.exitCode}`);
  consola.info(`🔍 Algorithm: ${results.options?.algorithm || 'semantic-hash'}`);
  
  if (results.summary) {
    consola.info('\n📈 SUMMARY:');
    consola.info(`  Total Files: ${results.summary.totalFiles}`);
    consola.info(`  Files with Drift: ${results.summary.filesWithDrift}`);
    consola.info(`  New Files: ${results.summary.newFiles}`);
    consola.info(`  Modified Files: ${results.summary.modifiedFiles}`);
    consola.info(`  Deleted Files: ${results.summary.deletedFiles}`);
    consola.info(`  Total Differences: ${results.summary.totalDifferences}`);
  }

  consola.info(`\n🔄 DRIFT STATUS: ${results.driftDetected ? '⚠️  DETECTED' : '✅ NONE'}`);

  if (results.driftDetected && results.artifacts?.length > 0 && args.verbose) {
    consola.info('\n📋 FILES WITH DRIFT:');
    results.artifacts
      .filter(a => a.driftDetected)
      .slice(0, 10)
      .forEach(artifact => {
        consola.info(`  📄 ${artifact.path}`);
        consola.info(`     Status: ${artifact.status}`);
        consola.info(`     Similarity: ${(artifact.similarity * 100).toFixed(1)}%`);
        consola.info(`     Differences: ${artifact.differences.length}`);
        
        if (artifact.differences.length > 0) {
          artifact.differences.slice(0, 3).forEach(diff => {
            consola.info(`       - ${diff.type}: ${diff.description}`);
          });
          if (artifact.differences.length > 3) {
            consola.info(`       ... and ${artifact.differences.length - 3} more`);
          }
        }
        consola.info('');
      });
    
    if (results.summary.filesWithDrift > 10) {
      consola.info(`  ... and ${results.summary.filesWithDrift - 10} more files with drift`);
    }
  }

  if (results.recommendations?.length > 0) {
    consola.info('\n💡 RECOMMENDATIONS:');
    results.recommendations.forEach(rec => {
      const priority = rec.priority?.toUpperCase() || 'INFO';
      const emoji = priority === 'CRITICAL' ? '🚨' : priority === 'HIGH' ? '⚠️' : '💡';
      consola.info(`  ${emoji} [${priority}] ${rec.message}`);
      if (rec.action) {
        consola.info(`     Action: ${rec.action}`);
      }
    });
  }

  if (results.reportPath) {
    consola.info(`\n📋 Detailed report saved to: ${results.reportPath}`);
  }

  consola.info('='.repeat(60));

  // Final status
  if (!results.driftDetected) {
    consola.success('✅ No drift detected - artifacts match expected state');
  } else if (results.exitCode === DriftExitCodes.DRIFT_DETECTED) {
    consola.error('❌ Drift detected - CI/CD build should fail');
  } else {
    consola.warn('⚠️  Drift detected but not failing build');
  }
}

async function createOrUpdateBaseline(detector, targetPath, action, force) {
  if (!await fs.pathExists(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  const stats = await fs.stat(targetPath);
  let processedCount = 0;

  if (stats.isFile()) {
    // Single file
    const fingerprint = await detector.generateArtifactFingerprint(targetPath);
    await detector.updateBaseline(targetPath, fingerprint);
    processedCount = 1;
  } else if (stats.isDirectory()) {
    // Directory - process all files
    const artifacts = await detector.discoverArtifacts(targetPath);
    
    for (const artifactPath of artifacts) {
      try {
        const fingerprint = await detector.generateArtifactFingerprint(artifactPath);
        await detector.updateBaseline(artifactPath, fingerprint);
        processedCount++;
      } catch (error) {
        consola.warn(`⚠️  Failed to process ${artifactPath}:`, error.message);
      }
    }
  }

  consola.success(`✅ Baseline ${action}d for ${processedCount} file(s)`);
}

async function listBaselines(detector) {
  if (detector.baselines.size === 0) {
    consola.info('📭 No baselines found');
    return;
  }

  consola.info('📋 Current baselines:');
  const baselines = Array.from(detector.baselines.entries());
  
  baselines.forEach(([key, baseline]) => {
    consola.info(`  📄 ${baseline.path}`);
    consola.info(`     Created: ${baseline.timestamp}`);
    consola.info(`     Hash: ${baseline.fingerprint?.hash?.slice(0, 12)}...`);
    consola.info(`     Type: ${baseline.fingerprint?.type || 'unknown'}`);
    consola.info('');
  });

  consola.info(`Total: ${baselines.length} baseline(s)`);
}

async function clearBaselines(detector, force) {
  if (!force) {
    consola.warn('⚠️  This will clear all baselines. Use --force to confirm.');
    return;
  }

  const count = detector.baselines.size;
  detector.baselines.clear();
  await detector.saveBaselines();
  
  consola.success(`🗑️  Cleared ${count} baseline(s)`);
}

async function importBaselines(detector, importFile, force) {
  if (!await fs.pathExists(importFile)) {
    throw new Error(`Import file does not exist: ${importFile}`);
  }

  const data = await fs.readJson(importFile);
  const imported = new Map(Object.entries(data));
  
  let newCount = 0;
  let updatedCount = 0;

  for (const [key, baseline] of imported) {
    if (detector.baselines.has(key) && !force) {
      consola.warn(`⚠️  Skipping existing baseline for ${baseline.path} (use --force to overwrite)`);
      continue;
    }

    const existed = detector.baselines.has(key);
    detector.baselines.set(key, baseline);
    
    if (existed) {
      updatedCount++;
    } else {
      newCount++;
    }
  }

  await detector.saveBaselines();
  consola.success(`📥 Imported ${newCount} new and updated ${updatedCount} existing baselines`);
}

async function exportBaselines(detector, exportFile) {
  const data = Object.fromEntries(detector.baselines);
  await fs.writeJson(exportFile, data, { spaces: 2 });
  
  consola.success(`📤 Exported ${detector.baselines.size} baseline(s) to ${exportFile}`);
}

async function listReports(reportsDir, format) {
  if (!await fs.pathExists(reportsDir)) {
    consola.info('📭 No reports directory found');
    return;
  }

  const files = await fs.readdir(reportsDir);
  const reportFiles = files.filter(f => f.startsWith('drift-report-') && f.endsWith('.json'));
  
  if (reportFiles.length === 0) {
    consola.info('📭 No drift reports found');
    return;
  }

  consola.info('📋 Drift detection reports:');
  
  for (const file of reportFiles.sort().reverse().slice(0, 20)) {
    const reportPath = path.join(reportsDir, file);
    const stats = await fs.stat(reportPath);
    
    try {
      const report = await fs.readJson(reportPath);
      const id = report.metadata?.detectionId?.slice(0, 8) || 'unknown';
      const driftStatus = report.driftDetected ? '❌ DRIFT' : '✅ CLEAN';
      
      consola.info(`  📄 ${file}`);
      consola.info(`     ID: ${id} | Status: ${driftStatus} | Created: ${stats.mtime.toISOString()}`);
      if (report.summary) {
        consola.info(`     Files: ${report.summary.totalFiles} | With Drift: ${report.summary.filesWithDrift}`);
      }
      consola.info('');
    } catch (error) {
      consola.warn(`⚠️  Invalid report file: ${file}`);
    }
  }

  if (reportFiles.length > 20) {
    consola.info(`  ... and ${reportFiles.length - 20} more reports`);
  }
}

async function viewReport(reportsDir, reportId, format) {
  let reportPath = path.join(reportsDir, `drift-report-${reportId}.json`);
  
  // Try to find report by partial ID
  if (!await fs.pathExists(reportPath)) {
    const files = await fs.readdir(reportsDir);
    const matching = files.find(f => f.includes(reportId) && f.endsWith('.json'));
    
    if (matching) {
      reportPath = path.join(reportsDir, matching);
    } else {
      throw new Error(`Report not found: ${reportId}`);
    }
  }

  const report = await fs.readJson(reportPath);
  
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    consola.info('📊 Drift Detection Report:');
    consola.info(`ID: ${report.metadata?.detectionId}`);
    consola.info(`Timestamp: ${report.metadata?.timestamp}`);
    consola.info(`Drift Detected: ${report.driftDetected ? 'YES' : 'NO'}`);
    consola.info(`Exit Code: ${report.exitCode}`);
    
    if (report.summary) {
      consola.info('\nSummary:');
      consola.info(`- Total Files: ${report.summary.totalFiles}`);
      consola.info(`- Files with Drift: ${report.summary.filesWithDrift}`);
      consola.info(`- New Files: ${report.summary.newFiles}`);
      consola.info(`- Modified Files: ${report.summary.modifiedFiles}`);
      consola.info(`- Deleted Files: ${report.summary.deletedFiles}`);
    }

    if (report.humanReadable) {
      consola.info('\n' + report.humanReadable);
    }
  }
}

async function cleanupReports(reportsDir, daysToKeep) {
  if (!await fs.pathExists(reportsDir)) {
    consola.info('📭 No reports directory found');
    return;
  }

  const cutoffDate = this.getDeterministicDate();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const files = await fs.readdir(reportsDir);
  const reportFiles = files.filter(f => 
    f.startsWith('drift-report-') && (f.endsWith('.json') || f.endsWith('.txt'))
  );

  let cleanedCount = 0;
  for (const file of reportFiles) {
    const filePath = path.join(reportsDir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.mtime < cutoffDate) {
      await fs.remove(filePath);
      cleanedCount++;
    }
  }

  consola.success(`🗑️  Cleaned up ${cleanedCount} old report file(s)`);
}

async function generateSummary(reportsDir, format) {
  if (!await fs.pathExists(reportsDir)) {
    consola.info('📭 No reports directory found');
    return;
  }

  const files = await fs.readdir(reportsDir);
  const reportFiles = files.filter(f => f.startsWith('drift-report-') && f.endsWith('.json'));
  
  if (reportFiles.length === 0) {
    consola.info('📭 No reports to summarize');
    return;
  }

  const summary = {
    totalReports: reportFiles.length,
    reportsWithDrift: 0,
    totalFilesProcessed: 0,
    totalFilesWithDrift: 0,
    averageFilesPerReport: 0,
    oldestReport: null,
    newestReport: null
  };

  for (const file of reportFiles) {
    try {
      const reportPath = path.join(reportsDir, file);
      const report = await fs.readJson(reportPath);
      const stats = await fs.stat(reportPath);
      
      if (report.driftDetected) {
        summary.reportsWithDrift++;
      }
      
      if (report.summary) {
        summary.totalFilesProcessed += report.summary.totalFiles || 0;
        summary.totalFilesWithDrift += report.summary.filesWithDrift || 0;
      }
      
      if (!summary.oldestReport || stats.mtime < summary.oldestReport.date) {
        summary.oldestReport = { file, date: stats.mtime };
      }
      
      if (!summary.newestReport || stats.mtime > summary.newestReport.date) {
        summary.newestReport = { file, date: stats.mtime };
      }
      
    } catch (error) {
      consola.warn(`⚠️  Skipping invalid report: ${file}`);
    }
  }

  summary.averageFilesPerReport = summary.totalReports > 0 ? 
    (summary.totalFilesProcessed / summary.totalReports).toFixed(1) : 0;

  if (format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    consola.info('📈 DRIFT DETECTION SUMMARY');
    consola.info('='.repeat(40));
    consola.info(`Total Reports: ${summary.totalReports}`);
    consola.info(`Reports with Drift: ${summary.reportsWithDrift} (${((summary.reportsWithDrift / summary.totalReports) * 100).toFixed(1)}%)`);
    consola.info(`Total Files Processed: ${summary.totalFilesProcessed}`);
    consola.info(`Total Files with Drift: ${summary.totalFilesWithDrift}`);
    consola.info(`Average Files per Report: ${summary.averageFilesPerReport}`);
    
    if (summary.oldestReport) {
      consola.info(`Oldest Report: ${summary.oldestReport.date.toISOString()}`);
    }
    if (summary.newestReport) {
      consola.info(`Newest Report: ${summary.newestReport.date.toISOString()}`);
    }
  }
}

// Export for testing
export { main, driftCommand, baselineCommand, reportCommand };

// Run main if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMain(main);
}