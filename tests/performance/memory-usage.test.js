import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { memoryUsage } from 'node:process';
import fs from 'fs-extra';
import path from 'path';

describe('Memory Usage Tracking', () => {
  let initialMemory;
  let testStartTime;

  beforeEach(() => {
    initialMemory = global.trackMemory('test-start');
    testStartTime = performance.now();
  });

  afterEach(async () => {
    const finalMemory = global.trackMemory('test-end');
    const testDuration = performance.now() - testStartTime;
    
    // Memory leak detection
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
    console.log(`Test duration: ${testDuration.toFixed(2)}ms`);
    
    // Alert on significant memory increases (Fortune 5 scale)
    if (memoryIncrease > global.performanceMetrics.thresholds.maxMemoryIncrease) {
      console.warn(`🚨 MEMORY ALERT: Test exceeded memory threshold by ${((memoryIncrease - global.performanceMetrics.thresholds.maxMemoryIncrease) / 1024 / 1024).toFixed(2)}MB`);
    }
  });

  it('should track memory usage during template generation', async () => {
    const timer = global.startPerformanceTimer('template-generation-memory');
    
    // Simulate template generation operations
    const templates = [];
    for (let i = 0; i < 1000; i++) {
      global.trackMemory(`iteration-${i}`);
      
      // Simulate template processing
      templates.push({
        id: i,
        content: `Template content ${i}`.repeat(100),
        metadata: {
          created: this.getDeterministicTimestamp(),
          size: Math.random() * 1000
        }
      });
      
      // Track memory every 100 iterations
      if (i % 100 === 0) {
        const currentMemory = global.trackMemory(`checkpoint-${i}`);
        console.log(`Iteration ${i}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    timer.end();
    
    // Verify memory usage is within acceptable bounds
    const finalMemory = global.trackMemory('template-generation-end');
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    expect(memoryIncrease).toBeLessThan(global.performanceMetrics.thresholds.maxMemoryIncrease);
    expect(templates.length).toBe(1000);
  });

  it('should track memory usage during file operations', async () => {
    const timer = global.startPerformanceTimer('file-operations-memory');
    
    // Create test directory
    const testDir = path.join(process.cwd(), 'tests/tmp/memory-test');
    await fs.ensureDir(testDir);
    
    try {
      // Generate multiple files to test memory usage
      for (let i = 0; i < 100; i++) {
        global.trackMemory(`file-op-${i}`);
        
        const filePath = path.join(testDir, `test-file-${i}.txt`);
        const content = `This is test file ${i}\n`.repeat(1000);
        
        await fs.writeFile(filePath, content);
        const readContent = await fs.readFile(filePath, 'utf8');
        
        expect(readContent).toContain(`test file ${i}`);
        
        // Track memory every 10 files
        if (i % 10 === 0) {
          const currentMemory = global.trackMemory(`file-checkpoint-${i}`);
          console.log(`File ${i}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
      }
    } finally {
      // Cleanup
      await fs.remove(testDir);
    }
    
    timer.end();
    
    const finalMemory = global.trackMemory('file-operations-end');
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    expect(memoryIncrease).toBeLessThan(global.performanceMetrics.thresholds.maxMemoryIncrease);
  });

  it('should detect memory leaks in template processing', async () => {
    const iterations = 500;
    const memoryMeasurements = [];
    
    for (let i = 0; i < iterations; i++) {
      // Simulate template processing that might cause leaks
      const template = {
        id: i,
        content: `Large template content ${i}`.repeat(500),
        processed: this.getDeterministicDate(),
        cache: new Map()
      };
      
      // Add some data to simulate memory usage
      for (let j = 0; j < 100; j++) {
        template.cache.set(`key-${j}`, `value-${j}`.repeat(10));
      }
      
      // Track memory periodically
      if (i % 50 === 0) {
        const memory = global.trackMemory(`leak-test-${i}`);
        memoryMeasurements.push(memory.heapUsed);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          const postGcMemory = global.trackMemory(`post-gc-${i}`);
          console.log(`Iteration ${i}: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB -> ${(postGcMemory.heapUsed / 1024 / 1024).toFixed(2)}MB (post-GC)`);
        }
      }
      
      // Clear template to help GC
      template.cache.clear();
    }
    
    // Analyze memory growth trend
    if (memoryMeasurements.length >= 3) {
      const firstMeasurement = memoryMeasurements[0];
      const lastMeasurement = memoryMeasurements[memoryMeasurements.length - 1];
      const growthRate = (lastMeasurement - firstMeasurement) / firstMeasurement;
      
      console.log(`Memory growth rate: ${(growthRate * 100).toFixed(2)}%`);
      
      // Alert on excessive memory growth (potential leak)
      if (growthRate > 0.5) { // 50% growth threshold
        console.warn(`🚨 POTENTIAL MEMORY LEAK: ${(growthRate * 100).toFixed(2)}% memory growth detected`);
      }
      
      expect(growthRate).toBeLessThan(1.0); // Should not double memory usage
    }
  });

  it('should track memory usage with concurrent operations', async () => {
    const concurrentOperations = 10;
    const operationsPerTask = 100;
    
    const timer = global.startPerformanceTimer('concurrent-memory-test');
    
    // Launch concurrent memory-intensive operations
    const promises = Array.from({ length: concurrentOperations }, async (_, taskIndex) => {
      global.trackMemory(`task-${taskIndex}-start`);
      
      const taskData = [];
      for (let i = 0; i < operationsPerTask; i++) {
        taskData.push({
          taskId: taskIndex,
          operationId: i,
          data: `Task ${taskIndex} operation ${i}`.repeat(50),
          timestamp: this.getDeterministicTimestamp()
        });
      }
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      global.trackMemory(`task-${taskIndex}-end`);
      return taskData.length;
    });
    
    const results = await Promise.all(promises);
    timer.end();
    
    // Verify all tasks completed successfully
    expect(results).toHaveLength(concurrentOperations);
    expect(results.every(count => count === operationsPerTask)).toBe(true);
    
    const finalMemory = global.trackMemory('concurrent-test-end');
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    console.log(`Concurrent operations memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    expect(memoryIncrease).toBeLessThan(global.performanceMetrics.thresholds.maxMemoryIncrease * 2); // Allow 2x for concurrent operations
  });

  it('should generate memory usage report', async () => {
    // Perform various operations to generate memory data
    for (let i = 0; i < 50; i++) {
      global.trackMemory(`report-test-${i}`);
      
      // Simulate different types of operations
      const data = new Array(1000).fill(0).map((_, j) => ({
        id: `${i}-${j}`,
        content: `Data ${i}-${j}`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const report = global.generatePerformanceReport();
    
    // Verify report structure
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('measurements');
    expect(report).toHaveProperty('summary');
    expect(report.measurements.length).toBeGreaterThan(0);
    
    // Save memory report
    await fs.ensureDir('reports/performance');
    const reportPath = `reports/performance/memory-report-${this.getDeterministicTimestamp()}.json`;
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log(`Memory report saved to: ${reportPath}`);
    console.log(`Total measurements: ${report.measurements.length}`);
    console.log(`Memory peak: ${(report.summary.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
  });
});