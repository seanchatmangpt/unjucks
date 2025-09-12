/**
 * KGEN SPARQL Integration Module
 * 
 * Main integration module that combines the SPARQL query engine, 
 * template context extraction, result formatting, and CLI commands
 * into a cohesive system for RDF-based template rendering.
 * 
 * Agent #8: SPARQL Query Engine - KGEN Hive Mind Integration
 */

import { EventEmitter } from 'events';
import KgenSparqlEngine from './sparql-engine.js';
import KgenQueryTemplates from './query-templates.js';
import KgenResultFormatter from './result-formatter.js';
import KgenContextHooks from './context-hooks.js';
import sparqlCommands from './cli-commands/sparql.js';

export class KgenSparqlIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core engine configuration
      sparql: {
        enableSPARQL: true,
        enableSemanticSearch: true,
        enableOptimization: true,
        enableContextExtraction: true,
        queryTimeout: 30000,
        maxResultSize: 10000,
        enableQueryCache: true,
        cacheTTL: 600000,
        ...config.sparql
      },
      
      // Template integration
      templates: {
        enableCustomTemplates: true,
        templateValidation: true,
        maxTemplateSize: 100000,
        ...config.templates
      },
      
      // Context extraction
      context: {
        enableHooks: true,
        contextCacheTTL: 300000,
        maxContextSize: 50000,
        extractionDepth: 3,
        ...config.context
      },
      
      // Result formatting
      formatting: {
        defaultFormat: 'json',
        enableStreaming: true,
        enableTemplateContext: true,
        formatValidation: true,
        ...config.formatting
      },
      
      // CLI integration
      cli: {
        enableCommands: true,
        verboseByDefault: false,
        outputBuffering: true,
        ...config.cli
      },
      
      ...config
    };
    
    // Initialize components
    this.engine = null;
    this.templates = null;
    this.formatter = null;
    this.hooks = null;
    
    this.state = 'initialized';
    this.integrationMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      componentsInitialized: 0
    };
  }

  /**
   * Initialize the complete SPARQL integration system
   */
  async initialize(options = {}) {
    try {
      console.log('🚀 [SPARQL Integration] Initializing KGEN SPARQL system...');
      const startTime = this.getDeterministicTimestamp();
      
      this.state = 'initializing';
      this.emit('integration:initializing');
      
      // Initialize core components in dependency order
      await this._initializeComponents(options);
      
      // Setup inter-component communication
      this._setupComponentIntegration();
      
      // Register CLI commands if enabled
      if (this.config.cli.enableCommands) {
        this._registerCliCommands();
      }
      
      // Setup event handlers
      this._setupEventHandlers();
      
      const initTime = this.getDeterministicTimestamp() - startTime;
      this.state = 'ready';
      
      console.log(`✅ [SPARQL Integration] System initialized in ${initTime}ms`);
      console.log(`   • SPARQL Engine: ${this.engine ? 'Ready' : 'Not initialized'}`);
      console.log(`   • Query Templates: ${this.templates ? this.templates.getAllTemplates().length + ' templates' : 'Not initialized'}`);
      console.log(`   • Result Formatter: ${this.formatter ? 'Ready' : 'Not initialized'}`);
      console.log(`   • Context Hooks: ${this.hooks ? 'Ready' : 'Not initialized'}`);
      
      this.emit('integration:ready', { initTime, components: this.integrationMetrics.componentsInitialized });
      
      return {
        status: 'success',
        initializationTime: initTime,
        components: {
          engine: !!this.engine,
          templates: !!this.templates,
          formatter: !!this.formatter,
          hooks: !!this.hooks
        }
      };
      
    } catch (error) {
      this.state = 'error';
      console.error('❌ [SPARQL Integration] Initialization failed:', error);
      this.emit('integration:error', { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Execute a complete SPARQL workflow with context extraction
   */
  async executeWorkflow(workflowType, parameters = {}, options = {}) {
    const workflowId = this._generateWorkflowId();
    const startTime = this.getDeterministicTimestamp();
    
    try {
      console.log(`🔄 [SPARQL Integration] Executing workflow: ${workflowType} (${workflowId})`);
      
      this.integrationMetrics.totalOperations++;
      this.emit('workflow:started', { workflowId, workflowType, parameters });
      
      let result;
      
      switch (workflowType) {
        case 'template-rendering':
          result = await this._executeTemplateRenderingWorkflow(parameters, options);
          break;
        case 'context-extraction':
          result = await this._executeContextExtractionWorkflow(parameters, options);
          break;
        case 'impact-analysis':
          result = await this._executeImpactAnalysisWorkflow(parameters, options);
          break;
        case 'provenance-tracing':
          result = await this._executeProvenanceTracingWorkflow(parameters, options);
          break;
        case 'validation':
          result = await this._executeValidationWorkflow(parameters, options);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      const executionTime = this.getDeterministicTimestamp() - startTime;
      this.integrationMetrics.successfulOperations++;
      this._updateOperationMetrics(executionTime, true);
      
      this.emit('workflow:completed', { 
        workflowId, 
        workflowType, 
        executionTime, 
        resultSize: JSON.stringify(result).length 
      });
      
      console.log(`✅ [SPARQL Integration] Workflow ${workflowId} completed in ${executionTime}ms`);
      
      return {
        workflowId,
        workflowType,
        executionTime,
        result,
        metadata: {
          completedAt: this.getDeterministicDate().toISOString(),
          componentsUsed: this._getComponentsUsed(workflowType)
        }
      };
      
    } catch (error) {
      const executionTime = this.getDeterministicTimestamp() - startTime;
      this.integrationMetrics.failedOperations++;
      this._updateOperationMetrics(executionTime, false);
      
      console.error(`❌ [SPARQL Integration] Workflow ${workflowId} failed:`, error);
      this.emit('workflow:failed', { workflowId, workflowType, error, executionTime });
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getIntegrationStatus() {
    const status = {
      integration: {
        state: this.state,
        metrics: this.integrationMetrics,
        uptime: process.uptime()
      },
      components: {}
    };
    
    if (this.engine) {
      status.components.sparqlEngine = this.engine.getStatus();
    }
    
    if (this.templates) {
      status.components.templates = {
        totalTemplates: this.templates.getAllTemplates().length,
        categories: this.templates.getCategories(),
        customTemplates: this.templates.getAllTemplates().filter(t => t.custom).length
      };
    }
    
    if (this.formatter) {
      status.components.formatter = {
        supportedFormats: ['json', 'xml', 'csv', 'turtle', 'yaml', 'table'],
        enableTemplateContext: this.config.formatting.enableTemplateContext
      };
    }
    
    if (this.hooks) {
      status.components.hooks = this.hooks.getStatus();
    }
    
    return status;
  }

  /**
   * Register custom query template
   */
  registerTemplate(template) {
    if (!this.templates) {
      throw new Error('Template system not initialized');
    }
    
    // Validate template
    this._validateTemplate(template);
    
    // Mark as custom
    template.custom = true;
    
    // Register with templates system
    this.templates.addTemplate(template);
    
    console.log(`📝 [SPARQL Integration] Registered custom template: ${template.name}`);
    this.emit('template:registered', { templateName: template.name });
  }

  /**
   * Execute SPARQL query with full integration features
   */
  async query(sparql, options = {}) {
    if (!this.engine) {
      throw new Error('SPARQL engine not initialized');
    }
    
    const startTime = this.getDeterministicTimestamp();
    
    try {
      // Execute query
      const results = await this.engine.executeQuery(sparql, {
        extractContext: options.extractContext !== false,
        ...options
      });
      
      // Format results if formatter available
      if (this.formatter && options.format) {
        const formatted = await this.formatter.formatResults(results, options.format, options.formatOptions);
        results.formatted = formatted;
      }
      
      const executionTime = this.getDeterministicTimestamp() - startTime;
      
      this.emit('query:executed', { 
        executionTime, 
        resultCount: results.results?.bindings?.length || 0,
        hasContext: !!results.templateContext
      });
      
      return results;
      
    } catch (error) {
      this.emit('query:error', { error, query: sparql });
      throw error;
    }
  }

  /**
   * Execute template with context extraction
   */
  async executeTemplate(templateName, parameters = {}, options = {}) {
    if (!this.engine || !this.templates) {
      throw new Error('Template system not initialized');
    }
    
    const template = this.templates.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    return await this.engine.executeTemplate(templateName, parameters, {
      extractContext: options.extractContext !== false,
      ...options
    });
  }

  /**
   * Shutdown the integration system
   */
  async shutdown() {
    try {
      console.log('🛑 [SPARQL Integration] Shutting down system...');
      
      this.state = 'shutting_down';
      this.emit('integration:shutting_down');
      
      // Shutdown components in reverse order
      if (this.hooks) {
        // Context hooks don't have explicit shutdown, just clear caches
        console.log('   • Context hooks: Cleared');
      }
      
      if (this.formatter) {
        // Result formatter doesn't need explicit shutdown
        console.log('   • Result formatter: Cleared');
      }
      
      if (this.templates) {
        // Query templates don't need explicit shutdown
        console.log('   • Query templates: Cleared');
      }
      
      if (this.engine) {
        await this.engine.shutdown();
        console.log('   • SPARQL engine: Shutdown');
      }
      
      this.state = 'shutdown';
      this.emit('integration:shutdown');
      
      console.log('✅ [SPARQL Integration] System shutdown completed');
      
    } catch (error) {
      console.error('❌ [SPARQL Integration] Shutdown failed:', error);
      this.emit('integration:error', { error, phase: 'shutdown' });
      throw error;
    }
  }

  // Private methods

  async _initializeComponents(options) {
    console.log('   🔧 Initializing SPARQL Engine...');
    this.engine = new KgenSparqlEngine(this.config.sparql);
    await this.engine.initialize(options.sparql);
    this.integrationMetrics.componentsInitialized++;
    
    console.log('   📝 Initializing Query Templates...');
    this.templates = new KgenQueryTemplates();
    this.integrationMetrics.componentsInitialized++;
    
    console.log('   🎨 Initializing Result Formatter...');
    this.formatter = new KgenResultFormatter(this.config.formatting);
    this.integrationMetrics.componentsInitialized++;
    
    if (this.config.context.enableHooks) {
      console.log('   🔗 Initializing Context Hooks...');
      this.hooks = new KgenContextHooks({
        ...this.config.context,
        sparql: this.config.sparql,
        formatting: this.config.formatting
      });
      await this.hooks.initialize(options.context);
      this.integrationMetrics.componentsInitialized++;
    }
  }

  _setupComponentIntegration() {
    console.log('   🔌 Setting up component integration...');
    
    // Connect formatter to engine for template context
    if (this.formatter && this.engine) {
      this.engine.formatter = this.formatter;
    }
    
    // Connect hooks to engine and templates
    if (this.hooks) {
      this.hooks.sparqlEngine = this.engine;
      this.hooks.queryTemplates = this.templates;
    }
  }

  _registerCliCommands() {
    console.log('   💻 Registering CLI commands...');
    
    // CLI commands are available via import
    // In a full CLI implementation, these would be registered with a CLI framework
  }

  _setupEventHandlers() {
    // Forward engine events
    if (this.engine) {
      this.engine.on('query:completed', (event) => this.emit('sparql:query_completed', event));
      this.engine.on('query:failed', (event) => this.emit('sparql:query_failed', event));
    }
    
    // Forward hooks events
    if (this.hooks) {
      this.hooks.on('extraction:completed', (event) => this.emit('context:extraction_completed', event));
      this.hooks.on('extraction:failed', (event) => this.emit('context:extraction_failed', event));
    }
  }

  async _executeTemplateRenderingWorkflow(parameters, options) {
    console.log('   🎯 Executing template rendering workflow...');
    
    const templateInfo = parameters.templateInfo;
    if (!templateInfo) {
      throw new Error('Template info required for template rendering workflow');
    }
    
    // Extract context
    const context = await this.hooks.extractTemplateContext(templateInfo, options);
    
    // Apply pre-template hooks
    const processedContext = await this.hooks.preTemplateHook(templateInfo, context, options);
    
    return {
      templateInfo,
      context: processedContext,
      renderingHints: context.renderingHints,
      variables: context.variables
    };
  }

  async _executeContextExtractionWorkflow(parameters, options) {
    console.log('   🎨 Executing context extraction workflow...');
    
    const results = await this.hooks.extractTemplateContext(parameters.templateInfo, {
      extractionDepth: parameters.depth || 3,
      maxContextEntities: parameters.maxEntities || 100,
      ...options
    });
    
    return results;
  }

  async _executeImpactAnalysisWorkflow(parameters, options) {
    console.log('   🔍 Executing impact analysis workflow...');
    
    const changes = parameters.changes || [];
    const context = parameters.context || {};
    
    return await this.hooks.impactAnalysisHook(changes, context, options);
  }

  async _executeProvenanceTracingWorkflow(parameters, options) {
    console.log('   🔗 Executing provenance tracing workflow...');
    
    const operation = parameters.operation;
    const context = parameters.context || {};
    
    return await this.hooks.provenanceHook(operation, context, options);
  }

  async _executeValidationWorkflow(parameters, options) {
    console.log('   ✅ Executing validation workflow...');
    
    const context = parameters.context;
    const validationRules = parameters.validationRules || [];
    
    return await this.hooks.validateContextHook(context, validationRules, options);
  }

  _validateTemplate(template) {
    const required = ['name', 'description', 'category', 'sparql', 'parameters'];
    
    for (const field of required) {
      if (!template[field]) {
        throw new Error(`Template missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(template.parameters)) {
      throw new Error('Template parameters must be an array');
    }
    
    if (typeof template.sparql !== 'string') {
      throw new Error('Template SPARQL query must be a string');
    }
    
    if (this.config.templates.templateValidation) {
      // Additional validation could go here
      const size = JSON.stringify(template).length;
      if (size > this.config.templates.maxTemplateSize) {
        throw new Error(`Template size ${size} exceeds maximum ${this.config.templates.maxTemplateSize}`);
      }
    }
  }

  _generateWorkflowId() {
    return `sparql_workflow_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _updateOperationMetrics(executionTime, success) {
    const currentAvg = this.integrationMetrics.averageOperationTime;
    const totalOps = this.integrationMetrics.totalOperations;
    
    this.integrationMetrics.averageOperationTime = 
      (currentAvg * (totalOps - 1) + executionTime) / totalOps;
  }

  _getComponentsUsed(workflowType) {
    const componentMap = {
      'template-rendering': ['engine', 'templates', 'formatter', 'hooks'],
      'context-extraction': ['engine', 'hooks', 'formatter'],
      'impact-analysis': ['engine', 'hooks'],
      'provenance-tracing': ['engine', 'hooks'],
      'validation': ['engine', 'hooks']
    };
    
    return componentMap[workflowType] || ['engine'];
  }
}

// Export everything for easy access
export {
  KgenSparqlEngine,
  KgenQueryTemplates,
  KgenResultFormatter,
  KgenContextHooks,
  sparqlCommands
};

export default KgenSparqlIntegration;