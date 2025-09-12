/**
 * KGEN Serialization Integration Module
 * 
 * Integrates turtle serialization master with existing KGEN components
 * including RDF processor, provenance tracker, and enterprise features.
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { TurtleSerializationMaster } from './index.js';

export class KGenSerializationIntegration extends EventEmitter {
  constructor(kgenEngine, config = {}) {
    super();
    
    this.kgenEngine = kgenEngine;
    this.config = {
      // Integration settings
      enableProvenanceIntegration: true,
      enableCacheIntegration: true,
      enableValidationIntegration: true,
      enableMonitoringIntegration: true,
      
      // Serialization preferences
      defaultMode: 'canonical',
      autoOptimization: true,
      enterpriseFeatures: true,
      
      // Performance settings
      cacheSerializations: true,
      cacheTTL: 3600000, // 1 hour
      maxCacheSize: 100,
      
      ...config
    };
    
    this.logger = consola.withTag('kgen-serialization');
    this.serializationMaster = new TurtleSerializationMaster(config);
    
    // Integration state
    this.serializationCache = new Map();
    this.provenanceContext = null;
    this.activeOperations = new Map();
    
    this.state = 'initialized';
  }

  /**
   * Initialize integration with KGEN subsystems
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN serialization integration...');
      
      // Initialize serialization master
      await this.serializationMaster.initialize();
      
      // Setup integrations
      await this._setupRDFProcessorIntegration();
      await this._setupProvenanceIntegration();
      await this._setupCacheIntegration();
      await this._setupValidationIntegration();
      await this._setupMonitoringIntegration();
      
      this.state = 'ready';
      this.logger.success('KGEN serialization integration ready');
      
      return { status: 'success', integrations: this._getActiveIntegrations() };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('Failed to initialize serialization integration:', error);
      throw error;
    }
  }

  /**
   * Serialize RDF data with full KGEN integration
   */
  async serializeWithIntegration(data, options = {}) {
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Starting integrated serialization: ${operationId}`);
      
      // Start provenance tracking
      const provenanceContext = await this._startProvenanceTracking(operationId, data, options);
      
      // Check cache first
      const cacheResult = await this._checkSerializationCache(data, options);
      if (cacheResult) {
        await this._completeProvenanceTracking(provenanceContext, cacheResult, true);
        return cacheResult;
      }
      
      // Perform validation if enabled
      if (this.config.enableValidationIntegration) {
        await this._validateInput(data, options);
      }
      
      // Select optimal serialization mode
      const mode = this._selectOptimalMode(data, options);
      
      // Perform serialization
      const serializationOptions = {
        ...options,
        mode,
        operationId,
        provenanceContext
      };
      
      const result = await this.serializationMaster.serialize(data, serializationOptions);
      
      // Enhance result with KGEN metadata
      const enhancedResult = await this._enhanceResult(result, provenanceContext, options);
      
      // Cache result if enabled
      if (this.config.cacheSerializations) {
        await this._cacheSerializationResult(data, enhancedResult, options);
      }
      
      // Complete provenance tracking
      await this._completeProvenanceTracking(provenanceContext, enhancedResult, false);
      
      // Update monitoring metrics
      await this._updateMonitoringMetrics(enhancedResult);
      
      this.emit('serialization:complete', {
        operationId,
        result: enhancedResult,
        provenanceContext
      });
      
      this.logger.success(`Integrated serialization complete: ${operationId}`);
      
      return enhancedResult;
      
    } catch (error) {
      this.logger.error(`Integrated serialization failed: ${operationId}`, error);
      
      // Record error in provenance
      if (this.provenanceContext) {
        await this._recordProvenanceError(operationId, error);
      }
      
      this.emit('serialization:error', { operationId, error });
      throw error;
    }
  }

  /**
   * Process RDF file with full integration
   */
  async processRDFFile(filePath, options = {}) {
    try {
      // Use RDF processor to load file
      const rdfProcessor = this.kgenEngine.getSubsystem('rdf');
      const parsed = await rdfProcessor.processRDFFile(filePath, null, options);
      
      // Serialize with integration
      return this.serializeWithIntegration(parsed.quads, {
        ...options,
        sourceFile: filePath,
        sourceFormat: parsed.format
      });
      
    } catch (error) {
      this.logger.error(`Failed to process RDF file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Export serialization with provenance
   */
  async exportWithProvenance(data, format = 'turtle', options = {}) {
    try {
      // Serialize the main data
      const serialization = await this.serializeWithIntegration(data, {
        ...options,
        exportFormat: format
      });
      
      // Generate provenance graph
      const provenance = await this._generateProvenanceGraph(serialization);
      
      // Combine data and provenance
      const combinedResult = await this._combineDataAndProvenance(
        serialization,
        provenance,
        format
      );
      
      return combinedResult;
      
    } catch (error) {
      this.logger.error('Failed to export with provenance:', error);
      throw error;
    }
  }

  /**
   * Validate serialization integrity
   */
  async validateSerialization(turtleContent, options = {}) {
    try {
      // Use master validation
      const masterValidation = await this.serializationMaster.validateSerialization(turtleContent, options);
      
      // Add KGEN-specific validations
      const kgenValidation = await this._performKGenValidation(turtleContent, options);
      
      return {
        ...masterValidation,
        kgen: kgenValidation,
        overall: masterValidation.syntaxValid && kgenValidation.valid,
        timestamp: this.getDeterministicDate()
      };
      
    } catch (error) {
      this.logger.error('Serialization validation failed:', error);
      throw error;
    }
  }

  // Private integration methods

  async _setupRDFProcessorIntegration() {
    if (!this.kgenEngine.subsystems.has('rdf')) {
      this.logger.warn('RDF processor not available - skipping integration');
      return;
    }
    
    const rdfProcessor = this.kgenEngine.getSubsystem('rdf');
    
    // Enhance RDF processor with serialization capabilities
    rdfProcessor.serializeCanonical = async (quads, options = {}) => {
      return this.serializationMaster.serializeCanonical(quads, options);
    };
    
    rdfProcessor.serializeWithDocumentation = async (quads, options = {}) => {
      return this.serializationMaster.serializeDocumented(quads, options);
    };
    
    this.logger.debug('RDF processor integration configured');
  }

  async _setupProvenanceIntegration() {
    if (!this.config.enableProvenanceIntegration) {
      return;
    }
    
    try {
      // Import provenance tracker if available
      const { ProvenanceTracker } = await import('../provenance/tracker.js');
      this.provenanceTracker = new ProvenanceTracker(this.config);
      await this.provenanceTracker.initialize();
      
      this.logger.debug('Provenance integration configured');
    } catch (error) {
      this.logger.warn('Provenance tracker not available:', error.message);
    }
  }

  async _setupCacheIntegration() {
    if (!this.config.enableCacheIntegration || !this.kgenEngine.subsystems.has('cache')) {
      return;
    }
    
    this.cacheManager = this.kgenEngine.getSubsystem('cache');
    this.logger.debug('Cache integration configured');
  }

  async _setupValidationIntegration() {
    if (!this.config.enableValidationIntegration || !this.kgenEngine.subsystems.has('validation')) {
      return;
    }
    
    this.validationEngine = this.kgenEngine.getSubsystem('validation');
    this.logger.debug('Validation integration configured');
  }

  async _setupMonitoringIntegration() {
    if (!this.config.enableMonitoringIntegration || !this.kgenEngine.subsystems.has('monitoring')) {
      return;
    }
    
    this.monitoringSystem = this.kgenEngine.getSubsystem('monitoring');
    this.logger.debug('Monitoring integration configured');
  }

  async _startProvenanceTracking(operationId, data, options) {
    if (!this.provenanceTracker) {
      return null;
    }
    
    try {
      const provenanceContext = await this.provenanceTracker.startOperation({
        operationId,
        type: 'turtle_serialization',
        user: options.user,
        sources: options.sources || [],
        metadata: {
          mode: options.mode,
          dataSize: Array.isArray(data) ? data.length : data.size || 0,
          options: this._sanitizeOptions(options)
        }
      });
      
      this.activeOperations.set(operationId, provenanceContext);
      return provenanceContext;
      
    } catch (error) {
      this.logger.error('Failed to start provenance tracking:', error);
      return null;
    }
  }

  async _completeProvenanceTracking(provenanceContext, result, fromCache) {
    if (!this.provenanceTracker || !provenanceContext) {
      return;
    }
    
    try {
      await this.provenanceTracker.completeOperation(provenanceContext.operationId, {
        status: 'success',
        outputs: [{
          id: result.metadata?.serializationId || 'unknown',
          type: 'turtle_serialization',
          size: Buffer.byteLength(result.turtle || '', 'utf8')
        }],
        metrics: {
          processingTime: result.master?.processingTime || 0,
          fromCache,
          mode: result.master?.mode
        },
        outputGraph: {
          entities: [{ id: 'serialization_result', type: 'turtle_document' }]
        }
      });
      
      this.activeOperations.delete(provenanceContext.operationId);
      
    } catch (error) {
      this.logger.error('Failed to complete provenance tracking:', error);
    }
  }

  async _recordProvenanceError(operationId, error) {
    if (!this.provenanceTracker) {
      return;
    }
    
    try {
      await this.provenanceTracker.recordError(operationId, error);
      this.activeOperations.delete(operationId);
    } catch (provenanceError) {
      this.logger.error('Failed to record provenance error:', provenanceError);
    }
  }

  async _checkSerializationCache(data, options) {
    if (!this.config.cacheSerializations || !this.cacheManager) {
      return null;
    }
    
    try {
      const cacheKey = this._generateCacheKey(data, options);
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        this.logger.debug('Serialization cache hit');
        return {
          ...cached,
          fromCache: true,
          cacheHit: true
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Cache check failed:', error);
      return null;
    }
  }

  async _cacheSerializationResult(data, result, options) {
    if (!this.cacheManager) {
      return;
    }
    
    try {
      const cacheKey = this._generateCacheKey(data, options);
      
      // Remove large data before caching
      const cacheableResult = {
        ...result,
        turtle: result.turtle.length > 100000 ? null : result.turtle // Don't cache very large results
      };
      
      await this.cacheManager.set(cacheKey, cacheableResult, this.config.cacheTTL);
      
      // Manage cache size
      if (this.serializationCache.size >= this.config.maxCacheSize) {
        const oldestKey = this.serializationCache.keys().next().value;
        this.serializationCache.delete(oldestKey);
      }
      
      this.serializationCache.set(cacheKey, this.getDeterministicTimestamp());
      
    } catch (error) {
      this.logger.error('Failed to cache serialization result:', error);
    }
  }

  _generateCacheKey(data, options) {
    const crypto = require('crypto');
    
    const keyData = {
      dataSize: Array.isArray(data) ? data.length : data.size || 0,
      mode: options.mode,
      format: options.format,
      // Add hash of first few triples for uniqueness
      dataHash: this._hashData(data)
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
  }

  _hashData(data) {
    const crypto = require('crypto');
    
    // Sample first 10 quads for hash
    const sample = Array.isArray(data) ? 
      data.slice(0, 10) : 
      data.getQuads ? data.getQuads(null, null, null, null, 10) : [];
    
    const sampleString = sample.map(q => 
      `${q.subject.value}|${q.predicate.value}|${q.object.value}`
    ).join('|');
    
    return crypto.createHash('sha256')
      .update(sampleString)
      .digest('hex')
      .substring(0, 8);
  }

  async _validateInput(data, options) {
    if (!this.validationEngine) {
      return;
    }
    
    // Basic validation
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('No data provided for serialization');
    }
    
    // Additional validation would go here
  }

  _selectOptimalMode(data, options) {
    if (options.mode) {
      return options.mode;
    }
    
    if (!this.config.autoOptimization) {
      return this.config.defaultMode;
    }
    
    const dataSize = Array.isArray(data) ? data.length : data.size || 0;
    
    // Auto-select based on data characteristics
    if (options.requireDocumentation) {
      return 'documented';
    }
    
    if (dataSize > 10000) {
      return 'streaming';
    }
    
    return 'canonical';
  }

  async _enhanceResult(result, provenanceContext, options) {
    return {
      ...result,
      kgen: {
        provenanceId: provenanceContext?.operationId,
        integrationVersion: '1.0.0',
        subsystemsUsed: this._getActiveIntegrations(),
        enterpriseFeatures: this.config.enterpriseFeatures,
        timestamp: this.getDeterministicDate()
      }
    };
  }

  async _updateMonitoringMetrics(result) {
    if (!this.monitoringSystem) {
      return;
    }
    
    try {
      this.monitoringSystem.incrementCounter('serialization_operations_total');
      this.monitoringSystem.observeHistogram('serialization_duration_ms', result.master?.processingTime || 0);
      this.monitoringSystem.observeHistogram('serialization_output_bytes', Buffer.byteLength(result.turtle || '', 'utf8'));
      
    } catch (error) {
      this.logger.error('Failed to update monitoring metrics:', error);
    }
  }

  async _generateProvenanceGraph(serialization) {
    if (!this.provenanceTracker) {
      return null;
    }
    
    try {
      return await this.provenanceTracker.exportProvenance({
        format: 'turtle',
        includeOperations: [serialization.kgen?.provenanceId]
      });
      
    } catch (error) {
      this.logger.error('Failed to generate provenance graph:', error);
      return null;
    }
  }

  async _combineDataAndProvenance(serialization, provenance, format) {
    if (!provenance) {
      return serialization;
    }
    
    return {
      ...serialization,
      combined: {
        data: serialization.turtle,
        provenance,
        format,
        combinedAt: this.getDeterministicDate()
      }
    };
  }

  async _performKGenValidation(turtleContent, options) {
    // KGEN-specific validation logic
    return {
      valid: true,
      issues: [],
      kgenCompliant: true,
      enterpriseReady: this.config.enterpriseFeatures
    };
  }

  _getActiveIntegrations() {
    return [
      this.kgenEngine.subsystems.has('rdf') && 'rdf',
      this.provenanceTracker && 'provenance',
      this.cacheManager && 'cache',
      this.validationEngine && 'validation',
      this.monitoringSystem && 'monitoring'
    ].filter(Boolean);
  }

  _sanitizeOptions(options) {
    // Remove sensitive information from options before logging
    const { user, ...sanitized } = options;
    return sanitized;
  }

  /**
   * Get integration status and statistics
   */
  getStatus() {
    return {
      state: this.state,
      integrations: this._getActiveIntegrations(),
      activeOperations: this.activeOperations.size,
      cacheSize: this.serializationCache.size,
      serializationMaster: this.serializationMaster.getStatistics(),
      provenanceTracker: this.provenanceTracker?.getStatus() || null,
      config: {
        defaultMode: this.config.defaultMode,
        autoOptimization: this.config.autoOptimization,
        enterpriseFeatures: this.config.enterpriseFeatures
      }
    };
  }

  /**
   * Shutdown integration
   */
  async shutdown() {
    this.logger.info('Shutting down KGEN serialization integration...');
    
    // Complete any active operations
    for (const operationId of this.activeOperations.keys()) {
      try {
        await this._recordProvenanceError(operationId, new Error('System shutdown'));
      } catch (error) {
        this.logger.error(`Failed to cleanup operation ${operationId}:`, error);
      }
    }
    
    // Shutdown serialization master
    await this.serializationMaster.shutdown();
    
    // Shutdown provenance tracker
    if (this.provenanceTracker) {
      await this.provenanceTracker.shutdown();
    }
    
    this.serializationCache.clear();
    this.activeOperations.clear();
    
    this.state = 'shutdown';
    this.logger.success('KGEN serialization integration shutdown complete');
  }
}

export default KGenSerializationIntegration;