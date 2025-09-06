import type { Quad } from "n3";

/**
 * Core RDF/Turtle type definitions for the Unjucks template system
 */

export interface TurtleData {
  subjects: Record<string, RDFResource>;
  predicates: Set<string>;
  triples: Quad[];
  prefixes: Record<string, string>;
}

export interface RDFResource {
  uri: string;
  properties: Record<string, RDFValue[]>;
  type?: string[];
}

export type RDFValue = {
  value: string;
  type: "literal" | "uri" | "blank";
  datatype?: string;
  language?: string;
};

export interface TurtleParserOptions {
  baseUri?: string;
  format?: string;
  validateSyntax?: boolean;
  extractVariables?: boolean;
}

export interface RDFDataSource {
  type: "file" | "inline" | "uri";
  source: string;
  format?: string;
  variables?: string[];
}

export interface RDFDataLoadResult {
  data: TurtleData;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  success: boolean;
  errors: string[];
}

export interface RDFDataLoaderOptions {
  baseUri?: string;
  cacheEnabled?: boolean;
  validateSyntax?: boolean;
  templateDir?: string;
  // HTTP options
  httpTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  httpHeaders?: Record<string, string>;
  // Cache options
  cacheTTL?: number; // Time to live in milliseconds
}

/**
 * Extended frontmatter configuration with RDF support
 */
export interface ExtendedFrontmatterConfig {
  // Existing frontmatter options
  to?: string;
  inject?: boolean;
  before?: string;
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  skipIf?: string;
  chmod?: string | number;
  sh?: string | string[];

  // RDF/Turtle data source configurations
  rdf?: RDFDataSource | string;
  turtle?: RDFDataSource | string;
  turtleData?: string;
  rdfData?: string;

  // RDF-specific options
  rdfBaseUri?: string;
  rdfPrefixes?: Record<string, string>;
  rdfQuery?: {
    subject?: string;
    predicate?: string;
    object?: string;
  };
}

/**
 * RDF vocabulary URIs commonly used in templates
 */
export const CommonVocabularies = {
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  OWL: "http://www.w3.org/2002/07/owl#",
  DCTERMS: "http://purl.org/dc/terms/",
  FOAF: "http://xmlns.com/foaf/0.1/",
  SKOS: "http://www.w3.org/2004/02/skos/core#",
  SCHEMA: "http://schema.org/",
  XHTML: "http://www.w3.org/1999/xhtml",
  XML: "http://www.w3.org/XML/1998/namespace",
  XSD: "http://www.w3.org/2001/XMLSchema#",
} as const;

/**
 * Common RDF properties that map to template variables
 */
export const CommonProperties = {
  TYPE: `${CommonVocabularies.RDF}type`,
  LABEL: `${CommonVocabularies.RDFS}label`,
  COMMENT: `${CommonVocabularies.RDFS}comment`,
  TITLE: `${CommonVocabularies.DCTERMS}title`,
  DESCRIPTION: `${CommonVocabularies.DCTERMS}description`,
  CREATOR: `${CommonVocabularies.DCTERMS}creator`,
  CREATED: `${CommonVocabularies.DCTERMS}created`,
  MODIFIED: `${CommonVocabularies.DCTERMS}modified`,
  NAME: `${CommonVocabularies.FOAF}name`,
  HOMEPAGE: `${CommonVocabularies.FOAF}homepage`,
  PREF_LABEL: `${CommonVocabularies.SKOS}prefLabel`,
  ALT_LABEL: `${CommonVocabularies.SKOS}altLabel`,
} as const;

/**
 * Utility type for RDF literal datatypes
 */
export type RDFDatatype =
  | `${typeof CommonVocabularies.XSD}string`
  | `${typeof CommonVocabularies.XSD}integer`
  | `${typeof CommonVocabularies.XSD}decimal`
  | `${typeof CommonVocabularies.XSD}double`
  | `${typeof CommonVocabularies.XSD}float`
  | `${typeof CommonVocabularies.XSD}boolean`
  | `${typeof CommonVocabularies.XSD}date`
  | `${typeof CommonVocabularies.XSD}dateTime`
  | `${typeof CommonVocabularies.XSD}time`
  | `${typeof CommonVocabularies.XSD}duration`
  | string;

/**
 * Template variable with RDF context
 */
export interface RDFTemplateVariable {
  name: string;
  rdfProperty?: string;
  type: "string" | "number" | "boolean" | "date" | "uri" | "array";
  datatype?: RDFDatatype;
  language?: string;
  required?: boolean;
  defaultValue?: any;
  description?: string;
  examples?: any[];
}

/**
 * RDF query result for template processing
 */
export interface RDFQueryResult {
  bindings: Array<Record<string, RDFValue>>;
  variables: string[];
  success: boolean;
  errors: string[];
}

/**
 * RDF namespace configuration
 */
export interface RDFNamespaceConfig {
  prefixes: Record<string, string>;
  defaultPrefix?: string;
  baseUri?: string;
}

/**
 * RDF validation result
 */
export interface RDFValidationResult {
  valid: boolean;
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
    severity: "error" | "warning" | "info";
  }>;
  warnings: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}

/**
 * RDF template context for Nunjucks rendering
 */
export interface RDFTemplateContext extends Record<string, any> {
  // RDF-specific context
  $rdf: {
    subjects: Record<string, RDFResource>;
    prefixes: Record<string, string>;
    query: (subject?: string, predicate?: string, object?: string) => Quad[];
    getByType: (typeUri: string) => RDFResource[];
    compact: (uri: string) => string;
    expand: (prefixed: string) => string;
  };

  // Metadata extracted from RDF
  $metadata: Record<string, any>;

  // Original template variables
  [key: string]: any;
}