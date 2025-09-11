/**
 * Vitest Configuration for KGEN Core Tests
 * Focused on determinism, performance, and correctness validation
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment and setup
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup/global-setup.js'],
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Coverage configuration for >90% target
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      include: ['src/**/*.js'],
      exclude: [
        'test/**',
        'examples/**',
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
      'test/performance/**/*.test.js',
      'test/compliance/**/*.test.js'
    ],
    
    // Test exclusion patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**'
    ],
    
    // Determinism and correctness settings
    retry: 0, // No retries for determinism
    threads: false, // Single-threaded for deterministic execution
    isolate: true, // Isolated test environments
    
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
      '@fixtures': resolve(__dirname, 'test/fixtures')
    }
  },
  
  // Define test constants
  define: {
    __TEST_ENV__: true,
    __KGEN_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});