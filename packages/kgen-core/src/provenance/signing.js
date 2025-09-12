/**
 * JOSE/JWS Signing Implementation with Ed25519
 * 
 * Provides real cryptographic attestation using JOSE standards
 * with Ed25519 signatures for enhanced security and performance.
 */

import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import { ed25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

export class JOSESigningManager {
  constructor(config = {}) {
    this.config = {
      algorithm: 'EdDSA',
      curve: 'Ed25519',
      keyFormat: 'pkcs8',
      keySize: 32, // Ed25519 key size
      keyPath: config.keyPath || './keys/ed25519-private.key',
      publicKeyPath: config.publicKeyPath || './keys/ed25519-public.key',
      issuer: config.issuer || 'kgen-attestation-system',
      audience: config.audience || 'kgen-verification',
      tokenExpiry: config.tokenExpiry || '1y',
      ...config
    };
    
    this.logger = consola.withTag('jose-signing');
    this.privateKey = null;
    this.publicKey = null;
    this.keyMetadata = {
      generated: null,
      algorithm: this.config.algorithm,
      curve: this.config.curve,
      publicKeyHex: null
    };
  }

  /**
   * Initialize the signing manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing JOSE signing with Ed25519...');
      
      await this._loadOrGenerateKeys();
      
      this.logger.success('JOSE signing manager initialized successfully');
      
      return {
        status: 'success',
        algorithm: this.config.algorithm,
        curve: this.config.curve,
        publicKeyHex: this.keyMetadata.publicKeyHex
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize JOSE signing manager:', error);
      throw error;
    }
  }

  /**
   * Sign attestation payload with Ed25519
   * @param {Object} payload - Attestation payload to sign
   * @param {Object} options - Signing options
   * @returns {Promise<string>} JWT token
   */
  async signAttestation(payload, options = {}) {
    try {
      if (!this.privateKey) {
        throw new Error('Private key not loaded');
      }

      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ 
          alg: this.config.algorithm,
          typ: 'JWT',
          kid: this.keyMetadata.publicKeyHex?.substring(0, 16) // Key ID from public key
        })
        .setIssuer(this.config.issuer)
        .setAudience(this.config.audience)
        .setIssuedAt()
        .setExpirationTime(options.expiry || this.config.tokenExpiry)
        .setJti(options.jti || this._generateJTI()) // JWT ID
        .sign(this.privateKey);

      this.logger.debug('Attestation signed with Ed25519');
      
      return jwt;
      
    } catch (error) {
      this.logger.error('Failed to sign attestation:', error);
      throw error;
    }
  }

  /**
   * Verify JWT signature
   * @param {string} jwt - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result with payload
   */
  async verifyAttestation(jwt, options = {}) {
    try {
      if (!this.publicKey) {
        throw new Error('Public key not loaded');
      }

      const { payload, protectedHeader } = await jwtVerify(jwt, this.publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
        ...options
      });

      this.logger.debug('JWT signature verified successfully');
      
      return {
        valid: true,
        payload,
        header: protectedHeader,
        verifiedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('JWT verification failed:', error);
      
      return {
        valid: false,
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generate new Ed25519 key pair
   * @returns {Promise<Object>} Generated key pair
   */
  async generateKeyPair() {
    try {
      this.logger.info('Generating Ed25519 key pair...');
      
      // Generate raw Ed25519 key pair using correct API
      const privateKeyBytes = ed25519.utils.randomSecretKey();
      const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
      
      // Convert to hex for storage and identification
      const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
      const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');
      
      // Create PKCS8 format for JOSE compatibility
      const privateKeyPKCS8 = this._createPKCS8(privateKeyBytes);
      const publicKeySPKI = this._createSPKI(publicKeyBytes);
      
      const keyPair = {
        privateKeyHex,
        publicKeyHex,
        privateKeyPKCS8,
        publicKeySPKI,
        algorithm: this.config.algorithm,
        curve: this.config.curve,
        generated: new Date().toISOString()
      };
      
      this.logger.success('Generated Ed25519 key pair');
      
      return keyPair;
      
    } catch (error) {
      this.logger.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  /**
   * Save key pair to files
   * @param {Object} keyPair - Key pair to save
   */
  async saveKeyPair(keyPair) {
    try {
      // Ensure directories exist
      await fs.mkdir(path.dirname(this.config.keyPath), { recursive: true });
      await fs.mkdir(path.dirname(this.config.publicKeyPath), { recursive: true });
      
      // Save private key in PKCS8 format
      await fs.writeFile(this.config.keyPath, keyPair.privateKeyPKCS8, { mode: 0o600 });
      
      // Save public key in SPKI format
      await fs.writeFile(this.config.publicKeyPath, keyPair.publicKeySPKI, { mode: 0o644 });
      
      // Save metadata
      const metadataPath = `${this.config.keyPath}.meta`;
      const metadata = {
        algorithm: keyPair.algorithm,
        curve: keyPair.curve,
        publicKeyHex: keyPair.publicKeyHex,
        generated: keyPair.generated
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      this.logger.success(`Saved Ed25519 key pair to ${this.config.keyPath}`);
      
    } catch (error) {
      this.logger.error('Failed to save key pair:', error);
      throw error;
    }
  }

  /**
   * Load key pair from files
   * @returns {Promise<Object>} Loaded key pair
   */
  async loadKeyPair() {
    try {
      // Load private key
      const privateKeyPKCS8 = await fs.readFile(this.config.keyPath, 'utf8');
      
      // Load public key
      const publicKeySPKI = await fs.readFile(this.config.publicKeyPath, 'utf8');
      
      // Load metadata
      const metadataPath = `${this.config.keyPath}.meta`;
      let metadata = {};
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        this.logger.warn('Key metadata not found, will regenerate');
      }
      
      const keyPair = {
        privateKeyPKCS8,
        publicKeySPKI,
        algorithm: metadata.algorithm || this.config.algorithm,
        curve: metadata.curve || this.config.curve,
        publicKeyHex: metadata.publicKeyHex,
        generated: metadata.generated
      };
      
      this.logger.success('Loaded Ed25519 key pair successfully');
      
      return keyPair;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Key files not found. Expected: ${this.config.keyPath}, ${this.config.publicKeyPath}`);
      }
      throw error;
    }
  }

  /**
   * Create attestation with signature
   * @param {Object} attestationData - Attestation data to sign
   * @returns {Promise<Object>} Complete attestation with signature
   */
  async createSignedAttestation(attestationData) {
    try {
      // Create the payload for signing
      const payload = {
        sub: attestationData.artifact?.path || 'unknown',
        iat: Math.floor(Date.now() / 1000),
        attestation: attestationData
      };
      
      // Sign the payload
      const jwt = await this.signAttestation(payload);
      
      // Create the complete attestation structure
      const signedAttestation = {
        version: '1.0.0',
        artifact: attestationData.artifact,
        generation: attestationData.generation,
        provenance: attestationData.provenance,
        signature: {
          format: 'JWT',
          algorithm: this.config.algorithm,
          curve: this.config.curve,
          jwt,
          publicKeyHex: this.keyMetadata.publicKeyHex,
          signedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
      
      return signedAttestation;
      
    } catch (error) {
      this.logger.error('Failed to create signed attestation:', error);
      throw error;
    }
  }

  /**
   * Get signing manager status
   */
  getStatus() {
    return {
      algorithm: this.config.algorithm,
      curve: this.config.curve,
      hasKeys: !!(this.privateKey && this.publicKey),
      keyMetadata: this.keyMetadata,
      issuer: this.config.issuer,
      audience: this.config.audience
    };
  }

  // Private methods

  async _loadOrGenerateKeys() {
    try {
      // Try to load existing keys
      const keyPair = await this.loadKeyPair();
      
      this.privateKey = await importPKCS8(keyPair.privateKeyPKCS8, this.config.algorithm);
      this.publicKey = await importSPKI(keyPair.publicKeySPKI, this.config.algorithm);
      
      this.keyMetadata = {
        generated: keyPair.generated,
        algorithm: keyPair.algorithm,
        curve: keyPair.curve,
        publicKeyHex: keyPair.publicKeyHex
      };
      
      this.logger.info('Loaded existing Ed25519 key pair');
      
    } catch (error) {
      this.logger.info('Existing keys not found, generating new pair...');
      
      // Generate new key pair
      const keyPair = await this.generateKeyPair();
      
      // Save new keys
      await this.saveKeyPair(keyPair);
      
      // Load for use
      this.privateKey = await importPKCS8(keyPair.privateKeyPKCS8, this.config.algorithm);
      this.publicKey = await importSPKI(keyPair.publicKeySPKI, this.config.algorithm);
      
      this.keyMetadata = {
        generated: keyPair.generated,
        algorithm: keyPair.algorithm,
        curve: keyPair.curve,
        publicKeyHex: keyPair.publicKeyHex
      };
    }
  }

  _generateJTI() {
    return Buffer.from(randomBytes(16)).toString('hex');
  }

  /**
   * Create PKCS8 format from raw Ed25519 private key
   * @param {Uint8Array} privateKeyBytes - Raw private key bytes
   * @returns {string} PKCS8 formatted private key
   */
  _createPKCS8(privateKeyBytes) {
    // Ed25519 PKCS8 wrapper - simplified version
    // In production, use a proper ASN.1 library
    const prefix = Buffer.from([
      0x30, 0x2e, // SEQUENCE
      0x02, 0x01, 0x00, // INTEGER 0
      0x30, 0x05, // SEQUENCE
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
      0x04, 0x22, // OCTET STRING
      0x04, 0x20 // OCTET STRING (32 bytes)
    ]);
    
    const pkcs8 = Buffer.concat([prefix, Buffer.from(privateKeyBytes)]);
    
    return '-----BEGIN PRIVATE KEY-----\n' +
           pkcs8.toString('base64').match(/.{1,64}/g).join('\n') +
           '\n-----END PRIVATE KEY-----\n';
  }

  /**
   * Create SPKI format from raw Ed25519 public key
   * @param {Uint8Array} publicKeyBytes - Raw public key bytes
   * @returns {string} SPKI formatted public key
   */
  _createSPKI(publicKeyBytes) {
    // Ed25519 SPKI wrapper - simplified version
    const prefix = Buffer.from([
      0x30, 0x2a, // SEQUENCE
      0x30, 0x05, // SEQUENCE
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
      0x03, 0x21, 0x00 // BIT STRING
    ]);
    
    const spki = Buffer.concat([prefix, Buffer.from(publicKeyBytes)]);
    
    return '-----BEGIN PUBLIC KEY-----\n' +
           spki.toString('base64').match(/.{1,64}/g).join('\n') +
           '\n-----END PUBLIC KEY-----\n';
  }
}

export default JOSESigningManager;
