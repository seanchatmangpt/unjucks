/**
 * Drift URI Resolver - Semantic Patch Storage and Retrieval
 * 
 * Implements drift:// scheme for content-addressed semantic patches:
 * - drift://hash/patch - Retrieve patch by content hash
 * - drift://semantic/type/id - Semantic change categorization
 * - drift://temporal/timestamp/id - Time-based patch series
 * - drift://rdf/canonical/hash - RDF canonical form patches
 * 
 * Features:
 * - Content-addressed patch storage using CAS
 * - JSON diff/patch with jsondiffpatch integration
 * - Semantic vs syntactic change classification
 * - RDF graph diff capabilities
 * - Performance-optimized retrieval
 */

import { cas, CID } from '../cas/cas-core.js';
import { canonicalProcessor } from '../rdf/canonical-processor-cas.js';
import { SemanticDriftAnalyzer } from '../../../packages/kgen-core/src/validation/semantic-drift-analyzer.js';
import { create, diff, patch, unpatch, reverse } from 'jsondiffpatch';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { consola } from 'consola';
import crypto from 'crypto';

/**
 * Drift URI Scheme Configuration
 */
const DRIFT_URI_CONFIG = {
  schemes: {
    hash: 'drift://hash/{cid}',
    semantic: 'drift://semantic/{type}/{id}', 
    temporal: 'drift://temporal/{timestamp}/{id}',
    rdf: 'drift://rdf/{format}/{hash}',
    canonical: 'drift://canonical/{cid}'
  },
  storage: {
    patchDirectory: '.kgen/patches',
    maxPatchSize: 1024 * 1024, // 1MB
    compressionThreshold: 1024, // 1KB
    retentionDays: 30
  },
  performance: {
    cachePatches: true,
    enableCompression: true,
    batchSize: 10
  }
};

/**
 * Drift URI Resolver for Content-Addressed Semantic Patches
 */
export class DriftURIResolver {
  constructor(config = {}) {
    this.config = { ...DRIFT_URI_CONFIG, ...config };
    this.logger = consola.withTag('drift-uri');
    
    // Initialize jsondiffpatch with semantic-aware configuration
    this.diffPatcher = create({
      objectHash: (obj, index) => {
        // Custom object hashing for better semantic stability
        if (obj && obj.id) return obj.id;
        if (obj && obj['@id']) return obj['@id']; // RDF ID
        if (obj && obj.uri) return obj.uri;
        return '$$index:' + index;
      },
      arrays: {
        detectMove: true,
        includeValueOnMove: false
      },
      textDiff: {
        minLength: 60
      },
      propertyFilter: (name, context) => {
        // Filter out non-semantic properties
        const nonSemanticProps = ['_timestamp', '_version', '_metadata'];
        return !nonSemanticProps.includes(name);
      }
    });
    
    // Semantic analyzer for change classification
    this.semanticAnalyzer = null;
    
    // Performance metrics
    this.metrics = {
      patchesStored: 0,
      patchesRetrieved: 0,
      cacheHits: 0,
      averageRetrievalTime: 0,
      storageEfficiency: 0
    };
    
    // Initialize storage
    this.initializeStorage();
  }

  /**
   * Initialize storage and semantic analyzer
   */
  async initializeStorage() {
    try {
      await mkdir(this.config.storage.patchDirectory, { recursive: true });
      
      this.semanticAnalyzer = new SemanticDriftAnalyzer({
        enableSemanticAnalysis: true,
        enableSHACLValidation: true,
        enableCAS: true,
        semanticThreshold: 0.1
      });
      
      await this.semanticAnalyzer.initialize();
      this.logger.info('Drift URI Resolver initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Drift URI Resolver:', error);
      throw error;
    }
  }

  /**
   * Store semantic patch and return drift:// URI
   * @param {Object} baselineData - Original data
   * @param {Object} currentData - Modified data  
   * @param {Object} options - Storage options
   * @returns {Promise<{uri: string, patch: Object, metadata: Object}>}
   */
  async storePatch(baselineData, currentData, options = {}) {
    const startTime = performance.now();
    
    try {
      // Generate semantic patch
      const patch = this.diffPatcher.diff(baselineData, currentData);
      if (!patch) {
        return { uri: null, patch: null, metadata: { identical: true } };
      }

      // Analyze semantic significance
      const semanticAnalysis = await this.analyzeSemanticChange(baselineData, currentData, patch);
      
      // Generate content-addressed storage
      const patchContent = JSON.stringify(patch);
      const patchCID = await cas.generateCID(patchContent);
      
      // Create patch metadata
      const metadata = {
        cid: patchCID.toString(),
        timestamp: this.getDeterministicDate().toISOString(),
        size: patchContent.length,
        compressed: patchContent.length > this.config.storage.compressionThreshold,
        semantic: semanticAnalysis,
        type: semanticAnalysis.type,
        significance: semanticAnalysis.significance,
        operations: this.categorizeOperations(patch),
        format: options.format || 'json',
        source: options.source || 'unknown'
      };

      // Store patch with CAS
      await cas.store(patchContent);
      
      // Store metadata separately
      const metadataPath = join(this.config.storage.patchDirectory, `${patchCID.toString()}.meta.json`);
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Generate appropriate drift:// URI based on semantic analysis
      const uri = this.generateDriftURI(patchCID, metadata);
      
      // Update metrics
      this.metrics.patchesStored++;
      this.updateStorageEfficiency();
      
      this.logger.debug(`Stored patch: ${uri} (${patchContent.length} bytes)`);
      
      return {
        uri,
        patch,
        metadata: {
          ...metadata,
          storageTime: performance.now() - startTime
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to store patch: ${error.message}`);
    }
  }

  /**
   * Retrieve patch by drift:// URI
   * @param {string} driftURI - Drift URI (e.g., drift://hash/QmXYZ)
   * @returns {Promise<{patch: Object, metadata: Object, applied?: Object}>}
   */
  async retrievePatch(driftURI) {
    const startTime = performance.now();
    this.metrics.patchesRetrieved++;
    
    try {
      const uriComponents = this.parseDriftURI(driftURI);
      
      let patch, metadata;
      
      switch (uriComponents.scheme) {
        case 'hash':
          ({ patch, metadata } = await this.retrieveByHash(uriComponents.id));
          break;
          
        case 'semantic':
          ({ patch, metadata } = await this.retrieveBySemantic(uriComponents.type, uriComponents.id));
          break;
          
        case 'temporal':
          ({ patch, metadata } = await this.retrieveByTemporal(uriComponents.timestamp, uriComponents.id));
          break;
          
        case 'rdf':
          ({ patch, metadata } = await this.retrieveRDFPatch(uriComponents.format, uriComponents.hash));
          break;
          
        case 'canonical':
          ({ patch, metadata } = await this.retrieveCanonicalPatch(uriComponents.cid));
          break;
          
        default:
          throw new Error(`Unsupported drift URI scheme: ${uriComponents.scheme}`);
      }
      
      // Update performance metrics
      this.updateRetrievalTime(performance.now() - startTime);
      
      return {
        patch,
        metadata: {
          ...metadata,
          retrievalTime: performance.now() - startTime,
          uri: driftURI
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to retrieve patch from ${driftURI}: ${error.message}`);
    }
  }

  /**
   * Apply patch to baseline data
   * @param {Object} baselineData - Data to apply patch to
   * @param {string|Object} patchOrURI - Patch object or drift:// URI
   * @returns {Promise<{result: Object, metadata: Object}>}
   */
  async applyPatch(baselineData, patchOrURI) {
    try {
      let patch, metadata;
      
      if (typeof patchOrURI === 'string' && patchOrURI.startsWith('drift://')) {
        ({ patch, metadata } = await this.retrievePatch(patchOrURI));
      } else {
        patch = patchOrURI;
        metadata = { source: 'direct' };
      }
      
      // Apply patch using jsondiffpatch
      const result = this.diffPatcher.patch(JSON.parse(JSON.stringify(baselineData)), patch);
      
      return {
        result,
        metadata: {
          ...metadata,
          appliedAt: this.getDeterministicDate().toISOString(),
          baselineHash: await cas.calculateHash(JSON.stringify(baselineData)),
          resultHash: await cas.calculateHash(JSON.stringify(result))
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to apply patch: ${error.message}`);
    }
  }

  /**
   * Generate reverse patch for rollback
   * @param {Object} originalData - Original data
   * @param {Object} modifiedData - Modified data
   * @returns {Promise<{uri: string, patch: Object}>}
   */
  async generateReversePatch(originalData, modifiedData) {
    try {
      const forwardPatch = this.diffPatcher.diff(originalData, modifiedData);
      if (!forwardPatch) return null;
      
      const reversePatch = this.diffPatcher.reverse(forwardPatch);
      
      const { uri } = await this.storePatch(modifiedData, originalData, {
        source: 'reverse-patch',
        format: 'json'
      });
      
      return { uri, patch: reversePatch };
      
    } catch (error) {
      throw new Error(`Failed to generate reverse patch: ${error.message}`);
    }
  }

  /**
   * Analyze semantic significance of changes
   * @param {Object} baseline - Original data
   * @param {Object} current - Modified data
   * @param {Object} patch - Generated patch
   * @returns {Promise<Object>} Semantic analysis result
   */
  async analyzeSemanticChange(baseline, current, patch) {
    try {
      // Use semantic analyzer for RDF/structured data
      if (this.isStructuredData(baseline) || this.isStructuredData(current)) {
        const analysis = await this.semanticAnalyzer.performSemanticAnalysis(
          JSON.stringify(baseline),
          JSON.stringify(current),
          'json'
        );
        
        return {
          type: analysis.hasChanges ? (analysis.significance > 0.1 ? 'semantic' : 'cosmetic') : 'none',
          significance: analysis.significance,
          changes: analysis.changes,
          reasons: analysis.reasons,
          hasStructuralChanges: analysis.hasChanges
        };
      }
      
      // Fallback to heuristic-based analysis
      const operations = this.categorizeOperations(patch);
      const significance = this.calculateHeuristicSignificance(operations);
      
      return {
        type: significance > 0.3 ? 'semantic' : 'cosmetic',
        significance,
        operations,
        hasStructuralChanges: operations.structural > 0
      };
      
    } catch (error) {
      this.logger.warn('Semantic analysis failed, using fallback:', error.message);
      return {
        type: 'unknown',
        significance: 0.5,
        error: error.message
      };
    }
  }

  /**
   * Generate appropriate drift:// URI based on patch characteristics
   * @param {CID} cid - Content identifier
   * @param {Object} metadata - Patch metadata
   * @returns {string} Drift URI
   */
  generateDriftURI(cid, metadata) {
    const cidStr = cid.toString();
    
    // Use semantic URI for high-significance changes
    if (metadata.semantic?.significance > 0.3) {
      return `drift://semantic/${metadata.semantic.type}/${cidStr}`;
    }
    
    // Use RDF URI for RDF format patches
    if (metadata.format && ['turtle', 'jsonld', 'rdfxml'].includes(metadata.format)) {
      return `drift://rdf/${metadata.format}/${cidStr}`;
    }
    
    // Default to hash-based URI
    return `drift://hash/${cidStr}`;
  }

  /**
   * Parse drift:// URI into components
   * @param {string} uri - Drift URI
   * @returns {Object} URI components
   */
  parseDriftURI(uri) {
    if (!uri.startsWith('drift://')) {
      throw new Error(`Invalid drift URI: ${uri}`);
    }
    
    const parts = uri.substring(8).split('/');
    const scheme = parts[0];
    
    switch (scheme) {
      case 'hash':
        return { scheme, id: parts[1] };
      case 'semantic':
        return { scheme, type: parts[1], id: parts[2] };
      case 'temporal':
        return { scheme, timestamp: parts[1], id: parts[2] };
      case 'rdf':
        return { scheme, format: parts[1], hash: parts[2] };
      case 'canonical':
        return { scheme, cid: parts[1] };
      default:
        throw new Error(`Unknown drift URI scheme: ${scheme}`);
    }
  }

  /**
   * Retrieve patch by content hash
   */
  async retrieveByHash(hash) {
    const patchContent = await cas.retrieve(hash);
    if (!patchContent) {
      throw new Error(`Patch not found: ${hash}`);
    }
    
    const patch = JSON.parse(new TextDecoder().decode(patchContent));
    const metadataPath = join(this.config.storage.patchDirectory, `${hash}.meta.json`);
    
    let metadata = {};
    try {
      metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    } catch {
      metadata = { source: 'legacy', cid: hash };
    }
    
    return { patch, metadata };
  }

  /**
   * Retrieve patch by semantic classification
   */
  async retrieveBySemantic(type, id) {
    // This would typically query a semantic index
    // For now, delegate to hash-based retrieval
    return this.retrieveByHash(id);
  }

  /**
   * Retrieve patch by timestamp
   */
  async retrieveByTemporal(timestamp, id) {
    // This would typically query a temporal index
    // For now, delegate to hash-based retrieval  
    return this.retrieveByHash(id);
  }

  /**
   * Retrieve RDF-specific patch
   */
  async retrieveRDFPatch(format, hash) {
    const { patch, metadata } = await this.retrieveByHash(hash);
    
    // Enhance with RDF-specific processing
    if (format && this.isRDFFormat(format)) {
      metadata.rdfFormat = format;
      metadata.processedAsRDF = true;
    }
    
    return { patch, metadata };
  }

  /**
   * Retrieve canonical form patch
   */
  async retrieveCanonicalPatch(cid) {
    return this.retrieveByHash(cid);
  }

  /**
   * Categorize patch operations
   */
  categorizeOperations(patch) {
    const operations = {
      additions: 0,
      deletions: 0,
      modifications: 0,
      moves: 0,
      structural: 0,
      cosmetic: 0
    };
    
    const countOperations = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          if (value.length === 2) {
            operations.modifications++;
          } else if (value.length === 1) {
            operations.additions++;
          } else if (value.length === 3 && value[2] === 0) {
            operations.deletions++;
          }
        } else if (typeof value === 'object' && value !== null) {
          if (value._t === 'a') {
            // Array change
            operations.structural++;
          } else {
            countOperations(value, `${path}.${key}`);
          }
        }
      }
    };
    
    countOperations(patch);
    
    return operations;
  }

  /**
   * Calculate heuristic significance score
   */
  calculateHeuristicSignificance(operations) {
    const weights = {
      structural: 0.8,
      deletions: 0.6,
      modifications: 0.4,
      additions: 0.3,
      moves: 0.2,
      cosmetic: 0.1
    };
    
    let score = 0;
    let total = 0;
    
    for (const [type, count] of Object.entries(operations)) {
      if (weights[type]) {
        score += weights[type] * count;
        total += count;
      }
    }
    
    return total > 0 ? Math.min(score / total, 1.0) : 0.0;
  }

  /**
   * Check if data is structured (RDF-like)
   */
  isStructuredData(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Check for common RDF/semantic patterns
    return (
      data['@context'] || 
      data['@id'] ||
      data['@type'] ||
      data.id ||
      data.uri ||
      (Array.isArray(data) && data.some(item => 
        item && (item['@id'] || item.id || item.uri)
      ))
    );
  }

  /**
   * Check if format is RDF
   */
  isRDFFormat(format) {
    return ['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld'].includes(format);
  }

  /**
   * Update storage efficiency metric
   */
  updateStorageEfficiency() {
    // Simple efficiency calculation based on compression and deduplication
    this.metrics.storageEfficiency = Math.min(
      (this.metrics.cacheHits / Math.max(this.metrics.patchesRetrieved, 1)) * 0.7 +
      (this.metrics.patchesStored > 0 ? 0.3 : 0),
      1.0
    );
  }

  /**
   * Update retrieval time metric
   */
  updateRetrievalTime(time) {
    this.metrics.averageRetrievalTime = 
      (this.metrics.averageRetrievalTime * (this.metrics.patchesRetrieved - 1) + time) / 
      this.metrics.patchesRetrieved;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      casMetrics: cas.getMetrics(),
      lastUpdated: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Cleanup old patches based on retention policy
   */
  async cleanup() {
    const retentionMs = this.config.storage.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = this.getDeterministicTimestamp() - retentionMs;
    
    // This would implement cleanup logic for old patches
    // For now, just log the intent
    this.logger.info(`Cleanup would remove patches older than ${this.config.storage.retentionDays} days`);
  }

  /**
   * Shutdown resolver and cleanup resources
   */
  async shutdown() {
    await this.cleanup();
    this.logger.info('Drift URI Resolver shutdown complete');
  }
}

// Export singleton instance
export const driftURIResolver = new DriftURIResolver();

// Export utilities
export { create as createDiffPatcher } from 'jsondiffpatch';
export * from '../cas/cas-core.js';