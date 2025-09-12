/**
 * Production-Grade JOSE/JWS Attestation System
 * 
 * Implements cryptographically verifiable attestations using:
 * - Ed25519 signatures for high performance and security
 * - RSA-2048/4096 for enterprise compatibility
 * - Proper JWS (JSON Web Signature) tokens
 * - Key management and rotation
 * - External JWT tool compatibility
 */

import { 
  generateKeyPair, 
  SignJWT, 
  jwtVerify, 
  createLocalJWKSet,
  exportJWK,
  importJWK,
  EncryptJWT,
  jwtDecrypt
} from 'jose';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class JOSEAttestationSystem {
  constructor(config = {}) {
    this.config = {
      // Key algorithms supported
      defaultAlgorithm: config.defaultAlgorithm || 'EdDSA', // Ed25519
      supportedAlgorithms: config.supportedAlgorithms || ['EdDSA', 'RS256', 'RS512'],
      
      // Key management
      keyStorePath: config.keyStorePath || './keys',
      keyRotationInterval: config.keyRotationInterval || 86400000, // 24 hours
      enableKeyRotation: config.enableKeyRotation || false,
      
      // JWS configuration
      issuer: config.issuer || 'urn:kgen:attestation-system',
      audience: config.audience || ['urn:kgen:verifiers'],
      
      // Security
      enableEncryption: config.enableEncryption || false,
      encryptionAlgorithm: config.encryptionAlgorithm || 'A256GCM',
      
      // Performance
      cacheSize: config.cacheSize || 1000,
      enableCache: config.enableCache !== false,
      
      ...config
    };
    
    this.logger = consola.withTag('jose-attestation');
    this.keyStore = new Map();
    this.activeKeys = new Map();
    this.signatureCache = new Map();
    this.verificationCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the JOSE attestation system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.logger.info('Initializing JOSE/JWS attestation system...');
      
      // Ensure key storage directory exists
      await fs.mkdir(this.config.keyStorePath, { recursive: true });
      
      // Load existing keys or generate new ones
      await this._loadOrGenerateKeys();
      
      // Start key rotation if enabled
      if (this.config.enableKeyRotation) {
        this._startKeyRotation();
      }
      
      this.initialized = true;
      this.logger.success('JOSE/JWS attestation system initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize JOSE attestation system:', error);
      throw error;
    }
  }

  /**
   * Generate a new key pair for the specified algorithm
   * @param {string} algorithm - Algorithm (EdDSA, RS256, RS512)
   * @param {string} keyId - Unique key identifier
   * @returns {Promise<Object>} Generated key pair with metadata
   */
  async generateKeyPair(algorithm = this.config.defaultAlgorithm, keyId = null) {
    try {
      keyId = keyId || `key-${algorithm.toLowerCase()}-${Date.now()}`;
      
      let keyPair;
      let keySize;
      
      switch (algorithm) {
        case 'EdDSA':
          keyPair = await generateKeyPair('Ed25519', { extractable: true });
          keySize = 256; // Ed25519 equivalent
          break;
          
        case 'RS256':
          keyPair = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
          keySize = 2048;
          break;
          
        case 'RS512':
          keyPair = await generateKeyPair('RS512', { modulusLength: 4096, extractable: true });
          keySize = 4096;
          break;
          
        default:
          throw new Error(`Unsupported algorithm: ${algorithm}`);
      }
      
      // Export keys to JWK format
      const publicJWK = await exportJWK(keyPair.publicKey);
      const privateJWK = await exportJWK(keyPair.privateKey);
      
      // Add key metadata
      publicJWK.kid = keyId;
      publicJWK.use = 'sig';
      publicJWK.alg = algorithm;
      
      privateJWK.kid = keyId;
      privateJWK.use = 'sig';
      privateJWK.alg = algorithm;
      
      const keyMetadata = {
        keyId,
        algorithm,
        keySize,
        generated: new Date().toISOString(),
        publicJWK,
        privateJWK,
        keyPair,
        status: 'active',
        fingerprint: this._calculateJWKFingerprint(publicJWK)
      };
      
      // Store key
      this.keyStore.set(keyId, keyMetadata);
      this.activeKeys.set(algorithm, keyId);
      
      // Save to disk
      await this._saveKeyToDisk(keyMetadata);
      
      this.logger.success(`Generated ${algorithm} key pair: ${keyId} (${keySize}-bit equivalent)`);
      
      return keyMetadata;
      
    } catch (error) {
      this.logger.error(`Failed to generate ${algorithm} key pair:`, error);
      throw error;
    }
  }

  /**
   * Create a JWS attestation for an artifact
   * @param {Object} artifact - Artifact information
   * @param {Object} context - Generation context
   * @param {string} algorithm - Signing algorithm to use
   * @returns {Promise<string>} JWS token
   */
  async createAttestationJWS(artifact, context = {}, algorithm = this.config.defaultAlgorithm) {
    await this.initialize();
    
    try {
      // Get active key for algorithm
      const keyId = this.activeKeys.get(algorithm);
      if (!keyId) {
        throw new Error(`No active key found for algorithm: ${algorithm}`);
      }
      
      const keyData = this.keyStore.get(keyId);
      if (!keyData) {
        throw new Error(`Key data not found for: ${keyId}`);
      }
      
      // Create attestation payload
      const attestationPayload = {
        // Standard JWT claims
        iss: this.config.issuer,
        aud: this.config.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
        jti: uuidv4(),
        
        // Attestation-specific claims
        artifact: {
          path: artifact.path,
          name: path.basename(artifact.path),
          contentHash: artifact.contentHash,
          size: artifact.size,
          type: artifact.type || this._inferArtifactType(artifact.path)
        },
        
        // Generation context
        generation: {
          operationId: context.operationId || uuidv4(),
          templatePath: context.templatePath,
          contextHash: context.contextHash,
          templateHash: context.templateHash,
          generatedAt: context.generatedAt || new Date().toISOString(),
          generator: {
            name: 'kgen-jose-attestation-system',
            version: '1.0.0'
          }
        },
        
        // Environment information
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          hostname: context.hostname,
          username: context.username
        },
        
        // Verification metadata
        verification: {
          algorithm,
          keyId: keyData.keyId,
          keyFingerprint: keyData.fingerprint,
          reproducible: context.reproducible !== false,
          deterministic: context.deterministic !== false
        }
      };
      
      // Create and sign JWT
      const jwt = await new SignJWT(attestationPayload)
        .setProtectedHeader({ 
          alg: algorithm, 
          kid: keyId,
          typ: 'JWT'
        })
        .sign(keyData.keyPair.privateKey);
        
      this.logger.debug(`Created JWS attestation with ${algorithm} signature`);
      
      return jwt;
      
    } catch (error) {
      this.logger.error('Failed to create JWS attestation:', error);
      throw error;
    }
  }

  /**
   * Verify a JWS attestation token
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result with payload
   */
  async verifyAttestationJWS(jwsToken, options = {}) {
    await this.initialize();
    
    try {
      // Check cache first
      const cacheKey = this._generateCacheKey(jwsToken, 'verify');
      if (this.config.enableCache && this.verificationCache.has(cacheKey)) {
        return this.verificationCache.get(cacheKey);
      }
      
      // Extract header to get key ID
      const [headerB64] = jwsToken.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      
      // Get key for verification
      const keyData = this.keyStore.get(header.kid);
      if (!keyData) {
        throw new Error(`Key not found: ${header.kid}`);
      }
      
      // Verify the JWT
      const { payload } = await jwtVerify(jwsToken, keyData.keyPair.publicKey, {
        issuer: options.issuer || this.config.issuer,
        audience: options.audience || this.config.audience
      });
      
      const result = {
        valid: true,
        payload,
        header,
        keyId: header.kid,
        algorithm: header.alg,
        verifiedAt: new Date().toISOString()
      };
      
      // Cache result
      if (this.config.enableCache) {
        this._cacheVerification(cacheKey, result);
      }
      
      this.logger.debug(`Verified JWS attestation: ${header.kid}`);
      
      return result;
      
    } catch (error) {
      const result = {
        valid: false,
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
      
      this.logger.error('JWS verification failed:', error);
      
      return result;
    }
  }

  /**
   * Generate comprehensive attestation with both legacy format and JWS
   * @param {Object} artifact - Artifact information
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Enhanced attestation with JWS
   */
  async generateComprehensiveAttestation(artifact, context = {}) {
    await this.initialize();
    
    try {
      const startTime = performance.now();
      
      // Generate JWS tokens for all supported algorithms
      const jwsTokens = {};
      for (const algorithm of this.config.supportedAlgorithms) {
        if (this.activeKeys.has(algorithm)) {
          jwsTokens[algorithm.toLowerCase()] = await this.createAttestationJWS(
            artifact, 
            context, 
            algorithm
          );
        }
      }
      
      // Create comprehensive attestation
      const attestation = {
        version: '2.0.0',
        format: 'jose-jws',
        
        // Artifact information
        artifact: {
          path: artifact.path,
          name: path.basename(artifact.path),
          contentHash: artifact.contentHash,
          size: artifact.size,
          type: artifact.type || this._inferArtifactType(artifact.path),
          lastModified: artifact.lastModified
        },
        
        // Generation context
        generation: {
          operationId: context.operationId || uuidv4(),
          templatePath: context.templatePath,
          contextHash: context.contextHash,
          templateHash: context.templateHash,
          generatedAt: context.generatedAt || new Date().toISOString(),
          generator: {
            name: 'kgen-jose-attestation-system',
            version: '2.0.0'
          }
        },
        
        // JWS signatures (the main security feature)
        signatures: jwsTokens,
        
        // Key information for verification
        verification: {
          algorithms: Object.keys(jwsTokens),
          keys: {},
          instructions: {
            verify: "Use any standard JWT library to verify the JWS tokens",
            publicKeys: "Available in the 'keys' section as JWK format",
            example: "jwt.verify(signatures.eddsa, publicKey, {algorithms: ['EdDSA']})"
          }
        },
        
        // Include public keys for external verification
        keys: {},
        
        // Legacy format for backward compatibility
        legacy: {
          version: "1.0.0",
          signature: {
            algorithm: "sha256",
            value: crypto.createHash('sha256').update(JSON.stringify({
              artifact,
              generation: context
            })).digest('hex')
          }
        },
        
        // Metadata
        metadata: {
          created: new Date().toISOString(),
          processingTime: performance.now() - startTime,
          compliance: {
            standards: ['RFC 7515', 'RFC 7518', 'RFC 7519'], // JWS, JWA, JWT
            verifiable: true,
            externallyVerifiable: true
          }
        }
      };
      
      // Add public keys for verification
      for (const [alg, keyId] of this.activeKeys.entries()) {
        const keyData = this.keyStore.get(keyId);
        if (keyData) {
          attestation.keys[alg.toLowerCase()] = keyData.publicJWK;
          attestation.verification.keys[alg.toLowerCase()] = {
            keyId: keyData.keyId,
            fingerprint: keyData.fingerprint,
            algorithm: keyData.algorithm
          };
        }
      }
      
      this.logger.success(`Generated comprehensive attestation with ${Object.keys(jwsTokens).length} JWS signatures`);
      
      return attestation;
      
    } catch (error) {
      this.logger.error('Failed to generate comprehensive attestation:', error);
      throw error;
    }
  }

  /**
   * Verify comprehensive attestation including all JWS tokens
   * @param {Object} attestation - Attestation to verify
   * @returns {Promise<Object>} Comprehensive verification result
   */
  async verifyComprehensiveAttestation(attestation) {
    await this.initialize();
    
    try {
      const results = {
        valid: true,
        format: attestation.format || 'unknown',
        verificationResults: {},
        summary: {
          totalSignatures: 0,
          validSignatures: 0,
          invalidSignatures: 0
        },
        errors: []
      };
      
      // Verify JWS signatures if present
      if (attestation.signatures) {
        for (const [algorithm, jwsToken] of Object.entries(attestation.signatures)) {
          results.summary.totalSignatures++;
          
          try {
            const verificationResult = await this.verifyAttestationJWS(jwsToken);
            results.verificationResults[algorithm] = verificationResult;
            
            if (verificationResult.valid) {
              results.summary.validSignatures++;
            } else {
              results.summary.invalidSignatures++;
              results.valid = false;
              results.errors.push(`${algorithm} signature verification failed: ${verificationResult.error}`);
            }
            
          } catch (error) {
            results.summary.invalidSignatures++;
            results.valid = false;
            results.errors.push(`${algorithm} signature verification error: ${error.message}`);
          }
        }
      }
      
      // Check if we have any valid signatures
      if (results.summary.totalSignatures === 0) {
        results.valid = false;
        results.errors.push('No JWS signatures found in attestation');
      }
      
      return results;
      
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        verificationResults: {},
        summary: { totalSignatures: 0, validSignatures: 0, invalidSignatures: 0 }
      };
    }
  }

  /**
   * Export public keys in JWK Set format for external verification
   * @returns {Object} JWK Set containing all public keys
   */
  async exportPublicJWKS() {
    const jwks = {
      keys: []
    };
    
    for (const keyData of this.keyStore.values()) {
      if (keyData.status === 'active') {
        jwks.keys.push(keyData.publicJWK);
      }
    }
    
    return jwks;
  }

  /**
   * Rotate keys for all algorithms
   * @returns {Promise<Object>} Rotation results
   */
  async rotateAllKeys() {
    await this.initialize();
    
    try {
      this.logger.info('Starting key rotation for all algorithms...');
      
      const rotationResults = {};
      
      for (const algorithm of this.config.supportedAlgorithms) {
        try {
          // Generate new key
          const newKey = await this.generateKeyPair(algorithm);
          
          // Mark old key as rotated
          const oldKeyId = this.activeKeys.get(algorithm);
          if (oldKeyId) {
            const oldKey = this.keyStore.get(oldKeyId);
            if (oldKey) {
              oldKey.status = 'rotated';
              oldKey.rotatedAt = new Date().toISOString();
              await this._saveKeyToDisk(oldKey);
            }
          }
          
          rotationResults[algorithm] = {
            success: true,
            newKeyId: newKey.keyId,
            oldKeyId
          };
          
        } catch (error) {
          rotationResults[algorithm] = {
            success: false,
            error: error.message
          };
        }
      }
      
      // Clear caches after rotation
      this.signatureCache.clear();
      this.verificationCache.clear();
      
      this.logger.success('Key rotation completed');
      
      return rotationResults;
      
    } catch (error) {
      this.logger.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Get system status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      supportedAlgorithms: this.config.supportedAlgorithms,
      activeKeys: Object.fromEntries(this.activeKeys.entries()),
      keyCount: this.keyStore.size,
      cacheStats: {
        signatureCache: this.signatureCache.size,
        verificationCache: this.verificationCache.size,
        maxSize: this.config.cacheSize
      },
      features: {
        keyRotation: this.config.enableKeyRotation,
        encryption: this.config.enableEncryption,
        caching: this.config.enableCache
      }
    };
  }

  // Private methods

  async _loadOrGenerateKeys() {
    try {
      // Try to load existing keys
      const keyFiles = await fs.readdir(this.config.keyStorePath).catch(() => []);
      const jsonFiles = keyFiles.filter(f => f.endsWith('.json'));
      
      let keysLoaded = 0;
      
      for (const filename of jsonFiles) {
        try {
          const filePath = path.join(this.config.keyStorePath, filename);
          const keyData = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          // Recreate key pair from JWK
          keyData.keyPair = {
            privateKey: await importJWK(keyData.privateJWK, keyData.algorithm),
            publicKey: await importJWK(keyData.publicJWK, keyData.algorithm)
          };
          
          this.keyStore.set(keyData.keyId, keyData);
          
          if (keyData.status === 'active') {
            this.activeKeys.set(keyData.algorithm, keyData.keyId);
          }
          
          keysLoaded++;
          
        } catch (error) {
          this.logger.warn(`Failed to load key from ${filename}:`, error);
        }
      }
      
      this.logger.info(`Loaded ${keysLoaded} existing keys`);
      
      // Generate missing keys for supported algorithms
      for (const algorithm of this.config.supportedAlgorithms) {
        if (!this.activeKeys.has(algorithm)) {
          this.logger.info(`Generating new ${algorithm} key...`);
          await this.generateKeyPair(algorithm);
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to load or generate keys:', error);
      throw error;
    }
  }

  async _saveKeyToDisk(keyData) {
    const filename = `${keyData.keyId}.json`;
    const filePath = path.join(this.config.keyStorePath, filename);
    
    // Create a serializable version (without the actual key pair objects)
    const serializable = {
      ...keyData,
      keyPair: undefined // Don't serialize the CryptoKey objects
    };
    
    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
  }

  _startKeyRotation() {
    setInterval(async () => {
      try {
        await this.rotateAllKeys();
      } catch (error) {
        this.logger.error('Automatic key rotation failed:', error);
      }
    }, this.config.keyRotationInterval);
    
    this.logger.info(`Key rotation scheduled every ${this.config.keyRotationInterval}ms`);
  }

  _calculateJWKFingerprint(jwk) {
    // Create fingerprint from JWK thumbprint
    const canonical = JSON.stringify({
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
      y: jwk.y,
      n: jwk.n,
      e: jwk.e
    });
    
    return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
  }

  _generateCacheKey(data, operation) {
    return crypto.createHash('md5').update(`${operation}:${data}`).digest('hex');
  }

  _cacheVerification(key, result) {
    if (this.verificationCache.size >= this.config.cacheSize) {
      const firstKey = this.verificationCache.keys().next().value;
      this.verificationCache.delete(firstKey);
    }
    this.verificationCache.set(key, result);
  }

  _inferArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text'
    };
    return typeMap[ext] || 'unknown';
  }
}

// Export singleton instance
export const joseAttestationSystem = new JOSEAttestationSystem();
export default JOSEAttestationSystem;