import { Store, Quad, NamedNode, Literal, BlankNode, DataFactory } from 'n3';
import type { Term } from 'n3';
import { CommonVocabularies, CommonProperties } from './types/turtle-types.js';

const { namedNode, literal, quad } = DataFactory;

export interface RDFFilterOptions {
  store?: Store;
  prefixes?: Record<string, string>;
  baseUri?: string;
}

export interface RDFQueryPattern {
  subject?: string | null;
  predicate?: string | null;
  object?: string | null;
  graph?: string | null;
}

export interface RDFFilterResult {
  value: string | string[];
  type: 'literal' | 'uri' | 'blank';
  datatype?: string;
  language?: string;
}

/**
 * RDF Filter functions for Nunjucks templates
 * Provides a comprehensive set of filters for querying and manipulating RDF data
 */
export class RDFFilters {
  private store: Store;
  private prefixes: Record<string, string>;
  private baseUri: string;

  constructor(options: RDFFilterOptions = {}) {
    this.store = options.store || new Store();
    this.prefixes = {
      rdf: CommonVocabularies.RDF,
      rdfs: CommonVocabularies.RDFS,
      owl: CommonVocabularies.OWL,
      dc: CommonVocabularies.DCTERMS,
      foaf: CommonVocabularies.FOAF,
      skos: CommonVocabularies.SKOS,
      schema: CommonVocabularies.SCHEMA,
      xsd: CommonVocabularies.XSD,
      ex: 'http://example.org/', // Add default 'ex' prefix for tests
      ...options.prefixes,
    };
    this.baseUri = options.baseUri || 'http://example.org/';
  }

  /**
   * Update the internal store with new quads
   */
  updateStore(quads: Quad[]): void {
    this.store.addQuads(quads);
  }

  /**
   * Clear the internal store
   */
  clearStore(): void {
    this.store = new Store();
  }

  /**
   * 1. rdfSubject(predicate, object) - find subjects
   * Find all subjects that have a given predicate-object pair
   */
  rdfSubject = (predicate: string, object: string): string[] => {
    try {
      const predicateTerm = this.expandTerm(predicate);
      const objectTerm = this.expandTerm(object);
      
      const quads = this.store.getQuads(null, predicateTerm, objectTerm, null);
      
      return quads
        .map(quad => this.termToString(quad.subject))
        .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates
    } catch (error) {
      console.warn(`RDF filter rdfSubject error:`, error);
      return [];
    }
  };

  /**
   * 2. rdfObject(subject, predicate) - get objects  
   * Find all objects for a given subject-predicate pair
   */
  rdfObject = (subject: string, predicate: string): RDFFilterResult[] => {
    try {
      const subjectTerm = this.expandTerm(subject);
      const predicateTerm = this.expandTerm(predicate);
      
      const quads = this.store.getQuads(subjectTerm, predicateTerm, null, null);
      
      return quads.map(quad => this.termToFilterResult(quad.object));
    } catch (error) {
      console.warn(`RDF filter rdfObject error:`, error);
      return [];
    }
  };

  /**
   * 3. rdfPredicate(subject, object) - find predicates
   * Find all predicates connecting a given subject-object pair
   */
  rdfPredicate = (subject: string, object: string): string[] => {
    try {
      const subjectTerm = this.expandTerm(subject);
      const objectTerm = this.expandTerm(object);
      
      const quads = this.store.getQuads(subjectTerm, null, objectTerm, null);
      
      return quads
        .map(quad => this.termToString(quad.predicate))
        .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates
    } catch (error) {
      console.warn(`RDF filter rdfPredicate error:`, error);
      return [];
    }
  };

  /**
   * 4. rdfQuery(pattern) - SPARQL-like pattern matching
   * Execute a basic triple pattern query
   */
  rdfQuery = (pattern: RDFQueryPattern | string): RDFFilterResult[][] => {
    try {
      let queryPattern: RDFQueryPattern;
      
      if (typeof pattern === 'string') {
        // Parse simple pattern string like "?s rdf:type foaf:Person"
        queryPattern = this.parsePatternString(pattern);
      } else {
        queryPattern = pattern;
      }

      const subject = queryPattern.subject ? this.expandTerm(queryPattern.subject) : null;
      const predicate = queryPattern.predicate ? this.expandTerm(queryPattern.predicate) : null;
      const object = queryPattern.object ? this.expandTerm(queryPattern.object) : null;
      const graph = queryPattern.graph ? this.expandTerm(queryPattern.graph) : null;
      
      const quads = this.store.getQuads(subject, predicate, object, graph);
      
      return quads.map(quad => [
        this.termToFilterResult(quad.subject),
        this.termToFilterResult(quad.predicate),
        this.termToFilterResult(quad.object),
      ]);
    } catch (error) {
      console.warn(`RDF filter rdfQuery error:`, error);
      return [];
    }
  };

  /**
   * 5. rdfLabel(resource) - get rdfs:label or skos:prefLabel
   * Get the best available label for a resource
   */
  rdfLabel = (resource: string): string => {
    try {
      const resourceTerm = this.expandTerm(resource);
      
      // Try rdfs:label first
      const labelQuads = this.store.getQuads(resourceTerm, namedNode(CommonProperties.LABEL), null, null);
      if (labelQuads.length > 0) {
        return this.termToString(labelQuads[0].object);
      }
      
      // Try skos:prefLabel
      const prefLabelQuads = this.store.getQuads(resourceTerm, namedNode(CommonProperties.PREF_LABEL), null, null);
      if (prefLabelQuads.length > 0) {
        return this.termToString(prefLabelQuads[0].object);
      }
      
      // Try dc:title
      const titleQuads = this.store.getQuads(resourceTerm, namedNode(CommonProperties.TITLE), null, null);
      if (titleQuads.length > 0) {
        return this.termToString(titleQuads[0].object);
      }
      
      // Try foaf:name
      const nameQuads = this.store.getQuads(resourceTerm, namedNode(CommonProperties.NAME), null, null);
      if (nameQuads.length > 0) {
        return this.termToString(nameQuads[0].object);
      }
      
      // Fall back to local name or URI
      return this.getLocalName(resource);
    } catch (error) {
      console.warn(`RDF filter rdfLabel error:`, error);
      return this.getLocalName(resource);
    }
  };

  /**
   * 6. rdfType(resource) - get rdf:type
   * Get all types for a resource
   */
  rdfType = (resource: string): string[] => {
    try {
      const resourceTerm = this.expandTerm(resource);
      const typeQuads = this.store.getQuads(resourceTerm, namedNode(CommonProperties.TYPE), null, null);
      
      return typeQuads.map(quad => this.termToString(quad.object));
    } catch (error) {
      console.warn(`RDF filter rdfType error:`, error);
      return [];
    }
  };

  /**
   * 7. rdfNamespace(prefix) - resolve namespace prefixes
   * Resolve a namespace prefix to its full URI
   */
  rdfNamespace = (prefix: string): string => {
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
  rdfGraph = (graphName?: string): RDFFilterResult[][] => {
    try {
      const graph = graphName ? this.expandTerm(graphName) : null;
      const quads = this.store.getQuads(null, null, null, graph);
      
      return quads.map(quad => [
        this.termToFilterResult(quad.subject),
        this.termToFilterResult(quad.predicate),
        this.termToFilterResult(quad.object),
      ]);
    } catch (error) {
      console.warn(`RDF filter rdfGraph error:`, error);
      return [];
    }
  };

  /**
   * Additional utility filters
   */

  /**
   * rdfExpand(prefixed) - expand a prefixed URI to full URI
   */
  rdfExpand = (prefixed: string): string => {
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
  rdfCompact = (uri: string): string => {
    try {
      for (const [prefix, namespace] of Object.entries(this.prefixes)) {
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
  rdfCount = (subject?: string, predicate?: string, object?: string): number => {
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
  rdfExists = (subject: string, predicate?: string, object?: string): boolean => {
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

  private expandTerm(term: string): Term {
    if (!term || term === '?s' || term === '?p' || term === '?o') {
      return null as any; // Variable binding
    }
    
    if (term.startsWith('_:')) {
      // Blank node
      return new BlankNode(term.substring(2));
    }
    
    if (term.startsWith('http://') || term.startsWith('https://')) {
      // Full URI
      return namedNode(term);
    }
    
    if (term.includes(':') && !term.startsWith('http://') && !term.startsWith('https://')) {
      // Prefixed URI - expand it
      const expanded = this.expandURI(term);
      return namedNode(expanded);
    }
    
    // Check if it's a quoted literal
    if ((term.startsWith('"') && term.endsWith('"')) || 
        (term.startsWith("'") && term.endsWith("'"))) {
      return literal(term.slice(1, -1));
    }
    
    // If it contains quotes anywhere, treat as literal
    if (term.includes('"') || term.includes("'")) {
      return literal(term.replace(/^["'](.*?)["']$/, '$1'));
    }
    
    // If it looks like a number, treat as literal
    if (/^\d+(\.\d+)?$/.test(term)) {
      return literal(term);
    }
    
    // Otherwise, assume it's a relative URI or unqualified name
    // Try to resolve as prefixed URI first
    if (term.includes(':')) {
      const expanded = this.expandURI(term);
      return namedNode(expanded);
    }
    
    // Last resort - treat as literal
    return literal(term);
  }

  private expandURI(prefixed: string): string {
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

  private termToString(term: Term): string {
    if (term.termType === 'NamedNode') {
      return term.value;
    } else if (term.termType === 'Literal') {
      return term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value;
  }

  private termToFilterResult(term: Term): RDFFilterResult {
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

  private getLocalName(uri: string): string {
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const colonIndex = uri.lastIndexOf(':');
    
    const index = Math.max(hashIndex, slashIndex, colonIndex);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  private parsePatternString(pattern: string): RDFQueryPattern {
    // Simple pattern parsing for "?s rdf:type foaf:Person" style queries
    const parts = pattern.trim().split(/\s+/);
    
    if (parts.length !== 3) {
      throw new Error(`Invalid pattern: expected 3 parts, got ${parts.length}`);
    }
    
    return {
      subject: parts[0] === '?s' ? null : parts[0],
      predicate: parts[1] === '?p' ? null : parts[1],
      object: parts[2] === '?o' ? null : parts[2],
    };
  }

  /**
   * Get all filter functions as an object for Nunjucks registration
   */
  getAllFilters(): Record<string, Function> {
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
 * Factory function to create RDF filters for Nunjucks
 */
export function createRDFFilters(options: RDFFilterOptions = {}): Record<string, Function> {
  const rdfFilters = new RDFFilters(options);
  return rdfFilters.getAllFilters();
}

/**
 * Helper function to register RDF filters with a Nunjucks environment
 */
export function registerRDFFilters(
  nunjucksEnv: any,
  options: RDFFilterOptions = {}
): void {
  const filters = createRDFFilters(options);
  
  for (const [name, filter] of Object.entries(filters)) {
    nunjucksEnv.addFilter(name, filter);
  }
}

export default RDFFilters;