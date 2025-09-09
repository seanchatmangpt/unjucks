#!/usr/bin/env node

/**
 * Comprehensive Docker Container Testing Validation Runner
 * Orchestrates all Docker testing phases with cleanup and reporting
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class DockerTestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      security: options.security || false,
      cleanup: options.cleanup !== false,
      parallel: options.parallel !== false,
      reportDir: './tests/docker/results',
      ...options
    };
    
    this.testSuites = [
      {
        name: 'Docker Environment Setup',
        file: 'tests/docker/docker-environment-setup.test.js',
        priority: 1,
        required: true
      },
      {
        name: 'Container Security',
        file: 'tests/docker/container-security.test.js', 
        priority: 2,
        required: true
      },
      {
        name: 'Containerized Test Execution',
        file: 'tests/docker/containerized-test-execution.test.js',
        priority: 3,
        required: true
      },
      {
        name: 'Resource Management',
        file: 'tests/docker/resource-management.test.js',
        priority: 4,
        required: true
      },
      {
        name: 'CI/CD Pipeline Integration',
        file: 'tests/docker/cicd-pipeline.test.js',
        priority: 5,
        required: false
      }
    ];
    
    this.results = {
      startTime: new Date(),
      endTime: null,
      duration: 0,
      testSuites: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        passRate: 0
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        dockerVersion: null,
        dockerComposeVersion: null
      }
    };
  }

  async run() {
    try {
      console.log(chalk.blue.bold('🐳 Docker Container Testing Validation'));
      console.log(chalk.gray('=========================================='));
      
      await this.setupEnvironment();
      await this.validatePrerequisites();
      await this.runTestSuites();
      await this.generateReport();
      
      if (this.options.cleanup) {
        await this.cleanup();
      }
      
      this.displaySummary();
      
      // Exit with appropriate code
      const passRate = this.results.summary.passRate;
      if (passRate >= 95) {
        console.log(chalk.green.bold(`✅ Docker validation PASSED (${passRate.toFixed(1)}% pass rate)`));
        process.exit(0);
      } else {
        console.log(chalk.red.bold(`❌ Docker validation FAILED (${passRate.toFixed(1)}% pass rate)`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red.bold('💥 Docker validation failed:'), error.message);
      process.exit(1);
    }
  }

  async setupEnvironment() {
    console.log(chalk.yellow('📁 Setting up test environment...'));
    
    // Ensure directories exist
    await fs.ensureDir(this.options.reportDir);
    await fs.ensureDir('./tests/docker/logs');
    await fs.ensureDir('./config/docker');
    
    // Capture environment info
    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
      this.results.environment.dockerVersion = dockerVersion;
      
      const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
      this.results.environment.dockerComposeVersion = composeVersion;
    } catch (error) {
      throw new Error('Docker or Docker Compose not available');
    }
    
    if (this.options.verbose) {
      console.log(chalk.gray(`  Node: ${this.results.environment.nodeVersion}`));
      console.log(chalk.gray(`  Docker: ${this.results.environment.dockerVersion}`));
      console.log(chalk.gray(`  Compose: ${this.results.environment.dockerComposeVersion}`));
    }
  }

  async validatePrerequisites() {
    console.log(chalk.yellow('🔍 Validating prerequisites...'));
    
    // Check Docker daemon
    try {
      execSync('docker info', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Docker daemon is not running');
    }
    
    // Check available disk space (need at least 2GB)
    try {
      const df = execSync('df -h .', { encoding: 'utf8' });
      const availableGB = this.parseAvailableSpace(df);
      if (availableGB < 2) {
        console.warn(chalk.yellow(`⚠️  Low disk space: ${availableGB}GB available`));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not check disk space'));
    }
    
    // Cleanup old test resources
    console.log(chalk.gray('  Cleaning up old test resources...'));
    try {
      execSync('docker container prune -f', { stdio: 'pipe' });
      execSync('docker image prune -f', { stdio: 'pipe' });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not cleanup old resources'));
    }
  }

  parseAvailableSpace(dfOutput) {
    const lines = dfOutput.split('\n');
    const dataLine = lines.find(line => line.includes('/')) || lines[1];
    const parts = dataLine.split(/\s+/);
    const availableStr = parts[3] || '0G';
    const availableNum = parseFloat(availableStr.replace(/[^0-9.]/g, ''));
    const unit = availableStr.slice(-1).toUpperCase();
    
    if (unit === 'T') return availableNum * 1000;
    if (unit === 'G') return availableNum;
    if (unit === 'M') return availableNum / 1000;
    return availableNum / 1000000; // Assume KB
  }

  async runTestSuites() {
    console.log(chalk.yellow('🧪 Running Docker test suites...'));
    
    // Sort by priority
    const sortedSuites = this.testSuites.sort((a, b) => a.priority - b.priority);
    
    if (this.options.parallel && !this.options.security) {
      await this.runParallelTests(sortedSuites);
    } else {
      await this.runSequentialTests(sortedSuites);
    }
  }

  async runSequentialTests(suites) {
    for (const suite of suites) {
      console.log(chalk.cyan(`  Running: ${suite.name}`));
      
      const startTime = Date.now();
      const result = await this.runSingleTest(suite);
      const duration = Date.now() - startTime;
      
      result.duration = duration;
      result.timestamp = new Date().toISOString();
      this.results.testSuites.push(result);
      
      if (result.status === 'failed' && suite.required) {
        console.log(chalk.red(`    ❌ Required test failed: ${suite.name}`));
        break;
      } else if (result.status === 'passed') {
        console.log(chalk.green(`    ✅ ${suite.name} (${duration}ms)`));
      } else {
        console.log(chalk.yellow(`    ⚠️  ${suite.name} (${result.status})`));
      }
    }
  }

  async runParallelTests(suites) {
    const promises = suites.map(async (suite) => {
      console.log(chalk.cyan(`  Starting: ${suite.name}`));
      
      const startTime = Date.now();
      const result = await this.runSingleTest(suite);
      const duration = Date.now() - startTime;
      
      result.duration = duration;
      result.timestamp = new Date().toISOString();
      
      return result;
    });
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((promiseResult, index) => {
      const suite = suites[index];
      if (promiseResult.status === 'fulfilled') {
        this.results.testSuites.push(promiseResult.value);
        const result = promiseResult.value;
        
        if (result.status === 'passed') {
          console.log(chalk.green(`    ✅ ${suite.name} (${result.duration}ms)`));
        } else {
          console.log(chalk.yellow(`    ⚠️  ${suite.name} (${result.status})`));
        }
      } else {
        console.log(chalk.red(`    ❌ ${suite.name} failed with error`));
        this.results.testSuites.push({
          name: suite.name,
          status: 'failed',
          error: promiseResult.reason.message,
          duration: 0,
          tests: { total: 0, passed: 0, failed: 1 }
        });
      }
    });
  }

  async runSingleTest(suite) {
    try {
      const vitestCmd = `npx vitest run ${suite.file} --reporter=json --reporter=verbose`;
      const output = execSync(vitestCmd, { 
        encoding: 'utf8',
        timeout: 300000, // 5 minute timeout per suite
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      // Save test output
      const logFile = path.join('./tests/docker/logs', `${suite.name.toLowerCase().replace(/\s+/g, '-')}.log`);
      await fs.writeFile(logFile, output);
      
      // Parse test results
      const jsonMatch = output.match(/\\{[^}]*"testResults"[^}]*\\}/);
      let testStats = { total: 0, passed: 0, failed: 0 };
      
      if (jsonMatch) {
        try {
          const results = JSON.parse(jsonMatch[0]);
          testStats = this.parseVitestResults(results);
        } catch (error) {
          // Fallback to text parsing
          testStats = this.parseTextResults(output);
        }
      } else {
        testStats = this.parseTextResults(output);
      }
      
      return {
        name: suite.name,
        status: testStats.failed === 0 ? 'passed' : 'failed',
        tests: testStats,
        output: output.substring(0, 1000) // Truncate for report
      };
      
    } catch (error) {
      return {
        name: suite.name,
        status: 'failed',
        error: error.message,
        tests: { total: 0, passed: 0, failed: 1 },
        output: error.stdout || error.message
      };
    }
  }

  parseVitestResults(results) {
    // Parse Vitest JSON output
    let total = 0, passed = 0, failed = 0;
    
    if (results.testResults) {
      results.testResults.forEach(file => {
        if (file.assertionResults) {
          file.assertionResults.forEach(test => {
            total++;
            if (test.status === 'passed') passed++;
            else failed++;
          });
        }
      });
    }
    
    return { total, passed, failed };
  }

  parseTextResults(output) {
    // Fallback text parsing
    const passedMatches = output.match(/✓/g) || [];
    const failedMatches = output.match(/✗/g) || [];
    const passed = passedMatches.length;
    const failed = failedMatches.length;
    const total = passed + failed;
    
    return { total, passed, failed };
  }

  async generateReport() {
    console.log(chalk.yellow('📊 Generating test report...'));
    
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
    
    // Calculate summary statistics
    this.results.summary = this.results.testSuites.reduce((acc, suite) => {
      acc.total += suite.tests.total;
      acc.passed += suite.tests.passed;
      acc.failed += suite.tests.failed;
      return acc;
    }, { total: 0, passed: 0, failed: 0, skipped: 0 });
    
    this.results.summary.passRate = this.results.summary.total > 0 
      ? (this.results.summary.passed / this.results.summary.total) * 100 
      : 0;
    
    // Generate detailed report
    const reportPath = path.join(this.options.reportDir, 'docker-validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate markdown summary
    const mdReport = this.generateMarkdownReport();
    const mdPath = path.join(this.options.reportDir, 'docker-validation-summary.md');
    await fs.writeFile(mdPath, mdReport);
    
    if (this.options.verbose) {
      console.log(chalk.gray(`  Report saved: ${reportPath}`));
      console.log(chalk.gray(`  Summary saved: ${mdPath}`));
    }
  }

  generateMarkdownReport() {
    const { summary, testSuites, duration, environment } = this.results;
    
    return `# Docker Container Testing Validation Report

## Summary
- **Total Tests**: ${summary.total}
- **Passed**: ${summary.passed} ✅
- **Failed**: ${summary.failed} ❌
- **Pass Rate**: ${summary.passRate.toFixed(1)}%
- **Duration**: ${Math.round(duration / 1000)}s

## Environment
- **Node Version**: ${environment.nodeVersion}
- **Platform**: ${environment.platform}
- **Docker**: ${environment.dockerVersion}
- **Docker Compose**: ${environment.dockerComposeVersion}

## Test Suites

${testSuites.map(suite => `
### ${suite.name}
- **Status**: ${suite.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- **Tests**: ${suite.tests.passed}/${suite.tests.total} passed
- **Duration**: ${Math.round(suite.duration / 1000)}s
${suite.error ? `- **Error**: ${suite.error}` : ''}
`).join('')}

## Recommendations

${summary.passRate >= 95 ? '🎉 Excellent! All Docker tests are passing.' : 
  summary.passRate >= 90 ? '⚠️  Minor issues detected. Review failed tests.' :
  '🚨 Significant issues detected. Docker environment needs attention.'}

---
Generated on ${new Date().toISOString()}
`;
  }

  displaySummary() {
    const { summary, duration } = this.results;
    
    console.log(chalk.blue.bold('\\n📈 Test Summary'));
    console.log(chalk.gray('==============='));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${chalk.green(summary.passed)}`);
    console.log(`Failed: ${chalk.red(summary.failed)}`);
    console.log(`Pass Rate: ${summary.passRate >= 95 ? chalk.green : summary.passRate >= 90 ? chalk.yellow : chalk.red}${summary.passRate.toFixed(1)}%`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
  }

  async cleanup() {
    console.log(chalk.yellow('🧹 Cleaning up Docker resources...'));
    
    try {
      // Remove test containers
      execSync('docker container prune -f', { stdio: 'pipe' });
      
      // Remove test images
      execSync('docker image prune -f', { stdio: 'pipe' });
      
      // Remove test volumes
      execSync('docker volume prune -f', { stdio: 'pipe' });
      
      // Remove test networks
      execSync('docker network prune -f', { stdio: 'pipe' });
      
      if (this.options.verbose) {
        console.log(chalk.gray('  Docker cleanup completed'));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Docker cleanup had issues:', error.message));
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    security: args.includes('--security') || args.includes('-s'),
    cleanup: !args.includes('--no-cleanup'),
    parallel: !args.includes('--sequential')
  };
  
  const runner = new DockerTestRunner(options);
  runner.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

export default DockerTestRunner;