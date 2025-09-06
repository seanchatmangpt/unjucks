/**
 * Fortune 5 Enterprise Production Monitoring
 * Real-time RDF processing metrics and performance monitoring
 */

import { EventEmitter } from 'node:events';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { cpus, totalmem, freemem } from 'node:os';
import { getSemanticConfig } from '../../config/semantic-production';

interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

interface RDFProcessingMetrics {
  triplesProcessed: number;
  parseLatency: number;
  queryLatency: number;
  memoryUsage: number;
  errorRate: number;
  throughput: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  processMetrics: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

interface ComplianceEvent {
  type: 'access' | 'modification' | 'query' | 'export' | 'deletion';
  userId: string;
  resource: string;
  timestamp: number;
  success: boolean;
  details?: Record<string, unknown>;
}

interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'encryption' | 'audit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: RDFProcessingMetrics & SystemMetrics) => boolean;
  severity: 'warning' | 'critical';
  description: string;
  enabled: boolean;
}

class SemanticMonitoring extends EventEmitter {
  private config = getSemanticConfig();
  private metrics: Map<string, MetricPoint[]> = new Map();
  private rdfMetrics: RDFProcessingMetrics = {
    triplesProcessed: 0,
    parseLatency: 0,
    queryLatency: 0,
    memoryUsage: 0,
    errorRate: 0,
    throughput: 0,
  };
  private systemMetrics: SystemMetrics = {
    cpuUsage: 0,
    memoryUsage: { total: 0, used: 0, free: 0, percentage: 0 },
    processMetrics: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
  };
  private complianceEvents: ComplianceEvent[] = [];
  private securityEvents: SecurityEvent[] = [];
  private alertRules: AlertRule[] = [];
  private isMonitoring = false;
  private performanceObserver: PerformanceObserver | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupDefaultAlertRules();
    this.setupPerformanceObserver();
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring(intervalMs = 15000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Starting Fortune 5 semantic monitoring...');

    // Start periodic metric collection
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.evaluateAlerts();
      this.emit('metrics-updated', {
        rdf: this.rdfMetrics,
        system: this.systemMetrics,
        timestamp: Date.now(),
      });
    }, intervalMs);

    // Start performance monitoring
    if (this.performanceObserver) {
      this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
    }

    this.emit('monitoring-started', { interval: intervalMs });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    console.log('🛑 Semantic monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Record RDF processing metrics
   */
  recordRDFMetrics(operation: string, metrics: Partial<RDFProcessingMetrics>): void {
    const timestamp = Date.now();

    // Update current metrics
    Object.assign(this.rdfMetrics, metrics);

    // Store time-series data
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        this.addMetricPoint(`rdf.${operation}.${key}`, value, { operation });
      }
    });

    this.emit('rdf-metrics', {
      operation,
      metrics: { ...this.rdfMetrics },
      timestamp,
    });
  }

  /**
   * Record semantic query performance
   */
  recordQueryPerformance(queryType: string, duration: number, resultCount: number, success = true): void {
    const timestamp = Date.now();

    this.addMetricPoint('rdf.query.duration', duration, { type: queryType, success: success.toString() });
    this.addMetricPoint('rdf.query.results', resultCount, { type: queryType });

    // Update aggregated metrics
    this.rdfMetrics.queryLatency = duration;
    this.rdfMetrics.throughput = resultCount / (duration / 1000); // results per second

    if (!success) {
      this.rdfMetrics.errorRate += 1;
    }

    this.emit('query-performance', {
      queryType,
      duration,
      resultCount,
      success,
      timestamp,
    });
  }

  /**
   * Record parsing performance
   */
  recordParsePerformance(format: string, tripleCount: number, duration: number, success = true): void {
    const timestamp = Date.now();

    this.addMetricPoint('rdf.parse.duration', duration, { format, success: success.toString() });
    this.addMetricPoint('rdf.parse.triples', tripleCount, { format });
    this.addMetricPoint('rdf.parse.throughput', tripleCount / (duration / 1000), { format });

    // Update aggregated metrics
    this.rdfMetrics.parseLatency = duration;
    this.rdfMetrics.triplesProcessed += tripleCount;

    if (!success) {
      this.rdfMetrics.errorRate += 1;
    }

    this.emit('parse-performance', {
      format,
      tripleCount,
      duration,
      success,
      timestamp,
    });
  }

  /**
   * Record compliance event for audit trail
   */
  recordComplianceEvent(event: Omit<ComplianceEvent, 'timestamp'>): void {
    const complianceEvent: ComplianceEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.complianceEvents.push(complianceEvent);

    // Keep only recent events (last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.complianceEvents = this.complianceEvents.filter(e => e.timestamp > cutoff);

    this.emit('compliance-event', complianceEvent);

    // Check for compliance violations
    if (!event.success) {
      this.recordSecurityEvent({
        type: 'audit',
        severity: 'medium',
        message: `Compliance violation: ${event.type} failed for user ${event.userId}`,
        metadata: { complianceEvent },
      });
    }
  }

  /**
   * Record security event
   */
  recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.securityEvents.push(securityEvent);

    // Keep only recent events (last 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.securityEvents = this.securityEvents.filter(e => e.timestamp > cutoff);

    this.emit('security-event', securityEvent);

    // Trigger immediate alert for critical events
    if (event.severity === 'critical') {
      this.emit('alert', {
        type: 'security',
        severity: 'critical',
        message: event.message,
        timestamp: securityEvent.timestamp,
        metadata: event.metadata,
      });
    }
  }

  /**
   * Get current metrics dashboard data
   */
  getDashboardMetrics(): {
    rdf: RDFProcessingMetrics;
    system: SystemMetrics;
    alerts: Array<{ rule: AlertRule; triggered: boolean }>;
    compliance: { events: number; violations: number };
    security: { events: number; criticalEvents: number };
  } {
    const recentComplianceViolations = this.complianceEvents.filter(
      e => !e.success && e.timestamp > Date.now() - 60 * 60 * 1000 // last hour
    ).length;

    const recentSecurityEvents = this.securityEvents.filter(
      e => e.timestamp > Date.now() - 60 * 60 * 1000 // last hour
    );

    const criticalSecurityEvents = recentSecurityEvents.filter(e => e.severity === 'critical').length;

    const alertStatus = this.alertRules.map(rule => ({
      rule,
      triggered: rule.enabled && rule.condition({ ...this.rdfMetrics, ...this.systemMetrics }),
    }));

    return {
      rdf: { ...this.rdfMetrics },
      system: { ...this.systemMetrics },
      alerts: alertStatus,
      compliance: {
        events: this.complianceEvents.length,
        violations: recentComplianceViolations,
      },
      security: {
        events: recentSecurityEvents.length,
        criticalEvents: criticalSecurityEvents,
      },
    };
  }

  /**
   * Get metrics for specific time range
   */
  getMetrics(metricName: string, fromTimestamp?: number, toTimestamp?: number): MetricPoint[] {
    const points = this.metrics.get(metricName) || [];
    
    if (!fromTimestamp && !toTimestamp) {
      return points;
    }

    return points.filter(point => {
      if (fromTimestamp && point.timestamp < fromTimestamp) return false;
      if (toTimestamp && point.timestamp > toTimestamp) return false;
      return true;
    });
  }

  /**
   * Get compliance audit trail
   */
  getComplianceAuditTrail(fromTimestamp?: number, toTimestamp?: number): ComplianceEvent[] {
    let events = this.complianceEvents;

    if (fromTimestamp || toTimestamp) {
      events = events.filter(event => {
        if (fromTimestamp && event.timestamp < fromTimestamp) return false;
        if (toTimestamp && event.timestamp > toTimestamp) return false;
        return true;
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get security events
   */
  getSecurityEvents(severity?: SecurityEvent['severity'], fromTimestamp?: number, toTimestamp?: number): SecurityEvent[] {
    let events = this.securityEvents;

    if (severity) {
      events = events.filter(event => event.severity === severity);
    }

    if (fromTimestamp || toTimestamp) {
      events = events.filter(event => {
        if (fromTimestamp && event.timestamp < fromTimestamp) return false;
        if (toTimestamp && event.timestamp > toTimestamp) return false;
        return true;
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    const existingIndex = this.alertRules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      this.alertRules[existingIndex] = rule;
    } else {
      this.alertRules.push(rule);
    }

    this.emit('alert-rule-updated', rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const initialLength = this.alertRules.length;
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId);
    
    const removed = this.alertRules.length < initialLength;
    if (removed) {
      this.emit('alert-rule-removed', ruleId);
    }
    
    return removed;
  }

  /**
   * Export monitoring data for compliance
   */
  exportMonitoringData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      exportTimestamp: new Date().toISOString(),
      configuration: this.config,
      currentMetrics: {
        rdf: this.rdfMetrics,
        system: this.systemMetrics,
      },
      complianceEvents: this.complianceEvents,
      securityEvents: this.securityEvents,
      alertRules: this.alertRules,
      metricsHistory: Object.fromEntries(this.metrics.entries()),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Convert to CSV format for compliance reporting
      let csv = 'Type,Timestamp,Event,Details\n';
      
      this.complianceEvents.forEach(event => {
        csv += `Compliance,${new Date(event.timestamp).toISOString()},${event.type},"${JSON.stringify(event)}"\n`;
      });
      
      this.securityEvents.forEach(event => {
        csv += `Security,${new Date(event.timestamp).toISOString()},${event.type},"${JSON.stringify(event)}"\n`;
      });
      
      return csv;
    }
  }

  private addMetricPoint(metricName: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }

    const points = this.metrics.get(metricName)!;
    points.push({
      timestamp: Date.now(),
      value,
      labels,
    });

    // Keep only recent points (last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentPoints = points.filter(point => point.timestamp > cutoff);
    this.metrics.set(metricName, recentPoints);
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;

    this.systemMetrics = {
      cpuUsage: this.getCPUUsage(),
      memoryUsage: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100,
      },
      processMetrics: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
    };

    // Record system metrics
    this.addMetricPoint('system.cpu.usage', this.systemMetrics.cpuUsage);
    this.addMetricPoint('system.memory.percentage', this.systemMetrics.memoryUsage.percentage);
    this.addMetricPoint('process.heap.used', memUsage.heapUsed);
    this.addMetricPoint('process.heap.total', memUsage.heapTotal);
  }

  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    // In production, you'd want more sophisticated CPU monitoring
    const cpuCount = cpus().length;
    return Math.random() * 100; // Mock for now - replace with actual CPU monitoring
  }

  private evaluateAlerts(): void {
    const currentMetrics = { ...this.rdfMetrics, ...this.systemMetrics };
    
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;
      
      const triggered = rule.condition(currentMetrics);
      if (triggered) {
        this.emit('alert', {
          rule,
          metrics: currentMetrics,
          timestamp: Date.now(),
        });
      }
    });
  }

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-error-rate',
        name: 'High RDF Error Rate',
        condition: (metrics) => metrics.errorRate > 10, // More than 10 errors
        severity: 'critical',
        description: 'RDF processing error rate is above acceptable threshold',
        enabled: true,
      },
      {
        id: 'slow-query-performance',
        name: 'Slow Query Performance',
        condition: (metrics) => metrics.queryLatency > 5000, // 5 seconds
        severity: 'warning',
        description: 'RDF query latency is above performance target',
        enabled: true,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.memoryUsage.percentage > 80, // 80%
        severity: 'warning',
        description: 'System memory usage is approaching limits',
        enabled: true,
      },
      {
        id: 'critical-memory-usage',
        name: 'Critical Memory Usage',
        condition: (metrics) => metrics.memoryUsage.percentage > 90, // 90%
        severity: 'critical',
        description: 'System memory usage is critically high',
        enabled: true,
      },
      {
        id: 'low-throughput',
        name: 'Low RDF Throughput',
        condition: (metrics) => metrics.throughput < 100 && metrics.triplesProcessed > 0, // Less than 100 triples/sec
        severity: 'warning',
        description: 'RDF processing throughput is below expected levels',
        enabled: true,
      },
    ];
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('rdf.')) {
          this.addMetricPoint(`perf.${entry.name}`, entry.duration);
        }
      }
    });
  }
}

// Singleton instance for application-wide monitoring
const semanticMonitor = new SemanticMonitoring();

export {
  SemanticMonitoring,
  semanticMonitor,
  type RDFProcessingMetrics,
  type SystemMetrics,
  type ComplianceEvent,
  type SecurityEvent,
  type AlertRule,
  type MetricPoint,
};

// Performance tracking utilities
export const trackRDFOperation = <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    performance.mark(`${operation}-start`);

    fn()
      .then((result) => {
        const end = performance.now();
        performance.mark(`${operation}-end`);
        performance.measure(`rdf.${operation}`, `${operation}-start`, `${operation}-end`);

        semanticMonitor.recordRDFMetrics(operation, {
          parseLatency: end - start,
        });

        resolve(result);
      })
      .catch((error) => {
        const end = performance.now();
        performance.mark(`${operation}-error`);

        semanticMonitor.recordRDFMetrics(operation, {
          parseLatency: end - start,
          errorRate: 1,
        });

        reject(error);
      });
  });
};