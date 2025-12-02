# KGEN End-to-End Test Suite

Comprehensive E2E testing framework for KGEN that validates complete workflows connecting all engines and components.

## Overview

This test suite implements comprehensive end-to-end validation for KGEN, testing:

- **Complete Project Lifecycles**: Init → Generate → Validate → Attest
- **Multi-Engine Integration**: RDF ↔ Template ↔ CAS ↔ Provenance ↔ Performance
- **CLI Integration**: Real subprocess execution with all backend systems  
- **Performance Benchmarking**: Against KPI targets (150ms p95 render time)
- **Error Recovery**: Fault tolerance and rollback scenarios
- **Multi-Format Output**: JSON, YAML, Turtle, XML, Markdown, CSV, TOML
- **Load Testing**: Memory stability, throughput, concurrency

## Test Structure

```
kgen/features/
├── step_definitions/           # Step definition implementations
│   ├── e2e_workflow_steps.ts  # Main workflow orchestration
│   ├── cli_integration_steps.ts # CLI subprocess testing  
│   ├── performance_benchmark_steps.ts # Performance & load testing
│   ├── integration_validation_steps.ts # Engine integration
│   └── test_runner_config.ts  # Global test configuration
├── fixtures/                  # Test data and templates
│   ├── templates/             # Sample project templates
│   │   ├── webapp/           # Web application templates
│   │   └── api/              # API service templates
│   └── data/                 # Test data sets
├── e2e_workflow.feature       # Core E2E workflow tests
├── cli_integration.feature    # CLI integration scenarios
└── comprehensive_e2e_validation.feature # Full system validation
```

## Key Features

### 🔄 Workflow Orchestration
- **Complete Lifecycles**: Tests full project generation from template to attestation
- **Multi-Project**: Orchestrates multiple concurrent project generations
- **Phase Rollback**: Supports rollback to specific lifecycle phases
- **Deterministic**: All operations produce consistent, reproducible results

### 🚀 Performance Testing  
- **Benchmark Suite**: 500+ iteration rendering benchmarks
- **Concurrency**: Multi-worker concurrent execution (up to 20 workers)
- **Load Testing**: Sustained throughput testing (60-180 seconds)
- **Memory Stress**: Large dataset processing (up to 1GB)
- **KPI Validation**: Enforces p95 render time < 150ms

### 🔧 Engine Integration
- **Data Flow Tracking**: Monitors data flow between all engines
- **Health Checks**: Validates engine responsiveness and health
- **Interaction Matrix**: Maps and validates inter-engine communication
- **Seamless Integration**: Ensures zero data loss across engine boundaries

### 💻 CLI Integration
- **Real Processes**: Spawns actual KGEN CLI subprocesses
- **Command Workflows**: Multi-step CLI command sequences  
- **Output Validation**: Validates stdout/stderr content and exit codes
- **Timeout Handling**: Graceful timeout and process management
- **Error Recovery**: Tests CLI error handling and graceful failure

### 🛡️ Error Recovery
- **Fault Injection**: Filesystem, memory, template, network errors
- **Recovery Testing**: Validates automatic error recovery mechanisms
- **Rollback System**: Tests rollback to previous stable states
- **Resilience**: Multi-failure scenario testing

## Test Execution

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure KGEN CLI is built
npm run build

# Set up test environment
export NODE_ENV=test
export TEST_LOG_LEVEL=info
export ENABLE_TEST_METRICS=true
```

### Running Tests

```bash
# Run all E2E tests
npx cucumber-js kgen/features/**/*.feature

# Run specific test categories
npx cucumber-js kgen/features/**/*.feature --tags "@workflow"
npx cucumber-js kgen/features/**/*.feature --tags "@performance" 
npx cucumber-js kgen/features/**/*.feature --tags "@cli"
npx cucumber-js kgen/features/**/*.feature --tags "@integration"

# Run with specific configuration
TEST_PARALLEL_WORKERS=4 npx cucumber-js kgen/features/**/*.feature --parallel 4

# Run comprehensive validation only
npx cucumber-js kgen/features/comprehensive_e2e_validation.feature

# Run with increased verbosity
TEST_LOG_LEVEL=debug npx cucumber-js kgen/features/**/*.feature --tags "@critical"
```

### Environment Variables

- `TEST_LOG_LEVEL`: `debug|info|warn|error` (default: `info`)
- `ENABLE_TEST_METRICS`: `true|false` (default: `false`)
- `TEST_PARALLEL_WORKERS`: Number of parallel workers (default: `2`)
- `TEST_RETRY_ATTEMPTS`: Retry attempts for flaky tests (default: `1`)
- `NODE_ENV`: Should be `test` for test runs

## Step Definitions

### E2E Workflow Steps (`e2e_workflow_steps.ts`)

**Key Steps:**
- `Given I have a complete KGEN environment initialized`
- `When I execute the complete project lifecycle for {string} named {string}`
- `When I generate outputs in formats {string}`
- `When I inject a {string} error during {string}`
- `Then all workflow steps should complete successfully`
- `Then engine integration should be seamless`

**Features:**
- Multi-engine orchestration with real engine instances
- Complete project lifecycle management (init/generate/validate/attest)
- Multi-format output generation and validation
- Error injection and recovery testing
- Performance tracking with KPI validation

### CLI Integration Steps (`cli_integration_steps.ts`)

**Key Steps:**
- `Given I have the KGEN CLI available`
- `When I run the KGEN command {string}`
- `When I execute the KGEN workflow:`
- `Then the command should exit with code {int}`
- `Then files should be generated in the output directory`

**Features:**
- Real KGEN CLI subprocess execution
- Command workflow orchestration
- Output capture and validation (stdout/stderr)
- Process timeout and resource monitoring
- File system integration testing

### Performance Benchmark Steps (`performance_benchmark_steps.ts`)

**Key Steps:**
- `When I benchmark template rendering {int} times`
- `When I run concurrent rendering with {int} workers`
- `When I run throughput test for {int} seconds`
- `Then template rendering should meet p95 target of {int}ms`
- `Then throughput should exceed {int} operations per second`

**Features:**
- High-iteration benchmark execution (100-1000 iterations)
- Multi-worker concurrency testing (up to 20 workers)
- Sustained load testing (60-180 seconds)
- Memory stress testing (up to 1GB datasets)
- Statistical analysis (p50/p95/p99 percentiles)

### Integration Validation Steps (`integration_validation_steps.ts`)

**Key Steps:**
- `Given all KGEN engines are initialized and healthy`
- `When I test data flow between {string} and {string} engines`
- `When I validate end-to-end workflow integration`
- `Then data flow between engines should be seamless`
- `Then system-wide performance metrics should be within targets`

**Features:**
- Engine health monitoring and validation
- Inter-engine data flow tracking
- End-to-end integration validation
- System-wide performance metrics
- Interaction matrix analysis

## Test Scenarios

### Core Scenarios

1. **Complete Project Lifecycle** - Full init→generate→validate→attest workflow
2. **Multi-Format Output** - Generate JSON, YAML, Turtle, XML, Markdown
3. **Performance Benchmarking** - Validate against 150ms p95 KPI
4. **Error Recovery** - Fault injection and rollback testing
5. **CLI Integration** - Real subprocess execution and validation

### Comprehensive Scenarios

1. **Production-Scale Performance** - 500 iterations, 12 workers, 60s load test
2. **Multi-Project Orchestration** - 3 concurrent project lifecycles
3. **Advanced Error Recovery** - 4 simultaneous failure types
4. **High-Load Stress Testing** - 1000 iterations, 16 workers, 2-minute load test
5. **Ultimate Full-System** - Combined validation of all features

## Performance Targets

### KPI Requirements
- **Template Rendering**: p95 < 150ms
- **Cache Hit Rate**: > 80% (target: 90%+)
- **Memory Stability**: < 50% growth during load tests
- **Throughput**: > 50 ops/sec (target: 200+ ops/sec)
- **Success Rate**: > 95% for all operations
- **Concurrency Efficiency**: > 85%

### Scalability Targets
- **Templates**: Support 100+ templates simultaneously
- **Workers**: Scale to 20+ concurrent workers
- **Memory**: Handle 1GB+ datasets without memory leaks
- **Duration**: Complete workflows in < 5 minutes
- **Recovery**: < 1% permanent failures with error injection

## Monitoring and Reporting

### Test Reports
- **JSON Reports**: Detailed metrics and timings saved to `test-reports/`
- **Console Output**: Real-time progress and summary statistics
- **Performance Metrics**: P50/P95/P99 analysis for all operations
- **Memory Tracking**: Heap usage monitoring throughout tests
- **Error Analysis**: Detailed error categorization and recovery rates

### Metrics Collected
- Scenario duration and success rates
- Individual step performance
- Memory usage patterns
- Engine interaction statistics  
- CLI command execution times
- Data flow analysis between engines

## Troubleshooting

### Common Issues

**Memory Errors:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npx cucumber-js ...
```

**Timeout Issues:**
```bash
# Increase test timeout
TEST_TIMEOUT=300000 npx cucumber-js ...
```

**CLI Process Issues:**
```bash
# Ensure KGEN binary is executable
chmod +x bin/kgen.mjs

# Verify Node.js version
node --version  # Should be >= 18.0.0
```

**Template Errors:**
```bash
# Clear template cache
rm -rf test-workspace/
mkdir -p test-workspace
```

### Debug Mode

```bash
# Enable detailed logging
TEST_LOG_LEVEL=debug npx cucumber-js kgen/features/**/*.feature --tags "@debug"

# Run single scenario for debugging  
npx cucumber-js kgen/features/e2e_workflow.feature:15

# Enable Node.js debugging
node --inspect-brk $(npm bin)/cucumber-js kgen/features/**/*.feature
```

## Contributing

When adding new E2E tests:

1. **Follow Patterns**: Use existing step definition patterns
2. **Add Fixtures**: Include necessary test data in `fixtures/`
3. **Performance**: Consider performance impact of new tests
4. **Cleanup**: Ensure proper cleanup in `After` hooks
5. **Documentation**: Update this README with new scenarios

### Step Definition Guidelines

- Use descriptive step names that clearly indicate what is being tested
- Include proper error handling and cleanup
- Add performance tracking for significant operations
- Validate both success and failure scenarios
- Use realistic test data that mirrors production usage

### Feature File Guidelines

- Use appropriate tags (`@workflow`, `@performance`, `@cli`, etc.)
- Include Background steps for common setup
- Use Scenario Outlines for parameterized tests
- Add `@critical` tag for essential validation scenarios
- Include comprehensive Examples for edge cases

## Architecture

The E2E test suite is designed with several key architectural principles:

### Separation of Concerns
- **Step Definitions**: Pure logic for test operations
- **Feature Files**: Human-readable test scenarios  
- **Fixtures**: Reusable test data and templates
- **Configuration**: Centralized test settings

### Real Engine Integration
- **No Mocking**: Tests use actual KGEN engine instances
- **True E2E**: Data flows through complete system stack
- **Production Parity**: Test environment mirrors production setup

### Performance-First Design
- **Parallel Execution**: Multi-worker concurrent testing
- **Resource Monitoring**: Memory and CPU tracking
- **KPI Enforcement**: Hard performance targets with test failures

### Fault Tolerance
- **Error Injection**: Systematic failure simulation
- **Recovery Validation**: Automatic error recovery testing
- **Rollback Testing**: State restoration validation

This comprehensive E2E test suite ensures KGEN operates reliably at production scale with full integration validation across all engines and components.