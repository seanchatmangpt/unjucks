/**
 * Simple SPARQL Query Engine Test
 * 
 * Basic functionality test for the SPARQL query engine
 */

import { QueryEngine } from '../../packages/kgen-core/src/query/engine.js';
import { Logger } from 'consola';
import { Store, DataFactory } from 'n3';

const { namedNode, literal } = DataFactory;
const logger = new Logger({ tag: 'simple-query-test' });

async function testQueryEngine() {
  logger.info('🚀 Testing SPARQL Query Engine...');
  
  try {
    // Create and initialize engine
    const engine = new QueryEngine({
      enableQueryCache: false,
      enableQueryOptimization: false
    });
    
    await engine.initialize();
    logger.success('✅ Engine initialized');
    
    // Add some test data
    const store = new Store();
    const subject = namedNode('http://example.org/subject1');
    const predicate = namedNode('http://example.org/predicate1');
    const object = literal('Test Object');
    
    store.addQuad(subject, predicate, object);
    
    // Add to engine store
    engine.queryStore.addQuad(subject, predicate, object);
    
    logger.info(`Added 1 test triple to store (total: ${engine.queryStore.size})`);
    
    // Test basic query
    const query = `
      SELECT ?s ?p ?o WHERE {
        ?s ?p ?o .
      }
    `;
    
    const results = await engine.executeSPARQL(query);
    
    logger.info(`Query executed successfully`);
    logger.info(`Results: ${JSON.stringify(results, null, 2)}`);
    
    // Check results
    if (results.results && results.results.bindings) {
      logger.success(`✅ Found ${results.results.bindings.length} results`);
    } else {
      logger.error('❌ Invalid result structure');
      return false;
    }
    
    // Test engine status
    const status = engine.getStatus();
    logger.info(`Engine status: ${status.state}`);
    logger.info(`RDF triples: ${status.rdfTriples || 0}`);
    logger.info(`Query metrics: ${JSON.stringify(status.queryMetrics)}`);
    
    logger.success('🎉 All tests passed!');
    return true;
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    logger.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testQueryEngine().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  logger.error('Test crashed:', error);
  process.exit(1);
});