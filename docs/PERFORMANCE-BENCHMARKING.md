# Performance Benchmarking Guide

This document describes the comprehensive performance benchmarking suite implemented to validate all performance claims in HYGEN-DELTA.md.

## 🎯 Overview

The benchmarking suite validates 5 key performance claims:

1. **CLI Startup 25% faster** (150ms vs 200ms baseline)
2. **Template Processing 40% faster** (30ms vs 50ms baseline)
3. **File Operations 25% faster** (15ms vs 20ms baseline) 
4. **Memory Usage 20% less** (20MB vs 25MB baseline)
5. **Vitest-Cucumber 3x faster** execution

## 🏗️ Architecture

### Benchmark Structure

```
tests/benchmarks/
├── vitest.bench.config.ts          # Benchmark-specific Vitest config
├── cli-startup.bench.ts             # CLI cold/warm start benchmarks
├── template-processing.bench.ts     # Template parsing & rendering
├── file-operations.bench.ts         # File creation & injection
├── memory-usage.bench.ts            # Memory consumption & leak detection
├── vitest-cucumber.bench.ts         # BDD framework performance
└── memory-store.ts                  # Centralized results storage

scripts/
├── run-benchmarks.ts                # Automated benchmark runner
└── performance-validator.ts         # Claims validation & reporting
```

### Memory Store System

The `memory-store.ts` provides centralized storage for benchmark results:

- **Persistent Storage**: Results saved to `reports/benchmarks/`
- **Metrics Calculation**: Automatic aggregation and analysis
- **Claims Validation**: Direct comparison against HYGEN-DELTA.md claims
- **Recommendations**: Automatic optimization suggestions

## 🚀 Running Benchmarks

### Individual Benchmarks

```bash
# CLI startup performance
npm run test:benchmark:cli

# Template processing speed  
npm run test:benchmark:template

# File operation performance
npm run test:benchmark:files

# Memory usage analysis
npm run test:benchmark:memory

# BDD framework comparison
npm run test:benchmark:bdd

# All benchmarks
npm run test:benchmark
```

### Automated Suite

```bash
# Full benchmark suite with validation
npm run benchmark:report

# Just run benchmarks
npm run benchmark:all

# Just validate claims
npm run benchmark:validate
```

## 📊 Benchmark Categories

### 1. CLI Startup Benchmarks

**File**: `cli-startup.bench.ts`

Tests CLI initialization performance:
- Cold start (no warmup)
- Warm start (with warmup)
- Different command variants (--help, --version, list)
- Memory usage during startup

**Key Metrics**:
- Average startup time
- Memory consumption
- Command-specific performance

### 2. Template Processing Benchmarks

**File**: `template-processing.bench.ts`

Tests template engine performance:
- Simple template parsing
- Complex template rendering
- Variable scanning
- Full processing pipeline
- Batch operations (10+ templates)

**Key Metrics**:
- Parse time
- Render time  
- Memory efficiency
- Throughput (templates/second)

### 3. File Operations Benchmarks

**File**: `file-operations.bench.ts`

Tests file system operations:
- Atomic file creation
- Content injection (before/after/append/prepend)
- Line-specific injection
- Large file handling
- Backup creation
- Permission changes

**Key Metrics**:
- Operation latency
- Throughput
- Memory usage
- Error handling performance

### 4. Memory Usage Benchmarks  

**File**: `memory-usage.bench.ts`

Tests memory consumption and leak detection:
- Baseline memory measurement
- Single template processing
- Batch processing (10, 100 templates)
- Memory leak detection
- Generator lifecycle
- Stress testing

**Key Metrics**:
- Heap usage
- Memory growth patterns
- Garbage collection efficiency
- Peak memory consumption

### 5. Vitest-Cucumber Benchmarks

**File**: `vitest-cucumber.bench.ts`

Compares BDD vs unit testing performance:
- Vitest-Cucumber execution
- Standard Vitest execution
- Configuration loading
- Test discovery
- Report generation

**Key Metrics**:  
- Test execution speed
- Framework overhead
- Speed improvement ratio
- Memory efficiency

## 📈 Results & Validation

### Automated Validation

The `performance-validator.ts` script automatically:

1. **Loads benchmark results** from memory store
2. **Compares against claims** in HYGEN-DELTA.md
3. **Calculates deviations** and success rates
4. **Generates recommendations** for failed claims
5. **Creates detailed reports** in JSON and Markdown

### Report Generation

Reports are generated in `reports/`:

```
reports/
├── benchmark-summary.json           # Complete benchmark results
├── performance-validation-report.json # Claims validation
├── performance-validation-report.md   # Human-readable report
├── performance-memory-store.json      # Memory store data
└── benchmarks/                        # Individual result files
    ├── cli/
    ├── template/
    ├── file/
    ├── memory/
    └── test/
```

## 🎛️ Configuration

### Benchmark Configuration

Key settings in `vitest.bench.config.ts`:

```typescript
{
  benchmark: {
    include: ["**/*.bench.ts"],
    reporters: ["verbose", "json"],
    outputFile: {
      json: "reports/benchmark-results.json"
    }
  },
  pool: "threads",
  poolOptions: {
    threads: {
      maxThreads: 4, // Limited for consistent results
      isolate: true  // Ensure benchmark isolation
    }
  }
}
```

### Performance Thresholds

Claims validation thresholds:

```typescript
const PERFORMANCE_TARGETS = {
  cliStartup: 150,      // ms
  templateProcessing: 30, // ms  
  fileOperations: 15,   // ms
  memoryUsage: 20,      // MB
  speedImprovement: 3.0 // x ratio
};
```

## 🔧 Optimization Workflow

### 1. Run Benchmarks

```bash
npm run benchmark:all
```

### 2. Validate Claims

```bash  
npm run benchmark:validate
```

### 3. Analyze Results

Check generated reports for:
- Failed performance claims
- Optimization recommendations  
- Performance regressions
- Memory leaks

### 4. Implement Optimizations

Based on recommendations:
- CLI: Reduce module loading overhead
- Templates: Implement caching
- Files: Optimize I/O operations
- Memory: Implement pooling

### 5. Re-validate

```bash
npm run benchmark:report
```

## 🚨 Continuous Monitoring

### Integration Points

The benchmarking suite can be integrated with:

- **CI/CD Pipelines**: Automated performance regression detection
- **Pre-commit Hooks**: Performance validation before commits
- **Release Process**: Ensure performance claims before releases
- **Monitoring Dashboards**: Track performance trends over time

### Performance Regression Detection

Set up alerts for:
- Performance degradation > 10%
- Memory usage increases > 15%  
- Failed performance claims
- New performance bottlenecks

## 📝 Contributing

When adding new performance optimizations:

1. **Add relevant benchmarks** to validate improvements
2. **Update performance targets** if claims change
3. **Document optimization techniques** used
4. **Run full benchmark suite** before submitting PRs
5. **Include performance impact** in PR descriptions

## 🔍 Troubleshooting

### Common Issues

**Benchmarks timing out**:
```bash
# Increase timeout in benchmark config
testTimeout: 300_000 // 5 minutes
```

**Inconsistent results**:
```bash  
# Ensure system stability
# Close other applications
# Run multiple iterations
iterations: 10
```

**Memory benchmark failures**:
```bash
# Enable garbage collection
node --expose-gc ./scripts/run-benchmarks.js
```

### Debug Mode

Enable debug logging:
```bash
DEBUG_BENCHMARKS=true npm run benchmark:all
```

## 📚 References

- [Vitest Benchmark Documentation](https://vitest.dev/guide/features.html#benchmarking)
- [Node.js Performance Hooks](https://nodejs.org/api/perf_hooks.html)
- [Memory Profiling Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [HYGEN-DELTA.md Performance Claims](./HYGEN-DELTA.md#performance-comparison)

---

*This benchmarking suite provides comprehensive validation of all performance claims, ensuring Unjucks delivers on its promise of superior performance compared to Hygen.*