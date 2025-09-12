/**
 * Attestation Pipeline Integration - Integrates attestation generation into KGEN artifact pipeline
 * 
 * Provides seamless integration of cryptographic attestations with the existing
 * KGEN artifact generation workflow, ensuring every artifact gets proper provenance.
 */

import { AttestationGenerator } from './generator.js';
import { CryptoManager } from '../crypto/manager.js';
import { ComplianceAttestor } from '../compliance/attestor.js';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class AttestationPipeline {
  constructor(config = {}) {
    this.config = {
      enableAttestations: config.enableAttestations !== false,
      enableCryptographicSigning: config.enableCryptographicSigning !== false,
      enableComplianceValidation: config.enableComplianceValidation !== false,
      attestationVersion: config.attestationVersion || '1.0',
      outputSidecars: config.outputSidecars !== false,
      validateIntegrity: config.validateIntegrity !== false,
      ...config
    };
    
    this.logger = consola.withTag('attestation-pipeline');
    
    // Initialize components
    this.attestationGenerator = null;
    this.cryptoManager = null;
    this.complianceAttestor = null;
    
    this.state = 'uninitialized';
  }

  /**
   * Initialize the attestation pipeline
   */
  async initialize() {
    try {
      this.logger.info('Initializing attestation pipeline...');

      if (this.config.enableAttestations) {
        // Initialize attestation generator
        this.attestationGenerator = new AttestationGenerator({
          ...this.config,
          enableCryptographicSigning: this.config.enableCryptographicSigning
        });
        await this.attestationGenerator.initialize();
        this.logger.success('Attestation generator initialized');
      }

      if (this.config.enableComplianceValidation) {
        // Initialize compliance attestor
        this.complianceAttestor = new ComplianceAttestor(this.config);
        await this.complianceAttestor.initialize();
        this.logger.success('Compliance attestor initialized');
      }

      this.state = 'ready';
      this.logger.success('Attestation pipeline ready');

      return {
        status: 'success',
        components: {
          attestationGenerator: !!this.attestationGenerator,
          complianceAttestor: !!this.complianceAttestor,
          cryptographicSigning: this.config.enableCryptographicSigning
        }
      };

    } catch (error) {
      this.logger.error('Failed to initialize attestation pipeline:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Process artifact through attestation pipeline
   * @param {Object} artifact - Artifact information
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Pipeline result with attestations
   */
  async processArtifact(artifact, context) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Attestation pipeline not initialized');
      }

      if (!this.config.enableAttestations) {
        this.logger.debug('Attestations disabled, skipping processing');
        return {
          success: true,
          attestation: null,
          compliance: null,
          sidecars: []
        };
      }

      this.logger.info(`Processing artifact through attestation pipeline: ${artifact.path}`);
      
      const result = {
        success: true,
        attestation: null,
        compliance: null,
        sidecars: [],
        verification: null,
        errors: []
      };

      // Enhance context with pipeline metadata
      const enhancedContext = await this._enhanceContext(context, artifact);

      // Generate attestation
      if (this.attestationGenerator) {
        try {
          result.attestation = await this.attestationGenerator.generateAttestation(
            enhancedContext, 
            artifact
          );
          
          this.logger.success(`Generated attestation: ${result.attestation.attestationId}`);

          // Write sidecar file if enabled
          if (this.config.outputSidecars) {
            const sidecarPath = await this.attestationGenerator.writeAttestationSidecar(
              artifact.path,
              result.attestation
            );
            result.sidecars.push({
              type: 'attestation',
              path: sidecarPath
            });
          }

        } catch (error) {
          this.logger.error('Failed to generate attestation:', error);
          result.errors.push(`Attestation generation failed: ${error.message}`);
          result.success = false;
        }
      }

      // Generate compliance bundle
      if (this.complianceAttestor && result.attestation) {
        try {
          result.compliance = await this.complianceAttestor.generateBundle(enhancedContext);
          
          this.logger.success(`Generated compliance bundle: ${result.compliance.bundleId}`);

          // Write compliance sidecar if enabled
          if (this.config.outputSidecars) {
            const compliancePath = `${artifact.path}.compliance.json`;
            const { promises: fs } = await import('fs');
            await fs.writeFile(compliancePath, JSON.stringify(result.compliance, null, 2), 'utf8');
            
            result.sidecars.push({
              type: 'compliance',
              path: compliancePath
            });
          }

        } catch (error) {
          this.logger.error('Failed to generate compliance bundle:', error);
          result.errors.push(`Compliance generation failed: ${error.message}`);
          // Don't fail the entire process for compliance errors
        }
      }

      // Perform integrity validation if enabled
      if (this.config.validateIntegrity && result.attestation) {
        try {
          result.verification = await this._performIntegrityValidation(artifact, result.attestation);
          
          if (!result.verification.valid) {
            this.logger.warn('Integrity validation failed');
            result.errors.push('Integrity validation failed');
          }

        } catch (error) {
          this.logger.error('Failed to validate integrity:', error);
          result.errors.push(`Integrity validation failed: ${error.message}`);
        }
      }

      // Log summary
      if (result.success && result.errors.length === 0) {
        this.logger.success(`Attestation pipeline completed for: ${artifact.path}`);
      } else if (result.errors.length > 0) {
        this.logger.warn(`Attestation pipeline completed with ${result.errors.length} errors`);
      }

      return result;

    } catch (error) {
      this.logger.error(`Attestation pipeline failed for ${artifact.path}:`, error);
      return {
        success: false,
        error: error.message,
        attestation: null,
        compliance: null,
        sidecars: []
      };
    }
  }

  /**
   * Process multiple artifacts through pipeline
   * @param {Array} artifacts - Array of artifacts
   * @param {Object} context - Shared generation context
   * @returns {Promise<Object>} Batch processing result
   */
  async processArtifactBatch(artifacts, context) {
    try {
      this.logger.info(`Processing batch of ${artifacts.length} artifacts`);

      const batchResult = {
        success: true,
        processed: 0,
        failed: 0,
        attestations: [],
        sidecars: [],
        errors: []
      };

      // Process each artifact
      for (const artifact of artifacts) {
        try {
          const result = await this.processArtifact(artifact, context);
          
          if (result.success) {
            batchResult.processed++;
            
            if (result.attestation) {
              batchResult.attestations.push(result.attestation);
            }
            
            if (result.sidecars) {
              batchResult.sidecars.push(...result.sidecars);
            }
          } else {
            batchResult.failed++;
            batchResult.errors.push({
              artifact: artifact.path,
              error: result.error,
              details: result.errors
            });
          }

        } catch (error) {
          batchResult.failed++;
          batchResult.errors.push({
            artifact: artifact.path,
            error: error.message
          });
          this.logger.error(`Failed to process artifact ${artifact.path}:`, error);
        }
      }

      // Generate batch attestation if multiple artifacts processed
      if (batchResult.processed > 1) {
        try {
          const batchAttestation = await this._generateBatchAttestation(
            batchResult.attestations,
            context
          );
          
          batchResult.batchAttestation = batchAttestation;
          this.logger.success(`Generated batch attestation for ${batchResult.processed} artifacts`);

        } catch (error) {
          this.logger.error('Failed to generate batch attestation:', error);
          batchResult.errors.push({
            artifact: 'batch',
            error: `Batch attestation failed: ${error.message}`
          });
        }
      }

      batchResult.success = batchResult.failed === 0;

      this.logger.info(
        `Batch processing completed: ${batchResult.processed} success, ${batchResult.failed} failed`
      );

      return batchResult;

    } catch (error) {
      this.logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Verify existing attestation
   * @param {string} artifactPath - Path to artifact
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(artifactPath) {
    try {
      if (!this.attestationGenerator) {
        throw new Error('Attestation generator not initialized');
      }

      this.logger.info(`Verifying attestation for: ${artifactPath}`);

      // Load attestation sidecar
      const attestationPath = `${artifactPath}.attest.json`;
      const { promises: fs } = await import('fs');
      const attestationContent = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(attestationContent);

      // Validate attestation structure
      const validation = await this.attestationGenerator.validateAttestation(attestation);

      const result = {
        valid: validation.valid,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        attestation: attestation,
        signatureVerification: null
      };

      // Verify cryptographic signature if present
      if (attestation.signature && this.attestationGenerator.cryptoManager) {
        try {
          const signatureValid = await this.attestationGenerator.cryptoManager.verifyAttestation(attestation);
          result.signatureVerification = {
            valid: signatureValid,
            algorithm: attestation.signature.algorithm,
            keyFingerprint: attestation.signature.keyFingerprint
          };

          if (!signatureValid) {
            result.valid = false;
            result.errors.push('Cryptographic signature verification failed');
          }

        } catch (error) {
          result.signatureVerification = {
            valid: false,
            error: error.message
          };
          result.errors.push(`Signature verification failed: ${error.message}`);
        }
      }

      if (result.valid) {
        this.logger.success(`Attestation verified successfully: ${artifactPath}`);
      } else {
        this.logger.error(`Attestation verification failed: ${artifactPath}`);
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to verify attestation for ${artifactPath}:`, error);
      return {
        valid: false,
        error: error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Get pipeline status and statistics
   */
  getStatus() {
    return {
      state: this.state,
      config: {
        enableAttestations: this.config.enableAttestations,
        enableCryptographicSigning: this.config.enableCryptographicSigning,
        enableComplianceValidation: this.config.enableComplianceValidation,
        outputSidecars: this.config.outputSidecars
      },
      components: {
        attestationGenerator: !!this.attestationGenerator,
        complianceAttestor: !!this.complianceAttestor
      }
    };
  }

  // Private methods

  async _enhanceContext(context, artifact) {
    return {
      ...context,
      operationId: context.operationId || uuidv4(),
      startTime: context.startTime || new Date(),
      endTime: context.endTime || new Date(),
      agent: context.agent || {
        id: 'kgen-system',
        type: 'software',
        name: 'KGEN Attestation Pipeline'
      },
      engineVersion: context.engineVersion || '1.0.0',
      integrityHash: artifact.hash || await this._calculateArtifactHash(artifact),
      pipelineVersion: this.config.attestationVersion
    };
  }

  async _calculateArtifactHash(artifact) {
    try {
      if (artifact.hash) {
        return artifact.hash;
      }

      const { promises: fs } = await import('fs');
      const crypto = await import('crypto');
      const content = await fs.readFile(artifact.path);
      
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      this.logger.warn(`Failed to calculate artifact hash for ${artifact.path}:`, error);
      return null;
    }
  }

  async _performIntegrityValidation(artifact, attestation) {
    try {
      const currentHash = await this._calculateArtifactHash(artifact);
      const expectedHash = attestation.integrity?.artifactHash;

      const result = {
        valid: currentHash === expectedHash,
        currentHash,
        expectedHash,
        algorithm: attestation.integrity?.algorithm || 'sha256'
      };

      if (!result.valid && currentHash && expectedHash) {
        this.logger.warn(
          `Hash mismatch for ${artifact.path}: expected ${expectedHash.substring(0, 16)}..., got ${currentHash.substring(0, 16)}...`
        );
      }

      return result;

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async _generateBatchAttestation(attestations, context) {
    // Create a composite attestation for the batch
    const batchId = uuidv4();
    const batchHash = this._calculateBatchHash(attestations);

    return {
      '$schema': 'https://kgen.enterprise/schemas/batch-attestation/v1.0.json',
      batchId,
      batchHash,
      attestationCount: attestations.length,
      attestations: attestations.map(att => ({
        attestationId: att.attestationId,
        artifactId: att.artifactId,
        artifactPath: att.artifact?.path,
        hash: att.integrity?.artifactHash
      })),
      batchContext: {
        operationId: context.operationId,
        generatedAt: new Date().toISOString(),
        agent: context.agent
      },
      signature: null // Would be signed if crypto manager available
    };
  }

  _calculateBatchHash(attestations) {
    const crypto = require('crypto');
    const attestationHashes = attestations
      .map(att => att.integrity?.artifactHash)
      .filter(hash => hash)
      .sort()
      .join('');
    
    return crypto.createHash('sha256').update(attestationHashes).digest('hex');
  }
}

export default AttestationPipeline;