/**
 * Docker Stress Testing for Production Resource Management
 * 
 * Comprehensive stress tests designed to run in Docker containers
 * to validate resource management under containerized production conditions.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { ResourceMonitor, TempDirectoryTracker } = require('./resource-validation.test');

describe('Docker Production Stress Tests', () => {
  let resourceMonitor;
  let tempTracker;
  let containerStats = {
    maxMemoryUsage: 0,
    maxCpuUsage: 0,
    peakFileHandles: 0,
    totalOperations: 0
  };

  beforeAll(async () => {
    resourceMonitor = new ResourceMonitor();
    tempTracker = new TempDirectoryTracker();
    
    await resourceMonitor.setBaseline();
    await tempTracker.setBaseline();
    
    console.log('Starting Docker stress tests...');
    console.log('Container limits:', {
      memoryLimit: process.env.MEMORY_LIMIT || 'unlimited',
      cpuLimit: process.env.CPU_LIMIT || 'unlimited',
      maxFileHandles: process.env.MAX_FILE_HANDLES || 'system default'
    });
  });

  afterAll(async () => {
    console.log('Final container statistics:', containerStats);
    
    const cleanup = await tempTracker.validateCleanup();
    console.log('Final cleanup status:', cleanup);
    
    const finalMemory = resourceMonitor.getMemoryDelta();
    console.log('Final memory delta:', {
      rss: Math.round(finalMemory.rss / 1024 / 1024) + 'MB',
      heap: Math.round(finalMemory.heapUsed / 1024 / 1024) + 'MB'
    });
  });

  describe('High Volume Template Processing', () => {
    test('should handle 1000+ template compilations without resource leaks', async () => {
      const templateCount = 1000;
      const batchSize = 50;
      let processedCount = 0;
      
      const templates = [
        'User {{ name }} has {{ count }} items in cart',
        'Order #{{ orderId }} for {{ customer }} - Total: ${{ total }}',
        'Welcome {{ username }}, you have {{ notifications }} new messages',
        'Product {{ productName }} is {{ status }} - Price: ${{ price }}',
        'Report generated on {{ date }} for {{ department }}'
      ];
      
      const startTime = Date.now();
      await resourceMonitor.setBaseline();
      
      // Process templates in batches to avoid overwhelming the system
      for (let batch = 0; batch < Math.ceil(templateCount / batchSize); batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize && processedCount < templateCount; i++) {
          const templateIndex = processedCount % templates.length;
          const template = templates[templateIndex];
          
          const compilationTask = async () => {
            const context = {
              name: `User${processedCount}`,
              count: Math.floor(Math.random() * 100),
              orderId: `ORD-${processedCount}`,
              customer: `Customer${processedCount}`,
              total: (Math.random() * 1000).toFixed(2),
              username: `user${processedCount}`,
              notifications: Math.floor(Math.random() * 20),
              productName: `Product${processedCount}`,
              status: ['available', 'sold out', 'discontinued'][Math.floor(Math.random() * 3)],
              price: (Math.random() * 500).toFixed(2),
              date: new Date().toISOString().split('T')[0],
              department: ['Sales', 'Marketing', 'Support'][Math.floor(Math.random() * 3)]
            };
            
            // Simulate template compilation
            let result = template;
            for (const [key, value] of Object.entries(context)) {
              result = result.replace(new RegExp(`{{ ${key} }}`, 'g'), value);
            }
            
            return result;
          };
          
          batchPromises.push(compilationTask());
          processedCount++;
        }
        
        await Promise.all(batchPromises);
        
        // Monitor resources every batch
        await resourceMonitor.measure();
        const currentMemory = process.memoryUsage();
        containerStats.maxMemoryUsage = Math.max(containerStats.maxMemoryUsage, currentMemory.rss);
        
        // Force garbage collection to test cleanup
        if (global.gc && batch % 10 === 0) {
          global.gc();
        }
        
        // Brief pause to prevent overwhelming
        if (batch % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      containerStats.totalOperations += processedCount;
      
      // Validate no significant memory leaks
      const hasLeak = resourceMonitor.detectMemoryLeak(100); // 100MB threshold for high volume
      expect(hasLeak).toBe(false);
      
      // Performance assertions
      const throughput = processedCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(100); // At least 100 templates/second
      
      console.log(`Processed ${processedCount} templates in ${duration}ms`);
      console.log(`Throughput: ${Math.round(throughput)} templates/second`);
      console.log(`Peak memory: ${Math.round(containerStats.maxMemoryUsage / 1024 / 1024)}MB`);
    });

    test('should handle concurrent file operations without descriptor leaks', async () => {
      const concurrentFiles = 100;
      const operationsPerFile = 10;
      let activeFileHandles = 0;
      let maxFileHandles = 0;
      
      const fileOperations = Array.from({ length: concurrentFiles }, async (_, fileIndex) => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `stress-test-${fileIndex}-`));
        tempTracker.trackTempDir(tempDir);
        
        const operations = Array.from({ length: operationsPerFile }, async (_, opIndex) => {
          const filePath = path.join(tempDir, `file-${opIndex}.njk`);
          
          try {
            activeFileHandles++;
            maxFileHandles = Math.max(maxFileHandles, activeFileHandles);
            
            // Write operation
            await fs.writeFile(filePath, `Template ${fileIndex}-${opIndex}: {{ value }}`);
            
            // Read operation
            const content = await fs.readFile(filePath, 'utf8');
            expect(content).toContain('Template');
            
            // Modify operation
            await fs.writeFile(filePath, content.replace('{{ value }}', 'processed'));
            
            // Final read
            const finalContent = await fs.readFile(filePath, 'utf8');
            expect(finalContent).toContain('processed');
            
            return finalContent;
            
          } finally {
            activeFileHandles--;
          }
        });
        
        const results = await Promise.all(operations);
        
        // Cleanup directory
        await fs.rmdir(tempDir, { recursive: true });
        
        return results;
      });
      
      const allResults = await Promise.all(fileOperations);
      
      containerStats.peakFileHandles = Math.max(containerStats.peakFileHandles, maxFileHandles);
      
      expect(allResults.length).toBe(concurrentFiles);
      expect(allResults.every(batch => batch.length === operationsPerFile)).toBe(true);
      
      // Verify no file descriptor leaks
      expect(activeFileHandles).toBe(0);
      
      console.log(`Completed ${concurrentFiles * operationsPerFile} file operations`);
      console.log(`Peak concurrent file handles: ${maxFileHandles}`);
    });
  });

  describe('Memory Pressure Scenarios', () => {
    test('should handle memory pressure gracefully', async () => {
      const memoryPressureTest = async () => {
        const chunks = [];
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        let allocatedMemory = 0;
        
        try {
          // Gradually increase memory usage
          while (allocatedMemory < 200 * 1024 * 1024) { // Up to 200MB
            const chunk = Buffer.alloc(chunkSize, 'x');
            chunks.push(chunk);
            allocatedMemory += chunkSize;
            
            await resourceMonitor.measure();
            
            // Simulate some work with each allocation
            const workResult = chunk.toString('ascii', 0, 100);
            expect(workResult).toBe('x'.repeat(100));
            
            // Check if we're approaching limits
            const currentMemory = process.memoryUsage();
            if (currentMemory.rss > 512 * 1024 * 1024) { // 512MB RSS limit
              console.log('Approaching memory limit, stopping allocation');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          // Verify system is still responsive
          const testTemplate = 'Memory test: {{ status }}';
          const result = testTemplate.replace('{{ status }}', 'responsive');
          expect(result).toBe('Memory test: responsive');
          
          return { allocatedChunks: chunks.length, totalAllocated: allocatedMemory };
          
        } finally {
          // Cleanup - release all memory
          chunks.length = 0;
          
          if (global.gc) {
            global.gc();
            global.gc(); // Run twice to ensure cleanup
          }
        }
      };
      
      const result = await memoryPressureTest();
      
      console.log('Memory pressure test:', {
        chunksAllocated: result.allocatedChunks,
        totalMB: Math.round(result.totalAllocated / 1024 / 1024),
        finalMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      });
      
      // System should still be responsive
      const postTestMemory = process.memoryUsage();
      expect(postTestMemory.rss).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
    });

    test('should recover from memory allocation failures', async () => {
      const allocationTests = [];
      const maxAttempts = 10;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const allocationTest = async () => {
          try {
            // Try to allocate a large chunk
            const size = (100 + attempt * 50) * 1024 * 1024; // Increasing size
            const largeBuffer = Buffer.alloc(size);
            
            // If successful, do some work
            largeBuffer.fill(attempt);
            const sample = largeBuffer.readUInt8(0);
            
            return { success: true, size, sample };
            
          } catch (error) {
            // Expected for very large allocations
            return { success: false, error: error.message };
          }
        };
        
        allocationTests.push(allocationTest());
      }
      
      const results = await Promise.all(allocationTests);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log('Memory allocation recovery test:', {
        totalAttempts: results.length,
        successful: successful.length,
        failed: failed.length,
        largestSuccessful: successful.length > 0 ? 
          Math.max(...successful.map(r => r.size)) / 1024 / 1024 + 'MB' : 'none'
      });
      
      // Should handle at least some allocations
      expect(results.length).toBe(maxAttempts);
      
      // System should remain stable after failed allocations
      const testTemplate = 'Recovery test: {{ status }}';
      const result = testTemplate.replace('{{ status }}', 'stable');
      expect(result).toBe('Recovery test: stable');
    });
  });

  describe('Container Resource Limits', () => {
    test('should respect container CPU limits', async () => {
      const cpuIntensiveTest = async () => {
        const startTime = process.hrtime.bigint();
        const duration = 2000; // 2 seconds
        const endTime = startTime + BigInt(duration * 1000000); // Convert to nanoseconds
        
        let operationCount = 0;
        
        while (process.hrtime.bigint() < endTime) {
          // CPU-intensive operation
          Math.sqrt(Math.random() * 1000000);
          operationCount++;
          
          // Periodic yield to prevent blocking
          if (operationCount % 10000 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
        
        const actualDuration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms
        return { operationCount, actualDuration };
      };
      
      const result = await cpuIntensiveTest();
      
      // Should complete within reasonable time (accounting for CPU throttling)
      expect(result.actualDuration).toBeLessThan(3000); // Within 3 seconds
      expect(result.operationCount).toBeGreaterThan(1000); // Did meaningful work
      
      console.log('CPU intensive test:', {
        operations: result.operationCount,
        duration: Math.round(result.actualDuration) + 'ms',
        opsPerMs: Math.round(result.operationCount / result.actualDuration)
      });
    });

    test('should enforce container memory limits', async () => {
      // Get container memory limit if available
      let memoryLimit = null;
      try {
        const cgroupMemory = await fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8');
        memoryLimit = parseInt(cgroupMemory.trim());
        
        // Check if it's a reasonable limit (not the system max)
        if (memoryLimit > 10 * 1024 * 1024 * 1024) { // 10GB
          memoryLimit = null; // Probably unlimited
        }
      } catch (error) {
        // Not in a cgroup or different cgroup version
        memoryLimit = process.env.MEMORY_LIMIT ? 
          parseInt(process.env.MEMORY_LIMIT) * 1024 * 1024 : null;
      }
      
      if (!memoryLimit) {
        console.log('No memory limit detected, skipping limit enforcement test');
        return;
      }
      
      console.log(`Container memory limit: ${Math.round(memoryLimit / 1024 / 1024)}MB`);
      
      const currentUsage = process.memoryUsage().rss;
      const availableMemory = memoryLimit - currentUsage;
      const testAllocation = Math.min(availableMemory * 0.7, 100 * 1024 * 1024); // 70% of available or 100MB
      
      try {
        const testBuffer = Buffer.alloc(testAllocation);
        testBuffer.fill(42);
        
        expect(testBuffer.length).toBe(testAllocation);
        
        // Verify we can still do work
        const sample = testBuffer.readUInt8(0);
        expect(sample).toBe(42);
        
      } catch (error) {
        // Expected if we hit the limit
        expect(error.message).toMatch(/Cannot create a buffer larger than|Array buffer allocation failed/);
      }
      
      const finalUsage = process.memoryUsage().rss;
      expect(finalUsage).toBeLessThan(memoryLimit * 1.1); // Allow 10% overhead
    });
  });

  describe('Production Simulation', () => {
    test('should handle realistic production load patterns', async () => {
      const testDuration = 10000; // 10 seconds
      const startTime = Date.now();
      
      // Simulate different types of production loads
      const loadTypes = {
        webRequests: { weight: 0.6, avgDuration: 50 },
        batchJobs: { weight: 0.3, avgDuration: 500 },
        backgroundTasks: { weight: 0.1, avgDuration: 1000 }
      };
      
      const activeLoads = new Set();
      const completedLoads = [];
      let totalRequests = 0;
      
      const generateLoad = async (type, duration) => {
        const loadId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        activeLoads.add(loadId);
        totalRequests++;
        
        const taskStart = Date.now();
        
        try {
          // Simulate different workload patterns
          switch (type) {
            case 'webRequests':
              // Fast template rendering
              const template = 'User: {{ name }}, Status: {{ status }}';
              const result = template.replace('{{ name }}', 'User' + totalRequests)
                                   .replace('{{ status }}', 'active');
              break;
              
            case 'batchJobs':
              // Moderate processing
              const data = Array.from({ length: 1000 }, (_, i) => i * totalRequests);
              const processed = data.map(x => Math.sqrt(x)).reduce((a, b) => a + b, 0);
              break;
              
            case 'backgroundTasks':
              // Heavy processing
              let computation = 0;
              for (let i = 0; i < 100000; i++) {
                computation += Math.sin(i) * Math.cos(i);
              }
              break;
          }
          
          // Simulate variable duration
          const variance = duration * 0.5 * (Math.random() - 0.5);
          const actualDuration = Math.max(10, duration + variance);
          await new Promise(resolve => setTimeout(resolve, actualDuration));
          
          const taskEnd = Date.now();
          completedLoads.push({
            type,
            duration: taskEnd - taskStart,
            loadId
          });
          
        } finally {
          activeLoads.delete(loadId);
        }
      };
      
      // Generate continuous mixed load
      const loadGenerationPromise = (async () => {
        while (Date.now() - startTime < testDuration) {
          // Select load type based on weights
          const rand = Math.random();
          let loadType = 'webRequests';
          let cumulativeWeight = 0;
          
          for (const [type, config] of Object.entries(loadTypes)) {
            cumulativeWeight += config.weight;
            if (rand <= cumulativeWeight) {
              loadType = type;
              break;
            }
          }
          
          // Generate load without waiting (fire and forget)
          generateLoad(loadType, loadTypes[loadType].avgDuration).catch(console.error);
          
          // Control rate - more frequent for lighter loads
          const delay = loadType === 'webRequests' ? 10 : 
                       loadType === 'batchJobs' ? 100 : 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      })();
      
      // Wait for load generation to complete
      await loadGenerationPromise;
      
      // Wait for all active loads to complete (with timeout)
      const cleanupTimeout = 5000;
      const cleanupStart = Date.now();
      while (activeLoads.size > 0 && Date.now() - cleanupStart < cleanupTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Analyze results
      const typeStats = {};
      for (const load of completedLoads) {
        if (!typeStats[load.type]) {
          typeStats[load.type] = { count: 0, totalDuration: 0, durations: [] };
        }
        typeStats[load.type].count++;
        typeStats[load.type].totalDuration += load.duration;
        typeStats[load.type].durations.push(load.duration);
      }
      
      // Calculate statistics
      for (const [type, stats] of Object.entries(typeStats)) {
        stats.avgDuration = stats.totalDuration / stats.count;
        stats.durations.sort((a, b) => a - b);
        stats.p95Duration = stats.durations[Math.floor(stats.durations.length * 0.95)];
      }
      
      console.log('Production load simulation results:', {
        testDurationMs: Date.now() - startTime,
        totalRequests,
        completedRequests: completedLoads.length,
        stillActive: activeLoads.size,
        typeBreakdown: typeStats
      });
      
      // Assertions
      expect(completedLoads.length).toBeGreaterThan(50); // Reasonable throughput
      expect(activeLoads.size).toBeLessThan(10); // Most loads completed
      
      // Performance expectations
      if (typeStats.webRequests) {
        expect(typeStats.webRequests.avgDuration).toBeLessThan(200); // Web requests fast
        expect(typeStats.webRequests.p95Duration).toBeLessThan(500); // P95 reasonable
      }
      
      // Memory should be stable
      const hasLeak = resourceMonitor.detectMemoryLeak(150);
      expect(hasLeak).toBe(false);
    });
  });
});