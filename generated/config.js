/**
 * Application Configuration
 * Generated from RDF configuration data
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * @typedef {Object} AppConfig
 * @property {string} name
 * @property {string} version
 * @property {string} description
 */

/**
 * @typedef {Object} ServerConfig
 * @property {number} port
 * @property {boolean} debug
 * @property {'debug'|'info'|'warn'|'error'} logLevel
 */

/**
 * @typedef {Object} DatabaseConfig
 * @property {string} host
 * @property {number} port
 * @property {string} name
 * @property {boolean} ssl
 * @property {number} [poolSize]
 */

/**
 * @typedef {Object} RedisConfig
 * @property {string} host
 * @property {number} port
 * @property {string} [password]
 */

/**
 * @typedef {Object} Config
 * @property {AppConfig} app
 * @property {ServerConfig} server
 * @property {DatabaseConfig} database
 * @property {RedisConfig} redis
 * @property {string} [cdn]
 * @property {boolean} [monitoring]
 */

/**
 * Validates configuration object
 * @param {any} config - Configuration to validate
 * @returns {Config} Validated configuration
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }
  
  // Validate app config
  if (!config.app || typeof config.app !== 'object') {
    throw new Error('app configuration is required');
  }
  if (!config.app.name || typeof config.app.name !== 'string') {
    throw new Error('app.name must be a string');
  }
  if (!config.app.version || typeof config.app.version !== 'string') {
    throw new Error('app.version must be a string');
  }
  if (!config.app.description || typeof config.app.description !== 'string') {
    throw new Error('app.description must be a string');
  }
  
  // Validate server config
  if (!config.server || typeof config.server !== 'object') {
    throw new Error('server configuration is required');
  }
  if (typeof config.server.port !== 'number') {
    throw new Error('server.port must be a number');
  }
  if (typeof config.server.debug !== 'boolean') {
    throw new Error('server.debug must be a boolean');
  }
  if (!['debug', 'info', 'warn', 'error'].includes(config.server.logLevel)) {
    throw new Error('server.logLevel must be one of: debug, info, warn, error');
  }
  
  // Validate database config
  if (!config.database || typeof config.database !== 'object') {
    throw new Error('database configuration is required');
  }
  if (!config.database.host || typeof config.database.host !== 'string') {
    throw new Error('database.host must be a string');
  }
  if (typeof config.database.port !== 'number') {
    throw new Error('database.port must be a number');
  }
  if (!config.database.name || typeof config.database.name !== 'string') {
    throw new Error('database.name must be a string');
  }
  if (typeof config.database.ssl !== 'boolean') {
    throw new Error('database.ssl must be a boolean');
  }
  if (config.database.poolSize !== undefined && typeof config.database.poolSize !== 'number') {
    throw new Error('database.poolSize must be a number or undefined');
  }
  
  // Validate redis config
  if (!config.redis || typeof config.redis !== 'object') {
    throw new Error('redis configuration is required');
  }
  if (!config.redis.host || typeof config.redis.host !== 'string') {
    throw new Error('redis.host must be a string');
  }
  if (typeof config.redis.port !== 'number') {
    throw new Error('redis.port must be a number');
  }
  if (config.redis.password !== undefined && typeof config.redis.password !== 'string') {
    throw new Error('redis.password must be a string or undefined');
  }
  
  // Validate optional fields
  if (config.cdn !== undefined && typeof config.cdn !== 'string') {
    throw new Error('cdn must be a string or undefined');
  }
  if (config.monitoring !== undefined && typeof config.monitoring !== 'boolean') {
    throw new Error('monitoring must be a boolean or undefined');
  }
  
  return config;
}

/** @type {Record<string, Config>} */
const configs = {
  development: {
    app: {
      name: 'unjucks-app',
      version: '1.0.0',
      description: 'Semantic template generator'
    },
    server: {
      port: 3000,
      debug: true,
      logLevel: 'debug'
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'dev_db',
      ssl: false
    },
    redis: {
      host: 'localhost',
      port: 6379
    }
  },

  production: {
    app: {
      name: 'unjucks-app',
      version: '1.0.0',
      description: 'Semantic template generator'
    },
    server: {
      port: 8080,
      debug: false,
      logLevel: 'error'
    },
    database: {
      host: 'db.prod.example.com',
      port: 5432,
      name: 'prod_db',
      ssl: true,
      poolSize: 20
    },
    redis: {
      host: 'redis.prod.example.com',
      port: 6379,
      password: process.env.REDIS_PASSWORD || '@{REDIS_PASSWORD}'
    },
    cdn: 'https://cdn.example.com',
    monitoring: true
  }
};

/**
 * Get configuration for current environment
 * @returns {Config} Configuration object
 */
function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  const config = configs[env] || configs.development;
  return validateConfig(config);
}

/**
 * Get configuration for specific environment
 * @param {string} environment - Environment name
 * @returns {Config} Configuration object
 */
function getConfigForEnvironment(environment) {
  const config = configs[environment] || configs.development;
  return validateConfig(config);
}

/**
 * Merge custom configuration with environment config
 * @param {Partial<Config>} customConfig - Custom configuration overrides
 * @param {string} [environment] - Target environment
 * @returns {Config} Merged configuration
 */
function mergeConfig(customConfig, environment) {
  const baseConfig = getConfigForEnvironment(environment || process.env.NODE_ENV || 'development');
  const merged = {
    ...baseConfig,
    ...customConfig,
    app: { ...baseConfig.app, ...(customConfig.app || {}) },
    server: { ...baseConfig.server, ...(customConfig.server || {}) },
    database: { ...baseConfig.database, ...(customConfig.database || {}) },
    redis: { ...baseConfig.redis, ...(customConfig.redis || {}) }
  };
  return validateConfig(merged);
}

export {
  getConfig,
  getConfigForEnvironment,
  mergeConfig,
  validateConfig,
  configs
};

// Export default configuration
const defaultConfig = getConfig();
export default defaultConfig;
