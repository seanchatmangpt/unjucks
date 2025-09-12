/**
 * KGEN SPARQL Rule Engine - Complex Governance Logic Evaluation
 * 
 * Implements SPARQL-based rule evaluation for sophisticated governance scenarios
 * that go beyond basic SHACL validation. Provides dynamic rule execution with
 * caching, performance optimization, and comprehensive audit trails.
 * 
 * Dark-Matter Principles:
 * - Rules as executable code, not documentation
 * - Machine enforcement prevents human oversight failures
 * - Predictable outcomes through deterministic rule evaluation
 */

import { Parser as SparqlParser } from 'sparqljs';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory } from 'rdf-ext';
import clownface from 'clownface';
import { Parser as N3Parser, Store as N3Store } from 'n3';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { EventEmitter } from 'events';

/**
 * SPARQL rule execution results
 */
export const SPARQLRuleResult = {
  PASS: 'pass',
  FAIL: 'fail',
  ERROR: 'error',
  PENDING: 'pending'
};

/**
 * Rule execution priorities
 */
export const RulePriority = {
  CRITICAL: 'critical',    // Blocking - immediate failure
  HIGH: 'high',           // Important - should not proceed
  MEDIUM: 'medium',       // Warning - log but continue
  LOW: 'low',            // Info - tracking only
  INFO: 'info'           // Information only
};

/**
 * SPARQL-based rule evaluation engine for complex governance logic
 */
export class SPARQLRuleEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Performance settings
      timeout: options.timeout || 30000,
      maxRuleExecutionTime: options.maxRuleExecutionTime || 5000,
      maxConcurrentRules: options.maxConcurrentRules || 10,
      
      // Rule management
      rulesPath: options.rulesPath || './src/kgen/validation/rules',
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      enableCaching: options.enableCaching !== false,
      
      // Audit and monitoring
      auditPath: options.auditPath || './.kgen/audit/sparql-rules',
      enableAuditTrail: options.enableAuditTrail !== false,
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      
      // Query execution
      queryEngine: options.queryEngine || null,
      factory: options.factory || DataFactory,
      
      logger: options.logger || consola,
      ...options
    };
    
    this.queryEngine = null;
    this.ruleRegistry = new Map();
    this.ruleCache = new Map();
    this.executionMetrics = new Map();
    this.auditTrail = [];
    this.activeExecutions = new Set();
    
    this.initialized = false;
  }

  /**
   * Initialize SPARQL rule engine
   */
  async initialize() {
    try {
      this.options.logger.info('🔧 Initializing SPARQL Rule Engine...');
      
      // Initialize query engine
      this.queryEngine = this.options.queryEngine || new QueryEngine();
      
      // Ensure directories exist
      await fs.ensureDir(this.options.rulesPath);
      await fs.ensureDir(this.options.auditPath);
      
      // Load rule library
      await this.loadRuleLibrary();
      
      // Setup cache cleanup
      this.setupCacheCleanup();
      
      this.initialized = true;
      
      this.options.logger.success(
        `✅ SPARQL Rule Engine initialized with ${this.ruleRegistry.size} rules`
      );
      
      this.emit('initialized', {
        rulesCount: this.ruleRegistry.size,
        rulesPath: this.options.rulesPath,
        cacheEnabled: this.options.enableCaching
      });
      
    } catch (error) {
      this.options.logger.error('Failed to initialize SPARQL Rule Engine:', error.message);
      throw new Error(`SPARQL Rule Engine initialization failed: ${error.message}`);
    }
  }

  /**
   * Execute SPARQL rule against RDF data
   * @param {string} ruleId - Rule identifier
   * @param {string|Object} dataGraph - RDF data to evaluate
   * @param {Object} context - Execution context
   * @param {Object} options - Rule execution options
   * @returns {Promise<Object>} Rule execution result
   */
  async executeRule(ruleId, dataGraph, context = {}, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const executionId = crypto.randomUUID();
    const startTime = performance.now();
    
    try {
      // Check rule exists
      const rule = this.ruleRegistry.get(ruleId);
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      this.activeExecutions.add(executionId);
      
      this.options.logger.debug(`🔍 Executing SPARQL rule: ${ruleId} [${executionId}]`);
      
      // Check cache if enabled
      if (this.options.enableCaching) {
        const cachedResult = this.getCachedResult(ruleId, dataGraph, context);
        if (cachedResult) {
          this.options.logger.debug(`📦 Using cached result for rule: ${ruleId}`);
          return cachedResult;
        }
      }
      
      // Prepare RDF store
      const store = await this.prepareDataStore(dataGraph);
      
      // Execute rule query
      const queryResult = await this.executeRuleQuery(rule, store, context, options);
      
      // Evaluate rule result
      const ruleResult = this.evaluateRuleResult(rule, queryResult, context);
      
      // Record metrics
      const executionTime = performance.now() - startTime;
      this.recordMetrics(ruleId, executionTime, ruleResult);
      
      // Cache result if enabled
      if (this.options.enableCaching) {
        this.cacheResult(ruleId, dataGraph, context, ruleResult);
      }
      
      // Create audit entry
      if (this.options.enableAuditTrail) {
        await this.createAuditEntry(executionId, ruleId, ruleResult, context, executionTime);
      }
      
      this.emit('ruleExecuted', {
        executionId,
        ruleId,
        result: ruleResult.outcome,
        executionTime,
        context
      });
      
      return ruleResult;
      
    } catch (error) {
      const errorResult = {
        executionId,
        ruleId,
        outcome: SPARQLRuleResult.ERROR,
        passed: false,
        error: error.message,
        executionTime: performance.now() - startTime,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      this.options.logger.error(`❌ SPARQL rule execution failed: ${ruleId} - ${error.message}`);
      
      this.emit('ruleError', errorResult);
      
      return errorResult;
      
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute multiple rules in batch
   * @param {Array} rules - Array of rule configurations
   * @param {string|Object} dataGraph - RDF data to evaluate
   * @param {Object} context - Shared execution context
   * @param {Object} options - Batch execution options
   * @returns {Promise<Object>} Batch execution results
   */
  async executeBatch(rules, dataGraph, context = {}, options = {}) {
    const batchId = crypto.randomUUID();
    const startTime = performance.now();
    
    this.options.logger.info(`📊 Executing SPARQL rule batch: ${rules.length} rules [${batchId}]`);
    
    const results = {
      batchId,
      totalRules: rules.length,
      passed: 0,
      failed: 0,
      errors: 0,
      results: [],
      summary: {},
      executionTime: 0
    };
    
    try {
      // Prepare data store once for all rules
      const store = await this.prepareDataStore(dataGraph);
      
      // Execute rules with concurrency control
      const rulePromises = rules.map(async (ruleConfig, index) => {
        const ruleId = typeof ruleConfig === 'string' ? ruleConfig : ruleConfig.ruleId;
        const ruleOptions = typeof ruleConfig === 'object' ? ruleConfig.options : {};
        
        try {
          const result = await this.executeRuleOnStore(ruleId, store, context, {
            ...options,
            ...ruleOptions,
            batchIndex: index,
            batchId
          });
          
          return result;
          
        } catch (error) {
          return {
            ruleId,
            outcome: SPARQLRuleResult.ERROR,
            error: error.message,
            batchIndex: index
          };
        }
      });
      
      // Wait for all rules with concurrency control
      const concurrency = Math.min(this.options.maxConcurrentRules, rules.length);
      const batchResults = await this.executeConcurrently(rulePromises, concurrency);
      
      // Aggregate results
      for (const result of batchResults) {
        results.results.push(result);
        
        if (result.outcome === SPARQLRuleResult.PASS) {
          results.passed++;
        } else if (result.outcome === SPARQLRuleResult.FAIL) {
          results.failed++;
        } else if (result.outcome === SPARQLRuleResult.ERROR) {
          results.errors++;
        }
      }
      
      results.executionTime = performance.now() - startTime;
      
      // Generate summary
      results.summary = this.generateBatchSummary(results);
      
      // Log results
      this.logBatchResults(results);
      
      this.emit('batchExecuted', results);
      
      return results;
      
    } catch (error) {
      results.error = error.message;
      results.executionTime = performance.now() - startTime;
      
      this.options.logger.error(`❌ Batch execution failed: ${error.message}`);
      
      return results;
    }
  }

  /**
   * Load rule library from file system
   */
  async loadRuleLibrary() {
    try {
      const ruleFiles = await fs.readdir(this.options.rulesPath);
      const sparqlFiles = ruleFiles.filter(f => f.endsWith('.sparql') || f.endsWith('.rq'));
      
      for (const file of sparqlFiles) {
        const rulePath = path.join(this.options.rulesPath, file);
        const ruleContent = await fs.readFile(rulePath, 'utf8');
        
        const rule = this.parseRuleFile(file, ruleContent, rulePath);
        this.ruleRegistry.set(rule.id, rule);
        
        this.options.logger.debug(`📋 Loaded rule: ${rule.id} from ${file}`);
      }
      
    } catch (error) {
      this.options.logger.warn(`Failed to load rule library: ${error.message}`);
    }
  }

  /**
   * Parse rule file with metadata
   */
  parseRuleFile(filename, content, filepath) {
    const ruleId = path.basename(filename, path.extname(filename));
    
    // Extract metadata from comments
    const metadata = this.extractRuleMetadata(content);
    
    // Parse SPARQL query
    const sparqlQuery = this.extractSparqlQuery(content);
    
    return {
      id: ruleId,
      filepath,
      query: sparqlQuery,
      metadata: {
        title: metadata.title || ruleId,
        description: metadata.description || 'No description',
        priority: metadata.priority || RulePriority.MEDIUM,
        category: metadata.category || 'general',
        tags: metadata.tags || [],
        author: metadata.author || 'unknown',
        version: metadata.version || '1.0.0',
        created: metadata.created || this.getDeterministicDate().toISOString(),
        ...metadata
      },
      loadedAt: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Prepare RDF data store for querying
   */
  async prepareDataStore(dataGraph) {
    const store = new N3Store();
    
    if (typeof dataGraph === 'string') {
      // Parse RDF string
      const parser = new N3Parser();
      const quads = parser.parse(dataGraph);
      store.addQuads(quads);
    } else if (Array.isArray(dataGraph)) {
      // Add quads directly
      store.addQuads(dataGraph);
    } else if (dataGraph && dataGraph.dataset) {
      // Handle clownface or similar graph
      store.addQuads([...dataGraph.dataset]);
    }
    
    return store;
  }

  /**
   * Execute rule query against data store
   */
  async executeRuleQuery(rule, store, context, options) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Rule execution timeout: ${rule.id}`));
      }, this.options.maxRuleExecutionTime);
    });
    
    const queryPromise = this.queryEngine.queryBindings(rule.query, {
      sources: [store],
      // Add context variables as initial bindings if supported
      initialBindings: this.prepareInitialBindings(context)
    });
    
    return Promise.race([queryPromise, timeoutPromise]);
  }

  /**
   * Execute rule on pre-prepared store (for batch execution)
   */
  async executeRuleOnStore(ruleId, store, context, options) {
    const rule = this.ruleRegistry.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    const queryResult = await this.executeRuleQuery(rule, store, context, options);
    return this.evaluateRuleResult(rule, queryResult, context);
  }

  /**
   * Evaluate rule query results to determine pass/fail
   */
  evaluateRuleResult(rule, queryResult, context) {
    const results = [];
    const bindings = [];
    
    // Collect all bindings
    queryResult.forEach(binding => {
      bindings.push(binding);
      
      // Extract result data
      const resultData = {};
      for (const [key, value] of binding) {
        resultData[key] = value.value || value.toString();
      }
      results.push(resultData);
    });
    
    // Determine outcome based on rule type and results
    const outcome = this.determineRuleOutcome(rule, results);
    const passed = outcome === SPARQLRuleResult.PASS;
    
    return {
      ruleId: rule.id,
      outcome,
      passed,
      results,
      bindingsCount: bindings.length,
      rule: {
        title: rule.metadata.title,
        priority: rule.metadata.priority,
        category: rule.metadata.category
      },
      context: context.name || context.artifact || 'unknown',
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Determine rule outcome based on query results
   */
  determineRuleOutcome(rule, results) {
    // Default logic: if query returns results, rule fails
    // This can be overridden by rule-specific metadata
    const expectation = rule.metadata.expectation || 'no-results';
    
    switch (expectation) {
      case 'no-results':
        return results.length === 0 ? SPARQLRuleResult.PASS : SPARQLRuleResult.FAIL;
      case 'has-results':
        return results.length > 0 ? SPARQLRuleResult.PASS : SPARQLRuleResult.FAIL;
      case 'count-threshold':
        const threshold = rule.metadata.threshold || 0;
        return results.length <= threshold ? SPARQLRuleResult.PASS : SPARQLRuleResult.FAIL;
      default:
        return results.length === 0 ? SPARQLRuleResult.PASS : SPARQLRuleResult.FAIL;
    }
  }

  /**
   * Cache management
   */
  getCachedResult(ruleId, dataGraph, context) {
    const cacheKey = this.generateCacheKey(ruleId, dataGraph, context);
    const cached = this.ruleCache.get(cacheKey);
    
    if (cached && (this.getDeterministicTimestamp() - cached.timestamp) < this.options.cacheTTL) {
      return cached.result;
    }
    
    return null;
  }

  cacheResult(ruleId, dataGraph, context, result) {
    const cacheKey = this.generateCacheKey(ruleId, dataGraph, context);
    this.ruleCache.set(cacheKey, {
      result,
      timestamp: this.getDeterministicTimestamp()
    });
  }

  generateCacheKey(ruleId, dataGraph, context) {
    const dataHash = crypto
      .createHash('md5')
      .update(typeof dataGraph === 'string' ? dataGraph : JSON.stringify(dataGraph))
      .digest('hex');
    
    const contextHash = crypto
      .createHash('md5')
      .update(JSON.stringify(context, Object.keys(context).sort()))
      .digest('hex');
    
    return `${ruleId}:${dataHash}:${contextHash}`;
  }

  /**
   * Metrics and monitoring
   */
  recordMetrics(ruleId, executionTime, result) {
    if (!this.options.enablePerformanceTracking) return;
    
    if (!this.executionMetrics.has(ruleId)) {
      this.executionMetrics.set(ruleId, {
        totalExecutions: 0,
        totalTime: 0,
        averageTime: 0,
        successCount: 0,
        failureCount: 0,
        errorCount: 0,
        lastExecuted: null
      });
    }
    
    const metrics = this.executionMetrics.get(ruleId);
    metrics.totalExecutions++;
    metrics.totalTime += executionTime;
    metrics.averageTime = metrics.totalTime / metrics.totalExecutions;
    metrics.lastExecuted = this.getDeterministicDate().toISOString();
    
    switch (result.outcome) {
      case SPARQLRuleResult.PASS:
        metrics.successCount++;
        break;
      case SPARQLRuleResult.FAIL:
        metrics.failureCount++;
        break;
      case SPARQLRuleResult.ERROR:
        metrics.errorCount++;
        break;
    }
  }

  /**
   * Audit trail management
   */
  async createAuditEntry(executionId, ruleId, result, context, executionTime) {
    const auditEntry = {
      executionId,
      timestamp: this.getDeterministicDate().toISOString(),
      ruleId,
      outcome: result.outcome,
      passed: result.passed,
      executionTime: Math.round(executionTime),
      context: {
        name: context.name || context.artifact || 'unknown',
        environment: context.environment || 'development',
        user: context.user || 'system'
      },
      results: result.results?.length || 0,
      rule: {
        priority: result.rule?.priority,
        category: result.rule?.category
      }
    };
    
    this.auditTrail.push(auditEntry);
    
    // Persist to file
    const auditFile = path.join(this.options.auditPath, `rule-execution-${this.getDeterministicTimestamp()}.json`);
    await fs.writeJson(auditFile, auditEntry, { spaces: 2 });
  }

  /**
   * Utility methods
   */
  extractRuleMetadata(content) {
    const metadata = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        const comment = trimmed.substring(1).trim();
        
        // Parse metadata comments
        const metaMatch = comment.match(/^@(\w+):\s*(.+)$/);
        if (metaMatch) {
          const [, key, value] = metaMatch;
          metadata[key] = value.trim();
        }
      }
    }
    
    // Parse arrays
    if (metadata.tags) {
      metadata.tags = metadata.tags.split(',').map(t => t.trim());
    }
    
    return metadata;
  }

  extractSparqlQuery(content) {
    // Remove metadata comments and extract SPARQL query
    return content
      .split('\n')
      .filter(line => !line.trim().startsWith('#') && !line.trim().startsWith('//'))
      .join('\n')
      .trim();
  }

  prepareInitialBindings(context) {
    // Convert context to SPARQL bindings if supported
    const bindings = {};
    
    if (context.artifact) {
      bindings.artifact = DataFactory.namedNode(context.artifact);
    }
    
    if (context.environment) {
      bindings.environment = DataFactory.literal(context.environment);
    }
    
    return bindings;
  }

  async executeConcurrently(promises, concurrency) {
    const results = [];
    
    for (let i = 0; i < promises.length; i += concurrency) {
      const batch = promises.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  generateBatchSummary(results) {
    const summary = {
      passRate: ((results.passed / results.totalRules) * 100).toFixed(2),
      failRate: ((results.failed / results.totalRules) * 100).toFixed(2),
      errorRate: ((results.errors / results.totalRules) * 100).toFixed(2),
      averageExecutionTime: (results.executionTime / results.totalRules).toFixed(2),
      criticalFailures: 0,
      categories: {},
      priorities: {}
    };
    
    for (const result of results.results) {
      // Count by priority
      const priority = result.rule?.priority || 'unknown';
      summary.priorities[priority] = (summary.priorities[priority] || 0) + 1;
      
      // Count by category
      const category = result.rule?.category || 'unknown';
      summary.categories[category] = (summary.categories[category] || 0) + 1;
      
      // Count critical failures
      if (result.outcome === SPARQLRuleResult.FAIL && priority === RulePriority.CRITICAL) {
        summary.criticalFailures++;
      }
    }
    
    return summary;
  }

  logBatchResults(results) {
    const { batchId, totalRules, passed, failed, errors, executionTime } = results;
    
    this.options.logger.info(
      `📊 Batch ${batchId}: ${totalRules} rules executed in ${executionTime.toFixed(2)}ms`
    );
    this.options.logger.info(
      `   Results: ✅ ${passed} passed, ❌ ${failed} failed, 🚫 ${errors} errors`
    );
    
    if (results.summary.criticalFailures > 0) {
      this.options.logger.warn(
        `   ⚠️  ${results.summary.criticalFailures} critical failures detected`
      );
    }
  }

  setupCacheCleanup() {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = this.getDeterministicTimestamp();
      for (const [key, cached] of this.ruleCache) {
        if ((now - cached.timestamp) > this.options.cacheTTL) {
          this.ruleCache.delete(key);
        }
      }
    }, 300000);
  }

  /**
   * Get rule execution statistics
   */
  getStatistics() {
    return {
      rulesLoaded: this.ruleRegistry.size,
      cacheSize: this.ruleCache.size,
      activeExecutions: this.activeExecutions.size,
      totalAuditEntries: this.auditTrail.length,
      executionMetrics: Object.fromEntries(this.executionMetrics),
      recentActivity: this.auditTrail.slice(-10)
    };
  }

  /**
   * Clear caches and reset metrics
   */
  reset() {
    this.ruleCache.clear();
    this.executionMetrics.clear();
    this.auditTrail.length = 0;
    this.activeExecutions.clear();
  }
}

export default SPARQLRuleEngine;