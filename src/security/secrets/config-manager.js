/**
 * Environment-Specific Configuration Manager
 * Manages configurations across development, staging, and production environments
 */

import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import crypto from 'crypto';
import consola from 'consola';
import SecretManager from './secret-manager.js';
import EnvironmentValidator from './environment-validator.js';

// Configuration schemas for different environments
const BaseConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production'])
  }),
  server: z.object({
    port: z.number().min(1000).max(65535),
    host: z.string(),
    timeout: z.number().min(1000).default(30000),
    keepAliveTimeout: z.number().min(1000).default(65000),
    maxConnections: z.number().min(1).default(1000)
  }),
  security: z.object({
    cors: z.object({
      origin: z.union([z.string(), z.array(z.string())]),
      credentials: z.boolean().default(true),
      methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
      allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization'])
    }),
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      windowMs: z.number().min(60000).default(900000),
      maxRequests: z.number().min(1).default(1000),
      skipSuccessfulRequests: z.boolean().default(false),
      skipFailedRequests: z.boolean().default(false)
    }),
    headers: z.object({
      hsts: z.boolean().default(true),
      noSniff: z.boolean().default(true),
      xframe: z.boolean().default(true),
      xss: z.boolean().default(true)
    })
  }),
  database: z.object({
    type: z.enum(['postgresql', 'mysql', 'mongodb']).default('postgresql'),
    ssl: z.boolean(),
    pool: z.object({
      min: z.number().min(0).default(2),
      max: z.number().min(1).default(10),
      acquireTimeoutMillis: z.number().min(1000).default(60000),
      idleTimeoutMillis: z.number().min(1000).default(30000)
    }),
    retries: z.object({
      max: z.number().min(0).default(3),
      backoffBase: z.number().min(100).default(300),
      backoffExponent: z.number().min(1).default(2)
    })
  }),
  cache: z.object({
    type: z.enum(['redis', 'memory', 'memcached']).default('redis'),
    ttl: z.number().min(60).default(3600),
    maxSize: z.number().min(100).default(10000)
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    enableAudit: z.boolean().default(true),
    enablePerformance: z.boolean().default(false),
    retention: z.object({
      days: z.number().min(1).default(30),
      maxSize: z.string().default('100MB')
    })
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.object({
      enabled: z.boolean().default(true),
      endpoint: z.string().default('/metrics'),
      interval: z.number().min(1000).default(30000)
    }),
    health: z.object({
      enabled: z.boolean().default(true),
      endpoint: z.string().default('/health'),
      detailed: z.boolean().default(false)
    }),
    tracing: z.object({
      enabled: z.boolean().default(false),
      sampleRate: z.number().min(0).max(1).default(0.1)
    })
  })
});

class ConfigManager {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.configDir = options.configDir || './config';
    this.secretManager = options.secretManager || new SecretManager();
    this.validator = options.validator || new EnvironmentValidator();
    this.logger = consola.withTag('CONFIG-MANAGER');
    
    this.configCache = new Map();
    this.watchers = new Map();
    this.secretCache = new Map();
    this.secretCacheTTL = 300000; // 5 minutes
  }

  /**
   * Initialize configuration manager
   */
  async init() {
    await this.ensureConfigDirectories();
    await this.generateDefaultConfigs();
    await this.validateEnvironment();
    
    this.logger.success(`Configuration manager initialized for ${this.environment}`);
  }

  /**
   * Ensure configuration directories exist
   */
  async ensureConfigDirectories() {
    const directories = [
      this.configDir,
      path.join(this.configDir, 'environments'),
      path.join(this.configDir, 'secrets'),
      path.join(this.configDir, 'templates')
    ];
    
    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
   * Generate default configurations for all environments
   */
  async generateDefaultConfigs() {
    const environments = ['development', 'staging', 'production'];
    
    for (const env of environments) {
      const configPath = path.join(this.configDir, 'environments', `${env}.json`);
      
      if (!await fs.pathExists(configPath)) {
        const defaultConfig = this.generateDefaultConfig(env);
        await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
        this.logger.info(`Generated default configuration for ${env}`);
      }
    }
  }

  /**
   * Generate default configuration for specific environment
   */
  generateDefaultConfig(environment) {
    const baseConfig = {
      app: {
        name: 'unjucks-enterprise',
        version: '1.0.0',
        description: 'Unjucks Enterprise Application',
        environment
      },
      server: {
        port: environment === 'production' ? 8080 : 3000,
        host: environment === 'production' ? '0.0.0.0' : 'localhost',
        timeout: 30000,
        keepAliveTimeout: 65000,
        maxConnections: environment === 'production' ? 10000 : 1000
      },
      security: {
        cors: {
          origin: environment === 'production' ? [] : ['http://localhost:3000', 'http://localhost:8080'],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        rateLimit: {
          enabled: true,
          windowMs: environment === 'production' ? 900000 : 3600000, // 15 min prod, 1 hour dev
          maxRequests: environment === 'production' ? 1000 : 10000,
          skipSuccessfulRequests: false,
          skipFailedRequests: false
        },
        headers: {
          hsts: environment === 'production',
          noSniff: true,
          xframe: true,
          xss: true
        }
      },
      database: {
        type: 'postgresql',
        ssl: environment === 'production' || environment === 'staging',
        pool: {
          min: environment === 'production' ? 5 : 2,
          max: environment === 'production' ? 50 : 10,
          acquireTimeoutMillis: 60000,
          idleTimeoutMillis: 30000
        },
        retries: {
          max: 3,
          backoffBase: 300,
          backoffExponent: 2
        }
      },
      cache: {
        type: 'redis',
        ttl: 3600,
        maxSize: environment === 'production' ? 100000 : 10000
      },
      logging: {
        level: environment === 'production' ? 'info' : 'debug',
        format: environment === 'production' ? 'json' : 'pretty',
        enableAudit: true,
        enablePerformance: environment === 'production',
        retention: {
          days: environment === 'production' ? 90 : 30,
          maxSize: environment === 'production' ? '1GB' : '100MB'
        }
      },
      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          endpoint: '/metrics',
          interval: environment === 'production' ? 10000 : 30000
        },
        health: {
          enabled: true,
          endpoint: '/health',
          detailed: environment !== 'production'
        },
        tracing: {
          enabled: environment === 'production',
          sampleRate: environment === 'production' ? 0.01 : 0.1
        }
      }
    };

    return baseConfig;
  }

  /**
   * Load configuration for current environment
   */
  async loadConfig() {
    const cacheKey = `config-${this.environment}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    const configPath = path.join(this.configDir, 'environments', `${this.environment}.json`);
    
    if (!await fs.pathExists(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = await fs.readJson(configPath);
    const validatedConfig = BaseConfigSchema.parse(configData);
    
    // Merge with secrets
    const configWithSecrets = await this.mergeSecrets(validatedConfig);
    
    this.configCache.set(cacheKey, configWithSecrets);
    
    this.logger.info(`Loaded configuration for ${this.environment}`);
    
    return configWithSecrets;
  }

  /**
   * Merge configuration with secrets
   */
  async mergeSecrets(config) {
    const configWithSecrets = { ...config };
    
    // Add database connection details
    try {
      const dbPassword = await this.getSecret('db_password');
      configWithSecrets.database.password = dbPassword;
    } catch (error) {
      if (this.environment === 'production') {
        throw new Error('Database password secret not found in production environment');
      }
      this.logger.warn('Database password secret not found, using default');
    }
    
    // Add cache connection details
    try {
      const cachePassword = await this.getSecret('cache_password');
      configWithSecrets.cache.password = cachePassword;
    } catch (error) {
      this.logger.debug('Cache password secret not found');
    }
    
    // Add JWT secret
    try {
      const jwtSecret = await this.getSecret('jwt_secret');
      configWithSecrets.security.jwtSecret = jwtSecret;
    } catch (error) {
      if (this.environment === 'production') {
        throw new Error('JWT secret not found in production environment');
      }
      this.logger.warn('JWT secret not found, generating temporary secret');
      configWithSecrets.security.jwtSecret = crypto.randomBytes(32).toString('hex');
    }
    
    // Add encryption key
    try {
      const encryptionKey = await this.getSecret('encryption_key');
      configWithSecrets.security.encryptionKey = encryptionKey;
    } catch (error) {
      if (this.environment === 'production') {
        throw new Error('Encryption key not found in production environment');
      }
      this.logger.warn('Encryption key not found, generating temporary key');
      configWithSecrets.security.encryptionKey = crypto.randomBytes(32).toString('hex');
    }
    
    return configWithSecrets;
  }

  /**
   * Get secret with caching
   */
  async getSecret(secretId) {
    const cacheKey = `secret-${secretId}`;
    const cached = this.secretCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.secretCacheTTL) {
      return cached.value;
    }
    
    const secret = await this.secretManager.getSecret(secretId);
    
    this.secretCache.set(cacheKey, {
      value: secret.value,
      timestamp: Date.now()
    });
    
    return secret.value;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates) {
    const currentConfig = await this.loadConfig();
    const mergedConfig = this.deepMerge(currentConfig, updates);
    
    // Validate updated configuration
    const validatedConfig = BaseConfigSchema.parse(mergedConfig);
    
    const configPath = path.join(this.configDir, 'environments', `${this.environment}.json`);
    await fs.writeJson(configPath, validatedConfig, { spaces: 2 });
    
    // Clear cache
    this.configCache.delete(`config-${this.environment}`);
    
    this.logger.info(`Updated configuration for ${this.environment}`);
    
    return validatedConfig;
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate environment configuration
   */
  async validateEnvironment() {
    const validation = this.validator.validate();
    
    if (!validation.isValid) {
      throw new Error(`Environment validation failed: ${validation.error}`);
    }
    
    this.logger.success(`Environment validation passed (${validation.securityLevel} security level)`);
    
    return validation;
  }

  /**
   * Watch for configuration changes
   */
  async watchConfig(callback) {
    const configPath = path.join(this.configDir, 'environments', `${this.environment}.json`);
    
    if (this.watchers.has(this.environment)) {
      return;
    }
    
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(configPath);
    
    watcher.on('change', async () => {
      try {
        this.logger.info('Configuration file changed, reloading...');
        
        // Clear cache
        this.configCache.delete(`config-${this.environment}`);
        
        // Reload configuration
        const newConfig = await this.loadConfig();
        
        if (callback) {
          await callback(newConfig);
        }
        
        this.logger.success('Configuration reloaded successfully');
        
      } catch (error) {
        this.logger.error('Failed to reload configuration:', error);
      }
    });
    
    this.watchers.set(this.environment, watcher);
    
    this.logger.info(`Watching configuration file: ${configPath}`);
  }

  /**
   * Stop watching configuration changes
   */
  async stopWatching() {
    for (const [env, watcher] of this.watchers) {
      await watcher.close();
      this.logger.info(`Stopped watching configuration for ${env}`);
    }
    
    this.watchers.clear();
  }

  /**
   * Get configuration value by path
   */
  async getConfigValue(path) {
    const config = await this.loadConfig();
    const keys = path.split('.');
    
    let value = config;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value by path
   */
  async setConfigValue(path, value) {
    const config = await this.loadConfig();
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let target = config;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    
    await this.updateConfig(config);
  }

  /**
   * Export configuration for deployment
   */
  async exportConfig(includeSecrets = false) {
    const config = await this.loadConfig();
    
    if (!includeSecrets) {
      // Remove sensitive information
      const sanitized = JSON.parse(JSON.stringify(config));
      delete sanitized.database?.password;
      delete sanitized.cache?.password;
      delete sanitized.security?.jwtSecret;
      delete sanitized.security?.encryptionKey;
      
      return sanitized;
    }
    
    return config;
  }

  /**
   * Generate configuration template
   */
  async generateTemplate(environment = 'development') {
    const template = this.generateDefaultConfig(environment);
    const templatePath = path.join(this.configDir, 'templates', `${environment}.template.json`);
    
    await fs.writeJson(templatePath, template, { spaces: 2 });
    
    this.logger.info(`Generated configuration template: ${templatePath}`);
    
    return template;
  }

  /**
   * Validate configuration against schema
   */
  async validateConfig(configData = null) {
    const config = configData || await this.loadConfig();
    
    try {
      const validated = BaseConfigSchema.parse(config);
      return { isValid: true, config: validated };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Get configuration summary
   */
  async getConfigSummary() {
    const config = await this.loadConfig();
    
    return {
      environment: this.environment,
      app: config.app,
      server: {
        port: config.server.port,
        host: config.server.host
      },
      database: {
        type: config.database.type,
        ssl: config.database.ssl
      },
      cache: {
        type: config.cache.type
      },
      security: {
        corsOrigins: Array.isArray(config.security.cors.origin) 
          ? config.security.cors.origin.length 
          : 1,
        rateLimitEnabled: config.security.rateLimit.enabled
      },
      monitoring: {
        enabled: config.monitoring.enabled,
        metricsEnabled: config.monitoring.metrics.enabled,
        tracingEnabled: config.monitoring.tracing.enabled
      }
    };
  }
}

export default ConfigManager;