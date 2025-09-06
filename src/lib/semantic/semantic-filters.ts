/**
 * Semantic Nunjucks Filters - Advanced RDF-aware template filters
 * Provides semantic reasoning, ontology querying, and compliance validation
 */

import { Store, Quad, DataFactory } from 'n3';
import type { 
  RDFResource, 
  RDFValue,
  RDFTemplateContext
} from '../types/turtle-types.js';

/**
 * SPARQL-like query interface for templates
 */
export interface SemanticQuery {
  select?: string[];
  where: Array<{
    subject?: string;
    predicate?: string;
    object?: string;
    graph?: string;
  }>;
  filter?: string;
  orderBy?: string;
  limit?: number;
}

/**
 * Ontology constraint validation result
 */
export interface ConstraintValidationResult {
  valid: boolean;
  violations: Array<{
    type: 'domain' | 'range' | 'cardinality' | 'datatype';
    property: string;
    subject?: string;
    object?: string;
    message: string;
  }>;
}

/**
 * Semantic filter registry and implementations
 */
export class SemanticFilters {
  private stores: Map<string, Store> = new Map();
  private prefixes: Map<string, Record<string, string>> = new Map();

  constructor() {
    // Initialize with common prefixes
    const commonPrefixes = {
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl': 'http://www.w3.org/2002/07/owl#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'dcterms': 'http://purl.org/dc/terms/',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'skos': 'http://www.w3.org/2004/02/skos/core#',
      'schema': 'https://schema.org/'
    };
    
    this.prefixes.set('common', commonPrefixes);
  }

  /**
   * Register ontology store for semantic operations
   */
  registerStore(name: string, store: Store, prefixes: Record<string, string> = {}): void {
    this.stores.set(name, store);
    this.prefixes.set(name, { ...this.prefixes.get('common') || {}, ...prefixes });
  }

  /**
   * Get all semantic filters for Nunjucks registration
   */
  getAllFilters(): Record<string, Function> {
    return {
      // Basic RDF querying
      'sparql': this.sparqlQuery.bind(this),
      'rdfQuery': this.rdfQuery.bind(this),
      'hasProperty': this.hasProperty.bind(this),
      'getProperty': this.getProperty.bind(this),
      'getAllProperties': this.getAllProperties.bind(this),
      
      // Semantic reasoning
      'instanceOf': this.instanceOf.bind(this),
      'subClassOf': this.subClassOf.bind(this),
      'hasType': this.hasType.bind(this),
      'inferTypes': this.inferTypes.bind(this),
      'getClassHierarchy': this.getClassHierarchy.bind(this),
      
      // Ontology validation
      'validateDomain': this.validateDomain.bind(this),
      'validateRange': this.validateRange.bind(this),
      'validateCardinality': this.validateCardinality.bind(this),
      'checkConstraints': this.checkConstraints.bind(this),
      
      // URI manipulation
      'expandUri': this.expandUri.bind(this),
      'compactUri': this.compactUri.bind(this),
      'getLocalName': this.getLocalName.bind(this),
      'getNamespace': this.getNamespace.bind(this),
      
      // Data transformation
      'rdfToJson': this.rdfToJson.bind(this),
      'jsonToRdf': this.jsonToRdf.bind(this),
      'serializeTurtle': this.serializeTurtle.bind(this),
      'parseDatatype': this.parseDatatype.bind(this),
      
      // Compliance and validation
      'validateCompliance': this.validateCompliance.bind(this),
      'checkRule': this.checkRule.bind(this),
      'auditTrail': this.auditTrail.bind(this),
      
      // Performance and caching
      'memoizeQuery': this.memoizeQuery.bind(this),
      'cacheResult': this.cacheResult.bind(this)
    };
  }

  /**
   * Execute SPARQL-like query on ontology store
   * Usage: {{ store | sparql(query) }}
   */
  sparqlQuery(storeName: string, query: SemanticQuery | string): any[] {
    const store = this.stores.get(storeName);
    if (!store) {
      throw new Error(`Store not found: ${storeName}`);
    }

    if (typeof query === 'string') {
      // Simple triple pattern query
      const parts = query.split(/\s+/);
      const [subject, predicate, object] = parts;
      
      const results: any[] = [];
      const quads = store.getQuads(
        subject !== '?' ? this.expandUri(subject, storeName) : null,
        predicate !== '?' ? this.expandUri(predicate, storeName) : null,
        object !== '?' ? this.expandUri(object, storeName) : null,
        null
      );
      
      for (const quad of quads) {
        results.push({
          subject: this.termToValue(quad.subject),
          predicate: this.termToValue(quad.predicate),
          object: this.termToValue(quad.object)
        });
      }
      
      return results;
    }

    // Complex query object
    return this.executeComplexQuery(store, storeName, query);
  }

  /**
   * Basic RDF query filter
   * Usage: {{ ontology | rdfQuery(subject, predicate, object) }}
   */
  rdfQuery(storeName: string, subject?: string, predicate?: string, object?: string): any[] {
    const store = this.stores.get(storeName);
    if (!store) return [];

    const quads = store.getQuads(
      subject ? this.expandUri(subject, storeName) : null,
      predicate ? this.expandUri(predicate, storeName) : null,
      object ? this.expandUri(object, storeName) : null,
      null
    );

    return quads.map(quad => ({
      subject: this.termToValue(quad.subject),
      predicate: this.termToValue(quad.predicate),
      object: this.termToValue(quad.object)
    }));
  }

  /**
   * Check if resource has specific property
   * Usage: {{ resource | hasProperty(property, storeName) }}
   */
  hasProperty(resource: string, property: string, storeName: string): boolean {
    const store = this.stores.get(storeName);
    if (!store) return false;

    const resourceUri = this.expandUri(resource, storeName);
    const propertyUri = this.expandUri(property, storeName);
    
    const quads = store.getQuads(resourceUri, propertyUri, null, null);
    return quads.length > 0;
  }

  /**
   * Get property values for resource
   * Usage: {{ resource | getProperty(property, storeName) }}
   */
  getProperty(resource: string, property: string, storeName: string): any[] {
    const store = this.stores.get(storeName);
    if (!store) return [];

    const resourceUri = this.expandUri(resource, storeName);
    const propertyUri = this.expandUri(property, storeName);
    
    const quads = store.getQuads(resourceUri, propertyUri, null, null);
    return quads.map(quad => this.termToValue(quad.object));
  }

  /**
   * Get all properties and values for resource
   * Usage: {{ resource | getAllProperties(storeName) }}
   */
  getAllProperties(resource: string, storeName: string): Record<string, any[]> {
    const store = this.stores.get(storeName);
    if (!store) return {};

    const resourceUri = this.expandUri(resource, storeName);
    const quads = store.getQuads(resourceUri, null, null, null);
    
    const properties: Record<string, any[]> = {};
    for (const quad of quads) {
      const prop = this.compactUri(quad.predicate.value, storeName);
      if (!properties[prop]) {
        properties[prop] = [];
      }
      properties[prop].push(this.termToValue(quad.object));
    }
    
    return properties;
  }

  /**
   * Check if resource is instance of class
   * Usage: {{ resource | instanceOf(className, storeName) }}
   */
  instanceOf(resource: string, className: string, storeName: string): boolean {
    const store = this.stores.get(storeName);
    if (!store) return false;

    const resourceUri = this.expandUri(resource, storeName);
    const classUri = this.expandUri(className, storeName);
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    const typeQuads = store.getQuads(resourceUri, rdfType, classUri, null);
    return typeQuads.length > 0;
  }

  /**
   * Check if class is subclass of another
   * Usage: {{ class1 | subClassOf(class2, storeName) }}
   */
  subClassOf(subClass: string, superClass: string, storeName: string): boolean {
    const store = this.stores.get(storeName);
    if (!store) return false;

    const subClassUri = this.expandUri(subClass, storeName);
    const superClassUri = this.expandUri(superClass, storeName);
    const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    
    // Direct subclass relationship
    const directQuads = store.getQuads(subClassUri, rdfsSubClassOf, superClassUri, null);
    if (directQuads.length > 0) return true;
    
    // Transitive subclass relationship (basic inference)
    const subclassQuads = store.getQuads(subClassUri, rdfsSubClassOf, null, null);
    for (const quad of subclassQuads) {
      if (quad.object.termType === 'NamedNode') {
        if (this.subClassOf(quad.object.value, superClass, storeName)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all types for resource (including inferred)
   * Usage: {{ resource | hasType(storeName) }}
   */
  hasType(resource: string, storeName: string): string[] {
    const store = this.stores.get(storeName);
    if (!store) return [];

    const resourceUri = this.expandUri(resource, storeName);
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    
    const typeQuads = store.getQuads(resourceUri, rdfType, null, null);
    return typeQuads
      .filter(quad => quad.object.termType === 'NamedNode')
      .map(quad => this.compactUri(quad.object.value, storeName));
  }

  /**
   * Infer additional types based on domain/range
   * Usage: {{ resource | inferTypes(storeName) }}
   */
  inferTypes(resource: string, storeName: string): string[] {
    const inferredTypes: string[] = [];
    const store = this.stores.get(storeName);
    if (!store) return inferredTypes;

    const resourceUri = this.expandUri(resource, storeName);
    
    // Get all properties where this resource is subject
    const subjectQuads = store.getQuads(resourceUri, null, null, null);
    
    for (const quad of subjectQuads) {
      // Check domain constraints
      const domainTypes = this.getPropertyDomain(quad.predicate.value, storeName);
      inferredTypes.push(...domainTypes);
    }

    // Get all properties where this resource is object  
    const objectQuads = store.getQuads(null, null, resourceUri, null);
    
    for (const quad of objectQuads) {
      // Check range constraints
      const rangeTypes = this.getPropertyRange(quad.predicate.value, storeName);
      inferredTypes.push(...rangeTypes);
    }

    // Remove duplicates and return
    return [...new Set(inferredTypes)];
  }

  /**
   * Get class hierarchy for a class
   * Usage: {{ className | getClassHierarchy(storeName) }}
   */
  getClassHierarchy(className: string, storeName: string): any {
    const store = this.stores.get(storeName);
    if (!store) return null;

    const classUri = this.expandUri(className, storeName);
    const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    
    const hierarchy = {
      class: this.compactUri(classUri, storeName),
      superClasses: [] as string[],
      subClasses: [] as string[]
    };

    // Get super classes
    const superQuads = store.getQuads(classUri, rdfsSubClassOf, null, null);
    hierarchy.superClasses = superQuads
      .filter(quad => quad.object.termType === 'NamedNode')
      .map(quad => this.compactUri(quad.object.value, storeName));

    // Get sub classes
    const subQuads = store.getQuads(null, rdfsSubClassOf, classUri, null);
    hierarchy.subClasses = subQuads
      .filter(quad => quad.subject.termType === 'NamedNode')
      .map(quad => this.compactUri(quad.subject.value, storeName));

    return hierarchy;
  }

  /**
   * Validate domain constraint
   * Usage: {{ property | validateDomain(resource, storeName) }}
   */
  validateDomain(property: string, resource: string, storeName: string): boolean {
    const domainTypes = this.getPropertyDomain(property, storeName);
    if (domainTypes.length === 0) return true; // No domain constraint
    
    const resourceTypes = this.hasType(resource, storeName);
    
    // Check if resource has any of the domain types
    return domainTypes.some(domainType => 
      resourceTypes.includes(domainType) ||
      resourceTypes.some(resourceType => this.subClassOf(resourceType, domainType, storeName))
    );
  }

  /**
   * Validate range constraint
   * Usage: {{ property | validateRange(object, storeName) }}
   */
  validateRange(property: string, object: string, storeName: string): boolean {
    const rangeTypes = this.getPropertyRange(property, storeName);
    if (rangeTypes.length === 0) return true; // No range constraint
    
    // For literal values, check datatype
    if (object.startsWith('"')) {
      // Extract datatype from literal
      const datatypeMatch = object.match(/\^\^<(.+)>/);
      if (datatypeMatch) {
        const datatype = this.compactUri(datatypeMatch[1], storeName);
        return rangeTypes.includes(datatype);
      }
      return rangeTypes.includes('xsd:string'); // Default to string
    }
    
    // For resources, check type
    const objectTypes = this.hasType(object, storeName);
    return rangeTypes.some(rangeType =>
      objectTypes.includes(rangeType) ||
      objectTypes.some(objectType => this.subClassOf(objectType, rangeType, storeName))
    );
  }

  /**
   * Validate cardinality constraints
   * Usage: {{ resource | validateCardinality(property, storeName) }}
   */
  validateCardinality(resource: string, property: string, storeName: string): boolean {
    const propertyValues = this.getProperty(resource, property, storeName);
    const constraints = this.getCardinalityConstraints(property, storeName);
    
    if (constraints.minCardinality !== undefined && propertyValues.length < constraints.minCardinality) {
      return false;
    }
    
    if (constraints.maxCardinality !== undefined && propertyValues.length > constraints.maxCardinality) {
      return false;
    }
    
    return true;
  }

  /**
   * Check all ontology constraints for resource
   * Usage: {{ resource | checkConstraints(storeName) }}
   */
  checkConstraints(resource: string, storeName: string): ConstraintValidationResult {
    const result: ConstraintValidationResult = {
      valid: true,
      violations: []
    };

    const properties = this.getAllProperties(resource, storeName);
    
    for (const [property, values] of Object.entries(properties)) {
      // Domain validation
      if (!this.validateDomain(property, resource, storeName)) {
        result.valid = false;
        result.violations.push({
          type: 'domain',
          property,
          subject: resource,
          message: `Resource ${resource} violates domain constraint for property ${property}`
        });
      }

      // Range validation
      for (const value of values) {
        if (!this.validateRange(property, String(value), storeName)) {
          result.valid = false;
          result.violations.push({
            type: 'range',
            property,
            subject: resource,
            object: String(value),
            message: `Value ${value} violates range constraint for property ${property}`
          });
        }
      }

      // Cardinality validation
      if (!this.validateCardinality(resource, property, storeName)) {
        result.valid = false;
        result.violations.push({
          type: 'cardinality',
          property,
          subject: resource,
          message: `Property ${property} violates cardinality constraints for resource ${resource}`
        });
      }
    }

    return result;
  }

  /**
   * Expand prefixed URI to full URI
   * Usage: {{ prefixed | expandUri(storeName) }}
   */
  expandUri(uri: string, storeName: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('urn:')) {
      return uri;
    }

    const prefixes = this.prefixes.get(storeName) || this.prefixes.get('common') || {};
    const colonIndex = uri.indexOf(':');
    
    if (colonIndex > 0) {
      const prefix = uri.substring(0, colonIndex);
      const localName = uri.substring(colonIndex + 1);
      
      if (prefixes[prefix]) {
        return prefixes[prefix] + localName;
      }
    }

    return uri;
  }

  /**
   * Compact full URI to prefixed form
   * Usage: {{ fullUri | compactUri(storeName) }}
   */
  compactUri(uri: string, storeName: string): string {
    const prefixes = this.prefixes.get(storeName) || this.prefixes.get('common') || {};
    
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (uri.startsWith(namespace)) {
        const localName = uri.substring(namespace.length);
        return `${prefix}:${localName}`;
      }
    }

    return uri;
  }

  /**
   * Get local name from URI
   * Usage: {{ uri | getLocalName }}
   */
  getLocalName(uri: string): string {
    if (uri.includes('#')) {
      return uri.split('#').pop() || '';
    }
    if (uri.includes('/')) {
      return uri.split('/').pop() || '';
    }
    return uri;
  }

  /**
   * Get namespace from URI
   * Usage: {{ uri | getNamespace }}
   */
  getNamespace(uri: string): string {
    if (uri.includes('#')) {
      return uri.substring(0, uri.lastIndexOf('#') + 1);
    }
    if (uri.includes('/')) {
      return uri.substring(0, uri.lastIndexOf('/') + 1);
    }
    return '';
  }

  // Helper methods
  private executeComplexQuery(store: Store, storeName: string, query: SemanticQuery): any[] {
    // TODO: Implement full SPARQL-like query execution
    // This would include joins, filters, ordering, grouping, etc.
    return [];
  }

  private termToValue(term: any): any {
    if (term.termType === 'NamedNode') {
      return term.value;
    } else if (term.termType === 'Literal') {
      // Convert based on datatype
      if (term.datatype) {
        const datatype = term.datatype.value;
        if (datatype === 'http://www.w3.org/2001/XMLSchema#integer') {
          return parseInt(term.value, 10);
        } else if (datatype === 'http://www.w3.org/2001/XMLSchema#decimal' ||
                   datatype === 'http://www.w3.org/2001/XMLSchema#double') {
          return parseFloat(term.value);
        } else if (datatype === 'http://www.w3.org/2001/XMLSchema#boolean') {
          return term.value === 'true';
        } else if (datatype === 'http://www.w3.org/2001/XMLSchema#dateTime' ||
                   datatype === 'http://www.w3.org/2001/XMLSchema#date') {
          return new Date(term.value);
        }
      }
      return term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value;
  }

  private getPropertyDomain(property: string, storeName: string): string[] {
    const store = this.stores.get(storeName);
    if (!store) return [];

    const propertyUri = this.expandUri(property, storeName);
    const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';
    
    const domainQuads = store.getQuads(propertyUri, rdfsDomain, null, null);
    return domainQuads
      .filter(quad => quad.object.termType === 'NamedNode')
      .map(quad => this.compactUri(quad.object.value, storeName));
  }

  private getPropertyRange(property: string, storeName: string): string[] {
    const store = this.stores.get(storeName);
    if (!store) return [];

    const propertyUri = this.expandUri(property, storeName);
    const rdfsRange = 'http://www.w3.org/2000/01/rdf-schema#range';
    
    const rangeQuads = store.getQuads(propertyUri, rdfsRange, null, null);
    return rangeQuads
      .filter(quad => quad.object.termType === 'NamedNode')
      .map(quad => this.compactUri(quad.object.value, storeName));
  }

  private getCardinalityConstraints(property: string, storeName: string): {
    minCardinality?: number;
    maxCardinality?: number;
    exactCardinality?: number;
  } {
    // TODO: Implement cardinality constraint extraction from OWL ontologies
    return {};
  }

  // Placeholder implementations for remaining filters
  private rdfToJson(data: any): any { return data; }
  private jsonToRdf(data: any): any { return data; }
  private serializeTurtle(data: any): string { return ''; }
  private parseDatatype(value: string, datatype: string): any { return value; }
  private validateCompliance(resource: string, framework: string): boolean { return true; }
  private checkRule(resource: string, rule: string): boolean { return true; }
  private auditTrail(resource: string): any[] { return []; }
  private memoizeQuery(query: any): any { return query; }
  private cacheResult(result: any): any { return result; }
}

export default SemanticFilters;