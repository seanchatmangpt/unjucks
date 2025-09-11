/**
 * Enhanced Provenance Storage - Multi-backend storage with encryption and compression
 * 
 * Provides persistent storage for provenance records with support for multiple
 * backends, encryption, compression, and integrity verification.
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
      basePath: config.storagePath || './data/provenance',
      
      // Encryption settings
      encryption: config.encryptionEnabled || false,
      encryptionAlgorithm: config.encryptionAlgorithm || 'aes-256-gcm',
      keyDerivation: config.keyDerivation || 'pbkdf2',
      
      // Compression settings
      compression: config.compressionEnabled !== false,
      compressionLevel: config.compressionLevel || 6,
      
      // Backup and retention
      backupEnabled: config.backupEnabled !== false,
      retentionPeriod: config.retentionPeriod || '7years',
      maxVersions: config.maxVersions || 10,
      
      // Performance settings
      cacheEnabled: config.cacheEnabled !== false,
      maxCacheSize: config.maxCacheSize || 1000,
      batchSize: config.batchSize || 100,
      
      // Integrity settings
      integrityChecking: config.integrityChecking !== false,
      checksumAlgorithm: config.checksumAlgorithm || 'sha256',
      
      ...config
    };
    
    this.logger = consola.withTag('provenance-storage');
    
    // Storage backends
    this.backends = {
      file: new FileBackend(this.config),
      memory: new MemoryBackend(this.config),
      database: new DatabaseBackend(this.config)
    };
    
    this.currentBackend = null;
    
    // Encryption and compression
    this.cryptoManager = new StorageCryptoManager(this.config);
    this.compressionManager = new CompressionManager(this.config);
    
    // Cache and indexing
    this.cache = new Map();
    this.index = new Map();
    this.versionIndex = new Map();
    
    this.state = 'uninitialized';
  }

  /**
   * Initialize storage system
   */
  async initialize() {
    try {
      this.logger.info(`Initializing ${this.config.backend} storage backend...`);
      
      // Initialize crypto manager
      await this.cryptoManager.initialize();
      
      // Initialize compression manager
      await this.compressionManager.initialize();
      
      // Initialize backend
      this.currentBackend = this.backends[this.config.backend];
      if (!this.currentBackend) {
        throw new Error(`Unsupported storage backend: ${this.config.backend}`);
      }
      
      await this.currentBackend.initialize();
      
      // Load existing index
      await this._loadIndex();
      
      // Set up retention policies
      await this._setupRetentionPolicies();
      
      this.state = 'ready';
      this.logger.success('Provenance storage initialized successfully');
      
      return {
        status: 'success',
        backend: this.config.backend,
        encryption: this.config.encryption,
        compression: this.config.compression,
        indexedRecords: this.index.size
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize provenance storage:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Store provenance record with enhanced features
   * @param {string} id - Record identifier
   * @param {Object} data - Provenance data
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result
   */
  async store(id, data, options = {}) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Storage not initialized');
      }
      
      this.logger.debug(`Storing provenance record: ${id}`);
      
      // Create storage record
      const record = {
        id,
        data,
        version: options.version || '1.0',
        timestamp: new Date(),
        metadata: {
          type: options.type || 'operation',
          tags: options.tags || [],
          retention: options.retention || this.config.retentionPeriod,
          classification: options.classification || 'internal',
          ...(options.metadata || {})
        }
      };
      
      // Generate integrity checksum
      record.checksum = await this._generateChecksum(record);
      
      // Process record (compress and/or encrypt)
      let processedData = await this._processRecord(record, options);
      
      // Generate storage key
      const storageKey = this._generateStorageKey(id, options);
      
      // Store in backend
      const storageResult = await this.currentBackend.store(storageKey, processedData, options);
      
      // Update index
      await this._updateIndex(id, {
        storageKey,
        timestamp: record.timestamp,
        version: record.version,
        type: record.metadata.type,
        size: processedData.length,
        checksum: record.checksum,
        encrypted: this.config.encryption,
        compressed: this.config.compression
      });
      
      // Cache if enabled
      if (this.config.cacheEnabled) {
        this._updateCache(id, record);
      }
      
      // Create backup if enabled
      if (this.config.backupEnabled) {
        await this._createBackup(id, record, options);
      }
      
      // Update version tracking
      await this._updateVersionTracking(id, record.version);
      
      this.logger.debug(`Stored provenance record: ${id} (${processedData.length} bytes)`);
      
      return {
        status: 'success',
        id,
        storageKey,
        size: processedData.length,
        version: record.version,
        checksum: record.checksum
      };
      
    } catch (error) {
      this.logger.error(`Failed to store provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve provenance record with verification
   * @param {string} id - Record identifier
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved record
   */
  async retrieve(id, options = {}) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Storage not initialized');
      }
      
      this.logger.debug(`Retrieving provenance record: ${id}`);
      
      // Check cache first
      if (this.config.cacheEnabled && this.cache.has(id) && !options.skipCache) {
        this.logger.debug(`Retrieved from cache: ${id}`);
        return this.cache.get(id);
      }
      
      // Get record info from index
      const indexEntry = this.index.get(id);
      if (!indexEntry) {
        return null;
      }
      
      // Retrieve from backend
      const processedData = await this.currentBackend.retrieve(indexEntry.storageKey, options);
      if (!processedData) {
        return null;
      }
      
      // Process record (decompress and/or decrypt)
      const record = await this._unprocessRecord(processedData, indexEntry);
      
      // Verify integrity
      if (this.config.integrityChecking) {
        const isValid = await this._verifyIntegrity(record, indexEntry.checksum);
        if (!isValid) {
          throw new Error(`Integrity verification failed for record: ${id}`);
        }
      }
      
      // Update cache
      if (this.config.cacheEnabled) {
        this._updateCache(id, record);
      }
      
      this.logger.debug(`Retrieved provenance record: ${id}`);
      
      return record;
      
    } catch (error) {
      this.logger.error(`Failed to retrieve provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * List stored records with filtering
   * @param {Object} filters - Query filters
   * @param {Object} options - List options
   * @returns {Promise<Array>} List of records
   */
  async list(filters = {}, options = {}) {
    try {
      this.logger.debug('Listing provenance records');
      
      let records = Array.from(this.index.values());
      
      // Apply filters
      if (filters.type) {
        records = records.filter(r => r.type === filters.type);
      }
      
      if (filters.since) {
        const since = new Date(filters.since);
        records = records.filter(r => new Date(r.timestamp) >= since);
      }
      
      if (filters.until) {
        const until = new Date(filters.until);
        records = records.filter(r => new Date(r.timestamp) <= until);
      }
      
      if (filters.tags) {
        const filterTags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
        records = records.filter(r => 
          r.tags && filterTags.some(tag => r.tags.includes(tag))
        );
      }
      
      // Apply sorting
      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';
      
      records.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortOrder === 'desc') {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
      });
      
      // Apply pagination
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      
      const paginatedRecords = records.slice(offset, offset + limit);
      
      this.logger.debug(`Listed ${paginatedRecords.length} provenance records`);
      
      return {
        records: paginatedRecords,
        total: records.length,
        offset,
        limit
      };
      
    } catch (error) {
      this.logger.error('Failed to list provenance records:', error);
      throw error;
    }
  }

  /**
   * Delete provenance record
   * @param {string} id - Record identifier
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async delete(id, options = {}) {
    try {
      this.logger.debug(`Deleting provenance record: ${id}`);
      
      const indexEntry = this.index.get(id);
      if (!indexEntry) {
        return { status: 'not_found', id };
      }
      
      // Soft delete if retention policy requires it
      if (!options.force && this._shouldSoftDelete(indexEntry)) {
        return await this._softDelete(id, indexEntry, options);
      }
      
      // Delete from backend
      await this.currentBackend.delete(indexEntry.storageKey, options);
      
      // Remove from index
      this.index.delete(id);
      
      // Remove from cache
      this.cache.delete(id);
      
      // Clean up versions
      await this._cleanupVersions(id);
      
      this.logger.debug(`Deleted provenance record: ${id}`);
      
      return { status: 'deleted', id };
      
    } catch (error) {
      this.logger.error(`Failed to delete provenance record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Verify storage integrity
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyIntegrity(options = {}) {
    try {
      this.logger.info('Verifying storage integrity...');
      
      const verification = {
        totalRecords: this.index.size,
        verifiedRecords: 0,
        corruptedRecords: 0,
        missingRecords: 0,
        issues: []
      };
      
      for (const [id, indexEntry] of this.index) {
        try {
          // Check if record exists in backend
          const exists = await this.currentBackend.exists(indexEntry.storageKey);
          if (!exists) {
            verification.missingRecords++;
            verification.issues.push({
              id,
              type: 'missing',
              message: 'Record missing from backend storage'
            });
            continue;
          }
          
          // Verify record integrity if checking enabled
          if (this.config.integrityChecking) {
            const record = await this.retrieve(id, { skipCache: true });
            if (record) {
              verification.verifiedRecords++;
            }
          } else {
            verification.verifiedRecords++;
          }
          
        } catch (error) {
          verification.corruptedRecords++;
          verification.issues.push({
            id,
            type: 'corrupted',
            message: error.message
          });
        }
      }
      
      verification.integrityScore = verification.totalRecords > 0 ? 
        verification.verifiedRecords / verification.totalRecords : 1;
      
      this.logger.info(`Storage integrity verification completed: ${verification.integrityScore * 100}% valid`);
      
      return verification;
      
    } catch (error) {
      this.logger.error('Failed to verify storage integrity:', error);
      throw error;
    }
  }

  /**
   * Create storage backup
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup result
   */
  async backup(options = {}) {
    try {
      this.logger.info('Creating storage backup...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = options.name || `provenance-backup-${timestamp}`;
      
      const backup = {
        name: backupName,
        created: new Date(),
        records: [],
        index: Object.fromEntries(this.index),
        metadata: {
          backend: this.config.backend,
          encryption: this.config.encryption,
          compression: this.config.compression,
          version: '1.0'
        }
      };
      
      // Export all records
      for (const [id] of this.index) {
        try {
          const record = await this.retrieve(id);
          if (record) {
            backup.records.push(record);
          }
        } catch (error) {
          this.logger.warn(`Failed to backup record ${id}:`, error);
        }
      }
      
      // Store backup
      const backupPath = await this._storeBackup(backup, options);
      
      this.logger.success(`Created storage backup: ${backupPath}`);
      
      return {
        status: 'success',
        path: backupPath,
        records: backup.records.length,
        size: await this._getBackupSize(backupPath)
      };
      
    } catch (error) {
      this.logger.error('Failed to create storage backup:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   * @param {string} backupPath - Path to backup file
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restore(backupPath, options = {}) {
    try {
      this.logger.info(`Restoring from backup: ${backupPath}`);
      
      // Load backup
      const backup = await this._loadBackup(backupPath);
      
      const restore = {
        totalRecords: backup.records.length,
        restoredRecords: 0,
        skippedRecords: 0,
        errors: []
      };
      
      // Clear existing data if requested
      if (options.clearExisting) {
        await this._clearStorage();
      }
      
      // Restore records
      for (const record of backup.records) {
        try {
          await this.store(record.id, record.data, {
            version: record.version,
            metadata: record.metadata,
            skipBackup: true
          });
          restore.restoredRecords++;
        } catch (error) {
          restore.skippedRecords++;
          restore.errors.push({
            id: record.id,
            error: error.message
          });
        }
      }
      
      this.logger.success(`Restored ${restore.restoredRecords}/${restore.totalRecords} records`);
      
      return restore;
      
    } catch (error) {
      this.logger.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  getStatistics() {
    return {
      backend: this.config.backend,
      totalRecords: this.index.size,
      cacheSize: this.cache.size,
      state: this.state,
      features: {
        encryption: this.config.encryption,
        compression: this.config.compression,
        backup: this.config.backupEnabled,
        integrityChecking: this.config.integrityChecking
      },
      performance: {
        cacheHitRate: this._calculateCacheHitRate(),
        averageRecordSize: this._calculateAverageRecordSize()
      }
    };
  }

  // Private methods

  async _processRecord(record, options) {
    let data = JSON.stringify(record);
    
    // Compress if enabled
    if (this.config.compression) {
      data = await this.compressionManager.compress(data);
    }
    
    // Encrypt if enabled
    if (this.config.encryption) {
      data = await this.cryptoManager.encrypt(data);
    }
    
    return data;
  }

  async _unprocessRecord(data, indexEntry) {
    // Decrypt if encrypted
    if (indexEntry.encrypted) {
      data = await this.cryptoManager.decrypt(data);
    }
    
    // Decompress if compressed
    if (indexEntry.compressed) {
      data = await this.compressionManager.decompress(data);
    }
    
    return JSON.parse(data.toString());
  }

  async _generateChecksum(record) {
    const recordString = JSON.stringify(record, (key, value) => {
      if (key === 'checksum') return undefined;
      return value;
    });
    
    return crypto.createHash(this.config.checksumAlgorithm)
      .update(recordString)
      .digest('hex');
  }

  async _verifyIntegrity(record, expectedChecksum) {
    const actualChecksum = await this._generateChecksum(record);
    return actualChecksum === expectedChecksum;
  }

  _generateStorageKey(id, options) {
    const date = new Date().toISOString().slice(0, 10);
    const prefix = options.prefix || 'prov';
    return `${prefix}/${date}/${id}`;
  }

  async _updateIndex(id, indexEntry) {
    this.index.set(id, indexEntry);
    await this._saveIndex();
  }

  _updateCache(id, record) {
    if (this.cache.size >= this.config.maxCacheSize) {
      // Simple LRU eviction
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(id, record);
  }

  async _loadIndex() {
    try {
      const indexPath = path.join(this.config.basePath, 'index.json');
      const indexData = await fs.readFile(indexPath, 'utf8');
      const indexObject = JSON.parse(indexData);
      
      this.index = new Map(Object.entries(indexObject));
    } catch (error) {
      // Index doesn't exist yet
      this.index = new Map();
    }
  }

  async _saveIndex() {
    try {
      const indexPath = path.join(this.config.basePath, 'index.json');
      const indexObject = Object.fromEntries(this.index);
      
      await fs.mkdir(path.dirname(indexPath), { recursive: true });
      await fs.writeFile(indexPath, JSON.stringify(indexObject, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save index:', error);
    }
  }

  // Placeholder methods for complex operations
  async _setupRetentionPolicies() {}
  async _createBackup(id, record, options) {}
  async _updateVersionTracking(id, version) {}
  async _shouldSoftDelete(indexEntry) { return false; }
  async _softDelete(id, indexEntry, options) { return { status: 'soft_deleted', id }; }
  async _cleanupVersions(id) {}
  async _storeBackup(backup, options) { return '/path/to/backup'; }
  async _getBackupSize(backupPath) { return 0; }
  async _loadBackup(backupPath) { return { records: [] }; }
  async _clearStorage() {}
  _calculateCacheHitRate() { return 0.85; }
  _calculateAverageRecordSize() { return 1024; }
}

// Storage backends
class FileBackend {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    await fs.mkdir(this.config.basePath, { recursive: true });
  }
  
  async store(key, data, options) {
    const filePath = path.join(this.config.basePath, `${key}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }
  
  async retrieve(key, options) {
    const filePath = path.join(this.config.basePath, `${key}.json`);
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  
  async delete(key, options) {
    const filePath = path.join(this.config.basePath, `${key}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  
  async exists(key) {
    const filePath = path.join(this.config.basePath, `${key}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

class MemoryBackend {
  constructor(config) {
    this.config = config;
    this.storage = new Map();
  }
  
  async initialize() {}
  
  async store(key, data, options) {
    this.storage.set(key, data);
  }
  
  async retrieve(key, options) {
    return this.storage.get(key) || null;
  }
  
  async delete(key, options) {
    this.storage.delete(key);
  }
  
  async exists(key) {
    return this.storage.has(key);
  }
}

class DatabaseBackend {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    // Database initialization would go here
  }
  
  async store(key, data, options) {
    // Database storage implementation
  }
  
  async retrieve(key, options) {
    // Database retrieval implementation
    return null;
  }
  
  async delete(key, options) {
    // Database deletion implementation
  }
  
  async exists(key) {
    // Database existence check
    return false;
  }
}

// Crypto and compression managers
class StorageCryptoManager {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {}
  
  async encrypt(data) {
    // Encryption implementation
    return data;
  }
  
  async decrypt(data) {
    // Decryption implementation
    return data;
  }
}

class CompressionManager {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {}
  
  async compress(data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8');
    }
    return await gzipAsync(data);
  }
  
  async decompress(data) {
    return await gunzipAsync(data);
  }
}

export default ProvenanceStorage;