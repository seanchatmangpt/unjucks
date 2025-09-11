/**
 * Integration Tests for SPARQL CLI Adapter
 * 
 * Tests the integration between SPARQL engines and CLI commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleSparqlCliAdapter } from '../../../src/kgen/cli/simple-sparql-adapter.js';
import { QueryTemplateLibrary } from '../../../src/kgen/cli/query-templates.js';
import { existsSync } from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

describe('SPARQL CLI Integration', () => {
  let adapter;
  let templateLibrary;
  let testDir;

  const sampleGraph = `
    @prefix kgen: <http://kgen.enterprise/> .
    @prefix prov: <http://www.w3.org/ns/prov#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .

    kgen:TestTemplate a kgen:Template ;
        foaf:name "Test Template" ;
        rdfs:comment "Test template for CLI" ;
        kgen:generates kgen:TestArtifact .

    kgen:TestArtifact a kgen:Artifact ;
        foaf:name "Test Artifact" ;
        prov:wasDerivedFrom kgen:TestEntity .

    kgen:TestEntity a kgen:Entity ;
        foaf:name "Test Entity" .
  `;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), 'test-temp', `integration-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Initialize components
    adapter = new SimpleSparqlCliAdapter({
      outputFormat: 'json',
      indexOutputDir: path.join(testDir, 'index'),
      enableVerbose: false
    });

    templateLibrary = new QueryTemplateLibrary();
    await adapter.initialize();
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Integration', () => {
    it('should initialize adapter successfully', () => {
      expect(adapter).toBeDefined();
      const status = adapter.getStatus();
      expect(status.adapter.initialized).toBe(true);
    });

    it('should initialize template library successfully', () => {
      expect(templateLibrary).toBeDefined();
      const templates = templateLibrary.getTemplateNames();
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('Graph Processing', () => {
    it('should load and process graph data', async () => {
      const result = await adapter.loadGraph(sampleGraph);
      
      expect(result.tripleCount).toBeGreaterThan(0);
      expect(result.graphHash).toBeDefined();
      expect(result.graphHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should build graph index', async () => {
      // Create test file
      const graphPath = path.join(testDir, 'test-graph.ttl');
      await writeFile(graphPath, sampleGraph);

      const index = await adapter.executeGraphIndex(graphPath);
      
      expect(index).toBeDefined();
      expect(index.metadata).toBeDefined();
      expect(index.subjects).toBeDefined();
      expect(index.statistics).toBeDefined();
    });
  });

  describe('Query Template Integration', () => {
    beforeEach(async () => {
      await adapter.loadGraph(sampleGraph);
    });

    it('should execute template info query', async () => {
      const templateUri = 'http://kgen.enterprise/TestTemplate';
      
      // Test template library query generation
      const query = templateLibrary.executeTemplate('template-info', {
        templateUri: templateUri
      });
      
      expect(query).toBeDefined();
      expect(query).toContain(templateUri);
      expect(query).not.toContain('{{templateUri}}');

      // Test query execution through adapter
      const result = await adapter.executeQuery(query);
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    });

    it('should validate template parameters', () => {
      const validation = templateLibrary.validateParameters('template-info', {
        templateUri: 'http://kgen.enterprise/TestTemplate'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should execute artifact dependency query', async () => {
      const artifactUri = 'http://kgen.enterprise/TestArtifact';
      
      const query = templateLibrary.executeTemplate('direct-dependencies', {
        artifactUri: artifactUri
      });
      
      const result = await adapter.executeQuery(query);
      expect(result).toBeDefined();
    });
  });

  describe('CLI Command Simulation', () => {
    it('should simulate kgen graph index command', async () => {
      const graphPath = path.join(testDir, 'test.ttl');
      await writeFile(graphPath, sampleGraph);

      const result = await adapter.executeGraphIndex(graphPath, {
        format: 'turtle'
      });

      expect(result).toBeDefined();
      expect(result.metadata.tripleCount).toBeGreaterThan(0);
      expect(result.statistics.subjects).toBeGreaterThan(0);
      
      // Verify index files were created
      const indexFile = path.join(testDir, 'index', 'graph-index.json');
      const mapFile = path.join(testDir, 'index', 'subject-artifact-map.json');
      
      expect(existsSync(indexFile)).toBe(true);
      expect(existsSync(mapFile)).toBe(true);
    });

    it('should simulate template analysis workflow', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const templateUri = 'http://kgen.enterprise/TestTemplate';
      const results = await adapter.executeTemplateQueries(templateUri);
      
      expect(results).toBeDefined();
      expect(results.templateInfo).toBeDefined();
      expect(results.templateContext).toBeDefined();
      expect(results.templateDependencies).toBeDefined();
      expect(results.requiredProperties).toBeDefined();
    });

    it('should simulate dependency resolution workflow', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const artifactUris = ['http://kgen.enterprise/TestArtifact'];
      const result = await adapter.executeArtifactDependencies(artifactUris);
      
      expect(result).toBeDefined();
      expect(result.metadata.inputArtifacts).toBe(1);
      expect(result.artifacts).toBeDefined();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large query results efficiently', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const startTime = Date.now();
      const result = await adapter.executeQuery('SELECT ?s ?p ?o WHERE { ?s ?p ?o }');
      const executionTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should provide status and metrics', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const status = adapter.getStatus();
      
      expect(status).toBeDefined();
      expect(status.adapter.graphLoaded).toBe(true);
      expect(status.store.tripleCount).toBeGreaterThan(0);
      expect(status.configuration.outputFormat).toBe('json');
    });
  });
});