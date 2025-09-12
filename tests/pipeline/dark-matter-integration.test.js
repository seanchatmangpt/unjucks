/**
 * Dark-Matter Integration Pipeline Tests
 * 
 * Agent #9 verification: Tests idempotent pipeline architecture with pure function guarantees
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createDarkMatterPipeline } from '../../src/pipeline/dark-matter-integration.js';
import { createPureFunctionalCore } from '../../src/pipeline/pure-functional-core.js';
import { createIdempotentPipeline } from '../../src/pipeline/idempotent-pipeline-wrapper.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Dark-Matter Integration Pipeline', () => {
  let pipeline;
  let testDataDir;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = path.join(__dirname, '../../tmp', `test-${this.getDeterministicTimestamp()}`);
    testDataDir = path.join(tempDir, 'test-data');
    await fs.ensureDir(testDataDir);

    // Initialize Dark-Matter pipeline
    pipeline = createDarkMatterPipeline({
      enablePerformanceOptimizations: false, // Disable for consistent testing
      enableIdempotencyVerification: true,
      enableContentAddressing: true,
      enableAuditTrail: true,
      debug: true
    });

    // Create test RDF data
    const testRDF = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:UserService rdf:type ex:RESTService ;
    ex:label "User Management API" ;
    ex:hasBaseURL "http://localhost:3000" ;
    ex:hasVersion "1.0.0" .

ex:User rdf:type ex:Entity ;
    ex:label "User" .

ex:name rdf:type ex:Property ;
    ex:label "Name" ;
    ex:hasType "string" ;
    ex:isRequired "true" .

ex:email rdf:type ex:Property ;
    ex:label "Email" ;
    ex:hasType "string" ;
    ex:isRequired "true" .

ex:getUsers rdf:type ex:Endpoint ;
    ex:label "Get Users" ;
    ex:hasMethod "GET" ;
    ex:hasPath "/users" .

ex:createUser rdf:type ex:Endpoint ;
    ex:label "Create User" ;
    ex:hasMethod "POST" ;
    ex:hasPath "/users" ;
    ex:hasRequestBody "true" .
`;

    await fs.writeFile(path.join(testDataDir, 'test-graph.ttl'), testRDF);

    // Create test template
    const testTemplate = `
# {{ service.label }}

API Version: {{ service.version }}
Base URL: {{ service.baseURL }}

## Entity: {{ entity.label }}

### Properties:
{{#each entity.properties}}
- **{{ label }}**: {{ type }}{{#if isRequired}} (required){{/if}}
{{/each}}

### Endpoints:
{{#each endpoints}}
- **{{ method }} {{ path }}**: {{ label }}{{#if hasRequestBody}} (has request body){{/if}}
{{/each}}

Generated at: {{ timestamp }}
`;

    await fs.writeFile(path.join(testDataDir, 'test-template.njk'), testTemplate);
  });

  afterEach(async () => {
    // Clean up temporary files
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    
    // Reset pipeline state
    if (pipeline) {
      pipeline.reset();
    }
  });

  test('should create Dark-Matter pipeline with correct configuration', () => {
    expect(pipeline).toBeDefined();
    expect(pipeline.options.enableContentAddressing).toBe(true);
    expect(pipeline.options.enableIdempotencyVerification).toBe(true);
    expect(pipeline.options.enableAuditTrail).toBe(true);
    expect(pipeline.pureFunctionalCore).toBeDefined();
    expect(pipeline.idempotentWrapper).toBeDefined();
  });

  test('should execute generation operation with idempotency guarantees', async () => {
    const operationInput = {
      graphFile: path.join(testDataDir, 'test-graph.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: { timestamp: '2024-01-01T00:00:00.000Z' }, // Fixed timestamp for determinism
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true // Don't actually write files
    };

    const result = await pipeline.executeDarkMatterOperation('generate', operationInput);

    expect(result.success).toBe(true);
    expect(result.artifacts).toBeDefined();
    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.darkMatterIntegration).toBeDefined();
    expect(result.darkMatterIntegration.pureFunctional).toBe(true);
    expect(result.darkMatterIntegration.contentAddressed).toBe(true);
    expect(result.provenance).toBeDefined();
  });

  test('should verify idempotency across multiple executions', async () => {
    const operationInput = {
      graphFile: path.join(testDataDir, 'test-graph.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: { timestamp: '2024-01-01T00:00:00.000Z' }, // Fixed timestamp
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true
    };

    // Execute same operation multiple times
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await pipeline.executeDarkMatterOperation('generate', operationInput);
      results.push(result);
    }

    // All results should be successful
    expect(results.every(r => r.success)).toBe(true);

    // Verify idempotency - all content hashes should be identical
    const contentHashes = results.map(r => r.provenance.contentHash);
    const uniqueHashes = new Set(contentHashes);
    expect(uniqueHashes.size).toBe(1);

    // Verify idempotency verification results
    results.forEach(result => {
      if (result.idempotencyVerification) {
        expect(result.idempotencyVerification.isIdempotent).toBe(true);
      }
    });
  });

  test('should demonstrate content-addressed caching', async () => {
    const operationInput = {
      graphFile: path.join(testDataDir, 'test-graph.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: { timestamp: '2024-01-01T00:00:00.000Z' },
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true
    };

    // First execution - should miss cache
    const result1 = await pipeline.executeDarkMatterOperation('generate', operationInput);
    expect(result1.darkMatterIntegration.cached).toBe(false);

    // Second execution - should hit cache
    const result2 = await pipeline.executeDarkMatterOperation('generate', operationInput);
    expect(result2.darkMatterIntegration.cached).toBe(true);

    // Results should be identical
    expect(result1.provenance.contentHash).toBe(result2.provenance.contentHash);
  });

  test('should handle operation failures gracefully', async () => {
    const invalidInput = {
      graphFile: path.join(testDataDir, 'nonexistent.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: {},
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true
    };

    const result = await pipeline.executeDarkMatterOperation('generate', invalidInput);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.darkMatterIntegration).toBeDefined();
  });

  test('should maintain audit trail', async () => {
    const operationInput = {
      graphFile: path.join(testDataDir, 'test-graph.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: { timestamp: '2024-01-01T00:00:00.000Z' },
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true
    };

    // Execute multiple operations
    await pipeline.executeDarkMatterOperation('generate', operationInput);
    await pipeline.executeDarkMatterOperation('generate', operationInput);

    const metrics = pipeline.getMetrics();
    expect(metrics.auditTrail.enabled).toBe(true);
    expect(metrics.auditTrail.entries).toBeGreaterThan(0);
  });

  test('should provide comprehensive metrics', async () => {
    const operationInput = {
      graphFile: path.join(testDataDir, 'test-graph.ttl'),
      templatePath: path.join(testDataDir, 'test-template.njk'),
      variables: { timestamp: '2024-01-01T00:00:00.000Z' },
      outputDir: path.join(testDataDir, 'output'),
      dryRun: true
    };

    await pipeline.executeDarkMatterOperation('generate', operationInput);

    const metrics = pipeline.getMetrics();

    expect(metrics.darkMatterPipeline).toBeDefined();
    expect(metrics.pureFunctionalCore).toBeDefined();
    expect(metrics.idempotentWrapper).toBeDefined();
    expect(metrics.contentAddressedCache).toBeDefined();
    expect(metrics.integrationHealth).toBeDefined();
    
    expect(metrics.darkMatterPipeline.totalOperations).toBeGreaterThan(0);
    expect(metrics.integrationHealth.pureOperationsRatio).toBeGreaterThan(0);
  });
});

describe('Pure Functional Core', () => {
  let core;

  beforeEach(() => {
    core = createPureFunctionalCore({
      enableCache: true,
      enableTracing: true,
      debug: true
    });
  });

  afterEach(() => {
    core.reset();
  });

  test('should register and execute pure functions', () => {
    // Register a simple pure function
    core.registerPureFunction('multiply', (a, b) => ({ result: a * b, pure: true }));

    const result = core.execute('multiply', 5, 3);
    expect(result.result).toBe(15);
    expect(result.pure).toBe(true);
  });

  test('should demonstrate function caching', () => {
    let callCount = 0;
    core.registerPureFunction('countedAdd', (a, b) => {
      callCount++;
      return { result: a + b, callCount };
    });

    // First call - should execute function
    const result1 = core.execute('countedAdd', 2, 3);
    expect(result1.result).toBe(5);
    expect(result1.callCount).toBe(1);

    // Second call with same args - should use cache
    const result2 = core.execute('countedAdd', 2, 3);
    expect(result2.result).toBe(5);
    expect(result2.callCount).toBe(1); // Still 1, not incremented

    // Call with different args - should execute function
    const result3 = core.execute('countedAdd', 3, 4);
    expect(result3.result).toBe(7);
    expect(result3.callCount).toBe(2); // Incremented for new call
  });

  test('should create and execute pipelines', () => {
    // Register pipeline steps
    core.registerPureFunction('addOne', (x) => ({ value: x.value + 1 }));
    core.registerPureFunction('multiplyTwo', (x) => ({ value: x.value * 2 }));
    core.registerPureFunction('stringify', (x) => ({ value: x.value.toString() }));

    // Create pipeline
    const pipeline = core.createPipeline([
      { function: 'addOne' },
      { function: 'multiplyTwo' },
      { function: 'stringify' }
    ]);

    // Execute pipeline
    const result = pipeline({ value: 5 });

    expect(result.success).toBe(true);
    expect(result.result.value).toBe('12'); // (5 + 1) * 2 = 12
    expect(result.stepCount).toBe(3);
  });

  test('should verify pipeline idempotency', () => {
    core.registerPureFunction('square', (x) => ({ value: x.value * x.value }));
    
    const pipeline = core.createPipeline([
      { function: 'square' }
    ]);

    const verification = core.verifyIdempotency(pipeline, { value: 4 }, 5);

    expect(verification.isIdempotent).toBe(true);
    expect(verification.allSucceeded).toBe(true);
    expect(verification.uniqueOutputs).toBe(1);
    expect(verification.iterations).toBe(5);
  });

  test('should provide hash mapping for traceability', () => {
    core.registerPureFunction('identity', (x) => x);
    
    const input = { test: 'data' };
    core.execute('identity', input);

    const inputHash = core.createInputHash({ name: 'identity', args: [input] });
    const mapping = core.getHashMapping(inputHash);

    expect(mapping.inputHash).toBe(inputHash);
    expect(mapping.outputHash).toBeDefined();
    expect(mapping.cached).toBe(true);
    expect(mapping.mappingExists).toBe(true);
  });

  test('should maintain execution metrics', () => {
    core.registerPureFunction('testFn', (x) => ({ result: x * 2 }));
    
    // Execute function multiple times
    core.execute('testFn', 1);
    core.execute('testFn', 2);
    core.execute('testFn', 1); // This should hit cache

    const metrics = core.getMetrics();

    expect(metrics.totalOperations).toBe(3);
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(2);
    expect(metrics.registeredFunctions).toBe(1);
    expect(metrics.cacheHitRate).toBeCloseTo(0.33, 2);
  });
});

describe('Idempotent Pipeline Wrapper', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = createIdempotentPipeline({
      enableCache: true,
      enableVerification: true,
      debug: true
    });
  });

  afterEach(() => {
    wrapper.reset();
  });

  test('should execute idempotent operations', async () => {
    const input = {
      content: 'test content',
      transformRules: []
    };

    const result = await wrapper.executeIdempotentPipeline('transform', input);

    expect(result.success).toBe(true);
    expect(result.operationId).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  });

  test('should demonstrate operation caching', async () => {
    const input = {
      content: 'test content',
      transformRules: []
    };

    // First execution
    const result1 = await wrapper.executeIdempotentPipeline('transform', input);
    expect(result1.cached).toBe(false);

    // Second execution with same input
    const result2 = await wrapper.executeIdempotentPipeline('transform', input);
    expect(result2.cached).toBe(true);

    // Results should be identical
    expect(result1.operationId).toBe(result2.operationId);
  });

  test('should verify operation idempotency', async () => {
    const input = {
      content: 'test content',
      transformRules: []
    };

    const result = await wrapper.executeIdempotentPipeline('transform', input);

    if (result.idempotencyCheck) {
      expect(result.idempotencyCheck.isIdempotent).toBe(true);
      expect(result.idempotencyCheck.allSucceeded).toBe(true);
    }
  });

  test('should provide comprehensive wrapper metrics', async () => {
    const input = {
      content: 'test content',
      transformRules: []
    };

    await wrapper.executeIdempotentPipeline('transform', input);

    const metrics = wrapper.getMetrics();

    expect(metrics.totalOperations).toBeGreaterThan(0);
    expect(metrics.coreFunctionMetrics).toBeDefined();
    expect(metrics.successRate).toBeGreaterThan(0);
  });
});

describe('Integration Health', () => {
  test('should demonstrate end-to-end pipeline health', async () => {
    const pipeline = createDarkMatterPipeline({
      enableIdempotencyVerification: true,
      enableContentAddressing: true,
      debug: false
    });

    // Simulate multiple operations with different types
    const operations = [
      { type: 'transform', input: { content: 'test1', transformRules: [] } },
      { type: 'transform', input: { content: 'test2', transformRules: [] } },
      { type: 'validate', input: { artifacts: [], constraints: [] } }
    ];

    for (const op of operations) {
      await pipeline.executeDarkMatterOperation(op.type, op.input);
    }

    const metrics = pipeline.getMetrics();

    // Verify system health
    expect(metrics.integrationHealth.pureOperationsRatio).toBeGreaterThan(0);
    expect(metrics.darkMatterPipeline.totalOperations).toBe(3);
    expect(metrics.pureFunctionalCore.totalOperations).toBeGreaterThan(0);
    expect(metrics.contentAddressedCache.size).toBeGreaterThan(0);

    // Clean up
    pipeline.reset();
  });
});