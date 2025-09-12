#!/usr/bin/env node

/**
 * Comprehensive Smoke Test Runner
 * Executes all smoke tests with comprehensive reporting
 */

import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { runSmokeTests } from './critical-paths.test.js';
import { runUserJourneyTests } from './user-journeys.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveSmokeRunner {
  constructor() {
    this.startTime = this.getDeterministicTimestamp();
    this.results = {
      critical: null,
      journeys: null,
      overall: false
    };
    this.timeoutMs = 60000; // 60 second total timeout
  }

  log(message, type = 'info') {
    const timestamp = this.getDeterministicTimestamp() - this.startTime;
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow',
      header: 'magenta'
    };
    console.log(chalk[colors[type]](`[${timestamp}ms] ${message}`));
  }

  async runWithTimeout(testFn, name, timeout = 30000) {
    this.log(`Starting ${name}...`, 'info');
    
    return Promise.race([
      testFn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${name} timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  async runAllTests() {
    this.log('🔥 UNJUCKS PRODUCTION SMOKE TEST SUITE', 'header');
    this.log('Testing system for production readiness...', 'info');
    console.log();

    const startTime = this.getDeterministicTimestamp();
    let allPassed = true;

    try {
      // Run critical path tests
      try {
        this.log('📋 PHASE 1: Critical Path Tests', 'header');
        this.results.critical = await this.runWithTimeout(
          () => this.runCriticalTests(),
          'Critical Path Tests',
          30000
        );
        
        if (this.results.critical) {
          this.log('✅ Critical path tests PASSED', 'success');
        } else {
          this.log('❌ Critical path tests FAILED', 'error');
          allPassed = false;
        }
      } catch (error) {
        this.log(`❌ Critical path tests ERROR: ${error.message}`, 'error');
        this.results.critical = false;
        allPassed = false;
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Run user journey tests
      try {
        this.log('🚶 PHASE 2: User Journey Tests', 'header');
        this.results.journeys = await this.runWithTimeout(
          () => this.runJourneyTests(),
          'User Journey Tests',
          30000
        );
        
        if (this.results.journeys) {
          this.log('✅ User journey tests PASSED', 'success');
        } else {
          this.log('❌ User journey tests FAILED', 'error');
          allPassed = false;
        }
      } catch (error) {
        this.log(`❌ User journey tests ERROR: ${error.message}`, 'error');
        this.results.journeys = false;
        allPassed = false;
      }

      const totalDuration = this.getDeterministicTimestamp() - startTime;
      this.results.overall = allPassed;

      // Final summary
      console.log('\n' + '='.repeat(60));
      console.log(chalk.bold.blue('🎯 FINAL SMOKE TEST RESULTS'));
      console.log('='.repeat(60));
      
      console.log(chalk.cyan('Test Phases:'));
      console.log(chalk[this.results.critical ? 'green' : 'red'](
        `  Critical Paths: ${this.results.critical ? 'PASS' : 'FAIL'}`
      ));
      console.log(chalk[this.results.journeys ? 'green' : 'red'](
        `  User Journeys:  ${this.results.journeys ? 'PASS' : 'FAIL'}`
      ));
      
      console.log(chalk.blue(`\nTotal Duration: ${totalDuration}ms`));
      console.log(chalk.cyan(`Performance: ${totalDuration < 30000 ? 'FAST' : 'SLOW'} (target: <30s)`));
      
      if (allPassed) {
        console.log(chalk.green.bold('\n🎉 ALL SMOKE TESTS PASSED'));
        console.log(chalk.green('✅ System is PRODUCTION READY'));
        console.log(chalk.gray('\nThe system has passed all critical functionality tests'));
        console.log(chalk.gray('and user experience validations.'));
      } else {
        console.log(chalk.red.bold('\n💥 SMOKE TESTS FAILED'));
        console.log(chalk.red('❌ System is NOT production ready'));
        console.log(chalk.gray('\nCritical issues detected that must be resolved'));
        console.log(chalk.gray('before deploying to production environment.'));
      }

      console.log('='.repeat(60));

      return allPassed;

    } catch (error) {
      this.log(`💥 Smoke test suite failed: ${error.message}`, 'error');
      console.error(chalk.red(error.stack));
      return false;
    }
  }

  async runCriticalTests() {
    // Redirect console to capture output but still show it
    const originalLog = console.log;
    const originalError = console.error;
    
    let passed = false;
    try {
      // Run critical tests by importing and calling directly
      passed = await new Promise((resolve, reject) => {
        const originalExit = process.exit;
        process.exit = (code) => {
          process.exit = originalExit;
          resolve(code === 0);
        };

        runSmokeTests().catch(reject);
      });
    } catch (error) {
      this.log(`Critical tests error: ${error.message}`, 'error');
      passed = false;
    }

    console.log = originalLog;
    console.error = originalError;
    
    return passed;
  }

  async runJourneyTests() {
    let passed = false;
    try {
      passed = await runUserJourneyTests();
    } catch (error) {
      this.log(`Journey tests error: ${error.message}`, 'error');
      passed = false;
    }
    
    return passed;
  }

  // Generate diagnostic report
  generateDiagnosticReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      duration: this.getDeterministicTimestamp() - this.startTime,
      results: this.results,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        CI: process.env.CI || 'false'
      }
    };

    return report;
  }
}

// Pre-deployment smoke tests
async function runPreDeploymentTests() {
  console.log(chalk.yellow.bold('🚀 PRE-DEPLOYMENT SMOKE TESTS'));
  console.log(chalk.gray('Running tests before deployment...'));
  
  const runner = new ComprehensiveSmokeRunner();
  const success = await runner.runAllTests();
  
  const report = runner.generateDiagnosticReport();
  
  if (process.env.CI) {
    // In CI, output structured data
    console.log('\n::group::Smoke Test Report');
    console.log(JSON.stringify(report, null, 2));
    console.log('::endgroup::');
  }
  
  return success;
}

// Post-deployment smoke tests
async function runPostDeploymentTests() {
  console.log(chalk.blue.bold('✅ POST-DEPLOYMENT SMOKE TESTS'));
  console.log(chalk.gray('Validating deployed system...'));
  
  const runner = new ComprehensiveSmokeRunner();
  const success = await runner.runAllTests();
  
  if (success) {
    console.log(chalk.green.bold('\n🎉 DEPLOYMENT VALIDATED'));
    console.log(chalk.green('System is operational and ready for users'));
  } else {
    console.log(chalk.red.bold('\n💥 DEPLOYMENT VALIDATION FAILED'));
    console.log(chalk.red('Immediate attention required'));
  }
  
  return success;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';
  
  let success = false;
  
  switch (mode) {
    case 'pre-deploy':
    case 'pre':
      success = await runPreDeploymentTests();
      break;
      
    case 'post-deploy':
    case 'post':
      success = await runPostDeploymentTests();
      break;
      
    case 'all':
    default:
      const runner = new ComprehensiveSmokeRunner();
      success = await runner.runAllTests();
      break;
  }
  
  process.exit(success ? 0 : 1);
}

// Export functions for module use
export {
  ComprehensiveSmokeRunner,
  runPreDeploymentTests,
  runPostDeploymentTests
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red.bold('💥 Smoke test runner failed:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  });
}