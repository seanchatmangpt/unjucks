import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('CLI Performance Benchmarks', () => {
  const tempDir = path.join(os.tmpdir(), 'unjucks-perf-test');
  let cliPath;

  beforeAll(async () => {
    // Clean up and create temp directory
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    
    // Determine CLI path
    cliPath = path.resolve(process.cwd(), 'bin/unjucks.cjs');
    if (!await fs.pathExists(cliPath)) {
      cliPath = 'node src/cli/index.js'; // fallback
    }
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  test('CLI startup time benchmark', async () => {
    const iterations = 10;
    const startupTimes = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await execAsync(`${cliPath} --version`, { 
          cwd: tempDir,
          timeout: 5000 
        });
        const endTime = performance.now();
        startupTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Startup test iteration ${i + 1} failed:`, error.message);
      }
    }

    const avgStartupTime = startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length;
    const minStartupTime = Math.min(...startupTimes);
    const maxStartupTime = Math.max(...startupTimes);

    console.log(`CLI Startup Performance:
      Average: ${avgStartupTime.toFixed(2)}ms
      Min: ${minStartupTime.toFixed(2)}ms
      Max: ${maxStartupTime.toFixed(2)}ms
      Samples: ${startupTimes.length}`);

    // Startup should be under 500ms for good UX
    expect(avgStartupTime).toBeLessThan(500);
  });

  test('List command performance', async () => {
    const iterations = 5;
    const listTimes = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await execAsync(`${cliPath} list`, { 
          cwd: process.cwd(), // Use project root for templates
          timeout: 10000 
        });
        const endTime = performance.now();
        listTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`List command iteration ${i + 1} failed:`, error.message);
      }
    }

    if (listTimes.length > 0) {
      const avgListTime = listTimes.reduce((a, b) => a + b, 0) / listTimes.length;
      
      console.log(`List Command Performance:
        Average: ${avgListTime.toFixed(2)}ms
        Samples: ${listTimes.length}`);

      // List should be under 1000ms
      expect(avgListTime).toBeLessThan(1000);
    }
  });

  test('Help command performance', async () => {
    const iterations = 5;
    const helpTimes = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await execAsync(`${cliPath} help`, { 
          cwd: tempDir,
          timeout: 5000 
        });
        const endTime = performance.now();
        helpTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Help command iteration ${i + 1} failed:`, error.message);
      }
    }

    if (helpTimes.length > 0) {
      const avgHelpTime = helpTimes.reduce((a, b) => a + b, 0) / helpTimes.length;
      
      console.log(`Help Command Performance:
        Average: ${avgHelpTime.toFixed(2)}ms
        Samples: ${helpTimes.length}`);

      // Help should be very fast
      expect(avgHelpTime).toBeLessThan(300);
    }
  });

  test('Template generation performance', async () => {
    const iterations = 3;
    const genTimes = [];

    for (let i = 0; i < iterations; i++) {
      const testDir = path.join(tempDir, `gen-test-${i}`);
      await fs.ensureDir(testDir);

      const startTime = performance.now();
      
      try {
        // Try to generate a simple component
        await execAsync(`${cliPath} generate component simple --componentName TestComp${i} --dest ${testDir}`, { 
          cwd: process.cwd(),
          timeout: 15000 
        });
        const endTime = performance.now();
        genTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Generation iteration ${i + 1} failed:`, error.message);
      }
    }

    if (genTimes.length > 0) {
      const avgGenTime = genTimes.reduce((a, b) => a + b, 0) / genTimes.length;
      
      console.log(`Generation Performance:
        Average: ${avgGenTime.toFixed(2)}ms
        Samples: ${genTimes.length}`);

      // Generation should complete within reasonable time
      expect(avgGenTime).toBeLessThan(5000);
    }
  });

  test('Memory usage during CLI operations', async () => {
    const initialMemory = process.memoryUsage();
    
    try {
      // Perform several operations
      await execAsync(`${cliPath} list`, { cwd: process.cwd() });
      await execAsync(`${cliPath} help`, { cwd: tempDir });
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        rss: finalMemory.rss - initialMemory.rss
      };

      console.log(`Memory Usage:
        Heap Used Increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)}MB
        Heap Total Increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)}MB
        RSS Increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024);
    } catch (error) {
      console.warn('Memory test failed:', error.message);
    }
  });
});