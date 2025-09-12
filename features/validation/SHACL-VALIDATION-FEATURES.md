# KGEN SHACL Validation Features - Implementation Guide

## Overview

This document describes the comprehensive Gherkin features created for KGEN's SHACL validation engine, covering core constraint validation, graph compliance testing, error reporting, CLI integration, and performance validation.

## Feature Files Created

### 1. Core SHACL Constraint Validation (`shacl/shacl-validation.feature`)

**Purpose**: Test the fundamental SHACL constraint validation engine functionality.

**Key Scenarios**:
- **Engine Initialization**: Verify SHACL engine starts correctly with shapes loading
- **Positive Validation**: Test compliant RDF data validation success paths
- **Negative Validation**: Test detection of SHACL constraint violations
- **Constraint Types**: Validate multiple constraint types (cardinality, datatype, pattern, class, SPARQL)
- **Batch Processing**: Test validation of multiple graphs
- **Performance Targets**: Ensure ≤20ms for standard graphs, ≤100ms for large graphs
- **Error Handling**: Test graceful handling of malformed data and timeouts
- **Caching**: Verify caching improves performance for repeated validations

**Technical Coverage**:
- All SHACL constraint components (minCount, maxCount, datatype, pattern, etc.)
- Node kind validation (IRI, Literal, BlankNode)
- Custom SPARQL constraints with temporal logic
- Memory limits and timeout handling
- Comprehensive JSON reporting with performance metrics

### 2. RDF Graph Compliance (`shacl/graph-validation.feature`)

**Purpose**: Validate overall RDF graph structure, syntax, and semantic compliance.

**Key Scenarios**:
- **Syntax Validation**: Well-formed RDF in multiple formats (Turtle, N-Triples, JSON-LD)
- **URI Compliance**: Validate URI syntax and accessibility patterns
- **Namespace Validation**: Proper prefix declarations and usage
- **Datatype Validation**: Correct literal datatype usage and format
- **Graph Structure**: Blank node consistency, circular reference detection
- **Large Graph Handling**: Performance and memory management for large graphs
- **Vocabulary Usage**: Standard vocabulary compliance (Schema.org, FOAF, etc.)
- **Semantic Consistency**: Detect logical contradictions and temporal inconsistencies
- **Federation Support**: Cross-graph reference validation
- **Quality Metrics**: Generate comprehensive quality scores and assessments

**Technical Coverage**:
- Multi-format RDF parsing and validation
- Graph size limits (50,000 triples maximum)
- Streaming validation for very large graphs
- Provenance and metadata validation using PROV-O
- Security and privacy compliance checking

### 3. Validation Reporting (`validation/validation-reporting.feature`)

**Purpose**: Comprehensive error reporting with actionable remediation suggestions.

**Key Scenarios**:
- **Basic Reports**: JSON structure with violations, summaries, and timestamps
- **Detailed Violations**: Complete violation information with focus nodes and paths
- **Aggregated Summaries**: Statistics grouped by severity, shape, and constraint type
- **Multi-Format Output**: JSON, table, CSV, HTML, JUnit XML, SARIF formats
- **Remediation Suggestions**: Actionable fix recommendations with examples
- **Performance Impact**: Report generation within ≤5ms target
- **Trend Analysis**: Track validation quality over time
- **Contextual Information**: Provide surrounding context for violations
- **Batch Reporting**: Aggregate results across multiple validation runs
- **Compliance Reporting**: Generate governance and audit reports

**Technical Coverage**:
- Progressive disclosure of violation details (summary → detailed → debug)
- Customizable reporting templates and branding
- Accessibility features (screen reader support, color-blind friendly)
- Export integration for external tools and CI/CD systems
- Real-time feedback during development

### 4. CLI Integration (`validation/shacl-cli-validation.feature`)

**Purpose**: Command-line interface for SHACL validation with CI/CD integration.

**Key Scenarios**:
- **Basic CLI Commands**: File and directory validation with proper exit codes
- **Batch Processing**: Recursive directory validation with filtering options
- **Output Formats**: Multiple output formats optimized for different use cases
- **Configuration Support**: External configuration files and parameter inheritance
- **CI/CD Integration**: Machine-readable output with standard exit codes
- **Watch Mode**: Continuous validation during development
- **Performance Monitoring**: Built-in performance benchmarking and monitoring
- **Cache Management**: Cache control and status reporting
- **Template Validation**: Specialized validation for Nunjucks templates
- **Artifact Validation**: Generated artifact and attestation verification

**Technical Coverage**:
- Standard exit codes (0=success, 1=errors, 2=critical, 3=violations)
- Parallel processing with configurable worker count
- Help system with comprehensive documentation and examples
- Integration with KGEN configuration system
- Policy compliance checking and governance reporting

### 5. Performance Validation (`validation/validation-performance.feature`)

**Purpose**: Ensure validation meets strict performance targets and scales efficiently.

**Key Scenarios**:
- **Performance Targets**: ≤20ms standard, ≤100ms large graphs, ≤5ms reporting
- **Memory Efficiency**: Controlled memory usage across different graph sizes
- **Concurrent Processing**: Maintain performance under concurrent requests
- **Caching Effectiveness**: Measure cache hit rates and performance improvements
- **Streaming Validation**: Constant memory usage for very large graphs
- **Optimization Features**: Incremental validation, constraint optimization
- **Load Testing**: Sustained performance under high load
- **Resource Scaling**: Performance scaling with additional resources
- **Bottleneck Analysis**: Identify and resolve performance bottlenecks
- **Regression Detection**: Automatic detection of performance degradation

**Technical Coverage**:
- Performance profiling with detailed metrics collection
- Memory pressure handling and graceful degradation
- Cold start optimization and network operation optimization
- Benchmark comparison against established baselines
- Comprehensive load testing scenarios

## Testing Strategy

### Unit Test Integration
The Gherkin features are designed to integrate with existing test infrastructure:

```javascript
// Example step definition for SHACL validation
Given('I have SHACL shapes in Turtle format:', async function(shapesData) {
  this.shapesEngine = new SHACLValidationEngine();
  await this.shapesEngine.initialize(shapesData);
});

When('I validate the RDF data against the shapes', async function() {
  this.validationResult = await this.shapesEngine.validate(this.rdfData);
});

Then('validation should succeed', function() {
  expect(this.validationResult.conforms).to.be.true;
});
```

### Performance Test Integration
Performance scenarios include specific timing assertions:

```javascript
Then('validation should complete within {string}', function(timeLimit) {
  const targetMs = parseInt(timeLimit.replace('ms', ''));
  expect(this.validationResult.performance.validationTime).to.be.lessThan(targetMs);
});
```

### CLI Test Integration
CLI scenarios test actual command execution:

```bash
# Test CLI command execution with expected outputs
When('I run the command: "kgen validate artifacts test.ttl --shapes-file shapes.ttl"')
Then('the command should succeed with exit code 0')
And('the output should be valid JSON')
```

## Implementation Coverage

### SHACL Constraint Support ✅
- **Cardinality**: minCount, maxCount
- **Value Type**: datatype, nodeKind, class
- **Value Range**: minInclusive, maxInclusive, minExclusive, maxExclusive
- **String**: minLength, maxLength, pattern, languageIn
- **Property Pair**: equals, disjoint, lessThan, lessThanOrEquals
- **Logical**: and, or, not, xone
- **Shape-based**: node, property, qualifiedValueShape
- **Other**: closed, hasValue, in, SPARQL constraints

### Performance Targets ✅
- Standard graph validation: ≤20ms
- Large graph validation (10k+ triples): ≤100ms
- Violation reporting: ≤5ms
- SHACL shapes initialization: ≤50ms
- Memory limits: Configurable with efficient management

### Error Handling ✅
- Graceful timeout handling
- Memory limit enforcement
- Malformed data recovery
- Comprehensive error reporting
- Fallback modes for system resilience

### CLI Integration ✅
- Complete command-line interface
- Multiple output formats (JSON, table, CSV, JUnit XML)
- CI/CD integration with proper exit codes
- Configuration file support
- Batch and watch modes

## Usage Examples

### Basic Validation
```bash
# Validate RDF file against SHACL shapes
kgen validate artifacts data.ttl --shapes-file shapes.ttl

# Validate directory recursively
kgen validate artifacts data/ --recursive --shapes-file shapes/

# Generate detailed report in multiple formats
kgen validate artifacts data.ttl --shapes-file shapes.ttl --format json --verbose
```

### Performance Testing
```bash
# Run with performance monitoring
kgen validate artifacts data/ --monitor-performance --benchmark

# Test with specific performance targets
kgen validate artifacts large-graph.ttl --shapes-file shapes.ttl --timeout 100
```

### CI/CD Integration
```bash
# CI-optimized validation
kgen validate artifacts . --ci-mode --no-color --quiet --exit-on-violations

# Generate JUnit XML for CI reporting
kgen validate artifacts . --format junit --export test-results.xml
```

## Feature Test Execution

### Running Feature Tests
The Gherkin features can be executed using standard BDD testing frameworks:

```bash
# Run all SHACL validation features
npm run test:features -- --grep "SHACL"

# Run specific feature file
npm run test:features features/shacl/shacl-validation.feature

# Run performance tests only
npm run test:features -- --grep "@performance"

# Run CLI integration tests
npm run test:features features/validation/shacl-cli-validation.feature
```

### Test Data Requirements
Each feature file specifies test data requirements:
- Sample RDF graphs (compliant and non-compliant)
- SHACL shapes for different constraint types
- Performance test datasets of various sizes
- Configuration files for CLI testing

## Quality Assurance

### Coverage Metrics
The feature files provide comprehensive coverage of:
- **Functional**: All SHACL constraint types and validation scenarios
- **Non-functional**: Performance, reliability, scalability, usability
- **Integration**: CLI, CI/CD, external tool integration
- **Error Handling**: All error conditions and recovery scenarios

### Validation Scenarios
- **Positive Tests**: 45+ scenarios testing successful validation paths
- **Negative Tests**: 35+ scenarios testing error detection and handling  
- **Performance Tests**: 15+ scenarios testing performance targets
- **Integration Tests**: 30+ scenarios testing CLI and system integration

### Real-World Applicability
Features are designed based on real-world usage patterns:
- Typical knowledge graph sizes and complexity
- Common SHACL constraint patterns
- Standard CI/CD integration requirements
- Performance expectations for interactive development

## Conclusion

The SHACL validation features provide comprehensive coverage of KGEN's validation capabilities with a focus on:

1. **80/20 Principle**: Core validation scenarios that handle 80% of use cases
2. **Performance First**: All scenarios include performance targets and monitoring
3. **Real-World Focus**: Based on actual SHACL constraint usage patterns
4. **CI/CD Ready**: Designed for automated testing and deployment pipelines
5. **Developer Experience**: Features support both interactive development and batch processing

These features serve as both specifications for the SHACL validation system and executable tests to ensure implementation quality and performance targets are met.