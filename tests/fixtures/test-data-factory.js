const crypto = require('crypto');

class TestDataFactory {
  static createValidKPack(options = {}) {
    const defaults = {
      name: 'test-kpack-' + Date.now(),
      metadata: this.getDefaultMetadata(),
      content: this.generateContent(),
      attestations: this.generateAttestations(),
      facets: {},
      pricing: { isFree: true },
      dependencies: {}
    };

    return { ...defaults, ...options };
  }

  static createFreeKPack(name) {
    return this.createValidKPack({
      name: name,
      pricing: {
        isFree: true,
        amount: 0,
        currency: 'USD',
        model: 'free'
      }
    });
  }

  static createPremiumKPack(options = {}) {
    const defaults = {
      pricing: {
        isFree: false,
        amount: 29.99,
        currency: 'USD',
        model: 'one-time'
      }
    };

    return this.createValidKPack({ ...defaults, ...options });
  }

  static createKPackWithFacets(name, facets) {
    return this.createValidKPack({
      name: name,
      facets: facets,
      metadata: {
        ...this.getDefaultMetadata(),
        name: name
      }
    });
  }

  static createKPack(options = {}) {
    return this.createValidKPack(options);
  }

  static getDefaultMetadata() {
    return {
      name: 'default-kpack',
      version: '1.0.0',
      description: 'A test KPack for automated testing',
      author: 'test-author@example.com',
      license: 'MIT',
      tags: ['test', 'automation'],
      category: 'testing',
      difficulty: 'beginner',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }

  static generateContent() {
    return {
      files: [
        {
          path: 'README.md',
          content: '# Test KPack\n\nThis is a test KPack for automated testing.',
          type: 'markdown'
        },
        {
          path: 'main.js',
          content: 'console.log("Hello from test KPack");',
          type: 'javascript'
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'test-kpack',
            version: '1.0.0',
            main: 'main.js'
          }, null, 2),
          type: 'json'
        }
      ],
      templates: [
        {
          name: 'basic-template',
          path: 'templates/basic.njk',
          variables: ['name', 'description']
        }
      ],
      examples: [
        {
          name: 'basic-usage',
          description: 'Basic usage example',
          code: 'const kpack = require("./main.js");\nkpack.run();'
        }
      ]
    };
  }

  static generateAttestations() {
    return {
      integrity: this.generateHash('content-integrity'),
      signature: this.generateSignature(),
      certificateChain: this.generateCertificateChain(),
      timestamp: new Date().toISOString(),
      publisher: 'test-publisher-' + Date.now()
    };
  }

  static generateHash(input) {
    return crypto.createHash('sha256').update(input + Date.now()).digest('hex');
  }

  static generateSignature() {
    return 'sig_' + crypto.randomBytes(32).toString('hex');
  }

  static generateCertificateChain() {
    return [
      {
        issuer: 'Test Root CA',
        subject: 'Test Intermediate CA',
        serialNumber: crypto.randomBytes(16).toString('hex'),
        notBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        issuer: 'Test Intermediate CA',
        subject: 'Test Publisher Certificate',
        serialNumber: crypto.randomBytes(16).toString('hex'),
        notBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  static createTestUser(options = {}) {
    const defaults = {
      id: 'user-' + Date.now(),
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user',
      preferences: {},
      created: new Date().toISOString()
    };

    return { ...defaults, ...options };
  }

  static createEnterpriseUser() {
    return this.createTestUser({
      role: 'enterprise',
      companyName: 'Test Enterprise Corp',
      tier: 'enterprise',
      verified: true
    });
  }

  static getPaymentTestData(method) {
    const paymentData = {
      credit_card: {
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Test User'
      },
      paypal: {
        email: 'test@paypal.com',
        accountId: 'paypal-test-account'
      },
      crypto: {
        currency: 'BTC',
        walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
      },
      bank_transfer: {
        accountNumber: '1234567890',
        routingNumber: '021000021',
        accountType: 'checking'
      }
    };

    return paymentData[method] || {};
  }

  static createSearchResults(query, count = 10) {
    const results = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        id: `result-${i}`,
        name: `${query}-kpack-${i}`,
        description: `A KPack related to ${query} - result ${i}`,
        version: '1.0.' + i,
        author: `author-${i}@example.com`,
        rating: 3.5 + (Math.random() * 1.5),
        downloadCount: Math.floor(Math.random() * 10000),
        relevanceScore: 1.0 - (i * 0.1),
        tags: [query, 'test', `category-${i % 3}`],
        pricing: {
          isFree: i % 3 === 0,
          amount: i % 3 === 0 ? 0 : 10 + (i * 5)
        },
        facets: {
          category: [`category-${i % 3}`],
          technology: [`tech-${i % 2}`],
          difficulty: ['beginner', 'intermediate', 'advanced'][i % 3]
        }
      });
    }

    return {
      results: results,
      totalCount: count,
      query: query,
      searchTime: Math.random() * 100, // milliseconds
      facetCounts: this.generateFacetCounts()
    };
  }

  static generateFacetCounts() {
    return {
      category: {
        'data-science': 45,
        'web-development': 32,
        'machine-learning': 28,
        'devops': 23
      },
      technology: {
        'javascript': 67,
        'python': 54,
        'java': 34,
        'go': 23
      },
      difficulty: {
        'beginner': 78,
        'intermediate': 56,
        'advanced': 34
      }
    };
  }

  static createPersonaTestData() {
    return {
      Developer: {
        categories: ['frameworks', 'testing-tools', 'development-utils', 'api-integrations'],
        complexity: ['intermediate', 'advanced'],
        displayOptions: {
          prominentCodeSamples: true,
          technicalDetails: true,
          architectureDiagrams: true
        }
      },
      'Data Scientist': {
        categories: ['machine-learning', 'data-processing', 'visualization', 'statistical-analysis'],
        complexity: ['intermediate', 'advanced'],
        displayOptions: {
          mathJax: true,
          latexSupport: true,
          datasetCompatibility: true
        }
      },
      'Business Analyst': {
        categories: ['reporting-tools', 'process-automation', 'market-analysis', 'financial-modeling'],
        complexity: ['beginner', 'intermediate'],
        displayOptions: {
          abstractTechnical: true,
          businessLanguage: true,
          roiCalculators: true
        }
      },
      'DevOps Engineer': {
        categories: ['infrastructure', 'monitoring', 'deployment', 'security'],
        complexity: ['intermediate', 'advanced'],
        displayOptions: {
          operationalMetrics: true,
          cloudCompatibility: true,
          scalabilityInfo: true
        }
      }
    };
  }

  static createWorkspaceTestData() {
    return {
      'client-projects': {
        id: 'workspace-client',
        name: 'Client Projects',
        type: 'professional',
        settings: {
          isolationLevel: 'strict',
          defaultVisibility: 'private'
        }
      },
      'personal-tools': {
        id: 'workspace-personal',
        name: 'Personal Tools',
        type: 'personal',
        settings: {
          isolationLevel: 'relaxed',
          defaultVisibility: 'personal'
        }
      },
      'experimental': {
        id: 'workspace-experimental',
        name: 'Experimental',
        type: 'sandbox',
        settings: {
          isolationLevel: 'none',
          defaultVisibility: 'public'
        }
      }
    };
  }

  static createPerformanceTestData() {
    return {
      small: {
        size: 'small',
        approximateFiles: 5,
        approximateSize: 1024 * 10, // 10KB
        expectedInstallTime: 1000 // 1 second
      },
      medium: {
        size: 'medium',
        approximateFiles: 25,
        approximateSize: 1024 * 1024 * 5, // 5MB
        expectedInstallTime: 2000 // 2 seconds
      },
      large: {
        size: 'large',
        approximateFiles: 100,
        approximateSize: 1024 * 1024 * 50, // 50MB
        expectedInstallTime: 5000 // 5 seconds
      }
    };
  }

  static createCryptoPaymentData() {
    return {
      BTC: {
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        exchangeRate: 45000.00,
        confirmationsRequired: 6,
        networkFee: 0.0001
      },
      ETH: {
        address: '0x742C3cF9bC2640d4F6eF4F2A4E4C8B8A65Eb2BaB',
        exchangeRate: 3000.00,
        confirmationsRequired: 12,
        networkFee: 0.01
      },
      LTC: {
        address: 'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL',
        exchangeRate: 150.00,
        confirmationsRequired: 4,
        networkFee: 0.001
      }
    };
  }

  static createAuditTrailData() {
    const events = [];
    const eventTypes = ['purchase', 'refund', 'subscription_created', 'subscription_cancelled', 'payment_failed'];
    
    for (let i = 0; i < 20; i++) {
      events.push({
        id: `event-${i}`,
        type: eventTypes[i % eventTypes.length],
        timestamp: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        userId: 'test-user-123',
        amount: 10 + (i * 5),
        currency: 'USD',
        transactionId: `txn-${i}`,
        metadata: {
          kpackName: `kpack-${i}`,
          paymentMethod: 'credit_card'
        },
        hash: this.generateHash(`event-${i}`),
        previousHash: i > 0 ? this.generateHash(`event-${i-1}`) : null,
        immutable: true
      });
    }

    return events;
  }

  static createFraudDetectionData() {
    return {
      lowRisk: {
        riskScore: 0.2,
        indicators: ['normal_pattern', 'verified_payment_method'],
        requiresVerification: false
      },
      mediumRisk: {
        riskScore: 0.6,
        indicators: ['new_payment_method', 'unusual_time'],
        requiresVerification: true,
        verificationMethods: ['sms', 'email']
      },
      highRisk: {
        riskScore: 0.9,
        indicators: ['multiple_attempts', 'high_value', 'suspicious_location'],
        requiresVerification: true,
        verificationMethods: ['phone_call', 'manual_review']
      }
    };
  }

  static createBenchmarkData() {
    return {
      publishTime: {
        target: 5000, // 5 seconds
        samples: [4200, 3800, 4500, 4100, 3900]
      },
      searchLatency: {
        target: 500, // 500ms
        samples: [450, 380, 420, 390, 460]
      },
      installVerification: {
        target: 2000, // 2 seconds
        samples: [1800, 1900, 1700, 1850, 1750]
      }
    };
  }

  static generateMockRegistryResponses() {
    return {
      healthy: {
        status: 'healthy',
        version: '1.0.0',
        uptime: 99.99,
        lastCheck: new Date().toISOString()
      },
      unavailable: {
        status: 'unavailable',
        error: 'Service temporarily unavailable',
        retryAfter: 300 // seconds
      },
      degraded: {
        status: 'degraded',
        performance: 'slow',
        expectedDelay: 2000 // milliseconds
      }
    };
  }

  static createTestDIDs() {
    return {
      publisher: {
        did: 'did:example:123456789abcdefghi',
        publicKey: this.generateHash('publisher-public-key'),
        privateKey: this.generateHash('publisher-private-key')
      },
      marketplace: {
        did: 'did:example:marketplace123',
        publicKey: this.generateHash('marketplace-public-key'),
        privateKey: this.generateHash('marketplace-private-key')
      },
      user: {
        did: 'did:example:user456',
        publicKey: this.generateHash('user-public-key'),
        privateKey: this.generateHash('user-private-key')
      }
    };
  }

  static createPaymentAdapterStubs() {
    return {
      stripe: {
        name: 'stripe',
        configured: true,
        testMode: true,
        supportedMethods: ['credit_card', 'debit_card'],
        fees: { percentage: 2.9, fixed: 0.30 }
      },
      paypal: {
        name: 'paypal_standard',
        configured: true,
        testMode: true,
        supportedMethods: ['paypal_account'],
        fees: { percentage: 3.5, fixed: 0.49 }
      },
      crypto: {
        name: 'web3_payments',
        configured: true,
        testMode: true,
        supportedMethods: ['bitcoin', 'ethereum', 'litecoin'],
        fees: { percentage: 1.0, fixed: 0 }
      },
      bank: {
        name: 'bank_adapter',
        configured: true,
        testMode: true,
        supportedMethods: ['ach', 'wire_transfer'],
        fees: { percentage: 0.5, fixed: 1.00 }
      }
    };
  }

  static createDataExhaustSample() {
    return {
      anonymized: true,
      aggregationLevel: 'daily',
      data: {
        searchQueries: [
          { query: 'machine learning', count: 245, avgResultsClicked: 3.2 },
          { query: 'data visualization', count: 189, avgResultsClicked: 2.8 },
          { query: 'web development', count: 167, avgResultsClicked: 4.1 }
        ],
        popularKPacks: [
          { name: 'analytics-toolkit', downloads: 89, views: 456 },
          { name: 'ui-components', downloads: 67, views: 234 },
          { name: 'ml-pipeline', downloads: 45, views: 123 }
        ],
        userSegments: {
          developers: { percentage: 45, avgSessionTime: 18.5 },
          datascientists: { percentage: 30, avgSessionTime: 22.1 },
          analysts: { percentage: 25, avgSessionTime: 15.7 }
        }
      },
      generatedAt: new Date().toISOString(),
      dataRetentionDays: 90
    };
  }
}

module.exports = TestDataFactory;