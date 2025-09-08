/**
 * Tests for Export CLI Interface
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ExportCLI } from '../../src/lib/export/export-cli.js';

describe('ExportCLI', () => {
  let cli;
  let outputDir;
  let testDataFile;

  beforeEach(async () => {
    cli = new ExportCLI();
    outputDir = './test_cli_exports';
    
    // Clean test environment
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    await fs.mkdir(outputDir, { recursive: true });

    // Create test data file
    const testData = [
      {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        active: true
      },
      {
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        active: false
      }
    ];

    testDataFile = path.join(outputDir, 'test_data.json');
    await fs.writeFile(testDataFile, JSON.stringify(testData, null, 2));
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Argument Parsing', () => {
    it('should parse basic arguments', () => {
      const args = ['--input', 'data.json', '--format', 'html,json', '--output', './exports'];
      const options = cli.parseArgs(args);

      expect(options.input).toBe('data.json');
      expect(options.formats).toEqual(['html', 'json']);
      expect(options.output).toBe('./exports');
    });

    it('should parse short form arguments', () => {
      const args = ['-i', 'data.json', '-f', 'markdown', '-o', './out', '-t', 'Test Title'];
      const options = cli.parseArgs(args);

      expect(options.input).toBe('data.json');
      expect(options.formats).toEqual(['markdown']);
      expect(options.output).toBe('./out');
      expect(options.title).toBe('Test Title');
    });

    it('should parse boolean flags', () => {
      const args = ['--verbose', '--metadata', 'false', '--pretty', 'true'];
      const options = cli.parseArgs(args);

      expect(options.verbose).toBe(true);
      expect(options.metadata).toBe(false);
      expect(options.exportOptions.pretty).toBe(true);
    });

    it('should parse format-specific options', () => {
      const args = [
        '--page-size', 'A4',
        '--margins', '2cm,1cm,2cm,1cm',
        '--font-family', 'Arial',
        '--gfm', 'true',
        '--chapter-breaks', 'auto'
      ];
      
      const options = cli.parseArgs(args);

      expect(options.exportOptions.pageSize).toBe('A4');
      expect(options.exportOptions.margins).toEqual({
        top: '2cm', right: '1cm', bottom: '2cm', left: '1cm'
      });
      expect(options.exportOptions.fontFamily).toBe('Arial');
      expect(options.exportOptions.gfmSupport).toBe(true);
      expect(options.exportOptions.chapterBreaks).toBe('auto');
    });

    it('should handle comma-separated formats', () => {
      const args = ['--format', 'html,json,markdown,xml'];
      const options = cli.parseArgs(args);

      expect(options.formats).toEqual(['html', 'json', 'markdown', 'xml']);
    });
  });

  describe('Data Loading', () => {
    it('should load JSON data from file', async () => {
      const data = await cli.loadData(testDataFile);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Alice');
    });

    it('should parse JSON string directly', async () => {
      const jsonString = '{"name": "test", "value": 123}';
      const data = await cli.loadData(jsonString);

      expect(data).toEqual({ name: 'test', value: 123 });
    });

    it('should handle CSV files', async () => {
      const csvContent = 'id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com';
      const csvFile = path.join(outputDir, 'test.csv');
      await fs.writeFile(csvFile, csvContent);

      const data = await cli.loadData(csvFile, 'csv');
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com' });
    });

    it('should auto-detect file format', async () => {
      const data = await cli.loadData(testDataFile);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });

    it('should handle plain text files', async () => {
      const textContent = 'This is a plain text file.';
      const textFile = path.join(outputDir, 'test.txt');
      await fs.writeFile(textFile, textContent);

      const data = await cli.loadData(textFile, 'text');
      
      expect(data).toBe(textContent);
    });
  });

  describe('CSV Parsing', () => {
    it('should parse simple CSV', () => {
      const csv = 'name,age,city\nAlice,30,New York\nBob,25,San Francisco';
      const data = cli.parseCSV(csv);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'Alice', age: '30', city: 'New York' });
      expect(data[1]).toEqual({ name: 'Bob', age: '25', city: 'San Francisco' });
    });

    it('should handle quoted CSV fields', () => {
      const csvLine = 'Alice,"30, years old","New York, NY"';
      const fields = cli.parseCSVLine(csvLine);

      expect(fields).toEqual(['Alice', '30, years old', 'New York, NY']);
    });

    it('should handle empty CSV fields', () => {
      const csv = 'name,age,city\nAlice,,New York\n,25,';
      const data = cli.parseCSV(csv);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'Alice', age: '', city: 'New York' });
      expect(data[1]).toEqual({ name: '', age: '25', city: '' });
    });
  });

  describe('Export Execution', () => {
    it('should execute successful export', async () => {
      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const args = [
        '--input', testDataFile,
        '--format', 'json',
        '--output', outputDir,
        '--title', 'Test Export'
      ];

      await cli.run(args);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting export'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Export completed successfully'));
      
      // Verify output file exists
      const files = await fs.readdir(outputDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'test_data.json');
      expect(jsonFiles.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should handle export errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const args = [
        '--input', 'nonexistent.json',
        '--format', 'html'
      ];

      await cli.run(args);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export failed'),
        expect.any(String)
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should export to multiple formats', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const args = [
        '--input', testDataFile,
        '--format', 'json,html,markdown',
        '--output', outputDir,
        '--title', 'Multi-Format Test'
      ];

      await cli.run(args);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('3 format(s)'));
      
      // Verify output files exist
      const files = await fs.readdir(outputDir);
      expect(files.some(f => f.endsWith('.json'))).toBe(true);
      expect(files.some(f => f.endsWith('.html'))).toBe(true);
      expect(files.some(f => f.endsWith('.md'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should validate required arguments', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      // Missing input
      await cli.run(['--format', 'json']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export failed'),
        expect.stringContaining('Input file or data is required')
      );

      // Missing format
      await cli.run(['--input', 'test.json']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Export failed'),
        expect.stringContaining('At least one output format is required')
      );

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('Help and Version', () => {
    it('should show help when requested', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.run(['--help']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unjucks Multi-Format Exporter'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OPTIONS:'));

      consoleSpy.mockRestore();
    });

    it('should show version when requested', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.run(['--version']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unjucks Multi-Format Exporter v1.0.0'));

      consoleSpy.mockRestore();
    });

    it('should list supported formats', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.run(['--list-formats']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Supported Export Formats'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('HTML'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JSON'));

      consoleSpy.mockRestore();
    });
  });

  describe('Result Reporting', () => {
    it('should report successful results', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const results = {
        json: {
          filePath: './export.json',
          size: 1024,
          metadata: {
            generatedAt: new Date().toISOString(),
            dataRecords: 10
          }
        },
        html: {
          filePath: './export.html',
          size: 2048,
          metadata: {
            generatedAt: new Date().toISOString(),
            dataRecords: 10
          }
        }
      };

      cli.reportResults(results, { verbose: true, output: './exports' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Export Results'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ JSON'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ HTML'));

      consoleSpy.mockRestore();
    });

    it('should report errors in results', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const results = {
        json: {
          filePath: './export.json',
          size: 1024
        },
        html: {
          error: 'Export failed due to invalid data'
        }
      };

      cli.reportResults(results, { verbose: false });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ JSON'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌ HTML'));

      consoleSpy.mockRestore();
    });

    it('should format file sizes correctly', () => {
      expect(cli.formatFileSize(0)).toBe('0 B');
      expect(cli.formatFileSize(1024)).toBe('1 KB');
      expect(cli.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(cli.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(cli.formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('Demo Mode', () => {
    it('should run demo export successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const results = await cli.runDemo(['json', 'html']);

      expect(results).toBeTruthy();
      expect(Object.keys(results)).toEqual(['json', 'html']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Running Multi-Format Export Demo'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Demo completed'));

      consoleSpy.mockRestore();
    });

    it('should create example data for demo', () => {
      const exampleData = cli.createExampleData();
      
      expect(Array.isArray(exampleData)).toBe(true);
      expect(exampleData.length).toBeGreaterThan(0);
      expect(exampleData[0]).toHaveProperty('id');
      expect(exampleData[0]).toHaveProperty('name');
      expect(exampleData[0]).toHaveProperty('email');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input gracefully', async () => {
      const emptyFile = path.join(outputDir, 'empty.json');
      await fs.writeFile(emptyFile, '[]');

      const args = [
        '--input', emptyFile,
        '--format', 'json',
        '--output', outputDir
      ];

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await cli.run(args);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Export completed successfully'));

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON input', async () => {
      const malformedFile = path.join(outputDir, 'malformed.json');
      await fs.writeFile(malformedFile, '{ invalid json');

      const data = await cli.loadData(malformedFile);
      
      // Should fall back to text content
      expect(typeof data).toBe('string');
    });

    it('should handle special characters in filenames', async () => {
      const specialFile = path.join(outputDir, 'test with spaces & symbols.json');
      await fs.writeFile(specialFile, JSON.stringify([{ test: 'data' }]));

      const data = await cli.loadData(specialFile);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].test).toBe('data');
    });
  });
});