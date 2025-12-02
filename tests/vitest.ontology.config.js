/**
 * Vitest configuration for ontology project generation tests
 * London School TDD with 80%+ coverage requirements
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'ontology-project-generation',
    globals: true,
    environment: 'node',

    // Coverage configuration - 80%+ required
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './tests/coverage/ontology',

      // Minimum coverage thresholds (Lean Six Sigma standard)
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },

      include: [
        'src/kgen/ontology/**/*.js',
        'src/kgen/semantic/**/*.js',
        'packages/kgen-core/src/**/*.js',
      ],

      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.test.js',
        '**/*.spec.js',
        '**/fixtures/**',
        '**/mocks/**',
      ],
    },

    // Test file patterns
    include: [
      'tests/features/ontology-project-generation.feature.spec.js',
      'tests/features/step_definitions/ontology_project_steps.test.js',
    ],

    // Setup files
    setupFiles: [
      './tests/setup.js',
      './tests/helpers/ontology-test-utils.js',
    ],

    // Timeouts
    testTimeout: 30000, // 30s for large ontology tests
    hookTimeout: 10000,

    // Isolation
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Reporters
    reporters: ['verbose', 'json', 'html'],

    // Mock configuration for London School TDD
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return path.join(
        path.dirname(testPath),
        '__snapshots__',
        path.basename(testPath) + snapExtension
      );
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, '.'),
      '@fixtures': path.resolve(__dirname, './fixtures'),
      '@helpers': path.resolve(__dirname, './helpers'),
    },
  },
});
