#!/usr/bin/env node

/**
 * Debug SPARQL execution to see what's happening
 */

import { RealSparqlCliAdapter } from '../src/kgen/cli/real-sparql-adapter.js';

async function debugSparql() {
  console.log('=== SPARQL Debug Test ===');
  
  const adapter = new RealSparqlCliAdapter({
    enableVerbose: true,
    maxResults: 5
  });
  
  await adapter.initialize();
  await adapter.loadGraph('tests/test-data.ttl');
  
  console.log(`Store size: ${adapter.getStoreSize()}`);
  
  // Show first few quads in store
  const allQuads = adapter.getAllQuads();
  console.log(`First 3 quads in store:`);
  for (let i = 0; i < Math.min(3, allQuads.length); i++) {
    const quad = allQuads[i];
    console.log(`  ${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`);
  }
  
  console.log('\n=== Testing SELECT * ===');
  const result1 = await adapter.executeQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 3');
  console.log('Result:', JSON.stringify(result1, null, 2));
  
  console.log('\n=== Testing basic SELECT ===');
  const result2 = await adapter.executeQuery('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 3');
  console.log('Result:', JSON.stringify(result2, null, 2));
  
  console.log('\n=== Testing ASK ===');
  const result3 = await adapter.executeQuery('ASK { ?s ?p ?o }');
  console.log('Result:', JSON.stringify(result3, null, 2));
}

debugSparql().catch(console.error);