/**
 * Abstract base class for all Office document processors in Unjucks
 * 
 * This module provides the foundational architecture for processing Office documents.
 * All specific document processors (Word, Excel, PowerPoint) extend this base class
 * to ensure consistent behavior and API across different document types.
 * 
 * @module office/core/base-processor
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import {
  DocumentType,
  ErrorSeverity
} from './types.js';
import { VariableExtractor } from '../utils/variable-extractor.js';
import { ValidationEngine } from '../utils/validation-engine.js';
import { Logger } from '../utils/logger.js';

/**
 * Abstract base processor for Office documents
 * 
 * Provides common functionality for all Office document processors including:
 * - Template loading and parsing
 * - Variable extraction and replacement
 * - Validation and error handling
 * - Plugin system integration
 * - Progress tracking and logging
 * 
 * @abstract
 */
export class BaseOfficeProcessor extends EventEmitter {
  /**
   * Creates a new base office processor
   * 
   * @param {import('./types.js').ProcessingOptions} [options={}] - Processing options
   */
  constructor(options = {}) {
    super();
    
    /** @protected @readonly @type {import('./types.js').ProcessingOptions} */
    this.options = options;
    
    /** @protected @readonly @type {Logger} */
    this.logger = new Logger(this.constructor.name, options.debug);
    
    /** @protected @readonly @type {VariableExtractor} */
    this.variableExtractor = new VariableExtractor(options.syntax);
    
    /** @protected @readonly @type {ValidationEngine} */
    this.validationEngine = new ValidationEngine(options.validation);
    
    /** @protected @readonly @type {Map<string, import('./types.js').OfficePlugin>} */
    this.plugins = new Map();
    
    /** @protected @type {import('./types.js').ProcessingContext|undefined} */
    this.currentContext = undefined;
    
    /** @protected @type {import('./types.js').ProcessingStats} */
    this.processingStats = {
      startTime: this.getDeterministicDate(),
      variablesProcessed: 0,
      injectionsPerformed: 0,
      errors: 0,
      warnings: 0
    };
  }

  /**
   * Gets the document type supported by this processor
   * 
   * @abstract
   * @returns {keyof typeof DocumentType} The document type
   */
  getSupportedType() {
    throw new Error('Abstract method getSupportedType must be implemented');
  }

  /**
   * Gets supported file extensions for this processor
   * 
   * @abstract
   * @returns {string[]} Array of file extensions (with dots)
   */
  getSupportedExtensions() {
    throw new Error('Abstract method getSupportedExtensions must be implemented');
  }

  /**
   * Loads a template document from file path
   * 
   * @abstract
   * @param {string} templatePath - Path to the template file
   * @returns {Promise<import('./types.js').TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    throw new Error('Abstract method loadTemplate must be implemented');
  }

  /**
   * Parses frontmatter from template document
   * 
   * @abstract
   * @param {import('./types.js').TemplateInfo} template - Template info
   * @returns {Promise<import('./types.js').TemplateFrontmatter|null>} Promise resolving to frontmatter
   */
  async parseFrontmatter(template) {
    throw new Error('Abstract method parseFrontmatter must be implemented');
  }

  /**
   * Extracts variables from template content
   * 
   * @abstract
   * @param {import('./types.js').TemplateInfo} template - Template info
   * @param {import('./types.js').TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<import('./types.js').VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    throw new Error('Abstract method extractVariables must be implemented');
  }

  /**
   * Processes the template with provided data
   * 
   * @abstract
   * @param {import('./types.js').TemplateInfo} template - Template info
   * @param {Record<string, any>} data - Data to use for variable replacement
   * @param {import('./types.js').TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<import('./types.js').ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    throw new Error('Abstract method processTemplate must be implemented');
  }

  /**
   * Saves the processed document to file
   * 
   * @abstract
   * @param {import('./types.js').ProcessingResult} result - Processing result
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Promise resolving to saved file path
   */
  async saveDocument(result, outputPath) {
    throw new Error('Abstract method saveDocument must be implemented');
  }

  /**
   * Validates template document structure
   * 
   * @abstract
   * @param {import('./types.js').TemplateInfo} template - Template info
   * @returns {Promise<import('./types.js').ValidationResult>} Promise resolving to validation result
   */
  async validateTemplate(template) {
    throw new Error('Abstract method validateTemplate must be implemented');
  }

  /**
   * Main processing method that orchestrates the entire workflow
   * 
   * @param {string} templatePath - Path to template file
   * @param {Record<string, any>} data - Data for variable replacement
   * @param {string} [outputPath] - Output file path
   * @returns {Promise<import('./types.js').ProcessingResult>}
   */
  async process(templatePath, data, outputPath) {
    this.logger.info(`Starting processing of template: ${templatePath}`);
    this.resetStats();
    
    try {
      // Load template
      const template = await this.loadTemplate(templatePath);
      this.emit('templateLoaded', template);
      
      // Parse frontmatter
      const frontmatter = await this.parseFrontmatter(template);
      this.emit('frontmatterParsed', frontmatter);
      
      // Create processing context
      this.currentContext = {
        template,
        data,
        options: this.options,
        stats: this.processingStats
      };
      
      // Validate template
      const templateValidation = await this.validateTemplate(template);
      if (!templateValidation.valid && this.options.validation?.failFast) {
        throw new Error(`Template validation failed: ${templateValidation.errors.map(e => e.message).join(', ')}`);
      }
      
      // Run pre-processing plugins
      await this.runPluginHook('preProcess', this.currentContext);
      
      // Validate input data
      const dataValidation = await this.validateData(data, frontmatter);
      if (!dataValidation.valid && this.options.validation?.failFast) {
        throw new Error(`Data validation failed: ${dataValidation.errors.map(e => e.message).join(', ')}`);
      }
      
      // Process template
      this.emit('processingStarted', template);
      const result = await this.processTemplate(template, data, frontmatter);
      
      // Merge validation results
      result.validation = this.mergeValidationResults(templateValidation, dataValidation, result.validation);
      
      // Run post-processing plugins
      await this.runPluginHook('postProcess', this.currentContext);
      
      // Save document if output path provided
      if (outputPath && !this.options.dryRun) {
        result.outputPath = await this.saveDocument(result, outputPath);
        this.emit('documentSaved', result.outputPath);
      }
      
      // Finalize stats
      this.finalizeStats();
      result.stats = { ...this.processingStats };
      
      this.emit('processingCompleted', result);
      this.logger.info(`Template processing completed successfully`);
      
      return result;
      
    } catch (error) {
      this.processingStats.errors++;
      this.logger.error(`Template processing failed: ${error.message}`);
      this.emit('processingError', error);
      
      return {
        success: false,
        stats: this.processingStats,
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
   * Validates input data against template requirements
   * 
   * @protected
   * @param {Record<string, any>} data - Input data to validate
   * @param {import('./types.js').TemplateFrontmatter} [frontmatter] - Template frontmatter with validation rules
   * @returns {Promise<import('./types.js').ValidationResult>}
   */
  async validateData(data, frontmatter) {
    if (!this.options.validation?.enabled) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    return this.validationEngine.validateData(data, frontmatter, this.currentContext);
  }

  /**
   * Merges multiple validation results into one
   * 
   * @protected
   * @param {...import('./types.js').ValidationResult} results - Validation results to merge
   * @returns {import('./types.js').ValidationResult}
   */
  mergeValidationResults(...results) {
    /** @type {import('./types.js').ValidationResult} */
    const merged = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    for (const result of results) {
      if (!result.valid) {
        merged.valid = false;
      }
      merged.errors.push(...result.errors);
      merged.warnings.push(...result.warnings);
    }
    
    return merged;
  }

  /**
   * Runs plugin hooks for a specific lifecycle event
   * 
   * @protected
   * @param {string} hookName - Name of the hook to run
   * @param {import('./types.js').ProcessingContext} context - Processing context
   * @returns {Promise<void>}
   */
  async runPluginHook(hookName, context) {
    for (const [name, plugin] of this.plugins) {
      try {
        if (hookName === 'preProcess' && plugin.process) {
          await plugin.process(context);
        } else if (hookName === 'postProcess' && plugin.validate) {
          await plugin.validate(context);
        }
      } catch (error) {
        this.logger.warn(`Plugin ${name} hook ${hookName} failed: ${error.message}`);
      }
    }
  }

  /**
   * Registers a plugin with this processor
   * 
   * @param {import('./types.js').OfficePlugin} plugin - Plugin to register
   * @returns {Promise<void>}
   */
  async registerPlugin(plugin) {
    const supportedTypes = plugin.supportedTypes;
    const processorType = this.getSupportedType();
    
    if (!supportedTypes.includes(processorType)) {
      throw new Error(`Plugin ${plugin.name} does not support document type ${processorType}`);
    }
    
    if (plugin.initialize) {
      await plugin.initialize({
        config: {},
        logger: this.logger,
        utils: {}
      });
    }
    
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Unregisters a plugin from this processor
   * 
   * @param {string} pluginName - Name of plugin to unregister
   * @returns {Promise<void>}
   */
  async unregisterPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
      this.plugins.delete(pluginName);
      this.logger.info(`Unregistered plugin: ${pluginName}`);
    }
  }

  /**
   * Gets information about registered plugins
   * 
   * @returns {Array<{name: string, version: string, supportedTypes: Array<keyof typeof DocumentType>}>}
   */
  getPluginInfo() {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      supportedTypes: plugin.supportedTypes
    }));
  }

  /**
   * Checks if a file is supported by this processor
   * 
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file is supported
   */
  isSupported(filePath) {
    const extension = this.getFileExtension(filePath);
    return this.getSupportedExtensions().includes(extension);
  }

  /**
   * Gets current processing statistics
   * 
   * @returns {import('./types.js').ProcessingStats}
   */
  getStats() {
    return { ...this.processingStats };
  }

  /**
   * Resets processing statistics
   * 
   * @protected
   */
  resetStats() {
    this.processingStats = {
      startTime: this.getDeterministicDate(),
      variablesProcessed: 0,
      injectionsPerformed: 0,
      errors: 0,
      warnings: 0
    };
  }

  /**
   * Finalizes processing statistics
   * 
   * @protected
   */
  finalizeStats() {
    this.processingStats.endTime = this.getDeterministicDate();
    this.processingStats.duration = this.processingStats.endTime.getTime() - this.processingStats.startTime.getTime();
    
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      this.processingStats.memoryUsage = {
        used: usage.heapUsed,
        total: usage.heapTotal,
        max: usage.heapTotal
      };
    }
  }

  /**
   * Increments variable processing counter
   * 
   * @protected
   */
  incrementVariableCount() {
    this.processingStats.variablesProcessed++;
  }

  /**
   * Increments injection counter
   * 
   * @protected
   */
  incrementInjectionCount() {
    this.processingStats.injectionsPerformed++;
  }

  /**
   * Increments error counter
   * 
   * @protected
   */
  incrementErrorCount() {
    this.processingStats.errors++;
  }

  /**
   * Increments warning counter
   * 
   * @protected
   */
  incrementWarningCount() {
    this.processingStats.warnings++;
  }

  /**
   * Gets file extension from path
   * 
   * @protected
   * @param {string} filePath - File path
   * @returns {string} File extension with dot
   */
  getFileExtension(filePath) {
    const parts = filePath.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Validates injection points in template
   * 
   * @protected
   * @param {import('./types.js').InjectionPoint[]} injectionPoints - Injection points to validate
   * @param {import('./types.js').TemplateInfo} template - Template info
   * @returns {Promise<import('./types.js').ValidationResult>}
   */
  async validateInjectionPoints(injectionPoints, template) {
    /** @type {import('./types.js').ValidationError[]} */
    const errors = [];
    /** @type {import('./types.js').ValidationError[]} */
    const warnings = [];
    
    for (const point of injectionPoints) {
      if (!point.id || !point.marker) {
        errors.push({
          message: `Injection point missing required id or marker`,
          code: 'INVALID_INJECTION_POINT',
          severity: ErrorSeverity.ERROR,
          field: 'injectionPoints',
          context: point
        });
      }
      
      if (point.required && !point.defaultContent) {
        warnings.push({
          message: `Required injection point ${point.id} has no default content`,
          code: 'MISSING_DEFAULT_CONTENT',
          severity: ErrorSeverity.WARNING,
          field: 'injectionPoints',
          context: point
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Cleanup method called when processor is no longer needed
   * 
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Unregister all plugins
    const pluginNames = Array.from(this.plugins.keys());
    for (const name of pluginNames) {
      await this.unregisterPlugin(name);
    }
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.logger.info('Processor cleanup completed');
  }

  /**
   * Get deterministic date for consistent behavior
   * 
   * @protected
   * @returns {Date}
   */
  getDeterministicDate() {
    return new Date();
  }
}