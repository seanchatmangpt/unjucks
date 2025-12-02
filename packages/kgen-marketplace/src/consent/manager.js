/**
 * Consent Management System
 * Handles granular consent for data collection and processing
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export class ConsentManager {
  constructor(options = {}) {
    this.config = {
      consentFile: '.kgen/consent.json',
      defaultConsent: {
        build_metrics: false,
        drift_reports: false,
        usage_patterns: false,
        performance_data: false,
        error_reports: false,
        template_usage: false,
        monetization: false
      },
      ...options
    };
    
    this.consent = this.loadConsent();
  }

  /**
   * Check if user has consented to specific data collection
   */
  hasConsent(dataType) {
    return this.consent.permissions[dataType] === true;
  }

  /**
   * Update consent for specific data types
   */
  updateConsent(permissions, options = {}) {
    const timestamp = new Date().toISOString();
    const previousHash = this.consent.consentHash;
    
    this.consent = {
      ...this.consent,
      permissions: {
        ...this.consent.permissions,
        ...permissions
      },
      lastUpdated: timestamp,
      updateReason: options.reason || 'user_update',
      previousHash,
      version: this.incrementVersion(this.consent.version)
    };
    
    this.consent.consentHash = this.generateConsentHash();
    this.saveConsent();
    
    this.logConsentChange(permissions, options);
    return this.consent;
  }

  /**
   * Grant consent for data collection
   */
  grantConsent(dataTypes, purposes = [], options = {}) {
    const permissions = {};
    
    if (Array.isArray(dataTypes)) {
      dataTypes.forEach(type => {
        permissions[type] = true;
      });
    } else if (typeof dataTypes === 'string') {
      permissions[dataTypes] = true;
    } else {
      Object.assign(permissions, dataTypes);
    }
    
    return this.updateConsent(permissions, {
      ...options,
      action: 'grant',
      purposes,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Revoke consent for data collection
   */
  revokeConsent(dataTypes, options = {}) {
    const permissions = {};
    
    if (Array.isArray(dataTypes)) {
      dataTypes.forEach(type => {
        permissions[type] = false;
      });
    } else if (typeof dataTypes === 'string') {
      permissions[dataTypes] = false;
    } else {
      Object.keys(dataTypes).forEach(key => {
        permissions[key] = false;
      });
    }
    
    const result = this.updateConsent(permissions, {
      ...options,
      action: 'revoke',
      timestamp: new Date().toISOString()
    });
    
    // Trigger data deletion if requested
    if (options.deleteExisting) {
      this.triggerDataDeletion(Object.keys(permissions));
    }
    
    return result;
  }

  /**
   * Get current consent status
   */
  getConsentStatus() {
    return {
      permissions: { ...this.consent.permissions },
      lastUpdated: this.consent.lastUpdated,
      version: this.consent.version,
      consentHash: this.consent.consentHash,
      purposes: this.consent.purposes || [],
      metadata: {
        totalPermissions: Object.keys(this.consent.permissions).length,
        grantedPermissions: Object.values(this.consent.permissions).filter(Boolean).length,
        denyRatio: this.calculateDenyRatio(),
        consentAge: this.calculateConsentAge(),
        complianceStatus: this.checkComplianceStatus()
      }
    };
  }

  /**
   * Initialize consent with interactive prompts
   */
  async initializeConsent(interactive = true) {
    if (interactive) {
      return this.interactiveConsentSetup();
    } else {
      return this.createDefaultConsent();
    }
  }

  /**
   * Validate consent for specific operation
   */
  validateConsent(operation, dataTypes = []) {
    const validation = {
      valid: true,
      missing: [],
      expired: false,
      reasons: []
    };
    
    // Check if consent has expired
    if (this.isConsentExpired()) {
      validation.valid = false;
      validation.expired = true;
      validation.reasons.push('Consent has expired and needs renewal');
    }
    
    // Check required permissions
    dataTypes.forEach(type => {
      if (!this.hasConsent(type)) {
        validation.valid = false;
        validation.missing.push(type);
        validation.reasons.push(`Missing consent for ${type}`);
      }
    });
    
    // Check operation-specific requirements
    if (operation === 'monetization' && !this.hasConsent('monetization')) {
      validation.valid = false;
      validation.reasons.push('Monetization consent required');
    }
    
    return validation;
  }

  /**
   * Generate consent proof for attestation
   */
  generateConsentProof(dataTypes = []) {
    const relevantConsent = {};
    
    dataTypes.forEach(type => {
      if (this.consent.permissions[type] !== undefined) {
        relevantConsent[type] = this.consent.permissions[type];
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      consentHash: this.consent.consentHash,
      permissions: relevantConsent,
      version: this.consent.version,
      proof: this.generateCryptographicProof(relevantConsent),
      metadata: {
        userAgent: this.consent.userAgent || 'unknown',
        ipHash: this.consent.ipHash || 'unknown',
        sessionId: this.consent.sessionId || 'unknown'
      }
    };
  }

  /**
   * Handle consent withdrawal and data deletion
   */
  async handleWithdrawal(dataTypes, deleteData = true) {
    const withdrawalRecord = {
      timestamp: new Date().toISOString(),
      dataTypes,
      deleteData,
      withdrawalId: this.generateWithdrawalId(),
      status: 'pending'
    };
    
    // Revoke consent
    this.revokeConsent(dataTypes, {
      reason: 'user_withdrawal',
      withdrawalId: withdrawalRecord.withdrawalId
    });
    
    // Schedule data deletion if requested
    if (deleteData) {
      await this.scheduleDataDeletion(dataTypes, withdrawalRecord.withdrawalId);
    }
    
    // Record withdrawal
    this.recordWithdrawal(withdrawalRecord);
    
    return withdrawalRecord;
  }

  /**
   * Check GDPR compliance status
   */
  checkGDPRCompliance() {
    const compliance = {
      compliant: true,
      issues: [],
      recommendations: []
    };
    
    // Check consent age
    if (this.calculateConsentAge() > 365) { // 1 year
      compliance.compliant = false;
      compliance.issues.push('Consent is older than 1 year');
      compliance.recommendations.push('Request consent renewal');
    }
    
    // Check consent specificity
    const grantedPermissions = Object.values(this.consent.permissions).filter(Boolean).length;
    if (grantedPermissions === 0) {
      compliance.issues.push('No data collection permissions granted');
    }
    
    // Check withdrawal mechanism
    if (!this.consent.withdrawalMechanism) {
      compliance.issues.push('Withdrawal mechanism not documented');
      compliance.recommendations.push('Document withdrawal process');
    }
    
    return compliance;
  }

  /**
   * Private methods
   */
  loadConsent() {
    const consentPath = this.config.consentFile;
    
    if (!existsSync(consentPath)) {
      return this.createDefaultConsent();
    }
    
    try {
      const consentData = JSON.parse(readFileSync(consentPath, 'utf8'));
      return this.validateAndMigrateConsent(consentData);
    } catch (error) {
      console.warn('Failed to load consent file, using defaults:', error.message);
      return this.createDefaultConsent();
    }
  }

  createDefaultConsent() {
    const timestamp = new Date().toISOString();
    
    const consent = {
      version: '1.0.0',
      created: timestamp,
      lastUpdated: timestamp,
      permissions: { ...this.config.defaultConsent },
      purposes: [],
      withdrawalMechanism: 'config_file_update',
      userAgent: this.detectUserAgent(),
      ipHash: this.hashIP(),
      sessionId: this.generateSessionId(),
      consentMethod: 'default_configuration'
    };
    
    consent.consentHash = this.generateConsentHash(consent);
    return consent;
  }

  saveConsent() {
    const consentDir = require('path').dirname(this.config.consentFile);
    
    if (!existsSync(consentDir)) {
      require('fs').mkdirSync(consentDir, { recursive: true });
    }
    
    try {
      writeFileSync(this.config.consentFile, JSON.stringify(this.consent, null, 2));
    } catch (error) {
      console.error('Failed to save consent file:', error.message);
    }
  }

  generateConsentHash(consent = this.consent) {
    const hashData = {
      permissions: consent.permissions,
      version: consent.version,
      timestamp: consent.lastUpdated
    };
    
    return createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex')
      .substring(0, 16);
  }

  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  calculateDenyRatio() {
    const total = Object.keys(this.consent.permissions).length;
    const denied = Object.values(this.consent.permissions).filter(p => p === false).length;
    return total > 0 ? denied / total : 0;
  }

  calculateConsentAge() {
    const created = new Date(this.consent.created);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24)); // Days
  }

  isConsentExpired() {
    const maxAge = 365; // 1 year in days
    return this.calculateConsentAge() > maxAge;
  }

  checkComplianceStatus() {
    const gdpr = this.checkGDPRCompliance();
    
    return {
      gdpr: gdpr.compliant,
      ccpa: true, // Simplified
      overall: gdpr.compliant
    };
  }

  validateAndMigrateConsent(consentData) {
    // Migrate old consent format if needed
    if (!consentData.version) {
      consentData.version = '1.0.0';
      consentData.lastUpdated = new Date().toISOString();
    }
    
    // Ensure all required fields exist
    if (!consentData.permissions) {
      consentData.permissions = { ...this.config.defaultConsent };
    }
    
    // Add missing permission types
    Object.keys(this.config.defaultConsent).forEach(key => {
      if (consentData.permissions[key] === undefined) {
        consentData.permissions[key] = this.config.defaultConsent[key];
      }
    });
    
    return consentData;
  }

  logConsentChange(permissions, options) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: options.action || 'update',
      permissions,
      reason: options.reason || 'unknown',
      previousHash: this.consent.previousHash,
      newHash: this.consent.consentHash
    };
    
    // In a real implementation, this would write to an audit log
    console.log('Consent change logged:', logEntry);
  }

  async interactiveConsentSetup() {
    // This would use an interactive CLI in a real implementation
    // For now, return default consent
    console.log('Interactive consent setup would be implemented here');
    return this.createDefaultConsent();
  }

  triggerDataDeletion(dataTypes) {
    // This would trigger actual data deletion processes
    console.log('Data deletion triggered for:', dataTypes);
  }

  async scheduleDataDeletion(dataTypes, withdrawalId) {
    // This would schedule deletion jobs
    console.log('Data deletion scheduled for:', dataTypes, 'withdrawal:', withdrawalId);
  }

  recordWithdrawal(withdrawalRecord) {
    // This would record the withdrawal in a permanent audit log
    console.log('Withdrawal recorded:', withdrawalRecord);
  }

  generateWithdrawalId() {
    return 'withdrawal-' + createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 12);
  }

  generateCryptographicProof(consentData) {
    return createHash('sha256')
      .update(JSON.stringify(consentData) + this.consent.sessionId)
      .digest('hex');
  }

  detectUserAgent() {
    return process.env.USER_AGENT || `kgen/${process.version}`;
  }

  hashIP() {
    // In a real implementation, this would hash the actual IP
    return createHash('sha256')
      .update('localhost')
      .digest('hex')
      .substring(0, 16);
  }

  generateSessionId() {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 16);
  }
}

export default ConsentManager;