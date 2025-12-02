/**
 * Git-First Config Loader
 * 
 * Implements single source of truth configuration loading with:
 * - Project root only resolution (no cascading)
 * - Environment-aware configuration merging
 * - Schema validation and type safety
 * - Git integration for tracking changes
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { findUp } from 'find-up';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Configuration file names to search for (in priority order)
 */
const CONFIG_FILES = [
  'kgen.config.js',
  'kgen.config.mjs',
  'kgen.config.json',
  '.kgenrc.js',
  '.kgenrc.json'
];

/**
 * Default configuration structure
 */
const DEFAULT_CONFIG = {
  version: '1.0.0',
  directories: {
    out: './dist',
    state: './.kgen/state',
    cache: './.kgen/cache',
    templates: './templates',
    rules: './rules'
  },
  generate: {
    defaultTemplate: 'basic',
    globalVars: {},
    attestByDefault: true,
    parallel: true,
    maxConcurrency: 4
  },
  drift: {
    onDrift: 'warn',
    exitCode: 1,
    autoFix: false,
    backup: true
  },
  cache: {
    enabled: true,
    ttl: 3600000,
    strategy: 'lru'
  },
  metrics: {
    enabled: false,
    logFields: ['timestamp', 'operation', 'duration', 'success'],
    exportFormat: 'json'
  }
};

/**
 * Git-first configuration loader class
 */
export class ConfigLoader {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || process.env.NODE_ENV || 'development';
    this.cache = new Map();
    this.watchCallbacks = new Set();
  }

  /**
   * Load configuration from project root only (no cascading)
   * @param {string} [startDir] - Starting directory for search
   * @returns {Promise<Object>} Resolved configuration
   */
  async load(startDir = this.cwd) {
    const cacheKey = `${startDir}:${this.env}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Find project root (where config file exists)
    const projectRoot = await this.findProjectRoot(startDir);
    if (!projectRoot) {
      throw new Error('No kgen configuration file found in project hierarchy');
    }

    // Load and resolve configuration
    const config = await this.loadConfigFile(projectRoot);
    const resolvedConfig = this.resolveConfig(config, projectRoot);
    
    // Add metadata
    resolvedConfig._meta = {
      projectRoot,
      configPath: this.getConfigPath(projectRoot),
      loadedAt: new Date().toISOString(),
      environment: this.env,
      hash: this.getConfigHash(resolvedConfig)
    };

    this.cache.set(cacheKey, resolvedConfig);
    return resolvedConfig;
  }

  /**
   * Find project root by looking for config file
   * @param {string} startDir - Starting directory
   * @returns {Promise<string|null>} Project root path or null
   */
  async findProjectRoot(startDir) {
    for (const configFile of CONFIG_FILES) {
      const found = await findUp(configFile, { cwd: startDir });
      if (found) {
        return dirname(found);
      }
    }
    return null;
  }

  /**
   * Get config file path for project root
   * @param {string} projectRoot - Project root directory
   * @returns {string|null} Config file path or null
   */
  getConfigPath(projectRoot) {
    for (const configFile of CONFIG_FILES) {
      const configPath = join(projectRoot, configFile);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    return null;
  }

  /**
   * Load configuration file from project root
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Raw configuration
   */
  async loadConfigFile(projectRoot) {
    const configPath = this.getConfigPath(projectRoot);
    if (!configPath) {
      throw new Error(`No configuration file found in project root: ${projectRoot}`);
    }

    try {
      if (configPath.endsWith('.json')) {
        const content = readFileSync(configPath, 'utf8');
        return JSON.parse(content);
      } else {
        // Dynamic import for .js/.mjs files
        const configUrl = new URL(`file://${configPath}`);
        const module = await import(configUrl.href);
        return module.default || module;
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Resolve configuration with environment overrides and defaults
   * @param {Object} config - Raw configuration
   * @param {string} projectRoot - Project root directory
   * @returns {Object} Resolved configuration
   */
  resolveConfig(config, projectRoot) {
    // Start with default config
    let resolved = this.deepMerge({}, DEFAULT_CONFIG);
    
    // Merge base config
    resolved = this.deepMerge(resolved, config);
    
    // Apply environment-specific overrides
    if (config.environments && config.environments[this.env]) {
      resolved = this.deepMerge(resolved, config.environments[this.env]);
    }
    
    // Resolve relative paths to absolute
    this.resolvePaths(resolved, projectRoot);
    
    return resolved;
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Resolve relative paths to absolute paths
   * @param {Object} config - Configuration object
   * @param {string} projectRoot - Project root directory
   */
  resolvePaths(config, projectRoot) {
    if (config.directories) {
      for (const [key, path] of Object.entries(config.directories)) {
        if (typeof path === 'string' && !resolve(path).startsWith('/')) {
          config.directories[key] = resolve(projectRoot, path);
        }
      }
    }
  }

  /**
   * Get configuration hash for tracking changes
   * @param {Object} config - Configuration object
   * @returns {string} SHA-256 hash
   */
  getConfigHash(config) {
    // Clone and remove metadata to get stable hash
    const cleanConfig = { ...config };
    delete cleanConfig._meta;
    
    const content = JSON.stringify(cleanConfig, Object.keys(cleanConfig).sort());
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get Git information for configuration tracking
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Git information
   */
  async getGitInfo(projectRoot) {
    try {
      const [commitResult, branchResult] = await Promise.all([
        execAsync('git rev-parse HEAD', { cwd: projectRoot }),
        execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot })
      ]);
      
      return {
        commit: commitResult.stdout.trim(),
        branch: branchResult.stdout.trim(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        commit: null,
        branch: null,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validate(config) {
    const errors = [];
    const warnings = [];
    
    // Basic structure validation
    if (!config.directories) {
      errors.push('Missing required "directories" configuration');
    }
    
    if (config.drift && !['warn', 'error', 'ignore'].includes(config.drift.onDrift)) {
      errors.push('drift.onDrift must be one of: warn, error, ignore');
    }
    
    // Path validation
    if (config.directories) {
      for (const [key, path] of Object.entries(config.directories)) {
        if (typeof path !== 'string') {
          errors.push(`directories.${key} must be a string path`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get configuration file stats
   * @param {string} projectRoot - Project root directory
   * @returns {Object} File statistics
   */
  getConfigStats(projectRoot) {
    const configPath = this.getConfigPath(projectRoot);
    if (!configPath) {
      return null;
    }
    
    const stats = statSync(configPath);
    return {
      path: configPath,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString()
    };
  }
}

/**
 * Default configuration loader instance
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load configuration
 * @param {Object} options - Loader options
 * @returns {Promise<Object>} Configuration
 */
export async function loadConfig(options = {}) {
  const loader = new ConfigLoader(options);
  return loader.load();
}
