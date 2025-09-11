#!/usr/bin/env node

/**
 * Debug N3 Rule Processing
 * Investigate why rule inference is not working
 */

import { KnowledgeCompiler } from './knowledge-compiler.js';
import { consola } from 'consola';

const logger = consola.withTag('debug');

async function debugRuleProcessing() {
  logger.info('Debugging N3 rule processing...');
  
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
  
  logger.info('Input graph:', JSON.stringify(graph, null, 2));
  logger.info('Input rules:', JSON.stringify(rules, null, 2));
  
  // Test rule parsing
  const parsedRule = compiler._parseN3Rule(rules[0]);
  logger.info('Parsed rule:', JSON.stringify(parsedRule, null, 2));
  
  // Load graph into store
  const store = await compiler._loadRDFGraph(graph);
  logger.info(`Store loaded with ${store.size} quads`);
  
  // Debug: list all quads in store
  const allQuads = store.getQuads();
  logger.info('All quads in store:');
  for (const quad of allQuads) {
    logger.info(`  S: ${quad.subject.value}, P: ${quad.predicate.value}, O: ${quad.object.value} (${quad.object.termType})`);
  }
  
  // Test condition matching
  const conditions = parsedRule.conditions;
  logger.info('Testing conditions:', JSON.stringify(conditions, null, 2));
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    logger.info(`Testing condition ${i}:`, JSON.stringify(condition, null, 2));
    
    const matchingQuads = compiler._findMatchingQuads(store, condition);
    logger.info(`Found ${matchingQuads.length} matching quads for condition ${i}`);
    
    for (const quad of matchingQuads) {
      logger.info(`  Match: S: ${quad.subject.value}, P: ${quad.predicate.value}, O: ${quad.object.value}`);
    }
  }
  
  // Test full bindings
  const bindings = await compiler._findBindings(store, conditions);
  logger.info(`Found ${bindings.length} bindings:`, JSON.stringify(bindings, null, 2));
  
  // Test rule application
  const ruleFacts = await compiler._applyN3Rule(store, rules[0]);
  logger.info(`Generated ${ruleFacts.length} new facts`);
  
  for (const fact of ruleFacts) {
    logger.info(`  New fact: S: ${fact.subject.value}, P: ${fact.predicate.value}, O: ${fact.object.value}`);
  }
  
  // Test full context compilation
  const context = await compiler.compileContext(graph, rules);
  logger.info('Final context facts:', JSON.stringify(context.facts, null, 2));
}

debugRuleProcessing().catch(console.error);