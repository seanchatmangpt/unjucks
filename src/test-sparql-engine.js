/**
 * Test SPARQL Engine Implementation
 * Quick test to verify the SPARQL engine functionality
 */

import { SparqlEngine } from '../packages/kgen-core/src/sparql-engine.js';
import { GraphProcessor } from '../packages/kgen-core/src/rdf/graph-processor.js';
import { consola } from 'consola';

async function testSparqlEngine() {
  const logger = consola.withTag('sparql-test');
  
  try {
    logger.info('Testing SPARQL Engine...');
    
    // Create graph processor with some test data
    const graphProcessor = new GraphProcessor();
    
    // Create some test triples
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:Person a rdfs:Class ;
        rdfs:label "Person" .
      
      ex:john a ex:Person ;
        rdfs:label "John Doe" ;
        ex:age 30 ;
        ex:email "john@example.org" .
      
      ex:jane a ex:Person ;
        rdfs:label "Jane Smith" ;
        ex:age 25 ;
        ex:email "jane@example.org" .
    `;
    
    // Parse and load test data
    const parseResult = await graphProcessor.parseRDF(testData, 'turtle');
    graphProcessor.addQuads(parseResult.quads);
    
    logger.success(`Loaded ${parseResult.count} triples into graph`);
    
    // Create SPARQL engine
    const sparqlEngine = new SparqlEngine({
      graphProcessor,
      enableProvenance: false
    });
    
    logger.info('SPARQL Engine initialized');
    
    // Test 1: Simple SELECT query
    const query1 = `
      PREFIX ex: <http://example.org/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?person ?label ?age WHERE {
        ?person a ex:Person .
        ?person rdfs:label ?label .
        ?person ex:age ?age .
      }
    `;
    
    logger.info('Executing SELECT query...');
    const results1 = await sparqlEngine.executeQuery(query1);
    logger.success(`SELECT query returned ${results1.results?.bindings?.length || 0} results`);
    
    if (results1.results?.bindings?.length > 0) {
      console.log('Sample result:', results1.results.bindings[0]);
    }
    
    // Test 2: Template variable extraction (mock)
    logger.info('Testing template variable extraction...');
    
    // Add mock template data
    const templateData = `
      @prefix tmpl: <http://kgen.enterprise/template/> .
      @prefix kgen: <http://kgen.enterprise/> .
      
      tmpl:user-template tmpl:path "user.java.njk" ;
        tmpl:hasVariable [
          tmpl:name "className" ;
          tmpl:value "User" ;
          tmpl:type "string" 
        ] ;
        tmpl:hasVariable [
          tmpl:name "packageName" ;
          tmpl:value "com.example" ;
          tmpl:type "string"
        ] .
    `;
    
    const templateParseResult = await graphProcessor.parseRDF(templateData, 'turtle');
    graphProcessor.addQuads(templateParseResult.quads);
    
    const variables = await sparqlEngine.extractTemplateVariables('user.java.njk');
    logger.success(`Extracted ${Object.keys(variables).length} template variables`);
    console.log('Template variables:', variables);
    
    // Test 3: Context extraction
    logger.info('Testing context extraction...');
    const context = await sparqlEngine.extractContext('http://example.org/john');
    logger.success('Context extraction completed');
    console.log('Context properties:', Object.keys(context.properties));
    
    // Test 4: Graph validation
    logger.info('Testing graph validation...');
    const validation = await sparqlEngine.validateGraph();
    logger.success(`Graph validation: ${validation.isValid ? 'VALID' : 'INVALID'} (${validation.healthScore.toFixed(1)}% health)`);
    
    // Show engine metrics
    const metrics = sparqlEngine.getMetrics();
    logger.info('SPARQL Engine Metrics:');
    console.log({
      queriesExecuted: metrics.queriesExecuted,
      cacheHitRate: (metrics.hitRate * 100).toFixed(2) + '%',
      averageExecutionTime: metrics.averageExecutionTime.toFixed(2) + 'ms',
      graphSize: metrics.graphSize
    });
    
    logger.success('All SPARQL Engine tests completed successfully!');
    return true;
    
  } catch (error) {
    logger.error('SPARQL Engine test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSparqlEngine().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testSparqlEngine };