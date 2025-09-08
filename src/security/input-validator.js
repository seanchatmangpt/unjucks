/**
 * Comprehensive Input Validation and Sanitization System
 * Protects against XSS, injection attacks, and malicious input
 */

import path from 'path';
import { z } from 'zod';

export class SecurityInputValidator {
  constructor() {
    this.maxStringLength = 10000;
    this.maxArrayLength = 1000;
    this.maxObjectDepth = 10;
    this.allowedFileExtensions = new Set([
      '.js', '.mjs', '.ts', '.json', '.md', '.txt', '.yml', '.yaml', 
      '.html', '.css', '.ejs', '.njk', '.hbs', '.mustache'
    ]);
    this.blockedPatterns = [
      // Script injection patterns
      /<script[\s\S]*?>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      
      // SQL injection patterns
      /(\b(union|select|insert|update|delete|drop|exec|execute|sp_|xp_)\b)/gi,
      /'(\s|;|--|\/\*)/gi,
      /;\s*(drop|delete|truncate)/gi,
      
      // Command injection patterns
      /(`|;|\||\&\&|\|\||>|<|eval\(|exec\(|system\()/gi,
      /(rm\s+-rf|del\s+\/|format\s+c:)/gi,
      
      // Path traversal patterns
      /\.\.[\/\\]/gi,
      /~[\/\\]/gi,
      
      // Protocol patterns
      /(file:|ftp:|gopher:|ldap:|dict:)/gi
    ];
    
    this.dangerousPaths = [
      '/etc/', '/root/', '/sys/', '/proc/', '/dev/', '/var/log/',
      'C:\\Windows\\', 'C:\\System32\\', '%SYSTEMROOT%'
    ];
  }

  /**
   * Validate and sanitize all input types
   * @param {any} input - Input to validate
   * @param {string} type - Expected type (string, number, object, array, etc.)
   * @param {object} options - Validation options
   */
  validateInput(input, type = 'string', options = {}) {
    try {
      // Type-specific validation
      switch (type) {
        case 'string':
          return this.validateString(input, options);
        case 'number':
          return this.validateNumber(input, options);
        case 'boolean':
          return this.validateBoolean(input);
        case 'array':
          return this.validateArray(input, options);
        case 'object':
          return this.validateObject(input, options);
        case 'path':
          return this.validatePath(input, options);
        case 'filename':
          return this.validateFilename(input, options);
        case 'email':
          return this.validateEmail(input);
        case 'url':
          return this.validateUrl(input, options);
        case 'json':
          return this.validateJson(input);
        default:
          throw new SecurityError(`Unsupported validation type: ${type}`);
      }
    } catch (error) {
      throw new SecurityError(`Input validation failed: ${error.message}`);
    }
  }

  /**
   * Validate and sanitize string input
   */
  validateString(input, options = {}) {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string');
    }

    const maxLength = options.maxLength || this.maxStringLength;
    if (input.length > maxLength) {
      throw new SecurityError(`String exceeds maximum length of ${maxLength}`);
    }

    // Check for dangerous patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(input)) {
        throw new SecurityError(`Input contains dangerous pattern: ${pattern}`);
      }
    }

    // Sanitize HTML entities if requested
    if (options.sanitizeHtml) {
      input = this.sanitizeHtml(input);
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      input = input.replace(/\s+/g, ' ').trim();
    }

    return input;
  }

  /**
   * Validate numeric input
   */
  validateNumber(input, options = {}) {
    const num = Number(input);
    if (isNaN(num) || !isFinite(num)) {
      throw new SecurityError('Input must be a valid number');
    }

    if (options.min !== undefined && num < options.min) {
      throw new SecurityError(`Number must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      throw new SecurityError(`Number must be at most ${options.max}`);
    }

    if (options.integer && !Number.isInteger(num)) {
      throw new SecurityError('Number must be an integer');
    }

    return num;
  }

  /**
   * Validate boolean input
   */
  validateBoolean(input) {
    if (typeof input === 'boolean') {
      return input;
    }
    
    if (typeof input === 'string') {
      const lower = input.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false;
      }
    }

    throw new SecurityError('Input must be a valid boolean value');
  }

  /**
   * Validate array input
   */
  validateArray(input, options = {}) {
    if (!Array.isArray(input)) {
      throw new SecurityError('Input must be an array');
    }

    const maxLength = options.maxLength || this.maxArrayLength;
    if (input.length > maxLength) {
      throw new SecurityError(`Array exceeds maximum length of ${maxLength}`);
    }

    // Validate each element if element type is specified
    if (options.elementType) {
      return input.map(item => this.validateInput(item, options.elementType, options.elementOptions));
    }

    return input;
  }

  /**
   * Validate object input with depth protection
   */
  validateObject(input, options = {}) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new SecurityError('Input must be a plain object');
    }

    const maxDepth = options.maxDepth || this.maxObjectDepth;
    this.validateObjectDepth(input, maxDepth, 0);

    // Validate against schema if provided
    if (options.schema) {
      return this.validateWithZodSchema(input, options.schema);
    }

    return input;
  }

  /**
   * Validate file path for security
   */
  validatePath(input, options = {}) {
    if (typeof input !== 'string') {
      throw new SecurityError('Path must be a string');
    }

    const normalized = path.normalize(input);
    
    // Check for path traversal
    if (normalized.includes('..')) {
      throw new SecurityError('Path traversal detected');
    }

    // Check for dangerous paths
    for (const dangerousPath of this.dangerousPaths) {
      if (normalized.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
        throw new SecurityError(`Access to dangerous path blocked: ${dangerousPath}`);
      }
    }

    // Validate against allowed prefixes if specified
    if (options.allowedPrefixes && options.allowedPrefixes.length > 0) {
      const isAllowed = options.allowedPrefixes.some(prefix => 
        normalized.startsWith(path.normalize(prefix))
      );
      if (!isAllowed) {
        throw new SecurityError('Path not in allowed directory');
      }
    }

    return normalized;
  }

  /**
   * Validate filename for security
   */
  validateFilename(input, options = {}) {
    if (typeof input !== 'string') {
      throw new SecurityError('Filename must be a string');
    }

    // Check for illegal characters
    const illegalChars = /[<>:"|?*\x00-\x1f]/;
    if (illegalChars.test(input)) {
      throw new SecurityError('Filename contains illegal characters');
    }

    // Check extension if validation is enabled
    if (options.validateExtension !== false) {
      const ext = path.extname(input).toLowerCase();
      if (ext && !this.allowedFileExtensions.has(ext)) {
        throw new SecurityError(`File extension not allowed: ${ext}`);
      }
    }

    // Check for reserved names on Windows
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = path.basename(input, path.extname(input)).toUpperCase();
    if (reservedNames.includes(baseName)) {
      throw new SecurityError(`Reserved filename not allowed: ${baseName}`);
    }

    return input;
  }

  /**
   * Validate email address
   */
  validateEmail(input) {
    if (typeof input !== 'string') {
      throw new SecurityError('Email must be a string');
    }

    const emailSchema = z.string().email();
    try {
      return emailSchema.parse(input);
    } catch (error) {
      throw new SecurityError('Invalid email format');
    }
  }

  /**
   * Validate URL with protocol restrictions
   */
  validateUrl(input, options = {}) {
    if (typeof input !== 'string') {
      throw new SecurityError('URL must be a string');
    }

    try {
      const url = new URL(input);
      
      // Check allowed protocols
      const allowedProtocols = options.allowedProtocols || ['http:', 'https:'];
      if (!allowedProtocols.includes(url.protocol)) {
        throw new SecurityError(`Protocol not allowed: ${url.protocol}`);
      }

      // Block internal/private IP addresses
      if (options.blockPrivateIPs) {
        this.validatePublicHost(url.hostname);
      }

      return input;
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Invalid URL format');
    }
  }

  /**
   * Validate JSON input
   */
  validateJson(input) {
    if (typeof input === 'object') {
      return input;
    }

    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (error) {
        throw new SecurityError('Invalid JSON format');
      }
    }

    throw new SecurityError('Input must be valid JSON');
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(input) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate object depth recursively
   */
  validateObjectDepth(obj, maxDepth, currentDepth) {
    if (currentDepth >= maxDepth) {
      throw new SecurityError(`Object depth exceeds maximum of ${maxDepth}`);
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.validateObjectDepth(value, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * Validate with Zod schema
   */
  validateWithZodSchema(input, schema) {
    try {
      return schema.parse(input);
    } catch (error) {
      throw new SecurityError(`Schema validation failed: ${error.message}`);
    }
  }

  /**
   * Validate that hostname is not a private IP
   */
  validatePublicHost(hostname) {
    const privateIPRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^fd00:/
    ];

    for (const range of privateIPRanges) {
      if (range.test(hostname)) {
        throw new SecurityError('Access to private IP addresses blocked');
      }
    }
  }

  /**
   * Batch validate multiple inputs
   */
  validateBatch(inputs) {
    const results = [];
    const errors = [];

    for (const { input, type, options, name } of inputs) {
      try {
        const validated = this.validateInput(input, type, options);
        results.push({ name, value: validated, valid: true });
      } catch (error) {
        results.push({ name, error: error.message, valid: false });
        errors.push({ name, error });
      }
    }

    return { results, errors, allValid: errors.length === 0 };
  }
}

/**
 * Security Error class for validation errors
 */
export class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.isSecurityError = true;
  }
}

// Export singleton instance
export const inputValidator = new SecurityInputValidator();

// Export common validation schemas
export const ValidationSchemas = {
  // File operation schemas
  fileOperation: z.object({
    path: z.string().min(1).max(1000),
    content: z.string().max(50000).optional(),
    encoding: z.enum(['utf8', 'base64', 'ascii']).default('utf8')
  }),

  // Template generation schemas
  templateGeneration: z.object({
    generator: z.string().min(1).max(100),
    template: z.string().min(1).max(100),
    name: z.string().min(1).max(200).optional(),
    variables: z.record(z.any()).optional(),
    outputPath: z.string().min(1).max(1000).optional()
  }),

  // Configuration schemas
  configuration: z.object({
    templates: z.string().min(1).max(1000),
    output: z.string().min(1).max(1000),
    variables: z.record(z.any()).optional(),
    helpers: z.record(z.function()).optional()
  }),

  // Command execution (restricted)
  commandExecution: z.object({
    command: z.string().min(1).max(500),
    args: z.array(z.string().max(200)).max(20).optional(),
    cwd: z.string().max(1000).optional(),
    timeout: z.number().min(1000).max(300000).default(30000)
  })
};