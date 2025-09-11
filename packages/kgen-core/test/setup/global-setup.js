/**
 * Global Test Setup for KGEN Core
 * Ensures deterministic test environment and proper cleanup
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import fs from 'fs-extra';
import { TestDatabase } from '../utils/test-database.js';
import { MockProvenanceTracker } from '../mocks/provenance-tracker.js';
import { TestLogger } from '../utils/test-logger.js';

// Global test state
let testDatabase;
let testOutputDir;
let originalConsole;

/**
 * Global setup before all tests
 */
beforeAll(async () => {
  // Setup deterministic test environment
  process.env.NODE_ENV = 'test';
  process.env.KGEN_TEST_MODE = 'true';
  process.env.TZ = 'UTC'; // Ensure consistent timezone
  
  // Create test output directory
  testOutputDir = resolve(process.cwd(), 'test-output');
  await fs.ensureDir(testOutputDir);
  
  // Initialize test database
  testDatabase = new TestDatabase();
  await testDatabase.initialize();
  
  // Setup test logger to capture logs deterministically
  const testLogger = new TestLogger();
  originalConsole = console;
  
  // Replace console methods for deterministic testing
  console.log = testLogger.log.bind(testLogger);
  console.error = testLogger.error.bind(testLogger);
  console.warn = testLogger.warn.bind(testLogger);
  console.info = testLogger.info.bind(testLogger);
  
  // Setup global test utilities
  global.testUtils = {
    database: testDatabase,
    logger: testLogger,
    outputDir: testOutputDir,
    createTempDir: () => fs.mkdtemp(resolve(testOutputDir, 'temp-')),
    cleanupTempDir: (dir) => fs.remove(dir)
  };
});

/**
 * Global cleanup after all tests
 */
afterAll(async () => {
  // Restore original console
  if (originalConsole) {
    Object.assign(console, originalConsole);
  }
  
  // Cleanup test database
  if (testDatabase) {
    await testDatabase.cleanup();
  }
  
  // Cleanup test output directory
  if (testOutputDir && await fs.pathExists(testOutputDir)) {
    await fs.remove(testOutputDir);
  }
  
  // Reset environment
  delete process.env.KGEN_TEST_MODE;
});

/**
 * Setup before each test for isolation
 */
beforeEach(async () => {
  // Reset test database state
  if (testDatabase) {
    await testDatabase.reset();
  }
  
  // Clear test logger
  if (global.testUtils?.logger) {
    global.testUtils.logger.clear();
  }
  
  // Reset Date.now for deterministic timestamps
  const mockNow = new Date('2024-01-01T00:00:00.000Z').getTime();
  global.mockTimestamp = mockNow;
  
  // Mock Date.now for deterministic tests
  const originalDateNow = Date.now;
  Date.now = () => global.mockTimestamp || originalDateNow();
  
  // Store original for cleanup
  global.originalDateNow = originalDateNow;
});

/**
 * Cleanup after each test for isolation
 */
afterEach(async () => {
  // Restore Date.now
  if (global.originalDateNow) {
    Date.now = global.originalDateNow;
    delete global.originalDateNow;
    delete global.mockTimestamp;
  }
  
  // Clear any test-specific data
  if (global.testUtils?.database) {
    await global.testUtils.database.reset();
  }
});