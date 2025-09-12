/**
 * Test Suite: Drift URI Resolver
 * 
 * Tests the drift:// URI scheme implementation for semantic patches
 * - Content-addressed patch storage
 * - Semantic vs syntactic change detection
 * - Patch generation and application
 * - RDF canonical normalization integration
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DriftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';
import { rdfCanonicalDriftProcessor } from '../../src/kgen/drift/rdf-canonical-drift.js';
import fs from 'fs/promises';
import path from 'path';

describe('Drift URI Resolver', () => {
  let resolver;
  const testDir = '.kgen-test/patches';

  beforeEach(async () => {
    resolver = new DriftURIResolver({
      storage: {
        patchDirectory: testDir,
        maxPatchSize: 1024 * 1024,
        retentionDays: 1
      }
    });
    
    await resolver.initializeStorage();
  });

  afterEach(async () => {
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Patch Storage and Retrieval', () => {
    test('should store and retrieve JSON patches', async () => {
      const baseline = { name: 'John', age: 25, city: 'Boston' };
      const current = { name: 'John', age: 26, city: 'New York' };

      // Store patch
      const storeResult = await resolver.storePatch(baseline, current, {
        source: 'test-case',
        format: 'json'
      });

      expect(storeResult.uri).toMatch(/^drift:\/\//);
      expect(storeResult.patch).toBeDefined();
      expect(storeResult.metadata.cid).toBeDefined();

      // Retrieve patch
      const retrieveResult = await resolver.retrievePatch(storeResult.uri);
      
      expect(retrieveResult.patch).toEqual(storeResult.patch);
      expect(retrieveResult.metadata.cid).toEqual(storeResult.metadata.cid);
    });

    test('should detect no changes for identical data', async () => {
      const data = { message: 'Hello, World!' };
      
      const result = await resolver.storePatch(data, data);
      
      expect(result.uri).toBeNull();
      expect(result.patch).toBeNull();
      expect(result.metadata.identical).toBe(true);
    });

    test('should categorize semantic vs cosmetic changes', async () => {
      const baseline = {
        '@context': 'http://schema.org',
        '@type': 'Person',
        'name': 'Alice Smith',
        'email': 'alice@example.com'
      };

      // Semantic change - type change
      const semanticChange = {
        '@context': 'http://schema.org',
        '@type': 'Organization',
        'name': 'Alice Smith',
        'email': 'alice@example.com'
      };

      // Cosmetic change - formatting
      const cosmeticChange = {
        '@context': 'http://schema.org',
        '@type': 'Person',
        'name': 'Alice Smith',
        'email': 'alice@example.com'
      };

      const semanticResult = await resolver.storePatch(baseline, semanticChange);
      const cosmeticResult = await resolver.storePatch(baseline, cosmeticChange);

      expect(semanticResult.metadata.semantic.type).toBe('semantic');
      expect(semanticResult.metadata.semantic.significance).toBeGreaterThan(0.3);
      
      expect(cosmeticResult.uri).toBeNull(); // Identical after normalization
    });
  });

  describe('Drift URI Schemes', () => {
    test('should generate hash-based URIs for generic patches', async () => {
      const baseline = { value: 100 };
      const current = { value: 200 };

      const result = await resolver.storePatch(baseline, current);
      
      expect(result.uri).toMatch(/^drift:\/\/hash\//);
    });

    test('should generate semantic URIs for significant changes', async () => {
      const baseline = {
        id: 'entity-1',
        type: 'TypeA',
        properties: { name: 'Test' }
      };
      
      const current = {
        id: 'entity-1',
        type: 'TypeB', // Significant semantic change
        properties: { name: 'Test', category: 'New' }
      };

      const result = await resolver.storePatch(baseline, current);
      
      expect(result.uri).toMatch(/^drift:\/\/semantic\//);
    });

    test('should parse drift URIs correctly', () => {
      const hashURI = 'drift://hash/QmAbC123';
      const semanticURI = 'drift://semantic/structural/QmDef456';
      const rdfURI = 'drift://rdf/turtle/QmGhi789';

      const hashComponents = resolver.parseDriftURI(hashURI);
      expect(hashComponents.scheme).toBe('hash');
      expect(hashComponents.id).toBe('QmAbC123');

      const semanticComponents = resolver.parseDriftURI(semanticURI);
      expect(semanticComponents.scheme).toBe('semantic');
      expect(semanticComponents.type).toBe('structural');
      expect(semanticComponents.id).toBe('QmDef456');

      const rdfComponents = resolver.parseDriftURI(rdfURI);
      expect(rdfComponents.scheme).toBe('rdf');
      expect(rdfComponents.format).toBe('turtle');
      expect(rdfComponents.hash).toBe('QmGhi789');
    });
  });

  describe('Patch Application', () => {
    test('should apply patches correctly', async () => {
      const baseline = { 
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]
      };
      
      const modified = { 
        users: [
          { id: 1, name: 'Alice Cooper' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' }
        ]
      };

      // Store patch
      const storeResult = await resolver.storePatch(baseline, modified);
      
      // Apply patch
      const applyResult = await resolver.applyPatch(baseline, storeResult.patch);
      
      expect(applyResult.result).toEqual(modified);
      expect(applyResult.metadata.baselineHash).toBeDefined();
      expect(applyResult.metadata.resultHash).toBeDefined();
    });

    test('should apply patches from drift URIs', async () => {
      const baseline = { counter: 0, status: 'inactive' };
      const modified = { counter: 42, status: 'active' };

      const storeResult = await resolver.storePatch(baseline, modified);
      const applyResult = await resolver.applyPatch(baseline, storeResult.uri);
      
      expect(applyResult.result).toEqual(modified);
    });

    test('should generate reverse patches', async () => {
      const original = { state: 'A', value: 10 };
      const modified = { state: 'B', value: 20 };

      const reverseResult = await resolver.generateReversePatch(original, modified);
      
      expect(reverseResult.uri).toMatch(/^drift:\/\//);
      expect(reverseResult.patch).toBeDefined();

      // Apply reverse patch to get back to original
      const applyResult = await resolver.applyPatch(modified, reverseResult.patch);
      expect(applyResult.result).toEqual(original);
    });
  });

  describe('Semantic Analysis', () => {
    test('should analyze structured data semantically', async () => {
      const baseline = {
        '@id': 'http://example.org/person/1',
        '@type': 'Person',
        'name': 'John Doe',
        'age': 30
      };
      
      const current = {
        '@id': 'http://example.org/person/1',
        '@type': 'Employee', // Semantic change
        'name': 'John Doe',
        'age': 31
      };

      const result = await resolver.storePatch(baseline, current);
      
      expect(result.metadata.semantic.hasStructuralChanges).toBe(true);
      expect(result.metadata.semantic.type).toBe('semantic');
      expect(result.metadata.semantic.significance).toBeGreaterThan(0.1);
    });

    test('should categorize operations correctly', () => {
      const patch = {
        'name': ['John', 'Jane'],         // Modification
        'email': ['jane@example.com'],    // Addition
        'phone': ['+1234567890', 0, 0],   // Deletion
        'addresses': {
          '_t': 'a',                      // Array change (structural)
          '1': ['123 Main St']
        }
      };

      const operations = resolver.categorizeOperations(patch);
      
      expect(operations.modifications).toBe(1);
      expect(operations.additions).toBe(1);
      expect(operations.deletions).toBe(1);
      expect(operations.structural).toBe(1);
    });
  });

  describe('Performance and Metrics', () => {
    test('should track performance metrics', async () => {
      const baseline = { data: 'test' };
      const current = { data: 'modified' };

      await resolver.storePatch(baseline, current);
      await resolver.retrievePatch('drift://hash/nonexistent');

      const metrics = resolver.getMetrics();
      
      expect(metrics.patchesStored).toBe(1);
      expect(metrics.patchesRetrieved).toBe(1);
      expect(metrics.averageRetrievalTime).toBeGreaterThan(0);
      expect(metrics.casMetrics).toBeDefined();
    });

    test('should handle cleanup operations', async () => {
      await resolver.cleanup();
      // Test should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid drift URIs', async () => {
      await expect(resolver.retrievePatch('invalid://uri')).rejects.toThrow();
      await expect(resolver.retrievePatch('drift://unknown/scheme')).rejects.toThrow();
    });

    test('should handle patch application errors', async () => {
      const baseline = { data: 'test' };
      const invalidPatch = { invalid: 'patch format' };

      await expect(resolver.applyPatch(baseline, 'drift://hash/nonexistent'))
        .rejects.toThrow();
    });
  });
});

describe('RDF Canonical Drift Processing', () => {
  let processor;

  beforeEach(() => {
    processor = rdfCanonicalDriftProcessor;
  });

  describe('RDF Graph Comparison', () => {
    test('should detect canonical equivalence', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:Alice a ex:Person ;
                 ex:name "Alice Smith" ;
                 ex:age 30 .
      `;
      
      const rdf2 = `
        @prefix example: <http://example.org/> .
        example:Alice example:age 30 ;
                     example:name "Alice Smith" ;
                     a example:Person .
      `;

      const result = await processor.analyzeCanonicalDrift(rdf1, rdf2, {
        format: 'turtle'
      });

      expect(result.canonicallyEquivalent).toBe(true);
      expect(result.syntacticallyIdentical).toBe(false);
    });

    test('should detect semantic changes in RDF', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:Alice a ex:Person ;
                 ex:name "Alice" .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:Alice a ex:Employee ;
                 ex:name "Alice" .
      `;

      const result = await processor.analyzeCanonicalDrift(rdf1, rdf2, {
        format: 'turtle',
        generateDriftURI: true
      });

      expect(result.canonicallyEquivalent).toBe(false);
      expect(result.semanticChanges.length).toBeGreaterThan(0);
      expect(result.significance).toBeGreaterThan(0);
      expect(result.driftURI).toMatch(/^drift:\/\//);
    });

    test('should categorize RDF changes by vocabulary importance', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Alice a ex:Person ;
                 rdfs:label "Alice" ;
                 rdfs:comment "A person" .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Alice a ex:Employee ;
                 rdfs:label "Alice Smith" ;
                 rdfs:comment "An employee" .
      `;

      const result = await processor.analyzeCanonicalDrift(rdf1, rdf2, {
        format: 'turtle'
      });

      expect(result.semanticChanges.length).toBeGreaterThan(0);
      
      // rdf:type changes should have highest significance
      const typeChange = result.semanticChanges.find(change => 
        change.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      expect(typeChange?.weight).toBe(1.0);
    });
  });

  describe('Performance Metrics', () => {
    test('should track RDF processing metrics', async () => {
      const rdf1 = `@prefix ex: <http://example.org/> . ex:test ex:prop "value1" .`;
      const rdf2 = `@prefix ex: <http://example.org/> . ex:test ex:prop "value2" .`;

      await processor.analyzeCanonicalDrift(rdf1, rdf2);
      
      const metrics = processor.getMetrics();
      expect(metrics.canonicalComparisons).toBe(1);
      expect(metrics.averageComparisonTime).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests', () => {
  test('should integrate drift URIs with semantic drift detection', async () => {
    const resolver = new DriftURIResolver();
    await resolver.initializeStorage();

    const baseline = {
      '@context': { '@vocab': 'http://schema.org/' },
      '@type': 'Person',
      'name': 'Alice',
      'jobTitle': 'Developer'
    };
    
    const current = {
      '@context': { '@vocab': 'http://schema.org/' },
      '@type': 'Person',
      'name': 'Alice',
      'jobTitle': 'Senior Developer'
    };

    const result = await resolver.storePatch(baseline, current, {
      format: 'jsonld'
    });

    expect(result.uri).toBeDefined();
    expect(result.metadata.semantic.type).toMatch(/semantic|cosmetic/);
    
    // Should be able to apply the patch
    const applyResult = await resolver.applyPatch(baseline, result.uri);
    expect(applyResult.result).toEqual(current);
  });
});