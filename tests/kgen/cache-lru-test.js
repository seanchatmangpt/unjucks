/**
 * LRU Cache Implementation Tests
 * Tests the standardized LRU cache with eviction, TTL, and statistics
 */

import { strict as assert } from 'assert';
import { LRUCache, SPARQLQueryCache, TemplateCache } from '../../src/kgen/cache/lru-cache.js';

describe('LRU Cache Tests', () => {
  
  describe('Basic LRU Cache', () => {
    let cache;
    
    beforeEach(() => {
      cache = new LRUCache({
        maxSize: 3,
        ttl: 1000, // 1 second
        enableStats: true
      });
    });
    
    afterEach(() => {
      cache.destroy();
    });
    
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      assert.equal(cache.get('key1'), 'value1');
      assert.equal(cache.get('key2'), 'value2');
      assert.equal(cache.size(), 2);
    });
    
    it('should evict least recently used items when full', () => {
      // Fill cache to capacity
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      assert.equal(cache.size(), 3);
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add new item - should evict key2 (least recently used)
      cache.set('key4', 'value4');
      
      assert.equal(cache.size(), 3);
      assert.equal(cache.get('key1'), 'value1'); // Still exists
      assert.equal(cache.get('key2'), null); // Evicted
      assert.equal(cache.get('key3'), 'value3'); // Still exists
      assert.equal(cache.get('key4'), 'value4'); // New item
    });
    
    it('should handle TTL expiration', async () => {
      cache.set('expiring', 'value');
      assert.equal(cache.get('expiring'), 'value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      assert.equal(cache.get('expiring'), null);
    });
    
    it('should track statistics correctly', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Generate hits and misses
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('missing'); // miss
      cache.get('key2'); // hit
      cache.get('missing2'); // miss
      
      const stats = cache.getStats();
      assert.equal(stats.hits, 3);
      assert.equal(stats.misses, 2);
      assert.equal(stats.sets, 2);
      assert.equal(stats.hitRate, 60); // 3/(3+2) * 100
    });
    
    it('should handle memory pressure with evictions', () => {
      const smallCache = new LRUCache({ maxSize: 2, enableStats: true });
      
      // Fill beyond capacity
      smallCache.set('a', 'value_a');
      smallCache.set('b', 'value_b');
      smallCache.set('c', 'value_c'); // Should evict 'a'
      
      const stats = smallCache.getStats();
      assert.equal(stats.evictions, 1);
      assert.equal(smallCache.get('a'), null); // Evicted
      assert.equal(smallCache.get('b'), 'value_b');
      assert.equal(smallCache.get('c'), 'value_c');
      
      smallCache.destroy();
    });
  });
  
  describe('SPARQL Query Cache', () => {
    let queryCache;
    
    beforeEach(() => {
      queryCache = new SPARQLQueryCache({
        maxCacheSize: 5,
        cacheTTL: 2000,
        enableStats: true
      });
    });
    
    afterEach(() => {
      queryCache.destroy();
    });
    
    it('should cache SPARQL query results', () => {
      const query = 'SELECT * WHERE { ?s ?p ?o }';
      const results = { 
        results: { bindings: [{ s: 'test1', p: 'test2', o: 'test3' }] }
      };
      const options = { limit: 10 };
      
      // Cache results
      queryCache.cacheResults(query, results, options);
      
      // Retrieve cached results
      const cached = queryCache.getCachedResults(query, options);
      assert.deepEqual(cached.results, results.results);
      assert(cached.cachedAt);
    });
    
    it('should generate different keys for different queries/options', () => {
      const query1 = 'SELECT * WHERE { ?s ?p ?o }';
      const query2 = 'SELECT ?s WHERE { ?s ?p ?o }';
      const options1 = { limit: 10 };
      const options2 = { limit: 20 };
      
      const key1a = queryCache.generateKey(query1, options1);
      const key1b = queryCache.generateKey(query1, options2);
      const key2 = queryCache.generateKey(query2, options1);
      
      assert.notEqual(key1a, key1b);
      assert.notEqual(key1a, key2);
      assert.notEqual(key1b, key2);
    });
  });
  
  describe('Template Cache', () => {
    let templateCache;
    
    beforeEach(() => {
      templateCache = new TemplateCache({
        maxSize: 3,
        ttl: 1000
      });
    });
    
    afterEach(() => {
      templateCache.destroy();
    });
    
    it('should cache templates with context', () => {
      const templatePath = '/templates/test.ejs';
      const content = '<h1>{{title}}</h1>';
      const context = { title: 'Test' };
      
      templateCache.cacheTemplate(templatePath, content, context);
      
      const cached = templateCache.getCachedTemplate(templatePath, context);
      assert.equal(cached.content, content);
      assert.equal(cached.path, templatePath);
      assert.deepEqual(cached.context, context);
    });
    
    it('should generate different keys for different contexts', () => {
      const path = '/templates/test.ejs';
      const context1 = { title: 'Test1' };
      const context2 = { title: 'Test2' };
      
      const key1 = templateCache.generateKey(path, context1);
      const key2 = templateCache.generateKey(path, context2);
      
      assert.notEqual(key1, key2);
    });
  });
  
  describe('Cache Statistics and Performance', () => {
    it('should handle high-volume operations without memory leaks', () => {
      const cache = new LRUCache({ maxSize: 100, enableStats: true });
      
      // Generate many operations
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`);
        
        // Randomly access some keys
        if (i % 3 === 0) {
          cache.get(`key${Math.floor(i/2)}`);
        }
      }
      
      const stats = cache.getStats();
      
      // Should maintain size limit
      assert.equal(cache.size(), 100);
      
      // Should have evictions due to size limit
      assert(stats.evictions > 0);
      
      // Should track all operations
      assert.equal(stats.sets, 1000);
      assert(stats.totalRequests > 0);
      
      cache.destroy();
    });
    
    it('should provide detailed memory usage information', () => {
      const cache = new LRUCache({ maxSize: 10, enableStats: true });
      
      // Add items of varying sizes
      cache.set('small', 'x');
      cache.set('medium', 'x'.repeat(100));
      cache.set('large', 'x'.repeat(1000));
      
      const stats = cache.getStats();
      
      assert(stats.memoryUsage > 0);
      assert(stats.oldestEntry);
      assert(stats.newestEntry);
      
      cache.destroy();
    });
  });
  
  describe('Cache Export/Import', () => {
    it('should export and import cache state', () => {
      const cache1 = new LRUCache({ maxSize: 5, ttl: 5000 });
      
      // Populate cache
      cache1.set('key1', 'value1');
      cache1.set('key2', 'value2');
      cache1.get('key1'); // Create some stats
      
      // Export state
      const exported = cache1.export();
      
      // Create new cache and import
      const cache2 = new LRUCache({ maxSize: 5, ttl: 5000 });
      cache2.import(exported);
      
      // Verify data transferred
      assert.equal(cache2.get('key1'), 'value1');
      assert.equal(cache2.get('key2'), 'value2');
      assert.equal(cache2.size(), 2);
      
      cache1.destroy();
      cache2.destroy();
    });
  });
});