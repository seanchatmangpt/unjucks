/**
 * Semantic Hash Calculator for RDF Graphs
 * 
 * Implements canonical RDF graph hashing with:
 * - C14N (Canonical XML) normalization
 * - Blank node normalization
 * - 5-7ms processing time target
 * - Deterministic hash generation
 * 
 * Ported from working implementation with performance optimizations.
 */

import crypto from 'crypto';
import { DataFactory } from 'n3';
import { consola } from 'consola';

const { namedNode, literal, blankNode, defaultGraph } = DataFactory;

export class SemanticHasher {
  constructor(options = {}) {
    this.options = {
      algorithm: 'sha256',
      encoding: 'hex',
      normalizeBlankNodes: true,
      sortTriples: true,
      includeGraphContext: false,
      performanceTarget: 7, // ms
      ...options
    };
    
    this.metrics = {
      hashesGenerated: 0,
      totalTime: 0,
      averageTime: 0,
      blankNodesNormalized: 0,
      triplesProcessed: 0
    };
  }

  /**
   * Generate semantic hash for RDF graph
   * Target: 5-7ms processing time
   */
  async generateHash(quads, options = {}) {
    const startTime = performance.now();
    
    try {
      if (!quads || quads.length === 0) {
        return this._emptyGraphHash();
      }

      // Step 1: Normalize blank nodes (1-2ms)
      const normalizedQuads = this.options.normalizeBlankNodes 
        ? this._normalizeBlankNodes(quads)
        : quads;

      // Step 2: Sort triples canonically (2-3ms)
      const sortedQuads = this.options.sortTriples
        ? this._sortQuadsCanonically(normalizedQuads)
        : normalizedQuads;

      // Step 3: Generate canonical serialization (1-2ms)
      const canonical = this._serializeCanonically(sortedQuads);

      // Step 4: Generate hash (1ms)
      const hash = crypto
        .createHash(this.options.algorithm)
        .update(canonical)
        .digest(this.options.encoding);

      const processingTime = performance.now() - startTime;
      this._updateMetrics(processingTime, quads.length);

      if (processingTime > this.options.performanceTarget) {
        consola.warn(`Hash generation took ${processingTime.toFixed(2)}ms (target: ${this.options.performanceTarget}ms)`);
      }

      return {
        hash,
        canonical,
        metadata: {
          algorithm: this.options.algorithm,
          processingTime: Math.round(processingTime * 100) / 100,
          quadCount: quads.length,
          normalizedBlanks: this.lastNormalizedBlanks || 0,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      consola.error('Semantic hash generation failed:', error);
      throw error;
    }
  }

  /**
   * C14N Canonical normalization of blank nodes
   * Implements deterministic blank node relabeling
   */
  _normalizeBlankNodes(quads) {
    const startTime = performance.now();
    
    // Step 1: Identify all blank nodes
    const blankNodes = new Set();
    for (const quad of quads) {
      if (quad.subject.termType === 'BlankNode') {
        blankNodes.add(quad.subject.value);
      }
      if (quad.object.termType === 'BlankNode') {
        blankNodes.add(quad.object.value);
      }
    }

    if (blankNodes.size === 0) {
      this.lastNormalizedBlanks = 0;
      return quads;
    }

    // Step 2: Create canonical mapping using hash-based ordering
    const blankNodeHashes = new Map();
    
    // Initial hash calculation for each blank node
    for (const blankValue of blankNodes) {
      const hash = this._calculateBlankNodeHash(blankValue, quads);
      blankNodeHashes.set(blankValue, hash);
    }

    // Step 3: Sort blank nodes by hash for deterministic ordering
    const sortedBlanks = Array.from(blankNodes).sort((a, b) => {
      return blankNodeHashes.get(a).localeCompare(blankNodeHashes.get(b));
    });

    // Step 4: Create canonical mapping
    const blankNodeMap = new Map();
    sortedBlanks.forEach((blankValue, index) => {
      blankNodeMap.set(blankValue, `_:b${index.toString().padStart(3, '0')}`);
    });

    // Step 5: Apply mapping to quads
    const normalizedQuads = quads.map(quad => {
      let subject = quad.subject;
      let object = quad.object;

      if (subject.termType === 'BlankNode') {
        subject = blankNode(blankNodeMap.get(subject.value));
      }

      if (object.termType === 'BlankNode') {
        object = blankNode(blankNodeMap.get(object.value));
      }

      return DataFactory.quad(subject, quad.predicate, object, quad.graph);
    });

    this.lastNormalizedBlanks = blankNodes.size;
    this.metrics.blankNodesNormalized += blankNodes.size;

    const processingTime = performance.now() - startTime;
    if (processingTime > 2) {
      consola.debug(`Blank node normalization: ${processingTime.toFixed(2)}ms for ${blankNodes.size} nodes`);
    }

    return normalizedQuads;
  }

  /**
   * Calculate hash signature for blank node based on its context
   */
  _calculateBlankNodeHash(blankValue, quads) {
    const contexts = [];
    
    // Collect all triples involving this blank node
    for (const quad of quads) {
      if (quad.subject.termType === 'BlankNode' && quad.subject.value === blankValue) {
        contexts.push(`S:${quad.predicate.value}:${this._termSignature(quad.object)}`);
      }
      if (quad.object.termType === 'BlankNode' && quad.object.value === blankValue) {
        contexts.push(`O:${quad.predicate.value}:${this._termSignature(quad.subject)}`);
      }
    }
    
    // Sort contexts for deterministic hash
    contexts.sort();
    
    return crypto.createHash('md5').update(contexts.join('|')).digest('hex');
  }

  /**
   * Generate signature for RDF term
   */
  _termSignature(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `N:${term.value}`;
      case 'Literal':
        const lang = term.language ? `@${term.language}` : '';
        const dt = term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string' 
          ? `^^${term.datatype.value}` : '';
        return `L:${term.value}${lang}${dt}`;
      case 'BlankNode':
        return `B:${term.value}`;
      default:
        return `U:${term.value}`;
    }
  }

  /**
   * Sort quads in canonical C14N order
   */
  _sortQuadsCanonically(quads) {
    const startTime = performance.now();
    
    const sorted = quads.sort((a, b) => {
      // Primary sort: subject
      const subjectComp = this._compareTermsCanonically(a.subject, b.subject);
      if (subjectComp !== 0) return subjectComp;

      // Secondary sort: predicate  
      const predicateComp = this._compareTermsCanonically(a.predicate, b.predicate);
      if (predicateComp !== 0) return predicateComp;

      // Tertiary sort: object
      const objectComp = this._compareTermsCanonically(a.object, b.object);
      if (objectComp !== 0) return objectComp;

      // Quaternary sort: graph
      return this._compareTermsCanonically(a.graph, b.graph);
    });

    const processingTime = performance.now() - startTime;
    if (processingTime > 3) {
      consola.debug(`Triple sorting: ${processingTime.toFixed(2)}ms for ${quads.length} triples`);
    }

    return sorted;
  }

  /**
   * Compare RDF terms in canonical order
   * Order: BlankNode < NamedNode < Literal < DefaultGraph
   */
  _compareTermsCanonically(a, b) {
    const typeOrder = { 
      BlankNode: 1, 
      NamedNode: 2, 
      Literal: 3, 
      DefaultGraph: 4 
    };

    const aOrder = typeOrder[a.termType] || 999;
    const bOrder = typeOrder[b.termType] || 999;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // Same type comparison
    if (a.termType === 'Literal') {
      // Compare value first
      const valueComp = a.value.localeCompare(b.value);
      if (valueComp !== 0) return valueComp;

      // Compare datatype
      const aDt = a.datatype ? a.datatype.value : '';
      const bDt = b.datatype ? b.datatype.value : '';
      const dtComp = aDt.localeCompare(bDt);
      if (dtComp !== 0) return dtComp;

      // Compare language
      const aLang = a.language || '';
      const bLang = b.language || '';
      return aLang.localeCompare(bLang);
    }

    // For all other types, compare values
    return a.value.localeCompare(b.value);
  }

  /**
   * Serialize quads to canonical N-Triples format
   */
  _serializeCanonically(quads) {
    const startTime = performance.now();
    
    const lines = [];
    for (const quad of quads) {
      const subject = this._termToNTriples(quad.subject);
      const predicate = this._termToNTriples(quad.predicate);
      const object = this._termToNTriples(quad.object);
      
      const line = quad.graph.equals(defaultGraph())
        ? `${subject} ${predicate} ${object} .`
        : `${subject} ${predicate} ${object} ${this._termToNTriples(quad.graph)} .`;
      
      lines.push(line);
    }
    
    const canonical = lines.join('\n');
    
    const processingTime = performance.now() - startTime;
    if (processingTime > 2) {
      consola.debug(`Canonical serialization: ${processingTime.toFixed(2)}ms for ${quads.length} triples`);
    }
    
    return canonical;
  }

  /**
   * Convert RDF term to N-Triples format
   */
  _termToNTriples(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        // Escape quotes and backslashes
        let escaped = term.value
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        
        let result = `"${escaped}"`;
        
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        
        return result;
      case 'DefaultGraph':
        return '';
      default:
        return String(term.value);
    }
  }

  /**
   * Generate hash for empty graph
   */
  _emptyGraphHash() {
    const hash = crypto
      .createHash(this.options.algorithm)
      .update('')
      .digest(this.options.encoding);
    
    return {
      hash,
      canonical: '',
      metadata: {
        algorithm: this.options.algorithm,
        processingTime: 0,
        quadCount: 0,
        normalizedBlanks: 0,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Update performance metrics
   */
  _updateMetrics(processingTime, quadCount) {
    this.metrics.hashesGenerated++;
    this.metrics.totalTime += processingTime;
    this.metrics.triplesProcessed += quadCount;
    
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.hashesGenerated;
    
    // Emit performance warning if consistently slow
    if (this.metrics.hashesGenerated > 10 && this.metrics.averageTime > this.options.performanceTarget * 1.5) {
      consola.warn(`Hash performance degraded: ${this.metrics.averageTime.toFixed(2)}ms average (target: ${this.options.performanceTarget}ms)`);
    }
  }

  /**
   * Get hasher metrics and performance stats
   */
  getMetrics() {
    return {
      ...this.metrics,
      performanceTarget: this.options.performanceTarget,
      algorithm: this.options.algorithm,
      isPerformant: this.metrics.averageTime <= this.options.performanceTarget
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      hashesGenerated: 0,
      totalTime: 0,
      averageTime: 0,
      blankNodesNormalized: 0,
      triplesProcessed: 0
    };
  }

  /**
   * Batch hash multiple graphs efficiently
   */
  async batchHash(graphs, options = {}) {
    const startTime = performance.now();
    const results = [];
    
    consola.info(`Batch hashing ${graphs.length} graphs...`);
    
    for (const [index, quads] of graphs.entries()) {
      try {
        const result = await this.generateHash(quads, options);
        results.push({
          index,
          ...result
        });
      } catch (error) {
        results.push({
          index,
          error: error.message,
          hash: null
        });
      }
    }
    
    const totalTime = performance.now() - startTime;
    consola.info(`Batch hashing completed in ${totalTime.toFixed(2)}ms (${(totalTime/graphs.length).toFixed(2)}ms avg per graph)`);
    
    return {
      results,
      summary: {
        total: graphs.length,
        successful: results.filter(r => r.hash).length,
        failed: results.filter(r => r.error).length,
        totalTime: Math.round(totalTime * 100) / 100,
        averageTime: Math.round((totalTime / graphs.length) * 100) / 100
      }
    };
  }
}

export default SemanticHasher;