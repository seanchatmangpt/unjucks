#!/usr/bin/env node

/**
 * KGEN Smoke Test Runner
 * 
 * Runs all smoke tests in sequence and provides consolidated report
 * 
 * Usage:
 *   node tests/smoke/00-smoke-runner.js
 *   npm run test:smoke
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import all smoke tests
import CLIImportTest from './01-cli-import.test.js';
import TurtleLoadingTest from './02-turtle-loading.test.js';
import TemplateRenderingTest from './03-template-rendering.test.js';
import FileOutputTest from './04-file-output.test.js';

class SmokeTestRunner {
  constructor() {
    this.startTime = Date.now();
    this.results = [];
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.totalTests = 0;
  }

  log(message) {
    console.log(`[SMOKE-RUNNER] ${message}`);
  }

  async runAllTests() {
    console.log('🔥 KGEN Smoke Test Suite Starting...\n');
    console.log('=' .repeat(60));
    
    const tests = [
      { name: 'CLI Import & Help Command', testClass: CLIImportTest },
      { name: 'Turtle Graph Loading', testClass: TurtleLoadingTest },
      { name: 'Template Rendering', testClass: TemplateRenderingTest },
      { name: 'File Output Functionality', testClass: FileOutputTest }
    ];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      
      console.log(`\n📋 Running Test ${i + 1}/${tests.length}: ${test.name}`);
      console.log('-'.repeat(60));
      
      try {
        const tester = new test.testClass();
        const result = await tester.runTests();
        
        this.results.push(result);
        this.totalPassed += result.passed;
        this.totalFailed += result.failed;
        this.totalTests += result.passed + result.failed;
        
        console.log(`\n✅ Test completed: ${result.success ? 'PASSED' : 'FAILED'}`);
        
      } catch (error) {
        console.error(`\n❌ Test failed with exception: ${error.message}`);
        this.results.push({
          testName: test.name,
          passed: 0,
          failed: 1,
          success: false,
          errors: [{ message: 'Test runner exception', error: error.message }]
        });
        this.totalFailed += 1;
        this.totalTests += 1;
      }
      
      console.log('=' .repeat(60));
    }
  }

  generateConsolidatedReport() {
    const duration = Date.now() - this.startTime;
    const successRate = this.totalTests > 0 ? Math.round((this.totalPassed / this.totalTests) * 100) : 0;
    
    console.log('\n🏆 KGEN SMOKE TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📊 Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.totalPassed}`);
    console.log(`❌ Failed: ${this.totalFailed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log('');
    
    // Individual test results
    console.log('📋 Test Breakdown:');
    this.results.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      const rate = result.passed + result.failed > 0 ? 
        Math.round((result.passed / (result.passed + result.failed)) * 100) : 0;
      console.log(`${i + 1}. ${status} ${result.testName} (${rate}% - ${result.passed}/${result.passed + result.failed})`);
    });
    
    // Critical failures
    const failedTests = this.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n🚨 Critical Issues Found:');
      failedTests.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.testName}:`);
        if (result.errors && result.errors.length > 0) {
          result.errors.slice(0, 3).forEach((err, j) => {
            console.log(`   • ${err.message}`);
          });
          if (result.errors.length > 3) {
            console.log(`   • ... and ${result.errors.length - 3} more errors`);
          }
        }
      });
    }
    
    // Functional status assessment
    console.log('\n🔍 KGEN Functional Status:');
    
    const cliTest = this.results.find(r => r.testName.includes('CLI'));
    const turtleTest = this.results.find(r => r.testName.includes('Turtle'));
    const templateTest = this.results.find(r => r.testName.includes('Template'));
    const fileTest = this.results.find(r => r.testName.includes('File'));
    
    console.log(`🔧 CLI Functionality: ${cliTest?.success ? 'WORKING' : 'BROKEN'}`);
    console.log(`🐢 RDF/Turtle Support: ${turtleTest?.success ? 'WORKING' : 'BROKEN'}`);
    console.log(`📝 Template Rendering: ${templateTest?.success ? 'WORKING' : 'BROKEN'}`);
    console.log(`💾 File Output: ${fileTest?.success ? 'WORKING' : 'BROKEN'}`);
    
    // Overall verdict
    console.log('\n🎯 Overall Verdict:');
    if (successRate >= 90) {
      console.log('🟢 EXCELLENT - KGEN core functionality is working well');
    } else if (successRate >= 70) {
      console.log('🟡 GOOD - KGEN has working functionality with some issues');
    } else if (successRate >= 50) {
      console.log('🟠 FAIR - KGEN has basic functionality but needs fixes');
    } else if (successRate >= 25) {
      console.log('🔴 POOR - KGEN has critical issues but some components work');
    } else {
      console.log('💥 CRITICAL - KGEN has severe functionality problems');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (!cliTest?.success) {
      console.log('• Fix CLI import and basic command functionality first');
    }
    if (!turtleTest?.success) {
      console.log('• Address RDF/N3 dependency and parsing issues');
    }
    if (!templateTest?.success) {
      console.log('• Fix template rendering and Nunjucks integration');
    }
    if (!fileTest?.success) {
      console.log('• Resolve file system operations and output handling');
    }
    
    console.log('=' .repeat(60));
    
    return {
      duration,
      totalTests: this.totalTests,
      totalPassed: this.totalPassed,
      totalFailed: this.totalFailed,
      successRate,
      results: this.results,
      overallSuccess: successRate >= 70 // 70% threshold for "working"
    };
  }

  async saveReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        summary: {
          totalTests: this.totalTests,
          totalPassed: this.totalPassed,
          totalFailed: this.totalFailed,
          successRate: this.totalTests > 0 ? Math.round((this.totalPassed / this.totalTests) * 100) : 0
        },
        testResults: this.results,
        functionalStatus: {
          cliWorking: this.results.find(r => r.testName.includes('CLI'))?.success || false,
          rdfWorking: this.results.find(r => r.testName.includes('Turtle'))?.success || false,
          templatesWorking: this.results.find(r => r.testName.includes('Template'))?.success || false,
          fileOutputWorking: this.results.find(r => r.testName.includes('File'))?.success || false
        }
      };
      
      const reportPath = join(__dirname, '../../reports/smoke-test-report.json');
      const reportsDir = join(__dirname, '../../reports');
      
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`Report saved to ${reportPath}`);
      
    } catch (err) {
      this.log(`Warning: Could not save report - ${err.message}`);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SmokeTestRunner();
  
  try {
    await runner.runAllTests();
    const report = runner.generateConsolidatedReport();
    await runner.saveReport();
    
    // Exit with appropriate code
    process.exit(report.overallSuccess ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Smoke test runner failed:', error.message);
    process.exit(1);
  }
}

export default SmokeTestRunner;