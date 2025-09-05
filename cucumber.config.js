module.exports = {
  default: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step-definitions/**/*.ts'],
    format: [
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html',
      'progress'
    ],
    parallel: false,
    timeout: 30000,
    retry: 1,
    tags: '@smoke or @regression',
    worldParameters: {
      // Global parameters for all scenarios
      baseUrl: 'http://localhost:3000',
      timeout: 30000
    }
  },
  smoke: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step-definitions/**/*.ts'],
    format: ['progress'],
    tags: '@smoke',
    parallel: false
  },
  regression: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step-definitions/**/*.ts'],
    format: ['json:reports/regression-report.json'],
    tags: '@regression',
    parallel: false
  },
  integration: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step-definitions/**/*.ts'],
    format: ['progress'],
    tags: '@integration',
    parallel: false
  }
};
