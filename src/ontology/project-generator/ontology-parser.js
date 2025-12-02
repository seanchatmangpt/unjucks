/**
 * Enhanced Ontology Parser for Full Project Generation
 *
 * Parses RDF/Turtle ontologies and extracts structured data for comprehensive
 * project generation including classes, properties, relationships, and constraints.
 *
 * @module ontology/project-generator/ontology-parser
 */

import * as N3 from 'n3';
import { promises as fs } from 'fs';

const { DataFactory } = N3;
const { namedNode, literal } = DataFactory;

// Standard RDF/OWL/RDFS namespaces
const NS = {
  RDF: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  RDFS: 'http://www.w3.org/2000/01/rdf-schema#',
  OWL: 'http://www.w3.org/2002/07/owl#',
  XSD: 'http://www.w3.org/2001/XMLSchema#',
  SKOS: 'http://www.w3.org/2004/02/skos/core#',
  DCTERMS: 'http://purl.org/dc/terms/',
  FOAF: 'http://xmlns.com/foaf/0.1/',
  SCHEMA: 'http://schema.org/',
};

/**
 * ProjectSchema structure for ontology parsing results
 * @typedef {Object} ProjectSchema
 * @property {Array<ClassDefinition>} classes - Extracted class definitions
 * @property {Array<Relationship>} relationships - Class relationships
 * @property {Array<ValidationRule>} validation - Validation constraints
 * @property {Object<string, string>} namespaces - Namespace prefix mappings
 * @property {OntologyMetadata} ontologyMetadata - Ontology-level metadata
 */

/**
 * Class definition extracted from ontology
 * @typedef {Object} ClassDefinition
 * @property {string} uri - Full URI of the class
 * @property {string} name - Local name (without namespace)
 * @property {string} label - Human-readable label
 * @property {string} comment - Description/documentation
 * @property {Array<string>} subClassOf - Parent class URIs
 * @property {Array<PropertyDefinition>} properties - Datatype properties
 * @property {Array<RelationshipDefinition>} relationships - Object properties
 * @property {Object} metadata - Additional metadata
 */

/**
 * Property definition (datatype property)
 * @typedef {Object} PropertyDefinition
 * @property {string} uri - Property URI
 * @property {string} name - Local name
 * @property {string} label - Human-readable label
 * @property {string} comment - Description
 * @property {string} range - XSD datatype (xsd:string, xsd:integer, etc.)
 * @property {boolean} required - Whether property is required
 * @property {number|null} minCardinality - Minimum cardinality
 * @property {number|null} maxCardinality - Maximum cardinality
 * @property {Array<Object>} constraints - Additional constraints
 */

/**
 * Relationship definition (object property)
 * @typedef {Object} RelationshipDefinition
 * @property {string} uri - Property URI
 * @property {string} name - Local name
 * @property {string} label - Human-readable label
 * @property {string} comment - Description
 * @property {string} range - Target class URI
 * @property {string|null} inverseOf - Inverse property URI
 * @property {string} cardinality - one-to-one, one-to-many, many-to-many
 * @property {boolean} required - Whether relationship is required
 */

/**
 * Enhanced Ontology Parser
 * Parses OWL/RDFS ontologies for project generation
 */
export class OntologyProjectParser {
  /**
   * Create a new ontology parser
   * @param {Object} options - Parser options
   * @param {boolean} options.includeImports - Whether to follow owl:imports
   * @param {boolean} options.includeInferred - Whether to include inferred triples
   * @param {number} options.streamBufferSize - Buffer size for stream processing
   */
  constructor(options = {}) {
    this.options = {
      includeImports: options.includeImports ?? true,
      includeInferred: options.includeInferred ?? false,
      streamBufferSize: options.streamBufferSize ?? 1000,
    };

    this.store = new N3.Store();
    this.namespaces = {};
    this.processedImports = new Set();
  }

  /**
   * Parse an ontology file and extract project schema
   * @param {string} ttlPath - Path to Turtle/RDF file
   * @returns {Promise<ProjectSchema>} Parsed project schema
   */
  async parseOntology(ttlPath) {
    // Reset state
    this.store = new N3.Store();
    this.namespaces = {};
    this.processedImports = new Set();

    // Load the ontology
    await this._loadOntologyFile(ttlPath);

    // Extract namespaces
    this._extractNamespaces();

    // Process imports if enabled
    if (this.options.includeImports) {
      await this._processImports();
    }

    // Build the project schema
    const schema = {
      classes: await this._extractClasses(),
      relationships: await this._extractRelationships(),
      validation: await this._extractValidationRules(),
      namespaces: this.namespaces,
      ontologyMetadata: await this._extractOntologyMetadata(),
    };

    // Enrich classes with their properties and relationships
    await this._enrichClasses(schema);

    return schema;
  }

  /**
   * Load an ontology file into the store
   * @private
   * @param {string} filePath - Path to the file
   */
  async _loadOntologyFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const parser = new N3.Parser({ format: 'text/turtle' });

    return new Promise((resolve, reject) => {
      const quads = [];

      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`Failed to parse ontology: ${error.message}`));
        } else if (quad) {
          quads.push(quad);

          // Process in batches for large ontologies
          if (quads.length >= this.options.streamBufferSize) {
            this.store.addQuads(quads.splice(0, quads.length));
          }
        } else {
          // Parsing complete
          if (quads.length > 0) {
            this.store.addQuads(quads);
          }

          // Store prefixes
          if (prefixes) {
            Object.assign(this.namespaces, prefixes);
          }

          resolve();
        }
      });
    });
  }

  /**
   * Extract namespace prefixes from ontology
   * @private
   */
  _extractNamespaces() {
    // Add standard namespaces
    Object.assign(this.namespaces, {
      rdf: NS.RDF,
      rdfs: NS.RDFS,
      owl: NS.OWL,
      xsd: NS.XSD,
    });

    // Extract from vann:preferredNamespacePrefix if available
    const vannPrefix = 'http://purl.org/vocab/vann/preferredNamespacePrefix';
    const vannUri = 'http://purl.org/vocab/vann/preferredNamespaceUri';

    const prefixQuads = this.store.getQuads(null, vannPrefix, null);
    for (const quad of prefixQuads) {
      const prefix = quad.object.value;
      const uriQuads = this.store.getQuads(quad.subject, vannUri, null);
      if (uriQuads.length > 0) {
        this.namespaces[prefix] = uriQuads[0].object.value;
      }
    }
  }

  /**
   * Process owl:imports declarations
   * @private
   */
  async _processImports() {
    const imports = this.store.getQuads(null, NS.OWL + 'imports', null);

    for (const importQuad of imports) {
      const importUri = importQuad.object.value;

      // Skip if already processed
      if (this.processedImports.has(importUri)) {
        continue;
      }

      this.processedImports.add(importUri);

      // Try to resolve and load the import
      // Note: In production, implement proper URI resolution
      try {
        if (importUri.startsWith('file://') || importUri.startsWith('/')) {
          const path = importUri.replace('file://', '');
          await this._loadOntologyFile(path);
        }
      } catch (error) {
        console.warn(`Warning: Could not load import ${importUri}: ${error.message}`);
      }
    }
  }

  /**
   * Extract all class definitions from ontology
   * @private
   * @returns {Promise<Array<ClassDefinition>>}
   */
  async _extractClasses() {
    const classes = [];
    const processedClasses = new Set();

    // Find all owl:Class and rdfs:Class instances
    const classTypes = [
      NS.OWL + 'Class',
      NS.RDFS + 'Class',
    ];

    for (const classType of classTypes) {
      const classQuads = this.store.getQuads(null, NS.RDF + 'type', namedNode(classType));

      for (const quad of classQuads) {
        const classUri = quad.subject.value;

        // Skip if already processed or if it's an OWL built-in
        if (processedClasses.has(classUri) || this._isBuiltIn(classUri)) {
          continue;
        }

        processedClasses.add(classUri);

        const classDef = {
          uri: classUri,
          name: this._getLocalName(classUri),
          label: this._getLabel(classUri),
          comment: this._getComment(classUri),
          subClassOf: this._getSuperClasses(classUri),
          properties: [], // Will be populated by _enrichClasses
          relationships: [], // Will be populated by _enrichClasses
          metadata: this._extractClassMetadata(classUri),
        };

        classes.push(classDef);
      }
    }

    return classes;
  }

  /**
   * Extract class metadata (domain, purpose, etc.)
   * @private
   * @param {string} classUri - Class URI
   * @returns {Object} Metadata object
   */
  _extractClassMetadata(classUri) {
    const metadata = {};

    // Extract common metadata properties
    const metadataProps = [
      { pred: NS.DCTERMS + 'description', key: 'description' },
      { pred: NS.DCTERMS + 'created', key: 'created' },
      { pred: NS.DCTERMS + 'modified', key: 'modified' },
      { pred: NS.SKOS + 'definition', key: 'definition' },
      { pred: NS.SKOS + 'example', key: 'example' },
      { pred: NS.RDFS + 'seeAlso', key: 'seeAlso' },
      { pred: NS.RDFS + 'isDefinedBy', key: 'isDefinedBy' },
    ];

    for (const { pred, key } of metadataProps) {
      const quads = this.store.getQuads(namedNode(classUri), pred, null);
      if (quads.length > 0) {
        metadata[key] = quads.length === 1
          ? quads[0].object.value
          : quads.map(q => q.object.value);
      }
    }

    return metadata;
  }

  /**
   * Get all superclasses for a class
   * @private
   * @param {string} classUri - Class URI
   * @returns {Array<string>} Array of superclass URIs
   */
  _getSuperClasses(classUri) {
    const superClasses = [];
    const quads = this.store.getQuads(namedNode(classUri), NS.RDFS + 'subClassOf', null);

    for (const quad of quads) {
      if (quad.object.termType === 'NamedNode') {
        superClasses.push(quad.object.value);
      }
      // TODO: Handle blank nodes (restrictions)
    }

    return superClasses;
  }

  /**
   * Extract all relationships (object properties) from ontology
   * @private
   * @returns {Promise<Array<Relationship>>}
   */
  async _extractRelationships() {
    const relationships = [];

    // Find all owl:ObjectProperty instances
    const propQuads = this.store.getQuads(
      null,
      NS.RDF + 'type',
      namedNode(NS.OWL + 'ObjectProperty')
    );

    for (const quad of propQuads) {
      const propUri = quad.subject.value;

      if (this._isBuiltIn(propUri)) {
        continue;
      }

      const domain = this._getPropertyDomain(propUri);
      const range = this._getPropertyRange(propUri);

      // Create relationship entries for each domain-range pair
      if (domain.length > 0 && range.length > 0) {
        for (const domainClass of domain) {
          for (const rangeClass of range) {
            relationships.push({
              from: domainClass,
              to: rangeClass,
              predicate: propUri,
              name: this._getLocalName(propUri),
              label: this._getLabel(propUri),
              comment: this._getComment(propUri),
              cardinality: this._inferCardinality(propUri),
              inverse: this._getInverseProperty(propUri),
              required: this._isPropertyRequired(propUri),
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Get property domain (source classes)
   * @private
   * @param {string} propUri - Property URI
   * @returns {Array<string>} Domain class URIs
   */
  _getPropertyDomain(propUri) {
    const domains = [];
    const quads = this.store.getQuads(namedNode(propUri), NS.RDFS + 'domain', null);

    for (const quad of quads) {
      if (quad.object.termType === 'NamedNode') {
        domains.push(quad.object.value);
      }
    }

    return domains;
  }

  /**
   * Get property range (target classes or datatypes)
   * @private
   * @param {string} propUri - Property URI
   * @returns {Array<string>} Range class URIs or datatypes
   */
  _getPropertyRange(propUri) {
    const ranges = [];
    const quads = this.store.getQuads(namedNode(propUri), NS.RDFS + 'range', null);

    for (const quad of quads) {
      if (quad.object.termType === 'NamedNode') {
        ranges.push(quad.object.value);
      }
    }

    return ranges;
  }

  /**
   * Infer cardinality from property characteristics
   * @private
   * @param {string} propUri - Property URI
   * @returns {string} Cardinality string (one-to-one, one-to-many, many-to-many)
   */
  _inferCardinality(propUri) {
    const isFunctional = this.store.getQuads(
      namedNode(propUri),
      NS.RDF + 'type',
      namedNode(NS.OWL + 'FunctionalProperty')
    ).length > 0;

    const isInverseFunctional = this.store.getQuads(
      namedNode(propUri),
      NS.RDF + 'type',
      namedNode(NS.OWL + 'InverseFunctionalProperty')
    ).length > 0;

    if (isFunctional && isInverseFunctional) {
      return 'one-to-one';
    } else if (isFunctional) {
      return 'many-to-one';
    } else if (isInverseFunctional) {
      return 'one-to-many';
    } else {
      return 'many-to-many';
    }
  }

  /**
   * Get inverse property if defined
   * @private
   * @param {string} propUri - Property URI
   * @returns {string|null} Inverse property URI or null
   */
  _getInverseProperty(propUri) {
    const quads = this.store.getQuads(namedNode(propUri), NS.OWL + 'inverseOf', null);
    return quads.length > 0 ? quads[0].object.value : null;
  }

  /**
   * Check if property is required (has minimum cardinality > 0)
   * @private
   * @param {string} propUri - Property URI
   * @returns {boolean} True if required
   */
  _isPropertyRequired(propUri) {
    // Check for owl:minCardinality or owl:minQualifiedCardinality restrictions
    // This is a simplified check - full implementation would need to examine restrictions
    const restrictions = this._findPropertyRestrictions(propUri);

    for (const restriction of restrictions) {
      const minCard = this._getRestrictionCardinality(restriction, 'min');
      if (minCard && minCard > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find restrictions for a property
   * @private
   * @param {string} propUri - Property URI
   * @returns {Array<string>} Restriction URIs
   */
  _findPropertyRestrictions(propUri) {
    const restrictions = [];

    const quads = this.store.getQuads(null, NS.OWL + 'onProperty', namedNode(propUri));
    for (const quad of quads) {
      restrictions.push(quad.subject.value);
    }

    return restrictions;
  }

  /**
   * Get cardinality value from restriction
   * @private
   * @param {string} restrictionUri - Restriction URI
   * @param {string} type - 'min' or 'max'
   * @returns {number|null} Cardinality value or null
   */
  _getRestrictionCardinality(restrictionUri, type) {
    const predicates = type === 'min'
      ? [NS.OWL + 'minCardinality', NS.OWL + 'minQualifiedCardinality']
      : [NS.OWL + 'maxCardinality', NS.OWL + 'maxQualifiedCardinality'];

    for (const pred of predicates) {
      const quads = this.store.getQuads(namedNode(restrictionUri), pred, null);
      if (quads.length > 0) {
        return parseInt(quads[0].object.value, 10);
      }
    }

    return null;
  }

  /**
   * Extract validation rules and constraints
   * @private
   * @returns {Promise<Array<ValidationRule>>}
   */
  async _extractValidationRules() {
    const rules = [];

    // Extract cardinality constraints
    rules.push(...this._extractCardinalityConstraints());

    // Extract value constraints (owl:allValuesFrom, owl:someValuesFrom)
    rules.push(...this._extractValueConstraints());

    // Extract hasValue constraints
    rules.push(...this._extractHasValueConstraints());

    // Extract XSD constraints (min/max inclusive/exclusive)
    rules.push(...this._extractXSDConstraints());

    return rules;
  }

  /**
   * Extract cardinality constraints
   * @private
   * @returns {Array<Object>}
   */
  _extractCardinalityConstraints() {
    const constraints = [];

    const restrictionQuads = this.store.getQuads(
      null,
      NS.RDF + 'type',
      namedNode(NS.OWL + 'Restriction')
    );

    for (const quad of restrictionQuads) {
      const restrictionUri = quad.subject.value;

      // Get the property this restriction applies to
      const propQuads = this.store.getQuads(namedNode(restrictionUri), NS.OWL + 'onProperty', null);
      if (propQuads.length === 0) continue;

      const propertyUri = propQuads[0].object.value;

      // Get cardinality values
      const minCard = this._getRestrictionCardinality(restrictionUri, 'min');
      const maxCard = this._getRestrictionCardinality(restrictionUri, 'max');

      if (minCard !== null) {
        constraints.push({
          property: propertyUri,
          constraint: 'minCardinality',
          value: minCard,
        });
      }

      if (maxCard !== null) {
        constraints.push({
          property: propertyUri,
          constraint: 'maxCardinality',
          value: maxCard,
        });
      }
    }

    return constraints;
  }

  /**
   * Extract value constraints (allValuesFrom, someValuesFrom)
   * @private
   * @returns {Array<Object>}
   */
  _extractValueConstraints() {
    const constraints = [];

    const constraintTypes = [
      { pred: NS.OWL + 'allValuesFrom', type: 'allValuesFrom' },
      { pred: NS.OWL + 'someValuesFrom', type: 'someValuesFrom' },
    ];

    for (const { pred, type } of constraintTypes) {
      const quads = this.store.getQuads(null, pred, null);

      for (const quad of quads) {
        const restrictionUri = quad.subject.value;
        const valueClass = quad.object.value;

        // Get the property
        const propQuads = this.store.getQuads(namedNode(restrictionUri), NS.OWL + 'onProperty', null);
        if (propQuads.length === 0) continue;

        constraints.push({
          property: propQuads[0].object.value,
          constraint: type,
          value: valueClass,
        });
      }
    }

    return constraints;
  }

  /**
   * Extract hasValue constraints
   * @private
   * @returns {Array<Object>}
   */
  _extractHasValueConstraints() {
    const constraints = [];

    const quads = this.store.getQuads(null, NS.OWL + 'hasValue', null);

    for (const quad of quads) {
      const restrictionUri = quad.subject.value;
      const value = quad.object.value;

      // Get the property
      const propQuads = this.store.getQuads(namedNode(restrictionUri), NS.OWL + 'onProperty', null);
      if (propQuads.length === 0) continue;

      constraints.push({
        property: propQuads[0].object.value,
        constraint: 'hasValue',
        value: value,
      });
    }

    return constraints;
  }

  /**
   * Extract XSD datatype constraints
   * @private
   * @returns {Array<Object>}
   */
  _extractXSDConstraints() {
    const constraints = [];

    // Map of XSD constraint predicates
    const xsdConstraints = [
      { pred: NS.XSD + 'minInclusive', type: 'minInclusive' },
      { pred: NS.XSD + 'maxInclusive', type: 'maxInclusive' },
      { pred: NS.XSD + 'minExclusive', type: 'minExclusive' },
      { pred: NS.XSD + 'maxExclusive', type: 'maxExclusive' },
      { pred: NS.XSD + 'pattern', type: 'pattern' },
      { pred: NS.XSD + 'length', type: 'length' },
      { pred: NS.XSD + 'minLength', type: 'minLength' },
      { pred: NS.XSD + 'maxLength', type: 'maxLength' },
    ];

    for (const { pred, type } of xsdConstraints) {
      const quads = this.store.getQuads(null, pred, null);

      for (const quad of quads) {
        constraints.push({
          property: quad.subject.value,
          constraint: type,
          value: quad.object.value,
        });
      }
    }

    return constraints;
  }

  /**
   * Extract ontology-level metadata
   * @private
   * @returns {Promise<Object>}
   */
  async _extractOntologyMetadata() {
    const metadata = {};

    // Find ontology declaration
    const ontologyQuads = this.store.getQuads(null, NS.RDF + 'type', namedNode(NS.OWL + 'Ontology'));

    if (ontologyQuads.length > 0) {
      const ontologyUri = ontologyQuads[0].subject.value;

      // Extract common metadata
      const metadataProps = [
        { pred: NS.DCTERMS + 'title', key: 'title' },
        { pred: NS.DCTERMS + 'description', key: 'description' },
        { pred: NS.DCTERMS + 'creator', key: 'creator' },
        { pred: NS.DCTERMS + 'created', key: 'created' },
        { pred: NS.DCTERMS + 'modified', key: 'modified' },
        { pred: NS.OWL + 'versionInfo', key: 'version' },
        { pred: NS.DCTERMS + 'license', key: 'license' },
      ];

      for (const { pred, key } of metadataProps) {
        const quads = this.store.getQuads(namedNode(ontologyUri), pred, null);
        if (quads.length > 0) {
          metadata[key] = quads[0].object.value;
        }
      }

      metadata.uri = ontologyUri;
    }

    return metadata;
  }

  /**
   * Enrich classes with their properties and relationships
   * @private
   * @param {ProjectSchema} schema - The schema to enrich
   */
  async _enrichClasses(schema) {
    // Build maps for quick lookup
    const classMap = new Map(schema.classes.map(c => [c.uri, c]));

    // Process datatype properties
    const datatypeProps = this.store.getQuads(
      null,
      NS.RDF + 'type',
      namedNode(NS.OWL + 'DatatypeProperty')
    );

    for (const quad of datatypeProps) {
      const propUri = quad.subject.value;

      if (this._isBuiltIn(propUri)) {
        continue;
      }

      const domains = this._getPropertyDomain(propUri);
      const ranges = this._getPropertyRange(propUri);

      for (const domainUri of domains) {
        const classDef = classMap.get(domainUri);
        if (!classDef) continue;

        const propDef = {
          uri: propUri,
          name: this._getLocalName(propUri),
          label: this._getLabel(propUri),
          comment: this._getComment(propUri),
          range: ranges.length > 0 ? ranges[0] : NS.XSD + 'string',
          required: this._isPropertyRequired(propUri),
          minCardinality: null,
          maxCardinality: null,
          constraints: [],
        };

        // Find cardinality constraints for this property
        const restrictions = this._findPropertyRestrictions(propUri);
        for (const restrictionUri of restrictions) {
          const minCard = this._getRestrictionCardinality(restrictionUri, 'min');
          const maxCard = this._getRestrictionCardinality(restrictionUri, 'max');

          if (minCard !== null) {
            propDef.minCardinality = minCard;
            propDef.required = minCard > 0;
          }
          if (maxCard !== null) {
            propDef.maxCardinality = maxCard;
          }
        }

        // Add constraints from validation rules
        propDef.constraints = schema.validation
          .filter(v => v.property === propUri)
          .map(v => ({ type: v.constraint, value: v.value }));

        classDef.properties.push(propDef);
      }
    }

    // Add relationships to classes
    for (const rel of schema.relationships) {
      const classDef = classMap.get(rel.from);
      if (classDef) {
        classDef.relationships.push({
          uri: rel.predicate,
          name: rel.name,
          label: rel.label,
          comment: rel.comment,
          range: rel.to,
          inverseOf: rel.inverse,
          cardinality: rel.cardinality,
          required: rel.required,
        });
      }
    }
  }

  /**
   * Get rdfs:label for a resource
   * @private
   * @param {string} uri - Resource URI
   * @returns {string} Label or local name
   */
  _getLabel(uri) {
    const quads = this.store.getQuads(namedNode(uri), NS.RDFS + 'label', null);
    return quads.length > 0 ? quads[0].object.value : this._getLocalName(uri);
  }

  /**
   * Get rdfs:comment for a resource
   * @private
   * @param {string} uri - Resource URI
   * @returns {string} Comment or empty string
   */
  _getComment(uri) {
    const quads = this.store.getQuads(namedNode(uri), NS.RDFS + 'comment', null);
    return quads.length > 0 ? quads[0].object.value : '';
  }

  /**
   * Extract local name from URI
   * @private
   * @param {string} uri - Full URI
   * @returns {string} Local name
   */
  _getLocalName(uri) {
    if (!uri) return '';

    // Try fragment identifier first (#)
    if (uri.includes('#')) {
      return uri.split('#').pop();
    }

    // Then try path separator (/)
    return uri.split('/').pop();
  }

  /**
   * Check if URI is a built-in OWL/RDFS/RDF term
   * @private
   * @param {string} uri - URI to check
   * @returns {boolean} True if built-in
   */
  _isBuiltIn(uri) {
    return uri.startsWith(NS.OWL) ||
           uri.startsWith(NS.RDF) ||
           uri.startsWith(NS.RDFS) ||
           uri.startsWith(NS.XSD);
  }

  /**
   * Resolve a prefixed name to full URI
   * @param {string} prefixedName - Name with prefix (e.g., "foaf:Person")
   * @returns {string|null} Full URI or null if prefix not found
   */
  resolveUri(prefixedName) {
    const [prefix, localName] = prefixedName.split(':');
    const namespaceUri = this.namespaces[prefix];
    return namespaceUri ? namespaceUri + localName : null;
  }

  /**
   * Shorten URI to prefixed form if possible
   * @param {string} uri - Full URI
   * @returns {string} Prefixed form or original URI
   */
  shortenUri(uri) {
    for (const [prefix, namespaceUri] of Object.entries(this.namespaces)) {
      if (uri.startsWith(namespaceUri)) {
        return prefix + ':' + uri.slice(namespaceUri.length);
      }
    }
    return uri;
  }
}

export default OntologyProjectParser;
