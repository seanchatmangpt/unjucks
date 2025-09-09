#!/usr/bin/env node

/**
 * ACT Regression Testing Suite
 * Automated regression testing for GitHub Actions workflows
 * 
 * Features:
 * - Automated regression detection
 * - Baseline establishment and comparison
 * - Performance regression tracking
 * - Integration with CI/CD pipeline
 * - Cross-platform compatibility testing
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class ActRegressionSuite {
  constructor(options = {}) {
    this.options = {
      baselineDir: 'tests/workflows/baselines',
      resultsDir: 'tests/workflows/results',
      regressionsDir: 'tests/workflows/regressions',
      workflowsDir: '.github/workflows',
      thresholds: {
        performanceDegradation: 50, // % increase that triggers regression
        newFailures: 0, // Number of new failures allowed
        passRateReduction: 5 // % reduction in pass rate that triggers regression
      },
      platforms: ['ubuntu-latest', 'ubuntu-20.04'],
      events: ['push', 'pull_request'],
      maxRetries: 2,
      ...options
    };

    this.baseline = null;
    this.currentResults = null;
    this.regressions = [];
    this.improvements = [];

    this.setupDirectories();
  }

  setupDirectories() {
    const dirs = [
      this.options.baselineDir,
      this.options.resultsDir,
      this.options.regressionsDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Establish performance and functionality baseline
   */
  async establishBaseline() {
    console.log('🎯 Establishing regression testing baseline...');

    const baseline = {
      timestamp: new Date().toISOString(),
      version: this.getProjectVersion(),
      gitCommit: this.getGitCommit(),
      environment: {
        os: process.platform,
        nodeVersion: process.version,
        actVersion: this.getActVersion()
      },
      workflows: {},
      summary: {
        totalWorkflows: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageExecutionTime: 0,
        totalExecutionTime: 0
      }
    };

    // Run comprehensive test suite to establish baseline
    const ActValidationFramework = require('./act-validation-framework');
    const validator = new ActValidationFramework({
      verbose: false,
      dryRun: true // Use dry-run for baseline to ensure consistency
    });

    const results = await validator.validateAllWorkflows();

    // Process results for baseline
    baseline.summary = results.summary;
    
    for (const result of results.details) {
      const workflowKey = this.getWorkflowKey(result);
      
      if (!baseline.workflows[result.workflow]) {
        baseline.workflows[result.workflow] = {
          name: result.name,
          tests: {},
          overallStatus: 'unknown',
          executionTimeStats: {
            min: Infinity,
            max: 0,
            average: 0,
            median: 0
          }
        };
      }

      baseline.workflows[result.workflow].tests[workflowKey] = {
        platform: result.platform,
        event: result.event,
        status: result.status,
        executionTime: result.executionTime,
        actCompatible: result.actCompatible,
        performance: result.performance
      };

      // Update execution time stats
      const stats = baseline.workflows[result.workflow].executionTimeStats;
      stats.min = Math.min(stats.min, result.executionTime);
      stats.max = Math.max(stats.max, result.executionTime);
    }

    // Calculate final statistics for each workflow
    for (const workflowPath of Object.keys(baseline.workflows)) {
      const workflow = baseline.workflows[workflowPath];
      const executionTimes = Object.values(workflow.tests)
        .map(test => test.executionTime)
        .filter(time => time > 0);

      if (executionTimes.length > 0) {
        workflow.executionTimeStats.average = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
        
        executionTimes.sort((a, b) => a - b);
        workflow.executionTimeStats.median = executionTimes[Math.floor(executionTimes.length / 2)];
      }

      // Determine overall workflow status
      const allTests = Object.values(workflow.tests);
      const passedTests = allTests.filter(test => test.status === 'passed');
      workflow.overallStatus = passedTests.length === allTests.length ? 'passed' : 'failed';
    }

    // Save baseline
    const baselineFile = path.join(this.options.baselineDir, `baseline-${Date.now()}.json`);
    const latestBaselineFile = path.join(this.options.baselineDir, 'latest-baseline.json');
    
    fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
    fs.writeFileSync(latestBaselineFile, JSON.stringify(baseline, null, 2));

    this.baseline = baseline;
    
    console.log(`✅ Baseline established with ${baseline.summary.totalTests} tests`);
    console.log(`📊 Pass rate: ${Math.round((baseline.summary.passedTests / baseline.summary.totalTests) * 100)}%`);
    console.log(`⏱️  Average execution time: ${Math.round(baseline.summary.averageExecutionTime)}ms`);

    return baseline;
  }

  /**
   * Load existing baseline
   */
  loadBaseline() {
    const latestBaselineFile = path.join(this.options.baselineDir, 'latest-baseline.json');
    
    if (fs.existsSync(latestBaselineFile)) {
      this.baseline = JSON.parse(fs.readFileSync(latestBaselineFile, 'utf8'));
      console.log(`📚 Loaded baseline from ${this.baseline.timestamp}`);
      return this.baseline;
    } else {
      console.log('📭 No existing baseline found');
      return null;
    }
  }

  /**
   * Run regression tests against current codebase
   */
  async runRegressionTests() {
    console.log('🔍 Running regression tests...');

    if (!this.baseline) {
      this.loadBaseline();
      if (!this.baseline) {
        throw new Error('No baseline available. Please establish baseline first.');
      }
    }

    // Run current test suite
    const ActValidationFramework = require('./act-validation-framework');
    const validator = new ActValidationFramework({
      verbose: false,
      dryRun: true
    });

    const currentResults = await validator.validateAllWorkflows();
    this.currentResults = {
      timestamp: new Date().toISOString(),
      version: this.getProjectVersion(),
      gitCommit: this.getGitCommit(),
      summary: currentResults.summary,
      workflows: {},
      details: currentResults.details
    };

    // Process current results
    for (const result of currentResults.details) {
      if (!this.currentResults.workflows[result.workflow]) {
        this.currentResults.workflows[result.workflow] = {
          name: result.name,
          tests: {},
          overallStatus: 'unknown'
        };
      }

      const workflowKey = this.getWorkflowKey(result);
      this.currentResults.workflows[result.workflow].tests[workflowKey] = {
        platform: result.platform,
        event: result.event,
        status: result.status,
        executionTime: result.executionTime,
        actCompatible: result.actCompatible,
        performance: result.performance
      };
    }

    return this.currentResults;
  }

  /**
   * Analyze regressions between baseline and current results
   */
  analyzeRegressions() {
    console.log('🕵️ Analyzing regressions...');

    if (!this.baseline || !this.currentResults) {
      throw new Error('Both baseline and current results are required for regression analysis');
    }

    this.regressions = [];
    this.improvements = [];

    // Compare overall metrics
    this.analyzeOverallRegressions();

    // Compare individual workflows
    for (const workflowPath of Object.keys(this.baseline.workflows)) {
      this.analyzeWorkflowRegressions(workflowPath);
    }

    // Check for new workflows (potential improvements)
    this.analyzeNewWorkflows();

    return {
      regressions: this.regressions,
      improvements: this.improvements,
      hasRegressions: this.regressions.length > 0,
      hasCriticalRegressions: this.regressions.some(r => r.severity === 'critical')
    };
  }

  analyzeOverallRegressions() {
    const baseline = this.baseline.summary;
    const current = this.currentResults.summary;

    // Pass rate regression
    const baselinePassRate = (baseline.passedTests / baseline.totalTests) * 100;
    const currentPassRate = (current.passedTests / current.totalTests) * 100;
    const passRateChange = currentPassRate - baselinePassRate;

    if (passRateChange < -this.options.thresholds.passRateReduction) {
      this.regressions.push({
        type: 'pass_rate_regression',
        severity: 'critical',
        description: `Overall pass rate decreased by ${Math.abs(passRateChange).toFixed(1)}%`,
        baseline: baselinePassRate,
        current: currentPassRate,
        change: passRateChange
      });
    } else if (passRateChange > this.options.thresholds.passRateReduction) {
      this.improvements.push({
        type: 'pass_rate_improvement',
        description: `Overall pass rate improved by ${passRateChange.toFixed(1)}%`,
        baseline: baselinePassRate,
        current: currentPassRate,
        change: passRateChange
      });
    }

    // Performance regression
    const performanceChange = ((current.averageExecutionTime - baseline.averageExecutionTime) / baseline.averageExecutionTime) * 100;

    if (performanceChange > this.options.thresholds.performanceDegradation) {
      this.regressions.push({
        type: 'performance_regression',
        severity: 'major',
        description: `Average execution time increased by ${performanceChange.toFixed(1)}%`,
        baseline: baseline.averageExecutionTime,
        current: current.averageExecutionTime,
        change: performanceChange
      });
    } else if (performanceChange < -10) { // 10% improvement
      this.improvements.push({
        type: 'performance_improvement',
        description: `Average execution time improved by ${Math.abs(performanceChange).toFixed(1)}%`,
        baseline: baseline.averageExecutionTime,
        current: current.averageExecutionTime,
        change: performanceChange
      });
    }

    // New failures
    const newFailures = current.failedTests - baseline.failedTests;
    if (newFailures > this.options.thresholds.newFailures) {
      this.regressions.push({
        type: 'new_failures',
        severity: 'major',
        description: `${newFailures} new test failures detected`,
        baseline: baseline.failedTests,
        current: current.failedTests,
        change: newFailures
      });
    }
  }

  analyzeWorkflowRegressions(workflowPath) {
    const baselineWorkflow = this.baseline.workflows[workflowPath];
    const currentWorkflow = this.currentResults.workflows[workflowPath];

    if (!currentWorkflow) {
      this.regressions.push({
        type: 'missing_workflow',
        severity: 'critical',
        workflow: workflowPath,
        description: `Workflow ${workflowPath} is missing from current results`
      });
      return;
    }

    // Compare test results
    for (const testKey of Object.keys(baselineWorkflow.tests)) {
      const baselineTest = baselineWorkflow.tests[testKey];
      const currentTest = currentWorkflow.tests[testKey];

      if (!currentTest) {
        this.regressions.push({
          type: 'missing_test',
          severity: 'major',
          workflow: workflowPath,
          test: testKey,
          description: `Test ${testKey} is missing from workflow ${workflowPath}`
        });
        continue;
      }

      // Status regression
      if (baselineTest.status === 'passed' && currentTest.status === 'failed') {
        this.regressions.push({
          type: 'test_failure',
          severity: 'major',
          workflow: workflowPath,
          test: testKey,
          description: `Test ${testKey} in workflow ${workflowPath} changed from passed to failed`
        });
      } else if (baselineTest.status === 'failed' && currentTest.status === 'passed') {
        this.improvements.push({
          type: 'test_fix',
          workflow: workflowPath,
          test: testKey,
          description: `Test ${testKey} in workflow ${workflowPath} changed from failed to passed`
        });
      }

      // Performance regression for individual test
      if (baselineTest.executionTime > 0 && currentTest.executionTime > 0) {
        const performanceChange = ((currentTest.executionTime - baselineTest.executionTime) / baselineTest.executionTime) * 100;
        
        if (performanceChange > this.options.thresholds.performanceDegradation) {
          this.regressions.push({
            type: 'test_performance_regression',
            severity: 'minor',
            workflow: workflowPath,
            test: testKey,
            description: `Test ${testKey} execution time increased by ${performanceChange.toFixed(1)}%`,
            baseline: baselineTest.executionTime,
            current: currentTest.executionTime,
            change: performanceChange
          });
        }
      }
    }
  }

  analyzeNewWorkflows() {
    for (const workflowPath of Object.keys(this.currentResults.workflows)) {
      if (!this.baseline.workflows[workflowPath]) {
        this.improvements.push({
          type: 'new_workflow',
          workflow: workflowPath,
          description: `New workflow added: ${workflowPath}`
        });
      }
    }
  }

  /**
   * Generate regression report
   */
  generateRegressionReport() {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        baseline: {
          timestamp: this.baseline.timestamp,
          version: this.baseline.version,
          gitCommit: this.baseline.gitCommit
        },
        current: {
          timestamp: this.currentResults.timestamp,
          version: this.currentResults.version,
          gitCommit: this.currentResults.gitCommit
        }
      },
      analysis: {
        hasRegressions: this.regressions.length > 0,
        hasCriticalRegressions: this.regressions.some(r => r.severity === 'critical'),
        regressionCount: this.regressions.length,
        improvementCount: this.improvements.length
      },
      regressions: this.regressions,
      improvements: this.improvements,
      summary: {
        baseline: this.baseline.summary,
        current: this.currentResults.summary
      }
    };

    // Save regression report
    const reportFile = path.join(this.options.regressionsDir, `regression-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownRegressionReport(report);
    const markdownFile = path.join(this.options.regressionsDir, 'latest-regression-report.md');
    fs.writeFileSync(markdownFile, markdownReport);

    console.log(`📊 Regression report saved: ${reportFile}`);
    console.log(`📝 Markdown report saved: ${markdownFile}`);

    return report;
  }

  generateMarkdownRegressionReport(report) {
    const { baseline, current } = report.summary;
    const baselinePassRate = (baseline.passedTests / baseline.totalTests) * 100;
    const currentPassRate = (current.passedTests / current.totalTests) * 100;
    const passRateChange = currentPassRate - baselinePassRate;

    let markdown = `# ACT Regression Test Report

## Executive Summary

${report.analysis.hasCriticalRegressions ? '🚨 **CRITICAL REGRESSIONS DETECTED**' : 
  report.analysis.hasRegressions ? '⚠️ **REGRESSIONS DETECTED**' : '✅ **NO REGRESSIONS DETECTED**'}

- **Total Regressions**: ${report.analysis.regressionCount}
- **Critical Regressions**: ${report.regressions.filter(r => r.severity === 'critical').length}
- **Major Regressions**: ${report.regressions.filter(r => r.severity === 'major').length}
- **Minor Regressions**: ${report.regressions.filter(r => r.severity === 'minor').length}
- **Improvements**: ${report.analysis.improvementCount}

## Comparison Overview

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Pass Rate | ${baselinePassRate.toFixed(1)}% | ${currentPassRate.toFixed(1)}% | ${passRateChange > 0 ? '+' : ''}${passRateChange.toFixed(1)}% |
| Total Tests | ${baseline.totalTests} | ${current.totalTests} | ${current.totalTests - baseline.totalTests > 0 ? '+' : ''}${current.totalTests - baseline.totalTests} |
| Passed Tests | ${baseline.passedTests} | ${current.passedTests} | ${current.passedTests - baseline.passedTests > 0 ? '+' : ''}${current.passedTests - baseline.passedTests} |
| Failed Tests | ${baseline.failedTests} | ${current.failedTests} | ${current.failedTests - baseline.failedTests > 0 ? '+' : ''}${current.failedTests - baseline.failedTests} |
| Avg Execution Time | ${Math.round(baseline.averageExecutionTime)}ms | ${Math.round(current.averageExecutionTime)}ms | ${Math.round(current.averageExecutionTime - baseline.averageExecutionTime)}ms |

`;

    if (report.regressions.length > 0) {
      markdown += `## 🚨 Regressions Detected

`;
      
      for (const regression of report.regressions) {
        const severityIcon = {
          critical: '🚨',
          major: '⚠️',
          minor: '⚪'
        }[regression.severity] || '❓';

        markdown += `### ${severityIcon} ${regression.type.replace(/_/g, ' ').toUpperCase()}

**Severity**: ${regression.severity}  
**Description**: ${regression.description}

`;

        if (regression.workflow) {
          markdown += `**Workflow**: \`${regression.workflow}\`  `;
        }
        
        if (regression.test) {
          markdown += `**Test**: \`${regression.test}\`  `;
        }

        if (regression.baseline !== undefined) {
          markdown += `**Baseline**: ${regression.baseline}  
**Current**: ${regression.current}  
**Change**: ${regression.change > 0 ? '+' : ''}${typeof regression.change === 'number' ? regression.change.toFixed(1) : regression.change}

`;
        }

        markdown += '\n';
      }
    }

    if (report.improvements.length > 0) {
      markdown += `## ✅ Improvements Detected

`;
      
      for (const improvement of report.improvements) {
        markdown += `### 🎉 ${improvement.type.replace(/_/g, ' ').toUpperCase()}

**Description**: ${improvement.description}

`;

        if (improvement.workflow) {
          markdown += `**Workflow**: \`${improvement.workflow}\`  `;
        }
        
        if (improvement.baseline !== undefined) {
          markdown += `**Baseline**: ${improvement.baseline}  
**Current**: ${improvement.current}  
**Change**: ${improvement.change > 0 ? '+' : ''}${typeof improvement.change === 'number' ? improvement.change.toFixed(1) : improvement.change}

`;
        }

        markdown += '\n';
      }
    }

    markdown += `## Environment Details

### Baseline Environment
- **Timestamp**: ${report.metadata.baseline.timestamp}
- **Version**: ${report.metadata.baseline.version}
- **Git Commit**: ${report.metadata.baseline.gitCommit}

### Current Environment
- **Timestamp**: ${report.metadata.current.timestamp}
- **Version**: ${report.metadata.current.version}
- **Git Commit**: ${report.metadata.current.gitCommit}

---
*Generated on ${report.metadata.timestamp} by ACT Regression Suite*`;

    return markdown;
  }

  /**
   * Automated regression testing pipeline
   */
  async runAutomatedRegressionPipeline() {
    console.log('🔄 Running automated regression testing pipeline...');

    try {
      // Step 1: Load or establish baseline
      if (!this.loadBaseline()) {
        console.log('📊 No baseline found, establishing new baseline...');
        await this.establishBaseline();
      }

      // Step 2: Run current tests
      await this.runRegressionTests();

      // Step 3: Analyze regressions
      const analysis = this.analyzeRegressions();

      // Step 4: Generate reports
      const report = this.generateRegressionReport();

      // Step 5: Determine pipeline result
      if (analysis.hasCriticalRegressions) {
        console.log('🚨 CRITICAL REGRESSIONS DETECTED - Pipeline FAILED');
        process.exit(1);
      } else if (analysis.hasRegressions) {
        console.log('⚠️ Regressions detected - Pipeline completed with warnings');
        console.log(`Found ${analysis.regressionCount} regressions and ${analysis.improvementCount} improvements`);
        process.exit(2); // Warning exit code
      } else {
        console.log('✅ No regressions detected - Pipeline PASSED');
        if (analysis.improvementCount > 0) {
          console.log(`🎉 Found ${analysis.improvementCount} improvements!`);
        }
        process.exit(0);
      }

    } catch (error) {
      console.error('❌ Regression testing pipeline failed:', error.message);
      process.exit(1);
    }
  }

  // Utility methods
  getWorkflowKey(result) {
    return `${result.platform}_${result.event}${result.job ? '_' + result.job : ''}`;
  }

  getProjectVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  getActVersion() {
    try {
      return execSync('act --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }
}

module.exports = ActRegressionSuite;

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const suite = new ActRegressionSuite();

  (async () => {
    switch (command) {
      case 'baseline':
        await suite.establishBaseline();
        break;
      case 'test':
        await suite.runRegressionTests();
        suite.analyzeRegressions();
        suite.generateRegressionReport();
        break;
      case 'run':
      case 'pipeline':
        await suite.runAutomatedRegressionPipeline();
        break;
      default:
        console.log('Usage: node act-regression-suite.js [baseline|test|run|pipeline]');
        process.exit(1);
    }
  })();
}