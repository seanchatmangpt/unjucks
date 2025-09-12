import { readFileSync, writeFileSync, existsSync, mkdirSync, watchFile, unwatchFile } from 'fs';
import { resolve, dirname, join } from 'path';
import { EventEmitter } from 'events';
import { ConfigSchema, validateEnvironmentConfig } from '../schemas/config-schema.js';
import { SecretsManager } from './secrets-manager.js';
import { FeatureFlagsManager } from './feature-flags-manager.js';
import consola from 'consola';

/**
 * Enterprise Configuration Manager
 * Handles configuration loading, validation, hot-reload, and secrets management
 */
export class ConfigManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      configDir: resolve(process.cwd(), 'config'),
      environment: process.env.NODE_ENV || 'development',
      enableHotReload: process.env.NODE_ENV !== 'production',
      enableValidation: true,
      enableSecrets: true,
      enableFeatureFlags: true,
      ...options
    };
    
    this.config = null;
    this.secretsManager = null;
    this.featureFlagsManager = null;
    this.watchedFiles = new Set();
    this.logger = consola.withTag('config-manager');
    
    this.initialize();
  }
  
  /**
   * Initialize configuration manager
   */
  async initialize() {
    try {
      // Load base configuration
      await this.loadConfiguration();
      
      // Initialize secrets manager
      if (this.options.enableSecrets) {
        this.secretsManager = new SecretsManager(this.config.secrets);
        await this.secretsManager.initialize();
      }
      
      // Initialize feature flags manager
      if (this.options.enableFeatureFlags) {
        this.featureFlagsManager = new FeatureFlagsManager(this.config.features);
        await this.featureFlagsManager.initialize();
      }
      
      // Setup hot reload if enabled
      if (this.options.enableHotReload && this.config.hotReload?.enabled) {
        this.setupHotReload();
      }
      
      this.logger.success(`Configuration initialized for ${this.options.environment} environment`);
      this.emit('initialized', this.config);
      
    } catch (error) {
      this.logger.error('Failed to initialize configuration:', error);
      throw error;
    }
  }
  
  /**
   * Load configuration from multiple sources
   */
  async loadConfiguration() {
    const configPaths = this.getConfigurationPaths();
    let mergedConfig = {};
    
    // Load configurations in order of precedence
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const config = await this.loadConfigFile(configPath);
          mergedConfig = this.mergeConfigs(mergedConfig, config);
          this.logger.info(`Loaded configuration from: ${configPath}`);
        } catch (error) {
          this.logger.warn(`Failed to load configuration from ${configPath}:`, error.message);
        }
      }
    }
    
    // Apply environment variable overrides
    mergedConfig = this.applyEnvironmentOverrides(mergedConfig);
    
    // Validate configuration if enabled
    if (this.options.enableValidation) {
      mergedConfig = this.validateConfiguration(mergedConfig);
    }
    
    this.config = mergedConfig;
    return this.config;
  }
  
  /**
   * Get configuration file paths in order of precedence
   */
  getConfigurationPaths() {
    const env = this.options.environment;
    const configDir = this.options.configDir;
    
    return [
      // Base configuration
      join(configDir, 'default.json'),
      join(configDir, 'default.js'),
      
      // Environment-specific configuration
      join(configDir, 'environments', `${env}.json`),
      join(configDir, 'environments', `${env}.js`),
      
      // Local overrides (should be gitignored)
      join(configDir, 'local.json'),
      join(configDir, 'local.js'),
      
      // Runtime overrides
      join(configDir, 'runtime.json')
    ];
  }
  
  /**
   * Load a single configuration file
   */
  async loadConfigFile(filePath) {
    const ext = filePath.split('.').pop();
    
    if (ext === 'json') {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } else if (ext === 'js') {
      // Dynamic import for ES modules
      const module = await import(`file://${resolve(filePath)}?t=${this.getDeterministicTimestamp()}`);
      return module.default || module;
    }
    
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }
  
  /**
   * Merge two configuration objects deeply
   */
  mergeConfigs(base, override) {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Apply environment variable overrides using dot notation
   * Example: CONFIG_database__host=localhost becomes config.database.host = 'localhost'
   */
  applyEnvironmentOverrides(config) {
    const overrides = {};
    const prefix = 'CONFIG_';
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configPath = key.slice(prefix.length).split('__');
        this.setNestedValue(overrides, configPath, this.parseEnvValue(value));
      }
    }
    
    return this.mergeConfigs(config, overrides);
  }
  
  /**
   * Set nested object value using array path
   */
  setNestedValue(obj, path, value) {
    const lastKey = path.pop();
    const target = path.reduce((current, key) => {
      current[key] = current[key] || {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
  
  /**
   * Parse environment variable value to appropriate type
   */
  parseEnvValue(value) {
    // Boolean values
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Numeric values
    if (/^\\d+$/.test(value)) return parseInt(value, 10);
    if (/^\\d+\\.\\d+$/.test(value)) return parseFloat(value);
    
    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim());
    }
    
    // String values
    return value;
  }
  
  /**
   * Validate configuration against schema
   */
  validateConfiguration(config) {
    try {
      return validateEnvironmentConfig(config, this.options.environment);
    } catch (error) {
      this.logger.error('Configuration validation failed:', error.message);
      throw new Error(`Invalid configuration: ${error.message}`);
    }
  }
  
  /**
   * Get configuration value using dot notation
   */
  get(path, defaultValue) {
    if (!path) return this.config;
    
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }
  
  /**
   * Set configuration value using dot notation
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const key of keys) {
      current[key] = current[key] || {};
      current = current[key];
    }
    
    current[lastKey] = value;
    this.emit('changed', path, value);
  }
  
  /**
   * Check if a feature flag is enabled
   */
  isFeatureEnabled(featureName) {
    if (!this.featureFlagsManager) {
      return this.get(`features.flags.${featureName}`, false);
    }
    
    return this.featureFlagsManager.isEnabled(featureName);
  }
  
  /**
   * Get a secret value
   */
  async getSecret(secretName) {
    if (!this.secretsManager) {
      return process.env[secretName];
    }
    
    return await this.secretsManager.getSecret(secretName);
  }
  
  /**
   * Setup hot reload functionality
   */
  setupHotReload() {
    const hotReloadConfig = this.config.hotReload;
    const watchPaths = hotReloadConfig.watchPaths || ['./config'];
    
    for (const watchPath of watchPaths) {
      const absolutePath = resolve(watchPath);
      
      if (existsSync(absolutePath)) {
        this.setupFileWatcher(absolutePath, hotReloadConfig);
      }
    }
  }
  
  /**
   * Setup file watcher for hot reload
   */
  setupFileWatcher(filePath, hotReloadConfig) {
    if (this.watchedFiles.has(filePath)) return;
    
    let debounceTimeout;
    
    const handleFileChange = async () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          this.logger.info(`Configuration file changed: ${filePath}`);
          
          // Reload configuration
          const oldConfig = { ...this.config };
          await this.loadConfiguration();
          
          // Determine what needs to be reloaded
          const changes = this.detectConfigChanges(oldConfig, this.config);
          
          // Emit change events
          for (const change of changes) {
            this.emit('configChanged', change);
            
            if (hotReloadConfig.restartOnChange?.includes(change.section)) {
              this.emit('restartRequired', change.section);
            } else if (hotReloadConfig.safeReload?.includes(change.section)) {
              this.emit('safeReload', change.section);
            }
          }
          
        } catch (error) {
          this.logger.error('Failed to reload configuration:', error);
          this.emit('reloadError', error);
        }
      }, hotReloadConfig.debounceMs || 1000);
    };
    
    watchFile(filePath, handleFileChange);
    this.watchedFiles.add(filePath);
    this.logger.debug(`Watching configuration file: ${filePath}`);
  }
  
  /**
   * Detect configuration changes between old and new config
   */
  detectConfigChanges(oldConfig, newConfig, path = '') {
    const changes = [];
    
    const allKeys = new Set([
      ...Object.keys(oldConfig || {}),
      ...Object.keys(newConfig || {})
    ]);
    
    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];
      
      if (oldValue !== newValue) {
        if (typeof newValue === 'object' && typeof oldValue === 'object' && 
            newValue !== null && oldValue !== null) {
          changes.push(...this.detectConfigChanges(oldValue, newValue, currentPath));
        } else {
          changes.push({
            path: currentPath,
            section: key,
            oldValue,
            newValue,
            type: oldValue === undefined ? 'added' : 
                  newValue === undefined ? 'removed' : 'modified'
          });
        }
      }
    }
    
    return changes;
  }
  
  /**
   * Save current configuration to runtime file
   */
  saveRuntimeConfig() {
    const runtimePath = join(this.options.configDir, 'runtime.json');
    const runtimeDir = dirname(runtimePath);
    
    if (!existsSync(runtimeDir)) {
      mkdirSync(runtimeDir, { recursive: true });
    }
    
    writeFileSync(runtimePath, JSON.stringify(this.config, null, 2));
    this.logger.info('Runtime configuration saved');
  }
  
  /**
   * Export configuration for debugging
   */
  export(includeSensitive = false) {
    if (includeSensitive) {
      return JSON.parse(JSON.stringify(this.config));
    }
    
    // Remove sensitive data
    const exported = JSON.parse(JSON.stringify(this.config));
    this.removeSensitiveData(exported);
    return exported;
  }
  
  /**
   * Remove sensitive data from exported configuration
   */
  removeSensitiveData(config) {
    const sensitiveKeys = [
      'password', 'secret', 'key', 'token', 'credential',
      'auth', 'jwt', 'api_key', 'private_key'
    ];
    
    const removeSensitive = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (sensitiveKeys.some(sensitive => 
          key.toLowerCase().includes(sensitive.toLowerCase())
        )) {
          obj[key] = '[REDACTED]';
        } else if (value && typeof value === 'object') {
          removeSensitive(value, fullPath);
        }
      }
    };
    
    removeSensitive(config);
  }
  
  /**
   * Health check for configuration manager
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: this.getDeterministicDate().toISOString(),
      environment: this.options.environment,
      configLoaded: !!this.config,
      secretsManager: this.secretsManager ? await this.secretsManager.healthCheck() : null,
      featureFlagsManager: this.featureFlagsManager ? await this.featureFlagsManager.healthCheck() : null,
      hotReload: this.config?.hotReload?.enabled || false,
      watchedFiles: Array.from(this.watchedFiles)
    };
    
    if (!health.configLoaded) {
      health.status = 'unhealthy';
      health.error = 'Configuration not loaded';
    }
    
    return health;
  }
  
  /**
   * Cleanup and stop watching files
   */
  destroy() {
    // Stop watching files
    for (const filePath of this.watchedFiles) {
      unwatchFile(filePath);
    }
    this.watchedFiles.clear();
    
    // Cleanup managers
    if (this.secretsManager) {
      this.secretsManager.destroy();
    }
    
    if (this.featureFlagsManager) {
      this.featureFlagsManager.destroy();
    }
    
    this.removeAllListeners();
    this.logger.info('Configuration manager destroyed');
  }
}

// Singleton instance
let configManager = null;

/**
 * Get or create singleton configuration manager instance
 */
export function getConfigManager(options) {
  if (!configManager) {
    configManager = new ConfigManager(options);
  }
  return configManager;
}

/**
 * Initialize configuration manager
 */
export async function initializeConfig(options) {
  const manager = getConfigManager(options);
  await manager.initialize();
  return manager;
}

/**
 * Convenience function to get configuration values
 */
export function getConfig(path, defaultValue) {
  if (!configManager) {
    throw new Error('Configuration manager not initialized. Call initializeConfig() first.');
  }
  return configManager.get(path, defaultValue);
}

/**
 * Convenience function to check feature flags
 */
export function isFeatureEnabled(featureName) {
  if (!configManager) {
    return false;
  }
  return configManager.isFeatureEnabled(featureName);
}

export default ConfigManager;