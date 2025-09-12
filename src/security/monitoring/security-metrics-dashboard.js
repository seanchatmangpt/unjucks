/**
 * Security Metrics Dashboard
 * Real-time monitoring and visualization of enterprise security metrics
 * 
 * @description Provides comprehensive security metrics collection, analysis, and dashboard capabilities
 * @version 1.0.0
 * @author Agent #6: Security Hardening Specialist
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';

/**
 * Security Metrics Dashboard
 * Collects, analyzes, and presents security metrics in real-time
 */
export class SecurityMetricsDashboard extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Dashboard settings
      refreshInterval: config.refreshInterval || 5000, // 5 seconds
      dataRetentionPeriod: config.dataRetentionPeriod || 86400000, // 24 hours
      maxDataPoints: config.maxDataPoints || 10000,
      
      // Metrics configuration
      enableRealTimeUpdates: config.enableRealTimeUpdates || true,
      enableAlerts: config.enableAlerts || true,
      enableTrendAnalysis: config.enableTrendAnalysis || true,
      
      // Alert thresholds
      alertThresholds: {
        threatLevel: config.alertThresholds?.threatLevel || 'medium',
        errorRate: config.alertThresholds?.errorRate || 0.05, // 5%
        responseTime: config.alertThresholds?.responseTime || 5000, // 5 seconds
        availabilityThreshold: config.alertThresholds?.availabilityThreshold || 0.99, // 99%
        failureRate: config.alertThresholds?.failureRate || 0.1, // 10%
        ...config.alertThresholds
      },
      
      // Visualization settings
      charts: {
        enabled: config.charts?.enabled || true,
        types: config.charts?.types || ['line', 'bar', 'pie', 'gauge', 'heatmap'],
        colors: config.charts?.colors || ['#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1']
      },
      
      // Export settings
      export: {
        formats: config.export?.formats || ['json', 'csv', 'pdf'],
        scheduledReports: config.export?.scheduledReports || false,
        reportInterval: config.export?.reportInterval || 3600000 // 1 hour
      },
      
      debug: config.debug || false
    };
    
    // Metrics storage
    this.metrics = {
      // Real-time metrics
      realTime: {
        timestamp: this.getDeterministicTimestamp(),
        security: {
          threatLevel: 'low',
          activeThreats: 0,
          threatsDetected: 0,
          threatsMitigated: 0,
          falsePositives: 0
        },
        performance: {
          averageResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 0,
          availability: 1.0,
          throughput: 0
        },
        components: {},
        compliance: {
          overallScore: 0,
          frameworkScores: {},
          violations: 0,
          remediations: 0
        }
      },
      
      // Historical data
      timeSeries: {
        security: [],
        performance: [],
        compliance: [],
        components: {},
        alerts: []
      },
      
      // Aggregated metrics
      aggregated: {
        hourly: {},
        daily: {},
        weekly: {},
        monthly: {}
      },
      
      // Dashboard state
      dashboard: {
        lastUpdate: null,
        viewers: 0,
        autoRefresh: true,
        selectedTimeRange: '1h'
      }
    };
    
    // Alert system
    this.alerts = {
      active: new Map(),
      history: [],
      rules: new Map(),
      notifications: []
    };
    
    // Chart configurations
    this.chartConfigs = new Map();
    
    // Data connectors
    this.connectors = new Map();
    
    // Update intervals
    this.intervals = {
      refresh: null,
      cleanup: null,
      aggregation: null,
      reports: null
    };
    
    // Dashboard widgets
    this.widgets = new Map();
    
    this._initializeWidgets();
    this._setupDefaultAlertRules();
    
    if (this.config.debug) {
      console.log('SecurityMetricsDashboard initialized with config:', this.config);
    }
  }
  
  /**
   * Initialize the dashboard and start data collection
   */
  async initialize() {
    try {
      this._startDataCollection();
      this._startDataAggregation();
      this._startCleanupProcess();
      
      if (this.config.export.scheduledReports) {
        this._startScheduledReports();
      }
      
      // Initialize chart configurations
      this._initializeChartConfigurations();
      
      this.metrics.dashboard.lastUpdate = this.getDeterministicDate();
      
      this.emit('dashboard-initialized', {
        timestamp: this.getDeterministicDate(),
        widgets: Array.from(this.widgets.keys()),
        charts: Array.from(this.chartConfigs.keys())
      });
      
      if (this.config.debug) {
        console.log('Security Metrics Dashboard initialized successfully');
      }
      
      return {
        success: true,
        widgets: Array.from(this.widgets.keys()),
        charts: Array.from(this.chartConfigs.keys())
      };
      
    } catch (error) {
      this.emit('error', {
        type: 'initialization-failed',
        error: error.message,
        timestamp: this.getDeterministicDate()
      });
      
      throw new Error(`Dashboard initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Register a metrics data source
   */
  registerDataSource(name, connector) {
    this.connectors.set(name, connector);
    
    // Setup event listeners for real-time updates
    if (connector.on && this.config.enableRealTimeUpdates) {
      connector.on('metrics-updated', (data) => {
        this.updateMetrics(name, data);
      });
      
      connector.on('alert', (alertData) => {
        this.processAlert(name, alertData);
      });
    }
    
    this.emit('data-source-registered', { name, connector });
    
    if (this.config.debug) {
      console.log(`Data source registered: ${name}`);
    }
  }
  
  /**
   * Update metrics from a data source
   */
  updateMetrics(sourceName, metricsData) {
    const timestamp = this.getDeterministicTimestamp();
    
    try {
      // Update real-time metrics
      this._updateRealTimeMetrics(sourceName, metricsData, timestamp);
      
      // Add to time series
      this._addToTimeSeries(sourceName, metricsData, timestamp);
      
      // Check alert conditions
      if (this.config.enableAlerts) {
        this._checkAlertConditions(sourceName, metricsData);
      }
      
      // Update dashboard state
      this.metrics.dashboard.lastUpdate = new Date(timestamp);
      
      this.emit('metrics-updated', {
        source: sourceName,
        timestamp: new Date(timestamp),
        data: metricsData
      });
      
      if (this.config.debug) {
        console.log(`Metrics updated from ${sourceName}:`, metricsData);
      }
      
    } catch (error) {
      this.emit('error', {
        type: 'metrics-update-failed',
        source: sourceName,
        error: error.message,
        timestamp: this.getDeterministicDate()
      });
    }
  }
  
  /**
   * Get dashboard data for visualization
   */
  getDashboardData(timeRange = '1h', widgets = []) {
    const now = this.getDeterministicTimestamp();
    const timeRangeMs = this._parseTimeRange(timeRange);
    const fromTime = now - timeRangeMs;
    
    const dashboardData = {
      realTime: { ...this.metrics.realTime },
      timeSeries: this._getTimeSeriesData(fromTime, now),
      widgets: this._getWidgetData(widgets),
      charts: this._getChartData(timeRange),
      alerts: this._getActiveAlerts(),
      summary: this._generateSummary(timeRange),
      metadata: {
        timeRange,
        lastUpdate: this.metrics.dashboard.lastUpdate,
        dataPoints: this._countDataPoints(fromTime, now),
        viewers: this.metrics.dashboard.viewers
      }
    };
    
    return dashboardData;
  }
  
  /**
   * Get specific widget data
   */
  getWidgetData(widgetName) {
    const widget = this.widgets.get(widgetName);
    if (!widget) {
      throw new Error(`Widget not found: ${widgetName}`);
    }
    
    return widget.getData(this.metrics);
  }
  
  /**
   * Generate security report
   */
  async generateSecurityReport(config = {}) {
    const reportConfig = {
      format: config.format || 'json',
      timeRange: config.timeRange || '24h',
      sections: config.sections || ['summary', 'threats', 'performance', 'compliance', 'recommendations'],
      includeCharts: config.includeCharts || true,
      ...config
    };
    
    const timeRangeMs = this._parseTimeRange(reportConfig.timeRange);
    const fromTime = this.getDeterministicTimestamp() - timeRangeMs;
    const toTime = this.getDeterministicTimestamp();
    
    const report = {
      metadata: {
        generated: this.getDeterministicDate(),
        timeRange: reportConfig.timeRange,
        format: reportConfig.format,
        sections: reportConfig.sections
      },
      summary: null,
      threats: null,
      performance: null,
      compliance: null,
      recommendations: null,
      charts: null
    };
    
    // Generate each requested section
    if (reportConfig.sections.includes('summary')) {
      report.summary = this._generateSummary(reportConfig.timeRange);
    }
    
    if (reportConfig.sections.includes('threats')) {
      report.threats = this._generateThreatReport(fromTime, toTime);
    }
    
    if (reportConfig.sections.includes('performance')) {
      report.performance = this._generatePerformanceReport(fromTime, toTime);
    }
    
    if (reportConfig.sections.includes('compliance')) {
      report.compliance = this._generateComplianceReport(fromTime, toTime);
    }
    
    if (reportConfig.sections.includes('recommendations')) {
      report.recommendations = this._generateRecommendations();
    }
    
    if (reportConfig.includeCharts) {
      report.charts = this._generateChartData(reportConfig.timeRange);
    }
    
    // Format report based on requested format
    let formattedReport;
    switch (reportConfig.format.toLowerCase()) {
      case 'json':
        formattedReport = JSON.stringify(report, null, 2);
        break;
      case 'csv':
        formattedReport = this._formatReportAsCSV(report);
        break;
      case 'html':
        formattedReport = this._formatReportAsHTML(report);
        break;
      default:
        formattedReport = report;
    }
    
    this.emit('report-generated', {
      format: reportConfig.format,
      timeRange: reportConfig.timeRange,
      size: typeof formattedReport === 'string' ? formattedReport.length : 'unknown',
      timestamp: this.getDeterministicDate()
    });
    
    return {
      report: formattedReport,
      metadata: report.metadata
    };
  }
  
  /**
   * Create custom alert rule
   */
  createAlertRule(ruleName, condition) {
    const alertRule = {
      name: ruleName,
      condition: condition.condition || '',
      threshold: condition.threshold || 0,
      severity: condition.severity || 'medium',
      enabled: condition.enabled !== false,
      cooldown: condition.cooldown || 300000, // 5 minutes
      notifications: condition.notifications || [],
      created: this.getDeterministicDate(),
      lastTriggered: null,
      triggerCount: 0
    };
    
    this.alerts.rules.set(ruleName, alertRule);
    
    this.emit('alert-rule-created', {
      ruleName,
      rule: alertRule,
      timestamp: this.getDeterministicDate()
    });
    
    if (this.config.debug) {
      console.log(`Alert rule created: ${ruleName}`, alertRule);
    }
    
    return alertRule;
  }
  
  /**
   * Process incoming alert
   */
  processAlert(source, alertData) {
    const alertId = this._generateAlertId(source, alertData);
    const timestamp = this.getDeterministicTimestamp();
    
    const alert = {
      id: alertId,
      source,
      type: alertData.type || 'unknown',
      severity: alertData.severity || 'medium',
      message: alertData.message || 'Security alert triggered',
      details: alertData.details || {},
      timestamp: new Date(timestamp),
      status: 'active',
      acknowledged: false,
      resolvedAt: null
    };
    
    // Store active alert
    this.alerts.active.set(alertId, alert);
    
    // Add to history
    this.alerts.history.push({ ...alert });
    
    // Limit history size
    if (this.alerts.history.length > this.config.maxDataPoints) {
      this.alerts.history.shift();
    }
    
    // Update threat metrics
    this.metrics.realTime.security.activeThreats = this.alerts.active.size;
    this.metrics.realTime.security.threatsDetected++;
    
    // Determine threat level
    this._updateThreatLevel();
    
    // Emit alert event
    this.emit('alert', alert);
    
    if (this.config.debug) {
      console.log(`Alert processed: ${alertId}`, alert);
    }
    
    return alert;
  }
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId, acknowledgedBy = 'system') {
    const alert = this.alerts.active.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }
    
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = this.getDeterministicDate();
    
    this.emit('alert-acknowledged', {
      alertId,
      acknowledgedBy,
      timestamp: alert.acknowledgedAt
    });
    
    return alert;
  }
  
  /**
   * Resolve alert
   */
  resolveAlert(alertId, resolution = 'manual') {
    const alert = this.alerts.active.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }
    
    alert.status = 'resolved';
    alert.resolvedAt = this.getDeterministicDate();
    alert.resolution = resolution;
    
    // Remove from active alerts
    this.alerts.active.delete(alertId);
    
    // Update metrics
    this.metrics.realTime.security.activeThreats = this.alerts.active.size;
    this.metrics.realTime.security.threatsMitigated++;
    
    this._updateThreatLevel();
    
    this.emit('alert-resolved', {
      alertId,
      resolution,
      timestamp: alert.resolvedAt
    });
    
    return alert;
  }
  
  /**
   * Get dashboard health status
   */
  async getHealth() {
    const now = this.getDeterministicTimestamp();
    const lastUpdateAge = now - (this.metrics.dashboard.lastUpdate?.getTime() || 0);
    
    const health = {
      status: 'healthy',
      lastUpdate: this.metrics.dashboard.lastUpdate,
      lastUpdateAge,
      dataSources: this.connectors.size,
      activeAlerts: this.alerts.active.size,
      widgets: this.widgets.size,
      charts: this.chartConfigs.size,
      metrics: {
        dataPoints: this._countTotalDataPoints(),
        memoryUsage: this._estimateMemoryUsage()
      }
    };
    
    // Determine health status
    if (lastUpdateAge > 60000) { // 1 minute
      health.status = 'stale';
    }
    
    if (this.alerts.active.size > 10) {
      health.status = 'warning';
    }
    
    return health;
  }
  
  /**
   * Get dashboard metrics
   */
  async getMetrics() {
    return {
      realTime: { ...this.metrics.realTime },
      aggregated: { ...this.metrics.aggregated },
      dashboard: { ...this.metrics.dashboard },
      alerts: {
        active: this.alerts.active.size,
        total: this.alerts.history.length,
        rules: this.alerts.rules.size
      },
      performance: {
        dataPoints: this._countTotalDataPoints(),
        memoryUsage: this._estimateMemoryUsage(),
        updateLatency: this._calculateUpdateLatency()
      }
    };
  }
  
  /**
   * Shutdown dashboard and cleanup resources
   */
  async shutdown() {
    try {
      // Clear all intervals
      Object.values(this.intervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      
      // Clear data structures
      this.alerts.active.clear();
      this.alerts.rules.clear();
      this.connectors.clear();
      this.widgets.clear();
      this.chartConfigs.clear();
      
      this.emit('shutdown-complete', { timestamp: this.getDeterministicDate() });
      
      if (this.config.debug) {
        console.log('Security Metrics Dashboard shutdown complete');
      }
      
    } catch (error) {
      this.emit('error', {
        type: 'shutdown-failed',
        error: error.message,
        timestamp: this.getDeterministicDate()
      });
      throw error;
    }
  }
  
  // Private methods
  
  _initializeWidgets() {
    // Threat Level Widget
    this.widgets.set('threat-level', {
      name: 'Threat Level',
      type: 'gauge',
      getData: (metrics) => ({
        value: this._getThreatLevelValue(metrics.realTime.security.threatLevel),
        level: metrics.realTime.security.threatLevel,
        activeThreats: metrics.realTime.security.activeThreats
      })
    });
    
    // Performance Overview Widget
    this.widgets.set('performance-overview', {
      name: 'Performance Overview',
      type: 'metrics',
      getData: (metrics) => ({
        responseTime: metrics.realTime.performance.averageResponseTime,
        errorRate: metrics.realTime.performance.errorRate,
        availability: metrics.realTime.performance.availability,
        throughput: metrics.realTime.performance.throughput
      })
    });
    
    // Active Alerts Widget
    this.widgets.set('active-alerts', {
      name: 'Active Alerts',
      type: 'list',
      getData: () => ({
        count: this.alerts.active.size,
        alerts: Array.from(this.alerts.active.values()).slice(0, 5)
      })
    });
    
    // Compliance Status Widget
    this.widgets.set('compliance-status', {
      name: 'Compliance Status',
      type: 'progress',
      getData: (metrics) => ({
        overallScore: metrics.realTime.compliance.overallScore,
        frameworks: metrics.realTime.compliance.frameworkScores,
        violations: metrics.realTime.compliance.violations
      })
    });
    
    // Component Health Widget
    this.widgets.set('component-health', {
      name: 'Component Health',
      type: 'status',
      getData: (metrics) => ({
        components: Object.keys(metrics.realTime.components).map(name => ({
          name,
          healthy: metrics.realTime.components[name].healthy,
          status: metrics.realTime.components[name].status
        }))
      })
    });
  }
  
  _setupDefaultAlertRules() {
    // High threat level rule
    this.createAlertRule('high-threat-level', {
      condition: 'threat_level >= high',
      severity: 'critical',
      notifications: ['email', 'sms']
    });
    
    // High error rate rule
    this.createAlertRule('high-error-rate', {
      condition: 'error_rate > 0.1',
      threshold: 0.1,
      severity: 'high',
      notifications: ['email']
    });
    
    // Low availability rule
    this.createAlertRule('low-availability', {
      condition: 'availability < 0.95',
      threshold: 0.95,
      severity: 'high',
      notifications: ['email', 'webhook']
    });
    
    // Component unhealthy rule
    this.createAlertRule('component-unhealthy', {
      condition: 'component_healthy = false',
      severity: 'medium',
      notifications: ['email']
    });
  }
  
  _initializeChartConfigurations() {
    // Threat Level Timeline
    this.chartConfigs.set('threat-timeline', {
      type: 'line',
      title: 'Threat Level Over Time',
      data: () => this._getTimeSeriesData(this.getDeterministicTimestamp() - 3600000, this.getDeterministicTimestamp()).security,
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 5 }
        }
      }
    });
    
    // Performance Metrics
    this.chartConfigs.set('performance-metrics', {
      type: 'multiline',
      title: 'Performance Metrics',
      data: () => this._getTimeSeriesData(this.getDeterministicTimestamp() - 3600000, this.getDeterministicTimestamp()).performance,
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
    
    // Alert Distribution
    this.chartConfigs.set('alert-distribution', {
      type: 'pie',
      title: 'Alert Distribution by Severity',
      data: () => this._getAlertDistribution(),
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
  
  _startDataCollection() {
    this.intervals.refresh = setInterval(() => {
      this._collectMetricsFromSources();
    }, this.config.refreshInterval);
  }
  
  _startDataAggregation() {
    this.intervals.aggregation = setInterval(() => {
      this._aggregateMetrics();
    }, 60000); // Every minute
  }
  
  _startCleanupProcess() {
    this.intervals.cleanup = setInterval(() => {
      this._cleanupOldData();
    }, 3600000); // Every hour
  }
  
  _startScheduledReports() {
    this.intervals.reports = setInterval(async () => {
      try {
        const report = await this.generateSecurityReport({
          format: 'json',
          timeRange: '1h'
        });
        
        this.emit('scheduled-report', {
          report: report.report,
          timestamp: this.getDeterministicDate()
        });
      } catch (error) {
        this.emit('error', {
          type: 'scheduled-report-failed',
          error: error.message,
          timestamp: this.getDeterministicDate()
        });
      }
    }, this.config.export.reportInterval);
  }
  
  async _collectMetricsFromSources() {
    for (const [sourceName, connector] of this.connectors) {
      try {
        if (connector.getMetrics) {
          const metrics = await connector.getMetrics();
          this.updateMetrics(sourceName, metrics);
        }
      } catch (error) {
        this.emit('error', {
          type: 'data-collection-failed',
          source: sourceName,
          error: error.message,
          timestamp: this.getDeterministicDate()
        });
      }
    }
  }
  
  _updateRealTimeMetrics(sourceName, metricsData, timestamp) {
    // Update component-specific metrics
    if (!this.metrics.realTime.components[sourceName]) {
      this.metrics.realTime.components[sourceName] = {};
    }
    
    Object.assign(this.metrics.realTime.components[sourceName], metricsData);
    
    // Update aggregated metrics
    if (metricsData.security) {
      Object.assign(this.metrics.realTime.security, metricsData.security);
    }
    
    if (metricsData.performance) {
      Object.assign(this.metrics.realTime.performance, metricsData.performance);
    }
    
    if (metricsData.compliance) {
      Object.assign(this.metrics.realTime.compliance, metricsData.compliance);
    }
    
    this.metrics.realTime.timestamp = timestamp;
  }
  
  _addToTimeSeries(sourceName, metricsData, timestamp) {
    const dataPoint = {
      timestamp,
      source: sourceName,
      ...metricsData
    };
    
    // Add to appropriate time series
    if (metricsData.security) {
      this.metrics.timeSeries.security.push({
        timestamp,
        ...metricsData.security
      });
    }
    
    if (metricsData.performance) {
      this.metrics.timeSeries.performance.push({
        timestamp,
        ...metricsData.performance
      });
    }
    
    if (metricsData.compliance) {
      this.metrics.timeSeries.compliance.push({
        timestamp,
        ...metricsData.compliance
      });
    }
    
    // Component-specific time series
    if (!this.metrics.timeSeries.components[sourceName]) {
      this.metrics.timeSeries.components[sourceName] = [];
    }
    
    this.metrics.timeSeries.components[sourceName].push(dataPoint);
    
    // Maintain size limits
    this._trimTimeSeries();
  }
  
  _trimTimeSeries() {
    const maxPoints = this.config.maxDataPoints;
    
    ['security', 'performance', 'compliance'].forEach(series => {
      if (this.metrics.timeSeries[series].length > maxPoints) {
        this.metrics.timeSeries[series] = this.metrics.timeSeries[series].slice(-maxPoints);
      }
    });
    
    Object.keys(this.metrics.timeSeries.components).forEach(component => {
      const series = this.metrics.timeSeries.components[component];
      if (series.length > maxPoints) {
        this.metrics.timeSeries.components[component] = series.slice(-maxPoints);
      }
    });
  }
  
  _checkAlertConditions(sourceName, metricsData) {
    for (const [ruleName, rule] of this.alerts.rules) {
      if (!rule.enabled) continue;
      
      try {
        const shouldTrigger = this._evaluateAlertCondition(rule, sourceName, metricsData);
        
        if (shouldTrigger) {
          // Check cooldown period
          const now = this.getDeterministicTimestamp();
          const cooldownExpired = !rule.lastTriggered || 
            (now - rule.lastTriggered.getTime()) > rule.cooldown;
          
          if (cooldownExpired) {
            const alertData = {
              type: 'rule-triggered',
              severity: rule.severity,
              message: `Alert rule triggered: ${ruleName}`,
              details: {
                rule: ruleName,
                condition: rule.condition,
                source: sourceName,
                metrics: metricsData
              }
            };
            
            this.processAlert(sourceName, alertData);
            
            rule.lastTriggered = new Date(now);
            rule.triggerCount++;
          }
        }
      } catch (error) {
        this.emit('error', {
          type: 'alert-evaluation-failed',
          rule: ruleName,
          source: sourceName,
          error: error.message,
          timestamp: this.getDeterministicDate()
        });
      }
    }
  }
  
  _evaluateAlertCondition(rule, sourceName, metricsData) {
    // Simple condition evaluation - can be extended with a proper expression evaluator
    const condition = rule.condition.toLowerCase();
    
    if (condition.includes('threat_level >= high')) {
      return metricsData.security?.threatLevel === 'high' || metricsData.security?.threatLevel === 'critical';
    }
    
    if (condition.includes('error_rate >')) {
      const threshold = rule.threshold || 0.1;
      return (metricsData.performance?.errorRate || 0) > threshold;
    }
    
    if (condition.includes('availability <')) {
      const threshold = rule.threshold || 0.95;
      return (metricsData.performance?.availability || 1) < threshold;
    }
    
    if (condition.includes('component_healthy = false')) {
      return metricsData.healthy === false;
    }
    
    return false;
  }
  
  _generateAlertId(source, alertData) {
    const content = `${source}-${alertData.type}-${this.getDeterministicTimestamp()}`;
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }
  
  _updateThreatLevel() {
    const activeAlerts = Array.from(this.alerts.active.values());
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const highAlerts = activeAlerts.filter(a => a.severity === 'high');
    const mediumAlerts = activeAlerts.filter(a => a.severity === 'medium');
    
    let threatLevel = 'low';
    
    if (criticalAlerts.length > 0) {
      threatLevel = 'critical';
    } else if (highAlerts.length > 2) {
      threatLevel = 'high';
    } else if (highAlerts.length > 0 || mediumAlerts.length > 5) {
      threatLevel = 'medium';
    }
    
    this.metrics.realTime.security.threatLevel = threatLevel;
  }
  
  _getThreatLevelValue(level) {
    const levels = { low: 1, medium: 2, high: 4, critical: 5 };
    return levels[level] || 0;
  }
  
  _parseTimeRange(timeRange) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000
    };
    
    const match = timeRange.match(/^(\d+)([mhdw])$/);
    if (match) {
      const [, value, unit] = match;
      return parseInt(value) * units[unit];
    }
    
    return 3600000; // Default 1 hour
  }
  
  _getTimeSeriesData(fromTime, toTime) {
    const filterByTime = (series) => series.filter(
      point => point.timestamp >= fromTime && point.timestamp <= toTime
    );
    
    return {
      security: filterByTime(this.metrics.timeSeries.security),
      performance: filterByTime(this.metrics.timeSeries.performance),
      compliance: filterByTime(this.metrics.timeSeries.compliance),
      components: Object.fromEntries(
        Object.entries(this.metrics.timeSeries.components).map(
          ([name, series]) => [name, filterByTime(series)]
        )
      )
    };
  }
  
  _getWidgetData(requestedWidgets) {
    const widgets = {};
    
    const widgetsToInclude = requestedWidgets.length > 0 
      ? requestedWidgets 
      : Array.from(this.widgets.keys());
    
    widgetsToInclude.forEach(widgetName => {
      const widget = this.widgets.get(widgetName);
      if (widget) {
        widgets[widgetName] = {
          ...widget,
          data: widget.getData(this.metrics)
        };
      }
    });
    
    return widgets;
  }
  
  _getChartData(timeRange) {
    const charts = {};
    
    this.chartConfigs.forEach((config, chartName) => {
      charts[chartName] = {
        ...config,
        data: config.data()
      };
    });
    
    return charts;
  }
  
  _getActiveAlerts() {
    return Array.from(this.alerts.active.values());
  }
  
  _generateSummary(timeRange) {
    const timeRangeMs = this._parseTimeRange(timeRange);
    const fromTime = this.getDeterministicTimestamp() - timeRangeMs;
    
    const recentAlerts = this.alerts.history.filter(
      alert => alert.timestamp.getTime() >= fromTime
    );
    
    return {
      timeRange,
      threatLevel: this.metrics.realTime.security.threatLevel,
      activeThreats: this.metrics.realTime.security.activeThreats,
      alertsInPeriod: recentAlerts.length,
      averageResponseTime: this.metrics.realTime.performance.averageResponseTime,
      availability: this.metrics.realTime.performance.availability,
      complianceScore: this.metrics.realTime.compliance.overallScore,
      healthyComponents: Object.values(this.metrics.realTime.components)
        .filter(c => c.healthy).length,
      totalComponents: Object.keys(this.metrics.realTime.components).length
    };
  }
  
  _countTotalDataPoints() {
    let total = 0;
    total += this.metrics.timeSeries.security.length;
    total += this.metrics.timeSeries.performance.length;
    total += this.metrics.timeSeries.compliance.length;
    
    Object.values(this.metrics.timeSeries.components).forEach(series => {
      total += series.length;
    });
    
    return total;
  }
  
  _estimateMemoryUsage() {
    // Rough estimation of memory usage
    const jsonString = JSON.stringify(this.metrics);
    return jsonString.length * 2; // Approximate bytes
  }
  
  _calculateUpdateLatency() {
    const now = this.getDeterministicTimestamp();
    const lastUpdate = this.metrics.dashboard.lastUpdate?.getTime() || now;
    return now - lastUpdate;
  }
}

export default SecurityMetricsDashboard;