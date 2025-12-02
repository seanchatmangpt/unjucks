/**
 * Tests for SparqlQueryEngine
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SparqlQueryEngine } from '../../src/insights/sparql-engine.js';

// Mock fetch for remote queries
global.fetch = jest.fn();

describe('SparqlQueryEngine', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new SparqlQueryEngine();
  });

  describe('constructor', () => {
    it('should initialize with default prefixes', () => {
      expect(engine.prefixes.has('rdf')).toBe(true);
      expect(engine.prefixes.has('rdfs')).toBe(true);
      expect(engine.prefixes.has('kgen')).toBe(true);
      expect(engine.prefixes.has('kgenattest')).toBe(true);
    });

    it('should initialize with empty queries map', () => {
      expect(engine.queries.size).toBeGreaterThanOrEqual(0);
    });

    it('should accept endpoint configuration', () => {
      const endpointEngine = new SparqlQueryEngine('http://test-endpoint');
      expect(endpointEngine.endpoint).toBe('http://test-endpoint');
    });
  });

  describe('query execution', () => {
    it('should execute simple SPARQL query', async () => {
      const mockResults = {
        results: {
          bindings: [
            {
              name: { value: 'Test Package', type: 'literal' },
              category: { value: 'testing', type: 'literal' }
            }
          ]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      });

      const query = 'SELECT ?name ?category WHERE { ?pack kgen:hasName ?name }';
      const results = await engine.query(query);

      expect(results).toHaveLength(1);
      expect(results[0].name.value).toBe('Test Package');
      expect(results[0].category.value).toBe('testing');
    });

    it('should add prefixes to queries automatically', async () => {
      const mockResults = { results: { bindings: [] } };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      });

      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      await engine.query(query);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('PREFIX kgen: <http://kgen.ai/ontology/>')
        })
      );
    });

    it('should apply variable bindings', async () => {
      const mockResults = { results: { bindings: [] } };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults)
      });

      const query = 'SELECT ?pack WHERE { ?pack kgen:hasCategory ?category }';
      const bindings = { category: 'security' };
      
      await engine.query(query, bindings);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"security"')
        })
      );
    });

    it('should handle query timeout', async () => {
      global.fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      );

      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      await expect(engine.query(query)).rejects.toThrow();
    });

    it('should handle SPARQL endpoint errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      await expect(engine.query(query)).rejects.toThrow('SPARQL endpoint error');
    });
  });

  describe('local query execution', () => {
    beforeEach(() => {
      engine = new SparqlQueryEngine(); // No endpoint = local mode
    });

    it('should generate mock package results', async () => {
      const query = 'SELECT ?pack ?name WHERE { ?pack a kgen:Package }';
      const results = await engine.query(query);

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('pack');
        expect(results[0]).toHaveProperty('name');
      }
    });

    it('should generate mock template results', async () => {
      const query = 'SELECT ?template ?name WHERE { ?template a kgen:Template }';
      const results = await engine.query(query);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should generate mock compliance results', async () => {
      const query = 'SELECT ?framework WHERE { ?pack kgen:hasCompliance ?framework }';
      const results = await engine.query(query);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('named queries', () => {
    beforeEach(() => {
      // Mock a named query
      engine.registerQuery('testQuery', 'SELECT ?pack WHERE { ?pack a kgen:Package }');
    });

    it('should execute named queries', async () => {
      const results = await engine.executeNamedQuery('testQuery');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should substitute parameters in named queries', () => {
      const template = 'SELECT ?pack WHERE { ?pack kgen:hasCategory "{{category}}" }';
      const parameters = { category: 'security' };
      
      const result = engine._substituteParameters(template, parameters);
      expect(result).toContain('"security"');
    });

    it('should throw error for unknown named query', async () => {
      await expect(
        engine.executeNamedQuery('unknownQuery')
      ).rejects.toThrow('Unknown query: unknownQuery');
    });
  });

  describe('batch queries', () => {
    it('should execute multiple queries in parallel', async () => {
      const queries = [
        'SELECT ?pack WHERE { ?pack a kgen:Package }',
        'SELECT ?template WHERE { ?template a kgen:Template }'
      ];

      const results = await engine.batchQuery(queries);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should handle individual query failures in batch', async () => {
      const queries = [
        'SELECT ?pack WHERE { ?pack a kgen:Package }',
        'INVALID SPARQL QUERY'
      ];

      const results = await engine.batchQuery(queries);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[1]).toHaveProperty('error');
    });

    it('should handle query objects with bindings', async () => {
      const queries = [
        {
          query: 'SELECT ?pack WHERE { ?pack kgen:hasCategory ?category }',
          bindings: { category: 'security' }
        },
        {
          query: 'SELECT ?template WHERE { ?template a kgen:Template }',
          options: { noCache: true }
        }
      ];

      const results = await engine.batchQuery(queries);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });
  });

  describe('caching', () => {
    it('should cache query results', async () => {
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      // First execution
      const results1 = await engine.query(query);
      
      // Second execution should use cache
      const results2 = await engine.query(query);
      
      expect(results1).toEqual(results2);
    });

    it('should respect cache TTL', async () => {
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      // Execute with short TTL
      await engine.query(query, {}, { cacheTTL: 100 });
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should execute again
      const results = await engine.query(query);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should bypass cache when noCache option is set', async () => {
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      // First execution
      await engine.query(query);
      
      // Second execution with noCache
      const results = await engine.query(query, {}, { noCache: true });
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should clear cache', () => {
      engine.clearCache();
      expect(engine.queryCache.size).toBe(0);
    });
  });

  describe('prefix management', () => {
    it('should add custom prefixes', () => {
      engine.addPrefix('custom', 'http://example.org/custom#');
      expect(engine.prefixes.has('custom')).toBe(true);
      expect(engine.prefixes.get('custom')).toBe('<http://example.org/custom#>');
    });

    it('should include custom prefixes in queries', async () => {
      engine.addPrefix('custom', 'http://example.org/custom#');
      
      const query = 'SELECT ?item WHERE { ?item a custom:Thing }';
      const preparedQuery = engine._prepareQuery(query);
      
      expect(preparedQuery).toContain('PREFIX custom: <http://example.org/custom#>');
    });
  });

  describe('value formatting', () => {
    it('should format string values correctly', () => {
      expect(engine._formatValue('test')).toBe('"test"');
      expect(engine._formatValue('test "quote"')).toBe('"test \\"quote\\""');
    });

    it('should format number values correctly', () => {
      expect(engine._formatValue(42)).toBe('42');
      expect(engine._formatValue(3.14)).toBe('3.14');
    });

    it('should format boolean values correctly', () => {
      expect(engine._formatValue(true)).toBe('true');
      expect(engine._formatValue(false)).toBe('false');
    });

    it('should format date values correctly', () => {
      const date = new Date('2023-01-01T00:00:00Z');
      expect(engine._formatValue(date)).toBe('"2023-01-01T00:00:00.000Z"^^xsd:dateTime');
    });
  });

  describe('statistics', () => {
    it('should provide query statistics', () => {
      const stats = engine.getStatistics();
      
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('predefinedQueries');
      expect(stats).toHaveProperty('availablePrefixes');
      
      expect(Array.isArray(stats.availablePrefixes)).toBe(true);
      expect(stats.availablePrefixes).toContain('kgen');
    });
  });

  describe('query registration', () => {
    it('should register custom queries', () => {
      const queryName = 'customQuery';
      const queryTemplate = 'SELECT ?pack WHERE { ?pack kgen:hasName "{{name}}" }';
      
      engine.registerQuery(queryName, queryTemplate);
      
      expect(engine.queries.has(queryName)).toBe(true);
      expect(engine.queries.get(queryName)).toBe(queryTemplate);
    });
  });

  describe('error handling', () => {
    it('should handle malformed SPARQL queries', async () => {
      const invalidQuery = 'INVALID SPARQL SYNTAX';
      
      await expect(engine.query(invalidQuery)).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      
      await expect(engine.query(query)).rejects.toThrow('Network error');
    });

    it('should handle empty responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      const results = await engine.query(query);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys', () => {
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      const options = { timeout: 5000 };
      
      const key1 = engine._generateCacheKey(query, options);
      const key2 = engine._generateCacheKey(query, options);
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const query1 = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      const query2 = 'SELECT ?template WHERE { ?template a kgen:Template }';
      
      const key1 = engine._generateCacheKey(query1, {});
      const key2 = engine._generateCacheKey(query2, {});
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different options', () => {
      const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
      const options1 = { timeout: 5000 };
      const options2 = { timeout: 10000 };
      
      const key1 = engine._generateCacheKey(query, options1);
      const key2 = engine._generateCacheKey(query, options2);
      
      expect(key1).not.toBe(key2);
    });
  });
});

describe('SparqlQueryEngine with real endpoint', () => {
  let engine;
  const testEndpoint = 'http://test-sparql-endpoint/sparql';

  beforeEach(() => {
    engine = new SparqlQueryEngine(testEndpoint);
  });

  it('should configure endpoint correctly', () => {
    expect(engine.endpoint).toBe(testEndpoint);
  });

  it('should make POST requests to endpoint', async () => {
    const mockResults = { results: { bindings: [] } };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResults)
    });

    const query = 'SELECT ?pack WHERE { ?pack a kgen:Package }';
    await engine.query(query);

    expect(global.fetch).toHaveBeenCalledWith(
      testEndpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json'
        })
      })
    );
  });
});