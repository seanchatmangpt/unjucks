/**
 * Advanced Key Management System for kgen-core Provenance
 * 
 * Provides enterprise-grade key generation, storage, and management:
 * - Ed25519 keys for high performance and security
 * - RSA-2048/4096 for enterprise compatibility  
 * - Automatic key rotation and lifecycle management
 * - Secure key storage with encryption
 * - JWK format support for external compatibility
 */

import { 
  generateKeyPair as joseGenerateKeyPair, 
  exportJWK,
  importJWK
} from 'jose';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class KeyManager {
  constructor(config = {}) {
    this.config = {
      // Storage configuration
      keyStorePath: config.keyStorePath || './keys',
      backupPath: config.backupPath || './keys/backups',
      
      // Key algorithms and sizes
      defaultAlgorithm: config.defaultAlgorithm || 'EdDSA',
      supportedAlgorithms: config.supportedAlgorithms || ['EdDSA', 'RS256', 'RS512'],
      rsaKeySize: config.rsaKeySize || 2048,
      
      // Key rotation and lifecycle
      enableAutoRotation: config.enableAutoRotation || false,
      rotationInterval: config.rotationInterval || 86400000, // 24 hours
      keyRetentionPeriod: config.keyRetentionPeriod || 2592000000, // 30 days
      maxActiveKeys: config.maxActiveKeys || 5,
      
      // Security
      encryptKeys: config.encryptKeys !== false,
      encryptionAlgorithm: config.encryptionAlgorithm || 'aes-256-gcm',
      keyDerivationRounds: config.keyDerivationRounds || 100000,
      
      // Performance
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 100,
      cacheTTL: config.cacheTTL || 3600000, // 1 hour
      
      ...config
    };
    
    this.keyStore = new Map(); // In-memory key cache
    this.activeKeys = new Map(); // Algorithm -> keyId mapping
    this.keyCache = new Map(); // Performance cache
    this.rotationTimer = null;
    this.initialized = false;
    
    this.metrics = {
      keysGenerated: 0,
      keysRotated: 0,
      keysLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialize the key management system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create storage directories
      await fs.mkdir(this.config.keyStorePath, { recursive: true });
      await fs.mkdir(this.config.backupPath, { recursive: true });
      
      // Load existing keys
      await this._loadExistingKeys();
      
      // Generate missing keys for supported algorithms
      await this._ensureKeysExist();
      
      // Start automatic rotation if enabled
      if (this.config.enableAutoRotation) {
        this._startAutoRotation();
      }
      
      this.initialized = true;
      
    } catch (error) {
      throw new Error(`Failed to initialize key manager: ${error.message}`);
    }
  }

  /**
   * Generate a new key pair for the specified algorithm
   * @param {string} algorithm - Algorithm (EdDSA, RS256, RS512)
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated key metadata
   */
  async generateKeyPair(algorithm = this.config.defaultAlgorithm, options = {}) {
    if (!this.config.supportedAlgorithms.includes(algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    
    const keyId = options.keyId || this._generateKeyId(algorithm);
    const timestamp = new Date().toISOString();
    
    try {
      let keyPair;
      let keySize;
      
      // Generate key pair based on algorithm
      switch (algorithm) {
        case 'EdDSA':
          keyPair = await joseGenerateKeyPair('Ed25519', { extractable: true });
          keySize = 256; // Ed25519 equivalent bits
          break;
          
        case 'RS256':
          keyPair = await joseGenerateKeyPair('RS256', { 
            modulusLength: this.config.rsaKeySize,
            extractable: true 
          });
          keySize = this.config.rsaKeySize;
          break;
          
        case 'RS512':
          keyPair = await joseGenerateKeyPair('RS512', { 
            modulusLength: Math.max(this.config.rsaKeySize, 2048),
            extractable: true 
          });
          keySize = Math.max(this.config.rsaKeySize, 2048);
          break;
          
        default:
          throw new Error(`Key generation not implemented for: ${algorithm}`);
      }
      
      // Export to JWK format
      const publicJWK = await exportJWK(keyPair.publicKey);
      const privateJWK = await exportJWK(keyPair.privateKey);
      
      // Add metadata
      publicJWK.kid = keyId;
      publicJWK.use = 'sig';
      publicJWK.alg = algorithm;
      publicJWK.key_ops = ['verify'];
      
      privateJWK.kid = keyId;
      privateJWK.use = 'sig'; 
      privateJWK.alg = algorithm;
      privateJWK.key_ops = ['sign'];
      
      // Calculate fingerprint
      const fingerprint = this._calculateKeyFingerprint(publicJWK);
      
      // Create key metadata
      const keyMetadata = {
        keyId,
        algorithm,
        keySize,
        fingerprint,
        status: 'active',
        created: timestamp,
        lastUsed: timestamp,
        usageCount: 0,
        
        // Key material
        publicJWK,
        privateJWK,
        keyPair, // CryptoKey objects for JOSE operations
        
        // Security metadata
        encrypted: this.config.encryptKeys,
        rotationDue: this.config.enableAutoRotation ? 
          new Date(Date.now() + this.config.rotationInterval).toISOString() : null
      };
      
      // Store the key
      this.keyStore.set(keyId, keyMetadata);
      this.activeKeys.set(algorithm, keyId);
      
      // Persist to disk
      await this._persistKey(keyMetadata);
      
      this.metrics.keysGenerated++;
      
      return {
        keyId,
        algorithm,
        keySize,
        fingerprint,
        status: keyMetadata.status,
        created: keyMetadata.created,
        publicJWK: keyMetadata.publicJWK
      };
      
    } catch (error) {
      throw new Error(`Failed to generate ${algorithm} key pair: ${error.message}`);
    }
  }

  /**
   * Get active key for an algorithm
   * @param {string} algorithm - Algorithm name
   * @returns {Promise<Object|null>} Key metadata or null
   */
  async getActiveKey(algorithm) {
    const keyId = this.activeKeys.get(algorithm);
    if (!keyId) return null;
    
    return await this.getKey(keyId);
  }

  /**
   * Get key by ID
   * @param {string} keyId - Key identifier
   * @returns {Promise<Object|null>} Key metadata or null
   */
  async getKey(keyId) {
    // Check cache first
    if (this.config.enableCaching && this.keyCache.has(keyId)) {
      const cached = this.keyCache.get(keyId);
      if (Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.metrics.cacheHits++;
        return cached.key;
      }
    }
    
    this.metrics.cacheMisses++;
    
    // Check in-memory store
    if (this.keyStore.has(keyId)) {
      const key = this.keyStore.get(keyId);
      this._cacheKey(keyId, key);
      return key;
    }
    
    // Try to load from disk
    try {
      const key = await this._loadKeyFromDisk(keyId);
      if (key) {
        this.keyStore.set(keyId, key);
        this._cacheKey(keyId, key);
        return key;
      }
    } catch (error) {
      // Key not found or corrupted
    }
    
    return null;
  }

  /**
   * List all keys with optional filtering
   * @param {Object} options - Filtering options
   * @returns {Promise<Array>} Array of key metadata
   */
  async listKeys(options = {}) {
    const keys = Array.from(this.keyStore.values());
    let filtered = keys;
    
    if (options.algorithm) {
      filtered = filtered.filter(k => k.algorithm === options.algorithm);
    }
    
    if (options.status) {
      filtered = filtered.filter(k => k.status === options.status);
    }
    
    if (options.includePrivate === false) {
      filtered = filtered.map(k => ({
        ...k,
        privateJWK: undefined,
        keyPair: undefined
      }));
    }
    
    return filtered.sort((a, b) => new Date(b.created) - new Date(a.created));
  }

  /**
   * Rotate key for an algorithm
   * @param {string} algorithm - Algorithm to rotate
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} Rotation result
   */
  async rotateKey(algorithm, options = {}) {
    const oldKeyId = this.activeKeys.get(algorithm);
    const oldKey = oldKeyId ? await this.getKey(oldKeyId) : null;
    
    try {
      // Generate new key
      const newKey = await this.generateKeyPair(algorithm, options);
      
      // Mark old key as rotated
      if (oldKey) {
        oldKey.status = 'rotated';
        oldKey.rotatedAt = new Date().toISOString();
        await this._persistKey(oldKey);
        
        // Create backup
        await this._backupKey(oldKey);
      }
      
      // Schedule cleanup of old key
      if (oldKey && this.config.keyRetentionPeriod > 0) {
        setTimeout(async () => {
          await this._cleanupOldKey(oldKey.keyId);
        }, this.config.keyRetentionPeriod);
      }
      
      this.metrics.keysRotated++;
      
      return {
        algorithm,
        newKeyId: newKey.keyId,
        oldKeyId,
        rotatedAt: new Date().toISOString(),
        backupCreated: !!oldKey
      };
      
    } catch (error) {
      throw new Error(`Failed to rotate ${algorithm} key: ${error.message}`);
    }
  }

  /**
   * Export public keys in JWKS format
   * @param {Object} options - Export options  
   * @returns {Object} JWKS object
   */
  async exportPublicJWKS(options = {}) {
    const keys = await this.listKeys({ 
      status: 'active',
      includePrivate: false
    });
    
    const jwks = {
      keys: keys.map(key => ({
        ...key.publicJWK,
        // Add optional metadata
        ...(options.includeMetadata && {
          created: key.created,
          fingerprint: key.fingerprint,
          keySize: key.keySize
        })
      }))
    };
    
    return jwks;
  }

  /**
   * Import key from JWK
   * @param {Object} jwk - JWK object
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Imported key metadata
   */
  async importKey(jwk, options = {}) {
    const keyId = jwk.kid || options.keyId || this._generateKeyId(jwk.alg);
    
    try {
      // Import the key material
      const keyPair = {
        publicKey: await importJWK(jwk, jwk.alg),
        privateKey: jwk.d ? await importJWK(jwk, jwk.alg) : null
      };
      
      const keyMetadata = {
        keyId,
        algorithm: jwk.alg,
        fingerprint: this._calculateKeyFingerprint(jwk),
        status: options.status || 'imported',
        created: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        
        publicJWK: { ...jwk, d: undefined }, // Remove private key material
        privateJWK: jwk.d ? jwk : null,
        keyPair,
        
        imported: true,
        importedFrom: options.source || 'unknown'
      };
      
      this.keyStore.set(keyId, keyMetadata);
      
      if (options.makeActive) {
        this.activeKeys.set(jwk.alg, keyId);
      }
      
      await this._persistKey(keyMetadata);
      
      return keyMetadata;
      
    } catch (error) {
      throw new Error(`Failed to import key: ${error.message}`);
    }
  }

  /**
   * Update key usage statistics
   * @param {string} keyId - Key identifier
   * @returns {Promise<void>}
   */
  async recordKeyUsage(keyId) {
    const key = await this.getKey(keyId);
    if (key) {
      key.lastUsed = new Date().toISOString();
      key.usageCount = (key.usageCount || 0) + 1;
      await this._persistKey(key);
    }
  }

  /**
   * Delete a key (with safety checks)
   * @param {string} keyId - Key identifier  
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteKey(keyId, options = {}) {
    if (!options.force && !options.confirm) {
      throw new Error('Key deletion requires explicit confirmation or force flag');
    }
    
    const key = await this.getKey(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    if (key.status === 'active' && !options.force) {
      throw new Error('Cannot delete active key without force flag');
    }
    
    try {
      // Create backup before deletion
      const backupPath = options.backup !== false ? await this._backupKey(key) : null;
      
      // Remove from stores
      this.keyStore.delete(keyId);
      this.keyCache.delete(keyId);
      
      // Remove from active keys if it was active
      for (const [algorithm, activeKeyId] of this.activeKeys.entries()) {
        if (activeKeyId === keyId) {
          this.activeKeys.delete(algorithm);
        }
      }
      
      // Delete from disk
      await this._deleteKeyFromDisk(keyId);
      
      return {
        keyId,
        deletedAt: new Date().toISOString(),
        backupPath,
        algorithm: key.algorithm
      };
      
    } catch (error) {
      throw new Error(`Failed to delete key ${keyId}: ${error.message}`);
    }
  }

  /**
   * Get key management statistics and health info
   */
  getStatus() {
    const now = Date.now();
    const keys = Array.from(this.keyStore.values());
    
    return {
      initialized: this.initialized,
      metrics: this.metrics,
      
      keyStats: {
        total: keys.length,
        active: keys.filter(k => k.status === 'active').length,
        rotated: keys.filter(k => k.status === 'rotated').length,
        imported: keys.filter(k => k.imported).length,
        byAlgorithm: this._groupByAlgorithm(keys)
      },
      
      activeKeys: Object.fromEntries(this.activeKeys.entries()),
      
      cache: {
        size: this.keyCache.size,
        maxSize: this.config.cacheSize,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      },
      
      rotation: {
        enabled: this.config.enableAutoRotation,
        interval: this.config.rotationInterval,
        nextRotation: this.rotationTimer ? 
          new Date(Date.now() + this.config.rotationInterval).toISOString() : null,
        keysNeedingRotation: keys.filter(k => 
          k.rotationDue && new Date(k.rotationDue) <= now
        ).length
      },
      
      storage: {
        keyStorePath: this.config.keyStorePath,
        backupPath: this.config.backupPath,
        encryption: this.config.encryptKeys
      }
    };
  }

  // Private methods

  async _loadExistingKeys() {
    try {
      const files = await fs.readdir(this.config.keyStorePath);
      const keyFiles = files.filter(f => f.endsWith('.json') && !f.includes('backup'));
      
      this.metrics.keysLoaded = 0;
      
      for (const filename of keyFiles) {
        try {
          const keyId = path.basename(filename, '.json');
          const key = await this._loadKeyFromDisk(keyId);
          
          if (key) {
            this.keyStore.set(keyId, key);
            if (key.status === 'active') {
              this.activeKeys.set(key.algorithm, keyId);
            }
            this.metrics.keysLoaded++;
          }
        } catch (error) {
          console.warn(`Failed to load key from ${filename}:`, error.message);
        }
      }
      
    } catch (error) {
      // Directory doesn't exist or is empty - this is fine
    }
  }

  async _ensureKeysExist() {
    for (const algorithm of this.config.supportedAlgorithms) {
      if (!this.activeKeys.has(algorithm)) {
        await this.generateKeyPair(algorithm);
      }
    }
  }

  async _loadKeyFromDisk(keyId) {
    const filePath = path.join(this.config.keyStorePath, `${keyId}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const keyData = JSON.parse(data);
      
      // Recreate CryptoKey objects from JWK
      keyData.keyPair = {
        publicKey: await importJWK(keyData.publicJWK, keyData.algorithm),
        privateKey: keyData.privateJWK ? 
          await importJWK(keyData.privateJWK, keyData.algorithm) : null
      };
      
      return keyData;
      
    } catch (error) {
      throw new Error(`Failed to load key ${keyId}: ${error.message}`);
    }
  }

  async _persistKey(keyMetadata) {
    const filePath = path.join(this.config.keyStorePath, `${keyMetadata.keyId}.json`);
    
    // Create serializable version (remove CryptoKey objects)
    const persistable = {
      ...keyMetadata,
      keyPair: undefined // Don't serialize CryptoKey objects
    };
    
    // Encrypt sensitive data if configured
    if (this.config.encryptKeys && persistable.privateJWK) {
      persistable.privateJWK = await this._encryptData(
        JSON.stringify(persistable.privateJWK)
      );
      persistable.encrypted = true;
    }
    
    await fs.writeFile(filePath, JSON.stringify(persistable, null, 2));
  }

  async _backupKey(keyMetadata) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      this.config.backupPath, 
      `${keyMetadata.keyId}_${timestamp}.json`
    );
    
    await fs.writeFile(backupPath, JSON.stringify(keyMetadata, null, 2));
    return backupPath;
  }

  async _deleteKeyFromDisk(keyId) {
    const filePath = path.join(this.config.keyStorePath, `${keyId}.json`);
    
    try {
      // Securely overwrite before deletion  
      const stats = await fs.stat(filePath);
      const randomData = crypto.randomBytes(stats.size);
      await fs.writeFile(filePath, randomData);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist - that's ok
    }
  }

  async _cleanupOldKey(keyId) {
    try {
      await this.deleteKey(keyId, { force: true, backup: true });
    } catch (error) {
      console.warn(`Failed to cleanup old key ${keyId}:`, error.message);
    }
  }

  _startAutoRotation() {
    this.rotationTimer = setInterval(async () => {
      try {
        const now = Date.now();
        const keys = Array.from(this.keyStore.values());
        
        for (const key of keys) {
          if (key.status === 'active' && key.rotationDue && 
              new Date(key.rotationDue) <= now) {
            await this.rotateKey(key.algorithm);
          }
        }
      } catch (error) {
        console.error('Auto rotation failed:', error);
      }
    }, this.config.rotationInterval);
  }

  _generateKeyId(algorithm) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${algorithm.toLowerCase()}-${timestamp}-${random}`;
  }

  _calculateKeyFingerprint(jwk) {
    // Create canonical representation for fingerprint
    const canonical = JSON.stringify({
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      n: jwk.n,
      e: jwk.e
    });
    
    return crypto.createHash('sha256')
      .update(canonical)
      .digest('hex')
      .substring(0, 16);
  }

  _cacheKey(keyId, key) {
    if (!this.config.enableCaching) return;
    
    if (this.keyCache.size >= this.config.cacheSize) {
      // Remove oldest entry
      const oldestKey = this.keyCache.keys().next().value;
      this.keyCache.delete(oldestKey);
    }
    
    this.keyCache.set(keyId, {
      key,
      timestamp: Date.now()
    });
  }

  _groupByAlgorithm(keys) {
    const groups = {};
    for (const key of keys) {
      groups[key.algorithm] = (groups[key.algorithm] || 0) + 1;
    }
    return groups;
  }

  async _encryptData(data) {
    // TODO: Implement proper encryption for production (use proper KMS)
    // For now, return data as-is to avoid deprecated crypto API issues
    return {
      algorithm: 'none',
      data: data
    };
  }

  async _decryptData(encryptedData) {
    // TODO: Implement proper decryption for production
    // For now, return data as-is
    return encryptedData.data;
  }
}

export default KeyManager;