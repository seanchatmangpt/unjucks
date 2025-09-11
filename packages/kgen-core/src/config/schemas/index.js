/**
 * KGEN Configuration Schema
 * 
 * Joi-based validation schemas for complete KGEN configuration
 * with support for all features from the PRD specification.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import Joi from 'joi';

// Helper schemas for reusable patterns
const timeUnit = Joi.string().pattern(/^\d+[smhd]$/).description('Time duration (e.g., 30s, 5m, 2h, 1d)');
const sizeUnit = Joi.string().pattern(/^\d+[KMGT]?B$/).description('Size unit (e.g., 100MB, 1GB)');
const directoryPath = Joi.string().min(1).description('Directory path');
const filePath = Joi.string().min(1).description('File path');
const uri = Joi.string().uri().description('Valid URI');
const semver = Joi.string().pattern(/^\d+\.\d+\.\d+/).description('Semantic version');

/**
 * Project metadata schema
 */
const projectSchema = Joi.object({
  name: Joi.string().required().min(1).max(100)
    .description('Project name used in reports and attestations'),
  
  version: semver.required()
    .description('Current version of the project knowledge'),
  
  description: Joi.string().max(500)
    .description('Project description'),
  
  author: Joi.string().max(100)
    .description('Project author'),
  
  license: Joi.string().max(50)
    .description('Project license')
}).description('Project-level metadata');

/**
 * Directory configuration schema
 */
const directoriesSchema = Joi.object({
  out: directoryPath.default('./dist')
    .description('Root directory for all generated artifacts'),
  
  state: directoryPath.default('./.kgen/state')
    .description('Directory for stateful files like indexes and logs'),
  
  cache: directoryPath.default('./.kgen/cache')
    .description('Directory for content-addressed cache'),
  
  templates: directoryPath.default('./templates')
    .description('Directory where kgen looks for Nunjucks templates'),
  
  rules: directoryPath.default('./rules')
    .description('Directory where kgen looks for N3.js rule packs'),
  
  knowledge: directoryPath.default('./knowledge')
    .description('Directory containing knowledge graphs'),
  
  temp: directoryPath.default('./.kgen/temp')
    .description('Temporary files directory'),
  
  logs: directoryPath.default('./.kgen/logs')
    .description('Log files directory')
}).description('Directory structure configuration');

/**
 * Generation configuration schema
 */
const generateSchema = Joi.object({
  defaultTemplate: Joi.string().allow(null)
    .description('Default template to use if none specified'),
  
  globalVars: Joi.object().pattern(/.*/, Joi.any())
    .description('Global variables available in all templates'),
  
  attestByDefault: Joi.boolean().default(true)
    .description('Automatically generate .attest.json sidecar for every artifact'),
  
  engineOptions: Joi.object({
    autoescape: Joi.boolean().default(false),
    trimBlocks: Joi.boolean().default(true),
    lstripBlocks: Joi.boolean().default(true),
    throwOnUndefined: Joi.boolean().default(false)
  }).description('Nunjucks engine options'),
  
  output: Joi.object({
    preserveTimestamps: Joi.boolean().default(false),
    createDirectories: Joi.boolean().default(true),
    fileMode: Joi.number().integer().min(0).max(0o777).default(0o644),
    dirMode: Joi.number().integer().min(0).max(0o777).default(0o755)
  }).description('File output options')
}).description('Artifact generation configuration');

/**
 * Reasoning engine schema
 */
const reasoningSchema = Joi.object({
  enabled: Joi.boolean().default(true)
    .description('Enable reasoning during generation'),
  
  defaultRules: Joi.string().allow(null)
    .description('Default rule pack to use if --rules is not specified'),
  
  engine: Joi.object({
    maxIterations: Joi.number().integer().min(1).max(10000).default(1000)
      .description('Maximum inference iterations'),
    
    optimization: Joi.string().valid('none', 'basic', 'aggressive').default('basic')
      .description('Optimization level for reasoning engine'),
    
    parallel: Joi.boolean().default(true)
      .description('Enable parallel processing'),
    
    memoryLimit: Joi.number().integer().min(64).max(4096).default(512)
      .description('Memory limit for reasoning (MB)')
  }),
  
  rules: Joi.object({
    autoLoad: Joi.boolean().default(true)
      .description('Automatically load rules from rules directory'),
    
    loadingStrategy: Joi.string().valid('lazy', 'eager').default('lazy')
      .description('Rule loading strategy'),
    
    cache: Joi.boolean().default(true)
      .description('Cache compiled rules')
  })
}).description('N3.js-based reasoning engine configuration');

/**
 * Provenance configuration schema
 */
const provenanceSchema = Joi.object({
  engineId: Joi.string().default('kgen')
    .description('Engine identifier for attestations'),
  
  include: Joi.object({
    timestamp: Joi.boolean().default(true),
    engineVersion: Joi.boolean().default(true),
    graphHash: Joi.boolean().default(true),
    templatePath: Joi.boolean().default(true),
    rulesUsed: Joi.boolean().default(true),
    environment: Joi.boolean().default(false),
    system: Joi.boolean().default(false)
  }).description('Metadata to include in attestations'),
  
  signing: Joi.object({
    enabled: Joi.boolean().default(false),
    algorithm: Joi.string().valid('RS256', 'ES256', 'PS256').default('RS256'),
    keyPath: filePath.allow(null),
    certPath: filePath.allow(null)
  }).description('Cryptographic signing options'),
  
  blockchain: Joi.object({
    enabled: Joi.boolean().default(false),
    network: Joi.string().valid('ethereum-mainnet', 'ethereum-testnet', 'polygon').default('ethereum-testnet'),
    contractAddress: Joi.string().allow(null)
  }).description('Blockchain anchoring (experimental)')
}).description('Provenance and attestation configuration');

/**
 * Impact analysis schema
 */
const impactSchema = Joi.object({
  defaultReportType: Joi.string().valid('subjects', 'triples', 'artifacts').default('artifacts')
    .description('Default report type to generate'),
  
  depth: Joi.object({
    maxDepth: Joi.number().integer().min(1).max(50).default(10)
      .description('Maximum graph traversal depth'),
    
    includeIndirect: Joi.boolean().default(true)
      .description('Include indirect dependencies')
  }),
  
  ignore: Joi.object({
    blankNodes: Joi.boolean().default(true)
      .description('Ignore blank node identifier changes'),
    
    predicates: Joi.array().items(uri).default([])
      .description('Array of predicate URIs to ignore during diff'),
    
    filePatterns: Joi.array().items(Joi.string()).default([])
      .description('File patterns to ignore')
  }),
  
  output: Joi.object({
    format: Joi.string().valid('json', 'yaml', 'text').default('json'),
    includeDetails: Joi.boolean().default(true),
    groupByType: Joi.boolean().default(true)
  })
}).description('Impact analysis configuration');

/**
 * Drift detection schema
 */
const driftSchema = Joi.object({
  onDrift: Joi.string().valid('fail', 'warn', 'fix').default('fail')
    .description('Action to take when drift is detected'),
  
  exitCode: Joi.number().integer().min(1).max(255).default(3)
    .description('Exit code when drift detected and onDrift is fail'),
  
  include: Joi.array().items(Joi.string()).default(['dist/**/*'])
    .description('Files to check for drift'),
  
  exclude: Joi.array().items(Joi.string()).default(['**/.DS_Store', '**/node_modules/**'])
    .description('Files to exclude from drift detection'),
  
  detection: Joi.object({
    checkContent: Joi.boolean().default(true),
    checkPermissions: Joi.boolean().default(false),
    checkTimestamps: Joi.boolean().default(false)
  })
}).description('Drift detection configuration');

/**
 * Cache configuration schema
 */
const cacheSchema = Joi.object({
  enabled: Joi.boolean().default(true)
    .description('Enable caching system'),
  
  storage: Joi.string().valid('file', 'memory', 'redis').default('file')
    .description('Cache storage backend'),
  
  gc: Joi.object({
    strategy: Joi.string().valid('lru', 'fifo', 'lfu').default('lru')
      .description('Garbage collection strategy'),
    
    maxAge: timeUnit.default('7d')
      .description('Maximum age for cached items'),
    
    maxSize: sizeUnit.default('1GB')
      .description('Maximum cache size'),
    
    interval: timeUnit.default('1h')
      .description('Garbage collection interval')
  }).description('Garbage collection settings'),
  
  policies: Joi.object().pattern(/.*/, Joi.object({
    ttl: timeUnit,
    maxSize: sizeUnit
  })).description('Cache policies by type')
}).description('Cache configuration');

/**
 * Metrics configuration schema
 */
const metricsSchema = Joi.object({
  enabled: Joi.boolean().default(true)
    .description('Enable metrics collection'),
  
  format: Joi.string().valid('jsonl', 'csv', 'prometheus').default('jsonl')
    .description('Metrics storage format'),
  
  file: filePath.default('logs/metrics.jsonl')
    .description('Metrics file location'),
  
  logFields: Joi.array().items(Joi.string()).default([
    'timestamp', 'command', 'graphHash', 'template', 'filesGenerated',
    'triplesIn', 'triplesOut', 'reasoningTime', 'renderingTime', 'totalTime',
    'cacheHit', 'memoryUsage', 'driftDetected'
  ]).description('Fields to log in metrics'),
  
  performance: Joi.object({
    enabled: Joi.boolean().default(true),
    sampleRate: Joi.number().min(0).max(1).default(1.0),
    thresholds: Joi.object({
      reasoningTime: Joi.number().integer().min(0).default(5000),
      renderingTime: Joi.number().integer().min(0).default(1000),
      totalTime: Joi.number().integer().min(0).default(10000)
    })
  }),
  
  export: Joi.object({
    enabled: Joi.boolean().default(false),
    interval: timeUnit.default('1h'),
    format: Joi.string().valid('prometheus', 'json').default('prometheus')
  })
}).description('Metrics and monitoring configuration');

/**
 * Validation configuration schema
 */
const validationSchema = Joi.object({
  enabled: Joi.boolean().default(true)
    .description('Enable graph validation'),
  
  shacl: Joi.object({
    enabled: Joi.boolean().default(true),
    shapesPath: filePath.allow(null),
    allowWarnings: Joi.boolean().default(false)
  }),
  
  owl: Joi.object({
    enabled: Joi.boolean().default(false),
    reasoner: Joi.string().valid('pellet', 'hermit', 'fact++').default('pellet')
  }),
  
  custom: Joi.object({
    enabled: Joi.boolean().default(false),
    rulesPath: filePath.allow(null)
  })
}).description('Validation configuration');

/**
 * Security configuration schema
 */
const securitySchema = Joi.object({
  sanitize: Joi.object({
    enabled: Joi.boolean().default(true),
    allowedTags: Joi.array().items(Joi.string()).default([]),
    allowedAttributes: Joi.object().default({})
  }),
  
  pathTraversal: Joi.object({
    enabled: Joi.boolean().default(true),
    allowedPaths: Joi.array().items(directoryPath).default(['./templates', './knowledge', './rules'])
  }),
  
  limits: Joi.object({
    maxFileSize: sizeUnit.default('100MB'),
    maxGraphSize: Joi.number().integer().min(1000).default(1000000),
    maxExecutionTime: timeUnit.default('5m')
  })
}).description('Security configuration');

/**
 * Development options schema
 */
const devSchema = Joi.object({
  generateTypes: Joi.boolean().default(false)
    .description('Generate TypeScript definitions'),
  
  debug: Joi.boolean().default(false)
    .description('Enable debug logging'),
  
  hotReload: Joi.boolean().default(false)
    .description('Hot reload templates'),
  
  verbose: Joi.boolean().default(false)
    .description('Verbose output'),
  
  profile: Joi.boolean().default(false)
    .description('Profile performance')
}).description('Development and debugging options');

/**
 * Environment-specific configurations schema
 */
const environmentsSchema = Joi.object().pattern(/.*/, Joi.object({
  dev: devSchema.optional(),
  reasoning: reasoningSchema.optional(),
  cache: cacheSchema.optional(),
  metrics: metricsSchema.optional()
})).description('Environment-specific configurations');

/**
 * Main configuration schema
 */
export const configSchema = Joi.object({
  $schema: Joi.string().uri().optional()
    .description('JSON schema reference for IDE support'),
  
  project: projectSchema.required(),
  directories: directoriesSchema.optional(),
  generate: generateSchema.optional(),
  reasoning: reasoningSchema.optional(),
  provenance: provenanceSchema.optional(),
  impact: impactSchema.optional(),
  drift: driftSchema.optional(),
  cache: cacheSchema.optional(),
  metrics: metricsSchema.optional(),
  validation: validationSchema.optional(),
  security: securitySchema.optional(),
  dev: devSchema.optional(),
  environments: environmentsSchema.optional(),
  
  plugins: Joi.array().items(
    Joi.alternatives([
      Joi.string(),
      Joi.object({
        name: Joi.string().required(),
        options: Joi.object().optional()
      })
    ])
  ).default([]).description('Plugin configuration'),
  
  features: Joi.object({
    experimental: Joi.object({
      enabled: Joi.boolean().default(false),
      flags: Joi.array().items(Joi.string()).default([])
    })
  }).optional().description('Feature flags')
}).description('KGEN Configuration Schema');

// Export individual schemas for selective validation
export {
  projectSchema,
  directoriesSchema,
  generateSchema,
  reasoningSchema,
  provenanceSchema,
  impactSchema,
  driftSchema,
  cacheSchema,
  metricsSchema,
  validationSchema,
  securitySchema,
  devSchema,
  environmentsSchema
};

// Validation helper function
export function validateConfigSection(section, data) {
  const schemas = {
    project: projectSchema,
    directories: directoriesSchema,
    generate: generateSchema,
    reasoning: reasoningSchema,
    provenance: provenanceSchema,
    impact: impactSchema,
    drift: driftSchema,
    cache: cacheSchema,
    metrics: metricsSchema,
    validation: validationSchema,
    security: securitySchema,
    dev: devSchema,
    environments: environmentsSchema
  };
  
  const schema = schemas[section];
  if (!schema) {
    throw new Error(`Unknown configuration section: ${section}`);
  }
  
  return schema.validate(data);
}

export default configSchema;
