require('dotenv').config();

const config = {
  // Server configuration
  port: parseInt(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || 'development',
  version: process.env.VERSION || '1.0.0',
  
  // Service identification
  serviceName: 'order-service',
  apiVersion: 'v1',
  
  // Database configuration
  database: {
    
    type: 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'order_service_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    }
    
  },

  
  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 86400000, // 24 hours
    
  },
  

  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001']
  },

  

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFileSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 7,
    
  },

  
  // Monitoring configuration
  monitoring: {
    type: 'prometheus',
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    timeout: parseInt(process.env.METRICS_TIMEOUT) || 5000
  },
  

  
  // Compliance configuration
  compliance: {
    frameworks: [
  "gdpr",
  "sox"
],
    
    gdpr: {
      enabled: true,
      dataRetentionDays: parseInt(process.env.GDPR_RETENTION_DAYS) || 1095, // 3 years
      consentRequired: true,
      rightToErasure: true,
      dataPortability: true
    },
    
    
    sox: {
      enabled: true,
      auditTrail: true,
      accessControls: true,
      changeManagement: true,
      retentionPeriod: parseInt(process.env.SOX_RETENTION_DAYS) || 2555 // 7 years
    },
    
    
    
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: parseInt(process.env.ENCRYPTION_KEY_ROTATION) || 90
    }
  },
  

  // Health check configuration
  health: {
    timeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,
    checks: [
      'database',
      'monitoring',
      'memory',
      'disk'
    ]
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      hsts: process.env.NODE_ENV === 'production'
    },
    rateLimitByIp: true,
    requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || '10mb'
  },

  

  // Feature flags
  features: {
    authentication: true,
    
    
    
    swagger: process.env.ENABLE_SWAGGER !== 'false',
    metrics: process.env.ENABLE_METRICS !== 'false'
  }
};

// Validation
if (config.environment === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DB_PASSWORD'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  // Production security checks
  if (config.auth && config.auth.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }
}

module.exports = config;