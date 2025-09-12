/**
 * Git Operations - Core Git Integration for KGEN
 * 
 * This module provides git-native operations for KGEN including:
 * - Blob storage for artifacts
 * - Git notes for attestations
 * - Custom URI schemes (git://, content://, attest://)
 * - Git hooks for policy enforcement
 * - Provenance tracking integration
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import git from 'isomorphic-git';
import fs from 'fs-extra';
import path from 'path';

// Import git operation modules
import { GitBlobStorage, createGitBlobStorage } from './blob.js';
import { GitNotesManager, createGitNotesManager } from './notes.js';
import { GitHooksManager, createGitHooksManager } from './hooks.js';
import { URISchemeHandler, createURISchemeHandler } from './uri.js';
import { GitPolicyEngine, createGitPolicyEngine } from './policy.js';

/**
 * Main Git Operations Manager
 * Coordinates all git-native operations for KGEN
 */
export class GitOperationsManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      enableBlobStorage: config.enableBlobStorage !== false,
      enableNotesManager: config.enableNotesManager !== false,
      enableHooksManager: config.enableHooksManager !== false,
      enableURIHandler: config.enableURIHandler !== false,
      enablePolicyEngine: config.enablePolicyEngine !== false,
      autoInitialize: config.autoInitialize !== false,
      ...config
    };
    
    this.logger = new Consola({ tag: 'git-ops' });
    this.initialized = false;
    
    // Initialize components
    this._initializeComponents();
  }

  /**
   * Initialize git operations components
   */
  _initializeComponents() {
    const componentConfig = {
      gitDir: this.config.gitDir,
      ...this.config
    };
    
    // Initialize blob storage
    if (this.config.enableBlobStorage) {
      this.blobStorage = new GitBlobStorage(componentConfig);
      this.blobStorage.on('blob-stored', (event) => this.emit('blob-stored', event));
      this.blobStorage.on('blob-retrieved', (event) => this.emit('blob-retrieved', event));
    }
    
    // Initialize notes manager
    if (this.config.enableNotesManager) {
      this.notesManager = new GitNotesManager(componentConfig);
      this.notesManager.on('attestation-added', (event) => this.emit('attestation-added', event));
    }
    
    // Initialize hooks manager
    if (this.config.enableHooksManager) {
      this.hooksManager = new GitHooksManager(componentConfig);
      this.hooksManager.on('hooks-installed', (event) => this.emit('hooks-installed', event));
      this.hooksManager.on('validation-failed', (event) => this.emit('validation-failed', event));
    }
    
    // Initialize URI handler
    if (this.config.enableURIHandler) {
      this.uriHandler = new URISchemeHandler(componentConfig);
      this.uriHandler.on('uri-resolved', (event) => this.emit('uri-resolved', event));
    }
    
    // Initialize policy engine
    if (this.config.enablePolicyEngine) {
      this.policyEngine = new GitPolicyEngine(componentConfig);
      this.policyEngine.on('policy-violation', (event) => this.emit('policy-violation', event));
      this.policyEngine.on('validation-completed', (event) => this.emit('policy-validation', event));
    }
    
    this.logger.info('Git operations components initialized');
  }

  /**
   * Initialize git operations (auto-called if autoInitialize is true)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Ensure git repository exists
      await this._ensureGitRepository();
      
      // Initialize policy engine
      if (this.policyEngine) {
        await this.policyEngine.initialize();
      }
      
      // Install hooks if enabled
      if (this.hooksManager && this.config.autoInstallHooks) {
        await this.hooksManager.installHooks();
      }
      
      this.initialized = true;
      this.logger.info('Git operations initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize git operations:', error);
      throw error;
    }
  }

  /**
   * Store artifact as git blob with attestation and policy validation
   */
  async storeArtifactWithAttestation(content, metadata = {}) {
    if (!this.blobStorage) {
      throw new Error('Blob storage not enabled');
    }
    
    try {
      const artifact = {
        content,
        size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content),
        metadata
      };
      
      // Validate against policies
      if (this.policyEngine) {
        const validation = await this.policyEngine.enforceGitOperation('blob-storage', {
          artifact
        });
        
        if (!validation.allowed) {
          throw new Error(`Policy validation failed: ${validation.blockers.map(b => b.type).join(', ')}`);
        }
      }
      
      // Store as blob
      const blobHash = await this.blobStorage.storeArtifactAsBlob(content, {
        metadata
      });
      
      // Generate attestation if notes manager is available
      if (this.notesManager) {
        const attestation = {
          type: 'artifact-storage',
          blobHash,
          metadata,
          timestamp: new Date().toISOString(),
          generator: 'kgen-git-operations'
        };
        
        await this.notesManager.addAttestationNote(blobHash, attestation);
      }
      
      return blobHash;
      
    } catch (error) {
      this.logger.error('Failed to store artifact with attestation:', error);
      throw error;
    }
  }

  /**
   * Retrieve artifact with verification
   */
  async retrieveArtifactWithVerification(blobHash, options = {}) {
    if (!this.blobStorage) {
      throw new Error('Blob storage not enabled');
    }
    
    try {
      // Retrieve content
      const content = await this.blobStorage.retrieveArtifactFromBlob(blobHash, options);
      
      // Get attestations if available
      let attestations = [];
      let verification = null;
      
      if (this.notesManager) {
        attestations = await this.notesManager.getAttestationNotes(blobHash);
        verification = await this.notesManager.verifyAttestationChain(blobHash);
      }
      
      return {
        content,
        blobHash,
        attestations,
        verification,
        retrievedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to retrieve artifact with verification:', error);
      throw error;
    }
  }

  /**
   * Resolve URI using custom schemes
   */
  async resolveURI(uri, options = {}) {
    if (!this.uriHandler) {
      throw new Error('URI handler not enabled');
    }
    
    return await this.uriHandler.resolveUri(uri, options);
  }

  /**
   * Install git hooks with policy enforcement
   */
  async installGitHooks(options = {}) {
    if (!this.hooksManager) {
      throw new Error('Hooks manager not enabled');
    }
    
    return await this.hooksManager.installHooks(options);
  }

  /**
   * Validate artifact against policies
   */
  async validateArtifact(artifact, context = {}) {
    if (!this.policyEngine) {
      throw new Error('Policy engine not enabled');
    }
    
    return await this.policyEngine.validateArtifact(artifact, context);
  }

  /**
   * Register custom policy
   */
  registerPolicy(name, policy) {
    if (!this.policyEngine) {
      throw new Error('Policy engine not enabled');
    }
    
    return this.policyEngine.registerPolicy(name, policy);
  }

  /**
   * Get comprehensive statistics from all components
   */
  getStats() {
    const stats = {
      initialized: this.initialized,
      components: {
        blobStorage: !!this.blobStorage,
        notesManager: !!this.notesManager,
        hooksManager: !!this.hooksManager,
        uriHandler: !!this.uriHandler,
        policyEngine: !!this.policyEngine
      }
    };
    
    if (this.blobStorage) {
      stats.blobStorage = this.blobStorage.getStats();
    }
    
    if (this.notesManager) {
      stats.notesManager = this.notesManager.getStats();
    }
    
    if (this.hooksManager) {
      stats.hooksManager = this.hooksManager.getStats();
    }
    
    if (this.uriHandler) {
      stats.uriHandler = this.uriHandler.getStats();
    }
    
    if (this.policyEngine) {
      stats.policyEngine = this.policyEngine.getStats();
    }
    
    return stats;
  }

  /**
   * Ensure git repository exists
   */
  async _ensureGitRepository() {
    const gitDir = this.config.gitDir.replace('/.git', '');
    
    try {
      // Check if .git directory exists
      const gitPath = path.join(gitDir, '.git');
      if (!await fs.pathExists(gitPath)) {
        // Initialize git repository
        await git.init({ fs, dir: gitDir });
        this.logger.info(`Initialized git repository at ${gitDir}`);
      }
    } catch (error) {
      this.logger.warn('Git repository check/initialization failed:', error.message);
      // Continue anyway - might be a bare repo or other valid git setup
    }
  }

  /**
   * Cleanup all components
   */
  async cleanup() {
    try {
      if (this.blobStorage) {
        await this.blobStorage.cleanup();
      }
      
      if (this.notesManager) {
        await this.notesManager.cleanup();
      }
      
      if (this.hooksManager) {
        await this.hooksManager.cleanup();
      }
      
      if (this.uriHandler) {
        await this.uriHandler.cleanup();
      }
      
      if (this.policyEngine) {
        await this.policyEngine.cleanup();
      }
      
      this.removeAllListeners();
      this.initialized = false;
      
      this.logger.info('Git operations cleanup completed');
      
    } catch (error) {
      this.logger.error('Git operations cleanup failed:', error);
      throw error;
    }
  }
}

// Export individual components
export {
  GitBlobStorage,
  createGitBlobStorage,
  GitNotesManager,
  createGitNotesManager,
  GitHooksManager,
  createGitHooksManager,
  URISchemeHandler,
  createURISchemeHandler,
  GitPolicyEngine,
  createGitPolicyEngine
};

/**
 * Create git operations manager with default configuration
 */
export function createGitOperationsManager(config = {}) {
  const manager = new GitOperationsManager(config);
  
  if (config.autoInitialize !== false) {
    // Initialize asynchronously
    manager.initialize().catch(error => {
      manager.logger.error('Auto-initialization failed:', error);
    });
  }
  
  return manager;
}

/**
 * Quick setup for common git operations scenarios
 */
export const gitOpsPresets = {
  development: {
    enableBlobStorage: true,
    enableNotesManager: true,
    enableHooksManager: false,
    enableURIHandler: true,
    enablePolicyEngine: false,
    strictMode: false,
    autoInstallHooks: false
  },
  
  production: {
    enableBlobStorage: true,
    enableNotesManager: true,
    enableHooksManager: true,
    enableURIHandler: true,
    enablePolicyEngine: true,
    strictMode: true,
    autoInstallHooks: true,
    enablePolicyEnforcement: true,
    enableAttestationGeneration: true,
    enableDriftDetection: true
  },
  
  archival: {
    enableBlobStorage: true,
    enableNotesManager: true,
    enableHooksManager: false,
    enableURIHandler: true,
    enablePolicyEngine: true,
    enableCompression: true,
    maxBlobSize: 1024 * 1024 * 1024, // 1GB
    enableCaching: false
  },
  
  cicd: {
    enableBlobStorage: true,
    enableNotesManager: true,
    enableHooksManager: true,
    enableURIHandler: false,
    enablePolicyEngine: true,
    strictMode: true,
    autoInstallHooks: true,
    enablePolicyEnforcement: true,
    backupExistingHooks: true
  }
};

/**
 * Create git operations manager with preset configuration
 */
export function createGitOperationsWithPreset(preset, overrides = {}) {
  const presetConfig = gitOpsPresets[preset];
  if (!presetConfig) {
    throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(gitOpsPresets).join(', ')}`);
  }
  
  return createGitOperationsManager({
    ...presetConfig,
    ...overrides
  });
}

/**
 * Legacy compatibility - maintain existing API
 */
export function createGitFirstWorkflow(options = {}) {
  return createGitOperationsWithPreset('development', options);
}

export function createLightweightGitWorkflow(options = {}) {
  return createGitOperationsWithPreset('development', options);
}

export function createEnterpriseGitWorkflow(options = {}) {
  return createGitOperationsWithPreset('production', options);
}

// Default export
export default GitOperationsManager;