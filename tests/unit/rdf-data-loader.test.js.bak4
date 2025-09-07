import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
// Mock fetch globally
global.fetch = vi.fn();

describe('RDFDataLoader', () => { let loader;
  let tempDir => {
    // Create temporary directory for test files
    tempDir = path.join(process.cwd(), 'test-temp');
    await fs.ensureDir(tempDir);
    
    // Initialize loader with test options
    const options = {
      baseUri };
    
    loader = new RDFDataLoader(options);
  });

  afterEach(async () => {
    // Clean up
    loader.clearCache();
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    vi.clearAllMocks();
  });

  describe('File Loading', () => { test('should load RDF data from local file', async () => {
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data.subjects).toHaveProperty('http://example.org/Person');
      expect(result.data.subjects).toHaveProperty('http://example.org/John');
      expect(result.variables).toHaveProperty('Person');
      expect(result.variables).toHaveProperty('John');
      expect(result.metadata.tripleCount).toBeGreaterThan(0);
      expect(result.metadata.loadTime).toBeGreaterThan(0);
    });

    test('should handle file not found errors gracefully', async () => { const source = {
        type };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to read RDF file');
    });

    test('should resolve relative paths correctly', async () => { const subDir = path.join(tempDir, 'data');
      await fs.ensureDir(subDir);
      
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Test');
    });
  });

  describe('Inline Data Loading', () => { test('should load RDF data from inline string', async () => {
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      
      console.log('Test result:', { success });
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/InlineTest');
    });

    test('should handle malformed inline RDF data', async () => { const malformedData = 'This is not valid RDF data';
      
      const source = {
        type };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP/HTTPS URI Loading', () => { test('should load RDF data from HTTP URI with retries', async () => {
      const mockTurtleData = `
        @prefix ex }
      };
      
      (global.fetch).mockResolvedValue(mockResponse);
      
      const source = { type };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/RemoteData');
      expect(fetch).toHaveBeenCalledWith('http://example.org/data.ttl', expect.any(Object));
    });

    test('should handle HTTP errors with retries', async () => { (global.fetch).mockRejectedValue(new Error('Network error'));
      
      const source = {
        type };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('after 2 attempts');
      expect(fetch).toHaveBeenCalledTimes(2); // Should retry once
    });

    test('should handle HTTP timeout', async () => {
      // Mock fetch to never resolve (timeout scenario)
      (global.fetch).mockImplementation(() => new Promise(() => {}));
      
      const shortTimeoutLoader = new RDFDataLoader({ httpTimeout };
      
      const result = await shortTimeoutLoader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('aborted');
    });
  });

  describe('Format Detection', () => { test('should detect format from content-type header', async () => {
      const mockResponse = {
        ok,
        text }
      };
      
      (global.fetch).mockResolvedValue(mockResponse);
      
      const source = { type };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
    });

    test('should detect format from file extension', async () => { const ntriplesData = '<http };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/s');
    });

    test('should use explicit format when provided', async () => { const ntriplesData = '<http };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Caching', () => { test('should cache successful loads', async () => {
      const turtleData = '@prefix ex };
      
      // First load
      const result1 = await loader.loadFromSource(source);
      expect(result1.success).toBe(true);
      
      // Second load should be from cache
      const result2 = await loader.loadFromSource(source);
      expect(result2.success).toBe(true);
      expect(result2.data.subjects).toEqual(result1.data.subjects);
      
      // Check cache stats
      const stats = loader.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toHaveLength(1);
    });

    test('should handle cache TTL expiration', async () => {
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled,
        cacheTTL)
      });
      
      const source = { type };
      
      await shortTTLLoader.loadFromSource(source);
      expect(shortTTLLoader.getCacheStats().size).toBe(1);
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // This should trigger a reload, not use cache
      const result = await shortTTLLoader.loadFromSource(source);
      expect(result.success).toBe(true);
    });

    test('should clean up expired cache entries', async () => { const shortTTLLoader = new RDFDataLoader({
        cacheEnabled,
        cacheTTL);
      
      const source = {
        type };
      
      await shortTTLLoader.loadFromSource(source);
      expect(shortTTLLoader.getCacheStats().size).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Clean up expired entries
      const removedCount = shortTTLLoader.cleanupCache();
      expect(removedCount).toBe(1);
      expect(shortTTLLoader.getCacheStats().size).toBe(0);
    });
  });

  describe('Concurrency Control', () => { test('should handle concurrent loads of same resource', async () => {
      const turtleData = '@prefix ex };
      
      // Start multiple loads concurrently
      const promises = Array(5).fill(null).map(() => loader.loadFromSource(source));
      const results = await Promise.all(promises);
      
      // All should succeed and return the same data
      results.forEach(result => { expect(result.success).toBe(true);
        expect(result.data.subjects).toHaveProperty('http });
      
      // Should only have one cache entry despite multiple concurrent loads
      expect(loader.getCacheStats().size).toBe(1);
    });
  });

  describe('Variable Extraction', () => { test('should extract template variables correctly', async () => {
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.variables.Person).toBeDefined();
      expect(result.variables.Person.hasAge).toBe(25); // Should be converted to number
      expect(result.variables.Person.isActive).toBe(true); // Should be converted to boolean
      expect(result.variables.Person.createdAt).toBeInstanceOf(Date);
    });

    test('should filter variables when specified', async () => { const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.variables).toHaveProperty('Person');
      expect(result.variables).not.toHaveProperty('Company');
    });
  });

  describe('Frontmatter Integration', () => { test('should load from simple frontmatter configuration', async () => {
      const turtleData = '@prefix ex };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Test');
    });

    test('should load from detailed frontmatter configuration', async () => { const frontmatter = {
        rdf }
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.variables).toHaveProperty('Detailed');
    });

    test('should handle multiple RDF sources in frontmatter', async () => { const frontmatter = {
        rdfSources },
          { type }
        ]
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Source1');
      expect(result.data.subjects).toHaveProperty('http://example.org/Source2');
      expect(result.metadata.sourceCount).toBe(2);
    });

    test('should return empty result for missing RDF configuration', async () => { const frontmatter = {
        to };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.data.subjects)).toHaveLength(0);
      expect(Object.keys(result.variables)).toHaveLength(0);
    });
  });

  describe('SPARQL-like Queries', () => { let testData => {
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      testData = result.data;
    });

    test('should execute basic subject query', async () => { const query = {
        subject };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].name.value).toBe('Alice Smith');
    });

    test('should execute type-based filtering', async () => { const query = {
        predicate };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings.length).toBeGreaterThanOrEqual(3); // All three persons
    });

    test('should apply custom filter function', async () => { const query = {
        filter }
      };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings.length).toBeGreaterThan(0);
    });

    test('should apply limit and offset', async () => { const query = {
        limit };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings).toHaveLength(2);
    });
  });

  describe('Template Context Creation', () => { test('should create proper template context', async () => {
      const turtleData = `
        @prefix ex };
      
      const result = await loader.loadFromSource(source);
      const context = loader.createTemplateContext(result.data, result.variables);
      
      expect(context.$rdf).toBeDefined();
      expect(context.$rdf.subjects).toBeDefined();
      expect(context.$rdf.prefixes).toBeDefined();
      expect(typeof context.$rdf.query).toBe('function');
      expect(typeof context.$rdf.getByType).toBe('function');
      expect(typeof context.$rdf.compact).toBe('function');
      expect(typeof context.$rdf.expand).toBe('function');
      
      // Test helper functions
      const compacted = context.$rdf.compact('http://example.org/TestResource');
      expect(compacted).toContain(':');
      
      const expanded = context.$rdf.expand('ex:TestResource');
      expect(expanded).toBe('http://example.org/TestResource');
    });
  });

  describe('Data Validation', () => { test('should validate correct RDF syntax', async () => {
      const validTurtle = `
        @prefix ex });

    test('should detect invalid RDF syntax', async () => { const invalidTurtle = `
        @prefix ex });

    test('should warn about empty RDF data', async () => { const emptyTurtle = `
        @prefix ex });
  });

  describe('Error Handling', () => { test('should validate data source configuration', async () => {
      const invalidSource = {
        type };
      
      const result = await loader.loadFromSource(invalidSource);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid RDF data source type');
    });

    test('should handle missing source property', async () => { const invalidSource = {
        type };
      
      const result = await loader.loadFromSource(invalidSource);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('must have a source property');
    });

    test('should handle malformed frontmatter', async () => {
      const invalidFrontmatter = null;
      
      const result = await loader.loadFromFrontmatter(invalidFrontmatter);
      
      expect(result.success).toBe(true); // Should return empty result, not error
      expect(Object.keys(result.data.subjects)).toHaveLength(0);
    });
  });
});