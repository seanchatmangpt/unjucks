/**
 * Environment configuration for Cucumber tests
 * This file sets up the test environment and configures global settings
 */

// Configure test environment
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "warn";

// Test-specific environment variables
const testConfig = {
  // Base URL for API tests
  BASE_URL: process.env.BASE_URL || "http://localhost:3000",
  
  // Test timeouts
  DEFAULT_TIMEOUT: Number.parseInt(process.env.DEFAULT_TIMEOUT || "30000", 10),
  SLOW_TIMEOUT: Number.parseInt(process.env.SLOW_TIMEOUT || "60000", 10),
  PERFORMANCE_TIMEOUT: Number.parseInt(process.env.PERFORMANCE_TIMEOUT || "120000", 10),
  
  // Test data
  TEST_DATA_DIR: process.env.TEST_DATA_DIR || "tests/fixtures",
  
  // Debug settings
  DEBUG: process.env.DEBUG === "true",
  VERBOSE: process.env.VERBOSE === "true",
  
  // Parallel execution
  PARALLEL: process.env.PARALLEL ? Number.parseInt(process.env.PARALLEL, 10) : 2,
  
  // Retry settings
  RETRY_ATTEMPTS: Number.parseInt(process.env.RETRY_ATTEMPTS || "1", 10),
  
  // Browser settings (if using browser automation)
  HEADLESS: process.env.HEADLESS !== "false",
  BROWSER: process.env.BROWSER || "chrome",
  
  // Database settings (if needed)
  DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  
  // External service endpoints
  API_ENDPOINT: process.env.API_ENDPOINT || "http://localhost:3001/api",
  
  // Feature flags for testing
  ENABLE_FEATURE_X: process.env.ENABLE_FEATURE_X === "true",
  
  // File system settings
  TEMP_DIR: process.env.TEMP_DIR || "/tmp/unjucks-test",
  
  // Git settings for testing
  GIT_AUTHOR_NAME: "Test User",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test User",
  GIT_COMMITTER_EMAIL: "test@example.com"
};

// Set environment variables
for (const [key, value] of Object.entries(testConfig)) {
  if (value !== undefined) {
    process.env[key] = String(value);
  }
}

// Configure test-specific global settings
if (testConfig.DEBUG) {
  console.log("🐛 Debug mode enabled");
  console.log("Test configuration:", testConfig);
}

// Suppress console output in tests unless verbose mode is enabled
if (!testConfig.VERBOSE && !testConfig.DEBUG) {
  const originalConsole = globalThis.console;
  globalThis.console = {
    ...originalConsole,
    log: () => {},
    info: () => {},
    debug: () => {},
    // Keep error and warn for important messages
    error: originalConsole.error,
    warn: originalConsole.warn
  };
}

// Handle uncaught exceptions and rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in test environment, just log
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in test environment, just log
});

// Export configuration for use in tests
export { testConfig };

// Make testConfig available globally
globalThis.testConfig = testConfig;