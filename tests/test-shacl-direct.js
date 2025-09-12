#!/usr/bin/env node

/**
 * Direct test of SHACL validation engine
 */

import { SHACLEngine } from '../packages/kgen-core/src/shacl/validator.js';
import { SHACLReporter } from '../packages/kgen-core/src/shacl/reporter.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testSHACLValidation() {
  console.log('🔍 Testing SHACL Validation Engine...\n');
  
  const validator = new SHACLEngine();
  const reporter = new SHACLReporter();
  
  try {
    // Test paths
    const dataFile = path.join(__dirname, 'test-data/shacl/sample-artifact.ttl');
    const shapesFile = path.join(__dirname, '../ontologies/shacl/artifact-shapes.ttl');
    
    console.log(`Data file: ${dataFile}`);
    console.log(`Shapes file: ${shapesFile}\n`);
    
    // Validate the sample artifact
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
    const report = reporter.generateReport(result, 'summary', { maxViolations: 3 });
    console.log(report);
    
    if (!result.conforms) {
      console.log('\n🚨 Violations found:');
      result.violations.slice(0, 5).forEach((violation, i) => {
        console.log(`${i + 1}. ${violation.message}`);
        console.log(`   Path: ${violation.path}`);
        console.log(`   Value: ${violation.value}`);
        console.log(`   Severity: ${violation.severity}`);
        console.log('');
      });
    }
    
    // Test JSON output
    console.log('\n💾 Saving JSON report...');
    await reporter.saveReport(result, 'json', '/tmp/shacl-validation-report.json');
    console.log('✅ JSON report saved to /tmp/shacl-validation-report.json');
    
    // Test multiple formats
    console.log('\n📄 Generating multiple reports...');
    const reports = await reporter.generateMultipleReports(
      result, 
      '/tmp/shacl-validation', 
      ['json', 'summary']
    );
    
    console.log('✅ Generated reports:');
    reports.forEach(report => console.log(`   - ${report}`));
    
    return result;
    
  } catch (error) {
    console.error('❌ SHACL validation test failed:');
    console.error(error.message);
    console.error(error.stack);
    return null;
  }
}

// Run the test
testSHACLValidation().then(result => {
  if (result) {
    console.log(`\n🎯 Test completed successfully!`);
    console.log(`   Conforms: ${result.conforms}`);
    console.log(`   Violations: ${result.violations.length}`);
    console.log(`   Engine: ${result.engine}`);
  } else {
    console.log('\n💥 Test failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});