/**
 * Comprehensive Error Handling Utilities
 * Provides structured error handling with context preservation, event emission, and recovery strategies
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import crypto from 'crypto';

export class KGenErrorHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableEventEmission: config.enableEventEmission !== false,
      enableRecovery: config.enableRecovery !== false,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      logLevel: config.logLevel || 'error',
      ...config
    };
    
    this.logger = consola.withTag('kgen-error-handler');
    this.errorHistory = new Map();
    this.recoveryStrategies = new Map();
  }

  /**
   * Create comprehensive error context
   * @param {string} operationId - Unique operation identifier
   * @param {Error} error - Original error object
   * @param {Object} context - Additional context information
   * @param {Object} options - Error handling options
   * @returns {Object} Structured error object
   */
  createErrorContext(operationId, error, context = {}, options = {}) {
    const errorId = crypto.randomUUID();
    const timestamp = this.getDeterministicDate();
    
    const errorContext = {
      errorId,
      operationId,
      timestamp,
      error: {
        message: error.message || 'Unknown error',
        name: error.name || 'Error',
        stack: error.stack,
        code: error.code,
        cause: error.cause
      },
      context: {
        component: context.component,
        operation: context.operation,
        input: context.input,
        state: context.state,
        metadata: context.metadata || {}
      },
      classification: this._classifyError(error),
      severity: this._determineSeverity(error, context),
      recoverable: this._isRecoverable(error, context),
      retryAttempt: options.retryAttempt || 0,
      maxRetries: options.maxRetries || this.config.maxRetryAttempts
    };

    // Store in error history
    this.errorHistory.set(errorId, errorContext);
    
    return errorContext;
  }

  /**
   * Handle error with full context preservation and recovery
   * @param {string} operationId - Operation identifier
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @param {Object} options - Handling options
   */
  async handleError(operationId, error, context = {}, options = {}) {
    const errorContext = this.createErrorContext(operationId, error, context, options);
    
    try {
      // Log error with appropriate level
      this._logError(errorContext);
      
      // Emit error event if enabled
      if (this.config.enableEventEmission) {
        this.emit('error', {
          operationId,
          errorId: errorContext.errorId,
          errorContext,
          timestamp: errorContext.timestamp
        });
        
        this.emit(`error:${errorContext.classification}`, errorContext);
      }
      
      // Attempt recovery if enabled and error is recoverable
      if (this.config.enableRecovery && errorContext.recoverable) {
        const recoveryResult = await this._attemptRecovery(errorContext, options);
        if (recoveryResult.recovered) {
          this.emit('recovery:success', {
            operationId,
            errorId: errorContext.errorId,
            recoveryStrategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts
          });
          return recoveryResult;
        }
      }
      
      // Emit final error event
      this.emit('error:unrecoverable', {
        operationId,
        errorId: errorContext.errorId,
        errorContext
      });
      
      return {
        handled: true,
        recovered: false,
        errorContext,
        shouldRethrow: !options.suppressRethrow
      };
      
    } catch (handlingError) {
      this.logger.error('Error occurred while handling error:', handlingError);
      
      // Emit critical error event
      this.emit('error:critical', {
        operationId,
        originalError: errorContext,
        handlingError: handlingError.message
      });
      
      return {
        handled: false,
        recovered: false,
        errorContext,
        handlingError,
        shouldRethrow: true
      };
    }
  }

  /**
   * Register recovery strategy for specific error types
   * @param {string} errorType - Error type/classification
   * @param {Function} strategy - Recovery function
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Create error wrapper for try/catch blocks
   * @param {string} operationId - Operation identifier
   * @param {Object} context - Operation context
   * @returns {Object} Error handling functions
   */
  createErrorWrapper(operationId, context = {}) {
    return {
      wrap: async (operation) => {
        try {
          return await operation();
        } catch (error) {
          const result = await this.handleError(operationId, error, context);
          if (result.shouldRethrow && !result.recovered) {
            throw error;
          }
          return result;
        }
      },
      
      wrapSync: (operation) => {
        try {
          return operation();
        } catch (error) {
          const errorContext = this.createErrorContext(operationId, error, context);
          this._logError(errorContext);
          
          if (this.config.enableEventEmission) {
            this.emit('error', {
              operationId,
              errorId: errorContext.errorId,
              errorContext
            });
          }
          
          throw error;
        }
      }
    };
  }

  /**
   * Get error statistics and history
   */
  getErrorStatistics() {
    const errors = Array.from(this.errorHistory.values());
    const now = this.getDeterministicTimestamp();
    const last24h = errors.filter(e => now - e.timestamp.getTime() < 24 * 60 * 60 * 1000);
    
    const byClassification = {};
    const bySeverity = {};
    
    errors.forEach(error => {
      byClassification[error.classification] = (byClassification[error.classification] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });
    
    return {
      total: errors.length,
      last24h: last24h.length,
      byClassification,
      bySeverity,
      recoverable: errors.filter(e => e.recoverable).length,
      unrecoverable: errors.filter(e => !e.recoverable).length
    };
  }

  // Private methods

  _classifyError(error) {
    if (error.code) {
      if (error.code.startsWith('ENOENT') || error.code.startsWith('EACCES')) {
        return 'filesystem';
      }
      if (error.code.startsWith('ECONNREFUSED') || error.code.startsWith('ETIMEDOUT')) {
        return 'network';
      }
    }
    
    if (error.name) {
      if (error.name === 'ValidationError') return 'validation';
      if (error.name === 'SyntaxError') return 'syntax';
      if (error.name === 'TypeError') return 'type';
      if (error.name === 'ReferenceError') return 'reference';
    }
    
    if (error.message) {
      if (error.message.includes('timeout')) return 'timeout';
      if (error.message.includes('permission')) return 'permission';
      if (error.message.includes('not found')) return 'notfound';
    }
    
    return 'unknown';
  }

  _determineSeverity(error, context) {
    // Critical errors that affect system stability
    if (error.name === 'OutOfMemoryError' || 
        error.message?.includes('FATAL') ||
        context.component === 'core') {
      return 'critical';
    }
    
    // High severity errors that affect functionality
    if (error.name === 'SecurityError' ||
        error.code?.startsWith('EACCES') ||
        context.operation?.includes('security')) {
      return 'high';
    }
    
    // Medium severity for business logic errors
    if (error.name === 'ValidationError' ||
        error.name === 'BusinessLogicError') {
      return 'medium';
    }
    
    // Low severity for minor issues
    if (error.name === 'WarningError' ||
        error.message?.includes('deprecated')) {
      return 'low';
    }
    
    return 'medium';
  }

  _isRecoverable(error, context) {
    // Network and timeout errors are often recoverable
    if (error.code?.startsWith('ECONN') || 
        error.code?.startsWith('ETIMEDOUT') ||
        error.message?.includes('timeout')) {
      return true;
    }
    
    // Temporary filesystem issues may be recoverable
    if (error.code === 'EBUSY' || error.code === 'EAGAIN') {
      return true;
    }
    
    // Validation errors may be recoverable with different input
    if (error.name === 'ValidationError') {
      return true;
    }
    
    // Memory errors are generally not recoverable
    if (error.name === 'OutOfMemoryError') {
      return false;
    }
    
    // Security errors should not be automatically recovered
    if (error.name === 'SecurityError' || context.operation?.includes('security')) {
      return false;
    }
    
    // Default to recoverable for unknown errors
    return true;
  }

  _logError(errorContext) {
    const logData = {
      errorId: errorContext.errorId,
      operationId: errorContext.operationId,
      classification: errorContext.classification,
      severity: errorContext.severity,
      message: errorContext.error.message,
      component: errorContext.context.component
    };
    
    switch (errorContext.severity) {
      case 'critical':
        this.logger.fatal('Critical error occurred:', logData);
        break;
      case 'high':
        this.logger.error('High severity error:', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error:', logData);
        break;
      case 'low':
        this.logger.info('Low severity error:', logData);
        break;
      default:
        this.logger.error('Error occurred:', logData);
    }
  }

  async _attemptRecovery(errorContext, options = {}) {
    if (errorContext.retryAttempt >= errorContext.maxRetries) {
      return { recovered: false, reason: 'Max retries exceeded' };
    }
    
    const strategy = this.recoveryStrategies.get(errorContext.classification);
    if (!strategy) {
      return { recovered: false, reason: 'No recovery strategy available' };
    }
    
    try {
      // Wait before retry
      if (errorContext.retryAttempt > 0) {
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, errorContext.retryAttempt))
        );
      }
      
      const result = await strategy(errorContext, options);
      
      if (result.success) {
        return {
          recovered: true,
          strategy: errorContext.classification,
          attempts: errorContext.retryAttempt + 1,
          result
        };
      }
      
      return { recovered: false, reason: result.reason || 'Recovery strategy failed' };
      
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed:', recoveryError);
      return {
        recovered: false,
        reason: `Recovery error: ${recoveryError.message}`
      };
    }
  }
}

/**
 * Create enhanced try/catch wrapper with comprehensive error handling
 * @param {string} operationId - Operation identifier
 * @param {Object} context - Operation context
 * @param {KGenErrorHandler} errorHandler - Error handler instance
 * @returns {Function} Enhanced try/catch function
 */
export function createEnhancedTryCatch(operationId, context, errorHandler) {
  return async (operation, options = {}) => {
    try {
      const startTime = this.getDeterministicTimestamp();
      const result = await operation();
      
      // Emit success event
      if (errorHandler?.config.enableEventEmission) {
        errorHandler.emit('operation:success', {
          operationId,
          duration: this.getDeterministicTimestamp() - startTime,
          context
        });
      }
      
      return result;
      
    } catch (error) {
      if (errorHandler) {
        const handlingResult = await errorHandler.handleError(
          operationId, 
          error, 
          context, 
          options
        );
        
        if (handlingResult.recovered) {
          return handlingResult.result;
        }
        
        if (!handlingResult.shouldRethrow) {
          return handlingResult;
        }
      }
      
      throw error;
    }
  };
}

export default KGenErrorHandler;