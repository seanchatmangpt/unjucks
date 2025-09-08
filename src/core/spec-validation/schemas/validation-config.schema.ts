import { z } from 'zod';

/**
 * Validation rule configuration schema
 */
export const ValidationRuleSchema = z.object({
  id: z.string().min(1, 'Rule ID is required'),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().min(10, 'Rule description required'),
  category: z.enum(['format', 'completeness', 'consistency', 'compliance', 'quality']),
  severity: z.enum(['error', 'warning', 'info']),
  enabled: z.boolean().default(true),
  parameters: z.record(z.unknown()).default({}),
});

/**
 * Compliance standard configuration schema
 */
export const ComplianceStandardSchema = z.object({
  id: z.string().min(1, 'Standard ID is required'),
  name: z.string().min(1, 'Standard name is required'),
  version: z.string().optional(),
  description: z.string(),
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    mandatory: z.boolean().default(true),
    checkpoints: z.array(z.string()).default([]),
  })),
  applicableCategories: z.array(z.string()).default([]),
});

/**
 * AI validation configuration schema
 */
export const AIValidationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  models: z.array(z.object({
    provider: z.enum(['claude', 'openai', 'custom']),
    model: z.string(),
    temperature: z.number().min(0).max(2).default(0.1),
    maxTokens: z.number().min(100).default(2000),
  })).min(1),
  prompts: z.object({
    completenessCheck: z.string(),
    consistencyCheck: z.string(),
    qualityAssessment: z.string(),
    riskAnalysis: z.string(),
  }),
  confidence: z.object({
    threshold: z.number().min(0).max(1).default(0.8),
    requireHuman: z.boolean().default(false),
  }),
});

/**
 * Report configuration schema
 */
export const ReportConfigSchema = z.object({
  formats: z.array(z.enum(['json', 'html', 'pdf', 'markdown'])).default(['json']),
  includeDetails: z.boolean().default(true),
  includeSuggestions: z.boolean().default(true),
  includeMetrics: z.boolean().default(true),
  template: z.string().optional(),
  outputPath: z.string().default('./validation-reports'),
});

/**
 * Performance configuration schema
 */
export const PerformanceConfigSchema = z.object({
  timeout: z.number().min(1000).default(30000), // 30 seconds
  retries: z.number().min(0).default(2),
  parallelism: z.number().min(1).default(5),
  caching: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().min(300).default(3600), // 1 hour
  }),
});

/**
 * Main validation configuration schema
 */
export const ValidationConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  rules: z.array(ValidationRuleSchema).default([]),
  compliance: z.array(ComplianceStandardSchema).default([]),
  ai: AIValidationConfigSchema.optional(),
  reports: ReportConfigSchema,
  performance: PerformanceConfigSchema,
  customValidators: z.array(z.object({
    name: z.string(),
    path: z.string(),
    enabled: z.boolean().default(true),
  })).default([]),
  integrations: z.object({
    mcp: z.object({
      enabled: z.boolean().default(true),
      endpoints: z.array(z.string()).default([]),
    }),
    github: z.object({
      enabled: z.boolean().default(false),
      webhooks: z.boolean().default(false),
    }),
    jira: z.object({
      enabled: z.boolean().default(false),
      projectKeys: z.array(z.string()).default([]),
    }),
  }).default({}),
});

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type ComplianceStandard = z.infer<typeof ComplianceStandardSchema>;
export type AIValidationConfig = z.infer<typeof AIValidationConfigSchema>;
export type ReportConfig = z.infer<typeof ReportConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;