/**
 * KGEN Configuration Examples
 * 
 * Complete example configurations for different use cases
 * and environments, demonstrating all KGEN features.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

/**
 * Minimal development configuration
 */
export const minimalConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'my-kgen-project',
    version: '1.0.0'
  },
  
  // Use default directories and settings
  dev: {
    debug: true,
    verbose: true
  }
};

/**
 * Complete development configuration
 */
export const developmentConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'kgen-development-project',
    version: '1.0.0',
    description: 'Development environment for KGEN knowledge compilation',
    author: 'Development Team',
    license: 'MIT'
  },
  
  directories: {
    out: './dev-output',
    state: './.kgen-dev/state',
    cache: './.kgen-dev/cache',
    templates: './templates',
    rules: './rules',
    knowledge: './knowledge',
    temp: './.kgen-dev/temp',
    logs: './.kgen-dev/logs'
  },
  
  generate: {
    defaultTemplate: 'development-api',
    globalVars: {
      environment: 'development',
      debugMode: true,
      timestamp: () => this.getDeterministicDate().toISOString(),
      buildNumber: process.env.BUILD_NUMBER || 'local'
    },
    attestByDefault: true,
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: true // Strict in development
    }
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'development-rules',
    engine: {
      maxIterations: 500, // Lower for faster development
      optimization: 'basic',
      parallel: true,
      memoryLimit: 256
    },
    rules: {
      autoLoad: true,
      loadingStrategy: 'eager', // Load all rules upfront
      cache: false // Disable caching for rule changes
    }
  },
  
  provenance: {
    engineId: 'kgen-dev',
    include: {
      timestamp: true,
      engineVersion: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true,
      environment: true,
      system: true
    },
    signing: {
      enabled: false // No signing in development
    }
  },
  
  cache: {
    enabled: false, // Disable for fresh builds
    storage: 'memory'
  },
  
  metrics: {
    enabled: true,
    format: 'jsonl',
    file: 'logs/dev-metrics.jsonl',
    performance: {
      enabled: true,
      sampleRate: 1.0,
      thresholds: {
        reasoningTime: 2000, // Shorter thresholds for development
        renderingTime: 500,
        totalTime: 3000
      }
    }
  },
  
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      allowWarnings: true // Allow warnings in development
    }
  },
  
  dev: {
    generateTypes: true,
    debug: true,
    hotReload: true,
    verbose: true,
    profile: true
  }
};

/**
 * Production configuration
 */
export const productionConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'kgen-production-service',
    version: '2.1.0',
    description: 'Production knowledge compilation service',
    author: 'Production Team',
    license: 'Proprietary'
  },
  
  directories: {
    out: '/var/kgen/output',
    state: '/var/kgen/state',
    cache: '/var/kgen/cache',
    templates: '/etc/kgen/templates',
    rules: '/etc/kgen/rules',
    knowledge: '/var/kgen/knowledge',
    temp: '/tmp/kgen',
    logs: '/var/log/kgen'
  },
  
  generate: {
    defaultTemplate: 'production-api',
    globalVars: {
      environment: 'production',
      companyName: 'ACME Corporation',
      copyrightYear: this.getDeterministicDate().getFullYear(),
      buildId: process.env.BUILD_ID,
      deploymentId: process.env.DEPLOYMENT_ID
    },
    attestByDefault: true,
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false
    }
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'enterprise-governance@2.1.0',
    engine: {
      maxIterations: 2000,
      optimization: 'aggressive',
      parallel: true,
      memoryLimit: 1024
    },
    rules: {
      autoLoad: true,
      loadingStrategy: 'lazy',
      cache: true
    }
  },
  
  provenance: {
    engineId: 'kgen-enterprise-compiler',
    include: {
      timestamp: true,
      engineVersion: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true,
      environment: false,
      system: false
    },
    signing: {
      enabled: true,
      algorithm: 'RS256',
      keyPath: '/etc/kgen/certs/signing.key',
      certPath: '/etc/kgen/certs/signing.crt'
    },
    blockchain: {
      enabled: true,
      network: 'ethereum-mainnet',
      contractAddress: process.env.KGEN_CONTRACT_ADDRESS
    }
  },
  
  impact: {
    defaultReportType: 'artifacts',
    depth: {
      maxDepth: 20,
      includeIndirect: true
    },
    ignore: {
      blankNodes: true,
      predicates: [
        'http://purl.org/dc/terms/modified',
        'http://purl.org/dc/terms/created'
      ]
    }
  },
  
  drift: {
    onDrift: 'fail',
    exitCode: 3,
    include: [
      '/var/kgen/output/**/*'
    ],
    exclude: [
      '/var/log/**/*',
      '/tmp/**/*'
    ]
  },
  
  cache: {
    enabled: true,
    storage: 'file',
    gc: {
      strategy: 'lru',
      maxAge: '30d',
      maxSize: '10GB',
      interval: '1h'
    },
    policies: {
      graphs: {
        ttl: '24h',
        maxSize: '1GB'
      },
      templates: {
        ttl: '6h',
        maxSize: '500MB'
      },
      rules: {
        ttl: '12h',
        maxSize: '100MB'
      }
    }
  },
  
  metrics: {
    enabled: true,
    format: 'prometheus',
    file: '/var/log/kgen/metrics.prom',
    logFields: [
      'timestamp',
      'command',
      'graphHash',
      'template',
      'filesGenerated',
      'triplesIn',
      'triplesOut',
      'reasoningTime',
      'renderingTime',
      'totalTime',
      'cacheHit',
      'memoryUsage',
      'driftDetected'
    ],
    performance: {
      enabled: true,
      sampleRate: 0.1, // Sample 10% for performance
      thresholds: {
        reasoningTime: 10000,
        renderingTime: 2000,
        totalTime: 15000
      }
    },
    export: {
      enabled: true,
      interval: '5m',
      format: 'prometheus'
    }
  },
  
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      shapesPath: '/etc/kgen/shapes',
      allowWarnings: false
    },
    owl: {
      enabled: true,
      reasoner: 'pellet'
    }
  },
  
  security: {
    sanitize: {
      enabled: true,
      allowedTags: [],
      allowedAttributes: {}
    },
    pathTraversal: {
      enabled: true,
      allowedPaths: [
        '/etc/kgen/templates',
        '/var/kgen/knowledge',
        '/etc/kgen/rules'
      ]
    },
    limits: {
      maxFileSize: '500MB',
      maxGraphSize: 10000000,
      maxExecutionTime: '30m'
    }
  },
  
  dev: {
    generateTypes: false,
    debug: false,
    hotReload: false,
    verbose: false,
    profile: false
  }
};

/**
 * Enterprise configuration with full compliance
 */
export const enterpriseConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'enterprise-knowledge-platform',
    version: '3.0.0',
    description: 'Enterprise-grade knowledge compilation with full compliance',
    author: 'Enterprise Architecture Team',
    license: 'Commercial'
  },
  
  directories: {
    out: '/enterprise/kgen/artifacts',
    state: '/enterprise/kgen/state',
    cache: '/enterprise/kgen/cache',
    templates: '/enterprise/kgen/templates',
    rules: '/enterprise/kgen/rules',
    knowledge: '/enterprise/kgen/knowledge',
    temp: '/enterprise/kgen/temp',
    logs: '/enterprise/kgen/logs'
  },
  
  generate: {
    defaultTemplate: 'enterprise-service',
    globalVars: {
      environment: 'enterprise',
      companyName: 'Global Enterprise Corp',
      complianceFramework: 'SOX-GDPR-HIPAA',
      securityClassification: 'CONFIDENTIAL',
      auditTrail: true
    },
    attestByDefault: true
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'enterprise-compliance@3.0.0',
    engine: {
      maxIterations: 5000,
      optimization: 'aggressive',
      parallel: true,
      memoryLimit: 2048
    }
  },
  
  provenance: {
    engineId: 'kgen-enterprise-v3',
    include: {
      timestamp: true,
      engineVersion: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true,
      environment: true,
      system: true
    },
    signing: {
      enabled: true,
      algorithm: 'PS256', // Stronger algorithm
      keyPath: '/enterprise/certs/kgen-signing.key',
      certPath: '/enterprise/certs/kgen-signing.crt'
    },
    blockchain: {
      enabled: true,
      network: 'ethereum-mainnet',
      contractAddress: process.env.ENTERPRISE_CONTRACT_ADDRESS
    }
  },
  
  impact: {
    defaultReportType: 'artifacts',
    depth: {
      maxDepth: 50,
      includeIndirect: true
    },
    ignore: {
      blankNodes: true,
      predicates: [],
      filePatterns: []
    },
    output: {
      format: 'json',
      includeDetails: true,
      groupByType: true
    }
  },
  
  drift: {
    onDrift: 'fail',
    exitCode: 1, // Hard fail for compliance
    detection: {
      checkContent: true,
      checkPermissions: true,
      checkTimestamps: true
    }
  },
  
  cache: {
    enabled: true,
    storage: 'redis', // Distributed caching
    gc: {
      strategy: 'lru',
      maxAge: '7d',
      maxSize: '50GB',
      interval: '30m'
    }
  },
  
  metrics: {
    enabled: true,
    format: 'prometheus',
    performance: {
      enabled: true,
      sampleRate: 1.0, // Full sampling for compliance
      thresholds: {
        reasoningTime: 60000,
        renderingTime: 10000,
        totalTime: 120000
      }
    },
    export: {
      enabled: true,
      interval: '1m',
      format: 'prometheus'
    }
  },
  
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      shapesPath: '/enterprise/kgen/compliance/shapes',
      allowWarnings: false
    },
    owl: {
      enabled: true,
      reasoner: 'hermit'
    },
    custom: {
      enabled: true,
      rulesPath: '/enterprise/kgen/compliance/validation'
    }
  },
  
  security: {
    sanitize: {
      enabled: true,
      allowedTags: [],
      allowedAttributes: {}
    },
    pathTraversal: {
      enabled: true,
      allowedPaths: [
        '/enterprise/kgen/templates',
        '/enterprise/kgen/knowledge',
        '/enterprise/kgen/rules'
      ]
    },
    limits: {
      maxFileSize: '1GB',
      maxGraphSize: 50000000,
      maxExecutionTime: '2h'
    }
  },
  
  features: {
    experimental: {
      enabled: false, // No experimental features in enterprise
      flags: []
    }
  }
};

/**
 * Testing configuration
 */
export const testConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'kgen-test-suite',
    version: '1.0.0',
    description: 'Test environment configuration'
  },
  
  directories: {
    out: './test-output',
    state: './.kgen-test/state',
    cache: './.kgen-test/cache',
    templates: './test/fixtures/templates',
    rules: './test/fixtures/rules',
    knowledge: './test/fixtures/knowledge'
  },
  
  generate: {
    defaultTemplate: 'test-template',
    globalVars: {
      environment: 'test',
      testRun: true
    },
    attestByDefault: false // Skip attestation in tests
  },
  
  reasoning: {
    enabled: true,
    engine: {
      maxIterations: 100, // Fast tests
      optimization: 'none',
      parallel: false, // Deterministic tests
      memoryLimit: 128
    },
    rules: {
      cache: false // Fresh rules for each test
    }
  },
  
  cache: {
    enabled: false // No caching in tests
  },
  
  metrics: {
    enabled: false // Quiet tests
  },
  
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      allowWarnings: true
    }
  },
  
  dev: {
    debug: false,
    verbose: false
  }
};

/**
 * API service configuration example
 */
export const apiServiceConfig = {
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'api-service-knowledge-base',
    version: '1.0.0',
    description: 'Knowledge-driven API service generation'
  },
  
  generate: {
    defaultTemplate: 'rest-api-service',
    globalVars: {
      apiVersion: 'v1',
      baseUrl: '/api/v1',
      authRequired: true,
      rateLimit: 1000,
      corsEnabled: true
    }
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'api-governance@1.2.0',
    engine: {
      optimization: 'basic'
    }
  },
  
  provenance: {
    include: {
      timestamp: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true
    }
  },
  
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      shapesPath: './schemas/api-shapes.ttl'
    }
  }
};

export const exampleConfigs = {
  minimal: minimalConfig,
  development: developmentConfig,
  production: productionConfig,
  enterprise: enterpriseConfig,
  test: testConfig,
  apiService: apiServiceConfig
};

export default exampleConfigs;
