/**
 * Git-First Policy Enforcement System
 * 
 * Provides comprehensive policy enforcement for git-native operations including:
 * - Artifact validation policies
 * - Attestation requirements
 * - Drift detection policies
 * - Compliance enforcement
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export class GitPolicyEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      policyDir: config.policyDir || process.cwd() + '/.kgen/policies',
      enableStrictMode: config.enableStrictMode || false,
      enableAuditLogging: config.enableAuditLogging !== false,
      maxArtifactSize: config.maxArtifactSize || 50 * 1024 * 1024, // 50MB
      requiredAttestations: config.requiredAttestations || ['integrity', 'provenance'],
      allowedFileExtensions: config.allowedFileExtensions || ['.js', '.ts', '.json', '.md', '.txt', '.yml', '.yaml'],
      blockedPatterns: config.blockedPatterns || [],
      ...config
    };
    
    this.logger = new Consola({ tag: 'git-policy' });
    this.policies = new Map();
    this.auditLog = [];
    
    this.stats = {
      policiesLoaded: 0,
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      violationsDetected: 0,
      policiesEnforced: 0
    };
    
    // Load default policies
    this._loadDefaultPolicies();
  }

  /**
   * Initialize policy engine
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Ensure policy directory exists
      await fs.ensureDir(this.config.policyDir);
      
      // Load custom policies from filesystem
      await this._loadCustomPolicies();
      
      this.logger.info(`Policy engine initialized with ${this.policies.size} policies`);
      this.emit('initialized', { policiesCount: this.policies.size });
      
    } catch (error) {
      this.logger.error('Failed to initialize policy engine:', error);
      throw error;
    }
  }

  /**
   * Validate artifact against all applicable policies
   * @param {Object} artifact - Artifact to validate
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Validation result
   */
  async validateArtifact(artifact, context = {}) {
    const startTime = Date.now();
    const validationId = crypto.randomBytes(16).toString('hex');
    
    try {
      this.stats.validationsPerformed++;
      
      const results = [];
      const violations = [];
      
      // Run all applicable policies
      for (const [policyName, policy] of this.policies) {
        if (this._isPolicyApplicable(policy, artifact, context)) {
          try {
            const result = await this._executePolicyValidation(policy, artifact, context);
            results.push({ policy: policyName, ...result });
            
            if (!result.passed) {
              violations.push({ policy: policyName, ...result });
            }
          } catch (policyError) {
            this.logger.warn(`Policy '${policyName}' execution failed:`, policyError.message);
            violations.push({
              policy: policyName,
              passed: false,
              error: policyError.message,
              severity: 'error'
            });
          }
        }
      }
      
      const passed = violations.length === 0;
      
      if (passed) {
        this.stats.validationsPassed++;
      } else {
        this.stats.validationsFailed++;
        this.stats.violationsDetected += violations.length;
      }
      
      // Create audit log entry
      const auditEntry = {
        validationId,
        timestamp: new Date().toISOString(),
        artifactId: artifact.id || artifact.hash || 'unknown',
        passed,
        violationsCount: violations.length,
        duration: Date.now() - startTime,
        context: {
          operation: context.operation || 'unknown',
          user: context.user || 'system',
          source: context.source || 'unknown'
        }
      };
      
      if (this.config.enableAuditLogging) {
        this.auditLog.push(auditEntry);
        this._pruneAuditLog();
      }
      
      const validationResult = {
        validationId,
        passed,
        violations,
        results,
        summary: {
          totalPolicies: results.length,
          passedPolicies: results.filter(r => r.passed).length,
          failedPolicies: violations.length,
          duration: Date.now() - startTime
        },
        audit: auditEntry
      };
      
      this.emit('validation-completed', validationResult);
      
      if (!passed && this.config.enableStrictMode) {
        this.emit('policy-violation', {
          validationId,
          violations,
          artifact: artifact.id || artifact.hash
        });
      }
      
      return validationResult;
      
    } catch (error) {
      this.logger.error(`Artifact validation failed:`, error);
      this.stats.validationsFailed++;
      
      return {
        validationId,
        passed: false,
        error: error.message,
        violations: [{
          policy: 'validation-system',
          passed: false,
          error: error.message,
          severity: 'critical'
        }],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Enforce policies during git operations
   * @param {string} operation - Git operation being performed
   * @param {Object} data - Operation data
   * @returns {Promise<Object>} Enforcement result
   */
  async enforceGitOperation(operation, data) {
    const startTime = Date.now();
    
    try {
      this.stats.policiesEnforced++;
      
      const enforcementResult = {
        operation,
        allowed: true,
        policies: [],
        warnings: [],
        blockers: []
      };
      
      // Check operation-specific policies
      switch (operation) {
        case 'pre-commit':
          await this._enforcePreCommitPolicies(data, enforcementResult);
          break;
          
        case 'post-commit':
          await this._enforcePostCommitPolicies(data, enforcementResult);
          break;
          
        case 'pre-push':
          await this._enforcePrePushPolicies(data, enforcementResult);
          break;
          
        case 'blob-storage':
          await this._enforceBlobStoragePolicies(data, enforcementResult);
          break;
          
        case 'attestation':
          await this._enforceAttestationPolicies(data, enforcementResult);
          break;
          
        default:
          this.logger.warn(`Unknown git operation for policy enforcement: ${operation}`);
      }
      
      // Determine final result
      enforcementResult.allowed = enforcementResult.blockers.length === 0;
      
      if (!enforcementResult.allowed) {
        this.logger.warn(`Git operation '${operation}' blocked by policies:`, enforcementResult.blockers);
        this.emit('operation-blocked', { operation, blockers: enforcementResult.blockers });
      }
      
      enforcementResult.duration = Date.now() - startTime;
      
      return enforcementResult;
      
    } catch (error) {
      this.logger.error(`Policy enforcement failed for operation '${operation}':`, error);
      return {
        operation,
        allowed: !this.config.enableStrictMode, // Allow in non-strict mode on error
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Register a custom policy
   * @param {string} name - Policy name
   * @param {Object} policy - Policy definition
   */
  registerPolicy(name, policy) {
    if (!policy.validate || typeof policy.validate !== 'function') {
      throw new Error('Policy must have a validate function');
    }
    
    const enhancedPolicy = {
      name,
      description: policy.description || 'Custom policy',
      severity: policy.severity || 'warning',
      category: policy.category || 'custom',
      applicability: policy.applicability || (() => true),
      validate: policy.validate,
      metadata: policy.metadata || {},
      registeredAt: new Date().toISOString()
    };
    
    this.policies.set(name, enhancedPolicy);
    this.stats.policiesLoaded++;
    
    this.logger.info(`Registered custom policy: ${name}`);
    this.emit('policy-registered', { name, policy: enhancedPolicy });
  }

  /**
   * Unregister a policy
   * @param {string} name - Policy name
   */
  unregisterPolicy(name) {
    const removed = this.policies.delete(name);
    if (removed) {
      this.logger.info(`Unregistered policy: ${name}`);
      this.emit('policy-unregistered', { name });
    }
    return removed;
  }

  /**
   * Get policy by name
   * @param {string} name - Policy name
   * @returns {Object|null} Policy or null
   */
  getPolicy(name) {
    return this.policies.get(name) || null;
  }

  /**
   * List all policies
   * @param {Object} filters - Filtering options
   * @returns {Array} List of policies
   */
  listPolicies(filters = {}) {
    let policies = Array.from(this.policies.values());
    
    if (filters.category) {
      policies = policies.filter(p => p.category === filters.category);
    }
    
    if (filters.severity) {
      policies = policies.filter(p => p.severity === filters.severity);
    }
    
    return policies;
  }

  /**
   * Load default policies
   */
  _loadDefaultPolicies() {
    // File size policy
    this.registerPolicy('artifact-size-limit', {
      description: 'Enforce maximum artifact size',
      severity: 'error',
      category: 'storage',
      validate: async (artifact) => {
        const size = artifact.size || (artifact.content ? Buffer.byteLength(artifact.content) : 0);
        const maxSize = this.config.maxArtifactSize;
        
        return {
          passed: size <= maxSize,
          message: size > maxSize ? `Artifact size ${size} exceeds limit ${maxSize}` : 'Size check passed',
          metadata: { size, limit: maxSize }
        };
      }
    });
    
    // File extension policy
    this.registerPolicy('allowed-file-extensions', {
      description: 'Enforce allowed file extensions',
      severity: 'warning',
      category: 'security',
      validate: async (artifact, context) => {
        if (!context.filePath) {
          return { passed: true, message: 'No file path provided' };
        }
        
        const ext = path.extname(context.filePath).toLowerCase();
        const allowed = this.config.allowedFileExtensions;
        
        return {
          passed: allowed.length === 0 || allowed.includes(ext),
          message: allowed.includes(ext) ? 'File extension allowed' : `File extension '${ext}' not allowed`,
          metadata: { extension: ext, allowedExtensions: allowed }
        };
      }
    });
    
    // Blocked patterns policy
    this.registerPolicy('blocked-content-patterns', {
      description: 'Check for blocked content patterns',
      severity: 'error',
      category: 'security',
      validate: async (artifact) => {
        if (!artifact.content || this.config.blockedPatterns.length === 0) {
          return { passed: true, message: 'No content or patterns to check' };
        }
        
        const content = artifact.content.toString();
        const violations = [];
        
        for (const pattern of this.config.blockedPatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            violations.push(pattern);
          }
        }
        
        return {
          passed: violations.length === 0,
          message: violations.length > 0 ? `Blocked patterns found: ${violations.join(', ')}` : 'No blocked patterns detected',
          metadata: { violations, patterns: this.config.blockedPatterns }
        };
      }
    });
    
    // Required attestations policy
    this.registerPolicy('required-attestations', {
      description: 'Ensure required attestations are present',
      severity: 'error',
      category: 'compliance',
      validate: async (artifact, context) => {
        const attestations = context.attestations || [];
        const required = this.config.requiredAttestations;
        const present = attestations.map(a => a.type || a.attestationType);
        const missing = required.filter(r => !present.includes(r));
        
        return {
          passed: missing.length === 0,
          message: missing.length > 0 ? `Missing required attestations: ${missing.join(', ')}` : 'All required attestations present',
          metadata: { required, present, missing }
        };
      }
    });
    
    this.logger.debug('Loaded default policies');
  }

  /**
   * Load custom policies from filesystem
   */
  async _loadCustomPolicies() {
    try {
      if (!await fs.pathExists(this.config.policyDir)) {
        return;
      }
      
      const policyFiles = await fs.readdir(this.config.policyDir);
      
      for (const file of policyFiles) {
        if (path.extname(file) === '.js' || path.extname(file) === '.json') {
          try {
            const policyPath = path.join(this.config.policyDir, file);
            const policyModule = await import(policyPath);
            const policy = policyModule.default || policyModule;
            
            const policyName = path.basename(file, path.extname(file));
            this.registerPolicy(policyName, policy);
            
          } catch (loadError) {
            this.logger.warn(`Failed to load policy file '${file}':`, loadError.message);
          }
        }
      }
      
    } catch (error) {
      this.logger.warn('Failed to load custom policies:', error.message);
    }
  }

  /**
   * Check if policy is applicable to artifact
   */
  _isPolicyApplicable(policy, artifact, context) {
    if (policy.applicability && typeof policy.applicability === 'function') {
      try {
        return policy.applicability(artifact, context);
      } catch (error) {
        this.logger.warn(`Policy applicability check failed for '${policy.name}':`, error.message);
        return false;
      }
    }
    return true;
  }

  /**
   * Execute policy validation
   */
  async _executePolicyValidation(policy, artifact, context) {
    const startTime = Date.now();
    
    try {
      const result = await policy.validate(artifact, context);
      
      return {
        passed: result.passed === true,
        message: result.message || 'Policy validation completed',
        severity: result.severity || policy.severity,
        metadata: result.metadata || {},
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Enforce pre-commit policies
   */
  async _enforcePreCommitPolicies(data, result) {
    // Check staged files
    if (data.stagedFiles) {
      for (const file of data.stagedFiles) {
        const validation = await this.validateArtifact(
          { filePath: file },
          { operation: 'pre-commit', filePath: file }
        );
        
        result.policies.push(`file-validation:${file}`);
        
        if (!validation.passed) {
          result.blockers.push({
            type: 'file-validation',
            file,
            violations: validation.violations
          });
        }
      }
    }
  }

  /**
   * Enforce post-commit policies
   */
  async _enforcePostCommitPolicies(data, result) {
    // Check if attestations should be generated
    if (this.config.requiredAttestations.length > 0) {
      result.policies.push('attestation-generation');
      
      if (!data.generateAttestations) {
        result.warnings.push({
          type: 'missing-attestation-generation',
          message: 'Attestation generation not scheduled'
        });
      }
    }
  }

  /**
   * Enforce pre-push policies
   */
  async _enforcePrePushPolicies(data, result) {
    // Check for drift
    if (data.commits && this.config.enableDriftDetection) {
      result.policies.push('drift-detection');
      
      // This would integrate with drift detection logic
      // For now, just log the check
      this.logger.debug(`Checking ${data.commits.length} commits for drift`);
    }
  }

  /**
   * Enforce blob storage policies
   */
  async _enforceBlobStoragePolicies(data, result) {
    const validation = await this.validateArtifact(data.artifact || data, {
      operation: 'blob-storage'
    });
    
    result.policies.push('blob-validation');
    
    if (!validation.passed) {
      result.blockers.push({
        type: 'blob-validation',
        violations: validation.violations
      });
    }
  }

  /**
   * Enforce attestation policies
   */
  async _enforceAttestationPolicies(data, result) {
    if (data.attestation) {
      const validation = await this.validateArtifact(data.attestation, {
        operation: 'attestation'
      });
      
      result.policies.push('attestation-validation');
      
      if (!validation.passed) {
        result.blockers.push({
          type: 'attestation-validation',
          violations: validation.violations
        });
      }
    }
  }

  /**
   * Prune audit log to prevent memory leaks
   */
  _pruneAuditLog() {
    const maxEntries = 1000;
    if (this.auditLog.length > maxEntries) {
      this.auditLog.splice(0, this.auditLog.length - maxEntries);
    }
  }

  /**
   * Get policy engine statistics
   */
  getStats() {
    return {
      ...this.stats,
      auditLogSize: this.auditLog.length,
      registeredPolicies: this.policies.size
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    let log = [...this.auditLog];
    
    if (filters.since) {
      const since = new Date(filters.since);
      log = log.filter(entry => new Date(entry.timestamp) >= since);
    }
    
    if (filters.passed !== undefined) {
      log = log.filter(entry => entry.passed === filters.passed);
    }
    
    return log;
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog.length = 0;
    this.logger.info('Audit log cleared');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.policies.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
    this.logger.info('Policy engine cleanup completed');
  }
}

/**
 * Create git policy engine instance
 * @param {Object} config - Configuration options
 * @returns {GitPolicyEngine} Initialized policy engine
 */
export function createGitPolicyEngine(config = {}) {
  return new GitPolicyEngine(config);
}

export default GitPolicyEngine;
