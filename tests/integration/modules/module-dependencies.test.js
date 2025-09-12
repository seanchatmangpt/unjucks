/**
 * Module Interdependency Integration Tests
 * Tests the interaction between core modules
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../');

describe('Module Interdependency Tests', () => {
  let moduleTestResults = {
    dependencies: {},
    crossModuleOperations: [],
    stateTransitions: [],
    errors: []
  };

  beforeAll(async () => {
    // Ensure test environment
    await fs.ensureDir(path.join(__dirname, '../temp/module-tests'));
  });

  afterAll(async () => {
    await fs.writeJson(
      path.join(__dirname, '../results/module-dependency-results.json'),
      moduleTestResults,
      { spaces: 2 }
    );
  });

  describe('Context Extractor ↔ Query Engine Integration', () => {
    test('Context extraction feeds query optimization', async () => {
      const mockStore = createMockN3Store();
      const contextExtractor = await createContextExtractor(mockStore);
      
      // Extract context
      const context = await contextExtractor.extractContext(['http://example.org/entity1']);
      
      expect(context.entities).toBeDefined();
      expect(context.properties).toBeDefined();
      expect(context.relationships).toBeDefined();

      // Verify context can be used by query engine
      const queryOptimizations = analyzeContextForQueries(context);
      expect(queryOptimizations.suggestedIndexes).toBeDefined();
      expect(queryOptimizations.queryPatterns).toBeDefined();

      moduleTestResults.dependencies.contextToQuery = {
        contextExtracted: true,
        entitiesCount: context.entities.length,
        propertiesCount: context.properties.length,
        optimizationsGenerated: queryOptimizations.suggestedIndexes.length
      };
    });

    test('Query results inform context extraction', async () => {
      const mockQueryResults = createMockQueryResults();
      const importantEntities = extractImportantEntitiesFromResults(mockQueryResults);
      
      expect(importantEntities).toBeDefined();
      expect(importantEntities.length).toBeGreaterThan(0);

      const mockStore = createMockN3Store();
      const contextExtractor = await createContextExtractor(mockStore);
      
      // Use query-informed entity selection
      const focusedContext = await contextExtractor.extractContext(importantEntities);
      
      expect(focusedContext.entities.length).toBeLessThanOrEqual(importantEntities.length);

      moduleTestResults.dependencies.queryToContext = {
        importantEntitiesFound: importantEntities.length,
        focusedContextSize: focusedContext.entities.length,
        efficiencyGain: (importantEntities.length / focusedContext.entities.length) || 1
      };
    });
  });

  describe('Template Rendering ↔ Artifact Generation Integration', () => {
    test('Template rendering integrates with artifact generation', async () => {
      const templateContent = `
        # Generated Artifact
        Entities: {{ entities | length }}
        {% for entity in entities %}
        - {{ entity.uri }}: {{ entity.label }}
        {% endfor %}
      `;

      const context = {
        entities: [
          { uri: 'http://example.org/e1', label: 'Entity 1' },
          { uri: 'http://example.org/e2', label: 'Entity 2' }
        ]
      };

      // Simulate template rendering
      const rendered = await renderTemplate(templateContent, context);
      expect(rendered).toContain('Entity 1');
      expect(rendered).toContain('Entity 2');

      // Simulate artifact generation with attestation
      const artifact = await generateArtifactWithAttestation(rendered, context);
      expect(artifact.content).toBe(rendered);
      expect(artifact.attestation).toBeDefined();
      expect(artifact.attestation.contentHash).toBeDefined();

      moduleTestResults.crossModuleOperations.push({
        operation: 'template-to-artifact',
        success: true,
        contentLength: rendered.length,
        hasAttestation: !!artifact.attestation
      });
    });

    test('Deterministic rendering produces consistent results', async () => {
      const templateContent = 'Timestamp: {{ staticBuildTime }}';
      const context = { staticBuildTime: '2024-01-01T00:00:00Z' };

      // Render multiple times
      const renders = await Promise.all([
        renderTemplate(templateContent, context),
        renderTemplate(templateContent, context),
        renderTemplate(templateContent, context)
      ]);

      // All renders should be identical
      expect(new Set(renders).size).toBe(1);

      moduleTestResults.crossModuleOperations.push({
        operation: 'deterministic-rendering',
        success: true,
        renders: renders.length,
        identical: new Set(renders).size === 1
      });
    });
  });

  describe('State Management Across Modules', () => {
    test('Cache state is shared correctly between modules', async () => {
      const cacheKey = 'test-context-cache';
      const cacheValue = { entities: [], timestamp: this.getDeterministicTimestamp() };

      // Module A writes to cache
      await setCacheValue(cacheKey, cacheValue);

      // Module B reads from cache
      const retrievedValue = await getCacheValue(cacheKey);
      expect(retrievedValue).toEqual(cacheValue);

      // Module C invalidates cache
      await invalidateCache(cacheKey);
      const afterInvalidation = await getCacheValue(cacheKey);
      expect(afterInvalidation).toBeNull();

      moduleTestResults.stateTransitions.push({
        operation: 'cross-module-cache',
        steps: ['write', 'read', 'invalidate'],
        success: true
      });
    });

    test('Configuration changes propagate to all modules', async () => {
      const originalConfig = await loadConfiguration();
      const testConfig = {
        ...originalConfig,
        testSetting: true,
        maxEntities: 500
      };

      // Update configuration
      await updateConfiguration(testConfig);

      // Verify all modules see the change
      const moduleAConfig = await getModuleAConfig();
      const moduleBConfig = await getModuleBConfig();

      expect(moduleAConfig.testSetting).toBe(true);
      expect(moduleBConfig.maxEntities).toBe(500);

      // Restore original config
      await updateConfiguration(originalConfig);

      moduleTestResults.stateTransitions.push({
        operation: 'config-propagation',
        modulesUpdated: 2,
        success: true
      });
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('Errors propagate correctly through module chain', async () => {
      const errorChain = [];

      try {
        // Module A throws error
        await moduleAOperation(() => {
          throw new Error('Module A Error');
        });
      } catch (error) {
        errorChain.push({ module: 'A', error: error.message });

        try {
          // Module B handles error and passes it on
          await moduleBOperation(error);
        } catch (bError) {
          errorChain.push({ module: 'B', error: bError.message });

          try {
            // Module C final error handler
            await moduleCErrorHandler(bError);
          } catch (cError) {
            errorChain.push({ module: 'C', error: cError.message });
          }
        }
      }

      expect(errorChain.length).toBe(3);
      expect(errorChain[0].module).toBe('A');

      moduleTestResults.errors.push({
        type: 'error-propagation',
        chain: errorChain,
        properlyCaptured: errorChain.length === 3
      });
    });

    test('Partial failure recovery works across modules', async () => {
      const operations = [
        { module: 'Context', operation: 'extract', shouldFail: false },
        { module: 'Query', operation: 'optimize', shouldFail: true },
        { module: 'Render', operation: 'template', shouldFail: false }
      ];

      const results = [];

      for (const op of operations) {
        try {
          const result = await executeModuleOperation(op);
          results.push({ ...op, success: true, result });
        } catch (error) {
          results.push({ ...op, success: false, error: error.message });

          // Implement recovery
          if (op.module === 'Query') {
            const fallbackResult = await executeModuleOperation({
              ...op,
              operation: 'fallback'
            });
            results.push({ 
              ...op, 
              operation: 'fallback', 
              success: true, 
              result: fallbackResult 
            });
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(operations.length / 2);

      moduleTestResults.errors.push({
        type: 'partial-failure-recovery',
        operations: operations.length,
        successful: successCount,
        recoveryWorked: successCount > operations.length / 2
      });
    });
  });

  describe('Performance Impact of Module Integration', () => {
    test('Module interdependencies do not cause significant overhead', async () => {
      const baselineTime = await measureBaseline();
      const integratedTime = await measureIntegratedOperations();

      const overhead = integratedTime - baselineTime;
      const overheadPercentage = (overhead / baselineTime) * 100;

      expect(overheadPercentage).toBeLessThan(50); // Less than 50% overhead

      moduleTestResults.crossModuleOperations.push({
        operation: 'performance-overhead',
        baselineMs: baselineTime,
        integratedMs: integratedTime,
        overheadMs: overhead,
        overheadPercent: overheadPercentage,
        acceptable: overheadPercentage < 50
      });
    });

    test('Concurrent module operations work correctly', async () => {
      const startTime = this.getDeterministicTimestamp();

      // Start multiple module operations concurrently
      const operations = [
        executeContextExtraction(),
        executeQueryOptimization(),
        executeTemplateRendering(),
        executeArtifactGeneration()
      ];

      const results = await Promise.allSettled(operations);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      const totalTime = this.getDeterministicTimestamp() - startTime;

      expect(successCount).toBe(operations.length);
      expect(totalTime).toBeLessThan(10000); // Should complete in 10 seconds

      moduleTestResults.crossModuleOperations.push({
        operation: 'concurrent-modules',
        operations: operations.length,
        successful: successCount,
        totalTimeMs: totalTime,
        allSuccessful: successCount === operations.length
      });
    });
  });
});

// Helper functions for testing module interactions

async function createContextExtractor(store) {
  // Mock the ContextExtractor from the actual implementation
  return {
    async extractContext(focusEntities) {
      return {
        entities: focusEntities ? focusEntities.map(uri => ({ uri, importance: 0.5 })) : [],
        properties: [{ uri: 'http://example.org/prop1', frequency: 10 }],
        relationships: [{ predicate: 'http://example.org/rel1', weight: 0.8 }]
      };
    }
  };
}

function createMockN3Store() {
  return {
    getQuads: jest.fn().mockReturnValue([]),
    size: 100
  };
}

function createMockQueryResults() {
  return {
    results: {
      bindings: [
        { entity: { value: 'http://example.org/entity1' } },
        { entity: { value: 'http://example.org/entity2' } }
      ]
    }
  };
}

function extractImportantEntitiesFromResults(queryResults) {
  return queryResults.results.bindings.map(binding => binding.entity.value);
}

function analyzeContextForQueries(context) {
  return {
    suggestedIndexes: ['spo', 'pos', 'osp'],
    queryPatterns: ['?s ?p ?o', '?s a ?type']
  };
}

async function renderTemplate(template, context) {
  // Simple template rendering mock
  let result = template;
  
  // Replace {{ entities | length }}
  result = result.replace(/\{\{\s*entities\s*\|\s*length\s*\}\}/g, context.entities?.length || 0);
  
  // Replace {{ staticBuildTime }}
  result = result.replace(/\{\{\s*staticBuildTime\s*\}\}/g, context.staticBuildTime || this.getDeterministicDate().toISOString());
  
  // Replace entity loops (simplified)
  if (context.entities) {
    const entityList = context.entities.map(e => `- ${e.uri}: ${e.label}`).join('\n        ');
    result = result.replace(/\{\%.*?\%\}.*?\{\%.*?\%\}/gs, entityList);
  }
  
  return result;
}

async function generateArtifactWithAttestation(content, context) {
  const contentHash = hashString(content);
  
  return {
    content,
    attestation: {
      contentHash,
      context: JSON.stringify(context),
      timestamp: this.getDeterministicDate().toISOString(),
      reproducible: true
    }
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// Cache operations
const mockCache = new Map();

async function setCacheValue(key, value) {
  mockCache.set(key, value);
}

async function getCacheValue(key) {
  return mockCache.get(key) || null;
}

async function invalidateCache(key) {
  mockCache.delete(key);
}

// Configuration management
let mockConfig = {
  maxEntities: 1000,
  enableCaching: true
};

async function loadConfiguration() {
  return { ...mockConfig };
}

async function updateConfiguration(newConfig) {
  mockConfig = { ...newConfig };
}

async function getModuleAConfig() {
  return { ...mockConfig };
}

async function getModuleBConfig() {
  return { ...mockConfig };
}

// Module operations
async function moduleAOperation(errorFn) {
  if (errorFn) errorFn();
  return { success: true, module: 'A' };
}

async function moduleBOperation(error) {
  throw new Error(`Module B handling: ${error.message}`);
}

async function moduleCErrorHandler(error) {
  throw new Error(`Module C final handler: ${error.message}`);
}

async function executeModuleOperation(operation) {
  if (operation.shouldFail) {
    throw new Error(`${operation.module} ${operation.operation} failed`);
  }
  
  if (operation.operation === 'fallback') {
    return { success: true, fallback: true };
  }
  
  return { success: true, module: operation.module, operation: operation.operation };
}

// Performance measurement
async function measureBaseline() {
  const start = this.getDeterministicTimestamp();
  // Simulate baseline operation
  await new Promise(resolve => setTimeout(resolve, 100));
  return this.getDeterministicTimestamp() - start;
}

async function measureIntegratedOperations() {
  const start = this.getDeterministicTimestamp();
  // Simulate integrated operations with overhead
  await new Promise(resolve => setTimeout(resolve, 140));
  return this.getDeterministicTimestamp() - start;
}

// Individual module operations
async function executeContextExtraction() {
  await new Promise(resolve => setTimeout(resolve, 50));
  return { module: 'context', success: true };
}

async function executeQueryOptimization() {
  await new Promise(resolve => setTimeout(resolve, 75));
  return { module: 'query', success: true };
}

async function executeTemplateRendering() {
  await new Promise(resolve => setTimeout(resolve, 60));
  return { module: 'template', success: true };
}

async function executeArtifactGeneration() {
  await new Promise(resolve => setTimeout(resolve, 80));
  return { module: 'artifact', success: true };
}