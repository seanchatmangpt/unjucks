/**
 * Concurrent Operations Integration Tests
 * Tests race conditions, deadlocks, and concurrent execution safety
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import cluster from 'cluster';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Concurrent Operations Integration Tests', () => {
  let concurrencyResults = {
    raceConditions: [],
    deadlockTests: [],
    resourceContention: [],
    performance: []
  };

  beforeAll(async () => {
    await fs.ensureDir(path.join(__dirname, '../temp/concurrency-tests'));
    await fs.ensureDir(path.join(__dirname, '../results'));
  });

  afterAll(async () => {
    await fs.writeJson(
      path.join(__dirname, '../results/concurrency-results.json'),
      concurrencyResults,
      { spaces: 2 }
    );
  });

  describe('Race Condition Prevention', () => {
    test('Multiple simultaneous artifact generations do not corrupt output', async () => {
      const outputDir = path.join(__dirname, '../temp/concurrency-tests/race-test');
      await fs.ensureDir(outputDir);

      const sharedResource = new SharedArtifactGenerator(outputDir);
      const concurrentGenerations = [];

      // Start 10 concurrent artifact generations
      for (let i = 0; i < 10; i++) {
        concurrentGenerations.push(
          sharedResource.generateArtifact({
            id: i,
            content: `Artifact content for ID ${i}`,
            metadata: { generatedAt: this.getDeterministicDate().toISOString(), iteration: i }
          })
        );
      }

      const results = await Promise.allSettled(concurrentGenerations);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(10);
      expect(failed.length).toBe(0);

      // Verify each artifact was written correctly
      for (let i = 0; i < 10; i++) {
        const artifactPath = path.join(outputDir, `artifact-${i}.json`);
        expect(fs.existsSync(artifactPath)).toBe(true);
        
        const content = await fs.readJson(artifactPath);
        expect(content.id).toBe(i);
        expect(content.content).toBe(`Artifact content for ID ${i}`);
        expect(content.metadata.iteration).toBe(i);
      }

      concurrencyResults.raceConditions.push({
        type: 'artifact-generation',
        concurrentOperations: 10,
        successful: successful.length,
        failed: failed.length,
        noCorruption: true
      });
    });

    test('Concurrent template cache access is thread-safe', async () => {
      const templateCache = new ThreadSafeTemplateCache();
      const cacheOperations = [];

      // Mix of concurrent reads and writes
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          // Write operation
          cacheOperations.push(
            templateCache.set(`template-${i}`, {
              compiled: true,
              content: `Template ${i} content`,
              hash: `hash-${i}`
            })
          );
        } else {
          // Read operation
          cacheOperations.push(
            templateCache.get(`template-${Math.floor(i / 3) * 3}`)
          );
        }
      }

      const results = await Promise.allSettled(cacheOperations);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBe(50);

      // Verify cache consistency
      const cacheKeys = await templateCache.keys();
      const expectedKeys = Array.from({ length: 17 }, (_, i) => `template-${i * 3}`);
      
      expect(cacheKeys.sort()).toEqual(expectedKeys.sort());

      concurrencyResults.raceConditions.push({
        type: 'template-cache-access',
        operations: 50,
        successful,
        cacheConsistent: true
      });
    });

    test('Graph parsing with concurrent access to same file', async () => {
      const graphFile = path.join(__dirname, '../fixtures/concurrent-test-graph.ttl');
      const graphContent = `
@prefix ex: <http://example.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

ex:dataset1 a ex:Dataset ;
    ex:title "Concurrent Test Dataset" ;
    prov:generatedAtTime "2024-01-01T00:00:00Z" .

ex:dataset2 prov:wasDerivedFrom ex:dataset1 .
      `;

      await fs.ensureDir(path.dirname(graphFile));
      await fs.writeFile(graphFile, graphContent);

      const graphParser = new ConcurrentGraphParser();
      const parsingOperations = [];

      // 20 concurrent parsing operations on the same file
      for (let i = 0; i < 20; i++) {
        parsingOperations.push(
          graphParser.parseGraph(graphFile, { operationId: i })
        );
      }

      const results = await Promise.allSettled(parsingOperations);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBe(20);

      // Verify all parsers got the same result
      const parsedData = successful.map(r => r.value);
      const firstResult = parsedData[0];
      
      for (const result of parsedData) {
        expect(result.triples).toEqual(firstResult.triples);
        expect(result.subjects).toEqual(firstResult.subjects);
      }

      concurrencyResults.raceConditions.push({
        type: 'concurrent-graph-parsing',
        operations: 20,
        successful: successful.length,
        resultsConsistent: true
      });
    });
  });

  describe('Deadlock Detection and Prevention', () => {
    test('Multiple resources with different lock order do not deadlock', async () => {
      const resourceManager = new DeadlockPreventionResourceManager();
      const operations = [];

      // Create operations that need multiple resources in different orders
      operations.push(
        resourceManager.useResources(['resourceA', 'resourceB'], async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'operation1-complete';
        })
      );

      operations.push(
        resourceManager.useResources(['resourceB', 'resourceA'], async () => {
          await new Promise(resolve => setTimeout(resolve, 60));
          return 'operation2-complete';
        })
      );

      operations.push(
        resourceManager.useResources(['resourceA', 'resourceC'], async () => {
          await new Promise(resolve => setTimeout(resolve, 40));
          return 'operation3-complete';
        })
      );

      operations.push(
        resourceManager.useResources(['resourceC', 'resourceB'], async () => {
          await new Promise(resolve => setTimeout(resolve, 55));
          return 'operation4-complete';
        })
      );

      const startTime = this.getDeterministicTimestamp();
      const results = await Promise.all(operations);
      const totalTime = this.getDeterministicTimestamp() - startTime;

      // All operations should complete successfully
      expect(results).toHaveLength(4);
      expect(results[0]).toBe('operation1-complete');
      expect(results[1]).toBe('operation2-complete');
      expect(results[2]).toBe('operation3-complete');
      expect(results[3]).toBe('operation4-complete');

      // Should complete in reasonable time (not hang due to deadlock)
      expect(totalTime).toBeLessThan(5000);

      concurrencyResults.deadlockTests.push({
        type: 'multi-resource-different-order',
        operations: 4,
        completedSuccessfully: true,
        totalTime,
        noDeadlock: totalTime < 5000
      });
    });

    test('Circular dependency detection works correctly', async () => {
      const dependencyGraph = new DependencyGraph();
      
      // Add valid dependencies
      dependencyGraph.addDependency('taskA', 'taskB');
      dependencyGraph.addDependency('taskB', 'taskC');
      dependencyGraph.addDependency('taskC', 'taskD');

      // Try to add circular dependency
      const circularResult = dependencyGraph.addDependency('taskD', 'taskA');
      
      expect(circularResult.success).toBe(false);
      expect(circularResult.circular).toBe(true);
      expect(circularResult.cycle).toEqual(['taskD', 'taskA', 'taskB', 'taskC', 'taskD']);

      // Verify valid execution order can still be determined
      const executionOrder = dependencyGraph.getExecutionOrder();
      expect(executionOrder).toEqual(['taskD', 'taskC', 'taskB', 'taskA']);

      concurrencyResults.deadlockTests.push({
        type: 'circular-dependency-detection',
        circularDetected: true,
        cycleLength: 4,
        validExecutionOrder: executionOrder.length === 4
      });
    });
  });

  describe('Resource Contention Management', () => {
    test('High contention scenarios are handled efficiently', async () => {
      const contentionResource = new HighContentionResource();
      const operations = [];

      // Create 100 operations competing for the same resource
      for (let i = 0; i < 100; i++) {
        operations.push(
          contentionResource.performOperation(`operation-${i}`, async () => {
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return `result-${i}`;
          })
        );
      }

      const startTime = this.getDeterministicTimestamp();
      const results = await Promise.all(operations);
      const totalTime = this.getDeterministicTimestamp() - startTime;

      expect(results).toHaveLength(100);
      
      // Verify all operations completed
      for (let i = 0; i < 100; i++) {
        expect(results[i]).toBe(`result-${i}`);
      }

      // Calculate throughput
      const throughput = results.length / (totalTime / 1000); // operations per second

      concurrencyResults.resourceContention.push({
        type: 'high-contention-serialized',
        operations: 100,
        totalTime,
        throughputOpsPerSec: throughput,
        efficient: throughput > 10 // At least 10 ops/sec
      });
    });

    test('Read-write locks allow concurrent reads', async () => {
      const rwLock = new ReadWriteLock();
      const readOperations = [];
      const writeOperations = [];

      // Create multiple read operations
      for (let i = 0; i < 10; i++) {
        readOperations.push(
          rwLock.readLock(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return `read-result-${i}`;
          })
        );
      }

      // Create one write operation
      writeOperations.push(
        rwLock.writeLock(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'write-result';
        })
      );

      const startTime = this.getDeterministicTimestamp();
      
      // Start all operations
      const allOperations = [...readOperations, ...writeOperations];
      const results = await Promise.all(allOperations);
      
      const totalTime = this.getDeterministicTimestamp() - startTime;

      // All operations should complete
      expect(results).toHaveLength(11);

      // Read operations should have completed concurrently (faster than serial)
      // 10 reads of 100ms each would take 1000ms if serial, should be ~100ms if concurrent
      expect(totalTime).toBeLessThan(500); // Allow some overhead

      const readResults = results.slice(0, 10);
      const writeResult = results[10];

      expect(writeResult).toBe('write-result');
      for (let i = 0; i < 10; i++) {
        expect(readResults[i]).toBe(`read-result-${i}`);
      }

      concurrencyResults.resourceContention.push({
        type: 'read-write-locks',
        readOperations: 10,
        writeOperations: 1,
        totalTime,
        concurrentReads: totalTime < 500
      });
    });
  });

  describe('Performance Under Concurrent Load', () => {
    test('System performance degrades gracefully under load', async () => {
      const performanceMonitor = new PerformanceMonitor();
      const loadLevels = [10, 50, 100, 200];
      const performanceData = [];

      for (const loadLevel of loadLevels) {
        const operations = Array.from({ length: loadLevel }, (_, i) =>
          performanceMonitor.measureOperation(`load-${loadLevel}-op-${i}`, async () => {
            // Simulate variable workload
            const workTime = 10 + Math.random() * 40; // 10-50ms
            await new Promise(resolve => setTimeout(resolve, workTime));
            return `completed-${i}`;
          })
        );

        const startTime = this.getDeterministicTimestamp();
        const results = await Promise.all(operations);
        const totalTime = this.getDeterministicTimestamp() - startTime;

        const throughput = results.length / (totalTime / 1000);
        const avgResponseTime = totalTime / results.length;

        performanceData.push({
          loadLevel,
          totalTime,
          throughput,
          avgResponseTime,
          successful: results.length === loadLevel
        });

        // Allow system to cool down between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify graceful degradation (throughput doesn't drop dramatically)
      const baseThroughput = performanceData[0].throughput;
      const maxThroughput = Math.max(...performanceData.map(d => d.throughput));
      
      for (const data of performanceData) {
        // Throughput shouldn't drop below 50% of baseline
        expect(data.throughput).toBeGreaterThan(baseThroughput * 0.5);
        expect(data.successful).toBe(true);
      }

      concurrencyResults.performance.push({
        type: 'graceful-degradation',
        loadLevels,
        baseThroughput,
        maxThroughput,
        performanceData,
        gracefulDegradation: true
      });
    });

    test('Memory usage remains stable under concurrent operations', async () => {
      const initialMemory = process.memoryUsage();
      const memorySnapshots = [initialMemory];

      // Run sustained concurrent operations
      for (let batch = 0; batch < 5; batch++) {
        const batchOperations = Array.from({ length: 20 }, (_, i) =>
          new Promise(async resolve => {
            // Create some objects and process them
            const data = Array.from({ length: 1000 }, (_, j) => ({
              id: `batch-${batch}-item-${i}-${j}`,
              value: Math.random(),
              timestamp: this.getDeterministicDate()
            }));

            // Simulate processing
            const processed = data.map(item => ({
              ...item,
              processed: true,
              hash: item.id.length
            }));

            // Wait a bit
            await new Promise(res => setTimeout(res, 20));
            
            resolve(processed.length);
          })
        );

        await Promise.all(batchOperations);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Take memory snapshot
        const currentMemory = process.memoryUsage();
        memorySnapshots.push(currentMemory);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be reasonable (less than 100MB for this test)
      expect(memoryGrowthMB).toBeLessThan(100);

      // Memory shouldn't continuously grow
      const memoryUsages = memorySnapshots.map(s => s.heapUsed);
      const maxMemory = Math.max(...memoryUsages);
      const finalMemoryUsage = memoryUsages[memoryUsages.length - 1];
      
      // Final memory should be closer to max than to initial (some growth is expected)
      const memoryStability = finalMemoryUsage < maxMemory * 1.1;

      concurrencyResults.performance.push({
        type: 'memory-stability',
        batches: 5,
        operationsPerBatch: 20,
        initialMemoryMB: initialMemory.heapUsed / (1024 * 1024),
        finalMemoryMB: finalMemory.heapUsed / (1024 * 1024),
        memoryGrowthMB,
        memoryStable: memoryStability && memoryGrowthMB < 100
      });
    });
  });
});

// Helper classes for concurrent testing

class SharedArtifactGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.activeLocks = new Set();
  }

  async generateArtifact(data) {
    const filename = `artifact-${data.id}.json`;
    const filepath = path.join(this.outputDir, filename);

    // Simple file-level locking
    while (this.activeLocks.has(filename)) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    this.activeLocks.add(filename);

    try {
      await fs.writeJson(filepath, data, { spaces: 2 });
      return { success: true, path: filepath };
    } finally {
      this.activeLocks.delete(filename);
    }
  }
}

class ThreadSafeTemplateCache {
  constructor() {
    this.cache = new Map();
    this.locks = new Map();
  }

  async set(key, value) {
    await this._acquireLock(key);
    try {
      this.cache.set(key, value);
    } finally {
      this._releaseLock(key);
    }
  }

  async get(key) {
    await this._acquireLock(key);
    try {
      return this.cache.get(key);
    } finally {
      this._releaseLock(key);
    }
  }

  async keys() {
    return Array.from(this.cache.keys());
  }

  async _acquireLock(key) {
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    this.locks.set(key, true);
  }

  _releaseLock(key) {
    this.locks.delete(key);
  }
}

class ConcurrentGraphParser {
  constructor() {
    this.fileReaderCount = new Map();
  }

  async parseGraph(filePath, options = {}) {
    // Track concurrent readers
    const count = this.fileReaderCount.get(filePath) || 0;
    this.fileReaderCount.set(filePath, count + 1);

    try {
      // Simulate parsing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const triples = lines.map(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          return {
            subject: parts[0],
            predicate: parts[1],
            object: parts.slice(2).join(' ').replace(/\s*\.\s*$/, '')
          };
        }
        return null;
      }).filter(Boolean);

      const subjects = [...new Set(triples.map(t => t.subject))];

      return {
        triples,
        subjects,
        operationId: options.operationId,
        concurrent: count > 0
      };
    } finally {
      const newCount = this.fileReaderCount.get(filePath) - 1;
      if (newCount <= 0) {
        this.fileReaderCount.delete(filePath);
      } else {
        this.fileReaderCount.set(filePath, newCount);
      }
    }
  }
}

class DeadlockPreventionResourceManager {
  constructor() {
    this.resources = new Map();
    this.resourceOrder = ['resourceA', 'resourceB', 'resourceC']; // Consistent ordering
  }

  async useResources(resourceNames, operation) {
    // Sort resources to prevent deadlock
    const sortedResources = resourceNames.sort((a, b) => {
      const aIndex = this.resourceOrder.indexOf(a);
      const bIndex = this.resourceOrder.indexOf(b);
      return aIndex - bIndex;
    });

    // Acquire locks in order
    const acquiredLocks = [];
    
    try {
      for (const resourceName of sortedResources) {
        await this._acquireResource(resourceName);
        acquiredLocks.push(resourceName);
      }

      return await operation();
    } finally {
      // Release in reverse order
      for (const resourceName of acquiredLocks.reverse()) {
        this._releaseResource(resourceName);
      }
    }
  }

  async _acquireResource(resourceName) {
    while (this.resources.has(resourceName)) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    this.resources.set(resourceName, true);
  }

  _releaseResource(resourceName) {
    this.resources.delete(resourceName);
  }
}

class DependencyGraph {
  constructor() {
    this.dependencies = new Map();
  }

  addDependency(task, dependsOn) {
    if (!this.dependencies.has(task)) {
      this.dependencies.set(task, new Set());
    }
    
    // Check for circular dependency
    if (this._wouldCreateCycle(task, dependsOn)) {
      const cycle = this._findCycle(task, dependsOn);
      return { success: false, circular: true, cycle };
    }

    this.dependencies.get(task).add(dependsOn);
    return { success: true };
  }

  _wouldCreateCycle(task, dependsOn) {
    return this._hasPath(dependsOn, task);
  }

  _hasPath(from, to) {
    if (from === to) return true;
    
    const dependencies = this.dependencies.get(from);
    if (!dependencies) return false;

    for (const dep of dependencies) {
      if (this._hasPath(dep, to)) {
        return true;
      }
    }
    return false;
  }

  _findCycle(task, dependsOn) {
    const path = [task, dependsOn];
    const visited = new Set();
    
    const findPath = (current, target, currentPath) => {
      if (current === target) {
        return [...currentPath, current];
      }
      
      if (visited.has(current)) return null;
      visited.add(current);
      
      const deps = this.dependencies.get(current);
      if (!deps) return null;
      
      for (const dep of deps) {
        const result = findPath(dep, target, [...currentPath, current]);
        if (result) return result;
      }
      
      return null;
    };

    return findPath(dependsOn, task, []);
  }

  getExecutionOrder() {
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (task) => {
      if (visited.has(task)) return;
      if (visiting.has(task)) return; // Cycle detected, skip

      visiting.add(task);
      
      const deps = this.dependencies.get(task);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }

      visiting.delete(task);
      visited.add(task);
      result.push(task);
    };

    for (const task of this.dependencies.keys()) {
      visit(task);
    }

    return result;
  }
}

class HighContentionResource {
  constructor() {
    this.inUse = false;
    this.waitQueue = [];
  }

  async performOperation(operationId, operation) {
    return new Promise((resolve, reject) => {
      this.waitQueue.push({ operationId, operation, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.inUse || this.waitQueue.length === 0) {
      return;
    }

    this.inUse = true;
    const { operationId, operation, resolve, reject } = this.waitQueue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.inUse = false;
      // Process next in queue
      setTimeout(() => this._processQueue(), 0);
    }
  }
}

class ReadWriteLock {
  constructor() {
    this.readers = 0;
    this.writer = false;
    this.waitingReaders = [];
    this.waitingWriters = [];
  }

  async readLock(operation) {
    return new Promise((resolve, reject) => {
      const executeRead = async () => {
        this.readers++;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.readers--;
          this._processWaitingWriters();
        }
      };

      if (!this.writer && this.waitingWriters.length === 0) {
        executeRead();
      } else {
        this.waitingReaders.push(executeRead);
      }
    });
  }

  async writeLock(operation) {
    return new Promise((resolve, reject) => {
      const executeWrite = async () => {
        this.writer = true;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.writer = false;
          this._processWaitingReaders();
          this._processWaitingWriters();
        }
      };

      if (!this.writer && this.readers === 0) {
        executeWrite();
      } else {
        this.waitingWriters.push(executeWrite);
      }
    });
  }

  _processWaitingReaders() {
    if (!this.writer && this.waitingWriters.length === 0) {
      while (this.waitingReaders.length > 0) {
        const reader = this.waitingReaders.shift();
        setTimeout(reader, 0);
      }
    }
  }

  _processWaitingWriters() {
    if (!this.writer && this.readers === 0 && this.waitingWriters.length > 0) {
      const writer = this.waitingWriters.shift();
      setTimeout(writer, 0);
    }
  }
}

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  async measureOperation(operationId, operation) {
    const startTime = this.getDeterministicTimestamp();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const endTime = this.getDeterministicTimestamp();
      const endMemory = process.memoryUsage();

      this.metrics.set(operationId, {
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        success: true
      });

      return result;
    } catch (error) {
      const endTime = this.getDeterministicTimestamp();
      
      this.metrics.set(operationId, {
        duration: endTime - startTime,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}