/**
 * Production Performance Monitor
 * Real-time performance monitoring with alerting and anomaly detection
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { cpus, totalmem, freemem } from 'os';
import logger from '../lib/observability/logger.js';
import { metricsCollector } from './metrics-collector.js';

/**
 * Performance threshold levels
 */
export const PerformanceLevel = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  ACCEPTABLE: 'acceptable',
  POOR: 'poor',
  CRITICAL: 'critical'
};

/**
 * Performance categories for monitoring
 */
export const PerformanceCategory = {
  RESPONSE_TIME: 'response_time',
  THROUGHPUT: 'throughput',
  MEMORY: 'memory',
  CPU: 'cpu',
  DATABASE: 'database',
  TEMPLATE: 'template',
  RDF: 'rdf',
  NETWORK: 'network'
};

/**
 * Performance metric tracking
 */
class PerformanceMetric {
  constructor(name, category, thresholds = {}) {
    this.name = name;
    this.category = category;
    this.thresholds = {
      excellent: thresholds.excellent || 0,
      good: thresholds.good || 50,
      acceptable: thresholds.acceptable || 100,
      poor: thresholds.poor || 200,
      critical: thresholds.critical || 500,
      ...thresholds
    };
    
    this.measurements = [];
    this.maxMeasurements = 1000;
    this.alerts = [];
    this.anomalies = [];
    
    // Statistical data
    this.stats = {
      count: 0,
      sum: 0,
      min: Number.MAX_VALUE,
      max: Number.MIN_VALUE,
      mean: 0,
      variance: 0,
      stdDev: 0,
      p50: 0,
      p95: 0,
      p99: 0
    };
  }
  
  /**
   * Add a measurement
   */
  addMeasurement(value, timestamp = Date.now(), metadata = {}) {
    const measurement = {
      value,
      timestamp,
      metadata,
      level: this.determinePerformanceLevel(value)
    };
    
    this.measurements.push(measurement);
    
    // Maintain size limit
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
    
    // Update statistics
    this.updateStatistics();
    
    // Check for anomalies
    this.detectAnomalies(measurement);
    
    return measurement;
  }
  
  /**
   * Determine performance level based on thresholds
   */
  determinePerformanceLevel(value) {
    if (value <= this.thresholds.excellent) return PerformanceLevel.EXCELLENT;
    if (value <= this.thresholds.good) return PerformanceLevel.GOOD;
    if (value <= this.thresholds.acceptable) return PerformanceLevel.ACCEPTABLE;
    if (value <= this.thresholds.poor) return PerformanceLevel.POOR;
    return PerformanceLevel.CRITICAL;
  }
  
  /**
   * Update statistical measures
   */
  updateStatistics() {
    if (this.measurements.length === 0) return;
    
    const values = this.measurements.map(m => m.value).sort((a, b) => a - b);
    
    this.stats.count = values.length;
    this.stats.sum = values.reduce((a, b) => a + b, 0);
    this.stats.min = values[0];
    this.stats.max = values[values.length - 1];
    this.stats.mean = this.stats.sum / this.stats.count;
    
    // Calculate variance and standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - this.stats.mean, 2), 0) / this.stats.count;
    this.stats.variance = variance;
    this.stats.stdDev = Math.sqrt(variance);
    
    // Calculate percentiles
    this.stats.p50 = this.calculatePercentile(values, 0.5);
    this.stats.p95 = this.calculatePercentile(values, 0.95);
    this.stats.p99 = this.calculatePercentile(values, 0.99);
  }
  
  /**
   * Calculate percentile from sorted values
   */
  calculatePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }
  
  /**
   * Detect performance anomalies using statistical analysis
   */
  detectAnomalies(measurement) {
    if (this.measurements.length < 30) return; // Need minimum data for anomaly detection
    
    const { value } = measurement;
    const { mean, stdDev } = this.stats;
    
    // Z-score based anomaly detection
    const zScore = Math.abs((value - mean) / stdDev);
    
    // Consider values > 3 standard deviations as anomalies
    if (zScore > 3) {
      const anomaly = {
        timestamp: measurement.timestamp,
        value,
        mean,
        stdDev,
        zScore,
        severity: zScore > 4 ? 'critical' : 'warning',
        type: 'statistical_outlier'
      };
      
      this.anomalies.push(anomaly);
      
      // Keep only recent anomalies (last 24 hours)
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      this.anomalies = this.anomalies.filter(a => a.timestamp > cutoff);
      
      return anomaly;
    }
    
    return null;
  }
  
  /**
   * Get recent trend analysis
   */
  getTrend(windowSize = 50) {
    const recent = this.measurements.slice(-windowSize);
    if (recent.length < 10) return 'insufficient_data';
    
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);
    
    const firstMean = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
    
    const percentChange = ((secondMean - firstMean) / firstMean) * 100;
    
    if (Math.abs(percentChange) < 5) return 'stable';
    if (percentChange > 15) return 'degrading';
    if (percentChange > 5) return 'slightly_degrading';
    if (percentChange < -15) return 'improving';
    if (percentChange < -5) return 'slightly_improving';
    
    return 'stable';
  }
  
  /**
   * Get performance summary
   */
  getSummary() {
    const recentMeasurements = this.measurements.slice(-100);
    const recentAnomalies = this.anomalies.filter(a => 
      a.timestamp > Date.now() - (60 * 60 * 1000) // Last hour
    );
    
    return {
      name: this.name,
      category: this.category,
      stats: { ...this.stats },
      currentLevel: recentMeasurements.length > 0 
        ? recentMeasurements[recentMeasurements.length - 1].level 
        : 'unknown',
      trend: this.getTrend(),
      recentAnomalies: recentAnomalies.length,
      thresholds: { ...this.thresholds },
      measurementCount: this.measurements.length,
      lastMeasurement: recentMeasurements.length > 0 
        ? recentMeasurements[recentMeasurements.length - 1]
        : null
    };
  }
}

/**
 * Main performance monitoring orchestrator
 */
class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    
    this.metrics = new Map();
    this.performanceObserver = null;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    // Alert configuration
    this.alertRules = new Map();
    this.alertHistory = [];
    
    // Performance baselines
    this.baselines = new Map();
    
    this.initializeDefaultMetrics();
    this.setupPerformanceObserver();
  }
  
  /**
   * Initialize default performance metrics
   */
  initializeDefaultMetrics() {
    // HTTP Response Time
    this.registerMetric('http_response_time', PerformanceCategory.RESPONSE_TIME, {
      excellent: 50,   // < 50ms
      good: 100,       // < 100ms
      acceptable: 200, // < 200ms
      poor: 500,       // < 500ms
      critical: 1000   // > 1000ms
    });
    
    // Template Generation Time
    this.registerMetric('template_generation_time', PerformanceCategory.TEMPLATE, {
      excellent: 100,   // < 100ms
      good: 250,        // < 250ms
      acceptable: 500,  // < 500ms
      poor: 1000,       // < 1s
      critical: 2000    // > 2s
    });
    
    // RDF Processing Time
    this.registerMetric('rdf_processing_time', PerformanceCategory.RDF, {
      excellent: 10,    // < 10ms per triple
      good: 25,         // < 25ms per triple
      acceptable: 50,   // < 50ms per triple
      poor: 100,        // < 100ms per triple
      critical: 200     // > 200ms per triple
    });
    
    // Memory Usage Percentage
    this.registerMetric('memory_usage_percent', PerformanceCategory.MEMORY, {
      excellent: 50,    // < 50%
      good: 70,         // < 70%
      acceptable: 80,   // < 80%
      poor: 90,         // < 90%
      critical: 95      // > 95%
    });
    
    // CPU Usage Percentage
    this.registerMetric('cpu_usage_percent', PerformanceCategory.CPU, {
      excellent: 30,    // < 30%
      good: 50,         // < 50%
      acceptable: 70,   // < 70%
      poor: 85,         // < 85%
      critical: 95      // > 95%
    });
    
    // Event Loop Lag
    this.registerMetric('event_loop_lag', PerformanceCategory.RESPONSE_TIME, {
      excellent: 1,     // < 1ms
      good: 5,          // < 5ms
      acceptable: 10,   // < 10ms
      poor: 50,         // < 50ms
      critical: 100     // > 100ms
    });
    
    // Database Query Time
    this.registerMetric('db_query_time', PerformanceCategory.DATABASE, {
      excellent: 5,     // < 5ms
      good: 15,         // < 15ms
      acceptable: 50,   // < 50ms
      poor: 100,        // < 100ms
      critical: 250     // > 250ms
    });
    
    logger.info('Initialized performance metrics', {
      count: this.metrics.size,
      categories: [...new Set([...this.metrics.values()].map(m => m.category))]
    });
  }
  
  /**
   * Register a performance metric
   */
  registerMetric(name, category, thresholds = {}) {
    const metric = new PerformanceMetric(name, category, thresholds);
    this.metrics.set(name, metric);
    
    logger.debug(`Registered performance metric: ${name}`, {
      category,
      thresholds
    });
    
    return metric;
  }
  
  /**
   * Setup Node.js Performance Observer
   */
  setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.handlePerformanceEntry(entry);
      }
    });
    
    // Observe various performance entry types
    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'navigation', 'resource', 'mark', 'function'] 
    });
  }
  
  /**
   * Handle performance observer entries
   */
  handlePerformanceEntry(entry) {
    let metricName = null;
    let value = entry.duration;
    let metadata = {
      entryType: entry.entryType,
      name: entry.name
    };
    
    // Map performance entries to metrics
    if (entry.name.includes('http') && entry.entryType === 'measure') {
      metricName = 'http_response_time';
    } else if (entry.name.includes('template') && entry.entryType === 'measure') {
      metricName = 'template_generation_time';
    } else if (entry.name.includes('rdf') && entry.entryType === 'measure') {
      metricName = 'rdf_processing_time';
      // Normalize by operation size if available
      if (entry.detail && entry.detail.operationSize) {
        value = value / entry.detail.operationSize;
        metadata.operationSize = entry.detail.operationSize;
      }
    } else if (entry.name.includes('db') && entry.entryType === 'measure') {
      metricName = 'db_query_time';
    }
    
    if (metricName) {
      this.recordMeasurement(metricName, value, metadata);
    }
  }
  
  /**
   * Record a performance measurement
   */
  recordMeasurement(metricName, value, metadata = {}) {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      logger.warn(`Unknown performance metric: ${metricName}`);
      return;
    }
    
    const measurement = metric.addMeasurement(value, Date.now(), metadata);
    
    // Emit measurement event
    this.emit('measurement', {
      metricName,
      measurement,
      stats: metric.stats
    });
    
    // Check alert rules
    this.checkAlertRules(metricName, measurement);
    
    // Record in metrics collector
    if (metricsCollector) {
      metricsCollector.recordPerformanceMetric(metricName, value, metadata);
    }
    
    return measurement;
  }
  
  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    
    // Start system metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
    
    logger.info('Started performance monitoring', {
      interval: intervalMs,
      metricsCount: this.metrics.size
    });
  }
  
  /**
   * Collect system performance metrics
   */
  async collectSystemMetrics() {
    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      const totalMem = totalmem();
      const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      this.recordMeasurement('memory_usage_percent', memoryPercent, {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        totalSystemMem: totalMem
      });
      
      // CPU metrics (simplified)
      const cpuUsage = await this.getCPUUsage();
      this.recordMeasurement('cpu_usage_percent', cpuUsage);
      
      // Event loop lag
      this.measureEventLoopLag();
      
    } catch (error) {
      logger.error('Failed to collect system metrics', error);
    }
  }
  
  /**
   * Measure event loop lag
   */
  measureEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.recordMeasurement('event_loop_lag', lag);
    });
  }
  
  /**
   * Get CPU usage percentage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime.bigint();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime.bigint();
        
        const elapsedTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const totalCpuTime = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds
        
        const cpuPercent = (totalCpuTime / elapsedTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }
  
  /**
   * Add performance alert rule
   */
  addAlertRule(metricName, condition, severity = 'warning', message = null) {
    const alertId = `${metricName}_${Date.now()}`;
    const rule = {
      id: alertId,
      metricName,
      condition,
      severity,
      message: message || `Performance alert for ${metricName}`,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    };
    
    this.alertRules.set(alertId, rule);
    
    logger.info(`Added performance alert rule: ${metricName}`, {
      alertId,
      severity
    });
    
    return alertId;
  }
  
  /**
   * Check alert rules for measurement
   */
  checkAlertRules(metricName, measurement) {
    for (const [alertId, rule] of this.alertRules.entries()) {
      if (rule.metricName !== metricName || !rule.enabled) continue;
      
      try {
        if (rule.condition(measurement.value, measurement.level, measurement.metadata)) {
          rule.lastTriggered = Date.now();
          rule.triggerCount++;
          
          const alert = {
            id: alertId,
            metricName,
            measurement,
            severity: rule.severity,
            message: rule.message,
            timestamp: Date.now()
          };
          
          this.alertHistory.push(alert);
          
          // Keep only recent alerts (last 1000)
          if (this.alertHistory.length > 1000) {
            this.alertHistory.shift();
          }
          
          this.emit('performance-alert', alert);
          
          logger.warn(`Performance alert triggered: ${rule.message}`, {
            alertId,
            metricName,
            value: measurement.value,
            level: measurement.level
          });
        }
      } catch (error) {
        logger.error(`Error evaluating performance alert rule ${alertId}`, error);
      }
    }
  }
  
  /**
   * Get performance dashboard data
   */
  getPerformanceDashboard() {
    const metrics = {};
    const alerts = [];
    const anomalies = [];
    
    // Collect metric summaries
    for (const [name, metric] of this.metrics.entries()) {
      metrics[name] = metric.getSummary();
    }
    
    // Collect recent alerts (last 24 hours)
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    alerts.push(...this.alertHistory.filter(a => a.timestamp > last24h));
    
    // Collect recent anomalies
    for (const metric of this.metrics.values()) {
      anomalies.push(...metric.anomalies.filter(a => a.timestamp > last24h));
    }
    
    // Overall performance score
    const scores = Object.values(metrics).map(m => {
      switch (m.currentLevel) {
        case PerformanceLevel.EXCELLENT: return 100;
        case PerformanceLevel.GOOD: return 80;
        case PerformanceLevel.ACCEPTABLE: return 60;
        case PerformanceLevel.POOR: return 40;
        case PerformanceLevel.CRITICAL: return 20;
        default: return 50;
      }
    });
    
    const overallScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 50;
    
    return {
      overallScore,
      metrics,
      alerts: alerts.slice(-50), // Last 50 alerts
      anomalies: anomalies.slice(-50), // Last 50 anomalies
      summary: {
        totalMetrics: this.metrics.size,
        activeAlerts: alerts.length,
        criticalMetrics: Object.values(metrics).filter(m => m.currentLevel === PerformanceLevel.CRITICAL).length,
        recentAnomalies: anomalies.length
      },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Export performance data
   */
  exportPerformanceData(format = 'json', timeRange = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeRange;
    const data = {
      exportTime: new Date().toISOString(),
      timeRange: `${timeRange / (60 * 60 * 1000)}h`,
      metrics: {}
    };
    
    for (const [name, metric] of this.metrics.entries()) {
      const recentMeasurements = metric.measurements.filter(m => m.timestamp > cutoff);
      data.metrics[name] = {
        summary: metric.getSummary(),
        measurements: recentMeasurements,
        anomalies: metric.anomalies.filter(a => a.timestamp > cutoff)
      };
    }
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    let csv = 'Metric,Timestamp,Value,Level,Category\n';
    
    for (const [metricName, metricData] of Object.entries(data.metrics)) {
      metricData.measurements.forEach(measurement => {
        csv += `${metricName},${new Date(measurement.timestamp).toISOString()},${measurement.value},${measurement.level},${metricData.summary.category}\n`;
      });
    }
    
    return csv;
  }
  
  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    logger.info('Stopped performance monitoring');
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[Performance] Shutting down performance monitor...');
    
    this.stopMonitoring();
    this.removeAllListeners();
    
    logger.info('[Performance] Shutdown complete');
  }
}

/**
 * Performance measurement decorator
 */
export function MeasurePerformance(metricName, category = PerformanceCategory.RESPONSE_TIME) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const start = performance.now();
      const markName = `${metricName}_${Date.now()}_start`;
      
      performance.mark(markName);
      
      try {
        const result = await method.apply(this, args);
        const duration = performance.now() - start;
        
        performance.measure(metricName, markName);
        
        // Record measurement if performance monitor is available
        if (performanceMonitor) {
          performanceMonitor.recordMeasurement(metricName, duration, {
            method: `${target.constructor.name}.${propertyName}`,
            success: true
          });
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        if (performanceMonitor) {
          performanceMonitor.recordMeasurement(metricName, duration, {
            method: `${target.constructor.name}.${propertyName}`,
            success: false,
            error: error.message
          });
        }
        
        throw error;
      } finally {
        performance.clearMarks(markName);
      }
    };
    
    return descriptor;
  };
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export { PerformanceMonitor, PerformanceMetric };
export default performanceMonitor;
