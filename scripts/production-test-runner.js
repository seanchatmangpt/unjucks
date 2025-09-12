#!/usr/bin/env node

/**
 * Production Test Orchestration Script
 * Coordinates execution of comprehensive production validation suite
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class ProductionTestOrchestrator {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'full', // quick, full, stress, compliance
      parallel: options.parallel !== false,
      reportDir: options.reportDir || './production-reports',
      timeout: options.timeout || 3600000, // 1 hour default
      environment: options.environment || 'test',
      ...options
    };
    
    this.testSuites = {
      quick: [
        'performance-benchmarks',
        'security-hardening',
        'integration-smoke'
      ],
      full: [
        'performance-benchmarks',
        'scalability-stress',
        'security-hardening',
        'cross-platform',
        'error-recovery',
        'integration-smoke',
        'monitoring-alerting'
      ],
      stress: [
        'scalability-stress',
        'performance-benchmarks',
        'error-recovery',
        'cross-platform'
      ],
      compliance: [
        'compliance-governance',
        'security-hardening',
        'enterprise-integration',
        'monitoring-alerting'
      ]
    };

    this.results = {
      startTime: this.getDeterministicDate(),
      endTime: null,
      duration: null,
      testResults: {},
      summary: {},
      environment: {
        os: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
        cpus: os.cpus().length
      }
    };
  }

  async init() {
    console.log('🚀 Production Test Orchestrator Initializing...');
    console.log(`📊 Validation Level: ${this.options.level}`);
    console.log(`🔧 Environment: ${this.options.environment}`);
    console.log(`💾 Reports Directory: ${this.options.reportDir}`);
    
    // Ensure report directory exists
    await fs.mkdir(this.options.reportDir, { recursive: true });
    
    // Create timestamped subdirectory
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    this.reportPath = path.join(this.options.reportDir, `run-${timestamp}`);
    await fs.mkdir(this.reportPath, { recursive: true });
    
    console.log(`📁 Session Reports: ${this.reportPath}`);
  }

  async runTestSuite(suiteName) {
    const startTime = this.getDeterministicTimestamp();
    console.log(`\n🧪 Running ${suiteName}...`);
    
    try {
      const testFile = path.join('tests/production', `${suiteName}.test.js`);
      
      // Check if test file exists
      await fs.access(testFile);
      
      // Run the test with Jest
      const command = `npx jest ${testFile} --json --outputFile=${path.join(this.reportPath, `${suiteName}-results.json`)} --verbose`;
      
      const result = await this.executeCommand(command, {
        timeout: this.options.timeout / this.testSuites[this.options.level].length
      });
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      this.results.testResults[suiteName] = {
        status: result.success ? 'PASSED' : 'FAILED',
        duration,
        output: result.output,
        error: result.error
      };
      
      console.log(`✅ ${suiteName} completed in ${duration}ms`);
      return result.success;
      
    } catch (error) {
      const duration = this.getDeterministicTimestamp() - startTime;
      
      this.results.testResults[suiteName] = {
        status: 'ERROR',
        duration,
        error: error.message
      };
      
      console.error(`❌ ${suiteName} failed: ${error.message}`);
      return false;
    }
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: options.timeout || 300000
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) {
          process.stdout.write(data);
        }
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) {
          process.stderr.write(data);
        }
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async runSequential() {
    const testSuites = this.testSuites[this.options.level];
    let passed = 0;
    let failed = 0;
    
    for (const suite of testSuites) {
      const success = await this.runTestSuite(suite);
      if (success) {
        passed++;
      } else {
        failed++;
      }
    }
    
    return { passed, failed };
  }

  async runParallel() {
    const testSuites = this.testSuites[this.options.level];
    const maxConcurrent = Math.min(testSuites.length, os.cpus().length);
    
    console.log(`🔄 Running ${testSuites.length} test suites with ${maxConcurrent} max concurrent`);
    
    const promises = testSuites.map(suite => this.runTestSuite(suite));
    const results = await Promise.allSettled(promises);
    
    let passed = 0;
    let failed = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        passed++;
      } else {
        failed++;
        console.error(`❌ Suite ${testSuites[index]} failed:`, result.reason);
      }
    });
    
    return { passed, failed };
  }

  async generateReport() {
    this.results.endTime = this.getDeterministicDate();
    this.results.duration = this.results.endTime - this.results.startTime;
    
    // Calculate summary
    const total = Object.keys(this.results.testResults).length;
    const passed = Object.values(this.results.testResults).filter(r => r.status === 'PASSED').length;
    const failed = Object.values(this.results.testResults).filter(r => r.status === 'FAILED').length;
    const errors = Object.values(this.results.testResults).filter(r => r.status === 'ERROR').length;
    
    this.results.summary = {
      total,
      passed,
      failed,
      errors,
      successRate: Math.round((passed / total) * 100),
      totalDuration: this.results.duration
    };
    
    // Generate reports
    await this.generateJSONReport();
    await this.generateHTMLReport();
    await this.generateExecutiveSummary();
    
    return this.results;
  }

  async generateJSONReport() {
    const reportFile = path.join(this.reportPath, 'production-validation-report.json');
    await fs.writeFile(reportFile, JSON.stringify(this.results, null, 2));
    console.log(`📄 JSON Report: ${reportFile}`);
  }

  async generateHTMLReport() {
    const html = this.generateHTMLTemplate();
    const reportFile = path.join(this.reportPath, 'production-validation-report.html');
    await fs.writeFile(reportFile, html);
    console.log(`📊 HTML Report: ${reportFile}`);
  }

  generateHTMLTemplate() {
    const { summary, testResults, environment } = this.results;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Production Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
        .passed { border-left: 4px solid #4CAF50; }
        .failed { border-left: 4px solid #f44336; }
        .error { border-left: 4px solid #ff9800; }
        .test-results { margin: 20px 0; }
        .test-item { margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .status { font-weight: bold; padding: 5px 10px; border-radius: 4px; color: white; }
        .status.PASSED { background-color: #4CAF50; }
        .status.FAILED { background-color: #f44336; }
        .status.ERROR { background-color: #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Production Validation Report</h1>
        <p><strong>Generated:</strong> ${this.results.endTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${Math.round(this.results.duration / 1000)}s</p>
        <p><strong>Environment:</strong> ${environment.os} ${environment.arch} | Node ${environment.nodeVersion}</p>
    </div>
    
    <div class="summary">
        <div class="metric passed">
            <h3>${summary.passed}</h3>
            <p>Tests Passed</p>
        </div>
        <div class="metric failed">
            <h3>${summary.failed}</h3>
            <p>Tests Failed</p>
        </div>
        <div class="metric error">
            <h3>${summary.errors}</h3>
            <p>Errors</p>
        </div>
        <div class="metric">
            <h3>${summary.successRate}%</h3>
            <p>Success Rate</p>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        ${Object.entries(testResults).map(([name, result]) => `
            <div class="test-item">
                <h3>${name} <span class="status ${result.status}">${result.status}</span></h3>
                <p><strong>Duration:</strong> ${result.duration}ms</p>
                ${result.error ? `<p style="color: red;"><strong>Error:</strong> ${result.error}</p>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `.trim();
  }

  async generateExecutiveSummary() {
    const { summary, environment } = this.results;
    
    const executiveSummary = `
# Production Validation Executive Summary

**Date:** ${this.results.endTime.toISOString()}
**Duration:** ${Math.round(this.results.duration / 1000)}s
**Environment:** ${environment.os} ${environment.arch} | Node ${environment.nodeVersion}

## Results Overview

- **Total Test Suites:** ${summary.total}
- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Errors:** ${summary.errors}
- **Success Rate:** ${summary.successRate}%

## Status

${summary.successRate >= 95 ? '✅ **PRODUCTION READY**' : 
  summary.successRate >= 80 ? '⚠️ **REVIEW REQUIRED**' : 
  '❌ **NOT PRODUCTION READY**'}

## Recommendations

${this.generateRecommendations()}

---
*Generated by Production Test Orchestrator*
    `.trim();
    
    const reportFile = path.join(this.reportPath, 'executive-summary.md');
    await fs.writeFile(reportFile, executiveSummary);
    console.log(`📋 Executive Summary: ${reportFile}`);
  }

  generateRecommendations() {
    const { summary, testResults } = this.results;
    const recommendations = [];
    
    if (summary.successRate < 95) {
      recommendations.push('- Address failing test suites before production deployment');
    }
    
    const failedTests = Object.entries(testResults)
      .filter(([, result]) => result.status !== 'PASSED')
      .map(([name]) => name);
    
    if (failedTests.includes('security-hardening')) {
      recommendations.push('- **CRITICAL**: Security vulnerabilities detected - immediate attention required');
    }
    
    if (failedTests.includes('performance-benchmarks')) {
      recommendations.push('- Performance targets not met - optimization required');
    }
    
    if (failedTests.includes('scalability-stress')) {
      recommendations.push('- Scalability limits exceeded - architecture review needed');
    }
    
    if (failedTests.includes('compliance-governance')) {
      recommendations.push('- Compliance requirements not met - legal review required');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- All validation checks passed - ready for production deployment');
      recommendations.push('- Continue monitoring production metrics and performance');
    }
    
    return recommendations.join('\n');
  }

  async run() {
    try {
      await this.init();
      
      console.log(`\n🔄 Starting ${this.options.level} validation with ${this.testSuites[this.options.level].length} test suites...`);
      
      const { passed, failed } = this.options.parallel ? 
        await this.runParallel() : 
        await this.runSequential();
      
      console.log(`\n📊 Test Execution Complete:`);
      console.log(`   ✅ Passed: ${passed}`);
      console.log(`   ❌ Failed: ${failed}`);
      
      const results = await this.generateReport();
      
      console.log(`\n🎯 Final Result: ${results.summary.successRate}% success rate`);
      
      if (results.summary.successRate >= 95) {
        console.log('🚀 PRODUCTION READY!');
        process.exit(0);
      } else if (results.summary.successRate >= 80) {
        console.log('⚠️  REVIEW REQUIRED - Some issues detected');
        process.exit(1);
      } else {
        console.log('❌ NOT PRODUCTION READY - Critical issues found');
        process.exit(2);
      }
      
    } catch (error) {
      console.error('💥 Production validation failed:', error);
      process.exit(3);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--level':
        options.level = args[++i];
        break;
      case '--sequential':
        options.parallel = false;
        break;
      case '--report-dir':
        options.reportDir = args[++i];
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--help':
        console.log(`
Production Test Orchestrator

Usage: node scripts/production-test-runner.js [options]

Options:
  --level <level>        Validation level: quick, full, stress, compliance (default: full)
  --sequential          Run tests sequentially instead of parallel
  --report-dir <path>   Directory for test reports (default: ./production-reports)
  --timeout <ms>        Maximum execution time in milliseconds (default: 3600000)
  --environment <env>   Test environment: test, staging, production (default: test)
  --help                Show this help message

Examples:
  node scripts/production-test-runner.js --level quick
  node scripts/production-test-runner.js --level compliance --sequential
  node scripts/production-test-runner.js --level stress --timeout 7200000
        `);
        process.exit(0);
        break;
    }
  }
  
  const orchestrator = new ProductionTestOrchestrator(options);
  orchestrator.run();
}

module.exports = ProductionTestOrchestrator;