/**
 * Tests for SPARQL CLI Adapter
 * 
 * Tests the CLI integration of SPARQL engines with graph indexing,
 * dependency analysis, and impact assessment capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SparqlCliAdapter } from '../../../src/kgen/cli/sparql-adapter.js';
import { QueryTemplateLibrary } from '../../../src/kgen/cli/query-templates.js';
import { existsSync } from 'fs';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

describe('SparqlCliAdapter', () => {
  let adapter;
  let testDir;
  let sampleGraphPath;

  const sampleTurtleGraph = `
    @prefix kgen: <http://kgen.enterprise/> .
    @prefix prov: <http://www.w3.org/ns/prov#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .

    # Templates
    kgen:ApiTemplate a kgen:Template ;
        foaf:name "API Service Template" ;
        rdfs:comment "Generates REST API services" ;
        kgen:version "1.0.0" ;
        kgen:requiresProperty kgen:serviceName, kgen:apiVersion ;
        kgen:generates kgen:ControllerArtifact, kgen:ModelArtifact .

    kgen:serviceName rdfs:label "Service Name" ;
        rdfs:range xsd:string ;
        kgen:required true .

    kgen:apiVersion rdfs:label "API Version" ;
        rdfs:range xsd:string ;
        kgen:required true ;
        kgen:defaultValue "v1" .

    # Artifacts  
    kgen:ControllerArtifact a kgen:Artifact ;
        foaf:name "API Controller" ;
        kgen:outputPath "src/controllers/{{serviceName}}Controller.ts" ;
        kgen:format "typescript" ;
        prov:wasDerivedFrom kgen:ApiService .

    kgen:ModelArtifact a kgen:Artifact ;
        foaf:name "Data Model" ;
        kgen:outputPath "src/models/{{serviceName}}Model.ts" ;
        kgen:format "typescript" ;
        prov:wasDerivedFrom kgen:ApiService ;
        kgen:dependsOn kgen:BaseModel .

    # Source entities
    kgen:ApiService a kgen:Entity ;
        foaf:name "User API Service" ;
        kgen:serviceName "User" ;
        kgen:apiVersion "v2" ;
        kgen:generates kgen:ControllerArtifact, kgen:ModelArtifact .

    kgen:BaseModel a kgen:Artifact ;
        foaf:name "Base Model Class" ;
        kgen:outputPath "src/models/BaseModel.ts" .
  `;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(process.cwd(), 'test-temp', `sparql-${this.getDeterministicTimestamp()}`);
    await mkdir(testDir, { recursive: true });

    // Create sample graph file
    sampleGraphPath = path.join(testDir, 'sample.ttl');
    await writeFile(sampleGraphPath, sampleTurtleGraph);

    // Initialize adapter with test configuration
    adapter = new SparqlCliAdapter({
      outputFormat: 'json',
      enableVerbose: false,
      enableProgress: false,
      indexOutputDir: path.join(testDir, 'index'),
      queryTimeout: 5000,
      maxResults: 1000
    });

    await adapter.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(adapter).toBeDefined();
      
      const status = adapter.getStatus();
      expect(status.adapter.initialized).toBe(true);
      expect(status.adapter.version).toBe('1.0.0');
    });

    it('should create index directory', () => {
      const indexDir = path.join(testDir, 'index');
      expect(existsSync(indexDir)).toBe(true);
    });
  });

  describe('Graph Loading', () => {
    it('should load RDF graph from file', async () => {
      const result = await adapter.loadGraph(sampleGraphPath);
      
      expect(result.tripleCount).toBeGreaterThan(0);
      expect(result.format).toBe('turtle');
      expect(result.graphHash).toBeDefined();
      expect(result.graphHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should load RDF graph from string', async () => {
      const result = await adapter.loadGraph(sampleTurtleGraph);
      
      expect(result.tripleCount).toBeGreaterThan(0);
      expect(result.graphHash).toBeDefined();
    });

    it('should emit graph loaded event', async () => {
      const eventSpy = vi.fn();
      adapter.on('graph:loaded', eventSpy);

      await adapter.loadGraph(sampleGraphPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tripleCount: expect.any(Number),
          format: 'turtle',
          source: sampleGraphPath
        })
      );
    });
  });

  describe('Graph Indexing', () => {
    it('should build comprehensive graph index', async () => {
      const index = await adapter.executeGraphIndex(sampleGraphPath);
      
      expect(index).toBeDefined();
      expect(index.metadata).toBeDefined();
      expect(index.metadata.tripleCount).toBeGreaterThan(0);
      expect(index.metadata.graphHash).toBeDefined();
      
      expect(index.subjects).toBeDefined();
      expect(index.artifacts).toBeDefined();
      expect(index.templates).toBeDefined();
      expect(index.dependencies).toBeDefined();
      expect(index.statistics).toBeDefined();
    });

    it('should create subject-artifact mapping', async () => {
      const index = await adapter.executeGraphIndex(sampleGraphPath);
      
      expect(index.subjects).toBeDefined();
      expect(Object.keys(index.subjects).length).toBeGreaterThan(0);
      
      // Should have template subjects
      const templateSubjects = Object.values(index.subjects).filter(s =>
        s.types.includes('http://kgen.enterprise/Template')
      );
      expect(templateSubjects.length).toBeGreaterThan(0);
    });

    it('should create reverse artifact-to-subject mapping', async () => {
      const index = await adapter.executeGraphIndex(sampleGraphPath);
      
      expect(index.artifacts).toBeDefined();
      
      // Should have artifacts pointing to subjects
      const artifactCount = Object.keys(index.artifacts).length;
      expect(artifactCount).toBeGreaterThan(0);
    });

    it('should calculate index statistics', async () => {
      const index = await adapter.executeGraphIndex(sampleGraphPath);
      
      expect(index.statistics).toBeDefined();
      expect(index.statistics.subjects).toBeGreaterThan(0);
      expect(index.statistics.totalProperties).toBeGreaterThan(0);
      expect(index.statistics.uniquePredicates).toBeGreaterThan(0);
      expect(index.statistics.typeDistribution).toBeDefined();
    });

    it('should emit index built event', async () => {
      const eventSpy = vi.fn();
      adapter.on('index:built', eventSpy);

      await adapter.executeGraphIndex(sampleGraphPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          indexPath: expect.stringContaining('graph-index.json'),
          subjectMapPath: expect.stringContaining('subject-artifact-map.json'),
          executionTime: expect.any(Number),
          statistics: expect.any(Object)
        })
      );
    });
  });

  describe('Template Queries', () => {
    beforeEach(async () => {
      await adapter.loadGraph(sampleGraphPath);
    });

    it('should execute template analysis queries', async () => {
      const templateUri = 'http://kgen.enterprise/ApiTemplate';
      const results = await adapter.executeTemplateQueries(templateUri);
      
      expect(results).toBeDefined();
      expect(results.templateInfo).toBeDefined();
      expect(results.templateContext).toBeDefined();
      expect(results.templateDependencies).toBeDefined();
      expect(results.requiredProperties).toBeDefined();
    });

    it('should process template info results', async () => {
      const templateUri = 'http://kgen.enterprise/ApiTemplate';
      const results = await adapter.executeTemplateQueries(templateUri);
      
      const templateInfo = results.templateInfo;
      expect(Array.isArray(templateInfo)).toBe(true);
      
      if (templateInfo.length > 0) {
        expect(templateInfo[0]).toHaveProperty('template');
        expect(templateInfo[0]).toHaveProperty('name');
        expect(templateInfo[0]).toHaveProperty('description');
      }
    });

    it('should handle template query errors gracefully', async () => {
      const invalidUri = 'http://example.com/NonExistentTemplate';
      const results = await adapter.executeTemplateQueries(invalidUri);
      
      // Should not throw, but may return empty results
      expect(results).toBeDefined();
    });
  });

  describe('Graph Diff Analysis', () => {
    let modifiedGraphPath;

    beforeEach(async () => {
      // Create a modified version of the graph
      const modifiedGraph = sampleTurtleGraph + `
        # Added content
        kgen:NewArtifact a kgen:Artifact ;
            foaf:name "New Artifact" ;
            kgen:outputPath "src/new/NewArtifact.ts" .
      `;
      
      modifiedGraphPath = path.join(testDir, 'modified.ttl');
      await writeFile(modifiedGraphPath, modifiedGraph);
    });

    it('should analyze graph differences', async () => {
      const diff = await adapter.executeGraphDiff(sampleGraphPath, modifiedGraphPath);
      
      expect(diff).toBeDefined();
      expect(diff.metadata).toBeDefined();
      expect(diff.metadata.baseGraph).toBe(sampleGraphPath);
      expect(diff.metadata.targetGraph).toBe(modifiedGraphPath);
      expect(diff.metadata.baseHash).toBeDefined();
      expect(diff.metadata.targetHash).toBeDefined();
      
      expect(diff.changes).toBeDefined();
      expect(diff.changes.added).toBeGreaterThan(0);
      
      expect(diff.triples).toBeDefined();
      expect(diff.triples.added).toBeDefined();
      expect(diff.triples.removed).toBeDefined();
      
      expect(diff.impact).toBeDefined();
    });

    it('should calculate impact analysis', async () => {
      const diff = await adapter.executeGraphDiff(sampleGraphPath, modifiedGraphPath);
      
      expect(diff.impact).toBeDefined();
      expect(diff.impact.impactedSubjects).toBeDefined();
      expect(Array.isArray(diff.impact.impactedSubjects)).toBe(true);
      expect(diff.impact.estimatedRebuildRequired).toBeDefined();
      expect(diff.impact.riskLevel).toMatch(/^(low|medium|high)$/);
    });

    it('should emit diff analyzed event', async () => {
      const eventSpy = vi.fn();
      adapter.on('diff:analyzed', eventSpy);

      await adapter.executeGraphDiff(sampleGraphPath, modifiedGraphPath);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          baseGraph: sampleGraphPath,
          targetGraph: modifiedGraphPath,
          changes: expect.any(Object),
          impactedArtifacts: expect.any(Number)
        })
      );
    });
  });

  describe('Artifact Dependencies', () => {
    beforeEach(async () => {
      await adapter.loadGraph(sampleGraphPath);
    });

    it('should resolve artifact dependencies', async () => {
      const artifactUris = [
        'http://kgen.enterprise/ControllerArtifact',
        'http://kgen.enterprise/ModelArtifact'
      ];
      
      const result = await adapter.executeArtifactDependencies(artifactUris);
      
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.inputArtifacts).toBe(2);
      expect(result.artifacts).toBeDefined();
      
      for (const artifactUri of artifactUris) {
        expect(result.artifacts[artifactUri]).toBeDefined();
      }
    });

    it('should calculate dependency counts', async () => {
      const artifactUris = ['http://kgen.enterprise/ModelArtifact'];
      const result = await adapter.executeArtifactDependencies(artifactUris);
      
      const modelArtifact = result.artifacts[artifactUris[0]];
      expect(modelArtifact).toBeDefined();
      
      if (!modelArtifact.error) {
        expect(modelArtifact.directDependencies).toBeDefined();
        expect(modelArtifact.transitiveDependencies).toBeDefined();
      }
    });

    it('should emit dependencies resolved event', async () => {
      const eventSpy = vi.fn();
      adapter.on('dependencies:resolved', eventSpy);

      const artifactUris = ['http://kgen.enterprise/ControllerArtifact'];
      await adapter.executeArtifactDependencies(artifactUris);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputArtifacts: 1,
          resolvedArtifacts: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('Custom Query Execution', () => {
    beforeEach(async () => {
      await adapter.loadGraph(sampleGraphPath);
    });

    it('should execute custom SPARQL query', async () => {
      const query = `
        PREFIX kgen: <http://kgen.enterprise/>
        SELECT ?template WHERE {
          ?template a kgen:Template .
        }
      `;
      
      const result = await adapter.executeQuery(query);
      
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.resultCount).toBeDefined();
      expect(result.results).toBeDefined();
    });

    it('should handle query with limit option', async () => {
      const query = `
        SELECT ?s ?p ?o WHERE {
          ?s ?p ?o .
        }
      `;
      
      const result = await adapter.executeQuery(query, { limit: 5 });
      
      expect(result).toBeDefined();
      expect(result.metadata.resultCount).toBeLessThanOrEqual(5);
    });

    it('should emit query executed event', async () => {
      const eventSpy = vi.fn();
      adapter.on('query:executed', eventSpy);

      const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 1';
      await adapter.executeQuery(query);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resultCount: expect.any(Number),
          executionTime: expect.any(Number)
        })
      );
    });
  });

  describe('Status and Metrics', () => {
    it('should provide comprehensive status information', () => {
      const status = adapter.getStatus();
      
      expect(status).toBeDefined();
      expect(status.adapter).toBeDefined();
      expect(status.store).toBeDefined();
      expect(status.configuration).toBeDefined();
      
      expect(status.adapter.version).toBe('1.0.0');
      expect(status.adapter.initialized).toBe(true);
      expect(status.store.tripleCount).toBeDefined();
      expect(status.configuration.outputFormat).toBe('json');
    });

    it('should track graph loading state', async () => {
      let status = adapter.getStatus();
      expect(status.adapter.graphLoaded).toBe(false);

      await adapter.loadGraph(sampleGraphPath);

      status = adapter.getStatus();
      expect(status.adapter.graphLoaded).toBe(true);
      expect(status.store.tripleCount).toBeGreaterThan(0);
    });
  });
});

describe('QueryTemplateLibrary', () => {
  let library;

  beforeEach(() => {
    library = new QueryTemplateLibrary();
  });

  describe('Template Management', () => {
    it('should provide list of available templates', () => {
      const templateNames = library.getTemplateNames();
      
      expect(Array.isArray(templateNames)).toBe(true);
      expect(templateNames.length).toBeGreaterThan(0);
      expect(templateNames).toContain('subject-artifacts');
      expect(templateNames).toContain('template-info');
      expect(templateNames).toContain('direct-dependencies');
    });

    it('should retrieve template by name', () => {
      const template = library.getTemplate('template-info');
      
      expect(template).toBeDefined();
      expect(typeof template).toBe('string');
      expect(template).toContain('SELECT');
      expect(template).toContain('{{templateUri}}');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        library.getTemplate('non-existent-template');
      }).toThrow("Query template 'non-existent-template' not found");
    });
  });

  describe('Template Execution', () => {
    it('should execute template with parameters', () => {
      const query = library.executeTemplate('template-info', {
        templateUri: 'http://example.com/template'
      });
      
      expect(query).toBeDefined();
      expect(query).toContain('http://example.com/template');
      expect(query).not.toContain('{{templateUri}}');
    });

    it('should throw error for missing required parameters', () => {
      expect(() => {
        library.executeTemplate('template-info', {});
      }).toThrow('Unsubstituted parameters: {{templateUri}}');
    });

    it('should substitute multiple parameters', () => {
      const query = library.executeTemplate('transitive-dependencies', {
        artifactUri: 'http://example.com/artifact',
        maxDepth: '5'
      });
      
      expect(query).toContain('http://example.com/artifact');
      expect(query).toContain('5');
      expect(query).not.toContain('{{artifactUri}}');
      expect(query).not.toContain('{{maxDepth}}');
    });
  });

  describe('Parameter Validation', () => {
    it('should provide parameter information for template', () => {
      const params = library.getTemplateParameters('template-info');
      
      expect(params).toBeDefined();
      expect(params.templateUri).toBeDefined();
      expect(params.templateUri.type).toBe('uri');
      expect(params.templateUri.required).toBe(true);
    });

    it('should validate required parameters', () => {
      const validation = library.validateParameters('template-info', {});
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Required parameter 'templateUri' is missing");
    });

    it('should validate parameter types', () => {
      const validation = library.validateParameters('transitive-dependencies', {
        artifactUri: 'http://example.com/artifact',
        maxDepth: 'not-a-number'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Parameter 'maxDepth' must be an integer");
    });

    it('should validate URI parameters', () => {
      const validation = library.validateParameters('template-info', {
        templateUri: 'not-a-uri'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain("Parameter 'templateUri' should be a valid URI");
    });

    it('should pass validation with valid parameters', () => {
      const validation = library.validateParameters('template-info', {
        templateUri: 'http://example.com/template'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });
});