/**
 * Rule Pack Manager - Comprehensive Rule Loading and Management System
 * 
 * Manages loading, validation, and execution of reasoning rule packs:
 * - Dynamic rule pack loading from various sources
 * - Rule validation and syntax checking
 * - Rule pack versioning and dependency management
 * - Rule execution optimization and scheduling
 * - Hot-reloading of rule packs during development
 * - Rule pack marketplace integration
 * - Performance monitoring and analytics
 * - Rule conflict detection and resolution
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import crypto from 'crypto';
import { Parser } from 'n3';

export class RulePackManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Rule pack directories
      rulePackDirectory: config.rulePackDirectory || './rules',
      builtinRulesDirectory: config.builtinRulesDirectory || './rules/builtin',
      customRulesDirectory: config.customRulesDirectory || './rules/custom',
      downloadedRulesDirectory: config.downloadedRulesDirectory || './rules/downloaded',
      
      // Loading configuration
      enableHotReload: config.enableHotReload !== false,
      enableValidation: config.enableValidation !== false,
      enableDependencyChecking: config.enableDependencyChecking !== false,
      maxRulePackSize: config.maxRulePackSize || '50MB',
      
      // Execution configuration
      enableRuleOptimization: config.enableRuleOptimization !== false,
      enableConflictDetection: config.enableConflictDetection !== false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
      
      // Marketplace integration
      enableMarketplace: config.enableMarketplace || false,
      marketplaceUrl: config.marketplaceUrl || 'https://kgen.marketplace/rules',
      
      // Security settings
      enableCodeSandboxing: config.enableCodeSandboxing !== false,
      allowUnsignedRulePacks: config.allowUnsignedRulePacks || false,
      trustedPublishers: config.trustedPublishers || [],
      
      ...config
    };
    
    this.logger = consola.withTag('rule-pack-manager');
    
    // Rule pack storage
    this.rulePacks = new Map();
    this.rulePackMetadata = new Map();
    this.rulePackDependencies = new Map();
    this.activeRulePacks = new Set();
    
    // Rule management
    this.rules = new Map();
    this.rulesByCategory = new Map();
    this.rulesByPriority = new Map();
    this.ruleConflicts = new Map();
    
    // Performance tracking
    this.rulePerformance = new Map();
    this.executionStats = new Map();
    
    // Hot reload watchers
    this.watchers = new Map();
    
    // Rule pack schemas and validators
    this.rulePackSchemas = new Map();
    this.validators = new Map();
    
    // Caching
    this.compiledRules = new Map();
    this.validationCache = new Map();
    
    // Metrics
    this.metrics = {
      rulePacksLoaded: 0,
      rulesLoaded: 0,
      validationErrors: 0,
      conflictsDetected: 0,
      hotReloads: 0,
      downloadedPacks: 0
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the rule pack manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing rule pack manager...');
      
      // Create directories if they don't exist
      await this._ensureDirectoriesExist();
      
      // Load built-in rule pack schemas
      await this._loadRulePackSchemas();
      
      // Load built-in rule packs
      await this._loadBuiltinRulePacks();
      
      // Load custom rule packs
      await this._loadCustomRulePacks();
      
      // Set up hot reload watchers
      if (this.config.enableHotReload) {
        await this._setupHotReload();
      }
      
      // Resolve dependencies
      if (this.config.enableDependencyChecking) {
        await this._resolveDependencies();
      }
      
      // Detect conflicts
      if (this.config.enableConflictDetection) {
        await this._detectRuleConflicts();
      }
      
      this.state = 'ready';
      this.logger.success('Rule pack manager initialized successfully');
      
      return {
        status: 'success',
        rulePacksLoaded: this.rulePacks.size,
        rulesLoaded: this.rules.size,
        activeRulePacks: this.activeRulePacks.size,
        conflictsDetected: this.ruleConflicts.size,
        hotReloadEnabled: this.config.enableHotReload
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize rule pack manager:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Load rule pack from various sources
   * @param {Object} source - Rule pack source configuration
   * @returns {Promise<Object>} Loading result
   */
  async loadRulePack(source) {
    try {
      this.logger.info(`Loading rule pack from: ${source.uri || source.path || source.id}`);
      
      let rulePackData;
      let rulePackPath;
      
      // Load rule pack data from different sources
      switch (source.type) {
        case 'file':
          rulePackPath = source.path;
          rulePackData = await this._loadFromFile(source.path);
          break;
          
        case 'url':
          rulePackData = await this._loadFromURL(source.uri);
          rulePackPath = await this._downloadRulePack(source.uri, rulePackData);
          break;
          
        case 'string':
          rulePackData = source.content;
          break;
          
        case 'marketplace':
          rulePackData = await this._loadFromMarketplace(source.id, source.version);
          rulePackPath = await this._downloadFromMarketplace(source.id, source.version);
          break;
          
        default:
          throw new Error(`Unsupported rule pack source type: ${source.type}`);
      }
      
      // Parse rule pack
      const rulePack = typeof rulePackData === 'string' ? JSON.parse(rulePackData) : rulePackData;
      
      // Validate rule pack
      if (this.config.enableValidation) {
        await this._validateRulePack(rulePack, source);
      }
      
      // Check dependencies
      if (this.config.enableDependencyChecking && rulePack.dependencies) {
        await this._checkDependencies(rulePack);
      }
      
      // Process and store rule pack
      const processedRulePack = await this._processRulePack(rulePack, source, rulePackPath);
      
      // Store rule pack
      this.rulePacks.set(processedRulePack.id, processedRulePack);
      this.rulePackMetadata.set(processedRulePack.id, {
        ...processedRulePack.metadata,
        loadedAt: new Date().toISOString(),
        source
      });
      
      // Add individual rules to rule registry
      await this._registerRules(processedRulePack);
      
      // Add to active rule packs if enabled
      if (processedRulePack.enabled !== false) {
        this.activeRulePacks.add(processedRulePack.id);
      }
      
      // Update metrics
      this.metrics.rulePacksLoaded++;
      this.metrics.rulesLoaded += processedRulePack.rules.length;
      
      this.emit('rule-pack:loaded', {
        id: processedRulePack.id,
        metadata: processedRulePack.metadata,
        rulesCount: processedRulePack.rules.length
      });
      
      this.logger.success(`Rule pack loaded: ${processedRulePack.name} (${processedRulePack.rules.length} rules)`);
      
      return {
        id: processedRulePack.id,
        name: processedRulePack.name,
        version: processedRulePack.version,
        rulesLoaded: processedRulePack.rules.length,
        enabled: processedRulePack.enabled !== false
      };
      
    } catch (error) {
      this.logger.error('Failed to load rule pack:', error);
      this.metrics.validationErrors++;
      this.emit('rule-pack:error', { source, error });
      throw error;
    }
  }

  /**
   * Enable or disable a rule pack
   * @param {string} rulePackId - Rule pack ID
   * @param {boolean} enabled - Enable or disable
   */
  async setRulePackEnabled(rulePackId, enabled) {
    if (!this.rulePacks.has(rulePackId)) {
      throw new Error(`Rule pack not found: ${rulePackId}`);
    }
    
    const rulePack = this.rulePacks.get(rulePackId);
    rulePack.enabled = enabled;
    
    if (enabled) {
      this.activeRulePacks.add(rulePackId);
    } else {
      this.activeRulePacks.delete(rulePackId);
    }
    
    this.emit('rule-pack:status-changed', { id: rulePackId, enabled });
    this.logger.info(`Rule pack ${rulePackId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get active rules for execution
   * @param {Object} options - Filtering options
   * @returns {Array} Active rules
   */
  getActiveRules(options = {}) {
    const activeRules = [];
    
    for (const rulePackId of this.activeRulePacks) {
      const rulePack = this.rulePacks.get(rulePackId);
      
      if (!rulePack) continue;
      
      for (const rule of rulePack.rules) {
        // Apply filters
        if (options.category && rule.category !== options.category) continue;
        if (options.minPriority && (rule.priority || 0) < options.minPriority) continue;
        if (options.maxPriority && (rule.priority || 0) > options.maxPriority) continue;
        if (options.tags && !this._matchesTags(rule.tags, options.tags)) continue;
        
        activeRules.push({
          ...rule,
          rulePackId,
          rulePackName: rulePack.name
        });
      }
    }
    
    // Sort by priority (higher priority first)
    activeRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return activeRules;
  }

  /**
   * Get rule pack by ID
   * @param {string} rulePackId - Rule pack ID
   * @returns {Object|null} Rule pack or null if not found
   */
  getRulePack(rulePackId) {
    return this.rulePacks.get(rulePackId) || null;
  }

  /**
   * List all rule packs with metadata
   * @param {Object} options - Filtering options
   * @returns {Array} List of rule packs
   */
  listRulePacks(options = {}) {
    const rulePacks = [];
    
    for (const [id, rulePack] of this.rulePacks) {
      const metadata = this.rulePackMetadata.get(id);
      
      // Apply filters
      if (options.enabled !== undefined && (this.activeRulePacks.has(id)) !== options.enabled) continue;
      if (options.category && rulePack.category !== options.category) continue;
      if (options.publisher && rulePack.publisher !== options.publisher) continue;
      
      rulePacks.push({
        id,
        name: rulePack.name,
        version: rulePack.version,
        description: rulePack.description,
        category: rulePack.category,
        publisher: rulePack.publisher,
        rulesCount: rulePack.rules.length,
        enabled: this.activeRulePacks.has(id),
        loadedAt: metadata?.loadedAt,
        source: metadata?.source
      });
    }
    
    return rulePacks;
  }

  /**
   * Search for rule packs in marketplace
   * @param {Object} searchCriteria - Search criteria
   * @returns {Promise<Array>} Search results
   */
  async searchMarketplace(searchCriteria) {
    if (!this.config.enableMarketplace) {
      throw new Error('Marketplace integration is disabled');
    }
    
    try {
      const searchParams = new URLSearchParams({
        q: searchCriteria.query || '',
        category: searchCriteria.category || '',
        tags: searchCriteria.tags?.join(',') || '',
        publisher: searchCriteria.publisher || '',
        limit: searchCriteria.limit || 20
      });
      
      const response = await fetch(`${this.config.marketplaceUrl}/search?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`Marketplace search failed: ${response.status} ${response.statusText}`);
      }
      
      const results = await response.json();
      return results.rulePacks || [];
      
    } catch (error) {
      this.logger.error('Marketplace search failed:', error);
      throw error;
    }
  }

  /**
   * Install rule pack from marketplace
   * @param {string} rulePackId - Rule pack ID
   * @param {string} version - Version to install
   * @returns {Promise<Object>} Installation result
   */
  async installFromMarketplace(rulePackId, version = 'latest') {
    if (!this.config.enableMarketplace) {
      throw new Error('Marketplace integration is disabled');
    }
    
    try {
      this.logger.info(`Installing rule pack from marketplace: ${rulePackId}@${version}`);
      
      const result = await this.loadRulePack({
        type: 'marketplace',
        id: rulePackId,
        version
      });
      
      this.metrics.downloadedPacks++;
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to install rule pack ${rulePackId}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Validate a rule pack against schema
   * @param {Object} rulePack - Rule pack to validate
   * @param {Object} source - Source information
   * @returns {Promise<Object>} Validation result
   */
  async validateRulePack(rulePack, source = {}) {
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        validatedAt: new Date().toISOString(),
        validator: 'rule-pack-manager',
        source
      }
    };
    
    try {
      // Basic structure validation
      const structureErrors = await this._validateRulePackStructure(rulePack);
      validationResult.errors.push(...structureErrors);
      
      // Schema validation
      if (this.rulePackSchemas.has(rulePack.schemaVersion || 'v1.0')) {
        const schemaErrors = await this._validateAgainstSchema(rulePack);
        validationResult.errors.push(...schemaErrors);
      } else {
        validationResult.warnings.push('Unknown schema version, using default validation');
      }
      
      // Rule syntax validation
      for (const [index, rule] of rulePack.rules.entries()) {
        const ruleErrors = await this._validateRuleItem(rule, index);
        validationResult.errors.push(...ruleErrors.errors);
        validationResult.warnings.push(...ruleErrors.warnings);
      }
      
      // Dependency validation
      if (rulePack.dependencies) {
        const depErrors = await this._validateDependencies(rulePack.dependencies);
        validationResult.errors.push(...depErrors);
      }
      
      // Security validation
      if (this.config.enableCodeSandboxing) {
        const securityWarnings = await this._validateSecurity(rulePack);
        validationResult.warnings.push(...securityWarnings);
      }
      
      validationResult.valid = validationResult.errors.length === 0;
      
      if (validationResult.errors.length > 0) {
        this.metrics.validationErrors++;
      }
      
    } catch (error) {
      validationResult.valid = false;
      validationResult.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validationResult;
  }

  /**
   * Get rule execution statistics
   * @param {Object} options - Query options
   * @returns {Object} Statistics
   */
  getRuleStatistics(options = {}) {
    const stats = {
      totalRulePacks: this.rulePacks.size,
      activeRulePacks: this.activeRulePacks.size,
      totalRules: this.rules.size,
      rulesByCategory: {},
      rulesByPriority: {},
      performance: {},
      conflicts: this.ruleConflicts.size
    };
    
    // Aggregate by category
    for (const [category, rules] of this.rulesByCategory) {
      stats.rulesByCategory[category] = rules.size;
    }
    
    // Aggregate by priority
    for (const [priority, rules] of this.rulesByPriority) {
      stats.rulesByPriority[priority] = rules.size;
    }
    
    // Performance statistics
    if (this.config.enablePerformanceMonitoring) {
      for (const [ruleId, perf] of this.rulePerformance) {
        stats.performance[ruleId] = {
          executionCount: perf.executionCount,
          averageExecutionTime: perf.totalExecutionTime / perf.executionCount,
          successRate: perf.successCount / perf.executionCount,
          lastExecuted: perf.lastExecuted
        };
      }
    }
    
    return stats;
  }

  /**
   * Get manager status and health
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        rulePackDirectory: this.config.rulePackDirectory,
        enableHotReload: this.config.enableHotReload,
        enableValidation: this.config.enableValidation,
        enableConflictDetection: this.config.enableConflictDetection,
        enableMarketplace: this.config.enableMarketplace
      },
      rulePacks: {
        total: this.rulePacks.size,
        active: this.activeRulePacks.size,
        byCategory: Object.fromEntries(this.rulesByCategory.entries())
      },
      rules: {
        total: this.rules.size,
        conflicts: this.ruleConflicts.size
      },
      watchers: {
        active: this.watchers.size,
        hotReloadEnabled: this.config.enableHotReload
      },
      cache: {
        compiledRules: this.compiledRules.size,
        validationCache: this.validationCache.size
      },
      metrics: { ...this.metrics },
      performance: {
        averageLoadTime: this._calculateAverageLoadTime(),
        cacheHitRate: this._calculateCacheHitRate()
      }
    };
  }

  /**
   * Shutdown the rule pack manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down rule pack manager...');
      
      // Stop all watchers
      for (const [path, watcher] of this.watchers) {
        watcher.close();
      }
      this.watchers.clear();
      
      // Clear all state
      this.rulePacks.clear();
      this.rulePackMetadata.clear();
      this.rules.clear();
      this.rulesByCategory.clear();
      this.rulesByPriority.clear();
      this.activeRulePacks.clear();
      this.ruleConflicts.clear();
      this.rulePerformance.clear();
      this.compiledRules.clear();
      this.validationCache.clear();
      
      this.state = 'shutdown';
      this.logger.success('Rule pack manager shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during rule pack manager shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Ensure required directories exist
   */
  async _ensureDirectoriesExist() {
    const dirs = [
      this.config.rulePackDirectory,
      this.config.builtinRulesDirectory,
      this.config.customRulesDirectory,
      this.config.downloadedRulesDirectory
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.debug(`Directory already exists or cannot be created: ${dir}`);
      }
    }
  }

  /**
   * Load rule pack schemas
   */
  async _loadRulePackSchemas() {
    // Define built-in rule pack schemas
    const schemas = {
      'v1.0': {
        type: 'object',
        required: ['id', 'name', 'version', 'rules'],
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9-_]+$' },
          name: { type: 'string', minLength: 1 },
          version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
          description: { type: 'string' },
          category: { type: 'string' },
          publisher: { type: 'string' },
          license: { type: 'string' },
          rules: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'name', 'type', 'rule'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string', enum: ['n3', 'sparql', 'javascript', 'custom'] },
                rule: { type: 'string' },
                priority: { type: 'number', minimum: 0 },
                category: { type: 'string' },
                enabled: { type: 'boolean' },
                description: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          dependencies: {
            type: 'object',
            patternProperties: {
              '^[a-z0-9-_]+$': { type: 'string' }
            }
          },
          metadata: { type: 'object' }
        }
      }
    };
    
    for (const [version, schema] of Object.entries(schemas)) {
      this.rulePackSchemas.set(version, schema);
    }
  }

  /**
   * Load built-in rule packs
   */
  async _loadBuiltinRulePacks() {
    try {
      const builtinDir = this.config.builtinRulesDirectory;
      const files = await fs.readdir(builtinDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(builtinDir, file);
          try {
            await this.loadRulePack({
              type: 'file',
              path: filePath,
              builtin: true
            });
          } catch (error) {
            this.logger.warn(`Failed to load built-in rule pack ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Built-in rules directory not accessible');
    }
  }

  /**
   * Load custom rule packs
   */
  async _loadCustomRulePacks() {
    try {
      const customDir = this.config.customRulesDirectory;
      const files = await fs.readdir(customDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(customDir, file);
          try {
            await this.loadRulePack({
              type: 'file',
              path: filePath,
              custom: true
            });
          } catch (error) {
            this.logger.warn(`Failed to load custom rule pack ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Custom rules directory not accessible');
    }
  }

  /**
   * Setup hot reload watchers
   */
  async _setupHotReload() {
    const watchDirs = [
      this.config.builtinRulesDirectory,
      this.config.customRulesDirectory
    ];
    
    for (const dir of watchDirs) {
      try {
        const watcher = watch(dir, { recursive: true }, async (eventType, filename) => {
          if (filename && filename.endsWith('.json')) {
            const filePath = path.join(dir, filename);
            
            try {
              if (eventType === 'change') {
                this.logger.info(`Hot reloading rule pack: ${filename}`);
                await this.loadRulePack({
                  type: 'file',
                  path: filePath,
                  hotReload: true
                });
                this.metrics.hotReloads++;
                this.emit('rule-pack:hot-reload', { path: filePath, filename });
              }
            } catch (error) {
              this.logger.error(`Hot reload failed for ${filename}:`, error.message);
            }
          }
        });
        
        this.watchers.set(dir, watcher);
        this.logger.debug(`Hot reload watcher set up for: ${dir}`);
        
      } catch (error) {
        this.logger.warn(`Failed to set up hot reload for ${dir}:`, error.message);
      }
    }
  }

  /**
   * Process rule pack after loading
   */
  async _processRulePack(rulePack, source, filePath) {
    const processed = {
      ...rulePack,
      metadata: {
        ...rulePack.metadata,
        source,
        filePath,
        loadedAt: new Date().toISOString(),
        hash: this._calculateRulePackHash(rulePack)
      },
      rules: []
    };
    
    // Process each rule
    for (const [index, rule] of rulePack.rules.entries()) {
      try {
        const processedRule = await this._processRule(rule, processed.id, index);
        processed.rules.push(processedRule);
      } catch (error) {
        this.logger.warn(`Failed to process rule ${rule.id || index} in pack ${processed.id}:`, error.message);
      }
    }
    
    return processed;
  }

  /**
   * Process individual rule
   */
  async _processRule(rule, rulePackId, index) {
    const processed = {
      ...rule,
      rulePackId,
      index,
      compiledAt: null,
      metadata: {
        ...rule.metadata,
        processedAt: new Date().toISOString(),
        hash: this._calculateRuleHash(rule)
      }
    };
    
    // Compile rule if possible
    if (this.config.enableRuleOptimization) {
      try {
        processed.compiled = await this._compileRule(rule);
        processed.compiledAt = new Date().toISOString();
      } catch (error) {
        this.logger.debug(`Failed to compile rule ${rule.id}:`, error.message);
      }
    }
    
    return processed;
  }

  /**
   * Register rules in various indexes
   */
  async _registerRules(rulePack) {
    for (const rule of rulePack.rules) {
      // Register in main rules map
      this.rules.set(rule.id, rule);
      
      // Register by category
      const category = rule.category || 'general';
      if (!this.rulesByCategory.has(category)) {
        this.rulesByCategory.set(category, new Set());
      }
      this.rulesByCategory.get(category).add(rule.id);
      
      // Register by priority
      const priority = rule.priority || 0;
      if (!this.rulesByPriority.has(priority)) {
        this.rulesByPriority.set(priority, new Set());
      }
      this.rulesByPriority.get(priority).add(rule.id);
      
      // Initialize performance tracking
      if (this.config.enablePerformanceMonitoring) {
        this.rulePerformance.set(rule.id, {
          executionCount: 0,
          successCount: 0,
          totalExecutionTime: 0,
          lastExecuted: null
        });
      }
    }
  }

  /**
   * Validate rule pack structure
   */
  async _validateRulePackStructure(rulePack) {
    const errors = [];
    
    // Required fields
    const requiredFields = ['id', 'name', 'version', 'rules'];
    for (const field of requiredFields) {
      if (!rulePack[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // ID format
    if (rulePack.id && !/^[a-z0-9-_]+$/.test(rulePack.id)) {
      errors.push('Rule pack ID must contain only lowercase letters, numbers, hyphens, and underscores');
    }
    
    // Version format
    if (rulePack.version && !/^\d+\.\d+\.\d+/.test(rulePack.version)) {
      errors.push('Version must follow semantic versioning (e.g., 1.0.0)');
    }
    
    // Rules array
    if (rulePack.rules && !Array.isArray(rulePack.rules)) {
      errors.push('Rules must be an array');
    } else if (rulePack.rules && rulePack.rules.length === 0) {
      errors.push('Rule pack must contain at least one rule');
    }
    
    return errors;
  }

  /**
   * Validate against schema
   */
  async _validateAgainstSchema(rulePack) {
    const errors = [];
    const schemaVersion = rulePack.schemaVersion || 'v1.0';
    
    if (!this.rulePackSchemas.has(schemaVersion)) {
      errors.push(`Unknown schema version: ${schemaVersion}`);
      return errors;
    }
    
    // Simple schema validation (in production, use ajv or similar)
    const schema = this.rulePackSchemas.get(schemaVersion);
    
    try {
      // This is a simplified validation - use proper JSON Schema validator
      if (!this._validateObjectAgainstSchema(rulePack, schema)) {
        errors.push('Rule pack does not conform to schema');
      }
    } catch (error) {
      errors.push(`Schema validation error: ${error.message}`);
    }
    
    return errors;
  }

  /**
   * Simple object schema validation
   */
  _validateObjectAgainstSchema(obj, schema) {
    // Simplified implementation - use ajv in production
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          return false;
        }
      }
    }
    
    if (schema.properties) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key];
        if (propSchema && !this._validateValue(value, propSchema)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Validate individual value against schema
   */
  _validateValue(value, schema) {
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        return false;
      }
    }
    
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        return false;
      }
    }
    
    if (schema.minimum !== undefined && typeof value === 'number') {
      if (value < schema.minimum) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate individual rule item
   */
  async _validateRuleItem(rule, index) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    const requiredFields = ['id', 'name', 'type', 'rule'];
    for (const field of requiredFields) {
      if (!rule[field]) {
        errors.push(`Rule ${index}: Missing required field: ${field}`);
      }
    }
    
    // Rule type validation
    const validTypes = ['n3', 'sparql', 'javascript', 'custom'];
    if (rule.type && !validTypes.includes(rule.type)) {
      errors.push(`Rule ${rule.id || index}: Invalid rule type: ${rule.type}`);
    }
    
    // Syntax validation based on type
    try {
      switch (rule.type) {
        case 'n3':
          await this._validateN3Rule(rule.rule);
          break;
        case 'sparql':
          await this._validateSPARQLRule(rule.rule);
          break;
        case 'javascript':
          await this._validateJavaScriptRule(rule.rule);
          break;
      }
    } catch (error) {
      errors.push(`Rule ${rule.id || index}: Syntax error: ${error.message}`);
    }
    
    // Priority validation
    if (rule.priority !== undefined && (typeof rule.priority !== 'number' || rule.priority < 0)) {
      warnings.push(`Rule ${rule.id || index}: Priority should be a non-negative number`);
    }
    
    return { errors, warnings };
  }

  /**
   * Validate N3 rule syntax
   */
  async _validateN3Rule(ruleString) {
    // Basic N3 rule validation
    if (!ruleString.includes('=>')) {
      throw new Error('N3 rule must contain "=>" separator');
    }
    
    const parts = ruleString.split('=>');
    if (parts.length !== 2) {
      throw new Error('N3 rule must have exactly one "=>" separator');
    }
    
    // Additional N3 syntax validation could be added here
  }

  /**
   * Validate SPARQL rule syntax
   */
  async _validateSPARQLRule(ruleString) {
    // Basic SPARQL validation
    if (!ruleString.trim().toUpperCase().includes('SELECT') && 
        !ruleString.trim().toUpperCase().includes('CONSTRUCT') &&
        !ruleString.trim().toUpperCase().includes('ASK') &&
        !ruleString.trim().toUpperCase().includes('DESCRIBE')) {
      throw new Error('SPARQL rule must be a valid query (SELECT, CONSTRUCT, ASK, or DESCRIBE)');
    }
  }

  /**
   * Validate JavaScript rule syntax
   */
  async _validateJavaScriptRule(ruleString) {
    try {
      // Basic JavaScript syntax check
      new Function(ruleString);
    } catch (error) {
      throw new Error(`Invalid JavaScript syntax: ${error.message}`);
    }
  }

  /**
   * Check dependencies
   */
  async _checkDependencies(rulePack) {
    const errors = [];
    
    if (!rulePack.dependencies || typeof rulePack.dependencies !== 'object') {
      return errors;
    }
    
    for (const [depId, depVersion] of Object.entries(rulePack.dependencies)) {
      const dependentRulePack = this.rulePacks.get(depId);
      
      if (!dependentRulePack) {
        errors.push(`Missing dependency: ${depId}@${depVersion}`);
        continue;
      }
      
      // Simple version check (in production, use semver)
      if (dependentRulePack.version !== depVersion && depVersion !== '*') {
        errors.push(`Version mismatch for dependency ${depId}: required ${depVersion}, found ${dependentRulePack.version}`);
      }
    }
    
    return errors;
  }

  /**
   * Resolve dependencies
   */
  async _resolveDependencies() {
    // Build dependency graph
    for (const [id, rulePack] of this.rulePacks) {
      if (rulePack.dependencies) {
        this.rulePackDependencies.set(id, Object.keys(rulePack.dependencies));
      }
    }
    
    // Check for circular dependencies
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCircularDependency = (rulePackId) => {
      visited.add(rulePackId);
      recursionStack.add(rulePackId);
      
      const dependencies = this.rulePackDependencies.get(rulePackId) || [];
      
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (hasCircularDependency(dep)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }
      
      recursionStack.delete(rulePackId);
      return false;
    };
    
    for (const rulePackId of this.rulePacks.keys()) {
      if (!visited.has(rulePackId) && hasCircularDependency(rulePackId)) {
        this.logger.warn(`Circular dependency detected involving rule pack: ${rulePackId}`);
      }
    }
  }

  /**
   * Detect rule conflicts
   */
  async _detectRuleConflicts() {
    this.ruleConflicts.clear();
    
    // Check for ID conflicts
    const ruleIds = new Map();
    
    for (const [rulePackId, rulePack] of this.rulePacks) {
      for (const rule of rulePack.rules) {
        if (ruleIds.has(rule.id)) {
          const existingRulePack = ruleIds.get(rule.id);
          
          if (existingRulePack !== rulePackId) {
            this.ruleConflicts.set(rule.id, {
              type: 'id_conflict',
              rule1: { id: rule.id, pack: existingRulePack },
              rule2: { id: rule.id, pack: rulePackId },
              severity: 'error',
              message: `Rule ID conflict: ${rule.id} exists in both ${existingRulePack} and ${rulePackId}`
            });
            
            this.metrics.conflictsDetected++;
          }
        } else {
          ruleIds.set(rule.id, rulePackId);
        }
      }
    }
    
    // Additional conflict detection logic could be added here
    // e.g., semantic conflicts, contradictory rules, etc.
  }

  /**
   * Compile rule for optimization
   */
  async _compileRule(rule) {
    // Rule compilation logic would depend on rule type
    // This is a simplified implementation
    
    switch (rule.type) {
      case 'n3':
        return this._compileN3Rule(rule.rule);
      case 'sparql':
        return this._compileSPARQLRule(rule.rule);
      case 'javascript':
        return this._compileJavaScriptRule(rule.rule);
      default:
        return null;
    }
  }

  /**
   * Compile N3 rule
   */
  _compileN3Rule(ruleString) {
    // Parse N3 rule into structured format
    const parts = ruleString.split('=>');
    return {
      antecedent: parts[0].trim(),
      consequent: parts[1].trim(),
      compiled: true
    };
  }

  /**
   * Compile SPARQL rule
   */
  _compileSPARQLRule(ruleString) {
    // Parse SPARQL query into structured format
    return {
      query: ruleString.trim(),
      compiled: true
    };
  }

  /**
   * Compile JavaScript rule
   */
  _compileJavaScriptRule(ruleString) {
    // Compile JavaScript rule function
    try {
      const compiledFunction = new Function('context', 'store', 'return (' + ruleString + ')');
      return {
        function: compiledFunction,
        compiled: true
      };
    } catch (error) {
      return null;
    }
  }

  // Helper methods

  /**
   * Load from file
   */
  async _loadFromFile(filePath) {
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * Load from URL
   */
  async _loadFromURL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Download rule pack
   */
  async _downloadRulePack(url, data) {
    const filename = path.basename(new URL(url).pathname) || 'downloaded-rule-pack.json';
    const filePath = path.join(this.config.downloadedRulesDirectory, filename);
    
    await fs.writeFile(filePath, data, 'utf8');
    return filePath;
  }

  /**
   * Load from marketplace
   */
  async _loadFromMarketplace(id, version) {
    const url = `${this.config.marketplaceUrl}/packs/${id}/${version}`;
    return await this._loadFromURL(url);
  }

  /**
   * Download from marketplace
   */
  async _downloadFromMarketplace(id, version) {
    const data = await this._loadFromMarketplace(id, version);
    const filename = `${id}-${version}.json`;
    const filePath = path.join(this.config.downloadedRulesDirectory, filename);
    
    await fs.writeFile(filePath, data, 'utf8');
    return filePath;
  }

  /**
   * Validate security
   */
  async _validateSecurity(rulePack) {
    const warnings = [];
    
    // Check for potentially unsafe JavaScript rules
    if (rulePack.rules) {
      for (const rule of rulePack.rules) {
        if (rule.type === 'javascript') {
          if (rule.rule.includes('eval') || rule.rule.includes('Function')) {
            warnings.push(`Rule ${rule.id}: Uses potentially unsafe JavaScript constructs`);
          }
        }
      }
    }
    
    // Check publisher trust
    if (rulePack.publisher && !this.config.trustedPublishers.includes(rulePack.publisher)) {
      warnings.push(`Rule pack from untrusted publisher: ${rulePack.publisher}`);
    }
    
    return warnings;
  }

  /**
   * Calculate rule pack hash
   */
  _calculateRulePackHash(rulePack) {
    const content = JSON.stringify(rulePack, Object.keys(rulePack).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate rule hash
   */
  _calculateRuleHash(rule) {
    const content = JSON.stringify(rule, Object.keys(rule).sort());
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if rule matches tags
   */
  _matchesTags(ruleTags, filterTags) {
    if (!ruleTags || !filterTags) return true;
    return filterTags.some(tag => ruleTags.includes(tag));
  }

  /**
   * Calculate average load time
   */
  _calculateAverageLoadTime() {
    // Implementation would track load times
    return 0;
  }

  /**
   * Calculate cache hit rate
   */
  _calculateCacheHitRate() {
    // Implementation would track cache hits/misses
    return 0;
  }

  /**
   * Validate dependencies
   */
  async _validateDependencies(dependencies) {
    const errors = [];
    
    for (const [depId, depVersion] of Object.entries(dependencies)) {
      if (!/^[a-z0-9-_]+$/.test(depId)) {
        errors.push(`Invalid dependency ID: ${depId}`);
      }
      
      if (!/^\d+\.\d+\.\d+$/.test(depVersion) && depVersion !== '*') {
        errors.push(`Invalid dependency version: ${depVersion}`);
      }
    }
    
    return errors;
  }

  /**
   * Validate rule pack against schema and rules
   */
  async _validateRulePack(rulePack, source) {
    // Check cache first
    const cacheKey = this._calculateRulePackHash(rulePack);
    
    if (this.validationCache.has(cacheKey)) {
      const cachedResult = this.validationCache.get(cacheKey);
      if (!cachedResult.valid) {
        throw new Error(`Validation failed: ${cachedResult.errors.join(', ')}`);
      }
      return cachedResult;
    }
    
    // Perform validation
    const validationResult = await this.validateRulePack(rulePack, source);
    
    // Cache result
    this.validationCache.set(cacheKey, validationResult);
    
    if (!validationResult.valid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    return validationResult;
  }
}

export default RulePackManager;