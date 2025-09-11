/**
 * Attestation System - Main Entry Point
 * 
 * Provides comprehensive attestation system for kgen with .attest.json
 * sidecar generation, cryptographic verification, and blockchain anchoring.
 */

export { AttestationGenerator } from './generator.js';
export { AttestationCommands } from './commands.js';
export { AttestationVerifier } from './verifier.js';

import { AttestationGenerator } from './generator.js';
import { AttestationCommands } from './commands.js';
import { AttestationVerifier } from './verifier.js';

/**
 * Factory function to create attestation system
 * @param {Object} config - Configuration options
 * @returns {Object} Attestation system instance
 */
export function createAttestationSystem(config = {}) {
  return new AttestationSystem(config);
}

/**
 * Complete Attestation System
 */
export class AttestationSystem {
  constructor(config = {}) {
    this.config = {
      // Default configuration
      enableCryptographicHashing: true,
      enableBlockchainIntegrity: process.env.KGEN_BLOCKCHAIN_ENABLED === 'true',
      enableFastVerification: true,
      cacheVerificationResults: true,
      ...config
    };
    
    // Initialize components
    this.generator = new AttestationGenerator(this.config);
    this.verifier = new AttestationVerifier(this.config);
    this.commands = new AttestationCommands(this.config);
    
    this.initialized = false;
  }

  /**
   * Initialize the complete attestation system
   */
  async initialize() {
    if (this.initialized) return this;
    
    await this.generator.initialize();
    await this.commands.initialize();
    
    this.initialized = true;
    return this;
  }

  /**
   * Generate attestation for an artifact
   * @param {string} artifactPath - Path to artifact
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Attestation result
   */
  async generateAttestation(artifactPath, context) {
    if (!this.initialized) await this.initialize();
    return this.generator.generateAttestation(artifactPath, context);
  }

  /**
   * Verify attestation for an artifact
   * @param {string} artifactPath - Path to artifact
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(artifactPath, options = {}) {
    if (!this.initialized) await this.initialize();
    
    if (options.fast !== false) {
      return this.verifier.fastVerify(artifactPath, options);
    } else {
      return this.generator.verifyAttestation(artifactPath);
    }
  }

  /**
   * Explain artifact origin
   * @param {string} artifactPath - Path to artifact
   * @param {Object} options - Explanation options
   * @returns {Promise<Object>} Explanation result
   */
  async explainArtifact(artifactPath, options = {}) {
    if (!this.initialized) await this.initialize();
    return this.commands.explainArtifact(artifactPath, options);
  }

  /**
   * Batch verify multiple artifacts
   * @param {Array|string} paths - Artifact paths or directory
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} Batch results
   */
  async batchVerify(paths, options = {}) {
    if (!this.initialized) await this.initialize();
    
    if (options.fast !== false) {
      return this.verifier.batchVerify(Array.isArray(paths) ? paths : [paths], options);
    } else {
      return this.commands.batchVerify(paths, options);
    }
  }

  /**
   * Get system statistics
   * @returns {Object} System statistics
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      generator: this.generator.getStatistics(),
      verifier: this.verifier.getStatistics(),
      config: this.config
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.verifier.clearCache();
  }
}

// Default export for convenience
export default AttestationSystem;