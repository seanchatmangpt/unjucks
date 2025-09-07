import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs}', // Removed TypeScript extensions
      'tests/features/**/*.feature'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage'
    ],
    setupFiles: [
      'tests/setup/cucumber-setup.js' // Changed from .ts to .js
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.js', // Changed from .ts to .js
        'src/**/*.spec.js' // Changed from .ts to .js
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), '../src'), // Changed from __dirname
      '@tests': resolve(process.cwd(), '.'), // Changed from __dirname
      '@mocks': resolve(process.cwd(), 'mocks'), // Changed from __dirname
      '@utils': resolve(process.cwd(), 'utils') // Changed from __dirname
    }
  }
});