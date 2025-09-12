#!/usr/bin/env node

/**
 * Test the fixed SPARQL adapter directly
 */

import { FixedSparqlCliAdapter } from '../src/kgen/cli/fixed-sparql-adapter.js';

async function testFixedSparql() {
  console.log('=== Testing Fixed SPARQL Adapter ===');
  
  const adapter = new FixedSparqlCliAdapter({
    enableVerbose: true,
    maxResults: 5
  });
  
  await adapter.initialize();
  await adapter.loadGraph('tests/test-data.ttl');
  
  console.log(`Store size: ${adapter.getStoreSize()}`);
  
  console.log('\n=== Test 1: SELECT * ===');
  const result1 = await adapter.executeQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 3');
  console.log('Result:', JSON.stringify(result1.results, null, 2));
  
  console.log('\n=== Test 2: SELECT ?s ?p ?o ===');
  const result2 = await adapter.executeQuery('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 3');
  console.log('Result:', JSON.stringify(result2.results, null, 2));
  
  console.log('\n=== Test 3: SELECT specific pattern ===');
  const result3 = await adapter.executeQuery('SELECT ?person ?name WHERE { ?person <http://xmlns.com/foaf/0.1/name> ?name } LIMIT 3');
  console.log('Result:', JSON.stringify(result3.results, null, 2));
  
  console.log('\n=== Test 4: ASK query ===');
  const result4 = await adapter.executeQuery('ASK { ?s a <http://xmlns.com/foaf/0.1/Person> }');
  console.log('Result:', JSON.stringify(result4.results, null, 2));
}

testFixedSparql().catch(console.error);