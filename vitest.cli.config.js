import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // CLI tests need to run without workers to use process.chdir()
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Set longer timeouts for CLI operations
    testTimeout: 60000,
    hookTimeout: 30000,
    // Include CLI test patterns
    include: ['tests/cli/**/*.test.js'], // Changed from .ts to .js
    // Exclude other test patterns that might interfere
    exclude: [
      'tests/features/**',
      'tests/unit/**',
      'tests/integration/**',
      'tests/performance/**',
      'tests/security/**',
    ],
    // Enable file system operations
    environment: 'node',
    // Global setup for CLI tests
    globalSetup: [],
    // Setup files for CLI tests
    setupFiles: [],
  },
});