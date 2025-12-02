/**
 * Cucumber.js Configuration for KGEN E2E Tests
 * 
 * Configures Cucumber.js for comprehensive E2E testing with:
 * - Extended timeouts for complex workflows
 * - Parallel execution support  
 * - Comprehensive reporting
 * - Environment-specific settings
 */

const path = require('path');

const config = {
  // Test file patterns
  features: [
    'kgen/features/**/*.feature'
  ],
  
  // Step definition files
  import: [
    'kgen/features/step_definitions/**/*.ts',
    'kgen/features/step_definitions/**/*.js'
  ],
  
  // Require modules for setup
  require: [
    'ts-node/register',
    'kgen/features/step_definitions/test_runner_config.ts'
  ],
  
  // TypeScript configuration
  requireModule: [
    'ts-node/register'
  ],
  
  // Output format
  format: [
    'progress-bar',
    'json:test-reports/cucumber-report.json',
    'html:test-reports/cucumber-report.html',
    '@cucumber/pretty-formatter'
  ],
  
  // Parallel execution
  parallel: process.env.TEST_PARALLEL_WORKERS ? parseInt(process.env.TEST_PARALLEL_WORKERS) : 2,
  
  // Retry failed scenarios
  retry: process.env.TEST_RETRY_ATTEMPTS ? parseInt(process.env.TEST_RETRY_ATTEMPTS) : 1,
  
  // Timeouts (in milliseconds)  
  timeout: 120000, // 2 minutes default
  
  // Tags for filtering tests
  tags: process.env.TEST_TAGS || '',
  
  // World parameters
  worldParameters: {
    // Test configuration
    workspace: path.join(__dirname, 'test-workspace'),
    reportDir: path.join(__dirname, 'test-reports'),
    logLevel: process.env.TEST_LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_TEST_METRICS === 'true',
    
    // Performance targets
    performanceTargets: {
      renderTimeP95: 150, // ms
      cacheHitRate: 0.80,
      memoryGrowthLimit: 0.50, // 50%
      throughputMinimum: 50, // ops/sec
      successRateMinimum: 0.95 // 95%
    },
    
    // Engine configuration
    engines: {
      cas: {
        storageType: 'memory',
        cacheSize: 10000,
        enableMetrics: true
      },
      template: {
        deterministic: true,
        enableCache: true
      },
      provenance: {
        storageBackend: 'memory',
        enableCryptographicProofs: true,
        enableTimestamping: true
      },
      performance: {
        enableRealTime: true,
        sampleRate: 1.0
      },
      rdf: {
        enableInference: true,
        enableValidation: true
      }
    }
  },
  
  // Exit on first failure (for debugging)
  failFast: process.env.TEST_FAIL_FAST === 'true',
  
  // Dry run (validate scenarios without execution)
  dryRun: process.env.TEST_DRY_RUN === 'true',
  
  // Strict mode (fail on undefined steps)
  strict: true,
  
  // Snippets (generate missing step definitions)
  snippets: true,
  snippetInterface: 'async-await',
  snippetSyntax: 'kgen/features/step_definitions/custom-snippet-syntax.js'
};

// Environment-specific configurations
const environment = process.env.NODE_ENV || 'test';

switch (environment) {
  case 'development':
    // Development: More verbose, shorter timeouts
    config.format.push('progress');
    config.timeout = 60000; // 1 minute
    config.parallel = 1; // No parallelization for debugging
    break;
    
  case 'ci':
    // CI: Optimized for CI/CD pipelines
    config.format = [
      'json:test-reports/cucumber-report.json',
      'junit:test-reports/cucumber-junit.xml'
    ];
    config.timeout = 300000; // 5 minutes for CI
    config.parallel = Math.max(1, require('os').cpus().length - 1);
    config.retry = 2; // Retry flaky tests in CI
    break;
    
  case 'performance':
    // Performance: Focus on benchmark and load tests
    config.tags = '@performance or @benchmark or @stress';
    config.timeout = 600000; // 10 minutes for performance tests
    config.parallel = 1; // Sequential for accurate performance measurement
    config.retry = 0; // No retries for performance tests
    break;
    
  case 'integration':
    // Integration: Focus on engine integration tests
    config.tags = '@integration or @engines or @e2e';
    config.timeout = 180000; // 3 minutes for integration tests
    config.parallel = 2;
    break;
    
  case 'comprehensive':
    // Comprehensive: All tests with extended timeouts
    config.timeout = 600000; // 10 minutes for comprehensive tests
    config.parallel = Math.min(4, require('os').cpus().length);
    config.retry = 1;
    break;
    
  default:
    // Test (default): Balanced configuration
    break;
}

// Override with environment variables
if (process.env.CUCUMBER_TIMEOUT) {
  config.timeout = parseInt(process.env.CUCUMBER_TIMEOUT);
}

if (process.env.CUCUMBER_PARALLEL) {
  config.parallel = parseInt(process.env.CUCUMBER_PARALLEL);
}

if (process.env.CUCUMBER_RETRY) {
  config.retry = parseInt(process.env.CUCUMBER_RETRY);
}

// Tag-based timeout overrides
const tagTimeouts = {
  '@benchmark': 300000,    // 5 minutes
  '@stress': 300000,       // 5 minutes
  '@load': 600000,         // 10 minutes
  '@comprehensive': 900000, // 15 minutes
  '@ultimate': 1800000     // 30 minutes
};

// Apply tag-based timeouts (this is a workaround since Cucumber doesn't support per-tag timeouts)
if (config.tags) {
  for (const [tag, timeout] of Object.entries(tagTimeouts)) {
    if (config.tags.includes(tag)) {
      config.timeout = Math.max(config.timeout, timeout);
    }
  }
}

module.exports = config;