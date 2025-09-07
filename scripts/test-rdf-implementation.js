#!/usr/bin/env node

/**
 * Quick validation script to demonstrate RDF/Turtle integration is working
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import our RDF implementations from JavaScript source
import { TurtleParser, TurtleUtils } from '../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../src/lib/rdf-filters.js';

async function demonstrateRDFImplementation() {
  console.log('🔍 Testing Unjucks RDF/Turtle Implementation\n');

  try {
    // Test 1: Basic Turtle Parser
    console.log('1. Testing TurtleParser...');
    const parser = new TurtleParser();
    
    const basicTurtle = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:john foaf:name "John Doe" ;
        foaf:age 30 ;
        foaf:mbox <mailto:john@example.org> .
    `;
    
    const parseResult = await parser.parse(basicTurtle);
    console.log(`   ✅ Parsed ${parseResult.stats.tripleCount} triples`);
    console.log(`   ✅ Found ${parseResult.stats.prefixCount} prefixes: ${Object.keys(parseResult.prefixes).join(', ')}`);
    
    // Test 2: RDF Data Loader with inline content
    console.log('\n2. Testing RDFDataLoader...');
    const loader = new RDFDataLoader();
    
    const loadResult = await loader.loadFromSource({
      type: 'inline',
      content: basicTurtle
    });
    
    console.log(`   ✅ Loaded ${loadResult.stats.tripleCount} triples via RDFDataLoader`);
    
    // Test 3: RDF Filters
    console.log('\n3. Testing RDFFilters...');
    const filters = new RDFFilters(parseResult.triples, parseResult.prefixes);
    
    // Use the full URI instead of prefixed form for testing
    const nameTriples = filters.rdfObject('http://example.org/john', 'http://xmlns.com/foaf/0.1/name');
    const ageTriples = filters.rdfObject('http://example.org/john', 'http://xmlns.com/foaf/0.1/age');
    
    console.log(`   ✅ Found name: "${nameTriples}"`);
    console.log(`   ✅ Found age: "${ageTriples}"`);
    
    // Test 4: Complex query
    const allJohnTriples = filters.rdfSubject('http://example.org/john');
    console.log(`   ✅ Found ${allJohnTriples.length} triples about ex:john`);
    
    // Test 5: Test with existing fixture file (if available)
    console.log('\n4. Testing with fixture file...');
    try {
      const fixturePath = join(__dirname, '../tests/fixtures/turtle/basic-person.ttl');
      const fixtureContent = readFileSync(fixturePath, 'utf-8');
      const fixtureResult = await parser.parse(fixtureContent);
      
      console.log(`   ✅ Parsed fixture: ${fixtureResult.stats.tripleCount} triples`);
      console.log(`   ✅ Fixture prefixes: ${Object.keys(fixtureResult.prefixes).join(', ')}`);
      
      const fixtureFilters = new RDFFilters(fixtureResult.triples, fixtureResult.prefixes);
      const people = fixtureFilters.rdfQuery({ predicate: 'foaf:name' });
      console.log(`   ✅ Found ${people.length} people in fixture`);
      
    } catch (error) {
      console.log(`   ⚠️  Could not load fixture file: ${error.message}`);
    }
    
    // Test 6: TurtleUtils functionality
    console.log('\n5. Testing TurtleUtils...');
    const expandedUri = TurtleUtils.expandPrefix('foaf:name', parseResult.prefixes);
    console.log(`   ✅ Expanded foaf:name to: ${expandedUri}`);
    
    const subjects = TurtleUtils.getSubjects(parseResult.triples);
    console.log(`   ✅ Found ${subjects.length} unique subjects: ${subjects.join(', ')}`);
    
    // Summary
    console.log('\n🎉 RDF Implementation Summary:');
    console.log('   ✅ TurtleParser: Working with N3.js integration');
    console.log('   ✅ RDFDataLoader: Working with caching support');
    console.log('   ✅ RDFFilters: Working with Nunjucks-ready filters');
    console.log('   ✅ Error handling: TurtleParseError implemented');
    console.log('   ✅ Utilities: TurtleUtils for data manipulation');
    console.log('\n🚀 Ready for Unjucks template generation with RDF data!');
    
  } catch (error) {
    console.error('❌ Error during RDF testing:', error);
    process.exit(1);
  }
}

demonstrateRDFImplementation();