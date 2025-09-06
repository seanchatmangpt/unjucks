import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import type { RDFDataSource, RDFDataLoaderOptions } from '../../src/lib/types/turtle-types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('RDFDataLoader', () => {
  let loader: RDFDataLoader;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(process.cwd(), 'test-temp');
    await fs.ensureDir(tempDir);
    
    // Initialize loader with test options
    const options: RDFDataLoaderOptions = {
      baseUri: 'http://example.org/',
      cacheEnabled: true,
      validateSyntax: true,
      templateDir: tempDir,
      httpTimeout: 5000,
      maxRetries: 2,
      cacheTTL: 60000
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
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Person a rdfs:Class ;
            rdfs:label "Person"@en ;
            rdfs:comment "A human being"@en .
            
        ex:John a ex:Person ;
            rdfs:label "John Doe"@en ;
            ex:age 30 ;
            ex:email "john@example.org" .
      `;
      
      const testFile = path.join(tempDir, 'test.ttl');
      await fs.writeFile(testFile, turtleData);
      
      const source: RDFDataSource = {
        type: 'file',
        source: 'test.ttl',
        format: 'text/turtle'
      };
      
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

    test('should handle file not found errors gracefully', async () => {
      const source: RDFDataSource = {
        type: 'file',
        source: 'nonexistent.ttl'
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
        ex:Test rdfs:label "Test" .
      `;
      
      await fs.writeFile(path.join(subDir, 'nested.ttl'), turtleData);
      
      const source: RDFDataSource = {
        type: 'file',
        source: 'data/nested.ttl'
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
        ex:InlineTest rdfs:label "Inline Test"@en .
      `;
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData,
        format: 'text/turtle'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/InlineTest');
    });

    test('should handle malformed inline RDF data', async () => {
      const malformedData = 'This is not valid RDF data';
      
      const source: RDFDataSource = {
        type: 'inline',
        source: malformedData
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
        ex:RemoteData rdfs:label "Remote Data"@en .
      `;
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(mockTurtleData),
        headers: {
          get: vi.fn()
            .mockReturnValueOnce('text/turtle')
            .mockReturnValueOnce('"abc123"')
            .mockReturnValueOnce('Wed, 21 Oct 2015 07:28:00 GMT')
        }
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      const source: RDFDataSource = {
        type: 'uri',
        source: 'http://example.org/data.ttl'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/RemoteData');
      expect(fetch).toHaveBeenCalledWith('http://example.org/data.ttl', expect.any(Object));
    });

    test('should handle HTTP errors with retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const source: RDFDataSource = {
        type: 'uri',
        source: 'http://example.org/data.ttl'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('after 2 attempts');
      expect(fetch).toHaveBeenCalledTimes(2); // Should retry once
    });

    test('should handle HTTP timeout', async () => {
      // Mock fetch to never resolve (timeout scenario)
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));
      
      const shortTimeoutLoader = new RDFDataLoader({
        httpTimeout: 100, // Very short timeout
        maxRetries: 1
      });
      
      const source: RDFDataSource = {
        type: 'uri',
        source: 'http://example.org/slow-data.ttl'
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
        text: vi.fn().mockResolvedValue('<http://example.org/s> <http://example.org/p> "object" .'),
        headers: {
          get: vi.fn()
            .mockReturnValueOnce('application/n-triples')
        }
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      const source: RDFDataSource = {
        type: 'uri',
        source: 'http://example.org/data'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
    });

    test('should detect format from file extension', async () => {
      const ntriplesData = '<http://example.org/s> <http://example.org/p> "object" .';
      const testFile = path.join(tempDir, 'test.nt');
      await fs.writeFile(testFile, ntriplesData);
      
      const source: RDFDataSource = {
        type: 'file',
        source: 'test.nt'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/s');
    });

    test('should use explicit format when provided', async () => {
      const ntriplesData = '<http://example.org/s> <http://example.org/p> "object" .';
      
      const source: RDFDataSource = {
        type: 'inline',
        source: ntriplesData,
        format: 'application/n-triples'
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Caching', () => {
    test('should cache successful loads', async () => {
      const turtleData = '@prefix ex: <http://example.org/> . ex:Cached rdfs:label "Cached" .';
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData
      };
      
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
        cacheEnabled: true,
        cacheTTL: 10 // Very short TTL (10ms)
      });
      
      const source: RDFDataSource = {
        type: 'inline',
        source: '@prefix ex: <http://example.org/> . ex:Test rdfs:label "Test" .'
      };
      
      await shortTTLLoader.loadFromSource(source);
      expect(shortTTLLoader.getCacheStats().size).toBe(1);
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // This should trigger a reload, not use cache
      const result = await shortTTLLoader.loadFromSource(source);
      expect(result.success).toBe(true);
    });

    test('should clean up expired cache entries', async () => {
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled: true,
        cacheTTL: 10
      });
      
      const source: RDFDataSource = {
        type: 'inline',
        source: '@prefix ex: <http://example.org/> . ex:Test rdfs:label "Test" .'
      };
      
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

  describe('Concurrency Control', () => {
    test('should handle concurrent loads of same resource', async () => {
      const turtleData = '@prefix ex: <http://example.org/> . ex:Concurrent rdfs:label "Concurrent Test" .';
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData
      };
      
      // Start multiple loads concurrently
      const promises = Array(5).fill(null).map(() => loader.loadFromSource(source));
      const results = await Promise.all(promises);
      
      // All should succeed and return the same data
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.subjects).toHaveProperty('http://example.org/Concurrent');
      });
      
      // Should only have one cache entry despite multiple concurrent loads
      expect(loader.getCacheStats().size).toBe(1);
    });
  });

  describe('Variable Extraction', () => {
    test('should extract template variables correctly', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:Person rdfs:label "Person Class"@en ;
            ex:hasAge "25"^^xsd:integer ;
            ex:isActive "true"^^xsd:boolean ;
            ex:createdAt "2023-01-01"^^xsd:date .
      `;
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.variables.Person).toBeDefined();
      expect(result.variables.Person.hasAge).toBe(25); // Should be converted to number
      expect(result.variables.Person.isActive).toBe(true); // Should be converted to boolean
      expect(result.variables.Person.createdAt).toBeInstanceOf(Date);
    });

    test('should filter variables when specified', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        
        ex:Person rdfs:label "Person"@en ;
            ex:name "John Doe"@en ;
            ex:age 30 .
            
        ex:Company rdfs:label "Company"@en ;
            ex:name "ACME Corp"@en .
      `;
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData,
        variables: ['Person'] // Only extract Person variables
      };
      
      const result = await loader.loadFromSource(source);
      
      expect(result.success).toBe(true);
      expect(result.variables).toHaveProperty('Person');
      expect(result.variables).not.toHaveProperty('Company');
    });
  });

  describe('Frontmatter Integration', () => {
    test('should load from simple frontmatter configuration', async () => {
      const turtleData = '@prefix ex: <http://example.org/> . ex:Test rdfs:label "Test" .';
      const testFile = path.join(tempDir, 'frontmatter.ttl');
      await fs.writeFile(testFile, turtleData);
      
      const frontmatter = {
        rdf: 'frontmatter.ttl'
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Test');
    });

    test('should load from detailed frontmatter configuration', async () => {
      const frontmatter = {
        rdf: {
          type: 'inline' as const,
          source: '@prefix ex: <http://example.org/> . ex:Detailed rdfs:label "Detailed Config" .',
          format: 'text/turtle',
          variables: ['Detailed']
        }
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.variables).toHaveProperty('Detailed');
    });

    test('should handle multiple RDF sources in frontmatter', async () => {
      const frontmatter = {
        rdfSources: [
          {
            type: 'inline' as const,
            source: '@prefix ex: <http://example.org/> . ex:Source1 rdfs:label "Source 1" .'
          },
          {
            type: 'inline' as const,
            source: '@prefix ex: <http://example.org/> . ex:Source2 rdfs:label "Source 2" .'
          }
        ]
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.data.subjects).toHaveProperty('http://example.org/Source1');
      expect(result.data.subjects).toHaveProperty('http://example.org/Source2');
      expect(result.metadata.sourceCount).toBe(2);
    });

    test('should return empty result for missing RDF configuration', async () => {
      const frontmatter = {
        to: 'some-file.txt',
        inject: true
        // No RDF configuration
      };
      
      const result = await loader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.data.subjects)).toHaveLength(0);
      expect(Object.keys(result.variables)).toHaveLength(0);
    });
  });

  describe('SPARQL-like Queries', () => {
    let testData: any;
    
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:Person1 a foaf:Person ;
            foaf:name "Alice Smith" ;
            ex:age 25 ;
            ex:department "Engineering" .
            
        ex:Person2 a foaf:Person ;
            foaf:name "Bob Jones" ;
            ex:age 30 ;
            ex:department "Marketing" .
            
        ex:Person3 a foaf:Person ;
            foaf:name "Carol Brown" ;
            ex:age 28 ;
            ex:department "Engineering" .
      `;
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData
      };
      
      const result = await loader.loadFromSource(source);
      testData = result.data;
    });

    test('should execute basic subject query', async () => {
      const query = {
        subject: 'http://example.org/Person1'
      };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].name.value).toBe('Alice Smith');
    });

    test('should execute type-based filtering', async () => {
      const query = {
        predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: 'http://xmlns.com/foaf/0.1/Person'
      };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings.length).toBeGreaterThanOrEqual(3); // All three persons
    });

    test('should apply custom filter function', async () => {
      const query = {
        filter: (resource: any) => {
          const age = resource.properties['http://example.org/age'];
          return age && age[0] && parseInt(age[0].value) > 26;
        }
      };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings.length).toBeGreaterThan(0);
    });

    test('should apply limit and offset', async () => {
      const query = {
        limit: 2,
        offset: 1
      };
      
      const result = await loader.executeQuery(testData, query);
      
      expect(result.success).toBe(true);
      expect(result.bindings).toHaveLength(2);
    });
  });

  describe('Template Context Creation', () => {
    test('should create proper template context', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:TestResource rdfs:label "Test Resource"@en ;
            ex:value 42 .
      `;
      
      const source: RDFDataSource = {
        type: 'inline',
        source: turtleData
      };
      
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

  describe('Data Validation', () => {
    test('should validate correct RDF syntax', async () => {
      const validTurtle = `
        @prefix ex: <http://example.org/> .
        ex:Valid rdfs:label "Valid Resource"@en .
      `;
      
      const result = await loader.validateRDF(validTurtle, 'turtle');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid RDF syntax', async () => {
      const invalidTurtle = `
        @prefix ex: <http://example.org/> .
        ex:Invalid rdfs:label "Missing quote ;
      `;
      
      const result = await loader.validateRDF(invalidTurtle, 'turtle');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should warn about empty RDF data', async () => {
      const emptyTurtle = `
        @prefix ex: <http://example.org/> .
        # No actual triples
      `;
      
      const result = await loader.validateRDF(emptyTurtle, 'turtle');
      
      expect(result.valid).toBe(true); // Syntax is valid
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('No RDF triples found');
    });
  });

  describe('Error Handling', () => {
    test('should validate data source configuration', async () => {
      const invalidSource = {
        type: 'invalid' as any,
        source: 'test'
      };
      
      const result = await loader.loadFromSource(invalidSource);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid RDF data source type');
    });

    test('should handle missing source property', async () => {
      const invalidSource = {
        type: 'file' as const,
        source: ''
      };
      
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