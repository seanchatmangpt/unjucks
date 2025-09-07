import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable BDD testing with vitest-cucumber
    globals: true,
    environment: 'node',
    
    // Test file patterns for BDD features
    include: [
      'tests/features/**/*.feature.spec.js', // Changed from .ts to .js
      'tests/features/**/*.test.js' // Changed from .ts to .js
    ],
    
    // Exclude unit tests when running BDD tests
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'tests/unit/**',
      '**/*.unit.test.js' // Changed from .ts to .js
    ],
    
    // Test timeout for complex BDD scenarios
    testTimeout: 30000,
    
    // Setup files
    setupFiles: [
      resolve(process.cwd(), 'tests/setup.js') // Changed from __dirname and .ts to .js
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/bdd',
      include: [
        'src/**/*.js' // Changed from .ts to .js
      ],
      exclude: [
        'src/**/*.test.js', // Changed from .ts to .js
        'src/**/*.spec.js', // Changed from .ts to .js
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
    reporters: process.env.CI 
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
      '@': resolve(process.cwd(), 'src'), // Changed from __dirname
      '@tests': resolve(process.cwd(), 'tests'), // Changed from __dirname
      '@fixtures': resolve(process.cwd(), 'tests/fixtures') // Changed from __dirname
    }
  },
  
  // Define constants for testing
  define: {
    __TEST_ENV__: true,
    __BDD_MODE__: true
  }
});