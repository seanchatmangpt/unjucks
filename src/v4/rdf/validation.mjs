/**
 * @file RDF Validation
 * @module unjucks-v4/rdf/validation
 * @description SHACL validation using unrdf components
 */

import { validateShacl } from '../../../unrdf/src/knowledge-engine/validate.mjs';
import { EventEmitter } from 'events';

/**
 * RDF Validation - Validates RDF data against SHACL shapes
 * 
 * @class RDFValidation
 * @extends EventEmitter
 */
export class RDFValidation extends EventEmitter {
  /**
   * Create a new RDFValidation instance
   * @param {Object} options - Validation options
   */
  constructor(options = {}) {
    super();
    this.config = {
      strict: options.strict || false,
      includeDetails: options.includeDetails !== false,
      ...options
    };
  }

  /**
   * Validate store against SHACL shapes
   * @param {Store} store - RDF store to validate
   * @param {Store|string} shapes - SHACL shapes (Store or Turtle string)
   * @param {Object} options - Validation options
   * @returns {Object} Validation report
   */
  validate(store, shapes, options = {}) {
    if (!store) {
      throw new Error('RDF store is required');
    }
    if (!shapes) {
      throw new Error('SHACL shapes are required');
    }

    try {
      this.emit('validation:start', { storeSize: store.size });

      const validationOptions = {
        ...this.config,
        ...options
      };

      const report = validateShacl(store, shapes, validationOptions);

      this.emit('validation:complete', { 
        conforms: report.conforms,
        resultCount: report.results?.length || 0
      });

      if (!report.conforms && this.config.strict) {
        throw new Error(`SHACL validation failed: ${report.results.length} violations`);
      }

      return report;

    } catch (error) {
      this.emit('validation:error', { error });
      throw new Error(`Validation failed: ${error.message}`);
    }
  }
}


