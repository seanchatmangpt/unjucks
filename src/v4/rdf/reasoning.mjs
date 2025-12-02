/**
 * @file RDF Reasoning
 * @module unjucks-v4/rdf/reasoning
 * @description Reasoning engine using unrdf components
 */

import { reason } from '../../../unrdf/src/knowledge-engine/reason.mjs';
import { EventEmitter } from 'events';

/**
 * RDF Reasoning - Applies N3 reasoning rules
 * 
 * @class RDFReasoning
 * @extends EventEmitter
 */
export class RDFReasoning extends EventEmitter {
  /**
   * Create a new RDFReasoning instance
   * @param {Object} options - Reasoning options
   */
  constructor(options = {}) {
    super();
    this.config = {
      includeOriginal: options.includeOriginal !== false,
      maxIterations: options.maxIterations || 100,
      ...options
    };
  }

  /**
   * Apply reasoning rules to store
   * @param {Store} store - RDF store
   * @param {Store|string} rules - Reasoning rules (Store or Turtle string)
   * @param {Object} options - Reasoning options
   * @returns {Promise<Store>} Store with inferred triples
   */
  async reason(store, rules, options = {}) {
    if (!store) {
      throw new Error('RDF store is required');
    }
    if (!rules) {
      throw new Error('Reasoning rules are required');
    }

    try {
      this.emit('reasoning:start', { storeSize: store.size });

      const reasoningOptions = {
        ...this.config,
        ...options
      };

      const reasonedStore = await reason(store, rules, reasoningOptions);

      const inferredCount = reasonedStore.size - store.size;
      this.emit('reasoning:complete', { 
        originalSize: store.size,
        reasonedSize: reasonedStore.size,
        inferredCount
      });

      return reasonedStore;

    } catch (error) {
      this.emit('reasoning:error', { error });
      throw new Error(`Reasoning failed: ${error.message}`);
    }
  }
}


