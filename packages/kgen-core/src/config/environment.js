/**
 * KGEN Environment Configuration System
 * 
 * Centralized environment variable management to replace hardcoded values
 * identified in the comprehensive audit.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file if it exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

/**
 * Environment configuration with sensible defaults
 * All hardcoded values from audit are now configurable
 */
export const env = {
  // Application Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_ENV: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',
  
  // Project Configuration (replaces hardcoded project settings)
  PROJECT_NAME: process.env.PROJECT_NAME || process.env.npm_package_name || 'kgen-project',
  PROJECT_VERSION: process.env.PROJECT_VERSION || process.env.npm_package_version || '1.0.0',
  PROJECT_AUTHOR: process.env.PROJECT_AUTHOR || process.env.npm_package_author || 'KGEN User',
  PROJECT_LICENSE: process.env.PROJECT_LICENSE || process.env.npm_package_license || 'MIT',
  
  // Directory Configuration (replaces hardcoded paths)
  OUTPUT_DIR: process.env.OUTPUT_DIR || process.env.KGEN_OUTPUT_DIR || './dist',
  STATE_DIR: process.env.STATE_DIR || process.env.KGEN_STATE_DIR || './.kgen/state',
  CACHE_DIR: process.env.CACHE_DIR || process.env.KGEN_CACHE_DIR || './.kgen/cache',
  TEMPLATES_DIR: process.env.TEMPLATES_DIR || process.env.KGEN_TEMPLATES_DIR || './templates',
  RULES_DIR: process.env.RULES_DIR || process.env.KGEN_RULES_DIR || './rules',
  
  // Server Configuration (replaces hardcoded localhost URLs)
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '3000'}`,
  
  // SPARQL Configuration (replaces hardcoded endpoints)
  SPARQL_ENDPOINT: process.env.SPARQL_ENDPOINT || 'http://localhost:3030/ds/sparql',
  SPARQL_UPDATE_ENDPOINT: process.env.SPARQL_UPDATE_ENDPOINT || 'http://localhost:3030/ds/update',
  SPARQL_TIMEOUT: parseInt(process.env.SPARQL_TIMEOUT || '30000', 10),
  SPARQL_MAX_RESULTS: parseInt(process.env.SPARQL_MAX_RESULTS || '10000', 10),
  
  // RDF/Semantic Configuration (replaces hardcoded namespaces)
  BASE_URI: process.env.BASE_URI || process.env.KGEN_BASE_URI || 'http://kgen.io/',
  ONTOLOGY_URI: process.env.ONTOLOGY_URI || process.env.KGEN_ONTOLOGY_URI || 'http://kgen.io/ontology/',
  DATA_URI: process.env.DATA_URI || process.env.KGEN_DATA_URI || 'http://kgen.io/data/',
  
  // Replace example.org URIs with configurable namespaces
  GDPR_NAMESPACE: process.env.GDPR_NAMESPACE || 'http://kgen.io/gdpr/',
  HIPAA_NAMESPACE: process.env.HIPAA_NAMESPACE || 'http://kgen.io/hipaa/',
  SOX_NAMESPACE: process.env.SOX_NAMESPACE || 'http://kgen.io/sox/',
  ISO_NAMESPACE: process.env.ISO_NAMESPACE || 'http://kgen.io/iso27001/',
  
  // Performance Configuration (replaces hardcoded limits)
  MAX_TRIPLES: parseInt(process.env.MAX_TRIPLES || '10000000', 10),
  REASONING_TIMEOUT: parseInt(process.env.REASONING_TIMEOUT || '60000', 10),
  CACHE_SIZE: process.env.CACHE_SIZE || '500MB',
  MEMORY_LIMIT: parseInt(process.env.MEMORY_LIMIT || '2048', 10), // MB
  MAX_GRAPH_SIZE: parseInt(process.env.MAX_GRAPH_SIZE || '1000000', 10),
  
  // Worker Configuration (fixes disabled workers)
  ENABLE_WORKERS: process.env.ENABLE_WORKERS !== 'false',
  WORKER_COUNT: parseInt(process.env.WORKER_COUNT || '4', 10),
  WORKER_TIMEOUT: parseInt(process.env.WORKER_TIMEOUT || '30000', 10),
  
  // Security Configuration (enables by default)
  ENABLE_SECURITY: process.env.ENABLE_SECURITY !== 'false',
  ENABLE_ENCRYPTION: process.env.ENABLE_ENCRYPTION !== 'false',
  ENABLE_DIGITAL_SIGNATURES: process.env.ENABLE_DIGITAL_SIGNATURES !== 'false',
  ENABLE_BLOCKCHAIN: process.env.ENABLE_BLOCKCHAIN === 'true', // Opt-in for blockchain
  
  // Cryptographic Configuration
  PRIVATE_KEY_PATH: process.env.PRIVATE_KEY_PATH || process.env.KGEN_PRIVATE_KEY_PATH,
  CERTIFICATE_PATH: process.env.CERTIFICATE_PATH || process.env.KGEN_CERTIFICATE_PATH,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || process.env.KGEN_ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET || process.env.KGEN_JWT_SECRET,
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_POOL_MIN: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL,
  REDIS_PREFIX: process.env.REDIS_PREFIX || 'kgen:',
  
  // Monitoring Configuration
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
  METRICS_ENDPOINT: process.env.METRICS_ENDPOINT,
  METRICS_INTERVAL: parseInt(process.env.METRICS_INTERVAL || '60000', 10),
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  LOG_FORMAT: process.env.LOG_FORMAT || 'json',
  
  // External Services (replaces mock integrations)
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL,
  BLOCKCHAIN_PROVIDER_URL: process.env.BLOCKCHAIN_PROVIDER_URL,
  BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
  
  // Compliance Configuration
  COMPLIANCE_MODE: process.env.COMPLIANCE_MODE || 'GDPR',
  AUDIT_RETENTION: process.env.AUDIT_RETENTION || '7years',
  ENABLE_AUDIT_ENCRYPTION: process.env.ENABLE_AUDIT_ENCRYPTION !== 'false',
  
  // CI/CD Detection
  IS_CI: process.env.CI === 'true' || 
         process.env.GITHUB_ACTIONS === 'true' || 
         process.env.GITLAB_CI === 'true' ||
         process.env.JENKINS === 'true',
  
  // Health Check Configuration
  HEALTH_CHECK_PATH: process.env.HEALTH_CHECK_PATH || '/health',
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  
  // Rate Limiting Configuration
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  
  // Graceful Shutdown
  SHUTDOWN_TIMEOUT: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10),
};

/**
 * Get required environment variable or throw error
 * @param {string} name - Environment variable name
 * @returns {string} Environment variable value
 * @throws {Error} If required variable is not set
 */
export function getRequired(name) {
  const value = env[name] || process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Validate environment configuration
 * @throws {Error} If configuration is invalid
 */
export function validateEnvironment() {
  const errors = [];
  
  // Validate production requirements
  if (env.IS_PRODUCTION) {
    if (!env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    }
    if (!env.ENCRYPTION_KEY) {
      errors.push('ENCRYPTION_KEY is required in production');
    }
    if (!env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production');
    }
    if (env.LOG_LEVEL === 'debug') {
      errors.push('LOG_LEVEL should not be debug in production');
    }
  }
  
  // Validate security settings
  if (env.ENABLE_DIGITAL_SIGNATURES && !env.PRIVATE_KEY_PATH) {
    errors.push('PRIVATE_KEY_PATH is required when digital signatures are enabled');
  }
  
  if (env.ENABLE_BLOCKCHAIN && !env.BLOCKCHAIN_PROVIDER_URL) {
    errors.push('BLOCKCHAIN_PROVIDER_URL is required when blockchain is enabled');
  }
  
  // Validate SPARQL configuration
  if (env.SPARQL_TIMEOUT < 1000) {
    errors.push('SPARQL_TIMEOUT should be at least 1000ms');
  }
  
  if (env.SPARQL_MAX_RESULTS < 1) {
    errors.push('SPARQL_MAX_RESULTS must be positive');
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration for specific module
 * @param {string} module - Module name
 * @returns {Object} Module-specific configuration
 */
export function getModuleConfig(module) {
  switch (module) {
    case 'sparql':
      return {
        endpoint: env.SPARQL_ENDPOINT,
        updateEndpoint: env.SPARQL_UPDATE_ENDPOINT,
        timeout: env.SPARQL_TIMEOUT,
        maxResults: env.SPARQL_MAX_RESULTS,
      };
    
    case 'security':
      return {
        enabled: env.ENABLE_SECURITY,
        encryption: env.ENABLE_ENCRYPTION,
        signatures: env.ENABLE_DIGITAL_SIGNATURES,
        blockchain: env.ENABLE_BLOCKCHAIN,
        privateKeyPath: env.PRIVATE_KEY_PATH,
        certificatePath: env.CERTIFICATE_PATH,
      };
    
    case 'performance':
      return {
        maxTriples: env.MAX_TRIPLES,
        reasoningTimeout: env.REASONING_TIMEOUT,
        cacheSize: env.CACHE_SIZE,
        memoryLimit: env.MEMORY_LIMIT,
        enableWorkers: env.ENABLE_WORKERS,
        workerCount: env.WORKER_COUNT,
      };
    
    case 'compliance':
      return {
        mode: env.COMPLIANCE_MODE,
        gdprNamespace: env.GDPR_NAMESPACE,
        hipaaNamespace: env.HIPAA_NAMESPACE,
        soxNamespace: env.SOX_NAMESPACE,
        isoNamespace: env.ISO_NAMESPACE,
        auditRetention: env.AUDIT_RETENTION,
        auditEncryption: env.ENABLE_AUDIT_ENCRYPTION,
      };
    
    default:
      return {};
  }
}

export default env;