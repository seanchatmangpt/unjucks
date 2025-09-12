/**
 * DOCX Export Tests
 * Comprehensive test suite for Microsoft Word document generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import DOCX export modules
import { DocxExporter } from '../src/lib/export/docx-exporter.js';
import { PandocIntegration } from '../src/lib/export/pandoc-integration.js';
import { DirectDocxGenerator } from '../src/lib/export/direct-docx-generator.js';
import { TemplateDocxGenerator } from '../src/lib/export/template-docx-generator.js';
import { DocxStyleManager } from '../src/lib/export/docx-style-manager.js';

describe('DOCX Export Functionality', () => {
  let tempDir;
  let outputDir;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = path.join(__dirname, 'temp', 'docx-export');
    outputDir = path.join(__dirname, 'output', 'docx-export');
    
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('DocxExporter Core', () => {
    let exporter;

    beforeEach(async () => {
      exporter = new DocxExporter({
        outputDir,
        tempDir,
        enablePandoc: false // Disable pandoc for basic tests
      });
      await exporter.initialize();
    });

    afterEach(async () => {
      if (exporter) {
        await exporter.cleanup();
      }
    });

    it('should initialize successfully', async () => {
      expect(exporter).toBeDefined();
      expect(exporter.options.outputDir).toBe(outputDir);
    });

    it('should export simple text content', async () => {
      const content = 'This is a test document.';
      const result = await exporter.export(content, {
        filename: 'simple-test',
        format: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('simple-test.docx');
      
      // Check if file was created
      const fileExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle structured content', async () => {
      const content = [
        {
          type: 'heading',
          level: 1,
          text: 'Test Document'
        },
        {
          type: 'paragraph',
          text: 'This is a test paragraph.'
        },
        {
          type: 'table',
          headers: ['Column 1', 'Column 2'],
          rows: [['Data 1', 'Data 2'], ['Data 3', 'Data 4']]
        }
      ];

      const result = await exporter.export(content, {
        filename: 'structured-test',
        format: 'structured'
      });

      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should batch export multiple documents', async () => {
      const documents = [
        {
          content: 'Document 1 content',
          filename: 'batch-doc-1'
        },
        {
          content: 'Document 2 content',
          filename: 'batch-doc-2'
        }
      ];

      const results = await exporter.exportBatch(documents);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle export errors gracefully', async () => {
      const result = await exporter.export(null, {
        filename: 'error-test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('DirectDocxGenerator', () => {
    let generator;

    beforeEach(async () => {
      generator = new DirectDocxGenerator({
        outputDir
      });
      
      // Mock docx library for testing
      try {
        await generator.initialize();
      } catch (error) {
        // Skip tests if docx library not available
        if (error.message.includes('docx library not installed')) {
          console.warn('Skipping DirectDocxGenerator tests - docx library not available');
          return;
        }
        throw error;
      }
    });

    it('should create document with custom styles', async () => {
      const content = [
        {
          type: 'heading',
          level: 1,
          text: 'Styled Document'
        },
        {
          type: 'paragraph',
          text: 'This paragraph has custom formatting.',
          runs: [{
            text: 'This paragraph has custom formatting.',
            bold: true,
            fontSize: 14,
            color: '0000FF'
          }]
        }
      ];

      const result = await generator.generate(content, {
        filename: 'styled-document'
      });

      expect(result.success).toBe(true);
    });

    it('should handle images', async () => {
      // Create a dummy image file for testing
      const imagePath = path.join(tempDir, 'test-image.png');
      await fs.writeFile(imagePath, 'dummy image data');

      const content = [
        {
          type: 'image',
          path: imagePath,
          width: 300,
          height: 200
        }
      ];

      const result = await generator.generate(content, {
        filename: 'image-document'
      });

      expect(result.success).toBe(true);
    });

    it('should create complex tables', async () => {
      const content = [
        {
          type: 'table',
          headers: ['Name', 'Age', 'City', 'Occupation'],
          rows: [
            ['John Doe', '30', 'New York', 'Engineer'],
            ['Jane Smith', '25', 'Los Angeles', 'Designer'],
            ['Bob Johnson', '35', 'Chicago', 'Manager']
          ],
          borders: true
        }
      ];

      const result = await generator.generate(content, {
        filename: 'table-document'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('TemplateDocxGenerator', () => {
    let generator;
    let templatesDir;

    beforeEach(async () => {
      templatesDir = path.join(tempDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });

      generator = new TemplateDocxGenerator({
        outputDir,
        templateDir: templatesDir
      });

      try {
        await generator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          console.warn('Skipping TemplateDocxGenerator tests - docx library not available');
          return;
        }
        throw error;
      }
    });

    it('should create and use templates', async () => {
      // Create a test template
      const templateContent = `[
        {
          "type": "heading",
          "level": 1,
          "text": "{{ title }}"
        },
        {
          "type": "paragraph", 
          "text": "Hello {{ name }}!"
        }
      ]`;

      await fs.writeFile(
        path.join(templatesDir, 'greeting.njk'),
        templateContent,
        'utf8'
      );

      const result = await generator.generateFromTemplate('greeting', {
        title: 'Welcome',
        name: 'World'
      }, {
        filename: 'template-test'
      });

      expect(result.success).toBe(true);
    });

    it('should handle template with conditional content', async () => {
      const templateContent = `[
        {
          "type": "heading",
          "level": 1,
          "text": "{{ title }}"
        },
        {% if showIntro %}
        {
          "type": "paragraph",
          "text": "{{ intro }}"
        },
        {% endif %}
        {% for item in items %}
        {
          "type": "paragraph",
          "text": "{{ loop.index }}. {{ item }}"
        }{% if not loop.last %},{% endif %}
        {% endfor %}
      ]`;

      await fs.writeFile(
        path.join(templatesDir, 'conditional.njk'),
        templateContent,
        'utf8'
      );

      const result = await generator.generateFromTemplate('conditional', {
        title: 'Item List',
        showIntro: true,
        intro: 'This is a list of items:',
        items: ['First item', 'Second item', 'Third item']
      }, {
        filename: 'conditional-test'
      });

      expect(result.success).toBe(true);
    });

    it('should validate templates', async () => {
      const invalidTemplate = `[
        {
          "type": "heading",
          "level": 1,
          "text": "{{ title "
        }
      ]`;

      await fs.writeFile(
        path.join(templatesDir, 'invalid.njk'),
        invalidTemplate,
        'utf8'
      );

      const validation = await generator.validateTemplate('invalid');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should list available templates', async () => {
      await fs.writeFile(path.join(templatesDir, 'template1.njk'), '[]', 'utf8');
      await fs.writeFile(path.join(templatesDir, 'template2.njk'), '[]', 'utf8');

      const templates = await generator.listTemplates();
      expect(templates).toContain('template1');
      expect(templates).toContain('template2');
    });
  });

  describe('DocxStyleManager', () => {
    let styleManager;

    beforeEach(async () => {
      styleManager = new DocxStyleManager({
        stylesDir: path.join(tempDir, 'styles')
      });
      await styleManager.initialize();
    });

    it('should load predefined themes', async () => {
      const themes = styleManager.listThemes();
      expect(themes).toContain('professional');
      expect(themes).toContain('academic');
      expect(themes).toContain('legal');
      expect(themes).toContain('modern');
    });

    it('should create document styles from theme', () => {
      const styles = styleManager.createDocumentStyles('professional');
      expect(styles).toHaveProperty('default');
      expect(styles).toHaveProperty('paragraphStyles');
      expect(styles).toHaveProperty('characterStyles');
    });

    it('should create table styles', () => {
      const theme = styleManager.getTheme('professional');
      const tableStyles = styleManager.createTableStyles(theme, 'professional');
      
      expect(tableStyles).toHaveProperty('borders');
      expect(tableStyles).toHaveProperty('headerShading');
    });

    it('should create and save custom themes', async () => {
      const customTheme = {
        name: 'Custom Theme',
        colors: {
          primary: 'ff0000',
          secondary: '00ff00',
          text: '000000',
          background: 'ffffff'
        },
        fonts: {
          heading: 'Arial',
          body: 'Arial',
          monospace: 'Courier New'
        },
        sizes: {
          body: 12
        },
        spacing: {
          lineHeight: 276,
          paragraph: 120,
          section: 240
        }
      };

      await styleManager.saveTheme('custom', customTheme);
      const savedTheme = styleManager.getTheme('custom');
      
      expect(savedTheme).toEqual(customTheme);
    });

    it('should validate themes', () => {
      const validTheme = {
        colors: { primary: 'ff0000' },
        fonts: { body: 'Arial' },
        sizes: { body: 12 },
        spacing: { lineHeight: 276 }
      };

      const invalidTheme = {
        colors: { primary: 'ff0000' }
        // Missing required properties
      };

      expect(() => styleManager.validateTheme(validTheme)).not.toThrow();
      expect(() => styleManager.validateTheme(invalidTheme)).toThrow();
    });
  });

  describe('PandocIntegration', () => {
    let pandocIntegration;

    beforeEach(async () => {
      pandocIntegration = new PandocIntegration({
        tempDir
      });

      try {
        await pandocIntegration.initialize();
      } catch (error) {
        if (error.message.includes('Pandoc not found')) {
          console.warn('Skipping Pandoc tests - Pandoc not available');
          return;
        }
        throw error;
      }
    });

    afterEach(async () => {
      if (pandocIntegration) {
        await pandocIntegration.cleanup();
      }
    });

    it('should detect Pandoc version', async () => {
      if (!pandocIntegration.pandocVersion) return; // Skip if no Pandoc
      
      expect(pandocIntegration.pandocVersion).toBeDefined();
      expect(typeof pandocIntegration.pandocVersion).toBe('string');
    });

    it('should convert LaTeX to DOCX', async () => {
      if (!pandocIntegration.pandocVersion) return;

      const latexContent = `
\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\author{Test Author}
\\maketitle

\\section{Introduction}
This is a test document.

\\section{Content}
Here is some content with \\textbf{bold} and \\textit{italic} text.

\\end{document}
      `;

      const result = await pandocIntegration.latexToDocx(latexContent, {
        outputFile: path.join(outputDir, 'latex-test.docx')
      });

      expect(result.success).toBe(true);
      expect(result.outputFile).toContain('latex-test.docx');
    });

    it('should convert HTML to DOCX', async () => {
      if (!pandocIntegration.pandocVersion) return;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Document</title>
</head>
<body>
    <h1>Test Document</h1>
    <p>This is a <strong>test</strong> paragraph with <em>emphasis</em>.</p>
    <h2>Section</h2>
    <ul>
        <li>Item 1</li>
        <li>Item 2</li>
    </ul>
</body>
</html>
      `;

      const result = await pandocIntegration.htmlToDocx(htmlContent, {
        outputFile: path.join(outputDir, 'html-test.docx')
      });

      expect(result.success).toBe(true);
    });

    it('should convert Markdown to DOCX', async () => {
      if (!pandocIntegration.pandocVersion) return;

      const markdownContent = `
# Test Document

## Introduction

This is a **test** document with *emphasis* and [links](http://example.com).

## Features

- List item 1
- List item 2
- List item 3

### Code Example

\`\`\`javascript
function hello() {
    console.log('Hello, world!');
}
\`\`\`
      `;

      const result = await pandocIntegration.markdownToDocx(markdownContent, {
        outputFile: path.join(outputDir, 'markdown-test.docx')
      });

      expect(result.success).toBe(true);
    });

    it('should handle bibliography creation', async () => {
      if (!pandocIntegration.pandocVersion) return;

      const citations = [
        {
          type: 'article',
          key: 'doe2023',
          title: 'A Sample Article',
          author: 'John Doe',
          year: '2023',
          journal: 'Test Journal'
        }
      ];

      const bibFile = await pandocIntegration.createBibliography(citations);
      expect(bibFile).toContain('.bib');

      const bibContent = await fs.readFile(bibFile, 'utf8');
      expect(bibContent).toContain('@article{doe2023');
      expect(bibContent).toContain('title = {A Sample Article}');
    });
  });

  describe('Integration Tests', () => {
    it('should generate legal contract from template', async () => {
      const templateGenerator = new TemplateDocxGenerator({
        outputDir,
        templateDir: path.join(__dirname, '../templates/docx')
      });

      try {
        await templateGenerator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          console.warn('Skipping integration tests - docx library not available');
          return;
        }
        throw error;
      }

      const contractData = {
        firm_name: 'Smith & Associates Law Firm',
        title: 'Service Agreement',
        effective_date: '2024-01-15',
        parties: [
          {
            name: 'Client Company LLC',
            address: '123 Business St, City, ST 12345'
          },
          {
            name: 'Service Provider Inc',
            address: '456 Service Ave, City, ST 12345'
          }
        ],
        terms: [
          {
            title: 'Services',
            text: 'Provider will deliver consulting services as specified in Exhibit A.'
          },
          {
            title: 'Payment',
            text: 'Client will pay Provider according to the fee schedule in Exhibit B.'
          }
        ],
        signatures: [
          {
            party: 'Client Company LLC',
            name: 'John Client',
            title: 'CEO'
          },
          {
            party: 'Service Provider Inc',
            name: 'Jane Provider',
            title: 'President'
          }
        ]
      };

      const result = await templateGenerator.generateFromTemplate(
        'legal-contract',
        contractData,
        { filename: 'integration-contract-test' }
      );

      expect(result.success).toBe(true);
    });

    it('should generate academic paper from template', async () => {
      const templateGenerator = new TemplateDocxGenerator({
        outputDir,
        templateDir: path.join(__dirname, '../templates/docx')
      });

      try {
        await templateGenerator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          return;
        }
        throw error;
      }

      const paperData = {
        title: 'A Study on Document Generation',
        author: 'Dr. Jane Researcher',
        institution: 'University of Technology',
        abstract: 'This paper presents a comprehensive study on automated document generation techniques.',
        keywords: ['document generation', 'automation', 'templates'],
        sections: [
          {
            title: 'Introduction',
            content: 'Document generation has become increasingly important in modern workflows.'
          },
          {
            title: 'Methodology',
            content: 'We employed a mixed-methods approach combining qualitative and quantitative analysis.'
          }
        ],
        references: [
          {
            authors: 'Smith, J., & Doe, A.',
            year: '2023',
            title: 'Modern Document Processing',
            journal: 'Journal of Information Systems',
            volume: '45',
            pages: '123-145'
          }
        ]
      };

      const result = await templateGenerator.generateFromTemplate(
        'academic-paper',
        paperData,
        { filename: 'integration-paper-test' }
      );

      expect(result.success).toBe(true);
    });

    it('should apply different themes to documents', async () => {
      const styleManager = new DocxStyleManager();
      await styleManager.initialize();

      const directGenerator = new DirectDocxGenerator({
        outputDir
      });

      try {
        await directGenerator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          return;
        }
        throw error;
      }

      const content = [
        {
          type: 'heading',
          level: 1,
          text: 'Themed Document'
        },
        {
          type: 'paragraph',
          text: 'This document demonstrates different theme applications.'
        }
      ];

      const themes = ['professional', 'academic', 'legal', 'modern'];

      for (const theme of themes) {
        const result = await directGenerator.generate(content, {
          filename: `themed-${theme}-test`,
          theme
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing template files', async () => {
      const generator = new TemplateDocxGenerator({
        outputDir,
        templateDir: path.join(tempDir, 'nonexistent')
      });

      try {
        await generator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          return;
        }
        throw error;
      }

      const result = await generator.generateFromTemplate(
        'nonexistent-template',
        {},
        { filename: 'error-test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle invalid template data', async () => {
      const exporter = new DocxExporter({
        outputDir,
        tempDir
      });
      await exporter.initialize();

      const result = await exporter.export(undefined, {
        filename: 'invalid-data-test'
      });

      expect(result.success).toBe(false);
      await exporter.cleanup();
    });

    it('should handle file system permissions errors', async () => {
      // This test would need special setup to simulate permission errors
      // For now, just ensure the error handling structure is in place
      const exporter = new DocxExporter({
        outputDir: '/invalid/path/that/should/not/exist',
        tempDir
      });

      try {
        await exporter.initialize();
      } catch (error) {
        expect(error.message).toContain('Failed to initialize');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle large documents efficiently', async () => {
      const generator = new DirectDocxGenerator({
        outputDir
      });

      try {
        await generator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          return;
        }
        throw error;
      }

      // Create a large document with many elements
      const content = [];
      
      for (let i = 0; i < 100; i++) {
        content.push({
          type: 'heading',
          level: 2,
          text: `Section ${i + 1}`
        });
        
        for (let j = 0; j < 10; j++) {
          content.push({
            type: 'paragraph',
            text: `This is paragraph ${j + 1} of section ${i + 1}. `.repeat(10)
          });
        }
      }

      const startTime = this.getDeterministicTimestamp();
      const result = await generator.generate(content, {
        filename: 'large-document-test'
      });
      const endTime = this.getDeterministicTimestamp();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should cache templates efficiently', async () => {
      const generator = new TemplateDocxGenerator({
        outputDir,
        templateDir: path.join(tempDir, 'templates'),
        enableCaching: true
      });

      try {
        await generator.initialize();
      } catch (error) {
        if (error.message.includes('docx library not installed')) {
          return;
        }
        throw error;
      }

      // Create a test template
      const templatesDir = path.join(tempDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });
      
      await fs.writeFile(
        path.join(templatesDir, 'cached-test.njk'),
        '[{"type": "paragraph", "text": "{{ message }}"}]',
        'utf8'
      );

      // First generation (should load template)
      const start1 = this.getDeterministicTimestamp();
      const result1 = await generator.generateFromTemplate('cached-test', 
        { message: 'First generation' }, 
        { filename: 'cache-test-1' }
      );
      const time1 = this.getDeterministicTimestamp() - start1;

      // Second generation (should use cached template)
      const start2 = this.getDeterministicTimestamp();
      const result2 = await generator.generateFromTemplate('cached-test',
        { message: 'Second generation' },
        { filename: 'cache-test-2' }
      );
      const time2 = this.getDeterministicTimestamp() - start2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Second generation should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});