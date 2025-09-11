#!/usr/bin/env node

/**
 * Debug rule application process
 */

import { KnowledgeCompiler } from './knowledge-compiler-v2.js';

async function debugRuleApplication() {
  console.log('=== Debugging Rule Application Process ===\n');
  
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
  
  // Load graph into store
  const store = await compiler._loadRDFGraph(graph);
  console.log(`Store loaded with ${store.size} quads`);
  
  // Apply single rule
  console.log('\n=== Testing Single Rule Application ===');
  const rule = rules[0];
  const newFacts = await compiler._applyN3Rule(store, rule);
  console.log(`Generated ${newFacts.length} new facts`);
  
  for (const fact of newFacts) {
    console.log('New fact:', {
      subject: fact.subject.value,
      predicate: fact.predicate.value,
      object: fact.object.value,
      objectType: fact.object.termType
    });
  }
  
  // Test full N3 rule processing
  console.log('\n=== Testing Full N3 Rule Processing ===');
  const inferredFacts = await compiler._processN3Rules(store, rules);
  console.log(`N3 processing generated ${inferredFacts.length} inferred facts`);
  
  for (const fact of inferredFacts) {
    console.log('Inferred fact:', {
      subject: fact.subject.value,
      predicate: fact.predicate.value,
      object: fact.object.value,
      objectType: fact.object.termType
    });
  }
  
  // Check store after processing
  console.log(`\nStore now has ${store.size} quads after rule processing`);
  
  // Test context compilation
  console.log('\n=== Testing Context Compilation ===');
  const context = await compiler._compileContextObject({}, inferredFacts);
  console.log('Compiled context facts:', JSON.stringify(context.facts, null, 2));
  console.log('Context metadata:', JSON.stringify(context.metadata, null, 2));
}

debugRuleApplication().catch(console.error);