/**
 * @file Frontmatter Parser
 * @module unjucks-v4/template/frontmatter-parser
 * @description YAML frontmatter parsing and validation
 */

import yaml from 'yaml';
import { EventEmitter } from 'events';

/**
 * Frontmatter Parser - Parses and validates YAML frontmatter from templates
 * 
 * @class FrontmatterParser
 * @extends EventEmitter
 */
export class FrontmatterParser extends EventEmitter {
  /**
   * Create a new FrontmatterParser instance
   * @param {Object} options - Parser options
   * @param {boolean} options.enableValidation - Enable schema validation
   * @param {boolean} options.strictMode - Strict validation mode
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      delimiter: '---',
      enableValidation: options.enableValidation !== false,
      strictMode: options.strictMode || false,
      ...options
    };
  }

  /**
   * Parse template content and extract frontmatter
   * @param {string} content - Template content with frontmatter
   * @returns {Object} Parse result with frontmatter and content
   */
  parse(content) {
    if (!content || typeof content !== 'string') {
      return {
        frontmatter: {},
        content: content || '',
        hasFrontmatter: false
      };
    }

    const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content,
        hasFrontmatter: false
      };
    }

    try {
      const rawFrontmatter = match[1];
      const templateBody = match[2];

      const frontmatter = yaml.parse(rawFrontmatter) || {};

      // Extract RDF configuration
      const rdfConfig = this._extractRDFConfig(frontmatter);

      const result = {
        frontmatter: {
          ...frontmatter,
          _rdfConfig: rdfConfig
        },
        content: templateBody,
        hasFrontmatter: true
      };

      // Validate if enabled
      if (this.config.enableValidation) {
        const validation = this._validate(frontmatter);
        result.validation = validation;
        
        if (!validation.valid && this.config.strictMode) {
          throw new Error(`Frontmatter validation failed: ${validation.errors.join(', ')}`);
        }
      }

      this.emit('frontmatter:parsed', result);
      return result;

    } catch (error) {
      this.emit('frontmatter:error', { error });
      throw new Error(`Failed to parse frontmatter: ${error.message}`);
    }
  }

  /**
   * Extract RDF configuration from frontmatter
   * @private
   * @param {Object} frontmatter - Parsed frontmatter
   * @returns {Object|null} RDF configuration
   */
  _extractRDFConfig(frontmatter) {
    if (frontmatter.rdf) {
      return typeof frontmatter.rdf === 'string' 
        ? { type: 'file', source: frontmatter.rdf }
        : frontmatter.rdf;
    }

    if (frontmatter.turtle) {
      return typeof frontmatter.turtle === 'string'
        ? { type: 'file', source: frontmatter.turtle, format: 'text/turtle' }
        : { ...frontmatter.turtle, format: 'text/turtle' };
    }

    if (frontmatter.turtleData || frontmatter.rdfData) {
      return {
        type: 'inline',
        source: frontmatter.turtleData || frontmatter.rdfData,
        format: 'text/turtle'
      };
    }

    if (frontmatter.rdfQuery || frontmatter.sparql) {
      return {
        type: 'query',
        query: frontmatter.rdfQuery || frontmatter.sparql
      };
    }

    return null;
  }

  /**
   * Validate frontmatter structure
   * @private
   * @param {Object} frontmatter - Frontmatter to validate
   * @returns {Object} Validation result
   */
  _validate(frontmatter) {
    const errors = [];
    const warnings = [];

    // Validate operation modes (mutually exclusive)
    const operationModes = [
      frontmatter.inject,
      frontmatter.append,
      frontmatter.prepend,
      frontmatter.lineAt !== undefined
    ].filter(Boolean);

    if (operationModes.length > 1) {
      errors.push('Only one operation mode allowed: inject, append, prepend, or lineAt');
    }

    // Validate output path
    if (frontmatter.to && typeof frontmatter.to !== 'string') {
      errors.push('Output path (to) must be a string');
    }

    // Validate injection markers
    if ((frontmatter.before || frontmatter.after) && !frontmatter.inject) {
      warnings.push('before/after markers require inject: true');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}


