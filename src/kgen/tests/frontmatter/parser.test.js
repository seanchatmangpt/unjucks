/**
 * KGEN Frontmatter Parser Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from '../../core/frontmatter/parser.js';

describe('FrontmatterParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new FrontmatterParser({
      enableValidation: true,
      enableVariableExtraction: true
    });
  });

  describe('Basic Parsing', () => {
    test('should parse valid frontmatter', async () => {
      const content = `---
to: test.txt
inject: true
---
Template content`;
      
      const result = await parser.parse(content);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('test.txt');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.content).toBe('Template content');
    });

    test('should handle content without frontmatter', async () => {
      const content = 'Just template content';
      
      const result = await parser.parse(content);
      
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    test('should handle empty content', async () => {
      const result = await parser.parse('');
      
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('');
    });

    test('should handle invalid YAML gracefully', async () => {
      const content = `---
to: test.txt
invalid: yaml: [
---
Template content`;
      
      const result = await parser.parse(content);
      
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });
  });

  describe('Frontmatter Normalization', () => {
    test('should normalize operation modes', async () => {
      const content = `---
to: test.txt
inject: true
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.frontmatter.operationMode).toBe('inject');
      expect(result.frontmatter.outputPath).toBe('test.txt');
    });

    test('should normalize chmod permissions', async () => {
      const content = `---
to: test.txt
chmod: "755"
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.frontmatter.chmod).toBe(493); // 755 in decimal
    });

    test('should normalize shell commands', async () => {
      const content = `---
to: test.txt
sh: "echo hello"
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.frontmatter.sh).toEqual(['echo hello']);
    });
  });

  describe('Validation', () => {
    test('should validate mutually exclusive operations', async () => {
      const content = `---
to: test.txt
inject: true
append: true
---
Content`;
      
      const result = await parser.parse(content, true);
      
      expect(result.validationResult.valid).toBe(false);
      expect(result.validationResult.errors.some(err => 
        err.message.includes('Only one operation mode allowed')
      )).toBe(true);
    });

    test('should validate injection requirements', async () => {
      const content = `---
to: test.txt
before: "marker"
---
Content`;
      
      const result = await parser.parse(content, true);
      
      expect(result.validationResult.valid).toBe(false);
      expect(result.validationResult.errors.some(err => 
        err.message.includes('before/after requires inject: true')
      )).toBe(true);
    });

    test('should validate lineAt values', async () => {
      const content = `---
to: test.txt
lineAt: 0
---
Content`;
      
      const result = await parser.parse(content, true);
      
      expect(result.validationResult.valid).toBe(false);
      expect(result.validationResult.errors.some(err => 
        err.message.includes('lineAt must be a positive number')
      )).toBe(true);
    });

    test('should validate chmod format', async () => {
      const content = `---
to: test.txt
chmod: "999"
---
Content`;
      
      const result = await parser.parse(content, true);
      
      expect(result.validationResult.valid).toBe(false);
      expect(result.validationResult.errors.some(err => 
        err.message.includes('chmod string must be octal format')
      )).toBe(true);
    });
  });

  describe('Variable Extraction', () => {
    test('should extract variables from frontmatter and template', async () => {
      const content = `---
to: "{{ outputDir }}/{{ filename }}.txt"
variables:
  name:
    type: string
    required: true
---
Hello {{ name }}! Data: {{ data.value }}`;
      
      const result = await parser.parse(content);
      
      expect(result.variableExtraction.frontmatterVariables).toContain('outputDir');
      expect(result.variableExtraction.frontmatterVariables).toContain('filename');
      expect(result.variableExtraction.templateVariables).toContain('name');
      expect(result.variableExtraction.templateVariables).toContain('data');
      expect(result.variableExtraction.allVariables).toContain('name');
      expect(result.variableExtraction.allVariables).toContain('outputDir');
      expect(result.variableExtraction.variableDefinitions.name.type).toBe('string');
      expect(result.variableExtraction.variableDefinitions.name.required).toBe(true);
    });

    test('should handle complex variable patterns', async () => {
      const content = `---
to: test.txt
---
{% if condition %}
  {{ variable | filter }}
  {% for item in items %}
    {{ item.property }}
  {% endfor %}
{% endif %}`;
      
      const result = await parser.parse(content);
      
      expect(result.variableExtraction.templateVariables).toContain('condition');
      expect(result.variableExtraction.templateVariables).toContain('variable');
      expect(result.variableExtraction.templateVariables).toContain('items');
      expect(result.variableExtraction.templateVariables).toContain('item');
    });
  });

  describe('Pre-processing', () => {
    test('should handle dynamic paths in frontmatter', async () => {
      const content = `---
to: {{ category }}/{{ name }}.txt
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('{{ category }}/{{ name }}.txt');
    });

    test('should handle shell command arrays', async () => {
      const content = `---
to: test.txt
sh:
  - echo "Command 1"
  - echo "Command 2"
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.frontmatter.sh).toEqual(['echo "Command 1"', 'echo "Command 2"']);
    });

    test('should handle conditional expressions', async () => {
      const content = `---
to: test.txt
skipIf: "condition == 'value'"
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.frontmatter.skipIf).toBe('condition == \'value\'');
    });
  });

  describe('Metadata Extraction', () => {
    test('should provide parsing metadata', async () => {
      const content = `---
to: test.txt
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.parseMetadata).toBeDefined();
      expect(result.parseMetadata.parseTime).toBeGreaterThanOrEqual(0);
      expect(result.parseMetadata.cacheHit).toBe(false);
      expect(result.parseMetadata.errors).toEqual([]);
      expect(result.parseMetadata.warnings).toEqual([]);
    });

    test('should track frontmatter size', async () => {
      const content = `---
to: test.txt
description: "A test file"
tags: [test, example]
---
Content`;
      
      const result = await parser.parse(content);
      
      expect(result.parseMetadata.rawFrontmatterSize).toBeGreaterThan(0);
      expect(result.parseMetadata.processedFrontmatterSize).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    test('should cache parsing results', async () => {
      const content = `---
to: test.txt
---
Content`;
      
      // First parse
      const result1 = await parser.parse(content, false, { useCache: true });
      expect(result1.parseMetadata.cacheHit).toBe(false);
      
      // Second parse should hit cache
      const result2 = await parser.parse(content, false, { useCache: true });
      expect(result2.parseMetadata.cacheHit).toBe(true);
      
      // Results should be identical
      expect(result1.frontmatter).toEqual(result2.frontmatter);
      expect(result1.content).toBe(result2.content);
    });

    test('should respect cache disable option', async () => {
      const content = `---
to: test.txt
---
Content`;
      
      // First parse with cache disabled
      const result1 = await parser.parse(content, false, { useCache: false });
      expect(result1.parseMetadata.cacheHit).toBe(false);
      
      // Second parse with cache disabled should not hit cache
      const result2 = await parser.parse(content, false, { useCache: false });
      expect(result2.parseMetadata.cacheHit).toBe(false);
    });
  });

  describe('Statistics and Management', () => {
    test('should provide parser statistics', () => {
      const stats = parser.getStatistics();
      
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('validationCacheSize');
      expect(stats).toHaveProperty('options');
    });

    test('should clear cache', async () => {
      const content = `---
to: test.txt
---
Content`;
      
      // Create cache entries
      await parser.parse(content, false, { useCache: true });
      
      let stats = parser.getStatistics();
      expect(stats.cacheSize).toBeGreaterThan(0);
      
      // Clear cache
      parser.clearCache();
      
      stats = parser.getStatistics();
      expect(stats.cacheSize).toBe(0);
    });
  });
});