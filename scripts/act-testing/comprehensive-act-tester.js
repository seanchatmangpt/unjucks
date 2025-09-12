#!/usr/bin/env node

/**
 * Comprehensive Act Testing Suite
 * 
 * Master orchestrator for all act testing components.
 * Runs workflow analysis, matrix testing, service container testing,
 * and generates comprehensive reports with recommendations.
 * 
 * @author Act Compatibility Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { WorkflowAnalyzer } from './workflow-analyzer.js';
import { ActTestRunner } from './act-test-runner.js';
import { MatrixTester } from './matrix-tester.js';
import { ServiceContainerTester } from './service-container-tester.js';

const execAsync = promisify(exec);

class ComprehensiveActTester {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      parallel: options.parallel || false,
      testSuite: options.testSuite || 'all', // all, quick, ci, security, performance
      outputDir: options.outputDir || 'test-results/act',
      generateReport: options.generateReport !== false,
      ...options
    };
    
    this.results = {
      analysis: null,
      basicTests: null,
      matrixTests: null,
      serviceTests: null,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        limitations: []
      }
    };
    
    this.startTime = this.getDeterministicTimestamp();
  }

  async runComprehensiveTesting() {
    console.log('🚀 Starting Comprehensive Act Testing Suite...');
    console.log(`Test Suite: ${this.options.testSuite}`);
    console.log(`Dry Run: ${this.options.dryRun}`);
    console.log(`Parallel: ${this.options.parallel}`);
    
    try {
      // Setup
      await this.setup();
      
      // Run test components based on suite
      await this.runTestComponents();
      
      // Generate comprehensive report
      if (this.options.generateReport) {
        await this.generateComprehensiveReport();
      }
      
      // Summary
      this.printFinalSummary();
      
      return this.results;
      
    } catch (error) {
      console.error('💥 Comprehensive testing failed:', error);
      throw error;
    }
  }

  async setup() {
    console.log('🔧 Setting up testing environment...');
    
    // Create output directories
    await fs.mkdir(this.options.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.options.outputDir, 'logs'), { recursive: true });
    await fs.mkdir(path.join(this.options.outputDir, 'reports'), { recursive: true });
    
    // Check prerequisites
    await this.checkPrerequisites();
    
    console.log('✅ Setup completed');
  }

  async checkPrerequisites() {
    const checks = [
      { cmd: 'act --version', name: 'act' },
      { cmd: 'docker --version', name: 'Docker' },
      { cmd: 'docker info', name: 'Docker daemon' }
    ];
    
    for (const check of checks) {
      try {
        await execAsync(check.cmd);
        console.log(`  ✅ ${check.name} is available`);
      } catch (error) {
        throw new Error(`${check.name} is not available: ${error.message}`);
      }
    }
  }

  async runTestComponents() {
    console.log('\n🧪 Running test components...');
    
    const components = this.getTestComponents();
    
    if (this.options.parallel) {
      await this.runComponentsParallel(components);
    } else {
      await this.runComponentsSequential(components);
    }
  }

  getTestComponents() {
    const allComponents = [
      { name: 'analysis', func: () => this.runWorkflowAnalysis() },
      { name: 'basic', func: () => this.runBasicTests() },
      { name: 'matrix', func: () => this.runMatrixTests() },
      { name: 'services', func: () => this.runServiceTests() }
    ];
    
    switch (this.options.testSuite) {
      case 'quick':
        return allComponents.filter(c => ['analysis', 'basic'].includes(c.name));
      case 'ci':
        return allComponents.filter(c => ['analysis', 'basic', 'matrix'].includes(c.name));
      case 'full':
      case 'all':
      default:
        return allComponents;
    }
  }

  async runComponentsParallel(components) {
    console.log('⚡ Running components in parallel...');
    
    const promises = components.map(async (component) => {
      try {
        console.log(`  🔄 Starting ${component.name}...`);
        return await component.func();
      } catch (error) {
        console.error(`  ❌ ${component.name} failed:`, error.message);
        return null;
      }
    });
    
    await Promise.allSettled(promises);
  }

  async runComponentsSequential(components) {
    console.log('📋 Running components sequentially...');
    
    for (const component of components) {
      try {
        console.log(`  🔄 Running ${component.name}...`);
        await component.func();
        console.log(`  ✅ ${component.name} completed`);
      } catch (error) {
        console.error(`  ❌ ${component.name} failed:`, error.message);
      }
    }
  }

  async runWorkflowAnalysis() {
    console.log('📊 Running workflow analysis...');
    
    const analyzer = new WorkflowAnalyzer();
    this.results.analysis = await analyzer.analyzeWorkflows();
    
    console.log(`  Analyzed ${this.results.analysis.summary.total} workflows`);
    console.log(`  Supported: ${this.results.analysis.summary.supported}`);
    console.log(`  Partially supported: ${this.results.analysis.summary.partiallySupported}`);
    console.log(`  Unsupported: ${this.results.analysis.summary.unsupported}`);
  }

  async runBasicTests() {
    console.log('🧪 Running basic workflow tests...');
    
    const runner = new ActTestRunner({
      ...this.options,
      outputDir: path.join(this.options.outputDir, 'basic')
    });
    
    this.results.basicTests = await runner.runAllTests();
    
    this.results.summary.totalTests += this.results.basicTests.total;
    this.results.summary.passed += this.results.basicTests.passed;
    this.results.summary.failed += this.results.basicTests.failed;
  }

  async runMatrixTests() {
    console.log('🔲 Running matrix build tests...');
    
    const tester = new MatrixTester({
      ...this.options,
      outputDir: path.join(this.options.outputDir, 'matrix')
    });
    
    this.results.matrixTests = await tester.testAllMatrices();
    
    this.results.summary.totalTests += this.results.matrixTests.matrices.length;
    this.results.summary.passed += this.results.matrixTests.passed;
    this.results.summary.failed += this.results.matrixTests.failed;
  }

  async runServiceTests() {
    console.log('🐳 Running service container tests...');
    
    const tester = new ServiceContainerTester({
      ...this.options,
      outputDir: path.join(this.options.outputDir, 'services')
    });
    
    this.results.serviceTests = await tester.testAllServiceContainers();
    
    this.results.summary.totalTests += this.results.serviceTests.services.length;
    this.results.summary.passed += this.results.serviceTests.passed;
    this.results.summary.failed += this.results.serviceTests.failed;
  }

  async generateComprehensiveReport() {
    console.log('\n📄 Generating comprehensive report...');
    
    const report = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        duration: this.getDeterministicTimestamp() - this.startTime,
        testSuite: this.options.testSuite,
        options: this.options
      },
      summary: this.results.summary,
      components: {
        analysis: this.results.analysis,
        basicTests: this.results.basicTests,
        matrixTests: this.results.matrixTests,
        serviceTests: this.results.serviceTests
      },
      recommendations: this.generateRecommendations(),
      actionPlan: this.generateActionPlan()
    };
    
    // Save JSON report
    const jsonPath = path.join(this.options.outputDir, 'comprehensive-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const markdownReport = await this.generateMarkdownReport(report);
    const mdPath = path.join(this.options.outputDir, 'comprehensive-report.md');
    await fs.writeFile(mdPath, markdownReport);
    
    // Generate HTML dashboard
    const htmlDashboard = await this.generateHtmlDashboard(report);
    const htmlPath = path.join(this.options.outputDir, 'dashboard.html');
    await fs.writeFile(htmlPath, htmlDashboard);
    
    console.log(`📊 Reports generated:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);
    console.log(`  HTML Dashboard: ${htmlPath}`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analysis-based recommendations
    if (this.results.analysis) {
      if (this.results.analysis.summary.unsupported > 0) {
        recommendations.push({
          category: 'Workflow Compatibility',
          priority: 'high',
          action: 'Fix unsupported workflows by adding act compatibility layers'
        });
      }
      
      if (this.results.analysis.summary.partiallySupported > 0) {
        recommendations.push({
          category: 'Workflow Optimization',
          priority: 'medium',
          action: 'Optimize partially supported workflows with environment conditionals'
        });
      }
    }
    
    // Basic test recommendations
    if (this.results.basicTests && this.results.basicTests.failed > 0) {
      recommendations.push({
        category: 'Basic Testing',
        priority: 'high',
        action: 'Fix failing basic tests before proceeding with complex workflows'
      });
    }
    
    // Matrix test recommendations
    if (this.results.matrixTests && this.results.matrixTests.failed > 0) {
      recommendations.push({
        category: 'Matrix Builds',
        priority: 'medium',
        action: 'Simplify matrix configurations for local testing'
      });
    }
    
    // Service test recommendations
    if (this.results.serviceTests && this.results.serviceTests.failed > 0) {
      recommendations.push({
        category: 'Service Containers',
        priority: 'medium',
        action: 'Review service container configurations and networking'
      });
    }
    
    return recommendations;
  }

  generateActionPlan() {
    const plan = [];
    
    // Immediate actions
    plan.push({
      phase: 'Immediate (1-2 days)',
      actions: [
        'Fix critical workflow incompatibilities',
        'Add environment conditionals for act',
        'Create act-specific workflow variants'
      ]
    });
    
    // Short-term actions
    plan.push({
      phase: 'Short-term (1-2 weeks)',
      actions: [
        'Integrate act testing into development workflow',
        'Train team on act usage and best practices',
        'Set up automated act testing in CI/CD'
      ]
    });
    
    // Long-term actions
    plan.push({
      phase: 'Long-term (1+ months)',
      actions: [
        'Maintain act compatibility for all new workflows',
        'Regular review and updates of act configurations',
        'Contribute improvements back to the act project'
      ]
    });
    
    return plan;
  }

  async generateMarkdownReport(report) {
    return `# Comprehensive Act Testing Report

## Executive Summary

- **Test Duration**: ${Math.round(report.metadata.duration / 1000)}s
- **Test Suite**: ${report.metadata.testSuite}
- **Total Tests**: ${report.summary.totalTests}
- **Success Rate**: ${Math.round((report.summary.passed / report.summary.totalTests) * 100)}%

## Results Overview

| Component | Tests | Passed | Failed | Success Rate |
|-----------|-------|--------|--------|--------------|
| Workflow Analysis | ${report.components.analysis?.summary.total || 0} | ${report.components.analysis?.summary.supported || 0} | ${report.components.analysis?.summary.unsupported || 0} | ${report.components.analysis ? Math.round((report.components.analysis.summary.supported / report.components.analysis.summary.total) * 100) : 0}% |
| Basic Tests | ${report.components.basicTests?.total || 0} | ${report.components.basicTests?.passed || 0} | ${report.components.basicTests?.failed || 0} | ${report.components.basicTests ? Math.round((report.components.basicTests.passed / report.components.basicTests.total) * 100) : 0}% |
| Matrix Tests | ${report.components.matrixTests?.matrices.length || 0} | ${report.components.matrixTests?.passed || 0} | ${report.components.matrixTests?.failed || 0} | ${report.components.matrixTests ? Math.round((report.components.matrixTests.passed / report.components.matrixTests.matrices.length) * 100) : 0}% |
| Service Tests | ${report.components.serviceTests?.services.length || 0} | ${report.components.serviceTests?.passed || 0} | ${report.components.serviceTests?.failed || 0} | ${report.components.serviceTests ? Math.round((report.components.serviceTests.passed / report.components.serviceTests.services.length) * 100) : 0}% |

## Key Findings

### Workflow Analysis
${report.components.analysis ? `
- **Total Workflows**: ${report.components.analysis.summary.total}
- **Fully Supported**: ${report.components.analysis.summary.supported}
- **Partially Supported**: ${report.components.analysis.summary.partiallySupported}
- **Unsupported**: ${report.components.analysis.summary.unsupported}
` : 'Not available'}

### Basic Testing
${report.components.basicTests ? `
- **Pass Rate**: ${Math.round((report.components.basicTests.passed / report.components.basicTests.total) * 100)}%
- **Failed Tests**: ${report.components.basicTests.failed}
` : 'Not available'}

### Matrix Build Testing
${report.components.matrixTests ? `
- **Matrices Tested**: ${report.components.matrixTests.matrices.length}
- **Success Rate**: ${Math.round((report.components.matrixTests.passed / report.components.matrixTests.matrices.length) * 100)}%
` : 'Not available'}

### Service Container Testing
${report.components.serviceTests ? `
- **Services Tested**: ${report.components.serviceTests.services.length}
- **Success Rate**: ${Math.round((report.components.serviceTests.passed / report.components.serviceTests.services.length) * 100)}%
` : 'Not available'}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.category} (${rec.priority} priority)
${rec.action}
`).join('\n')}

## Action Plan

${report.actionPlan.map(phase => `
### ${phase.phase}
${phase.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}

## Detailed Results

### Component Reports
- Basic Tests: [basic-test-report.json](./basic/act-test-report.json)
- Matrix Tests: [matrix-test-report.json](./matrix/matrix-test-report.json)
- Service Tests: [service-container-report.json](./services/service-container-report.json)

### Next Steps

1. **Review Failed Tests**: Examine individual test logs to understand failures
2. **Implement Fixes**: Apply recommended workarounds and configurations
3. **Retest**: Run tests again to verify improvements
4. **Integrate**: Add act testing to development workflow
5. **Monitor**: Set up regular compatibility checks

Generated on ${this.getDeterministicDate().toLocaleString()}
`;
  }

  async generateHtmlDashboard(report) {
    const passRate = Math.round((report.summary.passed / report.summary.totalTests) * 100);
    const statusColor = passRate >= 80 ? '#28a745' : passRate >= 60 ? '#ffc107' : '#dc3545';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Act Compatibility Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: ${statusColor}; }
        .metric-label { color: #666; margin-top: 5px; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: ${statusColor}; width: ${passRate}%; transition: width 0.3s ease; }
        .component-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-danger { color: #dc3545; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Act Compatibility Dashboard</h1>
            <p class="timestamp">Generated: ${this.getDeterministicDate().toLocaleString()}</p>
            <p>Test Suite: <strong>${report.metadata.testSuite}</strong> | Duration: <strong>${Math.round(report.metadata.duration / 1000)}s</strong></p>
        </div>

        <div class="summary">
            <div class="card metric">
                <div class="metric-value">${report.summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="card metric">
                <div class="metric-value status-good">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="card metric">
                <div class="metric-value status-danger">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="card metric">
                <div class="metric-value">${passRate}%</div>
                <div class="metric-label">Success Rate</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        </div>

        <div class="component-grid">
            <div class="card">
                <h3>📊 Workflow Analysis</h3>
                ${report.components.analysis ? `
                <p><strong>Supported:</strong> <span class="status-good">${report.components.analysis.summary.supported}</span></p>
                <p><strong>Partially Supported:</strong> <span class="status-warning">${report.components.analysis.summary.partiallySupported}</span></p>
                <p><strong>Unsupported:</strong> <span class="status-danger">${report.components.analysis.summary.unsupported}</span></p>
                ` : '<p>Not available</p>'}
            </div>

            <div class="card">
                <h3>🧪 Basic Tests</h3>
                ${report.components.basicTests ? `
                <p><strong>Total:</strong> ${report.components.basicTests.total}</p>
                <p><strong>Passed:</strong> <span class="status-good">${report.components.basicTests.passed}</span></p>
                <p><strong>Failed:</strong> <span class="status-danger">${report.components.basicTests.failed}</span></p>
                ` : '<p>Not available</p>'}
            </div>

            <div class="card">
                <h3>🔲 Matrix Tests</h3>
                ${report.components.matrixTests ? `
                <p><strong>Matrices:</strong> ${report.components.matrixTests.matrices.length}</p>
                <p><strong>Passed:</strong> <span class="status-good">${report.components.matrixTests.passed}</span></p>
                <p><strong>Failed:</strong> <span class="status-danger">${report.components.matrixTests.failed}</span></p>
                ` : '<p>Not available</p>'}
            </div>

            <div class="card">
                <h3>🐳 Service Tests</h3>
                ${report.components.serviceTests ? `
                <p><strong>Services:</strong> ${report.components.serviceTests.services.length}</p>
                <p><strong>Passed:</strong> <span class="status-good">${report.components.serviceTests.passed}</span></p>
                <p><strong>Failed:</strong> <span class="status-danger">${report.components.serviceTests.failed}</span></p>
                ` : '<p>Not available</p>'}
            </div>
        </div>

        <div class="card" style="margin-top: 30px;">
            <h3>📋 Recommendations</h3>
            ${report.recommendations.map(rec => `
                <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${rec.priority === 'high' ? '#dc3545' : rec.priority === 'medium' ? '#ffc107' : '#28a745'}; background: #f8f9fa;">
                    <strong>${rec.category}</strong> (${rec.priority} priority)
                    <br><small>${rec.action}</small>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  printFinalSummary() {
    const duration = Math.round((this.getDeterministicTimestamp() - this.startTime) / 1000);
    const passRate = Math.round((this.results.summary.passed / this.results.summary.totalTests) * 100);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPREHENSIVE ACT TESTING COMPLETED');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Tests: ${this.results.summary.totalTests}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`📈 Success Rate: ${passRate}%`);
    console.log('='.repeat(60));
    
    if (this.results.summary.failed > 0) {
      console.log('⚠️  Some tests failed. Check detailed reports for analysis.');
    } else {
      console.log('🎯 All tests passed! Your workflows are act-compatible.');
    }
    
    console.log(`📄 Detailed reports available in: ${this.options.outputDir}`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    parallel: args.includes('--parallel'),
    testSuite: args.includes('--suite') ? 
      args[args.indexOf('--suite') + 1] || 'all' : 'all'
  };
  
  const tester = new ComprehensiveActTester(options);
  
  tester.runComprehensiveTesting()
    .then(results => {
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Comprehensive testing failed:', error);
      process.exit(1);
    });
}

export { ComprehensiveActTester };