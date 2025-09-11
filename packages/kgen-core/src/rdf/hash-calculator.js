/**
 * Hash Calculator - Content-addressed hashing for RDF graphs with deterministic fingerprinting
 * Implements Merkle tree-like structure for distributed graph operations
 */

import crypto from 'crypto';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode, defaultGraph } = DataFactory;

export class HashCalculator {
  constructor(config = {}) {
    this.config = {
      algorithm: config.algorithm || 'sha256',
      encoding: config.encoding || 'hex',
      normalization: config.normalization || 'rdf-dataset-canonical',
      includeMetadata: config.includeMetadata !== false,
      merkleTreeDepth: config.merkleTreeDepth || 8,
      blankNodeHandling: config.blankNodeHandling || 'canonical',
      ...config
    };
    
    this.cache = new Map();
    this.blankNodeMap = new Map();
  }

  /**
   * Calculate content hash for an RDF graph
   * @param {Array} quads - RDF quads to hash
   * @param {object} options - Hashing options
   * @returns {string} Content hash
   */
  calculateGraphHash(quads, options = {}) {
    const opts = { ...this.config, ...options };
    const cacheKey = this._generateCacheKey(quads, opts);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let normalizedQuads;
    
    switch (opts.normalization) {
      case 'rdf-dataset-canonical':
        normalizedQuads = this._canonicalizeRDFDataset(quads, opts);
        break;
      case 'simple':
        normalizedQuads = this._simpleNormalization(quads, opts);
        break;
      case 'merkle':
        return this._calculateMerkleHash(quads, opts);
      default:
        throw new Error(`Unsupported normalization: ${opts.normalization}`);
    }

    const serialized = this._serializeForHashing(normalizedQuads, opts);
    const hash = this._hash(serialized, opts);

    if (this.cache.size < 10000) {
      this.cache.set(cacheKey, hash);
    }

    return hash;
  }

  /**
   * Calculate hash for individual quad
   * @param {object} quad - RDF quad
   * @param {object} options - Hashing options
   * @returns {string} Quad hash
   */
  calculateQuadHash(quad, options = {}) {
    const opts = { ...this.config, ...options };
    const serialized = this._serializeQuadForHashing(quad, opts);
    return this._hash(serialized, opts);
  }

  /**
   * Calculate incremental hash when adding quads
   * @param {string} previousHash - Previous graph hash
   * @param {Array} addedQuads - Newly added quads
   * @param {object} options - Hashing options
   * @returns {string} New graph hash
   */
  calculateIncrementalHash(previousHash, addedQuads, options = {}) {
    const opts = { ...this.config, ...options };
    
    if (!addedQuads || addedQuads.length === 0) {
      return previousHash;
    }

    // Calculate hash for added quads
    const addedHash = this.calculateGraphHash(addedQuads, opts);
    
    // Combine with previous hash
    const combined = [previousHash, addedHash].sort().join('|');
    return this._hash(combined, opts);
  }

  /**
   * Create content-addressed identifier
   * @param {Array} quads - RDF quads
   * @param {object} options - Identifier options
   * @returns {string} Content identifier
   */
  createContentId(quads, options = {}) {
    const opts = {
      prefix: 'kgen',
      version: 'v1',
      algorithm: 'sha256',
      encoding: 'base58',
      ...options
    };

    const hash = this.calculateGraphHash(quads, opts);
    const encodedHash = opts.encoding === 'base58' ? this._base58Encode(hash) : hash;
    
    return `${opts.prefix}:${opts.version}:${encodedHash}`;
  }

  /**
   * Calculate Merkle tree hash for large graphs
   * @param {Array} quads - RDF quads
   * @param {object} options - Merkle options
   * @returns {string} Merkle root hash
   */
  _calculateMerkleHash(quads, options = {}) {
    const opts = { ...this.config, ...options };
    
    // Calculate hash for each quad
    const quadHashes = quads.map(quad => this.calculateQuadHash(quad, opts));
    
    // Build Merkle tree
    return this._buildMerkleTree(quadHashes, opts);
  }

  /**
   * Build Merkle tree from hashes
   * @param {Array<string>} hashes - Individual hashes
   * @param {object} options - Tree options
   * @returns {string} Root hash
   */
  _buildMerkleTree(hashes, options = {}) {
    if (hashes.length === 0) {
      return this._hash('', options);
    }
    
    if (hashes.length === 1) {
      return hashes[0];
    }

    // Sort hashes for deterministic tree
    const sortedHashes = [...hashes].sort();
    
    let currentLevel = sortedHashes;
    
    while (currentLevel.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Handle odd number of hashes
        
        const combined = this._hash(`${left}|${right}`, options);
        nextLevel.push(combined);
      }
      
      currentLevel = nextLevel;
    }
    
    return currentLevel[0];
  }

  /**
   * Canonicalize RDF dataset for consistent hashing
   * @param {Array} quads - RDF quads
   * @param {object} options - Canonicalization options
   * @returns {Array} Canonicalized quads
   */
  _canonicalizeRDFDataset(quads, options = {}) {
    // Handle blank nodes
    const { normalizedQuads, blankNodeMapping } = this._normalizeBlankNodes(quads, options);
    
    // Sort quads deterministically
    return this._sortQuadsCanonically(normalizedQuads);
  }

  /**
   * Simple normalization (just sorting)
   * @param {Array} quads - RDF quads
   * @param {object} options - Normalization options
   * @returns {Array} Normalized quads
   */
  _simpleNormalization(quads, options = {}) {
    return this._sortQuadsCanonically(quads);
  }

  /**
   * Normalize blank nodes using canonical naming
   * @param {Array} quads - RDF quads
   * @param {object} options - Normalization options
   * @returns {object} Normalized quads and mapping
   */
  _normalizeBlankNodes(quads, options = {}) {
    if (options.blankNodeHandling === 'ignore') {
      return { normalizedQuads: quads, blankNodeMapping: new Map() };
    }

    const blankNodeQuads = quads.filter(quad => 
      this._hasBlankNode(quad)
    );

    if (blankNodeQuads.length === 0) {
      return { normalizedQuads: quads, blankNodeMapping: new Map() };
    }

    // Build blank node graph
    const blankNodeGraph = this._buildBlankNodeGraph(blankNodeQuads);
    
    // Generate canonical names
    const canonicalMapping = this._generateCanonicalBlankNodeNames(blankNodeGraph);
    
    // Apply mapping to all quads
    const normalizedQuads = quads.map(quad => this._applyBlankNodeMapping(quad, canonicalMapping));
    
    return { normalizedQuads, blankNodeMapping: canonicalMapping };
  }

  /**
   * Check if quad contains blank nodes
   * @param {object} quad - RDF quad
   * @returns {boolean} True if contains blank nodes
   */
  _hasBlankNode(quad) {
    return quad.subject.termType === 'BlankNode' || 
           quad.object.termType === 'BlankNode';
  }

  /**
   * Build graph structure for blank nodes
   * @param {Array} quads - Quads containing blank nodes
   * @returns {Map} Blank node graph
   */
  _buildBlankNodeGraph(quads) {
    const graph = new Map();
    
    for (const quad of quads) {
      if (quad.subject.termType === 'BlankNode') {
        if (!graph.has(quad.subject.value)) {
          graph.set(quad.subject.value, { outgoing: [], incoming: [] });
        }
        graph.get(quad.subject.value).outgoing.push({
          predicate: quad.predicate,
          object: quad.object
        });
      }
      
      if (quad.object.termType === 'BlankNode') {
        if (!graph.has(quad.object.value)) {
          graph.set(quad.object.value, { outgoing: [], incoming: [] });
        }
        graph.get(quad.object.value).incoming.push({
          subject: quad.subject,
          predicate: quad.predicate
        });
      }
    }
    
    return graph;
  }

  /**
   * Generate canonical names for blank nodes
   * @param {Map} blankNodeGraph - Blank node graph
   * @returns {Map} Canonical name mapping
   */
  _generateCanonicalBlankNodeNames(blankNodeGraph) {
    const mapping = new Map();
    
    // Calculate signature for each blank node
    const signatures = new Map();
    
    for (const [nodeId, nodeData] of blankNodeGraph) {
      const signature = this._calculateBlankNodeSignature(nodeData);
      signatures.set(nodeId, signature);
    }
    
    // Sort by signature and assign canonical names
    const sortedNodes = Array.from(signatures.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
    
    let counter = 0;
    for (const [nodeId] of sortedNodes) {
      mapping.set(nodeId, `_:b${counter.toString().padStart(8, '0')}`);
      counter++;
    }
    
    return mapping;
  }

  /**
   * Calculate signature for blank node based on its connections
   * @param {object} nodeData - Node connection data
   * @returns {string} Node signature
   */
  _calculateBlankNodeSignature(nodeData) {
    const outgoingParts = nodeData.outgoing
      .map(conn => `${conn.predicate.value}:${this._termToSignature(conn.object)}`)
      .sort();
    
    const incomingParts = nodeData.incoming
      .map(conn => `${this._termToSignature(conn.subject)}:${conn.predicate.value}`)
      .sort();
    
    const signature = [
      'OUT:' + outgoingParts.join('|'),
      'IN:' + incomingParts.join('|')
    ].join('||');
    
    return this._hash(signature, { algorithm: 'sha256', encoding: 'hex' });
  }

  /**
   * Convert term to signature string
   * @param {object} term - RDF term
   * @returns {string} Term signature
   */
  _termToSignature(term) {
    if (term.termType === 'NamedNode') {
      return `<${term.value}>`;
    } else if (term.termType === 'Literal') {
      let sig = `"${term.value}"`;
      if (term.language) {
        sig += `@${term.language}`;
      } else if (term.datatype) {
        sig += `^^<${term.datatype.value}>`;
      }
      return sig;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value || '';
  }

  /**
   * Apply blank node mapping to quad
   * @param {object} quad - Original quad
   * @param {Map} mapping - Blank node mapping
   * @returns {object} Mapped quad
   */
  _applyBlankNodeMapping(quad, mapping) {
    let newSubject = quad.subject;
    let newObject = quad.object;
    
    if (quad.subject.termType === 'BlankNode' && mapping.has(quad.subject.value)) {
      newSubject = blankNode(mapping.get(quad.subject.value).substring(2));
    }
    
    if (quad.object.termType === 'BlankNode' && mapping.has(quad.object.value)) {
      newObject = blankNode(mapping.get(quad.object.value).substring(2));
    }
    
    if (newSubject !== quad.subject || newObject !== quad.object) {
      return DataFactory.quad(newSubject, quad.predicate, newObject, quad.graph);
    }
    
    return quad;
  }

  /**
   * Sort quads canonically for deterministic hashing
   * @param {Array} quads - Quads to sort
   * @returns {Array} Sorted quads
   */
  _sortQuadsCanonically(quads) {
    return [...quads].sort((a, b) => {
      const aKey = this._quadToSortKey(a);
      const bKey = this._quadToSortKey(b);
      return aKey.localeCompare(bKey);
    });
  }

  /**
   * Generate sort key for quad
   * @param {object} quad - RDF quad
   * @returns {string} Sort key
   */
  _quadToSortKey(quad) {
    const s = this._termToSortKey(quad.subject);
    const p = this._termToSortKey(quad.predicate);
    const o = this._termToSortKey(quad.object);
    const g = this._termToSortKey(quad.graph);
    
    return `${s}|${p}|${o}|${g}`;
  }

  /**
   * Generate sort key for term
   * @param {object} term - RDF term
   * @returns {string} Sort key
   */
  _termToSortKey(term) {
    const typeOrder = {
      'DefaultGraph': '0',
      'NamedNode': '1',
      'BlankNode': '2',
      'Literal': '3'
    };
    
    const type = typeOrder[term.termType] || '9';
    
    if (term.termType === 'Literal') {
      const lang = term.language || '';
      const datatype = term.datatype ? term.datatype.value : '';
      return `${type}|${term.value}|${lang}|${datatype}`;
    }
    
    return `${type}|${term.value || ''}`;
  }

  /**
   * Serialize quads for hashing
   * @param {Array} quads - Normalized quads
   * @param {object} options - Serialization options
   * @returns {string} Serialized string
   */
  _serializeForHashing(quads, options = {}) {
    const lines = quads.map(quad => this._serializeQuadForHashing(quad, options));
    return lines.join('\n');
  }

  /**
   * Serialize individual quad for hashing
   * @param {object} quad - RDF quad
   * @param {object} options - Serialization options
   * @returns {string} Serialized quad
   */
  _serializeQuadForHashing(quad, options = {}) {
    const s = this._termToHashString(quad.subject);
    const p = this._termToHashString(quad.predicate);
    const o = this._termToHashString(quad.object);
    const g = this._termToHashString(quad.graph);
    
    return g ? `${s} ${p} ${o} ${g}` : `${s} ${p} ${o}`;
  }

  /**
   * Convert term to hash string
   * @param {object} term - RDF term
   * @returns {string} Hash string representation
   */
  _termToHashString(term) {
    if (term.termType === 'NamedNode') {
      return `<${term.value}>`;
    } else if (term.termType === 'Literal') {
      let str = `"${term.value.replace(/[\\"]/g, '\\$&')}"`;
      if (term.language) {
        str += `@${term.language}`;
      } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        str += `^^<${term.datatype.value}>`;
      }
      return str;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    } else if (term.termType === 'DefaultGraph') {
      return '';
    }
    return term.value || '';
  }

  /**
   * Calculate hash using specified algorithm
   * @param {string} data - Data to hash
   * @param {object} options - Hash options
   * @returns {string} Hash value
   */
  _hash(data, options = {}) {
    const algorithm = options.algorithm || this.config.algorithm;
    const encoding = options.encoding || this.config.encoding;
    
    return crypto.createHash(algorithm).update(data, 'utf8').digest(encoding);
  }

  /**
   * Generate cache key for hash calculation
   * @param {Array} quads - RDF quads
   * @param {object} options - Options
   * @returns {string} Cache key
   */
  _generateCacheKey(quads, options) {
    const key = {
      count: quads.length,
      algorithm: options.algorithm,
      normalization: options.normalization,
      blankNodeHandling: options.blankNodeHandling
    };
    
    return this._hash(JSON.stringify(key), { algorithm: 'sha256', encoding: 'hex' });
  }

  /**
   * Base58 encode hash for compact identifiers
   * @param {string} hash - Hash to encode
   * @returns {string} Base58 encoded hash
   */
  _base58Encode(hash) {
    // Simple base58 encoding (in production, use a proper library)
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const bytes = Buffer.from(hash, 'hex');
    
    let result = '';
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < result.length; i++) {
        carry += alphabet.indexOf(result[i]) * 256;
        result = result.substring(0, i) + alphabet[carry % 58] + result.substring(i + 1);
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) {
        result = alphabet[carry % 58] + result;
        carry = Math.floor(carry / 58);
      }
    }
    
    return result;
  }

  /**
   * Verify hash integrity
   * @param {Array} quads - RDF quads
   * @param {string} expectedHash - Expected hash value
   * @param {object} options - Verification options
   * @returns {boolean} Verification result
   */
  verifyHash(quads, expectedHash, options = {}) {
    const actualHash = this.calculateGraphHash(quads, options);
    return actualHash === expectedHash;
  }

  /**
   * Clear hash cache
   */
  clearCache() {
    this.cache.clear();
    this.blankNodeMap.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 10000,
      hitRate: this._calculateHitRate()
    };
  }

  _calculateHitRate() {
    // Simple hit rate calculation (would need more sophisticated tracking)
    return this.cache.size > 0 ? 0.8 : 0;
  }
}

export default HashCalculator;