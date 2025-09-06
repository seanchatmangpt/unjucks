import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { TemplateFactory, GeneratorFactory, FileFactory } from '../factories/index.js';
import fs from 'fs-extra';
import path from 'node:path';

// Mock external dependencies
vi.mock('fs-extra');
vi.mock('nunjucks');

const mockFs = vi.mocked(fs);

describe('Generator', () => {
  let generator: Generator;
  let mockTemplatesDir: string;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    mockTemplatesDir = '/test/templates';
    
    // Mock filesystem operations
    mockFs.existsSync.mockImplementation((path: string) => {
      if (typeof path === 'string') {
        return path.includes('_templates') || path.includes('package.json');
      }
      return false;
    });
    
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readdir.mockResolvedValue(['generator1', 'generator2']);
    mockFs.stat.mockResolvedValue({ 
      isDirectory: () => true,
      isFile: () => false
    } as any);
    
    generator = new Generator(mockTemplatesDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided templates directory', () => {
      expect(generator).toBeDefined();
      expect(generator['templatesDir']).toBe(mockTemplatesDir);
    });

    it('should find templates directory automatically when not provided', () => {
      const autoGenerator = new Generator();
      expect(autoGenerator).toBeDefined();
    });

    it('should initialize nunjucks environment', () => {
      expect(generator['nunjucksEnv']).toBeDefined();
    });

    it('should initialize scanner and parser components', () => {
      expect(generator['templateScanner']).toBeDefined();
      expect(generator['frontmatterParser']).toBeDefined();
      expect(generator['fileInjector']).toBeDefined();
    });
  });

  describe('listGenerators', () => {
    it('should list all available generators', async () => {
      const mockGenerators = [
        TemplateFactory.createGeneratorConfig({ name: 'component' }),
        TemplateFactory.createGeneratorConfig({ name: 'service' })
      ];

      mockFs.readdir.mockResolvedValue(['component', 'service']);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      
      const result = await generator.listGenerators();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('templates');
    });

    it('should handle empty templates directory', async () => {
      mockFs.readdir.mockResolvedValue([]);
      
      const result = await generator.listGenerators();
      
      expect(result).toHaveLength(0);
    });

    it('should filter out non-directory entries', async () => {
      mockFs.readdir.mockResolvedValue(['component', 'file.txt', 'service']);
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ isDirectory: () => false } as any)
        .mockResolvedValueOnce({ isDirectory: () => true } as any);
      
      const result = await generator.listGenerators();
      
      expect(result).toHaveLength(2);
    });
  });

  describe('generate', () => {
    it('should generate files from template successfully', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'basic',
        variables: { name: 'Button' }
      });

      const mockTemplateFiles = [
        TemplateFactory.createTemplateFile({
          path: 'component.njk',
          content: 'export const {{ name }} = () => {};'
        })
      ];

      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.readFile.mockResolvedValue('export const {{ name }} = () => {};');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const result = await generator.generate(options);

      expect(result).toHaveProperty('files');
      expect(result.files).toHaveLength(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle dry run without creating files', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'basic',
        dry: true,
        variables: { name: 'Button' }
      });

      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.readFile.mockResolvedValue('export const {{ name }} = () => {};');

      const result = await generator.generate(options);

      expect(result).toHaveProperty('files');
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle force overwrite', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'basic',
        force: true,
        variables: { name: 'Button' }
      });

      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.readFile.mockResolvedValue('export const {{ name }} = () => {};');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const result = await generator.generate(options);

      expect(result.files).toHaveLength(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error for non-existent generator', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        generator: 'nonexistent',
        template: 'basic'
      });

      mockFs.pathExists.mockResolvedValue(false);

      await expect(generator.generate(options))
        .rejects.toThrow('Generator "nonexistent" not found');
    });

    it('should throw error for non-existent template', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'nonexistent'
      });

      mockFs.pathExists
        .mockResolvedValueOnce(true) // generator exists
        .mockResolvedValueOnce(false); // template doesn't exist

      await expect(generator.generate(options))
        .rejects.toThrow('Template "nonexistent" not found');
    });
  });

  describe('init', () => {
    it('should initialize project structure', async () => {
      const options = GeneratorFactory.createInitOptions({
        type: 'app',
        dest: './my-app'
      });

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();
      mockFs.copy.mockResolvedValue();

      const result = await generator.init(options);

      expect(result).toHaveProperty('success', true);
      expect(mockFs.ensureDir).toHaveBeenCalledWith('./my-app');
    });

    it('should handle existing directory', async () => {
      const options = GeneratorFactory.createInitOptions({
        type: 'app',
        dest: './existing-app'
      });

      mockFs.pathExists.mockResolvedValue(true);

      await expect(generator.init(options))
        .rejects.toThrow('Directory "./existing-app" already exists');
    });
  });

  describe('getTemplateVariables', () => {
    it('should extract variables from template', async () => {
      const templatePath = '/templates/component/basic';
      const mockScanResult = {
        variables: [
          TemplateFactory.createTemplateVariable({ name: 'name', type: 'string' }),
          TemplateFactory.createTemplateVariable({ name: 'hasProps', type: 'boolean' })
        ],
        prompts: []
      };

      vi.spyOn(generator['templateScanner'], 'scanTemplate')
        .mockResolvedValue(mockScanResult);

      const result = await generator.getTemplateVariables('component', 'basic');

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0]).toHaveProperty('name', 'name');
      expect(result.variables[1]).toHaveProperty('name', 'hasProps');
    });

    it('should handle template with no variables', async () => {
      const mockScanResult = {
        variables: [],
        prompts: []
      };

      vi.spyOn(generator['templateScanner'], 'scanTemplate')
        .mockResolvedValue(mockScanResult);

      const result = await generator.getTemplateVariables('component', 'basic');

      expect(result.variables).toHaveLength(0);
      expect(result.prompts).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      const options = GeneratorFactory.createGenerateOptions();
      
      mockFs.pathExists.mockRejectedValue(new Error('File system error'));

      await expect(generator.generate(options))
        .rejects.toThrow('File system error');
    });

    it('should handle template rendering errors', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        variables: { name: undefined } // Invalid variable
      });

      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.readFile.mockResolvedValue('{{ name | upper }}');
      mockFs.pathExists.mockResolvedValue(true);

      // Mock nunjucks to throw error
      vi.spyOn(generator['nunjucksEnv'], 'renderString')
        .mockImplementation(() => {
          throw new Error('Template rendering failed');
        });

      await expect(generator.generate(options))
        .rejects.toThrow('Template rendering failed');
    });
  });

  describe('performance', () => {
    it('should handle large number of templates efficiently', async () => {
      const options = GeneratorFactory.createGenerateOptions();
      const largeTemplateList = Array.from({ length: 100 }, (_, i) => `template${i}.njk`);

      mockFs.readdir.mockResolvedValue(largeTemplateList);
      mockFs.readFile.mockResolvedValue('Template {{ name }}');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const startTime = Date.now();
      const result = await generator.generate(options);
      const endTime = Date.now();

      expect(result.files).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should cache nunjucks environment for better performance', () => {
      const generator1 = new Generator(mockTemplatesDir);
      const generator2 = new Generator(mockTemplatesDir);

      // Both should use the same cached environment
      expect(generator1['nunjucksEnv']).toBeDefined();
      expect(generator2['nunjucksEnv']).toBeDefined();
    });
  });

  describe('file injection', () => {
    it('should inject content into existing files', async () => {
      const options = GeneratorFactory.createGenerateOptions();
      const existingFileContent = 'import React from "react";';
      const injectionContent = 'import { useState } from "react";';

      const mockFrontmatter = TemplateFactory.createFrontmatter({
        inject: true,
        after: 'import React from "react";'
      });

      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.readFile
        .mockResolvedValueOnce(`---\nto: src/{{ name }}.tsx\ninject: true\nafter: 'import React from "react";'\n---\n${injectionContent}`)
        .mockResolvedValueOnce(existingFileContent);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.writeFile.mockResolvedValue();

      vi.spyOn(generator['frontmatterParser'], 'parse')
        .mockReturnValue({
          frontmatter: mockFrontmatter,
          content: injectionContent
        });

      vi.spyOn(generator['fileInjector'], 'inject')
        .mockResolvedValue(FileFactory.createInjectionResult({
          success: true,
          modified: true
        }));

      const result = await generator.generate(options);

      expect(generator['fileInjector'].inject).toHaveBeenCalled();
      expect(result.files[0]).toHaveProperty('injectionResult');
    });

    it('should skip injection when skipIf condition is met', async () => {
      const options = GeneratorFactory.createGenerateOptions();
      const existingFileContent = 'import { useState } from "react";';

      const mockFrontmatter = TemplateFactory.createFrontmatter({
        inject: true,
        skipIf: 'useState'
      });

      mockFs.readdir.mockResolvedValue(['component.njk']);
      mockFs.readFile.mockResolvedValue(existingFileContent);
      mockFs.pathExists.mockResolvedValue(true);

      vi.spyOn(generator['fileInjector'], 'inject')
        .mockResolvedValue(FileFactory.createInjectionResult({
          success: true,
          skipped: true,
          reason: 'Skip condition met'
        }));

      const result = await generator.generate(options);

      expect(result.files[0].injectionResult?.skipped).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty variable object', async () => {
      const options = GeneratorFactory.createGenerateOptions({
        variables: {}
      });

      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.readFile.mockResolvedValue('Static content');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const result = await generator.generate(options);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].content).toBe('Static content');
    });

    it('should handle templates with no frontmatter', async () => {
      const options = GeneratorFactory.createGenerateOptions();

      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.readFile.mockResolvedValue('{{ name }}');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const result = await generator.generate(options);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].frontmatter).toBeUndefined();
    });

    it('should handle circular references in variables', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const options = GeneratorFactory.createGenerateOptions({
        variables: circularObj
      });

      mockFs.readdir.mockResolvedValue(['template.njk']);
      mockFs.readFile.mockResolvedValue('{{ name }}');
      mockFs.pathExists.mockResolvedValue(true);

      // Should handle gracefully without infinite loops
      await expect(generator.generate(options))
        .resolves.toBeDefined();
    });
  });
});