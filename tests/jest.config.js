/**
 * Jest Configuration for Unjucks Test Suite
 * Focus on critical 20% functionality that must work perfectly
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test discovery
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/performance/**/*.test.js',
    '<rootDir>/tests/regression/**/*.test.js'
  ],
  
  // Module handling
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Coverage settings - focus on critical components
  collectCoverageFrom: [
    'src/lib/turtle-parser.js',
    'src/lib/rdf-filters.js',
    'src/cli/index.js',
    'src/commands/generate.js',
    'src/lib/template-engine-perfect.js',
    'src/lib/nunjucks-filters.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    },
    // Critical components need higher coverage
    'src/lib/turtle-parser.js': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    },
    'src/lib/rdf-filters.js': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    }
  },
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],
  
  // Test setup
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-setup.js'
  ],
  
  // Timeouts
  testTimeout: 30000,
  
  // Performance and reliability
  maxWorkers: 4,
  
  // Error handling
  errorOnDeprecated: true,
  verbose: true,
  
  // Module resolution
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src'
  ],
  
  // Test result processing
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './tests/reports',
      filename: 'test-report.html',
      expand: true
    }]
  ]
};