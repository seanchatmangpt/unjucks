/**
 * Test Suite for Enhanced RDF Processor
 * Validates deterministic graph operations, hashing, normalization, and diffing
 * 
 * @fileoverview Comprehensive test suite for KGEN RDF graph engine
 * @author KGEN Team
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test, describe } from 'node:test';
import assert from 'node:assert';

import { EnhancedRDFProcessor, createEnhancedRDFProcessor } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataDir = join(__dirname, '../../test-data');

describe('EnhancedRDFProcessor', () => {
  
  test('should initialize processor with default config', async () => {
    const processor = new EnhancedRDFProcessor();
    await processor.initialize();
    
    assert.strictEqual(processor.status, 'ready');
    assert.strictEqual(processor.config.deterministic, true);
    assert.strictEqual(processor.config.hashAlgorithm, 'sha256');
    
    await processor.shutdown();
  });

  test('should parse simple Turtle RDF', async () => {
    const processor = await createEnhancedRDFProcessor();
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    
    const result = await processor.parseRDF(simpleRDF, 'turtle');
    
    assert(result.quads.length > 0, 'Should parse quads');
    assert.strictEqual(result.format, 'turtle');
    assert(result.prefixes.ex, 'Should extract ex: prefix');
    
    await processor.shutdown();
  });

  test('should compute deterministic graph hash', async () => {
    const processor = await createEnhancedRDFProcessor();
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(simpleRDF, 'turtle');
    const hash1 = processor.computeGraphHash(parsed.quads);
    const hash2 = processor.computeGraphHash(parsed.quads);
    
    // Hashes should be identical (deterministic)
    assert.strictEqual(hash1.sha256, hash2.sha256);
    assert.strictEqual(hash1.algorithm, 'sha256');
    assert.strictEqual(hash1.tripleCount, parsed.quads.length);
    assert(hash1.canonical, 'Should be canonical');
    
    await processor.shutdown();
  });

  test('should normalize graph for reproducibility', async () => {
    const processor = await createEnhancedRDFProcessor();
    const sampleRDF = readFileSync(join(testDataDir, 'sample.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(sampleRDF, 'turtle');
    const normalized1 = processor.normalizeGraph(parsed.quads);
    const normalized2 = processor.normalizeGraph(parsed.quads);
    
    // Normalizations should be identical
    assert.strictEqual(normalized1.serialization, normalized2.serialization);
    assert.strictEqual(normalized1.triples.length, normalized2.triples.length);
    assert(normalized1.metadata.deterministic, 'Should be deterministic');
    
    await processor.shutdown();
  });

  test('should compute graph diff correctly', async () => {
    const processor = await createEnhancedRDFProcessor();
    
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    const sampleRDF = readFileSync(join(testDataDir, 'sample.ttl'), 'utf8');
    
    const simple = await processor.parseRDF(simpleRDF, 'turtle');
    const sample = await processor.parseRDF(sampleRDF, 'turtle');
    
    const diff = processor.computeGraphDiff(simple.quads, sample.quads);
    
    assert(diff.added.length > 0, 'Should have added triples');
    assert.strictEqual(diff.removed.length, simple.quads.length, 'All simple triples should be removed');
    assert(typeof diff.statistics.similarity === 'number', 'Should compute similarity');
    assert(diff.metadata?.sourceHash, 'Should include metadata');
    
    await processor.shutdown();
  });

  test('should build and query graph index', async () => {
    const processor = await createEnhancedRDFProcessor();
    const sampleRDF = readFileSync(join(testDataDir, 'sample.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(sampleRDF, 'turtle');
    
    const artifactMap = {
      'https://kgen.io/artifact/sample-001': ['/api/users.js', '/tests/users.test.js'],
      'https://kgen.io/template/api-endpoint': ['/templates/api.njk']
    };
    
    const index = processor.buildGraphIndex(parsed.quads, artifactMap);
    
    assert(index.size > 0, 'Should build index');
    
    const entry = processor.getIndexEntry('https://kgen.io/artifact/sample-001');
    assert(entry, 'Should find indexed subject');
    assert(entry.artifacts.has('/api/users.js'), 'Should map to artifact');
    
    const subjects = processor.findSubjectsByArtifact('/api/users.js');
    assert(subjects.length > 0, 'Should find subjects by artifact');
    
    await processor.shutdown();
  });

  test('should handle blank nodes deterministically', async () => {
    const processor = await createEnhancedRDFProcessor();
    const sampleRDF = readFileSync(join(testDataDir, 'sample.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(sampleRDF, 'turtle');
    
    // Parse same content multiple times
    const parsed2 = await processor.parseRDF(sampleRDF, 'turtle');
    
    const hash1 = processor.computeGraphHash(parsed.quads);
    const hash2 = processor.computeGraphHash(parsed2.quads);
    
    // Should produce same hash despite blank nodes
    assert.strictEqual(hash1.sha256, hash2.sha256, 'Blank nodes should be handled deterministically');
    
    await processor.shutdown();
  });

  test('should serialize RDF deterministically', async () => {
    const processor = await createEnhancedRDFProcessor();
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(simpleRDF, 'turtle');
    processor.addQuads(parsed.quads);
    
    const serialized1 = await processor.serializeRDF(null, 'turtle');
    const serialized2 = await processor.serializeRDF(null, 'turtle');
    
    assert.strictEqual(serialized1, serialized2, 'Serialization should be deterministic');
    
    await processor.shutdown();
  });

  test('should execute basic SPARQL queries', async () => {
    const processor = await createEnhancedRDFProcessor();
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(simpleRDF, 'turtle');
    processor.addQuads(parsed.quads);
    
    const selectResult = await processor.query('SELECT * WHERE { ?s ?p ?o } LIMIT 5');
    assert(selectResult.results?.bindings, 'Should return SELECT results');
    
    const askResult = await processor.query('ASK WHERE { ?s ?p ?o }');
    assert(askResult && typeof askResult.boolean === 'boolean', 'Should return ASK result with boolean');
    
    await processor.shutdown();
  });

  test('should provide comprehensive statistics', async () => {
    const processor = await createEnhancedRDFProcessor();
    const sampleRDF = readFileSync(join(testDataDir, 'sample.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(sampleRDF, 'turtle');
    processor.addQuads(parsed.quads);
    
    // Perform some operations to populate metrics
    processor.computeGraphHash();
    processor.normalizeGraph(parsed.quads);
    
    const stats = processor.getStats();
    
    assert(stats.store.totalTriples > 0, 'Should report store stats');
    assert(typeof stats.metrics.hashesComputed === 'number', 'Should track hash metrics');
    assert(typeof stats.metrics.normalizations === 'number', 'Should track normalization metrics');
    assert(stats.deterministic === true, 'Should report deterministic mode');
    
    await processor.shutdown();
  });

  test('should handle errors gracefully', async () => {
    const processor = await createEnhancedRDFProcessor();
    
    // Test invalid RDF
    try {
      await processor.parseRDF('invalid rdf content', 'turtle');
      assert.fail('Should throw parse error');
    } catch (error) {
      assert(error.message, 'Should provide error message');
    }
    
    // Test invalid SPARQL
    try {
      await processor.query('INVALID SPARQL QUERY');
      assert.fail('Should throw query error');
    } catch (error) {
      assert(error.message, 'Should provide error message');
    }
    
    await processor.shutdown();
  });

  test('should perform health checks', async () => {
    const processor = await createEnhancedRDFProcessor();
    
    const health = await processor.healthCheck();
    
    assert.strictEqual(health.status, 'ready');
    assert(typeof health.storeSize === 'number');
    assert(health.metrics);
    assert(health.uptime);
    assert(health.memory);
    
    await processor.shutdown();
  });

  test('should clear store and caches properly', async () => {
    const processor = await createEnhancedRDFProcessor();
    const simpleRDF = readFileSync(join(testDataDir, 'simple.ttl'), 'utf8');
    
    const parsed = await processor.parseRDF(simpleRDF, 'turtle');
    processor.addQuads(parsed.quads);
    
    // Populate caches
    processor.computeGraphHash();
    processor.normalizeGraph(parsed.quads);
    
    assert(processor.store.size > 0, 'Store should have data');
    
    processor.clear();
    
    assert.strictEqual(processor.store.size, 0, 'Store should be empty');
    
    const stats = processor.getStats();
    assert.strictEqual(stats.caches.hashCacheSize, 0, 'Hash cache should be cleared');
    assert.strictEqual(stats.caches.normalizedCacheSize, 0, 'Normalized cache should be cleared');
    
    await processor.shutdown();
  });
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running Enhanced RDF Processor Tests...');
  
  // Note: In a real environment, you would use a proper test runner
  // This is a simplified test execution for demonstration
  console.log('✅ Test suite defined. Use `node --test` to run.');
}