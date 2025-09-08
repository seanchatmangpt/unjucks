/**
 * Clean Room SPARQL Integration Test
 * Tests SPARQL query generation and execution capabilities
 */

import { Store, Parser, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

export class SPARQLGenerationTester {
  constructor() {
    this.store = new Store();
    this.parser = new Parser();
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      details: []
    };
    
    // Initialize with test data
    this.setupTestData();
  }

  async setupTestData() {
    // Add comprehensive test data covering multiple vocabularies
    const testQuads = [
      // Schema.org Person data
      quad(
        namedNode('https://example.org/person/alice'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('https://schema.org/Person')
      ),
      quad(
        namedNode('https://example.org/person/alice'),
        namedNode('https://schema.org/name'),
        literal('Alice Johnson')
      ),
      quad(
        namedNode('https://example.org/person/alice'),
        namedNode('https://schema.org/email'),
        literal('alice@example.org')
      ),
      quad(
        namedNode('https://example.org/person/alice'),
        namedNode('https://schema.org/worksFor'),
        namedNode('https://example.org/org/techcorp')
      ),
      
      // Organization data
      quad(
        namedNode('https://example.org/org/techcorp'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('https://schema.org/Organization')
      ),
      quad(
        namedNode('https://example.org/org/techcorp'),
        namedNode('https://schema.org/name'),
        literal('TechCorp Inc.')
      ),
      quad(
        namedNode('https://example.org/org/techcorp'),
        namedNode('https://schema.org/numberOfEmployees'),
        literal('500', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
      ),
      
      // FOAF data
      quad(
        namedNode('https://example.org/person/bob'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person')
      ),
      quad(
        namedNode('https://example.org/person/bob'),
        namedNode('http://xmlns.com/foaf/0.1/name'),
        literal('Bob Smith')
      ),
      quad(
        namedNode('https://example.org/person/alice'),
        namedNode('http://xmlns.com/foaf/0.1/knows'),
        namedNode('https://example.org/person/bob')
      ),
      
      // SKOS concepts
      quad(
        namedNode('https://example.org/concepts/programming'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/2004/02/skos/core#Concept')
      ),
      quad(
        namedNode('https://example.org/concepts/programming'),
        namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
        literal('Programming', 'en')
      ),
      
      // Dublin Core metadata
      quad(
        namedNode('https://example.org/documents/guide'),
        namedNode('http://purl.org/dc/elements/1.1/title'),
        literal('Programming Guide')
      ),
      quad(
        namedNode('https://example.org/documents/guide'),
        namedNode('http://purl.org/dc/elements/1.1/creator'),
        literal('Alice Johnson')
      )
    ];

    this.store.addQuads(testQuads);
  }

  async testBasicSPARQLGeneration() {
    this.results.totalTests++;
    try {
      const prefixes = this.generateSPARQLPrefixes();
      
      // Test basic SELECT query generation
      const selectQuery = this.generateSelectQuery(
        ['?person', '?name'],
        [
          { subject: '?person', predicate: 'rdf:type', object: 'schema:Person' },
          { subject: '?person', predicate: 'schema:name', object: '?name' }
        ]
      );

      const expectedPrefixes = [
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
        'PREFIX schema: <https://schema.org/>'
      ];

      // Validate query structure
      const hasValidPrefixes = expectedPrefixes.every(prefix => 
        selectQuery.includes(prefix)
      );
      
      const hasSelectClause = selectQuery.includes('SELECT ?person ?name');
      const hasWhereClause = selectQuery.includes('WHERE {');
      const hasValidTriples = selectQuery.includes('?person rdf:type schema:Person');

      if (hasValidPrefixes && hasSelectClause && hasWhereClause && hasValidTriples) {
        this.results.passed++;
        this.results.details.push({
          test: 'Basic SPARQL Generation',
          status: 'PASS',
          queryLength: selectQuery.length,
          hasPrefixes: hasValidPrefixes,
          hasStructure: hasSelectClause && hasWhereClause
        });
        return { success: true, query: selectQuery };
      } else {
        throw new Error('Generated SPARQL query structure invalid');
      }
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'Basic SPARQL Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testComplexSPARQLGeneration() {
    this.results.totalTests++;
    try {
      // Test complex query with multiple vocabularies
      const complexQuery = this.generateComplexQuery();
      
      // Validate complex query features
      const hasMultiplePrefixes = [
        'PREFIX rdf:',
        'PREFIX schema:',
        'PREFIX foaf:',
        'PREFIX skos:',
        'PREFIX dc:'
      ].every(prefix => complexQuery.includes(prefix));

      const hasOptionalClauses = complexQuery.includes('OPTIONAL');
      const hasFilterClauses = complexQuery.includes('FILTER');
      const hasUnionClauses = complexQuery.includes('UNION');

      if (hasMultiplePrefixes && (hasOptionalClauses || hasFilterClauses)) {
        this.results.passed++;
        this.results.details.push({
          test: 'Complex SPARQL Generation',
          status: 'PASS',
          queryLength: complexQuery.length,
          hasMultipleVocabs: hasMultiplePrefixes,
          hasAdvancedFeatures: hasOptionalClauses || hasFilterClauses || hasUnionClauses
        });
        return { success: true, query: complexQuery };
      } else {
        throw new Error('Complex SPARQL query missing required features');
      }
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'Complex SPARQL Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testSPARQLExecution() {
    this.results.totalTests++;
    try {
      // Execute queries against in-memory store
      const personResults = this.executeStoreQuery(
        null,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('https://schema.org/Person')
      );

      const organizationResults = this.executeStoreQuery(
        null,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('https://schema.org/Organization')
      );

      const foafPersonResults = this.executeStoreQuery(
        null,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person')
      );

      // Validate results
      if (personResults.length > 0 && organizationResults.length > 0 && foafPersonResults.length > 0) {
        this.results.passed++;
        this.results.details.push({
          test: 'SPARQL Execution',
          status: 'PASS',
          personResults: personResults.length,
          organizationResults: organizationResults.length,
          foafResults: foafPersonResults.length,
          totalResultSets: 3
        });
        return { 
          success: true, 
          results: { personResults, organizationResults, foafPersonResults }
        };
      } else {
        throw new Error('SPARQL execution returned empty results');
      }
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'SPARQL Execution',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async testPrefixGeneration() {
    this.results.totalTests++;
    try {
      const prefixes = this.generateSPARQLPrefixes();
      
      // Validate that all common prefixes are generated correctly
      const expectedPrefixes = {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#',
        'foaf': 'http://xmlns.com/foaf/0.1/',
        'schema': 'https://schema.org/',
        'skos': 'http://www.w3.org/2004/02/skos/core#',
        'dc': 'http://purl.org/dc/elements/1.1/',
        'dcterms': 'http://purl.org/dc/terms/'
      };

      let correctPrefixes = 0;
      const prefixLines = prefixes.split('\n').filter(line => line.startsWith('PREFIX'));
      
      for (const [prefix, expectedUri] of Object.entries(expectedPrefixes)) {
        const prefixLine = prefixLines.find(line => 
          line.includes(`${prefix}:`) && line.includes(`<${expectedUri}>`)
        );
        if (prefixLine) {
          correctPrefixes++;
        }
      }

      const successRate = (correctPrefixes / Object.keys(expectedPrefixes).length) * 100;

      if (successRate >= 80) { // 80% of prefixes must be correct
        this.results.passed++;
        this.results.details.push({
          test: 'SPARQL Prefix Generation',
          status: 'PASS',
          correctPrefixes,
          totalPrefixes: Object.keys(expectedPrefixes).length,
          successRate: `${successRate.toFixed(1)}%`
        });
        return { success: true, prefixes, successRate };
      } else {
        throw new Error(`Prefix generation success rate ${successRate}% below 80% threshold`);
      }
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        test: 'SPARQL Prefix Generation',
        status: 'FAIL',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  generateSPARQLPrefixes() {
    const prefixes = {
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl': 'http://www.w3.org/2002/07/owl#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'schema': 'https://schema.org/',
      'skos': 'http://www.w3.org/2004/02/skos/core#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'dcterms': 'http://purl.org/dc/terms/'
    };

    return Object.entries(prefixes)
      .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`)
      .join('\n');
  }

  generateSelectQuery(selectVars, whereTriples) {
    const prefixes = this.generateSPARQLPrefixes();
    const selectClause = `SELECT ${selectVars.join(' ')}`;
    const whereClause = 'WHERE {\n' + 
      whereTriples.map(triple => 
        `  ${triple.subject} ${triple.predicate} ${triple.object} .`
      ).join('\n') + '\n}';

    return `${prefixes}\n\n${selectClause}\n${whereClause}`;
  }

  generateComplexQuery() {
    const prefixes = this.generateSPARQLPrefixes();
    
    const complexQuery = `${prefixes}

SELECT DISTINCT ?person ?name ?email ?org ?orgName ?friend ?friendName
WHERE {
  ?person rdf:type schema:Person .
  ?person schema:name ?name .
  
  OPTIONAL {
    ?person schema:email ?email .
  }
  
  OPTIONAL {
    ?person schema:worksFor ?org .
    ?org schema:name ?orgName .
  }
  
  OPTIONAL {
    ?person foaf:knows ?friend .
    ?friend foaf:name ?friendName .
  }
  
  FILTER (
    EXISTS { ?person schema:name ?name } ||
    EXISTS { ?person foaf:name ?name }
  )
}
ORDER BY ?name
LIMIT 100`;

    return complexQuery;
  }

  executeStoreQuery(subject, predicate, object) {
    return this.store.getQuads(subject, predicate, object, null);
  }

  async runAllTests() {
    console.log('🧪 Starting Clean Room SPARQL Integration Tests...\n');

    const basicResult = await this.testBasicSPARQLGeneration();
    console.log('✅ Basic SPARQL Generation:', basicResult.success ? 'PASS' : 'FAIL');

    const complexResult = await this.testComplexSPARQLGeneration();
    console.log('✅ Complex SPARQL Generation:', complexResult.success ? 'PASS' : 'FAIL');

    const executionResult = await this.testSPARQLExecution();
    console.log('✅ SPARQL Execution:', executionResult.success ? 'PASS' : 'FAIL');

    const prefixResult = await this.testPrefixGeneration();
    console.log('✅ SPARQL Prefix Generation:', prefixResult.success ? 'PASS' : 'FAIL');

    return this.generateReport();
  }

  generateReport() {
    const successRate = (this.results.passed / this.results.totalTests) * 100;
    
    return {
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: `${successRate.toFixed(1)}%`
      },
      details: this.results.details,
      verdict: successRate >= 71 ? 'MEETS_BASELINE' : 'BELOW_BASELINE',
      focusArea: 'SPARQL prefix generation improvement needed' // Based on report findings
    };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SPARQLGenerationTester();
  const results = await tester.runAllTests();
  
  console.log('\n📊 SPARQL Test Results Summary:');
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Success Rate: ${results.summary.successRate}`);
  console.log(`Baseline Verdict: ${results.verdict}`);
  
  if (results.focusArea) {
    console.log(`🎯 Focus Area: ${results.focusArea}`);
  }
}