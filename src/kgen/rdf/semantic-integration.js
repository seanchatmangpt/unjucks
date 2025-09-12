/**
 * Semantic Integration Module
 * 
 * Integrates the semantic hashing system with the existing kgen RDF infrastructure.
 * Provides a unified interface for semantic vs syntactic hash operations across
 * the kgen ecosystem with backward compatibility.
 * 
 * Integration points:
 * - Enhanced RDF processor integration
 * - Drift detection with semantic awareness
 * - Content-addressed storage for RDF graphs
 * - Backward compatibility with existing APIs
 */

import { SemanticHashEngine } from './semantic-hash-engine.js';
import { ContentAddressedSemanticStore } from './content-addressed-semantic-store.js';
import { createRDFProcessor } from './index.js';
import { EventEmitter } from 'events';

export class SemanticIntegrationLayer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Integration options
      enableLegacyCompatibility: options.enableLegacyCompatibility !== false,
      enableSemanticStore: options.enableSemanticStore !== false,
      enableEnhancedProcessor: options.enableEnhancedProcessor !== false,
      
      // Semantic processing
      semanticHashEngine: options.semanticHashEngine || null,
      semanticStore: options.semanticStore || null,
      
      // RDF processor options
      rdfProcessorOptions: options.rdfProcessorOptions || {},
      
      // Performance
      enableAsyncProcessing: options.enableAsyncProcessing !== false,
      maxConcurrentOperations: options.maxConcurrentOperations || 5,
      
      ...options
    };
    
    // Initialize components
    this.semanticHashEngine = this.config.semanticHashEngine || 
      new SemanticHashEngine({
        casEnabled: true,
        casNamespace: 'kgen-semantic-integration'
      });
    
    this.semanticStore = this.config.semanticStore ||
      (this.config.enableSemanticStore ? 
        new ContentAddressedSemanticStore({
          semanticHashEngine: this.semanticHashEngine,
          namespace: 'kgen-integration-store'
        }) : null);
    
    // Enhanced RDF processor
    this.rdfProcessor = this.config.enableEnhancedProcessor ?
      createRDFProcessor(this.config.rdfProcessorOptions) : null;
    
    // Operation queue for async processing
    this.operationQueue = [];
    this.activeOperations = new Set();
    
    // Integration statistics
    this.stats = {
      semanticOperations: 0,
      syntacticOperations: 0,
      hybridOperations: 0,
      legacyFallbacks: 0,
      cacheHits: 0,
      performanceGains: 0,
      errors: 0
    };
  }

  /**
   * Process RDF content with semantic-aware capabilities
   * Enhances existing RDF processing with semantic hashing
   * 
   * @param {string|Array} rdfContent - RDF content or quads
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Enhanced processing result
   */
  async processRDF(rdfContent, options = {}) {
    const startTime = performance.now();
    
    try {
      const processOptions = {
        enableSemanticHashing: options.enableSemanticHashing !== false,
        enableSyntacticHashing: options.enableSyntacticHashing !== false,
        enableStorage: options.enableStorage !== false,
        enableLegacyProcessing: options.enableLegacyProcessing !== false,
        ...options
      };
      
      // Determine processing strategy
      const strategy = this._determineProcessingStrategy(processOptions);
      
      let result;
      
      switch (strategy) {
        case 'semantic-only':
          result = await this._processSemanticOnly(rdfContent, processOptions);
          this.stats.semanticOperations++;
          break;
          
        case 'syntactic-only':
          result = await this._processSyntacticOnly(rdfContent, processOptions);
          this.stats.syntacticOperations++;
          break;
          
        case 'hybrid':
          result = await this._processHybrid(rdfContent, processOptions);
          this.stats.hybridOperations++;
          break;
          
        case 'legacy':
          result = await this._processLegacy(rdfContent, processOptions);
          this.stats.legacyFallbacks++;
          break;
          
        default:
          throw new Error(`Unknown processing strategy: ${strategy}`);
      }
      
      // Add integration metadata
      result.integration = {
        strategy,
        processingTime: performance.now() - startTime,
        semanticCapable: strategy !== 'legacy',
        storedInSemanticStore: Boolean(result.storage?.semanticStore),
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      this.emit('rdf-processed', result);
      return result;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'process-rdf', error: error.message });
      throw new Error(`RDF processing failed: ${error.message}`);
    }
  }

  /**
   * Compare two RDF graphs with semantic awareness
   * 
   * @param {string|Array} graph1 - First RDF graph
   * @param {string|Array} graph2 - Second RDF graph
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Semantic comparison result
   */
  async compareGraphs(graph1, graph2, options = {}) {
    const startTime = performance.now();
    
    try {
      // Use semantic hash engine for comparison
      const comparison = await this.semanticHashEngine.compareGraphs(graph1, graph2, options);
      
      // Enhance with legacy processor comparison if available
      if (this.rdfProcessor && options.includeLegacyComparison) {
        try {
          const legacyComparison = await this.rdfProcessor.compareGraphsDeterministic(
            graph1, graph2, options
          );
          
          comparison.legacy = legacyComparison;
          comparison.consistencyCheck = {
            semanticMatch: comparison.semanticallyIdentical === legacyComparison.identical,
            processingTimeRatio: legacyComparison.summary.processingTime / 
                                (performance.now() - startTime)
          };
        } catch (error) {
          comparison.legacy = { error: error.message };
        }
      }
      
      // Store comparison result if requested
      if (options.storeComparison && this.semanticStore) {
        const comparisonData = {
          type: 'graph-comparison',
          timestamp: this.getDeterministicDate().toISOString(),
          comparison,
          options
        };
        
        try {
          await this.semanticStore.store(JSON.stringify(comparisonData), {
            format: 'application/json'
          });
        } catch (error) {
          console.warn('Failed to store comparison result:', error.message);
        }
      }
      
      this.emit('graphs-compared', comparison);
      return comparison;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'compare-graphs', error: error.message });
      throw new Error(`Graph comparison failed: ${error.message}`);
    }
  }

  /**
   * Generate unified hash with semantic/syntactic differentiation
   * 
   * @param {string|Array} rdfContent - RDF content or quads
   * @param {Object} options - Hash generation options
   * @returns {Promise<Object>} Unified hash result
   */
  async generateUnifiedHash(rdfContent, options = {}) {
    try {
      const hashResult = await this.semanticHashEngine.calculateBothHashes(rdfContent, options);
      
      // Add backward compatibility identifiers
      if (this.config.enableLegacyCompatibility) {
        hashResult.legacy = {
          contentHash: hashResult.semantic.semanticHash, // Use semantic as primary
          format: options.format || 'turtle',
          algorithm: 'sha256'
        };
      }
      
      // Store in semantic store if enabled
      if (this.semanticStore && options.enableStorage !== false) {
        try {
          const storeResult = await this.semanticStore.store(rdfContent, options);
          hashResult.storage = {
            semanticStore: storeResult,
            retrieval: {
              bySemanticHash: `semantic://${storeResult.semanticHash}`,
              bySyntacticHash: `syntactic://${storeResult.syntacticHash}`,
              byCID: `cid://${storeResult.semanticCID}`
            }
          };
        } catch (error) {
          console.warn('Semantic storage failed:', error.message);
        }
      }
      
      return hashResult;
      
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { operation: 'generate-hash', error: error.message });
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve content with semantic addressing
   * 
   * @param {string} identifier - Semantic hash, syntactic hash, or CID
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved content
   */
  async retrieveContent(identifier, options = {}) {
    try {
      if (!this.semanticStore) {
        throw new Error('Semantic store not enabled');
      }
      
      // Determine identifier type and retrieve accordingly
      if (identifier.startsWith('semantic://')) {
        const hash = identifier.replace('semantic://', '');
        return await this.semanticStore.retrieveBySemantic(hash, options);
      } else if (identifier.startsWith('syntactic://')) {
        const hash = identifier.replace('syntactic://', '');
        return await this.semanticStore.retrieveBySyntactic(hash, options);
      } else if (identifier.startsWith('cid://')) {
        const cid = identifier.replace('cid://', '');
        return await this.semanticStore.retrieveByCID(cid, options);
      } else {
        // Try as semantic hash first, then syntactic, then CID
        try {
          return await this.semanticStore.retrieveBySemantic(identifier, options);
        } catch {
          try {
            return await this.semanticStore.retrieveBySyntactic(identifier, options);
          } catch {
            return await this.semanticStore.retrieveByCID(identifier, options);
          }
        }
      }
      
    } catch (error) {
      this.emit('error', { operation: 'retrieve-content', identifier, error: error.message });
      throw new Error(`Content retrieval failed: ${error.message}`);
    }
  }

  /**
   * Detect content drift with semantic awareness
   * 
   * @param {string} originalContent - Original RDF content
   * @param {string} currentContent - Current RDF content
   * @param {Object} options - Drift detection options
   * @returns {Promise<Object>} Drift analysis result
   */
  async detectDrift(originalContent, currentContent, options = {}) {
    try {
      const comparison = await this.compareGraphs(originalContent, currentContent, {
        ...options,
        includeChanges: true,
        checkSemanticEquivalence: true
      });
      
      // Classify drift type
      let driftType = 'none';
      let severity = 'none';
      
      if (!comparison.semanticallyIdentical) {
        driftType = 'semantic';
        severity = 'high';
      } else if (!comparison.syntacticallyIdentical) {
        driftType = 'syntactic';
        severity = 'low';
      }
      
      const driftAnalysis = {
        hasDrift: driftType !== 'none',
        driftType,
        severity,
        comparison,
        recommendations: this._generateDriftRecommendations(driftType, comparison),
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      this.emit('drift-detected', driftAnalysis);
      return driftAnalysis;
      
    } catch (error) {
      this.emit('error', { operation: 'detect-drift', error: error.message });
      throw new Error(`Drift detection failed: ${error.message}`);
    }
  }

  // Private methods

  _determineProcessingStrategy(options) {
    if (!options.enableSemanticHashing && !options.enableSyntacticHashing) {
      return 'legacy';
    } else if (options.enableSemanticHashing && !options.enableSyntacticHashing) {
      return 'semantic-only';
    } else if (!options.enableSemanticHashing && options.enableSyntacticHashing) {
      return 'syntactic-only';
    } else {
      return 'hybrid';
    }
  }

  async _processSemanticOnly(rdfContent, options) {
    const semanticResult = await this.semanticHashEngine.calculateSemanticHash(rdfContent, options);
    
    return {
      semantic: semanticResult,
      processing: {
        strategy: 'semantic-only',
        capabilities: ['semantic-hashing', 'canonicalization', 'blank-node-normalization']
      }
    };
  }

  async _processSyntacticOnly(rdfContent, options) {
    const syntacticResult = await this.semanticHashEngine.calculateSyntacticHash(rdfContent, options);
    
    return {
      syntactic: syntacticResult,
      processing: {
        strategy: 'syntactic-only',
        capabilities: ['syntactic-hashing', 'format-preservation']
      }
    };
  }

  async _processHybrid(rdfContent, options) {
    const hybridResult = await this.semanticHashEngine.calculateBothHashes(rdfContent, options);
    
    // Store in semantic store if enabled
    let storage = null;
    if (this.semanticStore && options.enableStorage !== false) {
      try {
        storage = {
          semanticStore: await this.semanticStore.store(rdfContent, options)
        };
      } catch (error) {
        console.warn('Semantic storage failed in hybrid processing:', error.message);
      }
    }
    
    return {
      ...hybridResult,
      storage,
      processing: {
        strategy: 'hybrid',
        capabilities: [
          'semantic-hashing', 'syntactic-hashing', 'canonicalization',
          'blank-node-normalization', 'format-preservation', 'differentiation-analysis'
        ]
      }
    };
  }

  async _processLegacy(rdfContent, options) {
    if (!this.rdfProcessor) {
      throw new Error('Legacy processing requested but RDF processor not available');
    }
    
    const legacyResult = await this.rdfProcessor.processGraphDeterministic(
      rdfContent, 
      options.format,
      options
    );
    
    return {
      legacy: legacyResult,
      processing: {
        strategy: 'legacy',
        capabilities: ['basic-parsing', 'indexing', 'validation']
      }
    };
  }

  _generateDriftRecommendations(driftType, comparison) {
    const recommendations = [];
    
    if (driftType === 'semantic') {
      recommendations.push('Content has changed semantically - review changes carefully');
      recommendations.push('Consider updating dependent systems that rely on this content');
      
      if (comparison.summary?.addedCount > 0) {
        recommendations.push(`${comparison.summary.addedCount} triples were added`);
      }
      
      if (comparison.summary?.removedCount > 0) {
        recommendations.push(`${comparison.summary.removedCount} triples were removed`);
      }
      
    } else if (driftType === 'syntactic') {
      recommendations.push('Content formatting has changed but meaning is preserved');
      recommendations.push('Update may be safe if only formatting matters');
      recommendations.push('Consider using semantic hash for content identity');
    }
    
    return recommendations;
  }

  /**
   * Get comprehensive integration statistics
   */
  getStats() {
    return {
      integration: this.stats,
      components: {
        semanticHashEngine: this.semanticHashEngine?.getStats(),
        semanticStore: this.semanticStore?.getStats(),
        rdfProcessor: this.rdfProcessor ? {
          available: true,
          stats: this.rdfProcessor.getStats?.()
        } : { available: false }
      },
      configuration: {
        enableLegacyCompatibility: this.config.enableLegacyCompatibility,
        enableSemanticStore: this.config.enableSemanticStore,
        enableEnhancedProcessor: this.config.enableEnhancedProcessor
      }
    };
  }

  /**
   * Perform health check of integration components
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      components: {},
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    // Check semantic hash engine
    try {
      const testRdf = `@prefix ex: <http://example.org/> . ex:test ex:prop "value" .`;
      await this.semanticHashEngine.calculateSemanticHash(testRdf);
      health.components.semanticHashEngine = 'healthy';
    } catch (error) {
      health.components.semanticHashEngine = `unhealthy: ${error.message}`;
      health.overall = 'degraded';
    }
    
    // Check semantic store
    if (this.semanticStore) {
      try {
        const stats = this.semanticStore.getStats();
        health.components.semanticStore = stats ? 'healthy' : 'degraded';
      } catch (error) {
        health.components.semanticStore = `unhealthy: ${error.message}`;
        health.overall = 'degraded';
      }
    } else {
      health.components.semanticStore = 'disabled';
    }
    
    // Check RDF processor
    if (this.rdfProcessor) {
      try {
        const stats = this.rdfProcessor.getStats?.();
        health.components.rdfProcessor = stats ? 'healthy' : 'unknown';
      } catch (error) {
        health.components.rdfProcessor = `error: ${error.message}`;
      }
    } else {
      health.components.rdfProcessor = 'disabled';
    }
    
    return health;
  }

  /**
   * Shutdown and cleanup all components
   */
  async shutdown() {
    try {
      await Promise.all([
        this.semanticHashEngine?.shutdown?.(),
        this.semanticStore?.shutdown?.(),
        this.rdfProcessor?.shutdown?.()
      ]);
      
      this.removeAllListeners();
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', { operation: 'shutdown', error: error.message });
      throw new Error(`Shutdown failed: ${error.message}`);
    }
  }
}

/**
 * Create a semantic integration layer with default configuration
 * 
 * @param {Object} options - Configuration options
 * @returns {SemanticIntegrationLayer} Configured integration layer
 */
export function createSemanticIntegration(options = {}) {
  return new SemanticIntegrationLayer(options);
}

/**
 * Default integration instance for the kgen ecosystem
 */
let defaultIntegration = null;

/**
 * Get or create the default semantic integration instance
 * 
 * @param {Object} options - Configuration options
 * @returns {SemanticIntegrationLayer} Default integration instance
 */
export function getSemanticIntegration(options = {}) {
  if (!defaultIntegration) {
    defaultIntegration = new SemanticIntegrationLayer(options);
  }
  return defaultIntegration;
}

/**
 * Reset the default integration instance
 */
export async function resetSemanticIntegration() {
  if (defaultIntegration) {
    await defaultIntegration.shutdown();
    defaultIntegration = null;
  }
}

export default SemanticIntegrationLayer;