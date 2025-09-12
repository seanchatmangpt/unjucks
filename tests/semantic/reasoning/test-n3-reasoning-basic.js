#!/usr/bin/env node

/**
 * Basic test runner for N3 Reasoning Engine
 * Tests core functionality without external test frameworks
 */

import { N3ReasoningEngine } from '../../../src/kgen/semantic/reasoning/n3-reasoning-engine.js';
import { Store, Parser } from 'n3';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running N3 Reasoning Engine Tests\n');
    
    for (const { name, fn } of this.tests) {
      try {
        console.log(`▶️  Testing: ${name}`);
        await fn();
        console.log(`✅ PASS: ${name}\n`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Total:  ${this.passed + this.failed}`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Helper functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertExists(value, name) {
  assert(value !== null && value !== undefined, `${name} should exist`);
}

function assertGreaterThan(actual, expected, name) {
  assert(actual > expected, `${name} should be greater than ${expected}, got ${actual}`);
}

function assertEqual(actual, expected, name) {
  assert(actual === expected, `${name} should equal ${expected}, got ${actual}`);
}

// Create test runner
const runner = new TestRunner();

// Test 1: Engine initialization
runner.test('Engine Initialization', async () => {
  const engine = new N3ReasoningEngine({
    maxInferenceDepth: 5,
    reasoningTimeout: 10000,
    enableIncrementalReasoning: true,
    enableConsistencyChecking: true,
    enableExplanations: true
  });

  assertExists(engine, 'Engine instance');
  assertEqual(engine.state, 'initialized', 'Initial state');
  
  const result = await engine.initialize();
  
  assertExists(result, 'Initialization result');
  assertEqual(result.status, 'success', 'Initialization status');
  assertEqual(engine.state, 'ready', 'Ready state');
  assertGreaterThan(result.rulePacksLoaded, 0, 'Rule packs loaded');

  await engine.shutdown();
});

// Test 2: Rule pack loading
runner.test('Rule Pack Loading', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();

  const status = engine.getStatus();
  
  assertExists(status.rulePacks, 'Rule packs status');
  assertGreaterThan(status.rulePacks.loaded, 0, 'Loaded rule packs count');
  
  await engine.shutdown();
});

// Test 3: Custom rule addition
runner.test('Custom Rule Addition', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();

  const customRule = {
    name: 'Test Rule',
    description: 'A test rule for validation',
    n3Rule: '{ ?person a ex:Person } => { ?person a ex:Entity }',
    priority: 5
  };

  const ruleId = await engine.addCustomRule(customRule);
  
  assertExists(ruleId, 'Rule ID');
  
  const status = engine.getStatus();
  assertGreaterThan(status.rulePacks.custom, 0, 'Custom rules count');

  await engine.shutdown();
});

// Test 4: Basic reasoning
runner.test('Basic RDFS Reasoning', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();

  // Create test graph
  const parser = new Parser();
  const testTurtle = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

    ex:Person rdf:type rdfs:Class .
    ex:Student rdf:type rdfs:Class .
    ex:Student rdfs:subClassOf ex:Person .
    
    ex:john rdf:type ex:Student .
  `;

  const quads = parser.parse(testTurtle);
  const testGraph = {
    triples: quads.map(quad => ({
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value
    }))
  };

  const result = await engine.performReasoning(testGraph, [], {
    operationId: 'test-reasoning-1'
  });

  assertExists(result, 'Reasoning result');
  assertExists(result.operationId, 'Operation ID');
  assertExists(result.inferences, 'Inferences array');
  assertExists(result.context, 'Reasoning context');
  
  // Should have inferred that john is a Person
  const hasPersonInference = result.inferences.some(inf =>
    inf.subject.includes('john') &&
    inf.predicate.includes('type') &&
    inf.object.includes('Person')
  );
  
  assert(hasPersonInference, 'Should infer john is a Person');

  await engine.shutdown();
});

// Test 5: Consistency checking
runner.test('Consistency Checking', async () => {
  const engine = new N3ReasoningEngine({
    enableConsistencyChecking: true
  });
  await engine.initialize();

  // Create inconsistent graph
  const parser = new Parser();
  const inconsistentTurtle = `
    @prefix ex: <http://example.org/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .

    ex:Vehicle rdf:type owl:Class .
    ex:Animal rdf:type owl:Class .
    ex:Vehicle owl:disjointWith ex:Animal .
    
    ex:car rdf:type ex:Vehicle .
    ex:car rdf:type ex:Animal .
  `;

  const quads = parser.parse(inconsistentTurtle);
  const testGraph = {
    triples: quads.map(quad => ({
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value
    }))
  };

  const result = await engine.performReasoning(testGraph, [], {
    operationId: 'test-consistency-1'
  });

  assertExists(result.consistencyReport, 'Consistency report');
  
  // Should detect inconsistency
  assertEqual(result.consistencyReport.consistent, false, 'Should detect inconsistency');
  assertGreaterThan(result.consistencyReport.inconsistencies.length, 0, 'Should have inconsistency details');

  await engine.shutdown();
});

// Test 6: Inference validation
runner.test('Inference Validation', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();

  // Test valid inferences
  const validInferences = [
    {
      subject: 'http://example.org/john',
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'http://example.org/Person',
      confidence: 1.0
    }
  ];

  const validation = await engine.validateInferenceResults(validInferences);
  
  assertExists(validation, 'Validation result');
  assertEqual(validation.isValid, true, 'Should validate correct inferences');
  assertEqual(validation.validInferences.length, 1, 'Should have one valid inference');
  assertEqual(validation.invalidInferences.length, 0, 'Should have no invalid inferences');

  await engine.shutdown();
});

// Test 7: Caching functionality
runner.test('Result Caching', async () => {
  const engine = new N3ReasoningEngine({
    enableCaching: true
  });
  await engine.initialize();

  const testGraph = {
    triples: [{
      subject: 'http://example.org/test',
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'http://example.org/TestClass'
    }]
  };

  const rules = [];

  // First call - should not be cached
  const isCached1 = await engine.isResultCached(testGraph, rules);
  assertEqual(isCached1, false, 'Should not be cached initially');

  // Perform reasoning to populate cache
  await engine.performReasoning(testGraph, rules, {
    operationId: 'cache-test-1'
  });

  // Second call - should be cached
  const isCached2 = await engine.isResultCached(testGraph, rules);
  assertEqual(isCached2, true, 'Should be cached after reasoning');

  await engine.shutdown();
});

// Test 8: Performance metrics
runner.test('Performance Metrics', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();

  const testGraph = {
    triples: [{
      subject: 'http://example.org/test',
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: 'http://example.org/TestClass'
    }]
  };

  const result = await engine.performReasoning(testGraph, [], {
    operationId: 'metrics-test-1'
  });

  assertExists(result.metrics, 'Performance metrics');
  assertExists(result.context.reasoningTime, 'Reasoning time');
  
  const status = engine.getStatus();
  assertExists(status.metrics, 'Engine metrics');
  assertExists(status.performance, 'Performance stats');

  await engine.shutdown();
});

// Test 9: Engine shutdown
runner.test('Engine Shutdown', async () => {
  const engine = new N3ReasoningEngine();
  await engine.initialize();
  
  assertEqual(engine.state, 'ready', 'Should be ready');
  
  await engine.shutdown();
  
  assertEqual(engine.state, 'shutdown', 'Should be shutdown');
});

// Run all tests
runner.run().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});