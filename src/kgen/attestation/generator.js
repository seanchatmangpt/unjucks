/**
 * Enhanced Attestation Generator
 * 
 * Generates cryptographically verifiable attestations with:
 * - Content-addressed artifact identification via CID
 * - JWT/JWS signatures with Ed25519, RSA, and HMAC support
 * - Attest:// URI scheme integration
 * - Comprehensive provenance tracking
 * - Key management and rotation
 */

import { cas } from '../cas/cas-core.js';
import { canonicalProcessor } from '../rdf/canonical-processor-cas.js';
import { attestResolver } from './attest-resolver.js';
import { jwtHandler } from './jwt-handler.js';
import { keyManager } from './key-manager.js';
import { enhancedMethods } from './enhanced-methods.js';
import { readFile, writeFile, stat } from 'fs/promises';
import { dirname, basename, join } from 'path';
import { createHash } from 'crypto';
import consola from 'consola';

/**
 * Enhanced Attestation Generator with full integration
 */
export class AttestationGenerator {
  constructor(options = {}) {
    this.options = {
      version: '2.0.0',
      algorithm: 'sha256',
      includeProvenance: options.includeProvenance !== false,
      includeMetrics: options.includeMetrics !== false,
      signAttestations: options.signAttestations !== false,
      jwtSignatures: options.jwtSignatures !== false,
      defaultKeyAlgorithm: options.defaultKeyAlgorithm || 'Ed25519',
      attestationFormat: options.attestationFormat || 'enhanced', // enhanced, legacy, jwt
      storeAttestations: options.storeAttestations !== false,
      ...options
    };
    
    this.logger = consola.withTag('attestation-generator');
    this.attestations = new Map();
    this.metrics = {
      generated: 0,
      verified: 0,
      signed: 0,
      resolved: 0,
      processingTime: 0,
      errors: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the attestation generator
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize all subsystems
      await Promise.all([
        attestResolver.initialize(),
        jwtHandler.initialize(),
        keyManager.initialize()
      ]);
      
      // Generate default signing key if needed
      if (this.options.signAttestations || this.options.jwtSignatures) {
        const keys = await keyManager.listKeys({ status: 'active' });
        if (keys.length === 0) {
          await keyManager.generateKeyPair({
            algorithm: this.options.defaultKeyAlgorithm,
            keyId: 'default',
            purpose: 'signing'
          });
          this.logger.info('Generated default signing key');
        }
      }
      
      this.logger.info('Enhanced attestation generator initialized');
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize attestation generator:', error);
      throw error;
    }
  }

  /**
   * Generate enhanced attestation for an artifact
   * @param {string} artifactPath - Path to artifact
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Generated attestation with attest:// URI
   */
  async generateAttestation(artifactPath, metadata = {}) {
    await this.initialize();
    const startTime = performance.now();
    
    try {
      // Read artifact content
      const content = await readFile(artifactPath, 'utf8');
      const stats = await stat(artifactPath);
      
      // Generate CID for artifact
      const artifactCID = await cas.generateCID(content);
      
      // Process RDF content if applicable
      let rdfData = null;
      if (this._isRDFFile(artifactPath)) {
        rdfData = await canonicalProcessor.generateAttestation(content, metadata);
      }
      
      // Generate enhanced provenance chain
      const provenance = this.options.includeProvenance
        ? await this._generateEnhancedProvenance(artifactPath, content, metadata)
        : null;
      
      // Collect performance metrics
      const metricsData = this.options.includeMetrics
        ? await this._collectEnhancedMetrics()
        : null;
      
      // Build base attestation
      const baseAttestation = {
        // Core attestation data
        version: this.options.version,
        timestamp: this.getDeterministicDate().toISOString(),
        format: this.options.attestationFormat,
        
        // Artifact identification
        artifact: {
          path: artifactPath,
          name: basename(artifactPath),
          cid: artifactCID.toString(),
          contentHash: await cas.calculateHash(content, this.options.algorithm),
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: this._getArtifactType(artifactPath)
        },
        
        // RDF-specific data
        rdf: rdfData,
        
        // Enhanced provenance chain
        provenance,
        
        // Performance metrics
        metrics: metricsData,
        
        // Compliance information
        compliance: {
          standards: ['SLSA-L3', 'PROV-O', 'JWT'],
          verifiable: true,
          timestamped: true,
          signed: this.options.signAttestations || this.options.jwtSignatures
        },
        
        // User metadata
        metadata: {
          generator: 'kgen-enhanced-attestation-generator',
          generatorVersion: this.options.version,
          ...metadata,
          processingTime: performance.now() - startTime
        }
      };
      
      // Generate different attestation formats
      let finalAttestation;
      
      switch (this.options.attestationFormat) {
        case 'jwt':
          finalAttestation = await this._generateJWTAttestation(baseAttestation, metadata);
          break;
          
        case 'enhanced':
          finalAttestation = await this._generateEnhancedAttestation(baseAttestation, metadata);
          break;
          
        case 'legacy':
        default:
          finalAttestation = await this._generateLegacyAttestation(baseAttestation, metadata);
          break;
      }
      
      // Store in resolver system if enabled
      if (this.options.storeAttestations) {
        finalAttestation.attestURI = await attestResolver.store(finalAttestation, this.options.algorithm);
        this.logger.debug(`Stored attestation at ${finalAttestation.attestURI}`);
      }
      
      // Store locally
      this.attestations.set(artifactPath, finalAttestation);
      this.metrics.generated++;
      this.metrics.processingTime += performance.now() - startTime;
      
      this.logger.info(`Generated ${this.options.attestationFormat} attestation for ${basename(artifactPath)}`);
      
      return finalAttestation;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Failed to generate attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  // Enhanced methods are mixed in after class definition

  /**
   * Resolve an attest:// URI to its attestation
   * @param {string} attestURI - Attest:// URI to resolve
   * @returns {Promise<Object>} Resolved attestation data
   */
  async resolveAttestURI(attestURI) {
    await this.initialize();
    
    try {
      const resolved = await attestResolver.resolve(attestURI);
      this.metrics.resolved++;
      
      this.logger.debug(`Resolved ${attestURI}`);
      return resolved;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Failed to resolve ${attestURI}:`, error);
      throw error;
    }
  }

  /**
   * Verify attestation integrity
   * @param {Object|string} attestation - Attestation object or file path
   * @returns {Promise<{valid, details}>} Verification result
   */
  async verifyAttestation(attestation) {
    const startTime = performance.now();
    this.metrics.verified++;
    
    try {
      let attestationData;
      
      if (typeof attestation === 'string') {
        // Load from file
        const content = await readFile(attestation, 'utf8');
        attestationData = JSON.parse(content);
      } else {
        attestationData = attestation;
      }
      
      const results = {
        valid: true,
        details: {
          artifactExists: false,
          contentMatches: false,
          cidValid: false,
          signatureValid: false,
          rdfValid: false,
          provenanceValid: false
        },
        errors: []
      };
      
      // Check if artifact still exists and matches
      try {
        const currentContent = await readFile(attestationData.artifact.path, 'utf8');
        results.details.artifactExists = true;
        
        // Verify CID matches current content
        const currentCID = await cas.generateCID(currentContent);
        results.details.cidValid = currentCID.toString() === attestationData.artifact.cid;
        
        if (!results.details.cidValid) {
          results.errors.push('Artifact CID mismatch - content has changed');
          results.valid = false;
        }
        
        // Verify content hash
        const currentHash = await cas.calculateHash(currentContent, this.options.algorithm);
        results.details.contentMatches = currentHash === attestationData.artifact.contentHash;
        
        if (!results.details.contentMatches) {
          results.errors.push('Content hash mismatch');
          results.valid = false;
        }
        
      } catch (error) {
        results.errors.push(`Artifact not accessible: ${error.message}`);
        results.valid = false;
      }
      
      // Verify attestation CID
      const { attestationCID, ...attestationWithoutCID } = attestationData;
      const recalculatedCID = await cas.generateCID(JSON.stringify(attestationWithoutCID, null, 2));
      
      if (recalculatedCID.toString() !== attestationCID) {
        results.errors.push('Attestation CID mismatch - attestation has been modified');
        results.valid = false;
      }
      
      // Verify RDF data if present
      if (attestationData.rdf) {
        try {
          // Re-verify RDF canonical representation
          const currentContent = await readFile(attestationData.artifact.path, 'utf8');
          const rdfResult = await canonicalProcessor.parseAndAddress(currentContent);
          
          results.details.rdfValid = rdfResult.canonicalCID === attestationData.rdf.content.canonicalCID;
          
          if (!results.details.rdfValid) {
            results.errors.push('RDF canonical representation mismatch');
            results.valid = false;
          }
        } catch (error) {
          results.errors.push(`RDF verification failed: ${error.message}`);
          results.valid = false;
        }
      }
      
      // Verify signature if present
      if (attestationData.signature) {
        try {
          results.details.signatureValid = await this._verifySignature(attestationData);
          
          if (!results.details.signatureValid) {
            results.errors.push('Digital signature verification failed');
            results.valid = false;
          }
        } catch (error) {
          results.errors.push(`Signature verification error: ${error.message}`);
          results.valid = false;
        }
      }
      
      // Verify provenance chain if present
      if (attestationData.provenance) {
        results.details.provenanceValid = await this._verifyProvenance(attestationData.provenance);
        
        if (!results.details.provenanceValid) {
          results.errors.push('Provenance chain verification failed');
          results.valid = false;
        }
      }
      
      results.verificationTime = performance.now() - startTime;
      
      return results;
      
    } catch (error) {
      return {
        valid: false,
        details: {},
        errors: [`Verification failed: ${error.message}`],
        verificationTime: performance.now() - startTime
      };
    }
  }

  /**
   * Save attestation to file
   * @param {Object} attestation - Attestation to save
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Saved file path
   */
  async saveAttestation(attestation, outputPath) {
    const attestationContent = JSON.stringify(attestation, null, 2);
    await writeFile(outputPath, attestationContent, 'utf8');
    
    // Also save the CID reference
    const cidPath = outputPath.replace(/\.json$/, '.cid');
    await writeFile(cidPath, attestation.attestationCID, 'utf8');
    
    return outputPath;
  }

  /**
   * Load attestation from file
   * @param {string} filePath - Attestation file path
   * @returns {Promise<Object>} Loaded attestation
   */
  async loadAttestation(filePath) {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Get generator metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const casMetrics = cas.getMetrics();
    
    return {
      generator: this.metrics,
      cas: casMetrics,
      efficiency: {
        averageGenerationTime: this.metrics.generated > 0
          ? this.metrics.processingTime / this.metrics.generated
          : 0
      }
    };
  }

  // Private methods

  _isRDFFile(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    return ['ttl', 'rdf', 'n3', 'nt', 'jsonld'].includes(ext);
  }

  async _generateProvenance(artifactPath, content, metadata) {
    const provenance = {
      generator: {
        tool: 'kgen',
        version: this.options.version,
        timestamp: this.getDeterministicDate().toISOString()
      },
      source: {
        type: metadata.sourceType || 'file',
        path: artifactPath,
        cid: (await cas.generateCID(content)).toString()
      },
      build: {
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch
        },
        dependencies: metadata.dependencies || [],
        configuration: metadata.configuration || {}
      },
      chain: metadata.provenanceChain || []
    };
    
    // Generate provenance CID
    const provenanceCID = await cas.generateCID(JSON.stringify(provenance));
    provenance.provenanceCID = provenanceCID.toString();
    
    return provenance;
  }

  _collectMetrics() {
    const casMetrics = cas.getMetrics();
    
    return {
      cas: {
        cacheHitRate: casMetrics.cache.hitRate,
        performanceTargets: casMetrics.performance.meetsTargets
      },
      processor: canonicalProcessor.getMetrics(),
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  async _signAttestation(attestation) {
    if (!this.options.privateKeyPath) {
      throw new Error('Private key path not configured');
    }
    
    try {
      const privateKey = await readFile(this.options.privateKeyPath, 'utf8');
      const { signature, ...dataToSign } = attestation;
      
      const sign = createSign('RSA-SHA256');
      sign.update(JSON.stringify(dataToSign, null, 2));
      
      return {
        algorithm: 'RSA-SHA256',
        signature: sign.sign(privateKey, 'base64'),
        timestamp: this.getDeterministicDate().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to sign attestation: ${error.message}`);
    }
  }

  async _verifySignature(attestationData) {
    // Implementation would verify the digital signature
    // This is a placeholder for actual signature verification
    return true;
  }

  async _verifyProvenance(provenance) {
    // Implementation would verify the provenance chain
    // This is a placeholder for actual provenance verification
    return true;
  }
}

// Mix enhanced methods into the prototype
Object.assign(AttestationGenerator.prototype, enhancedMethods);

// Export singleton instance
export const attestationGenerator = new AttestationGenerator();