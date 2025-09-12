#!/usr/bin/env node

/**
 * RDF Enhancement Integration Test
 * 
 * Tests the enhanced RDF processing components that replace the naive
 * implementations in bin/kgen.mjs.
 */

import { StandaloneKGenBridge } from '../../src/kgen/rdf/index.js';
import fs from 'fs/promises';
import { consola } from 'consola';

const TEST_RDF_CONTENT = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice foaf:name "Alice" ;
    foaf:age 30 ;
    foaf:knows ex:bob .

ex:bob foaf:name "Bob" ;
    foaf:age 25 .
`;

async function runTests() {
  consola.info('🧪 Testing Enhanced RDF Processing');
  
  const bridge = new StandaloneKGenBridge();
  let testFile = null;
  
  try {
    // Create test file
    testFile = 'test-graph.ttl';
    await fs.writeFile(testFile, TEST_RDF_CONTENT, 'utf8');
    
    // Test 1: Enhanced graphHash
    consola.start('Testing enhanced graphHash...');
    const hashResult = await bridge.graphHash(testFile);
    
    if (hashResult.success) {
      consola.success('✅ graphHash working:', {
        hash: hashResult.hash.substring(0, 16) + '...',
        size: hashResult.size
      });
    } else {
      consola.error('❌ graphHash failed:', hashResult.error);
      return false;
    }
    
    // Test 2: Enhanced graphIndex
    consola.start('Testing enhanced graphIndex...');
    const indexResult = await bridge.graphIndex(testFile);
    
    if (indexResult.success) {
      consola.success('✅ graphIndex working:', {
        triples: indexResult.triples,
        subjects: indexResult.subjects,
        predicates: indexResult.predicates
      });
    } else {
      consola.error('❌ graphIndex failed:', indexResult.error);
      return false;
    }
    
    // Test 3: Enhanced graphDiff (compare file with itself)
    consola.start('Testing enhanced graphDiff...');
    const diffResult = await bridge.graphDiff(testFile, testFile);
    
    if (diffResult.success) {
      consola.success('✅ graphDiff working:', {
        identical: diffResult.identical,
        differences: diffResult.differences
      });
    } else {
      consola.error('❌ graphDiff failed:', diffResult.error);
      return false;
    }
    
    // Test 4: Enhanced artifactGenerate
    consola.start('Testing enhanced artifactGenerate...');
    const artifactResult = await bridge.artifactGenerate(testFile, 'test-template');
    
    if (artifactResult.success) {
      consola.success('✅ artifactGenerate working:', {
        graphHash: artifactResult.graphHash?.substring(0, 16) + '...',
        hasSemanticInfo: !!artifactResult._semantic
      });
    } else {
      consola.error('❌ artifactGenerate failed:', artifactResult.error);
      return false;
    }
    
    // Test 5: Status check
    const status = await bridge.getStatus();
    consola.info('Bridge status:', status.mode);
    
    consola.success('🎉 All RDF enhancement tests passed!');
    return true;
    
  } catch (error) {
    consola.error('Test failed with exception:', error);
    return false;
  } finally {
    // Cleanup
    if (testFile) {
      await fs.unlink(testFile).catch(() => {});
    }
    
    await bridge.shutdown();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests };