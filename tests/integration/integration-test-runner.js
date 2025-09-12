#!/usr/bin/env node

/**
 * Integration Test Runner
 * Orchestrates comprehensive integration test execution with reporting
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes
  parallel: process.env.CI ? false : true,
  coverage: true,
  retries: 2,
  verbose: true
};

// Test suites
const TEST_SUITES = [
  {
    name: 'Smoke Tests',
    file: 'smoke-tests.js',
    priority: 1,
    timeout: 30000,
    required: true,
    description: 'Fast validation of critical functionality'
  },
  {
    name: 'API Contract Tests',
    file: 'api-contract-tests.js',
    priority: 2,
    timeout: 60000,
    required: true,
    description: 'API contract validation and schema testing'
  },
  {
    name: 'Database Migration Tests',
    file: 'database-migration-tests.js',
    priority: 2,
    timeout: 120000,
    required: false,
    description: 'Database operations and migration testing',
    dependencies: ['docker-compose']
  },
  {
    name: 'End-to-End User Journeys',
    file: 'e2e-user-journeys.js',
    priority: 3,
    timeout: 180000,
    required: true,
    description: 'Complete user workflow simulation'
  },
  {
    name: 'Third-Party Integration Tests',
    file: 'third-party-integration-tests.js',
    priority: 3,
    timeout: 90000,
    required: false,
    description: 'External service integration testing'
  },
  {
    name: 'Environment Isolation Tests',
    file: 'environment-isolation.js',
    priority: 4,
    timeout: 60000,
    required: true,
    description: 'Environment isolation and test configuration'
  }
];

/**
 * Test Runner Class
 */
class IntegrationTestRunner {
  constructor() {
    this.results = {
      startTime: null,
      endTime: null,
      duration: 0,
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      skippedSuites: 0,
      suites: [],
      summary: {},
      coverage: {},
      errors: []
    };
    
    this.options = {
      filter: null,
      skipOptional: false,
      dryRun: false,
      verbose: TEST_CONFIG.verbose,
      coverage: TEST_CONFIG.coverage,
      parallel: TEST_CONFIG.parallel,
      retries: TEST_CONFIG.retries
    };
  }

  /**
   * Parse command line arguments
   */
  parseArguments() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--filter':
        case '-f':
          this.options.filter = args[++i];
          break;
        case '--skip-optional':
          this.options.skipOptional = true;
          break;
        case '--dry-run':
          this.options.dryRun = true;
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--quiet':
        case '-q':
          this.options.verbose = false;
          break;
        case '--no-coverage':
          this.options.coverage = false;
          break;
        case '--sequential':
          this.options.parallel = false;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          console.warn(`Unknown argument: ${arg}`);
      }
    }
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(`
Integration Test Runner

Usage: node integration-test-runner.js [options]

Options:
  -f, --filter <pattern>     Run only tests matching pattern
  --skip-optional           Skip optional test suites
  --dry-run                 Show what would be run without executing
  -v, --verbose             Verbose output
  -q, --quiet               Minimal output
  --no-coverage             Disable coverage collection
  --sequential              Run tests sequentially instead of parallel
  -h, --help                Show this help message

Test Suites:
${TEST_SUITES.map(suite => 
  `  • ${suite.name} (${suite.required ? 'required' : 'optional'})\n    ${suite.description}`
).join('\n')}

Examples:
  node integration-test-runner.js                    # Run all tests
  node integration-test-runner.js --filter smoke     # Run only smoke tests
  node integration-test-runner.js --skip-optional    # Run only required tests
  node integration-test-runner.js --dry-run          # Preview test execution
    `);
  }

  /**
   * Check dependencies
   */
  async checkDependencies() {
    const checks = {
      node: this.checkNodeVersion(),
      docker: this.checkDocker(),
      vitest: this.checkVitest()
    };

    const results = {};
    for (const [name, check] of Object.entries(checks)) {
      try {
        results[name] = await check;
      } catch (error) {
        results[name] = { available: false, error: error.message };
      }
    }

    return results;
  }

  checkNodeVersion() {
    return new Promise((resolve) => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      resolve({
        available: major >= 18,
        version,
        message: major >= 18 ? 'OK' : 'Node.js 18+ required'
      });
    });
  }

  checkDocker() {
    return new Promise((resolve) => {
      try {
        const output = execSync('docker --version', { encoding: 'utf8', stdio: 'pipe' });
        resolve({
          available: true,
          version: output.trim(),
          message: 'OK'
        });
      } catch (error) {
        resolve({
          available: false,
          message: 'Docker not available (optional for some tests)'
        });
      }
    });
  }

  checkVitest() {
    return new Promise((resolve) => {
      try {
        const output = execSync('npx vitest --version', { encoding: 'utf8', stdio: 'pipe' });
        resolve({
          available: true,
          version: output.trim(),
          message: 'OK'
        });
      } catch (error) {
        resolve({
          available: false,
          error: error.message,
          message: 'Vitest not available'
        });
      }
    });
  }

  /**
   * Filter test suites based on options
   */
  filterTestSuites() {
    let suites = [...TEST_SUITES];

    // Apply filter
    if (this.options.filter) {
      const filter = this.options.filter.toLowerCase();
      suites = suites.filter(suite => 
        suite.name.toLowerCase().includes(filter) ||
        suite.file.toLowerCase().includes(filter)
      );
    }

    // Skip optional suites if requested
    if (this.options.skipOptional) {
      suites = suites.filter(suite => suite.required);
    }

    // Sort by priority
    suites.sort((a, b) => a.priority - b.priority);

    return suites;
  }

  /**
   * Check if test file exists
   */
  async checkTestFile(suite) {
    const filePath = path.join(__dirname, suite.file);
    const exists = await fs.pathExists(filePath);
    
    return {
      exists,
      path: filePath,
      size: exists ? (await fs.stat(filePath)).size : 0
    };
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suite) {
    const suiteResult = {
      name: suite.name,
      file: suite.file,
      startTime: performance.now(),
      endTime: null,
      duration: 0,
      success: false,
      output: '',
      error: null,
      coverage: null,
      retries: 0,
      skipped: false
    };

    try {
      // Check if test file exists
      const fileCheck = await this.checkTestFile(suite);
      if (!fileCheck.exists) {
        suiteResult.error = `Test file not found: ${suite.file}`;
        suiteResult.skipped = true;
        return suiteResult;
      }

      if (this.options.dryRun) {
        suiteResult.success = true;
        suiteResult.output = `[DRY RUN] Would execute: ${suite.name}`;
        suiteResult.endTime = performance.now();
        suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
        return suiteResult;
      }

      // Build vitest command
      const vitestCommand = this.buildVitestCommand(suite);
      
      // Execute with retries
      let lastError = null;
      for (let attempt = 0; attempt <= this.options.retries; attempt++) {
        if (attempt > 0) {
          suiteResult.retries = attempt;
          if (this.options.verbose) {
            console.log(`    Retry ${attempt}/${this.options.retries} for ${suite.name}`);
          }
        }

        try {
          const output = execSync(vitestCommand, {
            encoding: 'utf8',
            timeout: suite.timeout,
            stdio: 'pipe',
            cwd: path.resolve(__dirname, '../..')
          });

          suiteResult.success = true;
          suiteResult.output = output;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < this.options.retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

    } catch (error) {
      suiteResult.success = false;
      suiteResult.error = error.message;
      suiteResult.output = error.stdout || error.stderr || '';
    }

    suiteResult.endTime = performance.now();
    suiteResult.duration = suiteResult.endTime - suiteResult.startTime;

    return suiteResult;
  }

  /**
   * Build vitest command for test suite
   */
  buildVitestCommand(suite) {
    const parts = ['npx', 'vitest', 'run'];
    
    // Add coverage if enabled
    if (this.options.coverage) {
      parts.push('--coverage');
    }
    
    // Add reporter
    if (this.options.verbose) {
      parts.push('--reporter=verbose');
    } else {
      parts.push('--reporter=basic');
    }
    
    // Add timeout
    parts.push(`--testTimeout=${suite.timeout}`);
    
    // Add test file
    parts.push(path.join('tests/integration', suite.file));
    
    return parts.join(' ');
  }

  /**
   * Run all test suites
   */
  async runTests() {
    this.results.startTime = performance.now();
    
    if (this.options.verbose) {
      console.log('\n🧪 Starting Integration Test Suite');
      console.log('=====================================');
    }

    // Check dependencies
    const deps = await this.checkDependencies();
    if (this.options.verbose) {
      console.log('\n📋 Dependency Check:');
      for (const [name, result] of Object.entries(deps)) {
        const status = result.available ? '✅' : '❌';
        console.log(`  ${status} ${name}: ${result.message || result.version || result.error}`);
      }
    }

    // Filter test suites
    const suites = this.filterTestSuites();
    this.results.totalSuites = suites.length;

    if (suites.length === 0) {
      console.log('\n⚠️  No test suites match the criteria');
      return this.results;
    }

    if (this.options.verbose) {
      console.log(`\n🎯 Test Suites to Run: ${suites.length}`);
      suites.forEach((suite, i) => {
        console.log(`  ${i + 1}. ${suite.name} (${suite.required ? 'required' : 'optional'})`);
      });
    }

    if (this.options.dryRun) {
      console.log('\n🔍 Dry Run Mode - No tests will be executed');
    }

    console.log('\n🚀 Executing Test Suites...\n');

    // Run test suites
    if (this.options.parallel && suites.length > 1) {
      // Run in parallel (limited concurrency)
      const batchSize = 3;
      for (let i = 0; i < suites.length; i += batchSize) {
        const batch = suites.slice(i, i + batchSize);
        const promises = batch.map(async (suite) => {
          if (this.options.verbose) {
            console.log(`📝 Running: ${suite.name}`);
          }
          return await this.runTestSuite(suite);
        });
        
        const batchResults = await Promise.all(promises);
        this.results.suites.push(...batchResults);
        
        // Report batch results
        for (const result of batchResults) {
          this.reportSuiteResult(result);
        }
      }
    } else {
      // Run sequentially
      for (const suite of suites) {
        if (this.options.verbose) {
          console.log(`📝 Running: ${suite.name}`);
        }
        
        const result = await this.runTestSuite(suite);
        this.results.suites.push(result);
        this.reportSuiteResult(result);
      }
    }

    this.results.endTime = performance.now();
    this.results.duration = this.results.endTime - this.results.startTime;

    // Calculate summary
    this.calculateSummary();

    return this.results;
  }

  /**
   * Report individual suite result
   */
  reportSuiteResult(result) {
    const duration = Math.round(result.duration);
    const retryInfo = result.retries > 0 ? ` (${result.retries} retries)` : '';
    
    if (result.skipped) {
      console.log(`  ⏭️  ${result.name}: SKIPPED (${result.error})`);
      this.results.skippedSuites++;
    } else if (result.success) {
      console.log(`  ✅ ${result.name}: PASSED (${duration}ms)${retryInfo}`);
      this.results.passedSuites++;
    } else {
      console.log(`  ❌ ${result.name}: FAILED (${duration}ms)${retryInfo}`);
      console.log(`     Error: ${result.error}`);
      this.results.failedSuites++;
      
      if (this.options.verbose && result.output) {
        console.log(`     Output: ${result.output.slice(0, 200)}...`);
      }
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    const totalDuration = Math.round(this.results.duration);
    
    this.results.summary = {
      total: this.results.totalSuites,
      passed: this.results.passedSuites,
      failed: this.results.failedSuites,
      skipped: this.results.skippedSuites,
      duration: totalDuration,
      success: this.results.failedSuites === 0,
      passRate: this.results.totalSuites > 0 ? 
        Math.round((this.results.passedSuites / this.results.totalSuites) * 100) : 0
    };

    // Collect errors
    this.results.errors = this.results.suites
      .filter(suite => !suite.success && !suite.skipped)
      .map(suite => ({
        suite: suite.name,
        error: suite.error,
        output: suite.output
      }));
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI
      },
      configuration: this.options,
      results: this.results
    };

    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);
    
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const filename = `integration-test-report-${timestamp}.json`;
    const filepath = path.join(reportsDir, filename);
    
    await fs.writeJson(filepath, report, { spaces: 2 });
    
    return filepath;
  }

  /**
   * Print final summary
   */
  printSummary() {
    const { summary } = this.results;
    
    console.log('\n📊 Integration Test Summary');
    console.log('============================');
    console.log(`Total Suites: ${summary.total}`);
    console.log(`Passed: ${summary.passed} ✅`);
    console.log(`Failed: ${summary.failed} ❌`);
    console.log(`Skipped: ${summary.skipped} ⏭️`);
    console.log(`Duration: ${summary.duration}ms`);
    console.log(`Pass Rate: ${summary.passRate}%`);
    
    if (summary.success) {
      console.log('\n🎉 All integration tests passed!');
    } else {
      console.log('\n💥 Some integration tests failed:');
      this.results.errors.forEach(error => {
        console.log(`  • ${error.suite}: ${error.error}`);
      });
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    console.log(`\nMemory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      this.parseArguments();
      
      const results = await this.runTests();
      const report = this.generateReport();
      
      if (this.options.verbose) {
        const reportPath = await this.saveReport(report);
        console.log(`\n📄 Report saved to: ${reportPath}`);
      }
      
      this.printSummary();
      
      // Exit with appropriate code
      process.exit(results.summary.success ? 0 : 1);
      
    } catch (error) {
      console.error('\n❌ Integration test runner failed:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// Store test runner patterns in memory
const testRunnerPatterns = {
  orchestration: {
    description: 'Test suite orchestration and execution management',
    implementation: 'IntegrationTestRunner with priority-based execution',
    coverage: ['suite filtering', 'parallel execution', 'retry logic', 'dependency checking']
  },
  reporting: {
    description: 'Comprehensive test result reporting',
    implementation: 'Detailed reporting with JSON output and summary statistics',
    coverage: ['individual results', 'summary statistics', 'error collection', 'performance metrics']
  },
  configuration: {
    description: 'Flexible test configuration and command-line interface',
    implementation: 'CLI argument parsing with multiple execution modes',
    coverage: ['filtering options', 'execution modes', 'verbosity levels', 'dry-run capability']
  },
  resilience: {
    description: 'Error handling and retry mechanisms',
    implementation: 'Exponential backoff retry with graceful failure handling',
    coverage: ['retry logic', 'timeout handling', 'dependency validation', 'graceful degradation']
  }
};

console.log('Test runner patterns stored in memory:', Object.keys(testRunnerPatterns));

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new IntegrationTestRunner();
  runner.run();
}

export { testRunnerPatterns, IntegrationTestRunner };