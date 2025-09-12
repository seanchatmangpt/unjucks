/**
 * KGEN Configuration Validator
 * Advanced validation logic for KGEN configurations
 */

import { validateConfig as schemaValidate } from './schema.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Comprehensive configuration validator
 * @param {Object} config - Configuration to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateConfig(config, options = {}) {
  const {
    checkPaths = true,
    checkPermissions = true,
    validateTemplates = true,
    validateRules = true
  } = options;

  // First run schema validation
  const schemaResult = schemaValidate(config);
  if (!schemaResult.success) {
    return schemaResult;
  }

  const errors = [];
  const warnings = [];

  // Path validation
  if (checkPaths) {
    const pathErrors = await validatePaths(config.directories);
    errors.push(...pathErrors);
  }

  // Permission validation
  if (checkPermissions) {
    const permissionErrors = await validatePermissions(config.directories);
    errors.push(...permissionErrors);
  }

  // Template directory validation
  if (validateTemplates) {
    const templateErrors = await validateTemplateDirectory(config.directories.templates);
    errors.push(...templateErrors);
  }

  // Rules directory validation
  if (validateRules) {
    const ruleErrors = await validateRulesDirectory(config.directories.rules, config.reasoning.defaultRules);
    errors.push(...ruleErrors);
  }

  // Cross-section validation
  const crossSectionErrors = validateCrossSections(config);
  errors.push(...crossSectionErrors);

  // Performance validation
  const performanceWarnings = validatePerformance(config);
  warnings.push(...performanceWarnings);

  // Security validation
  const securityErrors = validateSecurity(config);
  errors.push(...securityErrors);

  return {
    success: errors.length === 0,
    data: config,
    errors,
    warnings
  };
}

/**
 * Validate directory paths exist and are accessible
 * @private
 */
async function validatePaths(directories) {
  const errors = [];
  
  for (const [name, path] of Object.entries(directories)) {
    if (!path || typeof path !== 'string') {
      errors.push({
        path: `directories.${name}`,
        message: `Directory path must be a non-empty string`,
        code: 'INVALID_PATH'
      });
      continue;
    }

    const resolvedPath = resolve(path);
    
    // Check if path is safe (not outside project)
    if (resolvedPath.includes('..')) {
      errors.push({
        path: `directories.${name}`,
        message: `Directory path cannot contain '..' for security reasons`,
        code: 'UNSAFE_PATH'
      });
    }
  }

  return errors;
}

/**
 * Validate directory permissions
 * @private
 */
async function validatePermissions(directories) {
  const errors = [];
  const { access, constants } = await import('node:fs/promises');

  for (const [name, path] of Object.entries(directories)) {
    if (!path) continue;

    const resolvedPath = resolve(path);
    
    if (existsSync(resolvedPath)) {
      try {
        // Check read permission
        await access(resolvedPath, constants.R_OK);
        
        // Check write permission for output directories
        if (['out', 'state', 'cache'].includes(name)) {
          await access(resolvedPath, constants.W_OK);
        }
      } catch (error) {
        errors.push({
          path: `directories.${name}`,
          message: `Insufficient permissions for directory: ${error.message}`,
          code: 'PERMISSION_ERROR'
        });
      }
    }
  }

  return errors;
}

/**
 * Validate template directory structure
 * @private
 */
async function validateTemplateDirectory(templatePath) {
  const errors = [];
  
  if (!templatePath || !existsSync(resolve(templatePath))) {
    return errors; // Skip validation if directory doesn't exist
  }

  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(resolve(templatePath), { withFileTypes: true });
    
    const templates = entries.filter(entry => entry.isDirectory());
    
    if (templates.length === 0) {
      errors.push({
        path: 'directories.templates',
        message: 'Templates directory exists but contains no template subdirectories',
        code: 'NO_TEMPLATES'
      });
    }

    // Validate each template directory has required files
    for (const template of templates) {
      const templateDir = resolve(templatePath, template.name);
      const templateFiles = await readdir(templateDir);
      
      const hasConfig = templateFiles.some(file => file.startsWith('template.') && 
        (file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')));
      
      if (!hasConfig) {
        errors.push({
          path: `directories.templates.${template.name}`,
          message: `Template '${template.name}' missing configuration file (template.json/yaml/yml)`,
          code: 'MISSING_TEMPLATE_CONFIG'
        });
      }
    }
  } catch (error) {
    errors.push({
      path: 'directories.templates',
      message: `Error validating templates directory: ${error.message}`,
      code: 'TEMPLATE_VALIDATION_ERROR'
    });
  }

  return errors;
}

/**
 * Validate rules directory and default rules
 * @private
 */
async function validateRulesDirectory(rulesPath, defaultRules) {
  const errors = [];
  
  if (!rulesPath || !existsSync(resolve(rulesPath))) {
    if (defaultRules.length > 0) {
      errors.push({
        path: 'directories.rules',
        message: 'Rules directory is required when default rules are specified',
        code: 'MISSING_RULES_DIR'
      });
    }
    return errors;
  }

  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(resolve(rulesPath));
    const ruleFiles = entries.filter(file => file.endsWith('.ttl') || file.endsWith('.n3') || file.endsWith('.rdf'));
    
    // Check if default rules exist
    for (const ruleName of defaultRules) {
      const ruleFile = ruleFiles.find(file => file.startsWith(ruleName + '.'));
      if (!ruleFile) {
        errors.push({
          path: 'reasoning.defaultRules',
          message: `Default rule '${ruleName}' not found in rules directory`,
          code: 'MISSING_DEFAULT_RULE'
        });
      }
    }
  } catch (error) {
    errors.push({
      path: 'directories.rules',
      message: `Error validating rules directory: ${error.message}`,
      code: 'RULES_VALIDATION_ERROR'
    });
  }

  return errors;
}

/**
 * Validate cross-section configuration consistency
 * @private
 */
function validateCrossSections(config) {
  const errors = [];

  // If provenance is disabled, attestByDefault should be false
  if (!config.provenance.generateAttestation && config.generate.attestByDefault) {
    errors.push({
      path: 'generate.attestByDefault',
      message: 'Cannot attest by default when provenance attestation is disabled',
      code: 'INCONSISTENT_ATTESTATION'
    });
  }

  // If cache is disabled, gc settings are meaningless
  if (!config.cache.enabled && config.cache.gcInterval > 0) {
    errors.push({
      path: 'cache.gcInterval',
      message: 'Cache GC interval is ignored when cache is disabled',
      code: 'MEANINGLESS_CACHE_GC'
    });
  }

  // If reasoning is disabled, defaultRules should be empty
  if (!config.reasoning.enabled && config.reasoning.defaultRules.length > 0) {
    errors.push({
      path: 'reasoning.defaultRules',
      message: 'Default rules specified but reasoning is disabled',
      code: 'UNUSED_REASONING_RULES'
    });
  }

  // Validate memory settings consistency
  const securityMemory = parseInt(config.security.maxMemory);
  const cacheSize = parseInt(config.cache.maxSize);
  
  if (cacheSize >= securityMemory) {
    errors.push({
      path: 'cache.maxSize',
      message: 'Cache max size should be smaller than security memory limit',
      code: 'CACHE_MEMORY_CONFLICT'
    });
  }

  return errors;
}

/**
 * Validate performance-related settings
 * @private
 */
function validatePerformance(config) {
  const warnings = [];

  // High concurrency warning
  if (config.generate.maxConcurrency > 16) {
    warnings.push({
      path: 'generate.maxConcurrency',
      message: 'Very high concurrency may cause resource exhaustion',
      code: 'HIGH_CONCURRENCY_WARNING'
    });
  }

  // Low cache TTL warning
  if (config.cache.enabled && config.cache.ttl < 60000) {
    warnings.push({
      path: 'cache.ttl',
      message: 'Very low cache TTL may reduce performance benefits',
      code: 'LOW_CACHE_TTL_WARNING'
    });
  }

  // Frequent GC warning
  if (config.cache.enabled && config.cache.gcInterval < 30000) {
    warnings.push({
      path: 'cache.gcInterval',
      message: 'Frequent cache GC may impact performance',
      code: 'FREQUENT_GC_WARNING'
    });
  }

  return warnings;
}

/**
 * Validate security settings
 * @private
 */
function validateSecurity(config) {
  const errors = [];

  // Validate allowed modules patterns
  const dangerousPatterns = ['*', '**', 'child_process', 'fs', 'path'];
  const allowedModules = config.security.allowedModules;
  
  for (const pattern of dangerousPatterns) {
    if (allowedModules.includes(pattern)) {
      errors.push({
        path: 'security.allowedModules',
        message: `Potentially dangerous module pattern allowed: '${pattern}'`,
        code: 'DANGEROUS_MODULE_PATTERN'
      });
    }
  }

  // Validate memory limit format
  const memoryRegex = /^\\d+[KMGT]?B$/i;
  if (!memoryRegex.test(config.security.maxMemory)) {
    errors.push({
      path: 'security.maxMemory',
      message: 'Invalid memory limit format (use format like "512MB")',
      code: 'INVALID_MEMORY_FORMAT'
    });
  }

  // Sandbox disabled warning
  if (!config.security.sandbox) {
    errors.push({
      path: 'security.sandbox',
      message: 'Sandbox disabled - this reduces security',
      code: 'SANDBOX_DISABLED'
    });
  }

  return errors;
}

/**
 * Create validation report
 * @param {Object} result - Validation result
 * @returns {string} Human-readable validation report
 */
export function createValidationReport(result) {
  let report = '# KGEN Configuration Validation Report\\n\\n';
  
  if (result.success) {
    report += '✅ **Configuration is valid**\\n\\n';
  } else {
    report += '❌ **Configuration has errors**\\n\\n';
  }

  if (result.errors && result.errors.length > 0) {
    report += '## Errors\\n\\n';
    for (const error of result.errors) {
      report += `- **${error.path}**: ${error.message} (${error.code})\\n`;
    }
    report += '\\n';
  }

  if (result.warnings && result.warnings.length > 0) {
    report += '## Warnings\\n\\n';
    for (const warning of result.warnings) {
      report += `- **${warning.path}**: ${warning.message} (${warning.code})\\n`;
    }
    report += '\\n';
  }

  if (result.success && (!result.errors || result.errors.length === 0) && 
      (!result.warnings || result.warnings.length === 0)) {
    report += 'No issues found. Configuration is ready for use.\\n';
  }

  return report;
}