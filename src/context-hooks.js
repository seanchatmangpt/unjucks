/**
 * KGEN Template Context Integration Hooks
 * 
 * Integration hooks that connect the SPARQL query engine with the template rendering system,
 * providing seamless context extraction and injection for template generation.
 */

import { EventEmitter } from 'events';
import KgenSparqlEngine from './sparql-engine.js';
import KgenQueryTemplates from './query-templates.js';
import KgenResultFormatter from './result-formatter.js';

export class KgenContextHooks extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableContextExtraction: true,
      enableProvenanceTracking: true,
      enableValidation: true,
      contextCacheTTL: 300000, // 5 minutes
      maxContextSize: 50000,
      enableMetrics: true,
      ...config
    };
    
    // Initialize SPARQL components
    this.sparqlEngine = new KgenSparqlEngine(this.config.sparql);
    this.queryTemplates = new KgenQueryTemplates();
    this.resultFormatter = new KgenResultFormatter(this.config.formatting);
    
    // Context management
    this.contextCache = new Map();
    this.activeExtractions = new Map();
    this.extractionHistory = [];
    
    // Performance metrics
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageExtractionTime: 0,
      totalContextSize: 0
    };
    
    this._setupEventHandlers();
  }

  /**
   * Initialize the context hooks system
   */
  async initialize(options = {}) {
    try {
      console.log('[Context Hooks] Initializing context integration system...');
      
      // Initialize SPARQL engine
      await this.sparqlEngine.initialize(options.sparql);
      
      // Setup context extraction pipelines
      this.setupExtractionPipelines();
      
      // Setup template integration
      this.setupTemplateIntegration();
      
      this.state = 'ready';
      console.log('[Context Hooks] Context hooks initialized successfully');
      
      return { status: 'success', message: 'Context hooks ready' };
      
    } catch (error) {
      console.error('[Context Hooks] Initialization failed:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Extract context for template rendering
   */
  async extractTemplateContext(templateInfo, options = {}) {
    const extractionId = this._generateExtractionId();
    const startTime = Date.now();
    
    try {
      console.log(`[Context Hooks] Extracting context for template: ${templateInfo.name || templateInfo.id}`);
      
      this.metrics.totalExtractions++;
      const extraction = {
        id: extractionId,
        templateInfo,
        startTime,
        options
      };
      
      this.activeExtractions.set(extractionId, extraction);
      this.emit('extraction:started', { extractionId, templateInfo });
      
      // Check cache first
      const cacheKey = this._generateCacheKey(templateInfo, options);
      if (this.config.enableContextExtraction && !options.skipCache) {
        const cached = this.contextCache.get(cacheKey);
        if (cached && this._isCacheValid(cached)) {
          this.metrics.cacheHits++;
          this.emit('extraction:cache_hit', { extractionId, cacheKey });
          return cached.context;
        }
        this.metrics.cacheMisses++;
      }
      
      // Extract context based on template type
      const context = await this._performContextExtraction(templateInfo, options);
      
      // Add extraction metadata
      const executionTime = Date.now() - startTime;
      context.metadata = {
        ...context.metadata,
        extractionId,
        extractionTime: executionTime,
        templateInfo,
        extractedAt: new Date().toISOString()
      };
      
      // Cache the context
      if (this.config.enableContextExtraction) {
        this._cacheContext(cacheKey, context, executionTime);
      }
      
      // Update metrics
      this._updateExtractionMetrics(extraction, executionTime, true);
      this.activeExtractions.delete(extractionId);
      this.metrics.successfulExtractions++;
      
      this.emit('extraction:completed', { 
        extractionId, 
        executionTime, 
        contextSize: JSON.stringify(context).length 
      });
      
      return context;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._updateExtractionMetrics({ extractionId, templateInfo }, executionTime, false);
      this.activeExtractions.delete(extractionId);
      
      console.error(`[Context Hooks] Context extraction ${extractionId} failed:`, error);
      this.emit('extraction:failed', { extractionId, error, executionTime });
      throw error;
    }
  }

  /**
   * Hook for pre-template processing
   */
  async preTemplateHook(templateInfo, context, options = {}) {
    try {
      console.log(`[Context Hooks] Pre-template hook: ${templateInfo.name || templateInfo.id}`);
      
      const hookContext = {
        ...context,
        templateInfo,
        preprocessedAt: new Date().toISOString()
      };
      
      // Extract additional context if needed
      if (this.config.enableContextExtraction && !context.sparqlContext) {
        const sparqlContext = await this.extractTemplateContext(templateInfo, {
          ...options,
          hookType: 'pre-template'
        });
        hookContext.sparqlContext = sparqlContext;
      }
      
      // Add template-specific context
      hookContext.templateContext = await this._buildTemplateSpecificContext(templateInfo, hookContext);
      
      // Add provenance information
      if (this.config.enableProvenanceTracking) {
        hookContext.provenance = await this._buildProvenanceContext(templateInfo, hookContext, options);
      }
      
      // Validate context if enabled
      if (this.config.enableValidation) {
        await this._validateContext(hookContext, templateInfo);
      }
      
      this.emit('hook:pre_template', { templateInfo, context: hookContext });
      
      return hookContext;
      
    } catch (error) {
      console.error('[Context Hooks] Pre-template hook failed:', error);
      this.emit('hook:error', { type: 'pre-template', templateInfo, error });
      throw error;
    }
  }

  /**
   * Hook for post-template processing
   */
  async postTemplateHook(templateInfo, context, artifacts, options = {}) {
    try {
      console.log(`[Context Hooks] Post-template hook: ${templateInfo.name || templateInfo.id}`);
      
      // Analyze generated artifacts
      const artifactAnalysis = await this._analyzeGeneratedArtifacts(artifacts, context);
      
      // Update provenance with generation results
      if (this.config.enableProvenanceTracking) {
        await this._updateProvenanceWithResults(context, artifacts, artifactAnalysis);
      }
      
      // Extract insights from generation
      const insights = await this._extractGenerationInsights(templateInfo, context, artifacts);
      
      // Build post-processing context
      const postContext = {
        ...context,
        artifactAnalysis,
        insights,
        processedAt: new Date().toISOString()
      };
      
      this.emit('hook:post_template', { templateInfo, context: postContext, artifacts });
      
      return {
        context: postContext,
        artifacts,
        analysis: artifactAnalysis,
        insights
      };
      
    } catch (error) {
      console.error('[Context Hooks] Post-template hook failed:', error);
      this.emit('hook:error', { type: 'post-template', templateInfo, error });
      throw error;
    }
  }

  /**
   * Hook for context validation
   */
  async validateContextHook(context, validationRules, options = {}) {
    try {
      console.log('[Context Hooks] Validating context...');
      
      const validationResults = [];
      
      // Validate using SPARQL validation queries
      for (const rule of validationRules) {
        if (rule.type === 'sparql') {
          const result = await this.sparqlEngine.validateRules({ rules: [rule] }, options.targetEntities);
          validationResults.push({
            rule: rule.name,
            type: 'sparql',
            passed: result.passed > 0,
            details: result.results
          });
        }
      }
      
      // Validate context structure
      const structureValidation = this._validateContextStructure(context);
      validationResults.push(structureValidation);
      
      // Validate context completeness
      const completenessValidation = this._validateContextCompleteness(context, options.requirements);
      validationResults.push(completenessValidation);
      
      const overallPassed = validationResults.every(r => r.passed);
      
      this.emit('hook:validation', { 
        context, 
        validationResults, 
        passed: overallPassed 
      });
      
      return {
        passed: overallPassed,
        results: validationResults,
        summary: {
          total: validationResults.length,
          passed: validationResults.filter(r => r.passed).length,
          failed: validationResults.filter(r => !r.passed).length
        }
      };
      
    } catch (error) {
      console.error('[Context Hooks] Context validation failed:', error);
      this.emit('hook:error', { type: 'validation', error });
      throw error;
    }
  }

  /**
   * Hook for impact analysis
   */
  async impactAnalysisHook(changes, context, options = {}) {
    try {
      console.log('[Context Hooks] Performing impact analysis...');
      
      const impactResults = [];
      
      // Analyze impact of each change
      for (const change of changes) {
        if (change.entityUri) {
          const impact = await this.sparqlEngine.analyzeImpact(
            change.entityUri, 
            options.analysisDepth || 3
          );
          
          impactResults.push({
            change,
            impact: impact.results.bindings,
            affectedEntities: impact.results.bindings.length,
            severity: this._calculateImpactSeverity(impact.results.bindings)
          });
        }
      }
      
      // Calculate overall impact
      const overallImpact = this._calculateOverallImpact(impactResults);
      
      this.emit('hook:impact_analysis', { 
        changes, 
        impactResults, 
        overallImpact 
      });
      
      return {
        results: impactResults,
        overall: overallImpact,
        recommendations: this._generateImpactRecommendations(impactResults)
      };
      
    } catch (error) {
      console.error('[Context Hooks] Impact analysis failed:', error);
      this.emit('hook:error', { type: 'impact-analysis', error });
      throw error;
    }
  }

  /**
   * Hook for provenance tracking
   */
  async provenanceHook(operation, context, options = {}) {
    try {
      console.log(`[Context Hooks] Tracking provenance for operation: ${operation.type}`);
      
      // Query provenance information
      const provenance = await this.sparqlEngine.traceProvenance(
        operation.entityUri,
        options.direction || 'both',
        options.depth || 5
      );
      
      // Build provenance context
      const provenanceContext = {
        operation,
        lineage: provenance.results.bindings,
        metadata: {
          trackedAt: new Date().toISOString(),
          depth: options.depth || 5,
          direction: options.direction || 'both'
        }
      };
      
      this.emit('hook:provenance', { operation, provenance: provenanceContext });
      
      return provenanceContext;
      
    } catch (error) {
      console.error('[Context Hooks] Provenance tracking failed:', error);
      this.emit('hook:error', { type: 'provenance', operation, error });
      throw error;
    }
  }

  /**
   * Get context hooks status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      activeExtractions: this.activeExtractions.size,
      cachedContexts: this.contextCache.size,
      metrics: this.metrics,
      components: {
        sparqlEngine: this.sparqlEngine.getStatus(),
        queryTemplates: {
          totalTemplates: this.queryTemplates.getAllTemplates().length,
          categories: this.queryTemplates.getCategories()
        }
      }
    };
  }

  // Private methods

  async _performContextExtraction(templateInfo, options) {
    const context = {
      templateInfo,
      entities: [],
      relationships: [],
      patterns: [],
      variables: new Map(),
      metadata: {}
    };
    
    // Determine extraction strategy based on template type
    switch (templateInfo.type) {
      case 'api':
        return await this._extractApiContext(templateInfo, options);
      case 'model':
        return await this._extractModelContext(templateInfo, options);
      case 'controller':
        return await this._extractControllerContext(templateInfo, options);
      case 'schema':
        return await this._extractSchemaContext(templateInfo, options);
      default:
        return await this._extractGenericContext(templateInfo, options);
    }
  }

  async _extractApiContext(templateInfo, options) {
    console.log('[Context Hooks] Extracting API context...');
    
    // Extract API resource context
    const resourceType = templateInfo.resourceType || this._inferResourceType(templateInfo);
    const apiContext = await this.sparqlEngine.extractApiContext(resourceType, options);
    
    // Format for template rendering
    const formattedContext = await this.resultFormatter.formatResults(
      { results: { bindings: [] }, templateContext: apiContext },
      'template-context'
    );
    
    return {
      type: 'api',
      resourceType,
      context: apiContext,
      formatted: JSON.parse(formattedContext),
      extractedAt: new Date().toISOString()
    };
  }

  async _extractModelContext(templateInfo, options) {
    console.log('[Context Hooks] Extracting model context...');
    
    // Execute entity relationship context query
    const results = await this.sparqlEngine.executeTemplate(
      'entity-relationship-context',
      {
        domainUri: templateInfo.domainUri || 'http://kgen.enterprise/domain/default'
      }
    );
    
    // Build template context
    const templateContext = await this.resultFormatter.buildTemplateContext(results, options);
    
    return {
      type: 'model',
      entities: templateContext.entities,
      relationships: templateContext.relationships,
      properties: Object.fromEntries(templateContext.properties),
      variables: Object.fromEntries(templateContext.templateVariables),
      extractedAt: new Date().toISOString()
    };
  }

  async _extractControllerContext(templateInfo, options) {
    console.log('[Context Hooks] Extracting controller context...');
    
    // Execute REST API patterns query
    const results = await this.sparqlEngine.executeTemplate(
      'rest-api-patterns',
      {
        resourceType: templateInfo.resourceType || 'Resource',
        includeNested: 'true'
      }
    );
    
    const templateContext = await this.resultFormatter.buildTemplateContext(results, options);
    
    return {
      type: 'controller',
      endpoints: templateContext.relationships,
      operations: this._extractOperations(templateContext),
      variables: Object.fromEntries(templateContext.templateVariables),
      extractedAt: new Date().toISOString()
    };
  }

  async _extractSchemaContext(templateInfo, options) {
    console.log('[Context Hooks] Extracting schema context...');
    
    // Execute schema context query
    const results = await this.sparqlEngine.executeTemplate(
      'schema-context',
      {
        schemaUri: templateInfo.schemaUri || 'http://kgen.enterprise/schema/default',
        includeIndexes: 'true'
      }
    );
    
    const templateContext = await this.resultFormatter.buildTemplateContext(results, options);
    
    return {
      type: 'schema',
      tables: this._extractTables(templateContext),
      columns: this._extractColumns(templateContext),
      relationships: templateContext.relationships,
      variables: Object.fromEntries(templateContext.templateVariables),
      extractedAt: new Date().toISOString()
    };
  }

  async _extractGenericContext(templateInfo, options) {
    console.log('[Context Hooks] Extracting generic context...');
    
    // Execute template context builder query
    const results = await this.sparqlEngine.executeTemplate(
      'template-context-builder',
      {
        templateUri: templateInfo.uri || `http://kgen.enterprise/templates/${templateInfo.id}`,
        depth: options.extractionDepth || '2'
      }
    );
    
    const templateContext = await this.resultFormatter.buildTemplateContext(results, options);
    
    return {
      type: 'generic',
      context: templateContext,
      variables: Object.fromEntries(templateContext.templateVariables),
      extractedAt: new Date().toISOString()
    };
  }

  async _buildTemplateSpecificContext(templateInfo, context) {
    return {
      templateId: templateInfo.id,
      templateName: templateInfo.name,
      templateType: templateInfo.type,
      templateVersion: templateInfo.version || '1.0.0',
      contextHash: this._generateContextHash(context),
      buildTime: new Date().toISOString()
    };
  }

  async _buildProvenanceContext(templateInfo, context, options) {
    if (!templateInfo.uri) return null;
    
    try {
      const provenance = await this.sparqlEngine.traceProvenance(templateInfo.uri, 'both', 3);
      
      return {
        lineage: provenance.results.bindings.slice(0, 10), // Limit to first 10
        dependencies: this._extractDependencies(provenance.results.bindings),
        agents: this._extractAgents(provenance.results.bindings),
        activities: this._extractActivities(provenance.results.bindings)
      };
      
    } catch (error) {
      console.warn('[Context Hooks] Failed to build provenance context:', error);
      return null;
    }
  }

  async _validateContext(context, templateInfo) {
    // Basic context validation
    if (!context || typeof context !== 'object') {
      throw new Error('Context must be a valid object');
    }
    
    // Check required fields based on template type
    const requiredFields = this._getRequiredFields(templateInfo.type);
    for (const field of requiredFields) {
      if (!context[field]) {
        throw new Error(`Required context field missing: ${field}`);
      }
    }
    
    // Validate context size
    const contextSize = JSON.stringify(context).length;
    if (contextSize > this.config.maxContextSize) {
      throw new Error(`Context size ${contextSize} exceeds maximum ${this.config.maxContextSize}`);
    }
  }

  async _analyzeGeneratedArtifacts(artifacts, context) {
    return {
      totalArtifacts: artifacts.length,
      artifactTypes: this._groupArtifactsByType(artifacts),
      totalSize: artifacts.reduce((sum, artifact) => sum + (artifact.size || 0), 0),
      hasErrors: artifacts.some(artifact => artifact.type === 'generation_error'),
      errorCount: artifacts.filter(artifact => artifact.type === 'generation_error').length,
      successRate: artifacts.filter(artifact => artifact.type !== 'generation_error').length / artifacts.length
    };
  }

  async _updateProvenanceWithResults(context, artifacts, analysis) {
    if (!context.provenance) return;
    
    context.provenance.generationResults = {
      artifacts: artifacts.map(a => ({
        path: a.path,
        type: a.type,
        size: a.size,
        operationType: a.operationType
      })),
      analysis,
      completedAt: new Date().toISOString()
    };
  }

  async _extractGenerationInsights(templateInfo, context, artifacts) {
    return {
      templatePerformance: {
        executionTime: context.metadata?.extractionTime || 0,
        contextSize: JSON.stringify(context).length,
        artifactsGenerated: artifacts.length
      },
      patterns: this._detectArtifactPatterns(artifacts),
      recommendations: this._generateRecommendations(templateInfo, context, artifacts),
      qualityMetrics: {
        completeness: this._calculateCompleteness(artifacts, context),
        consistency: this._calculateConsistency(artifacts),
        reusability: this._calculateReusability(templateInfo, artifacts)
      }
    };
  }

  _validateContextStructure(context) {
    const requiredStructure = ['metadata'];
    const missingFields = requiredStructure.filter(field => !context[field]);
    
    return {
      rule: 'context-structure',
      type: 'structure',
      passed: missingFields.length === 0,
      details: {
        required: requiredStructure,
        missing: missingFields,
        present: Object.keys(context)
      }
    };
  }

  _validateContextCompleteness(context, requirements = {}) {
    const completenessScore = this._calculateContextCompleteness(context, requirements);
    
    return {
      rule: 'context-completeness',
      type: 'completeness',
      passed: completenessScore >= (requirements.minimumCompleteness || 0.7),
      details: {
        score: completenessScore,
        threshold: requirements.minimumCompleteness || 0.7,
        factors: this._getCompletenessFactors(context)
      }
    };
  }

  _calculateImpactSeverity(impactBindings) {
    if (impactBindings.length === 0) return 'none';
    if (impactBindings.length < 5) return 'low';
    if (impactBindings.length < 15) return 'medium';
    return 'high';
  }

  _calculateOverallImpact(impactResults) {
    const severities = impactResults.map(r => r.severity);
    const counts = {
      none: severities.filter(s => s === 'none').length,
      low: severities.filter(s => s === 'low').length,
      medium: severities.filter(s => s === 'medium').length,
      high: severities.filter(s => s === 'high').length
    };
    
    const maxSeverity = Object.entries(counts)
      .filter(([severity, count]) => count > 0)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
    
    return {
      severity: maxSeverity,
      distribution: counts,
      totalAffectedEntities: impactResults.reduce((sum, r) => sum + r.affectedEntities, 0)
    };
  }

  _generateImpactRecommendations(impactResults) {
    const recommendations = [];
    
    for (const result of impactResults) {
      if (result.severity === 'high') {
        recommendations.push({
          type: 'warning',
          message: `High impact change detected for ${result.change.entityUri}`,
          action: 'Consider gradual rollout or additional testing'
        });
      } else if (result.severity === 'medium') {
        recommendations.push({
          type: 'caution',
          message: `Medium impact change detected for ${result.change.entityUri}`,
          action: 'Review affected entities and update documentation'
        });
      }
    }
    
    return recommendations;
  }

  setupExtractionPipelines() {
    // Setup standard extraction pipelines for different template types
    console.log('[Context Hooks] Setting up extraction pipelines...');
    
    // Additional pipeline setup would go here
  }

  setupTemplateIntegration() {
    // Setup integration with template engine
    console.log('[Context Hooks] Setting up template integration...');
    
    // Integration setup would go here
  }

  _setupEventHandlers() {
    // Forward SPARQL engine events
    this.sparqlEngine.on('query:completed', (event) => this.emit('sparql:query_completed', event));
    this.sparqlEngine.on('query:failed', (event) => this.emit('sparql:query_failed', event));
    
    // Forward result formatter events
    this.resultFormatter.on('context:built', (event) => this.emit('context:built', event));
    this.resultFormatter.on('format:completed', (event) => this.emit('format:completed', event));
  }

  _generateExtractionId() {
    return `ctx_extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateCacheKey(templateInfo, options) {
    const keyData = {
      templateId: templateInfo.id,
      templateType: templateInfo.type,
      version: templateInfo.version,
      optionsHash: JSON.stringify(options)
    };
    
    return require('crypto').createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  _isCacheValid(cached) {
    return (Date.now() - cached.timestamp) < this.config.contextCacheTTL;
  }

  _cacheContext(cacheKey, context, executionTime) {
    const contextSize = JSON.stringify(context).length;
    
    this.contextCache.set(cacheKey, {
      context,
      timestamp: Date.now(),
      executionTime,
      size: contextSize
    });
    
    // Prevent memory leaks
    if (this.contextCache.size > 1000) {
      const entries = Array.from(this.contextCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 100; i++) {
        this.contextCache.delete(entries[i][0]);
      }
    }
  }

  _updateExtractionMetrics(extraction, executionTime, success) {
    const currentAvg = this.metrics.averageExtractionTime;
    const totalExtractions = this.metrics.totalExtractions;
    
    this.metrics.averageExtractionTime = 
      (currentAvg * (totalExtractions - 1) + executionTime) / totalExtractions;
    
    // Store in history
    this.extractionHistory.push({
      ...extraction,
      executionTime,
      success,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.extractionHistory.length > 1000) {
      this.extractionHistory = this.extractionHistory.slice(-500);
    }
  }

  // Helper methods for context extraction

  _inferResourceType(templateInfo) {
    if (templateInfo.name.toLowerCase().includes('user')) return 'User';
    if (templateInfo.name.toLowerCase().includes('product')) return 'Product';
    if (templateInfo.name.toLowerCase().includes('order')) return 'Order';
    return 'Resource';
  }

  _extractOperations(templateContext) {
    return templateContext.relationships
      .filter(rel => rel.predicate.includes('operation') || rel.predicate.includes('method'))
      .map(rel => ({
        name: rel.object,
        type: rel.predicate,
        endpoint: rel.subject
      }));
  }

  _extractTables(templateContext) {
    return templateContext.entities
      .filter(entity => entity.type.includes('Table'))
      .map(entity => ({
        name: entity.label || this._extractLocalName(entity.uri),
        uri: entity.uri,
        properties: entity.properties
      }));
  }

  _extractColumns(templateContext) {
    return templateContext.entities
      .filter(entity => entity.type.includes('Column'))
      .map(entity => ({
        name: entity.label || this._extractLocalName(entity.uri),
        dataType: this._extractDataType(entity.properties),
        nullable: this._extractNullable(entity.properties),
        primaryKey: this._extractPrimaryKey(entity.properties)
      }));
  }

  _extractDependencies(bindings) {
    return bindings
      .filter(binding => binding.relationship?.value?.includes('dependsOn'))
      .map(binding => binding.relatedEntity?.value)
      .filter(Boolean);
  }

  _extractAgents(bindings) {
    return bindings
      .filter(binding => binding.agent?.value)
      .map(binding => binding.agent.value)
      .filter(Boolean);
  }

  _extractActivities(bindings) {
    return bindings
      .filter(binding => binding.activity?.value)
      .map(binding => binding.activity.value)
      .filter(Boolean);
  }

  _getRequiredFields(templateType) {
    const fieldMap = {
      'api': ['resourceType'],
      'model': ['entities'],
      'controller': ['endpoints'],
      'schema': ['tables'],
      'generic': ['context']
    };
    
    return fieldMap[templateType] || ['metadata'];
  }

  _groupArtifactsByType(artifacts) {
    return artifacts.reduce((groups, artifact) => {
      const type = artifact.type || 'unknown';
      groups[type] = (groups[type] || 0) + 1;
      return groups;
    }, {});
  }

  _detectArtifactPatterns(artifacts) {
    const patterns = [];
    
    if (artifacts.some(a => a.path?.includes('controller'))) {
      patterns.push({ type: 'mvc-pattern', confidence: 0.8 });
    }
    
    if (artifacts.some(a => a.path?.includes('model')) && artifacts.some(a => a.path?.includes('migration'))) {
      patterns.push({ type: 'data-layer-pattern', confidence: 0.9 });
    }
    
    return patterns;
  }

  _generateRecommendations(templateInfo, context, artifacts) {
    const recommendations = [];
    
    if (artifacts.length > 20) {
      recommendations.push({
        type: 'optimization',
        message: 'Large number of artifacts generated',
        suggestion: 'Consider splitting template into smaller, focused templates'
      });
    }
    
    if (context.metadata?.extractionTime > 5000) {
      recommendations.push({
        type: 'performance',
        message: 'Context extraction took longer than expected',
        suggestion: 'Consider caching context or optimizing queries'
      });
    }
    
    return recommendations;
  }

  _calculateCompleteness(artifacts, context) {
    // Simple completeness calculation
    const expectedArtifacts = context.metadata?.expectedArtifacts || 1;
    return Math.min(artifacts.length / expectedArtifacts, 1.0);
  }

  _calculateConsistency(artifacts) {
    // Check for consistent naming and structure
    const paths = artifacts.map(a => a.path).filter(Boolean);
    const uniquePrefixes = new Set(paths.map(p => p.split('/')[0]));
    
    return 1.0 - (uniquePrefixes.size / paths.length);
  }

  _calculateReusability(templateInfo, artifacts) {
    // Simple reusability metric based on template generality
    const isGeneric = templateInfo.type === 'generic';
    const hasConfigurableElements = artifacts.some(a => 
      JSON.stringify(a).includes('{{') || JSON.stringify(a).includes('${')
    );
    
    return (isGeneric ? 0.5 : 0.3) + (hasConfigurableElements ? 0.4 : 0.1);
  }

  _calculateContextCompleteness(context, requirements) {
    const factors = this._getCompletenessFactors(context);
    const weights = requirements.completenessWeights || {
      hasEntities: 0.3,
      hasProperties: 0.2,
      hasRelationships: 0.2,
      hasVariables: 0.2,
      hasMetadata: 0.1
    };
    
    return Object.entries(factors).reduce((score, [factor, value]) => {
      return score + (value ? weights[factor] || 0 : 0);
    }, 0);
  }

  _getCompletenessFactors(context) {
    return {
      hasEntities: Boolean(context.entities && context.entities.length > 0),
      hasProperties: Boolean(context.properties && Object.keys(context.properties).length > 0),
      hasRelationships: Boolean(context.relationships && context.relationships.length > 0),
      hasVariables: Boolean(context.variables && Object.keys(context.variables).length > 0),
      hasMetadata: Boolean(context.metadata)
    };
  }

  _generateContextHash(context) {
    const hashData = JSON.stringify({
      entities: context.entities?.length || 0,
      properties: Object.keys(context.properties || {}).length,
      relationships: context.relationships?.length || 0,
      type: context.type
    });
    
    return require('crypto').createHash('md5').update(hashData).digest('hex');
  }

  _extractLocalName(uri) {
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const splitIndex = Math.max(lastSlash, lastHash);
    
    return splitIndex >= 0 ? uri.substring(splitIndex + 1) : uri;
  }

  _extractDataType(properties) {
    const dataTypeProp = properties.find(p => p.predicate.includes('dataType'));
    return dataTypeProp?.object || 'string';
  }

  _extractNullable(properties) {
    const nullableProp = properties.find(p => p.predicate.includes('nullable'));
    return nullableProp?.object === 'true';
  }

  _extractPrimaryKey(properties) {
    const pkProp = properties.find(p => p.predicate.includes('primaryKey'));
    return pkProp?.object === 'true';
  }
}

export default KgenContextHooks;