/**
 * Simple Word Processor Tests
 * Basic validation of the Word processor implementation
 */

import { WordProcessor, createWordProcessor, getCapabilities } from '../../src/office/processors/word-processor.js';
import { promises as fs } from 'fs';
import path from 'path';

console.log('\n🚀 Running Simple Word Processor Tests');
console.log('======================================');

async function runSimpleTests() {
  let testsPassed = 0;
  let testsTotal = 0;
  const errors = [];
  
  function test(name, testFn) {
    testsTotal++;
    try {
      console.log(`\n  ${testsTotal}. ${name}`);
      testFn();
      console.log('     ✅ PASSED');
      testsPassed++;
    } catch (error) {
      console.log(`     ❌ FAILED: ${error.message}`);
      errors.push({ name, error: error.message });
    }
  }
  
  async function asyncTest(name, testFn) {
    testsTotal++;
    try {
      console.log(`\n  ${testsTotal}. ${name}`);
      await testFn();
      console.log('     ✅ PASSED');
      testsPassed++;
    } catch (error) {
      console.log(`     ❌ FAILED: ${error.message}`);
      errors.push({ name, error: error.message });
    }
  }
  
  // Test 1: Basic instantiation
  test('Should create WordProcessor instance', () => {
    const processor = new WordProcessor();
    if (!(processor instanceof WordProcessor)) {
      throw new Error('Not instance of WordProcessor');
    }
    if (processor.stats.documentsProcessed !== 0) {
      throw new Error('Initial stats incorrect');
    }
  });
  
  // Test 2: Options configuration
  test('Should accept custom options', () => {
    const processor = new WordProcessor({
      enableImages: false,
      strictMode: true,
      logger: console
    });
    if (processor.options.enableImages !== false) {
      throw new Error('enableImages option not set');
    }
    if (processor.options.strictMode !== true) {
      throw new Error('strictMode option not set');
    }
  });
  
  // Test 3: Dependency status
  test('Should return dependency status', () => {
    const processor = new WordProcessor();
    const status = processor.getDependencyStatus();
    
    if (typeof status.docxtemplater !== 'boolean') {
      throw new Error('Missing docxtemplater status');
    }
    if (typeof status.fallbackMode !== 'boolean') {
      throw new Error('Missing fallbackMode status');
    }
  });
  
  // Test 4: Capabilities function
  test('Should provide capabilities', () => {
    const capabilities = getCapabilities();
    if (typeof capabilities.fallbackMode !== 'boolean') {
      throw new Error('Capabilities missing fallback mode');
    }
  });
  
  // Test 5: Factory function
  test('Should create via factory function', () => {
    const processor = createWordProcessor({ enableLoops: false });
    if (!(processor instanceof WordProcessor)) {
      throw new Error('Factory did not create WordProcessor instance');
    }
    if (processor.options.enableLoops !== false) {
      throw new Error('Factory options not applied');
    }
  });
  
  // Test 6: Statistics tracking
  test('Should track statistics', () => {
    const processor = new WordProcessor();
    const stats = processor.getStats();
    
    const requiredProps = ['documentsProcessed', 'variablesReplaced', 'cacheSize', 'dependencyStatus'];
    for (const prop of requiredProps) {
      if (!(prop in stats)) {
        throw new Error(`Missing stats property: ${prop}`);
      }
    }
  });
  
  // Test 7: Cache management
  test('Should clear cache', () => {
    const processor = new WordProcessor();
    processor.templateCache.set('test', 'value');
    processor.stats.documentsProcessed = 5;
    
    if (processor.templateCache.size !== 1) {
      throw new Error('Cache not populated');
    }
    
    processor.clear(true);
    
    if (processor.templateCache.size !== 0) {
      throw new Error('Cache not cleared');
    }
    if (processor.stats.documentsProcessed !== 0) {
      throw new Error('Stats not reset');
    }
  });
  
  // Test 8: Variable pattern recognition
  test('Should recognize variable patterns', () => {
    const patterns = WordProcessor.VARIABLE_PATTERNS;
    
    if (!patterns.DOUBLE_BRACE || !patterns.SINGLE_BRACE) {
      throw new Error('Missing variable patterns');
    }
    
    // Test double brace pattern
    const doubleBraceMatch = '{{testVar}}'.match(patterns.DOUBLE_BRACE);
    if (!doubleBraceMatch) {
      throw new Error('Double brace pattern not working');
    }
    
    // Test single brace pattern  
    const singleBraceMatch = '{testVar}'.match(patterns.SINGLE_BRACE);
    if (!singleBraceMatch) {
      throw new Error('Single brace pattern not working');
    }
  });
  
  // Test 9: Error handling in processing (async)
  await asyncTest('Should handle processing errors gracefully', async () => {
    const processor = new WordProcessor({ strictMode: false });
    
    try {
      const result = await processor.processDocument('/nonexistent/template.docx', {});
      // Should either throw or return error result
      if (result && result.success === true) {
        throw new Error('Should have failed for nonexistent file');
      }
    } catch (error) {
      // Expected behavior - error should be handled
      if (!error.message.includes('ENOENT') && !error.message.includes('no such file')) {
        throw new Error('Unexpected error type: ' + error.message);
      }
    }
  });
  
  // Test 10: Variable extraction from text
  await asyncTest('Should attempt variable extraction', async () => {
    const processor = new WordProcessor();
    
    // Create a temporary text file with variables
    const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'office');
    await fs.mkdir(testDir, { recursive: true });
    
    const testContent = 'Hello {{name}}, welcome to {company}!';
    const testFile = path.join(testDir, 'test-variables.txt');
    await fs.writeFile(testFile, testContent);
    
    try {
      const variables = await processor.extractVariables(testFile);
      
      if (!Array.isArray(variables)) {
        throw new Error('Should return array of variables');
      }
      
      console.log(`     Found ${variables.length} variables`);
      
    } catch (error) {
      // Expected in fallback mode
      if (error.message.includes('docxtemplater')) {
        console.log('     Expected failure in fallback mode');
      } else {
        throw error;
      }
    } finally {
      // Cleanup
      try {
        await fs.unlink(testFile);
        await fs.rmdir(testDir, { recursive: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total tests: ${testsTotal}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsTotal - testsPassed}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Failures:');
    errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.name}: ${error.error}`);
    });
  }
  
  // Show dependency status
  const processor = new WordProcessor();
  const status = processor.getDependencyStatus();
  
  console.log('\n📦 Dependency Status:');
  console.log(`  DocxTemplater: ${status.docxtemplater ? '✅ Available' : '❌ Missing'}`);
  console.log(`  PizZip: ${status.pizzip ? '✅ Available' : '❌ Missing'}`);
  console.log(`  Image Module: ${status.imageModule ? '✅ Available' : '❌ Missing'}`);
  console.log(`  Fallback Mode: ${status.fallbackMode ? '⚠️  Active' : '✅ Disabled'}`);
  
  if (status.fallbackMode) {
    console.log('\n💡 To enable full functionality:');
    console.log('   npm install docxtemplater pizzip');
    console.log('   npm install docxtemplater-image-module-free');
  }
  
  console.log('\n' + (testsPassed === testsTotal ? '🎉 All tests passed!' : `⚠️  ${testsTotal - testsPassed} tests failed`));
  
  return { testsPassed, testsTotal, errors };
}

// Run the tests
runSimpleTests().catch(console.error);