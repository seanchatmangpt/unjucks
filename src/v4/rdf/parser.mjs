/**
 * @file RDF Parser
 * @module unjucks-v4/rdf/parser
 * @description RDF parsing (Turtle, JSON-LD) using unrdf components
 */

import { parseTurtle, parseJsonLd } from '../../../unrdf/src/knowledge-engine/parse.mjs';
import { Store } from 'n3';
import { EventEmitter } from 'events';

/**
 * RDF Parser - Parses RDF data from various formats
 * 
 * @class RDFParser
 * @extends EventEmitter
 */
export class RDFParser extends EventEmitter {
  /**
   * Create a new RDFParser instance
   * @param {Object} options - Parser options
   */
  constructor(options = {}) {
    super();
    this.config = options;
  }

  /**
   * Parse RDF data from configuration
   * @param {Object} config - RDF configuration
   * @param {string} config.type - Source type (file, inline, uri)
   * @param {string} config.source - Source path or content
   * @param {string} config.format - Format (turtle, jsonld)
   * @returns {Promise<Store>} Parsed RDF store
   */
  async parse(config) {
    if (!config || !config.type) {
      throw new Error('RDF configuration requires type');
    }

    try {
      this.emit('parse:start', { config });

      let store;

      if (config.type === 'file') {
        store = await this._parseFile(config);
      } else if (config.type === 'inline') {
        store = await this._parseInline(config);
      } else if (config.type === 'uri') {
        store = await this._parseURI(config);
      } else {
        throw new Error(`Unsupported RDF source type: ${config.type}`);
      }

      this.emit('parse:complete', { storeSize: store.size });
      return store;

    } catch (error) {
      this.emit('parse:error', { config, error });
      throw new Error(`RDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse RDF from file
   * @private
   * @param {Object} config - Configuration
   * @returns {Promise<Store>} Parsed store
   */
  async _parseFile(config) {
    const { readFile } = await import('fs/promises');
    const content = await readFile(config.source, 'utf-8');
    return this._parseContent(content, config.format || 'turtle', config.baseIRI);
  }

  /**
   * Parse RDF from inline content
   * @private
   * @param {Object} config - Configuration
   * @returns {Promise<Store>} Parsed store
   */
  async _parseInline(config) {
    return this._parseContent(config.source, config.format || 'turtle', config.baseIRI);
  }

  /**
   * Parse RDF from URI
   * @private
   * @param {Object} config - Configuration
   * @returns {Promise<Store>} Parsed store
   */
  async _parseURI(config) {
    const response = await fetch(config.source);
    if (!response.ok) {
      throw new Error(`Failed to fetch RDF from URI: ${response.statusText}`);
    }
    const content = await response.text();
    return this._parseContent(content, config.format || 'turtle', config.baseIRI);
  }

  /**
   * Parse content based on format
   * @private
   * @param {string} content - RDF content
   * @param {string} format - Format (turtle, jsonld)
   * @param {string} baseIRI - Base IRI
   * @returns {Promise<Store>} Parsed store
   */
  async _parseContent(content, format, baseIRI = 'http://example.org/') {
    if (format === 'turtle' || format === 'text/turtle') {
      return await parseTurtle(content, baseIRI);
    } else if (format === 'jsonld' || format === 'application/ld+json') {
      return await parseJsonLd(content, baseIRI);
    } else {
      throw new Error(`Unsupported RDF format: ${format}`);
    }
  }
}


