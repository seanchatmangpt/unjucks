/**
 * Unjucks Application Core
 * 
 * Main application orchestrator that coordinates the engine with all subsystems
 * Provides unified API for CLI and programmatic usage
 */

import { EventEmitter } from 'events';
import path from 'path';
import { UnjucksEngine } from './engine.js';
import { loadUnjucksConfig, getConfig, storeConfigSchema } from './config.js';

/**
 * Main Unjucks Application class
 * Orchestrates engine, configuration, and subsystem coordination
 */
export class UnjucksApp extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.initOptions = options;
    this.config = null;
    this.engine = null;
    this._logger = null;
    this._performanceMonitor = null;
    this._memoryStore = null;
    
    // Application state
    this.state = {
      initialized: false,
      configLoaded: false,
      templatesDiscovered: false,
      ready: false
    };
  }

  /**
   * Run the application with CLI arguments
   * @param {string[]} args - Command line arguments
   * @returns {Promise<number>} Exit code
   */
  async run(args = []) {
    try {
      // Initialize if not already done
      if (!this.state.initialized) {
        await this.initialize();
      }

      // Import CLI system
      const { runMain } = await import('../cli/index.js');
      
      // Override process.argv with provided args
      const originalArgv = process.argv;
      process.argv = ['node', 'unjucks', ...args];
      
      try {
        await runMain();
        return 0;
      } finally {
        // Restore original argv
        process.argv = originalArgv;
      }
    } catch (error) {
      console.error('Application error:', error.message);
      return 1;
    }
  }

  /**
   * Initialize the application with configuration loading
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.state.initialized) {
      return;
    }
    
    try {
      this.emit('app:initialize:start');
      
      // Merge initialization options
      const mergedOptions = { ...this.initOptions, ...options };
      
      // Load configuration
      this.config = await loadUnjucksConfig(mergedOptions);
      this.state.configLoaded = true;
      
      // Initialize memory store for configuration schema storage
      this._memoryStore = new Map();
      this._memoryStore.set = (key, value) => Map.prototype.set.call(this._memoryStore, key, value);
      this._memoryStore.get = (key) => Map.prototype.get.call(this._memoryStore, key);
      
      // Store configuration schema in memory
      storeConfigSchema(this._memoryStore);
      
      // Initialize engine with loaded configuration (stub for now)
      this.engine = { config: this.config };
      
      this.state.initialized = true;
      this.state.ready = true;
      
      this.emit('app:initialize:complete');
      
    } catch (error) {
      this.emit('app:initialize:error', error);
      throw error;
    }
  }

  /**
   * Get current application configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this.config || getConfig();
  }

  /**
   * Get application state
   * @returns {Object} Application state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get application status and metrics
   * @returns {Object} Application status
   */
  getStatus() {
    return {
      state: this.state,
      config: this.config ? {
        environment: this.config.environment,
        templateDirs: this.config.templateDirs?.length || 0,
        semanticEnabled: this.config.semantic?.enableRDF || false,
        performanceMetrics: this.config.performance?.enableMetrics || false
      } : null,
      engine: this.engine ? { initialized: true } : null,
      subsystems: {
        logger: !!this._logger,
        performanceMonitor: !!this._performanceMonitor,
        memoryStore: !!this._memoryStore
      }
    };
  }

  /**
   * Get the current configuration
   * @returns {Object|null} Current configuration or null if not loaded
   */
  getConfiguration() {
    return this.config;
  }

  /**
   * Get configuration schema from memory store
   * @returns {Object|null} Configuration schema or null if not available
   */
  getConfigurationSchema() {
    return this._memoryStore?.get('hive/config/system') || null;
  }

  /**
   * Validate a configuration object against the current schema
   * @param {Object} configToValidate - Configuration to validate
   * @returns {Object} Validation result
   */
  async validateConfiguration(configToValidate) {
    const { validateConfig } = await import('./config.js');
    return validateConfig(configToValidate);
  }

  /**
   * Get memory store contents (for debugging/inspection)
   * @returns {Object} Memory store contents
   */
  getMemoryStore() {
    if (!this._memoryStore) {
      return {};
    }
    
    const contents = {};
    for (const [key, value] of this._memoryStore.entries()) {
      contents[key] = value;
    }
    return contents;
  }

  /**
   * Graceful shutdown
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.emit('app:shutdown:start');
    
    // Clean up resources
    if (this._performanceMonitor) {
      this._performanceMonitor.stop();
    }
    
    this.state.ready = false;
    this.emit('app:shutdown:complete');
  }
}