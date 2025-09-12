# KGEN Performance Testing Suite

This directory contains comprehensive performance testing tools for the KGEN system. Unlike typical performance tests that rely on estimates or assumptions, these tools measure **actual performance characteristics** with real data.

## Quick Start

```bash
# Run all performance tests
./tests/performance/run-all-tests.sh

# Run individual tests
node tests/performance/performance-benchmark.mjs --iterations=5
node tests/performance/memory-profiler.mjs
```

## Test Suite Components

### 1. `performance-benchmark.mjs`
**Comprehensive performance benchmarking suite**

Features:
- Command execution time measurement (with warmup)
- File size scaling analysis (10 triples to 100K triples)
- Concurrent operation performance testing
- Cache effectiveness validation
- Large graph processing benchmarks
- Memory usage tracking

Usage:
```bash
node performance-benchmark.mjs [--iterations=N] [--verbose]
```

### 2. `memory-profiler.mjs`
**Detailed memory usage analysis**

Features:
- Real-time memory monitoring (RSS, heap, GC)
- Memory growth pattern detection
- Memory leak identification
- Garbage collection analysis
- Peak memory usage tracking

Usage:
```bash
node memory-profiler.mjs
```

### 3. `run-all-tests.sh`
**Complete test suite runner**

Executes all performance tests and generates summary reports.

## Generated Reports

### Performance Reports
- `performance-report-latest.json` - Latest benchmark results (JSON)
- `performance-analysis-report.md` - Detailed analysis (Markdown)
- `final-performance-report.md` - Executive summary (Markdown)

### Memory Reports  
- `memory-profile-latest.json` - Latest memory profiling results

## Test Data

The suite automatically generates test RDF files of various sizes:
- `test-tiny.ttl` - 10 triples (~1KB)
- `test-small.ttl` - 100 triples (~5KB)  
- `test-medium.ttl` - 1,000 triples (~50KB)
- `test-large.ttl` - 10,000 triples (~600KB)
- `test-huge.ttl` - 100,000 triples (~6MB)

## Key Performance Findings

### Current Performance Characteristics (Measured)

✅ **Strengths:**
- Excellent memory efficiency (constant ~3MB usage)
- Sub-linear file size scaling
- Good concurrent performance (5x throughput at 8 threads)
- No memory leaks or crashes

❌ **Critical Issues:**
- **545ms cold start penalty** (target: <50ms) - 11x slower than expected
- Hash operation performance cliff at 100K+ triples (2.6x slowdown)
- Cache system actively hurts performance (-2% impact)
- Fixed ~525ms overhead regardless of operation complexity

### Performance vs Expectations

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Version command | <50ms | 545ms | ❌ 11x slower |
| File scaling | Linear | Sub-linear | ✅ Better |
| Cache speedup | >1.1x | 0.98x | ❌ Opposite |
| Memory usage | Variable | Constant | ✅ Better |

## Understanding the Results

### Why These Numbers Matter

1. **Real Command Testing:** Tests actual CLI commands, not internal APIs
2. **Process Isolation:** Each test runs in fresh process to measure true performance
3. **Multiple Iterations:** Results averaged across multiple runs with warmup
4. **System Monitoring:** OS-level memory and CPU tracking
5. **No Mocking:** Tests against real RDF data and file I/O

### Interpreting Benchmark Data

- **Mean Time:** Average execution time across iterations
- **P95 Time:** 95th percentile (worst 5% excluded)
- **Memory Delta:** Memory growth during operation
- **Throughput:** Operations per second for concurrent tests
- **Scaling Factor:** Performance change relative to baseline

## Troubleshooting

### Common Issues

**Tests failing with "Unknown command" errors:**
- Ensure you're using the correct command syntax for KGEN CLI
- Check `node bin/kgen.mjs --help` for available commands

**Memory profiling not working:**
- Requires Node.js with `--expose-gc` support
- Some macOS versions may restrict process monitoring

**Inconsistent timing results:**
- Run tests when system is not under load
- Increase iteration count for more stable averages
- Check for background processes affecting performance

### Customizing Tests

Edit the benchmark files to:
- Add new test operations
- Modify test data sizes  
- Change iteration counts
- Add custom performance metrics

## Contributing

When adding new performance tests:

1. Follow the existing pattern of real measurement vs assumptions
2. Include proper warmup iterations  
3. Test with multiple data sizes
4. Document expected vs actual performance
5. Add analysis of results, not just raw data

## Performance Optimization Workflow

1. **Baseline:** Run current performance suite
2. **Optimize:** Make performance improvements
3. **Measure:** Re-run performance suite
4. **Compare:** Validate improvements with data
5. **Document:** Update performance characteristics

Remember: **Only claims backed by measurement data are valid.**