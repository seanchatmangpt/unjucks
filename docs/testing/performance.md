# Performance Testing Guide

## Overview

Performance testing ensures Unjucks CLI maintains acceptable response times, memory usage, and throughput under various load conditions. This guide covers benchmarking strategies, performance profiling, and optimization techniques.

## Performance Testing Strategy

### Test Categories

#### 1. Response Time Testing
- Template discovery and listing
- Single template generation
- Batch template generation  
- File injection operations
- Configuration loading

#### 2. Throughput Testing
- Concurrent template generation
- Multiple file operations
- Large template processing
- Bulk injection scenarios

#### 3. Resource Usage Testing
- Memory consumption patterns
- CPU utilization
- File system I/O impact
- Garbage collection behavior

#### 4. Scalability Testing
- Performance with increasing template count
- Large project generation
- Deep directory structures
- Complex template hierarchies

## Benchmarking Implementation

### Basic Performance Tests

```typescript
// tests/performance/template-rendering.test.ts
import { describe, it, expect } from 'vitest'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'
import { join } from 'path'

describe('Template Rendering Performance', () => {
  const PERFORMANCE_THRESHOLDS = {
    templateList: 500,      // 500ms max
    singleGeneration: 2000, // 2s max
    largeGeneration: 10000, // 10s max
    injection: 1000         // 1s max
  }

  it('should list templates quickly', async () => {
    const start = performance.now()
    
    execSync('npx unjucks list', { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.templateList)
    console.log(`Template listing: ${duration.toFixed(2)}ms`)
  })

  it('should generate simple template efficiently', async () => {
    const start = performance.now()
    
    execSync('npx unjucks generate command citty --commandName PerfTest --dest ./temp --dry', {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.singleGeneration)
    console.log(`Single generation: ${duration.toFixed(2)}ms`)
  })

  it('should handle large template generation within limits', async () => {
    const start = performance.now()
    
    // Generate a complex project template
    execSync('npx unjucks generate fullstack nextjs --projectName LargeProject --withAuth --withDatabase --dest ./temp --dry', {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.largeGeneration)
    console.log(`Large generation: ${duration.toFixed(2)}ms`)
  })
})
```

### Memory Usage Testing

```typescript
// tests/performance/memory-usage.test.ts
describe('Memory Usage Testing', () => {
  const MEMORY_THRESHOLDS = {
    baseUsage: 50 * 1024 * 1024,    // 50MB base
    singleGen: 100 * 1024 * 1024,   // 100MB for single generation
    batchGen: 200 * 1024 * 1024,    // 200MB for batch generation
    leakTolerance: 10 * 1024 * 1024 // 10MB leak tolerance
  }

  function getMemoryUsage(): NodeJS.MemoryUsage {
    global.gc?.() // Force garbage collection if available
    return process.memoryUsage()
  }

  it('should maintain reasonable baseline memory usage', () => {
    const memUsage = getMemoryUsage()
    
    expect(memUsage.heapUsed).toBeLessThan(MEMORY_THRESHOLDS.baseUsage)
    expect(memUsage.rss).toBeLessThan(MEMORY_THRESHOLDS.baseUsage * 2)
    
    console.log(`Baseline memory - Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`)
  })

  it('should not leak memory during single generation', () => {
    const initialMemory = getMemoryUsage()
    
    // Perform template generation
    execSync('npx unjucks generate command citty --commandName MemTest --dest ./temp --dry', {
      stdio: 'pipe'
    })
    
    const finalMemory = getMemoryUsage()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    
    expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.singleGen)
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
  })

  it('should handle batch operations without excessive memory growth', () => {
    const initialMemory = getMemoryUsage()
    
    // Generate multiple templates
    for (let i = 0; i < 10; i++) {
      execSync(`npx unjucks generate command citty --commandName BatchTest${i} --dest ./temp --dry`, {
        stdio: 'pipe'
      })
    }
    
    const finalMemory = getMemoryUsage()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    
    expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.batchGen)
    console.log(`Batch memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
  })

  it('should release memory after large operations', async () => {
    const beforeMemory = getMemoryUsage()
    
    // Large operation
    execSync('npx unjucks generate fullstack nextjs --projectName MemoryTest --dest ./temp --dry', {
      stdio: 'pipe'
    })
    
    const afterMemory = getMemoryUsage()
    
    // Wait and force GC
    await new Promise(resolve => setTimeout(resolve, 1000))
    const finalMemory = getMemoryUsage()
    
    const memoryRecovered = afterMemory.heapUsed - finalMemory.heapUsed
    
    console.log(`Memory recovered: ${(memoryRecovered / 1024 / 1024).toFixed(2)}MB`)
    expect(memoryRecovered).toBeGreaterThan(0) // Should recover some memory
  })
})
```

### Concurrent Operations Testing

```typescript
// tests/performance/concurrency.test.ts
describe('Concurrent Operations Performance', () => {
  it('should handle concurrent template listings', async () => {
    const concurrentOperations = 10
    const start = performance.now()
    
    const promises = Array(concurrentOperations).fill(null).map(() =>
      new Promise<void>((resolve, reject) => {
        try {
          execSync('npx unjucks list', { stdio: 'pipe' })
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    )
    
    await Promise.all(promises)
    
    const duration = performance.now() - start
    const avgDuration = duration / concurrentOperations
    
    expect(avgDuration).toBeLessThan(1000) // Should not degrade significantly
    console.log(`Concurrent listings - Total: ${duration.toFixed(2)}ms, Avg: ${avgDuration.toFixed(2)}ms`)
  })

  it('should handle concurrent generations without conflicts', async () => {
    const concurrentGenerations = 5
    const start = performance.now()
    
    const promises = Array(concurrentGenerations).fill(null).map((_, i) =>
      new Promise<void>((resolve, reject) => {
        try {
          execSync(`npx unjucks generate command citty --commandName Concurrent${i} --dest ./temp/concurrent${i} --dry`, {
            stdio: 'pipe'
          })
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    )
    
    await Promise.all(promises)
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(15000) // Should complete within 15 seconds
    console.log(`Concurrent generations: ${duration.toFixed(2)}ms`)
  })
})
```

## Advanced Performance Testing

### CPU Profiling

```typescript
// tests/performance/cpu-profiling.test.ts
import { cpuUsage } from 'process'

describe('CPU Usage Profiling', () => {
  it('should not consume excessive CPU during template parsing', () => {
    const startUsage = cpuUsage()
    
    // CPU intensive operation
    execSync('npx unjucks generate complex-template generator --dest ./temp --dry', {
      stdio: 'pipe'
    })
    
    const endUsage = cpuUsage(startUsage)
    
    // Convert to milliseconds
    const userTime = endUsage.user / 1000
    const systemTime = endUsage.system / 1000
    const totalTime = userTime + systemTime
    
    console.log(`CPU Usage - User: ${userTime}ms, System: ${systemTime}ms, Total: ${totalTime}ms`)
    
    // Should not use more than 5 seconds of CPU time
    expect(totalTime).toBeLessThan(5000)
  })
})
```

### File I/O Performance

```typescript
// tests/performance/file-io.test.ts
describe('File I/O Performance', () => {
  it('should efficiently read template files', async () => {
    const start = performance.now()
    
    // Force template discovery which involves file system operations
    execSync('npx unjucks list --verbose', {
      stdio: 'pipe'
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(1000)
    console.log(`Template discovery I/O: ${duration.toFixed(2)}ms`)
  })

  it('should handle large file generation efficiently', async () => {
    const start = performance.now()
    
    // Generate a template that creates multiple large files
    execSync('npx unjucks generate large-project template --dest ./temp --dry', {
      stdio: 'pipe'
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(5000)
    console.log(`Large file generation: ${duration.toFixed(2)}ms`)
  })
})
```

### Scalability Testing

```typescript
// tests/performance/scalability.test.ts
describe('Scalability Testing', () => {
  const templateCounts = [10, 50, 100, 200]

  templateCounts.forEach(count => {
    it(`should handle ${count} templates efficiently`, async () => {
      // Create mock templates directory with specified count
      const tempTemplateDir = `./temp/templates-${count}`
      
      // Generate mock templates (this would be done in setup)
      // ... template generation logic ...
      
      const start = performance.now()
      
      execSync(`UNJUCKS_TEMPLATE_DIR=${tempTemplateDir} npx unjucks list`, {
        stdio: 'pipe'
      })
      
      const duration = performance.now() - start
      
      // Performance should scale linearly (or better)
      const expectedMaxDuration = Math.max(500, count * 5) // 5ms per template
      
      expect(duration).toBeLessThan(expectedMaxDuration)
      console.log(`${count} templates listed in ${duration.toFixed(2)}ms`)
    })
  })

  it('should handle deep directory structures', async () => {
    const start = performance.now()
    
    // Generate template with deep nesting
    execSync('npx unjucks generate nested-project template --depth 10 --dest ./temp --dry', {
      stdio: 'pipe'
    })
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(3000)
    console.log(`Deep nesting generation: ${duration.toFixed(2)}ms`)
  })
})
```

## Benchmarking Suite

### Comprehensive Benchmark Runner

```typescript
// tests/performance/benchmark-suite.test.ts
import Benchmark from 'benchmark'

describe('Unjucks Benchmark Suite', () => {
  it('should run comprehensive performance benchmarks', (done) => {
    const suite = new Benchmark.Suite('Unjucks Performance')
    
    suite
      .add('Template Listing', () => {
        execSync('npx unjucks list', { stdio: 'pipe' })
      })
      .add('Simple Generation', () => {
        execSync('npx unjucks generate command citty --commandName BenchTest --dest ./temp --dry', {
          stdio: 'pipe'
        })
      })
      .add('Complex Generation', () => {
        execSync('npx unjucks generate fullstack nextjs --projectName BenchApp --dest ./temp --dry', {
          stdio: 'pipe'
        })
      })
      .add('File Injection', () => {
        execSync('npx unjucks inject method add-method --targetFile ./fixtures/sample.ts --methodName testMethod --dry', {
          stdio: 'pipe'
        })
      })
      .on('cycle', (event: any) => {
        console.log(String(event.target))
      })
      .on('complete', function(this: any) {
        console.log('Fastest is ' + this.filter('fastest').map('name'))
        done()
      })
      .run({ async: false })
  }, 60000) // 1 minute timeout for benchmarks
})
```

### Performance Regression Detection

```typescript
// tests/performance/regression-detection.test.ts
describe('Performance Regression Detection', () => {
  const BASELINE_PERFORMANCES = {
    templateList: 300,     // 300ms baseline
    singleGeneration: 1500, // 1.5s baseline
    complexGeneration: 8000 // 8s baseline
  }

  const REGRESSION_THRESHOLD = 1.5 // 50% slowdown = regression

  it('should detect template listing regressions', () => {
    const start = performance.now()
    
    execSync('npx unjucks list', { stdio: 'pipe' })
    
    const duration = performance.now() - start
    const baseline = BASELINE_PERFORMANCES.templateList
    
    if (duration > baseline * REGRESSION_THRESHOLD) {
      throw new Error(`Performance regression detected: ${duration}ms vs ${baseline}ms baseline`)
    }
    
    console.log(`Template listing: ${duration}ms (baseline: ${baseline}ms)`)
  })

  // Similar tests for other operations...
})
```

## Performance Monitoring

### Real-time Performance Tracking

```typescript
// tests/performance/monitoring.test.ts
class PerformanceMonitor {
  private metrics: Array<{
    operation: string
    duration: number
    memory: NodeJS.MemoryUsage
    timestamp: number
  }> = []

  track<T>(operation: string, fn: () => T): T {
    const startTime = performance.now()
    const startMemory = process.memoryUsage()
    
    try {
      const result = fn()
      
      const duration = performance.now() - startTime
      const endMemory = process.memoryUsage()
      
      this.metrics.push({
        operation,
        duration,
        memory: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
        },
        timestamp: Date.now()
      })
      
      return result
    } catch (error) {
      throw error
    }
  }

  getReport() {
    return {
      totalOperations: this.metrics.length,
      averageTime: this.metrics.reduce((acc, m) => acc + m.duration, 0) / this.metrics.length,
      maxTime: Math.max(...this.metrics.map(m => m.duration)),
      minTime: Math.min(...this.metrics.map(m => m.duration)),
      memoryStats: {
        avgHeapIncrease: this.metrics.reduce((acc, m) => acc + m.memory.heapUsed, 0) / this.metrics.length,
        maxHeapIncrease: Math.max(...this.metrics.map(m => m.memory.heapUsed))
      }
    }
  }
}

describe('Performance Monitoring', () => {
  const monitor = new PerformanceMonitor()

  it('should track multiple operations', () => {
    // Track various operations
    monitor.track('list', () => {
      execSync('npx unjucks list', { stdio: 'pipe' })
    })

    monitor.track('generate', () => {
      execSync('npx unjucks generate command citty --commandName MonitorTest --dest ./temp --dry', {
        stdio: 'pipe'
      })
    })

    const report = monitor.getReport()
    
    console.log('Performance Report:', JSON.stringify(report, null, 2))
    
    expect(report.totalOperations).toBeGreaterThan(0)
    expect(report.averageTime).toBeLessThan(5000) // 5s average max
  })
})
```

## Optimization Strategies

### Template Caching Performance

```typescript
// tests/performance/caching.test.ts
describe('Template Caching Performance', () => {
  it('should cache template parsing results', async () => {
    // First run (cold cache)
    const coldStart = performance.now()
    execSync('npx unjucks generate command citty --commandName CacheTest1 --dest ./temp --dry', {
      stdio: 'pipe'
    })
    const coldDuration = performance.now() - coldStart

    // Second run (warm cache)
    const warmStart = performance.now()
    execSync('npx unjucks generate command citty --commandName CacheTest2 --dest ./temp --dry', {
      stdio: 'pipe'
    })
    const warmDuration = performance.now() - warmStart

    // Warm cache should be significantly faster
    expect(warmDuration).toBeLessThan(coldDuration * 0.8) // At least 20% improvement
    
    console.log(`Cold: ${coldDuration.toFixed(2)}ms, Warm: ${warmDuration.toFixed(2)}ms`)
    console.log(`Improvement: ${((coldDuration - warmDuration) / coldDuration * 100).toFixed(2)}%`)
  })
})
```

## Running Performance Tests

### Test Commands

```bash
# Run all performance tests
npm run test:performance

# Run specific performance category
npm run test:performance:memory
npm run test:performance:cpu
npm run test:performance:concurrency

# Run benchmark suite
npm run benchmark

# Generate performance report
npm run test:performance:report
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:performance": "vitest run tests/performance --reporter=verbose",
    "test:performance:memory": "node --expose-gc node_modules/.bin/vitest run tests/performance/memory-usage.test.ts",
    "test:performance:watch": "vitest tests/performance",
    "benchmark": "vitest run tests/performance/benchmark-suite.test.ts",
    "test:performance:report": "vitest run tests/performance --reporter=json > performance-report.json"
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/performance.yml
name: Performance Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - run: npm ci
      
      - name: Run Performance Tests
        run: |
          npm run test:performance
          npm run benchmark
          
      - name: Performance Regression Check
        run: npm run test:performance:regression
        
      - name: Upload Performance Report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-report.json
```

## Performance Analysis

### Identifying Bottlenecks

1. **CPU Profiling**: Use Node.js built-in profiler
2. **Memory Analysis**: Track heap usage patterns  
3. **I/O Monitoring**: Measure file system operations
4. **Network Timing**: Monitor MCP communication delays
5. **Template Complexity**: Analyze rendering performance

### Optimization Priorities

1. **Template Parsing**: Cache parsed templates
2. **File Operations**: Batch file I/O when possible
3. **Memory Management**: Minimize object creation
4. **Concurrent Operations**: Optimize parallel processing
5. **Error Handling**: Fast-fail for invalid inputs

### Performance Targets

- **Template Listing**: <500ms
- **Simple Generation**: <2s  
- **Complex Generation**: <10s
- **File Injection**: <1s
- **Memory Usage**: <200MB peak
- **Concurrent Operations**: Linear scaling

This comprehensive performance testing strategy ensures Unjucks maintains optimal performance across all usage scenarios.