/**
 * Unit Tests for SharedMemoryInterface
 * Tests thread-safe memory operations, TTL, namespacing, and persistence
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SharedMemoryInterface', () => {
  let memoryInterface: SharedMemoryInterface;
  let testPersistPath: string;

  beforeEach(async () => {
    testPersistPath = join(tmpdir(), `memory-test-${Date.now()}`);
    
    memoryInterface = new SharedMemoryInterface({
      persistToDisk: true,
      persistPath: testPersistPath,
      defaultTTL: 3600,
      maxMemorySize: 10 * 1024 * 1024 // 10MB
    });

    await memoryInterface.initialize();
  });

  afterEach(async () => {
    if (memoryInterface) {
      await memoryInterface.cleanup();
    }
    
    if (existsSync(testPersistPath)) {
      rmSync(testPersistPath, { recursive: true, force: true });
    }
  });

  describe('Basic Operations', () => {
    it('should store and retrieve simple values', async () => {
      const testValue = { message: 'Hello, World!', timestamp: Date.now() };
      
      const stored = await memoryInterface.set('test-key', testValue);
      expect(stored).toBe(true);

      const retrieved = await memoryInterface.get('test-key');
      expect(retrieved).toEqual(testValue);
    });

    it('should handle complex nested objects', async () => {
      const complexValue = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            preferences: {
              theme: 'dark',
              notifications: ['email', 'push'],
              settings: {
                privacy: { level: 'strict' },
                performance: { caching: true }
              }
            }
          }
        },
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      await memoryInterface.set('complex-data', complexValue);
      const retrieved = await memoryInterface.get('complex-data');
      
      expect(retrieved).toEqual(complexValue);
    });

    it('should return null for non-existent keys', async () => {
      const retrieved = await memoryInterface.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should check key existence', async () => {
      await memoryInterface.set('exists-key', 'value');
      
      expect(await memoryInterface.has('exists-key')).toBe(true);
      expect(await memoryInterface.has('missing-key')).toBe(false);
    });

    it('should delete keys', async () => {
      await memoryInterface.set('delete-key', 'to-be-deleted');
      expect(await memoryInterface.has('delete-key')).toBe(true);

      const deleted = await memoryInterface.delete('delete-key');
      expect(deleted).toBe(true);
      expect(await memoryInterface.has('delete-key')).toBe(false);
    });
  });

  describe('Namespacing', () => {
    it('should isolate data by namespace', async () => {
      await memoryInterface.set('shared-key', 'namespace-1-value', { namespace: 'ns1' });
      await memoryInterface.set('shared-key', 'namespace-2-value', { namespace: 'ns2' });

      const value1 = await memoryInterface.get('shared-key', { namespace: 'ns1' });
      const value2 = await memoryInterface.get('shared-key', { namespace: 'ns2' });

      expect(value1).toBe('namespace-1-value');
      expect(value2).toBe('namespace-2-value');
      expect(value1).not.toBe(value2);
    });

    it('should list keys by namespace', async () => {
      await memoryInterface.set('key1', 'value1', { namespace: 'test' });
      await memoryInterface.set('key2', 'value2', { namespace: 'test' });
      await memoryInterface.set('key3', 'value3', { namespace: 'other' });
      await memoryInterface.set('key4', 'value4'); // default namespace

      const testKeys = await memoryInterface.listKeys({ namespace: 'test' });
      const otherKeys = await memoryInterface.listKeys({ namespace: 'other' });
      const defaultKeys = await memoryInterface.listKeys();

      expect(testKeys).toContain('key1');
      expect(testKeys).toContain('key2');
      expect(testKeys).not.toContain('key3');
      expect(testKeys).not.toContain('key4');

      expect(otherKeys).toContain('key3');
      expect(otherKeys).not.toContain('key1');

      expect(defaultKeys).toContain('key4');
    });

    it('should clear namespace', async () => {
      await memoryInterface.set('ns-key1', 'value1', { namespace: 'clear-test' });
      await memoryInterface.set('ns-key2', 'value2', { namespace: 'clear-test' });
      await memoryInterface.set('keep-key', 'keep-value', { namespace: 'keep' });

      await memoryInterface.clearNamespace('clear-test');

      expect(await memoryInterface.has('ns-key1', { namespace: 'clear-test' })).toBe(false);
      expect(await memoryInterface.has('ns-key2', { namespace: 'clear-test' })).toBe(false);
      expect(await memoryInterface.has('keep-key', { namespace: 'keep' })).toBe(true);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire keys after TTL', async () => {
      await memoryInterface.set('ttl-key', 'expires-soon', { ttl: 1 }); // 1 second TTL

      expect(await memoryInterface.has('ttl-key')).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(await memoryInterface.has('ttl-key')).toBe(false);
      expect(await memoryInterface.get('ttl-key')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      // Create interface with short default TTL for testing
      const shortTTLInterface = new SharedMemoryInterface({
        persistToDisk: false,
        defaultTTL: 1 // 1 second
      });

      await shortTTLInterface.initialize();
      
      await shortTTLInterface.set('default-ttl-key', 'expires-with-default');
      
      expect(await shortTTLInterface.has('default-ttl-key')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(await shortTTLInterface.has('default-ttl-key')).toBe(false);
      
      await shortTTLInterface.cleanup();
    });

    it('should update TTL on key access when configured', async () => {
      const refreshInterface = new SharedMemoryInterface({
        persistToDisk: false,
        defaultTTL: 2,
        refreshTTLOnAccess: true
      });

      await refreshInterface.initialize();
      
      await refreshInterface.set('refresh-key', 'refreshable-value', { ttl: 2 });
      
      // Access key after 1 second (should refresh TTL)
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refreshInterface.get('refresh-key');
      
      // Wait another 1.5 seconds (total 2.5s, but TTL should have been refreshed)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(await refreshInterface.has('refresh-key')).toBe(true);
      
      await refreshInterface.cleanup();
    });
  });

  describe('Access Control and Agent Isolation', () => {
    it('should enforce agent-based access control', async () => {
      await memoryInterface.set('agent-private', 'secret-data', {
        agentId: 'agent-1',
        accessControl: 'private'
      });

      // Same agent should access
      const sameAgentData = await memoryInterface.get('agent-private', {
        agentId: 'agent-1'
      });
      expect(sameAgentData).toBe('secret-data');

      // Different agent should not access
      const differentAgentData = await memoryInterface.get('agent-private', {
        agentId: 'agent-2'
      });
      expect(differentAgentData).toBeNull();
    });

    it('should allow shared access for public data', async () => {
      await memoryInterface.set('public-data', 'shared-info', {
        agentId: 'agent-1',
        accessControl: 'public'
      });

      const agent2Access = await memoryInterface.get('public-data', {
        agentId: 'agent-2'
      });
      expect(agent2Access).toBe('shared-info');
    });

    it('should track data ownership', async () => {
      await memoryInterface.set('owned-data', 'owner-info', {
        agentId: 'owner-agent',
        metadata: { sensitivity: 'high' }
      });

      const metadata = await memoryInterface.getMetadata('owned-data');
      expect(metadata?.agentId).toBe('owner-agent');
      expect(metadata?.metadata?.sensitivity).toBe('high');
    });
  });

  describe('Memory Limits and Cleanup', () => {
    it('should enforce memory size limits', async () => {
      // Create interface with very small memory limit
      const limitedInterface = new SharedMemoryInterface({
        persistToDisk: false,
        maxMemorySize: 1024 // 1KB limit
      });

      await limitedInterface.initialize();

      // Try to store data that exceeds limit
      const largeData = 'x'.repeat(2048); // 2KB string
      
      const stored = await limitedInterface.set('large-data', largeData);
      expect(stored).toBe(false); // Should fail due to size limit

      await limitedInterface.cleanup();
    });

    it('should perform LRU eviction when memory is full', async () => {
      const lruInterface = new SharedMemoryInterface({
        persistToDisk: false,
        maxMemorySize: 2048, // 2KB limit
        evictionPolicy: 'lru'
      });

      await lruInterface.initialize();

      // Fill memory
      await lruInterface.set('key1', 'x'.repeat(500));
      await lruInterface.set('key2', 'x'.repeat(500));
      await lruInterface.set('key3', 'x'.repeat(500));
      
      // Access key1 to make it recently used
      await lruInterface.get('key1');
      
      // Add more data to trigger eviction
      await lruInterface.set('key4', 'x'.repeat(600));
      
      // key2 or key3 should be evicted (least recently used)
      const key1Exists = await lruInterface.has('key1');
      const key4Exists = await lruInterface.has('key4');
      
      expect(key1Exists).toBe(true); // Recently accessed, should remain
      expect(key4Exists).toBe(true); // Just added, should exist

      await lruInterface.cleanup();
    });
  });

  describe('Thread Safety and Concurrency', () => {
    it('should handle concurrent reads and writes safely', async () => {
      const concurrentOperations = [];
      const testKey = 'concurrent-key';
      
      // Start multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          memoryInterface.set(`${testKey}-${i}`, `value-${i}`)
        );
      }
      
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          memoryInterface.get(`${testKey}-${i}`)
        );
      }
      
      const results = await Promise.all(concurrentOperations);
      
      // First 10 operations are sets (should all succeed)
      const setResults = results.slice(0, 10);
      expect(setResults.every(r => r === true)).toBe(true);
      
      // Next 10 operations are gets (should return values or null)
      const getResults = results.slice(10);
      expect(getResults.every(r => r === null || typeof r === 'string')).toBe(true);
    });

    it('should handle concurrent writes to same key', async () => {
      const writes = [];
      const testKey = 'race-condition-key';
      
      // Start concurrent writes to the same key
      for (let i = 0; i < 5; i++) {
        writes.push(
          memoryInterface.set(testKey, `value-${i}`)
        );
      }
      
      const results = await Promise.all(writes);
      
      // All writes should succeed (last writer wins)
      expect(results.every(r => r === true)).toBe(true);
      
      // Final value should be one of the written values
      const finalValue = await memoryInterface.get(testKey);
      expect(finalValue).toMatch(/^value-[0-4]$/);
    });
  });

  describe('Persistence', () => {
    it('should persist data to disk', async () => {
      await memoryInterface.set('persist-key', 'persistent-value');
      
      // Force persistence
      await memoryInterface.flush();
      
      expect(existsSync(testPersistPath)).toBe(true);
    });

    it('should restore data from disk', async () => {
      // Store data and close interface
      await memoryInterface.set('restore-key', 'restored-value');
      await memoryInterface.flush();
      await memoryInterface.cleanup();
      
      // Create new interface with same persist path
      const newInterface = new SharedMemoryInterface({
        persistToDisk: true,
        persistPath: testPersistPath
      });
      
      await newInterface.initialize();
      
      const restoredValue = await newInterface.get('restore-key');
      expect(restoredValue).toBe('restored-value');
      
      await newInterface.cleanup();
    });

    it('should handle persistence errors gracefully', async () => {
      // Create interface with invalid persist path
      const invalidInterface = new SharedMemoryInterface({
        persistToDisk: true,
        persistPath: '/invalid/path/that/does/not/exist'
      });
      
      // Should initialize but log warnings
      await expect(invalidInterface.initialize()).resolves.not.toThrow();
      
      // Operations should still work (in-memory only)
      await invalidInterface.set('memory-only', 'value');
      const value = await invalidInterface.get('memory-only');
      expect(value).toBe('value');
      
      await invalidInterface.cleanup();
    });
  });

  describe('Search and Query', () => {
    beforeEach(async () => {
      // Set up test data
      await memoryInterface.set('user:1', { name: 'John', type: 'admin' }, { tags: ['user', 'admin'] });
      await memoryInterface.set('user:2', { name: 'Jane', type: 'user' }, { tags: ['user'] });
      await memoryInterface.set('config:app', { theme: 'dark' }, { tags: ['config'] });
      await memoryInterface.set('temp:data', { value: 123 }, { tags: ['temp'], namespace: 'temporary' });
    });

    it('should search by tags', async () => {
      const userResults = await memoryInterface.search({ tags: ['user'] });
      const adminResults = await memoryInterface.search({ tags: ['admin'] });
      
      expect(userResults.length).toBe(2);
      expect(adminResults.length).toBe(1);
      
      expect(userResults.map(r => r.key)).toContain('user:1');
      expect(userResults.map(r => r.key)).toContain('user:2');
      expect(adminResults[0].key).toBe('user:1');
    });

    it('should search with key patterns', async () => {
      const userKeys = await memoryInterface.search({ keyPattern: /^user:/ });
      const configKeys = await memoryInterface.search({ keyPattern: /config/ });
      
      expect(userKeys.length).toBe(2);
      expect(configKeys.length).toBe(1);
      expect(configKeys[0].key).toBe('config:app');
    });

    it('should search within specific namespace', async () => {
      const tempResults = await memoryInterface.search({ 
        namespace: 'temporary',
        tags: ['temp']
      });
      
      expect(tempResults.length).toBe(1);
      expect(tempResults[0].key).toBe('temp:data');
    });

    it('should limit search results', async () => {
      const limitedResults = await memoryInterface.search({ 
        tags: ['user'],
        limit: 1 
      });
      
      expect(limitedResults.length).toBe(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide memory usage statistics', async () => {
      await memoryInterface.set('stat-key1', 'value1');
      await memoryInterface.set('stat-key2', 'value2');
      
      const stats = await memoryInterface.getStats();
      
      expect(stats.totalKeys).toBeGreaterThanOrEqual(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.namespaces).toContain('default');
    });

    it('should track operation metrics', async () => {
      await memoryInterface.set('metric-key', 'value');
      await memoryInterface.get('metric-key');
      await memoryInterface.delete('metric-key');
      
      const metrics = await memoryInterface.getMetrics();
      
      expect(metrics.operations.set).toBeGreaterThan(0);
      expect(metrics.operations.get).toBeGreaterThan(0);
      expect(metrics.operations.delete).toBeGreaterThan(0);
    });

    it('should provide health check information', async () => {
      const health = await memoryInterface.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUtilization).toBeGreaterThanOrEqual(0);
      expect(health.memoryUtilization).toBeLessThanOrEqual(1);
    });
  });
});
