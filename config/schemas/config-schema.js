import { z } from 'zod';

/**
 * Enterprise Configuration Schema
 * Comprehensive validation schemas for all configuration levels
 */

// Environment enum
const Environment = z.enum(['development', 'staging', 'production', 'test']);

// Server Configuration Schema
const ServerSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
  timeout: z.number().int().min(1000).max(300000).default(30000),
  keepAliveTimeout: z.number().int().min(1000).max(300000).default(65000),
  maxConnections: z.number().int().min(1).max(100000).default(1000),
  gracefulShutdown: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().int().min(1000).max(60000).default(30000)
  }).default({})
});

// Database Configuration Schema
const DatabaseSchema = z.object({
  type: z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  ssl: z.boolean().default(false),
  pool: z.object({
    min: z.number().int().min(0).max(100).default(2),
    max: z.number().int().min(1).max(1000).default(10),
    acquireTimeoutMillis: z.number().int().min(1000).max(300000).default(60000),
    idleTimeoutMillis: z.number().int().min(1000).max(300000).default(30000),
    createTimeoutMillis: z.number().int().min(1000).max(300000).default(30000)
  }).default({}),
  retries: z.object({
    max: z.number().int().min(0).max(10).default(3),
    backoffBase: z.number().int().min(100).max(5000).default(300),
    backoffExponent: z.number().min(1).max(5).default(2)
  }).default({})
});

// Security Configuration Schema
const SecuritySchema = z.object({
  cors: z.object({
    origin: z.union([
      z.string(),
      z.array(z.string()),
      z.boolean()
    ]).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-Requested-With']),
    maxAge: z.number().int().min(0).max(86400).default(86400)
  }).default({}),
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    windowMs: z.number().int().min(60000).max(86400000).default(3600000), // 1 hour default
    maxRequests: z.number().int().min(1).max(100000).default(1000),
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false),
    standardHeaders: z.boolean().default(true),
    legacyHeaders: z.boolean().default(false)
  }).default({}),
  headers: z.object({
    hsts: z.boolean().default(false),
    noSniff: z.boolean().default(true),
    xframe: z.boolean().default(true),
    xss: z.boolean().default(true),
    referrerPolicy: z.string().default('no-referrer'),
    contentSecurityPolicy: z.boolean().default(false)
  }).default({}),
  jwt: z.object({
    secret: z.string().min(32).optional(),
    algorithm: z.string().default('HS256'),
    expiresIn: z.string().default('24h'),
    issuer: z.string().optional(),
    audience: z.string().optional()
  }).optional(),
  encryption: z.object({
    algorithm: z.string().default('aes-256-gcm'),
    keyLength: z.number().int().min(16).max(32).default(32)
  }).default({})
});

// Caching Configuration Schema
const CacheSchema = z.object({
  type: z.enum(['memory', 'redis', 'memcached']).default('memory'),
  ttl: z.number().int().min(60).max(86400).default(3600), // 1 hour default
  maxSize: z.number().int().min(100).max(1000000).default(10000),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).max(15).default(0),
    keyPrefix: z.string().default('unjucks:'),
    retryDelayOnFailover: z.number().int().min(100).max(5000).default(100)
  }).optional()
});

// Logging Configuration Schema
const LoggingSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  format: z.enum(['json', 'pretty', 'combined']).default('json'),
  enableAudit: z.boolean().default(true),
  enablePerformance: z.boolean().default(false),
  enableSensitiveData: z.boolean().default(false),
  retention: z.object({
    days: z.number().int().min(1).max(365).default(30),
    maxSize: z.string().default('100MB'),
    maxFiles: z.number().int().min(1).max(100).default(10)
  }).default({}),
  transports: z.array(z.enum(['console', 'file', 'syslog', 'elasticsearch'])).default(['console']),
  elasticsearch: z.object({
    host: z.string().optional(),
    index: z.string().default('unjucks-logs'),
    level: z.string().default('info')
  }).optional()
});

// Monitoring Configuration Schema
const MonitoringSchema = z.object({
  enabled: z.boolean().default(true),
  metrics: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().default('/metrics'),
    interval: z.number().int().min(5000).max(300000).default(30000),
    prometheus: z.boolean().default(true),
    customMetrics: z.array(z.string()).default([])
  }).default({}),
  health: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().default('/health'),
    detailed: z.boolean().default(false),
    checks: z.array(z.string()).default(['database', 'cache', 'memory'])
  }).default({}),
  tracing: z.object({
    enabled: z.boolean().default(false),
    service: z.string().default('unjucks'),
    sampleRate: z.number().min(0).max(1).default(0.1),
    jaegerEndpoint: z.string().optional(),
    zipkinEndpoint: z.string().optional()
  }).default({})
});

// Feature Flags Schema
const FeatureFlagsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['local', 'launchdarkly', 'unleash', 'flipt']).default('local'),
  refreshInterval: z.number().int().min(5000).max(300000).default(30000),
  flags: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])).default({}),
  rollouts: z.record(z.string(), z.object({
    enabled: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(0),
    userGroups: z.array(z.string()).default([]),
    conditions: z.array(z.object({
      attribute: z.string(),
      operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in']),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    })).default([])
  })).default({})
});

// Secrets Management Schema
const SecretsSchema = z.object({
  provider: z.enum(['env', 'vault', 'aws-secrets-manager', 'azure-key-vault']).default('env'),
  vault: z.object({
    endpoint: z.string().url().optional(),
    token: z.string().optional(),
    roleId: z.string().optional(),
    secretId: z.string().optional(),
    mount: z.string().default('secret'),
    version: z.enum(['v1', 'v2']).default('v2'),
    timeout: z.number().int().min(1000).max(30000).default(5000)
  }).optional(),
  aws: z.object({
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    roleArn: z.string().optional()
  }).optional(),
  azure: z.object({
    vaultUrl: z.string().url().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    tenantId: z.string().optional()
  }).optional(),
  caching: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().min(300).max(3600).default(900) // 15 minutes default
  }).default({})
});

// Application Configuration Schema
const AppSchema = z.object({
  name: z.string().min(1).default('unjucks-app'),
  version: z.string().min(1).default('1.0.0'),
  description: z.string().min(1).default('Unjucks Application'),
  environment: Environment.default('development'),
  debug: z.boolean().default(false),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en-US')
});

// Hot Reload Configuration Schema
const HotReloadSchema = z.object({
  enabled: z.boolean().default(false),
  watchPaths: z.array(z.string()).default(['./config']),
  excludePaths: z.array(z.string()).default(['./config/secrets']),
  debounceMs: z.number().int().min(100).max(5000).default(1000),
  restartOnChange: z.array(z.string()).default(['server', 'database']),
  safeReload: z.array(z.string()).default(['logging', 'monitoring'])
});

// Main Configuration Schema
export const ConfigSchema = z.object({
  app: AppSchema.default({}),
  server: ServerSchema.default({}),
  database: DatabaseSchema.default({}),
  security: SecuritySchema.default({}),
  cache: CacheSchema.default({}),
  logging: LoggingSchema.default({}),
  monitoring: MonitoringSchema.default({}),
  features: FeatureFlagsSchema.default({}),
  secrets: SecretsSchema.default({}),
  hotReload: HotReloadSchema.default({})
});

// Environment-specific schema validation
export const validateEnvironmentConfig = (config, environment) => {
  const baseValidation = ConfigSchema.parse(config);
  
  // Production-specific validation
  if (environment === 'production') {
    const productionRequirements = z.object({
      security: z.object({
        headers: z.object({
          hsts: z.literal(true),
          contentSecurityPolicy: z.literal(true)
        }).partial(),
        rateLimit: z.object({
          enabled: z.literal(true)
        }).partial()
      }).partial(),
      logging: z.object({
        level: z.enum(['error', 'warn', 'info']),
        enableSensitiveData: z.literal(false)
      }).partial(),
      hotReload: z.object({
        enabled: z.literal(false)
      }).partial()
    }).partial();
    
    productionRequirements.parse(baseValidation);
  }
  
  return baseValidation;
};

// Configuration validation helpers
export const ConfigValidators = {
  validatePort: (port) => z.number().int().min(1).max(65535).parse(port),
  validateUrl: (url) => z.string().url().parse(url),
  validateEnvironment: (env) => Environment.parse(env),
  validateSecretKey: (key) => z.string().min(32).parse(key),
  validatePercentage: (pct) => z.number().min(0).max(100).parse(pct),
  validateTimeout: (ms) => z.number().int().min(100).max(300000).parse(ms)
};

export { Environment, ServerSchema, DatabaseSchema, SecuritySchema, CacheSchema, LoggingSchema, MonitoringSchema, FeatureFlagsSchema, SecretsSchema, AppSchema, HotReloadSchema };