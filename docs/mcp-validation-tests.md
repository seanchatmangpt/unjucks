# MCP Validation Tests

This document describes the comprehensive MCP (Model Context Protocol) validation test suite that validates actual MCP tool connections and functionality.

## Overview

The MCP validation tests are designed to verify that the following integrations work correctly:

1. **Claude-Flow swarm operations** (working)
2. **RUV-Swarm WASM capabilities** (working)  
3. **Flow-Nexus authentication flow** (partially working)
4. **Semantic RDF processing** with N3.js through MCP
5. **CLI commands** that trigger real MCP tools

## Test Structure

### Files

- `/tests/integration/live-mcp-validation.test.ts` - Main test suite (Vitest)
- `/tests/features/live-mcp-validation.feature` - BDD feature file (Gherkin)
- `/tests/features/live-mcp-validation.feature.spec.ts` - BDD step definitions (vitest-cucumber)
- `/scripts/run-mcp-validation.js` - Test runner script

### Test Categories

#### 🌐 Claude-Flow Swarm Operations

Tests for swarm initialization, agent spawning, task orchestration, and health monitoring.

**Key Tests:**
- Initialize swarm with different topologies (mesh, hierarchical, ring, star)
- Spawn specialized agents (researcher, coder, tester, reviewer)
- Orchestrate complex tasks across swarm agents
- Monitor swarm health and recovery mechanisms

**Expected Behavior:**
- Swarm initialization should complete within 5 seconds
- Agents should spawn with unique IDs and proper types
- Task orchestration should assign tasks to appropriate agents
- Health monitoring should report swarm status accurately

#### ⚡ RUV-Swarm WASM Capabilities

Tests for WebAssembly runtime, SIMD acceleration, and neural network operations.

**Key Tests:**
- Initialize WASM runtime with SIMD support detection
- Run performance benchmarks with WASM acceleration
- Train neural networks using WASM-optimized operations
- Monitor memory usage and efficiency metrics

**Expected Behavior:**
- WASM runtime should initialize quickly (< 3 seconds)
- SIMD support should be detected on compatible platforms
- Neural network training should achieve > 70% accuracy
- Memory efficiency should be > 70%

#### 🔐 Flow-Nexus Authentication & Services

Tests for authentication status, sandbox management, and neural network templates.

**Key Tests:**
- Check authentication status and user information
- Create and manage code execution sandboxes
- Execute code in isolated sandbox environments
- List and manage neural network templates

**Expected Behavior:**
- Authentication status should return valid responses
- Sandboxes should be created and managed successfully
- Code execution should work with proper isolation
- Neural templates should be available for deployment

**Note:** Flow-Nexus is marked as "partially working" so some failures are expected.

#### 🧠 Semantic RDF Processing with N3.js

Tests for RDF/Turtle data parsing, SPARQL-like queries, and semantic reasoning.

**Key Tests:**
- Parse RDF/Turtle data into triples
- Perform SPARQL-like queries on RDF data
- Execute semantic reasoning operations
- Validate data against ontology definitions

**Expected Behavior:**
- RDF data should parse into valid triples
- Queries should return correct results
- Reasoning should infer new knowledge
- Validation should detect ontology violations

#### ⚙️ CLI Command Integration

Tests for CLI commands that trigger MCP tools for template operations.

**Key Tests:**
- List available generators through MCP
- Generate files using templates via MCP
- Execute dry-run operations for preview
- Handle error cases gracefully

**Expected Behavior:**
- CLI commands should execute through MCP integration
- File generation should produce correct output
- Dry-run should show accurate previews
- Errors should be handled with clear messages

#### 📊 Performance & Monitoring

Tests for performance metrics, memory usage, and concurrent operations.

**Key Tests:**
- Measure response times across MCP calls
- Monitor memory usage during operations
- Handle concurrent MCP requests efficiently
- Track performance degradation over time

**Expected Behavior:**
- Average response times should be < 1 second
- Memory growth should be < 100MB during tests
- Concurrent calls should achieve > 80% success rate
- Performance should remain stable over time

## Running Tests

### Quick Start

```bash
# Run all MCP validation tests
npm run test:mcp-validation

# Run only unit-style tests
npm run test:mcp-validation:unit

# Run only BDD/Cucumber tests
npm run test:mcp-validation:cucumber

# Run with detailed output
npm run test:mcp-validation:verbose

# Preview what would run without executing
npm run test:mcp-validation:dry
```

### Advanced Usage

```bash
# Run specific test file directly
npm run test:mcp-live

# Run with custom timeout (5 minutes)
vitest run tests/integration/live-mcp-validation.test.ts --testTimeout=300000

# Run BDD tests only
vitest run --config vitest.cucumber.config.ts tests/features/live-mcp-validation.feature.spec.ts
```

### Test Runner Options

```bash
node scripts/run-mcp-validation.js [options]

Options:
  --verbose, -v           Show detailed output
  --dry-run              Show what would be executed without running
  --unit-only            Run only unit-style tests
  --cucumber-only        Run only BDD/Cucumber tests
  --quick                Run with reduced timeouts for quick validation
  --help, -h             Show help
```

## Test Configuration

### Environment Variables

- `NODE_ENV` - Set to 'test' for test runs
- `MCP_SERVER_TIMEOUT` - Timeout for MCP server calls (default: 10000ms)
- `TEST_VERBOSE` - Enable verbose logging
- `TEST_QUICK` - Enable quick mode with reduced timeouts

### MCP Server Requirements

The tests can run in different modes depending on MCP server availability:

1. **Live Mode** - When MCP servers are available and running
2. **Mock Mode** - When MCP servers are unavailable (uses simulated responses)
3. **Hybrid Mode** - Mix of live and mock responses

### Expected Failures

Some test failures are expected, especially for:

- Flow-Nexus services (marked as "partially working")
- Network-dependent operations during CI/CD
- Platform-specific features (SIMD, WASM)

The tests are designed to be resilient and provide meaningful results even when some services are unavailable.

## Test Data

### RDF/Turtle Test Data

The tests use sample RDF data for semantic processing:

```turtle
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person rdf:type rdfs:Class .
ex:name rdf:type rdf:Property .
ex:age rdf:type rdf:Property .

ex:john rdf:type ex:Person ;
        ex:name "John Doe" ;
        ex:age 30 .

ex:jane rdf:type ex:Person ;
        ex:name "Jane Smith" ;
        ex:age 25 .
```

### Template Test Data

Sample Nunjucks templates for generation testing:

```nunjucks
---
to: "{{ dest | default('./output') }}/{{ name | pascalCase }}.tsx"
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return <div>{{ name }}</div>;
};
```

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase timeout with `--testTimeout=300000`
   - Use `--quick` mode for faster execution
   - Check network connectivity

2. **MCP Server Unavailable**
   - Tests will automatically fall back to mock mode
   - Check server installation: `npx claude-flow@alpha --version`
   - Verify network access to MCP services

3. **Memory Issues**
   - Reduce concurrent test execution
   - Increase Node.js memory: `--max-old-space-size=4096`
   - Monitor memory usage during tests

4. **Permission Errors**
   - Ensure write access to test directories
   - Check file permissions for generated content
   - Run with appropriate user privileges

### Debug Mode

Enable detailed logging:

```bash
DEBUG=unjucks:* npm run test:mcp-validation:verbose
```

View test execution plan:

```bash
npm run test:mcp-validation:dry
```

## Performance Benchmarks

### Expected Performance

- **Swarm Initialization**: < 5 seconds
- **Agent Spawning**: < 2 seconds per agent
- **RDF Parsing**: < 500ms for small datasets
- **Template Generation**: < 1 second per file
- **Memory Usage**: < 100MB growth during test suite

### Performance Monitoring

The test suite includes built-in performance monitoring:

- Response time tracking for all MCP calls
- Memory usage monitoring throughout test execution  
- Concurrent operation efficiency measurement
- Performance regression detection

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run MCP Validation Tests
  run: |
    npm run build
    npm run test:mcp-validation
  timeout-minutes: 10
```

### Local Development

```bash
# Quick validation during development
npm run test:mcp-validation -- --quick

# Full validation before commits
npm run test:mcp-validation:verbose
```

## Contributing

When adding new MCP integration tests:

1. Add test cases to both unit and BDD test files
2. Include performance expectations and monitoring
3. Handle both live and mock scenarios
4. Update documentation with new test categories
5. Ensure tests are resilient to service unavailability

## Related Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Claude-Flow Documentation](https://github.com/ruvnet/claude-flow)
- [RUV-Swarm WASM Guide](https://github.com/ruvnet/ruv-swarm)
- [N3.js RDF Library](https://github.com/rdfjs/N3.js)
- [Vitest Testing Framework](https://vitest.dev/)
- [Vitest-Cucumber BDD](https://github.com/amiceli/vitest-cucumber)