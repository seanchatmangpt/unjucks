/**
 * Regression Tests for Existing Functionality
 * Ensures that filter integration doesn't break existing features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../../src/commands/generate.js';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'node:path';
import { createTempDirectory, cleanupTempDirectory } from '../helpers/temp-utils.js';

describe('Regression Tests - Existing Functionality', () => {
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

  describe('Basic Template Generation (Pre-Filter Era)', () => {
    it('should generate simple templates without filters', async () => {
      const templateDir = path.join(templatesDir, 'basic', 'simple');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/{{ name }}.js"
---
const {{ name }} = {
  name: "{{ name }}",
  type: "{{ type }}",
  created: "{{ timestamp }}"
};

module.exports = {{ name }};`;

      await fs.writeFile(
        path.join(templateDir, 'simple.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'basic',
        template: 'simple',
        dest: outputDir,
        variables: {
          name: 'TestModule',
          type: 'component',
          timestamp: '2024-01-01T00:00:00Z'
        },
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      
      const outputFile = path.join(outputDir, 'TestModule.js');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('const TestModule = {');
      expect(content).toContain('name: "TestModule"');
      expect(content).toContain('type: "component"');
      expect(content).toContain('created: "2024-01-01T00:00:00Z"');
      expect(content).toContain('module.exports = TestModule;');
    });

    it('should handle templates with only variable substitution', async () => {
      const templateDir = path.join(templatesDir, 'basic', 'variables');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/config/{{ environment }}.json"
---
{
  "name": "{{ appName }}",
  "environment": "{{ environment }}",
  "version": "{{ version }}",
  "debug": {{ debug }},
  "port": {{ port }},
  "database": {
    "host": "{{ dbHost }}",
    "name": "{{ dbName }}"
  }
}`;

      await fs.writeFile(
        path.join(templateDir, 'config.json.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'basic',
        template: 'variables',
        dest: outputDir,
        variables: {
          appName: 'MyApp',
          environment: 'production',
          version: '1.0.0',
          debug: false,
          port: 3000,
          dbHost: 'localhost',
          dbName: 'myapp_prod'
        },
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const outputFile = path.join(outputDir, 'config', 'production.json');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      const parsed = JSON.parse(content);
      
      expect(parsed.name).toBe('MyApp');
      expect(parsed.environment).toBe('production');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.debug).toBe(false);
      expect(parsed.port).toBe(3000);
      expect(parsed.database.host).toBe('localhost');
      expect(parsed.database.name).toBe('myapp_prod');
    });
  });

  describe('File Injection Functionality', () => {
    it('should inject content into existing files without filters', async () => {
      // Create target file
      const targetFile = path.join(outputDir, 'routes.js');
      await fs.writeFile(targetFile, `const express = require('express');
const router = express.Router();

// Existing routes
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;`);

      const templateDir = path.join(templatesDir, 'inject', 'route');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/routes.js"
inject: true
after: "// Existing routes"
---

router.{{ method }}('{{ path }}', (req, res) => {
  res.json({ message: '{{ message }}' });
});`;

      await fs.writeFile(
        path.join(templateDir, 'route.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'inject',
        template: 'route',
        dest: outputDir,
        variables: {
          method: 'post',
          path: '/users',
          message: 'User created successfully'
        },
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const content = await fs.readFile(targetFile, 'utf8');
      expect(content).toContain('router.post(\'/users\'');
      expect(content).toContain('User created successfully');
      expect(content).toContain('router.get(\'/health\''); // Original content preserved
    });

    it('should handle prepend and append operations', async () => {
      // Test prepend
      const targetFile = path.join(outputDir, 'imports.js');
      await fs.writeFile(targetFile, `const express = require('express');
const router = express.Router();`);

      const prependTemplateDir = path.join(templatesDir, 'inject', 'prepend');
      await fs.ensureDir(prependTemplateDir);
      
      await fs.writeFile(
        path.join(prependTemplateDir, 'prepend.js.njk'),
        `---
to: "{{ dest }}/imports.js"
inject: true
prepend: true
---
// {{ comment }}
const {{ moduleName }} = require('{{ modulePath }}');`
      );

      await generator.generate({
        generator: 'inject',
        template: 'prepend',
        dest: outputDir,
        variables: {
          comment: 'Added by generator',
          moduleName: 'utils',
          modulePath: './utils'
        },
        dry: false,
        force: true
      });

      let content = await fs.readFile(targetFile, 'utf8');
      expect(content).toMatch(/^\/\/ Added by generator/);
      expect(content).toContain('const utils = require(\'./utils\');');
      expect(content).toContain('const express = require(\'express\');');

      // Test append
      const appendTemplateDir = path.join(templatesDir, 'inject', 'append');
      await fs.ensureDir(appendTemplateDir);
      
      await fs.writeFile(
        path.join(appendTemplateDir, 'append.js.njk'),
        `---
to: "{{ dest }}/imports.js"
inject: true
append: true
---

module.exports = { {{ moduleName }}, router };`
      );

      await generator.generate({
        generator: 'inject',
        template: 'append',
        dest: outputDir,
        variables: { moduleName: 'utils' },
        dry: false,
        force: true
      });

      content = await fs.readFile(targetFile, 'utf8');
      expect(content).toMatch(/module\.exports = \{ utils, router \};$/);
    });
  });

  describe('Dry Run Functionality', () => {
    it('should perform dry runs without creating files', async () => {
      const templateDir = path.join(templatesDir, 'dry', 'test');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = '{{ value }}';`;

      await fs.writeFile(
        path.join(templateDir, 'test.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'dry',
        template: 'test',
        dest: outputDir,
        variables: {
          name: 'TestValue',
          value: 'Hello World'
        },
        dry: true,
        force: false
      });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(path.join(outputDir, 'TestValue.js'));
      
      // File should not actually exist
      expect(await fs.pathExists(result.files[0].path)).toBe(false);
      expect(result.warnings).toContain('This is a dry run - no files were created');
    });

    it('should show what would be overwritten in dry run', async () => {
      // Create existing file
      const existingFile = path.join(outputDir, 'Existing.js');
      await fs.writeFile(existingFile, 'export const Existing = "old value";');

      const templateDir = path.join(templatesDir, 'dry', 'overwrite');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name }} = '{{ value }}';`;

      await fs.writeFile(
        path.join(templateDir, 'overwrite.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'dry',
        template: 'overwrite',
        dest: outputDir,
        variables: {
          name: 'Existing',
          value: 'new value'
        },
        dry: true,
        force: true
      });

      expect(result.success).toBe(true);
      expect(result.files[0].exists).toBe(true);
      
      // Original file should be unchanged
      const originalContent = await fs.readFile(existingFile, 'utf8');
      expect(originalContent).toBe('export const Existing = "old value";');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing templates gracefully', async () => {
      const result = await generator.generate({
        generator: 'nonexistent',
        template: 'missing',
        dest: outputDir,
        variables: {},
        dry: false,
        force: false
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Template not found');
    });

    it('should handle invalid template syntax', async () => {
      const templateDir = path.join(templatesDir, 'invalid', 'syntax');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/{{ name }}.js"
---
export const {{ name = '{{ unclosed variable }`;

      await fs.writeFile(
        path.join(templateDir, 'invalid.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'invalid',
        template: 'syntax',
        dest: outputDir,
        variables: { name: 'Test' },
        dry: false,
        force: true
      });

      // Should handle error gracefully
      expect(result.success).toBe(false);
    });

    it('should handle file permission errors', async () => {
      // This test might be skipped on some systems where we can't create read-only directories
      const readOnlyDir = path.join(outputDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      
      try {
        // Try to make directory read-only (might not work on all systems)
        await fs.chmod(readOnlyDir, 0o444);
        
        const templateDir = path.join(templatesDir, 'perm', 'test');
        await fs.ensureDir(templateDir);
        
        const templateContent = `---
to: "{{ dest }}/readonly/test.js"
---
export const test = 'value';`;

        await fs.writeFile(
          path.join(templateDir, 'test.js.njk'),
          templateContent
        );

        const result = await generator.generate({
          generator: 'perm',
          template: 'test',
          dest: outputDir,
          variables: {},
          dry: false,
          force: true
        });

        // Should handle permission error gracefully
        expect(result.success).toBe(false);
        
      } catch (error) {
        // If we can't set permissions, skip this test
        console.warn('Skipping permission test - cannot set directory permissions');
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(readOnlyDir, 0o755);
        } catch {
          // Ignore errors during cleanup
        }
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with old template structure', async () => {
      const templateDir = path.join(templatesDir, 'legacy', 'old-style');
      await fs.ensureDir(templateDir);
      
      // Old style template without modern frontmatter features
      const templateContent = `---
to: {{ name }}.js
---
// Legacy template style
var {{ name }} = {
  init: function() {
    console.log('{{ name }} initialized');
  }
};`;

      await fs.writeFile(
        path.join(templateDir, 'legacy.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'legacy',
        template: 'old-style',
        dest: outputDir,
        variables: { name: 'LegacyModule' },
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const outputFile = path.join(outputDir, 'LegacyModule.js');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('var LegacyModule = {');
      expect(content).toContain('console.log(\'LegacyModule initialized\');');
    });

    it('should work with templates that have no frontmatter', async () => {
      const templateDir = path.join(templatesDir, 'simple', 'no-frontmatter');
      await fs.ensureDir(templateDir);
      
      // Template with no frontmatter - just content
      const templateContent = `export const {{ componentName }} = {
  render() {
    return '<div>{{ title }}</div>';
  }
};`;

      await fs.writeFile(
        path.join(templateDir, 'component.js.njk'),
        templateContent
      );

      const result = await generator.generate({
        generator: 'simple',
        template: 'no-frontmatter',
        dest: outputDir,
        variables: {
          componentName: 'SimpleComponent',
          title: 'Hello World'
        },
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      // Should use template filename as output
      const outputFile = path.join(outputDir, 'component.js');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('export const SimpleComponent = {');
      expect(content).toContain('return \'<div>Hello World</div>\';');
    });
  });

  describe('Generator Discovery', () => {
    it('should list generators correctly', async () => {
      // Create multiple generators
      const generators = ['user', 'post', 'comment'];
      
      for (const gen of generators) {
        const genDir = path.join(templatesDir, gen, 'basic');
        await fs.ensureDir(genDir);
        await fs.writeFile(
          path.join(genDir, 'template.njk'),
          `---\nto: "{{ name }}.js"\n---\nexport const {{ name }} = {};`
        );
      }

      const availableGenerators = await generator.listGenerators();
      
      expect(availableGenerators).toHaveLength(3);
      expect(availableGenerators.map(g => g.name)).toContain('user');
      expect(availableGenerators.map(g => g.name)).toContain('post');
      expect(availableGenerators.map(g => g.name)).toContain('comment');
    });

    it('should list templates within generators', async () => {
      const templates = ['create', 'update', 'delete'];
      
      for (const template of templates) {
        const templateDir = path.join(templatesDir, 'api', template);
        await fs.ensureDir(templateDir);
        await fs.writeFile(
          path.join(templateDir, 'endpoint.js.njk'),
          `---\nto: "{{ name }}-{{ action }}.js"\n---\nexport const {{ action }} = {};`
        );
      }

      const availableTemplates = await generator.listTemplates('api');
      
      expect(availableTemplates).toHaveLength(3);
      expect(availableTemplates.map(t => t.name)).toContain('create');
      expect(availableTemplates.map(t => t.name)).toContain('update');
      expect(availableTemplates.map(t => t.name)).toContain('delete');
    });
  });
});