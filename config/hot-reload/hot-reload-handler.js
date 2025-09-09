import { EventEmitter } from 'events';
import { watch } from 'chokidar';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import consola from 'consola';

/**
 * Hot Reload Configuration Handler
 * Safely handles configuration reloading with validation and rollback
 */
export class HotReloadHandler extends EventEmitter {
  constructor(configManager, options = {}) {
    super();
    
    this.configManager = configManager;
    this.options = {
      enabled: false,
      watchPaths: ['./config'],
      excludePaths: ['./config/secrets', './config/runtime.json'],
      debounceMs: 1000,
      restartOnChange: ['server', 'database', 'security'],
      safeReload: ['logging', 'monitoring', 'features'],
      validationTimeout: 5000,
      backupCount: 5,
      ...options
    };
    
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.configBackups = [];
    this.isReloading = false;
    this.logger = consola.withTag('hot-reload');
  }
  
  /**
   * Initialize hot reload functionality
   */
  async initialize() {
    if (!this.options.enabled) {
      this.logger.info('Hot reload disabled');
      return;
    }
    
    try {
      // Create initial backup
      this.createConfigBackup();
      
      // Setup watchers for each path
      for (const watchPath of this.options.watchPaths) {
        await this.setupWatcher(watchPath);
      }
      
      this.logger.success(`Hot reload initialized, watching ${this.watchers.size} paths`);
      
    } catch (error) {
      this.logger.error('Failed to initialize hot reload:', error);
      throw error;
    }
  }
  
  /**
   * Setup file system watcher for a path
   */
  async setupWatcher(watchPath) {
    const absolutePath = resolve(watchPath);
    
    if (!existsSync(absolutePath)) {
      this.logger.warn(`Watch path does not exist: ${absolutePath}`);
      return;
    }
    
    const watcher = watch(absolutePath, {
      ignored: this.options.excludePaths,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });
    
    watcher.on('change', (filePath) => this.handleFileChange(filePath, 'change'));
    watcher.on('add', (filePath) => this.handleFileChange(filePath, 'add'));
    watcher.on('unlink', (filePath) => this.handleFileChange(filePath, 'unlink'));
    watcher.on('error', (error) => this.handleWatcherError(watchPath, error));
    
    this.watchers.set(watchPath, watcher);
    this.logger.debug(`Setup watcher for: ${absolutePath}`);
  }
  
  /**
   * Handle file system changes
   */
  handleFileChange(filePath, changeType) {
    if (this.isReloading) {
      this.logger.debug(`Ignoring change during reload: ${filePath}`);
      return;
    }
    
    this.logger.info(`Configuration file ${changeType}: ${filePath}`);
    
    // Debounce rapid changes
    const debounceKey = `${filePath}:${changeType}`;
    
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey));
    }
    
    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      this.processFileChange(filePath, changeType);
    }, this.options.debounceMs);
    
    this.debounceTimers.set(debounceKey, timer);
  }
  
  /**
   * Process a file change after debouncing
   */
  async processFileChange(filePath, changeType) {
    if (this.isReloading) {
      return;
    }
    
    this.isReloading = true;
    
    try {
      // Create backup before attempting reload
      this.createConfigBackup();
      
      // Attempt to reload configuration
      const oldConfig = this.configManager.export(false);
      await this.configManager.loadConfiguration();
      const newConfig = this.configManager.export(false);
      
      // Validate new configuration
      const validationResult = await this.validateConfigChange(oldConfig, newConfig);
      
      if (!validationResult.valid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Detect what changed
      const changes = this.detectConfigSections(oldConfig, newConfig);
      
      // Determine reload strategy
      const reloadStrategy = this.determineReloadStrategy(changes);
      
      // Execute reload
      await this.executeReload(reloadStrategy, changes);
      
      this.logger.success(`Configuration reloaded successfully (${reloadStrategy.type})`);
      this.emit('reloadSuccess', { filePath, changeType, changes, strategy: reloadStrategy });
      
    } catch (error) {
      this.logger.error(`Failed to reload configuration from ${filePath}:`, error.message);
      
      // Attempt rollback
      try {
        await this.rollbackConfiguration();
        this.logger.info('Configuration rolled back to previous version');
      } catch (rollbackError) {
        this.logger.error('Failed to rollback configuration:', rollbackError.message);
      }
      
      this.emit('reloadError', { filePath, changeType, error });
    } finally {
      this.isReloading = false;
    }
  }
  
  /**
   * Validate configuration changes
   */
  async validateConfigChange(oldConfig, newConfig) {
    const errors = [];
    
    try {
      // Basic structure validation
      const requiredSections = ['app', 'server', 'database', 'security', 'logging'];
      
      for (const section of requiredSections) {
        if (!newConfig[section]) {
          errors.push(`Missing required configuration section: ${section}`);
        }
      }
      
      // Cross-section validation
      if (newConfig.server?.port && (newConfig.server.port < 1 || newConfig.server.port > 65535)) {
        errors.push('Server port must be between 1 and 65535');
      }
      
      if (newConfig.database?.pool?.max && newConfig.database.pool.max < newConfig.database?.pool?.min) {
        errors.push('Database pool max must be greater than min');
      }
      
      // Environment-specific validation
      if (newConfig.app?.environment === 'production') {
        if (!newConfig.security?.headers?.hsts) {
          errors.push('HSTS must be enabled in production');
        }
        
        if (!newConfig.security?.rateLimit?.enabled) {
          errors.push('Rate limiting must be enabled in production');
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Detect which configuration sections changed
   */
  detectConfigSections(oldConfig, newConfig) {
    const changes = [];
    const sections = new Set([
      ...Object.keys(oldConfig || {}),
      ...Object.keys(newConfig || {})
    ]);
    
    for (const section of sections) {
      const oldValue = oldConfig?.[section];
      const newValue = newConfig?.[section];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          section,
          type: oldValue === undefined ? 'added' : 
                newValue === undefined ? 'removed' : 'modified',
          oldValue,
          newValue
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Determine the appropriate reload strategy
   */
  determineReloadStrategy(changes) {
    let requiresRestart = false;
    let canSafeReload = true;
    const affectedSections = changes.map(c => c.section);
    
    // Check if any changes require a restart
    for (const section of affectedSections) {
      if (this.options.restartOnChange.includes(section)) {
        requiresRestart = true;
        break;
      }
    }
    
    // Check if all changes can be safely reloaded
    for (const section of affectedSections) {
      if (!this.options.safeReload.includes(section) && !this.options.restartOnChange.includes(section)) {
        canSafeReload = false;
        break;
      }
    }
    
    if (requiresRestart) {
      return {
        type: 'restart',
        reason: 'Critical configuration sections changed',
        sections: affectedSections.filter(s => this.options.restartOnChange.includes(s))
      };
    }
    
    if (canSafeReload) {
      return {
        type: 'safe-reload',
        reason: 'Only safe-reload sections changed',
        sections: affectedSections
      };
    }
    
    return {
      type: 'validation-only',
      reason: 'Changes require manual restart',
      sections: affectedSections
    };
  }
  
  /**
   * Execute the determined reload strategy
   */
  async executeReload(strategy, changes) {
    switch (strategy.type) {
      case 'restart':
        this.emit('restartRequired', { 
          strategy, 
          changes,
          message: 'Application restart required due to critical configuration changes'
        });
        break;
        
      case 'safe-reload':
        for (const change of changes) {
          if (this.options.safeReload.includes(change.section)) {
            await this.reloadSection(change.section, change.newValue);
          }
        }
        break;
        
      case 'validation-only':
        this.emit('validationOnly', {
          strategy,
          changes,
          message: 'Configuration validated but manual restart recommended'
        });
        break;
    }
  }
  
  /**
   * Reload a specific configuration section
   */
  async reloadSection(sectionName, newValue) {
    try {
      switch (sectionName) {
        case 'logging':
          await this.reloadLoggingConfig(newValue);
          break;
          
        case 'monitoring':
          await this.reloadMonitoringConfig(newValue);
          break;
          
        case 'features':
          await this.reloadFeatureFlagsConfig(newValue);
          break;
          
        default:
          this.logger.warn(`No specific reload handler for section: ${sectionName}`);
      }
      
      this.logger.debug(`Reloaded configuration section: ${sectionName}`);
      
    } catch (error) {
      this.logger.error(`Failed to reload section ${sectionName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Reload logging configuration
   */
  async reloadLoggingConfig(loggingConfig) {
    // Update logger configuration
    if (loggingConfig.level && consola.level !== loggingConfig.level) {
      consola.level = loggingConfig.level;
    }
    
    this.emit('sectionReloaded', { section: 'logging', config: loggingConfig });
  }
  
  /**
   * Reload monitoring configuration
   */
  async reloadMonitoringConfig(monitoringConfig) {
    // Update monitoring settings
    this.emit('sectionReloaded', { section: 'monitoring', config: monitoringConfig });
  }
  
  /**
   * Reload feature flags configuration
   */
  async reloadFeatureFlagsConfig(featuresConfig) {
    // Reload feature flags if manager exists
    if (this.configManager.featureFlagsManager) {
      await this.configManager.featureFlagsManager.loadFlags();
    }
    
    this.emit('sectionReloaded', { section: 'features', config: featuresConfig });
  }
  
  /**
   * Create a backup of current configuration
   */
  createConfigBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      config: this.configManager.export(false)
    };
    
    this.configBackups.unshift(backup);
    
    // Keep only the specified number of backups
    if (this.configBackups.length > this.options.backupCount) {
      this.configBackups = this.configBackups.slice(0, this.options.backupCount);
    }
    
    this.logger.debug(`Created configuration backup (${this.configBackups.length}/${this.options.backupCount})`);
  }
  
  /**
   * Rollback to previous configuration
   */
  async rollbackConfiguration() {
    if (this.configBackups.length === 0) {
      throw new Error('No configuration backups available');
    }
    
    const backup = this.configBackups[0];
    
    // Restore configuration from backup
    Object.assign(this.configManager.config, backup.config);
    
    this.logger.info(`Rolled back to configuration from ${backup.timestamp}`);
    this.emit('configRolledBack', { backup });
  }
  
  /**
   * Handle watcher errors
   */
  handleWatcherError(watchPath, error) {
    this.logger.error(`File watcher error for ${watchPath}:`, error.message);
    this.emit('watcherError', { watchPath, error });
    
    // Try to recreate the watcher
    setTimeout(() => {
      this.logger.info(`Attempting to recreate watcher for ${watchPath}`);
      this.recreateWatcher(watchPath);
    }, 5000);
  }
  
  /**
   * Recreate a failed watcher
   */
  async recreateWatcher(watchPath) {
    try {
      // Close existing watcher if it exists
      const existingWatcher = this.watchers.get(watchPath);
      if (existingWatcher) {
        await existingWatcher.close();
        this.watchers.delete(watchPath);
      }
      
      // Setup new watcher
      await this.setupWatcher(watchPath);
      this.logger.success(`Recreated watcher for ${watchPath}`);
      
    } catch (error) {
      this.logger.error(`Failed to recreate watcher for ${watchPath}:`, error.message);
    }
  }
  
  /**
   * Get hot reload status
   */
  getStatus() {
    return {
      enabled: this.options.enabled,
      isReloading: this.isReloading,
      watchedPaths: Array.from(this.watchers.keys()),
      backupCount: this.configBackups.length,
      lastReload: this.configBackups[0]?.timestamp || null
    };
  }
  
  /**
   * Manually trigger a configuration reload
   */
  async manualReload() {
    if (this.isReloading) {
      throw new Error('Reload already in progress');
    }
    
    this.logger.info('Manual configuration reload triggered');
    await this.processFileChange('manual-reload', 'manual');
  }
  
  /**
   * Cleanup and stop all watchers
   */
  async destroy() {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Close all watchers
    const promises = [];
    for (const [path, watcher] of this.watchers) {
      promises.push(watcher.close().catch(error => {
        this.logger.warn(`Failed to close watcher for ${path}:`, error.message);
      }));
    }
    
    await Promise.all(promises);
    this.watchers.clear();
    
    // Clear backups
    this.configBackups = [];
    
    this.removeAllListeners();
    this.logger.info('Hot reload handler destroyed');
  }
}

export default HotReloadHandler;