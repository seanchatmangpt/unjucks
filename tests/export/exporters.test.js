/**
 * Tests for Individual Export Format Handlers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

import HTMLExporter from '../../src/lib/export/exporters/html-exporter.js';
import MarkdownExporter from '../../src/lib/export/exporters/markdown-exporter.js';
import JSONExporter from '../../src/lib/export/exporters/json-exporter.js';
import XMLExporter from '../../src/lib/export/exporters/xml-exporter.js';
import RTFExporter from '../../src/lib/export/exporters/rtf-exporter.js';

describe('Individual Export Format Handlers', () => {
  let testData;
  let outputDir;

  beforeEach(async () => {
    outputDir = './test_exports_individual';
    
    // Clean test environment
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
        name: 'Alice Johnson',
        email: 'alice@example.com',
        age: 28,
        active: true,
        salary: 75000,
        department: 'Engineering',
        skills: ['JavaScript', 'Python', 'React'],
        address: {
          street: '123 Tech Street',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        },
        joinDate: new Date('2022-03-15'),
        projects: [
          { name: 'Project Alpha', status: 'completed' },
          { name: 'Project Beta', status: 'in-progress' }
        ]
      },
      {
        id: 2,
        name: 'Bob Wilson',
        email: 'bob@example.com',
        age: 35,
        active: false,
        salary: 85000,
        department: 'Design',
        skills: ['Figma', 'Adobe Creative Suite', 'UX Research'],
        address: {
          street: '456 Design Avenue',
          city: 'New York',
          state: 'NY',
          zip: '10001'
        },
        joinDate: new Date('2020-07-22'),
        projects: [
          { name: 'Design System', status: 'completed' },
          { name: 'Mobile App Redesign', status: 'planning' }
        ]
      }
    ];
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('HTMLExporter', () => {
    let htmlExporter;

    beforeEach(() => {
      htmlExporter = new HTMLExporter();
    });

    it('should export basic HTML structure', async () => {
      const result = await htmlExporter.export(testData, {
        title: 'Employee Report',
        author: 'HR Department',
        outputDir,
        filename: 'employees.html'
      });

      expect(result.format).toBe('html');
      expect(result.filePath).toContain('employees.html');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<title>Employee Report</title>');
      expect(content).toContain('Alice Johnson');
      expect(content).toContain('Bob Wilson');
    });

    it('should apply different themes', async () => {
      const themes = ['default', 'modern', 'minimal', 'dark'];
      
      for (const theme of themes) {
        const result = await htmlExporter.export(testData, {
          title: `Theme Test - ${theme}`,
          outputDir,
          filename: `theme_${theme}.html`,
          theme
        });

        expect(result.theme).toBe(theme);
        
        const content = await fs.readFile(result.filePath, 'utf-8');
        expect(content).toContain(`Theme Test - ${theme}`);
      }
    });

    it('should render tabular data as table', async () => {
      const result = await htmlExporter.export(testData, {
        outputDir,
        filename: 'table_test.html'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<table');
      expect(content).toContain('<thead>');
      expect(content).toContain('<tbody>');
      expect(content).toContain('<th>id</th>');
      expect(content).toContain('<th>name</th>');
    });

    it('should handle responsive design', async () => {
      const result = await htmlExporter.export(testData, {
        outputDir,
        filename: 'responsive.html',
        responsive: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('viewport');
      expect(content).toContain('@media');
    });

    it('should include metadata when requested', async () => {
      const result = await htmlExporter.export(testData, {
        outputDir,
        filename: 'with_metadata.html',
        includeMetadata: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('Document Information');
      expect(content).toContain('Records:');
    });
  });

  describe('MarkdownExporter', () => {
    let markdownExporter;

    beforeEach(() => {
      markdownExporter = new MarkdownExporter();
    });

    it('should export basic Markdown structure', async () => {
      const result = await markdownExporter.export(testData, {
        title: 'Employee Report',
        author: 'HR Department',
        outputDir,
        filename: 'employees.md'
      });

      expect(result.format).toBe('markdown');
      expect(result.filePath).toContain('employees.md');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('# Employee Report');
      expect(content).toContain('**Author:** HR Department');
      expect(content).toContain('Alice Johnson');
    });

    it('should generate GitHub Flavored Markdown tables', async () => {
      const result = await markdownExporter.export(testData, {
        outputDir,
        filename: 'gfm_table.md',
        gfmSupport: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('| id | name |');
      expect(content).toContain('| --- | --- |');
      expect(content).toContain('| 1 | Alice Johnson |');
    });

    it('should include front matter when metadata enabled', async () => {
      const result = await markdownExporter.export(testData, {
        title: 'Test Document',
        author: 'Test Author',
        outputDir,
        filename: 'frontmatter.md',
        includeMetadata: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('title: "Test Document"');
      expect(content).toContain('author: "Test Author"');
    });

    it('should generate table of contents', async () => {
      const result = await markdownExporter.export(testData, {
        title: 'TOC Test',
        outputDir,
        filename: 'toc.md',
        includeToc: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('## Table of Contents');
      expect(content).toContain('[Data Summary](#data-summary)');
      expect(content).toContain('[Data Content](#data-content)');
    });

    it('should handle different data types correctly', async () => {
      const complexData = {
        string: 'Hello World',
        number: 42,
        boolean: true,
        date: new Date('2023-01-01'),
        url: 'https://example.com',
        email: 'test@example.com',
        array: ['item1', 'item2', 'item3'],
        null_value: null
      };

      const result = await markdownExporter.export(complexData, {
        outputDir,
        filename: 'data_types.md'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('Hello World');
      expect(content).toContain('`42`');
      expect(content).toContain('✅ true'); // Emoji for boolean
      expect(content).toContain('[https://example.com](https://example.com)');
      expect(content).toContain('[test@example.com](mailto:test@example.com)');
      expect(content).toContain('_null_');
    });
  });

  describe('JSONExporter', () => {
    let jsonExporter;

    beforeEach(() => {
      jsonExporter = new JSONExporter();
    });

    it('should export valid JSON with metadata', async () => {
      const result = await jsonExporter.export(testData, {
        title: 'Employee Data',
        outputDir,
        filename: 'employees.json',
        includeMetadata: true
      });

      expect(result.format).toBe('json');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('data');
      expect(parsed.metadata.exportFormat).toBe('json');
      expect(parsed.data).toHaveLength(2);
    });

    it('should export pretty-printed JSON', async () => {
      const result = await jsonExporter.export(testData, {
        outputDir,
        filename: 'pretty.json',
        pretty: true,
        indent: 4
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      // Check for proper indentation
      expect(content).toMatch(/\n    /);
      expect(content).toMatch(/\n        /);
    });

    it('should export minified JSON', async () => {
      const result = await jsonExporter.export(testData, {
        outputDir,
        filename: 'minified.json',
        pretty: false
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      // Should not contain extra whitespace
      expect(content).not.toMatch(/\n\s+/);
    });

    it('should generate JSON Schema when requested', async () => {
      const result = await jsonExporter.export(testData, {
        outputDir,
        filename: 'with_schema.json',
        generateSchema: true
      });

      expect(result.schemaPath).toBeTruthy();
      
      const schemaContent = await fs.readFile(result.schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('type');
      expect(schema).toHaveProperty('properties');
    });

    it('should handle circular references', async () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;

      const result = await jsonExporter.export(circularData, {
        outputDir,
        filename: 'circular.json',
        handleCircularRefs: true
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed.data.self).toHaveProperty('__circular');
    });

    it('should validate JSON data and provide warnings', async () => {
      const problematicData = {
        'invalid.key': 'value',
        '$reserved': 'value',
        '__dunder__': 'value',
        123: 'numeric key'
      };

      const result = await jsonExporter.export(problematicData, {
        outputDir,
        filename: 'problematic.json',
        validateData: true
      });

      // Should still export but with warnings
      expect(result.format).toBe('json');
    });
  });

  describe('XMLExporter', () => {
    let xmlExporter;

    beforeEach(() => {
      xmlExporter = new XMLExporter();
    });

    it('should export valid XML structure', async () => {
      const result = await xmlExporter.export(testData, {
        title: 'Employee Data',
        outputDir,
        filename: 'employees.xml',
        rootElement: 'employees',
        itemElement: 'employee'
      });

      expect(result.format).toBe('xml');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<employees>');
      expect(content).toContain('<employee');
      expect(content).toContain('Alice Johnson');
    });

    it('should handle different data types in XML', async () => {
      const mixedData = {
        string: 'Hello',
        number: 42,
        boolean: true,
        date: new Date('2023-01-01'),
        array: ['item1', 'item2'],
        nested: { key: 'value' }
      };

      const result = await xmlExporter.export(mixedData, {
        outputDir,
        filename: 'mixed_types.xml'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<string>Hello</string>');
      expect(content).toContain('<number>42</number>');
      expect(content).toContain('<boolean>true</boolean>');
    });

    it('should generate XSD schema when requested', async () => {
      const result = await xmlExporter.export(testData, {
        outputDir,
        filename: 'with_schema.xml',
        generateXSD: true
      });

      expect(result.schemaPath).toBeTruthy();
      
      const schemaContent = await fs.readFile(result.schemaPath, 'utf-8');
      expect(schemaContent).toContain('<?xml version="1.0"');
      expect(schemaContent).toContain('<xs:schema');
      expect(schemaContent).toContain('XMLSchema');
    });

    it('should handle attributes and CDATA', async () => {
      const dataWithSpecialChars = {
        description: 'This contains <special> characters & symbols',
        code: 'function test() { return "hello"; }'
      };

      const result = await xmlExporter.export(dataWithSpecialChars, {
        outputDir,
        filename: 'special_chars.xml',
        cdataThreshold: 10
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<![CDATA[');
    });

    it('should sanitize element names', async () => {
      const dataWithInvalidKeys = {
        'invalid-element-name!': 'value1',
        '123numeric': 'value2',
        'xml': 'reserved'
      };

      const result = await xmlExporter.export(dataWithInvalidKeys, {
        outputDir,
        filename: 'sanitized.xml'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('<invalid_element_name_>');
      expect(content).toContain('<element_123numeric>');
      expect(content).toContain('<element_xml>');
    });
  });

  describe('RTFExporter', () => {
    let rtfExporter;

    beforeEach(() => {
      rtfExporter = new RTFExporter();
    });

    it('should export valid RTF structure', async () => {
      const result = await rtfExporter.export(testData, {
        title: 'Employee Report',
        author: 'HR Department',
        outputDir,
        filename: 'employees.rtf'
      });

      expect(result.format).toBe('rtf');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('{\\rtf1\\ansi');
      expect(content).toContain('{\\fonttbl');
      expect(content).toContain('Employee Report');
    });

    it('should render data as RTF table', async () => {
      const result = await rtfExporter.export(testData, {
        outputDir,
        filename: 'table.rtf'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('\\trowd'); // RTF table row
      expect(content).toContain('\\cellx'); // RTF table cell
      expect(content).toContain('\\intbl'); // Inside table
    });

    it('should apply font and page formatting', async () => {
      const result = await rtfExporter.export(testData, {
        outputDir,
        filename: 'formatted.rtf',
        fontSize: '14pt',
        fontFamily: 'Arial',
        pageSize: 'Letter'
      });

      expect(result.metadata.fontSize).toBe('14pt');
      expect(result.metadata.fontFamily).toBe('Arial');
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('Arial');
    });

    it('should handle special characters in RTF', async () => {
      const dataWithSpecial = {
        text: 'Special chars: {curly} \\backslash\\ "quotes"',
        unicode: 'Unicode: café résumé naïve'
      };

      const result = await rtfExporter.export(dataWithSpecial, {
        outputDir,
        filename: 'special_rtf.rtf'
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('\\{'); // Escaped curly brace
      expect(content).toContain('\\\\'); // Escaped backslash
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors gracefully', async () => {
      const jsonExporter = new JSONExporter();
      
      await expect(
        jsonExporter.export(testData, {
          outputDir: '/invalid/path/that/does/not/exist',
          filename: 'test.json'
        })
      ).rejects.toThrow();
    });

    it('should handle invalid data gracefully', async () => {
      const xmlExporter = new XMLExporter();
      
      const circularData = {};
      circularData.self = circularData;

      const result = await xmlExporter.export(circularData, {
        outputDir,
        filename: 'circular.xml'
      });

      // Should complete without throwing
      expect(result.format).toBe('xml');
    });
  });

  describe('Performance with Large Data', () => {
    it('should handle large datasets efficiently', async () => {
      // Generate large dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        data: Array.from({ length: 10 }, (_, j) => `item_${j}`)
      }));

      const jsonExporter = new JSONExporter();
      
      const startTime = this.getDeterministicTimestamp();
      const result = await jsonExporter.export(largeData, {
        outputDir,
        filename: 'large_dataset.json'
      });
      const endTime = this.getDeterministicTimestamp();

      expect(result.format).toBe('json');
      expect(result.metadata.dataRecords).toBe(1000);
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});