/**
 * KGEN Filter Pipeline Validation Script
 * 
 * Node.js script to validate the complete filter pipeline connection
 * between UNJUCKS and KGEN deterministic and RDF filters.
 */

import { TemplateEngine } from '../../../packages/kgen-core/src/templating/template-engine.js';

console.log('🧪 KGEN Filter Pipeline Validation\n');

async function runTests() {
  let passedTests = 0;
  let totalTests = 0;
  
  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ ${message}`);
      passedTests++;
    } else {
      console.log(`❌ ${message}`);
    }
  }
  
  // Test 1: Basic Engine Creation
  console.log('📋 Test 1: Engine Creation and Filter Loading');
  const engine = new TemplateEngine({
    enableFilters: true,
    enableRDF: true,
    deterministic: true
  });
  
  const availableFilters = engine.getAvailableFilters();
  
  assert(availableFilters.deterministic.length === 39, 
    `Should load 39 deterministic filters (got ${availableFilters.deterministic.length})`);
    
  assert(availableFilters.rdf.length === 12, 
    `Should load 12 RDF filters (got ${availableFilters.rdf.length})`);
    
  assert(availableFilters.total === 51, 
    `Should have 51 total filters (got ${availableFilters.total})`);
  
  // Test 2: String Transformation Filters
  console.log('\n📋 Test 2: String Transformation Filters');
  
  const camelTest = await engine.renderString('{{ name | camelCase }}', { name: 'hello-world' });
  assert(camelTest.content === 'helloWorld', 
    `camelCase filter should work (got "${camelTest.content}")`);
  
  const pascalTest = await engine.renderString('{{ name | pascalCase }}', { name: 'hello-world' });
  assert(pascalTest.content === 'HelloWorld', 
    `pascalCase filter should work (got "${pascalTest.content}")`);
  
  const kebabTest = await engine.renderString('{{ name | kebabCase }}', { name: 'HelloWorld' });
  assert(kebabTest.content === 'hello-world', 
    `kebabCase filter should work (got "${kebabTest.content}")`);
  
  const snakeTest = await engine.renderString('{{ name | snakeCase }}', { name: 'HelloWorld' });
  assert(snakeTest.content === 'hello_world', 
    `snakeCase filter should work (got "${snakeTest.content}")`);
  
  const constantTest = await engine.renderString('{{ name | constantCase }}', { name: 'hello-world' });
  assert(constantTest.content === 'HELLO_WORLD', 
    `constantCase filter should work (got "${constantTest.content}")`);

  // Test 3: Hash Filters
  console.log('\n📋 Test 3: Hash Filters');
  
  const hashTest = await engine.renderString('{{ text | hash }}', { text: 'hello' });
  assert(hashTest.content.length === 64 && /^[a-f0-9]+$/.test(hashTest.content), 
    `hash filter should produce 64-char hex (got "${hashTest.content.substring(0, 16)}...")`);
  
  const shortHashTest = await engine.renderString('{{ text | shortHash }}', { text: 'hello' });
  assert(shortHashTest.content.length === 8 && /^[a-f0-9]+$/.test(shortHashTest.content), 
    `shortHash filter should produce 8-char hex (got "${shortHashTest.content}")`);

  // Test 4: Array/Object Filters
  console.log('\n📋 Test 4: Array and Object Filters');
  
  const uniqueTest = await engine.renderString('{{ items | unique }}', { items: [1, 2, 2, 3, 1] });
  assert(uniqueTest.content === '1,2,3', 
    `unique filter should work (got "${uniqueTest.content}")`);
  
  const sortTest = await engine.renderString('{{ items | sortBy }}', { items: ['c', 'a', 'b'] });
  assert(sortTest.content === 'a,b,c', 
    `sortBy filter should work (got "${sortTest.content}")`);

  // Test 5: Deterministic Behavior
  console.log('\n📋 Test 5: Deterministic Behavior');
  
  const data = { c: 3, a: 1, b: 2 };
  const render1 = await engine.renderString('{{ data | sortKeys | stringify }}', { data });
  const render2 = await engine.renderString('{{ data | sortKeys | stringify }}', { data });
  
  assert(render1.content === render2.content, 
    `Deterministic rendering should produce identical results`);
  
  assert(render1.content.includes('"a": 1') && render1.content.includes('"b": 2'), 
    `sortKeys filter should sort object keys consistently`);

  // Test 6: Filter Chaining
  console.log('\n📋 Test 6: Filter Chaining');
  
  const chainTest = await engine.renderString('{{ text | trim | camelCase | shortHash }}', 
    { text: '  hello world  ' });
  assert(chainTest.content.length === 8 && /^[a-f0-9]+$/.test(chainTest.content), 
    `Filter chaining should work (got "${chainTest.content}")`);

  // Test 7: RDF Filters Connection
  console.log('\n📋 Test 7: RDF Filters Connection');
  
  const namespaceTest = await engine.renderString('{{ "foaf" | rdfNamespace }}', {});
  assert(namespaceTest.content === 'http://xmlns.com/foaf/0.1/', 
    `rdfNamespace filter should work (got "${namespaceTest.content}")`);
  
  const compactTest = await engine.renderString('{{ "http://xmlns.com/foaf/0.1/Person" | rdfCompact }}', {});
  assert(compactTest.content === 'foaf:Person', 
    `rdfCompact filter should work (got "${compactTest.content}")`);

  // Test 8: RDF Store Integration
  console.log('\n📋 Test 8: RDF Store Integration');
  
  const testTriples = [
    {
      subject: { type: 'uri', value: 'http://example.org/Person1' },
      predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
      object: { type: 'literal', value: 'John Doe' }
    }
  ];
  
  engine.updateRDFStore(testTriples);
  
  const rdfQueryTest = await engine.renderString('{{ "http://example.org/Person1" | rdfLabel }}', {});
  assert(rdfQueryTest.content === 'John Doe', 
    `RDF store integration should work (got "${rdfQueryTest.content}")`);

  // Test 9: Global Filter Functions
  console.log('\n📋 Test 9: Global Filter Functions');
  
  const globalFilterTest = await engine.renderString('{{ applyFilter(text, "camelCase") }}', 
    { text: 'hello world' });
  assert(globalFilterTest.content === 'helloWorld', 
    `Global applyFilter function should work (got "${globalFilterTest.content}")`);

  // Test 10: Statistics and Tracking
  console.log('\n📋 Test 10: Statistics and Tracking');
  
  const stats = engine.getStats();
  assert(stats.filtersUsed.size > 0, 
    `Filter usage should be tracked (${stats.filtersUsed.size} unique filters used)`);
  
  assert(stats.renders > 0, 
    `Render count should be tracked (${stats.renders} renders)`);

  // Test 11: Custom Filter Addition
  console.log('\n📋 Test 11: Custom Filter Addition');
  
  engine.addFilter('customReverse', (str) => {
    return typeof str === 'string' ? str.split('').reverse().join('') : str;
  });
  
  const customTest = await engine.renderString('{{ text | customReverse }}', { text: 'hello' });
  assert(customTest.content === 'olleh', 
    `Custom filter should work (got "${customTest.content}")`);

  // Test 12: Error Handling
  console.log('\n📋 Test 12: Error Handling');
  
  const nullTest = await engine.renderString('{{ null | camelCase }}', {});
  assert(nullTest.content === '', 
    `Filters should handle null values gracefully`);

  // Final Results
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Filter pipeline is fully connected and working.');
    return true;
  } else {
    console.log('❌ Some tests failed. Filter pipeline needs attention.');
    return false;
  }
}

// Run the validation
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Validation failed with error:', error);
  process.exit(1);
});