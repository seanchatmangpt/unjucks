import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // BDD/Cucumber specific configuration
    include: [
      'tests/features/**/*.feature.spec.ts',
      'tests/step-definitions/**/*.ts',
      'tests/bdd/**/*.test.ts'
    ],
    exclude: [
      'tests/features/**/*.feature', // Exclude raw feature files
      'node_modules/**/*',
      'dist/**/*'
    ],
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for BDD scenarios
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Cucumber-specific settings
    setupFiles: ['./tests/setup/cucumber-setup.ts'],
    // Coverage configuration
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'tests/**/*',
        'node_modules/**/*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  },
  esbuild: {
    target: 'node18'
  }
});