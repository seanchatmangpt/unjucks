/**
 * Robust Error Handling System for KGEN CLI
 * 
 * Comprehensive error handling improvements addressing:
 * - Missing try-catch blocks
 * - Unhandled promise rejections  
 * - Inadequate error messages
 * - Missing validation checks
 * - Race condition handling
 * - Resource cleanup on errors
 * - Error propagation patterns
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Enhanced Error Classes with Structured Error Information
 */
export class KGenError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'KGenError';
    this.code = code;
    this.details = details;
    this.timestamp = this.getDeterministicDate().toISOString();
    this.severity = details.severity || 'error';
    this.recoverable = details.recoverable ?? true;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KGenError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }
}

export class InitializationError extends KGenError {
  constructor(component, cause, details = {}) {
    super(
      `Failed to initialize ${component}${cause ? ': ' + cause.message : ''}`,
      'INIT_ERROR',
      { 
        component, 
        cause: cause?.message,
        ...details,
        severity: 'critical',
        recoverable: false
      }
    );
    this.name = 'InitializationError';
  }
}

export class ValidationError extends KGenError {
  constructor(field, value, expected, details = {}) {
    super(
      `Validation failed for ${field}: expected ${expected}, got ${typeof value === 'object' ? JSON.stringify(value) : value}`,
      'VALIDATION_ERROR',
      { field, value, expected, ...details, severity: 'warning' }
    );
    this.name = 'ValidationError';
  }
}

export class FileSystemError extends KGenError {
  constructor(operation, filePath, cause, details = {}) {
    super(
      `File system operation '${operation}' failed for ${filePath}${cause ? ': ' + cause.message || cause : ''}`,
      'FS_ERROR',
      { operation, filePath, cause: cause?.message || cause, ...details }
    );
    this.name = 'FileSystemError';
  }
}

export class RaceConditionError extends KGenError {
  constructor(resource, operation, details = {}) {
    super(
      `Race condition detected: ${operation} on ${resource}`,
      'RACE_ERROR',
      { resource, operation, ...details, severity: 'warning' }
    );
    this.name = 'RaceConditionError';
  }
}

export class WebhookError extends KGenError {
  constructor(url, status, body, details = {}) {
    super(
      `Webhook request failed: ${status}${body ? ' - ' + body : ''}`,
      'WEBHOOK_ERROR',
      { url, status, body, ...details, recoverable: true }
    );
    this.name = 'WebhookError';
  }
}

export class AttestationError extends KGenError {
  constructor(operation, artifactPath, cause, details = {}) {
    super(
      `Attestation ${operation} failed for ${artifactPath}${cause ? ': ' + cause.message : ''}`,
      'ATTESTATION_ERROR',
      { operation, artifactPath, cause: cause?.message, ...details }
    );
    this.name = 'AttestationError';
  }
}

/**
 * Comprehensive Input Validation System
 */
export class InputValidator {
  static validateFilePath(filePath, operation = 'access', options = {}) {
    const { allowAbsolute = true, maxLength = 1000 } = options;
    
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('filePath', filePath, 'non-empty string');
    }
    
    if (filePath.length > maxLength) {
      throw new ValidationError('filePath', `length ${filePath.length}`, `length <= ${maxLength}`);
    }
    
    // Security checks
    const normalizedPath = path.normalize(filePath);
    
    // Prevent directory traversal
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      throw new ValidationError('filePath', filePath, 'safe path without traversal');
    }
    
    // Check for null bytes
    if (filePath.includes('\0')) {
      throw new ValidationError('filePath', filePath, 'path without null bytes');
    }
    
    // Validate path format
    if (!allowAbsolute && path.isAbsolute(normalizedPath)) {
      throw new ValidationError('filePath', filePath, 'relative path');
    }
    
    return normalizedPath;
  }
  
  static async validateFileAccess(filePath, operation = 'read', options = {}) {
    const { maxSize = 100 * 1024 * 1024 } = options; // 100MB default
    
    const validatedPath = this.validateFilePath(filePath, operation);
    
    try {
      // Check if file exists
      const stats = await fs.stat(validatedPath);
      
      if (stats.isDirectory() && operation !== 'list') {
        throw new ValidationError('filePath', filePath, 'file (not directory)');
      }
      
      if (stats.isFile()) {
        // Check file size
        if (stats.size > maxSize) {
          throw new ValidationError('fileSize', stats.size, `size <= ${maxSize} bytes`);
        }
        
        // Check permissions
        try {
          await fs.access(validatedPath, fs.constants.R_OK);
        } catch (error) {
          throw new FileSystemError('access', validatedPath, 'Permission denied');
        }
      }
      
      return {
        path: validatedPath,
        stats,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        lastModified: stats.mtime
      };
      
    } catch (error) {
      if (error instanceof KGenError) {
        throw error;
      }
      
      if (error.code === 'ENOENT') {
        throw new FileSystemError(operation, validatedPath, 'File or directory does not exist');
      }
      
      if (error.code === 'EACCES') {
        throw new FileSystemError(operation, validatedPath, 'Permission denied');
      }
      
      throw new FileSystemError(operation, validatedPath, error);
    }
  }
  
  static validateTemplate(templateName, options = {}) {
    const { allowedExtensions = ['.njk', '.j2', '.html', '.txt'] } = options;
    
    if (!templateName || typeof templateName !== 'string') {
      throw new ValidationError('templateName', templateName, 'non-empty string');
    }
    
    // Remove extension for validation
    const baseName = path.basename(templateName, path.extname(templateName));
    
    // Validate template name format
    if (!/^[a-zA-Z0-9_-]+$/.test(baseName)) {
      throw new ValidationError(
        'templateName', 
        templateName, 
        'alphanumeric characters with dash/underscore only'
      );
    }
    
    // Check extension if provided
    const ext = path.extname(templateName);
    if (ext && !allowedExtensions.includes(ext)) {
      throw new ValidationError(
        'templateExtension',
        ext,
        `one of: ${allowedExtensions.join(', ')}`
      );
    }
    
    return templateName;
  }
  
  static validateContext(context, options = {}) {
    const { maxDepth = 10, maxKeys = 1000 } = options;
    
    if (context === null || context === undefined) {
      return {};
    }
    
    if (typeof context !== 'object' || Array.isArray(context)) {
      throw new ValidationError('context', typeof context, 'object or null');
    }
    
    // Deep validation for security
    this._validateObjectDeep(context, maxDepth, maxKeys, 'context');
    
    return context;
  }
  
  static validateJSON(jsonString, fieldName, options = {}) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new ValidationError(fieldName, jsonString, 'non-empty JSON string');
    }
    
    try {
      const parsed = JSON.parse(jsonString);
      return this.validateContext(parsed, options);
    } catch (error) {
      throw new ValidationError(fieldName, 'invalid JSON', 'valid JSON string', {
        parseError: error.message
      });
    }
  }
  
  static _validateObjectDeep(obj, maxDepth, maxKeys, path = '', currentDepth = 0) {
    if (currentDepth > maxDepth) {
      throw new ValidationError(
        `${path}.depth`,
        currentDepth,
        `depth <= ${maxDepth}`
      );
    }
    
    const keys = Object.keys(obj);
    if (keys.length > maxKeys) {
      throw new ValidationError(
        `${path}.keyCount`,
        keys.length,
        `keys <= ${maxKeys}`
      );
    }
    
    // Check for dangerous properties
    const dangerousProps = ['__proto__', 'constructor', 'prototype'];
    for (const prop of dangerousProps) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        throw new ValidationError(
          `${path}.${prop}`,
          'dangerous property',
          'safe object without prototype pollution'
        );
      }
    }
    
    // Recursively validate nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this._validateObjectDeep(
          value,
          maxDepth,
          maxKeys,
          `${path}.${key}`,
          currentDepth + 1
        );
      }
    }
  }
}

/**
 * Advanced Resource Management System
 */
export class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.cleanupHandlers = new Map();
    this.locks = new Map();
    this.disposed = false;
    
    // Register cleanup on process exit
    this._registerCleanupHandlers();
  }
  
  async acquire(resourceId, factory, cleanup, options = {}) {
    if (this.disposed) {
      throw new KGenError('ResourceManager has been disposed', 'DISPOSED_ERROR');
    }
    
    const { timeout = 30000, retries = 3 } = options;
    
    // Prevent concurrent acquisition
    if (this.locks.has(resourceId)) {
      throw new RaceConditionError(resourceId, 'acquire');
    }
    
    if (this.resources.has(resourceId)) {
      throw new RaceConditionError(resourceId, 'acquire', {
        details: 'Resource already exists'
      });
    }
    
    this.locks.set(resourceId, true);
    
    try {
      const resource = await AsyncErrorHandler.withTimeout(
        () => AsyncErrorHandler.withRetry(
          () => factory(),
          { maxAttempts: retries }
        ),
        timeout
      );
      
      this.resources.set(resourceId, resource);
      
      if (cleanup) {
        this.cleanupHandlers.set(resourceId, cleanup);
      }
      
      return resource;
      
    } catch (error) {
      throw new KGenError(
        `Failed to acquire resource ${resourceId}`,
        'RESOURCE_ACQUIRE_ERROR',
        { resourceId, cause: error.message, timeout, retries }
      );
    } finally {
      this.locks.delete(resourceId);
    }
  }
  
  async release(resourceId) {
    if (this.disposed) {
      return; // Already disposed
    }
    
    try {
      const resource = this.resources.get(resourceId);
      if (!resource) {
        return; // Resource not found or already released
      }
      
      const cleanup = this.cleanupHandlers.get(resourceId);
      if (cleanup) {
        try {
          await cleanup(resource);
        } catch (cleanupError) {
          console.error(`Cleanup failed for resource ${resourceId}:`, cleanupError);
        }
      }
      
      this.resources.delete(resourceId);
      this.cleanupHandlers.delete(resourceId);
      
    } catch (error) {
      console.error(`Failed to release resource ${resourceId}:`, error);
    }
  }
  
  async dispose() {
    if (this.disposed) {
      return;
    }
    
    this.disposed = true;
    
    const errors = [];
    const resourceIds = Array.from(this.resources.keys());
    
    // Release all resources
    await Promise.allSettled(
      resourceIds.map(async (resourceId) => {
        try {
          await this.release(resourceId);
        } catch (error) {
          errors.push({ resourceId, error });
        }
      })
    );
    
    if (errors.length > 0) {
      console.error('Resource disposal errors:', errors);
    }
    
    this.resources.clear();
    this.cleanupHandlers.clear();
    this.locks.clear();
  }
  
  _registerCleanupHandlers() {
    const cleanup = () => {
      this.dispose().catch(error => {
        console.error('Final cleanup failed:', error);
      });
    };
    
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('SIGHUP', cleanup);
  }
  
  getResourceCount() {
    return this.resources.size;
  }
  
  hasResource(resourceId) {
    return this.resources.has(resourceId);
  }
  
  listResources() {
    return Array.from(this.resources.keys());
  }
}

/**
 * Advanced Async Error Handler with Circuit Breaker and Retry Logic
 */
export class AsyncErrorHandler {
  static async withRetry(operation, options = {}) {
    const {
      maxAttempts = 3,
      backoffMs = 1000,
      maxBackoffMs = 30000,
      jitter = true,
      shouldRetry = (error) => error.recoverable !== false,
      onRetry = () => {},
      backoffStrategy = 'exponential'
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation(attempt);
        
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !shouldRetry(error)) {
          break;
        }
        
        onRetry(error, attempt);
        
        // Calculate backoff delay
        let delay = this._calculateBackoff(attempt, backoffMs, maxBackoffMs, backoffStrategy);
        
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        
        await this.delay(delay);
      }
    }
    
    throw new KGenError(
      `Operation failed after ${maxAttempts} attempts: ${lastError.message}`,
      'RETRY_EXHAUSTED',
      { 
        lastError: lastError.message,
        attempts: maxAttempts,
        originalCode: lastError.code
      }
    );
  }
  
  static async withTimeout(operation, timeoutMs = 30000, options = {}) {
    const { timeoutMessage = 'Operation timed out' } = options;
    
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new KGenError(
          timeoutMessage,
          'TIMEOUT_ERROR',
          { timeoutMs, recoverable: true }
        ));
      }, timeoutMs);
    });
    
    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
  
  static async withCircuitBreaker(operation, options = {}) {
    // Simple circuit breaker implementation
    // In production, consider using a dedicated library like 'opossum'
    const {
      failureThreshold = 5,
      resetTimeoutMs = 60000,
      monitoringPeriodMs = 60000,
      name = 'default'
    } = options;
    
    const state = this._getCircuitBreakerState(name);
    
    if (state.isOpen && this.getDeterministicTimestamp() - state.lastFailureTime < resetTimeoutMs) {
      throw new KGenError(
        `Circuit breaker is open for ${name}`,
        'CIRCUIT_BREAKER_OPEN',
        { name, resetTimeoutMs }
      );
    }
    
    try {
      const result = await operation();
      
      // Reset on success
      state.consecutiveFailures = 0;
      state.isOpen = false;
      
      return result;
      
    } catch (error) {
      state.consecutiveFailures++;
      state.lastFailureTime = this.getDeterministicTimestamp();
      
      if (state.consecutiveFailures >= failureThreshold) {
        state.isOpen = true;
      }
      
      throw error;
    }
  }
  
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  static _calculateBackoff(attempt, baseMs, maxMs, strategy) {
    let delay;
    
    switch (strategy) {
      case 'linear':
        delay = baseMs * attempt;
        break;
      case 'exponential':
      default:
        delay = baseMs * Math.pow(2, attempt - 1);
        break;
    }
    
    return Math.min(delay, maxMs);
  }
  
  static _circuitBreakerStates = new Map();
  
  static _getCircuitBreakerState(name) {
    if (!this._circuitBreakerStates.has(name)) {
      this._circuitBreakerStates.set(name, {
        consecutiveFailures: 0,
        lastFailureTime: 0,
        isOpen: false
      });
    }
    return this._circuitBreakerStates.get(name);
  }
}

/**
 * Enhanced Webhook Handler with Comprehensive Error Management
 */
export class WebhookHandler {
  constructor(options = {}) {
    this.defaultTimeout = options.defaultTimeout || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.retryBackoff = options.retryBackoff || 1000;
    this.userAgent = options.userAgent || 'kgen-cli/1.0.0';
  }
  
  async send(url, payload, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      headers = {},
      validateResponse = true
    } = options;
    
    // Input validation
    if (!url || typeof url !== 'string') {
      throw new ValidationError('webhookUrl', url, 'valid URL string');
    }
    
    try {
      new URL(url); // Validate URL format
    } catch (error) {
      throw new ValidationError('webhookUrl', url, 'valid URL format');
    }
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      ...headers
    };
    
    try {
      return await AsyncErrorHandler.withRetry(
        async (attempt) => {
          try {
            const response = await AsyncErrorHandler.withTimeout(
              async () => {
                const res = await fetch(url, {
                  method: 'POST',
                  headers: requestHeaders,
                  body: JSON.stringify(payload)
                });
                return res;
              },
              timeout,
              { timeoutMessage: `Webhook request to ${url} timed out` }
            );
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new WebhookError(url, response.status, errorText, {
                attempt,
                recoverable: response.status >= 500 || response.status === 429
              });
            }
            
            let responseData = null;
            if (validateResponse) {
              try {
                responseData = await response.json();
              } catch (parseError) {
                console.warn('[KGEN] Webhook response is not valid JSON:', parseError.message);
                responseData = await response.text();
              }
            }
            
            return {
              success: true,
              status: response.status,
              data: responseData,
              timestamp: this.getDeterministicDate().toISOString()
            };
            
          } catch (error) {
            if (error instanceof WebhookError && !error.details.recoverable) {
              // Don't retry non-recoverable errors
              error.recoverable = false;
            }
            throw error;
          }
        },
        {
          maxAttempts: retries,
          backoffMs: this.retryBackoff,
          shouldRetry: (error) => error.recoverable !== false,
          onRetry: (error, attempt) => {
            console.warn(`[KGEN] Webhook retry ${attempt}/${retries} for ${url}:`, error.message);
          }
        }
      );
      
    } catch (error) {
      // Log failures but return structured error instead of throwing
      console.error('[KGEN] Webhook delivery failed permanently:', {
        url,
        error: error.message,
        code: error.code,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      return {
        success: false,
        error: error.message,
        code: error.code,
        url,
        timestamp: this.getDeterministicDate().toISOString()
      };
    }
  }
}

/**
 * Attestation Verification System with Enhanced Error Handling
 */
export class AttestationVerifier {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
    this.allowedAlgorithms = options.allowedAlgorithms || ['sha256'];
  }
  
  async verify(artifactPath, attestationPath, options = {}) {
    const { requireSignature = false, algorithm = 'sha256' } = options;
    
    try {
      // Input validation
      const validatedArtifactPath = InputValidator.validateFilePath(artifactPath);
      const validatedAttestationPath = attestationPath 
        ? InputValidator.validateFilePath(attestationPath)
        : `${validatedArtifactPath}.attest.json`;
      
      // Check file access
      const [artifactInfo, attestationInfo] = await Promise.all([
        InputValidator.validateFileAccess(validatedArtifactPath, 'read'),
        InputValidator.validateFileAccess(validatedAttestationPath, 'read')
      ]);
      
      // Load attestation
      const attestation = await this._loadAttestation(attestationInfo.path);
      
      // Verify attestation structure
      this._validateAttestationStructure(attestation);
      
      // Verify content hash
      const contentHash = await this._calculateContentHash(artifactInfo.path, algorithm);
      const expectedHash = attestation.artifact?.contentHash || attestation.contentHash;
      
      if (!expectedHash) {
        throw new AttestationError(
          'verify',
          artifactInfo.path,
          'Attestation missing content hash'
        );
      }
      
      const hashMatches = contentHash === expectedHash;
      
      // Verify signature if required
      let signatureValid = null;
      if (requireSignature || attestation.signature) {
        signatureValid = await this._verifySignature(attestation, artifactInfo.path);
      }
      
      const result = {
        success: hashMatches && (signatureValid !== false),
        artifactPath: artifactInfo.path,
        attestationPath: attestationInfo.path,
        verification: {
          contentHash: {
            expected: expectedHash,
            actual: contentHash,
            matches: hashMatches,
            algorithm
          },
          signature: signatureValid !== null ? {
            present: !!attestation.signature,
            valid: signatureValid
          } : null,
          timestamp: this.getDeterministicDate().toISOString()
        },
        attestation: {
          version: attestation.version,
          created: attestation.timestamp || attestation.createdAt,
          algorithm: attestation.algorithm || 'unknown'
        }
      };
      
      if (!result.success) {
        const issues = [];
        if (!hashMatches) issues.push('Content hash mismatch');
        if (signatureValid === false) issues.push('Invalid signature');
        
        result.issues = issues;
        result.error = `Verification failed: ${issues.join(', ')}`;
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof KGenError) {
        throw error;
      }
      
      throw new AttestationError('verify', artifactPath, error);
    }
  }
  
  async _loadAttestation(attestationPath) {
    try {
      const content = await fs.readFile(attestationPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AttestationError(
          'parse',
          attestationPath,
          'Invalid JSON format'
        );
      }
      throw error;
    }
  }
  
  _validateAttestationStructure(attestation) {
    if (!attestation || typeof attestation !== 'object') {
      throw new AttestationError('validate', 'attestation', 'Invalid attestation format');
    }
    
    // Check required fields based on version
    const version = attestation.version || '1.0';
    
    switch (version) {
      case '1.0':
      case '1.1':
        if (!attestation.contentHash && !attestation.artifact?.contentHash) {
          throw new AttestationError('validate', 'attestation', 'Missing content hash');
        }
        break;
      default:
        console.warn(`[KGEN] Unknown attestation version: ${version}`);
    }
  }
  
  async _calculateContentHash(filePath, algorithm) {
    if (!this.allowedAlgorithms.includes(algorithm)) {
      throw new ValidationError('algorithm', algorithm, `one of: ${this.allowedAlgorithms.join(', ')}`);
    }
    
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash(algorithm).update(content).digest('hex');
    } catch (error) {
      throw new FileSystemError('hash', filePath, error);
    }
  }
  
  async _verifySignature(attestation, artifactPath) {
    // Placeholder for signature verification
    // In production, implement proper cryptographic signature verification
    if (!attestation.signature) {
      return null;
    }
    
    try {
      // Mock signature verification - replace with real implementation
      const hasValidFormat = typeof attestation.signature === 'string' && 
                           attestation.signature.length > 0;
      
      return hasValidFormat;
    } catch (error) {
      console.error('[KGEN] Signature verification failed:', error);
      return false;
    }
  }
}

/**
 * Content URI Resolver with Enhanced Error Handling
 */
export class ContentResolver {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
  }
  
  async resolve(uri, options = {}) {
    const { useCache = true, forceRefresh = false } = options;
    
    try {
      // Input validation
      if (!uri || typeof uri !== 'string') {
        throw new ValidationError('uri', uri, 'non-empty string');
      }
      
      // Check cache first
      if (useCache && !forceRefresh) {
        const cached = this._getFromCache(uri);
        if (cached) {
          return cached;
        }
      }
      
      // Resolve based on URI scheme
      let result;
      
      if (uri.startsWith('file://') || uri.startsWith('/')) {
        result = await this._resolveFile(uri);
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        result = await this._resolveHttp(uri);
      } else if (uri.startsWith('git://') || uri.includes('.git')) {
        result = await this._resolveGit(uri);
      } else {
        throw new ValidationError('uri', uri, 'supported URI scheme (file, http, https, git)');
      }
      
      // Cache result
      if (useCache && result.success) {
        this._setCache(uri, result);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof KGenError) {
        throw error;
      }
      
      throw new KGenError(`Failed to resolve URI: ${uri}`, 'URI_RESOLVE_ERROR', {
        uri,
        cause: error.message
      });
    }
  }
  
  async _resolveFile(uri) {
    const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;
    
    try {
      const fileInfo = await InputValidator.validateFileAccess(filePath, 'read');
      const content = await fs.readFile(fileInfo.path, 'utf8');
      
      return {
        success: true,
        uri,
        type: 'file',
        content,
        contentType: this._detectContentType(content),
        size: fileInfo.size,
        lastModified: fileInfo.lastModified,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
    } catch (error) {
      throw new FileSystemError('resolve', filePath, error);
    }
  }
  
  async _resolveHttp(uri) {
    try {
      const response = await AsyncErrorHandler.withRetry(
        async () => {
          const res = await AsyncErrorHandler.withTimeout(
            () => fetch(uri),
            this.timeout
          );
          
          if (!res.ok) {
            throw new KGenError(
              `HTTP request failed: ${res.status} ${res.statusText}`,
              'HTTP_ERROR',
              { status: res.status, statusText: res.statusText }
            );
          }
          
          return res;
        },
        {
          maxAttempts: this.maxRetries,
          shouldRetry: (error) => error.code === 'HTTP_ERROR' && error.details.status >= 500
        }
      );
      
      const content = await response.text();
      
      return {
        success: true,
        uri,
        type: 'http',
        content,
        contentType: response.headers.get('content-type') || this._detectContentType(content),
        size: content.length,
        headers: Object.fromEntries(response.headers),
        timestamp: this.getDeterministicDate().toISOString()
      };
      
    } catch (error) {
      throw new KGenError(`Failed to resolve HTTP URI: ${uri}`, 'HTTP_RESOLVE_ERROR', {
        uri,
        cause: error.message
      });
    }
  }
  
  async _resolveGit(uri) {
    // Placeholder for Git URI resolution
    // In production, implement proper Git protocol handling
    throw new KGenError('Git URI resolution not implemented', 'NOT_IMPLEMENTED', { uri });
  }
  
  _detectContentType(content) {
    if (typeof content !== 'string') {
      return 'application/octet-stream';
    }
    
    const trimmed = content.trim();
    
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'application/json';
    }
    
    if (trimmed.startsWith('<')) {
      return 'text/xml';
    }
    
    if (trimmed.includes('@prefix') || trimmed.includes('PREFIX')) {
      return 'text/turtle';
    }
    
    return 'text/plain';
  }
  
  _getFromCache(uri) {
    const cached = this.cache.get(uri);
    
    if (!cached) {
      return null;
    }
    
    if (this.getDeterministicTimestamp() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(uri);
      return null;
    }
    
    return { ...cached.data, fromCache: true };
  }
  
  _setCache(uri, data) {
    this.cache.set(uri, {
      data,
      timestamp: this.getDeterministicTimestamp()
    });
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Export all enhanced error handling utilities
export {
  AsyncErrorHandler,
  ResourceManager,
  InputValidator,
  WebhookHandler,
  AttestationVerifier,
  ContentResolver
};

export default {
  KGenError,
  InitializationError,
  ValidationError,
  FileSystemError,
  RaceConditionError,
  WebhookError,
  AttestationError,
  AsyncErrorHandler,
  ResourceManager,
  InputValidator,
  WebhookHandler,
  AttestationVerifier,
  ContentResolver
};