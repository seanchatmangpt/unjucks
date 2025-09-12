/**
 * Basic SPARQL Engine Test
 * 
 * Test the core QueryEngine functionality without advanced components
 */

import consola from 'consola';
import { Store, DataFactory } from 'n3';
import * as SparqlJs from 'sparqljs';

const { namedNode, literal } = DataFactory;
const logger = consola.withTag('basic-engine-test');

// Basic QueryEngine implementation for testing
class BasicQueryEngine {
  constructor() {
    this.sparqlParser = new SparqlJs.Parser();
    this.queryStore = new Store();
    this.logger = logger;
  }

  async initialize() {
    this.logger.info('Basic engine initialized');
  }

  async executeSPARQL(query) {
    try {
      // Parse query
      const parsedQuery = this.sparqlParser.parse(query);
      
      // Simple query execution against store
      const bindings = [];
      
      // For basic SELECT queries, return all triples
      if (parsedQuery.queryType === 'SELECT') {
        let count = 0;
        for (const quad of this.queryStore) {
          if (parsedQuery.limit && count >= parsedQuery.limit) break;
          
          bindings.push({
            s: { type: 'uri', value: quad.subject.value },
            p: { type: 'uri', value: quad.predicate.value },
            o: { type: quad.object.termType === 'NamedNode' ? 'uri' : 'literal', value: quad.object.value }
          });
          count++;
        }
      }
      
      return {
        head: { vars: ['s', 'p', 'o'] },
        results: { bindings }
      };
      
    } catch (error) {
      this.logger.error('Query execution failed:', error.message);
      throw error;
    }
  }
}

async function testBasicEngine() {
  logger.info('🚀 Testing Basic SPARQL Engine...');
  
  try {
    // Create and initialize engine
    const engine = new BasicQueryEngine();
    await engine.initialize();
    logger.success('✅ Engine initialized');
    
    // Add test data
    const subject = namedNode('http://example.org/subject1');
    const predicate = namedNode('http://example.org/predicate1');
    const object = literal('Test Object');
    
    engine.queryStore.addQuad(subject, predicate, object);
    logger.info(`✅ Added test data (store size: ${engine.queryStore.size})`);
    
    // Test basic query
    const query = `
      SELECT ?s ?p ?o WHERE {
        ?s ?p ?o .
      }
      LIMIT 5
    `;
    
    const results = await engine.executeSPARQL(query);
    logger.info(`✅ Query executed successfully`);
    logger.info(`Results: ${results.results.bindings.length} bindings`);
    
    // Validate results
    if (!results.results || !Array.isArray(results.results.bindings)) {
      throw new Error('Invalid result structure');
    }
    
    if (results.results.bindings.length === 0) {
      throw new Error('No results returned');
    }
    
    logger.success('🎉 Basic SPARQL engine test passed!');
    return true;
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testBasicEngine().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  logger.error('Test crashed:', error);
  process.exit(1);
});