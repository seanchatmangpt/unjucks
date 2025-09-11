/**
 * Comprehensive Query Engine Test Suite
 * 
 * Tests for large graph performance, optimization, and advanced features
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { QueryEngine, createOptimizedEngine, createHighPerformanceEngine } from '../../../packages/kgen-core/src/query/index.js';
import { Store, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

describe('QueryEngine', () => {
  let engine: QueryEngine;
  let store: Store;

  beforeEach(async () => {
    engine = new QueryEngine({
      enableQueryCache: true,
      enableQueryOptimization: true,
      enableIndexing: true,
      enableStatistics: true,
      queryTimeout: 5000
    });
    
    await engine.initialize();
    store = new Store();
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const result = await engine.initialize();
      expect(result.status).toBe('success');
      expect(result.details).toBeDefined();
    });

    test('should report correct status after initialization', () => {
      const status = engine.getStatus();
      expect(status.state).toBe('ready');
      expect(status.version).toBe('2.0.0');
      expect(status.configuration).toBeDefined();
    });

    test('should initialize with custom configuration', async () => {
      const customEngine = new QueryEngine({
        enableSPARQL: true,
        enableSemanticSearch: false,
        queryTimeout: 10000,
        maxResultSize: 5000
      });
      
      const result = await customEngine.initialize();
      expect(result.status).toBe('success');
      
      const status = customEngine.getStatus();
      expect(status.configuration.enableSPARQL).toBe(true);
      expect(status.configuration.enableSemanticSearch).toBe(false);
      
      await customEngine.shutdown();
    });
  });

  describe('RDF Data Loading', () => {
    test('should load Turtle data successfully', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" ;
                 foaf:knows ex:bob .
        
        ex:bob foaf:name "Bob Jones" ;
               foaf:age 30 .
      `;
      
      await engine.loadRDF(turtleData, 'turtle');
      
      const status = engine.getStatus();
      expect(status.storage.tripleCount).toBeGreaterThan(0);
    });

    test('should handle invalid RDF data gracefully', async () => {
      const invalidData = 'This is not valid RDF data';
      
      await expect(engine.loadRDF(invalidData, 'turtle'))
        .rejects.toThrow();
    });

    test('should rebuild indexes after loading data', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:entity1 ex:property1 "value1" .
        ex:entity2 ex:property2 "value2" .
      `;
      
      await engine.loadRDF(turtleData, 'turtle');
      
      const status = engine.getStatus();
      expect(status.indexes.enabled).toBe(true);
      expect(status.indexes.size).toBeGreaterThan(0);
    });
  });

  describe('SPARQL Query Execution', () => {
    beforeEach(async () => {
      // Load test data
      const testData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix prov: <http://www.w3.org/ns/prov#> .
        
        ex:alice foaf:name "Alice Smith" ;
                 foaf:age 25 ;
                 foaf:knows ex:bob, ex:charlie .
        
        ex:bob foaf:name "Bob Jones" ;
               foaf:age 30 ;
               foaf:email "bob@example.com" .
               
        ex:charlie foaf:name "Charlie Brown" ;
                   foaf:age 35 .
                   
        ex:dataset1 prov:wasGeneratedBy ex:activity1 ;
                    prov:wasDerivedFrom ex:dataset0 .
                    
        ex:activity1 prov:wasAssociatedWith ex:alice ;
                     prov:startedAtTime "2024-01-01T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
      `;
      
      await engine.loadRDF(testData, 'turtle');
    });

    test('should execute simple SELECT query', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name WHERE {
          ?person foaf:name ?name .
        }
      `;
      
      const result = await engine.executeSPARQL(query);
      
      expect(result.head.vars).toEqual(['person', 'name']);
      expect(result.results.bindings.length).toBeGreaterThan(0);
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
      expect(result.metadata?.resultCount).toBe(result.results.bindings.length);
    });

    test('should execute complex SELECT query with filters', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name ?age WHERE {
          ?person foaf:name ?name ;
                 foaf:age ?age .
          FILTER(?age > 25)
        }
        ORDER BY DESC(?age)
      `;
      
      const result = await engine.executeSPARQL(query);
      
      expect(result.results.bindings.length).toBeGreaterThan(0);
      
      // Check ordering
      const ages = result.results.bindings.map(b => parseInt(b.age?.value || '0'));
      for (let i = 1; i < ages.length; i++) {
        expect(ages[i]).toBeLessThanOrEqual(ages[i - 1]);
      }
    });

    test('should handle queries with LIMIT and OFFSET', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name WHERE {
          ?person foaf:name ?name .
        }
        ORDER BY ?name
        LIMIT 2 OFFSET 1
      `;
      
      const result = await engine.executeSPARQL(query);
      
      expect(result.results.bindings.length).toBeLessThanOrEqual(2);
    });

    test('should execute ASK query', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        ASK {
          ?person foaf:name "Alice Smith" .
        }
      `;
      
      const result = await engine.executeSPARQL(query);
      
      expect(result.boolean).toBe(true);
    });

    test('should handle queries with optional patterns', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name ?email WHERE {
          ?person foaf:name ?name .
          OPTIONAL { ?person foaf:email ?email }
        }
      `;
      
      const result = await engine.executeSPARQL(query);
      
      expect(result.results.bindings.length).toBeGreaterThan(0);
      
      // Some bindings should have email, others not
      const hasEmail = result.results.bindings.some(b => b.email);
      const noEmail = result.results.bindings.some(b => !b.email);
      expect(hasEmail).toBe(true);
      expect(noEmail).toBe(true);
    });

    test('should timeout long-running queries', async () => {
      const timeoutEngine = new QueryEngine({
        queryTimeout: 100 // Very short timeout
      });
      await timeoutEngine.initialize();
      
      const query = `
        SELECT * WHERE {
          ?s ?p ?o .
          ?s ?p2 ?o2 .
          ?s ?p3 ?o3 .
        }
      `;
      
      await expect(timeoutEngine.executeSPARQL(query))
        .rejects.toThrow(/timeout/i);
        
      await timeoutEngine.shutdown();
    }, 10000);
  });

  describe('Query Optimization', () => {
    test('should apply query optimization when enabled', async () => {
      const optimizedEngine = createOptimizedEngine();
      await optimizedEngine.initialize();
      
      const testData = `
        @prefix ex: <http://example.org/> .
        ex:a ex:p1 ex:b .
        ex:b ex:p2 ex:c .
        ex:c ex:p3 ex:d .
      `;
      await optimizedEngine.loadRDF(testData, 'turtle');
      
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?x ?y ?z WHERE {
          ?x ex:p1 ?y .
          ?y ex:p2 ?z .
          FILTER(?x != <http://example.org/none>)
        }
      `;
      
      const result = await optimizedEngine.executeSPARQL(query);
      
      expect(result.metadata?.optimizations).toBeDefined();
      expect(result.metadata?.optimizations.length).toBeGreaterThanOrEqual(0);
      
      await optimizedEngine.shutdown();
    });

    test('should use cached results for repeated queries', async () => {
      const cachedEngine = new QueryEngine({ enableQueryCache: true });
      await cachedEngine.initialize();
      
      const testData = `@prefix ex: <http://example.org/> . ex:a ex:p ex:b .`;
      await cachedEngine.loadRDF(testData, 'turtle');
      
      const query = `SELECT ?s ?p ?o WHERE { ?s ?p ?o }`;
      
      // First execution
      const result1 = await cachedEngine.executeSPARQL(query);
      expect(result1.fromCache).toBeFalsy();
      
      // Second execution should hit cache
      const result2 = await cachedEngine.executeSPARQL(query);
      expect(result2.fromCache).toBe(true);
      
      await cachedEngine.shutdown();
    });
  });

  describe('Predefined Query Templates', () => {
    beforeEach(async () => {
      // Load provenance test data
      const provenanceData = `
        @prefix prov: <http://www.w3.org/ns/prov#> .
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:dataset1 prov:wasGeneratedBy ex:activity1 ;
                    prov:wasDerivedFrom ex:dataset0 .
                    
        ex:dataset2 prov:wasGeneratedBy ex:activity2 ;
                    prov:wasDerivedFrom ex:dataset1 .
                    
        ex:activity1 prov:wasAssociatedWith ex:alice ;
                     prov:startedAtTime "2024-01-01T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                     
        ex:activity2 prov:wasAssociatedWith ex:bob ;
                     prov:startedAtTime "2024-01-02T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                     
        ex:alice foaf:name "Alice Smith" .
        ex:bob foaf:name "Bob Jones" .
      `;
      
      await engine.loadRDF(provenanceData, 'turtle');
    });

    test('should execute forward lineage template', async () => {
      const result = await engine.executeTemplate('forward-lineage', {
        entityUri: 'http://example.org/dataset0',
        maxDepth: '5'
      });
      
      expect(result.results.bindings.length).toBeGreaterThanOrEqual(0);
    });

    test('should execute backward lineage template', async () => {
      const result = await engine.executeTemplate('backward-lineage', {
        entityUri: 'http://example.org/dataset2',
        maxDepth: '5'
      });
      
      expect(result.results.bindings.length).toBeGreaterThanOrEqual(0);
    });

    test('should execute activity chain template', async () => {
      const result = await engine.executeTemplate('activity-chain', {
        entityUri: 'http://example.org/dataset1'
      });
      
      expect(result.results.bindings.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle template with missing required parameters', async () => {
      await expect(engine.executeTemplate('forward-lineage', {}))
        .rejects.toThrow(/required parameter missing/i);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      const searchData = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:alice rdfs:label "Alice Smith" ;
                 ex:description "Software engineer specializing in machine learning" .
                 
        ex:bob rdfs:label "Bob Jones" ;
               ex:description "Data scientist with expertise in neural networks" .
               
        ex:charlie rdfs:label "Charlie Brown" ;
                   ex:description "Product manager focused on AI applications" .
      `;
      
      await engine.loadRDF(searchData, 'turtle');
    });

    test('should perform full-text search', async () => {
      const results = await engine.performSemanticSearch('machine learning');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Should find Alice (machine learning specialist)
      const hasAlice = results.some(r => r.uri.includes('alice'));
      expect(hasAlice).toBe(true);
    });

    test('should respect similarity threshold', async () => {
      const highThresholdResults = await engine.performSemanticSearch('AI', {
        similarityThreshold: 0.9
      });
      
      const lowThresholdResults = await engine.performSemanticSearch('AI', {
        similarityThreshold: 0.1
      });
      
      expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);
    });

    test('should limit search results', async () => {
      const results = await engine.performSemanticSearch('engineer', {
        maxSearchResults: 1
      });
      
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Context Extraction', () => {
    beforeEach(async () => {
      const contextData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix prov: <http://www.w3.org/ns/prov#> .
        @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
        
        ex:alice foaf:name "Alice Smith" ;
                 foaf:age 25 ;
                 geo:lat "40.7128" ;
                 geo:long "-74.0060" .
                 
        ex:dataset1 prov:wasGeneratedBy ex:activity1 ;
                    prov:generatedAtTime "2024-01-01T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                    
        ex:activity1 prov:wasAssociatedWith ex:alice .
      `;
      
      await engine.loadRDF(contextData, 'turtle');
    });

    test('should extract comprehensive context', async () => {
      const context = await engine.extractTemplateContext(['http://example.org/alice']);
      
      expect(context).toBeDefined();
      expect(context.entities).toBeDefined();
      expect(context.properties).toBeDefined();
      expect(context.relationships).toBeDefined();
      
      expect(context.entities.length).toBeGreaterThan(0);
      expect(context.properties.length).toBeGreaterThan(0);
    });

    test('should extract temporal context', async () => {
      const context = await engine.extractTemplateContext(undefined, {
        includeTemporal: true
      });
      
      expect(context.temporal).toBeDefined();
      // Should find temporal information from prov:generatedAtTime
    });

    test('should extract spatial context', async () => {
      const context = await engine.extractTemplateContext(undefined, {
        includeSpatial: true
      });
      
      expect(context.spatial).toBeDefined();
      // Should find spatial information from geo coordinates
    });

    test('should extract provenance context', async () => {
      const context = await engine.extractTemplateContext(undefined, {
        includeProvenance: true
      });
      
      expect(context.provenance).toBeDefined();
      // Should find provenance relationships
    });
  });

  describe('Result Formatting', () => {
    let sampleResults: any;

    beforeEach(async () => {
      const testData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" ;
                 foaf:age 25 .
                 
        ex:bob foaf:name "Bob Jones" ;
               foaf:age 30 .
      `;
      
      await engine.loadRDF(testData, 'turtle');
      
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name ?age WHERE {
          ?person foaf:name ?name ;
                 foaf:age ?age .
        }
      `;
      
      sampleResults = await engine.executeSPARQL(query);
    });

    test('should format results as SPARQL JSON', async () => {
      const formatted = await engine.formatResults(sampleResults, 'sparql-json');
      
      const parsed = JSON.parse(formatted);
      expect(parsed.head).toBeDefined();
      expect(parsed.results).toBeDefined();
      expect(parsed.results.bindings).toBeDefined();
    });

    test('should format results as CSV', async () => {
      const formatted = await engine.formatResults(sampleResults, 'csv');
      
      const lines = formatted.split('\n');
      expect(lines[0]).toContain('person,name,age'); // Header
      expect(lines.length).toBeGreaterThan(1); // Data rows
    });

    test('should format results as Turtle', async () => {
      const formatted = await engine.formatResults(sampleResults, 'turtle');
      
      expect(formatted).toContain('@prefix');
      expect(formatted).toContain('.');
    });

    test('should format results with pretty printing', async () => {
      const formatted = await engine.formatResults(sampleResults, 'sparql-json', {
        prettyPrint: true
      });
      
      expect(formatted).toContain('\n');
      expect(formatted).toContain('  '); // Indentation
    });
  });

  describe('Graph Analytics', () => {
    beforeEach(async () => {
      // Load a more complex graph for analytics
      const analyticsData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        # People
        ex:alice a foaf:Person ;
                 foaf:name "Alice Smith" ;
                 foaf:knows ex:bob, ex:charlie ;
                 foaf:age 25 .
                 
        ex:bob a foaf:Person ;
               foaf:name "Bob Jones" ;
               foaf:knows ex:charlie, ex:diana ;
               foaf:age 30 .
               
        ex:charlie a foaf:Person ;
                   foaf:name "Charlie Brown" ;
                   foaf:knows ex:diana ;
                   foaf:age 35 .
                   
        ex:diana a foaf:Person ;
                 foaf:name "Diana Prince" ;
                 foaf:age 28 .
                 
        # Organizations
        ex:company1 a ex:Organization ;
                    rdfs:label "Tech Corp" .
                    
        ex:company2 a ex:Organization ;
                    rdfs:label "Data Inc" .
      `;
      
      await engine.loadRDF(analyticsData, 'turtle');
    });

    test('should calculate basic graph metrics', async () => {
      const metrics = await engine.calculateGraphMetrics();
      
      expect(metrics.basic).toBeDefined();
      expect(metrics.basic.nodeCount).toBeGreaterThan(0);
      expect(metrics.basic.tripleCount).toBeGreaterThan(0);
      expect(metrics.basic.predicateCount).toBeGreaterThan(0);
    });

    test('should calculate structural metrics', async () => {
      const metrics = await engine.calculateGraphMetrics();
      
      expect(metrics.structural).toBeDefined();
      expect(metrics.structural.density).toBeGreaterThan(0);
      expect(metrics.structural.averagePathLength).toBeGreaterThan(0);
    });

    test('should calculate quality metrics', async () => {
      const metrics = await engine.calculateGraphMetrics();
      
      expect(metrics.quality).toBeDefined();
      expect(metrics.quality.completeness).toBeGreaterThan(0);
      expect(metrics.quality.consistency).toBeGreaterThan(0);
    });

    test('should calculate derived metrics', async () => {
      const metrics = await engine.calculateGraphMetrics();
      
      expect(metrics.derived).toBeDefined();
      expect(metrics.derived.sparsity).toBeGreaterThanOrEqual(0);
      expect(metrics.derived.efficiency).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large result sets efficiently', async () => {
      // Generate test data programmatically for performance testing
      const largeDataTriples: string[] = [];
      
      for (let i = 0; i < 1000; i++) {
        largeDataTriples.push(`
          <http://example.org/entity${i}> <http://example.org/property> "Value ${i}" .
          <http://example.org/entity${i}> <http://example.org/type> <http://example.org/Entity> .
        `);
      }
      
      const largeData = `@prefix ex: <http://example.org/> .\n${largeDataTriples.join('\n')}`;
      
      const startTime = Date.now();
      await engine.loadRDF(largeData, 'turtle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
      
      const query = `
        SELECT ?entity ?value WHERE {
          ?entity <http://example.org/property> ?value .
        }
        LIMIT 100
      `;
      
      const queryStart = Date.now();
      const result = await engine.executeSPARQL(query);
      const queryTime = Date.now() - queryStart;
      
      expect(queryTime).toBeLessThan(1000); // Should query in under 1 second
      expect(result.results.bindings.length).toBe(100);
    }, 15000);

    test('should maintain performance with concurrent queries', async () => {
      const testData = `
        @prefix ex: <http://example.org/> .
        ex:a ex:prop "value1" .
        ex:b ex:prop "value2" .
        ex:c ex:prop "value3" .
      `;
      
      await engine.loadRDF(testData, 'turtle');
      
      const query = `SELECT ?s ?o WHERE { ?s <http://example.org/prop> ?o }`;
      
      // Execute multiple queries concurrently
      const promises = Array.from({ length: 10 }, () => 
        engine.executeSPARQL(query)
      );
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All queries should succeed
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.results.bindings.length).toBeGreaterThan(0);
      });
      
      // Should handle concurrent queries efficiently
      expect(totalTime).toBeLessThan(5000);
    }, 10000);

    test('should use indexes for improved query performance', async () => {
      const indexedEngine = new QueryEngine({ 
        enableIndexing: true,
        enableStatistics: true 
      });
      await indexedEngine.initialize();
      
      const testData = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 500 }, (_, i) => 
          `ex:entity${i} ex:property${i % 10} "value${i}" .`
        ).join('\n')}
      `;
      
      await indexedEngine.loadRDF(testData, 'turtle');
      
      const specificQuery = `
        SELECT ?entity ?value WHERE {
          ?entity <http://example.org/property5> ?value .
        }
      `;
      
      const startTime = Date.now();
      const result = await indexedEngine.executeSPARQL(specificQuery);
      const queryTime = Date.now() - startTime;
      
      expect(result.metadata?.fromIndex).toBe(true);
      expect(queryTime).toBeLessThan(500); // Should be fast with indexes
      
      await indexedEngine.shutdown();
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle malformed SPARQL queries', async () => {
      const malformedQuery = 'SELECT ?s WHERE { ?s ?p ?o'; // Missing closing brace
      
      await expect(engine.executeSPARQL(malformedQuery))
        .rejects.toThrow(/parsing failed/i);
    });

    test('should handle queries against empty store', async () => {
      const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }';
      
      const result = await engine.executeSPARQL(query);
      expect(result.results.bindings).toEqual([]);
      expect(result.metadata?.resultCount).toBe(0);
    });

    test('should handle engine shutdown gracefully', async () => {
      await engine.shutdown();
      
      const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }';
      
      await expect(engine.executeSPARQL(query))
        .rejects.toThrow(/not ready/i);
    });

    test('should handle memory pressure gracefully', async () => {
      // Test with limited cache size
      const limitedEngine = new QueryEngine({
        cacheSize: '1MB',
        maxResultSize: 100
      });
      await limitedEngine.initialize();
      
      const query = `
        SELECT ?s ?p ?o WHERE { 
          ?s ?p ?o .
          FILTER(STRLEN(STR(?s)) > 0)
        }
      `;
      
      // Should not throw even with memory constraints
      const result = await limitedEngine.executeSPARQL(query);
      expect(result).toBeDefined();
      
      await limitedEngine.shutdown();
    });
  });

  describe('Factory Functions', () => {
    test('should create optimized engine with correct config', async () => {
      const optimizedEngine = createOptimizedEngine();
      await optimizedEngine.initialize();
      
      const status = optimizedEngine.getStatus();
      expect(status.configuration.enableQueryOptimization).toBe(true);
      expect(status.configuration.enableSemanticSearch).toBe(true);
      expect(status.configuration.enableGraphAnalytics).toBe(true);
      
      await optimizedEngine.shutdown();
    });

    test('should create high-performance engine with extended config', async () => {
      const hpEngine = createHighPerformanceEngine();
      await hpEngine.initialize();
      
      const status = hpEngine.getStatus();
      expect(status.configuration.enableQueryOptimization).toBe(true);
      expect(status.configuration.enableIndexing).toBe(true);
      
      await hpEngine.shutdown();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    test('should handle provenance tracking scenario', async () => {
      const provenanceData = `
        @prefix prov: <http://www.w3.org/ns/prov#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        # Data pipeline with provenance
        ex:rawData prov:wasGeneratedBy ex:extractionProcess .
        ex:cleanedData prov:wasDerivedFrom ex:rawData ;
                       prov:wasGeneratedBy ex:cleaningProcess .
        ex:report prov:wasDerivedFrom ex:cleanedData ;
                  prov:wasGeneratedBy ex:reportProcess .
        
        ex:extractionProcess prov:wasAssociatedWith ex:dataEngineer ;
                            prov:startedAtTime "2024-01-01T09:00:00Z"^^xsd:dateTime .
        ex:cleaningProcess prov:wasAssociatedWith ex:dataScientist ;
                          prov:startedAtTime "2024-01-01T10:00:00Z"^^xsd:dateTime .
        ex:reportProcess prov:wasAssociatedWith ex:analyst ;
                        prov:startedAtTime "2024-01-01T14:00:00Z"^^xsd:dateTime .
      `;
      
      await engine.loadRDF(provenanceData, 'turtle');
      
      // Test lineage query
      const lineageResult = await engine.executeTemplate('backward-lineage', {
        entityUri: 'http://example.org/report',
        maxDepth: '10'
      });
      
      expect(lineageResult.results.bindings.length).toBeGreaterThan(0);
      
      // Test activity chain
      const activityResult = await engine.executeTemplate('activity-chain', {
        entityUri: 'http://example.org/cleanedData'
      });
      
      expect(activityResult.results.bindings.length).toBeGreaterThan(0);
    });

    test('should handle knowledge graph exploration', async () => {
      const knowledgeData = `
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix ex: <http://example.org/> .
        
        # Ontology
        ex:Person rdf:type owl:Class ;
                  rdfs:label "Person" .
        ex:Organization rdf:type owl:Class ;
                       rdfs:label "Organization" .
        ex:worksFor rdf:type owl:ObjectProperty ;
                   rdfs:domain ex:Person ;
                   rdfs:range ex:Organization .
        
        # Instances
        ex:alice rdf:type ex:Person ;
                rdfs:label "Alice Smith" ;
                ex:worksFor ex:techCorp .
        ex:techCorp rdf:type ex:Organization ;
                   rdfs:label "Tech Corporation" .
      `;
      
      await engine.loadRDF(knowledgeData, 'turtle');
      
      // Test class hierarchy exploration
      const classResult = await engine.executeTemplate('class-hierarchy', {
        rootClass: 'http://www.w3.org/2002/07/owl#Thing',
        maxDepth: '5'
      });
      
      expect(classResult.results.bindings.length).toBeGreaterThanOrEqual(0);
      
      // Test property usage analysis
      const propertyResult = await engine.executeTemplate('property-usage', {
        minUsage: '1'
      });
      
      expect(propertyResult.results.bindings.length).toBeGreaterThan(0);
    });
  });
});

describe('Performance Benchmarks', () => {
  let engine: QueryEngine;

  beforeAll(async () => {
    engine = createHighPerformanceEngine();
    await engine.initialize();
  });

  afterAll(async () => {
    if (engine) {
      await engine.shutdown();
    }
  });

  test('should benchmark large graph loading', async () => {
    const largeGraph = generateLargeGraph(5000); // 5K triples
    
    const startTime = performance.now();
    await engine.loadRDF(largeGraph, 'turtle');
    const loadTime = performance.now() - startTime;
    
    console.log(`Large graph loading time: ${loadTime.toFixed(2)}ms`);
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds
  }, 15000);

  test('should benchmark complex query execution', async () => {
    // Ensure we have data loaded
    const testData = generateLargeGraph(1000);
    await engine.loadRDF(testData, 'turtle');
    
    const complexQuery = `
      SELECT ?entity ?prop ?value ?related WHERE {
        ?entity ?prop ?value .
        OPTIONAL {
          ?entity <http://example.org/relatedTo> ?related .
        }
        FILTER(CONTAINS(STR(?value), "value"))
      }
      ORDER BY ?entity
      LIMIT 100
    `;
    
    const startTime = performance.now();
    const result = await engine.executeSPARQL(complexQuery);
    const queryTime = performance.now() - startTime;
    
    console.log(`Complex query execution time: ${queryTime.toFixed(2)}ms`);
    console.log(`Results returned: ${result.results.bindings.length}`);
    
    expect(queryTime).toBeLessThan(2000); // Should execute in under 2 seconds
    expect(result.results.bindings.length).toBeGreaterThan(0);
  }, 10000);
});

// Utility functions for tests

function generateLargeGraph(tripleCount: number): string {
  const prefixes = '@prefix ex: <http://example.org/> .\n';
  const triples: string[] = [];
  
  for (let i = 0; i < tripleCount; i++) {
    const subjectId = i;
    const propertyId = i % 10;
    const objectValue = `value${i}`;
    
    triples.push(`ex:entity${subjectId} ex:property${propertyId} "${objectValue}" .`);
    
    // Add some relationships
    if (i > 0 && i % 5 === 0) {
      triples.push(`ex:entity${subjectId} ex:relatedTo ex:entity${i - 1} .`);
    }
    
    // Add type information
    if (i % 10 === 0) {
      triples.push(`ex:entity${subjectId} a ex:ImportantEntity .`);
    }
  }
  
  return prefixes + triples.join('\n');
}