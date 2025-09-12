/**
 * Production-Grade Health Checks
 * Kubernetes-ready health, readiness, and liveness probes
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import { env } from '../server/config/environment.js';
import logger from '../lib/observability/logger.js';

/**
 * Health check status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  CRITICAL: 'critical'
};

/**
 * Health check types for different probe purposes
 */
export const CheckType = {
  STARTUP: 'startup',    // Startup probe - is the application starting up?
  READINESS: 'readiness', // Readiness probe - can the application serve traffic?
  LIVENESS: 'liveness',   // Liveness probe - is the application alive?
  DEPENDENCY: 'dependency' // External dependency health
};

/**
 * Individual health check implementation
 */
class HealthCheck {
  constructor(name, checkFn, options = {}) {
    this.name = name;
    this.checkFn = checkFn;
    this.type = options.type || CheckType.READINESS;
    this.timeout = options.timeout || 5000;
    this.interval = options.interval || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.critical = options.critical || false;
    this.enabled = options.enabled !== false;
    
    // State tracking
    this.lastCheck = null;
    this.lastResult = null;
    this.failureCount = 0;
    this.consecutiveFailures = 0;
    this.totalChecks = 0;
    this.totalFailures = 0;
    this.averageResponseTime = 0;
    this.lastHealthyTime = this.getDeterministicTimestamp();
    
    // Status history for trend analysis
    this.statusHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Execute the health check with timeout and retry logic
   */
  async execute() {
    if (!this.enabled) {
      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        message: 'Check disabled',
        timestamp: this.getDeterministicDate().toISOString(),
        responseTime: 0,
        metadata: { disabled: true }
      };
    }
    
    const startTime = performance.now();
    this.lastCheck = this.getDeterministicTimestamp();
    this.totalChecks++;
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt < this.retries) {
      attempt++;
      
      try {
        const result = await this.executeWithTimeout();
        const responseTime = performance.now() - startTime;
        
        // Update metrics
        this.updateMetrics(true, responseTime);
        
        // Normalize result
        const normalizedResult = this.normalizeResult(result, responseTime);
        
        this.lastResult = normalizedResult;
        this.addToHistory(normalizedResult);
        
        return normalizedResult;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retries) {
          await this.delay(this.retryDelay * attempt); // Exponential backoff
          continue;
        }
        
        // All retries failed
        const responseTime = performance.now() - startTime;
        this.updateMetrics(false, responseTime);
        
        const failureResult = {
          name: this.name,
          status: this.critical ? HealthStatus.CRITICAL : HealthStatus.UNHEALTHY,
          message: `Health check failed after ${this.retries} attempts: ${error.message}`,
          timestamp: this.getDeterministicDate().toISOString(),
          responseTime,
          error: {
            name: error.name,
            message: error.message,
            code: error.code
          },
          metadata: {
            attempts: attempt,
            retries: this.retries,
            critical: this.critical
          }
        };
        
        this.lastResult = failureResult;
        this.addToHistory(failureResult);
        
        return failureResult;
      }
    }
  }
  
  /**
   * Execute check function with timeout
   */
  async executeWithTimeout() {
    return Promise.race([
      this.checkFn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Health check timeout after ${this.timeout}ms`));
        }, this.timeout);
      })
    ]);
  }
  
  /**
   * Normalize health check result
   */
  normalizeResult(result, responseTime) {
    // Handle different result formats
    if (typeof result === 'boolean') {
      return {
        name: this.name,
        status: result ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: result ? 'Check passed' : 'Check failed',
        timestamp: this.getDeterministicDate().toISOString(),
        responseTime,
        metadata: {}
      };
    }
    
    if (typeof result === 'string') {
      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        message: result,
        timestamp: this.getDeterministicDate().toISOString(),
        responseTime,
        metadata: {}
      };
    }
    
    // Assume object result
    return {
      name: this.name,
      status: result.status || HealthStatus.HEALTHY,
      message: result.message || 'Check completed',
      timestamp: this.getDeterministicDate().toISOString(),
      responseTime,
      metadata: result.metadata || {},
      ...result
    };
  }
  
  /**
   * Update check metrics
   */
  updateMetrics(success, responseTime) {
    // Update average response time
    this.averageResponseTime = (
      (this.averageResponseTime * (this.totalChecks - 1)) + responseTime
    ) / this.totalChecks;
    
    if (success) {
      this.consecutiveFailures = 0;
      this.lastHealthyTime = this.getDeterministicTimestamp();
    } else {
      this.totalFailures++;
      this.consecutiveFailures++;
    }
  }
  
  /**
   * Add result to status history
   */
  addToHistory(result) {
    this.statusHistory.push({
      status: result.status,
      timestamp: result.timestamp,
      responseTime: result.responseTime
    });
    
    // Maintain history size limit
    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory.shift();
    }
  }
  
  /**
   * Get failure rate percentage
   */
  getFailureRate() {
    return this.totalChecks > 0 ? (this.totalFailures / this.totalChecks) * 100 : 0;
  }
  
  /**
   * Get recent trend (last 10 checks)
   */
  getRecentTrend() {
    const recent = this.statusHistory.slice(-10);
    if (recent.length === 0) return 'unknown';
    
    const healthyCount = recent.filter(r => r.status === HealthStatus.HEALTHY).length;
    const healthyPercentage = (healthyCount / recent.length) * 100;
    
    if (healthyPercentage >= 80) return 'stable';
    if (healthyPercentage >= 60) return 'unstable';
    return 'failing';
  }
  
  /**
   * Delay utility for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get comprehensive check statistics
   */
  getStats() {
    return {
      name: this.name,
      type: this.type,
      enabled: this.enabled,
      critical: this.critical,
      totalChecks: this.totalChecks,
      totalFailures: this.totalFailures,
      consecutiveFailures: this.consecutiveFailures,
      failureRate: this.getFailureRate(),
      averageResponseTime: this.averageResponseTime,
      lastCheck: this.lastCheck,
      lastHealthyTime: this.lastHealthyTime,
      recentTrend: this.getRecentTrend(),
      uptime: this.getDeterministicTimestamp() - this.lastHealthyTime
    };
  }
}

/**
 * Main health check orchestrator
 */
class HealthCheckOrchestrator extends EventEmitter {
  constructor() {
    super();
    
    this.checks = new Map();
    this.isRunning = false;
    this.checkInterval = null;
    this.lastGlobalCheck = null;
    
    // Global health status
    this.globalStatus = {
      status: HealthStatus.HEALTHY,
      timestamp: this.getDeterministicDate().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: []
    };
    
    this.registerDefaultChecks();
  }
  
  /**
   * Register default system health checks
   */
  registerDefaultChecks() {
    // Memory usage check
    this.register('memory', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      let status = HealthStatus.HEALTHY;
      let message = `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`;
      
      if (heapUsagePercent > 90) {
        status = HealthStatus.CRITICAL;
        message = `Critical memory usage: ${heapUsagePercent.toFixed(1)}%`;
      } else if (heapUsagePercent > 80) {
        status = HealthStatus.UNHEALTHY;
        message = `High memory usage: ${heapUsagePercent.toFixed(1)}%`;
      } else if (heapUsagePercent > 70) {
        status = HealthStatus.DEGRADED;
        message = `Elevated memory usage: ${heapUsagePercent.toFixed(1)}%`;
      }
      
      return {
        status,
        message,
        metadata: {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          heapUsagePercent: heapUsagePercent.toFixed(1),
          rss: Math.round(usage.rss / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024)
        }
      };
    }, { type: CheckType.LIVENESS, critical: true });
    
    // Event loop lag check
    this.register('eventloop', async () => {
      const start = process.hrtime.bigint();
      
      await new Promise(resolve => setImmediate(resolve));
      
      const end = process.hrtime.bigint();
      const lagMs = Number(end - start) / 1000000; // Convert to milliseconds
      
      let status = HealthStatus.HEALTHY;
      let message = `Event loop lag: ${lagMs.toFixed(2)}ms`;
      
      if (lagMs > 1000) {
        status = HealthStatus.CRITICAL;
        message = `Critical event loop lag: ${lagMs.toFixed(2)}ms`;
      } else if (lagMs > 500) {
        status = HealthStatus.UNHEALTHY;
        message = `High event loop lag: ${lagMs.toFixed(2)}ms`;
      } else if (lagMs > 100) {
        status = HealthStatus.DEGRADED;
        message = `Elevated event loop lag: ${lagMs.toFixed(2)}ms`;
      }
      
      return {
        status,
        message,
        metadata: {
          lagMs: lagMs.toFixed(2),
          lagThreshold: '100ms'
        }
      };
    }, { type: CheckType.LIVENESS });
    
    // File system check
    this.register('filesystem', async () => {
      try {
        const fs = await import('fs/promises');
        const tmpFile = `/tmp/health-check-${this.getDeterministicTimestamp()}`;
        
        await fs.writeFile(tmpFile, 'health-check');
        const content = await fs.readFile(tmpFile, 'utf8');
        await fs.unlink(tmpFile);
        
        if (content !== 'health-check') {
          throw new Error('File system read/write verification failed');
        }
        
        return {
          status: HealthStatus.HEALTHY,
          message: 'File system read/write operations successful'
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `File system check failed: ${error.message}`
        };
      }
    }, { type: CheckType.READINESS });
    
    // DNS resolution check
    this.register('dns', async () => {
      try {
        const dns = await import('dns/promises');
        const startTime = performance.now();
        
        await dns.resolve('google.com', 'A');
        
        const responseTime = performance.now() - startTime;
        
        return {
          status: HealthStatus.HEALTHY,
          message: `DNS resolution successful (${responseTime.toFixed(2)}ms)`,
          metadata: {
            responseTime: responseTime.toFixed(2),
            target: 'google.com'
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.DEGRADED,
          message: `DNS resolution failed: ${error.message}`
        };
      }
    }, { type: CheckType.DEPENDENCY, timeout: 3000 });
  }
  
  /**
   * Register a new health check
   */
  register(name, checkFn, options = {}) {
    const check = new HealthCheck(name, checkFn, options);
    this.checks.set(name, check);
    
    logger.debug(`Registered health check: ${name}`, {
      type: check.type,
      critical: check.critical,
      timeout: check.timeout
    });
    
    return check;
  }
  
  /**
   * Unregister a health check
   */
  unregister(name) {
    const removed = this.checks.delete(name);
    if (removed) {
      logger.debug(`Unregistered health check: ${name}`);
    }
    return removed;
  }
  
  /**
   * Execute all health checks of a specific type
   */
  async checkType(type) {
    const typeChecks = Array.from(this.checks.values())
      .filter(check => check.type === type);
    
    if (typeChecks.length === 0) {
      return {
        status: HealthStatus.HEALTHY,
        message: `No ${type} checks configured`,
        checks: []
      };
    }
    
    const results = await Promise.allSettled(
      typeChecks.map(check => check.execute())
    );
    
    const checkResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: typeChecks[index].name,
          status: HealthStatus.CRITICAL,
          message: `Check execution failed: ${result.reason.message}`,
          timestamp: this.getDeterministicDate().toISOString(),
          responseTime: 0,
          error: { message: result.reason.message }
        };
      }
    });
    
    // Determine overall status for this type
    const overallStatus = this.determineOverallStatus(checkResults);
    
    return {
      status: overallStatus,
      message: `${type} checks completed`,
      timestamp: this.getDeterministicDate().toISOString(),
      checks: checkResults
    };
  }
  
  /**
   * Execute all health checks
   */
  async checkAll() {
    const startTime = performance.now();
    this.lastGlobalCheck = this.getDeterministicTimestamp();
    
    const results = await Promise.allSettled(
      Array.from(this.checks.values()).map(check => check.execute())
    );
    
    const checkResults = results.map((result, index) => {
      const checkName = Array.from(this.checks.keys())[index];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: checkName,
          status: HealthStatus.CRITICAL,
          message: `Check execution failed: ${result.reason.message}`,
          timestamp: this.getDeterministicDate().toISOString(),
          responseTime: 0,
          error: { message: result.reason.message }
        };
      }
    });
    
    const totalTime = performance.now() - startTime;
    const overallStatus = this.determineOverallStatus(checkResults);
    
    this.globalStatus = {
      status: overallStatus,
      timestamp: this.getDeterministicDate().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      responseTime: totalTime.toFixed(2),
      checks: checkResults,
      summary: this.generateSummary(checkResults)
    };
    
    // Emit events based on status changes
    this.emit('health-check-complete', this.globalStatus);
    
    if (overallStatus === HealthStatus.CRITICAL) {
      this.emit('health-critical', this.globalStatus);
    } else if (overallStatus === HealthStatus.UNHEALTHY) {
      this.emit('health-unhealthy', this.globalStatus);
    }
    
    return this.globalStatus;
  }
  
  /**
   * Determine overall status from individual check results
   */
  determineOverallStatus(results) {
    if (results.some(r => r.status === HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL;
    }
    
    if (results.some(r => r.status === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    
    if (results.some(r => r.status === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    
    return HealthStatus.HEALTHY;
  }
  
  /**
   * Generate summary statistics
   */
  generateSummary(results) {
    const total = results.length;
    const healthy = results.filter(r => r.status === HealthStatus.HEALTHY).length;
    const degraded = results.filter(r => r.status === HealthStatus.DEGRADED).length;
    const unhealthy = results.filter(r => r.status === HealthStatus.UNHEALTHY).length;
    const critical = results.filter(r => r.status === HealthStatus.CRITICAL).length;
    
    const avgResponseTime = results.length > 0 
      ? results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length 
      : 0;
    
    return {
      total,
      healthy,
      degraded,
      unhealthy,
      critical,
      healthyPercentage: ((healthy / total) * 100).toFixed(1),
      averageResponseTime: avgResponseTime.toFixed(2)
    };
  }
  
  /**
   * Start periodic health checks
   */
  startPeriodicChecks(interval = 30000) {
    if (this.isRunning) {
      logger.warn('Health checks already running');
      return;
    }
    
    this.isRunning = true;
    
    // Run initial check
    this.checkAll().catch(error => {
      logger.error('Initial health check failed', error);
    });
    
    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAll();
      } catch (error) {
        logger.error('Periodic health check failed', error);
      }
    }, interval);
    
    logger.info(`Started periodic health checks (interval: ${interval}ms)`);
  }
  
  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    logger.info('Stopped periodic health checks');
  }
  
  /**
   * Get current global health status
   */
  getGlobalStatus() {
    return this.globalStatus;
  }
  
  /**
   * Get individual check statistics
   */
  getCheckStats(name) {
    const check = this.checks.get(name);
    return check ? check.getStats() : null;
  }
  
  /**
   * Get all check statistics
   */
  getAllStats() {
    const stats = {};
    for (const [name, check] of this.checks.entries()) {
      stats[name] = check.getStats();
    }
    return stats;
  }
  
  /**
   * Enable/disable a specific check
   */
  setCheckEnabled(name, enabled) {
    const check = this.checks.get(name);
    if (check) {
      check.enabled = enabled;
      logger.info(`Health check ${name} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }
  
  /**
   * Get health check suitable for Kubernetes probes
   */
  async getProbeResponse(type) {
    const result = await this.checkType(type);
    
    return {
      status: result.status === HealthStatus.HEALTHY ? 200 : 503,
      body: {
        status: result.status,
        timestamp: result.timestamp,
        checks: result.checks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message
        }))
      }
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[HealthCheck] Shutting down health check orchestrator...');
    
    this.stopPeriodicChecks();
    this.removeAllListeners();
    
    logger.info('[HealthCheck] Shutdown complete');
  }
}

// Export singleton instance
export const healthCheck = new HealthCheckOrchestrator();
export { HealthCheckOrchestrator, HealthCheck };
export default healthCheck;
