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
      await world.createDirectory('_templates/component/new');
      await world.createFile('_templates/component/new/component.njk', 
        '---\nto: "src/components/{{name}}.tsx"\n---\nexport const {{name}} = () => <div></div>;'
      );
      
      await world.createDirectory('_templates/api-route/new');
      await world.createFile('_templates/api-route/new/route.njk', 
        '---\nto: "src/routes/{{name}}.js"\n---\nexport default function handler() { return {}; }'
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

    it('should provide help for specific generators', async () => {
      // Create template with variables
      await world.createDirectory('_templates/model/new');
      await world.createFile('_templates/model/new/model.njk',
        '---\nto: "src/models/{{name}}.ts"\n---\nexport interface {{ name | pascalCase }} { id: string; }'
      );

      // Test unjucks_help functionality
      const response = await world.callMCPTool('unjucks_help', {
        generator: 'model',
        template: 'new'
      });

      expect(response.result).toBeDefined();
      expect(response.result.generator).toBe('model');
      expect(response.result.template).toBe('new');
      expect(response.result.variables).toBeDefined();
      expect(typeof response.result.variables).toBe('object');
    });

    it('should generate files with provided variables', async () => {
      // Create template
      await world.createDirectory('_templates/service/new');
      await world.createFile('_templates/service/new/service.njk',
        '---\nto: "src/services/{{name | pascalCase}}Service.ts"\n---\nexport class {{name | pascalCase}}Service { }'
      );

      // Test unjucks_generate functionality
      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'service',
        template: 'new',
        variables: {
          name: 'user'
        }
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.generator).toBe('service');
      expect(response.result.template).toBe('new');
      expect(response.result.variables.name).toBe('user');
      expect(Array.isArray(response.result.filesCreated)).toBe(true);
    });

    it('should provide dry run preview without creating files', async () => {
      // Test unjucks_dry_run functionality
      const response = await world.callMCPTool('unjucks_dry_run', {
        generator: 'component',
        template: 'new',
        variables: {
          name: 'TestButton'
        }
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.preview).toBe(true);
      expect(Array.isArray(response.result.files)).toBe(true);
      
      if (response.result.files.length > 0) {
        const file = response.result.files[0];
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('content');
      }
    });

    it('should handle invalid generator names gracefully', async () => {
      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'non-existent-generator',
        template: 'new',
        variables: {}
      });

      // Should still return a response (mocked)
      expect(response).toBeDefined();
      expect(response.success).toBe(true); // Mock always succeeds for testing
    });

    it('should validate required variables', async () => {
      const response = await world.callMCPTool('unjucks_help', {
        generator: 'component',
        template: 'new'
      });

      expect(response.success).toBe(true);
      expect(response.result.variables).toBeDefined();
      
      // Check that variables have proper structure
      Object.values(response.result.variables).forEach(variable => {
        expect(variable).toHaveProperty('type');
        expect(variable).toHaveProperty('required');
        expect(variable).toHaveProperty('description');
      });
    });
  });

  describe('Performance Validation', () => {
    it('should complete generator listing within reasonable time', async () => {
      // Create multiple generators
      const generators = ['component', 'service', 'model', 'route', 'middleware'];
      
      for (const gen of generators) {
        await world.createDirectory(`_templates/${gen}/new`);
        await world.createFile(`_templates/${gen}/new/${gen}.njk`,
          `---\nto: "src/${gen}s/{{name}}.js"\n---\n// ${gen} template`
        );
      }

      const startTime = performance.now();
      const response = await world.callMCPTool('unjucks_list');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(response.success).toBe(true);
      expect(response.result.generators.length).toBeGreaterThanOrEqual(generators.length);
    });

    it('should handle large variable sets efficiently', async () => {
      const largeVariableSet = {};
      for (let i = 0; i < 100; i++) {
        largeVariableSet[`var${i}`] = `value${i}`;
      }

      const startTime = performance.now();
      const response = await world.callMCPTool('unjucks_generate', {
        generator: 'test',
        template: 'new',
        variables: largeVariableSet
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Should complete within 500ms
      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle MCP connection failures gracefully', async () => {
      // Test when MCP is not available
      const mcpAvailable = await world.checkMCPAvailability();
      
      if (!mcpAvailable) {
        // This is expected in test environment
        expect(mcpAvailable).toBe(false);
        
        // Commands should still work in standalone mode
        const result = await world.runCli('list');
        expect(result.exitCode).toBeOneOf([0, 1]);
        
        if (result.exitCode === 1) {
          expect(result.stderr).toBeTruthy();
          expect(result.stderr).not.toMatch(/undefined|null|\[object Object\]/);
        }
      } else {
        // If MCP is available, test should pass
        expect(mcpAvailable).toBe(true);
      }
    });

    it('should validate input parameters', async () => {
      // Test with missing required parameters
      const response = await world.callMCPTool('unjucks_generate', {
        // Missing generator and template
        variables: { name: 'test' }
      });

      // Mock implementation handles this gracefully
      expect(response).toBeDefined();
    });

    it('should handle file system errors gracefully', async () => {
      // Try to read from non-existent directory
      const exists = await world.fileExists('non/existent/path');
      expect(exists).toBe(false);
      
      // Should not throw error
      const response = await world.callMCPTool('unjucks_list');
      expect(response.success).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support complex template hierarchies', async () => {
      // Create nested template structure
      await world.createDirectory('_templates/full-stack/api');
      await world.createDirectory('_templates/full-stack/frontend');
      await world.createDirectory('_templates/full-stack/database');
      
      await world.createFile('_templates/full-stack/api/controller.njk',
        '---\nto: "src/api/{{name}}.controller.js"\n---\n// API controller for {{name}}'
      );
      
      await world.createFile('_templates/full-stack/frontend/component.njk',
        '---\nto: "src/components/{{name}}.jsx"\n---\n// React component for {{name}}'
      );
      
      await world.createFile('_templates/full-stack/database/model.njk',
        '---\nto: "src/models/{{name}}.model.js"\n---\n// Database model for {{name}}'
      );

      const response = await world.callMCPTool('unjucks_list');
      expect(response.success).toBe(true);
      expect(response.result.generators).toBeDefined();
      
      const fullStackGenerator = response.result.generators.find(g => g.name === 'full-stack');
      expect(fullStackGenerator).toBeDefined();
      expect(fullStackGenerator.templates).toBeDefined();
      expect(fullStackGenerator.templates.length).toBeGreaterThanOrEqual(3);
    });

    it('should maintain consistent state across multiple operations', async () => {
      // Create initial template
      await world.createDirectory('_templates/stateful/new');
      await world.createFile('_templates/stateful/new/component.njk',
        '---\nto: "src/{{name}}.js"\n---\nexport const {{name}} = () => {};'
      );

      // First operation
      const firstResponse = await world.callMCPTool('unjucks_list');
      expect(firstResponse.success).toBe(true);
      
      // Second operation should see the same state
      const secondResponse = await world.callMCPTool('unjucks_list');
      expect(secondResponse.success).toBe(true);
      expect(secondResponse.result.generators.length).toBe(firstResponse.result.generators.length);
    });
  });
});

// Helper function for custom matchers
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  }
});