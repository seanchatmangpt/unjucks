/**
 * Unit tests for Graph Processor
 * Tests RDF graph processing, manipulation, and analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GraphProcessor } from '../../../src/graph/processor.js';
import { Parser } from 'n3';

describe('GraphProcessor', () => {
  let processor;
  let mockConfig;
  let sampleTurtle;
  let complexTurtle;

  beforeEach(() => {
    mockConfig = {
      enableValidation: true,
      enableInference: true,
      maxGraphSize: 10000
    };
    
    processor = new GraphProcessor(mockConfig);
    
    // Load test fixtures
    sampleTurtle = readFileSync(
      resolve(__TEST_FIXTURES__, 'graphs', 'simple-person.ttl'), 
      'utf-8'
    );
    complexTurtle = readFileSync(
      resolve(__TEST_FIXTURES__, 'graphs', 'complex-hierarchy.ttl'), 
      'utf-8'
    );
  });

  describe('constructor', () => {
    it('should create processor with default configuration', () => {
      const defaultProcessor = new GraphProcessor();
      
      expect(defaultProcessor.config.enableValidation).toBe(true);
      expect(defaultProcessor.config.maxGraphSize).toBe(100000);
    });

    it('should merge custom configuration', () => {
      expect(processor.config.enableValidation).toBe(true);
      expect(processor.config.enableInference).toBe(true);
      expect(processor.config.maxGraphSize).toBe(10000);
    });
  });

  describe('parseRDF', () => {
    it('should parse valid Turtle successfully', async () => {
      const result = await processor.parseRDF(sampleTurtle, 'text/turtle');
      
      expect(result.success).toBe(true);
      expect(result.triples).toBeDefined();
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
    });

    it('should parse complex hierarchical data', async () => {
      const result = await processor.parseRDF(complexTurtle, 'text/turtle');
      
      expect(result.success).toBe(true);
      expect(result.triples.length).toBeGreaterThan(10);
      expect(result.stats.subjectCount).toBeGreaterThan(5);
      expect(result.stats.predicateCount).toBeGreaterThan(3);
    });

    it('should handle JSON-LD format', async () => {
      const jsonLd = {
        '@context': { 'name': 'http://xmlns.com/foaf/0.1/name' },
        '@id': 'http://example.org/person1',
        'name': 'Test Person'
      };
      
      const result = await processor.parseRDF(JSON.stringify(jsonLd), 'application/ld+json');
      
      expect(result.success).toBe(true);
      expect(result.triples.length).toBeGreaterThan(0);
    });

    it('should reject malformed RDF', async () => {
      const malformedTurtle = '@prefix ex: <http://example.org/> . ex:subject ex:predicate';
      
      const result = await processor.parseRDF(malformedTurtle, 'text/turtle');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate graph size limits', async () => {
      processor.config.maxGraphSize = 5; // Very small limit
      
      const result = await processor.parseRDF(complexTurtle, 'text/turtle');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum size');
    });
  });

  describe('validateGraph', () => {
    let graph;
    
    beforeEach(async () => {
      const parseResult = await processor.parseRDF(sampleTurtle, 'text/turtle');
      graph = parseResult.graph;
    });

    it('should validate well-formed graph', async () => {
      const result = await processor.validateGraph(graph);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeDefined();
    });

    it('should detect structural issues', async () => {
      // Create graph with dangling references
      const parser = new Parser();
      const badTriples = parser.parse('@prefix ex: <http://example.org/> . ex:subject ex:predicate ex:nonexistent .');
      
      const result = await processor.validateGraph({ triples: badTriples });
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate against SHACL shapes when provided', async () => {
      const shapes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass foaf:Person ;
          sh:property [
            sh:path foaf:name ;
            sh:minCount 1 ;
            sh:datatype xsd:string
          ] .
      `;
      
      const result = await processor.validateGraph(graph, shapes);
      
      expect(result.valid).toBe(true);
      expect(result.shapesValidation).toBeDefined();
    });
  });

  describe('computeGraphDiff', () => {
    let graph1, graph2;
    
    beforeEach(async () => {
      const result1 = await processor.parseRDF(sampleTurtle, 'text/turtle');
      graph1 = result1.graph;
      
      // Create modified version
      const modifiedTurtle = sampleTurtle.replace('John Doe', 'Jane Doe');
      const result2 = await processor.parseRDF(modifiedTurtle, 'text/turtle');
      graph2 = result2.graph;
    });

    it('should compute accurate graph diff', async () => {
      const diff = await processor.computeGraphDiff(graph1, graph2);
      
      expect(diff.added).toBeDefined();
      expect(diff.removed).toBeDefined();
      expect(diff.modified).toBeDefined();
      expect(diff.unchanged).toBeDefined();
    });

    it('should detect added triples', async () => {
      const extendedTurtle = sampleTurtle + '\nex:person1 foaf:phone "123-456-7890" .';
      const result = await processor.parseRDF(extendedTurtle, 'text/turtle');
      const extendedGraph = result.graph;
      
      const diff = await processor.computeGraphDiff(graph1, extendedGraph);
      
      expect(diff.added.length).toBe(1);
      expect(diff.added[0].predicate.value).toContain('phone');
    });

    it('should detect removed triples', async () => {
      const reducedTurtle = sampleTurtle.replace(/ex:person1 foaf:email[^.]+\./g, '');
      const result = await processor.parseRDF(reducedTurtle, 'text/turtle');
      const reducedGraph = result.graph;
      
      const diff = await processor.computeGraphDiff(graph1, reducedGraph);
      
      expect(diff.removed.length).toBe(1);
      expect(diff.removed[0].predicate.value).toContain('email');
    });

    it('should provide diff statistics', async () => {
      const diff = await processor.computeGraphDiff(graph1, graph2);
      
      expect(diff.statistics).toBeDefined();
      expect(diff.statistics.totalTriples).toBeGreaterThan(0);
      expect(diff.statistics.addedCount).toBeDefined();
      expect(diff.statistics.removedCount).toBeDefined();
      expect(diff.statistics.modifiedCount).toBeDefined();
    });

    it('should handle identical graphs', async () => {
      const diff = await processor.computeGraphDiff(graph1, graph1);
      
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
      expect(diff.unchanged.length).toBeGreaterThan(0);
    });
  });

  describe('inferTriples', () => {
    let graph;
    
    beforeEach(async () => {
      const result = await processor.parseRDF(complexTurtle, 'text/turtle');
      graph = result.graph;
    });

    it('should perform basic inference', async () => {
      const inferred = await processor.inferTriples(graph);
      
      expect(inferred.success).toBe(true);
      expect(inferred.inferredTriples).toBeDefined();
      expect(inferred.inferredTriples.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle transitive relationships', async () => {
      const result = await processor.inferTriples(graph, {
        rules: ['transitivity'],
        properties: ['http://www.w3.org/2004/02/skos/core#broader']
      });
      
      expect(result.success).toBe(true);
      if (result.inferredTriples.length > 0) {
        expect(result.inferredTriples[0]).toHaveProperty('subject');
        expect(result.inferredTriples[0]).toHaveProperty('predicate');
        expect(result.inferredTriples[0]).toHaveProperty('object');
      }
    });

    it('should respect inference limits', async () => {
      const result = await processor.inferTriples(graph, {
        maxInferences: 5
      });
      
      expect(result.inferredTriples.length).toBeLessThanOrEqual(5);
    });
  });

  describe('extractSubgraph', () => {
    let graph;
    
    beforeEach(async () => {
      const result = await processor.parseRDF(complexTurtle, 'text/turtle');
      graph = result.graph;
    });

    it('should extract subgraph by subject', async () => {
      const subgraph = await processor.extractSubgraph(graph, {
        subjects: ['http://example.org/ChildConcept1']
      });
      
      expect(subgraph.triples.length).toBeGreaterThan(0);
      expect(subgraph.triples.length).toBeLessThan(graph.triples.length);
    });

    it('should extract subgraph by predicate', async () => {
      const subgraph = await processor.extractSubgraph(graph, {
        predicates: ['http://www.w3.org/2004/02/skos/core#prefLabel']
      });
      
      expect(subgraph.triples.length).toBeGreaterThan(0);
      subgraph.triples.forEach(triple => {
        expect(triple.predicate.value).toBe('http://www.w3.org/2004/02/skos/core#prefLabel');
      });
    });

    it('should extract subgraph with depth limit', async () => {
      const subgraph = await processor.extractSubgraph(graph, {
        startNodes: ['http://example.org/RootConcept'],
        maxDepth: 2
      });
      
      expect(subgraph.triples.length).toBeGreaterThan(0);
      expect(subgraph.depth).toBeLessThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should handle null input gracefully', async () => {
      const result = await processor.parseRDF(null, 'text/turtle');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Input cannot be null');
    });

    it('should handle unsupported MIME types', async () => {
      const result = await processor.parseRDF(sampleTurtle, 'text/unsupported');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unsupported MIME type');
    });

    it('should handle memory exhaustion gracefully', async () => {
      // Mock memory limit exceeded
      const originalParseRDF = processor.parseRDF;
      processor.parseRDF = vi.fn().mockRejectedValue(new Error('ENOMEM: out of memory'));
      
      const result = await processor.parseRDF(sampleTurtle, 'text/turtle');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('memory');
      
      // Restore original method
      processor.parseRDF = originalParseRDF;
    });
  });

  describe('performance', () => {
    it('should process large graphs efficiently', async () => {
      const start = Date.now();
      await processor.parseRDF(complexTurtle, 'text/turtle');
      const duration = Date.now() - start;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000);
    });

    it('should provide processing statistics', async () => {
      const result = await processor.parseRDF(sampleTurtle, 'text/turtle');
      
      expect(result.stats).toBeDefined();
      expect(result.stats.processingTime).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
      expect(result.stats.memoryUsage).toBeDefined();
    });
  });

  describe('deterministic behavior', () => {
    it('should produce consistent parsing results', async () => {
      const result1 = await processor.parseRDF(sampleTurtle, 'text/turtle');
      const result2 = await processor.parseRDF(sampleTurtle, 'text/turtle');
      
      expect(result1.triples.length).toBe(result2.triples.length);
      
      // Compare triple content (order may vary)
      const triples1 = result1.triples.map(t => `${t.subject.value} ${t.predicate.value} ${t.object.value}`);
      const triples2 = result2.triples.map(t => `${t.subject.value} ${t.predicate.value} ${t.object.value}`);
      
      expect(triples1.sort()).toEqual(triples2.sort());
    });

    it('should generate consistent diffs for same input', async () => {
      const result1 = await processor.parseRDF(sampleTurtle, 'text/turtle');
      const result2 = await processor.parseRDF(complexTurtle, 'text/turtle');
      
      const diff1 = await processor.computeGraphDiff(result1.graph, result2.graph);
      const diff2 = await processor.computeGraphDiff(result1.graph, result2.graph);
      
      expect(diff1.statistics.addedCount).toBe(diff2.statistics.addedCount);
      expect(diff1.statistics.removedCount).toBe(diff2.statistics.removedCount);
    });
  });
});
