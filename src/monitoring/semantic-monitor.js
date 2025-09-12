/**
 * Real-time Semantic Processing Monitor
 * Enterprise monitoring and alerting for Fortune 5 RDF/Turtle processing
 * @fileoverview Real-time monitoring for semantic operations with metrics and alerting
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

/**
 * @typedef {Object} ProcessingMetrics
 * @property {number} timestamp - Timestamp of metrics collection
 * @property {number} queryCount - Total number of queries
 * @property {Object} queryLatency - Query latency statistics
 * @property {number} queryLatency.min - Minimum latency
 * @property {number} queryLatency.max - Maximum latency
 * @property {number} queryLatency.avg - Average latency
 * @property {number} queryLatency.p95 - 95th percentile latency
 * @property {number} queryLatency.p99 - 99th percentile latency
 * @property {number} throughput - Queries per second
 * @property {number} errorCount - Number of errors
 * @property {number} errorRate - Error rate (0-1)
 * @property {Object} memoryUsage - Memory usage statistics
 * @property {number} memoryUsage.heapUsed - Heap used in bytes
 * @property {number} memoryUsage.heapTotal - Total heap in bytes
 * @property {number} memoryUsage.external - External memory in bytes
 * @property {number} memoryUsage.usage - Memory usage percentage (0-1)
 * @property {number} cpuUsage - CPU usage percentage
 * @property {Object} [cacheStats] - Cache statistics
 * @property {number} cacheStats.hits - Cache hits
 * @property {number} cacheStats.misses - Cache misses
 * @property {number} cacheStats.hitRate - Hit rate (0-1)
 * @property {number} cacheStats.size - Cache size
 */

/**
 * @typedef {Object} ComplianceEvent
 * @property {number} timestamp - Event timestamp
 * @property {'gdpr'|'hipaa'|'sox'} type - Compliance type
 * @property {string} event - Event description
 * @property {string} [userId] - User ID
 * @property {string} [dataCategory] - Data category
 * @property {string} action - Action taken
 * @property {Record<string, any>} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} SecurityEvent
 * @property {number} timestamp - Event timestamp
 * @property {'info'|'warning'|'error'|'critical'} level - Severity level
 * @property {'auth'|'data'|'query'|'access'} category - Event category
 * @property {string} message - Event message
 * @property {string} source - Event source
 * @property {Record<string, any>} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} Alert
 * @property {string} id - Alert ID
 * @property {number} timestamp - Alert timestamp
 * @property {'low'|'medium'|'high'|'critical'} severity - Alert severity
 * @property {'performance'|'security'|'compliance'|'error'} type - Alert type
 * @property {string} title - Alert title
 * @property {string} message - Alert message
 * @property {Partial<ProcessingMetrics>} [metrics] - Related metrics
 * @property {boolean} [resolved] - Whether alert is resolved
 * @property {number} [resolvedAt] - Resolution timestamp
 */

/**
 * Real-time semantic processing monitor with enterprise alerting
 * @class SemanticMonitor
 * @extends {EventEmitter}
 */
export class SemanticMonitor extends EventEmitter {
  /**
   * @param {import('../../config/semantic.config.js').SemanticConfig} config - Semantic configuration
   */
  constructor(config) {
    super();
    this.config = config;
    /** @private @type {ProcessingMetrics[]} */
    this.metrics = [];
    /** @private @type {ComplianceEvent[]} */
    this.complianceEvents = [];
    /** @private @type {SecurityEvent[]} */
    this.securityEvents = [];
    /** @private @type {Map<string, Alert>} */
    this.activeAlerts = new Map();
    /** @private @type {number[]} */
    this.queryLatencies = [];
    /** @private @type {boolean} */
    this.isMonitoring = false;
    /** @private @type {NodeJS.Timeout|undefined} */
    this.monitoringInterval = undefined;
  }

  /**
   * Start monitoring
   * @returns {void}
   */
  start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
    }, 10000); // Collect metrics every 10 seconds

    this.emit('monitoring:started');
    console.log('🔍 Semantic processing monitoring started');
  }

  /**
   * Stop monitoring
   * @returns {void}
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.emit('monitoring:stopped');
    console.log('⏹️ Semantic processing monitoring stopped');
  }

  /**
   * Record query execution
   * @param {number} latency - Query latency in milliseconds
   * @param {boolean} [success=true] - Whether query was successful
   * @returns {void}
   */
  recordQuery(latency, success = true) {
    this.queryLatencies.push(latency);
    
    // Keep only last 1000 latencies for performance
    if (this.queryLatencies.length > 1000) {
      this.queryLatencies = this.queryLatencies.slice(-1000);
    }

    if (!success) {
      this.recordError('query_execution', `Query failed with ${latency}ms latency`);
    }

    // Check for immediate alerts
    if (latency > this.config.monitoring.performanceThresholds.queryLatency) {
      this.triggerAlert({
        type: 'performance',
        severity: 'high',
        title: 'High Query Latency',
        message: `Query latency (${latency}ms) exceeds threshold (${this.config.monitoring.performanceThresholds.queryLatency}ms)`
      });
    }
  }

  /**
   * Record compliance event
   * @param {Omit<ComplianceEvent, 'timestamp'>} event - Compliance event data
   * @returns {void}
   */
  recordComplianceEvent(event) {
    /** @type {ComplianceEvent} */
    const complianceEvent = {
      ...event,
      timestamp: this.getDeterministicTimestamp()
    };

    this.complianceEvents.push(complianceEvent);
    
    // Keep only last 10000 events
    if (this.complianceEvents.length > 10000) {
      this.complianceEvents = this.complianceEvents.slice(-10000);
    }

    this.emit('compliance:event', complianceEvent);

    // Special handling for sensitive operations
    if (['data_deletion', 'data_export', 'consent_withdrawal'].includes(event.action)) {
      this.triggerAlert({
        type: 'compliance',
        severity: 'medium',
        title: 'Compliance Action',
        message: `${event.type.toUpperCase()} compliance action: ${event.action}`
      });
    }
  }

  /**
   * Record security event
   * @param {Omit<SecurityEvent, 'timestamp'>} event - Security event data
   * @returns {void}
   */
  recordSecurityEvent(event) {
    /** @type {SecurityEvent} */
    const securityEvent = {
      ...event,
      timestamp: this.getDeterministicTimestamp()
    };

    this.securityEvents.push(securityEvent);
    
    // Keep only last 10000 events
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-10000);
    }

    this.emit('security:event', securityEvent);

    // Trigger alerts for high-severity security events
    if (event.level === 'critical' || event.level === 'error') {
      this.triggerAlert({
        type: 'security',
        severity: event.level === 'critical' ? 'critical' : 'high',
        title: `Security ${event.level.toUpperCase()}`,
        message: event.message
      });
    }
  }

  /**
   * Record error
   * @param {string} category - Error category
   * @param {string} message - Error message
   * @param {Record<string, any>} [metadata] - Additional metadata
   * @returns {void}
   */
  recordError(category, message, metadata) {
    this.recordSecurityEvent({
      level: 'error',
      category: 'query',
      message: `${category}: ${message}`,
      source: 'semantic_processor',
      metadata
    });
  }

  /**
   * Get current metrics
   * @returns {ProcessingMetrics|null} Current metrics or null
   */
  getCurrentMetrics() {
    if (this.metrics.length === 0) return null;
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get metrics history
   * @param {number} [limit=100] - Number of metrics to return
   * @returns {ProcessingMetrics[]} Metrics history
   */
  getMetricsHistory(limit = 100) {
    return this.metrics.slice(-limit);
  }

  /**
   * Get compliance events
   * @param {number} [limit=100] - Number of events to return
   * @param {ComplianceEvent['type']} [type] - Filter by event type
   * @returns {ComplianceEvent[]} Compliance events
   */
  getComplianceEvents(limit = 100, type) {
    let events = this.complianceEvents.slice(-limit);
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events;
  }

  /**
   * Get security events
   * @param {number} [limit=100] - Number of events to return
   * @param {SecurityEvent['level']} [level] - Filter by severity level
   * @returns {SecurityEvent[]} Security events
   */
  getSecurityEvents(limit = 100, level) {
    let events = this.securityEvents.slice(-limit);
    if (level) {
      events = events.filter(e => e.level === level);
    }
    return events;
  }

  /**
   * Get active alerts
   * @returns {Alert[]} Active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   * @param {string} alertId - Alert ID
   * @returns {boolean} Whether alert was resolved
   */
  resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = this.getDeterministicTimestamp();
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get health status
   * @returns {Object} Health status object
   */
  getHealthStatus() {
    const currentMetrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    const checks = {
      queryLatency: !currentMetrics || currentMetrics.queryLatency.avg <= this.config.monitoring.performanceThresholds.queryLatency,
      memoryUsage: !currentMetrics || currentMetrics.memoryUsage.usage <= this.config.monitoring.performanceThresholds.memoryUsage,
      errorRate: !currentMetrics || currentMetrics.errorRate <= this.config.monitoring.performanceThresholds.errorRate,
      monitoring: this.isMonitoring
    };

    const unhealthyChecks = Object.values(checks).filter(check => !check).length;
    let status = 'healthy';

    if (criticalAlerts.length > 0 || unhealthyChecks > 2) {
      status = 'unhealthy';
    } else if (activeAlerts.length > 0 || unhealthyChecks > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: this.getDeterministicTimestamp(),
      uptime: process.uptime(),
      checks,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length
    };
  }

  /**
   * Export monitoring data
   * @param {boolean} [includeEvents=false] - Whether to include events
   * @returns {Object} Exported monitoring data
   */
  exportData(includeEvents = false) {
    const data = {
      config: this.config,
      metrics: this.metrics,
      alerts: Array.from(this.activeAlerts.values()),
      exportedAt: this.getDeterministicTimestamp()
    };

    if (includeEvents) {
      data.complianceEvents = this.complianceEvents;
      data.securityEvents = this.securityEvents;
    }

    return data;
  }

  /**
   * Collect system metrics
   * @private
   * @returns {void}
   */
  collectMetrics() {
    const now = this.getDeterministicTimestamp();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate query latency statistics
    const latencies = this.queryLatencies.slice();
    latencies.sort((a, b) => a - b);

    const latencyStats = {
      min: latencies.length > 0 ? latencies[0] : 0,
      max: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
      p99: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0
    };

    // Calculate error rate (errors in last 10 seconds)
    const recentErrors = this.securityEvents.filter(e => 
      e.level === 'error' && (now - e.timestamp) <= 10000
    ).length;
    
    const recentQueries = Math.max(1, this.queryLatencies.length);
    const errorRate = recentErrors / recentQueries;

    /** @type {ProcessingMetrics} */
    const metrics = {
      timestamp: now,
      queryCount: this.queryLatencies.length,
      queryLatency: latencyStats,
      throughput: this.queryLatencies.length / 10, // queries per second (10 second window)
      errorCount: recentErrors,
      errorRate,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        usage: memUsage.heapUsed / memUsage.heapTotal
      },
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to percentage approximation
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metric snapshots
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    this.emit('metrics:collected', metrics);
  }

  /**
   * Check performance thresholds and trigger alerts
   * @private
   * @returns {void}
   */
  checkThresholds() {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return;

    const thresholds = this.config.monitoring.performanceThresholds;

    // Check memory usage
    if (currentMetrics.memoryUsage.usage > thresholds.memoryUsage) {
      this.triggerAlert({
        type: 'performance',
        severity: 'high',
        title: 'High Memory Usage',
        message: `Memory usage (${(currentMetrics.memoryUsage.usage * 100).toFixed(1)}%) exceeds threshold (${thresholds.memoryUsage * 100}%)`,
        metrics: currentMetrics
      });
    }

    // Check error rate
    if (currentMetrics.errorRate > thresholds.errorRate) {
      this.triggerAlert({
        type: 'error',
        severity: 'critical',
        title: 'High Error Rate',
        message: `Error rate (${(currentMetrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${thresholds.errorRate * 100}%)`,
        metrics: currentMetrics
      });
    }

    // Check query latency
    if (currentMetrics.queryLatency.p95 > thresholds.queryLatency) {
      this.triggerAlert({
        type: 'performance',
        severity: 'medium',
        title: 'High Query Latency',
        message: `95th percentile query latency (${currentMetrics.queryLatency.p95.toFixed(2)}ms) exceeds threshold (${thresholds.queryLatency}ms)`,
        metrics: currentMetrics
      });
    }
  }

  /**
   * Trigger alert
   * @private
   * @param {Omit<Alert, 'id'|'timestamp'>} alertData - Alert data
   * @returns {void}
   */
  triggerAlert(alertData) {
    /** @type {Alert} */
    const alert = {
      ...alertData,
      id: `alert-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.getDeterministicTimestamp()
    };

    this.activeAlerts.set(alert.id, alert);
    this.emit('alert:triggered', alert);

    // Send to configured channels
    this.sendAlert(alert);

    // Auto-resolve low severity alerts after 5 minutes
    if (alert.severity === 'low') {
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Send alert to configured channels
   * @private
   * @param {Alert} alert - Alert to send
   * @returns {void}
   */
  sendAlert(alert) {
    if (!this.config.monitoring.alerting.enabled) return;

    const channels = this.config.monitoring.alerting.channels;
    
    channels.forEach(channel => {
      switch (channel) {
        case 'email':
          this.sendEmailAlert(alert);
          break;
        case 'slack':
          this.sendSlackAlert(alert);
          break;
        case 'webhook':
          this.sendWebhookAlert(alert);
          break;
        case 'pagerduty':
          this.sendPagerDutyAlert(alert);
          break;
      }
    });
  }

  /**
   * Send email alert (implementation placeholder)
   * @private
   * @param {Alert} alert - Alert to send
   * @returns {void}
   */
  sendEmailAlert(alert) {
    console.log(`📧 Email Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with email service
  }

  /**
   * Send Slack alert (implementation placeholder)
   * @private
   * @param {Alert} alert - Alert to send
   * @returns {void}
   */
  sendSlackAlert(alert) {
    console.log(`💬 Slack Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with Slack API
  }

  /**
   * Send webhook alert (implementation placeholder)
   * @private
   * @param {Alert} alert - Alert to send
   * @returns {void}
   */
  sendWebhookAlert(alert) {
    console.log(`🔗 Webhook Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would send HTTP POST to configured webhook
  }

  /**
   * Send PagerDuty alert (implementation placeholder)
   * @private
   * @param {Alert} alert - Alert to send
   * @returns {void}
   */
  sendPagerDutyAlert(alert) {
    console.log(`📟 PagerDuty Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with PagerDuty API
  }
}

/**
 * Global monitor instance
 * @type {SemanticMonitor|null}
 */
let globalMonitor = null;

/**
 * Initialize global monitoring
 * @param {import('../../config/semantic.config.js').SemanticConfig} config - Semantic configuration
 * @returns {SemanticMonitor} Monitor instance
 */
export function initializeMonitoring(config) {
  if (globalMonitor) {
    globalMonitor.stop();
  }
  
  globalMonitor = new SemanticMonitor(config);
  
  if (config.monitoring.metricsEnabled) {
    globalMonitor.start();
  }
  
  return globalMonitor;
}

/**
 * Get global monitor instance
 * @returns {SemanticMonitor|null} Monitor instance or null
 */
export function getMonitor() {
  return globalMonitor;
}

/**
 * Convenience functions for recording events
 */

/**
 * Record query execution
 * @param {number} latency - Query latency in milliseconds
 * @param {boolean} [success=true] - Whether query was successful
 * @returns {void}
 */
export function recordQuery(latency, success = true) {
  globalMonitor?.recordQuery(latency, success);
}

/**
 * Record compliance event
 * @param {Omit<ComplianceEvent, 'timestamp'>} event - Compliance event data
 * @returns {void}
 */
export function recordComplianceEvent(event) {
  globalMonitor?.recordComplianceEvent(event);
}

/**
 * Record security event
 * @param {Omit<SecurityEvent, 'timestamp'>} event - Security event data
 * @returns {void}
 */
export function recordSecurityEvent(event) {
  globalMonitor?.recordSecurityEvent(event);
}

/**
 * Record error
 * @param {string} category - Error category
 * @param {string} message - Error message
 * @param {Record<string, any>} [metadata] - Additional metadata
 * @returns {void}
 */
export function recordError(category, message, metadata) {
  globalMonitor?.recordError(category, message, metadata);
}