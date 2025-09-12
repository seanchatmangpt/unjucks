/**
 * Core RDF Graph Processor - Extracted and refactored from kgen RDF implementation
 * Handles RDF parsing, querying, and graph operations with N3.js
 */

import { Parser, Store, DataFactory, Util } from 'n3';
import { EventEmitter } from 'events';
import crypto from 'crypto';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class GraphProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxTriples: 1000000,
      enableCaching: true,
      cacheSize: 50000,
      ...config
    };
    
    this.store = new Store();
    this.parser = new Parser(config.parser);
    this.cache = new Map();
    
    this.metrics = {
      triplesProcessed: 0,
      queriesExecuted: 0,
      parseErrors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.status = 'initialized';
  }

  /**
   * Parse RDF data from various formats
   * @param {string} data - RDF data to parse
   * @param {string} format - RDF format (turtle, ntriples, etc.)
   * @param {object} options - Parsing options
   * @returns {Promise<object>} Parsed result with quads and metadata
   */
  async parseRDF(data, format = 'turtle', options = {}) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const quads = [];
      const parser = new Parser({ 
        format,
        ...this.config.parser,
        ...options
      });

      parser.parse(data, (error, quad, prefixes) => {
        if (error) {
          this.metrics.parseErrors++;
          return reject(new Error(`RDF Parse Error: ${error.message}`));
        }
        
        if (quad) {
          quads.push(quad);
          this.metrics.triplesProcessed++;
        } else {
          // Parsing complete
          const parseTime = Date.now() - startTime;
          
          resolve({
            quads,
            count: quads.length,
            prefixes: prefixes || {},
            format,
            parseTime,
            stats: this._generateStats(quads)
          });
        }
      });
    });
  }

  /**
   * Add quads to the graph store
   * @param {Array} quads - Quads to add
   * @param {string} graph - Optional named graph
   * @returns {number} Number of quads added
   */
  addQuads(quads, graph = null) {
    if (!Array.isArray(quads)) {
      quads = [quads];
    }

    const targetGraph = graph ? namedNode(graph) : defaultGraph();
    let addedCount = 0;
    
    for (const quad of quads) {
      const newQuad = graph && quad.graph.equals(defaultGraph()) 
        ? DataFactory.quad(quad.subject, quad.predicate, quad.object, targetGraph)
        : quad;
      
      this.store.addQuad(newQuad);
      addedCount++;
    }

    this.emit('quads-added', { count: addedCount, graph });
    return addedCount;
  }

  /**
   * Remove quads from the graph store
   * @param {Array} quads - Quads to remove
   * @returns {number} Number of quads removed
   */
  removeQuads(quads) {
    if (!Array.isArray(quads)) {
      quads = [quads];
    }

    let removedCount = 0;
    for (const quad of quads) {
      if (this.store.removeQuad(quad)) {
        removedCount++;
      }
    }

    this.emit('quads-removed', { count: removedCount });
    return removedCount;
  }

  /**
   * Query the graph store with pattern matching
   * @param {object} pattern - Query pattern { subject, predicate, object, graph }
   * @param {object} options - Query options
   * @returns {Array} Matching quads
   */
  query(pattern = {}, options = {}) {
    const cacheKey = this._generateCacheKey(pattern);
    
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.get(cacheKey);
    }

    this.metrics.queriesExecuted++;
    this.metrics.cacheMisses++;

    const results = this.store.getQuads(
      pattern.subject ? this._termFromValue(pattern.subject) : null,
      pattern.predicate ? this._termFromValue(pattern.predicate) : null,
      pattern.object ? this._termFromValue(pattern.object) : null,
      pattern.graph ? this._termFromValue(pattern.graph) : null
    );

    // Apply limit if specified
    const limitedResults = options.limit ? results.slice(0, options.limit) : results;

    if (this.config.enableCaching && this.cache.size < this.config.cacheSize) {
      this.cache.set(cacheKey, limitedResults);
    }

    return limitedResults;
  }

  /**
   * Find all subjects in the graph
   * @param {object} options - Query options
   * @returns {Array} Unique subjects
   */
  getSubjects(options = {}) {
    const subjects = new Set();
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      subjects.add(quad.subject);
    }

    return Array.from(subjects);
  }

  /**
   * Find all predicates in the graph
   * @param {object} options - Query options
   * @returns {Array} Unique predicates
   */
  getPredicates(options = {}) {
    const predicates = new Set();
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      predicates.add(quad.predicate);
    }

    return Array.from(predicates);
  }

  /**
   * Find all objects in the graph
   * @param {object} options - Query options
   * @returns {Array} Unique objects
   */
  getObjects(options = {}) {
    const objects = new Set();
    const quads = this.store.getQuads();
    
    for (const quad of quads) {
      objects.add(quad.object);
    }

    return Array.from(objects);
  }

  /**
   * Get all named graphs
   * @returns {Array} Named graph URIs
   */
  getGraphs() {
    return this.store.getGraphs();
  }

  /**
   * Calculate deterministic content hash for reproducible graph fingerprinting
   * Uses canonical N-Triples format for consistent hashing
   * @param {object} options - Hashing options
   * @returns {string} Deterministic content hash
   */
  calculateContentHash(options = {}) {
    const algorithm = options.algorithm || 'sha256';
    
    // Get all quads and convert to canonical N-Triples
    const quads = this.store.getQuads();
    const canonicalTriples = this._toCanonicalNTriples(quads);
    
    // Sort triples deterministically for consistent hashing
    canonicalTriples.sort();
    
    // Generate hash from canonical representation
    const content = canonicalTriples.join('\n');
    const hash = crypto.createHash(algorithm).update(content, 'utf8').digest('hex');
    
    this.emit('hash-calculated', { algorithm, tripleCount: canonicalTriples.length, hash });
    return hash;
  }

  /**
   * Convert quads to canonical N-Triples format for deterministic processing
   * @param {Array} quads - Quads to convert
   * @returns {Array} Canonical N-Triples strings
   */
  _toCanonicalNTriples(quads) {
    const triples = [];
    
    for (const quad of quads) {
      // Convert each quad component to canonical N-Triples format
      const subject = this._termToNTriples(quad.subject);
      const predicate = this._termToNTriples(quad.predicate);
      const object = this._termToNTriples(quad.object);
      
      // Only include named graph if not default graph
      const graphPart = quad.graph && !quad.graph.equals(defaultGraph()) 
        ? ` ${this._termToNTriples(quad.graph)}` 
        : '';
      
      triples.push(`${subject} ${predicate} ${object}${graphPart} .`);
    }
    
    return triples;
  }

  /**
   * Convert RDF term to canonical N-Triples format
   * @param {object} term - RDF term
   * @returns {string} N-Triples representation
   */
  _termToNTriples(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        let result = `"${term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        return result;
      case 'DefaultGraph':
        return '';
      default:
        throw new Error(`Unknown term type: ${term.termType}`);
    }
  }

  /**
   * Create detailed graph diff between two states with impact analysis
   * @param {GraphProcessor} other - Other graph to compare
   * @param {object} options - Diff options
   * @returns {object} Comprehensive diff result with change analysis
   */
  diff(other, options = {}) {
    const startTime = Date.now();
    
    // Convert to canonical N-Triples for consistent comparison
    const thisTriples = new Set(this._toCanonicalNTriples(this.store.getQuads()));
    const otherTriples = new Set(other._toCanonicalNTriples(other.store.getQuads()));
    
    // Calculate changes
    const added = [...otherTriples].filter(t => !thisTriples.has(t));
    const removed = [...thisTriples].filter(t => !otherTriples.has(t));
    const unchanged = [...thisTriples].filter(t => otherTriples.has(t));
    
    // Analyze impacted subjects for artifact mapping
    const impactedSubjects = this._analyzeImpactedSubjects(added, removed);
    
    // Calculate change metrics
    const totalOriginal = thisTriples.size;
    const totalNew = otherTriples.size;
    const changePercentage = totalOriginal > 0 ? 
      ((added.length + removed.length) / totalOriginal) * 100 : 0;
    
    const diff = {
      id: `diff_${Date.now()}`,
      timestamp: new Date().toISOString(),
      calculationTime: Date.now() - startTime,
      
      // Basic statistics
      changes: {
        added: added.length,
        removed: removed.length,
        modified: 0, // TODO: Implement modification detection
        unchanged: unchanged.length,
        total: added.length + removed.length
      },
      
      // Change metrics
      metrics: {
        originalSize: totalOriginal,
        newSize: totalNew,
        netChange: totalNew - totalOriginal,
        changePercentage: Math.round(changePercentage * 100) / 100,
        stability: unchanged.length / Math.max(totalOriginal, totalNew)
      },
      
      // Detailed change data
      triples: options.includeTriples !== false ? {
        added: added.slice(0, options.maxTriples || 1000),
        removed: removed.slice(0, options.maxTriples || 1000),
        addedCount: added.length,
        removedCount: removed.length
      } : null,
      
      // Subject-level impact analysis
      subjects: {
        impacted: Array.from(impactedSubjects),
        total: impactedSubjects.size
      },
      
      // Hash comparison
      hashes: {
        original: this.calculateContentHash(),
        new: other.calculateContentHash(),
        identical: this.calculateContentHash() === other.calculateContentHash()
      }
    };
    
    this.emit('diff-calculated', diff);
    return diff;
  }

  /**
   * Analyze subjects impacted by graph changes
   * @param {Array} addedTriples - Added N-Triples
   * @param {Array} removedTriples - Removed N-Triples  
   * @returns {Set} Set of impacted subject URIs
   */
  _analyzeImpactedSubjects(addedTriples, removedTriples) {
    const subjects = new Set();
    
    // Extract subjects from N-Triples format
    const extractSubject = (triple) => {
      const match = triple.match(/^(<[^>]+>|_:[^\s]+)/);
      return match ? match[1] : null;
    };
    
    // Process added triples
    for (const triple of addedTriples) {
      const subject = extractSubject(triple);
      if (subject) {
        subjects.add(subject);
      }
    }
    
    // Process removed triples
    for (const triple of removedTriples) {
      const subject = extractSubject(triple);
      if (subject) {
        subjects.add(subject);
      }
    }
    
    return subjects;
  }

  /**
   * Merge another graph into this one
   * @param {GraphProcessor} other - Other graph to merge
   * @param {object} options - Merge options
   * @returns {object} Merge result
   */
  merge(other, options = {}) {
    const otherQuads = other.store.getQuads();
    const addedCount = this.addQuads(otherQuads, options.targetGraph);
    
    return {
      merged: addedCount,
      totalQuads: this.store.size,
      source: other.store.size
    };
  }

  /**
   * Clear the graph store
   * @param {string} graph - Optional specific graph to clear
   */
  clear(graph = null) {
    if (graph) {
      const graphNode = namedNode(graph);
      const quads = this.store.getQuads(null, null, null, graphNode);
      this.store.removeQuads(quads);
    } else {
      this.store.removeQuads(this.store.getQuads());
    }
    
    this.cache.clear();
    this.emit('store-cleared', { graph });
  }

  /**
   * Get store statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      totalQuads: this.store.size,
      graphs: this.store.getGraphs().length,
      subjects: new Set(this.store.getSubjects()).size,
      predicates: new Set(this.store.getPredicates()).size,
      objects: new Set(this.store.getObjects()).size,
      cacheSize: this.cache.size,
      metrics: { ...this.metrics }
    };
  }

  // Private helper methods

  _generateStats(quads) {
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();
    const graphs = new Set();

    for (const quad of quads) {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      objects.add(quad.object.value);
      if (!quad.graph.equals(defaultGraph())) {
        graphs.add(quad.graph.value);
      }
    }

    return {
      subjects: subjects.size,
      predicates: predicates.size,
      objects: objects.size,
      graphs: graphs.size
    };
  }

  _termFromValue(value) {
    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {
        return namedNode(value);
      } else if (value.startsWith('_:')) {
        return DataFactory.blankNode(value.substring(2));
      } else {
        return literal(value);
      }
    }
    return value;
  }

  _generateCacheKey(pattern) {
    return JSON.stringify({
      s: pattern.subject?.value || null,
      p: pattern.predicate?.value || null,
      o: pattern.object?.value || null,
      g: pattern.graph?.value || null
    });
  }

  _canonicalizeQuads(quads) {
    // Sort quads for deterministic ordering
    return quads.sort((a, b) => {
      const aStr = this._quadToString(a);
      const bStr = this._quadToString(b);
      return aStr.localeCompare(bStr);
    });
  }

  _serializeQuadCanonical(quad) {
    return `${this._termToCanonical(quad.subject)} ${this._termToCanonical(quad.predicate)} ${this._termToCanonical(quad.object)} ${this._termToCanonical(quad.graph)} .`;
  }

  _termToCanonical(term) {
    if (term.termType === 'NamedNode') {
      return `<${term.value}>`;
    } else if (term.termType === 'Literal') {
      let result = `"${term.value.replace(/["\\]/g, '\\$&')}"`;
      if (term.language) {
        result += `@${term.language}`;
      } else if (term.datatype && !term.datatype.equals(namedNode('http://www.w3.org/2001/XMLSchema#string'))) {
        result += `^^<${term.datatype.value}>`;
      }
      return result;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    } else if (term.termType === 'DefaultGraph') {
      return '';
    }
    return term.value;
  }

  _quadToString(quad) {
    return `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}|${quad.graph.value}`;
  }

  /**
   * Health check
   * @returns {object} Health status
   */
  healthCheck() {
    return {
      status: this.status,
      storeSize: this.store.size,
      cacheSize: this.cache.size,
      metrics: this.metrics,
      memory: process.memoryUsage().heapUsed
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clear();
    this.cache.clear();
    this.removeAllListeners();
    this.status = 'destroyed';
  }
}

export default GraphProcessor;