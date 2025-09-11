/**
 * KGEN Determinism Integration Tests
 * Ensures byte-for-byte identical outputs for identical inputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KGenEngine } from '../../src/kgen/core/engine.js';
import { TestHelpers } from '../utils/test-helpers.js';
import crypto from 'crypto';

describe('KGEN Determinism Validation', () => {
  let engines;
  let testHelpers;

  beforeEach(async () => {
    testHelpers = new TestHelpers();
    engines = [];
  });

  afterEach(async () => {
    // Cleanup all engines
    for (const engine of engines) {
      if (engine && engine.state !== 'shutdown') {
        await engine.shutdown();
      }
    }
    engines = [];
    await testHelpers.cleanup();
  });

  async function createEngine(config = {}) {
    const engine = new KGenEngine({
      mode: 'test',
      enableDistributedReasoning: false, // Ensure deterministic behavior
      enableAuditTrail: true,
      ...config
    });
    
    await engine.initialize();
    engines.push(engine);
    return engine;
  }

  describe('Input Processing Determinism', () => {
    it('should produce identical results for identical RDF inputs', async () => {
      const engine1 = await createEngine();
      const engine2 = await createEngine();

      const rdfContent = testHelpers.createComplexRDFGraph();
      const sources = [{ type: 'rdf', content: rdfContent, format: 'turtle' }];

      const result1 = await engine1.ingest(sources, { user: 'test-user' });
      const result2 = await engine2.ingest(sources, { user: 'test-user' });

      // Results should be byte-for-byte identical
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
      
      // Verify specific properties
      expect(result1.entities).toEqual(result2.entities);
      expect(result1.relationships).toEqual(result2.relationships);
      expect(result1.triples).toEqual(result2.triples);
    });

    it('should maintain determinism across multiple runs', async () => {
      const engine = await createEngine();
      const rdfContent = testHelpers.createSampleRDF('person', 'John Doe');
      const sources = [{ type: 'rdf', content: rdfContent, format: 'turtle' }];

      const results = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const result = await engine.ingest(sources, { user: 'test-user' });
        results.push(result);
      }

      // All results should be identical
      const firstResult = JSON.stringify(results[0]);
      for (let i = 1; i < iterations; i++) {
        expect(JSON.stringify(results[i])).toBe(firstResult);
      }
    });

    it('should produce deterministic hashes for identical content', async () => {
      const content1 = testHelpers.createSampleRDF('person', 'Alice Smith');
      const content2 = testHelpers.createSampleRDF('person', 'Alice Smith');

      const hash1 = testHelpers.calculateHash(content1);
      const hash2 = testHelpers.calculateHash(content2);

      expect(hash1).toBe(hash2);
    });

    it('should handle ordering independence', async () => {
      const engine = await createEngine();

      // Create RDF with same content but different order
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:person1 a ex:Person ;
                   ex:hasName "John Doe" ;
                   ex:hasAge "30"^^xsd:integer .
        ex:person2 a ex:Person ;
                   ex:hasName "Jane Doe" ;
                   ex:hasAge "28"^^xsd:integer .
      `;

      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:person2 a ex:Person ;
                   ex:hasAge "28"^^xsd:integer ;
                   ex:hasName "Jane Doe" .
        ex:person1 a ex:Person ;
                   ex:hasAge "30"^^xsd:integer ;
                   ex:hasName "John Doe" .
      `;

      const result1 = await engine.ingest([{ type: 'rdf', content: rdf1, format: 'turtle' }], { user: 'test-user' });
      const result2 = await engine.ingest([{ type: 'rdf', content: rdf2, format: 'turtle' }], { user: 'test-user' });

      // Normalize results by sorting
      const normalize = (result) => ({
        ...result,
        entities: result.entities.sort((a, b) => a.id.localeCompare(b.id)),
        triples: result.triples.sort((a, b) => `${a.subject}${a.predicate}${a.object}`.localeCompare(`${b.subject}${b.predicate}${b.object}`))
      });

      expect(normalize(result1)).toEqual(normalize(result2));
    });
  });

  describe('Reasoning Determinism', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should produce deterministic reasoning results', async () => {
      const engine1 = await createEngine();
      const engine2 = await createEngine();

      const rules = [
        {
          name: 'employee-classification',
          condition: '?person ex:worksFor ?org',
          conclusion: '?person a ex:Employee'
        },
        {
          name: 'manager-classification',
          condition: '?person ex:manages ?project',
          conclusion: '?person a ex:Manager'
        }
      ];

      const result1 = await engine1.reason(knowledgeGraph, rules, { user: 'test-user' });
      const result2 = await engine2.reason(knowledgeGraph, rules, { user: 'test-user' });

      // Results should be identical
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should maintain inference consistency', async () => {
      const engine = await createEngine();
      const rules = [
        {
          name: 'transitivity-rule',
          condition: '?a ex:manages ?b . ?b ex:manages ?c',
          conclusion: '?a ex:indirectlyManages ?c'
        }
      ];

      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.reason(knowledgeGraph, rules, { user: 'test-user' });
        results.push(result);
      }

      // All reasoning results should be identical
      const firstResult = JSON.stringify(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toBe(firstResult);
      }
    });
  });

  describe('Generation Determinism', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Developer'),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should generate byte-identical code artifacts', async () => {
      const engine1 = await createEngine();
      const engine2 = await createEngine();

      const templates = [
        {
          id: 'person-class',
          type: 'class',
          language: 'javascript',
          template: testHelpers.getPersonClassTemplate()
        }
      ];

      const result1 = await engine1.generate(knowledgeGraph, templates, { user: 'test-user' });
      const result2 = await engine2.generate(knowledgeGraph, templates, { user: 'test-user' });

      // Generated artifacts should be byte-for-byte identical
      expect(result1.length).toBe(result2.length);
      
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].content).toBe(result2[i].content);
        expect(result1[i].type).toBe(result2[i].type);
        expect(result1[i].templateId).toBe(result2[i].templateId);
      }
    });

    it('should produce deterministic file hashes', async () => {
      const engine = await createEngine();
      const templates = [
        {
          id: 'api-endpoints',
          type: 'api',
          language: 'javascript',
          template: testHelpers.getAPIEndpointTemplate()
        }
      ];

      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
        const hash = crypto.createHash('sha256').update(result[0].content).digest('hex');
        results.push(hash);
      }

      // All hashes should be identical
      const firstHash = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(firstHash);
      }
    });

    it('should handle template variable substitution deterministically', async () => {
      const engine = await createEngine();
      
      // Template with complex variable substitution
      const template = {
        id: 'complex-template',
        type: 'class',
        language: 'javascript',
        template: `
          // Generated at: {{ metadata.generatedAt }}
          // Entity: {{ entity.id }}
          // Properties: {{ entity.properties | keys | sort | join(', ') }}
          
          class {{ entity.name | capitalize | replace(' ', '') }} {
            {% for prop in entity.properties | keys | sort %}
            get{{ prop | capitalize }}() { return this.{{ prop }}; }
            {% endfor %}
          }
        `
      };

      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await engine.generate(knowledgeGraph, [template], { user: 'test-user' });
        results.push(result[0].content);
      }

      // All generated content should be identical (excluding timestamps)
      const normalizeContent = (content) => {
        return content.replace(/Generated at: .*\n/, 'Generated at: [TIMESTAMP]\n');
      };

      const firstNormalized = normalizeContent(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(normalizeContent(results[i])).toBe(firstNormalized);
      }
    });
  });

  describe('Query Determinism', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should return identical query results', async () => {
      const engine1 = await createEngine();
      const engine2 = await createEngine();

      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name ?org WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
          ?person ex:worksFor ?org .
        }
        ORDER BY ?name
      `;

      const result1 = await engine1.query(query, { user: 'test-user' });
      const result2 = await engine2.query(query, { user: 'test-user' });

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should maintain query result ordering', async () => {
      const engine = await createEngine();

      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?entity ?type WHERE {
          ?entity a ?type .
        }
        ORDER BY ?entity ?type
      `;

      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.query(query, { user: 'test-user' });
        results.push(result);
      }

      // All results should maintain identical ordering
      const firstResult = JSON.stringify(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toBe(firstResult);
      }
    });
  });

  describe('Cross-Session Determinism', () => {
    it('should maintain determinism across engine restarts', async () => {
      const rdfContent = testHelpers.createSampleRDF('organization', 'Tech Corp');
      const sources = [{ type: 'rdf', content: rdfContent, format: 'turtle' }];

      // First session
      const engine1 = await createEngine();
      const result1 = await engine1.ingest(sources, { user: 'test-user' });
      await engine1.shutdown();

      // Second session
      const engine2 = await createEngine();
      const result2 = await engine2.ingest(sources, { user: 'test-user' });
      await engine2.shutdown();

      // Results should be identical across sessions
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should handle concurrent engines deterministically', async () => {
      const rdfContent = testHelpers.createComplexRDFGraph();
      const sources = [{ type: 'rdf', content: rdfContent, format: 'turtle' }];

      // Create multiple concurrent engines
      const enginePromises = Array.from({ length: 3 }, () => createEngine());
      const engines = await Promise.all(enginePromises);

      // Perform concurrent ingestion
      const ingestionPromises = engines.map(engine => 
        engine.ingest(sources, { user: 'test-user' })
      );
      const results = await Promise.all(ingestionPromises);

      // All results should be identical
      const firstResult = JSON.stringify(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toBe(firstResult);
      }
    });
  });

  describe('Data Integrity Verification', () => {
    it('should maintain checksum consistency', async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Data Scientist'),
          format: 'turtle'
        }
      ];

      const result = await engine.ingest(sources, { user: 'test-user' });
      
      // Verify checksums for all entities
      result.entities.forEach(entity => {
        const calculatedChecksum = testHelpers.calculateHash({
          id: entity.id,
          type: entity.type,
          properties: entity.properties
        });
        expect(entity.checksum).toBe(calculatedChecksum);
      });

      // Verify checksums for all triples
      result.triples.forEach(triple => {
        const calculatedChecksum = testHelpers.calculateHash({
          subject: triple.subject,
          predicate: triple.predicate,
          object: triple.object,
          graph_context: triple.graph_context
        });
        expect(triple.checksum).toBe(calculatedChecksum);
      });
    });

    it('should detect data corruption', async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('project', 'Test Project'),
          format: 'turtle'
        }
      ];

      const result = await engine.ingest(sources, { user: 'test-user' });
      
      // Simulate data corruption
      if (result.entities.length > 0) {
        result.entities[0].properties.name = 'Corrupted Name';
        
        // Recalculate checksum with corrupted data
        const corruptedChecksum = testHelpers.calculateHash({
          id: result.entities[0].id,
          type: result.entities[0].type,
          properties: result.entities[0].properties
        });
        
        // Original checksum should not match corrupted data
        expect(result.entities[0].checksum).not.toBe(corruptedChecksum);
      }
    });
  });

  describe('Performance Determinism', () => {
    it('should show consistent performance characteristics', async () => {
      const engine = await createEngine();
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];

      const operation = () => engine.ingest(sources, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.failedIterations).toBe(0);
      
      // Performance should be relatively consistent (coefficient of variation < 0.5)
      const cv = perfStats.standardDeviation / perfStats.averageDuration;
      expect(cv).toBeLessThan(0.5);
    });

    it('should scale deterministically', async () => {
      const engine = await createEngine();
      const baseRDF = testHelpers.createSampleRDF('person', 'Test User');
      
      // Test with different input sizes
      const sizes = [1, 5, 10];
      const results = [];

      for (const size of sizes) {
        const sources = Array.from({ length: size }, (_, i) => ({
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', `User ${i + 1}`),
          format: 'turtle'
        }));

        const operation = () => engine.ingest(sources, { user: 'test-user' });
        const perfStats = await testHelpers.measurePerformance(operation, 3);
        
        results.push({
          size,
          averageDuration: perfStats.averageDuration,
          averageMemory: perfStats.averageMemoryUsage
        });
      }

      // Performance should scale predictably
      expect(results[1].averageDuration).toBeGreaterThan(results[0].averageDuration);
      expect(results[2].averageDuration).toBeGreaterThan(results[1].averageDuration);
    });
  });
});