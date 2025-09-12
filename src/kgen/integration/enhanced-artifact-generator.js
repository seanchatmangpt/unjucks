/**
 * Enhanced Artifact Generator - KGEN Integration Layer
 * 
 * Advanced artifact generation system that combines KGEN's semantic processing
 * with unjucks template workflows, providing deterministic output, content-addressed
 * hashing, and comprehensive provenance tracking.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { UnjucksTemplateBridge } from './unjucks-template-bridge.js';
import { FrontmatterWorkflowEngine } from '../core/frontmatter/workflow-engine.js';
import { SemanticProcessor } from '../semantic/processor.js';
import { ProvenanceTracker } from '../provenance/tracker.js';
import { DeterministicRenderingSystem } from '../deterministic/index.js';
import { KGenErrorHandler } from '../utils/error-handler.js';
import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'crypto';

export class EnhancedArtifactGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core generation settings
      templatesDir: config.templatesDir || '_templates',
      outputDir: config.outputDir || 'generated',
      baseDir: config.baseDir || process.cwd(),
      
      // KGEN integration features
      enableSemanticProcessing: config.enableSemanticProcessing !== false,
      enableProvenance: config.enableProvenance !== false,
      enableDeterministicGeneration: config.enableDeterministicGeneration !== false,
      
      // Content addressing and hashing
      enableContentAddressing: config.enableContentAddressing !== false,
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      enableArtifactSigning: config.enableArtifactSigning || false,
      
      // Processing and performance
      maxConcurrentGenerations: config.maxConcurrentGenerations || 5,
      enableCache: config.enableCache !== false,
      cacheDirectory: config.cacheDirectory || '.kgen-cache',
      
      // Quality and validation
      enableValidation: config.enableValidation !== false,
      enableSemanticValidation: config.enableSemanticValidation || false,
      enableComplianceChecks: config.enableComplianceChecks || false,
      
      // Error handling
      errorHandling: {
        enableRecovery: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        enableErrorArtifacts: true,
        ...config.errorHandling
      },
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'kgen-enhanced-artifact-generator' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize core components
    this.templateBridge = new UnjucksTemplateBridge({
      templatesDir: this.config.templatesDir,
      baseDir: this.config.baseDir,
      enableProvenance: this.config.enableProvenance,
      enableSemanticProcessing: this.config.enableSemanticProcessing,
      enableContentAddressing: this.config.enableContentAddressing,
      maxConcurrentTemplates: this.config.maxConcurrentGenerations
    });
    
    this.semanticProcessor = this.config.enableSemanticProcessing 
      ? new SemanticProcessor(this.config.semantic)
      : null;
    
    this.provenanceTracker = this.config.enableProvenance 
      ? new ProvenanceTracker(this.config.provenance)
      : null;
    
    this.deterministicRenderer = this.config.enableDeterministicGeneration
      ? new DeterministicRenderingSystem(this.config.deterministic)
      : null;
    
    // Generation state and caches
    this.activeGenerations = new Map();
    this.artifactCache = new Map();
    this.contentAddressIndex = new Map();
    this.generationHistory = [];
    
    // Quality metrics
    this.metrics = {
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      artifactsGenerated: 0,
      duplicateArtifacts: 0,
      totalGenerationTime: 0
    };
    
    this._setupEventHandlers();
  }

  /**
   * Initialize the enhanced artifact generator
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN enhanced artifact generator...');
      
      // Initialize components in dependency order
      await this.templateBridge.initialize();
      
      if (this.semanticProcessor) {
        await this.semanticProcessor.initialize();
      }
      
      if (this.provenanceTracker) {
        await this.provenanceTracker.initialize();
      }
      
      if (this.deterministicRenderer) {
        await this.deterministicRenderer.initialize();
      }
      
      // Ensure output directory exists
      await fs.ensureDir(path.join(this.config.baseDir, this.config.outputDir));
      
      this.state = 'ready';
      this.emit('generator:ready');
      
      this.logger.success('KGEN enhanced artifact generator initialized successfully');
      return { status: 'success', version: this.getVersion() };
      
    } catch (error) {
      const operationId = 'generator:initialize';
      const errorContext = {
        component: 'enhanced-artifact-generator',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('generator:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Generate artifacts with full KGEN integration
   * @param {Object} request - Generation request
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Enhanced generation result
   */
  async generateArtifacts(request, options = {}) {
    const operationId = this._generateOperationId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Starting enhanced artifact generation ${operationId}`);
      this.metrics.totalGenerations++;
      
      // Track active generation
      this.activeGenerations.set(operationId, {
        request,
        options,
        startTime,
        status: 'running'
      });
      
      // Start provenance tracking
      let provenanceContext = null;
      if (this.provenanceTracker) {
        provenanceContext = await this.provenanceTracker.startOperation({
          operationId,
          type: 'enhanced_artifact_generation',
          request,
          options,
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Phase 1: Template Discovery and Analysis
      const discoveryResult = await this._performTemplateDiscovery(
        request, 
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 2: Semantic Context Enhancement
      const semanticContext = await this._enhanceSemanticContext(
        request,
        discoveryResult,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 3: Deterministic Generation Planning
      const generationPlan = await this._createGenerationPlan(
        request,
        semanticContext,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 4: Artifact Generation Execution
      const generationResult = await this._executeGenerationPlan(
        generationPlan,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 5: Post-Generation Processing
      const finalResult = await this._postProcessArtifacts(
        generationResult,
        { ...options, operationId, provenanceContext }
      );
      
      // Complete provenance tracking
      if (this.provenanceTracker) {
        await this.provenanceTracker.completeOperation(operationId, {
          status: 'success',
          finalResult,
          metrics: {
            artifactsGenerated: finalResult.artifacts.length,
            generationTime: this.getDeterministicTimestamp() - startTime,
            semanticEnhancement: !!semanticContext,
            deterministicGeneration: !!generationPlan.deterministicPlan
          }
        });
      }
      
      // Update metrics and state
      this.metrics.successfulGenerations++;
      this.metrics.artifactsGenerated += finalResult.artifacts.length;
      this.metrics.totalGenerationTime += (this.getDeterministicTimestamp() - startTime);
      
      this.activeGenerations.set(operationId, {
        ...this.activeGenerations.get(operationId),
        status: 'completed',
        result: finalResult
      });
      
      this.emit('artifacts:generated', {
        operationId,
        result: finalResult,
        metrics: this.getMetrics()
      });
      
      this.logger.success(`Enhanced artifact generation ${operationId} completed successfully`);
      
      return {
        operationId,
        status: 'success',
        ...finalResult,
        metadata: {
          ...finalResult.metadata,
          enhancedGeneration: true,
          semanticProcessing: !!this.semanticProcessor,
          deterministicGeneration: !!this.deterministicRenderer,
          provenanceTracking: !!this.provenanceTracker,
          generatorVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      const errorContext = {
        component: 'enhanced-artifact-generator',
        operation: 'artifact_generation',
        request: {
          generator: request.generator,
          template: request.template,
          hasContext: !!request.context
        },
        state: { activeGenerations: this.activeGenerations.size }
      };
      
      // Update metrics
      this.metrics.failedGenerations++;
      this.metrics.totalGenerationTime += (this.getDeterministicTimestamp() - startTime);
      
      // Handle error with recovery
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
      
      // Update active generation status
      this.activeGenerations.set(operationId, {
        ...this.activeGenerations.get(operationId),
        status: 'failed',
        error: error.message
      });
      
      this.emit('artifacts:generation_error', {
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
   * Batch generate multiple artifacts with optimization
   * @param {Array} requests - Array of generation requests
   * @param {Object} options - Batch generation options
   * @returns {Promise<Object>} Batch generation result
   */
  async batchGenerateArtifacts(requests, options = {}) {
    const operationId = this._generateOperationId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Starting batch artifact generation ${operationId} with ${requests.length} requests`);
      
      // Start provenance for batch operation
      let provenanceContext = null;
      if (this.provenanceTracker) {
        provenanceContext = await this.provenanceTracker.startOperation({
          operationId,
          type: 'batch_enhanced_artifact_generation',
          requestCount: requests.length,
          options,
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Process requests with controlled concurrency
      const results = await this._processBatchRequests(
        requests,
        { ...options, operationId, provenanceContext }
      );
      
      // Analyze batch results
      const successful = results.filter(r => r.status === 'success');
      const failed = results.filter(r => r.status === 'failed');
      
      // Complete batch provenance
      if (this.provenanceTracker) {
        await this.provenanceTracker.completeOperation(operationId, {
          status: failed.length === 0 ? 'success' : 'partial_success',
          batchResults: {
            total: requests.length,
            successful: successful.length,
            failed: failed.length,
            results
          }
        });
      }
      
      this.emit('artifacts:batch_generated', {
        operationId,
        total: requests.length,
        successful: successful.length,
        failed: failed.length,
        results
      });
      
      return {
        operationId,
        status: failed.length === 0 ? 'success' : 'partial_success',
        total: requests.length,
        successful: successful.length,
        failed: failed.length,
        results,
        executionTime: this.getDeterministicTimestamp() - startTime,
        metadata: {
          batchGeneration: true,
          concurrencyLimit: this.config.maxConcurrentGenerations,
          generatorVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      const errorContext = {
        component: 'enhanced-artifact-generator',
        operation: 'batch_artifact_generation',
        batchSize: requests.length
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('artifacts:batch_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Get generator status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      activeGenerations: this.activeGenerations.size,
      config: this.config,
      components: {
        templateBridge: this.templateBridge.getStatus(),
        semanticProcessor: this.semanticProcessor?.getStatus() || 'disabled',
        provenanceTracker: this.provenanceTracker?.getStatus() || 'disabled',
        deterministicRenderer: this.deterministicRenderer?.getStatus() || 'disabled'
      },
      cache: {
        artifacts: this.artifactCache.size,
        contentAddresses: this.contentAddressIndex.size
      },
      metrics: this.getMetrics(),
      uptime: process.uptime()
    };
  }

  /**
   * Get generation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalGenerations > 0 
        ? this.metrics.successfulGenerations / this.metrics.totalGenerations 
        : 0,
      averageGenerationTime: this.metrics.totalGenerations > 0
        ? this.metrics.totalGenerationTime / this.metrics.totalGenerations
        : 0,
      duplicateRate: this.metrics.artifactsGenerated > 0
        ? this.metrics.duplicateArtifacts / this.metrics.artifactsGenerated
        : 0
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.artifactCache.clear();
    this.contentAddressIndex.clear();
    this.templateBridge.clearCache();
    
    this.logger.info('Enhanced artifact generator caches cleared');
    this.emit('cache:cleared');
  }

  /**
   * Shutdown the generator gracefully
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down enhanced artifact generator...');
      
      this.state = 'shutting_down';
      
      // Wait for active generations to complete
      await this._waitForActiveGenerations();
      
      // Shutdown components
      await this.templateBridge.shutdown();
      
      if (this.semanticProcessor) {
        await this.semanticProcessor.shutdown();
      }
      
      if (this.provenanceTracker) {
        await this.provenanceTracker.shutdown();
      }
      
      if (this.deterministicRenderer) {
        await this.deterministicRenderer.shutdown();
      }
      
      // Clear caches
      this.clearCache();
      
      this.state = 'shutdown';
      this.emit('generator:shutdown');
      
      this.logger.success('Enhanced artifact generator shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during generator shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateOperationId() {
    return `eag_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _performTemplateDiscovery(request, options) {
    this.logger.debug(`Performing template discovery for ${request.generator}/${request.template}`);
    
    // Discover available templates and variables
    const templates = await this.templateBridge.discoverTemplates(
      request.generator,
      {
        includeVariableExtraction: true,
        includeFrontmatterAnalysis: true,
        enableContentAddressing: this.config.enableContentAddressing
      }
    );
    
    // Find the specific template
    const targetTemplate = templates.find(t => t.name === request.template);
    if (!targetTemplate) {
      throw new Error(`Template not found: ${request.generator}/${request.template}`);
    }
    
    // Extract variables for the target template
    const variables = await this.templateBridge.extractTemplateVariables(
      request.generator,
      request.template
    );
    
    return {
      template: targetTemplate,
      variables,
      allTemplates: templates
    };
  }

  async _enhanceSemanticContext(request, discoveryResult, options) {
    if (!this.semanticProcessor) {
      return { ...request.context, ...request.variables };
    }
    
    this.logger.debug('Enhancing semantic context');
    
    // Create semantic context enhancement
    const baseContext = { ...request.context, ...request.variables };
    
    try {
      const enhancedContext = await this.semanticProcessor.enrichGenerationContext(
        baseContext,
        {
          template: discoveryResult.template,
          variables: discoveryResult.variables,
          targetPlatform: options.targetPlatform || 'generic'
        }
      );
      
      return enhancedContext;
    } catch (error) {
      this.logger.warn('Semantic context enhancement failed, using base context:', error.message);
      return baseContext;
    }
  }

  async _createGenerationPlan(request, semanticContext, options) {
    this.logger.debug('Creating generation plan');
    
    const plan = {
      operationId: options.operationId,
      generator: request.generator,
      template: request.template,
      context: semanticContext,
      destination: request.destination || this.config.outputDir,
      options: {
        ...options,
        dry: options.dry || false,
        force: options.force || false
      },
      deterministicPlan: null
    };
    
    // Create deterministic plan if enabled
    if (this.deterministicRenderer) {
      try {
        plan.deterministicPlan = await this.deterministicRenderer.createRenderingPlan(
          plan,
          {
            enableContentAddressing: this.config.enableContentAddressing,
            hashAlgorithm: this.config.hashAlgorithm
          }
        );
      } catch (error) {
        this.logger.warn('Deterministic plan creation failed:', error.message);
      }
    }
    
    return plan;
  }

  async _executeGenerationPlan(plan, options) {
    this.logger.debug(`Executing generation plan for ${plan.generator}/${plan.template}`);
    
    // Execute generation through template bridge
    const generationResult = await this.templateBridge.generateArtifacts(
      {
        generator: plan.generator,
        template: plan.template,
        context: plan.context,
        destination: plan.destination,
        variables: plan.context // Include all context as variables
      },
      {
        ...plan.options,
        deterministicPlan: plan.deterministicPlan
      }
    );
    
    return generationResult;
  }

  async _postProcessArtifacts(generationResult, options) {
    this.logger.debug('Post-processing artifacts');
    
    const processedArtifacts = [];
    
    for (const artifact of generationResult.artifacts) {
      const processed = await this._processArtifact(artifact, options);
      processedArtifacts.push(processed);
      
      // Check for duplicates using content addressing
      if (this.config.enableContentAddressing && processed.contentAddress) {
        if (this.contentAddressIndex.has(processed.contentAddress)) {
          this.metrics.duplicateArtifacts++;
          processed.metadata.isDuplicate = true;
          processed.metadata.originalArtifact = this.contentAddressIndex.get(processed.contentAddress);
        } else {
          this.contentAddressIndex.set(processed.contentAddress, {
            operationId: options.operationId,
            artifactId: processed.id,
            path: processed.path
          });
        }
      }
    }
    
    return {
      ...generationResult,
      artifacts: processedArtifacts,
      metadata: {
        ...generationResult.metadata,
        postProcessed: true,
        duplicatesDetected: processedArtifacts.filter(a => a.metadata.isDuplicate).length
      }
    };
  }

  async _processArtifact(artifact, options) {
    const processed = { ...artifact };
    
    // Add content addressing if enabled
    if (this.config.enableContentAddressing) {
      const content = artifact.content || '';
      processed.contentAddress = this._generateContentAddress(content);
    }
    
    // Add artifact signing if enabled
    if (this.config.enableArtifactSigning) {
      processed.signature = this._signArtifact(processed);
    }
    
    // Perform validation if enabled
    if (this.config.enableValidation) {
      const validation = await this._validateArtifact(processed);
      processed.validation = validation;
    }
    
    // Cache processed artifact
    if (this.config.enableCache) {
      this.artifactCache.set(processed.id, processed);
    }
    
    return processed;
  }

  async _processBatchRequests(requests, options) {
    const results = [];
    const semaphore = new Array(this.config.maxConcurrentGenerations).fill(null);
    
    const processRequest = async (request, index) => {
      try {
        const result = await this.generateArtifacts(request, {
          ...options,
          batchIndex: index,
          batchSize: requests.length
        });
        return { index, status: 'success', result };
      } catch (error) {
        return { index, status: 'failed', error: error.message };
      }
    };
    
    // Process requests with concurrency control
    for (let i = 0; i < requests.length; i += this.config.maxConcurrentGenerations) {
      const batch = requests.slice(i, i + this.config.maxConcurrentGenerations);
      const batchResults = await Promise.all(
        batch.map((request, batchIndex) => processRequest(request, i + batchIndex))
      );
      results.push(...batchResults);
    }
    
    return results.sort((a, b) => a.index - b.index);
  }

  _generateContentAddress(content) {
    const hash = crypto.createHash(this.config.hashAlgorithm);
    hash.update(content);
    return hash.digest('hex');
  }

  _signArtifact(artifact) {
    // Simplified artifact signing - in production, use proper cryptographic signing
    const signature = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        id: artifact.id,
        path: artifact.path,
        contentAddress: artifact.contentAddress,
        generatedAt: artifact.metadata.generatedAt
      }))
      .digest('hex');
    
    return {
      algorithm: 'sha256',
      signature,
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  async _validateArtifact(artifact) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Basic artifact validation
      if (!artifact.path) {
        validation.errors.push('Artifact missing required path');
      }
      
      if (!artifact.id) {
        validation.errors.push('Artifact missing required id');
      }
      
      // Content validation if present
      if (artifact.content) {
        // Check for common issues
        if (artifact.content.includes('undefined') && !artifact.path.includes('.md')) {
          validation.warnings.push('Content contains "undefined" values');
        }
      }
      
      validation.valid = validation.errors.length === 0;
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
  }

  async _waitForActiveGenerations(timeout = 30000) {
    const startTime = this.getDeterministicTimestamp();
    
    while (this.activeGenerations.size > 0 && (this.getDeterministicTimestamp() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeGenerations.size > 0) {
      this.logger.warn(`${this.activeGenerations.size} generations still active after timeout`);
    }
  }

  _setupEventHandlers() {
    // Template bridge event forwarding
    this.templateBridge.on('error', (error) => {
      this.emit('component:error', { component: 'template_bridge', error });
    });
    
    this.templateBridge.on('artifacts:generated', (event) => {
      this.emit('template_bridge:artifacts_generated', event);
    });
    
    // Component error handling
    if (this.semanticProcessor) {
      this.semanticProcessor.on('error', (error) => {
        this.emit('component:error', { component: 'semantic_processor', error });
      });
    }
    
    if (this.provenanceTracker) {
      this.provenanceTracker.on('error', (error) => {
        this.emit('component:error', { component: 'provenance_tracker', error });
      });
    }
  }

  getVersion() {
    return '1.0.0';
  }
}

export default EnhancedArtifactGenerator;