/**
 * Advanced Graph Processing Metrics Collector
 * 
 * Comprehensive metrics collection and analysis for RDF graph processing,
 * SPARQL query performance, and provenance operations with real-time monitoring.
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

export class GraphProcessingMetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableRealTimeMetrics: config.enableRealTimeMetrics !== false,
      metricsRetentionPeriod: config.metricsRetentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      alertThresholds: config.alertThresholds || {},
      exportMetrics: config.exportMetrics || false,
      exportInterval: config.exportInterval || 300000, // 5 minutes
      maxMetricsHistory: config.maxMetricsHistory || 10000,
      enableDetailedProfiling: config.enableDetailedProfiling || false,
      ...config
    };
    
    this.logger = consola.withTag('metrics-collector');
    
    // Metrics storage
    this.metrics = {
      // SPARQL Query Metrics
      sparqlQueries: {
        totalExecuted: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        slowQueries: [],
        errorCount: 0,
        cacheHitRate: 0,
        complexityDistribution: new Map(),
        queryTypeDistribution: new Map(),
        recentQueries: []
      },
      
      // RDF Graph Processing Metrics
      graphProcessing: {
        totalGraphsProcessed: 0,
        totalQuadsProcessed: 0,
        averageGraphSize: 0,
        largestGraph: 0,
        processingErrors: 0,
        parseTimeTotal: 0,
        averageParseTime: 0,
        formatDistribution: new Map(),
        recentProcessing: []
      },
      
      // Graph Diff Metrics
      graphDiffs: {
        totalDiffsComputed: 0,
        totalQuadsCompared: 0,
        averageDiffTime: 0,
        diffSizeDistribution: new Map(),
        strategyUsage: new Map(),
        cacheHitRate: 0,
        recentDiffs: []
      },
      
      // Compliance Processing Metrics
      compliance: {
        totalEventsProcessed: 0,
        totalRulesEvaluated: 0,
        violationsDetected: 0,
        averageProcessingTime: 0,
        frameworkDistribution: new Map(),
        severityDistribution: new Map(),
        recentViolations: []
      },
      
      // System Performance Metrics
      system: {
        memoryUsage: [],
        cpuUsage: [],
        gcStats: [],
        activeConnections: 0,
        peakMemoryUsage: 0,
        systemLoad: []
      },
      
      // Provenance Tracking Metrics
      provenance: {
        operationsTracked: 0,
        entitiesTracked: 0,
        integrityVerifications: 0,
        blockchainAnchors: 0,
        averageTrackingTime: 0,
        hashChainLength: 0,
        recentOperations: []
      }
    };
    
    // Performance tracking
    this.activeOperations = new Map();
    this.performanceMarks = new Map();
    this.alertConditions = new Map();
    
    // Aggregation and export timers
    this.aggregationTimer = null;
    this.exportTimer = null;
    
    // Alert thresholds
    this.defaultThresholds = {
      slowQueryThreshold: 5000, // 5 seconds
      highMemoryThreshold: 500 * 1024 * 1024, // 500MB
      errorRateThreshold: 0.05, // 5% error rate
      cacheHitRateThreshold: 0.7, // 70% cache hit rate
      violationRateThreshold: 0.1 // 10% violation rate
    };
    
    this.thresholds = { ...this.defaultThresholds, ...this.config.alertThresholds };
    
    this.state = 'initialized';
  }

  /**
   * Initialize metrics collector
   */
  async initialize() {
    try {
      this.logger.info('Initializing graph processing metrics collector');
      
      // Start real-time monitoring
      if (this.config.enableRealTimeMetrics) {
        this._startRealTimeMonitoring();
      }
      
      // Start aggregation timer
      if (this.config.aggregationInterval > 0) {
        this._startAggregation();
      }
      
      // Start export timer
      if (this.config.exportMetrics && this.config.exportInterval > 0) {
        this._startExport();
      }
      
      // Setup alert monitoring
      this._setupAlertMonitoring();
      
      this.state = 'active';
      this.logger.success('Metrics collector initialized successfully');
      
      return {
        status: 'success',
        realTimeMonitoring: this.config.enableRealTimeMetrics,
        aggregationInterval: this.config.aggregationInterval,
        exportEnabled: this.config.exportMetrics
      };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('Failed to initialize metrics collector:', error);
      throw error;
    }
  }

  /**
   * Record SPARQL query execution
   */
  recordSPARQLQuery(queryData) {
    const {
      query,
      executionTime,
      resultCount,
      queryType,
      complexity,
      cacheHit,
      error
    } = queryData;
    
    const metrics = this.metrics.sparqlQueries;
    
    metrics.totalExecuted++;
    
    if (error) {
      metrics.errorCount++;
    } else {
      metrics.totalExecutionTime += executionTime;
      metrics.averageExecutionTime = metrics.totalExecutionTime / (metrics.totalExecuted - metrics.errorCount);
      
      // Track slow queries
      if (executionTime > this.thresholds.slowQueryThreshold) {
        metrics.slowQueries.push({
          query: query.slice(0, 200),
          executionTime,
          timestamp: this.getDeterministicTimestamp(),
          complexity,
          resultCount
        });
        
        // Limit slow queries history
        if (metrics.slowQueries.length > 100) {
          metrics.slowQueries = metrics.slowQueries.slice(-50);
        }
      }
      
      // Update distributions
      if (queryType) {
        metrics.queryTypeDistribution.set(
          queryType,
          (metrics.queryTypeDistribution.get(queryType) || 0) + 1
        );
      }
      
      if (complexity) {
        const complexityBucket = this._getComplexityBucket(complexity.score);
        metrics.complexityDistribution.set(
          complexityBucket,
          (metrics.complexityDistribution.get(complexityBucket) || 0) + 1
        );
      }
    }
    
    // Update cache hit rate
    const totalQueries = metrics.totalExecuted;
    const cacheHits = metrics.recentQueries.filter(q => q.cacheHit).length + (cacheHit ? 1 : 0);
    metrics.cacheHitRate = totalQueries > 0 ? cacheHits / Math.min(totalQueries, 1000) : 0;
    
    // Add to recent queries
    metrics.recentQueries.push({
      executionTime,
      resultCount,
      queryType,
      complexity: complexity?.score,
      cacheHit,
      error: !!error,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Limit recent queries
    if (metrics.recentQueries.length > 1000) {
      metrics.recentQueries = metrics.recentQueries.slice(-500);
    }
    
    this.emit('query-recorded', {
      executionTime,
      queryType,
      error: !!error
    });
  }

  /**
   * Record graph processing operation
   */
  recordGraphProcessing(processingData) {
    const {
      graphSize,
      quadsProcessed,
      parseTime,
      format,
      error
    } = processingData;
    
    const metrics = this.metrics.graphProcessing;
    
    metrics.totalGraphsProcessed++;
    
    if (error) {
      metrics.processingErrors++;
    } else {
      metrics.totalQuadsProcessed += quadsProcessed || 0;
      metrics.averageGraphSize = metrics.totalQuadsProcessed / metrics.totalGraphsProcessed;
      metrics.largestGraph = Math.max(metrics.largestGraph, graphSize || 0);
      
      if (parseTime) {
        metrics.parseTimeTotal += parseTime;
        metrics.averageParseTime = metrics.parseTimeTotal / (metrics.totalGraphsProcessed - metrics.processingErrors);
      }
      
      if (format) {
        metrics.formatDistribution.set(
          format,
          (metrics.formatDistribution.get(format) || 0) + 1
        );
      }
    }
    
    // Add to recent processing
    metrics.recentProcessing.push({
      graphSize,
      parseTime,
      format,
      error: !!error,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Limit recent processing history
    if (metrics.recentProcessing.length > 1000) {
      metrics.recentProcessing = metrics.recentProcessing.slice(-500);
    }
    
    this.emit('graph-processed', {
      graphSize,
      parseTime,
      error: !!error
    });
  }

  /**
   * Record graph diff computation
   */
  recordGraphDiff(diffData) {
    const {
      strategy,
      executionTime,
      quadsCompared,
      addedCount,
      removedCount,
      cacheHit
    } = diffData;
    
    const metrics = this.metrics.graphDiffs;
    
    metrics.totalDiffsComputed++;
    metrics.totalQuadsCompared += quadsCompared || 0;
    metrics.averageDiffTime = (
      (metrics.averageDiffTime * (metrics.totalDiffsComputed - 1) + executionTime) /
      metrics.totalDiffsComputed
    );
    
    // Update strategy usage
    if (strategy) {
      metrics.strategyUsage.set(
        strategy,
        (metrics.strategyUsage.get(strategy) || 0) + 1
      );
    }
    
    // Update diff size distribution
    const totalChanges = (addedCount || 0) + (removedCount || 0);
    const sizeBucket = this._getDiffSizeBucket(totalChanges);
    metrics.diffSizeDistribution.set(
      sizeBucket,
      (metrics.diffSizeDistribution.get(sizeBucket) || 0) + 1
    );
    
    // Update cache hit rate for diffs
    const recentCacheHits = metrics.recentDiffs.filter(d => d.cacheHit).length + (cacheHit ? 1 : 0);
    metrics.cacheHitRate = Math.min(metrics.recentDiffs.length + 1, 1000) > 0 ?
      recentCacheHits / Math.min(metrics.recentDiffs.length + 1, 1000) : 0;
    
    // Add to recent diffs
    metrics.recentDiffs.push({
      strategy,
      executionTime,
      totalChanges,
      cacheHit,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Limit recent diffs
    if (metrics.recentDiffs.length > 1000) {
      metrics.recentDiffs = metrics.recentDiffs.slice(-500);
    }
    
    this.emit('diff-recorded', {
      strategy,
      executionTime,
      totalChanges
    });
  }

  /**
   * Record compliance processing
   */
  recordComplianceProcessing(complianceData) {
    const {
      eventsProcessed,
      rulesEvaluated,
      violations,
      warnings,
      framework,
      executionTime
    } = complianceData;
    
    const metrics = this.metrics.compliance;
    
    metrics.totalEventsProcessed += eventsProcessed || 0;
    metrics.totalRulesEvaluated += rulesEvaluated || 0;
    metrics.violationsDetected += (violations?.length || 0);
    
    if (executionTime) {
      const totalOps = metrics.totalEventsProcessed || 1;
      metrics.averageProcessingTime = (
        (metrics.averageProcessingTime * (totalOps - (eventsProcessed || 0)) + executionTime) /
        totalOps
      );
    }
    
    // Update framework distribution
    if (framework) {
      metrics.frameworkDistribution.set(
        framework,
        (metrics.frameworkDistribution.get(framework) || 0) + (eventsProcessed || 1)
      );
    }
    
    // Update severity distribution
    if (violations) {
      for (const violation of violations) {
        const severity = violation.severity || 'unknown';
        metrics.severityDistribution.set(
          severity,
          (metrics.severityDistribution.get(severity) || 0) + 1
        );
      }
    }
    
    // Add recent violations
    if (violations && violations.length > 0) {
      metrics.recentViolations.push(...violations.map(v => ({
        ...v,
        timestamp: this.getDeterministicTimestamp()
      })));
      
      // Limit recent violations
      if (metrics.recentViolations.length > 1000) {
        metrics.recentViolations = metrics.recentViolations.slice(-500);
      }
    }
    
    this.emit('compliance-recorded', {
      violationCount: violations?.length || 0,
      framework,
      executionTime
    });
  }

  /**
   * Record provenance operation
   */
  recordProvenanceOperation(provenanceData) {
    const {
      operationType,
      entitiesTracked,
      executionTime,
      integrityVerified,
      blockchainAnchored
    } = provenanceData;
    
    const metrics = this.metrics.provenance;
    
    metrics.operationsTracked++;
    metrics.entitiesTracked += entitiesTracked || 0;
    
    if (integrityVerified) {
      metrics.integrityVerifications++;
    }
    
    if (blockchainAnchored) {
      metrics.blockchainAnchors++;
    }
    
    if (executionTime) {
      metrics.averageTrackingTime = (
        (metrics.averageTrackingTime * (metrics.operationsTracked - 1) + executionTime) /
        metrics.operationsTracked
      );
    }
    
    // Add to recent operations
    metrics.recentOperations.push({
      operationType,
      entitiesTracked,
      executionTime,
      integrityVerified,
      blockchainAnchored,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Limit recent operations
    if (metrics.recentOperations.length > 1000) {
      metrics.recentOperations = metrics.recentOperations.slice(-500);
    }
    
    this.emit('provenance-recorded', {
      operationType,
      entitiesTracked,
      executionTime
    });
  }

  /**
   * Start performance operation tracking
   */
  startOperation(operationId, operationType, metadata = {}) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    this.activeOperations.set(operationId, {
      operationType,
      startTime,
      startMemory,
      metadata
    });
    
    this.performanceMarks.set(`${operationId}-start`, startTime);
  }

  /**
   * End performance operation tracking
   */
  endOperation(operationId, result = {}) {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(`Operation ${operationId} not found for ending`);
      return null;
    }
    
    const duration = endTime - operation.startTime;
    const memoryDelta = endMemory.heapUsed - operation.startMemory.heapUsed;
    
    const operationData = {
      operationId,
      operationType: operation.operationType,
      duration,
      memoryDelta,
      startMemory: operation.startMemory,
      endMemory,
      metadata: operation.metadata,
      result
    };
    
    // Record based on operation type
    switch (operation.operationType) {
      case 'sparql-query':
        this.recordSPARQLQuery({
          ...result,
          executionTime: duration
        });
        break;
      case 'graph-processing':
        this.recordGraphProcessing({
          ...result,
          parseTime: duration
        });
        break;
      case 'graph-diff':
        this.recordGraphDiff({
          ...result,
          executionTime: duration
        });
        break;
      case 'compliance-processing':
        this.recordComplianceProcessing({
          ...result,
          executionTime: duration
        });
        break;
      case 'provenance-operation':
        this.recordProvenanceOperation({
          ...result,
          executionTime: duration
        });
        break;
    }
    
    this.activeOperations.delete(operationId);
    this.performanceMarks.delete(`${operationId}-start`);
    
    return operationData;
  }

  /**
   * Get comprehensive metrics summary
   */
  getMetricsSummary() {
    const now = this.getDeterministicTimestamp();
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: now,
      system: {
        memoryUsage: memUsage,
        activeOperations: this.activeOperations.size,
        uptime: process.uptime()
      },
      sparqlQueries: {
        total: this.metrics.sparqlQueries.totalExecuted,
        averageTime: Math.round(this.metrics.sparqlQueries.averageExecutionTime),
        errorRate: this.metrics.sparqlQueries.totalExecuted > 0 ?
          this.metrics.sparqlQueries.errorCount / this.metrics.sparqlQueries.totalExecuted : 0,
        cacheHitRate: this.metrics.sparqlQueries.cacheHitRate,
        slowQueries: this.metrics.sparqlQueries.slowQueries.length
      },
      graphProcessing: {
        total: this.metrics.graphProcessing.totalGraphsProcessed,
        averageSize: Math.round(this.metrics.graphProcessing.averageGraphSize),
        averageParseTime: Math.round(this.metrics.graphProcessing.averageParseTime),
        errorRate: this.metrics.graphProcessing.totalGraphsProcessed > 0 ?
          this.metrics.graphProcessing.processingErrors / this.metrics.graphProcessing.totalGraphsProcessed : 0
      },
      compliance: {
        totalEvents: this.metrics.compliance.totalEventsProcessed,
        violations: this.metrics.compliance.violationsDetected,
        violationRate: this.metrics.compliance.totalEventsProcessed > 0 ?
          this.metrics.compliance.violationsDetected / this.metrics.compliance.totalEventsProcessed : 0,
        averageProcessingTime: Math.round(this.metrics.compliance.averageProcessingTime)
      },
      provenance: {
        operations: this.metrics.provenance.operationsTracked,
        entities: this.metrics.provenance.entitiesTracked,
        integrityChecks: this.metrics.provenance.integrityVerifications,
        blockchainAnchors: this.metrics.provenance.blockchainAnchors
      }
    };
  }

  /**
   * Get detailed metrics report
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      summary: this.getMetricsSummary(),
      alerts: this._getActiveAlerts(),
      trends: this._calculateTrends()
    };
  }

  /**
   * Export metrics to external system
   */
  async exportMetrics(format = 'json', destination = 'console') {
    const metrics = this.getDetailedMetrics();
    
    try {
      switch (format) {
        case 'json':
          const jsonData = JSON.stringify(metrics, null, 2);
          await this._exportData(jsonData, destination, 'json');
          break;
        case 'csv':
          const csvData = this._convertToCSV(metrics.summary);
          await this._exportData(csvData, destination, 'csv');
          break;
        case 'prometheus':
          const promData = this._convertToPrometheus(metrics.summary);
          await this._exportData(promData, destination, 'prom');
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      this.logger.debug(`Metrics exported successfully (${format} to ${destination})`);
      this.emit('metrics-exported', { format, destination });
      
    } catch (error) {
      this.logger.error('Failed to export metrics:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Start real-time monitoring
   */
  _startRealTimeMonitoring() {
    // Monitor system resources
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.system.memoryUsage.push({
        ...memUsage,
        timestamp: this.getDeterministicTimestamp()
      });
      
      this.metrics.system.cpuUsage.push({
        ...cpuUsage,
        timestamp: this.getDeterministicTimestamp()
      });
      
      // Update peak memory usage
      this.metrics.system.peakMemoryUsage = Math.max(
        this.metrics.system.peakMemoryUsage,
        memUsage.heapUsed
      );
      
      // Trim old data
      this._trimTimeSeriesData();
      
    }, 10000); // Every 10 seconds
  }

  /**
   * Start metrics aggregation
   */
  _startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this._aggregateMetrics();
    }, this.config.aggregationInterval);
  }

  /**
   * Start metrics export
   */
  _startExport() {
    this.exportTimer = setInterval(() => {
      this.exportMetrics().catch(error => {
        this.logger.error('Scheduled metrics export failed:', error);
      });
    }, this.config.exportInterval);
  }

  /**
   * Setup alert monitoring
   */
  _setupAlertMonitoring() {
    this.on('query-recorded', (data) => {
      if (data.executionTime > this.thresholds.slowQueryThreshold) {
        this._triggerAlert('slow-query', {
          executionTime: data.executionTime,
          threshold: this.thresholds.slowQueryThreshold
        });
      }
    });
    
    this.on('compliance-recorded', (data) => {
      const violationRate = data.violationCount / Math.max(data.eventsProcessed || 1, 1);
      if (violationRate > this.thresholds.violationRateThreshold) {
        this._triggerAlert('high-violation-rate', {
          violationRate,
          threshold: this.thresholds.violationRateThreshold
        });
      }
    });
  }

  /**
   * Get complexity bucket for query
   */
  _getComplexityBucket(score) {
    if (score < 0.3) return 'simple';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'complex';
    return 'very-complex';
  }

  /**
   * Get diff size bucket
   */
  _getDiffSizeBucket(totalChanges) {
    if (totalChanges < 10) return 'small';
    if (totalChanges < 100) return 'medium';
    if (totalChanges < 1000) return 'large';
    return 'very-large';
  }

  /**
   * Trim time series data to prevent memory leaks
   */
  _trimTimeSeriesData() {
    const cutoffTime = this.getDeterministicTimestamp() - this.config.metricsRetentionPeriod;
    
    this.metrics.system.memoryUsage = this.metrics.system.memoryUsage.filter(
      item => item.timestamp > cutoffTime
    );
    
    this.metrics.system.cpuUsage = this.metrics.system.cpuUsage.filter(
      item => item.timestamp > cutoffTime
    );
  }

  /**
   * Aggregate metrics for trend analysis
   */
  _aggregateMetrics() {
    // This would implement detailed aggregation logic
    // For now, just emit an event
    this.emit('metrics-aggregated', {
      timestamp: this.getDeterministicTimestamp(),
      summary: this.getMetricsSummary()
    });
  }

  /**
   * Calculate performance trends
   */
  _calculateTrends() {
    // Simple trend calculation
    // Real implementation would use statistical methods
    
    const recentQueries = this.metrics.sparqlQueries.recentQueries.slice(-100);
    const queryTimeTrend = recentQueries.length > 1 ?
      (recentQueries[recentQueries.length - 1].executionTime - recentQueries[0].executionTime) : 0;
    
    return {
      queryPerformance: queryTimeTrend > 0 ? 'declining' : 'improving',
      memoryUsage: this.metrics.system.memoryUsage.length > 1 ? 
        this._calculateMemoryTrend() : 'stable',
      errorRate: this._calculateErrorRateTrend()
    };
  }

  /**
   * Calculate memory usage trend
   */
  _calculateMemoryTrend() {
    const recent = this.metrics.system.memoryUsage.slice(-10);
    if (recent.length < 2) return 'stable';
    
    const trend = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
    if (trend > 10 * 1024 * 1024) return 'increasing';
    if (trend < -10 * 1024 * 1024) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate error rate trend
   */
  _calculateErrorRateTrend() {
    const recentErrors = this.metrics.sparqlQueries.recentQueries.slice(-100)
      .filter(q => q.error).length;
    
    if (recentErrors > 5) return 'increasing';
    if (recentErrors === 0) return 'stable';
    return 'low';
  }

  /**
   * Get active alerts
   */
  _getActiveAlerts() {
    const alerts = [];
    const summary = this.getMetricsSummary();
    
    // Check various alert conditions
    if (summary.sparqlQueries.errorRate > this.thresholds.errorRateThreshold) {
      alerts.push({
        type: 'high-error-rate',
        severity: 'warning',
        message: `SPARQL error rate (${(summary.sparqlQueries.errorRate * 100).toFixed(1)}%) exceeds threshold`,
        timestamp: this.getDeterministicTimestamp()
      });
    }
    
    if (summary.system.memoryUsage.heapUsed > this.thresholds.highMemoryThreshold) {
      alerts.push({
        type: 'high-memory-usage',
        severity: 'warning',
        message: `Memory usage (${Math.round(summary.system.memoryUsage.heapUsed / 1024 / 1024)}MB) exceeds threshold`,
        timestamp: this.getDeterministicTimestamp()
      });
    }
    
    return alerts;
  }

  /**
   * Trigger alert
   */
  _triggerAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: this.getDeterministicTimestamp()
    };
    
    this.alertConditions.set(type, alert);
    this.emit('alert', alert);
    
    this.logger.warn(`Alert triggered: ${type}`, data);
  }

  /**
   * Export data to destination
   */
  async _exportData(data, destination, format) {
    switch (destination) {
      case 'console':
        console.log(data);
        break;
      case 'file':
        const fs = await import('fs/promises');
        const filename = `metrics-${this.getDeterministicTimestamp()}.${format}`;
        await fs.writeFile(filename, data, 'utf8');
        break;
      default:
        throw new Error(`Unsupported export destination: ${destination}`);
    }
  }

  /**
   * Convert metrics to CSV format
   */
  _convertToCSV(summary) {
    const rows = [
      ['timestamp', 'query_count', 'avg_query_time', 'error_rate', 'memory_usage'],
      [
        summary.timestamp,
        summary.sparqlQueries.total,
        summary.sparqlQueries.averageTime,
        summary.sparqlQueries.errorRate,
        summary.system.memoryUsage.heapUsed
      ]
    ];
    
    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Convert metrics to Prometheus format
   */
  _convertToPrometheus(summary) {
    const lines = [];
    
    lines.push(`# HELP sparql_queries_total Total SPARQL queries executed`);
    lines.push(`# TYPE sparql_queries_total counter`);
    lines.push(`sparql_queries_total ${summary.sparqlQueries.total}`);
    
    lines.push(`# HELP sparql_query_duration_avg Average SPARQL query duration in milliseconds`);
    lines.push(`# TYPE sparql_query_duration_avg gauge`);
    lines.push(`sparql_query_duration_avg ${summary.sparqlQueries.averageTime}`);
    
    lines.push(`# HELP memory_usage_bytes Current memory usage in bytes`);
    lines.push(`# TYPE memory_usage_bytes gauge`);
    lines.push(`memory_usage_bytes ${summary.system.memoryUsage.heapUsed}`);
    
    return lines.join('\n');
  }

  /**
   * Shutdown metrics collector
   */
  async shutdown() {
    this.logger.info('Shutting down metrics collector');
    
    // Clear timers
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
    }
    
    // Final export
    if (this.config.exportMetrics) {
      try {
        await this.exportMetrics();
      } catch (error) {
        this.logger.error('Failed to export final metrics:', error);
      }
    }
    
    this.state = 'shutdown';
    this.logger.success('Metrics collector shutdown complete');
  }
}

export default GraphProcessingMetricsCollector;