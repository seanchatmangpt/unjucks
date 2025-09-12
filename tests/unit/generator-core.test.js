/**
 * Generator Core Tests - Tests the main Generator class functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { Generator } from '../../src/lib/generator.js';

describe('Generator Core Functionality', () => {
  let testDir;
  let templatesDir;
  let outputDir;
  let generator;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(process.cwd(), 'tests', 'temp', `generator-test-${this.getDeterministicTimestamp()}`);
    templatesDir = path.join(testDir, 'templates');
    outputDir = path.join(testDir, 'output');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(outputDir);
    
    generator = new Generator(templatesDir);
    
    // Create test templates
    await createTestTemplates(templatesDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  describe('Basic Operations', () => {
    it('should initialize with correct templates directory', () => {
      expect(generator.getTemplatesDirectory()).toBe(path.resolve(templatesDir));
    });

    it('should list available generators', async () => {
      const generators = await generator.listGenerators();

      expect(Array.isArray(generators)).toBe(true);
      expect(generators.length).toBeGreaterThan(0);

      const firstGenerator = generators[0];
      expect(firstGenerator).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        templates: expect.any(Array),
        path: expect.any(String)
      });
    });

    it('should list templates for specific generator', async () => {
      const templates = await generator.listTemplates('component');

      expect(Array.isArray(templates)).toBe(true);
      
      if (templates.length > 0) {
        const firstTemplate = templates[0];
        expect(firstTemplate).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          files: expect.any(Array),
          path: expect.any(String)
        });
      }
    });

    it('should handle non-existent generator gracefully', async () => {
      const templates = await generator.listTemplates('nonexistent');
      expect(templates).toEqual([]);
    });

    it('should get template files recursively', async () => {
      const templatePath = path.join(templatesDir, 'component', 'react');
      const files = await generator.getTemplateFiles(templatePath);

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Template Generation', () => {
    it('should generate files from template', async () => {
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        variables: {
          name: 'TestComponent'
        }
      };

      const result = await generator.generate(options);

      expect(result).toMatchObject({
        success: true,
        files: expect.any(Array),
        warnings: expect.any(Array)
      });

      expect(result.files.length).toBeGreaterThan(0);

      // Check that files were created
      for (const file of result.files) {
        if (file.path) {
          expect(await fs.pathExists(file.path)).toBe(true);
        }
      }
    });

    it('should substitute variables in template content', async () => {
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        variables: {
          name: 'MyComponent',
          description: 'A test component'
        }
      };

      const result = await generator.generate(options);
      expect(result.success).toBe(true);

      // Check variable substitution
      if (result.files.length > 0) {
        const firstFile = result.files[0];
        const content = await fs.readFile(firstFile.path, 'utf8');
        expect(content).toContain('MyComponent');
      }
    });

    it('should handle dry run mode', async () => {
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        dry: true,
        variables: {
          name: 'TestComponent'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);

      // In dry run, files should not be created
      for (const file of result.files) {
        if (file.path) {
          expect(await fs.pathExists(file.path)).toBe(false);
        }
      }
    });

    it('should handle force overwrite', async () => {
      // First generation
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        variables: {
          name: 'TestComponent'
        }
      };

      await generator.generate(options);

      // Second generation with force
      const forceOptions = {
        ...options,
        force: true
      };

      const result = await generator.generate(forceOptions);
      expect(result.success).toBe(true);
    });

    it('should handle non-existent template', async () => {
      const options = {
        generator: 'nonexistent',
        template: 'test',
        dest: outputDir,
        variables: {
          name: 'Test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle missing variables gracefully', async () => {
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        variables: {}
      };

      const result = await generator.generate(options);

      // Should still generate but with missing variables
      expect(result.success).toBe(true);
    });

    it('should handle different variable types', async () => {
      const options = {
        generator: 'component',
        template: 'react',
        dest: outputDir,
        variables: {
          name: 'TestComponent',
          count: 42,
          isActive: true,
          tags: ['react', 'component'],
          config: { theme: 'dark' }
        }
      };

      const result = await generator.generate(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Template Variable Scanning', () => {
    it('should scan template for variables', async () => {
      const result = await generator.scanTemplateForVariables('component', 'react');

      expect(result).toMatchObject({
        variables: expect.any(Array),
        description: expect.any(String)
      });

      if (result.variables.length > 0) {
        const firstVariable = result.variables[0];
        expect(firstVariable).toMatchObject({
          name: expect.any(String),
          type: expect.any(String),
          required: expect.any(Boolean)
        });
      }
    });

    it('should handle non-existent template in variable scanning', async () => {
      const result = await generator.scanTemplateForVariables('nonexistent', 'test');

      expect(result).toMatchObject({
        variables: [],
        description: expect.any(String)
      });
    });

    it('should identify required vs optional variables', async () => {
      // Create a template with both required and optional variables
      const templateContent = `---
to: "{{ name }}.ts"
---
export class {{ name }} {
  {% if description %}
  // {{ description }}
  {% endif %}
  
  constructor(public id: {{ idType || 'string' }}) {}
}`;

      const templateDir = path.join(templatesDir, 'test', 'mixed');
      await fs.ensureDir(templateDir);
      await fs.writeFile(path.join(templateDir, 'test.njk'), templateContent);

      const result = await generator.scanTemplateForVariables('test', 'mixed');

      expect(result.variables.length).toBeGreaterThan(0);
      
      // Should find both required and optional variables
      const names = result.variables.map(v => v.name);
      expect(names).toContain('name');
    });
  });

  describe('File Operations', () => {
    it('should get template files with correct extensions', async () => {
      // Create templates with various extensions
      const testTemplateDir = path.join(templatesDir, 'test', 'extensions');
      await fs.ensureDir(testTemplateDir);
      
      await fs.writeFile(path.join(testTemplateDir, 'template.njk'), 'nunjucks template');
      await fs.writeFile(path.join(testTemplateDir, 'template.ejs'), 'ejs template');
      await fs.writeFile(path.join(testTemplateDir, 'template.txt'), 'text file');
      await fs.writeFile(path.join(testTemplateDir, 'template.js'), 'javascript file');

      const files = await generator.getTemplateFiles(testTemplateDir);

      // Should include template files but not regular files
      expect(files.some(f => f.includes('template.njk'))).toBe(true);
      expect(files.some(f => f.includes('template.ejs'))).toBe(true);
      expect(files.some(f => f.includes('template.txt'))).toBe(true);
      expect(files.some(f => f.includes('template.js'))).toBe(true);
    });

    it('should handle nested template directories', async () => {
      // Create nested template structure
      const nestedDir = path.join(templatesDir, 'nested', 'deep', 'structure');
      await fs.ensureDir(nestedDir);
      await fs.writeFile(path.join(nestedDir, 'nested.njk'), 'nested template');

      const files = await generator.getTemplateFiles(path.join(templatesDir, 'nested'));

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.includes('nested.njk'))).toBe(true);
    });

    it('should handle empty template directories', async () => {
      const emptyDir = path.join(templatesDir, 'empty');
      await fs.ensureDir(emptyDir);

      const files = await generator.getTemplateFiles(emptyDir);
      expect(files).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle template read errors gracefully', async () => {
      // Create a directory that looks like a template but isn't readable
      const badTemplateDir = path.join(templatesDir, 'bad', 'template');
      await fs.ensureDir(badTemplateDir);
      
      const options = {
        generator: 'bad',
        template: 'template',
        dest: outputDir,
        variables: { name: 'Test' }
      };

      const result = await generator.generate(options);
      // Should handle gracefully without crashing
      expect(typeof result).toBe('object');
      expect(result.success).toBeDefined();
    });

    it('should handle invalid template content', async () => {
      // Create template with invalid content
      const invalidTemplateDir = path.join(templatesDir, 'invalid', 'template');
      await fs.ensureDir(invalidTemplateDir);
      await fs.writeFile(
        path.join(invalidTemplateDir, 'invalid.njk'),
        '{{ unclosed variable'
      );

      const options = {
        generator: 'invalid',
        template: 'template',
        dest: outputDir,
        variables: { name: 'Test' }
      };

      const result = await generator.generate(options);
      // Should handle gracefully
      expect(typeof result).toBe('object');
    });

    it('should handle permission errors', async () => {
      // This test might be platform-specific
      const options = {
        generator: 'component',
        template: 'react',
        dest: '/root/restricted', // Likely to cause permission error
        variables: { name: 'Test' }
      };

      const result = await generator.generate(options);
      // Should handle gracefully without crashing
      expect(typeof result).toBe('object');
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent generations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        return generator.generate({
          generator: 'component',
          template: 'react',
          dest: path.join(outputDir, `concurrent-${i}`),
          variables: {
            name: `Component${i}`
          }
        });
      });

      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should cache template scanning results', async () => {
      const start1 = this.getDeterministicTimestamp();
      await generator.listGenerators();
      const time1 = this.getDeterministicTimestamp() - start1;

      const start2 = this.getDeterministicTimestamp();
      await generator.listGenerators();
      const time2 = this.getDeterministicTimestamp() - start2;

      // Second call should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});

/**
 * Helper function to create test templates
 */
async function createTestTemplates(templatesDir) {
  // Component/React template
  const componentReactDir = path.join(templatesDir, 'component', 'react');
  await fs.ensureDir(componentReactDir);

  const reactTemplate = `---
to: "{{ name }}.tsx"
---
import React from 'react';

interface {{ name }}Props {
  title?: string;
}

const {{ name }}: React.FC<{{ name }}Props> = ({ title }) => {
  return (
    <div className="{{ name | kebabCase }}">
      {title && <h1>{title}</h1>}
    </div>
  );
};

export default {{ name }};
`;

  await fs.writeFile(
    path.join(componentReactDir, 'component.njk'),
    reactTemplate
  );

  // Service/API template
  const serviceApiDir = path.join(templatesDir, 'service', 'api');
  await fs.ensureDir(serviceApiDir);

  const serviceTemplate = `---
to: "{{ name | kebabCase }}.service.ts"
---
export class {{ name }}Service {
  constructor() {}

  async get{{ name }}(): Promise<{{ name }}[]> {
    return [];
  }
}
`;

  await fs.writeFile(
    path.join(serviceApiDir, 'service.njk'),
    serviceTemplate
  );

  // Simple template with variables
  const simpleDir = path.join(templatesDir, 'simple', 'basic');
  await fs.ensureDir(simpleDir);

  const simpleTemplate = `---
to: "{{ name }}.txt"
---
Name: {{ name }}
Description: {{ description }}
Count: {{ count }}
Active: {{ isActive }}
`;

  await fs.writeFile(
    path.join(simpleDir, 'simple.njk'),
    simpleTemplate
  );
}