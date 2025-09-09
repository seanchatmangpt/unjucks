/**
 * Tests for PerfectTemplateEngine - Zero Parsing Error System
 * Tests rendering, error recovery, and template validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerfectTemplateEngine, renderTemplate, validateTemplate, extractTemplateVariables } from '../../src/lib/template-engine-perfect.js';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

describe('PerfectTemplateEngine', () => {
  let engine;
  let tempDir;
  let templatePath;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'unjucks-test-' + Date.now());
    await fs.ensureDir(tempDir);
    
    engine = new PerfectTemplateEngine({
      templatesDir: tempDir,
      enableCaching: true,
      autoescape: false,
      throwOnUndefined: false
    });
    
    templatePath = path.join(tempDir, 'test.njk');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Template Engine Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultEngine = new PerfectTemplateEngine();
      expect(defaultEngine.config.templatesDir).toBe('_templates');
      expect(defaultEngine.config.enableCaching).toBe(true);
      expect(defaultEngine.config.autoescape).toBe(false);
      expect(defaultEngine.config.throwOnUndefined).toBe(false);
    });

    it('should override default configuration with options', () => {
      const customEngine = new PerfectTemplateEngine({
        templatesDir: '/custom/path',
        autoescape: true,
        throwOnUndefined: true,
        enableCaching: false,
        maxCacheSize: 500
      });
      
      expect(customEngine.config.templatesDir).toBe('/custom/path');
      expect(customEngine.config.autoescape).toBe(true);
      expect(customEngine.config.throwOnUndefined).toBe(true);
      expect(customEngine.config.enableCaching).toBe(false);
      expect(customEngine.config.maxCacheSize).toBe(500);
    });

    it('should initialize all required engines and parsers', () => {
      expect(engine.nunjucksEnv).toBeDefined();
      expect(engine.ejsOptions).toBeDefined();
      expect(engine.frontmatterParser).toBeDefined();
      expect(engine.templateCache).toBeDefined();
      expect(engine.compiledCache).toBeDefined();
    });
  });

  describe('Template Type Detection', () => {
    it('should detect Nunjucks templates by extension', () => {
      expect(engine.detectTemplateType('template.njk')).toBe('nunjucks');
      expect(engine.detectTemplateType('template.nunjucks')).toBe('nunjucks');
    });

    it('should detect EJS templates by extension', () => {
      expect(engine.detectTemplateType('template.ejs')).toBe('ejs');
    });

    it('should detect Handlebars templates by extension', () => {
      expect(engine.detectTemplateType('template.hbs')).toBe('handlebars');
      expect(engine.detectTemplateType('template.handlebars')).toBe('handlebars');
    });

    it('should default to Nunjucks for unknown extensions', () => {
      expect(engine.detectTemplateType('template.txt')).toBe('nunjucks');
      expect(engine.detectTemplateType('template.html')).toBe('nunjucks');
      expect(engine.detectTemplateType('template')).toBe('nunjucks');
    });
  });

  describe('Basic Template Rendering', () => {
    it('should render simple Nunjucks template', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { name: 'World' });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello World!');
      expect(result.templateType).toBe('nunjucks');
    });

    it('should render template with filters', async () => {
      const content = 'Hello {{ name | upper }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { name: 'world' });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello WORLD!');
    });

    it('should render template with frontmatter', async () => {
      const content = `---
to: "output.txt"
variables:
  greeting: "Hello"
---
{{ greeting }} {{ name }}!`;
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { name: 'World' });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello World!');
      expect(result.frontmatter.to).toBe('output.txt');
      expect(result.frontmatter.variables.greeting).toBe('Hello');
    });

    it('should merge frontmatter variables with passed variables', async () => {
      const content = `---
variables:
  greeting: "Hello"
  punctuation: "!"
---
{{ greeting }} {{ name }}{{ punctuation }}`;
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { 
        name: 'World',
        greeting: 'Hi' // Should override frontmatter
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hi World!');
    });
  });

  describe('Custom Filters', () => {
    it('should support exists filter', async () => {
      const content = '{{ value | exists }}';
      await fs.writeFile(templatePath, content);
      
      const result1 = await engine.renderTemplate(templatePath, { value: 'test' });
      expect(result1.content).toBe('true');
      
      const result2 = await engine.renderTemplate(templatePath, { value: null });
      expect(result2.content).toBe('false');
      
      const result3 = await engine.renderTemplate(templatePath, {});
      expect(result3.content).toBe('false');
    });

    it('should support isEmpty filter', async () => {
      const content = '{{ value | isEmpty }}';
      await fs.writeFile(templatePath, content);
      
      const result1 = await engine.renderTemplate(templatePath, { value: [] });
      expect(result1.content).toBe('true');
      
      const result2 = await engine.renderTemplate(templatePath, { value: '' });
      expect(result2.content).toBe('true');
      
      const result3 = await engine.renderTemplate(templatePath, { value: {} });
      expect(result3.content).toBe('true');
      
      const result4 = await engine.renderTemplate(templatePath, { value: 'test' });
      expect(result4.content).toBe('false');
    });

    it('should support quote filter', async () => {
      const content = '{{ value | quote }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { value: 'test string' });
      expect(result.content).toBe('"test string"');
    });

    it('should support indent filter', async () => {
      const content = '{{ value | indent(4) }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { 
        value: 'line1\nline2\nline3' 
      });
      expect(result.content).toBe('line1\n    line2\n    line3');
    });

    it('should support comment filter', async () => {
      const content = '{{ value | comment("js") }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { value: 'This is a comment' });
      expect(result.content).toBe('// This is a comment');
    });
  });

  describe('Global Functions', () => {
    it('should provide uuid global function', async () => {
      const content = '{{ uuid() }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, {});
      expect(result.success).toBe(true);
      expect(result.content).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should provide range global function', async () => {
      const content = '{% for i in range(1, 4) %}{{ i }}{% endfor %}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, {});
      expect(result.success).toBe(true);
      expect(result.content).toBe('123');
    });

    it('should provide keys global function', async () => {
      const content = '{{ keys(obj) | join(",") }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { 
        obj: { a: 1, b: 2, c: 3 } 
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('a,b,c');
    });

    it('should provide values global function', async () => {
      const content = '{{ values(obj) | join(",") }}';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { 
        obj: { a: 1, b: 2, c: 3 } 
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('1,2,3');
    });
  });

  describe('Error Recovery', () => {
    it('should handle undefined variables gracefully', async () => {
      const content = 'Hello {{ undefinedVar }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, {});
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello !');
    });

    it('should attempt error recovery for invalid syntax', async () => {
      const content = 'Hello {{ invalidSyntax | nonExistentFilter }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { invalidSyntax: 'World' });
      // Should either succeed with fallback or fail gracefully
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('Template rendering failed');
      }
    });

    it('should handle missing template file', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.njk');
      
      const result = await engine.renderTemplate(nonExistentPath, {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Template Validation', () => {
    it('should validate correct template syntax', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const validation = await engine.validateTemplate(templatePath);
      expect(validation.valid).toBe(true);
      expect(validation.templateType).toBe('nunjucks');
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid template syntax', async () => {
      const content = 'Hello {% if name %}{{ name }}'; // Missing endif
      await fs.writeFile(templatePath, content);
      
      const validation = await engine.validateTemplate(templatePath);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Extraction', () => {
    it('should extract variables from simple template', async () => {
      const content = 'Hello {{ name }} and {{ age }}!';
      await fs.writeFile(templatePath, content);
      
      const variables = await engine.extractVariables(templatePath);
      expect(variables.variables).toContain('name');
      expect(variables.variables).toContain('age');
      expect(variables.variables).toHaveLength(2);
    });

    it('should extract variables from template with filters', async () => {
      const content = 'Hello {{ name | upper }} and {{ count | default(0) }}!';
      await fs.writeFile(templatePath, content);
      
      const variables = await engine.extractVariables(templatePath);
      expect(variables.variables).toContain('name');
      expect(variables.variables).toContain('count');
    });

    it('should extract variables from control structures', async () => {
      const content = '{% if isActive %}{{ name }}{% endif %}{% for item in items %}{{ item }}{% endfor %}';
      await fs.writeFile(templatePath, content);
      
      const variables = await engine.extractVariables(templatePath);
      expect(variables.variables).toContain('isActive');
      expect(variables.variables).toContain('name');
      expect(variables.variables).toContain('items');
    });

    it('should extract variables from frontmatter to field', async () => {
      const content = `---
to: "{{ directory }}/{{ filename }}.txt"
---
Hello {{ name }}!`;
      await fs.writeFile(templatePath, content);
      
      const variables = await engine.extractVariables(templatePath);
      expect(variables.variables).toContain('directory');
      expect(variables.variables).toContain('filename');
      expect(variables.variables).toContain('name');
    });

    it('should handle templates with no variables', async () => {
      const content = 'Hello World!';
      await fs.writeFile(templatePath, content);
      
      const variables = await engine.extractVariables(templatePath);
      expect(variables.variables).toHaveLength(0);
    });
  });

  describe('Caching', () => {
    it('should cache template content', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      // First render
      const result1 = await engine.renderTemplate(templatePath, { name: 'World' });
      expect(result1.success).toBe(true);
      
      // Check cache
      const cacheKey = `content:${templatePath}`;
      expect(engine.templateCache.has(cacheKey)).toBe(true);
      
      // Second render should use cache
      const result2 = await engine.renderTemplate(templatePath, { name: 'Universe' });
      expect(result2.success).toBe(true);
      expect(result2.content).toBe('Hello Universe!');
    });

    it('should provide cache statistics', () => {
      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty('templateCache');
      expect(stats).toHaveProperty('compiledCache');
      expect(stats).toHaveProperty('variableCache');
      expect(stats).toHaveProperty('fixedTemplates');
      expect(stats).toHaveProperty('maxCacheSize');
      expect(typeof stats.templateCache).toBe('number');
    });

    it('should clear all caches', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      // Populate cache
      await engine.renderTemplate(templatePath, { name: 'World' });
      await engine.extractVariables(templatePath);
      
      // Verify cache has content
      expect(engine.getCacheStats().templateCache).toBeGreaterThan(0);
      
      // Clear cache
      engine.clearCache();
      
      // Verify cache is empty
      const stats = engine.getCacheStats();
      expect(stats.templateCache).toBe(0);
      expect(stats.variableCache).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should include duration in render results', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await engine.renderTemplate(templatePath, { name: 'World' });
      expect(result.success).toBe(true);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});

describe('Standalone Template Functions', () => {
  let tempDir;
  let templatePath;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'unjucks-test-' + Date.now());
    await fs.ensureDir(tempDir);
    templatePath = path.join(tempDir, 'test.njk');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('renderTemplate function', () => {
    it('should render template using standalone function', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const result = await renderTemplate(templatePath, { name: 'World' });
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello World!');
    });
  });

  describe('validateTemplate function', () => {
    it('should validate template using standalone function', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const validation = await validateTemplate(templatePath);
      expect(validation.valid).toBe(true);
    });
  });

  describe('extractTemplateVariables function', () => {
    it('should extract variables using standalone function', async () => {
      const content = 'Hello {{ name }}!';
      await fs.writeFile(templatePath, content);
      
      const variables = await extractTemplateVariables(templatePath);
      expect(variables.variables).toContain('name');
    });
  });
});