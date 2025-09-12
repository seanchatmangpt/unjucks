/**
 * Data Flow Integration Tests
 * Tests the complete data flow through the system
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Data Flow Integration Tests', () => {
  let dataFlowResults = {
    flows: [],
    transformations: [],
    integrity: [],
    performance: {}
  };

  beforeAll(async () => {
    await fs.ensureDir(path.join(__dirname, '../temp/data-flow'));
    await fs.ensureDir(path.join(__dirname, '../results'));
  });

  afterAll(async () => {
    await fs.writeJson(
      path.join(__dirname, '../results/data-flow-results.json'),
      dataFlowResults,
      { spaces: 2 }
    );
  });

  describe('RDF Graph → Context → Template → Artifact Flow', () => {
    test('Complete data transformation pipeline', async () => {
      const flowId = `flow-${this.getDeterministicTimestamp()}`;
      const transformations = [];

      // Step 1: RDF Graph Input
      const rdfInput = {
        triples: [
          { s: 'ex:dataset1', p: 'dc:title', o: '"Test Dataset"' },
          { s: 'ex:dataset1', p: 'a', o: 'ex:Dataset' },
          { s: 'ex:dataset1', p: 'prov:wasGeneratedBy', o: 'ex:activity1' }
        ],
        format: 'turtle',
        size: 150
      };

      transformations.push({
        stage: 'rdf-input',
        data: rdfInput,
        integrity: calculateDataIntegrity(rdfInput)
      });

      // Step 2: Context Extraction
      const extractedContext = await extractContextFromRDF(rdfInput);
      
      expect(extractedContext.entities).toBeDefined();
      expect(extractedContext.entities.length).toBeGreaterThan(0);
      expect(extractedContext.properties).toBeDefined();

      transformations.push({
        stage: 'context-extraction',
        data: extractedContext,
        integrity: calculateDataIntegrity(extractedContext),
        transformation: {
          inputTriples: rdfInput.triples.length,
          outputEntities: extractedContext.entities.length,
          outputProperties: extractedContext.properties.length
        }
      });

      // Step 3: Template Processing
      const templateResult = await processTemplate(extractedContext);
      
      expect(templateResult.rendered).toBeDefined();
      expect(templateResult.rendered.length).toBeGreaterThan(0);
      expect(templateResult.variables).toBeDefined();

      transformations.push({
        stage: 'template-processing',
        data: templateResult,
        integrity: calculateDataIntegrity(templateResult),
        transformation: {
          variablesUsed: Object.keys(templateResult.variables).length,
          outputSize: templateResult.rendered.length
        }
      });

      // Step 4: Artifact Generation
      const artifact = await generateFinalArtifact(templateResult);
      
      expect(artifact.content).toBeDefined();
      expect(artifact.metadata).toBeDefined();
      expect(artifact.attestation).toBeDefined();

      transformations.push({
        stage: 'artifact-generation',
        data: artifact,
        integrity: calculateDataIntegrity(artifact),
        transformation: {
          contentHash: artifact.attestation.contentHash,
          finalSize: artifact.content.length
        }
      });

      // Verify data integrity throughout pipeline
      const integrityCheck = verifyPipelineIntegrity(transformations);
      expect(integrityCheck.valid).toBe(true);

      dataFlowResults.flows.push({
        flowId,
        transformations,
        integrityCheck,
        success: true
      });
    });

    test('Data lineage is preserved through transformations', async () => {
      const inputData = {
        source: 'original-graph.ttl',
        version: '1.0.0',
        timestamp: this.getDeterministicDate().toISOString()
      };

      // Transform through multiple stages
      const stage1 = await transformData(inputData, 'parse');
      expect(stage1.lineage).toBeDefined();
      expect(stage1.lineage.source).toBe(inputData.source);

      const stage2 = await transformData(stage1, 'extract');
      expect(stage2.lineage.transformations).toHaveLength(2);

      const stage3 = await transformData(stage2, 'render');
      expect(stage3.lineage.transformations).toHaveLength(3);

      // Verify complete lineage chain
      const lineageChain = reconstructLineage(stage3);
      expect(lineageChain).toHaveLength(3);
      expect(lineageChain[0].operation).toBe('parse');
      expect(lineageChain[2].operation).toBe('render');

      dataFlowResults.transformations.push({
        type: 'lineage-preservation',
        stages: 3,
        lineagePreserved: lineageChain.length === 3,
        originalSource: inputData.source
      });
    });
  });

  describe('Error Handling in Data Flow', () => {
    test('Corrupted data is detected and handled', async () => {
      const corruptedData = {
        triples: [
          { s: 'malformed', p: null, o: undefined }, // Corrupted triple
          { s: 'ex:valid', p: 'ex:prop', o: '"valid"' }
        ]
      };

      const validationResult = await validateInputData(corruptedData);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toBeDefined();
      expect(validationResult.errors.length).toBeGreaterThan(0);

      // Test recovery
      const cleanedData = await cleanCorruptedData(corruptedData);
      expect(cleanedData.triples.length).toBe(1); // Only valid triple remains
      expect(cleanedData.triples[0].s).toBe('ex:valid');

      dataFlowResults.integrity.push({
        type: 'corruption-detection',
        originalTriples: corruptedData.triples.length,
        validTriples: cleanedData.triples.length,
        errorsDetected: validationResult.errors.length
      });
    });

    test('Missing data fields are handled gracefully', async () => {
      const incompleteData = {
        entities: [
          { uri: 'ex:entity1' }, // Missing label and properties
          { uri: 'ex:entity2', label: 'Entity 2' } // Complete
        ]
      };

      const enrichedData = await enrichIncompleteData(incompleteData);
      
      expect(enrichedData.entities[0].label).toBeDefined(); // Should be enriched
      expect(enrichedData.entities[0].properties).toBeDefined(); // Should be enriched
      expect(enrichedData.metadata.enrichmentApplied).toBe(true);

      dataFlowResults.integrity.push({
        type: 'missing-data-handling',
        originalEntities: incompleteData.entities.length,
        enrichedFields: enrichedData.metadata.enrichedFields,
        success: true
      });
    });
  });

  describe('State Management Across Data Flow', () => {
    test('State is correctly maintained across async operations', async () => {
      const initialState = { 
        processedItems: 0, 
        errors: [], 
        cache: new Map() 
      };

      const operations = [
        async (state) => {
          state.processedItems += 1;
          state.cache.set('step1', 'completed');
          await new Promise(resolve => setTimeout(resolve, 10));
          return state;
        },
        async (state) => {
          state.processedItems += 2;
          if (!state.cache.has('step1')) {
            state.errors.push('Step 1 not completed');
          }
          await new Promise(resolve => setTimeout(resolve, 15));
          return state;
        },
        async (state) => {
          state.processedItems += 3;
          state.cache.set('final', true);
          await new Promise(resolve => setTimeout(resolve, 5));
          return state;
        }
      ];

      let currentState = { ...initialState };
      
      for (const operation of operations) {
        currentState = await operation(currentState);
      }

      expect(currentState.processedItems).toBe(6);
      expect(currentState.errors).toHaveLength(0);
      expect(currentState.cache.has('final')).toBe(true);

      dataFlowResults.flows.push({
        type: 'state-management',
        operations: operations.length,
        finalProcessedItems: currentState.processedItems,
        errors: currentState.errors.length,
        statePreserved: true
      });
    });

    test('Concurrent operations maintain data consistency', async () => {
      const sharedResource = { 
        counter: 0, 
        log: [], 
        lock: false 
      };

      const concurrentOperations = Array.from({ length: 5 }, (_, i) => 
        async () => {
          // Wait for lock
          while (sharedResource.lock) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
          sharedResource.lock = true;
          const currentValue = sharedResource.counter;
          
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          
          sharedResource.counter = currentValue + 1;
          sharedResource.log.push(`Operation ${i}: ${sharedResource.counter}`);
          sharedResource.lock = false;
        }
      );

      await Promise.all(concurrentOperations.map(op => op()));

      expect(sharedResource.counter).toBe(5);
      expect(sharedResource.log).toHaveLength(5);
      expect(sharedResource.lock).toBe(false);

      // Verify no race conditions occurred
      const expectedLog = Array.from({ length: 5 }, (_, i) => 
        expect.stringMatching(new RegExp(`Operation \\d+: ${i + 1}`))
      );
      expect(sharedResource.log).toEqual(expect.arrayContaining(expectedLog));

      dataFlowResults.flows.push({
        type: 'concurrent-consistency',
        operations: 5,
        finalCounter: sharedResource.counter,
        logEntries: sharedResource.log.length,
        consistent: sharedResource.counter === 5
      });
    });
  });

  describe('Performance Characteristics', () => {
    test('Data flow performance scales appropriately', async () => {
      const dataSizes = [10, 100, 1000];
      const performanceResults = [];

      for (const size of dataSizes) {
        const testData = generateTestData(size);
        const startTime = this.getDeterministicTimestamp();

        const result = await processDataThroughPipeline(testData);
        
        const processingTime = this.getDeterministicTimestamp() - startTime;
        const throughput = size / processingTime; // items per ms

        performanceResults.push({
          inputSize: size,
          processingTime,
          throughput,
          success: result.success
        });

        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(size * 10); // Max 10ms per item
      }

      // Verify roughly linear scaling
      const throughputs = performanceResults.map(r => r.throughput);
      const throughputVariation = Math.max(...throughputs) / Math.min(...throughputs);
      expect(throughputVariation).toBeLessThan(5); // Within 5x variation

      dataFlowResults.performance.scaling = {
        dataSizes,
        results: performanceResults,
        throughputVariation,
        scalingAcceptable: throughputVariation < 5
      };
    });

    test('Memory usage remains stable during data flow', async () => {
      const initialMemory = process.memoryUsage();
      const memorySnapshots = [initialMemory];

      // Process data in chunks
      for (let i = 0; i < 10; i++) {
        const chunkData = generateTestData(100);
        await processDataThroughPipeline(chunkData);
        
        // Force garbage collection if available
        if (global.gc) global.gc();
        
        memorySnapshots.push(process.memoryUsage());
        
        // Small delay to allow memory to stabilize
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      expect(memoryGrowthMB).toBeLessThan(50); // Less than 50MB growth

      dataFlowResults.performance.memory = {
        initialMB: initialMemory.heapUsed / (1024 * 1024),
        finalMB: finalMemory.heapUsed / (1024 * 1024),
        growthMB: memoryGrowthMB,
        acceptable: memoryGrowthMB < 50,
        snapshots: memorySnapshots.length
      };
    });
  });
});

// Helper functions

function calculateDataIntegrity(data) {
  const serialized = JSON.stringify(data);
  return {
    hash: crypto.createHash('sha256').update(serialized).digest('hex'),
    size: serialized.length,
    timestamp: this.getDeterministicDate().toISOString()
  };
}

async function extractContextFromRDF(rdfInput) {
  // Mock context extraction
  const entities = rdfInput.triples
    .filter(t => t.p === 'a')
    .map(t => ({
      uri: t.s,
      type: t.o,
      importance: Math.random()
    }));

  const properties = rdfInput.triples
    .map(t => t.p)
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .map(p => ({
      uri: p,
      frequency: Math.floor(Math.random() * 10) + 1
    }));

  return { entities, properties };
}

async function processTemplate(context) {
  const template = `
    Entities: {{ entities.length }}
    {% for entity in entities %}
    - {{ entity.uri }} ({{ entity.type }})
    {% endfor %}
    
    Properties: {{ properties.length }}
  `;

  const rendered = template
    .replace('{{ entities.length }}', context.entities.length.toString())
    .replace('{{ properties.length }}', context.properties.length.toString());

  return {
    rendered,
    template,
    variables: {
      entities: context.entities,
      properties: context.properties
    }
  };
}

async function generateFinalArtifact(templateResult) {
  const content = templateResult.rendered;
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  return {
    content,
    metadata: {
      template: templateResult.template,
      generatedAt: this.getDeterministicDate().toISOString()
    },
    attestation: {
      contentHash,
      reproducible: true,
      verified: true
    }
  };
}

function verifyPipelineIntegrity(transformations) {
  const hashes = transformations.map(t => t.integrity.hash);
  const uniqueHashes = new Set(hashes);
  
  // Each stage should have different hash (data changed)
  const dataTransformed = uniqueHashes.size === transformations.length;
  
  // No transformation should result in empty data
  const noEmptyData = transformations.every(t => 
    t.integrity.size > 0
  );

  return {
    valid: dataTransformed && noEmptyData,
    dataTransformed,
    noEmptyData,
    stages: transformations.length
  };
}

async function transformData(inputData, operation) {
  const result = {
    ...inputData,
    transformedBy: operation,
    transformedAt: this.getDeterministicDate().toISOString()
  };

  if (inputData.lineage) {
    result.lineage = {
      ...inputData.lineage,
      transformations: [
        ...inputData.lineage.transformations,
        { operation, timestamp: result.transformedAt }
      ]
    };
  } else {
    result.lineage = {
      source: inputData.source || 'unknown',
      transformations: [
        { operation, timestamp: result.transformedAt }
      ]
    };
  }

  return result;
}

function reconstructLineage(data) {
  return data.lineage?.transformations || [];
}

async function validateInputData(data) {
  const errors = [];
  
  if (data.triples) {
    data.triples.forEach((triple, index) => {
      if (!triple.s || !triple.p || triple.o === null || triple.o === undefined) {
        errors.push(`Invalid triple at index ${index}: missing required fields`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

async function cleanCorruptedData(data) {
  if (data.triples) {
    const validTriples = data.triples.filter(triple => 
      triple.s && triple.p && triple.o !== null && triple.o !== undefined
    );
    
    return {
      ...data,
      triples: validTriples,
      cleaned: true
    };
  }
  
  return data;
}

async function enrichIncompleteData(data) {
  const enrichedEntities = data.entities.map(entity => ({
    ...entity,
    label: entity.label || `Label for ${entity.uri}`,
    properties: entity.properties || [],
    enriched: !entity.label
  }));

  return {
    ...data,
    entities: enrichedEntities,
    metadata: {
      enrichmentApplied: true,
      enrichedFields: ['label', 'properties']
    }
  };
}

function generateTestData(size) {
  return {
    items: Array.from({ length: size }, (_, i) => ({
      id: i,
      value: `item-${i}`,
      timestamp: this.getDeterministicDate().toISOString()
    })),
    metadata: {
      size,
      generated: this.getDeterministicDate().toISOString()
    }
  };
}

async function processDataThroughPipeline(data) {
  // Simulate processing pipeline
  let current = data;
  
  // Stage 1: Validation
  await new Promise(resolve => setTimeout(resolve, data.items.length * 0.1));
  current = { ...current, validated: true };
  
  // Stage 2: Transformation
  await new Promise(resolve => setTimeout(resolve, data.items.length * 0.2));
  current = { 
    ...current, 
    transformed: true,
    items: current.items.map(item => ({ ...item, processed: true }))
  };
  
  // Stage 3: Output generation
  await new Promise(resolve => setTimeout(resolve, data.items.length * 0.1));
  current = { ...current, output: `Processed ${data.items.length} items` };

  return { success: true, result: current };
}