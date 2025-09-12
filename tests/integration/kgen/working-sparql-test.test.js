/**
 * Working SPARQL CLI Integration Test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkingSparqlCliAdapter } from '../../../src/kgen/cli/working-sparql-adapter.js';
import { QueryTemplateLibrary } from '../../../src/kgen/cli/query-templates.js';
import { existsSync } from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

describe('Working SPARQL CLI Integration', () => {
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
    testDir = path.join(process.cwd(), 'test-temp', `working-${this.getDeterministicTimestamp()}`);
    await mkdir(testDir, { recursive: true });

    adapter = new WorkingSparqlCliAdapter({
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

  describe('CLI Integration Tests', () => {
    it('should successfully initialize both components', () => {
      expect(adapter).toBeDefined();
      expect(templateLibrary).toBeDefined();
      
      const status = adapter.getStatus();
      expect(status.adapter.initialized).toBe(true);
      
      const templates = templateLibrary.getTemplateNames();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should load and index graph data', async () => {
      const graphPath = path.join(testDir, 'test-graph.ttl');
      await writeFile(graphPath, sampleGraph);

      // Load graph
      const loadResult = await adapter.loadGraph(graphPath);
      expect(loadResult.tripleCount).toBeGreaterThan(0);
      expect(loadResult.graphHash).toMatch(/^[a-f0-9]{64}$/);

      // Build index 
      const index = await adapter.executeGraphIndex(graphPath);
      
      expect(index).toBeDefined();
      expect(index.metadata.tripleCount).toBeGreaterThan(0);
      expect(index.subjects).toBeDefined();
      expect(index.statistics).toBeDefined();
      
      // Verify files were created
      const indexFile = path.join(testDir, 'index', 'graph-index.json');
      const mapFile = path.join(testDir, 'index', 'subject-artifact-map.json');
      
      expect(existsSync(indexFile)).toBe(true);
      expect(existsSync(mapFile)).toBe(true);
    });

    it('should execute queries and template operations', async () => {
      await adapter.loadGraph(sampleGraph);

      // Test query execution
      const queryResult = await adapter.executeQuery('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 5');
      expect(queryResult).toBeDefined();
      expect(queryResult.metadata).toBeDefined();
      expect(queryResult.results).toBeDefined();

      // Test template queries
      const templateResult = await adapter.executeTemplateQueries('http://kgen.enterprise/TestTemplate');
      expect(templateResult).toBeDefined();
      expect(templateResult.templateInfo).toBeDefined();
      expect(templateResult.templateContext).toBeDefined();

      // Test dependency resolution
      const depResult = await adapter.executeArtifactDependencies(['http://kgen.enterprise/TestArtifact']);
      expect(depResult).toBeDefined();
      expect(depResult.metadata.inputArtifacts).toBe(1);
      expect(depResult.artifacts).toBeDefined();
    });

    it('should demonstrate CLI command workflow', async () => {
      // Simulate: kgen graph index test-graph.ttl
      const graphPath = path.join(testDir, 'api-model.ttl');
      await writeFile(graphPath, sampleGraph);

      let eventFired = false;
      adapter.on('index:built', (data) => {
        eventFired = true;
        expect(data.executionTime).toBeGreaterThanOrEqual(0);
        expect(data.statistics).toBeDefined();
      });

      const indexResult = await adapter.executeGraphIndex(graphPath, {
        format: 'turtle'
      });

      expect(eventFired).toBe(true);
      expect(indexResult.metadata.kgenVersion).toBe('1.0.0');
      expect(indexResult.statistics.subjects).toBeGreaterThan(0);

      // Verify the machine-readable index mapping exists
      const subjectMap = indexResult.subjects;
      expect(Object.keys(subjectMap).length).toBeGreaterThan(0);
      
      // Check for templates in the index
      const templateSubjects = Object.values(subjectMap).filter(s =>
        s.types.includes('http://kgen.enterprise/Template')
      );
      expect(templateSubjects.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive status and configuration', async () => {
      await adapter.loadGraph(sampleGraph);
      
      const status = adapter.getStatus();
      
      expect(status.adapter.version).toBe('1.0.0');
      expect(status.adapter.graphLoaded).toBe(true);
      expect(status.store.tripleCount).toBeGreaterThan(0);
      expect(status.configuration.outputFormat).toBe('json');
      expect(status.configuration.indexOutputDir).toContain('index');
    });

    it('should validate template library functionality', () => {
      // Test template parameter validation
      const validation = templateLibrary.validateParameters('template-info', {
        templateUri: 'http://kgen.enterprise/TestTemplate'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test template execution
      const query = templateLibrary.executeTemplate('template-info', {
        templateUri: 'http://kgen.enterprise/TestTemplate'
      });
      
      expect(query).toBeDefined();
      expect(query).toContain('http://kgen.enterprise/TestTemplate');
      expect(query).not.toContain('{{templateUri}}');
      expect(query).toContain('SELECT');
    });
  });
});