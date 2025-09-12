/**
 * Key Management Utilities for JOSE/JWS Attestation System
 * 
 * Provides comprehensive key management including:
 * - Secure key generation and storage
 * - Key rotation and lifecycle management
 * - Multiple algorithm support (Ed25519, RSA-2048, RSA-4096)
 * - Import/export functionality
 * - Key backup and recovery
 */

import { 
  generateKeyPair as joseGenerateKeyPair,
  exportJWK,
  importJWK,
  exportSPKI,
  exportPKCS8,
  importSPKI,
  importPKCS8
} from 'jose';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class KeyManagementUtilities {
  constructor(config = {}) {
    this.config = {
      keyStorePath: config.keyStorePath || './keys',
      backupPath: config.backupPath || './keys/backup',
      
      // Key generation defaults
      defaultRSASize: config.defaultRSASize || 2048,
      supportedAlgorithms: config.supportedAlgorithms || [
        'Ed25519',    // EdDSA
        'RS256',      // RSA-SHA256
        'RS384',      // RSA-SHA384  
        'RS512'       // RSA-SHA512
      ],
      
      // Security settings
      keyEncryption: config.keyEncryption !== false,
      encryptionPassword: config.encryptionPassword || process.env.KGEN_KEY_PASSWORD,
      
      // Lifecycle management
      keyExpirationDays: config.keyExpirationDays || 365,
      rotationWarningDays: config.rotationWarningDays || 30,
      
      // Permissions
      keyFilePermissions: config.keyFilePermissions || 0o600,
      backupPermissions: config.backupPermissions || 0o600,
      
      ...config
    };
    
    this.logger = consola.withTag('key-management');
    this.initialized = false;
  }

  /**
   * Initialize key management system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Ensure directories exist
      await fs.mkdir(this.config.keyStorePath, { recursive: true });
      await fs.mkdir(this.config.backupPath, { recursive: true });
      
      this.initialized = true;
      this.logger.success('Key management system initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize key management:', error);
      throw error;
    }
  }

  /**
   * Generate a key pair for the specified algorithm
   * @param {Object} options - Key generation options
   * @returns {Promise<Object>} Generated key with metadata
   */
  async generateKey(options = {}) {
    await this.initialize();
    
    const {
      algorithm = 'Ed25519',
      keyId = null,
      purpose = 'signing',
      rsaSize = this.config.defaultRSASize,
      metadata = {}
    } = options;
    
    try {
      const actualKeyId = keyId || this._generateKeyId(algorithm, purpose);
      
      this.logger.info(`Generating ${algorithm} key: ${actualKeyId}`);
      
      let keyPair;
      let keySpec;
      
      // Generate key pair based on algorithm
      switch (algorithm) {
        case 'Ed25519':
          keyPair = await joseGenerateKeyPair('Ed25519');
          keySpec = {
            algorithm: 'EdDSA',
            curve: 'Ed25519',
            keySize: 256
          };
          break;
          
        case 'RS256':
          keyPair = await joseGenerateKeyPair('RS256', { modulusLength: rsaSize });
          keySpec = {
            algorithm: 'RS256',
            keySize: rsaSize,
            hashAlgorithm: 'SHA-256'
          };
          break;
          
        case 'RS384':
          keyPair = await joseGenerateKeyPair('RS384', { modulusLength: rsaSize });
          keySpec = {
            algorithm: 'RS384',
            keySize: rsaSize,
            hashAlgorithm: 'SHA-384'
          };
          break;
          
        case 'RS512':
          keyPair = await joseGenerateKeyPair('RS512', { modulusLength: rsaSize });
          keySpec = {
            algorithm: 'RS512',
            keySize: rsaSize,
            hashAlgorithm: 'SHA-512'
          };
          break;
          
        default:
          throw new Error(`Unsupported algorithm: ${algorithm}`);
      }
      
      // Export to various formats
      const publicJWK = await exportJWK(keyPair.publicKey);
      const privateJWK = await exportJWK(keyPair.privateKey);
      const publicSPKI = await exportSPKI(keyPair.publicKey);
      const privatePKCS8 = await exportPKCS8(keyPair.privateKey);
      
      // Add JWK metadata
      publicJWK.kid = actualKeyId;
      publicJWK.use = purpose;
      publicJWK.alg = keySpec.algorithm;
      
      privateJWK.kid = actualKeyId;
      privateJWK.use = purpose;
      privateJWK.alg = keySpec.algorithm;
      
      // Calculate fingerprints
      const publicFingerprint = this._calculateJWKFingerprint(publicJWK);
      const keyHash = crypto.createHash('sha256')
        .update(publicSPKI)
        .digest('hex')
        .substring(0, 16);
      
      // Create key metadata
      const keyData = {
        keyId: actualKeyId,
        algorithm,
        purpose,
        ...keySpec,
        
        // Timestamps
        generated: this.getDeterministicDate().toISOString(),
        expires: new Date(this.getDeterministicTimestamp() + (this.config.keyExpirationDays * 24 * 60 * 60 * 1000)).toISOString(),
        
        // Status
        status: 'active',
        version: 1,
        
        // Fingerprints and identifiers
        fingerprint: publicFingerprint,
        keyHash,
        
        // Key material in various formats
        formats: {
          jwk: {
            public: publicJWK,
            private: privateJWK
          },
          pem: {
            public: publicSPKI,
            private: privatePKCS8
          }
        },
        
        // Runtime objects (not serialized)
        keyPair,
        
        // User metadata
        metadata: {
          ...metadata,
          generator: 'kgen-key-management-utilities',
          generatorVersion: '1.0.0'
        }
      };
      
      // Save key to disk
      await this._saveKeyToDisk(keyData);
      
      this.logger.success(`Generated ${algorithm} key: ${actualKeyId} (${keySpec.keySize}-bit)`);
      
      return keyData;
      
    } catch (error) {
      this.logger.error(`Failed to generate ${algorithm} key:`, error);
      throw error;
    }
  }

  /**
   * Load a key from storage
   * @param {string} keyId - Key identifier
   * @returns {Promise<Object>} Loaded key data
   */
  async loadKey(keyId) {
    await this.initialize();
    
    try {
      const keyPath = path.join(this.config.keyStorePath, `${keyId}.json`);
      const keyData = JSON.parse(await fs.readFile(keyPath, 'utf8'));
      
      // Reconstruct key pair from JWK
      keyData.keyPair = {
        privateKey: await importJWK(keyData.formats.jwk.private, keyData.algorithm),
        publicKey: await importJWK(keyData.formats.jwk.public, keyData.algorithm)
      };
      
      this.logger.debug(`Loaded key: ${keyId}`);
      
      return keyData;
      
    } catch (error) {
      this.logger.error(`Failed to load key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * List all keys with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} List of key metadata
   */
  async listKeys(filters = {}) {
    await this.initialize();
    
    try {
      const keyFiles = await fs.readdir(this.config.keyStorePath);
      const jsonFiles = keyFiles.filter(f => f.endsWith('.json'));
      
      const keys = [];
      
      for (const filename of jsonFiles) {
        try {
          const keyData = JSON.parse(
            await fs.readFile(path.join(this.config.keyStorePath, filename), 'utf8')
          );
          
          // Apply filters
          if (filters.status && keyData.status !== filters.status) continue;
          if (filters.algorithm && keyData.algorithm !== filters.algorithm) continue;
          if (filters.purpose && keyData.purpose !== filters.purpose) continue;
          
          // Add expiration warning
          const expiresAt = new Date(keyData.expires);
          const warningDate = new Date(this.getDeterministicTimestamp() + (this.config.rotationWarningDays * 24 * 60 * 60 * 1000));
          keyData.needsRotation = expiresAt <= warningDate;
          keyData.expired = expiresAt <= this.getDeterministicDate();
          
          keys.push(keyData);
          
        } catch (error) {
          this.logger.warn(`Failed to read key file ${filename}:`, error);
        }
      }
      
      // Sort by generation date (newest first)
      keys.sort((a, b) => new Date(b.generated) - new Date(a.generated));
      
      return keys;
      
    } catch (error) {
      this.logger.error('Failed to list keys:', error);
      throw error;
    }
  }

  /**
   * Rotate a key (generate new version and mark old as rotated)
   * @param {string} keyId - Key to rotate
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} New key data
   */
  async rotateKey(keyId, options = {}) {
    await this.initialize();
    
    try {
      // Load existing key
      const oldKey = await this.loadKey(keyId);
      
      this.logger.info(`Rotating key: ${keyId}`);
      
      // Backup old key
      if (options.backup !== false) {
        await this._backupKey(oldKey);
      }
      
      // Generate new key with same parameters
      const newKey = await this.generateKey({
        algorithm: oldKey.algorithm,
        keyId: options.newKeyId || this._generateKeyId(oldKey.algorithm, oldKey.purpose),
        purpose: oldKey.purpose,
        rsaSize: oldKey.keySize,
        metadata: {
          ...oldKey.metadata,
          rotatedFrom: keyId,
          rotationReason: options.reason || 'scheduled-rotation'
        }
      });
      
      // Mark old key as rotated
      oldKey.status = 'rotated';
      oldKey.rotatedAt = this.getDeterministicDate().toISOString();
      oldKey.rotatedTo = newKey.keyId;
      oldKey.keyPair = undefined; // Remove runtime objects
      
      await this._saveKeyToDisk(oldKey);
      
      this.logger.success(`Rotated key ${keyId} -> ${newKey.keyId}`);
      
      return newKey;
      
    } catch (error) {
      this.logger.error(`Failed to rotate key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Import a key from external source
   * @param {Object} keyMaterial - Key material to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Imported key data
   */
  async importKey(keyMaterial, options = {}) {
    await this.initialize();
    
    try {
      const { format, keyId, algorithm, purpose = 'signing' } = options;
      const actualKeyId = keyId || this._generateKeyId(algorithm, purpose);
      
      this.logger.info(`Importing ${format} key: ${actualKeyId}`);
      
      let keyPair;
      let keySpec;
      
      switch (format) {
        case 'jwk':
          keyPair = {
            privateKey: await importJWK(keyMaterial.private, algorithm),
            publicKey: await importJWK(keyMaterial.public, algorithm)
          };
          break;
          
        case 'pem':
          keyPair = {
            privateKey: await importPKCS8(keyMaterial.private, algorithm),
            publicKey: await importSPKI(keyMaterial.public, algorithm)
          };
          break;
          
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
      
      // Export to all supported formats
      const publicJWK = await exportJWK(keyPair.publicKey);
      const privateJWK = await exportJWK(keyPair.privateKey);
      const publicSPKI = await exportSPKI(keyPair.publicKey);
      const privatePKCS8 = await exportPKCS8(keyPair.privateKey);
      
      // Create key metadata
      const keyData = {
        keyId: actualKeyId,
        algorithm,
        purpose,
        
        // Import metadata
        imported: this.getDeterministicDate().toISOString(),
        importFormat: format,
        expires: new Date(this.getDeterministicTimestamp() + (this.config.keyExpirationDays * 24 * 60 * 60 * 1000)).toISOString(),
        
        status: 'active',
        version: 1,
        
        fingerprint: this._calculateJWKFingerprint(publicJWK),
        
        formats: {
          jwk: { public: publicJWK, private: privateJWK },
          pem: { public: publicSPKI, private: privatePKCS8 }
        },
        
        keyPair,
        
        metadata: options.metadata || {}
      };
      
      await this._saveKeyToDisk(keyData);
      
      this.logger.success(`Imported key: ${actualKeyId}`);
      
      return keyData;
      
    } catch (error) {
      this.logger.error('Failed to import key:', error);
      throw error;
    }
  }

  /**
   * Export a key in the specified format
   * @param {string} keyId - Key to export
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported key material
   */
  async exportKey(keyId, options = {}) {
    const { format = 'jwk', includePrivate = false } = options;
    
    try {
      const keyData = await this.loadKey(keyId);
      
      switch (format) {
        case 'jwk':
          return {
            public: keyData.formats.jwk.public,
            ...(includePrivate ? { private: keyData.formats.jwk.private } : {})
          };
          
        case 'pem':
          return {
            public: keyData.formats.pem.public,
            ...(includePrivate ? { private: keyData.formats.pem.private } : {})
          };
          
        case 'jwks':
          return {
            keys: [keyData.formats.jwk.public]
          };
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to export key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key (with optional backup)
   * @param {string} keyId - Key to delete
   * @param {Object} options - Delete options
   */
  async deleteKey(keyId, options = {}) {
    await this.initialize();
    
    try {
      // Backup before deletion if requested
      if (options.backup !== false) {
        const keyData = await this.loadKey(keyId);
        await this._backupKey(keyData, 'deleted');
      }
      
      // Delete key file
      const keyPath = path.join(this.config.keyStorePath, `${keyId}.json`);
      await fs.unlink(keyPath);
      
      this.logger.success(`Deleted key: ${keyId}`);
      
    } catch (error) {
      this.logger.error(`Failed to delete key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Generate JWKS (JSON Web Key Set) for all active keys
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} JWKS document
   */
  async generateJWKS(filters = {}) {
    const keys = await this.listKeys({ status: 'active', ...filters });
    
    return {
      keys: keys.map(keyData => keyData.formats.jwk.public)
    };
  }

  /**
   * Check key health and recommend actions
   * @returns {Promise<Object>} Health report
   */
  async checkKeyHealth() {
    const keys = await this.listKeys();
    
    const report = {
      total: keys.length,
      active: keys.filter(k => k.status === 'active').length,
      expired: keys.filter(k => k.expired).length,
      needsRotation: keys.filter(k => k.needsRotation).length,
      recommendations: []
    };
    
    // Generate recommendations
    if (report.expired > 0) {
      report.recommendations.push(`${report.expired} keys have expired and should be rotated immediately`);
    }
    
    if (report.needsRotation > 0) {
      report.recommendations.push(`${report.needsRotation} keys need rotation within ${this.config.rotationWarningDays} days`);
    }
    
    // Check algorithm diversity
    const algorithms = [...new Set(keys.filter(k => k.status === 'active').map(k => k.algorithm))];
    if (algorithms.length < 2) {
      report.recommendations.push('Consider using multiple signature algorithms for better security');
    }
    
    return report;
  }

  // Private methods

  async _saveKeyToDisk(keyData) {
    const filename = `${keyData.keyId}.json`;
    const filePath = path.join(this.config.keyStorePath, filename);
    
    // Create serializable version (remove runtime objects)
    const serializable = {
      ...keyData,
      keyPair: undefined
    };
    
    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
    await fs.chmod(filePath, this.config.keyFilePermissions);
  }

  async _backupKey(keyData, reason = 'rotation') {
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${keyData.keyId}-${reason}-${timestamp}.json`;
    const backupPath = path.join(this.config.backupPath, backupFilename);
    
    const backupData = {
      ...keyData,
      keyPair: undefined,
      backup: {
        reason,
        timestamp,
        originalStatus: keyData.status
      }
    };
    
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    await fs.chmod(backupPath, this.config.backupPermissions);
    
    this.logger.debug(`Backed up key ${keyData.keyId} to ${backupFilename}`);
  }

  _generateKeyId(algorithm, purpose) {
    const timestamp = this.getDeterministicTimestamp();
    const random = crypto.randomBytes(4).toString('hex');
    return `${algorithm.toLowerCase()}-${purpose}-${timestamp}-${random}`;
  }

  _calculateJWKFingerprint(jwk) {
    // Create canonical representation for fingerprint
    const canonical = {
      kty: jwk.kty,
      ...(jwk.crv && { crv: jwk.crv }),
      ...(jwk.x && { x: jwk.x }),
      ...(jwk.y && { y: jwk.y }),
      ...(jwk.n && { n: jwk.n }),
      ...(jwk.e && { e: jwk.e })
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex')
      .substring(0, 16);
  }
}

export const keyManagementUtilities = new KeyManagementUtilities();
export default KeyManagementUtilities;