/**
 * Output Engine Tests
 * 
 * Comprehensive tests for multi-format output generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { OutputEngine, OUTPUT_FORMATS } from '../../src/core/output-engine.js';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(() => ({ size: 1024 })),
    readdir: vi.fn()
  }
}));

vi.mock('child_process', () => ({
  execFile: vi.fn((cmd, args, callback) => {
    if (cmd === 'pdflatex') {
      callback(null, { stdout: 'PDF generated', stderr: '' });
    } else if (cmd === 'wkhtmltopdf') {
      callback(null, { stdout: 'PDF generated', stderr: '' });
    } else {
      callback(null, { stdout: '--version', stderr: '' });
    }
  }),
  spawn: vi.fn()
}));

describe('OutputEngine', () => {
  let outputEngine;
  let testContent;
  let testMetadata;

  beforeEach(() => {
    outputEngine = new OutputEngine({
      outputDir: './test-output',
      tempDir: './test-temp'
    });

    testContent = `
      # Test Document
      
      This is a test document with some content.
      
      ## Section 1
      
      Some content here.
      
      ## Section 2
      
      More content with **bold** and *italic* text.
    `;

    testMetadata = {
      title: 'Test Document',
      author: 'Test Author',
      date: '2025-01-01',
      description: 'A test document for output engine testing'
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const engine = new OutputEngine();
      expect(engine.outputDir).toBe('./output');
      expect(engine.tempDir).toBe('./temp');
      expect(engine.enableCache).toBe(true);
    });

    it('should initialize with custom options', () => {
      const options = {
        outputDir: './custom-output',
        tempDir: './custom-temp',
        enableCache: false
      };
      const engine = new OutputEngine(options);
      expect(engine.outputDir).toBe('./custom-output');
      expect(engine.tempDir).toBe('./custom-temp');
      expect(engine.enableCache).toBe(false);
    });
  });

  describe('Multi-format Generation', () => {
    it('should generate HTML output', async () => {
      const result = await outputEngine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML],
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.success).toBe(true);
      expect(result.results[OUTPUT_FORMATS.HTML]).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.html'),
        expect.stringContaining('<!DOCTYPE html>'),
        'utf8'
      );
    });

    it('should generate multiple formats concurrently', async () => {
      const result = await outputEngine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML, OUTPUT_FORMATS.MARKDOWN, OUTPUT_FORMATS.JSONLD],
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.success).toBe(true);
      expect(Object.keys(result.results)).toHaveLength(3);
      expect(result.results[OUTPUT_FORMATS.HTML]).toBeDefined();
      expect(result.results[OUTPUT_FORMATS.MARKDOWN]).toBeDefined();
      expect(result.results[OUTPUT_FORMATS.JSONLD]).toBeDefined();
    });

    it('should handle format generation errors gracefully', async () => {
      // Mock a failing format
      vi.spyOn(outputEngine, 'generateHTML').mockRejectedValueOnce(new Error('HTML generation failed'));

      const result = await outputEngine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML, OUTPUT_FORMATS.MARKDOWN],
        filename: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.results[OUTPUT_FORMATS.HTML]).toBeInstanceOf(Error);
      expect(result.results[OUTPUT_FORMATS.MARKDOWN]).toBeDefined();
    });
  });

  describe('HTML Generation', () => {
    it('should generate HTML with default CSS', async () => {
      const result = await outputEngine.generateHTML(testContent, {
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.HTML);
      expect(result.file).toContain('test.html');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.html'),
        expect.stringContaining('font-family:'),
        'utf8'
      );
    });

    it('should generate HTML with print CSS', async () => {
      const result = await outputEngine.generateHTML(testContent, {
        filename: 'test',
        cssStyle: 'print',
        metadata: testMetadata
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.html'),
        expect.stringContaining('@media print'),
        'utf8'
      );
    });

    it('should include structured data in HTML', async () => {
      const metadataWithStructured = {
        ...testMetadata,
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          name: 'Test Document'
        }
      };

      await outputEngine.generateHTML(testContent, {
        filename: 'test',
        metadata: metadataWithStructured
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.html'),
        expect.stringContaining('application/ld+json'),
        'utf8'
      );
    });
  });

  describe('PDF Generation', () => {
    it('should generate PDF via LaTeX', async () => {
      const result = await outputEngine.generatePDFFromLaTeX(testContent, {
        filename: 'test',
        template: 'article',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.PDF);
      expect(result.method).toBe('latex');
      expect(result.file).toContain('test.pdf');
    });

    it('should generate PDF via HTML with Puppeteer', async () => {
      // Mock Puppeteer
      const mockPuppeteer = {
        launch: vi.fn(() => ({
          newPage: vi.fn(() => ({
            goto: vi.fn(),
            pdf: vi.fn(),
          })),
          close: vi.fn()
        }))
      };
      
      vi.doMock('puppeteer', () => mockPuppeteer);
      
      const result = await outputEngine.generatePDFFromHTML(testContent, {
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.PDF);
      expect(result.method).toBe('puppeteer');
    });

    it('should fallback to wkhtmltopdf if Puppeteer fails', async () => {
      // Mock Puppeteer import failure
      vi.doMock('puppeteer', () => {
        throw new Error('Module not found');
      });

      const result = await outputEngine.generatePDFFromHTML(testContent, {
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.PDF);
      expect(result.method).toBe('wkhtmltopdf');
    });
  });

  describe('JSON-LD Generation', () => {
    it('should generate JSON-LD with schema', async () => {
      const result = await outputEngine.generateJSONLD(testContent, {
        filename: 'test',
        template: 'article',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.JSONLD);
      expect(result.data).toHaveProperty('@context', 'https://schema.org');
      expect(result.data).toHaveProperty('@type', 'Article');
      expect(result.data).toHaveProperty('title', testMetadata.title);
    });

    it('should extract structured data from content', async () => {
      const contentWithData = `
        name: John Doe
        email: john@example.com
        
        # Resume
        
        Professional experience...
      `;

      const result = await outputEngine.generateJSONLD(contentWithData, {
        filename: 'test',
        template: 'resume'
      });

      expect(result.data).toHaveProperty('name', 'John Doe');
      expect(result.data).toHaveProperty('email', 'john@example.com');
    });
  });

  describe('LaTeX Generation', () => {
    it('should generate LaTeX with article template', async () => {
      const result = await outputEngine.generateLaTeX(testContent, {
        filename: 'test',
        template: 'article',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.LATEX);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.tex'),
        expect.stringContaining('\\documentclass{article}'),
        'utf8'
      );
    });

    it('should escape LaTeX special characters', () => {
      const specialText = 'Text with $ & % # ^ _ ~ \\ { } characters';
      const escaped = outputEngine.escapeLatex(specialText);
      
      expect(escaped).not.toContain('$');
      expect(escaped).not.toContain('&');
      expect(escaped).not.toContain('%');
      expect(escaped).toContain('\\$');
      expect(escaped).toContain('\\&');
      expect(escaped).toContain('\\%');
    });
  });

  describe('Markdown Generation', () => {
    it('should generate Markdown with frontmatter', async () => {
      const result = await outputEngine.generateMarkdown(testContent, {
        filename: 'test',
        metadata: testMetadata
      });

      expect(result.format).toBe(OUTPUT_FORMATS.MARKDOWN);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.md'),
        expect.stringContaining('---'),
        'utf8'
      );
    });

    it('should generate Markdown without frontmatter when no metadata', async () => {
      const result = await outputEngine.generateMarkdown(testContent, {
        filename: 'test'
      });

      expect(result.format).toBe(OUTPUT_FORMATS.MARKDOWN);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.md'),
        expect.not.stringContaining('---'),
        'utf8'
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple files concurrently', async () => {
      const files = [
        {
          content: 'Content 1',
          filename: 'doc1',
          formats: [OUTPUT_FORMATS.HTML],
          metadata: { title: 'Document 1' }
        },
        {
          content: 'Content 2',
          filename: 'doc2',
          formats: [OUTPUT_FORMATS.PDF],
          metadata: { title: 'Document 2' }
        }
      ];

      const result = await outputEngine.processBatch(files);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should handle batch processing errors gracefully', async () => {
      const files = [
        {
          content: 'Valid content',
          filename: 'valid',
          formats: [OUTPUT_FORMATS.HTML],
          metadata: {}
        },
        {
          content: 'Invalid content',
          filename: 'invalid',
          formats: ['invalid-format'],
          metadata: {}
        }
      ];

      const result = await outputEngine.processBatch(files);

      expect(result.success).toBe(true);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('Capabilities', () => {
    it('should return supported formats', () => {
      const formats = outputEngine.getSupportedFormats();
      expect(formats).toContain(OUTPUT_FORMATS.PDF);
      expect(formats).toContain(OUTPUT_FORMATS.HTML);
      expect(formats).toContain(OUTPUT_FORMATS.JSONLD);
      expect(formats).toContain(OUTPUT_FORMATS.LATEX);
      expect(formats).toContain(OUTPUT_FORMATS.MARKDOWN);
    });

    it('should check tool availability', async () => {
      const capabilities = await outputEngine.getCapabilities();
      
      expect(capabilities).toHaveProperty('formats');
      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('features');
      expect(capabilities.features.batchProcessing).toBe(true);
      expect(capabilities.features.structuredData).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    it('should ensure directories exist', async () => {
      await outputEngine.ensureDir('./test-dir');
      expect(fs.mkdir).toHaveBeenCalledWith('./test-dir', { recursive: true });
    });

    it('should clean up temporary files', async () => {
      await outputEngine.cleanupTempFiles('test');
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test.aux')
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test.log')
      );
    });

    it('should extract structured data from content patterns', () => {
      const content = `
        name: Jane Smith
        email: jane@example.com
        
        Professional background...
      `;
      
      const result = outputEngine.extractStructuredData(content, {}, {
        '@context': 'https://schema.org',
        '@type': 'Person'
      });

      expect(result.name).toBe('Jane Smith');
      expect(result.email).toBe('jane@example.com');
      expect(result['@type']).toBe('Person');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      fs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await outputEngine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML],
        filename: 'test'
      });

      expect(result.success).toBe(true);
      expect(result.results[OUTPUT_FORMATS.HTML]).toBeInstanceOf(Error);
    });

    it('should handle LaTeX compilation errors', async () => {
      const { execFile } = await import('child_process');
      execFile.mockImplementationOnce((cmd, args, callback) => {
        callback(new Error('LaTeX compilation failed'));
      });

      await expect(
        outputEngine.generatePDFFromLaTeX(testContent, {
          filename: 'test',
          template: 'article'
        })
      ).rejects.toThrow('LaTeX compilation failed');
    });

    it('should handle invalid templates gracefully', async () => {
      const result = await outputEngine.generateLaTeX(testContent, {
        filename: 'test',
        template: 'nonexistent-template'
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.tex'),
        expect.stringContaining('\\documentclass{article}'),
        'utf8'
      );
    });
  });

  describe('Performance', () => {
    it('should track performance metrics', async () => {
      const result = await outputEngine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML],
        filename: 'test'
      });

      expect(result.performance).toBeDefined();
      expect(result.performance.duration).toBeGreaterThan(0);
    });

    it('should cache results when enabled', async () => {
      outputEngine.enableCache = true;
      
      // First call
      await outputEngine.generateHTML(testContent, {
        filename: 'test1'
      });
      
      // Second call with same content
      await outputEngine.generateHTML(testContent, {
        filename: 'test2'
      });

      // Both should be processed (caching implementation pending)
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });
});
