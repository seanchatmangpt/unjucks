#!/usr/bin/env node

/**
 * Test the fixed Knowledge Compiler
 */

import { KnowledgeCompiler } from './knowledge-compiler-v2.js';
import { consola } from 'consola';

const logger = consola.withTag('test');

async function testFixedCompiler() {
  logger.info('Testing fixed Knowledge Compiler...');
  
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
  
  logger.info('Testing rule parsing...');
  const parsedRule = compiler._parseN3Rule(rules[0]);
  logger.info('Parsed rule:', JSON.stringify(parsedRule, null, 2));
  
  logger.info('Testing full compilation...');
  const context = await compiler.compileContext(graph, rules);
  
  logger.info('Context facts:', JSON.stringify(context.facts, null, 2));
  
  // Check if rule inference worked
  const facts = context.facts['http://unjucks.dev/api/endpoint1'];
  if (facts && facts['http://unjucks.dev/api/requiresAuth'] === true) {
    logger.success('✅ Rule inference worked! Generated expected fact.');
    return true;
  } else {
    logger.error('❌ Rule inference failed. Expected fact not found.');
    return false;
  }
}

testFixedCompiler().then(success => {
  if (success) {
    logger.success('🎉 Fixed Knowledge Compiler is working!');
  } else {
    logger.error('💥 Fixed Knowledge Compiler still has issues.');
    process.exit(1);
  }
}).catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});