/**
 * Ontology Project Parser
 * Analyzes RDF ontology to extract project structure
 */

import * as N3 from 'n3';
import { promises as fs } from 'fs';

export class OntologyProjectParser {
  constructor() {
    this.store = new N3.Store();
    this.parser = new N3.Parser();
    this.namespaces = {
      schema: 'http://schema.org/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#'
    };
  }

  /**
   * Load and parse ontology file
   */
  async loadOntology(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return new Promise((resolve, reject) => {
      this.parser.parse(content, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.store.addQuad(quad);
        } else {
          resolve(this.store);
        }
      });
    });
  }

  /**
   * Extract project structure from ontology
   */
  async extractProjectStructure() {
    const structure = {
      classes: [],
      properties: [],
      relationships: [],
      metadata: {}
    };

    // Extract classes (tables/models)
    const classQuads = this.store.getQuads(null, this.namespaces.rdf + 'type', this.namespaces.owl + 'Class');
    for (const quad of classQuads) {
      const classData = await this.extractClassDetails(quad.subject.value);
      structure.classes.push(classData);
    }

    // Extract properties (fields/columns)
    const propertyQuads = this.store.getQuads(null, this.namespaces.rdf + 'type', this.namespaces.owl + 'DatatypeProperty');
    for (const quad of propertyQuads) {
      const propertyData = await this.extractPropertyDetails(quad.subject.value);
      structure.properties.push(propertyData);
    }

    // Extract object properties (relationships)
    const relationshipQuads = this.store.getQuads(null, this.namespaces.rdf + 'type', this.namespaces.owl + 'ObjectProperty');
    for (const quad of relationshipQuads) {
      const relationshipData = await this.extractRelationshipDetails(quad.subject.value);
      structure.relationships.push(relationshipData);
    }

    // Extract metadata
    structure.metadata = await this.extractMetadata();

    return structure;
  }

  /**
   * Extract class/model details
   */
  async extractClassDetails(classUri) {
    const classData = {
      uri: classUri,
      name: this.extractLocalName(classUri),
      label: '',
      comment: '',
      properties: [],
      superClass: null
    };

    // Get label
    const labels = this.store.getQuads(classUri, this.namespaces.rdfs + 'label', null);
    if (labels.length > 0) {
      classData.label = labels[0].object.value;
    }

    // Get comment
    const comments = this.store.getQuads(classUri, this.namespaces.rdfs + 'comment', null);
    if (comments.length > 0) {
      classData.comment = comments[0].object.value;
    }

    // Get superclass
    const superClasses = this.store.getQuads(classUri, this.namespaces.rdfs + 'subClassOf', null);
    if (superClasses.length > 0) {
      classData.superClass = this.extractLocalName(superClasses[0].object.value);
    }

    return classData;
  }

  /**
   * Extract property details
   */
  async extractPropertyDetails(propertyUri) {
    const propertyData = {
      uri: propertyUri,
      name: this.extractLocalName(propertyUri),
      label: '',
      comment: '',
      domain: null,
      range: null,
      datatype: 'string'
    };

    // Get label
    const labels = this.store.getQuads(propertyUri, this.namespaces.rdfs + 'label', null);
    if (labels.length > 0) {
      propertyData.label = labels[0].object.value;
    }

    // Get comment
    const comments = this.store.getQuads(propertyUri, this.namespaces.rdfs + 'comment', null);
    if (comments.length > 0) {
      propertyData.comment = comments[0].object.value;
    }

    // Get domain (which class this property belongs to)
    const domains = this.store.getQuads(propertyUri, this.namespaces.rdfs + 'domain', null);
    if (domains.length > 0) {
      propertyData.domain = this.extractLocalName(domains[0].object.value);
    }

    // Get range (data type)
    const ranges = this.store.getQuads(propertyUri, this.namespaces.rdfs + 'range', null);
    if (ranges.length > 0) {
      const rangeUri = ranges[0].object.value;
      propertyData.range = rangeUri;
      propertyData.datatype = this.mapXSDToJSType(rangeUri);
    }

    return propertyData;
  }

  /**
   * Extract relationship details
   */
  async extractRelationshipDetails(relationshipUri) {
    const relationshipData = {
      uri: relationshipUri,
      name: this.extractLocalName(relationshipUri),
      label: '',
      domain: null,
      range: null,
      type: 'hasMany'
    };

    // Get label
    const labels = this.store.getQuads(relationshipUri, this.namespaces.rdfs + 'label', null);
    if (labels.length > 0) {
      relationshipData.label = labels[0].object.value;
    }

    // Get domain
    const domains = this.store.getQuads(relationshipUri, this.namespaces.rdfs + 'domain', null);
    if (domains.length > 0) {
      relationshipData.domain = this.extractLocalName(domains[0].object.value);
    }

    // Get range
    const ranges = this.store.getQuads(relationshipUri, this.namespaces.rdfs + 'range', null);
    if (ranges.length > 0) {
      relationshipData.range = this.extractLocalName(ranges[0].object.value);
    }

    return relationshipData;
  }

  /**
   * Extract metadata
   */
  async extractMetadata() {
    const metadata = {
      title: '',
      description: '',
      version: '1.0.0',
      author: ''
    };

    // Look for ontology metadata
    const ontologyQuads = this.store.getQuads(null, this.namespaces.rdf + 'type', this.namespaces.owl + 'Ontology');
    if (ontologyQuads.length > 0) {
      const ontologyUri = ontologyQuads[0].subject.value;

      const titles = this.store.getQuads(ontologyUri, 'http://purl.org/dc/terms/title', null);
      if (titles.length > 0) {
        metadata.title = titles[0].object.value;
      }

      const descriptions = this.store.getQuads(ontologyUri, 'http://purl.org/dc/terms/description', null);
      if (descriptions.length > 0) {
        metadata.description = descriptions[0].object.value;
      }
    }

    return metadata;
  }

  /**
   * Extract local name from URI
   */
  extractLocalName(uri) {
    if (!uri) return '';
    const parts = uri.split(/[#/]/);
    const name = parts[parts.length - 1];
    // Convert to camelCase
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /**
   * Map XSD datatype to JavaScript type
   */
  mapXSDToJSType(xsdType) {
    const typeMap = {
      'http://www.w3.org/2001/XMLSchema#string': 'string',
      'http://www.w3.org/2001/XMLSchema#integer': 'number',
      'http://www.w3.org/2001/XMLSchema#int': 'number',
      'http://www.w3.org/2001/XMLSchema#decimal': 'number',
      'http://www.w3.org/2001/XMLSchema#float': 'number',
      'http://www.w3.org/2001/XMLSchema#double': 'number',
      'http://www.w3.org/2001/XMLSchema#boolean': 'boolean',
      'http://www.w3.org/2001/XMLSchema#date': 'Date',
      'http://www.w3.org/2001/XMLSchema#dateTime': 'Date'
    };

    return typeMap[xsdType] || 'string';
  }

  /**
   * Map property to database column type
   */
  mapToDBType(jsType, framework = 'postgresql') {
    const typeMap = {
      postgresql: {
        string: 'VARCHAR(255)',
        number: 'INTEGER',
        boolean: 'BOOLEAN',
        Date: 'TIMESTAMP'
      },
      mysql: {
        string: 'VARCHAR(255)',
        number: 'INT',
        boolean: 'TINYINT(1)',
        Date: 'DATETIME'
      },
      sqlite: {
        string: 'TEXT',
        number: 'INTEGER',
        boolean: 'INTEGER',
        Date: 'TEXT'
      }
    };

    return typeMap[framework]?.[jsType] || 'TEXT';
  }
}

export default OntologyProjectParser;
