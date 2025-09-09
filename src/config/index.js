import 'dotenv/config';

const config = {
  // Server configuration
  port: parseInt(process.env.PORT) || 3001,
  environment: process.env.NODE_ENV || 'development',
  version: process.env.VERSION || '1.0.0',
  
  // Service identification
  serviceName: process.env.SERVICE_NAME || 'unjucks-service',
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Database configuration
  database: {
    type: 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'unjucks_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    }
  },

  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
      ['http://localhost:3000', 'http://localhost:3001']
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFileSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 7,
  },

  // Health check configuration
  health: {
    timeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,
    checks: [
      'database',
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

export default config;