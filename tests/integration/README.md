# Integration Test Suite

Comprehensive production-ready integration testing framework for the Unjucks project.

## Overview

This integration test suite provides comprehensive testing for production scenarios, including:

- **End-to-End User Journeys**: Complete workflow simulation and validation
- **API Contract Testing**: Schema validation and third-party service integration
- **Database Migration Testing**: Multi-database support with Docker containers
- **Environment Isolation**: Isolated test environments with cleanup management
- **Performance Validation**: Smoke tests for production readiness
- **Third-Party Mocking**: Comprehensive external service simulation

## Quick Start

```bash
# Run all integration tests
./integration-test-runner.js

# Run specific test suite
./integration-test-runner.js --filter smoke

# Skip optional tests
./integration-test-runner.js --skip-optional

# Dry run to see what would be executed
./integration-test-runner.js --dry-run

# Verbose output with detailed reporting
./integration-test-runner.js --verbose
```

## Test Suites

### 1. Smoke Tests (`smoke-tests.js`)
**Priority: 1 (Required)**
- Fast validation of critical functionality
- CLI command execution and validation
- File system health checks
- Performance benchmarks
- Security validation
- Deployment readiness checks

### 2. API Contract Tests (`api-contract-tests.js`)
**Priority: 2 (Required)**
- API response schema validation
- Error response format validation
- Authentication flow testing
- Rate limiting validation
- Performance SLA validation

### 3. Database Migration Tests (`database-migration-tests.js`)
**Priority: 2 (Optional - requires Docker)**
- PostgreSQL, MySQL, MongoDB support
- Migration execution and rollback
- Data consistency validation
- Foreign key constraint testing
- Performance under load

### 4. End-to-End User Journeys (`e2e-user-journeys.js`)
**Priority: 3 (Required)**
- New user onboarding simulation
- Experienced user workflows
- Complex project setup scenarios
- Error recovery testing
- Cross-platform compatibility

### 5. Third-Party Integration Tests (`third-party-integration-tests.js`)
**Priority: 3 (Optional)**
- GitHub API integration
- NPM Registry integration
- Webhook processing
- Network condition simulation
- Circuit breaker patterns

### 6. Environment Isolation Tests (`environment-isolation.js`)
**Priority: 4 (Required)**
- Isolated test environments
- Data isolation management
- Process isolation
- Configuration management
- Cross-environment validation

## Architecture

### Test Data Management

The test suite includes a comprehensive test data factory system:

```javascript
import { userFactory, projectFactory, templateFactory, fixtureManager } from './test-data-factory.js';

// Create test users
const users = userFactory.createMany(5);
const admin = userFactory.createAdmin();

// Generate complete test scenarios
const scenario = await fixtureManager.generateScenario('full-stack-app', {
  userCount: 10,
  projectCount: 5,
  templateCount: 20
});
```

### Environment Isolation

Each test runs in an isolated environment:

```javascript
import { EnvironmentManager } from './environment-isolation.js';

const envManager = new EnvironmentManager();
const testEnv = await envManager.createEnvironment('my-test', {
  nodeModules: true,
  gitRepo: true,
  database: true
});

await envManager.activateEnvironment(testEnv.id);
// Test runs in isolation
await envManager.cleanupEnvironment(testEnv.id);
```

### Docker Integration

Database tests use Docker Compose for consistent environments:

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Run database tests
./integration-test-runner.js --filter database

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### API Contract Validation

Comprehensive API testing with schema validation:

```javascript
import { SchemaValidator, APIClient } from './api-contract-tests.js';

const client = new APIClient('http://localhost:3000');
const response = await client.get('/users');

const validation = SchemaValidator.validate(response.data[0], userSchema);
expect(validation.valid).toBe(true);
```

### Performance Testing

Built-in performance validation:

```javascript
import { PerformanceSmokeTest } from './smoke-tests.js';

const perfTester = new PerformanceSmokeTest();
const startupTime = await perfTester.measureStartupTime(cliTester);

expect(startupTime.average).toBeLessThan(3000); // 3 second threshold
```

## Configuration

### Test Runner Options

```bash
./integration-test-runner.js [options]

Options:
  -f, --filter <pattern>     Run only tests matching pattern
  --skip-optional           Skip optional test suites
  --dry-run                 Show what would be run without executing
  -v, --verbose             Verbose output
  -q, --quiet               Minimal output
  --no-coverage             Disable coverage collection
  --sequential              Run tests sequentially instead of parallel
  -h, --help                Show help message
```

### Environment Variables

```bash
# Test configuration
NODE_ENV=test
TEST_ISOLATED=true

# Database configuration (for Docker tests)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
MYSQL_HOST=localhost
MYSQL_PORT=3307
MONGODB_URL=mongodb://admin:admin_password@localhost:27018/test

# API testing
API_BASE_URL=http://localhost:3000
```

## Test Patterns Stored in Memory

The test suite stores reusable patterns in memory for consistency:

### Integration Test Patterns
- **Schema Validation**: API response schema validation
- **Error Handling**: Consistent error response testing
- **Performance Testing**: Response time and scaling validation
- **Authentication**: Token lifecycle and security testing

### E2E Test Patterns
- **User Journeys**: Complete workflow simulation
- **CLI Testing**: Command execution and validation
- **File System Validation**: File creation and content verification
- **Cross-Platform Testing**: Path and character encoding validation

### Database Test Patterns
- **Migration Management**: Schema versioning and rollback
- **Data Integrity**: Transaction and constraint validation
- **Performance Testing**: Bulk operations and scaling
- **Cross-Database Compatibility**: Multi-database support

### Third-Party Integration Patterns
- **Mocking Framework**: Configurable external service simulation
- **API Integration**: Contract validation and error handling
- **Webhook Testing**: Event processing and validation
- **Resilience Patterns**: Circuit breakers and fault tolerance

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: ./tests/integration/integration-test-runner.js --skip-optional
```

### Local Development

```bash
# Install dependencies
npm install

# Start Docker services for full testing
docker-compose -f tests/integration/docker-compose.test.yml up -d

# Run full test suite
npm run test:integration

# Run specific tests
npm run test:integration -- --filter smoke

# Cleanup
docker-compose -f tests/integration/docker-compose.test.yml down -v
```

## Test Results and Reporting

### Console Output

```
🧪 Starting Integration Test Suite
=====================================

📋 Dependency Check:
  ✅ node: v18.17.0
  ✅ docker: Docker version 24.0.2
  ✅ vitest: vitest/0.34.1

🎯 Test Suites to Run: 6
  1. Smoke Tests (required)
  2. API Contract Tests (required)  
  3. Database Migration Tests (optional)
  4. End-to-End User Journeys (required)
  5. Third-Party Integration Tests (optional)
  6. Environment Isolation Tests (required)

🚀 Executing Test Suites...

  ✅ Smoke Tests: PASSED (1247ms)
  ✅ API Contract Tests: PASSED (3891ms)
  ⏭️  Database Migration Tests: SKIPPED (Docker not available)
  ✅ End-to-End User Journeys: PASSED (8342ms)
  ✅ Third-Party Integration Tests: PASSED (2156ms)
  ✅ Environment Isolation Tests: PASSED (1834ms)

📊 Integration Test Summary
============================
Total Suites: 6
Passed: 5 ✅
Failed: 0 ❌
Skipped: 1 ⏭️
Duration: 17470ms
Pass Rate: 83%

🎉 All integration tests passed!

Memory Usage: 42MB
```

### JSON Report

Detailed JSON reports are saved to `tests/reports/`:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "node": "v18.17.0",
    "platform": "darwin",
    "arch": "arm64",
    "ci": false
  },
  "results": {
    "duration": 17470,
    "totalSuites": 6,
    "passedSuites": 5,
    "failedSuites": 0,
    "skippedSuites": 1,
    "summary": {
      "success": true,
      "passRate": 83
    }
  }
}
```

## Maintenance

### Adding New Test Suites

1. Create new test file in `tests/integration/`
2. Add suite configuration to `integration-test-runner.js`
3. Update this README with suite description
4. Add any required dependencies to Docker Compose

### Updating Test Data

Test data factories are in `test-data-factory.js`:

```javascript
export class MyNewFactory extends BaseFactory {
  create(overrides = {}) {
    return {
      id: this.sequence('my-entity'),
      name: faker.lorem.words(2),
      ...overrides
    };
  }
}
```

### Performance Tuning

- Adjust timeouts in test suite configuration
- Use `--sequential` for debugging race conditions
- Monitor memory usage with `--verbose`
- Use Docker resource limits for consistent performance

## Troubleshooting

### Common Issues

1. **Docker tests failing**: Ensure Docker is running and ports are available
2. **Timeouts**: Increase timeout values for slow environments
3. **Port conflicts**: Check if test ports (3001, 5433, 3307, etc.) are available
4. **Memory issues**: Run tests sequentially or reduce parallel batch size

### Debug Mode

```bash
# Enable verbose output
./integration-test-runner.js --verbose

# Run single test suite for debugging
./integration-test-runner.js --filter smoke --verbose

# Use dry-run to validate configuration
./integration-test-runner.js --dry-run
```

## Contributing

1. Follow existing test patterns and conventions
2. Ensure all tests are deterministic and isolated
3. Add appropriate cleanup in `afterEach`/`afterAll` hooks
4. Document any new test patterns or utilities
5. Update this README for significant changes

---

This integration test suite provides comprehensive validation for production scenarios while maintaining fast execution times and reliable results. The modular architecture allows for easy extension and maintenance while ensuring consistent test quality across the entire codebase.