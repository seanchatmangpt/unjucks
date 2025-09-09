/**
 * Comprehensive Audit Trail System
 * Provides immutable logging and reporting for compliance audits
 */

const crypto = require('crypto');

class AuditTrail {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      retentionPeriod: config.retentionPeriod || 2555, // 7 years in days
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      encryptionEnabled: config.encryptionEnabled || true,
      encryptionKey: config.encryptionKey || this.generateEncryptionKey(),
      ...config
    };
    
    this.auditLogs = new Map();
    this.logIndex = new Map(); // For fast searching
    this.chainHashes = new Map(); // For integrity verification
    this.retentionSchedule = new Map();
    
    this.initializeAuditCategories();
  }

  /**
   * Initialize audit event categories and their retention requirements
   */
  initializeAuditCategories() {
    this.auditCategories = {
      // Security events
      'authentication': { retention: 2555, priority: 'high', requiresEncryption: true },
      'authorization': { retention: 2555, priority: 'high', requiresEncryption: true },
      'access_control': { retention: 2555, priority: 'high', requiresEncryption: true },
      'privilege_escalation': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'security_incident': { retention: 2555, priority: 'critical', requiresEncryption: true },
      
      // Data events
      'data_access': { retention: 2555, priority: 'high', requiresEncryption: true },
      'data_modification': { retention: 2555, priority: 'high', requiresEncryption: true },
      'data_deletion': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'data_export': { retention: 2555, priority: 'high', requiresEncryption: true },
      'data_backup': { retention: 1825, priority: 'medium', requiresEncryption: false },
      
      // System events
      'system_startup': { retention: 1095, priority: 'medium', requiresEncryption: false },
      'system_shutdown': { retention: 1095, priority: 'medium', requiresEncryption: false },
      'configuration_change': { retention: 2555, priority: 'high', requiresEncryption: false },
      'software_installation': { retention: 1825, priority: 'medium', requiresEncryption: false },
      'system_error': { retention: 1095, priority: 'medium', requiresEncryption: false },
      
      // Compliance events
      'gdpr_request': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'ccpa_request': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'soc2_control_test': { retention: 2555, priority: 'high', requiresEncryption: false },
      'compliance_violation': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'audit_access': { retention: 2555, priority: 'high', requiresEncryption: true },
      
      // Business events
      'transaction': { retention: 2555, priority: 'high', requiresEncryption: true },
      'financial_record': { retention: 2555, priority: 'critical', requiresEncryption: true },
      'contract_execution': { retention: 2555, priority: 'high', requiresEncryption: true },
      'payment_processing': { retention: 2555, priority: 'critical', requiresEncryption: true },
      
      // Administrative events
      'user_management': { retention: 2555, priority: 'high', requiresEncryption: true },
      'policy_change': { retention: 2555, priority: 'high', requiresEncryption: false },
      'training_completion': { retention: 1825, priority: 'medium', requiresEncryption: false },
      'vendor_access': { retention: 2555, priority: 'high', requiresEncryption: true }
    };
  }

  /**
   * Log an audit event
   */
  logEvent(category, eventType, details = {}) {
    const eventId = this.generateEventId();
    const timestamp = new Date().toISOString();
    
    // Validate category
    if (!this.auditCategories[category]) {
      throw new Error(`Invalid audit category: ${category}`);
    }

    const categoryConfig = this.auditCategories[category];
    
    const auditEvent = {
      id: eventId,
      timestamp,
      category,
      eventType,
      priority: categoryConfig.priority,
      source: details.source || 'system',
      userId: details.userId || null,
      sessionId: details.sessionId || null,
      ipAddress: details.ipAddress || null,
      userAgent: details.userAgent || null,
      resourceId: details.resourceId || null,
      resourceType: details.resourceType || null,
      action: details.action || null,
      outcome: details.outcome || 'success', // success, failure, error
      details: details.additionalDetails || {},
      metadata: {
        organizationName: this.config.organizationName,
        retentionDays: categoryConfig.retention,
        requiresEncryption: categoryConfig.requiresEncryption,
        logVersion: '1.0'
      },
      integrity: {
        hash: null,
        previousHash: null,
        chainPosition: this.auditLogs.size
      }
    };

    // Add geolocation if IP is provided
    if (auditEvent.ipAddress) {
      auditEvent.geolocation = this.getGeolocation(auditEvent.ipAddress);
    }

    // Encrypt sensitive data if required
    if (categoryConfig.requiresEncryption && this.config.encryptionEnabled) {
      auditEvent.encrypted = true;
      auditEvent.details = this.encryptData(auditEvent.details);
      if (auditEvent.userId) {
        auditEvent.userId = this.encryptData(auditEvent.userId);
      }
    }

    // Get previous hash before calculating current hash
    const previousHash = this.getLastEventHash();
    auditEvent.integrity.previousHash = previousHash;
    
    // Calculate integrity hash including previous hash for proper chaining
    auditEvent.integrity.hash = this.calculateEventHash(auditEvent, previousHash);

    // Store the event
    this.auditLogs.set(eventId, auditEvent);
    
    // Update chain hash
    this.chainHashes.set(auditEvent.integrity.chainPosition, auditEvent.integrity.hash);
    
    // Index for searching
    this.indexEvent(auditEvent);
    
    // Schedule retention
    this.scheduleRetention(eventId, categoryConfig.retention);
    
    // Trigger real-time monitoring if critical
    if (categoryConfig.priority === 'critical') {
      this.triggerRealTimeAlert(auditEvent);
    }

    return eventId;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Calculate event hash for integrity
   */
  calculateEventHash(event, previousHash = null) {
    // Create a deep copy without the hash fields for calculation
    const hashableEvent = JSON.parse(JSON.stringify(event));
    delete hashableEvent.integrity;
    
    // Include previous hash in current hash calculation for chain integrity
    const dataToHash = {
      previousHash: previousHash || '',
      eventData: hashableEvent
    };
    
    const eventString = JSON.stringify(dataToHash);
    
    return crypto.createHash(this.config.hashAlgorithm).update(eventString).digest('hex');
  }

  /**
   * Get hash of last event in chain
   */
  getLastEventHash() {
    const lastPosition = this.auditLogs.size - 1;
    return this.chainHashes.get(lastPosition) || null;
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data) {
    if (!this.config.encryptionEnabled) return data;
    
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.config.encryptionKey);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      algorithm,
      iv: iv.toString('hex'),
      data: encrypted,
      encrypted: true
    };
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData) {
    if (!encryptedData.encrypted) return encryptedData;
    
    const decipher = crypto.createDecipher(encryptedData.algorithm, this.config.encryptionKey);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Index event for fast searching
   */
  indexEvent(event) {
    // Index by category
    if (!this.logIndex.has('category')) {
      this.logIndex.set('category', new Map());
    }
    const categoryIndex = this.logIndex.get('category');
    if (!categoryIndex.has(event.category)) {
      categoryIndex.set(event.category, []);
    }
    categoryIndex.get(event.category).push(event.id);

    // Index by user ID
    if (event.userId) {
      if (!this.logIndex.has('userId')) {
        this.logIndex.set('userId', new Map());
      }
      const userIndex = this.logIndex.get('userId');
      if (!userIndex.has(event.userId)) {
        userIndex.set(event.userId, []);
      }
      userIndex.get(event.userId).push(event.id);
    }

    // Index by date
    const dateKey = event.timestamp.split('T')[0];
    if (!this.logIndex.has('date')) {
      this.logIndex.set('date', new Map());
    }
    const dateIndex = this.logIndex.get('date');
    if (!dateIndex.has(dateKey)) {
      dateIndex.set(dateKey, []);
    }
    dateIndex.get(dateKey).push(event.id);

    // Index by priority
    if (!this.logIndex.has('priority')) {
      this.logIndex.set('priority', new Map());
    }
    const priorityIndex = this.logIndex.get('priority');
    if (!priorityIndex.has(event.priority)) {
      priorityIndex.set(event.priority, []);
    }
    priorityIndex.get(event.priority).push(event.id);
  }

  /**
   * Schedule retention for event
   */
  scheduleRetention(eventId, retentionDays) {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + retentionDays);
    
    this.retentionSchedule.set(eventId, retentionDate.toISOString());
  }

  /**
   * Search audit logs
   */
  searchLogs(criteria = {}) {
    let results = [];

    if (criteria.category) {
      const categoryIndex = this.logIndex.get('category');
      if (categoryIndex && categoryIndex.has(criteria.category)) {
        results = categoryIndex.get(criteria.category);
      }
    } else if (criteria.userId) {
      const userIndex = this.logIndex.get('userId');
      if (userIndex && userIndex.has(criteria.userId)) {
        results = userIndex.get(criteria.userId);
      }
    } else if (criteria.priority) {
      const priorityIndex = this.logIndex.get('priority');
      if (priorityIndex && priorityIndex.has(criteria.priority)) {
        results = priorityIndex.get(criteria.priority);
      }
    } else {
      // Return all event IDs
      results = Array.from(this.auditLogs.keys());
    }

    // Apply date filter
    if (criteria.startDate || criteria.endDate) {
      results = results.filter(eventId => {
        const event = this.auditLogs.get(eventId);
        const eventDate = new Date(event.timestamp);
        
        if (criteria.startDate && eventDate < new Date(criteria.startDate)) {
          return false;
        }
        if (criteria.endDate && eventDate > new Date(criteria.endDate)) {
          return false;
        }
        return true;
      });
    }

    // Apply outcome filter
    if (criteria.outcome) {
      results = results.filter(eventId => {
        const event = this.auditLogs.get(eventId);
        return event.outcome === criteria.outcome;
      });
    }

    // Apply limit
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    // Return event objects
    return results.map(eventId => {
      const event = this.auditLogs.get(eventId);
      
      // Decrypt if needed and authorized
      if (event.encrypted && criteria.decrypt === true) {
        const decryptedEvent = { ...event };
        decryptedEvent.details = this.decryptData(event.details);
        if (event.userId && typeof event.userId === 'object') {
          decryptedEvent.userId = this.decryptData(event.userId);
        }
        return decryptedEvent;
      }
      
      return event;
    });
  }

  /**
   * Verify audit trail integrity
   */
  verifyIntegrity() {
    const issues = [];
    const events = Array.from(this.auditLogs.values()).sort((a, b) => 
      a.integrity.chainPosition - b.integrity.chainPosition
    );

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // Verify event hash by recalculating with same previous hash
      const expectedHash = this.calculateEventHash(event, event.integrity.previousHash);
      if (event.integrity.hash !== expectedHash) {
        issues.push({
          type: 'hash_mismatch',
          eventId: event.id,
          position: event.integrity.chainPosition,
          expected: expectedHash,
          actual: event.integrity.hash
        });
      }

      // Verify chain linkage
      if (i > 0) {
        const previousEvent = events[i - 1];
        if (event.integrity.previousHash !== previousEvent.integrity.hash) {
          issues.push({
            type: 'chain_break',
            eventId: event.id,
            position: event.integrity.chainPosition,
            expectedPrevious: previousEvent.integrity.hash,
            actualPrevious: event.integrity.previousHash
          });
        }
      }
    }

    return {
      verified: issues.length === 0,
      totalEvents: events.length,
      issues,
      verificationDate: new Date().toISOString()
    };
  }

  /**
   * Generate audit report
   */
  generateAuditReport(criteria = {}) {
    const startDate = criteria.startDate || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
    const endDate = criteria.endDate || new Date().toISOString();
    
    const events = this.searchLogs({ startDate, endDate });
    
    // Category breakdown
    const categoryBreakdown = {};
    const priorityBreakdown = {};
    const outcomeBreakdown = {};
    const dailyActivity = {};

    events.forEach(event => {
      // Category counts
      categoryBreakdown[event.category] = (categoryBreakdown[event.category] || 0) + 1;
      
      // Priority counts
      priorityBreakdown[event.priority] = (priorityBreakdown[event.priority] || 0) + 1;
      
      // Outcome counts
      outcomeBreakdown[event.outcome] = (outcomeBreakdown[event.outcome] || 0) + 1;
      
      // Daily activity
      const dateKey = event.timestamp.split('T')[0];
      dailyActivity[dateKey] = (dailyActivity[dateKey] || 0) + 1;
    });

    // Security metrics
    const securityEvents = events.filter(e => 
      ['authentication', 'authorization', 'access_control', 'privilege_escalation', 'security_incident']
      .includes(e.category)
    );
    
    const failedSecurityEvents = securityEvents.filter(e => e.outcome === 'failure');
    
    // Compliance metrics
    const complianceEvents = events.filter(e => 
      ['gdpr_request', 'ccpa_request', 'soc2_control_test', 'compliance_violation']
      .includes(e.category)
    );

    return {
      reportPeriod: {
        startDate,
        endDate,
        durationDays: Math.ceil((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000))
      },
      summary: {
        totalEvents: events.length,
        uniqueUsers: new Set(events.filter(e => e.userId).map(e => e.userId)).size,
        criticalEvents: events.filter(e => e.priority === 'critical').length,
        failedEvents: events.filter(e => e.outcome === 'failure').length
      },
      breakdowns: {
        byCategory: categoryBreakdown,
        byPriority: priorityBreakdown,
        byOutcome: outcomeBreakdown,
        dailyActivity
      },
      security: {
        totalSecurityEvents: securityEvents.length,
        failedSecurityEvents: failedSecurityEvents.length,
        securityFailureRate: securityEvents.length > 0 ? 
          (failedSecurityEvents.length / securityEvents.length * 100).toFixed(2) + '%' : '0%'
      },
      compliance: {
        totalComplianceEvents: complianceEvents.length,
        gdprRequests: events.filter(e => e.category === 'gdpr_request').length,
        ccpaRequests: events.filter(e => e.category === 'ccpa_request').length,
        complianceViolations: events.filter(e => e.category === 'compliance_violation').length
      },
      integrity: this.verifyIntegrity(),
      generatedAt: new Date().toISOString(),
      generatedBy: criteria.auditor || 'system'
    };
  }

  /**
   * Export audit logs for external audit
   */
  exportAuditLogs(criteria = {}) {
    const events = this.searchLogs(criteria);
    
    // Anonymize sensitive data for export if requested
    if (criteria.anonymize) {
      events.forEach(event => {
        if (event.userId && !event.encrypted) {
          event.userId = this.anonymizeUserId(event.userId);
        }
        if (event.ipAddress) {
          event.ipAddress = this.anonymizeIpAddress(event.ipAddress);
        }
      });
    }

    return {
      exportDate: new Date().toISOString(),
      organization: this.config.organizationName,
      criteria,
      eventCount: events.length,
      events,
      integrity: this.verifyIntegrity(),
      retention: {
        policy: 'Events retained according to category-specific retention periods',
        categories: this.auditCategories
      }
    };
  }

  /**
   * Anonymize user ID for export
   */
  anonymizeUserId(userId) {
    return crypto.createHash('sha256').update(userId + 'anonymization_salt').digest('hex').substr(0, 16);
  }

  /**
   * Anonymize IP address
   */
  anonymizeIpAddress(ipAddress) {
    // Zero out last octet for IPv4
    if (ipAddress.includes('.')) {
      const parts = ipAddress.split('.');
      parts[3] = '0';
      return parts.join('.');
    }
    // Truncate IPv6
    if (ipAddress.includes(':')) {
      const parts = ipAddress.split(':');
      return parts.slice(0, 4).join(':') + '::';
    }
    return 'anonymized';
  }

  /**
   * Get geolocation for IP (mock implementation)
   */
  getGeolocation(ipAddress) {
    // In real implementation, would use geolocation service
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      provider: 'geolocation_service'
    };
  }

  /**
   * Trigger real-time alert for critical events
   */
  triggerRealTimeAlert(event) {
    // In real implementation, would integrate with alerting system
    console.log('[CRITICAL AUDIT ALERT]', {
      eventId: event.id,
      category: event.category,
      eventType: event.eventType,
      timestamp: event.timestamp,
      outcome: event.outcome
    });
  }

  /**
   * Process retention schedule
   */
  processRetentionSchedule() {
    const now = new Date();
    const expiredEvents = [];

    for (const [eventId, retentionDate] of this.retentionSchedule.entries()) {
      if (new Date(retentionDate) <= now) {
        expiredEvents.push(eventId);
      }
    }

    // Archive expired events (in real implementation, would move to archive storage)
    const archivedCount = expiredEvents.length;
    expiredEvents.forEach(eventId => {
      this.auditLogs.delete(eventId);
      this.retentionSchedule.delete(eventId);
    });

    if (archivedCount > 0) {
      this.logEvent('system', 'audit_retention_processed', {
        action: 'archive_expired_events',
        archivedCount,
        additionalDetails: { processedAt: now.toISOString() }
      });
    }

    return { archivedCount, processedAt: now.toISOString() };
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = AuditTrail;