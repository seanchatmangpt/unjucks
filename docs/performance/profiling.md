# Performance Profiling Guide

## Overview

This guide covers comprehensive performance profiling techniques, tools, and methodologies for analyzing and optimizing the Unjucks template generation system. It includes both built-in profiling capabilities and external profiling tools integration.

## Built-in Profiling System

### Performance Monitoring Framework
```javascript
// Comprehensive performance monitoring system
class PerformanceProfiler {
  constructor() {
    this.enabled = process.env.UNJUCKS_PERF_MONITOR === 'true';
    this.metrics = new Map();
    this.timers = new Map();
    this.memorySnapshots = [];
    this.operationCounts = new Map();
  }
  
  startOperation(operationName, metadata = {}) {
    if (!this.enabled) return;
    
    const operationId = this.generateOperationId(operationName);
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    this.timers.set(operationId, {
      name: operationName,
      startTime,
      startMemory,
      metadata
    });
    
    return operationId;
  }
  
  endOperation(operationId) {
    if (!this.enabled || !this.timers.has(operationId)) return;
    
    const operation = this.timers.get(operationId);
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - operation.startTime) / 1000000; // Convert to ms
    const memoryDelta = endMemory.heapUsed - operation.startMemory.heapUsed;
    
    this.recordMetric(operation.name, {
      duration,
      memoryDelta,
      startMemory: operation.startMemory.heapUsed,
      endMemory: endMemory.heapUsed,
      timestamp: Date.now(),
      metadata: operation.metadata
    });
    
    this.timers.delete(operationId);
    
    return { duration, memoryDelta };
  }
  
  recordMetric(operationName, data) {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    this.metrics.get(operationName).push(data);
    
    // Keep only recent metrics (last 1000 operations)
    const metrics = this.metrics.get(operationName);
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
    
    // Update operation counts
    const count = this.operationCounts.get(operationName) || 0;
    this.operationCounts.set(operationName, count + 1);
  }
}
```

### Template-Specific Profiling
```javascript
// Profiling specifically for template operations
class TemplateProfiler {
  constructor() {
    this.templateMetrics = new Map();
    this.variableMetrics = new Map();
    this.renderingMetrics = new Map();
  }
  
  profileTemplateDiscovery(templatePath, discoveryFn) {
    return this.profileAsync('template_discovery', async () => {
      const result = await discoveryFn();
      
      // Record template-specific metrics
      this.recordTemplateMetric(templatePath, 'discovery', {
        templateCount: result.templates.length,
        directoryDepth: result.maxDepth,
        totalSize: result.totalSize
      });
      
      return result;
    }, { templatePath });
  }
  
  profileVariableResolution(templatePath, variables, resolutionFn) {
    return this.profileSync('variable_resolution', () => {
      const result = resolutionFn();
      
      // Analyze variable complexity
      const complexity = this.calculateVariableComplexity(variables);
      
      this.recordVariableMetric(templatePath, {
        variableCount: Object.keys(variables).length,
        complexity,
        resolutionTime: this.getLastDuration('variable_resolution')
      });
      
      return result;
    }, { templatePath, variableCount: Object.keys(variables).length });
  }
  
  profileTemplateRendering(templatePath, template, variables, renderFn) {
    return this.profileAsync('template_rendering', async () => {
      const startMemory = process.memoryUsage();
      const result = await renderFn();
      const endMemory = process.memoryUsage();
      
      // Calculate rendering efficiency metrics
      const templateSize = template.length;
      const outputSize = result.length;
      const compressionRatio = templateSize / outputSize;
      const memoryEfficiency = startMemory.heapUsed / endMemory.heapUsed;
      
      this.recordRenderingMetric(templatePath, {
        templateSize,
        outputSize,
        compressionRatio,
        memoryEfficiency,
        variableCount: Object.keys(variables).length
      });
      
      return result;
    }, { templatePath, templateSize: template.length });
  }
}
```

## Node.js Built-in Profiling Tools

### CPU Profiling Integration
```javascript
// CPU profiling with Node.js built-in profiler
class CPUProfiler {
  constructor() {
    this.profiling = false;
    this.profilePath = './profiles';
    this.session = null;
  }
  
  async startCPUProfiling(duration = 30000) {
    if (this.profiling) return;
    
    try {
      const inspector = require('inspector');
      this.session = new inspector.Session();
      this.session.connect();
      
      // Start profiling
      await new Promise((resolve, reject) => {
        this.session.post('Profiler.enable', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        this.session.post('Profiler.start', (err) => {
          if (err) reject(err);
          else {
            this.profiling = true;
            resolve();
          }
        });
      });
      
      console.log(`CPU profiling started for ${duration}ms`);
      
      // Automatically stop after duration
      setTimeout(() => this.stopCPUProfiling(), duration);
      
    } catch (error) {
      console.error('Failed to start CPU profiling:', error);
    }
  }
  
  async stopCPUProfiling() {
    if (!this.profiling || !this.session) return null;
    
    return new Promise((resolve, reject) => {
      this.session.post('Profiler.stop', (err, { profile }) => {
        if (err) {
          reject(err);
        } else {
          this.profiling = false;
          this.session.disconnect();
          this.session = null;
          
          // Save profile to file
          const fs = require('fs');
          const timestamp = Date.now();
          const filename = `${this.profilePath}/cpu-profile-${timestamp}.json`;
          
          fs.writeFileSync(filename, JSON.stringify(profile, null, 2));
          console.log(`CPU profile saved to: ${filename}`);
          
          resolve(filename);
        }
      });
    });
  }
}
```

### Memory Profiling
```javascript
// Memory profiling and heap analysis
class MemoryProfiler {
  constructor() {
    this.heapSnapshots = [];
    this.memoryLeakDetection = true;
  }
  
  takeHeapSnapshot() {
    if (typeof global.gc === 'function') {
      global.gc(); // Force garbage collection for cleaner snapshot
    }
    
    const v8 = require('v8');
    const snapshot = v8.writeHeapSnapshot();
    
    this.heapSnapshots.push({
      timestamp: Date.now(),
      filename: snapshot,
      memory: process.memoryUsage()
    });
    
    console.log(`Heap snapshot saved: ${snapshot}`);
    return snapshot;
  }
  
  compareHeapSnapshots(snapshot1Path, snapshot2Path) {
    // Basic heap comparison (would typically use more sophisticated tools)
    const fs = require('fs');
    
    const snapshot1 = JSON.parse(fs.readFileSync(snapshot1Path));
    const snapshot2 = JSON.parse(fs.readFileSync(snapshot2Path));
    
    const comparison = {
      nodeCountDiff: snapshot2.snapshot.node_count - snapshot1.snapshot.node_count,
      edgeCountDiff: snapshot2.snapshot.edge_count - snapshot1.snapshot.edge_count,
      memorySizeDiff: snapshot2.snapshot.trace_function_count - snapshot1.snapshot.trace_function_count
    };
    
    return comparison;
  }
  
  startMemoryLeakDetection() {
    const initialMemory = process.memoryUsage();
    let previousMemory = initialMemory;
    
    const checkInterval = setInterval(() => {
      const currentMemory = process.memoryUsage();
      const growth = currentMemory.heapUsed - previousMemory.heapUsed;
      const totalGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
      
      if (growth > 5 * 1024 * 1024) { // 5MB growth
        console.warn(`Memory growth detected: ${(growth / 1024 / 1024).toFixed(2)}MB`);
        
        if (totalGrowth > 50 * 1024 * 1024) { // 50MB total growth
          console.error('Potential memory leak detected!');
          this.takeHeapSnapshot();
        }
      }
      
      previousMemory = currentMemory;
    }, 10000); // Check every 10 seconds
    
    return checkInterval;
  }
}
```

## External Profiling Tools Integration

### Chrome DevTools Profiling
```bash
# Enable Node.js debugging for Chrome DevTools
node --inspect --inspect-brk bin/unjucks.js generate command citty

# With specific debugging port
node --inspect=9229 bin/unjucks.js generate command citty

# CPU profiling from command line
node --prof bin/unjucks.js generate command citty
node --prof-process isolate-*-v8.log > processed.txt
```

### V8 Profiling Commands
```bash
# Generate detailed V8 profiling data
node --trace-opt --trace-deopt --trace-inlining bin/unjucks.js generate

# Memory profiling with heap snapshots
node --heap-prof --heap-prof-interval=100 bin/unjucks.js generate

# Trace garbage collection
node --trace-gc --trace-gc-verbose bin/unjucks.js generate

# Performance monitoring
node --perf-basic-prof --perf-prof bin/unjucks.js generate
```

### Integration with Popular Profiling Tools
```javascript
// Integration with clinic.js for comprehensive profiling
class ClinicJSIntegration {
  constructor() {
    this.profileTypes = ['doctor', 'bubbleprof', 'flame', 'heapprofiler'];
  }
  
  async runClinicProfile(profileType = 'doctor', command = 'generate command citty') {
    const { spawn } = require('child_process');
    
    const clinicCommand = [
      'clinic',
      profileType,
      '--',
      'node',
      'bin/unjucks.js',
      ...command.split(' ')
    ];
    
    return new Promise((resolve, reject) => {
      const process = spawn('npx', clinicCommand, {
        stdio: 'inherit',
        env: { ...process.env, UNJUCKS_PERF_MONITOR: 'true' }
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          console.log(`Clinic.js ${profileType} profiling completed`);
          resolve();
        } else {
          reject(new Error(`Profiling failed with code ${code}`));
        }
      });
    });
  }
  
  // Run all profiling types
  async runComprehensiveProfiling() {
    console.log('Starting comprehensive profiling with clinic.js...');
    
    for (const profileType of this.profileTypes) {
      console.log(`Running ${profileType} profiling...`);
      try {
        await this.runClinicProfile(profileType);
        console.log(`✓ ${profileType} profiling completed`);
      } catch (error) {
        console.error(`✗ ${profileType} profiling failed:`, error.message);
      }
    }
  }
}
```

### 0x Flame Graph Integration
```javascript
// Integration with 0x for flame graph generation
class FlameGraphProfiler {
  constructor() {
    this.outputDir = './profiles/flame-graphs';
  }
  
  async generateFlameGraph(command = 'generate command citty', duration = 30) {
    const { spawn } = require('child_process');
    const fs = require('fs').promises;
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    const timestamp = Date.now();
    const outputFile = `${this.outputDir}/flame-graph-${timestamp}`;
    
    const args = [
      '0x',
      '--output-dir', this.outputDir,
      '--name', `flame-graph-${timestamp}`,
      'bin/unjucks.js',
      ...command.split(' ')
    ];
    
    return new Promise((resolve, reject) => {
      const process = spawn('npx', args, {
        stdio: 'inherit',
        env: { ...process.env, UNJUCKS_PERF_MONITOR: 'true' }
      });
      
      // Kill process after duration
      setTimeout(() => {
        process.kill('SIGINT');
      }, duration * 1000);
      
      process.on('close', (code) => {
        console.log(`Flame graph generated in: ${this.outputDir}`);
        resolve(outputFile);
      });
      
      process.on('error', reject);
    });
  }
}
```

## Automated Performance Testing

### Performance Regression Detection
```javascript
// Automated performance regression testing
class PerformanceRegressionTester {
  constructor() {
    this.baselineFile = './performance-baseline.json';
    this.thresholds = {
      responseTime: 1.2,    // 20% increase threshold
      memoryUsage: 1.3,     // 30% increase threshold
      throughput: 0.8       // 20% decrease threshold
    };
  }
  
  async runPerformanceTests() {
    const testSuites = [
      { name: 'template-discovery', command: 'list' },
      { name: 'simple-generation', command: 'generate command simple' },
      { name: 'complex-generation', command: 'generate api fastify --complex' },
      { name: 'batch-generation', command: 'generate --batch test-batch.json' }
    ];
    
    const results = {};
    
    for (const suite of testSuites) {
      console.log(`Running performance test: ${suite.name}`);
      results[suite.name] = await this.runSingleTest(suite);
    }
    
    return this.analyzeResults(results);
  }
  
  async runSingleTest(suite) {
    const iterations = 10;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      // Run the test command
      await this.executeCommand(suite.command);
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1000000; // ms
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      results.push({
        duration,
        memoryDelta,
        peakMemory: endMemory.heapUsed
      });
      
      // Allow GC between iterations
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.calculateStatistics(results);
  }
  
  calculateStatistics(results) {
    const durations = results.map(r => r.duration);
    const memories = results.map(r => r.peakMemory);
    
    return {
      responseTime: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b) / durations.length,
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      },
      memoryUsage: {
        min: Math.min(...memories),
        max: Math.max(...memories),
        avg: memories.reduce((a, b) => a + b) / memories.length
      },
      throughput: 1000 / (durations.reduce((a, b) => a + b) / durations.length)
    };
  }
  
  async analyzeResults(currentResults) {
    let baseline;
    
    try {
      const fs = require('fs').promises;
      const baselineData = await fs.readFile(this.baselineFile, 'utf8');
      baseline = JSON.parse(baselineData);
    } catch (error) {
      console.log('No baseline found, creating new baseline');
      await this.saveBaseline(currentResults);
      return { status: 'baseline_created', results: currentResults };
    }
    
    const regressions = this.detectRegressions(baseline, currentResults);
    
    if (regressions.length > 0) {
      console.error('Performance regressions detected!');
      regressions.forEach(r => console.error(`  ${r.test}: ${r.metric} regressed by ${r.change}%`));
      return { status: 'regressions_detected', regressions, results: currentResults };
    }
    
    console.log('All performance tests passed!');
    return { status: 'passed', results: currentResults };
  }
  
  detectRegressions(baseline, current) {
    const regressions = [];
    
    for (const [testName, currentResult] of Object.entries(current)) {
      const baselineResult = baseline[testName];
      if (!baselineResult) continue;
      
      // Check response time regression
      const responseTimeChange = (currentResult.responseTime.avg - baselineResult.responseTime.avg) / baselineResult.responseTime.avg;
      if (responseTimeChange > (this.thresholds.responseTime - 1)) {
        regressions.push({
          test: testName,
          metric: 'responseTime',
          change: (responseTimeChange * 100).toFixed(1),
          current: currentResult.responseTime.avg,
          baseline: baselineResult.responseTime.avg
        });
      }
      
      // Check memory usage regression
      const memoryChange = (currentResult.memoryUsage.avg - baselineResult.memoryUsage.avg) / baselineResult.memoryUsage.avg;
      if (memoryChange > (this.thresholds.memoryUsage - 1)) {
        regressions.push({
          test: testName,
          metric: 'memoryUsage',
          change: (memoryChange * 100).toFixed(1),
          current: currentResult.memoryUsage.avg,
          baseline: baselineResult.memoryUsage.avg
        });
      }
      
      // Check throughput regression
      const throughputChange = (currentResult.throughput - baselineResult.throughput) / baselineResult.throughput;
      if (throughputChange < -(1 - this.thresholds.throughput)) {
        regressions.push({
          test: testName,
          metric: 'throughput',
          change: (throughputChange * 100).toFixed(1),
          current: currentResult.throughput,
          baseline: baselineResult.throughput
        });
      }
    }
    
    return regressions;
  }
}
```

## Profiling Best Practices

### Development Workflow Integration
```javascript
// Integrate profiling into development workflow
class DevelopmentProfiler {
  constructor() {
    this.profilingEnabled = process.env.NODE_ENV === 'development';
    this.autoProfileThreshold = 1000; // Auto-profile operations > 1s
  }
  
  wrapAsyncFunction(name, fn) {
    if (!this.profilingEnabled) return fn;
    
    return async function(...args) {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await fn.apply(this, args);
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        
        // Auto-profile slow operations
        if (duration > this.autoProfileThreshold) {
          console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
          this.suggestOptimizations(name, duration, startMemory);
        }
        
        return result;
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;
        console.error(`Operation ${name} failed after ${duration.toFixed(2)}ms:`, error.message);
        throw error;
      }
    }.bind(this);
  }
  
  suggestOptimizations(operationName, duration, memoryUsage) {
    const suggestions = {
      'template-discovery': [
        'Consider caching template discovery results',
        'Use parallel directory scanning',
        'Implement template indexing'
      ],
      'variable-resolution': [
        'Cache resolved variables',
        'Optimize variable dependency graph',
        'Use lazy evaluation for complex variables'
      ],
      'template-rendering': [
        'Enable template compilation caching',
        'Use streaming for large templates',
        'Consider template chunking'
      ]
    };
    
    const operationSuggestions = suggestions[operationName] || [
      'Profile this operation in detail',
      'Consider algorithmic improvements',
      'Check for memory leaks'
    ];
    
    console.log(`Optimization suggestions for ${operationName}:`);
    operationSuggestions.forEach(s => console.log(`  • ${s}`));
  }
}
```

### Continuous Performance Monitoring
```bash
# Performance monitoring in CI/CD pipeline
#!/bin/bash

echo "Running performance regression tests..."

# Run performance tests
npm run test:performance

# Generate flame graphs for key operations
npm run profile:flame-graphs

# Check for memory leaks
npm run test:memory-leaks

# Compare with baseline performance
npm run compare:performance-baseline

# Generate performance report
npm run report:performance
```

### Performance Profiling Checklist
```javascript
const profilingChecklist = {
  preparation: [
    "✓ Enable performance monitoring flags",
    "✓ Clear caches and restart Node.js process",
    "✓ Use consistent test data and environment",
    "✓ Close unnecessary applications to reduce noise"
  ],
  
  profiling: [
    "✓ Profile in isolation (one operation at a time)",
    "✓ Run multiple iterations for statistical validity",
    "✓ Profile both happy path and edge cases",
    "✓ Include realistic data sizes and complexity"
  ],
  
  analysis: [
    "✓ Identify bottlenecks and hotspots",
    "✓ Analyze memory allocation patterns",
    "✓ Check for memory leaks",
    "✓ Compare with baseline performance"
  ],
  
  optimization: [
    "✓ Implement targeted optimizations",
    "✓ Measure optimization impact",
    "✓ Ensure no regression in other areas",
    "✓ Update performance baselines"
  ]
};
```

This comprehensive profiling guide provides the tools and techniques needed to analyze, optimize, and maintain high performance in the Unjucks template generation system.