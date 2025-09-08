/**
 * Global test setup for Unjucks test suite
 * Sets up common test utilities, mocks, and environment configuration
 */

import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Setup test environment constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
global.TEST_ROOT = path.resolve(__dirname, '..');
global.PROJECT_ROOT = path.resolve(__dirname, '../..');
global.FIXTURES_DIR = path.join(global.TEST_ROOT, 'fixtures');
global.TEMP_DIR = path.join(global.TEST_ROOT, 'temp');

// Ensure test directories exist
beforeAll(async () => {
  await fs.ensureDir(global.TEMP_DIR);
  await fs.ensureDir(path.join(global.FIXTURES_DIR, 'turtle'));
  await fs.ensureDir(path.join(global.FIXTURES_DIR, 'templates'));
  await fs.ensureDir(path.join(global.FIXTURES_DIR, 'documents'));
});

// Cleanup after tests
afterAll(async () => {
  // Only clean up temp directory, keep fixtures for debugging
  try {
    await fs.remove(global.TEMP_DIR);
  } catch (error) {
    console.warn('Failed to cleanup temp directory:', error.message);
  }
});

// Global test utilities
global.testUtils = {
  /**
   * Create a temporary test file
   */
  async createTempFile(filename, content) {
    const filepath = path.join(global.TEMP_DIR, filename);
    await fs.writeFile(filepath, content, 'utf8');
    return filepath;
  },
  
  /**
   * Create a temporary directory
   */
  async createTempDir(dirname) {
    const dirpath = path.join(global.TEMP_DIR, dirname);
    await fs.ensureDir(dirpath);
    return dirpath;
  },
  
  /**
   * Read fixture file
   */
  async readFixture(category, filename) {
    const filepath = path.join(global.FIXTURES_DIR, category, filename);
    return await fs.readFile(filepath, 'utf8');
  },
  
  /**
   * Generate random test data
   */
  generateRandomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  },
  
  /**
   * Assert file exists and has content
   */
  async assertFileExists(filepath) {
    const exists = await fs.pathExists(filepath);
    expect(exists).toBe(true);
    
    const stats = await fs.stat(filepath);
    expect(stats.size).toBeGreaterThan(0);
    
    return stats;
  },
  
  /**
   * Performance timer utility
   */
  timer() {
    const start = process.hrtime.bigint();
    return {
      end() {
        const end = process.hrtime.bigint();
        return Number(end - start) / 1_000_000; // Convert to milliseconds
      }
    };
  }
};

// Mock external dependencies that might not be available in test environment
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({})
}));

// Suppress console output during tests unless explicitly needed
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Set test timeouts
jest.setTimeout(30000);

// Custom matchers
expect.extend({
  toBeValidTurtle(received) {
    const pass = typeof received === 'string' && received.length > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be valid Turtle`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be valid Turtle`,
        pass: false,
      };
    }
  },
  
  toHaveTripleCount(received, expected) {
    const pass = received.triples && received.triples.length === expected;
    if (pass) {
      return {
        message: () => `expected ${received.triples.length} not to equal ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received.triples?.length || 0} to equal ${expected}`,
        pass: false,
      };
    }
  }
});