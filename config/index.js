/**
 * Main Configuration Entry Point
 * Provides simplified access to the enterprise configuration system
 */
import { initializeConfig, getConfigManager, getConfig, isFeatureEnabled } from './manager/config-manager.js';

// Re-export main configuration functions
export {
  initializeConfig,
  getConfigManager,
  getConfig,
  isFeatureEnabled
};

// Re-export schema validators
export {
  ConfigSchema,
  validateEnvironmentConfig,
  ConfigValidators
} from './schemas/config-schema.js';

// Re-export manager classes for advanced usage
export { ConfigManager } from './manager/config-manager.js';
export { SecretsManager } from './manager/secrets-manager.js';
export { FeatureFlagsManager } from './manager/feature-flags-manager.js';
export { HotReloadHandler } from './hot-reload/hot-reload-handler.js';

/**
 * Quick setup helper for common scenarios
 */
export async function setupConfig(options = {}) {
  const defaultOptions = {
    configDir: './config',
    environment: process.env.NODE_ENV || 'development',
    enableHotReload: process.env.NODE_ENV !== 'production',
    enableValidation: true,
    enableSecrets: true,
    enableFeatureFlags: true,
    ...options
  };
  
  return await initializeConfig(defaultOptions);
}

/**
 * Get configuration with environment variable fallback
 */
export function getConfigWithEnv(path, envVar, defaultValue) {
  const configValue = getConfig(path);
  if (configValue !== undefined) {
    return configValue;
  }
  
  return process.env[envVar] || defaultValue;
}

/**
 * Get database configuration with common defaults
 */
export function getDatabaseConfig() {
  const config = getConfig('database', {});
  
  return {
    type: config.type || 'postgresql',
    host: getConfigWithEnv('database.host', 'DB_HOST', 'localhost'),
    port: parseInt(getConfigWithEnv('database.port', 'DB_PORT', '5432')),
    database: getConfigWithEnv('database.database', 'DB_NAME', 'unjucks_db'),
    username: getConfigWithEnv('database.username', 'DB_USER', 'postgres'),
    password: getConfigWithEnv('database.password', 'DB_PASSWORD', 'password'),
    ssl: getConfigWithEnv('database.ssl', 'DB_SSL', false),
    ...config
  };
}

/**
 * Get server configuration with common defaults
 */
export function getServerConfig() {
  const config = getConfig('server', {});
  
  return {
    port: parseInt(getConfigWithEnv('server.port', 'PORT', '3000')),
    host: getConfigWithEnv('server.host', 'HOST', 'localhost'),
    timeout: config.timeout || 30000,
    keepAliveTimeout: config.keepAliveTimeout || 65000,
    maxConnections: config.maxConnections || 1000,
    ...config
  };
}

/**
 * Check if running in production environment
 */
export function isProduction() {
  return getConfig('app.environment') === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment() {
  return getConfig('app.environment') === 'development';
}

/**
 * Check if running in staging environment
 */
export function isStaging() {
  return getConfig('app.environment') === 'staging';
}

/**
 * Get CORS configuration for Express/Fastify
 */
export function getCorsConfig() {
  return getConfig('security.cors', {
    origin: ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
}

/**
 * Get JWT configuration
 */
export function getJwtConfig() {
  const config = getConfig('security.jwt', {});
  
  return {
    secret: getConfigWithEnv('security.jwt.secret', 'JWT_SECRET', 'change-me-in-production'),
    algorithm: config.algorithm || 'HS256',
    expiresIn: config.expiresIn || '24h',
    issuer: config.issuer,
    audience: config.audience
  };
}

/**
 * Get logging configuration for winston/pino
 */
export function getLoggingConfig() {
  return getConfig('logging', {
    level: 'info',
    format: 'json',
    enableAudit: true,
    enablePerformance: false
  });
}

export default {
  setupConfig,
  getConfig,
  getConfigWithEnv,
  getDatabaseConfig,
  getServerConfig,
  getCorsConfig,
  getJwtConfig,
  getLoggingConfig,
  isFeatureEnabled,
  isProduction,
  isDevelopment,
  isStaging
};