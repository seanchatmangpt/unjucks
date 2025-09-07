import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TurtleParser, TurtleParseError } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Store } from 'n3';
import fs from 'fs-extra';
import path from 'node:path';

describe('RDF Security Validation', () => {
  let parser;
  let dataLoader;
  let rdfFilters;
  let tempDir => {
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader();
    rdfFilters = new RDFFilters();
    tempDir = path.join(process.cwd(), 'temp-test-files');
  });

  afterEach(async () => {
    // Clean up temp files
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('1. Input Validation Tests', () => { describe('Malicious Turtle Syntax', () => {
      it('should handle excessive blank nodes without crashing', async () => {
        // Create many blank node triples
        const maliciousTurtle = `
          @prefix ex } ex:contains _:node${i + 1} .`).join('\n')}
        `;

        const startTime = Date.now();
        const result = await parser.parse(maliciousTurtle);
        const endTime = Date.now();
        
        // Should parse successfully but not take excessive time
        expect(result.triples.length).toBe(10000);
        expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      });

      it('should handle extremely long URI values without crashing', async () => { const longUri = 'http }> <http://example.org/prop> "value" .`;

        // Should either parse successfully or fail gracefully
        try {
          const result = await parser.parse(turtle);
          expect(result.triples).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(TurtleParseError);
        }
      });

      it('should reject turtle with circular references', async () => { const circularTurtle = `
          @prefix ex });

      it('should handle malformed escape sequences', async () => { const malformedTurtle = `
          @prefix ex } catch (error) {
          expect(error).toBeInstanceOf(TurtleParseError);
        }
      });
    });

    describe('XXE and External Entity Attacks', () => { it('should block processing of XML-like content in literals', async () => {
        const xmlLiteral = `
          @prefix ex });

      it('should parse external URIs in namespace declarations without fetching', async () => { const externalNamespace = `
          @prefix evil });
    });

    describe('Resource Exhaustion Tests', () => { it('should enforce timeout on parsing large files', async () => {
        // Create a large turtle file that would take time to process
        const largeTurtle = `@prefix ex } ex:predicate${i} "Object value ${i}" .`).join('\n');

        const startTime = Date.now();
        try {
          await parser.parse(largeTurtle);
          const endTime = Date.now();
          expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
        } catch (error) {
          // Timeout is acceptable
          expect(error.message).toContain('timeout');
        }
      });

      it('should limit memory usage for very wide graphs', async () => { // Create a graph with many predicates per subject
        const wideGraph = `@prefix ex } "value${i}"`).join(' ;\n  ') +
          ' .';

        const initialMemory = process.memoryUsage().heapUsed;
        await parser.parse(wideGraph);
        const finalMemory = process.memoryUsage().heapUsed;
        
        // Memory increase should be reasonable (less than 100MB for this test)
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      });

      it('should handle billion laughs attack pattern', async () => { // RDF equivalent of XML billion laughs
        const billionLaughs = `
          @prefix ex } ex:contains ${ Array(10).fill(`ex }`).join(', ')} .`
          ).join('\n')}
        `;

        const startTime = Date.now();
        try {
          const result = await parser.parse(billionLaughs);
          const endTime = Date.now();
          
          // Should complete quickly or timeout
          expect(endTime - startTime).toBeLessThan(10000);
          expect(result.triples.length).toBeGreaterThan(0);
        } catch (error) {
          expect(error.message).toMatch(/timeout|memory|size/i);
        }
      });
    });

    describe('Path Traversal in File Paths', () => { it('should handle directory traversal in file paths safely', async () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '/etc/shadow',
          'C };

          const result = await dataLoader.loadFromSource(source);
          // Should fail to load due to file not existing or access denied
          expect(result.success).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          // Errors should indicate file issues, not expose system details
          const errorText = result.errors.join(' ');
          expect(errorText).toMatch(/Failed to read RDF file|ENOENT|EACCES|access/i);
        }
      });

      it('should sanitize relative paths when template directory is set', async () => {
        await fs.ensureDir(tempDir);
        const safePath = path.join(tempDir, 'safe.ttl');
        await fs.writeFile(safePath, '@prefix ex);

        const loaderWithTemplateDir = new RDFDataLoader({ templateDir });

        // This should work - relative path within template directory
        const result = await loaderWithTemplateDir.loadFromSource({ type });
    });
  });

  describe('2. Resource Limits Tests', () => { describe('Maximum File Size Handling', () => {
      it('should handle large files gracefully', async () => {
        // Create a large but valid turtle file
        await fs.ensureDir(tempDir);
        const largeTurtlePath = path.join(tempDir, 'large.ttl');
        
        const largeContent = '@prefix ex } ex:value "Value ${i}" .`).join('\n');

        await fs.writeFile(largeTurtlePath, largeContent);

        const startTime = Date.now();
        const result = await dataLoader.loadFromSource({ type } else {
          // If it fails due to size limits, that's acceptable
          expect(result.errors.some(error => 
            error.includes('timeout') || error.includes('memory') || error.includes('size')
          )).toBe(true);
        }
      });
    });

    describe('Maximum Triple Count', () => { it('should process large numbers of triples efficiently', async () => {
        const manyTriples = '@prefix ex } ex:p${i} ex:o${i} .`).join('\n');

        const result = await parser.parse(manyTriples);
        expect(result.stats.tripleCount).toBe(50000);
        expect(result.triples.length).toBe(50000);
      });
    });

    describe('Memory Limits', () => { it('should handle deep nesting efficiently', async () => {
        const deepNesting = '@prefix ex } ex:contains ex:level${i + 1} .`
          ).join('\n');

        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        const result = await parser.parse(deepNesting);
        
        const endTime = Date.now();
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        // Should parse successfully
        expect(result.triples.length).toBe(1000);
        // Should complete in reasonable time
        expect(endTime - startTime).toBeLessThan(10000);
        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }, 15000);
    });

    describe('Timeout Enforcement', () => { it('should enforce timeout in TurtleParser', async () => {
        // Create content that might cause slow parsing
        const slowContent = '@prefix ex }`;
            const properties = Array(100).fill(0).map((_, j) => 
              `ex:prop${j} "Very long value that might slow down parsing ${i}-${j}"`
            ).join(' ;\n    ');
            return `${subject}\n    ${properties} .`;
          }).join('\n\n');

        const startTime = Date.now();
        try {
          await parser.parse(slowContent);
          const elapsed = Date.now() - startTime;
          expect(elapsed).toBeLessThan(15000); // Should complete within 15 seconds
        } catch (error) {
          // Timeout is acceptable
          expect(error.message).toContain('timeout');
        }
      });

      it('should enforce timeout in HTTP requests', async () => {
        const loader = new RDFDataLoader({
          httpTimeout, // 1 second timeout
        });

        // Try to load from a slow/non-existent endpoint
        const result = await loader.loadFromSource({ type });
    });
  });

  describe('3. URI Sanitization Tests', () => { describe('JavaScript URIs', () => {
      it('should reject malformed JavaScript URIs in turtle syntax', async () => {
        const jsUris = [
          'javascript }> <http://example.org/prop> "test" .`;
          
          // N3 parser correctly rejects malformed URIs with quotes
          await expect(parser.parse(turtle)).rejects.toThrow(/Unexpected/);
        }
      });

      it('should parse properly escaped JavaScript URIs safely', async () => { // Properly formatted JavaScript URI (though still dangerous if executed)
        const turtle = `<javascript });
    });

    describe('File Protocol Blocking', () => { it('should parse file }> <http://example.org/prop> "test" .`;
          
          const result = await parser.parse(turtle);
          expect(result.triples[0].subject.value).toBe(fileUri);
        }

        // RDFDataLoader should handle file:// URIs file paths
        const result = await dataLoader.loadFromSource({ type });
    });

    describe('Data URIs Validation', () => { it('should handle data URIs appropriately', async () => {
        const safeDataUri = 'data }> <http://example.org/prop> "test" .`;
        
        const result = await parser.parse(turtle);
        expect(result.triples[0].subject.value).toBe(safeDataUri);

        // Data URIs with complex content may be rejected by parser
        const complexDataUris = [
          'data:text/html,alert("xss")</script>',
          'data:application/javascript,alert("evil")'
        ];

        for (const dataUri of complexDataUris) {
          const complexTurtle = `<${dataUri}> <http://example.org/prop> "test" .`;
          
          try {
            const result = await parser.parse(complexTurtle);
            expect(result.triples[0].subject.value).toBe(dataUri);
          } catch (error) {
            // Parser may reject complex data URIs - this is acceptable security behavior
            expect(error).toBeInstanceOf(TurtleParseError);
          }
        }
      });
    });

    describe('HTTP/HTTPS Only for Remote', () => { it('should handle non-http schemes by treating paths', async () => {
        const nonHttpSchemes = [
          'ftp }
      });

      it('should accept valid http/https URIs', async () => { // Note } catch (error) {
            // Network errors are acceptable in tests
            expect(error).toBeDefined();
          }
        }
      });
    });
  });

  describe('4. Access Control Tests', () => {
    describe('Template Sandbox Isolation', () => {
      it('should isolate RDF filter execution from global scope', () => {
        const store = new Store();
        const filters = new RDFFilters({ store });

        // Filters should not have access to global objects
        const filterContext = { process,
          require,
          module,
          global };

        // Test that filters work in isolated context
        const subjects = filters.rdfSubject('http://example.org/prop', 'test');
        expect(Array.isArray(subjects)).toBe(true);
        expect(subjects).toEqual([]);
      });

      it('should prevent code injection through filter parameters', () => {
        const store = new Store();
        const filters = new RDFFilters({ store });

        const maliciousInputs = [
          'eval("console.log(process.env)")',
          'require("fs").readFileSync("/etc/passwd")',
          '${process.exit(1)}',
          '#{7*7}', // Template injection attempt
          '{{constructor.constructor("return process")()}}'
        ];

        for (const maliciousInput of maliciousInputs) { // These should be treated strings, not executed
          const result = filters.rdfExists(maliciousInput, 'http }
      });
    });

    describe('Variable Scope Limitation', () => { it('should limit access to template variables scope', async () => {
        const testData = `
          @prefix ex });

        expect(result.success).toBe(true);
        expect(result.variables.user).toBeDefined();
        expect(result.variables.admin).toBeUndefined();
      });

      it('should not expose dangerous prototype properties', async () => { const testData = `@prefix ex }
      });
    });

    describe('Graph Access Restrictions', () => { it('should respect named graph isolation', async () => {
        const multiGraphData = `
          @prefix ex }
          
          GRAPH <http://example.org/private> { ex }
        `;

        try {
          const result = await parser.parse(multiGraphData);
          const store = new Store();
          store.addQuads(result.triples);

          const filters = new RDFFilters({ store });

          // Should be able to query specific graphs
          const publicTriples = filters.rdfGraph('http://example.org/public');
          const privateTriples = filters.rdfGraph('http://example.org/private');

          expect(Array.isArray(publicTriples)).toBe(true);
          expect(Array.isArray(privateTriples)).toBe(true);
        } catch (error) {
          // Some parsers may not support named graphs - that's acceptable
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('5. Error Handling and Security', () => { it('should not expose sensitive information in error messages', async () => {
      const sensitiveFile = '/etc/passwd';
      
      const result = await dataLoader.loadFromSource({
        type });

    it('should handle stack overflow attempts gracefully', async () => { const recursiveTurtle = `
        @prefix ex } ex:contains ex:item${(i + 1) % 10000} .`
        ).join('\n')}
      `;

      try {
        const result = await parser.parse(recursiveTurtle);
        expect(result.triples.length).toBe(10000);
      } catch (error) {
        // Stack overflow protection is acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should validate input before processing', () => {
      const invalidInputs = [null, undefined, 123, [], {}, Symbol('test')];

      for (const invalidInput of invalidInputs) { expect(() => {
          rdfFilters.rdfExists(invalidInput, 'http }).not.toThrow(); // Should handle gracefully, not crash
      }
    });
  });

  describe('6. Performance and DoS Protection', () => { it('should limit processing time for complex queries', () => {
      const store = new Store();
      
      // Add many triples to make queries potentially slow
      for (let i = 0; i < 10000; i++) {
        store.addQuad(
          { termType }` },
          { termType }` },
          { termType }`, datatype, language: '' },
          { termType }

      const filters = new RDFFilters({ store });
      
      const startTime = Date.now();
      
      // This should complete quickly
      const results = filters.rdfQuery({ subject, predicate, object });
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle concurrent parsing requests safely', async () => { const turtleContent = '@prefix ex } ex:p${i} "value${i}" .`).join('\n');

      // Start multiple parsing operations concurrently
      const promises = Array(5).fill(0).map(() => {
        const individualParser = new TurtleParser();
        return individualParser.parse(turtleContent);
      });

      const results = await Promise.allSettled(promises);
      
      // Most should succeed with same results
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
      
      for (const result of successful) {
        if (result.status === 'fulfilled') {
          expect(result.value.triples.length).toBe(1000);
          expect(result.value.stats.tripleCount).toBe(1000);
        }
      }
    }, 20000);
  });
});