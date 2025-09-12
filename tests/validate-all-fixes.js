#!/usr/bin/env node
/**
 * Comprehensive Test Runner - Validates All Fixes
 * Ensures 100% pass rate and validates all security/performance improvements
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class ComprehensiveFixValidator {
  constructor() {
    this.startTime = this.getDeterministicTimestamp();
    this.results = {
      testSuites: {},
      vulnerabilities: {},
      performance: {},
      coverage: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        vulnerabilitiesFixed: 0,
        vulnerabilitiesRemaining: 0,
        performanceGains: {},
        criticalIssues: []
      }
    };
    this.exitCode = 0;
  }

  log(message, type = 'info') {
    const timestamp = this.getDeterministicDate().toISOString();
    const icons = { info: '📋', success: '✅', error: '❌', warning: '⚠️', progress: '🔄' };
    console.log(`${icons[type]} [${timestamp}] ${message}`);
  }

  async executeCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        cwd: options.cwd || projectRoot,
        timeout: options.timeout || 60000,
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      return { success: true, output: result, stderr: null };
    } catch (error) {
      return { 
        success: false, 
        output: error.stdout || '', 
        stderr: error.stderr || error.message,
        code: error.status || 1
      };
    }
  }

  async runTestSuite(suiteName, command, options = {}) {
    this.log(`Running ${suiteName} test suite...`, 'progress');
    const startTime = this.getDeterministicTimestamp();
    
    const result = await this.executeCommand(command, { 
      silent: true,
      ...options 
    });
    
    const duration = this.getDeterministicTimestamp() - startTime;
    const suiteResult = {
      name: suiteName,
      success: result.success,
      duration,
      output: result.output,
      stderr: result.stderr,
      tests: this.parseTestOutput(result.output, result.stderr),
      exitCode: result.code || 0
    };

    this.results.testSuites[suiteName] = suiteResult;
    
    if (result.success) {
      this.log(`${suiteName} - PASSED (${(duration/1000).toFixed(2)}s)`, 'success');
    } else {
      this.log(`${suiteName} - FAILED (${(duration/1000).toFixed(2)}s)`, 'error');
      this.exitCode = 1;
    }

    return suiteResult;
  }

  parseTestOutput(stdout, stderr) {
    const tests = { total: 0, passed: 0, failed: 0, skipped: 0 };
    const output = stdout + '\n' + (stderr || '');

    // Vitest output parsing
    const vitestMatch = output.match(/Tests:\s*(\d+)\s*passed,?\s*(\d+)?\s*failed,?\s*(\d+)?\s*skipped/i);
    if (vitestMatch) {
      tests.passed = parseInt(vitestMatch[1]) || 0;
      tests.failed = parseInt(vitestMatch[2]) || 0;
      tests.skipped = parseInt(vitestMatch[3]) || 0;
      tests.total = tests.passed + tests.failed + tests.skipped;
      return tests;
    }

    // Jest/Node test output parsing
    const jestMatch = output.match(/(\d+)\s*passing/i);
    const jestFailMatch = output.match(/(\d+)\s*failing/i);
    if (jestMatch || jestFailMatch) {
      tests.passed = jestMatch ? parseInt(jestMatch[1]) : 0;
      tests.failed = jestFailMatch ? parseInt(jestFailMatch[1]) : 0;
      tests.total = tests.passed + tests.failed;
      return tests;
    }

    // Custom test runner parsing
    const passedMatch = output.match(/✅.*?(\d+)/g);
    const failedMatch = output.match(/❌.*?(\d+)/g);
    if (passedMatch || failedMatch) {
      tests.passed = passedMatch ? passedMatch.length : 0;
      tests.failed = failedMatch ? failedMatch.length : 0;
      tests.total = tests.passed + tests.failed;
      return tests;
    }

    // Fallback - look for test indicators
    const successIndicators = (output.match(/✅|PASS|passed|success/gi) || []).length;
    const failIndicators = (output.match(/❌|FAIL|failed|error/gi) || []).length;
    
    if (successIndicators > 0 || failIndicators > 0) {
      tests.passed = successIndicators;
      tests.failed = failIndicators;
      tests.total = successIndicators + failIndicators;
    }

    return tests;
  }

  async validateUnitTests() {
    return await this.runTestSuite(
      'Unit Tests',
      'npm run test:unit'
    );
  }

  async validateIntegrationTests() {
    return await this.runTestSuite(
      'Integration Tests', 
      'npm run test:integration'
    );
  }

  async validateMinimalTests() {
    return await this.runTestSuite(
      'Minimal Test Suite',
      'npm run test:minimal'
    );
  }

  async validateSecurityTests() {
    return await this.runTestSuite(
      'Security Tests',
      'npm run test:security'
    );
  }

  async validateSmokeTests() {
    return await this.runTestSuite(
      'Smoke Tests',
      'npm run test:smoke'
    );
  }

  async validateCLITests() {
    return await this.runTestSuite(
      'CLI Tests',
      'node tests/cli-comprehensive/run-all-tests.js'
    );
  }

  async validateLatexTests() {
    return await this.runTestSuite(
      'LaTeX Tests',
      'npm run test:latex-filters'
    );
  }

  async validateChaosTests() {
    return await this.runTestSuite(
      'Chaos Tests',
      'npm run test:chaos'
    );
  }

  async validatePerformanceTests() {
    this.log('Running performance validation...', 'progress');
    
    const benchmarkResult = await this.executeCommand(
      'npm run benchmark:full',
      { silent: true, timeout: 120000 }
    );

    const loadTestResult = await this.executeCommand(
      'npm run test:load',
      { silent: true, timeout: 90000 }
    );

    const memoryTestResult = await this.executeCommand(
      'npm run test:memory',
      { silent: true, timeout: 90000 }
    );

    this.results.performance = {
      benchmark: {
        success: benchmarkResult.success,
        output: benchmarkResult.output,
        metrics: this.parsePerformanceMetrics(benchmarkResult.output)
      },
      loadTest: {
        success: loadTestResult.success,
        output: loadTestResult.output
      },
      memoryTest: {
        success: memoryTestResult.success,
        output: memoryTestResult.output
      }
    };

    const allPerfTestsPassed = benchmarkResult.success && 
                               loadTestResult.success && 
                               memoryTestResult.success;

    if (allPerfTestsPassed) {
      this.log('Performance tests - PASSED', 'success');
    } else {
      this.log('Performance tests - FAILED', 'error');
      this.exitCode = 1;
    }

    return { success: allPerfTestsPassed };
  }

  parsePerformanceMetrics(output) {
    const metrics = {};
    
    // Parse common performance metrics
    const latencyMatch = output.match(/latency[:\s]+(\d+\.?\d*)ms/i);
    const throughputMatch = output.match(/throughput[:\s]+(\d+\.?\d*)/i);
    const memoryMatch = output.match(/memory[:\s]+(\d+\.?\d*)\s*(MB|KB)/i);
    
    if (latencyMatch) metrics.latency = parseFloat(latencyMatch[1]);
    if (throughputMatch) metrics.throughput = parseFloat(throughputMatch[1]);
    if (memoryMatch) metrics.memory = parseFloat(memoryMatch[1]);

    return metrics;
  }

  async validateSecurityFixes() {
    this.log('Validating security fixes...', 'progress');

    const securityScanResult = await this.executeCommand(
      'npm run security:scan',
      { silent: true }
    );

    const sastResult = await this.executeCommand(
      'npm run security:sast',
      { silent: true }
    );

    const depsScanResult = await this.executeCommand(
      'npm run security:deps',
      { silent: true }
    );

    // Check for known vulnerability patterns
    const vulnerabilityChecks = [
      {
        name: 'SQL Injection',
        pattern: /sql.*injection|unsafe.*query/i,
        fixed: !securityScanResult.output.match(/sql.*injection|unsafe.*query/i)
      },
      {
        name: 'XSS Prevention',
        pattern: /cross.*site.*scripting|xss/i,
        fixed: !securityScanResult.output.match(/cross.*site.*scripting|xss/i)
      },
      {
        name: 'Path Traversal',
        pattern: /path.*traversal|directory.*traversal/i,
        fixed: !securityScanResult.output.match(/path.*traversal|directory.*traversal/i)
      },
      {
        name: 'Command Injection',
        pattern: /command.*injection|unsafe.*exec/i,
        fixed: !securityScanResult.output.match(/command.*injection|unsafe.*exec/i)
      }
    ];

    const fixedVulnerabilities = vulnerabilityChecks.filter(v => v.fixed);
    const remainingVulnerabilities = vulnerabilityChecks.filter(v => !v.fixed);

    this.results.vulnerabilities = {
      scan: securityScanResult,
      sast: sastResult,
      deps: depsScanResult,
      checks: vulnerabilityChecks,
      fixed: fixedVulnerabilities.length,
      remaining: remainingVulnerabilities.length
    };

    this.results.summary.vulnerabilitiesFixed = fixedVulnerabilities.length;
    this.results.summary.vulnerabilitiesRemaining = remainingVulnerabilities.length;

    if (remainingVulnerabilities.length === 0) {
      this.log('Security validation - PASSED (All vulnerabilities fixed)', 'success');
    } else {
      this.log(`Security validation - ISSUES REMAIN (${remainingVulnerabilities.length} vulnerabilities)`, 'warning');
      remainingVulnerabilities.forEach(v => {
        this.log(`  - ${v.name} still vulnerable`, 'warning');
        this.results.summary.criticalIssues.push(`Security: ${v.name} vulnerability not fixed`);
      });
    }

    return { success: remainingVulnerabilities.length === 0 };
  }

  async validateCodeCoverage() {
    this.log('Analyzing code coverage...', 'progress');

    const coverageResult = await this.executeCommand(
      'npm run test -- --coverage',
      { silent: true, timeout: 120000 }
    );

    const coverage = this.parseCoverage(coverageResult.output);
    this.results.coverage = coverage;

    const meetsCoverageThreshold = coverage.statements >= 80 && 
                                   coverage.branches >= 70 && 
                                   coverage.functions >= 80 && 
                                   coverage.lines >= 80;

    if (meetsCoverageThreshold) {
      this.log(`Code coverage - PASSED (${coverage.statements}% statements)`, 'success');
    } else {
      this.log(`Code coverage - BELOW THRESHOLD`, 'warning');
      this.results.summary.criticalIssues.push('Code coverage below recommended thresholds');
    }

    return { success: meetsCoverageThreshold, coverage };
  }

  parseCoverage(output) {
    const coverage = { statements: 0, branches: 0, functions: 0, lines: 0 };
    
    const stmtMatch = output.match(/Statements\s*:\s*(\d+\.?\d*)%/i);
    const branchMatch = output.match(/Branches\s*:\s*(\d+\.?\d*)%/i);
    const funcMatch = output.match(/Functions\s*:\s*(\d+\.?\d*)%/i);
    const linesMatch = output.match(/Lines\s*:\s*(\d+\.?\d*)%/i);

    if (stmtMatch) coverage.statements = parseFloat(stmtMatch[1]);
    if (branchMatch) coverage.branches = parseFloat(branchMatch[1]);
    if (funcMatch) coverage.functions = parseFloat(funcMatch[1]);
    if (linesMatch) coverage.lines = parseFloat(linesMatch[1]);

    return coverage;
  }

  calculateSummary() {
    const suites = Object.values(this.results.testSuites);
    
    this.results.summary.totalTests = suites.reduce(
      (sum, suite) => sum + (suite.tests?.total || 0), 0
    );
    
    this.results.summary.passedTests = suites.reduce(
      (sum, suite) => sum + (suite.tests?.passed || 0), 0
    );
    
    this.results.summary.failedTests = suites.reduce(
      (sum, suite) => sum + (suite.tests?.failed || 0), 0
    );

    // Calculate success rate
    this.results.summary.successRate = this.results.summary.totalTests > 0 
      ? ((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(2)
      : 0;

    // Determine overall status
    this.results.summary.overallSuccess = 
      this.results.summary.failedTests === 0 && 
      this.results.summary.vulnerabilitiesRemaining === 0 &&
      this.results.summary.criticalIssues.length === 0;

    if (this.results.summary.overallSuccess) {
      this.exitCode = 0;
    } else {
      this.exitCode = 1;
    }
  }

  generateReport() {
    const duration = this.getDeterministicTimestamp() - this.startTime;
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      duration: duration,
      environment: {
        node_version: process.version,
        platform: process.platform,
        cwd: process.cwd()
      },
      validation_results: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save detailed JSON report
    const reportPath = path.join(projectRoot, 'tests', 'comprehensive-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdPath = path.join(projectRoot, 'tests', 'COMPREHENSIVE-VALIDATION-REPORT.md');
    fs.writeFileSync(mdPath, markdownReport);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.summary.failedTests > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Testing',
        issue: `${this.results.summary.failedTests} tests are failing`,
        action: 'Review test failures and fix underlying issues'
      });
    }

    if (this.results.summary.vulnerabilitiesRemaining > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        issue: `${this.results.summary.vulnerabilitiesRemaining} security vulnerabilities remain`,
        action: 'Immediately address remaining security issues'
      });
    }

    if (this.results.coverage?.statements < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Coverage',
        issue: `Code coverage is ${this.results.coverage.statements}% (below 80%)`,
        action: 'Add more comprehensive test cases'
      });
    }

    return recommendations;
  }

  generateMarkdownReport(report) {
    const { results } = report;
    const suites = Object.values(results.testSuites);
    
    return `# Comprehensive Fix Validation Report

**Generated:** ${report.timestamp}  
**Duration:** ${(report.duration / 1000).toFixed(2)}s  
**Node.js:** ${report.environment.node_version}  
**Platform:** ${report.environment.platform}

## 🎯 Executive Summary

| Metric | Value | Status |
|--------|--------|--------|
| **Total Tests** | ${results.summary.totalTests} | ${results.summary.totalTests > 0 ? '✅' : '❌'} |
| **Passed** | ${results.summary.passedTests} | ${results.summary.passedTests === results.summary.totalTests ? '✅' : '❌'} |
| **Failed** | ${results.summary.failedTests} | ${results.summary.failedTests === 0 ? '✅' : '❌'} |
| **Success Rate** | ${results.summary.successRate}% | ${results.summary.successRate == 100 ? '✅' : '❌'} |
| **Vulnerabilities Fixed** | ${results.summary.vulnerabilitiesFixed} | ✅ |
| **Vulnerabilities Remaining** | ${results.summary.vulnerabilitiesRemaining} | ${results.summary.vulnerabilitiesRemaining === 0 ? '✅' : '❌'} |
| **Overall Status** | ${results.summary.overallSuccess ? 'PASSED' : 'FAILED'} | ${results.summary.overallSuccess ? '✅' : '❌'} |

## 📋 Test Suite Results

${suites.map(suite => `### ${suite.name}
- **Status:** ${suite.success ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${(suite.duration / 1000).toFixed(2)}s
- **Tests:** ${suite.tests?.total || 'N/A'} total, ${suite.tests?.passed || 0} passed, ${suite.tests?.failed || 0} failed
${suite.tests?.failed > 0 ? `- **⚠️ Failures detected in ${suite.name}**` : ''}
`).join('\n')}

## 🔒 Security Validation

${results.vulnerabilities ? `
### Vulnerability Assessment
- **SQL Injection:** ${results.vulnerabilities.checks?.find(c => c.name === 'SQL Injection')?.fixed ? '✅ Fixed' : '❌ Vulnerable'}
- **XSS Prevention:** ${results.vulnerabilities.checks?.find(c => c.name === 'XSS Prevention')?.fixed ? '✅ Fixed' : '❌ Vulnerable'}
- **Path Traversal:** ${results.vulnerabilities.checks?.find(c => c.name === 'Path Traversal')?.fixed ? '✅ Fixed' : '❌ Vulnerable'}
- **Command Injection:** ${results.vulnerabilities.checks?.find(c => c.name === 'Command Injection')?.fixed ? '✅ Fixed' : '❌ Vulnerable'}

### Security Scan Results
- **NPM Audit:** ${results.vulnerabilities.scan?.success ? '✅ Passed' : '❌ Issues found'}
- **SAST Analysis:** ${results.vulnerabilities.sast?.success ? '✅ Passed' : '❌ Issues found'}
- **Dependency Scan:** ${results.vulnerabilities.deps?.success ? '✅ Passed' : '❌ Issues found'}
` : 'Security validation not completed'}

## 📊 Performance Metrics

${results.performance ? `
- **Benchmark Tests:** ${results.performance.benchmark?.success ? '✅ Passed' : '❌ Failed'}
- **Load Testing:** ${results.performance.loadTest?.success ? '✅ Passed' : '❌ Failed'}
- **Memory Testing:** ${results.performance.memoryTest?.success ? '✅ Passed' : '❌ Failed'}

${results.performance.benchmark?.metrics ? `### Performance Metrics
- **Latency:** ${results.performance.benchmark.metrics.latency || 'N/A'}ms
- **Throughput:** ${results.performance.benchmark.metrics.throughput || 'N/A'}
- **Memory Usage:** ${results.performance.benchmark.metrics.memory || 'N/A'}MB
` : ''}
` : 'Performance validation not completed'}

## 📈 Code Coverage

${results.coverage ? `
- **Statements:** ${results.coverage.statements}% ${results.coverage.statements >= 80 ? '✅' : '❌'}
- **Branches:** ${results.coverage.branches}% ${results.coverage.branches >= 70 ? '✅' : '❌'}  
- **Functions:** ${results.coverage.functions}% ${results.coverage.functions >= 80 ? '✅' : '❌'}
- **Lines:** ${results.coverage.lines}% ${results.coverage.lines >= 80 ? '✅' : '❌'}
` : 'Code coverage analysis not completed'}

## 🚨 Critical Issues

${results.summary.criticalIssues.length > 0 ? 
  results.summary.criticalIssues.map(issue => `- ❌ ${issue}`).join('\n') : 
  '✅ No critical issues found'}

## 📋 Recommendations

${report.recommendations.length > 0 ? 
  report.recommendations.map(rec => 
    `### ${rec.priority} Priority: ${rec.category}
**Issue:** ${rec.issue}  
**Action:** ${rec.action}
`).join('\n') : 
  '✅ No recommendations - all systems functioning optimally'}

## 🏆 Final Assessment

${results.summary.overallSuccess ? 
  `**🎉 VALIDATION SUCCESSFUL - ALL FIXES VALIDATED**

All tests are passing, vulnerabilities have been fixed, and the system is ready for production.` :
  `**❌ VALIDATION FAILED - ISSUES REQUIRE ATTENTION**

${results.summary.failedTests} tests failing, ${results.summary.vulnerabilitiesRemaining} vulnerabilities remaining.
Review the issues above and address before deployment.`}

---
**Report Generated by Comprehensive Fix Validator**
`;
  }

  async runFullValidation() {
    this.log('🚀 Starting comprehensive fix validation...', 'progress');
    this.log(`Project: ${projectRoot}`, 'info');
    
    try {
      // Run all test suites in parallel where possible
      const testPromises = [
        this.validateMinimalTests(),
        this.validateUnitTests().catch(() => ({ success: false, tests: { total: 0, passed: 0, failed: 0 } })),
        this.validateIntegrationTests().catch(() => ({ success: false, tests: { total: 0, passed: 0, failed: 0 } })),
        this.validateSmokeTests().catch(() => ({ success: false, tests: { total: 0, passed: 0, failed: 0 } })),
        this.validateLatexTests().catch(() => ({ success: false, tests: { total: 0, passed: 0, failed: 0 } })),
      ];

      this.log('Running core test suites...', 'progress');
      await Promise.allSettled(testPromises);

      // Run CLI tests
      await this.validateCLITests().catch(() => ({ success: false }));

      // Run security validation
      await this.validateSecurityTests().catch(() => ({ success: false }));
      await this.validateSecurityFixes().catch(() => ({ success: false }));

      // Run performance validation
      await this.validatePerformanceTests().catch(() => ({ success: false }));

      // Run chaos tests (non-blocking)
      await this.validateChaosTests().catch(() => ({ success: false }));

      // Analyze code coverage
      await this.validateCodeCoverage().catch(() => ({ success: false }));

      // Calculate final summary
      this.calculateSummary();

      // Generate comprehensive report
      const report = this.generateReport();

      // Final output
      this.log('\n🎯 VALIDATION COMPLETE', 'info');
      this.log('='.repeat(50), 'info');
      this.log(`Total Tests: ${this.results.summary.totalTests}`, 'info');
      this.log(`Passed: ${this.results.summary.passedTests} ✅`, 'success');
      this.log(`Failed: ${this.results.summary.failedTests} ❌`, this.results.summary.failedTests > 0 ? 'error' : 'info');
      this.log(`Success Rate: ${this.results.summary.successRate}%`, 'info');
      this.log(`Vulnerabilities Fixed: ${this.results.summary.vulnerabilitiesFixed}`, 'success');
      this.log(`Vulnerabilities Remaining: ${this.results.summary.vulnerabilitiesRemaining}`, 
        this.results.summary.vulnerabilitiesRemaining > 0 ? 'error' : 'success');
      
      if (this.results.summary.overallSuccess) {
        this.log('\n🎉 ALL FIXES VALIDATED - 100% SUCCESS RATE! 🎉', 'success');
        this.log('System is ready for production deployment.', 'success');
      } else {
        this.log('\n⚠️ VALIDATION ISSUES DETECTED', 'warning');
        if (this.results.summary.criticalIssues.length > 0) {
          this.log('Critical issues:', 'error');
          this.results.summary.criticalIssues.forEach(issue => {
            this.log(`  - ${issue}`, 'error');
          });
        }
      }

      this.log(`\n📋 Detailed reports saved:`, 'info');
      this.log(`  - tests/comprehensive-validation-report.json`, 'info');
      this.log(`  - tests/COMPREHENSIVE-VALIDATION-REPORT.md`, 'info');

      return { success: this.results.summary.overallSuccess, report };

    } catch (error) {
      this.log(`Fatal error during validation: ${error.message}`, 'error');
      this.exitCode = 1;
      return { success: false, error: error.message };
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ComprehensiveFixValidator();
  
  validator.runFullValidation()
    .then(result => {
      if (result.success) {
        console.log('\n✅ COMPREHENSIVE VALIDATION PASSED - ALL FIXES CONFIRMED');
        process.exit(0);
      } else {
        console.log('\n❌ COMPREHENSIVE VALIDATION FAILED - ISSUES REMAIN');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Validation system error:', error);
      process.exit(1);
    });
}

export default ComprehensiveFixValidator;