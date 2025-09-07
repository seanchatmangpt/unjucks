import { Parser, Store } from "n3";

/**
 * @typedef {'uri' | 'literal' | 'blank'} RDFTermType
 */

/**
 * @typedef {Object} RDFTerm
 * @property {RDFTermType} type - Term type
 * @property {string} value - Term value
 * @property {string} [datatype] - Literal datatype
 * @property {string} [language] - Language tag
 */

/**
 * @typedef {Object} ParsedTriple
 * @property {RDFTerm} subject - Subject term
 * @property {RDFTerm} predicate - Predicate term
 * @property {RDFTerm} object - Object term
 */

/**
 * @typedef {Object<string, string>} NamespacePrefixes
 */

/**
 * @typedef {Object} ParseStats
 * @property {number} tripleCount - Number of triples
 * @property {number} prefixCount - Number of prefixes
 * @property {number} subjectCount - Number of unique subjects
 * @property {number} predicateCount - Number of unique predicates
 * @property {number} parseTime - Parse time in milliseconds
 * @property {number} [namedGraphCount] - Number of named graphs
 */

/**
 * @typedef {Object} TurtleParseResult
 * @property {ParsedTriple[]} triples - Parsed triples
 * @property {NamespacePrefixes} prefixes - Namespace prefixes
 * @property {ParseStats} stats - Parse statistics
 * @property {string[]} [namedGraphs] - Named graph URIs
 */

/**
 * @typedef {Object} TurtleParseOptions
 * @property {string} [baseIRI] - Base IRI for parsing
 * @property {'text/turtle'|'application/n-triples'|'application/n-quads'|'text/n3'} [format] - RDF format
 * @property {string} [blankNodePrefix] - Blank node prefix
 */

/**
 * Custom error class for Turtle parsing errors
 */
export class TurtleParseError extends Error {
  constructor(message, line, column, originalError) {
    super(message);
    this.name = "TurtleParseError";
    this.line = line;
    this.column = column;
    this.originalError = originalError;
  }
}

/**
 * Main Turtle parser class using N3.js
 */
export class TurtleParser {
  constructor(options = {}) {
    this.options = {
      baseIRI: options.baseIRI || "http://example.org/",
      format: options.format || "text/turtle",
      blankNodePrefix: options.blankNodePrefix || "_:",
      ...options,
    };
  }

  /**
   * Parse Turtle content asynchronously
   * @param {string} content - Turtle content to parse
   * @returns {Promise<TurtleParseResult>}
   */
  async parse(content) {
    return Promise.resolve(this.parseSync(content));
  }

  /**
   * Parse Turtle content synchronously
   * @param {string} content - Turtle content to parse
   * @returns {TurtleParseResult}
   */
  parseSync(content) {
    const startTime = Date.now();

    // Input validation
    if (typeof content !== "string") {
      throw new TurtleParseError("Content must be a string");
    }

    const parser = new Parser({
      baseIRI: this.options.baseIRI,
      format: this.options.format,
      blankNodePrefix: this.options.blankNodePrefix,
    });

    const triples = [];
    const prefixes = {};
    const subjects = new Set();
    const predicates = new Set();

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
            prefixes[prefix || ""] = uri;
          }
        }
      }

      const parseTime = Date.now() - startTime;

      const stats = {
        tripleCount: triples.length,
        prefixCount: Object.keys(prefixes).length,
        subjectCount: subjects.size,
        predicateCount: predicates.size,
        parseTime,
      };

      const result = {
        triples,
        prefixes,
        stats,
        namedGraphs: [],
      };

      return result;
    } catch (error) {
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
   * @param {string} content - Turtle content
   * @returns {Promise<Store>}
   */
  async createStore(content) {
    const store = new Store();
    const parser = new Parser({
      baseIRI: this.options.baseIRI,
      format: this.options.format,
      blankNodePrefix: this.options.blankNodePrefix,
    });

    try {
      const quads = parser.parse(content);
      store.addQuads(quads);
      return store;
    } catch (error) {
      throw new TurtleParseError(
        `Store creation error: ${error.message}`,
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Convert N3 Quad to our ParsedTriple format
   * @param {import('n3').Quad} quad - N3 quad
   * @returns {ParsedTriple}
   */
  convertQuadToTriple(quad) {
    return {
      subject: this.convertTerm(quad.subject),
      predicate: this.convertTerm(quad.predicate),
      object: this.convertTerm(quad.object),
    };
  }

  /**
   * Convert N3 Term to our RDFTerm format
   * @param {import('n3').Term} term - N3 term
   * @returns {RDFTerm}
   */
  convertTerm(term) {
    if (term.termType === "NamedNode") {
      return {
        type: "uri",
        value: term.value,
      };
    }

    if (term.termType === "Literal") {
      const result = {
        type: "literal",
        value: term.value,
      };

      // Only include datatype if it exists and is not the default string datatype
      if (
        term.datatype &&
        term.datatype.value !==
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
      ) {
        result.datatype = term.datatype.value;
      }

      // Only include language if it exists and is not empty
      if (term.language && term.language.length > 0) {
        result.language = term.language;
      }

      return result;
    }

    if (term.termType === "BlankNode") {
      return {
        type: "blank",
        value: term.value,
      };
    }

    // Fallback for other term types
    return {
      type: "uri",
      value: term.value,
    };
  }

  /**
   * Get a string key for a term for deduplication
   * @param {RDFTerm} term - Term to get key for
   * @returns {string}
   */
  getTermKey(term) {
    return `${term.type}:${term.value}`;
  }
}

/**
 * Utility class for working with parsed Turtle data
 */
export class TurtleUtils {
  /**
   * Filter triples by subject URI
   * @param {ParsedTriple[]} triples - Triples to filter
   * @param {string} subjectUri - Subject URI to filter by
   * @returns {ParsedTriple[]}
   */
  static filterBySubject(triples, subjectUri) {
    return triples.filter((triple) => triple.subject.value === subjectUri);
  }

  /**
   * Filter triples by predicate URI
   * @param {ParsedTriple[]} triples - Triples to filter
   * @param {string} predicateUri - Predicate URI to filter by
   * @returns {ParsedTriple[]}
   */
  static filterByPredicate(triples, predicateUri) {
    return triples.filter((triple) => triple.predicate.value === predicateUri);
  }

  /**
   * Filter triples by object value
   * @param {ParsedTriple[]} triples - Triples to filter
   * @param {string} objectValue - Object value to filter by
   * @returns {ParsedTriple[]}
   */
  static filterByObject(triples, objectValue) {
    return triples.filter((triple) => triple.object.value === objectValue);
  }

  /**
   * Group triples by subject
   * @param {ParsedTriple[]} triples - Triples to group
   * @returns {Map<string, ParsedTriple[]>}
   */
  static groupBySubject(triples) {
    const groups = new Map();

    for (const triple of triples) {
      const key = `${triple.subject.type}:${triple.subject.value}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(triple);
    }

    return groups;
  }

  /**
   * Expand prefixed URI to full URI
   * @param {string} prefixedUri - Prefixed URI
   * @param {NamespacePrefixes} prefixes - Namespace prefixes
   * @returns {string}
   */
  static expandPrefix(prefixedUri, prefixes) {
    const colonIndex = prefixedUri.indexOf(":");
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
   * @param {string} fullUri - Full URI
   * @param {NamespacePrefixes} prefixes - Namespace prefixes
   * @returns {string}
   */
  static compactUri(fullUri, prefixes) {
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
   * @param {ParsedTriple[]} triples - Triples to analyze
   * @returns {RDFTerm[]}
   */
  static getSubjects(triples) {
    const uniqueSubjects = new Map();

    for (const triple of triples) {
      const key = `${triple.subject.type}:${triple.subject.value}`;
      uniqueSubjects.set(key, triple.subject);
    }

    return Array.from(uniqueSubjects.values());
  }

  /**
   * Get unique predicates from triples
   * @param {ParsedTriple[]} triples - Triples to analyze
   * @returns {RDFTerm[]}
   */
  static getPredicates(triples) {
    const uniquePredicates = new Map();

    for (const triple of triples) {
      const key = `${triple.predicate.type}:${triple.predicate.value}`;
      uniquePredicates.set(key, triple.predicate);
    }

    return Array.from(uniquePredicates.values());
  }

  /**
   * Convert literal values based on datatype
   * @param {RDFTerm} term - RDF term to convert
   * @returns {any}
   */
  static convertLiteralValue(term) {
    if (term.type !== "literal") {
      return term.value;
    }

    const datatype = term.datatype;
    const value = term.value;

    if (!datatype) {
      return value;
    }

    switch (datatype) {
      case "http://www.w3.org/2001/XMLSchema#integer":
      case "http://www.w3.org/2001/XMLSchema#int":
      case "http://www.w3.org/2001/XMLSchema#long":
      case "http://www.w3.org/2001/XMLSchema#short":
        return parseInt(value, 10);

      case "http://www.w3.org/2001/XMLSchema#decimal":
      case "http://www.w3.org/2001/XMLSchema#double":
      case "http://www.w3.org/2001/XMLSchema#float":
        return parseFloat(value);

      case "http://www.w3.org/2001/XMLSchema#boolean":
        return value === "true" || value === "1";

      case "http://www.w3.org/2001/XMLSchema#date":
      case "http://www.w3.org/2001/XMLSchema#dateTime":
      case "http://www.w3.org/2001/XMLSchema#time":
        return new Date(value);

      default:
        return value;
    }
  }

  /**
   * Validate URI format
   * @param {string} uri - URI to validate
   * @returns {boolean}
   */
  static isValidUri(uri) {
    if (!uri || typeof uri !== "string") {
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
 * @param {string} content - Turtle content to parse
 * @param {TurtleParseOptions} [options] - Parse options
 * @returns {Promise<TurtleParseResult>}
 */
export async function parseTurtle(content, options) {
  const parser = new TurtleParser(options);
  return parser.parse(content);
}

/**
 * Convenience function to parse Turtle content synchronously
 * @param {string} content - Turtle content to parse
 * @param {TurtleParseOptions} [options] - Parse options
 * @returns {TurtleParseResult}
 */
export function parseTurtleSync(content, options) {
  const parser = new TurtleParser(options);
  return parser.parseSync(content);
}