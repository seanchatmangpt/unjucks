/**
 * Enterprise Environment Variable Validator
 * Validates and sanitizes environment variables according to Fortune 5 security standards
 */

import { z } from 'zod';
import crypto from 'crypto';
import consola from 'consola';

// Environment-specific schemas
const ProductionSecuritySchema = z.object({
  NODE_ENV: z.literal('production'),
  SECRET_ENCRYPTION_KEY: z.string().min(64), // Production requires 64+ chars
  JWT_SECRET: z.string().min(64),
  SESSION_SECRET: z.string().min(64),
  ENCRYPTION_KEY: z.string().min(64),
  DB_PASSWORD: z.string().min(16).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Must contain uppercase, lowercase, number, and special character'),
  BCRYPT_ROUNDS: z.coerce.number().min(12).max(15),
  DB_SSL_ENABLED: z.enum(['true', 'TRUE']).transform(() => true),
  AUDIT_LOG_ENABLED: z.enum(['true', 'TRUE']).transform(() => true).default('true'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'TRUE']).transform(() => true).default('true'),
  CORS_ORIGIN: z.string().refine(val => val !== '*', 'Wildcard CORS not allowed in production'),
  GRAPHQL_PLAYGROUND: z.enum(['false', 'FALSE']).transform(() => false).default('false'),
  GRAPHQL_INTROSPECTION: z.enum(['false', 'FALSE']).transform(() => false).default('false')
});

const StagingSecuritySchema = z.object({
  NODE_ENV: z.literal('staging'),
  SECRET_ENCRYPTION_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  DB_PASSWORD: z.string().min(12),
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(13),
  DB_SSL_ENABLED: z.enum(['true', 'TRUE']).transform(() => true).default('true'),
  AUDIT_LOG_ENABLED: z.enum(['true', 'TRUE']).transform(() => true).default('true'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'TRUE']).transform(() => true).default('true'),
  CORS_ORIGIN: z.string().optional(),
  GRAPHQL_PLAYGROUND: z.enum(['false', 'FALSE']).transform(() => false).default('false'),
  GRAPHQL_INTROSPECTION: z.enum(['false', 'FALSE']).transform(() => false).default('false')
});

const DevelopmentSecuritySchema = z.object({
  NODE_ENV: z.literal('development'),
  SECRET_ENCRYPTION_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(16),
  DB_PASSWORD: z.string().min(8),
  BCRYPT_ROUNDS: z.coerce.number().min(8).max(12),
  DB_SSL_ENABLED: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('false'),
  AUDIT_LOG_ENABLED: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('true'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('false'),
  CORS_ORIGIN: z.string().default('*'),
  GRAPHQL_PLAYGROUND: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('true'),
  GRAPHQL_INTROSPECTION: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('true')
});

// Common configuration schema (applies to all environments)
const CommonConfigSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().min(1000).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  
  // Database Configuration
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  DB_POOL_MIN: z.coerce.number().min(0).max(50).default(5),
  DB_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(10000),
  DB_STATEMENT_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_QUERY_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DB_HEALTH_CHECK_INTERVAL: z.coerce.number().min(5000).default(30000),
  
  // Redis Configuration
  REDIS_URL: z.string().url().optional(),
  REDIS_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  REDIS_RETRY_DELAY: z.coerce.number().min(50).max(5000).default(100),
  
  // JWT Configuration
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('7d'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(60000).default(900000), // 15 minutes minimum
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(10).max(10000).default(1000),
  RATE_LIMIT_SKIP_SUCCESS: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('false'),
  
  // WebSocket Configuration
  WS_PORT: z.coerce.number().min(1000).max(65535).optional(),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().min(5000).default(30000),
  WS_MAX_CONNECTIONS: z.coerce.number().min(100).max(100000).default(10000),
  
  // File Storage
  UPLOAD_MAX_SIZE: z.coerce.number().min(1024).max(104857600).default(10485760), // 10MB max
  STORAGE_TYPE: z.enum(['local', 's3', 'gcs', 'azure']).default('local'),
  
  // Optional AWS Configuration
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // Monitoring
  METRICS_ENABLED: z.enum(['true', 'false', 'TRUE', 'FALSE']).transform(val => val.toLowerCase() === 'true').default('true'),
  HEALTH_CHECK_PATH: z.string().default('/health'),
  PROMETHEUS_ENDPOINT: z.string().default('/metrics')
});

// Sensitive variable patterns to detect in environment
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /auth/i,
  /private/i,
  /cert/i,
  /api_key/i
];

class EnvironmentValidator {
  constructor(options = {}) {
    this.logger = consola.withTag('ENV-VALIDATOR');
    this.strictMode = options.strictMode ?? true;
    this.auditSensitiveVars = options.auditSensitiveVars ?? true;
  }

  /**
   * Validate environment variables based on NODE_ENV
   */
  validate(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    
    try {
      // First validate common configuration
      const commonConfig = CommonConfigSchema.parse(env);
      
      // Then validate environment-specific security requirements
      let securityConfig;
      switch (nodeEnv) {
        case 'production':
          securityConfig = ProductionSecuritySchema.parse(env);
          break;
        case 'staging':
          securityConfig = StagingSecuritySchema.parse(env);
          break;
        case 'development':
          securityConfig = DevelopmentSecuritySchema.parse(env);
          break;
        default:
          throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'staging', or 'production'`);
      }
      
      const validatedConfig = {
        ...commonConfig,
        ...securityConfig
      };
      
      // Run additional security checks
      this.runSecurityChecks(validatedConfig, nodeEnv);
      
      // Audit sensitive variables
      if (this.auditSensitiveVars) {
        this.auditSensitiveVariables(env);
      }
      
      this.logger.success(`Environment validation passed for ${nodeEnv}`);
      
      return {
        isValid: true,
        config: validatedConfig,
        environment: nodeEnv,
        securityLevel: this.getSecurityLevel(nodeEnv)
      };
      
    } catch (error) {
      this.logger.error(`Environment validation failed: ${error.message}`);
      
      if (this.strictMode) {
        throw error;
      }
      
      return {
        isValid: false,
        error: error.message,
        environment: nodeEnv
      };
    }
  }

  /**
   * Run additional security checks
   */
  runSecurityChecks(config, environment) {
    const checks = [];
    
    // Check for weak encryption settings
    if (environment === 'production' && config.BCRYPT_ROUNDS < 12) {
      checks.push('BCRYPT_ROUNDS too low for production (minimum 12)');
    }
    
    // Check for insecure CORS in production
    if (environment === 'production' && config.CORS_ORIGIN === '*') {
      checks.push('Wildcard CORS not allowed in production');
    }
    
    // Check for GraphQL security in production
    if (environment === 'production') {
      if (config.GRAPHQL_PLAYGROUND === true) {
        checks.push('GraphQL Playground must be disabled in production');
      }
      if (config.GRAPHQL_INTROSPECTION === true) {
        checks.push('GraphQL Introspection must be disabled in production');
      }
    }
    
    // Check for SSL configuration
    if ((environment === 'production' || environment === 'staging') && !config.DB_SSL_ENABLED) {
      checks.push('Database SSL must be enabled in production/staging');
    }
    
    // Check for audit logging
    if (!config.AUDIT_LOG_ENABLED) {
      checks.push('Audit logging should be enabled for compliance');
    }
    
    if (checks.length > 0) {
      throw new Error(`Security check failures: ${checks.join(', ')}`);
    }
  }

  /**
   * Audit sensitive variables
   */
  auditSensitiveVariables(env) {
    const sensitiveVars = [];
    
    for (const [key, value] of Object.entries(env)) {
      if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
        sensitiveVars.push({
          variable: key,
          hasValue: !!value,
          valueLength: value ? value.length : 0,
          isLikelyWeak: value && value.length < 16
        });
      }
    }
    
    // Log sensitive variable audit
    this.logger.info(`Found ${sensitiveVars.length} sensitive environment variables`);
    
    const weakSecrets = sensitiveVars.filter(v => v.isLikelyWeak);
    if (weakSecrets.length > 0) {
      this.logger.warn(`${weakSecrets.length} sensitive variables appear to have weak values`);
    }
    
    return sensitiveVars;
  }

  /**
   * Generate secure random values for missing secrets
   */
  generateSecureDefaults(environment = 'development') {
    const defaults = {};
    
    const keyLength = environment === 'production' ? 64 : 32;
    
    if (!process.env.SECRET_ENCRYPTION_KEY) {
      defaults.SECRET_ENCRYPTION_KEY = crypto.randomBytes(keyLength).toString('hex');
    }
    
    if (!process.env.JWT_SECRET) {
      defaults.JWT_SECRET = crypto.randomBytes(keyLength).toString('hex');
    }
    
    if (!process.env.SESSION_SECRET) {
      defaults.SESSION_SECRET = crypto.randomBytes(keyLength).toString('hex');
    }
    
    if (!process.env.ENCRYPTION_KEY) {
      defaults.ENCRYPTION_KEY = crypto.randomBytes(keyLength).toString('hex');
    }
    
    if (!process.env.CSRF_SECRET) {
      defaults.CSRF_SECRET = crypto.randomBytes(32).toString('hex');
    }
    
    return defaults;
  }

  /**
   * Get security level based on environment
   */
  getSecurityLevel(environment) {
    const levels = {
      development: 'BASIC',
      staging: 'ENHANCED',
      production: 'MAXIMUM'
    };
    
    return levels[environment] || 'UNKNOWN';
  }

  /**
   * Check for hardcoded secrets in code
   */
  async scanForHardcodedSecrets(filePath) {
    const fs = await import('fs-extra');
    
    if (!await fs.pathExists(filePath)) {
      return [];
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    const findings = [];
    
    // Common hardcoded secret patterns
    const patterns = [
      { name: 'API Key', regex: /['"](sk-[a-zA-Z0-9]{32,}|pk_[a-zA-Z0-9]{24,})['"]/ },
      { name: 'JWT Token', regex: /['"](eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]/ },
      { name: 'Database URL', regex: /['"](mongodb:\/\/|postgres:\/\/|mysql:\/\/)[^'"]*['"]/ },
      { name: 'AWS Access Key', regex: /['"](AKIA[0-9A-Z]{16})['"]/ },
      { name: 'Generic Secret', regex: /(?:password|secret|key|token)['"]?\s*[:=]\s*['"][^'"]{16,}['"]/ },
      { name: 'Private Key', regex: /-----BEGIN (RSA )?PRIVATE KEY-----/ }
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(new RegExp(pattern.regex, 'gi'));
      if (matches) {
        findings.push({
          type: pattern.name,
          count: matches.length,
          file: filePath
        });
      }
    });
    
    return findings;
  }

  /**
   * Validate specific secret strength
   */
  validateSecretStrength(secret, type = 'generic') {
    const requirements = {
      jwt: { minLength: 32, requireSpecialChars: false },
      database: { minLength: 16, requireSpecialChars: true },
      encryption: { minLength: 32, requireSpecialChars: false },
      api_key: { minLength: 24, requireSpecialChars: false },
      production: { minLength: 64, requireSpecialChars: true }
    };
    
    const req = requirements[type] || requirements.generic || { minLength: 16, requireSpecialChars: false };
    
    const checks = {
      length: secret.length >= req.minLength,
      uppercase: /[A-Z]/.test(secret),
      lowercase: /[a-z]/.test(secret),
      numbers: /\d/.test(secret),
      specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret),
      notCommon: !this.isCommonPassword(secret)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    const required = req.requireSpecialChars ? 5 : 4;
    
    return {
      isStrong: score >= required && checks.length && checks.notCommon,
      score,
      checks,
      recommendations: this.getSecretRecommendations(checks, req)
    };
  }

  /**
   * Check if password is in common passwords list
   */
  isCommonPassword(password) {
    const common = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', 'abc123'
    ];
    
    return common.includes(password.toLowerCase());
  }

  /**
   * Get recommendations for improving secret strength
   */
  getSecretRecommendations(checks, requirements) {
    const recommendations = [];
    
    if (!checks.length) {
      recommendations.push(`Increase length to at least ${requirements.minLength} characters`);
    }
    if (!checks.uppercase) {
      recommendations.push('Add uppercase letters');
    }
    if (!checks.lowercase) {
      recommendations.push('Add lowercase letters');
    }
    if (!checks.numbers) {
      recommendations.push('Add numbers');
    }
    if (requirements.requireSpecialChars && !checks.specialChars) {
      recommendations.push('Add special characters');
    }
    if (!checks.notCommon) {
      recommendations.push('Avoid common passwords');
    }
    
    return recommendations;
  }
}

export default EnvironmentValidator;