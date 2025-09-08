import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  SpecificationSchema, 
  MetadataSchema, 
  RequirementSchema,
  ArchitectureSchema,
  ImplementationSchema,
  TestingSchema
} from '../../../../src/core/spec-validation/schemas/specification.schema.js';

describe('SpecificationSchema', () => {
  describe('MetadataSchema', () => {
    it('should validate valid metadata', () => {
      const validMetadata = {
        id: 'spec-001',
        name: 'User Management API',
        version: '1.0.0',
        description: 'API specification for user management operations',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
          organization: 'Tech Corp'
        },
        created: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-02T00:00:00Z',
        tags: ['api', 'user-management'],
        category: 'api' as const,
        status: 'approved' as const,
        priority: 'high' as const
      };

      const result = MetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject invalid version format', () => {
      const invalidMetadata = {
        id: 'spec-001',
        name: 'Test Spec',
        version: 'invalid-version',
        description: 'Test description that is long enough',
        author: { name: 'Test Author' },
        created: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-02T00:00:00Z',
        category: 'api' as const,
        status: 'draft' as const
      };

      const result = MetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid semantic version');
      }
    });

    it('should reject short description', () => {
      const invalidMetadata = {
        id: 'spec-001',
        name: 'Test Spec',
        version: '1.0.0',
        description: 'Short',
        author: { name: 'Test Author' },
        created: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-02T00:00:00Z',
        category: 'api' as const,
        status: 'draft' as const
      };

      const result = MetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10 characters');
      }
    });
  });

  describe('RequirementSchema', () => {
    it('should validate valid requirement', () => {
      const validRequirement = {
        id: 'REQ-001',
        title: 'User Authentication',
        description: 'System must authenticate users using username and password',
        type: 'functional' as const,
        priority: 'must-have' as const,
        rationale: 'Security is critical for user data protection',
        acceptanceCriteria: [
          {
            id: 'AC-001',
            description: 'User can log in with valid credentials',
            testable: true
          }
        ]
      };

      const result = RequirementSchema.safeParse(validRequirement);
      expect(result.success).toBe(true);
    });

    it('should reject requirement without acceptance criteria', () => {
      const invalidRequirement = {
        id: 'REQ-001',
        title: 'User Authentication',
        description: 'System must authenticate users using username and password',
        type: 'functional' as const,
        priority: 'must-have' as const,
        rationale: 'Security is critical',
        acceptanceCriteria: []
      };

      const result = RequirementSchema.safeParse(invalidRequirement);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one acceptance criterion required');
      }
    });

    it('should reject short rationale', () => {
      const invalidRequirement = {
        id: 'REQ-001',
        title: 'User Authentication',
        description: 'System must authenticate users using username and password',
        type: 'functional' as const,
        priority: 'must-have' as const,
        rationale: 'Short',
        acceptanceCriteria: [{
          id: 'AC-001',
          description: 'User can log in with valid credentials'
        }]
      };

      const result = RequirementSchema.safeParse(invalidRequirement);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10 characters');
      }
    });
  });

  describe('ArchitectureSchema', () => {
    it('should validate valid architecture', () => {
      const validArchitecture = {
        overview: 'This is a comprehensive architecture overview that describes the system structure and design patterns used throughout the application',
        components: [
          {
            id: 'api-gateway',
            name: 'API Gateway',
            type: 'service' as const,
            description: 'Central entry point for all API requests',
            responsibilities: ['Request routing', 'Authentication', 'Rate limiting']
          }
        ]
      };

      const result = ArchitectureSchema.safeParse(validArchitecture);
      expect(result.success).toBe(true);
    });

    it('should reject short overview', () => {
      const invalidArchitecture = {
        overview: 'Short overview',
        components: [{
          id: 'comp-1',
          name: 'Component',
          type: 'service' as const,
          description: 'A component',
          responsibilities: ['Task']
        }]
      };

      const result = ArchitectureSchema.safeParse(invalidArchitecture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 50 characters');
      }
    });

    it('should reject component without responsibilities', () => {
      const invalidArchitecture = {
        overview: 'This is a comprehensive architecture overview that describes the system structure and design patterns used throughout the application',
        components: [{
          id: 'comp-1',
          name: 'Component',
          type: 'service' as const,
          description: 'A component',
          responsibilities: []
        }]
      };

      const result = ArchitectureSchema.safeParse(invalidArchitecture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Component responsibilities required');
      }
    });
  });

  describe('ImplementationSchema', () => {
    it('should validate valid implementation', () => {
      const validImplementation = {
        technology: {
          language: 'TypeScript',
          framework: 'Express.js',
          libraries: ['zod', 'prisma'],
          tools: ['jest', 'eslint']
        },
        structure: {
          directories: [{
            path: 'src/',
            purpose: 'Source code'
          }],
          files: [{
            path: 'src/index.ts',
            type: 'source' as const,
            description: 'Main entry point'
          }]
        }
      };

      const result = ImplementationSchema.safeParse(validImplementation);
      expect(result.success).toBe(true);
    });

    it('should require programming language', () => {
      const invalidImplementation = {
        technology: {
          language: ''
        },
        structure: {
          directories: [],
          files: []
        }
      };

      const result = ImplementationSchema.safeParse(invalidImplementation);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Programming language required');
      }
    });
  });

  describe('TestingSchema', () => {
    it('should validate valid testing configuration', () => {
      const validTesting = {
        strategy: 'Comprehensive testing strategy including unit, integration, and e2e tests',
        levels: [{
          type: 'unit' as const,
          description: 'Unit tests for individual functions',
          tools: ['jest', 'vitest']
        }],
        automation: {
          cicd: true,
          triggers: ['push', 'pull-request'],
          reporting: true
        }
      };

      const result = TestingSchema.safeParse(validTesting);
      expect(result.success).toBe(true);
    });

    it('should require at least one test level', () => {
      const invalidTesting = {
        strategy: 'Testing strategy description that is long enough',
        levels: [],
        automation: {
          cicd: true,
          reporting: true
        }
      };

      const result = TestingSchema.safeParse(invalidTesting);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one test level required');
      }
    });

    it('should reject short strategy description', () => {
      const invalidTesting = {
        strategy: 'Short',
        levels: [{
          type: 'unit' as const,
          description: 'Unit tests'
        }],
        automation: {
          cicd: true,
          reporting: true
        }
      };

      const result = TestingSchema.safeParse(invalidTesting);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 20 characters');
      }
    });
  });

  describe('Complete SpecificationSchema', () => {
    it('should validate complete valid specification', () => {
      const validSpec = {
        metadata: {
          id: 'spec-001',
          name: 'User Management API',
          version: '1.0.0',
          description: 'Complete API specification for user management',
          author: {
            name: 'John Doe',
            email: 'john@example.com'
          },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-02T00:00:00Z',
          category: 'api' as const,
          status: 'approved' as const
        },
        summary: {
          purpose: 'This specification defines the user management API endpoints',
          scope: 'Covers user CRUD operations, authentication, and authorization',
          stakeholders: [{
            role: 'Product Owner',
            name: 'Jane Smith',
            responsibilities: ['Requirements definition']
          }]
        },
        requirements: [{
          id: 'REQ-001',
          title: 'User Registration',
          description: 'System must allow new users to register with email and password',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'Users need to create accounts to access the system',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'User can register with valid email and password',
            testable: true
          }]
        }]
      };

      const result = SpecificationSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('should reject specification without requirements', () => {
      const invalidSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Test Spec',
          version: '1.0.0',
          description: 'Test specification description',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-02T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const
        },
        summary: {
          purpose: 'Test specification purpose description',
          scope: 'Test specification scope description',
          stakeholders: [{
            role: 'Developer',
            responsibilities: ['Development']
          }]
        },
        requirements: []
      };

      const result = SpecificationSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one requirement required');
      }
    });

    it('should reject specification without stakeholders', () => {
      const invalidSpec = {
        metadata: {
          id: 'spec-001',
          name: 'Test Spec',
          version: '1.0.0',
          description: 'Test specification description',
          author: { name: 'Test Author' },
          created: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-02T00:00:00Z',
          category: 'api' as const,
          status: 'draft' as const
        },
        summary: {
          purpose: 'Test specification purpose description',
          scope: 'Test specification scope description',
          stakeholders: []
        },
        requirements: [{
          id: 'REQ-001',
          title: 'Test Requirement',
          description: 'This is a test requirement description',
          type: 'functional' as const,
          priority: 'must-have' as const,
          rationale: 'This is the rationale for the requirement',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'Acceptance criterion description'
          }]
        }]
      };

      const result = SpecificationSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one stakeholder required');
      }
    });
  });
});