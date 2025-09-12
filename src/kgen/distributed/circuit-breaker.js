/**
 * Circuit Breaker Implementation for Fault Tolerance
 * 
 * Provides fault tolerance and cascading failure prevention in distributed KGEN systems.
 * Implements circuit breaker pattern with intelligent failure detection and recovery.
 */

import EventEmitter from 'events';

export class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      failureThreshold: options.failureThreshold || 5, // Number of failures before opening
      successThreshold: options.successThreshold || 3, // Number of successes to close circuit
      timeout: options.timeout || 60000, // Request timeout in ms
      resetTimeout: options.resetTimeout || 300000, // Time before trying to close circuit (5 min)
      monitoringPeriod: options.monitoringPeriod || 60000, // Period for calculating failure rate
      volumeThreshold: options.volumeThreshold || 10, // Minimum requests before opening circuit
      errorThresholdPercentage: options.errorThresholdPercentage || 50, // Failure rate threshold
      ...options.config
    };
    
    // Circuit states: CLOSED, OPEN, HALF_OPEN
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = 0;
    
    // Request tracking
    this.requests = []; // Recent requests with timestamps and results
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    
    // Statistics
    this.statistics = {
      totalExecutions: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalCircuitOpenRejections: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      stateTransitions: {
        CLOSED_to_OPEN: 0,
        OPEN_to_HALF_OPEN: 0,
        HALF_OPEN_to_CLOSED: 0,
        HALF_OPEN_to_OPEN: 0
      }
    };
    
    this.debug = options.debug || false;
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn, ...args) {
    const startTime = Date.now();
    this.statistics.totalExecutions++;
    
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.statistics.totalCircuitOpenRejections++;
        const error = new Error('Circuit breaker is OPEN');
        error.code = 'CIRCUIT_OPEN';
        throw error;
      } else {
        // Time to try half-open
        this.transitionTo('HALF_OPEN');
      }
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, args);
      
      // Record success
      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);
      
      // Handle state transitions on success
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo('CLOSED');
        }
      }
      
      return result;
      
    } catch (error) {
      // Record failure
      const responseTime = Date.now() - startTime;
      this.recordFailure(error, responseTime);
      
      // Handle state transitions on failure
      if (this.state === 'HALF_OPEN') {
        this.transitionTo('OPEN');
      } else if (this.state === 'CLOSED') {
        this.evaluateCircuitOpen();
      }
      
      throw error;
    }
  }
  
  /**
   * Execute function with timeout protection
   */
  executeWithTimeout(fn, args) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.statistics.totalTimeouts++;
        const error = new Error(`Operation timed out after ${this.config.timeout}ms`);
        error.code = 'TIMEOUT';
        reject(error);
      }, this.config.timeout);
      
      Promise.resolve(fn(...args))
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }
  
  /**
   * Record successful execution
   */
  recordSuccess(responseTime) {
    this.totalRequests++;
    this.totalSuccesses++;
    this.statistics.totalSuccesses++;
    this.statistics.totalResponseTime += responseTime;
    this.statistics.averageResponseTime = this.statistics.totalResponseTime / this.statistics.totalExecutions;
    
    // Add to recent requests
    this.requests.push({
      timestamp: Date.now(),
      success: true,
      responseTime
    });
    
    this.cleanupOldRequests();
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Success recorded, response time: ${responseTime}ms`);
    }
  }
  
  /**
   * Record failed execution
   */
  recordFailure(error, responseTime) {
    this.totalRequests++;
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.statistics.totalFailures++;
    
    if (error.code === 'TIMEOUT') {
      this.statistics.totalTimeouts++;
    }
    
    // Add to recent requests
    this.requests.push({
      timestamp: Date.now(),
      success: false,
      error: error.message,
      errorCode: error.code,
      responseTime
    });
    
    this.cleanupOldRequests();
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Failure recorded: ${error.message}`);
    }
  }
  
  /**
   * Evaluate if circuit should be opened
   */
  evaluateCircuitOpen() {
    const recentRequests = this.getRecentRequests();
    
    // Check volume threshold
    if (recentRequests.length < this.config.volumeThreshold) {
      return;
    }
    
    // Calculate failure rate
    const failures = recentRequests.filter(req => !req.success).length;
    const failureRate = (failures / recentRequests.length) * 100;
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Failure rate: ${failureRate.toFixed(2)}% (threshold: ${this.config.errorThresholdPercentage}%)`);
    }
    
    // Check failure threshold
    if (this.failureCount >= this.config.failureThreshold || 
        failureRate >= this.config.errorThresholdPercentage) {
      this.transitionTo('OPEN');
    }
  }
  
  /**
   * Transition circuit breaker to new state
   */
  transitionTo(newState) {
    const oldState = this.state;
    
    if (oldState === newState) {
      return;
    }
    
    this.state = newState;
    
    // Record state transition
    const transitionKey = `${oldState}_to_${newState}`;
    if (this.statistics.stateTransitions[transitionKey] !== undefined) {
      this.statistics.stateTransitions[transitionKey]++;
    }
    
    // State-specific actions
    switch (newState) {
      case 'OPEN':
        this.nextAttempt = Date.now() + this.config.resetTimeout;
        this.emit('circuit:opened', { 
          failureCount: this.failureCount,
          lastFailure: this.lastFailureTime
        });
        break;
        
      case 'HALF_OPEN':
        this.successCount = 0;
        this.emit('circuit:half-opened');
        break;
        
      case 'CLOSED':
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.emit('circuit:closed');
        break;
    }
    
    if (this.debug) {
      console.log(`[CircuitBreaker] State transition: ${oldState} -> ${newState}`);
    }
  }
  
  /**
   * Get requests from recent monitoring period
   */
  getRecentRequests() {
    const cutoffTime = Date.now() - this.config.monitoringPeriod;
    return this.requests.filter(req => req.timestamp > cutoffTime);
  }
  
  /**
   * Clean up old request records
   */
  cleanupOldRequests() {
    const cutoffTime = Date.now() - (this.config.monitoringPeriod * 2); // Keep 2x monitoring period
    this.requests = this.requests.filter(req => req.timestamp > cutoffTime);
  }
  
  /**
   * Start monitoring and cleanup processes
   */
  startMonitoring() {
    // Periodic cleanup and evaluation
    setInterval(() => {
      this.cleanupOldRequests();
      
      // If circuit is open, check if it's time to try half-open
      if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
      }
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Get current circuit breaker statistics
   */
  getStatistics() {
    const recentRequests = this.getRecentRequests();
    const recentFailures = recentRequests.filter(req => !req.success).length;
    const recentSuccesses = recentRequests.filter(req => req.success).length;
    
    const currentFailureRate = recentRequests.length > 0 
      ? (recentFailures / recentRequests.length) * 100 
      : 0;
    
    return {
      ...this.statistics,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      recentRequests: recentRequests.length,
      recentFailures,
      recentSuccesses,
      currentFailureRate: currentFailureRate.toFixed(2),
      isCircuitOpen: this.state === 'OPEN',
      timeUntilRetry: this.state === 'OPEN' ? Math.max(0, this.nextAttempt - Date.now()) : 0
    };
  }
  
  /**
   * Get current state of the circuit breaker
   */
  getState() {
    return this.state;
  }
  
  /**
   * Check if circuit is available for requests
   */
  isAvailable() {
    if (this.state === 'OPEN' && Date.now() < this.nextAttempt) {
      return false;
    }
    return true;
  }
  
  /**
   * Manually force circuit to open (for testing or emergency)
   */
  forceOpen(reason = 'Manual override') {
    this.transitionTo('OPEN');
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Manually forced open: ${reason}`);
    }
    
    this.emit('circuit:forced-open', { reason });
  }
  
  /**
   * Manually force circuit to close (for testing or recovery)
   */
  forceClose(reason = 'Manual override') {
    this.transitionTo('CLOSED');
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Manually forced closed: ${reason}`);
    }
    
    this.emit('circuit:forced-closed', { reason });
  }
  
  /**
   * Reset circuit breaker statistics
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = 0;
    this.requests = [];
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    
    this.statistics = {
      totalExecutions: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalCircuitOpenRejections: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      stateTransitions: {
        CLOSED_to_OPEN: 0,
        OPEN_to_HALF_OPEN: 0,
        HALF_OPEN_to_CLOSED: 0,
        HALF_OPEN_to_OPEN: 0
      }
    };
    
    if (this.debug) {
      console.log(`[CircuitBreaker] Reset to initial state`);
    }
    
    this.emit('circuit:reset');
  }
  
  /**
   * Health check for the circuit breaker
   */
  healthCheck() {
    const stats = this.getStatistics();
    const recentRequests = this.getRecentRequests();
    
    const isHealthy = this.state === 'CLOSED' || 
      (this.state === 'HALF_OPEN' && recentRequests.length < this.config.volumeThreshold);
    
    return {
      healthy: isHealthy,
      state: this.state,
      available: this.isAvailable(),
      failureRate: stats.currentFailureRate,
      recentActivity: {
        requests: recentRequests.length,
        failures: stats.recentFailures,
        successes: stats.recentSuccesses
      },
      configuration: this.config
    };
  }
  
  /**
   * Create a wrapped version of a function with circuit breaker protection
   */
  wrap(fn, name = 'wrapped-function') {
    const circuitBreaker = this;
    
    const wrappedFunction = async function(...args) {
      return await circuitBreaker.execute(fn, ...args);
    };
    
    // Add utility methods
    wrappedFunction.getState = () => circuitBreaker.getState();
    wrappedFunction.getStatistics = () => circuitBreaker.getStatistics();
    wrappedFunction.isAvailable = () => circuitBreaker.isAvailable();
    wrappedFunction.healthCheck = () => circuitBreaker.healthCheck();
    wrappedFunction.forceOpen = (reason) => circuitBreaker.forceOpen(reason);
    wrappedFunction.forceClose = (reason) => circuitBreaker.forceClose(reason);
    wrappedFunction.reset = () => circuitBreaker.reset();
    
    // Add name for debugging
    Object.defineProperty(wrappedFunction, 'name', {
      value: name,
      configurable: true
    });
    
    return wrappedFunction;
  }
}

export default CircuitBreaker;
