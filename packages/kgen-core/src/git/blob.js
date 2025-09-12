/**
 * Git Blob Operations - Git-native artifact storage
 * 
 * Provides native git blob storage for artifacts with deterministic hashing,
 * content-addressable storage, and efficient retrieval mechanisms.
 */

import git from 'isomorphic-git';
import fs from 'fs-extra';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { Consola } from 'consola';

export class GitBlobStorage extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      gitDir: config.gitDir || process.cwd() + '/.git',
      fs: config.fs || fs,
      enableCompression: config.enableCompression !== false,
      maxBlobSize: config.maxBlobSize || 50 * 1024 * 1024, // 50MB
      encoding: config.encoding || 'utf8',
      ...config
    };
    
    this.logger = new Consola({ tag: 'git-blob' });
    this.blobCache = new Map();
    this.stats = {
      blobsStored: 0,
      blobsRetrieved: 0,
      bytesStored: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Store artifact as git blob
   * @param {string|Buffer} content - Content to store
   * @param {Object} options - Storage options
   * @returns {Promise<string>} Git blob hash (SHA-1)
   */
  async storeArtifactAsBlob(content, options = {}) {
    try {
      const startTime = Date.now();
      
      // Validate content size
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, this.config.encoding);
      if (contentBuffer.length > this.config.maxBlobSize) {
        throw new Error(`Content exceeds maximum blob size: ${contentBuffer.length} > ${this.config.maxBlobSize}`);
      }
      
      // Generate deterministic blob hash
      const blobHash = await this._generateBlobHash(contentBuffer);
      
      // Check if blob already exists
      const exists = await this._blobExists(blobHash);
      if (exists && !options.force) {
        this.logger.debug(`Blob already exists: ${blobHash}`);
        return blobHash;
      }
      
      // Store as git blob
      const actualHash = await git.writeBlob({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        blob: contentBuffer
      });
      
      // Verify hash consistency
      if (actualHash !== blobHash) {
        this.logger.warn(`Hash mismatch - expected: ${blobHash}, actual: ${actualHash}`);
      }
      
      // Update cache and stats
      this.blobCache.set(actualHash, {
        content: contentBuffer,
        storedAt: new Date(),
        size: contentBuffer.length,
        metadata: options.metadata || {}
      });
      
      this.stats.blobsStored++;
      this.stats.bytesStored += contentBuffer.length;
      
      // Emit storage event
      this.emit('blob-stored', {
        hash: actualHash,
        size: contentBuffer.length,
        duration: Date.now() - startTime,
        metadata: options.metadata
      });
      
      this.logger.info(`Stored artifact as blob: ${actualHash} (${contentBuffer.length} bytes)`);
      return actualHash;
      
    } catch (error) {
      this.logger.error('Failed to store artifact as blob:', error);
      this.emit('blob-error', { operation: 'store', error });
      throw error;
    }
  }

  /**
   * Retrieve artifact from git blob
   * @param {string} blobHash - Git blob hash
   * @param {Object} options - Retrieval options
   * @returns {Promise<Buffer>} Blob content
   */
  async retrieveArtifactFromBlob(blobHash, options = {}) {
    try {
      const startTime = Date.now();
      
      // Check cache first
      if (this.blobCache.has(blobHash)) {
        this.stats.cacheHits++;
        const cached = this.blobCache.get(blobHash);
        this.emit('blob-retrieved', { hash: blobHash, source: 'cache', size: cached.size });
        
        // Default to string format for text content
        if (options.asString !== false) {
          return cached.content.toString(this.config.encoding);
        }
        return cached.content;
      }
      
      this.stats.cacheMisses++;
      
      // Read from git blob storage
      const { blob } = await git.readBlob({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: blobHash
      });
      
      // Convert to Buffer if it's a Uint8Array
      const blobBuffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
      
      // Cache the retrieved blob
      this.blobCache.set(blobHash, {
        content: blobBuffer,
        retrievedAt: new Date(),
        size: blobBuffer.length
      });
      
      this.stats.blobsRetrieved++;
      
      // Emit retrieval event
      this.emit('blob-retrieved', {
        hash: blobHash,
        source: 'storage',
        size: blobBuffer.length,
        duration: Date.now() - startTime
      });
      
      this.logger.debug(`Retrieved blob: ${blobHash} (${blobBuffer.length} bytes)`);
      
      // Default to string format for text content
      if (options.asString !== false) {
        return blobBuffer.toString(this.config.encoding);
      }
      return blobBuffer;
      
    } catch (error) {
      this.logger.error(`Failed to retrieve blob ${blobHash}:`, error);
      this.emit('blob-error', { operation: 'retrieve', hash: blobHash, error });
      throw error;
    }
  }

  /**
   * List all artifact blobs with metadata
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of blob objects
   */
  async listArtifactBlobs(options = {}) {
    try {
      const blobs = [];
      
      // Get all objects from git
      const objects = await git.listObjects({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', '')
      });
      
      // Filter for blob objects
      for (const { oid, type } of objects) {
        if (type === 'blob') {
          try {
            const { blob } = await git.readBlob({
              fs: this.config.fs,
              dir: this.config.gitDir.replace('/.git', ''),
              oid
            });
            
            blobs.push({
              hash: oid,
              size: blob.length,
              type: 'blob',
              cached: this.blobCache.has(oid),
              metadata: this.blobCache.get(oid)?.metadata || {}
            });
          } catch (err) {
            this.logger.warn(`Failed to read blob ${oid}:`, err.message);
          }
        }
      }
      
      // Apply filtering and sorting
      let filteredBlobs = blobs;
      if (options.minSize) {
        filteredBlobs = filteredBlobs.filter(b => b.size >= options.minSize);
      }
      if (options.maxSize) {
        filteredBlobs = filteredBlobs.filter(b => b.size <= options.maxSize);
      }
      
      // Sort by size or hash
      if (options.sortBy === 'size') {
        filteredBlobs.sort((a, b) => b.size - a.size);
      } else {
        filteredBlobs.sort((a, b) => a.hash.localeCompare(b.hash));
      }
      
      this.logger.info(`Listed ${filteredBlobs.length} artifact blobs`);
      return filteredBlobs;
      
    } catch (error) {
      this.logger.error('Failed to list artifact blobs:', error);
      throw error;
    }
  }

  /**
   * Verify blob integrity
   * @param {string} blobHash - Git blob hash to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyBlobIntegrity(blobHash) {
    try {
      const startTime = Date.now();
      
      // Retrieve blob content
      const content = await this.retrieveArtifactFromBlob(blobHash);
      
      // Recalculate hash
      const calculatedHash = await this._generateBlobHash(content);
      
      const isValid = calculatedHash === blobHash;
      
      const result = {
        hash: blobHash,
        calculatedHash,
        isValid,
        size: content.length,
        verificationTime: Date.now() - startTime
      };
      
      this.emit('blob-verified', result);
      
      if (isValid) {
        this.logger.debug(`Blob integrity verified: ${blobHash}`);
      } else {
        this.logger.warn(`Blob integrity FAILED: ${blobHash} (calculated: ${calculatedHash})`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to verify blob integrity ${blobHash}:`, error);
      throw error;
    }
  }

  /**
   * Generate deterministic blob hash (SHA-1 format compatible with git)
   * @param {Buffer} content - Content to hash
   * @returns {Promise<string>} SHA-1 hash
   */
  async _generateBlobHash(content) {
    const header = `blob ${content.length}\0`;
    const store = Buffer.concat([Buffer.from(header), content]);
    return crypto.createHash('sha1').update(store).digest('hex');
  }

  /**
   * Check if blob exists in git storage
   * @param {string} blobHash - Blob hash to check
   * @returns {Promise<boolean>} True if exists
   */
  async _blobExists(blobHash) {
    try {
      await git.readBlob({
        fs: this.config.fs,
        dir: this.config.gitDir.replace('/.git', ''),
        oid: blobHash
      });
      return true;
    } catch (error) {
      if (error.code === 'NotFoundError' || error.message.includes('not found')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.blobCache.size,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
    };
  }

  /**
   * Clear blob cache
   */
  clearCache() {
    this.blobCache.clear();
    this.logger.info('Blob cache cleared');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.clearCache();
    this.removeAllListeners();
    this.logger.info('Git blob storage cleanup completed');
  }
}

/**
 * Create git blob storage instance
 * @param {Object} config - Configuration options
 * @returns {GitBlobStorage} Initialized storage instance
 */
export function createGitBlobStorage(config = {}) {
  return new GitBlobStorage(config);
}

/**
 * Store multiple artifacts as blobs efficiently
 * @param {Map<string, string|Buffer>} artifacts - Map of artifact name to content
 * @param {Object} config - Storage configuration
 * @returns {Promise<Map<string, string>>} Map of artifact name to blob hash
 */
export async function storeArtifactsAsBlobs(artifacts, config = {}) {
  const storage = createGitBlobStorage(config);
  const results = new Map();
  
  try {
    const promises = Array.from(artifacts.entries()).map(async ([name, content]) => {
      const hash = await storage.storeArtifactAsBlob(content, {
        metadata: { artifactName: name }
      });
      return [name, hash];
    });
    
    const completed = await Promise.all(promises);
    completed.forEach(([name, hash]) => results.set(name, hash));
    
    return results;
  } finally {
    await storage.cleanup();
  }
}

export default GitBlobStorage;
