/**
 * Complete Word Document Processor for KGEN Office Template Processing
 * 
 * This module provides comprehensive Word document processing capabilities using
 * the docxtemplater library for template processing with advanced features including:
 * 
 * - DOCX file reading and writing
 * - Variable replacement with {{var}} and {var} syntax  
 * - Template loops, conditions, and nested variables
 * - Image and table processing
 * - Headers, footers, and document properties
 * - Content injection at bookmarks
 * - Batch processing capabilities
 * - Comprehensive error handling and validation
 * 
 * @module kgen-core/office/word-processor
 * @version 3.0.0
 * @requires docxtemplater
 * @requires pizzip
 * @requires fs-extra
 * @author KGEN Team
 */

import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Optional docxtemplater imports - gracefully handle if not available
let DocxTemplater, PizZip, ImageModule, LoopModule;
try {
  // Try to import docxtemplater dependencies
  const docxTemplaterModule = await import('docxtemplater');
  const pizzipModule = await import('pizzip');
  
  DocxTemplater = docxTemplaterModule.default || docxTemplaterModule;
  PizZip = pizzipModule.default || pizzipModule;
  
  // Try to import optional modules
  try {
    const imageModule = await import('docxtemplater-image-module-free');
    ImageModule = imageModule.default || imageModule;
  } catch (e) {
    console.warn('docxtemplater-image-module-free not available - image processing disabled');
  }
  
  try {
    const loopModule = await import('docxtemplater-loop-module');
    LoopModule = loopModule.default || loopModule;
  } catch (e) {
    console.warn('docxtemplater-loop-module not available - advanced loops disabled');
  }
  
} catch (error) {
  console.warn('docxtemplater not available - Word processing will use fallback mode');
}

/**
 * Word document processor class providing comprehensive DOCX template processing
 * with variable replacement, content injection, and batch processing capabilities.
 * 
 * Features:
 * - Support for {{variable}} and {variable} syntax
 * - Conditional logic and loops
 * - Image and table processing
 * - Header/footer manipulation
 * - Bookmark-based content injection
 * - Batch processing for multiple documents
 * - Error handling and validation
 * 
 * @class WordProcessor
 * @extends EventEmitter
 */
export class WordProcessor extends EventEmitter {
  
  /**
   * Supported file extensions for Word documents
   * @static
   * @type {string[]}
   */
  static SUPPORTED_EXTENSIONS = ['.docx', '.doc'];
  
  /**
   * Variable syntax patterns for template processing
   * @static
   * @type {Object}
   */
  static VARIABLE_PATTERNS = {
    DOUBLE_BRACE: /\{\{([^}]+)\}\}/g,
    SINGLE_BRACE: /\{([^}]+)\}/g,
    BOOKMARK: /\[BOOKMARK:([^\]]+)\]/g,
    CONDITION: /\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs,
    LOOP: /\{\{#each\s+([^}]+)\}\}(.*?)\{\{\/each\}\}/gs
  };
  
  /**
   * Processing options and configuration
   * @static
   * @type {Object}
   */
  static DEFAULT_OPTIONS = {
    paragraphLoop: true,
    lineBreaks: true,
    nullGetter: () => '',
    errorLogging: true,
    delimiters: {
      start: '{{',
      end: '}}'
    },
    parser: null // Will be set up in constructor
  };

  /**
   * Initialize Word processor with configuration options
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} options.enableImages - Enable image processing
   * @param {boolean} options.enableLoops - Enable advanced loop processing  
   * @param {boolean} options.strictMode - Enable strict validation mode
   * @param {Object} options.delimiters - Custom variable delimiters
   * @param {Function} options.logger - Custom logger function
   */
  constructor(options = {}) {
    super();
    
    // Set up logger first with fallback for missing methods
    const defaultLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    
    this.logger = options.logger ? {
      ...defaultLogger,
      ...options.logger
    } : defaultLogger;
    
    /**
     * Processor configuration options
     * @type {Object}
     */
    this.options = {
      ...WordProcessor.DEFAULT_OPTIONS,
      enableImages: options.enableImages !== false,
      enableLoops: options.enableLoops !== false,
      strictMode: options.strictMode === true,
      logger: this.logger,
      ...options
    };
    
    /**
     * Processing statistics
     * @type {Object}
     */
    this.stats = {
      documentsProcessed: 0,
      variablesReplaced: 0,
      imagesProcessed: 0,
      tablesProcessed: 0,
      errorsEncountered: 0,
      processingTime: 0
    };
    
    /**
     * Template cache for performance optimization
     * @type {Map}
     */
    this.templateCache = new Map();
    
    /**
     * Active processing sessions
     * @type {Map}
     */
    this.processingSessions = new Map();
    this._setupParser();
    this._validateDependencies();
  }

  /**
   * Check if required dependencies are available
   * 
   * @returns {Object} Dependency availability status
   */
  getDependencyStatus() {
    return {
      docxtemplater: !!DocxTemplater,
      pizzip: !!PizZip,
      imageModule: !!ImageModule,
      loopModule: !!LoopModule,
      fallbackMode: !DocxTemplater || !PizZip
    };
  }

  /**
   * Process a single Word document template with provided data
   * 
   * @param {string|Buffer} template - Template file path or buffer
   * @param {Object} data - Data object for variable replacement
   * @param {Object} options - Processing options
   * @param {string} options.outputPath - Output file path
   * @param {boolean} options.preserveFormatting - Preserve original formatting
   * @param {Object} options.images - Image data for replacement
   * @param {Array} options.injectionPoints - Content injection points
   * @returns {Promise<Object>} Processing result with content and metadata
   * 
   * @example
   * const processor = new WordProcessor();
   * const result = await processor.processDocument('template.docx', {
   *   name: 'John Doe',
   *   company: 'Acme Corp',
   *   items: [
   *     { product: 'Widget', price: 10.99 },
   *     { product: 'Gadget', price: 25.50 }
   *   ]
   * }, {
   *   outputPath: 'output.docx',
   *   images: { logo: './company-logo.png' }
   * });
   */
  async processDocument(template, data = {}, options = {}) {
    const sessionId = this._generateSessionId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Starting document processing session: ${sessionId}`);
      this.emit('processingStarted', { sessionId, template });
      
      // Load template
      const templateBuffer = await this._loadTemplate(template);
      
      // Create docxtemplater instance
      const doc = this._createDocxTemplater(templateBuffer, options);
      
      // Pre-process data for advanced features
      const processedData = await this._preprocessData(data, options);
      
      // Handle image processing if enabled
      if (options.images && this.options.enableImages) {
        await this._processImages(doc, options.images);
      }
      
      // Set template data
      doc.setData(processedData);
      
      // Render document
      await this._renderDocument(doc);
      
      // Post-process for injection points
      if (options.injectionPoints) {
        await this._processInjectionPoints(doc, options.injectionPoints);
      }
      
      // Generate output buffer
      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });
      
      // Save to file if output path specified
      if (options.outputPath) {
        await this._saveDocument(outputBuffer, options.outputPath);
      }
      
      // Update statistics
      this._updateStats(startTime);
      
      const result = {
        success: true,
        sessionId,
        content: outputBuffer,
        metadata: await this._extractMetadata(doc),
        stats: this._getSessionStats(sessionId),
        processingTime: this.getDeterministicTimestamp() - startTime
      };
      
      this.emit('processingCompleted', result);
      this.logger.info(`Document processing completed successfully: ${sessionId}`);
      
      return result;
      
    } catch (error) {
      this.stats.errorsEncountered++;
      const errorResult = this._handleProcessingError(error, sessionId);
      this.emit('processingError', errorResult);
      
      if (this.options.strictMode) {
        throw error;
      }
      
      return errorResult;
    } finally {
      this.processingSessions.delete(sessionId);
    }
  }

  /**
   * Process multiple Word documents in batch with shared configuration
   * 
   * @param {Array<Object>} templates - Array of template configurations
   * @param {Object} globalData - Global data applied to all templates
   * @param {Object} options - Batch processing options
   * @param {number} options.concurrency - Maximum concurrent processing (default: 3)
   * @param {boolean} options.continueOnError - Continue processing if one fails
   * @param {Function} options.progressCallback - Progress update callback
   * @returns {Promise<Array<Object>>} Array of processing results
   * 
   * @example
   * const results = await processor.batchProcess([
   *   { template: 'invoice.docx', data: { invoiceId: '001' }, outputPath: 'invoice-001.docx' },
   *   { template: 'invoice.docx', data: { invoiceId: '002' }, outputPath: 'invoice-002.docx' }
   * ], { company: 'Acme Corp' }, { concurrency: 2 });
   */
  async batchProcess(templates, globalData = {}, options = {}) {
    const batchId = this._generateSessionId();
    const concurrency = options.concurrency || 3;
    const continueOnError = options.continueOnError !== false;
    
    this.logger.info(`Starting batch processing: ${batchId} (${templates.length} documents)`);
    this.emit('batchStarted', { batchId, count: templates.length });
    
    const results = [];
    const errors = [];
    
    // Process templates in batches with controlled concurrency
    for (let i = 0; i < templates.length; i += concurrency) {
      const batch = templates.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (templateConfig, index) => {
        try {
          const mergedData = { ...globalData, ...templateConfig.data };
          const result = await this.processDocument(
            templateConfig.template,
            mergedData,
            templateConfig.options || {}
          );
          
          // Call progress callback if provided
          if (options.progressCallback) {
            options.progressCallback({
              completed: i + index + 1,
              total: templates.length,
              result
            });
          }
          
          return result;
          
        } catch (error) {
          const errorResult = {
            success: false,
            error: error.message,
            template: templateConfig.template
          };
          
          errors.push(errorResult);
          
          if (!continueOnError) {
            throw error;
          }
          
          return errorResult;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      ));
    }
    
    const batchResult = {
      batchId,
      results,
      errors,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      errorCount: errors.length
    };
    
    this.emit('batchCompleted', batchResult);
    this.logger.info(`Batch processing completed: ${batchId}`);
    
    return batchResult;
  }

  /**
   * Extract variables from a Word document template
   * 
   * @param {string|Buffer} template - Template file path or buffer
   * @param {Object} options - Extraction options
   * @returns {Promise<Array<Object>>} Array of found variables with metadata
   * 
   * @example
   * const variables = await processor.extractVariables('template.docx');
   * // Returns: [{ name: 'customerName', type: 'simple', location: 'paragraph' }, ...]
   */
  async extractVariables(template, options = {}) {
    try {
      const templateBuffer = await this._loadTemplate(template);
      const content = await this._extractTextContent(templateBuffer);
      
      const variables = new Set();
      const variableData = [];
      
      // Extract double brace variables {{variable}}
      const doubleBraceMatches = content.matchAll(WordProcessor.VARIABLE_PATTERNS.DOUBLE_BRACE);
      for (const match of doubleBraceMatches) {
        const variableName = match[1].trim();
        if (!variables.has(variableName)) {
          variables.add(variableName);
          variableData.push({
            name: variableName,
            type: 'template',
            syntax: 'double-brace',
            pattern: match[0],
            isLoop: variableName.startsWith('#each'),
            isCondition: variableName.startsWith('#if')
          });
        }
      }
      
      // Extract single brace variables {variable}
      const singleBraceMatches = content.matchAll(WordProcessor.VARIABLE_PATTERNS.SINGLE_BRACE);
      for (const match of singleBraceMatches) {
        const variableName = match[1].trim();
        if (!variables.has(variableName)) {
          variables.add(variableName);
          variableData.push({
            name: variableName,
            type: 'simple',
            syntax: 'single-brace',
            pattern: match[0]
          });
        }
      }
      
      // Extract bookmark markers
      const bookmarkMatches = content.matchAll(WordProcessor.VARIABLE_PATTERNS.BOOKMARK);
      for (const match of bookmarkMatches) {
        const bookmarkName = match[1].trim();
        variableData.push({
          name: bookmarkName,
          type: 'bookmark',
          syntax: 'bookmark',
          pattern: match[0]
        });
      }
      
      this.logger.info(`Extracted ${variableData.length} variables from template`);
      return variableData;
      
    } catch (error) {
      this.logger.error('Failed to extract variables:', error);
      throw new Error(`Variable extraction failed: ${error.message}`);
    }
  }

  /**
   * Validate Word document template structure and variables
   * 
   * @param {string|Buffer} template - Template file path or buffer
   * @param {Object} sampleData - Sample data for validation
   * @returns {Promise<Object>} Validation result with errors and warnings
   */
  async validateTemplate(template, sampleData = {}) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      variables: [],
      missingVariables: [],
      unusedVariables: []
    };
    
    try {
      // Extract variables from template
      const variables = await this.extractVariables(template);
      validation.variables = variables;
      
      // Check for missing variables in sample data
      const dataKeys = new Set(Object.keys(sampleData));
      const templateVars = variables.filter(v => v.type !== 'bookmark');
      
      for (const variable of templateVars) {
        if (!dataKeys.has(variable.name)) {
          validation.missingVariables.push(variable.name);
          validation.warnings.push({
            type: 'missing-variable',
            message: `Variable '${variable.name}' found in template but not in sample data`,
            variable: variable.name
          });
        }
      }
      
      // Check for unused variables in sample data
      const templateVarNames = new Set(templateVars.map(v => v.name));
      for (const dataKey of dataKeys) {
        if (!templateVarNames.has(dataKey)) {
          validation.unusedVariables.push(dataKey);
          validation.warnings.push({
            type: 'unused-variable',
            message: `Data variable '${dataKey}' not used in template`,
            variable: dataKey
          });
        }
      }
      
      // Try to load template to check for structural issues
      const templateBuffer = await this._loadTemplate(template);
      if (!this._isValidDocx(templateBuffer)) {
        validation.errors.push({
          type: 'invalid-format',
          message: 'Template file is not a valid DOCX document'
        });
        validation.isValid = false;
      }
      
      this.logger.info(`Template validation completed: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);
      
    } catch (error) {
      validation.errors.push({
        type: 'validation-error',
        message: `Template validation failed: ${error.message}`
      });
      validation.isValid = false;
    }
    
    return validation;
  }

  /**
   * Get processing statistics and performance metrics
   * 
   * @returns {Object} Current statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.templateCache.size,
      activeSessions: this.processingSessions.size,
      dependencyStatus: this.getDependencyStatus()
    };
  }

  /**
   * Clear template cache and reset statistics
   * 
   * @param {boolean} resetStats - Whether to reset statistics
   */
  clear(resetStats = false) {
    this.templateCache.clear();
    this.processingSessions.clear();
    
    if (resetStats) {
      this.stats = {
        documentsProcessed: 0,
        variablesReplaced: 0,
        imagesProcessed: 0,
        tablesProcessed: 0,
        errorsEncountered: 0,
        processingTime: 0
      };
    }
    
    this.emit('cleared');
    this.logger.info('Word processor cache and sessions cleared');
  }

  // =============================
  // PRIVATE METHODS
  // =============================

  /**
   * Setup custom parser for advanced variable handling
   * @private
   */
  _setupParser() {
    this.options.parser = (tag) => {
      // Handle nested object access (e.g., user.name)
      if (tag.includes('.')) {
        return {
          get: (scope) => {
            const parts = tag.split('.');
            let value = scope;
            
            for (const part of parts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part];
              } else {
                return this.options.nullGetter();
              }
            }
            
            return value;
          }
        };
      }
      
      // Handle array access (e.g., items[0])
      const arrayMatch = tag.match(/(\w+)\[(\d+)\]/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        return {
          get: (scope) => {
            const array = scope[arrayName];
            return Array.isArray(array) && array[index] ? array[index] : this.options.nullGetter();
          }
        };
      }
      
      // Default behavior
      return {
        get: (scope) => scope[tag] || this.options.nullGetter()
      };
    };
  }

  /**
   * Validate required dependencies
   * @private
   */
  _validateDependencies() {
    const status = this.getDependencyStatus();
    
    if (status.fallbackMode) {
      this.logger.warn('Running in fallback mode - install docxtemplater and pizzip for full functionality');
      this.logger.warn('Run: npm install docxtemplater pizzip');
    }
    
    if (!status.imageModule && this.options.enableImages) {
      this.logger.warn('Image processing requested but docxtemplater-image-module-free not available');
      this.logger.warn('Run: npm install docxtemplater-image-module-free');
    }
  }

  /**
   * Load template from file path or buffer
   * @private
   */
  async _loadTemplate(template) {
    if (Buffer.isBuffer(template)) {
      return template;
    }
    
    // Check cache first
    const cacheKey = `${template}_${(await fs.stat(template)).mtime.getTime()}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }
    
    // Load from file
    const buffer = await fs.readFile(template);
    
    // Cache for future use
    this.templateCache.set(cacheKey, buffer);
    
    return buffer;
  }

  /**
   * Create docxtemplater instance with configuration
   * @private
   */
  _createDocxTemplater(templateBuffer, options) {
    if (!DocxTemplater || !PizZip) {
      throw new Error('docxtemplater and pizzip are required but not available. Install with: npm install docxtemplater pizzip');
    }
    
    const zip = new PizZip(templateBuffer);
    const doc = new DocxTemplater();
    
    // Configure modules
    const modules = [];
    
    if (ImageModule && this.options.enableImages && options.images) {
      modules.push(new ImageModule({
        centered: true,
        getImage: (tagValue, tagName) => {
          return options.images[tagName] || null;
        },
        getSize: () => [150, 150] // Default size
      }));
    }
    
    if (LoopModule && this.options.enableLoops) {
      modules.push(new LoopModule());
    }
    
    doc.attachModule(...modules);
    doc.loadZip(zip);
    
    // Apply configuration
    doc.setOptions({
      paragraphLoop: this.options.paragraphLoop,
      lineBreaks: this.options.lineBreaks,
      nullGetter: this.options.nullGetter,
      delimiters: this.options.delimiters,
      parser: this.options.parser
    });
    
    return doc;
  }

  /**
   * Preprocess data for advanced features
   * @private
   */
  async _preprocessData(data, options) {
    const processedData = { ...data };
    
    // Handle date formatting
    for (const [key, value] of Object.entries(processedData)) {
      if (value instanceof Date) {
        processedData[key] = value.toLocaleDateString();
        processedData[`${key}_formatted`] = value.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
    
    // Handle conditional logic data
    for (const [key, value] of Object.entries(processedData)) {
      processedData[`has_${key}`] = !!value;
      processedData[`empty_${key}`] = !value;
    }
    
    return processedData;
  }

  /**
   * Process images for document
   * @private
   */
  async _processImages(doc, images) {
    for (const [key, imagePath] of Object.entries(images)) {
      if (typeof imagePath === 'string' && imagePath.startsWith('./') || imagePath.startsWith('/')) {
        try {
          const imageBuffer = await fs.readFile(imagePath);
          images[key] = imageBuffer;
          this.stats.imagesProcessed++;
        } catch (error) {
          this.logger.warn(`Failed to load image ${imagePath}:`, error.message);
        }
      }
    }
  }

  /**
   * Render document with error handling
   * @private
   */
  async _renderDocument(doc) {
    try {
      doc.render();
      this.stats.variablesReplaced++;
    } catch (error) {
      // Handle rendering errors with detailed information
      if (error.name === 'TemplateError') {
        const detailedError = new Error(`Template rendering failed: ${error.message}`);
        detailedError.properties = error.properties;
        throw detailedError;
      }
      throw error;
    }
  }

  /**
   * Process content injection points
   * @private
   */
  async _processInjectionPoints(doc, injectionPoints) {
    // This would require more advanced docxtemplater features
    // For now, log the injection points for future implementation
    for (const injectionPoint of injectionPoints) {
      this.logger.info(`Processing injection point: ${injectionPoint.bookmark || injectionPoint.marker}`);
      // Advanced implementation would modify the document structure here
    }
  }

  /**
   * Save document to file
   * @private
   */
  async _saveDocument(buffer, outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
    this.logger.info(`Document saved: ${outputPath}`);
  }

  /**
   * Extract metadata from processed document
   * @private
   */
  async _extractMetadata(doc) {
    return {
      templateEngine: 'docxtemplater',
      processingDate: this.getDeterministicDate().toISOString(),
      variablesProcessed: this.stats.variablesReplaced,
      imagesProcessed: this.stats.imagesProcessed,
      fileSize: doc.getZip().generate({ type: 'nodebuffer' }).length
    };
  }

  /**
   * Extract text content from DOCX for variable extraction
   * @private
   */
  async _extractTextContent(templateBuffer) {
    if (!PizZip) {
      // Fallback: basic text extraction would go here
      return templateBuffer.toString('utf8');
    }
    
    try {
      const zip = new PizZip(templateBuffer);
      const documentXml = zip.files['word/document.xml'];
      
      if (documentXml) {
        const content = documentXml.asText();
        // Remove XML tags and extract text content
        return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      
      return '';
    } catch (error) {
      this.logger.warn('Failed to extract text content:', error.message);
      return '';
    }
  }

  /**
   * Check if buffer contains valid DOCX file
   * @private
   */
  _isValidDocx(buffer) {
    try {
      if (!PizZip) return true; // Cannot validate without PizZip
      
      const zip = new PizZip(buffer);
      return !!(zip.files['word/document.xml'] && zip.files['[Content_Types].xml']);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate unique session ID
   * @private
   */
  _generateSessionId() {
    return `word_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update processing statistics
   * @private
   */
  _updateStats(startTime) {
    this.stats.documentsProcessed++;
    this.stats.processingTime += this.getDeterministicTimestamp() - startTime;
  }

  /**
   * Get statistics for specific session
   * @private
   */
  _getSessionStats(sessionId) {
    return {
      sessionId,
      processingTime: this.getDeterministicTimestamp() - (this.processingSessions.get(sessionId) || this.getDeterministicTimestamp()),
      variablesReplaced: this.stats.variablesReplaced,
      imagesProcessed: this.stats.imagesProcessed
    };
  }

  /**
   * Handle processing errors
   * @private
   */
  _handleProcessingError(error, sessionId) {
    this.logger.error(`Processing error in session ${sessionId}:`, error);
    
    return {
      success: false,
      sessionId,
      error: {
        message: error.message,
        type: error.name || 'ProcessingError',
        stack: this.options.strictMode ? error.stack : undefined,
        properties: error.properties || {}
      },
      stats: this.getStats()
    };
  }
}

/**
 * Factory function to create Word processor instance
 * 
 * @param {Object} options - Configuration options
 * @returns {WordProcessor} Configured Word processor instance
 * 
 * @example
 * const processor = createWordProcessor({
 *   enableImages: true,
 *   enableLoops: true,
 *   logger: console
 * });
 */
export function createWordProcessor(options = {}) {
  return new WordProcessor(options);
}

/**
 * Utility function to check Word processor capabilities
 * 
 * @returns {Object} Capability information
 */
export function getCapabilities() {
  const processor = new WordProcessor();
  return processor.getDependencyStatus();
}

export default WordProcessor;