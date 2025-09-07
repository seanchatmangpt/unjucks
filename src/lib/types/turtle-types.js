/**
 * Core RDF/Turtle type definitions for the Unjucks template system
 * Converted from TypeScript to JavaScript with JSDoc comments
 */

/**
 * @typedef {Object} TurtleData
 * @property {Object<string, RDFResource>} subjects - RDF subjects indexed by URI
 * @property {Set<string>} predicates - Set of predicate URIs
 * @property {Array} triples - Array of parsed triples
 * @property {Object<string, string>} prefixes - Namespace prefixes
 */

/**
 * @typedef {Object} RDFResource
 * @property {string} uri - Resource URI
 * @property {Object<string, Array>} properties - Resource properties
 * @property {string[]} [type] - Resource types
 */

/**
 * @typedef {Object} RDFValue
 * @property {string} value - The value
 * @property {'literal' | 'uri' | 'blank'} type - Value type
 * @property {string} [datatype] - Literal datatype
 * @property {string} [language] - Language tag
 */

/**
 * @typedef {Object} TurtleParserOptions
 * @property {string} [baseUri] - Base URI for parsing
 * @property {string} [format] - RDF format
 * @property {boolean} [validateSyntax] - Enable syntax validation
 * @property {boolean} [extractVariables] - Extract template variables
 */

/**
 * @typedef {Object} RDFDataSource
 * @property {'file' | 'inline' | 'uri'} type - Source type
 * @property {string} source - Source path/content/uri
 * @property {string} [format] - Data format
 * @property {string[]} [variables] - Template variables
 */

/**
 * @typedef {Object} RDFDataLoadResult
 * @property {TurtleData} data - Loaded turtle data
 * @property {Object} variables - Template variables
 * @property {Object} metadata - Additional metadata
 * @property {boolean} success - Success flag
 * @property {string[]} errors - Error messages
 */

/**
 * @typedef {Object} RDFDataLoaderOptions
 * @property {string} [baseUri] - Base URI for resolving relative URIs
 * @property {boolean} [cacheEnabled] - Enable caching
 * @property {boolean} [validateSyntax] - Enable syntax validation
 * @property {string} [templateDir] - Template directory
 * @property {number} [httpTimeout] - HTTP timeout
 * @property {number} [maxRetries] - Maximum retries
 * @property {number} [retryDelay] - Retry delay
 * @property {Object<string, string>} [httpHeaders] - HTTP headers
 * @property {number} [cacheTTL] - Cache TTL in milliseconds
 */

/**
 * @typedef {Object} ExtendedFrontmatterConfig
 * @property {string} [to] - Target file path
 * @property {boolean} [inject] - Enable injection mode
 * @property {string} [before] - Inject before this marker
 * @property {string} [after] - Inject after this marker
 * @property {boolean} [append] - Append to file
 * @property {boolean} [prepend] - Prepend to file
 * @property {number} [lineAt] - Insert at specific line
 * @property {string} [skipIf] - Skip condition
 * @property {string|number} [chmod] - File permissions
 * @property {string|string[]} [sh] - Shell commands
 * @property {RDFDataSource|string} [rdf] - RDF data source
 * @property {RDFDataSource|string} [turtle] - Turtle data source
 * @property {string} [turtleData] - Inline turtle data
 * @property {string} [rdfData] - Inline RDF data
 * @property {string} [rdfBaseUri] - RDF base URI
 * @property {Object<string, string>} [rdfPrefixes] - RDF prefixes
 * @property {Object} [rdfQuery] - RDF query options
 */

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
};

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
};

/**
 * @typedef {Object} RDFTemplateVariable
 * @property {string} name - Variable name
 * @property {string} [rdfProperty] - Associated RDF property
 * @property {'string' | 'number' | 'boolean' | 'date' | 'uri' | 'array'} type - Variable type
 * @property {string} [datatype] - RDF datatype
 * @property {string} [language] - Language tag
 * @property {boolean} [required] - Required flag
 * @property {*} [defaultValue] - Default value
 * @property {string} [description] - Description
 * @property {Array} [examples] - Example values
 */

/**
 * @typedef {Object} RDFQueryResult
 * @property {Array<Object<string, RDFValue>>} bindings - Query result bindings
 * @property {string[]} variables - Query variables
 * @property {boolean} success - Success flag
 * @property {string[]} errors - Error messages
 */

/**
 * @typedef {Object} RDFNamespaceConfig
 * @property {Object<string, string>} prefixes - Namespace prefixes
 * @property {string} [defaultPrefix] - Default prefix
 * @property {string} [baseUri] - Base URI
 */

/**
 * @typedef {Object} RDFValidationResult
 * @property {boolean} valid - Validation result
 * @property {Array<{message: string, line?: number, column?: number, severity: 'error' | 'warning' | 'info'}>} errors - Validation errors
 * @property {Array<{message: string, line?: number, column?: number}>} warnings - Validation warnings
 */

/**
 * @typedef {Object} RDFTemplateContext
 * @property {Object} $rdf - RDF-specific context
 * @property {Object<string, RDFResource>} $rdf.subjects - RDF subjects
 * @property {Object<string, string>} $rdf.prefixes - Namespace prefixes
 * @property {Function} $rdf.query - Query function
 * @property {Function} $rdf.getByType - Get resources by type
 * @property {Function} $rdf.compact - Compact URI function
 * @property {Function} $rdf.expand - Expand URI function
 * @property {Object} $metadata - Metadata extracted from RDF
 */

/**
 * @typedef {Object} SemanticValidationResult
 * @property {string} type - Validation type
 * @property {string} ontology - Ontology used
 * @property {boolean} valid - Validation result
 * @property {string[]} errors - Error messages
 * @property {string[]} warnings - Warning messages
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} CrossOntologyMapping
 * @property {string} sourceOntology - Source ontology
 * @property {string} targetOntology - Target ontology
 * @property {string} sourceProperty - Source property
 * @property {string} targetProperty - Target property
 * @property {string} sourceValue - Source value
 * @property {string} mappedValue - Mapped value
 * @property {number} confidence - Mapping confidence
 * @property {'equivalent' | 'similar' | 'broader' | 'narrower'} mappingType - Mapping type
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} EnterprisePerformanceMetrics
 * @property {number} renderTime - Render time in milliseconds
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} variableCount - Number of variables
 * @property {number} rdfTripleCount - Number of RDF triples
 * @property {number} validationCount - Number of validations
 * @property {number} cacheHits - Number of cache hits
 * @property {string[]} optimizationsApplied - Applied optimizations
 */