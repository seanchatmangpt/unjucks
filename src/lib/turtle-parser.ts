import { Parser, Store, Quad, NamedNode, BlankNode, Literal, Term, DataFactory } from 'n3';

/**
 * Represents a parsed RDF triple/quad with JavaScript-friendly structure
 */
export interface ParsedTriple {
  subject: ParsedTerm;
  predicate: ParsedTerm;
  object: ParsedTerm;
  graph?: ParsedTerm;
}

/**
 * Represents an RDF term (URI, blank node, or literal) in JavaScript-friendly format
 */
export interface ParsedTerm {
  type: 'uri' | 'blank' | 'literal';
  value: string;
  datatype?: string;
  language?: string;
}

/**
 * Namespace prefix mappings
 */
export interface NamespacePrefixes {
  [prefix: string]: string;
}

/**
 * Result of parsing a Turtle document
 */
export interface TurtleParseResult {
  triples: ParsedTriple[];
  prefixes: NamespacePrefixes;
  namedGraphs: string[];
  stats: {
    tripleCount: number;
    namedGraphCount: number;
    prefixCount: number;
  };
}

/**
 * Options for parsing Turtle documents
 */
export interface TurtleParseOptions {
  baseIRI?: string;
  format?: 'text/turtle' | 'application/n-triples' | 'application/n-quads' | 'text/n3';
  blankNodePrefix?: string;
  factory?: typeof DataFactory;
}

/**
 * Custom error for Turtle parsing failures
 */
export class TurtleParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TurtleParseError';
  }
}

/**
 * Converts an N3 Term to a ParsedTerm
 */
function termToObject(term: Term): ParsedTerm {
  if (term.termType === 'NamedNode') {
    return {
      type: 'uri',
      value: term.value
    };
  } else if (term.termType === 'BlankNode') {
    return {
      type: 'blank',
      value: term.value
    };
  } else if (term.termType === 'Literal') {
    const literal = term as Literal;
    const result: ParsedTerm = {
      type: 'literal',
      value: literal.value
    };
    
    if (literal.datatype && literal.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
      result.datatype = literal.datatype.value;
    }
    
    if (literal.language) {
      result.language = literal.language;
    }
    
    return result;
  }
  
  throw new TurtleParseError(`Unknown term type: ${term.termType}`);
}

/**
 * Extracts namespace prefixes from a Store
 */
function extractPrefixes(store: Store): NamespacePrefixes {
  const prefixes: NamespacePrefixes = {};
  
  // Get prefixes from the store's internal prefix map
  const storePrefixes = (store as any)._prefixes;
  if (storePrefixes) {
    for (const [prefix, uri] of Object.entries(storePrefixes)) {
      if (typeof uri === 'string') {
        prefixes[prefix] = uri;
      }
    }
  }
  
  return prefixes;
}

/**
 * Extracts unique named graphs from triples
 */
function extractNamedGraphs(triples: ParsedTriple[]): string[] {
  const graphs = new Set<string>();
  
  for (const triple of triples) {
    if (triple.graph && triple.graph.type === 'uri') {
      graphs.add(triple.graph.value);
    }
  }
  
  return Array.from(graphs).sort();
}

/**
 * Main Turtle parser class
 */
export class TurtleParser {
  private parser: Parser;
  private options: TurtleParseOptions;

  constructor(options: TurtleParseOptions = {}) {
    this.options = {
      format: 'text/turtle',
      blankNodePrefix: '_:',
      ...options
    };
    
    this.parser = new Parser({
      baseIRI: this.options.baseIRI,
      format: this.options.format,
      blankNodePrefix: this.options.blankNodePrefix,
      factory: this.options.factory
    });
  }

  /**
   * Parse a Turtle string into structured JavaScript objects
   */
  async parse(turtleContent: string): Promise<TurtleParseResult> {
    return new Promise((resolve, reject) => {
      const store = new Store();
      const quads: Quad[] = [];
      let isResolved = false;
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new TurtleParseError('Parse operation timed out'));
        }
      }, 10000); // 10 second timeout
      
      this.parser.parse(turtleContent, (error, quad, prefixes) => {
        if (isResolved) return; // Prevent multiple resolutions
        
        if (error) {
          isResolved = true;
          clearTimeout(timeoutId);
          
          // Extract line and column information if available
          const match = error.message.match(/line (\d+), column (\d+)/);
          const line = match ? parseInt(match[1], 10) : undefined;
          const column = match ? parseInt(match[2], 10) : undefined;
          
          reject(new TurtleParseError(
            `Failed to parse Turtle: ${error.message}`,
            line,
            column,
            error
          ));
          return;
        }

        if (quad) {
          quads.push(quad);
          store.add(quad);
        } else {
          // Parsing complete
          isResolved = true;
          clearTimeout(timeoutId);
          
          try {
            const triples = quads.map(quad => ({
              subject: termToObject(quad.subject),
              predicate: termToObject(quad.predicate),
              object: termToObject(quad.object),
              ...(quad.graph && quad.graph.value !== '' ? { graph: termToObject(quad.graph) } : {})
            }));

            const prefixMap = extractPrefixes(store);
            const namedGraphs = extractNamedGraphs(triples);

            const result: TurtleParseResult = {
              triples,
              prefixes: prefixMap,
              namedGraphs,
              stats: {
                tripleCount: triples.length,
                namedGraphCount: namedGraphs.length,
                prefixCount: Object.keys(prefixMap).length
              }
            };

            resolve(result);
          } catch (processingError) {
            reject(new TurtleParseError(
              `Failed to process parsed triples: ${processingError.message}`,
              undefined,
              undefined,
              processingError as Error
            ));
          }
        }
      });
    });
  }

  /**
   * Parse a Turtle string synchronously (throws on error)
   */
  parseSync(turtleContent: string): TurtleParseResult {
    const store = new Store();
    const quads: Quad[] = [];
    let parseError: Error | null = null;

    this.parser.parse(turtleContent, (error, quad) => {
      if (error) {
        parseError = error;
        return;
      }
      if (quad) {
        quads.push(quad);
        store.add(quad);
      }
    });

    if (parseError) {
      const match = parseError.message.match(/line (\d+), column (\d+)/);
      const line = match ? parseInt(match[1], 10) : undefined;
      const column = match ? parseInt(match[2], 10) : undefined;
      
      throw new TurtleParseError(
        `Failed to parse Turtle: ${parseError.message}`,
        line,
        column,
        parseError
      );
    }

    const triples = quads.map(quad => ({
      subject: termToObject(quad.subject),
      predicate: termToObject(quad.predicate),
      object: termToObject(quad.object),
      ...(quad.graph && quad.graph.value !== '' ? { graph: termToObject(quad.graph) } : {})
    }));

    const prefixMap = extractPrefixes(store);
    const namedGraphs = extractNamedGraphs(triples);

    return {
      triples,
      prefixes: prefixMap,
      namedGraphs,
      stats: {
        tripleCount: triples.length,
        namedGraphCount: namedGraphs.length,
        prefixCount: Object.keys(prefixMap).length
      }
    };
  }

  /**
   * Create a new Store from parsed triples for advanced querying
   */
  createStore(turtleContent: string): Promise<Store> {
    return new Promise((resolve, reject) => {
      const store = new Store();
      
      this.parser.parse(turtleContent, (error, quad) => {
        if (error) {
          reject(new TurtleParseError(`Failed to create store: ${error.message}`, undefined, undefined, error));
          return;
        }
        
        if (quad) {
          store.add(quad);
        } else {
          resolve(store);
        }
      });
    });
  }
}

/**
 * Utility functions for working with parsed Turtle data
 */
export class TurtleUtils {
  /**
   * Filter triples by subject URI
   */
  static filterBySubject(triples: ParsedTriple[], subjectUri: string): ParsedTriple[] {
    return triples.filter(triple => 
      triple.subject.type === 'uri' && triple.subject.value === subjectUri
    );
  }

  /**
   * Filter triples by predicate URI
   */
  static filterByPredicate(triples: ParsedTriple[], predicateUri: string): ParsedTriple[] {
    return triples.filter(triple => 
      triple.predicate.type === 'uri' && triple.predicate.value === predicateUri
    );
  }

  /**
   * Filter triples by object value
   */
  static filterByObject(triples: ParsedTriple[], objectValue: string): ParsedTriple[] {
    return triples.filter(triple => triple.object.value === objectValue);
  }

  /**
   * Filter triples by named graph
   */
  static filterByGraph(triples: ParsedTriple[], graphUri: string): ParsedTriple[] {
    return triples.filter(triple => 
      triple.graph && triple.graph.type === 'uri' && triple.graph.value === graphUri
    );
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
   * Convert a prefixed URI to full URI using prefix mappings
   */
  static expandPrefix(prefixedUri: string, prefixes: NamespacePrefixes): string {
    const colonIndex = prefixedUri.indexOf(':');
    if (colonIndex === -1) return prefixedUri;
    
    const prefix = prefixedUri.substring(0, colonIndex);
    const localName = prefixedUri.substring(colonIndex + 1);
    
    if (prefixes[prefix]) {
      return prefixes[prefix] + localName;
    }
    
    return prefixedUri;
  }

  /**
   * Convert full URI to prefixed form if possible
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
   * Extract all unique subjects from triples
   */
  static getSubjects(triples: ParsedTriple[]): ParsedTerm[] {
    const subjects = new Map<string, ParsedTerm>();
    
    for (const triple of triples) {
      const key = `${triple.subject.type}:${triple.subject.value}`;
      subjects.set(key, triple.subject);
    }
    
    return Array.from(subjects.values());
  }

  /**
   * Extract all unique predicates from triples
   */
  static getPredicates(triples: ParsedTriple[]): ParsedTerm[] {
    const predicates = new Map<string, ParsedTerm>();
    
    for (const triple of triples) {
      const key = `${triple.predicate.type}:${triple.predicate.value}`;
      predicates.set(key, triple.predicate);
    }
    
    return Array.from(predicates.values());
  }

  /**
   * Extract all unique objects from triples
   */
  static getObjects(triples: ParsedTriple[]): ParsedTerm[] {
    const objects = new Map<string, ParsedTerm>();
    
    for (const triple of triples) {
      const key = `${triple.object.type}:${triple.object.value}`;
      objects.set(key, triple.object);
    }
    
    return Array.from(objects.values());
  }

  /**
   * Validate that a string is a valid URI
   */
  static isValidUri(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert literal value to JavaScript native type based on datatype
   */
  static convertLiteralValue(term: ParsedTerm): any {
    if (term.type !== 'literal') return term.value;
    
    if (!term.datatype) return term.value;
    
    switch (term.datatype) {
      case 'http://www.w3.org/2001/XMLSchema#integer':
      case 'http://www.w3.org/2001/XMLSchema#int':
      case 'http://www.w3.org/2001/XMLSchema#long':
        return parseInt(term.value, 10);
      
      case 'http://www.w3.org/2001/XMLSchema#decimal':
      case 'http://www.w3.org/2001/XMLSchema#double':
      case 'http://www.w3.org/2001/XMLSchema#float':
        return parseFloat(term.value);
      
      case 'http://www.w3.org/2001/XMLSchema#boolean':
        return term.value === 'true';
      
      case 'http://www.w3.org/2001/XMLSchema#date':
      case 'http://www.w3.org/2001/XMLSchema#dateTime':
        return new Date(term.value);
      
      default:
        return term.value;
    }
  }
}

/**
 * Convenience function to parse Turtle content with default options
 */
export async function parseTurtle(
  turtleContent: string, 
  options: TurtleParseOptions = {}
): Promise<TurtleParseResult> {
  const parser = new TurtleParser(options);
  return parser.parse(turtleContent);
}

/**
 * Convenience function to parse Turtle content synchronously
 */
export function parseTurtleSync(
  turtleContent: string, 
  options: TurtleParseOptions = {}
): TurtleParseResult {
  const parser = new TurtleParser(options);
  return parser.parseSync(turtleContent);
}

/**
 * Export all types and classes for external use
 */
export default {
  TurtleParser,
  TurtleUtils,
  parseTurtle,
  parseTurtleSync,
  TurtleParseError
};