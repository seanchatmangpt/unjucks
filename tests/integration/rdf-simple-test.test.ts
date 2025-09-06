import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

/**
 * Simple RDF Integration Tests
 * Basic validation that RDF components work together
 */
describe('Simple RDF Integration Tests', () => {
  let dataLoader: RDFDataLoader;
  let parser: TurtleParser;
  let rdfFilters: RDFFilters;
  
  const fixturesPath = resolve(__dirname, '../fixtures/turtle');

  beforeEach(() => {
    dataLoader = new RDFDataLoader({
      cacheEnabled: true,
      templateDir: fixturesPath
    });
    
    parser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterEach(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('Basic RDF Processing', () => {
    it('should load and parse basic person data', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data.triples.length).toBeGreaterThan(0);
      expect(Object.keys(result.data.subjects)).toContain('http://example.org/person1');
    });

    it('should execute basic RDF queries', async () => {
      const simpleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:john a foaf:Person ;
                foaf:name "John Doe" ;
                foaf:email "john@example.com" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: simpleData,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      expect(persons).toHaveLength(1);
      expect(persons[0]).toBe('http://example.org/john');
      
      const johnName = rdfFilters.rdfObject('ex:john', 'foaf:name');
      expect(johnName[0]?.value).toBe('John Doe');
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidData = `
        @prefix ex: <http://example.org/> .
        ex:broken ex:property "unclosed quote ;
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: invalidData,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.subjects).toEqual({});
    });
  });

  describe('Performance and Caching', () => {
    it('should cache data and improve subsequent loads', async () => {
      const dataSource: RDFDataSource = {
        type: 'inline',
        source: '@prefix ex: <http://example.org/> . ex:test ex:value "test" .',
        format: 'text/turtle'
      };

      // First load
      const start1 = performance.now();
      const result1 = await dataLoader.loadFromSource(dataSource);
      const time1 = performance.now() - start1;
      
      expect(result1.success).toBe(true);

      // Second load (cached)
      const start2 = performance.now();
      const result2 = await dataLoader.loadFromSource(dataSource);
      const time2 = performance.now() - start2;
      
      expect(result2.success).toBe(true);
      expect(time2).toBeLessThan(time1); // Should be faster due to caching
    });

    it('should provide cache statistics', () => {
      const stats = dataLoader.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('totalSize');
      expect(typeof stats.size).toBe('number');
    });
  });
});