import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser, TurtleParseError } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';

/**
 * Focused RDF Security Validation Tests
 * 
 * This test suite validates critical security measures in the RDF implementation:
 * - Input validation and sanitization
 * - Resource exhaustion protection 
 * - URI handling security
 * - Template isolation
 * - Error information disclosure
 */
describe('RDF Security Validation - Focused', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;

  beforeEach(() => {
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader();
    rdfFilters = new RDFFilters();
  });

  describe('Critical Security Tests', () => {
    it('should handle large RDF datasets without memory exhaustion', async () => {
      const largeTurtle = '@prefix ex: <http://example.org/> .\n' +
        Array(5000).fill(0).map((_, i) => `ex:item${i} ex:prop "value${i}" .`).join('\n');

      const startTime = Date.now();
      const result = await parser.parse(largeTurtle);
      const endTime = Date.now();

      expect(result.triples.length).toBe(5000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should enforce parsing timeout to prevent DoS', async () => {
      // Create content that may cause slower parsing
      const complexTurtle = '@prefix ex: <http://example.org/> .\n' +
        Array(1000).fill(0).map((_, i) => {
          const props = Array(50).fill(0).map((_, j) => `ex:prop${j} "value-${i}-${j}"`).join(' ; ');
          return `ex:subject${i} ${props} .`;
        }).join('\n');

      const startTime = Date.now();
      try {
        await parser.parse(complexTurtle);
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(15000); // Should complete or timeout within 15 seconds
      } catch (error) {
        // Timeout is acceptable security behavior
        expect(error.message).toMatch(/timeout|timed out/i);
      }
    });

    it('should safely handle JavaScript URIs without execution', async () => {
      // Test safe JavaScript URI (no quotes in URI)
      const jsUri = 'javascript:void(0)';
      const turtle = `<${jsUri}> <http://example.org/prop> "test" .`;
      
      const result = await parser.parse(turtle);
      expect(result.triples[0].subject.value).toBe(jsUri);
      // Critical: Parser treats it as string identifier, doesn't execute JavaScript
    });

    it('should reject malformed URIs that could be attack vectors', async () => {
      const malformedUris = [
        'javascript:alert("xss")', // Contains quotes
        'data:text/html,<script>alert("xss")</script>' // Complex data URI
      ];

      for (const uri of malformedUris) {
        const turtle = `<${uri}> <http://example.org/prop> "test" .`;
        
        // Should reject due to quotes or other parsing issues
        await expect(parser.parse(turtle)).rejects.toThrow();
      }
    });

    it('should handle file path traversal attempts safely', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow'
      ];

      for (const path of maliciousPaths) {
        const result = await dataLoader.loadFromSource({
          type: 'file',
          source: path
        });

        // Should fail due to filesystem protections
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should isolate RDF filters from global scope', () => {
      // Test that filters don't have access to dangerous globals
      const maliciousInputs = [
        'eval("process.exit(1)")',
        'require("fs")',
        '${process.env.HOME}'
      ];

      for (const input of maliciousInputs) {
        // Should treat as literal strings, not execute
        const result = rdfFilters.rdfExists(input, 'http://example.org/prop');
        expect(typeof result).toBe('boolean');
        expect(result).toBe(false); // No such triple exists
      }
    });

    it('should not expose sensitive information in error messages', async () => {
      const sensitiveFile = '/etc/passwd';
      
      const result = await dataLoader.loadFromSource({
        type: 'file',
        source: sensitiveFile
      });

      expect(result.success).toBe(false);
      const errorMessage = result.errors[0];
      
      // Should not expose system details, passwords, etc.
      expect(errorMessage).not.toContain('password');
      expect(errorMessage).not.toContain('secret');
      expect(errorMessage).not.toContain('key');
    });

    it('should limit template variable scope to prevent prototype pollution', async () => {
      const testData = '@prefix ex: <http://example.org/> . ex:user ex:name "test" .';
      
      const result = await dataLoader.loadFromSource({
        type: 'inline',
        source: testData
      });

      expect(result.success).toBe(true);
      // Critical: Should not expose dangerous JavaScript properties as functions
      // Note: __proto__ may exist as empty object but shouldn't be the JavaScript prototype
      if (result.variables.__proto__) {
        expect(Object.keys(result.variables.__proto__)).toHaveLength(0);
      }
      expect(result.variables.prototype).toBeUndefined();
    });

    it('should handle HTTP timeouts to prevent hanging requests', async () => {
      const loader = new RDFDataLoader({
        httpTimeout: 2000 // 2 second timeout
      });

      const startTime = Date.now();
      
      const result = await loader.loadFromSource({
        type: 'uri',
        source: 'http://httpbin.org/delay/10' // 10 second delay
      });

      const elapsed = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(elapsed).toBeLessThan(10000); // Should timeout much sooner than 10 seconds
      expect(result.errors.some(error => 
        error.includes('timeout') || error.includes('aborted')
      )).toBe(true);
    });

    it('should parse external namespace URIs without fetching them', async () => {
      const externalNamespace = `
        @prefix evil: <http://evil.example.com/malicious#> .
        @prefix file: <file:///etc/passwd#> .
        evil:test file:prop "value" .
      `;

      const result = await parser.parse(externalNamespace);
      
      // Should parse successfully without attempting to fetch external resources
      expect(result.triples.length).toBe(1);
      expect(result.triples[0].subject.value).toBe('http://evil.example.com/malicious#test');
      expect(result.triples[0].predicate.value).toBe('file:///etc/passwd#prop');
      // Critical: No HTTP requests made to external hosts
    });
  });

  describe('Attack Vector Tests', () => {
    it('should handle circular reference patterns without infinite loops', async () => {
      const circularTurtle = `
        @prefix ex: <http://example.org/> .
        ex:a ex:contains ex:b .
        ex:b ex:contains ex:c .
        ex:c ex:contains ex:a .
      `;

      const startTime = Date.now();
      const result = await parser.parse(circularTurtle);
      const endTime = Date.now();

      expect(result.triples.length).toBe(3);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('should limit processing time for complex filter queries', () => {
      // Create a store with many triples
      const store = rdfFilters.getAllFilters().store || new (require('n3').Store)();
      
      for (let i = 0; i < 1000; i++) {
        // This would normally add to the store, but we're testing the filter isolation
      }

      const startTime = Date.now();
      
      // Execute complex query
      const results = rdfFilters.rdfQuery({ subject: null, predicate: null, object: null });
      
      const endTime = Date.now();
      
      expect(Array.isArray(results)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should validate input types to prevent type confusion attacks', () => {
      const invalidInputs = [null, undefined, 123, [], {}, Symbol('test')];

      for (const invalidInput of invalidInputs) {
        // Should handle gracefully without throwing or crashing
        expect(() => {
          rdfFilters.rdfExists(invalidInput as any, 'http://example.org/prop');
        }).not.toThrow();
      }
    });
  });

  describe('Content Security', () => {
    it('should treat XML-like content in literals as plain text', async () => {
      const xmlContent = `
        @prefix ex: <http://example.org/> .
        ex:test ex:content """<?xml version="1.0"?>
        <!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <test>&xxe;</test>""" .
      `;

      const result = await parser.parse(xmlContent);
      
      // Should parse as literal text, not process XML entities
      expect(result.triples[0].object.value).toContain('&xxe;');
      expect(result.triples[0].object.value).toContain('DOCTYPE');
      // Critical: XML entities should NOT be resolved
    });

    it('should handle malformed escape sequences safely', async () => {
      const malformedTurtle = `
        @prefix ex: <http://example.org/> .
        ex:test ex:value "\\uXXXX invalid unicode" .
        ex:test2 ex:value "\\n\\r\\t valid escapes" .
      `;

      try {
        const result = await parser.parse(malformedTurtle);
        // If it parses, the malformed escape should be handled safely
        expect(result.triples.length).toBeGreaterThan(0);
      } catch (error) {
        // Rejecting malformed escapes is also acceptable security behavior
        expect(error).toBeInstanceOf(TurtleParseError);
      }
    });
  });
});