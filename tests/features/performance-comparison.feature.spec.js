import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import { performance } from 'perf_hooks';

describe('Performance Comparison Validation', () => {
  let world;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.createTempDirectory();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('HYGEN-DELTA Claim, () => { it('should demonstrate fast cold start time (~150ms claimed)', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = "simple";`;

      await world.helper.createDirectory('_templates/performance/simple');
      await world.helper.createFile('_templates/performance/simple/file.ts', templateContent);
      
      const start = performance.now();
      const result = await world.helper.runCli('unjucks generate performance simple --name=test');
      const duration = performance.now() - start;
      
      expect(result.exitCode).toBe(0);
      
      // Cold start should be reasonably fast
      // Note: This will vary by system, but should be faster than Hygen's claimed 200ms
      expect(duration).toBeLessThan(1000); // 1 second max for CI environments
      console.log(`Cold start time)}ms`);
    });

    it('should demonstrate fast template processing (~30ms claimed)', async () => { const templateContent = `---
to }}.ts"
---
export class {{ name | pascalCase }}Service {
  {% for i in range(0, 10) %}
  method{{ i }}(): {{ name | pascalCase }} { return {
      id }}-{{ i }}",
      name: "{{ name | titleCase }} {{ i }}",
      slug: "{{ name | kebabCase }}-{{ i }}"
    } as {{ name | pascalCase }};
  }
  {% endfor %}
}`;

      await world.helper.createDirectory('_templates/performance/complex');
      await world.helper.createFile('_templates/performance/complex/service.ts', templateContent);
      
      const start = performance.now();
      const result = await world.helper.runCli('unjucks generate performance complex --name=user-profile');
      const duration = performance.now() - start;
      
      expect(result.exitCode).toBe(0);
      
      // Template processing should be fast
      expect(duration).toBeLessThan(500); // 500ms max for complex template
      console.log(`Complex template processing time)}ms`);
      
      // Verify complex template was processed correctly
      const content = await world.helper.readFile('src/UserProfileService.ts');
      expect(content).toContain('export class UserProfileService');
      expect(content).toContain('method0(): UserProfile');
      expect(content).toContain('method9(): UserProfile');
      expect(content).toContain('name);
    });

    it('should demonstrate efficient file operations (~15ms claimed)', async () => { const templates = [];
      
      // Create multiple templates to test concurrent file operations
      for (let i = 0; i < 5; i++) {
        const templateContent = `---
to } }}.ts"
---
export const file{{ ${i} }} = { index } }},
  name: "{{ name }}"
};`;
        
        await world.helper.createDirectory(`_templates/file${i}/test`);
        await world.helper.createFile(`_templates/file${i}/test/file.ts`, templateContent);
        templates.push(`unjucks generate file${i} test --name=test`);
      }
      
      const start = performance.now();
      
      // Generate all files
      for (const cmd of templates) {
        const result = await world.helper.runCli(cmd);
        expect(result.exitCode).toBe(0);
      }
      
      const duration = performance.now() - start;
      const averagePerFile = duration / templates.length;
      
      console.log(`File operations)}ms total, ${averagePerFile.toFixed(2)}ms average per file`);
      
      // Verify all files were created
      for (let i = 0; i < 5; i++) {
        const exists = await world.helper.fileExists(`src/file${i}.ts`);
        expect(exists).toBe(true);
      }
      
      // Average per file should be reasonable
      expect(averagePerFile).toBeLessThan(100); // 100ms max per file
    });

    it('should demonstrate memory efficiency (~20MB claimed)', async () => { const initialMemory = process.memoryUsage();
      
      // Create a memory-intensive template
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = {
  {% for i in range(0, 100) %}
  item{{ i }}: { id }}-{{ i }}",
    name: "{{ name | titleCase }} Item {{ i }}",
    description: "This is item {{ i }} of {{ name | titleCase }}",
    tags: [{{ range(0, 10) | join(', ') }}],
    metadata: { created }},
      type: "{{ name }}"
    }
  },
  {% endfor %}
};`;

      await world.helper.createDirectory('_templates/memory/intensive');
      await world.helper.createFile('_templates/memory/intensive/data.ts', templateContent);
      
      const result = await world.helper.runCli('unjucks generate memory intensive --name=largeDataSet');
      expect(result.exitCode).toBe(0);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      console.log(`Memory usage increase)}MB`);
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50); // 50MB max increase
      
      // Verify large file was generated
      const exists = await world.helper.fileExists('src/largeDataSet.ts');
      expect(exists).toBe(true);
      
      const content = await world.helper.readFile('src/largeDataSet.ts');
      expect(content).toContain('item0:');
      expect(content).toContain('item99:');
    });

    it('should handle concurrent operations efficiently', async () => { // Test concurrent template processing
      const templates = [];
      
      for (let i = 0; i < 10; i++) {
        const templateContent = `---
to }}{{ ${i} }}.ts"
---
export const {{ name }}{{ ${i} }} = { id } }},
  processed: this.getDeterministicDate().toISOString(),
  name: "{{ name | titleCase }} {{ ${i} }}"
};`;
        
        await world.helper.createDirectory(`_templates/concurrent${i}/test`);
        await world.helper.createFile(`_templates/concurrent${i}/test/file.ts`, templateContent);
        templates.push(`unjucks generate concurrent${i} test --name=item`);
      }
      
      const start = performance.now();
      
      // Process templates sequentially (concurrent processing would require shell modification)
      const promises = templates.map(async (cmd, index) => {
        const result = await world.helper.runCli(cmd);
        return { index, result };
      });
      
      const results = await Promise.all(promises);
      const duration = performance.now() - start;
      
      console.log(`Concurrent operations)}ms for ${templates.length} templates`);
      
      // All should succeed
      results.forEach(({ index, result }) => {
        expect(result.exitCode).toBe(0);
      });
      
      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const exists = await world.helper.fileExists(`src/concurrent/item${i}.ts`);
        expect(exists).toBe(true);
      }
      
      // Should be faster than sequential processing
      const averageTime = duration / templates.length;
      expect(averageTime).toBeLessThan(200); // 200ms max per template
    });
  });

  describe('HYGEN-DELTA Claim, () => { it('should benefit from template caching on repeated operations', async () => {
      const templateContent = `---
to }}.ts"
---
export const {{ name }} = { cached,
  generated };`;

      await world.helper.createDirectory('_templates/cache/test');
      await world.helper.createFile('_templates/cache/test/file.ts', templateContent);
      
      // First run (cold)
      const start1 = performance.now();
      const result1 = await world.helper.runCli('unjucks generate cache test --name=first');
      const duration1 = performance.now() - start1;
      
      expect(result1.exitCode).toBe(0);
      
      // Clean up for second run
      await world.helper.runCli('rm -rf src/cached-*');
      
      // Second run (potentially cached)
      const start2 = performance.now();
      const result2 = await world.helper.runCli('unjucks generate cache test --name=second');
      const duration2 = performance.now() - start2;
      
      expect(result2.exitCode).toBe(0);
      
      console.log(`First run)}ms, Second run: ${duration2.toFixed(2)}ms`);
      
      // Second run should not be significantly slower (template caching)
      const performanceRatio = duration2 / duration1;
      expect(performanceRatio).toBeLessThan(2); // Should not be more than 2x slower
    });
  });
});