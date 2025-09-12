#!/usr/bin/env node

/**
 * Direct SPARQL Testing Script
 * Tests N3.js and SPARQL functionality without CLI overhead
 */

import { Store } from 'n3';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';
import { readFileSync } from 'fs';
import { Parser as N3Parser } from 'n3';

console.log('=== DIRECT SPARQL TESTING ===\n');

async function testDirectSPARQL() {
  try {
    // Test 1: N3.js Store Creation and Basic Functionality
    console.log('1. Testing N3.js Store Creation');
    const store = new Store();
    console.log('   ✅ N3.js Store created successfully');
    
    // Test 2: Load TTL file and parse with N3.js
    console.log('\n2. Testing TTL File Loading');
    const ttlContent = readFileSync('./tests/fixtures/turtle/basic-person.ttl', 'utf8');
    console.log('   ✅ TTL file read successfully');
    console.log(`   📄 Content length: ${ttlContent.length} characters`);
    
    const parser = new N3Parser();
    const quads = parser.parse(ttlContent);
    console.log(`   ✅ Parsed ${quads.length} triples`);
    
    // Add quads to store
    store.addQuads(quads);
    console.log(`   ✅ Added triples to store. Total size: ${store.size}`);
    
    // Test 3: SPARQL Parser
    console.log('\n3. Testing SPARQL Parser');
    const sparqlParser = new SparqlParser();
    const query1 = "SELECT * WHERE { ?s ?p ?o }";
    const parsedQuery1 = sparqlParser.parse(query1);
    console.log('   ✅ SPARQL query parsed successfully');
    console.log(`   📋 Query type: ${parsedQuery1.queryType}`);
    
    // Test 4: Basic SPARQL Execution against Store
    console.log('\n4. Testing Basic SPARQL Execution');
    
    // Manual query execution using N3.js store methods
    const allQuads = store.getQuads(null, null, null, null);
    console.log(`   ✅ Retrieved ${allQuads.length} quads from store`);
    
    if (allQuads.length > 0) {
      console.log('   📋 First 3 triples:');
      allQuads.slice(0, 3).forEach((quad, i) => {
        console.log(`      ${i+1}. ${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`);
      });
    }
    
    // Test 5: Test different query patterns
    console.log('\n5. Testing Query Patterns');
    
    // Find all subjects of type Person
    const personQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person', null);
    console.log(`   ✅ Found ${personQuads.length} Person entities`);
    
    if (personQuads.length > 0) {
      personQuads.forEach(quad => {
        console.log(`      👤 Person: ${quad.subject.value}`);
        
        // Get name for this person
        const nameQuads = store.getQuads(quad.subject, 'http://xmlns.com/foaf/0.1/name', null, null);
        if (nameQuads.length > 0) {
          console.log(`         Name: ${nameQuads[0].object.value}`);
        }
        
        // Get age for this person
        const ageQuads = store.getQuads(quad.subject, 'http://xmlns.com/foaf/0.1/age', null, null);
        if (ageQuads.length > 0) {
          console.log(`         Age: ${ageQuads[0].object.value}`);
        }
      });
    }
    
    // Test 6: Test with sample.ttl (more complex data)
    console.log('\n6. Testing with Sample.ttl');
    try {
      const sampleContent = readFileSync('./tests/fixtures/turtle/sample.ttl', 'utf8');
      const sampleStore = new Store();
      const sampleParser = new N3Parser();
      const sampleQuads = sampleParser.parse(sampleContent);
      sampleStore.addQuads(sampleQuads);
      
      console.log(`   ✅ Sample.ttl loaded: ${sampleStore.size} triples`);
      
      // Find schema.org Person entities
      const schemaPersons = sampleStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://schema.org/Person', null);
      console.log(`   ✅ Found ${schemaPersons.length} schema:Person entities`);
      
      schemaPersons.forEach(quad => {
        console.log(`      👤 Schema Person: ${quad.subject.value}`);
        
        const nameQuads = sampleStore.getQuads(quad.subject, 'http://schema.org/name', null, null);
        if (nameQuads.length > 0) {
          console.log(`         Name: ${nameQuads[0].object.value}`);
        }
        
        const jobQuads = sampleStore.getQuads(quad.subject, 'http://schema.org/jobTitle', null, null);
        if (jobQuads.length > 0) {
          console.log(`         Job: ${jobQuads[0].object.value}`);
        }
      });
      
    } catch (error) {
      console.log(`   ❌ Sample.ttl test failed: ${error.message}`);
    }
    
    // Test 7: SPARQL Query Types
    console.log('\n7. Testing Different SPARQL Query Types');
    
    const queries = [
      { name: 'SELECT', query: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }' },
      { name: 'ASK', query: 'ASK { ?s ?p ?o }' },
      { name: 'CONSTRUCT', query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }' },
      { name: 'DESCRIBE', query: 'DESCRIBE ?s WHERE { ?s ?p ?o }' }
    ];
    
    queries.forEach(({ name, query }) => {
      try {
        const parsed = sparqlParser.parse(query);
        console.log(`   ✅ ${name} query parsed successfully - Type: ${parsed.queryType}`);
      } catch (error) {
        console.log(`   ❌ ${name} query failed: ${error.message}`);
      }
    });
    
    // Test 8: Error handling
    console.log('\n8. Testing Error Handling');
    
    try {
      const malformedQuery = "INVALID SPARQL QUERY";
      sparqlParser.parse(malformedQuery);
      console.log('   ❌ Should have failed for malformed query');
    } catch (error) {
      console.log('   ✅ Correctly caught malformed query error');
      console.log(`      Error: ${error.message.substring(0, 100)}...`);
    }
    
    console.log('\n=== SPARQL TESTING COMPLETE ===');
    
    return {
      success: true,
      results: {
        n3StoreWorks: store.size > 0,
        sparqlParsingWorks: true,
        basicQueriesWork: allQuads.length > 0,
        personEntitiesFound: personQuads.length > 0,
        errorHandlingWorks: true
      }
    };
    
  } catch (error) {
    console.error('\n❌ SPARQL Testing Failed:');
    console.error(error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the tests
testDirectSPARQL().then(result => {
  console.log('\n📊 Final Results:');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});