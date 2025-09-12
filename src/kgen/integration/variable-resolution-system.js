/**
 * KGEN Variable Resolution System
 * 
 * Advanced variable extraction, resolution, and context management system that 
 * integrates unjucks template variables with KGEN's semantic processing capabilities,
 * providing intelligent variable discovery, type inference, and dynamic resolution.
 */

import { EventEmitter } from 'events';
import { Logger } from 'consola';
import { MetadataExtractor } from '../core/frontmatter/metadata-extractor.js';
import { FrontmatterParser } from '../../lib/frontmatter-parser.js';
import { SemanticProcessor } from '../semantic/processor.js';
import { KGenErrorHandler } from '../utils/error-handler.js';
import path from 'node:path';
import fs from 'fs-extra';

export class VariableResolutionSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Variable discovery configuration
      enableDeepAnalysis: config.enableDeepAnalysis !== false,
      enableTypeInference: config.enableTypeInference !== false,
      enableSemanticAnalysis: config.enableSemanticAnalysis !== false,
      
      // Context management
      enableContextInheritance: config.enableContextInheritance !== false,
      enableGlobalVariables: config.enableGlobalVariables !== false,
      enableEnvironmentVariables: config.enableEnvironmentVariables !== false,
      
      // Resolution strategies
      resolutionStrategy: config.resolutionStrategy || 'merge', // merge, override, strict
      defaultValueStrategy: config.defaultValueStrategy || 'generate', // generate, require, ignore
      
      // Performance settings
      enableCache: config.enableCache !== false,
      cacheDirectory: config.cacheDirectory || '.kgen-cache/variables',
      maxCacheAge: config.maxCacheAge || 3600000, // 1 hour
      
      // Validation settings
      enableValidation: config.enableValidation !== false,
      requireAllVariables: config.requireAllVariables || false,
      enableConflictDetection: config.enableConflictDetection !== false,
      
      ...config
    };
    
    this.logger = new Logger({ tag: 'kgen-variable-resolution' });
    this.state = 'initialized';
    
    // Initialize error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    
    // Initialize components
    this.metadataExtractor = new MetadataExtractor({
      enableProvenance: this.config.enableProvenance
    });
    
    this.frontmatterParser = new FrontmatterParser(
      this.config.enableSemanticAnalysis
    );
    
    this.semanticProcessor = this.config.enableSemanticAnalysis
      ? new SemanticProcessor(this.config.semantic)
      : null;
    
    // Variable caches and indexes
    this.variableCache = new Map();
    this.typeInferenceCache = new Map();
    this.resolutionCache = new Map();
    this.templateVariableIndex = new Map();
    
    // Built-in variable providers
    this.globalVariables = new Map();
    this.environmentVariables = new Map();
    this.systemVariables = new Map();
    
    // Variable resolution statistics
    this.stats = {
      variablesExtracted: 0,
      templatesAnalyzed: 0,
      resolutionRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      typeInferences: 0,
      conflictsDetected: 0
    };
    
    this._initializeBuiltinVariables();
    this._setupEventHandlers();
  }

  /**
   * Initialize the variable resolution system
   */
  async initialize() {
    try {
      this.logger.info('Initializing KGEN variable resolution system...');
      
      // Initialize semantic processor if enabled
      if (this.semanticProcessor) {
        await this.semanticProcessor.initialize();
      }
      
      // Create cache directory
      if (this.config.enableCache) {
        await fs.ensureDir(path.join(process.cwd(), this.config.cacheDirectory));
      }
      
      // Load environment variables if enabled
      if (this.config.enableEnvironmentVariables) {
        this._loadEnvironmentVariables();
      }
      
      this.state = 'ready';
      this.emit('system:ready');
      
      this.logger.success('KGEN variable resolution system initialized successfully');
      return { status: 'success', version: this.getVersion() };
      
    } catch (error) {
      const operationId = 'system:initialize';
      const errorContext = {
        component: 'variable-resolution-system',
        operation: 'initialization',
        state: this.state
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.state = 'error';
      this.emit('system:error', { operationId, error, errorContext });
      
      throw error;
    }
  }

  /**
   * Extract variables from template content with deep analysis
   * @param {string} templateContent - Template content to analyze
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Comprehensive variable analysis
   */
  async extractVariables(templateContent, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.debug(`Extracting variables with operation ${operationId}`);
      this.stats.templatesAnalyzed++;
      
      // Check cache first
      const cacheKey = this._generateCacheKey('extract', templateContent);
      if (this.config.enableCache && this.variableCache.has(cacheKey)) {
        const cached = this.variableCache.get(cacheKey);
        if (!this._isCacheExpired(cached.timestamp)) {
          this.stats.cacheHits++;
          return cached.result;
        }
      }
      
      this.stats.cacheMisses++;
      
      // Parse frontmatter
      const parseResult = await this.frontmatterParser.parse(templateContent, true);
      
      // Extract base variables using metadata extractor
      const baseVariables = await this.metadataExtractor.extractVariables(
        parseResult.frontmatter,
        parseResult.content
      );
      
      // Perform deep analysis if enabled
      let deepAnalysis = null;
      if (this.config.enableDeepAnalysis) {
        deepAnalysis = await this._performDeepVariableAnalysis(
          parseResult,
          baseVariables,
          options
        );
      }
      
      // Perform type inference if enabled
      let typeInference = null;
      if (this.config.enableTypeInference) {
        typeInference = await this._performTypeInference(
          baseVariables,
          deepAnalysis,
          parseResult,
          options
        );
      }
      
      // Perform semantic analysis if enabled
      let semanticAnalysis = null;
      if (this.config.enableSemanticAnalysis && this.semanticProcessor) {
        semanticAnalysis = await this._performSemanticVariableAnalysis(
          baseVariables,
          typeInference,
          parseResult,
          options
        );
      }
      
      // Create comprehensive result
      const result = {
        operationId,
        timestamp: new Date().toISOString(),
        baseVariables,
        deepAnalysis,
        typeInference,
        semanticAnalysis,
        summary: this._createVariableSummary({
          baseVariables,
          deepAnalysis,
          typeInference,
          semanticAnalysis
        }),
        metadata: {
          hasFrontmatter: parseResult.hasValidFrontmatter,
          frontmatterKeys: parseResult.hasValidFrontmatter 
            ? Object.keys(parseResult.frontmatter) 
            : [],
          templateSize: templateContent.length,
          analysisLevel: {
            deep: !!deepAnalysis,
            typeInference: !!typeInference,
            semantic: !!semanticAnalysis
          }
        }
      };
      
      // Cache the result
      if (this.config.enableCache) {
        this.variableCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      this.stats.variablesExtracted += result.summary.totalVariables;
      
      this.emit('variables:extracted', {
        operationId,
        variableCount: result.summary.totalVariables,
        result
      });
      
      return result;
      
    } catch (error) {
      const errorContext = {
        component: 'variable-resolution-system',
        operation: 'variable_extraction',
        contentLength: templateContent.length
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('variables:extraction_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Resolve variables for template rendering with intelligent context merging
   * @param {Object} extractedVariables - Previously extracted variable analysis
   * @param {Object} providedContext - User-provided context
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolved variable context
   */
  async resolveVariables(extractedVariables, providedContext = {}, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.debug(`Resolving variables with operation ${operationId}`);
      this.stats.resolutionRequests++;
      
      // Check cache
      const cacheKey = this._generateCacheKey('resolve', extractedVariables, providedContext);
      if (this.config.enableCache && this.resolutionCache.has(cacheKey)) {
        const cached = this.resolutionCache.get(cacheKey);
        if (!this._isCacheExpired(cached.timestamp)) {
          this.stats.cacheHits++;
          return cached.result;
        }
      }
      
      this.stats.cacheMisses++;
      
      // Create resolution context
      const resolutionContext = await this._createResolutionContext(
        extractedVariables,
        providedContext,
        options
      );
      
      // Apply resolution strategy
      const resolvedVariables = await this._applyResolutionStrategy(
        resolutionContext,
        options
      );
      
      // Perform validation if enabled
      let validation = null;
      if (this.config.enableValidation) {
        validation = await this._validateResolvedVariables(
          extractedVariables,
          resolvedVariables,
          options
        );
      }
      
      // Detect conflicts if enabled
      let conflictAnalysis = null;
      if (this.config.enableConflictDetection) {
        conflictAnalysis = await this._detectVariableConflicts(
          resolutionContext,
          resolvedVariables,
          options
        );
        
        if (conflictAnalysis.hasConflicts) {
          this.stats.conflictsDetected += conflictAnalysis.conflicts.length;
        }
      }
      
      // Create comprehensive result
      const result = {
        operationId,
        timestamp: new Date().toISOString(),
        resolvedVariables,
        resolutionContext,
        validation,
        conflictAnalysis,
        metadata: {
          strategy: this.config.resolutionStrategy,
          providedVariables: Object.keys(providedContext).length,
          resolvedVariables: Object.keys(resolvedVariables).length,
          globalVariables: this.globalVariables.size,
          environmentVariables: this.environmentVariables.size
        }
      };
      
      // Cache the result
      if (this.config.enableCache) {
        this.resolutionCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      this.emit('variables:resolved', {
        operationId,
        resolvedCount: Object.keys(resolvedVariables).length,
        result
      });
      
      return result;
      
    } catch (error) {
      const errorContext = {
        component: 'variable-resolution-system',
        operation: 'variable_resolution',
        providedVariables: Object.keys(providedContext).length,
        extractedVariables: extractedVariables?.summary?.totalVariables || 0
      };
      
      await this.errorHandler.handleError(operationId, error, errorContext);
      this.emit('variables:resolution_error', { operationId, error });
      throw error;
    }
  }

  /**
   * Register global variables available to all templates
   * @param {Object} variables - Global variables to register
   * @param {Object} options - Registration options
   */
  registerGlobalVariables(variables, options = {}) {
    try {
      for (const [key, value] of Object.entries(variables)) {
        this.globalVariables.set(key, {
          value,
          type: typeof value,
          source: 'global',
          registeredAt: new Date().toISOString(),
          metadata: options.metadata || {}
        });
      }
      
      this.logger.info(`Registered ${Object.keys(variables).length} global variables`);
      this.emit('variables:global_registered', { 
        count: Object.keys(variables).length,
        variables: Object.keys(variables)
      });
      
    } catch (error) {
      this.logger.error('Failed to register global variables:', error);
      throw error;
    }
  }

  /**
   * Get variable resolution statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheStats: {
        variableCache: this.variableCache.size,
        typeInferenceCache: this.typeInferenceCache.size,
        resolutionCache: this.resolutionCache.size,
        hitRate: this.stats.resolutionRequests > 0 
          ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
          : 0
      },
      systemVariables: {
        global: this.globalVariables.size,
        environment: this.environmentVariables.size,
        system: this.systemVariables.size
      }
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.variableCache.clear();
    this.typeInferenceCache.clear();
    this.resolutionCache.clear();
    this.templateVariableIndex.clear();
    
    this.logger.info('Variable resolution caches cleared');
    this.emit('cache:cleared');
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      state: this.state,
      version: this.getVersion(),
      config: this.config,
      statistics: this.getStatistics(),
      components: {
        metadataExtractor: 'active',
        frontmatterParser: 'active',
        semanticProcessor: this.semanticProcessor?.getStatus() || 'disabled'
      },
      uptime: process.uptime()
    };
  }

  // Private methods

  _generateOperationId() {
    return `vrs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateCacheKey(operation, ...args) {
    const content = JSON.stringify({ operation, args });
    return require('crypto').createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  _isCacheExpired(timestamp) {
    return Date.now() - timestamp > this.config.maxCacheAge;
  }

  async _performDeepVariableAnalysis(parseResult, baseVariables, options) {
    const analysis = {
      conditionalVariables: [],
      loopVariables: [],
      filterVariables: [],
      macroVariables: [],
      includeVariables: [],
      complexExpressions: []
    };
    
    try {
      const content = parseResult.content;
      
      // Analyze conditional statements
      const conditionalMatches = content.match(/\{%-?\s*if\s+([^%]+)%\}/g) || [];
      for (const match of conditionalMatches) {
        const condition = match.replace(/\{%-?\s*if\s+/, '').replace(/%\}/, '').trim();
        const variables = this._extractVariablesFromExpression(condition);
        analysis.conditionalVariables.push(...variables);
      }
      
      // Analyze loop constructs
      const loopMatches = content.match(/\{%-?\s*for\s+([^%]+)%\}/g) || [];
      for (const match of loopMatches) {
        const loopExpression = match.replace(/\{%-?\s*for\s+/, '').replace(/%\}/, '').trim();
        const variables = this._extractVariablesFromExpression(loopExpression);
        analysis.loopVariables.push(...variables);
      }
      
      // Analyze filter usage
      const filterMatches = content.match(/\{\{\s*([^}]*\|[^}]+)\s*\}\}/g) || [];
      for (const match of filterMatches) {
        const expression = match.replace(/\{\{\s*/, '').replace(/\s*\}\}/, '').trim();
        const variables = this._extractVariablesFromExpression(expression);
        analysis.filterVariables.push(...variables);
      }
      
      // Analyze macro usage
      const macroMatches = content.match(/\{%-?\s*macro\s+([^%]+)%\}/g) || [];
      for (const match of macroMatches) {
        const macroExpression = match.replace(/\{%-?\s*macro\s+/, '').replace(/%\}/, '').trim();
        const variables = this._extractVariablesFromExpression(macroExpression);
        analysis.macroVariables.push(...variables);
      }
      
      // Analyze include statements
      const includeMatches = content.match(/\{%-?\s*include\s+([^%]+)%\}/g) || [];
      for (const match of includeMatches) {
        const includeExpression = match.replace(/\{%-?\s*include\s+/, '').replace(/%\}/, '').trim();
        const variables = this._extractVariablesFromExpression(includeExpression);
        analysis.includeVariables.push(...variables);
      }
      
      // Analyze complex expressions
      const complexMatches = content.match(/\{\{\s*([^}]*[\.\[\(][^}]*)\s*\}\}/g) || [];
      for (const match of complexMatches) {
        const expression = match.replace(/\{\{\s*/, '').replace(/\s*\}\}/, '').trim();
        analysis.complexExpressions.push({
          expression,
          variables: this._extractVariablesFromExpression(expression)
        });
      }
      
    } catch (error) {
      this.logger.warn('Deep variable analysis failed:', error.message);
    }
    
    return analysis;
  }

  async _performTypeInference(baseVariables, deepAnalysis, parseResult, options) {
    const inference = {
      inferredTypes: {},
      confidence: {},
      patterns: {},
      recommendations: []
    };
    
    try {
      // Combine all discovered variables
      const allVariables = new Set([
        ...baseVariables.allVariables || [],
        ...deepAnalysis?.conditionalVariables || [],
        ...deepAnalysis?.loopVariables || [],
        ...deepAnalysis?.filterVariables || []
      ]);
      
      for (const variable of allVariables) {
        const typeAnalysis = this._inferVariableType(
          variable,
          parseResult.content,
          parseResult.frontmatter,
          deepAnalysis
        );
        
        inference.inferredTypes[variable] = typeAnalysis.type;
        inference.confidence[variable] = typeAnalysis.confidence;
        inference.patterns[variable] = typeAnalysis.patterns;
        
        if (typeAnalysis.recommendation) {
          inference.recommendations.push({
            variable,
            recommendation: typeAnalysis.recommendation
          });
        }
      }
      
      this.stats.typeInferences += allVariables.size;
      
    } catch (error) {
      this.logger.warn('Type inference failed:', error.message);
    }
    
    return inference;
  }

  async _performSemanticVariableAnalysis(baseVariables, typeInference, parseResult, options) {
    if (!this.semanticProcessor) return null;
    
    try {
      // Create semantic context for analysis
      const semanticContext = {
        variables: baseVariables.allVariables || [],
        types: typeInference?.inferredTypes || {},
        frontmatter: parseResult.frontmatter,
        content: parseResult.content
      };
      
      // Perform semantic analysis
      const analysis = await this.semanticProcessor.analyzeVariableSemantics(
        semanticContext,
        options
      );
      
      return analysis;
      
    } catch (error) {
      this.logger.warn('Semantic variable analysis failed:', error.message);
      return null;
    }
  }

  _createVariableSummary({ baseVariables, deepAnalysis, typeInference, semanticAnalysis }) {
    const allVariables = new Set();
    
    // Collect all variables from different sources
    if (baseVariables?.allVariables) {
      baseVariables.allVariables.forEach(v => allVariables.add(v));
    }
    
    if (deepAnalysis) {
      Object.values(deepAnalysis).forEach(vars => {
        if (Array.isArray(vars)) {
          vars.forEach(v => allVariables.add(v));
        }
      });
    }
    
    return {
      totalVariables: allVariables.size,
      uniqueVariables: Array.from(allVariables),
      frontmatterVariables: baseVariables?.frontmatterVariables?.length || 0,
      templateVariables: baseVariables?.templateVariables?.length || 0,
      conditionalVariables: deepAnalysis?.conditionalVariables?.length || 0,
      loopVariables: deepAnalysis?.loopVariables?.length || 0,
      typedVariables: typeInference ? Object.keys(typeInference.inferredTypes).length : 0,
      semanticVariables: semanticAnalysis?.variables?.length || 0
    };
  }

  async _createResolutionContext(extractedVariables, providedContext, options) {
    const context = {
      provided: { ...providedContext },
      global: {},
      environment: {},
      system: {},
      defaults: {},
      inheritance: {}
    };
    
    // Add global variables
    if (this.config.enableGlobalVariables) {
      for (const [key, variable] of this.globalVariables) {
        context.global[key] = variable.value;
      }
    }
    
    // Add environment variables
    if (this.config.enableEnvironmentVariables) {
      for (const [key, variable] of this.environmentVariables) {
        context.environment[key] = variable.value;
      }
    }
    
    // Add system variables
    for (const [key, variable] of this.systemVariables) {
      context.system[key] = variable.value;
    }
    
    // Generate default values if enabled
    if (this.config.defaultValueStrategy === 'generate') {
      context.defaults = await this._generateDefaultValues(
        extractedVariables,
        context,
        options
      );
    }
    
    // Handle context inheritance if enabled
    if (this.config.enableContextInheritance && options.parentContext) {
      context.inheritance = { ...options.parentContext };
    }
    
    return context;
  }

  async _applyResolutionStrategy(resolutionContext, options) {
    const resolved = {};
    
    switch (this.config.resolutionStrategy) {
      case 'merge':
        // Merge all contexts with priority: provided > global > environment > system > defaults
        Object.assign(resolved, 
          resolutionContext.defaults,
          resolutionContext.system,
          resolutionContext.environment,
          resolutionContext.global,
          resolutionContext.inheritance,
          resolutionContext.provided
        );
        break;
        
      case 'override':
        // Use provided only, falling back to defaults for missing variables
        Object.assign(resolved, 
          resolutionContext.defaults,
          resolutionContext.provided
        );
        break;
        
      case 'strict':
        // Only use provided variables, fail if any required variables are missing
        Object.assign(resolved, resolutionContext.provided);
        break;
        
      default:
        throw new Error(`Unknown resolution strategy: ${this.config.resolutionStrategy}`);
    }
    
    return resolved;
  }

  async _validateResolvedVariables(extractedVariables, resolvedVariables, options) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      missingVariables: [],
      extraVariables: []
    };
    
    try {
      const requiredVariables = extractedVariables.summary?.uniqueVariables || [];
      const providedVariables = Object.keys(resolvedVariables);
      
      // Check for missing required variables
      if (this.config.requireAllVariables) {
        for (const variable of requiredVariables) {
          if (!(variable in resolvedVariables)) {
            validation.missingVariables.push(variable);
            validation.errors.push(`Required variable missing: ${variable}`);
          }
        }
      }
      
      // Check for extra variables (warnings only)
      for (const variable of providedVariables) {
        if (!requiredVariables.includes(variable)) {
          validation.extraVariables.push(variable);
          validation.warnings.push(`Extra variable provided: ${variable}`);
        }
      }
      
      validation.valid = validation.errors.length === 0;
      
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
  }

  async _detectVariableConflicts(resolutionContext, resolvedVariables, options) {
    const analysis = {
      hasConflicts: false,
      conflicts: [],
      warnings: []
    };
    
    try {
      // Check for conflicts between different contexts
      const contexts = [
        { name: 'provided', values: resolutionContext.provided },
        { name: 'global', values: resolutionContext.global },
        { name: 'environment', values: resolutionContext.environment },
        { name: 'system', values: resolutionContext.system }
      ];
      
      // Find variables that exist in multiple contexts with different values
      for (let i = 0; i < contexts.length; i++) {
        for (let j = i + 1; j < contexts.length; j++) {
          const context1 = contexts[i];
          const context2 = contexts[j];
          
          for (const variable in context1.values) {
            if (variable in context2.values) {
              const value1 = context1.values[variable];
              const value2 = context2.values[variable];
              
              if (JSON.stringify(value1) !== JSON.stringify(value2)) {
                analysis.conflicts.push({
                  variable,
                  contexts: [context1.name, context2.name],
                  values: {
                    [context1.name]: value1,
                    [context2.name]: value2
                  },
                  resolved: resolvedVariables[variable]
                });
              }
            }
          }
        }
      }
      
      analysis.hasConflicts = analysis.conflicts.length > 0;
      
    } catch (error) {
      analysis.warnings.push(`Conflict detection failed: ${error.message}`);
    }
    
    return analysis;
  }

  async _generateDefaultValues(extractedVariables, context, options) {
    const defaults = {};
    
    try {
      const variables = extractedVariables.summary?.uniqueVariables || [];
      
      for (const variable of variables) {
        // Skip if variable is already provided in any context
        if (variable in context.provided || 
            variable in context.global || 
            variable in context.environment ||
            variable in context.system) {
          continue;
        }
        
        // Generate appropriate default value based on variable name and inferred type
        defaults[variable] = this._generateDefaultValue(variable, extractedVariables);
      }
      
    } catch (error) {
      this.logger.warn('Default value generation failed:', error.message);
    }
    
    return defaults;
  }

  _generateDefaultValue(variable, extractedVariables) {
    // Simple heuristic-based default value generation
    const lowerVar = variable.toLowerCase();
    
    if (lowerVar.includes('name')) return 'DefaultName';
    if (lowerVar.includes('title')) return 'Default Title';
    if (lowerVar.includes('description')) return 'Default description';
    if (lowerVar.includes('url') || lowerVar.includes('link')) return 'https://example.com';
    if (lowerVar.includes('email')) return 'user@example.com';
    if (lowerVar.includes('date')) return new Date().toISOString().split('T')[0];
    if (lowerVar.includes('time')) return new Date().toISOString();
    if (lowerVar.includes('count') || lowerVar.includes('number')) return 0;
    if (lowerVar.includes('enable') || lowerVar.includes('is') || lowerVar.includes('has')) return false;
    if (lowerVar.includes('list') || lowerVar.includes('items') || lowerVar.includes('array')) return [];
    if (lowerVar.includes('config') || lowerVar.includes('settings') || lowerVar.includes('options')) return {};
    
    // Default fallback
    return `{{${variable}}}`;
  }

  _extractVariablesFromExpression(expression) {
    const variables = [];
    
    try {
      // Simple regex to extract variable names
      const matches = expression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
      
      // Filter out common keywords and functions
      const keywords = ['if', 'else', 'endif', 'for', 'endfor', 'in', 'not', 'and', 'or', 'true', 'false', 'null'];
      
      for (const match of matches) {
        if (!keywords.includes(match.toLowerCase()) && !match.match(/^\d/)) {
          variables.push(match);
        }
      }
      
    } catch (error) {
      this.logger.warn(`Failed to extract variables from expression: ${expression}`, error.message);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }

  _inferVariableType(variable, content, frontmatter, deepAnalysis) {
    const analysis = {
      type: 'string', // default
      confidence: 0.1,
      patterns: [],
      recommendation: null
    };
    
    try {
      // Check frontmatter for type hints
      if (frontmatter && frontmatter[variable] !== undefined) {
        const value = frontmatter[variable];
        analysis.type = Array.isArray(value) ? 'array' : typeof value;
        analysis.confidence = 0.9;
        analysis.patterns.push('frontmatter_definition');
        return analysis;
      }
      
      // Analyze usage patterns in content
      const variableRegex = new RegExp(`\\b${variable}\\b`, 'g');
      const usages = content.match(variableRegex) || [];
      
      // Check for array/loop usage
      if (deepAnalysis?.loopVariables.includes(variable)) {
        analysis.type = 'array';
        analysis.confidence = 0.7;
        analysis.patterns.push('loop_usage');
      }
      
      // Check for conditional usage (likely boolean)
      if (deepAnalysis?.conditionalVariables.includes(variable)) {
        const conditionPattern = new RegExp(`\\b${variable}\\b\\s*[!=<>]`, 'g');
        if (!content.match(conditionPattern)) {
          analysis.type = 'boolean';
          analysis.confidence = 0.6;
          analysis.patterns.push('conditional_usage');
        }
      }
      
      // Check for filter usage patterns
      const filterPattern = new RegExp(`\\{\\{\\s*${variable}\\s*\\|\\s*(\\w+)`, 'g');
      const filterMatches = [...content.matchAll(filterPattern)];
      
      for (const match of filterMatches) {
        const filter = match[1];
        if (['length', 'count', 'size'].includes(filter)) {
          analysis.type = 'array';
          analysis.confidence = Math.max(analysis.confidence, 0.6);
          analysis.patterns.push(`filter_${filter}`);
        } else if (['date', 'dateformat'].includes(filter)) {
          analysis.type = 'date';
          analysis.confidence = Math.max(analysis.confidence, 0.8);
          analysis.patterns.push(`filter_${filter}`);
        }
      }
      
      // Name-based heuristics
      const lowerVar = variable.toLowerCase();
      if (lowerVar.includes('count') || lowerVar.includes('number') || lowerVar.includes('index')) {
        analysis.type = 'number';
        analysis.confidence = Math.max(analysis.confidence, 0.4);
        analysis.patterns.push('name_heuristic_number');
      } else if (lowerVar.includes('is') || lowerVar.includes('has') || lowerVar.includes('enable')) {
        analysis.type = 'boolean';
        analysis.confidence = Math.max(analysis.confidence, 0.5);
        analysis.patterns.push('name_heuristic_boolean');
      } else if (lowerVar.includes('list') || lowerVar.includes('items') || lowerVar.includes('array')) {
        analysis.type = 'array';
        analysis.confidence = Math.max(analysis.confidence, 0.5);
        analysis.patterns.push('name_heuristic_array');
      }
      
      // Generate recommendations
      if (analysis.confidence < 0.3) {
        analysis.recommendation = `Consider adding type information for variable '${variable}' to improve code generation`;
      }
      
    } catch (error) {
      this.logger.warn(`Type inference failed for variable ${variable}:`, error.message);
    }
    
    return analysis;
  }

  _initializeBuiltinVariables() {
    // Initialize system variables
    this.systemVariables.set('timestamp', {
      value: () => new Date().toISOString(),
      type: 'function',
      source: 'system'
    });
    
    this.systemVariables.set('date', {
      value: () => new Date().toISOString().split('T')[0],
      type: 'function',
      source: 'system'
    });
    
    this.systemVariables.set('year', {
      value: () => new Date().getFullYear(),
      type: 'function',
      source: 'system'
    });
    
    this.systemVariables.set('user', {
      value: process.env.USER || process.env.USERNAME || 'unknown',
      type: 'string',
      source: 'system'
    });
  }

  _loadEnvironmentVariables() {
    try {
      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('UNJUCKS_') || key.startsWith('KGEN_')) {
          const variableName = key.toLowerCase().replace(/^(unjucks_|kgen_)/, '');
          this.environmentVariables.set(variableName, {
            value,
            type: 'string',
            source: 'environment',
            originalKey: key
          });
        }
      }
      
      this.logger.info(`Loaded ${this.environmentVariables.size} environment variables`);
    } catch (error) {
      this.logger.warn('Failed to load environment variables:', error.message);
    }
  }

  _setupEventHandlers() {
    // Component error propagation
    if (this.semanticProcessor) {
      this.semanticProcessor.on('error', (error) => {
        this.emit('component:error', { component: 'semantic_processor', error });
      });
    }
    
    // Statistics tracking
    this.on('variables:extracted', () => {
      // Track extraction events for metrics
    });
    
    this.on('variables:resolved', () => {
      // Track resolution events for metrics
    });
  }

  getVersion() {
    return '1.0.0';
  }
}

export default VariableResolutionSystem;