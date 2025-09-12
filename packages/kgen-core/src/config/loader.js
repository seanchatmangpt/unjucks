/**
 * KGEN Configuration Loader using c12
 * Provides unified configuration loading with support for multiple formats
 * and environment-specific overrides.
 */

import { loadConfig } from 'c12';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfigSchema } from './schema.js';
import { validateConfig } from './validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Default KGEN configuration
 */
export const defaultConfig = {
  // Directory structure
  directories: {
    out: './dist',
    state: './.kgen/state',
    cache: './.kgen/cache',
    templates: './templates',
    rules: './rules'
  },

  // Generation settings
  generate: {
    defaultTemplate: 'basic',
    globalVars: {},
    attestByDefault: true,
    cleanOutput: false,
    parallel: true,
    maxConcurrency: 4
  },

  // Reasoning configuration
  reasoning: {
    enabled: true,
    defaultRules: ['basic', 'validation'],
    maxDepth: 10,
    timeout: 30000
  },

  // Provenance tracking
  provenance: {
    engineId: 'kgen-core',
    include: ['templates', 'rules', 'data', 'config'],
    trackDependencies: true,
    generateAttestation: true,
    signingKey: null
  },

  // Drift detection
  drift: {
    onDrift: 'warn', // 'warn', 'error', 'ignore'
    exitCode: 1,
    autoFix: false,
    backup: true
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour in ms
    gcInterval: 300000, // 5 minutes in ms
    maxSize: '100MB',
    strategy: 'lru' // 'lru', 'fifo', 'ttl'
  },

  // Metrics and monitoring
  metrics: {
    enabled: true,
    logFields: ['timestamp', 'operation', 'duration', 'success'],
    exportFormat: 'json', // 'json', 'csv', 'prometheus'
    retention: 30 // days
  },

  // Security settings
  security: {
    sandbox: true,
    allowedModules: ['@kgen/*', 'lodash', 'date-fns'],
    maxMemory: '512MB',
    maxExecutionTime: 60000
  },

  // Development options
  dev: {
    watch: false,
    hotReload: false,
    debugMode: false,
    verbose: false
  }
};

/**
 * Load KGEN configuration with c12
 * @param {Object} options - Loading options
 * @param {string} options.cwd - Current working directory
 * @param {string} options.configFile - Specific config file path
 * @param {Object} options.overrides - Configuration overrides
 * @param {boolean} options.validate - Whether to validate config (default: true)
 * @returns {Promise<Object>} Resolved configuration
 */
export async function loadKgenConfig(options = {}) {
  const {
    cwd = process.cwd(),
    configFile = null,
    overrides = {},
    validate = true
  } = options;

  try {
    // Use c12 to load configuration
    const { config, configFile: resolvedConfigFile, layers } = await loadConfig({
      name: 'kgen',
      cwd,
      configFile,
      defaults: defaultConfig,
      overrides,
      // Support multiple formats
      dotenv: true,
      globalRc: true,
      // Config file patterns to search for
      rcFile: '.kgenrc',
      packageJson: 'kgen'
    });

    // Validate configuration if requested
    if (validate) {
      const validationResult = await validateConfig(config);
      if (!validationResult.success) {
        throw new Error(`Configuration validation failed: ${validationResult.error.message}`);
      }
    }

    // Ensure directories exist
    await ensureDirectories(config.directories, cwd);

    return {
      config,
      configFile: resolvedConfigFile,
      layers,
      meta: {
        loadedFrom: resolvedConfigFile || 'defaults',
        validated: validate,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new Error(`Failed to load KGEN configuration: ${error.message}`);
  }
}

/**
 * Ensure all configured directories exist
 * @private
 */
async function ensureDirectories(directories, cwd) {
  const { mkdirp } = await import('mkdirp');
  
  for (const [key, dir] of Object.entries(directories)) {
    if (dir && typeof dir === 'string') {
      const fullPath = join(cwd, dir);
      await mkdirp(fullPath);
    }
  }
}

/**
 * Merge configuration objects with proper precedence
 * @param {Object} base - Base configuration
 * @param {Object} override - Override configuration
 * @returns {Object} Merged configuration
 */
export function mergeConfigs(base, override) {
  if (!override) return base;
  if (!base) return override;

  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'object' && !Array.isArray(value) && 
        typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = mergeConfigs(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Get configuration for specific environment
 * @param {Object} config - Base configuration
 * @param {string} env - Environment name (development, production, test)
 * @returns {Object} Environment-specific configuration
 */
export function getEnvConfig(config, env = 'development') {
  const envConfig = config[env] || {};
  const baseConfig = { ...config };
  
  // Remove environment-specific configs from base
  delete baseConfig.development;
  delete baseConfig.production;
  delete baseConfig.test;

  return mergeConfigs(baseConfig, envConfig);
}

/**
 * Create configuration watcher
 * @param {string} configFile - Configuration file path
 * @param {Function} callback - Callback for configuration changes
 * @returns {Function} Cleanup function
 */
export function watchConfig(configFile, callback) {
  const { watchFile, unwatchFile } = await import('node:fs');
  
  watchFile(configFile, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      callback();
    }
  });

  return () => unwatchFile(configFile);
}

/**
 * Export configuration to different formats
 * @param {Object} config - Configuration object
 * @param {string} format - Export format ('json', 'yaml', 'js')
 * @returns {string} Serialized configuration
 */
export function exportConfig(config, format = 'json') {
  switch (format) {
    case 'json':
      return JSON.stringify(config, null, 2);
    
    case 'yaml': {
      const { stringify } = await import('yaml');
      return stringify(config);
    }
    
    case 'js':
      return `export default ${JSON.stringify(config, null, 2)};`;
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}