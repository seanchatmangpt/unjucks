/**
 * @file RDF Query
 * @module unjucks-v4/rdf/query
 * @description SPARQL query execution using unrdf components
 */

import { query as sparqlQuery } from '../../../unrdf/src/knowledge-engine/query.mjs';
import { EventEmitter } from 'events';

/**
 * RDF Query - Executes SPARQL queries
 * 
 * @class RDFQuery
 * @extends EventEmitter
 */
export class RDFQuery extends EventEmitter {
  /**
   * Create a new RDFQuery instance
   * @param {Object} options - Query options
   */
  constructor(options = {}) {
    super();
    this.config = {
      timeout: options.timeout || 30000,
      ...options
    };
  }

  /**
   * Execute SPARQL query
   * @param {Store|null} store - RDF store (null for endpoint queries)
   * @param {string} sparql - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async query(store, sparql, options = {}) {
    if (!sparql || typeof sparql !== 'string') {
      throw new Error('SPARQL query string is required');
    }

    try {
      this.emit('query:start', { sparql: sparql.substring(0, 100) });

      const queryOptions = {
        ...this.config,
        ...options
      };

      const results = await sparqlQuery(store, sparql, queryOptions);

      this.emit('query:complete', { resultType: typeof results });
      return results;

    } catch (error) {
      this.emit('query:error', { sparql, error });
      throw new Error(`SPARQL query failed: ${error.message}`);
    }
  }
}


