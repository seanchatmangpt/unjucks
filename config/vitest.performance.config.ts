import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Performance-specific test configuration
    globals: true,
    environment: 'node',
    
    // Performance test file patterns
    include: [
      'tests/performance/**/*.performance.test.ts',
      'tests/**/*.perf.test.ts'
    ],
    
    // Exclude other test types when running performance tests
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'tests/features/**',
      'tests/unit/**',
      'tests/integration/**'
    ],
    
    // Extended timeout for performance tests
    testTimeout: 60000, // 1 minute for complex performance tests
    
    // Performance test setup
    setupFiles: [
      'tests/performance/setup-performance.ts'
    ],
    
    // Sequential execution for accurate performance measurement
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially for consistent measurements
      }
    },
    
    // Coverage configuration for performance tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/performance',
      include: [
        'src/**/*.ts',
        'src/**/*.js'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'tests/**',
        'dist/**'
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
    
    // Reporter configuration for performance tests
    reporters: process.env.CI 
      ? ['json', 'github-actions']
      : ['verbose', 'html'],
    
    // Output configuration
    outputFile: {
      json: 'reports/performance-results.json',
      html: 'reports/performance-report.html'
    },
    
    // Benchmark configuration
    benchmark: {
      include: ['tests/performance/**/*.bench.ts'],
      exclude: ['node_modules/**'],
      outputFile: 'reports/benchmark-results.json'
    }
  },
  
  // Resolve aliases for easier imports in performance tests
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@tests': resolve(__dirname, '../tests'),
      '@performance': resolve(__dirname, '../tests/performance'),
      '@fixtures': resolve(__dirname, '../tests/fixtures')
    }
  },
  
  // Define constants for performance testing
  define: {
    __TEST_ENV__: true,
    __PERFORMANCE_MODE__: true,
    __CI_MODE__: process.env.CI === 'true'
  },
  
  // Optimize for performance testing
  optimizeDeps: {
    include: ['vitest/utils'],
    exclude: ['fsevents']
  }
});