#!/usr/bin/env node

/**
 * KGEN Reproducibility Validation Runner
 * 
 * Standalone validation script for CI/CD integration and automated testing
 * Implements the 99.9% reproducibility target with comprehensive reporting
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { resolve } from 'path';
import { performance } from 'perf_hooks';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';

import ReproducibilityTestFramework from './framework.js';

class KGenReproducibilityValidator {
  constructor() {
    this.startTime = performance.now();
    this.config = this.parseConfig();
    this.results = {
      success: false,
      reproducibilityScore: 0,
      passed: false,
      duration: 0,
      summary: {},
      issues: [],
      recommendations: [],
      reportPath: null
    };
  }

  /**
   * Parse configuration from command line and environment
   */
  parseConfig() {
    const config = {
      target: parseFloat(process.env.KGEN_REPRO_TARGET || '99.9'),
      iterations: parseInt(process.env.KGEN_REPRO_ITERATIONS || '10'),
      timeout: parseInt(process.env.KGEN_REPRO_TIMEOUT || '30000'),
      kgenPath: process.env.KGEN_PATH || resolve('./bin/kgen.mjs'),
      outputDir: process.env.KGEN_REPRO_OUTPUT || './tests/reproducibility/reports',
      isolationLevel: process.env.KGEN_REPRO_ISOLATION || 'strict',
      performanceThreshold: parseFloat(process.env.KGEN_REPRO_PERF_THRESHOLD || '10'),
      parallelTests: parseInt(process.env.KGEN_REPRO_PARALLEL || '4'),
      includeSuites: process.env.KGEN_REPRO_INCLUDE_SUITES?.split(','),
      excludeSuites: process.env.KGEN_REPRO_EXCLUDE_SUITES?.split(','),
      jsonOutput: process.env.KGEN_REPRO_JSON === 'true',
      verbose: process.env.KGEN_REPRO_VERBOSE === 'true',
      debug: process.env.KGEN_REPRO_DEBUG === 'true'
    };

    // Override with command line args
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--target':
          config.target = parseFloat(nextArg);
          i++;
          break;
        case '--iterations':
          config.iterations = parseInt(nextArg);
          i++;
          break;
        case '--timeout':
          config.timeout = parseInt(nextArg);
          i++;
          break;
        case '--kgen-path':
          config.kgenPath = resolve(nextArg);
          i++;
          break;
        case '--output':
          config.outputDir = resolve(nextArg);
          i++;
          break;
        case '--isolation':
          config.isolationLevel = nextArg;
          i++;
          break;
        case '--performance-threshold':
          config.performanceThreshold = parseFloat(nextArg);
          i++;
          break;
        case '--parallel':
          config.parallelTests = parseInt(nextArg);
          i++;
          break;
        case '--include':
          config.includeSuites = nextArg.split(',').map(s => s.trim());
          i++;
          break;
        case '--exclude':
          config.excludeSuites = nextArg.split(',').map(s => s.trim());
          i++;
          break;
        case '--json':
          config.jsonOutput = true;
          break;
        case '--verbose':
          config.verbose = true;
          break;
        case '--debug':
          config.debug = true;
          break;
        case '--help':
          this.showHelp();
          process.exit(0);
          break;
        default:
          if (arg.startsWith('--')) {
            console.error(`Unknown option: ${arg}`);
            process.exit(1);
          }
      }
    }

    return config;
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
KGEN Reproducibility Validator

Usage: validate.mjs [options]

Options:
  --target <percentage>           Target reproducibility percentage (default: 99.9)
  --iterations <number>           Number of test iterations (default: 10)
  --timeout <ms>                  Test timeout in milliseconds (default: 30000)
  --kgen-path <path>              Path to KGEN binary (default: ./bin/kgen.mjs)
  --output <directory>            Output directory for reports
  --isolation <level>             Environment isolation level (strict|moderate|basic)
  --performance-threshold <pct>   Performance impact threshold (default: 10)
  --parallel <number>             Parallel test processes (default: 4)
  --include <suites>              Comma-separated test suites to include
  --exclude <suites>              Comma-separated test suites to exclude
  --json                          Output results in JSON format
  --verbose                       Enable verbose output
  --debug                         Enable debug mode
  --help                          Show this help message

Environment Variables:
  KGEN_REPRO_TARGET              Same as --target
  KGEN_REPRO_ITERATIONS          Same as --iterations
  KGEN_REPRO_TIMEOUT             Same as --timeout
  KGEN_PATH                      Same as --kgen-path
  KGEN_REPRO_OUTPUT              Same as --output
  KGEN_REPRO_ISOLATION           Same as --isolation
  KGEN_REPRO_PERF_THRESHOLD      Same as --performance-threshold
  KGEN_REPRO_PARALLEL            Same as --parallel
  KGEN_REPRO_INCLUDE_SUITES      Same as --include
  KGEN_REPRO_EXCLUDE_SUITES      Same as --exclude
  KGEN_REPRO_JSON                Set to 'true' for JSON output
  KGEN_REPRO_VERBOSE             Set to 'true' for verbose output
  KGEN_REPRO_DEBUG               Set to 'true' for debug mode

Exit Codes:
  0    All tests passed, reproducibility target met
  1    Tests failed or reproducibility target not met
  2    Framework initialization error
  3    KGEN binary not found or not executable
  4    Configuration error

Examples:
  # Basic validation with default settings
  ./validate.mjs

  # Validation with 99.95% target and 20 iterations
  ./validate.mjs --target 99.95 --iterations 20

  # JSON output for CI/CD
  ./validate.mjs --json > results.json

  # Include only specific test suites
  ./validate.mjs --include "Graph Operations,Artifact Generation"

  # Custom KGEN path and output directory
  ./validate.mjs --kgen-path /usr/local/bin/kgen --output ./reports
`);
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const issues = [];

    // Validate target percentage
    if (this.config.target < 0 || this.config.target > 100) {
      issues.push('Target reproducibility must be between 0 and 100');
    }

    // Validate iterations
    if (this.config.iterations < 1 || this.config.iterations > 1000) {
      issues.push('Iterations must be between 1 and 1000');
    }

    // Validate KGEN path
    if (!existsSync(this.config.kgenPath)) {
      issues.push(`KGEN binary not found at: ${this.config.kgenPath}`);
    }

    // Validate isolation level
    const validIsolationLevels = ['strict', 'moderate', 'basic'];
    if (!validIsolationLevels.includes(this.config.isolationLevel)) {
      issues.push(`Invalid isolation level: ${this.config.isolationLevel}. Must be one of: ${validIsolationLevels.join(', ')}`);
    }

    // Validate performance threshold
    if (this.config.performanceThreshold < 0 || this.config.performanceThreshold > 100) {
      issues.push('Performance threshold must be between 0 and 100');
    }

    // Validate parallel tests
    if (this.config.parallelTests < 1 || this.config.parallelTests > 32) {
      issues.push('Parallel tests must be between 1 and 32');
    }

    if (issues.length > 0) {
      this.logError('Configuration validation failed:');
      issues.forEach(issue => this.logError(`  • ${issue}`));
      process.exit(4);
    }
  }

  /**
   * Run complete reproducibility validation
   */
  async run() {
    try {
      this.log('🔍 KGEN Reproducibility Validation');
      this.log('=====================================\n');

      // Validate configuration
      this.validateConfig();

      // Log configuration
      if (this.config.verbose) {
        this.logConfig();
      }

      // Create output directory
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Initialize framework
      this.log('🔧 Initializing reproducibility framework...');
      const framework = new ReproducibilityTestFramework({
        targetReproducibility: this.config.target,
        minIterations: this.config.iterations,
        testTimeout: this.config.timeout,
        parallelTests: this.config.parallelTests,
        isolationLevel: this.config.isolationLevel,
        performanceThreshold: this.config.performanceThreshold,
        kgenPath: this.config.kgenPath,
        tempDir: resolve(this.config.outputDir, 'temp'),
        verbose: this.config.verbose,
        debug: this.config.debug
      });

      // Set up progress reporting
      this.setupProgressReporting(framework);

      // Initialize framework
      const initResult = await framework.initialize();
      if (!initResult.success) {
        throw new Error(`Framework initialization failed: ${initResult.error}`);
      }

      this.log('✅ Framework initialized successfully\n');

      // Generate test suites
      this.log('📋 Generating test suites...');
      let testSuites = await framework.generateDefaultTestSuites();

      // Filter suites based on include/exclude
      if (this.config.includeSuites) {
        testSuites = testSuites.filter(suite => 
          this.config.includeSuites.includes(suite.name)
        );
        this.log(`   Included suites: ${this.config.includeSuites.join(', ')}`);
      }

      if (this.config.excludeSuites) {
        testSuites = testSuites.filter(suite => 
          !this.config.excludeSuites.includes(suite.name)
        );
        this.log(`   Excluded suites: ${this.config.excludeSuites.join(', ')}`);
      }

      this.log(`   Selected ${testSuites.length} test suites\n`);

      // Run validation
      this.log('🚀 Starting reproducibility validation...');
      this.log(`   Target: ${this.config.target}% reproducibility`);
      this.log(`   Iterations per test: ${this.config.iterations}`);
      this.log(`   Performance threshold: ${this.config.performanceThreshold}%\n`);

      const validationResult = await framework.runReproducibilityValidation(testSuites);

      // Process results
      this.processResults(validationResult);

      // Generate final report
      await this.generateFinalReport(validationResult);

      // Cleanup
      await framework.shutdown();

      // Output results
      this.outputResults();

      // Set exit code
      process.exit(this.results.passed ? 0 : 1);

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Log configuration details
   */
  logConfig() {
    this.log('📋 Configuration:');
    this.log(`   Target: ${this.config.target}%`);
    this.log(`   Iterations: ${this.config.iterations}`);
    this.log(`   Timeout: ${this.config.timeout}ms`);
    this.log(`   KGEN Path: ${this.config.kgenPath}`);
    this.log(`   Output Dir: ${this.config.outputDir}`);
    this.log(`   Isolation: ${this.config.isolationLevel}`);
    this.log(`   Performance Threshold: ${this.config.performanceThreshold}%`);
    this.log(`   Parallel Tests: ${this.config.parallelTests}\n`);
  }

  /**
   * Set up progress reporting for framework
   */
  setupProgressReporting(framework) {
    if (this.config.jsonOutput) return; // No progress for JSON mode

    framework.on('validation-started', (data) => {
      this.log(`🎯 Running ${data.suites} test suites with ${data.iterations} iterations each`);
    });

    framework.on('suite-started', (data) => {
      this.log(`\n📊 Suite: ${data.name} (${data.tests} tests)`);
    });

    let lastProgress = '';
    framework.on('test-progress', (data) => {
      const progress = `   ${data.operation}: ${data.completed}/${data.total} (${((data.completed / data.total) * 100).toFixed(1)}%) - Score: ${data.currentScore.toFixed(1)}%`;
      
      if (progress !== lastProgress) {
        process.stdout.write('\r' + ' '.repeat(lastProgress.length) + '\r');
        process.stdout.write(progress);
        lastProgress = progress;
      }
    });

    framework.on('test-completed', (data) => {
      process.stdout.write('\n');
      const status = data.score >= this.config.target ? '✅' : '❌';
      this.log(`   ${status} ${data.test}: ${data.score.toFixed(2)}%`);
      lastProgress = '';
    });

    framework.on('suite-completed', (data) => {
      const status = data.score >= this.config.target ? '✅' : '❌';
      this.log(`   ${status} Suite completed: ${data.score.toFixed(2)}% (${(data.duration / 1000).toFixed(1)}s)`);
    });

    framework.on('critical-failure', (data) => {
      this.log(`\n🚨 CRITICAL FAILURE: Suite '${data.suite}' scored only ${data.score.toFixed(2)}%`);
    });
  }

  /**
   * Process validation results
   */
  processResults(validationResult) {
    this.results.success = validationResult.success;
    this.results.reproducibilityScore = validationResult.reproducibilityScore;
    this.results.passed = validationResult.passed;
    this.results.duration = performance.now() - this.startTime;

    // Generate summary
    this.results.summary = {
      overallScore: validationResult.reproducibilityScore,
      targetScore: this.config.target,
      totalSuites: validationResult.results?.length || 0,
      passedSuites: validationResult.results?.filter(s => s.reproducibilityScore >= this.config.target).length || 0,
      totalTests: validationResult.results?.reduce((sum, suite) => sum + suite.tests.length, 0) || 0,
      totalRuns: validationResult.results?.reduce((sum, suite) => sum + suite.totalRuns, 0) || 0,
      identicalRuns: validationResult.results?.reduce((sum, suite) => sum + suite.identicalRuns, 0) || 0
    };

    // Extract issues
    if (validationResult.report?.issues) {
      this.results.issues = [
        ...validationResult.report.issues.nonDeterministicSources.map(source => ({
          type: 'non-deterministic-source',
          source: source,
          severity: 'high'
        })),
        ...validationResult.report.issues.criticalFailures.map(failure => ({
          type: 'critical-failure',
          suite: failure.name,
          score: failure.reproducibilityScore,
          severity: 'critical'
        }))
      ];
    }

    // Extract recommendations
    if (validationResult.report?.recommendations) {
      this.results.recommendations = validationResult.report.recommendations;
    }

    // Store report path
    if (validationResult.report?.reportPath) {
      this.results.reportPath = validationResult.report.reportPath;
      this.results.summaryPath = validationResult.report.summaryPath;
    }
  }

  /**
   * Generate final validation report
   */
  async generateFinalReport(validationResult) {
    if (!validationResult.report) return;

    // Add validator-specific information to report
    const enhancedReport = {
      ...validationResult.report,
      validator: {
        version: '1.0.0',
        agent: 'Agent 11: Reproducibility Validation Engineer',
        configuration: this.config,
        executionTime: this.results.duration,
        timestamp: this.getDeterministicDate().toISOString()
      },
      compliance: {
        targetMet: this.results.passed,
        enterpriseReady: this.results.reproducibilityScore >= 99.9 && this.results.issues.filter(i => i.severity === 'critical').length === 0,
        performanceImpactAcceptable: validationResult.report.issues?.performanceImpact?.withinThreshold !== false
      }
    };

    // Save enhanced report
    const enhancedReportPath = resolve(this.config.outputDir, `validation-report-${this.getDeterministicTimestamp()}.json`);
    await fs.writeFile(enhancedReportPath, JSON.stringify(enhancedReport, null, 2));
    
    this.results.enhancedReportPath = enhancedReportPath;
  }

  /**
   * Output validation results
   */
  outputResults() {
    if (this.config.jsonOutput) {
      console.log(JSON.stringify(this.results, null, 2));
      return;
    }

    this.log('\n=====================================');
    this.log('🎯 VALIDATION RESULTS');
    this.log('=====================================\n');

    // Overall results
    this.log(`Overall Reproducibility: ${this.results.reproducibilityScore.toFixed(2)}%`);
    this.log(`Target Reproducibility:  ${this.config.target}%`);
    this.log(`Status: ${this.results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    this.log(`Duration: ${(this.results.duration / 1000).toFixed(1)}s`);

    // Summary statistics
    if (this.results.summary.totalRuns > 0) {
      this.log(`\n📊 Summary:`);
      this.log(`   Test Suites: ${this.results.summary.passedSuites}/${this.results.summary.totalSuites} passed`);
      this.log(`   Total Tests: ${this.results.summary.totalTests}`);
      this.log(`   Total Runs: ${this.results.summary.totalRuns}`);
      this.log(`   Identical Results: ${this.results.summary.identicalRuns} (${((this.results.summary.identicalRuns / this.results.summary.totalRuns) * 100).toFixed(2)}%)`);
    }

    // Issues
    if (this.results.issues.length > 0) {
      this.log(`\n⚠️  Issues Detected (${this.results.issues.length}):`);
      this.results.issues.forEach(issue => {
        const severity = issue.severity === 'critical' ? '🚨' : 
                        issue.severity === 'high' ? '❗' : '⚠️';
        
        if (issue.type === 'non-deterministic-source') {
          this.log(`   ${severity} Non-deterministic source: ${issue.source}`);
        } else if (issue.type === 'critical-failure') {
          this.log(`   ${severity} Critical failure in suite '${issue.suite}': ${issue.score.toFixed(2)}%`);
        } else {
          this.log(`   ${severity} ${issue.type}: ${issue.message || 'Unknown issue'}`);
        }
      });
    }

    // Recommendations
    if (this.results.recommendations.length > 0) {
      this.log(`\n💡 Recommendations (${this.results.recommendations.length}):`);
      this.results.recommendations.forEach(rec => {
        const priority = rec.type === 'critical' ? '🚨' : 
                        rec.type === 'high' ? '❗' : '💡';
        this.log(`   ${priority} ${rec.title}: ${rec.action}`);
      });
    }

    // Report paths
    if (this.results.reportPath) {
      this.log(`\n📄 Reports Generated:`);
      this.log(`   Detailed Report: ${this.results.reportPath}`);
      if (this.results.summaryPath) {
        this.log(`   Summary: ${this.results.summaryPath}`);
      }
      if (this.results.enhancedReportPath) {
        this.log(`   Enhanced Report: ${this.results.enhancedReportPath}`);
      }
    }

    // Final verdict
    this.log('\n=====================================');
    if (this.results.passed) {
      this.log('🎉 REPRODUCIBILITY TARGET ACHIEVED');
      this.log(`KGEN meets the ${this.config.target}% reproducibility requirement`);
    } else {
      this.log('❌ REPRODUCIBILITY TARGET NOT MET');
      this.log(`KGEN scored ${this.results.reproducibilityScore.toFixed(2)}%, below the ${this.config.target}% target`);
      this.log('Review the detailed report and implement recommended fixes');
    }
    this.log('=====================================\n');
  }

  /**
   * Handle validation errors
   */
  handleError(error) {
    this.results.success = false;
    this.results.error = error.message;
    this.results.duration = performance.now() - this.startTime;

    if (this.config.jsonOutput) {
      console.error(JSON.stringify(this.results, null, 2));
    } else {
      this.logError(`❌ Validation failed: ${error.message}`);
      if (this.config.debug && error.stack) {
        this.logError(`Stack trace: ${error.stack}`);
      }
    }

    // Determine appropriate exit code
    let exitCode = 1;
    if (error.message.includes('KGEN binary not found')) {
      exitCode = 3;
    } else if (error.message.includes('initialization failed')) {
      exitCode = 2;
    }

    process.exit(exitCode);
  }

  /**
   * Log message (if not in JSON mode)
   */
  log(message) {
    if (!this.config.jsonOutput) {
      console.log(message);
    }
  }

  /**
   * Log error message
   */
  logError(message) {
    console.error(message);
  }
}

// Create and run validator if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new KGenReproducibilityValidator();
  validator.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default KGenReproducibilityValidator;