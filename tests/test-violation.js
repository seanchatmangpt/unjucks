#!/usr/bin/env node

/**
 * Test SHACL validation with constraint violations
 */

import { SHACLEngine } from '../packages/kgen-core/src/shacl/validator.js';
import { SHACLReporter } from '../packages/kgen-core/src/shacl/reporter.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testSHACLViolations() {
  console.log('🔍 Testing SHACL Constraint Violations...\n');
  
  const validator = new SHACLEngine();
  const reporter = new SHACLReporter();
  
  try {
    // Test paths
    const dataFile = path.join(__dirname, 'test-data/shacl/invalid-artifact.ttl');
    const shapesFile = path.join(__dirname, '../ontologies/shacl/artifact-shapes.ttl');
    
    console.log(`Data file: ${dataFile}`);
    console.log(`Shapes file: ${shapesFile}\n`);
    
    // Validate the invalid artifact
    console.log('📊 Running SHACL validation...');
    const result = await validator.validateFile(dataFile, shapesFile);
    
    console.log('✅ Validation completed!\n');
    
    // Generate summary
    const summary = validator.generateSummary(result);
    console.log('📈 Summary:');
    console.log(`- Conforms: ${summary.conforms}`);
    console.log(`- Total Violations: ${summary.totalViolations}`);
    console.log(`- Engine: ${summary.engine}`);
    console.log(`- Timestamp: ${summary.timestamp}\n`);
    
    // Generate detailed report
    console.log('📋 Detailed Report:');
    const report = reporter.generateReport(result, 'summary', { maxViolations: 10 });
    console.log(report);
    
    if (!result.conforms) {
      console.log('\n🚨 All Violations:');
      result.violations.forEach((violation, i) => {
        console.log(`${i + 1}. ${violation.message}`);
        console.log(`   Focus Node: ${violation.focusNode}`);
        console.log(`   Path: ${violation.path}`);
        console.log(`   Value: ${violation.value}`);
        console.log(`   Severity: ${violation.severity}`);
        console.log(`   Constraint: ${violation.constraint}`);
        console.log(`   Shape: ${violation.shape}`);
        console.log('');
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ SHACL validation test failed:');
    console.error(error.message);
    console.error(error.stack);
    return null;
  }
}

// Run the test
testSHACLViolations().then(result => {
  if (result) {
    console.log(`\n🎯 Violation test completed!`);
    console.log(`   Conforms: ${result.conforms}`);
    console.log(`   Violations: ${result.violations.length}`);
    console.log(`   Engine: ${result.engine}`);
    
    if (!result.conforms) {
      console.log('\n✅ Successfully detected constraint violations!');
      console.log('🔧 SHACL validation engine is working correctly.');
    } else {
      console.log('\n⚠️  Expected violations but found none - check test data');
    }
  } else {
    console.log('\n💥 Test failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});