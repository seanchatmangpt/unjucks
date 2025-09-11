/**
 * LaTeX Integration Test Suite
 * 
 * Tests the integrated LaTeX/PDF generation system replacing Office processors.
 * This validates that the LaTeX-based processors work correctly with the existing
 * LaTeX compiler, parser, and template system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'jest';
import { promises as fs } from 'fs';
import path from 'path';
import { LaTeXOfficeProcessor } from '../packages/kgen-core/src/office/latex-office-processor.js';
import { DocumentType } from '../packages/kgen-core/src/office/core/types.js';

describe('LaTeX Integration Tests', () => {
  let processor;
  let tempDir;

  beforeAll(async () => {
    // Create temp directory for test outputs
    tempDir = path.join(process.cwd(), 'temp', 'latex-tests');
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize the LaTeX Office processor
    processor = new LaTeXOfficeProcessor({
      templatesDir: './templates/latex',
      outputDir: tempDir,
      compileToPdf: false, // Skip PDF compilation in tests
      debug: true
    });

    await processor.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (processor) {
      await processor.cleanup();
    }

    // Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  });

  describe('Document Processing', () => {
    it('should process a simple LaTeX document template', async () => {
      const templatePath = './templates/latex/documents/simple-report.tex';
      const data = {
        title: 'Test Report',
        author: 'Jest Test Suite',
        abstract: 'This is a test abstract for our LaTeX integration.',
        executiveSummary: 'Integration testing shows LaTeX processing works correctly.',
        conclusion: 'The LaTeX integration is successful.'
      };

      const outputPath = path.join(tempDir, 'test-report.tex');
      const result = await processor.process(templatePath, data, outputPath);

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Test Report');
      expect(result.latexContent).toContain('Jest Test Suite');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBe('Test Report');

      // Verify file was created
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle template with sections and data', async () => {
      const templatePath = './templates/latex/documents/simple-report.tex';
      const data = {
        title: 'Advanced Report',
        sections: [
          {
            title: 'Introduction',
            content: 'This section introduces the topic.'
          },
          {
            title: 'Analysis',
            content: 'This section provides detailed analysis.',
            subsections: [
              {
                title: 'Methodology',
                content: 'Description of the methodology used.'
              }
            ]
          }
        ],
        data: [
          { metric: 'Revenue', value: '$1,000,000' },
          { metric: 'Growth Rate', value: '15%' }
        ],
        dataCaption: 'Financial Metrics'
      };

      const outputPath = path.join(tempDir, 'advanced-report.tex');
      const result = await processor.process(templatePath, data, outputPath);

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Introduction');
      expect(result.latexContent).toContain('Analysis');
      expect(result.latexContent).toContain('Methodology');
      expect(result.latexContent).toContain('Revenue');
      expect(result.latexContent).toContain('$1,000,000');
    });
  });

  describe('Table Processing', () => {
    it('should process a LaTeX table template', async () => {
      const templatePath = './templates/latex/tables/data-table.tex';
      const data = {
        title: 'Sales Data',
        description: 'Monthly sales data for Q1 2024',
        tableData: [
          { Month: 'January', Sales: '$50,000', Growth: '5%' },
          { Month: 'February', Sales: '$55,000', Growth: '10%' },
          { Month: 'March', Sales: '$60,000', Growth: '9%' }
        ],
        notes: 'Sales figures show positive growth trend.'
      };

      const outputPath = path.join(tempDir, 'sales-table.tex');
      const result = await processor.process(templatePath, data, outputPath);

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Sales Data');
      expect(result.latexContent).toContain('longtable');
      expect(result.latexContent).toContain('January');
      expect(result.latexContent).toContain('$50,000');
      expect(result.metadata).toBeDefined();
    });

    it('should generate standalone table', async () => {
      const tableData = [
        { Product: 'Widget A', Price: 19.99, Stock: 100 },
        { Product: 'Widget B', Price: 29.99, Stock: 75 },
        { Product: 'Widget C', Price: 39.99, Stock: 50 }
      ];

      const result = await processor.generateTable(tableData, {
        title: 'Product Inventory',
        author: 'Inventory System',
        tableType: 'longtable'
      });

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Product Inventory');
      expect(result.latexContent).toContain('Widget A');
      expect(result.latexContent).toContain('19.99');
      expect(result.metadata.rowCount).toBe(3);
      expect(result.metadata.columnCount).toBe(3);
    });
  });

  describe('Presentation Processing', () => {
    it('should process a LaTeX Beamer presentation template', async () => {
      const templatePath = './templates/latex/presentations/business-presentation.tex';
      const data = {
        presentation: {
          title: 'Test Presentation',
          subtitle: 'LaTeX Integration Demo',
          author: 'Jest Test Suite',
          theme: 'Madrid'
        },
        slides: [
          {
            section: 'Introduction',
            title: 'Welcome',
            content: 'Welcome to our presentation.',
            items: ['First point', 'Second point', 'Third point']
          },
          {
            title: 'Data Overview',
            content: 'Here we present our findings.',
            columns: [
              { width: '0.5\\textwidth', content: 'Left column content' },
              { width: '0.5\\textwidth', content: 'Right column content' }
            ]
          }
        ],
        conclusion: 'Thank you for your attention.',
        questions: {
          title: 'Questions?',
          content: 'Please ask your questions now.'
        }
      };

      const outputPath = path.join(tempDir, 'test-presentation.tex');
      const result = await processor.process(templatePath, data, outputPath);

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Test Presentation');
      expect(result.latexContent).toContain('beamer');
      expect(result.latexContent).toContain('Welcome');
      expect(result.latexContent).toContain('Introduction');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.slideCount).toBe(2);
    });

    it('should generate standalone presentation', async () => {
      const slidesData = [
        {
          section: 'Overview',
          title: 'Project Status',
          content: 'Current project status and updates.',
          items: ['Task 1 completed', 'Task 2 in progress', 'Task 3 planned']
        },
        {
          title: 'Next Steps',
          content: 'Planned activities for next quarter.',
          items: ['Finalize requirements', 'Begin development', 'Testing phase']
        }
      ];

      const result = await processor.generatePresentation(slidesData, {
        title: 'Project Update',
        subtitle: 'Q1 2024 Review',
        author: 'Project Manager',
        theme: 'Berlin'
      });

      expect(result.success).toBe(true);
      expect(result.latexContent).toContain('Project Update');
      expect(result.latexContent).toContain('Berlin');
      expect(result.latexContent).toContain('Project Status');
      expect(result.metadata.slideCount).toBe(2);
      expect(result.metadata.theme).toBe('Berlin');
    });
  });

  describe('Format Detection', () => {
    it('should detect LaTeX document format correctly', async () => {
      const docFormat = await processor.detectLatexFormat('./templates/latex/documents/simple-report.tex');
      expect(docFormat).toBe(DocumentType.LATEX);

      const tableFormat = await processor.detectLatexFormat('./templates/latex/tables/data-table.tex');
      expect(tableFormat).toBe(DocumentType.LATEX_TABLE);

      const presentationFormat = await processor.detectLatexFormat('./templates/latex/presentations/business-presentation.tex');
      expect(presentationFormat).toBe(DocumentType.LATEX_PRESENTATION);
    });

    it('should return correct processors for document types', () => {
      const docProcessor = processor.getProcessorForType(DocumentType.LATEX);
      expect(docProcessor).toBeDefined();
      expect(docProcessor.getSupportedType()).toBe(DocumentType.LATEX);

      const tableProcessor = processor.getProcessorForType(DocumentType.LATEX_TABLE);
      expect(tableProcessor).toBeDefined();
      expect(tableProcessor.getSupportedType()).toBe(DocumentType.LATEX_TABLE);

      const presentationProcessor = processor.getProcessorForType(DocumentType.LATEX_PRESENTATION);
      expect(presentationProcessor).toBeDefined();
      expect(presentationProcessor.getSupportedType()).toBe(DocumentType.LATEX_PRESENTATION);
    });
  });

  describe('Variable Extraction', () => {
    it('should extract variables from LaTeX templates', async () => {
      const variables = await processor.extractVariables('./templates/latex/documents/simple-report.tex');

      expect(variables).toBeDefined();
      expect(Array.isArray(variables)).toBe(true);
      expect(variables.length).toBeGreaterThan(0);

      // Check for common variables
      const variableNames = variables.map(v => v.name);
      expect(variableNames).toContain('title');
      expect(variableNames).toContain('author');
    });
  });

  describe('Template Discovery', () => {
    it('should discover LaTeX templates in directory', async () => {
      const discovery = await processor.discoverTemplates('./templates/latex');

      expect(discovery.templates).toBeDefined();
      expect(Array.isArray(discovery.templates)).toBe(true);
      expect(discovery.templates.length).toBeGreaterThan(0);
      expect(discovery.stats.templatesFound).toBeGreaterThan(0);
      expect(discovery.stats.typeDistribution).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template paths gracefully', async () => {
      const result = await processor.process('./non-existent-template.tex', {});

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed template content', async () => {
      // Create a malformed template
      const malformedPath = path.join(tempDir, 'malformed.tex');
      await fs.writeFile(malformedPath, '\\documentclass{article}\n\\begin{document\nIncomplete LaTeX');

      const result = await processor.process(malformedPath, {});

      // Should still attempt to process but may have warnings
      expect(result).toBeDefined();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should provide processing statistics', () => {
      const stats = processor.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalProcessors).toBeGreaterThan(0);
      expect(stats.supportedTypes).toBeDefined();
      expect(Array.isArray(stats.supportedTypes)).toBe(true);
      expect(stats.processorStats).toBeDefined();
      expect(stats.latexIntegrationStats).toBeDefined();
    });

    it('should track supported document types', () => {
      const supportedTypes = processor.getSupportedTypes();

      expect(supportedTypes).toContain(DocumentType.LATEX);
      expect(supportedTypes).toContain(DocumentType.LATEX_TABLE);
      expect(supportedTypes).toContain(DocumentType.LATEX_PRESENTATION);
      expect(supportedTypes).toContain(DocumentType.WORD); // Legacy compatibility
      expect(supportedTypes).toContain(DocumentType.EXCEL); // Legacy compatibility
      expect(supportedTypes).toContain(DocumentType.POWERPOINT); // Legacy compatibility
    });
  });
});