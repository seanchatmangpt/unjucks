/**
 * Validation engine for Office document templates
 * 
 * This module provides comprehensive validation capabilities for template processing,
 * including data validation, template structure validation, and custom validation rules.
 * 
 * @module office/utils/validation-engine
 * @version 1.0.0
 */

import { ErrorSeverity } from '../core/types.js';

/**
 * Validation engine for template processing
 * 
 * Provides comprehensive validation for templates, data, and processing contexts.
 * Supports custom validation rules and extensible validation patterns.
 */
export class ValidationEngine {
  /**
   * Creates a new validation engine
   * 
   * @param {ValidationOptions} [options={}] - Validation options
   */
  constructor(options = {}) {
    /** @type {ValidationOptions} */
    this.options = {
      enabled: true,
      failFast: false,
      level: 'moderate',
      validators: [],
      ...options
    };

    /** @type {Map<string, ValidationFunction>} */
    this.customValidators = new Map();

    // Register built-in validators
    this.registerBuiltInValidators();
  }

  /**
   * Validates input data against template requirements
   * 
   * @param {Object} data - Input data to validate
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter with validation rules
   * @param {ProcessingContext} [context] - Processing context
   * @returns {Promise<ValidationResult>} Promise resolving to validation result
   */
  async validateData(data, frontmatter, context) {
    if (!this.options.enabled) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors = [];
    const warnings = [];

    try {
      // Validate against frontmatter variables
      if (frontmatter?.variables) {
        const variableValidation = await this.validateVariables(data, frontmatter.variables);
        errors.push(...variableValidation.errors);
        warnings.push(...variableValidation.warnings);
      }

      // Run custom validators
      for (const validator of this.options.validators || []) {
        try {
          const result = await validator.fn(data, context);
          if (!result.valid) {
            errors.push(...result.errors);
            warnings.push(...result.warnings);
          }
        } catch (error) {
          errors.push({
            message: `Custom validator '${validator.name}' failed: ${error.message}`,
            code: 'CUSTOM_VALIDATOR_ERROR',
            severity: ErrorSeverity.ERROR,
            field: validator.name
          });
        }
      }

      // Schema validation if provided
      if (frontmatter?.validation?.schema) {
        const schemaValidation = await this.validateSchema(data, frontmatter.validation.schema);
        errors.push(...schemaValidation.errors);
        warnings.push(...schemaValidation.warnings);
      }

    } catch (error) {
      errors.push({
        message: `Data validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates variables against their definitions
   * 
   * @param {Object} data - Input data
   * @param {TemplateVariable[]} variables - Variable definitions
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validateVariables(data, variables) {
    const errors = [];
    const warnings = [];

    for (const variable of variables) {
      const value = this.getNestedValue(data, variable.name);

      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push({
          message: `Required variable '${variable.name}' is missing or empty`,
          code: 'MISSING_REQUIRED_VARIABLE',
          field: variable.name,
          severity: ErrorSeverity.ERROR
        });
        continue;
      }

      // Skip validation if value is not provided and variable is not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateVariableType(value, variable.type)) {
        errors.push({
          message: `Variable '${variable.name}' expected type ${variable.type} but got ${typeof value}`,
          code: 'INVALID_VARIABLE_TYPE',
          field: variable.name,
          severity: ErrorSeverity.ERROR
        });
      }

      // Custom validation
      if (variable.validation) {
        const validationResult = this.runCustomValidation(value, variable.validation);
        if (validationResult) {
          errors.push({
            message: `Variable '${variable.name}' validation failed: ${validationResult}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            field: variable.name,
            severity: ErrorSeverity.ERROR
          });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates data against a JSON schema
   * 
   * @param {Object} data - Data to validate
   * @param {Object} schema - JSON schema
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validateSchema(data, schema) {
    // Basic schema validation implementation
    // In a real implementation, you might use libraries like ajv
    const errors = [];
    const warnings = [];

    try {
      // Simple schema validation - in practice you'd use a proper JSON schema validator
      if (schema.type && typeof data !== schema.type) {
        errors.push({
          message: `Data type mismatch: expected ${schema.type}, got ${typeof data}`,
          code: 'SCHEMA_TYPE_MISMATCH',
          severity: ErrorSeverity.ERROR
        });
      }

      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in data)) {
            errors.push({
              message: `Required field '${requiredField}' is missing`,
              code: 'SCHEMA_REQUIRED_FIELD_MISSING',
              field: requiredField,
              severity: ErrorSeverity.ERROR
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        message: `Schema validation error: ${error.message}`,
        code: 'SCHEMA_VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates value against expected type
   * 
   * @param {*} value - Value to validate
   * @param {string} expectedType - Expected type
   * @returns {boolean} Whether value matches type
   */
  validateVariableType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Runs custom validation for a variable
   * 
   * @param {*} value - Value to validate
   * @param {VariableValidation} validation - Validation rules
   * @returns {string|null} Error message or null if valid
   */
  runCustomValidation(value, validation) {
    // Min/max validation
    if (validation.min !== undefined) {
      if (typeof value === 'number' && value < validation.min) {
        return `Value ${value} is less than minimum ${validation.min}`;
      }
      if (typeof value === 'string' && value.length < validation.min) {
        return `Text length ${value.length} is less than minimum ${validation.min}`;
      }
    }

    if (validation.max !== undefined) {
      if (typeof value === 'number' && value > validation.max) {
        return `Value ${value} is greater than maximum ${validation.max}`;
      }
      if (typeof value === 'string' && value.length > validation.max) {
        return `Text length ${value.length} is greater than maximum ${validation.max}`;
      }
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return 'Value does not match required pattern';
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      return `Value must be one of: ${validation.enum.join(', ')}`;
    }

    // Custom function validation
    if (validation.custom && typeof validation.custom === 'function') {
      const result = validation.custom(value);
      if (typeof result === 'string') {
        return result;
      }
      if (result === false) {
        return 'Custom validation failed';
      }
    }

    return null;
  }

  /**
   * Gets nested value from object using dot notation
   * 
   * @param {*} obj - Object to search in
   * @param {string} path - Dot-separated path
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Registers a custom validator
   * 
   * @param {ValidationFunction} validator - Validator to register
   */
  registerValidator(validator) {
    this.customValidators.set(validator.name, validator);
  }

  /**
   * Unregisters a custom validator
   * 
   * @param {string} validatorName - Name of validator to unregister
   */
  unregisterValidator(validatorName) {
    this.customValidators.delete(validatorName);
  }

  /**
   * Gets registered custom validators
   * 
   * @returns {ValidationFunction[]} Array of custom validators
   */
  getCustomValidators() {
    return Array.from(this.customValidators.values());
  }

  /**
   * Registers built-in validators
   * @private
   */
  registerBuiltInValidators() {
    // Email validator
    this.registerValidator({
      name: 'email',
      description: 'Validates email addresses',
      fn: async (data) => {
        const errors = [];
        const warnings = [];
        
        if (typeof data === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(data)) {
            errors.push({
              message: 'Invalid email format',
              code: 'INVALID_EMAIL',
              severity: ErrorSeverity.ERROR
            });
          }
        }
        
        return { valid: errors.length === 0, errors, warnings };
      }
    });

    // URL validator
    this.registerValidator({
      name: 'url',
      description: 'Validates URLs',
      fn: async (data) => {
        const errors = [];
        const warnings = [];
        
        if (typeof data === 'string') {
          try {
            new URL(data);
          } catch {
            errors.push({
              message: 'Invalid URL format',
              code: 'INVALID_URL',
              severity: ErrorSeverity.ERROR
            });
          }
        }
        
        return { valid: errors.length === 0, errors, warnings };
      }
    });

    // Date validator
    this.registerValidator({
      name: 'date',
      description: 'Validates date formats',
      fn: async (data) => {
        const errors = [];
        const warnings = [];
        
        if (typeof data === 'string') {
          const date = new Date(data);
          if (isNaN(date.getTime())) {
            errors.push({
              message: 'Invalid date format',
              code: 'INVALID_DATE',
              severity: ErrorSeverity.ERROR
            });
          }
        }
        
        return { valid: errors.length === 0, errors, warnings };
      }
    });
  }
}