/**
 * Enterprise Semantic Processing Configuration
 * Production-ready configuration for Fortune 5 scale RDF/Turtle processing
 */

import { z } from 'zod';

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

export type SemanticConfig = z.infer<typeof SemanticConfigSchema>;

/**
 * Default production configuration for Fortune 5 enterprises
 */
export const defaultSemanticConfig: SemanticConfig = {
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
export const environmentConfigs = {
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
      dataClassification: 'restricted' as const
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
        strategy: 'btree' as const,
        rebuildInterval: 21600 // 6 hours
      }
    }
  }
};

/**
 * Validate configuration against schema
 */
export function validateSemanticConfig(config: unknown): SemanticConfig {
  return SemanticConfigSchema.parse(config);
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(environment: keyof typeof environmentConfigs): SemanticConfig {
  return environmentConfigs[environment];
}

/**
 * Merge custom configuration with defaults
 */
export function mergeSemanticConfig(custom: Partial<SemanticConfig>): SemanticConfig {
  return SemanticConfigSchema.parse({
    ...defaultSemanticConfig,
    ...custom
  });
}