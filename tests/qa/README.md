# Quality Assurance Framework

This directory contains a comprehensive Quality Assurance (QA) framework for the Unjucks project. The framework implements automated quality gates, testing, monitoring, and validation processes to ensure high code quality and prevent regressions.

## 📋 QA Components Overview

### 1. Quality Gates (`quality-gates.js`)
**Purpose**: Automated checks that must pass before code can be merged  
**Features**:
- Unit test validation
- Code coverage thresholds (80% statements)
- Linting compliance
- Security vulnerability scanning
- Build validation
- CLI smoke tests
- Integration test verification

**Usage**: `npm run qa:quality-gates`

### 2. Coverage Monitor (`coverage-monitor.js`)
**Purpose**: Comprehensive code coverage analysis with threshold enforcement  
**Features**:
- Statement, branch, function, and line coverage tracking
- Historical trend analysis
- Coverage analytics and recommendations
- Threshold validation (80% statements, 75% branches)
- HTML, JSON, and text reporting

**Usage**: `npm run qa:coverage` or `npm run test:coverage`

### 3. Performance Regression Testing (`performance-regression.js`)
**Purpose**: Monitor performance metrics and detect regressions  
**Features**:
- CLI command performance benchmarking
- Template discovery timing
- File generation performance
- Memory usage tracking
- Baseline comparison with regression detection
- Performance trend analysis

**Usage**: `npm run test:performance`

### 4. End-to-End User Journeys (`e2e-user-journeys.js`)
**Purpose**: Test complete user workflows from start to finish  
**Features**:
- New user first template generation journey
- Multi-file template generation workflow
- Error handling and recovery scenarios
- Real CLI command execution
- File system validation
- Step-by-step progress tracking

**Usage**: `npm run test:e2e`

### 5. Critical Workflow Validator (`workflow-validator.js`)
**Purpose**: Validate that all critical workflows function correctly  
**Features**:
- CLI basic operations testing
- Template discovery validation
- Core template generation testing
- Error handling verification
- File system safety checks
- Build system integration validation

**Usage**: `npm run test:workflows`

### 6. Quality Dashboard (`quality-dashboard.js`)
**Purpose**: Collect, aggregate, and visualize quality metrics  
**Features**:
- Overall quality score calculation
- HTML dashboard generation
- Metrics collection from all QA components
- Trend analysis and recommendations
- Historical data tracking
- Visual progress indicators

**Usage**: `npm run qa:dashboard`

### 7. Security Scanner (`security-scanner.js`)
**Purpose**: Scan for security vulnerabilities and enforce security best practices  
**Features**:
- Source code vulnerability detection
- Dependency vulnerability checking
- Configuration security auditing
- Template security analysis
- File permission validation
- Risk level assessment with recommendations

**Usage**: `npm run qa:security`

### 8. Test Data Factories (`test-factories.js`)
**Purpose**: Provide reliable, consistent test data and mock services  
**Features**:
- Template data generation with Faker.js
- Component and API data factories
- Mock file system operations
- Mock CLI process simulation
- Test environment setup and cleanup
- Reproducible test data with seeding

**Usage**: Import and use in tests

### 9. Mutation Testing (`mutation-testing.js`)
**Purpose**: Validate test quality by introducing mutations and checking if tests catch them  
**Features**:
- Arithmetic, comparison, and logical operator mutations
- Assignment and literal value mutations
- Method call mutations
- Test execution and mutation status tracking
- Quality score calculation (target: 60%+)
- Survived mutation reporting

**Usage**: `npm run test:mutation`

### 10. Continuous Monitoring (`continuous-monitoring.js`)
**Purpose**: Monitor quality metrics continuously and send alerts when thresholds are breached  
**Features**:
- Real-time quality metric collection
- Threshold breach detection
- Alert generation and notification
- Historical data retention
- Trend analysis
- Configurable check intervals

**Usage**: `npm run qa:monitor`

### 11. QA Suite Runner (`qa-suite.js`)
**Purpose**: Orchestrate all QA processes in a comprehensive test suite  
**Features**:
- Sequential execution of all QA components
- Comprehensive reporting
- Success/failure tracking
- Recommendation generation
- Fast mode (skip long-running tests)
- Summary dashboard

**Usage**: `npm run qa:suite` or `npm run qa:all`

## 🚀 Quick Start

### Run Complete QA Suite
```bash
# Full comprehensive suite (includes mutation testing)
npm run qa:suite

# Fast mode (skips long-running tests like mutation testing)
npm run qa:suite:fast

# Individual components
npm run qa:quality-gates
npm run qa:coverage
npm run qa:security
npm run qa:dashboard
```

### Run Specific Test Types
```bash
# Performance testing
npm run test:performance

# End-to-end user journeys
npm run test:e2e

# Critical workflow validation
npm run test:workflows

# Mutation testing (slow)
npm run test:mutation
```

### Monitoring and Maintenance
```bash
# Start continuous monitoring
npm run qa:monitor

# Generate quality dashboard
npm run qa:dashboard

# Clean QA reports
npm run clean:qa
```

## 📊 Quality Thresholds

The QA framework enforces the following quality thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Code Coverage (Statements) | 80% | Minimum percentage of statements covered by tests |
| Code Coverage (Branches) | 75% | Minimum percentage of branches covered by tests |
| Performance (CLI Commands) | 5000ms | Maximum acceptable execution time |
| Security Vulnerabilities (Critical) | 0 | No critical security vulnerabilities allowed |
| Security Vulnerabilities (High) | 2 | Maximum 2 high-severity vulnerabilities |
| Mutation Score | 60% | Minimum percentage of mutations killed by tests |
| Quality Score | 70% | Overall quality score threshold |

## 📁 Report Structure

All QA reports are saved to `tests/reports/`:

```
tests/reports/
├── quality-gates.json          # Quality gate results
├── coverage-report.json        # Code coverage analysis
├── performance-report.json     # Performance benchmarks
├── e2e-report.json            # End-to-end test results
├── workflow-validation.json    # Critical workflow results
├── security-report.json       # Security scan findings
├── mutation-testing.json      # Mutation test results
├── quality-metrics.json       # Aggregated quality metrics
├── quality-dashboard.html     # Visual dashboard
├── monitoring-data.json       # Continuous monitoring data
└── qa-suite-report.json       # Comprehensive suite results
```

## 🔧 Configuration

### Quality Thresholds
Modify thresholds in individual QA components or create a central configuration file.

### Continuous Monitoring
Configure monitoring intervals and alert thresholds in `continuous-monitoring.js`:

```javascript
const config = {
  checkInterval: 300000, // 5 minutes
  thresholds: {
    coverageStatements: 80,
    performanceThreshold: 5000,
    qualityScore: 70
  },
  alerts: {
    email: 'team@example.com',
    webhook: 'https://hooks.slack.com/...',
  }
};
```

## 🏗️ Integration with CI/CD

### GitHub Actions Example
```yaml
name: QA Suite
on: [push, pull_request]
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run qa:suite:fast
      - uses: actions/upload-artifact@v3
        with:
          name: qa-reports
          path: tests/reports/
```

### Pre-commit Hook Example
```bash
#!/bin/sh
npm run qa:quality-gates || exit 1
```

## 🎯 Best Practices

1. **Run QA Suite Before Commits**: Always run `npm run qa:suite:fast` before committing
2. **Monitor Trends**: Regularly check the quality dashboard for trends
3. **Address Security Issues**: Immediately fix critical and high-severity vulnerabilities
4. **Maintain Coverage**: Keep code coverage above 80%
5. **Performance Budget**: Monitor performance regressions
6. **Test Quality**: Use mutation testing to validate test effectiveness

## 🔍 Troubleshooting

### Common Issues

1. **Coverage Too Low**: Add more unit tests, focus on untested branches
2. **Performance Regression**: Profile slow operations, optimize bottlenecks
3. **Security Vulnerabilities**: Run `npm audit fix`, update dependencies
4. **Mutation Score Low**: Add more assertions, test edge cases
5. **Build Failures**: Check build logs, fix compilation errors

### Debug Mode
Run individual QA components to isolate issues:
```bash
node tests/qa/security-scanner.js
node tests/qa/coverage-monitor.js
node tests/qa/performance-regression.js
```

## 📈 Quality Score Calculation

The overall quality score is calculated as a weighted average:

- **Code Coverage**: 40% (statements, branches, functions, lines)
- **Performance**: 20% (benchmark pass rate, execution times)
- **Workflows**: 20% (critical workflow success rate)
- **Security**: 15% (vulnerability count, severity)
- **Build**: 5% (build success rate)

## 🤝 Contributing

When adding new QA components:

1. Follow the existing patterns and interfaces
2. Add comprehensive error handling
3. Include progress reporting
4. Generate both JSON and human-readable reports
5. Update this README with the new component
6. Add npm scripts for easy execution

## 📚 Resources

- [Testing Best Practices](https://testingjavascript.com/)
- [Mutation Testing Guide](https://stryker-mutator.io/)
- [Security Testing](https://owasp.org/www-project-web-security-testing-guide/)
- [Performance Testing](https://web.dev/performance/)