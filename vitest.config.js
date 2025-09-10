/**
 * Vitest Configuration for Unjucks v3.0
 * 
 * Minimal configuration for testing the foundational structure
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', '_templates'],
    reporter: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        '_templates',
        'examples',
        'docs'
      ]
    }
  }
});