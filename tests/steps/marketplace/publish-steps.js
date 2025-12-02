const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { performance } = require('perf_hooks');
const MarketplaceClient = require('../../utils/marketplace-client');
const TestDataFactory = require('../../fixtures/test-data-factory');
const CryptoUtils = require('../../utils/crypto-utils');

// Initialize test context
let testContext = {};
let marketplaceClient;
let publishStartTime;

Given('the marketplace is available', async function () {
  marketplaceClient = new MarketplaceClient();
  const healthCheck = await marketplaceClient.checkHealth();
  expect(healthCheck.status).to.equal('healthy');
});

Given('I have valid authentication credentials', async function () {
  testContext.credentials = {
    userId: 'test-user-' + Date.now(),
    apiKey: process.env.TEST_API_KEY || 'test-api-key',
    signature: CryptoUtils.generateSignature()
  };
  
  const authResult = await marketplaceClient.authenticate(testContext.credentials);
  expect(authResult.success).to.be.true;
});

Given('I have a complete KPack with metadata', async function () {
  testContext.kpack = TestDataFactory.createValidKPack();
  expect(testContext.kpack).to.have.property('metadata');
  expect(testContext.kpack).to.have.property('content');
  expect(testContext.kpack).to.have.property('attestations');
});

Given('I have a KPack named {string}', async function (kpackName) {
  testContext.kpack = TestDataFactory.createValidKPack({
    name: kpackName,
    metadata: {
      name: kpackName,
      version: '1.0.0',
      description: `Test KPack: ${kpackName}`,
      author: 'test@example.com',
      license: 'MIT'
    }
  });
});

Given('the KPack has valid metadata including:', async function (dataTable) {
  const metadata = {};
  dataTable.hashes().forEach(row => {
    metadata[row.field] = row.value;
  });
  
  testContext.kpack.metadata = { ...testContext.kpack.metadata, ...metadata };
  
  // Validate required metadata fields
  const requiredFields = ['name', 'version', 'description', 'author', 'license'];
  requiredFields.forEach(field => {
    expect(testContext.kpack.metadata).to.have.property(field);
  });
});

Given('the KPack includes required attestations', async function () {
  testContext.kpack.attestations = {
    integrity: CryptoUtils.generateIntegrityHash(testContext.kpack.content),
    signature: CryptoUtils.signContent(testContext.kpack.content, testContext.credentials.privateKey),
    timestamp: new Date().toISOString(),
    publisher: testContext.credentials.userId
  };
});

Given('the KPack has tampered cryptographic signatures', async function () {
  testContext.kpack.attestations = {
    integrity: 'tampered-hash-invalid',
    signature: 'invalid-signature-data',
    timestamp: new Date().toISOString(),
    publisher: testContext.credentials.userId
  };
});

Given('the KPack is missing required metadata:', async function (dataTable) {
  const missingFields = dataTable.raw().flat();
  missingFields.forEach(field => {
    delete testContext.kpack.metadata[field];
  });
});

Given('I have previously published a KPack named {string} version {string}', async function (name, version) {
  const existingKPack = TestDataFactory.createValidKPack({
    name: name,
    metadata: { ...TestDataFactory.getDefaultMetadata(), version: version }
  });
  
  await marketplaceClient.publish(existingKPack);
  testContext.existingKPack = existingKPack;
});

Given('I have an updated version {string} with new features', async function (newVersion) {
  testContext.kpack = {
    ...testContext.existingKPack,
    metadata: {
      ...testContext.existingKPack.metadata,
      version: newVersion
    },
    content: {
      ...testContext.existingKPack.content,
      newFeatures: ['feature1', 'feature2']
    }
  };
});

Given('I have {int} valid KPacks ready for publication', async function (count) {
  testContext.bulkKPacks = [];
  for (let i = 0; i < count; i++) {
    testContext.bulkKPacks.push(TestDataFactory.createValidKPack({
      name: `bulk-kpack-${i}`,
      metadata: {
        ...TestDataFactory.getDefaultMetadata(),
        name: `bulk-kpack-${i}`
      }
    }));
  }
});

Given('the KPack has the following facets:', async function (dataTable) {
  testContext.kpack.facets = {};
  dataTable.hashes().forEach(row => {
    const facetType = row.facet_type;
    const facetValue = row.facet_value;
    
    if (!testContext.kpack.facets[facetType]) {
      testContext.kpack.facets[facetType] = [];
    }
    testContext.kpack.facets[facetType].push(facetValue);
  });
});

Given('I set the pricing model to {string}', async function (pricingModel) {
  testContext.kpack.pricing = {
    model: pricingModel,
    currency: 'USD'
  };
});

Given('I set the price to {string}', async function (price) {
  const match = price.match(/\$([0-9.]+)(\/.*)?/);
  testContext.kpack.pricing.amount = parseFloat(match[1]);
  if (match[2]) {
    testContext.kpack.pricing.period = match[2].substring(1);
  }
});

Given('I configure payment policies', async function () {
  testContext.kpack.paymentPolicies = {
    trialPeriod: 7,
    refundPeriod: 30,
    autoRenewal: true
  };
});

Given('the marketplace registry is temporarily unavailable', async function () {
  // Mock registry unavailability
  marketplaceClient.simulateRegistryDown();
});

When('I publish the KPack to the marketplace', async function () {
  publishStartTime = performance.now();
  testContext.publishResult = await marketplaceClient.publish(testContext.kpack);
});

When('I attempt to publish the KPack', async function () {
  publishStartTime = performance.now();
  try {
    testContext.publishResult = await marketplaceClient.publish(testContext.kpack);
  } catch (error) {
    testContext.publishError = error;
  }
});

When('I publish the updated KPack', async function () {
  testContext.publishResult = await marketplaceClient.publish(testContext.kpack);
});

When('I publish all KPacks simultaneously', async function () {
  publishStartTime = performance.now();
  const publishPromises = testContext.bulkKPacks.map(kpack => 
    marketplaceClient.publish(kpack)
  );
  
  testContext.bulkPublishResults = await Promise.allSettled(publishPromises);
});

When('I publish the KPack', async function () {
  testContext.publishResult = await marketplaceClient.publish(testContext.kpack);
});

Then('the KPack should be published successfully', async function () {
  expect(testContext.publishResult).to.have.property('success', true);
  expect(testContext.publishResult).to.have.property('kpackId');
});

Then('I should receive a publication confirmation', async function () {
  expect(testContext.publishResult).to.have.property('confirmationId');
  expect(testContext.publishResult).to.have.property('publishedAt');
});

Then('the KPack should be findable in search results', async function () {
  const searchResults = await marketplaceClient.search(testContext.kpack.metadata.name);
  const foundKPack = searchResults.find(result => 
    result.name === testContext.kpack.metadata.name
  );
  expect(foundKPack).to.not.be.undefined;
});

Then('the publish time should be less than {int} seconds', async function (maxSeconds) {
  const publishDuration = (performance.now() - publishStartTime) / 1000;
  expect(publishDuration).to.be.lessThan(maxSeconds);
});

Then('the publication should be rejected', async function () {
  expect(testContext.publishError).to.not.be.undefined;
  expect(testContext.publishError.message).to.contain('rejected');
});

Then('I should receive an error message containing {string}', async function (expectedMessage) {
  expect(testContext.publishError.message).to.contain(expectedMessage);
});

Then('the KPack should not appear in marketplace listings', async function () {
  const searchResults = await marketplaceClient.search(testContext.kpack.metadata.name);
  const foundKPack = searchResults.find(result => 
    result.name === testContext.kpack.metadata.name
  );
  expect(foundKPack).to.be.undefined;
});

Then('I should receive validation errors for missing fields', async function () {
  expect(testContext.publishError).to.have.property('validationErrors');
  expect(testContext.publishError.validationErrors).to.be.an('array');
  expect(testContext.publishError.validationErrors.length).to.be.greaterThan(0);
});

Then('the KPack should not be published', async function () {
  expect(testContext.publishResult).to.be.undefined;
  expect(testContext.publishError).to.not.be.undefined;
});

Then('both versions should be available in the marketplace', async function () {
  const searchResults = await marketplaceClient.search(testContext.kpack.metadata.name);
  const versions = searchResults.map(result => result.version);
  expect(versions).to.include('1.0.0');
  expect(versions).to.include('1.1.0');
});

Then('the latest version should be marked as current', async function () {
  const kpackDetails = await marketplaceClient.getKPack(
    testContext.kpack.metadata.name, 
    'latest'
  );
  expect(kpackDetails.version).to.equal('1.1.0');
  expect(kpackDetails.isLatest).to.be.true;
});

Then('users should be able to access previous versions', async function () {
  const previousVersion = await marketplaceClient.getKPack(
    testContext.kpack.metadata.name, 
    '1.0.0'
  );
  expect(previousVersion).to.not.be.undefined;
  expect(previousVersion.version).to.equal('1.0.0');
});

Then('all KPacks should be published successfully', async function () {
  const successfulPublications = testContext.bulkPublishResults.filter(
    result => result.status === 'fulfilled'
  );
  expect(successfulPublications.length).to.equal(testContext.bulkKPacks.length);
});

Then('each publication should complete within {int} seconds', async function (maxSeconds) {
  const publishDuration = (performance.now() - publishStartTime) / 1000;
  expect(publishDuration).to.be.lessThan(maxSeconds);
});

Then('the marketplace should handle concurrent publications without conflicts', async function () {
  // Verify no duplicate publications or conflicts
  const allResults = testContext.bulkPublishResults.map(result => result.value);
  const uniqueIds = new Set(allResults.map(result => result.kpackId));
  expect(uniqueIds.size).to.equal(testContext.bulkKPacks.length);
});

Then('the KPack should be categorized under all specified facets', async function () {
  const publishedKPack = await marketplaceClient.getKPack(
    testContext.kpack.metadata.name
  );
  
  Object.keys(testContext.kpack.facets).forEach(facetType => {
    expect(publishedKPack.facets).to.have.property(facetType);
    expect(publishedKPack.facets[facetType]).to.include.members(
      testContext.kpack.facets[facetType]
    );
  });
});

Then('it should be discoverable through faceted search', async function () {
  const facetedSearch = await marketplaceClient.searchByFacets({
    category: ['machine-learning']
  });
  
  const foundKPack = facetedSearch.find(result => 
    result.name === testContext.kpack.metadata.name
  );
  expect(foundKPack).to.not.be.undefined;
});

Then('the KPack should be listed with pricing information', async function () {
  const publishedKPack = await marketplaceClient.getKPack(
    testContext.kpack.metadata.name
  );
  
  expect(publishedKPack).to.have.property('pricing');
  expect(publishedKPack.pricing).to.have.property('model', 'subscription');
  expect(publishedKPack.pricing).to.have.property('amount', 29.99);
});

Then('payment integration should be enabled', async function () {
  const paymentStatus = await marketplaceClient.checkPaymentIntegration(
    testContext.publishResult.kpackId
  );
  expect(paymentStatus.enabled).to.be.true;
});

Then('trial access should be configured according to policies', async function () {
  const kpackDetails = await marketplaceClient.getKPack(
    testContext.kpack.metadata.name
  );
  expect(kpackDetails.paymentPolicies.trialPeriod).to.equal(7);
});

Then('I should receive a clear error message about service unavailability', async function () {
  expect(testContext.publishError.message).to.contain('service unavailable');
});

Then('the KPack should be queued for retry', async function () {
  const queueStatus = await marketplaceClient.getPublishQueue();
  const queuedItem = queueStatus.items.find(item => 
    item.kpackName === testContext.kpack.metadata.name
  );
  expect(queuedItem).to.not.be.undefined;
});

Then('I should be notified when the service is restored', async function () {
  // This would typically be tested with a notification mock or webhook
  expect(testContext.publishError).to.have.property('retryNotificationEnabled', true);
});