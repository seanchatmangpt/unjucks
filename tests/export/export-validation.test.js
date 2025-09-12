/**
 * Export System Validation Tests
 * Comprehensive testing of export functionality with proper validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Import the fixed export engine directly
import { exportCommand } from '../../src/commands/export-fixed.js';

describe('Export System Validation', () => {
  let testData;
  let outputDir;
  let testFiles;

  beforeEach(async () => {
    outputDir = './test_exports_validation';
    testFiles = {
      markdown: path.join(outputDir, 'test.md'),
      html: path.join(outputDir, 'test.html'),
      json: path.join(outputDir, 'test.json')
    };
    
    // Clean test environment
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    await fs.mkdir(outputDir, { recursive: true });

    // Create test content
    const testMarkdown = `# Test Document

This is a test document for export validation.

## Features

- **Bold text**
- *Italic text*
- \`Code text\`

### Code Block

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

### Table

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

## Links

[Test Link](https://example.com)
`;

    await fs.writeFile(testFiles.markdown, testMarkdown);
    await fs.writeFile(testFiles.html, '<h1>Test HTML</h1><p>Test content</p>');
    await fs.writeFile(testFiles.json, JSON.stringify({ test: 'data', items: [1, 2, 3] }));
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Export Validation', () => {
    it('should validate export options correctly', async () => {
      // Test with valid options
      const validArgs = {
        input: testFiles.markdown,
        format: 'html',
        output: path.join(outputDir, 'output.html'),
        dry: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: validArgs });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should reject invalid formats', async () => {
      const invalidArgs = {
        input: testFiles.markdown,
        format: 'invalid',
        dry: true,
        quiet: true
      };

      const result = await exportCommand.run({ args: invalidArgs });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.type === 'format')).toBe(true);
    });

    it('should handle missing input files gracefully', async () => {
      const missingFileArgs = {
        input: '/nonexistent/file.md',
        format: 'html',
        dry: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: missingFileArgs });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should prevent directory traversal attacks', async () => {
      const maliciousArgs = {
        input: '../../../etc/passwd',
        format: 'html',
        dry: true,
        quiet: true
      };

      const result = await exportCommand.run({ args: maliciousArgs });
      expect(result.success).toBe(false);
      expect(result.error).toContain('traversal');
    });
  });

  describe('Format-Specific Export Tests', () => {
    it('should export to HTML with proper validation', async () => {
      const htmlArgs = {
        input: testFiles.markdown,
        format: 'html',
        output: path.join(outputDir, 'test-output.html'),
        template: 'modern',
        css: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: htmlArgs });
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(htmlArgs.output);
      
      // Validate file was created
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
      
      // Validate HTML content
      const htmlContent = await fs.readFile(result.outputPath, 'utf8');
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html');
      expect(htmlContent).toContain('Test Document');
      expect(htmlContent).toContain('<style>'); // CSS should be included
    });

    it('should export to Markdown with metadata', async () => {
      const mdArgs = {
        input: testFiles.html,
        format: 'md',
        output: path.join(outputDir, 'test-output.md'),
        metadata: JSON.stringify({ title: 'Test Export', author: 'Test Author' }),
        toc: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: mdArgs });
      expect(result.success).toBe(true);
      
      // Validate file was created
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
      
      // Validate Markdown content
      const mdContent = await fs.readFile(result.outputPath, 'utf8');
      expect(mdContent).toContain('# Test Export');
      expect(mdContent).toContain('Author: Test Author');
      expect(mdContent).toContain('Table of Contents');
    });

    it('should export to LaTeX with proper escaping', async () => {
      const texArgs = {
        input: testFiles.markdown,
        format: 'tex',
        output: path.join(outputDir, 'test-output.tex'),
        template: 'article',
        bibliography: false,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: texArgs });
      expect(result.success).toBe(true);
      
      // Validate file was created
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
      
      // Validate LaTeX content
      const texContent = await fs.readFile(result.outputPath, 'utf8');
      expect(texContent).toContain('\\documentclass{article}');
      expect(texContent).toContain('\\begin{document}');
      expect(texContent).toContain('\\end{document}');
      expect(texContent).toContain('\\maketitle');
    });

    it('should export to RTF format', async () => {
      const rtfArgs = {
        input: testFiles.markdown,
        format: 'rtf',
        output: path.join(outputDir, 'test-output.rtf'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: rtfArgs });
      expect(result.success).toBe(true);
      
      // Validate file was created
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
      
      // Validate RTF content
      const rtfContent = await fs.readFile(result.outputPath, 'utf8');
      expect(rtfContent).toContain('{\\rtf1\\ansi');
      expect(rtfContent).toContain('Test Document');
    });

    it('should export to plain text', async () => {
      const txtArgs = {
        input: testFiles.html,
        format: 'txt',
        output: path.join(outputDir, 'test-output.txt'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: txtArgs });
      expect(result.success).toBe(true);
      
      // Validate file was created
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
      
      // Validate text content (should strip HTML tags)
      const txtContent = await fs.readFile(result.outputPath, 'utf8');
      expect(txtContent).not.toContain('<h1>');
      expect(txtContent).not.toContain('<p>');
      expect(txtContent).toContain('Test HTML');
      expect(txtContent).toContain('Test content');
    });
  });

  describe('Batch Export Tests', () => {
    it('should handle batch export with pattern matching', async () => {
      // Create multiple test files
      for (let i = 1; i <= 3; i++) {
        const filename = path.join(outputDir, `batch-test-${i}.md`);
        await fs.writeFile(filename, `# Document ${i}\n\nContent for document ${i}.`);
      }

      const batchArgs = {
        input: path.join(outputDir, 'batch-test-*.md'),
        format: 'html',
        all: true,
        dry: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: batchArgs });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.files).toBe(3);
    });

    it('should process batch export without dry run', async () => {
      // Create multiple test files
      for (let i = 1; i <= 2; i++) {
        const filename = path.join(outputDir, `batch-real-${i}.md`);
        await fs.writeFile(filename, `# Real Document ${i}\n\nReal content for document ${i}.`);
      }

      const batchArgs = {
        input: path.join(outputDir, 'batch-real-*.md'),
        format: 'html',
        all: true,
        dry: false,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: batchArgs });
      expect(result.success).toBe(true);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      
      // Validate output files were created
      for (let i = 1; i <= 2; i++) {
        const outputFile = path.join(outputDir, `batch-real-${i}.html`);
        const exists = await fs.access(outputFile).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Template and Preset Tests', () => {
    it('should use templates correctly', async () => {
      const templateArgs = {
        input: testFiles.markdown,
        format: 'html',
        template: 'minimal',
        output: path.join(outputDir, 'template-test.html'),
        css: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: templateArgs });
      expect(result.success).toBe(true);
      expect(result.template).toBe('minimal');
      
      // Validate template-specific styling
      const htmlContent = await fs.readFile(result.outputPath, 'utf8');
      expect(htmlContent).toContain('Georgia, serif'); // Minimal template font
    });

    it('should apply presets correctly', async () => {
      const presetArgs = {
        input: testFiles.markdown,
        preset: 'academic',
        output: path.join(outputDir, 'preset-test.pdf'),
        dry: true,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: presetArgs });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should warn about invalid templates', async () => {
      const invalidTemplateArgs = {
        input: testFiles.markdown,
        format: 'html',
        template: 'nonexistent',
        output: path.join(outputDir, 'invalid-template.html'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: invalidTemplateArgs });
      expect(result.success).toBe(true); // Should succeed with warning
      expect(result.warnings).toBeDefined();
      expect(result.warnings.some(w => w.type === 'template')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty input files', async () => {
      const emptyFile = path.join(outputDir, 'empty.md');
      await fs.writeFile(emptyFile, '');

      const emptyArgs = {
        input: emptyFile,
        format: 'html',
        output: path.join(outputDir, 'empty-output.html'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: emptyArgs });
      expect(result.success).toBe(true);
      
      // Should create output file even for empty input
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
    });

    it('should handle malformed JSON metadata gracefully', async () => {
      const malformedArgs = {
        input: testFiles.markdown,
        format: 'html',
        metadata: 'invalid json {',
        output: path.join(outputDir, 'malformed-meta.html'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: malformedArgs });
      expect(result.success).toBe(true); // Should succeed despite bad JSON
    });

    it('should provide helpful error messages', async () => {
      const helpArgs = {};

      const result = await exportCommand.run({ args: helpArgs });
      expect(result.success).toBe(true);
      expect(result.help).toBe(true);
    });

    it('should handle concurrent batch operations safely', async () => {
      // Create many test files
      for (let i = 1; i <= 10; i++) {
        const filename = path.join(outputDir, `concurrent-${i}.md`);
        await fs.writeFile(filename, `# Concurrent Document ${i}\n\nContent ${i}.`);
      }

      const concurrentArgs = {
        input: path.join(outputDir, 'concurrent-*.md'),
        format: 'html',
        all: true,
        concurrency: 5,
        dry: false,
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: concurrentArgs });
      expect(result.success).toBe(true);
      expect(result.successful).toBe(10);
      expect(result.failed).toBe(0);
    });
  });

  describe('Content Processing Tests', () => {
    it('should process Nunjucks templates in content', async () => {
      const templateContent = `# {{ title }}

Hello {{ name }}!

## Variables
- Title: {{ title }}
- Name: {{ name }}
- Date: {{ date }}
`;

      const templateFile = path.join(outputDir, 'template-content.md');
      await fs.writeFile(templateFile, templateContent);

      const templateArgs = {
        input: templateFile,
        format: 'html',
        variables: JSON.stringify({ title: 'Test Document', name: 'World', date: '2023-01-01' }),
        output: path.join(outputDir, 'template-processed.html'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: templateArgs });
      expect(result.success).toBe(true);
      
      const htmlContent = await fs.readFile(result.outputPath, 'utf8');
      expect(htmlContent).toContain('Test Document');
      expect(htmlContent).toContain('Hello World!');
      expect(htmlContent).toContain('2023-01-01');
    });

    it('should escape HTML in content for security', async () => {
      const maliciousContent = `# Test

<script>alert('xss')</script>

Content with <dangerous> tags.
`;

      const maliciousFile = path.join(outputDir, 'malicious.md');
      await fs.writeFile(maliciousFile, maliciousContent);

      const securityArgs = {
        input: maliciousFile,
        format: 'html',
        output: path.join(outputDir, 'security-test.html'),
        verbose: false,
        quiet: true
      };

      const result = await exportCommand.run({ args: securityArgs });
      expect(result.success).toBe(true);
      
      const htmlContent = await fs.readFile(result.outputPath, 'utf8');
      // Nunjucks autoescaping should prevent XSS
      expect(htmlContent).not.toContain('<script>alert');
    });
  });

  describe('Performance Tests', () => {
    it('should complete exports within reasonable time limits', async () => {
      const largeContent = '# Large Document\n\n' + 
        Array.from({ length: 1000 }, (_, i) => `## Section ${i}\n\nContent for section ${i}.\n\n`).join('');

      const largeFile = path.join(outputDir, 'large-document.md');
      await fs.writeFile(largeFile, largeContent);

      const perfArgs = {
        input: largeFile,
        format: 'html',
        output: path.join(outputDir, 'large-output.html'),
        verbose: false,
        quiet: true
      };

      const startTime = this.getDeterministicTimestamp();
      const result = await exportCommand.run({ args: perfArgs });
      const duration = this.getDeterministicTimestamp() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.size).toBeGreaterThan(0);
    });
  });
});