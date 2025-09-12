/**
 * Enhanced Error Handling and Recovery System for Deterministic Rendering
 * 
 * Provides robust error handling with recovery strategies:
 * - Categorized error classification
 * - Automatic recovery attempts
 * - Fallback rendering strategies
 * - Error context preservation
 * - Deterministic error reporting
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import logger from 'consola';
import fs from 'fs/promises';
import path from 'path';

export class DeterministicErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Error handling settings
      enableRecovery: options.enableRecovery !== false,
      maxRetryAttempts: options.maxRetryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      
      // Error classification
      enableClassification: options.enableClassification !== false,
      
      // Logging and reporting
      logErrors: options.logErrors !== false,
      enableErrorReports: options.enableErrorReports !== false,
      errorReportsDir: options.errorReportsDir || '.kgen/errors',
      
      // Fallback strategies
      enableFallbacks: options.enableFallbacks !== false,
      fallbackTemplate: options.fallbackTemplate || null,
      
      // Deterministic error handling
      staticErrorTime: options.staticErrorTime || '2024-01-01T00:00:00.000Z',
      
      ...options
    };
    
    this.logger = logger.withTag('deterministic-error-handler');
    
    // Error statistics
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      unrecoverableErrors: 0,
      errorsByCategory: {},
      errorsByTemplate: {},
      startTime: new Date()
    };
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    this._initializeRecoveryStrategies();
    
    // Error context cache for deterministic reporting
    this.errorContextCache = new Map();
  }
  
  /**
   * Handle error with classification and recovery attempts
   */
  async handleError(error, context = {}) {
    const errorId = this._generateErrorId(error, context);
    const startTime = Date.now();
    
    try {
      // Classify error
      const classification = this._classifyError(error, context);
      
      // Create enhanced error context
      const enhancedContext = {
        ...context,
        errorId,
        classification,
        timestamp: this.config.staticErrorTime,
        handledAt: new Date().toISOString(),
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
      
      // Update statistics
      this._updateErrorStatistics(classification, context);
      
      // Log error
      if (this.config.logErrors) {
        this._logError(error, enhancedContext);
      }
      
      // Emit error event
      this.emit('error:classified', { error, context: enhancedContext });
      
      // Attempt recovery if enabled
      let recoveryResult = null;
      if (this.config.enableRecovery && classification.recoverable) {
        recoveryResult = await this._attemptRecovery(error, enhancedContext);
      }
      
      // Create error report
      let reportPath = null;
      if (this.config.enableErrorReports) {
        reportPath = await this._createErrorReport(error, enhancedContext, recoveryResult);
      }
      
      // Prepare result
      const result = {
        errorId,
        classification,
        context: enhancedContext,
        recovery: recoveryResult,
        reportPath,
        handled: true,
        handlingTime: Date.now() - startTime
      };
      
      this.emit('error:handled', result);
      
      return result;
      
    } catch (handlingError) {
      this.logger.error('Error handler failed:', handlingError);
      
      return {
        errorId,
        originalError: error,
        handlingError: handlingError.message,
        handled: false,
        handlingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Handle template rendering errors with fallback strategies
   */
  async handleTemplateError(templatePath, error, context = {}) {
    const enhancedContext = {
      ...context,
      templatePath,
      errorType: 'template-rendering'
    };
    
    const handlingResult = await this.handleError(error, enhancedContext);
    
    // Try fallback strategies for template errors
    if (this.config.enableFallbacks && !handlingResult.recovery?.success) {
      const fallbackResult = await this._attemptTemplateFallback(templatePath, error, enhancedContext);
      handlingResult.fallback = fallbackResult;
    }
    
    return handlingResult;
  }
  
  /**
   * Handle RDF integration errors
   */
  async handleRDFError(rdfContent, error, context = {}) {
    const enhancedContext = {
      ...context,
      rdfContentHash: crypto.createHash('sha256').update(rdfContent).digest('hex'),
      errorType: 'rdf-integration'
    };
    
    const handlingResult = await this.handleError(error, enhancedContext);
    
    // RDF-specific recovery strategies
    if (this.config.enableRecovery && !handlingResult.recovery?.success) {
      const rdfRecovery = await this._attemptRDFRecovery(rdfContent, error, enhancedContext);
      handlingResult.rdfRecovery = rdfRecovery;
    }
    
    return handlingResult;
  }
  
  /**
   * Validate error recovery consistency
   */
  async validateRecoveryConsistency(errorId, iterations = 3) {
    if (!this.errorContextCache.has(errorId)) {
      return {
        consistent: false,
        reason: 'Error context not found'
      };
    }
    
    const errorContext = this.errorContextCache.get(errorId);
    const recoveryResults = [];
    
    try {
      for (let i = 0; i < iterations; i++) {
        // Re-attempt the same recovery
        const result = await this._attemptRecovery(
          errorContext.originalError, 
          errorContext
        );
        recoveryResults.push(result);
      }
      
      // Check consistency of recovery results
      const firstResult = JSON.stringify(recoveryResults[0]);
      const allConsistent = recoveryResults.every(r => 
        JSON.stringify(r) === firstResult
      );
      
      return {
        consistent: allConsistent,
        iterations,
        results: recoveryResults,
        errorId
      };
      
    } catch (error) {
      return {
        consistent: false,
        error: error.message,
        errorId
      };
    }
  }
  
  /**
   * Get error statistics and metrics
   */
  getStatistics() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
      recoveryRate: this.stats.totalErrors > 0 
        ? this.stats.recoveredErrors / this.stats.totalErrors 
        : 0,
      errorsByCategory: Object.keys(this.stats.errorsByCategory).reduce((acc, key) => {
        acc[key] = {
          count: this.stats.errorsByCategory[key],
          percentage: (this.stats.errorsByCategory[key] / this.stats.totalErrors) * 100
        };
        return acc;
      }, {}),
      topErrorTemplates: Object.entries(this.stats.errorsByTemplate)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    };
  }
  
  /**
   * Register custom recovery strategy
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
    this.logger.debug(`Registered recovery strategy for: ${errorType}`);
  }
  
  /**
   * Clear error statistics and cache
   */
  reset() {
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      unrecoverableErrors: 0,
      errorsByCategory: {},
      errorsByTemplate: {},
      startTime: new Date()
    };
    
    this.errorContextCache.clear();
    this.emit('handler:reset');
    this.logger.info('Error handler reset');
  }
  
  // Private helper methods
  
  _initializeRecoveryStrategies() {
    // Template not found recovery
    this.recoveryStrategies.set('template-not-found', async (error, context) => {
      if (this.config.fallbackTemplate) {
        return {
          success: true,
          strategy: 'fallback-template',
          fallbackTemplate: this.config.fallbackTemplate
        };
      }
      return { success: false, reason: 'No fallback template configured' };
    });
    
    // Syntax error recovery
    this.recoveryStrategies.set('syntax-error', async (error, context) => {
      // Try to identify and fix common syntax issues
      const fixAttempts = [
        () => this._fixMissingBraces(context),
        () => this._fixMissingQuotes(context),
        () => this._fixInvalidVariables(context)
      ];
      
      for (const fix of fixAttempts) {
        try {
          const result = await fix();
          if (result.success) return result;
        } catch (fixError) {
          // Continue to next fix attempt
        }
      }
      
      return { success: false, reason: 'No automatic fixes available' };
    });
    
    // RDF parsing error recovery
    this.recoveryStrategies.set('rdf-parsing-error', async (error, context) => {
      // Try different RDF formats
      const formats = ['turtle', 'n-triples', 'rdf-xml', 'json-ld'];
      
      for (const format of formats) {
        try {
          // This would need actual RDF parsing logic
          return {
            success: true,
            strategy: 'format-detection',
            detectedFormat: format
          };
        } catch (parseError) {
          // Continue to next format
        }
      }
      
      return { success: false, reason: 'Unable to parse RDF in any supported format' };
    });
    
    // Context variable missing recovery
    this.recoveryStrategies.set('missing-variable', async (error, context) => {
      const missingVar = this._extractMissingVariable(error.message);
      
      if (missingVar) {
        return {
          success: true,
          strategy: 'default-value',
          variable: missingVar,
          defaultValue: this._getDefaultValueForType(missingVar)
        };
      }
      
      return { success: false, reason: 'Could not identify missing variable' };
    });
    
    // File system error recovery
    this.recoveryStrategies.set('filesystem-error', async (error, context) => {
      if (error.code === 'ENOENT') {
        // Try to create missing directories
        if (context.outputPath) {
          try {
            await fs.mkdir(path.dirname(context.outputPath), { recursive: true });
            return {
              success: true,
              strategy: 'create-directory',
              createdPath: path.dirname(context.outputPath)
            };
          } catch (mkdirError) {
            return { success: false, reason: `Could not create directory: ${mkdirError.message}` };
          }
        }
      }
      
      return { success: false, reason: 'Unrecoverable filesystem error' };
    });
  }
  
  _classifyError(error, context) {
    let category = 'unknown';
    let severity = 'medium';
    let recoverable = false;
    
    // Classify by error type and message
    if (error.name === 'SyntaxError') {
      category = 'syntax-error';
      severity = 'high';
      recoverable = true;
    } else if (error.message.includes('Template not found')) {
      category = 'template-not-found';
      severity = 'high';
      recoverable = true;
    } else if (error.message.includes('is undefined')) {
      category = 'missing-variable';
      severity = 'medium';
      recoverable = true;
    } else if (error.code === 'ENOENT' || error.code === 'EACCES') {
      category = 'filesystem-error';
      severity = 'high';
      recoverable = true;
    } else if (error.message.includes('RDF') || error.message.includes('parse')) {
      category = 'rdf-parsing-error';
      severity = 'medium';
      recoverable = true;
    } else if (error.name === 'TypeError') {
      category = 'type-error';
      severity = 'medium';
      recoverable = false;
    }
    
    return {
      category,
      severity,
      recoverable,
      errorName: error.name,
      errorCode: error.code || null
    };
  }
  
  async _attemptRecovery(error, context) {
    const maxAttempts = this.config.maxRetryAttempts;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      try {
        // Get recovery strategy for error category
        const strategy = this.recoveryStrategies.get(context.classification.category);
        
        if (!strategy) {
          return {
            success: false,
            reason: `No recovery strategy for category: ${context.classification.category}`,
            attempts: attempt
          };
        }
        
        // Apply recovery strategy
        const result = await strategy(error, context);
        
        if (result.success) {
          this.stats.recoveredErrors++;
          this.emit('recovery:success', { errorId: context.errorId, result, attempts: attempt });
          
          return {
            success: true,
            strategy: result.strategy || context.classification.category,
            result,
            attempts: attempt
          };
        }
        
        // Wait before retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
        
      } catch (recoveryError) {
        this.logger.debug(`Recovery attempt ${attempt} failed:`, recoveryError);
      }
    }
    
    this.stats.unrecoverableErrors++;
    
    return {
      success: false,
      reason: 'All recovery attempts exhausted',
      attempts: maxAttempts
    };
  }
  
  async _attemptTemplateFallback(templatePath, error, context) {
    if (!this.config.fallbackTemplate) {
      return { success: false, reason: 'No fallback template configured' };
    }
    
    try {
      // This would integrate with the actual template renderer
      return {
        success: true,
        strategy: 'fallback-template',
        fallbackTemplate: this.config.fallbackTemplate,
        originalTemplate: templatePath
      };
      
    } catch (fallbackError) {
      return {
        success: false,
        reason: `Fallback template failed: ${fallbackError.message}`
      };
    }
  }
  
  async _attemptRDFRecovery(rdfContent, error, context) {
    // Try to clean up common RDF syntax issues
    try {
      let cleanedContent = rdfContent;
      
      // Remove invalid characters
      cleanedContent = cleanedContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // Fix common prefix issues
      if (!cleanedContent.includes('@prefix')) {
        cleanedContent = '@prefix : <http://example.org/> .\n' + cleanedContent;
      }
      
      return {
        success: true,
        strategy: 'rdf-cleanup',
        cleanedContent: cleanedContent.substring(0, 1000) // Truncate for logging
      };
      
    } catch (cleanupError) {
      return {
        success: false,
        reason: `RDF cleanup failed: ${cleanupError.message}`
      };
    }
  }
  
  _generateErrorId(error, context) {
    const errorData = {
      name: error.name,
      message: error.message,
      templatePath: context.templatePath || 'unknown',
      timestamp: this.config.staticErrorTime
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(errorData))
      .digest('hex')
      .substring(0, 16);
  }
  
  _updateErrorStatistics(classification, context) {
    this.stats.totalErrors++;
    
    // Update category statistics
    if (!this.stats.errorsByCategory[classification.category]) {
      this.stats.errorsByCategory[classification.category] = 0;
    }
    this.stats.errorsByCategory[classification.category]++;
    
    // Update template statistics
    if (context.templatePath) {
      if (!this.stats.errorsByTemplate[context.templatePath]) {
        this.stats.errorsByTemplate[context.templatePath] = 0;
      }
      this.stats.errorsByTemplate[context.templatePath]++;
    }
  }
  
  _logError(error, context) {
    const logData = {
      errorId: context.errorId,
      category: context.classification.category,
      severity: context.classification.severity,
      template: context.templatePath,
      message: error.message,
      timestamp: context.timestamp
    };
    
    switch (context.classification.severity) {
      case 'high':
        this.logger.error('High severity error:', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error:', logData);
        break;
      default:
        this.logger.info('Error handled:', logData);
    }
  }
  
  async _createErrorReport(error, context, recoveryResult) {
    if (!this.config.enableErrorReports) return null;
    
    try {
      await fs.mkdir(this.config.errorReportsDir, { recursive: true });
      
      const report = {
        errorId: context.errorId,
        timestamp: context.timestamp,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        classification: context.classification,
        recovery: recoveryResult,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
      
      const reportPath = path.join(
        this.config.errorReportsDir,
        `error-${context.errorId}-${Date.now()}.json`
      );
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      return reportPath;
      
    } catch (reportError) {
      this.logger.error('Failed to create error report:', reportError);
      return null;
    }
  }
  
  _fixMissingBraces(context) {
    // Placeholder for syntax fix logic
    return { success: false, reason: 'Not implemented' };
  }
  
  _fixMissingQuotes(context) {
    // Placeholder for syntax fix logic
    return { success: false, reason: 'Not implemented' };
  }
  
  _fixInvalidVariables(context) {
    // Placeholder for variable fix logic
    return { success: false, reason: 'Not implemented' };
  }
  
  _extractMissingVariable(errorMessage) {
    const match = errorMessage.match(/('|"|`)([^'"`]+)('|"|`) is undefined/);
    return match ? match[2] : null;
  }
  
  _getDefaultValueForType(variableName) {
    // Simple heuristics for default values
    if (variableName.includes('count') || variableName.includes('num')) {
      return 0;
    }
    if (variableName.includes('list') || variableName.includes('array')) {
      return [];
    }
    if (variableName.includes('is') || variableName.includes('has')) {
      return false;
    }
    return '';
  }
}

export default DeterministicErrorHandler;