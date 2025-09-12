/**
 * Git Hooks Integration - Policy enforcement through git hooks
 * 
 * Provides comprehensive git hook integration for policy enforcement,
 * artifact validation, attestation generation, and drift detection.
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { GitBlobStorage } from './blob.js';
import { GitNotesManager } from './notes.js';

const execAsync = promisify(exec);

export class GitHooksManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      hooksDir: config.hooksDir || process.cwd() + '/.git/hooks',
      enablePolicyEnforcement: config.enablePolicyEnforcement !== false,
      enableAttestationGeneration: config.enableAttestationGeneration !== false,
      enableDriftDetection: config.enableDriftDetection !== false,
      backupExistingHooks: config.backupExistingHooks !== false,
      strictMode: config.strictMode || false,
      ...config
    };
    
    this.logger = new Consola({ tag: 'git-hooks' });
    this.blobStorage = new GitBlobStorage({ gitDir: this.config.gitDir });
    this.notesManager = new GitNotesManager({ gitDir: this.config.gitDir });
    this.installedHooks = new Set();
    
    this.stats = {
      hooksInstalled: 0,
      hooksExecuted: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      attestationsGenerated: 0
    };
  }

  /**
   * Install all git hooks for kgen policy enforcement
   * @param {Object} options - Installation options
   * @returns {Promise<void>}
   */
  async installHooks(options = {}) {
    try {
      await this._ensureHooksDirectory();
      
      const hooks = [
        { name: 'pre-commit', handler: this._preCommitHandler.bind(this) },
        { name: 'post-commit', handler: this._postCommitHandler.bind(this) },
        { name: 'pre-push', handler: this._prePushHandler.bind(this) },
        { name: 'prepare-commit-msg', handler: this._prepareCommitMsgHandler.bind(this) }
      ];
      
      for (const hook of hooks) {
        await this._installHook(hook.name, hook.handler, options);
      }
      
      this.logger.info(`Installed ${hooks.length} git hooks for kgen policy enforcement`);
      this.emit('hooks-installed', { count: hooks.length, hooks: hooks.map(h => h.name) });
      
    } catch (error) {
      this.logger.error('Failed to install git hooks:', error);
      throw error;
    }
  }

  /**
   * Uninstall kgen git hooks
   * @param {Object} options - Uninstallation options
   * @returns {Promise<void>}
   */
  async uninstallHooks(options = {}) {
    try {
      const hooks = ['pre-commit', 'post-commit', 'pre-push', 'prepare-commit-msg'];
      
      for (const hookName of hooks) {
        await this._uninstallHook(hookName, options);
      }
      
      this.logger.info(`Uninstalled ${hooks.length} kgen git hooks`);
      this.emit('hooks-uninstalled', { count: hooks.length, hooks });
      
    } catch (error) {
      this.logger.error('Failed to uninstall git hooks:', error);
      throw error;
    }
  }

  /**
   * Pre-commit hook handler - Validate artifacts and policies
   * @param {Array<string>} stagedFiles - List of staged files
   * @returns {Promise<boolean>} True if validation passes
   */
  async _preCommitHandler(stagedFiles) {
    try {
      this.logger.info('Running pre-commit validation...');
      const startTime = Date.now();
      
      // Get staged files
      const files = stagedFiles || await this._getStagedFiles();
      
      if (files.length === 0) {
        this.logger.info('No staged files to validate');
        return true;
      }
      
      // Validate artifacts
      const validationResults = [];
      
      for (const file of files) {
        const result = await this._validateArtifact(file);
        validationResults.push({ file, ...result });
        
        if (result.valid) {
          this.stats.validationsPassed++;
        } else {
          this.stats.validationsFailed++;
        }
      }
      
      // Check if any validations failed
      const failedValidations = validationResults.filter(r => !r.valid);
      
      if (failedValidations.length > 0 && this.config.strictMode) {
        this.logger.error('Pre-commit validation failed:', failedValidations);
        this.emit('validation-failed', { 
          hook: 'pre-commit', 
          failures: failedValidations,
          duration: Date.now() - startTime
        });
        return false;
      }
      
      // Log warnings for non-strict mode
      if (failedValidations.length > 0) {
        this.logger.warn(`${failedValidations.length} files have validation issues (non-strict mode)`);
      }
      
      this.logger.info(`Pre-commit validation completed: ${validationResults.length} files validated`);
      this.emit('validation-completed', {
        hook: 'pre-commit',
        results: validationResults,
        duration: Date.now() - startTime
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('Pre-commit hook failed:', error);
      this.emit('hook-error', { hook: 'pre-commit', error });
      return !this.config.strictMode;
    }
  }

  /**
   * Post-commit hook handler - Generate attestations
   * @param {string} commitHash - The new commit hash
   * @returns {Promise<void>}
   */
  async _postCommitHandler(commitHash) {
    try {
      this.logger.info('Running post-commit attestation generation...');
      const startTime = Date.now();
      
      // Get commit hash if not provided
      if (!commitHash) {
        const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.gitDir.replace('/.git', '') });
        commitHash = stdout.trim();
      }
      
      // Get changed files in this commit
      const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-only -r ${commitHash}`, {
        cwd: this.config.gitDir.replace('/.git', '')
      });
      const changedFiles = stdout.trim().split('\n').filter(f => f);
      
      if (changedFiles.length === 0) {
        this.logger.info('No changed files to generate attestations for');
        return;
      }
      
      // Generate attestations for each changed file
      const attestations = [];
      
      for (const file of changedFiles) {
        try {
          // Store file as blob
          const fileContent = await fs.readFile(path.join(this.config.gitDir.replace('/.git', ''), file));
          const blobHash = await this.blobStorage.storeArtifactAsBlob(fileContent, {
            metadata: { filePath: file, commitHash }
          });
          
          // Generate attestation
          const attestation = {
            type: 'artifact-commit',
            filePath: file,
            commitHash,
            blobHash,
            timestamp: new Date().toISOString(),
            generator: 'kgen-post-commit-hook',
            metadata: {
              fileSize: fileContent.length,
              commitMessage: await this._getCommitMessage(commitHash)
            }
          };
          
          // Add attestation note
          await this.notesManager.addAttestationNote(blobHash, attestation);
          attestations.push(attestation);
          this.stats.attestationsGenerated++;
          
        } catch (fileError) {
          this.logger.warn(`Failed to generate attestation for ${file}:`, fileError.message);
        }
      }
      
      this.logger.info(`Generated ${attestations.length} attestations for commit ${commitHash}`);
      this.emit('attestations-generated', {
        hook: 'post-commit',
        commitHash,
        attestations,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      this.logger.error('Post-commit hook failed:', error);
      this.emit('hook-error', { hook: 'post-commit', error });
    }
  }

  /**
   * Pre-push hook handler - Check for drift and policy compliance
   * @param {string} remoteName - Remote name being pushed to
   * @param {string} remoteUrl - Remote URL being pushed to
   * @returns {Promise<boolean>} True if push should proceed
   */
  async _prePushHandler(remoteName, remoteUrl) {
    try {
      this.logger.info('Running pre-push drift detection...');
      const startTime = Date.now();
      
      // Get commits being pushed
      const { stdout } = await execAsync('git log --oneline @{u}..HEAD', {
        cwd: this.config.gitDir.replace('/.git', '')
      }).catch(() => ({ stdout: '' })); // Ignore error if no upstream
      
      const commitsToPush = stdout.trim().split('\n').filter(line => line).map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return { hash, message: messageParts.join(' ') };
      });
      
      if (commitsToPush.length === 0) {
        this.logger.info('No new commits to push');
        return true;
      }
      
      // Check each commit for policy compliance
      const complianceResults = [];
      
      for (const commit of commitsToPush) {
        const result = await this._checkCommitCompliance(commit.hash);
        complianceResults.push({ commit, ...result });
      }
      
      // Check for policy violations
      const violations = complianceResults.filter(r => !r.compliant);
      
      if (violations.length > 0 && this.config.strictMode) {
        this.logger.error(`Policy violations detected in ${violations.length} commits:`, violations);
        this.emit('policy-violations', {
          hook: 'pre-push',
          violations,
          remoteName,
          remoteUrl,
          duration: Date.now() - startTime
        });
        return false;
      }
      
      // Check for drift
      const driftResults = await this._detectDrift(commitsToPush);
      
      if (driftResults.hasDrift && this.config.enableDriftDetection) {
        this.logger.warn('Drift detected:', driftResults);
        this.emit('drift-detected', {
          hook: 'pre-push',
          drift: driftResults,
          remoteName,
          remoteUrl,
          duration: Date.now() - startTime
        });
        
        if (this.config.strictMode) {
          return false;
        }
      }
      
      this.logger.info(`Pre-push validation completed: ${commitsToPush.length} commits checked`);
      this.emit('push-validation-completed', {
        hook: 'pre-push',
        commits: commitsToPush,
        complianceResults,
        driftResults,
        duration: Date.now() - startTime
      });
      
      return true;
      
    } catch (error) {
      this.logger.error('Pre-push hook failed:', error);
      this.emit('hook-error', { hook: 'pre-push', error });
      return !this.config.strictMode;
    }
  }

  /**
   * Prepare commit message hook handler - Add provenance information
   * @param {string} commitMsgFile - Path to commit message file
   * @param {string} commitSource - Source of the commit (message, template, merge, etc.)
   * @returns {Promise<void>}
   */
  async _prepareCommitMsgHandler(commitMsgFile, commitSource) {
    try {
      // Read current commit message
      const currentMessage = await fs.readFile(commitMsgFile, 'utf8');
      
      // Skip if this is a merge commit or already has kgen metadata
      if (commitSource === 'merge' || currentMessage.includes('[kgen:')) {
        return;
      }
      
      // Get staged files
      const stagedFiles = await this._getStagedFiles();
      
      if (stagedFiles.length === 0) {
        return;
      }
      
      // Generate provenance metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        filesCount: stagedFiles.length,
        generator: 'kgen-core',
        version: '1.0'
      };
      
      // Append metadata to commit message
      const enhancedMessage = currentMessage.trim() + 
        '\n\n' + 
        `[kgen:metadata] ${JSON.stringify(metadata)}`;
      
      // Write back enhanced message
      await fs.writeFile(commitMsgFile, enhancedMessage);
      
      this.logger.debug('Enhanced commit message with kgen metadata');
      
    } catch (error) {
      this.logger.warn('Prepare commit message hook failed:', error.message);
      // Don't fail the commit for this
    }
  }

  /**
   * Install a specific git hook
   * @param {string} hookName - Name of the hook
   * @param {Function} handler - Hook handler function
   * @param {Object} options - Installation options
   * @returns {Promise<void>}
   */
  async _installHook(hookName, handler, options = {}) {
    const hookPath = path.join(this.config.hooksDir, hookName);
    
    // Backup existing hook if requested
    if (await fs.pathExists(hookPath) && this.config.backupExistingHooks) {
      await fs.copy(hookPath, `${hookPath}.kgen-backup`);
      this.logger.info(`Backed up existing ${hookName} hook`);
    }
    
    // Create hook script
    const hookScript = this._generateHookScript(hookName, handler);
    
    // Write hook file
    await fs.writeFile(hookPath, hookScript, { mode: 0o755 });
    
    this.installedHooks.add(hookName);
    this.stats.hooksInstalled++;
    
    this.logger.debug(`Installed ${hookName} hook`);
  }

  /**
   * Uninstall a specific git hook
   * @param {string} hookName - Name of the hook
   * @param {Object} options - Uninstallation options
   * @returns {Promise<void>}
   */
  async _uninstallHook(hookName, options = {}) {
    const hookPath = path.join(this.config.hooksDir, hookName);
    const backupPath = `${hookPath}.kgen-backup`;
    
    // Remove kgen hook
    if (await fs.pathExists(hookPath)) {
      await fs.remove(hookPath);
      this.logger.debug(`Removed ${hookName} hook`);
    }
    
    // Restore backup if exists
    if (await fs.pathExists(backupPath)) {
      await fs.copy(backupPath, hookPath);
      await fs.remove(backupPath);
      this.logger.debug(`Restored original ${hookName} hook from backup`);
    }
    
    this.installedHooks.delete(hookName);
  }

  /**
   * Generate hook script content
   * @param {string} hookName - Hook name
   * @param {Function} handler - Handler function
   * @returns {string} Hook script content
   */
  _generateHookScript(hookName, handler) {
    return `#!/usr/bin/env node
/*
 * KGEN Git Hook: ${hookName}
 * Generated by kgen-core git hooks manager
 * Do not edit manually - use kgen hooks management commands
 */

const { GitHooksManager } = require('${__filename}');

async function main() {
  const manager = new GitHooksManager(${JSON.stringify(this.config)});
  
  try {
    const args = process.argv.slice(2);
    const result = await manager.${handler.name}(...args);
    
    if (result === false) {
      console.error('Hook validation failed');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Hook execution failed:', error.message);
    process.exit(1);
  }
}

main();
`;
  }

  /**
   * Get staged files
   * @returns {Promise<Array<string>>} List of staged files
   */
  async _getStagedFiles() {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', {
        cwd: this.config.gitDir.replace('/.git', '')
      });
      return stdout.trim().split('\n').filter(f => f);
    } catch (error) {
      this.logger.warn('Failed to get staged files:', error.message);
      return [];
    }
  }

  /**
   * Validate an artifact file
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Validation result
   */
  async _validateArtifact(filePath) {
    try {
      const fullPath = path.join(this.config.gitDir.replace('/.git', ''), filePath);
      
      // Check if file exists
      if (!await fs.pathExists(fullPath)) {
        return { valid: false, reason: 'File does not exist' };
      }
      
      // Get file stats
      const stats = await fs.stat(fullPath);
      
      // Basic validations
      if (stats.size === 0) {
        return { valid: false, reason: 'File is empty' };
      }
      
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        return { valid: false, reason: 'File too large' };
      }
      
      // File extension checks
      const ext = path.extname(filePath).toLowerCase();
      const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif'];
      
      if (dangerousExts.includes(ext)) {
        return { valid: false, reason: 'Dangerous file extension' };
      }
      
      return { valid: true, size: stats.size };
      
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Check commit compliance with policies
   * @param {string} commitHash - Commit hash to check
   * @returns {Promise<Object>} Compliance result
   */
  async _checkCommitCompliance(commitHash) {
    try {
      // Get commit message
      const message = await this._getCommitMessage(commitHash);
      
      // Basic compliance checks
      const checks = {
        hasMessage: message.trim().length > 0,
        messageLength: message.length >= 10, // At least 10 characters
        noSecrets: !this._containsSecrets(message),
        validFormat: this._validateCommitFormat(message)
      };
      
      const compliant = Object.values(checks).every(check => check);
      
      return {
        compliant,
        checks,
        message: message.substring(0, 100) // First 100 chars
      };
      
    } catch (error) {
      return {
        compliant: false,
        error: error.message
      };
    }
  }

  /**
   * Detect drift in commits
   * @param {Array} commits - Commits to check
   * @returns {Promise<Object>} Drift detection result
   */
  async _detectDrift(commits) {
    try {
      // This is a simplified drift detection
      // In practice, this would compare against baseline artifacts
      
      const driftIndicators = [];
      
      for (const commit of commits) {
        // Check for large changes
        const { stdout } = await execAsync(`git show --stat ${commit.hash}`, {
          cwd: this.config.gitDir.replace('/.git', '')
        });
        
        // Look for indicators of drift
        if (stdout.includes('100%') || stdout.includes('new file')) {
          driftIndicators.push({
            type: 'large-change',
            commit: commit.hash,
            description: 'Commit contains significant changes'
          });
        }
      }
      
      return {
        hasDrift: driftIndicators.length > 0,
        indicators: driftIndicators,
        checked: commits.length
      };
      
    } catch (error) {
      this.logger.warn('Drift detection failed:', error.message);
      return { hasDrift: false, error: error.message };
    }
  }

  /**
   * Get commit message
   * @param {string} commitHash - Commit hash
   * @returns {Promise<string>} Commit message
   */
  async _getCommitMessage(commitHash) {
    try {
      const { stdout } = await execAsync(`git log --format=%B -n 1 ${commitHash}`, {
        cwd: this.config.gitDir.replace('/.git', '')
      });
      return stdout.trim();
    } catch (error) {
      this.logger.warn(`Failed to get commit message for ${commitHash}:`, error.message);
      return '';
    }
  }

  /**
   * Check if content contains secrets
   * @param {string} content - Content to check
   * @returns {boolean} True if secrets detected
   */
  _containsSecrets(content) {
    const secretPatterns = [
      /password\s*[=:]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
      /secret\s*[=:]\s*['"][^'"]+['"]/i,
      /token\s*[=:]\s*['"][^'"]+['"]/i,
      /-----BEGIN (RSA )?PRIVATE KEY-----/
    ];
    
    return secretPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Validate commit message format
   * @param {string} message - Commit message
   * @returns {boolean} True if format is valid
   */
  _validateCommitFormat(message) {
    // Allow any reasonable commit message format
    // Could be extended to enforce conventional commits, etc.
    return message.trim().length >= 10 && !message.startsWith('WIP');
  }

  /**
   * Ensure hooks directory exists
   * @returns {Promise<void>}
   */
  async _ensureHooksDirectory() {
    await fs.ensureDir(this.config.hooksDir);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      installedHooks: Array.from(this.installedHooks)
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.blobStorage.cleanup();
    await this.notesManager.cleanup();
    this.removeAllListeners();
    this.logger.info('Git hooks manager cleanup completed');
  }
}

/**
 * Create git hooks manager instance
 * @param {Object} config - Configuration options
 * @returns {GitHooksManager} Initialized manager instance
 */
export function createGitHooksManager(config = {}) {
  return new GitHooksManager(config);
}

export default GitHooksManager;
