/**
 * RDF Data Integration Layer for Deterministic Rendering
 * 
 * Provides semantic enrichment and RDF context processing for templates:
 * - RDF graph parsing and normalization
 * - Semantic context extraction
 * - SPARQL query execution against context
 * - Ontology-driven data transformation
 * - Deterministic RDF serialization
 */

import { Parser, Writer, Store, DataFactory, Quad } from 'n3';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { Logger } from 'consola';

const { namedNode, literal, blankNode, quad } = DataFactory;

export class RDFIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // RDF processing settings
      defaultFormat: options.defaultFormat || 'turtle',
      enableNormalization: options.enableNormalization !== false,
      sortTriples: options.sortTriples !== false,
      
      // Namespace management
      namespaces: {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        kgen: 'http://kgen.dev/ontology#',
        ...options.namespaces
      },
      
      // Template context enrichment
      enableSemanticEnrichment: options.enableSemanticEnrichment !== false,
      extractEntities: options.extractEntities !== false,
      extractRelationships: options.extractRelationships !== false,
      
      // Caching
      enableCaching: options.enableCaching !== false,
      
      ...options
    };
    
    this.logger = new Logger({ tag: 'rdf-integration' });
    
    // RDF store for semantic queries
    this.store = new Store();
    
    // Context cache for performance
    this.contextCache = new Map();
    
    // Namespace prefix mapping
    this.prefixes = new Map();
    this._initializePrefixes();
  }
  
  /**
   * Initialize namespace prefixes
   */
  _initializePrefixes() {
    Object.entries(this.config.namespaces).forEach(([prefix, uri]) => {
      this.prefixes.set(uri, prefix);
      this.prefixes.set(prefix, uri);
    });
  }
  
  /**
   * Parse RDF content and integrate with template context
   */
  async integrateRDFContext(rdfContent, templateContext = {}, format = null) {
    try {
      const contentHash = crypto.createHash('sha256').update(rdfContent).digest('hex');
      
      // Check cache
      if (this.config.enableCaching && this.contextCache.has(contentHash)) {
        this.logger.debug('RDF context cache hit');
        return this._mergeContexts(templateContext, this.contextCache.get(contentHash));
      }
      
      // Parse RDF content
      const triples = await this._parseRDF(rdfContent, format || this.config.defaultFormat);
      
      // Normalize and sort triples for determinism
      const normalizedTriples = this._normalizeTriples(triples);
      
      // Extract semantic context
      const semanticContext = await this._extractSemanticContext(normalizedTriples);
      
      // Cache the semantic context
      if (this.config.enableCaching) {
        this.contextCache.set(contentHash, semanticContext);
      }
      
      // Merge with template context
      const enrichedContext = this._mergeContexts(templateContext, semanticContext);
      
      this.emit('rdf:integrated', { 
        triples: normalizedTriples.length,
        entities: semanticContext.entities?.length || 0,
        relationships: semanticContext.relationships?.length || 0
      });
      
      return enrichedContext;
      
    } catch (error) {
      this.logger.error('Failed to integrate RDF context:', error);
      this.emit('rdf:error', error);
      
      // Return original context on error
      return templateContext;
    }
  }
  
  /**
   * Execute SPARQL query against RDF context
   */
  async executeSPARQLQuery(query, rdfContent = null, format = null) {
    try {
      // Parse RDF content if provided
      if (rdfContent) {
        const triples = await this._parseRDF(rdfContent, format || this.config.defaultFormat);
        
        // Clear and populate store
        this.store = new Store();
        this.store.addQuads(triples);
      }
      
      // Execute query (simplified SPARQL - in production use proper SPARQL engine)
      const results = this._executeSPARQL(query);
      
      return {
        success: true,
        results,
        query,
        resultCount: results.length
      };
      
    } catch (error) {
      this.logger.error('SPARQL query execution failed:', error);
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }
  
  /**
   * Extract entities from RDF graph
   */
  async extractEntities(rdfContent, format = null) {
    try {
      const triples = await this._parseRDF(rdfContent, format || this.config.defaultFormat);
      const entities = new Map();
      
      // Group triples by subject to form entities
      for (const triple of triples) {
        const subject = triple.subject.value;
        
        if (!entities.has(subject)) {
          entities.set(subject, {
            uri: subject,
            type: null,
            properties: {},
            labels: [],
            comments: []
          });
        }
        
        const entity = entities.get(subject);
        const predicate = triple.predicate.value;
        const object = triple.object.value;
        
        // Handle special predicates
        switch (predicate) {
          case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type':
            entity.type = object;
            break;
          case 'http://www.w3.org/2000/01/rdf-schema#label':
            entity.labels.push(object);
            break;
          case 'http://www.w3.org/2000/01/rdf-schema#comment':
            entity.comments.push(object);
            break;
          default:
            if (!entity.properties[predicate]) {
              entity.properties[predicate] = [];
            }
            entity.properties[predicate].push(object);
        }
      }
      
      // Convert to deterministic array
      const entityArray = Array.from(entities.values()).sort((a, b) => 
        a.uri.localeCompare(b.uri)
      );
      
      return entityArray;
      
    } catch (error) {
      this.logger.error('Failed to extract entities:', error);
      return [];
    }
  }
  
  /**
   * Extract relationships from RDF graph
   */
  async extractRelationships(rdfContent, format = null) {
    try {
      const triples = await this._parseRDF(rdfContent, format || this.config.defaultFormat);
      const relationships = [];
      
      for (const triple of triples) {
        // Skip type declarations and metadata
        const predicate = triple.predicate.value;
        if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          continue;
        }
        
        relationships.push({
          subject: triple.subject.value,
          predicate: predicate,
          object: triple.object.value,
          subjectType: triple.subject.termType,
          objectType: triple.object.termType
        });
      }
      
      // Sort for determinism
      relationships.sort((a, b) => {
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
        if (a.predicate !== b.predicate) return a.predicate.localeCompare(b.predicate);
        return a.object.localeCompare(b.object);
      });
      
      return relationships;
      
    } catch (error) {
      this.logger.error('Failed to extract relationships:', error);
      return [];
    }
  }
  
  /**
   * Serialize RDF graph to deterministic format
   */
  async serializeRDF(triples, format = 'turtle') {
    try {
      // Normalize and sort triples
      const normalizedTriples = this._normalizeTriples(triples);
      
      // Create writer with deterministic settings
      const writer = new Writer({ 
        format,
        prefixes: Object.fromEntries(this.prefixes)
      });
      
      // Write triples in sorted order
      for (const triple of normalizedTriples) {
        writer.addQuad(triple);
      }
      
      // Get deterministic serialization
      return new Promise((resolve, reject) => {
        writer.end((error, result) => {
          if (error) {
            reject(error);
          } else {
            // Ensure consistent line endings
            const normalized = result.replace(/\r\n/g, '\n').trim();
            resolve(normalized);
          }
        });
      });
      
    } catch (error) {
      this.logger.error('Failed to serialize RDF:', error);
      throw error;
    }
  }
  
  /**
   * Get namespace-aware context for templates
   */
  getNamespaceContext() {
    const context = {
      namespaces: {},
      prefixes: {}
    };
    
    // Add namespace mappings
    for (const [key, value] of this.prefixes.entries()) {
      if (key.startsWith('http')) {
        // URI -> prefix mapping
        context.namespaces[key] = value;
      } else {
        // prefix -> URI mapping
        context.prefixes[key] = value;
      }
    }
    
    return context;
  }
  
  /**
   * Validate RDF content for deterministic processing
   */
  async validateRDF(rdfContent, format = null) {
    try {
      const issues = [];
      
      // Parse to check syntax
      const triples = await this._parseRDF(rdfContent, format || this.config.defaultFormat);
      
      // Check for blank nodes (non-deterministic)
      const blankNodes = triples.filter(t => 
        t.subject.termType === 'BlankNode' || 
        t.object.termType === 'BlankNode'
      );
      
      if (blankNodes.length > 0) {
        issues.push({
          type: 'blank-nodes',
          count: blankNodes.length,
          message: 'Blank nodes can cause non-deterministic output'
        });
      }
      
      // Check for undefined namespaces
      const undefinedNamespaces = new Set();
      for (const triple of triples) {
        [triple.subject, triple.predicate, triple.object].forEach(term => {
          if (term.termType === 'NamedNode') {
            const uri = term.value;
            const hasKnownPrefix = Array.from(this.prefixes.keys())
              .some(prefix => prefix.startsWith('http') && uri.startsWith(prefix));
            
            if (!hasKnownPrefix && uri.includes('#') || uri.includes('/')) {
              const namespace = uri.substring(0, uri.lastIndexOf(uri.includes('#') ? '#' : '/') + 1);
              undefinedNamespaces.add(namespace);
            }
          }
        });
      }
      
      if (undefinedNamespaces.size > 0) {
        issues.push({
          type: 'undefined-namespaces',
          namespaces: Array.from(undefinedNamespaces),
          message: 'Undefined namespaces may affect deterministic serialization'
        });
      }
      
      return {
        valid: issues.length === 0,
        triples: triples.length,
        issues,
        deterministicScore: Math.max(0, 100 - (issues.length * 25))
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        deterministicScore: 0
      };
    }
  }
  
  /**
   * Clear context cache
   */
  clearCache() {
    this.contextCache.clear();
    this.store = new Store();
    this.logger.debug('RDF integration cache cleared');
  }
  
  // Private helper methods
  
  async _parseRDF(content, format) {
    return new Promise((resolve, reject) => {
      const parser = new Parser({ format });
      const triples = [];
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          triples.push(quad);
        } else {
          // Parsing complete
          resolve(triples);
        }
      });
    });
  }
  
  _normalizeTriples(triples) {
    if (!this.config.enableNormalization) {
      return triples;
    }
    
    // Convert blank nodes to deterministic identifiers
    const blankNodeMap = new Map();
    let blankNodeCounter = 0;
    
    const normalizedTriples = triples.map(triple => {
      let subject = triple.subject;
      let object = triple.object;
      
      // Handle blank nodes
      if (subject.termType === 'BlankNode') {
        if (!blankNodeMap.has(subject.value)) {
          blankNodeMap.set(subject.value, `_:b${blankNodeCounter++}`);
        }
        subject = blankNode(blankNodeMap.get(subject.value));
      }
      
      if (object.termType === 'BlankNode') {
        if (!blankNodeMap.has(object.value)) {
          blankNodeMap.set(object.value, `_:b${blankNodeCounter++}`);
        }
        object = blankNode(blankNodeMap.get(object.value));
      }
      
      return quad(subject, triple.predicate, object, triple.graph);
    });
    
    // Sort triples for deterministic processing
    if (this.config.sortTriples) {
      normalizedTriples.sort((a, b) => {
        const aKey = `${a.subject.value}|${a.predicate.value}|${a.object.value}`;
        const bKey = `${b.subject.value}|${b.predicate.value}|${b.object.value}`;
        return aKey.localeCompare(bKey);
      });
    }
    
    return normalizedTriples;
  }
  
  async _extractSemanticContext(triples) {
    const context = {
      triples: triples.length,
      namespaces: this.getNamespaceContext()
    };
    
    if (this.config.extractEntities) {
      // Convert triples back to RDF content for entity extraction
      const rdfContent = await this.serializeRDF(triples);
      context.entities = await this.extractEntities(rdfContent);
    }
    
    if (this.config.extractRelationships) {
      const rdfContent = await this.serializeRDF(triples);
      context.relationships = await this.extractRelationships(rdfContent);
    }
    
    // Add semantic enrichment
    if (this.config.enableSemanticEnrichment) {
      context.semantic = this._createSemanticSummary(triples);
    }
    
    return context;
  }
  
  _createSemanticSummary(triples) {
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();
    const types = new Set();
    
    for (const triple of triples) {
      subjects.add(triple.subject.value);
      predicates.add(triple.predicate.value);
      objects.add(triple.object.value);
      
      if (triple.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        types.add(triple.object.value);
      }
    }
    
    return {
      subjectCount: subjects.size,
      predicateCount: predicates.size,
      objectCount: objects.size,
      typeCount: types.size,
      tripleCount: triples.length,
      subjects: Array.from(subjects).slice(0, 10).sort(),
      predicates: Array.from(predicates).slice(0, 10).sort(),
      types: Array.from(types).slice(0, 10).sort()
    };
  }
  
  _mergeContexts(templateContext, semanticContext) {
    return {
      ...templateContext,
      rdf: semanticContext,
      // Add shorthand access to common RDF elements
      entities: semanticContext.entities || [],
      relationships: semanticContext.relationships || [],
      namespaces: semanticContext.namespaces || {}
    };
  }
  
  _executeSPARQL(query) {
    // Simplified SPARQL execution - in production, use proper SPARQL engine
    // This is a basic implementation for common SELECT queries
    
    const results = [];
    
    // Basic pattern matching for simple SELECT queries
    if (query.includes('SELECT')) {
      const quads = this.store.getQuads(null, null, null, null);
      
      // Simple subject selection
      if (query.includes('?s ?p ?o')) {
        for (const quad of quads) {
          results.push({
            s: quad.subject.value,
            p: quad.predicate.value,
            o: quad.object.value
          });
        }
      }
    }
    
    return results.slice(0, 100); // Limit results
  }
}

export default RDFIntegration;