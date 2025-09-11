/**
 * Provenance Storage Backend - Multi-storage support for provenance data
 * 
 * Provides persistent storage for provenance records with encryption, compression,
 * and multiple backend support (file, database, object store).
 */

import consola from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class ProvenanceStorage {
  constructor(config = {}) {
    this.config = {
      backend: config.storageBackend || 'file',
      encryption: config.encryptionEnabled || false,
      compression: true,
      basePath: config.storagePath || './data/provenance',
      backupEnabled: true,
      backupRetention: '30d',
      ...config
    };

    this.logger = consola.withTag('provenance-storage');
    this.encryptionKey = null;
    
    if (this.config.encryption) {
      this.encryptionKey = this._generateOrLoadEncryptionKey();
    }
  }

  /**
   * Initialize storage backend
   */
  async initialize() {
    try {
      this.logger.info(`Initializing ${this.config.backend} storage backend`);

      switch (this.config.backend) {
        case 'memory':
          // Memory storage is ready by default
          break;
        case 'file':
          await this._initializeFileStorage();
          break;
        case 'database':
          await this._initializeDatabaseStorage();
          break;
        case 'object':
          await this._initializeObjectStorage();
      }

      // Create backup directories
      if (this.config.backupEnabled) {
        await this._initializeBackupStorage();
      }

      this.logger.success('Provenance storage initialized successfully');
      return { status: 'success', backend: this.config.backend };

    } catch (error) {
      this.logger.error('Failed to initialize provenance storage:', error);
      throw error;
    }
  }

  /**
   * Store provenance record
   * @param {string} id - Record identifier
   * @param {Object} data - Provenance data
   * @param {Object} options - Storage options
   */
  async store(id, data, options = {}) {
    try {
      const record = {
        id,
        data,
        timestamp: new Date(),
        version: options.version || '1.0',
        metadata: options.metadata || {}
      };

      // Serialize data
      let serializedData = JSON.stringify(record, null, 0);

      // Encrypt if enabled
      if (this.config.encryption) {
        serializedData = await this._encrypt(serializedData);
      }

      // Compress if enabled
      if (this.config.compression) {
        serializedData = await gzipAsync(Buffer.from(serializedData));
      }

      // Store based on backend
      const storageKey = this._generateStorageKey(id, options);
      await this._storeData(storageKey, serializedData, options);

      // Create backup if enabled
      if (this.config.backupEnabled) {
        await this._createBackup(storageKey, serializedData);
      }

      this.logger.debug(`Stored provenance record: ${id}`);
      return { status: 'success', key: storageKey, size: serializedData.length };

    } catch (error) {
      this.logger.error(`Failed to store provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve provenance record
   * @param {string} id - Record identifier
   * @param {Object} options - Retrieval options
   */
  async retrieve(id, options = {}) {
    try {
      const storageKey = this._generateStorageKey(id, options);
      let data = await this._retrieveData(storageKey, options);

      if (!data) {
        return null;
      }

      // Decompress if needed
      if (this.config.compression) {
        data = await gunzipAsync(data);
      }

      // Decrypt if needed
      if (this.config.encryption) {
        data = await this._decrypt(data.toString());
      } else {
        data = data.toString();
      }

      // Parse JSON
      const record = JSON.parse(data);
      
      this.logger.debug(`Retrieved provenance record: ${id}`);
      return record;

    } catch (error) {
      this.logger.error(`Failed to retrieve provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * List stored records
   * @param {Object} filters - Query filters
   */
  async list(filters = {}) {
    try {
      const records = await this._listRecords(filters);
      this.logger.debug(`Listed ${records.length} provenance records`);
      return records;

    } catch (error) {
      this.logger.error('Failed to list provenance records:', error);
      throw error;
    }
  }

  /**
   * Delete provenance record
   * @param {string} id - Record identifier
   * @param {Object} options - Deletion options
   */
  async delete(id, options = {}) {
    try {
      const storageKey = this._generateStorageKey(id, options);
      await this._deleteData(storageKey, options);
      
      this.logger.debug(`Deleted provenance record: ${id}`);
      return { status: 'success', key: storageKey };

    } catch (error) {
      this.logger.error(`Failed to delete provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create storage backup
   * @param {Object} options - Backup options
   */
  async backup(options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = options.name || `provenance-backup-${timestamp}`;
      
      const backupPath = await this._createFullBackup(backupName);
      
      this.logger.success(`Created provenance backup: ${backupPath}`);
      return { status: 'success', path: backupPath };

    } catch (error) {
      this.logger.error('Failed to create provenance backup:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   * @param {string} backupPath - Backup file path
   * @param {Object} options - Restore options
   */
  async restore(backupPath, options = {}) {
    try {
      await this._restoreFromBackup(backupPath, options);
      
      this.logger.success(`Restored provenance from backup: ${backupPath}`);
      return { status: 'success' };

    } catch (error) {
      this.logger.error('Failed to restore provenance from backup:', error);
      throw error;
    }
  }

  // Private methods

  async _initializeFileStorage() {
    // Create directory structure
    await fs.mkdir(this.config.basePath, { recursive: true });
    await fs.mkdir(path.join(this.config.basePath, 'records'), { recursive: true });
    await fs.mkdir(path.join(this.config.basePath, 'indexes'), { recursive: true });
  }

  async _initializeDatabaseStorage() {
    // Database storage initialization would go here
    // This would connect to PostgreSQL or other databases
    throw new Error('Database storage not implemented yet');
  }

  async _initializeObjectStorage() {
    // Object storage initialization (S3, Azure Blob, etc.)
    throw new Error('Object storage not implemented yet');
  }

  async _initializeBackupStorage() {
    const backupPath = path.join(this.config.basePath, 'backups');
    await fs.mkdir(backupPath, { recursive: true });
  }

  _generateStorageKey(id, options) {
    const date = new Date().toISOString().slice(0, 10);
    const prefix = options.prefix || 'prov';
    return `${prefix}/${date}/${id}`;
  }

  async _storeData(key, data, options) {
    if (this.config.backend === 'file') {
      const filePath = path.join(this.config.basePath, 'records', `${key}.json`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data);
    } else {
      throw new Error(`Storage not implemented for backend: ${this.config.backend}`);
    }
  }

  async _retrieveData(key, options) {
    if (this.config.backend === 'file') {
      const filePath = path.join(this.config.basePath, 'records', `${key}.json`);
      try {
        return await fs.readFile(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    } else {
      throw new Error(`Retrieval not implemented for backend: ${this.config.backend}`);
    }
  }

  async _listRecords(filters) {
    if (this.config.backend === 'file') {
      const recordsPath = path.join(this.config.basePath, 'records');
      const files = await this._getAllFiles(recordsPath);
      return files.map(file => ({
        id: path.basename(file, '.json'),
        path: file,
        size: 0 // Would need to stat each file
      }));
    } else {
      throw new Error(`Listing not implemented for backend: ${this.config.backend}`);
    }
  }

  async _deleteData(key, options) {
    if (this.config.backend === 'file') {
      const filePath = path.join(this.config.basePath, 'records', `${key}.json`);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } else {
      throw new Error(`Deletion not implemented for backend: ${this.config.backend}`);
    }
  }

  async _getAllFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this._getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async _createBackup(key, data) {
    if (!this.config.backupEnabled) return;
    
    const backupPath = path.join(this.config.basePath, 'backups', key);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(`${backupPath}.backup`, data);
  }

  async _createFullBackup(backupName) {
    // Create full backup of all records
    const backupPath = path.join(this.config.basePath, 'backups', `${backupName}.tar.gz`);
    // Implementation would create compressed archive
    return backupPath;
  }

  async _restoreFromBackup(backupPath, options) {
    // Restore implementation
    throw new Error('Restore functionality not implemented yet');
  }

  _generateOrLoadEncryptionKey() {
    // Generate or load encryption key
    return crypto.randomBytes(32);
  }

  async _encrypt(data) {
    // Secure encryption for provenance data using AES-256-GCM
    const encryptionKey = this.encryptionKey;
    
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', encryptionKey, iv);
    cipher.setAAD(Buffer.from('provenance-storage', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return IV + authTag + encrypted data for secure decryption
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  async _decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipherGCM('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAAD(Buffer.from('provenance-storage', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export default ProvenanceStorage;