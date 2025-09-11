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
   * Calculate content hash for reproducible graph fingerprinting
   * @param {object} options - Hashing options
   * @returns {string} Content hash
   */
  calculateContentHash(options = {}) {
    const algorithm = options.algorithm || 'sha256';
    const format = options.format || 'canonical';
    
    // Get all quads in canonical order
    const quads = this.store.getQuads();
    const canonicalQuads = this._canonicalizeQuads(quads);
    
    // Serialize to canonical format
    const serialized = canonicalQuads.map(quad => this._serializeQuadCanonical(quad)).join('\n');
    
    // Generate hash
    return crypto.createHash(algorithm).update(serialized, 'utf8').digest('hex');
  }

  /**
   * Create graph diff between two states
   * @param {GraphProcessor} other - Other graph to compare
   * @returns {object} Diff result with added, removed, and common quads
   */
  diff(other) {
    const thisQuads = new Set(this.store.getQuads().map(q => this._quadToString(q)));
    const otherQuads = new Set(other.store.getQuads().map(q => this._quadToString(q)));
    
    const added = [...otherQuads].filter(q => !thisQuads.has(q));
    const removed = [...thisQuads].filter(q => !otherQuads.has(q));
    const common = [...thisQuads].filter(q => otherQuads.has(q));
    
    return {
      added: added.length,
      removed: removed.length,
      common: common.length,
      addedQuads: added,
      removedQuads: removed,
      unchanged: common.length
    };
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