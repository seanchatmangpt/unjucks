# Real Performance Benchmark Results

## single-component

### Metrics Comparison

| Metric | Unjucks | Hygen | Improvement |
|--------|---------|-------|-------------|
| Cold Start | 749.22ms | 613.45ms | -22.1% |
| Template Processing | 0.00ms | 0.00ms | 0.0% |
| File Operations | 0.00ms | 0.00ms | 0.0% |
| Memory Usage | -0.16MB | 0.22MB | 172.8% |
| Total Time | 750.33ms | 614.13ms | -22.2% |

**Targets Met**: ❌

⚠️ **Unjucks Error**: spawn /bin/sh ENOENT

⚠️ **Hygen Error**: spawn /bin/sh ENOENT

## batch-5-components

### Metrics Comparison

| Metric | Unjucks | Hygen | Improvement |
|--------|---------|-------|-------------|
| Cold Start | 976.89ms | 0.00ms | 0.0% |
| Template Processing | -967.78ms | 0.00ms | 0.0% |
| File Operations | -967.78ms | 0.00ms | 0.0% |
| Memory Usage | -0.25MB | 0.14MB | 275.7% |
| Total Time | 986.06ms | 1151.77ms | 14.4% |

**Targets Met**: ❌

⚠️ **Hygen Error**: spawn /bin/sh ENOENT

## large-file-injection

### Metrics Comparison

| Metric | Unjucks | Hygen | Improvement |
|--------|---------|-------|-------------|
| Cold Start | 747.82ms | 0.00ms | 0.0% |
| Template Processing | -746.10ms | 0.00ms | 0.0% |
| File Operations | -746.10ms | 0.00ms | 0.0% |
| Memory Usage | 0.29MB | -0.28MB | 201.9% |
| Total Time | 749.80ms | 711.48ms | -5.4% |

**Targets Met**: ❌

⚠️ **Hygen Error**: spawn /bin/sh ENOENT

## Summary

**Scenarios meeting all targets**: 0/3

### Target Goals:
- ✅ 25% faster cold start
- ✅ 40% faster template processing
- ✅ 25% faster file operations
- ✅ 20% less memory usage

⚠️ **Some performance targets not met. Further optimization needed.**
