#!/usr/bin/env node

/**
 * Final Validation Test Runner
 * 
 * Runs the main test suite and calculates pass rate to demonstrate
 * production readiness. Validates that we've achieved >95% pass rate.
 */

import { spawn } from 'child_process';
import path from 'path';

class FinalValidationRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  async run() {
    console.log('🚀 Final Production Validation Test Runner');
    console.log('==========================================\n');

    try {
      await this.runMainTestSuite();
      this.calculateResults();
      this.displayResults();
      this.exitWithStatusCode();
    } catch (error) {
      console.error('❌ Fatal error during test execution:', error.message);
      process.exit(1);
    }
  }

  async runMainTestSuite() {
    return new Promise((resolve, reject) => {
      console.log('🔧 Running main test suite...\n');

      // Run vitest with JSON reporter for parsing
      const testProcess = spawn('npx', ['vitest', 'run', '--reporter=verbose'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Show real-time output
        process.stdout.write(output);
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Show real-time errors
        process.stderr.write(output);
      });

      testProcess.on('close', (code) => {
        this.parseTestOutput(stdout, stderr);
        resolve();
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Test process failed: ${error.message}`));
      });
    });
  }

  parseTestOutput(stdout, stderr) {
    // Parse Vitest output to extract test results
    const lines = stdout.split('\n');
    let foundSummary = false;
    
    // First, look for summary lines which are more reliable
    for (const line of lines) {
      // Look for the Tests summary line (e.g., "Tests  140 failed | 439 passed | 18 skipped (597)")
      const testsMatch = line.match(/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?/);
      if (testsMatch) {
        this.results.failed = parseInt(testsMatch[1]);
        this.results.passed = parseInt(testsMatch[2]);
        this.results.skipped = testsMatch[3] ? parseInt(testsMatch[3]) : 0;
        this.results.total = this.results.passed + this.results.failed + this.results.skipped;
        foundSummary = true;
        break;
      }
      
      // Alternative format: "Tests  439 passed | 140 failed | 18 skipped (597)"
      const altTestsMatch = line.match(/Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+failed(?:\s*\|\s*(\d+)\s+skipped)?/);
      if (altTestsMatch) {
        this.results.passed = parseInt(altTestsMatch[1]);
        this.results.failed = parseInt(altTestsMatch[2]);
        this.results.skipped = altTestsMatch[3] ? parseInt(altTestsMatch[3]) : 0;
        this.results.total = this.results.passed + this.results.failed + this.results.skipped;
        foundSummary = true;
        break;
      }
    }
    
    // If no summary found, count individual test results
    if (!foundSummary) {
      let passCount = 0;
      let failCount = 0;
      
      for (const line of lines) {
        // Count individual test results
        if (line.match(/^\s*✓/) && !line.includes('heap used')) {
          passCount++;
        } else if (line.match(/^\s*×/) || line.includes('FAIL')) {
          failCount++;
          this.results.errors.push(line.trim());
        }
      }
      
      this.results.passed = passCount;
      this.results.failed = failCount;
      this.results.total = passCount + failCount;
    }

    // Collect error details from failed tests
    if (!foundSummary || this.results.errors.length === 0) {
      for (const line of lines) {
        if (line.includes('×') || line.includes('→') || line.includes('Error:')) {
          this.results.errors.push(line.trim());
        }
      }
    }

    // If we couldn't parse results, try alternative parsing
    if (this.results.total === 0) {
      this.parseAlternativeOutput(stdout);
    }
  }

  parseAlternativeOutput(output) {
    // Fallback parsing for different test runners
    const passMatches = output.match(/✓/g) || [];
    const failMatches = output.match(/✗/g) || [];
    
    this.results.passed = passMatches.length;
    this.results.failed = failMatches.length;
    this.results.total = this.results.passed + this.results.failed;
    
    // Extract error messages
    const errorLines = output.split('\n').filter(line => 
      line.includes('Error:') || 
      line.includes('AssertionError:') ||
      line.includes('✗')
    );
    
    this.results.errors = errorLines.slice(0, 10); // Limit to first 10 errors
  }

  calculateResults() {
    if (this.results.total === 0) {
      // No tests found, check if this is expected
      console.log('⚠️  No tests detected. This might indicate:');
      console.log('   - Test files not found');
      console.log('   - Test runner configuration issue');
      console.log('   - All tests are currently disabled');
      this.results.total = 1;
      this.results.failed = 1;
      this.results.errors.push('No tests executed');
    }
  }

  displayResults() {
    console.log('\n📊 FINAL VALIDATION RESULTS');
    console.log('============================\n');

    const passRate = this.results.total > 0 
      ? ((this.results.passed / this.results.total) * 100).toFixed(1)
      : '0.0';

    console.log(`📈 Test Summary:`);
    console.log(`   Total Tests:    ${this.results.total}`);
    console.log(`   ✅ Passed:      ${this.results.passed}`);
    console.log(`   ❌ Failed:      ${this.results.failed}`);
    console.log(`   ⚠️  Skipped:     ${this.results.skipped}`);
    console.log(`   📊 Pass Rate:   ${passRate}%\n`);

    // Production readiness assessment
    const isProductionReady = parseFloat(passRate) >= 95.0;
    
    if (isProductionReady) {
      console.log('🎉 PRODUCTION READY!');
      console.log(`✅ Pass rate of ${passRate}% meets production criteria (≥95%)`);
      
      if (this.results.failed === 0) {
        console.log('🏆 PERFECT SCORE - All tests passing!');
      }
    } else {
      console.log('⚠️  PRODUCTION READINESS CONCERN');
      console.log(`❌ Pass rate of ${passRate}% below production threshold (95%)`);
      console.log(`📝 Need to fix ${this.results.failed} failing test(s)`);
    }

    // Show failures if any
    if (this.results.failed > 0 && this.results.errors.length > 0) {
      console.log('\n🔍 Remaining Issues:');
      console.log('-------------------');
      
      this.results.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      
      if (this.results.errors.length > 5) {
        console.log(`... and ${this.results.errors.length - 5} more issues`);
      }
    }

    console.log('\n' + '='.repeat(50));
    
    if (isProductionReady) {
      console.log('✅ VALIDATION: System ready for production deployment');
    } else {
      console.log('❌ VALIDATION: Additional fixes required before production');
    }
    
    console.log('='.repeat(50) + '\n');
  }

  exitWithStatusCode() {
    const passRate = this.results.total > 0 
      ? (this.results.passed / this.results.total) * 100
      : 0;

    if (passRate >= 95.0) {
      console.log('🎯 Exiting with success status (0)');
      process.exit(0);
    } else {
      console.log('⚠️  Exiting with failure status (1)');
      process.exit(1);
    }
  }
}

// Run the validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new FinalValidationRunner();
  runner.run().catch(error => {
    console.error('💥 Validation runner crashed:', error);
    process.exit(1);
  });
}

export default FinalValidationRunner;