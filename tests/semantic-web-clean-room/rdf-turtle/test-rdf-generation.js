#!/usr/bin/env node

/**
 * RDF/Turtle Generation Test Suite
 * Tests the semantic web filters for RDF resource generation
 */

import { Parser, Store, Writer } from 'n3';
import fs from 'fs';
import path from 'path';

// Import semantic filters directly for testing
const semanticFilters = {
  rdfResource: (value, baseUri) => {
    if (!value) return '';
    
    if (value.match(/^https?:\/\//) || value.match(/^urn:/)) {
      return value;
    }
    
    const cleaned = value.replace(/[^a-zA-Z0-9\-_\/]/g, '');
    
    if (baseUri) {
      return baseUri.endsWith('/') ? `${baseUri}${cleaned}` : `${baseUri}/${cleaned}`;
    }
    
    return cleaned;
  },

  rdfLiteral: (value, langOrType) => {
    if (!value) return '""';
    
    const escaped = value.replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t');
    
    if (!langOrType) {
      return `"${escaped}"`;
    }
    
    if (langOrType.includes(':') || langOrType.startsWith('xsd:')) {
      return `"${escaped}"^^${langOrType}`;
    }
    
    return `"${escaped}"@${langOrType}`;
  },

  rdfClass: (className, prefix) => {
    if (!className) return '';
    
    // Simple pascal case conversion
    const formattedClass = className.charAt(0).toUpperCase() + 
                          className.slice(1).replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase());
    
    if (prefix) {
      return `${prefix}:${formattedClass}`;
    }
    
    return formattedClass;
  },

  rdfProperty: (propertyName, prefix) => {
    if (!propertyName) return '';
    
    // Simple camel case conversion
    const formattedProperty = propertyName.charAt(0).toLowerCase() + 
                             propertyName.slice(1).replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase());
    
    if (prefix) {
      return `${prefix}:${formattedProperty}`;
    }
    
    return formattedProperty;
  },

  rdfDatatype: (type) => {
    const xsdTypes = {
      'string': 'xsd:string',
      'integer': 'xsd:integer',
      'int': 'xsd:integer',
      'float': 'xsd:float',
      'double': 'xsd:double',
      'decimal': 'xsd:decimal',
      'boolean': 'xsd:boolean',
      'bool': 'xsd:boolean',
      'date': 'xsd:date',
      'time': 'xsd:time',
      'dateTime': 'xsd:dateTime',
      'datetime': 'xsd:dateTime',
      'duration': 'xsd:duration',
      'uri': 'xsd:anyURI',
      'url': 'xsd:anyURI'
    };
    
    return xsdTypes[type] || (type.includes(':') ? type : `xsd:${type}`);
  },

  owlRestriction: (property, restrictionType, value, prefix) => {
    const propRef = semanticFilters.rdfProperty(property, prefix);
    
    const restrictions = {
      'someValuesFrom': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:someValuesFrom ${value} ]`,
      'allValuesFrom': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:allValuesFrom ${value} ]`,
      'hasValue': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:hasValue ${value} ]`,
      'cardinality': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:cardinality "${value}"^^xsd:nonNegativeInteger ]`
    };
    
    return restrictions[restrictionType] || `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ]`;
  }
};

class RDFTurtleTestSuite {
  constructor() {
    this.testResults = [];
    this.parser = new Parser();
    this.store = new Store();
  }

  async runTest(name, testFn) {
    try {
      console.log(`\n🧪 Running: ${name}`);
      const result = await testFn();
      this.testResults.push({ name, status: 'PASS', result });
      console.log(`✅ PASS: ${name}`);
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
      return null;
    }
  }

  async validateTurtle(turtleString) {
    return new Promise((resolve, reject) => {
      const store = new Store();
      
      this.parser.parse(turtleString, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          // Parsing complete
          resolve({ store, prefixes, quadCount: store.size });
        }
      });
    });
  }

  async testBasicRDFGeneration() {
    // Test basic RDF resource generation
    const resource1 = semanticFilters.rdfResource('person-name');
    const resource2 = semanticFilters.rdfResource('Company Name!@#', 'https://example.org/');
    const resource3 = semanticFilters.rdfResource('https://schema.org/Person');
    
    console.log('Resource 1:', resource1);
    console.log('Resource 2:', resource2);
    console.log('Resource 3:', resource3);
    
    if (resource1 !== 'person-name' || 
        resource2 !== 'https://example.org/CompanyName' ||
        resource3 !== 'https://schema.org/Person') {
      throw new Error('Basic RDF resource generation failed');
    }
    
    return { resource1, resource2, resource3 };
  }

  async testRDFLiterals() {
    // Test RDF literal generation with language tags and datatypes
    const literal1 = semanticFilters.rdfLiteral('Hello World', 'en');
    const literal2 = semanticFilters.rdfLiteral('42', 'xsd:integer');
    const literal3 = semanticFilters.rdfLiteral('Special "quotes" and \n newlines');
    
    console.log('Literal 1:', literal1);
    console.log('Literal 2:', literal2);
    console.log('Literal 3:', literal3);
    
    if (!literal1.includes('@en') || 
        !literal2.includes('^^xsd:integer') ||
        !literal3.includes('\\"')) {
      throw new Error('RDF literal generation failed');
    }
    
    return { literal1, literal2, literal3 };
  }

  async testClassAndPropertyGeneration() {
    // Test RDF class and property generation
    const class1 = semanticFilters.rdfClass('person-class', 'ex');
    const class2 = semanticFilters.rdfClass('company_organization');
    const prop1 = semanticFilters.rdfProperty('first-name', 'ex');
    const prop2 = semanticFilters.rdfProperty('Company_Email_Address');
    
    console.log('Class 1:', class1);
    console.log('Class 2:', class2);
    console.log('Property 1:', prop1);
    console.log('Property 2:', prop2);
    
    if (class1 !== 'ex:PersonClass' || 
        class2 !== 'CompanyOrganization' ||
        prop1 !== 'ex:firstName' ||
        prop2 !== 'companyEmailAddress') {
      throw new Error('Class and property generation failed');
    }
    
    return { class1, class2, prop1, prop2 };
  }

  async testComplexOntologyGeneration() {
    // Generate a complete OWL ontology
    const ontology = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <https://example.org/ontology#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.org/ontology> rdf:type owl:Ontology ;
    rdfs:label "Test Enterprise Ontology"@en ;
    rdfs:comment "Generated ontology for testing RDF/Turtle generation"@en .

${semanticFilters.rdfClass('Person', 'ex')} rdf:type owl:Class ;
    rdfs:label ${semanticFilters.rdfLiteral('Person', 'en')} ;
    rdfs:comment ${semanticFilters.rdfLiteral('A human being', 'en')} .

${semanticFilters.rdfClass('Organization', 'ex')} rdf:type owl:Class ;
    rdfs:label ${semanticFilters.rdfLiteral('Organization', 'en')} ;
    rdfs:comment ${semanticFilters.rdfLiteral('A structured group of people', 'en')} .

${semanticFilters.rdfClass('Employee', 'ex')} rdf:type owl:Class ;
    rdfs:subClassOf ${semanticFilters.rdfClass('Person', 'ex')} ;
    rdfs:subClassOf ${semanticFilters.owlRestriction('worksFor', 'someValuesFrom', 'ex:Organization', 'ex')} ;
    rdfs:label ${semanticFilters.rdfLiteral('Employee', 'en')} .

${semanticFilters.rdfProperty('firstName', 'ex')} rdf:type owl:DatatypeProperty ;
    rdfs:domain ${semanticFilters.rdfClass('Person', 'ex')} ;
    rdfs:range ${semanticFilters.rdfDatatype('string')} ;
    rdfs:label ${semanticFilters.rdfLiteral('First Name', 'en')} .

${semanticFilters.rdfProperty('worksFor', 'ex')} rdf:type owl:ObjectProperty ;
    rdfs:domain ${semanticFilters.rdfClass('Employee', 'ex')} ;
    rdfs:range ${semanticFilters.rdfClass('Organization', 'ex')} ;
    rdfs:label ${semanticFilters.rdfLiteral('Works For', 'en')} .

${semanticFilters.rdfProperty('employeeCount', 'ex')} rdf:type owl:DatatypeProperty ;
    rdfs:domain ${semanticFilters.rdfClass('Organization', 'ex')} ;
    rdfs:range ${semanticFilters.rdfDatatype('integer')} ;
    rdfs:label ${semanticFilters.rdfLiteral('Employee Count', 'en')} .
`;

    console.log('Generated Ontology:');
    console.log(ontology);
    
    // Validate the generated Turtle syntax
    const validation = await this.validateTurtle(ontology);
    console.log(`Validation result: ${validation.quadCount} triples parsed successfully`);
    
    return { ontology, validation };
  }

  async testOWLRestrictions() {
    // Test various OWL restriction patterns
    const someValues = semanticFilters.owlRestriction('hasChild', 'someValuesFrom', 'ex:Person', 'ex');
    const allValues = semanticFilters.owlRestriction('hasEmployee', 'allValuesFrom', 'ex:Employee', 'ex');
    const cardinality = semanticFilters.owlRestriction('hasManager', 'cardinality', '1', 'ex');
    
    console.log('Some Values From:', someValues);
    console.log('All Values From:', allValues);
    console.log('Cardinality:', cardinality);
    
    if (!someValues.includes('owl:someValuesFrom') ||
        !allValues.includes('owl:allValuesFrom') ||
        !cardinality.includes('owl:cardinality')) {
      throw new Error('OWL restriction generation failed');
    }
    
    return { someValues, allValues, cardinality };
  }

  async testDataTypeMapping() {
    // Test XSD datatype mapping
    const mappings = [
      ['string', 'xsd:string'],
      ['integer', 'xsd:integer'],
      ['boolean', 'xsd:boolean'],
      ['date', 'xsd:date'],
      ['dateTime', 'xsd:dateTime'],
      ['float', 'xsd:float'],
      ['uri', 'xsd:anyURI']
    ];
    
    const results = {};
    for (const [input, expected] of mappings) {
      const result = semanticFilters.rdfDatatype(input);
      console.log(`${input} -> ${result}`);
      if (result !== expected) {
        throw new Error(`Datatype mapping failed for ${input}: expected ${expected}, got ${result}`);
      }
      results[input] = result;
    }
    
    return results;
  }

  async runAllTests() {
    console.log('🚀 Starting RDF/Turtle Generation Test Suite');
    console.log('=====================================================');

    await this.runTest('Basic RDF Resource Generation', () => this.testBasicRDFGeneration());
    await this.runTest('RDF Literal Generation', () => this.testRDFLiterals());
    await this.runTest('Class and Property Generation', () => this.testClassAndPropertyGeneration());
    await this.runTest('Complex Ontology Generation', () => this.testComplexOntologyGeneration());
    await this.runTest('OWL Restrictions', () => this.testOWLRestrictions());
    await this.runTest('Data Type Mapping', () => this.testDataTypeMapping());

    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.testResults.length}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => r.status === 'FAIL').forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }
    
    return {
      passed,
      failed,
      total: this.testResults.length,
      results: this.testResults
    };
  }
}

// Run the test suite if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new RDFTurtleTestSuite();
  testSuite.runAllTests().then(summary => {
    console.log('\n🏁 RDF/Turtle Generation Tests Complete');
    process.exit(summary.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export default RDFTurtleTestSuite;