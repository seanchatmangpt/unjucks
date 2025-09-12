/**
 * Production Monitoring Orchestrator
 * Central coordination of all monitoring, observability, and alerting systems
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { env, isProduction } from '../server/config/environment.js';
import logger from '../lib/observability/logger.js';
import { initializeTelemetry, telemetry } from '../lib/observability/telemetry.js';
import healthCheck from './health-checks.js';
import { metricsCollector } from './metrics-collector.js';
import { sliSloTracker } from './sli-slo-tracker.js';
import { performanceMonitor } from './performance-monitor.js';
import { errorTracker, setupGlobalErrorHandling } from './error-tracker.js';
import { DashboardTemplates, GrafanaDashboardGenerator } from '../config/monitoring/grafana-dashboards.js';

/**
 * Monitoring system status
 */
export const MonitoringStatus = {
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  DEGRADED: 'degraded',
  STOPPED: 'stopped',
  ERROR: 'error'
};

/**
 * Main monitoring orchestrator that coordinates all monitoring systems
 */
class MonitoringOrchestrator extends EventEmitter {
  constructor() {
    super();
    
    this.status = MonitoringStatus.INITIALIZING;
    this.startTime = this.getDeterministicTimestamp();
    this.components = new Map();
    this.httpServer = null;
    
    // Configuration
    this.config = {
      telemetryEnabled: process.env.TELEMETRY_ENABLED !== 'false',
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      healthChecksEnabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
      performanceMonitoringEnabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
      errorTrackingEnabled: process.env.ERROR_TRACKING_ENABLED !== 'false',
      sliSloTrackingEnabled: process.env.SLI_SLO_TRACKING_ENABLED !== 'false',
      httpPort: parseInt(process.env.MONITORING_HTTP_PORT || '9091'),
      enableDashboards: process.env.ENABLE_GRAFANA_DASHBOARDS !== 'false',
      alertingEnabled: process.env.ALERTING_ENABLED !== 'false'
    };
    
    // Component registry
    this.registerComponents();
    
    // Dashboard generator
    this.dashboardGenerator = new GrafanaDashboardGenerator({
      baseUrl: process.env.GRAFANA_URL || 'http://localhost:3000',
      apiKey: process.env.GRAFANA_API_KEY,
      datasourceUid: process.env.PROMETHEUS_DATASOURCE_UID || 'prometheus'
    });
  }
  
  /**
   * Register monitoring components
   */
  registerComponents() {
    this.components.set('telemetry', {
      instance: telemetry,
      enabled: this.config.telemetryEnabled,
      status: 'stopped',
      initialize: () => initializeTelemetry(),
      start: () => Promise.resolve(),
      stop: () => telemetry.shutdown(),
      healthCheck: () => ({ healthy: telemetry.isInitialized, message: 'Telemetry system' })
    });
    
    this.components.set('health-checks', {
      instance: healthCheck,
      enabled: this.config.healthChecksEnabled,
      status: 'stopped',
      initialize: () => Promise.resolve(),
      start: () => {
        healthCheck.startPeriodicChecks();
        return Promise.resolve();
      },
      stop: () => {
        healthCheck.stopPeriodicChecks();
        return healthCheck.shutdown();
      },
      healthCheck: () => ({ healthy: true, message: 'Health checks system' })
    });
    
    this.components.set('metrics', {
      instance: metricsCollector,
      enabled: this.config.metricsEnabled,
      status: 'stopped',
      initialize: () => Promise.resolve(),
      start: () => {
        metricsCollector.startCollection();
        return Promise.resolve();
      },
      stop: () => metricsCollector.shutdown(),
      healthCheck: () => ({ healthy: metricsCollector.isCollecting, message: 'Metrics collection' })
    });
    
    this.components.set('performance-monitor', {
      instance: performanceMonitor,
      enabled: this.config.performanceMonitoringEnabled,
      status: 'stopped',
      initialize: () => Promise.resolve(),
      start: () => {
        performanceMonitor.startMonitoring();
        return Promise.resolve();
      },
      stop: () => performanceMonitor.shutdown(),
      healthCheck: () => ({ healthy: performanceMonitor.isMonitoring, message: 'Performance monitoring' })
    });
    
    this.components.set('error-tracker', {
      instance: errorTracker,
      enabled: this.config.errorTrackingEnabled,
      status: 'stopped',
      initialize: () => {
        setupGlobalErrorHandling(errorTracker);
        return Promise.resolve();
      },
      start: () => Promise.resolve(),
      stop: () => errorTracker.shutdown(),
      healthCheck: () => ({ healthy: true, message: 'Error tracking system' })
    });
    
    this.components.set('sli-slo-tracker', {
      instance: sliSloTracker,
      enabled: this.config.sliSloTrackingEnabled,
      status: 'stopped',
      initialize: () => Promise.resolve(),
      start: () => {
        sliSloTracker.start();
        return Promise.resolve();
      },
      stop: () => sliSloTracker.shutdown(),
      healthCheck: () => ({ healthy: sliSloTracker.isRunning, message: 'SLI/SLO tracking' })
    });
  }
  
  /**
   * Initialize all monitoring systems
   */
  async initialize() {
    this.status = MonitoringStatus.INITIALIZING;
    
    logger.info('🔍 Initializing production monitoring systems...');
    
    const results = [];
    
    for (const [name, component] of this.components.entries()) {
      if (!component.enabled) {
        logger.debug(`Skipping disabled component: ${name}`);
        component.status = 'disabled';
        continue;
      }
      
      try {
        logger.debug(`Initializing component: ${name}`);
        await component.initialize();
        component.status = 'initialized';
        results.push({ name, status: 'success' });
        
      } catch (error) {
        component.status = 'error';
        results.push({ name, status: 'error', error: error.message });
        logger.error(`Failed to initialize ${name}`, error);
      }
    }
    
    // Set up component event listeners
    this.setupComponentEventListeners();
    
    logger.info('✅ Monitoring systems initialized', {
      results,
      successCount: results.filter(r => r.status === 'success').length,
      errorCount: results.filter(r => r.status === 'error').length
    });
    
    return results;
  }
  
  /**
   * Start all monitoring systems
   */
  async start() {
    logger.info('🚀 Starting production monitoring systems...');
    
    const results = [];
    
    for (const [name, component] of this.components.entries()) {
      if (!component.enabled || component.status !== 'initialized') {
        continue;
      }
      
      try {
        logger.debug(`Starting component: ${name}`);
        await component.start();
        component.status = 'running';
        results.push({ name, status: 'success' });
        
      } catch (error) {
        component.status = 'error';
        results.push({ name, status: 'error', error: error.message });
        logger.error(`Failed to start ${name}`, error);
      }
    }
    
    // Start HTTP monitoring endpoints
    if (this.config.metricsEnabled || this.config.healthChecksEnabled) {
      await this.startHttpServer();
    }
    
    // Generate and export dashboards if enabled
    if (this.config.enableDashboards) {
      this.generateDashboards();
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    if (errorCount === 0) {
      this.status = MonitoringStatus.RUNNING;
      logger.info('✅ All monitoring systems started successfully', {
        components: successCount,
        httpPort: this.config.httpPort
      });
    } else if (successCount > 0) {
      this.status = MonitoringStatus.DEGRADED;
      logger.warn('⚠️ Monitoring systems started with some failures', {
        success: successCount,
        errors: errorCount
      });
    } else {
      this.status = MonitoringStatus.ERROR;
      logger.error('❌ Failed to start monitoring systems', {
        errors: errorCount
      });
    }
    
    this.emit('monitoring-started', {
      status: this.status,
      results,
      uptime: this.getDeterministicTimestamp() - this.startTime
    });
    
    return results;
  }
  
  /**
   * Setup event listeners for component coordination
   */
  setupComponentEventListeners() {
    // Health check alerts
    healthCheck.on('health-critical', (status) => {
      this.handleCriticalHealthEvent(status);
    });
    
    // Performance alerts
    performanceMonitor.on('performance-alert', (alert) => {
      this.handlePerformanceAlert(alert);
    });
    
    // Error tracking alerts
    errorTracker.on('alert-triggered', (alert) => {
      this.handleErrorAlert(alert);
    });
    
    // SLO violations
    sliSloTracker.on('slo-violated', (compliance) => {
      this.handleSLOViolation(compliance);
    });
    
    // Metrics alerts
    metricsCollector.on('metric-alert', (alert) => {
      this.handleMetricAlert(alert);
    });
  }
  
  /**
   * Handle critical health events
   */
  handleCriticalHealthEvent(status) {
    logger.error('Critical health event detected', status);
    
    this.emit('critical-alert', {
      type: 'health',
      severity: 'critical',
      message: `Critical health check failure: ${status.message}`,
      details: status,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
  
  /**
   * Handle performance alerts
   */
  handlePerformanceAlert(alert) {
    logger.warn('Performance alert triggered', alert);
    
    this.emit('performance-alert', {
      type: 'performance',
      severity: alert.severity,
      message: alert.message,
      metric: alert.metricName,
      value: alert.measurement.value,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
  
  /**
   * Handle error alerts
   */
  handleErrorAlert(alert) {
    logger.error('Error alert triggered', alert);
    
    this.emit('error-alert', {
      type: 'error',
      severity: alert.severity,
      message: alert.message,
      errorId: alert.errorId,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
  
  /**
   * Handle SLO violations
   */
  handleSLOViolation(compliance) {
    logger.error('SLO violation detected', compliance);
    
    this.emit('slo-violation', {
      type: 'slo',
      severity: 'high',
      message: `SLO violation: ${compliance.sloName} (${compliance.actual}% vs ${compliance.target}% target)`,
      sloName: compliance.sloName,
      actual: compliance.actual,
      target: compliance.target,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
  
  /**
   * Handle metric alerts
   */
  handleMetricAlert(alert) {
    logger.warn('Metric alert triggered', alert);
    
    this.emit('metric-alert', {
      type: 'metric',
      severity: alert.severity,
      message: alert.message,
      metric: alert.metricName,
      value: alert.value,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }
  
  /**
   * Start HTTP server for monitoring endpoints
   */
  async startHttpServer() {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });
      
      this.httpServer.on('error', (error) => {
        logger.error('Monitoring HTTP server error', error);
        reject(error);
      });
      
      this.httpServer.listen(this.config.httpPort, () => {
        logger.info(`Monitoring HTTP server listening on port ${this.config.httpPort}`);
        resolve();
      });
    });
  }
  
  /**
   * Handle HTTP requests for monitoring endpoints
   */
  async handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }
    
    try {
      let response;
      
      switch (pathname) {
        case '/health':
        case '/health/live':
          response = await healthCheck.getProbeResponse('liveness');
          break;
          
        case '/health/ready':
          response = await healthCheck.getProbeResponse('readiness');
          break;
          
        case '/health/startup':
          response = await healthCheck.getProbeResponse('startup');
          break;
          
        case '/metrics':
          res.setHeader('Content-Type', 'text/plain');
          response = { body: await metricsCollector.getPrometheusMetrics() };
          break;
          
        case '/status':
          response = {
            status: 200,
            body: this.getOverallStatus()
          };
          break;
          
        case '/dashboard':
          response = {
            status: 200,
            body: await this.getMonitoringDashboard()
          };
          break;
          
        case '/dashboard/performance':
          response = {
            status: 200,
            body: performanceMonitor.getPerformanceDashboard()
          };
          break;
          
        case '/dashboard/errors':
          response = {
            status: 200,
            body: errorTracker.getErrorDashboard()
          };
          break;
          
        case '/dashboard/sli-slo':
          response = {
            status: 200,
            body: sliSloTracker.getDashboardData()
          };
          break;
          
        case '/export/grafana-dashboards':
          response = {
            status: 200,
            body: this.dashboardGenerator.exportAllTemplates()
          };
          break;
          
        default:
          response = {
            status: 404,
            body: { error: 'Not Found', available_endpoints: [
              '/health', '/health/live', '/health/ready', '/health/startup',
              '/metrics', '/status', '/dashboard', '/dashboard/performance',
              '/dashboard/errors', '/dashboard/sli-slo', '/export/grafana-dashboards'
            ]}
          };
      }
      
      res.statusCode = response.status;
      
      if (typeof response.body === 'string') {
        res.end(response.body);
      } else {
        res.end(JSON.stringify(response.body, null, 2));
      }
      
    } catch (error) {
      logger.error('Error handling monitoring HTTP request', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
  
  /**
   * Get overall monitoring status
   */
  getOverallStatus() {
    const componentStatuses = {};
    let healthyComponents = 0;
    let totalComponents = 0;
    
    for (const [name, component] of this.components.entries()) {
      if (!component.enabled) continue;
      
      totalComponents++;
      
      try {
        const health = component.healthCheck();
        componentStatuses[name] = {
          status: component.status,
          healthy: health.healthy,
          message: health.message
        };
        
        if (health.healthy) healthyComponents++;
      } catch (error) {
        componentStatuses[name] = {
          status: 'error',
          healthy: false,
          message: error.message
        };
      }
    }
    
    const overallHealthy = healthyComponents === totalComponents;
    
    return {
      status: this.status,
      healthy: overallHealthy,
      uptime: this.getDeterministicTimestamp() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
      components: componentStatuses,
      summary: {
        total: totalComponents,
        healthy: healthyComponents,
        unhealthy: totalComponents - healthyComponents,
        healthRatio: totalComponents > 0 ? (healthyComponents / totalComponents) * 100 : 100
      },
      timestamp: this.getDeterministicDate().toISOString()
    };
  }
  
  /**
   * Get comprehensive monitoring dashboard
   */
  async getMonitoringDashboard() {
    const dashboard = {
      overview: this.getOverallStatus(),
      health: healthCheck.getGlobalStatus(),
      performance: performanceMonitor.getPerformanceDashboard(),
      errors: errorTracker.getErrorDashboard(24 * 60 * 60 * 1000), // Last 24 hours
      sliSlo: sliSloTracker.getDashboardData(),
      metrics: metricsCollector.getMetricsSummary()
    };
    
    return dashboard;
  }
  
  /**
   * Generate Grafana dashboards
   */
  generateDashboards() {
    try {
      const dashboards = this.dashboardGenerator.exportAllTemplates();
      
      logger.info('Generated Grafana dashboards', {
        count: Object.keys(dashboards).length,
        dashboards: Object.keys(dashboards)
      });
      
      // In production, you might want to automatically deploy these to Grafana
      // For now, they're available via the HTTP endpoint
      
    } catch (error) {
      logger.error('Failed to generate Grafana dashboards', error);
    }
  }
  
  /**
   * Store monitoring configuration in memory
   */
  storeMonitoringConfig() {
    const config = {
      timestamp: this.getDeterministicDate().toISOString(),
      status: this.status,
      components: Object.fromEntries(
        Array.from(this.components.entries()).map(([name, component]) => [
          name,
          {
            enabled: component.enabled,
            status: component.status
          }
        ])
      ),
      configuration: this.config,
      dashboards: {
        grafana: Object.keys(DashboardTemplates),
        endpoints: [
          '/health', '/metrics', '/status', '/dashboard',
          '/dashboard/performance', '/dashboard/errors', '/dashboard/sli-slo'
        ]
      },
      alerting: {
        enabled: this.config.alertingEnabled,
        rules: {
          health: Array.from(healthCheck.alertRules?.keys() || []),
          performance: Array.from(performanceMonitor.alertRules?.keys() || []),
          errors: Array.from(errorTracker.alertRules?.keys() || []),
          metrics: Array.from(metricsCollector.alertRules?.keys() || [])
        }
      },
      integrations: {
        telemetry: this.config.telemetryEnabled,
        prometheus: this.config.metricsEnabled,
        grafana: this.config.enableDashboards
      }
    };
    
    // Store in memory with the requested key
    if (global.memoryStore) {
      global.memoryStore.set('hive/monitoring', config);
    } else {
      // Create simple in-memory store if not available
      global.monitoringConfig = config;
    }
    
    logger.info('Stored monitoring configuration in memory', {
      key: 'hive/monitoring',
      components: Object.keys(config.components).length
    });
    
    return config;
  }
  
  /**
   * Stop all monitoring systems
   */
  async stop() {
    logger.info('🛑 Stopping monitoring systems...');
    
    const results = [];
    
    // Stop HTTP server
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
      logger.info('Stopped monitoring HTTP server');
    }
    
    // Stop components in reverse order
    const componentEntries = Array.from(this.components.entries()).reverse();
    
    for (const [name, component] of componentEntries) {
      if (component.status !== 'running') continue;
      
      try {
        logger.debug(`Stopping component: ${name}`);
        await component.stop();
        component.status = 'stopped';
        results.push({ name, status: 'success' });
        
      } catch (error) {
        component.status = 'error';
        results.push({ name, status: 'error', error: error.message });
        logger.error(`Failed to stop ${name}`, error);
      }
    }
    
    this.status = MonitoringStatus.STOPPED;
    this.removeAllListeners();
    
    logger.info('✅ Monitoring systems stopped', {
      results,
      uptime: this.getDeterministicTimestamp() - this.startTime
    });
    
    return results;
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[Monitoring] Shutting down monitoring orchestrator...');
    
    try {
      await this.stop();
      logger.info('[Monitoring] Shutdown complete');
    } catch (error) {
      logger.error('[Monitoring] Error during shutdown', error);
    }
  }
}

// Create singleton instance
const monitoring = new MonitoringOrchestrator();

/**
 * Initialize and start all monitoring systems
 */
export async function initializeMonitoring() {
  try {
    await monitoring.initialize();
    await monitoring.start();
    
    // Store configuration in memory
    monitoring.storeMonitoringConfig();
    
    return monitoring;
  } catch (error) {
    logger.error('Failed to initialize monitoring systems', error);
    throw error;
  }
}

/**
 * Get monitoring instance for external use
 */
export function getMonitoring() {
  return monitoring;
}

/**
 * Express middleware for automatic monitoring instrumentation
 */
export function createMonitoringMiddleware() {
  return (req, res, next) => {
    const startTime = this.getDeterministicTimestamp();
    const correlationId = req.headers['x-correlation-id'] || req.correlationId;
    
    // Set correlation context for logging
    if (correlationId && logger.setCorrelationContext) {
      logger.setCorrelationContext(correlationId);
    }
    
    // Track request in telemetry
    let spanInfo = null;
    if (telemetry && telemetry.startSpan) {
      spanInfo = telemetry.startSpan(`${req.method} ${req.path}`, {
        correlationId,
        attributes: {
          'http.method': req.method,
          'http.path': req.path,
          'http.user_agent': req.headers['user-agent'] || 'unknown'
        }
      });
    }
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = this.getDeterministicTimestamp() - startTime;
      
      // Record HTTP metrics
      if (metricsCollector) {
        metricsCollector.recordHTTPRequest(
          req.method,
          req.path,
          res.statusCode,
          duration,
          req.user?.id
        );
      }
      
      // Record performance metrics
      if (performanceMonitor) {
        performanceMonitor.recordMeasurement('http_response_time', duration, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode
        });
      }
      
      // End telemetry span
      if (spanInfo && telemetry.endSpan) {
        telemetry.endSpan(spanInfo.correlationId, null, {
          'http.status_code': res.statusCode,
          'http.response_time': duration
        });
      }
      
      // Clear correlation context
      if (correlationId && logger.clearCorrelationContext) {
        logger.clearCorrelationContext();
      }
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

export {
  MonitoringOrchestrator,
  healthCheck,
  metricsCollector,
  sliSloTracker,
  performanceMonitor,
  errorTracker,
  telemetry,
  logger
};
export default monitoring;
