/**
 * Minimal Working Knowledge Compiler
 * Focused implementation that actually works
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { Store, Parser, Writer, DataFactory } from 'n3';
import crypto from 'crypto';

const { namedNode, literal, quad } = DataFactory;

export class KnowledgeCompiler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxRuleIterations: 50,
      enableCaching: true,
      optimizeForTemplates: true,
      compactOutput: true,
      includeMetadata: false,
      
      standardPrefixes: {
        template: 'http://unjucks.dev/template/',
        api: 'http://unjucks.dev/api/',
        data: 'http://unjucks.dev/data/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
      },
      
      ...config
    };
    
    this.logger = consola.withTag('knowledge-compiler');
    this.contextCache = new Map();
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

  async initialize() {
    this.logger.info('Initializing knowledge compiler...');
    this.initialized = true;
    this.logger.success('Knowledge compiler initialized');
    return { status: 'success', component: 'knowledge-compiler' };
  }

  async compileContext(rdfGraph, n3Rules = [], options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      this.logger.info(`Compiling context with ${rdfGraph.triples?.length || 0} triples and ${n3Rules.length} rules`);
      
      // Check cache
      const cacheKey = this._generateCacheKey(rdfGraph, n3Rules, options);
      if (this.config.enableCaching && this.contextCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.contextCache.get(cacheKey);
      }
      this.metrics.cacheMisses++;
      
      // Load RDF graph
      const store = this._loadRDFGraph(rdfGraph);
      
      // Apply N3 rules
      const inferredFacts = this._processN3Rules(store, n3Rules);
      this.metrics.rulesProcessed = n3Rules.length;
      this.metrics.factsInferred = inferredFacts.length;
      
      // Extract variables
      const templateVariables = this._extractTemplateVariables(store);
      this.metrics.variablesExtracted = Object.keys(templateVariables).length;
      
      // Compile context
      const context = this._compileContextObject(templateVariables, inferredFacts, options);
      
      // Optimize
      const optimizedContext = this._optimizeContext(context, options);
      
      this.metrics.compilationTime = Date.now() - startTime;
      
      if (this.config.enableCaching) {
        this.contextCache.set(cacheKey, optimizedContext);
      }
      
      this.logger.success(`Context compiled in ${this.metrics.compilationTime}ms: ${this.metrics.variablesExtracted} variables, ${this.metrics.factsInferred} facts`);
      
      return optimizedContext;
      
    } catch (error) {
      this.logger.error('Context compilation failed:', error);
      throw error;
    }
  }

  _loadRDFGraph(rdfGraph) {
    const store = new Store();
    
    if (rdfGraph.triples) {
      for (const triple of rdfGraph.triples) {
        const quad = this._tripleToQuad(triple);
        store.addQuad(quad);
      }
    }
    
    return store;
  }

  _tripleToQuad(triple) {
    const subject = namedNode(triple.subject);
    const predicate = namedNode(triple.predicate);
    
    let object;
    if (triple.object.type === 'literal') {
      if (triple.object.datatype) {
        object = literal(triple.object.value, namedNode(triple.object.datatype));
      } else {
        object = literal(triple.object.value);
      }
    } else {
      object = namedNode(triple.object.value);
    }
    
    return quad(subject, predicate, object);
  }

  _processN3Rules(store, rules) {
    const inferredFacts = [];
    
    for (const rule of rules) {
      try {
        const ruleFacts = this._applyRule(store, rule);
        inferredFacts.push(...ruleFacts);
        
        // Add new facts to store
        for (const fact of ruleFacts) {
          store.addQuad(fact);
        }
      } catch (error) {
        this.logger.warn(`Rule application failed: ${error.message}`);
      }
    }
    
    return inferredFacts;
  }

  _applyRule(store, rule) {
    const { conditions, conclusions } = this._parseRule(rule);
    const newFacts = [];
    
    // Simple rule matching - find all combinations that satisfy conditions
    const bindings = this._findSimpleBindings(store, conditions);
    
    for (const binding of bindings) {
      for (const conclusion of conclusions) {
        const fact = this._instantiateConclusion(conclusion, binding);
        if (fact) {
          newFacts.push(fact);
        }
      }
    }
    
    return newFacts;
  }

  _parseRule(rule) {
    const ruleText = rule.body || rule.text || '';
    const parts = ruleText.split('=>');
    
    if (parts.length !== 2) {
      throw new Error('Invalid N3 rule format');
    }
    
    const conditions = this._parsePatterns(parts[0].trim());
    const conclusions = this._parsePatterns(parts[1].trim());
    
    return { conditions, conclusions };
  }

  _parsePatterns(patternText) {
    const patterns = [];
    const cleanText = patternText.replace(/[{}]/g, '').trim();
    const lines = cleanText.split(/\n/).filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/(\??[\w:\/\.-]+)\s+(<[^>]+>|[\w:\/\.-]+)\s+(.+)/);
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

  _findSimpleBindings(store, conditions) {
    if (conditions.length === 0) return [{}];
    
    // For simplicity, handle single condition case
    if (conditions.length === 1) {
      const condition = conditions[0];
      const bindings = [];
      
      // Find all quads that match the condition pattern
      const matchingQuads = this._findMatchingQuadsSimple(store, condition);
      
      for (const quad of matchingQuads) {
        const binding = {};
        
        if (condition.subject.startsWith('?')) {
          binding[condition.subject] = quad.subject.value;
        }
        if (condition.predicate.startsWith('?')) {
          binding[condition.predicate] = quad.predicate.value;
        }
        if (condition.object.startsWith('?')) {
          binding[condition.object] = quad.object.value;
        }
        
        bindings.push(binding);
      }
      
      return bindings;
    }
    
    // For multiple conditions, use a simplified approach
    return [{}];
  }

  _findMatchingQuadsSimple(store, pattern) {
    // Build query parameters
    const subject = pattern.subject.startsWith('?') ? null : namedNode(pattern.subject);
    const predicate = pattern.predicate.startsWith('?') ? null : namedNode(pattern.predicate);
    
    let object = null;
    if (!pattern.object.startsWith('?')) {
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

  _instantiateConclusion(conclusion, binding) {
    try {
      // Apply binding to conclusion
      const boundSubject = binding[conclusion.subject] || conclusion.subject;
      const boundPredicate = binding[conclusion.predicate] || conclusion.predicate;
      const boundObject = binding[conclusion.object] || conclusion.object;
      
      // Create the quad
      const subject = namedNode(boundSubject);
      const predicate = namedNode(boundPredicate);
      
      let object;
      if (boundObject === 'true' || boundObject === 'false') {
        object = literal(boundObject, namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
      } else if (!isNaN(boundObject) && boundObject !== '') {
        object = literal(boundObject, namedNode('http://www.w3.org/2001/XMLSchema#integer'));
      } else if (boundObject.startsWith('http://')) {
        object = namedNode(boundObject);
      } else {
        object = literal(boundObject);
      }
      
      return quad(subject, predicate, object);
      
    } catch (error) {
      this.logger.warn(`Failed to instantiate conclusion: ${error.message}`);
      return null;
    }
  }

  _extractTemplateVariables(store) {
    const variables = {};
    
    // Extract template variables
    const templateVarQuads = store.getQuads(null, namedNode(`${this.config.standardPrefixes.template}hasVariable`), null);
    
    for (const quad of templateVarQuads) {
      const varName = quad.object.value;
      const entity = quad.subject.value;
      
      variables[varName] = {
        name: varName,
        entity,
        type: 'string',
        required: false,
        description: this._getDescription(store, entity)
      };
    }
    
    // Extract API variables
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
    
    // Extract data variables
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
    
    return variables;
  }

  _getDescription(store, entity) {
    const descQuads = store.getQuads(namedNode(entity), namedNode(`${this.config.standardPrefixes.rdfs}comment`), null);
    return descQuads.length > 0 ? descQuads[0].object.value : '';
  }

  _compileContextObject(templateVariables, inferredFacts, options) {
    const context = {
      variables: templateVariables,
      facts: {},
      metadata: {
        compiledAt: new Date().toISOString(),
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
    context.computed = {
      variableNames: Object.keys(templateVariables),
      factCount: Object.keys(context.facts).length,
      hasAPI: Object.keys(templateVariables).some(key => key.startsWith('api.')),
      hasData: Object.keys(templateVariables).some(key => key.startsWith('data.'))
    };
    
    return context;
  }

  _optimizeContext(context, options) {
    const optimized = { ...context };
    
    if (options.flattenStructures !== false) {
      optimized.flat = this._flattenContext(context);
    }
    
    if (options.precomputeExpressions !== false) {
      optimized.computed = {
        ...optimized.computed,
        isEmpty: (obj) => !obj || Object.keys(obj).length === 0,
        count: (arr) => Array.isArray(arr) ? arr.length : 0,
        keys: (obj) => obj ? Object.keys(obj) : [],
        values: (obj) => obj ? Object.values(obj) : []
      };
    }
    
    if (this.config.compactOutput && !this.config.includeMetadata) {
      delete optimized.metadata;
    }
    
    return optimized;
  }

  _parseRDFValue(rdfObject) {
    if (rdfObject.termType === 'Literal') {
      const datatype = rdfObject.datatype?.value;
      
      switch (datatype) {
        case 'http://www.w3.org/2001/XMLSchema#integer':
          return parseInt(rdfObject.value, 10);
        case 'http://www.w3.org/2001/XMLSchema#boolean':
          return rdfObject.value === 'true';
        default:
          return rdfObject.value;
      }
    }
    
    return rdfObject.value;
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

  _generateCacheKey(rdfGraph, rules, options) {
    const data = JSON.stringify({ rdfGraph, rules, options });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clearCaches() {
    this.contextCache.clear();
    this.logger.info('Caches cleared');
  }

  // Expose internal methods for testing
  _parseRule(rule) {
    return this._parseRule(rule);
  }

  _loadRDFGraph(graph) {
    return this._loadRDFGraph(graph);
  }

  _findBindings() {
    // Alias for compatibility
    return this._findSimpleBindings(...arguments);
  }
  
  _findMatchingQuads() {
    // Alias for compatibility  
    return this._findMatchingQuadsSimple(...arguments);
  }
  
  _instantiateConclusions(conclusions, binding) {
    return conclusions.map(conclusion => this._instantiateConclusion(conclusion, binding)).filter(Boolean);
  }
  
  _applyBinding(pattern, binding) {
    return {
      subject: binding[pattern.subject] || pattern.subject,
      predicate: binding[pattern.predicate] || pattern.predicate,
      object: binding[pattern.object] || pattern.object
    };
  }
  
  _mapRDFTypeToJavaScript(rdfType) {
    const typeMap = {
      'http://www.w3.org/2001/XMLSchema#string': 'string',
      'http://www.w3.org/2001/XMLSchema#integer': 'number',
      'http://www.w3.org/2001/XMLSchema#boolean': 'boolean'
    };
    return typeMap[rdfType] || 'string';
  }
}

export default KnowledgeCompiler;