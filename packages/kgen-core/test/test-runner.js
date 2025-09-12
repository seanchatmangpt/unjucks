#!/usr/bin/env node
/**
 * KGEN Core Test Runner
 * Orchestrates comprehensive testing with determinism validation
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

class KGenTestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Unit Tests',
        command: 'npm',
        args: ['run', 'test:unit'],
        required: true,
        timeout: 30000
      },
      {
        name: 'Integration Tests',
        command: 'npm',
        args: ['run', 'test:integration'],
        required: true,
        timeout: 60000
      },
      {
        name: 'Performance Benchmarks',
        command: 'npm',
        args: ['run', 'test:performance'],
        required: false,
        timeout: 120000
      },
      {
        name: 'Security & Compliance',
        command: 'npm',
        args: ['run', 'test:compliance'],
        required: true,
        timeout: 45000
      },
      {
        name: 'Determinism Validation',
        command: 'npm',
        args: ['run', 'test:determinism'],
        required: true,
        timeout: 90000
      }
    ];
    
    this.results = [];
    this.startTime = this.getDeterministicTimestamp();
  }

  async run(options = {}) {
    console.log(chalk.blue.bold('🧪 KGEN Core Test Suite'));
    console.log(chalk.gray('Testing for determinism, correctness, and compliance\n'));

    // Setup test environment
    await this.setupEnvironment();

    // Run test suites
    for (const suite of this.testSuites) {
      if (options.suite && options.suite !== suite.name.toLowerCase().replace(/\s+/g, '_')) {
        continue;
      }

      await this.runTestSuite(suite);
    }

    // Generate report
    await this.generateReport();

    // Exit with appropriate code
    const hasFailures = this.results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
  }

  async setupEnvironment() {
    console.log(chalk.yellow('📋 Setting up test environment...'));
    
    // Create test directories
    await fs.ensureDir('test-results');
    await fs.ensureDir('coverage');
    
    // Clean previous results
    await fs.emptyDir('test-results');
    await fs.emptyDir('coverage');
    
    console.log(chalk.green('✅ Environment ready\n'));
  }

  async runTestSuite(suite) {
    console.log(chalk.blue(`🔍 Running ${suite.name}...`));
    
    const startTime = this.getDeterministicTimestamp();
    
    try {
      const result = await this.executeCommand(suite.command, suite.args, {
        timeout: suite.timeout,
        cwd: process.cwd()
      });
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      this.results.push({
        name: suite.name,
        success: result.exitCode === 0,
        duration,
        output: result.stdout,
        error: result.stderr,
        required: suite.required
      });
      
      if (result.exitCode === 0) {
        console.log(chalk.green(`✅ ${suite.name} passed (${duration}ms)`));
      } else {
        console.log(chalk.red(`❌ ${suite.name} failed (${duration}ms)`));
        if (result.stderr) {
          console.log(chalk.red(`Error: ${result.stderr}`));
        }
      }
      
    } catch (error) {
      const duration = this.getDeterministicTimestamp() - startTime;
      
      this.results.push({
        name: suite.name,
        success: false,
        duration,
        error: error.message,
        required: suite.required
      });
      
      console.log(chalk.red(`❌ ${suite.name} failed with error: ${error.message}`));
    }
    
    console.log('');
  }

  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      child.on('error', reject);

      // Timeout handling
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  }

  async generateReport() {
    const totalDuration = this.getDeterministicTimestamp() - this.startTime;
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const requiredFailures = this.results.filter(r => !r.success && r.required).length;

    console.log(chalk.blue.bold('\n📊 Test Results Summary'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Overall statistics
    console.log(`Total Duration: ${chalk.cyan(totalDuration + 'ms')}`);
    console.log(`Test Suites: ${chalk.cyan(totalTests)}`);
    console.log(`Passed: ${chalk.green(passedTests)}`);
    console.log(`Failed: ${failedTests > 0 ? chalk.red(failedTests) : chalk.green(failedTests)}`);
    console.log(`Required Failures: ${requiredFailures > 0 ? chalk.red(requiredFailures) : chalk.green(requiredFailures)}`);
    
    console.log(chalk.gray('\nDetailed Results:'));
    
    // Detailed results
    for (const result of this.results) {
      const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
      const required = result.required ? '(Required)' : '(Optional)';
      const duration = chalk.gray(`${result.duration}ms`);
      
      console.log(`  ${status} ${result.name} ${required} ${duration}`);
      
      if (!result.success && result.error) {
        console.log(chalk.red(`    Error: ${result.error}`));
      }
    }

    // Generate JSON report
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: {
        totalDuration,
        totalTests,
        passedTests,
        failedTests,
        requiredFailures,
        success: requiredFailures === 0
      },
      results: this.results
    };

    await fs.writeJson('test-results/summary.json', report, { spaces: 2 });

    // Final status
    console.log(chalk.gray('\n' + '='.repeat(50)));
    
    if (requiredFailures === 0) {
      console.log(chalk.green.bold('🎉 All required tests passed!'));
      
      if (failedTests > 0) {
        console.log(chalk.yellow('⚠️  Some optional tests failed, but this is not critical.'));
      }
      
      console.log(chalk.green('✅ KGEN Core is ready for production deployment.'));
    } else {
      console.log(chalk.red.bold('❌ Required tests failed!'));
      console.log(chalk.red('🚫 KGEN Core is NOT ready for deployment.'));
      console.log(chalk.yellow('🔧 Please fix failing tests before proceeding.'));
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--suite' && args[i + 1]) {
      options.suite = args[i + 1];
      i++;
    } else if (arg === '--help') {
      console.log(`
KGEN Core Test Runner

Usage: node test-runner.js [options]

Options:
  --suite <name>    Run specific test suite
  --help           Show this help message

Available test suites:
  - unit_tests
  - integration_tests
  - performance_benchmarks
  - security_compliance
  - determinism_validation

Examples:
  node test-runner.js                    # Run all tests
  node test-runner.js --suite unit_tests # Run only unit tests
      `);
      process.exit(0);
    }
  }
  
  const runner = new KGenTestRunner();
  runner.run(options).catch(error => {
    console.error(chalk.red('Test runner failed:'), error);
    process.exit(1);
  });
}

export { KGenTestRunner };