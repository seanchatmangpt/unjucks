import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

describe('Performance Regression Detection', () => {
  let baselineData;
  let currentMetrics;
  
  beforeAll(async () => {
    // Load baseline performance data
    baselineData = await global.loadPerformanceBaseline('template-generation');
    currentMetrics = {
      timestamp: this.getDeterministicDate().toISOString(),
      testResults: {}
    };
    
    if (!baselineData) {
      console.warn('No baseline data found. Creating initial baseline...');
      baselineData = {
        metrics: {
          simpleTemplateRendering: {
            operationsPerSecond: 50000,
            averageLatencyMs: 0.02,
            p95LatencyMs: 0.05,
            memoryUsageMB: 1.5
          }
        },
        thresholds: {
          regressionTolerancePercent: 15,
          memoryLeakThresholdMB: 10
        }
      };
    }
  });

  afterAll(async () => {
    // Save current metrics for future regression detection
    await global.savePerformanceBaseline('template-generation-current', currentMetrics);
    
    // Generate regression report
    const reportPath = `reports/performance/regression-report-${this.getDeterministicTimestamp()}.json`;
    await fs.writeJson(reportPath, {
      baseline: baselineData,
      current: currentMetrics,
      regressions: await detectAllRegressions()
    }, { spaces: 2 });
    
    console.log(`Regression detection report saved to: ${reportPath}`);
  });

  it('should detect latency regressions in simple template rendering', async () => {
    const timer = global.startPerformanceTimer('simple-template-latency-test');
    const iterations = 10000;
    const latencies = [];
    
    // Measure current performance
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate simple template rendering
      const template = 'Hello {{ name }}! You have {{ count }} messages.';
      const result = template.replace('{{ name }}', `User${i}`)
                            .replace('{{ count }}', (i % 100).toString());
      
      const latency = performance.now() - start;
      latencies.push(latency);
      
      expect(result).toContain(`User${i}`);
    }
    
    timer.end();
    
    // Calculate performance metrics
    const metrics = {
      operationsPerSecond: (iterations / (timer.duration / 1000)),
      averageLatencyMs: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p95LatencyMs: global.calculatePercentiles(latencies).p95,
      p99LatencyMs: global.calculatePercentiles(latencies).p99
    };
    
    currentMetrics.testResults.simpleTemplateRendering = metrics;
    
    // Compare with baseline
    if (baselineData.metrics.simpleTemplateRendering) {
      const baseline = baselineData.metrics.simpleTemplateRendering;
      const regressions = [];
      
      // Check latency regression
      const latencyRegression = global.detectRegression(
        metrics.averageLatencyMs,
        baseline.averageLatencyMs,
        baselineData.thresholds.regressionTolerancePercent / 100
      );
      
      if (latencyRegression.isRegression) {
        regressions.push({
          type: 'latency',
          metric: 'averageLatencyMs',
          current: metrics.averageLatencyMs,
          baseline: baseline.averageLatencyMs,
          changePercent: latencyRegression.percentChange
        });
      }
      
      // Check throughput regression
      const throughputRegression = global.detectRegression(
        baseline.operationsPerSecond, // Baseline first for throughput (higher is better)
        metrics.operationsPerSecond,
        baselineData.thresholds.regressionTolerancePercent / 100
      );
      
      if (throughputRegression.isRegression) {
        regressions.push({
          type: 'throughput',
          metric: 'operationsPerSecond',
          current: metrics.operationsPerSecond,
          baseline: baseline.operationsPerSecond,
          changePercent: -throughputRegression.percentChange // Negative because throughput decreased
        });
      }
      
      // Report regressions
      if (regressions.length > 0) {
        console.warn('🚨 PERFORMANCE REGRESSIONS DETECTED:');
        regressions.forEach(reg => {
          console.warn(`- ${reg.type.toUpperCase()}: ${reg.metric} changed by ${reg.changePercent.toFixed(2)}%`);
          console.warn(`  Current: ${reg.current.toFixed(4)}, Baseline: ${reg.baseline.toFixed(4)}`);
        });
      } else {
        console.log('✅ No performance regressions detected in simple template rendering');
      }
      
      // Fail test if critical regressions found
      const criticalRegressions = regressions.filter(r => 
        Math.abs(r.changePercent) > baselineData.thresholds.regressionTolerancePercent
      );
      expect(criticalRegressions.length).toBe(0);
    }
    
    console.log(`Simple template rendering: ${metrics.operationsPerSecond.toFixed(0)} ops/sec, ${metrics.averageLatencyMs.toFixed(4)}ms avg latency`);
  });

  it('should detect memory usage regressions', async () => {
    const initialMemory = global.trackMemory('memory-regression-start');
    const memoryMeasurements = [];
    
    // Simulate memory-intensive operations
    const largeObjects = [];
    for (let i = 0; i < 1000; i++) {
      const memoryBefore = global.trackMemory(`iteration-${i}-start`);
      
      // Create large object to test memory usage
      const largeObject = {
        id: i,
        data: new Array(1000).fill(0).map((_, j) => ({
          index: j,
          content: `Large content ${i}-${j}`.repeat(10),
          timestamp: this.getDeterministicTimestamp()
        }))
      };
      
      largeObjects.push(largeObject);
      
      const memoryAfter = global.trackMemory(`iteration-${i}-end`);
      memoryMeasurements.push({
        iteration: i,
        memoryIncrease: memoryAfter.heapUsed - memoryBefore.heapUsed
      });
      
      // Periodically clean up to prevent excessive memory usage
      if (i % 100 === 0 && i > 0) {
        largeObjects.splice(0, 50); // Remove half of the objects
        if (global.gc) global.gc(); // Force garbage collection if available
      }
    }
    
    const finalMemory = global.trackMemory('memory-regression-end');
    const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Calculate memory usage metrics
    const memoryMetrics = {
      totalMemoryIncreaseMB: totalMemoryIncrease / 1024 / 1024,
      averageIterationIncreaseMB: memoryMeasurements.reduce((sum, m) => 
        sum + m.memoryIncrease, 0) / memoryMeasurements.length / 1024 / 1024,
      peakMemoryUsageMB: Math.max(...global.performanceMetrics.measurements
        .filter(m => m.heapUsed)
        .map(m => m.heapUsed)) / 1024 / 1024
    };
    
    currentMetrics.testResults.memoryUsage = memoryMetrics;
    
    // Check for memory leaks
    const memoryGrowthRate = totalMemoryIncrease / 1000; // Per iteration
    const memoryLeakThreshold = (baselineData.thresholds.memoryLeakThresholdMB || 10) * 1024 * 1024;
    
    if (totalMemoryIncrease > memoryLeakThreshold) {
      console.warn(`🚨 POTENTIAL MEMORY LEAK: ${memoryMetrics.totalMemoryIncreaseMB.toFixed(2)}MB increase detected`);
      console.warn(`Memory growth rate: ${(memoryGrowthRate / 1024).toFixed(2)}KB per iteration`);
    }
    
    // Compare with baseline if available
    if (baselineData.metrics.memoryUsage) {
      const memoryRegression = global.detectRegression(
        memoryMetrics.totalMemoryIncreaseMB,
        baselineData.metrics.memoryUsage.totalMemoryIncreaseMB,
        0.25 // 25% tolerance for memory usage
      );
      
      if (memoryRegression.isRegression) {
        console.warn(`🚨 MEMORY REGRESSION: ${memoryRegression.percentChange.toFixed(2)}% increase in memory usage`);
      }
    }
    
    expect(totalMemoryIncrease).toBeLessThan(memoryLeakThreshold);
    console.log(`Memory usage: ${memoryMetrics.totalMemoryIncreaseMB.toFixed(2)}MB total increase`);
  });

  it('should detect throughput regressions under load', async () => {
    const loadTestDuration = 30000; // 30 seconds
    const startTime = performance.now();
    const results = [];
    
    // Simulate concurrent load
    const concurrentTasks = 10;
    const taskPromises = Array.from({ length: concurrentTasks }, async (_, taskId) => {
      const taskResults = [];
      
      while (performance.now() - startTime < loadTestDuration) {
        const operationStart = performance.now();
        
        // Simulate template processing operation
        const template = `
          Task {{ taskId }} - Operation {{ operationId }}
          {% for item in items %}
            Item {{ item.id }}: {{ item.value }}
          {% endfor %}
        `;
        
        const data = {
          taskId,
          operationId: taskResults.length,
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            value: Math.random() * 1000
          }))
        };
        
        // Simulate template rendering
        const rendered = template.replace(/\{\{ taskId \}\}/g, taskId.toString())
                                .replace(/\{\{ operationId \}\}/g, taskResults.length.toString());
        
        const operationDuration = performance.now() - operationStart;
        taskResults.push({
          taskId,
          duration: operationDuration,
          timestamp: this.getDeterministicTimestamp()
        });
        
        expect(rendered).toContain(`Task ${taskId}`);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      return taskResults;
    });
    
    const allTaskResults = await Promise.all(taskPromises);
    const flatResults = allTaskResults.flat();
    
    // Calculate throughput metrics
    const totalOperations = flatResults.length;
    const actualDuration = performance.now() - startTime;
    const throughputMetrics = {
      operationsPerSecond: (totalOperations / actualDuration) * 1000,
      totalOperations,
      testDurationMs: actualDuration,
      averageLatencyMs: flatResults.reduce((sum, r) => sum + r.duration, 0) / flatResults.length,
      concurrentTasks
    };
    
    currentMetrics.testResults.loadTesting = throughputMetrics;
    
    // Compare with baseline
    if (baselineData.loadTestBaselines) {
      const expectedThroughput = baselineData.loadTestBaselines.expectedThroughput;
      const currentUserLoad = concurrentTasks * 10; // Approximate user equivalent
      
      let baselineThroughput;
      if (currentUserLoad <= 100) {
        baselineThroughput = expectedThroughput.complexTemplates['100users'];
      } else if (currentUserLoad <= 500) {
        baselineThroughput = expectedThroughput.complexTemplates['500users'];
      } else {
        baselineThroughput = expectedThroughput.complexTemplates['1000users'];
      }
      
      const throughputRegression = global.detectRegression(
        baselineThroughput,
        throughputMetrics.operationsPerSecond,
        0.20 // 20% tolerance for throughput under load
      );
      
      if (throughputRegression.isRegression) {
        console.warn(`🚨 THROUGHPUT REGRESSION: ${throughputRegression.percentChange.toFixed(2)}% decrease under load`);
        console.warn(`Current: ${throughputMetrics.operationsPerSecond.toFixed(0)} ops/sec`);
        console.warn(`Expected: ${baselineThroughput} ops/sec`);
      } else {
        console.log('✅ Throughput under load meets baseline expectations');
      }
      
      expect(throughputRegression.isRegression).toBe(false);
    }
    
    console.log(`Load test: ${throughputMetrics.operationsPerSecond.toFixed(0)} ops/sec with ${concurrentTasks} concurrent tasks`);
  });

  it('should generate comprehensive regression report', async () => {
    const regressionReport = await detectAllRegressions();
    
    // Save detailed regression analysis
    const analysisPath = `reports/performance/regression-analysis-${this.getDeterministicTimestamp()}.json`;
    await fs.writeJson(analysisPath, {
      timestamp: this.getDeterministicDate().toISOString(),
      baselineVersion: baselineData.version,
      currentVersion: process.env.npm_package_version || 'unknown',
      testEnvironment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      regressionAnalysis: regressionReport,
      recommendations: generatePerformanceRecommendations(regressionReport)
    }, { spaces: 2 });
    
    console.log(`Comprehensive regression analysis saved to: ${analysisPath}`);
    
    // Generate alerts for critical regressions
    const criticalRegressions = regressionReport.filter(r => r.severity === 'critical');
    if (criticalRegressions.length > 0) {
      console.error('🚨 CRITICAL PERFORMANCE REGRESSIONS DETECTED:');
      criticalRegressions.forEach(reg => {
        console.error(`- ${reg.testName}: ${reg.description}`);
        console.error(`  Impact: ${reg.impact}`);
      });
    }
    
    expect(criticalRegressions.length).toBe(0);
  });

  // Helper function to detect all regressions
  async function detectAllRegressions() {
    const regressions = [];
    
    Object.entries(currentMetrics.testResults).forEach(([testName, metrics]) => {
      if (baselineData.metrics[testName]) {
        const baseline = baselineData.metrics[testName];
        
        // Check each metric for regression
        Object.entries(metrics).forEach(([metricName, currentValue]) => {
          if (baseline[metricName] && typeof currentValue === 'number') {
            const isLatencyMetric = metricName.includes('Latency') || metricName.includes('Duration');
            const isMemoryMetric = metricName.includes('Memory') || metricName.includes('MB');
            const isThroughputMetric = metricName.includes('operationsPerSecond');
            
            let regression;
            if (isThroughputMetric) {
              // For throughput, lower is worse
              regression = global.detectRegression(baseline[metricName], currentValue, 0.15);
            } else {
              // For latency and memory, higher is worse
              regression = global.detectRegression(currentValue, baseline[metricName], 0.15);
            }
            
            if (regression.isRegression) {
              const severity = Math.abs(regression.percentChange) > 25 ? 'critical' : 'warning';
              
              regressions.push({
                testName,
                metricName,
                currentValue,
                baselineValue: baseline[metricName],
                changePercent: regression.percentChange,
                severity,
                description: `${metricName} in ${testName} changed by ${regression.percentChange.toFixed(2)}%`,
                impact: isLatencyMetric ? 'Performance degradation' :
                       isMemoryMetric ? 'Increased memory usage' :
                       isThroughputMetric ? 'Reduced throughput' : 'Performance change'
              });
            }
          }
        });
      }
    });
    
    return regressions;
  }

  // Helper function to generate performance recommendations
  function generatePerformanceRecommendations(regressions) {
    const recommendations = [];
    
    const latencyRegressions = regressions.filter(r => r.metricName.includes('Latency'));
    const memoryRegressions = regressions.filter(r => r.metricName.includes('Memory'));
    const throughputRegressions = regressions.filter(r => r.metricName.includes('operationsPerSecond'));
    
    if (latencyRegressions.length > 0) {
      recommendations.push({
        category: 'Latency Optimization',
        priority: 'High',
        actions: [
          'Profile template rendering pipeline for bottlenecks',
          'Optimize template compilation and caching',
          'Consider implementing template pre-compilation',
          'Review and optimize loop operations in templates'
        ]
      });
    }
    
    if (memoryRegressions.length > 0) {
      recommendations.push({
        category: 'Memory Management',
        priority: 'High',
        actions: [
          'Investigate potential memory leaks in template processing',
          'Implement object pooling for frequently created objects',
          'Optimize large data structure handling',
          'Add memory profiling to continuous integration'
        ]
      });
    }
    
    if (throughputRegressions.length > 0) {
      recommendations.push({
        category: 'Throughput Enhancement',
        priority: 'Medium',
        actions: [
          'Analyze concurrency bottlenecks',
          'Optimize template parsing and rendering algorithms',
          'Consider implementing parallel template processing',
          'Review I/O operations for optimization opportunities'
        ]
      });
    }
    
    return recommendations;
  }
});