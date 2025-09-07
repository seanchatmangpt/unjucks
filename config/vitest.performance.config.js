import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Performance-specific test configuration
    globals: true,
    environment: 'node',
    
    // Performance test file patterns
    include: [
      'tests/performance/**/*.performance.test.js', // Changed from .ts to .js
      'tests/**/*.perf.test.js' // Changed from .ts to .js
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
      'tests/performance/setup-performance.js' // Changed from .ts to .js
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
        'src/**/*.js', // Changed from .ts to .js
        'src/**/*.js'
      ],
      exclude: [
        'src/**/*.test.js', // Changed from .ts to .js
        'src/**/*.spec.js', // Changed from .ts to .js
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
      include: ['tests/performance/**/*.bench.js'], // Changed from .ts to .js
      exclude: ['node_modules/**'],
      outputFile: 'reports/benchmark-results.json'
    }
  },
  
  // Resolve aliases for easier imports in performance tests
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'), // Changed from __dirname
      '@tests': resolve(process.cwd(), 'tests'), // Changed from __dirname
      '@performance': resolve(process.cwd(), 'tests/performance'), // Changed from __dirname
      '@fixtures': resolve(process.cwd(), 'tests/fixtures') // Changed from __dirname
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