/**
 * Error Integration Utilities
 * Provides seamless integration of error handling throughout the Unjucks system
 */

import { ErrorHandler, CommandParseError, TemplateNotFoundError, PathSecurityError } from './errors.js';
import { Logger } from '../utils/logger.js';
import path from 'path';

/**
 * CLI Error Integration
 * Wraps CLI operations with error handling and recovery
 */
export class CLIErrorIntegration {
  static async wrapCommand(commandFn, context = {}) {
    try {
      return await commandFn();
    } catch (error) {
      // Add CLI context to error
      if (error.details) {
        error.details.cliContext = context;
      }
      
      const result = await ErrorHandler.handle(error, {
        interactive: !context.nonInteractive,
        exitOnError: !context.continueOnError,
      });
      
      if (result.recovered) {
        Logger.info('Error recovered, retrying operation');
        return result;
      }
      
      throw error;
    }
  }

  static enhanceParseError(originalError, availableCommands = []) {
    const message = originalError.message || 'Unknown parsing error';
    
    // Extract potential command from error
    const commandMatch = message.match(/Unknown command[:\s]+"([^"]+)"/i) || 
                        message.match(/Invalid command[:\s]+(.+)/i);
    
    const attempted = commandMatch ? commandMatch[1].trim() : '';
    
    // Generate suggestions
    const suggestions = this.generateCommandSuggestions(attempted, availableCommands);
    
    return new CommandParseError(attempted, suggestions, {
      originalError: originalError.message,
      availableCommands,
    });
  }

  static generateCommandSuggestions(attempted, available) {
    if (!attempted || !available.length) return [];
    
    // Calculate similarity scores
    const scored = available.map(cmd => ({
      command: cmd,
      score: this.calculateCommandSimilarity(attempted, cmd),
    }));
    
    // Return top 3 most similar commands
    return scored
      .filter(item => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.command);
  }

  static calculateCommandSimilarity(a, b) {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    // Exact match
    if (aLower === bLower) return 1;
    
    // Starts with
    if (bLower.startsWith(aLower) || aLower.startsWith(bLower)) return 0.8;
    
    // Contains
    if (bLower.includes(aLower) || aLower.includes(bLower)) return 0.6;
    
    // Levenshtein distance
    return this.levenshteinSimilarity(aLower, bLower);
  }

  static levenshteinSimilarity(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[b.length][a.length]) / maxLength;
  }
}

/**
 * Template Error Integration
 * Handles template-specific error scenarios
 */
export class TemplateErrorIntegration {
  static async wrapTemplateOperation(operation, templatePath, context = {}) {
    try {
      return await operation();
    } catch (error) {
      // Enhance error with template context
      return await this.handleTemplateError(error, templatePath, context);
    }
  }

  static async handleTemplateError(error, templatePath, context) {
    // Detect error type and enhance
    if (error.code === 'ENOENT') {
      const searchPaths = context.searchPaths || [path.dirname(templatePath)];
      const available = context.availableTemplates || [];
      
      throw new TemplateNotFoundError(
        path.basename(templatePath),
        searchPaths,
        available,
        { originalError: error.message }
      );
    }
    
    // Re-throw with context
    if (error.details) {
      error.details.templateContext = context;
    }
    
    throw error;
  }
}

/**
 * File System Error Integration
 * Handles file system operations with security and permission checks
 */
export class FileSystemErrorIntegration {
  static async wrapFileOperation(operation, filePath, operationType = 'write') {
    try {
      // Security check before operation
      this.validatePath(filePath);
      
      return await operation();
    } catch (error) {
      return await this.handleFileSystemError(error, filePath, operationType);
    }
  }

  static validatePath(filePath) {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(normalized);
    const cwd = process.cwd();
    
    // Check for path traversal
    if (normalized.includes('..')) {
      throw new PathSecurityError(filePath, 'Path traversal detected (..)');
    }
    
    // Check if path is within project directory (unless absolute and explicitly allowed)
    if (path.isAbsolute(filePath) && !resolved.startsWith(cwd)) {
      // Allow certain system paths for tools
      const allowedPaths = ['/tmp', '/var/tmp'];
      const isAllowed = allowedPaths.some(allowed => resolved.startsWith(allowed));
      
      if (!isAllowed) {
        throw new PathSecurityError(filePath, 'Path outside project directory');
      }
    }
    
    // Check for system directories
    const systemPaths = ['/etc', '/usr', '/bin', '/sbin', '/var/log'];
    if (systemPaths.some(sys => resolved.startsWith(sys))) {
      throw new PathSecurityError(filePath, 'System directory access denied');
    }
  }

  static async handleFileSystemError(error, filePath, operationType) {
    const { PermissionError, FileConflictError } = await import('./errors.js');
    
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new PermissionError(filePath, operationType, error);
    }
    
    if (error.code === 'EEXIST' && operationType === 'write') {
      throw new FileConflictError(filePath, 'exists', { originalError: error.message });
    }
    
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Validation Error Integration
 * Handles validation and data processing errors
 */
export class ValidationErrorIntegration {
  static async wrapValidation(validationFn, data, validationType = 'general') {
    try {
      return await validationFn(data);
    } catch (error) {
      return await this.handleValidationError(error, data, validationType);
    }
  }

  static async handleValidationError(error, data, validationType) {
    const { MissingVariablesError, FilterError } = await import('./errors.js');
    
    // Handle missing required fields
    if (error.message && error.message.includes('required')) {
      const missing = this.extractMissingFields(error.message, data);
      throw new MissingVariablesError(missing, validationType, Object.keys(data));
    }
    
    // Handle filter/transformation errors
    if (validationType.includes('filter') || validationType.includes('transform')) {
      throw new FilterError(validationType, data, error);
    }
    
    // Re-throw with enhanced context
    if (error.details) {
      error.details.validationContext = { data, validationType };
    }
    
    throw error;
  }

  static extractMissingFields(errorMessage, data) {
    // Simple extraction - could be enhanced with more sophisticated parsing
    const words = errorMessage.split(/\s+/);
    const missing = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.includes('required') && i > 0) {
        const candidate = words[i - 1].replace(/['"]/g, '');
        if (!data[candidate]) {
          missing.push(candidate);
        }
      }
    }
    
    return missing.length > 0 ? missing : ['unknown'];
  }
}

/**
 * Error Recovery Utilities
 * Provides common recovery patterns
 */
export class ErrorRecoveryUtils {
  static async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain error types
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          Logger.debug(`Attempt ${attempt} failed, retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  static isNonRetryableError(error) {
    const nonRetryableCodes = [
      'COMMAND_PARSE_ERROR',
      'TEMPLATE_SYNTAX_ERROR',
      'PATH_SECURITY_ERROR',
      'MISSING_VARIABLES_ERROR',
    ];
    
    return nonRetryableCodes.includes(error.code);
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async gracefulFallback(primaryOperation, fallbackOperation, context = {}) {
    try {
      return await primaryOperation();
    } catch (error) {
      Logger.warn(`Primary operation failed, attempting fallback: ${error.message}`);
      
      try {
        const result = await fallbackOperation();
        Logger.info('Fallback operation succeeded');
        return result;
      } catch (fallbackError) {
        Logger.error('Both primary and fallback operations failed');
        // Throw the original error, not the fallback error
        throw error;
      }
    }
  }
}

/**
 * Error Context Builder
 * Builds rich context for error reporting
 */
export class ErrorContextBuilder {
  constructor() {
    this.context = {
      timestamp: new Date().toISOString(),
      command: process.argv.slice(2),
      cwd: process.cwd(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  addCommandContext(command, args = {}, flags = {}) {
    this.context.command = {
      name: command,
      args,
      flags,
    };
    return this;
  }

  addTemplateContext(templatePath, variables = {}) {
    this.context.template = {
      path: templatePath,
      variables,
    };
    return this;
  }

  addFileContext(filePaths = []) {
    this.context.files = filePaths;
    return this;
  }

  addPerformanceContext(startTime) {
    this.context.performance = {
      duration: performance.now() - startTime,
      memory: process.memoryUsage(),
    };
    return this;
  }

  build() {
    return { ...this.context };
  }
}

export default {
  CLIErrorIntegration,
  TemplateErrorIntegration,
  FileSystemErrorIntegration,
  ValidationErrorIntegration,
  ErrorRecoveryUtils,
  ErrorContextBuilder,
};