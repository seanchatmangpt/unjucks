import { Parser, Store, Quad, Term, NamedNode, Literal, BlankNode } from 'n3';

/**
 * Core RDF term types for compatibility with N3.js
 */
export type RDFTermType = 'uri' | 'literal' | 'blank';

/**
 * RDF term interface matching N3.js structure
 */
export interface RDFTerm {
  type: RDFTermType;
  value: string;
  datatype?: string;
  language?: string;
}

/**
 * Parsed RDF triple structure
 */
export interface ParsedTriple {
  subject: RDFTerm;
  predicate: RDFTerm;
  object: RDFTerm;
}

/**
 * Namespace prefixes mapping
 */
export interface NamespacePrefixes {
  [prefix: string]: string;
}

/**
 * Parse statistics
 */
export interface ParseStats {
  tripleCount: number;
  prefixCount: number;
  subjectCount: number;
  predicateCount: number;
  parseTime: number;
  namedGraphCount?: number;
}

/**
 * Complete parse result
 */
export interface TurtleParseResult {
  triples: ParsedTriple[];
  prefixes: NamespacePrefixes;
  stats: ParseStats;
  namedGraphs?: string[];
}

/**
 * Parser configuration options
 */
export interface TurtleParseOptions {
  baseIRI?: string;
  format?: 'text/turtle' | 'application/n-triples' | 'application/n-quads' | 'text/n3';
  blankNodePrefix?: string;
}

/**
 * Custom error class for Turtle parsing errors
 */
export class TurtleParseError extends Error {
  public name = 'TurtleParseError';
  public line?: number;
  public column?: number;
  public originalError?: Error;

  constructor(message: string, line?: number, column?: number, originalError?: Error) {
    super(message);
    this.line = line;
    this.column = column;
    this.originalError = originalError;
  }
}

/**
 * Main Turtle parser class using N3.js
 */
export class TurtleParser {
  private options: TurtleParseOptions;

  constructor(options: TurtleParseOptions = {}) {
    this.options = {
      baseIRI: options.baseIRI || 'http://example.org/',
      format: options.format || 'text/turtle',
      blankNodePrefix: options.blankNodePrefix || '_:',
      ...options
    };
  }

  /**
   * Parse Turtle content asynchronously
   */
  async parse(content: string): Promise<TurtleParseResult> {
    return Promise.resolve(this.parseSync(content));
  }

  /**
   * Parse Turtle content synchronously
   */
  parseSync(content: string): TurtleParseResult {
    const startTime = Date.now();
    
    // Input validation
    if (typeof content !== 'string') {
      throw new TurtleParseError('Content must be a string');
    }

    const parser = new Parser({
      baseIRI: this.options.baseIRI,
      format: this.options.format,
      blankNodePrefix: this.options.blankNodePrefix
    });

    const triples: ParsedTriple[] = [];
    const prefixes: NamespacePrefixes = {};
    const subjects = new Set<string>();
    const predicates = new Set<string>();

    try {
      const quads = parser.parse(content);
      
      // Process all parsed quads
      for (const quad of quads) {
        const parsedTriple = this.convertQuadToTriple(quad);
        triples.push(parsedTriple);
        subjects.add(this.getTermKey(parsedTriple.subject));
        predicates.add(parsedTriple.predicate.value);
      }

      // Extract prefixes from content using regex
      const prefixMatches = content.match(/@prefix\s+(\w*):?\s*<([^>]+)>/g);
      if (prefixMatches) {
        for (const match of prefixMatches) {
          const prefixMatch = match.match(/@prefix\s+(\w*):?\s*<([^>]+)>/);
          if (prefixMatch) {
            const [, prefix, uri] = prefixMatch;
            prefixes[prefix || ''] = uri;
          }
        }
      }

      const parseTime = Date.now() - startTime;
      
      const stats: ParseStats = {
        tripleCount: triples.length,
        prefixCount: Object.keys(prefixes).length,
        subjectCount: subjects.size,
        predicateCount: predicates.size,
        parseTime
      };

      const result: TurtleParseResult = {
        triples,
        prefixes,
        stats,
        namedGraphs: []
      };

      return result;
    } catch (error: any) {
      const parseError = new TurtleParseError(
        `Parse error: ${error.message}`,
        undefined,
        undefined,
        error
      );
      throw parseError;
    }
  }

  /**
   * Create N3 Store from turtle content
   */
  async createStore(content: string): Promise<Store> {
    const store = new Store();
    const parser = new Parser({
      baseIRI: this.options.baseIRI,
      format: this.options.format,
      blankNodePrefix: this.options.blankNodePrefix
    });

    try {
      const quads = parser.parse(content);
      store.addQuads(quads);
      return store;
    } catch (error: any) {
      throw new TurtleParseError(`Store creation error: ${error.message}`, undefined, undefined, error);
    }
  }

  /**
   * Convert N3 Quad to our ParsedTriple format
   */
  private convertQuadToTriple(quad: Quad): ParsedTriple {
    return {
      subject: this.convertTerm(quad.subject),
      predicate: this.convertTerm(quad.predicate),
      object: this.convertTerm(quad.object)
    };
  }

  /**
   * Convert N3 Term to our RDFTerm format
   */
  private convertTerm(term: Term): RDFTerm {
    if (term.termType === 'NamedNode') {
      return {
        type: 'uri',
        value: term.value
      };
    }
    
    if (term.termType === 'Literal') {
      const literalTerm = term as Literal;
      const result: RDFTerm = {
        type: 'literal',
        value: literalTerm.value
      };
      
      // Only include datatype if it exists and is not the default string datatype
      if (literalTerm.datatype && literalTerm.datatype.value !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString') {
        result.datatype = literalTerm.datatype.value;
      }
      
      // Only include language if it exists and is not empty
      if (literalTerm.language && literalTerm.language.length > 0) {
        result.language = literalTerm.language;
      }
      
      return result;
    }
    
    if (term.termType === 'BlankNode') {
      return {
        type: 'blank',
        value: term.value
      };
    }

    // Fallback for other term types
    return {
      type: 'uri',
      value: term.value
    };
  }

  /**
   * Get a string key for a term for deduplication
   */
  private getTermKey(term: RDFTerm): string {
    return `${term.type}:${term.value}`;
  }
}

/**
 * Utility class for working with parsed Turtle data
 */
export class TurtleUtils {
  /**
   * Filter triples by subject URI
   */
  static filterBySubject(triples: ParsedTriple[], subjectUri: string): ParsedTriple[] {
    return triples.filter(triple => triple.subject.value === subjectUri);
  }

  /**
   * Filter triples by predicate URI
   */
  static filterByPredicate(triples: ParsedTriple[], predicateUri: string): ParsedTriple[] {
    return triples.filter(triple => triple.predicate.value === predicateUri);
  }

  /**
   * Filter triples by object value
   */
  static filterByObject(triples: ParsedTriple[], objectValue: string): ParsedTriple[] {
    return triples.filter(triple => triple.object.value === objectValue);
  }

  /**
   * Group triples by subject
   */
  static groupBySubject(triples: ParsedTriple[]): Map<string, ParsedTriple[]> {
    const groups = new Map<string, ParsedTriple[]>();
    
    for (const triple of triples) {
      const key = `${triple.subject.type}:${triple.subject.value}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(triple);
    }
    
    return groups;
  }

  /**
   * Expand prefixed URI to full URI
   */
  static expandPrefix(prefixedUri: string, prefixes: NamespacePrefixes): string {
    const colonIndex = prefixedUri.indexOf(':');
    if (colonIndex === -1) {
      return prefixedUri;
    }
    
    const prefix = prefixedUri.substring(0, colonIndex);
    const localName = prefixedUri.substring(colonIndex + 1);
    
    if (prefixes[prefix]) {
      return prefixes[prefix] + localName;
    }
    
    return prefixedUri;
  }

  /**
   * Compact full URI to prefixed form
   */
  static compactUri(fullUri: string, prefixes: NamespacePrefixes): string {
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (fullUri.startsWith(namespace)) {
        const localName = fullUri.substring(namespace.length);
        return `${prefix}:${localName}`;
      }
    }
    return fullUri;
  }

  /**
   * Get unique subjects from triples
   */
  static getSubjects(triples: ParsedTriple[]): RDFTerm[] {
    const uniqueSubjects = new Map<string, RDFTerm>();
    
    for (const triple of triples) {
      const key = `${triple.subject.type}:${triple.subject.value}`;
      uniqueSubjects.set(key, triple.subject);
    }
    
    return Array.from(uniqueSubjects.values());
  }

  /**
   * Get unique predicates from triples
   */
  static getPredicates(triples: ParsedTriple[]): RDFTerm[] {
    const uniquePredicates = new Map<string, RDFTerm>();
    
    for (const triple of triples) {
      const key = `${triple.predicate.type}:${triple.predicate.value}`;
      uniquePredicates.set(key, triple.predicate);
    }
    
    return Array.from(uniquePredicates.values());
  }

  /**
   * Convert literal values based on datatype
   */
  static convertLiteralValue(term: RDFTerm): any {
    if (term.type !== 'literal') {
      return term.value;
    }

    const datatype = term.datatype;
    const value = term.value;

    if (!datatype) {
      return value;
    }

    switch (datatype) {
      case 'http://www.w3.org/2001/XMLSchema#integer':
      case 'http://www.w3.org/2001/XMLSchema#int':
      case 'http://www.w3.org/2001/XMLSchema#long':
      case 'http://www.w3.org/2001/XMLSchema#short':
        return parseInt(value, 10);
      
      case 'http://www.w3.org/2001/XMLSchema#decimal':
      case 'http://www.w3.org/2001/XMLSchema#double':
      case 'http://www.w3.org/2001/XMLSchema#float':
        return parseFloat(value);
      
      case 'http://www.w3.org/2001/XMLSchema#boolean':
        return value === 'true' || value === '1';
      
      case 'http://www.w3.org/2001/XMLSchema#date':
      case 'http://www.w3.org/2001/XMLSchema#dateTime':
      case 'http://www.w3.org/2001/XMLSchema#time':
        return new Date(value);
      
      default:
        return value;
    }
  }

  /**
   * Validate URI format
   */
  static isValidUri(uri: string): boolean {
    if (!uri || typeof uri !== 'string') {
      return false;
    }

    try {
      new URL(uri);
      return true;
    } catch {
      // Try URN format
      return /^urn:[a-z0-9][a-z0-9-]{0,31}:/.test(uri);
    }
  }
}

/**
 * Convenience function to parse Turtle content with default options
 */
export async function parseTurtle(content: string, options?: TurtleParseOptions): Promise<TurtleParseResult> {
  const parser = new TurtleParser(options);
  return parser.parse(content);
}

/**
 * Convenience function to parse Turtle content synchronously (returns empty result)
 */
export function parseTurtleSync(content: string, options?: TurtleParseOptions): TurtleParseResult {
  const parser = new TurtleParser(options);
  return parser.parseSync(content);
}

// All types and classes are already exported individually above