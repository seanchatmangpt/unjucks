#!/usr/bin/env node

/**
 * End-to-End Test for Automated Issue Tracking System
 * Validates the complete issue tracking and management pipeline
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { FailureAnalyzer } from './analyze-failure.js';
import { PerformanceMetricsCollector } from './collect-performance-metrics.js';
import { SwarmCoordinationHooks } from './swarm-coordination-hooks.js';
import { NotificationSystem } from './notification-system.js';

class AutomationSystemTester {
  constructor(options = {}) {
    this.testMode = options.testMode || 'full';
    this.outputDir = options.outputDir || 'temp/automation-tests';
    this.verbose = options.verbose || false;
    this.results = {
      total_tests: 0,
      passed: 0,
      failed: 0,
      errors: [],
      test_details: []
    };
  }

  /**
   * Run complete end-to-end test suite
   */
  async runFullTestSuite() {
    console.log('🧪 Starting automated issue tracking system test suite...');
    
    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Run component tests
      await this.testFailureAnalyzer();
      await this.testPerformanceMetricsCollector();
      await this.testSwarmCoordinationHooks();
      await this.testNotificationSystem();
      
      // Run integration tests
      await this.testFullPipeline();
      
      // Run workflow validation tests
      await this.testWorkflowIntegration();
      
      // Generate test report
      await this.generateTestReport();
      
      console.log('✅ Test suite completed successfully');
      return this.results;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.recordError('test-suite', error);
      throw error;
    }
  }

  /**
   * Setup test environment and mock data
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Create test directories
      if (!existsSync(this.outputDir)) {
        mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Create mock test data
      await this.createMockData();
      
      // Initialize test configurations
      await this.initializeTestConfigs();
      
      this.recordTest('setup', true, 'Test environment setup completed');
      
    } catch (error) {
      this.recordTest('setup', false, `Setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test failure analyzer component
   */
  async testFailureAnalyzer() {
    console.log('🔍 Testing failure analyzer...');
    
    try {
      const analyzer = new FailureAnalyzer({
        workflowId: 'test-workflow-123',
        workflowName: 'Test CI Pipeline',
        runUrl: 'https://github.com/test/repo/actions/runs/123',
        headSha: 'abc123def456',
        conclusion: 'failure'
      });
      
      // Test analysis functionality
      const analysis = await analyzer.analyze();
      
      // Validate analysis results
      this.validateAnalysisResults(analysis);
      
      this.recordTest('failure-analyzer', true, 'Failure analyzer working correctly');
      
    } catch (error) {
      this.recordTest('failure-analyzer', false, `Failure analyzer test failed: ${error.message}`);
      this.recordError('failure-analyzer', error);
    }
  }

  /**
   * Test performance metrics collector
   */
  async testPerformanceMetricsCollector() {
    console.log('📊 Testing performance metrics collector...');
    
    try {
      const collector = new PerformanceMetricsCollector({
        workflowRunId: 'test-run-456',
        branch: 'main',
        commit: 'test-commit-789',
        metricsFile: `${this.outputDir}/test-performance-metrics.json`
      });
      
      // Test metrics collection
      const metrics = await collector.collect();
      
      // Validate metrics structure
      this.validateMetricsStructure(metrics);
      
      this.recordTest('performance-collector', true, 'Performance metrics collector working correctly');
      
    } catch (error) {
      this.recordTest('performance-collector', false, `Performance collector test failed: ${error.message}`);
      this.recordError('performance-collector', error);
    }
  }

  /**
   * Test swarm coordination hooks
   */
  async testSwarmCoordinationHooks() {
    console.log('🤖 Testing swarm coordination hooks...');
    
    try {
      const hooks = new SwarmCoordinationHooks({
        sessionId: 'test-session-123',
        taskType: 'test-coordination',
        memoryNamespace: 'test-automation'
      });
      
      // Test swarm initialization
      const swarmConfig = await hooks.initializeSwarm({
        topology: 'mesh',
        maxAgents: 3
      });
      
      // Test issue coordination
      const mockIssueData = {
        id: 'test-issue-123',
        type: 'ci-failure',
        severity: 'high'
      };
      
      const coordination = await hooks.coordinateIssueCreation(mockIssueData);
      
      // Validate coordination
      this.validateCoordinationResults(swarmConfig, coordination);
      
      this.recordTest('swarm-coordination', true, 'Swarm coordination hooks working correctly');
      
    } catch (error) {
      this.recordTest('swarm-coordination', false, `Swarm coordination test failed: ${error.message}`);
      this.recordError('swarm-coordination', error);
    }
  }

  /**
   * Test notification system
   */
  async testNotificationSystem() {
    console.log('📢 Testing notification system...');
    
    try {
      const notificationSystem = new NotificationSystem({
        configPath: `${this.outputDir}/test-notification-config.json`
      });
      
      // Test standard notification
      const mockIssueData = {
        id: 'test-issue-456',
        type: 'quality-gate-failure',
        severity: 'medium'
      };
      
      const notificationResult = await notificationSystem.sendNotification(mockIssueData, 'issue_created');
      
      // Test critical escalation
      const criticalIssueData = {
        id: 'test-critical-789',
        type: 'security-vulnerability',
        severity: 'critical'
      };
      
      const escalationResult = await notificationSystem.escalateCriticalIssue(criticalIssueData);
      
      // Validate notification results
      this.validateNotificationResults(notificationResult, escalationResult);
      
      this.recordTest('notification-system', true, 'Notification system working correctly');
      
    } catch (error) {
      this.recordTest('notification-system', false, `Notification system test failed: ${error.message}`);
      this.recordError('notification-system', error);
    }
  }

  /**
   * Test complete pipeline integration
   */
  async testFullPipeline() {
    console.log('🔄 Testing full pipeline integration...');
    
    try {
      // Simulate complete workflow failure scenario
      const pipelineTestData = {
        workflowFailure: {
          workflowId: 'pipeline-test-123',
          workflowName: 'Integration Test Pipeline',
          conclusion: 'failure',
          errorType: 'build-failure'
        },
        performanceData: {
          regression_detected: true,
          regression_type: 'build-duration',
          percentage_decrease: 25
        },
        securityData: {
          vulnerabilities_found: true,
          critical_count: 1,
          high_count: 2
        }
      };
      
      // Test pipeline execution
      const pipelineResults = await this.executePipelineTest(pipelineTestData);
      
      // Validate pipeline results
      this.validatePipelineResults(pipelineResults);
      
      this.recordTest('full-pipeline', true, 'Full pipeline integration working correctly');
      
    } catch (error) {
      this.recordTest('full-pipeline', false, `Full pipeline test failed: ${error.message}`);
      this.recordError('full-pipeline', error);
    }
  }

  /**
   * Test GitHub Actions workflow integration
   */
  async testWorkflowIntegration() {
    console.log('⚙️ Testing workflow integration...');
    
    try {
      // Validate workflow files exist and are properly structured
      const workflowPaths = [
        '.github/workflows/issue-automation/failure-tracking.yml',
        '.github/workflows/issue-automation/performance-regression.yml',
        '.github/workflows/issue-automation/security-vulnerability-tracking.yml',
        '.github/workflows/issue-automation/quality-gate-monitoring.yml',
        '.github/workflows/issue-automation/workflow-health-monitoring.yml'
      ];
      
      const workflowValidation = await this.validateWorkflowFiles(workflowPaths);
      
      // Test workflow syntax and structure
      const syntaxValidation = await this.validateWorkflowSyntax(workflowPaths);
      
      // Validate results
      this.validateWorkflowIntegration(workflowValidation, syntaxValidation);
      
      this.recordTest('workflow-integration', true, 'Workflow integration validation passed');
      
    } catch (error) {
      this.recordTest('workflow-integration', false, `Workflow integration test failed: ${error.message}`);
      this.recordError('workflow-integration', error);
    }
  }

  /**
   * Create mock data for testing
   */
  async createMockData() {
    const mockData = {
      failureLog: 'Error: Build failed\n    at buildStep (build.js:123)\n    Compilation error in src/main.js',
      performanceBaseline: {
        build_metrics: { duration: 30000 },
        test_metrics: { total_duration: 45000 },
        system_metrics: { memory_usage: 512 }
      },
      securityAudit: {
        vulnerabilities: [
          {
            cve: 'CVE-2023-1234',
            severity: 'high',
            package: 'test-package',
            description: 'Test vulnerability'
          }
        ]
      }
    };
    
    writeFileSync(`${this.outputDir}/mock-failure-log.txt`, mockData.failureLog);
    writeFileSync(`${this.outputDir}/mock-baseline.json`, JSON.stringify(mockData.performanceBaseline, null, 2));
    writeFileSync(`${this.outputDir}/mock-security.json`, JSON.stringify(mockData.securityAudit, null, 2));
  }

  /**
   * Initialize test configurations
   */
  async initializeTestConfigs() {
    const testConfigs = {
      notification: {
        channels: { github_issue: { enabled: true } },
        type_mapping: { 'ci-failure': { assignees: ['test-user'] } }
      },
      healthThresholds: {
        success_rate_threshold: 80,
        duration_threshold: 120,
        failure_pattern_threshold: 3
      }
    };
    
    writeFileSync(`${this.outputDir}/test-notification-config.json`, JSON.stringify(testConfigs.notification, null, 2));
    writeFileSync(`${this.outputDir}/test-health-thresholds.json`, JSON.stringify(testConfigs.healthThresholds, null, 2));
  }

  /**
   * Validate analysis results structure and content
   */
  validateAnalysisResults(analysis) {
    const requiredFields = ['id', 'workflow_name', 'error_type', 'issues', 'recommendations'];
    
    for (const field of requiredFields) {
      if (!analysis.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(analysis.issues)) {
      throw new Error('Issues field must be an array');
    }
    
    if (!Array.isArray(analysis.recommendations)) {
      throw new Error('Recommendations field must be an array');
    }
  }

  /**
   * Validate metrics structure
   */
  validateMetricsStructure(metrics) {
    const requiredSections = ['build_metrics', 'test_metrics', 'dependency_metrics', 'system_metrics'];
    
    for (const section of requiredSections) {
      if (!metrics.hasOwnProperty(section)) {
        throw new Error(`Missing metrics section: ${section}`);
      }
    }
    
    if (typeof metrics.timestamp !== 'string') {
      throw new Error('Timestamp must be a string');
    }
  }

  /**
   * Validate coordination results
   */
  validateCoordinationResults(swarmConfig, coordination) {
    if (!swarmConfig.session_id) {
      throw new Error('Swarm config missing session_id');
    }
    
    if (!coordination.issue_id) {
      throw new Error('Coordination missing issue_id');
    }
    
    if (!Array.isArray(coordination.assigned_agents)) {
      throw new Error('Assigned agents must be an array');
    }
  }

  /**
   * Validate notification results
   */
  validateNotificationResults(notificationResult, escalationResult) {
    if (typeof notificationResult.success !== 'boolean') {
      throw new Error('Notification result must have success boolean');
    }
    
    if (!escalationResult.issue_id) {
      throw new Error('Escalation result missing issue_id');
    }
  }

  /**
   * Execute pipeline test with mock data
   */
  async executePipelineTest(testData) {
    const results = {
      failure_analysis: null,
      performance_analysis: null,
      security_analysis: null,
      coordination: null,
      notifications: null
    };
    
    // Simulate pipeline steps
    try {
      // Step 1: Failure analysis
      const analyzer = new FailureAnalyzer(testData.workflowFailure);
      results.failure_analysis = await analyzer.analyze();
      
      // Step 2: Performance analysis
      const collector = new PerformanceMetricsCollector({
        workflowRunId: 'pipeline-test',
        metricsFile: `${this.outputDir}/pipeline-metrics.json`
      });
      results.performance_analysis = await collector.collect();
      
      // Step 3: Coordination
      const hooks = new SwarmCoordinationHooks({
        sessionId: 'pipeline-test-session'
      });
      results.coordination = await hooks.coordinateIssueCreation({
        id: 'pipeline-test-issue',
        type: 'ci-failure',
        severity: 'high'
      });
      
      // Step 4: Notifications
      const notificationSystem = new NotificationSystem();
      results.notifications = await notificationSystem.sendNotification({
        id: 'pipeline-test-issue',
        type: 'ci-failure',
        severity: 'high'
      });
      
      return results;
      
    } catch (error) {
      throw new Error(`Pipeline execution failed: ${error.message}`);
    }
  }

  /**
   * Validate pipeline results
   */
  validatePipelineResults(results) {
    const requiredComponents = ['failure_analysis', 'performance_analysis', 'coordination', 'notifications'];
    
    for (const component of requiredComponents) {
      if (!results[component]) {
        throw new Error(`Pipeline missing component: ${component}`);
      }
    }
  }

  /**
   * Validate workflow files exist and are readable
   */
  async validateWorkflowFiles(workflowPaths) {
    const validation = {
      files_exist: 0,
      files_missing: [],
      total_files: workflowPaths.length
    };
    
    for (const path of workflowPaths) {
      if (existsSync(path)) {
        validation.files_exist++;
      } else {
        validation.files_missing.push(path);
      }
    }
    
    return validation;
  }

  /**
   * Validate workflow syntax (basic YAML structure)
   */
  async validateWorkflowSyntax(workflowPaths) {
    const validation = {
      valid_syntax: 0,
      syntax_errors: [],
      total_files: workflowPaths.length
    };
    
    for (const path of workflowPaths) {
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, 'utf8');
          
          // Basic YAML structure validation
          if (content.includes('name:') && content.includes('on:') && content.includes('jobs:')) {
            validation.valid_syntax++;
          } else {
            validation.syntax_errors.push(`${path}: Missing required YAML structure`);
          }
        } catch (error) {
          validation.syntax_errors.push(`${path}: ${error.message}`);
        }
      }
    }
    
    return validation;
  }

  /**
   * Validate workflow integration results
   */
  validateWorkflowIntegration(workflowValidation, syntaxValidation) {
    if (workflowValidation.files_missing.length > 0) {
      throw new Error(`Missing workflow files: ${workflowValidation.files_missing.join(', ')}`);
    }
    
    if (syntaxValidation.syntax_errors.length > 0) {
      throw new Error(`Workflow syntax errors: ${syntaxValidation.syntax_errors.join('; ')}`);
    }
  }

  /**
   * Record test result
   */
  recordTest(testName, passed, details = '') {
    this.results.total_tests++;
    
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
    
    this.results.test_details.push({
      test: testName,
      passed: passed,
      details: details,
      timestamp: this.getDeterministicDate().toISOString()
    });
    
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
  }

  /**
   * Record error for debugging
   */
  recordError(component, error) {
    this.results.errors.push({
      component: component,
      error: error.message,
      stack: error.stack,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    console.log('📊 Generating test report...');
    
    const report = {
      test_summary: {
        total_tests: this.results.total_tests,
        passed: this.results.passed,
        failed: this.results.failed,
        success_rate: Math.round((this.results.passed / this.results.total_tests) * 100)
      },
      test_details: this.results.test_details,
      errors: this.results.errors,
      recommendations: this.generateRecommendations(),
      generated_at: this.getDeterministicDate().toISOString()
    };
    
    // Save JSON report
    writeFileSync(`${this.outputDir}/test-report.json`, JSON.stringify(report, null, 2));
    
    // Generate Markdown report
    const markdownReport = this.generateMarkdownReport(report);
    writeFileSync(`${this.outputDir}/test-report.md`, markdownReport);
    
    console.log(`📄 Test report generated: ${this.outputDir}/test-report.md`);
    
    // Log summary
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${report.test_summary.total_tests}`);
    console.log(`Passed: ${report.test_summary.passed}`);
    console.log(`Failed: ${report.test_summary.failed}`);
    console.log(`Success Rate: ${report.test_summary.success_rate}%`);
    
    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.failed > 0) {
      recommendations.push('Review failed tests and fix underlying issues');
      recommendations.push('Check error logs for detailed failure information');
    }
    
    if (this.results.errors.length > 0) {
      recommendations.push('Address component errors to improve system reliability');
    }
    
    if (this.results.passed === this.results.total_tests) {
      recommendations.push('All tests passed - system ready for production use');
      recommendations.push('Consider adding additional edge case tests');
    }
    
    return recommendations;
  }

  /**
   * Generate Markdown test report
   */
  generateMarkdownReport(report) {
    return `# Automated Issue Tracking System - Test Report

## Test Summary
- **Total Tests**: ${report.test_summary.total_tests}
- **Passed**: ${report.test_summary.passed}
- **Failed**: ${report.test_summary.failed}
- **Success Rate**: ${report.test_summary.success_rate}%
- **Generated**: ${report.generated_at}

## Test Results

${report.test_details.map(test => 
  `### ${test.test}
- **Status**: ${test.passed ? '✅ PASSED' : '❌ FAILED'}
- **Details**: ${test.details}
- **Timestamp**: ${test.timestamp}
`).join('\n')}

## Errors

${report.errors.length > 0 ? 
  report.errors.map(error => 
    `### ${error.component}
- **Error**: ${error.error}
- **Timestamp**: ${error.timestamp}
`).join('\n') : 
  '_No errors recorded_'
}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Report generated by automated issue tracking system test suite*`;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '').replace(/-/g, '_');
    const value = args[i + 1];
    options[key] = value;
  }
  
  const tester = new AutomationSystemTester(options);
  tester.runFullTestSuite().catch(console.error);
}

export { AutomationSystemTester };