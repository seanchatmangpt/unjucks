/**
 * LaTeX-based Office template processor for KGEN
 * 
 * This is the primary entry point for LaTeX document template processing,
 * replacing traditional Office document processing with LaTeX-based generation.
 * It provides a unified interface for processing documents, tables, and presentations
 * with comprehensive features including variable replacement, PDF compilation,
 * content injection, validation, and batch processing.
 * 
 * @module office/latex-office-processor
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import {
  DocumentType,
  VariableSyntax,
  ProcessingMode,
  ErrorSeverity
} from './core/types.js';
import { LaTeXWordProcessor } from './processors/word-processor.js';
import { LaTeXTableProcessor } from './processors/latex-table-processor.js';
import { LaTeXBeamerProcessor } from './processors/latex-beamer-processor.js';
import { FileFormatDetector } from './utils/file-format-detector.js';
import { Logger } from './utils/logger.js';
import { LaTeXCompiler } from '../latex/compiler.js';
import { KGENLaTeXIntegration } from '../latex/index.js';

// Extend DocumentType enum for LaTeX types
DocumentType.LATEX = 'latex';
DocumentType.LATEX_TABLE = 'latex-table';
DocumentType.LATEX_PRESENTATION = 'latex-presentation';

/**
 * LaTeX-based Office template processor
 * 
 * Provides a unified interface for processing all supported document types
 * with comprehensive LaTeX template capabilities, validation, and PDF compilation.
 */
export class LaTeXOfficeProcessor extends EventEmitter {
  /**
   * Creates a new LaTeX Office template processor
   * 
   * @param {ProcessingOptions} [options={}] - Processing configuration options
   */
  constructor(options = {}) {
    super();
    
    /** @type {ProcessingOptions} */
    this.options = {
      syntax: VariableSyntax.NUNJUCKS,
      mode: ProcessingMode.REPLACE,
      debug: false,
      dryRun: false,
      force: false,
      compileToPdf: true,
      strictMode: true,
      templatesDir: options.templatesDir || './templates/latex',
      outputDir: options.outputDir || './dist/latex',
      validation: {
        enabled: true,
        failFast: false,
        level: 'moderate'
      },
      output: {
        preserveFormatting: true,
        extension: '.tex',
        directory: null,
        naming: null
      },
      ...options
    };
    
    /** @type {Logger} */
    this.logger = Logger.createOfficeLogger('LaTeXOfficeProcessor', this.options.debug);
    
    /** @type {FileFormatDetector} */
    this.formatDetector = new FileFormatDetector();
    
    /** @type {Map<string, BaseOfficeProcessor>} */
    this.processors = new Map();
    
    /** @type {ProcessingContext|undefined} */
    this.currentContext = undefined;
    
    /** @type {KGENLaTeXIntegration} */
    this.latexIntegration = new KGENLaTeXIntegration({
      templatesDir: this.options.templatesDir,
      outputDir: this.options.outputDir,
      autoCompile: this.options.compileToPdf,
      securityMode: this.options.strictMode ? 'strict' : 'moderate'
    });
    
    // Initialize document processors
    this.initializeProcessors();
  }

  /**
   * Initializes LaTeX-based document processors for all supported formats
   * @private
   */
  initializeProcessors() {
    // Initialize LaTeX Word processor (document generation)
    const wordProcessor = new LaTeXWordProcessor(this.options);
    this.processors.set(DocumentType.WORD, wordProcessor);
    this.processors.set(DocumentType.LATEX, wordProcessor);
    
    // Initialize LaTeX Table processor (Excel replacement)
    const tableProcessor = new LaTeXTableProcessor(this.options);
    this.processors.set(DocumentType.EXCEL, tableProcessor);
    this.processors.set(DocumentType.LATEX_TABLE, tableProcessor);
    
    // Initialize LaTeX Beamer processor (PowerPoint replacement)
    const presentationProcessor = new LaTeXBeamerProcessor(this.options);
    this.processors.set(DocumentType.POWERPOINT, presentationProcessor);
    this.processors.set(DocumentType.LATEX_PRESENTATION, presentationProcessor);
    
    this.logger.info(`Initialized ${this.processors.size} LaTeX-based document processors`);
  }

  /**
   * Initialize the LaTeX integration system
   */
  async initialize() {
    await this.latexIntegration.initialize();
    
    // Initialize all processors
    for (const processor of this.processors.values()) {
      if (processor.initialize && !processor.initialized) {
        await processor.initialize();
      }
    }
    
    this.logger.info('LaTeX Office processor initialized');
  }

  /**
   * Processes a single LaTeX template with provided data
   * 
   * @param {string} templatePath - Path to the template file
   * @param {Object} data - Data for variable replacement
   * @param {string} [outputPath] - Optional output file path
   * @param {Object} [options] - Processing options
   * @returns {Promise<ProcessingResult>} Processing result
   */
  async process(templatePath, data, outputPath, options = {}) {
    this.logger.info(`Processing LaTeX template: ${templatePath}`);
    
    try {
      // Initialize if not done
      if (!this.latexIntegration.initialized) {
        await this.initialize();
      }
      
      // Detect document format (prioritize LaTeX)
      let format = await this.detectLatexFormat(templatePath);
      if (!format) {
        format = await this.formatDetector.detectFormat(templatePath);
      }
      this.logger.debug(`Detected document format: ${format}`);
      
      // Get appropriate processor
      const processor = this.getProcessorForType(format);
      if (!processor) {
        throw new Error(`Unsupported document format: ${format}`);
      }
      
      // Initialize processor if needed
      if (processor.initialize && !processor.initialized) {
        await processor.initialize();
      }
      
      // Load template
      const template = await processor.loadTemplate(templatePath);
      
      // Parse frontmatter
      const frontmatter = await processor.parseFrontmatter(template);
      
      // Process template
      const result = await processor.processTemplate(template, data, frontmatter);
      
      // Save document if output path provided
      if (outputPath && result.success) {
        const saveOptions = { 
          compileToPdf: options.compileToPdf !== false,
          ...options 
        };
        const saveResult = await processor.saveDocument(result, outputPath, saveOptions);
        result.outputPaths = saveResult;
      }
      
      // Emit processing events
      this.emit('templateProcessed', {
        templatePath,
        format,
        success: result.success,
        outputPath: result.outputPaths?.texPath || outputPath,
        pdfPath: result.outputPaths?.pdfPath
      });
      
      if (result.success) {
        this.logger.info(`LaTeX template processed successfully: ${templatePath}`);
      } else {
        this.logger.error(`LaTeX template processing failed: ${templatePath}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`LaTeX template processing error: ${error.message}`);
      this.emit('processingError', { templatePath, error });
      
      return {
        success: false,
        validation: {
          valid: false,
          errors: [{
            message: error.message,
            code: 'PROCESSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        },
        stats: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          variablesProcessed: 0,
          injectionsPerformed: 0,
          errors: 1,
          warnings: 0
        }
      };
    }
  }

  /**
   * Generate document using high-level specification
   * 
   * @param {Object} specification - Document specification
   * @param {Object} options - Generation options
   * @returns {Promise<ProcessingResult>} Generation result
   */
  async generateDocument(specification, options = {}) {
    this.logger.info(`Generating document from specification: ${specification.type || 'document'}`);
    
    try {
      if (!this.latexIntegration.initialized) {
        await this.initialize();
      }
      
      const result = await this.latexIntegration.generateDocument(specification, options);
      
      this.emit('documentGenerated', {
        type: specification.type,
        success: result.success,
        outputPath: result.document?.path
      });
      
      return result;
      
    } catch (error) {
      this.logger.error(`Document generation error: ${error.message}`);
      this.emit('generationError', { specification, error });
      throw error;
    }
  }

  /**
   * Generate standalone table document
   * 
   * @param {Array} tableData - Table data array
   * @param {Object} options - Table options
   * @returns {Promise<ProcessingResult>} Generation result
   */
  async generateTable(tableData, options = {}) {
    const tableProcessor = this.processors.get(DocumentType.LATEX_TABLE);
    if (!tableProcessor) {
      throw new Error('LaTeX table processor not available');
    }
    
    if (!tableProcessor.initialized) {
      await tableProcessor.initialize();
    }
    
    return await tableProcessor.generateStandaloneTable(tableData, options);
  }

  /**
   * Generate standalone presentation
   * 
   * @param {Array} slidesData - Slides data array
   * @param {Object} options - Presentation options
   * @returns {Promise<ProcessingResult>} Generation result
   */
  async generatePresentation(slidesData, options = {}) {
    const presentationProcessor = this.processors.get(DocumentType.LATEX_PRESENTATION);
    if (!presentationProcessor) {
      throw new Error('LaTeX presentation processor not available');
    }
    
    if (!presentationProcessor.initialized) {
      await presentationProcessor.initialize();
    }
    
    return await presentationProcessor.generateStandalonePresentation(slidesData, options);
  }

  /**
   * Processes multiple templates in batch
   * 
   * @param {BatchProcessingConfig} config - Batch processing configuration
   * @returns {Promise<BatchProcessingResult>} Batch processing results
   */
  async batchProcess(config) {
    const {
      templates = [],
      data = [],
      outputDir,
      options = {},
      parallel = false,
      maxConcurrency = 3,
      onProgress
    } = config;
    
    this.logger.info(`Starting batch processing of ${templates.length} LaTeX templates`);
    
    const results = {
      total: templates.length,
      completed: 0,
      failed: 0,
      results: [],
      errors: []
    };
    
    // Create processing tasks
    const tasks = templates.map((template, index) => ({
      templatePath: typeof template === 'string' ? template : template.templatePath,
      data: Array.isArray(data) ? data[index] || {} : data,
      outputPath: typeof template === 'object' ? template.outputPath : 
                  outputDir ? `${outputDir}/${this.generateOutputFilename(template, index)}` : undefined
    }));
    
    if (parallel) {
      // Process templates in parallel with concurrency limit
      for (let i = 0; i < tasks.length; i += maxConcurrency) {
        const batch = tasks.slice(i, i + maxConcurrency);
        const batchPromises = batch.map(async (task, batchIndex) => {
          const globalIndex = i + batchIndex;
          return this.processTemplateWithProgress(task, globalIndex, results, onProgress);
        });
        
        await Promise.allSettled(batchPromises);
      }
    } else {
      // Process templates sequentially
      for (let i = 0; i < tasks.length; i++) {
        await this.processTemplateWithProgress(tasks[i], i, results, onProgress);
      }
    }
    
    this.logger.info(`Batch processing completed: ${results.completed} successful, ${results.failed} failed`);
    
    return results;
  }

  /**
   * Processes a single template with progress tracking
   * 
   * @param {Object} task - Processing task
   * @param {number} index - Task index
   * @param {Object} results - Results accumulator
   * @param {Function} [onProgress] - Progress callback
   * @private
   */
  async processTemplateWithProgress(task, index, results, onProgress) {
    try {
      const result = await this.process(task.templatePath, task.data, task.outputPath);
      
      if (result.success) {
        results.completed++;
      } else {
        results.failed++;
        results.errors.push({
          templatePath: task.templatePath,
          errors: result.validation?.errors || []
        });
      }
      
      results.results.push({
        templatePath: task.templatePath,
        outputPath: task.outputPath,
        ...result
      });
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          total: results.total,
          completed: results.completed + results.failed,
          failed: results.failed,
          current: task.templatePath,
          percentage: Math.round(((results.completed + results.failed) / results.total) * 100)
        });
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        templatePath: task.templatePath,
        errors: [{ message: error.message, code: 'PROCESSING_ERROR' }]
      });
      
      this.logger.error(`Batch processing error for ${task.templatePath}: ${error.message}`);
    }
  }

  /**
   * Extracts variables from a template
   * 
   * @param {string} templatePath - Path to template file
   * @returns {Promise<TemplateVariable[]>} Extracted template variables
   */
  async extractVariables(templatePath) {
    let format = await this.detectLatexFormat(templatePath);
    if (!format) {
      format = await this.formatDetector.detectFormat(templatePath);
    }
    
    const processor = this.getProcessorForType(format);
    
    if (!processor) {
      throw new Error(`Unsupported document format: ${format}`);
    }
    
    if (!processor.initialized) {
      await processor.initialize();
    }
    
    const template = await processor.loadTemplate(templatePath);
    const frontmatter = await processor.parseFrontmatter(template);
    const variables = await processor.extractVariables(template, frontmatter);
    
    return variables;
  }

  /**
   * Validates template data against template requirements
   * 
   * @param {Object} data - Data to validate
   * @param {string} templatePath - Path to template file
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validateData(data, templatePath) {
    let format = await this.detectLatexFormat(templatePath);
    if (!format) {
      format = await this.formatDetector.detectFormat(templatePath);
    }
    
    const processor = this.getProcessorForType(format);
    
    if (!processor) {
      throw new Error(`Unsupported document format: ${format}`);
    }
    
    if (!processor.initialized) {
      await processor.initialize();
    }
    
    const template = await processor.loadTemplate(templatePath);
    const frontmatter = await processor.parseFrontmatter(template);
    
    return processor.validateData ? processor.validateData(data, frontmatter) : { valid: true, errors: [], warnings: [] };
  }

  /**
   * Validates a template document structure
   * 
   * @param {string} templatePath - Path to template file
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validateTemplate(templatePath) {
    let format = await this.detectLatexFormat(templatePath);
    if (!format) {
      format = await this.formatDetector.detectFormat(templatePath);
    }
    
    const processor = this.getProcessorForType(format);
    
    if (!processor) {
      throw new Error(`Unsupported document format: ${format}`);
    }
    
    if (!processor.initialized) {
      await processor.initialize();
    }
    
    const template = await processor.loadTemplate(templatePath);
    return processor.validateTemplate(template);
  }

  /**
   * Detect LaTeX format based on content and context
   * 
   * @param {string} templatePath - Path to template file
   * @returns {Promise<string|null>} Detected format or null
   */
  async detectLatexFormat(templatePath) {
    try {
      const extension = path.extname(templatePath).toLowerCase();
      
      // Direct LaTeX file extensions
      if (['.tex', '.latex', '.ltx'].includes(extension)) {
        // Read content to determine specific type
        const content = await fs.readFile(templatePath, 'utf8');
        
        // Check for Beamer presentation
        if (content.includes('\\documentclass{beamer}') || 
            content.includes('\\begin{frame}') ||
            content.includes('\\usetheme{')) {
          return DocumentType.LATEX_PRESENTATION;
        }
        
        // Check for table-only documents (should have TABLE-CONFIG in frontmatter or be primarily tables)
        if (content.includes('TABLE-CONFIG:') || 
            (content.includes('\\begin{longtable}') && !content.includes('\\maketitle') && !content.includes('\\section'))) {
          return DocumentType.LATEX_TABLE;
        }
        
        // Default to document
        return DocumentType.LATEX;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets the processor for a specific document type
   * 
   * @param {string} documentType - Document type
   * @returns {BaseOfficeProcessor|null} Document processor or null
   */
  getProcessorForType(documentType) {
    return this.processors.get(documentType) || null;
  }

  /**
   * Gets all supported document types
   * 
   * @returns {string[]} Array of supported document types
   */
  getSupportedTypes() {
    return Array.from(this.processors.keys());
  }

  /**
   * Registers a custom document processor
   * 
   * @param {string} documentType - Document type
   * @param {BaseOfficeProcessor} processor - Processor instance
   */
  registerProcessor(documentType, processor) {
    this.processors.set(documentType, processor);
    this.logger.info(`Registered custom processor for type: ${documentType}`);
  }

  /**
   * Updates processing options
   * 
   * @param {ProcessingOptions} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Update all processor options
    for (const processor of this.processors.values()) {
      if (processor.options) {
        processor.options = { ...processor.options, ...newOptions };
      }
    }
    
    this.logger.debug('Processing options updated');
  }

  /**
   * Gets processing statistics across all processors
   * 
   * @returns {Object} Aggregated statistics
   */
  getStatistics() {
    const stats = {
      totalProcessors: this.processors.size,
      supportedTypes: this.getSupportedTypes(),
      processorStats: {},
      latexIntegrationStats: this.latexIntegration.getStatistics()
    };
    
    for (const [type, processor] of this.processors) {
      stats.processorStats[type] = processor.getStats ? processor.getStats() : {};
    }
    
    return stats;
  }

  /**
   * Generates an output filename for batch processing
   * 
   * @param {string|Object} template - Template path or object
   * @param {number} index - Template index
   * @returns {string} Generated filename
   * @private
   */
  generateOutputFilename(template, index) {
    const templatePath = typeof template === 'string' ? template : template.templatePath;
    const baseName = templatePath.split('/').pop().split('.')[0];
    const extension = '.tex'; // Always use .tex for LaTeX output
    
    // Use naming pattern if specified in options
    if (this.options.output?.naming) {
      return this.options.output.naming
        .replace('{name}', baseName)
        .replace('{index}', index)
        .replace('{timestamp}', Date.now())
        .replace('{ext}', extension);
    }
    
    // Default naming: originalname_processed.tex
    return `${baseName}_processed${extension}`;
  }

  /**
   * Discovers LaTeX templates in a directory
   * 
   * @param {string} directory - Directory to search
   * @param {Object} [options] - Discovery options
   * @returns {Promise<TemplateDiscoveryResult>} Discovery results
   */
  async discoverTemplates(directory, options = {}) {
    const {
      recursive = true,
      extensions = ['.tex', '.latex', '.ltx'],
      excludePatterns = []
    } = options;
    
    const templates = [];
    const errors = [];
    let filesScanned = 0;
    let directoriesSearched = 0;
    
    const scanDirectory = async (dirPath) => {
      try {
        directoriesSearched++;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          filesScanned++;
          
          if (entry.isDirectory() && recursive) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const extension = path.extname(entry.name).toLowerCase();
            
            if (extensions.includes(extension)) {
              // Check exclude patterns
              const shouldExclude = excludePatterns.some(pattern => {
                const regex = new RegExp(pattern);
                return regex.test(fullPath) || regex.test(entry.name);
              });
              
              if (!shouldExclude) {
                try {
                  const format = await this.detectLatexFormat(fullPath);
                  if (format) {
                    const processor = this.getProcessorForType(format);
                    if (processor) {
                      if (!processor.initialized) {
                        await processor.initialize();
                      }
                      const template = await processor.loadTemplate(fullPath);
                      templates.push(template);
                    }
                  }
                } catch (error) {
                  errors.push({
                    path: fullPath,
                    error: error.message
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        errors.push({
          path: dirPath,
          error: error.message
        });
      }
    };
    
    const startTime = Date.now();
    await scanDirectory(directory);
    const duration = Date.now() - startTime;
    
    // Calculate type distribution
    const typeDistribution = templates.reduce((acc, template) => {
      acc[template.type] = (acc[template.type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      templates,
      stats: {
        filesScanned,
        templatesFound: templates.length,
        directoriesSearched,
        duration,
        typeDistribution
      },
      errors
    };
  }

  /**
   * Cleanup method - closes all processors and releases resources
   */
  async cleanup() {
    this.logger.info('Cleaning up LaTeX Office processor');
    
    // Cleanup LaTeX integration
    if (this.latexIntegration) {
      await this.latexIntegration.cleanup();
    }
    
    // Cleanup all processors
    for (const [type, processor] of this.processors) {
      try {
        if (processor.cleanup) {
          await processor.cleanup();
        }
        this.logger.debug(`Cleaned up ${type} processor`);
      } catch (error) {
        this.logger.warn(`Error cleaning up ${type} processor: ${error.message}`);
      }
    }
    
    // Clear processors map
    this.processors.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.logger.info('LaTeX Office processor cleanup completed');
  }
}

// Export both old and new names for compatibility
export const OfficeTemplateProcessor = LaTeXOfficeProcessor;
export default LaTeXOfficeProcessor;