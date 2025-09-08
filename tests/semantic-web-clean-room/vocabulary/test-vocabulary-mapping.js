#!/usr/bin/env node

/**
 * Vocabulary Mapping Test Suite
 * Tests Schema.org, Dublin Core, FOAF, and SKOS filter implementations
 */

import { Parser, Store } from 'n3';

// Vocabulary filter implementations for testing
const vocabularyFilters = {
  // Schema.org mappings
  schemaOrg: (type, property) => {
    const schemaOrgTypes = {
      'Person': 'schema:Person',
      'Organization': 'schema:Organization',
      'Event': 'schema:Event',
      'Place': 'schema:Place',
      'Product': 'schema:Product',
      'Article': 'schema:Article',
      'WebSite': 'schema:WebSite',
      'WebPage': 'schema:WebPage'
    };
    
    const schemaOrgProperties = {
      'name': 'schema:name',
      'description': 'schema:description',
      'url': 'schema:url',
      'email': 'schema:email',
      'telephone': 'schema:telephone',
      'address': 'schema:address',
      'birthDate': 'schema:birthDate',
      'jobTitle': 'schema:jobTitle',
      'worksFor': 'schema:worksFor',
      'author': 'schema:author',
      'datePublished': 'schema:datePublished',
      'keywords': 'schema:keywords',
      'image': 'schema:image'
    };
    
    if (property) {
      return schemaOrgProperties[property] || `schema:${property}`;
    }
    
    return schemaOrgTypes[type] || `schema:${type}`;
  },

  // Dublin Core mappings
  dublinCore: (element) => {
    const dcElements = {
      'title': 'dcterms:title',
      'creator': 'dcterms:creator',
      'subject': 'dcterms:subject',
      'description': 'dcterms:description',
      'publisher': 'dcterms:publisher',
      'contributor': 'dcterms:contributor',
      'date': 'dcterms:date',
      'created': 'dcterms:created',
      'modified': 'dcterms:modified',
      'type': 'dcterms:type',
      'format': 'dcterms:format',
      'identifier': 'dcterms:identifier',
      'source': 'dcterms:source',
      'language': 'dcterms:language',
      'relation': 'dcterms:relation',
      'coverage': 'dcterms:coverage',
      'rights': 'dcterms:rights',
      'license': 'dcterms:license'
    };
    
    return dcElements[element] || `dcterms:${element}`;
  },

  // FOAF mappings
  foaf: (concept) => {
    const foafConcepts = {
      'Person': 'foaf:Person',
      'Agent': 'foaf:Agent',
      'Group': 'foaf:Group',
      'Organization': 'foaf:Organization',
      'Document': 'foaf:Document',
      'Image': 'foaf:Image',
      'name': 'foaf:name',
      'firstName': 'foaf:firstName',
      'lastName': 'foaf:lastName',
      'nick': 'foaf:nick',
      'email': 'foaf:mbox',
      'homepage': 'foaf:homepage',
      'weblog': 'foaf:weblog',
      'knows': 'foaf:knows',
      'member': 'foaf:member',
      'age': 'foaf:age',
      'birthday': 'foaf:birthday',
      'gender': 'foaf:gender',
      'phone': 'foaf:phone',
      'workplaceHomepage': 'foaf:workplaceHomepage',
      'schoolHomepage': 'foaf:schoolHomepage'
    };
    
    return foafConcepts[concept] || `foaf:${concept}`;
  },

  // SKOS mappings
  skos: (concept) => {
    const skosConcepts = {
      'Concept': 'skos:Concept',
      'ConceptScheme': 'skos:ConceptScheme',
      'Collection': 'skos:Collection',
      'prefLabel': 'skos:prefLabel',
      'altLabel': 'skos:altLabel',
      'hiddenLabel': 'skos:hiddenLabel',
      'definition': 'skos:definition',
      'note': 'skos:note',
      'scopeNote': 'skos:scopeNote',
      'example': 'skos:example',
      'historyNote': 'skos:historyNote',
      'editorialNote': 'skos:editorialNote',
      'changeNote': 'skos:changeNote',
      'broader': 'skos:broader',
      'narrower': 'skos:narrower',
      'related': 'skos:related',
      'broaderTransitive': 'skos:broaderTransitive',
      'narrowerTransitive': 'skos:narrowerTransitive',
      'inScheme': 'skos:inScheme',
      'hasTopConcept': 'skos:hasTopConcept',
      'topConceptOf': 'skos:topConceptOf'
    };
    
    return skosConcepts[concept] || `skos:${concept}`;
  },

  // Generate complete vocabulary mapping
  generateVocabularyMapping: (baseUri, vocabulary, concepts) => {
    const mappings = [];
    
    for (const concept of concepts) {
      let mapping;
      switch (vocabulary.toLowerCase()) {
        case 'schema.org':
        case 'schema':
          mapping = vocabularyFilters.schemaOrg(concept);
          break;
        case 'dublincore':
        case 'dc':
          mapping = vocabularyFilters.dublinCore(concept);
          break;
        case 'foaf':
          mapping = vocabularyFilters.foaf(concept);
          break;
        case 'skos':
          mapping = vocabularyFilters.skos(concept);
          break;
        default:
          mapping = `${vocabulary}:${concept}`;
      }
      
      mappings.push({
        concept,
        mapping,
        uri: baseUri ? `<${baseUri}${concept}>` : concept
      });
    }
    
    return mappings;
  },

  // Validate namespace URI
  validateNamespace: (uri) => {
    const wellKnownNamespaces = {
      'http://schema.org/': 'schema',
      'http://purl.org/dc/terms/': 'dcterms',
      'http://xmlns.com/foaf/0.1/': 'foaf',
      'http://www.w3.org/2004/02/skos/core#': 'skos',
      'http://www.w3.org/2002/07/owl#': 'owl',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf',
      'http://www.w3.org/2000/01/rdf-schema#': 'rdfs',
      'http://www.w3.org/2001/XMLSchema#': 'xsd'
    };
    
    return {
      uri,
      isWellKnown: Object.keys(wellKnownNamespaces).includes(uri),
      suggestedPrefix: wellKnownNamespaces[uri] || null,
      isValid: uri.match(/^https?:\/\//) !== null
    };
  }
};

class VocabularyMappingTestSuite {
  constructor() {
    this.testResults = [];
    this.parser = new Parser();
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

  async testSchemaOrgMappings() {
    // Test Schema.org type and property mappings
    const personType = vocabularyFilters.schemaOrg('Person');
    const organizationType = vocabularyFilters.schemaOrg('Organization');
    const nameProperty = vocabularyFilters.schemaOrg(null, 'name');
    const emailProperty = vocabularyFilters.schemaOrg(null, 'email');
    const customType = vocabularyFilters.schemaOrg('CustomType');
    
    console.log('Person Type:', personType);
    console.log('Organization Type:', organizationType);
    console.log('Name Property:', nameProperty);
    console.log('Email Property:', emailProperty);
    console.log('Custom Type:', customType);
    
    if (personType !== 'schema:Person' ||
        organizationType !== 'schema:Organization' ||
        nameProperty !== 'schema:name' ||
        emailProperty !== 'schema:email' ||
        customType !== 'schema:CustomType') {
      throw new Error('Schema.org mapping validation failed');
    }
    
    return { personType, organizationType, nameProperty, emailProperty, customType };
  }

  async testDublinCoreMappings() {
    // Test Dublin Core element mappings
    const title = vocabularyFilters.dublinCore('title');
    const creator = vocabularyFilters.dublinCore('creator');
    const created = vocabularyFilters.dublinCore('created');
    const description = vocabularyFilters.dublinCore('description');
    const rights = vocabularyFilters.dublinCore('rights');
    const customElement = vocabularyFilters.dublinCore('customElement');
    
    console.log('Title:', title);
    console.log('Creator:', creator);
    console.log('Created:', created);
    console.log('Description:', description);
    console.log('Rights:', rights);
    console.log('Custom Element:', customElement);
    
    if (title !== 'dcterms:title' ||
        creator !== 'dcterms:creator' ||
        created !== 'dcterms:created' ||
        description !== 'dcterms:description' ||
        rights !== 'dcterms:rights' ||
        customElement !== 'dcterms:customElement') {
      throw new Error('Dublin Core mapping validation failed');
    }
    
    return { title, creator, created, description, rights, customElement };
  }

  async testFoafMappings() {
    // Test FOAF vocabulary mappings
    const person = vocabularyFilters.foaf('Person');
    const organization = vocabularyFilters.foaf('Organization');
    const name = vocabularyFilters.foaf('name');
    const email = vocabularyFilters.foaf('email');
    const knows = vocabularyFilters.foaf('knows');
    const homepage = vocabularyFilters.foaf('homepage');
    
    console.log('Person:', person);
    console.log('Organization:', organization);
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Knows:', knows);
    console.log('Homepage:', homepage);
    
    if (person !== 'foaf:Person' ||
        organization !== 'foaf:Organization' ||
        name !== 'foaf:name' ||
        email !== 'foaf:mbox' ||  // Special mapping
        knows !== 'foaf:knows' ||
        homepage !== 'foaf:homepage') {
      throw new Error('FOAF mapping validation failed');
    }
    
    return { person, organization, name, email, knows, homepage };
  }

  async testSkosMappings() {
    // Test SKOS vocabulary mappings
    const concept = vocabularyFilters.skos('Concept');
    const conceptScheme = vocabularyFilters.skos('ConceptScheme');
    const prefLabel = vocabularyFilters.skos('prefLabel');
    const broader = vocabularyFilters.skos('broader');
    const narrower = vocabularyFilters.skos('narrower');
    const related = vocabularyFilters.skos('related');
    
    console.log('Concept:', concept);
    console.log('Concept Scheme:', conceptScheme);
    console.log('Preferred Label:', prefLabel);
    console.log('Broader:', broader);
    console.log('Narrower:', narrower);
    console.log('Related:', related);
    
    if (concept !== 'skos:Concept' ||
        conceptScheme !== 'skos:ConceptScheme' ||
        prefLabel !== 'skos:prefLabel' ||
        broader !== 'skos:broader' ||
        narrower !== 'skos:narrower' ||
        related !== 'skos:related') {
      throw new Error('SKOS mapping validation failed');
    }
    
    return { concept, conceptScheme, prefLabel, broader, narrower, related };
  }

  async testVocabularyGeneration() {
    // Test complete vocabulary mapping generation
    const schemaMappings = vocabularyFilters.generateVocabularyMapping(
      'https://example.org/',
      'schema',
      ['Person', 'Organization', 'name', 'email']
    );
    
    const dcMappings = vocabularyFilters.generateVocabularyMapping(
      'https://example.org/',
      'dublincore',
      ['title', 'creator', 'description']
    );
    
    const foafMappings = vocabularyFilters.generateVocabularyMapping(
      'https://example.org/',
      'foaf',
      ['Person', 'name', 'email', 'knows']
    );
    
    console.log('Schema.org mappings:', JSON.stringify(schemaMappings, null, 2));
    console.log('Dublin Core mappings:', JSON.stringify(dcMappings, null, 2));
    console.log('FOAF mappings:', JSON.stringify(foafMappings, null, 2));
    
    if (schemaMappings.length !== 4 || 
        dcMappings.length !== 3 ||
        foafMappings.length !== 4) {
      throw new Error('Vocabulary generation failed');
    }
    
    return { schemaMappings, dcMappings, foafMappings };
  }

  async testNamespaceValidation() {
    // Test namespace URI validation
    const schemaValidation = vocabularyFilters.validateNamespace('http://schema.org/');
    const dcValidation = vocabularyFilters.validateNamespace('http://purl.org/dc/terms/');
    const foafValidation = vocabularyFilters.validateNamespace('http://xmlns.com/foaf/0.1/');
    const customValidation = vocabularyFilters.validateNamespace('https://example.org/vocab#');
    const invalidValidation = vocabularyFilters.validateNamespace('not-a-uri');
    
    console.log('Schema.org validation:', schemaValidation);
    console.log('Dublin Core validation:', dcValidation);
    console.log('FOAF validation:', foafValidation);
    console.log('Custom validation:', customValidation);
    console.log('Invalid validation:', invalidValidation);
    
    if (!schemaValidation.isWellKnown ||
        !dcValidation.isWellKnown ||
        !foafValidation.isWellKnown ||
        !customValidation.isValid ||
        invalidValidation.isValid) {
      throw new Error('Namespace validation failed');
    }
    
    return { schemaValidation, dcValidation, foafValidation, customValidation, invalidValidation };
  }

  async testCompleteVocabularyIntegration() {
    // Test complete vocabulary integration with RDF/Turtle output
    const vocabularyDocument = `
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <https://example.org/> .

# Schema.org person description
ex:john rdf:type ${vocabularyFilters.schemaOrg('Person')} ;
    ${vocabularyFilters.schemaOrg(null, 'name')} "John Doe" ;
    ${vocabularyFilters.schemaOrg(null, 'email')} "john@example.org" ;
    ${vocabularyFilters.schemaOrg(null, 'jobTitle')} "Software Developer" .

# Dublin Core metadata
ex:document rdf:type foaf:Document ;
    ${vocabularyFilters.dublinCore('title')} "Enterprise Ontology Documentation" ;
    ${vocabularyFilters.dublinCore('creator')} "John Doe" ;
    ${vocabularyFilters.dublinCore('created')} "2024-01-01"^^xsd:date ;
    ${vocabularyFilters.dublinCore('description')} "Comprehensive ontology for enterprise data" .

# FOAF social network
ex:john rdf:type ${vocabularyFilters.foaf('Person')} ;
    ${vocabularyFilters.foaf('name')} "John Doe" ;
    ${vocabularyFilters.foaf('email')} <mailto:john@example.org> ;
    ${vocabularyFilters.foaf('knows')} ex:jane ;
    ${vocabularyFilters.foaf('homepage')} <https://johndoe.example.org> .

# SKOS concept hierarchy
ex:SoftwareDevelopment rdf:type ${vocabularyFilters.skos('Concept')} ;
    ${vocabularyFilters.skos('prefLabel')} "Software Development"@en ;
    ${vocabularyFilters.skos('broader')} ex:Technology ;
    ${vocabularyFilters.skos('narrower')} ex:WebDevelopment , ex:MobileDevelopment .

ex:Technology rdf:type ${vocabularyFilters.skos('Concept')} ;
    ${vocabularyFilters.skos('prefLabel')} "Technology"@en ;
    ${vocabularyFilters.skos('hasTopConcept')} ex:SoftwareDevelopment .
`;

    console.log('Complete Vocabulary Document:');
    console.log(vocabularyDocument);
    
    // Validate the generated Turtle syntax
    try {
      const store = new Store();
      await new Promise((resolve, reject) => {
        this.parser.parse(vocabularyDocument, (error, quad, prefixes) => {
          if (error) {
            reject(error);
          } else if (quad) {
            store.addQuad(quad);
          } else {
            resolve({ store, prefixes, quadCount: store.size });
          }
        });
      });
      
      console.log(`✅ Vocabulary document parsed successfully with ${store.size} triples`);
    } catch (error) {
      throw new Error(`Vocabulary document validation failed: ${error.message}`);
    }
    
    return { vocabularyDocument };
  }

  async testCrossVocabularyAlignment() {
    // Test alignment between different vocabularies
    const alignments = {
      // Schema.org to FOAF mappings
      schemaPerson: vocabularyFilters.schemaOrg('Person'),
      foafPerson: vocabularyFilters.foaf('Person'),
      
      // Schema.org to Dublin Core mappings
      schemaName: vocabularyFilters.schemaOrg(null, 'name'),
      dcTitle: vocabularyFilters.dublinCore('title'),
      
      // FOAF to Dublin Core mappings
      foafName: vocabularyFilters.foaf('name'),
      dcCreator: vocabularyFilters.dublinCore('creator')
    };
    
    console.log('Cross-vocabulary alignments:', alignments);
    
    // Create alignment statements
    const alignmentStatements = `
# Schema.org Person aligns with FOAF Person
${alignments.schemaPerson} owl:equivalentClass ${alignments.foafPerson} .

# Schema.org name can be used for Dublin Core title in some contexts
${alignments.schemaName} rdfs:subPropertyOf ${alignments.dcTitle} .

# FOAF name can be used for Dublin Core creator
${alignments.foafName} rdfs:subPropertyOf ${alignments.dcCreator} .
`;
    
    console.log('Alignment statements:', alignmentStatements);
    
    return { alignments, alignmentStatements };
  }

  async runAllTests() {
    console.log('🚀 Starting Vocabulary Mapping Test Suite');
    console.log('===========================================');

    await this.runTest('Schema.org Mappings', () => this.testSchemaOrgMappings());
    await this.runTest('Dublin Core Mappings', () => this.testDublinCoreMappings());
    await this.runTest('FOAF Mappings', () => this.testFoafMappings());
    await this.runTest('SKOS Mappings', () => this.testSkosMappings());
    await this.runTest('Vocabulary Generation', () => this.testVocabularyGeneration());
    await this.runTest('Namespace Validation', () => this.testNamespaceValidation());
    await this.runTest('Complete Vocabulary Integration', () => this.testCompleteVocabularyIntegration());
    await this.runTest('Cross-Vocabulary Alignment', () => this.testCrossVocabularyAlignment());

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
  const testSuite = new VocabularyMappingTestSuite();
  testSuite.runAllTests().then(summary => {
    console.log('\n🏁 Vocabulary Mapping Tests Complete');
    process.exit(summary.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export default VocabularyMappingTestSuite;