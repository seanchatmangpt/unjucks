# Testing Documentation Overview

## Testing Strategy

This project implements a comprehensive testing strategy following the test pyramid principle with emphasis on behavior-driven development (BDD) and test-driven development (TDD).

### Test Architecture

```
         /\
        /E2E\      <- Few, high-value (CI/CD integration)
       /------\
      /Integr. \   <- Moderate coverage (workflow validation)
     /----------\
    /   Unit     \ <- Many, fast, focused (template/parser tests)
   /--------------\
```

## Test Types & Coverage

### 1. Unit Tests (80% coverage target)
- **Template parsing and validation**: Frontmatter, Nunjucks syntax
- **Core utilities**: File operations, configuration loading
- **Filters and functions**: Custom Nunjucks filters
- **Error handling**: Edge cases and boundary conditions

### 2. Integration Tests (60% coverage target)
- **MCP server validation**: Live server communication
- **End-to-end workflows**: Template discovery → generation → injection
- **File system operations**: Atomic writes, injection patterns
- **Configuration loading**: c12 config resolution

### 3. BDD/Cucumber Tests (Feature coverage)
- **User scenarios**: Command-line interface behaviors
- **Workflow validation**: Multi-step generation processes
- **Error scenarios**: Graceful failure handling
- **Performance requirements**: Benchmarking critical paths

### 4. Performance Tests
- **Template rendering**: Large template processing
- **Concurrent operations**: Parallel file generation
- **Memory usage**: Long-running processes
- **Stress testing**: High-volume template generation

## Test Framework Stack

### Core Testing
- **Vitest**: Fast unit test runner with TypeScript support
- **vitest-cucumber**: BDD testing with Gherkin syntax
- **@vitest/ui**: Interactive test interface
- **@vitest/coverage-v8**: Code coverage reporting

### Testing Utilities
- **@testing-library/jest-dom**: Enhanced DOM assertions
- **happy-dom**: Lightweight DOM implementation
- **Mock utilities**: Built-in vi.mock() and vi.fn()

### Performance Testing
- **Benchmark.js**: Performance benchmarking
- **clinic.js**: Node.js performance profiling
- **Memory usage tracking**: Built-in process monitoring

## Running Tests

### Development Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:bdd
npm run test:performance
```

### CI/CD Commands
```bash
# Run tests with coverage
npm run test:coverage

# Generate coverage reports
npm run test:report

# Run performance benchmarks
npm run test:benchmark

# Validate MCP integration
npm run test:mcp
```

## Test Organization

```
tests/
├── unit/                 # Unit tests
│   ├── parser/          # Template parsing tests
│   ├── generators/      # Generator logic tests
│   └── utils/           # Utility function tests
├── integration/         # Integration tests  
│   ├── workflows/       # End-to-end workflow tests
│   ├── mcp/            # MCP server validation
│   └── file-ops/       # File operation tests
├── features/           # BDD/Cucumber feature files
│   ├── *.feature      # Gherkin scenarios
│   └── *.feature.spec.ts # Step definitions
├── performance/        # Performance benchmarks
│   ├── rendering/      # Template rendering benchmarks
│   └── concurrent/     # Concurrency tests
├── fixtures/           # Test data and mock files
│   ├── templates/      # Sample templates
│   ├── config/         # Test configurations
│   └── expected/       # Expected outputs
├── regression/         # Regression test suites
└── security/          # Security validation tests
```

## Quality Gates

### Pre-commit Requirements
- All tests must pass
- Code coverage >= 80% for unit tests
- No linting errors
- TypeScript type checking passes

### CI/CD Pipeline Requirements
- Full test suite passes
- Integration tests validate MCP connectivity
- Performance benchmarks meet thresholds
- Security scans pass
- Documentation tests validate examples

## Test Data Management

### Mock vs Live Testing
- **Unit tests**: Use mocked dependencies for isolation
- **Integration tests**: Use live MCP servers when available
- **BDD tests**: Mix of mocked and live data based on scenario
- **Performance tests**: Use realistic data volumes

### Fixture Management
- **Template fixtures**: Reusable template examples
- **Configuration fixtures**: Various config scenarios
- **Expected outputs**: Golden files for validation
- **Test data generation**: Dynamic test data creation

## Coverage Reporting

### Coverage Targets
- **Statements**: >80%
- **Branches**: >75%  
- **Functions**: >80%
- **Lines**: >80%

### Coverage Analysis
- Identify uncovered critical paths
- Focus on high-risk areas (file operations, parsing)
- Balance between coverage percentage and test quality
- Use coverage data to guide test improvement

## Best Practices

### Test Writing Guidelines
1. **AAA Pattern**: Arrange, Act, Assert
2. **Single Responsibility**: One test per behavior
3. **Descriptive Names**: Tests as documentation
4. **Fast Execution**: Unit tests <100ms
5. **Isolation**: No dependencies between tests
6. **Deterministic**: Same results every run

### Performance Considerations
- Keep test suites fast to encourage frequent running
- Use parallel execution for independent tests
- Mock expensive operations in unit tests
- Profile slow tests and optimize

### Maintenance
- Regular test review and cleanup
- Update tests when requirements change
- Monitor test flakiness and fix immediately
- Keep test dependencies up to date

## Documentation Structure

- **[Overview](overview.md)**: This document
- **[MCP Validation](mcp-validation.md)**: MCP server testing
- **[BDD/Cucumber](bdd-cucumber.md)**: Behavior-driven testing
- **[Performance](performance.md)**: Benchmarking and optimization
- **[Integration](integration.md)**: End-to-end testing
- **[Unit Testing](unit-testing.md)**: Component-level testing
- **[CI/CD](ci-cd.md)**: Automated testing pipelines
- **[Coverage](coverage.md)**: Coverage analysis and reporting

## Getting Started

1. **Install dependencies**: `npm install`
2. **Run initial test suite**: `npm run test`
3. **Review test coverage**: `npm run test:coverage`
4. **Explore BDD scenarios**: Check `tests/features/`
5. **Run performance benchmarks**: `npm run test:performance`

For specific testing scenarios and examples, see the individual documentation files in this directory.