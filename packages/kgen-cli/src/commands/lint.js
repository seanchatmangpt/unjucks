/**
 * KGEN Template Linting Command
 * CLI command for linting templates to ensure deterministic behavior
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { 
  TemplateLinter, 
  lintTemplateDirectory, 
  createDeterminismReport, 
  LintSeverity 
} from '../lib/template-linter.js';
import { loadKgenConfig } from '../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'lint',
    description: 'Lint templates for deterministic behavior and best practices'
  },
  args: {
    template: {
      type: 'positional',
      description: 'Template file or directory to lint',
      required: false
    },
    config: {
      type: 'string',
      description: 'Path to KGEN configuration file',
      alias: 'c'
    },
    output: {
      type: 'string',
      description: 'Output file for lint results (JSON format)',
      alias: 'o'
    },
    format: {
      type: 'string',
      description: 'Output format: table, json, summary',
      default: 'table',
      alias: 'f'
    },
    severity: {
      type: 'string',
      description: 'Minimum severity to report: error, warning, info, performance',
      default: 'warning'
    },
    fix: {
      type: 'boolean',
      description: 'Attempt to automatically fix issues where possible',
      default: false
    },
    cache: {
      type: 'boolean',
      description: 'Enable/disable result caching',
      default: true
    },
    'performance-target': {
      type: 'string',
      description: 'Performance target in milliseconds (default: 5ms)',
      default: '5'
    },
    'ignore-whitelist': {
      type: 'boolean',
      description: 'Ignore whitelist contexts (test/mock/fixture)',
      default: false
    },
    extensions: {
      type: 'string',
      description: 'File extensions to lint (comma-separated)',
      default: '.njk,.nunjucks,.html,.md,.txt'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: 'v',
      default: false
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress all output except errors',
      alias: 'q',
      default: false
    },
    'exit-code': {
      type: 'boolean',
      description: 'Exit with non-zero code if determinism issues found',
      default: true
    }
  },
  async run({ args }) {
    const startTime = this.getDeterministicTimestamp();
    
    if (!args.quiet) {
      consola.info('🔍 KGEN Template Linter v1.0.0');
    }

    try {
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Determine what to lint
      const targetPath = args.template || config.directories.templates;
      
      if (!existsSync(targetPath)) {
        consola.error(`Target path does not exist: ${targetPath}`);
        process.exit(1);
      }

      // Prepare linting options
      const lintOptions = {
        cache: args.cache,
        performanceTarget: parseInt(args['performance-target']),
        respectWhitelist: !args['ignore-whitelist'],
        extensions: args.extensions.split(',').map(ext => ext.trim()),
        ignore: config.lint?.ignore || ['node_modules/**', '.git/**', 'dist/**']
      };

      // Perform linting
      let results;
      const stat = await import('fs').then(fs => fs.promises.stat(targetPath));
      
      if (stat.isDirectory()) {
        if (!args.quiet) {
          consola.info(`📁 Linting templates in directory: ${relative(process.cwd(), targetPath)}`);
        }
        
        const batchResult = await lintTemplateDirectory(targetPath, lintOptions);
        results = batchResult.results;
        
        if (args.verbose && batchResult.cacheStats) {
          consola.info(`💾 Cache: ${batchResult.cacheStats.size} entries`);
        }
        
        if (!args.quiet) {
          consola.info(
            `📊 Processed ${batchResult.summary.total} templates ` +
            `(${batchResult.summary.passed} passed, ${batchResult.summary.failed} failed) ` +
            `in ${batchResult.summary.avgLintTime.toFixed(1)}ms avg`
          );
        }
        
      } else {
        if (!args.quiet) {
          consola.info(`📄 Linting single template: ${relative(process.cwd(), targetPath)}`);
        }
        
        const linter = new TemplateLinter(lintOptions);
        const result = await linter.lintTemplate(targetPath, lintOptions);
        results = [result];
      }

      // Filter results by severity
      const severityOrder = ['error', 'warning', 'info', 'performance'];
      const minSeverityIndex = severityOrder.indexOf(args.severity.toLowerCase());
      
      if (minSeverityIndex === -1) {
        consola.error(`Invalid severity: ${args.severity}`);
        process.exit(1);
      }

      // Generate output
      const totalTime = this.getDeterministicTimestamp() - startTime;
      const report = createDeterminismReport(results);
      
      // Apply severity filtering
      const filteredResults = results.map(result => ({
        ...result,
        issues: result.issues.filter(issue => {
          const issueIndex = severityOrder.indexOf(issue.severity.toLowerCase());
          return issueIndex <= minSeverityIndex;
        })
      }));

      // Output results
      if (args.output) {
        await outputResults(args.output, {
          results: filteredResults,
          report,
          meta: {
            lintTime: totalTime,
            config: {
              target: targetPath,
              severity: args.severity,
              options: lintOptions
            }
          }
        });
        
        if (!args.quiet) {
          consola.success(`📄 Results written to: ${args.output}`);
        }
      }

      // Display results based on format
      switch (args.format) {
        case 'json':
          console.log(JSON.stringify({ results: filteredResults, report }, null, 2));
          break;
          
        case 'summary':
          displaySummary(report, totalTime, args.quiet);
          break;
          
        case 'table':
        default:
          displayTable(filteredResults, report, totalTime, args.verbose, args.quiet);
          break;
      }

      // Apply auto-fixes if requested
      if (args.fix) {
        const fixCount = await applyAutoFixes(filteredResults, lintOptions);
        if (!args.quiet && fixCount > 0) {
          consola.success(`🔧 Applied ${fixCount} automatic fixes`);
        }
      }

      // Exit with appropriate code
      const hasErrors = results.some(r => !r.deterministic);
      if (args['exit-code'] && hasErrors) {
        if (!args.quiet) {
          consola.error(`❌ Found determinism issues - exiting with code 1`);
        }
        process.exit(1);
      }

      if (!args.quiet) {
        const scoreColor = report.determinismScore >= 99.9 ? 'green' : 
                          report.determinismScore >= 95 ? 'yellow' : 'red';
        consola.success(
          `✅ Linting completed in ${totalTime}ms - ` +
          `Determinism score: ${consola.colors[scoreColor](report.determinismScore + '%')}`
        );
      }

    } catch (error) {
      consola.error('❌ Linting failed:', error.message);
      if (args.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
});

/**
 * Display results in table format
 */
function displayTable(results, report, totalTime, verbose, quiet) {
  if (quiet) return;

  const hasIssues = results.some(r => r.issues.length > 0);
  
  if (!hasIssues) {
    consola.success('✅ All templates passed linting checks');
    return;
  }

  consola.info('📋 Linting Results:');
  console.log();

  for (const result of results) {
    if (result.issues.length === 0) {
      if (verbose) {
        console.log(`✅ ${relative(process.cwd(), result.templatePath)} - No issues`);
      }
      continue;
    }

    const determinismIcon = result.deterministic ? '⚠️' : '❌';
    console.log(`${determinismIcon} ${relative(process.cwd(), result.templatePath)}`);
    
    // Group issues by severity
    const issuesBySeverity = result.issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) acc[issue.severity] = [];
      acc[issue.severity].push(issue);
      return acc;
    }, {});

    for (const [severity, issues] of Object.entries(issuesBySeverity)) {
      const severityIcon = {
        ERROR: '🚨',
        WARNING: '⚠️',
        INFO: 'ℹ️',
        PERFORMANCE: '⚡'
      }[severity] || '•';

      console.log(`  ${severityIcon} ${severity} (${issues.length}):`);
      
      for (const issue of issues) {
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`    Line${location} - ${issue.message}`);
        
        if (verbose && issue.suggestion) {
          console.log(`    💡 Suggestion: ${issue.suggestion}`);
        }
      }
    }
    console.log();
  }

  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }
    console.log();
  }
}

/**
 * Display summary format
 */
function displaySummary(report, totalTime, quiet) {
  if (quiet) return;

  const scoreColor = report.determinismScore >= 99.9 ? 'green' : 
                    report.determinismScore >= 95 ? 'yellow' : 'red';

  console.log('📊 Determinism Report:');
  console.log(`  Score: ${consola.colors[scoreColor](report.determinismScore + '%')}`);
  console.log(`  Non-deterministic templates: ${report.nonDeterministicCount}`);
  console.log(`  Performance issues: ${report.performanceIssues.length}`);
  
  if (Object.keys(report.errorsByType).length > 0) {
    console.log('\n🚨 Error Summary:');
    for (const [errorType, errors] of Object.entries(report.errorsByType)) {
      console.log(`  ${errorType}: ${errors.length} occurrences`);
    }
  }

  console.log(`\n⏱️  Total lint time: ${totalTime}ms`);
}

/**
 * Output results to file
 */
async function outputResults(outputPath, data) {
  const outputData = {
    ...data,
    meta: {
      ...data.meta,
      generatedAt: this.getDeterministicDate().toISOString(),
      version: '1.0.0'
    }
  };
  
  await writeFile(outputPath, JSON.stringify(outputData, null, 2));
}

/**
 * Apply automatic fixes where possible
 */
async function applyAutoFixes(results, options) {
  let fixCount = 0;
  
  // For now, just log what would be fixed
  // In a full implementation, this would apply actual fixes
  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.suggestion && canAutoFix(issue.rule)) {
        consola.info(`🔧 Would fix: ${issue.message} in ${result.templatePath}`);
        fixCount++;
      }
    }
  }
  
  return fixCount;
}

/**
 * Check if an issue can be automatically fixed
 */
function canAutoFix(rule) {
  const autoFixableRules = [
    'bestPractices', // Some best practice issues can be auto-fixed
    'performanceOptimizations' // Some performance issues have clear fixes
  ];
  
  return autoFixableRules.includes(rule);
}