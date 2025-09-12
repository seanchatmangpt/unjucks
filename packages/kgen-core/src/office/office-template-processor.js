/**
 * Main Office template processor for KGEN
 * 
 * This is the primary entry point for Office document template processing.
 * It provides a unified interface for processing Word, Excel, and PowerPoint
 * templates with comprehensive features including variable replacement,
 * content injection, validation, and batch processing.
 * 
 * @module office/office-template-processor
 * @version 1.0.0
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
import { LaTeXWordProcessor as WordProcessor } from './processors/word-processor.js';
import { LaTeXTableProcessor as ExcelProcessor } from './processors/latex-table-processor.js';
import { LaTeXBeamerProcessor as PowerPointProcessor } from './processors/latex-beamer-processor.js';
import { FileFormatDetector } from './utils/file-format-detector.js';
import { Logger } from './utils/logger.js';

/**
 * Main Office template processor
 * 
 * Provides a unified interface for processing all supported Office document types
 * with comprehensive template capabilities, validation, and enterprise features.
 */
export class OfficeTemplateProcessor extends EventEmitter {
  /**
   * Creates a new Office template processor
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
      validation: {
        enabled: true,
        failFast: false,
        level: 'moderate'
      },
      output: {
        preserveFormatting: true,
        extension: null,
        directory: null,
        naming: null
      },
      ...options
    };
    
    /** @type {Logger} */
    this.logger = Logger.createOfficeLogger('OfficeTemplateProcessor', this.options.debug);
    
    /** @type {FileFormatDetector} */
    this.formatDetector = new FileFormatDetector();
    
    /** @type {Map<string, BaseOfficeProcessor>} */
    this.processors = new Map();
    
    /** @type {ProcessingContext|undefined} */
    this.currentContext = undefined;
    
    // Initialize document processors
    this.initializeProcessors();
  }

  /**
   * Initializes document processors for all supported formats
   * @private
   */
  initializeProcessors() {
    // Initialize Word processor
    const wordProcessor = new WordProcessor(this.options);
    this.processors.set(DocumentType.WORD, wordProcessor);
    
    // Initialize Excel processor
    const excelProcessor = new ExcelProcessor(this.options);
    this.processors.set(DocumentType.EXCEL, excelProcessor);
    
    // Initialize PowerPoint processor
    const powerPointProcessor = new PowerPointProcessor(this.options);
    this.processors.set(DocumentType.POWERPOINT, powerPointProcessor);
    
    this.logger.info(`Initialized ${this.processors.size} document processors`);
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
   * Gets current processing options
   * 
   * @returns {ProcessingOptions} Current processing options
   */
  getOptions() {
    return { ...this.options };
  }
}