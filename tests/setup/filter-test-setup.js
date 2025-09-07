/**
 * Setup for filter testing with vitest-cucumber
 * Configures Nunjucks environment and test utilities
 */

import { beforeEach, afterEach } from 'vitest';
import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import fs from 'fs-extra';
import path from 'path';

// Global test configuration
globalThis.testConfig = {
  tempDir: path.join(process.cwd(), 'tests/.tmp'),
  fixturesDir: path.join(process.cwd(), 'tests/fixtures'),
  outputDir: path.join(process.cwd(), 'tests/output')
};

// Set faker seed for consistent testing
faker.seed(12345);

// Setup before each test
beforeEach(async () => {
  // Clean up temp directories
  await fs.emptyDir(globalThis.testConfig.tempDir);
  await fs.ensureDir(globalThis.testConfig.outputDir);
});

// Cleanup after each test
afterEach(async () => {
  // Clean up test files but preserve for debugging if needed
  const preserveTestFiles = process.env.PRESERVE_TEST_FILES === 'true';
  if (!preserveTestFiles) {
    await fs.emptyDir(globalThis.testConfig.tempDir);
  }
});