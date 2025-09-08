#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dockerDir = join(rootDir, 'docker');
const resultsDir = join(rootDir, 'test-results-docker');

/**
 * Docker Test Runner for Unjucks
 * Orchestrates clean Docker testing environment
 */
class DockerTestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      cleanup: options.cleanup !== false, // Default true
      timeout: options.timeout || 300000, // 5 minutes
      parallel: options.parallel !== false, // Default true
      security: options.security || false,
      ...options
    };
    
    this.composeFile = join(dockerDir, 'docker-compose.test.yml');
    this.results = {
      startTime: Date.now(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    };
  }

  /**
   * Main test execution flow
   */
  async run() {
    try {
      this.log('🐳 Starting Docker test environment...');
      
      // Ensure results directory exists
      this.ensureResultsDir();
      
      // Pre-flight checks
      await this.preflightChecks();
      
      // Build test environment
      await this.buildTestEnvironment();
      
      // Run test suites
      await this.runTestSuites();
      
      // Collect results
      await this.collectResults();
      
      // Generate report
      this.generateReport();
      
      this.log('✅ Docker testing completed successfully');
      return this.results;
      
    } catch (error) {
      this.error('❌ Docker testing failed:', error.message);
      this.results.summary.errors.push(error.message);
      throw error;
    } finally {
      if (this.options.cleanup) {
        await this.cleanup();
      }
    }
  }

  /**
   * Pre-flight system checks
   */
  async preflightChecks() {
    this.log('🔍 Running pre-flight checks...');
    
    // Check Docker availability
    try {
      execSync('docker --version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('Docker is not available. Please install Docker.');
    }
    
    // Check Docker Compose availability
    try {
      execSync('docker compose version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('Docker Compose is not available.');
    }
    
    // Check compose file exists
    if (!existsSync(this.composeFile)) {
      throw new Error(`Docker compose file not found: ${this.composeFile}`);
    }
    
    // Check disk space (minimum 1GB)
    const diskSpace = this.checkDiskSpace();
    if (diskSpace < 1024) {
      throw new Error(`Insufficient disk space: ${diskSpace}MB available, 1GB required`);
    }
    
    this.log('✅ Pre-flight checks passed');
  }

  /**
   * Build clean test environment
   */
  async buildTestEnvironment() {
    this.log('🏗️  Building test environment...');
    
    const buildArgs = [
      'compose',
      '-f', this.composeFile,
      'build',
      '--no-cache',  // Force fresh build
      '--pull'       // Pull latest base images
    ];
    
    if (!this.options.verbose) {
      buildArgs.push('--quiet');
    }
    
    await this.runDockerCommand(buildArgs, 'Build failed');
    this.log('✅ Test environment built');
  }

  /**
   * Run test suites in Docker containers
   */
  async runTestSuites() {
    this.log('🧪 Running test suites...');
    
    const testSuites = [
      {
        name: 'Unit Tests',
        service: 'unjucks-test',
        command: ['npm', 'run', 'test:unit'],
        timeout: 120000 // 2 minutes
      },
      {
        name: 'Integration Tests',
        service: 'unjucks-test',
        command: ['npm', 'run', 'test:integration'],
        timeout: 180000 // 3 minutes
      },
      {
        name: 'Template Generation Tests',
        service: 'unjucks-test',
        command: ['npm', 'run', 'test:templates'],
        timeout: 60000 // 1 minute
      }
    ];

    // Add security tests if enabled
    if (this.options.security) {
      testSuites.push({
        name: 'Security Tests',
        service: 'unjucks-security-test',
        command: ['npm', 'run', 'test:security'],
        timeout: 90000, // 1.5 minutes
        profile: 'security'
      });
    }

    // Run tests in parallel or sequential
    if (this.options.parallel) {
      await this.runTestsParallel(testSuites);
    } else {
      await this.runTestsSequential(testSuites);
    }
  }

  /**
   * Run tests in parallel
   */
  async runTestsParallel(testSuites) {
    this.log('⚡ Running tests in parallel...');
    
    const promises = testSuites.map(suite => this.runTestSuite(suite));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.results.summary.errors.push(`${testSuites[index].name}: ${result.reason.message}`);
      }
    });
  }

  /**
   * Run tests sequentially
   */
  async runTestsSequential(testSuites) {
    this.log('📝 Running tests sequentially...');
    
    for (const suite of testSuites) {
      try {
        await this.runTestSuite(suite);
      } catch (error) {
        this.results.summary.errors.push(`${suite.name}: ${error.message}`);
        if (!this.options.continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suite) {
    const startTime = Date.now();
    this.log(`🔧 Running ${suite.name}...`);
    
    try {
      const args = [
        'compose',
        '-f', this.composeFile
      ];
      
      if (suite.profile) {
        args.push('--profile', suite.profile);
      }
      
      args.push('run', '--rm', suite.service, ...suite.command);
      
      const result = await this.runDockerCommand(args, `${suite.name} failed`, {
        timeout: suite.timeout || 120000
      });
      
      const duration = Date.now() - startTime;
      this.results.tests.push({
        name: suite.name,
        status: 'passed',
        duration,
        output: result.stdout
      });
      
      this.results.summary.passed++;
      this.log(`✅ ${suite.name} passed (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.tests.push({
        name: suite.name,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.results.summary.failed++;
      this.error(`❌ ${suite.name} failed (${duration}ms):`, error.message);
      throw error;
    }
    
    this.results.summary.total++;
  }

  /**
   * Collect test results from containers
   */
  async collectResults() {
    this.log('📊 Collecting test results...');
    
    try {
      // Copy test artifacts from containers
      const copyCommands = [
        {
          source: 'unjucks-test-runner:/app/coverage',
          dest: join(resultsDir, 'coverage')
        },
        {
          source: 'unjucks-test-runner:/app/test-results',
          dest: join(resultsDir, 'test-results')
        },
        {
          source: 'unjucks-test-runner:/app/logs',
          dest: join(resultsDir, 'logs')
        }
      ];
      
      for (const { source, dest } of copyCommands) {
        try {
          execSync(`docker cp ${source} ${dest}`, { stdio: 'ignore' });
        } catch (error) {
          // Non-critical - continue if artifacts don't exist
          this.log(`⚠️  Could not copy ${source} (may not exist)`);
        }
      }
      
    } catch (error) {
      this.log('⚠️  Failed to collect some results:', error.message);
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    this.log('📄 Generating test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.results.startTime,
      environment: {
        node: process.version,
        platform: process.platform,
        docker: this.getDockerVersion()
      },
      summary: this.results.summary,
      tests: this.results.tests,
      options: this.options
    };
    
    // Write JSON report
    const reportPath = join(resultsDir, 'docker-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Write human-readable summary
    const summaryPath = join(resultsDir, 'test-summary.txt');
    const summary = this.formatSummary(report);
    writeFileSync(summaryPath, summary);
    
    this.log(`📄 Reports generated: ${reportPath}, ${summaryPath}`);
    
    // Print summary to console
    console.log('\n' + '='.repeat(60));
    console.log('DOCKER TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(summary);
    console.log('='.repeat(60));
  }

  /**
   * Format test summary for display
   */
  formatSummary(report) {
    const { summary, duration, tests } = report;
    const durationSec = (duration / 1000).toFixed(2);
    
    let output = `Total Duration: ${durationSec}s\n`;
    output += `Total Tests: ${summary.total}\n`;
    output += `Passed: ${summary.passed}\n`;
    output += `Failed: ${summary.failed}\n`;
    output += `Success Rate: ${summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0}%\n\n`;
    
    if (tests.length > 0) {
      output += 'Test Results:\n';
      tests.forEach(test => {
        const status = test.status === 'passed' ? '✅' : '❌';
        const duration = (test.duration / 1000).toFixed(2);
        output += `  ${status} ${test.name} (${duration}s)\n`;
        
        if (test.error) {
          output += `     Error: ${test.error}\n`;
        }
      });
    }
    
    if (summary.errors.length > 0) {
      output += '\nErrors:\n';
      summary.errors.forEach((error, index) => {
        output += `  ${index + 1}. ${error}\n`;
      });
    }
    
    return output;
  }

  /**
   * Cleanup Docker resources
   */
  async cleanup() {
    this.log('🧹 Cleaning up Docker resources...');
    
    try {
      // Stop and remove containers
      await this.runDockerCommand([
        'compose', '-f', this.composeFile, 'down', '--volumes', '--remove-orphans'
      ], null, { ignoreError: true });
      
      // Remove test images
      try {
        execSync('docker image prune -f --filter label=maintainer=unjucks-test', { stdio: 'ignore' });
      } catch (error) {
        // Ignore cleanup errors
      }
      
      this.log('✅ Cleanup completed');
    } catch (error) {
      this.log('⚠️  Cleanup warning:', error.message);
    }
  }

  /**
   * Run Docker command with proper error handling
   */
  async runDockerCommand(args, errorMessage, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn('docker', args, {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: rootDir
      });
      
      let stdout = '';
      let stderr = '';
      
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      if (process.stderr) {
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      const timeout = options.timeout || this.options.timeout;
      const timer = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
      
      process.on('close', (code) => {
        clearTimeout(timer);
        
        if (code === 0 || options.ignoreError) {
          resolve({ stdout, stderr, code });
        } else {
          const error = new Error(errorMessage || `Docker command failed with code ${code}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });
      
      process.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Utility methods
   */
  ensureResultsDir() {
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }
  }

  checkDiskSpace() {
    try {
      const result = execSync('df -m . | tail -1 | awk \'{print $4}\'', { encoding: 'utf8' });
      return parseInt(result.trim(), 10);
    } catch (error) {
      return 2048; // Assume 2GB available if check fails
    }
  }

  getDockerVersion() {
    try {
      return execSync('docker --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  log(message) {
    if (this.options.verbose || process.env.VERBOSE) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  error(message, details) {
    console.error(`[${new Date().toISOString()}] ${message}`);
    if (details && this.options.verbose) {
      console.error(details);
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    cleanup: !args.includes('--no-cleanup'),
    parallel: !args.includes('--sequential'),
    security: args.includes('--security'),
    continueOnError: args.includes('--continue-on-error'),
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 300000
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Docker Test Runner for Unjucks

Usage: node docker-test-runner.js [options]

Options:
  --verbose, -v          Show detailed output
  --no-cleanup           Don't cleanup Docker resources
  --sequential           Run tests sequentially instead of parallel
  --security             Include security tests
  --continue-on-error    Continue running tests after failures
  --timeout=<ms>         Set timeout in milliseconds (default: 300000)
  --help, -h             Show this help

Examples:
  node docker-test-runner.js --verbose
  node docker-test-runner.js --security --sequential
  node docker-test-runner.js --no-cleanup --timeout=600000
    `);
    process.exit(0);
  }
  
  const runner = new DockerTestRunner(options);
  
  try {
    const results = await runner.run();
    const exitCode = results.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DockerTestRunner };