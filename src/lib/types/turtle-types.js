/**
 * Core RDF/Turtle type definitions for the Unjucks template system
 */

/**
 * @typedef {Object} TurtleData
 * @property {Object} subjects
 * @property {any} predicates
 * @property {Array} triples
 * @property {Object} prefixes
 */

/**
 * @typedef {Object} RDFResource
 * @property {string} uri
 * @property {Object} properties
 * @property {Array} [type]
 */

/**
 * @typedef {Object} RDFValue
 * @property {string} value - The literal value
 * @property {string} [datatype] - The datatype URI
 * @property {string} [language] - Language tag
 */

/**
 * Common RDF vocabularies and their URIs
 */
export const CommonVocabularies = {
  RDF: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  RDFS: 'http://www.w3.org/2000/01/rdf-schema#',
  OWL: 'http://www.w3.org/2002/07/owl#',
  DCTERMS: 'http://purl.org/dc/terms/',
  FOAF: 'http://xmlns.com/foaf/0.1/',
  SKOS: 'http://www.w3.org/2004/02/skos/core#',
  XSD: 'http://www.w3.org/2001/XMLSchema#',
  SCHEMA: 'http://schema.org/',
  DC: 'http://purl.org/dc/elements/1.1/',
  VCARD: 'http://www.w3.org/2006/vcard/ns#',
  GEO: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  TIME: 'http://www.w3.org/2006/time#',
  PROV: 'http://www.w3.org/ns/prov#',
  VOID: 'http://rdfs.org/ns/void#',
  DCAT: 'http://www.w3.org/ns/dcat#'
};

/**
 * Common RDF properties
 */
export const CommonProperties = {
  // RDF
  type: `${CommonVocabularies.RDF}type`,
  
  // RDFS
  label: `${CommonVocabularies.RDFS}label`,
  comment: `${CommonVocabularies.RDFS}comment`,
  subClassOf: `${CommonVocabularies.RDFS}subClassOf`,
  subPropertyOf: `${CommonVocabularies.RDFS}subPropertyOf`,
  domain: `${CommonVocabularies.RDFS}domain`,
  range: `${CommonVocabularies.RDFS}range`,
  
  // OWL
  sameAs: `${CommonVocabularies.OWL}sameAs`,
  equivalentClass: `${CommonVocabularies.OWL}equivalentClass`,
  equivalentProperty: `${CommonVocabularies.OWL}equivalentProperty`,
  
  // DCTERMS
  title: `${CommonVocabularies.DCTERMS}title`,
  description: `${CommonVocabularies.DCTERMS}description`,
  creator: `${CommonVocabularies.DCTERMS}creator`,
  created: `${CommonVocabularies.DCTERMS}created`,
  modified: `${CommonVocabularies.DCTERMS}modified`,
  
  // FOAF
  name: `${CommonVocabularies.FOAF}name`,
  knows: `${CommonVocabularies.FOAF}knows`,
  mbox: `${CommonVocabularies.FOAF}mbox`,
  homepage: `${CommonVocabularies.FOAF}homepage`,
  
  // SKOS
  prefLabel: `${CommonVocabularies.SKOS}prefLabel`,
  altLabel: `${CommonVocabularies.SKOS}altLabel`,
  broader: `${CommonVocabularies.SKOS}broader`,
  narrower: `${CommonVocabularies.SKOS}narrower`,
  related: `${CommonVocabularies.SKOS}related`
};

/**
 * RDF validation patterns
 */
export const RDFPatterns = {
  URI: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  QNAME: /^[a-zA-Z_][\w]*:[a-zA-Z_][\w]*$/,
  BLANK_NODE: /^_:[a-zA-Z_][\w]*$/,
  LANGUAGE_TAG: /^[a-z]{2,3}(-[A-Z]{2})?$/
};

/**
 * Common XSD datatypes
 */
export const XSDTypes = {
  string: `${CommonVocabularies.XSD}string`,
  integer: `${CommonVocabularies.XSD}integer`,
  decimal: `${CommonVocabularies.XSD}decimal`,
  double: `${CommonVocabularies.XSD}double`,
  float: `${CommonVocabularies.XSD}float`,
  boolean: `${CommonVocabularies.XSD}boolean`,
  date: `${CommonVocabularies.XSD}date`,
  dateTime: `${CommonVocabularies.XSD}dateTime`,
  time: `${CommonVocabularies.XSD}time`,
  anyURI: `${CommonVocabularies.XSD}anyURI`
};

/**
 * Utility functions for working with RDF types
 */
export const RDFUtils = {
  /**
   * Check if a string is a valid URI
   * @param {string} str 
   * @returns {boolean}
   */
  isURI(str) {
    return typeof str === 'string' && RDFPatterns.URI.test(str);
  },

  /**
   * Check if a string is a valid QName (prefixed name)
   * @param {string} str 
   * @returns {boolean}
   */
  isQName(str) {
    return typeof str === 'string' && RDFPatterns.QNAME.test(str);
  },

  /**
   * Check if a string is a blank node identifier
   * @param {string} str 
   * @returns {boolean}
   */
  isBlankNode(str) {
    return typeof str === 'string' && RDFPatterns.BLANK_NODE.test(str);
  },

  /**
   * Check if a string is a valid language tag
   * @param {string} str 
   * @returns {boolean}
   */
  isLanguageTag(str) {
    return typeof str === 'string' && RDFPatterns.LANGUAGE_TAG.test(str);
  },

  /**
   * Expand a QName using common vocabularies
   * @param {string} qname 
   * @param {Object} [customPrefixes={}] 
   * @returns {string}
   */
  expandQName(qname, customPrefixes = {}) {
    if (!this.isQName(qname)) {
      return qname;
    }

    const [prefix, localName] = qname.split(':', 2);
    const allPrefixes = { ...CommonVocabularies, ...customPrefixes };
    const namespaceUri = allPrefixes[prefix.toUpperCase()] || allPrefixes[prefix];

    if (namespaceUri) {
      return namespaceUri + localName;
    }

    return qname;
  }
};

export default {
  CommonVocabularies,
  CommonProperties,
  RDFPatterns,
  XSDTypes,
  RDFUtils
};