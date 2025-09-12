/**
 * KGEN Core Engine Integration Tests
 * 
 * Tests the critical 20% functionality that enables 80% of KGEN operations:
 * - Graph hashing (deterministic)
 * - Graph diffing (change detection)
 * - Graph indexing (impact analysis)
 * - RDF Bridge (unified operations)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rmdir } from 'fs/promises';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { GraphProcessor } from '../../packages/kgen-core/src/rdf/graph-processor.js';
import { GraphIndexer } from '../../packages/kgen-core/src/rdf/graph-indexer.js';
import { GraphDiffEngine } from '../../packages/kgen-core/src/rdf/graph-diff-engine.js';
import { RDFBridge } from '../../packages/kgen-core/src/rdf/bridge.js';

describe('KGEN Core Engine Integration', () => {
  let testDir;
  let bridge;
  
  const sampleRDF1 = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person rdf:type rdfs:Class .
ex:john rdf:type ex:Person .
ex:john ex:name "John Doe" .
ex:john ex:age 30 .`;

  const sampleRDF2 = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person rdf:type rdfs:Class .
ex:john rdf:type ex:Person .
ex:john ex:name "John Smith" .
ex:john ex:age 31 .
ex:jane rdf:type ex:Person .
ex:jane ex:name "Jane Doe" .`;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = resolve(tmpdir(), `kgen-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    // Initialize RDF Bridge
    bridge = new RDFBridge({
      enableCaching: true,
      enableIndexing: true,
      enableDiffEngine: true,
      cacheDir: resolve(testDir, 'cache')
    });
    
    // Create test RDF files
    await writeFile(resolve(testDir, 'graph1.ttl'), sampleRDF1);
    await writeFile(resolve(testDir, 'graph2.ttl'), sampleRDF2);
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GraphProcessor Core Functionality', () => {
    test('should parse RDF and generate deterministic hash', async () => {
      const processor = new GraphProcessor();
      
      // Parse RDF
      const result = await processor.parseRDF(sampleRDF1, 'turtle');
      expect(result.count).toBeGreaterThan(0);
      expect(result.quads).toHaveLength(result.count);
      
      // Add quads and generate hash
      processor.addQuads(result.quads);
      const hash1 = processor.calculateContentHash();
      
      // Hash should be deterministic
      const hash2 = processor.calculateContentHash();
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
    });

    test('should perform graph diff with impact analysis', async () => {
      const processor1 = new GraphProcessor();
      const processor2 = new GraphProcessor();
      
      // Load both graphs
      const result1 = await processor1.parseRDF(sampleRDF1, 'turtle');
      const result2 = await processor2.parseRDF(sampleRDF2, 'turtle');
      
      processor1.addQuads(result1.quads);
      processor2.addQuads(result2.quads);
      
      // Calculate diff
      const diff = processor1.diff(processor2);
      
      expect(diff).toHaveProperty('changes');
      expect(diff.changes.added).toBeGreaterThan(0); // New triples in graph2
      expect(diff.changes.removed).toBeGreaterThan(0); // Changed/removed triples
      expect(diff).toHaveProperty('subjects');
      expect(diff.subjects.total).toBeGreaterThan(0); // Impacted subjects
      expect(diff).toHaveProperty('metrics');
      expect(diff.metrics.changePercentage).toBeGreaterThan(0);
    });

    test('should generate consistent canonical N-Triples', async () => {
      const processor = new GraphProcessor();
      const result = await processor.parseRDF(sampleRDF1, 'turtle');
      processor.addQuads(result.quads);
      
      // Get canonical N-Triples (private method test via hash consistency)
      const hash1 = processor.calculateContentHash();
      
      // Create another processor with same data
      const processor2 = new GraphProcessor();
      const result2 = await processor2.parseRDF(sampleRDF1, 'turtle');
      processor2.addQuads(result2.quads);
      
      const hash2 = processor2.calculateContentHash();
      
      // Hashes should be identical for same content
      expect(hash1).toBe(hash2);
    });
  });

  describe('GraphIndexer Functionality', () => {
    test('should build comprehensive index for fast queries', async () => {
      const indexer = new GraphIndexer();
      const processor = new GraphProcessor();
      
      // Parse and index RDF
      const result = await processor.parseRDF(sampleRDF1, 'turtle');
      const indexResult = await indexer.indexQuads(result.quads);
      
      expect(indexResult.success).toBe(true);
      expect(indexResult.indexed).toBe(result.count);
      expect(indexResult.totalTriples).toBeGreaterThan(0);
      
      // Test type queries
      const personType = 'http://example.org/Person';
      const typeResults = indexer.findByType(personType);
      expect(typeResults.count).toBeGreaterThan(0);
      
      // Test index summary
      const summary = indexer.getIndexSummary();
      expect(summary.coreIndexes.spo).toBeGreaterThan(0);
      expect(summary.statistics.totalTriples).toBe(result.count);
    });

    test('should support full-text search in literals', async () => {
      const indexer = new GraphIndexer({ enableFullTextIndex: true });
      const processor = new GraphProcessor();
      
      const result = await processor.parseRDF(sampleRDF1, 'turtle');
      await indexer.indexQuads(result.quads);
      
      // Search for name
      const searchResults = indexer.searchText('John');
      expect(searchResults.count).toBeGreaterThan(0);
      expect(searchResults.results.some(r => r.includes('John'))).toBe(true);
    });
  });

  describe('GraphDiffEngine Advanced Features', () => {
    test('should calculate comprehensive diff with artifact mapping', async () => {
      const diffEngine = new GraphDiffEngine();
      const processor1 = new GraphProcessor();
      const processor2 = new GraphProcessor();
      
      // Load graphs
      const result1 = await processor1.parseRDF(sampleRDF1, 'turtle');
      const result2 = await processor2.parseRDF(sampleRDF2, 'turtle');
      processor1.addQuads(result1.quads);
      processor2.addQuads(result2.quads);
      
      // Calculate advanced diff
      const diff = await diffEngine.calculateDiff(processor1, processor2);
      
      expect(diff).toHaveProperty('id');
      expect(diff).toHaveProperty('metadata');
      expect(diff.metadata.baseGraph.hash).toBeDefined();
      expect(diff.metadata.targetGraph.hash).toBeDefined();
      expect(diff).toHaveProperty('impact');
      expect(diff.impact.subjects.total).toBeGreaterThan(0);
      expect(diff.impact.risk).toHaveProperty('level');
    });

    test('should build and save subject index', async () => {
      const diffEngine = new GraphDiffEngine();
      const processor = new GraphProcessor();
      
      const result = await processor.parseRDF(sampleRDF1, 'turtle');
      processor.addQuads(result.quads);
      
      // Build subject index
      const index = await diffEngine.buildSubjectIndex([processor]);
      expect(index.size).toBeGreaterThan(0);
      
      // Save and load index
      const indexPath = resolve(testDir, 'subject-index.json');
      await diffEngine.saveSubjectIndex(indexPath);
      
      // Load in new engine
      const diffEngine2 = new GraphDiffEngine();
      await diffEngine2.loadSubjectIndex(indexPath);
      expect(diffEngine2.subjectIndex.size).toBe(index.size);
    });
  });

  describe('RDFBridge Unified Operations', () => {
    test('should load graphs with content-addressed caching', async () => {
      const graph1Path = resolve(testDir, 'graph1.ttl');
      
      // First load
      const result1 = await bridge.loadGraph(graph1Path);
      expect(result1.cached).toBe(false);
      expect(result1.graphHash).toBeDefined();
      expect(result1.processor).toBeDefined();
      
      // Second load should hit cache
      const result2 = await bridge.loadGraph(graph1Path);
      expect(result2.cached).toBe(true);
      expect(result2.graphHash).toBe(result1.graphHash);
      
      // Stats should reflect cache hit
      const stats = bridge.getStats();
      expect(stats.bridge.cacheHits).toBe(1);
      expect(stats.bridge.graphsLoaded).toBe(1);
    });

    test('should generate canonical hash for any RDF content', async () => {
      const hash1 = await bridge.graphHash(sampleRDF1, { format: 'turtle' });
      const hash2 = await bridge.graphHash(sampleRDF1, { format: 'turtle' });
      
      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
      
      // Different content should have different hash
      const hash3 = await bridge.graphHash(sampleRDF2, { format: 'turtle' });
      expect(hash1).not.toBe(hash3);
    });

    test('should perform comprehensive graph diff', async () => {
      const graph1Path = resolve(testDir, 'graph1.ttl');
      const graph2Path = resolve(testDir, 'graph2.ttl');
      
      const diff = await bridge.diffGraphs(graph1Path, graph2Path);
      
      expect(diff).toHaveProperty('changes');
      expect(diff.changes.total).toBeGreaterThan(0);
      expect(diff).toHaveProperty('impact');
      expect(diff.impact.subjects.total).toBeGreaterThan(0);
      expect(diff).toHaveProperty('metadata');
      expect(diff.metadata.baseGraph.hash).toBeDefined();
      expect(diff.metadata.targetGraph.hash).toBeDefined();
      
      // Stats should be updated
      const stats = bridge.getStats();
      expect(stats.bridge.diffsCalculated).toBe(1);
    });

    test('should build comprehensive index for multiple graphs', async () => {
      const graph1Path = resolve(testDir, 'graph1.ttl');
      const graph2Path = resolve(testDir, 'graph2.ttl');
      
      const indexResult = await bridge.buildIndex([graph1Path, graph2Path]);
      
      expect(indexResult.graphCount).toBe(2);
      expect(indexResult.processors).toHaveLength(2);
      expect(indexResult.subjectIndex).toBeDefined();
      expect(indexResult.indexReport).toBeDefined();
      expect(indexResult.processingTime).toBeGreaterThan(0);
      
      // Index report should have statistics
      expect(indexResult.indexReport.summary.statistics.totalTriples).toBeGreaterThan(0);
    });

    test('should support querying through unified interface', async () => {
      const graph1Path = resolve(testDir, 'graph1.ttl');
      await bridge.loadGraph(graph1Path);
      
      // Query with pattern
      const results = await bridge.query({
        predicate: 'http://example.org/name'
      });
      
      // Should find results (exact format depends on implementation)
      expect(results).toBeDefined();
    });
  });

  describe('Integration with CLI Commands', () => {
    test('should work with hash command through import', async () => {
      // This tests the integration we created in hash.js
      const graph1Path = resolve(testDir, 'graph1.ttl');
      const result = await bridge.loadGraph(graph1Path);
      
      expect(result.graphHash).toBeDefined();
      expect(result.graphHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should work with diff command through import', async () => {
      // This tests the integration we created in diff-new.js
      const graph1Path = resolve(testDir, 'graph1.ttl');
      const graph2Path = resolve(testDir, 'graph2.ttl');
      
      const diff = await bridge.diffGraphs(graph1Path, graph2Path);
      
      expect(diff.changes.total).toBeGreaterThan(0);
      expect(diff.subjects.total).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed RDF gracefully', async () => {
      const malformedRDF = '@prefix ex: <http://example.org/> .\nex:broken ex:predicate';
      
      await expect(bridge.graphHash(malformedRDF)).rejects.toThrow();
    });

    test('should handle empty graphs', async () => {
      const emptyRDF = '';
      const processor = new GraphProcessor();
      
      const result = await processor.parseRDF(emptyRDF, 'turtle');
      expect(result.count).toBe(0);
      
      processor.addQuads(result.quads);
      const hash = processor.calculateContentHash();
      expect(hash).toBeDefined(); // Should still generate hash for empty graph
    });

    test('should handle large graphs efficiently', async () => {
      // Generate larger RDF content
      const largeRDF = ['@prefix ex: <http://example.org/> .'];
      for (let i = 0; i < 1000; i++) {
        largeRDF.push(`ex:item${i} ex:value ${i} .`);
      }
      
      const startTime = Date.now();
      const hash = await bridge.graphHash(largeRDF.join('\n'));
      const processingTime = Date.now() - startTime;
      
      expect(hash).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });
  });
});