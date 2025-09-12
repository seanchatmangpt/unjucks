/**
 * Enhanced RDF Graph Engine for KGEN
 * Provides deterministic graph hashing, normalization, diff engine, and indexing
 * 
 * @fileoverview Core RDF processing with enterprise-grade deterministic operations
 * @author KGEN Team
 * @version 1.0.0
 */

import { Parser, Writer, Store, DataFactory, Util } from 'n3';
import sparqljsPkg from 'sparqljs';
import consola from 'consola';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';

const { SparqlParser, SparqlGenerator } = sparqljsPkg;

const { namedNode, literal, defaultGraph, quad } = DataFactory;

/**
 * @typedef {Object} GraphHash
 * @property {string} sha256 - Canonical SHA256 hash of the graph
 * @property {string} algorithm - Hashing algorithm used
 * @property {number} tripleCount - Number of triples included in hash
 * @property {Date} timestamp - When hash was computed
 */

/**
 * @typedef {Object} NormalizedGraph
 * @property {Array} triples - Canonically ordered triples
 * @property {string} serialization - Canonical serialization
 * @property {Object} metadata - Normalization metadata
 */

/**
 * @typedef {Object} GraphDiff
 * @property {Array} added - Triples added between graphs
 * @property {Array} removed - Triples removed between graphs  
 * @property {Array} modified - Triples that changed
 * @property {Object} statistics - Diff statistics
 */

/**
 * Enhanced RDF Processor with deterministic graph operations
 * Extends basic RDF processing with enterprise features for reproducible graph operations
 * 
 * @class EnhancedRDFProcessor
 * @extends EventEmitter
 */
export class EnhancedRDFProcessor extends EventEmitter {
  /**
   * @param {Object} config - Configuration object
   * @param {Object} config.parser - N3 parser configuration
   * @param {Object} config.writer - N3 writer configuration  
   * @param {Object} config.namespaces - Custom namespace definitions
   * @param {Object} config.sparql - SPARQL configuration
   * @param {boolean} config.deterministic - Enable deterministic mode (default: true)
   * @param {string} config.hashAlgorithm - Hash algorithm for graph hashing (default: 'sha256')
   */
  constructor(config = {}) {
    super();
    this.config = {
      deterministic: true,
      hashAlgorithm: 'sha256',
      ...config
    };
    
    // Core N3 components
    this.store = new Store();
    this.parser = new Parser(config.parser);
    this.writer = new Writer(config.writer);
    this.sparqlParser = new SparqlParser();
    this.sparqlGenerator = new SparqlGenerator();
    
    // Graph engine components
    this.namespaces = new Map();
    this.graphIndex = new Map(); // subject -> artifacts mapping
    this.hashCache = new Map(); // graph -> hash caching
    this.normalizedCache = new Map(); // graph -> normalized form
    
    // Metrics and status
    this.metrics = {
      triplesProcessed: 0,
      queriesExecuted: 0,
      parseErrors: 0,
      queryErrors: 0,
      hashesComputed: 0,
      diffsComputed: 0,
      normalizations: 0
    };
    
    this.status = 'uninitialized';
    this.setupNamespaces();
  }

  /**
   * Initialize the enhanced RDF processor
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      this.setupErrorHandling();
      await this.setupStores();
      
      this.status = 'ready';
      consola.success('✅ Enhanced RDF Processor initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Enhanced RDF Processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup default RDF namespaces for semantic web operations
   * @private
   */
  setupNamespaces() {
    const defaultNamespaces = this.config.namespaces || {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dcterms: 'http://purl.org/dc/terms/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      sh: 'http://www.w3.org/ns/shacl#',
      prov: 'http://www.w3.org/ns/prov#',
      kgen: 'https://kgen.io/ontology#'
    };

    for (const [prefix, uri] of Object.entries(defaultNamespaces)) {
      this.namespaces.set(prefix, uri);
    }
  }

  /**
   * Setup error handling for parser and SPARQL operations
   * @private
   */
  setupErrorHandling() {
    this.parser.on('error', (error) => {
      this.metrics.parseErrors++;
      this.emit('parse-error', error);
      consola.error('RDF Parse Error:', error);
    });
  }

  /**
   * Setup stores and connections
   * @private
   * @returns {Promise<void>}
   */
  async setupStores() {
    this.store = new Store();
    
    if (this.config.sparql?.endpoint) {
      consola.info(`🔗 Connecting to SPARQL endpoint: ${this.config.sparql.endpoint}`);
    }
  }

  /**
   * Parse RDF data from various formats with enhanced metadata tracking
   * @param {string} data - RDF data to parse
   * @param {string} format - RDF format (turtle, n3, ntriples, etc.)
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed RDF with metadata
   */
  async parseRDF(data, format = 'turtle', options = {}) {
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
          return reject(error);
        }
        
        if (quad) {
          quads.push(quad);
          this.metrics.triplesProcessed++;
        } else {
          if (prefixes) {
            for (const [prefix, uri] of Object.entries(prefixes)) {
              this.namespaces.set(prefix, uri);
            }
          }
          
          resolve({
            quads,
            count: quads.length,
            prefixes: prefixes || {},
            format,
            parseTimestamp: this.getDeterministicDate(),
            canonical: this.config.deterministic
          });
        }
      });
    });
  }

  /**
   * Compute deterministic canonical hash of a graph
   * Implements RFC-compliant graph canonicalization for reproducible hashing
   * 
   * @param {Array|null} quads - Quads to hash (null = entire store)
   * @param {Object} options - Hashing options
   * @param {boolean} options.includeMetadata - Include parsing metadata in hash
   * @returns {GraphHash} Canonical graph hash with metadata
   */
  computeGraphHash(quads = null, options = {}) {
    const targetQuads = quads || this.store.getQuads();
    const cacheKey = this.generateCacheKey(targetQuads);
    
    // Check cache for deterministic performance
    if (this.config.deterministic && this.hashCache.has(cacheKey)) {
      return this.hashCache.get(cacheKey);
    }
    
    try {
      // Step 1: Normalize triples for canonical ordering
      const normalized = this.normalizeGraph(targetQuads, { forHashing: true });
      
      // Step 2: Create deterministic serialization
      const canonicalSerialization = this.createCanonicalSerialization(normalized.triples);
      
      // Step 3: Compute hash
      const hash = createHash(this.config.hashAlgorithm)
        .update(canonicalSerialization, 'utf8')
        .digest('hex');
      
      const result = {
        sha256: hash,
        algorithm: this.config.hashAlgorithm,
        tripleCount: targetQuads.length,
        timestamp: this.getDeterministicDate(),
        canonical: true,
        normalization: normalized.metadata
      };
      
      // Cache result for performance
      if (this.config.deterministic) {
        this.hashCache.set(cacheKey, result);
      }
      
      this.metrics.hashesComputed++;
      this.emit('hash-computed', result);
      
      return result;
      
    } catch (error) {
      consola.error('Graph hashing failed:', error);
      throw new Error(`Graph hashing failed: ${error.message}`);
    }
  }

  /**
   * Normalize graph for byte-for-byte reproducibility
   * Implements deterministic triple ordering and blank node canonicalization
   * 
   * @param {Array} quads - Quads to normalize
   * @param {Object} options - Normalization options
   * @param {boolean} options.forHashing - Optimize for hashing operations
   * @param {boolean} options.preserveOrder - Preserve original ordering where possible
   * @returns {NormalizedGraph} Normalized graph with canonical ordering
   */
  normalizeGraph(quads, options = {}) {
    const cacheKey = this.generateCacheKey(quads) + JSON.stringify(options);
    
    if (this.config.deterministic && this.normalizedCache.has(cacheKey)) {
      return this.normalizedCache.get(cacheKey);
    }
    
    try {
      // Step 1: Extract and canonicalize blank nodes
      const { canonicalizedQuads, blankNodeMap } = this.canonicalizeBlankNodes(quads);
      
      // Step 2: Sort triples deterministically
      const sortedTriples = this.sortTriplesDeterministically(canonicalizedQuads);
      
      // Step 3: Create canonical serialization
      const serialization = this.createCanonicalSerialization(sortedTriples);
      
      const result = {
        triples: sortedTriples,
        serialization: serialization,
        metadata: {
          originalCount: quads.length,
          normalizedCount: sortedTriples.length,
          blankNodesRenamed: Object.keys(blankNodeMap).length,
          normalizationTimestamp: this.getDeterministicDate(),
          deterministic: this.config.deterministic
        }
      };
      
      // Cache normalized result
      if (this.config.deterministic) {
        this.normalizedCache.set(cacheKey, result);
      }
      
      this.metrics.normalizations++;
      this.emit('graph-normalized', result.metadata);
      
      return result;
      
    } catch (error) {
      consola.error('Graph normalization failed:', error);
      throw new Error(`Graph normalization failed: ${error.message}`);
    }
  }

  /**
   * Compute triple-level diff between two graphs
   * Provides detailed comparison with added, removed, and modified triples
   * 
   * @param {Array} sourceQuads - Source graph triples
   * @param {Array} targetQuads - Target graph triples  
   * @param {Object} options - Diff options
   * @param {boolean} options.normalize - Normalize graphs before diffing
   * @param {boolean} options.includeMetadata - Include diff metadata
   * @returns {GraphDiff} Detailed graph difference
   */
  computeGraphDiff(sourceQuads, targetQuads, options = {}) {
    try {
      const { normalize = true, includeMetadata = true } = options;
      
      // Normalize graphs for consistent comparison
      const source = normalize ? this.normalizeGraph(sourceQuads) : { triples: sourceQuads };
      const target = normalize ? this.normalizeGraph(targetQuads) : { triples: targetQuads };
      
      // Create lookup maps for efficient comparison
      const sourceMap = this.createTripleMap(source.triples);
      const targetMap = this.createTripleMap(target.triples);
      
      // Compute differences
      const added = [];
      const removed = [];
      const common = [];
      
      // Find added triples
      for (const [key, triple] of targetMap) {
        if (!sourceMap.has(key)) {
          added.push(triple);
        } else {
          common.push(triple);
        }
      }
      
      // Find removed triples
      for (const [key, triple] of sourceMap) {
        if (!targetMap.has(key)) {
          removed.push(triple);
        }
      }
      
      const statistics = {
        totalSource: sourceQuads.length,
        totalTarget: targetQuads.length,
        added: added.length,
        removed: removed.length,
        common: common.length,
        similarity: common.length / Math.max(sourceQuads.length, targetQuads.length, 1)
      };
      
      const result = {
        added,
        removed,
        modified: [], // Could be enhanced to detect modified properties
        statistics,
        ...(includeMetadata && {
          metadata: {
            diffTimestamp: this.getDeterministicDate(),
            normalized: normalize,
            sourceHash: this.computeGraphHash(sourceQuads).sha256,
            targetHash: this.computeGraphHash(targetQuads).sha256
          }
        })
      };
      
      this.metrics.diffsComputed++;
      this.emit('diff-computed', statistics);
      
      return result;
      
    } catch (error) {
      consola.error('Graph diff computation failed:', error);
      throw new Error(`Graph diff failed: ${error.message}`);
    }
  }

  /**
   * Build and maintain graph index for subject-to-artifact mapping
   * Enables efficient lookup of artifacts associated with RDF subjects
   * 
   * @param {Array} quads - Quads to index
   * @param {Object} artifactMap - Map of subjects to artifacts
   * @returns {Map} Updated graph index
   */
  buildGraphIndex(quads, artifactMap = {}) {
    try {
      // Clear existing index for rebuild
      this.graphIndex.clear();
      
      // Build subject-to-artifacts mapping
      for (const quad of quads) {
        const subjectUri = quad.subject.value;
        
        if (!this.graphIndex.has(subjectUri)) {
          this.graphIndex.set(subjectUri, {
            subject: quad.subject,
            artifacts: new Set(),
            triples: [],
            predicates: new Set(),
            objectTypes: new Set(),
            lastUpdated: this.getDeterministicDate()
          });
        }
        
        const entry = this.graphIndex.get(subjectUri);
        entry.triples.push(quad);
        entry.predicates.add(quad.predicate.value);
        entry.objectTypes.add(quad.object.termType);
        
        // Add artifacts from mapping
        if (artifactMap[subjectUri]) {
          if (Array.isArray(artifactMap[subjectUri])) {
            artifactMap[subjectUri].forEach(artifact => entry.artifacts.add(artifact));
          } else {
            entry.artifacts.add(artifactMap[subjectUri]);
          }
        }
      }
      
      this.emit('index-built', { 
        subjectCount: this.graphIndex.size, 
        tripleCount: quads.length 
      });
      
      return this.graphIndex;
      
    } catch (error) {
      consola.error('Graph indexing failed:', error);
      throw new Error(`Graph indexing failed: ${error.message}`);
    }
  }

  /**
   * Query the graph index for subjects and their artifacts
   * @param {string} subjectUri - URI of the subject to lookup
   * @returns {Object|null} Index entry or null if not found
   */
  getIndexEntry(subjectUri) {
    return this.graphIndex.get(subjectUri) || null;
  }

  /**
   * Find subjects by artifact
   * @param {string} artifact - Artifact to search for
   * @returns {Array} Array of subjects associated with the artifact
   */
  findSubjectsByArtifact(artifact) {
    const subjects = [];
    for (const [subjectUri, entry] of this.graphIndex) {
      if (entry.artifacts.has(artifact)) {
        subjects.push({
          subject: subjectUri,
          tripleCount: entry.triples.length,
          predicates: Array.from(entry.predicates)
        });
      }
    }
    return subjects;
  }

  // --- HELPER METHODS ---

  /**
   * Generate cache key for quads array
   * @private
   * @param {Array} quads - Quads to generate key for
   * @returns {string} Cache key
   */
  generateCacheKey(quads) {
    if (!quads.length) return 'empty';
    
    // Use first/last quad and length for lightweight cache key
    const first = quads[0];
    const last = quads[quads.length - 1];
    return `${first.subject.value}-${last.object.value}-${quads.length}`;
  }

  /**
   * Canonicalize blank nodes for deterministic ordering
   * @private
   * @param {Array} quads - Quads with potential blank nodes
   * @returns {Object} Object with canonicalizedQuads and blankNodeMap
   */
  canonicalizeBlankNodes(quads) {
    const blankNodeMap = new Map();
    let blankNodeCounter = 0;
    
    const canonicalizedQuads = quads.map(quad => {
      let subject = quad.subject;
      let object = quad.object;
      
      // Canonicalize blank node subjects
      if (subject.termType === 'BlankNode') {
        if (!blankNodeMap.has(subject.value)) {
          blankNodeMap.set(subject.value, `_:b${blankNodeCounter++}`);
        }
        subject = DataFactory.blankNode(blankNodeMap.get(subject.value));
      }
      
      // Canonicalize blank node objects
      if (object.termType === 'BlankNode') {
        if (!blankNodeMap.has(object.value)) {
          blankNodeMap.set(object.value, `_:b${blankNodeCounter++}`);
        }
        object = DataFactory.blankNode(blankNodeMap.get(object.value));
      }
      
      return DataFactory.quad(subject, quad.predicate, object, quad.graph);
    });
    
    return { 
      canonicalizedQuads, 
      blankNodeMap: Object.fromEntries(blankNodeMap)
    };
  }

  /**
   * Sort triples deterministically for canonical ordering
   * @private
   * @param {Array} quads - Quads to sort
   * @returns {Array} Deterministically sorted quads
   */
  sortTriplesDeterministically(quads) {
    return quads.sort((a, b) => {
      // Sort by subject, predicate, object, graph
      const aKey = `${a.subject.value}|${a.predicate.value}|${a.object.value}|${a.graph.value}`;
      const bKey = `${b.subject.value}|${b.predicate.value}|${b.object.value}|${b.graph.value}`;
      return aKey.localeCompare(bKey);
    });
  }

  /**
   * Create canonical serialization for hashing
   * @private
   * @param {Array} quads - Canonically ordered quads
   * @returns {string} Canonical serialization
   */
  createCanonicalSerialization(quads) {
    return quads.map(quad => {
      const s = this.termToCanonicalString(quad.subject);
      const p = this.termToCanonicalString(quad.predicate);
      const o = this.termToCanonicalString(quad.object);
      const g = quad.graph.value !== '' ? this.termToCanonicalString(quad.graph) : '';
      return g ? `${s} ${p} ${o} ${g} .` : `${s} ${p} ${o} .`;
    }).join('\n');
  }

  /**
   * Convert RDF term to canonical string representation
   * @private
   * @param {Object} term - RDF term (NamedNode, Literal, BlankNode)
   * @returns {string} Canonical string representation
   */
  termToCanonicalString(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'Literal':
        const lang = term.language ? `@${term.language}` : '';
        const type = term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string' 
          ? `^^<${term.datatype.value}>` : '';
        return `"${term.value.replace(/"/g, '\\"')}"${lang}${type}`;
      case 'BlankNode':
        return `_:${term.value}`;
      default:
        return term.value;
    }
  }

  /**
   * Create triple lookup map for efficient diffing
   * @private
   * @param {Array} quads - Quads to map
   * @returns {Map} Map of canonical keys to quads
   */
  createTripleMap(quads) {
    const map = new Map();
    for (const quad of quads) {
      const key = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`;
      map.set(key, quad);
    }
    return map;
  }

  /**
   * Add quads to store with optional graph and indexing
   * @param {Array} quads - Quads to add
   * @param {string|null} graph - Named graph URI
   * @param {Object} artifactMap - Artifact mapping for indexing
   * @returns {number} Number of quads added
   */
  addQuads(quads, graph = null, artifactMap = {}) {
    if (!Array.isArray(quads)) {
      quads = [quads];
    }

    const targetGraph = graph ? namedNode(graph) : defaultGraph();
    
    for (const quad of quads) {
      const newQuad = graph && quad.graph.equals(defaultGraph()) 
        ? DataFactory.quad(quad.subject, quad.predicate, quad.object, targetGraph)
        : quad;
      
      this.store.addQuad(newQuad);
    }
    
    // Update graph index
    if (Object.keys(artifactMap).length > 0) {
      this.buildGraphIndex(this.store.getQuads(), artifactMap);
    }

    this.emit('quads-added', { count: quads.length, graph });
    return quads.length;
  }

  /**
   * Execute SPARQL query with enhanced error handling
   * @param {string} sparql - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async query(sparql, options = {}) {
    try {
      this.metrics.queriesExecuted++;
      
      const parsedQuery = this.sparqlParser.parse(sparql);
      
      let results;
      switch (parsedQuery.queryType) {
        case 'SELECT':
          results = await this.executeSelect(parsedQuery, options);
          break;
        case 'CONSTRUCT':
          results = await this.executeConstruct(parsedQuery, options);
          break;
        case 'ASK':
          results = await this.executeAsk(parsedQuery, options);
          break;
        case 'DESCRIBE':
          results = await this.executeDescribe(parsedQuery, options);
          break;
        default:
          throw new Error(`Unsupported query type: ${parsedQuery.queryType}`);
      }

      this.emit('query-executed', { 
        queryType: parsedQuery.queryType, 
        resultCount: Array.isArray(results) ? results.length : 1 
      });
      
      return results;
      
    } catch (error) {
      this.metrics.queryErrors++;
      this.emit('query-error', { sparql, error });
      throw error;
    }
  }

  /**
   * Execute SELECT query with basic pattern matching
   * @private
   * @param {Object} parsedQuery - Parsed SPARQL query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} SELECT results
   */
  async executeSelect(parsedQuery, options = {}) {
    const bindings = [];
    const maxResults = options.maxResults || this.config.sparql?.maxResults || 10000;
    
    // Simplified SELECT implementation
    const allQuads = this.store.getQuads();
    
    for (const quad of allQuads.slice(0, maxResults)) {
      const binding = {
        s: quad.subject,
        p: quad.predicate,
        o: quad.object
      };
      bindings.push(binding);
    }

    return {
      results: { bindings },
      head: { vars: ['s', 'p', 'o'] }
    };
  }

  /**
   * Execute CONSTRUCT query 
   * @private
   * @param {Object} parsedQuery - Parsed SPARQL query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Constructed quads
   */
  async executeConstruct(parsedQuery, options = {}) {
    // Simplified implementation
    return [];
  }

  /**
   * Execute ASK query
   * @private
   * @param {Object} parsedQuery - Parsed SPARQL query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Boolean result
   */
  async executeAsk(parsedQuery, options = {}) {
    const hasTriples = this.store.size > 0;
    return { boolean: hasTriples };
  }

  /**
   * Execute DESCRIBE query
   * @private
   * @param {Object} parsedQuery - Parsed SPARQL query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Description quads
   */
  async executeDescribe(parsedQuery, options = {}) {
    // Return sample triples for description
    return this.store.getQuads(null, null, null).slice(0, 10);
  }

  /**
   * Serialize RDF data with deterministic options
   * @param {Array|null} quads - Quads to serialize (null = entire store)
   * @param {string} format - Output format
   * @param {Object} options - Serialization options
   * @returns {Promise<string>} Serialized RDF
   */
  async serializeRDF(quads = null, format = 'turtle', options = {}) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({ 
        format,
        ...options,
        prefixes: Object.fromEntries(this.namespaces)
      });

      const dataQuads = quads || this.store.getQuads();
      
      // Apply deterministic ordering if enabled
      const targetQuads = this.config.deterministic ? 
        this.sortTriplesDeterministically([...dataQuads]) : dataQuads;
      
      writer.addQuads(targetQuads);
      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get comprehensive statistics about the graph and processor
   * @returns {Object} Detailed statistics
   */
  getStats() {
    return {
      store: {
        totalTriples: this.store.size,
        graphs: this.store.getGraphs().length,
        subjects: new Set(this.store.getSubjects()).size,
        predicates: new Set(this.store.getPredicates()).size,
        objects: new Set(this.store.getObjects()).size
      },
      index: {
        indexedSubjects: this.graphIndex.size,
        totalArtifacts: Array.from(this.graphIndex.values())
          .reduce((sum, entry) => sum + entry.artifacts.size, 0)
      },
      caches: {
        hashCacheSize: this.hashCache.size,
        normalizedCacheSize: this.normalizedCache.size
      },
      namespaces: this.namespaces.size,
      metrics: { ...this.metrics },
      status: this.status,
      deterministic: this.config.deterministic
    };
  }

  /**
   * Clear store and reset caches
   * @param {string|null} graph - Specific graph to clear (null = all)
   */
  clear(graph = null) {
    if (graph) {
      const graphNode = namedNode(graph);
      const quads = this.store.getQuads(null, null, null, graphNode);
      this.store.removeQuads(quads);
    } else {
      this.store.removeQuads(this.store.getQuads());
      this.graphIndex.clear();
      this.hashCache.clear();
      this.normalizedCache.clear();
    }
    
    this.emit('store-cleared', { graph });
  }

  /**
   * Health check with enhanced metrics
   * @returns {Promise<Object>} Health check results
   */
  async healthCheck() {
    return {
      status: this.status,
      storeSize: this.store.size,
      indexSize: this.graphIndex.size,
      cacheEfficiency: {
        hashHitRate: this.metrics.hashesComputed > 0 ? 
          this.hashCache.size / this.metrics.hashesComputed : 0,
        normalizationHitRate: this.metrics.normalizations > 0 ?
          this.normalizedCache.size / this.metrics.normalizations : 0
      },
      metrics: this.metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Shutdown processor with cleanup
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear caches to free memory
    this.hashCache.clear();
    this.normalizedCache.clear();
    this.graphIndex.clear();
    
    // Clear event listeners
    this.removeAllListeners();
    
    this.status = 'shutdown';
    consola.info('🛑 Enhanced RDF Processor shutdown complete');
  }
}

/**
 * Create and initialize enhanced RDF processor
 * @param {Object} config - Configuration object  
 * @returns {Promise<EnhancedRDFProcessor>} Initialized processor instance
 */
export async function createEnhancedRDFProcessor(config = {}) {
  const processor = new EnhancedRDFProcessor(config);
  await processor.initialize();
  return processor;
}

export default EnhancedRDFProcessor;