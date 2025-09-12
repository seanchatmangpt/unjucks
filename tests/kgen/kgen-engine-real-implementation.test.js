/**
 * KGEN Engine Real Implementation Test
 * 
 * This test validates the real artifact generation engine implementation
 * replacing placeholder code with deterministic RDF-to-artifact compilation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleKGenEngine } from '../../packages/kgen-core/src/kgen/core/simple-engine.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

describe('KGEN Real Engine Implementation', () => {
  let engine;
  let testDir;
  let sampleRDF;
  let sampleTemplate;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), 'test-artifacts', `test-${Date.now()}`);
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, 'templates'));
    
    // Initialize KGEN engine
    engine = new SimpleKGenEngine({
      mode: 'test',
      templatesDir: path.join(testDir, 'templates'),
      cacheDirectory: path.join(testDir, '.kgen/cache'),
      stateDirectory: path.join(testDir, '.kgen/state'),
      enableAuditTrail: true
    });
    
    await engine.initialize();
    
    // Create sample RDF data
    sampleRDF = `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:person1 a ex:Person ;
                 ex:hasName "John Doe" ;
                 ex:hasAge "30"^^xsd:integer ;
                 ex:worksFor ex:company1 .
      
      ex:person2 a ex:Person ;
                 ex:hasName "Jane Smith" ;
                 ex:hasAge "28"^^xsd:integer ;
                 ex:worksFor ex:company1 .
      
      ex:company1 a ex:Organization ;
                  ex:hasName "Tech Corp" ;
                  ex:hasEmployees "50"^^xsd:integer .
    `;
    
    // Create sample template
    sampleTemplate = `
/**
 * Generated from Knowledge Graph
 * Generated at: {{ metadata.generatedAt }}
 */

{% for entity in entities %}
{% if entity.type == 'Person' %}
class {{ entity.properties.hasName | replace(' ', '') }} {
  constructor() {
    this.id = "{{ entity.id }}";
    this.name = "{{ entity.properties.hasName }}";
    this.age = {{ entity.properties.hasAge }};
  }
  
  getName() {
    return this.name;
  }
  
  getAge() {
    return this.age;
  }
}

{% endif %}
{% endfor %}

module.exports = {
  {% for entity in entities %}
  {% if entity.type == 'Person' %}
  {{ entity.properties.hasName | replace(' ', '') }},
  {% endif %}
  {% endfor %}
};
    `.trim();
    
    // Write template to file
    await fs.writeFile(path.join(testDir, 'templates', 'person-class.njk'), sampleTemplate);
  });
  
  afterEach(async () => {
    if (engine && engine.state !== 'shutdown') {
      await engine.shutdown();
    }
    
    // Clean up test directory
    await fs.remove(testDir);
  });

  describe('RDF Ingestion and Processing', () => {
    it('should ingest RDF data and extract entities deterministically', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      
      const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      expect(knowledgeGraph).toBeDefined();
      expect(knowledgeGraph.entities).toHaveLength(3); // 2 persons + 1 organization
      expect(knowledgeGraph.triples.length).toBeGreaterThan(0);
      
      // Verify entities were extracted correctly
      const persons = knowledgeGraph.entities.filter(e => e.type === 'Person');
      expect(persons).toHaveLength(2);
      
      const johnDoe = persons.find(p => p.properties.hasName === 'John Doe');
      expect(johnDoe).toBeDefined();
      expect(johnDoe.properties.hasAge).toBe(30);
      
      const janeSmith = persons.find(p => p.properties.hasName === 'Jane Smith');
      expect(janeSmith).toBeDefined();
      expect(janeSmith.properties.hasAge).toBe(28);
    });

    it('should produce identical results for identical inputs', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      
      const result1 = await engine.ingest(sources, { user: 'test-user' });
      const result2 = await engine.ingest(sources, { user: 'test-user' });
      
      // Results should be deterministic (ignoring metadata timestamps)
      expect(result1.entities).toEqual(result2.entities);
      expect(result1.relationships).toEqual(result2.relationships);
      expect(result1.triples).toEqual(result2.triples);
    });

    it('should calculate checksums for data integrity', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      
      const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      // Every entity should have a checksum
      knowledgeGraph.entities.forEach(entity => {
        expect(entity.checksum).toBeDefined();
        expect(typeof entity.checksum).toBe('string');
        expect(entity.checksum.length).toBeGreaterThan(0);
      });
      
      // Every triple should have a checksum
      knowledgeGraph.triples.forEach(triple => {
        expect(triple.checksum).toBeDefined();
        expect(typeof triple.checksum).toBe('string');
      });
    });
  });

  describe('Real Template Processing', () => {
    let knowledgeGraph;
    
    beforeEach(async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should process templates with SPARQL-extracted context', async () => {
      const templates = [{
        id: 'person-class',
        type: 'code',
        language: 'javascript',
        template: sampleTemplate
      }];
      
      const artifacts = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      
      expect(artifacts).toBeDefined();
      expect(artifacts).toHaveLength(1);
      
      const artifact = artifacts[0];
      expect(artifact.id).toBe('person-class-' + artifact.hash.substring(0, 8));
      expect(artifact.templateId).toBe('person-class');
      expect(artifact.content).toBeDefined();
      expect(artifact.hash).toBeDefined();
      expect(artifact.size).toBe(artifact.content.length);
    });

    it('should generate byte-for-byte identical artifacts for identical inputs', async () => {
      const templates = [{
        id: 'person-class',
        type: 'code',
        language: 'javascript',
        template: sampleTemplate
      }];
      
      const artifacts1 = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const artifacts2 = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      
      expect(artifacts1).toHaveLength(1);
      expect(artifacts2).toHaveLength(1);
      
      // Content should be byte-for-byte identical (excluding timestamps)
      const content1 = artifacts1[0].content.replace(/Generated at:.*\n/, 'Generated at: [TIMESTAMP]\n');
      const content2 = artifacts2[0].content.replace(/Generated at:.*\n/, 'Generated at: [TIMESTAMP]\n');
      expect(content1).toBe(content2);
      
      // Hashes should be different due to timestamps, but normalized content should be identical
      expect(artifacts1[0].hash).toBeDefined();
      expect(artifacts2[0].hash).toBeDefined();
    });

    it('should render templates with semantic context from RDF', async () => {
      const templates = [{
        id: 'person-class',
        type: 'code',
        language: 'javascript',
        template: sampleTemplate
      }];
      
      const artifacts = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const content = artifacts[0].content;
      
      // Verify that RDF entities were properly injected into template
      expect(content).toContain('class JohnDoe {');
      expect(content).toContain('class JaneSmith {');
      expect(content).toContain('this.name = "John Doe"');
      expect(content).toContain('this.age = 30');
      expect(content).toContain('getName()');
      expect(content).toContain('getAge()');
      
      // Verify module exports
      expect(content).toContain('module.exports');
      expect(content).toContain('JohnDoe,');
      expect(content).toContain('JaneSmith,');
    });

    it('should store artifacts in content-addressable cache', async () => {
      const templates = [{
        id: 'test-template',
        type: 'code',
        language: 'javascript',
        template: 'const test = "{{ entities.length }} entities";'
      }];
      
      const artifacts = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const artifact = artifacts[0];
      
      // Artifact should be cached by content hash
      expect(engine.contentCache.has(artifact.hash)).toBe(true);
      expect(engine.artifactHashes.has('test-template')).toBe(true);
      
      const cachedArtifact = engine.contentCache.get(artifact.hash);
      expect(cachedArtifact).toEqual(artifact);
    });
  });

  describe('Attestation Generation', () => {
    let knowledgeGraph, artifact, template;
    
    beforeEach(async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      template = {
        id: 'test-template',
        type: 'code',
        language: 'javascript',
        template: 'const entities = {{ entities.length }};'
      };
      
      const artifacts = await engine.generate(knowledgeGraph, [template], { user: 'test-user' });
      artifact = artifacts[0];
    });

    it('should generate complete .attest.json provenance sidecars', async () => {
      const attestation = engine.generateAttestation(artifact, knowledgeGraph, template);
      
      expect(attestation).toBeDefined();
      expect(attestation.artifact).toBeDefined();
      expect(attestation.source).toBeDefined();
      expect(attestation.generation).toBeDefined();
      expect(attestation.provenance).toBeDefined();
      expect(attestation.integrity).toBeDefined();
      
      // Verify artifact information
      expect(attestation.artifact.id).toBe(artifact.id);
      expect(attestation.artifact.hash).toBe(artifact.hash);
      expect(attestation.artifact.size).toBe(artifact.size);
      
      // Verify source information
      expect(attestation.source.knowledgeGraph.id).toBe(knowledgeGraph.id);
      expect(attestation.source.template.id).toBe(template.id);
      
      // Verify generation metadata
      expect(attestation.generation.engine).toBe('kgen');
      expect(attestation.generation.version).toBe('1.0.0');
      expect(attestation.generation.method).toBe('deterministic-compilation');
      expect(attestation.generation.reproducible).toBe(true);
      
      // Verify integrity checksums
      expect(attestation.integrity.checksums.sha256).toBe(artifact.hash);
      expect(attestation.integrity.verified).toBe(true);
    });

    it('should include provenance tracking information', async () => {
      const attestation = engine.generateAttestation(artifact, knowledgeGraph, template);
      
      expect(attestation.provenance).toBeDefined();
      expect(attestation.provenance.dependencies).toBeDefined();
      expect(Array.isArray(attestation.provenance.dependencies)).toBe(true);
      
      // Should track template variables used
      if (attestation.provenance.variables) {
        expect(Array.isArray(attestation.provenance.variables)).toBe(true);
      }
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate knowledge graphs', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      const validationReport = await engine.validate(knowledgeGraph, [], { user: 'test-user' });
      
      expect(validationReport).toBeDefined();
      expect(validationReport.isValid).toBeDefined();
      expect(validationReport.violations).toBeDefined();
      expect(validationReport.summary).toBeDefined();
      
      expect(Array.isArray(validationReport.violations)).toBe(true);
      expect(validationReport.summary.totalEntities).toBe(knowledgeGraph.entities.length);
    });

    it('should handle template processing errors gracefully', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      const invalidTemplate = [{
        id: 'invalid-template',
        type: 'code',
        language: 'javascript',
        template: '{{ invalid.undefined.property }}'
      }];
      
      await expect(engine.generate(knowledgeGraph, invalidTemplate, { user: 'test-user' }))
        .rejects.toThrow(/Template processing failed/);
    });

    it('should require user context for operations', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      
      await expect(engine.ingest(sources, {}))
        .rejects.toThrow(/Authorization required/);
    });
  });

  describe('SPARQL Query Integration', () => {
    let knowledgeGraph;
    
    beforeEach(async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should execute SPARQL queries against knowledge graph', async () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
        }
      `;
      
      const result = await engine.query(query, { user: 'test-user' });
      
      expect(result).toBeDefined();
      expect(result.bindings).toBeDefined();
      expect(Array.isArray(result.bindings)).toBe(true);
    });
  });

  describe('Performance and Determinism', () => {
    it('should maintain consistent performance characteristics', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      
      const times = [];
      const iterations = 3;
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await engine.ingest(sources, { user: 'test-user' });
        times.push(Date.now() - start);
      }
      
      // Performance should be relatively consistent
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      
      // Should not vary by more than 50% from average (reasonable for test environment)
      expect(maxDeviation / avgTime).toBeLessThan(0.5);
    });

    it('should produce deterministic content hashes', async () => {
      const sources = [{
        type: 'rdf',
        content: sampleRDF,
        format: 'turtle'
      }];
      const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
      
      const template = {
        id: 'hash-test',
        type: 'code',
        language: 'javascript',
        template: 'const count = {{ entities.length }};'
      };
      
      const hashes = [];
      for (let i = 0; i < 3; i++) {
        const artifacts = await engine.generate(knowledgeGraph, [template], { user: 'test-user' });
        hashes.push(crypto.createHash('sha256').update(artifacts[0].content).digest('hex'));
      }
      
      // All hashes should be identical for deterministic content
      expect(hashes[0]).toBe(hashes[1]);
      expect(hashes[1]).toBe(hashes[2]);
    });
  });
});