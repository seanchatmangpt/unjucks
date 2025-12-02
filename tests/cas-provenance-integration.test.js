/**
 * CAS + Provenance Integration Test
 * 
 * Comprehensive test of the unified CAS and provenance system
 * following the requirements:
 * - Only storage.js, retrieval.js, gc.js in cas/ directory
 * - SHA256 content addressing throughout
 * - Provenance object structure validation
 * - Single, clean CAS implementation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { CASStorage, CASRetrieval, CASGarbageCollector, cas } from '../packages/kgen-core/src/cas/cas-entry.js';
import { ProvenanceGenerator, provenanceGenerator } from '../packages/kgen-core/src/provenance/core.js';

describe('CAS + Provenance Integration', () => {
  const testDir = '.test-cas-integration';
  const testFiles = {
    artifact: join(testDir, 'test-artifact.js'),
    template: join(testDir, 'test-template.njk'),
    graph: join(testDir, 'test-graph.ttl'
  };

  beforeAll(async () => {
    // Create test directory and files
    await fs.mkdir(testDir, { recursive: true });
    
    await fs.writeFile(testFiles.artifact, `
      // Generated test artifact
      export const greeting = "Hello, World!";
      export const timestamp = "${new Date().toISOString()}";
    `);
    
    await fs.writeFile(testFiles.template, `
      // Template: {{ templateId }}
      export const greeting = "{{ greeting }}";
      export const timestamp = "{{ timestamp }}";
    `);
    
    await fs.writeFile(testFiles.graph, `
      @prefix kgen: <https://kgen.org/ontology#> .
      @prefix prov: <http://www.w3.org/ns/prov#> .
      
      <#artifact> a kgen:Artifact ;
        prov:generatedAtTime "{{ generatedAt }}" ;
        kgen:derivedFromTemplate <#template> .
      
      <#template> a kgen:Template ;
        kgen:templateId "{{ templateId }}" .
    `);
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm('.test-cas', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('CAS Implementation', () => {
    test('should only have required CAS files', async () => {
      const casDir = 'packages/kgen-core/src/cas';
      const files = await fs.readdir(casDir);
      const expectedFiles = ['storage.js', 'retrieval.js', 'gc.js', 'cas-entry.js'];
      
      expect(files.sort()).toEqual(expectedFiles.sort());
    });

    test('should use SHA256 content addressing', async () => {
      const storage = new CASStorage({ basePath: '.test-cas' });
      const testContent = 'Test content for SHA256';
      
      const hash = await storage.store(testContent);
      
      // SHA256 hashes are 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    test('should store and retrieve content correctly', async () => {
      const testContent = 'Another test content';
      
      const hash = await cas.store(testContent);
      const retrieved = await cas.retrieve(hash);
      
      expect(retrieved.toString()).toBe(testContent);
    });

    test('should verify content integrity', async () => {
      const testContent = 'Content for verification';
      
      const hash = await cas.store(testContent);
      const isValid = await cas.verify(hash, testContent);
      
      expect(isValid).toBe(true);
    });

    test('should provide unified API', async () => {
      const content = 'Unified API test';
      
      const hash = await cas.store(content);
      const exists = await cas.exists(hash);
      const calculatedHash = cas.calculateHash(content);
      const allHashes = await cas.list();
      
      expect(exists).toBe(true);
      expect(calculatedHash).toBe(hash);
      expect(allHashes).toContain(hash);
    });
  });

  describe('Provenance Object Structure', () => {
    test('should generate provenance with required structure', async () => {
      const provenance = await provenanceGenerator.generateProvenance({
        artifactPath: testFiles.artifact,
        templateId: 'test-template-123',
        templatePath: testFiles.template,
        graphPath: testFiles.graph,
        kgenVersion: '1.0.0'
      });

      // Verify required structure: { artifact.path, artifact.hash, template.id, template.hash, graph.path, graph.hash, generatedAt, kgenVersion }
      expect(provenance).toHaveProperty('artifact.path', testFiles.artifact);
      expect(provenance).toHaveProperty('artifact.hash');
      expect(provenance).toHaveProperty('template.id', 'test-template-123');
      expect(provenance).toHaveProperty('template.hash');
      expect(provenance).toHaveProperty('graph.path', testFiles.graph);
      expect(provenance).toHaveProperty('graph.hash');
      expect(provenance).toHaveProperty('generatedAt');
      expect(provenance).toHaveProperty('kgenVersion', '1.0.0');

      // Verify hash format (SHA256)
      expect(provenance.artifact.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(provenance.template.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(provenance.graph.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should validate provenance structure', async () => {
      const validProvenance = {
        artifact: {
          path: testFiles.artifact,
          hash: 'a'.repeat(64) // Valid SHA256 format
        },
        template: {
          id: 'test-template',
          hash: 'b'.repeat(64)
        },
        graph: {
          path: testFiles.graph,
          hash: 'c'.repeat(64)
        },
        generatedAt: new Date().toISOString(),
        kgenVersion: '1.0.0'
      };

      const validation = provenanceGenerator.validateProvenance(validProvenance);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid provenance structure', async () => {
      const invalidProvenance = {
        artifact: {
          path: testFiles.artifact,
          // Missing hash
        },
        template: {
          // Missing both id and hash
        },
        // Missing generatedAt and kgenVersion
      };

      const validation = provenanceGenerator.validateProvenance(invalidProvenance);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('CAS + Provenance Integration', () => {
    test('should store provenance artifacts in CAS', async () => {
      const provenance = new ProvenanceGenerator({ enableCAS: true });
      
      const provenanceObj = await provenance.generateProvenance({
        artifactPath: testFiles.artifact,
        templateId: 'integration-test',
        templatePath: testFiles.template,
        graphPath: testFiles.graph,
        kgenVersion: '1.0.0'
      });

      // Verify artifacts were stored in CAS
      const artifactExists = await cas.exists(provenanceObj.artifact.hash);
      const templateExists = await cas.exists(provenanceObj.template.hash);
      const graphExists = await cas.exists(provenanceObj.graph.hash);

      expect(artifactExists).toBe(true);
      expect(templateExists).toBe(true);
      expect(graphExists).toBe(true);
    });

    test('should compare provenance objects', async () => {
      const provenance1 = await provenanceGenerator.generateProvenance({
        artifactPath: testFiles.artifact,
        templateId: 'compare-test',
        kgenVersion: '1.0.0'
      });

      const provenance2 = await provenanceGenerator.generateProvenance({
        artifactPath: testFiles.artifact, // Same artifact
        templateId: 'compare-test',       // Same template
        kgenVersion: '1.0.0'              // Same version
      });

      const comparison = provenanceGenerator.compareProvenance(provenance1, provenance2);
      
      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toHaveLength(0);
      expect(comparison.similarities.length).toBeGreaterThan(0);
    });

    test('should extract provenance from context', async () => {
      const context = {
        outputPath: testFiles.artifact,
        templateInfo: {
          id: 'context-template',
          path: testFiles.template
        },
        graphInfo: {
          path: testFiles.graph
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      const provenance = await provenanceGenerator.generateFromContext(context);
      
      expect(provenance.artifact.path).toBe(testFiles.artifact);
      expect(provenance.template.id).toBe('context-template');
      expect(provenance.kgenVersion).toBe('1.0.0');
    });
  });

  describe('Garbage Collection', () => {
    test('should perform garbage collection', async () => {
      const storage = new CASStorage({ basePath: '.test-cas-gc' });
      const gc = new CASGarbageCollector({ 
        storage,
        maxAge: 1, // 1ms for immediate cleanup
        dryRun: true
      });

      // Store some test content
      await storage.store('GC test content 1');
      await storage.store('GC test content 2');

      const result = await gc.run();
      
      expect(result.success).toBe(true);
      expect(result.itemsScanned).toBeGreaterThanOrEqual(0);
    });

    test('should get storage statistics', async () => {
      const gc = new CASGarbageCollector();
      const stats = await gc.getStats();
      
      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('ageDistribution');
      expect(stats.ageDistribution).toHaveProperty('recent');
      expect(stats.ageDistribution).toHaveProperty('medium');
      expect(stats.ageDistribution).toHaveProperty('old');
      expect(stats.ageDistribution).toHaveProperty('ancient');
    });
  });

  describe('Exports and API', () => {
    test('should export all required classes and instances', async () => {
      const casEntry = await import('../packages/kgen-core/src/cas/cas-entry.js');
      
      expect(casEntry.CASStorage).toBeDefined();
      expect(casEntry.CASRetrieval).toBeDefined();
      expect(casEntry.CASGarbageCollector).toBeDefined();
      expect(casEntry.casStorage).toBeDefined();
      expect(casEntry.casRetrieval).toBeDefined();
      expect(casEntry.casGC).toBeDefined();
      expect(casEntry.cas).toBeDefined();
      expect(casEntry.createCAS).toBeDefined();
    });

    test('should create complete CAS system', async () => {
      const { createCAS } = await import('../packages/kgen-core/src/cas/cas-entry.js');
      
      const casSystem = createCAS({ basePath: '.test-cas-complete' });
      
      expect(casSystem).toHaveProperty('storage');
      expect(casSystem).toHaveProperty('retrieval');
      expect(casSystem).toHaveProperty('gc');
      expect(casSystem).toHaveProperty('store');
      expect(casSystem).toHaveProperty('retrieve');
      expect(casSystem).toHaveProperty('exists');
      expect(casSystem).toHaveProperty('calculateHash');
      expect(casSystem).toHaveProperty('verify');
      expect(casSystem).toHaveProperty('list');
      expect(casSystem).toHaveProperty('getMetrics');

      // Test the unified API
      const testContent = 'Complete CAS system test';
      const hash = await casSystem.store(testContent);
      const retrieved = await casSystem.retrieve(hash);
      
      expect(retrieved.toString()).toBe(testContent);
    });
  });
});