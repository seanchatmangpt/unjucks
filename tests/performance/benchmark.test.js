/**
 * Performance Benchmark Tests
 * 
 * Tests performance characteristics of core operations including
 * template discovery, parsing, rendering, and file operations.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { UnjucksApp } from '../../src/core/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test workspace setup
const TEST_ROOT = path.join(__dirname, '../fixtures/performance-test-workspace');

/**
 * Performance benchmark helper
 */
class PerformanceBenchmark {
  constructor(name) {
    this.name = name;
    this.startTime = 0;
    this.endTime = 0;
    this.measurements = [];
  }

  start() {
    this.startTime = performance.now();
    return this;
  }

  end() {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  async measure(operation) {
    this.start();
    const result = await operation();
    const duration = this.end();
    return { result, duration };
  }

  getStats() {
    if (this.measurements.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    
    const sorted = [...this.measurements].sort((a, b) => a - b);
    return {
      avg: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      count: this.measurements.length
    };
  }
}

describe('Performance Benchmarks', () => {
  beforeEach(async () => {
    await fs.remove(TEST_ROOT);
    await fs.ensureDir(TEST_ROOT);
    process.chdir(TEST_ROOT);
  });

  afterEach(async () => {
    if (await fs.pathExists(TEST_ROOT)) {
      await fs.remove(TEST_ROOT);
    }
  });

  describe('Template Discovery Performance', () => {
    test('should discover templates efficiently with small dataset', async () => {
      const benchmark = new PerformanceBenchmark('Small Template Discovery');
      
      // Create 10 generators with 5 templates each
      for (let i = 1; i <= 10; i++) {
        for (let j = 1; j <= 5; j++) {
          const templatePath = path.join(TEST_ROOT, `_templates/gen${i}/template${j}`);
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            `---\nto: output-${i}-${j}.txt\n---\nContent ${i}-${j}`
          );
        }
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      // Warm up
      await scanner.getGenerators();
      
      // Benchmark multiple runs
      const runs = 10;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          return await scanner.getGenerators();
        });
      }

      const stats = benchmark.getStats();
      
      // Should complete discovery in reasonable time
      expect(stats.avg).toBeLessThan(100); // Less than 100ms average
      expect(stats.max).toBeLessThan(200); // No single run over 200ms
      
      console.log(`Small Template Discovery - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });

    test('should scale well with medium dataset', async () => {
      const benchmark = new PerformanceBenchmark('Medium Template Discovery');
      
      // Create 50 generators with 10 templates each
      for (let i = 1; i <= 50; i++) {
        for (let j = 1; j <= 10; j++) {
          const templatePath = path.join(TEST_ROOT, `_templates/generator${i}/template${j}`);
          await fs.ensureDir(templatePath);
          await fs.writeFile(
            path.join(templatePath, 'index.njk'),
            `---\nto: output-${i}-${j}.txt\n---\nContent for generator ${i} template ${j}`
          );
        }
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      // Warm up
      await scanner.getGenerators();
      
      // Benchmark fewer runs for larger dataset
      const runs = 5;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          return await scanner.getGenerators();
        });
      }

      const stats = benchmark.getStats();
      
      // Should still be reasonable with 500 templates
      expect(stats.avg).toBeLessThan(500); // Less than 500ms average
      expect(stats.max).toBeLessThan(1000); // No single run over 1 second
      
      console.log(`Medium Template Discovery - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });

    test('should handle large nested directory structures efficiently', async () => {
      const benchmark = new PerformanceBenchmark('Deep Directory Discovery');
      
      // Create deeply nested structure
      for (let domain = 1; domain <= 5; domain++) {
        for (let feature = 1; feature <= 10; feature++) {
          for (let type = 1; type <= 3; type++) {
            const templatePath = path.join(
              TEST_ROOT, 
              `_templates/domain${domain}/feature${feature}/type${type}`
            );
            await fs.ensureDir(templatePath);
            await fs.writeFile(
              path.join(templatePath, 'index.njk'),
              `---\nto: output/d${domain}/f${feature}/t${type}.txt\n---\nNested content`
            );
          }
        }
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      const { duration } = await benchmark.measure(async () => {
        return await scanner.getGenerators();
      });

      // Deep nesting should not significantly impact performance
      expect(duration).toBeLessThan(300); // Less than 300ms
      
      console.log(`Deep Directory Discovery - Duration: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Template Parsing Performance', () => {
    test('should parse simple templates quickly', async () => {
      const benchmark = new PerformanceBenchmark('Simple Template Parsing');
      
      const templatePath = path.join(TEST_ROOT, '_templates/test/simple');
      await fs.ensureDir(templatePath);
      
      const simpleTemplate = `---
to: {{ name }}.js
---
export const {{ name }} = '{{ value }}';`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), simpleTemplate);
      
      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      // Benchmark template reading
      const runs = 100;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          return await scanner.readTemplate(templatePath);
        });
      }

      const stats = benchmark.getStats();
      
      // Simple template reading should be very fast
      expect(stats.avg).toBeLessThan(10); // Less than 10ms average
      expect(stats.max).toBeLessThan(50); // No single read over 50ms
      
      console.log(`Simple Template Parsing - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });

    test('should handle complex templates with reasonable performance', async () => {
      const benchmark = new PerformanceBenchmark('Complex Template Parsing');
      
      const templatePath = path.join(TEST_ROOT, '_templates/test/complex');
      await fs.ensureDir(templatePath);
      
      // Complex template with multiple conditionals and loops
      const complexTemplate = `---
to: src/{{ domain }}/{{ feature }}/{{ name | kebabCase }}.ts
inject: {{ inject || false }}
skipIf: {{ skipIfExists }}
---
import { Injectable } from '@nestjs/common';
{% if withRepository %}
import { Repository } from 'typeorm';
import { {{ name | pascalCase }} } from './{{ name | kebabCase }}.entity';
{% endif %}

/**
 * {{ description || name }} service
 * Generated on {{ date || 'unknown' }}
 */
@Injectable()
export class {{ name | pascalCase }}Service {
  {% if withRepository %}
  constructor(
    private readonly {{ name | camelCase }}Repository: Repository<{{ name | pascalCase }}>
  ) {}
  {% endif %}

  {% for method in methods %}
  async {{ method.name }}({{ method.params | join(', ') }}): Promise<{{ method.returnType }}> {
    {% if method.type === 'find' %}
    return this.{{ name | camelCase }}Repository.find({
      {% for param in method.params %}
      {{ param.name }}: {{ param.name }},
      {% endfor %}
    });
    {% elif method.type === 'create' %}
    const entity = this.{{ name | camelCase }}Repository.create(data);
    return this.{{ name | camelCase }}Repository.save(entity);
    {% else %}
    // TODO: Implement {{ method.name }}
    throw new Error('Not implemented');
    {% endif %}
  }
  {% endfor %}
}`;

      await fs.writeFile(path.join(templatePath, 'index.njk'), complexTemplate);
      
      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      // Benchmark complex template reading
      const runs = 50;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          return await scanner.readTemplate(templatePath);
        });
      }

      const stats = benchmark.getStats();
      
      // Complex templates should still be reasonably fast
      expect(stats.avg).toBeLessThan(50); // Less than 50ms average
      expect(stats.max).toBeLessThan(100); // No single read over 100ms
      
      console.log(`Complex Template Parsing - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });
  });

  describe('Application Startup Performance', () => {
    test('should initialize app quickly', async () => {
      const benchmark = new PerformanceBenchmark('App Initialization');
      
      const runs = 10;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          const app = new UnjucksApp();
          return app;
        });
      }

      const stats = benchmark.getStats();
      
      // App initialization should be very fast
      expect(stats.avg).toBeLessThan(100); // Less than 100ms average
      expect(stats.max).toBeLessThan(200); // No single init over 200ms
      
      console.log(`App Initialization - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });

    test('should handle command routing efficiently', async () => {
      const benchmark = new PerformanceBenchmark('Command Routing');
      
      const app = new UnjucksApp();
      
      // Mock commands to avoid actual file operations
      app.commands.help = {
        execute: vi.fn().mockResolvedValue({ success: true, message: 'Help executed' })
      };
      
      const command = app.createMainCommand();
      
      const runs = 100;
      for (let i = 0; i < runs; i++) {
        await benchmark.measure(async () => {
          return await command.run({
            args: { action: 'help' },
            options: { debug: false, verbose: false }
          });
        });
      }

      const stats = benchmark.getStats();
      
      // Command routing should be very fast
      expect(stats.avg).toBeLessThan(10); // Less than 10ms average
      expect(stats.max).toBeLessThan(50); // No single route over 50ms
      
      console.log(`Command Routing - Avg: ${stats.avg.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create templates
      const templatePath = path.join(TEST_ROOT, '_templates/memory/test');
      await fs.ensureDir(templatePath);
      await fs.writeFile(
        path.join(templatePath, 'index.njk'),
        '---\nto: output-{{ index }}.txt\n---\nContent {{ index }}'
      );

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await scanner.getGenerators();
        await scanner.readTemplate(templatePath);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
      
      console.log(`Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle large template counts without excessive memory usage', async () => {
      const memoryBefore = process.memoryUsage();
      
      // Create many templates
      for (let i = 1; i <= 100; i++) {
        const templatePath = path.join(TEST_ROOT, `_templates/gen${i}/template`);
        await fs.ensureDir(templatePath);
        await fs.writeFile(
          path.join(templatePath, 'index.njk'),
          `---\nto: output-${i}.txt\n---\nLarge content ${'x'.repeat(1000)}`
        );
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      const generators = await scanner.getGenerators();
      
      const memoryAfter = process.memoryUsage();
      const memoryUsed = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      expect(generators).toHaveLength(100);
      
      // Memory usage should be reasonable for 100 templates
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      
      console.log(`Memory Used for 100 templates: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Concurrent Operation Performance', () => {
    test('should handle concurrent template discovery efficiently', async () => {
      // Create templates
      for (let i = 1; i <= 20; i++) {
        const templatePath = path.join(TEST_ROOT, `_templates/concurrent${i}/template`);
        await fs.ensureDir(templatePath);
        await fs.writeFile(
          path.join(templatePath, 'index.njk'),
          `---\nto: output-${i}.txt\n---\nConcurrent content ${i}`
        );
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      
      const benchmark = new PerformanceBenchmark('Concurrent Discovery');
      
      const { duration } = await benchmark.measure(async () => {
        // Run 10 concurrent discovery operations
        const promises = Array.from({ length: 10 }, () => scanner.getGenerators());
        return await Promise.all(promises);
      });

      // Concurrent operations should not be significantly slower than sequential
      expect(duration).toBeLessThan(1000); // Less than 1 second
      
      console.log(`Concurrent Discovery (10 parallel): ${duration.toFixed(2)}ms`);
    });

    test('should maintain performance under load', async () => {
      // Create template structure
      for (let i = 1; i <= 10; i++) {
        const templatePath = path.join(TEST_ROOT, `_templates/load${i}/template`);
        await fs.ensureDir(templatePath);
        await fs.writeFile(
          path.join(templatePath, 'index.njk'),
          `---\nto: load-output-${i}.txt\n---\nLoad test content ${i}`
        );
      }

      const scanner = new TemplateScanner({ baseDir: TEST_ROOT });
      const benchmark = new PerformanceBenchmark('Load Test');
      
      // Simulate sustained load
      const startTime = performance.now();
      
      for (let iteration = 0; iteration < 50; iteration++) {
        await benchmark.measure(async () => {
          const generators = await scanner.getGenerators();
          // Simulate some processing
          for (const gen of generators) {
            for (const template of gen.templates) {
              await scanner.readTemplate(template.path);
            }
          }
          return generators;
        });
      }

      const totalTime = performance.now() - startTime;
      const stats = benchmark.getStats();
      
      // Performance should remain consistent under sustained load
      const performanceDegradation = (stats.max - stats.min) / stats.avg;
      expect(performanceDegradation).toBeLessThan(2.0); // Less than 200% variation
      
      console.log(`Load Test - 50 iterations in ${totalTime.toFixed(2)}ms`);
      console.log(`Performance stability - Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms, Avg: ${stats.avg.toFixed(2)}ms`);
    });
  });
});