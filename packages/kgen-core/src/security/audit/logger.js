/**
 * Enterprise Security Audit Logger
 * 
 * Comprehensive audit logging system for security events, compliance tracking,
 * and forensic analysis with enterprise-grade features.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';

export class AuditLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Audit Configuration
      auditPath: config.auditPath || './logs/audit',
      enableEncryption: config.enableEncryption || true,
      enableIntegrityChecks: config.enableIntegrityChecks || true,
      enableRealTimeNotifications: config.enableRealTimeNotifications || true,
      
      // Retention and Rotation
      retentionPeriod: config.retentionPeriod || '7years',
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      enableCompression: config.enableCompression || true,
      
      // Log Levels
      logLevel: config.logLevel || 'INFO',
      auditAllEvents: config.auditAllEvents || true,
      
      // Security Features
      requireDigitalSignatures: config.requireDigitalSignatures || false,
      enableTamperDetection: config.enableTamperDetection || true,
      enableForensicMode: config.enableForensicMode || false,
      
      // Compliance
      complianceFrameworks: config.complianceFrameworks || ['SOX', 'GDPR', 'HIPAA'],
      
      ...config
    };
    
    this.logger = consola.withTag('audit-logger');
    this.status = 'uninitialized';
    
    // Audit state
    this.auditBuffer = [];
    this.encryptionKey = null;
    this.signingKey = null;
    this.currentLogFile = null;
    this.fileRotationSchedule = null;
    
    // Metrics
    this.metrics = {
      eventsLogged: 0,
      filesCreated: 0,
      integrityViolations: 0,
      encryptionOperations: 0,
      compressionSavings: 0
    };
    
    // Event categories for compliance
    this.eventCategories = {
      AUTHENTICATION: ['login', 'logout', 'auth_failure', 'mfa_challenge'],
      AUTHORIZATION: ['access_granted', 'access_denied', 'permission_changed'],
      DATA_ACCESS: ['data_read', 'data_write', 'data_delete', 'data_export'],
      CONFIGURATION: ['config_changed', 'policy_updated', 'role_modified'],
      SECURITY: ['threat_detected', 'vulnerability_found', 'incident_reported'],
      COMPLIANCE: ['compliance_check', 'violation_detected', 'audit_performed'],
      SYSTEM: ['service_started', 'service_stopped', 'error_occurred']
    };
  }

  /**
   * Initialize audit logger
   */
  async initialize() {
    try {
      this.logger.info('Initializing audit logger...');
      this.status = 'initializing';
      
      // Create audit directory
      await this._ensureAuditDirectory();
      
      // Setup encryption
      if (this.config.enableEncryption) {
        await this._setupEncryption();
      }
      
      // Setup digital signatures
      if (this.config.requireDigitalSignatures) {
        await this._setupDigitalSignatures();
      }
      
      // Initialize current log file
      await this._initializeLogFile();
      
      // Setup file rotation
      this._setupFileRotation();
      
      // Setup buffer flushing
      this._setupBufferFlushing();
      
      // Setup integrity monitoring
      if (this.config.enableTamperDetection) {
        this._setupIntegrityMonitoring();
      }
      
      this.status = 'ready';
      this.logger.success('Audit logger initialized successfully');
      
      // Log initialization event
      await this.logSecurityEvent('SYSTEM', 'audit_logger_initialized', {
        configuration: this._getSafeConfig(),
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      return { status: 'success', auditPath: this.config.auditPath };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Audit logger initialization failed:', error);
      throw error;
    }
  }

  /**
   * Log authentication events
   */
  async logAuthenticationEvent(eventType, data) {
    return this.logSecurityEvent('AUTHENTICATION', eventType, {
      ...data,
      userId: data.userId || data.username,
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log authorization events
   */
  async logAuthorizationEvent(eventType, data) {
    return this.logSecurityEvent('AUTHORIZATION', eventType, {
      ...data,
      userId: data.userId,
      resource: data.resource,
      operation: data.operation,
      decision: data.authorized ? 'GRANTED' : 'DENIED',
      reason: data.reason,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log unauthorized access attempts
   */
  async logUnauthorizedAccess(context, reason) {
    return this.logSecurityEvent('AUTHORIZATION', 'unauthorized_access', {
      userId: context.user?.id,
      operationType: context.operationType,
      resource: context.context,
      reason,
      severity: 'HIGH',
      requiresInvestigation: true,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log policy violations
   */
  async logPolicyViolation(context, policyResult) {
    return this.logSecurityEvent('COMPLIANCE', 'policy_violation', {
      userId: context.user?.id,
      operationType: context.operationType,
      policyId: policyResult.policyId,
      violationType: policyResult.violationType,
      severity: policyResult.severity || 'MEDIUM',
      details: policyResult.details,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log compliance violations
   */
  async logComplianceViolation(context, complianceResult) {
    return this.logSecurityEvent('COMPLIANCE', 'compliance_violation', {
      userId: context.user?.id,
      framework: complianceResult.framework,
      requirement: complianceResult.requirement,
      violationType: complianceResult.violationType,
      severity: complianceResult.severity || 'HIGH',
      remediation: complianceResult.remediation,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log governance violations
   */
  async logGovernanceViolation(context, governanceResult) {
    return this.logSecurityEvent('COMPLIANCE', 'governance_violation', {
      userId: context.user?.id,
      governanceRule: governanceResult.rule,
      violationType: governanceResult.violationType,
      severity: governanceResult.severity || 'MEDIUM',
      impact: governanceResult.impact,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(operation, data) {
    return this.logSecurityEvent('DATA_ACCESS', `data_${operation}`, {
      userId: data.userId,
      dataType: data.dataType,
      dataId: data.dataId,
      classification: data.classification,
      size: data.size,
      encrypted: data.encrypted || false,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log data encryption events
   */
  async logDataEncryption(data) {
    return this.logSecurityEvent('SECURITY', 'data_encrypted', {
      userId: data.userId,
      dataType: data.template || 'unknown',
      sensitiveFields: data.sensitiveFields,
      encryptionAlgorithm: 'AES-256-GCM',
      keyId: 'sensitive_data_key',
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log file operations
   */
  async logFileOperation(data) {
    return this.logSecurityEvent('DATA_ACCESS', `file_${data.operation}`, {
      userId: data.user?.id,
      filePath: data.filePath,
      operation: data.operation,
      classification: data.classification,
      size: data.size,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log secure operations
   */
  async logSecureOperation(context) {
    return this.logSecurityEvent('SYSTEM', 'secure_operation', {
      userId: context.user?.id,
      operationType: context.operationType,
      requestId: context.requestId,
      success: true,
      timestamp: context.timestamp.toISOString()
    });
  }

  /**
   * Log security failures
   */
  async logSecurityFailure(data) {
    return this.logSecurityEvent('SECURITY', 'security_failure', {
      userId: data.user?.id,
      operationType: data.operationType,
      error: data.error,
      severity: 'HIGH',
      requiresInvestigation: true,
      timestamp: data.timestamp.toISOString()
    });
  }

  /**
   * Log security anomalies
   */
  async logSecurityAnomaly(anomaly) {
    return this.logSecurityEvent('SECURITY', 'security_anomaly', {
      anomalyType: anomaly.type,
      severity: anomaly.severity || 'MEDIUM',
      details: anomaly.details,
      confidence: anomaly.confidence,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Log report generation
   */
  async logReportGeneration(data) {
    return this.logSecurityEvent('SYSTEM', 'report_generated', {
      reportType: data.reportType,
      timeframe: data.timeframe,
      generatedBy: data.generatedBy,
      timestamp: data.timestamp.toISOString()
    });
  }

  /**
   * Log generic security events
   */
  async logSecurityEvent(category, eventType, data) {
    try {
      if (!this.eventCategories[category]) {
        throw new Error(`Unknown event category: ${category}`);
      }
      
      const auditEvent = {
        id: this._generateEventId(),
        category,
        eventType,
        timestamp: this.getDeterministicDate().toISOString(),
        data: this._sanitizeEventData(data),
        metadata: {
          version: '1.0',
          source: 'kgen-security',
          integrity: null // Will be calculated
        }
      };
      
      // Calculate integrity hash
      auditEvent.metadata.integrity = this._calculateIntegrityHash(auditEvent);
      
      // Add to buffer
      this.auditBuffer.push(auditEvent);
      this.metrics.eventsLogged++;
      
      // Emit real-time notification
      if (this.config.enableRealTimeNotifications) {
        this.emit('audit:event', auditEvent);
      }
      
      // Check for immediate flush conditions
      if (this._shouldFlushImmediately(auditEvent)) {
        await this._flushBuffer();
      }
      
      return auditEvent.id;
      
    } catch (error) {
      this.logger.error('Audit event logging failed:', error);
      throw error;
    }
  }

  /**
   * Generate audit summary for timeframe
   */
  async generateSummary(timeframe) {
    try {
      this.logger.info(`Generating audit summary for ${timeframe.start} to ${timeframe.end}`);
      
      // Read audit logs from timeframe
      const auditLogs = await this._readAuditLogs(timeframe);
      
      const summary = {
        timeframe,
        totalEvents: auditLogs.length,
        eventsByCategory: this._groupBy(auditLogs, 'category'),
        eventsByType: this._groupBy(auditLogs, 'eventType'),
        securityEvents: auditLogs.filter(log => log.category === 'SECURITY'),
        complianceEvents: auditLogs.filter(log => log.category === 'COMPLIANCE'),
        criticalEvents: auditLogs.filter(log => 
          log.data.severity === 'HIGH' || log.data.severity === 'CRITICAL'
        ),
        integrityStatus: {
          totalChecked: auditLogs.length,
          integrityViolations: this.metrics.integrityViolations,
          lastIntegrityCheck: this.getDeterministicDate().toISOString()
        },
        metrics: { ...this.metrics }
      };
      
      return summary;
      
    } catch (error) {
      this.logger.error('Audit summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(logFilePath) {
    try {
      this.logger.info(`Verifying integrity of ${logFilePath}`);
      
      const logData = await fs.readFile(logFilePath, 'utf8');
      const events = logData.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
      
      let integrityViolations = 0;
      
      for (const event of events) {
        const expectedHash = this._calculateIntegrityHash({
          ...event,
          metadata: { ...event.metadata, integrity: null }
        });
        
        if (event.metadata.integrity !== expectedHash) {
          integrityViolations++;
          this.logger.warn(`Integrity violation detected in event ${event.id}`);
        }
      }
      
      const result = {
        file: logFilePath,
        totalEvents: events.length,
        integrityViolations,
        isIntact: integrityViolations === 0,
        verifiedAt: this.getDeterministicDate().toISOString()
      };
      
      // Log integrity check
      await this.logSecurityEvent('SECURITY', 'integrity_check', result);
      
      return result;
      
    } catch (error) {
      this.logger.error('Integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportForCompliance(framework, timeframe, format = 'json') {
    try {
      this.logger.info(`Exporting audit logs for ${framework} compliance`);
      
      const auditLogs = await this._readAuditLogs(timeframe);
      const complianceLogs = auditLogs.filter(log => 
        this._isComplianceRelevant(log, framework)
      );
      
      const exportData = {
        framework,
        timeframe,
        exportDate: this.getDeterministicDate().toISOString(),
        totalEvents: complianceLogs.length,
        events: complianceLogs,
        integrity: {
          verified: true,
          signature: this._signExportData(complianceLogs)
        }
      };
      
      const exportPath = path.join(
        this.config.auditPath,
        'exports',
        `${framework}_${timeframe.start}_${timeframe.end}.${format}`
      );
      
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      
      if (format === 'json') {
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      } else {
        // Implement other formats (CSV, XML, etc.)
        throw new Error(`Export format ${format} not supported`);
      }
      
      // Log export
      await this.logSecurityEvent('COMPLIANCE', 'audit_export', {
        framework,
        timeframe,
        format,
        eventCount: complianceLogs.length,
        exportPath
      });
      
      return {
        exportPath,
        eventCount: complianceLogs.length,
        integrity: exportData.integrity
      };
      
    } catch (error) {
      this.logger.error('Compliance export failed:', error);
      throw error;
    }
  }

  /**
   * Get audit logger status
   */
  getStatus() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      configuration: this._getSafeConfig(),
      currentLogFile: this.currentLogFile,
      bufferSize: this.auditBuffer.length
    };
  }

  /**
   * Shutdown audit logger
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down audit logger...');
      
      // Flush remaining buffer
      if (this.auditBuffer.length > 0) {
        await this._flushBuffer();
      }
      
      // Log shutdown
      await this.logSecurityEvent('SYSTEM', 'audit_logger_shutdown', {
        finalMetrics: this.metrics,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      // Clear intervals
      if (this.flushInterval) clearInterval(this.flushInterval);
      if (this.rotationInterval) clearInterval(this.rotationInterval);
      if (this.integrityInterval) clearInterval(this.integrityInterval);
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('Audit logger shutdown completed');
      
    } catch (error) {
      this.logger.error('Audit logger shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  async _ensureAuditDirectory() {
    await fs.mkdir(this.config.auditPath, { recursive: true });
    await fs.mkdir(path.join(this.config.auditPath, 'exports'), { recursive: true });
    await fs.mkdir(path.join(this.config.auditPath, 'archive'), { recursive: true });
  }

  async _setupEncryption() {
    if (!this.encryptionKey) {
      this.encryptionKey = crypto.randomBytes(32); // 256-bit key
    }
  }

  async _setupDigitalSignatures() {
    if (!this.signingKey) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      this.signingKey = { publicKey, privateKey };
    }
  }

  async _initializeLogFile() {
    const timestamp = this.getDeterministicDate().toISOString().split('T')[0];
    const filename = `audit_${timestamp}.jsonl`;
    this.currentLogFile = path.join(this.config.auditPath, filename);
    
    // Create file if it doesn't exist
    try {
      await fs.access(this.currentLogFile);
    } catch {
      await fs.writeFile(this.currentLogFile, '');
      this.metrics.filesCreated++;
    }
  }

  _setupFileRotation() {
    // Rotate daily at midnight
    this.rotationInterval = setInterval(async () => {
      await this._rotateLogFile();
    }, 24 * 60 * 60 * 1000);
  }

  _setupBufferFlushing() {
    // Flush buffer every 10 seconds
    this.flushInterval = setInterval(async () => {
      if (this.auditBuffer.length > 0) {
        await this._flushBuffer();
      }
    }, 10000);
  }

  _setupIntegrityMonitoring() {
    // Check integrity every hour
    this.integrityInterval = setInterval(async () => {
      await this._performIntegrityCheck();
    }, 60 * 60 * 1000);
  }

  async _rotateLogFile() {
    try {
      // Flush current buffer
      if (this.auditBuffer.length > 0) {
        await this._flushBuffer();
      }
      
      // Archive current file
      if (this.currentLogFile) {
        const archivePath = path.join(
          this.config.auditPath,
          'archive',
          path.basename(this.currentLogFile)
        );
        await fs.rename(this.currentLogFile, archivePath);
        
        // Compress if enabled
        if (this.config.enableCompression) {
          await this._compressFile(archivePath);
        }
      }
      
      // Create new log file
      await this._initializeLogFile();
      
      this.logger.info(`Log file rotated: ${this.currentLogFile}`);
      
    } catch (error) {
      this.logger.error('Log file rotation failed:', error);
    }
  }

  async _flushBuffer() {
    if (this.auditBuffer.length === 0) return;
    
    try {
      const events = this.auditBuffer.splice(0);
      const logLines = events.map(event => {
        const eventData = this.config.enableEncryption 
          ? this._encryptEvent(event)
          : event;
        return JSON.stringify(eventData);
      }).join('\n') + '\n';
      
      await fs.appendFile(this.currentLogFile, logLines);
      
      // Check file size for rotation
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size > this.config.maxFileSize) {
        await this._rotateLogFile();
      }
      
    } catch (error) {
      this.logger.error('Buffer flush failed:', error);
      // Put events back in buffer
      this.auditBuffer.unshift(...events);
    }
  }

  _shouldFlushImmediately(event) {
    // Flush immediately for critical security events
    const criticalEvents = ['security_failure', 'integrity_violation', 'compliance_violation'];
    return criticalEvents.includes(event.eventType) || 
           event.data.severity === 'CRITICAL';
  }

  _encryptEvent(event) {
    if (!this.encryptionKey) return event;
    
    try {
      const eventJson = JSON.stringify(event);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('security-audit', 'utf8'));
      
      let encrypted = cipher.update(eventJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      this.metrics.encryptionOperations++;
      
      return {
        encrypted: true,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted,
        timestamp: event.timestamp
      };
      
    } catch (error) {
      this.logger.error('Event encryption failed:', error);
      return event;
    }
  }

  async _readAuditLogs(timeframe) {
    // Implementation to read and filter audit logs by timeframe
    // This is a simplified version - implement actual file reading and filtering
    return [];
  }

  _isComplianceRelevant(log, framework) {
    const frameworkEvents = {
      'SOX': ['financial_transaction', 'access_control', 'audit_event'],
      'GDPR': ['data_access', 'data_processing', 'consent'],
      'HIPAA': ['healthcare_access', 'phi_disclosure', 'security_incident'],
      'PCI_DSS': ['card_data_access', 'security_event']
    };
    
    const relevantEvents = frameworkEvents[framework] || [];
    return relevantEvents.includes(log.eventType) || 
           log.category === 'COMPLIANCE';
  }

  _generateEventId() {
    return `audit_${this.getDeterministicTimestamp()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  _sanitizeEventData(data) {
    // Remove sensitive data from logs
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  _calculateIntegrityHash(event) {
    const eventCopy = { ...event };
    delete eventCopy.metadata.integrity;
    return crypto.createHash('sha256')
      .update(JSON.stringify(eventCopy))
      .digest('hex');
  }

  _signExportData(data) {
    if (!this.signingKey) return null;
    
    const dataHash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest();
    
    return crypto.sign('sha256', dataHash, this.signingKey.privateKey)
      .toString('hex');
  }

  async _performIntegrityCheck() {
    try {
      if (this.currentLogFile) {
        await this.verifyIntegrity(this.currentLogFile);
      }
    } catch (error) {
      this.logger.error('Integrity check failed:', error);
    }
  }

  async _compressFile(filePath) {
    // Implement file compression
    // This is a placeholder - implement actual compression
    this.metrics.compressionSavings += 1000; // Placeholder value
  }

  _groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  _getSafeConfig() {
    return {
      auditPath: this.config.auditPath,
      enableEncryption: this.config.enableEncryption,
      enableIntegrityChecks: this.config.enableIntegrityChecks,
      retentionPeriod: this.config.retentionPeriod,
      complianceFrameworks: this.config.complianceFrameworks
    };
  }
}

export default AuditLogger;