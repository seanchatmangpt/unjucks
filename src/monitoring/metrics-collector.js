/**
 * Production Metrics Collector
 * Custom business KPI metrics with Prometheus format and real-time monitoring
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { register, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';
import { env } from '../server/config/environment.js';
import logger from '../lib/observability/logger.js';
import { telemetry } from '../lib/observability/telemetry.js';

/**
 * Metric types for different measurement scenarios
 */
export const MetricType = {
  COUNTER: 'counter',      // Monotonically increasing value
  GAUGE: 'gauge',         // Current value that can go up/down
  HISTOGRAM: 'histogram', // Distribution of values with buckets
  SUMMARY: 'summary'      // Quantiles and total/count
};

/**
 * Business metric categories for organization
 */
export const MetricCategory = {
  BUSINESS: 'business',           // Business KPIs
  PERFORMANCE: 'performance',     // Performance metrics
  SYSTEM: 'system',              // System resource metrics
  SECURITY: 'security',          // Security-related metrics
  USER: 'user',                  // User interaction metrics
  ERROR: 'error',                // Error and exception metrics
  TEMPLATE: 'template',          // Template generation metrics
  RDF: 'rdf'                     // RDF processing metrics
};

/**
 * Custom metric definition
 */
class CustomMetric {
  constructor(name, type, help, labels = [], buckets = null, quantiles = null) {
    this.name = name;
    this.type = type;
    this.help = help;
    this.labels = labels;
    this.buckets = buckets;
    this.quantiles = quantiles;
    this.metric = null;
    this.lastUpdate = null;
    this.totalUpdates = 0;
    
    this.initializeMetric();
  }
  
  /**
   * Initialize Prometheus metric instance
   */
  initializeMetric() {
    const config = {
      name: this.name,
      help: this.help,
      labelNames: this.labels,
      registers: [register]
    };
    
    switch (this.type) {
      case MetricType.COUNTER:
        this.metric = new Counter(config);
        break;
      case MetricType.GAUGE:
        this.metric = new Gauge(config);
        break;
      case MetricType.HISTOGRAM:
        if (this.buckets) {
          config.buckets = this.buckets;
        }
        this.metric = new Histogram(config);
        break;
      case MetricType.SUMMARY:
        if (this.quantiles) {
          config.quantiles = this.quantiles;
        }
        this.metric = new Summary(config);
        break;
      default:
        throw new Error(`Unknown metric type: ${this.type}`);
    }
  }
  
  /**
   * Update metric value with labels
   */
  update(value, labels = {}) {
    if (!this.metric) return;
    
    this.lastUpdate = Date.now();
    this.totalUpdates++;
    
    try {
      switch (this.type) {
        case MetricType.COUNTER:
          this.metric.inc(labels, value || 1);
          break;
        case MetricType.GAUGE:
          this.metric.set(labels, value);
          break;
        case MetricType.HISTOGRAM:
        case MetricType.SUMMARY:
          this.metric.observe(labels, value);
          break;
      }
    } catch (error) {
      logger.error(`Failed to update metric ${this.name}`, error);
    }
  }
  
  /**
   * Get current metric value (for gauges)
   */
  getValue(labels = {}) {
    if (this.type !== MetricType.GAUGE) {
      throw new Error('getValue() only available for gauge metrics');
    }
    
    try {
      return this.metric.get().values.find(v => 
        JSON.stringify(v.labels) === JSON.stringify(labels)
      )?.value || 0;
    } catch (error) {
      logger.error(`Failed to get value for metric ${this.name}`, error);
      return 0;
    }
  }
  
  /**
   * Reset metric (for counters and histograms)
   */
  reset() {
    if (this.metric && typeof this.metric.reset === 'function') {
      this.metric.reset();
    }
  }
  
  /**
   * Get metric statistics
   */
  getStats() {
    return {
      name: this.name,
      type: this.type,
      help: this.help,
      labels: this.labels,
      lastUpdate: this.lastUpdate,
      totalUpdates: this.totalUpdates
    };
  }
}

/**
 * Production metrics collector and orchestrator
 */
class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    
    this.metrics = new Map();
    this.isCollecting = false;
    this.collectionInterval = null;
    this.performanceObserver = null;
    
    // Configuration
    this.config = {
      serviceName: env.SERVICE_NAME || 'unjucks-enterprise',
      serviceVersion: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
      instanceId: process.env.HOSTNAME || 'localhost',
      collectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '15000'),
      enableDefaultMetrics: process.env.ENABLE_DEFAULT_METRICS !== 'false',
      prometheusPrefix: process.env.PROMETHEUS_PREFIX || 'unjucks_'
    };
    
    // Performance tracking
    this.performanceMetrics = new Map();
    this.alertRules = new Map();
    
    this.initializeDefaultMetrics();
    this.setupPerformanceObserver();
    
    if (this.config.enableDefaultMetrics) {
      collectDefaultMetrics({
        register,
        prefix: this.config.prometheusPrefix,
        eventLoopMonitoringPrecision: 10
      });
    }
  }
  
  /**
   * Initialize default business and system metrics
   */
  initializeDefaultMetrics() {
    // Business KPI Metrics
    this.registerMetric('templates_generated_total', MetricType.COUNTER, 
      'Total number of templates generated', 
      ['template_type', 'success', 'user_id'], 
      MetricCategory.BUSINESS);
    
    this.registerMetric('template_generation_duration_seconds', MetricType.HISTOGRAM, 
      'Time spent generating templates', 
      ['template_type', 'complexity'], 
      MetricCategory.PERFORMANCE, 
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]);
    
    this.registerMetric('rdf_triples_processed_total', MetricType.COUNTER, 
      'Total RDF triples processed', 
      ['operation', 'format', 'success'], 
      MetricCategory.RDF);
    
    this.registerMetric('rdf_parsing_duration_seconds', MetricType.HISTOGRAM, 
      'RDF parsing duration', 
      ['format', 'size_category'], 
      MetricCategory.PERFORMANCE, 
      [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]);
    
    // HTTP Request Metrics
    this.registerMetric('http_requests_total', MetricType.COUNTER, 
      'Total HTTP requests', 
      ['method', 'path', 'status_code'], 
      MetricCategory.BUSINESS);
    
    this.registerMetric('http_request_duration_seconds', MetricType.HISTOGRAM, 
      'HTTP request duration', 
      ['method', 'path', 'status_class'], 
      MetricCategory.PERFORMANCE, 
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]);
    
    // Error Metrics
    this.registerMetric('errors_total', MetricType.COUNTER, 
      'Total application errors', 
      ['error_type', 'severity', 'component'], 
      MetricCategory.ERROR);
    
    this.registerMetric('template_generation_errors_total', MetricType.COUNTER, 
      'Template generation errors', 
      ['error_type', 'template_type'], 
      MetricCategory.ERROR);
    
    // User Interaction Metrics
    this.registerMetric('active_users_current', MetricType.GAUGE, 
      'Currently active users', 
      ['session_type'], 
      MetricCategory.USER);
    
    this.registerMetric('user_sessions_total', MetricType.COUNTER, 
      'Total user sessions', 
      ['auth_type', 'outcome'], 
      MetricCategory.USER);
    
    // Security Metrics
    this.registerMetric('security_events_total', MetricType.COUNTER, 
      'Security events', 
      ['event_type', 'severity', 'source'], 
      MetricCategory.SECURITY);
    
    this.registerMetric('authentication_attempts_total', MetricType.COUNTER, 
      'Authentication attempts', 
      ['method', 'outcome', 'user_type'], 
      MetricCategory.SECURITY);
    
    // System Performance Metrics
    this.registerMetric('memory_usage_bytes', MetricType.GAUGE, 
      'Memory usage in bytes', 
      ['type'], 
      MetricCategory.SYSTEM);
    
    this.registerMetric('event_loop_lag_seconds', MetricType.HISTOGRAM, 
      'Event loop lag', 
      [], 
      MetricCategory.SYSTEM, 
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]);
    
    this.registerMetric('database_operations_total', MetricType.COUNTER, 
      'Database operations', 
      ['operation', 'table', 'success'], 
      MetricCategory.SYSTEM);
    
    this.registerMetric('database_operation_duration_seconds', MetricType.HISTOGRAM, 
      'Database operation duration', 
      ['operation', 'table'], 
      MetricCategory.PERFORMANCE, 
      [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]);
    
    // Cache Metrics
    this.registerMetric('cache_operations_total', MetricType.COUNTER, 
      'Cache operations', 
      ['operation', 'cache_name', 'result'], 
      MetricCategory.SYSTEM);
    
    this.registerMetric('cache_hit_ratio', MetricType.GAUGE, 
      'Cache hit ratio', 
      ['cache_name'], 
      MetricCategory.PERFORMANCE);
    
    logger.info('Initialized default metrics collection', {
      totalMetrics: this.metrics.size,
      categories: Object.values(MetricCategory)
    });
  }
  
  /**
   * Setup performance observer for automatic metric collection
   */
  setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Collect Node.js performance timing metrics
        if (entry.entryType === 'measure') {
          this.recordPerformanceMetric(entry.name, entry.duration, {
            entryType: entry.entryType
          });
        }
        
        // Collect HTTP request timings
        if (entry.entryType === 'navigation') {
          this.recordHttpTiming(entry);
        }
        
        // Collect resource loading times
        if (entry.entryType === 'resource') {
          this.recordResourceTiming(entry);
        }
      }
    });
    
    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'navigation', 'resource', 'mark'] 
    });
  }
  
  /**
   * Register a new custom metric
   */
  registerMetric(name, type, help, labels = [], category = MetricCategory.BUSINESS, buckets = null, quantiles = null) {
    const metricName = `${this.config.prometheusPrefix}${name}`;
    
    if (this.metrics.has(name)) {
      logger.warn(`Metric ${name} already registered`);
      return this.metrics.get(name);
    }
    
    const metric = new CustomMetric(metricName, type, help, labels, buckets, quantiles);
    metric.category = category;
    
    this.metrics.set(name, metric);
    
    logger.debug(`Registered metric: ${name}`, {
      type,
      category,
      labels: labels.length
    });
    
    return metric;
  }
  
  /**
   * Record a metric value
   */
  record(metricName, value, labels = {}) {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      logger.warn(`Unknown metric: ${metricName}`);
      return false;
    }
    
    metric.update(value, labels);
    
    // Record in telemetry if available
    if (telemetry && telemetry.recordMetric) {
      telemetry.recordMetric(metricName, value, labels);
    }
    
    // Check alert rules
    this.checkAlertRules(metricName, value, labels);
    
    return true;
  }
  
  /**
   * Record performance metric
   */
  recordPerformanceMetric(operation, duration, metadata = {}) {
    // Store for trend analysis
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation);
    metrics.push({
      timestamp: Date.now(),
      duration,
      metadata
    });
    
    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift();
    }
    
    // Record in Prometheus histogram if available
    const histogramName = operation.includes('_duration') ? operation : `${operation}_duration_seconds`;
    if (this.metrics.has(histogramName)) {
      this.record(histogramName, duration / 1000, metadata);
    }
  }
  
  /**
   * Record HTTP timing metrics
   */
  recordHttpTiming(entry) {
    const labels = {
      method: entry.method || 'GET',
      path: this.sanitizePath(entry.name),
      status_class: this.getStatusClass(entry.responseStatus)
    };
    
    this.record('http_request_duration_seconds', entry.duration / 1000, labels);
  }
  
  /**
   * Record resource timing metrics
   */
  recordResourceTiming(entry) {
    if (entry.duration > 0) {
      this.recordPerformanceMetric('resource_load_duration', entry.duration, {
        resource: entry.name,
        type: entry.initiatorType
      });
    }
  }
  
  /**
   * Business KPI recording methods
   */
  recordTemplateGeneration(templateType, success, duration, userId = null, complexity = 'medium') {
    // Record generation count
    this.record('templates_generated_total', 1, {
      template_type: templateType,
      success: success.toString(),
      user_id: userId || 'anonymous'
    });
    
    // Record generation duration
    if (duration) {
      this.record('template_generation_duration_seconds', duration / 1000, {
        template_type: templateType,
        complexity
      });
    }
    
    this.emit('template-generated', {
      templateType,
      success,
      duration,
      userId,
      complexity
    });
  }
  
  recordRDFOperation(operation, format, tripleCount, duration, success = true) {
    // Record RDF processing
    this.record('rdf_triples_processed_total', tripleCount, {
      operation,
      format,
      success: success.toString()
    });
    
    // Record parsing duration
    if (duration) {
      const sizeCategory = this.getRDFSizeCategory(tripleCount);
      this.record('rdf_parsing_duration_seconds', duration / 1000, {
        format,
        size_category: sizeCategory
      });
    }
    
    this.emit('rdf-operation', {
      operation,
      format,
      tripleCount,
      duration,
      success
    });
  }
  
  recordHTTPRequest(method, path, statusCode, duration, userId = null) {
    const labels = {
      method: method.toUpperCase(),
      path: this.sanitizePath(path),
      status_code: statusCode.toString()
    };
    
    // Record request count
    this.record('http_requests_total', 1, labels);
    
    // Record request duration
    this.record('http_request_duration_seconds', duration / 1000, {
      method: method.toUpperCase(),
      path: this.sanitizePath(path),
      status_class: this.getStatusClass(statusCode)
    });
    
    // Record error if applicable
    if (statusCode >= 400) {
      this.recordError('http_error', 'warning', 'http', {
        method,
        path,
        statusCode
      });
    }
  }
  
  recordError(errorType, severity, component, metadata = {}) {
    this.record('errors_total', 1, {
      error_type: errorType,
      severity,
      component
    });
    
    this.emit('error-recorded', {
      errorType,
      severity,
      component,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
  
  recordSecurityEvent(eventType, severity, source, metadata = {}) {
    this.record('security_events_total', 1, {
      event_type: eventType,
      severity,
      source
    });
    
    this.emit('security-event', {
      eventType,
      severity,
      source,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
  
  recordUserActivity(sessionType, authType, outcome) {
    // Record user session
    this.record('user_sessions_total', 1, {
      auth_type: authType,
      outcome
    });
    
    // Update active users gauge
    if (outcome === 'success') {
      const currentActive = this.getMetricValue('active_users_current', { session_type: sessionType }) || 0;
      this.record('active_users_current', currentActive + 1, { session_type: sessionType });
    }
  }
  
  recordDatabaseOperation(operation, table, success, duration) {
    this.record('database_operations_total', 1, {
      operation,
      table,
      success: success.toString()
    });
    
    if (duration) {
      this.record('database_operation_duration_seconds', duration / 1000, {
        operation,
        table
      });
    }
  }
  
  recordCacheOperation(operation, cacheName, result, duration = null) {
    this.record('cache_operations_total', 1, {
      operation,
      cache_name: cacheName,
      result
    });
    
    // Update hit ratio for cache hits/misses
    if (operation === 'get') {
      this.updateCacheHitRatio(cacheName, result === 'hit');
    }
  }
  
  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio(cacheName, isHit) {
    const key = `cache_hit_ratio_${cacheName}`;
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, { hits: 0, total: 0 });
    }
    
    const stats = this.performanceMetrics.get(key);
    stats.total++;
    if (isHit) stats.hits++;
    
    const ratio = stats.total > 0 ? (stats.hits / stats.total) : 0;
    this.record('cache_hit_ratio', ratio, { cache_name: cacheName });
  }
  
  /**
   * Get current metric value
   */
  getMetricValue(metricName, labels = {}) {
    const metric = this.metrics.get(metricName);
    if (!metric) return null;
    
    try {
      if (metric.type === MetricType.GAUGE) {
        return metric.getValue(labels);
      }
    } catch (error) {
      logger.error(`Failed to get metric value for ${metricName}`, error);
    }
    
    return null;
  }
  
  /**
   * Add alert rule for metric monitoring
   */
  addAlertRule(metricName, condition, severity = 'warning', message = null) {
    const alertId = `${metricName}_${Date.now()}`;
    const rule = {
      id: alertId,
      metricName,
      condition,
      severity,
      message: message || `Alert triggered for ${metricName}`,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    };
    
    this.alertRules.set(alertId, rule);
    
    logger.info(`Added alert rule for metric ${metricName}`, {
      alertId,
      severity
    });
    
    return alertId;
  }
  
  /**
   * Check alert rules for metric value
   */
  checkAlertRules(metricName, value, labels = {}) {
    for (const [alertId, rule] of this.alertRules.entries()) {
      if (rule.metricName !== metricName || !rule.enabled) continue;
      
      try {
        if (rule.condition(value, labels)) {
          rule.lastTriggered = Date.now();
          rule.triggerCount++;
          
          this.emit('metric-alert', {
            alertId,
            metricName,
            value,
            labels,
            severity: rule.severity,
            message: rule.message,
            timestamp: new Date().toISOString()
          });
          
          logger.warn(`Metric alert triggered: ${rule.message}`, {
            alertId,
            metricName,
            value,
            labels
          });
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule ${alertId}`, error);
      }
    }
  }
  
  /**
   * Utility methods
   */
  sanitizePath(path) {
    // Remove query parameters and sanitize for metrics
    return path.split('?')[0].replace(/\/\d+/g, '/:id');
  }
  
  getStatusClass(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'unknown';
  }
  
  getRDFSizeCategory(tripleCount) {
    if (tripleCount < 100) return 'small';
    if (tripleCount < 1000) return 'medium';
    if (tripleCount < 10000) return 'large';
    return 'xlarge';
  }
  
  /**
   * Get all metrics in Prometheus format
   */
  async getPrometheusMetrics() {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Failed to get Prometheus metrics', error);
      return '';
    }
  }
  
  /**
   * Get metrics summary for dashboards
   */
  getMetricsSummary() {
    const summary = {
      totalMetrics: this.metrics.size,
      categories: {},
      recentAlerts: [],
      performanceMetrics: {}
    };
    
    // Group by category
    for (const [name, metric] of this.metrics.entries()) {
      const category = metric.category || MetricCategory.BUSINESS;
      if (!summary.categories[category]) {
        summary.categories[category] = [];
      }
      summary.categories[category].push(metric.getStats());
    }
    
    // Get recent alerts (last 24 hours)
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    for (const rule of this.alertRules.values()) {
      if (rule.lastTriggered && rule.lastTriggered > last24h) {
        summary.recentAlerts.push({
          metricName: rule.metricName,
          severity: rule.severity,
          lastTriggered: rule.lastTriggered,
          triggerCount: rule.triggerCount
        });
      }
    }
    
    // Performance metrics summary
    for (const [operation, metrics] of this.performanceMetrics.entries()) {
      if (Array.isArray(metrics) && metrics.length > 0) {
        const durations = metrics.map(m => m.duration);
        summary.performanceMetrics[operation] = {
          count: metrics.length,
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          p95: this.calculatePercentile(durations, 0.95),
          p99: this.calculatePercentile(durations, 0.99)
        };
      }
    }
    
    return summary;
  }
  
  /**
   * Calculate percentile from array of values
   */
  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
  
  /**
   * Start periodic metric collection
   */
  startCollection() {
    if (this.isCollecting) {
      logger.warn('Metrics collection already started');
      return;
    }
    
    this.isCollecting = true;
    
    // Collect system metrics periodically
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collectionInterval);
    
    logger.info('Started metrics collection', {
      interval: this.config.collectionInterval
    });
  }
  
  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      this.record('memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
      this.record('memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
      this.record('memory_usage_bytes', memUsage.external, { type: 'external' });
      this.record('memory_usage_bytes', memUsage.rss, { type: 'rss' });
      
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
      this.record('event_loop_lag_seconds', lag / 1000); // Convert to seconds
    });
  }
  
  /**
   * Stop metric collection
   */
  stopCollection() {
    if (!this.isCollecting) return;
    
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    logger.info('Stopped metrics collection');
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    register.clear();
    this.metrics.clear();
    this.performanceMetrics.clear();
    this.alertRules.clear();
    
    this.initializeDefaultMetrics();
    
    logger.info('Reset all metrics');
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[Metrics] Shutting down metrics collector...');
    
    this.stopCollection();
    this.removeAllListeners();
    
    logger.info('[Metrics] Shutdown complete');
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
export { MetricsCollector, CustomMetric };
export default metricsCollector;
