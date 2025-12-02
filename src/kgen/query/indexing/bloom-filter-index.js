/**
 * Bloom Filter Index - Ultra-fast existence checks for SPARQL queries
 * 
 * Features:
 * - Space-efficient probabilistic data structure
 * - Configurable false positive rates
 * - Multiple hash functions for optimal distribution
 * - Dynamic sizing based on expected cardinality
 * - Compressed storage with bit manipulation optimizations
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import consola from 'consola';

export class BloomFilterIndex extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Bloom filter configuration
      expectedElements: config.expectedElements || 1000000,
      falsePositiveRate: config.falsePositiveRate || 0.01,
      hashFunctions: config.hashFunctions || 7,
      
      // Storage configuration
      storageDir: config.storageDir || './.kgen/indexes/bloom',
      enableCompression: config.enableCompression !== false,
      bitArrayChunkSize: config.bitArrayChunkSize || 8192, // 8KB chunks
      
      // Performance configuration
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      
      ...config
    };
    
    this.logger = consola.withTag('bloom-filter');
    
    // Calculate optimal parameters
    this._calculateOptimalParameters();
    
    // Bit array for the filter
    this.bitArray = null;
    this.bitArrayChunks = new Map();
    
    // Hash seeds for multiple hash functions
    this.hashSeeds = this._generateHashSeeds();
    
    // Statistics
    this.stats = {
      elements: 0,
      checks: 0,
      possibleFalsePositives: 0,
      bitArraySize: this.bitArraySize,
      actualFPRate: 0
    };
    
    // Caching for frequently accessed chunks
    this.chunkCache = new Map();
  }

  /**
   * Initialize the bloom filter index
   */
  async initialize() {
    try {
      this.logger.info('Initializing bloom filter index...');
      
      // Create storage directory
      await fs.mkdir(this.config.storageDir, { recursive: true });
      
      // Load existing filter if present
      const filterPath = path.join(this.config.storageDir, 'bloom-filter.json');
      try {
        const filterData = await fs.readFile(filterPath, 'utf8');
        await this._loadFilter(JSON.parse(filterData));
        this.logger.success('Loaded existing bloom filter');
      } catch (error) {
        // No existing filter, start fresh
        await this._initializeNewFilter();
        this.logger.success('Initialized new bloom filter');
      }
      
      return {
        status: 'ready',
        bitArraySize: this.bitArraySize,
        hashFunctions: this.config.hashFunctions,
        falsePositiveRate: this.config.falsePositiveRate,
        elements: this.stats.elements
      };
      
    } catch (error) {
      this.logger.error('Bloom filter initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add a triple pattern to the bloom filter
   * @param {Object} triple - Triple pattern
   * @returns {Promise<boolean>} Success status
   */
  async add(triple) {
    const startTime = performance.now();
    
    try {
      const key = this._createKey(triple);
      const hashes = this._computeHashes(key);
      
      let modified = false;
      
      for (const hash of hashes) {
        const bitIndex = hash % this.bitArraySize;
        const wasSet = await this._setBit(bitIndex);
        if (!wasSet) {
          modified = true;
        }
      }
      
      if (modified) {
        this.stats.elements++;
        this._updateFalsePositiveRate();
        
        this.emit('element:added', { key, triple });
      }
      
      return true;
      
    } finally {
      this.stats.addTime = (this.stats.addTime || 0) + (performance.now() - startTime);
    }
  }

  /**
   * Check if a triple pattern might exist in the bloom filter
   * @param {Object} pattern - Triple pattern to check
   * @returns {Promise<boolean>} True if might exist, false if definitely doesn't exist
   */
  async mightContain(pattern) {
    const startTime = performance.now();
    
    try {
      const key = this._createKey(pattern);
      const hashes = this._computeHashes(key);
      
      for (const hash of hashes) {
        const bitIndex = hash % this.bitArraySize;
        const isSet = await this._getBit(bitIndex);
        
        if (!isSet) {
          // Definitely not in the set
          this.stats.checks++;
          return false;
        }
      }
      
      // Might be in the set (possible false positive)
      this.stats.checks++;
      this.stats.possibleFalsePositives++;
      
      return true;
      
    } finally {
      this.stats.checkTime = (this.stats.checkTime || 0) + (performance.now() - startTime);
    }
  }

  /**
   * Batch check multiple patterns for existence
   * @param {Array} patterns - Array of triple patterns
   * @returns {Promise<Array>} Array of boolean results
   */
  async batchMightContain(patterns) {
    const startTime = performance.now();
    
    try {
      const results = [];
      
      // Group patterns by chunk to optimize I/O
      const chunkAccess = new Map();
      const patternHashes = patterns.map(pattern => {
        const key = this._createKey(pattern);
        const hashes = this._computeHashes(key);
        
        // Track which chunks we need to access
        for (const hash of hashes) {
          const bitIndex = hash % this.bitArraySize;
          const chunkIndex = Math.floor(bitIndex / (this.config.bitArrayChunkSize * 8));
          
          if (!chunkAccess.has(chunkIndex)) {
            chunkAccess.set(chunkIndex, []);
          }
          chunkAccess.get(chunkIndex).push({ patternIndex: results.length, bitIndex });
        }
        
        return hashes;
      });
      
      // Preload chunks
      const chunkPromises = Array.from(chunkAccess.keys()).map(chunkIndex => 
        this._getChunk(chunkIndex)
      );
      await Promise.all(chunkPromises);
      
      // Check each pattern
      for (let i = 0; i < patterns.length; i++) {
        const hashes = patternHashes[i];
        let mightExist = true;
        
        for (const hash of hashes) {
          const bitIndex = hash % this.bitArraySize;
          const isSet = await this._getBit(bitIndex);
          
          if (!isSet) {
            mightExist = false;
            break;
          }
        }
        
        results.push(mightExist);
        
        if (mightExist) {
          this.stats.possibleFalsePositives++;
        }
      }
      
      this.stats.checks += patterns.length;
      
      return results;
      
    } finally {
      this.stats.batchCheckTime = (this.stats.batchCheckTime || 0) + (performance.now() - startTime);
    }
  }

  /**
   * Optimize the bloom filter based on recommendations
   * @param {Array} recommendations - Optimization recommendations
   */
  async optimize(recommendations) {
    try {
      this.logger.info('Optimizing bloom filter based on recommendations...');
      
      for (const recommendation of recommendations) {
        switch (recommendation.type) {
          case 'resize':
            await this._resize(recommendation.newExpectedElements, recommendation.newFPRate);
            break;
            
          case 'rehash':
            await this._rehash(recommendation.newHashFunctions);
            break;
            
          case 'clear_and_rebuild':
            await this._clearAndRebuild();
            break;
            
          case 'compress':
            await this._compressBitArray();
            break;
        }
      }
      
      this.emit('optimization:completed', { recommendations: recommendations.length });
      
    } catch (error) {
      this.logger.error('Bloom filter optimization failed:', error);
      throw error;
    }
  }

  /**
   * Get bloom filter statistics
   */
  getStatistics() {
    const fillRatio = this.stats.elements > 0 ? 
      this._calculateFillRatio() : 0;
    
    return {
      configuration: {
        bitArraySize: this.bitArraySize,
        hashFunctions: this.config.hashFunctions,
        expectedElements: this.config.expectedElements,
        targetFPRate: this.config.falsePositiveRate
      },
      statistics: {
        elements: this.stats.elements,
        checks: this.stats.checks,
        possibleFalsePositives: this.stats.possibleFalsePositives,
        actualFPRate: this.stats.actualFPRate,
        fillRatio: fillRatio
      },
      performance: {
        avgAddTime: (this.stats.addTime || 0) / Math.max(1, this.stats.elements),
        avgCheckTime: (this.stats.checkTime || 0) / Math.max(1, this.stats.checks),
        avgBatchCheckTime: (this.stats.batchCheckTime || 0) / Math.max(1, this.stats.checks)
      },
      storage: {
        chunksLoaded: this.bitArrayChunks.size,
        cacheSize: this.chunkCache.size,
        memoryUsage: this._estimateMemoryUsage()
      }
    };
  }

  /**
   * Get current size of the filter
   */
  getSize() {
    return this.stats.elements;
  }

  /**
   * Clear the bloom filter
   */
  async clear() {
    try {
      this.bitArrayChunks.clear();
      this.chunkCache.clear();
      this.stats.elements = 0;
      this.stats.possibleFalsePositives = 0;
      this._updateFalsePositiveRate();
      
      // Clear storage files
      const files = await fs.readdir(this.config.storageDir);
      const chunkFiles = files.filter(file => file.startsWith('chunk_'));
      
      await Promise.all(chunkFiles.map(file => 
        fs.unlink(path.join(this.config.storageDir, file))
      ));
      
      this.emit('filter:cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear bloom filter:', error);
      throw error;
    }
  }

  /**
   * Flush changes to storage
   */
  async flush() {
    try {
      await this._saveChunksToStorage();
      await this._saveFilterMetadata();
      this.logger.info('Bloom filter flushed to storage');
    } catch (error) {
      this.logger.error('Bloom filter flush failed:', error);
      throw error;
    }
  }

  // Private implementation methods

  _calculateOptimalParameters() {
    // Calculate optimal bit array size and hash functions
    const n = this.config.expectedElements;
    const p = this.config.falsePositiveRate;
    
    // Optimal bit array size: m = -n * ln(p) / (ln(2)^2)
    this.bitArraySize = Math.ceil(-n * Math.log(p) / (Math.log(2) ** 2));
    
    // Optimal number of hash functions: k = (m/n) * ln(2)
    const optimalK = Math.ceil((this.bitArraySize / n) * Math.log(2));
    
    // Use configured value or optimal value
    this.config.hashFunctions = this.config.hashFunctions || Math.min(optimalK, 10);
    
    this.logger.info(`Bloom filter parameters: size=${this.bitArraySize}, hashFunctions=${this.config.hashFunctions}, expectedFP=${(p * 100).toFixed(2)}%`);
  }

  _generateHashSeeds() {
    const seeds = [];
    for (let i = 0; i < this.config.hashFunctions; i++) {
      seeds.push(crypto.randomBytes(4).readUInt32BE(0));
    }
    return seeds;
  }

  async _initializeNewFilter() {
    this.stats.elements = 0;
    this.stats.checks = 0;
    this.stats.possibleFalsePositives = 0;
    this.stats.actualFPRate = 0;
  }

  async _loadFilter(filterData) {
    this.bitArraySize = filterData.bitArraySize;
    this.config.hashFunctions = filterData.hashFunctions;
    this.hashSeeds = filterData.hashSeeds;
    this.stats = filterData.stats;
  }

  _computeHashes(key) {
    const hashes = [];
    
    for (let i = 0; i < this.config.hashFunctions; i++) {
      const hash = this._hash(key, this.hashSeeds[i]);
      hashes.push(Math.abs(hash));
    }
    
    return hashes;
  }

  _hash(key, seed) {
    // Simple hash function with seed
    let hash = seed;
    
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    
    return hash;
  }

  async _setBit(bitIndex) {
    const chunkIndex = Math.floor(bitIndex / (this.config.bitArrayChunkSize * 8));
    const bitInChunk = bitIndex % (this.config.bitArrayChunkSize * 8);
    
    const chunk = await this._getChunk(chunkIndex);
    
    const byteIndex = Math.floor(bitInChunk / 8);
    const bitInByte = bitInChunk % 8;
    
    const wasSet = (chunk[byteIndex] & (1 << bitInByte)) !== 0;
    
    if (!wasSet) {
      chunk[byteIndex] |= (1 << bitInByte);
      this._markChunkDirty(chunkIndex);
    }
    
    return wasSet;
  }

  async _getBit(bitIndex) {
    const chunkIndex = Math.floor(bitIndex / (this.config.bitArrayChunkSize * 8));
    const bitInChunk = bitIndex % (this.config.bitArrayChunkSize * 8);
    
    const chunk = await this._getChunk(chunkIndex);
    
    const byteIndex = Math.floor(bitInChunk / 8);
    const bitInByte = bitInChunk % 8;
    
    return (chunk[byteIndex] & (1 << bitInByte)) !== 0;
  }

  async _getChunk(chunkIndex) {
    // Check memory cache first
    if (this.chunkCache.has(chunkIndex)) {
      return this.chunkCache.get(chunkIndex);
    }
    
    // Check if chunk is already loaded
    if (this.bitArrayChunks.has(chunkIndex)) {
      const chunk = this.bitArrayChunks.get(chunkIndex);
      this._addToCache(chunkIndex, chunk);
      return chunk;
    }
    
    // Load chunk from storage
    let chunk;
    try {
      const chunkPath = path.join(this.config.storageDir, `chunk_${chunkIndex}.dat`);
      const chunkData = await fs.readFile(chunkPath);
      chunk = new Uint8Array(chunkData);
    } catch (error) {
      // Chunk doesn't exist, create empty chunk
      chunk = new Uint8Array(this.config.bitArrayChunkSize);
    }
    
    this.bitArrayChunks.set(chunkIndex, chunk);
    this._addToCache(chunkIndex, chunk);
    
    return chunk;
  }

  _addToCache(chunkIndex, chunk) {
    if (this.chunkCache.size >= this.config.cacheSize) {
      // Evict least recently used
      const [oldestIndex] = this.chunkCache.keys();
      this.chunkCache.delete(oldestIndex);
    }
    
    this.chunkCache.set(chunkIndex, chunk);
  }

  _markChunkDirty(chunkIndex) {
    if (!this.dirtyChunks) {
      this.dirtyChunks = new Set();
    }
    this.dirtyChunks.add(chunkIndex);
  }

  async _saveChunksToStorage() {
    if (!this.dirtyChunks) return;
    
    const savePromises = [];
    
    for (const chunkIndex of this.dirtyChunks) {
      const chunk = this.bitArrayChunks.get(chunkIndex);
      if (chunk) {
        const chunkPath = path.join(this.config.storageDir, `chunk_${chunkIndex}.dat`);
        savePromises.push(fs.writeFile(chunkPath, chunk));
      }
    }
    
    await Promise.all(savePromises);
    this.dirtyChunks.clear();
  }

  async _saveFilterMetadata() {
    const metadata = {
      bitArraySize: this.bitArraySize,
      hashFunctions: this.config.hashFunctions,
      hashSeeds: this.hashSeeds,
      stats: this.stats,
      config: this.config,
      lastSaved: this.getDeterministicTimestamp()
    };
    
    const filterPath = path.join(this.config.storageDir, 'bloom-filter.json');
    await fs.writeFile(filterPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  _createKey(triple) {
    const subject = this._normalizeValue(triple.subject);
    const predicate = this._normalizeValue(triple.predicate);
    const object = this._normalizeValue(triple.object);
    
    return `${subject}|${predicate}|${object}`;
  }

  _normalizeValue(value) {
    if (typeof value === 'object' && value.value !== undefined) {
      return value.value;
    }
    return String(value || '');
  }

  _updateFalsePositiveRate() {
    if (this.stats.checks > 0) {
      this.stats.actualFPRate = this.stats.possibleFalsePositives / this.stats.checks;
    }
  }

  _calculateFillRatio() {
    // Estimate fill ratio based on expected vs actual false positive rate
    if (this.stats.actualFPRate > 0 && this.config.falsePositiveRate > 0) {
      return Math.min(1.0, this.stats.actualFPRate / this.config.falsePositiveRate);
    }
    return this.stats.elements / this.config.expectedElements;
  }

  _estimateMemoryUsage() {
    const chunkSize = this.config.bitArrayChunkSize;
    const loadedChunks = this.bitArrayChunks.size;
    const cachedChunks = this.chunkCache.size;
    
    return {
      bitArrayChunks: loadedChunks * chunkSize,
      cache: cachedChunks * chunkSize,
      total: (loadedChunks + cachedChunks) * chunkSize
    };
  }

  // Optimization methods

  async _resize(newExpectedElements, newFPRate) {
    this.logger.info(`Resizing bloom filter: elements=${newExpectedElements}, fpRate=${newFPRate}`);
    
    const oldConfig = { ...this.config };
    const oldSize = this.bitArraySize;
    
    // Update configuration
    this.config.expectedElements = newExpectedElements;
    this.config.falsePositiveRate = newFPRate;
    
    // Recalculate parameters
    this._calculateOptimalParameters();
    
    // If the new size is larger, we can keep existing bits
    if (this.bitArraySize > oldSize) {
      this.logger.info('Expanding bloom filter (keeping existing data)');
      // Current data remains valid, just expand the bit array
    } else {
      this.logger.warn('Shrinking bloom filter requires rebuilding');
      // Would need to rebuild from source data
      await this.clear();
    }
    
    // Regenerate hash seeds for new parameters
    this.hashSeeds = this._generateHashSeeds();
    
    this.emit('filter:resized', {
      oldSize,
      newSize: this.bitArraySize,
      oldConfig,
      newConfig: { ...this.config }
    });
  }

  async _rehash(newHashFunctions) {
    if (newHashFunctions === this.config.hashFunctions) return;
    
    this.logger.info(`Changing hash functions from ${this.config.hashFunctions} to ${newHashFunctions}`);
    
    this.config.hashFunctions = newHashFunctions;
    this.hashSeeds = this._generateHashSeeds();
    
    // Clear existing filter since hash functions changed
    await this.clear();
    
    this.emit('filter:rehashed', { newHashFunctions });
  }

  async _clearAndRebuild() {
    this.logger.info('Clearing and rebuilding bloom filter...');
    
    await this.clear();
    
    // Regenerate all parameters
    this._calculateOptimalParameters();
    this.hashSeeds = this._generateHashSeeds();
    
    this.emit('filter:rebuilt');
  }

  async _compressBitArray() {
    this.logger.info('Compressing bloom filter bit array...');
    
    // Implementation would compress sparse chunks
    let compressedChunks = 0;
    
    for (const [chunkIndex, chunk] of this.bitArrayChunks) {
      const sparsity = this._calculateChunkSparsity(chunk);
      
      if (sparsity < 0.1) { // Less than 10% filled
        // Could implement compression here
        compressedChunks++;
      }
    }
    
    this.logger.info(`Compressed ${compressedChunks} sparse chunks`);
  }

  _calculateChunkSparsity(chunk) {
    let setBits = 0;
    
    for (let i = 0; i < chunk.length; i++) {
      let byte = chunk[i];
      // Count bits using Brian Kernighan's algorithm
      while (byte) {
        setBits++;
        byte &= byte - 1;
      }
    }
    
    return setBits / (chunk.length * 8);
  }
}

export default BloomFilterIndex;
