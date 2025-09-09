#!/usr/bin/env node

/**
 * ACT Validation Runner
 * Simple test runner for validating the ACT testing framework
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ActValidationRunner {
  constructor() {
    this.workflowsDir = '.github/workflows';
    this.resultsDir = 'tests/workflows/results';
    this.testResults = {
      summary: {
        totalWorkflows: 0,
        analyzedWorkflows: 0,
        compatibleWorkflows: 0,
        incompatibleWorkflows: 0,
        frameworkTests: 0,
        passedFrameworkTests: 0,
        failedFrameworkTests: 0
      },
      workflows: [],
      frameworkValidation: [],
      recommendations: []
    };
  }

  async run() {
    console.log('🚀 ACT Workflow Validation Framework - Comprehensive Test');
    console.log('=========================================================\n');

    try {
      this.setupDirectories();
      await this.discoverWorkflows();
      await this.analyzeWorkflows();
      await this.validateFrameworkComponents();
      await this.generateReport();
      await this.storeInMemory();
      
      this.displaySummary();
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  setupDirectories() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async discoverWorkflows() {
    console.log('🔍 Discovering workflows...');
    
    if (!fs.existsSync(this.workflowsDir)) {
      throw new Error(`Workflows directory not found: ${this.workflowsDir}`);
    }

    const files = fs.readdirSync(this.workflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
      .map(file => path.join(this.workflowsDir, file));

    this.testResults.summary.totalWorkflows = files.length;
    
    console.log(`📊 Found ${files.length} workflows`);
    return files;
  }

  async analyzeWorkflows() {
    console.log('\n📋 Analyzing workflows for ACT compatibility...');
    
    const workflowFiles = await this.discoverWorkflows();
    
    for (const filePath of workflowFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const workflowName = path.basename(filePath);
        
        const analysis = this.analyzeWorkflowContent(content, workflowName);
        this.testResults.workflows.push(analysis);
        this.testResults.summary.analyzedWorkflows++;
        
        if (analysis.actCompatible) {
          this.testResults.summary.compatibleWorkflows++;
          console.log(`  ✅ ${workflowName} - Compatible`);
        } else {
          this.testResults.summary.incompatibleWorkflows++;
          console.log(`  ⚠️  ${workflowName} - Requires modifications`);
        }
        
      } catch (error) {
        console.error(`  ❌ ${path.basename(filePath)} - Analysis failed: ${error.message}`);
      }
    }
  }

  analyzeWorkflowContent(content, workflowName) {
    const analysis = {
      name: workflowName,
      actCompatible: true,
      issues: [],
      recommendations: [],
      features: {
        hasMatrix: false,
        hasServices: false,
        hasEnvironments: false,
        hasSecrets: false,
        hasManualApproval: false,
        jobCount: 0,
        estimatedComplexity: 'low'
      }
    };

    // Check for ACT incompatible features
    if (content.includes('environment:')) {
      analysis.actCompatible = false;
      analysis.issues.push('Uses GitHub Environment protection (not supported in ACT)');
      analysis.recommendations.push('Comment out environment blocks or use conditional logic');
    }

    if (content.includes('manual-approval') || content.includes('trstringer/manual-approval')) {
      analysis.actCompatible = false;
      analysis.issues.push('Uses manual approval actions (not supported in ACT)');
      analysis.recommendations.push('Replace with automatic approval for testing');
    }

    if (content.includes('${{ secrets.')) {
      analysis.features.hasSecrets = true;
      analysis.recommendations.push('Use .secrets.act file for testing');
    }

    if (content.includes('services:')) {
      analysis.features.hasServices = true;
      analysis.recommendations.push('Ensure service containers are properly configured');
    }

    if (content.includes('strategy:') && content.includes('matrix:')) {
      analysis.features.hasMatrix = true;
    }

    // Count jobs
    const jobMatches = content.match(/^\s*\w+:\s*$/gm);
    if (jobMatches) {
      analysis.features.jobCount = jobMatches.length;
      
      if (analysis.features.jobCount > 10) {
        analysis.features.estimatedComplexity = 'high';
      } else if (analysis.features.jobCount > 5) {
        analysis.features.estimatedComplexity = 'medium';
      }
    }

    return analysis;
  }

  async validateFrameworkComponents() {
    console.log('\n🔧 Validating framework components...');
    
    const tests = [
      {
        name: 'ACT CLI Installation',
        test: () => this.checkActCLI(),
        critical: true
      },
      {
        name: 'Framework Files Present',
        test: () => this.checkFrameworkFiles(),
        critical: true
      },
      {
        name: 'Configuration Valid',
        test: () => this.checkConfiguration(),
        critical: false
      },
      {
        name: 'Results Directory Writable',
        test: () => this.checkResultsDirectory(),
        critical: false
      },
      {
        name: 'Workflow Discovery',
        test: () => this.testWorkflowDiscovery(),
        critical: true
      }
    ];

    for (const test of tests) {
      this.testResults.summary.frameworkTests++;
      
      try {
        const result = await test.test();
        this.testResults.frameworkValidation.push({
          name: test.name,
          status: 'passed',
          critical: test.critical,
          result: result
        });
        this.testResults.summary.passedFrameworkTests++;
        console.log(`  ✅ ${test.name}`);
      } catch (error) {
        this.testResults.frameworkValidation.push({
          name: test.name,
          status: 'failed',
          critical: test.critical,
          error: error.message
        });
        this.testResults.summary.failedFrameworkTests++;
        console.log(`  ${test.critical ? '❌' : '⚠️'} ${test.name}: ${error.message}`);
        
        if (test.critical) {
          throw new Error(`Critical test failed: ${test.name}`);
        }
      }
    }
  }

  checkActCLI() {
    try {
      const version = execSync('act --version', { encoding: 'utf8' });
      return `ACT CLI found: ${version.trim()}`;
    } catch (error) {
      throw new Error('ACT CLI not installed or not in PATH');
    }
  }

  checkFrameworkFiles() {
    const requiredFiles = [
      'tests/workflows/act-validation-framework.js',
      'tests/workflows/act-test-runner.sh',
      'tests/workflows/act-regression-suite.js',
      'config/act/act-testing-config.json'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    return `All ${requiredFiles.length} framework files present`;
  }

  checkConfiguration() {
    try {
      const configPath = 'config/act/act-testing-config.json';
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      const requiredKeys = ['framework', 'configuration', 'platforms', 'events', 'thresholds'];
      for (const key of requiredKeys) {
        if (!config[key]) {
          throw new Error(`Missing configuration section: ${key}`);
        }
      }
      
      return 'Configuration file valid';
    } catch (error) {
      throw new Error(`Configuration invalid: ${error.message}`);
    }
  }

  checkResultsDirectory() {
    try {
      const testFile = path.join(this.resultsDir, 'test-write.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return 'Results directory writable';
    } catch (error) {
      throw new Error('Results directory not writable');
    }
  }

  testWorkflowDiscovery() {
    const workflows = fs.readdirSync(this.workflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    if (workflows.length === 0) {
      throw new Error('No workflows found');
    }
    
    return `Discovered ${workflows.length} workflows`;
  }

  async generateReport() {
    console.log('\n📊 Generating validation report...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        framework: 'ACT Validation Framework',
        version: '1.0.0',
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
          actVersion: this.getActVersion()
        }
      },
      summary: this.testResults.summary,
      workflows: this.testResults.workflows,
      frameworkValidation: this.testResults.frameworkValidation,
      recommendations: this.generateRecommendations()
    };

    // Calculate compatibility rate
    const compatibilityRate = this.testResults.summary.totalWorkflows > 0 ? 
      Math.round((this.testResults.summary.compatibleWorkflows / this.testResults.summary.totalWorkflows) * 100) : 0;

    const frameworkPassRate = this.testResults.summary.frameworkTests > 0 ?
      Math.round((this.testResults.summary.passedFrameworkTests / this.testResults.summary.frameworkTests) * 100) : 0;

    // Save JSON report
    const reportFile = path.join(this.resultsDir, `act-validation-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport(report, compatibilityRate, frameworkPassRate);
    const markdownFile = path.join(this.resultsDir, 'act-validation-summary.md');
    fs.writeFileSync(markdownFile, markdownReport);

    console.log(`📄 JSON report saved: ${reportFile}`);
    console.log(`📝 Markdown summary saved: ${markdownFile}`);

    return report;
  }

  generateMarkdownReport(report, compatibilityRate, frameworkPassRate) {
    return `# ACT Workflow Validation Report

## Executive Summary

🎯 **Framework Status**: ${frameworkPassRate >= 80 ? '✅ OPERATIONAL' : '❌ ISSUES DETECTED'}  
🔧 **Workflow Compatibility**: ${compatibilityRate}%  
📊 **Framework Tests**: ${frameworkPassRate}% passed  

## Workflow Analysis

- **Total Workflows**: ${report.summary.totalWorkflows}
- **Analyzed**: ${report.summary.analyzedWorkflows}
- **ACT Compatible**: ${report.summary.compatibleWorkflows} ✅
- **Require Modifications**: ${report.summary.incompatibleWorkflows} ⚠️
- **Compatibility Rate**: ${compatibilityRate}%

## Framework Validation

| Test | Status | Critical |
|------|--------|----------|
${report.frameworkValidation.map(test => 
  `| ${test.name} | ${test.status === 'passed' ? '✅' : '❌'} ${test.status} | ${test.critical ? 'Yes' : 'No'} |`
).join('\n')}

## Workflow Details

${report.workflows.map(w => `### ${w.name}
- **Status**: ${w.actCompatible ? '✅ Compatible' : '⚠️ Needs modifications'}
- **Job Count**: ${w.features.jobCount}
- **Complexity**: ${w.features.estimatedComplexity}
- **Features**: Matrix: ${w.features.hasMatrix}, Services: ${w.features.hasServices}, Secrets: ${w.features.hasSecrets}
${w.issues.length > 0 ? `- **Issues**: ${w.issues.join(', ')}` : ''}
${w.recommendations.length > 0 ? `- **Recommendations**: ${w.recommendations.join(', ')}` : ''}
`).join('\n')}

## Recommendations

${report.recommendations.map(r => `- ${r}`).join('\n')}

## Environment

- **Platform**: ${report.metadata.environment.platform}
- **Node.js**: ${report.metadata.environment.nodeVersion}
- **ACT**: ${report.metadata.environment.actVersion}
- **Generated**: ${report.metadata.timestamp}

---
*Generated by ACT Validation Framework v1.0.0*`;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.summary.incompatibleWorkflows > 0) {
      recommendations.push(`Review ${this.testResults.summary.incompatibleWorkflows} workflows that require modifications for ACT compatibility`);
    }
    
    if (this.testResults.summary.compatibleWorkflows === this.testResults.summary.totalWorkflows) {
      recommendations.push('All workflows are ACT compatible - ready for local testing');
    }
    
    const highComplexityWorkflows = this.testResults.workflows.filter(w => w.features.estimatedComplexity === 'high');
    if (highComplexityWorkflows.length > 0) {
      recommendations.push(`Consider breaking down ${highComplexityWorkflows.length} high-complexity workflows for better maintainability`);
    }

    if (this.testResults.workflows.some(w => w.features.hasServices)) {
      recommendations.push('Set up Docker Compose configuration for workflows using service containers');
    }

    recommendations.push('Install Docker and run full ACT tests with: ./tests/workflows/act-test-runner.sh');
    recommendations.push('Set up automated regression testing in CI/CD pipeline');
    recommendations.push('Use performance benchmarking to optimize workflow execution time');

    return recommendations;
  }

  async storeInMemory() {
    console.log('\n💾 Storing validation results...');
    
    const memoryData = {
      validation_complete: true,
      timestamp: new Date().toISOString(),
      compatibility_rate: Math.round((this.testResults.summary.compatibleWorkflows / this.testResults.summary.totalWorkflows) * 100),
      framework_pass_rate: Math.round((this.testResults.summary.passedFrameworkTests / this.testResults.summary.frameworkTests) * 100),
      total_workflows: this.testResults.summary.totalWorkflows,
      compatible_workflows: this.testResults.summary.compatibleWorkflows,
      incompatible_workflows: this.testResults.summary.incompatibleWorkflows,
      framework_status: this.testResults.summary.failedFrameworkTests === 0 ? 'operational' : 'issues_detected',
      next_steps: [
        'Install Docker for full ACT testing',
        'Run comprehensive test suite',
        'Set up automated regression testing',
        'Review and fix workflow compatibility issues'
      ]
    };

    // Save memory data
    const memoryFile = path.join(this.resultsDir, 'memory-store-act-testing.json');
    fs.writeFileSync(memoryFile, JSON.stringify(memoryData, null, 2));
    
    console.log('✅ Validation results stored for memory system integration');
  }

  displaySummary() {
    console.log('\n🎉 ACT Validation Framework - Summary');
    console.log('=====================================');
    
    const compatibilityRate = Math.round((this.testResults.summary.compatibleWorkflows / this.testResults.summary.totalWorkflows) * 100);
    const frameworkPassRate = Math.round((this.testResults.summary.passedFrameworkTests / this.testResults.summary.frameworkTests) * 100);
    
    console.log(`\n📊 **Overall Results:**`);
    console.log(`   Framework Status: ${frameworkPassRate >= 80 ? '✅ OPERATIONAL' : '❌ ISSUES DETECTED'}`);
    console.log(`   Workflow Compatibility: ${compatibilityRate}%`);
    console.log(`   Framework Tests: ${this.testResults.summary.passedFrameworkTests}/${this.testResults.summary.frameworkTests} passed (${frameworkPassRate}%)`);
    
    console.log(`\n📋 **Workflow Analysis:**`);
    console.log(`   Total Workflows: ${this.testResults.summary.totalWorkflows}`);
    console.log(`   ACT Compatible: ${this.testResults.summary.compatibleWorkflows}`);
    console.log(`   Need Modifications: ${this.testResults.summary.incompatibleWorkflows}`);
    
    if (frameworkPassRate >= 80 && compatibilityRate >= 70) {
      console.log('\n✅ **SUCCESS**: Framework is operational and ready for workflow testing!');
      console.log('Next steps: Install Docker and run full ACT tests');
    } else {
      console.log('\n⚠️ **ACTION REQUIRED**: Address framework issues or workflow compatibility problems');
    }
    
    console.log('\n🚀 Ready for comprehensive ACT testing with Docker!');
  }

  getActVersion() {
    try {
      return execSync('act --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'not available';
    }
  }
}

// Run validation
const runner = new ActValidationRunner();
runner.run().catch(console.error);