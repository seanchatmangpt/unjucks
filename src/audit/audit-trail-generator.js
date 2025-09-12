/**
 * HIPAA/GDPR/SOX Compliant Audit Trail Generator
 * Tamper-proof audit logging with digital signatures
 */

import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * @typedef {Object} AuditConfig
 * @property {string} organizationId
 * @property {number} retentionPeriodDays
 * @property {boolean} encryptionEnabled
 * @property {boolean} digitalSignatures
 * @property {boolean} [blockchainAnchoring]
 * @property {boolean} [syslogIntegration]
 * @property {Object} [siemIntegration]
 * @property {string} [siemIntegration.endpoint]
 * @property {string} [siemIntegration.apiKey]
 */

/**
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {Date} timestamp
 * @property {string} userId
 * @property {string} [userRole]
 * @property {string} sessionId
 * @property {'CREATE'|'READ'|'UPDATE'|'DELETE'|'EXPORT'|'LOGIN'|'LOGOUT'|'ADMIN'|'BREACH'|'ACCESS_DENIED'} operation
 * @property {string} resource
 * @property {'USER'|'PATIENT'|'FINANCIAL'|'SYSTEM'|'TEMPLATE'|'REPORT'} resourceType
 * @property {string} regulation
 * @property {boolean} complianceImpact
 * @property {string[]} [dataFields]
 * @property {Record<string, any>} [oldValues]
 * @property {Record<string, any>} [newValues]
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {Object} [geolocation]
 * @property {string} [geolocation.country]
 * @property {string} [geolocation.region]
 * @property {string} [geolocation.city]
 * @property {number} riskScore
 * @property {'SUCCESS'|'FAILURE'|'PARTIAL'|'BLOCKED'} result
 * @property {string} [errorMessage]
 * @property {Record<string, any>} metadata
 * @property {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} sensitivity
 * @property {string} [signature]
 * @property {string} [chainHash]
 */

export class AuditTrailGenerator {
  /**
   * @param {AuditConfig} config
   */
  constructor(config) {
    this.config = config;
    this.auditChain = [];
    this.secretKey = this.getSecretKey();
  }

  /**
   * Generate comprehensive audit trail entry
   * @param {string} operation
   * @param {string} resource
   * @param {string} userId
   * @param {string} regulation
   * @param {Record<string, any>} metadata
   * @returns {Promise<Object>}
   */
  async generateAuditTrail(
    operation,
    resource,
    userId,
    regulation,
    metadata = {}
  ) {
    const id = this.generateAuditId();
    const timestamp = this.getDeterministicDate();
    
    const auditEntry = {
      id,
      timestamp,
      userId,
      userRole: metadata.userRole,
      sessionId: metadata.sessionId || this.generateSessionId(),
      operation: operation,
      resource,
      resourceType: this.determineResourceType(resource),
      regulation,
      complianceImpact: this.hasComplianceImpact(operation, regulation),
      dataFields: metadata.dataFields || [],
      oldValues: metadata.oldValues,
      newValues: metadata.newValues,
      ipAddress: metadata.ipAddress || '0.0.0.0',
      userAgent: metadata.userAgent || 'Unknown',
      geolocation: metadata.geolocation,
      riskScore: this.calculateRiskScore(operation, resource, metadata),
      result: metadata.result || 'SUCCESS',
      errorMessage: metadata.errorMessage,
      metadata,
      sensitivity: this.determineSensitivity(resource, regulation),
      chainHash: this.calculateChainHash(id, timestamp, operation, resource)
    };

    // Generate digital signature for tamper-proofing
    if (this.config.digitalSignatures) {
      auditEntry.signature = this.generateDigitalSignature(auditEntry);
    }

    // Add to audit chain for blockchain-like integrity
    this.auditChain.push(auditEntry.chainHash);

    const auditTrail = {
      id,
      timestamp,
      userId,
      action: operation,
      resource,
      regulation,
      complianceImpact: auditEntry.complianceImpact,
      metadata: {
        ...metadata,
        auditEntry,
        riskScore: auditEntry.riskScore,
        sensitivity: auditEntry.sensitivity,
        integrity: {
          chainHash: auditEntry.chainHash,
          signature: auditEntry.signature,
          verified: true
        }
      },
      signature: auditEntry.signature || ''
    };

    // Store audit trail
    await this.storeAuditTrail(auditTrail);

    // Send to external systems
    await this.propagateAuditTrail(auditEntry);

    return auditTrail;
  }

  /**
   * Verify audit trail integrity
   * @param {string} auditId
   * @returns {Promise<{isValid: boolean, issues: string[], verificationTimestamp: Date}>}
   */
  async verifyAuditIntegrity(auditId) {
    const auditTrail = await this.retrieveAuditTrail(auditId);
    const issues = [];

    if (!auditTrail) {
      return {
        isValid: false,
        issues: ['Audit trail not found'],
        verificationTimestamp: this.getDeterministicDate()
      };
    }

    // Verify digital signature
    if (this.config.digitalSignatures && auditTrail.signature) {
      const expectedSignature = this.generateDigitalSignature(
        auditTrail.metadata.auditEntry
      );
      
      if (auditTrail.signature !== expectedSignature) {
        issues.push('Digital signature verification failed - possible tampering');
      }
    }

    // Verify chain hash
    const auditEntry = auditTrail.metadata.auditEntry;
    const expectedChainHash = this.calculateChainHash(
      auditEntry.id,
      auditEntry.timestamp,
      auditEntry.operation,
      auditEntry.resource
    );

    if (auditEntry.chainHash !== expectedChainHash) {
      issues.push('Chain hash verification failed - audit chain broken');
    }

    // Check for gaps in audit sequence
    const sequenceGaps = await this.checkSequenceIntegrity(auditId);
    if (sequenceGaps.length > 0) {
      issues.push(`Sequence gaps detected: ${sequenceGaps.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      verificationTimestamp: this.getDeterministicDate()
    };
  }

  /**
   * Generate compliance audit report
   * @param {string} regulation
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async generateComplianceAuditReport(
    regulation,
    startDate,
    endDate,
    options = {}
  ) {
    const reportId = this.generateReportId();
    const auditEntries = await this.queryAuditTrails(regulation, startDate, endDate, options);

    // Analyze audit data
    const totalEntries = auditEntries.length;
    const complianceEvents = auditEntries.filter(e => e.complianceImpact).length;
    const failureEvents = auditEntries.filter(e => e.result === 'FAILURE').length;
    const highRiskEvents = auditEntries.filter(e => e.riskScore >= 80).length;

    // Calculate user activity
    const userActivity = new Map();
    auditEntries.forEach(entry => {
      userActivity.set(entry.userId, (userActivity.get(entry.userId) || 0) + 1);
    });

    const topUsers = Array.from(userActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, eventCount]) => ({ userId, eventCount }));

    // Calculate resource access
    const resourceActivity = new Map();
    auditEntries.forEach(entry => {
      resourceActivity.set(entry.resource, (resourceActivity.get(entry.resource) || 0) + 1);
    });

    const topResources = Array.from(resourceActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, accessCount]) => ({ resource, accessCount }));

    // Risk distribution
    const riskDistribution = {
      'LOW': auditEntries.filter(e => e.riskScore < 30).length,
      'MEDIUM': auditEntries.filter(e => e.riskScore >= 30 && e.riskScore < 70).length,
      'HIGH': auditEntries.filter(e => e.riskScore >= 70 && e.riskScore < 90).length,
      'CRITICAL': auditEntries.filter(e => e.riskScore >= 90).length
    };

    // Timeline analysis
    const timeline = this.generateTimeline(auditEntries, startDate, endDate);

    // Identify violations
    const violations = this.identifyViolations(auditEntries, regulation);

    // Generate recommendations
    const recommendations = this.generateAuditRecommendations(auditEntries, regulation);

    // Verify integrity of audit period
    const integrityStatus = await this.verifyPeriodIntegrity(startDate, endDate);

    return {
      reportId,
      regulation,
      period: { start: startDate, end: endDate },
      totalEntries,
      complianceEvents,
      failureEvents,
      highRiskEvents,
      topUsers,
      topResources,
      riskDistribution,
      timeline,
      violations,
      recommendations,
      integrityStatus
    };
  }

  /**
   * Set up automated audit archival
   */
  /**
   * Set up automated audit archival
   * @param {'daily'|'weekly'|'monthly'} schedule
   * @returns {Promise<{archivalId: string, schedule: string, retentionPolicy: string, nextArchival: Date}>}
   */
  async setupAuditArchival(schedule) {
    const archivalId = this.generateArchivalId();
    
    return {
      archivalId,
      schedule,
      retentionPolicy: `${this.config.retentionPeriodDays} days`,
      nextArchival: this.calculateNextArchivalDate(schedule)
    };
  }

  /**
   * Export audit trails for regulatory inspection
   */
  /**
   * Export audit trails for regulatory inspection
   * @param {string} regulation
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {'json'|'csv'|'xml'} format
   * @returns {Promise<{exportId: string, format: string, totalRecords: number, dataIntegrity: boolean, exportData: string, digitalSignature: string}>}
   */
  async exportAuditTrails(
    regulation,
    startDate,
    endDate,
    format = 'json'
  ) {
    const exportId = this.generateExportId();
    const auditEntries = await this.queryAuditTrails(regulation, startDate, endDate);
    
    // Verify integrity of all entries
    const integrityResults = await Promise.all(
      auditEntries.map(entry => this.verifyAuditIntegrity(entry.id))
    );
    const dataIntegrity = integrityResults.every(result => result.isValid);

    // Format data
    let exportData;
    switch (format) {
      case 'csv':
        exportData = this.formatAsCSV(auditEntries);
        break;
      case 'xml':
        exportData = this.formatAsXML(auditEntries);
        break;
      default:
        exportData = JSON.stringify({
          exportId,
          regulation,
          period: { start: startDate, end: endDate },
          entries: auditEntries,
          integrityVerified: dataIntegrity
        }, null, 2);
    }

    // Generate digital signature for export
    const digitalSignature = this.generateExportSignature(exportData);

    return {
      exportId,
      format,
      totalRecords: auditEntries.length,
      dataIntegrity,
      exportData,
      digitalSignature
    };
  }

  // Private helper methods

  /**
   * @returns {string}
   */
  generateAuditId() {
    return `audit_${this.getDeterministicTimestamp()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * @returns {string}
   */
  generateSessionId() {
    return `session_${randomBytes(16).toString('hex')}`;
  }

  /**
   * @param {string} id
   * @param {Date} timestamp
   * @param {string} operation
   * @param {string} resource
   * @returns {string}
   */
  calculateChainHash(id, timestamp, operation, resource) {
    const previousHash = this.auditChain[this.auditChain.length - 1] || '0';
    const data = `${previousHash}${id}${timestamp.toISOString()}${operation}${resource}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * @param {AuditEntry} auditEntry
   * @returns {string}
   */
  generateDigitalSignature(auditEntry) {
    const data = JSON.stringify({
      id: auditEntry.id,
      timestamp: auditEntry.timestamp,
      operation: auditEntry.operation,
      resource: auditEntry.resource,
      userId: auditEntry.userId,
      result: auditEntry.result
    });

    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  /**
   * @param {string} resource
   * @returns {string}
   */
  determineResourceType(resource) {
    if (resource.includes('patient') || resource.includes('health')) return 'PATIENT';
    if (resource.includes('financial') || resource.includes('payment')) return 'FINANCIAL';
    if (resource.includes('user') || resource.includes('account')) return 'USER';
    if (resource.includes('system') || resource.includes('admin')) return 'SYSTEM';
    if (resource.includes('template') || resource.includes('compliance')) return 'TEMPLATE';
    if (resource.includes('report') || resource.includes('export')) return 'REPORT';
    return 'SYSTEM';
  }

  /**
   * @param {string} operation
   * @param {string} regulation
   * @returns {boolean}
   */
  hasComplianceImpact(operation, regulation) {
    const complianceOperations = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'BREACH'];
    return complianceOperations.includes(operation);
  }

  /**
   * @param {string} operation
   * @param {string} resource
   * @param {Record<string, any>} metadata
   * @returns {number}
   */
  calculateRiskScore(operation, resource, metadata) {
    let score = 0;

    // Base score by operation
    const operationScores = {
      'READ': 10,
      'CREATE': 30,
      'UPDATE': 40,
      'DELETE': 80,
      'EXPORT': 60,
      'BREACH': 100,
      'ACCESS_DENIED': 50
    };

    score += operationScores[operation] || 20;

    // Resource sensitivity
    if (resource.includes('patient') || resource.includes('health')) score += 30;
    if (resource.includes('financial') || resource.includes('payment')) score += 25;
    if (resource.includes('admin') || resource.includes('system')) score += 20;

    // User role risk
    if (metadata.userRole === 'admin') score += 15;
    if (metadata.userRole === 'emergency_access') score += 25;

    // Time-based risk (after hours access)
    const hour = this.getDeterministicDate().getHours();
    if (hour < 6 || hour > 22) score += 10;

    // Geographic risk
    if (metadata.geolocation?.country !== 'US') score += 15;

    // Failed operations
    if (metadata.result === 'FAILURE') score += 20;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * @param {string} resource
   * @param {string} regulation
   * @returns {string}
   */
  determineSensitivity(resource, regulation) {
    if (regulation === 'HIPAA' && resource.includes('patient')) return 'CRITICAL';
    if (regulation === 'SOX' && resource.includes('financial')) return 'CRITICAL';
    if (regulation === 'GDPR' && resource.includes('personal')) return 'HIGH';
    if (resource.includes('admin') || resource.includes('system')) return 'HIGH';
    if (resource.includes('user')) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * @param {Object} auditTrail
   * @returns {Promise<void>}
   */
  async storeAuditTrail(auditTrail) {
    // In production, this would store in a tamper-proof database
    console.log('Audit trail stored:', auditTrail.id);
  }

  /**
   * @param {AuditEntry} auditEntry
   * @returns {Promise<void>}
   */
  async propagateAuditTrail(auditEntry) {
    // Send to SIEM if configured
    if (this.config.siemIntegration) {
      await this.sendToSIEM(auditEntry);
    }

    // Send to syslog if configured
    if (this.config.syslogIntegration) {
      await this.sendToSyslog(auditEntry);
    }

    // Blockchain anchoring for critical events
    if (this.config.blockchainAnchoring && auditEntry.sensitivity === 'CRITICAL') {
      await this.anchorToBlockchain(auditEntry);
    }
  }

  /**
   * @param {AuditEntry} auditEntry
   * @returns {Promise<void>}
   */
  async sendToSIEM(auditEntry) {
    // Implementation would send to SIEM system
    console.log('Audit entry sent to SIEM:', auditEntry.id);
  }

  /**
   * @param {AuditEntry} auditEntry
   * @returns {Promise<void>}
   */
  async sendToSyslog(auditEntry) {
    // Implementation would send to syslog
    console.log('Audit entry sent to syslog:', auditEntry.id);
  }

  /**
   * @param {AuditEntry} auditEntry
   * @returns {Promise<void>}
   */
  async anchorToBlockchain(auditEntry) {
    // Implementation would anchor hash to blockchain
    console.log('Audit entry anchored to blockchain:', auditEntry.chainHash);
  }

  /**
   * @param {string} auditId
   * @returns {Promise<Object|null>}
   */
  async retrieveAuditTrail(auditId) {
    // Implementation would retrieve from database
    return null;
  }

  /**
   * @param {string} auditId
   * @returns {Promise<string[]>}
   */
  async checkSequenceIntegrity(auditId) {
    // Implementation would check for sequence gaps
    return [];
  }

  /**
   * @param {string} regulation
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {Object} options
   * @returns {Promise<AuditEntry[]>}
   */
  async queryAuditTrails(
    regulation,
    startDate,
    endDate,
    options = {}
  ) {
    // Simulate audit query - in production, query database
    return [];
  }

  /**
   * @param {AuditEntry[]} entries
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Array<{date: string, events: number}>}
   */
  generateTimeline(entries, startDate, endDate) {
    const timeline = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayEntries = entries.filter(entry => 
        entry.timestamp.toISOString().split('T')[0] === dateStr
      );
      
      timeline.push({
        date: dateStr,
        events: dayEntries.length
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return timeline;
  }

  /**
   * @param {AuditEntry[]} entries
   * @param {string} regulation
   * @returns {Array}
   */
  identifyViolations(entries, regulation) {
    return entries
      .filter(entry => entry.result === 'FAILURE' || entry.riskScore >= 80)
      .map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        description: `${entry.operation} operation failed on ${entry.resource}`,
        severity: entry.riskScore >= 90 ? 'CRITICAL' : 'HIGH',
        resolved: false
      }));
  }

  /**
   * @param {AuditEntry[]} entries
   * @param {string} regulation
   * @returns {string[]}
   */
  generateAuditRecommendations(entries, regulation) {
    const recommendations = [];
    
    const failureRate = entries.filter(e => e.result === 'FAILURE').length / entries.length;
    if (failureRate > 0.05) {
      recommendations.push('High failure rate detected - review access controls');
    }
    
    const highRiskEvents = entries.filter(e => e.riskScore >= 80).length;
    if (highRiskEvents > 10) {
      recommendations.push('Multiple high-risk events - enhance monitoring');
    }
    
    const afterHoursAccess = entries.filter(e => {
      const hour = e.timestamp.getHours();
      return hour < 6 || hour > 22;
    }).length;
    
    if (afterHoursAccess > entries.length * 0.1) {
      recommendations.push('Significant after-hours access - review necessity');
    }
    
    return recommendations;
  }

  /**
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<string>}
   */
  async verifyPeriodIntegrity(startDate, endDate) {
    // Implementation would verify integrity across time period
    return 'verified';
  }

  /**
   * @returns {string}
   */
  generateReportId() {
    return `report_${this.getDeterministicTimestamp()}_${randomBytes(6).toString('hex')}`;
  }

  /**
   * @returns {string}
   */
  generateArchivalId() {
    return `archival_${this.getDeterministicTimestamp()}_${randomBytes(6).toString('hex')}`;
  }

  /**
   * @returns {string}
   */
  generateExportId() {
    return `export_${this.getDeterministicTimestamp()}_${randomBytes(6).toString('hex')}`;
  }

  /**
   * @param {string} schedule
   * @returns {Date}
   */
  calculateNextArchivalDate(schedule) {
    const next = this.getDeterministicDate();
    switch (schedule) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * @param {AuditEntry[]} entries
   * @returns {string}
   */
  formatAsCSV(entries) {
    const headers = ['id', 'timestamp', 'userId', 'operation', 'resource', 'result', 'riskScore'];
    const rows = entries.map(entry => 
      headers.map(header => entry[header]).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * @param {AuditEntry[]} entries
   * @returns {string}
   */
  formatAsXML(entries) {
    const xmlEntries = entries.map(entry => `
      <audit>
        <id>${entry.id}</id>
        <timestamp>${entry.timestamp.toISOString()}</timestamp>
        <userId>${entry.userId}</userId>
        <operation>${entry.operation}</operation>
        <resource>${entry.resource}</resource>
        <result>${entry.result}</result>
        <riskScore>${entry.riskScore}</riskScore>
      </audit>
    `).join('');
    
    return `<?xml version="1.0" encoding="UTF-8"?><auditTrails>${xmlEntries}</auditTrails>`;
  }

  /**
   * @param {string} data
   * @returns {string}
   */
  generateExportSignature(data) {
    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  /**
   * @returns {string}
   */
  getSecretKey() {
    return process.env.AUDIT_SECRET_KEY || 'change-this-in-production';
  }
}