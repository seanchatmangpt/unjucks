const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { performance } = require('perf_hooks');
const MarketplaceClient = require('../../utils/marketplace-client');
const TestDataFactory = require('../../fixtures/test-data-factory');

let testContext = {};
let marketplaceClient;
let searchStartTime;

Given('the marketplace contains published KPacks', async function () {
  marketplaceClient = new MarketplaceClient();
  
  // Seed marketplace with test data
  const testKPacks = [
    TestDataFactory.createKPackWithFacets('data-visualization-pro', {
      category: ['data-science', 'visualization'],
      technology: ['javascript', 'react'],
      difficulty: ['intermediate']
    }),
    TestDataFactory.createKPackWithFacets('machine-learning-toolkit', {
      category: ['machine-learning', 'ai'],
      technology: ['python', 'tensorflow'],
      difficulty: ['advanced']
    }),
    TestDataFactory.createKPackWithFacets('beginner-analytics', {
      category: ['analytics', 'reporting'],
      technology: ['python', 'pandas'],
      difficulty: ['beginner']
    })
  ];
  
  await Promise.all(testKPacks.map(kpack => marketplaceClient.publish(kpack)));
  testContext.seededKPacks = testKPacks;
});

Given('search indexing is up to date', async function () {
  await marketplaceClient.refreshSearchIndex();
  const indexStatus = await marketplaceClient.getIndexStatus();
  expect(indexStatus.isUpToDate).to.be.true;
});

Given('I have access to the marketplace', async function () {
  const healthCheck = await marketplaceClient.checkHealth();
  expect(healthCheck.status).to.equal('healthy');
});

Given('the marketplace contains KPacks with various names and descriptions', async function () {
  // This is covered by the seeded data in the first Given step
  expect(testContext.seededKPacks).to.have.length.greaterThan(0);
});

Given('the marketplace contains KPacks with various facets', async function () {
  // Verify faceted data exists
  testContext.seededKPacks.forEach(kpack => {
    expect(kpack.facets).to.be.an('object');
    expect(Object.keys(kpack.facets)).to.have.length.greaterThan(0);
  });
});

Given('the marketplace contains diverse KPacks', async function () {
  // Add more diverse test data for boolean search testing
  const diverseKPacks = [
    TestDataFactory.createKPack({
      name: 'data-analytics-suite',
      description: 'Comprehensive data analytics and visualization tools'
    }),
    TestDataFactory.createKPack({
      name: 'deprecated-data-tools',
      description: 'Legacy data processing utilities',
      status: 'deprecated'
    }),
    TestDataFactory.createKPack({
      name: 'visualization-components',
      description: 'Modern visualization components for web applications'
    })
  ];
  
  await Promise.all(diverseKPacks.map(kpack => marketplaceClient.publish(kpack)));
  testContext.diverseKPacks = diverseKPacks;
});

Given('I am typing in the search box', async function () {
  testContext.searchInProgress = true;
});

Given('I have search results for {string}', async function (searchTerm) {
  testContext.currentSearchTerm = searchTerm;
  testContext.searchResults = await marketplaceClient.search(searchTerm);
});

Given('the marketplace has semantic search enabled', async function () {
  const semanticConfig = await marketplaceClient.getSemanticSearchConfig();
  expect(semanticConfig.enabled).to.be.true;
});

Given('search analytics are tracked', async function () {
  const analyticsStatus = await marketplaceClient.getAnalyticsStatus();
  expect(analyticsStatus.searchTracking).to.be.true;
});

Given('I search for a very specific non-existent term', async function () {
  testContext.impossibleSearchTerm = 'zxywvutsrqp123impossible';
});

Given('multiple users are searching simultaneously', async function () {
  testContext.concurrentUsers = 100;
  testContext.loadTestScenario = true;
});

Given('I have a search and download history', async function () {
  testContext.userHistory = {
    searches: ['data science', 'python tools', 'machine learning'],
    downloads: ['pandas-extensions', 'sklearn-utils', 'jupyter-helpers'],
    preferences: {
      categories: ['data-science'],
      technologies: ['python']
    }
  };
  await marketplaceClient.updateUserProfile(testContext.userHistory);
});

Given('my preferences indicate interest in {string} and {string}', async function (interest1, interest2) {
  testContext.userPreferences = {
    interests: [interest1, interest2],
    skillLevel: 'intermediate'
  };
});

Given('I have performed a complex search with filters', async function () {
  testContext.complexSearch = {
    query: 'machine learning',
    filters: {
      category: ['ai', 'data-science'],
      technology: ['python'],
      difficulty: ['intermediate', 'advanced']
    },
    sort: 'relevance'
  };
  testContext.searchResults = await marketplaceClient.searchWithFilters(testContext.complexSearch);
});

When('I search for {string}', async function (searchTerm) {
  searchStartTime = performance.now();
  testContext.searchResults = await marketplaceClient.search(searchTerm);
  testContext.searchDuration = performance.now() - searchStartTime;
});

When('I search with the following filters:', async function (dataTable) {
  const filters = {};
  dataTable.hashes().forEach(row => {
    const facetType = row.facet_type;
    const facetValue = row.facet_value;
    
    if (!filters[facetType]) {
      filters[facetType] = [];
    }
    filters[facetType].push(facetValue);
  });
  
  searchStartTime = performance.now();
  testContext.searchResults = await marketplaceClient.searchWithFilters({ filters });
  testContext.searchDuration = performance.now() - searchStartTime;
});

When('I search using the query: {string}', async function (booleanQuery) {
  searchStartTime = performance.now();
  testContext.searchResults = await marketplaceClient.searchBoolean(booleanQuery);
  testContext.searchDuration = performance.now() - searchStartTime;
});

When('I enter {string}', async function (partialInput) {
  testContext.autocompleteResults = await marketplaceClient.getAutocomplete(partialInput);
  testContext.autocompleteStartTime = performance.now();
});

When('I search for a broad term that returns many results', async function () {
  testContext.searchResults = await marketplaceClient.search('tools');
  testContext.totalResults = testContext.searchResults.totalCount;
});

When('I apply the following sorting and filters:', async function (dataTable) {
  const operations = {};
  dataTable.hashes().forEach(row => {
    operations[row.action] = row.value;
  });
  
  const filterStartTime = performance.now();
  testContext.filteredResults = await marketplaceClient.applyFiltersAndSort(
    testContext.searchResults,
    operations
  );
  testContext.filterDuration = performance.now() - filterStartTime;
});

When('I search for {string}', async function (semanticQuery) {
  searchStartTime = performance.now();
  testContext.semanticResults = await marketplaceClient.searchSemantic(semanticQuery);
  testContext.searchDuration = performance.now() - searchStartTime;
});

When('I search without specific terms', async function () {
  testContext.trendingResults = await marketplaceClient.getTrending();
});

When('I search for {string}', async function (impossibleTerm) {
  testContext.noResultsResponse = await marketplaceClient.search(impossibleTerm);
  testContext.noResultsStartTime = performance.now();
});

When('{int} concurrent users perform different searches', async function (userCount) {
  const searchPromises = [];
  const searchTerms = ['analytics', 'visualization', 'machine learning', 'data processing'];
  
  for (let i = 0; i < userCount; i++) {
    const randomTerm = searchTerms[i % searchTerms.length];
    searchPromises.push(marketplaceClient.search(randomTerm));
  }
  
  const startTime = performance.now();
  testContext.concurrentResults = await Promise.allSettled(searchPromises);
  testContext.loadTestDuration = performance.now() - startTime;
});

When('I search for {string}', async function (searchTerm) {
  testContext.personalizedResults = await marketplaceClient.searchPersonalized(
    searchTerm, 
    testContext.userPreferences
  );
});

When('I choose to save the search', async function () {
  testContext.savedSearch = await marketplaceClient.saveSearch({
    name: 'My Complex Search',
    criteria: testContext.complexSearch
  });
});

Then('I should receive search results within {int}ms', async function (maxLatency) {
  expect(testContext.searchDuration).to.be.lessThan(maxLatency);
});

Then('the results should be ranked by relevance', async function () {
  expect(testContext.searchResults).to.be.an('array');
  
  // Verify results are sorted by relevance score (descending)
  for (let i = 0; i < testContext.searchResults.length - 1; i++) {
    expect(testContext.searchResults[i].relevanceScore)
      .to.be.greaterThanOrEqual(testContext.searchResults[i + 1].relevanceScore);
  }
});

Then('each result should include:', async function (dataTable) {
  const requiredFields = dataTable.raw().flat();
  
  testContext.searchResults.forEach(result => {
    requiredFields.forEach(field => {
      expect(result).to.have.property(field);
    });
  });
});

Then('the results should include only KPacks matching all criteria', async function () {
  testContext.searchResults.forEach(result => {
    expect(result.facets.category).to.include('machine-learning');
    expect(result.facets.technology).to.include('python');
    expect(result.facets.difficulty).to.include('beginner');
  });
});

Then('the search should complete within {int}ms', async function (maxLatency) {
  expect(testContext.searchDuration).to.be.lessThan(maxLatency);
});

Then('facet counts should be updated for available refinements', async function () {
  expect(testContext.searchResults).to.have.property('facetCounts');
  expect(testContext.searchResults.facetCounts).to.be.an('object');
  
  Object.values(testContext.searchResults.facetCounts).forEach(count => {
    expect(count).to.be.a('number');
    expect(count).to.be.greaterThanOrEqual(0);
  });
});

Then('the results should match the boolean logic', async function () {
  testContext.searchResults.forEach(result => {
    const description = result.description.toLowerCase();
    const name = result.name.toLowerCase();
    const content = `${description} ${name}`;
    
    // Must contain "data"
    expect(content).to.include('data');
    
    // Must contain either "visualization" or "analytics"
    const hasVisualization = content.includes('visualization');
    const hasAnalytics = content.includes('analytics');
    expect(hasVisualization || hasAnalytics).to.be.true;
    
    // Must not be deprecated
    expect(result.status).to.not.equal('deprecated');
  });
});

Then('include KPacks containing {string} and either {string} or {string}', async function (required, option1, option2) {
  testContext.searchResults.forEach(result => {
    const content = `${result.description} ${result.name}`.toLowerCase();
    expect(content).to.include(required.toLowerCase());
    
    const hasOption1 = content.includes(option1.toLowerCase());
    const hasOption2 = content.includes(option2.toLowerCase());
    expect(hasOption1 || hasOption2).to.be.true;
  });
});

Then('exclude any KPacks marked as deprecated', async function () {
  testContext.searchResults.forEach(result => {
    expect(result.status).to.not.equal('deprecated');
  });
});

Then('the search latency should be under {int}ms', async function (maxLatency) {
  expect(testContext.searchDuration).to.be.lessThan(maxLatency);
});

Then('I should receive autocomplete suggestions including:', async function (dataTable) {
  const expectedSuggestions = dataTable.raw().flat();
  
  expect(testContext.autocompleteResults).to.be.an('array');
  expectedSuggestions.forEach(suggestion => {
    const found = testContext.autocompleteResults.some(result => 
      result.includes(suggestion)
    );
    expect(found).to.be.true;
  });
});

Then('suggestions should appear within {int}ms', async function (maxLatency) {
  const autocompleteLatency = performance.now() - testContext.autocompleteStartTime;
  expect(autocompleteLatency).to.be.lessThan(maxLatency);
});

Then('be ranked by popularity and relevance', async function () {
  // Verify suggestions are properly ranked
  expect(testContext.autocompleteResults[0]).to.have.property('popularityScore');
  expect(testContext.autocompleteResults[0]).to.have.property('relevanceScore');
});

Then('the first page should show {int} results', async function (expectedCount) {
  expect(testContext.searchResults.length).to.equal(expectedCount);
});

Then('pagination controls should be available', async function () {
  expect(testContext.searchResults).to.have.property('pagination');
  expect(testContext.searchResults.pagination).to.have.property('totalPages');
  expect(testContext.searchResults.pagination).to.have.property('currentPage');
  expect(testContext.searchResults.pagination).to.have.property('hasNext');
});

Then('I should be able to navigate to subsequent pages', async function () {
  const nextPage = await marketplaceClient.getPage(2);
  expect(nextPage).to.be.an('array');
  expect(nextPage.length).to.be.greaterThan(0);
});

Then('each page load should complete within {int}ms', async function (maxLatency) {
  const pageStartTime = performance.now();
  await marketplaceClient.getPage(2);
  const pageLoadTime = performance.now() - pageStartTime;
  expect(pageLoadTime).to.be.lessThan(maxLatency);
});

Then('the results should be reordered accordingly', async function () {
  // Verify sorting by download count (descending)
  for (let i = 0; i < testContext.filteredResults.length - 1; i++) {
    expect(testContext.filteredResults[i].downloadCount)
      .to.be.greaterThanOrEqual(testContext.filteredResults[i + 1].downloadCount);
  }
});

Then('show only KPacks matching the filters', async function () {
  testContext.filteredResults.forEach(result => {
    expect(result.rating).to.be.greaterThan(4);
    expect(result.publishedWithin).to.be.lessThanOrEqual(30); // days
  });
});

Then('the filtering should complete within {int}ms', async function (maxLatency) {
  expect(testContext.filterDuration).to.be.lessThan(maxLatency);
});

Then('the results should include semantically related KPacks like:', async function (dataTable) {
  const expectedRelated = dataTable.raw().flat();
  
  const foundRelated = testContext.semanticResults.filter(result => {
    const content = `${result.description} ${result.name}`.toLowerCase();
    return expectedRelated.some(term => content.includes(term.toLowerCase()));
  });
  
  expect(foundRelated.length).to.be.greaterThan(0);
});

Then('semantic matches should be clearly indicated', async function () {
  testContext.semanticResults.forEach(result => {
    if (result.isSemanticMatch) {
      expect(result).to.have.property('semanticSimilarity');
      expect(result.semanticSimilarity).to.be.a('number');
    }
  });
});

Then('relevance scores should reflect semantic similarity', async function () {
  const semanticMatches = testContext.semanticResults.filter(r => r.isSemanticMatch);
  semanticMatches.forEach(result => {
    expect(result.semanticSimilarity).to.be.greaterThan(0.5);
  });
});

Then('I should see trending KPacks prominently', async function () {
  expect(testContext.trendingResults).to.have.property('trending');
  expect(testContext.trendingResults.trending).to.be.an('array');
  expect(testContext.trendingResults.trending.length).to.be.greaterThan(0);
});

Then('popular searches should be suggested', async function () {
  expect(testContext.trendingResults).to.have.property('popularSearches');
  expect(testContext.trendingResults.popularSearches).to.be.an('array');
});

Then('recently published KPacks should be highlighted', async function () {
  expect(testContext.trendingResults).to.have.property('recent');
  expect(testContext.trendingResults.recent).to.be.an('array');
});

Then('the trending section should update based on real usage data', async function () {
  // Verify trending data has timestamps and usage metrics
  testContext.trendingResults.trending.forEach(item => {
    expect(item).to.have.property('trendingScore');
    expect(item).to.have.property('lastUpdated');
  });
});

Then('I should receive a helpful {string} message', async function (messageType) {
  expect(testContext.noResultsResponse).to.have.property('message');
  expect(testContext.noResultsResponse.message).to.include('no results');
});

Then('be presented with search suggestions', async function () {
  expect(testContext.noResultsResponse).to.have.property('suggestions');
  expect(testContext.noResultsResponse.suggestions).to.be.an('array');
});

Then('see related or popular KPacks as alternatives', async function () {
  expect(testContext.noResultsResponse).to.have.property('alternatives');
  expect(testContext.noResultsResponse.alternatives).to.be.an('array');
});

Then('the response should be immediate \\(under {int}ms)', async function (maxLatency) {
  const responseTime = performance.now() - testContext.noResultsStartTime;
  expect(responseTime).to.be.lessThan(maxLatency);
});

Then('each search should complete within {int}ms', async function (maxLatency) {
  const avgLatency = testContext.loadTestDuration / testContext.concurrentUsers;
  expect(avgLatency).to.be.lessThan(maxLatency);
});

Then('the search service should maintain responsiveness', async function () {
  const successfulSearches = testContext.concurrentResults.filter(
    result => result.status === 'fulfilled'
  );
  expect(successfulSearches.length).to.equal(testContext.concurrentUsers);
});

Then('no search requests should timeout or fail', async function () {
  const failures = testContext.concurrentResults.filter(
    result => result.status === 'rejected'
  );
  expect(failures.length).to.equal(0);
});

Then('search accuracy should remain consistent', async function () {
  // Verify that concurrent searches don't affect result quality
  testContext.concurrentResults.forEach(result => {
    if (result.status === 'fulfilled') {
      expect(result.value).to.be.an('array');
      expect(result.value.length).to.be.greaterThan(0);
    }
  });
});

Then('data science tools should be ranked higher', async function () {
  const dataScienceResults = testContext.personalizedResults.filter(result =>
    result.categories.includes('data-science')
  );
  
  // Verify data science results appear in top positions
  const topResults = testContext.personalizedResults.slice(0, 5);
  const dataScienceInTop = topResults.filter(result =>
    result.categories.includes('data-science')
  );
  
  expect(dataScienceInTop.length).to.be.greaterThan(0);
});

Then('Python-based KPacks should receive preference', async function () {
  const pythonResults = testContext.personalizedResults.filter(result =>
    result.technologies.includes('python')
  );
  
  expect(pythonResults.length).to.be.greaterThan(0);
  
  // Check if Python results have higher personalization scores
  pythonResults.forEach(result => {
    expect(result.personalizationBoost).to.be.greaterThan(0);
  });
});

Then('my interaction history should influence relevance scoring', async function () {
  // Verify that results include personalization metadata
  testContext.personalizedResults.forEach(result => {
    expect(result).to.have.property('baseRelevance');
    expect(result).to.have.property('personalizedRelevance');
  });
});

Then('personalized results should be clearly marked', async function () {
  const personalizedResults = testContext.personalizedResults.filter(
    result => result.isPersonalized
  );
  expect(personalizedResults.length).to.be.greaterThan(0);
});

Then('I should be able to name and save the search criteria', async function () {
  expect(testContext.savedSearch).to.have.property('id');
  expect(testContext.savedSearch).to.have.property('name', 'My Complex Search');
  expect(testContext.savedSearch).to.have.property('criteria');
});

Then('export results in multiple formats \\(JSON, CSV)', async function () {
  const jsonExport = await marketplaceClient.exportResults(
    testContext.savedSearch.id, 
    'json'
  );
  const csvExport = await marketplaceClient.exportResults(
    testContext.savedSearch.id, 
    'csv'
  );
  
  expect(jsonExport).to.be.a('string');
  expect(csvExport).to.be.a('string');
  expect(() => JSON.parse(jsonExport)).to.not.throw();
});

Then('set up alerts for new KPacks matching my criteria', async function () {
  const alert = await marketplaceClient.createAlert({
    searchId: testContext.savedSearch.id,
    frequency: 'weekly'
  });
  
  expect(alert).to.have.property('id');
  expect(alert).to.have.property('active', true);
});

Then('access saved searches from my profile', async function () {
  const savedSearches = await marketplaceClient.getSavedSearches();
  const foundSearch = savedSearches.find(search => 
    search.id === testContext.savedSearch.id
  );
  
  expect(foundSearch).to.not.be.undefined;
});