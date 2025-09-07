import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // BDD/Cucumber specific configuration
    include: [
      'tests/features/**/*.feature.spec.js', // Changed from .ts to .js
      'tests/step-definitions/**/*.js', // Changed from .ts to .js
      'tests/bdd/**/*.test.js' // Changed from .ts to .js
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
    setupFiles: ['./tests/setup/cucumber-setup.js'], // Changed from .ts to .js
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'], // Changed from .ts to .js
      exclude: [
        'src/**/*.test.js', // Changed from .ts to .js
        'src/**/*.spec.js', // Changed from .ts to .js
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
      '@': resolve(process.cwd(), 'src'), // Changed from __dirname
      '@tests': resolve(process.cwd(), 'tests') // Changed from __dirname
    }
  },
  esbuild: {
    target: 'node18'
  }
});