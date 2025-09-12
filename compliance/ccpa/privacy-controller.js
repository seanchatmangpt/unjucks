/**
 * CCPA Privacy Controller Implementation
 * Manages personal information under California Consumer Privacy Act
 */

class CCPAPrivacyController {
  constructor(config = {}) {
    this.config = {
      businessName: config.businessName || 'Business',
      contactEmail: config.contactEmail || 'privacy@company.com',
      businessAddress: config.businessAddress || '',
      businessPhone: config.businessPhone || '',
      verificationMethod: config.verificationMethod || 'email',
      ...config
    };
    this.consumers = new Map();
    this.requests = new Map();
    this.disclosures = new Map();
    this.salesRecords = new Map();
  }

  /**
   * Record consumer information
   */
  recordConsumer(consumerId, personalInfo = {}) {
    const consumer = {
      id: consumerId,
      personalInfo,
      categories: this.categorizePersonalInfo(personalInfo),
      sources: personalInfo.sources || [],
      businessPurposes: personalInfo.businessPurposes || [],
      thirdParties: personalInfo.thirdParties || [],
      recordedAt: this.getDeterministicDate().toISOString(),
      lastUpdated: this.getDeterministicDate().toISOString(),
      requests: [],
      optedOut: false,
      verificationMethod: this.config.verificationMethod
    };

    this.consumers.set(consumerId, consumer);

    this.logEvent('consumer_recorded', {
      consumerId,
      categories: consumer.categories,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return consumerId;
  }

  /**
   * Categorize personal information according to CCPA
   */
  categorizePersonalInfo(personalInfo) {
    const categories = [];

    if (personalInfo.name || personalInfo.alias || personalInfo.signature) {
      categories.push('identifiers');
    }
    if (personalInfo.address || personalInfo.phone || personalInfo.email) {
      categories.push('personal_info_categories');
    }
    if (personalInfo.characteristics) {
      categories.push('protected_classification_characteristics');
    }
    if (personalInfo.purchases || personalInfo.transactions) {
      categories.push('commercial_information');
    }
    if (personalInfo.browsing || personalInfo.interactions) {
      categories.push('internet_activity');
    }
    if (personalInfo.geolocation) {
      categories.push('geolocation_data');
    }
    if (personalInfo.audio || personalInfo.visual) {
      categories.push('sensory_data');
    }
    if (personalInfo.employment) {
      categories.push('professional_information');
    }
    if (personalInfo.education) {
      categories.push('education_information');
    }
    if (personalInfo.inferences) {
      categories.push('inferences');
    }

    return categories;
  }

  /**
   * Handle Right to Know request (CCPA Section 1798.110)
   */
  handleRightToKnowRequest(consumerId, requestType = 'categories', verificationData = {}) {
    const requestId = `know_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
        thirdParties: this.getCategoriesOfThirdParties()
      };
    } else if (requestType === 'specific') {
      // Provide specific pieces of personal information
      responseData = {
        personalInfo: consumer.personalInfo,
        categories: consumer.categories,
        sources: consumer.sources,
        businessPurposes: consumer.businessPurposes,
        thirdParties: consumer.thirdParties
      };
    }

    const request = {
      id: requestId,
      type: 'right_to_know',
      subtype: requestType,
      consumerId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled',
      verificationMethod: verificationResult.method,
      response: responseData
    };

    this.requests.set(requestId, request);
    consumer.requests.push(requestId);

    this.logEvent('right_to_know_fulfilled', {
      requestId,
      consumerId,
      requestType,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { data: responseData, requestId };
  }

  /**
   * Handle Right to Delete request (CCPA Section 1798.105)
   */
  handleRightToDeleteRequest(consumerId, verificationData = {}) {
    const requestId = `delete_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
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

    // Check if deletion is permitted
    const deletionPermitted = this.assessDeletionPermission(consumerId);
    if (!deletionPermitted.allowed) {
      return {
        error: 'Deletion not permitted',
        reason: deletionPermitted.reason,
        requestId
      };
    }

    // Perform deletion
    const deletionResult = this.performDeletion(consumerId);

    const request = {
      id: requestId,
      type: 'right_to_delete',
      consumerId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled',
      verificationMethod: verificationResult.method,
      result: deletionResult
    };

    this.requests.set(requestId, request);

    this.logEvent('right_to_delete_fulfilled', {
      requestId,
      consumerId,
      itemsDeleted: deletionResult.itemsDeleted,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { result: deletionResult, requestId };
  }

  /**
   * Handle Opt-Out of Sale request (CCPA Section 1798.120)
   */
  handleOptOutRequest(consumerId, verificationData = {}) {
    const requestId = `optout_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // For opt-out, verification requirements are lower
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { error: 'Consumer not found', requestId };
    }

    // Set opt-out status
    consumer.optedOut = true;
    consumer.optedOutAt = this.getDeterministicDate().toISOString();

    // Stop all current sales/sharing
    this.stopSalesForConsumer(consumerId);

    const request = {
      id: requestId,
      type: 'opt_out_of_sale',
      consumerId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled'
    };

    this.requests.set(requestId, request);
    consumer.requests.push(requestId);

    this.logEvent('opt_out_fulfilled', {
      requestId,
      consumerId,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { success: true, requestId };
  }

  /**
   * Handle Opt-In to Sale request
   */
  handleOptInRequest(consumerId, verificationData = {}) {
    const requestId = `optin_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
    consumer.optedInAt = this.getDeterministicDate().toISOString();

    const request = {
      id: requestId,
      type: 'opt_in_to_sale',
      consumerId,
      requestedAt: this.getDeterministicDate().toISOString(),
      status: 'fulfilled',
      verificationMethod: verificationResult.method
    };

    this.requests.set(requestId, request);
    consumer.requests.push(requestId);

    this.logEvent('opt_in_fulfilled', {
      requestId,
      consumerId,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return { success: true, requestId };
  }

  /**
   * Record sale of personal information
   */
  recordSale(consumerId, thirdParty, categories, value = 0, metadata = {}) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    // Check if consumer has opted out
    if (consumer.optedOut) {
      throw new Error('Consumer has opted out of sales');
    }

    const saleId = `sale_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const saleRecord = {
      id: saleId,
      consumerId,
      thirdParty,
      categories,
      value,
      saleDate: this.getDeterministicDate().toISOString(),
      metadata
    };

    this.salesRecords.set(saleId, saleRecord);

    this.logEvent('sale_recorded', {
      saleId,
      consumerId,
      thirdParty,
      categories,
      value,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return saleId;
  }

  /**
   * Stop sales for a specific consumer
   */
  stopSalesForConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) return;

    // In real implementation, would integrate with data processing systems
    // to stop ongoing sales/sharing for this consumer

    this.logEvent('sales_stopped', {
      consumerId,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Verify consumer identity
   */
  verifyConsumerIdentity(consumerId, verificationData) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      return { verified: false, reason: 'Consumer not found' };
    }

    // Implement verification logic based on method
    switch (this.config.verificationMethod) {
      case 'email':
        if (verificationData.email === consumer.personalInfo.email) {
          return { verified: true, method: 'email_match' };
        }
        break;
      case 'phone':
        if (verificationData.phone === consumer.personalInfo.phone) {
          return { verified: true, method: 'phone_match' };
        }
        break;
      case 'address':
        if (verificationData.address === consumer.personalInfo.address) {
          return { verified: true, method: 'address_match' };
        }
        break;
      default:
        // Multi-factor verification
        if (verificationData.email === consumer.personalInfo.email &&
            verificationData.phone === consumer.personalInfo.phone) {
          return { verified: true, method: 'multi_factor' };
        }
    }

    return { verified: false, reason: 'Verification data mismatch' };
  }

  /**
   * Assess if deletion is permitted
   */
  assessDeletionPermission(consumerId) {
    // Check business reasons for retaining data
    const retentionReasons = this.checkRetentionRequirements(consumerId);
    if (retentionReasons.length > 0) {
      return {
        allowed: false,
        reason: `Data retention required for: ${retentionReasons.join(', ')}`
      };
    }

    return { allowed: true };
  }

  /**
   * Check retention requirements
   */
  checkRetentionRequirements(consumerId) {
    const reasons = [];
    
    // Example retention reasons under CCPA
    // These would be implemented based on actual business needs
    
    return reasons;
  }

  /**
   * Perform actual deletion
   */
  performDeletion(consumerId) {
    let itemsDeleted = 0;

    // Delete consumer record
    if (this.consumers.has(consumerId)) {
      this.consumers.delete(consumerId);
      itemsDeleted++;
    }

    // Delete sales records
    for (const [saleId, sale] of this.salesRecords.entries()) {
      if (sale.consumerId === consumerId) {
        this.salesRecords.delete(saleId);
        itemsDeleted++;
      }
    }

    // In real implementation, would also delete from databases, files, etc.

    return {
      itemsDeleted,
      deletedAt: this.getDeterministicDate().toISOString(),
      categories: ['consumer_profile', 'sales_records']
    };
  }

  /**
   * Get categories of sources
   */
  getCategoriesOfSources() {
    return [
      'directly_from_consumer',
      'consumer_transactions',
      'consumer_website_interaction',
      'third_party_sources',
      'public_records'
    ];
  }

  /**
   * Get categories of business purposes
   */
  getCategoriesOfBusinessPurposes() {
    return [
      'providing_services',
      'security_fraud_prevention',
      'improving_services',
      'customer_service',
      'marketing',
      'legal_compliance',
      'internal_research'
    ];
  }

  /**
   * Get categories of third parties
   */
  getCategoriesOfThirdParties() {
    return [
      'service_providers',
      'advertising_partners',
      'analytics_providers',
      'payment_processors',
      'legal_advisors'
    ];
  }

  /**
   * Log compliance events
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: this.getDeterministicDate().toISOString(),
      eventType,
      data,
      business: this.config.businessName
    };

    // In real implementation, would log to audit system
    console.log('[CCPA Audit Log]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Generate CCPA compliance report
   */
  generateComplianceReport() {
    const totalConsumers = this.consumers.size;
    const optedOutConsumers = Array.from(this.consumers.values())
      .filter(consumer => consumer.optedOut).length;
    
    const totalRequests = this.requests.size;
    const requestTypes = {};
    
    for (const request of this.requests.values()) {
      requestTypes[request.type] = (requestTypes[request.type] || 0) + 1;
    }

    const totalSales = this.salesRecords.size;
    const salesValue = Array.from(this.salesRecords.values())
      .reduce((sum, sale) => sum + sale.value, 0);

    return {
      reportGeneratedAt: this.getDeterministicDate().toISOString(),
      business: this.config.businessName,
      summary: {
        totalConsumers,
        optedOutConsumers,
        optOutRate: totalConsumers > 0 ? (optedOutConsumers / totalConsumers * 100).toFixed(2) + '%' : '0%',
        totalRequests,
        requestTypes,
        totalSales,
        totalSalesValue: salesValue
      },
      consumerRights: {
        rightToKnowRequests: requestTypes.right_to_know || 0,
        rightToDeleteRequests: requestTypes.right_to_delete || 0,
        optOutRequests: requestTypes.opt_out_of_sale || 0,
        optInRequests: requestTypes.opt_in_to_sale || 0
      },
      compliance: {
        averageResponseTime: this.calculateAverageResponseTime(),
        verificationSuccessRate: this.calculateVerificationSuccessRate(),
        dataDeletionCompliance: this.assessDeletionCompliance()
      }
    };
  }

  /**
   * Calculate average response time for requests
   */
  calculateAverageResponseTime() {
    const requests = Array.from(this.requests.values());
    if (requests.length === 0) return 0;

    const responseTimes = requests.map(request => {
      const requested = new Date(request.requestedAt);
      const responded = this.getDeterministicDate(); // In real implementation, would use actual response time
      return responded - requested;
    });

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / (1000 * 60 * 60 * 24)); // Convert to days
  }

  /**
   * Calculate verification success rate
   */
  calculateVerificationSuccessRate() {
    const verificationRequests = Array.from(this.requests.values())
      .filter(req => req.verificationMethod);
    
    if (verificationRequests.length === 0) return '100%';
    
    const successful = verificationRequests.filter(req => req.status === 'fulfilled').length;
    return (successful / verificationRequests.length * 100).toFixed(2) + '%';
  }

  /**
   * Assess deletion compliance
   */
  assessDeletionCompliance() {
    const deleteRequests = Array.from(this.requests.values())
      .filter(req => req.type === 'right_to_delete');
    
    if (deleteRequests.length === 0) return '100%';
    
    const fulfilled = deleteRequests.filter(req => req.status === 'fulfilled').length;
    return (fulfilled / deleteRequests.length * 100).toFixed(2) + '%';
  }
}

module.exports = CCPAPrivacyController;