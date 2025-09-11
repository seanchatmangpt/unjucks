#!/usr/bin/env node

/**
 * Knowledge Compiler Validation Script
 * Quick validation that the knowledge compiler is working correctly
 */

import { KnowledgeCompiler } from './knowledge-compiler.js';
import { SemanticProcessorBridge } from './integration/semantic-processor-bridge.js';
import { consola } from 'consola';

const logger = consola.withTag('validate');

/**
 * Test basic compilation functionality
 */
async function testBasicCompilation() {
  logger.info('Testing basic compilation functionality...');
  
  try {
    const compiler = new KnowledgeCompiler({
      enableCaching: false,
      includeMetadata: true
    });
    
    await compiler.initialize();
    
    // Test graph
    const testGraph = {
      triples: [
        {
          subject: 'http://unjucks.dev/api/UserService',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'serviceName' }
        },
        {
          subject: 'http://unjucks.dev/api/UserService',
          predicate: 'http://www.w3.org/2000/01/rdf-schema#comment',
          object: { type: 'literal', value: 'User management service' }
        }
      ]
    };
    
    const context = await compiler.compileContext(testGraph, []);
    
    // Validate results
    if (!context.variables) {
      throw new Error('Variables not extracted');
    }
    
    if (!context.variables.serviceName) {
      throw new Error('serviceName variable not found');
    }
    
    if (context.variables.serviceName.description !== 'User management service') {
      throw new Error('Variable description not extracted correctly');
    }
    
    const metrics = compiler.getMetrics();
    if (metrics.variablesExtracted !== 1) {
      throw new Error(`Expected 1 variable, got ${metrics.variablesExtracted}`);
    }
    
    logger.success('✅ Basic compilation test passed');
    return true;
    
  } catch (error) {
    logger.error('❌ Basic compilation test failed:', error.message);
    return false;
  }
}

/**
 * Test N3 rule processing
 */
async function testRuleProcessing() {
  logger.info('Testing N3 rule processing...');
  
  try {
    const compiler = new KnowledgeCompiler();
    await compiler.initialize();
    
    const graph = {
      triples: [
        {
          subject: 'http://unjucks.dev/api/endpoint1',
          predicate: 'http://unjucks.dev/api/isPublic',
          object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
        }
      ]
    };
    
    const rules = [{
      body: `{
        ?endpoint <http://unjucks.dev/api/isPublic> true
      } => {
        ?endpoint <http://unjucks.dev/api/requiresAuth> true
      }`
    }];
    
    const context = await compiler.compileContext(graph, rules);
    
    // Check if rule inference worked
    const facts = context.facts['http://unjucks.dev/api/endpoint1'];
    if (!facts || !facts['http://unjucks.dev/api/requiresAuth']) {
      throw new Error('Rule inference did not generate expected fact');
    }
    
    logger.success('✅ Rule processing test passed');
    return true;
    
  } catch (error) {
    logger.error('❌ Rule processing test failed:', error.message);
    return false;
  }
}

/**
 * Test caching functionality
 */
async function testCaching() {
  logger.info('Testing caching functionality...');
  
  try {
    const compiler = new KnowledgeCompiler({ enableCaching: true });
    await compiler.initialize();
    
    const graph = {
      triples: [
        {
          subject: 'http://unjucks.dev/test/cache',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'testVar' }
        }
      ]
    };
    
    // First compilation - should be cache miss
    await compiler.compileContext(graph, []);
    const metrics1 = compiler.getMetrics();
    
    // Second compilation - should be cache hit
    await compiler.compileContext(graph, []);
    const metrics2 = compiler.getMetrics();
    
    if (metrics2.cacheHits <= metrics1.cacheHits) {
      throw new Error('Cache hit not registered on second compilation');
    }
    
    logger.success('✅ Caching test passed');
    return true;
    
  } catch (error) {
    logger.error('❌ Caching test failed:', error.message);
    return false;
  }
}

/**
 * Test context optimization
 */
async function testOptimization() {
  logger.info('Testing context optimization...');
  
  try {
    const compiler = new KnowledgeCompiler({ 
      optimizeForTemplates: true,
      compactOutput: false
    });
    await compiler.initialize();
    
    const graph = {
      triples: [
        {
          subject: 'http://unjucks.dev/test/nested',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'nestedVar' }
        }
      ]
    };
    
    const context = await compiler.compileContext(graph, [], {
      flattenStructures: true,
      precomputeExpressions: true
    });
    
    // Check optimizations
    if (!context.flat) {
      throw new Error('Context not flattened');
    }
    
    if (!context.computed) {
      throw new Error('Computed properties not added');
    }
    
    if (typeof context.computed.isEmpty !== 'function') {
      throw new Error('Utility functions not precomputed');
    }
    
    logger.success('✅ Optimization test passed');
    return true;
    
  } catch (error) {
    logger.error('❌ Optimization test failed:', error.message);
    return false;
  }
}

/**
 * Test semantic bridge integration
 */
async function testSemanticBridge() {
  logger.info('Testing semantic processor bridge...');
  
  try {
    const bridge = new SemanticProcessorBridge();
    await bridge.initialize();
    
    // Mock semantic graph
    const semanticGraph = {
      entities: [
        {
          uri: 'http://unjucks.dev/test/entity',
          type: 'http://unjucks.dev/api/Service',
          properties: {
            'http://www.w3.org/2000/01/rdf-schema#label': 'Test Service'
          },
          templateVariables: ['serviceName']
        }
      ]
    };
    
    const context = await bridge.convertSemanticToKnowledge(semanticGraph, []);
    
    if (!context.variables || !context.variables.serviceName) {
      throw new Error('Semantic to knowledge conversion failed');
    }
    
    if (!context.semantic) {
      throw new Error('Semantic metadata not added');
    }
    
    logger.success('✅ Semantic bridge test passed');
    return true;
    
  } catch (error) {
    logger.error('❌ Semantic bridge test failed:', error.message);
    return false;
  }
}

/**
 * Run all validation tests
 */
async function runValidation() {
  logger.start('🚀 Starting Knowledge Compiler Validation');
  
  const tests = [
    testBasicCompilation,
    testRuleProcessing,
    testCaching,
    testOptimization,
    testSemanticBridge
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) passed++;
      else failed++;
    } catch (error) {
      logger.error('Test execution failed:', error);
      failed++;
    }
  }
  
  logger.info(`\n📊 Validation Results:`);
  logger.success(`✅ Passed: ${passed}`);
  if (failed > 0) {
    logger.error(`❌ Failed: ${failed}`);
  }
  logger.info(`📋 Total: ${tests.length}`);
  
  if (failed === 0) {
    logger.success('🎉 All validation tests passed! Knowledge Compiler is working correctly.');
  } else {
    logger.error('💥 Some validation tests failed. Check implementation.');
    process.exit(1);
  }
  
  return { passed, failed, total: tests.length };
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch((error) => {
    logger.error('Validation failed:', error);
    process.exit(1);
  });
}

export { runValidation };