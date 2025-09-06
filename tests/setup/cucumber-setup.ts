import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

// Global test setup for Cucumber/BDD tests
beforeAll(async () => {
  // Ensure test directories exist
  const testDirs = [
    'tests/fixtures/temp',
    'tests/output',
    'tests/cache'
  ];
  
  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
  }
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.UNJUCKS_CACHE_DIR = 'tests/cache';
  process.env.UNJUCKS_LOG_LEVEL = 'error';
});

beforeEach(async () => {
  // Clean up temp files before each test
  const tempDir = 'tests/fixtures/temp';
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

afterEach(async () => {
  // Clean up after each test
  const cleanupDirs = [
    'tests/fixtures/temp',
    'tests/output'
  ];
  
  for (const dir of cleanupDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

afterAll(async () => {
  // Final cleanup
  const cleanupDirs = [
    'tests/fixtures/temp',
    'tests/output',
    'tests/cache'
  ];
  
  for (const dir of cleanupDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});