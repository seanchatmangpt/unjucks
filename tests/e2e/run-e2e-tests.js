#!/usr/bin/env node
/**
 * E2E Test Runner for Unjucks
 * Runs comprehensive end-to-end tests and generates unified reports
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TEST_CONFIG = {
  projectRoot: path.resolve(__dirname, '../..'),
  reportsDir: path.join(__dirname, '../reports'),
  testFiles: [
    path.join(__dirname, 'complete-user-journeys.test.js'),
    path.join(__dirname, 'real-world-scenarios.test.js')
  ],
  timeout: 120000 // 2 minutes total
};

// Results aggregation
const aggregatedResults = {
  suites: [],
  summary: {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalTime: 0,
    successRate: 0
  },
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  }
};

/**
 * Run a test file and capture results
 */
async function runTestFile(testFile) {
  const suiteName = path.basename(testFile, '.test.js');
  console.log(`\n🚀 Running ${suiteName}...`);
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [testFile], {
      stdio: 'pipe',
      cwd: TEST_CONFIG.projectRoot,
      timeout: TEST_CONFIG.timeout
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Live output
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Live error output
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      // Parse results from output
      const results = parseTestOutput(stdout, stderr, code, duration);
      results.suiteName = suiteName;
      results.testFile = testFile;
      
      resolve(results);
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to run ${suiteName}: ${error.message}`));
    });

    // Handle timeout
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Test suite ${suiteName} timed out`));
    }, TEST_CONFIG.timeout);
  });
}

/**
 * Parse test output to extract results
 */
function parseTestOutput(stdout, stderr, exitCode, duration) {
  const results = {
    success: exitCode === 0,
    exitCode,
    duration,
    tests: [],
    passed: 0,
    failed: 0,
    total: 0,
    errors: [],
    output: stdout,
    errorOutput: stderr
  };

  // Try to extract structured results from output
  try {
    // Look for test result patterns
    const passedMatches = stdout.match(/✅ PASSED: (.+?) \((\d+)ms\)/g) || [];
    const failedMatches = stdout.match(/❌ FAILED: (.+?)$/gm) || [];
    
    results.passed = passedMatches.length;
    results.failed = failedMatches.length;
    results.total = results.passed + results.failed;

    // Extract individual test results
    passedMatches.forEach(match => {
      const [, testName, testDuration] = match.match(/✅ PASSED: (.+?) \((\d+)ms\)/);
      results.tests.push({
        name: testName,
        status: 'PASSED',
        duration: parseInt(testDuration)
      });
    });

    failedMatches.forEach(match => {
      const testName = match.replace('❌ FAILED: ', '');
      results.tests.push({
        name: testName,
        status: 'FAILED',
        duration: 0
      });
    });

    // Look for error details
    const errorMatches = stdout.match(/Error: (.+?)$/gm) || [];
    results.errors = errorMatches.map(error => 
      error.replace('Error: ', '').trim()
    );

  } catch (parseError) {
    console.warn(`Warning: Could not parse test output for detailed results: ${parseError.message}`);
  }

  return results;
}

/**
 * Verify CLI is available
 */
async function verifyCLI() {
  const cliPaths = [
    path.join(TEST_CONFIG.projectRoot, 'bin/unjucks.cjs'),
    path.join(TEST_CONFIG.projectRoot, 'bin/unjucks-standalone.cjs'),
    path.join(TEST_CONFIG.projectRoot, 'src/cli/index.js')
  ];

  for (const cliPath of cliPaths) {
    try {
      await fs.access(cliPath);
      console.log(`✅ CLI found: ${cliPath}`);
      return cliPath;
    } catch {
      continue;
    }
  }

  throw new Error('No CLI executable found. Run npm run build first.');
}

/**
 * Create reports directory
 */
async function ensureReportsDir() {
  await fs.mkdir(TEST_CONFIG.reportsDir, { recursive: true });
}

/**
 * Generate unified HTML report
 */
async function generateHTMLReport() {
  const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
        .metric { text-align: center; padding: 15px; border-radius: 8px; }
        .metric.passed { background: #d4edda; color: #155724; }
        .metric.failed { background: #f8d7da; color: #721c24; }
        .metric.total { background: #d1ecf1; color: #0c5460; }
        .suite { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; }
        .suite-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .test-list { padding: 15px; }
        .test-item { padding: 8px; margin: 5px 0; border-radius: 4px; }
        .test-item.passed { background: #d4edda; }
        .test-item.failed { background: #f8d7da; }
        .error-details { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Unjucks E2E Test Report</h1>
            <p class="timestamp">Generated: ${aggregatedResults.environment.timestamp}</p>
            <p>Node.js ${aggregatedResults.environment.nodeVersion} on ${aggregatedResults.environment.platform}</p>
        </div>

        <div class="summary">
            <div class="metric total">
                <h3>${aggregatedResults.summary.totalTests}</h3>
                <p>Total Tests</p>
            </div>
            <div class="metric passed">
                <h3>${aggregatedResults.summary.totalPassed}</h3>
                <p>Passed</p>
            </div>
            <div class="metric failed">
                <h3>${aggregatedResults.summary.totalFailed}</h3>
                <p>Failed</p>
            </div>
            <div class="metric total">
                <h3>${aggregatedResults.summary.successRate.toFixed(1)}%</h3>
                <p>Success Rate</p>
            </div>
        </div>

        ${aggregatedResults.suites.map(suite => `
        <div class="suite">
            <div class="suite-header">
                <h2>${suite.suiteName}</h2>
                <p>Duration: ${suite.duration}ms | Tests: ${suite.total} | Passed: ${suite.passed} | Failed: ${suite.failed}</p>
            </div>
            <div class="test-list">
                ${suite.tests.map(test => `
                <div class="test-item ${test.status.toLowerCase()}">
                    <strong>${test.name}</strong>
                    <span style="float: right;">${test.duration || 0}ms</span>
                </div>
                `).join('')}
                
                ${suite.errors.length > 0 ? `
                <div class="error-details">
                    <strong>Errors:</strong>
                    <ul>
                        ${suite.errors.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>
        `).join('')}
    </div>
</body>
</html>
`;

  const reportPath = path.join(TEST_CONFIG.reportsDir, 'e2e-report.html');
  await fs.writeFile(reportPath, htmlReport);
  return reportPath;
}

/**
 * Store results in memory for agent coordination
 */
async function storeResultsInMemory() {
  const memoryResults = {
    testSuite: 'E2E Complete Test Suite',
    summary: aggregatedResults.summary,
    suites: aggregatedResults.suites.map(suite => ({
      name: suite.suiteName,
      passed: suite.passed,
      failed: suite.failed,
      total: suite.total,
      duration: suite.duration,
      success: suite.success
    })),
    timestamp: aggregatedResults.environment.timestamp,
    status: aggregatedResults.summary.totalFailed === 0 ? 'ALL_PASSED' : 'SOME_FAILED',
    recommendations: generateRecommendations()
  };

  // This would normally be stored in the actual memory system
  // For now, save to a memory-like file structure
  const memoryFile = path.join(TEST_CONFIG.reportsDir, 'memory-results.json');
  await fs.writeFile(memoryFile, JSON.stringify({
    key: 'gaps/e2e/results',
    value: memoryResults,
    timestamp: new Date().toISOString()
  }, null, 2));

  return memoryResults;
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations() {
  const recommendations = [];

  if (aggregatedResults.summary.totalFailed > 0) {
    recommendations.push('Some E2E tests failed - review failed test output for specific issues');
  }

  if (aggregatedResults.summary.successRate < 80) {
    recommendations.push('Success rate below 80% - consider reviewing test stability and CLI functionality');
  }

  if (aggregatedResults.summary.totalTime > 60000) {
    recommendations.push('E2E tests taking longer than 1 minute - consider performance optimization');
  }

  if (aggregatedResults.summary.totalTests < 10) {
    recommendations.push('Consider adding more E2E test scenarios for better coverage');
  }

  if (recommendations.length === 0) {
    recommendations.push('All E2E tests passing - CLI functionality verified');
  }

  return recommendations;
}

/**
 * Main test runner
 */
async function runE2ETests() {
  console.log('🎬 Starting Unjucks E2E Test Suite');
  console.log('=====================================');

  const overallStart = Date.now();

  try {
    // Setup
    await ensureReportsDir();
    
    // Verify CLI is available
    const cliPath = await verifyCLI();
    console.log(`🔧 Using CLI: ${cliPath}`);

    // Run each test suite
    for (const testFile of TEST_CONFIG.testFiles) {
      try {
        const results = await runTestFile(testFile);
        aggregatedResults.suites.push(results);
        
        // Update summary
        aggregatedResults.summary.totalTests += results.total;
        aggregatedResults.summary.totalPassed += results.passed;
        aggregatedResults.summary.totalFailed += results.failed;
        
      } catch (error) {
        console.error(`❌ Failed to run ${path.basename(testFile)}: ${error.message}`);
        
        // Add failed suite to results
        aggregatedResults.suites.push({
          suiteName: path.basename(testFile, '.test.js'),
          testFile,
          success: false,
          error: error.message,
          duration: 0,
          tests: [],
          passed: 0,
          failed: 1,
          total: 1,
          errors: [error.message]
        });
        
        aggregatedResults.summary.totalTests += 1;
        aggregatedResults.summary.totalFailed += 1;
      }
    }

    // Calculate final metrics
    aggregatedResults.summary.totalTime = Date.now() - overallStart;
    aggregatedResults.summary.successRate = 
      aggregatedResults.summary.totalTests > 0 
        ? (aggregatedResults.summary.totalPassed / aggregatedResults.summary.totalTests) * 100 
        : 0;

    // Generate reports
    console.log('\n📊 Generating Reports...');
    
    const jsonReportPath = path.join(TEST_CONFIG.reportsDir, 'e2e-results.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(aggregatedResults, null, 2));
    
    const htmlReportPath = await generateHTMLReport();
    const memoryResults = await storeResultsInMemory();

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 E2E TEST SUITE COMPLETE');
    console.log('='.repeat(60));
    console.log(`📁 Reports Directory: ${TEST_CONFIG.reportsDir}`);
    console.log(`📊 JSON Report: ${jsonReportPath}`);
    console.log(`🌐 HTML Report: ${htmlReportPath}`);
    console.log(`💾 Memory Results: ${path.join(TEST_CONFIG.reportsDir, 'memory-results.json')}`);
    console.log('');
    console.log(`📈 Total Tests: ${aggregatedResults.summary.totalTests}`);
    console.log(`✅ Passed: ${aggregatedResults.summary.totalPassed}`);
    console.log(`❌ Failed: ${aggregatedResults.summary.totalFailed}`);
    console.log(`🎯 Success Rate: ${aggregatedResults.summary.successRate.toFixed(1)}%`);
    console.log(`⏱️  Total Time: ${aggregatedResults.summary.totalTime}ms`);

    if (aggregatedResults.summary.totalFailed > 0) {
      console.log('\n❌ FAILED SUITES:');
      aggregatedResults.suites
        .filter(suite => !suite.success)
        .forEach(suite => {
          console.log(`  • ${suite.suiteName}: ${suite.errors?.[0] || 'Unknown error'}`);
        });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    memoryResults.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    return aggregatedResults;

  } catch (error) {
    console.error('💥 E2E test suite failed:', error);
    throw error;
  }
}

// Export for programmatic use
export { aggregatedResults, runE2ETests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests()
    .then(results => {
      process.exit(results.summary.totalFailed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}