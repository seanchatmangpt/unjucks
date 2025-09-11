/**
 * Deterministic ID Generator
 * 
 * Provides content-addressed, reproducible ID generation to replace
 * non-deterministic Math.random() and Date.now() based IDs.
 */

import crypto from 'crypto';

export class DeterministicIdGenerator {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.truncateLength = options.truncateLength || 16;
    this.separator = options.separator || '_';
  }

  /**
   * Generate deterministic ID based on content inputs
   * @param {string} prefix - ID prefix (e.g., 'know', 'delete')
   * @param {...any} inputs - Content inputs to hash
   * @returns {string} Deterministic ID
   */
  generateId(prefix, ...inputs) {
    // Normalize inputs for consistent hashing
    const normalizedInputs = inputs.map(input => {
      if (input === null || input === undefined) return '';
      if (typeof input === 'object') return JSON.stringify(input, Object.keys(input).sort());
      return String(input);
    });

    const content = [prefix, ...normalizedInputs].join(':');
    const hash = crypto.createHash(this.algorithm)
      .update(content, 'utf8')
      .digest('hex')
      .slice(0, this.truncateLength);

    return `${prefix}${this.separator}${hash}`;
  }

  /**
   * Generate CCPA compliant request ID
   * @param {string} type - Request type ('know', 'delete', 'optout', 'optin')
   * @param {string} consumerId - Consumer identifier
   * @param {Object} requestData - Request specific data
   * @returns {string} Deterministic request ID
   */
  generateCCPARequestId(type, consumerId, requestData = {}) {
    return this.generateId(type, consumerId, requestData.requestType || '', requestData.purpose || '');
  }

  /**
   * Generate sale ID for CCPA compliance
   * @param {string} consumerId - Consumer identifier  
   * @param {string} thirdParty - Third party identifier
   * @param {Array} categories - Data categories
   * @returns {string} Deterministic sale ID
   */
  generateSaleId(consumerId, thirdParty, categories = []) {
    const sortedCategories = Array.isArray(categories) ? categories.sort() : [];
    return this.generateId('sale', consumerId, thirdParty, ...sortedCategories);
  }

  /**
   * Generate GDPR compliant request ID
   * @param {string} type - Request type ('sar', 'port', 'erase')
   * @param {string} subjectId - Data subject identifier
   * @param {Object} requestData - Request specific data
   * @returns {string} Deterministic request ID
   */
  generateGDPRRequestId(type, subjectId, requestData = {}) {
    return this.generateId(type, subjectId, requestData.scope || '', requestData.legalBasis || '');
  }

  /**
   * Generate consent ID for GDPR compliance
   * @param {string} subjectId - Data subject identifier
   * @param {Array} purposes - Processing purposes
   * @param {Object} context - Additional context
   * @returns {string} Deterministic consent ID
   */
  generateConsentId(subjectId, purposes = [], context = {}) {
    const sortedPurposes = Array.isArray(purposes) ? purposes.sort() : [];
    return this.generateId('consent', subjectId, ...sortedPurposes, context.legalBasis || '');
  }

  /**
   * Generate SOC2 test ID
   * @param {string} controlId - Control identifier
   * @param {string} testType - Test type
   * @param {Object} testData - Test specific data
   * @returns {string} Deterministic test ID
   */
  generateSOC2TestId(controlId, testType, testData = {}) {
    return this.generateId('test', controlId, testType, testData.frequency || '');
  }

  /**
   * Generate evidence ID for compliance
   * @param {string} controlId - Control identifier
   * @param {string} evidenceType - Evidence type
   * @param {string} source - Evidence source
   * @returns {string} Deterministic evidence ID
   */
  generateEvidenceId(controlId, evidenceType, source) {
    return this.generateId('ev', controlId, evidenceType, source);
  }

  /**
   * Generate assessment ID for risk assessments
   * @param {string} riskType - Risk type
   * @param {string} scope - Assessment scope
   * @param {Object} criteria - Assessment criteria
   * @returns {string} Deterministic assessment ID
   */
  generateAssessmentId(riskType, scope, criteria = {}) {
    const sortedCriteria = Object.keys(criteria).sort().map(k => `${k}:${criteria[k]}`).join(',');
    return this.generateId('assess', riskType, scope, sortedCriteria);
  }

  /**
   * Generate audit trail entry ID
   * @param {string} action - Action performed
   * @param {string} userId - User identifier
   * @param {string} resource - Resource affected
   * @returns {string} Deterministic audit entry ID
   */
  generateAuditId(action, userId, resource) {
    return this.generateId('audit', action, userId, resource);
  }

  /**
   * Generate archive ID for data retention
   * @param {string} dataType - Data type
   * @param {string} retentionPolicy - Retention policy identifier
   * @param {string} source - Data source
   * @returns {string} Deterministic archive ID
   */
  generateArchiveId(dataType, retentionPolicy, source) {
    return this.generateId('archive', dataType, retentionPolicy, source);
  }

  /**
   * Generate legal hold ID
   * @param {string} holdType - Hold type
   * @param {string} scope - Hold scope
   * @param {string} legalBasis - Legal basis
   * @returns {string} Deterministic legal hold ID
   */
  generateLegalHoldId(holdType, scope, legalBasis) {
    return this.generateId('hold', holdType, scope, legalBasis);
  }
}

// Export singleton instance for common usage
export const deterministicId = new DeterministicIdGenerator();

// Export class for custom configurations
export default DeterministicIdGenerator;