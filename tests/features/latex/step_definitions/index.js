/**
 * LaTeX Step Definitions Index
 * Comprehensive test suite for LaTeX document generation and validation
 */

// Import all step definition modules
require('./latex_steps.js');
require('./validation_steps.js');
require('./citation_steps.js');
require('./math_steps.js');

const { Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const fs = require('fs').promises;
const path = require('path');

// Set longer timeout for LaTeX compilation tests
setDefaultTimeout(60000); // 60 seconds

// Global test context
class GlobalLatexTestContext {
  constructor() {
    this.testOutputDir = path.join(__dirname, '../../output');
    this.tempFiles = [];
    this.testResults = {};
  }

  async initialize() {
    // Ensure output directory exists
    await fs.mkdir(this.testOutputDir, { recursive: true });
    
    // Set SOURCE_DATE_EPOCH for reproducible builds
    if (!process.env.SOURCE_DATE_EPOCH) {
      process.env.SOURCE_DATE_EPOCH = '1640995200'; // 2022-01-01 00:00:00 UTC
    }
  }

  async cleanup() {
    // Clean up test files
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.tempFiles = [];
  }

  addTempFile(filepath) {
    this.tempFiles.push(filepath);
  }

  recordTestResult(testName, result) {
    this.testResults[testName] = {
      ...result,
      timestamp: new Date().toISOString()
    };
  }

  async generateTestReport() {
    const reportPath = path.join(this.testOutputDir, 'latex_test_report.json');
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalTests: Object.keys(this.testResults).length,
        passed: Object.values(this.testResults).filter(r => r.passed).length,
        failed: Object.values(this.testResults).filter(r => !r.passed).length
      },
      results: this.testResults,
      environment: {
        node_version: process.version,
        source_date_epoch: process.env.SOURCE_DATE_EPOCH,
        latex_available: await this.checkLatexAvailability()
      }
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    this.addTempFile(reportPath);
    
    return report;
  }

  async checkLatexAvailability() {
    try {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const process = spawn('pdflatex', ['--version'], { stdio: 'pipe' });
        process.on('close', (code) => {
          resolve(code === 0);
        });
        process.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }
}

const globalContext = new GlobalLatexTestContext();

// Global setup and teardown
Before(async function () {
  await globalContext.initialize();
});

After(async function (testCase) {
  // Record test results
  globalContext.recordTestResult(testCase.pickle.name, {
    passed: testCase.result.status === 'PASSED',
    duration: testCase.result.duration?.nanos ? testCase.result.duration.nanos / 1000000 : 0,
    status: testCase.result.status,
    error: testCase.result.message || null
  });
});

// Final cleanup after all tests
process.on('exit', async () => {
  try {
    const report = await globalContext.generateTestReport();
    console.log('LaTeX Test Report Generated:', report.summary);
  } catch (error) {
    console.warn('Failed to generate test report:', error.message);
  }
  
  await globalContext.cleanup();
});

// Export global context for use in other step definitions
module.exports = {
  globalContext
};