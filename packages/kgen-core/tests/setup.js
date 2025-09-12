/**
 * Test setup for kgen-core
 * Configures global test environment, mocks, and utilities
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

// Test directories
const TEST_ROOT = resolve(process.cwd(), 'tests');
const TEST_TEMP_DIR = resolve(tmpdir(), 'kgen-test');
const TEST_FIXTURES_DIR = resolve(TEST_ROOT, 'fixtures');

// Global test environment
global.__TEST_ROOT__ = TEST_ROOT;
global.__TEST_TEMP__ = TEST_TEMP_DIR;
global.__TEST_FIXTURES__ = TEST_FIXTURES_DIR;

// Test utilities
global.testUtils = {
  createTempDir: () => {
    const tempDir = resolve(TEST_TEMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },
  
  cleanupTempDir: (dir) => {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  
  // Mock logger for deterministic tests
  createMockLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn()
  })
};

// Setup before each test
beforeEach(() => {
  // Ensure test temp directory exists
  if (!existsSync(TEST_TEMP_DIR)) {
    mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
  
  // Mock console methods to avoid noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after each test
afterEach(() => {
  // Restore all mocks
  vi.restoreAllMocks();
  
  // Clean up any test temp files
  if (existsSync(TEST_TEMP_DIR)) {
    try {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  }
});

// Deterministic test environment
process.env.NODE_ENV = 'test';
process.env.KGEN_DISABLE_CACHE = 'true';
process.env.KGEN_TEST_MODE = 'true';
