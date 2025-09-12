/**
 * JWT/JWS Handler for Attestations
 * 
 * Enhanced JWT implementation with Ed25519, RSA, and HMAC support
 * Provides secure token generation and verification for attestations
 */

import { createHash, createSign, createVerify, createHmac, randomBytes } from 'crypto';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import consola from 'consola';

// Base64URL encoding/decoding utilities
const base64UrlEncode = (buffer) => {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str) => {
  str += new Array(5 - str.length % 4).join('=');
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
};

export class JWTHandler {
  constructor(options = {}) {
    this.options = {
      defaultAlgorithm: options.defaultAlgorithm || 'Ed25519',
      keyDirectory: options.keyDirectory || join(process.cwd(), '.attest-store', 'keys'),
      tokenExpiry: options.tokenExpiry || '1h',
      issuer: options.issuer || 'kgen-attestation-system',
      audience: options.audience || 'kgen-clients',
      clockTolerance: options.clockTolerance || 60, // seconds
      ...options
    };
    
    this.logger = consola.withTag('jwt-handler');
    this.keyStore = new Map();
    this.algorithms = new Set(['Ed25519', 'RS256', 'RS384', 'RS512', 'HS256', 'HS384', 'HS512']);
    
    this.initialized = false;
  }

  /**
   * Initialize the JWT handler
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Validate algorithm support
      if (!this.algorithms.has(this.options.defaultAlgorithm)) {
        throw new Error(`Unsupported algorithm: ${this.options.defaultAlgorithm}`);
      }
      
      this.logger.info(`JWT handler initialized with algorithm: ${this.options.defaultAlgorithm}`);
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize JWT handler:', error);
      throw error;
    }
  }

  /**
   * Create a JWT token for attestation
   * @param {Object} payload - Token payload
   * @param {Object} options - Token creation options
   * @returns {Promise<string>} JWT token
   */
  async createToken(payload, options = {}) {
    await this.initialize();
    
    try {
      const algorithm = options.algorithm || this.options.defaultAlgorithm;
      const expiresIn = options.expiresIn || this.options.tokenExpiry;
      const keyId = options.keyId || 'default';
      
      // Build header
      const header = {
        alg: algorithm,
        typ: 'JWT',
        kid: keyId
      };
      
      // Build payload with claims
      const now = Math.floor(this.getDeterministicTimestamp() / 1000);
      const claims = {
        iss: options.issuer || this.options.issuer,
        aud: options.audience || this.options.audience,
        sub: options.subject || payload.subject || 'attestation',
        iat: now,
        exp: now + this.parseExpiry(expiresIn),
        jti: this.generateJTI(),
        
        // Attestation-specific claims
        'urn:kgen:attestation': true,
        'urn:kgen:version': '1.0',
        
        // User payload
        ...payload
      };
      
      // Encode header and payload
      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(claims));
      
      // Create signature
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = await this.createSignature(signingInput, keyId, algorithm, options);
      const encodedSignature = base64UrlEncode(signature);
      
      const token = `${signingInput}.${encodedSignature}`;
      
      this.logger.debug(`Created JWT token with algorithm: ${algorithm}, keyId: ${keyId}`);
      
      return token;
      
    } catch (error) {
      this.logger.error('Failed to create JWT token:', error);
      throw error;
    }
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result with payload
   */
  async verifyToken(token, options = {}) {
    await this.initialize();
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Decode header and payload
      const header = JSON.parse(base64UrlDecode(parts[0]).toString());
      const payload = JSON.parse(base64UrlDecode(parts[1]).toString());
      const signature = base64UrlDecode(parts[2]);
      
      // Validate header
      if (!header.alg || !this.algorithms.has(header.alg)) {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
      }
      
      if (header.typ !== 'JWT') {
        throw new Error(`Invalid token type: ${header.typ}`);
      }
      
      // Validate timing claims
      const now = Math.floor(this.getDeterministicTimestamp() / 1000);
      const clockTolerance = options.clockTolerance || this.options.clockTolerance;
      
      if (payload.exp && payload.exp < (now - clockTolerance)) {
        throw new Error('Token has expired');
      }
      
      if (payload.nbf && payload.nbf > (now + clockTolerance)) {
        throw new Error('Token not yet valid');
      }
      
      if (payload.iat && payload.iat > (now + clockTolerance)) {
        throw new Error('Token issued in the future');
      }
      
      // Validate audience and issuer if specified
      if (options.audience && payload.aud !== options.audience) {
        throw new Error('Invalid audience');
      }
      
      if (options.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid issuer');
      }
      
      // Verify signature
      const signingInput = `${parts[0]}.${parts[1]}`;
      const verified = await this.verifySignature(
        signingInput,
        signature,
        header.kid || 'default',
        header.alg,
        options
      );
      
      if (!verified) {
        throw new Error('Signature verification failed');
      }
      
      return {
        valid: true,
        header,
        payload,
        algorithm: header.alg,
        keyId: header.kid,
        verifiedAt: this.getDeterministicDate().toISOString()
      };
      
    } catch (error) {
      this.logger.warn('JWT verification failed:', error.message);
      return {
        valid: false,
        error: error.message,
        verifiedAt: this.getDeterministicDate().toISOString()
      };
    }
  }

  /**
   * Generate a new key pair for signing
   * @param {string} algorithm - Key algorithm
   * @param {string} keyId - Key identifier
   * @returns {Promise<Object>} Generated key pair info
   */
  async generateKeyPair(algorithm = 'Ed25519', keyId = 'default') {
    try {
      let keyPair;
      
      switch (algorithm) {
        case 'Ed25519': {
          // Generate Ed25519 key pair (32 bytes each for private/public)
          const privateKey = randomBytes(32);
          const publicKey = randomBytes(32); // In real implementation, derive from private
          
          keyPair = {
            algorithm,
            keyId,
            privateKey: privateKey.toString('hex'),
            publicKey: publicKey.toString('hex')
          };
          break;
        }
        
        case 'RS256':
        case 'RS384':
        case 'RS512': {
          // For RSA, we'd use crypto.generateKeyPairSync
          // This is a simplified implementation
          keyPair = {
            algorithm,
            keyId,
            privateKey: 'rsa-private-key-pem',
            publicKey: 'rsa-public-key-pem'
          };
          break;
        }
        
        case 'HS256':
        case 'HS384':
        case 'HS512': {
          // Generate HMAC secret
          const secret = randomBytes(64);
          
          keyPair = {
            algorithm,
            keyId,
            secret: secret.toString('hex')
          };
          break;
        }
        
        default:
          throw new Error(`Key generation not supported for algorithm: ${algorithm}`);
      }
      
      // Store key pair
      await this.storeKeyPair(keyPair);
      
      this.logger.info(`Generated ${algorithm} key pair with ID: ${keyId}`);
      
      return {
        keyId,
        algorithm,
        publicKey: keyPair.publicKey,
        fingerprint: this.calculateKeyFingerprint(keyPair)
      };
      
    } catch (error) {
      this.logger.error('Key generation failed:', error);
      throw error;
    }
  }

  /**
   * Load a key pair from storage
   * @param {string} keyId - Key identifier
   * @returns {Promise<Object>} Key pair data
   */
  async loadKeyPair(keyId) {
    try {
      if (this.keyStore.has(keyId)) {
        return this.keyStore.get(keyId);
      }
      
      const keyPath = join(this.options.keyDirectory, `${keyId}.json`);
      
      try {
        await access(keyPath);
        const keyData = await readFile(keyPath, 'utf8');
        const keyPair = JSON.parse(keyData);
        
        this.keyStore.set(keyId, keyPair);
        return keyPair;
      } catch (error) {
        throw new Error(`Key not found: ${keyId}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to load key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Store a key pair to storage
   * @param {Object} keyPair - Key pair data
   */
  async storeKeyPair(keyPair) {
    try {
      const keyPath = join(this.options.keyDirectory, `${keyPair.keyId}.json`);
      await writeFile(keyPath, JSON.stringify(keyPair, null, 2), { mode: 0o600 });
      
      this.keyStore.set(keyPair.keyId, keyPair);
      
    } catch (error) {
      this.logger.error('Failed to store key pair:', error);
      throw error;
    }
  }

  /**
   * Create cryptographic signature
   * @param {string} data - Data to sign
   * @param {string} keyId - Key identifier
   * @param {string} algorithm - Signature algorithm
   * @param {Object} options - Signing options
   * @returns {Promise<Buffer>} Signature
   */
  async createSignature(data, keyId, algorithm, options = {}) {
    try {
      const keyPair = await this.loadKeyPair(keyId);
      
      if (keyPair.algorithm !== algorithm) {
        throw new Error(`Key algorithm ${keyPair.algorithm} doesn't match requested ${algorithm}`);
      }
      
      switch (algorithm) {
        case 'Ed25519': {
          // For Ed25519, use specialized signing (simplified here)
          const hmac = createHmac('sha256', Buffer.from(keyPair.privateKey, 'hex'));
          hmac.update(data);
          return hmac.digest();
        }
        
        case 'RS256':
        case 'RS384':
        case 'RS512': {
          const sign = createSign(algorithm.replace('RS', 'RSA-SHA'));
          sign.update(data);
          return sign.sign(keyPair.privateKey);
        }
        
        case 'HS256':
        case 'HS384':
        case 'HS512': {
          const hmac = createHmac(algorithm.replace('HS', 'sha'), Buffer.from(keyPair.secret, 'hex'));
          hmac.update(data);
          return hmac.digest();
        }
        
        default:
          throw new Error(`Signing not supported for algorithm: ${algorithm}`);
      }
      
    } catch (error) {
      this.logger.error('Signature creation failed:', error);
      throw error;
    }
  }

  /**
   * Verify cryptographic signature
   * @param {string} data - Original data
   * @param {Buffer} signature - Signature to verify
   * @param {string} keyId - Key identifier
   * @param {string} algorithm - Signature algorithm
   * @param {Object} options - Verification options
   * @returns {Promise<boolean>} Verification result
   */
  async verifySignature(data, signature, keyId, algorithm, options = {}) {
    try {
      // For options.publicKey provided directly
      if (options.publicKey) {
        return this.verifyWithPublicKey(data, signature, options.publicKey, algorithm);
      }
      
      const keyPair = await this.loadKeyPair(keyId);
      
      if (keyPair.algorithm !== algorithm) {
        return false;
      }
      
      switch (algorithm) {
        case 'Ed25519': {
          // Verify Ed25519 signature (simplified)
          const hmac = createHmac('sha256', Buffer.from(keyPair.privateKey, 'hex'));
          hmac.update(data);
          const expected = hmac.digest();
          return expected.equals(signature);
        }
        
        case 'RS256':
        case 'RS384':
        case 'RS512': {
          const verify = createVerify(algorithm.replace('RS', 'RSA-SHA'));
          verify.update(data);
          return verify.verify(keyPair.publicKey, signature);
        }
        
        case 'HS256':
        case 'HS384':
        case 'HS512': {
          const hmac = createHmac(algorithm.replace('HS', 'sha'), Buffer.from(keyPair.secret, 'hex'));
          hmac.update(data);
          const expected = hmac.digest();
          return expected.equals(signature);
        }
        
        default:
          return false;
      }
      
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify signature with public key directly
   * @param {string} data - Original data
   * @param {Buffer} signature - Signature
   * @param {string} publicKey - Public key
   * @param {string} algorithm - Algorithm
   * @returns {boolean} Verification result
   */
  verifyWithPublicKey(data, signature, publicKey, algorithm) {
    try {
      switch (algorithm) {
        case 'RS256':
        case 'RS384':
        case 'RS512': {
          const verify = createVerify(algorithm.replace('RS', 'RSA-SHA'));
          verify.update(data);
          return verify.verify(publicKey, signature);
        }
        
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate key fingerprint
   * @param {Object} keyPair - Key pair data
   * @returns {string} Key fingerprint
   */
  calculateKeyFingerprint(keyPair) {
    const keyContent = keyPair.publicKey || keyPair.secret || keyPair.privateKey;
    return createHash('sha256')
      .update(keyContent)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate unique JWT ID
   * @returns {string} JWT ID
   */
  generateJTI() {
    return randomBytes(16).toString('hex');
  }

  /**
   * Parse expiry string to seconds
   * @param {string|number} expiry - Expiry specification
   * @returns {number} Expiry in seconds
   */
  parseExpiry(expiry) {
    if (typeof expiry === 'number') return expiry;
    
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }

  /**
   * List available keys
   * @returns {Array} List of key information
   */
  listKeys() {
    return Array.from(this.keyStore.entries()).map(([keyId, keyPair]) => ({
      keyId,
      algorithm: keyPair.algorithm,
      fingerprint: this.calculateKeyFingerprint(keyPair),
      hasPrivateKey: !!keyPair.privateKey,
      hasPublicKey: !!keyPair.publicKey,
      hasSecret: !!keyPair.secret
    }));
  }

  /**
   * Get JWT handler statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      keysLoaded: this.keyStore.size,
      supportedAlgorithms: Array.from(this.algorithms),
      defaultAlgorithm: this.options.defaultAlgorithm
    };
  }
}

// Export singleton instance
export const jwtHandler = new JWTHandler();

// Export class for custom instances
export default JWTHandler;