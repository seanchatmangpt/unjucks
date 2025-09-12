/**
 * Content-Addressed Semantic Store
 * 
 * Specialized storage system for RDF semantic content using content addressing.
 * Integrates with the CAS system to provide efficient storage and retrieval
 * of semantically-hashed RDF graphs with deduplication and provenance tracking.
 * 
 * Features:
 * - Content-addressed RDF storage with semantic indexing
 * - Semantic vs syntactic content differentiation
 * - Merkle tree organization for large graph hierarchies
 * - Provenance tracking for semantic changes
 * - Efficient retrieval by semantic hash or CID
 */

import { cas } from '../cas/cas-core.js';
import { SemanticHashEngine } from './semantic-hash-engine.js';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export class ContentAddressedSemanticStore extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Storage configuration
      namespace: options.namespace || 'semantic-rdf-store',
      enableDeduplication: options.enableDeduplication !== false,
      enableProvenance: options.enableProvenance !== false,
      enableIndexing: options.enableIndexing !== false,
      
      // Semantic processing
      semanticHashEngine: options.semanticHashEngine || new SemanticHashEngine({
        casEnabled: true,
        casNamespace: options.namespace || 'semantic-rdf-store'
      }),
      
      // Performance options
      enableCaching: options.enableCaching !== false,
      maxCacheSize: options.maxCacheSize || 5000,
      batchSize: options.batchSize || 100,
      
      // Storage optimization
      enableMerkleTree: options.enableMerkleTree !== false,
      merkleThreshold: options.merkleThreshold || 1000, // Quads threshold for Merkle tree
      compressionLevel: options.compressionLevel || 1,
      
      ...options
    };
    
    // Initialize semantic hash engine
    this.hashEngine = this.config.semanticHashEngine;
    
    // Storage indexes
    this.semanticIndex = new Map(); // semantic hash -> CID mapping
    this.syntacticIndex = new Map(); // syntactic hash -> CID mapping
    this.cidIndex = new Map(); // CID -> metadata mapping
    this.provenanceIndex = new Map(); // semantic hash -> provenance chain
    this.merkleIndex = new Map(); // Merkle root -> leaf CIDs
    
    // Caches
    this.contentCache = new Map();
    this.metadataCache = new Map();
    
    // Statistics
    this.stats = {
      itemsStored: 0,
      itemsRetrieved: 0,
      deduplicationSaves: 0,
      cacheHits: 0,
      cacheMisses: 0,
      merkleTreesCreated: 0,
      provenanceEntriesCreated: 0,
      semanticQueries: 0,
      syntacticQueries: 0
    };
  }

  /**
   * Store RDF content with semantic addressing
   * @param {string|Array} rdfContent - RDF content or parsed quads
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result with CIDs and metadata
   */
  async store(rdfContent, options = {}) {
    const startTime = performance.now();
    
    try {
      // Calculate semantic and syntactic hashes
      const hashResult = await this.hashEngine.calculateBothHashes(rdfContent, options);
      
      const semanticHash = hashResult.semantic.semanticHash;
      const syntacticHash = hashResult.syntactic.syntacticHash;
      
      // Check for existing content (deduplication)
      if (this.config.enableDeduplication) {
        const existingSemanticCID = this.semanticIndex.get(semanticHash);
        const existingSyntacticCID = this.syntacticIndex.get(syntacticHash);
        
        if (existingSemanticCID || existingSyntacticCID) {
          this.stats.deduplicationSaves++;
          
          const metadata = this.cidIndex.get(existingSemanticCID || existingSyntacticCID);
          return {
            deduplicated: true,
            semanticCID: existingSemanticCID,
            syntacticCID: existingSyntacticCID,
            semanticHash,
            syntacticHash,
            metadata,
            processingTime: performance.now() - startTime
          };
        }
      }
      
      // Store semantic content (canonical form)
      const semanticCID = await cas.store(hashResult.semantic.canonical, {
        algorithm: 'sha256',
        namespace: `${this.config.namespace}-semantic`
      });
      
      // Store syntactic content (original form)
      const syntacticContent = typeof rdfContent === 'string' ? 
        rdfContent : hashResult.syntactic.rawContent;
      
      const syntacticCID = await cas.store(syntacticContent, {
        algorithm: 'sha256', 
        namespace: `${this.config.namespace}-syntactic`
      });
      
      // Store canonical JSON if available
      let jsonCID = null;
      if (hashResult.semantic.canonicalJson) {
        jsonCID = await cas.store(hashResult.semantic.canonicalJson, {
          algorithm: 'sha256',
          namespace: `${this.config.namespace}-json`
        });
      }
      
      // Create storage metadata
      const metadata = {
        timestamp: this.getDeterministicDate().toISOString(),
        semanticHash,
        syntacticHash,
        semanticCID: semanticCID.toString(),
        syntacticCID: syntacticCID.toString(),
        jsonCID: jsonCID?.toString(),
        quadCount: hashResult.semantic.metadata.quadCount,
        contentLength: syntacticContent.length,
        canonicalLength: hashResult.semantic.canonical.length,
        differentiation: hashResult.differentiation,
        storageOptions: options,
        processingTime: performance.now() - startTime
      };
      
      // Update indexes
      this.semanticIndex.set(semanticHash, semanticCID.toString());
      this.syntacticIndex.set(syntacticHash, syntacticCID.toString());
      this.cidIndex.set(semanticCID.toString(), metadata);
      this.cidIndex.set(syntacticCID.toString(), metadata);
      
      // Handle provenance if enabled
      if (this.config.enableProvenance) {
        await this._recordProvenance(semanticHash, metadata, options);
      }
      
      // Handle Merkle tree if content is large enough
      if (this.config.enableMerkleTree && 
          hashResult.semantic.metadata.quadCount >= this.config.merkleThreshold) {
        await this._createMerkleTree(hashResult.semantic, metadata);
      }
      
      this.stats.itemsStored++;
      
      const result = {
        success: true,
        semanticCID: semanticCID.toString(),
        syntacticCID: syntacticCID.toString(),
        jsonCID: jsonCID?.toString(),
        semanticHash,
        syntacticHash,
        metadata,
        deduplicated: false
      };
      
      this.emit('content-stored', result);
      return result;
      
    } catch (error) {
      this.emit('error', { operation: 'store', error: error.message });
      throw new Error(`Content storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve content by semantic hash
   * @param {string} semanticHash - Semantic hash of content
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved content and metadata
   */
  async retrieveBySemantic(semanticHash, options = {}) {
    const startTime = performance.now();
    this.stats.semanticQueries++;
    
    try {
      // Check cache first
      if (this.config.enableCaching && this.contentCache.has(semanticHash)) {
        this.stats.cacheHits++;
        return this.contentCache.get(semanticHash);
      }
      
      this.stats.cacheMisses++;
      
      // Get CID from semantic index
      const cid = this.semanticIndex.get(semanticHash);
      if (!cid) {
        throw new Error(`Content not found for semantic hash: ${semanticHash}`);
      }
      
      // Retrieve content from CAS
      const content = await cas.retrieve(cid);
      if (!content) {
        throw new Error(`Content not found in CAS for CID: ${cid}`);
      }
      
      // Get metadata
      const metadata = this.cidIndex.get(cid);
      
      // Get provenance if available
      let provenance = null;
      if (this.config.enableProvenance && this.provenanceIndex.has(semanticHash)) {
        provenance = this.provenanceIndex.get(semanticHash);
      }
      
      const result = {
        content: new TextDecoder().decode(content),
        metadata,
        provenance,
        cid,
        retrievalTime: performance.now() - startTime,
        type: 'semantic'
      };
      
      // Cache result
      if (this.config.enableCaching && this.contentCache.size < this.config.maxCacheSize) {
        this.contentCache.set(semanticHash, result);
      }
      
      this.stats.itemsRetrieved++;
      this.emit('content-retrieved', { semanticHash, type: 'semantic' });
      
      return result;
      
    } catch (error) {
      this.emit('error', { operation: 'retrieve-semantic', semanticHash, error: error.message });
      throw new Error(`Semantic retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve content by syntactic hash
   * @param {string} syntacticHash - Syntactic hash of content
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved content and metadata
   */
  async retrieveBySyntactic(syntacticHash, options = {}) {
    const startTime = performance.now();
    this.stats.syntacticQueries++;
    
    try {
      // Get CID from syntactic index
      const cid = this.syntacticIndex.get(syntacticHash);
      if (!cid) {
        throw new Error(`Content not found for syntactic hash: ${syntacticHash}`);
      }
      
      // Retrieve content from CAS
      const content = await cas.retrieve(cid);
      if (!content) {
        throw new Error(`Content not found in CAS for CID: ${cid}`);
      }
      
      // Get metadata
      const metadata = this.cidIndex.get(cid);
      
      const result = {
        content: new TextDecoder().decode(content),
        metadata,
        cid,
        retrievalTime: performance.now() - startTime,
        type: 'syntactic'
      };
      
      this.stats.itemsRetrieved++;
      this.emit('content-retrieved', { syntacticHash, type: 'syntactic' });
      
      return result;
      
    } catch (error) {
      this.emit('error', { operation: 'retrieve-syntactic', syntacticHash, error: error.message });
      throw new Error(`Syntactic retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve content by CID
   * @param {string} cid - Content identifier
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved content and metadata
   */
  async retrieveByCID(cid, options = {}) {
    const startTime = performance.now();
    
    try {
      // Retrieve content from CAS
      const content = await cas.retrieve(cid);
      if (!content) {
        throw new Error(`Content not found in CAS for CID: ${cid}`);
      }
      
      // Get metadata
      const metadata = this.cidIndex.get(cid);
      
      const result = {
        content: new TextDecoder().decode(content),
        metadata,
        cid,
        retrievalTime: performance.now() - startTime,
        type: 'cid'
      };
      
      this.stats.itemsRetrieved++;
      this.emit('content-retrieved', { cid, type: 'cid' });
      
      return result;
      
    } catch (error) {
      this.emit('error', { operation: 'retrieve-cid', cid, error: error.message });
      throw new Error(`CID retrieval failed: ${error.message}`);
    }
  }

  /**
   * Find semantically equivalent content
   * @param {string|Array} rdfContent - RDF content to find equivalents for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of equivalent content entries
   */
  async findSemanticEquivalents(rdfContent, options = {}) {
    try {
      // Calculate semantic hash of input content
      const semanticResult = await this.hashEngine.calculateSemanticHash(rdfContent, options);
      const semanticHash = semanticResult.semanticHash;
      
      // Find all content with same semantic hash
      const equivalents = [];
      
      for (const [hash, cid] of this.semanticIndex) {
        if (hash === semanticHash) {
          const metadata = this.cidIndex.get(cid);
          const content = await cas.retrieve(cid);
          
          equivalents.push({
            semanticHash: hash,
            cid,
            metadata,
            content: new TextDecoder().decode(content),
            equivalenceType: 'semantic'
          });
        }
      }
      
      return equivalents;
      
    } catch (error) {
      this.emit('error', { operation: 'find-equivalents', error: error.message });
      throw new Error(`Equivalence search failed: ${error.message}`);
    }
  }

  /**
   * Compare two stored contents semantically
   * @param {string} hash1 - First content semantic hash
   * @param {string} hash2 - Second content semantic hash
   * @returns {Promise<Object>} Comparison result
   */
  async compareStored(hash1, hash2) {
    try {
      const [content1, content2] = await Promise.all([
        this.retrieveBySemantic(hash1),
        this.retrieveBySemantic(hash2)
      ]);
      
      // Perform semantic comparison
      const comparison = await this.hashEngine.compareGraphs(
        content1.content, 
        content2.content
      );
      
      return {
        ...comparison,
        content1: content1.metadata,
        content2: content2.metadata
      };
      
    } catch (error) {
      this.emit('error', { operation: 'compare-stored', error: error.message });
      throw new Error(`Stored content comparison failed: ${error.message}`);
    }
  }

  /**
   * List all stored content with filtering options
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} Array of stored content metadata
   */
  async listContent(filters = {}) {
    try {
      const results = [];
      
      for (const [cid, metadata] of this.cidIndex) {
        // Apply filters
        if (filters.minQuadCount && metadata.quadCount < filters.minQuadCount) {
          continue;
        }
        
        if (filters.maxQuadCount && metadata.quadCount > filters.maxQuadCount) {
          continue;
        }
        
        if (filters.since && new Date(metadata.timestamp) < new Date(filters.since)) {
          continue;
        }
        
        if (filters.until && new Date(metadata.timestamp) > new Date(filters.until)) {
          continue;
        }
        
        results.push({
          cid,
          ...metadata,
          hasProvenance: this.provenanceIndex.has(metadata.semanticHash)
        });
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Limit results if requested
      if (filters.limit) {
        return results.slice(0, filters.limit);
      }
      
      return results;
      
    } catch (error) {
      this.emit('error', { operation: 'list-content', error: error.message });
      throw new Error(`Content listing failed: ${error.message}`);
    }
  }

  // Private methods

  async _recordProvenance(semanticHash, metadata, options) {
    try {
      const provenance = {
        semanticHash,
        timestamp: metadata.timestamp,
        operation: 'store',
        metadata: {
          quadCount: metadata.quadCount,
          contentLength: metadata.contentLength,
          processingTime: metadata.processingTime
        },
        options: options.provenanceOptions || {},
        previousHash: options.previousSemanticHash || null,
        changes: options.changes || null
      };
      
      // Get existing provenance chain
      const existingProvenance = this.provenanceIndex.get(semanticHash) || [];
      existingProvenance.push(provenance);
      
      this.provenanceIndex.set(semanticHash, existingProvenance);
      
      // Store provenance in CAS for persistence
      const provenanceCID = await cas.store(JSON.stringify(existingProvenance), {
        algorithm: 'sha256',
        namespace: `${this.config.namespace}-provenance`
      });
      
      this.stats.provenanceEntriesCreated++;
      
      return provenanceCID.toString();
      
    } catch (error) {
      console.warn('Provenance recording failed:', error.message);
      return null;
    }
  }

  async _createMerkleTree(semanticResult, metadata) {
    try {
      // This is a simplified Merkle tree implementation
      // In production, you'd want a more sophisticated approach
      
      const quads = semanticResult.canonical.split('\n').filter(line => line.trim());
      const chunks = [];
      
      // Split into chunks
      for (let i = 0; i < quads.length; i += this.config.batchSize) {
        const chunk = quads.slice(i, i + this.config.batchSize).join('\n');
        const chunkCID = await cas.store(chunk, {
          algorithm: 'sha256',
          namespace: `${this.config.namespace}-merkle-leaf`
        });
        chunks.push(chunkCID.toString());
      }
      
      // Create Merkle root
      const merkleRoot = await this._calculateMerkleRoot(chunks);
      
      // Store mapping
      this.merkleIndex.set(merkleRoot, chunks);
      
      this.stats.merkleTreesCreated++;
      
      return merkleRoot;
      
    } catch (error) {
      console.warn('Merkle tree creation failed:', error.message);
      return null;
    }
  }

  async _calculateMerkleRoot(chunks) {
    if (chunks.length === 1) {
      return chunks[0];
    }
    
    const nextLevel = [];
    
    for (let i = 0; i < chunks.length; i += 2) {
      const left = chunks[i];
      const right = chunks[i + 1] || chunks[i]; // Handle odd number
      
      const combined = `${left}|${right}`;
      const combinedCID = await cas.store(combined, {
        algorithm: 'sha256',
        namespace: `${this.config.namespace}-merkle-node`
      });
      
      nextLevel.push(combinedCID.toString());
    }
    
    return this._calculateMerkleRoot(nextLevel);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      indexes: {
        semantic: this.semanticIndex.size,
        syntactic: this.syntacticIndex.size,
        cid: this.cidIndex.size,
        provenance: this.provenanceIndex.size,
        merkle: this.merkleIndex.size
      },
      caches: {
        content: {
          size: this.contentCache.size,
          maxSize: this.config.maxCacheSize,
          hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
        },
        metadata: {
          size: this.metadataCache.size
        }
      },
      hashEngine: this.hashEngine.getStats()
    };
  }

  /**
   * Clear all caches and reset indexes
   */
  async clearCache() {
    this.contentCache.clear();
    this.metadataCache.clear();
    
    if (this.hashEngine.clearCaches) {
      this.hashEngine.clearCaches();
    }
    
    this.emit('cache-cleared');
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    await this.clearCache();
    
    if (this.hashEngine.shutdown) {
      await this.hashEngine.shutdown();
    }
    
    this.removeAllListeners();
    this.emit('shutdown');
  }
}

export default ContentAddressedSemanticStore;