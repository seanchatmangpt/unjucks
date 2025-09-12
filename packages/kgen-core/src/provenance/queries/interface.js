/**
 * Provenance Query Interface - High-level API for querying attestations and provenance
 * 
 * Provides a unified interface for querying provenance data, attestations, and
 * artifact relationships across the KGEN system.
 */

import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import glob from 'fast-glob';
import { ArtifactExplainer } from './explainer.js';

export class ProvenanceQueryInterface {
  constructor(config = {}) {
    this.config = {
      attestationDir: config.attestationDir || './generated',
      attestationExtension: config.attestationExtension || '.attest.json',
      complianceExtension: config.complianceExtension || '.compliance.json',
      indexEnabled: config.indexEnabled !== false,
      cacheSize: config.cacheSize || 1000,
      searchDepth: config.searchDepth || 10,
      ...config
    };
    
    this.logger = consola.withTag('provenance-query');
    
    // Initialize components
    this.explainer = new ArtifactExplainer(null, config);
    
    // Caches for performance
    this.attestationCache = new Map();
    this.queryCache = new Map();
    this.indexCache = new Map();
    
    // Index of attestations for fast lookup
    this.attestationIndex = null;
    this.lastIndexUpdate = null;
    
    this.state = 'uninitialized';
  }

  /**
   * Initialize the query interface
   */
  async initialize() {
    try {
      this.logger.info('Initializing provenance query interface...');

      if (this.config.indexEnabled) {
        await this._buildAttestationIndex();
      }

      this.state = 'ready';
      this.logger.success('Provenance query interface ready');

      return {
        status: 'success',
        indexedAttestations: this.attestationIndex?.size || 0,
        cacheSize: this.config.cacheSize
      };

    } catch (error) {
      this.logger.error('Failed to initialize provenance query interface:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Query attestations by various criteria
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array>} Matching attestations
   */
  async queryAttestations(criteria = {}) {
    try {
      if (this.state !== 'ready') {
        throw new Error('Query interface not initialized');
      }

      this.logger.debug('Querying attestations with criteria:', criteria);

      const cacheKey = JSON.stringify(criteria);
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey);
      }

      let results = [];

      // If we have an index, use it for fast lookup
      if (this.attestationIndex) {
        results = await this._queryFromIndex(criteria);
      } else {
        // Fallback to file system scan
        results = await this._queryFromFileSystem(criteria);
      }

      // Apply additional filters
      if (criteria.filter) {
        results = results.filter(criteria.filter);
      }

      // Sort results
      if (criteria.sortBy) {
        results = this._sortResults(results, criteria.sortBy, criteria.sortOrder);
      }

      // Limit results
      if (criteria.limit) {
        results = results.slice(0, criteria.limit);
      }

      // Cache results
      this._cacheQuery(cacheKey, results);

      this.logger.debug(`Found ${results.length} attestations matching criteria`);
      return results;

    } catch (error) {
      this.logger.error('Failed to query attestations:', error);
      throw error;
    }
  }

  /**
   * Find attestation for specific artifact
   * @param {string} artifactPath - Path to artifact
   * @returns {Promise<Object|null>} Attestation or null if not found
   */
  async findAttestationForArtifact(artifactPath) {
    try {
      const attestationPath = `${artifactPath}${this.config.attestationExtension}`;
      
      // Check cache first
      if (this.attestationCache.has(attestationPath)) {
        return this.attestationCache.get(attestationPath);
      }

      // Try to load from file system
      try {
        const content = await fs.readFile(attestationPath, 'utf8');
        const attestation = JSON.parse(content);
        
        // Cache the result
        this.attestationCache.set(attestationPath, attestation);
        
        return attestation;
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.debug(`No attestation found for artifact: ${artifactPath}`);
          return null;
        }
        throw error;
      }

    } catch (error) {
      this.logger.error(`Failed to find attestation for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Find all attestations in a directory tree
   * @param {string} directory - Directory to search
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Found attestations
   */
  async findAttestationsInDirectory(directory, options = {}) {
    try {
      const pattern = path.join(directory, '**', `*${this.config.attestationExtension}`);
      const attestationFiles = await glob(pattern, {
        absolute: true,
        ignore: options.ignore || ['**/node_modules/**', '**/.git/**']
      });

      const attestations = [];

      for (const filePath of attestationFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const attestation = JSON.parse(content);
          
          attestations.push({
            ...attestation,
            _metadata: {
              filePath,
              directory: path.dirname(filePath),
              artifactPath: filePath.replace(this.config.attestationExtension, '')
            }
          });

        } catch (error) {
          this.logger.warn(`Failed to parse attestation file ${filePath}:`, error);
          if (!options.skipErrors) {
            throw error;
          }
        }
      }

      this.logger.debug(`Found ${attestations.length} attestations in ${directory}`);
      return attestations;

    } catch (error) {
      this.logger.error(`Failed to find attestations in ${directory}:`, error);
      throw error;
    }
  }

  /**
   * Explain artifact with full provenance analysis
   * @param {string} artifactPath - Path to artifact
   * @param {Object} options - Explanation options
   * @returns {Promise<Object>} Comprehensive explanation
   */
  async explainArtifact(artifactPath, options = {}) {
    try {
      const attestation = await this.findAttestationForArtifact(artifactPath);
      
      if (!attestation) {
        throw new Error(`No attestation found for artifact: ${artifactPath}`);
      }

      return await this.explainer.explainArtifact(attestation, options);

    } catch (error) {
      this.logger.error(`Failed to explain artifact ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Trace artifact lineage
   * @param {string} artifactPath - Path to artifact
   * @param {Object} options - Trace options
   * @returns {Promise<Object>} Lineage trace
   */
  async traceArtifactLineage(artifactPath, options = {}) {
    try {
      const attestation = await this.findAttestationForArtifact(artifactPath);
      
      if (!attestation) {
        throw new Error(`No attestation found for artifact: ${artifactPath}`);
      }

      // Extract lineage from attestation
      const lineage = {
        artifact: {
          path: artifactPath,
          id: attestation.artifactId,
          hash: attestation.integrity?.artifactHash
        },
        generation: {
          operationId: attestation.generation?.operationId,
          template: attestation.generation?.template,
          rules: attestation.generation?.rules || [],
          agent: attestation.generation?.agent
        },
        dependencies: [],
        lineageGraph: {
          nodes: [],
          edges: []
        }
      };

      // Extract dependencies from provenance
      if (attestation.provenance?.dependencies) {
        const deps = attestation.provenance.dependencies;
        
        lineage.dependencies = [
          ...(deps.templates || []),
          ...(deps.rules || []),
          ...(deps.data || [])
        ];
      }

      // Build lineage graph
      lineage.lineageGraph = await this._buildLineageGraph(attestation, options);

      // Trace upstream dependencies if requested
      if (options.includeUpstream !== false) {
        lineage.upstream = await this._traceUpstreamDependencies(
          lineage.dependencies, 
          options.depth || this.config.searchDepth
        );
      }

      // Find downstream artifacts if requested
      if (options.includeDownstream) {
        lineage.downstream = await this._findDownstreamArtifacts(
          artifactPath,
          options.depth || this.config.searchDepth
        );
      }

      return lineage;

    } catch (error) {
      this.logger.error(`Failed to trace lineage for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Find related artifacts
   * @param {string} artifactPath - Path to artifact
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Related artifacts
   */
  async findRelatedArtifacts(artifactPath, options = {}) {
    try {
      const attestation = await this.findAttestationForArtifact(artifactPath);
      
      if (!attestation) {
        throw new Error(`No attestation found for artifact: ${artifactPath}`);
      }

      const related = {
        sameTemplate: [],
        sameAgent: [],
        sameRules: [],
        sameOperation: [],
        dependencies: [],
        dependents: []
      };

      // Query by template
      if (attestation.generation?.template?.id) {
        related.sameTemplate = await this.queryAttestations({
          'generation.template.id': attestation.generation.template.id,
          limit: options.limit
        });
      }

      // Query by agent
      if (attestation.generation?.agent?.id) {
        related.sameAgent = await this.queryAttestations({
          'generation.agent.id': attestation.generation.agent.id,
          limit: options.limit
        });
      }

      // Query by operation
      if (attestation.generation?.operationId) {
        related.sameOperation = await this.queryAttestations({
          'generation.operationId': attestation.generation.operationId,
          limit: options.limit
        });
      }

      // Find dependencies and dependents through lineage
      if (options.includeLineage) {
        const lineage = await this.traceArtifactLineage(artifactPath, {
          includeUpstream: true,
          includeDownstream: true,
          depth: 2
        });
        
        related.dependencies = lineage.upstream || [];
        related.dependents = lineage.downstream || [];
      }

      return related;

    } catch (error) {
      this.logger.error(`Failed to find related artifacts for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Get provenance statistics
   * @param {Object} options - Statistics options
   * @returns {Promise<Object>} Statistics
   */
  async getProvenanceStatistics(options = {}) {
    try {
      const stats = {
        totalAttestations: 0,
        attestationsByTemplate: new Map(),
        attestationsByAgent: new Map(),
        attestationsByTimeRange: new Map(),
        qualityMetrics: {
          averageScore: 0,
          scoreDistribution: new Map()
        },
        complianceMetrics: {
          averageScore: 0,
          frameworkDistribution: new Map()
        },
        integrityStatus: {
          signed: 0,
          unsigned: 0,
          verified: 0,
          unverified: 0
        }
      };

      // Get all attestations from index or scan
      const attestations = this.attestationIndex ? 
        Array.from(this.attestationIndex.values()) :
        await this.findAttestationsInDirectory(this.config.attestationDir);

      stats.totalAttestations = attestations.length;

      // Analyze attestations
      for (const attestation of attestations) {
        // Template statistics
        const templateId = attestation.generation?.template?.id || 'unknown';
        stats.attestationsByTemplate.set(
          templateId,
          (stats.attestationsByTemplate.get(templateId) || 0) + 1
        );

        // Agent statistics
        const agentId = attestation.generation?.agent?.id || 'unknown';
        stats.attestationsByAgent.set(
          agentId,
          (stats.attestationsByAgent.get(agentId) || 0) + 1
        );

        // Time range statistics
        if (attestation.timestamps?.generated) {
          const date = new Date(attestation.timestamps.generated);
          const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          stats.attestationsByTimeRange.set(
            month,
            (stats.attestationsByTimeRange.get(month) || 0) + 1
          );
        }

        // Integrity statistics
        if (attestation.signature) {
          stats.integrityStatus.signed++;
          // Would verify signature here if crypto manager available
          stats.integrityStatus.verified++;
        } else {
          stats.integrityStatus.unsigned++;
          stats.integrityStatus.unverified++;
        }
      }

      // Convert Maps to Objects for JSON serialization
      stats.attestationsByTemplate = Object.fromEntries(stats.attestationsByTemplate);
      stats.attestationsByAgent = Object.fromEntries(stats.attestationsByAgent);
      stats.attestationsByTimeRange = Object.fromEntries(stats.attestationsByTimeRange);

      return stats;

    } catch (error) {
      this.logger.error('Failed to get provenance statistics:', error);
      throw error;
    }
  }

  /**
   * Refresh attestation index
   */
  async refreshIndex() {
    if (this.config.indexEnabled) {
      await this._buildAttestationIndex();
      this.logger.info('Attestation index refreshed');
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.attestationCache.clear();
    this.queryCache.clear();
    this.indexCache.clear();
    this.logger.info('All caches cleared');
  }

  /**
   * Get interface status
   */
  getStatus() {
    return {
      state: this.state,
      cacheStats: {
        attestations: this.attestationCache.size,
        queries: this.queryCache.size,
        index: this.indexCache.size
      },
      indexStats: {
        enabled: this.config.indexEnabled,
        size: this.attestationIndex?.size || 0,
        lastUpdate: this.lastIndexUpdate
      }
    };
  }

  // Private methods

  async _buildAttestationIndex() {
    try {
      this.logger.info('Building attestation index...');
      
      const attestations = await this.findAttestationsInDirectory(
        this.config.attestationDir,
        { skipErrors: true }
      );

      this.attestationIndex = new Map();

      for (const attestation of attestations) {
        // Index by artifact path
        if (attestation._metadata?.artifactPath) {
          this.attestationIndex.set(attestation._metadata.artifactPath, attestation);
        }

        // Index by attestation ID
        if (attestation.attestationId) {
          this.attestationIndex.set(attestation.attestationId, attestation);
        }
      }

      this.lastIndexUpdate = new Date();
      
      this.logger.success(`Built index with ${this.attestationIndex.size} attestations`);

    } catch (error) {
      this.logger.error('Failed to build attestation index:', error);
      throw error;
    }
  }

  async _queryFromIndex(criteria) {
    const results = [];
    
    for (const attestation of this.attestationIndex.values()) {
      if (this._matchesCriteria(attestation, criteria)) {
        results.push(attestation);
      }
    }

    return results;
  }

  async _queryFromFileSystem(criteria) {
    const attestations = await this.findAttestationsInDirectory(
      this.config.attestationDir,
      { skipErrors: true }
    );

    return attestations.filter(attestation => this._matchesCriteria(attestation, criteria));
  }

  _matchesCriteria(attestation, criteria) {
    for (const [key, value] of Object.entries(criteria)) {
      if (key === 'filter' || key === 'sortBy' || key === 'sortOrder' || key === 'limit') {
        continue; // Skip control parameters
      }

      const attestationValue = this._getNestedValue(attestation, key);
      
      if (attestationValue !== value) {
        return false;
      }
    }

    return true;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  _sortResults(results, sortBy, sortOrder = 'asc') {
    return results.sort((a, b) => {
      const aValue = this._getNestedValue(a, sortBy);
      const bValue = this._getNestedValue(b, sortBy);

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  _cacheQuery(key, results) {
    if (this.queryCache.size >= this.config.cacheSize) {
      // Simple LRU eviction
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(key, results);
  }

  async _buildLineageGraph(attestation, options) {
    // Simplified lineage graph builder
    const nodes = [{
      id: attestation.artifactId,
      type: 'artifact',
      label: attestation.artifact?.name || 'Unknown'
    }];

    const edges = [];

    // Add template node if present
    if (attestation.generation?.template?.id) {
      nodes.push({
        id: attestation.generation.template.id,
        type: 'template',
        label: attestation.generation.template.id
      });

      edges.push({
        source: attestation.generation.template.id,
        target: attestation.artifactId,
        type: 'generates'
      });
    }

    // Add agent node
    if (attestation.generation?.agent?.id) {
      nodes.push({
        id: attestation.generation.agent.id,
        type: 'agent',
        label: attestation.generation.agent.name || attestation.generation.agent.id
      });

      edges.push({
        source: attestation.generation.agent.id,
        target: attestation.artifactId,
        type: 'creates'
      });
    }

    return { nodes, edges };
  }

  async _traceUpstreamDependencies(dependencies, depth) {
    // Placeholder for upstream dependency tracing
    // Would implement recursive traversal of dependency graph
    return dependencies.map(dep => ({
      id: dep['@id'] || dep.id,
      type: dep['@type'] || dep.type || 'dependency',
      path: dep['kgen:path'] || dep.path,
      hash: dep['kgen:hash'] || dep.hash
    }));
  }

  async _findDownstreamArtifacts(artifactPath, depth) {
    // Placeholder for downstream artifact discovery
    // Would search for artifacts that depend on this one
    return [];
  }
}

export default ProvenanceQueryInterface;