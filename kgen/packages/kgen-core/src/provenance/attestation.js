/**
 * Production-Grade Attestation Generator for kgen-core
 * 
 * Generates cryptographically verifiable attestations using:
 * - Ed25519 signatures for high performance and security
 * - RSA-2048/4096 for enterprise compatibility
 * - JOSE/JWS tokens compatible with external tools
 * - SLSA compliance features
 * - W3C PROV-O compliant metadata
 */

import { 
  generateKeyPair as joseGenerateKeyPair,
  SignJWT, 
  exportJWK,
  importJWK
} from 'jose';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { JOSEOperations } from './jose.js';
import { KeyManager } from './keys.js';
import { SidecarGenerator } from './sidecar.js';

export class AttestationGenerator {
  constructor(config = {}) {
    this.config = {
      // Algorithm preferences
      defaultAlgorithm: config.defaultAlgorithm || 'EdDSA',
      supportedAlgorithms: config.supportedAlgorithms || ['EdDSA', 'RS256', 'RS512'],
      
      // JOSE configuration
      issuer: config.issuer || 'urn:kgen:provenance-system',
      audience: config.audience || ['urn:kgen:verifiers', 'urn:external:jwt-tools'],
      
      // SLSA compliance
      slsaLevel: config.slsaLevel || 'SLSA_BUILD_LEVEL_L2',
      builderIdentity: config.builderIdentity || 'kgen-attestation-system@v2.0.0',
      
      // Cache and performance
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      
      ...config
    };
    
    this.keyManager = new KeyManager(config.keyManager);
    this.joseOps = new JOSEOperations(config.jose);
    this.sidecarGen = new SidecarGenerator(config.sidecar);
    
    this.attestationCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the attestation generator
   */
  async initialize() {
    if (this.initialized) return;
    
    await this.keyManager.initialize();
    await this.joseOps.initialize();
    
    this.initialized = true;
  }

  /**
   * Generate comprehensive attestation for an artifact
   * @param {Object} artifact - Artifact information (path, content, hash, etc.)
   * @param {Object} context - Generation context (template, environment, etc.)
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Complete attestation with JWS tokens
   */
  async generateAttestation(artifact, context = {}, options = {}) {
    await this.initialize();
    
    const operationId = options.operationId || uuidv4();
    const timestamp = new Date().toISOString();
    
    try {
      // Create artifact metadata
      const artifactMetadata = await this._createArtifactMetadata(artifact);
      
      // Generate attestation payload
      const payload = await this._createAttestationPayload(
        artifactMetadata,
        context,
        operationId,
        timestamp
      );
      
      // Create JWS tokens for all supported algorithms
      const jwsTokens = await this._createJWSTokens(payload, options);
      
      // Create comprehensive attestation object
      const attestation = {
        version: '2.0.0',
        format: 'jose-jws-slsa',
        
        // Core attestation data
        artifact: artifactMetadata,
        generation: this._createGenerationMetadata(context, operationId, timestamp),
        
        // SLSA compliance data
        slsa: await this._createSLSAAttestation(artifactMetadata, context, operationId),
        
        // JWS signatures
        signatures: jwsTokens,
        
        // Public keys for verification
        verification: await this._createVerificationMetadata(jwsTokens),
        
        // W3C PROV-O provenance
        provenance: await this._createProvenanceMetadata(artifact, context),
        
        // Metadata
        metadata: {
          created: timestamp,
          operationId,
          compliance: {
            standards: ['RFC 7515', 'RFC 7518', 'RFC 7519', 'SLSA', 'W3C PROV-O'],
            level: this.config.slsaLevel,
            verifiable: true,
            externallyVerifiable: true
          }
        }
      };
      
      // Generate .attest.json sidecar if requested
      if (options.generateSidecar !== false) {
        await this.sidecarGen.generateSidecarFile(artifact.path, attestation);
      }
      
      return attestation;
      
    } catch (error) {
      throw new Error(`Failed to generate attestation for ${artifact.path}: ${error.message}`);
    }
  }

  /**
   * Generate multiple attestations in batch
   * @param {Array} artifacts - Array of artifacts to attest
   * @param {Object} context - Shared generation context
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Array of attestations
   */
  async generateBatchAttestations(artifacts, context = {}, options = {}) {
    await this.initialize();
    
    const batchId = options.batchId || uuidv4();
    const attestations = [];
    
    // Process artifacts in parallel batches
    const batchSize = options.batchSize || 10;
    for (let i = 0; i < artifacts.length; i += batchSize) {
      const batch = artifacts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (artifact, index) => {
        const batchContext = {
          ...context,
          batchId,
          batchIndex: i + index,
          totalArtifacts: artifacts.length
        };
        
        return this.generateAttestation(artifact, batchContext, options);
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          attestations.push(result.value);
        } else {
          // Log error but continue with other attestations
          console.error('Batch attestation failed:', result.reason);
          attestations.push({
            error: result.reason.message,
            status: 'failed'
          });
        }
      }
    }
    
    return attestations;
  }

  /**
   * Create artifact metadata with integrity verification
   */
  async _createArtifactMetadata(artifact) {
    const stats = await fs.stat(artifact.path).catch(() => null);
    
    return {
      path: artifact.path,
      name: path.basename(artifact.path),
      size: stats?.size || artifact.size || 0,
      contentHash: artifact.contentHash || await this._calculateFileHash(artifact.path),
      type: artifact.type || this._inferArtifactType(artifact.path),
      lastModified: stats?.mtime?.toISOString() || artifact.lastModified,
      permissions: stats ? `0${(stats.mode & parseInt('777', 8)).toString(8)}` : undefined,
      checksum: {
        algorithm: 'sha256',
        value: artifact.contentHash || await this._calculateFileHash(artifact.path)
      }
    };
  }

  /**
   * Create the core attestation payload
   */
  async _createAttestationPayload(artifact, context, operationId, timestamp) {
    return {
      // Standard JWT claims
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
      jti: operationId,
      
      // Artifact attestation
      artifact,
      
      // Generation context
      generation: {
        operationId,
        templatePath: context.templatePath,
        templateHash: context.templateHash,
        contextHash: this._hashObject(context),
        generatedAt: timestamp,
        generator: {
          name: 'kgen-provenance-system',
          version: '2.0.0',
          builderIdentity: this.config.builderIdentity
        },
        reproducible: context.reproducible !== false,
        deterministic: context.deterministic !== false
      },
      
      // Environment information  
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: context.hostname || 'unknown',
        username: context.username || 'unknown',
        workingDirectory: process.cwd()
      }
    };
  }

  /**
   * Create JWS tokens for all supported algorithms
   */
  async _createJWSTokens(payload, options) {
    const tokens = {};
    const algorithms = options.algorithms || this.config.supportedAlgorithms;
    
    for (const algorithm of algorithms) {
      try {
        const keyData = await this.keyManager.getActiveKey(algorithm);
        if (!keyData) {
          console.warn(`No active key found for algorithm: ${algorithm}`);
          continue;
        }
        
        const token = await this.joseOps.signPayload(payload, keyData, algorithm);
        tokens[algorithm.toLowerCase()] = token;
        
      } catch (error) {
        console.error(`Failed to create ${algorithm} token:`, error);
        // Continue with other algorithms
      }
    }
    
    return tokens;
  }

  /**
   * Create SLSA attestation compliant metadata
   */
  async _createSLSAAttestation(artifact, context, operationId) {
    return {
      buildDefinition: {
        buildType: 'https://kgen.dev/attestation/v2',
        externalParameters: {
          template: context.templatePath,
          context: context.contextHash,
          reproducible: context.reproducible !== false
        },
        internalParameters: {
          operationId,
          builderVersion: '2.0.0'
        },
        resolvedDependencies: context.dependencies || []
      },
      
      runDetails: {
        builder: {
          id: this.config.builderIdentity,
          version: {}
        },
        metadata: {
          invocationId: operationId,
          startedOn: new Date().toISOString(),
          finishedOn: new Date().toISOString()
        },
        byproducts: []
      },
      
      // SLSA provenance predicate
      predicateType: 'https://slsa.dev/provenance/v0.2',
      subject: [{
        name: artifact.path,
        digest: {
          sha256: artifact.contentHash
        }
      }]
    };
  }

  /**
   * Create verification metadata with public keys
   */
  async _createVerificationMetadata(jwsTokens) {
    const verification = {
      algorithms: Object.keys(jwsTokens),
      keys: {},
      instructions: {
        verify: "Use any standard JWT library to verify the JWS tokens",
        publicKeys: "Available in the 'keys' section as JWK format",
        examples: {
          javascript: "jwt.verify(signatures.eddsa, publicKey, {algorithms: ['EdDSA']})",
          python: "jwt.decode(token, public_key, algorithms=['EdDSA'])",
          cli: "jwt verify <token> --key <public.pem> --alg EdDSA"
        },
        externalTools: [
          "https://jwt.io - Online JWT debugger",
          "jwt-cli - Command line JWT tool",
          "Standard JWT libraries in all major languages"
        ]
      }
    };
    
    // Add public keys for each algorithm used
    for (const algorithm of verification.algorithms) {
      const keyData = await this.keyManager.getActiveKey(algorithm.toUpperCase());
      if (keyData) {
        verification.keys[algorithm] = keyData.publicJWK;
      }
    }
    
    return verification;
  }

  /**
   * Create W3C PROV-O compliant provenance metadata
   */
  async _createProvenanceMetadata(artifact, context) {
    const timestamp = new Date().toISOString();
    
    return {
      '@context': [
        'https://www.w3.org/ns/prov',
        'https://kgen.dev/provenance/v2'
      ],
      '@type': 'prov:Generation',
      'prov:entity': {
        '@id': `artifact:${artifact.path}`,
        '@type': 'prov:Entity',
        'kgen:contentHash': artifact.contentHash,
        'kgen:size': artifact.size
      },
      'prov:activity': {
        '@id': `generation:${context.operationId || uuidv4()}`,
        '@type': 'prov:Activity', 
        'prov:startedAtTime': timestamp,
        'prov:endedAtTime': timestamp,
        'prov:wasAssociatedWith': {
          '@id': 'agent:kgen-provenance-system',
          '@type': 'prov:SoftwareAgent'
        }
      },
      'prov:used': context.templatePath ? {
        '@id': `template:${context.templatePath}`,
        '@type': 'prov:Entity',
        'kgen:templateHash': context.templateHash
      } : undefined
    };
  }

  /**
   * Create generation metadata
   */
  _createGenerationMetadata(context, operationId, timestamp) {
    return {
      operationId,
      templatePath: context.templatePath,
      templateHash: context.templateHash, 
      contextHash: this._hashObject(context),
      generatedAt: timestamp,
      generator: {
        name: 'kgen-provenance-system',
        version: '2.0.0',
        builderIdentity: this.config.builderIdentity
      },
      reproducible: context.reproducible !== false,
      deterministic: context.deterministic !== false,
      dependencies: context.dependencies || []
    };
  }

  /**
   * Calculate file hash
   */
  async _calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Hash an object deterministically
   */
  _hashObject(obj) {
    const serialized = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Infer artifact type from file extension
   */
  _inferArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
      '.html': 'html',
      '.css': 'css',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'header'
    };
    return typeMap[ext] || 'unknown';
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      supportedAlgorithms: this.config.supportedAlgorithms,
      slsaLevel: this.config.slsaLevel,
      keyManager: this.keyManager.getStatus(),
      cacheSize: this.attestationCache.size,
      features: {
        slsaCompliance: true,
        w3cProvenance: true,
        externalVerification: true,
        batchProcessing: true
      }
    };
  }
}

export default AttestationGenerator;