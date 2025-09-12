#!/usr/bin/env node

/**
 * ALPHA-7 TEMPLATE PERFORMANCE TEST RUNNER
 * Executes comprehensive template system stress tests and generates performance report
 */

const path = require('path');
const { TemplateStressTester } = require('./template-stress-tests');

async function runPerformanceTests() {
  console.log('🚀 ALPHA-7 Template System Performance Testing');
  console.log('='.repeat(80));
  console.log('Target Performance Metrics:');
  console.log('  • Template rendering: < 10ms average');
  console.log('  • Variable extraction: < 5ms average');
  console.log('  • Template validation: < 50ms average');
  console.log('  • Cache hit rate: ≥ 80%');
  console.log('='.repeat(80));

  const tester = new TemplateStressTester({
    testDir: path.join(__dirname, '../../test-templates-stress')
  });

  try {
    const results = await tester.runAllTests();
    
    console.log('\n✅ Performance testing completed successfully!');
    console.log(`📊 Report saved to: ${path.join(tester.testDir, 'stress-test-report.json')}`);
    
    // Exit with appropriate code
    const overallPass = results.compliance?.status === 'PASS' && results.errors.length === 0;
    process.exit(overallPass ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Performance testing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPerformanceTests();
}

module.exports = { runPerformanceTests };