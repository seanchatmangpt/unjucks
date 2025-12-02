const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { performance } = require('perf_hooks');
const MarketplaceClient = require('../../utils/marketplace-client');
const PaymentAdapter = require('../../utils/payment-adapter');
const TestDataFactory = require('../../fixtures/test-data-factory');

let testContext = {};
let marketplaceClient;
let paymentAdapter;
let paymentStartTime;

Given('the marketplace payment system is operational', async function () {
  marketplaceClient = new MarketplaceClient();
  paymentAdapter = new PaymentAdapter();
  
  const paymentHealthCheck = await paymentAdapter.checkHealth();
  expect(paymentHealthCheck.status).to.equal('operational');
});

Given('I have valid authentication credentials', async function () {
  testContext.credentials = {
    userId: 'test-user-' + Date.now(),
    apiKey: process.env.TEST_API_KEY || 'test-api-key',
    sessionToken: 'valid-session-token'
  };
  
  const authResult = await marketplaceClient.authenticate(testContext.credentials);
  expect(authResult.success).to.be.true;
});

Given('payment adapters are configured and available', async function () {
  const availableAdapters = await paymentAdapter.getAvailableAdapters();
  expect(availableAdapters).to.be.an('array');
  expect(availableAdapters.length).to.be.greaterThan(0);
  
  testContext.availableAdapters = availableAdapters;
});

Given('I want to purchase a KPack priced at {string}', async function (price) {
  const priceMatch = price.match(/\$([0-9.]+)/);
  const priceAmount = parseFloat(priceMatch[1]);
  
  testContext.kpackToPurchase = TestDataFactory.createPremiumKPack({
    name: 'premium-analytics-suite',
    pricing: {
      amount: priceAmount,
      currency: 'USD',
      model: 'one-time'
    }
  });
  
  await marketplaceClient.publish(testContext.kpackToPurchase);
});

Given('I have valid payment information', async function () {
  testContext.paymentInfo = {
    method: 'credit_card',
    provider: 'stripe',
    details: {
      cardNumber: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '2025',
      cvv: '123',
      cardholderName: 'Test User',
      billingAddress: {
        line1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US'
      }
    }
  };
});

Given('a KPack has the following payment policy:', async function (dataTable) {
  testContext.paymentPolicy = {};
  
  dataTable.hashes().forEach(row => {
    const policyType = row.policy_type;
    const value = row.value;
    
    // Parse different value formats
    if (value.endsWith('_days')) {
      testContext.paymentPolicy[policyType] = parseInt(value);
    } else if (value.endsWith('_percent')) {
      testContext.paymentPolicy[policyType] = parseFloat(value) / 100;
    } else if (value.includes('_plus_')) {
      const [count, discount] = value.split('_plus_');
      testContext.paymentPolicy[policyType] = {
        threshold: parseInt(count),
        discount: parseFloat(discount) / 100
      };
    } else {
      testContext.paymentPolicy[policyType] = value;
    }
  });
  
  testContext.policyKPack = TestDataFactory.createPremiumKPack({
    paymentPolicy: testContext.paymentPolicy
  });
});

Given('I am an enterprise customer purchasing {int} licenses', async function (licenseCount) {
  testContext.customerType = 'enterprise';
  testContext.licenseCount = licenseCount;
  testContext.customerProfile = {
    type: 'enterprise',
    companyName: 'Test Enterprise Corp',
    taxId: 'ENT-123456789',
    discountTier: 'enterprise'
  };
});

Given('a KPack offers subscription pricing at {string}', async function (subscriptionPrice) {
  const match = subscriptionPrice.match(/\$([0-9.]+)\/(.+)/);
  const amount = parseFloat(match[1]);
  const period = match[2];
  
  testContext.subscriptionKPack = TestDataFactory.createPremiumKPack({
    pricing: {
      amount: amount,
      currency: 'USD',
      model: 'subscription',
      billingPeriod: period
    }
  });
  
  await marketplaceClient.publish(testContext.subscriptionKPack);
});

Given('I choose the monthly subscription option', async function () {
  testContext.selectedSubscription = {
    kpack: testContext.subscriptionKPack,
    billingPeriod: 'month',
    autoRenewal: true
  };
});

Given('the marketplace supports various payment adapters:', async function (dataTable) {
  testContext.paymentAdapters = {};
  
  dataTable.hashes().forEach(row => {
    testContext.paymentAdapters[row.payment_method] = {
      adapterName: row.adapter_name,
      isConfigured: true,
      isAvailable: true
    };
  });
  
  // Verify adapters are actually configured
  for (const [method, config] of Object.entries(testContext.paymentAdapters)) {
    const adapterStatus = await paymentAdapter.getAdapterStatus(config.adapterName);
    expect(adapterStatus.configured).to.be.true;
  }
});

Given('I purchased a KPack {int} days ago for {string}', async function (daysAgo, price) {
  const priceAmount = parseFloat(price.match(/\$([0-9.]+)/)[1]);
  const purchaseDate = new Date();
  purchaseDate.setDate(purchaseDate.getDate() - daysAgo);
  
  testContext.previousPurchase = {
    kpackName: 'refundable-kpack',
    amount: priceAmount,
    currency: 'USD',
    purchaseDate: purchaseDate.toISOString(),
    transactionId: 'txn-' + Date.now()
  };
  
  // Create purchase record
  await marketplaceClient.recordPurchase(testContext.previousPurchase);
});

Given('the refund policy allows returns within {int} days', async function (refundDays) {
  testContext.refundPolicy = {
    refundWindow: refundDays,
    allowPartialRefunds: true,
    processingTime: 5 // business days
  };
});

Given('I attempt to purchase a KPack for {string}', async function (price) {
  const priceAmount = parseFloat(price.match(/\$([0-9.]+)/)[1]);
  
  testContext.failingPurchase = TestDataFactory.createPremiumKPack({
    pricing: { amount: priceAmount, currency: 'USD' }
  });
});

Given('my payment method is declined initially', async function () {
  // Mock payment decline
  paymentAdapter.mockPaymentDecline({
    reason: 'insufficient_funds',
    declineCode: 'card_declined'
  });
});

Given('I am a verified enterprise customer', async function () {
  testContext.customerProfile = {
    type: 'enterprise',
    verified: true,
    companyName: 'Enterprise Solutions Ltd',
    tier: 'enterprise'
  };
});

Given('there is a KPack with tiered pricing:', async function (dataTable) {
  testContext.tieredKPack = TestDataFactory.createPremiumKPack({
    name: 'enterprise-data-suite'
  });
  
  testContext.pricingTiers = {};
  dataTable.hashes().forEach(row => {
    testContext.pricingTiers[row.tier] = {
      price: parseFloat(row.price.replace('$', '')),
      features: row.features.split('_')
    };
  });
  
  testContext.tieredKPack.pricingTiers = testContext.pricingTiers;
});

Given('there is a bundle containing {int} KPacks:', async function (kpackCount, dataTable) {
  testContext.bundleKPacks = [];
  let totalIndividualPrice = 0;
  
  dataTable.hashes().forEach(row => {
    const kpack = TestDataFactory.createPremiumKPack({
      name: row.kpack_name,
      pricing: {
        amount: parseFloat(row.individual_price.replace('$', '')),
        currency: 'USD'
      }
    });
    
    testContext.bundleKPacks.push(kpack);
    totalIndividualPrice += kpack.pricing.amount;
  });
  
  testContext.individualTotal = totalIndividualPrice;
});

Given('the bundle price is {string} \\({int}% discount)', async function (bundlePrice, discountPercent) {
  testContext.bundlePrice = parseFloat(bundlePrice.replace('$', ''));
  testContext.bundleDiscount = discountPercent / 100;
  
  testContext.bundle = {
    name: 'analytics-suite-bundle',
    kpacks: testContext.bundleKPacks,
    pricing: {
      amount: testContext.bundlePrice,
      currency: 'USD',
      discount: testContext.bundleDiscount
    }
  };
});

Given('a KPack sale generates {string} in revenue', async function (revenueAmount) {
  testContext.saleRevenue = parseFloat(revenueAmount.replace('$', ''));
});

Given('the revenue sharing model is:', async function (dataTable) {
  testContext.revenueModel = {};
  
  dataTable.hashes().forEach(row => {
    const percentage = parseFloat(row.percentage.replace('%', '')) / 100;
    testContext.revenueModel[row.party] = percentage;
  });
});

Given('I make multiple purchases over time', async function () {
  testContext.purchaseHistory = [];
  
  // Create sample purchase history
  for (let i = 0; i < 5; i++) {
    const purchase = {
      kpackName: `kpack-${i}`,
      amount: 10 + (i * 5),
      currency: 'USD',
      timestamp: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
      transactionId: `txn-history-${i}`
    };
    
    testContext.purchaseHistory.push(purchase);
    await marketplaceClient.recordPurchase(purchase);
  }
});

Given('I am purchasing from a jurisdiction that requires tax', async function () {
  testContext.taxJurisdiction = {
    country: 'US',
    state: 'CA',
    taxRate: 0.085, // 8.5%
    requiresTax: true
  };
});

Given('my billing address indicates {float}% sales tax', async function (taxRate) {
  testContext.taxRate = taxRate / 100;
  testContext.billingAddress = {
    country: 'US',
    state: 'CA',
    city: 'San Francisco',
    postalCode: '94105'
  };
});

Given('the system monitors for suspicious payment patterns', async function () {
  testContext.fraudDetection = {
    enabled: true,
    rules: [
      'multiple_attempts',
      'high_value_purchase',
      'new_payment_method',
      'velocity_check'
    ]
  };
});

Given('a user wants to pay with cryptocurrency', async function () {
  testContext.cryptoPayment = {
    currency: 'BTC',
    userWalletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
  };
});

Given('the KPack is priced at {string} equivalent', async function (usdPrice) {
  testContext.usdEquivalent = parseFloat(usdPrice.match(/\$([0-9]+)/)[1]);
});

When('I proceed with the purchase', async function () {
  paymentStartTime = performance.now();
  testContext.purchaseResult = await marketplaceClient.purchase(
    testContext.kpackToPurchase,
    testContext.paymentInfo
  );
  testContext.paymentDuration = performance.now() - paymentStartTime;
});

When('the payment policy is evaluated', async function () {
  testContext.policyEvaluation = await paymentAdapter.evaluatePaymentPolicy(
    testContext.policyKPack,
    testContext.customerProfile,
    testContext.licenseCount
  );
});

When('I complete the subscription setup', async function () {
  testContext.subscriptionResult = await marketplaceClient.createSubscription(
    testContext.selectedSubscription,
    testContext.paymentInfo
  );
});

When('I choose different payment methods', async function () {
  testContext.paymentMethodResults = {};
  
  for (const [method, adapter] of Object.entries(testContext.paymentAdapters)) {
    const paymentInfo = { 
      method: method, 
      provider: adapter.adapterName,
      testData: TestDataFactory.getPaymentTestData(method)
    };
    
    testContext.paymentMethodResults[method] = await paymentAdapter.processPayment(
      testContext.kpackToPurchase.pricing.amount,
      paymentInfo
    );
  }
});

When('I request a refund with valid reason', async function () {
  testContext.refundRequest = {
    transactionId: testContext.previousPurchase.transactionId,
    reason: 'not_as_described',
    amount: testContext.previousPurchase.amount,
    description: 'KPack did not meet expectations'
  };
  
  testContext.refundResult = await paymentAdapter.processRefund(testContext.refundRequest);
});

When('the payment fails', async function () {
  try {
    testContext.failedPaymentResult = await paymentAdapter.processPayment(
      testContext.failingPurchase.pricing.amount,
      testContext.paymentInfo
    );
  } catch (error) {
    testContext.paymentError = error;
  }
});

When('I view the KPack pricing', async function () {
  testContext.pricingView = await marketplaceClient.getKPackPricing(
    testContext.tieredKPack.name,
    testContext.customerProfile
  );
});

When('I purchase the bundle', async function () {
  testContext.bundlePurchaseResult = await marketplaceClient.purchaseBundle(
    testContext.bundle,
    testContext.paymentInfo
  );
});

When('the payment is processed', async function () {
  testContext.revenueDistribution = await paymentAdapter.distributeRevenue(
    testContext.saleRevenue,
    testContext.revenueModel
  );
});

When('I purchase KPacks and manage subscriptions', async function () {
  // Additional transaction for audit trail testing
  const newPurchase = {
    kpackName: 'audit-test-kpack',
    amount: 25.99,
    currency: 'USD',
    timestamp: new Date().toISOString(),
    transactionId: 'txn-audit-' + Date.now()
  };
  
  await marketplaceClient.recordPurchase(newPurchase);
  testContext.purchaseHistory.push(newPurchase);
});

When('I proceed with a ${int} purchase', async function (purchaseAmount) {
  testContext.taxablePurchase = {
    amount: purchaseAmount,
    currency: 'USD',
    billingAddress: testContext.billingAddress
  };
  
  testContext.taxCalculationResult = await paymentAdapter.calculateTax(
    testContext.taxablePurchase
  );
});

When('an unusual payment pattern is detected:', async function (dataTable) {
  testContext.suspiciousActivity = {};
  
  dataTable.hashes().forEach(row => {
    testContext.suspiciousActivity[row.indicator] = row.value;
  });
  
  testContext.fraudDetectionResult = await paymentAdapter.checkForFraud(
    testContext.suspiciousActivity,
    testContext.paymentInfo
  );
});

When('they choose crypto payment option', async function () {
  testContext.cryptoPaymentResult = await paymentAdapter.initiateCryptoPayment(
    testContext.usdEquivalent,
    testContext.cryptoPayment.currency
  );
});

Then('I should be presented with a secure payment form', async function () {
  expect(testContext.purchaseResult).to.have.property('paymentForm');
  expect(testContext.purchaseResult.paymentForm).to.have.property('isSecure', true);
  expect(testContext.purchaseResult.paymentForm).to.have.property('tokenized', true);
});

Then('payment should be processed within {int} seconds', async function (maxSeconds) {
  const paymentDuration = testContext.paymentDuration / 1000;
  expect(paymentDuration).to.be.lessThan(maxSeconds);
});

Then('I should receive a confirmation of successful payment', async function () {
  expect(testContext.purchaseResult).to.have.property('success', true);
  expect(testContext.purchaseResult).to.have.property('confirmationId');
  expect(testContext.purchaseResult).to.have.property('transactionId');
});

Then('access to the KPack should be granted immediately', async function () {
  const accessCheck = await marketplaceClient.checkAccess(
    testContext.kpackToPurchase.name,
    testContext.credentials.userId
  );
  expect(accessCheck.hasAccess).to.be.true;
});

Then('enterprise discount should be applied', async function () {
  expect(testContext.policyEvaluation).to.have.property('enterpriseDiscount');
  expect(testContext.policyEvaluation.enterpriseDiscount.applied).to.be.true;
  expect(testContext.policyEvaluation.enterpriseDiscount.rate).to.equal(0.20);
});

Then('volume pricing should be calculated', async function () {
  expect(testContext.policyEvaluation).to.have.property('volumePricing');
  expect(testContext.policyEvaluation.volumePricing.applied).to.be.true;
  expect(testContext.policyEvaluation.volumePricing.threshold).to.equal(5);
});

Then('final price should reflect both discounts', async function () {
  const basePrice = testContext.policyEvaluation.basePrice;
  const finalPrice = testContext.policyEvaluation.finalPrice;
  const expectedDiscount = 0.20 + 0.10; // Enterprise + Volume
  
  expect(finalPrice).to.be.lessThan(basePrice);
  const actualDiscount = (basePrice - finalPrice) / basePrice;
  expect(actualDiscount).to.be.closeTo(expectedDiscount, 0.01);
});

Then('policy terms should be clearly displayed', async function () {
  expect(testContext.policyEvaluation).to.have.property('terms');
  expect(testContext.policyEvaluation.terms).to.have.property('trialPeriod', 14);
  expect(testContext.policyEvaluation.terms).to.have.property('refundPeriod', 30);
});

Then('a recurring payment should be established', async function () {
  expect(testContext.subscriptionResult).to.have.property('subscriptionId');
  expect(testContext.subscriptionResult).to.have.property('recurringPayment');
  expect(testContext.subscriptionResult.recurringPayment.active).to.be.true;
});

Then('I should receive confirmation of the subscription', async function () {
  expect(testContext.subscriptionResult).to.have.property('confirmationEmail');
  expect(testContext.subscriptionResult).to.have.property('nextBillingDate');
});

Then('access should be granted for the subscription period', async function () {
  const subscriptionAccess = await marketplaceClient.checkSubscriptionAccess(
    testContext.subscriptionKPack.name,
    testContext.credentials.userId
  );
  expect(subscriptionAccess.hasAccess).to.be.true;
  expect(subscriptionAccess.subscriptionActive).to.be.true;
});

Then('I should be able to manage the subscription', async function () {
  const managementOptions = await marketplaceClient.getSubscriptionManagement(
    testContext.subscriptionResult.subscriptionId
  );
  
  expect(managementOptions).to.have.property('canPause', true);
  expect(managementOptions).to.have.property('canCancel', true);
  expect(managementOptions).to.have.property('canUpgrade', true);
});

Then('the appropriate adapter should be used', async function () {
  Object.entries(testContext.paymentMethodResults).forEach(([method, result]) => {
    expect(result).to.have.property('adapterUsed');
    expect(result.adapterUsed).to.equal(testContext.paymentAdapters[method].adapterName);
  });
});

Then('payment processing should work correctly for each', async function () {
  Object.values(testContext.paymentMethodResults).forEach(result => {
    expect(result).to.have.property('success', true);
    expect(result).to.have.property('transactionId');
  });
});

Then('transaction fees should be calculated properly', async function () {
  Object.values(testContext.paymentMethodResults).forEach(result => {
    expect(result).to.have.property('fees');
    expect(result.fees).to.have.property('amount');
    expect(result.fees).to.have.property('percentage');
    expect(result.fees.amount).to.be.greaterThan(0);
  });
});

Then('the refund request should be processed', async function () {
  expect(testContext.refundResult).to.have.property('success', true);
  expect(testContext.refundResult).to.have.property('refundId');
  expect(testContext.refundResult).to.have.property('status', 'approved');
});

Then('the refund should be issued within {int} business days', async function (businessDays) {
  expect(testContext.refundResult).to.have.property('estimatedProcessingTime');
  expect(testContext.refundResult.estimatedProcessingTime).to.be.lessThanOrEqual(businessDays);
});

Then('my access to the KPack should be revoked', async function () {
  const accessCheck = await marketplaceClient.checkAccess(
    testContext.previousPurchase.kpackName,
    testContext.credentials.userId
  );
  expect(accessCheck.hasAccess).to.be.false;
  expect(accessCheck.reason).to.equal('refunded');
});

Then('I should receive refund confirmation', async function () {
  expect(testContext.refundResult).to.have.property('confirmationEmail');
  expect(testContext.refundResult).to.have.property('refundAmount');
  expect(testContext.refundResult.refundAmount).to.equal(testContext.previousPurchase.amount);
});

Then('I should receive a clear error message', async function () {
  expect(testContext.paymentError).to.have.property('message');
  expect(testContext.paymentError.userFriendly).to.be.true;
  expect(testContext.paymentError.message).to.not.include('internal error');
});

Then('be offered alternative payment methods', async function () {
  expect(testContext.paymentError).to.have.property('alternatives');
  expect(testContext.paymentError.alternatives).to.be.an('array');
  expect(testContext.paymentError.alternatives.length).to.be.greaterThan(0);
});

Then('have the option to retry with corrected information', async function () {
  expect(testContext.paymentError).to.have.property('retryOptions');
  expect(testContext.paymentError.retryOptions.enabled).to.be.true;
});

Then('the purchase attempt should not be duplicated', async function () {
  // Verify idempotency - no duplicate charges
  const transactionHistory = await paymentAdapter.getTransactionHistory(
    testContext.credentials.userId
  );
  
  const duplicates = transactionHistory.filter(txn => 
    txn.idempotencyKey === testContext.paymentError.idempotencyKey
  );
  
  expect(duplicates.length).to.be.lessThanOrEqual(1);
});

Then('enterprise pricing should be displayed prominently', async function () {
  expect(testContext.pricingView).to.have.property('recommendedTier', 'enterprise');
  expect(testContext.pricingView.tiers.enterprise).to.have.property('highlighted', true);
});

Then('enterprise features should be highlighted', async function () {
  expect(testContext.pricingView.tiers.enterprise.features).to.include('full_suite');
  expect(testContext.pricingView.tiers.enterprise).to.have.property('featureComparison');
});

Then('appropriate tier should be pre-selected', async function () {
  expect(testContext.pricingView).to.have.property('preselectedTier', 'enterprise');
});

Then('the discounted price should be applied', async function () {
  const expectedPrice = testContext.bundlePrice;
  expect(testContext.bundlePurchaseResult.finalPrice).to.equal(expectedPrice);
  expect(testContext.bundlePurchaseResult.discount.applied).to.be.true;
});

Then('all KPacks in the bundle should be available', async function () {
  for (const kpack of testContext.bundleKPacks) {
    const access = await marketplaceClient.checkAccess(
      kpack.name,
      testContext.credentials.userId
    );
    expect(access.hasAccess).to.be.true;
  }
});

Then('bundle purchase should be recorded correctly', async function () {
  expect(testContext.bundlePurchaseResult).to.have.property('bundleId');
  expect(testContext.bundlePurchaseResult).to.have.property('itemCount', 3);
  expect(testContext.bundlePurchaseResult).to.have.property('savings');
});

Then('revenue should be distributed according to the model', async function () {
  expect(testContext.revenueDistribution).to.have.property('distributions');
  expect(testContext.revenueDistribution.distributions).to.be.an('object');
  
  // Verify percentages add up to 100%
  const totalPercentage = Object.values(testContext.revenueModel).reduce((sum, pct) => sum + pct, 0);
  expect(totalPercentage).to.be.closeTo(1.0, 0.01);
});

Then('creator should receive ${int}', async function (expectedAmount) {
  expect(testContext.revenueDistribution.distributions.creator).to.equal(expectedAmount);
});

Then('marketplace should receive ${int}', async function (expectedAmount) {
  expect(testContext.revenueDistribution.distributions.marketplace).to.equal(expectedAmount);
});

Then('payment fees should be deducted appropriately', async function () {
  expect(testContext.revenueDistribution.distributions.payment_fees).to.equal(5);
});

Then('all payment transactions should be logged', async function () {
  const auditTrail = await paymentAdapter.getAuditTrail(testContext.credentials.userId);
  expect(auditTrail).to.be.an('array');
  expect(auditTrail.length).to.be.greaterThanOrEqual(testContext.purchaseHistory.length);
});

Then('audit trail should include:', async function (dataTable) {
  const requiredFields = dataTable.raw().flat();
  const auditTrail = await paymentAdapter.getAuditTrail(testContext.credentials.userId);
  
  auditTrail.forEach(entry => {
    requiredFields.forEach(field => {
      expect(entry).to.have.property(field);
    });
  });
});

Then('logs should be tamper-proof and immutable', async function () {
  const auditTrail = await paymentAdapter.getAuditTrail(testContext.credentials.userId);
  
  auditTrail.forEach(entry => {
    expect(entry).to.have.property('hash');
    expect(entry).to.have.property('previousHash');
    expect(entry).to.have.property('immutable', true);
  });
});

Then('sales tax should be calculated correctly \\(${float})', async function (expectedTax) {
  expect(testContext.taxCalculationResult).to.have.property('taxAmount');
  expect(testContext.taxCalculationResult.taxAmount).to.be.closeTo(expectedTax, 0.01);
});

Then('total amount should be ${float}', async function (expectedTotal) {
  expect(testContext.taxCalculationResult).to.have.property('totalAmount');
  expect(testContext.taxCalculationResult.totalAmount).to.be.closeTo(expectedTotal, 0.01);
});

Then('tax details should be clearly itemized', async function () {
  expect(testContext.taxCalculationResult).to.have.property('taxBreakdown');
  expect(testContext.taxCalculationResult.taxBreakdown).to.have.property('rate');
  expect(testContext.taxCalculationResult.taxBreakdown).to.have.property('jurisdiction');
});

Then('tax compliance should be maintained', async function () {
  expect(testContext.taxCalculationResult).to.have.property('compliance');
  expect(testContext.taxCalculationResult.compliance.isCompliant).to.be.true;
});

Then('fraud detection should be triggered', async function () {
  expect(testContext.fraudDetectionResult).to.have.property('triggered', true);
  expect(testContext.fraudDetectionResult).to.have.property('riskScore');
  expect(testContext.fraudDetectionResult.riskScore).to.be.greaterThan(0.7);
});

Then('additional verification should be required', async function () {
  expect(testContext.fraudDetectionResult).to.have.property('requiresVerification', true);
  expect(testContext.fraudDetectionResult).to.have.property('verificationMethods');
});

Then('suspicious activity should be logged', async function () {
  const securityLog = await paymentAdapter.getSecurityLog();
  const suspiciousEntry = securityLog.find(entry => 
    entry.type === 'suspicious_activity' && 
    entry.userId === testContext.credentials.userId
  );
  
  expect(suspiciousEntry).to.not.be.undefined;
});

Then('legitimate users should not be unduly inconvenienced', async function () {
  // Verify that fraud detection doesn't block all transactions
  expect(testContext.fraudDetectionResult).to.have.property('fallbackOptions');
  expect(testContext.fraudDetectionResult.fallbackOptions.length).to.be.greaterThan(0);
});

Then('the system should calculate current exchange rate', async function () {
  expect(testContext.cryptoPaymentResult).to.have.property('exchangeRate');
  expect(testContext.cryptoPaymentResult.exchangeRate).to.have.property('rate');
  expect(testContext.cryptoPaymentResult.exchangeRate).to.have.property('timestamp');
});

Then('display the equivalent crypto amount', async function () {
  expect(testContext.cryptoPaymentResult).to.have.property('cryptoAmount');
  expect(testContext.cryptoPaymentResult.cryptoAmount).to.be.greaterThan(0);
});

Then('generate a payment address or QR code', async function () {
  expect(testContext.cryptoPaymentResult).to.have.property('paymentAddress');
  expect(testContext.cryptoPaymentResult).to.have.property('qrCode');
});

Then('confirm payment after blockchain confirmation', async function () {
  // This would typically require blockchain integration
  expect(testContext.cryptoPaymentResult).to.have.property('confirmationRequirement');
  expect(testContext.cryptoPaymentResult.confirmationRequirement.blockConfirmations).to.be.greaterThan(0);
});

Then('handle exchange rate fluctuations appropriately', async function () {
  expect(testContext.cryptoPaymentResult).to.have.property('rateProtection');
  expect(testContext.cryptoPaymentResult.rateProtection).to.have.property('validUntil');
  expect(testContext.cryptoPaymentResult.rateProtection).to.have.property('tolerance');
});