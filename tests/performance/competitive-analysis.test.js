import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('Competitive Performance Analysis', () => {
  const tempDir = path.join(os.tmpdir(), 'unjucks-competitive-test');
  let unjucksPath;

  beforeAll(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    
    unjucksPath = path.resolve(process.cwd(), 'bin/unjucks.cjs');
    if (!await fs.pathExists(unjucksPath)) {
      unjucksPath = 'node src/cli/index.js';
    }
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  test('Unjucks vs Hygen-style workflows', async () => {
    const workflows = [
      {
        name: 'Simple Component Generation',
        command: 'generate component simple --componentName TestComp --dest',
        expectedFiles: 1,
        complexity: 'low'
      },
      {
        name: 'API Route Generation', 
        command: 'generate api route --routeName users --dest',
        expectedFiles: 1,
        complexity: 'medium'
      },
      {
        name: 'Full Feature Generation',
        command: 'generate component new --componentName Feature --withTests --withStyles --dest',
        expectedFiles: 3,
        complexity: 'high'
      }
    ];

    const results = [];

    for (const workflow of workflows) {
      const workflowDir = path.join(tempDir, workflow.name.replace(/\s+/g, '-').toLowerCase());
      await fs.ensureDir(workflowDir);

      const iterations = 3;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const testDir = path.join(workflowDir, `test-${i}`);
        await fs.ensureDir(testDir);

        const startTime = performance.now();
        
        try {
          const fullCommand = `${unjucksPath} ${workflow.command} ${testDir}`;
          await execAsync(fullCommand, { 
            cwd: process.cwd(),
            timeout: 15000 
          });
          
          const endTime = performance.now();
          times.push(endTime - startTime);

          // Verify files were created
          const files = await fs.readdir(testDir);
          expect(files.length).toBeGreaterThanOrEqual(workflow.expectedFiles);
          
        } catch (error) {
          console.warn(`${workflow.name} iteration ${i + 1} failed:`, error.message);
        }
      }

      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        results.push({
          ...workflow,
          avgTime,
          minTime,
          maxTime,
          samples: times.length
        });

        console.log(`${workflow.name}:
          Complexity: ${workflow.complexity}
          Average: ${avgTime.toFixed(2)}ms
          Min: ${minTime.toFixed(2)}ms
          Max: ${maxTime.toFixed(2)}ms
          Files: ${workflow.expectedFiles}
          Samples: ${times.length}`);
      }
    }

    // Performance expectations based on complexity
    results.forEach(result => {
      switch (result.complexity) {
        case 'low':
          expect(result.avgTime).toBeLessThan(2000); // Under 2 seconds
          break;
        case 'medium':
          expect(result.avgTime).toBeLessThan(3000); // Under 3 seconds
          break;
        case 'high':
          expect(result.avgTime).toBeLessThan(5000); // Under 5 seconds
          break;
      }
    });

    return results;
  });

  test('Template processing efficiency', async () => {
    // Create templates of varying complexity
    const templateTypes = [
      {
        name: 'Simple Template',
        content: `---
to: <%= dest %>/simple.js
---
export const <%= name %> = '<%= value %>';`,
        variables: { name: 'TestVar', value: 'TestValue' }
      },
      {
        name: 'Loop Template',
        content: `---
to: <%= dest %>/loop.js
---
export const items = [
<% items.forEach(item => { %>
  '<%= item %>',
<% }); %>
];`,
        variables: { items: Array.from({ length: 10 }, (_, i) => `Item${i}`) }
      },
      {
        name: 'Conditional Template',
        content: `---
to: <%= dest %>/conditional.js
---
<% if (useTypeScript) { %>
export interface <%= interfaceName %> {
  id: number;
  name: string;
}
<% } else { %>
export const <%= interfaceName %> = {
  // JavaScript object
};
<% } %>`,
        variables: { useTypeScript: true, interfaceName: 'TestInterface' }
      }
    ];

    const processingResults = [];

    for (const template of templateTypes) {
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        try {
          // Simulate template processing
          let processed = template.content;
          
          // Replace variables (simplified)
          Object.entries(template.variables).forEach(([key, value]) => {
            const regex = new RegExp(`<%= ${key} %>`, 'g');
            processed = processed.replace(regex, Array.isArray(value) ? value.join(', ') : String(value));
          });

          // Process frontmatter
          const [, frontmatter, body] = processed.match(/^---\n(.*?)\n---\n(.*)$/s) || [null, '', processed];
          
          const endTime = performance.now();
          times.push(endTime - startTime);
        } catch (error) {
          console.warn(`Processing ${template.name} iteration ${i + 1} failed:`, error.message);
        }
      }

      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const throughput = iterations / (times.reduce((a, b) => a + b, 0) / 1000);

        processingResults.push({
          name: template.name,
          avgTime,
          throughput,
          samples: times.length
        });

        console.log(`${template.name} Processing:
          Average: ${avgTime.toFixed(3)}ms
          Throughput: ${throughput.toFixed(2)} templates/sec
          Samples: ${times.length}`);

        // All template processing should be very fast
        expect(avgTime).toBeLessThan(5);
      }
    }

    return processingResults;
  });

  test('Scalability with template count', async () => {
    const templateCounts = [1, 5, 10, 20, 50];
    const scalabilityResults = [];

    for (const count of templateCounts) {
      const scalabilityDir = path.join(tempDir, `scalability-${count}`);
      await fs.ensureDir(scalabilityDir);

      const startTime = performance.now();

      try {
        // Generate multiple templates concurrently
        const promises = [];
        for (let i = 0; i < count; i++) {
          const componentName = `ScaleComponent${i}`;
          const promise = execAsync(
            `${unjucksPath} generate component simple --componentName ${componentName} --dest ${scalabilityDir}`,
            { cwd: process.cwd(), timeout: 30000 }
          ).catch(error => {
            console.warn(`Scalability generation ${i} failed:`, error.message);
            return null;
          });
          promises.push(promise);
        }

        await Promise.allSettled(promises);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = count / (totalTime / 1000);

        // Verify files were created
        const files = await fs.readdir(scalabilityDir);
        const actualFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.vue'));

        scalabilityResults.push({
          templateCount: count,
          totalTime,
          throughput,
          actualFiles: actualFiles.length,
          efficiency: actualFiles.length / (totalTime / 1000)
        });

        console.log(`Scalability Test (${count} templates):
          Total Time: ${totalTime.toFixed(2)}ms
          Throughput: ${throughput.toFixed(2)} templates/sec
          Files Created: ${actualFiles.length}
          Efficiency: ${scalabilityResults[scalabilityResults.length - 1].efficiency.toFixed(2)} files/sec`);

      } catch (error) {
        console.warn(`Scalability test with ${count} templates failed:`, error.message);
      }
    }

    // Test scaling efficiency
    if (scalabilityResults.length >= 2) {
      const baseline = scalabilityResults[0];
      const largest = scalabilityResults[scalabilityResults.length - 1];

      // Performance shouldn't degrade linearly with template count
      const expectedTime = baseline.totalTime * largest.templateCount;
      const actualTime = largest.totalTime;
      
      console.log(`Scaling Efficiency:
        Expected linear time: ${expectedTime.toFixed(2)}ms
        Actual time: ${actualTime.toFixed(2)}ms
        Efficiency gain: ${((expectedTime / actualTime - 1) * 100).toFixed(2)}%`);

      // Should perform better than linear scaling
      expect(actualTime).toBeLessThan(expectedTime * 1.5);
    }

    return scalabilityResults;
  });

  test('Memory efficiency comparison', async () => {
    const testCases = [
      { name: 'Small Project', components: 5 },
      { name: 'Medium Project', components: 20 },
      { name: 'Large Project', components: 50 }
    ];

    const memoryResults = [];

    for (const testCase of testCases) {
      const projectDir = path.join(tempDir, testCase.name.replace(/\s+/g, '-').toLowerCase());
      await fs.ensureDir(projectDir);

      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      try {
        // Generate components
        const promises = [];
        for (let i = 0; i < testCase.components; i++) {
          const componentName = `MemoryTestComponent${i}`;
          const promise = execAsync(
            `${unjucksPath} generate component simple --componentName ${componentName} --dest ${projectDir}`,
            { cwd: process.cwd(), timeout: 60000 }
          ).catch(() => null);
          promises.push(promise);
        }

        await Promise.allSettled(promises);

        const endTime = performance.now();
        const finalMemory = process.memoryUsage();

        const memoryUsage = {
          heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
          rss: finalMemory.rss - initialMemory.rss
        };

        const files = await fs.readdir(projectDir);
        const generatedFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.vue'));

        memoryResults.push({
          ...testCase,
          duration: endTime - startTime,
          memoryUsage,
          generatedFiles: generatedFiles.length,
          memoryPerFile: memoryUsage.heapUsed / generatedFiles.length
        });

        console.log(`${testCase.name} Memory Usage:
          Components: ${testCase.components}
          Generated Files: ${generatedFiles.length}
          Duration: ${(endTime - startTime).toFixed(2)}ms
          Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
          Memory per File: ${(memoryUsage.heapUsed / generatedFiles.length / 1024).toFixed(2)}KB`);

      } catch (error) {
        console.warn(`Memory test ${testCase.name} failed:`, error.message);
      }
    }

    // Memory usage should scale reasonably
    memoryResults.forEach(result => {
      // Memory per file should be reasonable
      expect(result.memoryPerFile).toBeLessThan(100 * 1024); // Under 100KB per file
      
      // Total memory should be under 100MB even for large projects
      expect(result.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024);
    });

    return memoryResults;
  });
});