/**
 * Test suite for Semantic Processor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticProcessor } from '../../src/kgen/semantic/processor.js';

describe('SemanticProcessor', () => {
  let processor;
  
  beforeEach(async () => {
    processor = new SemanticProcessor({
      reasoningEngine: 'n3',
      enableOWLReasoning: true,
      enableSHACLValidation: true,
      maxTriples: 1000000,
      reasoningTimeout: 30000
    });
    
    await processor.initialize();
  });
  
  afterEach(async () => {
    await processor.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(processor.getStatus().state).toBe('ready');
      expect(processor.getStatus().configuration.enableOWLReasoning).toBe(true);
    });

    it('should load core ontologies', () => {
      const status = processor.getStatus();
      expect(status.ontologiesCached).toBeGreaterThan(0);
    });

    it('should load inference rules', () => {
      const status = processor.getStatus();
      expect(status.inferenceRules).toBeGreaterThan(0);
    });
  });

  describe('Ontology Loading', () => {
    it('should load ontology from string content', async () => {
      const testOntology = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        
        ex:Person a owl:Class .
        ex:Employee rdfs:subClassOf ex:Person .
        ex:name a owl:DatatypeProperty .
      `;
      
      const metadata = await processor.loadOntology({
        id: 'test-ontology',
        type: 'string',
        content: testOntology,
        format: 'turtle'
      });
      
      expect(metadata.id).toBe('test-ontology');
      expect(metadata.classes).toBeDefined();
      expect(metadata.properties).toBeDefined();
    });

    it('should handle invalid ontology gracefully', async () => {
      const invalidOntology = 'invalid turtle content';
      
      await expect(processor.loadOntology({
        id: 'invalid-ontology',
        type: 'string',
        content: invalidOntology,
        format: 'turtle'
      })).rejects.toThrow();
    });
  });

  describe('Semantic Reasoning', () => {
    it('should perform basic RDFS reasoning', async () => {
      const graph = {
        triples: [
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Employee'
          },
          {
            subject: 'http://example.org/Employee',
            predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
            object: 'http://example.org/Person'
          }
        ]
      };

      const rules = [
        {
          type: 'rdfs',
          rule: '{ ?x a ?subClass . ?subClass rdfs:subClassOf ?superClass } => { ?x a ?superClass }',
          description: 'Class membership inference',
          priority: 1
        }
      ];

      const inferredGraph = await processor.performReasoning(graph, rules);
      
      expect(inferredGraph.inferredTriples).toBeDefined();
      expect(inferredGraph.reasoningContext).toBeDefined();
      expect(inferredGraph.reasoningContext.reasoningTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle reasoning timeout', async () => {
      const processor = new SemanticProcessor({
        reasoningTimeout: 1 // Very short timeout
      });
      await processor.initialize();

      const graph = { triples: [] };
      const rules = [];

      const result = await processor.performReasoning(graph, rules);
      expect(result).toBeDefined();
      
      await processor.shutdown();
    });
  });

  describe('Semantic Validation', () => {
    it('should validate knowledge graph successfully', async () => {
      const graph = {
        triples: [
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Person'
          }
        ]
      };

      const constraints = [
        {
          id: 'person-has-name',
          type: 'shacl',
          targetClass: 'http://example.org/Person',
          property: 'http://example.org/name',
          minCount: 1
        }
      ];

      const validationReport = await processor.validateGraph(graph, constraints);
      
      expect(validationReport.isValid).toBeDefined();
      expect(validationReport.violations).toBeDefined();
      expect(validationReport.warnings).toBeDefined();
      expect(validationReport.statistics).toBeDefined();
    });

    it('should detect consistency violations', async () => {
      const graph = {
        triples: [
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Person'
          },
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Robot'
          },
          {
            subject: 'http://example.org/Person',
            predicate: 'http://www.w3.org/2002/07/owl#disjointWith',
            object: 'http://example.org/Robot'
          }
        ]
      };

      const constraints = [];
      
      const validationReport = await processor.validateGraph(graph, constraints, {
        consistencyChecks: true
      });
      
      expect(validationReport.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Semantic Entity Extraction', () => {
    it('should extract semantic entities from graph', async () => {
      const graph = {
        triples: [
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Person'
          },
          {
            subject: 'http://example.org/john',
            predicate: 'http://www.w3.org/2000/01/rdf-schema#label',
            object: 'John Doe'
          },
          {
            subject: 'http://example.org/mary',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://example.org/Person'
          }
        ]
      };

      const enrichedContext = await processor.enrichGenerationContext(graph);
      
      expect(enrichedContext.entities).toBeDefined();
      expect(enrichedContext.relationships).toBeDefined();
      expect(enrichedContext.patterns).toBeDefined();
    });

    it('should calculate semantic similarity between entities', async () => {
      const entity1 = {
        uri: 'http://example.org/john',
        types: ['http://example.org/Person', 'http://example.org/Employee'],
        labels: ['John Doe'],
        descriptions: ['Software Engineer'],
        properties: new Map([
          ['http://example.org/age', ['30']],
          ['http://example.org/department', ['Engineering']]
        ])
      };

      const entity2 = {
        uri: 'http://example.org/jane',
        types: ['http://example.org/Person', 'http://example.org/Employee'],
        labels: ['Jane Smith'],
        descriptions: ['Senior Developer'],
        properties: new Map([
          ['http://example.org/age', ['28']],
          ['http://example.org/department', ['Engineering']]
        ])
      });

      const similarity = await processor._calculateSemanticSimilarity(entity1, entity2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Ontology Alignment', () => {
    it('should align multiple schemas', async () => {
      // Load two test ontologies
      const ontology1 = {
        id: 'schema1',
        type: 'string',
        content: `
          @prefix s1: <http://schema1.org/> .
          @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
          s1:Person a rdfs:Class .
          s1:name a rdfs:Property .
        `,
        format: 'turtle'
      };

      const ontology2 = {
        id: 'schema2',
        type: 'string',
        content: `
          @prefix s2: <http://schema2.org/> .
          @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
          s2:Individual a rdfs:Class .
          s2:fullName a rdfs:Property .
        `,
        format: 'turtle'
      };

      await processor.loadOntology(ontology1);
      await processor.loadOntology(ontology2);

      const alignmentMap = await processor.alignSchemas(['schema1', 'schema2']);
      
      expect(alignmentMap.mappings).toBeDefined();
      expect(alignmentMap.conflicts).toBeDefined();
      expect(alignmentMap.equivalences).toBeDefined();
      expect(alignmentMap.hierarchies).toBeDefined();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large knowledge graphs efficiently', async () => {
      const largeGraph = {
        triples: []
      };

      // Generate a reasonably large graph
      for (let i = 0; i < 1000; i++) {
        largeGraph.triples.push({
          subject: `http://example.org/entity${i}`,
          predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          object: 'http://example.org/Thing'
        });
      }

      const startTime = this.getDeterministicTimestamp();
      const enrichedContext = await processor.enrichGenerationContext(largeGraph);
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      expect(enrichedContext).toBeDefined();
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should report memory usage correctly', () => {
      const status = processor.getStatus();
      expect(status.memoryUsage).toBeDefined();
      expect(status.memoryUsage.store).toBeDefined();
      expect(status.memoryUsage.ontologyCache).toBeDefined();
      expect(status.memoryUsage.reasoningCache).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed RDF gracefully', async () => {
      const malformedGraph = {
        triples: [
          {
            // Missing required fields
            predicate: 'http://example.org/someProperty'
          }
        ]
      };

      await expect(processor.enrichGenerationContext(malformedGraph))
        .resolves.toBeDefined();
    });

    it('should handle network errors when loading from URL', async () => {
      await expect(processor.loadOntology({
        id: 'unreachable',
        type: 'url',
        uri: 'http://unreachable.example.com/ontology.ttl'
      })).rejects.toThrow();
    });
  });

  describe('Text Similarity Calculation', () => {
    it('should calculate text similarity correctly', () => {
      const texts1 = ['software engineer', 'developer'];
      const texts2 = ['software developer', 'programmer'];
      
      const similarity = processor._calculateTextSimilarity(texts1, texts2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle empty text arrays', () => {
      expect(processor._calculateTextSimilarity([], [])).toBe(1.0);
      expect(processor._calculateTextSimilarity(['test'], [])).toBe(0.0);
      expect(processor._calculateTextSimilarity([], ['test'])).toBe(0.0);
    });
  });

  describe('Set Similarity Calculation', () => {
    it('should calculate set similarity correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);
      
      const similarity = processor._calculateSetSimilarity(set1, set2);
      
      expect(similarity).toBe(0.5); // 2 intersection / 4 union
    });

    it('should handle identical sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);
      
      const similarity = processor._calculateSetSimilarity(set1, set2);
      
      expect(similarity).toBe(1.0);
    });
  });
});