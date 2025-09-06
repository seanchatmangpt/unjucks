import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable BDD testing with vitest-cucumber
    globals: true,
    environment: 'node',
    
    // Test file patterns for BDD features
    include: [
      'tests/features/**/*.feature.spec.ts',
      'tests/features/**/*.test.ts'
    ],
    
    // Exclude unit tests when running BDD tests
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'tests/unit/**',
      '**/*.unit.test.ts'
    ],
    
    // Test timeout for complex BDD scenarios
    testTimeout: 30000,
    
    // Setup files
    setupFiles: [
      resolve(__dirname, '../tests/setup.ts')
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/bdd',
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'tests/**'
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
    
    // Reporter configuration for different test types
    reporter: process.env.CI 
      ? ['json', 'github-actions']
      : ['verbose', 'html'],
    
    // Output directory for test reports
    outputFile: {
      json: 'reports/bdd-test-results.json',
      html: 'reports/bdd-test-report.html'
    }
  },
  
  // Resolve aliases for easier imports
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@tests': resolve(__dirname, '../tests'),
      '@fixtures': resolve(__dirname, '../tests/fixtures')
    }
  },
  
  // Define constants for testing
  define: {
    __TEST_ENV__: true,
    __BDD_MODE__: true
  }
});