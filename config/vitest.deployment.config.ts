import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'Deployment Tests',
    include: ['tests/deployment/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'examples',
      'src/components',
      'tests/unit',
      'tests/integration',
      'tests/performance'
    ],
    timeout: 300000, // 5 minutes for deployment operations
    testTimeout: 60000, // 1 minute per individual test
    hookTimeout: 30000, // 30 seconds for setup/teardown
    teardownTimeout: 30000,
    
    // Environment configuration for deployment testing
    environment: 'node',
    
    // Global setup and teardown
    globalSetup: ['tests/deployment/global-setup.ts'],
    globalTeardown: ['tests/deployment/global-teardown.ts'],
    
    // Sequential execution for deployment tests to avoid conflicts
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    
    // Retry failed tests once (network issues, etc.)
    retry: 1,
    
    // Detailed reporting for CI/CD
    reporters: ['verbose', 'json', 'html'],
    
    // Output directories
    outputFile: {
      json: './test-results/deployment-results.json',
      html: './test-results/deployment-report.html',
    },
    
    // Coverage for deployment scripts
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-results/coverage',
      include: ['tests/deployment/**/*.ts'],
      exclude: ['tests/deployment/**/*.steps.ts'],
    },
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      UNJUCKS_TEST_MODE: 'deployment',
      CI: 'true',
    },
  },
  
  // Define test-specific configuration
  define: {
    'import.meta.vitest': true,
  },
  
  // Resolve configuration for deployment testing
  resolve: {
    alias: {
      '@': './src',
      '@tests': './tests',
    },
  },
});