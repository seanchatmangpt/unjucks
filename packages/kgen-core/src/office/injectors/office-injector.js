/**
 * Office file content injection system for KGEN
 * 
 * Provides comprehensive content injection capabilities for Word, Excel, and PowerPoint files
 * with support for various injection modes, validation, and batch processing.
 * 
 * @module office/injectors/office-injector
 * @version 1.0.0
 */

import { WordInjector } from './word-injector.js';
import { ExcelInjector } from './excel-injector.js';
import { PowerPointInjector } from './powerpoint-injector.js';
import { InjectionValidator } from '../utils/injection-validator.js';
import { FileFormatDetector } from '../utils/file-format-detector.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Office file content injection system
 * Supports Word, Excel, and PowerPoint file content injection with various modes
 */
export class OfficeInjector {
  /**
   * Creates an instance of OfficeInjector
   * 
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.preserveFormatting=true] - Whether to preserve original formatting
   * @param {boolean} [options.validateInputs=true] - Whether to validate inputs before injection
   * @param {boolean} [options.dryRun=false] - Whether to run in dry-run mode (no actual changes)
   * @param {boolean} [options.force=false] - Whether to force overwrite existing content
   */
  constructor(options = {}) {
    this.options = {
      preserveFormatting: true,
      validateInputs: true,
      dryRun: false,
      force: false,
      ...options
    };

    this.wordInjector = new WordInjector(this.options);
    this.excelInjector = new ExcelInjector(this.options);
    this.powerPointInjector = new PowerPointInjector(this.options);
    this.validator = new InjectionValidator();
    this.formatDetector = new FileFormatDetector();
    
    this.logger = Logger.createOfficeLogger('OfficeInjector', this.options.debug);
  }

  /**
   * Injects content into a single Office file
   * 
   * @param {Object} injectionConfig - Injection configuration
   * @param {string} injectionConfig.filePath - Path to the Office file
   * @param {InjectionSpec[]} injectionConfig.injections - Array of injection specifications
   * @param {string} [injectionConfig.outputPath] - Optional output path (defaults to input path)
   * @returns {Promise<InjectionResult>} Injection result
   */
  async injectFile(injectionConfig) {
    const { filePath, injections, outputPath } = injectionConfig;
    
    try {
      // Validate input
      if (this.options.validateInputs) {
        await this.validator.validateInjectionConfig(injectionConfig);
      }

      // Check if file exists
      if (!(await this.fileExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Detect file format
      const fileFormat = await this.formatDetector.detectFormat(filePath);
      this.logger.info(`Detected file format: ${fileFormat} for ${path.basename(filePath)}`);

      // Get appropriate injector
      const injector = this.getInjectorForFormat(fileFormat);
      if (!injector) {
        throw new Error(`Unsupported file format: ${fileFormat}`);
      }

      // Perform injection
      const result = await injector.inject({
        filePath,
        injections,
        outputPath: outputPath || filePath,
        dryRun: this.options.dryRun
      });

      this.logger.info(`Successfully injected content into ${path.basename(filePath)}`);
      return {
        success: true,
        filePath,
        outputPath: outputPath || filePath,
        fileFormat,
        injections: result.injections || [],
        skipped: result.skipped || [],
        errors: result.errors || []
      };

    } catch (error) {
      this.logger.error(`Failed to inject content into ${path.basename(filePath)}: ${error.message}`);
      return {
        success: false,
        filePath,
        error: error.message,
        injections: [],
        skipped: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Performs batch injection on multiple Office files
   * 
   * @param {InjectionConfig[]} batchConfig - Array of injection configurations
   * @param {Object} [options={}] - Batch processing options
   * @param {number} [options.concurrency=3] - Number of files to process concurrently
   * @param {boolean} [options.continueOnError=true] - Whether to continue processing on individual file errors
   * @returns {Promise<BatchInjectionResult>} Batch processing results
   */
  async batchInject(batchConfig, options = {}) {
    const {
      concurrency = 3,
      continueOnError = true
    } = options;

    const results = {
      success: [],
      failed: [],
      skipped: [],
      totalFiles: batchConfig.length,
      totalInjections: 0,
      totalErrors: 0
    };

    this.logger.info(`Starting batch injection of ${batchConfig.length} files with concurrency ${concurrency}`);

    // Process files in batches with concurrency limit
    for (let i = 0; i < batchConfig.length; i += concurrency) {
      const batch = batchConfig.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (config) => {
        try {
          const result = await this.injectFile(config);
          
          if (result.success) {
            results.success.push(result);
            results.totalInjections += result.injections.length;
          } else {
            results.failed.push(result);
            results.totalErrors += result.errors.length;
            
            if (!continueOnError) {
              throw new Error(`Batch processing stopped due to error in ${result.filePath}`);
            }
          }
          
          return result;
        } catch (error) {
          const errorResult = {
            success: false,
            filePath: config.filePath,
            error: error.message
          };
          results.failed.push(errorResult);
          results.totalErrors++;
          
          if (!continueOnError) {
            throw error;
          }
          return errorResult;
        }
      });

      await Promise.all(batchPromises);
    }

    this.logger.info(`Batch injection completed: ${results.success.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Validates injection configurations before processing
   * 
   * @param {InjectionConfig|InjectionConfig[]} config - Single config or array of configs
   * @returns {Promise<ValidationSummary>} Validation results
   */
  async validateConfigurations(config) {
    const configs = Array.isArray(config) ? config : [config];
    const results = {
      valid: [],
      invalid: [],
      warnings: []
    };

    for (const injectionConfig of configs) {
      try {
        await this.validator.validateInjectionConfig(injectionConfig);
        results.valid.push(injectionConfig.filePath);
      } catch (error) {
        results.invalid.push({
          filePath: injectionConfig.filePath,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Gets the appropriate injector for a file format
   * 
   * @param {string} format - File format (word, excel, powerpoint)
   * @returns {Object|null} Injector instance or null
   * @private
   */
  getInjectorForFormat(format) {
    switch (format.toLowerCase()) {
      case 'word':
      case 'docx':
      case 'doc':
        return this.wordInjector;
      case 'excel':
      case 'xlsx':
      case 'xls':
        return this.excelInjector;
      case 'powerpoint':
      case 'pptx':
      case 'ppt':
        return this.powerPointInjector;
      default:
        return null;
    }
  }

  /**
   * Creates an injection specification object
   * 
   * @param {Object} spec - Injection specification
   * @param {string} spec.target - Target location (bookmark, cell, slide, etc.)
   * @param {string} spec.content - Content to inject
   * @param {string} [spec.mode='replace'] - Injection mode (replace, before, after, append, prepend)
   * @param {string} [spec.type='text'] - Content type (text, html, markdown)
   * @param {Object} [spec.formatting={}] - Formatting options
   * @param {string|Function} [spec.skipIf] - Condition to skip injection
   * @returns {InjectionSpec} Standardized injection specification
   * @static
   */
  static createInjectionSpec(spec) {
    return {
      target: spec.target,
      content: spec.content,
      mode: spec.mode || 'replace',
      type: spec.type || 'text',
      formatting: spec.formatting || {},
      skipIf: spec.skipIf,
      preserveFormatting: spec.preserveFormatting !== false,
      idempotent: spec.idempotent !== false,
      timestamp: new Date().toISOString(),
      id: spec.id || `injection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * Supported injection modes
   * 
   * @static
   * @returns {Object} Available injection modes
   */
  static get INJECTION_MODES() {
    return {
      REPLACE: 'replace',     // Replace target content
      BEFORE: 'before',       // Insert before target
      AFTER: 'after',         // Insert after target
      APPEND: 'append',       // Append to target content
      PREPEND: 'prepend',     // Prepend to target content
      INSERT_AT: 'insertAt'   // Insert at specific position
    };
  }

  /**
   * Supported content types
   * 
   * @static
   * @returns {Object} Available content types
   */
  static get CONTENT_TYPES() {
    return {
      TEXT: 'text',           // Plain text
      HTML: 'html',           // HTML content
      MARKDOWN: 'markdown',   // Markdown content
      JSON: 'json',           // JSON data
      XML: 'xml',             // XML content
      RICH_TEXT: 'richText'   // Rich text with formatting
    };
  }

  /**
   * Gets injection statistics
   * 
   * @returns {InjectionStats} Usage statistics
   */
  getStatistics() {
    return {
      wordInjections: this.wordInjector.getStatistics(),
      excelInjections: this.excelInjector.getStatistics(),
      powerPointInjections: this.powerPointInjector.getStatistics(),
      totalProcessedFiles: this.getTotalProcessedFiles(),
      successRate: this.getSuccessRate()
    };
  }

  /**
   * Gets total processed files across all injectors
   * 
   * @returns {number} Total processed files
   * @private
   */
  getTotalProcessedFiles() {
    return (
      (this.wordInjector.processedFiles || 0) +
      (this.excelInjector.processedFiles || 0) +
      (this.powerPointInjector.processedFiles || 0)
    );
  }

  /**
   * Calculates success rate across all injections
   * 
   * @returns {number} Success rate as percentage
   * @private
   */
  getSuccessRate() {
    const wordStats = this.wordInjector.getStatistics?.() || { successful: 0, attempted: 0 };
    const excelStats = this.excelInjector.getStatistics?.() || { successful: 0, attempted: 0 };
    const pptStats = this.powerPointInjector.getStatistics?.() || { successful: 0, attempted: 0 };
    
    const totalSuccessful = wordStats.successful + excelStats.successful + pptStats.successful;
    const totalAttempted = wordStats.attempted + excelStats.attempted + pptStats.attempted;
    
    return totalAttempted > 0 ? Math.round((totalSuccessful / totalAttempted) * 100) : 0;
  }

  /**
   * Resets all statistics
   */
  resetStatistics() {
    this.wordInjector.resetStatistics?.();
    this.excelInjector.resetStatistics?.();
    this.powerPointInjector.resetStatistics?.();
  }

  /**
   * Checks if a file exists
   * 
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} Whether file exists
   * @private
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * @typedef {Object} InjectionConfig
 * @property {string} filePath - Path to the Office file
 * @property {InjectionSpec[]} injections - Array of injection specifications
 * @property {string} [outputPath] - Optional output path
 */

/**
 * @typedef {Object} InjectionSpec
 * @property {string} id - Unique injection identifier
 * @property {string} target - Target location in document
 * @property {string} content - Content to inject
 * @property {string} mode - Injection mode
 * @property {string} type - Content type
 * @property {Object} formatting - Formatting options
 * @property {boolean} preserveFormatting - Whether to preserve formatting
 * @property {boolean} idempotent - Whether injection is idempotent
 * @property {string} timestamp - Creation timestamp
 */

/**
 * @typedef {Object} InjectionResult
 * @property {boolean} success - Whether injection was successful
 * @property {string} filePath - Source file path
 * @property {string} outputPath - Output file path
 * @property {string} fileFormat - Detected file format
 * @property {InjectionSpec[]} injections - Successfully applied injections
 * @property {InjectionSpec[]} skipped - Skipped injections
 * @property {string[]} errors - Error messages
 */

/**
 * @typedef {Object} BatchInjectionResult
 * @property {InjectionResult[]} success - Successful injections
 * @property {InjectionResult[]} failed - Failed injections
 * @property {InjectionResult[]} skipped - Skipped injections
 * @property {number} totalFiles - Total files processed
 * @property {number} totalInjections - Total injections performed
 * @property {number} totalErrors - Total errors encountered
 */

/**
 * @typedef {Object} ValidationSummary
 * @property {string[]} valid - Valid file paths
 * @property {Array<{filePath: string, error: string}>} invalid - Invalid configurations
 * @property {string[]} warnings - Warning messages
 */

/**
 * @typedef {Object} InjectionStats
 * @property {Object} wordInjections - Word injection statistics
 * @property {Object} excelInjections - Excel injection statistics
 * @property {Object} powerPointInjections - PowerPoint injection statistics
 * @property {number} totalProcessedFiles - Total processed files
 * @property {number} successRate - Success rate percentage
 */

export default OfficeInjector;