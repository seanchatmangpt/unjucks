#!/usr/bin/env node

/**
 * ACT Error Simulation Suite
 * Comprehensive error and failure scenario testing for GitHub Actions workflows
 * 
 * Features:
 * - Invalid workflow syntax testing
 * - Missing dependency simulation
 * - Network timeout simulation
 * - Resource constraint testing
 * - Environment variable issues
 * - Secret handling errors
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ActErrorSimulationSuite {
  constructor(options = {}) {
    this.options = {
      workflowsDir: '.github/workflows',
      testWorkflowsDir: 'tests/workflows/test-cases',
      resultsDir: 'tests/workflows/results',
      tempDir: '.github/workflows/temp',
      scenarios: [
        'invalid_syntax',
        'missing_dependencies',
        'network_timeout',
        'resource_constraints',
        'env_var_issues',
        'secret_handling_errors',
        'service_failures',
        'action_not_found'
      ],
      ...options
    };

    this.errorResults = {
      summary: {
        totalScenarios: 0,
        executedScenarios: 0,
        detectedErrors: 0,
        unexpectedPasses: 0,
        validationErrors: 0
      },
      scenarios: [],
      recommendations: []
    };

    this.setupDirectories();
  }

  setupDirectories() {
    const dirs = [this.options.testWorkflowsDir, this.options.tempDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Run all error simulation scenarios
   */
  async runAllScenarios() {
    console.log('🔥 Starting ACT Error Simulation Suite...');
    console.log('========================================\n');

    this.errorResults.summary.totalScenarios = this.options.scenarios.length;

    for (const scenarioName of this.options.scenarios) {
      try {
        console.log(`🧪 Testing scenario: ${scenarioName.replace(/_/g, ' ').toUpperCase()}`);
        await this.runScenario(scenarioName);
        this.errorResults.summary.executedScenarios++;
      } catch (error) {
        console.error(`❌ Scenario ${scenarioName} failed to execute: ${error.message}`);
        this.errorResults.summary.validationErrors++;
      }
    }

    this.generateErrorReport();
    return this.errorResults;
  }

  /**
   * Run individual error scenario
   */
  async runScenario(scenarioName) {
    const scenario = {
      name: scenarioName,
      description: this.getScenarioDescription(scenarioName),
      timestamp: this.getDeterministicDate().toISOString(),
      status: 'unknown',
      expectedResult: 'failure',
      actualResult: 'unknown',
      errorDetected: false,
      executionTime: 0,
      errorMessages: [],
      recommendations: []
    };

    const startTime = this.getDeterministicTimestamp();

    try {
      // Create test workflow for scenario
      const testWorkflowPath = await this.createTestWorkflow(scenarioName);
      
      // Run ACT test
      const result = await this.runActTest(testWorkflowPath);
      
      // Analyze results
      scenario.actualResult = result.success ? 'success' : 'failure';
      scenario.errorDetected = !result.success;
      scenario.errorMessages = result.errors;
      scenario.executionTime = this.getDeterministicTimestamp() - startTime;

      // Validate scenario outcome
      if (scenario.expectedResult === 'failure' && scenario.actualResult === 'failure') {
        scenario.status = 'passed'; // Expected failure occurred
        this.errorResults.summary.detectedErrors++;
        console.log(`  ✅ Expected error correctly detected`);
      } else if (scenario.expectedResult === 'failure' && scenario.actualResult === 'success') {
        scenario.status = 'failed'; // Unexpected success
        this.errorResults.summary.unexpectedPasses++;
        console.log(`  ⚠️ Expected error was not detected - test may need improvement`);
      } else {
        scenario.status = 'passed';
        console.log(`  ✅ Scenario executed as expected`);
      }

      // Generate recommendations
      scenario.recommendations = this.generateScenarioRecommendations(scenarioName, scenario);

      // Cleanup
      await this.cleanupTestWorkflow(testWorkflowPath);

    } catch (error) {
      scenario.status = 'error';
      scenario.errorMessages.push(error.message);
      scenario.executionTime = this.getDeterministicTimestamp() - startTime;
      console.log(`  ❌ Scenario execution error: ${error.message}`);
    }

    this.errorResults.scenarios.push(scenario);
    return scenario;
  }

  /**
   * Create test workflow for specific error scenario
   */
  async createTestWorkflow(scenarioName) {
    const workflowContent = this.generateErrorWorkflowContent(scenarioName);
    const fileName = `error-test-${scenarioName}.yml`;
    const filePath = path.join(this.options.tempDir, fileName);
    
    fs.writeFileSync(filePath, workflowContent);
    return filePath;
  }

  /**
   * Generate workflow content for different error scenarios
   */
  generateErrorWorkflowContent(scenarioName) {
    const baseWorkflow = {
      name: `Error Test - ${scenarioName}`,
      on: 'push',
      jobs: {
        'error-test': {
          'runs-on': 'ubuntu-latest',
          steps: []
        }
      }
    };

    switch (scenarioName) {
      case 'invalid_syntax':
        return `name: Invalid Syntax Test
on: push
jobs:
  invalid-job:
    runs-on: ubuntu-latest
    steps:
      - name: Invalid step
        invalid_key: invalid_value
        uses: nonexistent/action@v1
        with:
          invalid_parameter: "value"
      - name: Another invalid step
        run: |
          echo "This step has invalid YAML"
        invalid_nested:
          key: value`;

      case 'missing_dependencies':
        return `name: Missing Dependencies Test
on: push
jobs:
  missing-deps:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js with non-existent version
        uses: actions/setup-node@v4
        with:
          node-version: '99.99.99'
      - name: Install non-existent package
        run: |
          npm install nonexistent-package-12345
          python -m pip install nonexistent-python-package-12345`;

      case 'network_timeout':
        return `name: Network Timeout Test
on: push
jobs:
  network-test:
    runs-on: ubuntu-latest
    timeout-minutes: 1
    steps:
      - name: Simulate network timeout
        run: |
          # Simulate slow network operation
          timeout 120 curl -m 90 http://httpbin.org/delay/120 || echo "Timeout as expected"
          # Try to download large file with timeout
          timeout 30 wget http://releases.ubuntu.com/20.04/ubuntu-20.04.6-desktop-amd64.iso || echo "Download timeout"`;

      case 'resource_constraints':
        return `name: Resource Constraints Test
on: push
jobs:
  resource-test:
    runs-on: ubuntu-latest
    steps:
      - name: Memory stress test
        run: |
          # Try to allocate excessive memory
          dd if=/dev/zero of=/tmp/largefile bs=1M count=10000 || echo "Memory allocation failed as expected"
      - name: CPU stress test
        run: |
          # CPU intensive operation with timeout
          timeout 30 yes > /dev/null || echo "CPU stress completed"`;

      case 'env_var_issues':
        return `name: Environment Variable Issues Test
on: push
env:
  UNDEFINED_VAR: ${{ env.NONEXISTENT_VAR }}
jobs:
  env-test:
    runs-on: ubuntu-latest
    steps:
      - name: Use undefined environment variable
        run: |
          echo "Trying to use undefined variable: $NONEXISTENT_VAR"
          echo "Value: ${{ env.UNDEFINED_VAR }}"
      - name: Reference circular environment variables
        env:
          CIRCULAR_A: ${{ env.CIRCULAR_B }}
          CIRCULAR_B: ${{ env.CIRCULAR_A }}
        run: |
          echo "Circular A: $CIRCULAR_A"
          echo "Circular B: $CIRCULAR_B"`;

      case 'secret_handling_errors':
        return `name: Secret Handling Errors Test
on: push
jobs:
  secret-test:
    runs-on: ubuntu-latest
    steps:
      - name: Use non-existent secret
        run: |
          echo "Non-existent secret: ${{ secrets.NONEXISTENT_SECRET }}"
      - name: Try to print secret (should be masked)
        run: |
          echo "This should be masked: ${{ secrets.GITHUB_TOKEN }}"
      - name: Use secret in wrong context
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.INVALID_SECRET_NAME }}`;

      case 'service_failures':
        return `name: Service Failures Test
on: push
jobs:
  service-test:
    runs-on: ubuntu-latest
    services:
      nonexistent-service:
        image: nonexistent/image:latest
        ports:
          - 5432:5432
      failing-postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: ""  # Invalid empty password
        ports:
          - 5433:5432
    steps:
      - name: Test service connection
        run: |
          # Try to connect to nonexistent service
          nc -z localhost 5432 || echo "Service connection failed as expected"
          # Try to connect to misconfigured service
          nc -z localhost 5433 || echo "Misconfigured service failed as expected"`;

      case 'action_not_found':
        return `name: Action Not Found Test
on: push
jobs:
  action-test:
    runs-on: ubuntu-latest
    steps:
      - name: Use non-existent action
        uses: nonexistent/action@v999
      - name: Use action with invalid version
        uses: actions/checkout@v999
      - name: Use malformed action reference
        uses: invalid-action-format
      - name: Use action with invalid parameters
        uses: actions/setup-node@v4
        with:
          invalid-parameter: value
          node-version: invalid-version`;

      default:
        return `name: Generic Error Test
on: push
jobs:
  generic-error:
    runs-on: ubuntu-latest
    steps:
      - name: Generic error step
        run: |
          echo "Generic error test"
          exit 1`;
    }
  }

  /**
   * Run ACT test on workflow file
   */
  async runActTest(workflowPath) {
    return new Promise((resolve) => {
      let output = '';
      let errors = [];

      const command = `act push --workflows "${workflowPath}" --dry-run --platform ubuntu-latest`;
      const child = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        const errorText = data.toString();
        output += errorText;
        
        if (errorText.includes('Error:') || errorText.includes('error:') || errorText.toLowerCase().includes('failed')) {
          errors.push(errorText.trim());
        }
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output,
          errors: errors,
          exitCode: code
        });
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          output: output,
          errors: ['Test timed out after 2 minutes'],
          exitCode: -1
        });
      }, 120000);
    });
  }

  /**
   * Generate recommendations for specific scenario
   */
  generateScenarioRecommendations(scenarioName, scenario) {
    const recommendations = [];

    switch (scenarioName) {
      case 'invalid_syntax':
        recommendations.push('Use YAML linting tools to catch syntax errors before running workflows');
        recommendations.push('Validate workflow files with: act --workflows workflow.yml --dry-run');
        break;
        
      case 'missing_dependencies':
        recommendations.push('Pin dependency versions to avoid compatibility issues');
        recommendations.push('Use dependency caching to improve reliability');
        recommendations.push('Implement retry logic for package installations');
        break;
        
      case 'network_timeout':
        recommendations.push('Set appropriate timeout values for network operations');
        recommendations.push('Implement retry logic for network-dependent steps');
        recommendations.push('Use local mirrors or caching for dependencies');
        break;
        
      case 'resource_constraints':
        recommendations.push('Monitor resource usage and set appropriate limits');
        recommendations.push('Use resource-efficient algorithms and operations');
        recommendations.push('Consider using larger runner instances for resource-intensive tasks');
        break;
        
      case 'env_var_issues':
        recommendations.push('Always define fallback values for environment variables');
        recommendations.push('Validate environment variables before use');
        recommendations.push('Use conditional logic to handle missing variables gracefully');
        break;
        
      case 'secret_handling_errors':
        recommendations.push('Ensure all required secrets are defined in repository settings');
        recommendations.push('Use conditional logic to handle missing secrets');
        recommendations.push('Never log or expose secret values in workflow output');
        break;
        
      case 'service_failures':
        recommendations.push('Implement health checks for service containers');
        recommendations.push('Use official, well-maintained container images');
        recommendations.push('Provide proper configuration for service containers');
        break;
        
      case 'action_not_found':
        recommendations.push('Pin action versions to specific commits or stable versions');
        recommendations.push('Validate action parameters against documentation');
        recommendations.push('Use marketplace actions with good maintenance records');
        break;
    }

    if (scenario.status === 'failed') {
      recommendations.push('Review test implementation - expected error was not detected');
    }

    return recommendations;
  }

  getScenarioDescription(scenarioName) {
    const descriptions = {
      invalid_syntax: 'Test workflow with invalid YAML syntax and malformed structure',
      missing_dependencies: 'Test workflow with non-existent dependencies and packages',
      network_timeout: 'Test workflow with network operations that timeout',
      resource_constraints: 'Test workflow under memory and CPU constraints',
      env_var_issues: 'Test workflow with undefined and circular environment variables',
      secret_handling_errors: 'Test workflow with missing and invalid secrets',
      service_failures: 'Test workflow with failing service containers',
      action_not_found: 'Test workflow with non-existent or invalid actions'
    };

    return descriptions[scenarioName] || 'Generic error scenario test';
  }

  /**
   * Cleanup test workflow file
   */
  async cleanupTestWorkflow(workflowPath) {
    try {
      if (fs.existsSync(workflowPath)) {
        fs.unlinkSync(workflowPath);
      }
    } catch (error) {
      console.warn(`Warning: Failed to cleanup test workflow ${workflowPath}: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive error simulation report
   */
  generateErrorReport() {
    console.log('\n📊 Generating error simulation report...');

    const report = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        framework: 'ACT Error Simulation Suite',
        version: '1.0.0',
        totalExecutionTime: this.errorResults.scenarios.reduce((sum, s) => sum + s.executionTime, 0)
      },
      summary: this.errorResults.summary,
      scenarios: this.errorResults.scenarios,
      overallRecommendations: this.generateOverallRecommendations()
    };

    // Calculate success rate
    const successRate = report.summary.executedScenarios > 0 ? 
      Math.round((report.summary.detectedErrors / report.summary.executedScenarios) * 100) : 0;

    // Save JSON report
    const reportFile = path.join(this.options.resultsDir, `error-simulation-report-${this.getDeterministicTimestamp()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownErrorReport(report, successRate);
    const markdownFile = path.join(this.options.resultsDir, 'error-simulation-report.md');
    fs.writeFileSync(markdownFile, markdownReport);

    console.log(`📄 Error simulation report saved: ${reportFile}`);
    console.log(`📝 Markdown report saved: ${markdownFile}`);
    console.log(`🎯 Error detection rate: ${successRate}%`);

    return report;
  }

  generateMarkdownErrorReport(report, successRate) {
    return `# ACT Error Simulation Report

## Executive Summary

🎯 **Error Detection Rate**: ${successRate}%  
🧪 **Scenarios Tested**: ${report.summary.executedScenarios}/${report.summary.totalScenarios}  
🔍 **Errors Detected**: ${report.summary.detectedErrors}  
⚠️ **Unexpected Passes**: ${report.summary.unexpectedPasses}  

## Test Results

| Scenario | Status | Expected | Actual | Time (ms) |
|----------|--------|----------|--------|-----------|
${report.scenarios.map(s => 
  `| ${s.name.replace(/_/g, ' ')} | ${s.status === 'passed' ? '✅' : '❌'} ${s.status} | ${s.expectedResult} | ${s.actualResult} | ${s.executionTime} |`
).join('\n')}

## Detailed Analysis

${report.scenarios.map(s => `### ${s.name.replace(/_/g, ' ').toUpperCase()}

**Description**: ${s.description}  
**Status**: ${s.status === 'passed' ? '✅' : '❌'} ${s.status}  
**Expected Result**: ${s.expectedResult}  
**Actual Result**: ${s.actualResult}  
**Error Detected**: ${s.errorDetected ? 'Yes' : 'No'}  
**Execution Time**: ${s.executionTime}ms  

${s.errorMessages.length > 0 ? `**Error Messages**:
${s.errorMessages.map(msg => `- ${msg}`).join('\n')}

` : ''}
**Recommendations**:
${s.recommendations.map(r => `- ${r}`).join('\n')}
`).join('\n')}

## Overall Recommendations

${report.overallRecommendations.map(r => `- ${r}`).join('\n')}

## Summary Statistics

- **Total Execution Time**: ${Math.round(report.metadata.totalExecutionTime / 1000)}s
- **Average Scenario Time**: ${Math.round(report.metadata.totalExecutionTime / Math.max(1, report.scenarios.length))}ms
- **Validation Errors**: ${report.summary.validationErrors}

---
*Generated on ${report.metadata.timestamp} by ACT Error Simulation Suite v1.0.0*`;
  }

  generateOverallRecommendations() {
    const recommendations = [];
    
    if (this.errorResults.summary.unexpectedPasses > 0) {
      recommendations.push('Review test scenarios that passed unexpectedly - they may need more robust error conditions');
    }
    
    if (this.errorResults.summary.detectedErrors === this.errorResults.summary.executedScenarios) {
      recommendations.push('Excellent! All error scenarios were properly detected by ACT');
    }
    
    if (this.errorResults.summary.validationErrors > 0) {
      recommendations.push('Fix validation errors in test execution framework');
    }

    recommendations.push('Implement error handling best practices based on simulation results');
    recommendations.push('Use these error patterns to create more robust workflows');
    recommendations.push('Consider implementing automated error detection in CI/CD pipeline');
    recommendations.push('Regularly update error simulation scenarios as new failure patterns emerge');

    return recommendations;
  }
}

module.exports = ActErrorSimulationSuite;

// CLI Usage
if (require.main === module) {
  const suite = new ActErrorSimulationSuite();
  
  (async () => {
    try {
      await suite.runAllScenarios();
      console.log('\n✅ Error simulation suite completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error simulation suite failed:', error.message);
      process.exit(1);
    }
  })();
}