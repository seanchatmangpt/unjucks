/**
 * @file RDF Integration
 * @module unjucks-v4/template/rdf-integration
 * @description Integrates RDF data into template context
 */

import { EventEmitter } from 'events';

/**
 * RDF Integration - Integrates RDF data into template context
 * 
 * @class RDFIntegration
 * @extends EventEmitter
 */
export class RDFIntegration extends EventEmitter {
  /**
   * Create a new RDFIntegration instance
   * @param {Object} options - Integration options
   * @param {Object} options.rdfEngine - RDF engine instance
   */
  constructor(options = {}) {
    super();
    
    this.rdfEngine = options.rdfEngine;
    this.config = options;
  }

  /**
   * Load RDF data and integrate into context
   * @param {Object} rdfConfig - RDF configuration from frontmatter
   * @param {Object} context - Template context
   * @returns {Promise<Object>} Enhanced context with RDF data
   */
  async integrate(rdfConfig, context = {}) {
    if (!rdfConfig || !this.rdfEngine) {
      return context;
    }

    try {
      this.emit('rdf:integration:start', { rdfConfig });

      const enhancedContext = { ...context };

      // Load RDF data
      if (rdfConfig.type === 'file' || rdfConfig.type === 'inline') {
        const store = await this.rdfEngine.load(rdfConfig);
        enhancedContext.$rdf = {
          store,
          query: (sparql) => this.rdfEngine.query(store, sparql),
          subjects: this._extractSubjects(store),
          predicates: this._extractPredicates(store),
          objects: this._extractObjects(store)
        };
      }

      // Execute SPARQL query if specified
      if (rdfConfig.type === 'query' && rdfConfig.query) {
        const queryResults = await this.rdfEngine.query(null, rdfConfig.query);
        enhancedContext.queryResults = queryResults;
        enhancedContext.sparqlResults = queryResults; // Alias
      }

      this.emit('rdf:integration:complete', { contextKeys: Object.keys(enhancedContext) });
      return enhancedContext;

    } catch (error) {
      this.emit('rdf:integration:error', { rdfConfig, error });
      // Return original context on error
      return context;
    }
  }

  /**
   * Extract unique subjects from store
   * @private
   * @param {Object} store - RDF store
   * @returns {Array} Array of subject URIs
   */
  _extractSubjects(store) {
    if (!store || typeof store.getQuads !== 'function') return [];
    const subjects = new Set();
    for (const quad of store.getQuads()) {
      if (quad.subject && quad.subject.value) {
        subjects.add(quad.subject.value);
      }
    }
    return Array.from(subjects);
  }

  /**
   * Extract unique predicates from store
   * @private
   * @param {Object} store - RDF store
   * @returns {Array} Array of predicate URIs
   */
  _extractPredicates(store) {
    if (!store || typeof store.getQuads !== 'function') return [];
    const predicates = new Set();
    for (const quad of store.getQuads()) {
      if (quad.predicate && quad.predicate.value) {
        predicates.add(quad.predicate.value);
      }
    }
    return Array.from(predicates);
  }

  /**
   * Extract unique objects from store
   * @private
   * @param {Object} store - RDF store
   * @returns {Array} Array of object values
   */
  _extractObjects(store) {
    if (!store || typeof store.getQuads !== 'function') return [];
    const objects = new Set();
    for (const quad of store.getQuads()) {
      if (quad.object && quad.object.value) {
        objects.add(quad.object.value);
      }
    }
    return Array.from(objects);
  }
}


