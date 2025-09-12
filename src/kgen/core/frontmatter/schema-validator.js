/**
 * KGEN Schema Validator
 * 
 * Validates frontmatter against predefined schemas for deterministic error reporting.
 * Supports custom validation rules, schema inheritance, and comprehensive error context.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';

export class SchemaValidator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableStrictMode: false,
      enableSchemaInheritance: true,
      maxValidationTime: 5000,
      enableCustomValidators: true,
      cacheValidationResults: true,
      ...options
    };
    
    this.logger = new Consola({ tag: 'kgen-schema-validator' });
    this.schemas = new Map();
    this.customValidators = new Map();
    this.validationCache = new Map();
    
    this._initializeDefaultSchemas();
  }

  /**
   * Initialize the schema validator
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN schema validator...');
      
      // Load built-in schemas
      this._loadBuiltinSchemas();
      
      // Load custom validators
      this._loadCustomValidators();
      
      this.emit('validator:ready');
      this.logger.success('KGEN schema validator initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize schema validator:', error);
      throw error;
    }
  }

  /**
   * Validate frontmatter against schema
   * @param {Object} frontmatter - Frontmatter to validate
   * @param {string} schemaName - Schema name or 'default'
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(frontmatter, schemaName = 'default', options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Generate cache key
      const cacheKey = this._generateCacheKey(frontmatter, schemaName, options);
      
      // Check cache if enabled
      if (this.options.cacheValidationResults && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey);
        return {
          ...cached,
          validationMetadata: {
            ...cached.validationMetadata,
            cacheHit: true
          }
        };
      }
      
      // Get schema
      const schema = this._getSchema(schemaName);
      if (!schema) {
        return {
          valid: false,
          errors: [`Schema not found: ${schemaName}`],
          warnings: [],
          validationMetadata: {
            validationTime: this.getDeterministicTimestamp() - startTime,
            schemaName,
            cacheHit: false
          }
        };
      }
      
      // Perform validation
      const validationResult = await this._validateAgainstSchema(frontmatter, schema, options);
      
      // Add metadata
      const result = {
        ...validationResult,
        validationMetadata: {
          validationTime: this.getDeterministicTimestamp() - startTime,
          schemaName,
          schemaVersion: schema.version || '1.0.0',
          cacheHit: false
        }
      };
      
      // Cache result
      if (this.options.cacheValidationResults) {
        this.validationCache.set(cacheKey, result);
      }
      
      // Emit validation event
      this.emit('validation:complete', {
        schemaName,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });
      
      return result;
      
    } catch (error) {
      const errorResult = {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        validationMetadata: {
          validationTime: this.getDeterministicTimestamp() - startTime,
          schemaName,
          cacheHit: false,
          error: error.message
        }
      };
      
      this.emit('validation:error', { schemaName, error });
      
      return errorResult;
    }
  }

  /**
   * Register custom schema
   * @param {string} name - Schema name
   * @param {Object} schema - Schema definition
   */
  registerSchema(name, schema) {
    // Validate schema definition
    const schemaValidation = this._validateSchemaDefinition(schema);
    if (!schemaValidation.valid) {
      throw new Error(`Invalid schema definition for ${name}: ${schemaValidation.errors.join(', ')}`);
    }
    
    this.schemas.set(name, {
      ...schema,
      name,
      registeredAt: this.getDeterministicDate()
    });
    
    this.emit('schema:registered', { name, schema });
    this.logger.info(`Registered schema: ${name}`);
  }

  /**
   * Register custom validator function
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }
    
    this.customValidators.set(name, validator);
    this.emit('validator:registered', { name });
    this.logger.info(`Registered custom validator: ${name}`);
  }

  /**
   * Get schema by name
   * @param {string} name - Schema name
   * @returns {Object|null} Schema or null if not found
   */
  _getSchema(name) {
    return this.schemas.get(name) || null;
  }

  /**
   * Validate frontmatter against schema
   * @param {Object} frontmatter - Frontmatter to validate
   * @param {Object} schema - Schema definition
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async _validateAgainstSchema(frontmatter, schema, options = {}) {
    const errors = [];
    const warnings = [];
    const context = {
      path: [],
      strictMode: this.options.enableStrictMode || options.strictMode,
      ...options
    };
    
    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in frontmatter)) {
          errors.push({
            code: 'REQUIRED_FIELD_MISSING',
            message: `Required field missing: ${field}`,
            path: [field],
            severity: 'error'
          });
        }
      }
    }
    
    // Validate field definitions
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        const fieldValue = frontmatter[fieldName];
        const fieldPath = [...context.path, fieldName];
        
        // Skip validation if field is not present and not required
        if (fieldValue === undefined) {
          continue;
        }
        
        const fieldValidation = await this._validateField(
          fieldValue,
          fieldSchema,
          { ...context, path: fieldPath }
        );
        
        errors.push(...fieldValidation.errors);
        warnings.push(...fieldValidation.warnings);
      }
    }
    
    // Check for unknown fields in strict mode
    if (context.strictMode && schema.additionalProperties === false) {
      const allowedFields = new Set([
        ...(schema.required || []),
        ...Object.keys(schema.properties || {})
      ]);
      
      for (const field of Object.keys(frontmatter)) {
        if (!allowedFields.has(field)) {
          warnings.push({
            code: 'UNKNOWN_FIELD',
            message: `Unknown field: ${field}`,
            path: [field],
            severity: 'warning'
          });
        }
      }
    }
    
    // Run custom validators
    if (schema.validators && this.options.enableCustomValidators) {
      for (const validatorName of schema.validators) {
        const validator = this.customValidators.get(validatorName);
        if (validator) {
          try {
            const customResult = await validator(frontmatter, context);
            if (customResult.errors) errors.push(...customResult.errors);
            if (customResult.warnings) warnings.push(...customResult.warnings);
          } catch (error) {
            errors.push({
              code: 'CUSTOM_VALIDATOR_ERROR',
              message: `Custom validator ${validatorName} failed: ${error.message}`,
              path: [],
              severity: 'error'
            });
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.map(err => typeof err === 'string' ? { message: err, severity: 'error' } : err),
      warnings: warnings.map(warn => typeof warn === 'string' ? { message: warn, severity: 'warning' } : warn)
    };
  }

  /**
   * Validate individual field
   * @param {*} value - Field value
   * @param {Object} fieldSchema - Field schema definition
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Field validation result
   */
  async _validateField(value, fieldSchema, context) {
    const errors = [];
    const warnings = [];
    
    // Type validation
    if (fieldSchema.type) {
      const typeValidation = this._validateType(value, fieldSchema.type, context);
      errors.push(...typeValidation.errors);
      warnings.push(...typeValidation.warnings);
    }
    
    // Enum validation
    if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
      if (!fieldSchema.enum.includes(value)) {
        errors.push({
          code: 'INVALID_ENUM_VALUE',
          message: `Value must be one of: ${fieldSchema.enum.join(', ')}`,
          path: context.path,
          severity: 'error',
          expected: fieldSchema.enum,
          actual: value
        });
      }
    }
    
    // String validations
    if (fieldSchema.type === 'string' && typeof value === 'string') {
      const stringValidation = this._validateString(value, fieldSchema, context);
      errors.push(...stringValidation.errors);
      warnings.push(...stringValidation.warnings);
    }
    
    // Number validations
    if ((fieldSchema.type === 'number' || fieldSchema.type === 'integer') && typeof value === 'number') {
      const numberValidation = this._validateNumber(value, fieldSchema, context);
      errors.push(...numberValidation.errors);
      warnings.push(...numberValidation.warnings);
    }
    
    // Array validations
    if (fieldSchema.type === 'array' && Array.isArray(value)) {
      const arrayValidation = await this._validateArray(value, fieldSchema, context);
      errors.push(...arrayValidation.errors);
      warnings.push(...arrayValidation.warnings);
    }
    
    // Object validations
    if (fieldSchema.type === 'object' && typeof value === 'object' && value !== null) {
      const objectValidation = await this._validateObject(value, fieldSchema, context);
      errors.push(...objectValidation.errors);
      warnings.push(...objectValidation.warnings);
    }
    
    // Custom field validators
    if (fieldSchema.validator && this.customValidators.has(fieldSchema.validator)) {
      try {
        const customResult = await this.customValidators.get(fieldSchema.validator)(value, context);
        if (customResult.errors) errors.push(...customResult.errors);
        if (customResult.warnings) warnings.push(...customResult.warnings);
      } catch (error) {
        errors.push({
          code: 'FIELD_VALIDATOR_ERROR',
          message: `Field validator failed: ${error.message}`,
          path: context.path,
          severity: 'error'
        });
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Validate type
   * @param {*} value - Value to validate
   * @param {string} expectedType - Expected type
   * @param {Object} context - Validation context
   * @returns {Object} Type validation result
   */
  _validateType(value, expectedType, context) {
    const errors = [];
    const warnings = [];
    
    const actualType = this._getValueType(value);
    
    if (actualType !== expectedType) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `Expected ${expectedType}, got ${actualType}`,
        path: context.path,
        severity: 'error',
        expected: expectedType,
        actual: actualType
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate string
   * @param {string} value - String value
   * @param {Object} schema - String schema
   * @param {Object} context - Validation context
   * @returns {Object} String validation result
   */
  _validateString(value, schema, context) {
    const errors = [];
    const warnings = [];
    
    // Length validations
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        code: 'STRING_TOO_SHORT',
        message: `String too short (${value.length} < ${schema.minLength})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        code: 'STRING_TOO_LONG',
        message: `String too long (${value.length} > ${schema.maxLength})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          code: 'PATTERN_MISMATCH',
          message: `String does not match pattern: ${schema.pattern}`,
          path: context.path,
          severity: 'error'
        });
      }
    }
    
    // Format validation
    if (schema.format) {
      const formatValidation = this._validateStringFormat(value, schema.format, context);
      errors.push(...formatValidation.errors);
      warnings.push(...formatValidation.warnings);
    }
    
    return { errors, warnings };
  }

  /**
   * Validate string format
   * @param {string} value - String value
   * @param {string} format - Expected format
   * @param {Object} context - Validation context
   * @returns {Object} Format validation result
   */
  _validateStringFormat(value, format, context) {
    const errors = [];
    const warnings = [];
    
    switch (format) {
      case 'path':
        if (!this._isValidPath(value)) {
          errors.push({
            code: 'INVALID_PATH_FORMAT',
            message: 'Invalid path format',
            path: context.path,
            severity: 'error'
          });
        }
        break;
        
      case 'uri':
        if (!this._isValidURI(value)) {
          errors.push({
            code: 'INVALID_URI_FORMAT',
            message: 'Invalid URI format',
            path: context.path,
            severity: 'error'
          });
        }
        break;
        
      case 'regex':
        try {
          new RegExp(value);
        } catch (error) {
          errors.push({
            code: 'INVALID_REGEX_FORMAT',
            message: 'Invalid regular expression',
            path: context.path,
            severity: 'error'
          });
        }
        break;
        
      case 'chmod':
        if (!/^[0-7]{3,4}$/.test(value)) {
          errors.push({
            code: 'INVALID_CHMOD_FORMAT',
            message: 'Invalid chmod format (expected octal like "755")',
            path: context.path,
            severity: 'error'
          });
        }
        break;
        
      default:
        warnings.push({
          code: 'UNKNOWN_STRING_FORMAT',
          message: `Unknown string format: ${format}`,
          path: context.path,
          severity: 'warning'
        });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate number
   * @param {number} value - Number value
   * @param {Object} schema - Number schema
   * @param {Object} context - Validation context
   * @returns {Object} Number validation result
   */
  _validateNumber(value, schema, context) {
    const errors = [];
    const warnings = [];
    
    // Integer validation
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push({
        code: 'NOT_INTEGER',
        message: 'Value must be an integer',
        path: context.path,
        severity: 'error'
      });
    }
    
    // Range validations
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        code: 'NUMBER_TOO_SMALL',
        message: `Number too small (${value} < ${schema.minimum})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        code: 'NUMBER_TOO_LARGE',
        message: `Number too large (${value} > ${schema.maximum})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    return { errors, warnings };
  }

  /**
   * Validate array
   * @param {Array} value - Array value
   * @param {Object} schema - Array schema
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Array validation result
   */
  async _validateArray(value, schema, context) {
    const errors = [];
    const warnings = [];
    
    // Length validations
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        code: 'ARRAY_TOO_SHORT',
        message: `Array too short (${value.length} < ${schema.minItems})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        code: 'ARRAY_TOO_LONG',
        message: `Array too long (${value.length} > ${schema.maxItems})`,
        path: context.path,
        severity: 'error'
      });
    }
    
    // Item validation
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemValidation = await this._validateField(
          value[i],
          schema.items,
          { ...context, path: [...context.path, i] }
        );
        errors.push(...itemValidation.errors);
        warnings.push(...itemValidation.warnings);
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Validate object
   * @param {Object} value - Object value
   * @param {Object} schema - Object schema
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Object validation result
   */
  async _validateObject(value, schema, context) {
    const errors = [];
    const warnings = [];
    
    // Nested properties validation
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in value) {
          const propValidation = await this._validateField(
            value[propName],
            propSchema,
            { ...context, path: [...context.path, propName] }
          );
          errors.push(...propValidation.errors);
          warnings.push(...propValidation.warnings);
        }
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Get value type
   * @param {*} value - Value to check
   * @returns {string} Value type
   */
  _getValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Validate path format
   * @param {string} path - Path to validate
   * @returns {boolean} Whether path is valid
   */
  _isValidPath(path) {
    // Basic path validation
    return typeof path === 'string' && 
           path.length > 0 && 
           !path.includes('\0') &&
           !/[<>:"|?*]/.test(path);
  }

  /**
   * Validate URI format
   * @param {string} uri - URI to validate
   * @returns {boolean} Whether URI is valid
   */
  _isValidURI(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      // Also accept relative URIs
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri) || uri.startsWith('/');
    }
  }

  /**
   * Validate schema definition
   * @param {Object} schema - Schema to validate
   * @returns {Object} Schema validation result
   */
  _validateSchemaDefinition(schema) {
    const errors = [];
    
    if (!schema || typeof schema !== 'object') {
      errors.push('Schema must be an object');
      return { valid: false, errors };
    }
    
    // Validate schema structure
    if (schema.type && !['object', 'array', 'string', 'number', 'integer', 'boolean'].includes(schema.type)) {
      errors.push(`Invalid schema type: ${schema.type}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate cache key
   * @param {Object} frontmatter - Frontmatter
   * @param {string} schemaName - Schema name
   * @param {Object} options - Options
   * @returns {string} Cache key
   */
  _generateCacheKey(frontmatter, schemaName, options) {
    const keyData = {
      frontmatter: JSON.stringify(frontmatter),
      schemaName,
      options: JSON.stringify(options || {})
    };
    
    return this._simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Initialize default schemas
   */
  _initializeDefaultSchemas() {
    // This will be populated with default schema definitions
    this.schemas.set('default', {
      name: 'default',
      version: '1.0.0',
      type: 'object',
      properties: {},
      additionalProperties: true
    });
  }

  /**
   * Load built-in schemas
   */
  _loadBuiltinSchemas() {
    // Basic frontmatter schema
    this.registerSchema('basic', {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          format: 'path',
          description: 'Output file path'
        },
        inject: {
          type: 'boolean',
          description: 'Enable injection mode'
        },
        append: {
          type: 'boolean',
          description: 'Enable append mode'
        },
        prepend: {
          type: 'boolean',
          description: 'Enable prepend mode'
        },
        lineAt: {
          type: 'integer',
          minimum: 1,
          description: 'Line number for insertion'
        },
        skipIf: {
          type: 'string',
          description: 'Condition to skip processing'
        },
        chmod: {
          type: 'string',
          format: 'chmod',
          description: 'File permissions'
        },
        sh: {
          type: 'array',
          items: { type: 'string' },
          description: 'Shell commands to execute'
        }
      },
      validators: ['mutually-exclusive-operations']
    });

    // KGEN-specific schema
    this.registerSchema('kgen', {
      type: 'object',
      extends: 'basic',
      properties: {
        variables: {
          type: 'object',
          description: 'Variable definitions'
        },
        metadata: {
          type: 'object',
          description: 'Template metadata'
        }
      }
    });
  }

  /**
   * Load custom validators
   */
  _loadCustomValidators() {
    // Mutually exclusive operations validator
    this.registerValidator('mutually-exclusive-operations', (frontmatter, context) => {
      const errors = [];
      const operationModes = [
        frontmatter.inject,
        frontmatter.append,
        frontmatter.prepend,
        frontmatter.lineAt !== undefined
      ].filter(Boolean);
      
      if (operationModes.length > 1) {
        errors.push({
          code: 'MUTUALLY_EXCLUSIVE_OPERATIONS',
          message: 'Only one operation mode allowed: inject, append, prepend, or lineAt',
          path: [],
          severity: 'error'
        });
      }
      
      return { errors, warnings: [] };
    });
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get validator statistics
   */
  getStatistics() {
    return {
      schemas: this.schemas.size,
      customValidators: this.customValidators.size,
      cacheSize: this.validationCache.size,
      options: this.options
    };
  }

  /**
   * List available schemas
   */
  listSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get schema definition
   * @param {string} name - Schema name
   * @returns {Object|null} Schema definition
   */
  getSchemaDefinition(name) {
    return this.schemas.get(name) || null;
  }
}

export default SchemaValidator;