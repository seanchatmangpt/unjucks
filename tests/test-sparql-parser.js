#!/usr/bin/env node

/**
 * Test SPARQL parser output to understand the structure
 */

import * as sparqljs from 'sparqljs';

function testParser() {
  const parser = new sparqljs.Parser();
  
  const queries = [
    'SELECT * WHERE { ?s ?p ?o } LIMIT 3',
    'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 3',
    'ASK { ?s ?p ?o }'
  ];
  
  queries.forEach((query, index) => {
    console.log(`\n=== Query ${index + 1}: ${query} ===`);
    
    try {
      const parsed = parser.parse(query);
      console.log('Parsed structure:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (error) {
      console.error('Parse error:', error);
    }
  });
}

testParser();