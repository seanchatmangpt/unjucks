/**
 * Git-First Config and Lock Management System
 * 
 * Provides centralized access to all configuration, lock management,
 * drift detection, and Git integration functionality.
 */

// Config Loading
export { ConfigLoader, configLoader, loadConfig } from '../config-loader.js';

// Lock File Management
export {
  LockManager,
  lockManager,
  generateLockFile,
  updateLockFile
} from '../lock-manager.js';

// Drift Detection
export {
  DriftDetector,
  driftDetector,
  detectDrift,
  SEVERITY,
  DRIFT_TYPES
} from '../drift-detector.js';

// Git Integration
export {
  GitIntegration,
  gitIntegration,
  getGitStatus,
  trackConfigFiles
} from '../git-integration.js';

/**
 * Main configuration management class that coordinates all components
 */
export class ConfigManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.env = options.env || process.env.NODE_ENV || 'development';
    
    this.configLoader = new ConfigLoader({
      cwd: this.projectRoot,
      env: this.env
    });
    
    this.lockManager = new LockManager({
      projectRoot: this.projectRoot
    });
    
    this.driftDetector = new DriftDetector({
      projectRoot: this.projectRoot,
      lockManager: this.lockManager,
      configLoader: this.configLoader
    });
    
    this.gitIntegration = new GitIntegration({
      projectRoot: this.projectRoot
    });
  }

  /**
   * Load configuration with caching
   */
  async loadConfig() {
    return this.configLoader.load();
  }

  /**
   * Generate and update lock file
   */
  async updateLock(options = {}) {
    const config = await this.loadConfig();
    const lockFile = await this.lockManager.generate({ config, ...options });
    await this.lockManager.update(lockFile, options);
    return lockFile;
  }

  /**
   * Check for drift and return analysis
   */
  async checkDrift(options = {}) {
    return this.driftDetector.detect(options);
  }

  /**
   * Get comprehensive project status
   */
  async getStatus() {
    const [config, lockFile, gitStatus, drift] = await Promise.all([
      this.loadConfig().catch(() => null),
      this.lockManager.load().catch(() => null),
      this.gitIntegration.getStatus().catch(() => ({ isRepo: false })),
      this.driftDetector.detect({ details: false }).catch(() => ({ status: 'error' }))
    ]);

    return {
      config: config ? {
        path: config._meta?.configPath,
        environment: config._meta?.environment,
        hash: config._meta?.hash,
        valid: true
      } : { valid: false },
      
      lock: lockFile ? {
        version: lockFile.version,
        timestamp: lockFile.timestamp,
        integrity: lockFile.integrity.combined
      } : null,
      
      git: gitStatus,
      
      drift: {
        status: drift.status,
        severity: drift.severity,
        changes: drift.drift?.length || 0
      },
      
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Setup Git integration for the project
   */
  async setupGit(options = {}) {
    const results = [];
    
    // Track config files
    const trackResult = await this.gitIntegration.trackConfigFiles();
    results.push({ operation: 'track', ...trackResult });
    
    // Setup hooks if requested
    if (options.hooks !== false) {
      const hooksResult = await this.gitIntegration.setupGitHooks();
      results.push({ operation: 'hooks', ...hooksResult });
    }
    
    // Update gitignore if requested
    if (options.gitignore !== false) {
      const ignoreResult = await this.gitIntegration.updateGitIgnore();
      results.push({ operation: 'gitignore', ...ignoreResult });
    }
    
    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Validate entire project configuration and state
   */
  async validate() {
    const errors = [];
    const warnings = [];
    
    try {
      // Validate configuration
      const config = await this.loadConfig();
      const configValidation = this.configLoader.validate(config);
      
      if (!configValidation.valid) {
        errors.push(...configValidation.errors.map(e => ({ type: 'config', message: e })));
      }
      warnings.push(...configValidation.warnings.map(w => ({ type: 'config', message: w })));
      
      // Validate lock file if exists
      const lockFile = await this.lockManager.load();
      if (lockFile) {
        try {
          this.lockManager.validateLockFile(lockFile);
        } catch (error) {
          errors.push({ type: 'lock', message: error.message });
        }
      }
      
      // Check drift
      const drift = await this.checkDrift();
      if (drift.status === 'drift' && drift.severity === 'error') {
        errors.push({ type: 'drift', message: drift.message });
      } else if (drift.status === 'drift') {
        warnings.push({ type: 'drift', message: drift.message });
      }
      
    } catch (error) {
      errors.push({ type: 'system', message: error.message });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Default configuration manager instance
 */
export const configManager = new ConfigManager();

/**
 * Convenience function to create configured manager
 */
export function createConfigManager(options = {}) {
  return new ConfigManager(options);
}
