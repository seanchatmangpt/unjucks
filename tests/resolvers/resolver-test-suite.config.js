/**
 * Resolver Test Suite Configuration
 * 
 * Configuration file for running the comprehensive URI resolver test suite
 * Ensures Charter compliance and 99.9% reproducibility requirements
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',
    
    // Global test configuration
    globals: true,
    
    // Test file patterns
    include: [
      'tests/resolvers/**/*.test.js',
      'tests/integration/**/*resolver*.test.js'
    ],
    
    // Test exclusions
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.d.ts'
    ],
    
    // Timeout configuration for Charter compliance
    testTimeout: 30000, // 30 seconds max per test
    hookTimeout: 10000, // 10 seconds max for hooks
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './tests/reports/resolver-test-results.json',
      html: './tests/reports/resolver-test-report.html'
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './tests/coverage',
      include: [
        'src/**/*.js',
        'packages/*/src/**/*.js'
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        '**/*.test.js',
        '**/*.config.js'
      ],
      // Charter requirements for test coverage
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Setup files
    setupFiles: [
      './tests/resolvers/test-setup.js'
    ],
    
    // Global test configuration
    globalSetup: './tests/resolvers/global-setup.js',
    globalTeardown: './tests/resolvers/global-teardown.js',
    
    // Performance and resource limits
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4, // Limit threads for consistent performance testing
        minThreads: 2
      }
    },
    
    // Retry configuration for flaky tests
    retry: 2, // Retry failed tests up to 2 times
    
    // Sequential running for reproducibility tests
    sequence: {
      shuffle: false, // Disable shuffling for deterministic results
      concurrent: false // Run reproducibility tests sequentially
    },
    
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, '../tests'),
      '@fixtures': path.resolve(__dirname, '../tests/fixtures')
    }
  },
  
  // Environment variables for testing
  define: {
    __TEST_ENV__: '"resolver-testing"',
    __REPRODUCIBILITY_TARGET__: '99.9',
    __PERFORMANCE_STRICT__: 'true'
  }
});

/**
 * Test Suite Categories and Requirements
 */
export const TEST_CATEGORIES = {
  UNIT: {
    name: 'Unit Tests',
    pattern: '**/*.test.js',
    timeout: 5000,
    requirements: {
      coverage: 90,
      performance: 'fast',
      reproducibility: 100
    }
  },
  
  INTEGRATION: {
    name: 'Integration Tests', 
    pattern: 'integration-tests.test.js',
    timeout: 15000,
    requirements: {
      coverage: 80,
      performance: 'moderate',
      reproducibility: 99.9
    }
  },
  
  PERFORMANCE: {
    name: 'Performance Benchmarks',
    pattern: 'performance-benchmarks.test.js',
    timeout: 30000,
    requirements: {
      avgContentResolution: 50, // ms
      maxContentResolution: 100, // ms
      avgGitOperations: 200, // ms
      avgAttestationVerification: 100, // ms
      avgPatchApplication: 150 // ms
    }
  },
  
  SECURITY: {
    name: 'Security Validation',
    pattern: 'security-validation.test.js',
    timeout: 10000,
    requirements: {
      inputSanitization: 100, // % coverage
      cryptographicIntegrity: 100, // % coverage
      accessControl: 100 // % coverage
    }
  },
  
  REPRODUCIBILITY: {
    name: 'Reproducibility Validation',
    pattern: 'reproducibility-validation.test.js',
    timeout: 20000,
    requirements: {
      reproducibilityRate: 99.9, // % across 10 runs
      deterministicHashing: 100, // % consistency
      crossEnvironment: 100 // % consistency
    }
  },
  
  CHARTER_COMPLIANCE: {
    name: 'Charter Compliance',
    pattern: 'uri-resolver-comprehensive.test.js',
    timeout: 25000,
    requirements: {
      allURISchemes: ['content', 'git', 'attest', 'drift', 'policy'],
      offlineOperation: 100, // % capability
      jsonSchemaCompliance: 100, // % compliance
      documentedAPIs: 100 // % coverage
    }
  }
};

/**
 * Test Execution Environments
 */
export const TEST_ENVIRONMENTS = {
  DEVELOPMENT: {
    NODE_ENV: 'development',
    ENABLE_DEBUG_LOGGING: true,
    PERFORMANCE_STRICT: false,
    REPRODUCIBILITY_RUNS: 5
  },
  
  CI: {
    NODE_ENV: 'test',
    ENABLE_DEBUG_LOGGING: false,
    PERFORMANCE_STRICT: true,
    REPRODUCIBILITY_RUNS: 10,
    COVERAGE_REQUIRED: true
  },
  
  PRODUCTION_VALIDATION: {
    NODE_ENV: 'production',
    ENABLE_DEBUG_LOGGING: false,
    PERFORMANCE_STRICT: true,
    REPRODUCIBILITY_RUNS: 10,
    STRESS_TESTING: true,
    MEMORY_MONITORING: true
  }
};

/**
 * Charter Validation Checklist
 */
export const CHARTER_REQUIREMENTS = {
  URI_SCHEMES: {
    content: {
      format: /^content:\/\/[a-z0-9]+\/[a-f0-9]+$/,
      required: true,
      features: ['CAS', 'integrity', 'sharding', 'extension-preservation']
    },
    git: {
      format: /^git:\/\/[^@]+@[a-f0-9]{40}(\/.+)?$/,
      required: true,
      features: ['attestation', 'provenance', 'URI-creation', 'validation']
    },
    attest: {
      format: /^attest:\/\/[a-z0-9]+\/[a-f0-9]+$/,
      required: true,
      features: ['JWT-verification', 'signature', 'integrity', 'chaining']
    },
    drift: {
      format: /^drift:\/\/[a-z-]+\/[^\/]+$/,
      required: true,
      features: ['semantic-patches', 'CAS', 'application', 'reverse-patches']
    },
    policy: {
      format: /^policy:\/\/[a-z-]+\/(pass|fail|pending)$/,
      required: true,
      features: ['SHACL-validation', 'verdict-tracking', 'audit-trail']
    },
    doc: {
      format: /^doc:\/\/[^\/]+\/[^\/]+$/,
      required: false,
      features: ['OPC-normalization', 'document-parts']
    },
    audit: {
      format: /^audit:\/\/[^\/]+\/[^\/]+$/,
      required: false,
      features: ['audit-trail', 'compliance', 'reporting']
    }
  },
  
  PERFORMANCE_TARGETS: {
    contentResolution: { avg: 50, max: 100, unit: 'ms' },
    gitOperations: { avg: 200, max: 400, unit: 'ms' },
    attestationVerification: { avg: 100, max: 200, unit: 'ms' },
    driftPatchApplication: { avg: 150, max: 300, unit: 'ms' },
    concurrentOperations: { min: 10, unit: 'ops/sec' },
    memoryUsage: { max: 100, unit: 'MB' }
  },
  
  REPRODUCIBILITY: {
    target: 99.9, // % across 10 runs
    runs: 10,
    tolerance: 0.1, // % variance allowed
    deterministic: true,
    crossEnvironment: true
  },
  
  OFFLINE_OPERATION: {
    contentResolution: 100, // % capability
    caching: true,
    localStorage: true,
    networkIndependent: true
  },
  
  SECURITY: {
    inputValidation: 100, // % coverage
    pathTraversalPrevention: true,
    injectionPrevention: true,
    cryptographicIntegrity: true,
    accessControl: true
  },
  
  JSON_SCHEMA_COMPLIANCE: {
    uriFormats: true,
    metadataStructure: true,
    attestationFormat: true,
    policyFormat: true,
    errorFormat: true
  }
};

/**
 * Test Data Configuration
 */
export const TEST_DATA_CONFIG = {
  DETERMINISTIC_SEED: 'kgen-resolver-test-suite-v1.0.0',
  FIXED_TIMESTAMP: '2024-01-01T00:00:00.000Z',
  TEMP_DIR_PREFIX: 'kgen-resolver-test-',
  
  CONTENT_SIZES: {
    TINY: 100,        // 100 bytes
    SMALL: 1024,      // 1KB
    MEDIUM: 10240,    // 10KB  
    LARGE: 102400,    // 100KB
    XLARGE: 1048576,  // 1MB
    XXLARGE: 10485760 // 10MB
  },
  
  CONCURRENCY_LEVELS: [1, 2, 5, 10, 20, 50],
  ITERATION_COUNTS: {
    UNIT: 10,
    INTEGRATION: 5,
    PERFORMANCE: 100,
    REPRODUCIBILITY: 10,
    STRESS: 1000
  }
};

/**
 * Expected Test Results Template
 */
export const EXPECTED_RESULTS = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    coverage: 0
  },
  
  categories: {
    unit: { tests: 0, passed: 0, coverage: 0 },
    integration: { tests: 0, passed: 0, coverage: 0 },
    performance: { tests: 0, passed: 0, avgTime: 0 },
    security: { tests: 0, passed: 0, vulnerabilities: 0 },
    reproducibility: { tests: 0, passed: 0, reproducibilityRate: 0 },
    charter: { tests: 0, passed: 0, complianceRate: 0 }
  },
  
  charterCompliance: {
    uriSchemes: 0, // out of 7
    performanceTargets: 0, // out of 6
    reproducibility: false,
    offlineOperation: false,
    security: false,
    jsonSchema: false,
    overallCompliance: 0 // percentage
  }
};

export default {
  TEST_CATEGORIES,
  TEST_ENVIRONMENTS,
  CHARTER_REQUIREMENTS,
  TEST_DATA_CONFIG,
  EXPECTED_RESULTS
};