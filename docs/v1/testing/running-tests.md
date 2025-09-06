# Running Tests

Essential commands and workflows for testing Unjucks generators and templates.

## Quick Start

### Essential Commands

```bash
# Install and build first
pnpm install
pnpm build

# Run critical functionality tests (< 30 seconds)
pnpm test:smoke

# Run main BDD test suite (< 2 minutes)  
pnpm test:cucumber

# Run all tests including unit tests
pnpm test
```

## Test Categories

### Smoke Tests - Critical Functionality
**Quick validation of core features**

```bash
# Run smoke tests only
pnpm test:smoke

# What it tests:
# - Basic CLI commands work
# - Core generator discovery
# - Essential template rendering
# - File creation operations
```

### BDD Tests - Complete Feature Validation
**Comprehensive behavior validation**

```bash
# All BDD scenarios (302 scenarios)
pnpm test:cucumber

# Run by feature category
pnpm test:cucumber -- features/cli/
pnpm test:cucumber -- features/generators/
pnpm test:cucumber -- features/templates/
pnpm test:cucumber -- features/injection/
```

### Regression Tests - Full Validation
**Complete functionality testing**

```bash
# Full regression suite
pnpm test:regression

# What it includes:
# - All BDD scenarios
# - Performance benchmarks  
# - Edge case validation
# - Error scenario testing
```

## Tag-Based Testing

### Run by Priority

```bash
# Critical functionality only
pnpm test:cucumber -- --tags "@critical"

# Core features excluding slow tests
pnpm test:cucumber -- --tags "@core and not @slow"

# Integration tests only
pnpm test:cucumber -- --tags "@integration"
```

### Run by Component

```bash
# CLI testing
pnpm test:cucumber -- --tags "@cli"

# Generator functionality
pnpm test:cucumber -- --tags "@generators"

# Template processing
pnpm test:cucumber -- --tags "@templates"

# File injection features
pnpm test:cucumber -- --tags "@injection"
```

## Development Workflow

### TDD Development Cycle

```bash
# 1. Watch mode for rapid feedback
pnpm test:watch

# 2. Run specific feature during development
pnpm test:cucumber -- features/generators/generator-execution.feature

# 3. Validate changes with smoke tests
pnpm test:smoke

# 4. Full validation before commit
pnpm test:cucumber
```

### Feature Development Workflow

```bash
# 1. Create new feature file
touch features/my-feature/new-functionality.feature

# 2. Run to see missing steps
pnpm test:cucumber -- features/my-feature/

# 3. Implement step definitions
# Edit tests/step-definitions/my-feature.steps.ts

# 4. Run until all scenarios pass
pnpm test:cucumber -- features/my-feature/ --fail-fast

# 5. Full regression test
pnpm test:cucumber
```

## Performance Testing

### Benchmark Tests

```bash
# Performance-tagged scenarios
pnpm test:cucumber -- --tags "@performance"

# What it measures:
# - Generation time for single templates
# - Bulk generation performance  
# - Memory usage during operations
# - CLI startup time
```

### Performance Validation

```bash
# Run with timing information
time pnpm test:smoke

# Expected results:
# Smoke tests: < 30 seconds
# Core BDD: < 2 minutes
# Full suite: < 5 minutes
```

## Debugging Tests

### Debug Individual Scenarios

```bash
# Run single scenario with debug output
pnpm test:cucumber -- --name "Generate basic component" --format=@cucumber/pretty-formatter

# Run with specific tags and detailed output
pnpm test:cucumber -- --tags "@debug" --format-options '{"snippetInterface": "async-await"}'
```

### Debug Test Failures

```bash
# Keep test files for inspection
KEEP_TEST_FILES=1 pnpm test:cucumber

# Enable debug logging
DEBUG=1 pnpm test:cucumber

# Run with fail-fast to stop on first failure
pnpm test:cucumber -- --fail-fast
```

## Continuous Integration

### Pre-Commit Validation

```bash
# Quick validation before commit
pnpm test:smoke

# Format and lint
pnpm lint:fix
pnpm format

# Type checking
pnpm type-check
```

### Pre-Push Validation

```bash
# Full feature validation
pnpm test:cucumber

# Build verification
pnpm build

# Coverage check
pnpm test -- --coverage
```

## Coverage and Reporting

### Generate Coverage Reports

```bash
# Run tests with coverage
pnpm test -- --coverage

# BDD coverage (integration with code coverage)
pnpm test:cucumber -- --format json:reports/cucumber.json

# View HTML coverage report
open coverage/index.html
```

### Coverage Targets

- **Line Coverage**: > 85%
- **Branch Coverage**: > 80%
- **Function Coverage**: > 90%
- **BDD Scenario Coverage**: > 95%

## Test Configuration

### Environment Variables

```bash
# Keep temporary test files for debugging
KEEP_TEST_FILES=1 pnpm test:cucumber

# Enable debug output
DEBUG=1 pnpm test:cucumber

# Set test timeout (for slow systems)
TEST_TIMEOUT=30000 pnpm test:cucumber

# Specify test workspace location
TEST_WORKSPACE=/tmp/unjucks-test pnpm test:cucumber
```

### Parallel Execution

```bash
# Run tests in parallel (faster execution)
pnpm test:cucumber -- --parallel 4

# For CI environments
pnpm test:cucumber -- --parallel $(nproc)
```

## Quality Gates

### Development Quality Gates

1. **Smoke Tests Pass**: All critical functionality works
2. **No TypeScript Errors**: Clean type checking
3. **Lint Clean**: Code style compliance
4. **Unit Tests Pass**: Component-level validation

### Release Quality Gates

1. **100% Smoke Test Coverage**: All critical paths tested
2. **>95% BDD Scenario Coverage**: Comprehensive feature testing
3. **>85% Code Coverage**: Adequate line coverage
4. **Performance Benchmarks Met**: Within acceptable thresholds
5. **Security Tests Pass**: No vulnerabilities detected

## Common Issues & Solutions

### Test Execution Issues

```bash
# If tests fail to run:
# 1. Ensure project is built
pnpm build

# 2. Clear node modules if needed  
rm -rf node_modules && pnpm install

# 3. Check TypeScript compilation
pnpm type-check
```

### Flaky Tests

```bash
# Run specific test multiple times to check stability
for i in {1..10}; do pnpm test:cucumber -- --name "Flaky scenario"; done

# Run with increased timeout
pnpm test:cucumber -- --timeout 10000
```

### Performance Issues

```bash
# Profile test execution
NODE_ENV=test pnpm test:cucumber -- --profile

# Monitor memory usage
pnpm test:cucumber -- --format json | jq '.duration'
```

---

*Focus on essential testing commands for efficient development workflow.*