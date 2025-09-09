#!/usr/bin/env node

import { CLIVerificationTest } from './cli-verification.test.js';
import { TemplateEngineTest } from './template-engine.test.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Integration Test Runner
 * Runs all integration tests and provides detailed reporting
 */
class ComprehensiveTestRunner {
  constructor() {
    this.testSuites = [
      { 
        name: 'CLI Verification Tests', 
        description: 'Tests basic CLI functionality and commands',
        class: CLIVerificationTest,
        priority: 'HIGH',
        required: true
      },
      { 
        name: 'Template Engine Tests', 
        description: 'Tests template processing and variable substitution',
        class: TemplateEngineTest,
        priority: 'HIGH',
        required: true
      }
    ];
    this.results = [];
    this.startTime = Date.now();
    this.reportDir = path.join(__dirname, '../reports');
  }

  async ensureReportDirectory() {
    try {
      await fs.mkdir(this.reportDir, { recursive: true });
    } catch (error) {
      console.warn(`⚠️ Could not create reports directory: ${error.message}`);
    }
  }

  async runAllSuites(options = {}) {
    console.log('🚀 Comprehensive Integration Test Suite');
    console.log('=======================================');
    console.log(`Running ${this.testSuites.length} test suites...\n`);
    
    if (options.verbose) {
      console.log('📋 Test Suites:');
      this.testSuites.forEach((suite, index) => {
        console.log(`   ${index + 1}. ${suite.name} (${suite.priority})`);
        console.log(`      ${suite.description}`);
      });
      console.log('');
    }
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    for (const [index, suite] of this.testSuites.entries()) {
      console.log(`\n📋 Running Suite ${index + 1}/${this.testSuites.length}: ${suite.name}`);
      console.log('─'.repeat(60));
      
      try {
        const tester = new suite.class();
        const suiteStartTime = Date.now();
        const result = await tester.runAllTests();
        const suiteDuration = Date.now() - suiteStartTime;
        
        this.results.push({
          name: suite.name,
          description: suite.description,
          priority: suite.priority,
          required: suite.required,
          ...result,
          status: result.failed === 0 ? 'PASSED' : 'FAILED',
          duration: suiteDuration
        });
        
        totalTests += result.total;
        totalPassed += result.passed;
        totalFailed += result.failed;
        totalDuration += suiteDuration;
        
        // Suite summary
        const status = result.failed === 0 ? '✅ PASSED' : '❌ FAILED';
        const successRate = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
        console.log(`\n   ${status} - ${result.passed}/${result.total} tests (${successRate}%) in ${Math.round(suiteDuration / 1000)}s`);
        
      } catch (error) {
        console.error(`❌ Suite failed: ${suite.name}`);
        console.error(`   Error: ${error.message}`);
        
        this.results.push({
          name: suite.name,
          description: suite.description,
          priority: suite.priority,
          required: suite.required,
          total: 0,
          passed: 0,
          failed: 1,
          status: 'ERROR',
          error: error.message,
          duration: 0
        });
        
        totalFailed += 1;
      }
    }
    
    const overallDuration = Date.now() - this.startTime;
    
    // Generate comprehensive report
    const report = await this.generateReport({
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      overallDuration,
      options
    });
    
    // Print summary
    this.printSummary(report);
    
    // Save report
    if (options.saveReport !== false) {
      await this.saveReport(report);
    }
    
    return report;
  }

  async generateReport(stats) {
    const { totalTests, totalPassed, totalFailed, overallDuration } = stats;
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cwd: process.cwd()
        },
        runner: 'ComprehensiveTestRunner',
        version: '1.0.0'
      },
      summary: {
        totalSuites: this.testSuites.length,
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        successRate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0,
        duration: overallDuration,
        status: totalFailed === 0 ? 'SUCCESS' : 'FAILURE'
      },
      suites: this.results.map(suite => ({
        ...suite,
        successRate: suite.total > 0 ? Math.round((suite.passed / suite.total) * 100) : 0,
        criticalFailure: suite.required && suite.status !== 'PASSED'
      })),
      analysis: this.analyzeResults(),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  analyzeResults() {
    const analysis = {
      criticalFailures: [],
      warningIssues: [],
      performanceIssues: [],
      strengths: []
    };
    
    this.results.forEach(suite => {
      if (suite.required && suite.status !== 'PASSED') {
        analysis.criticalFailures.push({
          suite: suite.name,
          issue: `Required test suite failed: ${suite.status}`,
          impact: 'HIGH'
        });
      }
      
      if (suite.duration > 10000) { // > 10 seconds
        analysis.performanceIssues.push({
          suite: suite.name,
          issue: `Slow execution: ${Math.round(suite.duration / 1000)}s`,
          impact: 'MEDIUM'
        });
      }
      
      if (suite.status === 'PASSED' && suite.successRate === 100) {
        analysis.strengths.push({
          suite: suite.name,
          achievement: 'All tests passed',
          value: 'HIGH'
        });
      }
    });
    
    return analysis;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const failedSuites = this.results.filter(s => s.status !== 'PASSED');
    if (failedSuites.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Testing',
        action: 'Fix failing test suites',
        details: `${failedSuites.length} test suite(s) are failing`,
        suites: failedSuites.map(s => s.name)
      });
    }
    
    const slowSuites = this.results.filter(s => s.duration > 5000);
    if (slowSuites.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        action: 'Optimize slow test suites',
        details: 'Some test suites are taking longer than expected',
        suites: slowSuites.map(s => s.name)
      });
    }
    
    const hasTimeouts = this.results.some(s => 
      s.results && s.results.some(t => t.error && t.error.includes('timeout'))
    );
    
    if (hasTimeouts) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Reliability',
        action: 'Investigate timeout issues',
        details: 'Some tests are timing out, may indicate performance issues'
      });
    }
    
    return recommendations;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPREHENSIVE INTEGRATION TEST SUMMARY');
    console.log('='.repeat(70));
    
    const { summary, analysis } = report;
    
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Status: ${summary.status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILURE'}`);
    console.log(`   Test Suites: ${summary.totalSuites}`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   Passed: ${summary.passed} ✅`);
    console.log(`   Failed: ${summary.failed} ❌`);
    console.log(`   Success Rate: ${summary.successRate}%`);
    console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
    
    console.log(`\n📋 Suite Details:`);
    report.suites.forEach((suite, index) => {
      const status = suite.status === 'PASSED' ? '✅' : '❌';
      const priority = suite.priority === 'HIGH' ? '🔴' : '🟡';
      
      console.log(`   ${index + 1}. ${status} ${suite.name} ${priority}`);
      console.log(`      Tests: ${suite.passed}/${suite.total} (${suite.successRate}%)`);
      console.log(`      Duration: ${Math.round(suite.duration / 1000)}s`);
      
      if (suite.criticalFailure) {
        console.log(`      ⚠️ CRITICAL: Required suite failed`);
      }
    });
    
    // Analysis
    if (analysis.criticalFailures.length > 0) {
      console.log(`\n🚨 Critical Issues:`);
      analysis.criticalFailures.forEach(issue => {
        console.log(`   • ${issue.issue} (${issue.impact} impact)`);
      });
    }
    
    if (analysis.strengths.length > 0) {
      console.log(`\n🎉 Strengths:`);
      analysis.strengths.forEach(strength => {
        console.log(`   • ${strength.achievement}: ${strength.suite}`);
      });
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => {
        const priority = rec.priority === 'HIGH' ? '🔴' : '🟡';
        console.log(`   ${priority} ${rec.action}`);
        console.log(`      ${rec.details}`);
      });
    }
    
    console.log(`\n${summary.status === 'SUCCESS' ? '🎉' : '⚠️'} ${summary.status === 'SUCCESS' ? 'ALL INTEGRATION TESTS PASSED!' : 'INTEGRATION TESTS NEED ATTENTION'}`);
  }

  async saveReport(report) {
    try {
      await this.ensureReportDirectory();
      
      // Save JSON report
      const jsonReportPath = path.join(this.reportDir, 'integration-test-report.json');
      await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
      
      // Save HTML report
      const htmlReport = this.generateHTMLReport(report);
      const htmlReportPath = path.join(this.reportDir, 'integration-test-report.html');
      await fs.writeFile(htmlReportPath, htmlReport);
      
      console.log(`\n📄 Reports saved:`);
      console.log(`   JSON: ${jsonReportPath}`);
      console.log(`   HTML: ${htmlReportPath}`);
      
    } catch (error) {
      console.warn(`⚠️ Could not save reports: ${error.message}`);
    }
  }

  generateHTMLReport(report) {
    const { summary, suites, analysis } = report;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e1e5e9; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #28a745; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .suite { background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 10px 0; }
        .suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .progress-bar { background: #e1e5e9; height: 20px; border-radius: 10px; overflow: hidden; }
        .progress-fill { background: #28a745; height: 100%; transition: width 0.3s; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Integration Test Report</h1>
        <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="${summary.status === 'SUCCESS' ? 'status-pass' : 'status-fail'}">${summary.status}</span></p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${summary.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #28a745">${summary.passed}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #dc3545">${summary.failed}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.successRate}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
    </div>

    <h2>📋 Test Suites</h2>
    ${suites.map(suite => `
        <div class="suite">
            <div class="suite-header">
                <h3>${suite.status === 'PASSED' ? '✅' : '❌'} ${suite.name}</h3>
                <span>${suite.passed}/${suite.total} tests</span>
            </div>
            <p>${suite.description}</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${suite.successRate}%"></div>
            </div>
            <small>Duration: ${Math.round(suite.duration / 1000)}s | Priority: ${suite.priority}</small>
        </div>
    `).join('')}

    ${analysis.criticalFailures.length > 0 ? `
        <div class="recommendations">
            <h2>🚨 Critical Issues</h2>
            <ul>
                ${analysis.criticalFailures.map(issue => `<li><strong>${issue.issue}</strong> (${issue.impact} impact)</li>`).join('')}
            </ul>
        </div>
    ` : ''}

    ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            <ul>
                ${report.recommendations.map(rec => `<li><strong>${rec.action}:</strong> ${rec.details}</li>`).join('')}
            </ul>
        </div>
    ` : ''}

    <footer style="margin-top: 40px; padding: 20px; border-top: 1px solid #e1e5e9; color: #6c757d; text-align: center;">
        <p>Generated by Unjucks Comprehensive Integration Test Runner v1.0.0</p>
        <p>Environment: Node.js ${report.metadata.environment.node} on ${report.metadata.environment.platform}</p>
    </footer>
</body>
</html>`;
  }
}

// Enhanced CLI
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    saveReport: !args.includes('--no-report'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log('Comprehensive Integration Test Runner');
    console.log('Usage: node comprehensive-test-runner.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v     Verbose output with detailed information');
    console.log('  --no-report       Do not save HTML/JSON reports');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Reports are saved to: tests/reports/');
    return;
  }
  
  const runner = new ComprehensiveTestRunner();
  
  try {
    const report = await runner.runAllSuites(options);
    
    // Exit with appropriate code
    process.exit(report.summary.status === 'SUCCESS' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { ComprehensiveTestRunner };