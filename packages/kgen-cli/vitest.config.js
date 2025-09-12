/**
 * Vitest Configuration for KGEN CLI Tests
 * Focuses on CLI functionality, integration, and command testing
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment and setup
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 15000,
    hookTimeout: 5000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      include: ['src/**/*.js'],
      exclude: [
        'tests/**',
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
    
    // Determinism settings
    retry: 0,
    threads: false,
    isolate: true,
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    
    // Output configuration
    outputFile: {
      json: 'test-results/results.json'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(import.meta.url, '..', 'src'),
      '@test': resolve(import.meta.url, '..', 'tests')
    }
  }
});