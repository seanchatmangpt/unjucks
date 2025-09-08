/**
 * Global Test Setup
 * Configure test environment and shared utilities
 */

import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Global test state
global.testState = {
  tempDirs: new Set(),
  originalCwd: process.cwd(),
  startTime: Date.now()
};

// Custom matchers for comprehensive testing
import { expect } from 'vitest';

expect.extend({
  // CLI result matchers
  toBeSuccessfulCLI(received) {
    const pass = received.exitCode === 0 && received.success === true;
    return {
      message: () => 
        pass 
          ? `Expected CLI to fail but it succeeded`
          : `Expected CLI to succeed but got exit code ${received.exitCode}\\nStderr: ${received.stderr}`,
      pass
    };
  },

  toHaveExitCode(received, expected) {
    const pass = received.exitCode === expected;
    return {
      message: () => `Expected exit code ${expected} but got ${received.exitCode}`,
      pass
    };
  },

  toContainOutput(received, expected) {
    const output = received.stdout + received.stderr;
    const pass = output.includes(expected);
    return {
      message: () => `Expected output to contain "${expected}" but got:\\n${output}`,
      pass
    };
  },

  // Performance matchers
  toCompleteWithin(received, maxMs) {
    const pass = received.duration <= maxMs;
    return {
      message: () => `Expected operation to complete within ${maxMs}ms but took ${received.duration}ms`,
      pass
    };
  },

  toUseMemoryLessThan(received, maxMB) {
    const usageMB = received.heapUsed / (1024 * 1024);
    const pass = usageMB <= maxMB;
    return {
      message: () => `Expected memory usage less than ${maxMB}MB but used ${usageMB.toFixed(2)}MB`,
      pass
    };
  },

  // File system matchers
  toBeDirectory(received) {
    try {
      const stats = fs.statSync(received);
      const pass = stats.isDirectory();
      return {
        message: () => `Expected ${received} to be a directory`,
        pass
      };
    } catch {
      return {
        message: () => `Expected ${received} to exist and be a directory`,
        pass: false
      };
    }
  },

  toBeFile(received) {
    try {
      const stats = fs.statSync(received);
      const pass = stats.isFile();
      return {
        message: () => `Expected ${received} to be a file`,
        pass
      };
    } catch {
      return {
        message: () => `Expected ${received} to exist and be a file`,
        pass: false
      };
    }
  },

  // Template matchers
  toHaveValidTemplateStructure(received) {
    try {
      const stats = fs.statSync(received);
      if (!stats.isDirectory()) {
        return { message: () => `Expected ${received} to be a directory`, pass: false };
      }

      // Check for common template patterns
      const hasNjkFiles = fs.readdirSync(received, { recursive: true })
        .some(file => file.endsWith('.njk'));
      
      return {
        message: () => `Expected ${received} to contain .njk template files`,
        pass: hasNjkFiles
      };
    } catch {
      return {
        message: () => `Expected ${received} to exist and be a valid template directory`,
        pass: false
      };
    }
  },

  // Array utility matchers
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      message: () => `Expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});

// Global test hooks
beforeAll(async () => {
  console.log('🚀 Starting comprehensive test suite...');
  
  // Ensure test directories exist
  await fs.ensureDir(path.join(projectRoot, 'tests/temp'));
  await fs.ensureDir(path.join(projectRoot, 'coverage'));
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.COVERAGE_MODE = 'true';
  
  // Initialize coverage tracking
  if (global.__coverage__) {
    console.log('📊 Code coverage tracking enabled');
  }
});

afterAll(async () => {
  const duration = Date.now() - global.testState.startTime;
  console.log(`✅ Test suite completed in ${duration}ms`);
  
  // Cleanup all temp directories
  for (const tempDir of global.testState.tempDirs) {
    try {
      await fs.remove(tempDir);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup ${tempDir}:`, error.message);
    }
  }
  
  // Restore original working directory
  process.chdir(global.testState.originalCwd);
  
  // Generate coverage summary if available
  if (global.__coverage__) {
    console.log('📈 Generating coverage report...');
  }
});

beforeEach(async () => {
  // Clear module cache for fresh imports
  if (process.env.CLEAR_MODULE_CACHE === 'true') {
    Object.keys(require.cache).forEach(key => {
      if (key.includes(projectRoot) && !key.includes('node_modules')) {
        delete require.cache[key];
      }
    });
  }
});

afterEach(async () => {
  // Cleanup any leaked temp directories
  const tempDirsToClean = Array.from(global.testState.tempDirs);
  global.testState.tempDirs.clear();
  
  for (const tempDir of tempDirsToClean) {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup temp directory ${tempDir}:`, error.message);
    }
  }
  
  // Force garbage collection if available
  if (global.gc && Math.random() < 0.1) { // 10% chance
    global.gc();
  }
});

// Global utility functions for tests
global.createTempDir = async function(prefix = 'unjucks-test-') {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  global.testState.tempDirs.add(tempDir);
  return tempDir;
};

global.cleanupTempDir = async function(tempDir) {
  global.testState.tempDirs.delete(tempDir);
  if (tempDir && await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }
};

global.withTempDir = async function(callback, prefix = 'unjucks-test-') {
  const tempDir = await global.createTempDir(prefix);
  const originalCwd = process.cwd();
  
  try {
    process.chdir(tempDir);
    return await callback(tempDir);
  } finally {
    process.chdir(originalCwd);
    await global.cleanupTempDir(tempDir);
  }
};

// Performance monitoring
global.measurePerformance = async function(operation, name = 'operation') {
  const start = process.hrtime.bigint();
  const memoryBefore = process.memoryUsage();
  
  const result = await operation();
  
  const end = process.hrtime.bigint();
  const memoryAfter = process.memoryUsage();
  
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  const memoryDelta = {
    heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
    heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal
  };
  
  return {
    result,
    performance: {
      name,
      duration,
      memoryDelta
    }
  };
};

// Test data generators
global.generateTestData = {
  randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  
  randomSafeString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  
  validTemplateNames() {
    return ['component', 'service', 'api', 'model', 'controller', 'middleware', 'utility'];
  },
  
  validComponentNames() {
    return ['Button', 'Modal', 'Form', 'Table', 'Card', 'Navigation', 'Header', 'Footer'];
  }
};

// Console enhancement for better test output
const originalConsole = { ...console };

console.testInfo = (message) => {
  if (process.env.VERBOSE_TESTS) {
    originalConsole.log(`ℹ️  ${message}`);
  }
};

console.testWarn = (message) => {
  if (process.env.VERBOSE_TESTS) {
    originalConsole.warn(`⚠️  ${message}`);
  }
};

console.testError = (message) => {
  originalConsole.error(`❌ ${message}`);
};

// Test statistics
global.testStats = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  
  increment(type) {
    this[type]++;
  },
  
  getSummary() {
    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      skipped: this.skippedTests,
      successRate: this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0
    };
  }
};

export {
  global
};