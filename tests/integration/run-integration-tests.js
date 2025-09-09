#!/usr/bin/env node

import { UnjucksIntegrationTest } from './unjucks-integration.test.js';
import { TemplateEngineTest } from './template-engine.test.js';

/**
 * Integration Test Runner
 * Runs all integration test suites and provides consolidated reporting
 */
class IntegrationTestRunner {
  constructor() {
    this.testSuites = [
      { name: 'Unjucks CLI Integration Tests', class: UnjucksIntegrationTest },
      { name: 'Template Engine Tests', class: TemplateEngineTest }
    ];
    this.results = [];
  }

  async runAllSuites() {
    console.log('🚀 Starting Complete Integration Test Suite');
    console.log('============================================');
    console.log(`Running ${this.testSuites.length} test suites...\n`);
    
    const overallStartTime = Date.now();
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log('─'.repeat(50));
      
      try {
        const tester = new suite.class();
        const result = await tester.runAllTests();
        
        this.results.push({
          name: suite.name,
          ...result,
          status: result.failed === 0 ? 'PASSED' : 'FAILED'
        });
        
        totalTests += result.total;
        totalPassed += result.passed;
        totalFailed += result.failed;
        
      } catch (error) {
        console.error(`❌ Test suite failed: ${suite.name}`);
        console.error(`   Error: ${error.message}`);
        
        this.results.push({
          name: suite.name,
          total: 0,
          passed: 0,
          failed: 1,
          status: 'ERROR',
          error: error.message
        });
        
        totalFailed += 1;
      }
    }
    
    const overallDuration = Date.now() - overallStartTime;
    
    // Print consolidated summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPLETE INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Total Test Suites: ${this.testSuites.length}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} ✅`);
    console.log(`   Failed: ${totalFailed} ❌`);
    console.log(`   Success Rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);
    console.log(`   Total Duration: ${Math.round(overallDuration / 1000)}s`);
    
    console.log(`\n📋 Suite Breakdown:`);
    this.results.forEach((result, index) => {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      const successRate = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
      
      console.log(`   ${index + 1}. ${result.name}`);
      console.log(`      Status: ${status} ${result.status}`);
      console.log(`      Tests: ${result.passed}/${result.total} (${successRate}%)`);
      
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
      
      if (result.duration) {
        console.log(`      Duration: ${Math.round(result.duration / 1000)}s`);
      }
    });
    
    // Show failed tests details
    const failedSuites = this.results.filter(r => r.status !== 'PASSED');
    if (failedSuites.length > 0) {
      console.log(`\n❌ Failed Test Details:`);
      failedSuites.forEach(suite => {
        console.log(`\n   Suite: ${suite.name}`);
        if (suite.results) {
          const failedTests = suite.results.filter(test => test.status === 'FAILED');
          failedTests.forEach(test => {
            console.log(`     • ${test.name}: ${test.error}`);
          });
        }
      });
    }
    
    // Final status
    const allPassed = totalFailed === 0;
    console.log(`\n${allPassed ? '🎉' : '⚠️'} ${allPassed ? 'ALL INTEGRATION TESTS PASSED!' : 'SOME TESTS FAILED'}`);
    
    if (!allPassed) {
      console.log('\n💡 To debug failed tests:');
      console.log('   1. Run individual test suites for more details');
      console.log('   2. Check that all dependencies are installed');
      console.log('   3. Verify templates exist in _templates directory');
      console.log('   4. Ensure Node.js version >= 18.0.0');
    }
    
    return {
      success: allPassed,
      totalTests,
      totalPassed,
      totalFailed,
      duration: overallDuration,
      suites: this.results
    };
  }
}

// Enhanced CLI runner with options
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line options
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    filter: args.find(arg => arg.startsWith('--filter='))?.split('=')[1],
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log('Integration Test Runner');
    console.log('Usage: node run-integration-tests.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v     Verbose output');
    console.log('  --filter=<name>   Run only tests matching name');
    console.log('  --help, -h        Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node run-integration-tests.js');
    console.log('  node run-integration-tests.js --verbose');
    console.log('  node run-integration-tests.js --filter=CLI');
    return;
  }
  
  const runner = new IntegrationTestRunner();
  
  // Filter test suites if requested
  if (options.filter) {
    const filtered = runner.testSuites.filter(suite => 
      suite.name.toLowerCase().includes(options.filter.toLowerCase())
    );
    
    if (filtered.length === 0) {
      console.error(`❌ No test suites match filter: ${options.filter}`);
      console.log('Available suites:');
      runner.testSuites.forEach(suite => {
        console.log(`  • ${suite.name}`);
      });
      process.exit(1);
    }
    
    runner.testSuites = filtered;
    console.log(`🔍 Filtered to ${filtered.length} suite(s) matching: ${options.filter}`);
  }
  
  if (options.verbose) {
    console.log('🔧 Verbose mode enabled');
    console.log(`📋 Test suites to run: ${runner.testSuites.length}`);
    runner.testSuites.forEach((suite, index) => {
      console.log(`   ${index + 1}. ${suite.name}`);
    });
    console.log('');
  }
  
  try {
    const results = await runner.runAllSuites();
    
    // Write results to file for CI/CD
    const resultsFile = 'tests/reports/integration-results.json';
    try {
      const { promises: fs } = await import('fs');
      const path = await import('path');
      
      await fs.mkdir(path.dirname(resultsFile), { recursive: true });
      await fs.writeFile(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch
        },
        ...results
      }, null, 2));
      
      console.log(`\n📄 Results saved to: ${resultsFile}`);
    } catch (error) {
      console.warn(`⚠️ Could not save results file: ${error.message}`);
    }
    
    process.exit(results.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };