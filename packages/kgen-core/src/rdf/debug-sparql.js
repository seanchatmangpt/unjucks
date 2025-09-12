/**
 * Debug SPARQL execution to understand why queries return no results
 */

import { readFileSync } from 'fs';
import KgenSparqlEngine from './sparql-engine.js';
import { consola } from 'consola';

async function debugSparql() {
  try {
    // Load test data
    const testRdfData = readFileSync('/Users/sac/unjucks/test-graph.ttl', 'utf8');
    consola.info(`RDF Data Preview:\n${testRdfData.substring(0, 500)}...`);
    
    // Initialize engine
    const sparqlEngine = new KgenSparqlEngine();
    await sparqlEngine.initialize({ rdfData: testRdfData, format: 'turtle' });
    
    consola.info(`Store size: ${sparqlEngine.store.size} triples`);
    
    // Check what's actually in the store
    const allQuads = sparqlEngine.store.getQuads();
    consola.info('\nFirst 10 triples in store:');
    for (let i = 0; i < Math.min(10, allQuads.length); i++) {
      const q = allQuads[i];
      consola.info(`${i+1}. ${q.subject.value} ${q.predicate.value} ${q.object.value}`);
    }
    
    // Try direct store query
    consola.info('\nTesting direct store queries:');
    const directResults = sparqlEngine.store.getQuads(null, null, null);
    consola.info(`Direct query returned ${directResults.length} quads`);
    
    // Test simple SPARQL query manually
    consola.info('\nTesting manual SPARQL execution:');
    const simpleQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 3';
    
    try {
      const results = await sparqlEngine.executeQuery(simpleQuery);
      consola.info('Query results:', JSON.stringify(results, null, 2));
    } catch (error) {
      consola.error('Query execution failed:', error);
    }
    
    // Test specific patterns
    consola.info('\nTesting specific patterns:');
    const exampleQuads = sparqlEngine.store.getQuads(null, null, null, null);
    if (exampleQuads.length > 0) {
      const firstQuad = exampleQuads[0];
      consola.info(`Testing pattern: ${firstQuad.subject.value} ?p ?o`);
      
      const patternResults = sparqlEngine.store.getQuads(firstQuad.subject, null, null);
      consola.info(`Pattern matched ${patternResults.length} triples`);
    }
    
  } catch (error) {
    consola.error('Debug failed:', error);
  }
}

debugSparql();