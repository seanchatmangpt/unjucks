const { performance } = require('perf_hooks');
const { expect } = require('chai');
const MarketplaceClient = require('../utils/marketplace-client');
const PaymentAdapter = require('../utils/payment-adapter');
const PersonaManager = require('../utils/persona-manager');
const TestDataFactory = require('../fixtures/test-data-factory');

describe('Marketplace Performance Benchmarks', function() {
  let marketplaceClient;
  let paymentAdapter;
  let personaManager;
  
  // Extended timeout for performance tests
  this.timeout(30000);
  
  before(async function() {
    marketplaceClient = new MarketplaceClient();
    paymentAdapter = new PaymentAdapter();
    personaManager = new PersonaManager();
    
    // Seed with test data
    await seedTestData();
  });
  
  async function seedTestData() {
    // Create test KPacks for performance testing
    const kpacks = [
      TestDataFactory.createKPackWithFacets('performance-test-1', {
        category: ['data-science'],
        technology: ['python'],
        difficulty: ['beginner']
      }),
      TestDataFactory.createKPackWithFacets('performance-test-2', {
        category: ['web-development'],
        technology: ['javascript'],
        difficulty: ['intermediate']
      }),
      TestDataFactory.createKPackWithFacets('performance-test-3', {
        category: ['machine-learning'],
        technology: ['python'],
        difficulty: ['advanced']
      })
    ];
    
    for (const kpack of kpacks) {
      await marketplaceClient.publish(kpack);
    }
  }
  
  describe('Publishing Performance', function() {
    it('should publish KPack within 5 seconds', async function() {
      const kpack = TestDataFactory.createValidKPack({
        name: 'benchmark-publish-test'
      });
      
      const startTime = performance.now();
      const result = await marketplaceClient.publish(kpack);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(5);
      
      console.log(`Publishing took ${duration.toFixed(2)} seconds`);
    });
    
    it('should handle concurrent publications efficiently', async function() {
      const kpacks = [];
      for (let i = 0; i < 10; i++) {
        kpacks.push(TestDataFactory.createValidKPack({
          name: `concurrent-publish-${i}`
        }));
      }
      
      const startTime = performance.now();
      const publishPromises = kpacks.map(kpack => marketplaceClient.publish(kpack));
      const results = await Promise.all(publishPromises);
      const totalDuration = (performance.now() - startTime) / 1000;
      
      expect(results).to.have.length(10);
      results.forEach(result => {
        expect(result.success).to.be.true;
      });
      
      // Should be faster than sequential publishing
      expect(totalDuration).to.be.lessThan(15); // Less than 1.5s per KPack on average
      
      console.log(`Concurrent publishing of 10 KPacks took ${totalDuration.toFixed(2)} seconds`);
    });
    
    it('should validate large KPack metadata efficiently', async function() {
      const largeKPack = TestDataFactory.createValidKPack({
        name: 'large-metadata-test',
        metadata: {
          ...TestDataFactory.getDefaultMetadata(),
          description: 'A'.repeat(10000), // 10KB description
          tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`), // 100 tags
          documentation: 'B'.repeat(50000) // 50KB documentation
        }
      });
      
      const startTime = performance.now();
      const result = await marketplaceClient.publish(largeKPack);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(8); // Allow extra time for large metadata
      
      console.log(`Large metadata validation took ${duration.toFixed(2)} seconds`);
    });
  });
  
  describe('Search Performance', function() {
    it('should return search results within 500ms', async function() {
      const startTime = performance.now();
      const results = await marketplaceClient.search('test');
      const duration = performance.now() - startTime;
      
      expect(results.results).to.be.an('array');
      expect(duration).to.be.lessThan(500);
      
      console.log(`Search took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should handle complex faceted search efficiently', async function() {
      const searchOptions = {
        query: 'machine learning',
        filters: {
          category: ['data-science', 'machine-learning'],
          technology: ['python'],
          difficulty: ['intermediate', 'advanced']
        }
      };
      
      const startTime = performance.now();
      const results = await marketplaceClient.searchWithFilters(searchOptions);
      const duration = performance.now() - startTime;
      
      expect(results.results).to.be.an('array');
      expect(duration).to.be.lessThan(500);
      
      console.log(`Faceted search took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should handle autocomplete within 200ms', async function() {
      const startTime = performance.now();
      const suggestions = await marketplaceClient.getAutocomplete('mach');
      const duration = performance.now() - startTime;
      
      expect(suggestions).to.be.an('array');
      expect(duration).to.be.lessThan(200);
      
      console.log(`Autocomplete took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should scale search performance with concurrent users', async function() {
      const concurrentSearches = 50;
      const searchTerms = ['data', 'web', 'machine', 'development', 'analysis'];
      
      const searchPromises = [];
      for (let i = 0; i < concurrentSearches; i++) {
        const term = searchTerms[i % searchTerms.length];
        searchPromises.push(marketplaceClient.search(term));
      }
      
      const startTime = performance.now();
      const results = await Promise.all(searchPromises);
      const totalDuration = performance.now() - startTime;
      const avgDuration = totalDuration / concurrentSearches;
      
      expect(results).to.have.length(concurrentSearches);
      expect(avgDuration).to.be.lessThan(800); // Allow for some degradation under load
      
      console.log(`${concurrentSearches} concurrent searches averaged ${avgDuration.toFixed(2)}ms each`);
    });
  });
  
  describe('Installation Performance', function() {
    it('should install small KPack under 1 second', async function() {
      const smallKPack = TestDataFactory.createValidKPack({
        name: 'small-install-test',
        size: 'small'
      });
      await marketplaceClient.publish(smallKPack);
      
      const startTime = performance.now();
      const result = await marketplaceClient.install(smallKPack);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(1);
      
      console.log(`Small KPack installation took ${duration.toFixed(2)} seconds`);
    });
    
    it('should install medium KPack under 2 seconds', async function() {
      const mediumKPack = TestDataFactory.createValidKPack({
        name: 'medium-install-test',
        size: 'medium'
      });
      await marketplaceClient.publish(mediumKPack);
      
      const startTime = performance.now();
      const result = await marketplaceClient.install(mediumKPack);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(2);
      
      console.log(`Medium KPack installation took ${duration.toFixed(2)} seconds`);
    });
    
    it('should install large KPack under 5 seconds', async function() {
      const largeKPack = TestDataFactory.createValidKPack({
        name: 'large-install-test',
        size: 'large'
      });
      await marketplaceClient.publish(largeKPack);
      
      const startTime = performance.now();
      const result = await marketplaceClient.install(largeKPack);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(5);
      
      console.log(`Large KPack installation took ${duration.toFixed(2)} seconds`);
    });
    
    it('should verify cryptographic signatures within 2 seconds', async function() {
      const kpack = TestDataFactory.createValidKPack({
        name: 'crypto-verification-test'
      });
      await marketplaceClient.publish(kpack);
      
      const startTime = performance.now();
      const result = await marketplaceClient.install(kpack);
      const verificationDuration = result.verification.duration;
      
      expect(result.verification.passed).to.be.true;
      expect(verificationDuration).to.be.lessThan(2000); // 2 seconds
      
      console.log(`Cryptographic verification took ${verificationDuration.toFixed(2)} milliseconds`);
    });
    
    it('should handle dependency resolution efficiently', async function() {
      const kpackWithDeps = TestDataFactory.createValidKPack({
        name: 'dependency-test',
        dependencies: {
          'dep-1': '^1.0.0',
          'dep-2': '~2.1.0',
          'dep-3': '*'
        }
      });
      
      // Publish dependencies first
      for (let i = 1; i <= 3; i++) {
        const dep = TestDataFactory.createValidKPack({
          name: `dep-${i}`,
          metadata: { ...TestDataFactory.getDefaultMetadata(), version: `${i}.0.0` }
        });
        await marketplaceClient.publish(dep);
      }
      
      await marketplaceClient.publish(kpackWithDeps);
      
      const startTime = performance.now();
      const result = await marketplaceClient.installWithDependencies(kpackWithDeps);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(result.dependencies.resolved).to.be.true;
      expect(duration).to.be.lessThan(10); // Allow time for multiple installations
      
      console.log(`Dependency resolution and installation took ${duration.toFixed(2)} seconds`);
    });
  });
  
  describe('Payment Performance', function() {
    it('should process payment within 3 seconds', async function() {
      const kpack = TestDataFactory.createPremiumKPack({
        pricing: { amount: 29.99, currency: 'USD' }
      });
      const paymentInfo = {
        method: 'credit_card',
        provider: 'stripe',
        details: TestDataFactory.getPaymentTestData('credit_card')
      };
      
      const startTime = performance.now();
      const result = await paymentAdapter.processPayment(kpack.pricing.amount, paymentInfo);
      const duration = (performance.now() - startTime) / 1000;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(3);
      
      console.log(`Payment processing took ${duration.toFixed(2)} seconds`);
    });
    
    it('should handle fraud detection quickly', async function() {
      const suspiciousActivity = {
        multiple_attempts: '10_in_1min',
        high_value_purchase: '$1000+',
        new_payment_method: 'true'
      };
      const paymentInfo = {
        method: 'credit_card',
        provider: 'stripe'
      };
      
      const startTime = performance.now();
      const result = await paymentAdapter.checkForFraud(suspiciousActivity, paymentInfo);
      const duration = performance.now() - startTime;
      
      expect(result).to.have.property('riskScore');
      expect(duration).to.be.lessThan(500); // Should be very fast
      
      console.log(`Fraud detection took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should calculate tax efficiently', async function() {
      const purchase = {
        amount: 100,
        currency: 'USD',
        billingAddress: {
          country: 'US',
          state: 'CA',
          city: 'San Francisco'
        }
      };
      
      const startTime = performance.now();
      const result = await paymentAdapter.calculateTax(purchase);
      const duration = performance.now() - startTime;
      
      expect(result).to.have.property('taxAmount');
      expect(duration).to.be.lessThan(100); // Should be very fast
      
      console.log(`Tax calculation took ${duration.toFixed(2)} milliseconds`);
    });
  });
  
  describe('Persona Performance', function() {
    it('should switch personas within 500ms', async function() {
      await personaManager.activatePersona('Developer');
      
      const startTime = performance.now();
      const result = await personaManager.switchPersona('Data Scientist');
      const duration = performance.now() - startTime;
      
      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(500);
      
      console.log(`Persona switching took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should generate personalized content quickly', async function() {
      await personaManager.activatePersona('Business Analyst');
      
      const startTime = performance.now();
      const content = await marketplaceClient.getPersonalizedHomepage('Business Analyst', []);
      const duration = performance.now() - startTime;
      
      expect(content).to.have.property('recommendations');
      expect(duration).to.be.lessThan(800);
      
      console.log(`Personalized content generation took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should evaluate KPack relevance efficiently', async function() {
      const kpack = TestDataFactory.createKPackWithFacets('relevance-test', {
        category: ['machine-learning'],
        technology: ['python'],
        difficulty: ['advanced']
      });
      
      const startTime = performance.now();
      const evaluation = await personaManager.evaluateForPersonas(kpack);
      const duration = performance.now() - startTime;
      
      expect(evaluation).to.have.property('evaluation');
      expect(duration).to.be.lessThan(200);
      
      console.log(`Persona relevance evaluation took ${duration.toFixed(2)} milliseconds`);
    });
  });
  
  describe('Data Anonymization Performance', function() {
    it('should anonymize user data quickly', async function() {
      const rawData = {
        userInteractions: Array.from({ length: 1000 }, (_, i) => ({
          userId: `user-${i}`,
          action: 'search',
          query: `test query ${i}`,
          timestamp: new Date().toISOString()
        }))
      };
      
      const startTime = performance.now();
      const anonymizedData = anonymizeUserData(rawData);
      const duration = performance.now() - startTime;
      
      expect(anonymizedData).to.have.property('aggregated');
      expect(duration).to.be.lessThan(100);
      
      console.log(`Data anonymization took ${duration.toFixed(2)} milliseconds`);
    });
    
    it('should generate aggregated insights efficiently', async function() {
      const largeDataset = TestDataFactory.createDataExhaustSample();
      
      // Simulate larger dataset
      for (let i = 0; i < 1000; i++) {
        largeDataset.data.searchQueries.push({
          query: `query-${i}`,
          count: Math.floor(Math.random() * 100),
          avgResultsClicked: Math.random() * 5
        });
      }
      
      const startTime = performance.now();
      const insights = generateAggregatedInsights(largeDataset);
      const duration = performance.now() - startTime;
      
      expect(insights).to.have.property('trends');
      expect(duration).to.be.lessThan(500);
      
      console.log(`Aggregated insights generation took ${duration.toFixed(2)} milliseconds`);
    });
  });
  
  describe('End-to-End Performance', function() {
    it('should complete full KPack lifecycle efficiently', async function() {
      const startTime = performance.now();
      
      // 1. Create and publish KPack
      const kpack = TestDataFactory.createValidKPack({
        name: 'e2e-lifecycle-test'
      });
      const publishResult = await marketplaceClient.publish(kpack);
      expect(publishResult.success).to.be.true;
      
      // 2. Search for KPack
      const searchResults = await marketplaceClient.search('e2e-lifecycle-test');
      expect(searchResults.results.length).to.be.greaterThan(0);
      
      // 3. Install KPack
      const installResult = await marketplaceClient.install(kpack);
      expect(installResult.success).to.be.true;
      
      // 4. Verify installation
      const isInstalled = await marketplaceClient.isInstalled(kpack.name);
      expect(isInstalled).to.be.true;
      
      const totalDuration = (performance.now() - startTime) / 1000;
      expect(totalDuration).to.be.lessThan(15); // Complete lifecycle under 15 seconds
      
      console.log(`Complete KPack lifecycle took ${totalDuration.toFixed(2)} seconds`);
    });
  });
  
  describe('Load Testing', function() {
    it('should handle high concurrent load', async function() {
      const concurrentOperations = 100;
      const operations = [];
      
      // Mix of different operations
      for (let i = 0; i < concurrentOperations; i++) {
        const operationType = i % 4;
        
        switch (operationType) {
          case 0: // Search
            operations.push(marketplaceClient.search(`test-${i}`));
            break;
          case 1: // Publish
            const kpack = TestDataFactory.createValidKPack({ name: `load-test-${i}` });
            operations.push(marketplaceClient.publish(kpack));
            break;
          case 2: // Persona switch
            const personas = ['Developer', 'Data Scientist', 'Business Analyst'];
            operations.push(personaManager.switchPersona(personas[i % 3]));
            break;
          case 3: // Payment processing
            const paymentInfo = { method: 'credit_card', provider: 'stripe' };
            operations.push(paymentAdapter.processPayment(10, paymentInfo));
            break;
        }
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(operations);
      const duration = (performance.now() - startTime) / 1000;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successful / concurrentOperations;
      
      expect(successRate).to.be.greaterThan(0.95); // 95% success rate
      expect(duration).to.be.lessThan(30); // Complete within 30 seconds
      
      console.log(`Load test: ${successful}/${concurrentOperations} operations succeeded in ${duration.toFixed(2)} seconds`);
      console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);
    });
  });
});

// Helper functions for data processing
function anonymizeUserData(rawData) {
  const startTime = performance.now();
  
  // Mock anonymization process
  const anonymized = {
    aggregated: true,
    totalInteractions: rawData.userInteractions.length,
    queryFrequency: {},
    temporalDistribution: {},
    processingTime: performance.now() - startTime
  };
  
  // Aggregate data without personal identifiers
  rawData.userInteractions.forEach(interaction => {
    anonymized.queryFrequency[interaction.query] = 
      (anonymized.queryFrequency[interaction.query] || 0) + 1;
  });
  
  return anonymized;
}

function generateAggregatedInsights(dataset) {
  const startTime = performance.now();
  
  // Mock insight generation
  const insights = {
    trends: {
      popularQueries: dataset.data.searchQueries
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      growthRate: Math.random() * 0.3 + 0.1,
      seasonality: 'increasing'
    },
    userBehavior: {
      avgSessionTime: 15.5,
      bounceRate: 0.25,
      conversionRate: 0.08
    },
    performance: {
      searchLatency: 'decreasing',
      systemLoad: 'stable',
      errorRate: 0.001
    },
    processingTime: performance.now() - startTime
  };
  
  return insights;
}