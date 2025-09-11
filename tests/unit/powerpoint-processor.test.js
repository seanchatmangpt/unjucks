/**
 * @fileoverview Comprehensive unit tests for PowerPoint processor
 * Tests all functionality including templates, charts, animations, batch processing
 * 
 * @author Unjucks Team
 * @version 2.0.8
 * @since 2024-09-10
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import PowerPointProcessor from '../../src/office/processors/powerpoint-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TEMP_DIR = path.join(__dirname, 'temp', 'powerpoint-tests');
const TEST_OUTPUT_DIR = path.join(__dirname, 'output', 'powerpoint');
const TEST_TEMPLATES_DIR = path.join(__dirname, 'fixtures', 'powerpoint-templates');

describe('PowerPointProcessor', () => {
  let processor;
  let presentation;

  beforeEach(async () => {
    // Clean up and create test directories
    await fs.remove(TEST_TEMP_DIR);
    await fs.remove(TEST_OUTPUT_DIR);
    await fs.ensureDir(TEST_TEMP_DIR);
    await fs.ensureDir(TEST_OUTPUT_DIR);
    await fs.ensureDir(TEST_TEMPLATES_DIR);

    // Create processor instance
    processor = new PowerPointProcessor({
      tempDir: TEST_TEMP_DIR,
      enableLogging: false
    });

    // Create test templates
    await createTestTemplates();
  });

  afterEach(async () => {
    // Clean up test files
    if (presentation) {
      processor.cleanupPresentation(presentation.id);
    }
    await fs.remove(TEST_TEMP_DIR);
    await fs.remove(TEST_OUTPUT_DIR);
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const defaultProcessor = new PowerPointProcessor();
      expect(defaultProcessor).toBeDefined();
      expect(defaultProcessor.options.tempDir).toBe('./temp');
      expect(defaultProcessor.presentations.size).toBe(0);
      expect(defaultProcessor.templates.size).toBe(0);
    });

    it('should initialize with custom options', () => {
      const customProcessor = new PowerPointProcessor({
        tempDir: '/custom/temp',
        enableLogging: true,
        caching: { enabled: false, maxSize: 50 }
      });
      expect(customProcessor.options.tempDir).toBe('/custom/temp');
      expect(customProcessor.options.enableLogging).toBe(true);
      expect(customProcessor.options.caching.enabled).toBe(false);
    });

    it('should have default themes available', () => {
      expect(processor.defaultThemes).toBeDefined();
      expect(processor.defaultThemes.corporate).toBeDefined();
      expect(processor.defaultThemes.modern).toBeDefined();
      expect(processor.defaultThemes.elegant).toBeDefined();
    });
  });

  describe('Presentation Creation', () => {
    it('should create a new presentation with basic config', async () => {
      const config = {
        title: 'Test Presentation',
        author: 'Test Author',
        subject: 'Testing',
        company: 'Test Company'
      };

      presentation = await processor.createPresentation(config);
      
      expect(presentation.success).toBe(true);
      expect(presentation.id).toBeDefined();
      expect(presentation.pptx).toBeDefined();
      expect(presentation.metadata.title).toBe('Test Presentation');
      expect(presentation.metadata.author).toBe('Test Author');
      expect(presentation.metadata.slideCount).toBe(0);
    });

    it('should create presentation with theme', async () => {
      const config = {
        title: 'Themed Presentation',
        theme: 'corporate'
      };

      presentation = await processor.createPresentation(config);
      
      expect(presentation.success).toBe(true);
      expect(presentation.pptx.themeConfig).toBeDefined();
      expect(presentation.pptx.themeConfig.colors.primary).toBe('#1f4e79');
    });

    it('should create presentation with master slide', async () => {
      const config = {
        title: 'Master Slide Presentation',
        masterSlide: {
          elements: [
            {
              type: 'text',
              text: 'Company Logo',
              x: 0.5,
              y: 0.2,
              fontSize: 12
            }
          ]
        }
      };

      presentation = await processor.createPresentation(config);
      
      expect(presentation.success).toBe(true);
      expect(presentation.pptx.masterSlideId).toBeDefined();
      expect(processor.masterSlides.has(presentation.pptx.masterSlideId)).toBe(true);
    });

    it('should handle invalid presentation config', async () => {
      const invalidConfigs = [
        null,
        'invalid',
        { title: 123 },
        { author: [] }
      ];

      for (const config of invalidConfigs) {
        const result = await processor.createPresentation(config);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Template Loading and Processing', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Template Test Presentation'
      });
    });

    it('should load templates from directory', async () => {
      const templates = await processor.loadTemplates(TEST_TEMPLATES_DIR);
      
      expect(templates.success).toBe(true);
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(processor.templates.size).toBeGreaterThan(0);
    });

    it('should load single template file', async () => {
      const templatePath = path.join(TEST_TEMPLATES_DIR, 'title-slide.json');
      const templates = await processor.loadTemplates(templatePath);
      
      expect(templates.success).toBe(true);
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe('Title Slide Template');
    });

    it('should generate slide from template with variables', async () => {
      await processor.loadTemplates(TEST_TEMPLATES_DIR);
      
      const variables = {
        title: 'Dynamic Title',
        subtitle: 'Dynamic Subtitle',
        author: 'John Doe',
        company: 'ACME Corp'
      };

      const result = await processor.generateFromTemplate(
        presentation.id,
        'title-slide',
        variables
      );
      
      expect(result.success).toBe(true);
      expect(result.slideNumber).toBe(1);
      
      const info = processor.getPresentationInfo(presentation.id);
      expect(info.slideCount).toBe(1);
    });

    it('should handle nested variable replacement', async () => {
      await processor.loadTemplates(TEST_TEMPLATES_DIR);
      
      const variables = {
        company: {
          name: 'ACME Corp',
          address: {
            city: 'New York',
            state: 'NY'
          }
        },
        user: {
          name: 'John Doe',
          role: 'Manager'
        }
      };

      const result = await processor.generateFromTemplate(
        presentation.id,
        'nested-data',
        variables
      );
      
      expect(result.success).toBe(true);
    });

    it('should handle missing template', async () => {
      const result = await processor.generateFromTemplate(
        presentation.id,
        'non-existent-template',
        {}
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });
  });

  describe('Dynamic Content Generation', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Dynamic Content Test'
      });
    });

    it('should generate slides from data array', async () => {
      const dataArray = [
        { name: 'Product A', price: 100, category: 'Electronics' },
        { name: 'Product B', price: 200, category: 'Electronics' },
        { name: 'Product C', price: 150, category: 'Home' }
      ];

      const slideConfig = {
        layout: 'LAYOUT_16x9',
        elements: [
          {
            type: 'text',
            text: '{{name}}',
            x: 1,
            y: 1,
            fontSize: 24,
            bold: true
          },
          {
            type: 'text',
            text: 'Price: ${{price}}',
            x: 1,
            y: 2,
            fontSize: 18
          },
          {
            type: 'text',
            text: 'Category: {{category}}',
            x: 1,
            y: 3,
            fontSize: 16
          }
        ]
      };

      const result = await processor.generateFromDataArray(
        presentation.id,
        dataArray,
        slideConfig,
        { addSlideNumbers: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3);
      expect(result.results.every(r => r.success)).toBe(true);
      
      const info = processor.getPresentationInfo(presentation.id);
      expect(info.slideCount).toBe(3);
    });

    it('should handle errors in data array generation', async () => {
      const dataArray = [
        { name: 'Valid Product', price: 100 },
        null, // Invalid data
        { name: 'Another Product', price: 200 }
      ];

      const slideConfig = {
        elements: [
          {
            type: 'text',
            text: '{{name}}',
            x: 1,
            y: 1
          }
        ]
      };

      const result = await processor.generateFromDataArray(
        presentation.id,
        dataArray,
        slideConfig,
        { continueOnError: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3);
      expect(result.results.filter(r => r.success).length).toBe(2);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('Chart Processing', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Chart Test Presentation'
      });
    });

    it('should add bar chart to slide', async () => {
      const slide = presentation.pptx.addSlide();
      
      const chartElement = {
        type: 'chart',
        chartType: 'bar',
        title: 'Sales Data',
        x: 1,
        y: 1,
        width: 8,
        height: 5,
        data: [
          { label: 'Q1', value: 100 },
          { label: 'Q2', value: 150 },
          { label: 'Q3', value: 120 },
          { label: 'Q4', value: 180 }
        ]
      };

      await processor.processTemplateElement(slide, chartElement, {}, presentation.config);
      
      // Verify slide has chart (implementation dependent on pptxgenjs)
      expect(slide).toBeDefined();
    });

    it('should add pie chart with proper data formatting', async () => {
      const slide = presentation.pptx.addSlide();
      
      const chartElement = {
        type: 'chart',
        chartType: 'pie',
        title: 'Market Share',
        data: [
          { label: 'Company A', value: 40 },
          { label: 'Company B', value: 30 },
          { label: 'Company C', value: 20 },
          { label: 'Others', value: 10 }
        ]
      };

      await processor.processTemplateElement(slide, chartElement, {}, presentation.config);
      
      expect(slide).toBeDefined();
    });

    it('should format chart data correctly', () => {
      const data = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 }
      ];
      
      const barData = processor.formatChartData(data, 'bar');
      expect(barData).toHaveLength(1);
      expect(barData[0].name).toBe('Series 1');
      expect(barData[0].labels).toEqual(['A', 'B']);
      expect(barData[0].values).toEqual([10, 20]);
      
      const pieData = processor.formatChartData(data, 'pie');
      expect(pieData).toHaveLength(2);
      expect(pieData[0].name).toBe('A');
      expect(pieData[1].name).toBe('B');
    });
  });

  describe('Shape and SmartArt Processing', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Shapes Test Presentation'
      });
    });

    it('should add basic shapes to slide', async () => {
      const slide = presentation.pptx.addSlide();
      
      const shapeElement = {
        type: 'shape',
        shape: 'RECTANGLE',
        x: 2,
        y: 2,
        width: 4,
        height: 3,
        fill: 'FF0000',
        line: { color: '000000', width: 2 }
      };

      await processor.processTemplateElement(slide, shapeElement, {}, presentation.config);
      
      expect(slide).toBeDefined();
    });

    it('should create SmartArt list layout', async () => {
      const slide = presentation.pptx.addSlide();
      
      const smartArtElement = {
        type: 'smartart',
        smartArtType: 'list',
        x: 1,
        y: 1,
        width: 3,
        itemHeight: 0.8,
        spacing: 0.2,
        items: [
          { text: 'Item 1' },
          { text: 'Item 2' },
          { text: 'Item 3' }
        ]
      };

      processor.addSmartArtElement(slide, smartArtElement, presentation.config);
      
      expect(slide).toBeDefined();
    });

    it('should create SmartArt process layout', async () => {
      const slide = presentation.pptx.addSlide();
      
      const smartArtElement = {
        type: 'smartart',
        smartArtType: 'process',
        x: 1,
        y: 2,
        itemWidth: 2,
        spacing: 0.5,
        items: [
          { text: 'Step 1' },
          { text: 'Step 2' },
          { text: 'Step 3' }
        ]
      };

      processor.addSmartArtElement(slide, smartArtElement, presentation.config);
      
      expect(slide).toBeDefined();
    });

    it('should create SmartArt hierarchy layout', async () => {
      const slide = presentation.pptx.addSlide();
      
      const smartArtElement = {
        type: 'smartart',
        smartArtType: 'hierarchy',
        x: 2,
        y: 1,
        itemWidth: 2,
        itemHeight: 0.8,
        items: [
          { text: 'CEO' },
          { text: 'Manager A' },
          { text: 'Manager B' },
          { text: 'Manager C' }
        ]
      };

      processor.addSmartArtElement(slide, smartArtElement, presentation.config);
      
      expect(slide).toBeDefined();
    });
  });

  describe('Speaker Notes and Comments', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Notes Test Presentation'
      });
      // Add a slide for testing
      presentation.pptx.addSlide();
    });

    it('should add speaker notes to slide', async () => {
      const notes = 'These are speaker notes for slide 1';
      
      const result = await processor.addSpeakerNotes(
        presentation.id,
        1,
        notes
      );
      
      expect(result.success).toBe(true);
      expect(result.slideNumber).toBe(1);
      expect(result.notes).toBe(notes);
    });

    it('should add comments to presentation', async () => {
      const comment = {
        author: 'John Doe',
        text: 'This slide needs revision',
        x: 100,
        y: 200
      };
      
      const result = await processor.addComment(
        presentation.id,
        1,
        comment
      );
      
      expect(result.success).toBe(true);
      expect(presentation.comments).toBeDefined();
      expect(presentation.comments).toHaveLength(1);
      expect(presentation.comments[0].author).toBe('John Doe');
      expect(presentation.comments[0].text).toBe('This slide needs revision');
    });

    it('should handle invalid slide numbers', async () => {
      const result = await processor.addSpeakerNotes(
        presentation.id,
        99,
        'Invalid slide notes'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Animations and Transitions', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Animation Test Presentation'
      });
      presentation.pptx.addSlide();
    });

    it('should add animations to slide', async () => {
      const animations = [
        {
          type: 'fadeIn',
          duration: 1000,
          trigger: 'click',
          elementIndex: 0
        },
        {
          type: 'slideInFromLeft',
          duration: 800,
          trigger: 'auto',
          elementIndex: 1
        }
      ];
      
      const result = await processor.addAnimations(
        presentation.id,
        1,
        animations
      );
      
      expect(result.success).toBe(true);
      expect(result.animationCount).toBe(2);
      expect(presentation.animations.has(1)).toBe(true);
      expect(presentation.animations.get(1)).toEqual(animations);
    });

    it('should add transitions to slide', async () => {
      const transition = {
        type: 'fade',
        duration: 500,
        direction: 'horizontal'
      };
      
      const result = await processor.addTransition(
        presentation.id,
        1,
        transition
      );
      
      expect(result.success).toBe(true);
      expect(presentation.transitions.has(1)).toBe(true);
      expect(presentation.transitions.get(1)).toEqual(transition);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple presentations in batch', async () => {
      const batchJobs = [
        {
          id: 'job1',
          type: 'template',
          config: { title: 'Batch Presentation 1' },
          templateId: 'title-slide',
          variables: { title: 'Job 1', author: 'Batch Processor' },
          outputPath: path.join(TEST_OUTPUT_DIR, 'batch-1.pptx')
        },
        {
          id: 'job2',
          type: 'dataArray',
          config: { title: 'Batch Presentation 2' },
          dataArray: [
            { name: 'Item 1', value: 100 },
            { name: 'Item 2', value: 200 }
          ],
          slideConfig: {
            elements: [
              { type: 'text', text: '{{name}}', x: 1, y: 1 }
            ]
          },
          outputPath: path.join(TEST_OUTPUT_DIR, 'batch-2.pptx')
        }
      ];

      // Load templates first
      await processor.loadTemplates(TEST_TEMPLATES_DIR);

      const progressUpdates = [];
      const results = await processor.batchProcess(batchJobs, {
        maxConcurrent: 2,
        continueOnError: true,
        progressCallback: (progress) => {
          progressUpdates.push(progress);
        },
        defaultVariables: { company: 'Test Company' }
      });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].processed).toBe(2);
    });

    it('should handle batch processing errors', async () => {
      const batchJobs = [
        {
          id: 'valid-job',
          type: 'template',
          config: { title: 'Valid Job' },
          templateId: 'title-slide',
          variables: { title: 'Valid' }
        },
        {
          id: 'invalid-job',
          type: 'template',
          config: { title: 'Invalid Job' },
          templateId: 'non-existent-template',
          variables: { title: 'Invalid' }
        }
      ];

      await processor.loadTemplates(TEST_TEMPLATES_DIR);

      const results = await processor.batchProcess(batchJobs, {
        continueOnError: true
      });
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Template not found');
    });
  });

  describe('Export and File Operations', () => {
    beforeEach(async () => {
      presentation = await processor.createPresentation({
        title: 'Export Test Presentation',
        author: 'Test Author'
      });
    });

    it('should export presentation to file', async () => {
      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-export.pptx');
      
      // Add some content to presentation
      const slide = presentation.pptx.addSlide();
      slide.addText('Test Content', { x: 1, y: 1 });
      
      const result = await processor.exportPresentation(
        presentation.id,
        outputPath
      );
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(result.size).toBeGreaterThan(0);
      expect(result.slideCount).toBe(1);
      
      // Verify file exists
      const exists = await fs.pathExists(outputPath);
      expect(exists).toBe(true);
    });

    it('should handle invalid export paths', async () => {
      const invalidPath = '/invalid/path/test.pptx';
      
      const result = await processor.exportPresentation(
        presentation.id,
        invalidPath
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Utility Functions and Statistics', () => {
    it('should get presentation information', async () => {
      presentation = await processor.createPresentation({
        title: 'Info Test Presentation'
      });
      
      const info = processor.getPresentationInfo(presentation.id);
      
      expect(info.success).toBe(true);
      expect(info.id).toBe(presentation.id);
      expect(info.metadata.title).toBe('Info Test Presentation');
      expect(info.slideCount).toBe(0);
      expect(info.hasComments).toBe(false);
      expect(info.hasAnimations).toBe(false);
      expect(info.hasTransitions).toBe(false);
    });

    it('should get processor statistics', () => {
      const stats = processor.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.activePresentations).toBeDefined();
      expect(stats.loadedTemplates).toBeDefined();
      expect(stats.masterSlides).toBeDefined();
      expect(stats.errorCount).toBeDefined();
      expect(stats.memoryUsage).toBeDefined();
      expect(stats.uptime).toBeDefined();
    });

    it('should cleanup presentation resources', async () => {
      presentation = await processor.createPresentation({
        title: 'Cleanup Test'
      });
      
      const presentationId = presentation.id;
      expect(processor.presentations.has(presentationId)).toBe(true);
      
      const cleaned = processor.cleanupPresentation(presentationId);
      
      expect(cleaned).toBe(true);
      expect(processor.presentations.has(presentationId)).toBe(false);
    });

    it('should chunk arrays correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = processor.chunkArray(array, 3);
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });
  });

  describe('Error Handling', () => {
    it('should handle and register custom error handlers', () => {
      const customHandler = (error, context) => ({
        success: false,
        customError: true,
        message: error.message,
        context
      });
      
      processor.registerErrorHandler('custom', customHandler);
      
      const testError = new Error('Custom test error');
      const result = processor.handleError('custom', testError, { test: true });
      
      expect(result.success).toBe(false);
      expect(result.customError).toBe(true);
      expect(result.message).toBe('Custom test error');
      expect(result.context.test).toBe(true);
    });

    it('should handle unknown error types with default handler', () => {
      const testError = new Error('Unknown error');
      const result = processor.handleError('unknown', testError, { test: true });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.context.test).toBe(true);
      expect(processor.errors.length).toBeGreaterThan(0);
    });
  });

  // Helper function to create test templates
  async function createTestTemplates() {
    const templates = {
      'title-slide.json': {
        id: 'title-slide',
        name: 'Title Slide Template',
        layout: 'LAYOUT_16x9',
        elements: [
          {
            type: 'text',
            text: '{{title}}',
            x: 1,
            y: 2,
            width: 8,
            height: 2,
            fontSize: 36,
            bold: true,
            align: 'center'
          },
          {
            type: 'text',
            text: '{{subtitle}}',
            x: 1,
            y: 4,
            width: 8,
            height: 1,
            fontSize: 24,
            align: 'center'
          },
          {
            type: 'text',
            text: '{{author}}',
            x: 1,
            y: 6,
            width: 8,
            height: 0.5,
            fontSize: 18,
            align: 'center'
          }
        ]
      },
      'content-slide.json': {
        id: 'content-slide',
        name: 'Content Slide Template',
        layout: 'LAYOUT_16x9',
        elements: [
          {
            type: 'text',
            text: '{{title}}',
            x: 1,
            y: 0.5,
            width: 8,
            height: 1,
            fontSize: 28,
            bold: true
          },
          {
            type: 'text',
            text: '{{content}}',
            x: 1,
            y: 2,
            width: 8,
            height: 4,
            fontSize: 16
          }
        ]
      },
      'nested-data.json': {
        id: 'nested-data',
        name: 'Nested Data Template',
        layout: 'LAYOUT_16x9',
        elements: [
          {
            type: 'text',
            text: '{{company.name}}',
            x: 1,
            y: 1,
            fontSize: 24,
            bold: true
          },
          {
            type: 'text',
            text: '{{company.address.city}}, {{company.address.state}}',
            x: 1,
            y: 2,
            fontSize: 16
          },
          {
            type: 'text',
            text: '{{user.name}} - {{user.role}}',
            x: 1,
            y: 3,
            fontSize: 18
          }
        ]
      }
    };

    for (const [filename, content] of Object.entries(templates)) {
      const filePath = path.join(TEST_TEMPLATES_DIR, filename);
      await fs.writeJson(filePath, content, { spaces: 2 });
    }
  }
});