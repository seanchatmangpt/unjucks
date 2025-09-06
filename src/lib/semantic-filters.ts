/**
 * Semantic-aware Nunjucks filters for RDF/TTL/N3 template generation
 * These filters help generate valid RDF syntax and handle semantic operations
 */

import moment from 'moment';
import { Environment } from 'nunjucks';

export interface PrefixMap {
  [prefix: string]: string;
}

export interface SemanticFilterOptions {
  defaultLanguage?: string;
  strictValidation?: boolean;
  prefixMap?: PrefixMap;
}

/**
 * Convert string to camelCase for RDF property/class names
 */
export function camelize(str: string): string {
  if (!str) return str;
  
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * Convert string to URL-safe slug
 */
export function slug(str: string): string {
  if (!str) return str;
  
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert camelCase/slug to human-readable form
 */
export function humanize(str: string): string {
  if (!str) return str;
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

/**
 * Convert value to appropriate RDF literal or resource representation
 */
export function semanticValue(value: any, prefixes?: PrefixMap, datatype?: string): string {
  if (value === null || value === undefined) {
    return '""';
  }
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return `"${value}"^^xsd:boolean`;
  }
  
  // Handle numeric values
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return `"${value}"^^xsd:integer`;
    } else {
      return `"${value}"^^xsd:decimal`;
    }
  }
  
  // Handle string values
  if (typeof value === 'string') {
    // Check if it's a URI/IRI
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {
      return `<${value}>`;
    }
    
    // Check if it's a prefixed name
    if (value.includes(':') && prefixes) {
      const [prefix, localName] = value.split(':', 2);
      if (prefixes[prefix]) {
        return value;
      }
    }
    
    // Handle dates
    if (moment(value, moment.ISO_8601, true).isValid()) {
      if (value.includes('T')) {
        return `"${value}"^^xsd:dateTime`;
      } else {
        return `"${value}"^^xsd:date`;
      }
    }
    
    // Handle specific datatypes
    if (datatype && datatype !== 'auto') {
      return `"${value}"^^${datatype}`;
    }
    
    // Default string literal
    return `"${value}"`;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return `( ${value.map(v => semanticValue(v, prefixes, datatype)).join(' ')} )`;
  }
  
  // Handle objects as JSON literals
  if (typeof value === 'object') {
    return `"${JSON.stringify(value)}"^^xsd:string`;
  }
  
  return `"${String(value)}"`;
}

/**
 * Convert value to literal or resource based on context
 */
export function literalOrResource(value: any, prefixes?: PrefixMap): string {
  if (!value) return '""';
  
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return `<${value}>`;
    }
    
    if (value.includes(':') && prefixes) {
      const [prefix] = value.split(':', 1);
      if (prefixes[prefix]) {
        return value;
      }
    }
  }
  
  return semanticValue(value, prefixes);
}

/**
 * Convert value to prefixed name if possible
 */
export function prefixedName(value: string, prefixes?: PrefixMap): string {
  if (!value || !prefixes) return value;
  
  // If already prefixed
  if (value.includes(':') && !value.startsWith('http')) {
    return value;
  }
  
  // Try to convert full IRI to prefixed name
  if (value.startsWith('http://') || value.startsWith('https://')) {
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (value.startsWith(namespace)) {
        const localName = value.slice(namespace.length);
        return prefix ? `${prefix}:${localName}` : localName;
      }
    }
    return `<${value}>`;
  }
  
  // Check for XSD datatypes
  const xsdTypes = [
    'string', 'boolean', 'decimal', 'integer', 'double', 'float', 
    'date', 'dateTime', 'time', 'gYear', 'gMonth', 'gDay',
    'duration', 'anyURI', 'base64Binary', 'hexBinary'
  ];
  
  if (xsdTypes.includes(value)) {
    return `xsd:${value}`;
  }
  
  return value;
}

/**
 * Generate SPARQL triple pattern term
 */
export function sparqlTerm(value: string, prefixes?: PrefixMap): string {
  if (!value) return '?unknown';
  
  // Variable
  if (value.startsWith('?')) {
    return value;
  }
  
  // Blank node
  if (value.startsWith('_:')) {
    return value;
  }
  
  // Literal
  if (value.startsWith('"')) {
    return value;
  }
  
  // URI
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return `<${value}>`;
  }
  
  // Prefixed name
  if (value.includes(':')) {
    return value;
  }
  
  // Try to create prefixed name
  return prefixedName(value, prefixes);
}

/**
 * Generate SPARQL property path expression
 */
export function pathExpression(path: string | object, prefixes?: PrefixMap): string {
  if (typeof path === 'string') {
    return prefixedName(path, prefixes);
  }
  
  if (typeof path === 'object' && path !== null) {
    const pathObj = path as any;
    
    // Sequence path
    if (pathObj.sequence) {
      return pathObj.sequence.map((p: string) => prefixedName(p, prefixes)).join('/');
    }
    
    // Alternative path
    if (pathObj.alternative) {
      return `(${pathObj.alternative.map((p: string) => prefixedName(p, prefixes)).join('|')})`;
    }
    
    // Inverse path
    if (pathObj.inverse) {
      return `^${prefixedName(pathObj.inverse, prefixes)}`;
    }
    
    // Zero or more path
    if (pathObj.zeroOrMore) {
      return `${prefixedName(pathObj.zeroOrMore, prefixes)}*`;
    }
    
    // One or more path
    if (pathObj.oneOrMore) {
      return `${prefixedName(pathObj.oneOrMore, prefixes)}+`;
    }
    
    // Zero or one path
    if (pathObj.zeroOrOne) {
      return `${prefixedName(pathObj.zeroOrOne, prefixes)}?`;
    }
  }
  
  return String(path);
}

/**
 * Format moment.js date with fallback
 */
export function formatMoment(value: string, format?: string): string {
  const date = moment(value);
  if (!date.isValid()) {
    return value;
  }
  return date.format(format || 'YYYY-MM-DD');
}

/**
 * Generate UUID v4
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate IRI/URI format
 */
export function isValidIRI(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape special characters for RDF literals
 */
export function escapeRDF(value: string): string {
  if (!value) return value;
  
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Generate RDF collection syntax
 */
export function rdfCollection(items: any[], prefixes?: PrefixMap): string {
  if (!items || items.length === 0) {
    return '()';
  }
  
  return `( ${items.map(item => semanticValue(item, prefixes)).join(' ')} )`;
}

/**
 * Register all semantic filters with a Nunjucks environment
 */
export function registerSemanticFilters(env: Environment, options: SemanticFilterOptions = {}): void {
  const { prefixMap = {} } = options;
  
  // String transformation filters
  env.addFilter('camelize', camelize);
  env.addFilter('slug', slug);
  env.addFilter('humanize', humanize);
  
  // Semantic value filters
  env.addFilter('semanticValue', (value: any, datatype?: string) => 
    semanticValue(value, prefixMap, datatype));
  
  env.addFilter('literalOrResource', (value: any) => 
    literalOrResource(value, prefixMap));
  
  env.addFilter('prefixedName', (value: string) => 
    prefixedName(value, prefixMap));
  
  env.addFilter('sparqlTerm', (value: string) => 
    sparqlTerm(value, prefixMap));
  
  env.addFilter('pathExpression', (path: string | object) => 
    pathExpression(path, prefixMap));
  
  // Date/time filters
  env.addFilter('moment', formatMoment);
  
  // Utility filters
  env.addFilter('uuid', uuid);
  env.addFilter('isValidIRI', isValidIRI);
  env.addFilter('escapeRDF', escapeRDF);
  env.addFilter('rdfCollection', (items: any[]) => 
    rdfCollection(items, prefixMap));
  
  // Helper functions for templates
  env.addGlobal('moment', () => moment());
  env.addGlobal('now', () => moment().format());
  env.addGlobal('uuid', uuid);
}

/**
 * Create a semantic-aware Nunjucks environment
 */
export function createSemanticEnvironment(options: SemanticFilterOptions = {}): Environment {
  const env = new Environment();
  registerSemanticFilters(env, options);
  return env;
}

// Export individual filters for direct use
export const semanticFilters = {
  camelize,
  slug,
  humanize,
  semanticValue,
  literalOrResource,
  prefixedName,
  sparqlTerm,
  pathExpression,
  formatMoment,
  uuid,
  isValidIRI,
  escapeRDF,
  rdfCollection
};

export default semanticFilters;