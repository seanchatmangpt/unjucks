/**
 * RDF normalizer for deterministic canonical representation
 * Converts RDF to canonical N-Quads with stable ordering
 */

import { DataFactory, Parser, Writer } from 'n3';
import { Quad, NamedNode, BlankNode, Literal, Term } from '@rdfjs/types';
import { sortObjectKeys } from './utils';

export interface NormalizationOptions {
  /**
   * Whether to sort triples by subject, predicate, object
   */
  sortTriples?: boolean;
  
  /**
   * Whether to normalize blank node labels
   */
  normalizeBlankNodes?: boolean;
  
  /**
   * Base IRI for relative URI resolution
   */
  baseIRI?: string;
  
  /**
   * Prefixes to expand
   */
  prefixes?: Record<string, string>;
}

export class RDFNormalizer {
  private options: Required<NormalizationOptions>;
  
  constructor(options: NormalizationOptions = {}) {
    this.options = {
      sortTriples: options.sortTriples ?? true,
      normalizeBlankNodes: options.normalizeBlankNodes ?? true,
      baseIRI: options.baseIRI ?? '',
      prefixes: sortObjectKeys(options.prefixes ?? {})
    };
  }
  
  /**
   * Normalize RDF string to canonical N-Quads
   */
  async normalize(rdfString: string, format: string = 'turtle'): Promise<string> {
    const quads = await this.parseRDF(rdfString, format);
    const normalizedQuads = this.normalizeQuads(quads);
    return this.serializeNQuads(normalizedQuads);
  }
  
  /**
   * Parse RDF string to quads
   */
  private async parseRDF(rdfString: string, format: string): Promise<Quad[]> {
    return new Promise((resolve, reject) => {
      const parser = new Parser({ 
        format: format as any,
        baseIRI: this.options.baseIRI 
      });
      const quads: Quad[] = [];
      
      parser.parse(rdfString, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`RDF parsing failed: ${error.message}`));
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          resolve(quads);
        }
      });
    });
  }
  
  /**
   * Normalize quads for deterministic output
   */
  private normalizeQuads(quads: Quad[]): Quad[] {
    let normalizedQuads = [...quads];
    
    // Normalize blank nodes if requested
    if (this.options.normalizeBlankNodes) {
      normalizedQuads = this.normalizeBlankNodesInQuads(normalizedQuads);
    }
    
    // Sort triples if requested
    if (this.options.sortTriples) {
      normalizedQuads = this.sortQuads(normalizedQuads);
    }
    
    return normalizedQuads;
  }
  
  /**
   * Normalize blank node labels to canonical form
   */
  private normalizeBlankNodesInQuads(quads: Quad[]): Quad[] {
    const blankNodeMap = new Map<string, string>();
    let blankNodeCounter = 0;
    
    // First pass: collect all blank nodes
    quads.forEach(quad => {
      [quad.subject, quad.predicate, quad.object].forEach(term => {
        if (term.termType === 'BlankNode') {
          const original = term.value;
          if (!blankNodeMap.has(original)) {
            blankNodeMap.set(original, `_:b${blankNodeCounter++}`);
          }
        }
      });
    });
    
    // Second pass: replace blank node labels
    return quads.map(quad => {
      const subject = this.normalizeBlankNodeTerm(quad.subject, blankNodeMap);
      const predicate = this.normalizeBlankNodeTerm(quad.predicate, blankNodeMap);
      const object = this.normalizeBlankNodeTerm(quad.object, blankNodeMap);
      const graph = this.normalizeBlankNodeTerm(quad.graph, blankNodeMap);
      
      return DataFactory.quad(subject, predicate, object, graph);
    });
  }
  
  /**
   * Normalize a single term's blank node if applicable
   */
  private normalizeBlankNodeTerm(term: Term, blankNodeMap: Map<string, string>): Term {
    if (term.termType === 'BlankNode') {
      const normalizedLabel = blankNodeMap.get(term.value);
      if (normalizedLabel) {
        return DataFactory.blankNode(normalizedLabel.substring(2)); // Remove _: prefix
      }
    }
    return term;
  }
  
  /**
   * Sort quads for deterministic ordering
   */
  private sortQuads(quads: Quad[]): Quad[] {
    return [...quads].sort((a, b) => {
      // Sort by subject
      const subjectComparison = this.compareTerms(a.subject, b.subject);
      if (subjectComparison !== 0) return subjectComparison;
      
      // Sort by predicate
      const predicateComparison = this.compareTerms(a.predicate, b.predicate);
      if (predicateComparison !== 0) return predicateComparison;
      
      // Sort by object
      const objectComparison = this.compareTerms(a.object, b.object);
      if (objectComparison !== 0) return objectComparison;
      
      // Sort by graph
      return this.compareTerms(a.graph, b.graph);
    });
  }
  
  /**
   * Compare two RDF terms for sorting
   */
  private compareTerms(a: Term, b: Term): number {
    // First compare by term type
    const typeOrder = {
      'NamedNode': 0,
      'BlankNode': 1,
      'Literal': 2,
      'Variable': 3,
      'DefaultGraph': 4
    };
    
    const aTypeOrder = typeOrder[a.termType] ?? 99;
    const bTypeOrder = typeOrder[b.termType] ?? 99;
    
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }
    
    // Then compare by value
    if (a.termType === 'Literal' && b.termType === 'Literal') {
      const aLiteral = a as Literal;
      const bLiteral = b as Literal;
      
      // Compare by value first
      const valueComparison = aLiteral.value.localeCompare(bLiteral.value);
      if (valueComparison !== 0) return valueComparison;
      
      // Then by datatype
      const aDt = aLiteral.datatype?.value ?? '';
      const bDt = bLiteral.datatype?.value ?? '';
      const datatypeComparison = aDt.localeCompare(bDt);
      if (datatypeComparison !== 0) return datatypeComparison;
      
      // Finally by language
      const aLang = aLiteral.language ?? '';
      const bLang = bLiteral.language ?? '';
      return aLang.localeCompare(bLang);
    }
    
    return a.value.localeCompare(b.value);
  }
  
  /**
   * Serialize quads to N-Quads format
   */
  private serializeNQuads(quads: Quad[]): string {
    const writer = new Writer({ format: 'N-Quads' });
    const lines: string[] = [];
    
    quads.forEach(quad => {
      const nquad = writer.quadToString(quad.subject, quad.predicate, quad.object, quad.graph);
      lines.push(nquad);
    });
    
    // Ensure consistent line endings and final newline
    return lines.join('\n') + '\n';
  }
  
  /**
   * Extract and sort all unique subjects, predicates, and objects
   */
  extractTerms(quads: Quad[]): {
    subjects: Set<string>;
    predicates: Set<string>;
    objects: Set<string>;
  } {
    const subjects = new Set<string>();
    const predicates = new Set<string>();
    const objects = new Set<string>();
    
    quads.forEach(quad => {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      objects.add(quad.object.value);
    });
    
    return { subjects, predicates, objects };
  }
}

/**
 * Create a normalized canonical hash of RDF content
 */
export async function createRDFHash(rdfString: string, format: string = 'turtle'): Promise<string> {
  const normalizer = new RDFNormalizer();
  const canonicalNQuads = await normalizer.normalize(rdfString, format);
  
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(canonicalNQuads).digest('hex');
}

/**
 * Normalize RDF to canonical N-Quads
 */
export async function normalizeRDF(
  rdfString: string, 
  format: string = 'turtle',
  options?: NormalizationOptions
): Promise<string> {
  const normalizer = new RDFNormalizer(options);
  return normalizer.normalize(rdfString, format);
}

/**
 * Compare two RDF documents for semantic equivalence
 */
export async function compareRDF(
  rdf1: string, 
  rdf2: string, 
  format1: string = 'turtle',
  format2: string = 'turtle'
): Promise<boolean> {
  const hash1 = await createRDFHash(rdf1, format1);
  const hash2 = await createRDFHash(rdf2, format2);
  return hash1 === hash2;
}