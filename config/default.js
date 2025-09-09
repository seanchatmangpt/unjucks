/**
 * Default Configuration
 * Base configuration that applies to all environments
 */
export default {
  app: {
    name: 'unjucks-enterprise',
    version: '1.0.0',
    description: 'Unjucks Enterprise Configuration Management',
    environment: 'development',
    debug: false,
    timezone: 'UTC',
    locale: 'en-US'
  },

  server: {
    port: 3000,
    host: 'localhost',
    timeout: 30000,
    keepAliveTimeout: 65000,
    maxConnections: 1000,
    gracefulShutdown: {
      enabled: true,
      timeout: 30000
    }
  },

  database: {
    type: 'postgresql',
    ssl: false,
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
      createTimeoutMillis: 30000
    },
    retries: {
      max: 3,
      backoffBase: 300,
      backoffExponent: 2
    }
  },

  security: {
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400
    },
    rateLimit: {
      enabled: false,
      windowMs: 3600000, // 1 hour
      maxRequests: 1000,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      legacyHeaders: false
    },
    headers: {
      hsts: false,
      noSniff: true,
      xframe: true,
      xss: true,
      referrerPolicy: 'no-referrer',
      contentSecurityPolicy: false
    },
    jwt: {
      algorithm: 'HS256',
      expiresIn: '24h'
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32
    }
  },

  cache: {
    type: 'memory',
    ttl: 3600, // 1 hour
    maxSize: 10000
  },

  logging: {
    level: 'info',
    format: 'json',
    enableAudit: true,
    enablePerformance: false,
    enableSensitiveData: false,
    retention: {
      days: 30,
      maxSize: '100MB',
      maxFiles: 10
    },
    transports: ['console']
  },

  monitoring: {
    enabled: true,
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      interval: 30000,
      prometheus: true,
      customMetrics: []
    },
    health: {
      enabled: true,
      endpoint: '/health',
      detailed: false,
      checks: ['database', 'cache', 'memory']
    },
    tracing: {
      enabled: false,
      service: 'unjucks',
      sampleRate: 0.1
    }
  },

  features: {
    enabled: true,
    provider: 'local',
    refreshInterval: 30000,
    flags: {
      // Core feature flags
      'config.hot-reload': false,
      'config.validation': true,
      'config.secrets': true,
      'logging.structured': true,
      'monitoring.detailed': false,
      'security.enhanced': false,
      'cache.distributed': false,
      
      // Unjucks-specific feature flags
      'unjucks.templates.cache': true,
      'unjucks.generators.parallel': false,
      'unjucks.validation.strict': true,
      'unjucks.watch.enabled': false,
      'unjucks.rdf.support': true
    },
    rollouts: {
      'security.enhanced': {
        enabled: false,
        percentage: 0,
        userGroups: ['beta-testers'],
        conditions: []
      },
      'cache.distributed': {
        enabled: false,
        percentage: 10,
        userGroups: ['performance-testers'],
        conditions: [
          {
            attribute: 'environment',
            operator: 'in',
            value: ['staging', 'production']
          }
        ]
      }
    }
  },

  secrets: {
    provider: 'env',
    caching: {
      enabled: true,
      ttl: 900 // 15 minutes
    }
  },

  hotReload: {
    enabled: false,
    watchPaths: ['./config'],
    excludePaths: ['./config/secrets', './config/runtime.json'],
    debounceMs: 1000,
    restartOnChange: ['server', 'database', 'security'],
    safeReload: ['logging', 'monitoring', 'features']
  },

  // Unjucks-specific configuration
  unjucks: {
    templatesDir: './templates',
    outputDir: './output',
    defaultEngine: 'nunjucks',
    engines: {
      nunjucks: {
        autoescape: true,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      },
      ejs: {
        delimiter: '%',
        openDelimiter: '<',
        closeDelimiter: '>',
        cache: true
      }
    },
    generators: {
      parallel: false,
      maxConcurrency: 4,
      timeout: 30000
    },
    validation: {
      enabled: true,
      strict: false,
      schema: './config/schemas/template-schema.json'
    },
    watch: {
      enabled: false,
      patterns: ['**/*.njk', '**/*.ejs', '**/*.yml'],
      ignored: ['node_modules/**', '.git/**']
    },
    rdf: {
      enabled: true,
      formats: ['turtle', 'rdf-xml', 'json-ld'],
      namespaces: {
        'foaf': 'http://xmlns.com/foaf/0.1/',
        'dc': 'http://purl.org/dc/elements/1.1/',
        'unjucks': 'https://unjucks.dev/ns/'
      }
    }
  }
};