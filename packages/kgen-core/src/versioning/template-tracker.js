/**
 * Template Version Tracker - Tracks template and rule versions with cryptographic integrity
 * 
 * Provides comprehensive version tracking for templates and rules with cryptographic
 * verification, dependency tracking, and semantic relationship management.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class TemplateVersionTracker {
  constructor(config = {}) {
    this.config = {
      storageLocation: config.storageLocation || './.kgen/versioning',
      enableCryptographicIntegrity: config.enableCryptographicIntegrity !== false,
      enableSemanticTracking: config.enableSemanticTracking !== false,
      versioningStrategy: config.versioningStrategy || 'semantic', // semantic, timestamp, hash
      retentionPolicy: config.retentionPolicy || 'all', // all, latest, time-based
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      signatureAlgorithm: config.signatureAlgorithm || 'RSA-SHA256',
      ...config
    };
    
    this.logger = consola.withTag('template-tracker');
    this.cryptoManager = config.cryptoManager;
    
    // Version storage
    this.templateVersions = new Map(); // templateId -> versions array
    this.ruleVersions = new Map();     // ruleId -> versions array
    this.dependencies = new Map();     // id -> dependency graph
    this.signatures = new Map();       // id -> signature data
    
    // Version indices
    this.indices = {
      byHash: new Map(),      // contentHash -> version info
      byFamily: new Map(),    // familyId -> Set of template/rule IDs
      byTag: new Map(),       // tag -> Set of versions
      byTimestamp: []         // Sorted chronological index
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the template version tracker
   */
  async initialize() {
    try {
      this.logger.info('Initializing template version tracker...');
      
      // Ensure storage directory exists
      await fs.mkdir(this.config.storageLocation, { recursive: true });
      
      // Load existing version data
      await this._loadVersionData();
      
      this.initialized = true;
      this.logger.success('Template version tracker initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize template tracker:', error);
      throw error;
    }
  }

  /**
   * Track template version with full metadata
   * @param {Object} templateInfo - Template information
   * @returns {Promise<Object>} Version tracking result
   */
  async trackTemplateVersion(templateInfo) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logger.debug(`Tracking template version: ${templateInfo.id}`);
      
      const version = await this._createVersionRecord(templateInfo, 'template');
      
      // Store version
      if (!this.templateVersions.has(templateInfo.id)) {
        this.templateVersions.set(templateInfo.id, []);
      }
      
      const versions = this.templateVersions.get(templateInfo.id);
      versions.push(version);
      
      // Sort versions by creation time
      versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Update indices
      await this._updateIndices(version, 'template');
      
      // Track dependencies
      if (templateInfo.dependencies) {
        await this._trackDependencies(templateInfo.id, templateInfo.dependencies, version);
      }
      
      // Generate cryptographic signature if enabled
      if (this.config.enableCryptographicIntegrity && this.cryptoManager) {
        const signature = await this._signVersion(version);
        this.signatures.set(version.versionId, signature);
        version.signature = signature;
      }
      
      // Persist version data
      await this._persistVersionData(templateInfo.id, version, 'template');
      
      const result = {
        templateId: templateInfo.id,
        versionId: version.versionId,
        version: version.version,
        contentHash: version.contentHash,
        signed: !!version.signature,
        dependencies: version.dependencies?.length || 0
      };
      
      this.logger.debug(`Template version tracked: ${templateInfo.id} v${version.version}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to track template version ${templateInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Track rule version with semantic metadata
   * @param {Object} ruleInfo - Rule information
   * @returns {Promise<Object>} Version tracking result
   */
  async trackRuleVersion(ruleInfo) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logger.debug(`Tracking rule version: ${ruleInfo.id}`);
      
      const version = await this._createVersionRecord(ruleInfo, 'rule');
      
      // Add rule-specific metadata
      version.ruleType = ruleInfo.type || 'unknown';
      version.priority = ruleInfo.priority || 0;
      version.semanticContext = ruleInfo.semanticContext || {};
      version.conditions = ruleInfo.conditions || [];
      version.actions = ruleInfo.actions || [];
      
      // Store version
      if (!this.ruleVersions.has(ruleInfo.id)) {
        this.ruleVersions.set(ruleInfo.id, []);
      }
      
      const versions = this.ruleVersions.get(ruleInfo.id);
      versions.push(version);
      versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Update indices
      await this._updateIndices(version, 'rule');
      
      // Track rule dependencies and conflicts
      if (ruleInfo.dependencies) {
        await this._trackDependencies(ruleInfo.id, ruleInfo.dependencies, version);
      }
      
      if (ruleInfo.conflicts) {
        await this._trackConflicts(ruleInfo.id, ruleInfo.conflicts, version);
      }
      
      // Generate signature
      if (this.config.enableCryptographicIntegrity && this.cryptoManager) {
        const signature = await this._signVersion(version);
        this.signatures.set(version.versionId, signature);
        version.signature = signature;
      }
      
      // Persist version data
      await this._persistVersionData(ruleInfo.id, version, 'rule');
      
      const result = {
        ruleId: ruleInfo.id,
        versionId: version.versionId,
        version: version.version,
        ruleType: version.ruleType,
        contentHash: version.contentHash,
        signed: !!version.signature,
        dependencies: version.dependencies?.length || 0,
        conflicts: version.conflicts?.length || 0
      };
      
      this.logger.debug(`Rule version tracked: ${ruleInfo.id} v${version.version}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to track rule version ${ruleInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Get version history for template or rule
   * @param {string} id - Template or rule identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Version history
   */
  async getVersionHistory(id, options = {}) {
    try {
      const {
        includeContent = false,
        includeSignatures = true,
        includeDependencies = true,
        limit = null,
        since = null
      } = options;
      
      // Check both template and rule versions
      let versions = this.templateVersions.get(id) || this.ruleVersions.get(id) || [];
      
      // Apply filters
      if (since) {
        const sinceDate = new Date(since);
        versions = versions.filter(v => new Date(v.createdAt) >= sinceDate);
      }
      
      if (limit) {
        versions = versions.slice(-limit); // Get latest N versions
      }
      
      // Build history response
      const history = {
        id,
        totalVersions: versions.length,
        versions: []
      };
      
      for (const version of versions) {
        const versionData = {
          versionId: version.versionId,
          version: version.version,
          createdAt: version.createdAt,
          createdBy: version.createdBy,
          contentHash: version.contentHash,
          tags: version.tags || [],
          changeLog: version.changeLog || 'No changelog provided'
        };
        
        // Add content if requested
        if (includeContent) {
          versionData.content = version.content;
          versionData.metadata = version.metadata;
        }
        
        // Add signature info if requested
        if (includeSignatures && version.signature) {
          versionData.signature = {
            algorithm: version.signature.algorithm,
            keyFingerprint: version.signature.keyFingerprint,
            signedAt: version.signature.signedAt,
            verified: await this._verifyVersionSignature(version)
          };
        }
        
        // Add dependencies if requested
        if (includeDependencies && version.dependencies) {
          versionData.dependencies = version.dependencies;
        }
        
        // Add rule-specific data if applicable
        if (version.type === 'rule') {
          versionData.ruleType = version.ruleType;
          versionData.priority = version.priority;
          versionData.semanticContext = version.semanticContext;
        }
        
        history.versions.push(versionData);
      }
      
      return history;
      
    } catch (error) {
      this.logger.error(`Failed to get version history for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Verify version integrity
   * @param {string} id - Template or rule identifier
   * @param {string} versionId - Specific version to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyVersionIntegrity(id, versionId = null) {
    try {
      this.logger.debug(`Verifying integrity for: ${id}`);
      
      const versions = this.templateVersions.get(id) || this.ruleVersions.get(id) || [];
      const versionsToVerify = versionId 
        ? versions.filter(v => v.versionId === versionId)
        : versions;
      
      if (versionsToVerify.length === 0) {
        throw new Error(`No versions found for ${id}`);
      }
      
      const verification = {
        id,
        totalVersions: versionsToVerify.length,
        verifiedVersions: 0,
        failedVersions: 0,
        results: [],
        overallValid: true
      };
      
      for (const version of versionsToVerify) {
        const result = {
          versionId: version.versionId,
          version: version.version,
          checks: {
            contentHash: false,
            signature: false,
            dependencies: false
          },
          valid: true,
          errors: []
        };
        
        // Verify content hash
        const expectedHash = this._calculateContentHash(version.content);
        result.checks.contentHash = expectedHash === version.contentHash;
        if (!result.checks.contentHash) {
          result.valid = false;
          result.errors.push('Content hash mismatch');
        }
        
        // Verify signature if present
        if (version.signature && this.cryptoManager) {
          result.checks.signature = await this._verifyVersionSignature(version);
          if (!result.checks.signature) {
            result.valid = false;
            result.errors.push('Signature verification failed');
          }
        } else {
          result.checks.signature = true; // Skip if not signed
        }
        
        // Verify dependencies exist
        if (version.dependencies) {
          result.checks.dependencies = await this._verifyDependencies(version.dependencies);
          if (!result.checks.dependencies) {
            result.valid = false;
            result.errors.push('Dependency verification failed');
          }
        } else {
          result.checks.dependencies = true;
        }
        
        if (result.valid) {
          verification.verifiedVersions++;
        } else {
          verification.failedVersions++;
          verification.overallValid = false;
        }
        
        verification.results.push(result);
      }
      
      this.logger.debug(`Integrity verification: ${verification.verifiedVersions}/${verification.totalVersions} valid`);
      
      return verification;
      
    } catch (error) {
      this.logger.error(`Failed to verify integrity for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get dependency graph for template or rule
   * @param {string} id - Template or rule identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Dependency graph
   */
  async getDependencyGraph(id, options = {}) {
    try {
      const {
        maxDepth = 5,
        includeTransitive = true,
        includeConflicts = false
      } = options;
      
      const graph = {
        root: id,
        nodes: [],
        edges: [],
        depth: 0,
        conflicts: []
      };
      
      const visited = new Set();
      await this._buildDependencyGraph(id, graph, visited, 0, maxDepth, includeTransitive);
      
      // Add conflict information if requested
      if (includeConflicts) {
        graph.conflicts = await this._getConflicts(id);
      }
      
      return graph;
      
    } catch (error) {
      this.logger.error(`Failed to get dependency graph for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get version compatibility matrix
   * @param {Array} templateIds - Template/rule identifiers to check
   * @returns {Promise<Object>} Compatibility matrix
   */
  async getCompatibilityMatrix(templateIds) {
    try {
      const matrix = {
        templates: templateIds,
        compatibility: {},
        conflicts: [],
        recommendations: []
      };
      
      // Build compatibility matrix
      for (let i = 0; i < templateIds.length; i++) {
        const idA = templateIds[i];
        matrix.compatibility[idA] = {};
        
        for (let j = 0; j < templateIds.length; j++) {
          const idB = templateIds[j];
          
          if (i === j) {
            matrix.compatibility[idA][idB] = 'self';
          } else {
            const compatibility = await this._checkCompatibility(idA, idB);
            matrix.compatibility[idA][idB] = compatibility.level;
            
            if (compatibility.conflicts.length > 0) {
              matrix.conflicts.push({
                templateA: idA,
                templateB: idB,
                conflicts: compatibility.conflicts
              });
            }
          }
        }
      }
      
      // Generate recommendations
      matrix.recommendations = this._generateCompatibilityRecommendations(matrix);
      
      return matrix;
      
    } catch (error) {
      this.logger.error('Failed to generate compatibility matrix:', error);
      throw error;
    }
  }

  /**
   * Get tracker statistics
   * @returns {Object} Tracker statistics
   */
  getStatistics() {
    const stats = {
      templates: {
        total: this.templateVersions.size,
        totalVersions: 0,
        signedVersions: 0
      },
      rules: {
        total: this.ruleVersions.size,
        totalVersions: 0,
        signedVersions: 0
      },
      indices: {
        byHash: this.indices.byHash.size,
        byFamily: this.indices.byFamily.size,
        byTag: this.indices.byTag.size,
        byTimestamp: this.indices.byTimestamp.length
      },
      configuration: this.config
    };
    
    // Count template versions and signatures
    for (const versions of this.templateVersions.values()) {
      stats.templates.totalVersions += versions.length;
      stats.templates.signedVersions += versions.filter(v => v.signature).length;
    }
    
    // Count rule versions and signatures
    for (const versions of this.ruleVersions.values()) {
      stats.rules.totalVersions += versions.length;
      stats.rules.signedVersions += versions.filter(v => v.signature).length;
    }
    
    return stats;
  }

  // Private methods

  async _createVersionRecord(info, type) {
    const versionId = uuidv4();
    const content = typeof info.content === 'string' ? info.content : JSON.stringify(info.content, null, 2);
    const contentHash = this._calculateContentHash(content);
    
    // Determine version number
    const existingVersions = type === 'template' 
      ? this.templateVersions.get(info.id) || []
      : this.ruleVersions.get(info.id) || [];
    
    let versionNumber;
    if (this.config.versioningStrategy === 'semantic') {
      versionNumber = this._generateSemanticVersion(existingVersions, info);
    } else if (this.config.versioningStrategy === 'timestamp') {
      versionNumber = new Date().toISOString();
    } else {
      versionNumber = contentHash.substring(0, 8);
    }
    
    const version = {
      versionId,
      id: info.id,
      type,
      version: versionNumber,
      content,
      contentHash,
      
      // Metadata
      createdAt: new Date().toISOString(),
      createdBy: info.createdBy || 'system',
      tags: info.tags || [],
      changeLog: info.changeLog || '',
      
      // Technical metadata
      metadata: {
        filePath: info.filePath,
        fileSize: Buffer.byteLength(content, 'utf8'),
        encoding: 'utf8',
        lineCount: content.split('\n').length
      },
      
      // Dependencies
      dependencies: info.dependencies || [],
      conflicts: info.conflicts || [],
      
      // Family information
      family: info.family || info.id,
      derivedFrom: info.derivedFrom || null,
      
      // Signature placeholder
      signature: null
    };
    
    return version;
  }

  async _updateIndices(version, type) {
    // Update hash index
    this.indices.byHash.set(version.contentHash, {
      id: version.id,
      versionId: version.versionId,
      type
    });
    
    // Update family index
    if (!this.indices.byFamily.has(version.family)) {
      this.indices.byFamily.set(version.family, new Set());
    }
    this.indices.byFamily.get(version.family).add(version.id);
    
    // Update tag indices
    for (const tag of version.tags) {
      if (!this.indices.byTag.has(tag)) {
        this.indices.byTag.set(tag, new Set());
      }
      this.indices.byTag.get(tag).add(version.versionId);
    }
    
    // Update timestamp index
    this.indices.byTimestamp.push({
      timestamp: version.createdAt,
      id: version.id,
      versionId: version.versionId,
      type
    });
    
    this.indices.byTimestamp.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async _trackDependencies(id, dependencies, version) {
    const dependencyData = {
      id,
      versionId: version.versionId,
      dependencies: dependencies.map(dep => ({
        id: dep.id || dep,
        type: dep.type || 'unknown',
        version: dep.version || 'latest',
        required: dep.required !== false
      })),
      trackedAt: new Date().toISOString()
    };
    
    this.dependencies.set(version.versionId, dependencyData);
  }

  async _trackConflicts(id, conflicts, version) {
    version.conflicts = conflicts.map(conflict => ({
      id: conflict.id || conflict,
      type: conflict.type || 'incompatible',
      reason: conflict.reason || 'Unknown conflict',
      severity: conflict.severity || 'medium'
    }));
  }

  async _signVersion(version) {
    if (!this.cryptoManager) {
      throw new Error('Crypto manager required for signing');
    }
    
    const signingData = {
      versionId: version.versionId,
      id: version.id,
      version: version.version,
      contentHash: version.contentHash,
      createdAt: version.createdAt
    };
    
    const signature = await this.cryptoManager.signData(signingData);
    
    return {
      algorithm: this.config.signatureAlgorithm,
      signature,
      keyFingerprint: this.cryptoManager.keyMetadata?.fingerprint,
      signedAt: new Date().toISOString()
    };
  }

  async _verifyVersionSignature(version) {
    if (!version.signature || !this.cryptoManager) {
      return false;
    }
    
    const signingData = {
      versionId: version.versionId,
      id: version.id,
      version: version.version,
      contentHash: version.contentHash,
      createdAt: version.createdAt
    };
    
    return await this.cryptoManager.verifySignature(signingData, version.signature.signature);
  }

  _calculateContentHash(content) {
    return crypto.createHash(this.config.hashAlgorithm)
      .update(content, 'utf8')
      .digest('hex');
  }

  _generateSemanticVersion(existingVersions, info) {
    if (existingVersions.length === 0) {
      return '1.0.0';
    }
    
    // Simple semantic versioning logic
    const latest = existingVersions[existingVersions.length - 1];
    const [major, minor, patch] = latest.version.split('.').map(Number);
    
    if (info.breaking) {
      return `${major + 1}.0.0`;
    } else if (info.feature) {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  }

  async _loadVersionData() {
    // Load templates
    const templatesFile = path.join(this.config.storageLocation, 'templates.json');
    if (await this._fileExists(templatesFile)) {
      try {
        const data = await fs.readFile(templatesFile, 'utf8');
        const templates = JSON.parse(data);
        
        for (const [id, versions] of Object.entries(templates)) {
          this.templateVersions.set(id, versions);
          
          // Rebuild indices
          for (const version of versions) {
            await this._updateIndices(version, 'template');
          }
        }
      } catch (error) {
        this.logger.warn('Failed to load template versions:', error);
      }
    }
    
    // Load rules
    const rulesFile = path.join(this.config.storageLocation, 'rules.json');
    if (await this._fileExists(rulesFile)) {
      try {
        const data = await fs.readFile(rulesFile, 'utf8');
        const rules = JSON.parse(data);
        
        for (const [id, versions] of Object.entries(rules)) {
          this.ruleVersions.set(id, versions);
          
          // Rebuild indices
          for (const version of versions) {
            await this._updateIndices(version, 'rule');
          }
        }
      } catch (error) {
        this.logger.warn('Failed to load rule versions:', error);
      }
    }
  }

  async _persistVersionData(id, version, type) {
    const filename = type === 'template' ? 'templates.json' : 'rules.json';
    const filePath = path.join(this.config.storageLocation, filename);
    const storage = type === 'template' ? this.templateVersions : this.ruleVersions;
    
    try {
      const data = Object.fromEntries(storage);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.warn(`Failed to persist ${type} version data:`, error);
    }
  }

  async _verifyDependencies(dependencies) {
    for (const dep of dependencies) {
      const exists = this.templateVersions.has(dep.id) || this.ruleVersions.has(dep.id);
      if (!exists) {
        return false;
      }
    }
    return true;
  }

  async _buildDependencyGraph(id, graph, visited, depth, maxDepth, includeTransitive) {
    if (visited.has(id) || depth >= maxDepth) {
      return;
    }
    
    visited.add(id);
    graph.depth = Math.max(graph.depth, depth);
    
    // Add node
    const nodeExists = graph.nodes.find(n => n.id === id);
    if (!nodeExists) {
      graph.nodes.push({
        id,
        type: this.templateVersions.has(id) ? 'template' : 'rule',
        depth
      });
    }
    
    // Find dependencies
    const dependencies = this.dependencies.get(id);
    if (dependencies && includeTransitive) {
      for (const dep of dependencies.dependencies) {
        // Add edge
        graph.edges.push({
          from: id,
          to: dep.id,
          type: 'dependency',
          required: dep.required
        });
        
        // Recurse
        await this._buildDependencyGraph(dep.id, graph, visited, depth + 1, maxDepth, includeTransitive);
      }
    }
  }

  async _checkCompatibility(idA, idB) {
    // Simple compatibility check
    const result = {
      level: 'compatible',
      conflicts: []
    };
    
    // Check for explicit conflicts
    const versionsA = this.templateVersions.get(idA) || this.ruleVersions.get(idA) || [];
    const versionsB = this.templateVersions.get(idB) || this.ruleVersions.get(idB) || [];
    
    for (const versionA of versionsA) {
      for (const conflict of versionA.conflicts || []) {
        if (conflict.id === idB) {
          result.level = 'incompatible';
          result.conflicts.push(conflict.reason || 'Explicit conflict');
        }
      }
    }
    
    return result;
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Stub implementations
  async _getConflicts(id) { return []; }
  _generateCompatibilityRecommendations(matrix) { return []; }
}

export default TemplateVersionTracker;