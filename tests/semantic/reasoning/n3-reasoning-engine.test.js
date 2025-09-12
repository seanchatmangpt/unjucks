/**
 * Comprehensive Unit Tests for N3 Reasoning Engine
 * Tests rule-based inference, incremental reasoning, and explanation generation
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { N3ReasoningEngine } from '../../../src/kgen/semantic/reasoning/n3-reasoning-engine.js';
import { Store, Parser, Writer } from 'n3';
import EventEmitter from 'events';

describe('N3ReasoningEngine', () => {
  let engine;
  let mockConfig;
  let testStore;

  beforeEach(() => {
    mockConfig = {
      reasoning: {
        n3: {
          enabled: true,
          reasoningLevel: 'full',
          rulePacks: ['rdfs', 'owl', 'business'],
          incrementalReasoning: true,
          maxIterations: 100,
          enableExplanations: true
        }
      }
    };

    engine = new N3ReasoningEngine(mockConfig);
    testStore = new Store();

    // Add test triples
    const parser = new Parser();
    const testTurtle = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .

      ex:Person rdf:type rdfs:Class .
      ex:Student rdf:type rdfs:Class .
      ex:Student rdfs:subClassOf ex:Person .
      
      ex:john rdf:type ex:Student .
      ex:mary rdf:type ex:Person .
      
      ex:hasAge rdf:type rdf:Property .
      ex:john ex:hasAge 20 .
    `;

    const quads = parser.parse(testTurtle);
    testStore.addQuads(quads);
  });

  afterEach(() => {
    if (engine.isInitialized) {
      engine.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await engine.initialize();
      expect(engine.isInitialized).toBe(true);
      expect(engine.reasoningLevel).toBe('full');
    });

    it('should load default rule packs on initialization', async () => {
      await engine.initialize();
      expect(engine.activeRules.size).toBeGreaterThan(0);
    });

    it('should throw error with invalid config', async () => {
      const invalidEngine = new N3ReasoningEngine({});
      await expect(invalidEngine.initialize()).rejects.toThrow('N3 reasoning is not enabled');
    });

    it('should emit initialization events', async () => {
      const initSpy = vi.fn();
      engine.on('initialized', initSpy);
      
      await engine.initialize();
      expect(initSpy).toHaveBeenCalledWith({ component: 'N3ReasoningEngine' });
    });
  });

  describe('RDFS Reasoning', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should infer rdfs:subClassOf transitivity', async () => {
      // Add: Teacher subClassOf Person, Professor subClassOf Teacher
      const additionalTriples = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:Teacher rdfs:subClassOf ex:Person .
        ex:Professor rdfs:subClassOf ex:Teacher .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(additionalTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      // Should infer: Professor subClassOf Person (transitivity)
      const inferredTriples = result.inferredTriples;
      const hasTransitiveInference = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/Professor' &&
        quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#subClassOf' &&
        quad.object.value === 'http://example.org/Person'
      );
      
      expect(hasTransitiveInference).toBe(true);
      expect(result.statistics.inferredTriples).toBeGreaterThan(0);
    });

    it('should infer type inheritance from subClassOf', async () => {
      const result = await engine.performReasoning(testStore);
      
      // Should infer: john rdf:type Person (from john rdf:type Student, Student subClassOf Person)
      const inferredTriples = result.inferredTriples;
      const hasTypeInheritance = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/john' &&
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Person'
      );
      
      expect(hasTypeInheritance).toBe(true);
    });

    it('should handle property domain and range inference', async () => {
      const domainRangeTriples = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:teaches rdf:type rdf:Property .
        ex:teaches rdfs:domain ex:Teacher .
        ex:teaches rdfs:range ex:Course .
        
        ex:prof1 ex:teaches ex:math101 .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(domainRangeTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      // Should infer: prof1 rdf:type Teacher, math101 rdf:type Course
      const inferredTriples = result.inferredTriples;
      const hasDomainInference = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/prof1' &&
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Teacher'
      );
      
      expect(hasDomainInference).toBe(true);
    });
  });

  describe('OWL Reasoning Integration', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should handle owl:equivalentClass reasoning', async () => {
      const owlTriples = `
        @prefix ex: <http://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:Pupil owl:equivalentClass ex:Student .
        ex:alice rdf:type ex:Pupil .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(owlTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      // Should infer: alice rdf:type Student
      const inferredTriples = result.inferredTriples;
      const hasEquivalenceInference = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/alice' &&
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Student'
      );
      
      expect(hasEquivalenceInference).toBe(true);
    });

    it('should handle owl:sameAs reasoning', async () => {
      const sameAsTriples = `
        @prefix ex: <http://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        
        ex:john owl:sameAs ex:johnDoe .
        ex:johnDoe ex:hasAge 25 .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(sameAsTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      // Should infer: john ex:hasAge 25
      const inferredTriples = result.inferredTriples;
      const hasSameAsInference = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/john' &&
        quad.predicate.value === 'http://example.org/hasAge' &&
        quad.object.value === '25'
      );
      
      expect(hasSameAsInference).toBe(true);
    });
  });

  describe('Custom Business Rules', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should apply custom business rules', async () => {
      const businessRule = {
        id: 'adult-classification',
        description: 'Classify persons over 18 as adults',
        rule: `
          @prefix ex: <http://example.org/> .
          { ?person a ex:Person . ?person ex:hasAge ?age . ?age math:greaterThan 17 } => { ?person a ex:Adult } .
        `
      };

      await engine.addCustomRule(businessRule);
      
      const result = await engine.performReasoning(testStore);
      
      // Should infer: john rdf:type Adult (since john hasAge 20)
      const inferredTriples = result.inferredTriples;
      const hasBusinessRuleInference = inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/john' &&
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Adult'
      );
      
      expect(hasBusinessRuleInference).toBe(true);
      expect(engine.activeRules.has('adult-classification')).toBe(true);
    });

    it('should handle rule priorities correctly', async () => {
      const highPriorityRule = {
        id: 'high-priority',
        priority: 10,
        rule: '{ ?s ?p ?o } => { ?s ex:processed true }'
      };

      const lowPriorityRule = {
        id: 'low-priority', 
        priority: 1,
        rule: '{ ?s ex:processed true } => { ?s ex:finalProcessed true }'
      };

      await engine.addCustomRule(highPriorityRule);
      await engine.addCustomRule(lowPriorityRule);

      const result = await engine.performReasoning(testStore);
      
      // High priority rule should execute first, enabling low priority rule
      expect(result.statistics.rulesApplied).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Incremental Reasoning', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should perform incremental reasoning on changes', async () => {
      // Initial reasoning
      const initialResult = await engine.performReasoning(testStore);
      const initialCount = initialResult.inferredTriples.length;

      // Add new triple
      const parser = new Parser();
      const newTriples = parser.parse(`
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:bob rdf:type ex:Student .
      `);
      testStore.addQuads(newTriples);

      // Incremental reasoning
      const incrementalResult = await engine.performIncrementalReasoning(testStore, newTriples);
      
      expect(incrementalResult.inferredTriples.length).toBeGreaterThan(0);
      expect(incrementalResult.statistics.incrementalMode).toBe(true);
      
      // Should infer: bob rdf:type Person
      const hasNewInference = incrementalResult.inferredTriples.some(quad =>
        quad.subject.value === 'http://example.org/bob' &&
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Person'
      );
      
      expect(hasNewInference).toBe(true);
    });

    it('should track reasoning dependencies', async () => {
      const result = await engine.performReasoning(testStore);
      
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.size).toBeGreaterThan(0);
    });
  });

  describe('Consistency Checking', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should detect inconsistent data', async () => {
      const inconsistentTriples = `
        @prefix ex: <http://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        
        ex:Vehicle rdf:type owl:Class .
        ex:Animal rdf:type owl:Class .
        ex:Vehicle owl:disjointWith ex:Animal .
        
        ex:car rdf:type ex:Vehicle .
        ex:car rdf:type ex:Animal .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(inconsistentTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      expect(result.consistency.isConsistent).toBe(false);
      expect(result.consistency.violations.length).toBeGreaterThan(0);
    });

    it('should provide consistency explanations', async () => {
      const inconsistentTriples = `
        @prefix ex: <http://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        
        ex:A owl:disjointWith ex:B .
        ex:x rdf:type ex:A .
        ex:x rdf:type ex:B .
      `;
      
      const parser = new Parser();
      const quads = parser.parse(inconsistentTriples);
      testStore.addQuads(quads);

      const result = await engine.performReasoning(testStore);
      
      expect(result.consistency.violations[0]).toHaveProperty('explanation');
      expect(result.consistency.violations[0]).toHaveProperty('conflictingTriples');
    });
  });

  describe('Explanation Generation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should generate explanations for inferences', async () => {
      const result = await engine.performReasoning(testStore);
      
      const explanation = engine.generateExplanation(
        'http://example.org/john',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://example.org/Person'
      );

      expect(explanation).toBeDefined();
      expect(explanation.chain).toBeDefined();
      expect(explanation.chain.length).toBeGreaterThan(0);
      expect(explanation.rules).toBeDefined();
    });

    it('should trace inference chains', async () => {
      await engine.performReasoning(testStore);
      
      const trace = engine.traceInference(
        'http://example.org/john',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 
        'http://example.org/Person'
      );

      expect(trace).toHaveProperty('steps');
      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.steps[0]).toHaveProperty('premise');
      expect(trace.steps[0]).toHaveProperty('rule');
      expect(trace.steps[0]).toHaveProperty('conclusion');
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should respect maxIterations limit', async () => {
      engine.config.reasoning.n3.maxIterations = 5;
      
      const result = await engine.performReasoning(testStore);
      
      expect(result.statistics.iterations).toBeLessThanOrEqual(5);
    });

    it('should optimize reasoning with caching', async () => {
      // First reasoning pass
      const start1 = Date.now();
      const result1 = await engine.performReasoning(testStore);
      const time1 = Date.now() - start1;

      // Second reasoning pass (should use cache)
      const start2 = Date.now();
      const result2 = await engine.performReasoning(testStore);
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1);
      expect(result2.statistics.cacheHits).toBeGreaterThan(0);
    });

    it('should handle large datasets efficiently', async () => {
      // Generate large test dataset
      const largeDataset = new Store();
      for (let i = 0; i < 1000; i++) {
        const parser = new Parser();
        const triples = parser.parse(`
          @prefix ex: <http://example.org/> .
          @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
          
          ex:person${i} rdf:type ex:Student .
        `);
        largeDataset.addQuads(triples);
      }

      const start = Date.now();
      const result = await engine.performReasoning(largeDataset);
      const time = Date.now() - start;

      expect(result.inferredTriples.length).toBeGreaterThan(1000);
      expect(time).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should handle malformed rules gracefully', async () => {
      const invalidRule = {
        id: 'invalid-rule',
        rule: 'invalid n3 syntax {'
      };

      await expect(engine.addCustomRule(invalidRule)).rejects.toThrow();
      expect(engine.activeRules.has('invalid-rule')).toBe(false);
    });

    it('should handle empty stores', async () => {
      const emptyStore = new Store();
      const result = await engine.performReasoning(emptyStore);
      
      expect(result.inferredTriples).toEqual([]);
      expect(result.statistics.inferredTriples).toBe(0);
      expect(result.consistency.isConsistent).toBe(true);
    });

    it('should emit error events for reasoning failures', async () => {
      const errorSpy = vi.fn();
      engine.on('error', errorSpy);

      // Force an error by corrupting the reasoning engine state
      engine.reasoner = null;
      
      await expect(engine.performReasoning(testStore)).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should emit reasoning events', async () => {
      const startSpy = vi.fn();
      const progressSpy = vi.fn();
      const completeSpy = vi.fn();

      engine.on('reasoning:start', startSpy);
      engine.on('reasoning:progress', progressSpy);
      engine.on('reasoning:complete', completeSpy);

      await engine.performReasoning(testStore);

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should emit rule loading events', async () => {
      const ruleSpy = vi.fn();
      engine.on('rule:loaded', ruleSpy);

      await engine.loadRulePack('rdfs');
      
      expect(ruleSpy).toHaveBeenCalled();
    });
  });
});