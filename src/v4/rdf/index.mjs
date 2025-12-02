/**
 * @file RDF Engine Module Exports
 * @module unjucks-v4/rdf
 */

import { RDFParser } from './parser.mjs';
import { RDFQuery } from './query.mjs';
import { RDFReasoning } from './reasoning.mjs';
import { RDFValidation } from './validation.mjs';
import { EventEmitter } from 'events';

/**
 * RDF Engine - Main RDF processing engine
 * 
 * @class RDFEngine
 * @extends EventEmitter
 */
export class RDFEngine extends EventEmitter {
  /**
   * Create a new RDFEngine instance
   * @param {Object} options - Engine options
   */
  constructor(options = {}) {
    super();
    
    this.parser = new RDFParser(options);
    this.query = new RDFQuery(options);
    this.reasoning = new RDFReasoning(options);
    this.validation = new RDFValidation(options);
    
    this.config = options;
  }

  /**
   * Initialize the RDF engine
   * @returns {Promise<void>}
   */
  async initialize() {
    this.emit('rdf:engine:initialized');
  }

  /**
   * Load RDF data from configuration
   * @param {Object} config - RDF configuration
   * @returns {Promise<Store>} Parsed RDF store
   */
  async load(config) {
    return this.parser.parse(config);
  }

  /**
   * Execute SPARQL query
   * @param {Store|null} store - RDF store
   * @param {string} sparql - SPARQL query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async query(store, sparql, options) {
    return this.query.query(store, sparql, options);
  }
}

// Export all components
export {
  RDFParser,
  RDFQuery,
  RDFReasoning,
  RDFValidation
};


