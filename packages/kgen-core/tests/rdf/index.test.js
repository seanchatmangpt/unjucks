/**
 * Integration tests for the RDF core module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RDFCore, GraphProcessor, NamespaceManager, RDFSerializers, HashCalculator } from '../../src/rdf/index.js';
import { DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

describe('RDFCore Integration', () => {
  let rdfCore;

  beforeEach(() => {
    rdfCore = new RDFCore({
      enableCaching: true,
      validateInputs: true,
      defaultFormat: 'turtle'
    });
  });

  afterEach(() => {
    rdfCore?.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with all components', () => {
      expect(rdfCore.graph).toBeInstanceOf(GraphProcessor);
      expect(rdfCore.namespaces).toBeInstanceOf(NamespaceManager);
      expect(rdfCore.serializers).toBeInstanceOf(RDFSerializers);
      expect(rdfCore.hasher).toBeInstanceOf(HashCalculator);
    });

    it('should have default configuration', () => {
      expect(rdfCore.config.enableCaching).toBe(true);
      expect(rdfCore.config.validateInputs).toBe(true);
      expect(rdfCore.config.defaultFormat).toBe('turtle');
    });
  });

  describe('Parsing and Adding Data', () => {
    it('should parse and add RDF data from string', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const result = await rdfCore.add(turtleData, 'turtle');
      
      expect(result.added).toBe(1);
      expect(result.totalQuads).toBe(1);
    });

    it('should parse and update namespaces', async () => {
      const turtleData = `
        @prefix custom: <http://custom.example.org/> .
        custom:subject custom:predicate "object" .
      `;

      await rdfCore.add(turtleData, 'turtle');
      
      expect(rdfCore.namespaces.hasPrefix('custom')).toBe(true);
      expect(rdfCore.namespaces.getNamespaceURI('custom')).toBe('http://custom.example.org/');
    });

    it('should add quads directly', async () => {
      const testQuads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await rdfCore.add(testQuads);
      
      expect(result.added).toBe(1);
      expect(result.totalQuads).toBe(1);
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject1 ex:predicate "object1" .
        ex:subject2 ex:predicate "object2" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should query with expanded prefixed URIs', () => {
      const results = rdfCore.query({ predicate: 'ex:predicate' });
      
      expect(results).toHaveLength(2);
    });

    it('should query with full URIs', () => {
      const results = rdfCore.query({ predicate: 'http://example.org/predicate' });
      
      expect(results).toHaveLength(2);
    });
  });

  describe('Serialization', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should serialize to different formats', async () => {
      const turtle = await rdfCore.serialize(null, 'turtle');
      const ntriples = await rdfCore.serialize(null, 'ntriples');
      const jsonld = await rdfCore.serialize(null, 'jsonld');
      
      expect(turtle).toContain('@prefix');
      expect(ntriples).toContain('<http://');
      expect(JSON.parse(jsonld)).toHaveProperty('@context');
    });

    it('should include namespaces in serialization', async () => {
      const result = await rdfCore.serialize(null, 'turtle');
      
      expect(result).toContain('@prefix ex:');
      expect(result).toContain('http://example.org/');
    });
  });

  describe('Hashing and Content Addressing', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should calculate content hash', () => {
      const hash = rdfCore.calculateHash();
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should create content-addressed identifier', () => {
      const contentId = rdfCore.createContentId();
      
      expect(contentId).toMatch(/^kgen:v1:/);
    });

    it('should produce deterministic hashes', () => {
      const hash1 = rdfCore.calculateHash();
      const hash2 = rdfCore.calculateHash();
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Graph Operations', () => {
    it('should diff two RDF cores', async () => {
      const core1 = new RDFCore();
      const core2 = new RDFCore();

      await core1.add('<http://example.org/s> <http://example.org/p> "o1" .', 'ntriples');
      await core2.add('<http://example.org/s> <http://example.org/p> "o1" .', 'ntriples');
      await core2.add('<http://example.org/s> <http://example.org/p> "o2" .', 'ntriples');

      const diff = rdfCore.diff(core2);
      
      expect(diff.added).toBeGreaterThan(0);
      
      core1.destroy();
      core2.destroy();
    });

    it('should merge RDF cores', async () => {
      const otherCore = new RDFCore();

      await rdfCore.add('<http://example.org/s1> <http://example.org/p> "o1" .', 'ntriples');
      await otherCore.add('<http://example.org/s2> <http://example.org/p> "o2" .', 'ntriples');

      const result = rdfCore.merge(otherCore);
      
      expect(result.merged).toBe(1);
      expect(result.totalQuads).toBe(2);
      
      otherCore.destroy();
    });
  });

  describe('Validation', () => {
    it('should validate valid RDF data', async () => {
      const validData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const result = await rdfCore.validate(validData, 'turtle');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats).toBeDefined();
    });

    it('should detect invalid RDF data', async () => {
      const invalidData = 'invalid turtle data @#$%';

      const result = await rdfCore.validate(invalidData, 'turtle');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate with namespace checking', async () => {
      const dataWithCustomNamespace = `
        @prefix custom: <http://custom.org/> .
        custom:subject custom:predicate "object" .
      `;

      const result = await rdfCore.validate(dataWithCustomNamespace, 'turtle', {
        checkNamespaces: true
      });
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should export with complete metadata', async () => {
      const exported = await rdfCore.export('turtle');
      
      expect(exported.data).toContain('@prefix');
      expect(exported.format).toBe('turtle');
      expect(exported.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(exported.contentId).toMatch(/^kgen:v1:/);
      expect(exported.stats).toBeDefined();
      expect(exported.metadata).toBeDefined();
      expect(exported.timestamp).toBeDefined();
    });

    it('should export in different formats', async () => {
      const turtleExport = await rdfCore.export('turtle');
      const ntriplesExport = await rdfCore.export('ntriples');
      
      expect(turtleExport.format).toBe('turtle');
      expect(ntriplesExport.format).toBe('ntriples');
      expect(turtleExport.data).not.toBe(ntriplesExport.data);
    });
  });

  describe('Statistics and Health', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject1 ex:predicate "object1" .
        ex:subject2 ex:predicate "object2" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should provide comprehensive statistics', () => {
      const stats = rdfCore.getStats();
      
      expect(stats.graph).toBeDefined();
      expect(stats.namespaces).toBeDefined();
      expect(stats.formats).toBeDefined();
      expect(stats.cache).toBeDefined();
      
      expect(stats.graph.totalQuads).toBe(2);
      expect(stats.formats).toContain('turtle');
    });

    it('should provide health check', () => {
      const health = rdfCore.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.graph).toBeDefined();
      expect(health.namespaces).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    it('should forward events from components', (done) => {
      rdfCore.on('quads-added', (event) => {
        expect(event.count).toBe(1);
        done();
      });

      const testQuad = quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'));
      rdfCore.graph.addQuads([testQuad]);
    });

    it('should forward namespace events', (done) => {
      rdfCore.on('prefix-added', (event) => {
        expect(event.prefix).toBe('test');
        done();
      });

      rdfCore.namespaces.addPrefix('test', 'http://test.org/');
    });
  });

  describe('Store Management', () => {
    beforeEach(async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;
      await rdfCore.add(turtleData, 'turtle');
    });

    it('should clear the store', () => {
      expect(rdfCore.graph.store.size).toBe(1);
      
      rdfCore.clear();
      
      expect(rdfCore.graph.store.size).toBe(0);
    });

    it('should clear specific graphs', async () => {
      await rdfCore.add('<http://example.org/s> <http://example.org/p> "o" .', 'ntriples', {
        graph: 'http://example.org/graph'
      });
      
      expect(rdfCore.graph.store.size).toBe(2);
      
      rdfCore.clear('http://example.org/graph');
      
      expect(rdfCore.graph.store.size).toBe(1);
    });
  });

  describe('Input Validation', () => {
    it('should validate string inputs when enabled', async () => {
      await expect(rdfCore.add(null, 'turtle'))
        .rejects
        .toThrow(/Invalid data/);
    });

    it('should accept valid quad arrays', async () => {
      const testQuads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      await expect(rdfCore.add(testQuads)).resolves.toBeDefined();
    });

    it('should reject invalid input types', async () => {
      await expect(rdfCore.add(42, 'turtle'))
        .rejects
        .toThrow(/Invalid data/);
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const invalidData = 'completely invalid RDF data !@#$%';

      await expect(rdfCore.add(invalidData, 'turtle'))
        .rejects
        .toThrow();
    });

    it('should handle serialization errors', async () => {
      await expect(rdfCore.serialize([], 'invalid-format'))
        .rejects
        .toThrow();
    });
  });

  describe('Module Exports', () => {
    it('should export all individual components', () => {
      expect(GraphProcessor).toBeDefined();
      expect(NamespaceManager).toBeDefined();
      expect(RDFSerializers).toBeDefined();
      expect(HashCalculator).toBeDefined();
    });

    it('should allow creating individual components', () => {
      const graph = new GraphProcessor();
      const namespaces = new NamespaceManager();
      const serializers = new RDFSerializers();
      const hasher = new HashCalculator();

      expect(graph).toBeInstanceOf(GraphProcessor);
      expect(namespaces).toBeInstanceOf(NamespaceManager);
      expect(serializers).toBeInstanceOf(RDFSerializers);
      expect(hasher).toBeInstanceOf(HashCalculator);

      // Cleanup
      graph.destroy();
      hasher.clearCache();
    });
  });
});