/**
 * Compliance Dashboard System
 * Real-time monitoring and visualization of compliance metrics
 */

class ComplianceDashboard {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      refreshInterval: config.refreshInterval || 300000, // 5 minutes
      alertThresholds: {
        controlFailures: 5,
        overdueTests: 10,
        complianceScore: 85,
        ...config.alertThresholds
      },
      ...config
    };
    
    this.metrics = new Map();
    this.alerts = new Map();
    this.widgets = new Map();
    this.subscriptions = new Map();
    this.historicalData = new Map();
    
    this.initializeDashboardWidgets();
    this.startDataCollection();
  }

  /**
   * Initialize dashboard widgets
   */
  initializeDashboardWidgets() {
    // GDPR Compliance Widget
    this.addWidget('gdpr_compliance', {
      title: 'GDPR Compliance Status',
      type: 'scorecard',
      category: 'privacy',
      priority: 'high',
      refreshRate: 300000, // 5 minutes
      dataSource: 'gdpr_controller',
      metrics: [
        'consent_rate',
        'data_subject_requests',
        'retention_compliance',
        'breach_incidents'
      ],
      alerts: {
        consent_rate: { threshold: 95, operator: '<', severity: 'medium' },
        breach_incidents: { threshold: 0, operator: '>', severity: 'critical' }
      }
    });

    // CCPA Compliance Widget
    this.addWidget('ccpa_compliance', {
      title: 'CCPA Compliance Status',
      type: 'scorecard',
      category: 'privacy',
      priority: 'high',
      refreshRate: 300000,
      dataSource: 'ccpa_controller',
      metrics: [
        'opt_out_rate',
        'verification_success_rate',
        'response_time',
        'deletion_compliance'
      ],
      alerts: {
        response_time: { threshold: 45, operator: '>', severity: 'medium' },
        deletion_compliance: { threshold: 95, operator: '<', severity: 'high' }
      }
    });

    // SOC 2 Controls Widget
    this.addWidget('soc2_controls', {
      title: 'SOC 2 Controls Status',
      type: 'control_matrix',
      category: 'security',
      priority: 'critical',
      refreshRate: 600000, // 10 minutes
      dataSource: 'soc2_framework',
      metrics: [
        'controls_implemented',
        'controls_tested',
        'test_pass_rate',
        'exceptions_count',
        'overdue_tests'
      ],
      alerts: {
        test_pass_rate: { threshold: 95, operator: '<', severity: 'high' },
        overdue_tests: { threshold: 5, operator: '>', severity: 'medium' }
      }
    });

    // Audit Trail Widget
    this.addWidget('audit_activity', {
      title: 'Audit Activity Monitor',
      type: 'timeline',
      category: 'auditing',
      priority: 'medium',
      refreshRate: 60000, // 1 minute
      dataSource: 'audit_trail',
      metrics: [
        'events_per_hour',
        'critical_events',
        'failed_events',
        'integrity_status'
      ],
      alerts: {
        critical_events: { threshold: 10, operator: '>', severity: 'high' },
        integrity_status: { threshold: 'verified', operator: '!=', severity: 'critical' }
      }
    });

    // Data Retention Widget
    this.addWidget('data_retention', {
      title: 'Data Retention Management',
      type: 'progress_tracker',
      category: 'data_management',
      priority: 'medium',
      refreshRate: 3600000, // 1 hour
      dataSource: 'retention_manager',
      metrics: [
        'retention_compliance',
        'overdue_deletions',
        'legal_holds',
        'archived_data'
      ],
      alerts: {
        overdue_deletions: { threshold: 50, operator: '>', severity: 'medium' },
        retention_compliance: { threshold: 95, operator: '<', severity: 'high' }
      }
    });

    // Risk Assessment Widget
    this.addWidget('risk_assessment', {
      title: 'Compliance Risk Overview',
      type: 'heatmap',
      category: 'risk',
      priority: 'high',
      refreshRate: 1800000, // 30 minutes
      dataSource: 'risk_assessor',
      metrics: [
        'overall_risk_score',
        'high_risk_areas',
        'risk_trends',
        'mitigation_progress'
      ],
      alerts: {
        overall_risk_score: { threshold: 7, operator: '>', severity: 'high' },
        high_risk_areas: { threshold: 3, operator: '>', severity: 'medium' }
      }
    });

    // Compliance Score Widget
    this.addWidget('compliance_score', {
      title: 'Overall Compliance Score',
      type: 'gauge',
      category: 'overview',
      priority: 'critical',
      refreshRate: 300000,
      dataSource: 'composite',
      metrics: [
        'overall_score',
        'score_trend',
        'category_scores',
        'improvement_areas'
      ],
      alerts: {
        overall_score: { threshold: 85, operator: '<', severity: 'high' }
      }
    });
  }

  /**
   * Add a widget to the dashboard
   */
  addWidget(widgetId, widgetConfig) {
    const widget = {
      id: widgetId,
      ...widgetConfig,
      status: 'active',
      lastUpdated: null,
      data: null,
      errors: [],
      createdAt: this.getDeterministicDate().toISOString()
    };

    this.widgets.set(widgetId, widget);
    
    // Initialize metrics storage for this widget
    this.metrics.set(widgetId, new Map());
    this.historicalData.set(widgetId, []);

    return widgetId;
  }

  /**
   * Start automated data collection
   */
  startDataCollection() {
    // Collect data for all widgets
    this.collectAllData();

    // Set up refresh intervals
    for (const widget of this.widgets.values()) {
      setInterval(() => {
        this.updateWidgetData(widget.id);
      }, widget.refreshRate);
    }

    // Set up master refresh interval
    setInterval(() => {
      this.collectAllData();
      this.processAlerts();
      this.updateTrends();
    }, this.config.refreshInterval);
  }

  /**
   * Collect data for all widgets
   */
  collectAllData() {
    for (const widget of this.widgets.values()) {
      try {
        this.updateWidgetData(widget.id);
      } catch (error) {
        this.handleWidgetError(widget.id, error);
      }
    }
  }

  /**
   * Update data for a specific widget
   */
  updateWidgetData(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget || widget.status !== 'active') return;

    let data;

    switch (widget.dataSource) {
      case 'gdpr_controller':
        data = this.collectGDPRData();
        break;
      case 'ccpa_controller':
        data = this.collectCCPAData();
        break;
      case 'soc2_framework':
        data = this.collectSOC2Data();
        break;
      case 'audit_trail':
        data = this.collectAuditData();
        break;
      case 'retention_manager':
        data = this.collectRetentionData();
        break;
      case 'risk_assessor':
        data = this.collectRiskData();
        break;
      case 'composite':
        data = this.collectCompositeData();
        break;
      default:
        data = this.collectGenericData(widget.dataSource);
    }

    // Update widget
    widget.data = data;
    widget.lastUpdated = this.getDeterministicDate().toISOString();
    widget.errors = [];

    // Store metrics
    const widgetMetrics = this.metrics.get(widgetId);
    for (const metric of widget.metrics) {
      if (data[metric] !== undefined) {
        widgetMetrics.set(metric, {
          value: data[metric],
          timestamp: this.getDeterministicDate().toISOString(),
          trend: this.calculateTrend(widgetId, metric, data[metric])
        });
      }
    }

    // Store historical data
    const historical = this.historicalData.get(widgetId);
    historical.push({
      timestamp: this.getDeterministicDate().toISOString(),
      data: { ...data }
    });

    // Keep only last 100 data points
    if (historical.length > 100) {
      historical.shift();
    }

    // Check alerts
    this.checkWidgetAlerts(widgetId);
  }

  /**
   * Collect GDPR compliance data
   */
  collectGDPRData() {
    // In real implementation, would integrate with GDPR controller
    return {
      consent_rate: 96.5,
      data_subject_requests: 42,
      retention_compliance: 94.2,
      breach_incidents: 0,
      active_consents: 15420,
      withdrawn_consents: 340,
      erasure_requests: 12,
      access_requests: 28,
      portability_requests: 2
    };
  }

  /**
   * Collect CCPA compliance data
   */
  collectCCPAData() {
    // In real implementation, would integrate with CCPA controller
    return {
      opt_out_rate: 8.3,
      verification_success_rate: 97.8,
      response_time: 28, // days
      deletion_compliance: 98.1,
      total_consumers: 8920,
      opted_out_consumers: 741,
      deletion_requests: 34,
      know_requests: 156,
      sales_stopped: 28
    };
  }

  /**
   * Collect SOC 2 controls data
   */
  collectSOC2Data() {
    // In real implementation, would integrate with SOC 2 framework
    return {
      controls_implemented: 47,
      controls_tested: 43,
      test_pass_rate: 95.3,
      exceptions_count: 3,
      overdue_tests: 4,
      total_controls: 50,
      remediation_plans: 2,
      evidence_collected: 156
    };
  }

  /**
   * Collect audit trail data
   */
  collectAuditData() {
    // In real implementation, would integrate with audit trail
    const now = this.getDeterministicDate();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    
    return {
      events_per_hour: 324,
      critical_events: 2,
      failed_events: 8,
      integrity_status: 'verified',
      total_events: 45623,
      categories: {
        authentication: 128,
        data_access: 89,
        system_changes: 34,
        compliance: 12
      }
    };
  }

  /**
   * Collect data retention data
   */
  collectRetentionData() {
    // In real implementation, would integrate with retention manager
    return {
      retention_compliance: 96.7,
      overdue_deletions: 23,
      legal_holds: 4,
      archived_data: 1240,
      total_data_records: 58920,
      deletion_queue: 23,
      processed_today: 45
    };
  }

  /**
   * Collect risk assessment data
   */
  collectRiskData() {
    // In real implementation, would integrate with risk assessor
    return {
      overall_risk_score: 6.2,
      high_risk_areas: 2,
      risk_trends: 'improving',
      mitigation_progress: 78.4,
      risk_categories: {
        data_privacy: 5.8,
        security: 6.4,
        operational: 4.2,
        regulatory: 7.1
      }
    };
  }

  /**
   * Collect composite compliance score data
   */
  collectCompositeData() {
    const gdpr = this.collectGDPRData();
    const ccpa = this.collectCCPAData();
    const soc2 = this.collectSOC2Data();
    const retention = this.collectRetentionData();

    // Calculate weighted composite score
    const weights = {
      gdpr: 0.3,
      ccpa: 0.2,
      soc2: 0.3,
      retention: 0.2
    };

    const scores = {
      gdpr: gdpr.consent_rate * (gdpr.retention_compliance / 100),
      ccpa: ccpa.verification_success_rate * (ccpa.deletion_compliance / 100),
      soc2: soc2.test_pass_rate,
      retention: retention.retention_compliance
    };

    const overall_score = Object.keys(weights).reduce((sum, key) => {
      return sum + (scores[key] * weights[key]);
    }, 0);

    return {
      overall_score: Math.round(overall_score * 100) / 100,
      score_trend: this.calculateScoreTrend(overall_score),
      category_scores: scores,
      improvement_areas: this.identifyImprovementAreas(scores)
    };
  }

  /**
   * Calculate trend for a metric
   */
  calculateTrend(widgetId, metric, currentValue) {
    const historical = this.historicalData.get(widgetId);
    if (!historical || historical.length < 2) return 'stable';

    const previous = historical[historical.length - 2];
    if (!previous || !previous.data[metric]) return 'stable';

    const previousValue = previous.data[metric];
    const change = ((currentValue - previousValue) / previousValue) * 100;

    if (Math.abs(change) < 1) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate score trend
   */
  calculateScoreTrend(currentScore) {
    // In real implementation, would compare with historical scores
    return 'improving';
  }

  /**
   * Identify improvement areas
   */
  identifyImprovementAreas(scores) {
    const threshold = 90;
    return Object.keys(scores).filter(area => scores[area] < threshold);
  }

  /**
   * Check alerts for a widget
   */
  checkWidgetAlerts(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget.alerts || !widget.data) return;

    for (const [metric, alertConfig] of Object.entries(widget.alerts)) {
      const value = widget.data[metric];
      if (value === undefined) continue;

      const triggered = this.evaluateAlertCondition(value, alertConfig);
      
      if (triggered) {
        this.triggerAlert(widgetId, metric, value, alertConfig);
      } else {
        this.resolveAlert(widgetId, metric);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  evaluateAlertCondition(value, alertConfig) {
    const { threshold, operator } = alertConfig;

    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value == threshold;
      case '!=':
        return value != threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(widgetId, metric, value, alertConfig) {
    const alertId = `${widgetId}_${metric}`;
    
    if (this.alerts.has(alertId)) {
      // Update existing alert
      const alert = this.alerts.get(alertId);
      alert.lastTriggered = this.getDeterministicDate().toISOString();
      alert.currentValue = value;
      alert.occurrences++;
    } else {
      // Create new alert
      const alert = {
        id: alertId,
        widgetId,
        metric,
        severity: alertConfig.severity,
        threshold: alertConfig.threshold,
        operator: alertConfig.operator,
        currentValue: value,
        firstTriggered: this.getDeterministicDate().toISOString(),
        lastTriggered: this.getDeterministicDate().toISOString(),
        status: 'active',
        occurrences: 1,
        acknowledged: false
      };

      this.alerts.set(alertId, alert);
      this.sendAlertNotification(alert);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(widgetId, metric) {
    const alertId = `${widgetId}_${metric}`;
    const alert = this.alerts.get(alertId);
    
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = this.getDeterministicDate().toISOString();
      this.sendAlertResolution(alert);
    }
  }

  /**
   * Send alert notification
   */
  sendAlertNotification(alert) {
    // In real implementation, would send to notification system
    console.log('[COMPLIANCE ALERT]', {
      severity: alert.severity,
      metric: alert.metric,
      value: alert.currentValue,
      threshold: alert.threshold,
      timestamp: alert.lastTriggered
    });
  }

  /**
   * Send alert resolution notification
   */
  sendAlertResolution(alert) {
    console.log('[COMPLIANCE ALERT RESOLVED]', {
      metric: alert.metric,
      resolvedAt: alert.resolvedAt
    });
  }

  /**
   * Process all alerts
   */
  processAlerts() {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active');

    // Escalate critical alerts that haven't been acknowledged
    const criticalAlerts = activeAlerts
      .filter(alert => alert.severity === 'critical' && !alert.acknowledged);

    if (criticalAlerts.length > 0) {
      this.escalateCriticalAlerts(criticalAlerts);
    }

    // Clean up old resolved alerts
    this.cleanupResolvedAlerts();
  }

  /**
   * Escalate critical alerts
   */
  escalateCriticalAlerts(alerts) {
    for (const alert of alerts) {
      // In real implementation, would send to escalation system
      console.log('[CRITICAL ALERT ESCALATION]', {
        alertId: alert.id,
        metric: alert.metric,
        duration: this.getDeterministicTimestamp() - new Date(alert.firstTriggered).getTime()
      });
    }
  }

  /**
   * Clean up old resolved alerts
   */
  cleanupResolvedAlerts() {
    const cutoffDate = new Date(this.getDeterministicTimestamp() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && 
          alert.resolvedAt && 
          new Date(alert.resolvedAt) < cutoffDate) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * Update trends
   */
  updateTrends() {
    for (const [widgetId, widget] of this.widgets.entries()) {
      if (!widget.data) continue;

      const metrics = this.metrics.get(widgetId);
      for (const metric of widget.metrics) {
        const current = metrics.get(metric);
        if (current) {
          current.trend = this.calculateTrend(widgetId, metric, current.value);
        }
      }
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    const dashboardData = {
      timestamp: this.getDeterministicDate().toISOString(),
      organization: this.config.organizationName,
      widgets: {},
      alerts: {
        active: Array.from(this.alerts.values()).filter(a => a.status === 'active'),
        critical: Array.from(this.alerts.values()).filter(a => a.severity === 'critical' && a.status === 'active'),
        total: this.alerts.size
      },
      summary: this.generateDashboardSummary()
    };

    // Include widget data
    for (const [widgetId, widget] of this.widgets.entries()) {
      dashboardData.widgets[widgetId] = {
        ...widget,
        metrics: Object.fromEntries(this.metrics.get(widgetId) || new Map()),
        historical: this.historicalData.get(widgetId) || []
      };
    }

    return dashboardData;
  }

  /**
   * Generate dashboard summary
   */
  generateDashboardSummary() {
    const compositeData = this.collectCompositeData();
    const activeAlerts = Array.from(this.alerts.values()).filter(a => a.status === 'active');
    
    return {
      overallComplianceScore: compositeData.overall_score,
      scoreTrend: compositeData.score_trend,
      activeAlertsCount: activeAlerts.length,
      criticalAlertsCount: activeAlerts.filter(a => a.severity === 'critical').length,
      widgetsActive: Array.from(this.widgets.values()).filter(w => w.status === 'active').length,
      lastUpdated: this.getDeterministicDate().toISOString(),
      status: this.getDashboardStatus()
    };
  }

  /**
   * Get overall dashboard status
   */
  getDashboardStatus() {
    const compositeData = this.collectCompositeData();
    const criticalAlerts = Array.from(this.alerts.values())
      .filter(a => a.severity === 'critical' && a.status === 'active').length;

    if (criticalAlerts > 0) return 'critical';
    if (compositeData.overall_score < this.config.alertThresholds.complianceScore) return 'warning';
    return 'healthy';
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = this.getDeterministicDate().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Export dashboard data
   */
  exportDashboard(format = 'json') {
    const data = this.getDashboardData();
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Convert dashboard data to CSV
   */
  convertToCSV(data) {
    const rows = [];
    
    // Headers
    rows.push('Widget,Metric,Value,Trend,Timestamp');
    
    // Data rows
    for (const [widgetId, widget] of Object.entries(data.widgets)) {
      for (const [metric, metricData] of Object.entries(widget.metrics)) {
        rows.push([
          widgetId,
          metric,
          metricData.value,
          metricData.trend,
          metricData.timestamp
        ].join(','));
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Handle widget errors
   */
  handleWidgetError(widgetId, error) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      widget.errors.push({
        message: error.message,
        timestamp: this.getDeterministicDate().toISOString(),
        stack: error.stack
      });
      
      // Keep only last 10 errors
      if (widget.errors.length > 10) {
        widget.errors.shift();
      }
      
      console.error(`[Dashboard Widget Error] ${widgetId}:`, error.message);
    }
  }
}

module.exports = ComplianceDashboard;