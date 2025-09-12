#!/usr/bin/env node

/**
 * RDF Semantic Integration Test
 * 
 * Comprehensive test to verify enhanced RDF processing integration
 * Tests the StandaloneKGenBridge and enhanced CLI functionality
 */

import { StandaloneKGenBridge } from './standalone-bridge.js';
import { EnhancedRDFProcessor } from './enhanced-processor.js';
import { CanonicalRDFProcessor } from './canonical-processor.js';
import { GraphIndexer } from './graph-indexer.js';
import fs from 'fs/promises';
import path from 'path';
import { consola } from 'consola';

/**
 * Test RDF data samples
 */
const testRDF1 = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:age 30 ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob Jones" ;
    foaf:age 25 .
`;

const testRDF2 = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:bob a foaf:Person ;
    foaf:name "Bob Jones" ;
    foaf:age 25 .
    
ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:age 30 ;
    foaf:knows ex:bob .
`;

const testRDF3 = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:age 31 ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob Jones" ;
    foaf:age 25 .
`;

class RDFIntegrationTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
    
    this.tempDir = '/tmp/kgen-test';
  }
  
  /**
   * Run all integration tests
   */
  async runTests() {
    consola.start('🧪 Starting RDF Semantic Integration Tests...');
    
    try {
      // Setup test environment
      await this.setupTestEnv();
      
      // Test individual components
      await this.testCanonicalProcessor();
      await this.testGraphIndexer();
      await this.testEnhancedProcessor();
      
      // Test integration bridge
      await this.testStandaloneBridge();
      
      // Test CLI integration scenarios
      await this.testCLIIntegration();
      
      // Cleanup
      await this.cleanup();
      
      this.printResults();
      
    } catch (error) {
      consola.error('Test suite failed:', error);
      this.testResults.errors.push(error.message);
      this.printResults();
      process.exit(1);
    }
  }
  
  /**
   * Setup test environment
   */
  async setupTestEnv() {
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // Create test RDF files
    await fs.writeFile(path.join(this.tempDir, 'test1.ttl'), testRDF1);
    await fs.writeFile(path.join(this.tempDir, 'test2.ttl'), testRDF2);
    await fs.writeFile(path.join(this.tempDir, 'test3.ttl'), testRDF3);
    
    consola.success('✅ Test environment setup complete');
  }
  
  /**
   * Test CanonicalRDFProcessor
   */
  async testCanonicalProcessor() {
    consola.info('🔍 Testing CanonicalRDFProcessor...');
    
    try {
      const processor = new CanonicalRDFProcessor();
      
      // Test parsing
      const parseResult1 = await processor.parseRDF(testRDF1, 'turtle');
      const parseResult2 = await processor.parseRDF(testRDF2, 'turtle');
      
      this.assert(parseResult1.valid, 'Parse result 1 should be valid');
      this.assert(parseResult2.valid, 'Parse result 2 should be valid');
      this.assert(parseResult1.count > 0, 'Should parse triples');
      
      // Test canonical hashing
      const hash1 = await processor.generateCanonicalHash(parseResult1.quads);
      const hash2 = await processor.generateCanonicalHash(parseResult2.quads);
      
      this.assert(hash1.hash === hash2.hash, 'Semantically equivalent graphs should have same canonical hash');
      
      // Test graph comparison
      const comparison = await processor.compareGraphs(parseResult1.quads, parseResult2.quads);
      this.assert(comparison.semanticallyEquivalent, 'Reordered graphs should be semantically equivalent');
      
      consola.success('✅ CanonicalRDFProcessor tests passed');
      
    } catch (error) {
      this.fail('CanonicalRDFProcessor test failed', error);
    }
  }
  
  /**
   * Test GraphIndexer
   */
  async testGraphIndexer() {
    consola.info('🔍 Testing GraphIndexer...');
    
    try {
      const indexer = new GraphIndexer();
      const processor = new CanonicalRDFProcessor();
      
      const parseResult = await processor.parseRDF(testRDF1, 'turtle');
      const indexResult = await indexer.indexQuads(parseResult.quads);
      
      this.assert(indexResult.success, 'Indexing should succeed');
      this.assert(indexResult.indexed > 0, 'Should index triples');
      
      const report = indexer.generateReport();
      this.assert(report.summary.statistics.totalTriples > 0, 'Should have triple statistics');
      this.assert(report.summary.statistics.uniqueSubjects > 0, 'Should have subject count');
      
      // Test type queries
      const typeResults = indexer.findByType('http://xmlns.com/foaf/0.1/Person');
      this.assert(typeResults.count > 0, 'Should find Person instances');
      
      consola.success('✅ GraphIndexer tests passed');
      
    } catch (error) {
      this.fail('GraphIndexer test failed', error);
    }
  }
  
  /**
   * Test EnhancedRDFProcessor
   */
  async testEnhancedProcessor() {
    consola.info('🔍 Testing EnhancedRDFProcessor...');
    
    try {
      const processor = new EnhancedRDFProcessor();
      await processor.initialize();
      
      const testFile1 = path.join(this.tempDir, 'test1.ttl');
      const testFile2 = path.join(this.tempDir, 'test2.ttl');
      const testFile3 = path.join(this.tempDir, 'test3.ttl');
      
      // Test graph hash
      const hashResult1 = await processor.graphHash(testFile1);
      const hashResult2 = await processor.graphHash(testFile2);
      
      this.assert(hashResult1.success, 'Hash result 1 should succeed');
      this.assert(hashResult2.success, 'Hash result 2 should succeed');
      this.assert(hashResult1.canonicalHash === hashResult2.canonicalHash, 'Equivalent graphs should have same canonical hash');
      
      // Test graph diff
      const diffResult = await processor.graphDiff(testFile1, testFile3);
      this.assert(diffResult.success, 'Diff should succeed');
      this.assert(!diffResult.identical, 'Different graphs should not be identical');
      this.assert(diffResult.differences > 0, 'Should detect differences');
      
      // Test graph index
      const indexResult = await processor.graphIndex(testFile1);
      this.assert(indexResult.success, 'Index should succeed');
      this.assert(indexResult.triples > 0, 'Should have triples');
      this.assert(indexResult.statistics.subjects > 0, 'Should have subjects');
      
      consola.success('✅ EnhancedRDFProcessor tests passed');
      
    } catch (error) {
      this.fail('EnhancedRDFProcessor test failed', error);
    }
  }
  
  /**
   * Test StandaloneKGenBridge
   */
  async testStandaloneBridge() {
    consola.info('🔍 Testing StandaloneKGenBridge...');
    
    try {
      const bridge = new StandaloneKGenBridge();
      
      const testFile1 = path.join(this.tempDir, 'test1.ttl');
      const testFile2 = path.join(this.tempDir, 'test2.ttl');
      
      // Test graph hash
      const hashResult = await bridge.graphHash(testFile1);
      this.assert(hashResult.success, 'Bridge hash should succeed');
      this.assert(hashResult.hash, 'Should return hash');
      this.assert(hashResult._semantic, 'Should include semantic metadata');
      
      // Test graph diff
      const diffResult = await bridge.graphDiff(testFile1, testFile2);
      this.assert(diffResult.success, 'Bridge diff should succeed');
      this.assert(diffResult.identical, 'Equivalent graphs should be identical');
      this.assert(diffResult._semantic, 'Should include semantic metadata');
      
      // Test graph index
      const indexResult = await bridge.graphIndex(testFile1);
      this.assert(indexResult.success, 'Bridge index should succeed');
      this.assert(indexResult.triples > 0, 'Should have triples');
      this.assert(indexResult._semantic, 'Should include semantic metadata');
      
      // Test project lock
      const lockResult = await bridge.projectLock(this.tempDir);
      this.assert(lockResult.success, 'Bridge lock should succeed');
      this.assert(lockResult.filesHashed > 0, 'Should hash files');
      
      consola.success('✅ StandaloneKGenBridge tests passed');
      
    } catch (error) {
      this.fail('StandaloneKGenBridge test failed', error);
    }
  }
  
  /**
   * Test CLI integration scenarios
   */
  async testCLIIntegration() {
    consola.info('🔍 Testing CLI Integration scenarios...');
    
    try {
      // Test semantic vs naive processing differences
      const bridge = new StandaloneKGenBridge();
      
      const testFile1 = path.join(this.tempDir, 'test1.ttl');
      const testFile2 = path.join(this.tempDir, 'test2.ttl');
      
      // Get enhanced results
      const enhancedHash1 = await bridge.graphHash(testFile1);
      const enhancedHash2 = await bridge.graphHash(testFile2);
      const enhancedDiff = await bridge.graphDiff(testFile1, testFile2);
      
      // Verify semantic equivalence detection
      this.assert(
        enhancedHash1.hash === enhancedHash2.hash,
        'Semantic hashes should be identical for equivalent graphs'
      );
      
      this.assert(
        enhancedDiff.identical,
        'Semantic diff should show graphs as identical'
      );
      
      // Test that content hashes are different (proving semantic equivalence)
      this.assert(
        enhancedHash1._semantic.contentHash !== enhancedHash2._semantic.contentHash,
        'Content hashes should differ for syntactically different files'
      );
      
      consola.success('✅ CLI Integration tests passed');
      
    } catch (error) {
      this.fail('CLI Integration test failed', error);
    }
  }
  
  /**
   * Assert a condition
   */
  assert(condition, message) {
    if (condition) {
      this.testResults.passed++;
      consola.debug(`  ✅ ${message}`);
    } else {
      this.fail(message);
    }
  }
  
  /**
   * Record a test failure
   */
  fail(message, error = null) {
    this.testResults.failed++;
    const errorMsg = error ? `${message}: ${error.message}` : message;
    this.testResults.errors.push(errorMsg);
    consola.error(`  ❌ ${errorMsg}`);
  }
  
  /**
   * Print test results
   */
  printResults() {
    const total = this.testResults.passed + this.testResults.failed;
    
    consola.info('\n📊 Test Results Summary:');
    consola.info(`Total Tests: ${total}`);
    consola.success(`Passed: ${this.testResults.passed}`);
    
    if (this.testResults.failed > 0) {
      consola.error(`Failed: ${this.testResults.failed}`);
      consola.error('\n❌ Failures:');
      this.testResults.errors.forEach(error => consola.error(`  • ${error}`));
    }
    
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;
    
    if (this.testResults.failed === 0) {
      consola.success(`\n🎉 All tests passed! Success rate: ${successRate}%`);
    } else {
      consola.error(`\n💥 Some tests failed. Success rate: ${successRate}%`);
    }
  }
  
  /**
   * Cleanup test files
   */
  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      consola.info('🧹 Cleanup complete');
    } catch (error) {
      consola.warn('Cleanup failed:', error.message);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new RDFIntegrationTest();
  await tester.runTests();
}

export { RDFIntegrationTest };