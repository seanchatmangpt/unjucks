/**
 * Content-Addressed Storage Backend
 * 
 * Provides pluggable storage backends:
 * - Memory storage for development and testing
 * - File-based storage for persistence
 * - Future: Database, cloud storage, etc.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Memory storage backend
 */
class MemoryStore {
  constructor() {
    this.data = new Map();
  }

  async initialize() {
    // Memory store needs no initialization
    return true;
  }

  async store(hash, content) {
    this.data.set(hash, content);
    return true;
  }

  async retrieve(hash) {
    return this.data.get(hash) || null;
  }

  async exists(hash) {
    return this.data.has(hash);
  }

  async clear() {
    this.data.clear();
  }

  async list() {
    return Array.from(this.data.keys());
  }

  getSize() {
    return this.data.size;
  }
}

/**
 * File-based storage backend
 */
class FileStore {
  constructor(options = {}) {
    this.basePath = options.basePath || '.kgen/cas';
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      this.initialized = true;
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize file store: ${error.message}`);
    }
  }

  async store(hash, content) {
    await this.initialize();
    
    try {
      const filePath = this._getFilePath(hash);
      const dirPath = dirname(filePath);
      
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write content atomically
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content);
      await fs.rename(tempPath, filePath);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to store content: ${error.message}`);
    }
  }

  async retrieve(hash) {
    await this.initialize();
    
    try {
      const filePath = this._getFilePath(hash);
      const content = await fs.readFile(filePath);
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }
  }

  async exists(hash) {
    await this.initialize();
    
    try {
      const filePath = this._getFilePath(hash);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async clear() {
    await this.initialize();
    
    try {
      // Remove all files in the CAS directory
      const files = await this._listFiles(this.basePath);
      await Promise.all(
        files.map(file => fs.unlink(file).catch(() => {}))
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to clear storage: ${error.message}`);
    }
  }

  async list() {
    await this.initialize();
    
    try {
      const files = await this._listFiles(this.basePath);
      return files.map(file => {
        const relativePath = file.replace(this.basePath + '/', '');
        return relativePath.replace(/\//g, ''); // Remove directory separators
      });
    } catch (error) {
      return [];
    }
  }

  async getSize() {
    const files = await this.list();
    return files.length;
  }

  // Private methods

  _getFilePath(hash) {
    // Store files in subdirectories based on first two characters of hash
    // This prevents having too many files in a single directory
    const prefix = hash.substring(0, 2);
    const suffix = hash.substring(2);
    return join(this.basePath, prefix, suffix);
  }

  async _listFiles(dir, allFiles = []) {
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this._listFiles(filePath, allFiles);
        } else {
          allFiles.push(filePath);
        }
      }
      
      return allFiles;
    } catch (error) {
      return allFiles;
    }
  }
}

/**
 * Main CAS Store class with pluggable backends
 */
export class CASStore {
  constructor(options = {}) {
    this.storageType = options.storageType || 'memory';
    this.options = options;
    
    // Initialize the appropriate backend
    switch (this.storageType) {
      case 'memory':
        this.backend = new MemoryStore();
        break;
      case 'file':
        this.backend = new FileStore(options);
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.storageType}`);
    }
  }

  async initialize() {
    return this.backend.initialize();
  }

  async store(hash, content) {
    return this.backend.store(hash, content);
  }

  async retrieve(hash) {
    return this.backend.retrieve(hash);
  }

  async exists(hash) {
    return this.backend.exists(hash);
  }

  async clear() {
    return this.backend.clear();
  }

  async list() {
    return this.backend.list();
  }

  async getSize() {
    return this.backend.getSize();
  }

  getStorageType() {
    return this.storageType;
  }
}

// Export storage backends for direct use if needed
export { MemoryStore, FileStore };

// Export default store instance
export const casStore = new CASStore();

export default CASStore;
