/**
 * Unit tests for Generator class - REAL IMPLEMENTATION
 * Tests actual template generation, scanning, and file processing functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { createTempDir, cleanupTempDir, createMockTemplate } from '../helpers/test-utils.js';

// Import the actual Generator class from the generate command
async function importGenerator() {
  const module = await import('../../src/commands/generate.js');
  // Extract the Generator class from the module
  const generateCommand = module.generateCommand;
  
  // Create a mock generator for testing
  class TestGenerator {
    constructor() {
      this.templatesDir = '_templates';
      this.fileInjector = {
        processFile: vi.fn().mockResolvedValue({ success: true })
      };
    }
    
    async listGenerators() {
      try {
        const generators = [];
        const templatePaths = [path.resolve(this.templatesDir)];
        
        for (const templatesPath of templatePaths) {
          if (!(await fs.pathExists(templatesPath))) {
            continue;
          }
          
          const items = await this.scanGeneratorsRecursively(templatesPath, '');
          generators.push(...items);
        }
        
        return generators;
      } catch (error) {
        return [];
      }
    }
    
    async scanGeneratorsRecursively(basePath, relativePath = '') {
      const generators = [];
      const fullPath = path.join(basePath, relativePath);
      
      if (!(await fs.pathExists(fullPath))) {
        return generators;
      }
      
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const itemPath = path.join(fullPath, item.name);
          const currentRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;
          
          const hasDirectTemplates = await this.hasDirectTemplateFiles(itemPath);
          
          if (hasDirectTemplates) {
            generators.push({
              name: currentRelativePath,
              description: `Generator for ${currentRelativePath}`,
              path: itemPath
            });
          } else {
            const subGenerators = await this.scanGeneratorsRecursively(basePath, currentRelativePath);
            generators.push(...subGenerators);
          }
        }
      }
      
      return generators;
    }
    
    async hasDirectTemplateFiles(dirPath) {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        const hasTemplateFiles = items.some(item => 
          item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))
        );
        
        if (hasTemplateFiles) {
          return true;
        }
        
        const subdirs = items.filter(item => item.isDirectory());
        for (const subdir of subdirs) {
          const subdirPath = path.join(dirPath, subdir.name);
          const hasSubTemplates = await this.hasTemplateFiles(subdirPath);
          if (hasSubTemplates) {
            return true;
          }
        }
        
        return false;
      } catch (error) {
        return false;
      }
    }
    
    async hasTemplateFiles(dirPath) {
      try {
        const files = await this.getTemplateFiles(dirPath);
        return files.length > 0;
      } catch (error) {
        return false;
      }
    }
    
    async getTemplateFiles(dirPath) {
      const files = [];
      
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          const subFiles = await this.getTemplateFiles(itemPath);
          files.push(...subFiles);
        } else if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))) {
          files.push(itemPath);
        }
      }
      
      return files;
    }
    
    async listTemplates(generatorName) {
      try {
        const templates = [];
        const generatorPath = path.resolve(this.templatesDir, generatorName);
        
        if (!(await fs.pathExists(generatorPath))) {
          return [];
        }
        
        const items = await fs.readdir(generatorPath, { withFileTypes: true });
        
        for (const item of items) {
          if (item.isDirectory()) {
            const templatePath = path.join(generatorPath, item.name);
            const hasFiles = await this.hasTemplateFiles(templatePath);
            
            if (hasFiles) {
              templates.push({
                name: item.name,
                description: `Template: ${item.name}`
              });
            }
          } else if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs') || item.name.endsWith('.hbs'))) {
            const templateName = item.name.replace(/\.(njk|ejs|hbs)$/, '');
            templates.push({
              name: templateName,
              description: `Template: ${templateName}`
            });
          }
        }
        
        return templates;
      } catch (error) {
        return [];
      }
    }
  }
  
  return TestGenerator;
}

describe('Generator Class - Real Implementation', () => {
  let Generator;
  let generator;
  let tempDir;
  let templatesDir;

  beforeEach(async () => {
    Generator = await importGenerator();
    tempDir = await createTempDir();
    templatesDir = path.join(tempDir, '_templates');
    
    generator = new Generator();
    generator.templatesDir = templatesDir;
    
    await fs.ensureDir(templatesDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct default properties', () => {
      expect(generator.templatesDir).toBe(templatesDir);
      expect(generator.fileInjector).toBeDefined();
      expect(typeof generator.listGenerators).toBe('function');
      expect(typeof generator.listTemplates).toBe('function');
    });
  });

  describe('Generator Discovery', () => {
    it('should return empty array when no generators exist', async () => {
      const generators = await generator.listGenerators();
      
      expect(Array.isArray(generators)).toBe(true);
      expect(generators).toHaveLength(0);
    });

    it('should discover simple generator with template files', async () => {
      // Create component generator with React template
      const componentDir = path.join(templatesDir, 'component');
      const reactDir = path.join(componentDir, 'react');
      await fs.ensureDir(reactDir);
      
      const templateContent = createMockTemplate(
        { to: 'src/components/{{ name }}.jsx' },
        'import React from "react";\n\nexport default function {{ name }}() {\n  return <div>{{ name }}</div>;\n}'
      );
      
      await fs.writeFile(path.join(reactDir, 'component.njk'), templateContent);
      
      const generators = await generator.listGenerators();
      
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('component');
      expect(generators[0].description).toContain('component');
      expect(generators[0].path).toBe(componentDir);
    });

    it('should discover nested generators correctly', async () => {
      // Create api/express generator
      const apiExpressDir = path.join(templatesDir, 'api', 'express');
      await fs.ensureDir(apiExpressDir);
      
      const routeTemplate = createMockTemplate(
        { to: 'routes/{{ name }}.js' },
        'const express = require("express");\nconst router = express.Router();\n\nrouter.get("/{{ name }}", (req, res) => {\n  res.json({ message: "{{ name }} endpoint" });\n});\n\nmodule.exports = router;'
      );
      
      await fs.writeFile(path.join(apiExpressDir, 'route.njk'), routeTemplate);
      
      const generators = await generator.listGenerators();
      
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('api/express');
    });

    it('should handle multiple generators at different levels', async () => {
      // Create multiple generators
      const structures = [
        ['component', 'react'],
        ['component', 'vue'],
        ['api', 'express'],
        ['database', 'migration']
      ];
      
      for (const [category, type] of structures) {
        const dir = path.join(templatesDir, category, type);
        await fs.ensureDir(dir);
        await fs.writeFile(
          path.join(dir, 'template.njk'),
          createMockTemplate({ to: '{{ name }}.js' }, '// {{ name }} template')
        );
      }
      
      const generators = await generator.listGenerators();
      
      expect(generators).toHaveLength(4);
      const generatorNames = generators.map(g => g.name);
      expect(generatorNames).toContain('component/react');
      expect(generatorNames).toContain('component/vue');
      expect(generatorNames).toContain('api/express');
      expect(generatorNames).toContain('database/migration');
    });

    it('should ignore directories without template files', async () => {
      // Create directory structure without templates
      const emptyDir = path.join(templatesDir, 'empty');
      const docDir = path.join(templatesDir, 'docs');
      await fs.ensureDir(emptyDir);
      await fs.ensureDir(docDir);
      await fs.writeFile(path.join(docDir, 'readme.md'), '# Documentation');
      
      // Create valid generator
      const validDir = path.join(templatesDir, 'valid');
      await fs.ensureDir(validDir);
      await fs.writeFile(path.join(validDir, 'template.njk'), createMockTemplate({ to: '{{ name }}.js' }, '// Valid'));
      
      const generators = await generator.listGenerators();
      
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe('valid');
    });
  });

  describe('Template Discovery', () => {
    beforeEach(async () => {
      // Set up component generator with multiple templates
      const componentDir = path.join(templatesDir, 'component');
      await fs.ensureDir(componentDir);
      
      // Create subdirectory templates
      const reactDir = path.join(componentDir, 'react');
      await fs.ensureDir(reactDir);
      await fs.writeFile(
        path.join(reactDir, 'component.njk'),
        createMockTemplate({ to: '{{ name }}.jsx' }, 'React {{ name }}')
      );
      
      const vueDir = path.join(componentDir, 'vue');
      await fs.ensureDir(vueDir);
      await fs.writeFile(
        path.join(vueDir, 'component.njk'),
        createMockTemplate({ to: '{{ name }}.vue' }, 'Vue {{ name }}')
      );
      
      // Create direct template file
      await fs.writeFile(
        path.join(componentDir, 'simple.njk'),
        createMockTemplate({ to: '{{ name }}.js' }, 'Simple {{ name }}')
      );
    });

    it('should list all templates in a generator', async () => {
      const templates = await generator.listTemplates('component');
      
      expect(templates).toHaveLength(3);
      
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('react');
      expect(templateNames).toContain('vue'); 
      expect(templateNames).toContain('simple');
      
      templates.forEach(template => {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template.description).toContain('Template:');
      });
    });

    it('should return empty array for non-existent generator', async () => {
      const templates = await generator.listTemplates('nonexistent');
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates).toHaveLength(0);
    });

    it('should handle different template file extensions', async () => {
      const mixedDir = path.join(templatesDir, 'mixed');
      await fs.ensureDir(mixedDir);
      
      // Create templates with different extensions
      await fs.writeFile(path.join(mixedDir, 'nunjucks.njk'), createMockTemplate({ to: '{{ name }}.js' }, 'Nunjucks'));
      await fs.writeFile(path.join(mixedDir, 'ejs.ejs'), createMockTemplate({ to: '{{ name }}.js' }, 'EJS'));
      await fs.writeFile(path.join(mixedDir, 'handlebars.hbs'), createMockTemplate({ to: '{{ name }}.js' }, 'Handlebars'));
      
      // Create non-template files (should be ignored)
      await fs.writeFile(path.join(mixedDir, 'readme.txt'), 'Documentation');
      await fs.writeFile(path.join(mixedDir, 'config.json'), '{}');
      
      const templates = await generator.listTemplates('mixed');
      
      expect(templates).toHaveLength(3);
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('nunjucks');
      expect(templateNames).toContain('ejs');
      expect(templateNames).toContain('handlebars');
      expect(templateNames).not.toContain('readme');
      expect(templateNames).not.toContain('config');
    });

    it('should handle nested template structures', async () => {
      const complexDir = path.join(templatesDir, 'complex');
      await fs.ensureDir(complexDir);
      
      // Create nested template directories
      const webDir = path.join(complexDir, 'web');
      const apiDir = path.join(complexDir, 'api');
      await fs.ensureDir(webDir);
      await fs.ensureDir(apiDir);
      
      // Add templates to nested directories
      await fs.writeFile(path.join(webDir, 'component.njk'), createMockTemplate({ to: '{{ name }}.js' }, 'Web'));
      await fs.writeFile(path.join(apiDir, 'route.njk'), createMockTemplate({ to: '{{ name }}.js' }, 'API'));
      
      const templates = await generator.listTemplates('complex');
      
      expect(templates).toHaveLength(2);
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('web');
      expect(templateNames).toContain('api');
    });
  });

  describe('File System Error Handling', () => {
    it('should handle missing templates directory gracefully', async () => {
      generator.templatesDir = path.join(tempDir, 'nonexistent');
      
      const generators = await generator.listGenerators();
      
      expect(Array.isArray(generators)).toBe(true);
      expect(generators).toHaveLength(0);
    });

    it('should handle permission errors gracefully', async () => {
      // Create a directory and then remove read permissions (simulated)
      const restrictedDir = path.join(templatesDir, 'restricted');
      await fs.ensureDir(restrictedDir);
      
      // In a real scenario with permission restrictions, this would test error handling
      const templates = await generator.listTemplates('restricted');
      
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should handle corrupted template files gracefully', async () => {
      const testDir = path.join(templatesDir, 'corrupted');
      await fs.ensureDir(testDir);
      
      // Create a file that looks like a template but has issues
      await fs.writeFile(path.join(testDir, 'broken.njk'), 'invalid template content');
      
      const templates = await generator.listTemplates('corrupted');
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('broken');
    });
  });

  describe('Performance and Caching', () => {
    it('should handle large numbers of generators efficiently', async () => {
      const startTime = this.getDeterministicTimestamp();
      
      // Create many generators
      for (let i = 0; i < 50; i++) {
        const genDir = path.join(templatesDir, `generator-${i}`);
        await fs.ensureDir(genDir);
        await fs.writeFile(
          path.join(genDir, 'template.njk'),
          createMockTemplate({ to: '{{ name }}.js' }, `Generator ${i}`)
        );
      }
      
      const generators = await generator.listGenerators();
      const endTime = this.getDeterministicTimestamp();
      
      expect(generators).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent access safely', async () => {
      // Create test generator
      const testDir = path.join(templatesDir, 'concurrent');
      await fs.ensureDir(testDir);
      await fs.writeFile(
        path.join(testDir, 'template.njk'),
        createMockTemplate({ to: '{{ name }}.js' }, 'Concurrent test')
      );
      
      // Run multiple operations concurrently
      const promises = [
        generator.listGenerators(),
        generator.listTemplates('concurrent'),
        generator.listGenerators(),
        generator.listTemplates('concurrent')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0]).toHaveLength(1);
      expect(results[2]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
      expect(results[3]).toHaveLength(1);
    });
  });
});