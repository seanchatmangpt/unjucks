/**
 * Performance Benchmarks for Template Rendering Pipeline
 * Tests performance characteristics of filter processing and template rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../../src/commands/generate.js';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'node:path';
import { createTempDirectory, cleanupTempDirectory } from '../helpers/temp-utils.js';

describe('Pipeline Performance Benchmarks', () => {
  let tempDir;
  let templatesDir;
  let outputDir;
  let generator;

  beforeEach(async () => {
    tempDir = await createTempDirectory();
    templatesDir = path.join(tempDir, '_templates');
    outputDir = path.join(tempDir, 'output');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(outputDir);
    
    generator = new Generator();
    generator.templatesDir = templatesDir;
  });

  afterEach(async () => {
    await cleanupTempDirectory(tempDir);
  });

  describe('Filter Processing Performance', () => {
    it('should process simple filters efficiently', async () => {
      const nunjucksEnv = new nunjucks.Environment();
      addCommonFilters(nunjucksEnv);

      const template = '{{ name | pascalCase | pluralize | kebabCase }}';
      const iterations = 1000;
      
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        nunjucksEnv.renderString(template, { name: `testComponent${i}` });
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      const averagePerOperation = duration / iterations;
      expect(averagePerOperation).toBeLessThan(1); // Less than 1ms per operation
    });

    it('should handle complex filter chains efficiently', async () => {
      const nunjucksEnv = new nunjucks.Environment();
      addCommonFilters(nunjucksEnv);

      const template = `
        {{ name | pascalCase | singular | classify }}-{{ 
          description | snakeCase | constantCase 
        }}-{{ 
          now() | formatDate('YYYY-MM-DD') 
        }}-{{ 
          '' | fakeUuid | slice(0, 8) 
        }}
      `.replace(/\s+/g, ' ').trim();
      
      const iterations = 500;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        nunjucksEnv.renderString(template, {
          name: `componentName${i}`,
          description: `Test component description ${i}`
        });
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
      
      const averagePerOperation = duration / iterations;
      expect(averagePerOperation).toBeLessThan(6); // Less than 6ms per operation
    });

    it('should handle faker filters efficiently with seeding', async () => {
      const nunjucksEnv = new nunjucks.Environment();
      addCommonFilters(nunjucksEnv);

      // Set seed for deterministic results
      nunjucksEnv.renderString('{{ fakeSeed(12345) }}');

      const template = `{
        "name": "{{ '' | fakeName }}",
        "email": "{{ '' | fakeEmail }}",
        "uuid": "{{ '' | fakeUuid }}",
        "number": {{ '' | fakeNumber(1, 1000) }},
        "text": "{{ '' | fakeText(3) }}",
        "date": "{{ fakeDate() | formatDate('YYYY-MM-DD') }}"
      }`;
      
      const iterations = 200;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        const result = nunjucksEnv.renderString(template);
        // Verify it's valid JSON
        JSON.parse(result);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const averagePerOperation = duration / iterations;
      expect(averagePerOperation).toBeLessThan(25); // Less than 25ms per operation
    });
  });

  describe('Template Generation Performance', () => {
    it('should generate small templates quickly', async () => {
      const templateDir = path.join(templatesDir, 'perf', 'small');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/{{ name | pascalCase }}.js"
---
export const {{ name | pascalCase }} = {
  name: '{{ name | titleCase }}',
  slug: '{{ name | kebabCase }}',
  id: '{{ '' | fakeUuid }}',
  createdAt: '{{ now() | formatDate('YYYY-MM-DD') }}'
};`;

      await fs.writeFile(
        path.join(templateDir, 'component.js.njk'),
        templateContent
      );

      const iterations = 100;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        await generator.generate({
          generator: 'perf',
          template: 'small',
          dest: path.join(outputDir, `iteration-${i}`),
          variables: { name: `component${i}` },
          dry: false,
          force: true
        });
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      const averagePerGeneration = duration / iterations;
      expect(averagePerGeneration).toBeLessThan(100); // Less than 100ms per generation
    });

    it('should handle medium-complexity templates efficiently', async () => {
      const templateDir = path.join(templatesDir, 'perf', 'medium');
      await fs.ensureDir(templateDir);
      
      // Create a more complex template
      let templateContent = `---
to: "{{ dest }}/{{ moduleName | pascalCase }}/{{ entityName | pascalCase }}.js"
---
import React from 'react';

/**
 * {{ entityName | titleCase }} component
 * Generated on: {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
 * Module: {{ moduleName | pascalCase }}
 */
export const {{ entityName | pascalCase }} = (props) => {
  const data = {
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    company: '{{ '' | fakeCompany }}',
    createdAt: '{{ now() | dateIso }}',
    slug: '{{ entityName | kebabCase }}-{{ '' | fakeNumber(1000, 9999) }}'
  };

  const methods = {
    {{ entityName | camelCase }}Methods: {
      create: () => console.log('Creating {{ entityName | titleCase }}'),
      update: () => console.log('Updating {{ entityName | titleCase }}'),
      delete: () => console.log('Deleting {{ entityName | titleCase }}'),
      list: () => console.log('Listing {{ entityName | pluralize | titleCase }}')
    }
  };

  return (
    <div className="{{ moduleName | kebabCase }}-{{ entityName | kebabCase }}">
      <h1>{{ entityName | titleCase }}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default {{ entityName | pascalCase }};`;

      await fs.writeFile(
        path.join(templateDir, 'component.js.njk'),
        templateContent
      );

      const iterations = 50;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        await generator.generate({
          generator: 'perf',
          template: 'medium',
          dest: path.join(outputDir, `medium-${i}`),
          variables: {
            moduleName: `module${i}`,
            entityName: `entity${i}`
          },
          dry: false,
          force: true
        });
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      
      const averagePerGeneration = duration / iterations;
      expect(averagePerGeneration).toBeLessThan(300); // Less than 300ms per generation
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should not leak memory during repeated generations', async () => {
      const templateDir = path.join(templatesDir, 'perf', 'memory');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/test-{{ index }}.js"
---
export const Test{{ index }} = {
  data: {{ '' | fakeSchema({
    name: 'name',
    email: 'email',
    id: 'uuid',
    active: 'boolean',
    score: { type: 'number', min: 1, max: 100 },
    description: { type: 'text', sentences: 5 }
  }) | dump }}
};`;

      await fs.writeFile(
        path.join(templateDir, 'memory-test.js.njk'),
        templateContent
      );

      const initialMemory = process.memoryUsage();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await generator.generate({
          generator: 'perf',
          template: 'memory',
          dest: path.join(outputDir, 'memory-test'),
          variables: { index: i },
          dry: false,
          force: true
        });

        // Force garbage collection every 10 iterations if possible
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerIteration = memoryIncrease / iterations;

      // Memory increase should be reasonable
      expect(memoryIncreasePerIteration).toBeLessThan(1024 * 1024); // Less than 1MB per iteration
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent template generations efficiently', async () => {
      const templateDir = path.join(templatesDir, 'perf', 'concurrent');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/concurrent-{{ id }}.js"
---
export const Concurrent{{ id }} = {
  id: '{{ id }}',
  uuid: '{{ '' | fakeUuid }}',
  timestamp: '{{ now() | dateIso }}',
  name: '{{ '' | fakeName }}',
  data: {{ '' | fakeSchema({
    score: { type: 'number', min: 1, max: 100 },
    active: 'boolean',
    category: ['A', 'B', 'C', 'D'],
    metadata: {
      created: 'date',
      version: { type: 'number', min: 1, max: 10 }
    }
  }) | dump }}
};`;

      await fs.writeFile(
        path.join(templateDir, 'concurrent.js.njk'),
        templateContent
      );

      const concurrentTasks = 10;
      const startTime = process.hrtime.bigint();
      
      // Run multiple generations concurrently
      const promises = Array.from({ length: concurrentTasks }, (_, i) =>
        generator.generate({
          generator: 'perf',
          template: 'concurrent',
          dest: path.join(outputDir, 'concurrent'),
          variables: { id: i },
          dry: false,
          force: true
        })
      );

      const results = await Promise.all(promises);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // All should succeed
      expect(results.every(result => result.success)).toBe(true);
      
      // Should complete reasonably quickly even with concurrency
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const averagePerTask = duration / concurrentTasks;
      expect(averagePerTask).toBeLessThan(1000); // Less than 1 second per concurrent task
    });
  });

  describe('Large Template Stress Test', () => {
    it('should handle very large templates with many filters', async () => {
      const templateDir = path.join(templatesDir, 'perf', 'stress');
      await fs.ensureDir(templateDir);
      
      // Generate a very large template with many filter applications
      let templateContent = `---
to: "{{ dest }}/stress-test.js"
---
/**
 * Stress test template with many filters
 * Generated: {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
 */

export const StressTest = {
  metadata: {
    id: '{{ '' | fakeUuid }}',
    created: '{{ now() | dateIso }}',
    version: '{{ version | default('1.0.0') }}'
  },
  
  components: {`;

      // Add 200 components with multiple filters each
      for (let i = 1; i <= 200; i++) {
        templateContent += `
    {{ 'component' + ${i} | camelCase }}: {
      name: '{{ 'Component' + ${i} | pascalCase }}',
      slug: '{{ 'component_' + ${i} | kebabCase }}',
      table: '{{ 'component' + ${i} | tableize }}',
      class: '{{ 'component' + ${i} | classify }}',
      description: '{{ 'Component number ' + ${i} | titleCase }}',
      fake: {
        id: '{{ '' | fakeUuid }}',
        name: '{{ '' | fakeName }}',
        email: '{{ '' | fakeEmail }}',
        number: {{ '' | fakeNumber(1, 10000) }},
        active: {{ '' | fakeBoolean }},
        created: '{{ fakeDate() | formatDate('YYYY-MM-DD') }}'
      }
    }${i < 200 ? ',' : ''}`;
      }

      templateContent += `
  }
};

export default StressTest;`;

      await fs.writeFile(
        path.join(templateDir, 'stress.js.njk'),
        templateContent
      );

      const startTime = process.hrtime.bigint();
      
      const result = await generator.generate({
        generator: 'perf',
        template: 'stress',
        dest: outputDir,
        variables: { version: '2.0.0' },
        dry: false,
        force: true
      });
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify the generated file
      const outputFile = path.join(outputDir, 'stress-test.js');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('component1: {');
      expect(content).toContain('component200: {');
      expect(content).toContain('Component1');
      expect(content).toContain('Component200');
      
      // Check file size is reasonable
      const stats = await fs.stat(outputFile);
      expect(stats.size).toBeGreaterThan(50000); // Should be substantial
      expect(stats.size).toBeLessThan(5000000); // But not excessive
    });
  });
});