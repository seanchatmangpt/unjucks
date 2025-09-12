/**
 * RDF Filters for KGEN Template Engine
 * 
 * Migrated from UNJUCKS with modifications for deterministic behavior.
 * Provides comprehensive RDF querying and manipulation filters for templates.
 */

import { Store, Quad, NamedNode, Literal, BlankNode, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

/**
 * RDF Filter functions for KGEN templates with deterministic behavior
 */
export class RDFFilters {
  constructor(options = {}) {
    this.store = options.store || new Store();
    this.prefixes = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      dcterms: 'http://purl.org/dc/terms/',
      dc: 'http://purl.org/dc/elements/1.1/',
      schema: 'http://schema.org/',
      ex: 'http://example.org/',
      ...options.prefixes,
    };
    this.baseUri = options.baseUri || 'http://example.org/';
    this.queryCache = new Map();
    this.deterministic = options.deterministic !== false;
  }

  /**
   * Clear the RDF store and cache for deterministic behavior
   */
  clearStore() {
    this.store = new Store();
    this.queryCache.clear();
  }

  /**
   * Update the store with new triples
   * @param {Array} triples - RDF triples
   */
  updateStore(triples) {
    this.clearStore();
    
    // Sort triples for deterministic loading order
    const sortedTriples = this.deterministic ? 
      [...triples].sort((a, b) => this.compareTriples(a, b)) : 
      triples;
    
    for (const triple of sortedTriples) {
      try {
        const subject = this.createTerm(triple.subject);
        const predicate = this.createTerm(triple.predicate);
        const object = this.createTerm(triple.object);
        
        const n3Quad = quad(subject, predicate, object);
        this.store.add(n3Quad);
      } catch (error) {
        console.warn('Failed to add triple to store:', error, triple);
      }
    }
  }

  /**
   * Compare triples for deterministic sorting
   * @param {Object} a - First triple
   * @param {Object} b - Second triple
   * @returns {number} Comparison result
   */
  compareTriples(a, b) {
    const aStr = `${a.subject.value}-${a.predicate.value}-${a.object.value}`;
    const bStr = `${b.subject.value}-${b.predicate.value}-${b.object.value}`;
    return aStr.localeCompare(bStr);
  }

  /**
   * Create N3 term from RDF term with deterministic behavior
   * @param {Object} rdfTerm - RDF term object
   * @returns {NamedNode|Literal|BlankNode}
   */
  createTerm(rdfTerm) {
    if (rdfTerm.type === 'uri') {
      return namedNode(rdfTerm.value);
    } else if (rdfTerm.type === 'literal') {
      if (rdfTerm.datatype) {
        return literal(rdfTerm.value, namedNode(rdfTerm.datatype));
      } else if (rdfTerm.language) {
        return literal(rdfTerm.value, rdfTerm.language);
      } else {
        return literal(rdfTerm.value);
      }
    } else if (rdfTerm.type === 'blank') {
      return new BlankNode(rdfTerm.value);
    }
    // Default to named node
    return namedNode(rdfTerm.value);
  }

  /**
   * 1. rdfSubject(predicate, object) - find subjects
   * Find all subjects that have a given predicate-object pair
   */
  rdfSubject = (predicate, object) => {
    try {
      const cacheKey = `subject-${predicate}-${object}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const predicateTerm = this.expandTerm(predicate);
      const objectTerm = this.expandTerm(object);
      
      const quads = this.store.getQuads(null, predicateTerm, objectTerm, null);
      
      const results = quads
        .map(quad => this.termToString(quad.subject))
        .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates

      // Sort for deterministic output
      const sortedResults = this.deterministic ? results.sort() : results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfSubject error:`, error);
      return [];
    }
  };

  /**
   * 2. rdfObject(subject, predicate) - get objects  
   * Find all objects for a given subject-predicate pair
   */
  rdfObject = (subject, predicate) => {
    try {
      const cacheKey = `object-${subject}-${predicate}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const subjectTerm = this.expandTerm(subject);
      const predicateTerm = this.expandTerm(predicate);
      
      const quads = this.store.getQuads(subjectTerm, predicateTerm, null, null);
      
      const results = quads.map(quad => this.termToFilterResult(quad.object));

      // Sort for deterministic output
      const sortedResults = this.deterministic ? 
        results.sort((a, b) => a.value.localeCompare(b.value)) : 
        results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfObject error:`, error);
      return [];
    }
  };

  /**
   * 3. rdfPredicate(subject, object) - find predicates
   * Find all predicates connecting a given subject-object pair
   */
  rdfPredicate = (subject, object) => {
    try {
      const cacheKey = `predicate-${subject}-${object}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const subjectTerm = this.expandTerm(subject);
      const objectTerm = this.expandTerm(object);
      
      const quads = this.store.getQuads(subjectTerm, null, objectTerm, null);
      
      const results = quads
        .map(quad => this.termToString(quad.predicate))
        .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates

      // Sort for deterministic output
      const sortedResults = this.deterministic ? results.sort() : results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfPredicate error:`, error);
      return [];
    }
  };

  /**
   * 4. rdfQuery(pattern) - SPARQL-like pattern matching
   * Execute a basic triple pattern query
   */
  rdfQuery = (pattern) => {
    try {
      const patternStr = typeof pattern === 'string' ? pattern : JSON.stringify(pattern);
      const cacheKey = `query-${patternStr}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      let queryPattern;
      
      if (typeof pattern === 'string') {
        queryPattern = this.parsePatternString(pattern);
      } else {
        queryPattern = pattern;
      }

      const subject = queryPattern.subject ? this.expandTerm(queryPattern.subject) : null;
      const predicate = queryPattern.predicate ? this.expandTerm(queryPattern.predicate) : null;
      const object = queryPattern.object ? this.expandTerm(queryPattern.object) : null;
      const graph = queryPattern.graph ? this.expandTerm(queryPattern.graph) : null;
      
      const quads = this.store.getQuads(subject, predicate, object, graph);
      
      const results = quads.map(quad => [
        this.termToFilterResult(quad.subject),
        this.termToFilterResult(quad.predicate),
        this.termToFilterResult(quad.object),
      ]);

      // Sort for deterministic output
      const sortedResults = this.deterministic ? 
        results.sort((a, b) => a[0].value.localeCompare(b[0].value)) : 
        results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfQuery error:`, error);
      return [];
    }
  };

  /**
   * 5. rdfLabel(resource) - get rdfs:label or skos:prefLabel
   * Get the best available label for a resource
   */
  rdfLabel = (resource) => {
    try {
      const cacheKey = `label-${resource}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const resourceTerm = this.expandTerm(resource);
      
      // Try different label properties in order of preference
      const labelProperties = [
        'http://www.w3.org/2000/01/rdf-schema#label',
        'http://www.w3.org/2004/02/skos/core#prefLabel',
        'http://purl.org/dc/terms/title',
        'http://xmlns.com/foaf/0.1/name'
      ];

      for (const labelProp of labelProperties) {
        const labelQuads = this.store.getQuads(resourceTerm, namedNode(labelProp), null, null);
        if (labelQuads.length > 0) {
          const result = this.termToString(labelQuads[0].object);
          this.queryCache.set(cacheKey, result);
          return result;
        }
      }
      
      // Fall back to local name or URI
      const result = this.getLocalName(resource);
      this.queryCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.warn(`RDF filter rdfLabel error:`, error);
      return this.getLocalName(resource);
    }
  };

  /**
   * 6. rdfType(resource) - get rdf:type
   * Get all types for a resource
   */
  rdfType = (resource) => {
    try {
      const cacheKey = `type-${resource}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const resourceTerm = this.expandTerm(resource);
      const typeQuads = this.store.getQuads(resourceTerm, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null);
      
      const results = typeQuads.map(quad => this.termToString(quad.object));
      
      // Sort for deterministic output
      const sortedResults = this.deterministic ? results.sort() : results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfType error:`, error);
      return [];
    }
  };

  /**
   * 7. rdfNamespace(prefix) - resolve namespace prefixes
   * Resolve a namespace prefix to its full URI
   */
  rdfNamespace = (prefix) => {
    try {
      const namespace = this.prefixes[prefix];
      if (!namespace) {
        console.warn(`Unknown prefix: ${prefix}`);
        return prefix;
      }
      return namespace;
    } catch (error) {
      console.warn(`RDF filter rdfNamespace error:`, error);
      return prefix;
    }
  };

  /**
   * 8. rdfGraph(name) - filter by named graph
   * Get all triples from a specific named graph
   */
  rdfGraph = (graphName) => {
    try {
      const cacheKey = `graph-${graphName || 'default'}`;
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      const graph = graphName ? this.expandTerm(graphName) : null;
      const quads = this.store.getQuads(null, null, null, graph);
      
      const results = quads.map(quad => [
        this.termToFilterResult(quad.subject),
        this.termToFilterResult(quad.predicate),
        this.termToFilterResult(quad.object),
      ]);

      // Sort for deterministic output
      const sortedResults = this.deterministic ? 
        results.sort((a, b) => a[0].value.localeCompare(b[0].value)) : 
        results;
      
      this.queryCache.set(cacheKey, sortedResults);
      return sortedResults;
    } catch (error) {
      console.warn(`RDF filter rdfGraph error:`, error);
      return [];
    }
  };

  /**
   * rdfExpand(prefixed) - expand a prefixed URI to full URI
   */
  rdfExpand = (prefixed) => {
    try {
      return this.expandURI(prefixed);
    } catch (error) {
      console.warn(`RDF filter rdfExpand error:`, error);
      return prefixed;
    }
  };

  /**
   * rdfCompact(uri) - compact a full URI to prefixed form
   */
  rdfCompact = (uri) => {
    try {
      // Sort prefixes for deterministic output
      const sortedPrefixes = Object.entries(this.prefixes).sort(([,a], [,b]) => b.length - a.length);
      
      for (const [prefix, namespace] of sortedPrefixes) {
        if (uri.startsWith(namespace)) {
          return `${prefix}:${uri.substring(namespace.length)}`;
        }
      }
      return uri;
    } catch (error) {
      console.warn(`RDF filter rdfCompact error:`, error);
      return uri;
    }
  };

  /**
   * rdfCount(subject?, predicate?, object?) - count matching triples
   */
  rdfCount = (subject, predicate, object) => {
    try {
      const s = subject ? this.expandTerm(subject) : null;
      const p = predicate ? this.expandTerm(predicate) : null;
      const o = object ? this.expandTerm(object) : null;
      
      return this.store.getQuads(s, p, o, null).length;
    } catch (error) {
      console.warn(`RDF filter rdfCount error:`, error);
      return 0;
    }
  };

  /**
   * rdfExists(subject, predicate?, object?) - check if triple exists
   */
  rdfExists = (subject, predicate, object) => {
    try {
      const s = this.expandTerm(subject);
      const p = predicate ? this.expandTerm(predicate) : null;
      const o = object ? this.expandTerm(object) : null;
      
      return this.store.getQuads(s, p, o, null).length > 0;
    } catch (error) {
      console.warn(`RDF filter rdfExists error:`, error);
      return false;
    }
  };

  /**
   * Private helper methods
   */

  expandTerm(term, termType = 'uri', datatype = null) {
    if (!term || term === '?s' || term === '?p' || term === '?o') {
      return null; // Variable binding
    }
    
    if (term.startsWith('_:')) {
      // Blank node
      return new BlankNode(term.substring(2));
    }
    
    if (term.startsWith('http://') || term.startsWith('https://')) {
      // Full URI
      return namedNode(term);
    }
    
    // Handle based on term type from parsed data
    if (termType === 'literal') {
      if (datatype) {
        return literal(term, namedNode(datatype));
      }
      return literal(term);
    }
    
    // Check if it's a quoted literal
    if ((term.startsWith('"') && term.endsWith('"')) || 
        (term.startsWith("'") && term.endsWith("'"))) {
      const literalValue = term.slice(1, -1);
      
      // Check for datatype or language
      const datatypeMatch = term.match(/^"(.*)"\^\^(.+)$/);
      if (datatypeMatch) {
        return literal(datatypeMatch[1], namedNode(this.expandURI(datatypeMatch[2])));
      }
      
      const languageMatch = term.match(/^"(.*)"@(.+)$/);
      if (languageMatch) {
        return literal(languageMatch[1], languageMatch[2]);
      }
      
      return literal(literalValue);
    }
    
    if (term.includes(':') && !term.startsWith('http://') && !term.startsWith('https://')) {
      // Prefixed URI - expand it
      const expanded = this.expandURI(term);
      return namedNode(expanded);
    }
    
    // If it looks like a number, treat as literal
    if (/^\d+(\.\d+)?$/.test(term)) {
      return literal(term);
    }
    
    // Otherwise, assume it's a URI
    return namedNode(term);
  }

  expandURI(prefixed) {
    if (!prefixed.includes(':')) {
      return prefixed;
    }
    
    const [prefix, localName] = prefixed.split(':', 2);
    const namespace = this.prefixes[prefix];
    
    if (namespace) {
      return namespace + localName;
    }
    
    return prefixed;
  }

  termToString(term) {
    if (term.termType === 'NamedNode') {
      return term.value;
    } else if (term.termType === 'Literal') {
      return term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value;
  }

  termToFilterResult(term) {
    if (term.termType === 'NamedNode') {
      return {
        value: term.value,
        type: 'uri',
      };
    } else if (term.termType === 'Literal') {
      return {
        value: term.value,
        type: 'literal',
        datatype: term.datatype?.value,
        language: term.language,
      };
    } else if (term.termType === 'BlankNode') {
      return {
        value: `_:${term.value}`,
        type: 'blank',
      };
    }
    
    return {
      value: term.value,
      type: 'literal',
    };
  }

  getLocalName(uri) {
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const colonIndex = uri.lastIndexOf(':');
    
    const index = Math.max(hashIndex, slashIndex, colonIndex);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  parsePatternString(pattern) {
    // Simple pattern parsing for "?s rdf:type foaf:Person" style queries
    const parts = pattern.trim().split(/\s+/);
    
    if (parts.length !== 3) {
      console.warn(`Invalid pattern: expected 3 parts, got ${parts.length}`);
      return {
        subject: '__INVALID_PATTERN__',
        predicate: '__INVALID_PATTERN__',
        object: '__INVALID_PATTERN__',
      };
    }
    
    return {
      subject: parts[0] === '?s' ? null : parts[0],
      predicate: parts[1] === '?p' ? null : parts[1],
      object: parts[2] === '?o' ? null : parts[2],
    };
  }

  /**
   * Get by type helper method
   * @param {string} typeUri - Type URI to match
   * @returns {Array}
   */
  getByType(typeUri) {
    return this.rdfSubject('rdf:type', typeUri);
  }

  /**
   * Get all filter functions as an object for Nunjucks registration
   */
  getAllFilters() {
    return {
      rdfSubject: this.rdfSubject,
      rdfObject: this.rdfObject,
      rdfPredicate: this.rdfPredicate,
      rdfQuery: this.rdfQuery,
      rdfLabel: this.rdfLabel,
      rdfType: this.rdfType,
      rdfNamespace: this.rdfNamespace,
      rdfGraph: this.rdfGraph,
      rdfExpand: this.rdfExpand,
      rdfCompact: this.rdfCompact,
      rdfCount: this.rdfCount,
      rdfExists: this.rdfExists,
    };
  }
}

/**
 * Factory function to create RDF filters for KGEN
 */
export function createRDFFilters(options = {}) {
  const rdfFilters = new RDFFilters(options);
  return rdfFilters.getAllFilters();
}

/**
 * Helper function to register RDF filters with a Nunjucks environment
 */
export function registerRDFFilters(nunjucksEnv, options = {}) {
  const filters = createRDFFilters(options);
  
  for (const [name, filter] of Object.entries(filters)) {
    nunjucksEnv.addFilter(name, filter);
    if (typeof nunjucksEnv.addGlobal === 'function') {
      nunjucksEnv.addGlobal(name, filter);
    }
  }
}

export default RDFFilters;