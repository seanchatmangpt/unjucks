/**
 * KGEN Frontmatter Workflow Engine
 * 
 * Comprehensive frontmatter-driven template processing system that enables
 * metadata-driven artifact generation with provenance tracking, deterministic
 * output path resolution, and conditional processing logic.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { FrontmatterParser } from './parser.js';
import { PathResolver } from './path-resolver.js';
import { ConditionalProcessor } from './conditional-processor.js';
import { OperationEngine } from './operation-engine.js';
import { SchemaValidator } from './schema-validator.js';
import { MetadataExtractor } from './metadata-extractor.js';
import { ProvenanceTracker } from '../../provenance/tracker.js';
import { KGenErrorHandler } from '../../utils/error-handler.js';

export class FrontmatterWorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core workflow configuration
      enableValidation: true,
      enableProvenance: true,
      enableConditionalProcessing: true,
      enableSchemaValidation: true,
      
      // Processing settings
      maxConcurrentOperations: 10,
      deterministic: true,
      auditTrail: true,
      
      // Error handling settings
      errorHandling: {
        enableRecovery: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        enableEventEmission: true
      },
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'kgen-frontmatter-workflow' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize core components
    this.parser = new FrontmatterParser({
      enableValidation: this.config.enableValidation,
      enableSemanticValidation: this.config.enableSchemaValidation
    });
    
    this.pathResolver = new PathResolver({
      deterministic: this.config.deterministic
    });
    
    this.conditionalProcessor = new ConditionalProcessor({
      enableProvenance: this.config.enableProvenance
    });
    
    this.operationEngine = new OperationEngine({
      maxConcurrentOperations: this.config.maxConcurrentOperations
    });
    
    this.schemaValidator = new SchemaValidator({
      enableStrictMode: this.config.enableSchemaValidation
    });
    
    this.metadataExtractor = new MetadataExtractor({
      enableProvenance: this.config.enableProvenance
    });
    
    this.provenanceTracker = this.config.enableProvenance 
      ? new ProvenanceTracker(this.config.provenance) 
      : null;
    
    this.activeOperations = new Map();
    this._setupEventHandlers();
  }

  /**
   * Initialize the frontmatter workflow engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN frontmatter workflow engine...');
      
      // Initialize components in dependency order
      if (this.provenanceTracker) {
        await this.provenanceTracker.initialize();
      }
      
      await this.schemaValidator.initialize();
      await this.operationEngine.initialize();
      
      this.state = 'ready';
      this.emit('workflow:ready');
      
      this.logger.success('KGEN frontmatter workflow engine initialized successfully');
      return { status: 'success', version: this.getVersion() };
      
    } catch (error) {
      const operationId = 'workflow:initialize';
      const errorContext = {
        component: 'frontmatter-workflow',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('workflow:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Process a template with frontmatter workflow
   * @param {string} templateContent - Template content with frontmatter
   * @param {Object} context - Template rendering context
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with artifacts
   */
  async processTemplate(templateContent, context = {}, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting frontmatter workflow ${operationId}`);
      
      // Start provenance tracking
      const provenanceContext = await this._startProvenance(operationId, {
        type: 'frontmatter_processing',
        templateContent,
        context,
        options,
        timestamp: this.getDeterministicDate()
      });
      
      // Parse frontmatter and extract metadata
      const parseResult = await this.parser.parse(templateContent, this.config.enableSchemaValidation);
      
      if (!parseResult.hasValidFrontmatter && options.requireFrontmatter) {
        throw new Error('Template requires valid frontmatter but none found');
      }
      
      // Extract comprehensive metadata
      const metadata = await this.metadataExtractor.extract(parseResult.frontmatter, {
        templateContent: parseResult.content,
        context,
        operationId,
        provenanceContext
      });
      
      // Validate frontmatter schema if enabled
      if (this.config.enableSchemaValidation && parseResult.hasValidFrontmatter) {
        const schemaValidation = await this.schemaValidator.validate(
          parseResult.frontmatter, 
          options.schema || 'default'
        );
        
        if (!schemaValidation.valid) {
          throw new Error(`Schema validation failed: ${schemaValidation.errors.join(', ')}`);
        }
        
        metadata.schemaValidation = schemaValidation;
      }
      
      // Process conditional logic
      const conditionalResult = await this.conditionalProcessor.evaluate(
        parseResult.frontmatter,
        context,
        {
          operationId,
          provenanceContext,
          metadata
        }
      );
      
      // Check if processing should be skipped
      if (conditionalResult.skip) {
        await this._completeProvenance(operationId, {
          status: 'skipped',
          reason: conditionalResult.reason,
          metadata
        });
        
        this.logger.info(`Template processing skipped: ${conditionalResult.reason}`);
        
        return {
          operationId,
          status: 'skipped',
          reason: conditionalResult.reason,
          metadata,
          artifacts: []
        };
      }
      
      // Resolve output paths dynamically
      const pathResolution = await this.pathResolver.resolve(
        parseResult.frontmatter,
        context,
        {
          operationId,
          metadata,
          deterministic: this.config.deterministic
        }
      );
      
      // Execute template operations
      const operationResult = await this.operationEngine.execute({
        frontmatter: parseResult.frontmatter,
        content: parseResult.content,
        context,
        metadata,
        pathResolution,
        conditionalResult,
        operationId,
        provenanceContext
      });
      
      // Complete provenance tracking
      await this._completeProvenance(operationId, {
        status: 'success',
        operationResult,
        metadata,
        pathResolution,
        conditionalResult,
        parseResult
      });
      
      this.emit('workflow:complete', { 
        operationId, 
        result: operationResult,
        metadata 
      });
      
      this.logger.success(`Frontmatter workflow ${operationId} completed successfully`);
      
      return {
        operationId,
        status: 'success',
        artifacts: operationResult.artifacts,
        metadata,
        pathResolution,
        conditionalResult,
        parseResult
      };
      
    } catch (error) {
      const errorContext = {
        component: 'frontmatter-workflow',
        operation: 'template_processing',
        input: { 
          hasTemplate: !!templateContent,
          contextKeys: Object.keys(context),
          options 
        },
        state: { activeOperations: this.activeOperations.size },
        metadata: { operationId }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      // Record error in provenance
      if (this.provenanceTracker) {
        try {
          await this.provenanceTracker.recordError(operationId, {
            ...error,
            errorId: handlingResult.errorContext.errorId,
            classification: handlingResult.errorContext.classification,
            severity: handlingResult.errorContext.severity
          });
        } catch (recordingError) {
          this.logger.error('Failed to record error in provenance:', recordingError);
        }
      }
      
      this.emit('workflow:error', {
        operationId,
        error,
        errorContext: handlingResult.errorContext,
        recovered: handlingResult.recovered
      });
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result;
    }
  }

  /**
   * Process multiple templates concurrently with workflow
   * @param {Array} templates - Array of template objects with content and context
   * @param {Object} globalOptions - Global processing options
   * @returns {Promise<Array>} Array of processing results
   */
  async processTemplates(templates, globalOptions = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting batch frontmatter workflow ${operationId} with ${templates.length} templates`);
      
      // Start provenance for batch operation
      const provenanceContext = await this._startProvenance(operationId, {
        type: 'batch_frontmatter_processing',
        templateCount: templates.length,
        globalOptions,
        timestamp: this.getDeterministicDate()
      });
      
      // Process templates with controlled concurrency
      const results = await Promise.allSettled(
        templates.map((template, index) =>
          this.processTemplate(
            template.content,
            { ...template.context, ...globalOptions.globalContext },
            { ...globalOptions, batchIndex: index, parentOperationId: operationId }
          )
        )
      );
      
      // Collect results and separate successes from failures
      const successful = [];
      const failed = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push({ index, result: result.value });
        } else {
          failed.push({ index, error: result.reason });
        }
      });
      
      // Complete batch provenance
      await this._completeProvenance(operationId, {
        status: failed.length === 0 ? 'success' : 'partial_success',
        batchResults: {
          total: templates.length,
          successful: successful.length,
          failed: failed.length,
          results: results
        }
      });
      
      this.emit('workflow:batch_complete', {
        operationId,
        total: templates.length,
        successful: successful.length,
        failed: failed.length,
        results
      });
      
      return {
        operationId,
        status: failed.length === 0 ? 'success' : 'partial_success',
        total: templates.length,
        successful: successful.length,
        failed: failed.length,
        results: successful.map(s => s.result),
        errors: failed.map(f => f.error)
      };
      
    } catch (error) {
      const errorContext = {
        component: 'frontmatter-workflow',
        operation: 'batch_template_processing',
        input: { templateCount: templates.length },
        state: { activeOperations: this.activeOperations.size },
        metadata: { operationId }
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      
      this.emit('workflow:batch_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Validate template frontmatter against schema
   * @param {string} templateContent - Template content
   * @param {string} schemaName - Schema name to validate against
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplate(templateContent, schemaName = 'default') {
    try {
      const parseResult = await this.parser.parse(templateContent, true);
      
      if (!parseResult.hasValidFrontmatter) {
        return {
          valid: false,
          errors: ['No valid frontmatter found'],
          warnings: []
        };
      }
      
      return await this.schemaValidator.validate(parseResult.frontmatter, schemaName);
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Extract variables from template content
   * @param {string} templateContent - Template content
   * @returns {Promise<Object>} Variable extraction result
   */
  async extractVariables(templateContent) {
    try {
      const parseResult = await this.parser.parse(templateContent);
      
      return await this.metadataExtractor.extractVariables(
        parseResult.frontmatter,
        parseResult.content
      );
      
    } catch (error) {
      this.logger.error('Failed to extract variables:', error);
      return {
        frontmatterVariables: [],
        templateVariables: [],
        allVariables: [],
        variableDefinitions: {}
      };
    }
  }

  /**
   * Get workflow engine status
   */
  getStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      activeOperations: this.activeOperations.size,
      components: {
        parser: this.parser.getStatus ? this.parser.getStatus() : 'active',
        pathResolver: this.pathResolver.getStatus ? this.pathResolver.getStatus() : 'active',
        conditionalProcessor: this.conditionalProcessor.getStatus ? this.conditionalProcessor.getStatus() : 'active',
        operationEngine: this.operationEngine.getStatus ? this.operationEngine.getStatus() : 'active',
        schemaValidator: this.schemaValidator.getStatus ? this.schemaValidator.getStatus() : 'active',
        metadataExtractor: this.metadataExtractor.getStatus ? this.metadataExtractor.getStatus() : 'active'
      },
      config: this.config,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown the workflow engine gracefully
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down frontmatter workflow engine...');
      
      this.state = 'shutting_down';
      
      // Wait for active operations to complete
      await this._waitForActiveOperations();
      
      // Shutdown components
      if (this.operationEngine.shutdown) {
        await this.operationEngine.shutdown();
      }
      
      if (this.provenanceTracker) {
        await this.provenanceTracker.shutdown();
      }
      
      this.state = 'shutdown';
      this.emit('workflow:shutdown');
      
      this.logger.success('Frontmatter workflow engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during workflow engine shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateOperationId() {
    return `fwf_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _startProvenance(operationId, data) {
    if (!this.provenanceTracker) return null;
    
    try {
      return await this.provenanceTracker.startOperation({
        operationId,
        ...data
      });
    } catch (error) {
      this.logger.warn('Failed to start provenance tracking:', error);
      return null;
    }
  }

  async _completeProvenance(operationId, data) {
    if (!this.provenanceTracker) return;
    
    try {
      await this.provenanceTracker.completeOperation(operationId, data);
    } catch (error) {
      this.logger.warn('Failed to complete provenance tracking:', error);
    }
  }

  _setupEventHandlers() {
    // Component error propagation
    [
      this.parser,
      this.pathResolver,
      this.conditionalProcessor,
      this.operationEngine,
      this.schemaValidator,
      this.metadataExtractor
    ].forEach(component => {
      if (component && component.on) {
        component.on('error', (error) => {
          this.emit('component:error', { 
            component: component.constructor.name,
            error 
          });
        });
      }
    });

    // Operation tracking
    this.on('workflow:start', this._trackOperationStart.bind(this));
    this.on('workflow:complete', this._trackOperationComplete.bind(this));
  }

  _trackOperationStart(event) {
    this.activeOperations.set(event.operationId, {
      startTime: this.getDeterministicTimestamp(),
      type: 'frontmatter_workflow'
    });
  }

  _trackOperationComplete(event) {
    this.activeOperations.delete(event.operationId);
  }

  async _waitForActiveOperations(timeout = 30000) {
    const startTime = this.getDeterministicTimestamp();
    
    while (this.activeOperations.size > 0 && (this.getDeterministicTimestamp() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeOperations.size > 0) {
      this.logger.warn(`${this.activeOperations.size} operations still active after timeout`);
    }
  }

  getVersion() {
    return '1.0.0';
  }
}

export default FrontmatterWorkflowEngine;