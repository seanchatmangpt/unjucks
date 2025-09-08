import { describe, it, expect, beforeEach } from 'vitest';
import { SpecificationValidator } from '../../../../src/core/spec-validation/validators/specification.validator.js';
import type { ValidationContext, ValidationIssue } from '../../../../src/core/spec-validation/types/validation.types.js';

describe('SpecificationValidator', () => {
  let validator: SpecificationValidator;
  let mockContext: ValidationContext;

  beforeEach(() => {
    validator = new SpecificationValidator();
    mockContext = {
      specificationId: 'test-spec-001',
      validationId: 'validation-001',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      version: '1.0.0',
      environment: 'development',
      options: {},
    };
  });

  describe('validateFormat', () => {
    it('should pass validation for valid specification', async () => {
      const validSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Valid Specification',
          version: '1.0.0',
          description: 'This is a valid specification for testing purposes',
          author: {
            name: 'Test Author',
            email: 'test@example.com',
          },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'This specification serves as a test case for validation',
          scope: 'Covers basic API functionality and validation rules',
          stakeholders: [{
            role: 'Developer',
            name: 'John Doe',
            responsibilities: ['Implementation', 'Testing'],
          }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Basic Authentication',
          description: 'System must provide basic authentication functionality using username and password',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Authentication is required to secure user access to the system',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'User can login with valid username and password combination',
            testable: true,
          }],
        }],
      };

      const issues = await validator.validateFormat(validSpec, mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid version format', async () => {
      const invalidSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Invalid Spec',
          version: 'not-a-version',
          description: 'Specification with invalid version format',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Test specification with invalid version format',
          scope: 'Testing version validation functionality',
          stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Test Requirement',
          description: 'This is a test requirement with sufficient description',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Required for testing version validation',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'Test acceptance criterion for version validation',
          }],
        }],
      };

      const issues = await validator.validateFormat(invalidSpec, mockContext);
      expect(issues.length).toBeGreaterThan(0);
      
      const versionIssue = issues.find(issue => issue.message.includes('Invalid semantic version'));
      expect(versionIssue).toBeDefined();
      expect(versionIssue?.severity).toBe('error');
    });

    it('should detect missing required fields', async () => {
      const incompleteSpec = {
        metadata: {
          id: 'spec-001',
          name: '', // Invalid empty name
          version: '1.0.0',
          description: 'Short', // Too short
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Short', // Too short
          scope: 'Short', // Too short
          stakeholders: [], // Empty array
        },
        requirements: [], // Empty array
      };

      const issues = await validator.validateFormat(incompleteSpec, mockContext);
      expect(issues.length).toBeGreaterThan(0);

      // Should have issues for empty name, short description, short purpose, etc.
      const errorIssues = issues.filter(issue => issue.severity === 'error');
      expect(errorIssues.length).toBeGreaterThan(3);
    });

    it('should handle malformed input gracefully', async () => {
      const malformedInput = 'not-an-object';

      const issues = await validator.validateFormat(malformedInput, mockContext);
      expect(issues.length).toBeGreaterThan(0);
      
      const parsingIssue = issues.find(issue => issue.ruleId === 'schema-parsing');
      expect(parsingIssue).toBeDefined();
      expect(parsingIssue?.severity).toBe('error');
    });
  });

  describe('validateCompleteness', () => {
    let validSpec: any;

    beforeEach(() => {
      validSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Test Specification',
          version: '1.0.0',
          description: 'This is a test specification for completeness validation',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Test specification for validating completeness checking functionality',
          scope: 'Covers completeness validation rules and edge cases testing',
          stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Test Requirement',
          description: 'This is a test requirement for completeness validation testing',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Required to test completeness validation functionality',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'Test acceptance criterion for completeness validation',
          }],
        }],
      };
    });

    it('should pass for complete specification', async () => {
      const issues = await validator.validateCompleteness(validSpec, mockContext);
      const errorIssues = issues.filter(issue => issue.severity === 'error');
      expect(errorIssues).toHaveLength(0);
    });

    it('should detect duplicate requirement IDs', async () => {
      const specWithDuplicates = {
        ...validSpec,
        requirements: [
          validSpec.requirements[0],
          {
            ...validSpec.requirements[0],
            title: 'Duplicate Requirement',
            description: 'This requirement has the same ID as another requirement in the specification',
          },
        ],
      };

      const issues = await validator.validateCompleteness(specWithDuplicates, mockContext);
      
      const duplicateIssue = issues.find(issue => issue.ruleId === 'requirement-uniqueness');
      expect(duplicateIssue).toBeDefined();
      expect(duplicateIssue?.severity).toBe('error');
      expect(duplicateIssue?.message).toContain('Duplicate requirement ID');
    });

    it('should detect orphaned requirement dependencies', async () => {
      const specWithOrphanedDep = {
        ...validSpec,
        requirements: [{
          ...validSpec.requirements[0],
          dependencies: ['NON-EXISTENT-REQ'],
        }],
      };

      const issues = await validator.validateCompleteness(specWithOrphanedDep, mockContext);
      
      const orphanedIssue = issues.find(issue => issue.ruleId === 'requirement-dependency');
      expect(orphanedIssue).toBeDefined();
      expect(orphanedIssue?.severity).toBe('warning');
      expect(orphanedIssue?.message).toContain('depends on non-existent requirement');
    });

    it('should detect missing acceptance criteria', async () => {
      const specWithoutCriteria = {
        ...validSpec,
        requirements: [{
          ...validSpec.requirements[0],
          acceptanceCriteria: [],
        }],
      };

      const issues = await validator.validateCompleteness(specWithoutCriteria, mockContext);
      
      const criteriaIssue = issues.find(issue => issue.ruleId === 'requirement-acceptance-criteria');
      expect(criteriaIssue).toBeDefined();
      expect(criteriaIssue?.severity).toBe('warning');
      expect(criteriaIssue?.message).toContain('has no acceptance criteria');
    });

    it('should validate architecture section when present', async () => {
      const specWithArchitecture = {
        ...validSpec,
        architecture: {
          overview: 'This is a comprehensive architecture overview that describes system components and their interactions',
          components: [
            {
              id: 'comp-1',
              name: 'Component 1',
              type: 'service' as const,
              description: 'First component',
              responsibilities: ['Task 1'],
              dependencies: ['non-existent-comp'],
            },
          ],
          dataFlow: [{
            from: 'comp-1',
            to: 'missing-comp',
            description: 'Data flow to missing component',
          }],
        },
      };

      const issues = await validator.validateCompleteness(specWithArchitecture, mockContext);
      
      const archIssues = issues.filter(issue => issue.ruleId === 'architecture-dependency' || issue.ruleId === 'architecture-dataflow');
      expect(archIssues.length).toBeGreaterThan(0);
    });

    it('should validate implementation section when present', async () => {
      const specWithImplementation = {
        ...validSpec,
        implementation: {
          technology: {
            language: 'TypeScript',
            framework: 'Express.js',
          },
          structure: {
            directories: [],
            files: [{
              path: 'src/index.ts',
              type: 'source' as const,
              description: 'Main entry point',
            }],
          },
        },
      };

      const issues = await validator.validateCompleteness(specWithImplementation, mockContext);
      
      const buildIssue = issues.find(issue => issue.ruleId === 'implementation-build-process');
      expect(buildIssue).toBeDefined();
      expect(buildIssue?.severity).toBe('warning');
    });

    it('should validate testing section when present', async () => {
      const specWithTesting = {
        ...validSpec,
        testing: {
          strategy: 'Comprehensive testing strategy with multiple test levels and automation',
          levels: [{
            type: 'integration' as const,
            description: 'Integration testing only',
          }],
          automation: {
            cicd: true,
            triggers: [],
            reporting: true,
          },
        },
      };

      const issues = await validator.validateCompleteness(specWithTesting, mockContext);
      
      const testingIssues = issues.filter(issue => 
        issue.ruleId === 'testing-coverage-levels' || issue.ruleId === 'testing-automation'
      );
      expect(testingIssues.length).toBeGreaterThan(0);
    });

    it('should check cross-section consistency', async () => {
      const specWithInconsistency = {
        ...validSpec,
        requirements: Array.from({ length: 15 }, (_, i) => ({
          id: `REQ-${String(i + 1).padStart(3, '0')}`,
          title: `Functional Requirement ${i + 1}`,
          description: `This is functional requirement number ${i + 1} for testing consistency validation`,
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: `Rationale for requirement ${i + 1} to ensure proper validation testing`,
          acceptanceCriteria: [{
            id: `AC-${String(i + 1).padStart(3, '0')}`,
            description: `Acceptance criterion for requirement ${i + 1} validation testing`,
          }],
        })),
        architecture: {
          overview: 'Simple architecture with minimal components compared to the large number of functional requirements',
          components: [{
            id: 'single-comp',
            name: 'Single Component',
            type: 'service' as const,
            description: 'Only one component for many requirements',
            responsibilities: ['Everything'],
          }],
        },
      };

      const issues = await validator.validateCompleteness(specWithInconsistency, mockContext);
      
      const consistencyIssue = issues.find(issue => issue.ruleId === 'cross-section-consistency');
      expect(consistencyIssue).toBeDefined();
      expect(consistencyIssue?.severity).toBe('info');
    });
  });

  describe('generateMetrics', () => {
    it('should generate accurate metrics', () => {
      const mockIssues: ValidationIssue[] = [
        {
          id: '1',
          ruleId: 'rule-1',
          severity: 'error',
          message: 'Error 1',
          path: 'path1',
          autoFixable: false,
          metadata: {},
        },
        {
          id: '2',
          ruleId: 'rule-2',
          severity: 'warning',
          message: 'Warning 1',
          path: 'path2',
          autoFixable: false,
          metadata: {},
        },
        {
          id: '3',
          ruleId: 'rule-1',
          severity: 'error',
          message: 'Error 2',
          path: 'path3',
          autoFixable: false,
          metadata: {},
        },
      ];

      const executionTime = 1500;
      const metrics = validator.generateMetrics(mockIssues, executionTime);

      expect(metrics.executionTime).toBe(1500);
      expect(metrics.rulesExecuted).toBe(2); // rule-1 and rule-2
      expect(metrics.rulesFailed).toBe(1); // Only rule-1 has errors
      expect(metrics.rulesPassed).toBe(1); // rule-2 has no errors
    });

    it('should calculate complexity correctly', () => {
      const validSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Complex Specification',
          version: '1.0.0',
          description: 'A complex specification for testing complexity calculation',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'system' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Test specification for complexity calculation validation',
          scope: 'Covers complexity metrics and calculation accuracy testing',
          stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
        },
        requirements: Array.from({ length: 12 }, (_, i) => ({
          id: `REQ-${String(i + 1).padStart(3, '0')}`,
          title: `Requirement ${i + 1}`,
          description: `This is requirement number ${i + 1} for complexity testing purposes`,
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: `Rationale for requirement ${i + 1} to test complexity calculations`,
          acceptanceCriteria: [{
            id: `AC-${String(i + 1).padStart(3, '0')}`,
            description: `Acceptance criterion for requirement ${i + 1} testing`,
          }],
          dependencies: i > 0 ? [`REQ-${String(i).padStart(3, '0')}`] : [],
        })),
        architecture: {
          overview: 'Complex architecture with many components to test complexity calculation',
          components: Array.from({ length: 6 }, (_, i) => ({
            id: `comp-${i + 1}`,
            name: `Component ${i + 1}`,
            type: 'service' as const,
            description: `Component ${i + 1} for complexity testing`,
            responsibilities: [`Task ${i + 1}`],
          })),
        },
      };

      const metrics = validator.generateMetrics([], 1000, validSpec);
      
      expect(metrics.complexity.score).toBeGreaterThan(1);
      expect(metrics.complexity.factors).toContain('High number of requirements');
      expect(metrics.complexity.factors).toContain('Complex architecture');
      expect(metrics.complexity.factors).toContain('High dependency coupling');
    });

    it('should calculate coverage correctly', () => {
      const specWithAllSections = {
        metadata: {
          id: 'spec-001',
          name: 'Complete Specification',
          version: '1.0.0',
          description: 'A complete specification with all sections for coverage testing',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'approved' as const,
        },
        summary: {
          purpose: 'Complete specification for testing coverage calculation accuracy',
          scope: 'Covers all sections and components for comprehensive coverage testing',
          stakeholders: [{ role: 'Developer', responsibilities: ['Implementation'] }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Complete Requirement',
          description: 'A complete requirement for coverage testing purposes',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Required for testing coverage calculation functionality',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'Complete acceptance criterion for coverage testing',
          }],
        }],
        architecture: {
          overview: 'Complete architecture section for testing coverage calculation',
          components: [{
            id: 'comp-1',
            name: 'Complete Component',
            type: 'service' as const,
            description: 'Complete component for coverage testing',
            responsibilities: ['Complete responsibility'],
          }],
        },
        implementation: {
          technology: {
            language: 'TypeScript',
          },
          structure: {
            directories: [],
            files: [],
          },
        },
        testing: {
          strategy: 'Complete testing strategy for coverage calculation',
          levels: [{
            type: 'unit' as const,
            description: 'Complete unit testing level',
          }],
          automation: {
            cicd: true,
            reporting: true,
          },
        },
        documentation: {
          userGuide: true,
          apiDocs: true,
        },
      };

      const metrics = validator.generateMetrics([], 1000, specWithAllSections);
      
      expect(metrics.coverage.requirements).toBe(100);
      expect(metrics.coverage.architecture).toBe(100);
      expect(metrics.coverage.implementation).toBe(100);
      expect(metrics.coverage.testing).toBe(100);
      expect(metrics.coverage.documentation).toBe(75); // Based on documentation flags
    });
  });
});