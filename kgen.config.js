/**
 * KGEN Configuration Example
 * Comprehensive configuration example showing all available options
 */

export default {
  // Directory structure configuration
  directories: {
    out: './dist',              // Output directory for generated artifacts
    state: './.kgen/state',     // State directory for tracking changes
    cache: './.kgen/cache',     // Cache directory for performance
    templates: './templates',   // Template directory
    rules: './rules'            // Rules directory for reasoning
  },

  // Generation settings
  generate: {
    defaultTemplate: 'basic',   // Default template to use
    globalVars: {               // Global variables available to all templates
      author: 'KGEN Team',
      license: 'MIT',
      timestamp: () => this.getDeterministicDate().toISOString()
    },
    attestByDefault: true,      // Generate attestations by default
    cleanOutput: false,         // Clean output directory before generation
    parallel: true,             // Enable parallel generation
    maxConcurrency: 4           // Maximum concurrent operations
  },

  // Reasoning configuration
  reasoning: {
    enabled: true,              // Enable reasoning engine
    defaultRules: [             // Default rules to apply
      'basic',
      'validation',
      'consistency'
    ],
    maxDepth: 10,              // Maximum reasoning depth
    timeout: 30000             // Reasoning timeout in milliseconds
  },

  // Provenance tracking
  provenance: {
    engineId: 'kgen-core',     // Engine identifier for provenance
    include: [                 // What to include in provenance
      'templates',
      'rules',
      'data',
      'config'
    ],
    trackDependencies: true,   // Track file dependencies
    generateAttestation: true, // Generate cryptographic attestations
    signingKey: null          // Optional signing key for attestations
  },

  // Drift detection
  drift: {
    onDrift: 'warn',          // Action on drift: 'warn', 'error', 'ignore'
    exitCode: 1,              // Exit code when drift is detected
    autoFix: false,           // Automatically fix drift
    backup: true              // Backup files before fixing
  },

  // Cache configuration
  cache: {
    enabled: true,            // Enable caching
    ttl: 3600000,            // Time to live in milliseconds (1 hour)
    gcInterval: 300000,      // Garbage collection interval (5 minutes)
    maxSize: '100MB',        // Maximum cache size
    strategy: 'lru'          // Cache strategy: 'lru', 'fifo', 'ttl'
  },

  // Metrics and monitoring
  metrics: {
    enabled: true,           // Enable metrics collection
    logFields: [             // Fields to include in metrics
      'timestamp',
      'operation',
      'duration',
      'success',
      'template',
      'rules'
    ],
    exportFormat: 'json',    // Export format: 'json', 'csv', 'prometheus'
    retention: 30            // Retention period in days
  },

  // Security settings
  security: {
    sandbox: true,           // Enable sandbox mode
    allowedModules: [        // Allowed Node.js modules in templates
      '@kgen/*',
      'lodash',
      'date-fns',
      'uuid'
    ],
    maxMemory: '512MB',      // Maximum memory usage
    maxExecutionTime: 60000  // Maximum execution time in milliseconds
  },

  // Development options
  dev: {
    watch: false,            // Watch mode for development
    hotReload: false,        // Hot reload templates
    debugMode: false,        // Enable debug logging
    verbose: false           // Verbose output
  },

  // Environment-specific configurations
  development: {
    dev: {
      watch: true,
      debugMode: true,
      verbose: true
    },
    cache: {
      enabled: false         // Disable cache in development
    },
    security: {
      sandbox: false         // Disable sandbox in development for easier debugging
    }
  },

  production: {
    generate: {
      parallel: true,
      maxConcurrency: 8      // Higher concurrency in production
    },
    cache: {
      maxSize: '1GB',        // Larger cache in production
      ttl: 7200000          // Longer TTL (2 hours)
    },
    metrics: {
      enabled: true,
      exportFormat: 'prometheus'
    },
    security: {
      sandbox: true,         // Always sandbox in production
      maxMemory: '2GB'       // More memory in production
    }
  },

  test: {
    directories: {
      out: './test-output',
      cache: './test-cache'
    },
    cache: {
      enabled: false         // No cache in tests
    },
    metrics: {
      enabled: false         // No metrics in tests
    },
    dev: {
      debugMode: true
    }
  },

  // Custom extensions (these will pass through validation)
  custom: {
    // Your custom configuration options
    branding: {
      logo: './assets/logo.svg',
      colors: {
        primary: '#007acc',
        secondary: '#28a745'
      }
    },
    integrations: {
      github: {
        enabled: true,
        webhook: process.env.GITHUB_WEBHOOK_URL
      },
      slack: {
        enabled: false,
        channel: '#kgen-notifications'
      }
    }
  }
};