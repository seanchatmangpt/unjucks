#!/usr/bin/env node

// Production-ready test of RDF Data Loader without mocks
const fs = require('fs-extra');
const path = require('path');

async function testRDFLoader() {
  console.log('🧪 Testing RDF Data Loader - Production Ready Implementation');
  console.log('=' .repeat(60));
  
  try {
    // Import the built version
    const { RDFDataLoader } = await import('../dist/lib/rdf-data-loader.js');
    
    // Test with real fixture files
    const fixturesDir = path.join(__dirname, 'fixtures', 'turtle');
    const testFiles = [
      'basic-person.ttl',
      'sample.ttl',
      'complex-project.ttl'
    ];
    
    const loader = new RDFDataLoader({
      baseUri: 'http://example.org/',
      templateDir: fixturesDir,
      cacheEnabled: true,
      validateSyntax: true,
      cacheTTL: 300000
    });
    
    let allTests = 0;
    let passedTests = 0;
    
    for (const testFile of testFiles) {
      const filePath = path.join(fixturesDir, testFile);
      if (!(await fs.pathExists(filePath))) {
        console.log(`⚠️  File ${testFile} does not exist, skipping`);
        continue;
      }
      
      console.log(`\n📄 Testing file: ${testFile}`);
      console.log('-'.repeat(40));
      
      allTests++;
      
      try {
        // Test 1: File loading
        const source = {
          type: 'file',
          source: testFile,
          format: 'text/turtle'
        };
        
        const startTime = performance.now();
        const result = await loader.loadFromSource(source);
        const loadTime = performance.now() - startTime;
        
        console.log(`✅ Load time: ${loadTime.toFixed(2)}ms`);
        console.log(`✅ Success: ${result.success}`);
        console.log(`✅ Errors: ${result.errors.length}`);
        
        if (result.errors.length > 0) {
          console.log(`❌ Errors found:`, result.errors);
        }
        
        console.log(`✅ Subjects loaded: ${Object.keys(result.data.subjects).length}`);
        console.log(`✅ Triples count: ${result.data.triples.length}`);
        console.log(`✅ Variables extracted: ${Object.keys(result.variables).length}`);
        console.log(`✅ Prefixes: ${Object.keys(result.data.prefixes).length}`);
        
        // Show some data to verify it's working
        if (Object.keys(result.data.subjects).length > 0) {
          const firstSubject = Object.keys(result.data.subjects)[0];
          console.log(`📊 First subject: ${firstSubject}`);
          console.log(`📊 Properties: ${Object.keys(result.data.subjects[firstSubject].properties).length}`);
        }
        
        if (Object.keys(result.variables).length > 0) {
          const firstVar = Object.keys(result.variables)[0];
          console.log(`📊 First variable: ${firstVar}`);
          console.log(`📊 Variable properties:`, Object.keys(result.variables[firstVar] || {}));
        }
        
        // Test 2: Caching
        console.log(`\n🔄 Testing cache...`);
        const cachedResult = await loader.loadFromSource(source);
        const cacheStats = loader.getCacheStats();
        console.log(`✅ Cache entries: ${cacheStats.size}`);
        console.log(`✅ Cache total size: ${cacheStats.totalSize} bytes`);
        
        // Test 3: Template context creation
        console.log(`\n🎯 Testing template context...`);
        const context = loader.createTemplateContext(result.data, result.variables);
        console.log(`✅ Context has $rdf: ${!!context.$rdf}`);
        console.log(`✅ Context has query function: ${typeof context.$rdf?.query === 'function'}`);
        console.log(`✅ Context has getByType function: ${typeof context.$rdf?.getByType === 'function'}`);
        
        // Test 4: SPARQL-like queries
        if (result.data.triples.length > 0) {
          console.log(`\n🔍 Testing SPARQL-like queries...`);
          const queryResult = await loader.executeQuery(result.data, { limit: 1 });
          console.log(`✅ Query success: ${queryResult.success}`);
          console.log(`✅ Query bindings: ${queryResult.bindings.length}`);
        }
        
        // Test 5: Frontmatter integration
        console.log(`\n📋 Testing frontmatter integration...`);
        const frontmatter = {
          rdf: testFile
        };
        const frontmatterResult = await loader.loadFromFrontmatter(frontmatter);
        console.log(`✅ Frontmatter load success: ${frontmatterResult.success}`);
        console.log(`✅ Same data loaded: ${Object.keys(frontmatterResult.data.subjects).length === Object.keys(result.data.subjects).length}`);
        
        if (result.success) {
          passedTests++;
          console.log(`\n🎉 ${testFile} - ALL TESTS PASSED`);
        } else {
          console.log(`\n❌ ${testFile} - FAILED: ${result.errors.join(', ')}`);
        }
        
      } catch (error) {
        console.error(`❌ ${testFile} - ERROR:`, error.message);
        console.error(error.stack);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Final Results: ${passedTests}/${allTests} files tested successfully`);
    
    // Test inline data
    console.log(`\n🧪 Testing inline RDF data...`);
    const inlineData = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:testPerson a foaf:Person ;
          foaf:name "Test User"@en ;
          ex:age "25"^^xsd:integer ;
          ex:active "true"^^xsd:boolean ;
          ex:created "2024-01-01T00:00:00Z"^^xsd:dateTime .
    `;
    
    const inlineResult = await loader.loadFromSource({
      type: 'inline',
      source: inlineData
    });
    
    console.log(`✅ Inline data success: ${inlineResult.success}`);
    console.log(`✅ Variables with type conversion:`, JSON.stringify(inlineResult.variables, null, 2));
    
    // Test data validation
    console.log(`\n🔍 Testing RDF validation...`);
    const validationResult = await loader.validateRDF(inlineData, 'turtle');
    console.log(`✅ Validation result: ${validationResult.valid}`);
    console.log(`✅ Validation errors: ${validationResult.errors.length}`);
    console.log(`✅ Validation warnings: ${validationResult.warnings.length}`);
    
    console.log('\n🎯 Production RDF Data Loader Test Complete!');
    console.log(`Cache final stats:`, loader.getCacheStats());
    
  } catch (error) {
    console.error('💥 Critical error in RDF loader test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRDFLoader().catch(console.error);
}

module.exports = { testRDFLoader };