/**
 * Template Validation Command - Validate all templates in project
 * Uses the Perfect Template System for comprehensive validation
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import { PerfectTemplateScanner } from '../lib/template-scanner-perfect.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Validate templates command
 */
export const validateTemplatesCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate all template files in the project for syntax errors and issues",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory to scan for templates (default: current directory)",
      default: ".",
    },
    fix: {
      type: "boolean",
      description: "Attempt to automatically fix template issues",
      default: false,
    },
    report: {
      type: "boolean",
      description: "Generate detailed validation report",
      default: false,
    },
    reportPath: {
      type: "string",
      description: "Path for the validation report (default: template-validation-report.json)",
      default: "./template-validation-report.json",
    },
    includePatterns: {
      type: "string",
      description: "Comma-separated list of patterns to include (default: auto-detect)",
    },
    excludePatterns: {
      type: "string", 
      description: "Comma-separated list of patterns to exclude",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      default: false,
      alias: "v",
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output",
      default: false,
      alias: "q",
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = Date.now();

    try {
      if (!args.quiet) {
        console.log(chalk.blue.bold("🔍 Template Validation"));
        console.log(chalk.gray(`Scanning directory: ${path.resolve(args.dir)}`));
      }

      // Prepare scanner options
      const scannerOptions = {
        rootDir: path.resolve(args.dir),
        enableFix: args.fix,
        maxConcurrency: 10
      };

      // Parse include patterns
      if (args.includePatterns) {
        scannerOptions.includePatterns = args.includePatterns.split(',').map(p => p.trim());
      }

      // Parse exclude patterns
      if (args.excludePatterns) {
        const customExcludes = args.excludePatterns.split(',').map(p => p.trim());
        scannerOptions.excludePatterns = [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          ...customExcludes
        ];
      }

      if (args.verbose) {
        console.log(chalk.gray("Scanner options:"), scannerOptions);
      }

      // Initialize scanner and run validation
      const scanner = new PerfectTemplateScanner(scannerOptions);
      const results = await scanner.scanAll();

      // Process results
      const duration = Date.now() - startTime;
      const successRate = Math.round((results.validFiles / results.totalFiles) * 100);

      if (!args.quiet) {
        console.log(chalk.green(`\n✅ Validation Complete`));
        console.log(chalk.gray(`⏱️  Duration: ${duration}ms`));
        
        // Summary
        console.log(chalk.cyan("\n📊 Summary:"));
        console.log(`   Total Files: ${results.totalFiles}`);
        console.log(`   Valid Files: ${chalk.green(results.validFiles)} (${successRate}%)`);
        console.log(`   Invalid Files: ${chalk.red(results.invalidFiles)}`);
        
        if (args.fix && results.fixedFiles > 0) {
          console.log(`   Fixed Files: ${chalk.yellow(results.fixedFiles)}`);
        }

        // File type breakdown
        if (Object.keys(results.statistics.byType).length > 0) {
          console.log(chalk.cyan("\n📈 By File Type:"));
          Object.entries(results.statistics.byType)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
              console.log(`   ${type}: ${count}`);
            });
        }

        // Error summary
        if (Object.keys(results.statistics.errorTypes).length > 0) {
          console.log(chalk.cyan("\n🐛 Common Issues:"));
          Object.entries(results.statistics.errorTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([errorType, count]) => {
              console.log(`   ${errorType}: ${count} files`);
            });
        }
      }

      // Show detailed issues if verbose or if there are problems
      if ((args.verbose || results.invalidFiles > 0) && !args.quiet) {
        const invalidFiles = results.files.filter(f => !f.valid);
        
        if (invalidFiles.length > 0) {
          console.log(chalk.red(`\n❌ Files with Issues:`));
          
          const displayCount = args.verbose ? invalidFiles.length : Math.min(invalidFiles.length, 10);
          
          invalidFiles.slice(0, displayCount).forEach((file, index) => {
            console.log(chalk.red(`\n${index + 1}. ${file.relativePath}`));
            
            const issueCount = Math.min(file.issues?.length || 0, args.verbose ? 10 : 3);
            file.issues?.slice(0, issueCount).forEach(issue => {
              const severityColor = issue.severity === 'error' ? 'red' : 'yellow';
              console.log(chalk[severityColor](`   • ${issue.message}`));
              
              if (issue.line && args.verbose) {
                console.log(chalk.gray(`     Line ${issue.line}${issue.column ? `, Column ${issue.column}` : ''}`));
              }
            });
            
            if (file.issues?.length > issueCount) {
              console.log(chalk.gray(`   ... and ${file.issues.length - issueCount} more issues`));
            }
            
            if (file.fixed && args.fix) {
              console.log(chalk.green(`   ✅ Auto-fixed`));
            }
          });
          
          if (invalidFiles.length > displayCount) {
            console.log(chalk.gray(`\n... and ${invalidFiles.length - displayCount} more files with issues`));
          }
        }
      }

      // Generate detailed report if requested
      if (args.report) {
        try {
          await scanner.generateReport(results, args.reportPath);
          console.log(chalk.blue(`📋 Detailed report saved to: ${args.reportPath}`));
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Failed to generate report: ${error.message}`));
        }
      }

      // Show recommendations
      const recommendations = scanner.generateRecommendations(results);
      if (recommendations.length > 0 && !args.quiet) {
        console.log(chalk.cyan("\n💡 Recommendations:"));
        recommendations.forEach(rec => {
          const icon = rec.type === 'critical' ? '🚨' : rec.type === 'high' ? '⚠️' : rec.type === 'action' ? '🔧' : 'ℹ️';
          console.log(`   ${icon} ${rec.message}`);
        });
      }

      // Exit status
      const hasErrors = results.invalidFiles > 0;
      
      if (!args.quiet) {
        if (hasErrors) {
          console.log(chalk.red(`\n❌ Validation failed with ${results.invalidFiles} invalid file(s)`));
          if (args.fix && results.fixedFiles > 0) {
            console.log(chalk.yellow(`🔧 ${results.fixedFiles} file(s) were automatically fixed`));
          }
          if (!args.fix && results.invalidFiles > 0) {
            console.log(chalk.blue(`💡 Run with --fix to attempt automatic fixes`));
          }
        } else {
          console.log(chalk.green("\n🎉 All templates are valid!"));
        }
      }

      return {
        success: !hasErrors,
        totalFiles: results.totalFiles,
        validFiles: results.validFiles,
        invalidFiles: results.invalidFiles,
        fixedFiles: results.fixedFiles,
        successRate,
        duration
      };

    } catch (error) {
      console.error(chalk.red("\n❌ Template validation failed:"));
      console.error(chalk.red(`  ${error.message}`));

      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }

      console.log(chalk.blue("\n💡 Suggestions:"));
      console.log(chalk.blue("  • Check that the specified directory exists"));
      console.log(chalk.blue("  • Ensure you have read permissions"));
      console.log(chalk.blue("  • Run with --verbose for more details"));

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  },
});