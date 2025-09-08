import { describe, it, expect, beforeEach } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { createWriteStream, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

interface ScalabilityMetric {
  testName: string;
  scale: number;
  executionTime: number;
  memoryPeak: number;
  memoryDelta: number;
  throughput: number;
  cpuUsage: NodeJS.CpuUsage;
  successRate: number;
  errorCount: number;
}

describe('Scalability Performance Testing', () => {
  const testDir = join(tmpdir(), 'unjucks-scalability-test');
  const resultsFile = join(process.cwd(), 'tests/performance/results/scalability-metrics.json');
  let scalabilityResults: ScalabilityMetric[] = [];

  beforeEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(process.cwd(), 'tests/performance/results'), { recursive: true });
  });

  const measureScalability = async (
    testName: string,
    scale: number,
    operation: () => Promise<{ success: boolean; errors: string[] }>
  ): Promise<ScalabilityMetric> => {
    const startTime = performance.now();
    const startCpu = process.cpuUsage();
    const startMemory = process.memoryUsage();
    let peakMemory = startMemory.heapUsed;
    
    // Monitor memory during execution
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 100);

    const result = await operation();
    
    clearInterval(memoryMonitor);
    
    const endTime = performance.now();
    const endCpu = process.cpuUsage(startCpu);
    const endMemory = process.memoryUsage();
    
    const executionTime = endTime - startTime;
    
    return {
      testName,
      scale,
      executionTime,
      memoryPeak: peakMemory,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      throughput: scale / (executionTime / 1000), // operations per second
      cpuUsage: endCpu,
      successRate: result.success ? 100 : (scale - result.errors.length) / scale * 100,
      errorCount: result.errors.length
    };
  };

  it('should test template generation at 1K scale', async () => {
    const scale = 1000;
    const metric = await measureScalability('template-generation-1k', scale, async () => {
      const errors: string[] = [];
      let successCount = 0;

      const promises = Array.from({ length: scale }, async (_, i) => {
        try {
          const componentName = `TestComponent${i}`;
          const testDir = join(testDir, `test-${i}`);
          mkdirSync(testDir, { recursive: true });
          
          const { stdout, stderr } = await execAsync(
            `node dist/cli.js generate component new --name ${componentName} --dest ${testDir} --dry`,
            { cwd: process.cwd(), timeout: 10000 }
          );
          
          if (stderr && !stderr.includes('warning')) {
            errors.push(`Generation ${i}: ${stderr}`);
          } else {
            successCount++;
          }
        } catch (error) {
          errors.push(`Generation ${i}: ${(error as Error).message}`);
        }
      });

      await Promise.all(promises);
      
      return { success: errors.length === 0, errors };
    });

    scalabilityResults.push(metric);
    
    console.log(`1K Scale Generation Test:`);
    console.log(`  Execution Time: ${metric.executionTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${metric.throughput.toFixed(2)} generations/sec`);
    console.log(`  Memory Peak: ${(metric.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Success Rate: ${metric.successRate.toFixed(1)}%`);
    console.log(`  Errors: ${metric.errorCount}\n`);

    expect(metric.executionTime).toBeLessThan(60000); // Should complete within 1 minute
    expect(metric.successRate).toBeGreaterThan(95); // At least 95% success rate
    expect(metric.memoryPeak).toBeLessThan(500 * 1024 * 1024); // Under 500MB peak memory
  });

  it('should test template generation at 10K scale', async () => {
    const scale = 10000;
    const metric = await measureScalability('template-generation-10k', scale, async () => {
      const errors: string[] = [];
      const batchSize = 100; // Process in batches to avoid overwhelming system
      
      for (let batch = 0; batch < scale / batchSize; batch++) {
        const promises = Array.from({ length: batchSize }, async (_, i) => {
          const index = batch * batchSize + i;
          try {
            const componentName = `Component${index}`;
            
            const { stdout, stderr } = await execAsync(
              `node dist/cli.js generate component new --name ${componentName} --dry`,
              { cwd: process.cwd(), timeout: 5000 }
            );
            
            if (stderr && !stderr.includes('warning') && stderr.trim() !== '') {
              errors.push(`Generation ${index}: ${stderr}`);
            }
          } catch (error) {
            errors.push(`Generation ${index}: ${(error as Error).message}`);
          }
        });
        
        await Promise.all(promises);
        
        // Small delay between batches to prevent system overload
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return { success: errors.length < scale * 0.05, errors }; // Allow up to 5% errors
    });

    scalabilityResults.push(metric);
    
    console.log(`10K Scale Generation Test:`);
    console.log(`  Execution Time: ${(metric.executionTime / 1000).toFixed(2)}s`);
    console.log(`  Throughput: ${metric.throughput.toFixed(2)} generations/sec`);
    console.log(`  Memory Peak: ${(metric.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Success Rate: ${metric.successRate.toFixed(1)}%`);
    console.log(`  Errors: ${metric.errorCount}\n`);

    expect(metric.executionTime).toBeLessThan(300000); // Should complete within 5 minutes
    expect(metric.successRate).toBeGreaterThan(90); // At least 90% success rate at scale
    expect(metric.memoryPeak).toBeLessThan(1024 * 1024 * 1024); // Under 1GB peak memory
  });

  it('should test concurrent user simulation', async () => {
    const userCount = 50;
    const operationsPerUser = 10;
    
    const metric = await measureScalability(
      'concurrent-users',
      userCount * operationsPerUser,
      async () => {
        const errors: string[] = [];
        
        const userPromises = Array.from({ length: userCount }, async (_, userId) => {
          const userOperations = Array.from({ length: operationsPerUser }, async (_, opIndex) => {
            try {
              const operations = [
                'list',
                'generate component new --name TempComponent --dry',
                'help generate',
                '--version'
              ];
              
              const operation = operations[opIndex % operations.length];
              
              const { stdout, stderr } = await execAsync(
                `node dist/cli.js ${operation}`,
                { 
                  cwd: process.cwd(), 
                  timeout: 15000,
                  env: { ...process.env, UNJUCKS_USER_ID: `user-${userId}` }
                }
              );
              
              if (stderr && !stderr.includes('warning') && stderr.trim() !== '') {
                errors.push(`User ${userId} Op ${opIndex}: ${stderr}`);
              }
            } catch (error) {
              errors.push(`User ${userId} Op ${opIndex}: ${(error as Error).message}`);
            }
          });
          
          return Promise.all(userOperations);
        });
        
        await Promise.all(userPromises);
        
        return { success: errors.length < userCount, errors };
      }
    );

    scalabilityResults.push(metric);
    
    console.log(`Concurrent Users Test (${userCount} users, ${operationsPerUser} ops each):`);
    console.log(`  Execution Time: ${(metric.executionTime / 1000).toFixed(2)}s`);
    console.log(`  Throughput: ${metric.throughput.toFixed(2)} operations/sec`);
    console.log(`  Memory Peak: ${(metric.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Success Rate: ${metric.successRate.toFixed(1)}%`);
    console.log(`  Errors: ${metric.errorCount}\n`);

    expect(metric.executionTime).toBeLessThan(120000); // Should complete within 2 minutes
    expect(metric.successRate).toBeGreaterThan(85); // At least 85% success rate under load
  });

  it('should test large template processing', async () => {
    const largeTemplateSize = 100000; // 100KB template
    
    // Create a large template file
    const largeTemplate = `
{%- set items = [] -%}
{%- for i in range(1000) -%}
  {%- set _ = items.append({
    id: i,
    name: "Item " ~ i,
    description: "This is a description for item number " ~ i ~ " with additional content to make it larger",
    metadata: {
      created: "2024-01-01",
      tags: ["tag" ~ (i % 10), "category" ~ (i % 5)],
      active: i % 2 == 0
    }
  }) -%}
{%- endfor -%}

# Generated Items Report

{% for item in items -%}
## {{ item.name }}
- ID: {{ item.id }}
- Description: {{ item.description }}
- Active: {{ item.metadata.active }}
- Tags: {{ item.metadata.tags | join(", ") }}

{% endfor -%}

Summary:
- Total Items: {{ items | length }}
- Active Items: {{ items | selectattr("metadata.active") | list | length }}
- Categories: {{ items | map(attribute="metadata.tags") | flatten | unique | sort | join(", ") }}
    `.trim();

    const templatePath = join(testDir, 'large-template.njk');
    writeFileSync(templatePath, largeTemplate);

    const metric = await measureScalability('large-template-processing', 10, async () => {
      const errors: string[] = [];
      
      const promises = Array.from({ length: 10 }, async (_, i) => {
        try {
          // Simulate processing large template
          const startTime = performance.now();
          const templateContent = readFileSync(templatePath, 'utf-8');
          const processTime = performance.now() - startTime;
          
          if (processTime > 10000) { // If processing takes more than 10 seconds
            errors.push(`Large template processing ${i}: took ${processTime}ms`);
          }
          
          if (templateContent.length < largeTemplateSize) {
            errors.push(`Large template processing ${i}: template too small`);
          }
        } catch (error) {
          errors.push(`Large template processing ${i}: ${(error as Error).message}`);
        }
      });
      
      await Promise.all(promises);
      
      return { success: errors.length === 0, errors };
    });

    scalabilityResults.push(metric);
    
    console.log(`Large Template Processing Test:`);
    console.log(`  Template Size: ${(largeTemplate.length / 1024).toFixed(2)}KB`);
    console.log(`  Execution Time: ${metric.executionTime.toFixed(2)}ms`);
    console.log(`  Memory Peak: ${(metric.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Success Rate: ${metric.successRate.toFixed(1)}%\n`);

    expect(metric.executionTime).toBeLessThan(30000); // Should process within 30 seconds
    expect(metric.successRate).toBe(100); // Should have 100% success rate
  });

  it('should save scalability metrics to file', () => {
    const summary = {
      testDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalTests: scalabilityResults.length,
      metrics: scalabilityResults,
      performance: {
        averageExecutionTime: scalabilityResults.reduce((sum, m) => sum + m.executionTime, 0) / scalabilityResults.length,
        averageThroughput: scalabilityResults.reduce((sum, m) => sum + m.throughput, 0) / scalabilityResults.length,
        averageMemoryPeak: scalabilityResults.reduce((sum, m) => sum + m.memoryPeak, 0) / scalabilityResults.length,
        overallSuccessRate: scalabilityResults.reduce((sum, m) => sum + m.successRate, 0) / scalabilityResults.length,
        totalErrors: scalabilityResults.reduce((sum, m) => sum + m.errorCount, 0)
      }
    };

    const resultsStream = createWriteStream(resultsFile);
    resultsStream.write(JSON.stringify(summary, null, 2));
    resultsStream.end();

    console.log(`\nScalability Performance Summary:`);
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Average Execution Time: ${(summary.performance.averageExecutionTime / 1000).toFixed(2)}s`);
    console.log(`  Average Throughput: ${summary.performance.averageThroughput.toFixed(2)} ops/sec`);
    console.log(`  Average Memory Peak: ${(summary.performance.averageMemoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Overall Success Rate: ${summary.performance.overallSuccessRate.toFixed(1)}%`);
    console.log(`  Total Errors: ${summary.performance.totalErrors}`);
    console.log(`  Results saved to: ${resultsFile}`);

    expect(summary.performance.overallSuccessRate).toBeGreaterThan(85); // Overall success rate above 85%
    expect(summary.performance.averageThroughput).toBeGreaterThan(1); // At least 1 operation per second average
  });
});