#!/usr/bin/env node
/**
 * Export Quality Test Runner
 * Main entry point for running comprehensive export quality validation tests
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';
import ExportQualityTestSuite from './export-quality-test-suite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    enablePDFTests: true,
    enableHTMLTests: true,
    enableDOCXTests: true,
    enableMarkdownTests: true,
    enableCrossFormatTests: true,
    enablePerformanceTests: true,
    generateComparisonReport: true,
    verbose: false,
    outputDir: path.join(__dirname, 'test-outputs'),
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--no-pdf':
        options.enablePDFTests = false;
        break;
      case '--no-html':
        options.enableHTMLTests = false;
        break;
      case '--no-docx':
        options.enableDOCXTests = false;
        break;
      case '--no-markdown':
        options.enableMarkdownTests = false;
        break;
      case '--no-cross-format':
        options.enableCrossFormatTests = false;
        break;
      case '--no-performance':
        options.enablePerformanceTests = false;
        break;
      case '--no-comparison':
        options.generateComparisonReport = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.outputDir = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--only-pdf':
        options.enableHTMLTests = false;
        options.enableDOCXTests = false;
        options.enableMarkdownTests = false;
        break;
      case '--only-html':
        options.enablePDFTests = false;
        options.enableDOCXTests = false;
        options.enableMarkdownTests = false;
        break;
      case '--only-docx':
        options.enablePDFTests = false;
        options.enableHTMLTests = false;
        options.enableMarkdownTests = false;
        break;
      case '--only-markdown':
        options.enablePDFTests = false;
        options.enableHTMLTests = false;
        options.enableDOCXTests = false;
        break;
    }
  }

  return options;
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
🔍 Export Quality Test Runner

USAGE:
  node run-export-quality-tests.js [options]

OPTIONS:
  --help, -h                 Show this help message
  --verbose, -v              Enable verbose output
  --output, -o <dir>         Specify output directory
  
FORMAT CONTROL:
  --no-pdf                   Skip PDF quality tests
  --no-html                  Skip HTML quality tests  
  --no-docx                  Skip DOCX quality tests
  --no-markdown              Skip Markdown quality tests
  --only-pdf                 Run only PDF tests
  --only-html                Run only HTML tests
  --only-docx                Run only DOCX tests
  --only-markdown            Run only Markdown tests

TEST CONTROL:
  --no-cross-format          Skip cross-format validation
  --no-performance           Skip performance tests
  --no-comparison            Skip comparison report generation

EXAMPLES:
  # Run all tests with default settings
  node run-export-quality-tests.js

  # Run only PDF and HTML tests
  node run-export-quality-tests.js --no-docx --no-markdown

  # Run only PDF tests with verbose output
  node run-export-quality-tests.js --only-pdf --verbose

  # Run all tests with custom output directory
  node run-export-quality-tests.js --output ./custom-test-results

  # Run quick test (no performance or cross-format)
  node run-export-quality-tests.js --no-performance --no-cross-format

`);
}

/**
 * Validate test environment and dependencies
 */
async function validateEnvironment() {
  const checks = [
    {
      name: 'Node.js Version',
      check: () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        return major >= 18;
      },
      message: 'Node.js 18+ required'
    },
    {
      name: 'Required Dependencies',
      check: async () => {
        try {
          // Check for key dependencies
          await import('fs-extra');
          return true;
        } catch (error) {
          return false;
        }
      },
      message: 'Required dependencies are available'
    },
    {
      name: 'Write Permissions',
      check: async () => {
        try {
          const testDir = path.join(__dirname, 'temp-permission-test');
          await fs.ensureDir(testDir);
          await fs.remove(testDir);
          return true;
        } catch (error) {
          return false;
        }
      },
      message: 'Write permissions available'
    }
  ];

  console.log('🔧 Validating test environment...\n');
  
  for (const check of checks) {
    try {
      const result = await check.check();
      if (result) {
        console.log(`  ✅ ${check.name}: ${check.message}`);
      } else {
        console.log(`  ❌ ${check.name}: Failed validation`);
        return false;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name}: ${error.message}`);
      return false;
    }
  }
  
  console.log();
  return true;
}

/**
 * Display test configuration
 */
function displayConfiguration(options) {
  console.log('⚙️  Test Configuration:\n');
  
  const enabledFormats = [];
  if (options.enablePDFTests) enabledFormats.push('PDF');
  if (options.enableHTMLTests) enabledFormats.push('HTML');
  if (options.enableDOCXTests) enabledFormats.push('DOCX');
  if (options.enableMarkdownTests) enabledFormats.push('Markdown');
  
  console.log(`  📄 Export Formats: ${enabledFormats.join(', ')}`);
  console.log(`  🔄 Cross-Format Tests: ${options.enableCrossFormatTests ? 'Enabled' : 'Disabled'}`);
  console.log(`  ⚡ Performance Tests: ${options.enablePerformanceTests ? 'Enabled' : 'Disabled'}`);
  console.log(`  📊 Comparison Reports: ${options.generateComparisonReport ? 'Enabled' : 'Disabled'}`);
  console.log(`  📁 Output Directory: ${options.outputDir}`);
  console.log(`  🔍 Verbose Output: ${options.verbose ? 'Enabled' : 'Disabled'}`);
  console.log();
}

/**
 * Clean up previous test results
 */
async function cleanupPreviousResults(outputDir) {
  try {
    if (await fs.pathExists(outputDir)) {
      console.log('🧹 Cleaning up previous test results...');
      await fs.remove(outputDir);
      console.log('✅ Cleanup completed\n');
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not clean up previous results: ${error.message}\n`);
  }
}

/**
 * Display test results summary
 */
function displayResultsSummary(report) {
  const summary = report.summary;
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 FINAL TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n📊 Overall Performance:`);
  console.log(`   Quality Grade: ${summary.qualityGrade}`);
  console.log(`   Success Rate: ${summary.successRate}%`);
  console.log(`   Total Tests: ${summary.overall.totalTests}`);
  console.log(`   Duration: ${Math.round(summary.overall.duration)}ms`);
  
  if (Object.keys(report.formatResults).length > 0) {
    console.log(`\n📄 Format Results:`);
    for (const [format, results] of Object.entries(report.formatResults)) {
      const status = results.status === 'completed' ? '✅' : '❌';
      const rate = results.status === 'completed' 
        ? `${Math.round((results.passed / results.totalTests) * 100)}%`
        : 'FAILED';
      console.log(`   ${status} ${format.toUpperCase()}: ${rate} success`);
    }
  }
  
  if (report.recommendations.length > 0) {
    console.log(`\n💡 Key Recommendations:`);
    report.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  console.log(`\n📁 Detailed reports available in: ${report.metadata.options.outputDir}`);
  console.log('='.repeat(60));
}

/**
 * Handle test errors gracefully
 */
function handleTestError(error, options) {
  console.error('\n❌ Export Quality Tests Failed!\n');
  
  if (options.verbose) {
    console.error('Error Details:');
    console.error(error.stack || error.message);
  } else {
    console.error(`Error: ${error.message}`);
    console.error('\nRun with --verbose flag for detailed error information');
  }
  
  console.error('\n💡 Troubleshooting Tips:');
  console.error('  • Ensure all dependencies are installed: npm install');
  console.error('  • Check file permissions in the output directory');
  console.error('  • Try running individual format tests using --only-* flags');
  console.error('  • Review the error message for specific issues');
  
  process.exit(1);
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseArguments();
    
    // Display help if requested
    if (options.help) {
      displayHelp();
      process.exit(0);
    }
    
    // Display welcome message
    console.log('🚀 Export Quality Assurance Test Suite');
    console.log('=====================================\n');
    
    // Validate environment
    const environmentValid = await validateEnvironment();
    if (!environmentValid) {
      console.error('❌ Environment validation failed. Please fix the issues above and try again.');
      process.exit(1);
    }
    
    // Display configuration
    displayConfiguration(options);
    
    // Clean up previous results
    await cleanupPreviousResults(options.outputDir);
    
    // Create and configure test suite
    const testSuite = new ExportQualityTestSuite(options);
    
    // Set up verbose logging if requested
    if (options.verbose) {
      console.log('🔍 Verbose mode enabled - detailed output will be shown\n');
    }
    
    // Run comprehensive validation
    console.log('🎯 Starting comprehensive export quality validation...\n');
    const startTime = Date.now();
    
    const report = await testSuite.runComprehensiveValidation();
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Display results summary
    displayResultsSummary(report);
    
    // Success message
    console.log(`\n🎉 Export quality validation completed successfully in ${Math.round(totalDuration)}ms!`);
    
    // Exit with appropriate code
    const hasFailures = report.summary.overall.failed > 0;
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    const options = parseArguments();
    handleTestError(error, options);
  }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export default main;