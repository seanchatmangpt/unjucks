/**
 * Batch processing system for Office document templates
 * 
 * This module provides comprehensive batch processing capabilities for Office documents,
 * supporting parallel processing, progress tracking, error handling, and result aggregation.
 * 
 * @module office/io/batch-processor
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  TemplateInfo,
  ProcessingResult,
  ProcessingOptions,
  ValidationResult,
  ErrorSeverity,
  BatchProcessingConfig,
  BatchProgress,
  TemplateDiscoveryResult,
  DiscoveryStats
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';
import { WordProcessor } from '../processors/word-processor.js';
import { ExcelProcessor } from '../processors/excel-processor.js';
import { PowerPointProcessor } from '../processors/powerpoint-processor.js';
import { Logger } from '../utils/logger.js';

/**
 * Batch processing job definition
 */
export interface BatchJob {
  /** Job ID */
  id: string;
  /** Job name */
  name: string;
  /** Template path */
  templatePath: string;
  /** Data for processing */
  data: Record<string, any>;
  /** Output path */
  outputPath: string;
  /** Job priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Job status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  /** Created timestamp */
  created: Date;
  /** Started timestamp */
  started?: Date;
  /** Completed timestamp */
  completed?: Date;
  /** Processing result */
  result?: ProcessingResult;
  /** Error information */
  error?: Error;
}

/**
 * Batch processing queue
 */
export interface BatchQueue {
  /** Queue ID */
  id: string;
  /** Queue name */
  name: string;
  /** Jobs in queue */
  jobs: BatchJob[];
  /** Queue status */
  status: 'idle' | 'processing' | 'paused' | 'stopped';
  /** Processing options */
  options: ProcessingOptions;
  /** Concurrency level */
  concurrency: number;
  /** Created timestamp */
  created: Date;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  /** Processing statistics */
  stats: BatchProcessingStats;
  /** Individual job results */
  results: BatchJobResult[];
  /** Overall success status */
  success: boolean;
  /** Aggregated validation result */
  validation: ValidationResult;
  /** Processing duration */
  duration: number;
  /** Output files created */
  outputFiles: string[];
}

/**
 * Individual job result
 */
export interface BatchJobResult {
  /** Job ID */
  jobId: string;
  /** Job success status */
  success: boolean;
  /** Processing result */
  result?: ProcessingResult;
  /** Error if failed */
  error?: string;
  /** Processing duration */
  duration: number;
  /** Output file path */
  outputPath?: string;
}

/**
 * Batch processing statistics
 */
export interface BatchProcessingStats {
  /** Total jobs processed */
  totalJobs: number;
  /** Successful jobs */
  successful: number;
  /** Failed jobs */
  failed: number;
  /** Cancelled jobs */
  cancelled: number;
  /** Average processing time */
  averageProcessingTime: number;
  /** Total processing time */
  totalProcessingTime: number;
  /** Peak memory usage */
  peakMemoryUsage: number;
  /** Files processed by type */
  fileTypeStats: Record<DocumentType, number>;
}

/**
 * Template discovery options
 */
export interface TemplateDiscoveryOptions {
  /** Directories to search */
  searchPaths: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Whether to search recursively */
  recursive?: boolean;
  /** Maximum depth for recursive search */
  maxDepth?: number;
  /** Whether to validate found templates */
  validate?: boolean;
}

/**
 * Batch processor for Office documents
 * 
 * Provides comprehensive batch processing capabilities with support for
 * parallel execution, progress tracking, and error recovery.
 */
export class BatchProcessor extends EventEmitter {
  private readonly logger: Logger;
  private readonly processors: Map<DocumentType, BaseOfficeProcessor> = new Map();
  private readonly queues: Map<string, BatchQueue> = new Map();
  private readonly activeJobs: Map<string, BatchJob> = new Map();
  private readonly jobHistory: Map<string, BatchJob> = new Map();
  private isProcessing = false;
  private readonly maxConcurrency: number;
  
  /**
   * Creates a new batch processor
   * 
   * @param maxConcurrency - Maximum number of concurrent jobs
   * @param options - Processing options
   */
  constructor(maxConcurrency: number = 4, private readonly options: ProcessingOptions = {}) {
    super();
    this.maxConcurrency = maxConcurrency;
    this.logger = Logger.createOfficeLogger('BatchProcessor', options.debug);
    
    // Initialize processors
    this.initializeProcessors();
  }

  /**
   * Discovers templates in specified paths
   * 
   * @param options - Discovery options
   * @returns Promise resolving to discovery result
   */
  async discoverTemplates(options: TemplateDiscoveryOptions): Promise<TemplateDiscoveryResult> {
    const startTime = this.getDeterministicTimestamp();
    this.logger.info(`Discovering templates in ${options.searchPaths.length} paths`);
    
    const stats: DiscoveryStats = {
      filesScanned: 0,
      templatesFound: 0,
      directoriesSearched: 0,
      duration: 0,
      typeDistribution: {
        [DocumentType.WORD]: 0,
        [DocumentType.EXCEL]: 0,
        [DocumentType.POWERPOINT]: 0,
        [DocumentType.PDF]: 0
      }
    };
    
    const templates: TemplateInfo[] = [];
    const errors: any[] = [];
    
    try {
      for (const searchPath of options.searchPaths) {
        await this.discoverInPath(searchPath, options, templates, stats, errors);
      }
      
      // Validate templates if requested
      if (options.validate) {
        await this.validateDiscoveredTemplates(templates, errors);
      }
      
      stats.duration = this.getDeterministicTimestamp() - startTime;
      stats.templatesFound = templates.length;
      
      this.logger.info(`Discovery completed: ${templates.length} templates found in ${stats.duration}ms`);
      
      return {
        templates,
        stats,
        errors
      };
      
    } catch (error) {
      this.logger.error('Template discovery failed', error);
      throw error;
    }
  }

  /**
   * Creates a new batch processing queue
   * 
   * @param name - Queue name
   * @param concurrency - Queue concurrency level
   * @param options - Processing options
   * @returns Queue ID
   */
  createQueue(name: string, concurrency: number = 2, options: ProcessingOptions = {}): string {
    const queueId = `queue_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queue: BatchQueue = {
      id: queueId,
      name,
      jobs: [],
      status: 'idle',
      options: { ...this.options, ...options },
      concurrency: Math.min(concurrency, this.maxConcurrency),
      created: this.getDeterministicDate()
    };
    
    this.queues.set(queueId, queue);
    this.logger.info(`Created queue '${name}' with ID ${queueId}`);
    
    return queueId;
  }

  /**
   * Adds a job to a processing queue
   * 
   * @param queueId - Queue ID
   * @param templatePath - Template file path
   * @param data - Processing data
   * @param outputPath - Output file path
   * @param priority - Job priority
   * @returns Job ID
   */
  addJob(
    queueId: string, 
    templatePath: string, 
    data: Record<string, any>, 
    outputPath: string,
    priority: BatchJob['priority'] = 'medium'
  ): string {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }
    
    const jobId = `job_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BatchJob = {
      id: jobId,
      name: path.basename(templatePath),
      templatePath,
      data,
      outputPath,
      priority,
      status: 'pending',
      created: this.getDeterministicDate()
    };
    
    // Insert job in priority order
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const insertIndex = queue.jobs.findIndex(
      j => priorityOrder[j.priority] > priorityOrder[priority]
    );
    
    if (insertIndex === -1) {
      queue.jobs.push(job);
    } else {
      queue.jobs.splice(insertIndex, 0, job);
    }
    
    this.logger.debug(`Added job ${jobId} to queue ${queueId}`);
    this.emit('jobAdded', { queueId, jobId, job });
    
    return jobId;
  }

  /**
   * Processes a batch configuration
   * 
   * @param config - Batch processing configuration
   * @returns Promise resolving to batch result
   */
  async processBatch(config: BatchProcessingConfig): Promise<BatchProcessingResult> {
    const startTime = this.getDeterministicTimestamp();
    this.logger.info(`Starting batch processing of ${config.templates.length} templates`);
    
    try {
      // Create temporary queue for this batch
      const queueId = this.createQueue(
        'batch_processing',
        config.maxConcurrency || this.maxConcurrency,
        config.options
      );
      
      // Add all jobs to queue
      const jobIds: string[] = [];
      for (let i = 0; i < config.templates.length; i++) {
        const templatePath = config.templates[i];
        const data = config.data[i] || {};
        const outputPath = this.generateOutputPath(templatePath, config.outputDir, i);
        
        const jobId = this.addJob(queueId, templatePath, data, outputPath, 'medium');
        jobIds.push(jobId);
      }
      
      // Process queue with progress tracking
      const result = await this.processQueue(queueId, config.onProgress);
      
      // Clean up temporary queue
      this.queues.delete(queueId);
      
      result.duration = this.getDeterministicTimestamp() - startTime;
      
      this.logger.info(`Batch processing completed in ${result.duration}ms`);
      return result;
      
    } catch (error) {
      this.logger.error('Batch processing failed', error);
      throw error;
    }
  }

  /**
   * Processes all jobs in a queue
   * 
   * @param queueId - Queue ID to process
   * @param onProgress - Progress callback
   * @returns Promise resolving to batch result
   */
  async processQueue(queueId: string, onProgress?: (progress: BatchProgress) => void): Promise<BatchProcessingResult> {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue not found: ${queueId}`);
    }
    
    if (queue.status === 'processing') {
      throw new Error(`Queue ${queueId} is already processing`);
    }
    
    const startTime = this.getDeterministicTimestamp();
    queue.status = 'processing';
    
    this.logger.info(`Processing queue ${queueId} with ${queue.jobs.length} jobs`);
    this.emit('queueStarted', { queueId, queue });
    
    const results: BatchJobResult[] = [];
    const outputFiles: string[] = [];
    const stats: BatchProcessingStats = {
      totalJobs: queue.jobs.length,
      successful: 0,
      failed: 0,
      cancelled: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      peakMemoryUsage: 0,
      fileTypeStats: {
        [DocumentType.WORD]: 0,
        [DocumentType.EXCEL]: 0,
        [DocumentType.POWERPOINT]: 0,
        [DocumentType.PDF]: 0
      }
    };
    
    try {
      // Process jobs with concurrency control
      const concurrent = Math.min(queue.concurrency, queue.jobs.length);
      const jobPromises: Promise<void>[] = [];
      
      for (let i = 0; i < concurrent; i++) {
        jobPromises.push(this.processJobsWorker(queue, results, stats, onProgress));
      }
      
      await Promise.all(jobPromises);
      
      // Calculate final statistics
      stats.averageProcessingTime = stats.totalProcessingTime / stats.totalJobs;
      
      // Collect output files
      for (const result of results) {
        if (result.outputPath) {
          outputFiles.push(result.outputPath);
        }
      }
      
      // Aggregate validation results
      const validation = this.aggregateValidationResults(results);
      
      queue.status = 'idle';
      
      const batchResult: BatchProcessingResult = {
        stats,
        results,
        success: stats.failed === 0,
        validation,
        duration: this.getDeterministicTimestamp() - startTime,
        outputFiles
      };
      
      this.emit('queueCompleted', { queueId, queue, result: batchResult });
      
      return batchResult;
      
    } catch (error) {
      queue.status = 'idle';
      this.logger.error(`Queue processing failed: ${error.message}`);
      this.emit('queueFailed', { queueId, queue, error });
      throw error;
    }
  }

  /**
   * Gets the status of a queue
   * 
   * @param queueId - Queue ID
   * @returns Queue status information
   */
  getQueueStatus(queueId: string): BatchQueue | null {
    return this.queues.get(queueId) || null;
  }

  /**
   * Gets the status of a job
   * 
   * @param jobId - Job ID
   * @returns Job status information
   */
  getJobStatus(jobId: string): BatchJob | null {
    // Check active jobs first
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }
    
    // Check job history
    return this.jobHistory.get(jobId) || null;
  }

  /**
   * Cancels a specific job
   * 
   * @param jobId - Job ID to cancel
   * @returns Whether job was cancelled
   */
  cancelJob(jobId: string): boolean {
    // Find job in all queues
    for (const queue of this.queues.values()) {
      const jobIndex = queue.jobs.findIndex(job => job.id === jobId);
      if (jobIndex !== -1) {
        const job = queue.jobs[jobIndex];
        
        if (job.status === 'pending') {
          job.status = 'cancelled';
          queue.jobs.splice(jobIndex, 1);
          this.jobHistory.set(jobId, job);
          
          this.logger.info(`Cancelled job ${jobId}`);
          this.emit('jobCancelled', { jobId, job });
          
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Pauses a queue
   * 
   * @param queueId - Queue ID to pause
   * @returns Whether queue was paused
   */
  pauseQueue(queueId: string): boolean {
    const queue = this.queues.get(queueId);
    if (queue && queue.status === 'processing') {
      queue.status = 'paused';
      this.logger.info(`Paused queue ${queueId}`);
      this.emit('queuePaused', { queueId, queue });
      return true;
    }
    return false;
  }

  /**
   * Resumes a paused queue
   * 
   * @param queueId - Queue ID to resume
   * @returns Whether queue was resumed
   */
  resumeQueue(queueId: string): boolean {
    const queue = this.queues.get(queueId);
    if (queue && queue.status === 'paused') {
      queue.status = 'processing';
      this.logger.info(`Resumed queue ${queueId}`);
      this.emit('queueResumed', { queueId, queue });
      return true;
    }
    return false;
  }

  /**
   * Gets processing statistics for all queues
   * 
   * @returns Overall processing statistics
   */
  getOverallStats(): {
    totalQueues: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    queueStats: Array<{ queueId: string; name: string; jobs: number; status: string }>;
  } {
    const queueStats = Array.from(this.queues.values()).map(queue => ({
      queueId: queue.id,
      name: queue.name,
      jobs: queue.jobs.length,
      status: queue.status
    }));
    
    const completedJobs = this.jobHistory.size;
    const failedJobs = Array.from(this.jobHistory.values())
      .filter(job => job.status === 'failed').length;
    
    return {
      totalQueues: this.queues.size,
      activeJobs: this.activeJobs.size,
      completedJobs,
      failedJobs,
      queueStats
    };
  }

  /**
   * Initializes document processors
   */
  private initializeProcessors(): void {
    this.processors.set(DocumentType.WORD, new WordProcessor(this.options));
    this.processors.set(DocumentType.EXCEL, new ExcelProcessor(this.options));
    this.processors.set(DocumentType.POWERPOINT, new PowerPointProcessor(this.options));
    
    this.logger.debug('Initialized document processors');
  }

  /**
   * Discovers templates in a specific path
   * 
   * @param searchPath - Path to search
   * @param options - Discovery options
   * @param templates - Array to collect templates
   * @param stats - Statistics to update
   * @param errors - Array to collect errors
   */
  private async discoverInPath(
    searchPath: string,
    options: TemplateDiscoveryOptions,
    templates: TemplateInfo[],
    stats: DiscoveryStats,
    errors: any[]
  ): Promise<void> {
    try {
      const pathStat = await fs.stat(searchPath);
      
      if (pathStat.isDirectory()) {
        stats.directoriesSearched++;
        await this.discoverInDirectory(searchPath, options, templates, stats, errors, 0);
      } else if (pathStat.isFile()) {
        stats.filesScanned++;
        await this.processDiscoveredFile(searchPath, templates, stats, errors);
      }
      
    } catch (error) {
      errors.push({
        message: `Failed to access path ${searchPath}: ${error.message}`,
        code: 'PATH_ACCESS_ERROR',
        severity: ErrorSeverity.WARNING
      });
    }
  }

  /**
   * Discovers templates in a directory
   * 
   * @param dirPath - Directory path
   * @param options - Discovery options
   * @param templates - Array to collect templates
   * @param stats - Statistics to update
   * @param errors - Array to collect errors
   * @param depth - Current recursion depth
   */
  private async discoverInDirectory(
    dirPath: string,
    options: TemplateDiscoveryOptions,
    templates: TemplateInfo[],
    stats: DiscoveryStats,
    errors: any[],
    depth: number
  ): Promise<void> {
    if (options.maxDepth && depth >= options.maxDepth) {
      return;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && options.recursive) {
          await this.discoverInDirectory(fullPath, options, templates, stats, errors, depth + 1);
        } else if (entry.isFile()) {
          stats.filesScanned++;
          
          if (this.matchesPatterns(entry.name, options.includePatterns, options.excludePatterns)) {
            await this.processDiscoveredFile(fullPath, templates, stats, errors);
          }
        }
      }
      
    } catch (error) {
      errors.push({
        message: `Failed to read directory ${dirPath}: ${error.message}`,
        code: 'DIRECTORY_READ_ERROR',
        severity: ErrorSeverity.WARNING
      });
    }
  }

  /**
   * Processes a discovered file
   * 
   * @param filePath - File path
   * @param templates - Array to collect templates
   * @param stats - Statistics to update
   * @param errors - Array to collect errors
   */
  private async processDiscoveredFile(
    filePath: string,
    templates: TemplateInfo[],
    stats: DiscoveryStats,
    errors: any[]
  ): Promise<void> {
    try {
      const processor = this.getProcessorForFile(filePath);
      if (processor) {
        const template = await processor.loadTemplate(filePath);
        templates.push(template);
        stats.typeDistribution[template.type]++;
        
        this.logger.debug(`Discovered template: ${template.name}`);
      }
      
    } catch (error) {
      errors.push({
        message: `Failed to process file ${filePath}: ${error.message}`,
        code: 'FILE_PROCESSING_ERROR',
        severity: ErrorSeverity.WARNING
      });
    }
  }

  /**
   * Validates discovered templates
   * 
   * @param templates - Templates to validate
   * @param errors - Array to collect errors
   */
  private async validateDiscoveredTemplates(templates: TemplateInfo[], errors: any[]): Promise<void> {
    this.logger.debug(`Validating ${templates.length} discovered templates`);
    
    for (const template of templates) {
      try {
        const processor = this.processors.get(template.type);
        if (processor) {
          const validation = await processor.validateTemplate(template);
          if (!validation.valid) {
            errors.push(...validation.errors);
          }
        }
      } catch (error) {
        errors.push({
          message: `Template validation failed for ${template.path}: ${error.message}`,
          code: 'TEMPLATE_VALIDATION_ERROR',
          severity: ErrorSeverity.WARNING
        });
      }
    }
  }

  /**
   * Worker function for processing jobs from a queue
   * 
   * @param queue - Queue to process jobs from
   * @param results - Array to collect results
   * @param stats - Statistics to update
   * @param onProgress - Progress callback
   */
  private async processJobsWorker(
    queue: BatchQueue,
    results: BatchJobResult[],
    stats: BatchProcessingStats,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<void> {
    while (queue.jobs.length > 0 && queue.status === 'processing') {
      const job = queue.jobs.shift();
      if (!job) break;
      
      const jobStartTime = this.getDeterministicTimestamp();
      job.status = 'processing';
      job.started = this.getDeterministicDate();
      
      this.activeJobs.set(job.id, job);
      this.emit('jobStarted', { jobId: job.id, job });
      
      try {
        const processor = this.getProcessorForFile(job.templatePath);
        if (!processor) {
          throw new Error(`No processor available for file: ${job.templatePath}`);
        }
        
        // Update file type stats
        const documentType = this.getDocumentTypeForFile(job.templatePath);
        if (documentType) {
          stats.fileTypeStats[documentType]++;
        }
        
        // Process the template
        const result = await processor.process(job.templatePath, job.data, job.outputPath);
        
        job.status = 'completed';
        job.completed = this.getDeterministicDate();
        job.result = result;
        
        const duration = this.getDeterministicTimestamp() - jobStartTime;
        stats.totalProcessingTime += duration;
        stats.successful++;
        
        // Track memory usage
        if (process.memoryUsage) {
          const memUsage = process.memoryUsage();
          stats.peakMemoryUsage = Math.max(stats.peakMemoryUsage, memUsage.heapUsed);
        }
        
        const jobResult: BatchJobResult = {
          jobId: job.id,
          success: true,
          result,
          duration,
          outputPath: job.outputPath
        };
        
        results.push(jobResult);
        
        this.logger.debug(`Job ${job.id} completed successfully in ${duration}ms`);
        this.emit('jobCompleted', { jobId: job.id, job, result: jobResult });
        
      } catch (error) {
        job.status = 'failed';
        job.completed = this.getDeterministicDate();
        job.error = error as Error;
        
        const duration = this.getDeterministicTimestamp() - jobStartTime;
        stats.totalProcessingTime += duration;
        stats.failed++;
        
        const jobResult: BatchJobResult = {
          jobId: job.id,
          success: false,
          error: error.message,
          duration
        };
        
        results.push(jobResult);
        
        this.logger.error(`Job ${job.id} failed: ${error.message}`);
        this.emit('jobFailed', { jobId: job.id, job, error });
      }
      
      // Move job to history
      this.activeJobs.delete(job.id);
      this.jobHistory.set(job.id, job);
      
      // Report progress
      if (onProgress) {
        const completed = stats.successful + stats.failed;
        const progress: BatchProgress = {
          total: stats.totalJobs,
          completed,
          failed: stats.failed,
          current: job.name,
          percentage: Math.round((completed / stats.totalJobs) * 100)
        };
        
        onProgress(progress);
      }
    }
  }

  /**
   * Gets the appropriate processor for a file
   * 
   * @param filePath - File path
   * @returns Processor or null if not supported
   */
  private getProcessorForFile(filePath: string): BaseOfficeProcessor | null {
    for (const processor of this.processors.values()) {
      if (processor.isSupported(filePath)) {
        return processor;
      }
    }
    return null;
  }

  /**
   * Gets the document type for a file
   * 
   * @param filePath - File path
   * @returns Document type or null if not supported
   */
  private getDocumentTypeForFile(filePath: string): DocumentType | null {
    for (const [type, processor] of this.processors.entries()) {
      if (processor.isSupported(filePath)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Checks if a filename matches include/exclude patterns
   * 
   * @param filename - Filename to check
   * @param includePatterns - Patterns to include
   * @param excludePatterns - Patterns to exclude
   * @returns Whether filename matches
   */
  private matchesPatterns(filename: string, includePatterns?: string[], excludePatterns?: string[]): boolean {
    // Check exclude patterns first
    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        if (this.matchesGlob(filename, pattern)) {
          return false;
        }
      }
    }
    
    // Check include patterns
    if (includePatterns && includePatterns.length > 0) {
      return includePatterns.some(pattern => this.matchesGlob(filename, pattern));
    }
    
    return true;
  }

  /**
   * Simple glob pattern matching
   * 
   * @param filename - Filename to check
   * @param pattern - Glob pattern
   * @returns Whether filename matches pattern
   */
  private matchesGlob(filename: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(filename);
  }

  /**
   * Generates output path for a template
   * 
   * @param templatePath - Template file path
   * @param outputDir - Output directory
   * @param index - Template index
   * @returns Generated output path
   */
  private generateOutputPath(templatePath: string, outputDir: string, index: number): string {
    const templateName = path.basename(templatePath, path.extname(templatePath));
    const extension = path.extname(templatePath);
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    
    return path.join(outputDir, `${templateName}_${timestamp}_${index}${extension}`);
  }

  /**
   * Aggregates validation results from multiple jobs
   * 
   * @param results - Job results to aggregate
   * @returns Aggregated validation result
   */
  private aggregateValidationResults(results: BatchJobResult[]): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    for (const result of results) {
      if (result.result?.validation) {
        errors.push(...result.result.validation.errors);
        warnings.push(...result.result.validation.warnings);
      } else if (!result.success && result.error) {
        errors.push({
          message: result.error,
          code: 'JOB_PROCESSING_ERROR',
          severity: ErrorSeverity.ERROR
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
   * Cleanup method to be called when batch processor is no longer needed
   */
  async cleanup(): Promise<void> {
    // Stop all queues
    for (const queue of this.queues.values()) {
      queue.status = 'stopped';
    }
    
    // Cleanup processors
    for (const processor of this.processors.values()) {
      await processor.cleanup();
    }
    
    // Clear all maps
    this.queues.clear();
    this.activeJobs.clear();
    this.jobHistory.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.logger.info('Batch processor cleanup completed');
  }
}
