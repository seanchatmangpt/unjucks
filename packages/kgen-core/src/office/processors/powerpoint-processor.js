/**
 * PowerPoint document processor for Office template processing in KGEN
 * 
 * This module provides comprehensive PowerPoint document processing capabilities including:
 * - PPTX file reading and writing
 * - Slide template processing with layouts
 * - Text box and shape variable replacement
 * - Speaker notes and comments processing
 * - Dynamic slide generation
 * 
 * @module office/processors/powerpoint-processor
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  ErrorSeverity
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';

/**
 * PowerPoint document processor implementation
 * 
 * Extends the base processor to provide PowerPoint-specific functionality for
 * reading, processing, and writing PPTX files with template capabilities.
 */
export class PowerPointProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.pptx', '.ppt'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';
  
  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} PowerPoint document type
   */
  getSupportedType() {
    return DocumentType.POWERPOINT;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...PowerPointProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Loads a PowerPoint template from file path
   * 
   * @param {string} templatePath - Path to the PowerPoint template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading PowerPoint template: ${templatePath}`);
    
    try {
      await fs.access(templatePath, fs.constants.R_OK);
      const stats = await fs.stat(templatePath);
      
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      const templateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.POWERPOINT,
        size: stats.size,
        lastModified: stats.mtime
      };
      
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`PowerPoint template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load PowerPoint template: ${templatePath}`, error);
      throw new Error(`Failed to load PowerPoint template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from PowerPoint document properties
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      
      // Check for frontmatter in custom document properties
      const frontmatterData = document.properties.custom?.[PowerPointProcessor.FRONTMATTER_PROPERTY];
      
      if (frontmatterData) {
        if (typeof frontmatterData === 'string') {
          return JSON.parse(frontmatterData);
        } else if (typeof frontmatterData === 'object') {
          return frontmatterData;
        }
      }
      
      // Try to parse from first slide notes
      if (document.slides.length > 0 && document.slides[0].notes) {
        const frontmatter = await this.parseFrontmatterFromText(document.slides[0].notes);
        if (frontmatter) {
          return frontmatter;
        }
      }
      
      this.logger.debug('No frontmatter found in PowerPoint template');
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter from PowerPoint template: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from PowerPoint document content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      const variables = this.variableExtractor.extractFromDocument(document, 'powerpoint');
      
      this.logger.info(`Extracted ${variables.length} variables from PowerPoint template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables from PowerPoint template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes the PowerPoint template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      
      // Process variables in slides
      await this.processVariablesInDocument(document, data, frontmatter);
      
      // Process dynamic slide generation
      await this.processDynamicSlides(document, data, frontmatter);
      
      // Process charts with dynamic data
      await this.processCharts(document, data, frontmatter);
      
      // Process injection points if defined
      if (frontmatter?.injectionPoints) {
        await this.processInjectionPoints(document, data, frontmatter.injectionPoints);
      }
      
      // Generate processed document content
      const content = await this.generateDocumentContent(document);
      
      // Extract metadata
      const metadata = this.extractDocumentMetadata(document);
      
      const result = {
        success: true,
        content,
        metadata,
        stats: this.getStats(),
        validation: { valid: true, errors: [], warnings: [] }
      };
      
      this.logger.info(`PowerPoint template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process PowerPoint template: ${error.message}`);
      
      return {
        success: false,
        stats: this.getStats(),
        validation: {
          valid: false,
          errors: [{
            message: error.message,
            code: 'PROCESSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Saves the processed PowerPoint document to file
   * 
   * @param {ProcessingResult} result - Processing result
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Promise resolving to saved file path
   */
  async saveDocument(result, outputPath) {
    this.logger.debug(`Saving PowerPoint document to: ${outputPath}`);
    
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      if (result.content instanceof Buffer) {
        await fs.writeFile(outputPath, result.content);
      } else {
        throw new Error('Invalid document content format for PowerPoint document');
      }
      
      this.logger.info(`PowerPoint document saved successfully: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      this.logger.error(`Failed to save PowerPoint document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates PowerPoint template structure
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<ValidationResult>} Promise resolving to validation result
   */
  async validateTemplate(template) {
    this.logger.debug(`Validating PowerPoint template: ${template.name}`);
    
    const errors = [];
    const warnings = [];
    
    try {
      await fs.access(template.path, fs.constants.R_OK);
      const document = await this.loadPowerPointDocument(template.path);
      
      // Check if document has slides
      if (!document.slides || document.slides.length === 0) {
        warnings.push({
          message: 'PowerPoint template has no slides',
          code: 'NO_SLIDES',
          severity: ErrorSeverity.WARNING
        });
      }
      
      // Validate each slide
      for (const slide of document.slides) {
        if (!slide.id) {
          errors.push({
            message: `Slide at index ${slide.index} has no ID`,
            code: 'MISSING_SLIDE_ID',
            severity: ErrorSeverity.ERROR
          });
        }
        
        // Check for empty slides
        if (!slide.content || slide.content.length === 0) {
          warnings.push({
            message: `Slide ${slide.index + 1} appears to be empty`,
            code: 'EMPTY_SLIDE',
            severity: ErrorSeverity.WARNING
          });
        }
      }
      
      this.logger.info(`PowerPoint template validation completed: ${errors.length} errors, ${warnings.length} warnings`);
      
    } catch (error) {
      errors.push({
        message: `Template validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Loads PowerPoint document from file path
   * 
   * @param {string} filePath - Path to PowerPoint document
   * @returns {Promise<Object>} Promise resolving to PowerPoint document structure
   */
  async loadPowerPointDocument(filePath) {
    try {
      // In a real implementation, you would use a library like 'officegen' or 'pptxgenjs'
      // to parse the PPTX file. This is a simplified placeholder implementation.
      
      const fileContent = await fs.readFile(filePath);
      
      // Placeholder implementation
      const document = {
        slides: [
          {
            id: 'slide1',
            index: 0,
            title: 'Sample Slide',
            content: [
              {
                id: 'title1',
                type: 'textBox',
                content: {
                  paragraphs: [
                    {
                      text: 'Welcome {{userName}}',
                      runs: [{ text: 'Welcome {{userName}}' }]
                    }
                  ],
                  properties: {}
                },
                position: { x: 100, y: 100 },
                size: { width: 400, height: 100 },
                animations: []
              }
            ],
            notes: 'Speaker notes with {{speakerNote}}',
            animations: [],
            comments: [],
            properties: {}
          }
        ],
        properties: {
          title: 'Sample PowerPoint Template',
          author: 'Template System',
          created: this.getDeterministicDate(),
          modified: this.getDeterministicDate(),
          slideCount: 1
        },
        layouts: [
          {
            id: 'layout1',
            name: 'Title Slide',
            type: 'title',
            placeholders: [
              {
                type: 'title',
                position: { x: 100, y: 100 },
                size: { width: 400, height: 100 }
              }
            ]
          }
        ],
        masters: [],
        themes: [],
        customShows: []
      };
      
      return document;
      
    } catch (error) {
      throw new Error(`Failed to load PowerPoint document: ${error.message}`);
    }
  }

  /**
   * Processes variables in PowerPoint document
   * 
   * @param {Object} document - PowerPoint document
   * @param {Object} data - Replacement data
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processVariablesInDocument(document, data, frontmatter) {
    for (const slide of document.slides) {
      // Process slide title
      if (slide.title) {
        slide.title = this.variableExtractor.replaceVariables(slide.title, data);
        this.incrementVariableCount();
      }
      
      // Process slide content elements
      for (const element of slide.content) {
        await this.processElementVariables(element, data);
      }
      
      // Process speaker notes
      if (slide.notes) {
        slide.notes = this.variableExtractor.replaceVariables(slide.notes, data);
        this.incrementVariableCount();
      }
      
      // Process comments
      for (const comment of slide.comments) {
        comment.text = this.variableExtractor.replaceVariables(comment.text, data);
        this.incrementVariableCount();
      }
    }
  }

  /**
   * Processes variables in slide element
   * 
   * @param {Object} element - Slide element
   * @param {Object} data - Replacement data
   */
  async processElementVariables(element, data) {
    switch (element.type) {
      case 'textBox':
        for (const paragraph of element.content.paragraphs) {
          paragraph.text = this.variableExtractor.replaceVariables(paragraph.text, data);
          for (const run of paragraph.runs) {
            run.text = this.variableExtractor.replaceVariables(run.text, data);
          }
        }
        this.incrementVariableCount();
        break;
        
      case 'shape':
        if (element.content.text) {
          element.content.text = this.variableExtractor.replaceVariables(element.content.text, data);
          this.incrementVariableCount();
        }
        break;
        
      case 'chart':
        if (element.content.properties.title) {
          element.content.properties.title = this.variableExtractor.replaceVariables(
            element.content.properties.title, 
            data
          );
        }
        
        // Process chart series names
        for (const series of element.content.data.series) {
          series.name = this.variableExtractor.replaceVariables(series.name, data);
        }
        this.incrementVariableCount();
        break;
        
      case 'table':
        for (const row of element.content.rows) {
          for (const cell of row.cells) {
            cell.text = this.variableExtractor.replaceVariables(cell.text, data);
          }
        }
        this.incrementVariableCount();
        break;
    }
  }

  /**
   * Processes dynamic slide generation
   * 
   * @param {Object} document - PowerPoint document
   * @param {Object} data - Data for slide generation
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processDynamicSlides(document, data, frontmatter) {
    const slideConfigs = frontmatter?.metadata?.dynamicSlides;
    if (!slideConfigs || !Array.isArray(slideConfigs)) {
      return;
    }
    
    for (const slideConfig of slideConfigs) {
      const slideData = data[slideConfig.dataSource];
      if (Array.isArray(slideData)) {
        await this.generateSlidesFromData(document, slideConfig, slideData);
      }
    }
  }

  /**
   * Generates slides from data array
   * 
   * @param {Object} document - PowerPoint document
   * @param {Object} slideConfig - Slide generation configuration
   * @param {Array} slideData - Data for slide generation
   */
  async generateSlidesFromData(document, slideConfig, slideData) {
    const templateSlideIndex = slideConfig.templateSlide || 0;
    const templateSlide = document.slides[templateSlideIndex];
    
    if (!templateSlide) {
      this.logger.warn(`Template slide at index ${templateSlideIndex} not found`);
      return;
    }
    
    // Generate new slides based on data
    for (let i = 0; i < slideData.length; i++) {
      const itemData = slideData[i];
      const newSlide = await this.cloneSlide(templateSlide, document.slides.length + i);
      
      // Replace variables in new slide with item data
      await this.processSlideWithData(newSlide, itemData);
      
      document.slides.push(newSlide);
      this.incrementInjectionCount();
    }
    
    // Remove template slide if configured
    if (slideConfig.removeTemplate) {
      document.slides.splice(templateSlideIndex, 1);
      
      // Update slide indices
      document.slides.forEach((slide, index) => {
        slide.index = index;
      });
    }
  }

  /**
   * Clones a slide
   * 
   * @param {Object} templateSlide - Slide to clone
   * @param {number} newIndex - New slide index
   * @returns {Promise<Object>} Cloned slide
   */
  async cloneSlide(templateSlide, newIndex) {
    return {
      ...templateSlide,
      id: `slide${newIndex + 1}`,
      index: newIndex,
      content: templateSlide.content.map(element => ({ ...element, id: `${element.id}_${newIndex}` })),
      animations: [...templateSlide.animations],
      comments: [...templateSlide.comments]
    };
  }

  /**
   * Processes slide with specific data
   * 
   * @param {Object} slide - Slide to process
   * @param {Object} data - Data for processing
   */
  async processSlideWithData(slide, data) {
    // Process slide title
    if (slide.title) {
      slide.title = this.variableExtractor.replaceVariables(slide.title, data);
    }
    
    // Process slide content elements
    for (const element of slide.content) {
      await this.processElementVariables(element, data);
    }
    
    // Process speaker notes
    if (slide.notes) {
      slide.notes = this.variableExtractor.replaceVariables(slide.notes, data);
    }
  }

  /**
   * Processes charts with dynamic data
   * 
   * @param {Object} document - PowerPoint document
   * @param {Object} data - Data for charts
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   */
  async processCharts(document, data, frontmatter) {
    for (const slide of document.slides) {
      const chartElements = slide.content.filter(el => el.type === 'chart');
      
      for (const chart of chartElements) {
        // Update chart data from provided data
        const chartDataSource = frontmatter?.metadata?.charts?.[chart.id];
        if (chartDataSource && data[chartDataSource]) {
          await this.updateChartData(chart, data[chartDataSource]);
        }
      }
    }
  }

  /**
   * Updates chart data
   * 
   * @param {Object} chart - Chart element
   * @param {*} newData - New chart data
   */
  async updateChartData(chart, newData) {
    if (newData.categories) {
      chart.content.data.categories = newData.categories;
    }
    
    if (newData.series) {
      chart.content.data.series = newData.series;
    }
  }

  /**
   * Processes injection points in PowerPoint document
   * 
   * @param {Object} document - PowerPoint document
   * @param {Object} data - Injection data
   * @param {InjectionPoint[]} injectionPoints - Injection point definitions
   */
  async processInjectionPoints(document, data, injectionPoints) {
    for (const injectionPoint of injectionPoints) {
      const content = data[injectionPoint.id] || injectionPoint.defaultContent || '';
      
      if (content) {
        await this.injectContentAtMarker(document, injectionPoint.marker, content, injectionPoint);
        this.incrementInjectionCount();
      }
    }
  }

  /**
   * Injects content at specified marker in document
   * 
   * @param {Object} document - PowerPoint document
   * @param {string} marker - Marker string to find
   * @param {string} content - Content to inject
   * @param {InjectionPoint} injectionPoint - Injection point configuration
   */
  async injectContentAtMarker(document, marker, content, injectionPoint) {
    for (const slide of document.slides) {
      // Check slide title
      if (slide.title && slide.title.includes(marker)) {
        slide.title = this.replaceMarker(slide.title, marker, content, injectionPoint);
      }
      
      // Check slide notes
      if (slide.notes && slide.notes.includes(marker)) {
        slide.notes = this.replaceMarker(slide.notes, marker, content, injectionPoint);
      }
      
      // Check slide content elements
      for (const element of slide.content) {
        await this.injectIntoElement(element, marker, content, injectionPoint);
      }
    }
  }

  /**
   * Injects content into slide element
   * 
   * @param {Object} element - Slide element
   * @param {string} marker - Marker string
   * @param {string} content - Content to inject
   * @param {InjectionPoint} injectionPoint - Injection point configuration
   */
  async injectIntoElement(element, marker, content, injectionPoint) {
    switch (element.type) {
      case 'textBox':
        for (const paragraph of element.content.paragraphs) {
          if (paragraph.text.includes(marker)) {
            paragraph.text = this.replaceMarker(paragraph.text, marker, content, injectionPoint);
            
            // Update runs
            paragraph.runs = [{ text: paragraph.text }];
          }
        }
        break;
        
      case 'shape':
        if (element.content.text && element.content.text.includes(marker)) {
          element.content.text = this.replaceMarker(element.content.text, marker, content, injectionPoint);
        }
        break;
    }
  }

  /**
   * Replaces marker with content based on position
   * 
   * @param {string} text - Text containing marker
   * @param {string} marker - Marker to replace
   * @param {string} content - Content to inject
   * @param {InjectionPoint} injectionPoint - Injection point configuration
   * @returns {string} Updated text
   */
  replaceMarker(text, marker, content, injectionPoint) {
    const position = injectionPoint.processing?.position || 'replace';
    
    switch (position) {
      case 'replace':
        return text.replace(marker, content);
      case 'before':
        return text.replace(marker, content + marker);
      case 'after':
        return text.replace(marker, marker + content);
      default:
        return text.replace(marker, content);
    }
  }

  /**
   * Generates document content from PowerPoint document structure
   * 
   * @param {Object} document - PowerPoint document
   * @returns {Promise<Buffer>} Promise resolving to document content buffer
   */
  async generateDocumentContent(document) {
    // In a real implementation, you would use a library like 'officegen' or 'pptxgenjs'
    // to generate the PPTX file from the document structure
    
    // Placeholder implementation
    const content = JSON.stringify(document, null, 2);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Extracts metadata from PowerPoint document
   * 
   * @param {Object} document - PowerPoint document
   * @returns {DocumentMetadata} Document metadata
   */
  extractDocumentMetadata(document) {
    const totalElements = document.slides.reduce(
      (total, slide) => total + slide.content.length, 
      0
    );
    
    return {
      title: document.properties.title,
      author: document.properties.author,
      subject: document.properties.subject,
      keywords: document.properties.keywords ? [document.properties.keywords] : undefined,
      created: document.properties.created,
      modified: document.properties.modified,
      properties: {
        slideCount: document.slides.length,
        elementCount: totalElements,
        layoutCount: document.layouts.length,
        masterCount: document.masters.length,
        themeCount: document.themes.length
      }
    };
  }

  /**
   * Parses frontmatter from text content
   * 
   * @param {string} text - Text content to parse
   * @returns {Promise<TemplateFrontmatter|null>} Parsed frontmatter or null
   */
  async parseFrontmatterFromText(text) {
    try {
      if (text.trim().startsWith('{')) {
        return JSON.parse(text);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculates hash of file for caching
   * 
   * @param {string} filePath - File path
   * @returns {Promise<string>} Promise resolving to file hash
   */
  async calculateFileHash(filePath) {
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}