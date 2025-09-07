import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import { performance } from 'perf_hooks';

describe('MCP Server Integration Validation', () => {
  let world;

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
        '---\nto) => <div/>;'
      );
      
      await world.helper.createDirectory('_templates/api-route/new');
      await world.helper.createFile('_templates/api-route/new/route.njk', 
        '---\nto) => {};'
      );

      // Test unjucks_list functionality
      const response = await world.callMCPTool('unjucks_list');
      
      expect(response.result).toBeDefined();
      expect(response.result.generators).toBeDefined();
      expect(Array.isArray(response.result.generators)).toBe(true);
      expect(response.result.generators.length).toBeGreaterThan(0);
      
      // Validate generator metadata
      response.result.generators.forEach((generator) => {
        expect(generator).toHaveProperty('name');
        expect(generator).toHaveProperty('path');
        expect(generator).toHaveProperty('description');
      });
    });

    it('should provide help for specific generators', async () => { // Create template with variables
      await world.helper.createDirectory('_templates/model/new');
      await world.helper.createFile('_templates/model/new/model.njk',
        '---\nto }}.ts"\n---\nexport interface {{ name | pascalCase }} { id) }}; }'
      );

      const response = await world.callMCPTool('unjucks_help', { generator);
      
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
        '---\nto) => {\n  return {{ name }}</div>;\n};'
      );

      const startTime = performance.now();
      const response = await world.callMCPTool('unjucks_generate', { generator });

    it('should handle dry run operations', async () => { await world.helper.createDirectory('_templates/service/new');
      await world.helper.createFile('_templates/service/new/service.njk',
        '---\nto);

      const response = await world.callMCPTool('unjucks_dry_run', {
        generator });
  });

  describe('Error Handling and Validation', () => { it('should handle nonexistent generators gracefully', async () => {
      const response = await world.callMCPTool('unjucks_generate', {
        generator });

    it('should validate input parameters', async () => { const invalidInputs = [
        { generator }, // Empty generator
        { generator }, // Null name
        { generator }, // Empty name
        { generator } // Wrong type
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

    it('should prevent path traversal attacks', async () => { await world.helper.createDirectory('_templates/test/new');
      await world.helper.createFile('_templates/test/new/template.njk',
        '---\nto);

      const maliciousPaths = [
        '../../../etc/passwd',
        '../../sensitive-file.txt',
        '../system/important.conf'
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await world.callMCPTool('unjucks_generate', {
          generator } else {
          // If accepted, should be sanitized
          expect(response.result.filesCreated.every((path) => 
            !path.includes('../') && !path.includes('etc/passwd')
          )).toBe(true);
        }
      }
    });

    it('should handle template syntax errors', async () => { // Create template with invalid syntax
      await world.helper.createDirectory('_templates/invalid/new');
      await world.helper.createFile('_templates/invalid/new/template.njk',
        '---\nto);

      const response = await world.callMCPTool('unjucks_generate', {
        generator }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Create multiple templates
      for (let i = 0; i < 5; i++) {
        await world.helper.createDirectory(`_templates/perf${i}/new`);
        await world.helper.createFile(`_templates/perf${i}/new/template.njk`,
          `---\nto);
      }

      // Make concurrent requests
      const concurrentRequests = [];
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) { const toolIndex = i % 3;
        const tools = ['unjucks_list', 'unjucks_help', 'unjucks_generate'];
        const tool = tools[toolIndex];

        if (tool === 'unjucks_generate') {
          concurrentRequests.push(
            world.callMCPTool(tool, { 
              generator }`, 
              name)
          );
        } else if (tool === 'unjucks_help') {
          concurrentRequests.push(
            world.callMCPTool(tool, { generator)
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
        '---\nto);

      const responseTimes = [];

      // Measure response times for multiple identical requests
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await world.callMCPTool('unjucks_help', { generator);
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

  describe('Integration Scenarios', () => { it('should handle complex multi-file templates', async () => {
      // Create complex template structure
      await world.helper.createDirectory('_templates/fullstack/new');
      await world.helper.createDirectory('_templates/fullstack/new/backend');
      await world.helper.createDirectory('_templates/fullstack/new/frontend');
      
      await world.helper.createFile('_templates/fullstack/new/package.json.njk',
        '{\n  "name" }}",\n  "version");
      
      await world.helper.createFile('_templates/fullstack/new/backend/server.ts.njk',
        '---\nto);
      
      await world.helper.createFile('_templates/fullstack/new/frontend/component.tsx.njk',
        '---\nto) => <div/>;'
      );

      const response = await world.callMCPTool('unjucks_generate', { generator }
    });

    it('should maintain session state across operations', async () => {
      await world.helper.createDirectory('_templates/stateful/new');
      await world.helper.createFile('_templates/stateful/new/template.njk',
        '---\nto) }}'
      );

      // Perform multiple operations in sequence
      const operations = [
        world.callMCPTool('unjucks_list'),
        world.callMCPTool('unjucks_help', { generator),
        world.callMCPTool('unjucks_generate', { generator });
  });
});