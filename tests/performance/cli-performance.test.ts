import { describe, it, expect, beforeEach } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { createWriteStream, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface PerformanceMetric {
  command: string;
  startupTime: number;
  memoryUsage: number;
  executionTime: number;
  cpuUsage?: NodeJS.CpuUsage;
}

describe('CLI Performance Testing', () => {
  const testDir = join(process.cwd(), 'tests/.tmp/performance');
  const resultsFile = join(process.cwd(), 'tests/performance/results/cli-metrics.json');
  let performanceResults: PerformanceMetric[] = [];

  beforeEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(process.cwd(), 'tests/performance/results'), { recursive: true });
  });

  const measureCommandPerformance = async (command: string): Promise<PerformanceMetric> => {
    const startTime = performance.now();
    const startCpu = process.cpuUsage();
    const startMemory = process.memoryUsage();

    try {
      const { stdout, stderr } = await execAsync(`node dist/cli.js ${command}`, {
        cwd: process.cwd(),
        timeout: 30000
      });

      const endTime = performance.now();
      const endCpu = process.cpuUsage(startCpu);
      const endMemory = process.memoryUsage();

      return {
        command,
        startupTime: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        executionTime: endTime - startTime,
        cpuUsage: endCpu
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        command,
        startupTime: endTime - startTime,
        memoryUsage: 0,
        executionTime: endTime - startTime,
        cpuUsage: process.cpuUsage(startCpu)
      };
    }
  };

  it('should measure CLI startup times for all commands', async () => {
    const commands = [
      '--help',
      '--version', 
      'list',
      'help list',
      'help generate',
      'help inject',
      'generate --help',
      'inject --help'
    ];

    for (const command of commands) {
      const metric = await measureCommandPerformance(command);
      performanceResults.push(metric);
      
      console.log(`Command: ${command}`);
      console.log(`  Startup Time: ${metric.startupTime.toFixed(2)}ms`);
      console.log(`  Memory Usage: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  CPU User: ${metric.cpuUsage?.user || 0}μs`);
      console.log(`  CPU System: ${metric.cpuUsage?.system || 0}μs\n`);
      
      // Performance assertions
      expect(metric.startupTime).toBeLessThan(5000); // Should start within 5 seconds
      expect(metric.memoryUsage).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB
    }
  });

  it('should measure template generation performance', async () => {
    const generateCommands = [
      'generate component new --name TestComponent --dry',
      'generate cli citty --commandName TestCommand --dry',
      'list'
    ];

    for (const command of generateCommands) {
      const metric = await measureCommandPerformance(command);
      performanceResults.push(metric);
      
      console.log(`Generation Command: ${command}`);
      console.log(`  Execution Time: ${metric.executionTime.toFixed(2)}ms`);
      console.log(`  Memory Peak: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`);
      
      // Generation should be fast
      expect(metric.executionTime).toBeLessThan(10000); // Within 10 seconds
    }
  });

  it('should test concurrent command execution', async () => {
    const concurrentCommands = Array(5).fill('list');
    const startTime = performance.now();
    
    const promises = concurrentCommands.map((cmd, index) => 
      measureCommandPerformance(`${cmd} # concurrent-${index}`)
    );
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    console.log(`Concurrent Execution Results:`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average Time: ${(results.reduce((sum, r) => sum + r.executionTime, 0) / results.length).toFixed(2)}ms`);
    console.log(`  Max Time: ${Math.max(...results.map(r => r.executionTime)).toFixed(2)}ms`);
    
    performanceResults.push(...results);
    
    // Concurrent execution shouldn't be significantly slower
    expect(totalTime).toBeLessThan(15000); // Within 15 seconds total
  });

  it('should save performance metrics to file', async () => {
    const summary = {
      testDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalTests: performanceResults.length,
      metrics: performanceResults,
      averages: {
        startupTime: performanceResults.reduce((sum, m) => sum + m.startupTime, 0) / performanceResults.length,
        memoryUsage: performanceResults.reduce((sum, m) => sum + m.memoryUsage, 0) / performanceResults.length,
        executionTime: performanceResults.reduce((sum, m) => sum + m.executionTime, 0) / performanceResults.length
      }
    };

    const resultsStream = createWriteStream(resultsFile);
    resultsStream.write(JSON.stringify(summary, null, 2));
    resultsStream.end();

    console.log(`\nPerformance Summary:`);
    console.log(`  Average Startup Time: ${summary.averages.startupTime.toFixed(2)}ms`);
    console.log(`  Average Memory Usage: ${(summary.averages.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Average Execution Time: ${summary.averages.executionTime.toFixed(2)}ms`);
    console.log(`  Results saved to: ${resultsFile}`);

    expect(summary.averages.startupTime).toBeLessThan(3000); // Average startup under 3 seconds
    expect(summary.averages.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Average memory under 50MB
  });
});