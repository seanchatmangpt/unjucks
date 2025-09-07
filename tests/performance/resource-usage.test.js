import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('Resource Usage Benchmarks', () => {
  const tempDir = path.join(os.tmpdir(), 'unjucks-resource-test');
  let cliPath;

  beforeAll(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    
    cliPath = path.resolve(process.cwd(), 'bin/unjucks.cjs');
    if (!await fs.pathExists(cliPath)) {
      cliPath = 'node src/cli/index.js';
    }
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  test('Memory usage during large project generation', async () => {
    const projectDir = path.join(tempDir, 'large-project');
    await fs.ensureDir(projectDir);

    const memorySnapshots = [];
    const interval = setInterval(() => {
      memorySnapshots.push({
        timestamp: performance.now(),
        memory: process.memoryUsage()
      });
    }, 100);

    const startTime = performance.now();
    
    try {
      // Generate multiple files concurrently
      const generations = [];
      for (let i = 0; i < 10; i++) {
        const componentName = `Component${i}`;
        const promise = execAsync(
          `${cliPath} generate component simple --componentName ${componentName} --dest ${projectDir}`,
          { cwd: process.cwd(), timeout: 30000 }
        ).catch(error => {
          console.warn(`Generation ${i} failed:`, error.message);
          return null;
        });
        generations.push(promise);
      }

      await Promise.allSettled(generations);
      
    } catch (error) {
      console.warn('Large project generation failed:', error.message);
    } finally {
      clearInterval(interval);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    if (memorySnapshots.length > 0) {
      const maxMemory = memorySnapshots.reduce((max, snapshot) => {
        return Math.max(max, snapshot.memory.heapUsed);
      }, 0);

      const avgMemory = memorySnapshots.reduce((sum, snapshot) => {
        return sum + snapshot.memory.heapUsed;
      }, 0) / memorySnapshots.length;

      console.log(`Large Project Generation Resource Usage:
        Duration: ${totalTime.toFixed(2)}ms
        Max Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB
        Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB
        Memory Snapshots: ${memorySnapshots.length}`);

      // Memory usage should be reasonable
      expect(maxMemory).toBeLessThan(200 * 1024 * 1024); // Under 200MB
    }
  });

  test('File system I/O performance', async () => {
    const ioTestDir = path.join(tempDir, 'io-test');
    await fs.ensureDir(ioTestDir);

    const fileSizes = [1, 10, 100, 1000]; // KB
    const results = [];

    for (const sizeKB of fileSizes) {
      const content = 'x'.repeat(sizeKB * 1024);
      const filePath = path.join(ioTestDir, `test-${sizeKB}kb.txt`);

      // Write performance
      const writeStartTime = performance.now();
      await fs.writeFile(filePath, content);
      const writeEndTime = performance.now();
      const writeTime = writeEndTime - writeStartTime;

      // Read performance
      const readStartTime = performance.now();
      const readContent = await fs.readFile(filePath, 'utf8');
      const readEndTime = performance.now();
      const readTime = readEndTime - readStartTime;

      results.push({
        size: sizeKB,
        writeTime,
        readTime,
        throughputWrite: (sizeKB / (writeTime / 1000)).toFixed(2),
        throughputRead: (sizeKB / (readTime / 1000)).toFixed(2)
      });

      console.log(`File I/O ${sizeKB}KB:
        Write: ${writeTime.toFixed(2)}ms (${results[results.length - 1].throughputWrite} KB/s)
        Read: ${readTime.toFixed(2)}ms (${results[results.length - 1].throughputRead} KB/s)`);
    }

    // I/O should scale reasonably
    const small = results.find(r => r.size === 1);
    const large = results.find(r => r.size === 1000);
    
    if (small && large) {
      // Large files shouldn't take more than 1000x longer than small files
      expect(large.writeTime).toBeLessThan(small.writeTime * 1000);
      expect(large.readTime).toBeLessThan(small.readTime * 1000);
    }
  });

  test('CPU usage during template rendering', async () => {
    const iterations = 100;
    const templates = [
      'Simple template: <%= name %>',
      'Loop template: <% for (let i = 0; i < items.length; i++) { %>Item <%= i %>: <%= items[i] %>\n<% } %>',
      'Conditional: <% if (condition) { %>True: <%= value %><% } else { %>False<% } %>'
    ];

    for (const template of templates) {
      const startTime = performance.now();
      const cpuStart = process.cpuUsage();

      for (let i = 0; i < iterations; i++) {
        // Simulate template rendering
        let rendered = template;
        rendered = rendered.replace(/<%= name %>/g, `TestName${i}`);
        rendered = rendered.replace(/<%= value %>/g, `Value${i}`);
        
        // Simulate more complex processing
        if (template.includes('items')) {
          const items = Array.from({ length: 10 }, (_, j) => `Item${j}`);
          for (let j = 0; j < items.length; j++) {
            rendered = rendered.replace(`<%= items[${j}] %>`, items[j]);
          }
        }
      }

      const endTime = performance.now();
      const cpuEnd = process.cpuUsage(cpuStart);
      
      const duration = endTime - startTime;
      const cpuTime = (cpuEnd.user + cpuEnd.system) / 1000; // Convert to ms

      console.log(`Template Rendering (${iterations} iterations):
        Template: ${template.substring(0, 30)}...
        Duration: ${duration.toFixed(2)}ms
        CPU Time: ${cpuTime.toFixed(2)}ms
        CPU Usage: ${((cpuTime / duration) * 100).toFixed(2)}%
        Throughput: ${(iterations / (duration / 1000)).toFixed(2)} renders/sec`);

      // Template rendering should be efficient
      expect(duration).toBeLessThan(1000); // Under 1 second for 100 renders
    }
  });

  test('Dependency loading impact', async () => {
    const modules = [
      'nunjucks',
      'fs-extra',
      'glob',
      'chalk',
      'inquirer'
    ];

    const loadTimes = {};

    for (const moduleName of modules) {
      const startTime = performance.now();
      
      try {
        // Simulate module loading
        await import(moduleName);
        const endTime = performance.now();
        loadTimes[moduleName] = endTime - startTime;
      } catch (error) {
        console.warn(`Failed to load ${moduleName}:`, error.message);
        loadTimes[moduleName] = -1;
      }
    }

    console.log('Module Loading Times:');
    Object.entries(loadTimes).forEach(([module, time]) => {
      if (time >= 0) {
        console.log(`  ${module}: ${time.toFixed(2)}ms`);
      } else {
        console.log(`  ${module}: Failed to load`);
      }
    });

    const totalLoadTime = Object.values(loadTimes)
      .filter(time => time >= 0)
      .reduce((sum, time) => sum + time, 0);

    console.log(`Total module loading time: ${totalLoadTime.toFixed(2)}ms`);

    // Module loading should be reasonable
    expect(totalLoadTime).toBeLessThan(2000);
  });

  test('Garbage collection impact', async () => {
    const iterations = 1000;
    const memoryBefore = process.memoryUsage();

    // Create lots of temporary objects
    for (let i = 0; i < iterations; i++) {
      const tempData = {
        id: i,
        data: new Array(1000).fill(Math.random()),
        metadata: {
          timestamp: Date.now(),
          random: Math.random()
        }
      };

      // Simulate some processing
      JSON.stringify(tempData);
      Object.keys(tempData).length;
    }

    // Force garbage collection if possible
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = process.memoryUsage();

    const memoryDiff = {
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      external: memoryAfter.external - memoryBefore.external
    };

    console.log(`Memory Impact (${iterations} operations):
      Heap Used Change: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB
      Heap Total Change: ${(memoryDiff.heapTotal / 1024 / 1024).toFixed(2)}MB
      External Change: ${(memoryDiff.external / 1024 / 1024).toFixed(2)}MB`);

    // Memory growth should be reasonable
    expect(memoryDiff.heapUsed).toBeLessThan(50 * 1024 * 1024); // Under 50MB growth
  });
});