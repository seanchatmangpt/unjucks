/**
 * RDF Processing Module
 * 
 * Enhanced RDF processing with canonical serialization, semantic-aware indexing,
 * and deterministic graph operations. Replaces naive RDF parsing in bin/kgen.mjs
 * with proper semantic web processing.
 */

import { Parser, Writer, Store, DataFactory, Util } from 'n3';
import sparqljs from 'sparqljs';
import consola from 'consola';
import { EventEmitter } from 'events';

// Export enhanced RDF processing components
export { CanonicalRDFProcessor } from './canonical-processor.js';
export { GraphIndexer } from './graph-indexer.js';
export { EnhancedRDFProcessor } from './enhanced-processor.js';
export { StandaloneKGenBridge } from './standalone-bridge.js';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class RDFProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.store = new Store();
    this.parser = new Parser(config.parser);
    this.writer = new Writer(config.writer);
    // Initialize SPARQL components lazily
    this.sparqlParser = null;
    this.sparqlGenerator = null;
    this.namespaces = new Map();
    this.metrics = {
      triplesProcessed: 0,
      queriesExecuted: 0,
      parseErrors: 0,
      queryErrors: 0
    };
    
    // Setup default namespaces
    this.setupNamespaces();
    this.status = 'uninitialized';
  }

  /**
   * Initialize RDF processor
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Initialize SPARQL components
      this.setupSparqlComponents();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Initialize stores and parsers
      await this.setupStores();
      
      this.status = 'ready';
      consola.success('✅ RDF Processor initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ RDF Processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup SPARQL components lazily
   */
  setupSparqlComponents() {
    if (!this.sparqlParser) {
      this.sparqlParser = new sparqljs.Parser();
    }
    if (!this.sparqlGenerator) {
      this.sparqlGenerator = new sparqljs.Generator();
    }
  }

  /**
   * Setup default namespaces
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
      sh: 'http://www.w3.org/ns/shacl#'
    };

    for (const [prefix, uri] of Object.entries(defaultNamespaces)) {
      this.namespaces.set(prefix, uri);
    }
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Error handling will be done in individual parse operations
    // since N3 Parser instances are created per parse operation
    this.on('error', (error) => {
      consola.error('RDF Processor Error:', error);
    });
  }

  /**
   * Setup stores and connections
   */
  async setupStores() {
    // Initialize main N3 store
    this.store = new Store();
    
    // Setup SPARQL endpoint if configured
    if (this.config.sparql?.endpoint) {
      consola.info(`🔗 Connecting to SPARQL endpoint: ${this.config.sparql.endpoint}`);
      // Connection logic would go here for remote endpoints
    }
  }

  /**
   * Parse RDF data from various formats
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
          // Parsing complete
          if (prefixes) {
            // Store prefixes for later use
            for (const [prefix, uri] of Object.entries(prefixes)) {
              this.namespaces.set(prefix, uri);
            }
          }
          
          resolve({
            quads,
            count: quads.length,
            prefixes: prefixes || {},
            format
          });
        }
      });
    });
  }

  /**
   * Add quads to the store
   */
  addQuads(quads, graph = null) {
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

    this.emit('quads-added', { count: quads.length, graph });
    return quads.length;
  }

  /**
   * Remove quads from the store
   */
  removeQuads(quads, graph = null) {
    if (!Array.isArray(quads)) {
      quads = [quads];
    }

    let removedCount = 0;
    for (const quad of quads) {
      if (this.store.removeQuad(quad)) {
        removedCount++;
      }
    }

    this.emit('quads-removed', { count: removedCount, graph });
    return removedCount;
  }

  /**
   * Execute SPARQL query
   */
  async query(sparql, options = {}) {
    try {
      this.metrics.queriesExecuted++;
      
      // Ensure SPARQL components are initialized
      this.setupSparqlComponents();
      
      // Parse SPARQL query
      const parsedQuery = this.sparqlParser.parse(sparql);
      
      // Execute based on query type
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

      this.emit('query-executed', { queryType: parsedQuery.queryType, resultCount: results.length || 1 });
      return results;
      
    } catch (error) {
      this.metrics.queryErrors++;
      this.emit('query-error', { sparql, error });
      throw error;
    }
  }

  /**
   * Execute SELECT query
   */
  async executeSelect(parsedQuery, options = {}) {
    const bindings = [];
    const maxResults = options.maxResults || this.config.sparql?.maxResults || 10000;
    let resultCount = 0;

    // Simple pattern matching for basic SELECT queries
    // This is a simplified implementation - real-world would need full SPARQL engine
    const patterns = this.extractPatterns(parsedQuery.where);
    
    for (const pattern of patterns) {
      const matches = this.store.getQuads(
        pattern.subject ? this.termFromPattern(pattern.subject) : null,
        pattern.predicate ? this.termFromPattern(pattern.predicate) : null,
        pattern.object ? this.termFromPattern(pattern.object) : null,
        pattern.graph ? this.termFromPattern(pattern.graph) : null
      );

      for (const match of matches) {
        if (resultCount >= maxResults) break;
        
        const binding = {};
        if (pattern.subject?.termType === 'Variable') {
          binding[pattern.subject.value] = match.subject;
        }
        if (pattern.predicate?.termType === 'Variable') {
          binding[pattern.predicate.value] = match.predicate;
        }
        if (pattern.object?.termType === 'Variable') {
          binding[pattern.object.value] = match.object;
        }
        
        bindings.push(binding);
        resultCount++;
      }
    }

    return {
      results: { bindings },
      head: { vars: this.extractVariables(parsedQuery.variables) }
    };
  }

  /**
   * Execute CONSTRUCT query
   */
  async executeConstruct(parsedQuery, options = {}) {
    const constructedQuads = [];
    
    // This is a simplified implementation
    // Real CONSTRUCT would need to build new triples based on template and WHERE patterns
    
    return constructedQuads;
  }

  /**
   * Execute ASK query
   */
  async executeAsk(parsedQuery, options = {}) {
    // Check if any patterns match
    const patterns = this.extractPatterns(parsedQuery.where);
    
    for (const pattern of patterns) {
      const matches = this.store.getQuads(
        pattern.subject ? this.termFromPattern(pattern.subject) : null,
        pattern.predicate ? this.termFromPattern(pattern.predicate) : null,
        pattern.object ? this.termFromPattern(pattern.object) : null
      );
      
      if (matches.length > 0) {
        return { boolean: true };
      }
    }
    
    return { boolean: false };
  }

  /**
   * Execute DESCRIBE query
   */
  async executeDescribe(parsedQuery, options = {}) {
    const describedQuads = [];
    
    // Simple implementation - describe all triples about the resource
    const resources = this.extractResources(parsedQuery);
    
    for (const resource of resources) {
      const resourceNode = this.termFromPattern(resource);
      
      // Get triples where resource is subject
      const subjectTriples = this.store.getQuads(resourceNode, null, null);
      describedQuads.push(...subjectTriples);
      
      // Get triples where resource is object
      const objectTriples = this.store.getQuads(null, null, resourceNode);
      describedQuads.push(...objectTriples);
    }
    
    return describedQuads;
  }

  /**
   * Serialize RDF data to various formats
   */
  async serializeRDF(quads = null, format = 'turtle', options = {}) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({ 
        format,
        ...options,
        prefixes: Object.fromEntries(this.namespaces)
      });

      const dataQuads = quads || this.store.getQuads();
      
      writer.addQuads(dataQuads);
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
   * Get store statistics
   */
  getStats() {
    return {
      totalTriples: this.store.size,
      graphs: this.store.getGraphs().length,
      subjects: new Set(this.store.getSubjects()).size,
      predicates: new Set(this.store.getPredicates()).size,
      objects: new Set(this.store.getObjects()).size,
      namespaces: this.namespaces.size,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Clear the store
   */
  clear(graph = null) {
    if (graph) {
      const graphNode = namedNode(graph);
      const quads = this.store.getQuads(null, null, null, graphNode);
      this.store.removeQuads(quads);
    } else {
      this.store.removeQuads(this.store.getQuads());
    }
    
    this.emit('store-cleared', { graph });
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.status,
      storeSize: this.store.size,
      metrics: this.metrics,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown processor
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Close any open connections
    // Clear event listeners
    this.removeAllListeners();
    
    this.status = 'shutdown';
    consola.info('🛑 RDF Processor shutdown complete');
  }

  // Helper methods

  /**
   * Extract patterns from WHERE clause
   */
  extractPatterns(where) {
    // Simplified pattern extraction
    // Real implementation would need full SPARQL algebra support
    return where || [];
  }

  /**
   * Extract variables from SELECT clause
   */
  extractVariables(variables) {
    if (!variables) return [];
    return variables.map(v => v.variable ? v.variable.value : v.value);
  }

  /**
   * Extract resources from DESCRIBE clause
   */
  extractResources(parsedQuery) {
    // Simplified resource extraction
    return parsedQuery.variables || [];
  }

  /**
   * Convert pattern term to N3 term
   */
  termFromPattern(pattern) {
    if (!pattern) return null;
    
    if (pattern.termType === 'NamedNode') {
      return namedNode(pattern.value);
    } else if (pattern.termType === 'Literal') {
      return literal(pattern.value, pattern.language || pattern.datatype);
    } else if (pattern.termType === 'Variable') {
      return null; // Variables are handled differently in queries
    }
    
    return null;
  }

  /**
   * Add namespace prefix
   */
  addNamespace(prefix, uri) {
    this.namespaces.set(prefix, uri);
    this.emit('namespace-added', { prefix, uri });
  }

  /**
   * Remove namespace prefix
   */
  removeNamespace(prefix) {
    const removed = this.namespaces.delete(prefix);
    if (removed) {
      this.emit('namespace-removed', { prefix });
    }
    return removed;
  }

  /**
   * Get namespace URI by prefix
   */
  getNamespace(prefix) {
    return this.namespaces.get(prefix);
  }

  /**
   * Get all namespaces
   */
  getNamespaces() {
    return Object.fromEntries(this.namespaces);
  }

  /**
   * Process RDF file
   */
  async processRDFFile(filePath, format = null, options = {}) {
    const fs = await import('fs/promises');
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const detectedFormat = format || this.detectFormat(filePath);
      
      const parsed = await this.parseRDF(data, detectedFormat, options);
      
      if (options.addToStore !== false) {
        this.addQuads(parsed.quads, options.graph);
      }
      
      return parsed;
    } catch (error) {
      consola.error(`Error processing RDF file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Detect RDF format from file extension
   */
  detectFormat(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const formatMap = {
      'ttl': 'turtle',
      'turtle': 'turtle',
      'n3': 'n3',
      'nt': 'ntriples',
      'nq': 'nquads',
      'rdf': 'rdfxml',
      'xml': 'rdfxml',
      'jsonld': 'jsonld',
      'json': 'jsonld'
    };
    
    return formatMap[ext] || 'turtle';
  }
}