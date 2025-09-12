/**
 * KGEN RDF Filters
 * 
 * Provides RDF/SPARQL-specific template filters for semantic data processing.
 */

import { Store } from 'n3';

/**
 * RDF Filters for template processing
 */
export class RDFFilters {
  constructor(options = {}) {
    this.options = {
      prefixes: options.prefixes || {},
      baseUri: options.baseUri || 'http://example.org/',
      ...options
    };
    
    this.store = new Store();
    this.queryCache = new Map();
  }
  
  /**
   * Get all available RDF filters
   * @returns {Object} Collection of RDF filters
   */
  getAllFilters() {
    return {
      // URI manipulation filters
      localName: (uri) => {
        if (typeof uri !== 'string') return uri;
        const match = uri.match(/[/#]([^/#]*)$/);
        return match ? match[1] : uri;
      },
      
      namespace: (uri) => {
        if (typeof uri !== 'string') return uri;
        const match = uri.match(/^(.+[/#])[^/#]*$/);
        return match ? match[1] : '';
      },
      
      prefixed: (uri) => {
        if (typeof uri !== 'string') return uri;
        
        for (const [prefix, namespace] of Object.entries(this.options.prefixes)) {
          if (uri.startsWith(namespace)) {
            return uri.replace(namespace, `${prefix}:`);
          }
        }
        
        return uri;
      },
      
      expanded: (prefixedUri) => {
        if (typeof prefixedUri !== 'string') return prefixedUri;
        
        const colonIndex = prefixedUri.indexOf(':');
        if (colonIndex === -1) return prefixedUri;
        
        const prefix = prefixedUri.substring(0, colonIndex);
        const localName = prefixedUri.substring(colonIndex + 1);
        
        const namespace = this.options.prefixes[prefix];
        return namespace ? `${namespace}${localName}` : prefixedUri;
      },
      
      // RDF value filters
      literal: (value, datatype = null, lang = null) => {
        if (typeof value !== 'string') {
          value = String(value);
        }
        
        let result = `"${value.replace(/"/g, '\\"')}"`;
        
        if (datatype) {
          result += `^^<${datatype}>`;
        } else if (lang) {
          result += `@${lang}`;
        }
        
        return result;
      },
      
      uri: (value) => {
        if (typeof value !== 'string') return value;
        
        if (value.startsWith('http://') || value.startsWith('https://')) {
          return `<${value}>`;
        }
        
        return `<${this.options.baseUri}${value}>`;
      },
      
      // Type conversion filters
      rdfType: (value) => {
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
        if (typeof value === 'boolean') return 'boolean';
        if (value instanceof Date) return 'dateTime';
        return 'string';
      },
      
      xsdType: (value) => {
        const baseTypes = {
          string: 'http://www.w3.org/2001/XMLSchema#string',
          integer: 'http://www.w3.org/2001/XMLSchema#integer',
          decimal: 'http://www.w3.org/2001/XMLSchema#decimal',
          boolean: 'http://www.w3.org/2001/XMLSchema#boolean',
          dateTime: 'http://www.w3.org/2001/XMLSchema#dateTime'
        };
        
        const rdfType = this.getAllFilters().rdfType(value);
        return baseTypes[rdfType] || baseTypes.string;
      }
    };
  }
  
  /**
   * Update the RDF store with new triples
   * @param {Array} triples - Array of RDF triples
   */
  updateStore(triples) {
    this.store = new Store();
    // Implementation would add triples to store
    // For now, just clear the cache when store is updated
    this.queryCache.clear();
  }
  
  /**
   * Clear the RDF store
   */
  clearStore() {
    this.store = new Store();
    this.queryCache.clear();
  }
}

export default RDFFilters;