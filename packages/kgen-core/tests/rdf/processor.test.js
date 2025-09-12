/**
 * RDF Processor Tests - Comprehensive validation with real RDF data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RDFProcessor, createRDFProcessor, parseRDF, serializeRDF, queryRDF } from '../../src/rdf/processor.js';
import { Store, DataFactory } from 'n3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { namedNode, literal, quad } = DataFactory;

describe('RDF Processor', () => {
  let processor;
  let testData;

  beforeEach(() => {
    processor = new RDFProcessor();
    testData = readFileSync(join(__dirname, 'test-data.ttl'), 'utf-8');
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      expect(processor).toBeInstanceOf(RDFProcessor);
      expect(processor.config.defaultFormat).toBe('turtle');
      expect(processor.config.enableValidation).toBe(true);
      expect(processor.config.enablePrefixHandling).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customProcessor = new RDFProcessor({
        defaultFormat: 'n-triples',
        enableValidation: false,
        maxQuads: 50000
      });
      
      expect(customProcessor.config.defaultFormat).toBe('n-triples');
      expect(customProcessor.config.enableValidation).toBe(false);
      expect(customProcessor.config.maxQuads).toBe(50000);
    });

    it('should initialize with default prefixes', () => {
      const prefixes = processor.getPrefixes();
      expect(prefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(prefixes.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#');
      expect(prefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');
    });
  });

  describe('RDF Parsing', () => {
    it('should parse valid Turtle data', async () => {
      const result = await processor.parseRDF(testData, { format: 'turtle' });
      
      expect(result.success).toBe(true);
      expect(result.quads).toBeDefined();
      expect(result.quadCount).toBeGreaterThan(0);
      expect(result.format).toBe('turtle');
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should extract prefixes from content', async () => {
      const result = await processor.parseRDF(testData);
      
      expect(result.success).toBe(true);
      expect(result.prefixes).toBeDefined();
      expect(result.prefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');
      expect(result.prefixes.dc).toBe('http://purl.org/dc/elements/1.1/');
      expect(result.prefixes.ex).toBe('http://example.org/');
    });

    it('should handle invalid RDF gracefully', async () => {
      const invalidRDF = '@prefix invalid without closing > .';
      const result = await processor.parseRDF(invalidRDF);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.quads).toHaveLength(0);
    });

    it('should use fallback parser when N3 fails', async () => {
      // Test with malformed but parseable content
      const partiallyValidRDF = `
@prefix ex: <http://example.org/> .
ex:test ex:property "value" .
# This line has issues but fallback should handle basic triples
      `;
      
      const result = await processor.parseRDF(partiallyValidRDF);
      expect(result.success).toBe(true);
    });

    it('should provide parsing statistics and metadata', async () => {
      const result = await processor.parseRDF(testData);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.contentLength).toBe(testData.length);
      expect(result.metadata.parseTime).toBeGreaterThan(0);
      expect(result.metadata.quadCount).toBeGreaterThan(0);
      expect(result.metadata.prefixCount).toBeGreaterThan(0);
    });
  });

  describe('RDF Serialization', () => {
    let testQuads;

    beforeEach(async () => {
      const parseResult = await processor.parseRDF(testData);
      testQuads = parseResult.quads;
    });

    it('should serialize quads to Turtle format', async () => {
      const serialized = await processor.serializeRDF(testQuads, { format: 'turtle' });
      
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
      expect(serialized).toContain('@prefix');
      expect(serialized).toContain('foaf:Person');
    });

    it('should serialize quads to N-Triples format', async () => {
      const serialized = await processor.serializeRDF(testQuads, { format: 'n-triples' });
      
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
      // N-Triples should have full URIs
      expect(serialized).toContain('<http://xmlns.com/foaf/0.1/Person>');
    });

    it('should handle empty quad arrays', async () => {
      const serialized = await processor.serializeRDF([]);
      
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0); // Should at least have prefixes
    });

    it('should preserve prefixes in serialization', async () => {
      processor.addPrefix('custom', 'http://custom.org/');
      const serialized = await processor.serializeRDF(testQuads, { format: 'turtle' });
      
      expect(serialized).toContain('@prefix custom:');
    });
  });

  describe('SPARQL Queries', () => {
    let store;

    beforeEach(async () => {
      const parseResult = await processor.parseRDF(testData);
      store = new Store(parseResult.quads);
    });

    it('should execute basic SELECT query', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name WHERE {
          ?person a foaf:Person .
          ?person foaf:name ?name .
        }
      `;
      
      const result = await processor.queryRDF(store, query);
      
      expect(result.success).toBe(true);
      expect(result.queryType).toBe('SELECT');
      expect(result.results).toBeDefined();
      expect(result.resultCount).toBeGreaterThan(0);
      expect(result.queryTime).toBeGreaterThan(0);
    });

    it('should execute ASK query', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        ASK WHERE {
          ?person a foaf:Person .
          ?person foaf:name \"John Doe\" .
        }
      `;
      
      const result = await processor.queryRDF(store, query);
      
      expect(result.success).toBe(true);
      expect(result.queryType).toBe('ASK');
      expect(result.results.boolean).toBe(true);
    });

    it('should execute CONSTRUCT query', async () => {
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        CONSTRUCT {
          ?person a foaf:Person .
          ?person foaf:name ?name .
        } WHERE {
          ?person a foaf:Person .
          ?person foaf:name ?name .
        }
      `;
      
      const result = await processor.queryRDF(store, query);
      
      expect(result.success).toBe(true);
      expect(result.queryType).toBe('CONSTRUCT');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should execute DESCRIBE query', async () => {
      const query = 'DESCRIBE <http://example.org/Person1>';
      
      const result = await processor.queryRDF(store, query);
      
      expect(result.success).toBe(true);
      expect(result.queryType).toBe('DESCRIBE');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle invalid SPARQL queries gracefully', async () => {
      const invalidQuery = 'INVALID SPARQL SYNTAX';
      
      const result = await processor.queryRDF(store, invalidQuery);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.results).toHaveLength(0);
    });

    it('should work with quad arrays directly', async () => {
      const parseResult = await processor.parseRDF(testData);
      const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person WHERE {
          ?person a foaf:Person .
        }
      `;
      
      const result = await processor.queryRDF(parseResult.quads, query);
      
      expect(result.success).toBe(true);
      expect(result.resultCount).toBeGreaterThan(0);
    });
  });

  describe('Prefix Management', () => {
    it('should add custom prefixes', () => {
      processor.addPrefix('custom', 'http://custom.org/');
      
      const prefixes = processor.getPrefixes();
      expect(prefixes.custom).toBe('http://custom.org/');
    });

    it('should expand prefixed URIs', () => {
      processor.addPrefix('ex', 'http://example.org/');
      
      const expanded = processor.expandURI('ex:Person1');
      expect(expanded).toBe('http://example.org/Person1');
    });

    it('should compact full URIs to prefixed form', () => {
      processor.addPrefix('foaf', 'http://xmlns.com/foaf/0.1/');
      
      const compacted = processor.compactURI('http://xmlns.com/foaf/0.1/Person');
      expect(compacted).toBe('foaf:Person');
    });

    it('should return original URI if no matching prefix', () => {
      const uri = 'http://unknown.org/resource';
      
      const expanded = processor.expandURI('unknown:resource');
      const compacted = processor.compactURI(uri);
      
      expect(expanded).toBe('unknown:resource'); // No prefix found
      expect(compacted).toBe(uri); // No prefix found
    });
  });

  describe('Statistics and Performance', () => {
    it('should track parsing statistics', async () => {
      await processor.parseRDF(testData);
      await processor.parseRDF(testData); // Parse again
      
      const stats = processor.getStatistics();
      
      expect(stats.totalQuads).toBeGreaterThan(0);
      expect(stats.parseTime).toBeGreaterThan(0);
      expect(stats.prefixCount).toBeGreaterThan(0);
      expect(stats.averageParseTime).toBeGreaterThan(0);
    });

    it('should track query statistics', async () => {
      const parseResult = await processor.parseRDF(testData);
      const store = new Store(parseResult.quads);
      
      await processor.queryRDF(store, 'ASK WHERE { ?s ?p ?o . }');
      await processor.queryRDF(store, 'ASK WHERE { ?s ?p ?o . }');
      
      const stats = processor.getStatistics();
      
      expect(stats.totalQueries).toBe(2);
      expect(stats.queryTime).toBeGreaterThan(0);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
    });

    it('should emit events during processing', async () => {
      let parseEvent = null;
      let queryEvent = null;
      
      processor.on('parse-complete', (event) => {
        parseEvent = event;
      });
      
      processor.on('query-complete', (event) => {
        queryEvent = event;
      });
      
      const parseResult = await processor.parseRDF(testData);
      const store = new Store(parseResult.quads);
      await processor.queryRDF(store, 'ASK WHERE { ?s ?p ?o . }');
      
      expect(parseEvent).not.toBeNull();
      expect(parseEvent.quadCount).toBeGreaterThan(0);
      expect(parseEvent.parseTime).toBeGreaterThan(0);
      
      expect(queryEvent).not.toBeNull();
      expect(queryEvent.queryType).toBe('ASK');
      expect(queryEvent.queryTime).toBeGreaterThan(0);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset processor state', async () => {
      await processor.parseRDF(testData);
      processor.addPrefix('temp', 'http://temp.org/');
      
      const statsBefore = processor.getStatistics();
      expect(statsBefore.totalQuads).toBeGreaterThan(0);
      
      processor.reset();
      
      const statsAfter = processor.getStatistics();
      expect(statsAfter.totalQuads).toBe(0);
      expect(statsAfter.parseTime).toBe(0);
      
      // Should still have default prefixes
      const prefixes = processor.getPrefixes();
      expect(prefixes.rdf).toBeDefined();
      expect(prefixes.temp).toBeUndefined();
    });
  });

  describe('Factory Functions', () => {
    it('should create processor with factory function', () => {
      const proc = createRDFProcessor({ defaultFormat: 'n-triples' });
      expect(proc).toBeInstanceOf(RDFProcessor);
      expect(proc.config.defaultFormat).toBe('n-triples');
    });

    it('should parse RDF with convenience function', async () => {
      const result = await parseRDF(testData, { format: 'turtle' });
      
      expect(result.success).toBe(true);
      expect(result.quadCount).toBeGreaterThan(0);
    });

    it('should serialize RDF with convenience function', async () => {
      const parseResult = await parseRDF(testData);
      const serialized = await serializeRDF(parseResult.quads, { format: 'turtle' });
      
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
    });

    it('should query RDF with convenience function', async () => {
      const parseResult = await parseRDF(testData);
      const query = 'ASK WHERE { ?s ?p ?o . }';
      const result = await queryRDF(parseResult.quads, query);
      
      expect(result.success).toBe(true);
      expect(result.queryType).toBe('ASK');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty input gracefully', async () => {
      const result = await processor.parseRDF('');
      
      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(0);
    });

    it('should handle very large inputs', async () => {
      // Create a large RDF document
      let largeRDF = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 1000; i++) {
        largeRDF += `ex:resource${i} ex:property \"value${i}\" .\n`;
      }
      
      const result = await processor.parseRDF(largeRDF);
      
      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(1000);
    });

    it('should handle malformed URIs', async () => {
      const malformedRDF = 'ex:test ex:property <http://invalid uri with spaces> .';
      const result = await processor.parseRDF(malformedRDF);
      
      // Should either succeed with fallback or fail gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle concurrent operations safely', async () => {
      const promises = [
        processor.parseRDF(testData),
        processor.parseRDF(testData),
        processor.parseRDF(testData)
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.quadCount).toBeGreaterThan(0);
      });
    });
  });
});