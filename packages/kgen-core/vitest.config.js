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
    setupFiles: ['./tests/setup.js'],
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
        'tests/**',
        'examples/**',
        'node_modules/**',
        '**/*.config.js'
      ]
    },
    
    // Test inclusion patterns
    include: [
      'tests/**/*.{test,spec}.{js,ts}'
    ],
    
    // Test exclusion patterns
    exclude: [
      'node_modules/**',
      'dist/**'
    ],
    
    // Determinism and correctness settings
    retry: 0, // No retries for determinism
    threads: false, // Single-threaded for deterministic execution
    isolate: true, // Isolated test environments
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    
    // Output configuration
    outputFile: {
      json: 'test-results/results.json',
      html: 'test-results/html/index.html'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(import.meta.url, '..', 'src'),
      '@test': resolve(import.meta.url, '..', 'tests'),
      '@fixtures': resolve(import.meta.url, '..', 'tests/fixtures')
    }
  },
  
  // Define test constants
  define: {
    __TEST_ENV__: true,
    __KGEN_VERSION__: JSON.stringify('1.0.0')
  }
});