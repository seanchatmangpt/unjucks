import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { Generator } from '../../src/lib/generator.js';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import { GeneratorFactory, TemplateFactory, FileFactory } from '../factories/index.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock heavy dependencies for controlled testing
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

describe('Load Testing', () => {
  let generator;
  let scanner;
  let parser;
  let injector;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `unjucks-load-test-${Date.now()}`);
    generator = new Generator(testDir);
    scanner = new TemplateScanner();
    parser = new FrontmatterParser();
    injector = new FileInjector();

    // Setup common mocks
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.ensureDir.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('mock content');
    mockFs.readdir.mockResolvedValue(['template.njk']);
    mockFs.stat.mockResolvedValue({ isDirectory: () => false });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Template Generation Load Tests', () => { it('should handle 100 concurrent template generations', async () => {
      const generationTasks = Array.from({ length, (_, i) => 
        GeneratorFactory.createGenerateOptions({
          generator });

      // Should complete within reasonable time (10 seconds for 100 generations)
      expect(duration).toBeLessThan(10000);
      
      // Log performance metrics
      console.log(`100 concurrent generations completed in ${duration.toFixed(2)}ms`);
      console.log(`Average).toFixed(2)}ms per generation`);
    });

    it('should handle large template files efficiently', async () => { const largeTemplate = TemplateFactory.createLargeTemplate(10000); // 10k lines
      mockFs.readFile.mockResolvedValue(largeTemplate);

      const options = GeneratorFactory.createGenerateOptions({
        generator });

      const startTime = performance.now();
      const result = await generator.generate(options);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.files).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should process large template in under 5 seconds

      console.log(`Large template (10k lines) processed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain performance with many template variables', async () => { const manyVariables = GeneratorFactory.createVariables(200); // 200 variables
      
      const options = GeneratorFactory.createGenerateOptions({
        variables });

      const startTime = performance.now();
      const result = await generator.generate(options);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.files).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should handle many variables efficiently

      console.log(`Generation with 200 variables completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Template Scanning Load Tests', () => { it('should scan large directory structures quickly', async () => {
      // Mock large directory structure
      const fileCount = 1000;
      const files = Array.from({ length }, (_, i) => `template${i}.njk`);
      
      mockFs.readdir.mockResolvedValue(files);
      mockFs.readFile.mockImplementation((filePath) => {
        const index = parseInt(path.basename(filePath).match(/\d+/)?.[0] || '0');
        return Promise.resolve(`Template ${index});
      });

      const startTime = performance.now();
      const result = await scanner.scanTemplate('/large/template/dir');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.variables).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should scan 1000 templates in under 5 seconds

      console.log(`Scanned ${fileCount} templates in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent scanning operations', async () => {
      const scanTasks = Array.from({ length, (_, i) => 
        `/template/dir${i}`
      );

      mockFs.readFile.mockResolvedValue('{{ name }} {{ description }}');

      const startTime = performance.now();
      
      const results = await Promise.all(
        scanTasks.map(templatePath => scanner.scanTemplate(templatePath))
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.variables).toBeDefined();
      });

      expect(duration).toBeLessThan(3000); // Should complete concurrent scans quickly

      console.log(`50 concurrent scans completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('File Injection Load Tests', () => { it('should handle bulk file injections efficiently', async () => {
      const injectionTasks = Array.from({ length, (_, i) => ({
        filePath }.ts`,
        content: `const value${i} = ${i};`,
        options)
      }));

      mockFs.readFile.mockImplementation((filePath) => {
        const fileIndex = parseInt(path.basename(filePath).match(/\d+/)?.[0] || '0');
        return Promise.resolve(`// File ${fileIndex}\nexport const existing = true;`);
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        injectionTasks.map(({ filePath, content, options }) =>
          injector.inject(filePath, content, options)
        )
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(200);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(duration).toBeLessThan(8000); // Should complete 200 injections in under 8 seconds

      console.log(`200 file injections completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle large file injections without memory issues', async () => { const largeContent = 'Very long content line\n'.repeat(50000); // ~1MB content
      const injectionContent = 'Injected content';

      mockFs.readFile.mockResolvedValue(largeContent);

      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed;
      
      const result = await injector.inject('/large/file.txt', injectionContent, { 
        append });
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should handle large files quickly
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // Should not use excessive memory (50MB limit)

      console.log(`Large file injection (1MB) completed in ${duration.toFixed(2)}ms`);
      console.log(`Memory usage).toFixed(2)}MB`);
    });
  });

  describe('Frontmatter Parsing Load Tests', () => { it('should parse many frontmatter blocks quickly', async () => {
      const templates = Array.from({ length, (_, i) => {
        const frontmatter = TemplateFactory.createFrontmatter({
          to }.ts`,
          inject: i % 2 === 0,
          skipIf);

        return `---
to: ${frontmatter.to}
inject: ${frontmatter.inject}
skipIf: ${frontmatter.skipIf}
---
Template content ${i}`;
      });

      const startTime = performance.now();
      
      const results = templates.map(template => parser.parse(template));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(1000);
      results.forEach((result, i) => {
        expect(result.frontmatter.to).toBe(`src/component${i}.ts`);
      });

      expect(duration).toBeLessThan(2000); // Should parse 1000 frontmatters in under 2 seconds

      console.log(`1000 frontmatter blocks parsed in ${duration.toFixed(2)}ms`);
    });

    it('should handle complex frontmatter structures efficiently', async () => { const complexTemplates = Array.from({ length, (_, i) => {
        const complexFrontmatter = {
          to }.ts`,
          inject,
          before: 'import statement',
          after: 'export statement',
          variables: Object.fromEntries(
            Array.from({ length, (_, j) => [`var${j}`, `value${j}`])
          ),
          conditions: Array.from({ length, (_, k) => `condition${k}`),
          metadata: { author }`)
          }
        };

        return `---
${Object.entries(complexFrontmatter)
  .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  .join('\n')}
---
Complex template content ${i}`;
      });

      const startTime = performance.now();
      
      const results = complexTemplates.map(template => parser.parse(template));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.frontmatter.variables).toBeDefined();
        expect(result.frontmatter.conditions).toBeDefined();
        expect(result.frontmatter.metadata).toBeDefined();
      });

      expect(duration).toBeLessThan(3000); // Should handle complex structures efficiently

      console.log(`100 complex frontmatter blocks parsed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('System Resource Tests', () => {
    it('should not exceed memory limits under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate many components with large data
      const tasks = Array.from({ length, (_, i) =>
        generator.generate(GeneratorFactory.createGenerateOptions({
          variables) // 50 variables each
        }))
      );

      await Promise.all(tasks);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Should not increase memory usage by more than 100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`Memory increase).toFixed(2)}MB`);
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      const cpuIntensiveTasks = Array.from({ length, (_, i) => async () => { // Simulate CPU-intensive template processing
        const largeTemplate = TemplateFactory.createLargeTemplate(2000);
        const complexVariables = GeneratorFactory.createVariables(100);
        
        mockFs.readFile.mockResolvedValue(largeTemplate);
        
        return generator.generate(GeneratorFactory.createGenerateOptions({
          variables }));
      });

      const startTime = performance.now();
      
      // Run tasks with limited concurrency to prevent overwhelming the system
      const batchSize = Math.min(10, os.cpus().length);
      const results = [];
      
      for (let i = 0; i < cpuIntensiveTasks.length; i += batchSize) {
        const batch = cpuIntensiveTasks.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(task => task()));
        results.push(...batchResults);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`50 CPU-intensive tasks completed in ${duration.toFixed(2)}ms`);
      console.log(`Using ${batchSize} concurrent threads (${os.cpus().length} CPUs available)`);
    });

    it('should maintain performance during garbage collection pressure', async () => { const iterations = 200;
      const timings = [];

      for (let i = 0; i < iterations; i++) {
        // Create objects that will need garbage collection
        const largeObject = {
          data };

        const startTime = performance.now();
        
        await generator.generate(GeneratorFactory.createGenerateOptions({
          variables));
        
        const endTime = performance.now();
        timings.push(endTime - startTime);

        // Force garbage collection pressure
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      // Calculate performance statistics
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      // Performance should be consistent (low standard deviation)
      expect(stdDev).toBeLessThan(avgTime * 0.5); // Standard deviation should be less than 50% of average
      expect(maxTime).toBeLessThan(avgTime * 3); // No outliers more than 3x average
      
      console.log(`Performance statistics over ${iterations} iterations:`);
      console.log(`Average)}ms`);
      console.log(`Min)}ms, Max: ${maxTime.toFixed(2)}ms`);
      console.log(`Standard Deviation)}ms`);
    });
  });

  describe('Stress Tests', () => { it('should handle extreme load without crashing', async () => {
      const extremeLoad = Array.from({ length, (_, i) => 
        generator.generate(GeneratorFactory.createGenerateOptions({
          generator }`,
          template: `template${i % 5}`,
          variables)
        }))
      );

      // Should not throw errors under extreme load
      await expect(Promise.all(extremeLoad)).resolves.toBeDefined();
      
      console.log('Survived extreme load test with 500 concurrent operations');
    });

    it('should recover gracefully from resource exhaustion', async () => {
      // Simulate resource exhaustion by creating very large operations
      const resourceHeavyTasks = Array.from({ length, (_, i) => 
        generator.generate(GeneratorFactory.createGenerateOptions({
          variables) // Very large variable set
        }))
      );

      mockFs.readFile.mockImplementation(() => 
        Promise.resolve(TemplateFactory.createLargeTemplate(20000)) // Very large template
      );

      let completedTasks = 0;
      let failedTasks = 0;

      const results = await Promise.allSettled(resourceHeavyTasks);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          completedTasks++;
        } else {
          failedTasks++;
        }
      });

      // Should complete at least some tasks even under resource pressure
      expect(completedTasks).toBeGreaterThan(0);
      
      console.log(`Resource exhaustion test, ${failedTasks} failed`);
    });
  });
});