/**
 * Comprehensive Test Coverage Configuration
 * Vitest configuration for 100% test coverage
 */

import { defineConfig } from "vitest/config";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    // Test environment
    environment: "node",
    globals: true,
    
    // Include all test types for comprehensive coverage
    include: [
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js",
      "tests/performance/**/*.test.js",
      "tests/security/**/*.test.js",
      "tests/property/**/*.test.js",
      "tests/contracts/**/*.test.js",
      "tests/smoke/**/*.test.js"
    ],
    
    // Exclude problematic or backup files
    exclude: [
      "node_modules/**",
      "dist/**",
      "tests/**/*.bak*",
      "tests/**/*.spec.js", // Old spec files
      "tests/temp/**",
      "tests/fixtures/**"
    ],
    
    // Comprehensive coverage configuration
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'text-summary', 
        'html',
        'json',
        'lcov',
        'cobertura'
      ],
      
      // Include all source files
      include: [
        "src/**/*.js",
        "bin/**/*.cjs"
      ],
      
      // Exclude test files and non-production code
      exclude: [
        "src/**/*.test.js",
        "src/**/*.spec.js",
        "tests/**/*.js",
        "scripts/**/*.js",
        "docs/**/*.js",
        "examples/**/*.js",
        "_templates/**/*.js",
        "config/**/*.js",
        "**/*.config.js",
        "**/*.config.cjs"
      ],
      
      // Comprehensive coverage thresholds (100% target)
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        
        // Per-file thresholds for critical modules
        "src/cli/index.js": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        
        "src/commands/*.js": {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        
        "src/lib/*.js": {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      },
      
      // Coverage reporting options
      reportOnFailure: true,
      skipFull: false,
      all: true,
      
      // Output directories
      reportsDirectory: './coverage',
      tempDirectory: './coverage/tmp'
    },
    
    // Test execution configuration
    testTimeout: 30_000,
    hookTimeout: 10_000,
    teardownTimeout: 5_000,
    
    // Parallel execution for performance
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 8,
        useAtomics: true
      }
    },
    
    // Comprehensive test reporting
    reporters: [
      'default',
      'verbose',
      'json',
      'html'
    ],
    
    // Output configuration
    outputFile: {
      json: './coverage/test-results.json',
      html: './coverage/test-report.html'
    },
    
    // Mock and setup configuration
    setupFiles: [
      './tests/setup/global-setup.js'
    ],
    
    // Global test configuration
    globalSetup: './tests/setup/vitest-global-setup.js',
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Bail on first failure in CI
    bail: process.env.CI ? 1 : 0,
    
    // Watch mode configuration
    watch: false, // Disable for coverage runs
    
    // Performance monitoring
    logHeapUsage: true,
    
    // Test isolation
    isolate: true,
    passWithNoTests: false,
    
    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return path.join(
        path.dirname(testPath),
        '__snapshots__',
        path.basename(testPath) + snapExtension
      );
    },
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      COVERAGE_MODE: 'true',
      TEST_TIMEOUT: '30000'
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
      '@utils': path.resolve(__dirname, 'tests/utils')
    }
  },
  
  // Define configuration
  define: {
    __TEST__: true,
    __COVERAGE__: true
  }
});