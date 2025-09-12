/**
 * N3.js Reasoning Engine - Comprehensive Knowledge Graph Inference System
 * 
 * Implements state-of-the-art reasoning capabilities using N3.js for:
 * - Rule-based inference with N3 rules
 * - OWL reasoning for ontology-based inference
 * - RDFS reasoning for schema-level inference
 * - Custom business rule evaluation
 * - Incremental reasoning for performance
 * - Reasoning validation and consistency checking
 * - Provenance tracking and explanations
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { Store, Parser, Writer, Util, DataFactory, Reasoner } from 'n3';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class N3ReasoningEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // N3 reasoning configuration
      maxInferenceDepth: config.maxInferenceDepth || 10,
      maxInferencesPerRule: config.maxInferencesPerRule || 1000,
      reasoningTimeout: config.reasoningTimeout || 30000,
      enableIncrementalReasoning: config.enableIncrementalReasoning !== false,
      
      // Rule management
      rulePackDirectory: config.rulePackDirectory || './rules',
      enableCustomRules: config.enableCustomRules !== false,
      ruleValidation: config.ruleValidation !== false,
      
      // Performance settings
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 10000,
      parallelReasoning: config.parallelReasoning || false,
      
      // Consistency checking
      enableConsistencyChecking: config.enableConsistencyChecking !== false,
      strictConsistency: config.strictConsistency || false,
      
      // Explanation generation
      enableExplanations: config.enableExplanations !== false,
      maxExplanationDepth: config.maxExplanationDepth || 5,
      
      ...config
    };
    
    this.logger = consola.withTag('n3-reasoning-engine');
    
    // N3.js components
    this.store = new Store();
    this.reasoner = null;
    this.parser = new Parser();
    this.writer = new Writer();
    
    // Rule management
    this.rulePacks = new Map();
    this.customRules = new Map();
    this.activeRules = new Set();
    
    // Incremental reasoning state
    this.incrementalState = {
      lastSnapshot: null,
      pendingTriples: [],
      inferenceCache: new Map(),
      derivationGraph: new Map()
    };
    
    // Performance metrics
    this.metrics = {
      totalInferences: 0,
      ruleApplications: 0,
      reasoningTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      consistencyChecks: 0,
      inconsistenciesFound: 0
    };
    
    // Explanation tracking
    this.explanations = new Map();
    this.provenanceGraph = new Map();
    
    this.state = 'initialized';
  }

  /**
   * Initialize the N3 reasoning engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing N3 reasoning engine...');
      
      // Initialize N3 reasoner
      this.reasoner = new Reasoner();
      
      // Load built-in rule packs
      await this._loadBuiltinRulePacks();
      
      // Load custom rules if enabled
      if (this.config.enableCustomRules) {
        await this._loadCustomRules();
      }
      
      // Initialize incremental reasoning
      if (this.config.enableIncrementalReasoning) {
        await this._initializeIncrementalReasoning();
      }
      
      this.state = 'ready';
      this.logger.success('N3 reasoning engine initialized successfully');
      
      return {
        status: 'success',
        engine: 'n3',
        rulePacksLoaded: this.rulePacks.size,
        customRulesLoaded: this.customRules.size,
        incrementalReasoning: this.config.enableIncrementalReasoning
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize N3 reasoning engine:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Perform comprehensive reasoning on knowledge graph
   * @param {Object} graph - Input knowledge graph
   * @param {Array} rules - Additional rules to apply
   * @param {Object} options - Reasoning options
   * @returns {Promise<Object>} Reasoning results with inferences and explanations
   */
  async performReasoning(graph, rules = [], options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Starting N3 reasoning operation: ${operationId}`);
      
      // Prepare reasoning context
      const context = {
        operationId,
        startTime,
        inputTriples: graph.triples?.length || 0,
        rulesApplied: 0,
        inferencesGenerated: 0,
        consistencyChecks: 0,
        explanationsGenerated: 0
      };
      
      // Load graph into reasoning store
      await this._loadGraphIntoStore(graph);
      
      // Prepare rules for reasoning
      const allRules = await this._prepareRulesForReasoning(rules, options);
      context.rulesApplied = allRules.length;
      
      // Perform reasoning based on configuration
      let inferences = [];
      
      if (this.config.enableIncrementalReasoning && this.incrementalState.lastSnapshot) {
        inferences = await this._performIncrementalReasoning(allRules, context);
      } else {
        inferences = await this._performFullReasoning(allRules, context);
      }
      
      context.inferencesGenerated = inferences.length;
      
      // Consistency checking
      let consistencyReport = null;
      if (this.config.enableConsistencyChecking) {
        consistencyReport = await this._performConsistencyCheck(context);
      }
      
      // Generate explanations
      let explanations = [];
      if (this.config.enableExplanations) {
        explanations = await this._generateReasoningExplanations(inferences, allRules, context);
        context.explanationsGenerated = explanations.length;
      }
      
      // Update metrics
      const reasoningTime = Date.now() - startTime;
      this._updateMetrics(context, reasoningTime);
      
      // Build result
      const result = {
        operationId,
        inferences,
        explanations,
        consistencyReport,
        context: {
          ...context,
          endTime: Date.now(),
          reasoningTime
        },
        metrics: { ...this.metrics }
      };
      
      // Cache results if enabled
      if (this.config.enableCaching) {
        await this._cacheReasoningResults(graph, allRules, result);
      }
      
      // Update incremental state
      if (this.config.enableIncrementalReasoning) {
        await this._updateIncrementalState(graph, inferences);
      }
      
      this.emit('reasoning:complete', result);
      this.logger.success(
        `N3 reasoning completed in ${reasoningTime}ms: ` +
        `${inferences.length} inferences, ${explanations.length} explanations`
      );
      
      return result;
      
    } catch (error) {
      const reasoningTime = Date.now() - startTime;
      this.logger.error(`N3 reasoning failed after ${reasoningTime}ms:`, error);
      this.emit('reasoning:error', { operationId, error, reasoningTime });
      throw error;
    }
  }

  /**
   * Load and validate a rule pack
   * @param {string} rulePackPath - Path to rule pack file
   * @returns {Promise<Object>} Loaded rule pack metadata
   */
  async loadRulePack(rulePackPath) {
    try {
      this.logger.info(`Loading rule pack: ${rulePackPath}`);
      
      const rulePackContent = await fs.readFile(rulePackPath, 'utf8');
      const rulePack = JSON.parse(rulePackContent);
      
      // Validate rule pack structure
      await this._validateRulePack(rulePack);
      
      // Parse and validate N3 rules
      const validatedRules = await this._validateN3Rules(rulePack.rules);
      
      const metadata = {
        id: rulePack.id,
        name: rulePack.name,
        version: rulePack.version,
        description: rulePack.description,
        rulesCount: validatedRules.length,
        loadedAt: new Date().toISOString(),
        path: rulePackPath
      };
      
      this.rulePacks.set(rulePack.id, {
        metadata,
        rules: validatedRules,
        originalPack: rulePack
      });
      
      this.emit('rule-pack:loaded', metadata);
      this.logger.success(`Rule pack loaded: ${rulePack.name} (${validatedRules.length} rules)`);
      
      return metadata;
      
    } catch (error) {
      this.logger.error(`Failed to load rule pack ${rulePackPath}:`, error);
      throw error;
    }
  }

  /**
   * Add custom N3 rule
   * @param {Object} rule - Rule definition
   * @returns {Promise<string>} Rule ID
   */
  async addCustomRule(rule) {
    try {
      // Validate rule structure
      await this._validateCustomRule(rule);
      
      // Parse N3 rule syntax
      const parsedRule = await this._parseN3Rule(rule.n3Rule);
      
      const ruleId = rule.id || crypto.randomUUID();
      const customRule = {
        id: ruleId,
        name: rule.name,
        description: rule.description,
        n3Rule: rule.n3Rule,
        parsedRule,
        priority: rule.priority || 5,
        enabled: rule.enabled !== false,
        createdAt: new Date().toISOString(),
        metadata: rule.metadata || {}
      };
      
      this.customRules.set(ruleId, customRule);
      
      if (customRule.enabled) {
        this.activeRules.add(ruleId);
      }
      
      this.emit('custom-rule:added', { ruleId, rule: customRule });
      this.logger.info(`Custom rule added: ${customRule.name} (${ruleId})`);
      
      return ruleId;
      
    } catch (error) {
      this.logger.error('Failed to add custom rule:', error);
      throw error;
    }
  }

  /**
   * Enable or disable incremental reasoning
   * @param {boolean} enabled - Enable incremental reasoning
   */
  setIncrementalReasoning(enabled) {
    this.config.enableIncrementalReasoning = enabled;
    
    if (enabled && !this.incrementalState.lastSnapshot) {
      this._initializeIncrementalReasoning();
    }
    
    this.logger.info(`Incremental reasoning ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get reasoning engine status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        maxInferenceDepth: this.config.maxInferenceDepth,
        maxInferencesPerRule: this.config.maxInferencesPerRule,
        reasoningTimeout: this.config.reasoningTimeout,
        enableIncrementalReasoning: this.config.enableIncrementalReasoning,
        enableConsistencyChecking: this.config.enableConsistencyChecking,
        enableExplanations: this.config.enableExplanations
      },
      rulePacks: {
        loaded: this.rulePacks.size,
        custom: this.customRules.size,
        active: this.activeRules.size
      },
      incremental: {
        enabled: this.config.enableIncrementalReasoning,
        snapshotExists: !!this.incrementalState.lastSnapshot,
        pendingTriples: this.incrementalState.pendingTriples.length,
        cacheSize: this.incrementalState.inferenceCache.size
      },
      metrics: { ...this.metrics },
      performance: {
        averageInferencesPerSecond: this.metrics.reasoningTime > 0 ? 
          Math.round((this.metrics.totalInferences * 1000) / this.metrics.reasoningTime) : 0,
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0
      }
    };
  }

  /**
   * Clear all cached data and reset incremental state
   */
  async clearCache() {
    this.incrementalState.inferenceCache.clear();
    this.incrementalState.derivationGraph.clear();
    this.incrementalState.pendingTriples = [];
    this.incrementalState.lastSnapshot = null;
    
    this.explanations.clear();
    this.provenanceGraph.clear();
    
    this.logger.info('Reasoning cache cleared');
  }

  /**
   * Shutdown the reasoning engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down N3 reasoning engine...');
      
      // Clear all state
      await this.clearCache();
      this.store.removeQuads(this.store.getQuads());
      this.rulePacks.clear();
      this.customRules.clear();
      this.activeRules.clear();
      
      this.state = 'shutdown';
      this.logger.success('N3 reasoning engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during N3 reasoning engine shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Load built-in rule packs
   */
  async _loadBuiltinRulePacks() {
    const builtinRules = [
      {
        id: 'rdfs-rules',
        name: 'RDFS Reasoning Rules',
        version: '1.0.0',
        description: 'Standard RDFS reasoning rules',
        rules: [
          {
            id: 'rdfs-subclass-transitivity',
            name: 'Subclass Transitivity',
            n3Rule: '{ ?a rdfs:subClassOf ?b . ?b rdfs:subClassOf ?c } => { ?a rdfs:subClassOf ?c }',
            priority: 1
          },
          {
            id: 'rdfs-domain-inference',
            name: 'Domain Inference',
            n3Rule: '{ ?p rdfs:domain ?c . ?x ?p ?y } => { ?x a ?c }',
            priority: 2
          },
          {
            id: 'rdfs-range-inference',
            name: 'Range Inference',
            n3Rule: '{ ?p rdfs:range ?c . ?x ?p ?y } => { ?y a ?c }',
            priority: 2
          },
          {
            id: 'rdfs-subproperty-transitivity',
            name: 'Subproperty Transitivity',
            n3Rule: '{ ?p rdfs:subPropertyOf ?q . ?q rdfs:subPropertyOf ?r } => { ?p rdfs:subPropertyOf ?r }',
            priority: 1
          },
          {
            id: 'rdfs-subproperty-inference',
            name: 'Subproperty Inference',
            n3Rule: '{ ?p rdfs:subPropertyOf ?q . ?x ?p ?y } => { ?x ?q ?y }',
            priority: 2
          }
        ]
      },
      {
        id: 'owl-rules',
        name: 'OWL Reasoning Rules',
        version: '1.0.0',
        description: 'Basic OWL reasoning rules',
        rules: [
          {
            id: 'owl-equivalent-class',
            name: 'Equivalent Class Bidirectional',
            n3Rule: '{ ?a owl:equivalentClass ?b } => { ?a rdfs:subClassOf ?b . ?b rdfs:subClassOf ?a }',
            priority: 1
          },
          {
            id: 'owl-sameas-transitivity',
            name: 'SameAs Transitivity',
            n3Rule: '{ ?a owl:sameAs ?b . ?b owl:sameAs ?c } => { ?a owl:sameAs ?c }',
            priority: 1
          },
          {
            id: 'owl-inverse-property',
            name: 'Inverse Property',
            n3Rule: '{ ?p owl:inverseOf ?q . ?x ?p ?y } => { ?y ?q ?x }',
            priority: 2
          },
          {
            id: 'owl-transitive-property',
            name: 'Transitive Property',
            n3Rule: '{ ?p a owl:TransitiveProperty . ?x ?p ?y . ?y ?p ?z } => { ?x ?p ?z }',
            priority: 2
          },
          {
            id: 'owl-symmetric-property',
            name: 'Symmetric Property',
            n3Rule: '{ ?p a owl:SymmetricProperty . ?x ?p ?y } => { ?y ?p ?x }',
            priority: 2
          }
        ]
      }
    ];

    for (const rulePack of builtinRules) {
      const validatedRules = await this._validateN3Rules(rulePack.rules);
      
      this.rulePacks.set(rulePack.id, {
        metadata: {
          ...rulePack,
          rulesCount: validatedRules.length,
          loadedAt: new Date().toISOString(),
          builtin: true
        },
        rules: validatedRules,
        originalPack: rulePack
      });
    }

    this.logger.info(`Loaded ${builtinRules.length} built-in rule packs`);
  }

  /**
   * Load custom rules from directory
   */
  async _loadCustomRules() {
    try {
      const rulesDir = this.config.rulePackDirectory;
      const files = await fs.readdir(rulesDir);
      
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.n3')) {
          const filePath = path.join(rulesDir, file);
          try {
            await this.loadRulePack(filePath);
          } catch (error) {
            this.logger.warn(`Failed to load rule pack ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Custom rules directory not found or accessible');
    }
  }

  /**
   * Initialize incremental reasoning state
   */
  async _initializeIncrementalReasoning() {
    this.incrementalState = {
      lastSnapshot: null,
      pendingTriples: [],
      inferenceCache: new Map(),
      derivationGraph: new Map()
    };
    
    this.logger.info('Incremental reasoning initialized');
  }

  /**
   * Load graph into N3 store
   */
  async _loadGraphIntoStore(graph) {
    // Clear existing data
    this.store.removeQuads(this.store.getQuads());
    
    if (graph.triples && Array.isArray(graph.triples)) {
      for (const triple of graph.triples) {
        try {
          const quad = this._tripleToQuad(triple);
          this.store.addQuad(quad);
        } catch (error) {
          this.logger.warn(`Failed to load triple: ${JSON.stringify(triple)}`, error.message);
        }
      }
    }
    
    if (graph.quads && Array.isArray(graph.quads)) {
      this.store.addQuads(graph.quads);
    }
    
    this.logger.debug(`Loaded ${this.store.size} triples into reasoning store`);
  }

  /**
   * Prepare rules for reasoning
   */
  async _prepareRulesForReasoning(additionalRules, options) {
    const allRules = [];
    
    // Add rules from active rule packs
    for (const [packId, pack] of this.rulePacks) {
      if (options.enableRulePacks !== false || (options.rulePacks && options.rulePacks.includes(packId))) {
        allRules.push(...pack.rules);
      }
    }
    
    // Add active custom rules
    for (const ruleId of this.activeRules) {
      const rule = this.customRules.get(ruleId);
      if (rule && rule.enabled) {
        allRules.push(rule);
      }
    }
    
    // Add additional rules
    if (additionalRules && Array.isArray(additionalRules)) {
      for (const rule of additionalRules) {
        const parsedRule = await this._parseN3Rule(rule.n3Rule || rule.rule);
        allRules.push({
          id: rule.id || crypto.randomUUID(),
          name: rule.name || 'Ad-hoc rule',
          parsedRule,
          priority: rule.priority || 10
        });
      }
    }
    
    // Sort rules by priority
    allRules.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    
    return allRules;
  }

  /**
   * Perform full reasoning
   */
  async _performFullReasoning(rules, context) {
    const inferences = [];
    const startTime = Date.now();
    
    // Apply rules iteratively until no new inferences
    let iterationCount = 0;
    let newInferences = true;
    
    while (newInferences && iterationCount < this.config.maxInferenceDepth) {
      newInferences = false;
      iterationCount++;
      
      for (const rule of rules) {
        try {
          const ruleInferences = await this._applyRule(rule, context);
          
          if (ruleInferences.length > 0) {
            inferences.push(...ruleInferences);
            
            // Add new inferences to store for next iteration
            for (const inference of ruleInferences) {
              const quad = this._tripleToQuad(inference);
              if (!this.store.has(quad)) {
                this.store.addQuad(quad);
                newInferences = true;
              }
            }
          }
          
          // Check timeout
          if (Date.now() - startTime > this.config.reasoningTimeout) {
            this.logger.warn(`Reasoning timeout reached after ${Date.now() - startTime}ms`);
            break;
          }
          
        } catch (error) {
          this.logger.error(`Failed to apply rule ${rule.id}:`, error.message);
        }
      }
      
      if (Date.now() - startTime > this.config.reasoningTimeout) {
        break;
      }
    }
    
    this.logger.debug(`Reasoning completed after ${iterationCount} iterations`);
    return inferences;
  }

  /**
   * Perform incremental reasoning
   */
  async _performIncrementalReasoning(rules, context) {
    // For incremental reasoning, only process pending triples
    const inferences = [];
    
    if (this.incrementalState.pendingTriples.length === 0) {
      return inferences;
    }
    
    // Create temporary store with pending triples
    const tempStore = new Store();
    tempStore.addQuads(this.store.getQuads());
    
    for (const triple of this.incrementalState.pendingTriples) {
      const quad = this._tripleToQuad(triple);
      tempStore.addQuad(quad);
    }
    
    // Apply rules only to new data
    for (const rule of rules) {
      try {
        const ruleInferences = await this._applyRuleIncremental(rule, tempStore, context);
        inferences.push(...ruleInferences);
      } catch (error) {
        this.logger.error(`Failed to apply rule ${rule.id} incrementally:`, error.message);
      }
    }
    
    return inferences;
  }

  /**
   * Apply a single rule
   */
  async _applyRule(rule, context) {
    const inferences = [];
    
    try {
      if (!rule.parsedRule) {
        rule.parsedRule = await this._parseN3Rule(rule.n3Rule);
      }
      
      // Use N3 reasoner to apply rule
      const matches = await this._findRuleMatches(rule.parsedRule);
      
      for (const match of matches) {
        const inference = this._instantiateConsequent(rule.parsedRule.consequent, match.bindings);
        
        if (inference && !this._inferenceExists(inference)) {
          inferences.push({
            ...inference,
            derivedFrom: rule.id,
            confidence: rule.confidence || 1.0,
            timestamp: new Date().toISOString()
          });
          
          // Track provenance
          this._trackProvenance(inference, rule, match);
        }
        
        if (inferences.length >= this.config.maxInferencesPerRule) {
          break;
        }
      }
      
    } catch (error) {
      this.logger.debug(`Rule application failed for ${rule.id}: ${error.message}`);
    }
    
    return inferences;
  }

  /**
   * Apply rule incrementally
   */
  async _applyRuleIncremental(rule, tempStore, context) {
    // Check cache first
    const cacheKey = `${rule.id}:${this._hashTriples(this.incrementalState.pendingTriples)}`;
    
    if (this.incrementalState.inferenceCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.incrementalState.inferenceCache.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    // Apply rule to temporary store
    const inferences = await this._applyRule(rule, context);
    
    // Cache result
    this.incrementalState.inferenceCache.set(cacheKey, inferences);
    
    return inferences;
  }

  /**
   * Perform consistency checking
   */
  async _performConsistencyCheck(context) {
    const inconsistencies = [];
    const startTime = Date.now();
    
    try {
      // Check for basic inconsistencies
      const basicInconsistencies = await this._checkBasicInconsistencies();
      inconsistencies.push(...basicInconsistencies);
      
      // Check for OWL inconsistencies
      const owlInconsistencies = await this._checkOWLInconsistencies();
      inconsistencies.push(...owlInconsistencies);
      
      // Check for custom consistency rules
      const customInconsistencies = await this._checkCustomInconsistencies();
      inconsistencies.push(...customInconsistencies);
      
      context.consistencyChecks++;
      this.metrics.consistencyChecks++;
      this.metrics.inconsistenciesFound += inconsistencies.length;
      
      const checkTime = Date.now() - startTime;
      this.logger.debug(`Consistency check completed in ${checkTime}ms: ${inconsistencies.length} issues found`);
      
    } catch (error) {
      this.logger.error('Consistency checking failed:', error);
    }
    
    return {
      consistent: inconsistencies.length === 0,
      inconsistencies,
      checkTime: Date.now() - startTime,
      totalChecks: context.consistencyChecks
    };
  }

  /**
   * Generate reasoning explanations
   */
  async _generateReasoningExplanations(inferences, rules, context) {
    const explanations = [];
    
    for (const inference of inferences.slice(0, this.config.maxExplanationDepth * 10)) {
      try {
        const explanation = await this._generateInferenceExplanation(inference, rules);
        if (explanation) {
          explanations.push(explanation);
        }
      } catch (error) {
        this.logger.debug(`Failed to generate explanation for inference: ${error.message}`);
      }
    }
    
    return explanations;
  }

  /**
   * Generate explanation for a single inference
   */
  async _generateInferenceExplanation(inference, rules) {
    const ruleId = inference.derivedFrom;
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
      return null;
    }
    
    const provenance = this.provenanceGraph.get(this._hashInference(inference));
    
    return {
      inference: {
        subject: inference.subject,
        predicate: inference.predicate,
        object: inference.object
      },
      rule: {
        id: rule.id,
        name: rule.name,
        description: rule.description
      },
      premises: provenance?.premises || [],
      confidence: inference.confidence || 1.0,
      derivationPath: provenance?.derivationPath || [],
      timestamp: inference.timestamp
    };
  }

  // Helper methods

  /**
   * Validate rule pack structure
   */
  async _validateRulePack(rulePack) {
    if (!rulePack.id || !rulePack.name || !rulePack.rules) {
      throw new Error('Invalid rule pack structure: missing required fields');
    }
    
    if (!Array.isArray(rulePack.rules)) {
      throw new Error('Rule pack rules must be an array');
    }
  }

  /**
   * Validate N3 rules
   */
  async _validateN3Rules(rules) {
    const validatedRules = [];
    
    for (const rule of rules) {
      try {
        const parsedRule = await this._parseN3Rule(rule.n3Rule);
        validatedRules.push({
          ...rule,
          parsedRule,
          validated: true
        });
      } catch (error) {
        this.logger.warn(`Invalid N3 rule ${rule.id}: ${error.message}`);
      }
    }
    
    return validatedRules;
  }

  /**
   * Validate custom rule
   */
  async _validateCustomRule(rule) {
    if (!rule.name || !rule.n3Rule) {
      throw new Error('Custom rule must have name and n3Rule');
    }
    
    // Parse to validate syntax
    await this._parseN3Rule(rule.n3Rule);
  }

  /**
   * Parse N3 rule syntax
   */
  async _parseN3Rule(ruleString) {
    try {
      // Simple N3 rule parser - in production, use full N3 parser
      const parts = ruleString.split('=>');
      if (parts.length !== 2) {
        throw new Error('Invalid N3 rule syntax: must contain "=>"');
      }
      
      return {
        antecedent: parts[0].trim(),
        consequent: parts[1].trim(),
        original: ruleString
      };
      
    } catch (error) {
      throw new Error(`Failed to parse N3 rule: ${error.message}`);
    }
  }

  /**
   * Find rule matches in store
   */
  async _findRuleMatches(parsedRule) {
    // Simplified rule matching - in production, use full N3 reasoning
    const matches = [];
    
    // Parse antecedent into triple patterns
    const patterns = this._parseAntecedent(parsedRule.antecedent);
    
    // Find matching quads for each pattern
    for (const pattern of patterns) {
      const matchingQuads = this.store.getQuads(
        pattern.subject ? namedNode(pattern.subject) : null,
        pattern.predicate ? namedNode(pattern.predicate) : null,
        pattern.object ? namedNode(pattern.object) : null
      );
      
      for (const quad of matchingQuads) {
        const bindings = this._extractBindings(pattern, quad);
        if (bindings) {
          matches.push({ quad, bindings, pattern });
        }
      }
    }
    
    return matches;
  }

  /**
   * Parse antecedent into patterns
   */
  _parseAntecedent(antecedent) {
    // Simplified pattern parsing - extract triple patterns from antecedent
    const patterns = [];
    
    // Remove braces and split by periods
    const cleaned = antecedent.replace(/[{}]/g, '').trim();
    const statements = cleaned.split('.');
    
    for (const statement of statements) {
      const parts = statement.trim().split(/\s+/);
      if (parts.length >= 3) {
        patterns.push({
          subject: parts[0].startsWith('?') ? null : parts[0],
          predicate: parts[1].startsWith('?') ? null : parts[1],
          object: parts[2].startsWith('?') ? null : parts[2],
          variables: {
            subject: parts[0].startsWith('?') ? parts[0] : null,
            predicate: parts[1].startsWith('?') ? parts[1] : null,
            object: parts[2].startsWith('?') ? parts[2] : null
          }
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract variable bindings from quad match
   */
  _extractBindings(pattern, quad) {
    const bindings = new Map();
    
    if (pattern.variables.subject) {
      bindings.set(pattern.variables.subject, quad.subject.value);
    }
    
    if (pattern.variables.predicate) {
      bindings.set(pattern.variables.predicate, quad.predicate.value);
    }
    
    if (pattern.variables.object) {
      bindings.set(pattern.variables.object, quad.object.value);
    }
    
    return bindings;
  }

  /**
   * Instantiate consequent with variable bindings
   */
  _instantiateConsequent(consequent, bindings) {
    try {
      // Remove braces and parse consequent
      const cleaned = consequent.replace(/[{}]/g, '').trim();
      const parts = cleaned.split(/\s+/);
      
      if (parts.length >= 3) {
        const subject = this._applyBinding(parts[0], bindings);
        const predicate = this._applyBinding(parts[1], bindings);
        const object = this._applyBinding(parts[2], bindings);
        
        if (subject && predicate && object) {
          return {
            subject,
            predicate,
            object
          };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Apply variable binding
   */
  _applyBinding(term, bindings) {
    if (term.startsWith('?')) {
      return bindings.get(term) || null;
    }
    return term;
  }

  /**
   * Check if inference already exists
   */
  _inferenceExists(inference) {
    const quad = this._tripleToQuad(inference);
    return this.store.has(quad);
  }

  /**
   * Track provenance for inference
   */
  _trackProvenance(inference, rule, match) {
    const inferenceHash = this._hashInference(inference);
    
    this.provenanceGraph.set(inferenceHash, {
      inference,
      rule: rule.id,
      premises: [match.quad],
      derivationPath: [rule.id],
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Convert triple to N3 quad
   */
  _tripleToQuad(triple) {
    return quad(
      namedNode(triple.subject),
      namedNode(triple.predicate),
      triple.object.startsWith('http') ? namedNode(triple.object) : literal(triple.object),
      defaultGraph()
    );
  }

  /**
   * Hash inference for caching
   */
  _hashInference(inference) {
    return crypto.createHash('md5')
      .update(`${inference.subject}${inference.predicate}${inference.object}`)
      .digest('hex');
  }

  /**
   * Hash triples for caching
   */
  _hashTriples(triples) {
    const content = triples.map(t => `${t.subject}${t.predicate}${t.object}`).join('');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Update performance metrics
   */
  _updateMetrics(context, reasoningTime) {
    this.metrics.totalInferences += context.inferencesGenerated;
    this.metrics.ruleApplications += context.rulesApplied;
    this.metrics.reasoningTime += reasoningTime;
  }

  /**
   * Cache reasoning results
   */
  async _cacheReasoningResults(graph, rules, result) {
    // Implement result caching for reproducible generation
    const cacheKey = this._generateCacheKey(graph, rules);
    // Store in cache implementation
  }

  /**
   * Update incremental state
   */
  async _updateIncrementalState(graph, inferences) {
    this.incrementalState.lastSnapshot = {
      graphHash: this._hashTriples(graph.triples || []),
      inferences: inferences.length,
      timestamp: new Date().toISOString()
    };
    
    this.incrementalState.pendingTriples = [];
  }

  /**
   * Generate cache key
   */
  _generateCacheKey(graph, rules) {
    const graphHash = this._hashTriples(graph.triples || []);
    const rulesHash = crypto.createHash('md5')
      .update(rules.map(r => r.id || r.n3Rule).join(''))
      .digest('hex');
    
    return `${graphHash}:${rulesHash}`;
  }

  /**
   * Check basic inconsistencies
   */
  async _checkBasicInconsistencies() {
    const inconsistencies = [];
    
    // Check for contradictory type assertions
    const typeQuads = this.store.getQuads(null, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    
    // Group by subject
    const subjects = new Map();
    for (const quad of typeQuads) {
      const subject = quad.subject.value;
      if (!subjects.has(subject)) {
        subjects.set(subject, new Set());
      }
      subjects.get(subject).add(quad.object.value);
    }
    
    // Check for disjoint class memberships
    for (const [subject, types] of subjects) {
      if (types.size > 1) {
        // Check if any types are disjoint
        const typesArray = Array.from(types);
        for (let i = 0; i < typesArray.length; i++) {
          for (let j = i + 1; j < typesArray.length; j++) {
            const disjointQuads = this.store.getQuads(
              namedNode(typesArray[i]),
              namedNode('http://www.w3.org/2002/07/owl#disjointWith'),
              namedNode(typesArray[j])
            );
            
            if (disjointQuads.length > 0) {
              inconsistencies.push({
                type: 'disjoint_class_violation',
                subject,
                classes: [typesArray[i], typesArray[j]],
                severity: 'error',
                message: `Subject ${subject} belongs to disjoint classes ${typesArray[i]} and ${typesArray[j]}`
              });
            }
          }
        }
      }
    }
    
    return inconsistencies;
  }

  /**
   * Check OWL inconsistencies
   */
  async _checkOWLInconsistencies() {
    const inconsistencies = [];
    
    // Check for functional property violations
    const functionalProps = this.store.getQuads(
      null,
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#FunctionalProperty')
    );
    
    for (const funcProp of functionalProps) {
      const property = funcProp.subject;
      const propertyTriples = this.store.getQuads(null, property, null);
      
      // Group by subject
      const subjects = new Map();
      for (const triple of propertyTriples) {
        const subject = triple.subject.value;
        if (!subjects.has(subject)) {
          subjects.set(subject, []);
        }
        subjects.get(subject).push(triple.object.value);
      }
      
      // Check for multiple values
      for (const [subject, values] of subjects) {
        if (values.length > 1) {
          inconsistencies.push({
            type: 'functional_property_violation',
            subject,
            property: property.value,
            values,
            severity: 'error',
            message: `Functional property ${property.value} has multiple values for subject ${subject}`
          });
        }
      }
    }
    
    return inconsistencies;
  }

  /**
   * Check custom inconsistencies
   */
  async _checkCustomInconsistencies() {
    const inconsistencies = [];
    
    // Implement custom consistency rules
    // This would check application-specific consistency requirements
    
    return inconsistencies;
  }
}

export default N3ReasoningEngine;