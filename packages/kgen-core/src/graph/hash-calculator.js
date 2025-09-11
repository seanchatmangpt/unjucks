/**
 * Hash Calculator - Canonical SHA256 hashing for RDF graphs
 * 
 * Provides deterministic, canonical hash calculation for .ttl files
 * ensuring consistent hashing regardless of input order or formatting.
 */

import crypto from 'crypto';
import { Parser, Store, DataFactory } from 'n3';
import consola from 'consola';

const { namedNode, literal, defaultGraph } = DataFactory;

export class HashCalculator {
  constructor(config = {}) {
    this.config = {
      algorithm: 'sha256',
      encoding: 'hex',
      normalizeBlankNodes: true,
      sortTriples: true,
      ignoreGraphNames: false,
      ...config
    };
    
    this.logger = consola.withTag('hash-calculator');
    this.parser = new Parser();
  }

  /**
   * Calculate canonical hash for TTL file
   * @param {string} ttlContent - Turtle content
   * @param {Object} options - Hash options
   * @returns {Promise<Object>} Hash result with metadata
   */
  async calculateTTLHash(ttlContent, options = {}) {
    try {
      this.logger.debug('Calculating canonical hash for TTL content');
      
      const startTime = Date.now();
      const hashOptions = { ...this.config, ...options };
      
      // Parse TTL content
      const quads = await this._parseTTL(ttlContent);
      this.logger.debug(`Parsed ${quads.length} triples from TTL content`);
      
      // Normalize quads for canonical representation
      const normalizedQuads = this._normalizeQuads(quads, hashOptions);
      
      // Sort quads for deterministic ordering
      const sortedQuads = this._sortQuads(normalizedQuads, hashOptions);
      
      // Generate canonical string representation
      const canonicalString = this._generateCanonicalString(sortedQuads, hashOptions);
      
      // Calculate hash
      const hash = this._calculateHash(canonicalString, hashOptions);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        hash,
        algorithm: hashOptions.algorithm,
        encoding: hashOptions.encoding,
        metadata: {
          tripleCount: quads.length,
          normalizedTripleCount: sortedQuads.length,
          processingTime,
          canonicalLength: canonicalString.length,
          options: hashOptions
        },
        canonicalString: hashOptions.includeCanonical ? canonicalString : undefined
      };
      
      this.logger.success(`Hash calculated: ${hash} (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      this.logger.error('Failed to calculate TTL hash:', error);
      throw error;
    }
  }

  /**
   * Calculate hash for graph store
   * @param {Store} store - N3 Store instance
   * @param {Object} options - Hash options
   * @returns {Object} Hash result
   */
  calculateStoreHash(store, options = {}) {
    try {
      this.logger.debug('Calculating canonical hash for store');
      
      const startTime = Date.now();
      const hashOptions = { ...this.config, ...options };
      
      // Get all quads from store
      const quads = store.getQuads();
      this.logger.debug(`Retrieved ${quads.length} quads from store`);
      
      // Normalize and process quads
      const normalizedQuads = this._normalizeQuads(quads, hashOptions);
      const sortedQuads = this._sortQuads(normalizedQuads, hashOptions);
      const canonicalString = this._generateCanonicalString(sortedQuads, hashOptions);
      const hash = this._calculateHash(canonicalString, hashOptions);
      
      const processingTime = Date.now() - startTime;
      
      return {
        hash,
        algorithm: hashOptions.algorithm,
        encoding: hashOptions.encoding,
        metadata: {
          tripleCount: quads.length,
          normalizedTripleCount: sortedQuads.length,
          processingTime,
          canonicalLength: canonicalString.length,
          options: hashOptions
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate store hash:', error);
      throw error;
    }
  }

  /**
   * Compare two TTL files by hash
   * @param {string} ttl1 - First TTL content
   * @param {string} ttl2 - Second TTL content
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison result
   */
  async compareTTLHashes(ttl1, ttl2, options = {}) {
    try {
      this.logger.debug('Comparing TTL hashes');
      
      const [hash1Result, hash2Result] = await Promise.all([
        this.calculateTTLHash(ttl1, options),
        this.calculateTTLHash(ttl2, options)
      ]);
      
      const isEqual = hash1Result.hash === hash2Result.hash;
      
      const comparison = {
        isEqual,
        hash1: hash1Result.hash,
        hash2: hash2Result.hash,
        metadata1: hash1Result.metadata,
        metadata2: hash2Result.metadata,
        differences: isEqual ? [] : await this._analyzeDifferences(ttl1, ttl2, options)
      };
      
      this.logger.info(`Hash comparison: ${isEqual ? 'EQUAL' : 'DIFFERENT'}`);
      return comparison;
      
    } catch (error) {
      this.logger.error('Failed to compare TTL hashes:', error);
      throw error;
    }
  }

  /**
   * Generate hash for specific subjects
   * @param {string} ttlContent - TTL content
   * @param {Array<string>} subjects - Subject URIs to hash
   * @param {Object} options - Hash options
   * @returns {Promise<Object>} Subject hash result
   */
  async calculateSubjectHash(ttlContent, subjects, options = {}) {
    try {
      this.logger.debug(`Calculating hash for ${subjects.length} subjects`);
      
      const quads = await this._parseTTL(ttlContent);
      const subjectSet = new Set(subjects);
      
      // Filter quads by subjects
      const subjectQuads = quads.filter(quad => 
        subjectSet.has(quad.subject.value)
      );
      
      this.logger.debug(`Filtered to ${subjectQuads.length} quads for specified subjects`);
      
      // Process filtered quads
      const normalizedQuads = this._normalizeQuads(subjectQuads, options);
      const sortedQuads = this._sortQuads(normalizedQuads, options);
      const canonicalString = this._generateCanonicalString(sortedQuads, options);
      const hash = this._calculateHash(canonicalString, options);
      
      return {
        hash,
        subjects,
        metadata: {
          totalTriples: quads.length,
          subjectTriples: subjectQuads.length,
          normalizedTriples: sortedQuads.length,
          canonicalLength: canonicalString.length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate subject hash:', error);
      throw error;
    }
  }

  /**
   * Validate hash integrity
   * @param {string} ttlContent - TTL content
   * @param {string} expectedHash - Expected hash value
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateHash(ttlContent, expectedHash, options = {}) {
    try {
      this.logger.debug(`Validating hash against expected: ${expectedHash}`);
      
      const hashResult = await this.calculateTTLHash(ttlContent, options);
      const isValid = hashResult.hash === expectedHash;
      
      const validation = {
        isValid,
        expectedHash,
        actualHash: hashResult.hash,
        metadata: hashResult.metadata,
        validatedAt: new Date().toISOString()
      };
      
      this.logger.info(`Hash validation: ${isValid ? 'VALID' : 'INVALID'}`);
      return validation;
      
    } catch (error) {
      this.logger.error('Hash validation failed:', error);
      throw error;
    }
  }

  // Private methods

  async _parseTTL(ttlContent) {
    return new Promise((resolve, reject) => {
      const quads = [];
      
      this.parser.parse(ttlContent, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  _normalizeQuads(quads, options) {
    let normalizedQuads = [...quads];
    
    // Normalize blank nodes if enabled
    if (options.normalizeBlankNodes) {
      normalizedQuads = this._normalizeBlankNodes(normalizedQuads);
    }
    
    // Ignore graph names if specified
    if (options.ignoreGraphNames) {
      normalizedQuads = normalizedQuads.map(quad => ({
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
        graph: defaultGraph()
      }));
    }
    
    return normalizedQuads;
  }

  _normalizeBlankNodes(quads) {
    // Create deterministic mapping for blank nodes
    const blankNodeMap = new Map();
    let blankNodeCounter = 0;
    
    const getBlankNodeId = (originalId) => {
      if (!blankNodeMap.has(originalId)) {
        blankNodeMap.set(originalId, `_:b${blankNodeCounter++}`);
      }
      return blankNodeMap.get(originalId);
    };
    
    return quads.map(quad => {
      const normalizedQuad = { ...quad };
      
      // Normalize subject if blank node
      if (quad.subject.termType === 'BlankNode') {
        normalizedQuad.subject = {
          ...quad.subject,
          value: getBlankNodeId(quad.subject.value)
        };
      }
      
      // Normalize object if blank node
      if (quad.object.termType === 'BlankNode') {
        normalizedQuad.object = {
          ...quad.object,
          value: getBlankNodeId(quad.object.value)
        };
      }
      
      return normalizedQuad;
    });
  }

  _sortQuads(quads, options) {
    if (!options.sortTriples) {
      return quads;
    }
    
    return quads.sort((a, b) => {
      // Sort by subject, then predicate, then object, then graph
      const subjectCompare = this._compareTerms(a.subject, b.subject);
      if (subjectCompare !== 0) return subjectCompare;
      
      const predicateCompare = this._compareTerms(a.predicate, b.predicate);
      if (predicateCompare !== 0) return predicateCompare;
      
      const objectCompare = this._compareTerms(a.object, b.object);
      if (objectCompare !== 0) return objectCompare;
      
      return this._compareTerms(a.graph, b.graph);
    });
  }

  _compareTerms(term1, term2) {
    // Compare by term type first
    if (term1.termType !== term2.termType) {
      const typeOrder = ['NamedNode', 'BlankNode', 'Literal', 'Variable', 'DefaultGraph'];
      return typeOrder.indexOf(term1.termType) - typeOrder.indexOf(term2.termType);
    }
    
    // Compare by value
    if (term1.value !== term2.value) {
      return term1.value < term2.value ? -1 : 1;
    }
    
    // For literals, compare by datatype and language
    if (term1.termType === 'Literal') {
      if (term1.datatype !== term2.datatype) {
        return (term1.datatype?.value || '') < (term2.datatype?.value || '') ? -1 : 1;
      }
      
      if (term1.language !== term2.language) {
        return (term1.language || '') < (term2.language || '') ? -1 : 1;
      }
    }
    
    return 0;
  }

  _generateCanonicalString(quads, options) {
    const lines = quads.map(quad => {
      const subject = this._termToString(quad.subject);
      const predicate = this._termToString(quad.predicate);
      const object = this._termToString(quad.object);
      
      if (options.ignoreGraphNames || quad.graph.equals(defaultGraph())) {
        return `${subject} ${predicate} ${object} .`;
      } else {
        const graph = this._termToString(quad.graph);
        return `${subject} ${predicate} ${object} ${graph} .`;
      }
    });
    
    return lines.join('\n');
  }

  _termToString(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return term.value;
      case 'Literal':
        let result = `"${term.value.replace(/["\\]/g, '\\$&')}"`;
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        return result;
      case 'DefaultGraph':
        return '';
      default:
        return term.value;
    }
  }

  _calculateHash(canonicalString, options) {
    const hash = crypto.createHash(options.algorithm);
    hash.update(canonicalString, 'utf8');
    return hash.digest(options.encoding);
  }

  async _analyzeDifferences(ttl1, ttl2, options) {
    try {
      // Parse both TTL contents
      const [quads1, quads2] = await Promise.all([
        this._parseTTL(ttl1),
        this._parseTTL(ttl2)
      ]);
      
      // Create sets for comparison
      const quadStrings1 = new Set(quads1.map(q => this._quadToString(q)));
      const quadStrings2 = new Set(quads2.map(q => this._quadToString(q)));
      
      // Find differences
      const onlyIn1 = [...quadStrings1].filter(q => !quadStrings2.has(q));
      const onlyIn2 = [...quadStrings2].filter(q => !quadStrings1.has(q));
      
      return {
        addedTriples: onlyIn2.length,
        removedTriples: onlyIn1.length,
        totalTriples1: quads1.length,
        totalTriples2: quads2.length,
        added: onlyIn2,
        removed: onlyIn1
      };
      
    } catch (error) {
      this.logger.warn('Could not analyze differences:', error);
      return {
        addedTriples: 0,
        removedTriples: 0,
        totalTriples1: 0,
        totalTriples2: 0,
        added: [],
        removed: []
      };
    }
  }

  _quadToString(quad) {
    const subject = this._termToString(quad.subject);
    const predicate = this._termToString(quad.predicate);
    const object = this._termToString(quad.object);
    const graph = quad.graph.equals(defaultGraph()) ? '' : this._termToString(quad.graph);
    
    return graph ? `${subject} ${predicate} ${object} ${graph} .` : `${subject} ${predicate} ${object} .`;
  }
}

export default HashCalculator;