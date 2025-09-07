/**
 * Fortune 5 Enterprise Production Configuration
 * Multi-tenant semantic processing with enterprise-scale RDF handling
 */

/**
 * @typedef {Object} SemanticProductionConfig
 * @property {Object} rdf - Enterprise RDF Processing
 * @property {number} rdf.maxTriples - Maximum triples per operation
 * @property {number} rdf.batchSize - Processing batch size
 * @property {number} rdf.parallelism - Parallel processing threads
 * @property {string} rdf.memoryLimit - Memory limit for operations
 * @property {Object} rdf.timeouts - Operation timeouts
 * @property {number} rdf.timeouts.query - Query timeout in ms
 * @property {number} rdf.timeouts.parse - Parse timeout in ms
 * @property {number} rdf.timeouts.serialize - Serialize timeout in ms
 * @property {string[]} rdf.formats - Supported RDF formats
 * @property {boolean} rdf.compression - Enable compression
 * @property {Object} multiTenant - Multi-tenant Isolation
 * @property {boolean} multiTenant.enabled - Enable multi-tenancy
 * @property {'namespace'|'database'|'schema'} multiTenant.isolation - Isolation method
 * @property {number} multiTenant.maxTenantsPerInstance - Max tenants per instance
 * @property {Object} multiTenant.resourceQuotas - Resource quotas per tenant
 * @property {string} multiTenant.resourceQuotas.memory - Memory quota
 * @property {number} multiTenant.resourceQuotas.cpu - CPU quota
 * @property {string} multiTenant.resourceQuotas.storage - Storage quota
 * @property {boolean} multiTenant.encryptionAtRest - Enable encryption at rest
 * @property {boolean} multiTenant.auditLogging - Enable audit logging
 * @property {Object} performance - Performance Optimization
 * @property {Object} performance.caching - Caching configuration
 * @property {boolean} performance.caching.enabled - Enable caching
 * @property {'redis'|'memcached'|'memory'} performance.caching.provider - Cache provider
 * @property {number} performance.caching.ttl - Time to live in seconds
 * @property {string} performance.caching.maxSize - Maximum cache size
 * @property {Object} performance.indexing - Indexing configuration
 * @property {boolean} performance.indexing.enabled - Enable indexing
 * @property {'btree'|'hash'|'gist'} performance.indexing.strategy - Index strategy
 * @property {boolean} performance.indexing.background - Background indexing
 * @property {Object} performance.clustering - Clustering configuration
 * @property {boolean} performance.clustering.enabled - Enable clustering
 * @property {number} performance.clustering.nodes - Number of nodes
 * @property {number} performance.clustering.replication - Replication factor
 * @property {'hash'|'range'|'directory'} performance.clustering.sharding - Sharding strategy
 * @property {Object} security - Security & Compliance
 * @property {Object} security.authentication - Authentication configuration
 * @property {'oauth2'|'saml'|'jwt'} security.authentication.provider - Auth provider
 * @property {boolean} security.authentication.mfa - Multi-factor authentication
 * @property {number} security.authentication.sessionTimeout - Session timeout in seconds
 * @property {Object} security.authorization - Authorization configuration
 * @property {boolean} security.authorization.rbac - Role-based access control
 * @property {string[]} security.authorization.policies - Authorization policies
 * @property {boolean} security.authorization.finegrained - Fine-grained authorization
 * @property {Object} security.encryption - Encryption configuration
 * @property {boolean} security.encryption.inTransit - Encryption in transit
 * @property {boolean} security.encryption.atRest - Encryption at rest
 * @property {boolean} security.encryption.keyRotation - Key rotation
 * @property {'AES-256-GCM'|'ChaCha20-Poly1305'} security.encryption.algorithm - Encryption algorithm
 * @property {Object} security.compliance - Compliance configuration
 * @property {boolean} security.compliance.gdpr - GDPR compliance
 * @property {boolean} security.compliance.hipaa - HIPAA compliance
 * @property {boolean} security.compliance.sox - SOX compliance
 * @property {boolean} security.compliance.auditing - Audit logging
 * @property {boolean} security.compliance.dataClassification - Data classification
 * @property {Object} monitoring - Monitoring & Observability
 * @property {Object} monitoring.metrics - Metrics configuration
 * @property {boolean} monitoring.metrics.enabled - Enable metrics
 * @property {'prometheus'|'datadog'|'newrelic'} monitoring.metrics.provider - Metrics provider
 * @property {number} monitoring.metrics.interval - Collection interval in seconds
 * @property {string} monitoring.metrics.retention - Retention period
 * @property {Object} monitoring.logging - Logging configuration
 * @property {'error'|'warn'|'info'|'debug'} monitoring.logging.level - Log level
 * @property {boolean} monitoring.logging.structured - Structured logging
 * @property {number} monitoring.logging.sampling - Sampling rate (0-1)
 * @property {string} monitoring.logging.retention - Retention period
 * @property {Object} monitoring.tracing - Tracing configuration
 * @property {boolean} monitoring.tracing.enabled - Enable tracing
 * @property {'jaeger'|'zipkin'|'xray'} monitoring.tracing.provider - Tracing provider
 * @property {number} monitoring.tracing.sampling - Sampling rate (0-1)
 * @property {Object} monitoring.alerting - Alerting configuration
 * @property {boolean} monitoring.alerting.enabled - Enable alerting
 * @property {string[]} monitoring.alerting.channels - Alert channels
 * @property {Record<string, number>} monitoring.alerting.thresholds - Alert thresholds
 */

export const PRODUCTION_CONFIG = {
  rdf: {
    maxTriples: 10_000_000, // 10M triples per operation
    batchSize: 10_000,
    parallelism: 8,
    memoryLimit: '8GB',
    timeouts: {
      query: 30_000, // 30 seconds
      parse: 60_000, // 1 minute
      serialize: 45_000, // 45 seconds
    },
    formats: ['turtle', 'rdf/xml', 'n-triples', 'json-ld', 'n3'],
    compression: true,
  },

  multiTenant: {
    enabled: true,
    isolation: 'namespace',
    maxTenantsPerInstance: 100,
    resourceQuotas: {
      memory: '1GB',
      cpu: 2,
      storage: '100GB',
    },
    encryptionAtRest: true,
    auditLogging: true,
  },

  performance: {
    caching: {
      enabled: true,
      provider: 'redis',
      ttl: 3600, // 1 hour
      maxSize: '2GB',
    },
    indexing: {
      enabled: true,
      strategy: 'btree',
      background: true,
    },
    clustering: {
      enabled: true,
      nodes: 3,
      replication: 2,
      sharding: 'hash',
    },
  },

  security: {
    authentication: {
      provider: 'oauth2',
      mfa: true,
      sessionTimeout: 28800, // 8 hours
    },
    authorization: {
      rbac: true,
      policies: ['read', 'write', 'admin', 'audit'],
      finegrained: true,
    },
    encryption: {
      inTransit: true,
      atRest: true,
      keyRotation: true,
      algorithm: 'AES-256-GCM',
    },
    compliance: {
      gdpr: true,
      hipaa: true,
      sox: true,
      auditing: true,
      dataClassification: true,
    },
  },

  monitoring: {
    metrics: {
      enabled: true,
      provider: 'prometheus',
      interval: 15, // 15 seconds
      retention: '30d',
    },
    logging: {
      level: 'info',
      structured: true,
      sampling: 0.1, // 10% sampling
      retention: '90d',
    },
    tracing: {
      enabled: true,
      provider: 'jaeger',
      sampling: 0.01, // 1% sampling
    },
    alerting: {
      enabled: true,
      channels: ['slack', 'email', 'pagerduty'],
      thresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        memoryUsage: 0.8, // 80%
        diskUsage: 0.9, // 90%
      },
    },
  },
};

export const DEVELOPMENT_CONFIG = {
  ...PRODUCTION_CONFIG,
  rdf: {
    ...PRODUCTION_CONFIG.rdf,
    maxTriples: 100_000, // 100K triples for dev
    batchSize: 1_000,
    parallelism: 2,
    memoryLimit: '512MB',
  },
  multiTenant: {
    ...PRODUCTION_CONFIG.multiTenant,
    enabled: false,
    maxTenantsPerInstance: 5,
  },
  performance: {
    ...PRODUCTION_CONFIG.performance,
    caching: {
      ...PRODUCTION_CONFIG.performance.caching,
      provider: 'memory',
      maxSize: '100MB',
    },
    clustering: {
      ...PRODUCTION_CONFIG.performance.clustering,
      enabled: false,
    },
  },
  security: {
    ...PRODUCTION_CONFIG.security,
    authentication: {
      ...PRODUCTION_CONFIG.security.authentication,
      mfa: false,
    },
    compliance: {
      ...PRODUCTION_CONFIG.security.compliance,
      gdpr: false,
      hipaa: false,
      sox: false,
    },
  },
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    logging: {
      ...PRODUCTION_CONFIG.monitoring.logging,
      level: 'debug',
      sampling: 1.0, // 100% sampling in dev
    },
    tracing: {
      ...PRODUCTION_CONFIG.monitoring.tracing,
      sampling: 1.0, // 100% sampling in dev
    },
  },
};

/**
 * Get configuration based on environment
 * @returns {SemanticProductionConfig} Configuration object
 */
export function getSemanticConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'staging':
      return {
        ...PRODUCTION_CONFIG,
        rdf: {
          ...PRODUCTION_CONFIG.rdf,
          maxTriples: 1_000_000, // 1M triples for staging
        },
        monitoring: {
          ...PRODUCTION_CONFIG.monitoring,
          logging: {
            ...PRODUCTION_CONFIG.monitoring.logging,
            level: 'debug',
          },
        },
      };
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Validate production configuration
 * @param {SemanticProductionConfig} config - Configuration to validate
 * @returns {string[]} Array of validation issues
 */
export function validateProductionConfig(config) {
  const issues = [];

  // RDF Configuration Validation
  if (config.rdf.maxTriples < 1_000_000) {
    issues.push('RDF maxTriples should be at least 1M for production');
  }

  if (config.rdf.memoryLimit.endsWith('MB') && parseInt(config.rdf.memoryLimit) < 4096) {
    issues.push('RDF memoryLimit should be at least 4GB for production');
  }

  // Multi-tenant Validation
  if (!config.multiTenant.enabled) {
    issues.push('Multi-tenant isolation should be enabled in production');
  }

  if (!config.multiTenant.encryptionAtRest) {
    issues.push('Encryption at rest is required for production');
  }

  // Security Validation
  if (!config.security.authentication.mfa) {
    issues.push('Multi-factor authentication is required for production');
  }

  if (!config.security.encryption.inTransit) {
    issues.push('Encryption in transit is required for production');
  }

  if (!config.security.compliance.auditing) {
    issues.push('Audit logging is required for production');
  }

  // Performance Validation
  if (!config.performance.caching.enabled) {
    issues.push('Caching should be enabled for production performance');
  }

  if (!config.performance.indexing.enabled) {
    issues.push('Indexing should be enabled for production performance');
  }

  // Monitoring Validation
  if (!config.monitoring.metrics.enabled) {
    issues.push('Metrics collection is required for production monitoring');
  }

  if (!config.monitoring.tracing.enabled) {
    issues.push('Distributed tracing is required for production observability');
  }

  if (!config.monitoring.alerting.enabled) {
    issues.push('Alerting is required for production monitoring');
  }

  return issues;
}

/**
 * Production readiness checklist
 */
export const PRODUCTION_CHECKLIST = {
  configuration: [
    'Enterprise-scale RDF processing limits configured',
    'Multi-tenant isolation enabled and configured',
    'Performance optimization enabled (caching, indexing, clustering)',
    'Security controls fully configured (auth, encryption, compliance)',
    'Monitoring and observability fully configured',
  ],
  infrastructure: [
    'Database cluster deployed and configured',
    'Redis/caching layer deployed',
    'Load balancers configured',
    'SSL certificates installed and configured',
    'Network security groups configured',
  ],
  security: [
    'Authentication provider configured',
    'Authorization policies deployed',
    'Encryption keys rotated',
    'Security scanning completed',
    'Compliance audit completed',
  ],
  monitoring: [
    'Metrics dashboards configured',
    'Alerting rules deployed',
    'Log aggregation configured',
    'Distributed tracing configured',
    'Health checks configured',
  ],
  testing: [
    'Load testing completed',
    'Security testing completed',
    'Disaster recovery testing completed',
    'Multi-tenant isolation testing completed',
    'Performance benchmarking completed',
  ],
};