/**
 * Test suite for GraphProcessor module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GraphProcessor } from '../../src/rdf/graph-processor.js';
import { DataFactory } from 'n3';

const { namedNode, literal, quad, defaultGraph } = DataFactory;

describe('GraphProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new GraphProcessor({
      enableCaching: true,
      maxTriples: 10000
    });
  });

  afterEach(() => {
    if (processor) {
      processor.destroy();
    }
  });

  describe('RDF Parsing', () => {
    it('should parse valid Turtle data', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const result = await processor.parseRDF(turtleData, 'turtle');
      
      expect(result.count).toBe(1);
      expect(result.format).toBe('turtle');
      expect(result.quads).toHaveLength(1);
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidData = 'invalid turtle data @#$%';
      
      await expect(processor.parseRDF(invalidData, 'turtle'))
        .rejects
        .toThrow(/RDF Parse Error/);
    });

    it('should parse N-Triples format', async () => {
      const ntriplesData = '<http://example.org/s> <http://example.org/p> "object" .';
      
      const result = await processor.parseRDF(ntriplesData, 'ntriples');
      
      expect(result.count).toBe(1);
      expect(result.format).toBe('ntriples');
    });
  });

  describe('Quad Management', () => {
    it('should add quads to store', () => {
      const testQuad = quad(
        namedNode('http://example.org/s'),
        namedNode('http://example.org/p'),
        literal('test')
      );

      const added = processor.addQuads([testQuad]);
      
      expect(added).toBe(1);
      expect(processor.store.size).toBe(1);
    });

    it('should remove quads from store', () => {
      const testQuad = quad(
        namedNode('http://example.org/s'),
        namedNode('http://example.org/p'),
        literal('test')
      );

      processor.addQuads([testQuad]);
      const removed = processor.removeQuads([testQuad]);
      
      expect(removed).toBe(1);
      expect(processor.store.size).toBe(0);
    });

    it('should handle named graphs', () => {
      const testQuad = quad(
        namedNode('http://example.org/s'),
        namedNode('http://example.org/p'),
        literal('test')
      );

      const added = processor.addQuads([testQuad], 'http://example.org/graph');
      
      expect(added).toBe(1);
      const quads = processor.store.getQuads();
      expect(quads[0].graph.value).toBe('http://example.org/graph');
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      const testQuads = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p1'), literal('o1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p1'), literal('o2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p2'), literal('o3'))
      ];
      processor.addQuads(testQuads);
    });

    it('should query by subject', () => {
      const results = processor.query({ subject: 'http://example.org/s1' });
      
      expect(results).toHaveLength(2);
    });

    it('should query by predicate', () => {
      const results = processor.query({ predicate: 'http://example.org/p1' });
      
      expect(results).toHaveLength(2);
    });

    it('should limit query results', () => {
      const results = processor.query({}, { limit: 1 });
      
      expect(results).toHaveLength(1);
    });

    it('should cache query results', () => {
      // First query
      const pattern = { predicate: 'http://example.org/p1' };
      const results1 = processor.query(pattern);
      
      // Second query should hit cache
      const results2 = processor.query(pattern);
      
      expect(results1).toEqual(results2);
      expect(processor.metrics.cacheHits).toBe(1);
    });
  });

  describe('Content Hashing', () => {
    it('should calculate deterministic content hash', () => {
      const testQuads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o')),
      ];
      processor.addQuads(testQuads);

      const hash1 = processor.calculateContentHash();
      const hash2 = processor.calculateContentHash();
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should produce different hashes for different graphs', () => {
      const quads1 = [quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o'))];
      const quads2 = [quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o'))];

      const hash1 = processor.calculateContentHash(quads1);
      const hash2 = processor.calculateContentHash(quads2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Graph Diffing', () => {
    it('should calculate diff between graphs', () => {
      const processor2 = new GraphProcessor();
      
      const quads1 = [quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o'))];
      const quads2 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o'))
      ];

      processor.addQuads(quads1);
      processor2.addQuads(quads2);

      const diff = processor.diff(processor2);
      
      expect(diff.added).toBe(1);
      expect(diff.removed).toBe(0);
      expect(diff.common).toBe(1);
      
      processor2.destroy();
    });
  });

  describe('Graph Merging', () => {
    it('should merge graphs correctly', () => {
      const processor2 = new GraphProcessor();
      
      const quads1 = [quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1'))];
      const quads2 = [quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2'))];

      processor.addQuads(quads1);
      processor2.addQuads(quads2);

      const result = processor.merge(processor2);
      
      expect(result.merged).toBe(1);
      expect(result.totalQuads).toBe(2);
      expect(processor.store.size).toBe(2);
      
      processor2.destroy();
    });
  });

  describe('Statistics and Health', () => {
    it('should provide comprehensive statistics', () => {
      const testQuads = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p1'), literal('o1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p2'), literal('o2'))
      ];
      processor.addQuads(testQuads);

      const stats = processor.getStats();
      
      expect(stats.totalQuads).toBe(2);
      expect(stats.subjects).toBe(2);
      expect(stats.predicates).toBe(2);
      expect(stats.objects).toBe(2);
      expect(stats.metrics).toBeDefined();
    });

    it('should provide health check information', () => {
      const health = processor.healthCheck();
      
      expect(health.status).toBe('initialized');
      expect(health.storeSize).toBeDefined();
      expect(health.cacheSize).toBeDefined();
      expect(health.metrics).toBeDefined();
    });
  });

  describe('Store Management', () => {
    it('should clear entire store', () => {
      const testQuad = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'));
      processor.addQuads([testQuad]);
      
      processor.clear();
      
      expect(processor.store.size).toBe(0);
    });

    it('should clear specific named graph', () => {
      const quad1 = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('default'));
      const quad2 = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('named'));
      
      processor.addQuads([quad1]);
      processor.addQuads([quad2], 'http://example.org/graph');
      
      processor.clear('http://example.org/graph');
      
      expect(processor.store.size).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      await expect(processor.parseRDF(null, 'turtle'))
        .rejects
        .toThrow();
    });

    it('should track error metrics', async () => {
      try {
        await processor.parseRDF('invalid', 'turtle');
      } catch {
        // Expected error
      }
      
      expect(processor.metrics.parseErrors).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    it('should emit events when quads are added', (done) => {
      processor.on('quads-added', (event) => {
        expect(event.count).toBe(1);
        done();
      });

      const testQuad = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'));
      processor.addQuads([testQuad]);
    });

    it('should emit events when quads are removed', (done) => {
      const testQuad = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'));
      processor.addQuads([testQuad]);

      processor.on('quads-removed', (event) => {
        expect(event.count).toBe(1);
        done();
      });

      processor.removeQuads([testQuad]);
    });
  });
});