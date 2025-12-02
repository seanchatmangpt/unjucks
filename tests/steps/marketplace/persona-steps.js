const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const MarketplaceClient = require('../../utils/marketplace-client');
const PersonaManager = require('../../utils/persona-manager');
const TestDataFactory = require('../../fixtures/test-data-factory');

let testContext = {};
let marketplaceClient;
let personaManager;

Given('the marketplace has persona-based organization enabled', async function () {
  marketplaceClient = new MarketplaceClient();
  personaManager = new PersonaManager();
  
  const personaStatus = await personaManager.getPersonaStatus();
  expect(personaStatus.enabled).to.be.true;
});

Given('multiple personas are configured with specific content curation', async function () {
  testContext.availablePersonas = await personaManager.getAvailablePersonas();
  expect(testContext.availablePersonas.length).to.be.greaterThan(0);
  
  // Verify each persona has curation rules
  testContext.availablePersonas.forEach(persona => {
    expect(persona).to.have.property('curationRules');
    expect(persona.curationRules).to.be.an('object');
  });
});

Given('I have access to the marketplace', async function () {
  const healthCheck = await marketplaceClient.checkHealth();
  expect(healthCheck.status).to.equal('healthy');
});

Given('I select the {string} persona', async function (personaName) {
  testContext.selectedPersona = personaName;
  testContext.personaContext = await personaManager.activatePersona(personaName);
  expect(testContext.personaContext.active).to.be.true;
});

Given('I start browsing as a {string}', async function (initialPersona) {
  testContext.initialPersona = initialPersona;
  await personaManager.activatePersona(initialPersona);
  testContext.browsingHistory = await marketplaceClient.getBrowsingHistory();
});

Given('I switch to {string} persona', async function (newPersona) {
  testContext.newPersona = newPersona;
  testContext.switchResult = await personaManager.switchPersona(newPersona);
  expect(testContext.switchResult.success).to.be.true;
});

Given('I have been using the {string} persona', async function (personaName) {
  await personaManager.activatePersona(personaName);
  
  // Create interaction history
  testContext.interactionHistory = [
    { action: 'search', query: 'neural networks', timestamp: new Date(Date.now() - 86400000) },
    { action: 'view', kpack: 'computer-vision-toolkit', timestamp: new Date(Date.now() - 43200000) },
    { action: 'download', kpack: 'image-processing-utils', timestamp: new Date(Date.now() - 21600000) }
  ];
  
  await personaManager.recordInteractions(testContext.interactionHistory);
});

Given('my interaction history shows interest in {string}', async function (interest) {
  testContext.userInterests = [interest];
  await personaManager.updateUserInterests(testContext.userInterests);
});

Given('I am a new user selecting {string} persona', async function (personaName) {
  testContext.isNewUser = true;
  testContext.selectedPersona = personaName;
  testContext.onboardingContext = await personaManager.initiateOnboarding(personaName);
});

Given('personas can be adapted for accessibility requirements', async function () {
  const accessibilitySupport = await personaManager.getAccessibilitySupport();
  expect(accessibilitySupport.enabled).to.be.true;
  expect(accessibilitySupport.features).to.be.an('array');
});

Given('I enable accessibility features for {string} persona', async function (personaName) {
  testContext.accessibilityFeatures = [
    'screen_reader',
    'high_contrast',
    'keyboard_navigation',
    'content_simplification'
  ];
  
  testContext.accessibilityContext = await personaManager.enableAccessibility(
    personaName,
    testContext.accessibilityFeatures
  );
});

Given('I work as both {string} and {string}', async function (role1, role2) {
  testContext.multiRoles = [role1, role2];
  testContext.hybridPersonaNeeds = {
    primaryRole: role1,
    secondaryRole: role2,
    balancePreference: 0.6 // 60% primary, 40% secondary
  };
});

Given('analytics are enabled for persona views', async function () {
  const analyticsStatus = await personaManager.getAnalyticsStatus();
  expect(analyticsStatus.enabled).to.be.true;
  expect(analyticsStatus.trackingPersonas).to.be.true;
});

Given('users interact with different persona interfaces', async function () {
  // Simulate various user interactions across personas
  testContext.personaInteractions = [
    { persona: 'Developer', action: 'search', query: 'react components' },
    { persona: 'Data Scientist', action: 'view', kpack: 'ml-toolkit' },
    { persona: 'DevOps Engineer', action: 'download', kpack: 'k8s-configs' }
  ];
  
  for (const interaction of testContext.personaInteractions) {
    await personaManager.trackInteraction(interaction);
  }
});

Given('editorial teams curate content for different personas', async function () {
  testContext.editorialCuration = await personaManager.getEditorialCuration();
  expect(testContext.editorialCuration.enabled).to.be.true;
  expect(testContext.editorialCuration.teams).to.be.an('array');
});

Given('new KPacks are published', async function () {
  testContext.newKPacks = [
    TestDataFactory.createKPackWithFacets('advanced-ml-pipeline', {
      category: ['machine-learning'],
      technology: ['python', 'tensorflow'],
      difficulty: ['advanced'],
      useCase: ['computer-vision']
    }),
    TestDataFactory.createKPackWithFacets('security-audit-tools', {
      category: ['security'],
      technology: ['bash', 'python'],
      difficulty: ['intermediate'],
      useCase: ['compliance']
    })
  ];
  
  for (const kpack of testContext.newKPacks) {
    await marketplaceClient.publish(kpack);
  }
});

Given('users can provide feedback on persona experiences', async function () {
  const feedbackSystem = await personaManager.getFeedbackSystem();
  expect(feedbackSystem.enabled).to.be.true;
  expect(feedbackSystem.mechanisms).to.be.an('array');
});

Given('I use the {string} persona view', async function (personaName) {
  testContext.currentPersona = personaName;
  await personaManager.activatePersona(personaName);
});

When('I browse the marketplace', async function () {
  testContext.curatedContent = await marketplaceClient.getBrowseContent(testContext.selectedPersona);
});

When('I explore the marketplace', async function () {
  testContext.explorationResults = await marketplaceClient.exploreByPersona(testContext.selectedPersona);
});

When('I navigate the marketplace', async function () {
  testContext.navigationResults = await marketplaceClient.navigateByPersona(testContext.selectedPersona);
});

When('I view available KPacks', async function () {
  testContext.availableKPacks = await marketplaceClient.getAvailableKPacks(testContext.selectedPersona);
});

When('I view the same KPack from both perspectives', async function () {
  const kpackName = 'multi-purpose-analytics-toolkit';
  
  testContext.developerView = await marketplaceClient.getKPackView(kpackName, testContext.initialPersona);
  testContext.dataScientistView = await marketplaceClient.getKPackView(kpackName, testContext.newPersona);
});

When('I visit the marketplace homepage', async function () {
  testContext.personalizedHomepage = await marketplaceClient.getPersonalizedHomepage(
    testContext.selectedPersona,
    testContext.interactionHistory
  );
});

When('I first access the marketplace', async function () {
  testContext.onboardingExperience = await personaManager.getOnboardingExperience(
    testContext.selectedPersona,
    testContext.isNewUser
  );
});

When('I create a custom hybrid persona', async function () {
  testContext.hybridPersona = await personaManager.createHybridPersona(
    testContext.multiRoles,
    testContext.hybridPersonaNeeds
  );
});

When('users interact with different persona interfaces', async function () {
  // Additional interactions for analytics testing
  const additionalInteractions = [
    { persona: 'Business Analyst', action: 'search', query: 'roi dashboard' },
    { persona: 'Product Manager', action: 'view', kpack: 'user-analytics' }
  ];
  
  for (const interaction of additionalInteractions) {
    await personaManager.trackInteraction(interaction);
  }
});

When('new KPacks are published', async function () {
  testContext.curationResults = [];
  
  for (const kpack of testContext.newKPacks) {
    const curation = await personaManager.evaluateForPersonas(kpack);
    testContext.curationResults.push(curation);
  }
});

When('I use the {string} persona view', async function (personaName) {
  testContext.personaExperience = await marketplaceClient.getPersonaExperience(personaName);
});

Then('I should see KPacks curated for developers including:', async function (dataTable) {
  expect(testContext.curatedContent).to.have.property('categories');
  
  dataTable.hashes().forEach(row => {
    const category = row.category;
    const examples = row.examples.split(', ');
    
    expect(testContext.curatedContent.categories).to.have.property(category);
    examples.forEach(example => {
      const found = testContext.curatedContent.categories[category].some(kpack => 
        kpack.name.includes(example.replace('-', '_'))
      );
      expect(found).to.be.true;
    });
  });
});

Then('the content should be filtered for technical complexity', async function () {
  testContext.curatedContent.items.forEach(kpack => {
    expect(kpack.metadata.complexity).to.be.oneOf(['intermediate', 'advanced']);
  });
});

Then('code samples should be prominently displayed', async function () {
  testContext.curatedContent.items.forEach(kpack => {
    if (kpack.hasCodeSamples) {
      expect(kpack.displayOptions).to.have.property('prominentCodeSamples', true);
    }
  });
});

Then('I should see specialized content including:', async function (dataTable) {
  expect(testContext.explorationResults).to.have.property('specializedContent');
  
  dataTable.hashes().forEach(row => {
    const category = row.category;
    const focusAreas = row.focus_areas.split(', ');
    
    expect(testContext.explorationResults.specializedContent).to.have.property(category);
    
    focusAreas.forEach(area => {
      const areaContent = testContext.explorationResults.specializedContent[category];
      const hasArea = areaContent.some(item => 
        item.tags.includes(area.replace('-', '_'))
      );
      expect(hasArea).to.be.true;
    });
  });
});

Then('mathematical notation should be rendered properly', async function () {
  const mathContent = testContext.explorationResults.specializedContent['statistical-analysis'];
  mathContent.forEach(item => {
    if (item.hasMathNotation) {
      expect(item.renderingOptions).to.have.property('mathJax', true);
      expect(item.renderingOptions).to.have.property('latexSupport', true);
    }
  });
});

Then('dataset compatibility should be highlighted', async function () {
  testContext.explorationResults.specializedContent['data-processing'].forEach(item => {
    expect(item).to.have.property('datasetCompatibility');
    expect(item.datasetCompatibility).to.be.an('array');
  });
});

Then('I should see business-focused KPacks such as:', async function (dataTable) {
  expect(testContext.navigationResults).to.have.property('businessFocused');
  
  dataTable.hashes().forEach(row => {
    const type = row.type;
    const description = row.description;
    
    const found = testContext.navigationResults.businessFocused.some(kpack =>
      kpack.type === type.replace('-', '_') && 
      kpack.description.includes(description.replace('-', ' '))
    );
    expect(found).to.be.true;
  });
});

Then('technical details should be abstracted', async function () {
  testContext.navigationResults.businessFocused.forEach(kpack => {
    expect(kpack.presentation).to.have.property('abstractTechnical', true);
    expect(kpack.presentation).to.have.property('businessLanguage', true);
  });
});

Then('business value propositions should be emphasized', async function () {
  testContext.navigationResults.businessFocused.forEach(kpack => {
    expect(kpack).to.have.property('valueProposition');
    expect(kpack.valueProposition).to.have.property('roi');
    expect(kpack.valueProposition).to.have.property('businessImpact');
  });
});

Then('I should see infrastructure and deployment focused content:', async function (dataTable) {
  expect(testContext.availableKPacks).to.have.property('infrastructureFocused');
  
  dataTable.hashes().forEach(row => {
    const category = row.category;
    const tools = row.tools.split(', ');
    
    expect(testContext.availableKPacks.infrastructureFocused).to.have.property(category);
    
    tools.forEach(tool => {
      const found = testContext.availableKPacks.infrastructureFocused[category].some(kpack =>
        kpack.name.includes(tool.replace('-', '_'))
      );
      expect(found).to.be.true;
    });
  });
});

Then('operational metrics should be displayed', async function () {
  testContext.availableKPacks.infrastructureFocused.monitoring.forEach(kpack => {
    expect(kpack.metadata).to.have.property('operationalMetrics');
    expect(kpack.metadata.operationalMetrics).to.include.keys(['uptime', 'performance', 'alerts']);
  });
});

Then('compatibility with cloud platforms should be indicated', async function () {
  Object.values(testContext.availableKPacks.infrastructureFocused).flat().forEach(kpack => {
    expect(kpack.metadata).to.have.property('cloudCompatibility');
    expect(kpack.metadata.cloudCompatibility).to.be.an('array');
  });
});

Then('the KPack details should adapt to show relevant information:', async function (dataTable) {
  const viewComparisons = {};
  dataTable.hashes().forEach(row => {
    viewComparisons[row.persona_view] = row.emphasized_content.split(', ');
  });
  
  // Verify developer view
  const devContent = viewComparisons.developer;
  devContent.forEach(content => {
    expect(testContext.developerView.emphasizedContent).to.include(content.replace('_', ' '));
  });
  
  // Verify data scientist view
  const dsContent = viewComparisons.data_scientist;
  dsContent.forEach(content => {
    expect(testContext.dataScientistView.emphasizedContent).to.include(content.replace('_', ' '));
  });
});

Then('the interface should update smoothly', async function () {
  expect(testContext.switchResult).to.have.property('transitionTime');
  expect(testContext.switchResult.transitionTime).to.be.lessThan(500); // milliseconds
});

Then('my browsing context should be preserved', async function () {
  const currentContext = await marketplaceClient.getBrowsingContext();
  expect(currentContext.preservedElements).to.include.members([
    'searchQuery', 'scrollPosition', 'selectedFilters'
  ]);
});

Then('I should see personalized recommendations including:', async function (dataTable) {
  expect(testContext.personalizedHomepage).to.have.property('recommendations');
  
  dataTable.hashes().forEach(row => {
    const recType = row.recommendation_type;
    const examples = row.examples.split(', ');
    
    expect(testContext.personalizedHomepage.recommendations).to.have.property(recType);
    
    examples.forEach(example => {
      const found = testContext.personalizedHomepage.recommendations[recType].some(rec =>
        rec.includes(example.replace('-', ' '))
      );
      expect(found).to.be.true;
    });
  });
});

Then('recommendations should be updated based on recent activity', async function () {
  expect(testContext.personalizedHomepage).to.have.property('lastUpdated');
  const lastUpdate = new Date(testContext.personalizedHomepage.lastUpdated);
  const now = new Date();
  const timeDiff = now - lastUpdate;
  
  expect(timeDiff).to.be.lessThan(86400000); // Updated within 24 hours
});

Then('I should receive a guided tour showing:', async function (dataTable) {
  expect(testContext.onboardingExperience).to.have.property('guidedTour');
  
  dataTable.hashes().forEach(row => {
    const element = row.tour_element;
    const description = row.description;
    
    const tourStep = testContext.onboardingExperience.guidedTour.steps.find(step =>
      step.element === element.replace('_', ' ')
    );
    
    expect(tourStep).to.not.be.undefined;
    expect(tourStep.description).to.include(description);
  });
});

Then('the tour should be interactive and skippable', async function () {
  expect(testContext.onboardingExperience.guidedTour).to.have.property('interactive', true);
  expect(testContext.onboardingExperience.guidedTour).to.have.property('skippable', true);
  expect(testContext.onboardingExperience.guidedTour).to.have.property('skipOption');
});

Then('the interface should adapt to support:', async function (dataTable) {
  dataTable.hashes().forEach(row => {
    const feature = row.accessibility_feature;
    const implementation = row.implementation;
    
    expect(testContext.accessibilityContext.adaptations).to.have.property(feature);
    expect(testContext.accessibilityContext.adaptations[feature]).to.include(implementation);
  });
});

Then('persona-specific content should remain fully accessible', async function () {
  expect(testContext.accessibilityContext).to.have.property('contentAccessibility');
  expect(testContext.accessibilityContext.contentAccessibility.compliant).to.be.true;
  expect(testContext.accessibilityContext.contentAccessibility.wcagLevel).to.equal('AA');
});

Then('I should be able to combine views showing:', async function (dataTable) {
  expect(testContext.hybridPersona).to.have.property('combinedViews');
  
  dataTable.hashes().forEach(row => {
    const roleAspect = row.role_aspect;
    const contentType = row.content_type.split(', ');
    
    expect(testContext.hybridPersona.combinedViews).to.have.property(roleAspect);
    
    contentType.forEach(type => {
      expect(testContext.hybridPersona.combinedViews[roleAspect]).to.include(type.replace('_', ' '));
    });
  });
});

Then('the hybrid view should balance both perspectives', async function () {
  expect(testContext.hybridPersona).to.have.property('balance');
  expect(testContext.hybridPersona.balance.primary).to.equal(0.6);
  expect(testContext.hybridPersona.balance.secondary).to.equal(0.4);
});

Then('I should be able to adjust the balance between roles', async function () {
  expect(testContext.hybridPersona).to.have.property('adjustableBalance', true);
  expect(testContext.hybridPersona).to.have.property('balanceControls');
});

Then('the system should track:', async function (dataTable) {
  const analytics = await personaManager.getPersonaAnalytics();
  
  dataTable.hashes().forEach(row => {
    const metricType = row.metric_type;
    const dataPoints = row.data_points.split(', ');
    
    expect(analytics.metrics).to.have.property(metricType);
    
    dataPoints.forEach(dataPoint => {
      expect(analytics.metrics[metricType]).to.have.property(dataPoint.replace('_', ' '));
    });
  });
});

Then('insights should inform persona optimization', async function () {
  const optimization = await personaManager.getOptimizationInsights();
  expect(optimization).to.have.property('recommendations');
  expect(optimization.recommendations).to.be.an('array');
  expect(optimization.recommendations.length).to.be.greaterThan(0);
});

Then('they should be evaluated for persona relevance:', async function (dataTable) {
  dataTable.hashes().forEach(row => {
    const criteria = row.evaluation_criteria;
    const scoring = row.persona_fit_scoring.split('_');
    
    testContext.curationResults.forEach(result => {
      expect(result.evaluation).to.have.property(criteria);
      expect(result.evaluation[criteria].categories).to.include.members(scoring);
    });
  });
});

Then('curated collections should be maintained for each persona', async function () {
  const collections = await personaManager.getCuratedCollections();
  
  testContext.availablePersonas.forEach(persona => {
    expect(collections).to.have.property(persona.name);
    expect(collections[persona.name]).to.be.an('array');
  });
});

Then('featured content should rotate based on persona engagement', async function () {
  const featuredContent = await personaManager.getFeaturedContent();
  
  Object.values(featuredContent).forEach(personaContent => {
    expect(personaContent).to.have.property('rotationSchedule');
    expect(personaContent).to.have.property('engagementMetrics');
  });
});

Then('I should have options to:', async function (dataTable) {
  expect(testContext.personaExperience).to.have.property('feedbackOptions');
  
  dataTable.hashes().forEach(row => {
    const feedbackType = row.feedback_type;
    const mechanism = row.mechanism;
    
    expect(testContext.personaExperience.feedbackOptions).to.have.property(feedbackType);
    expect(testContext.personaExperience.feedbackOptions[feedbackType].mechanism).to.equal(mechanism);
  });
});

Then('feedback should be used to continuously improve persona views', async function () {
  const improvementCycle = await personaManager.getImprovementCycle();
  expect(improvementCycle).to.have.property('feedbackIntegration', true);
  expect(improvementCycle).to.have.property('iterationFrequency');
  expect(improvementCycle).to.have.property('lastImprovement');
});