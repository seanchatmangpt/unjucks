/**
 * Semantic Reasoning Engine - Comprehensive Integration Layer
 * 
 * Integrates all semantic reasoning components into a unified system:
 * - N3.js reasoning engine for rule-based inference
 * - SHACL validator for constraint checking
 * - OWL reasoner for ontology-based inference
 * - Rule pack manager for dynamic rule loading
 * - Incremental reasoning engine for performance
 * - Inference cache for reproducible generation
 * - Template context enrichment via inference
 * - Compliance rule validation framework
 * - Reasoning explanations and provenance tracking
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import crypto from 'crypto';

// Import reasoning components
import N3ReasoningEngine from './reasoning/n3-reasoning-engine.js';
import SHACLValidator from './validation/shacl-validator.js';
import OWLReasoner from './reasoning/owl-reasoner.js';
import RulePackManager from './rules/rule-pack-manager.js';
import IncrementalReasoningEngine from './reasoning/incremental-reasoning-engine.js';
import InferenceCache from './cache/inference-cache.js';

export class SemanticReasoningEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Component enablement
      enableN3Reasoning: config.enableN3Reasoning !== false,
      enableSHACLValidation: config.enableSHACLValidation !== false,
      enableOWLReasoning: config.enableOWLReasoning !== false,
      enableRulePackManagement: config.enableRulePackManagement !== false,
      enableIncrementalReasoning: config.enableIncrementalReasoning !== false,
      enableInferenceCache: config.enableInferenceCache !== false,
      
      // Reasoning modes
      reasoningMode: config.reasoningMode || 'comprehensive', // minimal, standard, comprehensive
      enableExplanations: config.enableExplanations !== false,
      enableProvenance: config.enableProvenance !== false,
      
      // Performance settings
      maxInferenceDepth: config.maxInferenceDepth || 10,
      reasoningTimeout: config.reasoningTimeout || 60000,
      enableParallelReasoning: config.enableParallelReasoning || false,
      
      // Integration settings
      enableTemplateEnrichment: config.enableTemplateEnrichment !== false,
      enableComplianceValidation: config.enableComplianceValidation !== false,
      
      // Component-specific configs
      n3Config: config.n3Config || {},
      shaclConfig: config.shaclConfig || {},
      owlConfig: config.owlConfig || {},
      rulePackConfig: config.rulePackConfig || {},
      incrementalConfig: config.incrementalConfig || {},
      cacheConfig: config.cacheConfig || {},
      
      ...config
    };
    
    this.logger = consola.withTag('semantic-reasoning-engine');
    
    // Component instances
    this.n3Engine = null;
    this.shaclValidator = null;
    this.owlReasoner = null;
    this.rulePackManager = null;
    this.incrementalEngine = null;
    this.inferenceCache = null;
    
    // Reasoning state
    this.reasoningHistory = [];
    this.explanationTraces = new Map();
    this.provenanceGraph = new Map();
    
    // Template enrichment
    this.templateContext = new Map();
    this.enrichmentRules = new Map();
    
    // Compliance framework
    this.complianceRules = new Map();
    this.complianceReports = [];
    
    // Performance metrics
    this.metrics = {
      totalReasoningOperations: 0,
      totalInferences: 0,
      totalValidations: 0,
      averageReasoningTime: 0,
      cacheHitRate: 0,
      complianceChecks: 0,
      explanationsGenerated: 0
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the semantic reasoning engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing semantic reasoning engine...');
      
      const initResults = {};
      
      // Initialize N3 reasoning engine
      if (this.config.enableN3Reasoning) {
        this.n3Engine = new N3ReasoningEngine(this.config.n3Config);
        initResults.n3Engine = await this.n3Engine.initialize();
        this._setupComponentEventHandlers(this.n3Engine, 'n3');
      }
      
      // Initialize SHACL validator
      if (this.config.enableSHACLValidation) {
        this.shaclValidator = new SHACLValidator(this.config.shaclConfig);
        initResults.shaclValidator = await this.shaclValidator.initialize();
        this._setupComponentEventHandlers(this.shaclValidator, 'shacl');
      }
      
      // Initialize OWL reasoner
      if (this.config.enableOWLReasoning) {
        this.owlReasoner = new OWLReasoner(this.config.owlConfig);
        initResults.owlReasoner = await this.owlReasoner.initialize();
        this._setupComponentEventHandlers(this.owlReasoner, 'owl');
      }
      
      // Initialize rule pack manager
      if (this.config.enableRulePackManagement) {
        this.rulePackManager = new RulePackManager(this.config.rulePackConfig);
        initResults.rulePackManager = await this.rulePackManager.initialize();
        this._setupComponentEventHandlers(this.rulePackManager, 'rulepack');
      }
      
      // Initialize incremental reasoning engine
      if (this.config.enableIncrementalReasoning) {
        this.incrementalEngine = new IncrementalReasoningEngine(this.config.incrementalConfig);
        initResults.incrementalEngine = await this.incrementalEngine.initialize();
        this._setupComponentEventHandlers(this.incrementalEngine, 'incremental');
      }
      
      // Initialize inference cache
      if (this.config.enableInferenceCache) {
        this.inferenceCache = new InferenceCache(this.config.cacheConfig);
        initResults.inferenceCache = await this.inferenceCache.initialize();
        this._setupComponentEventHandlers(this.inferenceCache, 'cache');
      }
      
      // Load built-in enrichment rules
      if (this.config.enableTemplateEnrichment) {
        await this._loadEnrichmentRules();
      }
      
      // Load compliance rules
      if (this.config.enableComplianceValidation) {
        await this._loadComplianceRules();
      }
      
      this.state = 'ready';
      this.logger.success('Semantic reasoning engine initialized successfully');
      
      return {
        status: 'success',
        components: initResults,
        reasoningMode: this.config.reasoningMode,
        capabilitiesEnabled: {
          n3Reasoning: !!this.n3Engine,
          shaclValidation: !!this.shaclValidator,
          owlReasoning: !!this.owlReasoner,
          rulePackManagement: !!this.rulePackManager,
          incrementalReasoning: !!this.incrementalEngine,
          inferenceCache: !!this.inferenceCache,
          templateEnrichment: this.config.enableTemplateEnrichment,
          complianceValidation: this.config.enableComplianceValidation
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize semantic reasoning engine:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Perform comprehensive semantic reasoning
   * @param {Object} graph - Knowledge graph to reason over
   * @param {Object} options - Reasoning options
   * @returns {Promise<Object>} Comprehensive reasoning results
   */
  async performReasoning(graph, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Starting comprehensive semantic reasoning: ${operationId}`);
      
      // Check cache first if enabled
      if (this.config.enableInferenceCache && this.inferenceCache && !options.skipCache) {
        const cacheKey = this._generateCacheKey(graph, options);
        const cachedResult = await this.inferenceCache.get(cacheKey);
        
        if (cachedResult) {
          this.logger.info(`Cache hit for reasoning operation: ${operationId}`);
          this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
          return {
            ...cachedResult,
            fromCache: true,
            operationId,
            cacheKey
          };
        }
      }
      
      const reasoningContext = {
        operationId,
        startTime,
        graph,
        options,
        mode: this.config.reasoningMode,
        results: {
          validationResults: null,
          n3Inferences: null,
          owlInferences: null,
          incrementalResults: null,
          complianceResults: null,
          enrichedContext: null,
          explanations: [],
          provenance: []
        },
        metrics: {
          validationTime: 0,
          n3ReasoningTime: 0,
          owlReasoningTime: 0,
          incrementalTime: 0,
          complianceTime: 0,
          enrichmentTime: 0,
          totalInferences: 0
        }
      };
      
      // Phase 1: Validation (if enabled)
      if (this.config.enableSHACLValidation && this.shaclValidator && !options.skipValidation) {
        await this._performValidationPhase(reasoningContext);
      }
      
      // Phase 2: Rule-based reasoning (if enabled and valid)
      if (this._shouldProceedToReasoning(reasoningContext)) {
        
        // N3 reasoning
        if (this.config.enableN3Reasoning && this.n3Engine) {
          await this._performN3ReasoningPhase(reasoningContext);
        }
        
        // OWL reasoning
        if (this.config.enableOWLReasoning && this.owlReasoner) {
          await this._performOWLReasoningPhase(reasoningContext);
        }
        
        // Incremental reasoning (if applicable)
        if (this.config.enableIncrementalReasoning && this.incrementalEngine && options.incremental) {
          await this._performIncrementalReasoningPhase(reasoningContext);
        }
      }
      
      // Phase 3: Template context enrichment (if enabled)
      if (this.config.enableTemplateEnrichment) {
        await this._performEnrichmentPhase(reasoningContext);
      }
      
      // Phase 4: Compliance validation (if enabled)
      if (this.config.enableComplianceValidation) {
        await this._performCompliancePhase(reasoningContext);
      }
      
      // Phase 5: Generate explanations and provenance (if enabled)
      if (this.config.enableExplanations) {
        await this._generateExplanationsPhase(reasoningContext);
      }
      
      if (this.config.enableProvenance) {
        await this._generateProvenancePhase(reasoningContext);
      }
      
      // Build final results
      const finalResults = await this._buildFinalResults(reasoningContext);
      
      // Cache results if enabled
      if (this.config.enableInferenceCache && this.inferenceCache && !options.skipCache) {
        const cacheKey = this._generateCacheKey(graph, options);
        await this.inferenceCache.put(cacheKey, finalResults, {
          ttl: options.cacheTTL,
          dependencies: this._extractDependencies(graph),
          operationId
        });
      }
      
      // Update metrics and history
      this._updateMetrics(reasoningContext);
      this._recordReasoningHistory(reasoningContext, finalResults);
      
      const totalTime = this.getDeterministicTimestamp() - startTime;
      
      this.emit('reasoning:complete', {
        operationId,
        totalTime,
        results: finalResults
      });
      
      this.logger.success(`Comprehensive reasoning completed in ${totalTime}ms: ${finalResults.totalInferences} inferences`);
      
      return finalResults;
      
    } catch (error) {
      const totalTime = this.getDeterministicTimestamp() - startTime;
      this.logger.error(`Semantic reasoning failed after ${totalTime}ms:`, error);
      this.emit('reasoning:error', { operationId, error, totalTime });
      throw error;
    }
  }

  /**
   * Validate knowledge graph using SHACL constraints
   * @param {Object} graph - Graph to validate
   * @param {Array} constraints - SHACL constraints
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateGraph(graph, constraints = [], options = {}) {
    if (!this.shaclValidator) {
      throw new Error('SHACL validation is not enabled');
    }
    
    return await this.shaclValidator.validateGraph(graph, options);
  }

  /**
   * Enrich template context with semantic information
   * @param {Object} graph - Source knowledge graph
   * @param {Object} template - Template to enrich
   * @param {Object} options - Enrichment options
   * @returns {Promise<Object>} Enriched template context
   */
  async enrichTemplateContext(graph, template, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.info(`Enriching template context: ${template.name || 'anonymous'}`);
      
      const enrichedContext = {
        original: template,
        semanticEnrichments: {},
        inferredProperties: {},
        complianceAnnotations: {},
        explanations: []
      };
      
      // Extract entities from template
      const templateEntities = this._extractTemplateEntities(template);
      
      // Apply enrichment rules
      for (const [ruleId, rule] of this.enrichmentRules) {
        try {
          const ruleResults = await this._applyEnrichmentRule(
            rule,
            graph,
            templateEntities,
            options
          );
          
          if (ruleResults.enrichments.length > 0) {
            enrichedContext.semanticEnrichments[ruleId] = ruleResults.enrichments;
          }
          
          if (ruleResults.properties.length > 0) {
            enrichedContext.inferredProperties[ruleId] = ruleResults.properties;
          }
          
        } catch (error) {
          this.logger.warn(`Enrichment rule ${ruleId} failed:`, error.message);
        }
      }
      
      // Add compliance annotations if enabled
      if (this.config.enableComplianceValidation) {
        enrichedContext.complianceAnnotations = await this._generateComplianceAnnotations(
          graph,
          templateEntities,
          options
        );
      }
      
      // Generate explanations for enrichments
      if (this.config.enableExplanations) {
        enrichedContext.explanations = await this._generateEnrichmentExplanations(
          enrichedContext,
          options
        );
      }
      
      const enrichmentTime = this.getDeterministicTimestamp() - startTime;
      
      this.emit('template:enriched', {
        template: template.name || 'anonymous',
        enrichmentTime,
        enrichmentsCount: Object.keys(enrichedContext.semanticEnrichments).length
      });
      
      this.logger.success(`Template context enriched in ${enrichmentTime}ms`);
      
      return enrichedContext;
      
    } catch (error) {
      this.logger.error('Template context enrichment failed:', error);
      throw error;
    }
  }

  /**
   * Load and manage rule packs
   * @param {Object} source - Rule pack source
   * @returns {Promise<Object>} Loading result
   */
  async loadRulePack(source) {
    if (!this.rulePackManager) {
      throw new Error('Rule pack management is not enabled');
    }
    
    return await this.rulePackManager.loadRulePack(source);
  }

  /**
   * Get active rules for reasoning
   * @param {Object} options - Filtering options
   * @returns {Array} Active rules
   */
  getActiveRules(options = {}) {
    if (!this.rulePackManager) {
      return [];
    }
    
    return this.rulePackManager.getActiveRules(options);
  }

  /**
   * Get reasoning explanations for a specific operation
   * @param {string} operationId - Operation ID
   * @returns {Array} Explanations
   */
  getExplanations(operationId) {
    return this.explanationTraces.get(operationId) || [];
  }

  /**
   * Get provenance information for inferences
   * @param {Array} inferences - Inferences to get provenance for
   * @returns {Object} Provenance information
   */
  getProvenance(inferences) {
    const provenance = {};
    
    for (const inference of inferences) {
      const inferenceKey = this._generateInferenceKey(inference);
      provenance[inferenceKey] = this.provenanceGraph.get(inferenceKey) || null;
    }
    
    return provenance;
  }

  /**
   * Get comprehensive status of all components
   */
  getStatus() {
    const componentStatuses = {};
    
    if (this.n3Engine) {
      componentStatuses.n3Engine = this.n3Engine.getStatus();
    }
    
    if (this.shaclValidator) {
      componentStatuses.shaclValidator = this.shaclValidator.getStatus();
    }
    
    if (this.owlReasoner) {
      componentStatuses.owlReasoner = this.owlReasoner.getStatus();
    }
    
    if (this.rulePackManager) {
      componentStatuses.rulePackManager = this.rulePackManager.getStatus();
    }
    
    if (this.incrementalEngine) {
      componentStatuses.incrementalEngine = this.incrementalEngine.getStatus();
    }
    
    if (this.inferenceCache) {
      componentStatuses.inferenceCache = this.inferenceCache.getStatus();
    }
    
    return {
      state: this.state,
      configuration: {
        reasoningMode: this.config.reasoningMode,
        enableExplanations: this.config.enableExplanations,
        enableProvenance: this.config.enableProvenance,
        enableTemplateEnrichment: this.config.enableTemplateEnrichment,
        enableComplianceValidation: this.config.enableComplianceValidation
      },
      components: componentStatuses,
      enrichment: {
        enrichmentRules: this.enrichmentRules.size,
        templateContexts: this.templateContext.size
      },
      compliance: {
        complianceRules: this.complianceRules.size,
        complianceReports: this.complianceReports.length
      },
      tracing: {
        explanationTraces: this.explanationTraces.size,
        provenanceEntries: this.provenanceGraph.size
      },
      metrics: { ...this.metrics },
      history: {
        totalOperations: this.reasoningHistory.length,
        recentOperations: this.reasoningHistory.slice(-10)
      }
    };
  }

  /**
   * Shutdown the semantic reasoning engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down semantic reasoning engine...');
      
      // Shutdown all components
      const shutdownPromises = [];
      
      if (this.n3Engine) {
        shutdownPromises.push(this.n3Engine.shutdown());
      }
      
      if (this.shaclValidator) {
        shutdownPromises.push(this.shaclValidator.shutdown());
      }
      
      if (this.owlReasoner) {
        shutdownPromises.push(this.owlReasoner.shutdown());
      }
      
      if (this.rulePackManager) {
        shutdownPromises.push(this.rulePackManager.shutdown());
      }
      
      if (this.incrementalEngine) {
        shutdownPromises.push(this.incrementalEngine.shutdown());
      }
      
      if (this.inferenceCache) {
        shutdownPromises.push(this.inferenceCache.shutdown());
      }
      
      await Promise.all(shutdownPromises);
      
      // Clear all state
      this.reasoningHistory = [];
      this.explanationTraces.clear();
      this.provenanceGraph.clear();
      this.templateContext.clear();
      this.enrichmentRules.clear();
      this.complianceRules.clear();
      this.complianceReports = [];
      
      this.state = 'shutdown';
      this.logger.success('Semantic reasoning engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during semantic reasoning engine shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Setup event handlers for components
   */
  _setupComponentEventHandlers(component, componentName) {
    component.on('*', (eventName, data) => {
      this.emit(`${componentName}:${eventName}`, data);
    });
    
    // Forward specific events
    const importantEvents = ['error', 'warning', 'complete'];
    for (const event of importantEvents) {
      component.on(event, (data) => {
        this.emit(`${componentName}:${event}`, { component: componentName, ...data });
      });
    }
  }

  /**
   * Load built-in enrichment rules
   */
  async _loadEnrichmentRules() {
    // Built-in template enrichment rules
    const builtinRules = [
      {
        id: 'entity-label-enrichment',
        name: 'Entity Label Enrichment',
        description: 'Add human-readable labels for entities in templates',
        pattern: /\{\{\s*([^}]+)\s*\}\}/g,
        enrichmentFunction: async (entity, graph) => {
          // Find labels for the entity
          return {
            labels: await this._findEntityLabels(entity, graph),
            descriptions: await this._findEntityDescriptions(entity, graph)
          };
        }
      },
      {
        id: 'type-inference-enrichment',
        name: 'Type Inference Enrichment',
        description: 'Infer and add type information for template variables',
        pattern: /\{\{\s*([^}]+)\s*\}\}/g,
        enrichmentFunction: async (entity, graph) => {
          return {
            types: await this._inferEntityTypes(entity, graph),
            constraints: await this._inferEntityConstraints(entity, graph)
          };
        }
      },
      {
        id: 'relationship-enrichment',
        name: 'Relationship Enrichment',
        description: 'Add relationship context for template entities',
        pattern: /\{\{\s*([^}]+)\s*\}\}/g,
        enrichmentFunction: async (entity, graph) => {
          return {
            relationships: await this._findEntityRelationships(entity, graph),
            relatedEntities: await this._findRelatedEntities(entity, graph)
          };
        }
      }
    ];
    
    for (const rule of builtinRules) {
      this.enrichmentRules.set(rule.id, rule);
    }
    
    this.logger.debug(`Loaded ${builtinRules.length} built-in enrichment rules`);
  }

  /**
   * Load compliance rules
   */
  async _loadComplianceRules() {
    // Built-in compliance rules
    const complianceRules = [
      {
        id: 'gdpr-compliance',
        name: 'GDPR Compliance',
        description: 'Check for GDPR compliance requirements',
        checkFunction: async (graph, entities) => {
          return await this._checkGDPRCompliance(graph, entities);
        }
      },
      {
        id: 'data-classification',
        name: 'Data Classification',
        description: 'Classify data sensitivity levels',
        checkFunction: async (graph, entities) => {
          return await this._classifyDataSensitivity(graph, entities);
        }
      }
    ];
    
    for (const rule of complianceRules) {
      this.complianceRules.set(rule.id, rule);
    }
    
    this.logger.debug(`Loaded ${complianceRules.length} compliance rules`);
  }

  /**
   * Perform validation phase
   */
  async _performValidationPhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing validation phase');
      
      // Get constraints from rule packs if available
      let constraints = context.options.constraints || [];
      
      if (this.rulePackManager) {
        const validationRules = this.rulePackManager.getActiveRules({ category: 'validation' });
        constraints = [...constraints, ...validationRules];
      }
      
      // Perform SHACL validation
      context.results.validationResults = await this.shaclValidator.validateGraph(
        context.graph,
        context.options
      );
      
      context.metrics.validationTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.totalValidations++;
      
      this.logger.debug(`Validation phase completed: ${context.results.validationResults.violations.length} violations`);
      
    } catch (error) {
      this.logger.error('Validation phase failed:', error);
      throw error;
    }
  }

  /**
   * Perform N3 reasoning phase
   */
  async _performN3ReasoningPhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing N3 reasoning phase');
      
      // Get N3 rules from rule pack manager if available
      let rules = context.options.rules || [];
      
      if (this.rulePackManager) {
        const n3Rules = this.rulePackManager.getActiveRules({ category: 'n3' });
        rules = [...rules, ...n3Rules];
      }
      
      // Perform N3 reasoning
      context.results.n3Inferences = await this.n3Engine.performReasoning(
        context.graph,
        rules,
        context.options
      );
      
      context.metrics.n3ReasoningTime = this.getDeterministicTimestamp() - startTime;
      context.metrics.totalInferences += context.results.n3Inferences.inferences?.length || 0;
      
      this.logger.debug(`N3 reasoning phase completed: ${context.results.n3Inferences.inferences?.length || 0} inferences`);
      
    } catch (error) {
      this.logger.error('N3 reasoning phase failed:', error);
      throw error;
    }
  }

  /**
   * Perform OWL reasoning phase
   */
  async _performOWLReasoningPhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing OWL reasoning phase');
      
      // Load ontology into OWL reasoner
      await this.owlReasoner.loadOntology(context.graph);
      
      // Perform OWL reasoning
      context.results.owlInferences = await this.owlReasoner.performReasoning(context.options);
      
      context.metrics.owlReasoningTime = this.getDeterministicTimestamp() - startTime;
      context.metrics.totalInferences += context.results.owlInferences.totalInferences || 0;
      
      this.logger.debug(`OWL reasoning phase completed: ${context.results.owlInferences.totalInferences || 0} inferences`);
      
    } catch (error) {
      this.logger.error('OWL reasoning phase failed:', error);
      throw error;
    }
  }

  /**
   * Perform incremental reasoning phase
   */
  async _performIncrementalReasoningPhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing incremental reasoning phase');
      
      // Determine changes from options
      const changes = context.options.changes || [];
      
      // Get rules for incremental processing
      const rules = this._combineRulesFromComponents();
      
      // Perform incremental reasoning
      context.results.incrementalResults = await this.incrementalEngine.processChanges(
        changes,
        rules,
        context.options
      );
      
      context.metrics.incrementalTime = this.getDeterministicTimestamp() - startTime;
      context.metrics.totalInferences += context.results.incrementalResults.results?.inferences?.length || 0;
      
      this.logger.debug(`Incremental reasoning phase completed`);
      
    } catch (error) {
      this.logger.error('Incremental reasoning phase failed:', error);
      throw error;
    }
  }

  /**
   * Perform template enrichment phase
   */
  async _performEnrichmentPhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing template enrichment phase');
      
      if (context.options.template) {
        context.results.enrichedContext = await this.enrichTemplateContext(
          context.graph,
          context.options.template,
          context.options
        );
      }
      
      context.metrics.enrichmentTime = this.getDeterministicTimestamp() - startTime;
      
      this.logger.debug('Template enrichment phase completed');
      
    } catch (error) {
      this.logger.error('Template enrichment phase failed:', error);
      throw error;
    }
  }

  /**
   * Perform compliance validation phase
   */
  async _performCompliancePhase(context) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Performing compliance validation phase');
      
      const complianceResults = [];
      
      // Apply compliance rules
      for (const [ruleId, rule] of this.complianceRules) {
        try {
          const result = await rule.checkFunction(context.graph, context.options.entities || []);
          complianceResults.push({
            ruleId,
            ruleName: rule.name,
            result
          });
        } catch (error) {
          this.logger.warn(`Compliance rule ${ruleId} failed:`, error.message);
        }
      }
      
      context.results.complianceResults = complianceResults;
      context.metrics.complianceTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.complianceChecks++;
      
      this.logger.debug(`Compliance validation phase completed: ${complianceResults.length} rules checked`);
      
    } catch (error) {
      this.logger.error('Compliance validation phase failed:', error);
      throw error;
    }
  }

  /**
   * Generate explanations phase
   */
  async _generateExplanationsPhase(context) {
    try {
      this.logger.debug('Generating explanations');
      
      const explanations = [];
      
      // Generate explanations for each reasoning component
      if (context.results.n3Inferences && this.n3Engine) {
        const n3Explanations = await this._generateN3Explanations(context.results.n3Inferences);
        explanations.push(...n3Explanations);
      }
      
      if (context.results.owlInferences && this.owlReasoner) {
        const owlExplanations = await this._generateOWLExplanations(context.results.owlInferences);
        explanations.push(...owlExplanations);
      }
      
      context.results.explanations = explanations;
      this.explanationTraces.set(context.operationId, explanations);
      this.metrics.explanationsGenerated += explanations.length;
      
      this.logger.debug(`Generated ${explanations.length} explanations`);
      
    } catch (error) {
      this.logger.error('Explanation generation failed:', error);
    }
  }

  /**
   * Generate provenance phase
   */
  async _generateProvenancePhase(context) {
    try {
      this.logger.debug('Generating provenance information');
      
      const provenance = [];
      
      // Collect provenance from all inference sources
      const allInferences = this._collectAllInferences(context.results);
      
      for (const inference of allInferences) {
        const provenanceEntry = {
          inference: inference,
          derivedFrom: inference.derivedFrom || 'unknown',
          timestamp: inference.timestamp || this.getDeterministicDate().toISOString(),
          confidence: inference.confidence || 1.0,
          operationId: context.operationId
        };
        
        provenance.push(provenanceEntry);
        
        const inferenceKey = this._generateInferenceKey(inference);
        this.provenanceGraph.set(inferenceKey, provenanceEntry);
      }
      
      context.results.provenance = provenance;
      
      this.logger.debug(`Generated provenance for ${provenance.length} inferences`);
      
    } catch (error) {
      this.logger.error('Provenance generation failed:', error);
    }
  }

  /**
   * Build final results
   */
  async _buildFinalResults(context) {
    const allInferences = this._collectAllInferences(context.results);
    
    return {
      operationId: context.operationId,
      reasoningMode: context.mode,
      totalInferences: allInferences.length,
      processingTime: this.getDeterministicTimestamp() - context.startTime,
      
      // Component results
      validation: context.results.validationResults,
      n3Reasoning: context.results.n3Inferences,
      owlReasoning: context.results.owlInferences,
      incrementalReasoning: context.results.incrementalResults,
      compliance: context.results.complianceResults,
      templateEnrichment: context.results.enrichedContext,
      
      // Consolidated outputs
      allInferences,
      explanations: context.results.explanations || [],
      provenance: context.results.provenance || [],
      
      // Metrics
      componentMetrics: context.metrics,
      
      // Metadata
      timestamp: this.getDeterministicDate().toISOString(),
      fromCache: false
    };
  }

  // Utility methods

  /**
   * Check if should proceed to reasoning after validation
   */
  _shouldProceedToReasoning(context) {
    // If validation failed with critical errors, might want to skip reasoning
    if (context.results.validationResults) {
      const criticalViolations = context.results.validationResults.violations?.filter(
        v => v.severity === 'critical'
      ) || [];
      
      if (criticalViolations.length > 0 && context.options.stopOnCriticalValidationFailure) {
        this.logger.warn(`Skipping reasoning due to ${criticalViolations.length} critical validation failures`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate cache key for reasoning operation
   */
  _generateCacheKey(graph, options) {
    const graphHash = crypto.createHash('md5').update(JSON.stringify(graph)).digest('hex');
    const optionsHash = crypto.createHash('md5').update(JSON.stringify(options)).digest('hex');
    return `reasoning:${graphHash}:${optionsHash}`;
  }

  /**
   * Generate inference key
   */
  _generateInferenceKey(inference) {
    return `${inference.subject}:${inference.predicate}:${inference.object}`;
  }

  /**
   * Collect all inferences from reasoning results
   */
  _collectAllInferences(results) {
    const allInferences = [];
    
    if (results.n3Inferences?.inferences) {
      allInferences.push(...results.n3Inferences.inferences);
    }
    
    if (results.owlInferences?.inferences) {
      allInferences.push(...results.owlInferences.inferences);
    }
    
    if (results.incrementalResults?.results?.inferences) {
      allInferences.push(...results.incrementalResults.results.inferences);
    }
    
    return allInferences;
  }

  /**
   * Update metrics
   */
  _updateMetrics(context) {
    this.metrics.totalReasoningOperations++;
    this.metrics.totalInferences += context.metrics.totalInferences;
    
    // Update average reasoning time
    const currentTime = this.getDeterministicTimestamp() - context.startTime;
    this.metrics.averageReasoningTime = (this.metrics.averageReasoningTime + currentTime) / 2;
  }

  /**
   * Record reasoning operation in history
   */
  _recordReasoningHistory(context, results) {
    const historyEntry = {
      operationId: context.operationId,
      timestamp: this.getDeterministicDate().toISOString(),
      reasoningMode: context.mode,
      processingTime: this.getDeterministicTimestamp() - context.startTime,
      totalInferences: results.totalInferences,
      componentsUsed: this._getUsedComponents(context),
      success: true
    };
    
    this.reasoningHistory.push(historyEntry);
    
    // Keep only recent history (last 100 operations)
    if (this.reasoningHistory.length > 100) {
      this.reasoningHistory = this.reasoningHistory.slice(-100);
    }
  }

  /**
   * Get list of components used in reasoning
   */
  _getUsedComponents(context) {
    const components = [];
    
    if (context.results.validationResults) components.push('shacl');
    if (context.results.n3Inferences) components.push('n3');
    if (context.results.owlInferences) components.push('owl');
    if (context.results.incrementalResults) components.push('incremental');
    if (context.results.complianceResults) components.push('compliance');
    if (context.results.enrichedContext) components.push('enrichment');
    
    return components;
  }

  // Stub methods for remaining functionality

  _combineRulesFromComponents() { return []; }
  _extractDependencies(graph) { return []; }
  _extractTemplateEntities(template) { return []; }
  async _applyEnrichmentRule(rule, graph, entities, options) { return { enrichments: [], properties: [] }; }
  async _generateComplianceAnnotations(graph, entities, options) { return {}; }
  async _generateEnrichmentExplanations(context, options) { return []; }
  async _findEntityLabels(entity, graph) { return []; }
  async _findEntityDescriptions(entity, graph) { return []; }
  async _inferEntityTypes(entity, graph) { return []; }
  async _inferEntityConstraints(entity, graph) { return []; }
  async _findEntityRelationships(entity, graph) { return []; }
  async _findRelatedEntities(entity, graph) { return []; }
  async _checkGDPRCompliance(graph, entities) { return { compliant: true, issues: [] }; }
  async _classifyDataSensitivity(graph, entities) { return { classifications: [] }; }
  async _generateN3Explanations(inferences) { return []; }
  async _generateOWLExplanations(inferences) { return []; }
}

export default SemanticReasoningEngine;