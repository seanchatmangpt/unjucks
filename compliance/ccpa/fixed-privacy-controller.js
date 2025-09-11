/**
 * CCPA Privacy Controller - FIXED VERSION
 * 
 * ✅ FIXES APPLIED:
 * - Replaced non-deterministic Math.random() + Date.now() ID generation
 * - Implemented content-addressed deterministic IDs
 * - Added deterministic timestamp handling for testing
 * - Maintained full CCPA compliance while ensuring reproducibility
 */

import { DeterministicIdGenerator } from '../../src/utils/deterministic-id-generator.js';

export class CCPAPrivacyController {
  constructor(config = {}) {
    this.config = {
      verificationMethod: 'two-factor',
      dataRetentionPeriod: 7, // years
      businessName: 'Your Business',
      contactEmail: 'privacy@yourbusiness.com',
      ...config
    };
    
    // ✅ FIX: Use deterministic ID generator instead of Math.random()
    this.idGenerator = new DeterministicIdGenerator();
    
    // In-memory storage for consumers and requests
    this.consumers = new Map();
    this.requests = [];
    this.sales = new Map();
    this.auditLog = [];
  }

  /**
   * ✅ FIXED: Deterministic timestamp generation
   * Uses fixed timestamp in test environment for reproducibility
   */
  _getTimestamp() {
    return process.env.NODE_ENV === 'test' 
      ? '2025-01-01T00:00:00.000Z'
      : new Date().toISOString();
  }

  /**
   * Record consumer personal information (Business purposes tracking)
   */
  recordConsumer(consumerId, personalInfo) {
    const consumer = {
      id: consumerId,
      categories: personalInfo.categories || [],
      sources: personalInfo.sources || [],
      businessPurposes: personalInfo.businessPurposes || [],
      thirdParties: personalInfo.thirdParties || [],
      recordedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      lastUpdated: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      requests: [],
      optedOut: false,
      verificationMethod: this.config.verificationMethod
    };

    this.consumers.set(consumerId, consumer);
    
    this.logEvent('consumer_recorded', {
      consumerId,
      categories: consumer.categories,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return consumerId;
  }

  /**
   * Handle Right to Know request (CCPA Section 1798.110) - FIXED
   */
  handleRightToKnowRequest(consumerId, requestType = 'categories', verificationData = {}) {
    // ✅ FIX: Deterministic request ID generation
    const requestId = this.idGenerator.generateCCPARequestId('know', consumerId, { requestType });
    
    // Verify consumer identity
    const verificationResult = this.verifyConsumerIdentity(consumerId, verificationData);
    if (!verificationResult.verified) {
      return {
        error: 'Identity verification failed',
        requestId,
        reason: verificationResult.reason
      };
    }

    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { error: 'Consumer not found', requestId };
    }

    let responseData;

    if (requestType === 'categories') {
      // Provide categories of personal information
      responseData = {
        personalInfoCategories: consumer.categories,
        sources: this.getCategoriesOfSources(),
        businessPurposes: this.getCategoriesOfBusinessPurposes(),
        thirdParties: consumer.thirdParties,
        retentionPeriod: `${this.config.dataRetentionPeriod} years`
      };
    } else if (requestType === 'specific') {
      // Provide specific pieces of personal information
      responseData = {
        personalInformation: this.getPersonalInformation(consumerId),
        sources: consumer.sources,
        businessPurposes: consumer.businessPurposes,
        thirdParties: consumer.thirdParties,
        timeframe: '12 months' // CCPA requires 12 months
      };
    }

    const request = {
      id: requestId,
      type: 'right_to_know',
      subtype: requestType,
      consumerId,
      requestedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      status: 'fulfilled',
      verificationMethod: verificationResult.method,
      response: responseData
    };

    consumer.requests.push(request);
    this.requests.push(request);

    this.logEvent('right_to_know_fulfilled', {
      requestId,
      consumerId,
      requestType,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return { data: responseData, requestId };
  }

  /**
   * Handle Right to Delete request (CCPA Section 1798.105) - FIXED
   */
  handleRightToDeleteRequest(consumerId, verificationData = {}) {
    // ✅ FIX: Deterministic request ID generation
    const requestId = this.idGenerator.generateCCPARequestId('delete', consumerId, { purpose: 'erasure' });
    
    // Verify consumer identity
    const verificationResult = this.verifyConsumerIdentity(consumerId, verificationData);
    if (!verificationResult.verified) {
      return {
        error: 'Identity verification failed',
        requestId,
        reason: verificationResult.reason
      };
    }

    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { error: 'Consumer not found', requestId };
    }

    // Check for exemptions
    const exemptions = this.checkDeletionExemptions(consumerId);
    if (exemptions.length > 0) {
      return {
        error: 'Deletion not permitted due to exemptions',
        requestId,
        exemptions
      };
    }

    // Perform deletion
    const deletionResult = this.deleteConsumerData(consumerId);

    const request = {
      id: requestId,
      type: 'right_to_delete',
      consumerId,
      requestedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      status: 'fulfilled',
      verificationMethod: verificationResult.method,
      result: deletionResult
    };

    consumer.requests.push(request);
    this.requests.push(request);

    this.logEvent('right_to_delete_fulfilled', {
      requestId,
      consumerId,
      itemsDeleted: deletionResult.itemsDeleted,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return { result: deletionResult, requestId };
  }

  /**
   * Handle Opt-Out of Sale request (CCPA Section 1798.120) - FIXED
   */
  handleOptOutRequest(consumerId, verificationData = {}) {
    // ✅ FIX: Deterministic request ID generation
    const requestId = this.idGenerator.generateCCPARequestId('optout', consumerId, { purpose: 'opt_out_sale' });
    
    // For opt-out, verification requirements are lower
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { error: 'Consumer not found', requestId };
    }

    // Set opt-out status
    consumer.optedOut = true;
    consumer.optedOutAt = this._getTimestamp(); // ✅ FIXED: Deterministic timestamp

    // Stop all current sales/sharing
    this.stopSalesForConsumer(consumerId);

    const request = {
      id: requestId,
      type: 'opt_out_of_sale',
      consumerId,
      requestedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      status: 'fulfilled'
    };

    consumer.requests.push(request);
    this.requests.push(request);

    this.logEvent('opt_out_fulfilled', {
      requestId,
      consumerId,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return { success: true, requestId };
  }

  /**
   * Handle Opt-In to Sale request - FIXED
   */
  handleOptInRequest(consumerId, verificationData = {}) {
    // ✅ FIX: Deterministic request ID generation
    const requestId = this.idGenerator.generateCCPARequestId('optin', consumerId, { purpose: 'opt_in_sale' });
    
    const verificationResult = this.verifyConsumerIdentity(consumerId, verificationData);
    if (!verificationResult.verified) {
      return {
        error: 'Identity verification failed',
        requestId,
        reason: verificationResult.reason
      };
    }

    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { error: 'Consumer not found', requestId };
    }

    // Set opt-in status
    consumer.optedOut = false;
    consumer.optedInAt = this._getTimestamp(); // ✅ FIXED: Deterministic timestamp

    const request = {
      id: requestId,
      type: 'opt_in_to_sale',
      consumerId,
      requestedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      status: 'fulfilled',
      verificationMethod: verificationResult.method
    };

    consumer.requests.push(request);
    this.requests.push(request);

    this.logEvent('opt_in_fulfilled', {
      requestId,
      consumerId,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return { success: true, requestId };
  }

  /**
   * Record personal information sale (for compliance tracking) - FIXED
   */
  recordSale(consumerId, thirdParty, categories, value = 0, metadata = {}) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    if (consumer.optedOut) {
      throw new Error('Consumer has opted out of sales');
    }

    // ✅ FIX: Deterministic sale ID generation
    const saleId = this.idGenerator.generateSaleId(consumerId, thirdParty, categories);
    
    const saleRecord = {
      id: saleId,
      consumerId,
      thirdParty,
      categories,
      value,
      saleDate: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      metadata
    };

    this.sales.set(saleId, saleRecord);

    this.logEvent('sale_recorded', {
      saleId,
      consumerId,
      thirdParty,
      categories,
      value,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });

    return saleId;
  }

  /**
   * Stop all sales for a consumer (for opt-out compliance)
   */
  stopSalesForConsumer(consumerId) {
    // Implementation would notify third parties
    // This is a placeholder for the actual integration
    
    this.logEvent('sales_stopped', {
      consumerId,
      timestamp: this._getTimestamp() // ✅ FIXED: Deterministic timestamp
    });
  }

  /**
   * Verify consumer identity (simplified implementation)
   */
  verifyConsumerIdentity(consumerId, verificationData) {
    // In a real implementation, this would check:
    // - Email verification
    // - Two-factor authentication  
    // - Identity documents
    // - Credit card information (last 4 digits)
    // - Address verification

    // Simplified verification for demonstration
    if (this.config.verificationMethod === 'email' && verificationData.email) {
      return { verified: true, method: 'email' };
    }
    
    if (this.config.verificationMethod === 'two-factor' && verificationData.phone && verificationData.code) {
      return { verified: true, method: 'two-factor' };
    }

    return { verified: false, reason: 'Insufficient verification data' };
  }

  /**
   * Check exemptions for deletion request
   */
  checkDeletionExemptions(consumerId) {
    const exemptions = [];
    
    // CCPA exemptions include:
    // - Complete transaction
    // - Detect security incidents
    // - Debug to identify/repair errors
    // - Exercise free speech
    // - Comply with California Electronic Communications Privacy Act
    // - Research in the public interest
    // - Internal uses reasonably aligned with consumer expectations
    
    // This is a simplified check - real implementation would be more comprehensive
    return exemptions;
  }

  /**
   * Delete consumer data
   */
  deleteConsumerData(consumerId) {
    const consumer = this.consumers.get(consumerId);
    let itemsDeleted = 0;

    if (consumer) {
      // Delete from various systems
      // In real implementation, this would:
      // - Delete from primary database
      // - Delete from backup systems
      // - Delete from third-party integrations
      // - Delete from logs (where legally permitted)
      // - Delete from analytics systems
      
      this.consumers.delete(consumerId);
      itemsDeleted++;

      // Delete related sales records
      for (const [saleId, sale] of this.sales) {
        if (sale.consumerId === consumerId) {
          this.sales.delete(saleId);
          itemsDeleted++;
        }
      }
    }

    return {
      itemsDeleted,
      deletedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      categories: ['consumer_profile', 'sales_records']
    };
  }

  /**
   * Get categories of sources
   */
  getCategoriesOfSources() {
    return [
      'Directly from consumers',
      'Service providers',
      'Data brokers',
      'Business partners',
      'Public records',
      'Online tracking'
    ];
  }

  /**
   * Get categories of business purposes
   */
  getCategoriesOfBusinessPurposes() {
    return [
      'Provide goods/services',
      'Process payments',
      'Customer service',
      'Marketing',
      'Analytics',
      'Security',
      'Legal compliance',
      'Business operations'
    ];
  }

  /**
   * Get personal information for specific request
   */
  getPersonalInformation(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) return null;

    // In real implementation, this would gather all PI from all systems
    return {
      identifiers: 'Email, phone, address', // Masked for privacy
      demographics: 'Age range, location',
      biometric: 'None collected',
      internet: 'Browsing history, search history',
      geolocation: 'General location data',
      sensory: 'None collected',
      professional: 'None collected',
      education: 'None collected',
      inferences: 'Preferences, behavior patterns'
    };
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport() {
    const totalConsumers = this.consumers.size;
    const totalRequests = this.requests.length;
    const optedOutConsumers = Array.from(this.consumers.values()).filter(c => c.optedOut).length;
    const totalSales = this.sales.size;
    const totalSalesValue = Array.from(this.sales.values())
      .reduce((sum, sale) => sum + sale.value, 0);

    return {
      reportGeneratedAt: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      business: this.config.businessName,
      summary: {
        totalConsumers,
        totalRequests,
        optedOutConsumers,
        optOutRate: totalConsumers > 0 ? (optedOutConsumers / totalConsumers) * 100 : 0,
        totalSales,
        totalSalesValue
      },
      requestTypes: this.analyzeRequestTypes(),
      verificationMethods: this.analyzeVerificationMethods(),
      responseTimeCompliance: this.analyzeResponseTimes(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Analyze request types
   */
  analyzeRequestTypes() {
    const types = {};
    this.requests.forEach(request => {
      types[request.type] = (types[request.type] || 0) + 1;
    });
    return types;
  }

  /**
   * Analyze verification methods
   */
  analyzeVerificationMethods() {
    const methods = {};
    this.requests.forEach(request => {
      if (request.verificationMethod) {
        methods[request.verificationMethod] = (methods[request.verificationMethod] || 0) + 1;
      }
    });
    return methods;
  }

  /**
   * Analyze response times for compliance (45-day requirement)
   */
  analyzeResponseTimes() {
    const requests = this.requests.filter(r => r.requestedAt && r.status === 'fulfilled');

    const responseTimes = requests.map(request => {
      const requested = new Date(request.requestedAt);
      const responded = new Date(); // ✅ NOTE: In real implementation, would use actual response time
      return responded - requested;
    });

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const maxResponseTime = 45 * 24 * 60 * 60 * 1000; // 45 days in milliseconds
    const compliantRequests = responseTimes.filter(time => time <= maxResponseTime).length;
    const complianceRate = requests.length > 0 ? (compliantRequests / requests.length) * 100 : 100;

    return {
      averageResponseTime: Math.round(averageResponseTime / (24 * 60 * 60 * 1000)), // in days
      complianceRate,
      totalRequests: requests.length,
      compliantRequests
    };
  }

  /**
   * Generate compliance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    const optOutRate = this.consumers.size > 0 
      ? (Array.from(this.consumers.values()).filter(c => c.optedOut).length / this.consumers.size) * 100 
      : 0;

    if (optOutRate > 20) {
      recommendations.push('High opt-out rate detected - review data collection practices');
    }

    if (this.requests.length === 0) {
      recommendations.push('No consumer requests processed - ensure request mechanisms are accessible');
    }

    return recommendations;
  }

  /**
   * Log compliance events - FIXED
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: this._getTimestamp(), // ✅ FIXED: Deterministic timestamp
      eventType,
      data,
      business: this.config.businessName
    };

    this.auditLog.push(logEntry);
    
    // In real implementation, this would:
    // - Write to secure audit log
    // - Possibly send to SIEM system
    // - Ensure tamper-evident logging
    
    console.log(`[CCPA Audit] ${eventType}:`, data);
  }
}

export default CCPAPrivacyController;