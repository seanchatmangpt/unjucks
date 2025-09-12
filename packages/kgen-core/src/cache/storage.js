import { promises as fs } from 'fs'
import path from 'path'
import { createWriteStream, createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

/**
 * Content-Addressed Storage System
 * 
 * Stores cache entries using content hashes as keys,
 * maintaining an index for key-to-hash mappings.
 */
export class Storage {
  constructor(options = {}) {
    this.options = options
    this.cacheDir = options.cacheDir
    this.dataDir = path.join(this.cacheDir, 'data')
    this.indexPath = path.join(this.cacheDir, 'index.json')
    this.metaPath = path.join(this.cacheDir, 'meta.json')
    this.index = new Map()
    this.metadata = new Map()
  }

  /**
   * Initialize storage system
   */
  async init() {
    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.mkdir(this.dataDir, { recursive: true })
    
    // Load existing index
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf8')
      const indexObj = JSON.parse(indexData)
      this.index = new Map(Object.entries(indexObj))
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    
    // Load existing metadata
    try {
      const metaData = await fs.readFile(this.metaPath, 'utf8')
      const metaObj = JSON.parse(metaData)
      this.metadata = new Map(Object.entries(metaObj))
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Get storage path for hash
   */
  getStoragePath(hash) {
    // Use first 2 characters for directory structure
    const dir = hash.slice(0, 2)
    const filename = hash.slice(2)
    return path.join(this.dataDir, dir, filename)
  }

  /**
   * Store entry by content hash
   */
  async store(hash, entry) {
    const storePath = this.getStoragePath(hash)
    const dir = path.dirname(storePath)
    
    await fs.mkdir(dir, { recursive: true })
    
    // Store content and metadata separately for efficiency
    const storeData = {
      key: entry.key,
      hash: entry.hash,
      metadata: entry.metadata
    }
    
    // Store metadata
    this.metadata.set(hash, storeData)
    await this.saveMetadata()
    
    // Store content
    const content = typeof entry.content === 'string' 
      ? entry.content 
      : JSON.stringify(entry.content)
    
    await fs.writeFile(storePath, content, 'utf8')
  }

  /**
   * Retrieve entry by hash
   */
  async retrieve(hash) {
    const storePath = this.getStoragePath(hash)
    const metadata = this.metadata.get(hash)
    
    if (!metadata) return null
    
    try {
      const content = await fs.readFile(storePath, 'utf8')
      
      return {
        ...metadata,
        content: this.parseContent(content, metadata.metadata?.type)
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Remove stale metadata
        this.metadata.delete(hash)
        await this.saveMetadata()
      }
      return null
    }
  }

  /**
   * Check if hash exists in storage
   */
  async exists(hash) {
    const storePath = this.getStoragePath(hash)
    
    try {
      await fs.access(storePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Remove entry by hash
   */
  async remove(hash) {
    const storePath = this.getStoragePath(hash)
    
    try {
      await fs.unlink(storePath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    
    this.metadata.delete(hash)
    await this.saveMetadata()
  }

  /**
   * Update key-to-hash index
   */
  async updateIndex(key, hash) {
    this.index.set(key, hash)
    await this.saveIndex()
  }

  /**
   * Remove key from index
   */
  async removeFromIndex(key) {
    this.index.delete(key)
    await this.saveIndex()
  }

  /**
   * Get hash by key
   */
  async getHashByKey(key) {
    return this.index.get(key)
  }

  /**
   * List all entries
   */
  async list() {
    const entries = []
    
    for (const [hash, metadata] of this.metadata.entries()) {
      entries.push({
        hash,
        key: metadata.key,
        metadata: metadata.metadata,
        exists: await this.exists(hash)
      })
    }
    
    return entries
  }

  /**
   * Get storage statistics
   */
  async stats() {
    let totalSize = 0
    let fileCount = 0
    let oldestEntry = null
    let newestEntry = null
    
    for (const [hash, metadata] of this.metadata.entries()) {
      const exists = await this.exists(hash)
      if (!exists) continue
      
      fileCount++
      totalSize += metadata.metadata?.size || 0
      
      const createdAt = metadata.metadata?.createdAt
      if (createdAt) {
        if (!oldestEntry || createdAt < oldestEntry) {
          oldestEntry = createdAt
        }
        if (!newestEntry || createdAt > newestEntry) {
          newestEntry = createdAt
        }
      }
    }
    
    return {
      totalSize,
      fileCount,
      indexSize: this.index.size,
      oldestEntry: oldestEntry ? new Date(oldestEntry) : null,
      newestEntry: newestEntry ? new Date(newestEntry) : null,
      cacheDir: this.cacheDir
    }
  }

  /**
   * Clear all storage
   */
  async clear() {
    // Remove data directory
    try {
      await fs.rm(this.dataDir, { recursive: true, force: true })
      await fs.mkdir(this.dataDir, { recursive: true })
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    // Clear in-memory structures
    this.index.clear()
    this.metadata.clear()
    
    // Save empty index and metadata
    await this.saveIndex()
    await this.saveMetadata()
  }

  /**
   * Save index to disk
   */
  async saveIndex() {
    const indexObj = Object.fromEntries(this.index)
    await fs.writeFile(this.indexPath, JSON.stringify(indexObj, null, 2), 'utf8')
  }

  /**
   * Save metadata to disk
   */
  async saveMetadata() {
    const metaObj = Object.fromEntries(this.metadata)
    await fs.writeFile(this.metaPath, JSON.stringify(metaObj, null, 2), 'utf8')
  }

  /**
   * Parse stored content based on type
   */
  parseContent(content, type) {
    if (type === 'json' || (content.startsWith('{') || content.startsWith('['))) {
      try {
        return JSON.parse(content)
      } catch {
        return content
      }
    }
    
    return content
  }

  /**
   * Get all entries for garbage collection
   */
  async getAllEntries() {
    const entries = []
    
    for (const [hash, metadata] of this.metadata.entries()) {
      const exists = await this.exists(hash)
      if (exists) {
        entries.push({
          hash,
          ...metadata
        })
      } else {
        // Clean up stale metadata
        this.metadata.delete(hash)
      }
    }
    
    if (this.metadata.size !== entries.length) {
      await this.saveMetadata()
    }
    
    return entries
  }
}

export default Storage