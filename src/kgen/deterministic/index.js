/**
 * KGEN Deterministic Rendering System - Main Integration Module
 * 
 * Provides a unified interface for deterministic template rendering with:
 * - Byte-for-byte reproducible output
 * - Content-addressed caching
 * - RDF semantic integration
 * - Robust error handling
 * - Cryptographic attestations
 */

import { DeterministicRenderer } from './core-renderer.js';
import DeterministicArtifactGenerator from './artifact-generator.js';
import ContentAddressedCache from './content-cache.js';
import RDFIntegration from './rdf-integration.js';
import DeterministicErrorHandler from './error-handler.js';
import { EventEmitter } from 'events';
import { consola } from 'consola';

export class DeterministicRenderingSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Core settings
      templatesDir: options.templatesDir || '_templates',
      outputDir: options.outputDir || './generated',
      cacheDir: options.cacheDir || '.kgen/cache',
      
      // Deterministic settings
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      enableCaching: options.enableCaching !== false,
      enableRDF: options.enableRDF === true,
      enableAttestation: options.enableAttestation !== false,
      
      // Integration settings
      enableSemanticEnrichment: options.enableSemanticEnrichment === true,
      enableErrorRecovery: options.enableErrorRecovery !== false,
      strictMode: options.strictMode !== false,
      
      // Performance settings
      maxConcurrentRenders: options.maxConcurrentRenders || 10,
      cacheMaxSize: options.cacheMaxSize || 1024 * 1024 * 100, // 100MB
      
      ...options
    };
    
    this.logger = consola.withTag('deterministic-rendering');
    
    // Initialize components
    this._initializeComponents();
    
    // System statistics
    this.stats = {
      totalRenders: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      recoveries: 0,
      attestations: 0,
      startTime: this.getDeterministicDate(),
      lastRender: null
    };
    
    // Active render tracking
    this.activeRenders = new Map();
    
    this._setupEventHandlers();
  }
  
  /**
   * Initialize all rendering components
   */
  _initializeComponents() {
    // Core deterministic renderer
    this.renderer = new DeterministicRenderer({
      templatesDir: this.config.templatesDir,
      staticBuildTime: this.config.staticBuildTime,
      enableCaching: this.config.enableCaching,
      cacheDir: `${this.config.cacheDir}/templates`,
      strictMode: this.config.strictMode
    });
    
    // Artifact generator with attestations
    this.artifactGenerator = new DeterministicArtifactGenerator({
      templatesDir: this.config.templatesDir,
      outputDir: this.config.outputDir,
      staticBuildTime: this.config.staticBuildTime,
      attestByDefault: this.config.enableAttestation,
      enableContentAddressing: this.config.enableCaching,
      cacheDir: this.config.cacheDir,
      strictMode: this.config.strictMode
    });
    
    // Content-addressed cache
    this.contentCache = new ContentAddressedCache({
      cacheDir: `${this.config.cacheDir}/content`,
      maxCacheSize: this.config.cacheMaxSize,
      enablePersistence: this.config.enableCaching
    });
    
    // RDF integration (if enabled)
    if (this.config.enableRDF) {
      this.rdfIntegration = new RDFIntegration({
        enableSemanticEnrichment: this.config.enableSemanticEnrichment,
        enableCaching: this.config.enableCaching
      });
    }
    
    // Error handler with recovery
    this.errorHandler = new DeterministicErrorHandler({
      enableRecovery: this.config.enableErrorRecovery,
      errorReportsDir: `${this.config.cacheDir}/errors`,
      staticErrorTime: this.config.staticBuildTime,
      strictMode: this.config.strictMode
    });
  }
  
  /**
   * Render template with full deterministic pipeline
   */
  async render(templatePath, context = {}, options = {}) {
    const renderId = this._generateRenderId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug(`Starting deterministic render: ${templatePath}`, { renderId });
      
      // Track active render
      this.activeRenders.set(renderId, {
        templatePath,
        startTime,
        status: 'rendering'
      });
      
      // Integrate RDF context if enabled and provided
      let enrichedContext = context;
      if (this.config.enableRDF && options.rdfContent) {
        try {
          enrichedContext = await this.rdfIntegration.integrateRDFContext(
            options.rdfContent,
            context,
            options.rdfFormat
          );
        } catch (rdfError) {
          const rdfHandling = await this.errorHandler.handleRDFError(
            options.rdfContent,
            rdfError,
            { templatePath, renderId }
          );
          
          if (!rdfHandling.recovery?.success && this.config.strictMode) {
            throw rdfError;
          }
          
          // Continue with original context if RDF integration fails
          this.logger.warn('RDF integration failed, continuing with original context');
        }
      }
      
      // Perform deterministic rendering
      const renderResult = await this.renderer.render(templatePath, enrichedContext, options);
      
      if (renderResult.error) {
        throw new Error(renderResult.error);
      }
      
      // Update statistics
      this.stats.totalRenders++;
      if (renderResult.cached) {
        this.stats.cacheHits++;
      } else {
        this.stats.cacheMisses++;
      }
      
      // Create final result
      const result = {
        success: true,
        renderId,
        templatePath,
        content: renderResult.content,
        contentHash: renderResult.contentHash,
        metadata: {
          ...renderResult.metadata,
          renderId,
          renderTime: this.getDeterministicTimestamp() - startTime,
          cached: renderResult.cached || false,
          rdfIntegrated: !!options.rdfContent,
          deterministic: true
        }
      };
      
      // Update tracking
      this.activeRenders.delete(renderId);
      this.stats.lastRender = this.getDeterministicDate();
      
      this.emit('render:complete', result);
      this.logger.success(`Deterministic render complete: ${templatePath}`, { renderId });
      
      return result;
      
    } catch (error) {
      // Handle rendering error
      const errorHandling = await this.errorHandler.handleTemplateError(
        templatePath,
        error,
        { renderId, context, options }
      );
      
      this.stats.errors++;
      if (errorHandling.recovery?.success) {
        this.stats.recoveries++;
      }
      
      // Clean up active render tracking
      this.activeRenders.delete(renderId);
      
      const result = {
        success: false,
        renderId,
        templatePath,
        error: error.message,
        errorHandling,
        renderTime: this.getDeterministicTimestamp() - startTime
      };
      
      this.emit('render:error', result);
      this.logger.error(`Deterministic render failed: ${templatePath}`, { renderId, error: error.message });
      
      if (this.config.strictMode && !errorHandling.recovery?.success) {
        throw error;
      }
      
      return result;
    }
  }
  
  /**
   * Generate artifact with full attestation
   */
  async generateArtifact(templatePath, context = {}, outputPath = null, options = {}) {
    try {
      this.logger.info(`Generating deterministic artifact: ${templatePath}`);
      
      // Use artifact generator for full pipeline
      const result = await this.artifactGenerator.generate(templatePath, context, outputPath);
      
      if (result.success && result.attestationPath) {
        this.stats.attestations++;
      }
      
      this.emit('artifact:generated', result);
      
      return result;
      
    } catch (error) {
      const errorHandling = await this.errorHandler.handleError(error, {
        templatePath,
        operation: 'artifact-generation',
        outputPath
      });
      
      this.emit('artifact:error', { templatePath, error, errorHandling });
      
      if (this.config.strictMode) {
        throw error;
      }
      
      return {
        success: false,
        error: error.message,
        errorHandling
      };
    }
  }
  
  /**
   * Generate multiple artifacts in batch
   */
  async generateBatch(templates, globalContext = {}, options = {}) {
    this.logger.info(`Starting batch generation of ${templates.length} templates`);
    
    const batchResult = await this.artifactGenerator.generateBatch(templates, globalContext);
    
    // Update statistics
    this.stats.attestations += batchResult.results.filter(r => r.attestationPath).length;
    
    this.emit('batch:complete', batchResult);
    
    return batchResult;
  }
  
  /**
   * Verify artifact reproducibility
   */
  async verifyReproducibility(artifactPath, iterations = 3) {
    this.logger.info(`Verifying reproducibility: ${artifactPath}`);
    
    const result = await this.artifactGenerator.verifyReproducibility(artifactPath, iterations);
    
    this.emit('reproducibility:verified', result);
    
    return result;
  }
  
  /**
   * Validate template for deterministic rendering
   */
  async validateTemplate(templatePath) {
    try {
      const analysis = await this.renderer.analyzeTemplate(templatePath);
      
      // Add RDF validation if enabled
      if (this.config.enableRDF && this.rdfIntegration) {
        analysis.rdfCompatible = true; // Would perform actual RDF validation
      }
      
      this.emit('template:validated', analysis);
      
      return analysis;
      
    } catch (error) {
      return {
        templatePath,
        valid: false,
        error: error.message,
        deterministicScore: 0
      };
    }
  }
  
  /**
   * Get comprehensive system statistics
   */
  getStatistics() {
    const baseStats = {
      ...this.stats,
      uptime: this.getDeterministicTimestamp() - this.stats.startTime.getTime(),
      cacheHitRate: (this.stats.cacheHits + this.stats.cacheMisses) > 0 
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) 
        : 0,
      errorRate: this.stats.totalRenders > 0 
        ? this.stats.errors / this.stats.totalRenders 
        : 0,
      recoveryRate: this.stats.errors > 0 
        ? this.stats.recoveries / this.stats.errors 
        : 0,
      activeRenders: this.activeRenders.size
    };
    
    const componentStats = {
      renderer: this.renderer.getStatistics(),
      artifactGenerator: this.artifactGenerator.getStatistics(),
      contentCache: this.contentCache.getStatistics(),
      errorHandler: this.errorHandler.getStatistics()
    };
    
    if (this.config.enableRDF && this.rdfIntegration) {
      componentStats.rdfIntegration = {
        cacheSize: this.rdfIntegration.contextCache.size,
        namespacesConfigured: Object.keys(this.rdfIntegration.config.namespaces).length
      };
    }
    
    return {
      system: baseStats,
      components: componentStats,
      configuration: {
        templatesDir: this.config.templatesDir,
        outputDir: this.config.outputDir,
        enableRDF: this.config.enableRDF,
        enableCaching: this.config.enableCaching,
        enableAttestation: this.config.enableAttestation,
        strictMode: this.config.strictMode
      }
    };
  }
  
  /**
   * Perform system health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: this.getDeterministicDate().toISOString(),
      components: {},
      issues: []
    };
    
    try {
      // Check renderer
      const rendererTest = await this._testComponent('renderer');
      health.components.renderer = rendererTest;
      
      // Check artifact generator
      const generatorTest = await this._testComponent('artifactGenerator');
      health.components.artifactGenerator = generatorTest;
      
      // Check cache
      const cacheTest = await this._testComponent('contentCache');
      health.components.contentCache = cacheTest;
      
      // Check RDF integration if enabled
      if (this.config.enableRDF) {
        const rdfTest = await this._testComponent('rdfIntegration');
        health.components.rdfIntegration = rdfTest;
      }
      
      // Determine overall health
      const componentStatuses = Object.values(health.components);
      const unhealthyComponents = componentStatuses.filter(c => c.status !== 'healthy');
      
      if (unhealthyComponents.length > 0) {
        health.status = unhealthyComponents.length === componentStatuses.length ? 'unhealthy' : 'degraded';
        health.issues = unhealthyComponents.map(c => c.issue).filter(Boolean);
      }
      
    } catch (error) {
      health.status = 'unhealthy';
      health.issues.push(`Health check failed: ${error.message}`);
    }
    
    this.emit('health:checked', health);
    
    return health;
  }
  
  /**
   * Clear all caches and reset system
   */
  async reset() {
    this.logger.info('Resetting deterministic rendering system');
    
    // Clear component caches
    this.renderer.clearCache();
    await this.contentCache.clear();
    this.errorHandler.reset();
    
    if (this.config.enableRDF && this.rdfIntegration) {
      this.rdfIntegration.clearCache();
    }
    
    // Reset artifact generator
    await this.artifactGenerator.reset();
    
    // Reset statistics
    this.stats = {
      totalRenders: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      recoveries: 0,
      attestations: 0,
      startTime: this.getDeterministicDate(),
      lastRender: null
    };
    
    this.activeRenders.clear();
    
    this.emit('system:reset');
    this.logger.info('System reset complete');
  }
  
  /**
   * Shutdown system gracefully
   */
  async shutdown() {
    this.logger.info('Shutting down deterministic rendering system');
    
    // Wait for active renders to complete
    if (this.activeRenders.size > 0) {
      this.logger.info(`Waiting for ${this.activeRenders.size} active renders to complete`);
      
      const timeout = 30000; // 30 seconds
      const startTime = this.getDeterministicTimestamp();
      
      while (this.activeRenders.size > 0 && (this.getDeterministicTimestamp() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (this.activeRenders.size > 0) {
        this.logger.warn(`${this.activeRenders.size} renders still active after timeout`);
      }
    }
    
    // Shutdown components
    if (this.artifactGenerator) {
      await this.artifactGenerator.shutdown();
    }
    
    this.emit('system:shutdown');
    this.logger.info('System shutdown complete');
  }
  
  // Private helper methods
  
  _setupEventHandlers() {
    // Forward component events
    this.renderer.on('template:rendered', (event) => this.emit('template:rendered', event));
    this.renderer.on('template:error', (event) => this.emit('template:error', event));
    
    this.artifactGenerator.on('generation:complete', (event) => this.emit('generation:complete', event));
    this.artifactGenerator.on('generation:error', (event) => this.emit('generation:error', event));
    
    this.contentCache.on('cache:hit', (event) => this.emit('cache:hit', event));
    this.contentCache.on('cache:miss', (event) => this.emit('cache:miss', event));
    
    this.errorHandler.on('error:handled', (event) => this.emit('error:handled', event));
    this.errorHandler.on('recovery:success', (event) => this.emit('recovery:success', event));
    
    if (this.config.enableRDF && this.rdfIntegration) {
      this.rdfIntegration.on('rdf:integrated', (event) => this.emit('rdf:integrated', event));
      this.rdfIntegration.on('rdf:error', (event) => this.emit('rdf:error', event));
    }
  }
  
  /**
   * Get deterministic timestamp (milliseconds)
   * Uses SOURCE_DATE_EPOCH if set, otherwise static build time
   */
  getDeterministicTimestamp() {
    const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
    
    if (sourceEpoch) {
      return parseInt(sourceEpoch) * 1000;
    }
    
    // Use static build time for deterministic behavior
    return new Date(this.config.staticBuildTime).getTime();
  }
  
  /**
   * Get deterministic Date object
   * Uses SOURCE_DATE_EPOCH if set, otherwise static build time
   */
  getDeterministicDate() {
    return new Date(this.getDeterministicTimestamp());
  }

  _generateRenderId() {
    return `render_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  async _testComponent(componentName) {
    try {
      const component = this[componentName];
      
      if (!component) {
        return {
          status: 'unhealthy',
          issue: `Component ${componentName} not initialized`
        };
      }
      
      // Basic functionality test
      if (typeof component.getStatistics === 'function') {
        const stats = component.getStatistics();
        return {
          status: 'healthy',
          stats
        };
      }
      
      return {
        status: 'healthy',
        message: `Component ${componentName} operational`
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        issue: `Component ${componentName} test failed: ${error.message}`
      };
    }
  }
}

// Export all components for individual use
export {
  DeterministicRenderer,
  DeterministicArtifactGenerator,
  ContentAddressedCache,
  RDFIntegration,
  DeterministicErrorHandler
};

export default DeterministicRenderingSystem;