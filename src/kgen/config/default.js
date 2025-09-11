/**
 * KGEN Default Configuration
 * Production-ready configuration with security, performance, and monitoring settings
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper to load JSON files safely
function loadJSON(filePath, defaultValue = {}) {
  try {
    return JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  } catch {
    return defaultValue;
  }
}

export const config = {
  // Environment settings
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '2.0.8',
  
  // API Server Configuration
  api: {
    port: parseInt(process.env.KGEN_PORT || '3000', 10),
    host: process.env.KGEN_HOST || '0.0.0.0',
    baseUrl: process.env.KGEN_BASE_URL || '',
    
    // Request handling
    requestTimeout: parseInt(process.env.KGEN_REQUEST_TIMEOUT || '30000', 10),
    maxRequestSize: process.env.KGEN_MAX_REQUEST_SIZE || '50mb',
    
    // Rate limiting
    rateLimit: {
      windowMs: parseInt(process.env.KGEN_RATE_WINDOW || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.KGEN_RATE_MAX || '100', 10),
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    
    // Slow down configuration
    slowDown: {
      windowMs: parseInt(process.env.KGEN_SLOWDOWN_WINDOW || '900000', 10),
      delayAfter: parseInt(process.env.KGEN_SLOWDOWN_DELAY_AFTER || '50', 10),
      maxDelayMs: parseInt(process.env.KGEN_SLOWDOWN_MAX_DELAY || '5000', 10)
    },
    
    // CORS settings
    cors: {
      origin: process.env.KGEN_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: process.env.KGEN_CORS_CREDENTIALS === 'true',
      optionsSuccessStatus: 200
    },
    
    // Swagger/OpenAPI
    swagger: {
      enabled: process.env.KGEN_SWAGGER_ENABLED !== 'false',
      path: '/api-docs',
      title: 'KGEN Knowledge Graph API',
      description: 'RESTful API for RDF/Knowledge Graph operations',
      version: process.env.npm_package_version || '2.0.8'
    }
  },

  // Database Configuration
  database: {
    // PostgreSQL (primary)
    postgres: {
      host: process.env.KGEN_PG_HOST || 'localhost',
      port: parseInt(process.env.KGEN_PG_PORT || '5432', 10),
      database: process.env.KGEN_PG_DATABASE || 'kgen',
      username: process.env.KGEN_PG_USERNAME || 'kgen',
      password: process.env.KGEN_PG_PASSWORD || '',
      
      // Connection pool
      pool: {
        min: parseInt(process.env.KGEN_PG_POOL_MIN || '2', 10),
        max: parseInt(process.env.KGEN_PG_POOL_MAX || '20', 10),
        idleTimeoutMillis: parseInt(process.env.KGEN_PG_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.KGEN_PG_CONNECTION_TIMEOUT || '2000', 10)
      },
      
      // SSL/TLS
      ssl: process.env.KGEN_PG_SSL === 'true' ? {
        rejectUnauthorized: process.env.KGEN_PG_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : false
    },

    // Optional databases
    mongodb: {
      enabled: process.env.KGEN_MONGODB_ENABLED === 'true',
      uri: process.env.KGEN_MONGODB_URI || 'mongodb://localhost:27017/kgen',
      options: {
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10
      }
    },

    neo4j: {
      enabled: process.env.KGEN_NEO4J_ENABLED === 'true',
      uri: process.env.KGEN_NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.KGEN_NEO4J_USERNAME || 'neo4j',
      password: process.env.KGEN_NEO4J_PASSWORD || 'password'
    },

    elasticsearch: {
      enabled: process.env.KGEN_ES_ENABLED === 'true',
      node: process.env.KGEN_ES_NODE || 'http://localhost:9200',
      maxRetries: 3,
      requestTimeout: 60000
    }
  },

  // Redis Cache Configuration
  cache: {
    redis: {
      host: process.env.KGEN_REDIS_HOST || 'localhost',
      port: parseInt(process.env.KGEN_REDIS_PORT || '6379', 10),
      password: process.env.KGEN_REDIS_PASSWORD || undefined,
      db: parseInt(process.env.KGEN_REDIS_DB || '0', 10),
      
      // Connection options
      connectTimeout: parseInt(process.env.KGEN_REDIS_CONNECT_TIMEOUT || '10000', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      
      // Cluster support
      cluster: process.env.KGEN_REDIS_CLUSTER === 'true' ? {
        enableReadyCheck: false,
        redisOptions: {
          password: process.env.KGEN_REDIS_PASSWORD
        }
      } : undefined
    },
    
    // Cache settings
    defaultTTL: parseInt(process.env.KGEN_CACHE_DEFAULT_TTL || '3600', 10), // 1 hour
    queryTTL: parseInt(process.env.KGEN_CACHE_QUERY_TTL || '1800', 10), // 30 minutes
    maxKeyLength: 250,
    compressionThreshold: 1024 // bytes
  },

  // RDF Processing Configuration
  rdf: {
    // N3 Parser settings
    parser: {
      format: 'turtle', // default format
      blankNodePrefix: '_:b',
      factory: undefined // use default DataFactory
    },
    
    // SPARQL settings
    sparql: {
      endpoint: process.env.KGEN_SPARQL_ENDPOINT || undefined,
      timeout: parseInt(process.env.KGEN_SPARQL_TIMEOUT || '30000', 10),
      maxResults: parseInt(process.env.KGEN_SPARQL_MAX_RESULTS || '10000', 10)
    },
    
    // Validation settings
    validation: {
      enabled: process.env.KGEN_VALIDATION_ENABLED !== 'false',
      strictMode: process.env.KGEN_VALIDATION_STRICT === 'true',
      maxGraphSize: parseInt(process.env.KGEN_MAX_GRAPH_SIZE || '1000000', 10) // nodes
    },
    
    // Namespaces
    namespaces: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dcterms: 'http://purl.org/dc/terms/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      sh: 'http://www.w3.org/ns/shacl#'
    }
  },

  // Security Configuration
  security: {
    // JWT settings
    jwt: {
      secret: process.env.KGEN_JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      expiresIn: process.env.KGEN_JWT_EXPIRES_IN || '24h',
      issuer: process.env.KGEN_JWT_ISSUER || 'kgen-api',
      audience: process.env.KGEN_JWT_AUDIENCE || 'kgen-clients'
    },
    
    // Password hashing
    bcrypt: {
      rounds: parseInt(process.env.KGEN_BCRYPT_ROUNDS || '12', 10)
    },
    
    // Helmet security headers
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [\"'self'\"],
          styleSrc: [\"'self'\", \"'unsafe-inline'\"],
          scriptSrc: [\"'self'\"],
          imgSrc: [\"'self'\", 'data:', 'https:']
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    
    // Input validation
    validation: {
      abortEarly: false,
      stripUnknown: true,
      errors: {
        wrap: {
          label: ''
        }
      }
    },
    
    // API Keys (if using)
    apiKeys: {
      enabled: process.env.KGEN_API_KEYS_ENABLED === 'true',
      headerName: 'X-API-Key',
      queryParam: 'api_key'
    }
  },

  // Monitoring & Observability
  monitoring: {
    // Metrics
    metrics: {
      enabled: process.env.KGEN_METRICS_ENABLED !== 'false',
      path: '/metrics',
      collectDefaultMetrics: true,
      prefix: 'kgen_'
    },
    
    // Health checks
    healthCheckInterval: parseInt(process.env.KGEN_HEALTH_CHECK_INTERVAL || '30000', 10),
    healthCheckPath: '/health',
    
    // Logging
    logging: {
      level: process.env.KGEN_LOG_LEVEL || 'info',
      format: process.env.KGEN_LOG_FORMAT || 'combined',
      
      // File logging
      file: {
        enabled: process.env.KGEN_LOG_FILE_ENABLED === 'true',
        filename: process.env.KGEN_LOG_FILE || 'logs/kgen.log',
        maxsize: parseInt(process.env.KGEN_LOG_MAX_SIZE || '10485760', 10), // 10MB
        maxFiles: parseInt(process.env.KGEN_LOG_MAX_FILES || '5', 10),
        tailable: true
      }
    },
    
    // Performance monitoring
    performance: {
      enabled: process.env.KGEN_PERF_ENABLED !== 'false',
      slowQueryThreshold: parseInt(process.env.KGEN_SLOW_QUERY_THRESHOLD || '1000', 10), // ms
      memoryWarningThreshold: parseInt(process.env.KGEN_MEMORY_WARNING_THRESHOLD || '80', 10) // %
    }
  },

  // Validation Engine Configuration
  validation: {
    shacl: {
      enabled: process.env.KGEN_SHACL_ENABLED !== 'false',
      allowWarnings: process.env.KGEN_SHACL_ALLOW_WARNINGS === 'true',
      validateShapes: process.env.KGEN_SHACL_VALIDATE_SHAPES !== 'false'
    },
    
    // Custom validation rules
    customRules: {
      enabled: process.env.KGEN_CUSTOM_VALIDATION_ENABLED === 'true',
      rulesPath: process.env.KGEN_CUSTOM_VALIDATION_RULES || './validation-rules'
    }
  },

  // File Storage Configuration
  storage: {
    // Temporary files
    temp: {
      directory: process.env.KGEN_TEMP_DIR || '/tmp/kgen',
      cleanupInterval: parseInt(process.env.KGEN_TEMP_CLEANUP_INTERVAL || '3600000', 10), // 1 hour
      maxAge: parseInt(process.env.KGEN_TEMP_MAX_AGE || '86400000', 10) // 24 hours
    },
    
    // Uploads
    uploads: {
      enabled: process.env.KGEN_UPLOADS_ENABLED !== 'false',
      directory: process.env.KGEN_UPLOADS_DIR || './uploads',
      maxSize: parseInt(process.env.KGEN_UPLOADS_MAX_SIZE || '52428800', 10), // 50MB
      allowedTypes: (process.env.KGEN_UPLOADS_ALLOWED_TYPES || 'text/turtle,application/rdf+xml,application/ld+json,text/n3').split(',')
    }
  },

  // Cron Jobs Configuration
  cron: {
    enabled: process.env.KGEN_CRON_ENABLED !== 'false',
    
    jobs: {
      // Cleanup temporary files
      cleanup: {
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
        timezone: 'UTC'
      },
      
      // Health check reporting
      healthReport: {
        enabled: process.env.KGEN_HEALTH_REPORT_ENABLED === 'true',
        schedule: '*/5 * * * *', // Every 5 minutes
        timezone: 'UTC'
      },
      
      // Metrics aggregation
      metricsAggregation: {
        enabled: process.env.KGEN_METRICS_AGGREGATION_ENABLED === 'true',
        schedule: '0 * * * *', // Every hour
        timezone: 'UTC'
      }
    }
  },

  // Feature Flags
  features: {
    // Experimental features
    experimental: {
      enabled: process.env.KGEN_EXPERIMENTAL_ENABLED === 'true',
      features: (process.env.KGEN_EXPERIMENTAL_FEATURES || '').split(',').filter(Boolean)
    },
    
    // Beta features
    beta: {
      enabled: process.env.KGEN_BETA_ENABLED === 'true',
      features: (process.env.KGEN_BETA_FEATURES || '').split(',').filter(Boolean)
    }
  },

  // Development settings
  development: {
    // Only available in development mode
    enabled: process.env.NODE_ENV === 'development',
    
    // Mock services
    mockServices: process.env.KGEN_MOCK_SERVICES === 'true',
    
    // Debug logging
    debugLogging: process.env.KGEN_DEBUG_LOGGING === 'true',
    
    // Auto-reload
    autoReload: process.env.KGEN_AUTO_RELOAD !== 'false'
  }
};

// Validate critical configuration
export function validateConfig() {
  const errors = [];

  // Check required environment variables in production
  if (config.environment === 'production') {
    const required = [
      'KGEN_JWT_SECRET',
      'KGEN_PG_PASSWORD'
    ];

    for (const env of required) {
      if (!process.env[env]) {
        errors.push(`Missing required environment variable: ${env}`);
      }
    }

    // Validate JWT secret strength
    if (process.env.KGEN_JWT_SECRET && process.env.KGEN_JWT_SECRET.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }
  }

  // Validate port ranges
  if (config.api.port < 1 || config.api.port > 65535) {
    errors.push(`Invalid API port: ${config.api.port}`);
  }

  if (config.database.postgres.port < 1 || config.database.postgres.port > 65535) {
    errors.push(`Invalid PostgreSQL port: ${config.database.postgres.port}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

// Export individual sections for easier imports
export const {
  api: apiConfig,
  database: dbConfig,
  cache: cacheConfig,
  rdf: rdfConfig,
  security: securityConfig,
  monitoring: monitoringConfig,
  validation: validationConfig,
  storage: storageConfig,
  cron: cronConfig,
  features: featuresConfig,
  development: developmentConfig
} = config;

export default config;