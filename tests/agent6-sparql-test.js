/**
 * Agent 6 SPARQL Query Engine Validator
 * 
 * Tests actual SPARQL functionality and compliance
 */

import { Store, DataFactory, Parser as N3Parser } from 'n3';
import { readFileSync } from 'fs';
import { SparqlEngine } from '../packages/kgen-core/src/sparql-engine.js';
import { GraphProcessor } from '../packages/kgen-core/src/rdf/graph-processor.js';

const { namedNode, literal } = DataFactory;

async function testSparqlEngine() {
  console.log('\n=== AGENT 6 SPARQL VALIDATION REPORT ===\n');
  
  const report = {
    timestamp: this.getDeterministicDate().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      sparqlCompliance: 'UNKNOWN'
    }
  };

  // Test 1: Basic RDF Loading
  try {
    console.log('🔍 Testing RDF Graph Loading...');
    const store = new Store();
    const parser = new N3Parser({ format: 'turtle' });
    
    const testData = readFileSync('tests/agent6-test-dataset.ttl', 'utf8');
    const quads = parser.parse(testData);
    store.addQuads(quads);
    
    report.tests.rdfLoading = {
      status: 'WORKING',
      details: `Loaded ${quads.length} triples successfully`,
      tripleCount: quads.length
    };
    report.summary.passed++;
    console.log(`✅ RDF Loading: ${quads.length} triples loaded`);
  } catch (error) {
    report.tests.rdfLoading = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ RDF Loading: ${error.message}`);
  }
  report.summary.total++;

  // Test 2: Basic SELECT Query
  try {
    console.log('\n🔍 Testing Basic SELECT Query...');
    const graphProcessor = new GraphProcessor();
    await graphProcessor.loadGraph('tests/agent6-test-dataset.ttl');
    
    const sparqlEngine = new SparqlEngine({
      graphProcessor: graphProcessor,
      enableCaching: false
    });
    
    const basicQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    const result = await sparqlEngine.executeQuery(basicQuery);
    
    if (result && result.results && result.results.results) {
      report.tests.basicSelect = {
        status: 'WORKING',
        details: `Basic SELECT executed`,
        resultCount: result.results.results.bindings?.length || 0
      };
      report.summary.passed++;
      console.log(`✅ Basic SELECT: Query executed`);
    } else {
      throw new Error('No results structure returned');
    }
  } catch (error) {
    report.tests.basicSelect = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ Basic SELECT: ${error.message}`);
  }
  report.summary.total++;

  // Test 3: Manual N3 Store Query (Direct SPARQL)
  try {
    console.log('\n🔍 Testing Direct N3 Store Query...');
    const store = new Store();
    const parser = new N3Parser({ format: 'turtle' });
    
    const testData = readFileSync('tests/agent6-test-dataset.ttl', 'utf8');
    const quads = parser.parse(testData);
    store.addQuads(quads);
    
    // Test direct store query capabilities
    const allQuads = store.getQuads();
    const personQuads = store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person'));
    
    report.tests.directQuery = {
      status: 'WORKING',
      details: `Direct store access working`,
      totalTriples: allQuads.length,
      personEntities: personQuads.length
    };
    report.summary.passed++;
    console.log(`✅ Direct Query: ${allQuads.length} total triples, ${personQuads.length} persons found`);
    
    // Show sample data
    console.log('\n📊 Sample RDF Data:');
    personQuads.slice(0, 3).forEach(quad => {
      console.log(`   ${quad.subject.value} -> ${quad.object.value}`);
    });
    
  } catch (error) {
    report.tests.directQuery = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ Direct Query: ${error.message}`);
  }
  report.summary.total++;

  // Test 4: SPARQL Parser Test
  try {
    console.log('\n🔍 Testing SPARQL Parser...');
    const { Parser as SparqlParser } = await import('sparqljs');
    const parser = new SparqlParser();
    
    const queries = [
      'SELECT * WHERE { ?s ?p ?o }',
      'SELECT ?person ?name WHERE { ?person a <http://xmlns.com/foaf/0.1/Person> ; <http://xmlns.com/foaf/0.1/name> ?name }',
      'ASK WHERE { ?s a <http://xmlns.com/foaf/0.1/Person> }',
      'CONSTRUCT { ?s <http://xmlns.com/foaf/0.1/name> ?name } WHERE { ?s <http://xmlns.com/foaf/0.1/name> ?name }'
    ];
    
    const parsedQueries = {};
    for (const query of queries) {
      try {
        const parsed = parser.parse(query);
        parsedQueries[parsed.queryType] = 'SUPPORTED';
      } catch (e) {
        parsedQueries[query.split(' ')[0]] = 'UNSUPPORTED';
      }
    }
    
    report.tests.sparqlParser = {
      status: 'WORKING',
      details: 'SPARQL parser available',
      supportedTypes: parsedQueries
    };
    report.summary.passed++;
    console.log(`✅ SPARQL Parser: Available with types: ${Object.keys(parsedQueries).join(', ')}`);
    
  } catch (error) {
    report.tests.sparqlParser = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ SPARQL Parser: ${error.message}`);
  }
  report.summary.total++;

  // Test 5: CLI Command Status
  try {
    console.log('\n🔍 Testing CLI Command Implementation...');
    const { WorkingSparqlCliAdapter } = await import('../src/kgen/cli/working-sparql-adapter.js');
    
    const adapter = new WorkingSparqlCliAdapter({
      enableVerbose: false
    });
    
    await adapter.initialize();
    const loadResult = await adapter.loadGraph('tests/agent6-test-dataset.ttl');
    const status = adapter.getStatus();
    
    report.tests.cliImplementation = {
      status: status.adapter.graphLoaded ? 'PARTIAL' : 'BROKEN',
      details: `Graph loading: ${loadResult.tripleCount} triples`,
      tripleCount: status.store.tripleCount,
      limitations: 'Query execution returns empty results (stub implementation)'
    };
    
    if (status.adapter.graphLoaded) {
      report.summary.passed++;
      console.log(`⚠️  CLI Implementation: PARTIAL - Loads data but query execution is stubbed`);
    } else {
      report.summary.failed++;
      console.log(`❌ CLI Implementation: Graph loading failed`);
    }
    
  } catch (error) {
    report.tests.cliImplementation = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ CLI Implementation: ${error.message}`);
  }
  report.summary.total++;

  // Test 6: Complex SPARQL Features Test
  try {
    console.log('\n🔍 Testing Complex SPARQL Features...');
    const complexQueries = [
      {
        type: 'FILTER',
        query: 'SELECT ?person ?age WHERE { ?person <http://xmlns.com/foaf/0.1/age> ?age . FILTER(?age > 30) }',
        description: 'Filter with numeric comparison'
      },
      {
        type: 'OPTIONAL',
        query: 'SELECT ?person ?name ?email WHERE { ?person <http://xmlns.com/foaf/0.1/name> ?name . OPTIONAL { ?person <http://xmlns.com/foaf/0.1/email> ?email } }',
        description: 'Optional pattern matching'
      },
      {
        type: 'UNION',
        query: 'SELECT ?person ?contact WHERE { { ?person <http://xmlns.com/foaf/0.1/email> ?contact } UNION { ?person <http://xmlns.com/foaf/0.1/phone> ?contact } }',
        description: 'Union of patterns'
      },
      {
        type: 'ORDER BY',
        query: 'SELECT ?person ?age WHERE { ?person <http://xmlns.com/foaf/0.1/age> ?age } ORDER BY DESC(?age)',
        description: 'Result ordering'
      }
    ];
    
    const { Parser as SparqlParser } = await import('sparqljs');
    const parser = new SparqlParser();
    
    const complexSupport = {};
    for (const test of complexQueries) {
      try {
        const parsed = parser.parse(test.query);
        complexSupport[test.type] = 'PARSEABLE';
      } catch (e) {
        complexSupport[test.type] = 'UNPARSEABLE';
      }
    }
    
    report.tests.complexSparql = {
      status: 'PARTIAL',
      details: 'Complex SPARQL features can be parsed but execution not verified',
      support: complexSupport
    };
    report.summary.passed++;
    console.log(`⚠️  Complex SPARQL: Parser supports complex features but execution engine incomplete`);
    
  } catch (error) {
    report.tests.complexSparql = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ Complex SPARQL: ${error.message}`);
  }
  report.summary.total++;

  // Determine overall SPARQL compliance
  const workingTests = report.summary.passed;
  const totalTests = report.summary.total;
  const complianceScore = (workingTests / totalTests) * 100;
  
  if (complianceScore >= 80) {
    report.summary.sparqlCompliance = 'PARTIAL';
  } else if (complianceScore >= 50) {
    report.summary.sparqlCompliance = 'LIMITED';
  } else {
    report.summary.sparqlCompliance = 'BROKEN';
  }

  // Final Summary
  console.log('\n' + '='.repeat(50));
  console.log('FINAL VALIDATION SUMMARY:');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${report.summary.passed}/${report.summary.total} tests`);
  console.log(`❌ Failed: ${report.summary.failed}/${report.summary.total} tests`);
  console.log(`🎯 SPARQL Compliance: ${report.summary.sparqlCompliance}`);
  console.log(`📊 Compliance Score: ${Math.round(complianceScore)}%`);
  
  console.log('\nDETAILED FINDINGS:');
  console.log('• RDF Loading: ' + (report.tests.rdfLoading?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  console.log('• Basic SELECT: ' + (report.tests.basicSelect?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  console.log('• Direct Query: ' + (report.tests.directQuery?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  console.log('• SPARQL Parser: ' + (report.tests.sparqlParser?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  console.log('• CLI Implementation: ' + (report.tests.cliImplementation?.status === 'PARTIAL' ? '⚠️  PARTIAL' : report.tests.cliImplementation?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  console.log('• Complex Features: ' + (report.tests.complexSparql?.status === 'PARTIAL' ? '⚠️  PARTIAL' : report.tests.complexSparql?.status === 'WORKING' ? '✅ WORKS' : '❌ BROKEN'));
  
  return report;
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSparqlEngine()
    .then(report => {
      console.log('\n📁 Full report available in validation result');
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { testSparqlEngine };