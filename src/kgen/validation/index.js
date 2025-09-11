/**
 * Comprehensive Configuration Validation Engine for KGEN
 * 
 * Provides enterprise-grade validation with detailed error messages, type checking,
 * range validation, format validation, nested object validation, and array validation
 * following the comprehensive pattern from generated/config.js
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Comprehensive Configuration Validator
 * Implements detailed validation patterns with type checking, required field validation,
 * range validation, format validation, nested object validation, and array validation
 */
export class ConfigurationValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      strictMode: config.strictMode !== false,
      throwOnError: config.throwOnError !== false,
      validateTypes: config.validateTypes !== false,
      validateRanges: config.validateRanges !== false,
      validateFormats: config.validateFormats !== false,
      validateNested: config.validateNested !== false,
      validateArrays: config.validateArrays !== false,
      allowExtraProperties: config.allowExtraProperties || false,
      enableLogging: config.enableLogging !== false,
      ...config
    };
    
    this.validationRules = new Map();
    this.formatValidators = new Map();
    this.typeValidators = new Map();
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0
    };
    
    this.initializeBuiltInValidators();
  }
  
  /**
   * Initialize built-in type and format validators
   */
  initializeBuiltInValidators() {
    // Type validators
    this.typeValidators.set('string', (value) => {
      if (typeof value !== 'string') {
        throw new Error(`Value must be a string, got ${typeof value}`);
      }
      return true;
    });
    
    this.typeValidators.set('number', (value) => {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Value must be a number, got ${typeof value}`);
      }
      return true;
    });
    
    this.typeValidators.set('integer', (value) => {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`Value must be an integer, got ${typeof value}`);
      }
      return true;
    });
    
    this.typeValidators.set('boolean', (value) => {
      if (typeof value !== 'boolean') {
        throw new Error(`Value must be a boolean, got ${typeof value}`);
      }
      return true;
    });
    
    this.typeValidators.set('object', (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Value must be an object, got ${typeof value}`);
      }
      return true;
    });
    
    this.typeValidators.set('array', (value) => {
      if (!Array.isArray(value)) {
        throw new Error(`Value must be an array, got ${typeof value}`);
      }
      return true;
    });
    
    // Format validators
    this.formatValidators.set('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error(`Invalid email format: ${value}`);
      }
      return true;
    });
    
    this.formatValidators.set('url', (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error(`Invalid URL format: ${value}`);
      }
    });
    
    this.formatValidators.set('uri', (value) => {
      const uriRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
      if (!uriRegex.test(value)) {
        throw new Error(`Invalid URI format: ${value}`);
      }
      return true;
    });
    
    this.formatValidators.set('hostname', (value) => {
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!hostnameRegex.test(value)) {
        throw new Error(`Invalid hostname format: ${value}`);
      }
      return true;
    });
    
    this.formatValidators.set('semver', (value) => {
      const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
      if (!semverRegex.test(value)) {
        throw new Error(`Invalid semantic version format: ${value}`);
      }
      return true;
    });
    
    this.formatValidators.set('path', (value) => {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Path must be a non-empty string`);
      }
      // Additional path validation can be added here
      return true;
    });
  }
  
  /**
   * Comprehensive configuration validation following the config.js pattern
   */
  validateConfig(config) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;
    
    try {
      // Root object validation
      if (!config || typeof config !== 'object') {
        throw new Error('Configuration must be an object');
      }
      
      // Validate app configuration section
      this.validateAppConfig(config.app);
      
      // Validate server configuration section
      this.validateServerConfig(config.server);
      
      // Validate database configuration section (optional for file-based systems)
      if (config.database) {
        this.validateDatabaseConfig(config.database);
      }
      
      // Validate redis configuration section
      this.validateRedisConfig(config.redis);
      
      // Validate optional sections
      this.validateOptionalConfig(config);
      
      // Validate environment-specific configurations
      this.validateEnvironmentConfig(config);
      
      // Custom validation rules
      this.runCustomValidationRules(config);
      
      const validationTime = Date.now() - startTime;
      this.validationStats.successfulValidations++;
      this.updateAverageValidationTime(validationTime);
      
      if (this.config.enableLogging) {
        consola.success(`✅ Configuration validation completed in ${validationTime}ms`);
      }
      
      this.emit('validation-success', {
        config,
        validationTime,
        timestamp: new Date().toISOString()
      });
      
      return config;
      
    } catch (error) {
      this.validationStats.failedValidations++;
      const validationTime = Date.now() - startTime;
      this.updateAverageValidationTime(validationTime);
      
      if (this.config.enableLogging) {
        consola.error(`❌ Configuration validation failed: ${error.message}`);
      }
      
      this.emit('validation-error', {
        error: error.message,
        validationTime,
        timestamp: new Date().toISOString()
      });
      
      if (this.config.throwOnError) {
        throw error;
      }
      
      return null;
    }
  }
  
  /**
   * Validate app configuration with detailed checks
   */
  validateAppConfig(app) {
    if (!app || typeof app !== 'object') {
      throw new Error('app configuration is required and must be an object');
    }
    
    // Required string fields
    this.validateRequiredString(app, 'name', 'app.name');
    this.validateRequiredString(app, 'version', 'app.version');
    this.validateRequiredString(app, 'description', 'app.description');
    
    // Validate semantic version format
    if (this.config.validateFormats) {
      try {
        this.formatValidators.get('semver')(app.version);
      } catch (error) {
        throw new Error(`app.version: ${error.message}`);
      }
    }
    
    // Optional fields validation
    if (app.author !== undefined) {
      this.validateType(app.author, 'string', 'app.author');
    }
    
    if (app.license !== undefined) {
      this.validateType(app.license, 'string', 'app.license');
    }
    
    if (app.repository !== undefined) {
      this.validateType(app.repository, 'string', 'app.repository');
      if (this.config.validateFormats) {
        try {
          this.formatValidators.get('url')(app.repository);
        } catch (error) {
          throw new Error(`app.repository: ${error.message}`);
        }
      }
    }
    
    if (app.keywords !== undefined) {
      this.validateArrayOfStrings(app.keywords, 'app.keywords');
    }
  }
  
  /**
   * Validate server configuration with detailed checks
   */
  validateServerConfig(server) {
    if (!server || typeof server !== 'object') {
      throw new Error('server configuration is required and must be an object');
    }
    
    // Port validation
    this.validateType(server.port, 'number', 'server.port');
    this.validateRange(server.port, 1, 65535, 'server.port');
    
    // Debug flag validation
    this.validateType(server.debug, 'boolean', 'server.debug');
    
    // Log level validation
    const validLogLevels = ['debug', 'info', 'warn', 'error', 'silent'];
    if (!validLogLevels.includes(server.logLevel)) {
      throw new Error(`server.logLevel must be one of: ${validLogLevels.join(', ')}, got: ${server.logLevel}`);
    }
    
    // Optional server fields
    if (server.host !== undefined) {
      this.validateType(server.host, 'string', 'server.host');
      if (this.config.validateFormats) {
        try {
          this.formatValidators.get('hostname')(server.host);
        } catch (error) {
          throw new Error(`server.host: ${error.message}`);
        }
      }
    }
    
    if (server.timeout !== undefined) {
      this.validateType(server.timeout, 'number', 'server.timeout');
      this.validateRange(server.timeout, 1000, 300000, 'server.timeout'); // 1s to 5min
    }
    
    if (server.maxConnections !== undefined) {
      this.validateType(server.maxConnections, 'integer', 'server.maxConnections');
      this.validateRange(server.maxConnections, 1, 10000, 'server.maxConnections');
    }
  }
  
  /**
   * Validate database configuration with detailed checks
   */
  validateDatabaseConfig(database) {
    if (!database || typeof database !== 'object') {
      throw new Error('database configuration is required and must be an object');
    }
    
    // Required fields
    this.validateRequiredString(database, 'host', 'database.host');
    this.validateType(database.port, 'number', 'database.port');
    this.validateRequiredString(database, 'name', 'database.name');
    this.validateType(database.ssl, 'boolean', 'database.ssl');
    
    // Port range validation
    this.validateRange(database.port, 1, 65535, 'database.port');
    
    // Optional fields
    if (database.poolSize !== undefined) {
      this.validateType(database.poolSize, 'integer', 'database.poolSize');
      this.validateRange(database.poolSize, 1, 100, 'database.poolSize');
    }
    
    if (database.username !== undefined) {
      this.validateType(database.username, 'string', 'database.username');
      this.validateMinLength(database.username, 1, 'database.username');
    }
    
    if (database.password !== undefined) {
      this.validateType(database.password, 'string', 'database.password');
      this.validateMinLength(database.password, 1, 'database.password');
    }
    
    if (database.connectionTimeout !== undefined) {
      this.validateType(database.connectionTimeout, 'number', 'database.connectionTimeout');
      this.validateRange(database.connectionTimeout, 1000, 60000, 'database.connectionTimeout');
    }
    
    if (database.queryTimeout !== undefined) {
      this.validateType(database.queryTimeout, 'number', 'database.queryTimeout');
      this.validateRange(database.queryTimeout, 1000, 300000, 'database.queryTimeout');
    }
  }
  
  /**
   * Validate Redis configuration with detailed checks
   */
  validateRedisConfig(redis) {
    if (!redis || typeof redis !== 'object') {
      throw new Error('redis configuration is required and must be an object');
    }
    
    // Required fields
    this.validateRequiredString(redis, 'host', 'redis.host');
    this.validateType(redis.port, 'number', 'redis.port');
    
    // Port range validation
    this.validateRange(redis.port, 1, 65535, 'redis.port');
    
    // Optional fields
    if (redis.password !== undefined) {
      this.validateType(redis.password, 'string', 'redis.password');
      this.validateMinLength(redis.password, 1, 'redis.password');
    }
    
    if (redis.database !== undefined) {
      this.validateType(redis.database, 'integer', 'redis.database');
      this.validateRange(redis.database, 0, 15, 'redis.database');
    }
    
    if (redis.maxRetries !== undefined) {
      this.validateType(redis.maxRetries, 'integer', 'redis.maxRetries');
      this.validateRange(redis.maxRetries, 0, 10, 'redis.maxRetries');
    }
    
    if (redis.retryDelay !== undefined) {
      this.validateType(redis.retryDelay, 'number', 'redis.retryDelay');
      this.validateRange(redis.retryDelay, 100, 10000, 'redis.retryDelay');
    }
  }
  
  /**
   * Validate optional configuration fields
   */
  validateOptionalConfig(config) {
    if (config.cdn !== undefined) {
      this.validateType(config.cdn, 'string', 'cdn');
      if (this.config.validateFormats) {
        try {
          this.formatValidators.get('url')(config.cdn);
        } catch (error) {
          throw new Error(`cdn: ${error.message}`);
        }
      }
    }
    
    if (config.monitoring !== undefined) {
      this.validateType(config.monitoring, 'boolean', 'monitoring');
    }
    
    if (config.security !== undefined) {
      this.validateSecurityConfig(config.security);
    }
    
    if (config.logging !== undefined) {
      this.validateLoggingConfig(config.logging);
    }
    
    if (config.caching !== undefined) {
      this.validateCachingConfig(config.caching);
    }
  }
  
  /**
   * Validate security configuration
   */
  validateSecurityConfig(security) {
    this.validateType(security, 'object', 'security');
    
    if (security.encryption !== undefined) {
      this.validateType(security.encryption, 'boolean', 'security.encryption');
    }
    
    if (security.secretKey !== undefined) {
      this.validateType(security.secretKey, 'string', 'security.secretKey');
      this.validateMinLength(security.secretKey, 32, 'security.secretKey');
    }
    
    if (security.allowedOrigins !== undefined) {
      this.validateArrayOfStrings(security.allowedOrigins, 'security.allowedOrigins');
    }
    
    if (security.rateLimit !== undefined) {
      this.validateType(security.rateLimit, 'object', 'security.rateLimit');
      
      if (security.rateLimit.windowMs !== undefined) {
        this.validateType(security.rateLimit.windowMs, 'number', 'security.rateLimit.windowMs');
        this.validateRange(security.rateLimit.windowMs, 1000, 3600000, 'security.rateLimit.windowMs');
      }
      
      if (security.rateLimit.max !== undefined) {
        this.validateType(security.rateLimit.max, 'integer', 'security.rateLimit.max');
        this.validateRange(security.rateLimit.max, 1, 10000, 'security.rateLimit.max');
      }
    }
  }
  
  /**
   * Validate logging configuration
   */
  validateLoggingConfig(logging) {
    this.validateType(logging, 'object', 'logging');
    
    const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    if (logging.level !== undefined && !validLevels.includes(logging.level)) {
      throw new Error(`logging.level must be one of: ${validLevels.join(', ')}, got: ${logging.level}`);
    }
    
    if (logging.file !== undefined) {
      this.validateType(logging.file, 'string', 'logging.file');
    }
    
    if (logging.maxSize !== undefined) {
      this.validateType(logging.maxSize, 'string', 'logging.maxSize');
      // Validate size format (e.g., "10mb", "1gb")
      if (!/^\d+[kmg]b$/i.test(logging.maxSize)) {
        throw new Error(`logging.maxSize must be in format like '10mb' or '1gb', got: ${logging.maxSize}`);
      }
    }
    
    if (logging.maxFiles !== undefined) {
      this.validateType(logging.maxFiles, 'integer', 'logging.maxFiles');
      this.validateRange(logging.maxFiles, 1, 100, 'logging.maxFiles');
    }
  }
  
  /**
   * Validate caching configuration
   */
  validateCachingConfig(caching) {
    this.validateType(caching, 'object', 'caching');
    
    if (caching.enabled !== undefined) {
      this.validateType(caching.enabled, 'boolean', 'caching.enabled');
    }
    
    if (caching.ttl !== undefined) {
      this.validateType(caching.ttl, 'number', 'caching.ttl');
      this.validateRange(caching.ttl, 1, 86400, 'caching.ttl'); // 1 second to 1 day
    }
    
    if (caching.maxSize !== undefined) {
      this.validateType(caching.maxSize, 'integer', 'caching.maxSize');
      this.validateRange(caching.maxSize, 10, 100000, 'caching.maxSize');
    }
  }
  
  /**
   * Validate environment-specific configurations
   */
  validateEnvironmentConfig(config) {
    const environment = config.environment || process.env.NODE_ENV || 'development';
    const validEnvironments = ['development', 'production', 'test', 'staging'];
    
    if (!validEnvironments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`);
    }
    
    // Environment-specific validation rules
    if (environment === 'production') {
      if (!config.server?.ssl && config.server?.port === 80) {
        throw new Error('Production environment should use SSL (HTTPS)');
      }
      
      if (config.server?.debug === true) {
        throw new Error('Debug mode should be disabled in production');
      }
      
      if (!config.database?.ssl) {
        consola.warn('⚠️ Database SSL is disabled in production environment');
      }
    }
  }
  
  /**
   * Run custom validation rules
   */
  runCustomValidationRules(config) {
    for (const [name, rule] of this.validationRules) {
      try {
        rule.validate(config);
      } catch (error) {
        throw new Error(`Custom validation rule '${name}' failed: ${error.message}`);
      }
    }
  }
  
  // Utility validation methods
  
  validateType(value, expectedType, fieldName) {
    if (this.config.validateTypes) {
      try {
        this.typeValidators.get(expectedType)(value);
      } catch (error) {
        throw new Error(`${fieldName}: ${error.message}`);
      }
    }
  }
  
  validateRequiredString(obj, key, fieldName) {
    if (!obj[key] || typeof obj[key] !== 'string') {
      throw new Error(`${fieldName} is required and must be a non-empty string`);
    }
    
    if (obj[key].trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty or whitespace only`);
    }
  }
  
  validateRange(value, min, max, fieldName) {
    if (this.config.validateRanges) {
      if (value < min || value > max) {
        throw new Error(`${fieldName} must be between ${min} and ${max}, got: ${value}`);
      }
    }
  }
  
  validateMinLength(value, minLength, fieldName) {
    if (value.length < minLength) {
      throw new Error(`${fieldName} must be at least ${minLength} characters long`);
    }
  }
  
  validateArrayOfStrings(array, fieldName) {
    this.validateType(array, 'array', fieldName);
    
    for (let i = 0; i < array.length; i++) {
      if (typeof array[i] !== 'string') {
        throw new Error(`${fieldName}[${i}] must be a string, got ${typeof array[i]}`);
      }
    }
  }
  
  /**
   * Add custom validation rule
   */
  addValidationRule(name, rule) {
    if (!name || typeof name !== 'string') {
      throw new Error('Rule name must be a non-empty string');
    }
    
    if (!rule || typeof rule !== 'object' || typeof rule.validate !== 'function') {
      throw new Error('Rule must be an object with a validate function');
    }
    
    this.validationRules.set(name, rule);
    
    this.emit('rule-added', { name, rule });
    
    if (this.config.enableLogging) {
      consola.info(`📋 Added custom validation rule: ${name}`);
    }
  }
  
  /**
   * Remove validation rule
   */
  removeValidationRule(name) {
    const removed = this.validationRules.delete(name);
    
    if (removed) {
      this.emit('rule-removed', { name });
      
      if (this.config.enableLogging) {
        consola.info(`🗑️ Removed validation rule: ${name}`);
      }
    }
    
    return removed;
  }
  
  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0 
        ? (this.validationStats.successfulValidations / this.validationStats.totalValidations) * 100 
        : 0,
      customRules: this.validationRules.size,
      typeValidators: this.typeValidators.size,
      formatValidators: this.formatValidators.size
    };
  }
  
  updateAverageValidationTime(validationTime) {
    this.validationStats.averageValidationTime = 
      (this.validationStats.averageValidationTime + validationTime) / 2;
  }
  
  /**
   * Load configuration from file and validate
   */
  async loadAndValidateConfig(configPath) {
    try {
      if (!await fs.pathExists(configPath)) {
        throw new Error(`Configuration file does not exist: ${configPath}`);
      }
      
      const configContent = await fs.readFile(configPath, 'utf8');
      let config;
      
      try {
        config = JSON.parse(configContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON in configuration file: ${parseError.message}`);
      }
      
      return this.validateConfig(config);
      
    } catch (error) {
      if (this.config.enableLogging) {
        consola.error(`❌ Failed to load and validate config from ${configPath}:`, error.message);
      }
      throw error;
    }
  }
  
  /**
   * Validate configuration schema
   */
  validateSchema(config, schema) {
    // Basic schema validation implementation
    // In a full implementation, this would use a schema validation library like Joi or Yup
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }
    
    for (const [key, schemaValue] of Object.entries(schema)) {
      if (schemaValue.required && config[key] === undefined) {
        throw new Error(`Required field '${key}' is missing`);
      }
      
      if (config[key] !== undefined) {
        if (schemaValue.type) {
          this.validateType(config[key], schemaValue.type, key);
        }
        
        if (schemaValue.format && this.formatValidators.has(schemaValue.format)) {
          try {
            this.formatValidators.get(schemaValue.format)(config[key]);
          } catch (error) {
            throw new Error(`${key}: ${error.message}`);
          }
        }
        
        if (schemaValue.min !== undefined && typeof config[key] === 'number') {
          if (config[key] < schemaValue.min) {
            throw new Error(`${key} must be at least ${schemaValue.min}, got ${config[key]}`);
          }
        }
        
        if (schemaValue.max !== undefined && typeof config[key] === 'number') {
          if (config[key] > schemaValue.max) {
            throw new Error(`${key} must be at most ${schemaValue.max}, got ${config[key]}`);
          }
        }
        
        if (schemaValue.enum && !schemaValue.enum.includes(config[key])) {
          throw new Error(`${key} must be one of: ${schemaValue.enum.join(', ')}, got ${config[key]}`);
        }
      }
    }
    
    return config;
  }
}

// Export the comprehensive validator
export { ConfigurationValidator as ValidationEngine };
export default ConfigurationValidator;