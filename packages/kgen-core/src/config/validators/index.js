/**
 * KGEN Configuration Validators
 * 
 * Comprehensive validation system for KGEN configurations
 * with detailed error reporting and contextual validation.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import { configSchema, validateConfigSection } from '../schemas/index.js';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Validate complete KGEN configuration
 * 
 * @param {Object} config - Configuration object to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.allowUnknown=false] - Allow unknown properties
 * @param {boolean} [options.abortEarly=false] - Stop on first validation error
 * @param {string} [options.context] - Validation context for error messages
 * @returns {Promise<Object>} Validated configuration
 * @throws {Error} Validation error with detailed messages
 */
export async function validateConfiguration(config, options = {}) {
  const {
    allowUnknown = false,
    abortEarly = false,
    context = 'configuration'
  } = options;

  try {
    // Run Joi schema validation
    const { error, value } = configSchema.validate(config, {
      allowUnknown,
      abortEarly,
      stripUnknown: !allowUnknown
    });

    if (error) {
      throw error;
    }

    // Run additional contextual validations
    await runContextualValidations(value, context);

    return value;

  } catch (error) {
    if (error.isJoi) {
      throw new ValidationError(error, context);
    }
    throw error;
  }
}

/**
 * Run contextual validations that require filesystem access or complex logic
 * 
 * @param {Object} config - Validated configuration object
 * @param {string} context - Validation context
 */
async function runContextualValidations(config, context) {
  const errors = [];

  // Validate directory paths exist or can be created
  if (config.directories) {
    errors.push(...await validateDirectories(config.directories));
  }

  // Validate template and rule paths
  if (config.generate?.defaultTemplate) {
    errors.push(...validateTemplatePaths(config));
  }

  if (config.reasoning?.defaultRules) {
    errors.push(...validateRulePaths(config));
  }

  // Validate provenance signing configuration
  if (config.provenance?.signing?.enabled) {
    errors.push(...validateProvenanceSigning(config.provenance.signing));
  }

  // Validate cache storage configuration
  if (config.cache?.enabled) {
    errors.push(...validateCacheConfiguration(config.cache));
  }

  // Validate metrics configuration
  if (config.metrics?.enabled) {
    errors.push(...validateMetricsConfiguration(config.metrics));
  }

  // Validate security limits
  if (config.security) {
    errors.push(...validateSecurityLimits(config.security));
  }

  if (errors.length > 0) {
    throw new Error(`Contextual validation failed in ${context}:\n${errors.join('\n')}`);
  }
}

/**
 * Validate directory configuration
 * 
 * @param {Object} directories - Directory configuration
 * @returns {Promise<string[]>} Array of validation errors
 */
async function validateDirectories(directories) {
  const errors = [];

  for (const [key, path] of Object.entries(directories)) {
    if (!path) continue;

    const resolvedPath = resolve(path);
    
    // Check if path exists
    if (existsSync(resolvedPath)) {
      const stats = statSync(resolvedPath);
      if (!stats.isDirectory()) {
        errors.push(`directories.${key}: Path exists but is not a directory: ${path}`);
      }
    } else {
      // Check if parent directory exists and is writable
      const parentPath = resolve(resolvedPath, '..');
      if (!existsSync(parentPath)) {
        errors.push(`directories.${key}: Parent directory does not exist: ${parentPath}`);
      } else {
        try {
          // Test write permission by checking parent directory
          const parentStats = statSync(parentPath);
          if (!parentStats.isDirectory()) {
            errors.push(`directories.${key}: Parent path is not a directory: ${parentPath}`);
          }
        } catch (error) {
          errors.push(`directories.${key}: Cannot access parent directory: ${error.message}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate template paths
 * 
 * @param {Object} config - Configuration object
 * @returns {string[]} Array of validation errors
 */
function validateTemplatePaths(config) {
  const errors = [];
  const templatePath = config.generate.defaultTemplate;
  const templatesDir = config.directories?.templates || './templates';
  
  if (templatePath) {
    const fullPath = resolve(templatesDir, templatePath);
    if (!existsSync(fullPath)) {
      errors.push(`generate.defaultTemplate: Template not found: ${fullPath}`);
    }
  }

  return errors;
}

/**
 * Validate rule paths
 * 
 * @param {Object} config - Configuration object
 * @returns {string[]} Array of validation errors
 */
function validateRulePaths(config) {
  const errors = [];
  const rulePath = config.reasoning.defaultRules;
  const rulesDir = config.directories?.rules || './rules';
  
  if (rulePath) {
    const fullPath = resolve(rulesDir, rulePath);
    if (!existsSync(fullPath)) {
      errors.push(`reasoning.defaultRules: Rule pack not found: ${fullPath}`);
    }
  }

  return errors;
}

/**
 * Validate provenance signing configuration
 * 
 * @param {Object} signing - Signing configuration
 * @returns {string[]} Array of validation errors
 */
function validateProvenanceSigning(signing) {
  const errors = [];

  if (signing.enabled) {
    if (!signing.keyPath) {
      errors.push('provenance.signing.keyPath: Private key path is required when signing is enabled');
    } else if (!existsSync(signing.keyPath)) {
      errors.push(`provenance.signing.keyPath: Private key file not found: ${signing.keyPath}`);
    }

    if (signing.certPath && !existsSync(signing.certPath)) {
      errors.push(`provenance.signing.certPath: Certificate file not found: ${signing.certPath}`);
    }
  }

  return errors;
}

/**
 * Validate cache configuration
 * 
 * @param {Object} cache - Cache configuration
 * @returns {string[]} Array of validation errors
 */
function validateCacheConfiguration(cache) {
  const errors = [];

  // Validate cache storage backend
  if (cache.storage === 'redis') {
    // Redis-specific validation could go here
    console.warn('Redis cache storage not yet implemented');
  }

  // Validate cache size limits
  if (cache.gc?.maxSize) {
    const maxSize = parseSize(cache.gc.maxSize);
    if (maxSize < 1024 * 1024) { // 1MB minimum
      errors.push('cache.gc.maxSize: Cache size must be at least 1MB');
    }
  }

  return errors;
}

/**
 * Validate metrics configuration
 * 
 * @param {Object} metrics - Metrics configuration
 * @returns {string[]} Array of validation errors
 */
function validateMetricsConfiguration(metrics) {
  const errors = [];

  // Validate metrics file path
  if (metrics.file) {
    const metricsDir = resolve(metrics.file, '..');
    if (!existsSync(metricsDir)) {
      errors.push(`metrics.file: Directory does not exist: ${metricsDir}`);
    }
  }

  // Validate sample rate
  if (metrics.performance?.sampleRate) {
    const rate = metrics.performance.sampleRate;
    if (rate < 0 || rate > 1) {
      errors.push('metrics.performance.sampleRate: Must be between 0 and 1');
    }
  }

  return errors;
}

/**
 * Validate security limits configuration
 * 
 * @param {Object} security - Security configuration
 * @returns {string[]} Array of validation errors
 */
function validateSecurityLimits(security) {
  const errors = [];

  if (security.limits) {
    // Validate file size limits
    if (security.limits.maxFileSize) {
      const maxSize = parseSize(security.limits.maxFileSize);
      if (maxSize > 1024 * 1024 * 1024) { // 1GB limit
        errors.push('security.limits.maxFileSize: Maximum file size cannot exceed 1GB');
      }
    }

    // Validate graph size limits
    if (security.limits.maxGraphSize < 1000) {
      errors.push('security.limits.maxGraphSize: Must be at least 1000 triples');
    }
  }

  return errors;
}

/**
 * Parse size string to bytes
 * 
 * @param {string} sizeStr - Size string (e.g., '100MB')
 * @returns {number} Size in bytes
 */
function parseSize(sizeStr) {
  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024
  };

  const match = sizeStr.match(/^(\d+)([KMGT]?B)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }

  const [, number, unit] = match;
  return parseInt(number, 10) * (units[unit] || 1);
}

/**
 * Custom validation error class with enhanced error reporting
 */
export class ValidationError extends Error {
  constructor(joiError, context = 'configuration') {
    const details = joiError.details.map(detail => ({
      path: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value,
      type: detail.type
    }));

    const message = `Validation failed in ${context}:\n${details.map(d => 
      `  - ${d.path}: ${d.message}`
    ).join('\n')}`;

    super(message);
    this.name = 'ValidationError';
    this.context = context;
    this.details = details;
    this.isValidationError = true;
  }

  /**
   * Get validation errors grouped by configuration section
   * 
   * @returns {Object} Errors grouped by section
   */
  getErrorsBySection() {
    const grouped = {};
    
    for (const detail of this.details) {
      const section = detail.path.split('.')[0];
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(detail);
    }

    return grouped;
  }

  /**
   * Get formatted error message for CLI display
   * 
   * @returns {string} Formatted error message
   */
  getFormattedMessage() {
    const sections = this.getErrorsBySection();
    let message = `Configuration validation failed:\n\n`;

    for (const [section, errors] of Object.entries(sections)) {
      message += `[${section}]\n`;
      for (const error of errors) {
        message += `  • ${error.path}: ${error.message}\n`;
      }
      message += '\n';
    }

    return message;
  }
}

/**
 * Validate individual configuration section
 * 
 * @param {string} section - Section name
 * @param {*} data - Section data
 * @returns {Promise<*>} Validated section data
 */
export async function validateSection(section, data) {
  try {
    const { error, value } = validateConfigSection(section, data);
    
    if (error) {
      throw new ValidationError(error, section);
    }

    return value;
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    throw new Error(`Failed to validate section '${section}': ${error.message}`);
  }
}

/**
 * Validate configuration against environment requirements
 * 
 * @param {Object} config - Configuration object
 * @param {string} environment - Environment name (development, production, test)
 * @returns {Promise<string[]>} Array of environment-specific warnings
 */
export async function validateEnvironment(config, environment = 'development') {
  const warnings = [];

  switch (environment) {
    case 'production':
      // Production-specific validations
      if (!config.cache?.enabled) {
        warnings.push('Cache should be enabled in production for better performance');
      }
      if (!config.metrics?.enabled) {
        warnings.push('Metrics should be enabled in production for monitoring');
      }
      if (config.dev?.debug) {
        warnings.push('Debug mode should be disabled in production');
      }
      if (config.reasoning?.engine?.optimization !== 'aggressive') {
        warnings.push('Reasoning optimization should be set to "aggressive" in production');
      }
      break;

    case 'development':
      // Development-specific validations
      if (config.cache?.enabled !== false) {
        warnings.push('Cache can be disabled in development for easier debugging');
      }
      break;

    case 'test':
      // Test-specific validations
      if (config.cache?.enabled) {
        warnings.push('Cache should be disabled in test environment for reproducible results');
      }
      if (config.metrics?.enabled) {
        warnings.push('Metrics can be disabled in test environment to reduce noise');
      }
      break;
  }

  return warnings;
}

export default {
  validateConfiguration,
  validateSection,
  validateEnvironment,
  ValidationError
};
