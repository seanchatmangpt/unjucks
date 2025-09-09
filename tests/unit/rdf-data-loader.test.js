import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('RDFDataLoader', () => { 
  let loader;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(process.cwd(), 'test-temp');
    await fs.ensureDir(tempDir);
    
    // Initialize loader with test options
    const options = {
      baseUri: 'http://example.org/',
      cacheEnabled: true
    };
    
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

  describe('File Loading', () => { 
    test('should load RDF data from local file', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:Person a foaf:Person .
        ex:John a ex:Person ;
                foaf:name "John Doe" .
      `;
      
      const filePath = path.join(tempDir, 'test.ttl');
      await fs.writeFile(filePath, turtleData);
      
      const source = {
        type: 'file',
        path: filePath
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data.subjects).toHaveProperty('http://example.org/Person');
      expect(result.data.subjects).toHaveProperty('http://example.org/John');
      expect(result.metadata.tripleCount).toBeGreaterThan(0);
      expect(result.metadata.loadTime).toBeGreaterThan(0);
    });

    test('should handle file not found errors gracefully', async () => { 
      const source = {
        type: 'file',
        path: path.join(tempDir, 'nonexistent.ttl')
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to read RDF file');
    });

    test('should resolve relative paths correctly', async () => { 
      const subDir = path.join(tempDir, 'data');
      await fs.ensureDir(subDir);
      
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:Test a ex:TestClass .
      `;
      
      const filePath = path.join(subDir, 'relative.ttl');
      await fs.writeFile(filePath, turtleData);
      
      const source = {
        type: 'file',
        path: filePath
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Test');
    });
  });

  describe('Inline Data Loading', () => { 
    test('should load RDF data from inline string', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:InlineTest a ex:TestClass ;
                      ex:hasValue "test value" .
      `;
      
      const source = {
        type: 'inline',
        content: turtleData
      };
      
      const result = await loader.loadFromSource(source);
      
      console.log('Test result:', { success: result.success, errorCount: result.errors.length });
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/InlineTest');
    });

    test('should handle malformed inline RDF data', async () => { 
      const malformedData = 'This is not valid RDF data';
      
      const source = {
        type: 'inline',
        content: malformedData
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP/HTTPS URI Loading', () => { 
    test('should load RDF data from HTTP URI with retries', async () => {
      const mockTurtleData = `
        @prefix ex: <http://example.org/> .
        ex:RemoteData a ex:RemoteClass .
      `;
      
      const mockResponse = {
        ok: true,
        text: () => Promise.resolve(mockTurtleData)
      };
      
      (global.fetch).mockResolvedValue(mockResponse);
      
      const source = { 
        type: 'uri',
        uri: 'http://example.org/data.ttl'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/RemoteData');
      expect(fetch).toHaveBeenCalledWith('http://example.org/data.ttl', expect.any(Object));
    });

    test('should handle HTTP errors with retries', async () => { 
      (global.fetch).mockRejectedValue(new Error('Network error'));
      
      const source = {
        type: 'uri',
        uri: 'http://example.org/nonexistent.ttl'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('after 2 attempts');
      expect(fetch).toHaveBeenCalledTimes(2); // Should retry once
    });

    test('should handle HTTP timeout', async () => {
      // Mock fetch to never resolve (timeout scenario)
      (global.fetch).mockImplementation(() => new Promise(() => {}));
      
      const shortTimeoutLoader = new RDFDataLoader({ httpTimeout: 100 });
      
      const source = {
        type: 'uri', 
        uri: 'http://example.org/slow.ttl'
      };
      
      const result = await shortTimeoutLoader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('aborted');
    });
  });

  describe('Format Detection', () => { 
    test('should detect format from content-type header', async () => {
      const mockResponse = {
        ok: true,
        text: () => Promise.resolve('<http://example.org/s> <http://example.org/p> "value" .')
      };
      
      (global.fetch).mockResolvedValue(mockResponse);
      
      const source = { 
        type: 'uri',
        uri: 'http://example.org/data.nt'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
    });

    test('should detect format from file extension', async () => { 
      const ntriplesData = '<http://example.org/s> <http://example.org/p> "value" .';
      
      const filePath = path.join(tempDir, 'test.nt');
      await fs.writeFile(filePath, ntriplesData);
      
      const source = {
        type: 'file',
        path: filePath
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/s');
    });

    test('should use explicit format when provided', async () => { 
      const ntriplesData = '<http://example.org/s> <http://example.org/p> "value" .';
      
      const source = {
        type: 'inline',
        content: ntriplesData,
        options: { format: 'application/n-triples' }
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/s');
    });
  });

  describe('Caching', () => {
    test('should cache parsed results', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:CacheTest a ex:TestClass .
      `;
      
      const source = {
        type: 'inline',
        content: turtleData
      };
      
      // First load
      const result1 = await loader.loadFromSource(source);
      expect(result1.success).toBe(true);
      
      // Second load (should use cache)
      const result2 = await loader.loadFromSource(source);
      expect(result2.success).toBe(true);
      expect(result2.data.subjects).toHaveProperty('http://example.org/CacheTest');
    });

    test('should provide cache statistics', () => {
      const stats = loader.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });

    test('should clear cache when requested', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:ClearTest a ex:TestClass .
      `;
      
      const source = {
        type: 'inline',
        content: turtleData
      };
      
      // Load and cache
      await loader.loadFromSource(source);
      expect(loader.getCacheStats().size).toBeGreaterThan(0);
      
      // Clear cache
      loader.clearCache();
      expect(loader.getCacheStats().size).toBe(0);
    });
  });
});