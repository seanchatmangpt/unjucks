/**
 * Configuration utilities for KGEN CLI
 * Handles loading and parsing of kgen.config.js files
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { pathToFileURL } from 'url';

// Default configuration
export const defaultConfig = {
  project: {
    name: 'kgen-project',
    version: '1.0.0'
  },
  directories: {
    out: './out',
    state: './.kgen/state',
    cache: './.kgen/cache',
    templates: './templates',
    rules: './rules'
  },
  generate: {
    defaultTemplate: null,
    globalVars: {},
    attestByDefault: true,
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    }
  },
  reasoning: {
    enabled: false,
    defaultRules: null
  },
  provenance: {
    engineId: 'kgen',
    include: {
      timestamp: true,
      engineVersion: true
    }
  },
  impact: {
    defaultReportType: 'subjects',
    ignore: {
      blankNodes: true,
      predicates: []
    }
  },
  drift: {
    onDrift: 'fail',
    exitCode: 3
  },
  cache: {
    gc: {
      strategy: 'lru',
      maxAge: '90d',
      maxSize: '5GB'
    }
  },
  metrics: {
    enabled: true,
    logFields: [
      'timestamp',
      'command',
      'graphHash',
      'template',
      'filesGenerated',
      'triplesIn',
      'triplesOut',
      'obligations',
      'cacheHit',
      'durationMs',
      'driftDetected'
    ]
  },
  plugins: []
};

/**
 * Load configuration from file or use defaults
 * @param {string} configPath - Path to config file
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(configPath = null) {
  let config = { ...defaultConfig };
  
  // Try to find config file
  const possiblePaths = configPath 
    ? [configPath]
    : [
        './kgen.config.js',
        './kgen.config.mjs',
        './.kgen/config.js',
        './.kgen/config.mjs'
      ];
      
  let configFile = null;
  for (const path of possiblePaths) {
    const fullPath = resolve(path);
    if (existsSync(fullPath)) {
      configFile = fullPath;
      break;
    }
  }
  
  if (configFile) {
    try {
      // Dynamic import for ES modules
      const configUrl = pathToFileURL(configFile).href;
      const configModule = await import(configUrl);
      const loadedConfig = configModule.default || configModule;
      
      // Deep merge configuration
      config = mergeConfig(config, loadedConfig);
      
      // Resolve relative paths
      config = resolveConfigPaths(config, configFile);
      
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configFile}: ${error.message}`);
    }
  }
  
  return config;
}

/**
 * Deep merge two configuration objects
 * @param {Object} base - Base configuration
 * @param {Object} override - Override configuration  
 * @returns {Object} Merged configuration
 */
function mergeConfig(base, override) {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfig(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Resolve relative paths in configuration
 * @param {Object} config - Configuration object
 * @param {string} configFile - Path to config file
 * @returns {Object} Configuration with resolved paths
 */
function resolveConfigPaths(config, configFile) {
  const configDir = resolve(configFile, '..');
  const result = { ...config };
  
  // Resolve directory paths
  if (result.directories) {
    const dirs = {};
    for (const [key, path] of Object.entries(result.directories)) {
      dirs[key] = resolve(configDir, path);
    }
    result.directories = dirs;
  }
  
  return result;
}

/**
 * Validate configuration structure
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  const required = [
    'project.name',
    'directories.out',
    'directories.state',
    'directories.cache',
    'directories.templates',
    'directories.rules'
  ];
  
  for (const path of required) {
    const value = getNestedValue(config, path);
    if (!value) {
      throw new Error(`Missing required configuration: ${path}`);
    }
  }
  
  // Validate drift action
  const validDriftActions = ['fail', 'warn', 'fix'];
  if (!validDriftActions.includes(config.drift?.onDrift)) {
    throw new Error(`Invalid drift.onDrift value. Must be one of: ${validDriftActions.join(', ')}`);
  }
  
  // Validate cache strategy
  const validCacheStrategies = ['lru', 'fifo'];
  if (config.cache?.gc?.strategy && !validCacheStrategies.includes(config.cache.gc.strategy)) {
    throw new Error(`Invalid cache.gc.strategy value. Must be one of: ${validCacheStrategies.join(', ')}`);
  }
}

/**
 * Get nested object value by path
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path
 * @returns {any} Value at path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Create directories from configuration
 * @param {Object} config - Configuration object
 */
export async function ensureDirectories(config) {
  const { mkdir } = await import('fs/promises');
  
  const dirs = [
    config.directories.out,
    config.directories.state,
    config.directories.cache,
    config.directories.templates,
    config.directories.rules
  ];
  
  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create directory ${dir}: ${error.message}`);
      }
    }
  }
}

export default {
  loadConfig,
  validateConfig,
  ensureDirectories,
  defaultConfig
};