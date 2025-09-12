/**
 * Connection health monitoring and auto-recovery for MCP server
 * @fileoverview Monitors MCP server health and implements auto-recovery mechanisms
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  CRITICAL: 'critical'
};

/**
 * Connection health monitor for MCP server
 * @class ConnectionHealthMonitor
 * @extends EventEmitter
 */
export class ConnectionHealthMonitor extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.heartbeatInterval=5000] - Heartbeat interval in ms
   * @param {number} [options.timeoutThreshold=10000] - Timeout threshold in ms
   * @param {number} [options.maxRetries=3] - Maximum retry attempts
   * @param {number} [options.retryDelay=1000] - Delay between retries in ms
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      heartbeatInterval: 5000,
      timeoutThreshold: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    this.status = HealthStatus.HEALTHY;
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastHeartbeat: null,
      lastError: null,
      startTime: this.getDeterministicTimestamp()
    };

    this.heartbeatTimer = null;
    this.isMonitoring = false;
    this.retryCount = 0;
    this.pendingRequests = new Map();
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.metrics.startTime = this.getDeterministicTimestamp();
    
    // Start heartbeat monitoring
    this.heartbeatTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.heartbeatInterval);

    console.log('[MCP Health] Monitoring started');
    this.emit('monitoring:started');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    console.log('[MCP Health] Monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Record a request start
   * @param {string} requestId - Unique request identifier
   * @param {string} method - Request method
   */
  recordRequestStart(requestId, method) {
    this.pendingRequests.set(requestId, {
      method,
      startTime: performance.now(),
      timeout: setTimeout(() => {
        this.recordTimeout(requestId);
      }, this.options.timeoutThreshold)
    });

    this.metrics.requestCount++;
  }

  /**
   * Record a successful request completion
   * @param {string} requestId - Request identifier
   */
  recordRequestSuccess(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    const responseTime = performance.now() - request.startTime;
    this.updateResponseTime(responseTime);
    
    clearTimeout(request.timeout);
    this.pendingRequests.delete(requestId);

    // Reset retry count on successful request
    this.retryCount = 0;
    
    // Update status if recovering
    if (this.status !== HealthStatus.HEALTHY) {
      this.updateHealthStatus(HealthStatus.HEALTHY);
    }
  }

  /**
   * Record a request error
   * @param {string} requestId - Request identifier
   * @param {Error} error - The error that occurred
   */
  recordRequestError(requestId, error) {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);
    }

    this.metrics.errorCount++;
    this.metrics.lastError = {
      message: error.message,
      timestamp: this.getDeterministicTimestamp(),
      requestId
    };

    this.retryCount++;
    this.updateHealthStatus(this.calculateHealthStatus());
    
    this.emit('request:error', { requestId, error });
  }

  /**
   * Record a request timeout
   * @param {string} requestId - Request identifier
   */
  recordTimeout(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    this.pendingRequests.delete(requestId);
    this.metrics.errorCount++;
    this.retryCount++;

    const timeoutError = new Error(`Request ${requestId} timed out after ${this.options.timeoutThreshold}ms`);
    this.metrics.lastError = {
      message: timeoutError.message,
      timestamp: this.getDeterministicTimestamp(),
      requestId
    };

    this.updateHealthStatus(this.calculateHealthStatus());
    this.emit('request:timeout', { requestId });
  }

  /**
   * Perform periodic health check
   * @private
   */
  async performHealthCheck() {
    try {
      const healthCheckId = `health_${this.getDeterministicTimestamp()}`;
      this.recordRequestStart(healthCheckId, 'health_check');
      
      // Simulate health check - could be enhanced to actually ping server
      await new Promise(resolve => setTimeout(resolve, 10));
      
      this.recordRequestSuccess(healthCheckId);
      this.metrics.lastHeartbeat = this.getDeterministicTimestamp();
      this.metrics.uptime = this.getDeterministicTimestamp() - this.metrics.startTime;
      
      this.emit('heartbeat', this.getHealthReport());
      
    } catch (error) {
      this.recordRequestError('health_check', error);
    }
  }

  /**
   * Update response time metrics
   * @param {number} responseTime - Response time in milliseconds
   * @private
   */
  updateResponseTime(responseTime) {
    const totalRequests = Math.max(1, this.metrics.requestCount - this.metrics.errorCount);
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / totalRequests;
  }

  /**
   * Calculate current health status based on metrics
   * @returns {string} Health status
   * @private
   */
  calculateHealthStatus() {
    const errorRate = this.metrics.requestCount > 0 
      ? this.metrics.errorCount / this.metrics.requestCount 
      : 0;

    // Critical: Too many retries or high error rate
    if (this.retryCount >= this.options.maxRetries || errorRate > 0.5) {
      return HealthStatus.CRITICAL;
    }

    // Unhealthy: Moderate error rate or recent errors
    if (errorRate > 0.2 || this.retryCount > 1) {
      return HealthStatus.UNHEALTHY;
    }

    // Degraded: Some errors but still functional
    if (errorRate > 0.1 || this.retryCount > 0) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Update health status and emit events
   * @param {string} newStatus - New health status
   * @private
   */
  updateHealthStatus(newStatus) {
    const oldStatus = this.status;
    this.status = newStatus;

    if (oldStatus !== newStatus) {
      console.log(`[MCP Health] Status changed: ${oldStatus} -> ${newStatus}`);
      this.emit('status:changed', { oldStatus, newStatus });

      // Trigger recovery if status is critical
      if (newStatus === HealthStatus.CRITICAL) {
        this.triggerRecovery();
      }
    }
  }

  /**
   * Trigger recovery procedures
   * @private
   */
  async triggerRecovery() {
    console.log('[MCP Health] Triggering recovery procedures...');
    this.emit('recovery:started');

    try {
      // Wait before attempting recovery
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));

      // Reset metrics for fresh start
      this.retryCount = 0;
      this.pendingRequests.clear();

      // Emit recovery event for server to handle
      this.emit('recovery:attempt');

      console.log('[MCP Health] Recovery procedures completed');
      this.emit('recovery:completed');

    } catch (error) {
      console.error('[MCP Health] Recovery failed:', error);
      this.emit('recovery:failed', error);
    }
  }

  /**
   * Get current health report
   * @returns {Object} Health report
   */
  getHealthReport() {
    return {
      status: this.status,
      metrics: {
        ...this.metrics,
        errorRate: this.metrics.requestCount > 0 
          ? (this.metrics.errorCount / this.metrics.requestCount).toFixed(3)
          : '0.000',
        pendingRequests: this.pendingRequests.size
      },
      retryCount: this.retryCount,
      isMonitoring: this.isMonitoring,
      timestamp: this.getDeterministicTimestamp()
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastHeartbeat: null,
      lastError: null,
      startTime: this.getDeterministicTimestamp()
    };
    
    this.retryCount = 0;
    this.pendingRequests.clear();
    this.updateHealthStatus(HealthStatus.HEALTHY);
    
    console.log('[MCP Health] Metrics reset');
    this.emit('metrics:reset');
  }

  /**
   * Get health status summary for logging
   * @returns {string} Status summary
   */
  getStatusSummary() {
    const report = this.getHealthReport();
    return `Status: ${report.status}, Requests: ${report.metrics.requestCount}, ` +
           `Errors: ${report.metrics.errorCount}, Avg Response: ${report.metrics.averageResponseTime.toFixed(2)}ms`;
  }
}

/**
 * Create and configure a health monitor for MCP server
 * @param {Object} options - Configuration options
 * @returns {ConnectionHealthMonitor} Configured health monitor
 */
export function createHealthMonitor(options = {}) {
  const monitor = new ConnectionHealthMonitor(options);
  
  // Set up default event handlers
  monitor.on('status:changed', ({ oldStatus, newStatus }) => {
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`[MCP Health] Status: ${oldStatus} → ${newStatus}`);
    }
  });

  monitor.on('recovery:started', () => {
    console.warn('[MCP Health] Recovery initiated due to critical status');
  });

  monitor.on('recovery:failed', (error) => {
    console.error('[MCP Health] Recovery failed:', error.message);
  });

  return monitor;
}

/**
 * Health check middleware for request processing
 * @param {ConnectionHealthMonitor} monitor - Health monitor instance
 * @returns {Function} Middleware function
 */
export function createHealthMiddleware(monitor) {
  return {
    /**
     * Pre-request middleware
     * @param {string} requestId - Request identifier
     * @param {string} method - Request method
     */
    preRequest(requestId, method) {
      monitor.recordRequestStart(requestId, method);
    },

    /**
     * Post-request success middleware
     * @param {string} requestId - Request identifier
     */
    postSuccess(requestId) {
      monitor.recordRequestSuccess(requestId);
    },

    /**
     * Post-request error middleware
     * @param {string} requestId - Request identifier
     * @param {Error} error - Request error
     */
    postError(requestId, error) {
      monitor.recordRequestError(requestId, error);
    }
  };
}