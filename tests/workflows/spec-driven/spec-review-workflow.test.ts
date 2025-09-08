/**
 * Tests for Spec Review Workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecReviewWorkflow, type SpecReviewConfig, type ValidationRule } from '../../../src/workflows/spec-driven/spec-review-workflow';
import type { SpecificationDocument } from '../../../src/workflows/spec-driven/types';

describe('SpecReviewWorkflow', () => {
  let workflow: SpecReviewWorkflow;
  let config: SpecReviewConfig;
  let validSpec: SpecificationDocument;
  let invalidSpec: SpecificationDocument;

  beforeEach(() => {
    config = {
      id: 'test-spec-review',
      name: 'Test Spec Review',
      description: 'Test configuration for spec review',
      version: '1.0.0',
      timeout: 30000,
      retryCount: 2,
      parallel: false,
      dependencies: [],
      validationRules: SpecReviewWorkflow.getDefaultValidationRules(),
      approvalThreshold: 80,
      reviewerTypes: ['automated-reviewer'],
      automaticApproval: false
    };

    validSpec = {
      id: 'spec-001',
      title: 'User Authentication System',
      description: 'A comprehensive user authentication system with multi-factor authentication support',
      version: '1.0.0',
      author: 'Test Author',
      created: new Date('2024-01-01'),
      updated: new Date('2024-01-01'),
      status: 'draft',
      requirements: [
        {
          id: 'req-001',
          type: 'functional',
          priority: 'high',
          title: 'User Login',
          description: 'Users must be able to log in with email and password',
          testable: true,
          dependencies: []
        },
        {
          id: 'req-002',
          type: 'non-functional',
          priority: 'medium',
          title: 'Performance Requirements',
          description: 'System must handle 1000 concurrent users with response time under 200ms',
          testable: true,
          dependencies: []
        },
        {
          id: 'req-003',
          type: 'functional',
          priority: 'critical',
          title: 'Multi-Factor Authentication',
          description: 'System must support TOTP-based multi-factor authentication',
          testable: true,
          dependencies: ['req-001']
        }
      ],
      constraints: [
        {
          id: 'con-001',
          type: 'technical',
          description: 'Must use OAuth 2.0 for third-party integrations',
          impact: 'medium',
          mandatory: true
        }
      ],
      acceptanceCriteria: [
        {
          id: 'ac-001',
          requirementId: 'req-001',
          scenario: 'User login with valid credentials',
          given: 'A user with valid email and password',
          when: 'They attempt to log in',
          then: 'They should be authenticated and redirected to dashboard',
          testable: true
        },
        {
          id: 'ac-002',
          requirementId: 'req-002',
          scenario: 'Performance under load',
          given: '1000 concurrent users',
          when: 'They make simultaneous requests',
          then: 'Response time should be under 200ms',
          testable: true
        },
        {
          id: 'ac-003',
          requirementId: 'req-003',
          scenario: 'MFA setup and verification',
          given: 'A logged-in user',
          when: 'They enable MFA and provide TOTP code',
          then: 'MFA should be enabled and subsequent logins require TOTP',
          testable: true
        }
      ],
      metadata: {}
    };

    invalidSpec = {
      id: 'spec-002',
      title: '', // Missing title
      description: 'Incomplete specification for testing',
      version: '1.0.0',
      author: 'Test Author',
      created: new Date('2024-01-01'),
      updated: new Date('2024-01-01'),
      status: 'draft',
      requirements: [
        {
          id: 'req-001',
          type: 'functional',
          priority: 'high',
          title: 'Vague Requirement',
          description: 'System should work well', // Ambiguous language
          testable: false, // Not testable
          dependencies: []
        }
      ],
      constraints: [],
      acceptanceCriteria: [], // Missing acceptance criteria
      metadata: {}
    };

    workflow = new SpecReviewWorkflow(config);
  });

  describe('Valid Specification Review', () => {
    it('should successfully review a valid specification', async () => {
      const result = await workflow.execute(validSpec);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.specId).toBe(validSpec.id);
      expect(result.data!.approved).toBe(true);
      expect(result.data!.overallScore).toBeGreaterThanOrEqual(config.approvalThreshold);
    });

    it('should have no validation errors for valid spec', async () => {
      const result = await workflow.execute(validSpec);

      expect(result.success).toBe(true);
      const validationErrors = result.data!.validationResults.filter(r => !r.passed);
      expect(validationErrors).toHaveLength(0);
    });

    it('should provide minimal recommendations for valid spec', async () => {
      const result = await workflow.execute(validSpec);

      expect(result.success).toBe(true);
      expect(result.data!.recommendations).toHaveLength(0);
    });
  });

  describe('Invalid Specification Review', () => {
    it('should fail review for invalid specification', async () => {
      const result = await workflow.execute(invalidSpec);

      expect(result.success).toBe(true); // Workflow succeeds
      expect(result.data!.approved).toBe(false); // But spec is not approved
      expect(result.data!.overallScore).toBeLessThan(config.approvalThreshold);
    });

    it('should identify structural validation errors', async () => {
      const result = await workflow.execute(invalidSpec);

      expect(result.success).toBe(true);
      const structuralErrors = result.data!.validationResults.filter(r => !r.passed);
      expect(structuralErrors.length).toBeGreaterThan(0);
      
      const titleError = structuralErrors.find(e => e.message.includes('title'));
      expect(titleError).toBeDefined();
    });

    it('should provide recommendations for improvement', async () => {
      const result = await workflow.execute(invalidSpec);

      expect(result.success).toBe(true);
      expect(result.data!.recommendations.length).toBeGreaterThan(0);
      expect(result.data!.recommendations).toContain('Address all validation errors before resubmission');
    });

    it('should detect ambiguous language', async () => {
      const ambiguousSpec = {
        ...validSpec,
        description: 'System should maybe work well and might be fast',
        requirements: [
          {
            id: 'req-001',
            type: 'functional' as const,
            priority: 'medium' as const,
            title: 'Ambiguous Requirement',
            description: 'System could possibly handle requests',
            testable: true,
            dependencies: []
          }
        ]
      };

      const result = await workflow.execute(ambiguousSpec);
      
      expect(result.success).toBe(true);
      const semanticErrors = result.data!.validationResults.filter(r => 
        !r.passed && r.message.includes('Ambiguous language')
      );
      expect(semanticErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Checking', () => {
    it('should warn about missing security requirements', async () => {
      const noSecuritySpec = {
        ...validSpec,
        requirements: validSpec.requirements.filter(r => 
          !r.description.toLowerCase().includes('authentication')
        )
      };

      const result = await workflow.execute(noSecuritySpec);
      
      expect(result.success).toBe(true);
      const securityWarning = result.data!.validationResults.find(r => 
        r.message.includes('security requirements')
      );
      expect(securityWarning).toBeDefined();
    });

    it('should warn about missing performance requirements', async () => {
      const noPerformanceSpec = {
        ...validSpec,
        requirements: validSpec.requirements.filter(r => r.type !== 'non-functional')
      };

      const result = await workflow.execute(noPerformanceSpec);
      
      expect(result.success).toBe(true);
      const performanceWarning = result.data!.validationResults.find(r => 
        r.message.includes('performance requirements')
      );
      expect(performanceWarning).toBeDefined();
    });

    it('should warn about missing accessibility requirements', async () => {
      const result = await workflow.execute(validSpec);
      
      expect(result.success).toBe(true);
      const accessibilityWarning = result.data!.validationResults.find(r => 
        r.message.includes('accessibility requirements')
      );
      expect(accessibilityWarning).toBeDefined();
    });
  });

  describe('Quality Assessment', () => {
    it('should warn about too many high-priority requirements', async () => {
      const highPrioritySpec = {
        ...validSpec,
        requirements: Array(10).fill(0).map((_, index) => ({
          id: `req-${index + 1}`,
          type: 'functional' as const,
          priority: 'critical' as const,
          title: `Critical Requirement ${index + 1}`,
          description: `This is a critical requirement number ${index + 1}`,
          testable: true,
          dependencies: []
        }))
      };

      const result = await workflow.execute(highPrioritySpec);
      
      expect(result.success).toBe(true);
      const priorityWarning = result.data!.validationResults.find(r => 
        r.message.includes('high-priority requirements')
      );
      expect(priorityWarning).toBeDefined();
    });

    it('should detect high complexity requirements', async () => {
      const complexSpec = {
        ...validSpec,
        requirements: Array(5).fill(0).map((_, index) => ({
          id: `req-${index + 1}`,
          type: 'functional' as const,
          priority: 'medium' as const,
          title: `Complex Requirement ${index + 1}`,
          description: `This is a very complex and sophisticated requirement that is quite complicated and advanced`,
          testable: true,
          dependencies: []
        }))
      };

      const result = await workflow.execute(complexSpec);
      
      expect(result.success).toBe(true);
      const complexityWarning = result.data!.validationResults.find(r => 
        r.message.includes('complexity detected')
      );
      expect(complexityWarning).toBeDefined();
    });

    it('should warn about missing non-functional requirements', async () => {
      const functionalOnlySpec = {
        ...validSpec,
        requirements: validSpec.requirements.filter(r => r.type === 'functional')
      };

      const result = await workflow.execute(functionalOnlySpec);
      
      expect(result.success).toBe(true);
      const nfWarning = result.data!.validationResults.find(r => 
        r.message.includes('No non-functional requirements')
      );
      expect(nfWarning).toBeDefined();
    });
  });

  describe('Requirement Traceability', () => {
    it('should detect orphaned acceptance criteria', async () => {
      const orphanedCriteriaSpec = {
        ...validSpec,
        acceptanceCriteria: [
          ...validSpec.acceptanceCriteria,
          {
            id: 'ac-orphan',
            requirementId: 'req-nonexistent',
            scenario: 'Orphaned criterion',
            given: 'Some condition',
            when: 'Something happens',
            then: 'Something should occur',
            testable: true
          }
        ]
      };

      const result = await workflow.execute(orphanedCriteriaSpec);
      
      expect(result.success).toBe(true);
      const traceabilityError = result.data!.validationResults.find(r => 
        r.message.includes('references non-existent requirement')
      );
      expect(traceabilityError).toBeDefined();
    });

    it('should validate Given-When-Then format', async () => {
      const incompleteAcSpec = {
        ...validSpec,
        acceptanceCriteria: [
          {
            id: 'ac-incomplete',
            requirementId: 'req-001',
            scenario: 'Incomplete criterion',
            given: 'Some condition',
            when: '', // Missing when
            then: 'Something should occur',
            testable: true
          }
        ]
      };

      const result = await workflow.execute(incompleteAcSpec);
      
      expect(result.success).toBe(true);
      const formatError = result.data!.validationResults.find(r => 
        r.message.includes('is incomplete')
      );
      expect(formatError).toBeDefined();
    });
  });

  describe('Custom Validation Rules', () => {
    it('should allow custom validation rules', async () => {
      const customRule: ValidationRule = {
        id: 'custom-001',
        name: 'Custom Rule',
        description: 'Tests custom validation',
        type: 'semantic',
        severity: 'warning',
        rule: (spec) => ({
          passed: spec.title.includes('Authentication'),
          message: 'Title should include "Authentication"'
        })
      };

      const customConfig = {
        ...config,
        validationRules: [...config.validationRules, customRule]
      };

      const customWorkflow = new SpecReviewWorkflow(customConfig);
      const result = await customWorkflow.execute(validSpec);

      expect(result.success).toBe(true);
      expect(result.data!.validationResults.some(r => r.message.includes('Authentication'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle workflow execution errors gracefully', async () => {
      const malformedSpec = null as any;
      
      const result = await workflow.execute(malformedSpec);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('SPEC_REVIEW_FAILED');
    });

    it('should handle validation rule errors', async () => {
      const faultyRule: ValidationRule = {
        id: 'faulty-001',
        name: 'Faulty Rule',
        description: 'Rule that throws error',
        type: 'structural',
        severity: 'error',
        rule: () => {
          throw new Error('Validation rule error');
        }
      };

      const faultyConfig = {
        ...config,
        validationRules: [faultyRule]
      };

      const faultyWorkflow = new SpecReviewWorkflow(faultyConfig);
      const result = await faultyWorkflow.execute(validSpec);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Workflow State Management', () => {
    it('should track workflow state during execution', async () => {
      const promise = workflow.execute(validSpec);
      
      // Check initial state
      let state = workflow.getState();
      expect(state.status).toBe('in_progress');
      expect(state.currentStep).toBeDefined();
      expect(state.progress).toBeGreaterThan(0);

      const result = await promise;
      
      // Check final state
      state = workflow.getState();
      expect(state.status).toBe(result.success ? 'completed' : 'failed');
      expect(state.progress).toBe(100);
      expect(state.endTime).toBeDefined();
    });

    it('should provide meaningful progress updates', async () => {
      const progressUpdates: number[] = [];
      
      // Mock the updateState method to capture progress
      const originalUpdateState = (workflow as any).updateState;
      (workflow as any).updateState = function(status: any, step: any, progress: number) {
        progressUpdates.push(progress);
        return originalUpdateState.call(this, status, step, progress);
      };

      await workflow.execute(validSpec);
      
      expect(progressUpdates.length).toBeGreaterThan(1);
      expect(progressUpdates[0]).toBeLessThan(progressUpdates[progressUpdates.length - 1]);
    });
  });

  describe('Performance', () => {
    it('should complete review within reasonable time', async () => {
      const startTime = Date.now();
      const result = await workflow.execute(validSpec);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metrics?.duration).toBeDefined();
      expect(result.metrics!.duration).toBeLessThan(5000);
    });

    it('should handle large specifications efficiently', async () => {
      const largeSpec = {
        ...validSpec,
        requirements: Array(100).fill(0).map((_, index) => ({
          id: `req-${index + 1}`,
          type: 'functional' as const,
          priority: 'medium' as const,
          title: `Requirement ${index + 1}`,
          description: `This is requirement number ${index + 1} with detailed description`,
          testable: true,
          dependencies: []
        })),
        acceptanceCriteria: Array(100).fill(0).map((_, index) => ({
          id: `ac-${index + 1}`,
          requirementId: `req-${index + 1}`,
          scenario: `Scenario ${index + 1}`,
          given: `Given condition ${index + 1}`,
          when: `When action ${index + 1}`,
          then: `Then result ${index + 1}`,
          testable: true
        }))
      };

      const startTime = Date.now();
      const result = await workflow.execute(largeSpec);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should handle large spec within 10 seconds
    });
  });
});