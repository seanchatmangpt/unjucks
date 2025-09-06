import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

/**
 * RDF Edge Cases and Boundary Testing
 * Focuses on testing edge cases, boundary conditions, and error scenarios
 * that represent real-world challenges in RDF processing
 */
describe('RDF Edge Cases and Boundary Testing', () => {
  let dataLoader: RDFDataLoader;
  let parser: TurtleParser;
  let rdfFilters: RDFFilters;
  
  const fixturesPath = resolve(__dirname, '../fixtures/turtle');

  beforeEach(() => {
    dataLoader = new RDFDataLoader({
      cacheEnabled: true,
      templateDir: fixturesPath,
      httpTimeout: 5000
    });
    
    parser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterEach(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('Edge Case Data Structures', () => {
    it('should handle deeply nested blank nodes', async () => {
      const complexTurtle = `
        @prefix ex: <http://example.org/> .
        
        ex:root ex:hasChild [
          ex:name "Child 1" ;
          ex:hasGrandchild [
            ex:name "Grandchild 1" ;
            ex:hasGreatGrandchild [
              ex:name "Great-Grandchild 1" ;
              ex:value 42
            ]
          ]
        ] .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: complexTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBeGreaterThan(5);
      
      // Should handle blank nodes properly
      rdfFilters.updateStore(result.data.triples);
      const childCount = rdfFilters.rdfCount('ex:root', 'ex:hasChild');
      expect(childCount).toBe(1);
    });

    it('should handle circular references without infinite loops', async () => {
      const circularTurtle = `
        @prefix ex: <http://example.org/> .
        
        ex:a ex:knows ex:b .
        ex:b ex:knows ex:c .
        ex:c ex:knows ex:a .
        
        ex:a ex:name "Alice" .
        ex:b ex:name "Bob" .
        ex:c ex:name "Charlie" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: circularTurtle,
        format: 'text/turtle'
      };

      const startTime = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const loadTime = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(loadTime).toBeLessThan(1000); // Should not hang
      
      rdfFilters.updateStore(result.data.triples);
      
      // Each person should know exactly one other person
      const aliceKnows = rdfFilters.rdfObject('ex:a', 'ex:knows');
      const bobKnows = rdfFilters.rdfObject('ex:b', 'ex:knows');
      const charlieKnows = rdfFilters.rdfObject('ex:c', 'ex:knows');
      
      expect(aliceKnows).toHaveLength(1);
      expect(bobKnows).toHaveLength(1);
      expect(charlieKnows).toHaveLength(1);
    });

    it('should handle extremely long URIs and literals', async () => {
      const longString = 'a'.repeat(10000);
      const longURI = `http://example.org/${'very'.repeat(1000)}/long/uri`;
      
      const longDataTurtle = `
        @prefix ex: <http://example.org/> .
        
        <${longURI}> ex:description "${longString}" ;
                     ex:type "test" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: longDataTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.data.subjects)).toContain(longURI);
      
      rdfFilters.updateStore(result.data.triples);
      const description = rdfFilters.rdfObject(longURI, 'ex:description');
      expect(description[0].value).toBe(longString);
    });

    it('should handle mixed character encodings and Unicode', async () => {
      const unicodeTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix emoji: <http://example.org/emoji/> .
        
        ex:person ex:name "José García" ;
                  ex:city "北京" ;
                  ex:greeting "Hello! 👋" ;
                  emoji:favorite "🚀" ;
                  ex:multiline """This is a
                  multiline string with
                  special chars: áéíóú""" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: unicodeTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const name = rdfFilters.rdfObject('ex:person', 'ex:name');
      const city = rdfFilters.rdfObject('ex:person', 'ex:city');
      const emoji = rdfFilters.rdfObject('ex:person', 'emoji:favorite');
      
      expect(name[0].value).toBe('José García');
      expect(city[0].value).toBe('北京');
      expect(emoji[0].value).toBe('🚀');
    });

    it('should handle empty and whitespace-only values', async () => {
      const emptyValuesTurtle = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:emptyString "" ;
                ex:whitespaceOnly "   " ;
                ex:newlineOnly "\\n" ;
                ex:tabOnly "\\t" ;
                ex:validValue "actual content" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: emptyValuesTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const emptyString = rdfFilters.rdfObject('ex:test', 'ex:emptyString');
      const whitespace = rdfFilters.rdfObject('ex:test', 'ex:whitespaceOnly');
      const validValue = rdfFilters.rdfObject('ex:test', 'ex:validValue');
      
      expect(emptyString[0].value).toBe('');
      expect(whitespace[0].value).toBe('   ');
      expect(validValue[0].value).toBe('actual content');
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum integer values', async () => {
      const maxValuesTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:limits ex:maxInt "2147483647"^^xsd:integer ;
                  ex:minInt "-2147483648"^^xsd:integer ;
                  ex:maxLong "9223372036854775807"^^xsd:long ;
                  ex:zero "0"^^xsd:integer .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: maxValuesTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const maxInt = rdfFilters.rdfObject('ex:limits', 'ex:maxInt');
      const minInt = rdfFilters.rdfObject('ex:limits', 'ex:minInt');
      
      expect(maxInt[0].value).toBe('2147483647');
      expect(minInt[0].value).toBe('-2147483648');
    });

    it('should handle floating point edge cases', async () => {
      const floatEdgesTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:floats ex:pi "3.14159265359"^^xsd:double ;
                 ex:verySmall "0.000000001"^^xsd:double ;
                 ex:veryLarge "999999999999.999"^^xsd:double ;
                 ex:scientific "1.23e-10"^^xsd:double ;
                 ex:zero "0.0"^^xsd:double .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: floatEdgesTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const pi = rdfFilters.rdfObject('ex:floats', 'ex:pi');
      const scientific = rdfFilters.rdfObject('ex:floats', 'ex:scientific');
      
      expect(pi[0].value).toBe('3.14159265359');
      expect(scientific[0].value).toBe('1.23e-10');
    });

    it('should handle date/time boundary values', async () => {
      const dateBoundariesTurtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:dates ex:epoch "1970-01-01T00:00:00Z"^^xsd:dateTime ;
                 ex:y2k "2000-01-01T00:00:00Z"^^xsd:dateTime ;
                 ex:future "2099-12-31T23:59:59Z"^^xsd:dateTime ;
                 ex:leapYear "2024-02-29"^^xsd:date .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: dateBoundariesTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const epoch = rdfFilters.rdfObject('ex:dates', 'ex:epoch');
      const leapYear = rdfFilters.rdfObject('ex:dates', 'ex:leapYear');
      
      expect(epoch[0].value).toBe('1970-01-01T00:00:00Z');
      expect(leapYear[0].value).toBe('2024-02-29');
    });
  });

  describe('Performance Stress Testing', () => {
    it('should handle large numbers of triples efficiently', async () => {
      // Generate a dataset with 10,000 triples
      let largeTurtle = '@prefix ex: <http://example.org/> .\n';
      
      const tripleCount = 10000;
      const startGeneration = performance.now();
      
      for (let i = 0; i < tripleCount; i++) {
        largeTurtle += `ex:entity${i} ex:property${i % 100} "value${i}" .\n`;
      }
      
      const generationTime = performance.now() - startGeneration;
      console.log(`Generated ${tripleCount} triples in ${generationTime.toFixed(2)}ms`);

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: largeTurtle,
        format: 'text/turtle'
      };

      const startParsing = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const parsingTime = performance.now() - startParsing;
      
      console.log(`Parsed ${tripleCount} triples in ${parsingTime.toFixed(2)}ms`);
      
      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBe(tripleCount);
      expect(parsingTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Test querying performance
      rdfFilters.updateStore(result.data.triples);
      
      const startQuerying = performance.now();
      const queryResults = rdfFilters.rdfQuery({
        subject: null,
        predicate: 'ex:property0',
        object: null
      });
      const queryingTime = performance.now() - startQuerying;
      
      console.log(`Queried large dataset in ${queryingTime.toFixed(2)}ms`);
      
      expect(queryResults.length).toBeGreaterThan(0);
      expect(queryingTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle deep property chains without stack overflow', async () => {
      // Create a deep property chain
      let deepChainTurtle = '@prefix ex: <http://example.org/> .\n';
      
      const depth = 1000;
      for (let i = 0; i < depth; i++) {
        deepChainTurtle += `ex:entity${i} ex:next ex:entity${i + 1} .\n`;
      }
      deepChainTurtle += `ex:entity${depth} ex:value "final" .\n`;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: deepChainTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBe(depth + 1);
      
      rdfFilters.updateStore(result.data.triples);
      
      // Should handle traversal without stack overflow
      const startOfChain = rdfFilters.rdfObject('ex:entity0', 'ex:next');
      const endOfChain = rdfFilters.rdfObject(`ex:entity${depth}`, 'ex:value');
      
      expect(startOfChain).toHaveLength(1);
      expect(endOfChain[0].value).toBe('final');
    });

    it('should handle concurrent processing without race conditions', async () => {
      const testData = `
        @prefix ex: <http://example.org/> .
        
        ex:shared ex:counter "0" ;
                 ex:status "active" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: testData,
        format: 'text/turtle'
      };

      // Load the same data concurrently multiple times
      const concurrentPromises = Array(50).fill(null).map(() => 
        dataLoader.loadFromSource(dataSource)
      );

      const startTime = performance.now();
      const results = await Promise.all(concurrentPromises);
      const endTime = performance.now();
      
      console.log(`Concurrent processing completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      // All results should be successful and identical
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.triples.length).toBe(2);
        expect(Object.keys(result.data.subjects)).toContain('http://example.org/shared');
      });
      
      // Cache should have prevented redundant parsing
      const cacheStats = dataLoader.getCacheStats();
      expect(cacheStats.size).toBe(1); // Only one cache entry
    });
  });

  describe('Memory Management Under Stress', () => {
    it('should not leak memory with repeated large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let iteration = 0; iteration < 10; iteration++) {
        // Create a moderately large dataset
        let turtle = '@prefix ex: <http://example.org/> .\n';
        for (let i = 0; i < 1000; i++) {
          turtle += `ex:item${i} ex:name "Item ${i}" ; ex:value ${i} .\n`;
        }

        const dataSource: RDFDataSource = {
          type: 'inline',
          source: turtle,
          format: 'text/turtle'
        };

        const result = await dataLoader.loadFromSource(dataSource);
        expect(result.success).toBe(true);
        
        // Process the data
        rdfFilters.updateStore(result.data.triples);
        
        // Perform some queries
        const items = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'ex:name',
          object: null
        });
        
        expect(items.length).toBe(1000);
        
        // Clear for next iteration
        rdfFilters.clearStore();
        dataLoader.clearCache();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory increase after 10 iterations: ${memoryIncrease.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50);
    });

    it('should handle cleanup of expired cache entries under load', async () => {
      // Create loader with short TTL
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled: true,
        cacheTTL: 50, // 50ms
        templateDir: fixturesPath
      });

      const dataSources: RDFDataSource[] = [];
      
      // Create multiple unique data sources
      for (let i = 0; i < 20; i++) {
        dataSources.push({
          type: 'inline',
          source: `@prefix ex: <http://example.org/> . ex:test${i} ex:value "${i}" .`,
          format: 'text/turtle'
        });
      }

      // Load all data sources rapidly
      const loadPromises = dataSources.map(source => 
        shortTTLLoader.loadFromSource(source)
      );
      
      await Promise.all(loadPromises);
      
      let stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(20);
      
      // Wait for cache entries to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clean up expired entries
      const removed = shortTTLLoader.cleanupCache();
      expect(removed).toBe(20);
      
      stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from partial parsing failures', async () => {
      const partiallyInvalidTurtle = `
        @prefix ex: <http://example.org/> .
        
        # Valid triple
        ex:valid ex:name "Valid Data" .
        
        # Invalid triple (missing closing quote)
        ex:invalid ex:broken "Missing quote ;
        
        # Another valid triple after the error
        ex:valid2 ex:name "Also Valid" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: partiallyInvalidTurtle,
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      // Should fail gracefully but provide useful error information
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.error).toBeDefined();
      
      // Should still provide safe empty structure
      expect(result.data.subjects).toEqual({});
      expect(result.data.triples).toHaveLength(0);
    });

    it('should handle network timeouts gracefully', async () => {
      // Create loader with very short timeout
      const timeoutLoader = new RDFDataLoader({
        httpTimeout: 1, // 1ms - will definitely timeout
        maxRetries: 1,
        retryDelay: 1
      });

      const dataSource: RDFDataSource = {
        type: 'uri',
        source: 'https://httpbin.org/delay/5', // Will take 5 seconds
        format: 'text/turtle'
      };

      const startTime = performance.now();
      const result = await timeoutLoader.loadFromSource(dataSource);
      const endTime = performance.now();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('fetch');
      
      // Should fail quickly due to timeout
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle malformed URIs safely', async () => {
      const malformedURITurtle = `
        @prefix ex: <http://example.org/> .
        
        <not a valid uri> ex:name "Invalid URI" .
        <http://valid.com> ex:name "Valid URI" .
        <ftp://unusual.protocol.com> ex:name "Unusual Protocol" .
      `;

      const dataSource: RDFDataSource = {
        type: 'inline',
        source: malformedURITurtle,
        format: 'text/turtle'
      };

      // Should not crash, either parse successfully or fail gracefully
      const result = await dataLoader.loadFromSource(dataSource);
      
      if (result.success) {
        // If parsing succeeded, should have handled URIs appropriately
        expect(result.data.triples.length).toBeGreaterThanOrEqual(0);
      } else {
        // If parsing failed, should provide meaningful error
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.metadata.error).toBeDefined();
      }
    });
  });
});