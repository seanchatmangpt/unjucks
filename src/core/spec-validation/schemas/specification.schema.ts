import { z } from 'zod';

/**
 * Base metadata schema for all specifications
 */
export const MetadataSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'Invalid semantic version'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  author: z.object({
    name: z.string().min(1, 'Author name is required'),
    email: z.string().email('Invalid email format').optional(),
    organization: z.string().optional(),
  }),
  created: z.string().datetime('Invalid ISO date format'),
  lastModified: z.string().datetime('Invalid ISO date format'),
  tags: z.array(z.string()).default([]),
  category: z.enum(['api', 'component', 'service', 'module', 'system', 'process']),
  status: z.enum(['draft', 'review', 'approved', 'deprecated']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

/**
 * Requirements schema with traceability
 */
export const RequirementSchema = z.object({
  id: z.string().min(1, 'Requirement ID is required'),
  title: z.string().min(1, 'Requirement title is required'),
  description: z.string().min(20, 'Requirement description must be at least 20 characters'),
  type: z.enum(['functional', 'non-functional', 'business', 'technical', 'security', 'performance']),
  priority: z.enum(['must-have', 'should-have', 'could-have', 'wont-have']),
  source: z.string().optional(),
  rationale: z.string().min(10, 'Rationale must be provided'),
  acceptanceCriteria: z.array(z.object({
    id: z.string(),
    description: z.string().min(10, 'Acceptance criteria description required'),
    testable: z.boolean().default(true),
  })).min(1, 'At least one acceptance criterion required'),
  dependencies: z.array(z.string()).default([]),
  risks: z.array(z.object({
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    probability: z.enum(['low', 'medium', 'high']),
    mitigation: z.string().optional(),
  })).default([]),
  estimatedEffort: z.object({
    value: z.number().min(0),
    unit: z.enum(['hours', 'days', 'weeks', 'months']),
  }).optional(),
});

/**
 * Architecture component schema
 */
export const ArchitectureSchema = z.object({
  overview: z.string().min(50, 'Architecture overview must be comprehensive'),
  patterns: z.array(z.object({
    name: z.string(),
    type: z.enum(['design', 'architectural', 'integration', 'security']),
    description: z.string(),
    rationale: z.string(),
  })).default([]),
  components: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['service', 'module', 'library', 'database', 'interface']),
    description: z.string(),
    responsibilities: z.array(z.string()).min(1, 'Component responsibilities required'),
    interfaces: z.array(z.object({
      name: z.string(),
      type: z.enum(['api', 'event', 'message', 'data']),
      description: z.string(),
    })).default([]),
    dependencies: z.array(z.string()).default([]),
  })).min(1, 'At least one component required'),
  dataFlow: z.array(z.object({
    from: z.string(),
    to: z.string(),
    description: z.string(),
    protocol: z.string().optional(),
  })).default([]),
  constraints: z.array(z.object({
    type: z.enum(['technical', 'business', 'security', 'performance']),
    description: z.string(),
    impact: z.string(),
  })).default([]),
});

/**
 * Implementation details schema
 */
export const ImplementationSchema = z.object({
  technology: z.object({
    language: z.string().min(1, 'Programming language required'),
    framework: z.string().optional(),
    libraries: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    platform: z.string().optional(),
  }),
  structure: z.object({
    directories: z.array(z.object({
      path: z.string(),
      purpose: z.string(),
    })).default([]),
    files: z.array(z.object({
      path: z.string(),
      type: z.enum(['source', 'config', 'test', 'documentation', 'resource']),
      description: z.string(),
    })).default([]),
  }),
  buildProcess: z.object({
    steps: z.array(z.string()).min(1, 'Build steps required'),
    dependencies: z.array(z.string()).default([]),
    artifacts: z.array(z.string()).default([]),
  }).optional(),
  deployment: z.object({
    environment: z.enum(['development', 'staging', 'production', 'all']),
    strategy: z.string(),
    requirements: z.array(z.string()).default([]),
  }).optional(),
});

/**
 * Testing strategy schema
 */
export const TestingSchema = z.object({
  strategy: z.string().min(20, 'Testing strategy description required'),
  levels: z.array(z.object({
    type: z.enum(['unit', 'integration', 'system', 'acceptance', 'performance', 'security']),
    description: z.string(),
    tools: z.array(z.string()).default([]),
    coverage: z.object({
      target: z.number().min(0).max(100),
      metric: z.enum(['line', 'branch', 'function', 'statement']),
    }).optional(),
  })).min(1, 'At least one test level required'),
  automation: z.object({
    cicd: z.boolean().default(true),
    triggers: z.array(z.string()).default([]),
    reporting: z.boolean().default(true),
  }),
  testData: z.object({
    strategy: z.string(),
    sources: z.array(z.string()).default([]),
    privacy: z.boolean().default(true),
  }).optional(),
});

/**
 * Main specification schema
 */
export const SpecificationSchema = z.object({
  metadata: MetadataSchema,
  summary: z.object({
    purpose: z.string().min(20, 'Purpose must be clearly defined'),
    scope: z.string().min(20, 'Scope must be clearly defined'),
    stakeholders: z.array(z.object({
      role: z.string(),
      name: z.string().optional(),
      responsibilities: z.array(z.string()).default([]),
    })).min(1, 'At least one stakeholder required'),
    assumptions: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
  }),
  requirements: z.array(RequirementSchema).min(1, 'At least one requirement required'),
  architecture: ArchitectureSchema.optional(),
  implementation: ImplementationSchema.optional(),
  testing: TestingSchema.optional(),
  documentation: z.object({
    userGuide: z.boolean().default(false),
    apiDocs: z.boolean().default(false),
    deploymentGuide: z.boolean().default(false),
    troubleshooting: z.boolean().default(false),
  }).optional(),
  compliance: z.array(z.object({
    standard: z.string(),
    requirements: z.array(z.string()),
    evidence: z.array(z.string()).default([]),
  })).default([]),
});

export type Specification = z.infer<typeof SpecificationSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type Implementation = z.infer<typeof ImplementationSchema>;
export type Testing = z.infer<typeof TestingSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;