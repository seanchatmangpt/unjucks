/**
 * Version Manager - Component version tracking and management
 * 
 * Manages versions for all components in the knowledge generation system:
 * - Templates and their semantic versions
 * - Rule sets and validation schemas
 * - Engine versions and plugin compatibility
 * - External dependencies and their constraints
 * 
 * Provides semantic versioning, dependency resolution, and upgrade paths.
 */

import consola from 'consola';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';

export class VersionManager {
  constructor(config = {}) {
    this.config = {
      versioningScheme: config.versioningScheme || 'semantic', // semantic, timestamp, hash
      allowPrerelease: config.allowPrerelease !== false,
      autoIncrement: config.autoIncrement !== false,
      trackMetadata: config.trackMetadata !== false,
      enableCompatibilityChecks: config.enableCompatibilityChecks !== false,
      registryPath: config.registryPath || './kgen-registry.json',
      ...config
    };

    this.logger = consola.withTag('version-manager');
    
    // Component registries
    this.templateRegistry = new Map();
    this.ruleRegistry = new Map();
    this.schemaRegistry = new Map();
    this.engineRegistry = new Map();
    this.dependencyGraph = new Map();
    
    // Version tracking
    this.versionHistory = new Map();
    this.compatibilityMatrix = new Map();
    this.upgradeStrategies = new Map();
  }

  /**
   * Initialize version manager and load existing registries
   */
  async initialize() {
    try {
      this.logger.info('Initializing version manager...');
      
      // Load existing registry if it exists
      await this._loadRegistry();
      
      // Initialize default entries
      await this._initializeDefaults();
      
      this.logger.success('Version manager initialized successfully');
      
      return {
        status: 'success',
        registeredTemplates: this.templateRegistry.size,
        registeredRules: this.ruleRegistry.size,
        registeredSchemas: this.schemaRegistry.size
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize version manager:', error);
      throw error;
    }
  }

  /**
   * Register a new template version
   * @param {Object} templateInfo - Template information
   * @returns {Promise<Object>} Registration result
   */
  async registerTemplate(templateInfo) {
    try {
      this.logger.info(`Registering template: ${templateInfo.id}`);
      
      const registration = {
        id: templateInfo.id,
        version: templateInfo.version || await this._generateNextVersion(templateInfo.id, 'template'),
        name: templateInfo.name,
        description: templateInfo.description,
        author: templateInfo.author,
        
        // Version metadata
        registeredAt: new Date().toISOString(),
        contentHash: templateInfo.contentHash || await this._calculateContentHash(templateInfo.content),
        dependencies: templateInfo.dependencies || [],
        
        // Compatibility information
        engineCompatibility: templateInfo.engineCompatibility || ['*'],
        ruleCompatibility: templateInfo.ruleCompatibility || [],
        schemaCompatibility: templateInfo.schemaCompatibility || [],
        
        // Metadata
        tags: templateInfo.tags || [],
        category: templateInfo.category,
        deprecated: templateInfo.deprecated || false,
        replacedBy: templateInfo.replacedBy,
        
        // File information
        path: templateInfo.path,
        size: templateInfo.size,
        lastModified: templateInfo.lastModified || new Date().toISOString()
      };

      // Validate version format
      if (!this._isValidVersion(registration.version)) {
        throw new Error(`Invalid version format: ${registration.version}`);
      }

      // Check for version conflicts
      const existingVersions = this._getTemplateVersions(templateInfo.id);
      if (existingVersions.includes(registration.version)) {
        throw new Error(`Template version ${registration.version} already exists for ${templateInfo.id}`);
      }

      // Validate dependencies
      const dependencyValidation = await this._validateDependencies(registration.dependencies);
      if (!dependencyValidation.valid) {
        throw new Error(`Dependency validation failed: ${dependencyValidation.issues.join(', ')}`);
      }

      // Add to registry
      const templateKey = `${templateInfo.id}@${registration.version}`;
      this.templateRegistry.set(templateKey, registration);
      
      // Update version history
      this._updateVersionHistory(templateInfo.id, 'template', registration.version, registration);
      
      // Update compatibility matrix
      await this._updateCompatibilityMatrix(registration);
      
      // Save registry
      await this._saveRegistry();
      
      this.logger.success(`Template registered: ${templateKey}`);
      
      return {
        id: templateInfo.id,
        version: registration.version,
        templateKey,
        registration
      };
      
    } catch (error) {
      this.logger.error(`Failed to register template ${templateInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Register a new rule version
   * @param {Object} ruleInfo - Rule information
   * @returns {Promise<Object>} Registration result
   */
  async registerRule(ruleInfo) {
    try {
      this.logger.info(`Registering rule: ${ruleInfo.id}`);
      
      const registration = {
        id: ruleInfo.id,
        version: ruleInfo.version || await this._generateNextVersion(ruleInfo.id, 'rule'),
        name: ruleInfo.name,
        description: ruleInfo.description,
        type: ruleInfo.type, // validation, transformation, generation
        severity: ruleInfo.severity || 'error',
        
        // Version metadata
        registeredAt: new Date().toISOString(),
        contentHash: ruleInfo.contentHash || await this._calculateContentHash(ruleInfo.content),
        dependencies: ruleInfo.dependencies || [],
        
        // Compatibility information
        engineCompatibility: ruleInfo.engineCompatibility || ['*'],
        templateCompatibility: ruleInfo.templateCompatibility || [],
        schemaCompatibility: ruleInfo.schemaCompatibility || [],
        
        // Rule-specific metadata
        category: ruleInfo.category,
        scope: ruleInfo.scope, // global, template, local
        configurable: ruleInfo.configurable || false,
        parameters: ruleInfo.parameters || {},
        
        // Lifecycle information
        deprecated: ruleInfo.deprecated || false,
        replacedBy: ruleInfo.replacedBy,
        testCases: ruleInfo.testCases || []
      };

      // Validate and register
      if (!this._isValidVersion(registration.version)) {
        throw new Error(`Invalid version format: ${registration.version}`);
      }

      const existingVersions = this._getRuleVersions(ruleInfo.id);
      if (existingVersions.includes(registration.version)) {
        throw new Error(`Rule version ${registration.version} already exists for ${ruleInfo.id}`);
      }

      const ruleKey = `${ruleInfo.id}@${registration.version}`;
      this.ruleRegistry.set(ruleKey, registration);
      
      this._updateVersionHistory(ruleInfo.id, 'rule', registration.version, registration);
      await this._saveRegistry();
      
      this.logger.success(`Rule registered: ${ruleKey}`);
      
      return {
        id: ruleInfo.id,
        version: registration.version,
        ruleKey,
        registration
      };
      
    } catch (error) {
      this.logger.error(`Failed to register rule ${ruleInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Register a new schema version
   * @param {Object} schemaInfo - Schema information
   * @returns {Promise<Object>} Registration result
   */
  async registerSchema(schemaInfo) {
    try {
      this.logger.info(`Registering schema: ${schemaInfo.id}`);
      
      const registration = {
        id: schemaInfo.id,
        version: schemaInfo.version || await this._generateNextVersion(schemaInfo.id, 'schema'),
        name: schemaInfo.name,
        description: schemaInfo.description,
        format: schemaInfo.format || 'json-schema',
        
        // Version metadata
        registeredAt: new Date().toISOString(),
        contentHash: schemaInfo.contentHash || await this._calculateContentHash(schemaInfo.content),
        
        // Schema-specific information
        draft: schemaInfo.draft || 'draft-07',
        vocabulary: schemaInfo.vocabulary || [],
        extends: schemaInfo.extends || [],
        
        // Compatibility information
        engineCompatibility: schemaInfo.engineCompatibility || ['*'],
        templateCompatibility: schemaInfo.templateCompatibility || [],
        ruleCompatibility: schemaInfo.ruleCompatibility || [],
        
        // Metadata
        category: schemaInfo.category,
        tags: schemaInfo.tags || [],
        deprecated: schemaInfo.deprecated || false,
        replacedBy: schemaInfo.replacedBy
      };

      // Validate and register
      if (!this._isValidVersion(registration.version)) {
        throw new Error(`Invalid version format: ${registration.version}`);
      }

      const schemaKey = `${schemaInfo.id}@${registration.version}`;
      this.schemaRegistry.set(schemaKey, registration);
      
      this._updateVersionHistory(schemaInfo.id, 'schema', registration.version, registration);
      await this._saveRegistry();
      
      this.logger.success(`Schema registered: ${schemaKey}`);
      
      return {
        id: schemaInfo.id,
        version: registration.version,
        schemaKey,
        registration
      };
      
    } catch (error) {
      this.logger.error(`Failed to register schema ${schemaInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Resolve component versions based on constraints
   * @param {Object} constraints - Version constraints
   * @returns {Promise<Object>} Resolved versions
   */
  async resolveVersions(constraints) {
    try {
      this.logger.info('Resolving component versions...');
      
      const resolution = {
        templates: {},
        rules: {},
        schemas: {},
        conflicts: [],
        warnings: []
      };

      // Resolve template versions
      if (constraints.templates) {
        for (const [templateId, versionConstraint] of Object.entries(constraints.templates)) {
          const resolvedVersion = await this._resolveTemplateVersion(templateId, versionConstraint);
          if (resolvedVersion) {
            resolution.templates[templateId] = resolvedVersion;
          } else {
            resolution.conflicts.push({
              component: 'template',
              id: templateId,
              constraint: versionConstraint,
              reason: 'No satisfying version found'
            });
          }
        }
      }

      // Resolve rule versions
      if (constraints.rules) {
        for (const [ruleId, versionConstraint] of Object.entries(constraints.rules)) {
          const resolvedVersion = await this._resolveRuleVersion(ruleId, versionConstraint);
          if (resolvedVersion) {
            resolution.rules[ruleId] = resolvedVersion;
          } else {
            resolution.conflicts.push({
              component: 'rule',
              id: ruleId,
              constraint: versionConstraint,
              reason: 'No satisfying version found'
            });
          }
        }
      }

      // Check compatibility between resolved versions
      const compatibilityCheck = await this._checkResolvedCompatibility(resolution);
      resolution.warnings.push(...compatibilityCheck.warnings);
      resolution.conflicts.push(...compatibilityCheck.conflicts);

      return resolution;
      
    } catch (error) {
      this.logger.error('Failed to resolve versions:', error);
      throw error;
    }
  }

  /**
   * Get upgrade path for component
   * @param {string} componentId - Component identifier
   * @param {string} fromVersion - Current version
   * @param {string} toVersion - Target version (optional)
   * @returns {Promise<Object>} Upgrade path information
   */
  async getUpgradePath(componentId, fromVersion, toVersion = null) {
    try {
      this.logger.info(`Getting upgrade path for ${componentId}: ${fromVersion} -> ${toVersion || 'latest'}`);
      
      const componentType = this._detectComponentType(componentId);
      const versions = this._getComponentVersions(componentId, componentType);
      
      if (!versions.includes(fromVersion)) {
        throw new Error(`Source version ${fromVersion} not found for ${componentId}`);
      }

      const targetVersion = toVersion || this._getLatestVersion(versions);
      
      if (!versions.includes(targetVersion)) {
        throw new Error(`Target version ${targetVersion} not found for ${componentId}`);
      }

      // Build upgrade path
      const path = this._buildUpgradePath(versions, fromVersion, targetVersion);
      
      // Analyze breaking changes
      const breakingChanges = await this._analyzeBreakingChanges(componentId, componentType, path);
      
      // Generate migration strategy
      const migrationStrategy = await this._generateMigrationStrategy(componentId, componentType, path);
      
      const upgradePath = {
        componentId,
        componentType,
        fromVersion,
        targetVersion,
        path,
        breakingChanges,
        migrationStrategy,
        estimatedEffort: this._estimateUpgradeEffort(path, breakingChanges),
        risks: this._assessUpgradeRisks(path, breakingChanges),
        recommendations: this._generateUpgradeRecommendations(path, breakingChanges)
      };

      return upgradePath;
      
    } catch (error) {
      this.logger.error(`Failed to get upgrade path for ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Check compatibility between components
   * @param {Object} components - Components to check
   * @returns {Promise<Object>} Compatibility report
   */
  async checkCompatibility(components) {
    try {
      this.logger.info('Checking component compatibility...');
      
      const report = {
        compatible: true,
        issues: [],
        warnings: [],
        matrix: {}
      };

      // Build compatibility matrix
      for (const [componentId, version] of Object.entries(components)) {
        const componentType = this._detectComponentType(componentId);
        const componentKey = `${componentId}@${version}`;
        
        report.matrix[componentKey] = {
          compatible: [],
          incompatible: [],
          unknown: []
        };

        // Check against other components
        for (const [otherComponentId, otherVersion] of Object.entries(components)) {
          if (componentId === otherComponentId) continue;
          
          const otherComponentType = this._detectComponentType(otherComponentId);
          const otherComponentKey = `${otherComponentId}@${otherVersion}`;
          
          const compatibility = await this._checkPairwiseCompatibility(
            componentId, version, componentType,
            otherComponentId, otherVersion, otherComponentType
          );

          if (compatibility.compatible) {
            report.matrix[componentKey].compatible.push(otherComponentKey);
          } else if (compatibility.incompatible) {
            report.matrix[componentKey].incompatible.push(otherComponentKey);
            report.compatible = false;
            report.issues.push({
              component1: componentKey,
              component2: otherComponentKey,
              reason: compatibility.reason
            });
          } else {
            report.matrix[componentKey].unknown.push(otherComponentKey);
            report.warnings.push({
              component1: componentKey,
              component2: otherComponentKey,
              reason: 'Compatibility unknown'
            });
          }
        }
      }

      return report;
      
    } catch (error) {
      this.logger.error('Failed to check compatibility:', error);
      throw error;
    }
  }

  /**
   * Get version history for component
   * @param {string} componentId - Component identifier
   * @returns {Array} Version history
   */
  getVersionHistory(componentId) {
    return this.versionHistory.get(componentId) || [];
  }

  /**
   * Get latest version for component
   * @param {string} componentId - Component identifier
   * @returns {string|null} Latest version
   */
  getLatestVersion(componentId) {
    const componentType = this._detectComponentType(componentId);
    const versions = this._getComponentVersions(componentId, componentType);
    return this._getLatestVersion(versions);
  }

  // Private methods

  async _loadRegistry() {
    try {
      const registryContent = await fs.readFile(this.config.registryPath, 'utf8');
      const registry = JSON.parse(registryContent);
      
      // Load registries
      if (registry.templates) {
        this.templateRegistry = new Map(Object.entries(registry.templates));
      }
      if (registry.rules) {
        this.ruleRegistry = new Map(Object.entries(registry.rules));
      }
      if (registry.schemas) {
        this.schemaRegistry = new Map(Object.entries(registry.schemas));
      }
      if (registry.versionHistory) {
        this.versionHistory = new Map(Object.entries(registry.versionHistory));
      }
      if (registry.compatibilityMatrix) {
        this.compatibilityMatrix = new Map(Object.entries(registry.compatibilityMatrix));
      }
      
      this.logger.debug('Registry loaded successfully');
      
    } catch (error) {
      this.logger.debug('No existing registry found, starting fresh');
    }
  }

  async _saveRegistry() {
    try {
      const registry = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        templates: Object.fromEntries(this.templateRegistry),
        rules: Object.fromEntries(this.ruleRegistry),
        schemas: Object.fromEntries(this.schemaRegistry),
        versionHistory: Object.fromEntries(this.versionHistory),
        compatibilityMatrix: Object.fromEntries(this.compatibilityMatrix)
      };

      await fs.writeFile(this.config.registryPath, JSON.stringify(registry, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to save registry:', error);
      throw error;
    }
  }

  async _initializeDefaults() {
    // Initialize default engine version
    if (!this.engineRegistry.has('kgen')) {
      this.engineRegistry.set('kgen', {
        version: '1.0.0',
        registeredAt: new Date().toISOString(),
        features: ['templates', 'rules', 'schemas', 'provenance']
      });
    }
  }

  async _generateNextVersion(componentId, componentType) {
    const existingVersions = this._getComponentVersions(componentId, componentType);
    
    if (existingVersions.length === 0) {
      return '1.0.0';
    }

    switch (this.config.versioningScheme) {
      case 'semantic':
        const latestVersion = this._getLatestVersion(existingVersions);
        return semver.inc(latestVersion, 'patch');
      
      case 'timestamp':
        return new Date().toISOString();
      
      case 'hash':
        return crypto.randomBytes(16).toString('hex');
      
      default:
        throw new Error(`Unsupported versioning scheme: ${this.config.versioningScheme}`);
    }
  }

  async _calculateContentHash(content) {
    if (!content) return null;
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  _isValidVersion(version) {
    switch (this.config.versioningScheme) {
      case 'semantic':
        return semver.valid(version) !== null;
      case 'timestamp':
        return !isNaN(Date.parse(version));
      case 'hash':
        return /^[a-f0-9]{32}$/.test(version);
      default:
        return false;
    }
  }

  async _validateDependencies(dependencies) {
    const validation = { valid: true, issues: [] };
    
    for (const dependency of dependencies) {
      // Check if dependency exists
      const exists = this._componentExists(dependency.id, dependency.version);
      if (!exists) {
        validation.valid = false;
        validation.issues.push(`Dependency not found: ${dependency.id}@${dependency.version}`);
      }
    }
    
    return validation;
  }

  _updateVersionHistory(componentId, componentType, version, registration) {
    if (!this.versionHistory.has(componentId)) {
      this.versionHistory.set(componentId, []);
    }
    
    const history = this.versionHistory.get(componentId);
    history.push({
      version,
      componentType,
      registeredAt: registration.registeredAt,
      contentHash: registration.contentHash
    });
    
    // Sort by version (semantic) or timestamp
    if (this.config.versioningScheme === 'semantic') {
      history.sort((a, b) => semver.compare(a.version, b.version));
    } else {
      history.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());
    }
  }

  async _updateCompatibilityMatrix(registration) {
    // This would implement compatibility matrix updates
    // For now, just store basic information
    const key = `${registration.id}@${registration.version}`;
    this.compatibilityMatrix.set(key, {
      engineCompatibility: registration.engineCompatibility,
      dependencies: registration.dependencies
    });
  }

  _getTemplateVersions(templateId) {
    return Array.from(this.templateRegistry.keys())
      .filter(key => key.startsWith(`${templateId}@`))
      .map(key => key.split('@')[1]);
  }

  _getRuleVersions(ruleId) {
    return Array.from(this.ruleRegistry.keys())
      .filter(key => key.startsWith(`${ruleId}@`))
      .map(key => key.split('@')[1]);
  }

  _getSchemaVersions(schemaId) {
    return Array.from(this.schemaRegistry.keys())
      .filter(key => key.startsWith(`${schemaId}@`))
      .map(key => key.split('@')[1]);
  }

  _getComponentVersions(componentId, componentType) {
    switch (componentType) {
      case 'template':
        return this._getTemplateVersions(componentId);
      case 'rule':
        return this._getRuleVersions(componentId);
      case 'schema':
        return this._getSchemaVersions(componentId);
      default:
        return [];
    }
  }

  _getLatestVersion(versions) {
    if (versions.length === 0) return null;
    
    if (this.config.versioningScheme === 'semantic') {
      return semver.maxSatisfying(versions, '*');
    } else {
      return versions[versions.length - 1];
    }
  }

  _detectComponentType(componentId) {
    // Simple heuristic to detect component type
    if (this.templateRegistry.has(componentId) || 
        Array.from(this.templateRegistry.keys()).some(key => key.startsWith(`${componentId}@`))) {
      return 'template';
    }
    if (this.ruleRegistry.has(componentId) || 
        Array.from(this.ruleRegistry.keys()).some(key => key.startsWith(`${componentId}@`))) {
      return 'rule';
    }
    if (this.schemaRegistry.has(componentId) || 
        Array.from(this.schemaRegistry.keys()).some(key => key.startsWith(`${componentId}@`))) {
      return 'schema';
    }
    
    // Default to template for unknown components
    return 'template';
  }

  _componentExists(componentId, version) {
    const componentKey = `${componentId}@${version}`;
    
    return this.templateRegistry.has(componentKey) ||
           this.ruleRegistry.has(componentKey) ||
           this.schemaRegistry.has(componentKey);
  }

  async _resolveTemplateVersion(templateId, constraint) {
    const versions = this._getTemplateVersions(templateId);
    
    if (this.config.versioningScheme === 'semantic') {
      return semver.maxSatisfying(versions, constraint);
    } else {
      // For non-semantic versioning, just return exact match or latest
      return versions.includes(constraint) ? constraint : this._getLatestVersion(versions);
    }
  }

  async _resolveRuleVersion(ruleId, constraint) {
    const versions = this._getRuleVersions(ruleId);
    
    if (this.config.versioningScheme === 'semantic') {
      return semver.maxSatisfying(versions, constraint);
    } else {
      return versions.includes(constraint) ? constraint : this._getLatestVersion(versions);
    }
  }

  async _checkResolvedCompatibility(resolution) {
    return { warnings: [], conflicts: [] };
  }

  async _checkPairwiseCompatibility(id1, version1, type1, id2, version2, type2) {
    // This would implement actual compatibility checking
    // For now, return compatible
    return { compatible: true };
  }

  _buildUpgradePath(versions, fromVersion, targetVersion) {
    const sortedVersions = this.config.versioningScheme === 'semantic' ? 
      versions.sort(semver.compare) : 
      versions.sort();
    
    const fromIndex = sortedVersions.indexOf(fromVersion);
    const toIndex = sortedVersions.indexOf(targetVersion);
    
    if (fromIndex === -1 || toIndex === -1) {
      throw new Error('Invalid version range for upgrade path');
    }
    
    return sortedVersions.slice(fromIndex, toIndex + 1);
  }

  async _analyzeBreakingChanges(componentId, componentType, path) {
    // This would analyze breaking changes between versions
    // For now, return empty array
    return [];
  }

  async _generateMigrationStrategy(componentId, componentType, path) {
    return {
      type: 'automatic',
      steps: [`Upgrade ${componentId} from ${path[0]} to ${path[path.length - 1]}`]
    };
  }

  _estimateUpgradeEffort(path, breakingChanges) {
    const versionJumps = path.length - 1;
    const breakingCount = breakingChanges.length;
    
    if (breakingCount === 0) return 'low';
    if (breakingCount < 3 && versionJumps < 5) return 'medium';
    return 'high';
  }

  _assessUpgradeRisks(path, breakingChanges) {
    return breakingChanges.length > 0 ? ['Breaking changes detected'] : [];
  }

  _generateUpgradeRecommendations(path, breakingChanges) {
    const recommendations = [];
    
    if (path.length > 5) {
      recommendations.push('Consider incremental upgrades instead of jumping multiple versions');
    }
    
    if (breakingChanges.length > 0) {
      recommendations.push('Review breaking changes carefully and test thoroughly');
    }
    
    return recommendations;
  }
}

export default VersionManager;