# Unjucks CLI Test Suite

Comprehensive test coverage for the Unjucks CLI with Citty integration, ensuring robust functionality across all command scenarios.

## Test Structure

### 🔧 Core Functionality Tests (`core-cli.test.ts`)
- Basic command structure and recognition
- Version and help flag handling
- Hygen-style positional argument transformation
- Environment variable management
- Flag processing (--dest, --force, --dry)

### 🔄 Backward Compatibility Tests (`backward-compatibility.test.ts`)
- Classic Hygen pattern support
- Variable precedence rules
- Traditional command patterns
- Complex variable patterns
- File system operations compatibility
- Migration from pure Hygen

### ⚠️ Error Handling Tests (`error-handling.test.ts`)
- Generator and template not found errors
- Malformed template handling
- File system permission errors
- Argument validation errors
- Network and dependency errors
- Memory and resource limits
- Concurrent access scenarios
- Recovery and cleanup procedures

### 📚 Help System Tests (`help-system.test.ts`)
- Global help display
- Command-specific help
- Template-specific help with variable documentation
- Positional vs flag parameter differentiation
- Variable type documentation
- Contextual help and error suggestions
- Help formatting and readability

### 🔗 Semantic Commands Tests (`semantic-commands.test.ts`)
- Semantic command structure recognition
- RDF/OWL ontology integration
- Type generation from semantic data
- Scaffolding with semantic awareness
- Validation of semantic code generation
- Enterprise mode functionality

### 🧩 Argument Parsing Tests (`argument-parsing.test.ts`)
- Positional parameter parsing with validation
- Special characters and Unicode handling
- Array and object parameters
- Type validation and conversion
- Flag variations and aliases
- Complex argument combinations
- Error recovery and validation
- Performance with complex arguments

### 📁 File Operations Tests (`file-operations.test.ts`)
- Basic file creation and multiple file templates
- Dry run mode functionality
- File overwriting and force mode
- File injection operations (append, prepend, after markers)
- Error handling for file system issues
- Performance with large files
- File metadata and attributes

### 🔀 Command Combinations Tests (`command-combinations.test.ts`)
- Sequential command execution workflows
- Parallel command execution
- Complex flag combinations
- Multi-template workflows
- Error recovery in complex scenarios
- Performance with multiple operations
- CLI state management and isolation

### ⚡ Performance & Edge Cases Tests (`performance-edge-cases.test.ts`)
- Performance benchmarks for basic operations
- Memory and resource usage testing
- Stress testing with rapid commands
- Edge case handling (empty directories, malformed files)
- Resource cleanup and recovery
- Performance regression detection
- Memory leak detection

### 🌊 Full Workflow Integration Tests (`full-workflows.test.ts`)
- React component workflows (component + props + styles + tests + stories)
- API development workflows (router + controller + service layers)
- Full-stack feature creation
- Project initialization workflows
- Development workflow integration
- Cross-feature integration

## Running Tests

### All CLI Tests
```bash
npm run test:cli
```

### Watch Mode
```bash
npm run test:cli:watch
```

### Individual Test Suites
```bash
# Core functionality
npm run test:cli:core

# Backward compatibility
npm run test:cli:compatibility

# Error handling
npm run test:cli:errors

# Help system
npm run test:cli:help

# Semantic commands
npm run test:cli:semantic

# Argument parsing
npm run test:cli:args

# File operations
npm run test:cli:files

# Command combinations
npm run test:cli:combinations

# Performance and edge cases
npm run test:cli:performance

# Full workflows
npm run test:cli:workflows
```

## Test Coverage Areas

### ✅ Command Recognition
- [x] Citty command structure
- [x] Hygen-style positional syntax
- [x] Flag and option parsing
- [x] Help system integration

### ✅ Backward Compatibility
- [x] Existing Hygen workflows
- [x] Template discovery patterns
- [x] Variable precedence rules
- [x] File generation patterns

### ✅ Error Scenarios
- [x] Missing generators/templates
- [x] Invalid arguments
- [x] File system errors
- [x] Permission issues
- [x] Network failures
- [x] Resource constraints

### ✅ Advanced Features
- [x] Semantic/RDF integration
- [x] Complex argument parsing
- [x] File injection operations
- [x] Dry run functionality
- [x] Force overwrite modes

### ✅ Performance & Reliability
- [x] Large file handling
- [x] Concurrent operations
- [x] Memory usage
- [x] Error recovery
- [x] State isolation

### ✅ Real-World Workflows
- [x] React development
- [x] API development
- [x] Full-stack features
- [x] Documentation generation
- [x] Cross-component integration

## Test Quality Standards

### Coverage Requirements
- **Statements**: >85%
- **Branches**: >80%
- **Functions**: >85%
- **Lines**: >85%

### Test Characteristics
- **Isolated**: Each test runs independently
- **Fast**: Most tests complete under 30 seconds
- **Reliable**: Consistent results across runs
- **Comprehensive**: All major code paths covered
- **Realistic**: Real-world scenarios tested

### Performance Benchmarks
- **Simple commands**: <5 seconds
- **File generation**: <15 seconds
- **Complex workflows**: <2 minutes
- **Concurrent operations**: 70%+ success rate

## Contributing

When adding new CLI features:

1. **Add corresponding tests** in the appropriate test file
2. **Update this README** with new test coverage
3. **Ensure performance standards** are maintained
4. **Test edge cases** and error scenarios
5. **Verify backward compatibility** is preserved

## Test Environment

Tests run in isolated temporary directories with:
- Clean file systems for each test
- Mocked external dependencies where needed
- Timeout protection for long-running operations
- Proper cleanup after test completion

## Known Limitations

- **External dependencies**: Some tests may require actual file system operations
- **Performance variance**: Test timing may vary based on system performance
- **Platform differences**: Some file system behaviors may differ between platforms
- **Semantic features**: Full semantic integration may not be implemented yet

## Debugging Tests

### Enable Debug Mode
```bash
DEBUG_UNJUCKS=true npm run test:cli:core
```

### Individual Test Debugging
```bash
# Run specific test with verbose output
npx vitest run tests/cli/core-cli.test.ts --reporter=verbose
```

### Performance Profiling
```bash
# Run performance tests with detailed timing
npm run test:cli:performance
```