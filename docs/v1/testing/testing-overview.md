# Testing Overview

Essential guide to testing in Unjucks with focus on quality validation and practical workflows.

## Core Testing Philosophy

Unjucks uses **Test-Driven Development (TDD)** with comprehensive **Behavior-Driven Development (BDD)** scenarios to ensure:

- **Generator Reliability**: Templates produce correct, consistent output
- **CLI Robustness**: Commands work as expected with proper error handling  
- **Injection Safety**: File modifications are atomic and idempotent
- **Quality Assurance**: All features maintain high standards

## Testing Stack

### Primary Tools
- **BDD Framework**: Cucumber.js with Gherkin syntax
- **Test Runner**: Vitest for unit tests and coverage
- **Language**: TypeScript with full type safety
- **Assertions**: Built-in Vitest/Chai assertions

### Test Architecture
```
tests/
├── step-definitions/    # BDD step implementations
├── support/            # Test utilities and helpers  
├── fixtures/           # Sample templates and data
└── unit/              # Unit tests
```

## Test Types & Coverage

### 1. BDD Feature Tests (302 scenarios)
**Core functionality validated through real-world scenarios**

#### Generator Features (84 scenarios)
- Template discovery and listing
- Generator execution with variables
- Help system and documentation
- Error handling for missing/invalid generators

#### CLI Features (66 scenarios) 
- Command parsing and validation
- Interactive prompts and options
- Error messages and help text
- Performance benchmarks

#### Injection Features (71 scenarios)
- File modification modes (before/after/append/prepend)
- Atomic operations and rollback
- Idempotency testing
- Multi-target injection

#### Template Features (81 scenarios)
- Variable extraction and usage
- Nunjucks rendering with filters
- Conditional logic and frontmatter
- Custom filter functionality

### 2. Unit Tests
**Component-level validation for core classes**

- Generator discovery and execution
- Template parsing and rendering
- CLI argument processing
- File system operations
- Configuration loading

### 3. Quality Validation
**Automated quality checks**

- Code coverage (target: >85%)
- Performance benchmarks (<100ms for basic operations)
- Memory usage validation
- Security testing (path traversal, injection prevention)

## Testing Principles

### Quality First
- **Real Functionality**: No mocks or placeholders in tests
- **Error Coverage**: Test both success and failure paths
- **Edge Cases**: Handle boundary conditions and invalid input
- **Isolation**: Each test runs independently

### Practical Focus  
- **Essential Commands**: Focus on most-used functionality
- **Quick Feedback**: Fast test execution for development workflow
- **Clear Reporting**: Actionable test results and coverage reports
- **Documentation**: Tests serve as usage examples

## Quick Start

### Run Essential Tests
```bash
# Smoke tests - critical functionality (< 30 seconds)
pnpm test:smoke

# Core BDD tests - main features (< 2 minutes)  
pnpm test:cucumber

# Full regression suite (< 5 minutes)
pnpm test:regression
```

### Development Workflow
```bash
# Watch mode for TDD
pnpm test:watch

# Specific feature testing
pnpm test:cucumber -- features/generators/

# Tagged test execution
pnpm test:cucumber -- --tags "@core and not @slow"
```

## Quality Gates

### Pre-Commit Requirements
- All smoke tests pass
- No TypeScript errors
- Code formatting clean

### Pre-Release Requirements  
- 100% smoke test coverage
- >90% BDD scenario coverage
- >85% code coverage
- Performance benchmarks within thresholds

### Continuous Validation
- Automated test execution on all PRs
- Coverage reporting and trend analysis
- Performance regression detection
- Security validation

## Next Steps

- **Running Tests**: See [running-tests.md](running-tests.md) for detailed commands
- **Template Testing**: See [testing-templates.md](testing-templates.md) for practical examples
- **Contributing**: Follow TDD workflow with BDD scenarios first

---

*Focus on essential testing practices for reliable generator functionality.*