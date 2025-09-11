/**
 * KGEN Core Engine Unit Tests
 * Comprehensive testing focused on determinism and correctness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KGenEngine } from '../../../src/kgen/core/engine.js';
import { TestHelpers } from '../../utils/test-helpers.js';

describe('KGenEngine Core Functionality', () => {
  let engine;
  let testHelpers;

  beforeEach(async () => {
    testHelpers = new TestHelpers();
    engine = new KGenEngine({
      mode: 'test',
      maxConcurrentOperations: 5,
      enableDistributedReasoning: false, // Disable for deterministic tests
      enableAuditTrail: true
    });
    
    await engine.initialize();
  });

  afterEach(async () => {
    if (engine && engine.state !== 'shutdown') {
      await engine.shutdown();
    }
    await testHelpers.cleanup();
  });

  describe('Engine Initialization', () => {
    it('should initialize with correct state and version', async () => {
      expect(engine.state).toBe('ready');
      expect(engine.getVersion()).toBe('1.0.0');
      
      const status = engine.getStatus();
      expect(status.state).toBe('ready');
      expect(status.activeOperations).toBe(0);
      expect(status.queuedOperations).toBe(0);
    });

    it('should initialize all required components', async () => {
      const status = engine.getStatus();
      
      expect(status.components).toHaveProperty('semanticProcessor');
      expect(status.components).toHaveProperty('ingestionPipeline');
      expect(status.components).toHaveProperty('provenanceTracker');
      expect(status.components).toHaveProperty('securityManager');
      expect(status.components).toHaveProperty('queryEngine');
    });

    it('should emit engine:ready event on successful initialization', async () => {
      const newEngine = new KGenEngine({ mode: 'test' });
      
      let eventEmitted = false;
      newEngine.on('engine:ready', () => {
        eventEmitted = true;
      });
      
      await newEngine.initialize();
      expect(eventEmitted).toBe(true);
      
      await newEngine.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      const faultyEngine = new KGenEngine({
        mode: 'test',
        semantic: { forceError: true } // Simulate initialization error
      });
      
      let errorEmitted = false;
      faultyEngine.on('engine:error', () => {
        errorEmitted = true;
      });
      
      await expect(faultyEngine.initialize()).rejects.toThrow();
      expect(faultyEngine.state).toBe('error');
      expect(errorEmitted).toBe(true);
    });
  });

  describe('Data Ingestion', () => {
    it('should ingest data deterministically', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];

      const result1 = await engine.ingest(sources, { user: 'test-user' });
      const result2 = await engine.ingest(sources, { user: 'test-user' });

      // Results should be deterministic
      expect(result1).toEqual(result2);
      expect(result1.entities).toBeDefined();
      expect(result1.relationships).toBeDefined();
      expect(result1.triples).toBeDefined();
    });

    it('should validate ingested data integrity', async () => {
      const sources = [
        {
          type: 'rdf',
          content: `
            @prefix ex: <http://example.org/> .
            ex:person1 a ex:Person ;
                       ex:hasName "John Doe" ;
                       ex:hasAge 30 .
          `,
          format: 'turtle'
        }
      ];

      const result = await engine.ingest(sources, { user: 'test-user' });
      
      // Verify data integrity
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('Person');
      expect(result.entities[0].properties.name).toBe('John Doe');
      expect(result.entities[0].properties.age).toBe(30);
    });

    it('should track provenance for all ingestion operations', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('organization', 'ACME Corp'),
          format: 'turtle'
        }
      ];

      let ingestEvent = null;
      engine.on('ingestion:complete', (event) => {
        ingestEvent = event;
      });

      const result = await engine.ingest(sources, { user: 'test-user' });
      
      expect(ingestEvent).toBeDefined();
      expect(ingestEvent.operationId).toBeDefined();
      expect(ingestEvent.knowledgeGraph).toEqual(result);
    });

    it('should handle malformed input gracefully', async () => {
      const sources = [
        {
          type: 'rdf',
          content: 'invalid turtle content !!!',
          format: 'turtle'
        }
      ];

      await expect(engine.ingest(sources, { user: 'test-user' }))
        .rejects.toThrow();

      // Verify error was tracked
      const logs = global.testUtils.logger.getLogsByType('error');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should enforce security authorization for ingestion', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'Jane Doe'),
          format: 'turtle'
        }
      ];

      // Test without user authorization
      await expect(engine.ingest(sources, {}))
        .rejects.toThrow(); // Should fail authorization
    });
  });

  describe('Semantic Reasoning', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should perform deterministic reasoning', async () => {
      const rules = [
        {
          name: 'person-classification',
          condition: '?x a ex:Person',
          conclusion: '?x a ex:Human'
        }
      ];

      const result1 = await engine.reason(knowledgeGraph, rules, { user: 'test-user' });
      const result2 = await engine.reason(knowledgeGraph, rules, { user: 'test-user' });

      // Results should be identical
      expect(result1).toEqual(result2);
      expect(result1.inferredTriples).toBeDefined();
    });

    it('should validate reasoning results', async () => {
      const rules = [
        {
          name: 'invalid-rule',
          condition: 'malformed condition',
          conclusion: 'malformed conclusion'
        }
      ];

      await expect(engine.reason(knowledgeGraph, rules, { user: 'test-user' }))
        .rejects.toThrow();
    });

    it('should track reasoning performance metrics', async () => {
      const rules = [
        {
          name: 'simple-rule',
          condition: '?x a ex:Person',
          conclusion: '?x a ex:Human'
        }
      ];

      let reasoningEvent = null;
      engine.on('reasoning:complete', (event) => {
        reasoningEvent = event;
      });

      await engine.reason(knowledgeGraph, rules, { user: 'test-user' });
      
      expect(reasoningEvent).toBeDefined();
      expect(reasoningEvent.operationId).toBeDefined();
    });
  });

  describe('Graph Validation', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should validate graphs against SHACL constraints', async () => {
      const constraints = [
        {
          type: 'shacl',
          shape: `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ex: <http://example.org/> .
            
            ex:PersonShape a sh:NodeShape ;
                sh:targetClass ex:Person ;
                sh:property [
                    sh:path ex:hasName ;
                    sh:datatype xsd:string ;
                    sh:minCount 1 ;
                    sh:maxCount 1 ;
                ] .
          `
        }
      ];

      const validationReport = await engine.validate(knowledgeGraph, constraints, { user: 'test-user' });
      
      expect(validationReport).toBeDefined();
      expect(validationReport.isValid).toBeDefined();
      expect(validationReport.violations).toBeDefined();
    });

    it('should provide detailed violation reports', async () => {
      // Create graph with violations
      const invalidGraph = {
        ...knowledgeGraph,
        entities: [
          {
            id: 'person:invalid',
            type: 'Person',
            properties: {} // Missing required name property
          }
        ]
      };

      const constraints = [
        {
          type: 'shacl',
          shape: testHelpers.createPersonValidationShape()
        }
      ];

      const validationReport = await engine.validate(invalidGraph, constraints, { user: 'test-user' });
      
      expect(validationReport.isValid).toBe(false);
      expect(validationReport.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Code Generation', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should generate deterministic artifacts', async () => {
      const templates = [
        {
          id: 'person-class',
          type: 'class',
          language: 'javascript',
          template: testHelpers.getPersonClassTemplate()
        }
      ];

      const result1 = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const result2 = await engine.generate(knowledgeGraph, templates, { user: 'test-user' });

      // Generated artifacts should be byte-for-byte identical
      expect(result1).toEqual(result2);
      expect(result1.length).toBe(1);
      expect(result1[0].content).toBeDefined();
    });

    it('should validate generated artifacts', async () => {
      const templates = [
        {
          id: 'invalid-template',
          type: 'class',
          language: 'javascript',
          template: '{{ invalid.syntax }}'
        }
      ];

      await expect(engine.generate(knowledgeGraph, templates, { user: 'test-user' }))
        .rejects.toThrow();
    });

    it('should track generation metrics', async () => {
      const templates = [
        {
          id: 'simple-template',
          type: 'class',
          language: 'javascript',
          template: 'class {{ entity.name }} {}'
        }
      ];

      let generationEvent = null;
      engine.on('generation:complete', (event) => {
        generationEvent = event;
      });

      await engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      
      expect(generationEvent).toBeDefined();
      expect(generationEvent.operationId).toBeDefined();
      expect(generationEvent.generatedArtifacts).toBeDefined();
    });
  });

  describe('Query Engine', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should execute SPARQL queries deterministically', async () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
        }
      `;

      const result1 = await engine.query(query, { user: 'test-user' });
      const result2 = await engine.query(query, { user: 'test-user' });

      expect(result1).toEqual(result2);
      expect(result1.bindings).toBeDefined();
    });

    it('should handle malformed queries gracefully', async () => {
      const invalidQuery = 'INVALID SPARQL QUERY !!!';

      await expect(engine.query(invalidQuery, { user: 'test-user' }))
        .rejects.toThrow();
    });

    it('should enforce query authorization', async () => {
      const query = 'SELECT * WHERE { ?s ?p ?o }';

      await expect(engine.query(query, {})) // No user
        .rejects.toThrow();
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'User 1'),
          format: 'turtle'
        }
      ];

      const promises = Array.from({ length: 5 }, (_, i) => 
        engine.ingest(sources, { user: `test-user-${i}` })
      );

      const results = await Promise.all(promises);
      
      // All results should be successful
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.entities).toBeDefined();
      });
    });

    it('should respect operation limits', async () => {
      const engineWithLimits = new KGenEngine({
        mode: 'test',
        maxConcurrentOperations: 2
      });
      
      await engineWithLimits.initialize();
      
      try {
        const sources = [
          {
            type: 'rdf',
            content: testHelpers.createSampleRDF('person', 'User'),
            format: 'turtle'
          }
        ];

        // Start more operations than the limit
        const promises = Array.from({ length: 5 }, (_, i) => 
          engineWithLimits.ingest(sources, { user: `test-user-${i}` })
        );

        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
        
      } finally {
        await engineWithLimits.shutdown();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle component failures gracefully', async () => {
      // Simulate component error
      engine.semanticProcessor.emit('error', new Error('Simulated error'));
      
      let componentError = null;
      engine.on('component:error', (event) => {
        componentError = event;
      });

      // Allow error to propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(componentError).toBeDefined();
      expect(componentError.component).toBe('semantic');
      expect(componentError.error.message).toBe('Simulated error');
    });

    it('should maintain operation tracking integrity', async () => {
      const initialStatus = engine.getStatus();
      
      try {
        await engine.ingest([], { user: 'test-user' }); // Empty sources should fail
      } catch (error) {
        // Expected to fail
      }
      
      const finalStatus = engine.getStatus();
      
      // Operation count should return to initial state
      expect(finalStatus.activeOperations).toBe(initialStatus.activeOperations);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      let shutdownEvent = false;
      engine.on('engine:shutdown', () => {
        shutdownEvent = true;
      });

      await engine.shutdown();
      
      expect(engine.state).toBe('shutdown');
      expect(shutdownEvent).toBe(true);
    });

    it('should wait for active operations before shutdown', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];

      // Start a long-running operation
      const ingestionPromise = engine.ingest(sources, { user: 'test-user' });
      
      // Immediately try to shutdown
      const shutdownPromise = engine.shutdown();
      
      // Both should complete successfully
      await Promise.all([ingestionPromise, shutdownPromise]);
      
      expect(engine.state).toBe('shutdown');
    });
  });
});

describe('KGenEngine Determinism Tests', () => {
  it('should produce identical results for identical inputs', async () => {
    const config = {
      mode: 'test',
      enableDistributedReasoning: false
    };

    const engine1 = new KGenEngine(config);
    const engine2 = new KGenEngine(config);

    try {
      await engine1.initialize();
      await engine2.initialize();

      const sources = [
        {
          type: 'rdf',
          content: `
            @prefix ex: <http://example.org/> .
            ex:person1 a ex:Person ;
                       ex:hasName "John Doe" ;
                       ex:hasAge 30 .
          `,
          format: 'turtle'
        }
      ];

      const result1 = await engine1.ingest(sources, { user: 'test-user' });
      const result2 = await engine2.ingest(sources, { user: 'test-user' });

      // Results should be byte-for-byte identical
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));

    } finally {
      await engine1.shutdown();
      await engine2.shutdown();
    }
  });

  it('should maintain temporal consistency', async () => {
    const engine = new KGenEngine({ mode: 'test' });
    await engine.initialize();

    try {
      const sources = [
        {
          type: 'rdf',
          content: TestHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];

      // Perform the same operation at different times
      const result1 = await engine.ingest(sources, { user: 'test-user' });
      
      // Advance mock time
      global.mockTimestamp += 1000;
      
      const result2 = await engine.ingest(sources, { user: 'test-user' });

      // Core data should be identical despite timestamp differences
      expect(result1.entities).toEqual(result2.entities);
      expect(result1.relationships).toEqual(result2.relationships);

    } finally {
      await engine.shutdown();
    }
  });
});