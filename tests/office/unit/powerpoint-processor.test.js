/**
 * @fileoverview Unit tests for PowerPoint processor functionality
 * Tests PowerPoint presentation processing, slide manipulation, content injection, and chart operations
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Mock PowerPoint Processor class for testing
 */
class PowerPointProcessor {
  constructor(options = {}) {
    this.options = {
      preserveLayouts: true,
      preserveAnimations: true,
      autoFitText: true,
      updateCharts: true,
      strictMode: false,
      ...options
    };
    
    this.stats = {
      processed: 0,
      slidesProcessed: 0,
      contentInjected: 0,
      chartsUpdated: 0,
      animationsPreserved: 0,
      errors: []
    };
  }

  /**
   * Check if file is supported PowerPoint format
   */
  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.pptx', '.ppt', '.potx', '.pot', '.ppsx', '.pps'].includes(ext);
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return ['.pptx', '.ppt', '.potx', '.pot', '.ppsx', '.pps'];
  }

  /**
   * Process PowerPoint template with data
   */
  async processTemplate(templatePath, data, outputPath) {
    this.stats.processed++;

    await TestUtils.assertFileExists(templatePath);
    
    const presentation = await this._loadPresentation(templatePath);
    const processedPresentation = await this._populateData(presentation, data);
    
    if (outputPath) {
      await this._savePresentation(processedPresentation, outputPath);
    }

    return {
      success: true,
      templatePath,
      outputPath,
      slides: processedPresentation.slides.length,
      contentInjected: this.stats.contentInjected,
      chartsUpdated: this.stats.chartsUpdated,
      processingTime: Math.random() * 300
    };
  }

  /**
   * Extract presentation structure
   */
  async extractStructure(filePath) {
    await TestUtils.assertFileExists(filePath);
    
    const presentation = await this._loadPresentation(filePath);
    const structure = {
      filePath,
      slides: [],
      layouts: [],
      masterSlides: [],
      themes: [],
      metadata: await this._extractMetadata(presentation)
    };
    
    // Extract slide information
    for (const slide of presentation.slides) {
      structure.slides.push({
        slideNumber: slide.slideNumber,
        layout: slide.layout,
        placeholders: slide.placeholders,
        shapes: slide.shapes.map(shape => ({
          type: shape.type,
          name: shape.name,
          position: shape.position,
          size: shape.size,
          hasText: shape.hasText
        })),
        charts: slide.charts || [],
        animations: slide.animations || []
      });
    }
    
    return structure;
  }

  /**
   * Inject content into presentation
   */
  async injectContent(filePath, injections) {
    await TestUtils.assertFileExists(filePath);
    
    const presentation = await this._loadPresentation(filePath);
    const results = [];
    
    for (const injection of injections) {
      try {
        const result = await this._performContentInjection(presentation, injection);
        results.push(result);
        this.stats.contentInjected++;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          injection,
          error: error.message
        });
      }
    }
    
    await this._savePresentation(presentation, filePath);
    
    return {
      success: true,
      filePath,
      injections: results.filter(r => r.success),
      failures: results.filter(r => !r.success),
      totalContentInjected: this.stats.contentInjected
    };
  }

  /**
   * Manipulate slides
   */
  async manipulateSlides(filePath, operations) {
    await TestUtils.assertFileExists(filePath);
    
    const presentation = await this._loadPresentation(filePath);
    const results = [];
    
    for (const operation of operations) {
      try {
        const result = await this._performSlideOperation(presentation, operation);
        results.push(result);
        this.stats.slidesProcessed++;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          operation,
          error: error.message
        });
      }
    }
    
    await this._savePresentation(presentation, filePath);
    
    return {
      success: true,
      filePath,
      operations: results.filter(r => r.success),
      failures: results.filter(r => !r.success)
    };
  }

  /**
   * Update charts in presentation
   */
  async updateCharts(filePath, chartUpdates) {
    await TestUtils.assertFileExists(filePath);
    
    const presentation = await this._loadPresentation(filePath);
    const results = [];
    
    for (const update of chartUpdates) {
      try {
        const result = await this._updateChart(presentation, update);
        results.push(result);
        this.stats.chartsUpdated++;
      } catch (error) {
        this.stats.errors.push(error.message);
        results.push({
          success: false,
          update,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      filePath,
      chartUpdates: results.filter(r => r.success),
      failures: results.filter(r => !r.success)
    };
  }

  /**
   * Validate presentation template
   */
  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    
    const presentation = await this._loadPresentation(templatePath);
    const issues = [];
    
    // Check basic structure
    if (presentation.slides.length === 0) {
      issues.push('Presentation contains no slides');
    }
    
    // Validate placeholders
    for (const slide of presentation.slides) {
      const missingPlaceholders = slide.placeholders.filter(p => !this._isValidPlaceholder(p));
      if (missingPlaceholders.length > 0) {
        issues.push(`Invalid placeholders in slide ${slide.slideNumber}: ${missingPlaceholders.map(p => p.name).join(', ')}`);
      }
      
      // Check for broken links
      const brokenLinks = this._findBrokenLinks(slide);
      if (brokenLinks.length > 0) {
        issues.push(`Broken links in slide ${slide.slideNumber}: ${brokenLinks.length} links`);
      }
    }
    
    // Validate charts
    const invalidCharts = await this._findInvalidCharts(presentation);
    if (invalidCharts.length > 0) {
      issues.push(`Invalid charts found: ${invalidCharts.length} charts`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      slides: presentation.slides.map(slide => ({
        slideNumber: slide.slideNumber,
        layout: slide.layout,
        placeholders: slide.placeholders.length,
        shapes: slide.shapes.length,
        charts: slide.charts?.length || 0,
        animations: slide.animations?.length || 0
      })),
      variables: await this._extractTemplateVariables(presentation)
    };
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      slidesProcessed: 0,
      contentInjected: 0,
      chartsUpdated: 0,
      animationsPreserved: 0,
      errors: []
    };
  }

  // Private helper methods

  async _loadPresentation(filePath) {
    // Simulate loading PowerPoint presentation
    return {
      path: filePath,
      slides: [
        {
          slideNumber: 1,
          layout: 'Title Slide',
          placeholders: [
            { name: 'title', type: 'title', content: '{{presentation_title}}' },
            { name: 'subtitle', type: 'subtitle', content: '{{presentation_subtitle}}' }
          ],
          shapes: [
            {
              type: 'textbox',
              name: 'title_shape',
              position: { x: 0, y: 0 },
              size: { width: 10, height: 2 },
              hasText: true,
              text: '{{presentation_title}}'
            }
          ],
          charts: [],
          animations: []
        },
        {
          slideNumber: 2,
          layout: 'Content with Caption',
          placeholders: [
            { name: 'title', type: 'title', content: '{{slide_2_title}}' },
            { name: 'content', type: 'content', content: '{{slide_2_content}}' }
          ],
          shapes: [
            {
              type: 'textbox',
              name: 'content_shape',
              position: { x: 0, y: 2 },
              size: { width: 10, height: 6 },
              hasText: true,
              text: '{{slide_2_content}}'
            }
          ],
          charts: [
            {
              id: 'chart1',
              type: 'column',
              title: '{{chart_title}}',
              data: {
                categories: ['{{cat1}}', '{{cat2}}', '{{cat3}}'],
                series: [
                  { name: '{{series1}}', values: ['{{val1}}', '{{val2}}', '{{val3}}'] }
                ]
              }
            }
          ],
          animations: [
            { type: 'entrance', effect: 'fade', target: 'title_shape' }
          ]
        }
      ],
      layouts: ['Title Slide', 'Content with Caption', 'Blank'],
      masterSlides: [{ name: 'Office Theme' }],
      themes: [{ name: 'Default Theme' }]
    };
  }

  async _savePresentation(presentation, filePath) {
    // Simulate saving presentation
    return true;
  }

  async _populateData(presentation, data) {
    const processedPresentation = { ...presentation };
    
    for (const slide of processedPresentation.slides) {
      // Replace placeholder content
      for (const placeholder of slide.placeholders) {
        if (typeof placeholder.content === 'string' && placeholder.content.includes('{{')) {
          placeholder.content = this._replaceVariables(placeholder.content, data);
          this.stats.contentInjected++;
        }
      }
      
      // Replace shape text
      for (const shape of slide.shapes) {
        if (shape.hasText && shape.text && shape.text.includes('{{')) {
          shape.text = this._replaceVariables(shape.text, data);
          this.stats.contentInjected++;
        }
      }
      
      // Update charts
      for (const chart of slide.charts || []) {
        if (chart.title && chart.title.includes('{{')) {
          chart.title = this._replaceVariables(chart.title, data);
        }
        
        // Update chart data
        if (chart.data && chart.data.categories) {
          chart.data.categories = chart.data.categories.map(cat => 
            typeof cat === 'string' ? this._replaceVariables(cat, data) : cat
          );
        }
        
        if (chart.data && chart.data.series) {
          for (const series of chart.data.series) {
            if (series.name && series.name.includes('{{')) {
              series.name = this._replaceVariables(series.name, data);
            }
            if (series.values) {
              series.values = series.values.map(val => 
                typeof val === 'string' ? this._replaceVariables(val, data) : val
              );
            }
          }
        }
        
        this.stats.chartsUpdated++;
      }
      
      this.stats.slidesProcessed++;
    }
    
    return processedPresentation;
  }

  _replaceVariables(content, data) {
    let processedContent = content;
    
    for (const [key, value] of Object.entries(data)) {
      // Replace basic variables
      processedContent = processedContent.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
        String(value)
      );
    }
    
    return processedContent;
  }

  async _extractMetadata(presentation) {
    return {
      filename: path.basename(presentation.path),
      format: path.extname(presentation.path).toLowerCase(),
      slideCount: presentation.slides.length,
      layoutCount: presentation.layouts.length,
      themeCount: presentation.themes?.length || 0,
      created: this.getDeterministicDate(),
      modified: this.getDeterministicDate()
    };
  }

  async _performContentInjection(presentation, injection) {
    const { target, content, mode = 'replace' } = injection;
    
    // Parse target (e.g., "slide:1:placeholder:title", "slide:2:shape:content_shape")
    const targetParts = target.split(':');
    if (targetParts.length < 3) {
      throw new Error(`Invalid target format: ${target}`);
    }
    
    const slideNumber = parseInt(targetParts[1]);
    const targetType = targetParts[2];
    const targetName = targetParts[3];
    
    const slide = presentation.slides.find(s => s.slideNumber === slideNumber);
    if (!slide) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    if (targetType === 'placeholder') {
      const placeholder = slide.placeholders.find(p => p.name === targetName);
      if (!placeholder) {
        throw new Error(`Placeholder '${targetName}' not found in slide ${slideNumber}`);
      }
      
      switch (mode) {
        case 'replace':
          placeholder.content = content;
          break;
        case 'append':
          placeholder.content += content;
          break;
        case 'prepend':
          placeholder.content = content + placeholder.content;
          break;
      }
    } else if (targetType === 'shape') {
      const shape = slide.shapes.find(s => s.name === targetName);
      if (!shape) {
        throw new Error(`Shape '${targetName}' not found in slide ${slideNumber}`);
      }
      
      if (shape.hasText) {
        switch (mode) {
          case 'replace':
            shape.text = content;
            break;
          case 'append':
            shape.text += content;
            break;
          case 'prepend':
            shape.text = content + shape.text;
            break;
        }
      }
    }
    
    return {
      success: true,
      target,
      content,
      mode,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async _performSlideOperation(presentation, operation) {
    const { type, slideNumber, data } = operation;
    
    switch (type) {
      case 'addSlide':
        return this._addSlide(presentation, data);
      case 'deleteSlide':
        return this._deleteSlide(presentation, slideNumber);
      case 'duplicateSlide':
        return this._duplicateSlide(presentation, slideNumber);
      case 'moveSlide':
        return this._moveSlide(presentation, slideNumber, data.newPosition);
      case 'setLayout':
        return this._setSlideLayout(presentation, slideNumber, data.layout);
      default:
        throw new Error(`Unknown slide operation: ${type}`);
    }
  }

  _addSlide(presentation, slideData) {
    const newSlide = {
      slideNumber: presentation.slides.length + 1,
      layout: slideData.layout || 'Blank',
      placeholders: slideData.placeholders || [],
      shapes: slideData.shapes || [],
      charts: slideData.charts || [],
      animations: slideData.animations || []
    };
    
    presentation.slides.push(newSlide);
    
    return {
      success: true,
      operation: 'addSlide',
      slideNumber: newSlide.slideNumber,
      layout: newSlide.layout
    };
  }

  _deleteSlide(presentation, slideNumber) {
    const slideIndex = presentation.slides.findIndex(s => s.slideNumber === slideNumber);
    if (slideIndex === -1) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    presentation.slides.splice(slideIndex, 1);
    
    // Renumber remaining slides
    presentation.slides.forEach((slide, index) => {
      slide.slideNumber = index + 1;
    });
    
    return {
      success: true,
      operation: 'deleteSlide',
      deletedSlide: slideNumber,
      remainingSlides: presentation.slides.length
    };
  }

  _duplicateSlide(presentation, slideNumber) {
    const sourceSlide = presentation.slides.find(s => s.slideNumber === slideNumber);
    if (!sourceSlide) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    const duplicatedSlide = {
      ...sourceSlide,
      slideNumber: presentation.slides.length + 1,
      placeholders: sourceSlide.placeholders.map(p => ({ ...p })),
      shapes: sourceSlide.shapes.map(s => ({ ...s })),
      charts: sourceSlide.charts?.map(c => ({ ...c })) || [],
      animations: sourceSlide.animations?.map(a => ({ ...a })) || []
    };
    
    presentation.slides.push(duplicatedSlide);
    
    return {
      success: true,
      operation: 'duplicateSlide',
      sourceSlide: slideNumber,
      newSlide: duplicatedSlide.slideNumber
    };
  }

  _moveSlide(presentation, slideNumber, newPosition) {
    const slideIndex = presentation.slides.findIndex(s => s.slideNumber === slideNumber);
    if (slideIndex === -1) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    if (newPosition < 1 || newPosition > presentation.slides.length) {
      throw new Error(`Invalid new position: ${newPosition}`);
    }
    
    const slide = presentation.slides.splice(slideIndex, 1)[0];
    presentation.slides.splice(newPosition - 1, 0, slide);
    
    // Renumber all slides
    presentation.slides.forEach((slide, index) => {
      slide.slideNumber = index + 1;
    });
    
    return {
      success: true,
      operation: 'moveSlide',
      slideNumber,
      newPosition,
      newSlideNumber: newPosition
    };
  }

  _setSlideLayout(presentation, slideNumber, layout) {
    const slide = presentation.slides.find(s => s.slideNumber === slideNumber);
    if (!slide) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    if (!presentation.layouts.includes(layout)) {
      throw new Error(`Layout '${layout}' not available`);
    }
    
    slide.layout = layout;
    
    return {
      success: true,
      operation: 'setLayout',
      slideNumber,
      layout
    };
  }

  async _updateChart(presentation, update) {
    const { slideNumber, chartId, data } = update;
    
    const slide = presentation.slides.find(s => s.slideNumber === slideNumber);
    if (!slide) {
      throw new Error(`Slide ${slideNumber} not found`);
    }
    
    const chart = slide.charts?.find(c => c.id === chartId);
    if (!chart) {
      throw new Error(`Chart '${chartId}' not found in slide ${slideNumber}`);
    }
    
    // Update chart data
    if (data.title !== undefined) {
      chart.title = data.title;
    }
    
    if (data.categories) {
      chart.data.categories = data.categories;
    }
    
    if (data.series) {
      chart.data.series = data.series;
    }
    
    if (data.type) {
      chart.type = data.type;
    }
    
    return {
      success: true,
      slideNumber,
      chartId,
      updatedProperties: Object.keys(data)
    };
  }

  _isValidPlaceholder(placeholder) {
    return placeholder.name && placeholder.type && ['title', 'subtitle', 'content', 'text'].includes(placeholder.type);
  }

  _findBrokenLinks(slide) {
    // Simplified broken link detection
    const brokenLinks = [];
    
    for (const shape of slide.shapes) {
      if (shape.hasText && shape.text) {
        // Look for hyperlinks that might be broken
        const linkMatches = shape.text.match(/https?:\/\/[^\s]+/g) || [];
        // In real implementation, would validate these links
        if (linkMatches.some(link => link.includes('broken'))) {
          brokenLinks.push(link);
        }
      }
    }
    
    return brokenLinks;
  }

  async _findInvalidCharts(presentation) {
    const invalidCharts = [];
    
    for (const slide of presentation.slides) {
      for (const chart of slide.charts || []) {
        // Check if chart has required properties
        if (!chart.type || !chart.data || !chart.data.categories) {
          invalidCharts.push({
            slideNumber: slide.slideNumber,
            chartId: chart.id,
            reason: 'Missing required chart properties'
          });
        }
        
        // Check for empty data
        if (chart.data.series && chart.data.series.every(s => !s.values || s.values.length === 0)) {
          invalidCharts.push({
            slideNumber: slide.slideNumber,
            chartId: chart.id,
            reason: 'Chart has no data'
          });
        }
      }
    }
    
    return invalidCharts;
  }

  async _extractTemplateVariables(presentation) {
    const variables = [];
    const variableSet = new Set();
    
    for (const slide of presentation.slides) {
      // Extract from placeholders
      for (const placeholder of slide.placeholders) {
        if (typeof placeholder.content === 'string') {
          const matches = placeholder.content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
          for (const match of matches) {
            const varName = match.replace(/[{}]/g, '').trim();
            if (!variableSet.has(varName)) {
              variables.push({
                name: varName,
                type: 'string',
                location: `slide:${slide.slideNumber}:placeholder:${placeholder.name}`,
                required: true
              });
              variableSet.add(varName);
            }
          }
        }
      }
      
      // Extract from shapes
      for (const shape of slide.shapes) {
        if (shape.hasText && shape.text && typeof shape.text === 'string') {
          const matches = shape.text.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
          for (const match of matches) {
            const varName = match.replace(/[{}]/g, '').trim();
            if (!variableSet.has(varName)) {
              variables.push({
                name: varName,
                type: 'string',
                location: `slide:${slide.slideNumber}:shape:${shape.name}`,
                required: true
              });
              variableSet.add(varName);
            }
          }
        }
      }
      
      // Extract from charts
      for (const chart of slide.charts || []) {
        if (chart.title && chart.title.includes('{{')) {
          const matches = chart.title.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
          for (const match of matches) {
            const varName = match.replace(/[{}]/g, '').trim();
            if (!variableSet.has(varName)) {
              variables.push({
                name: varName,
                type: 'string',
                location: `slide:${slide.slideNumber}:chart:${chart.id}:title`,
                required: true
              });
              variableSet.add(varName);
            }
          }
        }
      }
    }
    
    return variables;
  }
}

/**
 * Register PowerPoint processor tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('PowerPoint Processor Unit Tests', async () => {
    let processor;
    let testData;
    
    beforeEach(() => {
      processor = new PowerPointProcessor();
      testData = {
        presentation_title: 'Test Presentation',
        presentation_subtitle: 'Comprehensive Testing Suite',
        slide_2_title: 'Content Slide',
        slide_2_content: 'This is sample content for testing.',
        chart_title: 'Sales Performance',
        cat1: 'Q1',
        cat2: 'Q2',
        cat3: 'Q3',
        series1: 'Revenue',
        val1: 1000,
        val2: 1200,
        val3: 1500,
        ...TestUtils.createTestVariables()
      };
    });
    
    describe('PowerPoint Processor Construction', () => {
      test('should create processor with default options', () => {
        const defaultProcessor = new PowerPointProcessor();
        assert.strictEqual(defaultProcessor.options.preserveLayouts, true);
        assert.strictEqual(defaultProcessor.options.preserveAnimations, true);
        assert.strictEqual(defaultProcessor.options.autoFitText, true);
        assert.strictEqual(defaultProcessor.options.updateCharts, true);
        assert.strictEqual(defaultProcessor.options.strictMode, false);
      });
      
      test('should create processor with custom options', () => {
        const customProcessor = new PowerPointProcessor({
          preserveLayouts: false,
          preserveAnimations: false,
          autoFitText: false,
          strictMode: true
        });
        
        assert.strictEqual(customProcessor.options.preserveLayouts, false);
        assert.strictEqual(customProcessor.options.preserveAnimations, false);
        assert.strictEqual(customProcessor.options.autoFitText, false);
        assert.strictEqual(customProcessor.options.strictMode, true);
      });
    });

    describe('File Format Support', () => {
      test('should support PPTX files', () => {
        assert.strictEqual(processor.isSupported('/path/to/presentation.pptx'), true);
        assert.strictEqual(processor.isSupported('/path/to/presentation.PPTX'), true);
      });
      
      test('should support PPT files', () => {
        assert.strictEqual(processor.isSupported('/path/to/presentation.ppt'), true);
        assert.strictEqual(processor.isSupported('/path/to/presentation.PPT'), true);
      });
      
      test('should support PowerPoint template files', () => {
        assert.strictEqual(processor.isSupported('/path/to/template.potx'), true);
        assert.strictEqual(processor.isSupported('/path/to/template.pot'), true);
      });
      
      test('should support slideshow files', () => {
        assert.strictEqual(processor.isSupported('/path/to/slideshow.ppsx'), true);
        assert.strictEqual(processor.isSupported('/path/to/slideshow.pps'), true);
      });
      
      test('should not support non-PowerPoint files', () => {
        assert.strictEqual(processor.isSupported('/path/to/document.docx'), false);
        assert.strictEqual(processor.isSupported('/path/to/workbook.xlsx'), false);
        assert.strictEqual(processor.isSupported('/path/to/document.pdf'), false);
      });
      
      test('should return correct supported extensions', () => {
        const extensions = processor.getSupportedExtensions();
        assert.deepStrictEqual(extensions, ['.pptx', '.ppt', '.potx', '.pot', '.ppsx', '.pps']);
      });
    });

    describe('Template Processing', () => {
      test('should process PowerPoint template with data', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        const outputPath = TestUtils.getTempPath('output.pptx');
        
        const result = await processor.processTemplate(templatePath, testData, outputPath);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.templatePath, templatePath);
        assert.strictEqual(result.outputPath, outputPath);
        assert.ok(result.slides > 0);
        assert.ok(result.contentInjected >= 0);
        assert.ok(result.processingTime >= 0);
      });
      
      test('should process template without output path', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.processTemplate(templatePath, testData);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.outputPath, undefined);
      });
      
      test('should handle missing template file', async () => {
        const templatePath = '/nonexistent/presentation.pptx';
        
        try {
          await processor.processTemplate(templatePath, testData);
          assert.fail('Should have thrown error for missing file');
        } catch (error) {
          assert.ok(error.message.includes('does not exist'));
        }
      });
      
      test('should replace template variables in slides', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.processTemplate(templatePath, testData);
        
        assert.strictEqual(result.success, true);
        assert.ok(result.contentInjected > 0);
      });
      
      test('should update charts with template data', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.processTemplate(templatePath, testData);
        
        assert.strictEqual(result.success, true);
        assert.ok(result.chartsUpdated >= 0);
      });
    });

    describe('Structure Extraction', () => {
      test('should extract presentation structure', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.extractStructure(filePath);
        
        assert.strictEqual(typeof result, 'object');
        assert.strictEqual(result.filePath, filePath);
        assert.ok(Array.isArray(result.slides));
        assert.ok(Array.isArray(result.layouts));
        assert.ok(result.metadata);
      });
      
      test('should extract slide details', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.extractStructure(filePath);
        
        result.slides.forEach(slide => {
          assert.ok(typeof slide.slideNumber === 'number');
          assert.ok(slide.layout);
          assert.ok(Array.isArray(slide.placeholders));
          assert.ok(Array.isArray(slide.shapes));
          assert.ok(Array.isArray(slide.charts));
          assert.ok(Array.isArray(slide.animations));
        });
      });
      
      test('should extract shape information', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.extractStructure(filePath);
        const firstSlide = result.slides[0];
        
        if (firstSlide.shapes.length > 0) {
          const shape = firstSlide.shapes[0];
          assert.ok(shape.type);
          assert.ok(shape.name);
          assert.ok(shape.position);
          assert.ok(shape.size);
          assert.ok(typeof shape.hasText === 'boolean');
        }
      });
    });

    describe('Content Injection', () => {
      test('should inject content into placeholder', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:placeholder:title',
            content: 'Injected Title',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.filePath, filePath);
        assert.strictEqual(result.injections.length, 1);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should inject content into shape', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:shape:title_shape',
            content: 'Injected Shape Content',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
      
      test('should handle multiple injections', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:placeholder:title',
            content: 'Title 1',
            mode: 'replace'
          },
          {
            target: 'slide:2:placeholder:title',
            content: 'Title 2',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 2);
      });
      
      test('should support different injection modes', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:placeholder:title',
            content: 'Replace',
            mode: 'replace'
          },
          {
            target: 'slide:1:placeholder:subtitle',
            content: ' Appended',
            mode: 'append'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 2);
        assert.strictEqual(result.injections[0].mode, 'replace');
        assert.strictEqual(result.injections[1].mode, 'append');
      });
      
      test('should handle invalid slide reference', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:99:placeholder:title',
            content: 'Test',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
      
      test('should handle invalid placeholder reference', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:placeholder:nonexistent',
            content: 'Test',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
    });

    describe('Slide Manipulation', () => {
      test('should add new slide', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'addSlide',
            data: {
              layout: 'Content with Caption',
              placeholders: [
                { name: 'title', type: 'title', content: 'New Slide' }
              ]
            }
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].operation, 'addSlide');
        assert.strictEqual(result.operations[0].slideNumber, 3);
      });
      
      test('should delete slide', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'deleteSlide',
            slideNumber: 2
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].operation, 'deleteSlide');
        assert.strictEqual(result.operations[0].deletedSlide, 2);
        assert.strictEqual(result.operations[0].remainingSlides, 1);
      });
      
      test('should duplicate slide', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'duplicateSlide',
            slideNumber: 1
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].operation, 'duplicateSlide');
        assert.strictEqual(result.operations[0].sourceSlide, 1);
        assert.strictEqual(result.operations[0].newSlide, 3);
      });
      
      test('should move slide', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'moveSlide',
            slideNumber: 2,
            data: { newPosition: 1 }
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].operation, 'moveSlide');
        assert.strictEqual(result.operations[0].newPosition, 1);
      });
      
      test('should change slide layout', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'setLayout',
            slideNumber: 1,
            data: { layout: 'Blank' }
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0].layout, 'Blank');
      });
      
      test('should handle invalid slide operation', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const operations = [
          {
            type: 'invalidOperation',
            slideNumber: 1
          }
        ];
        
        const result = await processor.manipulateSlides(filePath, operations);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.operations.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
    });

    describe('Chart Operations', () => {
      test('should update chart data', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const chartUpdates = [
          {
            slideNumber: 2,
            chartId: 'chart1',
            data: {
              title: 'Updated Chart Title',
              categories: ['Q1', 'Q2', 'Q3', 'Q4'],
              series: [
                { name: 'Sales', values: [100, 120, 130, 150] }
              ]
            }
          }
        ];
        
        const result = await processor.updateCharts(filePath, chartUpdates);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.chartUpdates.length, 1);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should update chart type', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const chartUpdates = [
          {
            slideNumber: 2,
            chartId: 'chart1',
            data: {
              type: 'bar'
            }
          }
        ];
        
        const result = await processor.updateCharts(filePath, chartUpdates);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.chartUpdates.length, 1);
        assert.ok(result.chartUpdates[0].updatedProperties.includes('type'));
      });
      
      test('should handle missing chart', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const chartUpdates = [
          {
            slideNumber: 2,
            chartId: 'nonexistent',
            data: {
              title: 'New Title'
            }
          }
        ];
        
        const result = await processor.updateCharts(filePath, chartUpdates);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.chartUpdates.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
      
      test('should handle missing slide for chart update', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const chartUpdates = [
          {
            slideNumber: 99,
            chartId: 'chart1',
            data: {
              title: 'New Title'
            }
          }
        ];
        
        const result = await processor.updateCharts(filePath, chartUpdates);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.chartUpdates.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
    });

    describe('Template Validation', () => {
      test('should validate correct PowerPoint template', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.issues.length, 0);
        assert.ok(Array.isArray(result.slides));
        assert.ok(Array.isArray(result.variables));
      });
      
      test('should detect empty presentation', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        // Mock empty presentation
        const originalMethod = processor._loadPresentation;
        processor._loadPresentation = async () => ({
          path: templatePath,
          slides: [],
          layouts: [],
          masterSlides: [],
          themes: []
        });
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(issue => issue.includes('no slides')));
        
        // Restore original method
        processor._loadPresentation = originalMethod;
      });
      
      test('should detect invalid placeholders', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        // Mock invalid placeholder
        const originalMethod = processor._loadPresentation;
        processor._loadPresentation = async () => ({
          path: templatePath,
          slides: [{
            slideNumber: 1,
            layout: 'Title Slide',
            placeholders: [
              { name: '', type: '', content: 'Invalid placeholder' }
            ],
            shapes: [],
            charts: [],
            animations: []
          }],
          layouts: ['Title Slide'],
          masterSlides: [],
          themes: []
        });
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(issue => issue.includes('Invalid placeholders')));
        
        // Restore original method
        processor._loadPresentation = originalMethod;
      });
      
      test('should extract template variables during validation', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.validateTemplate(templatePath);
        
        assert.ok(Array.isArray(result.variables));
        if (result.variables.length > 0) {
          result.variables.forEach(variable => {
            assert.ok(variable.name);
            assert.ok(variable.type);
            assert.ok(variable.location);
            assert.ok(typeof variable.required === 'boolean');
          });
        }
      });
      
      test('should validate slide information', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.validateTemplate(templatePath);
        
        result.slides.forEach(slide => {
          assert.ok(typeof slide.slideNumber === 'number');
          assert.ok(slide.layout);
          assert.ok(typeof slide.placeholders === 'number');
          assert.ok(typeof slide.shapes === 'number');
          assert.ok(typeof slide.charts === 'number');
          assert.ok(typeof slide.animations === 'number');
        });
      });
    });

    describe('Statistics and Performance', () => {
      test('should track processing statistics', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        // Perform operations
        await processor.processTemplate(filePath, testData);
        await processor.injectContent(filePath, [{ target: 'slide:1:placeholder:title', content: 'Test', mode: 'replace' }]);
        await processor.updateCharts(filePath, [{ slideNumber: 2, chartId: 'chart1', data: { title: 'Test Chart' } }]);
        
        const stats = processor.getStats();
        
        assert.strictEqual(stats.processed, 1);
        assert.ok(stats.slidesProcessed > 0);
        assert.ok(stats.contentInjected > 0);
        assert.ok(stats.chartsUpdated > 0);
      });
      
      test('should reset statistics', () => {
        // Set some stats
        processor.stats.processed = 3;
        processor.stats.slidesProcessed = 6;
        processor.stats.contentInjected = 15;
        
        processor.resetStats();
        
        const stats = processor.getStats();
        assert.strictEqual(stats.processed, 0);
        assert.strictEqual(stats.slidesProcessed, 0);
        assert.strictEqual(stats.contentInjected, 0);
        assert.strictEqual(stats.chartsUpdated, 0);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('should handle empty injections array', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.injectContent(filePath, []);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 0);
      });
      
      test('should handle invalid target format', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'invalid_target',
            content: 'Test',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 0);
        assert.strictEqual(result.failures.length, 1);
      });
      
      test('should handle null data processing', async () => {
        const templatePath = TestUtils.getTestDataPath('presentation.pptx');
        
        const result = await processor.processTemplate(templatePath, null);
        
        assert.strictEqual(result.success, true);
      });
      
      test('should handle special characters in content', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const injections = [
          {
            target: 'slide:1:placeholder:title',
            content: 'Content with "quotes" and <tags> and émojis 🚀',
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
      
      test('should handle large content values', async () => {
        const filePath = TestUtils.getTestDataPath('presentation.pptx');
        const largeContent = 'Very long content '.repeat(100);
        const injections = [
          {
            target: 'slide:1:placeholder:title',
            content: largeContent,
            mode: 'replace'
          }
        ];
        
        const result = await processor.injectContent(filePath, injections);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.injections.length, 1);
      });
    });
  });
}