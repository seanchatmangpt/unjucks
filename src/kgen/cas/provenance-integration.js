/**
 * Content URI - Provenance Integration
 * 
 * Integrates content:// URI scheme with KGEN provenance tracking:
 * - Automatic content URI generation in attestations
 * - Content-addressed artifact storage with provenance links
 * - Integration with existing ProvenanceEngine
 * - Content drift detection with provenance audit trail
 */

import { contentResolver } from './content-uri-resolver.js';
import { cas } from './cas-core.js';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import crypto from 'crypto';
import consola from 'consola';

export class ContentProvenanceIntegration {
  constructor(options = {}) {
    this.options = {
      enableContentURIs: options.enableContentURIs !== false,
      enableProvenanceLinks: options.enableProvenanceLinks !== false,
      enableDriftTracking: options.enableDriftTracking !== false,
      attestationVersion: options.attestationVersion || '2.0',
      ...options
    };
    
    this.logger = consola.withTag('content-provenance');
    this.resolver = options.resolver || contentResolver; // Allow custom resolver
    
    // Track content URI usage in attestations
    this.contentUriStats = {
      attestationsWithContentURIs: 0,
      contentItemsStored: 0,
      provenanceLinksCreated: 0,
      driftDetected: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    if (this.initialized) return { success: true, cached: true };
    
    try {
      await this.resolver.initialize();
      this.logger.info('Content-Provenance integration initialized');
      this.initialized = true;
      
      return { 
        success: true,
        contentResolver: true,
        provenanceIntegration: true 
      };
    } catch (error) {
      this.logger.error('Failed to initialize content-provenance integration:', error);
      throw error;
    }
  }

  /**
   * Generate enhanced attestation with content URIs
   * @param {Object} operation - Operation context from ProvenanceEngine
   * @param {Object} artifact - Artifact information
   * @returns {Promise<Object>} Enhanced attestation with content URIs
   */
  async generateContentAttestation(operation, artifact) {
    await this.initialize();
    
    try {
      // Store artifact content and get content URI
      let contentURI = null;
      let contentMetadata = null;
      
      if (artifact.filePath && this.options.enableContentURIs) {
        try {
          const content = await fs.readFile(artifact.filePath);
          const extension = extname(artifact.filePath);
          
          const storeResult = await this.resolver.store(content, {
            algorithm: 'sha256',
            extension,
            metadata: {
              originalPath: artifact.filePath,
              operationId: operation.operationId,
              templateId: operation.templateId,
              generatedAt: operation.endTime?.toISOString() || this.getDeterministicDate().toISOString()
            },
            source: artifact.filePath
          });
          
          contentURI = storeResult.uri;
          contentMetadata = {
            contentURI,
            hash: storeResult.hash,
            algorithm: storeResult.algorithm,
            size: storeResult.size,
            extension: storeResult.extension,
            hardlinked: storeResult.hardlinked,
            casPath: storeResult.path
          };
          
          this.contentUriStats.contentItemsStored++;
          
        } catch (error) {
          this.logger.warn(`Failed to store artifact content for ${artifact.filePath}:`, error.message);
        }
      }

      // Create enhanced attestation
      const baseAttestation = {
        '@context': [
          'https://w3id.org/security/v2',
          'https://kgen.org/attestation/v2'
        ],
        '@type': 'ContentAttestation',
        version: this.options.attestationVersion,
        
        // Operation metadata
        operation: {
          id: operation.operationId,
          type: operation.type,
          startTime: operation.startTime?.toISOString(),
          endTime: operation.endTime?.toISOString(),
          agent: operation.agent,
          templateId: operation.templateId,
          templateVersion: operation.templateVersion,
          ruleIds: operation.ruleIds || []
        },
        
        // Artifact information with content URI
        subject: {
          id: artifact.id || crypto.randomUUID(),
          path: artifact.filePath,
          hash: artifact.hash,
          size: artifact.size,
          createdAt: operation.endTime?.toISOString() || this.getDeterministicDate().toISOString(),
          
          // Content URI information
          ...(contentMetadata && {
            contentAddressing: {
              uri: contentURI,
              algorithm: contentMetadata.algorithm,
              hash: contentMetadata.hash,
              casPath: contentMetadata.casPath,
              hardlinked: contentMetadata.hardlinked
            }
          })
        },
        
        // Provenance chain with content links
        provenance: {
          sources: operation.inputs?.map(input => this._createProvenanceSource(input)) || [],
          
          // Add content URI provenance links if available
          ...(this.options.enableProvenanceLinks && contentURI && {
            contentProvenance: {
              storedAt: this.getDeterministicDate().toISOString(),
              contentURI,
              derivedFrom: operation.inputs?.map(input => input.contentURI).filter(Boolean) || [],
              generationMethod: operation.type,
              templateSource: operation.templateId ? `template://${operation.templateId}` : null
            }
          }),
          
          // Include reasoning chain if available
          ...(operation.reasoningChain?.length > 0 && {
            reasoning: operation.reasoningChain.map(step => ({
              stepNumber: step.stepNumber,
              rule: step.rule,
              inferenceType: step.inferenceType,
              confidence: step.confidence,
              timestamp: step.timestamp
            }))
          })
        },
        
        // Integrity information
        integrity: {
          algorithm: 'sha256',
          hash: this._calculateAttestationHash({
            operationId: operation.operationId,
            artifactPath: artifact.filePath,
            artifactHash: artifact.hash,
            contentURI,
            timestamp: operation.endTime || this.getDeterministicDate()
          }),
          verificationMethod: 'content-addressed-storage',
          ...(contentURI && { contentURI })
        },
        
        // Compliance metadata
        compliance: {
          frameworks: ['SLSA', 'PROV-O', 'KGEN-CAS'],
          level: contentURI ? 'content-addressed' : 'standard',
          attestationType: 'generation',
          reproducible: Boolean(operation.templateId),
          deterministic: true
        },
        
        // Timestamps and metadata
        timestamp: this.getDeterministicDate().toISOString(),
        issuer: 'kgen-content-provenance-engine',
        ...(contentURI && { contentUriSupport: true })
      };

      // Add drift detection information if enabled
      if (this.options.enableDriftTracking && contentURI) {
        baseAttestation.driftDetection = {
          enabled: true,
          contentURI,
          baselineHash: contentMetadata.hash,
          lastChecked: this.getDeterministicDate().toISOString()
        };
      }

      this.contentUriStats.attestationsWithContentURIs++;
      
      this.logger.debug(`Generated content attestation for ${artifact.filePath}${contentURI ? ` with URI ${contentURI}` : ''}`);
      
      return baseAttestation;
      
    } catch (error) {
      this.logger.error('Failed to generate content attestation:', error);
      throw error;
    }
  }

  /**
   * Verify attestation with content URI integrity checks
   * @param {Object} attestation - Attestation to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyContentAttestation(attestation, options = {}) {
    await this.initialize();
    
    try {
      const verification = {
        valid: true,
        checks: {
          contentIntegrity: false,
          provenanceChain: false,
          driftDetection: false,
          attestationIntegrity: false
        },
        details: {},
        contentURI: null,
        errors: []
      };

      // Extract content URI if present
      const contentURI = attestation.subject?.contentAddressing?.uri || 
                         attestation.integrity?.contentURI ||
                         attestation.driftDetection?.contentURI;

      if (contentURI) {
        verification.contentURI = contentURI;
        
        try {
          // Verify content URI format
          const uriValidation = this.resolver.validateContentURI(contentURI);
          if (!uriValidation.valid) {
            verification.valid = false;
            verification.errors.push(`Invalid content URI format: ${uriValidation.error}`);
            return verification;
          }
          
          // Perform integrity check (this also verifies existence)
          const resolved = await this.resolver.resolve(contentURI, { allowCorrupted: true });
          if (resolved.integrity && !resolved.integrity.valid) {
            verification.valid = false;
            verification.errors.push(`Content drift detected: ${resolved.integrity.error}`);
            verification.checks.driftDetection = true;
            verification.details.driftDetection = {
              driftDetected: true,
              expectedHash: resolved.integrity.expectedHash,
              actualHash: resolved.integrity.actualHash,
              algorithm: resolved.integrity.algorithm
            };
          } else {
            verification.checks.contentIntegrity = true;
            verification.checks.driftDetection = false;
            verification.details.driftDetection = {
              driftDetected: false
            };
          }
          
          verification.details.contentResolution = {
            path: resolved.path,
            size: resolved.size,
            hash: resolved.hash,
            algorithm: resolved.algorithm
          };
          
        } catch (error) {
          verification.valid = false;
          verification.errors.push(`Content verification failed: ${error.message}`);
        }
      }

      // Verify provenance chain
      if (attestation.provenance?.contentProvenance) {
        const provenanceValid = await this._verifyProvenanceChain(attestation.provenance);
        verification.checks.provenanceChain = provenanceValid;
        
        if (!provenanceValid) {
          verification.valid = false;
          verification.errors.push('Provenance chain verification failed');
        }
      }

      // Perform drift detection if enabled and configured
      if (this.options.enableDriftTracking && attestation.driftDetection) {
        const driftCheck = await this._performDriftDetection(attestation);
        verification.checks.driftDetection = !driftCheck.driftDetected;
        
        if (driftCheck.driftDetected) {
          verification.valid = false;
          verification.errors.push(`Content drift detected: ${driftCheck.details}`);
          this.contentUriStats.driftDetected++;
        }
        
        verification.details.driftDetection = driftCheck;
      }

      // Verify attestation integrity hash
      if (attestation.integrity?.hash) {
        const computedHash = this._calculateAttestationHash({
          operationId: attestation.operation?.id,
          artifactPath: attestation.subject?.path,
          artifactHash: attestation.subject?.hash,
          contentURI,
          timestamp: attestation.operation?.endTime ? new Date(attestation.operation.endTime) : new Date(attestation.timestamp)
        });
        
        verification.checks.attestationIntegrity = computedHash === attestation.integrity.hash;
        
        if (!verification.checks.attestationIntegrity) {
          verification.valid = false;
          verification.errors.push('Attestation integrity hash mismatch');
        }
      }

      return verification;
      
    } catch (error) {
      this.logger.error('Content attestation verification failed:', error);
      return {
        valid: false,
        checks: {},
        errors: [`Verification error: ${error.message}`],
        contentURI: null
      };
    }
  }

  /**
   * Migrate existing attestations to use content URIs
   * @param {string} attestationPath - Path to existing .attest.json file
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration result
   */
  async migrateAttestationToContentURI(attestationPath, options = {}) {
    await this.initialize();
    
    try {
      // Read existing attestation
      const content = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(content);
      
      // Skip if already has content URI
      if (attestation.subject?.contentAddressing?.uri || attestation.integrity?.contentURI) {
        return {
          migrated: false,
          reason: 'Already has content URI',
          contentURI: attestation.subject?.contentAddressing?.uri || attestation.integrity?.contentURI
        };
      }
      
      // Find the artifact file
      const artifactPath = attestation.artifact?.path || attestation.subject?.path;
      if (!artifactPath) {
        throw new Error('No artifact path found in attestation');
      }
      
      // Store artifact content
      const artifactContent = await fs.readFile(artifactPath);
      const storeResult = await contentResolver.store(artifactContent, {
        algorithm: 'sha256',
        extension: extname(artifactPath),
        metadata: {
          originalPath: artifactPath,
          migratedFrom: attestationPath,
          migratedAt: this.getDeterministicDate().toISOString()
        },
        source: artifactPath
      });
      
      // Update attestation with content URI
      const updatedAttestation = {
        ...attestation,
        version: this.options.attestationVersion,
        subject: {
          ...attestation.subject,
          contentAddressing: {
            uri: storeResult.uri,
            algorithm: storeResult.algorithm,
            hash: storeResult.hash,
            casPath: storeResult.path,
            hardlinked: storeResult.hardlinked
          }
        },
        integrity: {
          ...attestation.integrity,
          contentURI: storeResult.uri
        },
        migration: {
          migratedAt: this.getDeterministicDate().toISOString(),
          fromVersion: attestation.version || '1.0',
          toVersion: this.options.attestationVersion,
          contentURIAdded: true
        }
      };
      
      // Write updated attestation
      if (!options.dryRun) {
        await fs.writeFile(attestationPath, JSON.stringify(updatedAttestation, null, 2));
      }
      
      this.logger.info(`Migrated attestation ${attestationPath} to content URI ${storeResult.uri}`);
      
      return {
        migrated: true,
        contentURI: storeResult.uri,
        attestationPath,
        dryRun: Boolean(options.dryRun),
        changes: {
          contentURIAdded: true,
          versionUpdated: true,
          integrityEnhanced: true
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to migrate attestation ${attestationPath}:`, error);
      throw error;
    }
  }

  /**
   * Get integration statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const resolverStats = contentResolver.getStats();
    
    return {
      integration: this.contentUriStats,
      resolver: resolverStats,
      performance: {
        contentUriUsageRate: this.contentUriStats.attestationsWithContentURIs > 0 ? 
          this.contentUriStats.contentItemsStored / this.contentUriStats.attestationsWithContentURIs : 0,
        driftDetectionRate: this.contentUriStats.contentItemsStored > 0 ?
          this.contentUriStats.driftDetected / this.contentUriStats.contentItemsStored : 0
      }
    };
  }

  // Private methods

  _createProvenanceSource(input) {
    return {
      id: input.id || crypto.randomUUID(),
      path: input.filePath || input.path,
      hash: input.hash,
      contentURI: input.contentURI || null,
      role: input.role || 'input',
      timestamp: input.timestamp || this.getDeterministicDate().toISOString()
    };
  }

  async _verifyProvenanceChain(provenance) {
    try {
      // Verify content provenance links
      if (provenance.contentProvenance?.derivedFrom) {
        for (const sourceURI of provenance.contentProvenance.derivedFrom) {
          if (sourceURI && sourceURI.startsWith('content://')) {
            const exists = await contentResolver.exists(sourceURI);
            if (!exists) {
              return false;
            }
          }
        }
      }
      
      // Verify sources have valid content URIs if present
      if (provenance.sources) {
        for (const source of provenance.sources) {
          if (source.contentURI && source.contentURI.startsWith('content://')) {
            const exists = await contentResolver.exists(source.contentURI);
            if (!exists) {
              return false;
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      this.logger.warn('Provenance chain verification error:', error);
      return false;
    }
  }

  async _performDriftDetection(attestation) {
    try {
      const contentURI = attestation.driftDetection?.contentURI;
      const baselineHash = attestation.driftDetection?.baselineHash;
      
      if (!contentURI || !baselineHash) {
        return { driftDetected: false, reason: 'No drift detection configuration' };
      }
      
      const resolved = await contentResolver.resolve(contentURI);
      const currentHash = resolved.hash;
      
      const driftDetected = currentHash !== baselineHash;
      
      return {
        driftDetected,
        details: driftDetected ? {
          baselineHash,
          currentHash,
          contentURI,
          detectedAt: this.getDeterministicDate().toISOString()
        } : null
      };
    } catch (error) {
      return {
        driftDetected: true,
        error: `Drift detection error: ${error.message}`
      };
    }
  }

  _calculateAttestationHash(data) {
    const canonicalData = JSON.stringify({
      operationId: data.operationId,
      artifactPath: data.artifactPath,
      artifactHash: data.artifactHash,
      contentURI: data.contentURI,
      timestamp: data.timestamp.toISOString()
    }, Object.keys(data).sort());
    
    return crypto.createHash('sha256').update(canonicalData).digest('hex');
  }
}

// Export singleton instance
export const contentProvenanceIntegration = new ContentProvenanceIntegration();

// Export class for custom instances
export default ContentProvenanceIntegration;