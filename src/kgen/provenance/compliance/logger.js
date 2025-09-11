/**
 * Compliance Logger - Regulatory compliance logging for provenance
 * 
 * Provides specialized logging for various regulatory frameworks including
 * GDPR, SOX, HIPAA, and other compliance requirements.
 */

import { Logger } from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export class ComplianceLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      complianceMode: config.complianceMode || 'GDPR',
      auditRetention: config.auditRetention || '7years',
      logPath: config.complianceLogPath || './logs/compliance',
      encryptLogs: config.encryptionEnabled || false,
      realTimeAlerts: config.realTimeAlerts || true,
      ...config
    };

    this.logger = new Logger({ tag: 'compliance-logger' });
    
    // Compliance frameworks
    this.frameworks = {
      GDPR: this._getGDPRConfig(),
      SOX: this._getSOXConfig(),
      HIPAA: this._getHIPAAConfig(),
      PCI_DSS: this._getPCIDSSConfig(),
      ISO_27001: this._getISO27001Config()
    };

    // Compliance state
    this.complianceEvents = [];
    this.violations = [];
    this.auditTrail = [];
    this.retentionSchedule = new Map();

    this.state = 'initialized';
  }

  /**
   * Initialize compliance logger
   */
  async initialize() {
    try {
      this.logger.info(`Initializing compliance logger for ${this.config.complianceMode}`);

      // Create log directories
      await this._initializeLogDirectories();

      // Load compliance framework configuration
      this.activeFramework = this._getActiveFramework();

      // Initialize retention policies
      await this._initializeRetentionPolicies();

      // Start compliance monitoring
      await this._startComplianceMonitoring();

      this.state = 'ready';
      this.logger.success('Compliance logger initialized successfully');

      return {
        status: 'success',
        framework: this.config.complianceMode,
        retentionPeriod: this.config.auditRetention
      };

    } catch (error) {
      this.logger.error('Failed to initialize compliance logger:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Log compliance event
   * @param {string} eventType - Type of compliance event
   * @param {Object} eventData - Event data
   * @param {Object} context - Provenance context
   */
  async logComplianceEvent(eventType, eventData, context = {}) {
    try {
      const event = {
        id: crypto.randomUUID(),
        type: eventType,
        timestamp: new Date(),
        data: eventData,
        context,
        framework: this.config.complianceMode,
        severity: this._determineSeverity(eventType, eventData),
        hash: null // Will be calculated
      };

      // Calculate event hash for integrity
      event.hash = this._calculateEventHash(event);

      // Apply framework-specific processing
      const processedEvent = await this._processFrameworkEvent(event);

      // Store event
      this.complianceEvents.push(processedEvent);
      await this._persistComplianceEvent(processedEvent);

      // Check for violations
      await this._checkComplianceViolations(processedEvent);

      // Update audit trail
      await this._updateAuditTrail(processedEvent);

      this.logger.debug(`Logged compliance event: ${eventType}`);
      this.emit('compliance-event', processedEvent);

      return { status: 'success', eventId: event.id };

    } catch (error) {
      this.logger.error(`Failed to log compliance event ${eventType}:`, error);
      throw error;
    }
  }

  /**
   * Log data access event (GDPR Article 30)
   * @param {Object} accessInfo - Data access information
   */
  async logDataAccess(accessInfo) {
    return await this.logComplianceEvent('data_access', {
      subject: accessInfo.subject,
      dataTypes: accessInfo.dataTypes,
      purpose: accessInfo.purpose,
      legalBasis: accessInfo.legalBasis,
      accessor: accessInfo.accessor,
      timestamp: new Date()
    });
  }

  /**
   * Log data processing event (GDPR Article 6)
   * @param {Object} processingInfo - Data processing information
   */
  async logDataProcessing(processingInfo) {
    return await this.logComplianceEvent('data_processing', {
      dataCategories: processingInfo.dataCategories,
      processingPurpose: processingInfo.purpose,
      legalBasis: processingInfo.legalBasis,
      retentionPeriod: processingInfo.retentionPeriod,
      processor: processingInfo.processor,
      timestamp: new Date()
    });
  }

  /**
   * Log consent event (GDPR Article 7)
   * @param {Object} consentInfo - Consent information
   */
  async logConsent(consentInfo) {
    return await this.logComplianceEvent('consent', {
      subject: consentInfo.subject,
      consentType: consentInfo.type,
      granted: consentInfo.granted,
      purposes: consentInfo.purposes,
      timestamp: new Date(),
      mechanism: consentInfo.mechanism
    });
  }

  /**
   * Log financial transaction (SOX Section 404)
   * @param {Object} transactionInfo - Transaction information
   */
  async logFinancialTransaction(transactionInfo) {
    return await this.logComplianceEvent('financial_transaction', {
      transactionId: transactionInfo.id,
      amount: transactionInfo.amount,
      accounts: transactionInfo.accounts,
      approver: transactionInfo.approver,
      controlsApplied: transactionInfo.controls,
      timestamp: new Date()
    });
  }

  /**
   * Log healthcare data access (HIPAA)
   * @param {Object} accessInfo - Healthcare data access information
   */
  async logHealthcareAccess(accessInfo) {
    return await this.logComplianceEvent('healthcare_access', {
      patientId: this._hashPII(accessInfo.patientId),
      accessor: accessInfo.accessor,
      accessType: accessInfo.type,
      dataTypes: accessInfo.dataTypes,
      justification: accessInfo.justification,
      timestamp: new Date()
    });
  }

  /**
   * Generate compliance report
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Report options
   */
  async generateComplianceReport(startDate, endDate, options = {}) {
    try {
      this.logger.info(`Generating compliance report for ${this.config.complianceMode}`);

      // Filter events by date range
      const relevantEvents = this.complianceEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startDate && eventDate <= endDate;
      });

      // Apply framework-specific report generation
      const report = await this._generateFrameworkReport(relevantEvents, options);

      // Add metadata
      report.metadata = {
        framework: this.config.complianceMode,
        period: { startDate, endDate },
        totalEvents: relevantEvents.length,
        generatedAt: new Date(),
        violations: this.violations.filter(v => 
          new Date(v.timestamp) >= startDate && new Date(v.timestamp) <= endDate
        ).length
      };

      // Persist report
      await this._persistComplianceReport(report);

      this.emit('report-generated', report);
      return report;

    } catch (error) {
      this.logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Check data retention compliance
   */
  async checkRetentionCompliance() {
    try {
      this.logger.info('Checking data retention compliance');

      const now = new Date();
      const violatingRecords = [];
      const eligibleForDeletion = [];

      for (const [recordId, retention] of this.retentionSchedule) {
        const expiryDate = new Date(retention.createdAt);
        expiryDate.setTime(expiryDate.getTime() + this._parseRetentionPeriod(retention.period));

        if (now > expiryDate) {
          if (retention.required && !retention.deleted) {
            violatingRecords.push({
              recordId,
              retention,
              daysOverdue: Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24))
            });
          } else {
            eligibleForDeletion.push({ recordId, retention });
          }
        }
      }

      // Log violations
      for (const violation of violatingRecords) {
        await this._logRetentionViolation(violation);
      }

      return {
        violations: violatingRecords,
        eligibleForDeletion,
        compliant: violatingRecords.length === 0
      };

    } catch (error) {
      this.logger.error('Failed to check retention compliance:', error);
      throw error;
    }
  }

  /**
   * Get compliance statistics
   */
  getComplianceStatistics() {
    const totalEvents = this.complianceEvents.length;
    const violations = this.violations.length;
    
    const eventsByType = this._groupBy(this.complianceEvents, 'type');
    const violationsBySeverity = this._groupBy(this.violations, 'severity');

    return {
      totalEvents,
      violations,
      complianceRate: totalEvents > 0 ? (totalEvents - violations) / totalEvents : 1,
      eventsByType: this._countGroups(eventsByType),
      violationsBySeverity: this._countGroups(violationsBySeverity),
      framework: this.config.complianceMode,
      retentionSchedule: this.retentionSchedule.size,
      state: this.state
    };
  }

  // Private methods

  _getActiveFramework() {
    const modes = this.config.complianceMode.split(',').map(m => m.trim());
    return modes.map(mode => this.frameworks[mode]).filter(Boolean);
  }

  _getGDPRConfig() {
    return {
      name: 'GDPR',
      requiredEvents: ['data_access', 'data_processing', 'consent'],
      retentionRules: {
        personal_data: '6years',
        consent_records: '3years',
        access_logs: '2years'
      },
      violations: {
        unauthorized_access: 'high',
        missing_consent: 'high',
        retention_violation: 'medium'
      }
    };
  }

  _getSOXConfig() {
    return {
      name: 'SOX',
      requiredEvents: ['financial_transaction', 'access_control', 'audit_event'],
      retentionRules: {
        financial_records: '7years',
        audit_trails: '7years',
        control_evidence: '7years'
      },
      violations: {
        inadequate_controls: 'high',
        unauthorized_changes: 'high',
        missing_approvals: 'medium'
      }
    };
  }

  _getHIPAAConfig() {
    return {
      name: 'HIPAA',
      requiredEvents: ['healthcare_access', 'phi_disclosure', 'security_incident'],
      retentionRules: {
        phi_records: '6years',
        access_logs: '6years',
        security_logs: '6years'
      },
      violations: {
        unauthorized_phi_access: 'high',
        missing_encryption: 'high',
        inadequate_safeguards: 'medium'
      }
    };
  }

  _getPCIDSSConfig() {
    return {
      name: 'PCI_DSS',
      requiredEvents: ['card_data_access', 'security_event', 'vulnerability_scan'],
      retentionRules: {
        card_data: '1year',
        security_logs: '1year',
        audit_trails: '1year'
      },
      violations: {
        insecure_transmission: 'high',
        weak_encryption: 'high',
        missing_logging: 'medium'
      }
    };
  }

  _getISO27001Config() {
    return {
      name: 'ISO_27001',
      requiredEvents: ['security_incident', 'access_control', 'risk_assessment'],
      retentionRules: {
        security_records: '3years',
        incident_reports: '3years',
        risk_assessments: '3years'
      },
      violations: {
        control_failure: 'high',
        inadequate_monitoring: 'medium',
        missing_documentation: 'low'
      }
    };
  }

  async _initializeLogDirectories() {
    const dirs = [
      this.config.logPath,
      path.join(this.config.logPath, 'events'),
      path.join(this.config.logPath, 'reports'),
      path.join(this.config.logPath, 'violations')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _initializeRetentionPolicies() {
    // Initialize retention policies based on active framework
    for (const framework of this.activeFramework) {
      for (const [dataType, period] of Object.entries(framework.retentionRules)) {
        // Set up retention schedule
        this.logger.debug(`Setting retention policy: ${dataType} -> ${period}`);
      }
    }
  }

  async _startComplianceMonitoring() {
    // Start real-time compliance monitoring
    if (this.config.realTimeAlerts) {
      this.on('compliance-event', (event) => {
        if (event.severity === 'high') {
          this.logger.warn(`High severity compliance event: ${event.type}`);
        }
      });

      this.on('violation', (violation) => {
        this.logger.error(`Compliance violation detected: ${violation.type}`);
      });
    }
  }

  _determineSeverity(eventType, eventData) {
    // Determine event severity based on type and data
    const severityMap = {
      data_access: 'low',
      unauthorized_access: 'high',
      data_breach: 'critical',
      consent_withdrawal: 'medium',
      financial_transaction: 'medium'
    };

    return severityMap[eventType] || 'low';
  }

  _calculateEventHash(event) {
    const eventString = JSON.stringify({
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    }, null, 0);
    
    return crypto.createHash('sha256').update(eventString).digest('hex');
  }

  async _processFrameworkEvent(event) {
    // Apply framework-specific processing
    for (const framework of this.activeFramework) {
      if (framework.requiredEvents.includes(event.type)) {
        event.framework = framework.name;
        event.processed = true;
        break;
      }
    }

    return event;
  }

  async _persistComplianceEvent(event) {
    const filename = `${event.type}_${event.timestamp.toISOString().slice(0, 10)}.json`;
    const filepath = path.join(this.config.logPath, 'events', filename);

    let data = JSON.stringify(event, null, 2);
    
    if (this.config.encryptLogs) {
      data = this._encryptLogData(data);
    }

    await fs.appendFile(filepath, data + '\\n');
  }

  async _checkComplianceViolations(event) {
    // Check for compliance violations
    for (const framework of this.activeFramework) {
      for (const [violationType, severity] of Object.entries(framework.violations)) {
        if (this._detectViolation(event, violationType)) {
          const violation = {
            id: crypto.randomUUID(),
            type: violationType,
            severity,
            event: event.id,
            timestamp: new Date(),
            framework: framework.name
          };

          this.violations.push(violation);
          this.emit('violation', violation);
          
          await this._persistViolation(violation);
        }
      }
    }
  }

  _detectViolation(event, violationType) {
    // Simple violation detection logic
    const violationRules = {
      unauthorized_access: event => event.type === 'data_access' && !event.data.authorized,
      missing_consent: event => event.type === 'data_processing' && !event.data.legalBasis,
      retention_violation: event => event.type === 'data_retention' && event.data.expired
    };

    const rule = violationRules[violationType];
    return rule ? rule(event) : false;
  }

  async _persistViolation(violation) {
    const filename = `violation_${violation.timestamp.toISOString().slice(0, 10)}.json`;
    const filepath = path.join(this.config.logPath, 'violations', filename);

    await fs.appendFile(filepath, JSON.stringify(violation, null, 2) + '\\n');
  }

  async _updateAuditTrail(event) {
    const auditEntry = {
      timestamp: new Date(),
      action: 'compliance_event_logged',
      eventId: event.id,
      eventType: event.type,
      framework: event.framework
    };

    this.auditTrail.push(auditEntry);
  }

  async _generateFrameworkReport(events, options) {
    const report = {
      framework: this.config.complianceMode,
      summary: this._generateSummary(events),
      events: options.includeEvents ? events : [],
      violations: this.violations,
      recommendations: this._generateRecommendations(events)
    };

    // Framework-specific sections
    if (this.config.complianceMode.includes('GDPR')) {
      report.gdpr = this._generateGDPRSection(events);
    }

    if (this.config.complianceMode.includes('SOX')) {
      report.sox = this._generateSOXSection(events);
    }

    if (this.config.complianceMode.includes('HIPAA')) {
      report.hipaa = this._generateHIPAASection(events);
    }

    return report;
  }

  _generateSummary(events) {
    return {
      totalEvents: events.length,
      eventsByType: this._countGroups(this._groupBy(events, 'type')),
      violations: this.violations.length,
      complianceScore: this._calculateComplianceScore(events)
    };
  }

  _generateRecommendations(events) {
    const recommendations = [];
    
    // Simple recommendation logic
    if (this.violations.length > 0) {
      recommendations.push('Address identified compliance violations');
    }

    const highSeverityEvents = events.filter(e => e.severity === 'high');
    if (highSeverityEvents.length > events.length * 0.1) {
      recommendations.push('Review and strengthen security controls');
    }

    return recommendations;
  }

  _generateGDPRSection(events) {
    const dataAccessEvents = events.filter(e => e.type === 'data_access');
    const consentEvents = events.filter(e => e.type === 'consent');
    
    return {
      dataAccessEvents: dataAccessEvents.length,
      consentEvents: consentEvents.length,
      personalDataCategories: this._extractDataCategories(events),
      legalBases: this._extractLegalBases(events)
    };
  }

  _generateSOXSection(events) {
    const financialEvents = events.filter(e => e.type === 'financial_transaction');
    
    return {
      financialTransactions: financialEvents.length,
      controlsApplied: this._extractControlsApplied(financialEvents),
      approvalChain: this._extractApprovalChain(financialEvents)
    };
  }

  _generateHIPAASection(events) {
    const healthcareEvents = events.filter(e => e.type === 'healthcare_access');
    
    return {
      phiAccessEvents: healthcareEvents.length,
      accessJustifications: this._extractAccessJustifications(healthcareEvents),
      dataTypes: this._extractHealthcareDataTypes(healthcareEvents)
    };
  }

  async _persistComplianceReport(report) {
    const filename = `compliance_report_${report.metadata.generatedAt.toISOString().slice(0, 10)}.json`;
    const filepath = path.join(this.config.logPath, 'reports', filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  }

  async _logRetentionViolation(violation) {
    await this.logComplianceEvent('retention_violation', {
      recordId: violation.recordId,
      daysOverdue: violation.daysOverdue,
      retentionPeriod: violation.retention.period
    });
  }

  _parseRetentionPeriod(period) {
    // Parse retention period (e.g., '7years', '30days')
    const match = period.match(/^(\\d+)(years?|months?|days?)$/);
    if (!match) return 0;

    const [, amount, unit] = match;
    const multipliers = {
      day: 24 * 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
      years: 365 * 24 * 60 * 60 * 1000
    };

    return parseInt(amount) * (multipliers[unit] || 0);
  }

  _hashPII(data) {
    // Hash personally identifiable information
    return crypto.createHash('sha256').update(String(data)).digest('hex').slice(0, 16);
  }

  _encryptLogData(data) {
    // Simple encryption for log data
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey || 'default-key');
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  _groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  _countGroups(groups) {
    const counts = {};
    for (const [key, values] of Object.entries(groups)) {
      counts[key] = values.length;
    }
    return counts;
  }

  _calculateComplianceScore(events) {
    // Simple compliance score calculation
    const totalEvents = events.length;
    const violations = this.violations.length;
    
    if (totalEvents === 0) return 1.0;
    return Math.max(0, (totalEvents - violations) / totalEvents);
  }

  _extractDataCategories(events) {
    // Extract data categories from events
    return [...new Set(events
      .filter(e => e.data.dataCategories)
      .flatMap(e => e.data.dataCategories)
    )];
  }

  _extractLegalBases(events) {
    // Extract legal bases from events
    return [...new Set(events
      .filter(e => e.data.legalBasis)
      .map(e => e.data.legalBasis)
    )];
  }

  _extractControlsApplied(events) {
    // Extract controls applied from financial events
    return [...new Set(events
      .filter(e => e.data.controlsApplied)
      .flatMap(e => e.data.controlsApplied)
    )];
  }

  _extractApprovalChain(events) {
    // Extract approval chain from financial events
    return [...new Set(events
      .filter(e => e.data.approver)
      .map(e => e.data.approver)
    )];
  }

  _extractAccessJustifications(events) {
    // Extract access justifications from healthcare events
    return [...new Set(events
      .filter(e => e.data.justification)
      .map(e => e.data.justification)
    )];
  }

  _extractHealthcareDataTypes(events) {
    // Extract healthcare data types
    return [...new Set(events
      .filter(e => e.data.dataTypes)
      .flatMap(e => e.data.dataTypes)
    )];
  }
}

export default ComplianceLogger;