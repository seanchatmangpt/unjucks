/**
 * Simple Configuration System for Unjucks v3
 * Production-ready configuration without complex dependencies
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as confbox from 'confbox';

/**
 * Default configuration for Unjucks
 */
const DEFAULT_CONFIG = {
  templates: {
    dir: '_templates',
    searchPaths: ['_templates', 'templates', '.templates'],
    extensions: ['.njk', '.nunjucks', '.hbs', '.handlebars']
  },
  engine: {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true
  },
  cli: {
    colors: true,
    verbose: false,
    interactive: true
  },
  performance: {
    enableCaching: true,
    maxCacheSize: 100,
    enableProfiling: false
  }
};

/**
 * Load configuration from file system
 * @param {string} configName - Base config file name
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfigFromFile(configName, cwd) {
  const configFiles = [
    `${configName}.js`,
    `${configName}.mjs`,
    `${configName}.json`,
    `${configName}.yml`,
    `${configName}.yaml`
  ];
  
  for (const file of configFiles) {
    const filePath = join(cwd, file);
    if (existsSync(filePath)) {
      try {
        if (file.endsWith('.json')) {
          const content = await readFile(filePath, 'utf8');
          return JSON.parse(content);
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          const content = await readFile(filePath, 'utf8');
          return confbox.parseYAML(content);
        } else {
          const config = await import(filePath);
          return config.default || config;
        }
      } catch (error) {
        console.warn(`Failed to load config from ${file}:`, error.message);
      }
    }
  }
  return {};
}

/**
 * Load environment-based configuration
 * @returns {Object} Environment configuration
 */
function loadEnvConfig() {
  const envConfig = {};
  const prefix = 'UNJUCKS_';
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix)) {
      const configKey = key.slice(prefix.length).toLowerCase();
      envConfig[configKey] = value;
    }
  }
  
  return envConfig;
}

/**
 * Load and merge configuration from all sources
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Merged configuration
 */
export async function loadUnjucksConfig(options = {}) {
  const {
    configName = 'unjucks.config',
    cwd = process.cwd(),
    defaults = {},
    overrides = {}
  } = options;

  const fileConfig = await loadConfigFromFile(configName, cwd);
  const envConfig = loadEnvConfig();

  return {
    ...DEFAULT_CONFIG,
    ...defaults,
    ...fileConfig,
    ...envConfig,
    ...overrides
  };
}

/**
 * Get current configuration (cached)
 */
let cachedConfig = null;

export function getConfig() {
  return cachedConfig || DEFAULT_CONFIG;
}

export function setConfig(config) {
  cachedConfig = config;
}