/**
 * KGEN Core Configuration System
 * 
 * c12-based configuration loading with comprehensive schema support,
 * environment merging, and validation for KGEN knowledge compilation.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import { loadConfig, watchConfig } from 'c12';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import Joi from 'joi';
import { defaultConfig } from './defaults.js';
import { configSchema } from './schemas/index.js';
import { validateConfiguration } from './validators/index.js';
import { createConfigTypes } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * KGEN Configuration Manager
 * 
 * Provides c12-based configuration loading with:
 * - Environment variable merging
 * - Schema validation
 * - Type safety
 * - IDE autocomplete support
 * - Configuration file discovery
 */
export class KGenConfigManager {
  constructor(options = {}) {
    this.options = {
      configName: 'kgen.config',
      globalRc: true,
      dotenv: true,
      envPrefix: 'KGEN_',
      defaultConfig,
      ...options
    };
    
    this.cache = new Map();
    this.watchers = new Map();
  }

  /**
   * Load configuration with c12 and apply validation
   * 
   * @param {Object} options - Loading options
   * @param {string} [options.cwd] - Working directory
   * @param {string} [options.configFile] - Specific config file path
   * @param {Object} [options.overrides] - Configuration overrides
   * @param {boolean} [options.validate=true] - Enable validation
   * @param {boolean} [options.cache=true] - Enable caching
   * @returns {Promise<Object>} Resolved configuration
   */
  async load(options = {}) {
    const {
      cwd = process.cwd(),
      configFile,
      overrides = {},
      validate = true,
      cache = true
    } = options;

    const cacheKey = JSON.stringify({ cwd, configFile, overrides });
    
    if (cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Load configuration using c12
      const { config, configFile: resolvedConfigFile } = await loadConfig({
        name: this.options.configName,
        cwd,
        configFile,
        globalRc: this.options.globalRc,
        dotenv: this.options.dotenv,
        envPrefix: this.options.envPrefix,
        defaults: this.options.defaultConfig,
        overrides
      });

      // Merge with defaults and resolve paths
      const resolvedConfig = this._resolveConfiguration(config, cwd);
      
      // Validate configuration if enabled
      if (validate) {
        await this._validateConfiguration(resolvedConfig);
      }

      // Generate TypeScript types if needed
      if (resolvedConfig.dev?.generateTypes) {
        await this._generateTypes(resolvedConfig, cwd);
      }

      // Cache resolved configuration
      if (cache) {
        this.cache.set(cacheKey, {
          ...resolvedConfig,
          _meta: {
            configFile: resolvedConfigFile,
            loadedAt: new Date().toISOString(),
            cwd
          }
        });
      }

      return resolvedConfig;

    } catch (error) {
      throw new Error(`Failed to load KGEN configuration: ${error.message}`);
    }
  }

  /**
   * Create a configuration loader with pre-configured options
   * 
   * @param {Object} options - Loader options
   * @returns {Function} Configuration loader function
   */
  createLoader(options = {}) {
    const mergedOptions = { ...this.options, ...options };
    
    return createConfigLoader({
      name: mergedOptions.configName,
      defaults: mergedOptions.defaultConfig,
      globalRc: mergedOptions.globalRc,
      dotenv: mergedOptions.dotenv,
      envPrefix: mergedOptions.envPrefix
    });
  }

  /**
   * Watch configuration for changes
   * 
   * @param {Object} options - Watch options
   * @param {Function} callback - Change callback
   * @returns {Function} Unwatch function
   */
  async watch(options = {}, callback) {
    const { cwd = process.cwd() } = options;
    const configFiles = await this._findConfigFiles(cwd);
    
    const chokidar = await import('chokidar');
    const watcher = chokidar.default.watch(configFiles, {
      ignoreInitial: true,
      persistent: true
    });

    const handleChange = async () => {
      try {
        this.cache.clear();
        const newConfig = await this.load(options);
        callback(null, newConfig);
      } catch (error) {
        callback(error, null);
      }
    };

    watcher.on('change', handleChange);
    watcher.on('add', handleChange);
    watcher.on('unlink', handleChange);

    const watcherId = `${cwd}:${Date.now()}`;
    this.watchers.set(watcherId, watcher);

    return () => {
      watcher.close();
      this.watchers.delete(watcherId);
    };
  }

  /**
   * Resolve relative paths and apply configuration processing
   * 
   * @private
   * @param {Object} config - Raw configuration
   * @param {string} cwd - Working directory
   * @returns {Object} Resolved configuration
   */
  _resolveConfiguration(config, cwd) {
    const resolved = { ...config };

    // Resolve directory paths
    if (resolved.directories) {
      for (const [key, value] of Object.entries(resolved.directories)) {
        if (typeof value === 'string' && !resolve(value).startsWith('/')) {
          resolved.directories[key] = resolve(cwd, value);
        }
      }
    }

    // Process environment-specific configurations
    const env = process.env.NODE_ENV || 'development';
    if (resolved.environments?.[env]) {
      Object.assign(resolved, resolved.environments[env]);
    }

    // Apply conditional configurations
    this._applyConditionalConfig(resolved);

    return resolved;
  }

  /**
   * Apply conditional configurations based on runtime conditions
   * 
   * @private
   * @param {Object} config - Configuration to modify
   */
  _applyConditionalConfig(config) {
    // Enable development features
    if (process.env.NODE_ENV === 'development') {
      config.cache = config.cache || {};
      config.cache.enabled = config.cache.enabled ?? true;
      config.metrics = config.metrics || {};
      config.metrics.enabled = config.metrics.enabled ?? true;
    }

    // Production optimizations
    if (process.env.NODE_ENV === 'production') {
      config.reasoning = config.reasoning || {};
      config.reasoning.optimization = config.reasoning.optimization ?? 'aggressive';
      config.cache = config.cache || {};
      config.cache.gc = config.cache.gc || {};
      config.cache.gc.strategy = config.cache.gc.strategy || 'lru';
    }

    // CI/CD environment adjustments
    if (process.env.CI === 'true') {
      config.drift = config.drift || {};
      config.drift.onDrift = config.drift.onDrift || 'fail';
      config.metrics = config.metrics || {};
      config.metrics.enabled = true;
    }
  }

  /**
   * Validate configuration using Joi schema
   * 
   * @private
   * @param {Object} config - Configuration to validate
   */
  async _validateConfiguration(config) {
    try {
      await validateConfiguration(config);
    } catch (error) {
      if (error.isJoi) {
        const details = error.details.map(d => `  - ${d.path.join('.')}: ${d.message}`).join('\n');
        throw new Error(`Configuration validation failed:\n${details}`);
      }
      throw error;
    }
  }

  /**
   * Generate TypeScript definition files
   * 
   * @private
   * @param {Object} config - Configuration object
   * @param {string} cwd - Working directory
   */
  async _generateTypes(config, cwd) {
    try {
      await createConfigTypes(config, {
        outputDir: resolve(cwd, '.kgen'),
        includeComments: true,
        exportDefault: true
      });
    } catch (error) {
      console.warn(`Failed to generate TypeScript types: ${error.message}`);
    }
  }

  /**
   * Find all potential configuration files
   * 
   * @private
   * @param {string} cwd - Working directory
   * @returns {Promise<string[]>} Array of config file paths
   */
  async _findConfigFiles(cwd) {
    const configFiles = [
      'kgen.config.js',
      'kgen.config.mjs',
      'kgen.config.ts',
      'kgen.config.json',
      '.kgenrc',
      '.kgenrc.json',
      '.kgenrc.js'
    ].map(name => resolve(cwd, name))
     .filter(existsSync);

    return configFiles;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    // Clear cache
    this.cache.clear();
  }
}

// Default configuration manager instance
export const configManager = new KGenConfigManager();

/**
 * Load KGEN configuration (convenience function)
 * 
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Configuration object
 */
export async function loadKGenConfig(options = {}) {
  return await configManager.load(options);
}

/**
 * Create configuration with type helpers
 * 
 * @param {Object} config - Configuration object
 * @returns {Object} Configuration with type helpers
 */
export function defineKGenConfig(config) {
  return config;
}

/**
 * Export configuration schema for external validation
 */
export { configSchema } from './schemas/index.js';
export { defaultConfig } from './defaults.js';
export { validateConfiguration } from './validators/index.js';
