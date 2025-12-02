/**
 * Registry configuration management system
 * Handles multiple registry configurations, authentication, and fallback strategies
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';

export class RegistryConfigError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryConfigError';
    this.code = code;
  }
}

export class RegistryConfig extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.configPath = options.configPath || join(process.cwd(), '.kgen', 'registry-config.json');
    this.globalConfigPath = options.globalConfigPath || join(homedir(), '.kgen', 'registry-config.json');
    this.schemaVersion = '1.0.0';
    
    this.config = null;
    this.loaded = false;
  }

  /**
   * Load configuration from file system
   * @param {boolean} force - Force reload even if already loaded
   * @returns {Promise<Object>} Configuration object
   */
  async load(force = false) {
    if (this.loaded && !force) {
      return this.config;
    }

    try {
      // Try local config first, then global
      let configData = null;
      let configSource = null;

      try {
        await access(this.configPath);
        configData = await readFile(this.configPath, 'utf8');
        configSource = 'local';
      } catch (error) {
        try {
          await access(this.globalConfigPath);
          configData = await readFile(this.globalConfigPath, 'utf8');
          configSource = 'global';
        } catch (globalError) {
          // No config found, use defaults
          this.config = this.getDefaultConfig();
          this.loaded = true;
          this.emit('loaded', { source: 'default', config: this.config });
          return this.config;
        }
      }

      this.config = JSON.parse(configData);
      this.validateConfig(this.config);
      this.loaded = true;
      
      this.emit('loaded', { source: configSource, config: this.config });
      return this.config;
    } catch (error) {
      this.emit('error', { operation: 'load', error });
      throw new RegistryConfigError(`Failed to load config: ${error.message}`, 'LOAD_FAILED');
    }
  }

  /**
   * Save configuration to file system
   * @param {boolean} global - Save to global config instead of local
   * @returns {Promise<void>}
   */
  async save(global = false) {
    if (!this.config) {
      throw new RegistryConfigError('No configuration to save', 'NO_CONFIG');
    }

    try {
      const targetPath = global ? this.globalConfigPath : this.configPath;
      const configDir = dirname(targetPath);
      
      // Ensure directory exists
      await mkdir(configDir, { recursive: true });
      
      // Add metadata
      const configWithMeta = {
        ...this.config,
        schemaVersion: this.schemaVersion,
        lastModified: new Date().toISOString()
      };
      
      await writeFile(targetPath, JSON.stringify(configWithMeta, null, 2));
      
      this.emit('saved', { target: global ? 'global' : 'local', path: targetPath });
    } catch (error) {
      this.emit('error', { operation: 'save', error });
      throw new RegistryConfigError(`Failed to save config: ${error.message}`, 'SAVE_FAILED');
    }
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      schemaVersion: this.schemaVersion,
      registries: {
        npm: {
          type: 'npm',
          name: 'npm',
          baseUrl: 'https://registry.npmjs.org',
          priority: 1,
          enabled: true,
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          features: ['publish', 'search', 'download'],
          auth: {
            type: 'token',
            tokenEnv: 'NPM_TOKEN'
          }
        },
        github: {
          type: 'git',
          name: 'github',
          baseUrl: 'https://github.com',
          priority: 2,
          enabled: false,
          timeout: 60000,
          retryAttempts: 3,
          retryDelay: 2000,
          features: ['publish', 'search', 'download'],
          auth: {
            type: 'token',
            tokenEnv: 'GITHUB_TOKEN'
          },
          options: {
            organization: null,
            branch: 'main',
            packageDir: 'packages'
          }
        },
        docker: {
          type: 'oci',
          name: 'docker',
          baseUrl: 'https://registry-1.docker.io',
          priority: 3,
          enabled: false,
          timeout: 60000,
          retryAttempts: 3,
          retryDelay: 2000,
          features: ['publish', 'download'],
          auth: {
            type: 'credentials',
            usernameEnv: 'DOCKER_USERNAME',
            passwordEnv: 'DOCKER_PASSWORD'
          },
          options: {
            namespace: 'library'
          }
        },
        ipfs: {
          type: 'ipfs',
          name: 'ipfs',
          baseUrl: 'http://127.0.0.1:5001',
          priority: 4,
          enabled: false,
          timeout: 120000,
          retryAttempts: 5,
          retryDelay: 3000,
          features: ['publish', 'search', 'download'],
          auth: {
            type: 'pinning-service'
          },
          options: {
            gatewayUrl: 'https://ipfs.io/ipfs',
            pinningService: null,
            pinningApiKeyEnv: 'IPFS_PINNING_KEY',
            namespace: 'kgen-packages'
          }
        }
      },
      strategies: {
        publish: {
          primary: 'npm',
          fallbacks: ['github', 'ipfs'],
          requireConfirmation: true
        },
        download: {
          priority: ['npm', 'github', 'docker', 'ipfs'],
          parallel: false,
          timeout: 60000
        },
        search: {
          aggregated: true,
          registries: ['npm', 'github'],
          mergeResults: true,
          maxResults: 50
        }
      },
      cache: {
        enabled: true,
        directory: '.kgen/registry-cache',
        ttl: {
          packageInfo: 3600000,    // 1 hour
          searchResults: 1800000,  // 30 minutes
          packageContent: 86400000 // 24 hours
        },
        maxSize: 1024 * 1024 * 100, // 100MB
        cleanupInterval: 3600000     // 1 hour
      },
      security: {
        verifySignatures: true,
        checkIntegrity: true,
        allowInsecureRegistries: false,
        trustedKeys: []
      },
      logging: {
        level: 'info',
        file: '.kgen/registry.log',
        maxSize: 1024 * 1024 * 10, // 10MB
        rotateFiles: 5
      }
    };
  }

  /**
   * Validate configuration structure and values
   * @param {Object} config - Configuration to validate
   * @throws {RegistryConfigError} If configuration is invalid
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new RegistryConfigError('Configuration must be an object', 'INVALID_CONFIG');
    }

    if (!config.registries || typeof config.registries !== 'object') {
      throw new RegistryConfigError('Configuration must have registries object', 'MISSING_REGISTRIES');
    }

    // Validate each registry
    for (const [name, registry] of Object.entries(config.registries)) {
      this.validateRegistry(name, registry);
    }

    // Validate strategies
    if (config.strategies) {
      this.validateStrategies(config.strategies);
    }
  }

  /**
   * Validate individual registry configuration
   * @param {string} name - Registry name
   * @param {Object} registry - Registry configuration
   */
  validateRegistry(name, registry) {
    const required = ['type', 'name', 'baseUrl'];
    const missing = required.filter(field => !registry[field]);
    
    if (missing.length > 0) {
      throw new RegistryConfigError(
        `Registry '${name}' missing required fields: ${missing.join(', ')}`,
        'INVALID_REGISTRY'
      );
    }

    const validTypes = ['npm', 'git', 'oci', 'ipfs', 'mock-npm', 'mock-git', 'mock-oci', 'mock-ipfs'];
    if (!validTypes.includes(registry.type)) {
      throw new RegistryConfigError(
        `Registry '${name}' has invalid type: ${registry.type}`,
        'INVALID_REGISTRY_TYPE'
      );
    }

    if (typeof registry.priority !== 'number' || registry.priority < 1) {
      throw new RegistryConfigError(
        `Registry '${name}' must have priority >= 1`,
        'INVALID_PRIORITY'
      );
    }
  }

  /**
   * Validate strategy configurations
   * @param {Object} strategies - Strategy configurations
   */
  validateStrategies(strategies) {
    if (strategies.publish?.primary && !this.config.registries[strategies.publish.primary]) {
      throw new RegistryConfigError(
        `Primary publish registry '${strategies.publish.primary}' not found`,
        'INVALID_STRATEGY'
      );
    }

    if (strategies.download?.priority) {
      const invalidRegistries = strategies.download.priority.filter(
        name => !this.config.registries[name]
      );
      
      if (invalidRegistries.length > 0) {
        throw new RegistryConfigError(
          `Download strategy references unknown registries: ${invalidRegistries.join(', ')}`,
          'INVALID_STRATEGY'
        );
      }
    }
  }

  /**
   * Get registry configuration by name
   * @param {string} name - Registry name
   * @returns {Object|null} Registry configuration
   */
  getRegistry(name) {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return this.config.registries[name] || null;
  }

  /**
   * Get all enabled registries
   * @returns {Object} Enabled registries
   */
  getEnabledRegistries() {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    const enabled = {};
    for (const [name, registry] of Object.entries(this.config.registries)) {
      if (registry.enabled) {
        enabled[name] = registry;
      }
    }

    return enabled;
  }

  /**
   * Get registries sorted by priority
   * @param {boolean} enabledOnly - Only return enabled registries
   * @returns {Array<Object>} Sorted registries
   */
  getRegistriesByPriority(enabledOnly = true) {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    const registries = Object.entries(this.config.registries)
      .filter(([_, registry]) => !enabledOnly || registry.enabled)
      .map(([name, registry]) => ({ name, ...registry }))
      .sort((a, b) => a.priority - b.priority);

    return registries;
  }

  /**
   * Add or update registry configuration
   * @param {string} name - Registry name
   * @param {Object} registryConfig - Registry configuration
   */
  setRegistry(name, registryConfig) {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    this.validateRegistry(name, registryConfig);
    this.config.registries[name] = registryConfig;
    
    this.emit('registryUpdated', { name, config: registryConfig });
  }

  /**
   * Remove registry configuration
   * @param {string} name - Registry name
   */
  removeRegistry(name) {
    if (!this.config || !this.config.registries[name]) {
      throw new RegistryConfigError(`Registry '${name}' not found`, 'REGISTRY_NOT_FOUND');
    }

    delete this.config.registries[name];
    this.emit('registryRemoved', { name });
  }

  /**
   * Enable or disable a registry
   * @param {string} name - Registry name
   * @param {boolean} enabled - Enable state
   */
  setRegistryEnabled(name, enabled) {
    const registry = this.getRegistry(name);
    if (!registry) {
      throw new RegistryConfigError(`Registry '${name}' not found`, 'REGISTRY_NOT_FOUND');
    }

    registry.enabled = enabled;
    this.emit('registryToggled', { name, enabled });
  }

  /**
   * Get strategy configuration
   * @param {string} strategyType - Strategy type (publish, download, search)
   * @returns {Object|null} Strategy configuration
   */
  getStrategy(strategyType) {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return this.config.strategies?.[strategyType] || null;
  }

  /**
   * Update strategy configuration
   * @param {string} strategyType - Strategy type
   * @param {Object} strategyConfig - Strategy configuration
   */
  setStrategy(strategyType, strategyConfig) {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    if (!this.config.strategies) {
      this.config.strategies = {};
    }

    this.config.strategies[strategyType] = strategyConfig;
    this.emit('strategyUpdated', { type: strategyType, config: strategyConfig });
  }

  /**
   * Get cache configuration
   * @returns {Object} Cache configuration
   */
  getCacheConfig() {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return this.config.cache || this.getDefaultConfig().cache;
  }

  /**
   * Get security configuration
   * @returns {Object} Security configuration
   */
  getSecurityConfig() {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return this.config.security || this.getDefaultConfig().security;
  }

  /**
   * Get logging configuration
   * @returns {Object} Logging configuration
   */
  getLoggingConfig() {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return this.config.logging || this.getDefaultConfig().logging;
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = this.getDefaultConfig();
    this.loaded = true;
    this.emit('reset');
  }

  /**
   * Create a copy of the current configuration
   * @returns {Object} Configuration copy
   */
  export() {
    if (!this.config) {
      throw new RegistryConfigError('Configuration not loaded', 'CONFIG_NOT_LOADED');
    }

    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Import configuration from object
   * @param {Object} configData - Configuration data
   * @param {boolean} merge - Merge with existing config instead of replacing
   */
  import(configData, merge = false) {
    this.validateConfig(configData);
    
    if (merge && this.config) {
      this.config = this.mergeConfigs(this.config, configData);
    } else {
      this.config = configData;
    }
    
    this.loaded = true;
    this.emit('imported', { merged: merge });
  }

  /**
   * Merge two configuration objects
   * @param {Object} base - Base configuration
   * @param {Object} override - Override configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(base, override) {
    const merged = JSON.parse(JSON.stringify(base));
    
    // Merge registries
    if (override.registries) {
      Object.assign(merged.registries, override.registries);
    }
    
    // Merge strategies
    if (override.strategies) {
      merged.strategies = { ...merged.strategies, ...override.strategies };
    }
    
    // Merge other properties
    ['cache', 'security', 'logging'].forEach(key => {
      if (override[key]) {
        merged[key] = { ...merged[key], ...override[key] };
      }
    });
    
    return merged;
  }
}

export default RegistryConfig;