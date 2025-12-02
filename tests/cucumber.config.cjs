/**
 * Cucumber Configuration for KGEN v1 BDD Tests
 * Comprehensive test runner configuration for all v1 functionality
 */

const config = {
  default: {
    // Feature files location
    paths: [
      'tests/features/**/*.feature'
    ],
    
    // Step definitions
    require: [
      'tests/step_definitions/**/*.js'
    ],
    
    // Test execution settings
    parallel: 4, // Run tests in parallel for speed
    retry: 1, // Retry failed tests once
    
    // Output formatting
    format: [
      'progress-bar',
      'json:tests/reports/cucumber-report.json',
      'html:tests/reports/cucumber-report.html',
      'junit:tests/reports/cucumber-junit.xml'
    ],
    
    // Publishing settings
    publish: false,
    
    // Fail fast on first failure (disable for CI)
    failFast: false,
    
    // World parameters
    worldParameters: {
      timeout: 30000, // 30 second timeout per step
      workspaceCleanup: true,
      deterministicMode: true,
      casEnabled: true,
      attestationEnabled: true
    }
  },
  
  // Profile configurations for different test types
  profiles: {
    // Fast smoke tests - critical functionality only
    smoke: {
      tags: '@critical',
      parallel: 2,
      format: ['progress-bar'],
      failFast: true
    },
    
    // Deterministic generation tests
    deterministic: {
      tags: '@deterministic',
      parallel: 1, // Sequential for deterministic testing
      format: ['progress-bar', 'json:tests/reports/deterministic-report.json'],
      worldParameters: {
        timeout: 60000, // Longer timeout for deterministic tests
        goldenFileValidation: true
      }
    },
    
    // CAS storage tests
    cas: {
      tags: '@cas',
      parallel: 3,
      format: ['progress-bar', 'json:tests/reports/cas-report.json'],
      worldParameters: {
        casStoreSize: 1000000, // 1MB CAS store for testing
        blake3Validation: true
      }
    },
    
    // Attestation tests
    attestation: {
      tags: '@attestation',
      parallel: 2,
      format: ['progress-bar', 'json:tests/reports/attestation-report.json'],
      worldParameters: {
        signingEnabled: true,
        provenanceValidation: true
      }
    },
    
    // Marketplace tests
    marketplace: {
      tags: '@marketplace',
      parallel: 2,
      format: ['progress-bar', 'json:tests/reports/marketplace-report.json'],
      worldParameters: {
        tarValidation: true,
        packageSigning: true
      }
    },
    
    // SHACL validation tests
    shacl: {
      tags: '@shacl',
      parallel: 3,
      format: ['progress-bar', 'json:tests/reports/shacl-report.json'],
      worldParameters: {
        rdfValidation: true,
        sparqlQueries: true
      }
    },
    
    // Git receipts tests
    'git-receipts': {
      tags: '@git',
      parallel: 1, // Sequential for git operations
      format: ['progress-bar', 'json:tests/reports/git-receipts-report.json'],
      worldParameters: {
        gitNotesEnabled: true,
        ledgerValidation: true
      }
    },
    
    // Persona exploration tests
    personas: {
      tags: '@personas',
      parallel: 4,
      format: ['progress-bar', 'json:tests/reports/personas-report.json'],
      worldParameters: {
        jsonViewValidation: true,
        dynamicPersonas: true
      }
    },
    
    // Fuzz testing
    fuzz: {
      tags: '@fuzz',
      parallel: 1, // Sequential for controlled fuzzing
      format: ['progress-bar', 'json:tests/reports/fuzz-report.json'],
      worldParameters: {
        timeout: 120000, // 2 minute timeout for fuzz tests
        fuzzIterations: 1000,
        seedValue: 12345
      }
    },
    
    // Performance tests
    performance: {
      tags: '@performance',
      parallel: 1, // Sequential for accurate performance measurement
      format: ['progress-bar', 'json:tests/reports/performance-report.json'],
      worldParameters: {
        timeout: 300000, // 5 minute timeout for performance tests
        performanceMetrics: true,
        memoryProfiling: true
      }
    },
    
    // KPI validation tests
    kpi: {
      tags: '@kpi',
      parallel: 1, // Sequential for KPI measurement
      format: ['progress-bar', 'json:tests/reports/kpi-report.json'],
      worldParameters: {
        timeout: 600000, // 10 minute timeout for KPI tests
        kpiValidation: true,
        statisticalAnalysis: true
      }
    },
    
    // Full v1 validation suite
    v1: {
      tags: '@v1',
      parallel: 4,
      format: [
        'progress-bar',
        'json:tests/reports/v1-complete-report.json',
        'html:tests/reports/v1-complete-report.html'
      ],
      worldParameters: {
        timeout: 60000,
        fullValidation: true,
        goldenFileValidation: true,
        performanceMetrics: true
      }
    },
    
    // CI/CD pipeline tests
    ci: {
      tags: '@v1 and not @manual',
      parallel: 4,
      format: [
        'json:tests/reports/ci-report.json',
        'junit:tests/reports/ci-junit.xml'
      ],
      failFast: false,
      worldParameters: {
        timeout: 120000,
        ciMode: true,
        artifactCollection: true
      }
    }
  }
};

// Export configuration
module.exports = config;