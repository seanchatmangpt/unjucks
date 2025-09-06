/**
 * TypeScript type definitions for RDF/Turtle data structures
 */

import type { Quad, NamedNode, BlankNode, Literal, DefaultGraph, Variable, Term } from 'n3';

/**
 * RDF Term types from N3.js
 */
export type RDFTerm = NamedNode | BlankNode | Literal | Variable | DefaultGraph;

/**
 * RDF Quad (subject, predicate, object, graph)
 */
export type RDFQuad = Quad;

/**
 * Parsed RDF dataset
 */
export interface RDFDataset {
  /** All quads in the dataset */
  quads: RDFQuad[];
  /** Namespace prefixes */
  prefixes: Record<string, string>;
  /** Named graphs in the dataset */
  graphs: Set<string>;
  /** Base IRI if specified */
  baseIRI?: string;
}

/**
 * RDF resource representation
 */
export interface RDFResource {
  /** Resource IRI or blank node ID */
  id: string;
  /** Resource types (rdf:type values) */
  types: string[];
  /** Properties and their values */
  properties: Record<string, RDFValue[]>;
  /** Graph this resource belongs to */
  graph?: string;
}

/**
 * RDF value (can be resource reference or literal)
 */
export type RDFValue = 
  | { type: 'uri'; value: string }
  | { type: 'literal'; value: string; datatype?: string; language?: string }
  | { type: 'blank'; value: string };

/**
 * RDF query pattern for SPARQL-like matching
 */
export interface RDFPattern {
  subject?: string | Variable;
  predicate?: string | Variable;
  object?: string | RDFValue | Variable;
  graph?: string | Variable;
}

/**
 * RDF parser options
 */
export interface RDFParserOptions {
  /** Base IRI for relative URIs */
  baseIRI?: string;
  /** Format (defaults to 'text/turtle') */
  format?: string;
  /** Whether to validate against schemas */
  validate?: boolean;
  /** Cache parsed results */
  cache?: boolean;
}

/**
 * RDF loader options
 */
export interface RDFLoaderOptions extends RDFParserOptions {
  /** Watch files for changes */
  watch?: boolean;
  /** Merge multiple sources */
  merge?: boolean;
  /** Timeout for remote sources */
  timeout?: number;
}

/**
 * Ontology/Schema definitions
 */
export interface RDFSchema {
  /** Schema IRI */
  iri: string;
  /** Schema type (OWL, RDFS, SHACL) */
  type: 'owl' | 'rdfs' | 'shacl';
  /** Class definitions */
  classes: Map<string, RDFClassDefinition>;
  /** Property definitions */
  properties: Map<string, RDFPropertyDefinition>;
}

/**
 * RDF class definition
 */
export interface RDFClassDefinition {
  iri: string;
  label?: string;
  comment?: string;
  superClasses: string[];
  disjointWith: string[];
  equivalentTo: string[];
}

/**
 * RDF property definition
 */
export interface RDFPropertyDefinition {
  iri: string;
  label?: string;
  comment?: string;
  domain: string[];
  range: string[];
  functional: boolean;
  inverseFunctional: boolean;
}

/**
 * RDF validation result
 */
export interface RDFValidationResult {
  valid: boolean;
  errors: RDFValidationError[];
  warnings: RDFValidationWarning[];
}

/**
 * RDF validation error
 */
export interface RDFValidationError {
  type: string;
  message: string;
  subject?: string;
  predicate?: string;
  object?: string;
}

/**
 * RDF validation warning
 */
export interface RDFValidationWarning {
  type: string;
  message: string;
  suggestion?: string;
}

/**
 * Template RDF context
 */
export interface TemplateRDFContext {
  /** Loaded RDF datasets by name */
  datasets: Map<string, RDFDataset>;
  /** Available schemas */
  schemas: Map<string, RDFSchema>;
  /** Default dataset */
  defaultDataset?: RDFDataset;
  /** Query function */
  query: (pattern: RDFPattern) => RDFQuad[];
  /** Get resource by IRI */
  getResource: (iri: string) => RDFResource | null;
}