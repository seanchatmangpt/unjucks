/**
 * Async test helper with timeout management and error recovery
 * Provides utilities for reliable async testing and flaky test elimination
 */

import { EventEmitter } from 'events';

export class AsyncTestHelper extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      defaultTimeout: options.defaultTimeout || 5000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 100,
      maxConcurrency: options.maxConcurrency || 10,
      progressReporting: options.progressReporting || false,
      errorRecovery: options.errorRecovery || true,
      ...options
    };
    
    this.activePromises = new Set();
    this.timeouts = new Set();
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      timeoutOperations: 0
    };
  }

  /**
   * Execute async operation with timeout and retry logic
   */
  async withTimeout(operation, timeout = this.options.defaultTimeout, operationName = 'operation') {
    this.stats.totalOperations++;
    
    let lastError;
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        const promise = this.executeWithTimeoutAndCancellation(operation, timeout, operationName);
        this.activePromises.add(promise);
        
        const result = await promise;
        this.activePromises.delete(promise);
        this.stats.successfulOperations++;
        
        if (attempt > 0) {
          this.stats.retriedOperations++;
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (error.message.includes('timeout')) {
          this.stats.timeoutOperations++;
        }
        
        if (attempt < this.options.retryAttempts - 1) {
          if (this.options.progressReporting) {
            this.emit('retry', { attempt: attempt + 1, error, operationName });
          }
          
          // Wait before retry with exponential backoff
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }
    
    this.stats.failedOperations++;
    throw new Error(`Operation '${operationName}' failed after ${this.options.retryAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Execute operation with timeout and cancellation support
   */
  async executeWithTimeoutAndCancellation(operation, timeout, operationName) {
    let timeoutHandle;
    let cancelled = false;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        cancelled = true;
        reject(new Error(`Operation '${operationName}' timed out after ${timeout}ms`));
      }, timeout);
      this.timeouts.add(timeoutHandle);
    });

    try {
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      if (cancelled) {
        throw new Error(`Operation '${operationName}' was cancelled`);
      }
      
      return result;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        this.timeouts.delete(timeoutHandle);
      }
    }
  }

  /**
   * Execute multiple async operations with concurrency control
   */
  async executeParallel(operations, options = {}) {
    const { 
      concurrency = this.options.maxConcurrency,
      timeout = this.options.defaultTimeout,
      failFast = false,
      preserveOrder = true
    } = options;

    if (operations.length === 0) {
      return [];
    }

    const results = new Array(operations.length);
    const errors = [];
    let completedCount = 0;

    const semaphore = new Semaphore(concurrency);
    
    const executeOperation = async (operation, index) => {
      await semaphore.acquire();
      
      try {
        const result = await this.withTimeout(
          operation, 
          timeout, 
          `parallel-operation-${index}`
        );
        
        if (preserveOrder) {
          results[index] = { success: true, result };
        } else {
          results.push({ success: true, result, index });
        }
        
        completedCount++;
        
        if (this.options.progressReporting) {
          this.emit('progress', { 
            completed: completedCount, 
            total: operations.length,
            percentage: (completedCount / operations.length) * 100
          });
        }
        
      } catch (error) {
        const errorInfo = { success: false, error, index };
        
        if (preserveOrder) {
          results[index] = errorInfo;
        } else {
          results.push(errorInfo);
        }
        
        errors.push(errorInfo);
        
        if (failFast) {
          throw error;
        }
      } finally {
        semaphore.release();
      }
    };

    // Execute all operations
    const promises = operations.map((operation, index) => 
      executeOperation(operation, index)
    );

    if (failFast) {
      await Promise.all(promises);
    } else {
      await Promise.allSettled(promises);
    }

    if (errors.length > 0 && failFast) {
      throw new Error(`${errors.length} operations failed`);
    }

    return {
      results: preserveOrder ? results : results.sort((a, b) => a.index - b.index),
      errors,
      successCount: completedCount,
      errorCount: errors.length
    };
  }

  /**
   * Wait for condition with timeout and polling
   */
  async waitFor(conditionFn, options = {}) {
    const {
      timeout = this.options.defaultTimeout,
      pollInterval = 100,
      description = 'condition'
    } = options;

    const startTime = Date.now();
    
    return this.withTimeout(async () => {
      while (Date.now() - startTime < timeout) {
        try {
          const result = await conditionFn();
          if (result) {
            return result;
          }
        } catch (error) {
          if (this.options.errorRecovery) {
            // Continue polling on errors unless it's a critical error
            if (error.message.includes('ECONNREFUSED') || 
                error.message.includes('timeout') ||
                error.message.includes('ENOENT')) {
              // Continue polling
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
        
        await this.delay(pollInterval);
      }
      
      throw new Error(`Condition '${description}' not met within ${timeout}ms`);
    }, timeout + 1000, `waitFor-${description}`);
  }

  /**
   * Execute with circuit breaker pattern
   */
  async withCircuitBreaker(operation, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitorPeriod = 10000
    } = options;

    if (!this.circuitBreakerState) {
      this.circuitBreakerState = {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed' // closed, open, half-open
      };
    }

    const state = this.circuitBreakerState;
    const now = Date.now();

    // Check if circuit should be reset
    if (state.state === 'open' && (now - state.lastFailureTime) > resetTimeout) {
      state.state = 'half-open';
      state.failures = 0;
    }

    // Reject if circuit is open
    if (state.state === 'open') {
      throw new Error('Circuit breaker is open - operation rejected');
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (state.state === 'half-open') {
        state.state = 'closed';
      }
      state.failures = 0;
      
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailureTime = now;
      
      // Trip circuit breaker if threshold reached
      if (state.failures >= failureThreshold) {
        state.state = 'open';
      }
      
      throw error;
    }
  }

  /**
   * Execute with exponential backoff
   */
  async withExponentialBackoff(operation, options = {}) {
    const {
      maxAttempts = this.options.retryAttempts,
      baseDelay = this.options.retryDelay,
      maxDelay = 10000,
      jitter = true
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts - 1) {
          break;
        }
        
        // Calculate delay with exponential backoff
        let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        
        // Add jitter to prevent thundering herd
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Promise-based delay
   */
  async delay(ms) {
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, ms);
      this.timeouts.add(timeout);
      
      // Clean up timeout from tracking
      setTimeout(() => {
        this.timeouts.delete(timeout);
      }, ms + 100);
    });
  }

  /**
   * Create timeout promise
   */
  createTimeout(ms, message = 'Operation timed out') {
    return new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(message));
      }, ms);
      this.timeouts.add(timeout);
    });
  }

  /**
   * Cancel all active operations
   */
  async cancelAll() {
    // Clear all timeouts
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();

    // Wait for active promises to complete or timeout
    const cancelPromises = Array.from(this.activePromises).map(promise => 
      Promise.race([
        promise,
        this.createTimeout(1000, 'Cancellation timeout')
      ]).catch(() => {}) // Ignore errors during cancellation
    );

    await Promise.allSettled(cancelPromises);
    this.activePromises.clear();
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const total = this.stats.totalOperations;
    return {
      ...this.stats,
      successRate: total > 0 ? (this.stats.successfulOperations / total) * 100 : 0,
      failureRate: total > 0 ? (this.stats.failedOperations / total) * 100 : 0,
      timeoutRate: total > 0 ? (this.stats.timeoutOperations / total) * 100 : 0,
      retryRate: total > 0 ? (this.stats.retriedOperations / total) * 100 : 0,
      activeOperations: this.activePromises.size,
      activeTimeouts: this.timeouts.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      timeoutOperations: 0
    };
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    await this.cancelAll();
    this.resetStats();
    this.removeAllListeners();
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  constructor(count) {
    this.count = count;
    this.waiting = [];
  }

  async acquire() {
    if (this.count > 0) {
      this.count--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release() {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve();
    } else {
      this.count++;
    }
  }
}

/**
 * Create async test helper with default configuration
 */
export function createAsyncTestHelper(options = {}) {
  return new AsyncTestHelper(options);
}

/**
 * Utility functions for async testing
 */
export const AsyncTestUtils = {
  /**
   * Create a flaky operation that fails randomly
   */
  createFlakyOperation: (successRate = 0.7, baseOperation = () => 'success') => {
    return async () => {
      if (Math.random() < successRate) {
        return await baseOperation();
      } else {
        throw new Error('Flaky operation failed');
      }
    };
  },

  /**
   * Create a slow operation that takes variable time
   */
  createSlowOperation: (minDelay = 100, maxDelay = 1000, result = 'completed') => {
    return async () => {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
      return result;
    };
  },

  /**
   * Create mock async operation for testing
   */
  createMockAsyncOperation: (behavior = 'success') => {
    switch (behavior) {
      case 'success':
        return async () => 'success';
      case 'failure':
        return async () => { throw new Error('Mock failure'); };
      case 'timeout':
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return 'never reached';
        };
      case 'flaky':
        return AsyncTestUtils.createFlakyOperation();
      case 'slow':
        return AsyncTestUtils.createSlowOperation();
      default:
        throw new Error(`Unknown behavior: ${behavior}`);
    }
  }
};

export default AsyncTestHelper;