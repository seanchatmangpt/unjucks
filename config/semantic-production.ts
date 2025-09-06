/**
 * Fortune 5 Enterprise Production Configuration
 * Multi-tenant semantic processing with enterprise-scale RDF handling
 */

export interface SemanticProductionConfig {
  // Enterprise RDF Processing
  rdf: {
    maxTriples: number;
    batchSize: number;
    parallelism: number;
    memoryLimit: string;
    timeouts: {
      query: number;
      parse: number;
      serialize: number;
    };
    formats: string[];
    compression: boolean;
  };

  // Multi-tenant Isolation
  multiTenant: {
    enabled: boolean;
    isolation: 'namespace' | 'database' | 'schema';
    maxTenantsPerInstance: number;
    resourceQuotas: {
      memory: string;
      cpu: number;
      storage: string;
    };
    encryptionAtRest: boolean;
    auditLogging: boolean;
  };

  // Performance Optimization
  performance: {
    caching: {
      enabled: boolean;
      provider: 'redis' | 'memcached' | 'memory';
      ttl: number;
      maxSize: string;
    };
    indexing: {
      enabled: boolean;
      strategy: 'btree' | 'hash' | 'gist';
      background: boolean;
    };
    clustering: {
      enabled: boolean;
      nodes: number;
      replication: number;
      sharding: 'hash' | 'range' | 'directory';
    };
  };

  // Security & Compliance
  security: {
    authentication: {
      provider: 'oauth2' | 'saml' | 'jwt';
      mfa: boolean;
      sessionTimeout: number;
    };
    authorization: {
      rbac: boolean;
      policies: string[];
      finegrained: boolean;
    };
    encryption: {
      inTransit: boolean;
      atRest: boolean;
      keyRotation: boolean;
      algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
    };
    compliance: {
      gdpr: boolean;
      hipaa: boolean;
      sox: boolean;
      auditing: boolean;
      dataClassification: boolean;
    };
  };

  // Monitoring & Observability
  monitoring: {
    metrics: {
      enabled: boolean;
      provider: 'prometheus' | 'datadog' | 'newrelic';
      interval: number;
      retention: string;
    };
    logging: {
      level: 'error' | 'warn' | 'info' | 'debug';
      structured: boolean;
      sampling: number;
      retention: string;
    };
    tracing: {
      enabled: boolean;
      provider: 'jaeger' | 'zipkin' | 'xray';
      sampling: number;
    };
    alerting: {
      enabled: boolean;
      channels: string[];
      thresholds: Record<string, number>;
    };
  };
}

export const PRODUCTION_CONFIG: SemanticProductionConfig = {
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

export const DEVELOPMENT_CONFIG: SemanticProductionConfig = {
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
 */
export function getSemanticConfig(): SemanticProductionConfig {
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
 */
export function validateProductionConfig(config: SemanticProductionConfig): string[] {
  const issues: string[] = [];

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