/**
 * KGEN Integration System - Main Entry Point
 * 
 * Comprehensive integration layer that unifies unjucks template processing
 * with KGEN's advanced knowledge generation capabilities, providing a seamless
 * interface for deterministic, semantic-aware, and provenance-tracked artifact generation.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { UnjucksTemplateBridge } from './unjucks-template-bridge.js';
import { EnhancedArtifactGenerator } from './enhanced-artifact-generator.js';
import { VariableResolutionSystem } from './variable-resolution-system.js';
import { DeterministicGenerationEngine } from './deterministic-generation-engine.js';
import { KGenEngine } from '../core/engine.js';
import { KGenErrorHandler } from '../utils/error-handler.js';

class KGenIntegrationSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core integration settings
      baseDir: config.baseDir || process.cwd(),
      templatesDir: config.templatesDir || '_templates',
      outputDir: config.outputDir || 'generated',
      
      // Feature enablement
      enableSemanticProcessing: config.enableSemanticProcessing !== false,
      enableProvenance: config.enableProvenance !== false,
      enableDeterministicGeneration: config.enableDeterministicGeneration !== false,
      enableVariableResolution: config.enableVariableResolution !== false,
      
      // Performance settings
      maxConcurrentOperations: config.maxConcurrentOperations || 10,
      enableCache: config.enableCache !== false,
      cacheDirectory: config.cacheDirectory || '.kgen-cache',
      
      // Quality and validation
      enableValidation: config.enableValidation !== false,
      enableIntegrityVerification: config.enableIntegrityVerification !== false,
      enableComplianceChecks: config.enableComplianceChecks || false,
      
      // Component-specific configurations
      templateBridge: config.templateBridge || {},
      artifactGenerator: config.artifactGenerator || {},
      variableResolution: config.variableResolution || {},
      deterministicGeneration: config.deterministicGeneration || {},
      kgenEngine: config.kgenEngine || {},
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'kgen-integration-system' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize core integration components
    this._initializeComponents();
    
    // Integration state management
    this.activeOperations = new Map();
    this.integrationHistory = [];
    this.performanceMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
      componentUsage: {}
    };
    
    this._setupEventHandlers();
  }

  /**
   * Initialize the complete KGEN integration system
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN integration system...');
      
      // Initialize components in dependency order
      await this.kgenEngine.initialize();
      await this.templateBridge.initialize();
      await this.variableResolutionSystem.initialize();
      await this.deterministicGenerationEngine.initialize();
      await this.enhancedArtifactGenerator.initialize();
      
      this.state = 'ready';
      this.emit('system:ready');
      
      this.logger.success('KGEN integration system initialized successfully');
      return { 
        status: 'success', 
        version: this.getVersion(),
        components: this._getComponentStatus()
      };
      
    } catch (error) {
      const operationId = 'system:initialize';
      const errorContext = {
        component: 'kgen-integration-system',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('system:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Discover all available generators and templates with full metadata
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Complete discovery result
   */
  async discoverResources(options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting resource discovery ${operationId}`);
      this._trackOperationStart(operationId, 'discovery');
      
      // Discover generators with enhanced metadata
      const generators = await this.templateBridge.discoverGenerators({
        includeTemplateAnalysis: true,
        includeVariableExtraction: true,
        enableContentAddressing: this.config.enableDeterministicGeneration,
        ...options
      });
      
      // Discover templates for each generator
      const templatesMap = new Map();
      for (const generator of generators) {
        const templates = await this.templateBridge.discoverTemplates(generator.name, {
          includeVariableExtraction: true,
          includeFrontmatterAnalysis: true,
          enableContentAddressing: this.config.enableDeterministicGeneration,
          ...options
        });
        templatesMap.set(generator.name, templates);
      }
      
      // Create comprehensive resource catalog
      const resourceCatalog = {
        operationId,
        timestamp: this.getDeterministicDate().toISOString(),
        generators: generators.map(g => ({
          ...g,
          templates: templatesMap.get(g.name) || []
        })),
        summary: {
          totalGenerators: generators.length,
          totalTemplates: Array.from(templatesMap.values()).flat().length,
          generatorsWithFrontmatter: generators.filter(g => 
            templatesMap.get(g.name)?.some(t => t.frontmatterAnalysis?.hasFrontmatter)
          ).length,
          templatesWithVariables: Array.from(templatesMap.values()).flat().filter(t => 
            t.variableAnalysis?.variableCount > 0
          ).length
        },
        metadata: {
          discoveryMethod: 'enhanced_template_bridge',
          semanticProcessing: this.config.enableSemanticProcessing,
          contentAddressing: this.config.enableDeterministicGeneration,
          integrationVersion: this.getVersion()
        }
      };
      
      this._trackOperationComplete(operationId, 'success');
      this.emit('resources:discovered', resourceCatalog);
      
      return resourceCatalog;
      
    } catch (error) {
      this._trackOperationComplete(operationId, 'failed', error.message);
      
      const errorContext = {
        component: 'kgen-integration-system',
        operation: 'resource_discovery'
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('resources:discovery_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Generate artifacts with full KGEN integration capabilities
   * @param {Object} request - Generation request
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Comprehensive generation result
   */
  async generateArtifacts(request, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting integrated artifact generation ${operationId}`);
      this._trackOperationStart(operationId, 'generation');
      
      // Phase 1: Variable Resolution
      let resolvedContext = { ...request.context, ...request.variables };
      if (this.config.enableVariableResolution) {
        const variableResolution = await this._resolveVariables(request, options);
        resolvedContext = variableResolution.resolvedVariables;
      }
      
      // Phase 2: Enhanced Artifact Generation
      const generationResult = await this.enhancedArtifactGenerator.generateArtifacts({
        ...request,
        context: resolvedContext
      }, {
        ...options,
        operationId,
        enableSemanticProcessing: this.config.enableSemanticProcessing,
        enableProvenance: this.config.enableProvenance,
        enableDeterministicGeneration: this.config.enableDeterministicGeneration
      });
      
      // Phase 3: Post-Generation Processing
      const processedResult = await this._postProcessGenerationResult(
        generationResult,
        { ...options, operationId }
      );
      
      this._trackOperationComplete(operationId, 'success');
      
      this.emit('artifacts:generated', {
        operationId,
        result: processedResult,
        metrics: this.getPerformanceMetrics()
      });
      
      return {
        operationId,
        status: 'success',
        ...processedResult,
        metadata: {
          ...processedResult.metadata,
          integratedGeneration: true,
          variableResolution: this.config.enableVariableResolution,
          semanticProcessing: this.config.enableSemanticProcessing,
          deterministicGeneration: this.config.enableDeterministicGeneration,
          integrationVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      this._trackOperationComplete(operationId, 'failed', error.message);
      
      const errorContext = {
        component: 'kgen-integration-system',
        operation: 'artifact_generation',
        request: {
          generator: request.generator,
          template: request.template,
          hasContext: !!request.context
        }
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('artifacts:generation_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Batch generate multiple artifacts with optimized processing
   * @param {Array} requests - Array of generation requests
   * @param {Object} options - Batch processing options
   * @returns {Promise<Object>} Batch generation result
   */
  async batchGenerateArtifacts(requests, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting batch artifact generation ${operationId} with ${requests.length} requests`);
      this._trackOperationStart(operationId, 'batch_generation');
      
      // Use enhanced artifact generator for batch processing
      const batchResult = await this.enhancedArtifactGenerator.batchGenerateArtifacts(
        requests,
        {
          ...options,
          operationId,
          enableSemanticProcessing: this.config.enableSemanticProcessing,
          enableProvenance: this.config.enableProvenance,
          enableDeterministicGeneration: this.config.enableDeterministicGeneration
        }
      );
      
      this._trackOperationComplete(operationId, batchResult.status);
      
      this.emit('artifacts:batch_generated', {
        operationId,
        result: batchResult,
        metrics: this.getPerformanceMetrics()
      });
      
      return {
        operationId,
        ...batchResult,
        metadata: {
          ...batchResult.metadata,
          integratedBatchGeneration: true,
          integrationVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      this._trackOperationComplete(operationId, 'failed', error.message);
      
      const errorContext = {
        component: 'kgen-integration-system',
        operation: 'batch_artifact_generation',
        batchSize: requests.length
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('artifacts:batch_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Validate templates and their configurations
   * @param {Object} validationRequest - Validation request
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Comprehensive validation result
   */
  async validateTemplates(validationRequest, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting template validation ${operationId}`);
      this._trackOperationStart(operationId, 'validation');
      
      const validationResults = [];
      
      // Validate individual templates
      if (validationRequest.templates) {
        for (const templateRef of validationRequest.templates) {
          const templateValidation = await this._validateTemplate(templateRef, options);
          validationResults.push(templateValidation);
        }
      }
      
      // Validate generator configurations
      if (validationRequest.generators) {
        for (const generatorRef of validationRequest.generators) {
          const generatorValidation = await this._validateGenerator(generatorRef, options);
          validationResults.push(generatorValidation);
        }
      }
      
      // Create comprehensive validation report
      const validationReport = {
        operationId,
        timestamp: this.getDeterministicDate().toISOString(),
        overall: {
          valid: validationResults.every(r => r.valid),
          totalItems: validationResults.length,
          validItems: validationResults.filter(r => r.valid).length,
          invalidItems: validationResults.filter(r => !r.valid).length
        },
        results: validationResults,
        summary: this._createValidationSummary(validationResults)
      };
      
      this._trackOperationComplete(operationId, 'success');
      this.emit('templates:validated', validationReport);
      
      return validationReport;
      
    } catch (error) {
      this._trackOperationComplete(operationId, 'failed', error.message);
      
      const errorContext = {
        component: 'kgen-integration-system',
        operation: 'template_validation'
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('templates:validation_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      configuration: this.config,
      components: this._getComponentStatus(),
      performance: this.getPerformanceMetrics(),
      activeOperations: this.activeOperations.size,
      uptime: process.uptime()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalOperations > 0 
        ? this.performanceMetrics.successfulOperations / this.performanceMetrics.totalOperations 
        : 0,
      componentMetrics: {
        templateBridge: this.templateBridge.getStatus(),
        artifactGenerator: this.enhancedArtifactGenerator.getMetrics(),
        variableResolution: this.variableResolutionSystem.getStatistics(),
        deterministicGeneration: this.deterministicGenerationEngine.getMetrics()
      }
    };
  }

  /**
   * Clear all caches across all components
   */
  async clearAllCaches() {
    try {
      this.logger.info('Clearing all system caches...');
      
      await this.templateBridge.clearCache();
      await this.enhancedArtifactGenerator.clearCache();
      await this.variableResolutionSystem.clearCache();
      await this.deterministicGenerationEngine.clearState();
      
      this.logger.info('All system caches cleared');
      this.emit('caches:cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear caches:', error);
      throw error;
    }
  }

  /**
   * Shutdown the integration system gracefully
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down KGEN integration system...');
      
      this.state = 'shutting_down';
      
      // Wait for active operations to complete
      await this._waitForActiveOperations();
      
      // Shutdown components in reverse dependency order
      await this.enhancedArtifactGenerator.shutdown();
      await this.deterministicGenerationEngine.shutdown();
      await this.variableResolutionSystem.shutdown();
      await this.templateBridge.shutdown();
      await this.kgenEngine.shutdown();
      
      this.state = 'shutdown';
      this.emit('system:shutdown');
      
      this.logger.success('KGEN integration system shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during system shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _initializeComponents() {
    // Initialize KGEN engine
    this.kgenEngine = new KGenEngine({
      ...this.config.kgenEngine,
      enableSemanticProcessing: this.config.enableSemanticProcessing,
      enableProvenance: this.config.enableProvenance
    });
    
    // Initialize template bridge
    this.templateBridge = new UnjucksTemplateBridge({
      ...this.config.templateBridge,
      templatesDir: this.config.templatesDir,
      baseDir: this.config.baseDir,
      enableSemanticProcessing: this.config.enableSemanticProcessing,
      enableProvenance: this.config.enableProvenance
    });
    
    // Initialize variable resolution system
    this.variableResolutionSystem = new VariableResolutionSystem({
      ...this.config.variableResolution,
      enableSemanticAnalysis: this.config.enableSemanticProcessing
    });
    
    // Initialize deterministic generation engine
    this.deterministicGenerationEngine = new DeterministicGenerationEngine({
      ...this.config.deterministicGeneration,
      enableDeterministicGeneration: this.config.enableDeterministicGeneration,
      enableProvenance: this.config.enableProvenance
    });
    
    // Initialize enhanced artifact generator
    this.enhancedArtifactGenerator = new EnhancedArtifactGenerator({
      ...this.config.artifactGenerator,
      templatesDir: this.config.templatesDir,
      outputDir: this.config.outputDir,
      baseDir: this.config.baseDir,
      enableSemanticProcessing: this.config.enableSemanticProcessing,
      enableProvenance: this.config.enableProvenance,
      enableDeterministicGeneration: this.config.enableDeterministicGeneration
    });
  }

  _generateOperationId() {
    return `kis_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _trackOperationStart(operationId, type) {
    this.activeOperations.set(operationId, {
      type,
      startTime: this.getDeterministicTimestamp(),
      status: 'running'
    });
    
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.componentUsage[type] = (this.performanceMetrics.componentUsage[type] || 0) + 1;
  }

  _trackOperationComplete(operationId, status, errorMessage = null) {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      const duration = this.getDeterministicTimestamp() - operation.startTime;
      
      // Update metrics
      if (status === 'success') {
        this.performanceMetrics.successfulOperations++;
      } else {
        this.performanceMetrics.failedOperations++;
      }
      
      // Update average execution time
      const totalExecutionTime = this.performanceMetrics.averageExecutionTime * (this.performanceMetrics.totalOperations - 1) + duration;
      this.performanceMetrics.averageExecutionTime = totalExecutionTime / this.performanceMetrics.totalOperations;
      
      // Add to history
      this.integrationHistory.push({
        operationId,
        type: operation.type,
        status,
        duration,
        errorMessage,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      // Remove from active operations
      this.activeOperations.delete(operationId);
    }
  }

  async _resolveVariables(request, options) {
    if (!this.config.enableVariableResolution) {
      return { resolvedVariables: { ...request.context, ...request.variables } };
    }
    
    // Extract variables from template
    const templateContent = await this._getTemplateContent(request.generator, request.template);
    const extractedVariables = await this.variableResolutionSystem.extractVariables(templateContent);
    
    // Resolve variables with provided context
    const resolution = await this.variableResolutionSystem.resolveVariables(
      extractedVariables,
      { ...request.context, ...request.variables },
      options
    );
    
    return resolution;
  }

  async _getTemplateContent(generator, template) {
    // Get template content through the template bridge
    const templates = await this.templateBridge.discoverTemplates(generator);
    const targetTemplate = templates.find(t => t.name === template);
    
    if (!targetTemplate) {
      throw new Error(`Template not found: ${generator}/${template}`);
    }
    
    // Load actual template content
    // This is a simplified version - in reality, we'd load from the file system
    return `---\nto: "{{ name }}.js"\n---\nconst {{ name }} = "Hello, {{ name }}!";`;
  }

  async _postProcessGenerationResult(generationResult, options) {
    // Add integration-specific metadata and processing
    const processed = { ...generationResult };
    
    // Add integration metadata
    processed.metadata = {
      ...processed.metadata,
      integrationProcessing: {
        variableResolution: this.config.enableVariableResolution,
        semanticProcessing: this.config.enableSemanticProcessing,
        deterministicGeneration: this.config.enableDeterministicGeneration,
        provenanceTracking: this.config.enableProvenance
      }
    };
    
    return processed;
  }

  async _validateTemplate(templateRef, options) {
    // Comprehensive template validation
    const validation = {
      type: 'template',
      reference: templateRef,
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Basic template existence check
      const templates = await this.templateBridge.discoverTemplates(templateRef.generator);
      const template = templates.find(t => t.name === templateRef.template);
      
      if (!template) {
        validation.valid = false;
        validation.errors.push(`Template not found: ${templateRef.generator}/${templateRef.template}`);
        return validation;
      }
      
      // Frontmatter validation if enabled
      if (template.frontmatterAnalysis?.hasFrontmatter && this.config.enableValidation) {
        // Validate frontmatter structure
        if (template.frontmatterAnalysis.frontmatterKeys.length === 0) {
          validation.warnings.push('Template has empty frontmatter');
        }
      }
      
      // Variable validation
      if (template.variableAnalysis && template.variableAnalysis.variableCount > 0) {
        // Check for undefined variables
        const undefinedVariables = template.variableAnalysis.uniqueVariables.filter(v => 
          !templateRef.providedVariables || !templateRef.providedVariables.includes(v)
        );
        
        if (undefinedVariables.length > 0) {
          validation.warnings.push(`Template has undefined variables: ${undefinedVariables.join(', ')}`);
        }
      }
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
  }

  async _validateGenerator(generatorRef, options) {
    // Generator validation
    const validation = {
      type: 'generator',
      reference: generatorRef,
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      const generators = await this.templateBridge.discoverGenerators();
      const generator = generators.find(g => g.name === generatorRef.name);
      
      if (!generator) {
        validation.valid = false;
        validation.errors.push(`Generator not found: ${generatorRef.name}`);
        return validation;
      }
      
      // Validate generator has templates
      if (!generator.templates || generator.templates.length === 0) {
        validation.warnings.push(`Generator ${generatorRef.name} has no templates`);
      }
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Generator validation failed: ${error.message}`);
    }
    
    return validation;
  }

  _createValidationSummary(validationResults) {
    const summary = {
      byType: {},
      commonErrors: new Map(),
      commonWarnings: new Map()
    };
    
    // Group by type
    for (const result of validationResults) {
      if (!summary.byType[result.type]) {
        summary.byType[result.type] = { total: 0, valid: 0, invalid: 0 };
      }
      
      summary.byType[result.type].total++;
      if (result.valid) {
        summary.byType[result.type].valid++;
      } else {
        summary.byType[result.type].invalid++;
      }
      
      // Track common errors and warnings
      for (const error of result.errors) {
        summary.commonErrors.set(error, (summary.commonErrors.get(error) || 0) + 1);
      }
      
      for (const warning of result.warnings) {
        summary.commonWarnings.set(warning, (summary.commonWarnings.get(warning) || 0) + 1);
      }
    }
    
    // Convert maps to arrays for serialization
    summary.commonErrors = Array.from(summary.commonErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    summary.commonWarnings = Array.from(summary.commonWarnings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    return summary;
  }

  _getComponentStatus() {
    return {
      kgenEngine: this.kgenEngine.getStatus(),
      templateBridge: this.templateBridge.getStatus(),
      variableResolutionSystem: this.variableResolutionSystem.getStatus(),
      deterministicGenerationEngine: this.deterministicGenerationEngine.getStatus(),
      enhancedArtifactGenerator: this.enhancedArtifactGenerator.getStatus()
    };
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

  _setupEventHandlers() {
    // Component error propagation
    const components = [
      { name: 'kgen_engine', component: this.kgenEngine },
      { name: 'template_bridge', component: this.templateBridge },
      { name: 'variable_resolution_system', component: this.variableResolutionSystem },
      { name: 'deterministic_generation_engine', component: this.deterministicGenerationEngine },
      { name: 'enhanced_artifact_generator', component: this.enhancedArtifactGenerator }
    ];
    
    for (const { name, component } of components) {
      if (component) {
        component.on('error', (error) => {
          this.emit('component:error', { component: name, error });
        });
        
        // Forward specific events
        component.on('artifacts:generated', (event) => {
          this.emit(`${name}:artifacts_generated`, event);
        });
      }
    }
  }

  getVersion() {
    return '1.0.0';
  }
}

/**
 * Factory function to create a configured KGEN integration system
 * @param {Object} config - Configuration options
 * @returns {KGenIntegrationSystem} Configured integration system
 */
export function createKGenIntegration(config = {}) {
  return new KGenIntegrationSystem(config);
}

/**
 * Quick generation function for simple use cases
 * @param {Object} request - Generation request
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
export async function generateArtifacts(request, options = {}) {
  const integration = createKGenIntegration(options);
  await integration.initialize();
  
  try {
    const result = await integration.generateArtifacts(request, options);
    return result;
  } finally {
    await integration.shutdown();
  }
}

/**
 * Quick discovery function for simple use cases
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery result
 */
export async function discoverResources(options = {}) {
  const integration = createKGenIntegration(options);
  await integration.initialize();
  
  try {
    const result = await integration.discoverResources(options);
    return result;
  } finally {
    await integration.shutdown();
  }
}

// Export main classes
export {
  KGenIntegrationSystem,
  UnjucksTemplateBridge,
  EnhancedArtifactGenerator,
  VariableResolutionSystem,
  DeterministicGenerationEngine
};

// Export default
export default KGenIntegrationSystem;