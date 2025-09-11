/**
 * Injection validator for Office document content injection
 * 
 * Provides comprehensive validation for injection configurations,
 * ensuring safe and reliable content injection operations.
 * 
 * @module office/utils/injection-validator
 * @version 1.0.0
 */

import { ErrorSeverity } from '../core/types.js';

/**
 * Validates injection configurations for Office documents
 */
export class InjectionValidator {
  /**
   * Creates a new injection validator
   * 
   * @param {Object} [options={}] - Validation options
   */
  constructor(options = {}) {
    this.options = {
      strictMode: false,
      allowDangerousContent: false,
      maxContentSize: 1024 * 1024, // 1MB
      ...options
    };
  }

  /**
   * Validates an injection configuration
   * 
   * @param {InjectionConfig} config - Configuration to validate
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validateInjectionConfig(config) {
    const errors = [];
    const warnings = [];

    try {
      // Basic structure validation
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid injection configuration: must be an object');
      }

      // File path validation
      if (!config.filePath || typeof config.filePath !== 'string') {
        errors.push({
          message: 'File path is required and must be a string',
          code: 'MISSING_FILE_PATH',
          severity: ErrorSeverity.ERROR,
          field: 'filePath'
        });
      } else {
        this.validateFilePath(config.filePath, errors, warnings);
      }

      // Injections validation
      if (!config.injections || !Array.isArray(config.injections)) {
        errors.push({
          message: 'Injections array is required',
          code: 'MISSING_INJECTIONS',
          severity: ErrorSeverity.ERROR,
          field: 'injections'
        });
      } else if (config.injections.length === 0) {
        warnings.push({
          message: 'Injections array is empty',
          code: 'EMPTY_INJECTIONS',
          severity: ErrorSeverity.WARNING,
          field: 'injections'
        });
      } else {
        await this.validateInjections(config.injections, errors, warnings);
      }

      // Output path validation (if provided)
      if (config.outputPath) {
        this.validateOutputPath(config.outputPath, errors, warnings);
      }

      // Throw on validation errors if in strict mode
      if (this.options.strictMode && errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
      }

    } catch (error) {
      errors.push({
        message: error.message,
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }

    const isValid = errors.length === 0;
    if (!isValid) {
      throw new Error(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      warnings
    };
  }

  /**
   * Validates file path
   * 
   * @param {string} filePath - File path to validate
   * @param {ValidationError[]} errors - Error array to push to
   * @param {ValidationWarning[]} warnings - Warning array to push to
   * @private
   */
  validateFilePath(filePath, errors, warnings) {
    // Check for empty path
    if (!filePath.trim()) {
      errors.push({
        message: 'File path cannot be empty',
        code: 'EMPTY_FILE_PATH',
        severity: ErrorSeverity.ERROR,
        field: 'filePath'
      });
      return;
    }

    // Check for suspicious patterns
    const dangerousPatterns = [
      /\.\./,           // Path traversal
      /[<>:\"|\\*?]/,   // Invalid Windows characters
      /^\/[^\/]/,       // Root access on Unix
      /^[A-Za-z]:\\/    // Windows drive access
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        if (this.options.strictMode) {
          errors.push({
            message: `File path contains potentially dangerous pattern: ${filePath}`,
            code: 'DANGEROUS_FILE_PATH',
            severity: ErrorSeverity.ERROR,
            field: 'filePath'
          });
        } else {
          warnings.push({
            message: `File path may contain suspicious pattern: ${filePath}`,
            code: 'SUSPICIOUS_FILE_PATH',
            severity: ErrorSeverity.WARNING,
            field: 'filePath'
          });
        }
        break;
      }
    }

    // Check file extension
    const validExtensions = ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    
    if (!validExtensions.includes(extension)) {
      warnings.push({
        message: `Unrecognized file extension: ${extension}`,
        code: 'UNKNOWN_EXTENSION',
        severity: ErrorSeverity.WARNING,
        field: 'filePath'
      });
    }
  }

  /**
   * Validates output path
   * 
   * @param {string} outputPath - Output path to validate
   * @param {ValidationError[]} errors - Error array to push to
   * @param {ValidationWarning[]} warnings - Warning array to push to
   * @private
   */
  validateOutputPath(outputPath, errors, warnings) {
    if (typeof outputPath !== 'string') {
      errors.push({
        message: 'Output path must be a string',
        code: 'INVALID_OUTPUT_PATH_TYPE',
        severity: ErrorSeverity.ERROR,
        field: 'outputPath'
      });
      return;
    }

    // Reuse file path validation logic
    this.validateFilePath(outputPath, errors, warnings);
  }

  /**
   * Validates injection specifications
   * 
   * @param {InjectionSpec[]} injections - Injections to validate
   * @param {ValidationError[]} errors - Error array to push to
   * @param {ValidationWarning[]} warnings - Warning array to push to
   * @private
   */
  async validateInjections(injections, errors, warnings) {
    const validModes = ['replace', 'before', 'after', 'append', 'prepend', 'insertAt'];
    const validTypes = ['text', 'html', 'markdown', 'json', 'xml', 'richText'];

    for (let i = 0; i < injections.length; i++) {
      const injection = injections[i];
      const prefix = `injections[${i}]`;

      // Required fields
      if (!injection.target) {
        errors.push({
          message: `${prefix}: target is required`,
          code: 'MISSING_TARGET',
          severity: ErrorSeverity.ERROR,
          field: `${prefix}.target`
        });
      }

      if (injection.content === undefined || injection.content === null) {
        errors.push({
          message: `${prefix}: content is required`,
          code: 'MISSING_CONTENT',
          severity: ErrorSeverity.ERROR,
          field: `${prefix}.content`
        });
      }

      // Validate mode
      if (injection.mode && !validModes.includes(injection.mode)) {
        errors.push({
          message: `${prefix}: invalid mode '${injection.mode}'. Must be one of: ${validModes.join(', ')}`,
          code: 'INVALID_MODE',
          severity: ErrorSeverity.ERROR,
          field: `${prefix}.mode`
        });
      }

      // Validate type
      if (injection.type && !validTypes.includes(injection.type)) {
        warnings.push({
          message: `${prefix}: unrecognized content type '${injection.type}'`,
          code: 'UNKNOWN_CONTENT_TYPE',
          severity: ErrorSeverity.WARNING,
          field: `${prefix}.type`
        });
      }

      // Content validation
      await this.validateInjectionContent(injection, prefix, errors, warnings);

      // Target validation
      this.validateInjectionTarget(injection, prefix, errors, warnings);
    }
  }

  /**
   * Validates injection content
   * 
   * @param {InjectionSpec} injection - Injection to validate
   * @param {string} prefix - Field prefix for error messages
   * @param {ValidationError[]} errors - Error array to push to
   * @param {ValidationWarning[]} warnings - Warning array to push to
   * @private
   */
  async validateInjectionContent(injection, prefix, errors, warnings) {
    const content = injection.content;

    // Check content size
    if (typeof content === 'string' && content.length > this.options.maxContentSize) {
      errors.push({
        message: `${prefix}: content exceeds maximum size of ${this.options.maxContentSize} characters`,
        code: 'CONTENT_TOO_LARGE',
        severity: ErrorSeverity.ERROR,
        field: `${prefix}.content`
      });
    }

    // Check for potentially dangerous content
    if (!this.options.allowDangerousContent && typeof content === 'string') {
      const dangerousPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/gi,  // Script tags
        /javascript:/gi,                       // JavaScript URLs
        /on\w+\s*=/gi,                        // Event handlers
        /data:text\/html/gi,                  // Data URLs
        /vbscript:/gi,                        // VBScript URLs
        /expression\s*\(/gi                   // CSS expressions
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          if (this.options.strictMode) {
            errors.push({
              message: `${prefix}: content contains potentially dangerous elements`,
              code: 'DANGEROUS_CONTENT',
              severity: ErrorSeverity.ERROR,
              field: `${prefix}.content`
            });
          } else {
            warnings.push({
              message: `${prefix}: content may contain suspicious elements`,
              code: 'SUSPICIOUS_CONTENT',
              severity: ErrorSeverity.WARNING,
              field: `${prefix}.content`
            });
          }
          break;
        }
      }
    }

    // Validate JSON content
    if (injection.type === 'json' && typeof content === 'string') {
      try {
        JSON.parse(content);
      } catch (error) {
        errors.push({
          message: `${prefix}: invalid JSON content - ${error.message}`,
          code: 'INVALID_JSON',
          severity: ErrorSeverity.ERROR,
          field: `${prefix}.content`
        });
      }
    }

    // Validate XML content
    if (injection.type === 'xml' && typeof content === 'string') {
      // Basic XML validation - in a real implementation you might use a proper XML parser
      const xmlDeclarationPattern = /<\?xml[^>]*\?>/i;
      const tagPattern = /<[^>]+>/;
      
      if (!tagPattern.test(content)) {
        warnings.push({
          message: `${prefix}: content doesn't appear to contain XML tags`,
          code: 'POSSIBLY_INVALID_XML',
          severity: ErrorSeverity.WARNING,
          field: `${prefix}.content`
        });
      }
    }
  }

  /**
   * Validates injection target
   * 
   * @param {InjectionSpec} injection - Injection to validate
   * @param {string} prefix - Field prefix for error messages
   * @param {ValidationError[]} errors - Error array to push to
   * @param {ValidationWarning[]} warnings - Warning array to push to
   * @private
   */
  validateInjectionTarget(injection, prefix, errors, warnings) {
    const target = injection.target;

    if (typeof target !== 'string') {
      errors.push({
        message: `${prefix}: target must be a string`,
        code: 'INVALID_TARGET_TYPE',
        severity: ErrorSeverity.ERROR,
        field: `${prefix}.target`
      });
      return;
    }

    // Validate target format based on common patterns
    const targetPatterns = {
      bookmark: /^bookmark:[a-zA-Z_][a-zA-Z0-9_]*$/,
      cell: /^([A-Za-z]+[0-9]+|Sheet[0-9]+:[A-Za-z]+[0-9]+)$/,
      slide: /^slide:[0-9]+/,
      range: /^[A-Za-z]+[0-9]+:[A-Za-z]+[0-9]+$/,
      namedRange: /^namedRange:[a-zA-Z_][a-zA-Z0-9_]*$/
    };

    let isValidPattern = false;
    for (const [patternName, pattern] of Object.entries(targetPatterns)) {
      if (pattern.test(target)) {
        isValidPattern = true;
        break;
      }
    }

    if (!isValidPattern && target.length > 0) {
      warnings.push({
        message: `${prefix}: target format may not be recognized: '${target}'`,
        code: 'UNRECOGNIZED_TARGET_FORMAT',
        severity: ErrorSeverity.WARNING,
        field: `${prefix}.target`
      });
    }

    // Check for empty target
    if (target.trim().length === 0) {
      errors.push({
        message: `${prefix}: target cannot be empty`,
        code: 'EMPTY_TARGET',
        severity: ErrorSeverity.ERROR,
        field: `${prefix}.target`
      });
    }
  }

  /**
   * Gets validation configuration
   * 
   * @returns {Object} Current validation options
   */
  getOptions() {
    return { ...this.options };
  }

  /**
   * Updates validation options
   * 
   * @param {Object} newOptions - New validation options
   */
  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
}