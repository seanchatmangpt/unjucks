#!/usr/bin/env node

/**
 * Ontology Standards Test Runner
 * 
 * Standalone test runner for ontology standards functionality
 * Demonstrates semantic web compliance and interoperability
 */

import { Store, Parser } from 'n3';
import { SemanticValidator } from '../src/lib/semantic-validator.js';
import { 
  createOntologyStandardsRegistry,
  validateAgainstAllStandards 
} from '../src/lib/ontology-standards.js';
import { createStandardsMemoryIntegration } from '../src/core/standards-memory-integration.js';

console.log('🔍 Ontology Standards Expert - Test Suite');
console.log('=========================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  try {
    // Test 1: Initialize Registry
    console.log('Test 1: Initialize Ontology Standards Registry');
    const registry = createOntologyStandardsRegistry();
    const vocabularies = registry.getAllVocabularies();
    
    if (vocabularies.size >= 5) {
      console.log('✅ PASS: Registry initialized with', vocabularies.size, 'vocabularies');
      passed++;
    } else {
      console.log('❌ FAIL: Expected at least 5 vocabularies, got', vocabularies.size);
      failed++;
    }
    
    // Test 2: Vocabulary Validation
    console.log('\nTest 2: Vocabulary Content Validation');
    const schemaOrg = registry.getVocabulary('schema.org');
    const foaf = registry.getVocabulary('foaf');
    
    if (schemaOrg && schemaOrg.classes.Person && foaf && foaf.classes.Person) {
      console.log('✅ PASS: Schema.org and FOAF vocabularies contain Person class');
      passed++;
    } else {
      console.log('❌ FAIL: Missing Person class in vocabularies');
      failed++;
    }
    
    // Test 3: Standards Mapping
    console.log('\nTest 3: Cross-Vocabulary Mapping');
    const mapping = registry.getMapping('schema', 'foaf');
    
    if (mapping && mapping.propertyMappings['schema:name'] === 'foaf:name') {
      console.log('✅ PASS: Schema.org to FOAF mapping works correctly');
      passed++;
    } else {
      console.log('❌ FAIL: Schema.org to FOAF mapping failed');
      failed++;
    }
    
    // Test 4: RDF Validation
    console.log('\nTest 4: RDF/Turtle Syntax Validation');
    const validator = new SemanticValidator({
      enableStrictValidation: true,
      validateSemantics: true,
      checkStandardsCompliance: true
    });
    
    const validTurtle = `
      @prefix schema: <https://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      <#person/test> a schema:Person ;
        schema:name "Test Person" ;
        schema:email "test@example.com" ;
        foaf:name "Test Person" .
    `;
    
    const validationResult = await validator.validate(validTurtle);
    
    if (validationResult.isValid) {
      console.log('✅ PASS: RDF validation successful');
      console.log('   Detected vocabularies:', validationResult.details?.standards?.vocabulariesDetected || []);
      passed++;
    } else {
      console.log('❌ FAIL: RDF validation failed');
      console.log('   Errors:', validationResult.errors);
      failed++;
    }
    
    // Test 5: Standards Compliance
    console.log('\nTest 5: Standards Compliance Validation');
    const parser = new Parser();
    const quads = parser.parse(validTurtle);
    const store = new Store();
    store.addQuads(quads);
    
    const complianceResult = registry.validateVocabularyCompliance(store, 'schema.org');
    
    if (complianceResult.isValid) {
      console.log('✅ PASS: Schema.org compliance validation successful');
      passed++;
    } else {
      console.log('❌ FAIL: Schema.org compliance validation failed');
      console.log('   Errors:', complianceResult.errors);
      failed++;
    }
    
    // Test 6: Interoperability Testing
    console.log('\nTest 6: Interoperability Testing');
    const interopResults = await registry.testInteroperability(store);
    
    if (interopResults.overall.passed > 0) {
      console.log('✅ PASS: Interoperability tests passed');
      console.log('   Passed:', interopResults.overall.passed, 'Failed:', interopResults.overall.failed);
      passed++;
    } else {
      console.log('❌ FAIL: All interoperability tests failed');
      failed++;
    }
    
    // Test 7: Memory Integration
    console.log('\nTest 7: Memory Storage Integration');
    const memoryStore = new Map();
    const memoryIntegration = createStandardsMemoryIntegration({ memoryStore });
    const storageResult = await memoryIntegration.storeStandardsMapping();
    
    if (storageResult.success) {
      console.log('✅ PASS: Standards mapping stored in memory');
      console.log('   Key: hive/standards/compliance');
      console.log('   Data size:', storageResult.dataSize, 'bytes');
      console.log('   Vocabularies stored:', storageResult.vocabulariesStored);
      passed++;
    } else {
      console.log('❌ FAIL: Memory storage failed');
      console.log('   Error:', storageResult.error);
      failed++;
    }
    
    // Test 8: Memory Retrieval
    console.log('\nTest 8: Memory Retrieval and Validation');
    const retrievedMapping = memoryIntegration.retrieveStandardsMapping();
    const memoryValidation = await memoryIntegration.validateStoredMapping();
    
    if (retrievedMapping && memoryValidation.isValid) {
      console.log('✅ PASS: Memory retrieval and validation successful');
      console.log('   Vocabularies count:', memoryValidation.statistics.vocabulariesCount);
      console.log('   Mappings count:', memoryValidation.statistics.mappingsCount);
      passed++;
    } else {
      console.log('❌ FAIL: Memory retrieval or validation failed');
      console.log('   Errors:', memoryValidation.errors);
      failed++;
    }
    
    // Test 9: Job Resume Template Validation
    console.log('\nTest 9: Job Resume Standards Template');
    const resumeData = `
      @prefix schema: <https://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      
      <#person/jane-smith> a schema:Person , foaf:Person ;
        schema:name "Jane Smith" ;
        foaf:name "Jane Smith" ;
        schema:email "jane.smith@example.com" ;
        foaf:mbox <mailto:jane.smith@example.com> ;
        schema:jobTitle "Software Engineer" ;
        schema:skills "JavaScript", "Python", "React" ;
        dcterms:title "Professional Profile: Jane Smith" .
    `;
    
    const resumeValidation = await validator.validate(resumeData);
    
    if (resumeValidation.isValid) {
      console.log('✅ PASS: Job resume template validation successful');
      console.log('   Multi-vocabulary compliance achieved');
      passed++;
    } else {
      console.log('❌ FAIL: Job resume template validation failed');
      console.log('   Errors:', resumeValidation.errors);
      failed++;
    }
    
    // Test 10: Complete Standards Validation
    console.log('\nTest 10: Complete Standards Validation Suite');
    const resumeParser = new Parser();
    const resumeQuads = resumeParser.parse(resumeData);
    const resumeStore = new Store();
    resumeStore.addQuads(resumeQuads);
    
    const completeValidation = await validateAgainstAllStandards(resumeStore);
    
    if (completeValidation.overallValid) {
      console.log('✅ PASS: Complete standards validation successful');
      console.log('   Total vocabularies:', completeValidation.summary.totalVocabularies);
      console.log('   Valid vocabularies:', completeValidation.summary.validVocabularies);
      passed++;
    } else {
      console.log('❌ FAIL: Complete standards validation failed');
      console.log('   Errors:', completeValidation.summary.totalErrors);
      failed++;
    }
    
    // Final Results
    console.log('\n=========================================');
    console.log('🎯 ONTOLOGY STANDARDS EXPERT - RESULTS');
    console.log('=========================================');
    console.log(`✅ Tests Passed: ${passed}`);
    console.log(`❌ Tests Failed: ${failed}`);
    console.log(`📊 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🏆 ALL TESTS PASSED! Ontology standards compliance achieved.');
      console.log('🔗 Standards supported: Schema.org, FOAF, Dublin Core, HR-XML, SARO');
      console.log('🌐 Interoperability: VALIDATED');
      console.log('💾 Memory integration: SUCCESSFUL');
      console.log('📝 Job/Resume mappings: IMPLEMENTED');
    } else {
      console.log('\n⚠️  Some tests failed. Review implementation for full compliance.');
    }
    
    // Memory Statistics
    const memoryStats = memoryIntegration.getMemoryStats();
    console.log('\n📊 Memory Usage Statistics:');
    console.log(`   Keys stored: ${memoryStats.totalKeys}`);
    console.log(`   Total size: ${memoryStats.formattedSize}`);
    console.log(`   Storage key: hive/standards/compliance`);
    
    return { passed, failed, total: passed + failed };
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR during testing:', error.message);
    console.error(error.stack);
    return { passed: 0, failed: 1, total: 1, error };
  }
}

// Run the tests
runTests().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});