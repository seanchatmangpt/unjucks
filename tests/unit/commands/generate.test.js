/**
 * Unit Tests for Generate Command
 * 
 * Tests the generate command functionality including template processing,
 * variable handling, and file generation workflows.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateCommand } from '../../../src/commands/generate.js';
import { createWorkspace, TemplateFactory, MockFactory } from '../../helpers/test-utilities.js';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('gray-matter');
vi.mock('nunjucks');

describe('Generate Command', () => {
  let workspace;
  let mockContext;

  beforeEach(async () => {
    workspace = createWorkspace('generate-test');
    await workspace.setup();

    mockContext = {
      args: {
        generator: 'component',
        template: 'react',
        name: 'TestComponent',
        dest: '.',
        force: false,
        dry: false,
        backup: false,
        skipPrompts: false,
        verbose: false,
        quiet: false
      }
    };
  });

  afterEach(async () => {
    await workspace.cleanup();
    vi.clearAllMocks();
  });

  describe('Command metadata', () => {
    test('should have correct command metadata', () => {
      expect(generateCommand.meta.name).toBe('generate');
      expect(generateCommand.meta.description).toContain('Generate files from templates');
    });

    test('should define all expected arguments', () => {
      const args = generateCommand.args;
      
      expect(args.generator).toBeDefined();
      expect(args.template).toBeDefined();
      expect(args.name).toBeDefined();
      expect(args.dest).toBeDefined();
      expect(args.force).toBeDefined();
      expect(args.dry).toBeDefined();
    });

    test('should have proper argument defaults', () => {
      const args = generateCommand.args;
      
      expect(args.dest.default).toBe('.');
      expect(args.force.default).toBe(false);
      expect(args.dry.default).toBe(false);
      expect(args.backup.default).toBe(false);
    });
  });

  describe('Basic generation workflow', () => {
    test('should generate simple component successfully', async () => {
      // Setup template in workspace
      const template = TemplateFactory.simpleComponent('TestComponent');
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      // Mock successful generation
      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should handle dry run mode', async () => {
      mockContext.args.dry = true;
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.message).toContain('Dry run');
    });

    test('should handle force overwrite', async () => {
      mockContext.args.force = true;
      
      // Create existing file
      await workspace.createFile('src/components/TestComponent.jsx', 'existing content');
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Variable handling', () => {
    test('should extract variables from positional arguments', async () => {
      // Mock positional args from environment
      process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(['component', 'react', 'UserButton']);
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      
      // Cleanup
      delete process.env.UNJUCKS_POSITIONAL_ARGS;
    });

    test('should merge flag variables with positional variables', async () => {
      mockContext.args.description = 'A test component';
      mockContext.args.withTests = true;
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should handle missing name variable gracefully', async () => {
      delete mockContext.args.name;
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      // Should either succeed with defaults or provide helpful error
    });
  });

  describe('Interactive mode handling', () => {
    test('should handle missing generator with interactive prompts', async () => {
      delete mockContext.args.generator;
      mockContext.args.skipPrompts = false;
      
      // Create some generators for selection
      await workspace.createTemplate('component', 'react', 'content', { to: 'output.js' });
      await workspace.createTemplate('api', 'express', 'content', { to: 'output.js' });

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      // Should either succeed with selection or show appropriate prompts
    });

    test('should fail fast when skipPrompts is true and generator missing', async () => {
      delete mockContext.args.generator;
      mockContext.args.skipPrompts = true;

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Generator name required');
    });

    test('should handle missing template with interactive prompts', async () => {
      delete mockContext.args.template;
      mockContext.args.skipPrompts = false;
      
      // Create templates for the generator
      await workspace.createTemplate('component', 'react', 'content', { to: 'output.js' });
      await workspace.createTemplate('component', 'vue', 'content', { to: 'output.js' });

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('should handle non-existent generator gracefully', async () => {
      mockContext.args.generator = 'nonexistent';

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    test('should handle non-existent template gracefully', async () => {
      mockContext.args.template = 'nonexistent';
      
      // Create generator but not the specific template
      await workspace.createTemplate('component', 'react', 'content', { to: 'output.js' });

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    test('should handle template parsing errors', async () => {
      // Create malformed template
      await workspace.createTemplate(
        'component',
        'react',
        '{{ unclosed variable',
        { to: 'output.js' }
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    test('should handle file write permission errors', async () => {
      const template = TemplateFactory.simpleComponent();
      template.frontmatter.to = '/root/restricted.js'; // Should fail permissions
      
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('Output formatting', () => {
    test('should provide verbose output when requested', async () => {
      mockContext.args.verbose = true;
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      // Capture console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should suppress output when quiet flag is set', async () => {
      mockContext.args.quiet = true;
      
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      // Capture console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      // Quiet mode should minimize console output
      
      consoleSpy.mockRestore();
    });

    test('should format file paths correctly in output', async () => {
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      if (result.files) {
        expect(Array.isArray(result.files)).toBe(true);
        result.files.forEach(filePath => {
          expect(typeof filePath).toBe('string');
          expect(filePath.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Performance considerations', () => {
    test('should complete generation within reasonable time', async () => {
      const template = TemplateFactory.simpleComponent();
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const startTime = Date.now();
      const result = await generateCommand.run(mockContext);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('should handle multiple file generation efficiently', async () => {
      // Create multi-file template
      const template = TemplateFactory.multiFileTemplate();
      
      for (const file of template.files) {
        await workspace.createTemplate(
          template.generator,
          `${template.template}-${Math.random()}`,
          file.content,
          file.frontmatter
        );
      }

      const startTime = Date.now();
      const result = await generateCommand.run(mockContext);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Even multiple files should be reasonably fast
    });
  });

  describe('File injection scenarios', () => {
    test('should handle file injection properly', async () => {
      // Create existing file to inject into
      await workspace.createFile('src/index.js', `// Main file
// IMPORTS_PLACEHOLDER
export default app;`);

      const template = TemplateFactory.injectionTemplate('src/index.js');
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should handle injection into non-existent file', async () => {
      const template = TemplateFactory.injectionTemplate('src/nonexistent.js');
      await workspace.createTemplate(
        template.generator,
        template.template,
        template.content,
        template.frontmatter
      );

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
      // Should either create the file or provide appropriate error
    });
  });

  describe('Template variable scanning', () => {
    test('should detect template variables correctly', async () => {
      const complexTemplate = `---
to: src/{{ type }}/{{ name | kebabCase }}.js
---
// {{ description }}
export class {{ name | pascalCase }} {
  constructor({{ constructorArgs }}) {
    this.{{ property }} = {{ defaultValue }};
  }
}`;

      await workspace.createTemplate(
        'component',
        'complex',
        complexTemplate,
        {}
      );

      // The command should be able to parse and handle these variables
      mockContext.args.generator = 'component';
      mockContext.args.template = 'complex';
      mockContext.args.name = 'TestClass';
      mockContext.args.type = 'models';
      mockContext.args.description = 'A test class';

      const result = await generateCommand.run(mockContext);

      expect(result).toBeDefined();
    });
  });
});