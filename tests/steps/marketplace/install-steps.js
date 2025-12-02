const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { performance } = require('perf_hooks');
const MarketplaceClient = require('../../utils/marketplace-client');
const TestDataFactory = require('../../fixtures/test-data-factory');
const CryptoUtils = require('../../utils/crypto-utils');
const fs = require('fs').promises;
const path = require('path');

let testContext = {};
let marketplaceClient;
let installStartTime;

Given('the marketplace is available', async function () {
  marketplaceClient = new MarketplaceClient();
  const healthCheck = await marketplaceClient.checkHealth();
  expect(healthCheck.status).to.equal('healthy');
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

Given('there are published KPacks available for installation', async function () {
  // Ensure test KPacks are available in marketplace
  const availableKPacks = await marketplaceClient.getAvailableKPacks();
  expect(availableKPacks.length).to.be.greaterThan(0);
  testContext.availableKPacks = availableKPacks;
});

Given('I have found a free KPack named {string}', async function (kpackName) {
  testContext.selectedKPack = TestDataFactory.createFreeKPack(kpackName);
  
  // Ensure it's published to marketplace
  await marketplaceClient.publish(testContext.selectedKPack);
  
  // Verify it's available for installation
  const marketplaceKPack = await marketplaceClient.getKPack(kpackName);
  expect(marketplaceKPack).to.not.be.undefined;
  expect(marketplaceKPack.pricing.isFree).to.be.true;
});

Given('the KPack has valid cryptographic signatures', async function () {
  testContext.selectedKPack.attestations = {
    integrity: CryptoUtils.generateIntegrityHash(testContext.selectedKPack.content),
    signature: CryptoUtils.signContent(testContext.selectedKPack.content),
    certificateChain: CryptoUtils.generateCertificateChain(),
    timestamp: new Date().toISOString()
  };
  
  // Verify signatures are valid
  const isValid = CryptoUtils.verifySignature(
    testContext.selectedKPack.content,
    testContext.selectedKPack.attestations.signature
  );
  expect(isValid).to.be.true;
});

Given('I have selected a KPack named {string}', async function (kpackName) {
  testContext.selectedKPack = await marketplaceClient.getKPack(kpackName);
  expect(testContext.selectedKPack).to.not.be.undefined;
});

Given('the KPack includes cryptographic attestations', async function () {
  expect(testContext.selectedKPack.attestations).to.be.an('object');
  expect(testContext.selectedKPack.attestations).to.have.property('signature');
  expect(testContext.selectedKPack.attestations).to.have.property('integrity');
  expect(testContext.selectedKPack.attestations).to.have.property('certificateChain');
});

Given('I want to install a KPack named {string}', async function (kpackName) {
  testContext.targetKPack = await marketplaceClient.getKPack(kpackName);
  expect(testContext.targetKPack).to.not.be.undefined;
});

Given('it depends on the following KPacks:', async function (dataTable) {
  const dependencies = {};
  dataTable.hashes().forEach(row => {
    dependencies[row.dependency] = row.version;
  });
  
  testContext.targetKPack.dependencies = dependencies;
  
  // Ensure dependencies exist in marketplace
  for (const [depName, version] of Object.entries(dependencies)) {
    const depKPack = TestDataFactory.createKPack({
      name: depName,
      metadata: { version: version.replace(/[\^~*]/, '') }
    });
    await marketplaceClient.publish(depKPack);
  }
});

Given('I want to install a premium KPack priced at {string}', async function (price) {
  const priceMatch = price.match(/\$([0-9.]+)/);
  const priceAmount = parseFloat(priceMatch[1]);
  
  testContext.premiumKPack = TestDataFactory.createPremiumKPack({
    pricing: {
      amount: priceAmount,
      currency: 'USD',
      model: 'one-time'
    }
  });
  
  await marketplaceClient.publish(testContext.premiumKPack);
});

Given('I have valid payment information', async function () {
  testContext.paymentInfo = {
    method: 'credit_card',
    cardNumber: '4111111111111111',
    expiryDate: '12/25',
    cvv: '123',
    billingAddress: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zip: '12345'
    }
  };
});

Given('there is a premium KPack with a {int}-day trial period', async function (trialDays) {
  testContext.trialKPack = TestDataFactory.createPremiumKPack({
    pricing: {
      amount: 29.99,
      currency: 'USD',
      model: 'subscription',
      trialPeriod: trialDays
    }
  });
  
  await marketplaceClient.publish(testContext.trialKPack);
});

Given('a KPack named {string} has multiple versions:', async function (kpackName, dataTable) {
  testContext.versionedKPack = { name: kpackName, versions: {} };
  
  for (const row of dataTable.hashes()) {
    const version = row.version;
    const kpack = TestDataFactory.createKPack({
      name: kpackName,
      metadata: {
        version: version,
        status: row.status,
        compatibility: row.compatibility
      }
    });
    
    await marketplaceClient.publish(kpack);
    testContext.versionedKPack.versions[version] = kpack;
  }
});

Given('I have previously downloaded a KPack named {string}', async function (kpackName) {
  testContext.cachedKPack = TestDataFactory.createKPack({ name: kpackName });
  
  // Simulate caching by storing in local cache
  await marketplaceClient.cacheKPack(testContext.cachedKPack);
  
  const isCached = await marketplaceClient.isCached(kpackName);
  expect(isCached).to.be.true;
});

Given('the KPack is cached locally', async function () {
  const cacheStatus = await marketplaceClient.getCacheStatus(testContext.cachedKPack.name);
  expect(cacheStatus.isCached).to.be.true;
  expect(cacheStatus.isValid).to.be.true;
});

Given('I am currently offline', async function () {
  // Simulate offline mode
  marketplaceClient.setOfflineMode(true);
  testContext.isOffline = true;
});

Given('I am installing a KPack named {string}', async function (kpackName) {
  testContext.installationKPack = await marketplaceClient.getKPack(kpackName);
  expect(testContext.installationKPack).to.not.be.undefined;
});

Given('the installation fails due to a dependency conflict', async function () {
  // Simulate dependency conflict
  testContext.installationKPack.dependencies = {
    'conflicting-package': '^2.0.0'
  };
  
  // Mock existing installation with conflicting version
  await marketplaceClient.mockInstalledPackage('conflicting-package', '1.5.0');
});

Given('I have multiple development workspaces', async function () {
  testContext.workspaces = [
    'client-projects',
    'personal-tools',
    'experimental'
  ];
  
  // Ensure workspaces exist
  for (const workspace of testContext.workspaces) {
    await marketplaceClient.createWorkspace(workspace);
  }
});

Given('I want to install {string} into workspace {string}', async function (kpackName, workspaceName) {
  testContext.targetWorkspace = workspaceName;
  testContext.workspaceKPack = await marketplaceClient.getKPack(kpackName);
  expect(testContext.workspaceKPack).to.not.be.undefined;
});

Given('I have a list of KPacks to install:', async function (dataTable) {
  testContext.bulkInstallList = [];
  
  for (const row of dataTable.hashes()) {
    const kpack = TestDataFactory.createKPack({
      name: row.kpack_name,
      metadata: { version: row.version === 'latest' ? '1.0.0' : row.version }
    });
    
    await marketplaceClient.publish(kpack);
    testContext.bulkInstallList.push({
      name: row.kpack_name,
      version: row.version
    });
  }
});

Given('I have {string} version {string} installed', async function (kpackName, version) {
  testContext.installedKPack = TestDataFactory.createKPack({
    name: kpackName,
    metadata: { version: version }
  });
  
  await marketplaceClient.install(testContext.installedKPack);
  
  const isInstalled = await marketplaceClient.isInstalled(kpackName, version);
  expect(isInstalled).to.be.true;
});

Given('version {string} is available with new features', async function (newVersion) {
  testContext.updatedKPack = TestDataFactory.createKPack({
    name: testContext.installedKPack.name,
    metadata: {
      version: newVersion,
      changelog: ['New feature A', 'Bug fix B', 'Performance improvement C']
    }
  });
  
  await marketplaceClient.publish(testContext.updatedKPack);
});

Given('I have {string} installed', async function (kpackName) {
  testContext.installedForUninstall = TestDataFactory.createKPack({ name: kpackName });
  await marketplaceClient.install(testContext.installedForUninstall);
  
  const isInstalled = await marketplaceClient.isInstalled(kpackName);
  expect(isInstalled).to.be.true;
});

Given('it\'s no longer needed in my workspace', async function () {
  // Mark as no longer needed (this is contextual)
  testContext.uninstallReason = 'no longer needed';
});

Given('I am installing various sizes of KPacks', async function () {
  testContext.performanceKPacks = {
    small: TestDataFactory.createKPack({ name: 'small-utils', size: 'small' }),
    medium: TestDataFactory.createKPack({ name: 'medium-toolkit', size: 'medium' }),
    large: TestDataFactory.createKPack({ name: 'large-framework', size: 'large' })
  };
  
  // Publish all performance test KPacks
  for (const kpack of Object.values(testContext.performanceKPacks)) {
    await marketplaceClient.publish(kpack);
  }
});

When('I install the KPack', async function () {
  installStartTime = performance.now();
  testContext.installResult = await marketplaceClient.install(testContext.selectedKPack);
  testContext.installDuration = performance.now() - installStartTime;
});

When('I initiate installation', async function () {
  installStartTime = performance.now();
  testContext.installResult = await marketplaceClient.install(testContext.selectedKPack);
});

When('I install the main KPack', async function () {
  installStartTime = performance.now();
  testContext.installResult = await marketplaceClient.installWithDependencies(testContext.targetKPack);
  testContext.installDuration = performance.now() - installStartTime;
});

When('I proceed with the purchase and installation', async function () {
  testContext.purchaseResult = await marketplaceClient.purchase(
    testContext.premiumKPack,
    testContext.paymentInfo
  );
  
  if (testContext.purchaseResult.success) {
    installStartTime = performance.now();
    testContext.installResult = await marketplaceClient.install(testContext.premiumKPack);
    testContext.installDuration = performance.now() - installStartTime;
  }
});

When('I choose to install it in trial mode', async function () {
  testContext.trialInstallResult = await marketplaceClient.installTrial(testContext.trialKPack);
});

When('I choose to install version {string}', async function (specificVersion) {
  const versionedKPack = testContext.versionedKPack.versions[specificVersion];
  expect(versionedKPack).to.not.be.undefined;
  
  testContext.installResult = await marketplaceClient.install(versionedKPack);
});

When('I attempt to install the cached KPack', async function () {
  testContext.offlineInstallResult = await marketplaceClient.installFromCache(
    testContext.cachedKPack.name
  );
});

When('the installation process encounters the error', async function () {
  try {
    testContext.installResult = await marketplaceClient.install(testContext.installationKPack);
  } catch (error) {
    testContext.installError = error;
  }
});

When('I specify the target workspace during installation', async function () {
  testContext.workspaceInstallResult = await marketplaceClient.installToWorkspace(
    testContext.workspaceKPack,
    testContext.targetWorkspace
  );
});

When('I initiate bulk installation', async function () {
  installStartTime = performance.now();
  testContext.bulkInstallResults = await marketplaceClient.bulkInstall(testContext.bulkInstallList);
  testContext.bulkInstallDuration = performance.now() - installStartTime;
});

When('I choose to update the KPack', async function () {
  testContext.updateResult = await marketplaceClient.update(
    testContext.installedKPack.name,
    testContext.updatedKPack.metadata.version
  );
});

When('I uninstall the KPack', async function () {
  testContext.uninstallResult = await marketplaceClient.uninstall(
    testContext.installedForUninstall.name
  );
});

When('I install KPacks of different complexities:', async function (dataTable) {
  testContext.performanceResults = {};
  
  for (const row of dataTable.hashes()) {
    const kpack = testContext.performanceKPacks[row.kpack_size];
    const startTime = performance.now();
    
    const result = await marketplaceClient.install(kpack);
    const duration = (performance.now() - startTime) / 1000; // Convert to seconds
    
    testContext.performanceResults[row.kpack_size] = {
      result: result,
      duration: duration,
      expectedTime: parseFloat(row.expected_time.replace(/[^\d.]/g, ''))
    };
  }
});

Then('the installation should complete within {int} seconds', async function (maxSeconds) {
  const durationInSeconds = testContext.installDuration / 1000;
  expect(durationInSeconds).to.be.lessThan(maxSeconds);
});

Then('the KPack should be downloaded to my local environment', async function () {
  const isDownloaded = await marketplaceClient.isDownloaded(testContext.selectedKPack.name);
  expect(isDownloaded).to.be.true;
  
  // Verify files exist locally
  const localPath = await marketplaceClient.getLocalPath(testContext.selectedKPack.name);
  const stats = await fs.stat(localPath);
  expect(stats.isDirectory()).to.be.true;
});

Then('cryptographic verification should pass', async function () {
  expect(testContext.installResult.verification).to.have.property('passed', true);
  expect(testContext.installResult.verification).to.have.property('signatureValid', true);
  expect(testContext.installResult.verification).to.have.property('integrityValid', true);
});

Then('installation confirmation should be displayed', async function () {
  expect(testContext.installResult).to.have.property('success', true);
  expect(testContext.installResult).to.have.property('message');
  expect(testContext.installResult.message).to.include('successfully installed');
});

Then('the system should verify the cryptographic signatures', async function () {
  expect(testContext.installResult.verification).to.have.property('signatureVerified', true);
});

Then('validate the attestation chain', async function () {
  expect(testContext.installResult.verification).to.have.property('attestationChainValid', true);
});

Then('confirm the publisher\'s identity', async function () {
  expect(testContext.installResult.verification).to.have.property('publisherVerified', true);
  expect(testContext.installResult.verification).to.have.property('publisherId');
});

Then('proceed with installation only if verification passes', async function () {
  if (testContext.installResult.verification.passed) {
    expect(testContext.installResult.success).to.be.true;
  } else {
    expect(testContext.installResult.success).to.be.false;
  }
});

Then('the verification should complete within {int} seconds', async function (maxSeconds) {
  const verificationTime = testContext.installResult.verification.duration / 1000;
  expect(verificationTime).to.be.lessThan(maxSeconds);
});

Then('the system should resolve all dependencies', async function () {
  expect(testContext.installResult.dependencies).to.have.property('resolved', true);
  expect(testContext.installResult.dependencies).to.have.property('resolutionPlan');
  
  const resolvedDeps = testContext.installResult.dependencies.resolutionPlan;
  expect(resolvedDeps).to.be.an('array');
  expect(resolvedDeps.length).to.be.greaterThan(0);
});

Then('install missing dependencies automatically', async function () {
  const installedDeps = await marketplaceClient.getInstalledDependencies(testContext.targetKPack.name);
  
  Object.keys(testContext.targetKPack.dependencies).forEach(depName => {
    const installed = installedDeps.find(dep => dep.name === depName);
    expect(installed).to.not.be.undefined;
  });
});

Then('handle version constraints correctly', async function () {
  const installedDeps = await marketplaceClient.getInstalledDependencies(testContext.targetKPack.name);
  
  Object.entries(testContext.targetKPack.dependencies).forEach(([depName, constraint]) => {
    const installed = installedDeps.find(dep => dep.name === depName);
    expect(installed).to.not.be.undefined;
    
    // Verify version satisfies constraint
    const satisfies = marketplaceClient.versionSatisfies(installed.version, constraint);
    expect(satisfies).to.be.true;
  });
});

Then('complete the entire installation within {int} seconds', async function (maxSeconds) {
  const totalDuration = testContext.installDuration / 1000;
  expect(totalDuration).to.be.lessThan(maxSeconds);
});

Then('I should be prompted for payment confirmation', async function () {
  expect(testContext.purchaseResult).to.have.property('paymentPrompt');
  expect(testContext.purchaseResult.paymentPrompt).to.have.property('amount');
  expect(testContext.purchaseResult.paymentPrompt).to.have.property('currency');
});

Then('payment should be processed securely', async function () {
  expect(testContext.purchaseResult).to.have.property('payment');
  expect(testContext.purchaseResult.payment).to.have.property('transactionId');
  expect(testContext.purchaseResult.payment).to.have.property('status', 'completed');
  expect(testContext.purchaseResult.payment).to.have.property('secure', true);
});

Then('the KPack should be installed after successful payment', async function () {
  expect(testContext.purchaseResult.success).to.be.true;
  expect(testContext.installResult.success).to.be.true;
});

Then('I should receive a purchase receipt', async function () {
  expect(testContext.purchaseResult).to.have.property('receipt');
  expect(testContext.purchaseResult.receipt).to.have.property('receiptId');
  expect(testContext.purchaseResult.receipt).to.have.property('amount');
  expect(testContext.purchaseResult.receipt).to.have.property('timestamp');
});

Then('installation should complete within {int} seconds after payment', async function (maxSeconds) {
  const installDuration = testContext.installDuration / 1000;
  expect(installDuration).to.be.lessThan(maxSeconds);
});

Then('the KPack should be installed with trial limitations', async function () {
  expect(testContext.trialInstallResult).to.have.property('isTrial', true);
  expect(testContext.trialInstallResult).to.have.property('trialExpiration');
  expect(testContext.trialInstallResult).to.have.property('limitations');
});

Then('trial expiration should be clearly indicated', async function () {
  const expirationDate = new Date(testContext.trialInstallResult.trialExpiration);
  const now = new Date();
  const daysDiff = (expirationDate - now) / (1000 * 60 * 60 * 24);
  
  expect(daysDiff).to.be.greaterThan(0);
  expect(daysDiff).to.be.lessThanOrEqual(7); // 7-day trial
});

Then('I should receive notifications about trial status', async function () {
  const notifications = await marketplaceClient.getTrialNotifications();
  const trialNotification = notifications.find(notif => 
    notif.kpackName === testContext.trialKPack.name
  );
  
  expect(trialNotification).to.not.be.undefined;
  expect(trialNotification).to.have.property('type', 'trial_status');
});

Then('have the option to upgrade to full version', async function () {
  const upgradeOptions = await marketplaceClient.getUpgradeOptions(testContext.trialKPack.name);
  expect(upgradeOptions).to.have.property('available', true);
  expect(upgradeOptions).to.have.property('pricing');
});

Then('that specific version should be installed', async function () {
  const installedInfo = await marketplaceClient.getInstalledInfo(testContext.versionedKPack.name);
  expect(installedInfo.version).to.equal('1.5.0');
});

Then('compatibility warnings should be shown if applicable', async function () {
  if (testContext.installResult.warnings) {
    expect(testContext.installResult.warnings).to.be.an('array');
    testContext.installResult.warnings.forEach(warning => {
      expect(warning).to.have.property('type');
      expect(warning).to.have.property('message');
    });
  }
});

Then('the installation should complete successfully', async function () {
  expect(testContext.installResult).to.have.property('success', true);
});

Then('the installation should proceed using the cached version', async function () {
  expect(testContext.offlineInstallResult).to.have.property('usedCache', true);
  expect(testContext.offlineInstallResult).to.have.property('success', true);
});

Then('cryptographic verification should still be performed', async function () {
  expect(testContext.offlineInstallResult.verification).to.have.property('performed', true);
  expect(testContext.offlineInstallResult.verification).to.have.property('passed', true);
});

Then('installation should complete normally', async function () {
  expect(testContext.offlineInstallResult).to.have.property('success', true);
});

Then('the system should rollback any partial changes', async function () {
  expect(testContext.installError).to.have.property('rollbackPerformed', true);
  expect(testContext.installError).to.have.property('rollbackSuccessful', true);
});

Then('provide a clear error message explaining the failure', async function () {
  expect(testContext.installError).to.have.property('message');
  expect(testContext.installError.message).to.include('dependency conflict');
});

Then('suggest resolution steps', async function () {
  expect(testContext.installError).to.have.property('resolutionSteps');
  expect(testContext.installError.resolutionSteps).to.be.an('array');
  expect(testContext.installError.resolutionSteps.length).to.be.greaterThan(0);
});

Then('leave the system in a clean state', async function () {
  const systemState = await marketplaceClient.getSystemState();
  expect(systemState.isClean).to.be.true;
  expect(systemState.hasPartialInstallations).to.be.false;
});

Then('the KPack should be installed in the correct workspace', async function () {
  const workspaceInstalls = await marketplaceClient.getWorkspaceInstalls(testContext.targetWorkspace);
  const installedKPack = workspaceInstalls.find(kpack => 
    kpack.name === testContext.workspaceKPack.name
  );
  
  expect(installedKPack).to.not.be.undefined;
});

Then('be isolated from other workspaces', async function () {
  const otherWorkspaces = testContext.workspaces.filter(ws => ws !== testContext.targetWorkspace);
  
  for (const workspace of otherWorkspaces) {
    const workspaceInstalls = await marketplaceClient.getWorkspaceInstalls(workspace);
    const found = workspaceInstalls.find(kpack => 
      kpack.name === testContext.workspaceKPack.name
    );
    expect(found).to.be.undefined;
  }
});

Then('workspace-specific configurations should be applied', async function () {
  const workspaceConfig = await marketplaceClient.getWorkspaceConfig(testContext.targetWorkspace);
  const kpackConfig = await marketplaceClient.getKPackConfig(
    testContext.workspaceKPack.name,
    testContext.targetWorkspace
  );
  
  expect(kpackConfig).to.have.property('workspaceSpecific', true);
});

Then('all KPacks should be installed concurrently', async function () {
  expect(testContext.bulkInstallResults).to.be.an('array');
  expect(testContext.bulkInstallResults.length).to.equal(testContext.bulkInstallList.length);
  
  testContext.bulkInstallResults.forEach(result => {
    expect(result).to.have.property('success', true);
  });
});

Then('installation progress should be tracked for each', async function () {
  testContext.bulkInstallResults.forEach(result => {
    expect(result).to.have.property('progress');
    expect(result.progress).to.have.property('completed', true);
  });
});

Then('any individual failures should not affect others', async function () {
  // All should succeed in this test scenario
  const successful = testContext.bulkInstallResults.filter(result => result.success);
  expect(successful.length).to.equal(testContext.bulkInstallList.length);
});

Then('total installation time should be optimized', async function () {
  // Bulk installation should be faster than sequential
  const bulkDuration = testContext.bulkInstallDuration / 1000;
  const expectedSequentialTime = testContext.bulkInstallList.length * 2; // 2 seconds each
  
  expect(bulkDuration).to.be.lessThan(expectedSequentialTime);
});

Then('the system should preserve my current configuration', async function () {
  expect(testContext.updateResult).to.have.property('configurationPreserved', true);
  expect(testContext.updateResult).to.have.property('migrationPerformed', true);
});

Then('upgrade to the new version seamlessly', async function () {
  const currentInfo = await marketplaceClient.getInstalledInfo(testContext.installedKPack.name);
  expect(currentInfo.version).to.equal(testContext.updatedKPack.metadata.version);
});

Then('provide a changelog of what\'s new', async function () {
  expect(testContext.updateResult).to.have.property('changelog');
  expect(testContext.updateResult.changelog).to.be.an('array');
  expect(testContext.updateResult.changelog).to.include.members(
    testContext.updatedKPack.metadata.changelog
  );
});

Then('allow rollback if needed', async function () {
  const rollbackOptions = await marketplaceClient.getRollbackOptions(testContext.installedKPack.name);
  expect(rollbackOptions).to.have.property('available', true);
  expect(rollbackOptions).to.have.property('previousVersion');
});

Then('all associated files should be removed', async function () {
  const kpackPath = await marketplaceClient.getLocalPath(testContext.installedForUninstall.name);
  
  try {
    await fs.access(kpackPath);
    // If we reach here, files still exist (should not happen)
    expect.fail('KPack files should have been removed');
  } catch (error) {
    // This is expected - files should not exist after uninstall
    expect(error.code).to.equal('ENOENT');
  }
});

Then('dependencies should be checked for orphaned packages', async function () {
  expect(testContext.uninstallResult).to.have.property('orphanCheck');
  expect(testContext.uninstallResult.orphanCheck).to.have.property('performed', true);
  expect(testContext.uninstallResult.orphanCheck).to.have.property('orphansFound');
});

Then('configuration should be cleaned up', async function () {
  const configExists = await marketplaceClient.hasConfiguration(testContext.installedForUninstall.name);
  expect(configExists).to.be.false;
});

Then('the uninstallation should be confirmed', async function () {
  expect(testContext.uninstallResult).to.have.property('success', true);
  expect(testContext.uninstallResult).to.have.property('confirmationMessage');
});

Then('each installation should meet the performance criteria', async function () {
  Object.entries(testContext.performanceResults).forEach(([size, result]) => {
    expect(result.duration).to.be.lessThan(result.expectedTime);
  });
});

Then('progress indicators should provide accurate estimates', async function () {
  Object.values(testContext.performanceResults).forEach(result => {
    expect(result.result).to.have.property('progressAccuracy');
    expect(result.result.progressAccuracy).to.be.greaterThan(0.9); // 90% accuracy
  });
});

Then('network efficiency should be optimized', async function () {
  Object.values(testContext.performanceResults).forEach(result => {
    expect(result.result).to.have.property('networkEfficiency');
    expect(result.result.networkEfficiency).to.have.property('compressionUsed', true);
    expect(result.result.networkEfficiency).to.have.property('deltaDownloads');
  });
});