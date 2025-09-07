/**
 * Enterprise Semantic Processing Configuration
 * Production-ready configuration for Fortune 5 scale RDF/Turtle processing
 */

import { z } from 'zod';

/**
 * @typedef {Object} SemanticConfig
 * @property {Object} processing - Processing configuration
 * @property {number} processing.maxConcurrentQueries - Maximum concurrent queries
 * @property {number} processing.queryTimeout - Query timeout in milliseconds
 * @property {number} processing.batchSize - Batch processing size
 * @property {string} processing.maxMemoryUsage - Maximum memory usage
 * @property {boolean} processing.enableParallelization - Enable parallel processing
 * @property {number} processing.chunkSize - Processing chunk size
 * @property {Object} cache - Cache configuration
 * @property {boolean} cache.enabled - Enable caching
 * @property {'redis'|'memory'|'disk'} cache.provider - Cache provider
 * @property {number} cache.ttl - Time to live in seconds
 * @property {string} cache.maxSize - Maximum cache size
 * @property {number} cache.compressionLevel - Compression level
 * @property {Object} security - Security configuration
 * @property {boolean} security.enableEncryption - Enable encryption
 * @property {string} security.encryptionAlgorithm - Encryption algorithm
 * @property {boolean} security.auditLogging - Enable audit logging
 * @property {'public'|'internal'|'confidential'|'restricted'} security.dataClassification - Data classification level
 * @property {boolean} security.sanitizeQueries - Enable query sanitization
 * @property {Object} compliance - Compliance configuration
 * @property {Object} compliance.gdpr - GDPR compliance settings
 * @property {boolean} compliance.gdpr.enabled - Enable GDPR compliance
 * @property {number} compliance.gdpr.dataRetention - Data retention period in days
 * @property {boolean} compliance.gdpr.rightToErasure - Enable right to erasure
 * @property {boolean} compliance.gdpr.consentTracking - Enable consent tracking
 * @property {Object} compliance.hipaa - HIPAA compliance settings
 * @property {boolean} compliance.hipaa.enabled - Enable HIPAA compliance
 * @property {boolean} compliance.hipaa.encryptionAtRest - Enable encryption at rest
 * @property {boolean} compliance.hipaa.accessLogging - Enable access logging
 * @property {boolean} compliance.hipaa.auditTrail - Enable audit trail
 * @property {Object} compliance.sox - SOX compliance settings
 * @property {boolean} compliance.sox.enabled - Enable SOX compliance
 * @property {boolean} compliance.sox.financialDataProtection - Enable financial data protection
 * @property {boolean} compliance.sox.changeManagement - Enable change management
 * @property {number} compliance.sox.evidenceRetention - Evidence retention period in days
 * @property {Object} monitoring - Monitoring configuration
 * @property {boolean} monitoring.metricsEnabled - Enable metrics collection
 * @property {boolean} monitoring.healthChecks - Enable health checks
 * @property {Object} monitoring.performanceThresholds - Performance thresholds
 * @property {number} monitoring.performanceThresholds.queryLatency - Query latency threshold
 * @property {number} monitoring.performanceThresholds.memoryUsage - Memory usage threshold
 * @property {number} monitoring.performanceThresholds.cpuUsage - CPU usage threshold
 * @property {number} monitoring.performanceThresholds.errorRate - Error rate threshold
 * @property {Object} monitoring.alerting - Alerting configuration
 * @property {boolean} monitoring.alerting.enabled - Enable alerting
 * @property {Array<'email'|'slack'|'webhook'|'pagerduty'>} monitoring.alerting.channels - Alert channels
 * @property {'low'|'medium'|'high'|'critical'} monitoring.alerting.severity - Alert severity
 * @property {Object} performance - Performance configuration
 * @property {Object} performance.indexing - Indexing configuration
 * @property {boolean} performance.indexing.enabled - Enable indexing
 * @property {'btree'|'hash'|'gist'|'gin'} performance.indexing.strategy - Indexing strategy
 * @property {number} performance.indexing.rebuildInterval - Index rebuild interval
 * @property {Object} performance.optimization - Optimization configuration
 * @property {boolean} performance.optimization.queryPlanning - Enable query planning
 * @property {boolean} performance.optimization.statisticsCollection - Enable statistics collection
 * @property {Object} performance.optimization.connectionPooling - Connection pooling configuration
 * @property {boolean} performance.optimization.connectionPooling.enabled - Enable connection pooling
 * @property {number} performance.optimization.connectionPooling.minConnections - Minimum connections
 * @property {number} performance.optimization.connectionPooling.maxConnections - Maximum connections
 * @property {number} performance.optimization.connectionPooling.idleTimeout - Idle timeout
 * @property {Object} deployment - Deployment configuration
 * @property {'development'|'staging'|'production'} deployment.environment - Environment
 * @property {Object} deployment.scalability - Scalability configuration
 * @property {boolean} deployment.scalability.autoScaling - Enable auto scaling
 * @property {number} deployment.scalability.minInstances - Minimum instances
 * @property {number} deployment.scalability.maxInstances - Maximum instances
 * @property {number} deployment.scalability.targetCpuUtilization - Target CPU utilization
 * @property {Object} deployment.backup - Backup configuration
 * @property {boolean} deployment.backup.enabled - Enable backups
 * @property {string} deployment.backup.schedule - Backup schedule (cron format)
 * @property {number} deployment.backup.retention - Backup retention period
 * @property {boolean} deployment.backup.compression - Enable backup compression
 */

// Configuration schema validation
const SemanticConfigSchema = z.object({
  processing: z.object({
    maxConcurrentQueries: z.number().default(100),
    queryTimeout: z.number().default(30000),
    batchSize: z.number().default(1000),
    maxMemoryUsage: z.string().default('2GB'),
    enableParallelization: z.boolean().default(true),
    chunkSize: z.number().default(10000)
  }),
  
  cache: z.object({
    enabled: z.boolean().default(true),
    provider: z.enum(['redis', 'memory', 'disk']).default('redis'),
    ttl: z.number().default(3600),
    maxSize: z.string().default('1GB'),
    compressionLevel: z.number().default(6)
  }),
  
  security: z.object({
    enableEncryption: z.boolean().default(true),
    encryptionAlgorithm: z.string().default('AES-256-GCM'),
    auditLogging: z.boolean().default(true),
    dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal'),
    sanitizeQueries: z.boolean().default(true)
  }),
  
  compliance: z.object({
    gdpr: z.object({
      enabled: z.boolean().default(true),
      dataRetention: z.number().default(2555), // 7 years in days
      rightToErasure: z.boolean().default(true),
      consentTracking: z.boolean().default(true)
    }),
    hipaa: z.object({
      enabled: z.boolean().default(false),
      encryptionAtRest: z.boolean().default(true),
      accessLogging: z.boolean().default(true),
      auditTrail: z.boolean().default(true)
    }),
    sox: z.object({
      enabled: z.boolean().default(false),
      financialDataProtection: z.boolean().default(true),
      changeManagement: z.boolean().default(true),
      evidenceRetention: z.number().default(2555)
    })
  }),
  
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    healthChecks: z.boolean().default(true),
    performanceThresholds: z.object({
      queryLatency: z.number().default(5000),
      memoryUsage: z.number().default(0.8),
      cpuUsage: z.number().default(0.7),
      errorRate: z.number().default(0.01)
    }),
    alerting: z.object({
      enabled: z.boolean().default(true),
      channels: z.array(z.enum(['email', 'slack', 'webhook', 'pagerduty'])).default(['email']),
      severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
    })
  }),
  
  performance: z.object({
    indexing: z.object({
      enabled: z.boolean().default(true),
      strategy: z.enum(['btree', 'hash', 'gist', 'gin']).default('gin'),
      rebuildInterval: z.number().default(86400) // 24 hours
    }),
    optimization: z.object({
      queryPlanning: z.boolean().default(true),
      statisticsCollection: z.boolean().default(true),
      connectionPooling: z.object({
        enabled: z.boolean().default(true),
        minConnections: z.number().default(5),
        maxConnections: z.number().default(50),
        idleTimeout: z.number().default(30000)
      })
    })
  }),
  
  deployment: z.object({
    environment: z.enum(['development', 'staging', 'production']).default('production'),
    scalability: z.object({
      autoScaling: z.boolean().default(true),
      minInstances: z.number().default(2),
      maxInstances: z.number().default(20),
      targetCpuUtilization: z.number().default(70)
    }),
    backup: z.object({
      enabled: z.boolean().default(true),
      schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
      retention: z.number().default(30),
      compression: z.boolean().default(true)
    })
  })
});

/**
 * Default production configuration for Fortune 5 enterprises
 * @type {SemanticConfig}
 */
const defaultSemanticConfig = {
  processing: {
    maxConcurrentQueries: 500,
    queryTimeout: 60000,
    batchSize: 5000,
    maxMemoryUsage: '8GB',
    enableParallelization: true,
    chunkSize: 50000
  },
  
  cache: {
    enabled: true,
    provider: 'redis',
    ttl: 7200,
    maxSize: '4GB',
    compressionLevel: 9
  },
  
  security: {
    enableEncryption: true,
    encryptionAlgorithm: 'AES-256-GCM',
    auditLogging: true,
    dataClassification: 'confidential',
    sanitizeQueries: true
  },
  
  compliance: {
    gdpr: {
      enabled: true,
      dataRetention: 2555,
      rightToErasure: true,
      consentTracking: true
    },
    hipaa: {
      enabled: true,
      encryptionAtRest: true,
      accessLogging: true,
      auditTrail: true
    },
    sox: {
      enabled: true,
      financialDataProtection: true,
      changeManagement: true,
      evidenceRetention: 2555
    }
  },
  
  monitoring: {
    metricsEnabled: true,
    healthChecks: true,
    performanceThresholds: {
      queryLatency: 2000,
      memoryUsage: 0.7,
      cpuUsage: 0.6,
      errorRate: 0.001
    },
    alerting: {
      enabled: true,
      channels: ['email', 'slack', 'pagerduty'],
      severity: 'high'
    }
  },
  
  performance: {
    indexing: {
      enabled: true,
      strategy: 'gin',
      rebuildInterval: 43200 // 12 hours
    },
    optimization: {
      queryPlanning: true,
      statisticsCollection: true,
      connectionPooling: {
        enabled: true,
        minConnections: 10,
        maxConnections: 100,
        idleTimeout: 60000
      }
    }
  },
  
  deployment: {
    environment: 'production',
    scalability: {
      autoScaling: true,
      minInstances: 3,
      maxInstances: 50,
      targetCpuUtilization: 60
    },
    backup: {
      enabled: true,
      schedule: '0 1,13 * * *', // Twice daily
      retention: 90,
      compression: true
    }
  }
};

/**
 * Environment-specific configurations
 */
const environmentConfigs = {
  healthcare: {
    ...defaultSemanticConfig,
    compliance: {
      ...defaultSemanticConfig.compliance,
      hipaa: {
        enabled: true,
        encryptionAtRest: true,
        accessLogging: true,
        auditTrail: true
      }
    },
    security: {
      ...defaultSemanticConfig.security,
      dataClassification: 'restricted'
    }
  },
  
  financial: {
    ...defaultSemanticConfig,
    compliance: {
      ...defaultSemanticConfig.compliance,
      sox: {
        enabled: true,
        financialDataProtection: true,
        changeManagement: true,
        evidenceRetention: 2555
      }
    },
    monitoring: {
      ...defaultSemanticConfig.monitoring,
      performanceThresholds: {
        queryLatency: 1000,
        memoryUsage: 0.6,
        cpuUsage: 0.5,
        errorRate: 0.0001
      }
    }
  },
  
  supply_chain: {
    ...defaultSemanticConfig,
    processing: {
      ...defaultSemanticConfig.processing,
      maxConcurrentQueries: 1000,
      batchSize: 10000,
      maxMemoryUsage: '16GB'
    },
    performance: {
      ...defaultSemanticConfig.performance,
      indexing: {
        enabled: true,
        strategy: 'btree',
        rebuildInterval: 21600 // 6 hours
      }
    }
  }
};

/**
 * Validate configuration against schema
 * @param {any} config - Configuration to validate
 * @returns {SemanticConfig} Validated configuration
 */
function validateSemanticConfig(config) {
  return SemanticConfigSchema.parse(config);
}

/**
 * Get configuration for specific environment
 * @param {string} environment - Environment name
 * @returns {SemanticConfig} Environment configuration
 */
function getEnvironmentConfig(environment) {
  return environmentConfigs[environment];
}

/**
 * Merge custom configuration with defaults
 * @param {Partial<SemanticConfig>} custom - Custom configuration
 * @returns {SemanticConfig} Merged configuration
 */
function mergeSemanticConfig(custom) {
  return SemanticConfigSchema.parse({
    ...defaultSemanticConfig,
    ...custom
  });
}

/**
 * Get configuration based on environment variables
 * @returns {SemanticConfig} Configuration
 */
function getSemanticConfig() {
  const environment = process.env.SEMANTIC_ENV;
  if (environment && environmentConfigs[environment]) {
    return validateSemanticConfig(environmentConfigs[environment]);
  }
  return validateSemanticConfig(defaultSemanticConfig);
}

export {
  SemanticConfigSchema,
  defaultSemanticConfig,
  environmentConfigs,
  validateSemanticConfig,
  getEnvironmentConfig,
  mergeSemanticConfig,
  getSemanticConfig
};

export default getSemanticConfig();
