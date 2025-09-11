/**
 * Vitest Configuration for KGEN CLI Tests
 * End-to-end testing for command-line interface
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment and setup
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup/cli-setup.js'],
    testTimeout: 45000, // CLI operations may take longer
    hookTimeout: 15000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      },
      include: ['src/**/*.js'],
      exclude: [
        'test/**',
        'fixtures/**',
        'node_modules/**',
        '**/*.config.js'
      ]
    },
    
    // Test inclusion patterns
    include: [
      'test/**/*.{test,spec}.{js,ts}',
      'test/unit/**/*.test.js',
      'test/integration/**/*.test.js',
      'test/e2e/**/*.test.js'
    ],
    
    // Test exclusion patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**'
    ],
    
    // CLI-specific settings
    retry: 1, // Allow one retry for flaky CLI operations
    threads: false, // Single-threaded for CLI consistency
    isolate: true,
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      ['html', { outputFile: 'test-results/html/index.html' }],
      ['junit', { outputFile: 'test-results/junit.xml' }]
    ],
    
    // Output configuration
    outputFile: {
      json: 'test-results/results.json',
      junit: 'test-results/junit.xml'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'test'),
      '@fixtures': resolve(__dirname, 'test/fixtures'),
      '@kgen-core': resolve(__dirname, '../kgen-core/src')
    }
  },
  
  // Define test constants
  define: {
    __TEST_ENV__: true,
    __CLI_TEST__: true,
    __KGEN_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});