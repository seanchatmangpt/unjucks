#!/usr/bin/env node

/**
 * Debug binding finding process
 */

import { KnowledgeCompiler } from './knowledge-compiler-v2.js';
import { Store, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

async function debugBindings() {
  console.log('=== Debugging Binding Process ===\n');
  
  const compiler = new KnowledgeCompiler();
  await compiler.initialize();
  
  // Create store and add the test triple
  const store = new Store();
  const testQuad = quad(
    namedNode('http://unjucks.dev/api/endpoint1'),
    namedNode('http://unjucks.dev/api/isPublic'),
    literal('true', namedNode('http://www.w3.org/2001/XMLSchema#boolean'))
  );
  
  store.addQuad(testQuad);
  console.log('Added quad to store:', {
    subject: testQuad.subject.value,
    predicate: testQuad.predicate.value,
    object: testQuad.object.value,
    objectType: testQuad.object.termType,
    datatype: testQuad.object.datatype?.value
  });
  
  // Test pattern matching
  const condition = {
    subject: '?endpoint',
    predicate: 'http://unjucks.dev/api/isPublic',
    object: 'true'
  };
  
  console.log('\nTesting condition:', condition);
  
  // Test with empty binding
  const emptyBinding = {};
  const boundCondition = compiler._applyBinding(condition, emptyBinding);
  console.log('Bound condition:', boundCondition);
  
  const matchingQuads = compiler._findMatchingQuads(store, boundCondition);
  console.log(`Found ${matchingQuads.length} matching quads`);
  
  for (const quad of matchingQuads) {
    console.log('Matching quad:', {
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value,
      objectType: quad.object.termType
    });
  }
  
  // Test manual quad matching
  console.log('\n=== Manual Quad Matching Test ===');
  const manualQuads = store.getQuads(
    null,
    namedNode('http://unjucks.dev/api/isPublic'),
    literal('true', namedNode('http://www.w3.org/2001/XMLSchema#boolean'))
  );
  console.log(`Manual matching found ${manualQuads.length} quads`);
  
  // Test different literal matching approaches
  console.log('\n=== Testing Different Literal Types ===');
  
  const testLiterals = [
    literal('true'),
    literal('true', namedNode('http://www.w3.org/2001/XMLSchema#boolean')),
    literal('true', 'http://www.w3.org/2001/XMLSchema#boolean')
  ];
  
  for (let i = 0; i < testLiterals.length; i++) {
    const testLiteral = testLiterals[i];
    const results = store.getQuads(null, null, testLiteral);
    console.log(`Literal ${i} (${testLiteral.value}, ${testLiteral.datatype?.value || 'no datatype'}): ${results.length} matches`);
  }
  
  // Test the full binding process
  console.log('\n=== Testing Full Binding Process ===');
  const conditions = [condition];
  const bindings = await compiler._findBindings(store, conditions);
  console.log('Final bindings:', JSON.stringify(bindings, null, 2));
}

debugBindings().catch(console.error);