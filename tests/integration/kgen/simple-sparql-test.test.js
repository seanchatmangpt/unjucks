/**
 * Simple SPARQL CLI Integration Test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleSparqlCliAdapter } from '../../../src/kgen/cli/simple-sparql-adapter.js';
import { QueryTemplateLibrary } from '../../../src/kgen/cli/query-templates.js';
import { existsSync } from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

describe('Simple SPARQL CLI Integration', () => {
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
        rdfs:comment "Test template for CLI" .

    kgen:TestArtifact a kgen:Artifact ;
        foaf:name "Test Artifact" .

    kgen:TestEntity a kgen:Entity ;
        foaf:name "Test Entity" .
  `;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), 'test-temp', `simple-${this.getDeterministicTimestamp()}`);
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

  describe('Initialization', () => {
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
    it('should load graph data', async () => {
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
      
      // Check that files were created
      const indexFile = path.join(testDir, 'index', 'graph-index.json');
      const mapFile = path.join(testDir, 'index', 'subject-artifact-map.json');
      
      expect(existsSync(indexFile)).toBe(true);
      expect(existsSync(mapFile)).toBe(true);
    });
  });

  describe('Template Library', () => {
    it('should provide template names', () => {
      const templateNames = templateLibrary.getTemplateNames();
      
      expect(Array.isArray(templateNames)).toBe(true);
      expect(templateNames.length).toBeGreaterThan(0);
      expect(templateNames).toContain('template-info');
      expect(templateNames).toContain('direct-dependencies');
    });

    it('should execute template with parameters', () => {
      const query = templateLibrary.executeTemplate('template-info', {
        templateUri: 'http://example.com/template'
      });
      
      expect(query).toBeDefined();
      expect(query).toContain('http://example.com/template');
      expect(query).not.toContain('{{templateUri}}');
    });

    it('should validate parameters', () => {
      const validation = templateLibrary.validateParameters('template-info', {
        templateUri: 'http://kgen.enterprise/TestTemplate'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Basic Query Execution', () => {
    beforeEach(async () => {
      await adapter.loadGraph(sampleGraph);
    });

    it('should execute basic query', async () => {
      const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 5';
      const result = await adapter.executeQuery(query);
      
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.results).toBeDefined();
    });
  });

  describe('Status and Events', () => {
    it('should provide comprehensive status', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const status = adapter.getStatus();
      
      expect(status).toBeDefined();
      expect(status.adapter.graphLoaded).toBe(true);
      expect(status.store.tripleCount).toBeGreaterThan(0);
      expect(status.configuration.outputFormat).toBe('json');
    });

    it('should emit events during processing', async () => {
      let eventFired = false;
      
      adapter.on('graph:loaded', () => {
        eventFired = true;
      });

      await adapter.loadGraph(sampleGraph);
      expect(eventFired).toBe(true);
    });
  });
});