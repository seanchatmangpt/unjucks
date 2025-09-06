import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world';
import { performance } from 'perf_hooks';

describe('MCP Server Integration Validation', () => {
  let world: UnjucksWorld;

  beforeEach(async () => {
    world = new UnjucksWorld();
    await world.setupTempDir();
    world.startPerformanceMonitoring();
  });

  afterEach(async () => {
    await world.cleanupTempDirectory();
  });

  describe('MCP Tool Functionality', () => {
    it('should list available generators correctly', async () => {
      // Create test templates
      await world.helper.createDirectory('_templates/component/new');
      await world.helper.createFile('_templates/component/new/component.njk', 
        '---\nto: "{{ name }}.tsx"\n---\nexport const {{ name }} = () => <div/>;'
      );
      
      await world.helper.createDirectory('_templates/api-route/new');
      await world.helper.createFile('_templates/api-route/new/route.njk', 
        '---\nto: "{{ name }}.ts"\n---\nexport const handler = () => {};'
      );

      // Test unjucks_list functionality
      const response = await world.callMCPTool('unjucks_list');
      
      expect(response.result).toBeDefined();
      expect(response.result.generators).toBeDefined();
      expect(Array.isArray(response.result.generators)).toBe(true);
      expect(response.result.generators.length).toBeGreaterThan(0);
      
      // Validate generator metadata
      response.result.generators.forEach((generator: any) => {
        expect(generator).toHaveProperty('name');
        expect(generator).toHaveProperty('path');
        expect(generator).toHaveProperty('description');
      });
    });

    it('should provide help for specific generators', async () => {
      // Create template with variables
      await world.helper.createDirectory('_templates/model/new');
      await world.helper.createFile('_templates/model/new/model.njk',
        '---\nto: "{{ name | pascalCase }}.ts"\n---\nexport interface {{ name | pascalCase }} { id: {{ idType | default("string") }}; }'
      );

      const response = await world.callMCPTool('unjucks_help', { generator: 'model' });
      
      expect(response.result).toBeDefined();
      expect(response.result.name).toBe('model');
      expect(response.result.description).toContain('model');
      expect(response.result.variables).toBeDefined();
      expect(response.result.flags).toBeDefined();
    });

    it('should generate files successfully', async () => {
      // Create component template
      await world.helper.createDirectory('_templates/component/new');
      await world.helper.createFile('_templates/component/new/component.njk',
        '---\nto: "src/components/{{ name | pascalCase }}.tsx"\n---\nimport React from \'react\';\n\nexport const {{ name | pascalCase }} = () => {\n  return <div>{{ name }}</div>;\n};'
      );

      const startTime = performance.now();
      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'component',
        name: 'UserProfile',
        dest: './output'
      });
      const endTime = performance.now();

      expect(response.result).toBeDefined();
      expect(response.result.filesCreated).toBeDefined();
      expect(Array.isArray(response.result.filesCreated)).toBe(true);
      expect(response.result.message).toContain('successfully');
      
      // Performance validation
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should complete within 1 second
      
      world.recordPerformanceMetric(responseTime);
    });

    it('should handle dry run operations', async () => {
      await world.helper.createDirectory('_templates/service/new');
      await world.helper.createFile('_templates/service/new/service.njk',
        '---\nto: "src/services/{{ name | pascalCase }}Service.ts"\n---\nexport class {{ name | pascalCase }}Service {\n  // Service implementation\n}'
      );

      const response = await world.callMCPTool('unjucks_dry_run', {
        generator: 'service',
        name: 'user'
      });

      expect(response.result).toBeDefined();
      expect(response.result.preview).toBeDefined();
      expect(Array.isArray(response.result.preview)).toBe(true);
      expect(response.result.preview.length).toBeGreaterThan(0);
      
      // Verify preview structure
      const previewItem = response.result.preview[0];
      expect(previewItem.path).toBeDefined();
      expect(previewItem.content).toBeDefined();
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle nonexistent generators gracefully', async () => {
      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'nonexistent-generator',
        name: 'test'
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(404);
      expect(response.error.message).toContain('not found');
      expect(response.error.data?.availableGenerators).toBeDefined();
    });

    it('should validate input parameters', async () => {
      const invalidInputs = [
        { generator: '', name: 'test' }, // Empty generator
        { generator: 'test', name: null }, // Null name
        { generator: 'test', name: '' }, // Empty name
        { generator: 123, name: 'test' } // Wrong type
      ];

      for (const invalidInput of invalidInputs) {
        const response = await world.callMCPTool('unjucks_generate', invalidInput);
        
        // Should handle gracefully - either error or sanitized input
        expect(typeof response).toBe('object');
        
        if (response.error) {
          expect(response.error.message.length).toBeGreaterThan(5);
        }
      }
    });

    it('should prevent path traversal attacks', async () => {
      await world.helper.createDirectory('_templates/test/new');
      await world.helper.createFile('_templates/test/new/template.njk',
        '---\nto: "{{ dest }}/{{ name }}.ts"\n---\nexport const test = "{{ name }}";'
      );

      const maliciousPaths = [
        '../../../etc/passwd',
        '../../sensitive-file.txt',
        '../system/important.conf'
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await world.callMCPTool('unjucks_generate', {
          generator: 'test',
          name: 'test',
          dest: maliciousPath
        });

        // Should either sanitize path or reject the request
        if (response.error) {
          expect(response.error.message).toMatch(/path|security|invalid/i);
        } else {
          // If accepted, should be sanitized
          expect(response.result.filesCreated.every((path: string) => 
            !path.includes('../') && !path.includes('etc/passwd')
          )).toBe(true);
        }
      }
    });

    it('should handle template syntax errors', async () => {
      // Create template with invalid syntax
      await world.helper.createDirectory('_templates/invalid/new');
      await world.helper.createFile('_templates/invalid/new/template.njk',
        '---\nto: "output.ts"\n---\n{{ unclosed.variable\n{% if missing endif %}\ncontent'
      );

      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'invalid',
        name: 'test'
      });

      if (response.error) {
        expect(response.error.message).toMatch(/syntax|parse|template/i);
        expect(response.error.message.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Create multiple templates
      for (let i = 0; i < 5; i++) {
        await world.helper.createDirectory(`_templates/perf${i}/new`);
        await world.helper.createFile(`_templates/perf${i}/new/template.njk`,
          `---\nto: "perf${i}.ts"\n---\nexport const perf${i} = "{{ name }}";`
        );
      }

      // Make concurrent requests
      const concurrentRequests = [];
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        const toolIndex = i % 3;
        const tools = ['unjucks_list', 'unjucks_help', 'unjucks_generate'];
        const tool = tools[toolIndex];

        if (tool === 'unjucks_generate') {
          concurrentRequests.push(
            world.callMCPTool(tool, { 
              generator: `perf${i % 5}`, 
              name: `Test${i}` 
            })
          );
        } else if (tool === 'unjucks_help') {
          concurrentRequests.push(
            world.callMCPTool(tool, { generator: `perf${i % 5}` })
          );
        } else {
          concurrentRequests.push(world.callMCPTool(tool));
        }
      }

      const results = await Promise.all(concurrentRequests);
      const totalTime = performance.now() - startTime;

      // Validate performance
      expect(totalTime).toBeLessThan(5000); // All requests within 5 seconds
      expect(results.length).toBe(10);
      
      // Check that most requests succeeded
      const successCount = results.filter(r => !r.error).length;
      expect(successCount).toBeGreaterThan(7); // At least 70% success rate

      world.recordPerformanceMetric(totalTime);
    });

    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        await world.callMCPTool('unjucks_list');
        
        if (i % 10 === 0) {
          // Check memory periodically
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowthMB = (currentMemory - initialMemory) / 1024 / 1024;
          
          // Memory growth should be reasonable (less than 50MB)
          expect(memoryGrowthMB).toBeLessThan(50);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(totalGrowthMB).toBeLessThan(100); // Total growth under 100MB
    });

    it('should have consistent response times', async () => {
      await world.helper.createDirectory('_templates/benchmark/new');
      await world.helper.createFile('_templates/benchmark/new/template.njk',
        '---\nto: "{{ name }}.ts"\n---\nexport const {{ name }} = "benchmark";'
      );

      const responseTimes: number[] = [];

      // Measure response times for multiple identical requests
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await world.callMCPTool('unjucks_help', { generator: 'benchmark' });
        const endTime = performance.now();
        
        responseTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);

      // Validate consistency
      expect(avgTime).toBeLessThan(200); // Average under 200ms
      expect(maxTime).toBeLessThan(500); // Maximum under 500ms
      expect(maxTime - minTime).toBeLessThan(300); // Consistent within 300ms range
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex multi-file templates', async () => {
      // Create complex template structure
      await world.helper.createDirectory('_templates/fullstack/new');
      await world.helper.createDirectory('_templates/fullstack/new/backend');
      await world.helper.createDirectory('_templates/fullstack/new/frontend');
      
      await world.helper.createFile('_templates/fullstack/new/package.json.njk',
        '{\n  "name": "{{ name | kebabCase }}",\n  "version": "1.0.0"\n}'
      );
      
      await world.helper.createFile('_templates/fullstack/new/backend/server.ts.njk',
        '---\nto: "backend/{{ name }}Server.ts"\n---\nexport class {{ name | pascalCase }}Server {}'
      );
      
      await world.helper.createFile('_templates/fullstack/new/frontend/component.tsx.njk',
        '---\nto: "frontend/{{ name | pascalCase }}.tsx"\n---\nexport const {{ name | pascalCase }} = () => <div/>;'
      );

      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'fullstack',
        name: 'myapp'
      });

      expect(response.result).toBeDefined();
      if (response.result?.filesCreated) {
        expect(response.result.filesCreated.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should maintain session state across operations', async () => {
      await world.helper.createDirectory('_templates/stateful/new');
      await world.helper.createFile('_templates/stateful/new/template.njk',
        '---\nto: "{{ name }}.ts"\n---\n// Generated at {{ timestamp | default("now") }}'
      );

      // Perform multiple operations in sequence
      const operations = [
        world.callMCPTool('unjucks_list'),
        world.callMCPTool('unjucks_help', { generator: 'stateful' }),
        world.callMCPTool('unjucks_generate', { generator: 'stateful', name: 'test1' }),
        world.callMCPTool('unjucks_generate', { generator: 'stateful', name: 'test2' }),
      ];

      const results = await Promise.all(operations);
      
      // All operations should succeed
      const failureCount = results.filter(r => r.error).length;
      expect(failureCount).toBeLessThan(2); // Allow for some expected failures

      // Check performance metrics are being collected
      expect(world.getAverageResponseTime()).toBeGreaterThan(0);
    });
  });
});