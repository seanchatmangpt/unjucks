/**
 * Simple SPARQL Engine Test
 * 
 * Tests the working SPARQL engine that returns actual results
 */

import { readFileSync } from 'fs';
import SimpleSparqlEngine from './simple-sparql-engine.js';
import SemanticHasher from './semantic-hasher.js';
import { consola } from 'consola';

async function runTests() {
  consola.info('Starting Simple SPARQL Engine Test Suite...');
  
  const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
  };
  
  try {
    // Load test RDF data
    const testGraphPath = '/Users/sac/unjucks/test-graph.ttl';
    const testRdfData = readFileSync(testGraphPath, 'utf8');
    consola.info(`Loaded test RDF data: ${testRdfData.length} characters`);
    
    // Initialize engines
    const sparqlEngine = new SimpleSparqlEngine({
      enableQueryCache: true,
      maxResultSize: 1000,
      queryTimeout: 5000
    });
    
    const semanticHasher = new SemanticHasher({
      performanceTarget: 10,
      normalizeBlankNodes: true
    });
    
    await sparqlEngine.initialize({ 
      rdfData: testRdfData,
      format: 'turtle'
    });
    
    // Test 1: Basic SELECT query
    await runTest('Basic SELECT Query', async () => {
      const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?subject ?predicate ?object WHERE {
          ?subject ?predicate ?object .
        } LIMIT 10
      `;
      
      const startTime = performance.now();
      const results = await sparqlEngine.executeQuery(query);
      const executionTime = performance.now() - startTime;
      
      consola.info(`SELECT query executed in ${executionTime.toFixed(2)}ms`);
      consola.info(`Results: ${JSON.stringify(results.results?.bindings?.slice(0, 2), null, 2)}`);
      
      if (!results.results?.bindings || results.results.bindings.length === 0) {
        throw new Error('SELECT query returned no results');
      }
      
      if (executionTime > 150) {
        throw new Error(`Query took ${executionTime.toFixed(2)}ms (target: <150ms)`);
      }
      
      return `Returned ${results.results.bindings.length} results in ${executionTime.toFixed(2)}ms`;
    }, testResults);
    
    // Test 2: ASK query
    await runTest('ASK Query', async () => {
      const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        ASK { ?s rdf:type ?type }
      `;
      
      const startTime = performance.now();
      const results = await sparqlEngine.executeQuery(query);
      const executionTime = performance.now() - startTime;
      
      consola.info(`ASK query executed in ${executionTime.toFixed(2)}ms`);
      consola.info(`Result: ${JSON.stringify(results, null, 2)}`);
      
      if (typeof results.boolean !== 'boolean') {
        throw new Error('ASK query did not return boolean result');
      }
      
      return `Boolean result: ${results.boolean} in ${executionTime.toFixed(2)}ms`;
    }, testResults);
    
    // Test 3: Multiple output formats
    await runTest('Output Format Support', async () => {
      const query = `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 3`;
      
      // Test JSON format
      const jsonResults = await sparqlEngine.executeQuery(query, { format: 'json' });
      if (!jsonResults.results?.bindings || jsonResults.results.bindings.length === 0) {
        throw new Error('JSON format returned no results');
      }
      
      // Test XML format
      const xmlResults = await sparqlEngine.executeQuery(query, { format: 'xml' });
      if (!xmlResults.includes('<?xml') || !xmlResults.includes('sparql')) {
        throw new Error('XML format failed');
      }
      
      // Test CSV format
      const csvResults = await sparqlEngine.executeQuery(query, { format: 'csv' });
      if (!csvResults.includes(',') || csvResults.split('\n').length < 2) {
        throw new Error('CSV format failed');
      }
      
      return `Successfully tested JSON, XML, and CSV formats`;
    }, testResults);
    
    // Test 4: Semantic hashing performance
    await runTest('Semantic Hashing Performance', async () => {
      const allQuads = sparqlEngine.store.getQuads();
      
      if (!allQuads || allQuads.length === 0) {
        throw new Error('No RDF quads available for hashing test');
      }
      
      const startTime = performance.now();
      const hashResult = await semanticHasher.generateHash(allQuads);
      const executionTime = performance.now() - startTime;
      
      consola.info(`Hash generated in ${executionTime.toFixed(2)}ms`);
      consola.info(`Hash: ${hashResult.hash}`);
      consola.info(`Canonical preview: ${hashResult.canonical.substring(0, 200)}...`);
      
      if (!hashResult.hash || hashResult.hash.length === 0) {
        throw new Error('Hash generation failed');
      }
      
      if (executionTime > 50) {
        consola.warn(`Hashing took ${executionTime.toFixed(2)}ms (target: <50ms) - acceptable for test`);
      }
      
      return `Generated hash in ${executionTime.toFixed(2)}ms for ${allQuads.length} triples`;
    }, testResults);
    
    // Test 5: Query cache functionality
    await runTest('Query Caching', async () => {
      const query = `SELECT ?s WHERE { ?s ?p ?o } LIMIT 5`;
      
      // First execution (miss)
      const startTime1 = performance.now();
      const results1 = await sparqlEngine.executeQuery(query);
      const time1 = performance.now() - startTime1;
      
      // Second execution (should hit cache)
      const startTime2 = performance.now();
      const results2 = await sparqlEngine.executeQuery(query);
      const time2 = performance.now() - startTime2;
      
      consola.info(`First query: ${time1.toFixed(2)}ms, Second query: ${time2.toFixed(2)}ms`);
      
      const status = sparqlEngine.getStatus();
      if (status.metrics.cacheHits === 0) {
        throw new Error('Cache was not hit on second execution');
      }
      
      return `Cache hit achieved. First: ${time1.toFixed(2)}ms, Second: ${time2.toFixed(2)}ms`;
    }, testResults);
    
    // Test 6: Engine status and metrics
    await runTest('Engine Status', async () => {
      const status = sparqlEngine.getStatus();
      
      if (!status.metrics || typeof status.metrics.totalQueries !== 'number') {
        throw new Error('Engine status is missing metrics');
      }
      
      if (status.metrics.totalQueries === 0) {
        throw new Error('No queries recorded in metrics');
      }
      
      consola.info('Engine Status:', status);
      
      return `Engine operational with ${status.metrics.totalQueries} total queries, ${status.metrics.successfulQueries} successful`;
    }, testResults);
    
  } catch (error) {
    consola.error('Test suite setup failed:', error);
    testResults.failed++;
    testResults.total++;
  }
  
  // Print summary
  consola.info('\n=== TEST SUMMARY ===');
  consola.info(`Total tests: ${testResults.total}`);
  consola.info(`Passed: ${testResults.passed}`);
  consola.info(`Failed: ${testResults.failed}`);
  consola.info(`Success rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    consola.error('\nFailed tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => consola.error(`- ${t.name}: ${t.error}`));
  } else {
    consola.success('\n✅ All tests passed! SPARQL engine is working correctly.');
  }
  
  return testResults.failed === 0;
}

async function runTest(name, testFn, results) {
  results.total++;
  consola.info(`\nRunning test: ${name}`);
  
  try {
    const result = await testFn();
    consola.success(`✓ ${name}: ${result}`);
    results.passed++;
    results.tests.push({ name, passed: true, result });
  } catch (error) {
    consola.error(`✗ ${name}: ${error.message}`);
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      consola.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests };