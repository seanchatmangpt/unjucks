/**
 * Real CLI Command Tests - Tests actual command functionality
 * Tests the main CLI commands without mocks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { listCommand } from '../../src/commands/list.js';
import { generateCommand } from '../../src/commands/generate.js';
import { helpCommand } from '../../src/commands/help.js';
import chalk from 'chalk';

describe('CLI Commands - Real Functionality', () => {
  let testDir;
  let templatesDir;
  let outputDir;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(process.cwd(), 'tests', 'temp', `cli-test-${this.getDeterministicTimestamp()}`);
    templatesDir = path.join(testDir, '_templates');
    outputDir = path.join(testDir, 'output');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(outputDir);
    
    // Create test templates
    await createTestTemplates(templatesDir);
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original directory
    process.chdir(process.cwd().replace(`/tests/temp/cli-test-${this.getDeterministicTimestamp().toString().slice(-5)}`, ''));
    
    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('List Command', () => {
    it('should list available generators', async () => {
      const context = {
        args: {
          quiet: true,
          format: 'simple'
        }
      };

      const result = await listCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('generator'),
        data: expect.any(Array),
        duration: expect.any(Number)
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        templates: expect.any(Array)
      });
    });

    it('should list templates for specific generator', async () => {
      const context = {
        args: {
          generator: 'component',
          quiet: true,
          format: 'simple'
        }
      };

      const result = await listCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      if (result.data.length > 0) {
        expect(result.data[0].templates).toBeDefined();
        expect(result.data[0].templates.length).toBeGreaterThan(0);
      }
    });

    it('should handle non-existent generator gracefully', async () => {
      const context = {
        args: {
          generator: 'nonexistent',
          quiet: true
        }
      };

      // Should handle gracefully without throwing
      const result = await listCommand.run(context);
      // Note: The function handles errors internally, so we check it doesn't crash
      expect(typeof result).toBe('object');
    });

    it('should support different output formats', async () => {
      const formats = ['table', 'json', 'yaml', 'simple'];
      
      for (const format of formats) {
        const context = {
          args: {
            format,
            quiet: true
          }
        };

        const result = await listCommand.run(context);
        expect(result.success).toBe(true);
      }
    });

    it('should filter by search term', async () => {
      const context = {
        args: {
          search: 'component',
          quiet: true
        }
      };

      const result = await listCommand.run(context);
      expect(result.success).toBe(true);
    });
  });

  describe('Help Command', () => {
    it('should show general help when no arguments provided', async () => {
      const context = {
        args: {}
      };

      const result = await helpCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: 'Help displayed',
        files: []
      });
    });

    it('should show help for specific generator', async () => {
      const context = {
        args: {
          generator: 'component'
        }
      };

      const result = await helpCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('help'),
        files: []
      });
    });

    it('should show template-specific help', async () => {
      const context = {
        args: {
          generator: 'component',
          template: 'react'
        }
      };

      const result = await helpCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('help'),
        files: []
      });
    });

    it('should handle non-existent generator in help', async () => {
      const context = {
        args: {
          generator: 'nonexistent'
        }
      };

      const result = await helpCommand.run(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('Generate Command', () => {
    it('should generate files from template', async () => {
      const context = {
        args: {
          generator: 'component',
          template: 'react',
          name: 'TestComponent',
          dest: outputDir,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('generated'),
        files: expect.any(Array),
        duration: expect.any(Number)
      });

      // Check that files were actually created
      if (result.files.length > 0) {
        const firstFile = result.files[0];
        expect(await fs.pathExists(firstFile)).toBe(true);
      }
    });

    it('should support dry run mode', async () => {
      const context = {
        args: {
          generator: 'component',
          template: 'react',
          name: 'TestComponent',
          dest: outputDir,
          dry: true,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);

      expect(result).toMatchObject({
        success: true,
        message: expect.stringContaining('Dry run'),
        files: expect.any(Array)
      });

      // In dry run, files should not be created
      if (result.files.length > 0) {
        const firstFile = result.files[0];
        expect(await fs.pathExists(firstFile)).toBe(false);
      }
    });

    it('should handle missing generator gracefully', async () => {
      const context = {
        args: {
          generator: 'nonexistent',
          template: 'test',
          name: 'Test',
          dest: outputDir,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle missing template gracefully', async () => {
      const context = {
        args: {
          generator: 'component',
          template: 'nonexistent',
          name: 'Test',
          dest: outputDir,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle force flag', async () => {
      // Create a file first
      const testFile = path.join(outputDir, 'existing.txt');
      await fs.writeFile(testFile, 'existing content');

      const context = {
        args: {
          generator: 'component',
          template: 'react',
          name: 'TestComponent',
          dest: outputDir,
          force: true,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);
      expect(result.success).toBe(true);
    });

    it('should substitute template variables correctly', async () => {
      const context = {
        args: {
          generator: 'component',
          template: 'react',
          name: 'MyTestComponent',
          dest: outputDir,
          quiet: true
        }
      };

      const result = await generateCommand.run(context);
      expect(result.success).toBe(true);

      // Check that the generated file contains the substituted variable
      if (result.files.length > 0) {
        const generatedFile = result.files[0];
        if (await fs.pathExists(generatedFile)) {
          const content = await fs.readFile(generatedFile, 'utf8');
          expect(content).toContain('MyTestComponent');
        }
      }
    });
  });

  describe('CLI Integration', () => {
    it('should handle sequential command execution', async () => {
      // First list generators
      const listResult = await listCommand.run({
        args: { quiet: true }
      });
      expect(listResult.success).toBe(true);

      // Then get help for first generator
      if (listResult.data.length > 0) {
        const firstGenerator = listResult.data[0].name;
        const helpResult = await helpCommand.run({
          args: { generator: firstGenerator }
        });
        expect(helpResult.success).toBe(true);
      }
    });

    it('should validate command arguments properly', async () => {
      // Test various argument validation scenarios
      const invalidFormats = ['invalid-format'];
      
      for (const format of invalidFormats) {
        const context = {
          args: {
            format,
            quiet: true
          }
        };

        // Should handle gracefully
        const result = await listCommand.run(context);
        expect(typeof result).toBe('object');
      }
    });
  });
});

/**
 * Helper function to create test templates
 */
async function createTestTemplates(templatesDir) {
  // Create component generator with react template
  const componentDir = path.join(templatesDir, 'component');
  const reactTemplateDir = path.join(componentDir, 'react');
  
  await fs.ensureDir(reactTemplateDir);
  
  // Create a simple React component template
  const componentTemplate = `---
to: "{{ name }}.tsx"
---
import React from 'react';

interface {{ name }}Props {
  // Add props here
}

const {{ name }}: React.FC<{{ name }}Props> = () => {
  return (
    <div className="{{ name | kebabCase }}">
      <h1>{{ name }}</h1>
    </div>
  );
};

export default {{ name }};
`;

  await fs.writeFile(
    path.join(reactTemplateDir, 'component.njk'),
    componentTemplate
  );

  // Create a service generator
  const serviceDir = path.join(templatesDir, 'service');
  const apiTemplateDir = path.join(serviceDir, 'api');
  
  await fs.ensureDir(apiTemplateDir);
  
  const serviceTemplate = `---
to: "{{ name | kebabCase }}.service.ts"
---
export class {{ name }}Service {
  constructor() {
    // Service initialization
  }

  async get{{ name }}(): Promise<{{ name }}[]> {
    // Implementation here
    return [];
  }
}
`;

  await fs.writeFile(
    path.join(apiTemplateDir, 'service.njk'),
    serviceTemplate
  );

  // Create a simple index template file (for testing direct file templates)
  await fs.writeFile(
    path.join(componentDir, 'index.njk'),
    'export { default } from "./{{ name }}";'
  );
}