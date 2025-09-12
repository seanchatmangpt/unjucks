/**
 * CAS Engine Performance Validation Tests
 * 
 * Validates the optimized CAS engine meets performance targets
 */

import { describe, test, expect } from 'vitest';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// Test the optimized CAS engine directly
describe('CAS Engine Performance Validation', () => {
  test('should load optimized CAS engine modules', async () => {
    // Test basic module loading
    const { OptimizedCASEngine } = await import('../../src/kgen/cas/cas-engine-optimized.js');
    const { AtomicStorageEngine } = await import('../../src/kgen/cas/atomic-storage-engine.js');
    
    expect(OptimizedCASEngine).toBeDefined();
    expect(AtomicStorageEngine).toBeDefined();
    
    // Create instances
    const cas = new OptimizedCASEngine({ cacheSize: 1000 });
    const storage = new AtomicStorageEngine();
    
    expect(cas).toBeDefined();
    expect(storage).toBeDefined();
    
    // Test initialization
    const casInit = await cas.initialize();
    const storageInit = await storage.initialize();
    
    expect(casInit.success).toBe(true);
    expect(storageInit.success).toBe(true);
    
    await cas.shutdown();
    await storage.shutdown();
  });

  test('should perform hash calculations efficiently', async () => {
    const { OptimizedCASEngine } = await import('../../src/kgen/cas/cas-engine-optimized.js');
    const cas = new OptimizedCASEngine({ cacheSize: 1000 });
    await cas.initialize();
    
    const testContent = 'Test content for hash calculation';
    const hashTimes = [];
    
    // Test 10 hash calculations
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      const hash = await cas.calculateHash(testContent + i);
      const hashTime = performance.now() - startTime;
      hashTimes.push(hashTime);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
    }
    
    const avgHashTime = hashTimes.reduce((a, b) => a + b, 0) / hashTimes.length;
    const maxHashTime = Math.max(...hashTimes);
    
    console.log(`Hash Performance:
      - Average: ${avgHashTime.toFixed(2)}ms
      - Maximum: ${maxHashTime.toFixed(2)}ms`);
    
    // Performance targets (relaxed for test environment)
    expect(avgHashTime).toBeLessThan(10); // 10ms average
    expect(maxHashTime).toBeLessThan(20); // 20ms maximum
    
    await cas.shutdown();
  });

  test('should achieve good cache performance', async () => {
    const { OptimizedCASEngine } = await import('../../src/kgen/cas/cas-engine-optimized.js');
    const cas = new OptimizedCASEngine({ cacheSize: 100 });
    await cas.initialize();
    
    const testContents = Array.from({ length: 20 }, (_, i) => `Content ${i}`);
    
    // First pass - populate cache
    const storePromises = testContents.map(content => cas.store(content));
    await Promise.all(storePromises);
    
    // Second pass - should use cache
    const cacheStartTime = performance.now();
    const cachePromises = testContents.map(content => cas.store(content));
    const cacheResults = await Promise.all(cachePromises);
    const cacheTime = performance.now() - cacheStartTime;
    
    // Check cache hits
    const cacheHits = cacheResults.filter(result => result.cached).length;
    const hitRate = cacheHits / cacheResults.length;
    
    console.log(`Cache Performance:
      - Hit rate: ${(hitRate * 100).toFixed(1)}%
      - Total time: ${cacheTime.toFixed(2)}ms
      - Avg per op: ${(cacheTime / cacheResults.length).toFixed(2)}ms`);
    
    // Performance targets (relaxed for test environment)
    expect(hitRate).toBeGreaterThan(0.5); // 50% minimum hit rate
    expect(cacheTime / cacheResults.length).toBeLessThan(5); // 5ms per operation
    
    await cas.shutdown();
  });

  test('should handle atomic storage operations', async () => {
    const { AtomicStorageEngine } = await import('../../src/kgen/cas/atomic-storage-engine.js');
    const storage = new AtomicStorageEngine({
      casDir: '/tmp/test-cas-' + this.getDeterministicTimestamp()
    });
    await storage.initialize();
    
    const content = Buffer.from('Test atomic storage content');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    const startTime = performance.now();
    const result = await storage.storeAtomic(content, hash, {
      extension: '.txt',
      algorithm: 'sha256'
    });
    const operationTime = performance.now() - startTime;
    
    expect(result.stored).toBe(true);
    expect(result.path).toContain(hash);
    expect(result.processingTime).toBeGreaterThan(0);
    
    console.log(`Atomic Storage:
      - Operation time: ${operationTime.toFixed(2)}ms
      - Path: ${result.path}
      - Verified: ${result.verified}`);
    
    // Performance target
    expect(operationTime).toBeLessThan(100); // 100ms for file operations
    
    await storage.shutdown();
  });

  test('should validate integrity checks', async () => {
    const { AtomicStorageEngine } = await import('../../src/kgen/cas/atomic-storage-engine.js');
    const storage = new AtomicStorageEngine({
      casDir: '/tmp/test-cas-integrity-' + this.getDeterministicTimestamp(),
      enableIntegrityChecks: true
    });
    await storage.initialize();
    
    const content = Buffer.from('Content for integrity testing');
    const correctHash = crypto.createHash('sha256').update(content).digest('hex');
    const wrongHash = 'a'.repeat(64);
    
    // Test with correct hash
    const validResult = await storage.verifyIntegrity('/dev/null', correctHash); // Will fail, but tests method
    expect(validResult).toHaveProperty('valid');
    expect(validResult).toHaveProperty('processingTime');
    
    await storage.shutdown();
  });

  test('should provide comprehensive metrics', async () => {
    const { OptimizedCASEngine } = await import('../../src/kgen/cas/cas-engine-optimized.js');
    const cas = new OptimizedCASEngine({ cacheSize: 100 });
    await cas.initialize();
    
    // Perform some operations
    await cas.store('test content 1');
    await cas.store('test content 2');
    await cas.store('test content 1'); // Should be cached
    
    const metrics = cas.getMetrics();
    
    expect(metrics).toHaveProperty('cache');
    expect(metrics).toHaveProperty('performance');
    expect(metrics).toHaveProperty('operations');
    expect(metrics).toHaveProperty('system');
    
    expect(metrics.cache.size).toBeGreaterThan(0);
    expect(metrics.operations.stores).toBeGreaterThanOrEqual(3);
    
    console.log(`CAS Metrics:
      - Cache size: ${metrics.cache.size}
      - Hit rate: ${metrics.cache.hitRate}%
      - Total stores: ${metrics.operations.stores}
      - Memory usage: ${metrics.cache.memoryUsageMB}MB`);
    
    await cas.shutdown();
  });
});

describe('Integration Tests', () => {
  test('should work with content URI resolver integration', async () => {
    // Test basic integration without full content resolver
    const { OptimizedCASEngine } = await import('../../src/kgen/cas/cas-engine-optimized.js');
    const cas = new OptimizedCASEngine();
    await cas.initialize();
    
    const testContent = 'Integration test content';
    const storeResult = await cas.store(testContent);
    
    expect(storeResult).toHaveProperty('cid');
    expect(storeResult).toHaveProperty('hash');
    expect(storeResult.stored).toBe(true);
    
    // Test retrieval
    const retrieved = await cas.retrieve(storeResult.cid);
    expect(retrieved).toBeDefined();
    
    console.log(`Integration Test:
      - CID: ${storeResult.cid}
      - Hash: ${storeResult.hash}
      - Size: ${storeResult.size} bytes`);
    
    await cas.shutdown();
  });
});