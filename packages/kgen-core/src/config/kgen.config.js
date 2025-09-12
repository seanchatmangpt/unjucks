// @ts-check

/**
 * Sample KGEN Configuration
 * 
 * This file demonstrates the complete KGEN configuration system with
 * IDE autocomplete support using the generated JSON schema.
 */

/**
 * @typedef {import('./schema.d.ts').KGenConfig} KGenConfig
 */

/**
 * Helper function for type inference and autocompletion.
 * @param {KGenConfig} config
 * @returns {KGenConfig}
 */
const defineConfig = (config) => config;

export default defineConfig({
  /**
   * $schema provides JSON schema validation and autocompletion in supported editors.
   */
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',

  /**
   * Project-level metadata.
   */
  project: {
    name: 'api-service-knowledge-base',
    version: '1.0.0',
    description: 'Enterprise API service generated from knowledge graphs',
    author: 'KGEN Config System Developer',
    license: 'MIT'
  },

  /**
   * Directory structure for KGEN operations.
   */
  directories: {
    out: './dist/generated',
    state: './.kgen/state',
    cache: './.kgen/cache',
    templates: './templates',
    rules: './rules',
    knowledge: './knowledge',
    temp: './.kgen/temp',
    logs: './.kgen/logs'
  },

  /**
   * Artifact generation configuration.
   */
  generate: {
    defaultTemplate: 'api-service',
    globalVars: {
      copyrightYear: this.getDeterministicDate().getFullYear(),
      companyName: 'ACME Corporation',
      buildId: process.env.BUILD_ID || 'local',
      timestamp: () => this.getDeterministicDate().toISOString()
    },
    attestByDefault: true,
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false
    },
    output: {
      preserveTimestamps: false,
      createDirectories: true,
      fileMode: 0o644,
      dirMode: 0o755
    }
  },

  /**
   * N3.js-based reasoning engine configuration.
   */
  reasoning: {
    enabled: true,
    defaultRules: 'api-governance@1.2.0',
    engine: {
      maxIterations: 1000,
      optimization: 'basic',
      parallel: true,
      memoryLimit: 512
    },
    rules: {
      autoLoad: true,
      loadingStrategy: 'lazy',
      cache: true
    }
  },

  /**
   * Provenance and attestation configuration.
   */
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
      enabled: false, // Enable in production
      algorithm: 'RS256',
      keyPath: null,
      certPath: null
    },
    blockchain: {
      enabled: false,
      network: 'ethereum-testnet',
      contractAddress: null
    }
  },

  /**
   * Impact analysis configuration.
   */
  impact: {
    defaultReportType: 'artifacts',
    depth: {
      maxDepth: 10,
      includeIndirect: true
    },
    ignore: {
      blankNodes: true,
      predicates: [
        'http://purl.org/dc/terms/modified',
        'http://purl.org/dc/terms/created'
      ],
      filePatterns: [
        '**/.DS_Store',
        '**/node_modules/**',
        '**/.git/**'
      ]
    },
    output: {
      format: 'json',
      includeDetails: true,
      groupByType: true
    }
  },

  /**
   * Drift detection configuration.
   */
  drift: {
    onDrift: 'fail',
    exitCode: 3,
    include: [
      'dist/**/*',
      'src/**/*'
    ],
    exclude: [
      '**/.DS_Store',
      '**/node_modules/**',
      '**/.git/**',
      '**/logs/**'
    ],
    detection: {
      checkContent: true,
      checkPermissions: false,
      checkTimestamps: false
    }
  },

  /**
   * Cache configuration.
   */
  cache: {
    enabled: true,
    storage: 'file',
    gc: {
      strategy: 'lru',
      maxAge: '7d',
      maxSize: '1GB',
      interval: '1h'
    },
    policies: {
      graphs: {
        ttl: '1h',
        maxSize: '100MB'
      },
      templates: {
        ttl: '30m',
        maxSize: '50MB'
      },
      rules: {
        ttl: '2h',
        maxSize: '25MB'
      }
    }
  },

  /**
   * Metrics and monitoring configuration.
   */
  metrics: {
    enabled: true,
    format: 'jsonl',
    file: 'logs/kgen-metrics.jsonl',
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
      sampleRate: 1.0,
      thresholds: {
        reasoningTime: 5000,
        renderingTime: 1000,
        totalTime: 10000
      }
    },
    export: {
      enabled: false,
      interval: '1h',
      format: 'prometheus'
    }
  },

  /**
   * Validation configuration.
   */
  validation: {
    enabled: true,
    shacl: {
      enabled: true,
      shapesPath: null,
      allowWarnings: false
    },
    owl: {
      enabled: false,
      reasoner: 'pellet'
    },
    custom: {
      enabled: false,
      rulesPath: null
    }
  },

  /**
   * Security configuration.
   */
  security: {
    sanitize: {
      enabled: true,
      allowedTags: [],
      allowedAttributes: {}
    },
    pathTraversal: {
      enabled: true,
      allowedPaths: [
        './templates',
        './knowledge',
        './rules'
      ]
    },
    limits: {
      maxFileSize: '100MB',
      maxGraphSize: 1000000,
      maxExecutionTime: '5m'
    }
  },

  /**
   * Development and debugging options.
   */
  dev: {
    generateTypes: false,
    debug: false,
    hotReload: false,
    verbose: false,
    profile: false
  },

  /**
   * Environment-specific configurations.
   */
  environments: {
    development: {
      dev: {
        debug: true,
        verbose: true,
        hotReload: true
      },
      cache: {
        enabled: false
      },
      metrics: {
        enabled: true,
        performance: {
          sampleRate: 1.0
        }
      }
    },
    
    production: {
      reasoning: {
        engine: {
          optimization: 'aggressive',
          memoryLimit: 1024
        }
      },
      cache: {
        gc: {
          strategy: 'lru',
          interval: '30m'
        }
      },
      metrics: {
        export: {
          enabled: true,
          interval: '5m'
        }
      },
      provenance: {
        signing: {
          enabled: true,
          keyPath: '/etc/kgen/certs/signing.key',
          certPath: '/etc/kgen/certs/signing.crt'
        }
      }
    },
    
    test: {
      cache: {
        enabled: false
      },
      metrics: {
        enabled: false
      },
      reasoning: {
        engine: {
          parallel: false,
          maxIterations: 100
        }
      }
    }
  },

  /**
   * Plugin system (future expansion).
   */
  plugins: [],
  
  /**
   * Feature flags.
   */
  features: {
    experimental: {
      enabled: false,
      flags: []
    }
  }
});