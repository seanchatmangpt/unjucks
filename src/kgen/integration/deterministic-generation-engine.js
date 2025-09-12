/**
 * KGEN Deterministic Generation Engine
 * 
 * Advanced deterministic generation system that ensures reproducible, content-addressed
 * artifact generation with cryptographic integrity verification, incremental updates,
 * and comprehensive provenance tracking for enterprise-grade template processing.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import { DeterministicRenderingSystem } from '../deterministic/index.js';
import { ProvenanceTracker } from '../provenance/tracker.js';
import { KGenErrorHandler } from '../utils/error-handler.js';
import crypto from 'crypto';
import path from 'node:path';
import fs from 'fs-extra';

export class DeterministicGenerationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core deterministic settings
      enableDeterministicGeneration: config.enableDeterministicGeneration !== false,
      enableContentAddressing: config.enableContentAddressing !== false,
      enableIncrementalGeneration: config.enableIncrementalGeneration !== false,
      
      // Cryptographic settings
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      enableIntegrityVerification: config.enableIntegrityVerification !== false,
      enableArtifactSigning: config.enableArtifactSigning || false,
      
      // Generation tracking
      enableGenerationHistory: config.enableGenerationHistory !== false,
      enableDifferentialTracking: config.enableDifferentialTracking !== false,
      maxHistoryEntries: config.maxHistoryEntries || 1000,
      
      // Storage and caching
      stateDirectory: config.stateDirectory || '.kgen-state',
      enableStateCache: config.enableStateCache !== false,
      enableGenerationCache: config.enableGenerationCache !== false,
      cacheDirectory: config.cacheDirectory || '.kgen-cache/deterministic',
      
      // Performance settings
      maxConcurrentGenerations: config.maxConcurrentGenerations || 5,
      enableParallelHashing: config.enableParallelHashing !== false,
      chunkSize: config.chunkSize || 1024 * 1024, // 1MB chunks
      
      // Validation settings
      enableContentValidation: config.enableContentValidation !== false,
      enableStructuralValidation: config.enableStructuralValidation !== false,
      strictMode: config.strictMode || false,
      
      ...config
    };
    
    this.logger = new Consola({ tag: 'kgen-deterministic-generation' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize core components
    this.deterministicRenderer = this.config.enableDeterministicGeneration
      ? new DeterministicRenderingSystem(this.config.deterministic)
      : null;
    
    this.provenanceTracker = this.config.enableProvenance
      ? new ProvenanceTracker(this.config.provenance)
      : null;
    
    // Generation state management
    this.generationState = new Map();
    this.contentAddressIndex = new Map();
    this.generationHistory = [];
    this.activeGenerations = new Map();
    
    // Incremental generation tracking
    this.previousGenerations = new Map();
    this.dependencyGraph = new Map();
    this.invalidationTracker = new Set();
    
    // Performance metrics
    this.metrics = {
      totalGenerations: 0,
      deterministicGenerations: 0,
      incrementalGenerations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalHashingTime: 0,
      totalGenerationTime: 0,
      integrityValidations: 0,
      integrityFailures: 0
    };
    
    this._setupEventHandlers();
  }

  /**
   * Initialize the deterministic generation engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN deterministic generation engine...');
      
      // Initialize components
      if (this.deterministicRenderer) {
        await this.deterministicRenderer.initialize();
      }
      
      if (this.provenanceTracker) {
        await this.provenanceTracker.initialize();
      }
      
      // Create required directories
      await fs.ensureDir(path.join(process.cwd(), this.config.stateDirectory));
      await fs.ensureDir(path.join(process.cwd(), this.config.cacheDirectory));
      
      // Load previous generation state if available
      await this._loadGenerationState();
      
      this.state = 'ready';
      this.emit('engine:ready');
      
      this.logger.success('KGEN deterministic generation engine initialized successfully');
      return { status: 'success', version: this.getVersion() };
      
    } catch (error) {
      const operationId = 'engine:initialize';
      const errorContext = {
        component: 'deterministic-generation-engine',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('engine:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Generate artifacts with full deterministic guarantees
   * @param {Object} generationRequest - Generation request with template and context
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Deterministic generation result
   */
  async generateDeterministic(generationRequest, options = {}) {
    const operationId = this._generateOperationId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Starting deterministic generation ${operationId}`);
      this.metrics.totalGenerations++;
      
      // Track active generation
      this.activeGenerations.set(operationId, {
        request: generationRequest,
        options,
        startTime,
        status: 'running'
      });
      
      // Start provenance tracking
      let provenanceContext = null;
      if (this.provenanceTracker) {
        provenanceContext = await this.provenanceTracker.startOperation({
          operationId,
          type: 'deterministic_generation',
          request: generationRequest,
          options,
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Phase 1: Create deterministic generation plan
      const generationPlan = await this._createDeterministicPlan(
        generationRequest,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 2: Check for incremental generation opportunities
      const incrementalAnalysis = await this._analyzeIncrementalOpportunities(
        generationPlan,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 3: Execute deterministic generation
      const generationResult = await this._executeDeterministicGeneration(
        generationPlan,
        incrementalAnalysis,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 4: Verify integrity and validate results
      const validationResult = await this._validateGenerationResult(
        generationResult,
        generationPlan,
        { ...options, operationId, provenanceContext }
      );
      
      // Phase 5: Update generation state and history
      await this._updateGenerationState(
        operationId,
        generationPlan,
        generationResult,
        validationResult
      );
      
      // Complete provenance tracking
      if (this.provenanceTracker) {
        await this.provenanceTracker.completeOperation(operationId, {
          status: 'success',
          generationResult,
          validationResult,
          metrics: {
            deterministicGeneration: true,
            incrementalGeneration: incrementalAnalysis.canUseIncremental,
            contentAddressing: this.config.enableContentAddressing,
            integrityVerification: this.config.enableIntegrityVerification,
            generationTime: this.getDeterministicTimestamp() - startTime
          }
        });
      }
      
      // Update metrics
      this.metrics.deterministicGenerations++;
      if (incrementalAnalysis.canUseIncremental) {
        this.metrics.incrementalGenerations++;
      }
      this.metrics.totalGenerationTime += (this.getDeterministicTimestamp() - startTime);
      
      // Update active generation status
      this.activeGenerations.set(operationId, {
        ...this.activeGenerations.get(operationId),
        status: 'completed',
        result: generationResult
      });
      
      this.emit('generation:completed', {
        operationId,
        result: generationResult,
        validation: validationResult,
        metrics: this.getMetrics()
      });
      
      this.logger.success(`Deterministic generation ${operationId} completed successfully`);
      
      return {
        operationId,
        status: 'success',
        ...generationResult,
        validation: validationResult,
        metadata: {
          ...generationResult.metadata,
          deterministicGeneration: true,
          incrementalGeneration: incrementalAnalysis.canUseIncremental,
          contentAddressing: this.config.enableContentAddressing,
          integrityVerified: validationResult.integrityValid,
          engineVersion: this.getVersion()
        }
      };
      
    } catch (error) {
      const errorContext = {
        component: 'deterministic-generation-engine',
        operation: 'deterministic_generation',
        request: {
          template: generationRequest.template,
          generator: generationRequest.generator,
          hasContext: !!generationRequest.context
        }
      };
      
      // Update metrics
      this.metrics.totalGenerationTime += (this.getDeterministicTimestamp() - startTime);
      
      // Handle error with recovery
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      // Update active generation status
      this.activeGenerations.set(operationId, {
        ...this.activeGenerations.get(operationId),
        status: 'failed',
        error: error.message
      });
      
      this.emit('generation:error', {
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
   * Compute content address for deterministic artifact identification
   * @param {Object} artifact - Artifact to compute address for
   * @param {Object} options - Addressing options
   * @returns {Promise<string>} Content address hash
   */
  async computeContentAddress(artifact, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Create canonical representation of artifact for hashing
      const canonicalArtifact = this._createCanonicalArtifact(artifact, options);
      
      // Compute hash
      let hash;
      if (this.config.enableParallelHashing && artifact.content && artifact.content.length > this.config.chunkSize) {
        hash = await this._computeParallelHash(canonicalArtifact, options);
      } else {
        hash = await this._computeSequentialHash(canonicalArtifact, options);
      }
      
      this.metrics.totalHashingTime += (this.getDeterministicTimestamp() - startTime);
      
      this.emit('content:addressed', {
        artifactId: artifact.id,
        contentAddress: hash,
        hashTime: this.getDeterministicTimestamp() - startTime
      });
      
      return hash;
      
    } catch (error) {
      this.logger.error(`Content addressing failed for artifact ${artifact.id}:`, error);
      throw error;
    }
  }

  /**
   * Verify integrity of generated artifacts
   * @param {Array} artifacts - Artifacts to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Integrity verification result
   */
  async verifyIntegrity(artifacts, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.debug(`Verifying integrity for ${artifacts.length} artifacts`);
      this.metrics.integrityValidations++;
      
      const verificationResults = [];
      
      for (const artifact of artifacts) {
        const result = await this._verifyArtifactIntegrity(artifact, options);
        verificationResults.push(result);
        
        if (!result.valid) {
          this.metrics.integrityFailures++;
        }
      }
      
      const overallResult = {
        operationId,
        timestamp: this.getDeterministicDate().toISOString(),
        valid: verificationResults.every(r => r.valid),
        artifactsVerified: artifacts.length,
        validArtifacts: verificationResults.filter(r => r.valid).length,
        invalidArtifacts: verificationResults.filter(r => !r.valid).length,
        results: verificationResults
      };
      
      this.emit('integrity:verified', {
        operationId,
        result: overallResult
      });
      
      return overallResult;
      
    } catch (error) {
      this.logger.error('Integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Get generation state for a specific operation or artifact
   * @param {string} identifier - Operation ID or artifact identifier
   * @returns {Object|null} Generation state or null if not found
   */
  getGenerationState(identifier) {
    return this.generationState.get(identifier) || null;
  }

  /**
   * Get generation metrics and statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      deterministicRate: this.metrics.totalGenerations > 0 
        ? this.metrics.deterministicGenerations / this.metrics.totalGenerations 
        : 0,
      incrementalRate: this.metrics.deterministicGenerations > 0
        ? this.metrics.incrementalGenerations / this.metrics.deterministicGenerations
        : 0,
      averageGenerationTime: this.metrics.totalGenerations > 0
        ? this.metrics.totalGenerationTime / this.metrics.totalGenerations
        : 0,
      averageHashingTime: this.metrics.deterministicGenerations > 0
        ? this.metrics.totalHashingTime / this.metrics.deterministicGenerations
        : 0,
      integritySuccessRate: this.metrics.integrityValidations > 0
        ? (this.metrics.integrityValidations - this.metrics.integrityFailures) / this.metrics.integrityValidations
        : 0
    };
  }

  /**
   * Get engine status and state information
   */
  getStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      config: this.config,
      activeGenerations: this.activeGenerations.size,
      generationHistory: this.generationHistory.length,
      contentAddressIndex: this.contentAddressIndex.size,
      components: {
        deterministicRenderer: this.deterministicRenderer?.getStatus() || 'disabled',
        provenanceTracker: this.provenanceTracker?.getStatus() || 'disabled'
      },
      metrics: this.getMetrics(),
      uptime: process.uptime()
    };
  }

  /**
   * Clear all caches and reset state
   */
  async clearState() {
    try {
      this.generationState.clear();
      this.contentAddressIndex.clear();
      this.generationHistory.length = 0;
      this.previousGenerations.clear();
      this.dependencyGraph.clear();
      this.invalidationTracker.clear();
      
      // Clear state directory
      const stateDir = path.join(process.cwd(), this.config.stateDirectory);
      if (await fs.pathExists(stateDir)) {
        await fs.emptyDir(stateDir);
      }
      
      this.logger.info('Deterministic generation state cleared');
      this.emit('state:cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear state:', error);
      throw error;
    }
  }

  /**
   * Shutdown the engine gracefully
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down deterministic generation engine...');
      
      this.state = 'shutting_down';
      
      // Wait for active generations to complete
      await this._waitForActiveGenerations();
      
      // Save generation state
      await this._saveGenerationState();
      
      // Shutdown components
      if (this.deterministicRenderer) {
        await this.deterministicRenderer.shutdown();
      }
      
      if (this.provenanceTracker) {
        await this.provenanceTracker.shutdown();
      }
      
      this.state = 'shutdown';
      this.emit('engine:shutdown');
      
      this.logger.success('Deterministic generation engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during engine shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _generateOperationId() {
    return `dge_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _createDeterministicPlan(generationRequest, options) {
    const plan = {
      operationId: options.operationId,
      timestamp: this.getDeterministicDate().toISOString(),
      request: generationRequest,
      options,
      
      // Content addressing
      requestHash: null,
      contextHash: null,
      templateHash: null,
      
      // Deterministic generation settings
      deterministicSettings: {
        hashAlgorithm: this.config.hashAlgorithm,
        enableContentAddressing: this.config.enableContentAddressing,
        enableIncrementalGeneration: this.config.enableIncrementalGeneration
      },
      
      // Dependencies and invalidation
      dependencies: [],
      invalidationKeys: []
    };
    
    try {
      // Compute hashes for deterministic identification
      const requestContent = JSON.stringify(generationRequest, Object.keys(generationRequest).sort());
      plan.requestHash = this._computeHash(requestContent);
      
      if (generationRequest.context) {
        const contextContent = JSON.stringify(generationRequest.context, Object.keys(generationRequest.context).sort());
        plan.contextHash = this._computeHash(contextContent);
      }
      
      // Create deterministic rendering plan if enabled
      if (this.deterministicRenderer) {
        plan.renderingPlan = await this.deterministicRenderer.createRenderingPlan(
          generationRequest,
          plan.deterministicSettings
        );
      }
      
      // Analyze dependencies
      plan.dependencies = await this._analyzeDependencies(generationRequest, options);
      
      // Create invalidation keys
      plan.invalidationKeys = this._createInvalidationKeys(generationRequest, plan);
      
    } catch (error) {
      this.logger.warn('Failed to create deterministic plan:', error.message);
    }
    
    return plan;
  }

  async _analyzeIncrementalOpportunities(generationPlan, options) {
    const analysis = {
      canUseIncremental: false,
      reason: null,
      previousGeneration: null,
      changedDependencies: [],
      unchangedArtifacts: []
    };
    
    try {
      if (!this.config.enableIncrementalGeneration) {
        analysis.reason = 'Incremental generation disabled';
        return analysis;
      }
      
      // Look for previous generation with same request hash
      const previousGeneration = this.previousGenerations.get(generationPlan.requestHash);
      if (!previousGeneration) {
        analysis.reason = 'No previous generation found';
        return analysis;
      }
      
      analysis.previousGeneration = previousGeneration;
      
      // Check if dependencies have changed
      const changedDependencies = [];
      for (const dependency of generationPlan.dependencies) {
        const previousDependency = previousGeneration.dependencies.find(d => d.id === dependency.id);
        if (!previousDependency || previousDependency.hash !== dependency.hash) {
          changedDependencies.push(dependency);
        }
      }
      
      analysis.changedDependencies = changedDependencies;
      
      // If no dependencies changed, we can potentially reuse artifacts
      if (changedDependencies.length === 0) {
        analysis.canUseIncremental = true;
        analysis.reason = 'No dependency changes detected';
        analysis.unchangedArtifacts = previousGeneration.artifacts || [];
      } else if (changedDependencies.length < generationPlan.dependencies.length / 2) {
        // Partial incremental generation might be possible
        analysis.canUseIncremental = true;
        analysis.reason = 'Partial dependency changes, incremental update possible';
        
        // Identify artifacts that can be reused
        const unchangedArtifacts = [];
        for (const artifact of previousGeneration.artifacts || []) {
          const artifactDependencies = this._getArtifactDependencies(artifact, generationPlan.dependencies);
          const hasChangedDependencies = artifactDependencies.some(dep => 
            changedDependencies.find(changed => changed.id === dep.id)
          );
          
          if (!hasChangedDependencies) {
            unchangedArtifacts.push(artifact);
          }
        }
        
        analysis.unchangedArtifacts = unchangedArtifacts;
      } else {
        analysis.reason = 'Too many dependency changes, full regeneration required';
      }
      
    } catch (error) {
      this.logger.warn('Incremental analysis failed:', error.message);
      analysis.reason = `Analysis failed: ${error.message}`;
    }
    
    return analysis;
  }

  async _executeDeterministicGeneration(generationPlan, incrementalAnalysis, options) {
    this.logger.debug('Executing deterministic generation');
    
    const result = {
      operationId: generationPlan.operationId,
      timestamp: this.getDeterministicDate().toISOString(),
      artifacts: [],
      metadata: {
        deterministicPlan: generationPlan,
        incrementalAnalysis,
        generationMethod: incrementalAnalysis.canUseIncremental ? 'incremental' : 'full'
      }
    };
    
    try {
      if (incrementalAnalysis.canUseIncremental && incrementalAnalysis.unchangedArtifacts.length > 0) {
        // Use incremental generation
        this.logger.debug(`Using incremental generation with ${incrementalAnalysis.unchangedArtifacts.length} reused artifacts`);
        
        // Reuse unchanged artifacts
        result.artifacts.push(...incrementalAnalysis.unchangedArtifacts.map(artifact => ({
          ...artifact,
          metadata: {
            ...artifact.metadata,
            reused: true,
            reuseReason: 'No dependency changes',
            originalGenerationId: artifact.metadata?.operationId
          }
        })));
        
        // Generate only changed artifacts if needed
        if (incrementalAnalysis.changedDependencies.length > 0) {
          const changedArtifacts = await this._generateChangedArtifacts(
            generationPlan,
            incrementalAnalysis.changedDependencies,
            options
          );
          result.artifacts.push(...changedArtifacts);
        }
        
        this.metrics.cacheHits++;
        
      } else {
        // Full generation required
        this.logger.debug('Performing full deterministic generation');
        
        if (this.deterministicRenderer) {
          const generatedArtifacts = await this.deterministicRenderer.renderDeterministic(
            generationPlan.renderingPlan,
            options
          );
          result.artifacts.push(...generatedArtifacts);
        } else {
          // Fallback to basic generation
          result.artifacts = await this._performBasicGeneration(generationPlan, options);
        }
        
        this.metrics.cacheMisses++;
      }
      
      // Compute content addresses for all artifacts
      if (this.config.enableContentAddressing) {
        for (const artifact of result.artifacts) {
          artifact.contentAddress = await this.computeContentAddress(artifact, options);
          this.contentAddressIndex.set(artifact.contentAddress, {
            operationId: generationPlan.operationId,
            artifactId: artifact.id,
            timestamp: this.getDeterministicDate().toISOString()
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Deterministic generation execution failed:', error);
      throw error;
    }
    
    return result;
  }

  async _validateGenerationResult(generationResult, generationPlan, options) {
    const validation = {
      valid: true,
      integrityValid: true,
      structuralValid: true,
      contentValid: true,
      errors: [],
      warnings: []
    };
    
    try {
      // Integrity verification if enabled
      if (this.config.enableIntegrityVerification) {
        const integrityResult = await this.verifyIntegrity(generationResult.artifacts, options);
        validation.integrityValid = integrityResult.valid;
        
        if (!integrityResult.valid) {
          validation.errors.push('Integrity verification failed');
        }
      }
      
      // Structural validation if enabled
      if (this.config.enableStructuralValidation) {
        const structuralResult = await this._validateStructure(generationResult.artifacts, generationPlan);
        validation.structuralValid = structuralResult.valid;
        
        if (!structuralResult.valid) {
          validation.errors.push(...structuralResult.errors);
        }
        validation.warnings.push(...structuralResult.warnings);
      }
      
      // Content validation if enabled
      if (this.config.enableContentValidation) {
        const contentResult = await this._validateContent(generationResult.artifacts, generationPlan);
        validation.contentValid = contentResult.valid;
        
        if (!contentResult.valid) {
          validation.errors.push(...contentResult.errors);
        }
        validation.warnings.push(...contentResult.warnings);
      }
      
      validation.valid = validation.integrityValid && validation.structuralValid && validation.contentValid;
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
  }

  async _updateGenerationState(operationId, generationPlan, generationResult, validationResult) {
    try {
      // Update generation state
      const stateEntry = {
        operationId,
        timestamp: this.getDeterministicDate().toISOString(),
        plan: generationPlan,
        result: generationResult,
        validation: validationResult,
        artifacts: generationResult.artifacts.map(a => ({
          id: a.id,
          path: a.path,
          contentAddress: a.contentAddress,
          size: a.size
        })),
        dependencies: generationPlan.dependencies
      };
      
      this.generationState.set(operationId, stateEntry);
      this.generationHistory.push(stateEntry);
      
      // Update previous generations index for incremental generation
      if (generationPlan.requestHash) {
        this.previousGenerations.set(generationPlan.requestHash, stateEntry);
      }
      
      // Trim history if needed
      if (this.generationHistory.length > this.config.maxHistoryEntries) {
        this.generationHistory.splice(0, this.generationHistory.length - this.config.maxHistoryEntries);
      }
      
      // Save state to disk if enabled
      if (this.config.enableStateCache) {
        await this._saveGenerationState();
      }
      
    } catch (error) {
      this.logger.warn('Failed to update generation state:', error.message);
    }
  }

  _createCanonicalArtifact(artifact, options) {
    // Create a canonical representation for consistent hashing
    return {
      id: artifact.id || '',
      type: artifact.type || '',
      path: artifact.path || '',
      content: artifact.content || '',
      metadata: artifact.metadata || {},
      // Sort object keys for deterministic ordering
      ...(artifact.metadata && Object.keys(artifact.metadata).sort().reduce((sorted, key) => {
        sorted[key] = artifact.metadata[key];
        return sorted;
      }, {}))
    };
  }

  async _computeSequentialHash(canonicalArtifact, options) {
    const hasher = crypto.createHash(this.config.hashAlgorithm);
    const content = JSON.stringify(canonicalArtifact);
    hasher.update(content);
    return hasher.digest('hex');
  }

  async _computeParallelHash(canonicalArtifact, options) {
    // For large content, compute hash in parallel chunks
    const content = JSON.stringify(canonicalArtifact);
    const chunks = [];
    
    for (let i = 0; i < content.length; i += this.config.chunkSize) {
      chunks.push(content.slice(i, i + this.config.chunkSize));
    }
    
    const chunkHashes = await Promise.all(
      chunks.map(chunk => {
        const hasher = crypto.createHash(this.config.hashAlgorithm);
        hasher.update(chunk);
        return hasher.digest('hex');
      })
    );
    
    // Combine chunk hashes
    const finalHasher = crypto.createHash(this.config.hashAlgorithm);
    chunkHashes.forEach(hash => finalHasher.update(hash));
    return finalHasher.digest('hex');
  }

  _computeHash(content) {
    const hasher = crypto.createHash(this.config.hashAlgorithm);
    hasher.update(content);
    return hasher.digest('hex');
  }

  async _verifyArtifactIntegrity(artifact, options) {
    const result = {
      valid: true,
      artifactId: artifact.id,
      errors: []
    };
    
    try {
      // Verify content address if present
      if (artifact.contentAddress) {
        const computedAddress = await this.computeContentAddress(artifact, options);
        if (computedAddress !== artifact.contentAddress) {
          result.valid = false;
          result.errors.push('Content address mismatch');
        }
      }
      
      // Verify signature if present
      if (artifact.signature && this.config.enableArtifactSigning) {
        const signatureValid = await this._verifyArtifactSignature(artifact);
        if (!signatureValid) {
          result.valid = false;
          result.errors.push('Signature verification failed');
        }
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Integrity check failed: ${error.message}`);
    }
    
    return result;
  }

  async _analyzeDependencies(generationRequest, options) {
    // Analyze and track dependencies for incremental generation
    const dependencies = [];
    
    try {
      // Template dependency
      if (generationRequest.template) {
        dependencies.push({
          id: `template:${generationRequest.generator}:${generationRequest.template}`,
          type: 'template',
          path: generationRequest.template,
          hash: this._computeHash(JSON.stringify(generationRequest.template))
        });
      }
      
      // Context dependencies
      if (generationRequest.context) {
        dependencies.push({
          id: 'context',
          type: 'context',
          data: generationRequest.context,
          hash: this._computeHash(JSON.stringify(generationRequest.context, Object.keys(generationRequest.context).sort()))
        });
      }
      
      // Variable dependencies
      if (generationRequest.variables) {
        dependencies.push({
          id: 'variables',
          type: 'variables',
          data: generationRequest.variables,
          hash: this._computeHash(JSON.stringify(generationRequest.variables, Object.keys(generationRequest.variables).sort()))
        });
      }
      
    } catch (error) {
      this.logger.warn('Dependency analysis failed:', error.message);
    }
    
    return dependencies;
  }

  _createInvalidationKeys(generationRequest, plan) {
    // Create keys that can be used to invalidate cached results
    const keys = [];
    
    keys.push(`generator:${generationRequest.generator}`);
    keys.push(`template:${generationRequest.generator}:${generationRequest.template}`);
    
    if (plan.contextHash) {
      keys.push(`context:${plan.contextHash}`);
    }
    
    if (plan.requestHash) {
      keys.push(`request:${plan.requestHash}`);
    }
    
    return keys;
  }

  async _loadGenerationState() {
    try {
      const stateFile = path.join(process.cwd(), this.config.stateDirectory, 'generation-state.json');
      
      if (await fs.pathExists(stateFile)) {
        const stateData = await fs.readJson(stateFile);
        
        // Restore generation history
        this.generationHistory = stateData.history || [];
        
        // Restore content address index
        if (stateData.contentAddressIndex) {
          this.contentAddressIndex = new Map(stateData.contentAddressIndex);
        }
        
        // Restore previous generations
        if (stateData.previousGenerations) {
          this.previousGenerations = new Map(stateData.previousGenerations);
        }
        
        this.logger.info(`Loaded generation state with ${this.generationHistory.length} history entries`);
      }
      
    } catch (error) {
      this.logger.warn('Failed to load generation state:', error.message);
    }
  }

  async _saveGenerationState() {
    try {
      const stateFile = path.join(process.cwd(), this.config.stateDirectory, 'generation-state.json');
      
      const stateData = {
        version: this.getVersion(),
        timestamp: this.getDeterministicDate().toISOString(),
        history: this.generationHistory,
        contentAddressIndex: Array.from(this.contentAddressIndex.entries()),
        previousGenerations: Array.from(this.previousGenerations.entries()),
        metrics: this.metrics
      };
      
      await fs.writeJson(stateFile, stateData, { spaces: 2 });
      
    } catch (error) {
      this.logger.warn('Failed to save generation state:', error.message);
    }
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
    // Component error propagation
    if (this.deterministicRenderer) {
      this.deterministicRenderer.on('error', (error) => {
        this.emit('component:error', { component: 'deterministic_renderer', error });
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

export default DeterministicGenerationEngine;