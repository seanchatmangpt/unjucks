#!/usr/bin/env node

/**
 * Flaky Test Detector - Identifies inconsistent test behavior
 * Runs tests multiple times to detect non-deterministic failures
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

class FlakyTestDetector {
  constructor(options = {}) {
    this.runs = options.runs || 10;
    this.suite = options.suite || 'unit';
    this.threshold = options.threshold || 0.1; // 10% failure rate
    this.results = [];
    this.summary = {
      totalRuns: this.runs,
      flakyTests: [],
      consistentFailures: [],
      consistentPasses: [],
      statistics: {}
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = ['reports', 'reports/flaky'];
    dirs.forEach(dir => {
      const fullPath = join(rootDir, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async runSingleTest(runNumber) {
    console.log(`\n🔄 Run ${runNumber}/${this.runs}`);
    
    return new Promise((resolve) => {
      const startTime = this.getDeterministicTimestamp();
      
      const testProcess = spawn('npx', [
        'vitest', 'run',
        '--config', 'vitest.ci.config.js',
        '--reporter=json',
        `--outputFile=reports/flaky/run-${runNumber}.json`,
        `tests/${this.suite}/**/*.test.js`
      ], {
        cwd: rootDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true',
          FLAKY_TEST_RUN: runNumber.toString()
        }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = this.getDeterministicTimestamp() - startTime;
        const result = {
          run: runNumber,
          exitCode: code,
          duration,
          success: code === 0,
          timestamp: this.getDeterministicDate().toISOString(),
          stdout: stdout.slice(-1000), // Keep last 1000 chars
          stderr: stderr.slice(-1000)
        };

        // Parse test results if available
        try {
          const resultsFile = join(rootDir, 'reports', 'flaky', `run-${runNumber}.json`);
          if (existsSync(resultsFile)) {
            const testResults = JSON.parse(readFileSync(resultsFile, 'utf8'));
            result.testResults = testResults;
          }
        } catch (error) {
          console.log(`⚠️  Could not parse results for run ${runNumber}`);
        }

        console.log(`   ${result.success ? '✅' : '❌'} Run ${runNumber} ${result.success ? 'passed' : 'failed'} (${duration}ms)`);
        
        this.results.push(result);
        resolve(result);
      });

      testProcess.on('error', (error) => {
        console.log(`💥 Run ${runNumber} process error:`, error);
        resolve({
          run: runNumber,
          exitCode: -1,
          duration: this.getDeterministicTimestamp() - startTime,
          success: false,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        });
      });

      // 5 minute timeout per run
      setTimeout(() => {
        testProcess.kill('SIGKILL');
        resolve({
          run: runNumber,
          exitCode: -1,
          duration: 300000,
          success: false,
          error: 'Timeout',
          timestamp: this.getDeterministicDate().toISOString()
        });
      }, 300000);
    });
  }

  async detectFlakyTests() {
    console.log(`\n🎲 Running flaky test detection with ${this.runs} iterations...\n`);
    
    // Run tests multiple times
    for (let i = 1; i <= this.runs; i++) {
      await this.runSingleTest(i);
    }
    
    console.log('\n📊 Analyzing results for flaky behavior...');
    
    // Aggregate test results by test name
    const testOutcomes = new Map();
    
    this.results.forEach(result => {
      if (result.testResults && result.testResults.testResults) {
        result.testResults.testResults.forEach(test => {
          const testName = test.name || test.title || 'unknown';
          
          if (!testOutcomes.has(testName)) {
            testOutcomes.set(testName, {
              name: testName,
              passes: 0,
              failures: 0,
              runs: 0,
              failureReasons: [],
              failureRuns: []
            });
          }
          
          const outcome = testOutcomes.get(testName);
          outcome.runs++;
          
          if (test.status === 'failed' || test.status === 'error') {
            outcome.failures++;
            outcome.failureReasons.push(test.message || 'Unknown error');
            outcome.failureRuns.push(result.run);
          } else if (test.status === 'passed') {
            outcome.passes++;
          }
        });
      }
    });
    
    // Analyze flakiness
    testOutcomes.forEach((outcome) => {
      const failureRate = outcome.failures / outcome.runs;
      
      if (outcome.failures > 0 && outcome.passes > 0) {
        // Test sometimes passes, sometimes fails - definitely flaky
        this.summary.flakyTests.push({
          ...outcome,
          failureRate,
          type: 'flaky',
          severity: failureRate > 0.5 ? 'high' : failureRate > 0.2 ? 'medium' : 'low'
        });
      } else if (outcome.failures === outcome.runs && outcome.runs > 1) {
        // Test always fails - consistent failure
        this.summary.consistentFailures.push({
          ...outcome,
          failureRate,
          type: 'consistent_failure'
        });
      } else if (outcome.passes === outcome.runs && outcome.runs > 1) {
        // Test always passes - consistent pass
        this.summary.consistentPasses.push({
          ...outcome,
          failureRate,
          type: 'consistent_pass'
        });
      }
    });
    
    // Calculate statistics
    this.summary.statistics = {
      totalTests: testOutcomes.size,
      totalRuns: this.results.length,
      successfulRuns: this.results.filter(r => r.success).length,
      failedRuns: this.results.filter(r => !r.success).length,
      averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
      flakyTestCount: this.summary.flakyTests.length,
      consistentFailureCount: this.summary.consistentFailures.length,
      consistentPassCount: this.summary.consistentPasses.length
    };
  }

  generateReport() {
    console.log('\n📊 Generating flaky test report...');
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      configuration: {
        runs: this.runs,
        suite: this.suite,
        threshold: this.threshold
      },
      summary: this.summary,
      detailedResults: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Save detailed JSON report
    const reportFile = join(rootDir, 'reports', 'flaky', 'flaky-test-report.json');
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    const summaryFile = join(rootDir, 'reports', 'flaky', 'flaky-test-summary.md');
    writeFileSync(summaryFile, this.generateMarkdownSummary(report));
    
    console.log(`✅ Flaky test report saved to ${reportFile}`);
    console.log(`📝 Summary saved to ${summaryFile}`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.summary.flakyTests.length > 0) {
      recommendations.push({
        type: 'flaky_tests',
        priority: 'high',
        message: `Found ${this.summary.flakyTests.length} flaky tests that need investigation`,
        actions: [
          'Review test isolation and cleanup',
          'Check for timing dependencies',
          'Investigate external dependencies',
          'Add proper test setup/teardown'
        ]
      });
    }
    
    if (this.summary.consistentFailures.length > 0) {
      recommendations.push({
        type: 'consistent_failures',
        priority: 'critical',
        message: `Found ${this.summary.consistentFailures.length} tests that consistently fail`,
        actions: [
          'Fix broken tests immediately',
          'Update test expectations',
          'Check environment requirements'
        ]
      });
    }
    
    const runSuccessRate = this.summary.statistics.successfulRuns / this.summary.statistics.totalRuns;
    if (runSuccessRate < 0.8) {
      recommendations.push({
        type: 'low_success_rate',
        priority: 'high',
        message: `Low test suite success rate: ${(runSuccessRate * 100).toFixed(1)}%`,
        actions: [
          'Investigate test environment stability',
          'Review test dependencies',
          'Consider test suite refactoring'
        ]
      });
    }
    
    return recommendations;
  }

  generateMarkdownSummary(report) {
    const md = [];
    
    md.push('# 🎲 Flaky Test Detection Report');
    md.push('');
    md.push(`**Generated:** ${report.timestamp}`);
    md.push(`**Test Suite:** ${report.configuration.suite}`);
    md.push(`**Runs:** ${report.configuration.runs}`);
    md.push('');
    
    md.push('## 📊 Summary');
    md.push('');
    md.push(`- **Total Tests:** ${report.summary.statistics.totalTests}`);
    md.push(`- **Flaky Tests:** ${report.summary.statistics.flakyTestCount}`);
    md.push(`- **Consistent Failures:** ${report.summary.statistics.consistentFailureCount}`);
    md.push(`- **Consistent Passes:** ${report.summary.statistics.consistentPassCount}`);
    md.push(`- **Success Rate:** ${((report.summary.statistics.successfulRuns / report.summary.statistics.totalRuns) * 100).toFixed(1)}%`);
    md.push('');
    
    if (report.summary.flakyTests.length > 0) {
      md.push('## 🚨 Flaky Tests');
      md.push('');
      report.summary.flakyTests.forEach(test => {
        md.push(`### ${test.name}`);
        md.push(`- **Failure Rate:** ${(test.failureRate * 100).toFixed(1)}%`);
        md.push(`- **Severity:** ${test.severity}`);
        md.push(`- **Passes:** ${test.passes}/${test.runs}`);
        md.push(`- **Failures:** ${test.failures}/${test.runs}`);
        md.push(`- **Failed Runs:** ${test.failureRuns.join(', ')}`);
        md.push('');
      });
    }
    
    if (report.summary.consistentFailures.length > 0) {
      md.push('## ❌ Consistent Failures');
      md.push('');
      report.summary.consistentFailures.forEach(test => {
        md.push(`### ${test.name}`);
        md.push(`- **Runs:** ${test.runs} (all failed)`);
        md.push(`- **Last Error:** ${test.failureReasons[test.failureReasons.length - 1] || 'Unknown'}`);
        md.push('');
      });
    }
    
    if (report.recommendations.length > 0) {
      md.push('## 💡 Recommendations');
      md.push('');
      report.recommendations.forEach(rec => {
        md.push(`### ${rec.type} (${rec.priority} priority)`);
        md.push(rec.message);
        md.push('');
        md.push('**Actions:**');
        rec.actions.forEach(action => {
          md.push(`- ${action}`);
        });
        md.push('');
      });
    }
    
    return md.join('\n');
  }

  printSummary() {
    console.log('\n🎲 FLAKY TEST DETECTION SUMMARY');
    console.log('================================');
    console.log(`Total Tests: ${this.summary.statistics.totalTests}`);
    console.log(`Total Runs: ${this.summary.statistics.totalRuns}`);
    console.log(`Success Rate: ${((this.summary.statistics.successfulRuns / this.summary.statistics.totalRuns) * 100).toFixed(1)}%`);
    console.log('');
    
    if (this.summary.flakyTests.length > 0) {
      console.log('🚨 FLAKY TESTS DETECTED:');
      this.summary.flakyTests.forEach(test => {
        console.log(`  - ${test.name}: ${(test.failureRate * 100).toFixed(1)}% failure rate (${test.severity} severity)`);
      });
      console.log('');
    }
    
    if (this.summary.consistentFailures.length > 0) {
      console.log('❌ CONSISTENT FAILURES:');
      this.summary.consistentFailures.forEach(test => {
        console.log(`  - ${test.name}: fails in all ${test.runs} runs`);
      });
      console.log('');
    }
    
    if (this.summary.flakyTests.length === 0 && this.summary.consistentFailures.length === 0) {
      console.log('✅ No flaky tests detected!');
    }
  }

  async run() {
    console.log(`\n🎲 Starting flaky test detection for ${this.suite} suite\n`);
    
    try {
      await this.detectFlakyTests();
      const report = this.generateReport();
      this.printSummary();
      
      console.log('\n🎉 Flaky test detection completed');
      
      return {
        success: true,
        report,
        exitCode: this.summary.flakyTests.length > 0 ? 1 : 0
      };
      
    } catch (error) {
      console.error('\n💥 Flaky test detection failed:', error);
      
      return {
        success: false,
        error: error.message,
        exitCode: 2
      };
    }
  }
}

// CLI interface
async function main() {
  const suite = process.argv[2] || 'unit';
  const runs = parseInt(process.argv[3]) || 10;
  
  const detector = new FlakyTestDetector({ suite, runs });
  const result = await detector.run();
  
  process.exit(result.exitCode);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { FlakyTestDetector };