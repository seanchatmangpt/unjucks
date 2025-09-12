# KGEN Test Suite

Comprehensive test suite for the KGEN Knowledge Graph Engine with 90%+ coverage on critical paths.

## Test Structure

```
tests/
├── fixtures/           # Test data and templates
│   ├── graphs/         # Sample RDF graphs
│   └── templates/      # Test templates
├── unit/              # Unit tests
│   ├── engine.test.js           # Core engine tests
│   ├── graph/
│   │   └── processor.test.js    # Graph processing tests
│   ├── deterministic.test.js    # Deterministic generation tests
│   ├── provenance.test.js       # Provenance tracking tests
│   ├── cache.test.js           # Cache behavior tests
│   ├── documents.test.js        # Document generation tests
│   └── graph-diff.test.js      # Graph diff edge cases
├── integration/       # Integration tests
└── setup.js          # Test setup and utilities
```

## Key Test Scenarios

### ✅ Deterministic Generation
- Byte-for-byte reproducible output
- Consistent checksums across runs
- Cross-platform determinism
- Floating point precision handling
- Sort order consistency

### ✅ Drift Detection
- File modification detection
- Hash mismatch identification
- Source file tracking
- Severity assessment
- Recovery mechanisms

### ✅ Provenance Verification
- Complete generation lineage tracking
- Cryptographic attestations
- Signature validation
- Compliance reporting (SLSA)
- Chain-of-custody verification

### ✅ Cache Performance
- Hit/miss ratio optimization
- LRU eviction strategies
- Size management
- Concurrent access safety
- Persistence across restarts

### ✅ Graph Operations
- RDF parsing accuracy
- Diff computation correctness
- Blank node handling
- Namespace normalization
- Large graph performance

### ✅ Document Generation
- LaTeX compilation
- Office document creation
- PDF generation from HTML
- Multi-format support
- Styling and formatting

## Running Tests

### All Tests
```bash
# Run complete test suite
npm test

# Run with coverage
npm run test:coverage

# Run specific package tests
npm run test --workspace=@kgen/core
npm run test --workspace=@kgen/cli
```

### Individual Test Files
```bash
# Run specific test file
npx vitest run tests/unit/engine.test.js

# Run tests in watch mode
npx vitest tests/unit/

# Run with debugging
npx vitest run --reporter=verbose tests/unit/deterministic.test.js
```

### Test Runner
```bash
# Use comprehensive test runner with coordination hooks
node tests/kgen-test-runner.js
```

## Test Configuration

### Vitest Configuration
- Global test environment setup
- Mock configuration for external dependencies
- Coverage thresholds (>80% statements, >75% branches)
- Custom matchers and utilities
- Timeout handling for long-running tests

### Environment Variables
- `NODE_ENV=test` - Test environment
- `KGEN_TEST_MODE=true` - Enable test mode
- `KGEN_DISABLE_CACHE=true` - Disable caching in tests

## Coverage Targets

| Metric | Target | Current |
|--------|--------|----------|
| Statements | >80% | - |
| Branches | >75% | - |
| Functions | >80% | - |
| Lines | >80% | - |

## Test Data

### RDF Graphs
- `simple-person.ttl` - Basic person data with foaf properties
- `complex-hierarchy.ttl` - SKOS concept hierarchy with relations

### Templates
- `person-template.json` - TypeScript interface generation
- `hierarchy-template.json` - Hierarchical data structures

## Best Practices

### Test Organization
- One test file per module
- Descriptive test names explaining behavior
- Arrange-Act-Assert structure
- Independent tests (no shared state)

### Mock Strategy
- Mock external dependencies (file system, network)
- Use real implementations for core logic
- Provide deterministic mock responses
- Restore mocks after each test

### Performance Testing
- Measure execution time for critical operations
- Test with large datasets
- Validate memory usage patterns
- Concurrent operation testing

### Error Handling
- Test all error conditions
- Validate error messages and codes
- Test recovery mechanisms
- Edge case handling

## Coordination Hooks

Tests integrate with Claude Flow coordination hooks for:
- Pre-test setup and environment preparation
- Progress notification during test execution
- Post-test cleanup and metric collection
- Session management across test suites

## Debugging Tests

### Debug Individual Tests
```bash
# Run single test with debugging
npx vitest run --reporter=verbose tests/unit/engine.test.js

# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest run tests/unit/engine.test.js
```

### Common Issues
- **Timeout errors**: Increase test timeout for long-running operations
- **Mock failures**: Verify mock setup and restoration
- **File system errors**: Check test cleanup and temp directory handling
- **Async issues**: Ensure proper Promise handling and await usage

## Contributing

### Adding New Tests
1. Create test file following naming convention (`*.test.js`)
2. Import required modules and test utilities
3. Use descriptive `describe` and `it` blocks
4. Include setup/teardown as needed
5. Add to appropriate test suite in configuration

### Test Requirements
- All new features must include comprehensive tests
- Tests must be deterministic and repeatable
- Edge cases and error conditions must be covered
- Performance implications should be validated
- Documentation should be updated accordingly

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Main branch commits
- Release preparation
- Scheduled daily builds

Failure conditions:
- Any test failures
- Coverage below thresholds
- Performance regressions
- Security vulnerabilities detected
