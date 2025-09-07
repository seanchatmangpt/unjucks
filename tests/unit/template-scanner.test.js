import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { TemplateFactory } from '../factories/index.js';
import fs from 'fs-extra';

// Mock fs-extra
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

describe('TemplateScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = new TemplateScanner();
    vi.resetAllMocks();
  });

  describe('scanTemplate', () => {
    it('should scan template directory and extract variables', async () => {
      const templateContent = '{{ name }} - {{ description }}';
      const fileName = 'component-{{ kebabCase name }}.njk';

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(templateContent);

      const result = await scanner.scanTemplate('/test/template');

      expect(result.variables).toHaveLength(2);
      expect(result.variables.find(v => v.name === 'name')).toBeDefined();
      expect(result.variables.find(v => v.name === 'description')).toBeDefined();
    });

    it('should extract variables from filenames', async () => {
      const fileName = '{{ name | kebabCase }}.component.njk';

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue([fileName]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue('Static content');

      const result = await scanner.scanTemplate('/test/template');

      expect(result.variables.find(v => v.name === 'name')).toBeDefined();
    });

    it('should scan nested directories recursively', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir
        .mockResolvedValueOnce(['subdir', 'template.njk'])
        .mockResolvedValueOnce(['nested.njk']);
      
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false })
        .mockResolvedValueOnce({ isDirectory: () => false });

      mockFs.readFile
        .mockResolvedValueOnce('{{ rootVar }}')
        .mockResolvedValueOnce('{{ nestedVar }}');

      const result = await scanner.scanTemplate('/test/template');

      expect(result.variables).toHaveLength(2);
      expect(result.variables.find(v => v.name === 'rootVar')).toBeDefined();
      expect(result.variables.find(v => v.name === 'nestedVar')).toBeDefined();
    });

    it('should handle non-existent template directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await scanner.scanTemplate('/nonexistent');

      expect(result.variables).toHaveLength(0);
      expect(result.prompts).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw, but log warning
      const result = await scanner.scanTemplate('/test/template');

      expect(result.variables).toHaveLength(0);
    });
  });

  describe('variable extraction', () => {
    it('should extract simple variables', async () => {
      const content = '{{ name }} and {{ title }}';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      expect(result.variables).toHaveLength(2);
    });

    it('should extract variables with filters', async () => {
      const content = '{{ name | upper }} and {{ title | kebabCase }}';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      expect(result.variables.find(v => v.name === 'name')).toBeDefined();
      expect(result.variables.find(v => v.name === 'title')).toBeDefined();
    });

    it('should extract variables from conditionals', async () => {
      const content = `
        {% if hasTests %}
          {{ testFramework }}
        {% endif %}
        {% unless skipDocs %}
          {{ docFormat }}
        {% endunless %}
      `;
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      expect(result.variables.find(v => v.name === 'hasTests')).toBeDefined();
      expect(result.variables.find(v => v.name === 'testFramework')).toBeDefined();
      expect(result.variables.find(v => v.name === 'skipDocs')).toBeDefined();
      expect(result.variables.find(v => v.name === 'docFormat')).toBeDefined();
    });

    it('should extract variables from loops', async () => {
      const content = `
        {% for item in items %}
          {{ item.name }} - {{ item.value }}
        {% endfor %}
        {% for key, value in config %}
          {{ key }}: {{ value }}
        {% endfor %}
      `;
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      expect(result.variables.find(v => v.name === 'items')).toBeDefined();
      expect(result.variables.find(v => v.name === 'config')).toBeDefined();
    });

    it('should deduplicate variables', async () => {
      const content = '{{ name }} and {{ name }} again';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
    });

    it('should ignore loop variables and built-ins', async () => {
      const content = `
        {% for item in items %}
          {{ loop.index }} - {{ item }} - {{ name }}
        {% endfor %}
      `;
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      // Should not include 'loop', 'item', but should include 'items' and 'name'
      expect(result.variables).toHaveLength(2);
      expect(result.variables.find(v => v.name === 'items')).toBeDefined();
      expect(result.variables.find(v => v.name === 'name')).toBeDefined();
      expect(result.variables.find(v => v.name === 'loop')).toBeUndefined();
      expect(result.variables.find(v => v.name === 'item')).toBeUndefined();
    });
  });

  describe('type inference', () => {
    it('should infer string type for name-like variables', async () => {
      const content = '{{ name }} {{ title }} {{ description }}';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      result.variables.forEach(variable => {
        expect(variable.type).toBe('string');
      });
    });

    it('should infer boolean type for flag-like variables', async () => {
      const content = '{% if hasTests %}{{ name }}{% endif %} {% if isEnabled %}enabled{% endif %}';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      const hasTestsVar = result.variables.find(v => v.name === 'hasTests');
      const isEnabledVar = result.variables.find(v => v.name === 'isEnabled');
      
      expect(hasTestsVar?.type).toBe('boolean');
      expect(isEnabledVar?.type).toBe('boolean');
    });

    it('should infer number type for count-like variables', async () => {
      const content = '{{ count }} items, {{ port }} server';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      const countVar = result.variables.find(v => v.name === 'count');
      const portVar = result.variables.find(v => v.name === 'port');
      
      expect(countVar?.type).toBe('number');
      expect(portVar?.type).toBe('number');
    });
  });

  describe('variable requirements', () => {
    it('should mark conditionally used variables', async () => {
      const content = `
        {{ name }}
        {% if hasDescription %}
          {{ description }}
        {% endif %}
      `;
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      const nameVar = result.variables.find(v => v.name === 'name');
      const descVar = result.variables.find(v => v.name === 'description');
      
      expect(nameVar?.required).toBe(true);
      expect(descVar?.required).toBe(false);
    });

    it('should mark loop variables', async () => {
      const content = `
        {% for item in items %}
          {{ item }}
        {% endfor %}
      `;
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(content);

      const result = await scanner.scanTemplate('/test');

      const itemsVar = result.variables.find(v => v.name === 'items');
      expect(itemsVar?.required).toBe(true);
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed template syntax gracefully', async () => {
      const malformedContent = TemplateFactory.createMalformedTemplate();
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['malformed.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(malformedContent);

      // Should not throw error
      const result = await scanner.scanTemplate('/test');

      // Should still extract what it can
      expect(result.variables).toBeDefined();
    });

    it('should handle very large templates efficiently', async () => {
      const largeContent = TemplateFactory.createLargeTemplate(5000);
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['large.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue(largeContent);

      const startTime = Date.now();
      const result = await scanner.scanTemplate('/test');
      const endTime = Date.now();

      expect(result.variables).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle deep directory nesting', async () => {
      // Mock deep nesting
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir
        .mockResolvedValueOnce(['level1'])
        .mockResolvedValueOnce(['level2'])
        .mockResolvedValueOnce(['deep.njk']);
        
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });

      mockFs.readFile.mockResolvedValue('{{ deepVar }}');

      const result = await scanner.scanTemplate('/test');

      expect(result.variables.find(v => v.name === 'deepVar')).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should handle concurrent scanning efficiently', async () => {
      const templatePaths = Array.from({ length: 10 }, (_, i) => `/test/template${i}`);
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue('{{ name }}');

      const startTime = Date.now();
      const results = await Promise.all(
        templatePaths.map(path => scanner.scanTemplate(path))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.variables).toHaveLength(1);
      });
      expect(endTime - startTime).toBeLessThan(500); // Should complete quickly
    });

    it('should cache repeated scans of same template', async () => {
      const templatePath = '/test/template';
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });
      mockFs.readFile.mockResolvedValue('{{ name }}');

      // First scan
      await scanner.scanTemplate(templatePath);
      
      // Reset mock call count
      vi.clearAllMocks();
      
      // Second scan should use cache (no file system calls)
      const result = await scanner.scanTemplate(templatePath);

      expect(result.variables).toHaveLength(1);
      // File system methods should not be called again
      expect(mockFs.readdir).not.toHaveBeenCalled();
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });
});