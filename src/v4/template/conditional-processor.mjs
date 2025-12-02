/**
 * @file Conditional Processor
 * @module unjucks-v4/template/conditional-processor
 * @description Evaluates skipIf and conditional logic
 */

import { NunjucksRenderer } from './nunjucks-renderer.mjs';
import { EventEmitter } from 'events';

/**
 * Conditional Processor - Evaluates skipIf and conditional logic
 * 
 * @class ConditionalProcessor
 * @extends EventEmitter
 */
export class ConditionalProcessor extends EventEmitter {
  /**
   * Create a new ConditionalProcessor instance
   * @param {Object} options - Processor options
   * @param {NunjucksRenderer} options.renderer - Nunjucks renderer instance
   */
  constructor(options = {}) {
    super();
    
    this.renderer = options.renderer || new NunjucksRenderer();
    this.config = options;
  }

  /**
   * Evaluate skipIf condition
   * @param {string|boolean} condition - Skip condition
   * @param {Object} context - Template context
   * @returns {Promise<Object>} Evaluation result
   */
  async evaluate(condition, context = {}) {
    if (condition === undefined || condition === null) {
      return { skip: false };
    }

    // Boolean condition
    if (typeof condition === 'boolean') {
      return { skip: condition };
    }

    // String condition (Nunjucks expression)
    if (typeof condition === 'string') {
      try {
        // Render condition as template to evaluate
        const rendered = await this.renderer.render(`{{ ${condition} }}`, context);
        const result = this._parseBoolean(rendered.trim());
        
        this.emit('condition:evaluated', { condition, result: { skip: result } });
        return { skip: result };
      } catch (error) {
        this.emit('condition:error', { condition, error });
        // Default to not skipping on error
        return { skip: false, error: error.message };
      }
    }

    return { skip: false };
  }

  /**
   * Parse boolean from string
   * @private
   * @param {string} value - String value
   * @returns {boolean} Boolean value
   */
  _parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === '') return false;
    }
    return Boolean(value);
  }
}


