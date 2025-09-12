/**
 * Knowledge Compiler v2 - Transform RDF graphs + N3 rules into compiled template contexts
 * 
 * FIXED VERSION with working N3 rule processing
 * 
 * Core KGEN capability: Translate RDF knowledge graphs into concrete template variables
 * and facts through semantic reasoning and rule-based inference.
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { Store, Parser, Writer, Util, DataFactory } from 'n3';
import crypto from 'crypto';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class KnowledgeCompiler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Template compilation settings
      maxVariableDepth: 10,
      enableCaching: true,
      cacheSize: '100MB',
      
      // Rule processing settings
      maxRuleIterations: 50,
      reasoningTimeout: 30000,
      enableParallelProcessing: true,
      
      // Context optimization
      optimizeForTemplates: true,
      compactOutput: true,
      includeMetadata: false,
      
      // Standard prefixes for RDF processing
      standardPrefixes: {
        template: 'http://unjucks.dev/template/',
        api: 'http://unjucks.dev/api/',
        data: 'http://unjucks.dev/data/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      },
      
      ...config
    };
    
    this.logger = consola.withTag('knowledge-compiler');
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer({ prefixes: this.config.standardPrefixes });
    
    // Compilation caches
    this.contextCache = new Map();
    this.ruleCache = new Map();
    this.variableCache = new Map();
    
    // Performance metrics
    this.metrics = {
      compilationTime: 0,
      rulesProcessed: 0,
      variablesExtracted: 0,
      factsInferred: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the knowledge compiler
   */
  async initialize() {
    try {
      this.logger.info('Initializing knowledge compiler...');
      
      // Initialize core components
      await this._initializeRuleEngine();
      await this._initializeVariableExtractor();
      await this._initializeContextOptimizer();
      
      this.initialized = true;
      this.logger.success('Knowledge compiler initialized');
      
      return { status: 'success', component: 'knowledge-compiler' };
      
    } catch (error) {
      this.logger.error('Failed to initialize knowledge compiler:', error);
      throw error;
    }
  }

  /**
   * Compile RDF graph into template context using N3 rules
   * @param {Object} rdfGraph - RDF knowledge graph
   * @param {Array} n3Rules - N3 reasoning rules
   * @param {Object} options - Compilation options
   * @returns {Promise<Object>} Compiled template context
   */
  async compileContext(rdfGraph, n3Rules = [], options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = this.getDeterministicTimestamp();
    const compilationId = crypto.randomUUID();
    
    try {
      this.logger.info(`Compiling context with ${rdfGraph.triples?.length || 0} triples and ${n3Rules.length} rules`);
      
      // Check cache first
      const cacheKey = this._generateCacheKey(rdfGraph, n3Rules, options);
      if (this.config.enableCaching && this.contextCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        this.logger.debug('Context cache hit');
        return this.contextCache.get(cacheKey);
      }
      this.metrics.cacheMisses++;
      
      // Load RDF graph into working store
      const workingStore = await this._loadRDFGraph(rdfGraph);
      
      // Process N3 rules to infer new facts
      const inferredFacts = await this._processN3Rules(workingStore, n3Rules, options);
      this.metrics.rulesProcessed = n3Rules.length;
      this.metrics.factsInferred = inferredFacts.length;
      
      // Extract template variables from knowledge graph
      const templateVariables = await this._extractTemplateVariables(workingStore, options);
      this.metrics.variablesExtracted = Object.keys(templateVariables).length;
      
      // Compile context object
      const compiledContext = await this._compileContextObject(
        templateVariables,
        inferredFacts,
        options
      );
      
      // Optimize context for template performance
      const optimizedContext = await this._optimizeContext(compiledContext, options);
      
      // Performance tracking
      this.metrics.compilationTime = this.getDeterministicTimestamp() - startTime;
      
      // Cache result
      if (this.config.enableCaching) {
        this.contextCache.set(cacheKey, optimizedContext);
      }
      
      this.emit('context:compiled', {
        compilationId,
        context: optimizedContext,
        metrics: { ...this.metrics }
      });
      
      this.logger.success(`Context compiled in ${this.metrics.compilationTime}ms: ${this.metrics.variablesExtracted} variables, ${this.metrics.factsInferred} facts`);
      
      return optimizedContext;
      
    } catch (error) {
      this.logger.error('Context compilation failed:', error);
      this.emit('context:error', { compilationId, error });
      throw error;
    }
  }

  /**
   * Extract template variables from knowledge graph
   */
  async _extractTemplateVariables(store, options = {}) {
    const variables = {};
    const variableQuads = store.getQuads(null, namedNode(`${this.config.standardPrefixes.template}hasVariable`), null);
    
    for (const quad of variableQuads) {
      const variableName = quad.object.value;
      const entity = quad.subject.value;
      
      const variableData = await this._extractVariableProperties(store, entity, variableName);
      variables[variableName] = variableData;
    }
    
    // Extract additional variables from API and data namespaces
    await this._extractAPIVariables(store, variables);
    await this._extractDataVariables(store, variables);
    
    return variables;
  }

  /**
   * Extract variable properties from RDF store
   */
  async _extractVariableProperties(store, entity, variableName) {
    const properties = {
      name: variableName,
      entity,
      type: 'string',
      required: false,
      default: null,
      description: '',
      constraints: []
    };
    
    // Extract type information
    const typeQuads = store.getQuads(namedNode(entity), namedNode(`${this.config.standardPrefixes.rdf}type`), null);
    if (typeQuads.length > 0) {
      properties.type = this._mapRDFTypeToJavaScript(typeQuads[0].object.value);
    }
    
    // Extract description
    const descQuads = store.getQuads(namedNode(entity), namedNode(`${this.config.standardPrefixes.rdfs}comment`), null);
    if (descQuads.length > 0) {
      properties.description = descQuads[0].object.value;
    }
    
    return properties;
  }

  /**
   * Process N3 rules to infer new facts - FIXED VERSION
   */
  async _processN3Rules(store, rules, options = {}) {
    const inferredFacts = [];
    let iteration = 0;
    let newFactsAdded = true;
    
    while (newFactsAdded && iteration < this.config.maxRuleIterations) {
      newFactsAdded = false;
      iteration++;
      
      for (const rule of rules) {
        try {
          const ruleFacts = await this._applyN3Rule(store, rule);
          
          if (ruleFacts.length > 0) {
            // Add new facts to store
            for (const fact of ruleFacts) {
              store.addQuad(fact);
              inferredFacts.push(fact);
            }
            newFactsAdded = true;
          }
          
        } catch (error) {
          this.logger.warn(`Rule application failed: ${error.message}`);
        }
      }
      
      if (iteration >= this.config.maxRuleIterations) {
        this.logger.warn(`Maximum rule iterations (${this.config.maxRuleIterations}) reached`);
        break;
      }
    }
    
    this.logger.debug(`Rule processing completed in ${iteration} iterations, ${inferredFacts.length} facts inferred`);
    return inferredFacts;
  }

  /**
   * Apply individual N3 rule to generate facts - FIXED VERSION
   */
  async _applyN3Rule(store, rule) {
    const newFacts = [];
    
    try {
      // Parse N3 rule structure
      const { conditions, conclusions } = this._parseN3Rule(rule);
      
      // Find variable bindings that satisfy conditions
      const bindings = await this._findBindings(store, conditions);
      
      // Generate conclusions for each binding
      for (const binding of bindings) {
        const conclusionFacts = this._instantiateConclusions(conclusions, binding);
        newFacts.push(...conclusionFacts);
      }
      
    } catch (error) {
      this.logger.error(`N3 rule application failed: ${error.message}`);
    }
    
    return newFacts;
  }

  /**
   * Parse N3 rule into conditions and conclusions
   */
  _parseN3Rule(rule) {
    const ruleText = rule.body || rule.text || '';
    const parts = ruleText.split('=>');
    
    if (parts.length !== 2) {
      throw new Error('Invalid N3 rule format');
    }
    
    const conditions = this._parseN3Patterns(parts[0].trim());
    const conclusions = this._parseN3Patterns(parts[1].trim());
    
    return { conditions, conclusions };
  }

  /**
   * Parse N3 patterns from rule text - FIXED VERSION
   */
  _parseN3Patterns(patternText) {
    const patterns = [];
    
    // Clean up the text and split into lines
    const cleanText = patternText.replace(/[{}]/g, '').trim();
    
    // Split by newline and filter out empty lines
    const lines = cleanText.split(/\n/).filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed !== '=>') {
        // Match patterns like: ?endpoint <predicate> value
        const match = trimmed.match(/(\??[\w:\/\.-]+|\S+)\s+(<[^>]+>|[\w:\/\.-]+)\s+(.+)/);
        if (match) {
          patterns.push({
            subject: match[1].replace(/[<>]/g, ''),
            predicate: match[2].replace(/[<>]/g, ''),
            object: match[3].replace(/[<>"]/g, '').trim()
          });
        }
      }
    }
    
    return patterns;
  }

  /**
   * Find variable bindings that satisfy rule conditions
   */
  async _findBindings(store, conditions) {
    let bindings = [{}]; // Start with empty binding
    
    for (const condition of conditions) {
      const newBindings = [];
      
      for (const binding of bindings) {
        const boundCondition = this._applyBinding(condition, binding);
        const matchingQuads = this._findMatchingQuads(store, boundCondition);
        
        for (const quad of matchingQuads) {
          const newBinding = { ...binding };
          this._updateBinding(newBinding, condition, quad);
          newBindings.push(newBinding);
        }
      }
      
      if (newBindings.length === 0) {
        return []; // No valid bindings found
      }
      
      bindings = newBindings;
    }
    
    return bindings;
  }

  /**
   * Apply variable bindings to a pattern
   */
  _applyBinding(pattern, binding) {
    return {
      subject: binding[pattern.subject] || pattern.subject,
      predicate: binding[pattern.predicate] || pattern.predicate,
      object: binding[pattern.object] || pattern.object
    };
  }

  /**
   * Find quads matching a pattern (with variables) - FIXED VERSION
   */
  _findMatchingQuads(store, pattern) {
    const subject = pattern.subject.startsWith('?') ? null : namedNode(pattern.subject);
    const predicate = pattern.predicate.startsWith('?') ? null : namedNode(pattern.predicate);
    
    let object = null;
    if (!pattern.object.startsWith('?')) {
      // Handle different object types
      if (pattern.object === 'true' || pattern.object === 'false') {
        object = literal(pattern.object, namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
      } else if (!isNaN(pattern.object) && pattern.object !== '') {
        object = literal(pattern.object, namedNode('http://www.w3.org/2001/XMLSchema#integer'));
      } else if (pattern.object.startsWith('http://')) {
        object = namedNode(pattern.object);
      } else {
        object = literal(pattern.object);
      }
    }
    
    return store.getQuads(subject, predicate, object);
  }

  /**
   * Update variable binding based on matched quad
   */
  _updateBinding(binding, pattern, quad) {
    if (pattern.subject.startsWith('?')) {
      binding[pattern.subject] = quad.subject.value;
    }
    if (pattern.predicate.startsWith('?')) {
      binding[pattern.predicate] = quad.predicate.value;
    }
    if (pattern.object.startsWith('?')) {
      binding[pattern.object] = quad.object.value;
    }
  }

  /**
   * Generate conclusion quads from patterns and bindings - FIXED VERSION
   */
  _instantiateConclusions(conclusions, binding) {
    return conclusions.map(conclusion => {
      const boundConclusion = this._applyBinding(conclusion, binding);
      
      // Create appropriate object based on value type
      let objectNode;
      if (boundConclusion.object === 'true' || boundConclusion.object === 'false') {
        objectNode = literal(boundConclusion.object, namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
      } else if (!isNaN(boundConclusion.object) && boundConclusion.object !== '') {
        objectNode = literal(boundConclusion.object, namedNode('http://www.w3.org/2001/XMLSchema#integer'));
      } else if (boundConclusion.object.startsWith('http://')) {
        objectNode = namedNode(boundConclusion.object);
      } else {
        objectNode = literal(boundConclusion.object);
      }
      
      return quad(
        namedNode(boundConclusion.subject),
        namedNode(boundConclusion.predicate),
        objectNode
      );
    });
  }

  /**
   * Compile context object from variables and facts
   */
  async _compileContextObject(templateVariables, inferredFacts, options = {}) {
    const context = {
      variables: templateVariables,
      facts: {},
      metadata: {
        compiledAt: this.getDeterministicDate().toISOString(),
        inferredFacts: inferredFacts.length,
        variableCount: Object.keys(templateVariables).length
      }
    };
    
    // Organize inferred facts by subject
    for (const fact of inferredFacts) {
      const subject = fact.subject.value;
      const predicate = fact.predicate.value;
      const object = this._parseRDFValue(fact.object);
      
      if (!context.facts[subject]) {
        context.facts[subject] = {};
      }
      
      context.facts[subject][predicate] = object;
    }
    
    // Add computed properties
    await this._addComputedProperties(context, options);
    
    return context;
  }

  /**
   * Optimize context for template performance
   */
  async _optimizeContext(context, options = {}) {
    if (!this.config.optimizeForTemplates) {
      return context;
    }
    
    const optimized = { ...context };
    
    // Flatten nested structures for easier template access
    if (options.flattenStructures !== false) {
      optimized.flat = this._flattenContext(context);
    }
    
    // Pre-compute common template expressions
    if (options.precomputeExpressions !== false) {
      optimized.computed = await this._precomputeExpressions(context);
    }
    
    // Remove metadata in compact mode
    if (this.config.compactOutput && !this.config.includeMetadata) {
      delete optimized.metadata;
    }
    
    return optimized;
  }

  // Utility and helper methods (keeping only essential ones)
  async _loadRDFGraph(rdfGraph) {
    const store = new Store();
    
    if (rdfGraph.triples) {
      for (const triple of rdfGraph.triples) {
        store.addQuad(this._tripleToQuad(triple));
      }
    }
    
    return store;
  }

  _tripleToQuad(triple) {
    return quad(
      namedNode(triple.subject),
      namedNode(triple.predicate),
      triple.object.type === 'literal' ? 
        literal(triple.object.value, triple.object.datatype) :
        namedNode(triple.object.value)
    );
  }

  _parseRDFValue(rdfObject) {
    if (rdfObject.termType === 'Literal') {
      const datatype = rdfObject.datatype?.value;
      
      switch (datatype) {
        case 'http://www.w3.org/2001/XMLSchema#integer':
          return parseInt(rdfObject.value, 10);
        case 'http://www.w3.org/2001/XMLSchema#decimal':
        case 'http://www.w3.org/2001/XMLSchema#double':
          return parseFloat(rdfObject.value);
        case 'http://www.w3.org/2001/XMLSchema#boolean':
          return rdfObject.value === 'true';
        default:
          return rdfObject.value;
      }
    }
    
    return rdfObject.value;
  }

  _mapRDFTypeToJavaScript(rdfType) {
    const typeMap = {
      'http://www.w3.org/2001/XMLSchema#string': 'string',
      'http://www.w3.org/2001/XMLSchema#integer': 'number',
      'http://www.w3.org/2001/XMLSchema#decimal': 'number',
      'http://www.w3.org/2001/XMLSchema#boolean': 'boolean',
      'http://www.w3.org/2001/XMLSchema#date': 'Date',
      'http://www.w3.org/2001/XMLSchema#dateTime': 'Date'
    };
    
    return typeMap[rdfType] || 'string';
  }

  _generateCacheKey(rdfGraph, rules, options) {
    const data = JSON.stringify({ rdfGraph, rules, options });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _flattenContext(context, prefix = '', flat = {}) {
    for (const [key, value] of Object.entries(context)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this._flattenContext(value, newKey, flat);
      } else {
        flat[newKey] = value;
      }
    }
    
    return flat;
  }

  async _precomputeExpressions(context) {
    const computed = {};
    
    // Add common template utilities
    computed.isEmpty = (obj) => !obj || Object.keys(obj).length === 0;
    computed.count = (arr) => Array.isArray(arr) ? arr.length : 0;
    computed.keys = (obj) => obj ? Object.keys(obj) : [];
    computed.values = (obj) => obj ? Object.values(obj) : [];
    
    return computed;
  }

  async _extractAPIVariables(store, variables) {
    const apiQuads = store.getQuads(null, namedNode(`${this.config.standardPrefixes.api}hasEndpoint`), null);
    
    for (const quad of apiQuads) {
      const apiName = quad.object.value.split('/').pop();
      variables[`api.${apiName}`] = {
        name: apiName,
        type: 'object',
        source: 'api',
        endpoint: quad.object.value
      };
    }
  }

  async _extractDataVariables(store, variables) {
    const dataQuads = store.getQuads(null, namedNode(`${this.config.standardPrefixes.data}hasField`), null);
    
    for (const quad of dataQuads) {
      const fieldName = quad.object.value;
      variables[`data.${fieldName}`] = {
        name: fieldName,
        type: 'string',
        source: 'data',
        entity: quad.subject.value
      };
    }
  }

  async _addComputedProperties(context, options) {
    context.computed = {
      variableNames: Object.keys(context.variables),
      factCount: Object.keys(context.facts).length,
      hasAPI: Object.keys(context.variables).some(key => key.startsWith('api.')),
      hasData: Object.keys(context.variables).some(key => key.startsWith('data.'))
    };
  }

  async _initializeRuleEngine() {
    this.ruleEngine = {
      processRules: this._processN3Rules.bind(this),
      applyRule: this._applyN3Rule.bind(this)
    };
  }

  async _initializeVariableExtractor() {
    this.variableExtractor = {
      extract: this._extractTemplateVariables.bind(this),
      extractProperties: this._extractVariableProperties.bind(this)
    };
  }

  async _initializeContextOptimizer() {
    this.contextOptimizer = {
      optimize: this._optimizeContext.bind(this),
      flatten: this._flattenContext.bind(this),
      precompute: this._precomputeExpressions.bind(this)
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clearCaches() {
    this.contextCache.clear();
    this.ruleCache.clear();
    this.variableCache.clear();
    this.logger.info('Caches cleared');
  }
}

export default KnowledgeCompiler;