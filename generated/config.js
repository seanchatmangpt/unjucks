/**
 * Application Configuration
 * Generated from RDF configuration data with environment variable support
 */

// Environment variables will be loaded from process.env
// dotenv can be loaded separately if needed

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
 * @typedef {Object} KgenConfig
 * @property {string} env
 * @property {string} encryptionKey
 * @property {string} hashAlgorithm
 * @property {number} cacheTtl
 * @property {number} maxCacheSize
 * @property {string} logLevel
 */

/**
 * @typedef {Object} Config
 * @property {AppConfig} app
 * @property {ServerConfig} server
 * @property {DatabaseConfig} database
 * @property {RedisConfig} redis
 * @property {KgenConfig} kgen
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
  
  // Validate kgen config
  if (!config.kgen || typeof config.kgen !== 'object') {
    throw new Error('kgen configuration is required');
  }
  if (!config.kgen.env || typeof config.kgen.env !== 'string') {
    throw new Error('kgen.env must be a string');
  }
  if (!['development', 'production', 'test'].includes(config.kgen.env)) {
    throw new Error('kgen.env must be one of: development, production, test');
  }
  if (!config.kgen.encryptionKey || typeof config.kgen.encryptionKey !== 'string') {
    throw new Error('kgen.encryptionKey must be a string');
  }
  if (config.kgen.encryptionKey.length < 32) {
    throw new Error('kgen.encryptionKey must be at least 32 characters long');
  }
  if (!config.kgen.hashAlgorithm || typeof config.kgen.hashAlgorithm !== 'string') {
    throw new Error('kgen.hashAlgorithm must be a string');
  }
  if (!['sha256', 'sha512'].includes(config.kgen.hashAlgorithm)) {
    throw new Error('kgen.hashAlgorithm must be one of: sha256, sha512');
  }
  if (typeof config.kgen.cacheTtl !== 'number' || config.kgen.cacheTtl <= 0) {
    throw new Error('kgen.cacheTtl must be a positive number');
  }
  if (typeof config.kgen.maxCacheSize !== 'number' || config.kgen.maxCacheSize <= 0) {
    throw new Error('kgen.maxCacheSize must be a positive number');
  }
  if (!config.kgen.logLevel || typeof config.kgen.logLevel !== 'string') {
    throw new Error('kgen.logLevel must be a string');
  }
  if (!['debug', 'info', 'warn', 'error'].includes(config.kgen.logLevel)) {
    throw new Error('kgen.logLevel must be one of: debug, info, warn, error');
  }
  
  return config;
}

/**
 * Parse database connection string
 * @param {string} url - Database connection URL
 * @returns {Object} Parsed database configuration
 */
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      name: parsed.pathname.slice(1), // remove leading slash
      user: parsed.username,
      password: parsed.password,
      ssl: parsed.searchParams.get('sslmode') === 'require'
    };
  } catch (error) {
    throw new Error(`Invalid database URL: ${error.message}`);
  }
}

/**
 * Parse Redis connection string
 * @param {string} url - Redis connection URL
 * @returns {Object} Parsed Redis configuration
 */
function parseRedisUrl(url) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined
    };
  } catch (error) {
    throw new Error(`Invalid Redis URL: ${error.message}`);
  }
}

/**
 * Load configuration from environment variables
 * @returns {Partial<Config>} Configuration loaded from environment
 */
function loadFromEnvironment() {
  const env = process.env;
  
  // Parse database configuration
  const databaseFromUrl = parseDatabaseUrl(env.DATABASE_URL);
  const database = databaseFromUrl || {
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT) || 5432,
    name: env.DB_NAME || 'dev_db',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true',
    poolSize: parseInt(env.DB_POOL_SIZE) || undefined
  };
  
  // Parse Redis configuration
  const redisFromUrl = parseRedisUrl(env.REDIS_URL);
  const redis = redisFromUrl || {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD || undefined
  };
  
  return {
    app: {
      name: env.APP_NAME || 'unjucks-app',
      version: env.APP_VERSION || '1.0.0',
      description: env.APP_DESCRIPTION || 'Semantic template generator'
    },
    server: {
      port: parseInt(env.PORT) || 3000,
      debug: env.DEBUG === 'true',
      logLevel: env.LOG_LEVEL || env.KGEN_LOG_LEVEL || 'debug'
    },
    database,
    redis,
    kgen: {
      env: env.KGEN_ENV || env.NODE_ENV || 'development',
      encryptionKey: env.KGEN_ENCRYPTION_KEY || 'development-key-32-characters-long!!!',
      hashAlgorithm: env.KGEN_HASH_ALGORITHM || 'sha256',
      cacheTtl: parseInt(env.KGEN_CACHE_TTL) || 3600,
      maxCacheSize: parseInt(env.KGEN_MAX_CACHE_SIZE) || 1000,
      logLevel: env.KGEN_LOG_LEVEL || 'debug'
    },
    cdn: env.CDN_URL || undefined,
    monitoring: env.MONITORING_ENABLED === 'true' || false
  };
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
    },
    kgen: {
      env: 'development',
      encryptionKey: 'development-key-32-characters-long!!!',
      hashAlgorithm: 'sha256',
      cacheTtl: 3600,
      maxCacheSize: 1000,
      logLevel: 'debug'
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
    kgen: {
      env: 'production',
      encryptionKey: process.env.KGEN_ENCRYPTION_KEY || 'production-placeholder-32-characters!!',
      hashAlgorithm: 'sha512',
      cacheTtl: 7200,
      maxCacheSize: 5000,
      logLevel: 'error'
    },
    cdn: 'https://cdn.example.com',
    monitoring: true
  },

  test: {
    app: {
      name: 'unjucks-app-test',
      version: '1.0.0',
      description: 'Semantic template generator - test environment'
    },
    server: {
      port: 3001,
      debug: false,
      logLevel: 'warn'
    },
    database: {
      host: 'localhost',
      port: 5433,
      name: 'test_db',
      ssl: false
    },
    redis: {
      host: 'localhost',
      port: 6380
    },
    kgen: {
      env: 'test',
      encryptionKey: 'test-key-32-characters-long-test!!!',
      hashAlgorithm: 'sha256',
      cacheTtl: 300,
      maxCacheSize: 100,
      logLevel: 'warn'
    },
    monitoring: false
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
  const envConfig = loadFromEnvironment();
  
  const merged = {
    ...baseConfig,
    ...envConfig,
    ...customConfig,
    app: { 
      ...baseConfig.app, 
      ...(envConfig.app || {}),
      ...(customConfig.app || {}) 
    },
    server: { 
      ...baseConfig.server, 
      ...(envConfig.server || {}),
      ...(customConfig.server || {}) 
    },
    database: { 
      ...baseConfig.database, 
      ...(envConfig.database || {}),
      ...(customConfig.database || {}) 
    },
    redis: { 
      ...baseConfig.redis, 
      ...(envConfig.redis || {}),
      ...(customConfig.redis || {}) 
    },
    kgen: { 
      ...baseConfig.kgen, 
      ...(envConfig.kgen || {}),
      ...(customConfig.kgen || {}) 
    }
  };
  return validateConfig(merged);
}

/**
 * Get configuration with environment variables loaded
 * @param {string} [environment] - Target environment
 * @returns {Config} Configuration object with environment variables
 */
function getConfigWithEnv(environment) {
  return mergeConfig({}, environment);
}

export {
  getConfig,
  getConfigForEnvironment,
  getConfigWithEnv,
  mergeConfig,
  validateConfig,
  loadFromEnvironment,
  parseDatabaseUrl,
  parseRedisUrl,
  configs
};

// Export default configuration
export default getConfig();
