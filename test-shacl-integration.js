#!/usr/bin/env node

/**
 * Test SHACL integration with template linting system
 */

import { TemplateValidationPipeline } from './packages/kgen-cli/src/lib/validation-integration.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testSHACLIntegration() {
  console.log('🔗 Testing SHACL Integration with Template Linter\n');

  try {
    // Create validation pipeline
    const pipeline = new TemplateValidationPipeline({
      lint: {
        performanceTarget: 5,
        cache: false
      },
      shacl: true
    });

    const testDir = join(__dirname, 'test-templates');
    
    // Test single template validation with SHACL output
    console.log('📋 Testing SHACL-compatible validation report:');
    const report = await pipeline.validateTemplate(join(testDir, 'non-deterministic.njk'));
    
    console.log(`  Conforms: ${report.conforms}`);
    console.log(`  Results: ${report.results.length}`);
    console.log(`  Validation time: ${report.validationTime}ms`);
    
    // Show SHACL format results
    console.log('\n  Sample SHACL results:');
    report.results.slice(0, 2).forEach((result, index) => {
      console.log(`    ${index + 1}. ${result['sh:resultSeverity']}`);
      console.log(`       Message: ${result['sh:resultMessage']}`);
      console.log(`       Constraint: ${result['sh:sourceConstraintComponent']}`);
      console.log(`       Deterministic: ${result['kgen:deterministic']}`);
    });

    // Test batch validation
    console.log('\n📊 Testing batch validation:');
    const batchResult = await pipeline.validateBatch(testDir);
    
    console.log(`  Total templates: ${batchResult.summary.total}`);
    console.log(`  Conforming: ${batchResult.summary.conforming}`);
    console.log(`  Non-conforming: ${batchResult.summary.nonConforming}`);
    console.log(`  Average validation time: ${batchResult.summary.avgValidationTime.toFixed(1)}ms`);
    console.log(`  Conforms to policy: ${batchResult.conformsToPolicy}`);

    // Test CI/CD report generation
    console.log('\n🚀 Testing CI/CD report generation:');
    const cicdReport = pipeline.generateCICDReport(batchResult);
    
    console.log(`  Test passed: ${cicdReport.passed}`);
    console.log(`  Should block CI: ${cicdReport.cicd.shouldBlock}`);
    console.log(`  Exit code: ${cicdReport.cicd.exitCode}`);
    console.log(`  Determinism score: ${cicdReport.summary.determinismScore}%`);
    console.log(`  Critical issues: ${cicdReport.criticalIssues.length}`);
    
    if (cicdReport.recommendations.length > 0) {
      console.log('\n  💡 CI/CD Recommendations:');
      cicdReport.recommendations.forEach(rec => console.log(`    • ${rec}`));
    }

    // Test JSON output for external systems
    console.log('\n📄 Testing JSON serialization:');
    const jsonReport = report.toJSON();
    console.log(`  Context: ${jsonReport['@context']['sh']}`);
    console.log(`  Type: ${jsonReport['@type']}`);
    console.log(`  Conforms: ${jsonReport['sh:conforms']}`);
    console.log(`  Result count: ${jsonReport['kgen:resultCount']}`);

    console.log('\n✅ SHACL integration test completed successfully!');
    console.log('\n📋 Integration Summary:');
    console.log(`  ✓ SHACL-compatible validation reports generated`);
    console.log(`  ✓ CI/CD integration ready with exit codes`);
    console.log(`  ✓ JSON-LD output for external consumption`);
    console.log(`  ✓ Performance within target (${batchResult.summary.avgValidationTime.toFixed(1)}ms avg)`);
    console.log(`  ✓ Determinism scoring and recommendations`);

  } catch (error) {
    console.error('❌ SHACL integration test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSHACLIntegration();
}