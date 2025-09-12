/**
 * Main factory class for Office document template processing
 * 
 * This module provides a unified interface for processing Office document templates
 * with automatic processor selection, comprehensive error handling, and extensible
 * plugin system integration.
 * 
 * @module office/office-template-processor
 * @version 1.0.0
 */

import {
  DocumentType,
  ProcessingOptions,
  ProcessingResult,
  TemplateInfo,
  ValidationResult,
  OfficePlugin,
  ProcessingContext,
  ErrorSeverity
} from './core/types.js';
import { BaseOfficeProcessor } from './core/base-processor.js';
import { WordProcessor } from './processors/word-processor.js';
import { ExcelProcessor } from './processors/excel-processor.js';
import { PowerPointProcessor } from './processors/powerpoint-processor.js';
import { BatchProcessor } from './io/batch-processor.js';
import { Logger } from './utils/logger.js';

/**
 * Office template processor factory configuration
 */
export interface OfficeProcessorConfig {
  /** Default processing options */
  defaultOptions?: ProcessingOptions;
  /** Maximum batch processing concurrency */
  maxConcurrency?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom processors for additional document types */
  customProcessors?: Map<DocumentType, BaseOfficeProcessor>;
  /** Global plugins to register with all processors */
  globalPlugins?: OfficePlugin[];
}

/**
 * Processing summary for multiple operations
 */
export interface ProcessingSummary {
  /** Total templates processed */
  totalProcessed: number;
  /** Successfully processed */
  successful: number;
  /** Failed processing */
  failed: number;
  /** Total processing time */
  totalTime: number;
  /** Average processing time */
  averageTime: number;
  /** Results by document type */
  typeBreakdown: Record<DocumentType, { count: number; success: number; failed: number }>;
  /** Overall validation summary */
  validation: ValidationResult;
}

/**
 * Main Office template processor factory
 * 
 * Provides a unified interface for processing Office document templates with
 * automatic processor selection, batch processing capabilities, and comprehensive
 * error handling and validation.
 */
export class OfficeTemplateProcessor {
  private readonly logger: Logger;
  private readonly processors: Map<DocumentType, BaseOfficeProcessor> = new Map();
  private readonly batchProcessor: BatchProcessor;
  private readonly config: OfficeProcessorConfig;
  private readonly globalPlugins: OfficePlugin[] = [];
  
  /**
   * Creates a new Office template processor
   * 
   * @param config - Processor configuration
   */
  constructor(config: OfficeProcessorConfig = {}) {
    this.config = {
      maxConcurrency: 4,
      debug: false,
      ...config
    };
    
    this.logger = Logger.createOfficeLogger('OfficeTemplateProcessor', this.config.debug);
    
    // Initialize processors
    this.initializeProcessors();
    
    // Initialize batch processor
    this.batchProcessor = new BatchProcessor(
      this.config.maxConcurrency!,
      this.config.defaultOptions
    );
    
    // Register global plugins
    if (this.config.globalPlugins) {
      this.globalPlugins.push(...this.config.globalPlugins);
      this.registerGlobalPlugins();
    }
    
    this.logger.info('Office template processor initialized');
  }

  /**
   * Processes a single Office document template
   * 
   * @param templatePath - Path to template file
   * @param data - Data for variable replacement
   * @param outputPath - Output file path (optional)
   * @param options - Processing options (optional)
   * @returns Promise resolving to processing result
   */
  async processTemplate(
    templatePath: string,
    data: Record<string, any>,
    outputPath?: string,
    options?: ProcessingOptions
  ): Promise<ProcessingResult> {
    this.logger.info(`Processing template: ${templatePath}`);
    
    try {
      // Detect document type and get appropriate processor
      const processor = await this.getProcessorForTemplate(templatePath);
      
      if (!processor) {
        throw new Error(`Unsupported document type for file: ${templatePath}`);
      }
      
      // Merge options
      const processingOptions = {
        ...this.config.defaultOptions,
        ...options
      };
      
      // Process the template
      const result = await processor.process(templatePath, data, outputPath);
      
      this.logger.info(`Template processed successfully: ${templatePath}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to process template: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Processes multiple templates in batch
   * 
   * @param templates - Array of template paths
   * @param data - Array of data objects (one per template)
   * @param outputDir - Output directory
   * @param options - Processing options
   * @returns Promise resolving to processing summary
   */
  async processBatch(
    templates: string[],
    data: Record<string, any>[],
    outputDir: string,
    options?: ProcessingOptions
  ): Promise<ProcessingSummary> {
    this.logger.info(`Processing batch of ${templates.length} templates`);
    
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Validate inputs
      if (templates.length !== data.length) {
        throw new Error('Number of templates must match number of data objects');
      }
      
      // Process batch
      const batchResult = await this.batchProcessor.processBatch({
        templates,
        data,
        outputDir,
        options: {
          ...this.config.defaultOptions,
          ...options
        },
        maxConcurrency: this.config.maxConcurrency
      });
      
      // Generate summary
      const summary = this.generateProcessingSummary(batchResult, this.getDeterministicTimestamp() - startTime);
      
      this.logger.info(`Batch processing completed: ${summary.successful}/${summary.totalProcessed} successful`);
      return summary;
      
    } catch (error) {
      this.logger.error('Batch processing failed', error);
      throw error;
    }
  }

  /**
   * Discovers templates in specified directories
   * 
   * @param searchPaths - Directories to search
   * @param options - Discovery options
   * @returns Promise resolving to discovered templates
   */
  async discoverTemplates(
    searchPaths: string[],
    options: {
      recursive?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      validate?: boolean;
    } = {}
  ) {
    this.logger.info(`Discovering templates in ${searchPaths.length} paths`);
    
    const discoveryResult = await this.batchProcessor.discoverTemplates({
      searchPaths,
      recursive: true,
      validate: true,
      ...options
    });
    
    this.logger.info(`Discovered ${discoveryResult.templates.length} templates`);
    return discoveryResult;
  }

  /**
   * Validates a template without processing
   * 
   * @param templatePath - Path to template file
   * @returns Promise resolving to validation result
   */
  async validateTemplate(templatePath: string): Promise<ValidationResult> {
    this.logger.debug(`Validating template: ${templatePath}`);
    
    try {
      const processor = await this.getProcessorForTemplate(templatePath);
      
      if (!processor) {
        return {
          valid: false,
          errors: [{
            message: `Unsupported document type for file: ${templatePath}`,
            code: 'UNSUPPORTED_DOCUMENT_TYPE',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        };
      }
      
      // Load template info
      const templateInfo = await processor.loadTemplate(templatePath);
      
      // Validate template
      const result = await processor.validateTemplate(templateInfo);
      
      this.logger.debug(`Template validation completed: ${result.valid ? 'valid' : 'invalid'}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Template validation failed: ${templatePath}`, error);
      
      return {
        valid: false,
        errors: [{
          message: `Template validation failed: ${error.message}`,
          code: 'VALIDATION_ERROR',
          severity: ErrorSeverity.ERROR
        }],
        warnings: []
      };
    }
  }

  /**
   * Gets template information without processing
   * 
   * @param templatePath - Path to template file
   * @returns Promise resolving to template info
   */
  async getTemplateInfo(templatePath: string): Promise<TemplateInfo> {
    this.logger.debug(`Getting template info: ${templatePath}`);
    
    const processor = await this.getProcessorForTemplate(templatePath);
    
    if (!processor) {
      throw new Error(`Unsupported document type for file: ${templatePath}`);
    }
    
    return processor.loadTemplate(templatePath);
  }

  /**
   * Registers a plugin with all processors
   * 
   * @param plugin - Plugin to register
   */
  async registerGlobalPlugin(plugin: OfficePlugin): Promise<void> {
    this.logger.info(`Registering global plugin: ${plugin.name}`);
    
    this.globalPlugins.push(plugin);
    
    // Register with all existing processors
    for (const processor of this.processors.values()) {
      try {
        await processor.registerPlugin(plugin);
      } catch (error) {
        this.logger.warn(`Failed to register plugin ${plugin.name} with processor: ${error.message}`);
      }
    }
  }

  /**
   * Unregisters a plugin from all processors
   * 
   * @param pluginName - Name of plugin to unregister
   */
  async unregisterGlobalPlugin(pluginName: string): Promise<void> {
    this.logger.info(`Unregistering global plugin: ${pluginName}`);
    
    // Remove from global plugins list
    const index = this.globalPlugins.findIndex(p => p.name === pluginName);
    if (index !== -1) {
      this.globalPlugins.splice(index, 1);
    }
    
    // Unregister from all processors
    for (const processor of this.processors.values()) {
      try {
        await processor.unregisterPlugin(pluginName);
      } catch (error) {
        this.logger.warn(`Failed to unregister plugin ${pluginName} from processor: ${error.message}`);
      }
    }
  }

  /**
   * Gets information about all registered processors
   * 
   * @returns Processor information
   */
  getProcessorInfo(): Array<{
    type: DocumentType;
    extensions: string[];
    plugins: Array<{ name: string; version: string }>;
  }> {
    return Array.from(this.processors.entries()).map(([type, processor]) => ({
      type,
      extensions: processor.getSupportedExtensions(),
      plugins: processor.getPluginInfo()
    }));
  }

  /**
   * Gets processing statistics from batch processor
   * 
   * @returns Overall processing statistics
   */
  getProcessingStats() {
    return this.batchProcessor.getOverallStats();
  }

  /**
   * Creates a processing context for plugins
   * 
   * @param templatePath - Template path
   * @param data - Processing data
   * @param options - Processing options
   * @returns Processing context
   */
  async createProcessingContext(
    templatePath: string,
    data: Record<string, any>,
    options?: ProcessingOptions
  ): Promise<ProcessingContext> {
    const templateInfo = await this.getTemplateInfo(templatePath);
    
    return {
      template: templateInfo,
      data,
      options: {
        ...this.config.defaultOptions,
        ...options
      } as ProcessingOptions
    };
  }

  /**
   * Initializes document processors
   */
  private initializeProcessors(): void {
    // Initialize built-in processors
    this.processors.set(DocumentType.WORD, new WordProcessor(this.config.defaultOptions));
    this.processors.set(DocumentType.EXCEL, new ExcelProcessor(this.config.defaultOptions));
    this.processors.set(DocumentType.POWERPOINT, new PowerPointProcessor(this.config.defaultOptions));
    
    // Add custom processors if provided
    if (this.config.customProcessors) {
      for (const [type, processor] of this.config.customProcessors) {
        this.processors.set(type, processor);
        this.logger.info(`Registered custom processor for ${type}`);
      }
    }
    
    this.logger.debug(`Initialized ${this.processors.size} document processors`);
  }

  /**
   * Registers global plugins with all processors
   */
  private async registerGlobalPlugins(): Promise<void> {
    for (const plugin of this.globalPlugins) {
      for (const processor of this.processors.values()) {
        try {
          await processor.registerPlugin(plugin);
        } catch (error) {
          this.logger.warn(`Failed to register global plugin ${plugin.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Gets the appropriate processor for a template
   * 
   * @param templatePath - Template file path
   * @returns Processor or null if not supported
   */
  private async getProcessorForTemplate(templatePath: string): Promise<BaseOfficeProcessor | null> {
    for (const processor of this.processors.values()) {
      if (processor.isSupported(templatePath)) {
        return processor;
      }
    }
    return null;
  }

  /**
   * Generates processing summary from batch result
   * 
   * @param batchResult - Batch processing result
   * @param totalTime - Total processing time
   * @returns Processing summary
   */
  private generateProcessingSummary(batchResult: any, totalTime: number): ProcessingSummary {
    const typeBreakdown: Record<DocumentType, { count: number; success: number; failed: number }> = {
      [DocumentType.WORD]: { count: 0, success: 0, failed: 0 },
      [DocumentType.EXCEL]: { count: 0, success: 0, failed: 0 },
      [DocumentType.POWERPOINT]: { count: 0, success: 0, failed: 0 },
      [DocumentType.PDF]: { count: 0, success: 0, failed: 0 }
    };
    
    // Aggregate type breakdown from batch stats
    for (const [type, count] of Object.entries(batchResult.stats.fileTypeStats)) {
      const docType = type as DocumentType;
      if (typeBreakdown[docType]) {
        typeBreakdown[docType].count = count as number;
      }
    }
    
    // Calculate success/failure by type from results
    for (const result of batchResult.results) {
      // This would require template type information in the result
      // For now, we'll aggregate at the overall level
    }
    
    return {
      totalProcessed: batchResult.stats.totalJobs,
      successful: batchResult.stats.successful,
      failed: batchResult.stats.failed,
      totalTime,
      averageTime: batchResult.stats.averageProcessingTime,
      typeBreakdown,
      validation: batchResult.validation
    };
  }

  /**
   * Cleanup method to be called when processor is no longer needed
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Office template processor');
    
    // Cleanup all processors
    for (const processor of this.processors.values()) {
      await processor.cleanup();
    }
    
    // Cleanup batch processor
    await this.batchProcessor.cleanup();
    
    // Clear processor map
    this.processors.clear();
    
    this.logger.info('Office template processor cleanup completed');
  }

  /**
   * Creates a new Office template processor with default configuration
   * 
   * @param options - Processing options
   * @returns New processor instance
   */
  static create(options?: ProcessingOptions): OfficeTemplateProcessor {
    return new OfficeTemplateProcessor({
      defaultOptions: options,
      debug: options?.debug || false
    });
  }

  /**
   * Creates a new Office template processor with batch processing configuration
   * 
   * @param maxConcurrency - Maximum concurrent processing
   * @param options - Processing options
   * @returns New processor instance
   */
  static createForBatch(maxConcurrency: number = 4, options?: ProcessingOptions): OfficeTemplateProcessor {
    return new OfficeTemplateProcessor({
      maxConcurrency,
      defaultOptions: options,
      debug: options?.debug || false
    });
  }

  /**
   * Gets supported document types
   * 
   * @returns Array of supported document types
   */
  static getSupportedTypes(): DocumentType[] {
    return [DocumentType.WORD, DocumentType.EXCEL, DocumentType.POWERPOINT];
  }

  /**
   * Gets file extensions supported by each document type
   * 
   * @returns Map of document types to file extensions
   */
  static getSupportedExtensions(): Record<DocumentType, string[]> {
    return {
      [DocumentType.WORD]: ['.docx', '.doc'],
      [DocumentType.EXCEL]: ['.xlsx', '.xls'],
      [DocumentType.POWERPOINT]: ['.pptx', '.ppt'],
      [DocumentType.PDF]: ['.pdf']
    };
  }
}
