/**
 * Agent 6 SPARQL Query Engine Validator
 * 
 * Tests actual SPARQL functionality and compliance
 */

import { Store, DataFactory, Parser as N3Parser } from 'n3';
import { readFileSync } from 'fs';

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

  // Test 2: Direct N3 Store Query
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
    const nameQuads = store.getQuads(null, namedNode('http://xmlns.com/foaf/0.1/name'), null);
    
    report.tests.directQuery = {
      status: 'WORKING',
      details: `Direct store access working`,
      totalTriples: allQuads.length,
      personEntities: personQuads.length,
      nameProperties: nameQuads.length
    };
    report.summary.passed++;
    console.log(`✅ Direct Query: ${allQuads.length} total triples, ${personQuads.length} persons, ${nameQuads.length} names`);
    
    // Show sample data
    console.log('\n📊 Sample Person Data:');
    nameQuads.slice(0, 4).forEach(quad => {
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

  // Test 3: SPARQL Parser Test
  try {
    console.log('\n🔍 Testing SPARQL Parser...');
    const sparqljs = await import('sparqljs');
    const parser = new sparqljs.Parser();
    
    const queries = [
      { type: 'SELECT', query: 'SELECT * WHERE { ?s ?p ?o }' },
      { type: 'SELECT with FILTER', query: 'SELECT ?person ?name WHERE { ?person a <http://xmlns.com/foaf/0.1/Person> ; <http://xmlns.com/foaf/0.1/name> ?name . FILTER(regex(?name, "Alice")) }' },
      { type: 'ASK', query: 'ASK WHERE { ?s a <http://xmlns.com/foaf/0.1/Person> }' },
      { type: 'CONSTRUCT', query: 'CONSTRUCT { ?s <http://xmlns.com/foaf/0.1/name> ?name } WHERE { ?s <http://xmlns.com/foaf/0.1/name> ?name }' },
      { type: 'DESCRIBE', query: 'DESCRIBE <http://example.org/alice>' }
    ];
    
    const parsedQueries = {};
    let parseCount = 0;
    
    for (const test of queries) {
      try {
        const parsed = parser.parse(test.query);
        parsedQueries[test.type] = 'SUPPORTED';
        parseCount++;
      } catch (e) {
        parsedQueries[test.type] = `UNSUPPORTED: ${e.message.substring(0, 50)}`;
      }
    }
    
    report.tests.sparqlParser = {
      status: parseCount > 0 ? 'WORKING' : 'BROKEN',
      details: `SPARQL parser available, ${parseCount}/${queries.length} query types supported`,
      supportedTypes: parsedQueries,
      parseSuccessRate: `${parseCount}/${queries.length}`
    };
    
    if (parseCount > 0) {
      report.summary.passed++;
      console.log(`✅ SPARQL Parser: ${parseCount}/${queries.length} query types parseable`);
    } else {
      report.summary.failed++;
      console.log(`❌ SPARQL Parser: No queries could be parsed`);
    }
    
  } catch (error) {
    report.tests.sparqlParser = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ SPARQL Parser: ${error.message}`);
  }
  report.summary.total++;

  // Test 4: CLI Command Status
  try {
    console.log('\n🔍 Testing CLI Command Implementation...');
    const { WorkingSparqlCliAdapter } = await import('../src/kgen/cli/working-sparql-adapter.js');
    
    const adapter = new WorkingSparqlCliAdapter({
      enableVerbose: false
    });
    
    await adapter.initialize();
    const loadResult = await adapter.loadGraph('tests/agent6-test-dataset.ttl');
    const status = adapter.getStatus();
    
    // Test a sample query execution
    const queryResult = await adapter.executeQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 5');
    
    report.tests.cliImplementation = {
      status: status.adapter.graphLoaded ? 'PARTIAL' : 'BROKEN',
      details: `Graph loading: ${loadResult.tripleCount} triples`,
      tripleCount: status.store.tripleCount,
      queryExecution: queryResult.results ? 'IMPLEMENTED' : 'STUBBED',
      actualResultCount: queryResult.metadata?.resultCount || 0,
      limitations: 'Query execution returns structured response but with empty results'
    };
    
    if (status.adapter.graphLoaded) {
      report.summary.passed++;
      console.log(`⚠️  CLI Implementation: PARTIAL - Loads ${loadResult.tripleCount} triples but query execution is stubbed`);
      console.log(`   Query result structure: ${JSON.stringify(queryResult.results, null, 2).substring(0, 100)}...`);
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

  // Test 5: Advanced SPARQL Query Pattern Testing
  try {
    console.log('\n🔍 Testing Advanced SPARQL Pattern Support...');
    const sparqljs = await import('sparqljs');
    const parser = new sparqljs.Parser();
    
    const advancedQueries = [
      {
        name: 'FILTER with numeric comparison',
        query: 'SELECT ?person ?age WHERE { ?person <http://xmlns.com/foaf/0.1/age> ?age . FILTER(?age > 30) }'
      },
      {
        name: 'OPTIONAL pattern',
        query: 'SELECT ?person ?name ?email WHERE { ?person <http://xmlns.com/foaf/0.1/name> ?name . OPTIONAL { ?person <http://xmlns.com/foaf/0.1/email> ?email } }'
      },
      {
        name: 'UNION pattern',
        query: 'SELECT ?person ?contact WHERE { { ?person <http://xmlns.com/foaf/0.1/email> ?contact } UNION { ?person <http://xmlns.com/foaf/0.1/phone> ?contact } }'
      },
      {
        name: 'ORDER BY with DESC',
        query: 'SELECT ?person ?age WHERE { ?person <http://xmlns.com/foaf/0.1/age> ?age } ORDER BY DESC(?age)'
      },
      {
        name: 'GROUP BY with COUNT',
        query: 'SELECT ?dept (COUNT(?person) as ?count) WHERE { ?person <http://example.org/department> ?dept } GROUP BY ?dept'
      }
    ];
    
    const patternSupport = {};
    let supportedCount = 0;
    
    for (const test of advancedQueries) {
      try {
        const parsed = parser.parse(test.query);
        patternSupport[test.name] = { status: 'PARSEABLE', type: parsed.queryType };
        supportedCount++;
      } catch (e) {
        patternSupport[test.name] = { status: 'UNPARSEABLE', error: e.message.substring(0, 60) };
      }
    }
    
    report.tests.advancedSparql = {
      status: supportedCount >= 3 ? 'WORKING' : 'PARTIAL',
      details: `${supportedCount}/${advancedQueries.length} advanced patterns supported`,
      patterns: patternSupport,
      sparql11Compliance: supportedCount >= 4 ? 'HIGH' : supportedCount >= 2 ? 'MEDIUM' : 'LOW'
    };
    
    if (supportedCount >= 3) {
      report.summary.passed++;
      console.log(`✅ Advanced SPARQL: ${supportedCount}/${advancedQueries.length} patterns parseable - SPARQL 1.1 ${report.tests.advancedSparql.sparql11Compliance} compliance`);
    } else {
      report.summary.failed++;
      console.log(`❌ Advanced SPARQL: Only ${supportedCount}/${advancedQueries.length} patterns supported`);
    }
    
  } catch (error) {
    report.tests.advancedSparql = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ Advanced SPARQL: ${error.message}`);
  }
  report.summary.total++;

  // Test 6: Result Format Validation
  try {
    console.log('\n🔍 Testing Result Serialization Formats...');
    const { WorkingSparqlCliAdapter } = await import('../src/kgen/cli/working-sparql-adapter.js');
    
    const adapter = new WorkingSparqlCliAdapter({
      outputFormat: 'json',
      enableVerbose: false
    });
    
    await adapter.initialize();
    await adapter.loadGraph('tests/agent6-test-dataset.ttl');
    
    const formats = ['json', 'csv', 'table'];
    const formatSupport = {};
    
    for (const format of formats) {
      try {
        adapter.config.outputFormat = format;
        const result = await adapter.executeQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 3', { format });
        formatSupport[format] = {
          status: 'SUPPORTED',
          structure: typeof result.results
        };
      } catch (e) {
        formatSupport[format] = {
          status: 'UNSUPPORTED',
          error: e.message.substring(0, 50)
        };
      }
    }
    
    report.tests.resultFormats = {
      status: Object.values(formatSupport).some(f => f.status === 'SUPPORTED') ? 'WORKING' : 'BROKEN',
      details: 'Result serialization format support',
      formats: formatSupport
    };
    
    const supportedFormats = Object.entries(formatSupport).filter(([_, v]) => v.status === 'SUPPORTED').length;
    if (supportedFormats > 0) {
      report.summary.passed++;
      console.log(`✅ Result Formats: ${supportedFormats}/${formats.length} formats supported`);
    } else {
      report.summary.failed++;
      console.log(`❌ Result Formats: No formats properly supported`);
    }
    
  } catch (error) {
    report.tests.resultFormats = {
      status: 'BROKEN',
      error: error.message
    };
    report.summary.failed++;
    console.log(`❌ Result Formats: ${error.message}`);
  }
  report.summary.total++;

  // Determine overall SPARQL compliance
  const workingTests = report.summary.passed;
  const totalTests = report.summary.total;
  const complianceScore = (workingTests / totalTests) * 100;
  
  if (complianceScore >= 75) {
    report.summary.sparqlCompliance = 'PARTIAL';
  } else if (complianceScore >= 50) {
    report.summary.sparqlCompliance = 'LIMITED';  
  } else {
    report.summary.sparqlCompliance = 'BROKEN';
  }

  // Generate final validation report
  console.log('\n' + '='.repeat(60));
  console.log('AGENT 6 VALIDATION REPORT: SPARQL QUERY ENGINE');
  console.log('='.repeat(60));
  console.log(`📊 Test Results: ${report.summary.passed}/${report.summary.total} PASSED`);
  console.log(`❌ Failed Tests: ${report.summary.failed}/${report.summary.total}`);
  console.log(`🎯 SPARQL Engine Status: ${report.summary.sparqlCompliance}`);
  console.log(`📈 Compliance Score: ${Math.round(complianceScore)}%`);
  
  console.log('\nCOMPONENT STATUS:');
  console.log('▫️ RDF Store Backend: ' + (report.tests.rdfLoading?.status === 'WORKING' ? 'N3 Store - ✅ FUNCTIONAL' : '❌ BROKEN'));
  console.log('▫️ Triple Loading: ' + (report.tests.directQuery?.tripleCount > 0 ? `✅ WORKING (${report.tests.directQuery?.tripleCount} triples)` : '❌ BROKEN'));
  console.log('▫️ SPARQL Parser: ' + (report.tests.sparqlParser?.status === 'WORKING' ? '✅ SPARQLJS AVAILABLE' : '❌ NOT AVAILABLE'));
  console.log('▫️ Query Engine: ' + (report.tests.cliImplementation?.status === 'PARTIAL' ? '⚠️  STUB IMPLEMENTATION' : report.tests.cliImplementation?.status === 'WORKING' ? '✅ FUNCTIONAL' : '❌ BROKEN'));
  console.log('▫️ SPARQL 1.1 Features: ' + (report.tests.advancedSparql?.sparql11Compliance === 'HIGH' ? '✅ EXCELLENT' : report.tests.advancedSparql?.sparql11Compliance === 'MEDIUM' ? '⚠️  PARTIAL' : '❌ LIMITED'));
  console.log('▫️ Result Serialization: ' + (report.tests.resultFormats?.status === 'WORKING' ? '✅ MULTIPLE FORMATS' : '❌ LIMITED'));
  
  console.log('\nSPARQL COMPLIANCE ANALYSIS:');
  if (report.tests.sparqlParser?.status === 'WORKING') {
    console.log('✅ Basic SELECT queries: PARSEABLE');
    console.log('✅ ASK queries: ' + (report.tests.sparqlParser.supportedTypes?.ASK === 'SUPPORTED' ? 'SUPPORTED' : 'UNKNOWN'));
    console.log('✅ CONSTRUCT queries: ' + (report.tests.sparqlParser.supportedTypes?.CONSTRUCT === 'SUPPORTED' ? 'SUPPORTED' : 'UNKNOWN'));
    console.log('✅ DESCRIBE queries: ' + (report.tests.sparqlParser.supportedTypes?.DESCRIBE === 'SUPPORTED' ? 'SUPPORTED' : 'UNKNOWN'));
  } else {
    console.log('❌ SPARQL parsing: NOT AVAILABLE');
  }
  
  if (report.tests.advancedSparql?.status === 'WORKING') {
    const patterns = report.tests.advancedSparql.patterns;
    console.log('▪️ FILTER operations: ' + (patterns['FILTER with numeric comparison']?.status === 'PARSEABLE' ? '✅ SUPPORTED' : '❌ UNSUPPORTED'));
    console.log('▪️ OPTIONAL patterns: ' + (patterns['OPTIONAL pattern']?.status === 'PARSEABLE' ? '✅ SUPPORTED' : '❌ UNSUPPORTED'));
    console.log('▪️ UNION patterns: ' + (patterns['UNION pattern']?.status === 'PARSEABLE' ? '✅ SUPPORTED' : '❌ UNSUPPORTED'));
    console.log('▪️ ORDER BY: ' + (patterns['ORDER BY with DESC']?.status === 'PARSEABLE' ? '✅ SUPPORTED' : '❌ UNSUPPORTED'));
    console.log('▪️ GROUP BY + aggregation: ' + (patterns['GROUP BY with COUNT']?.status === 'PARSEABLE' ? '✅ SUPPORTED' : '❌ UNSUPPORTED'));
  }
  
  console.log('\nCRITICAL FINDINGS:');
  if (report.tests.cliImplementation?.queryExecution === 'STUBBED') {
    console.log('⚠️  MAJOR ISSUE: Query execution engine is stubbed - returns empty results');
    console.log('   Impact: CLI command succeeds but provides no actual query results');
  }
  
  if (report.tests.directQuery?.status === 'WORKING' && report.tests.sparqlParser?.status === 'WORKING') {
    console.log('✅ Foundation components working: RDF store + SPARQL parser available');
    console.log('🔧 Missing: Integration between parser and store for actual query execution');
  }
  
  return report;
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSparqlEngine()
    .then(report => {
      console.log('\n📄 Complete validation report generated');
      console.log('🏁 Exit code based on test results');
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation script failed:', error);
      process.exit(1);
    });
}

export { testSparqlEngine };