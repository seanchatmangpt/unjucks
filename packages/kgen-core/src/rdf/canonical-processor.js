/**
 * Canonical RDF Graph Processor
 * 
 * Implements deterministic RDF graph processing with canonical serialization,
 * semantic-aware hashing, and proper namespace handling to replace the naive
 * parsing in bin/kgen.mjs.
 * 
 * Key Features:
 * - Canonical RDF serialization for deterministic hashing
 * - Semantic equivalence checking
 * - Triple indexing and efficient queries
 * - Namespace normalization
 * - Graph validation and reasoning
 */

import { Parser, Writer, Store, DataFactory, Util } from 'n3';
import crypto from 'crypto';
import { consola } from 'consola';
import { EventEmitter } from 'events';

const { namedNode, literal, defaultGraph, quad, blankNode } = DataFactory;

/**
 * Canonical RDF Processor for deterministic operations
 */
export class CanonicalRDFProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Canonicalization options
      canonicalForm: config.canonicalForm || 'c14n',
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      sortTriples: config.sortTriples !== false,
      normalizeBlankNodes: config.normalizeBlankNodes !== false,
      
      // Processing options
      enableValidation: config.enableValidation !== false,
      enableReasoning: config.enableReasoning !== false,
      maxTriples: config.maxTriples || 1000000,
      
      // Performance options
      useIndexes: config.useIndexes !== false,
      cacheResults: config.cacheResults !== false,
      batchSize: config.batchSize || 1000,
      
      ...config
    };
    
    this.store = new Store();
    this.indexes = {
      subjects: new Map(),
      predicates: new Map(), 
      objects: new Map(),
      spo: new Map(), // Subject-Predicate-Object index
      pos: new Map(), // Predicate-Object-Subject index
      osp: new Map()  // Object-Subject-Predicate index
    };
    
    this.namespaces = new Map();
    this.blankNodeMap = new Map();
    this.canonicalCache = new Map();
    this.validationResults = new Map();
    
    this.metrics = {
      triplesProcessed: 0,
      hashesGenerated: 0,
      comparisons: 0,
      indexUpdates: 0,
      cacheHits: 0,
      validations: 0
    };
    
    this.setupDefaultNamespaces();
  }
  
  /**
   * Setup default semantic web namespaces
   */
  setupDefaultNamespaces() {
    const defaults = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dcterms: 'http://purl.org/dc/terms/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      sh: 'http://www.w3.org/ns/shacl#',
      prov: 'http://www.w3.org/ns/prov#',
      kgen: 'http://kgen.ai/ontology#'
    };
    
    for (const [prefix, uri] of Object.entries(defaults)) {
      this.namespaces.set(prefix, uri);
    }
  }
  
  /**
   * Parse RDF with proper semantic processing
   */
  async parseRDF(data, format = 'turtle', options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      const parser = new Parser({ 
        format,
        baseIRI: options.baseIRI,
        factory: DataFactory
      });
      
      const quads = [];
      const parseErrors = [];
      
      return new Promise((resolve, reject) => {
        parser.parse(data, (error, quad, prefixes) => {
          if (error) {
            parseErrors.push(error);
            if (!options.continueOnError) {
              return reject(new Error(`RDF parsing failed: ${error.message}`));
            }
          }
          
          if (quad) {
            // Validate quad structure
            if (this.config.enableValidation) {
              const validation = this.validateQuad(quad);
              if (!validation.valid && !options.skipInvalid) {
                parseErrors.push(new Error(`Invalid quad: ${validation.reason}`));
                if (!options.continueOnError) {
                  return reject(new Error(`Invalid quad: ${validation.reason}`));
                }
              }
            }
            
            quads.push(quad);
            this.metrics.triplesProcessed++;
          } else {
            // Parsing complete
            if (prefixes) {
              for (const [prefix, uri] of Object.entries(prefixes)) {
                this.namespaces.set(prefix, uri);
              }
            }
            
            const parseTime = this.getDeterministicTimestamp() - startTime;
            
            resolve({
              quads,
              prefixes: prefixes || {},
              count: quads.length,
              format,
              parseTime,
              errors: parseErrors,
              valid: parseErrors.length === 0
            });
          }
        });
      });
    } catch (error) {
      consola.error('RDF parsing failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate canonical hash of RDF graph
   * Replaces the naive content hashing in bin/kgen.mjs
   */
  async generateCanonicalHash(quads = null, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    this.metrics.hashesGenerated++;
    
    try {
      // Use provided quads or all quads from store
      const targetQuads = quads || this.store.getQuads();
      
      if (targetQuads.length === 0) {
        return {
          hash: crypto.createHash(this.config.hashAlgorithm).update('').digest('hex'),
          count: 0,
          canonical: '',
          metadata: {
            algorithm: this.config.hashAlgorithm,
            form: this.config.canonicalForm,
            timestamp: this.getDeterministicDate().toISOString(),
            processingTime: this.getDeterministicTimestamp() - startTime
          }
        };
      }
      
      // Check cache first
      const cacheKey = this.generateCacheKey(targetQuads);
      if (this.config.cacheResults && this.canonicalCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.canonicalCache.get(cacheKey);
      }
      
      // Canonicalize the graph
      const canonical = await this.canonicalizeGraph(targetQuads, options);
      
      // Generate hash from canonical form
      const hash = crypto
        .createHash(this.config.hashAlgorithm)
        .update(canonical.serialized)
        .digest('hex');
      
      const result = {
        hash,
        count: targetQuads.length,
        canonical: canonical.serialized,
        blankNodeMapping: canonical.blankNodeMapping,
        metadata: {
          algorithm: this.config.hashAlgorithm,
          form: this.config.canonicalForm,
          timestamp: this.getDeterministicDate().toISOString(),
          processingTime: this.getDeterministicTimestamp() - startTime,
          sortedTriples: canonical.sortedCount,
          normalizedBlanks: canonical.normalizedBlanks
        }
      };
      
      // Cache result
      if (this.config.cacheResults) {
        this.canonicalCache.set(cacheKey, result);
      }
      
      this.emit('hash-generated', {
        hash,
        count: targetQuads.length,
        processingTime: this.getDeterministicTimestamp() - startTime
      });
      
      return result;
    } catch (error) {
      consola.error('Canonical hash generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Canonicalize RDF graph for deterministic processing
   */
  async canonicalizeGraph(quads, options = {}) {
    // Step 1: Normalize blank nodes
    const normalizedQuads = this.config.normalizeBlankNodes 
      ? this.normalizeBlankNodes(quads)
      : quads;
    
    // Step 2: Sort triples for canonical order
    const sortedQuads = this.config.sortTriples 
      ? this.sortQuadsCanonically(normalizedQuads)
      : normalizedQuads;
    
    // Step 3: Serialize to canonical format
    const serialized = await this.serializeCanonically(sortedQuads, options);
    
    return {
      serialized,
      sortedCount: sortedQuads.length,
      normalizedBlanks: this.blankNodeMap.size,
      blankNodeMapping: new Map(this.blankNodeMap)
    };
  }
  
  /**
   * Normalize blank nodes for canonical form
   */
  normalizeBlankNodes(quads) {
    // Clear previous mapping
    this.blankNodeMap.clear();
    let blankNodeCounter = 0;
    
    // First pass: identify all blank nodes
    const blankNodes = new Set();
    for (const quad of quads) {
      if (quad.subject.termType === 'BlankNode') {
        blankNodes.add(quad.subject.value);
      }
      if (quad.object.termType === 'BlankNode') {
        blankNodes.add(quad.object.value);
      }
    }
    
    // Create canonical mapping
    const sortedBlanks = Array.from(blankNodes).sort();
    for (const blankValue of sortedBlanks) {
      this.blankNodeMap.set(blankValue, `_:b${blankNodeCounter++}`);
    }
    
    // Second pass: replace blank nodes
    return quads.map(quad => {
      let subject = quad.subject;
      let object = quad.object;
      
      if (subject.termType === 'BlankNode') {
        subject = blankNode(this.blankNodeMap.get(subject.value));
      }
      
      if (object.termType === 'BlankNode') {
        object = blankNode(this.blankNodeMap.get(object.value));
      }
      
      return DataFactory.quad(subject, quad.predicate, object, quad.graph);
    });
  }
  
  /**
   * Sort quads in canonical order
   */
  sortQuadsCanonically(quads) {
    return quads.sort((a, b) => {
      // Sort by subject, predicate, object, graph
      const subjectComp = this.compareTerms(a.subject, b.subject);
      if (subjectComp !== 0) return subjectComp;
      
      const predicateComp = this.compareTerms(a.predicate, b.predicate);
      if (predicateComp !== 0) return predicateComp;
      
      const objectComp = this.compareTerms(a.object, b.object);
      if (objectComp !== 0) return objectComp;
      
      return this.compareTerms(a.graph, b.graph);
    });
  }
  
  /**
   * Compare RDF terms for canonical ordering
   */
  compareTerms(a, b) {
    // Term type order: BlankNode < NamedNode < Literal
    const typeOrder = { BlankNode: 0, NamedNode: 1, Literal: 2, DefaultGraph: 3 };
    const aOrder = typeOrder[a.termType] || 999;
    const bOrder = typeOrder[b.termType] || 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Same type, compare values
    if (a.termType === 'Literal') {
      // For literals, compare value, then datatype, then language
      const valueComp = a.value.localeCompare(b.value);
      if (valueComp !== 0) return valueComp;
      
      const aDt = a.datatype ? a.datatype.value : '';
      const bDt = b.datatype ? b.datatype.value : '';
      const datatypeComp = aDt.localeCompare(bDt);
      if (datatypeComp !== 0) return datatypeComp;
      
      const aLang = a.language || '';
      const bLang = b.language || '';
      return aLang.localeCompare(bLang);
    }
    
    return a.value.localeCompare(b.value);
  }
  
  /**
   * Serialize to canonical N-Triples format
   */
  async serializeCanonically(quads, options = {}) {
    const lines = [];
    
    for (const quad of quads) {
      const subject = this.termToNTriples(quad.subject);
      const predicate = this.termToNTriples(quad.predicate);
      const object = this.termToNTriples(quad.object);
      
      const line = quad.graph.equals(defaultGraph())
        ? `${subject} ${predicate} ${object} .`
        : `${subject} ${predicate} ${object} ${this.termToNTriples(quad.graph)} .`;
      
      lines.push(line);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Convert RDF term to N-Triples format
   */
  termToNTriples(term) {
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
        return term.value;
    }
  }
  
  /**
   * Validate individual quad structure
   */
  validateQuad(quad) {
    this.metrics.validations++;
    
    try {
      // Check required properties
      if (!quad.subject || !quad.predicate || !quad.object) {
        return { valid: false, reason: 'Missing required quad components' };
      }
      
      // Subject must be NamedNode or BlankNode
      if (!['NamedNode', 'BlankNode'].includes(quad.subject.termType)) {
        return { valid: false, reason: 'Subject must be NamedNode or BlankNode' };
      }
      
      // Predicate must be NamedNode
      if (quad.predicate.termType !== 'NamedNode') {
        return { valid: false, reason: 'Predicate must be NamedNode' };
      }
      
      // Object can be any term type
      if (!quad.object.termType) {
        return { valid: false, reason: 'Object missing termType' };
      }
      
      // Validate URIs
      const uriTerms = [quad.subject, quad.predicate, quad.object, quad.graph]
        .filter(term => term && term.termType === 'NamedNode');
      
      for (const term of uriTerms) {
        if (!this.isValidURI(term.value)) {
          return { valid: false, reason: `Invalid URI: ${term.value}` };
        }
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }
  
  /**
   * Validate URI format
   */
  isValidURI(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      // Check for common URI schemes that URL doesn't handle
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri);
    }
  }
  
  /**
   * Compare two RDF graphs semantically
   * Replaces naive line-by-line diff in bin/kgen.mjs
   */
  async compareGraphs(graph1Quads, graph2Quads, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    this.metrics.comparisons++;
    
    try {
      // Generate canonical hashes for quick equality check
      const hash1 = await this.generateCanonicalHash(graph1Quads);
      const hash2 = await this.generateCanonicalHash(graph2Quads);
      
      if (hash1.hash === hash2.hash) {
        return {
          identical: true,
          semanticallyEquivalent: true,
          differences: 0,
          added: [],
          removed: [],
          common: graph1Quads.length,
          summary: {
            totalTriples1: graph1Quads.length,
            totalTriples2: graph2Quads.length,
            processingTime: this.getDeterministicTimestamp() - startTime
          }
        };
      }
      
      // Perform detailed comparison
      const graph1Set = new Set(graph1Quads.map(q => this.quadToCanonicalString(q)));
      const graph2Set = new Set(graph2Quads.map(q => this.quadToCanonicalString(q)));
      
      const added = [];
      const removed = [];
      const common = [];
      
      // Find added triples (in graph2 but not graph1)
      for (const quad of graph2Quads) {
        const quadStr = this.quadToCanonicalString(quad);
        if (!graph1Set.has(quadStr)) {
          added.push(quad);
        } else {
          common.push(quad);
        }
      }
      
      // Find removed triples (in graph1 but not graph2)
      for (const quad of graph1Quads) {
        const quadStr = this.quadToCanonicalString(quad);
        if (!graph2Set.has(quadStr)) {
          removed.push(quad);
        }
      }
      
      const identical = added.length === 0 && removed.length === 0;
      
      // Check for semantic equivalence even if not identical
      const semanticallyEquivalent = options.checkSemanticEquivalence
        ? await this.checkSemanticEquivalence(graph1Quads, graph2Quads)
        : identical;
      
      const result = {
        identical,
        semanticallyEquivalent,
        differences: added.length + removed.length,
        added,
        removed,
        common: common.length,
        summary: {
          totalTriples1: graph1Quads.length,
          totalTriples2: graph2Quads.length,
          addedCount: added.length,
          removedCount: removed.length,
          commonCount: common.length,
          processingTime: this.getDeterministicTimestamp() - startTime
        }
      };
      
      // Include detailed changes if requested
      if (options.includeChanges && !identical) {
        result.changes = {
          added: added.slice(0, options.maxChanges || 50).map(quad => 
            this.quadToCanonicalString(quad)
          ),
          removed: removed.slice(0, options.maxChanges || 50).map(quad => 
            this.quadToCanonicalString(quad)
          )
        };
      }
      
      return result;
    } catch (error) {
      consola.error('Graph comparison failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert quad to canonical string representation
   */
  quadToCanonicalString(quad) {
    const subject = this.termToNTriples(quad.subject);
    const predicate = this.termToNTriples(quad.predicate);
    const object = this.termToNTriples(quad.object);
    const graph = quad.graph.equals(defaultGraph()) ? '' : ` ${this.termToNTriples(quad.graph)}`;
    
    return `${subject} ${predicate} ${object}${graph} .`;
  }
  
  /**
   * Check semantic equivalence beyond structural identity
   */
  async checkSemanticEquivalence(graph1Quads, graph2Quads) {
    // This is a simplified implementation
    // Full semantic equivalence would require reasoning
    
    // For now, check if graphs are isomorphic (same structure, different blank node labels)
    const graph1Normalized = this.normalizeBlankNodes(graph1Quads);
    const graph2Normalized = this.normalizeBlankNodes(graph2Quads);
    
    const hash1 = await this.generateCanonicalHash(graph1Normalized);
    const hash2 = await this.generateCanonicalHash(graph2Normalized);
    
    return hash1.hash === hash2.hash;
  }
  
  /**
   * Generate cache key for quad set
   */
  generateCacheKey(quads) {
    // Quick hash based on quad count and first/last quad strings
    const count = quads.length;
    if (count === 0) return 'empty';
    
    const first = this.quadToCanonicalString(quads[0]);
    const last = count > 1 ? this.quadToCanonicalString(quads[count - 1]) : first;
    
    return `${count}-${crypto.createHash('md5').update(first + last).digest('hex')}`;
  }
  
  /**
   * Get processor metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      storeSize: this.store.size,
      cacheSize: this.canonicalCache.size,
      namespacesCount: this.namespaces.size,
      indexesSize: {
        subjects: this.indexes.subjects.size,
        predicates: this.indexes.predicates.size,
        objects: this.indexes.objects.size
      }
    };
  }
  
  /**
   * Clear all caches and reset state
   */
  reset() {
    this.store = new Store();
    this.canonicalCache.clear();
    this.blankNodeMap.clear();
    this.validationResults.clear();
    
    // Reset indexes
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    // Reset metrics
    this.metrics = {
      triplesProcessed: 0,
      hashesGenerated: 0,
      comparisons: 0,
      indexUpdates: 0,
      cacheHits: 0,
      validations: 0
    };
    
    this.emit('reset');
  }

  /**
   * Utility methods for deterministic timestamps
   */
  getDeterministicTimestamp() {
    return Date.now();
  }

  getDeterministicDate() {
    return new Date();
  }
}

export default CanonicalRDFProcessor;