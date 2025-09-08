/**
 * Tests for Multi-Format Export System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { MultiFormatExporter } from '../../src/lib/export/multi-exporter.js';

describe('MultiFormatExporter', () => {
  let exporter;
  let testData;
  let outputDir;

  beforeEach(async () => {
    exporter = new MultiFormatExporter();
    outputDir = './test_exports';
    
    // Ensure clean test environment
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    await fs.mkdir(outputDir, { recursive: true });

    // Test data
    testData = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        active: true,
        created: new Date('2023-01-01'),
        tags: ['developer', 'javascript']
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        age: 25,
        active: false,
        created: new Date('2023-02-15'),
        tags: ['designer', 'ui/ux']
      }
    ];

    // Configure exporter for test environment
    exporter.options.outputDir = outputDir;
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const exp = new MultiFormatExporter();
      expect(exp.options.theme).toBe('default');
      expect(exp.options.includeAssets).toBe(true);
      expect(exp.formatHandlers.size).toBeGreaterThan(0);
    });

    it('should accept custom options', () => {
      const exp = new MultiFormatExporter({
        theme: 'modern',
        includeAssets: false,
        outputDir: './custom'
      });
      
      expect(exp.options.theme).toBe('modern');
      expect(exp.options.includeAssets).toBe(false);
      expect(exp.options.outputDir).toBe('./custom');
    });
  });

  describe('Format Support', () => {
    it('should support all expected formats', () => {
      const supportedFormats = exporter.getSupportedFormats();
      const expectedFormats = ['html', 'markdown', 'md', 'rtf', 'epub', 'odt', 'json', 'xml', 'pdf'];
      
      for (const format of expectedFormats) {
        expect(supportedFormats).toContain(format);
      }
    });

    it('should validate format support correctly', () => {
      expect(exporter.isFormatSupported('html')).toBe(true);
      expect(exporter.isFormatSupported('json')).toBe(true);
      expect(exporter.isFormatSupported('invalid')).toBe(false);
      expect(exporter.isFormatSupported('HTML')).toBe(true); // Case insensitive
    });
  });

  describe('Single Format Export', () => {
    it('should export to JSON format', async () => {
      const results = await exporter.exportData(testData, 'json', {
        title: 'Test Export',
        author: 'Test Author'
      });

      expect(results).toHaveProperty('json');
      expect(results.json).toHaveProperty('format', 'json');
      expect(results.json).toHaveProperty('filePath');
      expect(results.json).toHaveProperty('size');
      expect(results.json).toHaveProperty('metadata');

      // Verify file exists
      const filePath = results.json.filePath;
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);

      // Verify JSON content
      const content = await fs.readFile(filePath, 'utf-8');
      const parsedData = JSON.parse(content);
      expect(parsedData).toHaveProperty('metadata');
      expect(parsedData).toHaveProperty('data');
      expect(parsedData.data).toHaveLength(2);
    });

    it('should export to HTML format', async () => {
      const results = await exporter.exportData(testData, 'html', {
        title: 'Test HTML Export',
        theme: 'modern'
      });

      expect(results).toHaveProperty('html');
      expect(results.html).toHaveProperty('format', 'html');
      expect(results.html).toHaveProperty('filePath');

      // Verify HTML file exists and contains expected content
      const filePath = results.html.filePath;
      const content = await fs.readFile(filePath, 'utf-8');
      
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('Test HTML Export');
      expect(content).toContain('John Doe');
      expect(content).toContain('Jane Smith');
    });

    it('should export to Markdown format', async () => {
      const results = await exporter.exportData(testData, 'markdown', {
        title: 'Test Markdown Export',
        gfmSupport: true
      });

      expect(results).toHaveProperty('markdown');
      expect(results.markdown).toHaveProperty('format', 'markdown');

      const filePath = results.markdown.filePath;
      const content = await fs.readFile(filePath, 'utf-8');
      
      expect(content).toContain('# Test Markdown Export');
      expect(content).toContain('| id | name |'); // Table format
      expect(content).toContain('| 1 | John Doe |');
    });

    it('should export to XML format', async () => {
      const results = await exporter.exportData(testData, 'xml', {
        title: 'Test XML Export'
      });

      expect(results).toHaveProperty('xml');
      expect(results.xml).toHaveProperty('format', 'xml');

      const filePath = results.xml.filePath;
      const content = await fs.readFile(filePath, 'utf-8');
      
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<data>');
      expect(content).toContain('John Doe');
    });
  });

  describe('Multiple Format Export', () => {
    it('should export to multiple formats simultaneously', async () => {
      const formats = ['json', 'html', 'markdown'];
      const results = await exporter.exportData(testData, formats, {
        title: 'Multi-Format Test'
      });

      expect(Object.keys(results)).toHaveLength(3);
      expect(results).toHaveProperty('json');
      expect(results).toHaveProperty('html');
      expect(results).toHaveProperty('markdown');

      // Verify all files exist
      for (const [format, result] of Object.entries(results)) {
        expect(result).toHaveProperty('filePath');
        const stats = await fs.stat(result.filePath);
        expect(stats.isFile()).toBe(true);
      }
    });

    it('should handle format errors gracefully', async () => {
      // Mock a format handler to throw an error
      const originalHandler = exporter.formatHandlers.get('json');
      exporter.formatHandlers.set('json', () => {
        throw new Error('Test error');
      });

      const results = await exporter.exportData(testData, ['json', 'html'], {
        title: 'Error Test'
      });

      expect(results.json).toHaveProperty('error');
      expect(results.html).not.toHaveProperty('error');

      // Restore original handler
      exporter.formatHandlers.set('json', originalHandler);
    });
  });

  describe('Data Types and Edge Cases', () => {
    it('should handle empty arrays', async () => {
      const results = await exporter.exportData([], 'json');
      
      expect(results.json).toHaveProperty('filePath');
      const content = JSON.parse(await fs.readFile(results.json.filePath, 'utf-8'));
      expect(content.data).toHaveLength(0);
    });

    it('should handle single objects', async () => {
      const singleObject = { name: 'Test', value: 123 };
      const results = await exporter.exportData(singleObject, 'json');
      
      const content = JSON.parse(await fs.readFile(results.json.filePath, 'utf-8'));
      expect(content.data).toEqual(singleObject);
    });

    it('should handle primitive values', async () => {
      const results = await exporter.exportData('Simple string', 'json');
      
      const content = JSON.parse(await fs.readFile(results.json.filePath, 'utf-8'));
      expect(content.data).toBe('Simple string');
    });

    it('should handle complex nested data', async () => {
      const complexData = {
        user: {
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
              notifications: true
            }
          },
          posts: [
            { title: 'Post 1', tags: ['tech', 'js'] },
            { title: 'Post 2', tags: ['design'] }
          ]
        }
      };

      const results = await exporter.exportData(complexData, 'json');
      expect(results.json).toHaveProperty('filePath');
      
      const content = JSON.parse(await fs.readFile(results.json.filePath, 'utf-8'));
      expect(content.data.user.profile.name).toBe('John');
    });
  });

  describe('Export Options', () => {
    it('should respect custom output directory', async () => {
      const customDir = './custom_test_exports';
      
      try {
        await fs.mkdir(customDir, { recursive: true });
        
        const customExporter = new MultiFormatExporter({
          outputDir: customDir
        });

        const results = await customExporter.exportData(testData, 'json');
        
        expect(results.json.filePath).toContain('custom_test_exports');
        const stats = await fs.stat(results.json.filePath);
        expect(stats.isFile()).toBe(true);
      } finally {
        // Cleanup
        await fs.rm(customDir, { recursive: true, force: true });
      }
    });

    it('should apply theme options', async () => {
      const results = await exporter.exportData(testData, 'html', {
        theme: 'dark'
      });

      expect(results.html.theme).toBe('dark');
    });

    it('should include/exclude metadata based on options', async () => {
      // With metadata
      const withMetadata = await exporter.exportData(testData, 'json', {
        includeMetadata: true
      });

      let content = JSON.parse(await fs.readFile(withMetadata.json.filePath, 'utf-8'));
      expect(content).toHaveProperty('metadata');

      // Without metadata
      const withoutMetadata = await exporter.exportData(testData, 'json', {
        includeMetadata: false
      });

      content = JSON.parse(await fs.readFile(withoutMetadata.json.filePath, 'utf-8'));
      expect(content).not.toHaveProperty('metadata');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(
        exporter.exportData(testData, 'unsupported')
      ).rejects.toThrow('Unsupported export format: unsupported');
    });

    it('should handle file system errors gracefully', async () => {
      // Try to write to invalid directory
      const invalidExporter = new MultiFormatExporter({
        outputDir: '/invalid/path/that/does/not/exist'
      });

      await expect(
        invalidExporter.exportData(testData, 'json')
      ).rejects.toThrow();
    });
  });

  describe('Export Statistics', () => {
    it('should provide export statistics', async () => {
      await exporter.exportData(testData, ['json', 'html'], {
        title: 'Stats Test'
      });

      const stats = await exporter.getExportStats();
      
      expect(stats).toBeTruthy();
      expect(typeof stats).toBe('object');
    });
  });

  describe('Batch Operations', () => {
    it('should support batch export', async () => {
      const formats = ['json', 'html'];
      const results = await exporter.batchExport(testData, formats, {
        title: 'Batch Test'
      });

      expect(Object.keys(results)).toHaveLength(2);
      expect(results).toHaveProperty('json');
      expect(results).toHaveProperty('html');
    });
  });

  describe('Clean Operations', () => {
    it('should clean output directory', async () => {
      // Create some files first
      await exporter.exportData(testData, 'json');
      
      // Verify file exists
      let files = await fs.readdir(outputDir);
      expect(files.length).toBeGreaterThan(0);

      // Clean directory
      await exporter.cleanOutputDir();
      
      // Verify directory is clean
      files = await fs.readdir(outputDir);
      expect(files.length).toBe(0);
    });
  });
});