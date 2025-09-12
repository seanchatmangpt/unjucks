/**
 * Advanced Circuit Breaker Implementation for KGEN
 * 
 * Provides sophisticated circuit breaker functionality with:
 * - Multiple failure thresholds and policies
 * - Adaptive timeout management
 * - Health-based state transitions
 * - Metrics and monitoring integration
 * - Bulkhead isolation patterns
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: 'closed',      // Normal operation
  OPEN: 'open',          // Failing fast, rejecting calls
  HALF_OPEN: 'half_open' // Testing if service recovered
};

/**
 * Failure policies
 */
export const FailurePolicy = {
  CONSECUTIVE: 'consecutive',   // Consecutive failures
  PERCENTAGE: 'percentage',     // Percentage of failures
  RATE: 'rate'                 // Failure rate over time
};

/**
 * Advanced Circuit Breaker with Self-Healing Capabilities
 */
export class CircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.config = {
      // Failure thresholds
      failureThreshold: options.failureThreshold || 5,
      failurePercentage: options.failurePercentage || 50, // 50%
      volumeThreshold: options.volumeThreshold || 10, // Min requests before percentage calculation
      
      // Timeout settings
      timeout: options.timeout || 60000, // 60 seconds
      adaptiveTimeout: options.adaptiveTimeout !== false,
      minTimeout: options.minTimeout || 5000,
      maxTimeout: options.maxTimeout || 300000, // 5 minutes
      
      // Health check settings
      healthCheckInterval: options.healthCheckInterval || 30000,
      healthCheckTimeout: options.healthCheckTimeout || 5000,
      halfOpenMaxCalls: options.halfOpenMaxCalls || 3,
      
      // Policy settings
      failurePolicy: options.failurePolicy || FailurePolicy.CONSECUTIVE,
      timeWindow: options.timeWindow || 60000, // 1 minute for rate calculations
      
      // Bulkhead settings
      maxConcurrentCalls: options.maxConcurrentCalls || 100,
      
      ...options
    };
    
    this.logger = consola.withTag(`circuit-breaker:${name}`);
    
    // State management
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.nextAttemptTime = 0;
    
    // Counters
    this.consecutiveFailures = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.totalCalls = 0;
    this.halfOpenCalls = 0;
    this.concurrentCalls = 0;
    
    // Time-window tracking for rate-based policies
    this.callHistory = [];
    this.failureHistory = [];
    
    // Health check management
    this.healthCheckTimer = null;
    this.adaptiveTimeoutValue = this.config.timeout;
    
    // Metrics
    this.metrics = {
      stateTransitions: 0,
      rejectedCalls: 0,
      slowCalls: 0,
      healthChecksPerformed: 0,
      timeoutAdjustments: 0
    };
    
    this._startHealthChecking();
    this._startMetricsCollection();
  }
  
  /**
   * Execute operation with circuit breaker protection
   */
  async execute(operation, fallback = null) {
    const callId = this._generateCallId();
    const startTime = Date.now();
    
    try {
      // Check if we can execute the call
      this._checkCanExecute();
      
      // Track concurrent calls for bulkhead pattern
      this.concurrentCalls++;
      this.totalCalls++;
      
      this.logger.debug(`Executing call ${callId} in ${this.state} state`);
      
      // Execute with timeout
      const result = await this._executeWithTimeout(operation, callId);
      
      // Record success
      this._recordSuccess(Date.now() - startTime);
      
      this.logger.debug(`Call ${callId} succeeded in ${Date.now() - startTime}ms`);
      
      return result;
      
    } catch (error) {
      // Record failure
      this._recordFailure(error, Date.now() - startTime);
      
      this.logger.warn(`Call ${callId} failed: ${error.message}`);
      
      // Execute fallback if available
      if (fallback && typeof fallback === 'function') {
        try {
          this.logger.debug(`Executing fallback for call ${callId}`);
          const fallbackResult = await fallback(error);
          return { success: true, result: fallbackResult, fallback: true };
        } catch (fallbackError) {
          this.logger.error(`Fallback failed for call ${callId}:`, fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
      
    } finally {
      this.concurrentCalls--;
    }
  }
  
  /**
   * Force state change (for testing or manual intervention)
   */
  forceState(newState, reason = 'manual') {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.metrics.stateTransitions++;
    
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.adaptiveTimeoutValue;
    }
    
    this.logger.info(`Circuit breaker state changed: ${oldState} -> ${newState} (${reason})`);
    this.emit('state:changed', { oldState, newState, reason, timestamp: Date.now() });
  }
  
  /**
   * Check if operation can be executed
   */
  _checkCanExecute() {
    // Check bulkhead limit
    if (this.concurrentCalls >= this.config.maxConcurrentCalls) {
      this.metrics.rejectedCalls++;
      throw new Error(`Circuit breaker ${this.name}: Too many concurrent calls (${this.concurrentCalls}/${this.config.maxConcurrentCalls})`);
    }
    
    switch (this.state) {
      case CircuitState.CLOSED:
        return; // Always allow calls
        
      case CircuitState.OPEN:
        if (Date.now() < this.nextAttemptTime) {
          this.metrics.rejectedCalls++;
          throw new Error(`Circuit breaker ${this.name} is OPEN. Next attempt allowed at ${new Date(this.nextAttemptTime).toISOString()}`);
        }
        // Transition to half-open for testing
        this._transitionToHalfOpen();
        return;
        
      case CircuitState.HALF_OPEN:
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          this.metrics.rejectedCalls++;
          throw new Error(`Circuit breaker ${this.name} is HALF_OPEN with max test calls reached`);
        }
        this.halfOpenCalls++;
        return;
        
      default:
        throw new Error(`Invalid circuit breaker state: ${this.state}`);
    }
  }
  
  /**
   * Execute operation with adaptive timeout
   */
  async _executeWithTimeout(operation, callId) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.logger.warn(`Call ${callId} timed out after ${this.adaptiveTimeoutValue}ms`);
        reject(new Error(`Operation timed out after ${this.adaptiveTimeoutValue}ms`));
      }, this.adaptiveTimeoutValue);
      
      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  
  /**
   * Record successful operation
   */
  _recordSuccess(responseTime) {
    this.totalSuccesses++;
    this.consecutiveFailures = 0;
    
    // Add to call history for rate calculations
    this._addToHistory(this.callHistory, { success: true, timestamp: Date.now(), responseTime });
    
    // Adjust adaptive timeout based on response time
    if (this.config.adaptiveTimeout) {
      this._adjustTimeout(responseTime, true);
    }
    
    // Check if we should close the circuit from half-open
    if (this.state === CircuitState.HALF_OPEN) {
      this._handleHalfOpenSuccess();
    }
    
    this.emit('call:success', {
      responseTime,
      state: this.state,
      timestamp: Date.now()
    });
  }
  
  /**
   * Record failed operation
   */
  _recordFailure(error, responseTime) {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    // Add to failure history for rate calculations
    this._addToHistory(this.failureHistory, { error: error.message, timestamp: Date.now(), responseTime });
    this._addToHistory(this.callHistory, { success: false, timestamp: Date.now(), responseTime, error: error.message });
    
    // Adjust adaptive timeout based on failure
    if (this.config.adaptiveTimeout) {
      this._adjustTimeout(responseTime, false);
    }
    
    // Check if we should open the circuit
    this._evaluateCircuitState(error);
    
    this.emit('call:failure', {
      error: error.message,
      responseTime,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      timestamp: Date.now()
    });
  }
  
  /**
   * Evaluate whether circuit should change state based on failures
   */
  _evaluateCircuitState(error) {
    let shouldOpen = false;
    
    switch (this.config.failurePolicy) {
      case FailurePolicy.CONSECUTIVE:
        shouldOpen = this.consecutiveFailures >= this.config.failureThreshold;
        break;
        
      case FailurePolicy.PERCENTAGE:
        if (this.totalCalls >= this.config.volumeThreshold) {
          const failureRate = (this.totalFailures / this.totalCalls) * 100;
          shouldOpen = failureRate >= this.config.failurePercentage;
        }
        break;
        
      case FailurePolicy.RATE:
        const recentFailures = this._getRecentFailures();
        const recentCalls = this._getRecentCalls();
        if (recentCalls.length >= this.config.volumeThreshold) {
          const failureRate = (recentFailures.length / recentCalls.length) * 100;
          shouldOpen = failureRate >= this.config.failurePercentage;
        }
        break;
    }
    
    if (shouldOpen) {
      if (this.state === CircuitState.HALF_OPEN) {
        // Failed during half-open test, go back to open with increased timeout
        this._transitionToOpen('half_open_test_failed');
      } else if (this.state === CircuitState.CLOSED) {
        // Normal failure threshold reached
        this._transitionToOpen('failure_threshold_reached');
      }
    }
  }
  
  /**
   * Transition to OPEN state
   */
  _transitionToOpen(reason) {
    const oldState = this.state;
    this.state = CircuitState.OPEN;
    this.lastStateChange = Date.now();
    this.metrics.stateTransitions++;
    this.halfOpenCalls = 0;
    
    // Calculate next attempt time with backoff
    const backoffMultiplier = Math.min(Math.pow(2, this.metrics.stateTransitions), 8); // Max 8x backoff
    this.nextAttemptTime = Date.now() + (this.adaptiveTimeoutValue * backoffMultiplier);
    
    this.logger.warn(`Circuit breaker opened: ${reason}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`);
    
    this.emit('state:changed', {
      oldState,
      newState: CircuitState.OPEN,
      reason,
      nextAttemptTime: this.nextAttemptTime,
      timestamp: Date.now()
    });
    
    // Start health checking to automatically transition to half-open
    this._scheduleStateTransition();
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  _transitionToHalfOpen() {
    const oldState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = Date.now();
    this.metrics.stateTransitions++;
    this.halfOpenCalls = 0;
    
    this.logger.info('Circuit breaker transitioned to HALF_OPEN for testing');
    
    this.emit('state:changed', {
      oldState,
      newState: CircuitState.HALF_OPEN,
      reason: 'timeout_expired',
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle success during half-open state
   */
  _handleHalfOpenSuccess() {
    // If we've had enough successful test calls, close the circuit
    if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      const oldState = this.state;
      this.state = CircuitState.CLOSED;
      this.lastStateChange = Date.now();
      this.metrics.stateTransitions++;
      this.halfOpenCalls = 0;
      this.consecutiveFailures = 0;
      
      this.logger.info('Circuit breaker closed after successful half-open tests');
      
      this.emit('state:changed', {
        oldState,
        newState: CircuitState.CLOSED,
        reason: 'half_open_success',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Adjust timeout based on response patterns
   */
  _adjustTimeout(responseTime, success) {
    if (!this.config.adaptiveTimeout) return;
    
    const currentTimeout = this.adaptiveTimeoutValue;
    let newTimeout = currentTimeout;
    
    if (success) {
      // Gradually decrease timeout for faster operations
      if (responseTime < currentTimeout * 0.3) {
        newTimeout = Math.max(
          this.config.minTimeout,
          currentTimeout * 0.95 // Decrease by 5%
        );
      }
    } else {
      // Increase timeout for timeouts and slow failures
      if (responseTime >= currentTimeout * 0.8) {
        newTimeout = Math.min(
          this.config.maxTimeout,
          currentTimeout * 1.1 // Increase by 10%
        );
      }
    }
    
    if (newTimeout !== currentTimeout) {
      this.adaptiveTimeoutValue = newTimeout;
      this.metrics.timeoutAdjustments++;
      this.logger.debug(`Adaptive timeout adjusted: ${currentTimeout}ms -> ${newTimeout}ms`);
      
      this.emit('timeout:adjusted', {
        oldTimeout: currentTimeout,
        newTimeout,
        reason: success ? 'fast_response' : 'slow_response',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Add entry to time-window history
   */
  _addToHistory(history, entry) {
    history.push(entry);
    
    // Remove entries outside time window
    const cutoff = Date.now() - this.config.timeWindow;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }
  }
  
  /**
   * Get recent failures within time window
   */
  _getRecentFailures() {
    const cutoff = Date.now() - this.config.timeWindow;
    return this.failureHistory.filter(entry => entry.timestamp >= cutoff);
  }
  
  /**
   * Get recent calls within time window
   */
  _getRecentCalls() {
    const cutoff = Date.now() - this.config.timeWindow;
    return this.callHistory.filter(entry => entry.timestamp >= cutoff);
  }
  
  /**
   * Schedule automatic state transition
   */
  _scheduleStateTransition() {
    if (this.state === CircuitState.OPEN) {
      const timeUntilNextAttempt = this.nextAttemptTime - Date.now();
      
      if (timeUntilNextAttempt > 0) {
        setTimeout(() => {
          if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
            this._transitionToHalfOpen();
          }
        }, timeUntilNextAttempt);
      }
    }
  }
  
  /**
   * Start health checking
   */
  _startHealthChecking() {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this._performHealthCheck();
      }, this.config.healthCheckInterval);
    }
  }
  
  /**
   * Perform health check
   */
  async _performHealthCheck() {
    this.metrics.healthChecksPerformed++;
    
    try {
      // Basic health metrics
      const healthMetrics = {
        state: this.state,
        uptime: Date.now() - this.lastStateChange,
        failureRate: this.totalCalls > 0 ? (this.totalFailures / this.totalCalls * 100).toFixed(2) : 0,
        consecutiveFailures: this.consecutiveFailures,
        concurrentCalls: this.concurrentCalls,
        adaptiveTimeout: this.adaptiveTimeoutValue
      };
      
      this.emit('health:checked', {
        timestamp: Date.now(),
        metrics: healthMetrics,
        status: this._getHealthStatus()
      });
      
    } catch (error) {
      this.logger.error('Health check failed:', error);
      this.emit('health:error', { error: error.message, timestamp: Date.now() });
    }
  }
  
  /**
   * Get current health status
   */
  _getHealthStatus() {
    if (this.state === CircuitState.OPEN) {
      return 'critical';
    }
    
    const failureRate = this.totalCalls > 0 ? (this.totalFailures / this.totalCalls) : 0;
    
    if (failureRate > 0.5) return 'critical';
    if (failureRate > 0.2) return 'degraded';
    if (this.state === CircuitState.HALF_OPEN) return 'recovering';
    
    return 'healthy';
  }
  
  /**
   * Start metrics collection
   */
  _startMetricsCollection() {
    // Collect metrics every minute
    setInterval(() => {
      this._collectMetrics();
    }, 60000);
  }
  
  /**
   * Collect and emit metrics
   */
  _collectMetrics() {
    const recentCalls = this._getRecentCalls();
    const recentFailures = this._getRecentFailures();
    
    const metrics = {
      timestamp: Date.now(),
      name: this.name,
      state: this.state,
      totals: {
        calls: this.totalCalls,
        successes: this.totalSuccesses,
        failures: this.totalFailures,
        rejected: this.metrics.rejectedCalls
      },
      recent: {
        calls: recentCalls.length,
        failures: recentFailures.length,
        failureRate: recentCalls.length > 0 ? (recentFailures.length / recentCalls.length * 100).toFixed(2) : 0,
        avgResponseTime: recentCalls.length > 0 
          ? (recentCalls.reduce((sum, call) => sum + call.responseTime, 0) / recentCalls.length).toFixed(0)
          : 0
      },
      config: {
        failureThreshold: this.config.failureThreshold,
        timeout: this.adaptiveTimeoutValue,
        maxConcurrentCalls: this.config.maxConcurrentCalls
      },
      meta: {
        ...this.metrics,
        consecutiveFailures: this.consecutiveFailures,
        concurrentCalls: this.concurrentCalls,
        uptime: Date.now() - this.lastStateChange
      }
    };
    
    this.emit('metrics:collected', metrics);
  }
  
  /**
   * Get current statistics
   */
  getStatistics() {
    const recentCalls = this._getRecentCalls();
    const recentFailures = this._getRecentFailures();
    
    return {
      name: this.name,
      state: this.state,
      lastStateChange: this.lastStateChange,
      nextAttemptTime: this.nextAttemptTime,
      
      counters: {
        totalCalls: this.totalCalls,
        totalSuccesses: this.totalSuccesses,
        totalFailures: this.totalFailures,
        consecutiveFailures: this.consecutiveFailures,
        concurrentCalls: this.concurrentCalls,
        halfOpenCalls: this.halfOpenCalls
      },
      
      rates: {
        overallFailureRate: this.totalCalls > 0 ? ((this.totalFailures / this.totalCalls) * 100).toFixed(2) + '%' : '0%',
        recentFailureRate: recentCalls.length > 0 ? ((recentFailures.length / recentCalls.length) * 100).toFixed(2) + '%' : '0%',
        recentCallVolume: recentCalls.length
      },
      
      timing: {
        adaptiveTimeout: this.adaptiveTimeoutValue,
        minTimeout: this.config.minTimeout,
        maxTimeout: this.config.maxTimeout,
        recentAvgResponseTime: recentCalls.length > 0 
          ? (recentCalls.reduce((sum, call) => sum + call.responseTime, 0) / recentCalls.length).toFixed(0) + 'ms'
          : '0ms'
      },
      
      config: {
        failureThreshold: this.config.failureThreshold,
        failurePercentage: this.config.failurePercentage,
        timeout: this.config.timeout,
        maxConcurrentCalls: this.config.maxConcurrentCalls,
        failurePolicy: this.config.failurePolicy
      },
      
      metrics: this.metrics,
      
      health: this._getHealthStatus()
    };
  }
  
  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.totalCalls = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.nextAttemptTime = 0;
    this.adaptiveTimeoutValue = this.config.timeout;
    
    this.callHistory = [];
    this.failureHistory = [];
    
    this.metrics = {
      stateTransitions: 0,
      rejectedCalls: 0,
      slowCalls: 0,
      healthChecksPerformed: 0,
      timeoutAdjustments: 0
    };
    
    this.logger.info('Circuit breaker reset to initial state');
    this.emit('circuit:reset', { timestamp: Date.now() });
  }
  
  /**
   * Shutdown circuit breaker
   */
  shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    this.emit('circuit:shutdown', { timestamp: Date.now() });
    this.logger.info('Circuit breaker shutdown');
  }
  
  /**
   * Generate unique call ID
   */
  _generateCallId() {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * Circuit Breaker Manager for handling multiple circuit breakers
 */
export class CircuitBreakerManager extends EventEmitter {
  constructor() {
    super();
    this.circuitBreakers = new Map();
    this.logger = consola.withTag('circuit-breaker-manager');
  }
  
  /**
   * Create or get circuit breaker for operation
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker(name, options);
      
      // Forward events
      circuitBreaker.on('state:changed', (data) => this.emit('circuit:state:changed', { ...data, name }));
      circuitBreaker.on('call:success', (data) => this.emit('circuit:call:success', { ...data, name }));
      circuitBreaker.on('call:failure', (data) => this.emit('circuit:call:failure', { ...data, name }));
      circuitBreaker.on('metrics:collected', (data) => this.emit('circuit:metrics', data));
      
      this.circuitBreakers.set(name, circuitBreaker);
      this.logger.info(`Created circuit breaker: ${name}`);
    }
    
    return this.circuitBreakers.get(name);
  }
  
  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(name) {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.shutdown();
      this.circuitBreakers.delete(name);
      this.logger.info(`Removed circuit breaker: ${name}`);
    }
  }
  
  /**
   * Get statistics for all circuit breakers
   */
  getAllStatistics() {
    const stats = {};
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStatistics();
    }
    
    return {
      timestamp: new Date().toISOString(),
      totalCircuitBreakers: this.circuitBreakers.size,
      circuitBreakers: stats
    };
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    this.logger.info('All circuit breakers reset');
  }
  
  /**
   * Shutdown all circuit breakers
   */
  shutdown() {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.shutdown();
    }
    this.circuitBreakers.clear();
    this.logger.info('Circuit breaker manager shutdown');
  }
}

export default CircuitBreaker;
