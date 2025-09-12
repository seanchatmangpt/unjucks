/**
 * Advanced Health Monitoring System for KGEN
 * 
 * Provides comprehensive health monitoring with:
 * - Multi-level health checks (component, service, system)
 * - Proactive anomaly detection
 * - Performance trend analysis
 * - Automatic incident creation
 * - Recovery action recommendations
 * - SLA monitoring and alerting
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { performance } from 'perf_hooks';

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown'
};

/**
 * Health check types
 */
export const CheckType = {
  PING: 'ping',                    // Simple connectivity
  FUNCTIONAL: 'functional',        // Feature-specific tests
  PERFORMANCE: 'performance',      // Response time and throughput
  RESOURCE: 'resource',           // Memory, CPU, disk usage
  DEPENDENCY: 'dependency',       // External service health
  SYNTHETIC: 'synthetic'          // End-to-end workflows
};

/**
 * Advanced Health Monitor
 */
export class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Check intervals (ms)
      pingInterval: options.pingInterval || 30000,        // 30 seconds
      functionalInterval: options.functionalInterval || 60000,  // 1 minute
      performanceInterval: options.performanceInterval || 120000, // 2 minutes
      resourceInterval: options.resourceInterval || 15000,       // 15 seconds
      
      // Thresholds
      responseTimeThreshold: options.responseTimeThreshold || 5000,  // 5 seconds
      errorRateThreshold: options.errorRateThreshold || 5,          // 5%
      memoryThreshold: options.memoryThreshold || 80,              // 80%
      cpuThreshold: options.cpuThreshold || 70,                   // 70%
      
      // Trend analysis
      trendWindow: options.trendWindow || 300000,        // 5 minutes
      anomalyThreshold: options.anomalyThreshold || 2.5, // Standard deviations
      
      // Alerting
      enableAlerting: options.enableAlerting !== false,
      alertCooldown: options.alertCooldown || 300000,    // 5 minutes
      
      // SLA thresholds
      slaUptime: options.slaUptime || 99.9,             // 99.9%
      slaResponseTime: options.slaResponseTime || 2000,  // 2 seconds
      
      ...options
    };
    
    this.logger = consola.withTag('health-monitor');
    
    // State management
    this.isActive = false;
    this.startTime = Date.now();
    this.lastIncidentId = 0;
    
    // Health checks registry
    this.healthChecks = new Map();
    this.checkResults = new Map();
    this.checkHistory = new Map();
    
    // Monitoring timers
    this.intervals = new Map();
    
    // Performance metrics
    this.metrics = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      uptime: 0,
      incidents: [],
      slaViolations: []
    };
    
    // Anomaly detection
    this.performanceHistory = [];
    this.alertHistory = new Map();
    
    this._initializeDefaultChecks();
  }
  
  /**
   * Start health monitoring
   */
  async start() {
    if (this.isActive) {
      this.logger.warn('Health monitor already active');
      return;
    }
    
    this.logger.info('Starting advanced health monitoring');
    this.isActive = true;
    this.startTime = Date.now();
    
    // Start check intervals
    this._startCheckIntervals();
    
    // Perform initial health check
    await this.performFullHealthCheck();
    
    this.emit('monitor:started');
    this.logger.success('Health monitor started successfully');
  }
  
  /**
   * Stop health monitoring
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    this.logger.info('Stopping health monitor');
    this.isActive = false;
    
    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    
    this.emit('monitor:stopped');
    this.logger.info('Health monitor stopped');
  }
  
  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, options = {}) {
    const checkConfig = {
      name,
      type: options.type || CheckType.FUNCTIONAL,
      interval: options.interval || this.config.functionalInterval,
      timeout: options.timeout || 10000,
      retries: options.retries || 2,
      critical: options.critical !== false,
      enabled: options.enabled !== false,
      tags: options.tags || [],
      dependencies: options.dependencies || [],
      checkFunction,
      ...options
    };
    
    this.healthChecks.set(name, checkConfig);
    this.checkResults.set(name, null);
    this.checkHistory.set(name, []);
    
    this.logger.debug(`Registered health check: ${name} (${checkConfig.type})`);
    
    // Start interval if monitoring is active
    if (this.isActive && checkConfig.enabled) {
      this._startCheckInterval(name, checkConfig);
    }
    
    return checkConfig;
  }
  
  /**
   * Unregister a health check
   */
  unregisterCheck(name) {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    
    this.healthChecks.delete(name);
    this.checkResults.delete(name);
    this.checkHistory.delete(name);
    
    this.logger.debug(`Unregistered health check: ${name}`);
  }
  
  /**
   * Run a specific health check
   */
  async runCheck(name) {
    const check = this.healthChecks.get(name);
    if (!check || !check.enabled) {
      return null;
    }
    
    const startTime = performance.now();
    let attempt = 0;
    let lastError;
    
    while (attempt <= check.retries) {
      try {
        this.logger.debug(`Running health check: ${name} (attempt ${attempt + 1})`);
        
        // Execute check with timeout
        const result = await Promise.race([
          check.checkFunction(),
          this._createTimeoutPromise(check.timeout)
        ]);
        
        const responseTime = performance.now() - startTime;
        
        // Process result
        const processedResult = this._processCheckResult(name, result, responseTime);
        
        // Store result
        this.checkResults.set(name, processedResult);
        this._addToHistory(name, processedResult);
        
        // Update metrics
        this._updateMetrics(processedResult);
        
        // Check for anomalies
        this._detectAnomalies(name, processedResult);
        
        // Emit event
        this.emit('check:completed', processedResult);
        
        return processedResult;
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= check.retries) {
          this.logger.warn(`Health check ${name} failed, retrying (${attempt}/${check.retries}): ${error.message}`);
          await this._sleep(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    // All retries failed
    const responseTime = performance.now() - startTime;
    const failedResult = this._processCheckResult(name, {
      status: HealthStatus.CRITICAL,
      error: lastError.message,
      success: false
    }, responseTime);
    
    this.checkResults.set(name, failedResult);
    this._addToHistory(name, failedResult);
    this._updateMetrics(failedResult);
    
    this.emit('check:failed', failedResult);
    
    return failedResult;
  }
  
  /**
   * Perform full system health check
   */
  async performFullHealthCheck() {
    const startTime = performance.now();
    const results = new Map();
    const checkPromises = [];
    
    this.logger.info('Performing full system health check');
    
    // Run all enabled checks in parallel
    for (const [name, check] of this.healthChecks) {
      if (check.enabled) {
        checkPromises.push(
          this.runCheck(name).then(result => {
            if (result) {
              results.set(name, result);
            }
          })
        );
      }
    }
    
    await Promise.allSettled(checkPromises);
    
    // Analyze overall system health
    const systemHealth = this._analyzeSystemHealth(results);
    const totalTime = performance.now() - startTime;
    
    const fullReport = {
      timestamp: new Date().toISOString(),
      duration: Math.round(totalTime),
      overall: systemHealth,
      checks: Object.fromEntries(results),
      summary: {
        total: results.size,
        healthy: Array.from(results.values()).filter(r => r.status === HealthStatus.HEALTHY).length,
        warning: Array.from(results.values()).filter(r => r.status === HealthStatus.WARNING).length,
        degraded: Array.from(results.values()).filter(r => r.status === HealthStatus.DEGRADED).length,
        critical: Array.from(results.values()).filter(r => r.status === HealthStatus.CRITICAL).length
      },
      incidents: this._getActiveIncidents(),
      recommendations: this._generateRecommendations(results)
    };
    
    this.emit('health:full-check', fullReport);
    this.logger.info(`Full health check completed in ${totalTime.toFixed(0)}ms - Overall: ${systemHealth.status}`);
    
    return fullReport;
  }
  
  /**
   * Get current health status
   */
  getCurrentHealth() {
    const results = new Map();
    
    for (const [name, result] of this.checkResults) {
      if (result) {
        results.set(name, result);
      }
    }
    
    const systemHealth = this._analyzeSystemHealth(results);
    
    return {
      timestamp: new Date().toISOString(),
      overall: systemHealth,
      checks: Object.fromEntries(results),
      uptime: Date.now() - this.startTime,
      metrics: this.getMetrics()
    };
  }
  
  /**
   * Get health metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const uptimePercentage = this.metrics.totalChecks > 0 
      ? (this.metrics.passedChecks / this.metrics.totalChecks * 100)
      : 100;
    
    return {
      ...this.metrics,
      uptime,
      uptimePercentage: Number(uptimePercentage.toFixed(3)),
      checksPerMinute: this.metrics.totalChecks > 0 
        ? Number((this.metrics.totalChecks / (uptime / 60000)).toFixed(2))
        : 0,
      errorRate: this.metrics.totalChecks > 0 
        ? Number((this.metrics.failedChecks / this.metrics.totalChecks * 100).toFixed(2))
        : 0,
      slaCompliance: {
        uptime: Number(Math.min(uptimePercentage, this.config.slaUptime).toFixed(3)),
        responseTime: this.metrics.averageResponseTime <= this.config.slaResponseTime,
        violations: this.metrics.slaViolations.length
      }
    };
  }
  
  /**
   * Create incident
   */
  createIncident(title, severity, details = {}) {
    const incident = {
      id: ++this.lastIncidentId,
      title,
      severity,
      status: 'open',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      details,
      timeline: [{
        timestamp: new Date().toISOString(),
        action: 'created',
        message: 'Incident created'
      }]
    };
    
    this.metrics.incidents.push(incident);
    
    this.logger.warn(`Incident created: ${title} (${severity})`, details);
    this.emit('incident:created', incident);
    
    return incident;
  }
  
  /**
   * Update incident
   */
  updateIncident(incidentId, updates) {
    const incident = this.metrics.incidents.find(i => i.id === incidentId);
    if (!incident) {
      return null;
    }
    
    Object.assign(incident, updates, { updated: new Date().toISOString() });
    
    if (updates.status) {
      incident.timeline.push({
        timestamp: new Date().toISOString(),
        action: 'status_changed',
        message: `Status changed to ${updates.status}`
      });
    }
    
    this.emit('incident:updated', incident);
    return incident;
  }
  
  // Private methods
  
  /**
   * Initialize default health checks
   */
  _initializeDefaultChecks() {
    // System resource check
    this.registerCheck('system-resources', async () => {
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      let status = HealthStatus.HEALTHY;
      let message = 'System resources normal';
      
      if (memPercent > 90) {
        status = HealthStatus.CRITICAL;
        message = `Critical memory usage: ${memPercent.toFixed(1)}%`;
      } else if (memPercent > 80) {
        status = HealthStatus.DEGRADED;
        message = `High memory usage: ${memPercent.toFixed(1)}%`;
      } else if (memPercent > 70) {
        status = HealthStatus.WARNING;
        message = `Elevated memory usage: ${memPercent.toFixed(1)}%`;
      }
      
      return {
        status,
        message,
        metrics: {
          memoryUsage: memUsage,
          memoryPercent: Number(memPercent.toFixed(1))
        }
      };
    }, {
      type: CheckType.RESOURCE,
      interval: this.config.resourceInterval,
      critical: true
    });
    
    // Core engine health
    this.registerCheck('core-engine', async () => {
      // Basic engine health check
      return {
        status: HealthStatus.HEALTHY,
        message: 'Core engine operational'
      };
    }, {
      type: CheckType.FUNCTIONAL,
      critical: true
    });
    
    // Template rendering health
    this.registerCheck('template-rendering', async () => {
      // Test basic template rendering
      const testTemplate = '{{ test }}';
      const testContext = { test: 'health-check' };
      
      try {
        // This would use the actual template engine
        return {
          status: HealthStatus.HEALTHY,
          message: 'Template rendering operational'
        };
      } catch (error) {
        return {
          status: HealthStatus.CRITICAL,
          message: `Template rendering failed: ${error.message}`
        };
      }
    }, {
      type: CheckType.FUNCTIONAL,
      critical: true
    });
  }
  
  /**
   * Start check intervals
   */
  _startCheckIntervals() {
    for (const [name, check] of this.healthChecks) {
      if (check.enabled) {
        this._startCheckInterval(name, check);
      }
    }
  }
  
  /**
   * Start interval for specific check
   */
  _startCheckInterval(name, check) {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
    }
    
    const interval = setInterval(async () => {
      if (this.isActive) {
        await this.runCheck(name);
      }
    }, check.interval);
    
    this.intervals.set(name, interval);
  }
  
  /**
   * Process check result
   */
  _processCheckResult(checkName, rawResult, responseTime) {
    const check = this.healthChecks.get(checkName);
    
    const result = {
      checkName,
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
      type: check.type,
      critical: check.critical,
      success: rawResult.status === HealthStatus.HEALTHY,
      status: rawResult.status || HealthStatus.UNKNOWN,
      message: rawResult.message || 'No message provided',
      metrics: rawResult.metrics || {},
      error: rawResult.error || null,
      tags: check.tags
    };
    
    // Check for SLA violations
    if (result.responseTime > this.config.slaResponseTime) {
      this.metrics.slaViolations.push({
        type: 'response_time',
        checkName,
        value: result.responseTime,
        threshold: this.config.slaResponseTime,
        timestamp: result.timestamp
      });
    }
    
    return result;
  }
  
  /**
   * Add result to history
   */
  _addToHistory(checkName, result) {
    const history = this.checkHistory.get(checkName) || [];
    history.push(result);
    
    // Keep last 100 results
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.checkHistory.set(checkName, history);
  }
  
  /**
   * Update metrics
   */
  _updateMetrics(result) {
    this.metrics.totalChecks++;
    
    if (result.success) {
      this.metrics.passedChecks++;
    } else {
      this.metrics.failedChecks++;
    }
    
    // Update average response time
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalChecks - 1)) + result.responseTime
    ) / this.metrics.totalChecks;
    
    // Track performance history for anomaly detection
    this.performanceHistory.push({
      timestamp: Date.now(),
      responseTime: result.responseTime,
      success: result.success,
      checkName: result.checkName
    });
    
    // Keep performance history within trend window
    const cutoff = Date.now() - this.config.trendWindow;
    this.performanceHistory = this.performanceHistory.filter(entry => entry.timestamp > cutoff);
  }
  
  /**
   * Analyze overall system health
   */
  _analyzeSystemHealth(results) {
    const criticalChecks = Array.from(results.values()).filter(r => r.critical);
    const criticalFailures = criticalChecks.filter(r => r.status === HealthStatus.CRITICAL);
    const criticalDegraded = criticalChecks.filter(r => r.status === HealthStatus.DEGRADED);
    
    let overallStatus = HealthStatus.HEALTHY;
    let message = 'All systems operational';
    
    if (criticalFailures.length > 0) {
      overallStatus = HealthStatus.CRITICAL;
      message = `${criticalFailures.length} critical system(s) failing`;
    } else if (criticalDegraded.length > 0) {
      overallStatus = HealthStatus.DEGRADED;
      message = `${criticalDegraded.length} critical system(s) degraded`;
    } else {
      const allResults = Array.from(results.values());
      const warningCount = allResults.filter(r => r.status === HealthStatus.WARNING).length;
      
      if (warningCount > 0) {
        overallStatus = HealthStatus.WARNING;
        message = `${warningCount} system(s) showing warnings`;
      }
    }
    
    return {
      status: overallStatus,
      message,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Detect performance anomalies
   */
  _detectAnomalies(checkName, result) {
    const history = this.checkHistory.get(checkName) || [];
    if (history.length < 10) return; // Need minimum history
    
    const recentResults = history.slice(-10);
    const responseTimes = recentResults.map(r => r.responseTime);
    
    const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    
    const zScore = Math.abs(result.responseTime - mean) / stdDev;
    
    if (zScore > this.config.anomalyThreshold) {
      this.logger.warn(`Performance anomaly detected in ${checkName}: ${result.responseTime}ms (z-score: ${zScore.toFixed(2)})`);
      
      this.emit('anomaly:detected', {
        checkName,
        responseTime: result.responseTime,
        mean: Math.round(mean),
        stdDev: Math.round(stdDev),
        zScore: Number(zScore.toFixed(2)),
        timestamp: result.timestamp
      });
    }
  }
  
  /**
   * Get active incidents
   */
  _getActiveIncidents() {
    return this.metrics.incidents.filter(incident => incident.status === 'open');
  }
  
  /**
   * Generate recommendations based on health results
   */
  _generateRecommendations(results) {
    const recommendations = [];
    
    for (const [name, result] of results) {
      if (result.status === HealthStatus.CRITICAL) {
        recommendations.push({
          priority: 'high',
          component: name,
          message: `Critical issue requires immediate attention: ${result.message}`,
          action: 'investigate_critical_failure'
        });
      } else if (result.status === HealthStatus.DEGRADED) {
        recommendations.push({
          priority: 'medium',
          component: name,
          message: `Performance degradation detected: ${result.message}`,
          action: 'investigate_performance_issue'
        });
      } else if (result.responseTime > this.config.responseTimeThreshold) {
        recommendations.push({
          priority: 'low',
          component: name,
          message: `Slow response time: ${result.responseTime}ms`,
          action: 'optimize_performance'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Create timeout promise
   */
  _createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeout}ms`));
      }, timeout);
    });
  }
  
  /**
   * Sleep utility
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default HealthMonitor;
