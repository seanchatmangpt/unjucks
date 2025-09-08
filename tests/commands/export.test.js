/**
 * Export Command Tests
 * Comprehensive test suite for export functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportCommand } from '../../src/commands/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../fixtures/export');
const testOutputDir = path.join(__dirname, '../temp/export');

describe('Export Command', () => {
  beforeEach(async () => {
    await fs.ensureDir(testFixturesDir);
    await fs.ensureDir(testOutputDir);
    
    // Create test markdown file
    await fs.writeFile(
      path.join(testFixturesDir, 'test-document.md'),
      `---
title: Test Document
author: Test Author
date: 2025-09-08
---

# Test Document

This is a **test document** with some *formatting*.

## Features

- Bullet points
- Code samples: \`console.log('hello')\`
- Links and references

### Code Block

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Conclusion

This document tests various export formats.
`
    );
  });

  afterEach(async () => {
    await fs.remove(testOutputDir);
  });

  describe('Basic Export Functionality', () => {
    it('should export markdown to PDF', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'output.pdf');
      
      const context = {
        args: {
          input: inputFile,
          format: 'pdf',
          output: outputFile,
          template: 'article'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });

    it('should export markdown to HTML', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'output.html');
      
      const context = {
        args: {
          input: inputFile,
          format: 'html',
          output: outputFile,
          template: 'modern'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('Test Document');
    });

    it('should export markdown to DOCX', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'output.docx');
      
      const context = {
        args: {
          input: inputFile,
          format: 'docx',
          output: outputFile,
          template: 'modern'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'dry-output.pdf');
      
      const context = {
        args: {
          input: inputFile,
          format: 'pdf',
          output: outputFile,
          dry: true
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(false);
    });
  });

  describe('Template Support', () => {
    it('should list templates for PDF format', async () => {
      const context = {
        args: {
          format: 'pdf'
        }
      };

      const result = await exportCommand.subCommands.templates.run(context);
      
      expect(result.success).toBe(true);
    });

    it('should use different HTML templates', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      
      const templates = ['modern', 'classic', 'minimal'];
      
      for (const template of templates) {
        const outputFile = path.join(testOutputDir, `output-${template}.html`);
        
        const context = {
          args: {
            input: inputFile,
            format: 'html',
            output: outputFile,
            template
          }
        };

        const result = await exportCommand.run(context);
        
        expect(result.success).toBe(true);
        expect(await fs.pathExists(outputFile)).toBe(true);
        
        const content = await fs.readFile(outputFile, 'utf8');
        expect(content).toContain('Test Document');
      }
    });
  });

  describe('Preset Support', () => {
    it('should list available presets', async () => {
      const result = await exportCommand.subCommands.presets.run({});
      
      expect(result.success).toBe(true);
      expect(result.presets).toBeDefined();
      expect(result.presets.length).toBeGreaterThan(0);
    });

    it('should use academic preset', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'academic.pdf');
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile,
          preset: 'academic'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });
  });

  describe('Batch Export', () => {
    beforeEach(async () => {
      // Create multiple test files
      for (let i = 1; i <= 3; i++) {
        await fs.writeFile(
          path.join(testFixturesDir, `document-${i}.md`),
          `# Document ${i}\n\nThis is test document number ${i}.`
        );
      }
    });

    it('should export all matching files', async () => {
      const pattern = path.join(testFixturesDir, '*.md');
      
      const context = {
        args: {
          input: pattern,
          format: 'html',
          all: true
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(result.successful).toBeGreaterThan(0);
      
      // Check that files were created
      for (let i = 1; i <= 3; i++) {
        const outputFile = path.join(testFixturesDir, `document-${i}.html`);
        expect(await fs.pathExists(outputFile)).toBe(true);
      }
    });

    it('should handle batch dry run', async () => {
      const pattern = path.join(testFixturesDir, '*.md');
      
      const context = {
        args: {
          input: pattern,
          format: 'pdf',
          all: true,
          dry: true
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.files).toBeGreaterThan(0);
    });
  });

  describe('Format Conversion', () => {
    it('should convert LaTeX to PDF', async () => {
      const inputFile = path.join(testFixturesDir, 'test.tex');
      const outputFile = path.join(testOutputDir, 'converted.pdf');
      
      // Create test LaTeX file
      await fs.writeFile(inputFile, `\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\author{Test Author}
\\maketitle

This is a test LaTeX document.

\\end{document}`);
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile
        }
      };

      const result = await exportCommand.subCommands.convert.run(context);
      
      expect(result.success).toBe(true);
    });

    it('should convert Markdown to HTML', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'converted.html');
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile
        }
      };

      const result = await exportCommand.subCommands.convert.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });
  });

  describe('Subcommands', () => {
    it('should export PDF with specific options', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'specific.pdf');
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile,
          template: 'academic',
          toc: true,
          bibliography: false,
          engine: 'pdflatex'
        }
      };

      const result = await exportCommand.subCommands.pdf.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });

    it('should export DOCX with headers and footers', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'corporate.docx');
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile,
          template: 'corporate',
          header: true,
          footer: true,
          toc: true
        }
      };

      const result = await exportCommand.subCommands.docx.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
    });

    it('should export HTML with responsive design', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      const outputFile = path.join(testOutputDir, 'responsive.html');
      
      const context = {
        args: {
          input: inputFile,
          output: outputFile,
          template: 'bootstrap',
          css: true,
          responsive: true
        }
      };

      const result = await exportCommand.subCommands.html.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('viewport');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input file', async () => {
      const context = {
        args: {
          input: 'nonexistent.md',
          format: 'pdf'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle unsupported format', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      
      const context = {
        args: {
          input: inputFile,
          format: 'unsupported'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle invalid template', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      
      const context = {
        args: {
          input: inputFile,
          format: 'pdf',
          template: 'nonexistent'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle invalid preset', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      
      const context = {
        args: {
          input: inputFile,
          format: 'pdf',
          preset: 'nonexistent'
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Metadata and Variables', () => {
    it('should process template variables', async () => {
      const inputFile = path.join(testFixturesDir, 'template-doc.md');
      
      // Create document with template variables
      await fs.writeFile(inputFile, `---
title: {{ title }}
author: {{ author }}
---

# {{ title }}

Hello {{ name }}! This document was created on {{ date }}.
`);
      
      const context = {
        args: {
          input: inputFile,
          format: 'html',
          variables: JSON.stringify({
            title: 'Dynamic Title',
            author: 'Test Author',
            name: 'World',
            date: '2025-09-08'
          })
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      
      const outputContent = await fs.readFile(result.outputPath, 'utf8');
      expect(outputContent).toContain('Dynamic Title');
      expect(outputContent).toContain('Hello World!');
    });

    it('should process metadata', async () => {
      const inputFile = path.join(testFixturesDir, 'test-document.md');
      
      const context = {
        args: {
          input: inputFile,
          format: 'html',
          metadata: JSON.stringify({
            title: 'Custom Title',
            author: 'Custom Author',
            description: 'Custom Description'
          })
        }
      };

      const result = await exportCommand.run(context);
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(result.outputPath)).toBe(true);
    });
  });

  describe('Output Formats', () => {
    const formats = ['html', 'md', 'txt', 'rtf'];
    
    formats.forEach(format => {
      it(`should export to ${format.toUpperCase()} format`, async () => {
        const inputFile = path.join(testFixturesDir, 'test-document.md');
        const outputFile = path.join(testOutputDir, `output.${format}`);
        
        const context = {
          args: {
            input: inputFile,
            format,
            output: outputFile
          }
        };

        const result = await exportCommand.run(context);
        
        expect(result.success).toBe(true);
        expect(await fs.pathExists(outputFile)).toBe(true);
        
        const content = await fs.readFile(outputFile, 'utf8');
        expect(content.length).toBeGreaterThan(0);
      });
    });
  });
});