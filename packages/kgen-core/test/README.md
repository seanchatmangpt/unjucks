# KGEN Core Test Suite

A comprehensive test architecture designed for determinism, correctness, and compliance validation of the KGEN knowledge graph engine.

## 🎯 Test Philosophy

This test suite is built on the principle of **deterministic validation** - ensuring that KGEN produces byte-for-byte identical outputs for identical inputs, maintaining consistency across runs, environments, and time.

## 📁 Test Structure

```
packages/kgen-core/test/
├── unit/                    # Unit tests for individual components
│   ├── core/               # Core engine functionality
│   ├── semantic/           # Semantic processing
│   ├── ingestion/          # Data ingestion pipeline
│   └── validation/         # Validation engines
├── integration/            # Cross-component integration tests
│   ├── determinism.test.js # Byte-for-byte output validation
│   └── workflows.test.js   # End-to-end workflows
├── performance/            # Performance benchmarks and regression detection
│   └── benchmarks.test.js  # Performance validation
├── compliance/             # Security and regulatory compliance
│   └── security.test.js    # GDPR, SOX, HIPAA compliance
├── fixtures/               # Reusable test data and scenarios
│   └── sample-data.js      # RDF graphs, templates, queries
├── utils/                  # Test utilities and helpers
│   ├── test-helpers.js     # Common test operations
│   ├── test-database.js    # In-memory test database
│   └── test-logger.js      # Deterministic logging
├── setup/                  # Test environment setup
│   └── global-setup.js     # Global test configuration
├── vitest.config.js        # Vitest configuration
├── test-runner.js          # Orchestrated test execution
└── package.json            # Test dependencies
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

```bash
cd packages/kgen-core/test
npm install
```

### Running Tests

```bash
# Run all test suites
npm test

# Run specific test categories
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests
npm run test:performance       # Performance benchmarks
npm run test:compliance        # Security & compliance
npm run test:determinism       # Determinism validation

# Coverage reporting
npm run test:coverage          # Generate coverage report
npm run coverage:report        # HTML coverage report

# Continuous testing
npm run test:watch             # Watch mode for development

# CI/CD pipeline
npm run test:ci                # JUnit XML output for CI
```

### Test Runner

The orchestrated test runner provides comprehensive validation:

```bash
# Run all tests with detailed reporting
node test-runner.js

# Run specific test suite
node test-runner.js --suite unit_tests
node test-runner.js --suite determinism_validation

# Help and options
node test-runner.js --help
```

## 🔬 Test Categories

### 1. Unit Tests (`unit/`)

**Purpose**: Validate individual component functionality in isolation.

**Coverage Requirements**: >90% code coverage for all core modules.

**Key Features**:
- Component isolation with mocking
- Edge case validation
- Error handling verification
- API contract testing

**Example**:
```javascript
describe('KGenEngine Core Functionality', () => {
  it('should initialize with correct state and version', async () => {
    expect(engine.state).toBe('ready');
    expect(engine.getVersion()).toBe('1.0.0');
  });
});
```

### 2. Integration Tests (`integration/`)

**Purpose**: Validate cross-component interactions and workflows.

**Focus**: End-to-end data flow validation from ingestion to generation.

**Key Features**:
- Complete workflow testing
- Component interaction validation
- Real data processing
- Error propagation testing

### 3. Determinism Tests (`integration/determinism.test.js`)

**Purpose**: Ensure byte-for-byte identical outputs for identical inputs.

**Critical Requirements**:
- Identical results across multiple runs
- Temporal consistency (time-independent results)
- Environment independence
- Data integrity validation with checksums

**Example**:
```javascript
it('should produce identical results for identical RDF inputs', async () => {
  const result1 = await engine1.ingest(sources, { user: 'test-user' });
  const result2 = await engine2.ingest(sources, { user: 'test-user' });
  
  // Results should be byte-for-byte identical
  expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
});
```

### 4. Performance Tests (`performance/`)

**Purpose**: Validate performance characteristics and detect regressions.

**Benchmarks**:
- Ingestion performance (small, medium, large datasets)
- Reasoning performance scaling
- Query execution speed
- Memory usage patterns
- Concurrent operation handling

**Regression Detection**:
- Baseline comparison
- Performance thresholds
- Memory leak detection

### 5. Compliance Tests (`compliance/`)

**Purpose**: Validate security measures and regulatory compliance.

**Frameworks Covered**:
- **GDPR**: Data subject rights, consent management, retention policies
- **SOX**: Audit trails, financial data controls
- **HIPAA**: Healthcare data protection
- **Security**: Authentication, authorization, encryption

**Key Features**:
- Role-based access control validation
- Data encryption verification
- Audit trail completeness
- Compliance reporting

## 🛠 Test Utilities

### TestHelpers Class

Provides utilities for creating deterministic test scenarios:

```javascript
import { TestHelpers } from '../utils/test-helpers.js';

const testHelpers = new TestHelpers();

// Create sample RDF data
const rdfContent = testHelpers.createSampleRDF('person', 'John Doe');

// Create knowledge graphs
const graph = testHelpers.createKnowledgeGraph(entities, relationships);

// Performance measurement
const perfStats = await testHelpers.measurePerformance(operation, iterations);
```

### TestDatabase Class

In-memory SQLite database for consistent test data:

```javascript
// Setup test data
await global.testUtils.database.seedTestData();

// Verify data integrity
const integrity = global.testUtils.database.verifyDataIntegrity();
expect(integrity.entities.valid).toBe(integrity.entities.total);
```

### TestLogger Class

Deterministic logging for test validation:

```javascript
// Capture logs during operations
const logs = global.testUtils.logger.getAllLogs();

// Validate specific log patterns
global.testUtils.logger.expectLog('operation completed');
global.testUtils.logger.expectNoErrors();
```

## 📊 Coverage Requirements

### Minimum Coverage Thresholds

- **Statements**: 90%
- **Branches**: 90%  
- **Functions**: 90%
- **Lines**: 90%

### Coverage Exclusions

- Test files (`test/**`)
- Example files (`examples/**`)
- Fixture data (`fixtures/**`)
- Configuration files (`**/*.config.js`)

## 🔧 Configuration

### Vitest Configuration

```javascript
// vitest.config.js
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup/global-setup.js'],
    coverage: {
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    // Determinism settings
    retry: 0,           // No retries for determinism
    threads: false,     // Single-threaded execution
    isolate: true       // Isolated test environments
  }
});
```

### Environment Variables

```bash
# Test environment
NODE_ENV=test
KGEN_TEST_MODE=true
TZ=UTC                    # Consistent timezone

# Database
DATABASE_URL=":memory:"   # In-memory for speed

# Security
ENCRYPTION_KEY=test-key-32-chars-long-please
```

## 🚨 Critical Test Scenarios

### 1. Data Integrity Validation

```javascript
it('should maintain checksum consistency', async () => {
  result.entities.forEach(entity => {
    const calculatedChecksum = testHelpers.calculateHash(entity);
    expect(entity.checksum).toBe(calculatedChecksum);
  });
});
```

### 2. Cross-Session Determinism

```javascript
it('should maintain determinism across engine restarts', async () => {
  // First session
  const result1 = await engine1.ingest(sources);
  await engine1.shutdown();

  // Second session  
  const result2 = await engine2.ingest(sources);
  
  expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
});
```

### 3. Security Validation

```javascript
it('should prevent RDF injection attacks', async () => {
  const maliciousRDF = `/* injection attempt */`;
  const result = await engine.ingest([{ content: maliciousRDF }]);
  
  // Verify no administrative entities were created
  const adminEntities = result.entities.filter(e => e.type === 'Administrator');
  expect(adminEntities).toHaveLength(0);
});
```

### 4. Performance Regression Detection

```javascript
it('should detect performance regressions', async () => {
  const currentPerf = await testHelpers.measurePerformance(operation);
  
  if (performanceBaseline) {
    const regressionThreshold = 1.3; // 30% degradation threshold
    expect(currentPerf.averageDuration)
      .toBeLessThan(baseline.averageDuration * regressionThreshold);
  }
});
```

## 🎯 Testing Best Practices

### 1. Deterministic Test Design

- Use fixed timestamps (`Date.now = () => mockTimestamp`)
- Sort results for consistent ordering
- Use deterministic IDs and hashes
- Avoid random data generation

### 2. Test Isolation

- Each test runs in isolation
- Clean database state between tests
- No shared mutable state
- Independent test data

### 3. Error Testing

- Test both success and failure paths
- Validate error messages and codes
- Test error recovery scenarios
- Verify error propagation

### 4. Performance Testing

- Establish performance baselines
- Test with realistic data sizes
- Monitor memory usage
- Validate scaling characteristics

## 📈 Continuous Integration

### CI Pipeline Integration

```yaml
# .github/workflows/test.yml
- name: Run KGEN Core Tests
  run: |
    cd packages/kgen-core/test
    npm install
    npm run test:ci
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./packages/kgen-core/test/coverage/lcov.info
```

### Quality Gates

- All required tests must pass
- Coverage thresholds must be met
- No security vulnerabilities
- Performance within acceptable ranges

## 🐛 Debugging Tests

### Debug Mode

```bash
# Verbose test output
npm run test:debug

# Debug specific test
npx vitest run unit/core/engine.test.js --reporter=verbose

# Debug with browser dev tools
npx vitest --inspect-brk
```

### Test Logs

```bash
# View test logs
cat test-results/results.json

# Performance benchmark results
cat test-results/benchmark.json

# Coverage report
open coverage/index.html
```

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [KGEN Architecture Guide](../docs/architecture.md)
- [GDPR Compliance Guide](../docs/compliance/gdpr.md)
- [Performance Tuning](../docs/performance.md)

## 🤝 Contributing

When adding new tests:

1. Follow the deterministic testing principles
2. Add appropriate test categories (unit/integration/performance/compliance)
3. Update coverage thresholds if needed
4. Document new test scenarios
5. Ensure tests pass in isolation and in the full suite

## 🔒 Security Testing

This test suite includes comprehensive security validation:

- Authentication and authorization testing
- Input validation and sanitization
- Encryption and data protection
- Audit trail verification
- Compliance framework validation
- Vulnerability scanning integration

---

**Remember**: The goal is not just to test functionality, but to ensure deterministic, secure, and compliant operation of the KGEN knowledge graph engine.