/**
 * Validation engine for Office document template processing
 * 
 * This module provides comprehensive validation capabilities for templates,
 * data, and processing results in the Office document processing system.
 * 
 * @module office/utils/validation-engine
 * @version 1.0.0
 */

import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationOptions,
  ValidationFunction,
  TemplateFrontmatter,
  ProcessingContext,
  ErrorSeverity,
  TemplateVariable,
  DocumentType
} from '../core/types.js';

/**
 * Built-in validation rules
 */
const BUILT_IN_VALIDATORS = {
  required: (value: any) => value !== undefined && value !== null && value !== '',
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  url: (value: string) => /^https?:\/\/.+/.test(value),
  phone: (value: string) => /^[+]?[\d\s\-()]+$/.test(value),
  uuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  alphanumeric: (value: string) => /^[a-zA-Z0-9]+$/.test(value),
  numeric: (value: string) => /^\d+$/.test(value),
  alpha: (value: string) => /^[a-zA-Z]+$/.test(value)
};

/**
 * Validation engine for comprehensive template and data validation
 * 
 * Provides sophisticated validation capabilities including:
 * - Template structure validation
 * - Data type and constraint validation
 * - Custom validation functions
 * - Schema-based validation
 * - Cross-field validation
 */
export class ValidationEngine {
  private readonly options: ValidationOptions;
  private readonly customValidators: Map<string, ValidationFunction> = new Map();
  
  /**
   * Creates a new validation engine
   * 
   * @param options - Validation options
   */
  constructor(options: ValidationOptions = { enabled: true }) {
    this.options = {
      enabled: true,
      failFast: false,
      level: 'moderate',
      ...options
    };
    
    // Register custom validators from options
    if (this.options.validators) {
      for (const validator of this.options.validators) {
        this.registerValidator(validator);
      }
    }
  }

  /**
   * Validates template frontmatter structure and content
   * 
   * @param frontmatter - Template frontmatter to validate
   * @param context - Processing context
   * @returns Validation result
   */
  async validateFrontmatter(frontmatter: TemplateFrontmatter, context?: ProcessingContext): Promise<ValidationResult> {
    if (!this.options.enabled) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate required fields
    if (!frontmatter.type) {
      errors.push({
        message: 'Template frontmatter must specify a document type',
        code: 'MISSING_DOCUMENT_TYPE',
        field: 'type',
        severity: ErrorSeverity.ERROR
      });
    } else if (!Object.values(DocumentType).includes(frontmatter.type)) {
      errors.push({
        message: `Invalid document type: ${frontmatter.type}`,
        code: 'INVALID_DOCUMENT_TYPE',
        field: 'type',
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Validate variables definition
    if (frontmatter.variables) {
      const variableValidation = await this.validateVariableDefinitions(frontmatter.variables);
      errors.push(...variableValidation.errors);
      warnings.push(...variableValidation.warnings);
    }
    
    // Validate injection points
    if (frontmatter.injectionPoints) {
      const injectionValidation = await this.validateInjectionPoints(frontmatter.injectionPoints);
      errors.push(...injectionValidation.errors);
      warnings.push(...injectionValidation.warnings);
    }
    
    // Validate output configuration
    if (frontmatter.output) {
      const outputValidation = await this.validateOutputConfiguration(frontmatter.output);
      errors.push(...outputValidation.errors);
      warnings.push(...outputValidation.warnings);
    }
    
    // Validate metadata
    if (frontmatter.metadata) {
      const metadataValidation = await this.validateMetadata(frontmatter.metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates input data against template requirements
   * 
   * @param data - Input data to validate
   * @param frontmatter - Template frontmatter with validation rules
   * @param context - Processing context
   * @returns Validation result
   */
  async validateData(data: Record<string, any>, frontmatter?: TemplateFrontmatter, context?: ProcessingContext): Promise<ValidationResult> {
    if (!this.options.enabled) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate against template variables
    if (frontmatter?.variables) {
      for (const variable of frontmatter.variables) {
        const value = this.getNestedValue(data, variable.name);
        const variableValidation = await this.validateVariable(variable, value, data, context);
        
        errors.push(...variableValidation.errors);
        warnings.push(...variableValidation.warnings);
        
        if (this.options.failFast && variableValidation.errors.length > 0) {
          break;
        }
      }
    }
    
    // Check for unknown variables if strict mode
    if (frontmatter?.validation?.strictVariables) {
      const definedVariables = new Set(frontmatter.variables?.map(v => v.name) || []);
      for (const key of Object.keys(data)) {
        if (!definedVariables.has(key)) {
          if (frontmatter.validation.allowUnknownVariables) {
            warnings.push({
              message: `Unknown variable '${key}' in data`,
              code: 'UNKNOWN_VARIABLE',
              field: key
            });
          } else {
            errors.push({
              message: `Unknown variable '${key}' not allowed in strict mode`,
              code: 'STRICT_UNKNOWN_VARIABLE',
              field: key,
              severity: ErrorSeverity.ERROR
            });
          }
        }
      }
    }
    
    // Run custom validators
    if (frontmatter?.validation?.customValidators) {
      for (const validator of frontmatter.validation.customValidators) {
        try {
          const result = await this.runValidator(validator, data, context);
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        } catch (error) {
          errors.push({
            message: `Custom validator '${validator.name}' failed: ${error.message}`,
            code: 'CUSTOM_VALIDATOR_ERROR',
            severity: ErrorSeverity.ERROR
          });
        }
      }
    }
    
    // Schema validation if provided
    if (frontmatter?.validation?.schema) {
      const schemaValidation = await this.validateSchema(data, frontmatter.validation.schema);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates a single variable against its definition
   * 
   * @param variable - Variable definition
   * @param value - Value to validate
   * @param data - Complete data object for cross-field validation
   * @param context - Processing context
   * @returns Validation result
   */
  async validateVariable(
    variable: TemplateVariable, 
    value: any, 
    data: Record<string, any>, 
    context?: ProcessingContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Required validation
    if (variable.required && (value === undefined || value === null || value === '')) {
      errors.push({
        message: `Required variable '${variable.name}' is missing or empty`,
        code: 'REQUIRED_VARIABLE_MISSING',
        field: variable.name,
        severity: ErrorSeverity.ERROR
      });
      return { valid: false, errors, warnings };
    }
    
    // Skip further validation if value is not provided and not required
    if (value === undefined || value === null) {
      return { valid: true, errors, warnings };
    }
    
    // Type validation
    if (!this.validateType(value, variable.type)) {
      errors.push({
        message: `Variable '${variable.name}' expected type ${variable.type} but got ${typeof value}`,
        code: 'INVALID_TYPE',
        field: variable.name,
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Custom validation rules
    if (variable.validation) {
      const constraintValidation = await this.validateConstraints(variable.name, value, variable.validation);
      errors.push(...constraintValidation.errors);
      warnings.push(...constraintValidation.warnings);
    }
    
    // Default value warning
    if (variable.defaultValue !== undefined && value === variable.defaultValue) {
      warnings.push({
        message: `Variable '${variable.name}' is using default value`,
        code: 'USING_DEFAULT_VALUE',
        field: variable.name
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates variable definitions in frontmatter
   * 
   * @param variables - Variable definitions to validate
   * @returns Validation result
   */
  private async validateVariableDefinitions(variables: TemplateVariable[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const names = new Set<string>();
    
    for (const variable of variables) {
      // Check for duplicate names
      if (names.has(variable.name)) {
        errors.push({
          message: `Duplicate variable name: ${variable.name}`,
          code: 'DUPLICATE_VARIABLE_NAME',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      }
      names.add(variable.name);
      
      // Validate variable name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(variable.name)) {
        errors.push({
          message: `Invalid variable name format: ${variable.name}`,
          code: 'INVALID_VARIABLE_NAME',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Validate default value type
      if (variable.defaultValue !== undefined && !this.validateType(variable.defaultValue, variable.type)) {
        errors.push({
          message: `Default value for '${variable.name}' does not match declared type ${variable.type}`,
          code: 'INVALID_DEFAULT_VALUE_TYPE',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Warn about missing descriptions for required variables
      if (variable.required && !variable.description) {
        warnings.push({
          message: `Required variable '${variable.name}' has no description`,
          code: 'MISSING_VARIABLE_DESCRIPTION',
          field: 'variables'
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates injection points configuration
   * 
   * @param injectionPoints - Injection points to validate
   * @returns Validation result
   */
  private async validateInjectionPoints(injectionPoints: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const ids = new Set<string>();
    const markers = new Set<string>();
    
    for (const point of injectionPoints) {
      // Check required fields
      if (!point.id) {
        errors.push({
          message: 'Injection point must have an id',
          code: 'MISSING_INJECTION_POINT_ID',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      if (!point.marker) {
        errors.push({
          message: 'Injection point must have a marker',
          code: 'MISSING_INJECTION_POINT_MARKER',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Check for duplicates
      if (point.id && ids.has(point.id)) {
        errors.push({
          message: `Duplicate injection point id: ${point.id}`,
          code: 'DUPLICATE_INJECTION_POINT_ID',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      if (point.marker && markers.has(point.marker)) {
        warnings.push({
          message: `Duplicate injection point marker: ${point.marker}`,
          code: 'DUPLICATE_INJECTION_POINT_MARKER',
          field: 'injectionPoints'
        });
      }
      
      if (point.id) ids.add(point.id);
      if (point.marker) markers.add(point.marker);
      
      // Validate content type
      const validTypes = ['text', 'html', 'markdown', 'table', 'image', 'chart'];
      if (point.type && !validTypes.includes(point.type)) {
        errors.push({
          message: `Invalid injection point type: ${point.type}`,
          code: 'INVALID_INJECTION_POINT_TYPE',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Warn about required points without default content
      if (point.required && !point.defaultContent) {
        warnings.push({
          message: `Required injection point '${point.id}' has no default content`,
          code: 'MISSING_DEFAULT_CONTENT',
          field: 'injectionPoints'
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates output configuration
   * 
   * @param output - Output configuration to validate
   * @returns Validation result
   */
  private async validateOutputConfiguration(output: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate extension format
    if (output.extension && !output.extension.startsWith('.')) {
      warnings.push({
        message: `Output extension should start with a dot: ${output.extension}`,
        code: 'INVALID_EXTENSION_FORMAT',
        field: 'output.extension'
      });
    }
    
    // Validate compression settings
    if (output.compression?.enabled) {
      if (output.compression.level && (output.compression.level < 1 || output.compression.level > 9)) {
        errors.push({
          message: 'Compression level must be between 1 and 9',
          code: 'INVALID_COMPRESSION_LEVEL',
          field: 'output.compression.level',
          severity: ErrorSeverity.ERROR
        });
      }
      
      const validAlgorithms = ['gzip', 'deflate', 'brotli'];
      if (output.compression.algorithm && !validAlgorithms.includes(output.compression.algorithm)) {
        errors.push({
          message: `Invalid compression algorithm: ${output.compression.algorithm}`,
          code: 'INVALID_COMPRESSION_ALGORITHM',
          field: 'output.compression.algorithm',
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates metadata object
   * 
   * @param metadata - Metadata to validate
   * @returns Validation result
   */
  private async validateMetadata(metadata: Record<string, any>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for common metadata fields and their types
    const typeChecks: Record<string, string> = {
      title: 'string',
      description: 'string',
      author: 'string',
      version: 'string',
      created: 'string', // ISO date string
      modified: 'string' // ISO date string
    };
    
    for (const [key, expectedType] of Object.entries(typeChecks)) {
      if (metadata[key] !== undefined && typeof metadata[key] !== expectedType) {
        warnings.push({
          message: `Metadata field '${key}' should be of type ${expectedType}`,
          code: 'METADATA_TYPE_MISMATCH',
          field: `metadata.${key}`
        });
      }
    }
    
    // Validate date formats
    const dateFields = ['created', 'modified'];
    for (const field of dateFields) {
      if (metadata[field] && typeof metadata[field] === 'string') {
        if (isNaN(Date.parse(metadata[field]))) {
          errors.push({
            message: `Invalid date format in metadata.${field}: ${metadata[field]}`,
            code: 'INVALID_DATE_FORMAT',
            field: `metadata.${field}`,
            severity: ErrorSeverity.ERROR
          });
        }
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates constraints for a variable value
   * 
   * @param name - Variable name
   * @param value - Value to validate
   * @param validation - Validation constraints
   * @returns Validation result
   */
  private async validateConstraints(name: string, value: any, validation: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Min/max validation
    if (validation.min !== undefined) {
      if (typeof value === 'number' && value < validation.min) {
        errors.push({
          message: `Variable '${name}' value ${value} is less than minimum ${validation.min}`,
          code: 'VALUE_BELOW_MINIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      } else if (typeof value === 'string' && value.length < validation.min) {
        errors.push({
          message: `Variable '${name}' length ${value.length} is less than minimum ${validation.min}`,
          code: 'LENGTH_BELOW_MINIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      } else if (Array.isArray(value) && value.length < validation.min) {
        errors.push({
          message: `Variable '${name}' array length ${value.length} is less than minimum ${validation.min}`,
          code: 'ARRAY_LENGTH_BELOW_MINIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    if (validation.max !== undefined) {
      if (typeof value === 'number' && value > validation.max) {
        errors.push({
          message: `Variable '${name}' value ${value} is greater than maximum ${validation.max}`,
          code: 'VALUE_ABOVE_MAXIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      } else if (typeof value === 'string' && value.length > validation.max) {
        errors.push({
          message: `Variable '${name}' length ${value.length} is greater than maximum ${validation.max}`,
          code: 'LENGTH_ABOVE_MAXIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      } else if (Array.isArray(value) && value.length > validation.max) {
        errors.push({
          message: `Variable '${name}' array length ${value.length} is greater than maximum ${validation.max}`,
          code: 'ARRAY_LENGTH_ABOVE_MAXIMUM',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      try {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            message: `Variable '${name}' value does not match required pattern`,
            code: 'PATTERN_MISMATCH',
            field: name,
            severity: ErrorSeverity.ERROR
          });
        }
      } catch (error) {
        errors.push({
          message: `Invalid regex pattern for variable '${name}': ${validation.pattern}`,
          code: 'INVALID_REGEX_PATTERN',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    // Enum validation
    if (validation.enum && Array.isArray(validation.enum)) {
      if (!validation.enum.includes(value)) {
        errors.push({
          message: `Variable '${name}' value must be one of: ${validation.enum.join(', ')}`,
          code: 'ENUM_MISMATCH',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    // Custom function validation
    if (validation.custom && typeof validation.custom === 'function') {
      try {
        const result = validation.custom(value);
        if (typeof result === 'string') {
          errors.push({
            message: `Variable '${name}' custom validation failed: ${result}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            field: name,
            severity: ErrorSeverity.ERROR
          });
        } else if (result === false) {
          errors.push({
            message: `Variable '${name}' failed custom validation`,
            code: 'CUSTOM_VALIDATION_FAILED',
            field: name,
            severity: ErrorSeverity.ERROR
          });
        }
      } catch (error) {
        errors.push({
          message: `Custom validation function error for variable '${name}': ${error.message}`,
          code: 'CUSTOM_VALIDATION_ERROR',
          field: name,
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates data against a JSON schema
   * 
   * @param data - Data to validate
   * @param schema - JSON schema
   * @returns Validation result
   */
  private async validateSchema(data: any, schema: any): Promise<ValidationResult> {
    // Basic schema validation implementation
    // In a real implementation, you would use a library like Ajv
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // This is a simplified implementation
    // A full implementation would use a proper JSON Schema validator
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Runs a custom validator function
   * 
   * @param validator - Validator function
   * @param data - Data to validate
   * @param context - Processing context
   * @returns Validation result
   */
  private async runValidator(
    validator: ValidationFunction, 
    data: any, 
    context?: ProcessingContext
  ): Promise<ValidationResult> {
    const registeredValidator = this.customValidators.get(validator.name);
    const validatorFn = registeredValidator?.fn || validator.fn;
    
    return validatorFn(data, context || {} as ProcessingContext);
  }

  /**
   * Validates a value against a specific type
   * 
   * @param value - Value to validate
   * @param type - Expected type
   * @returns Whether value matches type
   */
  private validateType(value: any, type: TemplateVariable['type']): boolean {
    switch (type) {
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
   * Gets nested value from object using dot notation
   * 
   * @param obj - Object to search in
   * @param path - Dot-separated path
   * @returns Value at path or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Registers a custom validator
   * 
   * @param validator - Validator to register
   */
  registerValidator(validator: ValidationFunction): void {
    this.customValidators.set(validator.name, validator);
  }

  /**
   * Unregisters a custom validator
   * 
   * @param name - Name of validator to unregister
   */
  unregisterValidator(name: string): void {
    this.customValidators.delete(name);
  }

  /**
   * Gets all registered validator names
   * 
   * @returns Array of validator names
   */
  getRegisteredValidators(): string[] {
    return Array.from(this.customValidators.keys());
  }

  /**
   * Runs a built-in validator by name
   * 
   * @param name - Validator name
   * @param value - Value to validate
   * @returns Whether validation passed
   */
  runBuiltInValidator(name: string, value: any): boolean {
    const validator = BUILT_IN_VALIDATORS[name as keyof typeof BUILT_IN_VALIDATORS];
    if (!validator) {
      throw new Error(`Unknown built-in validator: ${name}`);
    }
    
    return validator(value);
  }

  /**
   * Gets available built-in validator names
   * 
   * @returns Array of built-in validator names
   */
  static getBuiltInValidators(): string[] {
    return Object.keys(BUILT_IN_VALIDATORS);
  }
}
