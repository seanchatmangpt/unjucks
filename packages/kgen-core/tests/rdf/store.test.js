/**
 * RDF Store Tests - Comprehensive validation of quad storage and management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RDFStore, createRDFStore } from '../../src/rdf/store.js';
import { parseRDF } from '../../src/rdf/processor.js';
import { Store, DataFactory } from 'n3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { namedNode, literal, quad } = DataFactory;

describe('RDF Store', () => {
  let store;
  let testQuads;

  beforeEach(async () => {
    store = new RDFStore();
    
    // Load test data
    const testData = readFileSync(join(__dirname, 'test-data.ttl'), 'utf-8');
    const parseResult = await parseRDF(testData);
    testQuads = parseResult.quads;
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      expect(store).toBeInstanceOf(RDFStore);
      expect(store.config.enableIndexing).toBe(true);
      expect(store.config.enableStatistics).toBe(true);
      expect(store.config.maxQuads).toBe(1000000);
    });

    it('should accept custom configuration', () => {
      const customStore = new RDFStore({
        enableIndexing: false,
        maxQuads: 50000,
        indexingStrategy: 'minimal'
      });
      
      expect(customStore.config.enableIndexing).toBe(false);
      expect(customStore.config.maxQuads).toBe(50000);
      expect(customStore.config.indexingStrategy).toBe('minimal');
    });

    it('should initialize empty with zero size', () => {
      expect(store.size).toBe(0);
      expect(store.getStatistics().totalQuads).toBe(0);
    });
  });

  describe('Adding Quads', () => {
    it('should add single quad successfully', () => {
      const testQuad = quad(
        namedNode('http://example.org/person1'),
        namedNode('http://xmlns.com/foaf/0.1/name'),
        literal('John Doe')
      );
      
      const result = store.addQuads(testQuad);
      
      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
      expect(result.duplicates).toBe(0);
      expect(store.size).toBe(1);
    });

    it('should add multiple quads successfully', () => {
      const result = store.addQuads(testQuads.slice(0, 5));
      
      expect(result.success).toBe(true);
      expect(result.added).toBe(5);
      expect(result.duplicates).toBe(0);
      expect(store.size).toBe(5);
      expect(result.operationTime).toBeGreaterThan(0);
    });

    it('should handle duplicate quads correctly', () => {
      const testQuad = testQuads[0];
      
      // Add same quad twice
      const result1 = store.addQuads(testQuad);
      const result2 = store.addQuads(testQuad);
      
      expect(result1.success).toBe(true);
      expect(result1.added).toBe(1);
      
      expect(result2.success).toBe(true);
      expect(result2.added).toBe(0);
      expect(result2.duplicates).toBe(1);
      expect(store.size).toBe(1);
    });

    it('should add all test quads', () => {
      const result = store.addQuads(testQuads);
      
      expect(result.success).toBe(true);
      expect(result.added).toBe(testQuads.length);
      expect(store.size).toBe(testQuads.length);
    });

    it('should emit events when quads are added', (done) => {
      store.on('quads-added', (event) => {
        expect(event.added).toBe(1);
        expect(event.quads).toHaveLength(1);
        expect(event.totalQuads).toBe(1);
        done();
      });
      
      store.addQuads(testQuads[0]);
    });

    it('should update statistics after adding quads', () => {
      store.addQuads(testQuads);
      
      const stats = store.getStatistics();
      expect(stats.totalQuads).toBe(testQuads.length);
      expect(stats.operations.add).toBe(testQuads.length);
      expect(stats.size).toBe(testQuads.length);
    });
  });

  describe('Removing Quads', () => {
    beforeEach(() => {
      store.addQuads(testQuads);
    });

    it('should remove single quad successfully', () => {
      const quadToRemove = testQuads[0];
      const initialSize = store.size;
      
      const result = store.removeQuads(quadToRemove);
      
      expect(result.success).toBe(true);
      expect(result.removed).toBe(1);
      expect(result.notFound).toBe(0);
      expect(store.size).toBe(initialSize - 1);
    });

    it('should remove multiple quads successfully', () => {
      const quadsToRemove = testQuads.slice(0, 3);
      const initialSize = store.size;
      
      const result = store.removeQuads(quadsToRemove);
      
      expect(result.success).toBe(true);
      expect(result.removed).toBe(3);
      expect(result.notFound).toBe(0);
      expect(store.size).toBe(initialSize - 3);
    });

    it('should handle non-existent quads correctly', () => {
      const nonExistentQuad = quad(
        namedNode('http://example.org/nonexistent'),
        namedNode('http://example.org/property'),
        literal('value')
      );
      
      const result = store.removeQuads(nonExistentQuad);
      
      expect(result.success).toBe(true);
      expect(result.removed).toBe(0);
      expect(result.notFound).toBe(1);
    });

    it('should emit events when quads are removed', (done) => {
      store.on('quads-removed', (event) => {
        expect(event.removed).toBe(1);
        expect(event.quads).toHaveLength(1);
        done();
      });
      
      store.removeQuads(testQuads[0]);
    });
  });

  describe('Querying Quads', () => {
    beforeEach(() => {
      store.addQuads(testQuads);
    });

    it('should get all quads with no pattern', () => {
      const quads = store.getQuads();
      
      expect(quads).toHaveLength(testQuads.length);
      expect(Array.isArray(quads)).toBe(true);
    });

    it('should get quads by subject pattern', () => {
      const subject = namedNode('http://example.org/Person1');
      const quads = store.getQuads(subject);
      
      expect(Array.isArray(quads)).toBe(true);
      expect(quads.length).toBeGreaterThan(0);
      quads.forEach(quad => {
        expect(quad.subject.equals(subject)).toBe(true);
      });
    });

    it('should get quads by predicate pattern', () => {
      const predicate = namedNode('http://xmlns.com/foaf/0.1/name');
      const quads = store.getQuads(null, predicate);
      
      expect(Array.isArray(quads)).toBe(true);
      expect(quads.length).toBeGreaterThan(0);
      quads.forEach(quad => {
        expect(quad.predicate.equals(predicate)).toBe(true);
      });
    });

    it('should get quads by object pattern', () => {
      const object = literal('John Doe');
      const quads = store.getQuads(null, null, object);
      
      expect(Array.isArray(quads)).toBe(true);
      quads.forEach(quad => {
        expect(quad.object.equals(object)).toBe(true);
      });
    });

    it('should get quads by complex pattern', () => {
      const subject = namedNode('http://example.org/Person1');
      const predicate = namedNode('http://xmlns.com/foaf/0.1/name');
      const quads = store.getQuads(subject, predicate);
      
      expect(Array.isArray(quads)).toBe(true);
      quads.forEach(quad => {
        expect(quad.subject.equals(subject)).toBe(true);
        expect(quad.predicate.equals(predicate)).toBe(true);
      });
    });

    it('should check if quad exists', () => {
      const existingQuad = testQuads[0];
      const nonExistentQuad = quad(
        namedNode('http://example.org/nonexistent'),
        namedNode('http://example.org/property'),
        literal('value')
      );
      
      expect(store.has(existingQuad)).toBe(true);
      expect(store.has(nonExistentQuad)).toBe(false);
    });

    it('should emit query events', (done) => {
      store.on('query-executed', (event) => {
        expect(event.pattern).toBeDefined();
        expect(event.resultCount).toBeGreaterThan(0);
        expect(event.queryTime).toBeGreaterThan(0);
        done();
      });
      
      store.getQuads();
    });
  });

  describe('Advanced Pattern Matching', () => {
    beforeEach(() => {
      store.addQuads(testQuads);
    });

    it('should perform pattern matching with options', () => {
      const result = store.match({
        predicate: namedNode('http://xmlns.com/foaf/0.1/name'),
        limit: 2,
        offset: 0
      });
      
      expect(result.success).toBe(true);
      expect(result.quads).toBeDefined();
      expect(result.count).toBeLessThanOrEqual(2);
      expect(result.totalCount).toBeGreaterThanOrEqual(result.count);
      expect(result.queryTime).toBeGreaterThan(0);
    });

    it('should handle pagination correctly', () => {
      const result1 = store.match({
        limit: 2,
        offset: 0
      });
      
      const result2 = store.match({
        limit: 2,
        offset: 2
      });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.count).toBeLessThanOrEqual(2);
      expect(result2.count).toBeLessThanOrEqual(2);
      
      // Check that results are different (unless there are only 2 total)
      if (result1.totalCount > 2) {
        expect(result1.hasMore).toBe(true);
      }
    });

    it('should handle empty results gracefully', () => {
      const result = store.match({
        subject: namedNode('http://example.org/nonexistent')
      });
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.quads).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Term Extraction', () => {
    beforeEach(() => {
      store.addQuads(testQuads);
    });

    it('should get all unique subjects', () => {
      const subjects = store.getSubjects();
      
      expect(Array.isArray(subjects)).toBe(true);
      expect(subjects.length).toBeGreaterThan(0);
      
      // Check uniqueness
      const subjectValues = subjects.map(s => s.value);
      const uniqueValues = [...new Set(subjectValues)];
      expect(subjectValues).toHaveLength(uniqueValues.length);
    });

    it('should get all unique predicates', () => {
      const predicates = store.getPredicates();
      
      expect(Array.isArray(predicates)).toBe(true);
      expect(predicates.length).toBeGreaterThan(0);
      
      // Check uniqueness
      const predicateValues = predicates.map(p => p.value);
      const uniqueValues = [...new Set(predicateValues)];
      expect(predicateValues).toHaveLength(uniqueValues.length);
    });

    it('should get all unique objects', () => {
      const objects = store.getObjects();
      
      expect(Array.isArray(objects)).toBe(true);
      expect(objects.length).toBeGreaterThan(0);
      
      // Check uniqueness
      const objectValues = objects.map(o => o.value);
      const uniqueValues = [...new Set(objectValues)];
      expect(objectValues).toHaveLength(uniqueValues.length);
    });

    it('should get subjects with predicate filter', () => {
      const predicate = namedNode('http://xmlns.com/foaf/0.1/name');
      const subjects = store.getSubjects(predicate);
      
      expect(Array.isArray(subjects)).toBe(true);
      
      // Verify that all returned subjects have the specified predicate
      subjects.forEach(subject => {
        const quads = store.getQuads(subject, predicate);
        expect(quads.length).toBeGreaterThan(0);
      });
    });

    it('should get predicates with subject filter', () => {
      const subject = namedNode('http://example.org/Person1');
      const predicates = store.getPredicates(subject);
      
      expect(Array.isArray(predicates)).toBe(true);
      
      // Verify that all returned predicates are used by the subject
      predicates.forEach(predicate => {
        const quads = store.getQuads(subject, predicate);
        expect(quads.length).toBeGreaterThan(0);
      });
    });

    it('should get objects with subject and predicate filter', () => {
      const subject = namedNode('http://example.org/Person1');
      const predicate = namedNode('http://xmlns.com/foaf/0.1/name');
      const objects = store.getObjects(subject, predicate);
      
      expect(Array.isArray(objects)).toBe(true);
      
      // Verify that all returned objects match the pattern
      objects.forEach(object => {
        const quads = store.getQuads(subject, predicate, object);
        expect(quads.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Transactions', () => {
    beforeEach(() => {
      store.addQuads(testQuads.slice(0, 5));
    });

    it('should begin a transaction', () => {
      const txId = store.beginTransaction();
      
      expect(typeof txId).toBe('string');
      expect(txId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(store.activeTransaction).not.toBeNull();
      expect(store.activeTransaction.id).toBe(txId);
    });

    it('should commit a transaction successfully', () => {
      const txId = store.beginTransaction();
      
      // Add some quads in transaction
      store.addQuads(testQuads.slice(5, 8));
      
      const result = store.commitTransaction();
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(txId);
      expect(result.operationCount).toBe(3);
      expect(result.duration).toBeGreaterThan(0);
      expect(store.activeTransaction).toBeNull();
    });

    it('should rollback a transaction successfully', () => {
      const initialSize = store.size;
      const txId = store.beginTransaction();
      
      // Add some quads in transaction
      store.addQuads(testQuads.slice(5, 8));
      expect(store.size).toBe(initialSize + 3);
      
      const result = store.rollbackTransaction();
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(txId);
      expect(result.operationCount).toBe(3);
      expect(store.size).toBe(initialSize); // Should be back to original size
      expect(store.activeTransaction).toBeNull();
    });

    it('should handle multiple operations in transaction', () => {
      const txId = store.beginTransaction();
      
      // Perform multiple operations
      store.addQuads(testQuads.slice(5, 7));
      store.removeQuads(testQuads.slice(0, 2));
      
      expect(store.activeTransaction.operations).toHaveLength(4); // 2 adds + 2 removes
      
      const result = store.commitTransaction();
      expect(result.success).toBe(true);
      expect(result.operationCount).toBe(4);
    });

    it('should handle transaction rollback with mixed operations', () => {
      const initialSize = store.size;
      const txId = store.beginTransaction();
      
      // Add and remove quads
      store.addQuads(testQuads.slice(5, 7)); // +2
      store.removeQuads(testQuads.slice(0, 1)); // -1
      
      expect(store.size).toBe(initialSize + 1);
      
      const result = store.rollbackTransaction();
      
      expect(result.success).toBe(true);
      expect(store.size).toBe(initialSize);
    });
  });

  describe('Import and Export', () => {
    it('should import from quad array', () => {
      const result = store.import(testQuads);
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(testQuads.length);
      expect(store.size).toBe(testQuads.length);
      expect(result.totalTime).toBeGreaterThan(0);
    });

    it('should import from N3 Store', () => {
      const n3Store = new Store();
      testQuads.forEach(quad => n3Store.addQuad(quad));
      
      const result = store.import(n3Store);
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(testQuads.length);
      expect(store.size).toBe(testQuads.length);
    });

    it('should export all quads', () => {
      store.addQuads(testQuads);
      
      const exported = store.export();
      
      expect(Array.isArray(exported)).toBe(true);
      expect(exported).toHaveLength(testQuads.length);
      
      // Verify that all quads are present
      exported.forEach(quad => {
        expect(store.has(quad)).toBe(true);
      });
    });

    it('should handle import with duplicates', () => {
      // Add some quads first
      store.addQuads(testQuads.slice(0, 3));
      
      // Import overlapping set
      const result = store.import(testQuads.slice(1, 5));
      
      expect(result.success).toBe(true);
      expect(result.imported).toBe(2); // Only 2 new quads (indices 3 and 4)
      expect(result.duplicates).toBe(2); // Indices 1 and 2 were duplicates
    });
  });

  describe('Statistics and Performance', () => {
    it('should provide comprehensive statistics', () => {
      store.addQuads(testQuads.slice(0, 10));
      store.removeQuads(testQuads.slice(0, 2));
      store.getQuads();
      
      const stats = store.getStatistics();
      
      expect(stats.totalQuads).toBe(8); // 10 - 2
      expect(stats.size).toBe(8);
      expect(stats.operations.add).toBe(10);
      expect(stats.operations.remove).toBe(2);
      expect(stats.operations.query).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.indexes.enabled).toBe(true);
      expect(stats.memory).toBeDefined();
    });

    it('should track term counts when statistics enabled', () => {
      store.addQuads(testQuads);
      
      const stats = store.getStatistics();
      
      expect(stats.totalSubjects).toBeGreaterThan(0);
      expect(stats.totalPredicates).toBeGreaterThan(0);
      expect(stats.totalObjects).toBeGreaterThan(0);
    });

    it('should handle performance with large datasets', () => {
      // Create a reasonably large dataset
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push(quad(
          namedNode(`http://example.org/subject${i}`),
          namedNode('http://example.org/property'),
          literal(`value${i}`)
        ));
      }
      
      const startTime = Date.now();
      const result = store.addQuads(largeDataset);
      const addTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.added).toBe(1000);
      expect(addTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Test query performance
      const queryStart = Date.now();
      const quads = store.getQuads(null, namedNode('http://example.org/property'));
      const queryTime = Date.now() - queryStart;
      
      expect(quads).toHaveLength(1000);
      expect(queryTime).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Clear and Reset', () => {
    beforeEach(() => {
      store.addQuads(testQuads);
    });

    it('should clear all data', () => {
      const initialSize = store.size;
      expect(initialSize).toBeGreaterThan(0);
      
      const result = store.clear();
      
      expect(result.success).toBe(true);
      expect(result.previousSize).toBe(initialSize);
      expect(result.currentSize).toBe(0);
      expect(store.size).toBe(0);
    });

    it('should emit clear event', (done) => {
      store.on('store-cleared', (event) => {
        expect(event.previousSize).toBeGreaterThan(0);
        done();
      });
      
      store.clear();
    });

    it('should reset statistics after clear', () => {
      store.clear();
      
      const stats = store.getStatistics();
      expect(stats.totalQuads).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should reinitialize indexes after clear', () => {
      store.clear();
      
      // Add new data and verify indexes work
      store.addQuads(testQuads.slice(0, 3));
      
      const subjects = store.getSubjects();
      expect(subjects.length).toBeGreaterThan(0);
    });
  });

  describe('Factory Function', () => {
    it('should create store with factory function', () => {
      const storeInstance = createRDFStore({
        enableIndexing: false,
        maxQuads: 50000
      });
      
      expect(storeInstance).toBeInstanceOf(RDFStore);
      expect(storeInstance.config.enableIndexing).toBe(false);
      expect(storeInstance.config.maxQuads).toBe(50000);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed operations gracefully', () => {
      // Try to add invalid data
      const result = store.addQuads(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.added).toBe(0);
    });

    it('should handle transaction errors', () => {
      // Try to commit non-existent transaction
      const result = store.commitTransaction('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    it('should handle rollback of non-existent transaction', () => {
      const result = store.rollbackTransaction('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    it('should handle import errors gracefully', () => {
      const result = store.import('invalid-input');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.imported).toBe(0);
    });
  });
});