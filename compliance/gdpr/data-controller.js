/**
 * GDPR Data Controller Implementation
 * Manages personal data processing under GDPR regulations
 */

class GDPRDataController {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      dpoEmail: config.dpoEmail || 'dpo@company.com',
      lawfulBasis: config.lawfulBasis || 'consent',
      retentionPeriod: config.retentionPeriod || 365, // days
      ...config
    };
    this.processingActivities = new Map();
    this.consentRecords = new Map();
    this.dataSubjects = new Map();
  }

  /**
   * Register a data processing activity
   */
  registerProcessingActivity(activity) {
    const required = ['id', 'purpose', 'dataCategories', 'lawfulBasis', 'recipients'];
    for (const field of required) {
      if (!activity[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    this.processingActivities.set(activity.id, {
      ...activity,
      registeredAt: this.getDeterministicDate().toISOString(),
      status: 'active'
    });

    this.logEvent('processing_activity_registered', {
      activityId: activity.id,
      purpose: activity.purpose,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return activity.id;
  }

  /**
   * Record consent from data subject
   */
  recordConsent(dataSubjectId, purposes, metadata = {}) {
    const consentId = `consent_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const consentRecord = {
      id: consentId,
      dataSubjectId,
      purposes,
      timestamp: this.getDeterministicDate().toISOString(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      method: metadata.method || 'explicit',
      status: 'active',
      withdrawnAt: null
    };

    this.consentRecords.set(consentId, consentRecord);
    
    // Update data subject record
    if (!this.dataSubjects.has(dataSubjectId)) {
      this.dataSubjects.set(dataSubjectId, {
        id: dataSubjectId,
        consents: [],
        requests: [],
        lastActivity: this.getDeterministicDate().toISOString()
      });
    }
    
    const subject = this.dataSubjects.get(dataSubjectId);
    subject.consents.push(consentId);
    subject.lastActivity = this.getDeterministicDate().toISOString();

    this.logEvent('consent_recorded', {
      consentId,
      dataSubjectId,
      purposes,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return consentId;
  }

  /**
   * Withdraw consent
   */
  withdrawConsent(consentId, reason = '') {
    const consent = this.consentRecords.get(consentId);
    if (!consent) {
      throw new Error('Consent record not found');
    }

    consent.status = 'withdrawn';
    consent.withdrawnAt = this.getDeterministicDate().toISOString();
    consent.withdrawalReason = reason;

    this.logEvent('consent_withdrawn', {
      consentId,
      dataSubjectId: consent.dataSubjectId,
      reason,
      timestamp: this.getDeterministicDate().toISOString()
    });

    // Trigger data deletion if no other lawful basis
    this.assessDataRetention(consent.dataSubjectId);

    return true;
  }

  /**
   * Handle data subject access request (Article 15)
   */
  handleAccessRequest(dataSubjectId, requestId = null) {
    requestId = requestId || `sar_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subject = this.dataSubjects.get(dataSubjectId);
    if (!subject) {
      return { error: 'Data subject not found', requestId };
    }

    // Collect all data for this subject
    const personalData = {
      dataSubjectId,
      consents: subject.consents.map(id => this.consentRecords.get(id)),
      processingActivities: Array.from(this.processingActivities.values())
        .filter(activity => activity.dataSubjects?.includes(dataSubjectId)),
      dataCategories: this.getDataCategories(dataSubjectId),
      recipients: this.getDataRecipients(dataSubjectId),
      retentionPeriods: this.getRetentionPeriods(dataSubjectId),
      rights: this.getDataSubjectRights()
    };

    const request = {
      id: requestId,
      type: 'access',
      dataSubjectId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled',
      data: personalData
    };

    subject.requests.push(request);

    this.logEvent('access_request_fulfilled', {
      requestId,
      dataSubjectId,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { data: personalData, requestId };
  }

  /**
   * Handle data portability request (Article 20)
   */
  handlePortabilityRequest(dataSubjectId, format = 'json') {
    const requestId = `port_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const accessResult = this.handleAccessRequest(dataSubjectId, requestId);
    if (accessResult.error) {
      return accessResult;
    }

    // Filter to machine-readable data only
    const portableData = {
      dataSubjectId,
      exportedAt: this.getDeterministicDate().toISOString(),
      format,
      data: {
        personalData: accessResult.data.dataCategories,
        consents: accessResult.data.consents.filter(c => c.status === 'active'),
        processingActivities: accessResult.data.processingActivities
      }
    };

    this.logEvent('portability_request_fulfilled', {
      requestId,
      dataSubjectId,
      format,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { data: portableData, requestId };
  }

  /**
   * Handle erasure request (Article 17 - Right to be forgotten)
   */
  handleErasureRequest(dataSubjectId, reason = '') {
    const requestId = `erase_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subject = this.dataSubjects.get(dataSubjectId);
    if (!subject) {
      return { error: 'Data subject not found', requestId };
    }

    // Check if erasure is permitted
    const erasurePermitted = this.assessErasurePermission(dataSubjectId);
    if (!erasurePermitted.allowed) {
      return { 
        error: 'Erasure not permitted', 
        reason: erasurePermitted.reason,
        requestId 
      };
    }

    // Perform erasure
    const erasureResult = this.performErasure(dataSubjectId);

    const request = {
      id: requestId,
      type: 'erasure',
      dataSubjectId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled',
      reason,
      result: erasureResult
    };

    subject.requests.push(request);

    this.logEvent('erasure_request_fulfilled', {
      requestId,
      dataSubjectId,
      reason,
      itemsErased: erasureResult.itemsErased,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { result: erasureResult, requestId };
  }

  /**
   * Assess if data retention is still lawful
   */
  assessDataRetention(dataSubjectId) {
    const subject = this.dataSubjects.get(dataSubjectId);
    if (!subject) return false;

    const activeConsents = subject.consents
      .map(id => this.consentRecords.get(id))
      .filter(consent => consent.status === 'active');

    // If no active consents and retention period exceeded
    if (activeConsents.length === 0) {
      const lastActivity = new Date(subject.lastActivity);
      const retentionExpiry = new Date(lastActivity.getTime() + (this.config.retentionPeriod * 24 * 60 * 60 * 1000));
      
      if (this.getDeterministicDate() > retentionExpiry) {
        // Trigger automatic erasure
        this.handleErasureRequest(dataSubjectId, 'Automatic retention period expiry');
        return false;
      }
    }

    return true;
  }

  /**
   * Get data categories for a subject
   */
  getDataCategories(dataSubjectId) {
    // Implementation would integrate with actual data storage
    return [
      'identity_data',
      'contact_data',
      'transaction_data',
      'behavioral_data'
    ];
  }

  /**
   * Get data recipients for a subject
   */
  getDataRecipients(dataSubjectId) {
    return [
      'internal_teams',
      'third_party_processors',
      'analytics_providers'
    ];
  }

  /**
   * Get retention periods for different data categories
   */
  getRetentionPeriods(dataSubjectId) {
    return {
      identity_data: '5 years',
      contact_data: '2 years',
      transaction_data: '7 years',
      behavioral_data: '13 months'
    };
  }

  /**
   * Get data subject rights information
   */
  getDataSubjectRights() {
    return {
      access: 'Right to access personal data (Article 15)',
      rectification: 'Right to rectification (Article 16)',
      erasure: 'Right to erasure (Article 17)',
      restriction: 'Right to restriction of processing (Article 18)',
      portability: 'Right to data portability (Article 20)',
      objection: 'Right to object (Article 21)',
      withdrawal: 'Right to withdraw consent'
    };
  }

  /**
   * Assess if erasure is permitted
   */
  assessErasurePermission(dataSubjectId) {
    // Check legal obligations
    const legalRetention = this.checkLegalRetentionRequirements(dataSubjectId);
    if (legalRetention.required) {
      return {
        allowed: false,
        reason: `Legal retention required: ${legalRetention.reason}`
      };
    }

    return { allowed: true };
  }

  /**
   * Check legal retention requirements
   */
  checkLegalRetentionRequirements(dataSubjectId) {
    // Implementation would check various legal requirements
    return { required: false };
  }

  /**
   * Perform actual data erasure
   */
  performErasure(dataSubjectId) {
    let itemsErased = 0;

    // Remove consent records
    for (const [consentId, consent] of this.consentRecords.entries()) {
      if (consent.dataSubjectId === dataSubjectId) {
        this.consentRecords.delete(consentId);
        itemsErased++;
      }
    }

    // Remove data subject record
    if (this.dataSubjects.has(dataSubjectId)) {
      this.dataSubjects.delete(dataSubjectId);
      itemsErased++;
    }

    // In real implementation, would also erase from databases, files, etc.

    return {
      itemsErased,
      erasedAt: this.getDeterministicDate().toISOString(),
      categories: ['consent_records', 'subject_profile']
    };
  }

  /**
   * Log compliance events
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: this.getDeterministicDate().toISOString(),
      eventType,
      data,
      controller: this.config.organizationName
    };

    // In real implementation, would log to audit system
    console.log('[GDPR Audit Log]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Generate GDPR compliance report
   */
  generateComplianceReport() {
    const totalConsents = this.consentRecords.size;
    const activeConsents = Array.from(this.consentRecords.values())
      .filter(consent => consent.status === 'active').length;
    const withdrawnConsents = totalConsents - activeConsents;

    const totalSubjects = this.dataSubjects.size;
    const totalActivities = this.processingActivities.size;

    return {
      reportGeneratedAt: this.getDeterministicDate().toISOString(),
      organization: this.config.organizationName,
      summary: {
        totalDataSubjects: totalSubjects,
        totalProcessingActivities: totalActivities,
        totalConsents,
        activeConsents,
        withdrawnConsents,
        consentWithdrawalRate: totalConsents > 0 ? (withdrawnConsents / totalConsents * 100).toFixed(2) + '%' : '0%'
      },
      dataSubjectRights: {
        accessRequests: this.countRequestsByType('access'),
        erasureRequests: this.countRequestsByType('erasure'),
        portabilityRequests: this.countRequestsByType('portability')
      },
      compliance: {
        dataRetentionCompliance: this.assessOverallRetentionCompliance(),
        consentManagement: this.assessConsentManagement(),
        processingActivityRecords: this.assessProcessingActivityRecords()
      }
    };
  }

  /**
   * Count requests by type
   */
  countRequestsByType(type) {
    let count = 0;
    for (const subject of this.dataSubjects.values()) {
      count += subject.requests.filter(req => req.type === type).length;
    }
    return count;
  }

  /**
   * Assess overall retention compliance
   */
  assessOverallRetentionCompliance() {
    const subjects = Array.from(this.dataSubjects.values());
    const compliant = subjects.filter(subject => this.assessDataRetention(subject.id));
    return {
      total: subjects.length,
      compliant: compliant.length,
      complianceRate: subjects.length > 0 ? (compliant.length / subjects.length * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Assess consent management
   */
  assessConsentManagement() {
    const consents = Array.from(this.consentRecords.values());
    const validConsents = consents.filter(consent => 
      consent.purposes && consent.purposes.length > 0 && consent.timestamp
    );

    return {
      total: consents.length,
      valid: validConsents.length,
      validityRate: consents.length > 0 ? (validConsents.length / consents.length * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Assess processing activity records
   */
  assessProcessingActivityRecords() {
    const activities = Array.from(this.processingActivities.values());
    const completeActivities = activities.filter(activity => 
      activity.purpose && activity.dataCategories && activity.lawfulBasis
    );

    return {
      total: activities.length,
      complete: completeActivities.length,
      completenessRate: activities.length > 0 ? (completeActivities.length / activities.length * 100).toFixed(2) + '%' : '100%'
    };
  }
}

module.exports = GDPRDataController;