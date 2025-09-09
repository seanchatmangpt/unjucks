import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SemanticEngine } from '../src/lib/semantic-engine.js';
import { SemanticQueryEngine } from '../src/lib/semantic-query-engine.js';
import { RDFDataLoader } from '../src/lib/rdf-data-loader.js';

describe('Semantic Web Integration Tests', () => {
  test('SemanticEngine can be instantiated', async () => {
    const engine = new SemanticEngine();
    assert.ok(engine, 'SemanticEngine should be created');
    assert.ok(engine.ENTERPRISE_ONTOLOGIES, 'Should have enterprise ontologies');
    assert.ok(engine.getDefaultPrefixes(), 'Should have default prefixes');
  });

  test('SemanticQueryEngine can be instantiated', async () => {
    const queryEngine = new SemanticQueryEngine();
    assert.ok(queryEngine, 'SemanticQueryEngine should be created');
    assert.ok(queryEngine.store, 'Should have N3 store');
    assert.ok(queryEngine.sparqlParser, 'Should have SPARQL parser');
  });

  test('RDFDataLoader can load inline Turtle data', async () => {
    const loader = new RDFDataLoader();
    const testData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
    foaf:name "John Doe" ;
    foaf:age 30 .
`;

    const result = await loader.loadFromSource({
      type: 'inline',
      content: testData
    });

    assert.ok(result.success, 'Should successfully load turtle data');
    assert.ok(result.data.triples, 'Should have triples');
    assert.ok(result.data.triples.length > 0, 'Should have at least one triple');
    assert.ok(result.data.subjects, 'Should have subjects');
    assert.ok(result.data.subjects['http://example.org/john'], 'Should have john subject');
  });

  test('SPARQL query engine can load and query RDF data', async () => {
    const queryEngine = new SemanticQueryEngine();
    const testData = [
      {
        subject: { type: 'uri', value: 'http://example.org/john' },
        predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
        object: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/Person' }
      },
      {
        subject: { type: 'uri', value: 'http://example.org/john' },
        predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
        object: { type: 'literal', value: 'John Doe' }
      }
    ];

    await queryEngine.loadRDFData(testData);
    assert.ok(queryEngine.store.size > 0, 'Store should contain data');

    // Test simple SPARQL query
    const sparqlQuery = `
      SELECT ?name WHERE {
        ?person <http://xmlns.com/foaf/0.1/name> ?name .
      }
    `;

    const results = await queryEngine.executeSPARQLQuery(sparqlQuery);
    assert.ok(results, 'Should return results');
    assert.equal(results.queryType, 'SELECT', 'Should be SELECT query');
  });

  test('SemanticEngine can create template context from RDF data', async () => {
    const engine = new SemanticEngine();
    const dataSources = [{
      type: 'inline',
      content: `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:email "alice@example.org" .
`
    }];

    const context = await engine.createSemanticTemplateContext(dataSources);
    assert.ok(context, 'Should create context');
    assert.ok(context.$rdf, 'Should have $rdf namespace');
    assert.ok(context.$rdf.prefixes, 'Should have prefixes');
    assert.ok(context.$semantic, 'Should have $semantic namespace');
  });

  test('Semantic filters work correctly', async () => {
    // Import semantic filters
    const { rdfResource, sparqlVar, turtleEscape } = await import('../src/lib/semantic-web-filters.js');
    
    assert.equal(rdfResource('test-resource'), 'test-resource', 'Should clean resource name');
    assert.equal(sparqlVar('myVar'), '?myVar', 'Should format SPARQL variable');
    assert.equal(turtleEscape('Hello "World"'), 'Hello \\"World\\"', 'Should escape quotes');
  });

  test('Enterprise semantic context builds indexes', async () => {
    const { EnterpriseSemanticContext } = await import('../src/lib/semantic-engine.js');
    
    const mockData = {
      subjects: {
        'http://example.org/person1': {
          type: ['http://xmlns.com/foaf/0.1/Person'],
          properties: {
            name: [{ value: 'John' }],
            age: [{ value: '30' }]
          }
        }
      },
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        ex: 'http://example.org/'
      }
    };

    const context = new EnterpriseSemanticContext(mockData);
    context.buildTypeIndex();
    context.buildPropertyChains();
    context.buildPatternCache();

    assert.ok(context.typeIndex.size > 0, 'Should build type index');
    assert.ok(context.propertyChains.size > 0, 'Should build property chains');
  });

  test('RDF processing handles enterprise scale data structure', async () => {
    const engine = new SemanticEngine();
    const mockData = {
      subjects: {},
      triples: new Array(1000).fill().map((_, i) => ({
        subject: { value: `http://example.org/entity${i}` },
        predicate: { value: 'http://xmlns.com/foaf/0.1/name' },
        object: { value: `Entity ${i}` }
      }))
    };

    const optimized = engine.optimizeForEnterpriseScale(mockData);
    assert.ok(optimized.indexes, 'Should have indexes');
    assert.ok(optimized.metadata, 'Should have metadata');
    assert.ok(optimized.metadata.optimizationLevel >= 1, 'Should have optimization level');
  });
});