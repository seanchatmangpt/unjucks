# Performance Testing Suite

This directory contains comprehensive performance tests and validation infrastructure for the Unjucks CLI tool. The performance testing suite is designed to ensure the CLI maintains fast startup times, efficient template processing, and optimal resource usage.

## Overview

The performance testing suite includes:

### 🚀 Performance Test Files

1. **`cli-startup.performance.test.ts`**
   - Tests CLI startup times (cold start, help, list commands)
   - Validates performance consistency across multiple runs
   - Baseline: CLI startup should be under 200ms

2. **`template-generation.performance.test.ts`**
   - Tests template processing and file generation speed
   - Tests scalability with multiple concurrent operations
   - Validates memory usage during generation
   - Baselines: Simple generation <50ms, Complex generation <100ms

3. **`load-testing.performance.test.ts`**
   - High concurrency testing (10+ parallel operations)
   - Large iteration template processing (1000+ items)
   - Sustained load testing (30+ seconds)
   - Error recovery performance impact
   - Baseline: Concurrent operations <2000ms

4. **`edge-cases.performance.test.ts`**
   - Deep directory structure handling
   - Large file generation (>1MB outputs)
   - Unicode and special character processing
   - Complex conditional template performance
   - File system edge case handling

5. **`ci-validation.performance.test.ts`**
   - CI/CD pipeline performance validation
   - Regression detection with defined thresholds
   - Performance report generation
   - Memory usage validation (<100MB limit)

6. **`regression-tracking.performance.test.ts`**
   - Baseline establishment and comparison
   - Performance regression detection (>10% degradation)
   - Historical performance tracking
   - Automated regression reporting

### 📊 Configuration & Infrastructure

- **`vitest.performance.config.ts`** - Dedicated vitest config for performance tests
- **`setup-performance.ts`** - Global setup/teardown for performance testing
- **Performance thresholds** defined for each test category
- **Automated report generation** in JSON and Markdown formats

### 🔧 Scripts & Utilities

- **`performance-benchmark.ts`** - Comprehensive benchmark runner
- **`ci-performance-check.ts`** - CI/CD integration script
- **Baselines tracking** with environment-specific adjustments

## Usage

### Running Individual Performance Tests

```bash
# CLI startup performance
npm run test:perf:startup

# Template generation performance
npm run test:perf:generation

# Load testing
npm run test:perf:load

# Edge cases
npm run test:perf:edge

# CI validation
npm run test:perf:validation

# Regression tracking
npm run test:perf:regression
```

### Running All Performance Tests

```bash
# All performance tests
npm run test:performance

# Performance tests with CI output
npm run test:perf:ci

# Comprehensive benchmark suite
npm run benchmark

# CI performance check (with thresholds)
npm run benchmark:ci
```

## Performance Thresholds

The following performance thresholds are enforced:

| Metric | Threshold | Unit | Description |
|--------|-----------|------|-------------|
| CLI Startup | 200 | ms | Cold start time |
| Help Command | 150 | ms | Help display time |
| List Command | 100 | ms | Template listing time |
| Simple Generation | 50 | ms | Basic template processing |
| Complex Generation | 100 | ms | Multi-file template processing |
| Memory Usage | 100 | MB | Peak memory consumption |
| Concurrent Operations | 2000 | ms | 10 parallel operations |
| Error Recovery | 1000 | ms | Error detection and handling |

## Test Categories

### ⚡ Startup Performance
- CLI initialization time
- Command parsing overhead
- Module loading efficiency
- Help system responsiveness

### 🏭 Generation Performance
- Template parsing speed
- Variable resolution efficiency
- File I/O optimization
- Nunjucks rendering performance

### 🔄 Load Testing
- Concurrent operation handling
- Memory management under load
- Error recovery mechanisms
- Sustained operation performance

### 🎯 Edge Cases
- Large file handling
- Deep directory structures
- Unicode character processing
- Complex conditional logic

### 📈 Regression Tracking
- Historical performance comparison
- Baseline establishment
- Automated regression detection
- Environment-specific adjustments

## Reports & Output

Performance tests generate several types of reports:

### JSON Reports
- `reports/performance-results.json` - Detailed test results
- `reports/performance-benchmark.json` - Comprehensive benchmarks
- `reports/ci-performance-check.json` - CI validation results
- `reports/performance-regression.json` - Regression analysis

### Markdown Reports
- `reports/performance-summary.md` - Human-readable summary
- GitHub Actions summary integration
- Historical trend analysis

### HTML Reports
- Interactive vitest HTML reports
- Performance visualizations
- Test execution timeline

## CI/CD Integration

The performance testing suite integrates with CI/CD pipelines:

### GitHub Actions
- Automated performance validation on PR
- Performance regression detection
- Threshold enforcement
- Report generation and archiving

### Environment Variables
- `CI=true` - Enables CI-specific reporting
- `GITHUB_ACTIONS=true` - Enables GitHub Actions integration
- `DEBUG_UNJUCKS=true` - Enables performance debugging

### Failure Modes
- Performance regression detection (>10% degradation)
- Absolute threshold violations
- Memory usage limits exceeded
- Test execution timeouts

## Development Workflow

### Adding New Performance Tests
1. Create test file in `tests/performance/`
2. Use `.performance.test.ts` suffix
3. Follow existing patterns for measurement
4. Add appropriate thresholds
5. Update documentation

### Establishing Baselines
1. Run tests multiple times on stable code
2. Collect statistical measurements
3. Set thresholds at 80-90% of average performance
4. Account for environment variability

### Regression Analysis
1. Compare current results with baselines
2. Identify performance changes >10%
3. Investigate root cause of regressions
4. Update baselines after verified improvements

## Best Practices

### Test Design
- Use real operations, never mocks for timing
- Measure end-to-end performance
- Account for environment variability
- Use statistical sampling (multiple runs)

### Threshold Setting
- Set realistic but challenging thresholds
- Account for CI environment overhead
- Allow 10-20% tolerance for environment differences
- Review and adjust thresholds quarterly

### Error Handling
- Gracefully handle CLI execution failures
- Provide meaningful error messages
- Continue testing when possible
- Report infrastructure issues separately

### Reporting
- Generate both machine and human-readable reports
- Include environment context
- Track trends over time
- Integrate with CI/CD feedback

## Troubleshooting

### Common Issues

1. **CLI Build Failures**
   - Run `npm run build` before performance tests
   - Check for TypeScript compilation errors
   - Verify all dependencies are installed

2. **High Execution Times**
   - Tests use `tsx` which adds overhead
   - CI environments may be slower
   - Network latency can affect package loading

3. **Inconsistent Results**
   - Run multiple iterations for statistics
   - Account for system load
   - Use dedicated CI runners for consistency

4. **Memory Issues**
   - Force garbage collection between tests
   - Monitor for memory leaks
   - Use process isolation for large tests

### Performance Debugging

Enable debug output:
```bash
DEBUG_UNJUCKS=true npm run test:performance
```

Check system resources:
- CPU usage during tests
- Memory consumption patterns
- Disk I/O bottlenecks
- Network activity

## Future Enhancements

- [ ] Performance comparison with Hygen
- [ ] Template complexity analysis
- [ ] Cache effectiveness measurements
- [ ] Bundle size optimization tracking
- [ ] Real-world usage pattern simulation
- [ ] Performance monitoring dashboard
- [ ] Automated performance optimization suggestions