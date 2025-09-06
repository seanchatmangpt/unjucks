/**
 * Real-time Semantic Processing Monitor
 * Enterprise monitoring and alerting for Fortune 5 RDF/Turtle processing
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type { SemanticConfig } from '../../config/semantic.config.js';

interface ProcessingMetrics {
  timestamp: number;
  queryCount: number;
  queryLatency: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorCount: number;
  errorRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    usage: number; // percentage
  };
  cpuUsage: number;
  cacheStats?: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

interface ComplianceEvent {
  timestamp: number;
  type: 'gdpr' | 'hipaa' | 'sox';
  event: string;
  userId?: string;
  dataCategory?: string;
  action: string;
  metadata?: Record<string, any>;
}

interface SecurityEvent {
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'auth' | 'data' | 'query' | 'access';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

interface Alert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'performance' | 'security' | 'compliance' | 'error';
  title: string;
  message: string;
  metrics?: Partial<ProcessingMetrics>;
  resolved?: boolean;
  resolvedAt?: number;
}

export class SemanticMonitor extends EventEmitter {
  private config: SemanticConfig;
  private metrics: ProcessingMetrics[] = [];
  private complianceEvents: ComplianceEvent[] = [];
  private securityEvents: SecurityEvent[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private queryLatencies: number[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: SemanticConfig) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring
   */
  start(): void {
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
   */
  stop(): void {
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
   */
  recordQuery(latency: number, success: boolean = true): void {
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
   */
  recordComplianceEvent(event: Omit<ComplianceEvent, 'timestamp'>): void {
    const complianceEvent: ComplianceEvent = {
      ...event,
      timestamp: Date.now()
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
   */
  recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now()
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
   */
  recordError(category: string, message: string, metadata?: Record<string, any>): void {
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
   */
  getCurrentMetrics(): ProcessingMetrics | null {
    if (this.metrics.length === 0) return null;
    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 100): ProcessingMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get compliance events
   */
  getComplianceEvents(limit: number = 100, type?: ComplianceEvent['type']): ComplianceEvent[] {
    let events = this.complianceEvents.slice(-limit);
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events;
  }

  /**
   * Get security events
   */
  getSecurityEvents(limit: number = 100, level?: SecurityEvent['level']): SecurityEvent[] {
    let events = this.securityEvents.slice(-limit);
    if (level) {
      events = events.filter(e => e.level === level);
    }
    return events;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    uptime: number;
    checks: Record<string, boolean>;
    activeAlerts: number;
    criticalAlerts: number;
  } {
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
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (criticalAlerts.length > 0 || unhealthyChecks > 2) {
      status = 'unhealthy';
    } else if (activeAlerts.length > 0 || unhealthyChecks > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: Date.now(),
      uptime: process.uptime(),
      checks,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length
    };
  }

  /**
   * Export monitoring data
   */
  exportData(includeEvents: boolean = false): {
    config: SemanticConfig;
    metrics: ProcessingMetrics[];
    alerts: Alert[];
    complianceEvents?: ComplianceEvent[];
    securityEvents?: SecurityEvent[];
    exportedAt: number;
  } {
    const data: any = {
      config: this.config,
      metrics: this.metrics,
      alerts: Array.from(this.activeAlerts.values()),
      exportedAt: Date.now()
    };

    if (includeEvents) {
      data.complianceEvents = this.complianceEvents;
      data.securityEvents = this.securityEvents;
    }

    return data;
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {
    const now = Date.now();
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

    const metrics: ProcessingMetrics = {
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
   */
  private checkThresholds(): void {
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
   */
  private triggerAlert(alertData: Omit<Alert, 'id' | 'timestamp'>): void {
    const alert: Alert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
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
   */
  private sendAlert(alert: Alert): void {
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
   */
  private sendEmailAlert(alert: Alert): void {
    console.log(`📧 Email Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with email service
  }

  /**
   * Send Slack alert (implementation placeholder)
   */
  private sendSlackAlert(alert: Alert): void {
    console.log(`💬 Slack Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with Slack API
  }

  /**
   * Send webhook alert (implementation placeholder)
   */
  private sendWebhookAlert(alert: Alert): void {
    console.log(`🔗 Webhook Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would send HTTP POST to configured webhook
  }

  /**
   * Send PagerDuty alert (implementation placeholder)
   */
  private sendPagerDutyAlert(alert: Alert): void {
    console.log(`📟 PagerDuty Alert: [${alert.severity.toUpperCase()}] ${alert.title}`);
    // Implementation would integrate with PagerDuty API
  }
}

/**
 * Global monitor instance
 */
let globalMonitor: SemanticMonitor | null = null;

/**
 * Initialize global monitoring
 */
export function initializeMonitoring(config: SemanticConfig): SemanticMonitor {
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
 */
export function getMonitor(): SemanticMonitor | null {
  return globalMonitor;
}

/**
 * Convenience functions for recording events
 */
export function recordQuery(latency: number, success: boolean = true): void {
  globalMonitor?.recordQuery(latency, success);
}

export function recordComplianceEvent(event: Omit<ComplianceEvent, 'timestamp'>): void {
  globalMonitor?.recordComplianceEvent(event);
}

export function recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  globalMonitor?.recordSecurityEvent(event);
}

export function recordError(category: string, message: string, metadata?: Record<string, any>): void {
  globalMonitor?.recordError(category, message, metadata);
}

export * from './semantic-monitor.js';