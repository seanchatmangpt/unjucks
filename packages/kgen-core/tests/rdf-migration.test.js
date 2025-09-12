/**
 * Test suite for migrated RDF processing functionality
 * 
 * Verifies deterministic processing, canonical hashing, and semantic operations
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  createRDFProcessor, 
  createBasicRDFProcessor,
  CanonicalRDFProcessor,
  GraphIndexer,
  EnhancedRDFProcessor
} from '../src/rdf/index.js';
import { SemanticProcessor } from '../src/semantic/processor.js';

describe('RDF Migration Tests', () => {
  let processor;

  afterEach(async () => {
    if (processor?.shutdown) {
      await processor.shutdown();
    }
  });

  describe('Basic RDF Processor', () => {
    test('should create basic RDF processor', () => {
      processor = createBasicRDFProcessor();
      expect(processor).toBeDefined();
      expect(typeof processor.parse).toBe('function');
      expect(typeof processor.hash).toBe('function');
      expect(typeof processor.compare).toBe('function');
    });

    test('should parse simple RDF data', async () => {
      processor = createBasicRDFProcessor();
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
      `;
      
      const result = await processor.parse(rdf);
      expect(result.valid).toBe(true);
      expect(result.count).toBe(1);
      expect(result.quads).toHaveLength(1);
    });

    test('should generate deterministic hash', async () => {
      processor = createBasicRDFProcessor();
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
      `;
      
      const hash1 = await processor.hash(rdf);
      const hash2 = await processor.hash(rdf);
      
      expect(hash1.hash).toBe(hash2.hash);
      expect(hash1.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    test('should detect identical graphs', async () => {
      processor = createBasicRDFProcessor();
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
      `;
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
      `;
      
      const comparison = await processor.compare(rdf1, rdf2);
      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toBe(0);
    });

    test('should detect different graphs', async () => {
      processor = createBasicRDFProcessor();
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object1 .
      `;
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object2 .
      `;
      
      const comparison = await processor.compare(rdf1, rdf2);
      expect(comparison.identical).toBe(false);
      expect(comparison.differences).toBe(2); // 1 added, 1 removed
    });
  });

  describe('Enhanced RDF Processor', () => {
    test('should create enhanced RDF processor', () => {
      processor = createRDFProcessor();
      expect(processor).toBeDefined();
      expect(processor.canonicalProcessor).toBeDefined();
      expect(processor.indexer).toBeDefined();
      expect(processor.enhancedProcessor).toBeDefined();
    });

    test('should process graph deterministically', async () => {
      processor = createRDFProcessor();
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:Person a ex:Class .
        ex:john a ex:Person ;
                ex:name "John Doe" .
      `;
      
      const result = await processor.processGraphDeterministic(rdf);
      expect(result.success).toBe(true);
      expect(result.parsing.valid).toBe(true);
      expect(result.parsing.count).toBe(3);
      expect(result.hashing.algorithm).toBe('sha256');
      expect(result.hashing.deterministic).toBe(true);
    });

    test('should compare graphs deterministically', async () => {
      processor = createRDFProcessor();
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:john ex:name "John" .
      `;
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:john ex:name "Jane" .
      `;
      
      const result = await processor.compareGraphsDeterministic(rdf1, rdf2);
      expect(result.success).toBe(true);
      expect(result.identical).toBe(false);
      expect(result.differences).toBe(2);
    });

    test('should query graph semantically', async () => {
      processor = createRDFProcessor();
      const rdf = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        ex:john a ex:Person ;
                ex:name "John Doe" .
        ex:jane a ex:Person ;
                ex:name "Jane Smith" .
      `;
      
      const result = await processor.queryGraphSemantic(rdf, { type: 'http://example.org/Person' });
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });
  });

  describe('Canonical RDF Processor', () => {
    beforeEach(() => {
      processor = new CanonicalRDFProcessor();
    });

    test('should normalize blank nodes deterministically', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        _:blank1 ex:name "Test" .
        _:blank2 ex:related _:blank1 .
      `;
      
      const result = await processor.parseRDF(rdf);
      expect(result.valid).toBe(true);
      expect(result.quads).toHaveLength(2);
      
      const hash = await processor.generateCanonicalHash(result.quads);
      expect(hash.metadata.normalizedBlanks).toBe(2);
    });

    test('should sort triples canonically', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:z ex:prop "value" .
        ex:a ex:prop "value" .
        ex:m ex:prop "value" .
      `;
      
      const result = await processor.parseRDF(rdf);
      const canonicalized = await processor.canonicalizeGraph(result.quads);
      
      // Check that canonical serialization is sorted
      const lines = canonicalized.serialized.split('\n');
      expect(lines[0]).toContain('<http://example.org/a>');
      expect(lines[1]).toContain('<http://example.org/m>');
      expect(lines[2]).toContain('<http://example.org/z>');
    });
  });

  describe('Graph Indexer', () => {
    beforeEach(() => {
      processor = new GraphIndexer();
    });

    test('should index RDF triples efficiently', async () => {
      const quads = await parseRDFForTest(`
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        ex:john a ex:Person ;
                ex:name "John Doe" ;
                ex:age 30 .
      `);
      
      const result = await processor.indexQuads(quads);
      expect(result.success).toBe(true);
      expect(result.indexed).toBe(3);
      
      const summary = processor.getIndexSummary();
      expect(summary.statistics.totalTriples).toBe(3);
      expect(summary.statistics.uniqueSubjects).toBe(1);
      expect(summary.statistics.uniquePredicates).toBe(3);
    });

    test('should support type-based queries', async () => {
      const quads = await parseRDFForTest(`
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        ex:john a ex:Person .
        ex:jane a ex:Person .
        ex:company a ex:Organization .
      `);
      
      await processor.indexQuads(quads);
      
      const results = processor.findByType('http://example.org/Person');
      expect(results.count).toBe(2);
      expect(results.results).toHaveLength(2);
    });

    test('should support full-text search', async () => {
      const quads = await parseRDFForTest(`
        @prefix ex: <http://example.org/> .
        ex:john ex:description "Software engineer working on artificial intelligence" .
        ex:jane ex:description "Data scientist specializing in machine learning" .
      `);
      
      await processor.indexQuads(quads);
      
      const results = processor.searchText('artificial intelligence');
      expect(results.count).toBeGreaterThan(0);
    });
  });

  describe('Semantic Processor', () => {
    beforeEach(async () => {
      processor = new SemanticProcessor();
      await processor.initialize();
    });

    test('should initialize successfully', async () => {
      const status = processor.getStatus();
      expect(status.state).toBe('ready');
      expect(status.inferenceRules).toBeGreaterThan(0);
    });

    test('should load ontologies', async () => {
      const ontologySource = {
        id: 'test-ontology',
        type: 'string',
        content: `
          @prefix ex: <http://example.org/> .
          @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
          ex:Person a rdfs:Class .
          ex:Student rdfs:subClassOf ex:Person .
        `,
        format: 'turtle'
      };
      
      const metadata = await processor.loadOntology(ontologySource);
      expect(metadata.id).toBe('test-ontology');
      
      const status = processor.getStatus();
      expect(status.ontologiesCached).toBe(1);
    });

    test('should perform basic reasoning', async () => {
      const graph = {
        triples: [],
        id: 'test-graph'
      };
      
      const rules = Array.from(processor.inferenceRules.values());
      const result = await processor.performReasoning(graph, rules);
      
      expect(result).toBeDefined();
      expect(result.inferredTriples).toBeDefined();
    });

    test('should validate knowledge graphs', async () => {
      const graph = {
        triples: [],
        entities: []
      };
      
      const constraints = [];
      const report = await processor.validateGraph(graph, constraints);
      
      expect(report.isValid).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.statistics.constraintsChecked).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex RDF processing pipeline', async () => {
      processor = createRDFProcessor();
      
      const rdf = `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Person a rdfs:Class .
        ex:Student rdfs:subClassOf ex:Person .
        ex:Professor rdfs:subClassOf ex:Person .
        
        ex:john a ex:Student ;
                ex:name "John Doe" ;
                ex:studiesAt ex:University .
                
        ex:jane a ex:Professor ;
                ex:name "Jane Smith" ;
                ex:teachesAt ex:University .
      `;
      
      // Test deterministic processing
      const result1 = await processor.processGraphDeterministic(rdf);
      const result2 = await processor.processGraphDeterministic(rdf);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.hashing.hash).toBe(result2.hashing.hash);
      
      // Test semantic querying
      const personQuery = await processor.queryGraphSemantic(rdf, { type: 'http://example.org/Person' });
      expect(personQuery.success).toBe(true);
      
      // Test graph comparison
      const comparison = await processor.compareGraphsDeterministic(rdf, rdf);
      expect(comparison.success).toBe(true);
      expect(comparison.identical).toBe(true);
    });
  });
});

// Helper function to parse RDF for testing
async function parseRDFForTest(rdf) {
  const { Parser } = await import('n3');
  const parser = new Parser();
  
  return new Promise((resolve, reject) => {
    const quads = [];
    parser.parse(rdf, (error, quad, prefixes) => {
      if (error) {
        reject(error);
      } else if (quad) {
        quads.push(quad);
      } else {
        resolve(quads);
      }
    });
  });
}