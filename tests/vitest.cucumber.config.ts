import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/bdd-integration.test.ts',
      'tests/features/**/*.feature'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage'
    ],
    setupFiles: [
      'tests/setup/cucumber-setup.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    reporter: ['verbose', 'json']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@tests': resolve(__dirname, '.'),
      '@mocks': resolve(__dirname, 'mocks'),
      '@utils': resolve(__dirname, 'utils')
    }
  }
});