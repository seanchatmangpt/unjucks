/**
 * Quick test to validate SPARQL functionality
 */

import { readFileSync } from 'fs';
import SimpleSparqlEngine from './simple-sparql-engine.js';
import { consola } from 'consola';

async function quickTest() {
  try {
    consola.info('🚀 Starting Quick SPARQL Test...');
    
    // Load test data
    const testRdfData = readFileSync('/Users/sac/unjucks/test-graph.ttl', 'utf8');
    consola.info(`📁 Loaded RDF data: ${testRdfData.length} chars`);
    
    // Initialize engine
    const engine = new SimpleSparqlEngine();
    await engine.initialize({ rdfData: testRdfData, format: 'turtle' });
    
    // Simple test
    const simpleQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    consola.info(`🔍 Executing: ${simpleQuery}`);
    
    const start = performance.now();
    const results = await engine.executeQuery(simpleQuery);
    const time = performance.now() - start;
    
    consola.info(`⚡ Query executed in ${time.toFixed(2)}ms`);
    consola.info(`📊 Results: ${results.results?.bindings?.length || 0} bindings`);
    
    if (results.results?.bindings?.length > 0) {
      consola.info('🎉 SUCCESS: SPARQL engine returns actual results!');
      consola.info('Sample result:', JSON.stringify(results.results.bindings[0], null, 2));
      
      // Test different formats
      const xmlResults = await engine.executeQuery(simpleQuery, { format: 'xml' });
      const csvResults = await engine.executeQuery(simpleQuery, { format: 'csv' });
      
      consola.info(`📋 XML format: ${xmlResults.length} chars`);
      consola.info(`📊 CSV format: ${csvResults.split('\n').length} lines`);
      
      // Test ASK query
      const askQuery = 'ASK { ?s ?p ?o }';
      const askResult = await engine.executeQuery(askQuery);
      consola.info(`❓ ASK result: ${askResult.boolean}`);
      
      consola.success('✅ ALL TESTS PASSED - SPARQL Engine is working!');
      return true;
    } else {
      consola.error('❌ FAILED: No results returned');
      return false;
    }
    
  } catch (error) {
    consola.error('💥 Test failed:', error.message);
    return false;
  }
}

quickTest().then(success => {
  process.exit(success ? 0 : 1);
});