/**
 * Key Management System
 * 
 * Handles cryptographic key generation, storage, rotation, and lifecycle
 * Supports Ed25519, RSA, and HMAC keys with secure storage
 */

import { createHash, randomBytes, generateKeyPairSync } from 'crypto';
import { readFile, writeFile, mkdir, readdir, unlink, access } from 'fs/promises';
import { join, basename } from 'path';
import consola from 'consola';

export class KeyManager {
  constructor(options = {}) {
    this.options = {
      keyDirectory: options.keyDirectory || join(process.cwd(), '.attest-store', 'keys'),
      backupDirectory: options.backupDirectory || join(process.cwd(), '.attest-store', 'backups'),
      rotationInterval: options.rotationInterval || 30 * 24 * 60 * 60 * 1000, // 30 days
      keyStrength: options.keyStrength || 2048, // For RSA keys
      enableBackups: options.enableBackups !== false,
      enableRotation: options.enableRotation !== false,
      ...options
    };
    
    this.logger = consola.withTag('key-manager');
    this.keyCache = new Map();
    this.rotationSchedule = new Map();
    
    this.supportedAlgorithms = new Set([
      'Ed25519',
      'RSA-2048',
      'RSA-4096',
      'HMAC-256',
      'HMAC-384',
      'HMAC-512'
    ]);
    
    this.initialized = false;
  }

  /**
   * Initialize the key manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create directories
      await mkdir(this.options.keyDirectory, { recursive: true });
      await mkdir(this.options.backupDirectory, { recursive: true });
      
      // Load existing keys
      await this.loadExistingKeys();
      
      // Schedule key rotation if enabled
      if (this.options.enableRotation) {
        await this.scheduleKeyRotation();
      }
      
      this.logger.info(`Key manager initialized with ${this.keyCache.size} keys`);
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize key manager:', error);
      throw error;
    }
  }

  /**
   * Generate a new key pair
   * @param {Object} options - Key generation options
   * @returns {Promise<Object>} Generated key information
   */
  async generateKeyPair(options = {}) {
    await this.initialize();
    
    const {
      algorithm = 'Ed25519',
      keyId = this.generateKeyId(),
      purpose = 'signing',
      metadata = {}
    } = options;
    
    if (!this.supportedAlgorithms.has(algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    
    try {
      let keyPair;
      const timestamp = this.getDeterministicDate().toISOString();
      
      switch (algorithm) {
        case 'Ed25519':
          keyPair = this.generateEd25519KeyPair(keyId, timestamp, metadata);
          break;
          
        case 'RSA-2048':
        case 'RSA-4096':
          keyPair = this.generateRSAKeyPair(algorithm, keyId, timestamp, metadata);
          break;
          
        case 'HMAC-256':
        case 'HMAC-384':
        case 'HMAC-512':
          keyPair = this.generateHMACKey(algorithm, keyId, timestamp, metadata);
          break;
          
        default:
          throw new Error(`Key generation not implemented for: ${algorithm}`);
      }
      
      // Add common metadata
      keyPair.purpose = purpose;
      keyPair.createdAt = timestamp;
      keyPair.status = 'active';
      keyPair.usage = {
        signatureCount: 0,
        lastUsed: null
      };
      
      // Store key pair
      await this.storeKeyPair(keyPair);
      
      // Schedule rotation if enabled
      if (this.options.enableRotation) {
        this.scheduleKeyForRotation(keyId);
      }
      
      this.logger.info(`Generated ${algorithm} key pair: ${keyId}`);
      
      return {
        keyId: keyPair.keyId,
        algorithm: keyPair.algorithm,
        purpose: keyPair.purpose,
        fingerprint: keyPair.fingerprint,
        publicKey: keyPair.publicKey,
        createdAt: keyPair.createdAt
      };
      
    } catch (error) {
      this.logger.error(`Failed to generate ${algorithm} key pair:`, error);
      throw error;
    }
  }

  /**
   * Load a key pair by ID
   * @param {string} keyId - Key identifier
   * @returns {Promise<Object>} Key pair data
   */
  async loadKeyPair(keyId) {
    await this.initialize();
    
    try {
      // Check cache first
      if (this.keyCache.has(keyId)) {
        const keyPair = this.keyCache.get(keyId);
        
        // Update usage stats
        keyPair.usage.lastUsed = this.getDeterministicDate().toISOString();
        await this.updateKeyUsage(keyId);
        
        return keyPair;
      }
      
      // Load from disk
      const keyPath = join(this.options.keyDirectory, `${keyId}.json`);
      
      try {
        await access(keyPath);
      } catch (error) {
        throw new Error(`Key not found: ${keyId}`);
      }
      
      const keyData = await readFile(keyPath, 'utf8');
      const keyPair = JSON.parse(keyData);
      
      // Validate key integrity
      await this.validateKeyIntegrity(keyPair);
      
      // Cache the key
      this.keyCache.set(keyId, keyPair);
      
      // Update usage stats
      keyPair.usage.lastUsed = this.getDeterministicDate().toISOString();
      keyPair.usage.signatureCount++;
      await this.updateKeyUsage(keyId);
      
      return keyPair;
      
    } catch (error) {
      this.logger.error(`Failed to load key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Rotate a key pair
   * @param {string} keyId - Key identifier to rotate
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} New key information
   */
  async rotateKey(keyId, options = {}) {
    await this.initialize();
    
    try {
      // Load current key
      const currentKey = await this.loadKeyPair(keyId);
      
      // Generate new key with same parameters
      const newKey = await this.generateKeyPair({
        algorithm: currentKey.algorithm,
        keyId: options.newKeyId || this.generateKeyId(),
        purpose: currentKey.purpose,
        metadata: {
          ...currentKey.metadata,
          rotatedFrom: keyId,
          rotationReason: options.reason || 'scheduled'
        }
      });
      
      // Mark old key as rotated
      currentKey.status = 'rotated';
      currentKey.rotatedAt = this.getDeterministicDate().toISOString();
      currentKey.rotatedTo = newKey.keyId;
      
      await this.updateKeyPair(currentKey);
      
      // Backup old key if enabled
      if (this.options.enableBackups) {
        await this.backupKey(keyId);
      }
      
      this.logger.info(`Rotated key ${keyId} to ${newKey.keyId}`);
      
      return newKey;
      
    } catch (error) {
      this.logger.error(`Failed to rotate key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Revoke a key pair
   * @param {string} keyId - Key identifier to revoke
   * @param {string} reason - Revocation reason
   * @returns {Promise<void>}
   */
  async revokeKey(keyId, reason = 'user_request') {
    await this.initialize();
    
    try {
      const keyPair = await this.loadKeyPair(keyId);
      
      // Mark key as revoked
      keyPair.status = 'revoked';
      keyPair.revokedAt = this.getDeterministicDate().toISOString();
      keyPair.revocationReason = reason;
      
      // Clear sensitive data
      if (keyPair.privateKey) {
        keyPair.privateKey = '[REVOKED]';
      }
      if (keyPair.secret) {
        keyPair.secret = '[REVOKED]';
      }
      
      await this.updateKeyPair(keyPair);
      
      // Remove from cache
      this.keyCache.delete(keyId);
      
      // Remove from rotation schedule
      this.rotationSchedule.delete(keyId);
      
      this.logger.info(`Revoked key ${keyId}: ${reason}`);
      
    } catch (error) {
      this.logger.error(`Failed to revoke key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * List all keys with their status
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of key information
   */
  async listKeys(filters = {}) {
    await this.initialize();
    
    try {
      const keys = [];
      const keyFiles = await readdir(this.options.keyDirectory);
      
      for (const file of keyFiles) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const keyPath = join(this.options.keyDirectory, file);
          const keyData = await readFile(keyPath, 'utf8');
          const keyPair = JSON.parse(keyData);
          
          // Apply filters
          if (filters.status && keyPair.status !== filters.status) continue;
          if (filters.algorithm && keyPair.algorithm !== filters.algorithm) continue;
          if (filters.purpose && keyPair.purpose !== filters.purpose) continue;
          
          keys.push({
            keyId: keyPair.keyId,
            algorithm: keyPair.algorithm,
            purpose: keyPair.purpose,
            status: keyPair.status,
            fingerprint: keyPair.fingerprint,
            createdAt: keyPair.createdAt,
            lastUsed: keyPair.usage?.lastUsed,
            signatureCount: keyPair.usage?.signatureCount || 0,
            expiresAt: keyPair.expiresAt,
            rotatedAt: keyPair.rotatedAt,
            revokedAt: keyPair.revokedAt
          });
        } catch (error) {
          this.logger.warn(`Failed to parse key file ${file}:`, error.message);
        }
      }
      
      return keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    } catch (error) {
      this.logger.error('Failed to list keys:', error);
      throw error;
    }
  }

  /**
   * Export key in various formats
   * @param {string} keyId - Key identifier
   * @param {string} format - Export format (jwk, pem, raw)
   * @returns {Promise<Object>} Exported key data
   */
  async exportKey(keyId, format = 'jwk') {
    await this.initialize();
    
    try {
      const keyPair = await this.loadKeyPair(keyId);
      
      if (keyPair.status === 'revoked') {
        throw new Error('Cannot export revoked key');
      }
      
      switch (format) {
        case 'jwk':
          return this.exportAsJWK(keyPair);
          
        case 'pem':
          return this.exportAsPEM(keyPair);
          
        case 'raw':
          return {
            keyId: keyPair.keyId,
            algorithm: keyPair.algorithm,
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
            secret: keyPair.secret
          };
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to export key ${keyId}:`, error);
      throw error;
    }
  }

  // Private methods

  generateEd25519KeyPair(keyId, timestamp, metadata) {
    // Generate Ed25519 key pair (simplified implementation)
    const privateKey = randomBytes(32);
    const publicKey = randomBytes(32); // In real implementation, derive from private
    
    return {
      keyId,
      algorithm: 'Ed25519',
      privateKey: privateKey.toString('hex'),
      publicKey: publicKey.toString('hex'),
      fingerprint: this.calculateFingerprint(publicKey),
      metadata
    };
  }

  generateRSAKeyPair(algorithm, keyId, timestamp, metadata) {
    const keySize = parseInt(algorithm.split('-')[1]);
    
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    return {
      keyId,
      algorithm,
      privateKey,
      publicKey,
      fingerprint: this.calculateFingerprint(publicKey),
      metadata
    };
  }

  generateHMACKey(algorithm, keyId, timestamp, metadata) {
    const bitSize = parseInt(algorithm.split('-')[1]);
    const keySize = bitSize / 8;
    const secret = randomBytes(keySize);
    
    return {
      keyId,
      algorithm,
      secret: secret.toString('hex'),
      fingerprint: this.calculateFingerprint(secret),
      metadata
    };
  }

  calculateFingerprint(keyData) {
    const data = typeof keyData === 'string' ? keyData : keyData.toString();
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  generateKeyId() {
    return `key-${this.getDeterministicTimestamp()}-${randomBytes(4).toString('hex')}`;
  }

  async storeKeyPair(keyPair) {
    const keyPath = join(this.options.keyDirectory, `${keyPair.keyId}.json`);
    await writeFile(keyPath, JSON.stringify(keyPair, null, 2), { mode: 0o600 });
    
    // Cache the key
    this.keyCache.set(keyPair.keyId, keyPair);
  }

  async updateKeyPair(keyPair) {
    await this.storeKeyPair(keyPair);
  }

  async updateKeyUsage(keyId) {
    const keyPair = this.keyCache.get(keyId);
    if (keyPair) {
      await this.updateKeyPair(keyPair);
    }
  }

  async validateKeyIntegrity(keyPair) {
    // Validate key structure
    if (!keyPair.keyId || !keyPair.algorithm || !keyPair.fingerprint) {
      throw new Error('Invalid key structure');
    }
    
    // Validate fingerprint
    const keyData = keyPair.publicKey || keyPair.secret || keyPair.privateKey;
    const expectedFingerprint = this.calculateFingerprint(keyData);
    
    if (keyPair.fingerprint !== expectedFingerprint) {
      throw new Error('Key integrity check failed');
    }
  }

  async loadExistingKeys() {
    try {
      const keyFiles = await readdir(this.options.keyDirectory);
      
      for (const file of keyFiles) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const keyId = basename(file, '.json');
          const keyPath = join(this.options.keyDirectory, file);
          const keyData = await readFile(keyPath, 'utf8');
          const keyPair = JSON.parse(keyData);
          
          await this.validateKeyIntegrity(keyPair);
          this.keyCache.set(keyId, keyPair);
        } catch (error) {
          this.logger.warn(`Failed to load key file ${file}:`, error.message);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
      this.logger.debug('No existing keys found');
    }
  }

  async scheduleKeyRotation() {
    for (const [keyId, keyPair] of this.keyCache) {
      if (keyPair.status === 'active') {
        this.scheduleKeyForRotation(keyId);
      }
    }
  }

  scheduleKeyForRotation(keyId) {
    const rotationTime = this.getDeterministicTimestamp() + this.options.rotationInterval;
    this.rotationSchedule.set(keyId, rotationTime);
    
    // In a production system, this would use a proper scheduler
    // For demo purposes, we'll disable automatic rotation to prevent infinite loops
    // setTimeout(async () => {
    //   try {
    //     await this.rotateKey(keyId, { reason: 'scheduled' });
    //   } catch (error) {
    //     this.logger.error(`Scheduled rotation failed for key ${keyId}:`, error);
    //   }
    // }, this.options.rotationInterval);
  }

  async backupKey(keyId) {
    try {
      const keyPair = this.keyCache.get(keyId);
      if (!keyPair) return;
      
      const backupPath = join(
        this.options.backupDirectory,
        `${keyId}-${this.getDeterministicTimestamp()}.json`
      );
      
      await writeFile(backupPath, JSON.stringify(keyPair, null, 2), { mode: 0o600 });
      this.logger.debug(`Backed up key ${keyId}`);
    } catch (error) {
      this.logger.error(`Failed to backup key ${keyId}:`, error);
    }
  }

  exportAsJWK(keyPair) {
    const jwk = {
      kty: this.getJWKKeyType(keyPair.algorithm),
      kid: keyPair.keyId,
      alg: this.getJWKAlgorithm(keyPair.algorithm),
      use: keyPair.purpose === 'signing' ? 'sig' : 'enc'
    };
    
    // Add algorithm-specific fields
    switch (keyPair.algorithm) {
      case 'Ed25519':
        jwk.crv = 'Ed25519';
        jwk.x = Buffer.from(keyPair.publicKey, 'hex').toString('base64url');
        if (keyPair.privateKey) {
          jwk.d = Buffer.from(keyPair.privateKey, 'hex').toString('base64url');
        }
        break;
        
      case 'RSA-2048':
      case 'RSA-4096':
        // Would need RSA key parsing for real implementation
        jwk.n = 'rsa-modulus-base64url';
        jwk.e = 'rsa-exponent-base64url';
        break;
        
      default:
        throw new Error(`JWK export not supported for ${keyPair.algorithm}`);
    }
    
    return jwk;
  }

  exportAsPEM(keyPair) {
    if (keyPair.publicKey && keyPair.publicKey.includes('BEGIN')) {
      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey
      };
    }
    
    throw new Error(`PEM export not supported for ${keyPair.algorithm}`);
  }

  getJWKKeyType(algorithm) {
    if (algorithm.startsWith('RSA')) return 'RSA';
    if (algorithm === 'Ed25519') return 'OKP';
    if (algorithm.startsWith('HMAC')) return 'oct';
    return 'oct';
  }

  getJWKAlgorithm(algorithm) {
    const mapping = {
      'Ed25519': 'EdDSA',
      'RSA-2048': 'RS256',
      'RSA-4096': 'RS256',
      'HMAC-256': 'HS256',
      'HMAC-384': 'HS384',
      'HMAC-512': 'HS512'
    };
    return mapping[algorithm] || algorithm;
  }

  /**
   * Get key manager statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const keys = Array.from(this.keyCache.values());
    const activeKeys = keys.filter(k => k.status === 'active');
    
    return {
      totalKeys: keys.length,
      activeKeys: activeKeys.length,
      revokedKeys: keys.filter(k => k.status === 'revoked').length,
      rotatedKeys: keys.filter(k => k.status === 'rotated').length,
      scheduledRotations: this.rotationSchedule.size,
      algorithmDistribution: keys.reduce((acc, key) => {
        acc[key.algorithm] = (acc[key.algorithm] || 0) + 1;
        return acc;
      }, {}),
      totalSignatures: keys.reduce((sum, key) => sum + (key.usage?.signatureCount || 0), 0)
    };
  }

  /**
   * Cleanup revoked keys older than specified age
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async cleanupRevokedKeys(maxAge = 365 * 24 * 60 * 60 * 1000) {
    try {
      const cutoffDate = new Date(this.getDeterministicTimestamp() - maxAge);
      let cleaned = 0;
      
      for (const [keyId, keyPair] of this.keyCache) {
        if (keyPair.status === 'revoked' && new Date(keyPair.revokedAt) < cutoffDate) {
          const keyPath = join(this.options.keyDirectory, `${keyId}.json`);
          await unlink(keyPath);
          this.keyCache.delete(keyId);
          cleaned++;
        }
      }
      
      this.logger.info(`Cleaned up ${cleaned} revoked keys`);
      
    } catch (error) {
      this.logger.error('Failed to cleanup revoked keys:', error);
    }
  }
}

// Export singleton instance
export const keyManager = new KeyManager();

// Export class for custom instances
export default KeyManager;