module.exports = {
  default: {
    // Test files and step definitions
    require: [
      'tests/steps/**/*.js'
    ],
    
    // Feature files location
    paths: [
      'tests/features/**/*.feature'
    ],
    
    // Output formatting
    format: [
      'progress',
      'json:tests/reports/cucumber-report.json',
      'html:tests/reports/cucumber-report.html'
    ],
    
    // Test execution options
    parallel: 2,
    timeout: 30000,
    
    // Tags for test filtering
    tags: 'not @wip and not @skip',
    
    // Retry failed scenarios
    retry: 1,
    
    // World parameters for test context
    worldParameters: {
      marketplace: {
        baseUrl: process.env.MARKETPLACE_URL || 'http://localhost:3000',
        timeout: 10000
      },
      payment: {
        baseUrl: process.env.PAYMENT_URL || 'http://localhost:4000',
        testMode: true
      },
      persona: {
        baseUrl: process.env.PERSONA_URL || 'http://localhost:5000'
      }
    },
    
    // Test environment setup
    publishQuiet: true,
    
    // Exit on first failure (for CI)
    failFast: process.env.CI === 'true'
  },
  
  // Smoke test configuration
  smoke: {
    require: [
      'tests/steps/**/*.js'
    ],
    paths: [
      'tests/features/**/*.feature'
    ],
    format: [
      'progress'
    ],
    tags: '@smoke',
    timeout: 15000,
    parallel: 1
  },
  
  // Performance test configuration
  performance: {
    require: [
      'tests/steps/**/*.js'
    ],
    paths: [
      'tests/features/**/*.feature'
    ],
    format: [
      'progress',
      'json:tests/reports/performance-report.json'
    ],
    tags: '@performance',
    timeout: 60000,
    parallel: 1,
    retry: 0
  },
  
  // Security test configuration
  security: {
    require: [
      'tests/steps/**/*.js'
    ],
    paths: [
      'tests/features/**/*.feature'
    ],
    format: [
      'progress',
      'json:tests/reports/security-report.json'
    ],
    tags: '@security or @cryptography',
    timeout: 30000,
    parallel: 1,
    retry: 0
  },
  
  // CI configuration
  ci: {
    require: [
      'tests/steps/**/*.js'
    ],
    paths: [
      'tests/features/**/*.feature'
    ],
    format: [
      'progress',
      'json:tests/reports/ci-report.json',
      'junit:tests/reports/junit-report.xml'
    ],
    tags: 'not @wip and not @skip and not @manual',
    timeout: 45000,
    parallel: 3,
    retry: 2,
    failFast: true
  }
};