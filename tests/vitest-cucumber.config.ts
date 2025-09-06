import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable BDD testing with vitest-cucumber for comprehensive validation
    globals: true,
    environment: 'node',
    
    // Comprehensive test file patterns for RDF/Turtle validation
    include: [
      'tests/features/semantic-core.feature.spec.ts',
      'tests/features/turtle-data-support.feature.spec.ts',
      'tests/integration/turtle-template-integration.test.ts',
      'tests/integration/semantic-80-20.test.ts',
      'tests/performance/turtle-performance.test.ts',
      'tests/security/turtle-security.test.ts',
      'tests/unit/turtle-parser.test.ts',
      'tests/unit/rdf-data-loader.test.ts',
      'tests/unit/rdf-filters.test.ts',
      'tests/validation/rdf-*.test.ts',
      'tests/regression/turtle-*.test.ts'
    ],
    
    // Exclude non-RDF tests for focused validation
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'tests/unit/!(turtle-*|rdf-*)*.test.ts',
      'tests/integration/!(turtle-*|rdf-*)*.test.ts',
      'tests/e2e/**'
    ],
    
    // Extended timeout for complex RDF operations
    testTimeout: 60000,
    hookTimeout: 20000,
    
    // Setup files for RDF testing environment
    setupFiles: [
      resolve(__dirname, './setup/rdf-test-setup.ts')
    ],
    
    // High-performance parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 6, // Parallel RDF validation
        minThreads: 2,
        useAtomics: true,
        isolate: false // Share RDF parsing contexts
      }
    },
    
    // Sequence for optimal parallel execution
    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'parallel',
      setupFiles: 'parallel'
    },
    
    // Comprehensive coverage for RDF components
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: 'reports/rdf-coverage',
      include: [
        'src/lib/turtle-parser.ts',
        'src/lib/rdf-data-loader.ts', 
        'src/lib/rdf-filters.ts',
        'src/lib/types/turtle-types.ts',
        'src/lib/frontmatter-parser.ts' // RDF integration points
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'tests/**'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Critical RDF components require higher coverage
        'src/lib/turtle-parser.ts': {
          branches: 95,
          functions: 98,
          lines: 98,
          statements: 98
        },
        'src/lib/rdf-data-loader.ts': {
          branches: 92,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },
    
    // Multi-format reporting for comprehensive analysis
    reporters: process.env.CI 
      ? ['json', 'github-actions', 'junit']
      : ['verbose', 'html', 'json'],
    
    // Detailed output files
    outputFile: {
      json: 'reports/rdf-validation-results.json',
      html: 'reports/rdf-validation-report.html',
      junit: 'reports/rdf-validation-junit.xml'
    },
    
    // Performance monitoring
    logHeapUsage: true,
    
    // Cache for faster subsequent runs
    cache: {
      dir: 'node_modules/.vitest/rdf-cache'
    }
  },
  
  // Resolve aliases for RDF test files
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@tests': resolve(__dirname, 'tests'),
      '@fixtures': resolve(__dirname, 'tests/fixtures'),
      '@turtle-fixtures': resolve(__dirname, 'tests/fixtures/turtle')
    }
  },
  
  // Test environment constants
  define: {
    __TEST_ENV__: true,
    __RDF_VALIDATION__: true,
    __TURTLE_FIXTURES_PATH__: JSON.stringify(resolve(__dirname, 'tests/fixtures/turtle'))
  },
  
  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'node18'
  }
});