/**
 * KGEN Default Configuration
 * 
 * Production-ready defaults based on the PRD specifications
 * with support for all KGEN operations and enterprise features.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

export const defaultConfig = {
  /**
   * JSON Schema reference for IDE support and validation
   */
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',

  /**
   * Project-level metadata
   */
  project: {
    name: 'kgen-project',
    version: '1.0.0',
    description: 'KGEN Knowledge Compilation Project',
    author: 'KGEN User',
    license: 'MIT'
  },

  /**
   * Directory structure configuration
   */
  directories: {
    // Core output directory for generated artifacts
    out: './dist',
    
    // Stateful files (indexes, logs, cache)
    state: './.kgen/state',
    
    // Content-addressed cache
    cache: './.kgen/cache',
    
    // Nunjucks templates directory
    templates: './templates',
    
    // N3.js rule packs directory
    rules: './rules',
    
    // Knowledge graphs directory
    knowledge: './knowledge',
    
    // Temporary files directory
    temp: './.kgen/temp',
    
    // Logs directory
    logs: './.kgen/logs'
  },

  /**
   * Artifact generation configuration
   */
  generate: {
    // Default template if none specified
    defaultTemplate: null,
    
    // Global variables available in all templates
    globalVars: {
      timestamp: () => this.getDeterministicDate().toISOString(),
      version: '1.0.0'
    },
    
    // Automatic attestation generation
    attestByDefault: true,
    
    // Nunjucks engine options
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false
    },
    
    // File output options
    output: {
      // Preserve file timestamps
      preserveTimestamps: false,
      
      // Create directories if they don't exist
      createDirectories: true,
      
      // File permissions for generated files
      fileMode: 0o644,
      
      // Directory permissions
      dirMode: 0o755
    }
  },

  /**
   * N3.js-based reasoning engine configuration
   */
  reasoning: {
    // Enable reasoning during generation
    enabled: true,
    
    // Default rule pack
    defaultRules: null,
    
    // Reasoning engine options
    engine: {
      // Maximum inference iterations
      maxIterations: 1000,
      
      // Optimization level: 'none', 'basic', 'aggressive'
      optimization: 'basic',
      
      // Enable parallel processing
      parallel: true,
      
      // Memory limit for reasoning (MB)
      memoryLimit: 512
    },
    
    // Rule loading options
    rules: {
      // Automatically load rules from rules directory
      autoLoad: true,
      
      // Rule loading strategy: 'lazy', 'eager'
      loadingStrategy: 'lazy',
      
      // Cache compiled rules
      cache: true
    }
  },

  /**
   * Provenance and attestation configuration
   */
  provenance: {
    // Engine identifier for attestations
    engineId: 'kgen',
    
    // Metadata to include in attestations
    include: {
      timestamp: true,
      engineVersion: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true,
      environment: false,
      system: false
    },
    
    // Cryptographic signing options
    signing: {
      enabled: false,
      algorithm: 'RS256',
      keyPath: null,
      certPath: null
    },
    
    // Blockchain anchoring (experimental)
    blockchain: {
      enabled: false,
      network: 'ethereum-testnet',
      contractAddress: null
    }
  },

  /**
   * Impact analysis configuration
   */
  impact: {
    // Default report type: 'subjects', 'triples', 'artifacts'
    defaultReportType: 'artifacts',
    
    // Analysis depth
    depth: {
      // Maximum graph traversal depth
      maxDepth: 10,
      
      // Include indirect dependencies
      includeIndirect: true
    },
    
    // Items to ignore during impact analysis
    ignore: {
      // Ignore blank node identifier changes
      blankNodes: true,
      
      // Predicates to ignore
      predicates: [
        'http://purl.org/dc/terms/modified',
        'http://purl.org/dc/terms/created'
      ],
      
      // File patterns to ignore
      filePatterns: [
        '**/.DS_Store',
        '**/node_modules/**',
        '**/.git/**'
      ]
    },
    
    // Output formatting
    output: {
      format: 'json',
      includeDetails: true,
      groupByType: true
    }
  },

  /**
   * Drift detection configuration
   */
  drift: {
    // Action on drift detection: 'fail', 'warn', 'fix'
    onDrift: 'fail',
    
    // Exit code when drift detected and onDrift is 'fail'
    exitCode: 3,
    
    // Files to check for drift
    include: [
      'dist/**/*',
      'src/**/*'
    ],
    
    // Files to exclude from drift detection
    exclude: [
      '**/.DS_Store',
      '**/node_modules/**',
      '**/.git/**',
      '**/logs/**'
    ],
    
    // Drift detection options
    detection: {
      // Check file content hashes
      checkContent: true,
      
      // Check file permissions
      checkPermissions: false,
      
      // Check file timestamps
      checkTimestamps: false
    }
  },

  /**
   * Cache configuration
   */
  cache: {
    // Enable caching
    enabled: true,
    
    // Cache storage type: 'file', 'memory', 'redis'
    storage: 'file',
    
    // Garbage collection settings
    gc: {
      // GC strategy: 'lru', 'fifo', 'lfu'
      strategy: 'lru',
      
      // Maximum age for cached items
      maxAge: '7d',
      
      // Maximum cache size
      maxSize: '1GB',
      
      // GC interval
      interval: '1h'
    },
    
    // Cache policies by type
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
   * Metrics and monitoring configuration
   */
  metrics: {
    // Enable metrics collection
    enabled: true,
    
    // Metrics storage format: 'jsonl', 'csv', 'prometheus'
    format: 'jsonl',
    
    // Metrics file location
    file: 'logs/metrics.jsonl',
    
    // Fields to log
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
    
    // Performance monitoring
    performance: {
      // Enable performance tracking
      enabled: true,
      
      // Sample rate (0-1)
      sampleRate: 1.0,
      
      // Performance thresholds
      thresholds: {
        reasoningTime: 5000, // ms
        renderingTime: 1000,  // ms
        totalTime: 10000     // ms
      }
    },
    
    // Export options
    export: {
      // Auto-export metrics
      enabled: false,
      
      // Export interval
      interval: '1h',
      
      // Export format
      format: 'prometheus'
    }
  },

  /**
   * Validation configuration
   */
  validation: {
    // Enable graph validation
    enabled: true,
    
    // SHACL validation
    shacl: {
      enabled: true,
      shapesPath: null,
      allowWarnings: false
    },
    
    // OWL validation
    owl: {
      enabled: false,
      reasoner: 'pellet'
    },
    
    // Custom validation rules
    custom: {
      enabled: false,
      rulesPath: null
    }
  },

  /**
   * Security configuration
   */
  security: {
    // Input sanitization
    sanitize: {
      enabled: true,
      allowedTags: [],
      allowedAttributes: {}
    },
    
    // Path traversal protection
    pathTraversal: {
      enabled: true,
      allowedPaths: ['./templates', './knowledge', './rules']
    },
    
    // Resource limits
    limits: {
      maxFileSize: '100MB',
      maxGraphSize: 1000000, // triples
      maxExecutionTime: '5m'
    }
  },

  /**
   * Development and debugging options
   */
  dev: {
    // Generate TypeScript definitions
    generateTypes: false,
    
    // Enable debug logging
    debug: false,
    
    // Hot reload templates
    hotReload: false,
    
    // Verbose output
    verbose: false,
    
    // Profile performance
    profile: false
  },

  /**
   * Environment-specific configurations
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
      }
    },
    
    production: {
      reasoning: {
        engine: {
          optimization: 'aggressive'
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
          enabled: true
        }
      }
    },
    
    test: {
      cache: {
        enabled: false
      },
      metrics: {
        enabled: false
      }
    }
  },

  /**
   * Plugin system (future expansion)
   */
  plugins: [],
  
  /**
   * Feature flags
   */
  features: {
    experimental: {
      enabled: false,
      flags: []
    }
  }
};

export default defaultConfig;
