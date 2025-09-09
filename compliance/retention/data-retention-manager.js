/**
 * Data Retention Policy Manager
 * Implements automated data lifecycle management with compliance controls
 */

class DataRetentionManager {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      defaultRetentionPeriod: config.defaultRetentionPeriod || 2555, // 7 years
      autoDeleteEnabled: config.autoDeleteEnabled || false,
      backupRetentionPeriod: config.backupRetentionPeriod || 2555,
      ...config
    };
    
    this.retentionPolicies = new Map();
    this.dataInventory = new Map();
    this.retentionSchedule = new Map();
    this.legalHolds = new Map();
    this.deletionQueue = new Map();
    this.archiveStorage = new Map();
    
    this.initializeStandardPolicies();
  }

  /**
   * Initialize standard retention policies for different data types
   */
  initializeStandardPolicies() {
    // Personal Data (GDPR/CCPA)
    this.addRetentionPolicy('personal_data', {
      category: 'Personal Data',
      retentionPeriod: 1095, // 3 years
      legalBasis: 'Consent or legitimate interest',
      deletionRequired: true,
      archiveRequired: false,
      encryptionRequired: true,
      dataSubjectRights: ['access', 'rectification', 'erasure', 'portability'],
      jurisdictions: ['EU', 'California', 'Global'],
      reviewFrequency: 'annual'
    });

    // Financial Records (SOX, Tax)
    this.addRetentionPolicy('financial_records', {
      category: 'Financial Records',
      retentionPeriod: 2555, // 7 years
      legalBasis: 'Legal requirement',
      deletionRequired: false,
      archiveRequired: true,
      encryptionRequired: true,
      dataSubjectRights: [],
      jurisdictions: ['US', 'Global'],
      reviewFrequency: 'annual'
    });

    // Employee Records (HR)
    this.addRetentionPolicy('employee_records', {
      category: 'Employee Records',
      retentionPeriod: 2555, // 7 years after termination
      legalBasis: 'Legal requirement',
      deletionRequired: false,
      archiveRequired: true,
      encryptionRequired: true,
      dataSubjectRights: ['access', 'rectification'],
      jurisdictions: ['Local', 'Global'],
      reviewFrequency: 'biannual'
    });

    // Customer Communications
    this.addRetentionPolicy('customer_communications', {
      category: 'Customer Communications',
      retentionPeriod: 1825, // 5 years
      legalBasis: 'Legitimate interest',
      deletionRequired: true,
      archiveRequired: true,
      encryptionRequired: false,
      dataSubjectRights: ['access', 'erasure'],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });

    // System Logs
    this.addRetentionPolicy('system_logs', {
      category: 'System Logs',
      retentionPeriod: 1095, // 3 years
      legalBasis: 'Legitimate interest',
      deletionRequired: true,
      archiveRequired: true,
      encryptionRequired: false,
      dataSubjectRights: [],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });

    // Security Logs
    this.addRetentionPolicy('security_logs', {
      category: 'Security Logs',
      retentionPeriod: 2555, // 7 years
      legalBasis: 'Legitimate interest',
      deletionRequired: false,
      archiveRequired: true,
      encryptionRequired: true,
      dataSubjectRights: [],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });

    // Backup Data
    this.addRetentionPolicy('backup_data', {
      category: 'Backup Data',
      retentionPeriod: 365, // 1 year
      legalBasis: 'Legitimate interest',
      deletionRequired: true,
      archiveRequired: false,
      encryptionRequired: true,
      dataSubjectRights: ['erasure'],
      jurisdictions: ['Global'],
      reviewFrequency: 'quarterly'
    });

    // Marketing Data
    this.addRetentionPolicy('marketing_data', {
      category: 'Marketing Data',
      retentionPeriod: 1095, // 3 years
      legalBasis: 'Consent',
      deletionRequired: true,
      archiveRequired: false,
      encryptionRequired: true,
      dataSubjectRights: ['access', 'rectification', 'erasure', 'portability', 'objection'],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });

    // Contract Data
    this.addRetentionPolicy('contract_data', {
      category: 'Contract Data',
      retentionPeriod: 2555, // 7 years after expiration
      legalBasis: 'Contractual obligation',
      deletionRequired: false,
      archiveRequired: true,
      encryptionRequired: true,
      dataSubjectRights: ['access'],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });

    // Compliance Records
    this.addRetentionPolicy('compliance_records', {
      category: 'Compliance Records',
      retentionPeriod: 2555, // 7 years
      legalBasis: 'Legal requirement',
      deletionRequired: false,
      archiveRequired: true,
      encryptionRequired: false,
      dataSubjectRights: [],
      jurisdictions: ['Global'],
      reviewFrequency: 'annual'
    });
  }

  /**
   * Add a retention policy
   */
  addRetentionPolicy(policyId, policyDetails) {
    const policy = {
      id: policyId,
      ...policyDetails,
      createdAt: new Date().toISOString(),
      lastReviewed: new Date().toISOString(),
      status: 'active',
      version: 1
    };

    this.retentionPolicies.set(policyId, policy);
    
    this.logEvent('retention_policy_created', {
      policyId,
      category: policy.category,
      retentionPeriod: policy.retentionPeriod
    });

    return policyId;
  }

  /**
   * Register data for retention management
   */
  registerData(dataId, dataDetails) {
    if (!this.retentionPolicies.has(dataDetails.policyId)) {
      throw new Error(`Retention policy ${dataDetails.policyId} not found`);
    }

    const policy = this.retentionPolicies.get(dataDetails.policyId);
    const registrationDate = new Date().toISOString();
    
    const dataRecord = {
      id: dataId,
      policyId: dataDetails.policyId,
      category: policy.category,
      dataType: dataDetails.dataType,
      source: dataDetails.source,
      location: dataDetails.location,
      size: dataDetails.size || 0,
      format: dataDetails.format,
      sensitivity: dataDetails.sensitivity || 'normal',
      dataSubjects: dataDetails.dataSubjects || [],
      createdAt: registrationDate,
      lastAccessed: dataDetails.lastAccessed || registrationDate,
      retentionPeriod: policy.retentionPeriod,
      deletionDate: this.calculateDeletionDate(registrationDate, policy.retentionPeriod),
      status: 'active',
      metadata: dataDetails.metadata || {},
      legalHold: false
    };

    this.dataInventory.set(dataId, dataRecord);
    this.scheduleRetention(dataId, dataRecord.deletionDate);

    this.logEvent('data_registered', {
      dataId,
      category: dataRecord.category,
      policyId: dataRecord.policyId,
      deletionDate: dataRecord.deletionDate
    });

    return dataId;
  }

  /**
   * Calculate deletion date based on creation date and retention period
   */
  calculateDeletionDate(creationDate, retentionPeriodDays) {
    const deletionDate = new Date(creationDate);
    deletionDate.setDate(deletionDate.getDate() + retentionPeriodDays);
    return deletionDate.toISOString();
  }

  /**
   * Schedule data for retention processing
   */
  scheduleRetention(dataId, deletionDate) {
    this.retentionSchedule.set(dataId, {
      dataId,
      scheduledDate: deletionDate,
      processed: false,
      scheduledAt: new Date().toISOString()
    });
  }

  /**
   * Apply legal hold to data
   */
  applyLegalHold(dataIds, holdDetails) {
    const holdId = `hold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const legalHold = {
      id: holdId,
      dataIds: Array.isArray(dataIds) ? dataIds : [dataIds],
      reason: holdDetails.reason,
      requestedBy: holdDetails.requestedBy,
      approvedBy: holdDetails.approvedBy,
      legalCase: holdDetails.legalCase || null,
      jurisdiction: holdDetails.jurisdiction,
      startDate: new Date().toISOString(),
      endDate: holdDetails.endDate || null,
      status: 'active',
      reviewDate: holdDetails.reviewDate || null
    };

    this.legalHolds.set(holdId, legalHold);

    // Update data records
    legalHold.dataIds.forEach(dataId => {
      const dataRecord = this.dataInventory.get(dataId);
      if (dataRecord) {
        dataRecord.legalHold = true;
        dataRecord.legalHoldId = holdId;
        dataRecord.status = 'legal_hold';
      }
    });

    this.logEvent('legal_hold_applied', {
      holdId,
      dataIds: legalHold.dataIds,
      reason: legalHold.reason,
      requestedBy: legalHold.requestedBy
    });

    return holdId;
  }

  /**
   * Release legal hold
   */
  releaseLegalHold(holdId, releaseDetails) {
    const legalHold = this.legalHolds.get(holdId);
    if (!legalHold) {
      throw new Error(`Legal hold ${holdId} not found`);
    }

    legalHold.status = 'released';
    legalHold.endDate = new Date().toISOString();
    legalHold.releasedBy = releaseDetails.releasedBy;
    legalHold.releaseReason = releaseDetails.reason;

    // Update data records
    legalHold.dataIds.forEach(dataId => {
      const dataRecord = this.dataInventory.get(dataId);
      if (dataRecord) {
        dataRecord.legalHold = false;
        dataRecord.legalHoldId = null;
        dataRecord.status = 'active';
        
        // Reschedule for retention if applicable
        this.scheduleRetention(dataId, dataRecord.deletionDate);
      }
    });

    this.logEvent('legal_hold_released', {
      holdId,
      dataIds: legalHold.dataIds,
      releasedBy: legalHold.releasedBy,
      releaseReason: legalHold.releaseReason
    });

    return true;
  }

  /**
   * Process retention schedule
   */
  processRetentionSchedule() {
    const now = new Date();
    const processed = {
      deleted: 0,
      archived: 0,
      skipped: 0,
      errors: 0
    };

    for (const [dataId, schedule] of this.retentionSchedule.entries()) {
      if (schedule.processed) continue;
      
      const scheduledDate = new Date(schedule.scheduledDate);
      if (scheduledDate > now) continue;

      const dataRecord = this.dataInventory.get(dataId);
      if (!dataRecord) {
        schedule.processed = true;
        processed.errors++;
        continue;
      }

      // Skip if on legal hold
      if (dataRecord.legalHold) {
        processed.skipped++;
        continue;
      }

      const policy = this.retentionPolicies.get(dataRecord.policyId);
      if (!policy) {
        processed.errors++;
        continue;
      }

      try {
        if (policy.archiveRequired && !policy.deletionRequired) {
          // Archive only
          this.archiveData(dataId);
          processed.archived++;
        } else if (policy.deletionRequired) {
          if (policy.archiveRequired) {
            // Archive then delete
            this.archiveData(dataId);
            processed.archived++;
          }
          
          if (this.config.autoDeleteEnabled) {
            this.deleteData(dataId);
            processed.deleted++;
          } else {
            this.queueForDeletion(dataId);
          }
        }

        schedule.processed = true;
        schedule.processedAt = new Date().toISOString();
        
      } catch (error) {
        processed.errors++;
        this.logEvent('retention_processing_error', {
          dataId,
          error: error.message,
          scheduledDate: schedule.scheduledDate
        });
      }
    }

    this.logEvent('retention_schedule_processed', {
      processedAt: now.toISOString(),
      results: processed
    });

    return processed;
  }

  /**
   * Archive data
   */
  archiveData(dataId) {
    const dataRecord = this.dataInventory.get(dataId);
    if (!dataRecord) {
      throw new Error(`Data record ${dataId} not found`);
    }

    const archiveId = `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const archiveRecord = {
      id: archiveId,
      originalDataId: dataId,
      category: dataRecord.category,
      archivedAt: new Date().toISOString(),
      archiveLocation: this.generateArchiveLocation(dataRecord),
      originalLocation: dataRecord.location,
      size: dataRecord.size,
      checksum: this.calculateChecksum(dataRecord),
      retentionPeriod: this.config.backupRetentionPeriod,
      expirationDate: this.calculateDeletionDate(
        new Date().toISOString(), 
        this.config.backupRetentionPeriod
      ),
      metadata: dataRecord.metadata
    };

    this.archiveStorage.set(archiveId, archiveRecord);
    
    // Update original data record
    dataRecord.status = 'archived';
    dataRecord.archivedAt = archiveRecord.archivedAt;
    dataRecord.archiveId = archiveId;

    this.logEvent('data_archived', {
      dataId,
      archiveId,
      archiveLocation: archiveRecord.archiveLocation,
      originalLocation: dataRecord.location
    });

    return archiveId;
  }

  /**
   * Delete data
   */
  deleteData(dataId) {
    const dataRecord = this.dataInventory.get(dataId);
    if (!dataRecord) {
      throw new Error(`Data record ${dataId} not found`);
    }

    if (dataRecord.legalHold) {
      throw new Error(`Cannot delete data ${dataId} - legal hold active`);
    }

    // In real implementation, would perform actual data deletion
    const deletionRecord = {
      dataId,
      deletedAt: new Date().toISOString(),
      originalLocation: dataRecord.location,
      category: dataRecord.category,
      size: dataRecord.size,
      deletionMethod: 'secure_deletion',
      verificationHash: this.calculateChecksum(dataRecord)
    };

    // Update data record
    dataRecord.status = 'deleted';
    dataRecord.deletedAt = deletionRecord.deletedAt;

    // Remove from active inventory
    this.dataInventory.delete(dataId);

    this.logEvent('data_deleted', {
      dataId,
      deletedAt: deletionRecord.deletedAt,
      location: dataRecord.location,
      category: dataRecord.category
    });

    return deletionRecord;
  }

  /**
   * Queue data for manual deletion
   */
  queueForDeletion(dataId) {
    const dataRecord = this.dataInventory.get(dataId);
    if (!dataRecord) {
      throw new Error(`Data record ${dataId} not found`);
    }

    const queueEntry = {
      dataId,
      queuedAt: new Date().toISOString(),
      category: dataRecord.category,
      location: dataRecord.location,
      size: dataRecord.size,
      reason: 'retention_period_expired',
      priority: this.calculateDeletionPriority(dataRecord),
      approvalRequired: true,
      status: 'pending'
    };

    this.deletionQueue.set(dataId, queueEntry);
    
    // Update data record
    dataRecord.status = 'deletion_queued';
    dataRecord.queuedAt = queueEntry.queuedAt;

    this.logEvent('data_queued_for_deletion', {
      dataId,
      queuedAt: queueEntry.queuedAt,
      priority: queueEntry.priority
    });

    return true;
  }

  /**
   * Calculate deletion priority
   */
  calculateDeletionPriority(dataRecord) {
    const policy = this.retentionPolicies.get(dataRecord.policyId);
    
    if (dataRecord.sensitivity === 'high' || policy.category === 'Personal Data') {
      return 'high';
    }
    if (dataRecord.sensitivity === 'medium' || dataRecord.dataSubjects.length > 0) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate archive location
   */
  generateArchiveLocation(dataRecord) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `archive/${year}/${month}/${dataRecord.category}/${dataRecord.id}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  calculateChecksum(dataRecord) {
    // In real implementation, would calculate actual file checksum
    const crypto = require('crypto');
    const data = JSON.stringify({
      id: dataRecord.id,
      location: dataRecord.location,
      size: dataRecord.size,
      createdAt: dataRecord.createdAt
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate data inventory report
   */
  generateInventoryReport() {
    const totalData = this.dataInventory.size;
    const categoryBreakdown = {};
    const statusBreakdown = {};
    const policyBreakdown = {};
    let totalSize = 0;

    for (const dataRecord of this.dataInventory.values()) {
      // Category breakdown
      categoryBreakdown[dataRecord.category] = (categoryBreakdown[dataRecord.category] || 0) + 1;
      
      // Status breakdown
      statusBreakdown[dataRecord.status] = (statusBreakdown[dataRecord.status] || 0) + 1;
      
      // Policy breakdown
      policyBreakdown[dataRecord.policyId] = (policyBreakdown[dataRecord.policyId] || 0) + 1;
      
      // Total size
      totalSize += dataRecord.size || 0;
    }

    const upcomingDeletions = Array.from(this.retentionSchedule.values())
      .filter(schedule => !schedule.processed)
      .filter(schedule => {
        const scheduledDate = new Date(schedule.scheduledDate);
        const thirtyDaysFromNow = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
        return scheduledDate <= thirtyDaysFromNow;
      }).length;

    return {
      reportDate: new Date().toISOString(),
      organization: this.config.organizationName,
      summary: {
        totalDataRecords: totalData,
        totalSizeBytes: totalSize,
        totalPolicies: this.retentionPolicies.size,
        activeLegalHolds: Array.from(this.legalHolds.values()).filter(h => h.status === 'active').length,
        upcomingDeletions,
        queuedForDeletion: this.deletionQueue.size,
        archivedRecords: this.archiveStorage.size
      },
      breakdowns: {
        byCategory: categoryBreakdown,
        byStatus: statusBreakdown,
        byPolicy: policyBreakdown
      },
      compliance: {
        dataSubjectRights: this.assessDataSubjectRights(),
        retentionCompliance: this.assessRetentionCompliance(),
        legalHoldCompliance: this.assessLegalHoldCompliance()
      }
    };
  }

  /**
   * Assess data subject rights compliance
   */
  assessDataSubjectRights() {
    const personalDataRecords = Array.from(this.dataInventory.values())
      .filter(record => record.dataSubjects.length > 0);
    
    const totalPersonalData = personalDataRecords.length;
    const rightsCompliant = personalDataRecords.filter(record => {
      const policy = this.retentionPolicies.get(record.policyId);
      return policy && policy.dataSubjectRights.length > 0;
    }).length;

    return {
      totalPersonalDataRecords: totalPersonalData,
      rightsCompliantRecords: rightsCompliant,
      complianceRate: totalPersonalData > 0 ? 
        (rightsCompliant / totalPersonalData * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Assess retention compliance
   */
  assessRetentionCompliance() {
    const activeRecords = Array.from(this.dataInventory.values())
      .filter(record => record.status === 'active');
    
    const now = new Date();
    const overdue = activeRecords.filter(record => 
      new Date(record.deletionDate) < now && !record.legalHold
    ).length;

    return {
      totalActiveRecords: activeRecords.length,
      overdueForRetention: overdue,
      complianceRate: activeRecords.length > 0 ? 
        ((activeRecords.length - overdue) / activeRecords.length * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Assess legal hold compliance
   */
  assessLegalHoldCompliance() {
    const activeLegalHolds = Array.from(this.legalHolds.values())
      .filter(hold => hold.status === 'active');
    
    const expiredHolds = activeLegalHolds.filter(hold => {
      if (!hold.reviewDate) return false;
      return new Date(hold.reviewDate) < new Date();
    }).length;

    return {
      activeLegalHolds: activeLegalHolds.length,
      expiredHolds,
      reviewCompliance: activeLegalHolds.length > 0 ? 
        ((activeLegalHolds.length - expiredHolds) / activeLegalHolds.length * 100).toFixed(2) + '%' : '100%'
    };
  }

  /**
   * Log events
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      data,
      organization: this.config.organizationName
    };

    console.log('[Data Retention Log]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Get retention policy by ID
   */
  getRetentionPolicy(policyId) {
    return this.retentionPolicies.get(policyId);
  }

  /**
   * Get data record by ID
   */
  getDataRecord(dataId) {
    return this.dataInventory.get(dataId);
  }

  /**
   * Get deletion queue
   */
  getDeletionQueue() {
    return Array.from(this.deletionQueue.values());
  }

  /**
   * Get active legal holds
   */
  getActiveLegalHolds() {
    return Array.from(this.legalHolds.values())
      .filter(hold => hold.status === 'active');
  }
}

module.exports = DataRetentionManager;