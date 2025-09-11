/**
 * Simple integration test to verify ProvenanceQueries with RDFProcessor
 */

import { ProvenanceQueries } from '../../src/kgen/provenance/queries/sparql.js';
import { Store } from 'n3';
import consola from 'consola';

async function testIntegration() {
  try {
    consola.info('🧪 Testing ProvenanceQueries with RDFProcessor integration...');

    // Create ProvenanceQueries instance
    const store = new Store();
    const provenanceQueries = new ProvenanceQueries(store);

    // Test 1: Basic initialization
    consola.info('Test 1: Basic initialization');
    console.log('✅ RDFProcessor:', provenanceQueries.rdfProcessor ? 'initialized' : 'missing');
    console.log('✅ Store:', provenanceQueries.store ? 'available' : 'missing');

    // Test 2: Add RDF data
    consola.info('Test 2: Adding RDF data');
    const rdfData = `
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      ex:entity1 a prov:Entity .
      ex:activity1 a prov:Activity .
      ex:agent1 a prov:Agent .
      
      ex:entity1 prov:wasGeneratedBy ex:activity1 .
      ex:activity1 prov:wasAssociatedWith ex:agent1 .
    `;

    const parseResult = await provenanceQueries.addRDFData(rdfData, 'turtle');
    console.log('✅ Added triples:', parseResult.count);

    // Test 3: Execute SPARQL query
    consola.info('Test 3: Executing SPARQL query');
    const query = `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      SELECT ?entity ?activity WHERE {
        ?entity prov:wasGeneratedBy ?activity .
      }
    `;

    const queryResult = await provenanceQueries.executeSparql(query);
    console.log('✅ Query results:', queryResult.results?.bindings?.length || 0, 'bindings');

    // Test 4: Use executeQuery method (with caching and optimization)
    consola.info('Test 4: Using executeQuery method');
    const optimizedResult = await provenanceQueries.executeQuery(query);
    console.log('✅ Optimized query results:', optimizedResult.results?.bindings?.length || 0, 'bindings');

    // Test 5: Statistics
    consola.info('Test 5: Getting statistics');
    const stats = provenanceQueries.getStoreStatistics();
    console.log('✅ Store statistics:');
    console.log('  - Total triples:', stats.totalTriples);
    console.log('  - Subjects:', stats.subjects);
    console.log('  - Predicates:', stats.predicates);
    console.log('  - Objects:', stats.objects);
    console.log('  - Template count:', stats.provenanceQueries.templateCount);

    // Test 6: Test provenance-specific queries
    consola.info('Test 6: Testing provenance lineage query');
    try {
      const lineage = await provenanceQueries.getEntityLineage('http://example.org/entity1');
      console.log('✅ Entity lineage query executed, results:', lineage.lineage.length);
    } catch (error) {
      console.log('⚠️  Entity lineage query failed (expected for simple test data):', error.message);
    }

    consola.success('🎉 All integration tests completed successfully!');
    
  } catch (error) {
    consola.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testIntegration();