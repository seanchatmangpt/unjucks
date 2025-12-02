/**
 * KGEN E2E Test Runner Configuration
 * 
 * Configures Cucumber.js for running comprehensive E2E test suites
 * with proper timeouts, parallelization, and reporting.
 */

import { setDefaultTimeout, After, Before, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { promises as fs } from 'fs';
import path from 'path';

// Set extended timeouts for E2E tests
setDefaultTimeout(120000); // 2 minutes for individual steps
const SCENARIO_TIMEOUT = 600000; // 10 minutes for complete scenarios

/**
 * Test configuration interface
 * @typedef {Object} TestConfig
 * @property {string} workspace - Test workspace directory
 * @property {string} reportDir - Test reports directory
 * @property {'debug'|'info'|'warn'|'error'} logLevel - Logging level
 * @property {boolean} enableMetrics - Whether to enable test metrics
 * @property {number} parallelWorkers - Number of parallel workers
 * @property {number} retryAttempts - Number of retry attempts
 */

/** @type {TestConfig} */
const testConfig = {
  workspace: path.join(__dirname, '../../../test-workspace'),
  reportDir: path.join(__dirname, '../../../test-reports'),
  logLevel: process.env.TEST_LOG_LEVEL || 'info',
  enableMetrics: process.env.ENABLE_TEST_METRICS === 'true',
  parallelWorkers: parseInt(process.env.TEST_PARALLEL_WORKERS || '2'),
  retryAttempts: parseInt(process.env.TEST_RETRY_ATTEMPTS || '1')
};

/**
 * Global test state interface
 * @typedef {Object} GlobalTestState
 * @property {number} startTime - Test suite start time
 * @property {number} totalScenarios - Total number of scenarios
 * @property {number} passedScenarios - Number of passed scenarios
 * @property {number} failedScenarios - Number of failed scenarios
 * @property {number} skippedScenarios - Number of skipped scenarios
 * @property {Array<TestMetric>} testMetrics - Array of test metrics
 */

/**
 * Test metric interface
 * @typedef {Object} TestMetric
 * @property {string} scenario - Scenario name
 * @property {number} duration - Duration in milliseconds
 * @property {'passed'|'failed'|'skipped'} status - Test status
 * @property {number} steps - Number of steps
 * @property {number} memory - Memory usage in bytes
 */

/** @type {GlobalTestState} */
let globalState = {
  startTime: 0,
  totalScenarios: 0,
  passedScenarios: 0,
  failedScenarios: 0,
  skippedScenarios: 0,
  testMetrics: []
};

// =============================================================================
// GLOBAL HOOKS
// =============================================================================

BeforeAll(async function() {
  console.log('🚀 Starting KGEN E2E Test Suite');
  console.log(`Configuration:
  - Workspace: ${testConfig.workspace}
  - Report Dir: ${testConfig.reportDir}
  - Log Level: ${testConfig.logLevel}
  - Metrics: ${testConfig.enableMetrics ? 'enabled' : 'disabled'}
  - Parallel Workers: ${testConfig.parallelWorkers}
  - Retry Attempts: ${testConfig.retryAttempts}`);
  
  globalState.startTime = Date.now();
  
  // Ensure directories exist
  await fs.mkdir(testConfig.workspace, { recursive: true });
  await fs.mkdir(testConfig.reportDir, { recursive: true });
  
  // Clean up any previous test runs
  try {
    const workspaceContents = await fs.readdir(testConfig.workspace);
    for (const item of workspaceContents) {
      if (item.startsWith('e2e-') || item.startsWith('cli-') || 
          item.startsWith('benchmark-') || item.startsWith('integration-')) {
        await fs.rm(path.join(testConfig.workspace, item), { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.warn('Could not clean workspace:', error.message);
  }
  
  // Set up process handlers for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⚠️  Test suite interrupted. Cleaning up...');
    await cleanupAndExit(1);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n⚠️  Test suite terminated. Cleaning up...');
    await cleanupAndExit(1);
  });
});

AfterAll(async function() {
  const endTime = Date.now();
  const totalDuration = endTime - globalState.startTime;
  
  console.log('\n📊 KGEN E2E Test Suite Summary');
  console.log('='.repeat(50));
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Scenarios: ${globalState.totalScenarios}`);
  console.log(`✅ Passed: ${globalState.passedScenarios}`);
  console.log(`❌ Failed: ${globalState.failedScenarios}`);
  console.log(`⏸️  Skipped: ${globalState.skippedScenarios}`);
  
  if (globalState.testMetrics.length > 0) {
    const avgDuration = globalState.testMetrics
      .reduce((sum, m) => sum + m.duration, 0) / globalState.testMetrics.length;
    const avgMemory = globalState.testMetrics
      .reduce((sum, m) => sum + m.memory, 0) / globalState.testMetrics.length;
    
    console.log(`\n📈 Performance Metrics:`);
    console.log(`Average Scenario Duration: ${(avgDuration / 1000).toFixed(2)}s`);
    console.log(`Average Memory Usage: ${(avgMemory / (1024 * 1024)).toFixed(2)}MB`);
    
    // Identify slowest scenarios
    const slowest = globalState.testMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);
    
    if (slowest.length > 0) {
      console.log(`\n🐌 Slowest Scenarios:`);
      slowest.forEach((metric, index) => {
        console.log(`${index + 1}. ${metric.scenario}: ${(metric.duration / 1000).toFixed(2)}s`);
      });
    }
  }
  
  // Generate test report
  const reportData = {
    summary: {
      totalDuration,
      totalScenarios: globalState.totalScenarios,
      passedScenarios: globalState.passedScenarios,
      failedScenarios: globalState.failedScenarios,
      skippedScenarios: globalState.skippedScenarios,
      successRate: globalState.totalScenarios > 0 
        ? (globalState.passedScenarios / globalState.totalScenarios) * 100 
        : 0
    },
    metrics: globalState.testMetrics,
    config: testConfig,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage()
    }
  };
  
  const reportPath = path.join(testConfig.reportDir, `e2e-test-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
  
  console.log(`\n📄 Test report saved: ${reportPath}`);
  
  // Success rate validation
  const successRate = reportData.summary.successRate;
  if (successRate < 95) {
    console.log(`\n⚠️  WARNING: Success rate ${successRate.toFixed(1)}% below 95% threshold`);
  } else {
    console.log(`\n✨ SUCCESS: ${successRate.toFixed(1)}% success rate achieved`);
  }
  
  await cleanupWorkspace();
});

// =============================================================================
// SCENARIO HOOKS
// =============================================================================

Before(async function(scenario) {
  globalState.totalScenarios++;
  
  if (testConfig.logLevel === 'debug') {
    console.log(`\n🔍 Starting scenario: ${scenario.pickle.name}`);
  }
  
  // Store scenario start time and memory
  this.scenarioStartTime = Date.now();
  this.scenarioStartMemory = process.memoryUsage().heapUsed;
  this.scenarioName = scenario.pickle.name;
  this.stepCount = 0;
});

After(async function(scenario) {
  const endTime = Date.now();
  const duration = endTime - (this.scenarioStartTime || endTime);
  const memoryUsed = process.memoryUsage().heapUsed;
  
  /** @type {'passed'|'failed'|'skipped'} */
  let status = 'passed';
  
  if (scenario.result?.status === 'FAILED') {
    status = 'failed';
    globalState.failedScenarios++;
    
    console.log(`\n❌ FAILED: ${scenario.pickle.name}`);
    if (scenario.result.message) {
      console.log(`Error: ${scenario.result.message}`);
    }
  } else if (scenario.result?.status === 'SKIPPED') {
    status = 'skipped';
    globalState.skippedScenarios++;
    
    console.log(`\n⏸️  SKIPPED: ${scenario.pickle.name}`);
  } else {
    globalState.passedScenarios++;
    
    if (testConfig.logLevel === 'debug') {
      console.log(`\n✅ PASSED: ${scenario.pickle.name} (${(duration / 1000).toFixed(2)}s)`);
    }
  }
  
  if (testConfig.enableMetrics) {
    globalState.testMetrics.push({
      scenario: scenario.pickle.name,
      duration,
      status,
      steps: this.stepCount || 0,
      memory: memoryUsed
    });
  }
  
  // Garbage collection after each scenario to maintain clean state
  if (global.gc) {
    global.gc();
  }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clean up test workspace
 * @returns {Promise<void>}
 */
async function cleanupWorkspace() {
  try {
    const workspaceContents = await fs.readdir(testConfig.workspace);
    for (const item of workspaceContents) {
      if (item.startsWith('e2e-') || item.startsWith('cli-') || 
          item.startsWith('benchmark-') || item.startsWith('integration-')) {
        await fs.rm(path.join(testConfig.workspace, item), { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.warn('Could not clean workspace during cleanup:', error.message);
  }
}

/**
 * Clean up and exit process
 * @param {number} exitCode - Exit code
 * @returns {Promise<void>}
 */
async function cleanupAndExit(exitCode) {
  await cleanupWorkspace();
  process.exit(exitCode);
}

// Custom timeout for specific step patterns
const stepTimeouts = new Map([
  ['benchmark', 300000], // 5 minutes for benchmark steps
  ['stress', 300000],    // 5 minutes for stress test steps  
  ['workflow', 180000],  // 3 minutes for workflow steps
  ['concurrent', 120000], // 2 minutes for concurrent steps
  ['validate', 60000],   // 1 minute for validation steps
]);

// Apply custom timeouts based on step text
Before('@timeout', async function() {
  // This will be applied to scenarios tagged with @timeout
  setDefaultTimeout(SCENARIO_TIMEOUT);
});

// Export configuration for use in step definitions
export { 
  testConfig, 
  globalState,
  stepTimeouts,
  SCENARIO_TIMEOUT 
};

// Add utility methods to World prototype
const { World } = await import('@cucumber/cucumber');

/**
 * Log debug message
 * @param {string} message - Message to log
 */
World.prototype.logDebug = function(message) {
  if (testConfig.logLevel === 'debug') {
    console.log(`[DEBUG] ${message}`);
  }
};

/**
 * Log info message
 * @param {string} message - Message to log
 */
World.prototype.logInfo = function(message) {
  if (['debug', 'info'].includes(testConfig.logLevel)) {
    console.log(`[INFO] ${message}`);
  }
};

/**
 * Log warning message
 * @param {string} message - Message to log
 */
World.prototype.logWarn = function(message) {
  if (['debug', 'info', 'warn'].includes(testConfig.logLevel)) {
    console.warn(`[WARN] ${message}`);
  }
};

/**
 * Log error message
 * @param {string} message - Message to log
 */
World.prototype.logError = function(message) {
  console.error(`[ERROR] ${message}`);
};

/**
 * Execute function with timeout
 * @template T
 * @param {() => Promise<T> | T} fn - Function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} [errorMessage] - Custom error message
 * @returns {Promise<T>}
 */
World.prototype.expectWithinTimeout = async function(
  fn,
  timeout,
  errorMessage
) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeout}ms`));
    }, timeout);
    
    try {
      const result = await fn();
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
};