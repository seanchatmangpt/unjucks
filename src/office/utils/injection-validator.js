import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Validates injection configurations before processing
 * @class InjectionValidator
 */
export class InjectionValidator {
  /**
   * Creates an instance of InjectionValidator
   */
  constructor() {
    this.logger = consola.create({ tag: 'InjectionValidator' });
  }

  /**
   * Validates an injection configuration
   * @param {Object} config - Injection configuration to validate
   * @param {string} config.filePath - Path to the target file
   * @param {Array<Object>} config.injections - Array of injection specifications
   * @param {string} config.outputPath - Output file path (optional)
   * @returns {Promise<Object>} - Validation result
   * @throws {Error} - If validation fails
   */
  async validateInjectionConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate basic structure
    if (!config || typeof config !== 'object') {
      throw new Error('Injection config must be an object');
    }

    // Validate file path
    if (!config.filePath) {
      errors.push('filePath is required');
    } else if (typeof config.filePath !== 'string') {
      errors.push('filePath must be a string');
    } else {
      // Check if file path is valid
      const filePath = path.resolve(config.filePath);
      if (!path.isAbsolute(filePath)) {
        warnings.push('filePath should be absolute');
      }
      
      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      const supportedExtensions = ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'];
      if (!supportedExtensions.includes(ext)) {
        warnings.push(`File extension '${ext}' may not be supported. Supported: ${supportedExtensions.join(', ')}`);
      }
    }

    // Validate injections array
    if (!config.injections) {
      errors.push('injections array is required');
    } else if (!Array.isArray(config.injections)) {
      errors.push('injections must be an array');
    } else if (config.injections.length === 0) {
      warnings.push('injections array is empty - no operations will be performed');
    } else {
      // Validate each injection
      for (let i = 0; i < config.injections.length; i++) {
        const injection = config.injections[i];
        const injectionErrors = await this.validateInjection(injection, i);
        errors.push(...injectionErrors);
      }
    }

    // Validate output path if provided
    if (config.outputPath) {
      if (typeof config.outputPath !== 'string') {
        errors.push('outputPath must be a string');
      } else {
        const outputDir = path.dirname(config.outputPath);
        if (!(await fs.pathExists(outputDir))) {
          warnings.push(`Output directory does not exist: ${outputDir}`);
        }
      }
    }

    // Throw error if there are validation errors
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Log warnings
    if (warnings.length > 0) {
      warnings.forEach(warning => this.logger.warn(warning));
    }

    return {
      valid: true,
      warnings,
      config
    };
  }

  /**
   * Validates a single injection specification
   * @param {Object} injection - Injection specification
   * @param {number} index - Index in injections array
   * @returns {Promise<Array<string>>} - Array of validation errors
   */
  async validateInjection(injection, index) {
    const errors = [];
    const prefix = `Injection ${index + 1}`;

    // Check basic structure
    if (!injection || typeof injection !== 'object') {
      errors.push(`${prefix}: must be an object`);
      return errors;
    }

    // Validate target
    if (!injection.target) {
      errors.push(`${prefix}: target is required`);
    } else if (typeof injection.target !== 'string') {
      errors.push(`${prefix}: target must be a string`);
    } else {
      // Validate target format based on type
      const targetErrors = this.validateTarget(injection.target, index);
      errors.push(...targetErrors);
    }

    // Validate content
    if (injection.content === undefined || injection.content === null) {
      errors.push(`${prefix}: content is required`);
    }

    // Validate mode
    if (injection.mode) {
      const validModes = ['replace', 'before', 'after', 'append', 'prepend', 'insertAt'];
      if (!validModes.includes(injection.mode)) {
        errors.push(`${prefix}: mode must be one of: ${validModes.join(', ')}`);
      }
    }

    // Validate type
    if (injection.type) {
      const validTypes = ['text', 'html', 'markdown', 'json', 'xml', 'richText'];
      if (!validTypes.includes(injection.type)) {
        errors.push(`${prefix}: type must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate formatting
    if (injection.formatting && typeof injection.formatting !== 'object') {
      errors.push(`${prefix}: formatting must be an object`);
    }

    // Validate skipIf
    if (injection.skipIf) {
      if (typeof injection.skipIf !== 'string' && typeof injection.skipIf !== 'function') {
        errors.push(`${prefix}: skipIf must be a string or function`);
      }
    }

    return errors;
  }

  /**
   * Validates target format for different target types
   * @param {string} target - Target string to validate
   * @param {number} index - Injection index for error messages
   * @returns {Array<string>} - Array of validation errors
   */
  validateTarget(target, index) {
    const errors = [];
    const prefix = `Injection ${index + 1} target`;

    // Word document targets
    if (target.includes('bookmark:')) {
      const bookmarkName = target.split('bookmark:')[1];
      if (!bookmarkName || bookmarkName.trim() === '') {
        errors.push(`${prefix}: bookmark name cannot be empty`);
      }
    }
    else if (target.includes('paragraph:')) {
      const paragraphNum = target.split('paragraph:')[1];
      if (!paragraphNum || isNaN(parseInt(paragraphNum))) {
        errors.push(`${prefix}: paragraph number must be a valid integer`);
      }
    }
    else if (target.includes('table:') && target.includes('cell:')) {
      // Validate table:X:cell:Y,Z format
      const match = target.match(/table:(\d+):cell:(\d+),(\d+)/);
      if (!match) {
        errors.push(`${prefix}: table cell format must be 'table:X:cell:Y,Z'`);
      }
    }

    // Excel targets
    else if (target.includes('namedRange:')) {
      const rangeName = target.split('namedRange:')[1];
      if (!rangeName || rangeName.trim() === '') {
        errors.push(`${prefix}: named range name cannot be empty`);
      }
    }
    else if (target.includes(':') && this.isExcelCellReference(target)) {
      // Validate cell references like 'Sheet1:A1' or range 'Sheet1:A1:C3'
      const parts = target.split(':');
      if (parts.length < 2) {
        errors.push(`${prefix}: Excel cell reference format is invalid`);
      }
    }

    // PowerPoint targets
    else if (target.includes('slide:')) {
      const slideMatch = target.match(/slide:(\w+)/);
      if (!slideMatch) {
        errors.push(`${prefix}: slide format must be 'slide:X' or 'slide:new'`);
      } else {
        const slideRef = slideMatch[1];
        if (slideRef !== 'new' && isNaN(parseInt(slideRef))) {
          errors.push(`${prefix}: slide reference must be a number or 'new'`);
        }
      }
    }
    else if (target.includes('placeholder:')) {
      const match = target.match(/slide:(\w+):placeholder:(\w+)/);
      if (!match) {
        errors.push(`${prefix}: placeholder format must be 'slide:X:placeholder:name'`);
      }
    }

    return errors;
  }

  /**
   * Checks if a string is a valid Excel cell reference
   * @private
   * @param {string} target - Target string to check
   * @returns {boolean} - Whether it's a valid Excel cell reference
   */
  isExcelCellReference(target) {
    // Basic regex for Excel cell references (Sheet1:A1, A1, Sheet1:A1:C3, etc.)
    const cellRefRegex = /^([a-zA-Z0-9_]+:)?[A-Z]+[0-9]+(:[A-Z]+[0-9]+)?$/;
    return cellRefRegex.test(target);
  }

  /**
   * Validates batch injection configurations
   * @param {Array<Object>} batchConfigs - Array of injection configurations
   * @returns {Promise<Object>} - Validation results
   */
  async validateBatchConfigurations(batchConfigs) {
    if (!Array.isArray(batchConfigs)) {
      throw new Error('Batch configs must be an array');
    }

    const results = {
      valid: [],
      invalid: [],
      totalConfigs: batchConfigs.length,
      totalInjections: 0
    };

    for (let i = 0; i < batchConfigs.length; i++) {
      const config = batchConfigs[i];
      try {
        const validationResult = await this.validateInjectionConfig(config);
        results.valid.push({
          index: i,
          filePath: config.filePath,
          injections: config.injections.length,
          warnings: validationResult.warnings
        });
        results.totalInjections += config.injections.length;
      } catch (error) {
        results.invalid.push({
          index: i,
          filePath: config.filePath,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validates file permissions and accessibility
   * @param {string} filePath - Path to file to check
   * @returns {Promise<Object>} - Permission check results
   */
  async validateFilePermissions(filePath) {
    const results = {
      exists: false,
      readable: false,
      writable: false,
      isFile: false,
      size: 0,
      errors: [],
      warnings: []
    };

    try {
      // Check if file exists
      if (await fs.pathExists(filePath)) {
        results.exists = true;
        
        // Get file stats
        const stats = await fs.stat(filePath);
        results.isFile = stats.isFile();
        results.size = stats.size;
        
        if (!results.isFile) {
          results.errors.push('Path is not a file');
          return results;
        }

        // Check read access
        try {
          await fs.access(filePath, fs.constants.R_OK);
          results.readable = true;
        } catch {
          results.errors.push('File is not readable');
        }

        // Check write access
        try {
          await fs.access(filePath, fs.constants.W_OK);
          results.writable = true;
        } catch {
          results.warnings.push('File is not writable - output will need different path');
        }

        // Warn about large files
        if (results.size > 50 * 1024 * 1024) { // 50MB
          results.warnings.push('File is large (>50MB) - processing may be slow');
        }
      } else {
        results.warnings.push('File does not exist - will be created');
      }
    } catch (error) {
      results.errors.push(`Error checking file permissions: ${error.message}`);
    }

    return results;
  }

  /**
   * Validates content safety (checks for potentially harmful content)
   * @param {*} content - Content to validate
   * @returns {Object} - Safety validation results
   */
  validateContentSafety(content) {
    const results = {
      safe: true,
      warnings: [],
      issues: []
    };

    if (typeof content === 'string') {
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        { pattern: /<script[^>]*>/i, message: 'Contains script tags' },
        { pattern: /javascript:/i, message: 'Contains JavaScript protocol' },
        { pattern: /vbscript:/i, message: 'Contains VBScript protocol' },
        { pattern: /on\w+\s*=/i, message: 'Contains event handlers' },
        { pattern: /\${.*}/g, message: 'Contains template expressions' }
      ];

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(content)) {
          results.issues.push(message);
          results.safe = false;
        }
      }

      // Check for very long content
      if (content.length > 100000) { // 100KB
        results.warnings.push('Content is very long - may impact performance');
      }

      // Check for unusual characters
      const unusualChars = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g);
      if (unusualChars) {
        results.warnings.push('Content contains unusual control characters');
      }
    }

    return results;
  }

  /**
   * Validates formatting object structure
   * @param {Object} formatting - Formatting configuration
   * @param {string} targetType - Target type (word, excel, powerpoint)
   * @returns {Object} - Formatting validation results
   */
  validateFormatting(formatting, targetType) {
    const results = {
      valid: true,
      warnings: [],
      errors: []
    };

    if (!formatting || typeof formatting !== 'object') {
      return results; // Formatting is optional
    }

    // Common formatting validations
    if (formatting.fontSize && (typeof formatting.fontSize !== 'number' || formatting.fontSize < 1 || formatting.fontSize > 200)) {
      results.errors.push('fontSize must be a number between 1 and 200');
      results.valid = false;
    }

    if (formatting.color && typeof formatting.color !== 'string') {
      results.errors.push('color must be a string');
      results.valid = false;
    }

    // Target-specific validations
    switch (targetType) {
      case 'excel':
        this.validateExcelFormatting(formatting, results);
        break;
      case 'word':
        this.validateWordFormatting(formatting, results);
        break;
      case 'powerpoint':
        this.validatePowerPointFormatting(formatting, results);
        break;
    }

    return results;
  }

  /**
   * Validates Excel-specific formatting
   * @private
   * @param {Object} formatting - Formatting object
   * @param {Object} results - Results object to populate
   */
  validateExcelFormatting(formatting, results) {
    if (formatting.numFmt && typeof formatting.numFmt !== 'string') {
      results.errors.push('numFmt must be a string');
      results.valid = false;
    }

    if (formatting.alignment && typeof formatting.alignment !== 'object') {
      results.errors.push('alignment must be an object');
      results.valid = false;
    }
  }

  /**
   * Validates Word-specific formatting
   * @private
   * @param {Object} formatting - Formatting object
   * @param {Object} results - Results object to populate
   */
  validateWordFormatting(formatting, results) {
    if (formatting.alignment && !['left', 'center', 'right', 'justify'].includes(formatting.alignment)) {
      results.warnings.push('alignment should be one of: left, center, right, justify');
    }
  }

  /**
   * Validates PowerPoint-specific formatting
   * @private
   * @param {Object} formatting - Formatting object
   * @param {Object} results - Results object to populate
   */
  validatePowerPointFormatting(formatting, results) {
    if (formatting.x && (typeof formatting.x !== 'number' || formatting.x < 0)) {
      results.errors.push('x position must be a non-negative number');
      results.valid = false;
    }

    if (formatting.y && (typeof formatting.y !== 'number' || formatting.y < 0)) {
      results.errors.push('y position must be a non-negative number');
      results.valid = false;
    }

    if (formatting.width && (typeof formatting.width !== 'number' || formatting.width <= 0)) {
      results.errors.push('width must be a positive number');
      results.valid = false;
    }

    if (formatting.height && (typeof formatting.height !== 'number' || formatting.height <= 0)) {
      results.errors.push('height must be a positive number');
      results.valid = false;
    }
  }
}

export default InjectionValidator;