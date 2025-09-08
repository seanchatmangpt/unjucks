import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SpecificationValidationPipeline,
  specValidation
} from '../../../src/core/spec-validation/index.js';
import type { ValidationOptions } from '../../../src/core/spec-validation/types/validation.types.js';

describe('SpecificationValidationPipeline Integration', () => {
  let pipeline: SpecificationValidationPipeline;

  beforeEach(() => {
    pipeline = new SpecificationValidationPipeline();
  });

  describe('End-to-End Validation', () => {
    it('should validate a complete, valid specification successfully', async () => {
      const validSpecification = {
        metadata: {
          id: 'spec-001',
          name: 'E-Commerce User Management API',
          version: '1.2.0',
          description: 'Comprehensive API specification for user management in e-commerce platform',
          author: {
            name: 'API Team',
            email: 'api-team@example.com',
            organization: 'E-Commerce Corp',
          },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-15T10:30:00Z',
          tags: ['api', 'user-management', 'e-commerce'],
          category: 'api' as const,
          status: 'approved' as const,
          priority: 'high' as const,
        },
        summary: {
          purpose: 'This API specification defines endpoints and business logic for comprehensive user management including registration, authentication, profile management, and account lifecycle operations',
          scope: 'Covers all user-related operations including CRUD operations, authentication flows, password management, profile updates, account deactivation, and integration with external identity providers',
          stakeholders: [
            {
              role: 'Product Owner',
              name: 'Sarah Johnson',
              responsibilities: ['Requirements definition', 'Business logic validation', 'Acceptance criteria approval'],
            },
            {
              role: 'Lead Developer',
              name: 'Mike Chen',
              responsibilities: ['Technical implementation', 'Architecture decisions', 'Code review'],
            },
            {
              role: 'Security Officer',
              name: 'Alex Rodriguez',
              responsibilities: ['Security compliance', 'Vulnerability assessment', 'Access control review'],
            },
          ],
          assumptions: [
            'Users have valid email addresses for account creation',
            'External identity providers support OAuth 2.0',
            'Database supports ACID transactions',
          ],
          constraints: [
            'Must comply with GDPR for EU users',
            'Response time must be under 200ms for 95% of requests',
            'System must support 10,000 concurrent users',
          ],
        },
        requirements: [
          {
            id: 'REQ-001',
            title: 'User Registration',
            description: 'System must allow new users to create accounts with email address, password, and basic profile information. Registration process must include email verification and terms of service acceptance.',
            type: 'functional' as const,
            priority: 'must-have' as const,
            source: 'Business Requirements Document v1.2',
            rationale: 'User registration is fundamental for account-based e-commerce operations and provides foundation for personalized shopping experiences',
            acceptanceCriteria: [
              {
                id: 'AC-001-1',
                description: 'User can register with valid email, password meeting security criteria, and required profile fields',
                testable: true,
              },
              {
                id: 'AC-001-2',
                description: 'System sends verification email upon registration and activates account when verified',
                testable: true,
              },
              {
                id: 'AC-001-3',
                description: 'User must accept current terms of service before account creation',
                testable: true,
              },
            ],
            dependencies: ['REQ-002'],
            risks: [
              {
                description: 'Spam registrations could overwhelm email verification system',
                impact: 'medium' as const,
                probability: 'medium' as const,
                mitigation: 'Implement CAPTCHA and rate limiting on registration endpoint',
              },
            ],
            estimatedEffort: {
              value: 5,
              unit: 'days' as const,
            },
          },
          {
            id: 'REQ-002',
            title: 'Email Verification System',
            description: 'System must provide secure email verification mechanism using time-limited tokens to verify email addresses during registration and email change processes.',
            type: 'technical' as const,
            priority: 'must-have' as const,
            rationale: 'Email verification ensures valid contact information and prevents account creation with fake or inaccessible email addresses',
            acceptanceCriteria: [
              {
                id: 'AC-002-1',
                description: 'System generates secure, time-limited verification tokens with 24-hour expiration',
                testable: true,
              },
              {
                id: 'AC-002-2',
                description: 'Verification emails contain branded templates with clear call-to-action',
                testable: true,
              },
            ],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-003',
            title: 'User Authentication',
            description: 'System must authenticate users using email/password credentials with support for multi-factor authentication and session management including secure logout functionality.',
            type: 'security' as const,
            priority: 'must-have' as const,
            rationale: 'Secure authentication protects user accounts and personal data while enabling personalized experiences',
            acceptanceCriteria: [
              {
                id: 'AC-003-1',
                description: 'Users can login with valid email/password combination',
                testable: true,
              },
              {
                id: 'AC-003-2',
                description: 'System supports optional two-factor authentication via SMS or authenticator app',
                testable: true,
              },
              {
                id: 'AC-003-3',
                description: 'Sessions expire after 24 hours of inactivity and can be manually terminated',
                testable: true,
              },
            ],
            dependencies: ['REQ-001'],
            risks: [
              {
                description: 'Brute force attacks on login endpoint could compromise accounts',
                impact: 'high' as const,
                probability: 'medium' as const,
                mitigation: 'Implement progressive delays, account lockout, and CAPTCHA after failed attempts',
              },
            ],
          },
        ],
        architecture: {
          overview: 'The user management API follows a layered architecture pattern with clear separation between presentation, business logic, and data persistence layers. The system uses RESTful API design principles with JWT-based authentication and employs microservices architecture for scalability. Database operations are handled through an ORM with connection pooling, and all external communications use TLS encryption.',
          patterns: [
            {
              name: 'Repository Pattern',
              type: 'design' as const,
              description: 'Abstracts data access logic and provides consistent interface for data operations',
              rationale: 'Enables easy testing and database technology independence',
            },
            {
              name: 'JWT Authentication',
              type: 'security' as const,
              description: 'Stateless authentication using JSON Web Tokens',
              rationale: 'Provides scalable authentication without server-side session storage',
            },
          ],
          components: [
            {
              id: 'auth-service',
              name: 'Authentication Service',
              type: 'service' as const,
              description: 'Handles user authentication, token generation, and session management',
              responsibilities: [
                'User credential validation',
                'JWT token generation and validation',
                'Session lifecycle management',
                'Multi-factor authentication coordination',
              ],
              interfaces: [
                {
                  name: 'AuthenticationAPI',
                  type: 'api' as const,
                  description: 'REST endpoints for login, logout, and token refresh',
                },
              ],
              dependencies: ['user-repository', 'email-service'],
            },
            {
              id: 'user-repository',
              name: 'User Repository',
              type: 'module' as const,
              description: 'Data access layer for user information',
              responsibilities: [
                'User CRUD operations',
                'Query optimization',
                'Data validation',
              ],
              interfaces: [
                {
                  name: 'UserDataInterface',
                  type: 'data' as const,
                  description: 'Interface for user data operations',
                },
              ],
              dependencies: ['database'],
            },
            {
              id: 'email-service',
              name: 'Email Service',
              type: 'service' as const,
              description: 'Handles email communications including verification and notifications',
              responsibilities: [
                'Email template rendering',
                'SMTP communication',
                'Delivery status tracking',
              ],
              interfaces: [],
              dependencies: [],
            },
          ],
          dataFlow: [
            {
              from: 'auth-service',
              to: 'user-repository',
              description: 'Authentication service queries user data for credential validation',
              protocol: 'Internal API call',
            },
            {
              from: 'auth-service',
              to: 'email-service',
              description: 'Triggers verification email sending upon registration',
              protocol: 'Message queue',
            },
          ],
          constraints: [
            {
              type: 'performance' as const,
              description: 'API response time must be under 200ms for 95th percentile',
              impact: 'Affects user experience and conversion rates',
            },
            {
              type: 'security' as const,
              description: 'All data in transit must be encrypted using TLS 1.3',
              impact: 'Ensures data protection and compliance requirements',
            },
          ],
        },
        implementation: {
          technology: {
            language: 'TypeScript',
            framework: 'Express.js',
            libraries: ['zod', 'prisma', 'jsonwebtoken', 'bcrypt'],
            tools: ['jest', 'eslint', 'prettier', 'docker'],
            platform: 'Node.js',
          },
          structure: {
            directories: [
              {
                path: 'src/',
                purpose: 'Source code including controllers, services, and models',
              },
              {
                path: 'src/controllers/',
                purpose: 'HTTP request handlers and response formatting',
              },
              {
                path: 'src/services/',
                purpose: 'Business logic and external service integrations',
              },
              {
                path: 'src/models/',
                purpose: 'Data models and validation schemas',
              },
              {
                path: 'tests/',
                purpose: 'Test files including unit, integration, and e2e tests',
              },
            ],
            files: [
              {
                path: 'src/index.ts',
                type: 'source' as const,
                description: 'Application entry point and server setup',
              },
              {
                path: 'src/controllers/auth.controller.ts',
                type: 'source' as const,
                description: 'Authentication endpoint handlers',
              },
              {
                path: 'src/services/user.service.ts',
                type: 'source' as const,
                description: 'User business logic implementation',
              },
              {
                path: 'tests/auth.test.ts',
                type: 'test' as const,
                description: 'Authentication functionality tests',
              },
            ],
          },
          buildProcess: {
            steps: [
              'Install dependencies using npm ci',
              'Run TypeScript compilation',
              'Execute linting and formatting checks',
              'Run unit and integration tests',
              'Build Docker image',
            ],
            dependencies: ['node:18', 'npm', 'docker'],
            artifacts: ['dist/', 'docker-image'],
          },
          deployment: {
            environment: 'production' as const,
            strategy: 'Blue-green deployment with health checks',
            requirements: [
              'Kubernetes cluster with ingress controller',
              'PostgreSQL database with connection pooling',
              'Redis for session storage',
              'Load balancer with SSL termination',
            ],
          },
        },
        testing: {
          strategy: 'Comprehensive testing strategy incorporating unit tests for individual functions, integration tests for API endpoints, contract testing for external dependencies, and end-to-end tests for complete user workflows. All tests run in CI/CD pipeline with coverage reporting and quality gates.',
          levels: [
            {
              type: 'unit' as const,
              description: 'Unit tests for individual functions and modules with 90% coverage target',
              tools: ['jest', 'supertest'],
              coverage: {
                target: 90,
                metric: 'line' as const,
              },
            },
            {
              type: 'integration' as const,
              description: 'API endpoint testing with database interactions and external service mocking',
              tools: ['jest', 'supertest', 'testcontainers'],
            },
            {
              type: 'system' as const,
              description: 'End-to-end testing of complete user workflows including registration and authentication flows',
              tools: ['cypress', 'playwright'],
            },
            {
              type: 'performance' as const,
              description: 'Load testing and performance validation under expected traffic patterns',
              tools: ['k6', 'artillery'],
            },
          ],
          automation: {
            cicd: true,
            triggers: ['push', 'pull-request', 'scheduled'],
            reporting: true,
          },
          testData: {
            strategy: 'Synthetic test data generated using factories with anonymized production data for edge cases',
            sources: ['test-factories', 'anonymized-production-subset'],
            privacy: true,
          },
        },
        documentation: {
          userGuide: true,
          apiDocs: true,
          deploymentGuide: true,
          troubleshooting: true,
        },
        compliance: [
          {
            standard: 'GDPR',
            requirements: [
              'Data protection by design and by default',
              'Right to data portability',
              'Right to be forgotten',
            ],
            evidence: [
              'Privacy impact assessment document',
              'Data retention policy',
              'User consent management implementation',
            ],
          },
          {
            standard: 'ISO 27001',
            requirements: [
              'Information security management system',
              'Access control procedures',
              'Incident response plan',
            ],
            evidence: [
              'Security policy documentation',
              'Access control matrix',
              'Incident response playbook',
            ],
          },
        ],
      };

      const options: ValidationOptions = {
        includeAI: true,
        includeCompliance: true,
        format: 'json',
      };

      const result = await pipeline.validateSpecification(validSpecification, options);

      expect(result).toBeDefined();
      expect(result.status).toBe('passed');
      expect(result.summary.errors).toBe(0);
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.aiInsights).toBeDefined();
      expect(result.complianceStatus).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);

      // Verify coverage metrics
      expect(result.metrics.coverage.requirements).toBe(100);
      expect(result.metrics.coverage.architecture).toBe(100);
      expect(result.metrics.coverage.implementation).toBe(100);
      expect(result.metrics.coverage.testing).toBe(100);
    }, 15000); // Extended timeout for comprehensive validation

    it('should handle invalid specifications gracefully', async () => {
      const invalidSpecification = {
        metadata: {
          id: '',
          name: '',
          version: 'invalid-version',
          description: 'Short',
          author: { name: '' },
          created: 'invalid-date',
          lastModified: 'invalid-date',
          category: 'invalid-category',
          status: 'invalid-status',
        },
        summary: {
          purpose: 'Too short',
          scope: 'Too short',
          stakeholders: [],
        },
        requirements: [],
      };

      const result = await pipeline.validateSpecification(invalidSpecification);

      expect(result.status).toBe('failed');
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.length).toBeGreaterThan(0);
      
      // Should have specific error messages
      const errorMessages = result.issues.map(issue => issue.message);
      expect(errorMessages.some(msg => msg.includes('ID is required'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('Name is required'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('Invalid semantic version'))).toBe(true);
    });

    it('should provide detailed recommendations for incomplete specifications', async () => {
      const incompleteSpecification = {
        metadata: {
          id: 'incomplete-spec',
          name: 'Incomplete Specification',
          version: '1.0.0',
          description: 'This specification is intentionally incomplete for testing',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Testing incomplete specification validation behavior',
          scope: 'Limited scope for testing validation recommendations',
          stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Basic Requirement',
          description: 'A basic requirement without much detail for testing purposes',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Required for testing',
          acceptanceCriteria: [],
        }],
      };

      const result = await pipeline.validateSpecification(incompleteSpecification);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => rec.type === 'improvement')).toBe(true);
      
      // Should have AI insights about incompleteness
      if (result.aiInsights) {
        expect(result.aiInsights.some(insight => insight.category === 'completeness')).toBe(true);
      }
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple specifications in parallel', async () => {
      const specifications = [
        {
          id: 'spec-1',
          data: {
            metadata: {
              id: 'spec-1',
              name: 'First Specification',
              version: '1.0.0',
              description: 'First test specification for batch validation',
              author: { name: 'Test Author 1' },
              created: '2024-01-01T00:00:00Z',
              lastModified: '2024-01-01T00:00:00Z',
              category: 'api' as const,
              status: 'draft' as const,
            },
            summary: {
              purpose: 'First specification for testing batch validation functionality',
              scope: 'Basic API functionality with minimal requirements',
              stakeholders: [{ role: 'Developer', responsibilities: ['Implementation'] }],
            },
            requirements: [{
              id: 'REQ-001',
              title: 'Basic Function',
              description: 'System must provide basic functionality as specified',
              type: 'functional' as const,
              priority: 'must-have' as const,
              rationale: 'Required for basic system operation',
              acceptanceCriteria: [{
                id: 'AC-001',
                description: 'System performs basic function correctly',
              }],
            }],
          },
        },
        {
          id: 'spec-2',
          data: {
            metadata: {
              id: 'spec-2',
              name: 'Second Specification',
              version: '2.0.0',
              description: 'Second test specification for batch validation',
              author: { name: 'Test Author 2' },
              created: '2024-01-02T00:00:00Z',
              lastModified: '2024-01-02T00:00:00Z',
              category: 'service' as const,
              status: 'approved' as const,
            },
            summary: {
              purpose: 'Second specification for testing batch validation with different characteristics',
              scope: 'Service-oriented functionality with enhanced requirements',
              stakeholders: [{ role: 'Architect', responsibilities: ['Design'] }],
            },
            requirements: [{
              id: 'REQ-002',
              title: 'Advanced Function',
              description: 'System must provide advanced functionality with enhanced capabilities',
              type: 'functional' as const,
              priority: 'must-have' as const,
              rationale: 'Required for advanced system capabilities',
              acceptanceCriteria: [{
                id: 'AC-002',
                description: 'System performs advanced function with enhanced capabilities',
              }],
            }],
          },
        },
      ];

      const results = await pipeline.validateBatch(specifications, {
        parallel: true,
        includeAI: false, // Disable AI for faster testing
        includeCompliance: false,
      });

      expect(results).toHaveLength(2);
      expect(results.every(result => result.context.specificationId.startsWith('spec-'))).toBe(true);
      expect(results.every(result => result.status === 'passed')).toBe(true);
    });

    it('should handle mixed valid and invalid specifications in batch', async () => {
      const specifications = [
        {
          id: 'valid-spec',
          data: {
            metadata: {
              id: 'valid-spec',
              name: 'Valid Specification',
              version: '1.0.0',
              description: 'This is a valid specification for batch testing',
              author: { name: 'Test Author' },
              created: '2024-01-01T00:00:00Z',
              lastModified: '2024-01-01T00:00:00Z',
              category: 'api' as const,
              status: 'draft' as const,
            },
            summary: {
              purpose: 'Valid specification for batch validation testing',
              scope: 'Covers basic functionality validation',
              stakeholders: [{ role: 'Developer', responsibilities: ['Testing'] }],
            },
            requirements: [{
              id: 'REQ-001',
              title: 'Valid Requirement',
              description: 'This is a valid requirement for testing purposes',
              type: 'functional' as const,
              priority: 'must-have' as const,
              rationale: 'Required for validation testing',
              acceptanceCriteria: [{
                id: 'AC-001',
                description: 'Valid acceptance criterion for testing',
              }],
            }],
          },
        },
        {
          id: 'invalid-spec',
          data: {
            metadata: {
              id: '',
              name: '',
              version: 'invalid',
              description: 'Short',
              author: { name: '' },
              created: 'invalid',
              lastModified: 'invalid',
              category: 'invalid' as any,
              status: 'invalid' as any,
            },
            summary: {
              purpose: 'Short',
              scope: 'Short',
              stakeholders: [],
            },
            requirements: [],
          },
        },
      ];

      const results = await pipeline.validateBatch(specifications, {
        parallel: true,
        includeAI: false,
        includeCompliance: false,
      });

      expect(results).toHaveLength(2);
      
      const validResult = results.find(r => r.context.specificationId === 'valid-spec');
      const invalidResult = results.find(r => r.context.specificationId === 'invalid-spec');
      
      expect(validResult?.status).toBe('passed');
      expect(invalidResult?.status).toBe('failed');
      expect(invalidResult?.summary.errors).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const config = pipeline.getConfig();
      const originalRuleCount = config.getEnabledRules().length;

      // Add a custom rule
      config.addRule({
        id: 'custom-test-rule',
        name: 'Custom Test Rule',
        description: 'A custom rule for testing',
        category: 'format',
        severity: 'info',
        enabled: true,
        parameters: {},
      });

      const updatedRuleCount = config.getEnabledRules().length;
      expect(updatedRuleCount).toBe(originalRuleCount + 1);

      // Verify the rule was added
      const customRule = config.getRule('custom-test-rule');
      expect(customRule).toBeDefined();
      expect(customRule?.name).toBe('Custom Test Rule');
    });

    it('should toggle rules on and off', () => {
      const config = pipeline.getConfig();
      
      // Disable a rule
      const success = config.toggleRule('schema-validation', false);
      expect(success).toBe(true);
      
      const disabledRule = config.getRule('schema-validation');
      expect(disabledRule?.enabled).toBe(false);
      
      // Re-enable the rule
      config.toggleRule('schema-validation', true);
      const enabledRule = config.getRule('schema-validation');
      expect(enabledRule?.enabled).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null input gracefully', async () => {
      const result = await pipeline.validateSpecification(null);
      
      expect(result.status).toBe('failed');
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.message.includes('parse'))).toBe(true);
    });

    it('should handle malformed JSON input gracefully', async () => {
      const malformedInput = '{"incomplete": json}';
      
      const result = await pipeline.validateSpecification(malformedInput);
      
      expect(result.status).toBe('failed');
      expect(result.summary.errors).toBeGreaterThan(0);
    });

    it('should handle very large specifications efficiently', async () => {
      const largeSpecification = {
        metadata: {
          id: 'large-spec',
          name: 'Large Specification',
          version: '1.0.0',
          description: 'A large specification with many requirements for performance testing',
          author: { name: 'Performance Tester' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'system' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Large specification for performance testing of validation pipeline',
          scope: 'Comprehensive system specification with extensive requirements',
          stakeholders: [{ role: 'Performance Engineer', responsibilities: ['Testing'] }],
        },
        requirements: Array.from({ length: 100 }, (_, i) => ({
          id: `REQ-${String(i + 1).padStart(3, '0')}`,
          title: `Requirement ${i + 1}`,
          description: `This is requirement number ${i + 1} for performance testing of the validation system`,
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: `Rationale for requirement ${i + 1} to ensure comprehensive validation testing`,
          acceptanceCriteria: [{
            id: `AC-${String(i + 1).padStart(3, '0')}`,
            description: `Acceptance criterion for requirement ${i + 1}`,
          }],
          dependencies: i > 0 ? [`REQ-${String(i).padStart(3, '0')}`] : [],
        })),
      };

      const startTime = Date.now();
      const result = await pipeline.validateSpecification(largeSpecification, {
        includeAI: false, // Disable AI for performance test
        includeCompliance: false,
      });
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.status).toBe('passed');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Singleton Export', () => {
    it('should provide working singleton instance', async () => {
      const simpleSpec = {
        metadata: {
          id: 'singleton-test',
          name: 'Singleton Test Spec',
          version: '1.0.0',
          description: 'Testing singleton export functionality',
          author: { name: 'Singleton Tester' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-01T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const,
        },
        summary: {
          purpose: 'Testing the exported singleton validation instance',
          scope: 'Basic validation using the singleton export',
          stakeholders: [{ role: 'Tester', responsibilities: ['Testing'] }],
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Singleton Test',
          description: 'Testing singleton functionality with basic requirement',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Required for singleton testing',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'Singleton validation works correctly',
          }],
        }],
      };

      const result = await specValidation.validateSpecification(simpleSpec, {
        includeAI: false,
        includeCompliance: false,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('passed');
      expect(result.context.specificationId).toBe('singleton-test');
    });
  });
});