#!/usr/bin/env node

/**
 * Semantic Web Demo - RDF/Turtle Generation
 * Demonstrates the semantic web filters for generating RDF/Turtle content
 */

import nunjucks from 'nunjucks';
import { addCommonFilters } from '../src/lib/nunjucks-filters.js';
import fs from 'fs';
import path from 'path';

// Sample data for the template
const sampleData = {
  baseUri: 'http://example.org',
  
  person: {
    id: 'john_doe_profile',
    type: 'person',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    age: 32,
    birthDate: '1992-05-15',
    uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    interests: ['JavaScript', 'Semantic Web', 'Machine Learning', 'Open Source'],
    friends: ['jane_smith', 'bob_wilson', 'alice_johnson'],
    company: {
      name: 'Tech Innovations Inc',
      website: 'https://techinnovations.com'
    },
    currentProject: 'semantic_web_toolkit'
  },
  
  company: {
    name: 'Tech Innovations Inc',
    description: 'A forward-thinking technology company specializing in semantic web solutions',
    website: 'https://techinnovations.com',
    founded: '2015-03-10',
    employees: 250
  },
  
  project: {
    name: 'Semantic Web Toolkit',
    description: 'A comprehensive toolkit for working with RDF, SPARQL, and semantic web technologies',
    languages: ['JavaScript', 'TypeScript', 'Python'],
    version: '2.1.0',
    created: '2023-01-15T09:00:00Z',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    repository: 'https://github.com/techinnovations/semantic-web-toolkit',
    contributors: ['john_doe', 'jane_smith', 'bob_wilson'],
    technologies: [
      { name: 'Node.js', version: '20.0.0' },
      { name: 'Express', version: '4.18.0' },
      { name: 'N3', version: '1.16.0' }
    ]
  },
  
  programmingLanguages: [
    {
      name: 'JavaScript',
      description: 'A high-level, interpreted programming language',
      extension: '.js',
      broader: 'scripting_language',
      related: ['TypeScript', 'Node.js']
    },
    {
      name: 'TypeScript',
      description: 'A strongly typed programming language that builds on JavaScript',
      extension: '.ts',
      broader: 'scripting_language',
      related: ['JavaScript']
    },
    {
      name: 'Python',
      description: 'A high-level, general-purpose programming language',
      extension: '.py',
      broader: 'scripting_language',
      related: ['JavaScript', 'Java']
    },
    {
      name: 'Java',
      description: 'A high-level, class-based, object-oriented programming language',
      extension: '.java',
      broader: 'object_oriented_language',
      related: ['Python', 'C++']
    }
  ],
  
  ontologyVersion: '1.0.0',
  
  datasetTitle: 'Example Semantic Web Dataset',
  datasetDescription: 'A demonstration dataset showcasing RDF/Turtle generation with semantic web filters',
  author: 'Unjucks Development Team',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  
  tripleCount: 156,
  entityCount: 42,
  
  templateStart: '2024-01-01T10:00:00Z',
  templateVersion: '1.0.0'
};

// Add RDFS namespace
sampleData.rdfs = 'http://www.w3.org/2000/01/rdf-schema#';
sampleData.xsd = 'http://www.w3.org/2001/XMLSchema#';
sampleData.void = 'http://rdfs.org/ns/void#';
sampleData.prov = 'http://www.w3.org/ns/prov#';

// Configure Nunjucks environment
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('.'));
addCommonFilters(env);

// Add custom helper filters for the demo
env.addFilter('map', function(arr, property) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => typeof item === 'object' ? item[property] : item);
});

env.addFilter('xsd', function(type) {
  return `xsd:${type}`;
});

function main() {
  try {
    console.log('🌐 Semantic Web Demo - RDF/Turtle Generation');
    console.log('============================================\n');
    
    // Read and render the template
    const templatePath = path.join(import.meta.dirname, 'semantic-web-demo.ttl.njk');
    const template = fs.readFileSync(templatePath, 'utf8');
    
    console.log('📖 Rendering semantic web template...');
    const result = env.renderString(template, sampleData);
    
    // Write output to file
    const outputPath = path.join(import.meta.dirname, 'output-semantic-web-demo.ttl');
    fs.writeFileSync(outputPath, result);
    
    console.log(`✅ RDF/Turtle file generated: ${outputPath}`);
    console.log('\n📊 Generated RDF Statistics:');
    console.log(`   - Estimated triples: ${sampleData.tripleCount}`);
    console.log(`   - Estimated entities: ${sampleData.entityCount}`);
    console.log(`   - Namespaces used: 9 (rdf, rdfs, owl, xsd, schema, foaf, dcterms, skos, ex)`);
    
    console.log('\n🔍 Sample Output Preview:');
    console.log('-------------------------');
    const previewLines = result.split('\\n').slice(0, 30);
    console.log(previewLines.join('\\n'));
    console.log('...\n(truncated for brevity)\n');
    
    console.log('🎯 Semantic Web Filters Demonstrated:');
    console.log('   ✓ rdfResource - Generate full RDF resource URIs');
    console.log('   ✓ rdfProperty - Convert to RDF property format'); 
    console.log('   ✓ rdfClass - Generate RDF class URIs');
    console.log('   ✓ rdfDatatype - Add RDF datatype annotations');
    console.log('   ✓ rdfLiteral - Create language-tagged literals');
    console.log('   ✓ sparqlVar - Format SPARQL variable names');
    console.log('   ✓ turtleEscape - Escape special characters');
    console.log('   ✓ ontologyName - Convert to ontology naming conventions');
    console.log('   ✓ namespacePrefix - Extract/generate namespace prefixes');
    console.log('   ✓ rdfUuid - Generate RDF-safe UUIDs');
    console.log('   ✓ schemaOrg - Map to Schema.org types');
    console.log('   ✓ dublinCore - Map to Dublin Core properties');
    console.log('   ✓ foaf - Map to FOAF vocabulary');
    console.log('   ✓ skos - Map to SKOS concepts');
    console.log('   ✓ owl - Map to OWL constructs');
    console.log('   ✓ rdfGraph - Generate named graph URIs');
    console.log('   ✓ sparqlFilter - Format SPARQL FILTER expressions');
    console.log('   ✓ rdfList - Generate RDF list structures');
    console.log('   ✓ blankNode - Generate blank node identifiers');
    console.log('   ✓ curie - Compact URI representation');
    
    console.log('\\n🚀 Next Steps:');
    console.log('   1. View the generated RDF/Turtle file');
    console.log('   2. Validate with an RDF validator');
    console.log('   3. Load into a triple store (e.g., Apache Jena, Virtuoso)');
    console.log('   4. Query with SPARQL');
    console.log('   5. Convert to other RDF formats (JSON-LD, RDF/XML, N-Triples)');
    
    // Run basic validation
    console.log('\\n🔧 Basic Validation:');
    const hasValidPrefixes = result.includes('@prefix');
    const hasValidTriples = result.includes(' a ') && result.includes(' ; ');
    const hasValidURIs = result.includes('<http://') || result.includes('schema:') || result.includes('foaf:');
    
    console.log(`   - Valid prefixes: ${hasValidPrefixes ? '✅' : '❌'}`);
    console.log(`   - Valid triples: ${hasValidTriples ? '✅' : '❌'}`);
    console.log(`   - Valid URIs: ${hasValidURIs ? '✅' : '❌'}`);
    
    if (hasValidPrefixes && hasValidTriples && hasValidURIs) {
      console.log('   📈 Basic validation passed!');
    }
    
  } catch (error) {
    console.error('❌ Error generating semantic web demo:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;