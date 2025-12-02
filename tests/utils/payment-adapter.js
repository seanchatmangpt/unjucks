const crypto = require('crypto');
const { performance } = require('perf_hooks');
const TestDataFactory = require('../fixtures/test-data-factory');

class PaymentAdapter {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.testMode = options.testMode !== false; // Default to test mode
    
    // Internal state for testing
    this._adapters = new Map();
    this._transactions = new Map();
    this._subscriptions = new Map();
    this._refunds = new Map();
    this._auditTrail = [];
    this._fraudDetection = {
      enabled: true,
      rules: new Map()
    };
    this._revenueSharing = new Map();
    this._taxRates = new Map();
    
    // Initialize default adapters
    this._initializeAdapters();
    this._initializeFraudRules();
    this._initializeTaxRates();
  }

  _initializeAdapters() {
    const adapters = TestDataFactory.createPaymentAdapterStubs();
    
    Object.entries(adapters).forEach(([key, adapter]) => {
      this._adapters.set(adapter.name, adapter);
    });
  }

  _initializeFraudRules() {
    this._fraudDetection.rules.set('multiple_attempts', {
      threshold: 5,
      timeWindow: 60000, // 1 minute
      riskScore: 0.8
    });
    
    this._fraudDetection.rules.set('high_value_purchase', {
      threshold: 500,
      riskScore: 0.6
    });
    
    this._fraudDetection.rules.set('new_payment_method', {
      riskScore: 0.4
    });
  }

  _initializeTaxRates() {
    this._taxRates.set('US-CA', 0.085); // California sales tax
    this._taxRates.set('US-NY', 0.08);  // New York sales tax
    this._taxRates.set('US-TX', 0.0625); // Texas sales tax
    this._taxRates.set('CA-ON', 0.13);   // Ontario HST
    this._taxRates.set('GB', 0.20);      // UK VAT
  }

  async checkHealth() {
    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      adapters: Array.from(this._adapters.values()).map(adapter => ({
        name: adapter.name,
        status: adapter.configured ? 'ready' : 'not_configured'
      }))
    };
  }

  async getAvailableAdapters() {
    return Array.from(this._adapters.values()).filter(adapter => adapter.configured);
  }

  async getAdapterStatus(adapterName) {
    const adapter = this._adapters.get(adapterName);
    return {
      configured: adapter ? adapter.configured : false,
      testMode: this.testMode,
      available: adapter ? true : false
    };
  }

  async processPayment(amount, paymentInfo) {
    const startTime = performance.now();
    
    // Mock payment decline if configured
    if (this._shouldDeclinePayment) {
      throw this._createPaymentError('card_declined', 'Payment was declined');
    }
    
    // Fraud detection
    const fraudCheck = await this._performFraudCheck(amount, paymentInfo);
    if (fraudCheck.blocked) {
      throw this._createPaymentError('fraud_detected', 'Payment blocked due to fraud detection');
    }
    
    // Simulate payment processing time
    await this._delay(Math.random() * 2000 + 500); // 0.5-2.5 seconds
    
    const transactionId = this._generateTransactionId();
    const adapter = this._adapters.get(paymentInfo.provider);
    
    const transaction = {
      id: transactionId,
      amount: amount,
      currency: 'USD',
      status: 'completed',
      paymentMethod: paymentInfo.method,
      adapterUsed: paymentInfo.provider,
      fees: this._calculateFees(amount, adapter),
      timestamp: new Date().toISOString(),
      processingTime: performance.now() - startTime,
      fraudScore: fraudCheck.riskScore
    };
    
    this._transactions.set(transactionId, transaction);
    this._addToAuditTrail('payment_processed', transaction);
    
    return {
      success: true,
      transactionId: transactionId,
      adapterUsed: paymentInfo.provider,
      fees: transaction.fees
    };
  }

  async processRefund(refundRequest) {
    const originalTransaction = this._transactions.get(refundRequest.transactionId);
    if (!originalTransaction) {
      throw new Error('Original transaction not found');
    }
    
    const refundId = this._generateTransactionId();
    const refund = {
      id: refundId,
      originalTransactionId: refundRequest.transactionId,
      amount: refundRequest.amount,
      reason: refundRequest.reason,
      status: 'approved',
      estimatedProcessingTime: 5, // business days
      timestamp: new Date().toISOString()
    };
    
    this._refunds.set(refundId, refund);
    this._addToAuditTrail('refund_processed', refund);
    
    return {
      success: true,
      refundId: refundId,
      status: 'approved',
      estimatedProcessingTime: 5,
      confirmationEmail: 'sent',
      refundAmount: refundRequest.amount
    };
  }

  async evaluatePaymentPolicy(kpack, customerProfile, licenseCount = 1) {
    const basePrice = kpack.pricing?.amount || 0;
    let finalPrice = basePrice * licenseCount;
    const discounts = [];
    
    // Apply enterprise discount
    if (customerProfile.type === 'enterprise' && kpack.paymentPolicy?.enterprise_discount) {
      const discount = kpack.paymentPolicy.enterprise_discount;
      const discountAmount = finalPrice * discount;
      finalPrice -= discountAmount;
      discounts.push({
        type: 'enterprise',
        rate: discount,
        amount: discountAmount
      });
    }
    
    // Apply volume pricing
    if (kpack.paymentPolicy?.volume_pricing && licenseCount >= kpack.paymentPolicy.volume_pricing.threshold) {
      const volumeDiscount = kpack.paymentPolicy.volume_pricing.discount;
      const discountAmount = finalPrice * volumeDiscount;
      finalPrice -= discountAmount;
      discounts.push({
        type: 'volume',
        rate: volumeDiscount,
        amount: discountAmount
      });
    }
    
    return {
      basePrice: basePrice,
      finalPrice: finalPrice,
      licenseCount: licenseCount,
      discounts: discounts,
      enterpriseDiscount: {
        applied: customerProfile.type === 'enterprise',
        rate: kpack.paymentPolicy?.enterprise_discount || 0
      },
      volumePricing: {
        applied: licenseCount >= (kpack.paymentPolicy?.volume_pricing?.threshold || Infinity),
        threshold: kpack.paymentPolicy?.volume_pricing?.threshold || 0
      },
      terms: {
        trialPeriod: kpack.paymentPolicy?.trial_period || 0,
        refundPeriod: kpack.paymentPolicy?.refund_period || 0
      }
    };
  }

  async distributeRevenue(totalRevenue, revenueModel) {
    const distributions = {};
    
    Object.entries(revenueModel).forEach(([party, percentage]) => {
      distributions[party] = totalRevenue * percentage;
    });
    
    const distribution = {
      totalRevenue: totalRevenue,
      distributions: distributions,
      distributedAt: new Date().toISOString(),
      distributionId: this._generateTransactionId()
    };
    
    this._revenueSharing.set(distribution.distributionId, distribution);
    this._addToAuditTrail('revenue_distributed', distribution);
    
    return distribution;
  }

  async calculateTax(purchase) {
    const taxRate = this._getTaxRate(purchase.billingAddress);
    const taxAmount = purchase.amount * taxRate;
    const totalAmount = purchase.amount + taxAmount;
    
    return {
      amount: purchase.amount,
      taxRate: taxRate,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      currency: purchase.currency,
      taxBreakdown: {
        rate: taxRate,
        jurisdiction: this._getJurisdiction(purchase.billingAddress)
      },
      compliance: {
        isCompliant: true,
        taxId: this._generateTaxId()
      }
    };
  }

  async checkForFraud(activityData, paymentInfo) {
    let riskScore = 0;
    const indicators = [];
    
    // Check multiple attempts
    if (activityData.multiple_attempts) {
      const attempts = parseInt(activityData.multiple_attempts.split('_')[0]);
      if (attempts >= 5) {
        riskScore += 0.4;
        indicators.push('multiple_attempts');
      }
    }
    
    // Check high value purchase
    if (activityData.high_value_purchase) {
      const amount = parseInt(activityData.high_value_purchase.replace('$', '').replace('+', ''));
      if (amount >= 500) {
        riskScore += 0.3;
        indicators.push('high_value_purchase');
      }
    }
    
    // Check new payment method
    if (activityData.new_payment_method === 'true') {
      riskScore += 0.2;
      indicators.push('new_payment_method');
    }
    
    const result = {
      triggered: riskScore > 0.7,
      riskScore: riskScore,
      indicators: indicators,
      requiresVerification: riskScore > 0.5,
      verificationMethods: riskScore > 0.8 ? ['phone_call', 'manual_review'] : ['sms', 'email'],
      fallbackOptions: [
        'alternative_payment_method',
        'reduced_amount_transaction',
        'manual_verification'
      ]
    };
    
    if (result.triggered) {
      this._addToSecurityLog('fraud_detection_triggered', {
        riskScore: riskScore,
        indicators: indicators,
        paymentInfo: { method: paymentInfo.method }
      });
    }
    
    return result;
  }

  async initiateCryptoPayment(usdAmount, cryptoCurrency) {
    const cryptoData = TestDataFactory.createCryptoPaymentData();
    const cryptoInfo = cryptoData[cryptoCurrency];
    
    if (!cryptoInfo) {
      throw new Error(`Unsupported cryptocurrency: ${cryptoCurrency}`);
    }
    
    const cryptoAmount = usdAmount / cryptoInfo.exchangeRate;
    const validUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    return {
      cryptoAmount: cryptoAmount,
      currency: cryptoCurrency,
      paymentAddress: cryptoInfo.address,
      qrCode: this._generateQRCode(cryptoInfo.address, cryptoAmount),
      exchangeRate: {
        rate: cryptoInfo.exchangeRate,
        timestamp: new Date().toISOString(),
        source: 'mock_exchange'
      },
      confirmationRequirement: {
        blockConfirmations: cryptoInfo.confirmationsRequired
      },
      rateProtection: {
        validUntil: validUntil.toISOString(),
        tolerance: 0.02 // 2% tolerance
      },
      networkFee: cryptoInfo.networkFee
    };
  }

  async getTransactionHistory(userId) {
    return Array.from(this._transactions.values())
      .filter(txn => txn.userId === userId || !txn.userId) // Mock: return all for testing
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async getAuditTrail(userId = null) {
    if (userId) {
      return this._auditTrail.filter(entry => entry.userId === userId);
    }
    return this._auditTrail;
  }

  async getSecurityLog() {
    return this._auditTrail.filter(entry => entry.type.startsWith('security_') || entry.type.includes('fraud'));
  }

  // Mock methods for testing
  mockPaymentDecline(config) {
    this._shouldDeclinePayment = true;
    this._declineConfig = config;
  }

  clearPaymentDecline() {
    this._shouldDeclinePayment = false;
    this._declineConfig = null;
  }

  // Private helper methods
  _calculateFees(amount, adapter) {
    if (!adapter || !adapter.fees) {
      return { amount: 0, percentage: 0 };
    }
    
    const percentageFee = amount * (adapter.fees.percentage / 100);
    const totalFee = percentageFee + (adapter.fees.fixed || 0);
    
    return {
      amount: totalFee,
      percentage: adapter.fees.percentage,
      fixed: adapter.fees.fixed || 0,
      breakdown: {
        percentage: percentageFee,
        fixed: adapter.fees.fixed || 0
      }
    };
  }

  async _performFraudCheck(amount, paymentInfo) {
    let riskScore = 0;
    
    // Simple fraud scoring
    if (amount > 1000) riskScore += 0.3;
    if (paymentInfo.method === 'credit_card' && !paymentInfo.cvv) riskScore += 0.4;
    
    return {
      riskScore: riskScore,
      blocked: riskScore > 0.9
    };
  }

  _getTaxRate(billingAddress) {
    if (!billingAddress) return 0;
    
    const jurisdiction = `${billingAddress.country}-${billingAddress.state}`;
    return this._taxRates.get(jurisdiction) || 0;
  }

  _getJurisdiction(billingAddress) {
    if (!billingAddress) return 'unknown';
    
    if (billingAddress.state) {
      return `${billingAddress.country}-${billingAddress.state}`;
    }
    return billingAddress.country;
  }

  _generateTaxId() {
    return 'TAX_' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  _generateQRCode(address, amount) {
    // Mock QR code generation
    return `data:image/png;base64,${crypto.randomBytes(100).toString('base64')}`;
  }

  _generateTransactionId() {
    return 'txn_' + crypto.randomBytes(16).toString('hex');
  }

  _addToAuditTrail(eventType, data) {
    const entry = {
      id: crypto.randomBytes(8).toString('hex'),
      type: eventType,
      timestamp: new Date().toISOString(),
      data: data,
      hash: this._generateHash(eventType + JSON.stringify(data)),
      previousHash: this._auditTrail.length > 0 ? this._auditTrail[this._auditTrail.length - 1].hash : null,
      immutable: true
    };
    
    this._auditTrail.push(entry);
  }

  _addToSecurityLog(eventType, data) {
    this._addToAuditTrail(`security_${eventType}`, {
      ...data,
      timestamp: new Date().toISOString(),
      severity: 'medium'
    });
  }

  _generateHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  _createPaymentError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.userFriendly = true;
    error.retryOptions = { enabled: true };
    error.alternatives = ['paypal', 'bank_transfer'];
    error.idempotencyKey = crypto.randomBytes(16).toString('hex');
    return error;
  }

  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PaymentAdapter;