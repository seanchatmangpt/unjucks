#!/usr/bin/env node

/**
 * Debug conclusion instantiation
 */

import { KnowledgeCompiler } from './knowledge-compiler-v2.js';

async function debugConclusionInstantiation() {
  console.log('=== Debugging Conclusion Instantiation ===\n');
  
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
  
  const rule = {
    body: `{
      ?endpoint <http://unjucks.dev/api/isPublic> true
    } => {
      ?endpoint <http://unjucks.dev/api/requiresAuth> true
    }`
  };
  
  // Load graph into store
  const store = await compiler._loadRDFGraph(graph);
  
  // Parse the rule
  const { conditions, conclusions } = compiler._parseN3Rule(rule);
  console.log('Conditions:', JSON.stringify(conditions, null, 2));
  console.log('Conclusions:', JSON.stringify(conclusions, null, 2));
  
  // Find bindings
  const bindings = await compiler._findBindings(store, conditions);
  console.log('Bindings:', JSON.stringify(bindings, null, 2));
  
  // Test conclusion instantiation for each binding
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    console.log(`\n=== Testing Binding ${i} ===`);
    console.log('Binding:', JSON.stringify(binding, null, 2));
    
    // Test each conclusion
    for (let j = 0; j < conclusions.length; j++) {
      const conclusion = conclusions[j];
      console.log(`\nConclusion ${j}:`, JSON.stringify(conclusion, null, 2));
      
      // Apply binding to conclusion
      const boundConclusion = compiler._applyBinding(conclusion, binding);
      console.log('Bound conclusion:', JSON.stringify(boundConclusion, null, 2));
      
      // Test instantiation
      try {
        const conclusionFacts = compiler._instantiateConclusions([conclusion], binding);
        console.log(`Generated ${conclusionFacts.length} conclusion facts`);
        
        for (const fact of conclusionFacts) {
          console.log('Conclusion fact:', {
            subject: fact.subject.value,
            predicate: fact.predicate.value,
            object: fact.object.value,
            objectType: fact.object.termType,
            datatype: fact.object.datatype?.value
          });
        }
      } catch (error) {
        console.error('Error instantiating conclusions:', error);
      }
    }
  }
  
  // Test full rule application step by step
  console.log('\n=== Full Rule Application Step by Step ===');
  try {
    const newFacts = [];
    
    // Find variable bindings that satisfy conditions
    const ruleBindings = await compiler._findBindings(store, conditions);
    console.log(`Found ${ruleBindings.length} bindings`);
    
    // Generate conclusions for each binding
    for (const binding of ruleBindings) {
      console.log('Processing binding:', JSON.stringify(binding, null, 2));
      const conclusionFacts = compiler._instantiateConclusions(conclusions, binding);
      console.log(`Generated ${conclusionFacts.length} conclusion facts for this binding`);
      newFacts.push(...conclusionFacts);
    }
    
    console.log(`Total new facts generated: ${newFacts.length}`);
    
  } catch (error) {
    console.error('Error in step-by-step rule application:', error);
  }
}

debugConclusionInstantiation().catch(console.error);