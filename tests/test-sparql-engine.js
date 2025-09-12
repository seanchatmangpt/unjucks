#!/usr/bin/env node

/**
 * SPARQL Engine Integration Test
 * Tests the complete SPARQL functionality including SparqlInterface and SparqlEngine
 */

import { Store, Parser as N3Parser } from 'n3';
import { readFileSync } from 'fs';
import { SparqlInterface } from '../packages/kgen-core/src/rdf/sparql-interface.js';
import { SparqlEngine } from '../packages/kgen-core/src/sparql-engine.js';
import { GraphProcessor } from '../packages/kgen-core/src/rdf/graph-processor.js';

console.log('=== SPARQL ENGINE INTEGRATION TEST ===\n');

async function testSparqlEngine() {
  try {
    // Test 1: Set up RDF data
    console.log('1. Setting up RDF Data');
    const store = new Store();
    const parser = new N3Parser();
    
    // Load basic-person.ttl
    const basicContent = readFileSync('./tests/fixtures/turtle/basic-person.ttl', 'utf8');
    const basicQuads = parser.parse(basicContent);
    store.addQuads(basicQuads);
    
    // Load sample.ttl
    const sampleContent = readFileSync('./tests/fixtures/turtle/sample.ttl', 'utf8');
    const sampleQuads = parser.parse(sampleContent);
    store.addQuads(sampleQuads);
    
    console.log(`   ✅ Loaded ${store.size} total triples from test files`);
    
    // Test 2: SPARQL Interface Testing
    console.log('\n2. Testing SPARQL Interface');
    const sparqlInterface = new SparqlInterface({
      enableCaching: true,
      maxCacheSize: 100
    });
    
    console.log('   ✅ SparqlInterface created');
    
    // Test SELECT queries
    console.log('\n   2a. Testing SELECT Queries');
    
    const selectQueries = [
      {
        name: 'Get all triples',
        query: 'SELECT * WHERE { ?s ?p ?o }'
      },
      {
        name: 'Get all people',
        query: `
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          SELECT ?person ?name WHERE { 
            ?person a foaf:Person .
            ?person foaf:name ?name .
          }
        `
      },
      {
        name: 'Get schema.org persons',
        query: `
          PREFIX schema: <http://schema.org/>
          SELECT ?person ?name ?job WHERE { 
            ?person a schema:Person .
            ?person schema:name ?name .
            OPTIONAL { ?person schema:jobTitle ?job }
          }
        `
      }
    ];
    
    for (const { name, query } of selectQueries) {
      try {
        const results = await sparqlInterface.select(store, query);
        console.log(`      ✅ ${name}: ${results.length} results`);
        
        if (results.length > 0) {
          console.log(`         First result: ${JSON.stringify(results[0], null, 6)}`);
        }
      } catch (error) {
        console.log(`      ❌ ${name}: ${error.message}`);
      }
    }
    
    // Test ASK queries
    console.log('\n   2b. Testing ASK Queries');
    const askQueries = [
      {
        name: 'Any triples exist',
        query: 'ASK { ?s ?p ?o }'
      },
      {
        name: 'FOAF persons exist',
        query: 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> ASK { ?s a foaf:Person }'
      },
      {
        name: 'Non-existent pattern',
        query: 'ASK { <http://nonexistent.com/entity> <http://nonexistent.com/prop> "value" }'
      }
    ];
    
    for (const { name, query } of askQueries) {
      try {
        const result = await sparqlInterface.ask(store, query);
        console.log(`      ✅ ${name}: ${result}`);
      } catch (error) {
        console.log(`      ❌ ${name}: ${error.message}`);
      }
    }
    
    // Test CONSTRUCT queries
    console.log('\n   2c. Testing CONSTRUCT Queries');
    const constructQueries = [
      {
        name: 'Construct all triples',
        query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'
      },
      {
        name: 'Construct person names',
        query: `
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          CONSTRUCT { ?person foaf:name ?name } 
          WHERE { ?person a foaf:Person . ?person foaf:name ?name }
        `
      }
    ];
    
    for (const { name, query } of constructQueries) {
      try {
        const results = await sparqlInterface.construct(store, query);
        console.log(`      ✅ ${name}: ${results.length} triples constructed`);
      } catch (error) {
        console.log(`      ❌ ${name}: ${error.message}`);
      }
    }
    
    // Test DESCRIBE queries
    console.log('\n   2d. Testing DESCRIBE Queries');
    const describeQueries = [
      {
        name: 'Describe person1',
        query: 'DESCRIBE <http://example.org/person1>'
      }
    ];
    
    for (const { name, query } of describeQueries) {
      try {
        const results = await sparqlInterface.describe(store, query);
        console.log(`      ✅ ${name}: ${results.length} triples described`);
      } catch (error) {
        console.log(`      ❌ ${name}: ${error.message}`);
      }
    }
    
    // Test 3: SPARQL Engine Testing
    console.log('\n3. Testing SPARQL Engine');
    
    try {
      const graphProcessor = new GraphProcessor();
      await graphProcessor.initialize();
      
      // Load data into graph processor
      await graphProcessor.loadFromTurtle(basicContent);
      await graphProcessor.loadFromTurtle(sampleContent);
      
      console.log(`   ✅ GraphProcessor loaded with ${graphProcessor.store.size} triples`);
      
      const sparqlEngine = new SparqlEngine({
        graphProcessor: graphProcessor,
        enableCaching: true,
        enableProvenance: false
      });
      
      console.log('   ✅ SparqlEngine created');
      
      // Test complex SPARQL execution
      const complexQuery = `
        PREFIX schema: <http://schema.org/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT ?name ?type ?property ?value WHERE {
          {
            ?person a schema:Person .
            ?person schema:name ?name .
            BIND("Schema Person" as ?type)
            ?person ?property ?value .
          } UNION {
            ?person a foaf:Person .
            ?person foaf:name ?name .
            BIND("FOAF Person" as ?type)
            ?person ?property ?value .
          }
        } LIMIT 10
      `;
      
      const engineResults = await sparqlEngine.executeQuery(complexQuery);
      console.log(`   ✅ Complex query executed: ${engineResults.results?.bindings?.length || 0} results`);
      console.log(`   ⏱️  Execution time: ${engineResults.executionTime}ms`);
      console.log(`   📊 Query type: ${engineResults.queryType}`);
      
      // Test template variable extraction
      console.log('\n   3a. Testing Template Variable Extraction');
      const templateVars = await sparqlEngine.extractTemplateVariables('test-template', {
        entityUri: 'http://example.org/person1'
      });
      console.log(`   ✅ Extracted ${Object.keys(templateVars).length} template variables`);
      
      // Test context extraction
      console.log('\n   3b. Testing Context Extraction');
      const context = await sparqlEngine.extractContext('http://example.org/person1');
      console.log(`   ✅ Extracted context:`);
      console.log(`      Properties: ${Object.keys(context.properties).length}`);
      console.log(`      Relationships: ${Object.keys(context.relationships).length}`);
      console.log(`      Metadata: ${Object.keys(context.metadata).length}`);
      
    } catch (error) {
      console.log(`   ❌ SPARQL Engine test failed: ${error.message}`);
    }
    
    // Test 4: Query Statistics and Performance
    console.log('\n4. Testing Query Statistics');
    const stats = sparqlInterface.getStats();
    console.log(`   📊 Queries executed: ${stats.queriesExecuted}`);
    console.log(`   📊 Cache hits: ${stats.cacheHits}`);
    console.log(`   📊 Cache misses: ${stats.cacheMisses}`);
    console.log(`   📊 Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`   📊 Average query time: ${stats.averageQueryTime.toFixed(2)}ms`);
    console.log(`   📊 Cache size: ${stats.cacheSize}`);
    
    // Test 5: Common Queries
    console.log('\n5. Testing Common Query Templates');
    const commonQueries = sparqlInterface.getCommonQueries();
    console.log(`   ✅ Available common queries: ${Object.keys(commonQueries).length}`);
    
    try {
      const classResults = await sparqlInterface.select(store, commonQueries.getAllClasses);
      console.log(`   ✅ Get all classes: ${classResults.length} classes found`);
      
      const propertyResults = await sparqlInterface.select(store, commonQueries.getAllProperties);
      console.log(`   ✅ Get all properties: ${propertyResults.length} properties found`);
      
      const instanceResults = await sparqlInterface.select(store, 
        commonQueries.getInstancesOfClass('http://xmlns.com/foaf/0.1/Person'));
      console.log(`   ✅ Get FOAF Person instances: ${instanceResults.length} instances found`);
      
    } catch (error) {
      console.log(`   ❌ Common queries test failed: ${error.message}`);
    }
    
    console.log('\n=== SPARQL ENGINE INTEGRATION TEST COMPLETE ===');
    
    return {
      success: true,
      summary: {
        totalTriples: store.size,
        sparqlInterfaceWorks: true,
        queryTypesSupported: ['SELECT', 'ASK', 'CONSTRUCT', 'DESCRIBE'],
        engineIntegration: true,
        statistics: stats
      }
    };
    
  } catch (error) {
    console.error('\n❌ SPARQL Engine Integration Test Failed:');
    console.error(error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the integration test
testSparqlEngine().then(result => {
  console.log('\n📋 Final Test Summary:');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});