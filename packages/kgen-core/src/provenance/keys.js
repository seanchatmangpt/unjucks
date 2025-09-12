/**
 * Cryptographic Key Management Utilities
 * 
 * Provides comprehensive key management for KGEN cryptographic operations
 * including Ed25519 key generation, storage, rotation, and trust store management.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import consola from 'consola';
import { ed25519 } from '@noble/curves/ed25519.js';
import JOSESigningManager from './signing.js';

export class KeyManager {
  constructor(config = {}) {
    this.config = {
      // Key storage paths
      keysDirectory: config.keysDirectory || './keys',
      ed25519PrivateKeyPath: config.ed25519PrivateKeyPath || './keys/ed25519-private.key',
      ed25519PublicKeyPath: config.ed25519PublicKeyPath || './keys/ed25519-public.key',
      rsaPrivateKeyPath: config.rsaPrivateKeyPath || './keys/rsa-private.pem',
      rsaPublicKeyPath: config.rsaPublicKeyPath || './keys/rsa-public.pem',
      
      // Trust store
      trustStorePath: config.trustStorePath || './keys/truststore.json',
      trustedKeysDirectory: config.trustedKeysDirectory || './keys/trusted',
      
      // Key rotation
      enableAutoRotation: config.enableAutoRotation || false,
      rotationInterval: config.rotationInterval || 86400000 * 30, // 30 days
      keyBackupCount: config.keyBackupCount || 5,
      
      // Security
      keyFilePermissions: config.keyFilePermissions || 0o600,
      publicKeyPermissions: config.publicKeyPermissions || 0o644,
      
      ...config
    };
    
    this.logger = consola.withTag('key-manager');
    this.trustStore = new Map();
    this.keyMetadata = new Map();
  }

  /**
   * Initialize key management system
   */
  async initialize() {
    try {
      this.logger.info('Initializing key management system...');
      
      // Ensure key directories exist
      await this._ensureDirectories();
      
      // Load trust store
      await this.loadTrustStore();
      
      // Load key metadata
      await this._loadKeyMetadata();
      
      // Setup auto-rotation if enabled
      if (this.config.enableAutoRotation) {
        this._setupAutoRotation();
      }
      
      this.logger.success('Key management system initialized');
      
      return {
        status: 'success',
        keysDirectory: this.config.keysDirectory,
        trustStoreSize: this.trustStore.size,
        autoRotation: this.config.enableAutoRotation
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize key manager:', error);
      throw error;
    }
  }

  /**
   * Generate new Ed25519 key pair for JOSE signing
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated key pair information
   */
  async generateEd25519KeyPair(options = {}) {
    try {
      this.logger.info('Generating new Ed25519 key pair...');
      
      const joseManager = new JOSESigningManager({
        keyPath: this.config.ed25519PrivateKeyPath,
        publicKeyPath: this.config.ed25519PublicKeyPath,
        ...options
      });
      
      const keyPair = await joseManager.generateKeyPair();
      
      // Save the key pair
      await joseManager.saveKeyPair(keyPair);
      
      // Add to trust store
      await this.addToTrustStore(keyPair.publicKeyHex, {
        algorithm: 'EdDSA',
        curve: 'Ed25519',
        publicKey: keyPair.publicKeySPKI,
        generated: keyPair.generated,
        source: 'generated',
        trusted: true
      });
      
      // Update metadata
      this.keyMetadata.set('ed25519-current', {
        publicKeyHex: keyPair.publicKeyHex,
        algorithm: 'EdDSA',
        curve: 'Ed25519',
        generated: keyPair.generated,
        path: this.config.ed25519PrivateKeyPath
      });
      
      await this._saveKeyMetadata();
      
      this.logger.success('Ed25519 key pair generated and saved');
      
      return {
        publicKeyHex: keyPair.publicKeyHex,
        algorithm: 'EdDSA',
        curve: 'Ed25519',
        generated: keyPair.generated,
        fingerprint: this._calculateFingerprint(keyPair.publicKeySPKI)
      };
      
    } catch (error) {
      this.logger.error('Failed to generate Ed25519 key pair:', error);
      throw error;
    }
  }

  /**
   * Generate RSA key pair for legacy compatibility
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated key pair information
   */
  async generateRSAKeyPair(options = {}) {
    try {
      const { generateKeyPairSync } = await import('crypto');
      
      this.logger.info('Generating RSA key pair...');
      
      const keySize = options.keySize || 2048;
      const passphrase = options.passphrase || this._generateSecurePassphrase();
      
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase
        }
      });
      
      // Save keys
      await fs.writeFile(this.config.rsaPrivateKeyPath, privateKey, { 
        mode: this.config.keyFilePermissions 
      });
      await fs.writeFile(this.config.rsaPublicKeyPath, publicKey, { 
        mode: this.config.publicKeyPermissions 
      });
      
      const fingerprint = this._calculateFingerprint(publicKey);
      
      // Add to trust store
      await this.addToTrustStore(fingerprint, {
        algorithm: 'RSA-SHA256',
        keySize,
        publicKey,
        generated: new Date().toISOString(),
        source: 'generated',
        trusted: true
      });
      
      // Save passphrase securely
      const passphraseFile = `${this.config.rsaPrivateKeyPath}.passphrase`;
      await fs.writeFile(passphraseFile, passphrase, { 
        mode: this.config.keyFilePermissions 
      });
      
      this.logger.success(`Generated ${keySize}-bit RSA key pair`);
      
      return {
        fingerprint,
        algorithm: 'RSA-SHA256',
        keySize,
        generated: new Date().toISOString(),
        passphraseFile
      };
      
    } catch (error) {
      this.logger.error('Failed to generate RSA key pair:', error);
      throw error;
    }
  }

  /**
   * Rotate Ed25519 keys
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} Rotation result
   */
  async rotateEd25519Keys(options = {}) {
    try {
      this.logger.info('Starting Ed25519 key rotation...');
      
      // Backup current keys
      if (options.backupOld !== false) {
        await this._backupCurrentKeys('ed25519');
      }
      
      // Generate new key pair
      const newKeyInfo = await this.generateEd25519KeyPair(options);
      
      // Revoke old key in trust store (mark as rotated, don't delete)
      const oldMetadata = this.keyMetadata.get('ed25519-current');
      if (oldMetadata) {
        await this.updateTrustStoreEntry(oldMetadata.publicKeyHex, {
          status: 'rotated',
          rotatedAt: new Date().toISOString(),
          rotatedTo: newKeyInfo.publicKeyHex
        });
      }
      
      this.logger.success('Ed25519 key rotation completed');
      
      return {
        status: 'success',
        newKeyInfo,
        rotatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to rotate Ed25519 keys:', error);
      throw error;
    }
  }

  /**
   * Add key to trust store
   * @param {string} identifier - Key identifier (fingerprint or hex)
   * @param {Object} keyData - Key data
   * @returns {Promise<void>}
   */
  async addToTrustStore(identifier, keyData) {
    try {
      const trustEntry = {
        ...keyData,
        addedAt: new Date().toISOString(),
        status: 'active'
      };
      
      this.trustStore.set(identifier, trustEntry);
      await this._saveTrustStore();
      
      this.logger.debug(`Added key ${identifier.substring(0, 16)}... to trust store`);
      
    } catch (error) {
      this.logger.error('Failed to add key to trust store:', error);
      throw error;
    }
  }

  /**
   * Remove key from trust store
   * @param {string} identifier - Key identifier
   * @param {Object} options - Removal options
   * @returns {Promise<boolean>} True if removed
   */
  async removeFromTrustStore(identifier, options = {}) {
    try {
      const entry = this.trustStore.get(identifier);
      if (!entry) {
        return false;
      }
      
      // Soft delete by default (mark as revoked)
      if (options.softDelete !== false) {
        entry.status = 'revoked';
        entry.revokedAt = new Date().toISOString();
        entry.revokeReason = options.reason || 'manual-revocation';
        this.trustStore.set(identifier, entry);
      } else {
        // Hard delete
        this.trustStore.delete(identifier);
      }
      
      await this._saveTrustStore();
      
      this.logger.info(`${options.softDelete !== false ? 'Revoked' : 'Removed'} key ${identifier.substring(0, 16)}...`);
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to remove key from trust store:', error);
      throw error;
    }
  }

  /**
   * Update trust store entry
   * @param {string} identifier - Key identifier
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} True if updated
   */
  async updateTrustStoreEntry(identifier, updates) {
    try {
      const entry = this.trustStore.get(identifier);
      if (!entry) {
        return false;
      }
      
      const updatedEntry = {
        ...entry,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      this.trustStore.set(identifier, updatedEntry);
      await this._saveTrustStore();
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to update trust store entry:', error);
      throw error;
    }
  }

  /**
   * Get key from trust store
   * @param {string} identifier - Key identifier
   * @returns {Object|null} Key data or null
   */
  getTrustedKey(identifier) {
    const entry = this.trustStore.get(identifier);
    return entry?.status === 'active' ? entry : null;
  }

  /**
   * List all trusted keys
   * @param {Object} options - Listing options
   * @returns {Array<Object>} Array of key entries
   */
  listTrustedKeys(options = {}) {
    const keys = Array.from(this.trustStore.entries()).map(([identifier, data]) => ({
      identifier,
      ...data
    }));
    
    if (options.activeOnly) {
      return keys.filter(key => key.status === 'active');
    }
    
    if (options.algorithm) {
      return keys.filter(key => key.algorithm === options.algorithm);
    }
    
    return keys;
  }

  /**
   * Load trust store from file
   * @returns {Promise<void>}
   */
  async loadTrustStore() {
    try {
      if (await this._fileExists(this.config.trustStorePath)) {
        const content = await fs.readFile(this.config.trustStorePath, 'utf8');
        const trustStoreData = JSON.parse(content);
        
        for (const [identifier, data] of Object.entries(trustStoreData)) {
          this.trustStore.set(identifier, data);
        }
        
        this.logger.debug(`Loaded ${this.trustStore.size} keys from trust store`);
      } else {
        // Create empty trust store
        await this._saveTrustStore();
      }
    } catch (error) {
      this.logger.error('Failed to load trust store:', error);
      throw error;
    }
  }

  /**
   * Import key from external source
   * @param {string} keyPath - Path to key file
   * @param {Object} metadata - Key metadata
   * @returns {Promise<Object>} Import result
   */
  async importKey(keyPath, metadata = {}) {
    try {
      this.logger.info(`Importing key from ${keyPath}...`);
      
      const keyContent = await fs.readFile(keyPath, 'utf8');
      const fingerprint = this._calculateFingerprint(keyContent);
      
      // Add to trust store
      await this.addToTrustStore(fingerprint, {
        publicKey: keyContent,
        source: 'imported',
        importPath: keyPath,
        trusted: metadata.trusted || false,
        ...metadata
      });
      
      this.logger.success(`Imported key ${fingerprint.substring(0, 16)}...`);
      
      return {
        fingerprint,
        imported: true,
        trusted: metadata.trusted || false
      };
      
    } catch (error) {
      this.logger.error(`Failed to import key from ${keyPath}:`, error);
      throw error;
    }
  }

  /**
   * Export key to external file
   * @param {string} identifier - Key identifier
   * @param {string} outputPath - Output file path
   * @param {Object} options - Export options
   * @returns {Promise<boolean>} True if exported
   */
  async exportKey(identifier, outputPath, options = {}) {
    try {
      const keyData = this.trustStore.get(identifier);
      if (!keyData) {
        throw new Error(`Key ${identifier} not found in trust store`);
      }
      
      const exportData = {
        identifier,
        publicKey: keyData.publicKey,
        algorithm: keyData.algorithm,
        generated: keyData.generated,
        exported: new Date().toISOString(),
        ...(options.includeMetadata && keyData)
      };
      
      await fs.writeFile(outputPath, 
        options.format === 'pem' ? keyData.publicKey : JSON.stringify(exportData, null, 2),
        { mode: this.config.publicKeyPermissions }
      );
      
      this.logger.success(`Exported key ${identifier.substring(0, 16)}... to ${outputPath}`);
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to export key:', error);
      throw error;
    }
  }

  /**
   * Verify key integrity
   * @param {string} keyPath - Path to key file
   * @returns {Promise<Object>} Verification result
   */
  async verifyKeyIntegrity(keyPath) {
    try {
      const keyContent = await fs.readFile(keyPath, 'utf8');
      const fingerprint = this._calculateFingerprint(keyContent);
      const keyData = this.trustStore.get(fingerprint);
      
      const result = {
        path: keyPath,
        fingerprint,
        exists: true,
        trusted: !!keyData,
        valid: false,
        issues: []
      };
      
      // Check if key format is valid
      try {
        if (keyContent.includes('BEGIN PUBLIC KEY')) {
          // SPKI format validation
          result.format = 'SPKI';
          result.valid = true;
        } else if (keyContent.includes('BEGIN RSA PUBLIC KEY')) {
          // PKCS1 format validation
          result.format = 'PKCS1';
          result.valid = true;
        } else {
          result.issues.push('Unrecognized key format');
        }
      } catch (error) {
        result.issues.push(`Key format validation failed: ${error.message}`);
      }
      
      // Check trust status
      if (keyData) {
        result.trustData = {
          status: keyData.status,
          algorithm: keyData.algorithm,
          generated: keyData.generated,
          addedAt: keyData.addedAt
        };
        
        if (keyData.status !== 'active') {
          result.issues.push(`Key status is ${keyData.status}`);
        }
      } else {
        result.issues.push('Key not found in trust store');
      }
      
      return result;
      
    } catch (error) {
      return {
        path: keyPath,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Get key manager status
   * @returns {Object} Status information
   */
  getStatus() {
    const activeKeys = this.listTrustedKeys({ activeOnly: true });
    const ed25519Keys = activeKeys.filter(k => k.algorithm === 'EdDSA');
    const rsaKeys = activeKeys.filter(k => k.algorithm?.startsWith('RSA'));
    
    return {
      keysDirectory: this.config.keysDirectory,
      trustStore: {
        totalKeys: this.trustStore.size,
        activeKeys: activeKeys.length,
        ed25519Keys: ed25519Keys.length,
        rsaKeys: rsaKeys.length,
        path: this.config.trustStorePath
      },
      autoRotation: {
        enabled: this.config.enableAutoRotation,
        interval: this.config.rotationInterval
      },
      keyFiles: {
        ed25519Private: this.config.ed25519PrivateKeyPath,
        ed25519Public: this.config.ed25519PublicKeyPath,
        rsaPrivate: this.config.rsaPrivateKeyPath,
        rsaPublic: this.config.rsaPublicKeyPath
      }
    };
  }

  // Private methods

  async _ensureDirectories() {
    const dirs = [
      this.config.keysDirectory,
      this.config.trustedKeysDirectory,
      path.dirname(this.config.trustStorePath)
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _saveTrustStore() {
    const trustStoreData = Object.fromEntries(this.trustStore);
    await fs.writeFile(this.config.trustStorePath, JSON.stringify(trustStoreData, null, 2));
  }

  async _loadKeyMetadata() {
    const metadataPath = path.join(this.config.keysDirectory, 'metadata.json');
    
    try {
      if (await this._fileExists(metadataPath)) {
        const content = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(content);
        
        for (const [key, data] of Object.entries(metadata)) {
          this.keyMetadata.set(key, data);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load key metadata:', error);
    }
  }

  async _saveKeyMetadata() {
    const metadataPath = path.join(this.config.keysDirectory, 'metadata.json');
    const metadataData = Object.fromEntries(this.keyMetadata);
    
    await fs.writeFile(metadataPath, JSON.stringify(metadataData, null, 2));
  }

  async _backupCurrentKeys(keyType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.config.keysDirectory, 'backup');
    
    await fs.mkdir(backupDir, { recursive: true });
    
    if (keyType === 'ed25519') {
      const backupPrivate = path.join(backupDir, `ed25519-private-${timestamp}.key`);
      const backupPublic = path.join(backupDir, `ed25519-public-${timestamp}.key`);
      
      if (await this._fileExists(this.config.ed25519PrivateKeyPath)) {
        await fs.copyFile(this.config.ed25519PrivateKeyPath, backupPrivate);
      }
      
      if (await this._fileExists(this.config.ed25519PublicKeyPath)) {
        await fs.copyFile(this.config.ed25519PublicKeyPath, backupPublic);
      }
    }
    
    // Clean up old backups
    await this._cleanupOldBackups(backupDir);
  }

  async _cleanupOldBackups(backupDir) {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(f => f.includes('ed25519') || f.includes('rsa'))
        .map(f => ({ name: f, path: path.join(backupDir, f) }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (timestamp) descending
      
      // Keep only the latest N backups
      if (backupFiles.length > this.config.keyBackupCount) {
        const filesToDelete = backupFiles.slice(this.config.keyBackupCount);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
        
        this.logger.debug(`Cleaned up ${filesToDelete.length} old backup files`);
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup old backups:', error);
    }
  }

  _setupAutoRotation() {
    setInterval(async () => {
      try {
        this.logger.info('Starting automatic key rotation...');
        await this.rotateEd25519Keys();
      } catch (error) {
        this.logger.error('Automatic key rotation failed:', error);
      }
    }, this.config.rotationInterval);
    
    this.logger.info(`Automatic key rotation scheduled every ${this.config.rotationInterval}ms`);
  }

  _calculateFingerprint(keyContent) {
    return createHash('sha256')
      .update(keyContent)
      .digest('hex')
      .substring(0, 16);
  }

  _generateSecurePassphrase() {
    return randomBytes(32).toString('hex');
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get deterministic timestamp for reproducible operations
   * @returns {number} Timestamp
   */
  getDeterministicTimestamp() {
    return Date.now();
  }

  /**
   * Get deterministic date for reproducible operations
   * @returns {Date} Date object
   */
  getDeterministicDate() {
    return new Date();
  }
}

export default KeyManager;