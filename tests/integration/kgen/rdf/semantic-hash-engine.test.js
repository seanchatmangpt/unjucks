/**
 * Semantic Hash Engine Tests
 * 
 * Comprehensive test suite for semantic vs syntactic hashing,
 * RDF canonicalization, and content-addressed storage integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticHashEngine } from '../../../../src/kgen/rdf/semantic-hash-engine.js';
import { ContentAddressedSemanticStore } from '../../../../src/kgen/rdf/content-addressed-semantic-store.js';

describe('SemanticHashEngine', () => {
  let hashEngine;
  
  beforeEach(() => {
    hashEngine = new SemanticHashEngine({
      enableCaching: false // Disable caching for consistent test results
    });
  });
  
  afterEach(async () => {
    await hashEngine.shutdown();
  });

  describe('Semantic Hash Calculation', () => {
    it('should calculate identical semantic hashes for equivalent RDF content', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" .
        ex:alice ex:age 30 .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        
        ex:alice ex:age 30 .
        ex:alice ex:name "Alice" .
      `;
      
      const result1 = await hashEngine.calculateSemanticHash(rdf1);
      const result2 = await hashEngine.calculateSemanticHash(rdf2);
      
      expect(result1.semanticHash).toBe(result2.semanticHash);
      expect(result1.differentiation.type).toBe('semantic');
      expect(result1.differentiation.ignoresSerializationOrder).toBe(true);
    });

    it('should calculate different semantic hashes for different RDF content', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:bob ex:name "Bob" .
      `;
      
      const result1 = await hashEngine.calculateSemanticHash(rdf1);
      const result2 = await hashEngine.calculateSemanticHash(rdf2);
      
      expect(result1.semanticHash).not.toBe(result2.semanticHash);
    });

    it('should normalize blank nodes canonically', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        _:a ex:name "Anonymous" .
        _:a ex:type ex:Person .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        _:xyz ex:type ex:Person .
        _:xyz ex:name "Anonymous" .
      `;
      
      const result1 = await hashEngine.calculateSemanticHash(rdf1);
      const result2 = await hashEngine.calculateSemanticHash(rdf2);
      
      expect(result1.semanticHash).toBe(result2.semanticHash);
      expect(result1.differentiation.ignoresBlankNodeLabels).toBe(true);
    });

    it('should handle multiple blank nodes correctly', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        _:a ex:knows _:b .
        _:b ex:knows _:c .
        _:c ex:knows _:a .
      `;
      
      const result = await hashEngine.calculateSemanticHash(rdf);
      
      expect(result.semanticHash).toBeDefined();
      expect(result.metadata.blankNodeCount).toBe(3);
      expect(result.canonical).toContain('_:b0');
      expect(result.canonical).toContain('_:b1');
      expect(result.canonical).toContain('_:b2');
    });

    it('should include canonical JSON serialization', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice"@en .
        ex:alice ex:age 30 .
      `;
      
      const result = await hashEngine.calculateSemanticHash(rdf);
      
      expect(result.canonicalJson).toBeDefined();
      
      const jsonData = JSON.parse(result.canonicalJson);
      expect(Array.isArray(jsonData)).toBe(true);
      expect(jsonData.length).toBe(2);
      
      // Check structure
      expect(jsonData[0]).toHaveProperty('subject');
      expect(jsonData[0]).toHaveProperty('predicate');
      expect(jsonData[0]).toHaveProperty('object');
    });
  });

  describe('Syntactic Hash Calculation', () => {
    it('should calculate different syntactic hashes for differently formatted RDF', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\n\nex:alice ex:name "Alice" .`;
      
      const result1 = await hashEngine.calculateSyntacticHash(rdf1);
      const result2 = await hashEngine.calculateSyntacticHash(rdf2);
      
      expect(result1.syntacticHash).not.toBe(result2.syntacticHash);
      expect(result1.differentiation.type).toBe('syntactic');
      expect(result1.differentiation.preservesWhitespace).toBe(true);
    });

    it('should calculate identical syntactic hashes for identical RDF strings', async () => {
      const rdf = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`;
      
      const result1 = await hashEngine.calculateSyntacticHash(rdf);
      const result2 = await hashEngine.calculateSyntacticHash(rdf);
      
      expect(result1.syntacticHash).toBe(result2.syntacticHash);
    });

    it('should preserve original content', async () => {
      const rdf = `  @prefix ex: <http://example.org/> .
  ex:alice ex:name "Alice"  .  `;
      
      const result = await hashEngine.calculateSyntacticHash(rdf);
      
      expect(result.rawContent).toBe(rdf);
      expect(result.metadata.contentLength).toBe(rdf.length);
    });
  });

  describe('Hash Differentiation', () => {
    it('should differentiate between semantic and syntactic changes', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`;
      
      const rdf2 = `@prefix ex: <http://example.org/> .

ex:alice ex:name "Alice" .`;
      
      const result = await hashEngine.calculateBothHashes(rdf1);
      
      expect(result.semantic).toBeDefined();
      expect(result.syntactic).toBeDefined();
      expect(result.differentiation).toBeDefined();
      expect(result.comparison).toBeDefined();
    });

    it('should detect purely syntactic changes', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\n\nex:alice ex:name "Alice" .`;
      
      const comparison = await hashEngine.compareGraphs(rdf1, rdf2);
      
      expect(comparison.semanticallyIdentical).toBe(true);
      expect(comparison.syntacticallyIdentical).toBe(false);
      expect(comparison.changeType).toBe('syntactic-only');
      expect(comparison.analysis.meaningPreserved).toBe(true);
      expect(comparison.analysis.formatChanged).toBe(true);
    });

    it('should detect semantic changes', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`;
      
      const rdf2 = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Bob" .`;
      
      const comparison = await hashEngine.compareGraphs(rdf1, rdf2);
      
      expect(comparison.semanticallyIdentical).toBe(false);
      expect(comparison.syntacticallyIdentical).toBe(false);
      expect(comparison.changeType).toBe('semantic');
      expect(comparison.analysis.contentChanged).toBe(true);
    });

    it('should handle identical content', async () => {
      const rdf = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`;
      
      const comparison = await hashEngine.compareGraphs(rdf, rdf);
      
      expect(comparison.semanticallyIdentical).toBe(true);
      expect(comparison.syntacticallyIdentical).toBe(true);
      expect(comparison.changeType).toBe('none');
    });
  });

  describe('C14N Canonicalization', () => {
    it('should produce canonical N-Triples output', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:bob ex:age 25 .
        ex:alice ex:name "Alice" .
        ex:alice ex:age 30 .
      `;
      
      const result = await hashEngine.calculateSemanticHash(rdf);
      
      expect(result.canonical).toMatch(/^<.+> <.+> .+ \.\n/);
      expect(result.canonical.split('\n').length).toBe(4); // 3 triples + empty line
      
      // Should be sorted canonically
      const lines = result.canonical.split('\n').filter(l => l.trim());
      expect(lines[0]).toContain('ex:alice');
      expect(lines[1]).toContain('ex:alice'); 
      expect(lines[2]).toContain('ex:bob');
    });

    it('should handle literals with languages and datatypes', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ex:alice ex:name "Alice"@en .
        ex:alice ex:age "30"^^xsd:integer .
        ex:alice ex:height "5.6"^^xsd:decimal .
      `;
      
      const result = await hashEngine.calculateSemanticHash(rdf);
      
      expect(result.canonical).toContain('@en');
      expect(result.canonical).toContain('^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(result.canonical).toContain('^^<http://www.w3.org/2001/XMLSchema#decimal>');
    });

    it('should handle named graphs', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" ex:graph1 .
        ex:bob ex:name "Bob" ex:graph2 .
      `;
      
      const result = await hashEngine.calculateSemanticHash(rdf);
      
      expect(result.canonical).toContain('<http://example.org/graph1>');
      expect(result.canonical).toContain('<http://example.org/graph2>');
    });
  });

  describe('Performance and Caching', () => {
    it('should maintain performance statistics', async () => {
      const rdf = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .`;
      
      await hashEngine.calculateSemanticHash(rdf);
      await hashEngine.calculateSyntacticHash(rdf);
      await hashEngine.calculateBothHashes(rdf);
      
      const stats = hashEngine.getStats();
      
      expect(stats.semanticHashes).toBeGreaterThan(0);
      expect(stats.syntacticHashes).toBeGreaterThan(0);
      expect(stats.differentiationOps).toBeGreaterThan(0);
      expect(stats.c14nOperations).toBeGreaterThan(0);
    });

    it('should handle large RDF graphs efficiently', async () => {
      // Generate a large RDF graph
      let largeRdf = `@prefix ex: <http://example.org/> .`;
      for (let i = 0; i < 1000; i++) {
        largeRdf += `\nex:person${i} ex:name "Person${i}" .`;
        largeRdf += `\nex:person${i} ex:age ${20 + (i % 60)} .`;
      }
      
      const startTime = performance.now();
      const result = await hashEngine.calculateSemanticHash(largeRdf);
      const processingTime = performance.now() - startTime;
      
      expect(result.semanticHash).toBeDefined();
      expect(result.metadata.quadCount).toBe(2000);
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid RDF gracefully', async () => {
      const invalidRdf = `This is not RDF content`;
      
      await expect(hashEngine.calculateSemanticHash(invalidRdf))
        .rejects.toThrow();
    });

    it('should handle empty RDF content', async () => {
      const emptyRdf = ``;
      
      const result = await hashEngine.calculateSemanticHash(emptyRdf);
      
      expect(result.semanticHash).toBeDefined();
      expect(result.metadata.quadCount).toBe(0);
    });

    it('should handle RDF with only comments and whitespace', async () => {
      const commentOnlyRdf = `
        # This is just a comment
        
        # Another comment
      `;
      
      const result = await hashEngine.calculateSemanticHash(commentOnlyRdf);
      
      expect(result.semanticHash).toBeDefined();
      expect(result.metadata.quadCount).toBe(0);
    });
  });
});

describe('ContentAddressedSemanticStore', () => {
  let store;
  
  beforeEach(() => {
    store = new ContentAddressedSemanticStore({
      enableCaching: false,
      enableProvenance: true
    });
  });
  
  afterEach(async () => {
    await store.shutdown();
  });

  describe('Content Storage', () => {
    it('should store RDF content with semantic addressing', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" .
        ex:alice ex:age 30 .
      `;
      
      const result = await store.store(rdf);
      
      expect(result.success).toBe(true);
      expect(result.semanticCID).toBeDefined();
      expect(result.syntacticCID).toBeDefined();
      expect(result.semanticHash).toBeDefined();
      expect(result.syntacticHash).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.quadCount).toBe(2);
    });

    it('should detect and handle duplicate content', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" .
      `;
      
      const result1 = await store.store(rdf);
      const result2 = await store.store(rdf);
      
      expect(result1.success).toBe(true);
      expect(result2.deduplicated).toBe(true);
      expect(result2.semanticHash).toBe(result1.semanticHash);
    });

    it('should handle semantically equivalent but syntactically different content', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\n\nex:alice ex:name "Alice" .`;
      
      const result1 = await store.store(rdf1);
      const result2 = await store.store(rdf2);
      
      expect(result1.semanticHash).toBe(result2.semanticHash);
      expect(result1.syntacticHash).not.toBe(result2.syntacticHash);
      expect(result2.deduplicated).toBe(true); // Semantic deduplication
    });
  });

  describe('Content Retrieval', () => {
    it('should retrieve content by semantic hash', async () => {
      const rdf = `
        @prefix ex: <http://example.org/> .
        ex:alice ex:name "Alice" .
      `;
      
      const storeResult = await store.store(rdf);
      const retrieveResult = await store.retrieveBySemantic(storeResult.semanticHash);
      
      expect(retrieveResult.content).toBeDefined();
      expect(retrieveResult.metadata).toBeDefined();
      expect(retrieveResult.type).toBe('semantic');
      expect(retrieveResult.metadata.semanticHash).toBe(storeResult.semanticHash);
    });

    it('should retrieve content by syntactic hash', async () => {
      const rdf = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      
      const storeResult = await store.store(rdf);
      const retrieveResult = await store.retrieveBySyntactic(storeResult.syntacticHash);
      
      expect(retrieveResult.content).toBe(rdf);
      expect(retrieveResult.type).toBe('syntactic');
    });

    it('should retrieve content by CID', async () => {
      const rdf = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      
      const storeResult = await store.store(rdf);
      const retrieveResult = await store.retrieveByCID(storeResult.semanticCID);
      
      expect(retrieveResult.content).toBeDefined();
      expect(retrieveResult.cid).toBe(storeResult.semanticCID);
    });

    it('should handle non-existent content gracefully', async () => {
      const fakeHash = 'nonexistent123456789';
      
      await expect(store.retrieveBySemantic(fakeHash))
        .rejects.toThrow('Content not found');
    });
  });

  describe('Semantic Equivalence', () => {
    it('should find semantically equivalent content', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\n\nex:alice ex:name "Alice" .`;
      
      await store.store(rdf1);
      await store.store(rdf2);
      
      const equivalents = await store.findSemanticEquivalents(rdf1);
      
      expect(equivalents.length).toBeGreaterThan(0);
      expect(equivalents[0].equivalenceType).toBe('semantic');
    });

    it('should compare stored content', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\nex:bob ex:name "Bob" .`;
      
      const result1 = await store.store(rdf1);
      const result2 = await store.store(rdf2);
      
      const comparison = await store.compareStored(result1.semanticHash, result2.semanticHash);
      
      expect(comparison.semanticallyIdentical).toBe(false);
      expect(comparison.content1).toBeDefined();
      expect(comparison.content2).toBeDefined();
    });
  });

  describe('Content Listing and Management', () => {
    it('should list stored content with metadata', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const rdf2 = `@prefix ex: <http://example.org/> .\nex:bob ex:name "Bob" .`;
      
      await store.store(rdf1);
      await store.store(rdf2);
      
      const contentList = await store.listContent();
      
      expect(contentList.length).toBeGreaterThanOrEqual(2);
      expect(contentList[0]).toHaveProperty('cid');
      expect(contentList[0]).toHaveProperty('semanticHash');
      expect(contentList[0]).toHaveProperty('timestamp');
      expect(contentList[0]).toHaveProperty('quadCount');
    });

    it('should filter content by quad count', async () => {
      const smallRdf = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      const largeRdf = `@prefix ex: <http://example.org/> .
ex:alice ex:name "Alice" .
ex:alice ex:age 30 .
ex:alice ex:email "alice@example.org" .`;
      
      await store.store(smallRdf);
      await store.store(largeRdf);
      
      const filtered = await store.listContent({ minQuadCount: 2 });
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].quadCount).toBeGreaterThanOrEqual(2);
    });

    it('should limit results', async () => {
      // Store multiple items
      for (let i = 0; i < 5; i++) {
        const rdf = `@prefix ex: <http://example.org/> .\nex:person${i} ex:name "Person${i}" .`;
        await store.store(rdf);
      }
      
      const limited = await store.listContent({ limit: 3 });
      
      expect(limited.length).toBe(3);
    });
  });

  describe('Statistics and Performance', () => {
    it('should maintain comprehensive statistics', async () => {
      const rdf = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      
      const storeResult = await store.store(rdf);
      await store.retrieveBySemantic(storeResult.semanticHash);
      
      const stats = store.getStats();
      
      expect(stats.itemsStored).toBeGreaterThan(0);
      expect(stats.itemsRetrieved).toBeGreaterThan(0);
      expect(stats.indexes).toBeDefined();
      expect(stats.indexes.semantic).toBeGreaterThan(0);
      expect(stats.caches).toBeDefined();
      expect(stats.hashEngine).toBeDefined();
    });

    it('should track provenance when enabled', async () => {
      const rdf = `@prefix ex: <http://example.org/> .\nex:alice ex:name "Alice" .`;
      
      const storeResult = await store.store(rdf, {
        provenanceOptions: { source: 'test-suite' }
      });
      
      const retrieveResult = await store.retrieveBySemantic(storeResult.semanticHash);
      
      expect(retrieveResult.provenance).toBeDefined();
      expect(Array.isArray(retrieveResult.provenance)).toBe(true);
      expect(retrieveResult.provenance[0]).toHaveProperty('operation', 'store');
    });
  });
});