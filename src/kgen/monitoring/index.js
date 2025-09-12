/**
 * Monitoring System
 * Handles metrics collection, logging, health checks, and performance monitoring
 */

import client from 'prom-client';
import winston from 'winston';
import consola from 'consola';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.status = 'uninitialized';
    
    // Prometheus metrics
    this.metrics = new Map();
    this.histograms = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    
    // Winston logger
    this.logger = null;
    
    // Performance monitoring
    this.performanceTracker = new Map();
    this.alertThresholds = {
      cpu: 80, // percent
      memory: 85, // percent
      responseTime: 5000, // ms
      errorRate: 0.05 // 5%
    };
    
    // Health check registry
    this.healthChecks = new Map();
    
    // System metrics collection
    this.systemMetricsInterval = null;
    this.collectionInterval = 30000; // 30 seconds
  }

  /**
   * Initialize monitoring system
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Setup Prometheus metrics
      this.setupPrometheusMetrics();
      
      // Setup Winston logger
      this.setupLogger();
      
      // Setup system monitoring
      this.setupSystemMonitoring();
      
      // Setup health checks
      this.setupHealthChecks();
      
      this.status = 'ready';
      consola.success('✅ Monitoring System initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Monitoring System initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup Prometheus metrics
   */
  setupPrometheusMetrics() {
    const prefix = this.config.metrics?.prefix || 'kgen_';
    
    // Clear default metrics
    client.register.clear();
    
    // Enable default metrics collection if configured
    if (this.config.metrics?.collectDefaultMetrics) {
      client.collectDefaultMetrics({
        prefix,
        register: client.register
      });
    }
    
    // HTTP request metrics
    this.histograms.set('http_request_duration', new client.Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    }));
    
    this.counters.set('http_requests_total', new client.Counter({
      name: `${prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    }));
    
    // RDF processing metrics
    this.counters.set('rdf_triples_processed', new client.Counter({
      name: `${prefix}rdf_triples_processed_total`,
      help: 'Total number of RDF triples processed'
    }));
    
    this.counters.set('rdf_parse_errors', new client.Counter({
      name: `${prefix}rdf_parse_errors_total`,
      help: 'Total number of RDF parsing errors'
    }));
    
    this.histograms.set('rdf_processing_duration', new client.Histogram({
      name: `${prefix}rdf_processing_duration_seconds`,
      help: 'Duration of RDF processing operations',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }));
    
    // SPARQL query metrics
    this.counters.set('sparql_queries', new client.Counter({
      name: `${prefix}sparql_queries_total`,
      help: 'Total number of SPARQL queries executed',
      labelNames: ['query_type']
    }));
    
    this.histograms.set('sparql_query_duration', new client.Histogram({
      name: `${prefix}sparql_query_duration_seconds`,
      help: 'Duration of SPARQL query execution',
      labelNames: ['query_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }));
    
    // Database metrics
    this.gauges.set('db_connections_active', new client.Gauge({
      name: `${prefix}db_connections_active`,
      help: 'Number of active database connections',
      labelNames: ['database']
    }));
    
    this.counters.set('db_queries', new client.Counter({
      name: `${prefix}db_queries_total`,
      help: 'Total number of database queries',
      labelNames: ['database', 'operation']
    }));
    
    // Security metrics
    this.counters.set('auth_attempts', new client.Counter({
      name: `${prefix}auth_attempts_total`,
      help: 'Total number of authentication attempts',
      labelNames: ['result']
    }));
    
    this.counters.set('suspicious_activity', new client.Counter({
      name: `${prefix}suspicious_activity_total`,
      help: 'Total number of suspicious activities detected',
      labelNames: ['type']
    }));
    
    // System metrics
    this.gauges.set('system_cpu_usage', new client.Gauge({
      name: `${prefix}system_cpu_usage_percent`,
      help: 'System CPU usage percentage'
    }));
    
    this.gauges.set('system_memory_usage', new client.Gauge({
      name: `${prefix}system_memory_usage_bytes`,
      help: 'System memory usage in bytes'
    }));
    
    this.gauges.set('heap_memory_usage', new client.Gauge({
      name: `${prefix}heap_memory_usage_bytes`,
      help: 'Node.js heap memory usage in bytes'
    }));
    
    // Cache metrics
    this.counters.set('cache_operations', new client.Counter({
      name: `${prefix}cache_operations_total`,
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result']
    }));
    
    this.gauges.set('cache_size', new client.Gauge({
      name: `${prefix}cache_size_bytes`,
      help: 'Current cache size in bytes'
    }));
    
    consola.success('📊 Prometheus metrics initialized');
  }

  /**
   * Setup Winston logger
   */
  setupLogger() {
    const logConfig = this.config.logging || {};
    
    const transports = [
      new winston.transports.Console({
        level: logConfig.level || 'info',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} [${level}]: ${message}${stack ? '\n' + stack : ''}`;
          })
        )
      })
    ];
    
    // Add file transport if configured
    if (logConfig.file?.enabled) {
      transports.push(new winston.transports.File({
        filename: logConfig.file.filename || 'logs/kgen.log',
        level: logConfig.level || 'info',
        maxsize: logConfig.file.maxsize || 10485760, // 10MB
        maxFiles: logConfig.file.maxFiles || 5,
        tailable: logConfig.file.tailable !== false,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }));
    }
    
    this.logger = winston.createLogger({
      level: logConfig.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'kgen',
        version: process.env.npm_package_version || '2.0.8'
      },
      transports
    });
    
    consola.success('📝 Winston logger initialized');
  }

  /**
   * Setup system monitoring
   */
  setupSystemMonitoring() {
    // Collect system metrics periodically
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.collectionInterval);
    
    // Monitor for critical conditions
    this.setupCriticalMonitoring();
    
    consola.success('🔍 System monitoring initialized');
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      // CPU usage
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.gauges.get('system_cpu_usage')?.set(cpuPercent);
      
      // Memory usage
      const memUsage = process.memoryUsage();
      this.gauges.get('heap_memory_usage')?.set(memUsage.heapUsed);
      
      // System memory
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      this.gauges.get('system_memory_usage')?.set(usedMemory);
      
      // Check thresholds
      this.checkThresholds({
        cpu: cpuPercent,
        memory: (usedMemory / totalMemory) * 100,
        heapUsed: memUsage.heapUsed
      });
      
    } catch (error) {
      this.logger?.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Setup critical monitoring
   */
  setupCriticalMonitoring() {
    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger?.fatal('Uncaught Exception:', error);
      this.incrementCounter('system_errors', { type: 'uncaught_exception' });
      this.emit('critical-error', { type: 'uncaught_exception', error });
    });
    
    // Monitor unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger?.fatal('Unhandled Rejection:', { reason, promise });
      this.incrementCounter('system_errors', { type: 'unhandled_rejection' });
      this.emit('critical-error', { type: 'unhandled_rejection', reason });
    });
    
    // Monitor memory warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        this.logger?.warn('Max listeners exceeded:', warning);
        this.incrementCounter('system_warnings', { type: 'max_listeners' });
      }
    });
  }

  /**
   * Check alert thresholds
   */
  checkThresholds(metrics) {
    const alerts = [];
    
    if (metrics.cpu > this.alertThresholds.cpu) {
      alerts.push({ type: 'cpu', value: metrics.cpu, threshold: this.alertThresholds.cpu });
    }
    
    if (metrics.memory > this.alertThresholds.memory) {
      alerts.push({ type: 'memory', value: metrics.memory, threshold: this.alertThresholds.memory });
    }
    
    for (const alert of alerts) {
      this.emit('threshold-exceeded', alert);
      this.logger?.warn(`Threshold exceeded: ${alert.type} = ${alert.value}% (threshold: ${alert.threshold}%)`);
    }
  }

  /**
   * Setup health checks
   */
  setupHealthChecks() {
    // Default health checks
    this.healthChecks.set('memory', () => {
      const usage = process.memoryUsage();
      const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      return {
        status: usagePercent < 90 ? 'healthy' : 'unhealthy',
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        usagePercent: Math.round(usagePercent)
      };
    });
    
    this.healthChecks.set('uptime', () => {
      const uptime = process.uptime();
      return {
        status: 'healthy',
        uptime: Math.round(uptime),
        startTime: new Date(this.getDeterministicTimestamp() - uptime * 1000).toISOString()
      };
    });
  }

  /**
   * Start a timer for duration measurement
   */
  startTimer(name) {
    const startTime = performance.now();
    const startHrTime = process.hrtime.bigint();
    
    return {
      end: (labels = {}) => {
        const duration = (performance.now() - startTime) / 1000; // Convert to seconds
        
        // Record in histogram if it exists
        const histogram = this.histograms.get(name);
        if (histogram) {
          histogram.observe(labels, duration);
        }
        
        return duration;
      },
      endNs: () => {
        return process.hrtime.bigint() - startHrTime;
      }
    };
  }

  /**
   * Increment counter metric
   */
  incrementCounter(name, labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (counter) {
      counter.inc(labels, value);
    }
  }

  /**
   * Set gauge metric
   */
  setGauge(name, value, labels = {}) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(labels, value);
    }
  }

  /**
   * Record histogram metric
   */
  recordHistogram(name, value, labels = {}) {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.observe(labels, value);
    }
  }

  /**
   * Log message with structured data
   */
  log(level, message, meta = {}) {
    if (this.logger) {
      this.logger.log(level, message, meta);
    } else {
      consola[level](message, meta);
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics() {
    return client.register.metrics();
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      status: this.status,
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Perform all health checks
   */
  async performHealthChecks() {
    const results = {};
    
    for (const [name, checkFn] of this.healthChecks) {
      try {
        results[name] = await checkFn();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return results;
  }

  /**
   * Add custom health check
   */
  addHealthCheck(name, checkFn) {
    this.healthChecks.set(name, checkFn);
  }

  /**
   * Remove health check
   */
  removeHealthCheck(name) {
    return this.healthChecks.delete(name);
  }

  /**
   * Create middleware for HTTP request monitoring
   */
  httpMiddleware() {
    return (req, res, next) => {
      const startTime = this.getDeterministicTimestamp();
      const timer = this.startTimer('http_request_duration');
      
      // Track request
      this.incrementCounter('http_requests_total', {
        method: req.method,
        route: req.route?.path || req.path || 'unknown'
      });
      
      // Monitor response
      res.on('finish', () => {
        const duration = timer.end({
          method: req.method,
          route: req.route?.path || req.path || 'unknown',
          status_code: res.statusCode
        });
        
        this.incrementCounter('http_requests_total', {
          method: req.method,
          route: req.route?.path || req.path || 'unknown',
          status_code: res.statusCode
        });
        
        // Log slow requests
        const slowThreshold = this.config.performance?.slowQueryThreshold || 1000;
        if (duration * 1000 > slowThreshold) {
          this.log('warn', 'Slow HTTP request', {
            method: req.method,
            path: req.path,
            duration: duration * 1000,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
        
        // Track errors
        if (res.statusCode >= 400) {
          this.log('info', 'HTTP error response', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
      });
      
      next();
    };
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    const healthChecks = await this.performHealthChecks();
    const systemStatus = this.getSystemStatus();
    
    const overallHealth = Object.values(healthChecks).every(check => 
      check.status === 'healthy'
    ) ? 'healthy' : 'unhealthy';
    
    return {
      status: overallHealth,
      timestamp: this.getDeterministicDate().toISOString(),
      checks: healthChecks,
      system: systemStatus
    };
  }

  /**
   * Shutdown monitoring system
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear intervals
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    // Clear Prometheus registry
    client.register.clear();
    
    // Close logger
    if (this.logger) {
      this.logger.end();
    }
    
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Monitoring System shutdown complete');
  }
}