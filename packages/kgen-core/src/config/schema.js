/**
 * KGEN Configuration Schema
 * Defines and validates the structure of KGEN configuration files
 */

import { z } from 'zod';

/**
 * Directory configuration schema
 */
const DirectoriesSchema = z.object({
  out: z.string().default('./dist'),
  state: z.string().default('./.kgen/state'),
  cache: z.string().default('./.kgen/cache'),
  templates: z.string().default('./templates'),
  rules: z.string().default('./rules')
});

/**
 * Generation configuration schema
 */
const GenerateSchema = z.object({
  defaultTemplate: z.string().default('basic'),
  globalVars: z.record(z.any()).default({}),
  attestByDefault: z.boolean().default(true),
  cleanOutput: z.boolean().default(false),
  parallel: z.boolean().default(true),
  maxConcurrency: z.number().min(1).max(32).default(4)
});

/**
 * Reasoning configuration schema
 */
const ReasoningSchema = z.object({
  enabled: z.boolean().default(true),
  defaultRules: z.array(z.string()).default(['basic', 'validation']),
  maxDepth: z.number().min(1).max(100).default(10),
  timeout: z.number().min(1000).default(30000)
});

/**
 * Provenance configuration schema
 */
const ProvenanceSchema = z.object({
  engineId: z.string().default('kgen-core'),
  include: z.array(z.enum(['templates', 'rules', 'data', 'config', 'environment']))
    .default(['templates', 'rules', 'data', 'config']),
  trackDependencies: z.boolean().default(true),
  generateAttestation: z.boolean().default(true),
  signingKey: z.string().nullable().default(null)
});

/**
 * Drift detection configuration schema
 */
const DriftSchema = z.object({
  onDrift: z.enum(['warn', 'error', 'ignore']).default('warn'),
  exitCode: z.number().min(0).max(255).default(1),
  autoFix: z.boolean().default(false),
  backup: z.boolean().default(true)
});

/**
 * Cache configuration schema
 */
const CacheSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().min(0).default(3600000),
  gcInterval: z.number().min(0).default(300000),
  maxSize: z.string().regex(/^\\d+[KMGT]?B$/i).default('100MB'),
  strategy: z.enum(['lru', 'fifo', 'ttl']).default('lru')
});

/**
 * Metrics configuration schema
 */
const MetricsSchema = z.object({
  enabled: z.boolean().default(true),
  logFields: z.array(z.string()).default(['timestamp', 'operation', 'duration', 'success']),
  exportFormat: z.enum(['json', 'csv', 'prometheus']).default('json'),
  retention: z.number().min(1).max(365).default(30)
});

/**
 * Security configuration schema
 */
const SecuritySchema = z.object({
  sandbox: z.boolean().default(true),
  allowedModules: z.array(z.string()).default(['@kgen/*', 'lodash', 'date-fns']),
  maxMemory: z.string().regex(/^\\d+[KMGT]?B$/i).default('512MB'),
  maxExecutionTime: z.number().min(1000).default(60000)
});

/**
 * Development configuration schema
 */
const DevSchema = z.object({
  watch: z.boolean().default(false),
  hotReload: z.boolean().default(false),
  debugMode: z.boolean().default(false),
  verbose: z.boolean().default(false)
});

/**
 * Main KGEN configuration schema
 */
export const KgenConfigSchema = z.object({
  directories: DirectoriesSchema,
  generate: GenerateSchema,
  reasoning: ReasoningSchema,
  provenance: ProvenanceSchema,
  drift: DriftSchema,
  cache: CacheSchema,
  metrics: MetricsSchema,
  security: SecuritySchema,
  dev: DevSchema,
  
  // Environment-specific configurations (optional)
  development: z.object({}).passthrough().optional(),
  production: z.object({}).passthrough().optional(),
  test: z.object({}).passthrough().optional()
}).passthrough(); // Allow additional properties for extensibility

/**
 * Validate KGEN configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
export function validateConfig(config) {
  try {
    const validatedConfig = KgenConfigSchema.parse(config);
    
    return {
      success: true,
      data: validatedConfig,
      errors: []
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    
    return {
      success: false,
      error: error,
      errors: [{ message: error.message }]
    };
  }
}

/**
 * Create a partial schema for specific configuration sections
 * @param {string} section - Configuration section name
 * @returns {z.ZodSchema} Section schema
 */
export function createSectionSchema(section) {
  const schemas = {
    directories: DirectoriesSchema,
    generate: GenerateSchema,
    reasoning: ReasoningSchema,
    provenance: ProvenanceSchema,
    drift: DriftSchema,
    cache: CacheSchema,
    metrics: MetricsSchema,
    security: SecuritySchema,
    dev: DevSchema
  };
  
  const schema = schemas[section];
  if (!schema) {
    throw new Error(`Unknown configuration section: ${section}`);
  }
  
  return schema;
}

/**
 * Get default values for configuration section
 * @param {string} section - Configuration section name
 * @returns {Object} Default values
 */
export function getSectionDefaults(section) {
  const schema = createSectionSchema(section);
  return schema.parse({});
}

/**
 * Validate specific configuration section
 * @param {string} section - Configuration section name
 * @param {Object} config - Configuration values
 * @returns {Object} Validation result
 */
export function validateSection(section, config) {
  try {
    const schema = createSectionSchema(section);
    const validatedConfig = schema.parse(config);
    
    return {
      success: true,
      data: validatedConfig,
      errors: []
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    
    return {
      success: false,
      error: error,
      errors: [{ message: error.message }]
    };
  }
}

/**
 * Generate TypeScript types from schema
 * @returns {string} TypeScript type definitions
 */
export function generateTypes() {
  return `
export interface KgenDirectories {
  out: string;
  state: string;
  cache: string;
  templates: string;
  rules: string;
}

export interface KgenGenerate {
  defaultTemplate: string;
  globalVars: Record<string, any>;
  attestByDefault: boolean;
  cleanOutput: boolean;
  parallel: boolean;
  maxConcurrency: number;
}

export interface KgenReasoning {
  enabled: boolean;
  defaultRules: string[];
  maxDepth: number;
  timeout: number;
}

export interface KgenProvenance {
  engineId: string;
  include: ('templates' | 'rules' | 'data' | 'config' | 'environment')[];
  trackDependencies: boolean;
  generateAttestation: boolean;
  signingKey: string | null;
}

export interface KgenDrift {
  onDrift: 'warn' | 'error' | 'ignore';
  exitCode: number;
  autoFix: boolean;
  backup: boolean;
}

export interface KgenCache {
  enabled: boolean;
  ttl: number;
  gcInterval: number;
  maxSize: string;
  strategy: 'lru' | 'fifo' | 'ttl';
}

export interface KgenMetrics {
  enabled: boolean;
  logFields: string[];
  exportFormat: 'json' | 'csv' | 'prometheus';
  retention: number;
}

export interface KgenSecurity {
  sandbox: boolean;
  allowedModules: string[];
  maxMemory: string;
  maxExecutionTime: number;
}

export interface KgenDev {
  watch: boolean;
  hotReload: boolean;
  debugMode: boolean;
  verbose: boolean;
}

export interface KgenConfig {
  directories: KgenDirectories;
  generate: KgenGenerate;
  reasoning: KgenReasoning;
  provenance: KgenProvenance;
  drift: KgenDrift;
  cache: KgenCache;
  metrics: KgenMetrics;
  security: KgenSecurity;
  dev: KgenDev;
  development?: Partial<KgenConfig>;
  production?: Partial<KgenConfig>;
  test?: Partial<KgenConfig>;
  [key: string]: any;
}
  `;
}