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
  ProcessingContext,
  ProcessingResult,
  ProcessingOptions,
  TemplateInfo,
  TemplateFrontmatter,
  ValidationResult,
  ValidationError,
  ErrorSeverity,
  ProcessingStats,
  VariableLocation,
  InjectionPoint,
  OfficePlugin
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
export abstract class BaseOfficeProcessor extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly variableExtractor: VariableExtractor;
  protected readonly validationEngine: ValidationEngine;
  protected readonly plugins: Map<string, OfficePlugin> = new Map();
  protected currentContext?: ProcessingContext;
  protected processingStats: ProcessingStats;

  /**
   * Creates a new base office processor
   * 
   * @param options - Processing options
   */
  constructor(protected readonly options: ProcessingOptions = {}) {
    super();
    this.logger = new Logger(this.constructor.name, options.debug);
    this.variableExtractor = new VariableExtractor(options.syntax);
    this.validationEngine = new ValidationEngine(options.validation);
    
    this.processingStats = {
      startTime: new Date(),
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
   * @returns The document type
   */
  abstract getSupportedType(): DocumentType;

  /**
   * Gets supported file extensions for this processor
   * 
   * @abstract
   * @returns Array of file extensions (with dots)
   */
  abstract getSupportedExtensions(): string[];

  /**
   * Loads a template document from file path
   * 
   * @abstract
   * @param templatePath - Path to the template file
   * @returns Promise resolving to template info
   */
  abstract loadTemplate(templatePath: string): Promise<TemplateInfo>;

  /**
   * Parses frontmatter from template document
   * 
   * @abstract
   * @param template - Template info
   * @returns Promise resolving to frontmatter
   */
  abstract parseFrontmatter(template: TemplateInfo): Promise<TemplateFrontmatter | null>;

  /**
   * Extracts variables from template content
   * 
   * @abstract
   * @param template - Template info
   * @param frontmatter - Template frontmatter
   * @returns Promise resolving to variable locations
   */
  abstract extractVariables(template: TemplateInfo, frontmatter?: TemplateFrontmatter): Promise<VariableLocation[]>;

  /**
   * Processes the template with provided data
   * 
   * @abstract
   * @param template - Template info
   * @param data - Data to use for variable replacement
   * @param frontmatter - Template frontmatter
   * @returns Promise resolving to processing result
   */
  abstract processTemplate(template: TemplateInfo, data: Record<string, any>, frontmatter?: TemplateFrontmatter): Promise<ProcessingResult>;

  /**
   * Saves the processed document to file
   * 
   * @abstract
   * @param result - Processing result
   * @param outputPath - Output file path
   * @returns Promise resolving to saved file path
   */
  abstract saveDocument(result: ProcessingResult, outputPath: string): Promise<string>;

  /**
   * Validates template document structure
   * 
   * @abstract
   * @param template - Template info
   * @returns Promise resolving to validation result
   */
  abstract validateTemplate(template: TemplateInfo): Promise<ValidationResult>;

  /**
   * Main processing method that orchestrates the entire workflow
   * 
   * @param templatePath - Path to template file
   * @param data - Data for variable replacement
   * @param outputPath - Output file path
   * @returns Promise resolving to processing result
   */
  async process(templatePath: string, data: Record<string, any>, outputPath?: string): Promise<ProcessingResult> {
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
   * @param data - Input data to validate
   * @param frontmatter - Template frontmatter with validation rules
   * @returns Promise resolving to validation result
   */
  protected async validateData(data: Record<string, any>, frontmatter?: TemplateFrontmatter): Promise<ValidationResult> {
    if (!this.options.validation?.enabled) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    return this.validationEngine.validateData(data, frontmatter, this.currentContext!);
  }

  /**
   * Merges multiple validation results into one
   * 
   * @param results - Validation results to merge
   * @returns Merged validation result
   */
  protected mergeValidationResults(...results: ValidationResult[]): ValidationResult {
    const merged: ValidationResult = {
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
   * @param hookName - Name of the hook to run
   * @param context - Processing context
   */
  protected async runPluginHook(hookName: string, context: ProcessingContext): Promise<void> {
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
   * @param plugin - Plugin to register
   */
  async registerPlugin(plugin: OfficePlugin): Promise<void> {
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
   * @param pluginName - Name of plugin to unregister
   */
  async unregisterPlugin(pluginName: string): Promise<void> {
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
   * @returns Array of plugin information
   */
  getPluginInfo(): Array<{ name: string; version: string; supportedTypes: DocumentType[] }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      supportedTypes: plugin.supportedTypes
    }));
  }

  /**
   * Checks if a file is supported by this processor
   * 
   * @param filePath - File path to check
   * @returns True if file is supported
   */
  isSupported(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return this.getSupportedExtensions().includes(extension);
  }

  /**
   * Gets current processing statistics
   * 
   * @returns Current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.processingStats };
  }

  /**
   * Resets processing statistics
   */
  protected resetStats(): void {
    this.processingStats = {
      startTime: new Date(),
      variablesProcessed: 0,
      injectionsPerformed: 0,
      errors: 0,
      warnings: 0
    };
  }

  /**
   * Finalizes processing statistics
   */
  protected finalizeStats(): void {
    this.processingStats.endTime = new Date();
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
   */
  protected incrementVariableCount(): void {
    this.processingStats.variablesProcessed++;
  }

  /**
   * Increments injection counter
   */
  protected incrementInjectionCount(): void {
    this.processingStats.injectionsPerformed++;
  }

  /**
   * Increments error counter
   */
  protected incrementErrorCount(): void {
    this.processingStats.errors++;
  }

  /**
   * Increments warning counter
   */
  protected incrementWarningCount(): void {
    this.processingStats.warnings++;
  }

  /**
   * Gets file extension from path
   * 
   * @param filePath - File path
   * @returns File extension with dot
   */
  protected getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Validates injection points in template
   * 
   * @param injectionPoints - Injection points to validate
   * @param template - Template info
   * @returns Validation result
   */
  protected async validateInjectionPoints(injectionPoints: InjectionPoint[], template: TemplateInfo): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
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
   */
  async cleanup(): Promise<void> {
    // Unregister all plugins
    const pluginNames = Array.from(this.plugins.keys());
    for (const name of pluginNames) {
      await this.unregisterPlugin(name);
    }
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.logger.info('Processor cleanup completed');
  }
}
