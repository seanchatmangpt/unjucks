/**
 * Compliance Framework Main Entry Point
 * Orchestrates all compliance modules and provides unified API
 */

const GDPRDataController = require('./gdpr/data-controller');
const CCPAPrivacyController = require('./ccpa/privacy-controller');
const SOC2ControlsFramework = require('./soc2/controls-framework');
const AuditTrail = require('./audits/audit-trail');
const DataRetentionManager = require('./retention/data-retention-manager');
const ComplianceDashboard = require('./dashboards/compliance-dashboard');
const ComplianceAutomation = require('./scripts/compliance-automation');
const ComplianceRiskAssessor = require('./risk-assessment/compliance-risk-assessor');
const ComplianceReporter = require('./reports/compliance-reporter');

class ComplianceFramework {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      enabledModules: config.enabledModules || ['gdpr', 'ccpa', 'soc2', 'audit', 'retention'],
      automationEnabled: config.automationEnabled || true,
      dashboardEnabled: config.dashboardEnabled || true,
      reportingEnabled: config.reportingEnabled || true,
      ...config
    };

    this.modules = {};
    this.status = {
      initialized: false,
      lastHealthCheck: null,
      moduleStatuses: {},
      overallHealth: 'unknown'
    };

    this.initializeModules();
  }

  /**
   * Initialize all compliance modules
   */
  initializeModules() {
    try {
      // Initialize core compliance modules
      if (this.config.enabledModules.includes('gdpr')) {
        this.modules.gdpr = new GDPRDataController({
          organizationName: this.config.organizationName,
          ...this.config.gdpr
        });
      }

      if (this.config.enabledModules.includes('ccpa')) {
        this.modules.ccpa = new CCPAPrivacyController({
          businessName: this.config.organizationName,
          ...this.config.ccpa
        });
      }

      if (this.config.enabledModules.includes('soc2')) {
        this.modules.soc2 = new SOC2ControlsFramework({
          organizationName: this.config.organizationName,
          ...this.config.soc2
        });
      }

      if (this.config.enabledModules.includes('audit')) {
        this.modules.audit = new AuditTrail({
          organizationName: this.config.organizationName,
          ...this.config.audit
        });
      }

      if (this.config.enabledModules.includes('retention')) {
        this.modules.retention = new DataRetentionManager({
          organizationName: this.config.organizationName,
          ...this.config.retention
        });
      }

      // Initialize risk assessment
      this.modules.risk = new ComplianceRiskAssessor({
        organizationName: this.config.organizationName,
        ...this.config.risk
      });

      // Initialize dashboard
      if (this.config.dashboardEnabled) {
        this.modules.dashboard = new ComplianceDashboard({
          organizationName: this.config.organizationName,
          ...this.config.dashboard
        });
      }

      // Initialize automation
      if (this.config.automationEnabled) {
        this.modules.automation = new ComplianceAutomation({
          organizationName: this.config.organizationName,
          ...this.config.automation
        });
        
        // Set dependencies for automation
        this.modules.automation.setDependencies(this.modules);
      }

      // Initialize reporting
      if (this.config.reportingEnabled) {
        this.modules.reporter = new ComplianceReporter({
          organizationName: this.config.organizationName,
          ...this.config.reporting
        });
        
        // Set dependencies for reporting
        this.modules.reporter.setDependencies(this.modules);
      }

      this.status.initialized = true;
      this.logEvent('framework_initialized', {
        modules: Object.keys(this.modules),
        enabledModules: this.config.enabledModules
      });

    } catch (error) {
      this.status.initialized = false;
      this.logEvent('framework_initialization_failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get framework status
   */
  getStatus() {
    return {
      ...this.status,
      modules: Object.keys(this.modules),
      config: {
        organizationName: this.config.organizationName,
        enabledModules: this.config.enabledModules,
        automationEnabled: this.config.automationEnabled,
        dashboardEnabled: this.config.dashboardEnabled,
        reportingEnabled: this.config.reportingEnabled
      }
    };
  }

  /**
   * Perform health check on all modules
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: this.getDeterministicDate().toISOString(),
      overallHealth: 'healthy',
      modules: {},
      issues: [],
      recommendations: []
    };

    for (const [moduleName, module] of Object.entries(this.modules)) {
      try {
        const moduleHealth = await this.checkModuleHealth(moduleName, module);
        healthCheck.modules[moduleName] = moduleHealth;

        if (moduleHealth.status !== 'healthy') {
          healthCheck.overallHealth = 'degraded';
          healthCheck.issues.push({
            module: moduleName,
            issue: moduleHealth.issue,
            severity: moduleHealth.severity || 'medium'
          });
        }
      } catch (error) {
        healthCheck.modules[moduleName] = {
          status: 'error',
          error: error.message,
          lastChecked: this.getDeterministicDate().toISOString()
        };
        healthCheck.overallHealth = 'unhealthy';
        healthCheck.issues.push({
          module: moduleName,
          issue: `Health check failed: ${error.message}`,
          severity: 'high'
        });
      }
    }

    // Generate recommendations based on issues
    healthCheck.recommendations = this.generateHealthRecommendations(healthCheck.issues);

    this.status.lastHealthCheck = healthCheck.timestamp;
    this.status.overallHealth = healthCheck.overallHealth;
    this.status.moduleStatuses = healthCheck.modules;

    this.logEvent('health_check_completed', {
      overallHealth: healthCheck.overallHealth,
      issueCount: healthCheck.issues.length,
      modulesChecked: Object.keys(healthCheck.modules).length
    });

    return healthCheck;
  }

  /**
   * Check health of individual module
   */
  async checkModuleHealth(moduleName, module) {
    const health = {
      status: 'healthy',
      lastChecked: this.getDeterministicDate().toISOString(),
      metrics: {}
    };

    switch (moduleName) {
      case 'gdpr':
        const gdprReport = module.generateComplianceReport();
        health.metrics = {
          consentRate: gdprReport.summary.consentWithdrawalRate,
          dataSubjectRequests: gdprReport.dataSubjectRights.accessRequests
        };
        if (gdprReport.summary.consentWithdrawalRate > 15) {
          health.status = 'warning';
          health.issue = 'High consent withdrawal rate';
        }
        break;

      case 'ccpa':
        const ccpaReport = module.generateComplianceReport();
        health.metrics = {
          optOutRate: ccpaReport.summary.optOutRate,
          responseTime: ccpaReport.compliance.averageResponseTime
        };
        if (ccpaReport.compliance.averageResponseTime > 45) {
          health.status = 'warning';
          health.issue = 'Response time exceeds regulatory requirements';
        }
        break;

      case 'soc2':
        const soc2Assessment = module.generateReadinessAssessment();
        health.metrics = {
          readinessScore: soc2Assessment.readinessScore,
          gaps: soc2Assessment.gaps.length
        };
        if (soc2Assessment.readinessScore < 80) {
          health.status = 'warning';
          health.issue = 'SOC 2 readiness below acceptable threshold';
        }
        break;

      case 'audit':
        const auditIntegrity = module.verifyIntegrity();
        health.metrics = {
          totalEvents: auditIntegrity.totalEvents,
          integrityVerified: auditIntegrity.verified
        };
        if (!auditIntegrity.verified) {
          health.status = 'error';
          health.issue = 'Audit trail integrity compromised';
          health.severity = 'critical';
        }
        break;

      case 'retention':
        const retentionReport = module.generateInventoryReport();
        health.metrics = {
          totalDataRecords: retentionReport.summary.totalDataRecords,
          overdueRetentions: retentionReport.summary.upcomingDeletions
        };
        if (retentionReport.summary.upcomingDeletions > 100) {
          health.status = 'warning';
          health.issue = 'High number of overdue data retention actions';
        }
        break;

      case 'risk':
        const riskDashboard = module.getRiskDashboard();
        health.metrics = {
          overallRiskScore: riskDashboard.overallRiskScore,
          highRiskFactors: riskDashboard.highRiskFactors.length
        };
        if (riskDashboard.overallRiskScore > 7) {
          health.status = 'warning';
          health.issue = 'High overall compliance risk';
        }
        break;

      case 'automation':
        const automationStatus = module.getAutomationStatus();
        health.metrics = {
          activeRules: automationStatus.activeRules,
          successRate: automationStatus.successRate
        };
        if (automationStatus.successRate < 90) {
          health.status = 'warning';
          health.issue = 'Automation success rate below threshold';
        }
        break;

      case 'dashboard':
        const dashboardData = module.getDashboardData();
        health.metrics = {
          activeWidgets: dashboardData.summary.widgetsActive,
          activeAlerts: dashboardData.alerts.active.length
        };
        if (dashboardData.alerts.critical.length > 0) {
          health.status = 'warning';
          health.issue = 'Critical dashboard alerts active';
        }
        break;

      default:
        health.status = 'unknown';
        health.issue = 'Health check not implemented for this module';
    }

    return health;
  }

  /**
   * Generate health recommendations
   */
  generateHealthRecommendations(issues) {
    const recommendations = [];

    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        recommendation: 'Address critical compliance issues immediately',
        modules: criticalIssues.map(issue => issue.module)
      });
    }

    const highIssues = issues.filter(issue => issue.severity === 'high');
    if (highIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        recommendation: 'Review and remediate high-priority compliance issues',
        modules: highIssues.map(issue => issue.module)
      });
    }

    if (issues.length > 5) {
      recommendations.push({
        priority: 'medium',
        recommendation: 'Consider comprehensive compliance program review',
        reason: 'Multiple modules showing issues'
      });
    }

    return recommendations;
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(templateId = 'detailed_compliance') {
    if (!this.modules.reporter) {
      throw new Error('Reporting module not enabled');
    }

    return await this.modules.reporter.generateReport(templateId, {
      generatedBy: 'compliance_framework'
    });
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    if (!this.modules.dashboard) {
      throw new Error('Dashboard module not enabled');
    }

    return this.modules.dashboard.getDashboardData();
  }

  /**
   * Conduct risk assessment
   */
  conductRiskAssessment() {
    return this.modules.risk.conductRiskAssessment();
  }

  /**
   * Process data retention schedule
   */
  processDataRetention() {
    if (!this.modules.retention) {
      throw new Error('Data retention module not enabled');
    }

    return this.modules.retention.processRetentionSchedule();
  }

  /**
   * Log audit event
   */
  logAuditEvent(category, eventType, details = {}) {
    if (!this.modules.audit) {
      throw new Error('Audit module not enabled');
    }

    return this.modules.audit.logEvent(category, eventType, details);
  }

  /**
   * Handle GDPR data subject request
   */
  handleGDPRRequest(requestType, dataSubjectId, requestDetails = {}) {
    if (!this.modules.gdpr) {
      throw new Error('GDPR module not enabled');
    }

    switch (requestType) {
      case 'access':
        return this.modules.gdpr.handleAccessRequest(dataSubjectId);
      case 'erasure':
        return this.modules.gdpr.handleErasureRequest(dataSubjectId, requestDetails.reason);
      case 'portability':
        return this.modules.gdpr.handlePortabilityRequest(dataSubjectId, requestDetails.format);
      default:
        throw new Error(`Unsupported GDPR request type: ${requestType}`);
    }
  }

  /**
   * Handle CCPA consumer request
   */
  handleCCPARequest(requestType, consumerId, verificationData = {}) {
    if (!this.modules.ccpa) {
      throw new Error('CCPA module not enabled');
    }

    switch (requestType) {
      case 'know':
        return this.modules.ccpa.handleRightToKnowRequest(consumerId, 'categories', verificationData);
      case 'delete':
        return this.modules.ccpa.handleRightToDeleteRequest(consumerId, verificationData);
      case 'opt_out':
        return this.modules.ccpa.handleOptOutRequest(consumerId, verificationData);
      default:
        throw new Error(`Unsupported CCPA request type: ${requestType}`);
    }
  }

  /**
   * Execute SOC 2 control test
   */
  executeSOC2ControlTest(controlId, testDetails = {}) {
    if (!this.modules.soc2) {
      throw new Error('SOC 2 module not enabled');
    }

    return this.modules.soc2.executeControlTest(controlId, testDetails);
  }

  /**
   * Get compliance metrics summary
   */
  getComplianceMetrics() {
    const metrics = {
      timestamp: this.getDeterministicDate().toISOString(),
      organization: this.config.organizationName,
      modules: {}
    };

    // Collect metrics from each module
    if (this.modules.gdpr) {
      const gdprReport = this.modules.gdpr.generateComplianceReport();
      metrics.modules.gdpr = {
        consentWithdrawalRate: gdprReport.summary.consentWithdrawalRate,
        dataSubjectRequests: gdprReport.dataSubjectRights.accessRequests + gdprReport.dataSubjectRights.erasureRequests,
        retentionCompliance: gdprReport.compliance.dataRetentionCompliance.complianceRate
      };
    }

    if (this.modules.ccpa) {
      const ccpaReport = this.modules.ccpa.generateComplianceReport();
      metrics.modules.ccpa = {
        optOutRate: ccpaReport.summary.optOutRate,
        averageResponseTime: ccpaReport.compliance.averageResponseTime,
        deletionCompliance: ccpaReport.compliance.dataDeletionCompliance
      };
    }

    if (this.modules.soc2) {
      const soc2Assessment = this.modules.soc2.generateReadinessAssessment();
      metrics.modules.soc2 = {
        readinessScore: soc2Assessment.readinessScore,
        controlsImplemented: soc2Assessment.summary.controlsImplemented,
        activeExceptions: soc2Assessment.summary.activeExceptions
      };
    }

    if (this.modules.risk) {
      const riskDashboard = this.modules.risk.getRiskDashboard();
      metrics.modules.risk = {
        overallRiskScore: riskDashboard.overallRiskScore,
        overallRiskLevel: riskDashboard.overallRiskLevel,
        highRiskFactors: riskDashboard.highRiskFactors.length
      };
    }

    return metrics;
  }

  /**
   * Stop all modules and cleanup
   */
  async shutdown() {
    try {
      // Stop automation
      if (this.modules.automation) {
        this.modules.automation.stopAutomation();
      }

      // Process any pending retention actions
      if (this.modules.retention) {
        this.modules.retention.processRetentionSchedule();
      }

      this.logEvent('framework_shutdown', {
        modules: Object.keys(this.modules)
      });

      this.status.initialized = false;
      console.log('[Compliance Framework] Shutdown completed');

    } catch (error) {
      this.logEvent('framework_shutdown_failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Log framework events
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: this.getDeterministicDate().toISOString(),
      eventType,
      data,
      organization: this.config.organizationName,
      framework: 'compliance'
    };

    console.log('[Compliance Framework]', JSON.stringify(logEntry, null, 2));

    // Also log to audit trail if available
    if (this.modules.audit) {
      this.modules.audit.logEvent('system', eventType, {
        source: 'compliance_framework',
        additionalDetails: data
      });
    }
  }
}

module.exports = ComplianceFramework;