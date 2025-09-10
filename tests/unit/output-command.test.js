/**
 * Output Command Tests
 * 
 * Tests for the CLI output command functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputCommand } from '../../src/commands/output.js';
import { OUTPUT_FORMATS } from '../../src/core/output-engine.js';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn()
  }
}));

vi.mock('../../src/core/output-engine.js', () => ({
  OutputEngine: vi.fn(() => ({
    generateMultiFormat: vi.fn(),
    processBatch: vi.fn(),
    getCapabilities: vi.fn(),
    outputDir: './output'
  })),
  OUTPUT_FORMATS: {
    PDF: 'pdf',
    HTML: 'html',
    JSON: 'json',
    JSONLD: 'json-ld',
    LATEX: 'latex',
    MARKDOWN: 'markdown'
  }
}));

describe('OutputCommand', () => {
  let outputCommand;
  let mockEngine;

  beforeEach(() => {
    outputCommand = new OutputCommand();
    mockEngine = outputCommand.engine;
    vi.clearAllMocks();
  });

  describe('Command Definition', () => {
    it('should define command structure correctly', () => {
      const definition = OutputCommand.define();
      
      expect(definition.meta.name).toBe('output');
      expect(definition.meta.description).toContain('multi-format');
      expect(definition.args.format).toBeDefined();
      expect(definition.args.output).toBeDefined();
      expect(definition.args.batch).toBeDefined();
    });
  });

  describe('Argument Parsing', () => {
    it('should parse formats correctly', () => {
      const formats = outputCommand.parseFormats('pdf,html,json');
      expect(formats).toEqual(['pdf', 'html', 'json']);
    });

    it('should handle single format', () => {
      const formats = outputCommand.parseFormats('pdf');
      expect(formats).toEqual(['pdf']);
    });

    it('should trim whitespace from formats', () => {
      const formats = outputCommand.parseFormats('  pdf , html , json  ');
      expect(formats).toEqual(['pdf', 'html', 'json']);
    });

    it('should parse JSON metadata string', async () => {
      const metadataString = '{"title": "Test", "author": "John"}';
      const metadata = await outputCommand.parseMetadata(metadataString);
      
      expect(metadata).toEqual({
        title: 'Test',
        author: 'John'
      });
    });

    it('should return empty object for invalid metadata', async () => {
      const metadata = await outputCommand.parseMetadata('invalid-json');
      expect(metadata).toEqual({});
    });
  });

  describe('Single File Processing', () => {
    it('should process single file successfully', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockResolvedValue('# Test Content');
      
      mockEngine.generateMultiFormat.mockResolvedValue({
        success: true,
        results: {
          html: { file: './output/test.html', size: 1024 }
        }
      });

      const result = await outputCommand.processSingle({
        input: 'test.md',
        formats: ['html'],
        filename: 'test',
        outputDir: './output',
        template: 'article',
        cssStyle: 'screen',
        metadata: {},
        dry: false
      });

      expect(result.success).toBe(true);
      expect(mockEngine.generateMultiFormat).toHaveBeenCalledWith(
        '# Test Content',
        expect.objectContaining({
          formats: ['html'],
          filename: 'test',
          template: 'article',
          cssStyle: 'screen'
        })
      );
    });

    it('should handle dry run mode', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockResolvedValue('# Test Content');
      
      const result = await outputCommand.processSingle({
        input: 'test.md',
        formats: ['html', 'pdf'],
        filename: 'test',
        outputDir: './output',
        dry: true,
        metadata: {}
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockEngine.generateMultiFormat).not.toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process batch files successfully', async () => {
      const { promises: fs } = await import('fs');
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([
        { name: 'doc1.md', isFile: () => true },
        { name: 'doc2.md', isFile: () => true }
      ]);
      fs.readFile.mockImplementation((path) => {
        if (path.includes('doc1.md')) return Promise.resolve('# Document 1');
        if (path.includes('doc2.md')) return Promise.resolve('# Document 2');
        return Promise.resolve('');
      });
      
      mockEngine.processBatch.mockResolvedValue({
        success: true,
        processed: 2,
        results: [
          { file: 'doc1', success: true },
          { file: 'doc2', success: true }
        ]
      });

      const result = await outputCommand.processBatch({
        input: './docs',
        formats: ['html'],
        filename: 'doc',
        outputDir: './output',
        batch: true,
        dry: false,
        metadata: {}
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(mockEngine.processBatch).toHaveBeenCalled();
    });

    it('should handle batch dry run', async () => {
      const { promises: fs } = await import('fs');
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([
        { name: 'doc1.md', isFile: () => true }
      ]);
      fs.readFile.mockResolvedValue('# Document 1');
      
      const result = await outputCommand.processBatch({
        input: './docs',
        formats: ['html', 'pdf'],
        filename: 'doc',
        outputDir: './output',
        batch: true,
        dry: true,
        metadata: {}
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockEngine.processBatch).not.toHaveBeenCalled();
    });
  });

  describe('Input Reading', () => {
    it('should read content from file', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockResolvedValue('File content');
      
      const content = await outputCommand.readInput('test.md');
      expect(content).toBe('File content');
      expect(fs.readFile).toHaveBeenCalledWith('test.md', 'utf8');
    });

    it('should use input as direct content if file read fails', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const content = await outputCommand.readInput('Direct content');
      expect(content).toBe('Direct content');
    });
  });

  describe('Capabilities Display', () => {
    it('should show capabilities', async () => {
      const mockCapabilities = {
        formats: ['pdf', 'html', 'json'],
        tools: {
          latex: true,
          puppeteer: false,
          wkhtmltopdf: true
        },
        features: {
          batchProcessing: true,
          structuredData: true
        }
      };
      
      mockEngine.getCapabilities.mockResolvedValue(mockCapabilities);
      
      const result = await outputCommand.showCapabilities();
      expect(result).toEqual(mockCapabilities);
      expect(mockEngine.getCapabilities).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should validate supported formats', async () => {
      await expect(
        outputCommand.parseArgs({
          input: 'test.md',
          format: 'pdf,html,invalid-format'
        })
      ).rejects.toThrow('Unsupported formats: invalid-format');
    });

    it('should require input', async () => {
      await expect(
        outputCommand.parseArgs({
          format: 'html'
        })
      ).rejects.toThrow('Input file or content is required');
    });
  });

  describe('File Extensions', () => {
    it('should return correct extensions for formats', () => {
      expect(outputCommand.getFileExtension(OUTPUT_FORMATS.PDF)).toBe('pdf');
      expect(outputCommand.getFileExtension(OUTPUT_FORMATS.HTML)).toBe('html');
      expect(outputCommand.getFileExtension(OUTPUT_FORMATS.LATEX)).toBe('tex');
      expect(outputCommand.getFileExtension(OUTPUT_FORMATS.MARKDOWN)).toBe('md');
      expect(outputCommand.getFileExtension(OUTPUT_FORMATS.JSON)).toBe('json');
    });
  });

  describe('Error Handling', () => {
    it('should handle generation errors gracefully', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockResolvedValue('# Test Content');
      
      mockEngine.generateMultiFormat.mockRejectedValue(
        new Error('Generation failed')
      );

      await expect(
        outputCommand.processSingle({
          input: 'test.md',
          formats: ['html'],
          filename: 'test',
          outputDir: './output',
          dry: false,
          metadata: {}
        })
      ).rejects.toThrow('Generation failed');
    });

    it('should handle batch file discovery errors', async () => {
      const { promises: fs } = await import('fs');
      fs.stat.mockRejectedValue(new Error('Path not found'));
      
      await expect(
        outputCommand.findBatchFiles('./nonexistent')
      ).rejects.toThrow('Could not read batch input');
    });
  });

  describe('Command Execution', () => {
    it('should execute capabilities command', async () => {
      const mockCapabilities = {
        formats: ['pdf', 'html'],
        tools: { latex: true },
        features: { batchProcessing: true }
      };
      
      mockEngine.getCapabilities.mockResolvedValue(mockCapabilities);
      
      const result = await outputCommand.run({ capabilities: true });
      expect(result).toEqual(mockCapabilities);
    });

    it('should execute single file command', async () => {
      const { promises: fs } = await import('fs');
      fs.readFile.mockResolvedValue('# Test');
      
      mockEngine.generateMultiFormat.mockResolvedValue({
        success: true,
        results: { html: { file: 'test.html' } }
      });

      const result = await outputCommand.run({
        input: 'test.md',
        format: 'html',
        filename: 'test'
      });

      expect(result.success).toBe(true);
    });

    it('should execute batch command', async () => {
      const { promises: fs } = await import('fs');
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([]);
      
      mockEngine.processBatch.mockResolvedValue({
        success: true,
        processed: 0,
        results: []
      });

      const result = await outputCommand.run({
        input: './docs',
        format: 'html',
        batch: true
      });

      expect(result.success).toBe(true);
    });
  });
});
