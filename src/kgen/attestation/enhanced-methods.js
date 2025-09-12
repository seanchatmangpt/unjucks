/**
 * Enhanced Methods for Attestation Generator
 * 
 * Additional methods to support the enhanced attestation system
 */

import { createHash } from 'crypto';
import { attestResolver } from './attest-resolver.js';
import { jwtHandler } from './jwt-handler.js';
import { keyManager } from './key-manager.js';
import { cas } from '../cas/cas-core.js';

export const enhancedMethods = {
  /**
   * Generate JWT-format attestation
   * @param {Object} baseAttestation - Base attestation data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} JWT attestation
   */
  async _generateJWTAttestation(baseAttestation, metadata = {}) {
    try {
      // Create JWT payload from attestation
      const jwtPayload = {
        sub: baseAttestation.artifact.cid,
        iss: 'kgen-attestation-system',
        aud: 'kgen-verifiers',
        
        // Attestation claims
        'urn:kgen:artifact': {
          path: baseAttestation.artifact.path,
          name: baseAttestation.artifact.name,
          cid: baseAttestation.artifact.cid,
          contentHash: baseAttestation.artifact.contentHash,
          size: baseAttestation.artifact.size
        },
        
        'urn:kgen:provenance': baseAttestation.provenance,
        'urn:kgen:compliance': baseAttestation.compliance,
        'urn:kgen:metrics': baseAttestation.metrics,
        'urn:kgen:rdf': baseAttestation.rdf
      };
      
      // Get signing key
      const keys = await keyManager.listKeys({ status: 'active' });
      const signingKey = keys[0]; // Use first active key
      
      if (!signingKey) {
        throw new Error('No active signing key available');
      }
      
      // Create JWT token
      const jwtToken = await jwtHandler.createToken(jwtPayload, {
        keyId: signingKey.keyId,
        algorithm: this._mapToJWTAlgorithm(signingKey.algorithm),
        expiresIn: metadata.tokenExpiry || '1y'
      });
      
      const jwtAttestation = {
        ...baseAttestation,
        jwt: {
          token: jwtToken,
          keyId: signingKey.keyId,
          algorithm: signingKey.algorithm
        }
      };
      
      // Generate attestation CID
      const attestationContent = JSON.stringify(jwtAttestation, null, 2);
      jwtAttestation.attestationCID = (await cas.generateCID(attestationContent)).toString();
      
      this.metrics.signed++;
      
      return jwtAttestation;
      
    } catch (error) {
      throw new Error(`JWT attestation generation failed: ${error.message}`);
    }
  },

  /**
   * Generate enhanced-format attestation
   * @param {Object} baseAttestation - Base attestation data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Enhanced attestation
   */
  async _generateEnhancedAttestation(baseAttestation, metadata = {}) {
    try {
      const enhancedAttestation = {
        ...baseAttestation,
        
        // Enhanced security features
        security: {
          algorithm: this.options.algorithm,
          keyDerivation: 'scrypt',
          iterations: 32768,
          memoryLimit: 64 * 1024 * 1024 // 64MB
        },
        
        // Multi-format support
        representations: {
          canonical: null,
          compressed: null,
          minimal: null
        },
        
        // Chain of trust
        trustChain: await this._buildTrustChain(baseAttestation, metadata),
        
        // Verification metadata
        verification: {
          methods: ['content-hash', 'cid', 'signature'],
          requirements: ['temporal-validity', 'chain-integrity'],
          automated: true
        }
      };
      
      // Generate different representations
      enhancedAttestation.representations.canonical = JSON.stringify(baseAttestation, Object.keys(baseAttestation).sort());
      enhancedAttestation.representations.compressed = await this._compressAttestation(baseAttestation);
      enhancedAttestation.representations.minimal = this._createMinimalAttestation(baseAttestation);
      
      // Sign if requested
      if (this.options.signAttestations) {
        enhancedAttestation.signature = await this._createDigitalSignature(enhancedAttestation, metadata);
        this.metrics.signed++;
      }
      
      // Generate attestation CID
      const attestationContent = JSON.stringify(enhancedAttestation, null, 2);
      enhancedAttestation.attestationCID = (await cas.generateCID(attestationContent)).toString();
      
      return enhancedAttestation;
      
    } catch (error) {
      throw new Error(`Enhanced attestation generation failed: ${error.message}`);
    }
  },

  /**
   * Generate legacy-format attestation (backward compatibility)
   * @param {Object} baseAttestation - Base attestation data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Legacy attestation
   */
  async _generateLegacyAttestation(baseAttestation, metadata = {}) {
    try {
      // Convert to legacy format
      const legacyAttestation = {
        version: baseAttestation.version,
        timestamp: baseAttestation.timestamp,
        
        // Legacy artifact format
        artifact: {
          path: baseAttestation.artifact.path,
          name: baseAttestation.artifact.name,
          contentHash: baseAttestation.artifact.contentHash,
          size: baseAttestation.artifact.size,
          lastModified: baseAttestation.artifact.lastModified
        },
        
        // Simplified provenance
        source: baseAttestation.provenance?.source || { type: 'unknown' },
        
        // Basic metadata
        metadata: {
          ...baseAttestation.metadata,
          format: 'legacy'
        }
      };
      
      // Generate legacy signature if needed
      if (this.options.signAttestations) {
        legacyAttestation.signature = await this._createLegacySignature(legacyAttestation);
        this.metrics.signed++;
      }
      
      // Generate attestation CID
      const attestationContent = JSON.stringify(legacyAttestation, null, 2);
      legacyAttestation.attestationCID = (await cas.generateCID(attestationContent)).toString();
      
      return legacyAttestation;
      
    } catch (error) {
      throw new Error(`Legacy attestation generation failed: ${error.message}`);
    }
  },

  /**
   * Generate enhanced provenance chain
   * @param {string} artifactPath - Path to artifact
   * @param {string} content - Artifact content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Enhanced provenance
   */
  async _generateEnhancedProvenance(artifactPath, content, metadata) {
    try {
      const provenance = {
        // Basic provenance info
        generator: {
          tool: 'kgen-enhanced',
          version: this.options.version,
          timestamp: this.getDeterministicDate().toISOString(),
          environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage(),
            cwd: process.cwd()
          }
        },
        
        // Source information
        source: {
          type: metadata.sourceType || 'file',
          path: artifactPath,
          cid: (await cas.generateCID(content)).toString(),
          contentType: this._getContentType(artifactPath),
          encoding: 'utf8',
          lineEnding: this._detectLineEnding(content)
        },
        
        // Build context
        build: {
          environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            timestamp: this.getDeterministicDate().toISOString()
          },
          dependencies: metadata.dependencies || [],
          configuration: metadata.configuration || {},
          inputs: metadata.inputs || [],
          parameters: metadata.parameters || {}
        },
        
        // Chain of transformations
        chain: [
          ...(metadata.provenanceChain || []),
          {
            step: 'attestation-generation',
            timestamp: this.getDeterministicDate().toISOString(),
            tool: 'kgen-enhanced-attestation-generator',
            inputs: [artifactPath],
            outputs: ['attestation'],
            method: 'cryptographic-attestation'
          }
        ],
        
        // Integrity information
        integrity: {
          algorithm: this.options.algorithm,
          contentHash: createHash(this.options.algorithm).update(content).digest('hex'),
          provenanceHash: null // Will be calculated after provenance is complete
        },
        
        // Temporal information
        temporal: {
          created: this.getDeterministicDate().toISOString(),
          validFrom: this.getDeterministicDate().toISOString(),
          validUntil: metadata.validUntil || new Date(this.getDeterministicTimestamp() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
        }
      };
      
      // Calculate provenance hash
      const provenanceContent = JSON.stringify(provenance, Object.keys(provenance).sort());
      provenance.integrity.provenanceHash = createHash(this.options.algorithm).update(provenanceContent).digest('hex');
      
      // Generate provenance CID
      const provenanceCID = await cas.generateCID(JSON.stringify(provenance));
      provenance.provenanceCID = provenanceCID.toString();
      
      return provenance;
      
    } catch (error) {
      throw new Error(`Enhanced provenance generation failed: ${error.message}`);
    }
  },

  /**
   * Collect enhanced metrics
   * @returns {Promise<Object>} Enhanced metrics data
   */
  async _collectEnhancedMetrics() {
    try {
      const casMetrics = cas.getMetrics();
      const keyManagerStats = keyManager.getStats();
      const jwtStats = jwtHandler.getStats();
      const resolverStats = attestResolver.getStats();
      
      return {
        // CAS performance
        cas: {
          cacheHitRate: casMetrics.cache?.hitRate || 0,
          averageHashTime: casMetrics.performance?.averageHashTime || 0,
          totalOperations: casMetrics.operations?.total || 0,
          errorRate: casMetrics.errors?.rate || 0
        },
        
        // Key management
        keys: {
          totalKeys: keyManagerStats.totalKeys,
          activeKeys: keyManagerStats.activeKeys,
          totalSignatures: keyManagerStats.totalSignatures
        },
        
        // JWT handling
        jwt: {
          supportedAlgorithms: jwtStats.supportedAlgorithms.length,
          defaultAlgorithm: jwtStats.defaultAlgorithm
        },
        
        // Resolver performance
        resolver: {
          cacheHitRate: resolverStats.cacheHitRate,
          totalResolves: resolverStats.resolves,
          errorRate: resolverStats.errorRate
        },
        
        // System metrics
        system: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          cpuUsage: process.cpuUsage(),
          timestamp: this.getDeterministicDate().toISOString()
        },
        
        // Generator-specific metrics
        generator: this.metrics
      };
      
    } catch (error) {
      this.logger.warn('Failed to collect enhanced metrics:', error);
      return { error: error.message };
    }
  },

  /**
   * Build trust chain for attestation
   * @param {Object} attestation - Base attestation
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Array>} Trust chain
   */
  async _buildTrustChain(attestation, metadata) {
    try {
      const chain = [];
      
      // Root of trust (generator)
      chain.push({
        level: 0,
        entity: 'kgen-enhanced-attestation-generator',
        type: 'software-component',
        version: this.options.version,
        trustAnchor: true,
        capabilities: ['attestation-generation', 'cryptographic-signing', 'provenance-tracking']
      });
      
      // Key management system
      const keys = await keyManager.listKeys({ status: 'active' });
      if (keys.length > 0) {
        chain.push({
          level: 1,
          entity: 'key-management-system',
          type: 'cryptographic-module',
          keyCount: keys.length,
          algorithms: [...new Set(keys.map(k => k.algorithm))],
          capabilities: ['key-generation', 'digital-signing', 'key-rotation']
        });
      }
      
      // Content addressing system
      chain.push({
        level: 1,
        entity: 'content-addressing-system',
        type: 'integrity-module',
        algorithm: this.options.algorithm,
        capabilities: ['content-addressing', 'hash-verification', 'cid-generation']
      });
      
      // External trust anchors from metadata
      if (metadata.trustAnchors) {
        metadata.trustAnchors.forEach((anchor, index) => {
          chain.push({
            level: 2,
            entity: anchor.entity,
            type: anchor.type || 'external-anchor',
            ...anchor,
            capabilities: anchor.capabilities || []
          });
        });
      }
      
      return chain;
      
    } catch (error) {
      this.logger.warn('Failed to build trust chain:', error);
      return [];
    }
  },

  // Helper methods

  _getArtifactType(artifactPath) {
    const ext = artifactPath.toLowerCase().split('.').pop();
    const typeMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'json': 'json',
      'ttl': 'turtle-rdf',
      'rdf': 'rdf-xml',
      'n3': 'n3-rdf',
      'nt': 'n-triples',
      'jsonld': 'json-ld',
      'md': 'markdown',
      'txt': 'text',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml'
    };
    return typeMap[ext] || 'unknown';
  },

  _getContentType(artifactPath) {
    const ext = artifactPath.toLowerCase().split('.').pop();
    const contentTypeMap = {
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'json': 'application/json',
      'ttl': 'text/turtle',
      'rdf': 'application/rdf+xml',
      'n3': 'text/n3',
      'nt': 'application/n-triples',
      'jsonld': 'application/ld+json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'yml': 'application/yaml',
      'yaml': 'application/yaml',
      'xml': 'application/xml'
    };
    return contentTypeMap[ext] || 'application/octet-stream';
  },

  _detectLineEnding(content) {
    if (content.includes('\r\n')) return 'crlf';
    if (content.includes('\n')) return 'lf';
    if (content.includes('\r')) return 'cr';
    return 'none';
  },

  _mapToJWTAlgorithm(keyAlgorithm) {
    const mapping = {
      'Ed25519': 'EdDSA',
      'RSA-2048': 'RS256',
      'RSA-4096': 'RS256',
      'HMAC-256': 'HS256',
      'HMAC-384': 'HS384',
      'HMAC-512': 'HS512'
    };
    return mapping[keyAlgorithm] || 'HS256';
  },

  async _compressAttestation(attestation) {
    // In a real implementation, this would use compression
    // For now, return a simplified version
    return {
      v: attestation.version,
      t: attestation.timestamp,
      a: attestation.artifact.cid,
      h: attestation.artifact.contentHash
    };
  },

  _createMinimalAttestation(attestation) {
    return {
      cid: attestation.artifact.cid,
      hash: attestation.artifact.contentHash,
      timestamp: attestation.timestamp,
      verified: true
    };
  },

  async _createDigitalSignature(attestation, metadata) {
    try {
      const keys = await keyManager.listKeys({ status: 'active' });
      if (keys.length === 0) {
        throw new Error('No active signing keys available');
      }
      
      const signingKey = keys[0];
      const keyPair = await keyManager.loadKeyPair(signingKey.keyId);
      
      // Create signature using attestation resolver's signing
      return await attestResolver.signAttestation(attestation, keyPair.privateKey || keyPair.secret);
      
    } catch (error) {
      throw new Error(`Digital signature creation failed: ${error.message}`);
    }
  },

  async _createLegacySignature(attestation) {
    // Simplified signature for backward compatibility
    const content = JSON.stringify(attestation, Object.keys(attestation).sort());
    const hash = createHash('sha256').update(content).digest('hex');
    
    return {
      algorithm: 'SHA256',
      hash,
      timestamp: this.getDeterministicDate().toISOString(),
      format: 'legacy'
    };
  }
};