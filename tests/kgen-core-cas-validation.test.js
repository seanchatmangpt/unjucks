/**
 * CAS Engine Validation Tests
 * 
 * Validates the kgen-core CAS implementation with actual content storage and retrieval.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { CASEngine, createCAS, cas } from '../packages/kgen-core/src/cas/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('CAS Engine - Content Storage and Retrieval', () => {
  let engine;
  const testContent = 'Hello, Content-Addressed Storage!';
  const testBuffer = Buffer.from('Binary test data \x00\x01\x02\x03');
  
  beforeEach(async () => {
    engine = createCAS({ storageType: 'memory', cacheSize: 100 });
    await engine.initialize();
  });

  test('store and retrieve text content', async () => {
    const hash = await engine.store(testContent);
    
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA256 hex length
    
    const retrieved = await engine.retrieve(hash);
    expect(retrieved).toBeTruthy();
    expect(retrieved.toString('utf8')).toBe(testContent);
  });

  test('store and retrieve binary content', async () => {
    const hash = await engine.store(testBuffer);
    
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    
    const retrieved = await engine.retrieve(hash);
    expect(retrieved).toBeTruthy();
    expect(Buffer.compare(retrieved, testBuffer)).toBe(0);
  });

  test('verify content integrity', () => {
    const hash = engine.calculateHash(testContent);
    
    expect(engine.verify(hash, testContent)).toBe(true);
    expect(engine.verify(hash, 'different content')).toBe(false);
  });

  test('consistent hash generation', () => {
    const hash1 = engine.calculateHash(testContent);
    const hash2 = engine.calculateHash(testContent);
    
    expect(hash1).toBe(hash2);
  });

  test('cache hit after store', async () => {
    const hash = await engine.store(testContent);
    
    // First retrieval should hit cache
    const retrieved1 = await engine.retrieve(hash);
    const retrieved2 = await engine.retrieve(hash);
    
    expect(retrieved1.toString('utf8')).toBe(testContent);
    expect(retrieved2.toString('utf8')).toBe(testContent);
    
    const metrics = engine.getMetrics();
    expect(metrics.hits).toBeGreaterThan(0);
    expect(metrics.hitRate).toBeGreaterThan(0);
  });

  test('non-existent content returns null', async () => {
    const fakeHash = 'a'.repeat(64);
    const result = await engine.retrieve(fakeHash);
    
    expect(result).toBeNull();
  });
});

describe('CAS Engine - File Storage Backend', () => {
  let engine;
  const testDir = './test-cas-storage';
  
  beforeEach(async () => {
    engine = createCAS({ 
      storageType: 'file', 
      basePath: testDir,
      cacheSize: 10
    });
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.clear(true); // Clear storage
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch {}
  });

  test('file storage persistence', async () => {
    const content = 'Persistent test content';
    const hash = await engine.store(content);
    
    // Create new engine instance to test persistence
    const newEngine = createCAS({ 
      storageType: 'file', 
      basePath: testDir
    });
    await newEngine.initialize();
    
    const retrieved = await newEngine.retrieve(hash);
    expect(retrieved.toString('utf8')).toBe(content);
  });

  test('file storage with subdirectories', async () => {
    const content = 'Directory structure test';
    const hash = await engine.store(content);
    
    // Check that file exists in expected subdirectory structure
    const prefix = hash.substring(0, 2);
    const suffix = hash.substring(2);
    const expectedPath = join(testDir, prefix, suffix);
    
    const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});

describe('CAS Utility Functions', () => {
  test('cas.store utility function', async () => {
    const content = 'Utility function test';
    const hash = await cas.store(content);
    
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    
    const retrieved = await cas.retrieve(hash);
    expect(retrieved.toString('utf8')).toBe(content);
  });

  test('cas.hash utility function', () => {
    const content = 'Hash utility test';
    const hash = cas.hash(content);
    
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });

  test('cas.verify utility function', () => {
    const content = 'Verify utility test';
    const hash = cas.hash(content);
    
    expect(cas.verify(hash, content)).toBe(true);
    expect(cas.verify(hash, 'wrong content')).toBe(false);
  });
});

describe('CAS Performance and Metrics', () => {
  let engine;
  
  beforeEach(async () => {
    engine = createCAS({ storageType: 'memory', cacheSize: 5 });
    await engine.initialize();
  });

  test('metrics tracking', async () => {
    const initialMetrics = engine.getMetrics();
    expect(initialMetrics.stores).toBe(0);
    expect(initialMetrics.retrievals).toBe(0);
    
    const hash = await engine.store('Test content');
    await engine.retrieve(hash);
    
    const finalMetrics = engine.getMetrics();
    expect(finalMetrics.stores).toBe(1);
    expect(finalMetrics.retrievals).toBe(1);
    expect(finalMetrics.hits).toBe(1);
    expect(finalMetrics.hitRate).toBe(100);
  });

  test('LRU cache eviction', async () => {
    // Fill cache beyond capacity
    const hashes = [];
    for (let i = 0; i < 7; i++) {
      const hash = await engine.store(`Content ${i}`);
      hashes.push(hash);
    }
    
    // Cache should not exceed configured size
    const metrics = engine.getMetrics();
    expect(metrics.cacheSize).toBeLessThanOrEqual(5);
    
    // Early entries should be evicted (LRU)
    const earlyContent = await engine.retrieve(hashes[0]);
    const lateContent = await engine.retrieve(hashes[6]);
    
    // Late content should still be in cache, early might not be
    expect(lateContent.toString()).toBe('Content 6');
  });
});
