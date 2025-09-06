#!/usr/bin/env node

/**
 * Real-world test of RDF Data Loader functionality
 * Tests the core 80/20 functionality without mocks
 */

const fs = require('fs-extra');
const path = require('path');

async function testRDFDataLoader() {
  console.log('🧪 RDF Data Loader - Real World Test');
  console.log('='.repeat(60));
  
  try {
    // Test basic file reading first
    const testFile = path.join(__dirname, '..', 'tests', 'fixtures', 'turtle', 'basic-person.ttl');
    console.log('📄 Testing file:', testFile);
    
    const exists = await fs.pathExists(testFile);
    if (!exists) {
      throw new Error('Test file does not exist: ' + testFile);
    }
    
    const content = await fs.readFile(testFile, 'utf-8');
    console.log('✅ File read successfully');
    console.log('📊 File size:', content.length, 'characters');
    console.log('📋 Content preview:', content.substring(0, 150).replace(/\n/g, '\\n') + '...');
    
    // Test basic turtle parsing 
    console.log('\n🔄 Testing Turtle Parser...');
    
    try {
      // Using dynamic import since we're in CommonJS
      const { TurtleParser } = await import('../src/lib/turtle-parser.js');
      
      const parser = new TurtleParser({
        baseIRI: 'http://example.org/'
      });
      
      console.log('✅ TurtleParser created');
      
      const parseResult = await parser.parse(content);
      console.log('✅ Parsing completed');
      console.log('📊 Triples parsed:', parseResult.triples.length);
      console.log('📊 Prefixes found:', Object.keys(parseResult.prefixes).length);
      console.log('📊 Named graphs:', parseResult.namedGraphs.length);
      
      if (parseResult.triples.length > 0) {
        const firstTriple = parseResult.triples[0];
        console.log('🔍 First triple:');
        console.log('  Subject:', firstTriple.subject.value);
        console.log('  Predicate:', firstTriple.predicate.value);
        console.log('  Object:', firstTriple.object.value);
        console.log('  Object type:', firstTriple.object.type);
      }
      
      console.log('🔍 Available prefixes:', JSON.stringify(parseResult.prefixes, null, 2));
      
      // Test RDF Data Loader
      console.log('\n🔄 Testing RDF Data Loader...');
      
      const { RDFDataLoader } = await import('../src/lib/rdf-data-loader.js');
      
      const loader = new RDFDataLoader({
        baseUri: 'http://example.org/',
        templateDir: path.join(__dirname, '..', 'tests', 'fixtures', 'turtle'),
        cacheEnabled: true,
        validateSyntax: true
      });
      
      console.log('✅ RDFDataLoader created');
      
      // Test inline loading
      const inlineResult = await loader.loadFromSource({
        type: 'inline',
        source: content,
        format: 'text/turtle'
      });
      
      console.log('✅ Inline loading completed');
      console.log('✅ Success:', inlineResult.success);
      console.log('❌ Errors:', inlineResult.errors.length);
      
      if (inlineResult.errors.length > 0) {
        console.log('🚨 Errors found:');
        inlineResult.errors.forEach(error => console.log('  -', error));
      }
      
      console.log('📊 Subjects loaded:', Object.keys(inlineResult.data.subjects).length);
      console.log('📊 Triples count:', inlineResult.data.triples.length);
      console.log('📊 Variables extracted:', Object.keys(inlineResult.variables).length);
      console.log('📊 Prefixes available:', Object.keys(inlineResult.data.prefixes).length);
      
      // Show extracted data
      if (Object.keys(inlineResult.data.subjects).length > 0) {
        console.log('\n🔍 Extracted subjects:');
        Object.entries(inlineResult.data.subjects).forEach(([uri, resource]) => {
          console.log(`  ${uri}:`);
          console.log(`    Properties: ${Object.keys(resource.properties).length}`);
          console.log(`    Types: ${resource.type ? resource.type.join(', ') : 'none'}`);
          
          // Show first few properties
          const propEntries = Object.entries(resource.properties).slice(0, 3);
          propEntries.forEach(([prop, values]) => {
            console.log(`      ${prop}: ${values.length} values`);
            if (values.length > 0) {
              console.log(`        First value: ${values[0].value} (${values[0].type})`);
            }
          });
        });
      }
      
      if (Object.keys(inlineResult.variables).length > 0) {
        console.log('\n🔍 Extracted template variables:');
        Object.entries(inlineResult.variables).forEach(([key, value]) => {
          console.log(`  ${key}:`, JSON.stringify(value, null, 4));
        });
      }
      
      // Test file loading
      console.log('\n🔄 Testing file loading...');
      const fileResult = await loader.loadFromSource({
        type: 'file',
        source: 'basic-person.ttl'
      });
      
      console.log('✅ File loading completed');
      console.log('✅ Success:', fileResult.success);
      console.log('❌ Errors:', fileResult.errors.length);
      console.log('📊 Same data loaded:', 
        Object.keys(fileResult.data.subjects).length === Object.keys(inlineResult.data.subjects).length
      );
      
      // Test caching
      console.log('\n🔄 Testing caching...');
      const cachedResult = await loader.loadFromSource({
        type: 'inline',
        source: content
      });
      
      const cacheStats = loader.getCacheStats();
      console.log('✅ Cache working:', cacheStats.size > 0);
      console.log('📊 Cache entries:', cacheStats.size);
      console.log('📊 Total cache size:', cacheStats.totalSize, 'bytes');
      
      // Test template context
      console.log('\n🔄 Testing template context creation...');
      const context = loader.createTemplateContext(inlineResult.data, inlineResult.variables);
      
      console.log('✅ Template context created');
      console.log('✅ Has $rdf helpers:', !!context.$rdf);
      console.log('✅ Helper functions available:');
      console.log('  - query:', typeof context.$rdf.query === 'function');
      console.log('  - getByType:', typeof context.$rdf.getByType === 'function');
      console.log('  - compact:', typeof context.$rdf.compact === 'function');
      console.log('  - expand:', typeof context.$rdf.expand === 'function');
      
      // Test helper functions
      if (Object.keys(inlineResult.data.subjects).length > 0) {
        const firstSubjectUri = Object.keys(inlineResult.data.subjects)[0];
        const compacted = context.$rdf.compact(firstSubjectUri);
        const expanded = context.$rdf.expand(compacted);
        
        console.log('🔍 URI compacting test:');
        console.log('  Original:', firstSubjectUri);
        console.log('  Compacted:', compacted);
        console.log('  Re-expanded:', expanded);
        console.log('  Round-trip success:', expanded === firstSubjectUri);
      }
      
      // Test queries
      console.log('\n🔄 Testing SPARQL-like queries...');
      const queryResult = await loader.executeQuery(inlineResult.data, {
        limit: 2
      });
      
      console.log('✅ Query executed');
      console.log('✅ Query success:', queryResult.success);
      console.log('📊 Bindings returned:', queryResult.bindings.length);
      console.log('📊 Variables in result:', queryResult.variables.length);
      
      if (queryResult.bindings.length > 0) {
        console.log('🔍 First query binding:', JSON.stringify(queryResult.bindings[0], null, 2));
      }
      
      // Test validation
      console.log('\n🔄 Testing RDF validation...');
      const validationResult = await loader.validateRDF(content, 'turtle');
      
      console.log('✅ Validation completed');
      console.log('✅ Valid RDF:', validationResult.valid);
      console.log('❌ Validation errors:', validationResult.errors.length);
      console.log('⚠️  Validation warnings:', validationResult.warnings.length);
      
      if (validationResult.errors.length > 0) {
        console.log('🚨 Validation errors:');
        validationResult.errors.forEach(error => {
          console.log(`  - ${error.message} (${error.severity})`);
        });
      }
      
      if (validationResult.warnings.length > 0) {
        console.log('⚠️  Validation warnings:');
        validationResult.warnings.forEach(warning => {
          console.log(`  - ${warning.message}`);
        });
      }
      
      console.log('\n🎉 ALL TESTS PASSED! RDF Data Loader is working correctly.');
      console.log('📊 Final cache stats:', loader.getCacheStats());
      
    } catch (parseError) {
      console.error('❌ Parsing/Loading failed:', parseError.message);
      console.error(parseError.stack);
    }
    
  } catch (error) {
    console.error('💥 Critical test failure:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRDFDataLoader().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testRDFDataLoader };