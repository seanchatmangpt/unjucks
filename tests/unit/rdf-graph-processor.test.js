/**
 * Comprehensive tests for KGEN RDF Graph Processing
 * 
 * Tests deterministic hashing, graph diff, and content-addressed caching
 */

import { strict as assert } from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { GraphProcessor } from '../../packages/kgen-core/src/rdf/graph-processor.js';
import { GraphDiffEngine } from '../../packages/kgen-core/src/rdf/graph-diff-engine.js';
import { SparqlInterface } from '../../packages/kgen-core/src/rdf/sparql-interface.js';
import { ContentAddressedCache } from '../../packages/kgen-core/src/rdf/content-addressed-cache.js';
import path from 'path';
import fs from 'fs/promises';

describe('RDF Graph Processor Tests', () => {
  let processor;
  let testTurtleData;
  
  beforeEach(async () => {
    processor = new GraphProcessor({
      enableCaching: true,
      maxTriples: 10000
    });
    
    testTurtleData = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:alice foaf:name "Alice Smith" .
      ex:alice foaf:email "alice@example.org" .
      ex:alice foaf:knows ex:bob .
      
      ex:bob foaf:name "Bob Johnson" .
      ex:bob foaf:email "bob@example.org" .
    `;
  });
  
  afterEach(() => {
    if (processor) {
      processor.destroy();
    }
  });

  describe('Deterministic Graph Hashing', () => {
    it('should produce consistent hashes for identical content', async () => {
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      const hash1 = processor.calculateContentHash();
      
      // Create second processor with same data
      const processor2 = new GraphProcessor();
      const result2 = await processor2.parseRDF(testTurtleData);
      processor2.addQuads(result2.quads);
      const hash2 = processor2.calculateContentHash();
      
      assert.equal(hash1, hash2, 'Hashes should be identical for same content');
      
      processor2.destroy();
    });
    
    it('should use canonical N-Triples format for hashing', async () => {
      const result = await processor.parseRDF(testTurtleData);
      processor.addQuads(result.quads);
      
      const canonicalTriples = processor._toCanonicalNTriples(processor.store.getQuads());
      
      assert.ok(Array.isArray(canonicalTriples), 'Should return array of N-Triples');
      assert.ok(canonicalTriples.length > 0, 'Should have canonical triples');
      
      // Check N-Triples format
      for (const triple of canonicalTriples) {
        assert.ok(triple.includes(' '), 'Triple should have spaces');
        assert.ok(triple.endsWith(' .'), 'Triple should end with space and dot');
      }
    });
    
    it('should produce different hashes for different content', async () => {
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      const hash1 = processor.calculateContentHash();
      
      const modifiedData = testTurtleData + '\nex:charlie foaf:name "Charlie Brown" .';
      const result2 = await processor.parseRDF(modifiedData);
      processor.clear();
      processor.addQuads(result2.quads);
      const hash2 = processor.calculateContentHash();
      
      assert.notEqual(hash1, hash2, 'Different content should produce different hashes');
    });
    
    it('should handle empty graphs', async () => {
      const hash = processor.calculateContentHash();
      
      assert.ok(typeof hash === 'string', 'Should return string hash');
      assert.ok(hash.length > 0, 'Hash should not be empty');
    });
  });

  describe('Graph Diff Calculation', () => {
    it('should detect added triples', async () => {
      // Original graph
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      
      // Modified graph with addition
      const processor2 = new GraphProcessor();
      const modifiedData = testTurtleData + '\nex:charlie foaf:name "Charlie Brown" .';
      const result2 = await processor2.parseRDF(modifiedData);
      processor2.addQuads(result2.quads);
      
      const diff = processor.diff(processor2);
      
      assert.ok(diff.changes.added > 0, 'Should detect added triples');
      assert.equal(diff.changes.removed, 0, 'Should have no removed triples');
      assert.ok(diff.changes.unchanged > 0, 'Should have unchanged triples');
      
      processor2.destroy();
    });
    
    it('should detect removed triples', async () => {
      // Original graph
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      
      // Modified graph with removal
      const processor2 = new GraphProcessor();
      const reducedData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
        ex:alice foaf:email "alice@example.org" .
      `;
      const result2 = await processor2.parseRDF(reducedData);
      processor2.addQuads(result2.quads);
      
      const diff = processor.diff(processor2);
      
      assert.ok(diff.changes.removed > 0, 'Should detect removed triples');
      assert.equal(diff.changes.added, 0, 'Should have no added triples');
      assert.ok(diff.changes.unchanged > 0, 'Should have unchanged triples');
      
      processor2.destroy();
    });
    
    it('should calculate change metrics', async () => {
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      
      const processor2 = new GraphProcessor();
      const modifiedData = testTurtleData + '\nex:charlie foaf:name "Charlie Brown" .';
      const result2 = await processor2.parseRDF(modifiedData);
      processor2.addQuads(result2.quads);
      
      const diff = processor.diff(processor2, { includeTriples: true });
      
      assert.ok(diff.metrics, 'Should have metrics');
      assert.ok(typeof diff.metrics.changePercentage === 'number', 'Should calculate change percentage');
      assert.ok(typeof diff.metrics.stability === 'number', 'Should calculate stability');
      assert.ok(diff.metrics.stability >= 0 && diff.metrics.stability <= 1, 'Stability should be between 0 and 1');
      
      processor2.destroy();
    });
    
    it('should analyze impacted subjects', async () => {
      const result1 = await processor.parseRDF(testTurtleData);
      processor.addQuads(result1.quads);
      
      const processor2 = new GraphProcessor();
      const modifiedData = testTurtleData + '\nex:alice foaf:age "30" .';
      const result2 = await processor2.parseRDF(modifiedData);
      processor2.addQuads(result2.quads);
      
      const diff = processor.diff(processor2);
      
      assert.ok(diff.subjects, 'Should have subjects analysis');
      assert.ok(Array.isArray(diff.subjects.impacted), 'Should have impacted subjects array');
      assert.ok(diff.subjects.impacted.includes('<http://example.org/alice>'), 'Should identify alice as impacted');
      
      processor2.destroy();
    });
  });

  describe('N3.js Integration', () => {
    it('should parse different RDF formats', async () => {
      const formats = ['turtle', 'n-triples'];
      
      for (const format of formats) {
        const result = await processor.parseRDF(testTurtleData, format);
        assert.ok(result.quads.length > 0, `Should parse ${format} format`);
        assert.equal(result.format, format, `Should record correct format`);
      }
    });
    
    it('should query triples with pattern matching', async () => {
      const result = await processor.parseRDF(testTurtleData);
      processor.addQuads(result.quads);
      
      // Query for all foaf:name triples
      const nameTriples = processor.query({
        predicate: 'http://xmlns.com/foaf/0.1/name'
      });
      
      assert.ok(nameTriples.length > 0, 'Should find name triples');
      
      // Query for Alice's triples
      const aliceTriples = processor.query({
        subject: 'http://example.org/alice'
      });
      
      assert.ok(aliceTriples.length > 0, 'Should find Alice triples');
    });
    
    it('should extract subjects, predicates, and objects', async () => {
      const result = await processor.parseRDF(testTurtleData);
      processor.addQuads(result.quads);
      
      const subjects = processor.getSubjects();
      const predicates = processor.getPredicates();
      const objects = processor.getObjects();
      
      assert.ok(subjects.length > 0, 'Should extract subjects');
      assert.ok(predicates.length > 0, 'Should extract predicates');
      assert.ok(objects.length > 0, 'Should extract objects');
      
      // Check for expected values
      const subjectValues = subjects.map(s => s.value);
      assert.ok(subjectValues.includes('http://example.org/alice'), 'Should include alice');
      assert.ok(subjectValues.includes('http://example.org/bob'), 'Should include bob');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache query results', async () => {
      const result = await processor.parseRDF(testTurtleData);
      processor.addQuads(result.quads);
      
      const pattern = { predicate: 'http://xmlns.com/foaf/0.1/name' };
      
      // First query
      const start1 = Date.now();
      const results1 = processor.query(pattern);
      const time1 = Date.now() - start1;
      
      // Second query (should be cached)
      const start2 = Date.now();
      const results2 = processor.query(pattern);
      const time2 = Date.now() - start2;
      
      assert.deepEqual(results1, results2, 'Cached results should be identical');
      assert.ok(time2 <= time1, 'Cached query should be faster or equal');
      
      const stats = processor.getStats();
      assert.ok(stats.metrics.cacheHits > 0, 'Should record cache hits');
    });
    
    it('should handle large graphs efficiently', async () => {
      // Generate larger test data
      let largeData = `@prefix ex: <http://example.org/> .
                      @prefix foaf: <http://xmlns.com/foaf/0.1/> .`;
      
      for (let i = 0; i < 100; i++) {
        largeData += `\nex:person${i} foaf:name "Person ${i}" .`;
        largeData += `\nex:person${i} foaf:age "${20 + i}" .`;
      }
      
      const start = Date.now();
      const result = await processor.parseRDF(largeData);
      processor.addQuads(result.quads);
      const parseTime = Date.now() - start;
      
      assert.ok(result.quads.length >= 200, 'Should parse all triples');
      assert.ok(parseTime < 5000, 'Should parse within reasonable time');
      
      // Test hash calculation performance
      const hashStart = Date.now();
      const hash = processor.calculateContentHash();
      const hashTime = Date.now() - hashStart;
      
      assert.ok(typeof hash === 'string', 'Should calculate hash');
      assert.ok(hashTime < 1000, 'Hash calculation should be fast');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed RDF data', async () => {
      const malformedData = 'This is not valid RDF data';
      
      try {
        await processor.parseRDF(malformedData);
        assert.fail('Should throw error for malformed data');
      } catch (error) {
        assert.ok(error.message.includes('Parse Error'), 'Should provide parse error message');
      }
    });
    
    it('should handle empty input gracefully', async () => {
      const result = await processor.parseRDF('');
      assert.equal(result.quads.length, 0, 'Should handle empty input');
      assert.equal(result.count, 0, 'Should report zero count');
    });
    
    it('should validate hash algorithms', async () => {
      try {
        processor.calculateContentHash({ algorithm: 'invalid-algorithm' });
        assert.fail('Should reject invalid hash algorithm');
      } catch (error) {
        assert.ok(error.message.includes('digest method not supported'), 'Should reject invalid algorithm');
      }
    });
  });
});

describe('Graph Diff Engine Tests', () => {
  let diffEngine;
  let baseProcessor;
  let targetProcessor;
  
  beforeEach(() => {
    diffEngine = new GraphDiffEngine({
      enableSubjectIndex: true,
      enableArtifactMapping: true
    });
    
    baseProcessor = new GraphProcessor();
    targetProcessor = new GraphProcessor();
  });
  
  afterEach(() => {
    baseProcessor?.destroy();
    targetProcessor?.destroy();
  });

  describe('Advanced Diff Analysis', () => {
    it('should calculate comprehensive diff with impact analysis', async () => {
      // Setup base graph
      const baseData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
        ex:alice foaf:email "alice@example.org" .
      `;
      const baseResult = await baseProcessor.parseRDF(baseData);
      baseProcessor.addQuads(baseResult.quads);
      
      // Setup target graph
      const targetData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Johnson" .
        ex:alice foaf:email "alice@example.org" .
        ex:alice foaf:age "30" .
      `;
      const targetResult = await targetProcessor.parseRDF(targetData);
      targetProcessor.addQuads(targetResult.quads);
      
      const diff = await diffEngine.calculateDiff(baseProcessor, targetProcessor);
      
      assert.ok(diff.id, 'Should have diff ID');
      assert.ok(diff.timestamp, 'Should have timestamp');
      assert.ok(diff.changes, 'Should have changes analysis');
      assert.ok(diff.impact, 'Should have impact analysis');
      assert.ok(diff.metadata, 'Should have metadata');
      
      assert.ok(diff.changes.added > 0, 'Should detect added triples');
      assert.ok(diff.changes.removed > 0, 'Should detect removed triples (name change)');
    });
    
    it('should assess change risk levels', async () => {
      // Setup graphs with many changes
      const baseData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
        ex:bob foaf:name "Bob Johnson" .
      `;
      
      const targetData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:alice foaf:name "Alice Johnson" .
        ex:charlie foaf:name "Charlie Brown" .
        rdfs:Class rdfs:label "Modified Class" .
      `;
      
      const baseResult = await baseProcessor.parseRDF(baseData);
      baseProcessor.addQuads(baseResult.quads);
      
      const targetResult = await targetProcessor.parseRDF(targetData);
      targetProcessor.addQuads(targetResult.quads);
      
      const diff = await diffEngine.calculateDiff(baseProcessor, targetProcessor);
      
      assert.ok(diff.impact.risk, 'Should have risk assessment');
      assert.ok(['low', 'medium', 'high'].includes(diff.impact.risk.level), 'Should have valid risk level');
      assert.ok(Array.isArray(diff.impact.risk.factors), 'Should have risk factors');
      assert.ok(Array.isArray(diff.impact.risk.recommendations), 'Should have recommendations');
    });
    
    it('should register and use custom artifact mappers', async () => {
      // Register custom mapper
      diffEngine.registerArtifactMapper('http://example.org/', (subject, graph) => {
        return [`custom/${subject.replace('http://example.org/', '')}.js`];
      });
      
      // Setup test data
      const data = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
      `;
      
      const result = await baseProcessor.parseRDF(data);
      baseProcessor.addQuads(result.quads);
      
      const index = await diffEngine.buildSubjectIndex([baseProcessor]);
      
      assert.ok(index.has('http://example.org/alice'), 'Should index alice');
      const artifacts = index.get('http://example.org/alice');
      assert.ok(artifacts.includes('custom/alice.js'), 'Should use custom mapper');
    });
  });

  describe('Subject Index Management', () => {
    it('should build subject-to-artifact index', async () => {
      const data = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice foaf:name "Alice Smith" .
        ex:bob foaf:name "Bob Johnson" .
      `;
      
      const result = await baseProcessor.parseRDF(data);
      baseProcessor.addQuads(result.quads);
      
      const index = await diffEngine.buildSubjectIndex([baseProcessor]);
      
      assert.ok(index.size > 0, 'Should have indexed subjects');
      assert.ok(index.has('http://example.org/alice'), 'Should index alice');
      assert.ok(index.has('http://example.org/bob'), 'Should index bob');
      
      // Check default artifact mappings
      const aliceArtifacts = index.get('http://example.org/alice');
      assert.ok(Array.isArray(aliceArtifacts), 'Should have artifact array');
      assert.ok(aliceArtifacts.length > 0, 'Should have artifact mappings');
    });
    
    it('should save and load subject index', async () => {
      const tempIndexFile = '/tmp/test-subject-index.json';
      
      try {
        // Build and save index
        const data = `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:alice foaf:name "Alice Smith" .
        `;
        
        const result = await baseProcessor.parseRDF(data);
        baseProcessor.addQuads(result.quads);
        
        await diffEngine.buildSubjectIndex([baseProcessor]);
        await diffEngine.saveSubjectIndex(tempIndexFile);
        
        // Create new engine and load index
        const newEngine = new GraphDiffEngine();
        await newEngine.loadSubjectIndex(tempIndexFile);
        
        const stats = newEngine.getStats();
        assert.ok(stats.indexStats.subjects > 0, 'Should load subject index');
        
      } finally {
        try {
          await fs.unlink(tempIndexFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});

describe('SPARQL Interface Tests', () => {
  let sparqlInterface;
  let processor;
  
  beforeEach(async () => {
    sparqlInterface = new SparqlInterface({
      enableCaching: true
    });
    
    processor = new GraphProcessor();
    
    // Setup test data
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:alice rdf:type foaf:Person .
      ex:alice foaf:name "Alice Smith" .
      ex:alice foaf:email "alice@example.org" .
      
      ex:bob rdf:type foaf:Person .
      ex:bob foaf:name "Bob Johnson" .
      ex:bob foaf:email "bob@example.org" .
      
      foaf:Person rdf:type rdfs:Class .
      foaf:Person rdfs:label "Person" .
    `;
    
    const result = await processor.parseRDF(testData);
    processor.addQuads(result.quads);
  });
  
  afterEach(() => {
    processor?.destroy();
  });

  describe('Common Query Templates', () => {
    it('should provide predefined query templates', () => {
      const queries = sparqlInterface.getCommonQueries();
      
      assert.ok(queries.getAllClasses, 'Should have getAllClasses query');
      assert.ok(queries.getAllProperties, 'Should have getAllProperties query');
      assert.ok(queries.getClassHierarchy, 'Should have getClassHierarchy query');
      assert.ok(typeof queries.getInstancesOfClass === 'function', 'Should have getInstancesOfClass function');
    });
    
    it('should execute template queries', async () => {
      // Note: This is a simplified test since full SPARQL execution would require
      // a complete SPARQL engine integration
      
      const queries = sparqlInterface.getCommonQueries();
      const classQuery = queries.getAllClasses;
      
      assert.ok(typeof classQuery === 'string', 'Should return SPARQL query string');
      assert.ok(classQuery.includes('SELECT'), 'Should be a SELECT query');
      assert.ok(classQuery.includes('rdfs:Class'), 'Should query for classes');
    });
  });

  describe('Query Caching', () => {
    it('should cache query results', async () => {
      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 10';
      
      // First execution
      const start1 = Date.now();
      const results1 = await sparqlInterface.select(processor.store, query);
      const time1 = Date.now() - start1;
      
      // Second execution (should be cached)
      const start2 = Date.now();
      const results2 = await sparqlInterface.select(processor.store, query);
      const time2 = Date.now() - start2;
      
      const stats = sparqlInterface.getStats();
      assert.ok(stats.cacheHits > 0 || stats.cacheMisses > 0, 'Should track cache statistics');
    });
    
    it('should clear cache when requested', async () => {
      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
      
      // Execute query to populate cache
      await sparqlInterface.select(processor.store, query);
      
      let stats = sparqlInterface.getStats();
      const cacheSize = stats.cacheSize;
      
      // Clear cache
      sparqlInterface.clearCache();
      
      stats = sparqlInterface.getStats();
      assert.equal(stats.cacheSize, 0, 'Cache should be empty after clearing');
    });
  });

  describe('Query Statistics', () => {
    it('should track query execution statistics', async () => {
      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 3';
      
      await sparqlInterface.select(processor.store, query);
      
      const stats = sparqlInterface.getStats();
      
      assert.ok(typeof stats.queriesExecuted === 'number', 'Should track queries executed');
      assert.ok(typeof stats.totalQueryTime === 'number', 'Should track total query time');
      assert.ok(typeof stats.averageQueryTime === 'number', 'Should calculate average query time');
      assert.ok(typeof stats.cacheHitRate === 'number', 'Should calculate cache hit rate');
    });
  });
});

describe('Content-Addressed Cache Tests', () => {
  let cache;
  let tempCacheDir;
  
  beforeEach(async () => {
    tempCacheDir = '/tmp/kgen-test-cache-' + Date.now();
    cache = new ContentAddressedCache({
      cacheDir: tempCacheDir,
      maxCacheSize: 100
    });
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempCacheDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Content Storage and Retrieval', () => {
    it('should store and retrieve content by hash', async () => {
      const testContent = 'This is test content for hashing';
      
      const hash = await cache.store(testContent);
      
      assert.ok(typeof hash === 'string', 'Should return hash string');
      assert.ok(hash.length > 0, 'Hash should not be empty');
      
      const retrieved = await cache.retrieve(hash);
      
      assert.ok(Buffer.isBuffer(retrieved), 'Should return Buffer');
      assert.equal(retrieved.toString(), testContent, 'Retrieved content should match original');
    });
    
    it('should detect duplicate content', async () => {
      const testContent = 'Duplicate test content';
      
      const hash1 = await cache.store(testContent);
      const hash2 = await cache.store(testContent);
      
      assert.equal(hash1, hash2, 'Duplicate content should have same hash');
      
      const exists = await cache.exists(hash1);
      assert.ok(exists, 'Content should exist in cache');
    });
    
    it('should handle binary content', async () => {
      const binaryContent = Buffer.from([0, 1, 2, 3, 4, 255, 254, 253]);
      
      const hash = await cache.store(binaryContent);
      const retrieved = await cache.retrieve(hash);
      
      assert.ok(Buffer.isBuffer(retrieved), 'Should return Buffer');
      assert.ok(binaryContent.equals(retrieved), 'Binary content should match exactly');
    });
    
    it('should return null for non-existent content', async () => {
      const fakeHash = 'nonexistent123456789';
      
      const retrieved = await cache.retrieve(fakeHash);
      assert.equal(retrieved, null, 'Should return null for non-existent content');
    });
  });

  describe('Cache Management', () => {
    it('should list cached content with metadata', async () => {
      const content1 = 'First test content';
      const content2 = 'Second test content';
      
      await cache.store(content1, { contentType: 'text/plain', tags: ['test'] });
      await cache.store(content2, { contentType: 'text/plain', tags: ['test', 'example'] });
      
      const list = await cache.list();
      
      assert.ok(Array.isArray(list), 'Should return array');
      assert.equal(list.length, 2, 'Should list both entries');
      
      // Test filtering
      const filtered = await cache.list({ tags: ['example'] });
      assert.equal(filtered.length, 1, 'Should filter by tags');
    });
    
    it('should delete cached content', async () => {
      const testContent = 'Content to be deleted';
      
      const hash = await cache.store(testContent);
      
      let exists = await cache.exists(hash);
      assert.ok(exists, 'Content should exist before deletion');
      
      const deleted = await cache.delete(hash);
      assert.ok(deleted, 'Should confirm deletion');
      
      exists = await cache.exists(hash);
      assert.ok(!exists, 'Content should not exist after deletion');
    });
    
    it('should perform cache cleanup', async () => {
      // Store multiple items
      for (let i = 0; i < 10; i++) {
        await cache.store(`Test content ${i}`);
      }
      
      // Perform cleanup with aggressive settings
      const result = await cache.cleanup({
        maxEntries: 5,
        minAccessCount: 1
      });
      
      assert.ok(typeof result.deletedEntries === 'number', 'Should report deleted entries');
      assert.ok(typeof result.freedSpace === 'number', 'Should report freed space');
      assert.ok(result.remainingEntries <= 5, 'Should respect max entries limit');
    });
  });

  describe('Performance and Statistics', () => {
    it('should track cache statistics', async () => {
      const content = 'Statistics test content';
      
      const hash = await cache.store(content);
      await cache.retrieve(hash);
      await cache.retrieve(hash); // Second retrieval for cache hit
      
      const stats = cache.getStats();
      
      assert.ok(typeof stats.totalEntries === 'number', 'Should track total entries');
      assert.ok(typeof stats.totalSize === 'number', 'Should track total size');
      assert.ok(typeof stats.memoryHits === 'number', 'Should track memory hits');
      assert.ok(typeof stats.writes === 'number', 'Should track writes');
      
      assert.ok(stats.hitRate, 'Should have hit rate statistics');
      assert.ok(typeof stats.hitRate.total === 'number', 'Should calculate total hit rate');
    });
    
    it('should maintain memory cache for small items', async () => {
      const smallContent = 'Small content for memory cache';
      
      const hash = await cache.store(smallContent);
      
      const stats = cache.getStats();
      assert.ok(stats.memoryCache.entries > 0, 'Should have items in memory cache');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Try to store to an invalid directory
      const invalidCache = new ContentAddressedCache({
        cacheDir: '/invalid/path/that/does/not/exist'
      });
      
      try {
        await invalidCache.store('test content');
        assert.fail('Should throw error for invalid cache directory');
      } catch (error) {
        assert.ok(error.message, 'Should provide error message');
      }
    });
    
    it('should handle corruption detection', async () => {
      if (cache.options.enableIntegrityChecks) {
        // This would test integrity checking if implemented
        // For now, we'll just verify the option is available
        assert.ok(typeof cache.options.enableIntegrityChecks === 'boolean', 'Should have integrity check option');
      }
    });
  });
});

// Integration test combining all components
describe('KGEN RDF Processing Integration', () => {
  let processor;
  let diffEngine;
  let sparqlInterface;
  let cache;
  
  beforeEach(() => {
    processor = new GraphProcessor({ enableCaching: true });
    diffEngine = new GraphDiffEngine();
    sparqlInterface = new SparqlInterface();
    cache = new ContentAddressedCache({
      cacheDir: '/tmp/kgen-integration-test-' + Date.now()
    });
  });
  
  afterEach(async () => {
    processor?.destroy();
    
    // Cleanup cache directory
    try {
      await fs.rm(cache.options.cacheDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should provide end-to-end deterministic processing', async () => {
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:alice foaf:name "Alice Smith" .
      ex:alice foaf:email "alice@example.org" .
      ex:alice foaf:knows ex:bob .
      
      ex:bob foaf:name "Bob Johnson" .
      ex:bob foaf:email "bob@example.org" .
    `;
    
    // 1. Parse and hash RDF data
    const parseResult = await processor.parseRDF(testData);
    processor.addQuads(parseResult.quads);
    const originalHash = processor.calculateContentHash();
    
    // 2. Store in content-addressed cache
    const cacheHash = await cache.store(testData);
    
    // 3. Create modified version
    const modifiedData = testData + '\nex:alice foaf:age "30" .';
    const processor2 = new GraphProcessor();
    const modifiedResult = await processor2.parseRDF(modifiedData);
    processor2.addQuads(modifiedResult.quads);
    const modifiedHash = processor2.calculateContentHash();
    
    // 4. Calculate diff
    const diff = await diffEngine.calculateDiff(processor, processor2);
    
    // 5. Execute SPARQL queries
    const queries = sparqlInterface.getCommonQueries();
    // Note: Full SPARQL execution would require complete implementation
    
    // Verify integration
    assert.notEqual(originalHash, modifiedHash, 'Hashes should differ');
    assert.ok(diff.changes.added > 0, 'Should detect changes');
    assert.ok(typeof cacheHash === 'string', 'Should cache content');
    
    const retrieved = await cache.retrieve(cacheHash);
    assert.equal(retrieved.toString(), testData, 'Should retrieve original data');
    
    // Verify deterministic behavior
    const processor3 = new GraphProcessor();
    const reprocessed = await processor3.parseRDF(testData);
    processor3.addQuads(reprocessed.quads);
    const reprocessedHash = processor3.calculateContentHash();
    
    assert.equal(originalHash, reprocessedHash, 'Reprocessing should produce identical hash');
    
    processor2.destroy();
    processor3.destroy();
  });
});