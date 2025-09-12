#!/usr/bin/env node

/**
 * Test script for Intelligent Automation Engine
 * Validates the consolidated system with comprehensive testing scenarios
 */

import { IntelligentAutomationEngine } from './intelligent-automation-engine.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

class AutomationSystemValidator {
  constructor() {
    this.testResults = {
      total_tests: 0,
      passed: 0,
      failed: 0,
      test_details: []
    };
  }

  async runValidationSuite() {
    console.log('🧪 Starting Intelligent Automation System Validation...');
    
    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Test 1: Basic Orchestration
      await this.testBasicOrchestration();
      
      // Test 2: Workflow Failure Handling
      await this.testWorkflowFailureHandling();
      
      // Test 3: Intelligent Triage
      await this.testIntelligentTriage();
      
      // Test 4: Notification Routing
      await this.testNotificationRouting();
      
      // Test 5: Learning Feedback
      await this.testLearningFeedback();
      
      // Generate validation report
      await this.generateValidationReport();
      
      console.log('✅ Validation suite completed');
      return this.testResults;
      
    } catch (error) {
      console.error('❌ Validation suite failed:', error.message);
      this.recordTest('validation-suite', false, `Suite failed: ${error.message}`);
      return this.testResults;
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Create test directories
      const dirs = [
        'temp/automation/test',
        'temp/automation/sessions',
        'temp/automation/archives',
        'docs/automation/test'
      ];
      
      dirs.forEach(dir => {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      });
      
      this.recordTest('test-environment-setup', true, 'Test environment setup completed');
      
    } catch (error) {
      this.recordTest('test-environment-setup', false, `Setup failed: ${error.message}`);
      throw error;
    }
  }

  async testBasicOrchestration() {
    console.log('🎯 Testing basic orchestration...');
    
    try {
      const engine = new IntelligentAutomationEngine({
        sessionId: 'test-basic-orchestration',
        configPath: '.github/automation-config.json'
      });
      
      const testTrigger = {
        type: 'test_trigger',
        test_data: {
          scenario: 'basic_orchestration',
          expected_outcome: 'successful_processing'
        }
      };
      
      const result = await engine.orchestrate(testTrigger);
      
      if (result && result.final_status) {
        this.recordTest('basic-orchestration', true, `Orchestration completed with status: ${result.final_status}`);
      } else {
        this.recordTest('basic-orchestration', false, 'Orchestration returned invalid result');
      }
      
    } catch (error) {
      this.recordTest('basic-orchestration', false, `Orchestration failed: ${error.message}`);
    }
  }

  async testWorkflowFailureHandling() {
    console.log('🔍 Testing workflow failure handling...');
    
    try {
      const engine = new IntelligentAutomationEngine({
        sessionId: 'test-workflow-failure',
        configPath: '.github/automation-config.json'
      });
      
      const failureTrigger = {
        type: 'workflow_failure',
        workflow_run: {
          id: 'test-workflow-123',
          name: 'Test CI Pipeline',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          head_sha: 'abc123def456',
          head_branch: 'main',
          created_at: this.getDeterministicDate().toISOString()
        }
      };
      
      const result = await engine.orchestrate(failureTrigger);
      
      if (result && result.actions_executed && result.actions_executed.length > 0) {
        this.recordTest('workflow-failure-handling', true, `Processed workflow failure with ${result.actions_executed.length} actions`);
      } else {
        this.recordTest('workflow-failure-handling', false, 'Failed to process workflow failure correctly');
      }
      
    } catch (error) {
      this.recordTest('workflow-failure-handling', false, `Workflow failure handling failed: ${error.message}`);
    }
  }

  async testIntelligentTriage() {
    console.log('🎯 Testing intelligent triage...');
    
    try {
      const engine = new IntelligentAutomationEngine({
        sessionId: 'test-intelligent-triage',
        configPath: '.github/automation-config.json'
      });
      
      const testContexts = [
        {
          type: 'security_alert',
          security_data: { vulnerabilities: 3, critical_count: 1 }
        },
        {
          type: 'performance_regression',
          performance_data: { regression_percentage: 25, baseline_exceeded: true }
        },
        {
          type: 'quality_gate',
          quality_data: { coverage_drop: 15, test_failures: 8 }
        }
      ];
      
      let successfulTriage = 0;
      
      for (const context of testContexts) {
        try {
          const enrichedContext = await engine.unifiedIntakeProcessing(context);
          const triageResult = await engine.intelligentTriage(enrichedContext);
          
          if (triageResult && triageResult.classification && triageResult.priority_score > 0) {
            successfulTriage++;
          }
        } catch (triageError) {
          console.warn(`Triage failed for ${context.type}:`, triageError.message);
        }
      }
      
      if (successfulTriage === testContexts.length) {
        this.recordTest('intelligent-triage', true, `Successfully triaged ${successfulTriage}/${testContexts.length} test cases`);
      } else {
        this.recordTest('intelligent-triage', false, `Only triaged ${successfulTriage}/${testContexts.length} test cases`);
      }
      
    } catch (error) {
      this.recordTest('intelligent-triage', false, `Intelligent triage test failed: ${error.message}`);
    }
  }

  async testNotificationRouting() {
    console.log('📢 Testing notification routing...');
    
    try {
      const engine = new IntelligentAutomationEngine({
        sessionId: 'test-notification-routing',
        configPath: '.github/automation-config.json'
      });
      
      const mockActionPlan = {
        issue_id: 'test-notification-123',
        decision_tree: { issue_type: 'ci_failure' },
        resource_allocation: { priority_score: 0.7 }
      };
      
      const mockExecutionResult = {
        issue_id: 'test-notification-123',
        final_status: 'success',
        success_metrics: { overall_success: 0.85 }
      };
      
      await engine.sendIntelligentNotifications(mockActionPlan, mockExecutionResult);
      
      this.recordTest('notification-routing', true, 'Notification routing completed without errors');
      
    } catch (error) {
      this.recordTest('notification-routing', false, `Notification routing failed: ${error.message}`);
    }
  }

  async testLearningFeedback() {
    console.log('🧠 Testing learning feedback...');
    
    try {
      const engine = new IntelligentAutomationEngine({
        sessionId: 'test-learning-feedback',
        configPath: '.github/automation-config.json'
      });
      
      const mockExecutionResult = {
        issue_id: 'test-learning-123',
        started_at: this.getDeterministicDate().toISOString(),
        actions_executed: [
          { status: 'success', action: { type: 'create_issue' } },
          { status: 'success', action: { type: 'send_notification' } }
        ],
        final_status: 'success',
        success_metrics: { overall_success: 1.0, total_actions: 2 },
        completed_at: this.getDeterministicDate().toISOString()
      };
      
      await engine.learningFeedback(mockExecutionResult);
      
      this.recordTest('learning-feedback', true, 'Learning feedback processed successfully');
      
    } catch (error) {
      this.recordTest('learning-feedback', false, `Learning feedback failed: ${error.message}`);
    }
  }

  recordTest(testName, passed, details) {
    this.testResults.total_tests++;
    
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
    
    this.testResults.test_details.push({
      test: testName,
      passed: passed,
      details: details,
      timestamp: this.getDeterministicDate().toISOString()
    });
    
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
  }

  async generateValidationReport() {
    console.log('📊 Generating validation report...');
    
    const report = {
      validation_summary: {
        total_tests: this.testResults.total_tests,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        success_rate: Math.round((this.testResults.passed / this.testResults.total_tests) * 100)
      },
      test_details: this.testResults.test_details,
      system_validation: {
        basic_functionality: this.testResults.test_details.find(t => t.test === 'basic-orchestration')?.passed || false,
        failure_handling: this.testResults.test_details.find(t => t.test === 'workflow-failure-handling')?.passed || false,
        intelligent_triage: this.testResults.test_details.find(t => t.test === 'intelligent-triage')?.passed || false,
        notification_system: this.testResults.test_details.find(t => t.test === 'notification-routing')?.passed || false,
        learning_system: this.testResults.test_details.find(t => t.test === 'learning-feedback')?.passed || false
      },
      recommendations: this.generateRecommendations(),
      generated_at: this.getDeterministicDate().toISOString()
    };
    
    // Save JSON report
    writeFileSync('docs/automation/VALIDATION_REPORT.json', JSON.stringify(report, null, 2));
    
    // Generate Markdown report
    const markdownReport = this.generateMarkdownReport(report);
    writeFileSync('docs/automation/VALIDATION_REPORT.md', markdownReport);
    
    console.log('📄 Validation report generated: docs/automation/VALIDATION_REPORT.md');
    
    // Log summary
    console.log('\n📊 Validation Summary:');
    console.log(`Total Tests: ${report.validation_summary.total_tests}`);
    console.log(`Passed: ${report.validation_summary.passed}`);
    console.log(`Failed: ${report.validation_summary.failed}`);
    console.log(`Success Rate: ${report.validation_summary.success_rate}%`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.failed > 0) {
      recommendations.push('Review failed tests and address underlying issues');
    }
    
    if (this.testResults.passed === this.testResults.total_tests) {
      recommendations.push('All tests passed - system ready for production deployment');
    } else {
      recommendations.push('Some tests failed - requires investigation before deployment');
    }
    
    recommendations.push('Continue monitoring system performance in production');
    recommendations.push('Implement regular validation testing schedule');
    
    return recommendations;
  }

  generateMarkdownReport(report) {
    return `# Intelligent Automation System - Validation Report

## Validation Summary
- **Total Tests**: ${report.validation_summary.total_tests}
- **Passed**: ${report.validation_summary.passed}
- **Failed**: ${report.validation_summary.failed}
- **Success Rate**: ${report.validation_summary.success_rate}%
- **Generated**: ${report.generated_at}

## System Component Validation

| Component | Status | Details |
|-----------|--------|---------|
| Basic Orchestration | ${report.system_validation.basic_functionality ? '✅ PASSED' : '❌ FAILED'} | Core automation engine functionality |
| Failure Handling | ${report.system_validation.failure_handling ? '✅ PASSED' : '❌ FAILED'} | Workflow failure detection and processing |
| Intelligent Triage | ${report.system_validation.intelligent_triage ? '✅ PASSED' : '❌ FAILED'} | ML-based classification and prioritization |
| Notification System | ${report.system_validation.notification_system ? '✅ PASSED' : '❌ FAILED'} | Smart notification routing and delivery |
| Learning System | ${report.system_validation.learning_system ? '✅ PASSED' : '❌ FAILED'} | Feedback processing and continuous improvement |

## Detailed Test Results

${report.test_details.map(test => 
  `### ${test.test}
- **Status**: ${test.passed ? '✅ PASSED' : '❌ FAILED'}
- **Details**: ${test.details}
- **Timestamp**: ${test.timestamp}
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${report.validation_summary.success_rate === 100 
  ? '🚀 **System is ready for production deployment**\n\n- Monitor initial production performance\n- Collect real-world usage data\n- Continue iterative improvements'
  : '⚠️ **System requires additional work before deployment**\n\n- Address failed test cases\n- Re-run validation after fixes\n- Consider phased rollout approach'
}

---
*Generated by Intelligent Automation System Validator*`;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new AutomationSystemValidator();
  validator.runValidationSuite().catch(console.error);
}

export { AutomationSystemValidator };