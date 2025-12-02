/**
 * Enhanced Attestation System - Main Entry Point
 *
 * Provides comprehensive SLSA-compliant attestation system for kgen with:
 * - Ed25519 cryptographic signing using jose library
 * - Git-notes integration for receipt storage
 * - Trust policy enforcement
 * - SLSA compliance validation
 * - Batch verification capabilities
 */

export { AttestationGenerator } from './generator.js';
export { AttestationVerifier } from './verifier.js';
export { GitNotesManager } from './git-notes.js';

import { AttestationGenerator } from './generator.js';
import { AttestationVerifier } from './verifier.js';
import { GitNotesManager } from './git-notes.js';
import consola from 'consola';

/**
 * Complete Enhanced Attestation System
 */
export class AttestationSystem {
  constructor(config = {}) {
    this.config = {
      enableAutoVerification: true,
      enableBatchProcessing: true,
      ...config
    };

    this.logger = consola.withTag('attestation-system');
    this.initialized = false;

    // Initialize components
    this.generator = new AttestationGenerator(this.config.generator);
    this.verifier = new AttestationVerifier(this.config.verifier);
    this.gitNotes = new GitNotesManager(this.config.gitNotes);
  }

  /**
   * Initialize the complete attestation system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.logger.info('Initializing enhanced attestation system...');

      await Promise.all([
        this.generator.initialize(),
        this.verifier.initialize(),
        this.gitNotes.initialize()
      ]);

      this.initialized = true;
      this.logger.success('Enhanced attestation system initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize attestation system:', error);
      throw error;
    }
  }

  /**
   * Generate SLSA-compliant attestation for an artifact
   */
  async generateAttestation(artifactPath, context) {
    if (!this.initialized) await this.initialize();

    try {
      this.logger.info(`Generating attestation for: ${artifactPath}`);

      // Generate attestation
      const result = await this.generator.generateAttestation(artifactPath, context);

      // Auto-verify if enabled
      let verification;
      if (this.config.enableAutoVerification) {
        verification = await this.verifier.verifyAttestation(
          result.attestationPath,
          { deep: true, artifactPath }
        );

        if (!verification.verified) {
          this.logger.warn('Generated attestation failed verification:', verification.errors);
        } else {
          this.logger.success('Generated attestation verified successfully');
        }
      }

      return {
        ...result,
        verification
      };

    } catch (error) {
      this.logger.error(`Failed to generate attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Verify attestation with full SLSA compliance checking
   */
  async verifyAttestation(attestationPath, options = {}) {
    if (!this.initialized) await this.initialize();

    return this.verifier.verifyAttestation(attestationPath, options);
  }

  /**
   * Batch verify multiple attestations
   */
  async batchVerify(attestationPaths, options = {}) {
    if (!this.initialized) await this.initialize();

    if (!this.config.enableBatchProcessing) {
      throw new Error('Batch processing is disabled');
    }

    return this.verifier.batchVerify(attestationPaths, options);
  }

  /**
   * Get attestation receipts for a git commit
   */
  async getReceipts(gitSHA) {
    if (!this.initialized) await this.initialize();

    return this.gitNotes.getReceipts(gitSHA);
  }

  /**
   * Get attestation receipts for a specific artifact
   */
  async getReceiptsForArtifact(artifactPath) {
    if (!this.initialized) await this.initialize();

    return this.gitNotes.getReceiptsForArtifact(artifactPath);
  }

  /**
   * Verify receipt integrity
   */
  async verifyReceipt(receipt) {
    if (!this.initialized) await this.initialize();

    return this.gitNotes.verifyReceipt(receipt);
  }

  /**
   * Generate cryptographic keys for signing
   */
  async generateKeys() {
    if (!this.initialized) await this.initialize();

    return this.generator.generateKeys();
  }

  /**
   * Validate trust policy configuration
   */
  async validateTrustPolicy(policyPath) {
    if (!this.initialized) await this.initialize();

    return this.verifier.validateTrustPolicy(policyPath);
  }

  /**
   * Clean up old receipts
   */
  async cleanupReceipts(options = {}) {
    if (!this.initialized) await this.initialize();

    return this.gitNotes.cleanupReceipts(options);
  }

  /**
   * Get comprehensive system statistics
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      generator: this.initialized ? this.generator.getStatistics?.() : null,
      verifier: this.initialized ? this.verifier.getStatistics() : null,
      gitNotes: this.initialized ? { receiptsDirectory: this.gitNotes['config']?.receiptDirectory } : null,
      config: this.config
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    if (this.initialized) {
      this.verifier.clearCache();
    }
    this.logger.info('All caches cleared');
  }

  /**
   * Export system configuration
   */
  exportConfig() {
    return {
      ...this.config,
      generator: this.generator['config'],
      verifier: this.verifier['config'],
      gitNotes: this.gitNotes['config']
    };
  }
}

/**
 * Factory function to create attestation system
 */
export function createAttestationSystem(config = {}) {
  return new AttestationSystem(config);
}

/**
 * Default attestation system instance
 */
let defaultSystem = null;

/**
 * Get or create default attestation system
 */
export function getDefaultAttestationSystem(config) {
  if (!defaultSystem) {
    defaultSystem = new AttestationSystem(config);
  }
  return defaultSystem;
}

/**
 * CLI integration helpers
 */
export class AttestationCLI {
  constructor(system) {
    this.system = system || getDefaultAttestationSystem();
    this.logger = consola.withTag('attestation-cli');
  }

  /**
   * Generate attestation from CLI command
   */
  async generate(args) {
    try {
      const context = {
        command: args.command || 'kgen',
        args: args.args || [],
        templatePath: args.template,
        variables: args.variables || {},
        workingDirectory: process.cwd(),
        environment: process.env
      };

      const result = await this.system.generateAttestation(args.artifact, context);

      this.logger.success(`Attestation generated: ${result.attestationPath}`);
      if (result.receiptPath) {
        this.logger.success(`Receipt stored: ${result.receiptPath}`);
      }
      if (result.verification?.verified) {
        this.logger.success(`Attestation verified (SLSA Level ${result.verification.slsaLevel})`);
      }

      if (args.output) {
        await import('fs').then(fs =>
          fs.promises.writeFile(
            args.output,
            JSON.stringify({
              attestationPath: result.attestationPath,
              receiptPath: result.receiptPath,
              verified: result.verification?.verified,
              slsaLevel: result.verification?.slsaLevel
            }, null, 2)
          )
        );
      }

    } catch (error) {
      this.logger.error('Failed to generate attestation:', error);
      throw error;
    }
  }

  /**
   * Verify attestation from CLI command
   */
  async verify(args) {
    try {
      const result = await this.system.verifyAttestation(args.attestation, {
        deep: args.deep,
        artifactPath: args.artifact
      });

      if (result.verified) {
        this.logger.success(`Attestation verified (SLSA Level ${result.slsaLevel})`);
        if (result.trustPolicy?.satisfied) {
          this.logger.success('Trust policy satisfied');
        }
        if (result.signatures?.verified) {
          this.logger.success(`Signatures verified (${result.signatures.validSignatures} valid)`);
        }
      } else {
        this.logger.error('Attestation verification failed');
        if (result.errors?.length) {
          result.errors.forEach(error => this.logger.error(`  ${error}`));
        }
      }

      if (args.output) {
        await import('fs').then(fs =>
          fs.promises.writeFile(args.output, JSON.stringify(result, null, 2))
        );
      }

    } catch (error) {
      this.logger.error('Failed to verify attestation:', error);
      throw error;
    }
  }

  /**
   * Show receipts for artifact or commit
   */
  async receipts(args) {
    try {
      let receipts;

      if (args.artifact) {
        receipts = await this.system.getReceiptsForArtifact(args.artifact);
        this.logger.info(`Found ${receipts.length} receipts for artifact: ${args.artifact}`);
      } else if (args.commit) {
        receipts = await this.system.getReceipts(args.commit);
        this.logger.info(`Found ${receipts.length} receipts for commit: ${args.commit}`);
      } else {
        throw new Error('Must specify either --artifact or --commit');
      }

      if (args.format === 'table') {
        // Format as table
        const table = receipts.map(r => ({
          'Receipt ID': r.id.substring(0, 8),
          'Git SHA': r.gitSHA.substring(0, 8),
          'Artifact': r.artifactPath.split('/').pop(),
          'Created': new Date(r.createdAt).toLocaleDateString(),
          'Version': r.version
        }));
        console.table(table);
      } else {
        // JSON format
        const output = JSON.stringify(receipts, null, 2);
        if (args.output) {
          await import('fs').then(fs => fs.promises.writeFile(args.output, output));
        } else {
          console.log(output);
        }
      }

    } catch (error) {
      this.logger.error('Failed to get receipts:', error);
      throw error;
    }
  }

  /**
   * Initialize attestation keys
   */
  async initKeys() {
    try {
      const keys = await this.system.generateKeys();
      this.logger.success('Generated new Ed25519 key pair for attestation signing');
      this.logger.info('Keys stored in .kgen/keys/ directory');

    } catch (error) {
      this.logger.error('Failed to initialize keys:', error);
      throw error;
    }
  }

  /**
   * Validate trust policy
   */
  async validateTrustPolicy(policyPath) {
    try {
      const result = await this.system.validateTrustPolicy(policyPath);

      if (result.valid) {
        this.logger.success('Trust policy is valid');
        if (result.policy) {
          this.logger.info(`  Version: ${result.policy.version}`);
          this.logger.info(`  Trusted signers: ${result.policy.trustedSigners.length}`);
          this.logger.info(`  Required signatures: ${result.policy.requiredSignatures}`);
          this.logger.info(`  SLSA level: ${result.policy.slsaLevel}`);
        }
      } else {
        this.logger.error('Trust policy validation failed:');
        result.errors.forEach(error => this.logger.error(`  ${error}`));
      }

    } catch (error) {
      this.logger.error('Failed to validate trust policy:', error);
      throw error;
    }
  }
}

// Default export for convenience
export default AttestationSystem;