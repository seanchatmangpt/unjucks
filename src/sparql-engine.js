/**
 * KGEN SPARQL Query Engine
 * 
 * Advanced SPARQL query processing engine for RDF context extraction
 * integrated with template rendering and provenance tracking.
 * 
 * Agent #8: SPARQL Query Engine in the KGEN Hive Mind
 */

import { EventEmitter } from 'events';
import { Store, DataFactory, Parser, Writer } from 'n3';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const { namedNode, literal, blankNode, quad } = DataFactory;

export class KgenSparqlEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Core SPARQL settings
      enableSPARQL: true,
      enableSemanticSearch: true,
      enableOptimization: true,
      
      // Performance settings
      queryTimeout: 30000,
      maxResultSize: 10000,
      enableQueryCache: true,
      cacheTTL: 600000, // 10 minutes
      
      // Template integration
      enableContextExtraction: true,
      maxContextEntities: 1000,
      contextImportanceThreshold: 0.1,
      
      // Provenance settings
      enableProvenanceQueries: true,
      maxProvenanceDepth: 10,
      
      ...config
    };
    
    // Initialize N3 store for RDF data
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer();
    
    // Query processing components
    this.queryCache = new Map();
    this.queryStats = new Map();
    this.activeQueries = new Map();
    
    // Template context caches
    this.entityCache = new Map();
    this.propertyCache = new Map();
    this.classCache = new Map();
    
    // Predefined query templates
    this.queryTemplates = new Map();
    
    // Performance metrics
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      contextExtractions: 0
    };
    
    this.initializeQueryTemplates();
  }

  /**
   * Initialize the SPARQL engine
   */
  async initialize(options = {}) {
    try {
      console.log('[SPARQL Engine] Initializing...');
      
      // Load RDF data if provided
      if (options.rdfData) {
        await this.loadRdfData(options.rdfData);
      }
      
      // Load ontologies if provided
      if (options.ontologies) {
        await this.loadOntologies(options.ontologies);
      }
      
      this.state = 'ready';
      console.log('[SPARQL Engine] Ready for queries');
      
      return { status: 'success', message: 'SPARQL engine initialized' };
      
    } catch (error) {
      console.error('[SPARQL Engine] Initialization failed:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Execute SPARQL query with template context integration
   */
  async executeQuery(query, options = {}) {
    const queryId = this._generateQueryId();
    const startTime = Date.now();
    
    try {
      console.log(`[SPARQL Engine] Executing query ${queryId}`);
      this.metrics.totalQueries++;
      
      // Check cache if enabled
      if (this.config.enableQueryCache && !options.skipCache) {
        const cached = this._getCachedResult(query);
        if (cached) {
          this.metrics.cacheHits++;
          this.emit('query:cache_hit', { queryId, query });
          return cached;
        }
        this.metrics.cacheMisses++;
      }
      
      // Create execution context
      const context = {
        queryId,
        query,
        startTime,
        timeout: options.timeout || this.config.queryTimeout,
        maxResults: options.maxResults || this.config.maxResultSize,
        extractContext: options.extractContext || this.config.enableContextExtraction
      };
      
      this.activeQueries.set(queryId, context);
      
      // Execute SPARQL query
      const results = await this._executeSparqlQuery(context);
      
      // Extract template context if enabled
      if (context.extractContext) {
        results.templateContext = await this._extractTemplateContext(results, options);
        this.metrics.contextExtractions++;
      }
      
      // Add metadata
      const executionTime = Date.now() - startTime;
      results.metadata = {
        queryId,
        executionTime,
        resultCount: results.results?.bindings?.length || 0,
        fromCache: false
      };
      
      // Cache results if enabled
      if (this.config.enableQueryCache && !options.skipCache) {
        this._cacheResult(query, results);
      }
      
      // Update metrics
      this._updateMetrics(context, executionTime, true);
      this.activeQueries.delete(queryId);
      this.metrics.successfulQueries++;
      
      this.emit('query:completed', { 
        queryId, 
        executionTime, 
        resultCount: results.metadata.resultCount 
      });
      
      return results;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._updateMetrics({ queryId, query }, executionTime, false);
      this.activeQueries.delete(queryId);
      
      this.metrics.failedQueries++;
      console.error(`[SPARQL Engine] Query ${queryId} failed:`, error);
      this.emit('query:failed', { queryId, error, executionTime });
      throw error;
    }
  }

  /**
   * Execute predefined query template
   */
  async executeTemplate(templateName, parameters = {}, options = {}) {
    const template = this.queryTemplates.get(templateName);
    if (!template) {
      throw new Error(`Query template not found: ${templateName}`);
    }
    
    console.log(`[SPARQL Engine] Executing template: ${templateName}`);
    
    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !parameters[param.name]) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }
      
      if (parameters[param.name] && param.validation && !param.validation.test(parameters[param.name])) {
        throw new Error(`Invalid parameter value: ${param.name}`);
      }
    }
    
    // Build query from template
    let query = template.sparql;
    for (const [name, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`{{${name}}}`, 'g');
      query = query.replace(placeholder, value);
    }
    
    // Set default values for missing optional parameters
    query = query.replace(/{{(\w+):([^}]+)}}/g, (match, param, defaultValue) => {
      return parameters[param] || defaultValue;
    });
    
    return await this.executeQuery(query, {
      ...options,
      templateName,
      parameters
    });
  }

  /**
   * Extract context for API resource templates
   */
  async extractApiContext(resourceType, options = {}) {
    const query = `
      PREFIX api: <http://kgen.enterprise/api/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?resource ?property ?value ?type ?required WHERE {
        ?resource a api:${resourceType} .
        ?resource ?property ?value .
        
        OPTIONAL { ?property a ?type }
        OPTIONAL { ?property api:required ?required }
        
        # Include labels for better template context
        OPTIONAL { ?property rdfs:label ?propertyLabel }
        OPTIONAL { ?resource rdfs:label ?resourceLabel }
      }
      ORDER BY ?resource ?property
      LIMIT ${options.limit || 1000}
    `;
    
    const results = await this.executeQuery(query, {
      extractContext: true,
      contextType: 'api'
    });
    
    return this._formatApiContext(results, resourceType);
  }

  /**
   * Extract context for compliance requirements
   */
  async extractComplianceContext(requirementType, options = {}) {
    const query = `
      PREFIX compliance: <http://kgen.enterprise/compliance/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?requirement ?level ?category ?description ?applicable WHERE {
        ?requirement a compliance:${requirementType} .
        ?requirement compliance:level ?level .
        ?requirement compliance:category ?category .
        
        OPTIONAL { ?requirement rdfs:comment ?description }
        OPTIONAL { ?requirement compliance:applicableTo ?applicable }
      }
      ORDER BY ?level ?category
      LIMIT ${options.limit || 500}
    `;
    
    const results = await this.executeQuery(query, {
      extractContext: true,
      contextType: 'compliance'
    });
    
    return this._formatComplianceContext(results, requirementType);
  }

  /**
   * Execute impact analysis query
   */
  async analyzeImpact(entityUri, depth = 3) {
    return await this.executeTemplate('impact-analysis', {
      entityUri,
      maxDepth: depth.toString(),
      limit: '1000'
    });
  }

  /**
   * Execute validation rule queries
   */
  async validateRules(ruleSet, targetEntities = []) {
    const validationResults = [];
    
    for (const rule of ruleSet.rules || []) {
      try {
        const query = this._buildValidationQuery(rule, targetEntities);
        const results = await this.executeQuery(query, {
          extractContext: false,
          validationRule: rule
        });
        
        validationResults.push({
          rule: rule.name,
          passed: this._evaluateValidationResults(results, rule),
          results: results.results,
          details: rule.description
        });
        
      } catch (error) {
        validationResults.push({
          rule: rule.name,
          passed: false,
          error: error.message,
          details: rule.description
        });
      }
    }
    
    return {
      ruleSet: ruleSet.name,
      totalRules: ruleSet.rules.length,
      passed: validationResults.filter(r => r.passed).length,
      failed: validationResults.filter(r => !r.passed).length,
      results: validationResults
    };
  }

  /**
   * Execute provenance queries for template traceability
   */
  async traceProvenance(entityUri, direction = 'both', depth = 5) {
    let templateName;
    
    switch (direction) {
      case 'forward':
        templateName = 'forward-lineage';
        break;
      case 'backward':
        templateName = 'backward-lineage';
        break;
      case 'both':
        templateName = 'bidirectional-lineage';
        break;
      default:
        throw new Error(`Invalid provenance direction: ${direction}`);
    }
    
    return await this.executeTemplate(templateName, {
      entityUri,
      maxDepth: depth.toString(),
      limit: '2000'
    });
  }

  /**
   * Get query engine status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      activeQueries: this.activeQueries.size,
      cachedQueries: this.queryCache.size,
      templates: this.queryTemplates.size,
      triples: this.store.size,
      metrics: this.metrics,
      config: {
        enableSPARQL: this.config.enableSPARQL,
        enableSemanticSearch: this.config.enableSemanticSearch,
        enableOptimization: this.config.enableOptimization,
        enableContextExtraction: this.config.enableContextExtraction
      }
    };
  }

  // Private methods

  async loadRdfData(data) {
    console.log('[SPARQL Engine] Loading RDF data...');
    
    if (typeof data === 'string') {
      // Parse RDF string data
      const quads = this.parser.parse(data);
      this.store.addQuads(quads);
    } else if (Array.isArray(data)) {
      // Add array of quads
      this.store.addQuads(data);
    } else {
      throw new Error('Invalid RDF data format');
    }
    
    console.log(`[SPARQL Engine] Loaded ${this.store.size} triples`);
  }

  async loadOntologies(ontologies) {
    console.log('[SPARQL Engine] Loading ontologies...');
    
    for (const ontology of ontologies) {
      if (typeof ontology === 'string') {
        const quads = this.parser.parse(ontology);
        this.store.addQuads(quads);
      }
    }
    
    console.log(`[SPARQL Engine] Total triples: ${this.store.size}`);
  }

  async _executeSparqlQuery(context) {
    try {
      // Simple SPARQL execution using N3 store
      // For production, would integrate with a full SPARQL processor
      
      const results = {
        head: { vars: [] },
        results: { bindings: [] }
      };
      
      // Parse query to extract basic patterns
      const patterns = this._extractBasicPatterns(context.query);
      
      if (patterns.length === 0) {
        return results;
      }
      
      // Execute patterns against store
      const bindings = [];
      const vars = new Set();
      
      for (const pattern of patterns) {
        const matches = this.store.getQuads(
          pattern.subject,
          pattern.predicate,
          pattern.object,
          pattern.graph
        );
        
        for (const quad of matches) {
          const binding = {};
          
          // Extract variables from pattern
          if (pattern.subjectVar) {
            binding[pattern.subjectVar] = this._termToBinding(quad.subject);
            vars.add(pattern.subjectVar);
          }
          if (pattern.predicateVar) {
            binding[pattern.predicateVar] = this._termToBinding(quad.predicate);
            vars.add(pattern.predicateVar);
          }
          if (pattern.objectVar) {
            binding[pattern.objectVar] = this._termToBinding(quad.object);
            vars.add(pattern.objectVar);
          }
          
          if (Object.keys(binding).length > 0) {
            bindings.push(binding);
          }
        }
      }
      
      results.head.vars = Array.from(vars);
      results.results.bindings = bindings.slice(0, context.maxResults);
      
      return results;
      
    } catch (error) {
      console.error('[SPARQL Engine] Query execution failed:', error);
      throw error;
    }
  }

  async _extractTemplateContext(results, options) {
    if (!results.results?.bindings) {
      return {};
    }
    
    const context = {
      entities: [],
      properties: [],
      classes: [],
      relationships: [],
      statistics: {}
    };
    
    // Extract entities from results
    const entityUris = new Set();
    const propertyUris = new Set();
    
    for (const binding of results.results.bindings) {
      for (const [variable, term] of Object.entries(binding)) {
        if (term.type === 'uri') {
          entityUris.add(term.value);
        }
      }
    }
    
    // Build entity context
    for (const uri of Array.from(entityUris).slice(0, this.config.maxContextEntities)) {
      const entityContext = await this._buildEntityContext(uri);
      if (entityContext) {
        context.entities.push(entityContext);
      }
    }
    
    // Add statistics
    context.statistics = {
      entityCount: context.entities.length,
      resultCount: results.results.bindings.length,
      executionTime: Date.now()
    };
    
    return context;
  }

  async _buildEntityContext(uri) {
    if (this.entityCache.has(uri)) {
      return this.entityCache.get(uri);
    }
    
    try {
      const entityQuads = this.store.getQuads(namedNode(uri), null, null, null);
      
      if (entityQuads.length === 0) {
        return null;
      }
      
      const entityContext = {
        uri,
        label: null,
        type: null,
        properties: [],
        importance: 0
      };
      
      // Extract properties and calculate importance
      for (const quad of entityQuads) {
        const property = {
          predicate: quad.predicate.value,
          object: this._termToBinding(quad.object)
        };
        
        entityContext.properties.push(property);
        
        // Extract label
        if (quad.predicate.value.includes('label')) {
          entityContext.label = quad.object.value;
        }
        
        // Extract type
        if (quad.predicate.value.includes('type')) {
          entityContext.type = quad.object.value;
        }
      }
      
      // Calculate importance based on property count and connections
      entityContext.importance = Math.min(entityQuads.length / 100, 1.0);
      
      // Cache entity context
      this.entityCache.set(uri, entityContext);
      
      return entityContext;
      
    } catch (error) {
      console.warn(`[SPARQL Engine] Failed to build context for entity: ${uri}`, error);
      return null;
    }
  }

  _extractBasicPatterns(query) {
    // Very basic pattern extraction for demonstration
    // In production, would use a full SPARQL parser
    
    const patterns = [];
    const tripleMatches = query.match(/\?(\w+)\s+([^\s]+)\s+([^\s.]+)/g);
    
    if (!tripleMatches) {
      return patterns;
    }
    
    for (const match of tripleMatches) {
      const parts = match.trim().split(/\s+/);
      if (parts.length >= 3) {
        const pattern = {
          subject: null,
          predicate: null,
          object: null,
          subjectVar: null,
          predicateVar: null,
          objectVar: null
        };
        
        // Parse subject
        if (parts[0].startsWith('?')) {
          pattern.subjectVar = parts[0].substring(1);
        } else if (parts[0].startsWith('<')) {
          pattern.subject = namedNode(parts[0].slice(1, -1));
        }
        
        // Parse predicate
        if (parts[1].startsWith('?')) {
          pattern.predicateVar = parts[1].substring(1);
        } else if (parts[1].startsWith('<')) {
          pattern.predicate = namedNode(parts[1].slice(1, -1));
        } else {
          // Handle prefixed names
          pattern.predicate = namedNode(this._expandPrefix(parts[1]));
        }
        
        // Parse object
        if (parts[2].startsWith('?')) {
          pattern.objectVar = parts[2].substring(1);
        } else if (parts[2].startsWith('<')) {
          pattern.object = namedNode(parts[2].slice(1, -1));
        } else if (parts[2].startsWith('"')) {
          pattern.object = literal(parts[2].slice(1, -1));
        }
        
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  _expandPrefix(prefixed) {
    // Basic prefix expansion
    const prefixes = {
      'rdf:': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs:': 'http://www.w3.org/2000/01/rdf-schema#',
      'owl:': 'http://www.w3.org/2002/07/owl#',
      'prov:': 'http://www.w3.org/ns/prov#',
      'kgen:': 'http://kgen.enterprise/',
      'api:': 'http://kgen.enterprise/api/',
      'compliance:': 'http://kgen.enterprise/compliance/'
    };
    
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (prefixed.startsWith(prefix)) {
        return namespace + prefixed.substring(prefix.length);
      }
    }
    
    return prefixed;
  }

  _termToBinding(term) {
    switch (term.termType) {
      case 'NamedNode':
        return { type: 'uri', value: term.value };
      case 'Literal':
        const binding = { type: 'literal', value: term.value };
        if (term.datatype && !term.datatype.equals(namedNode('http://www.w3.org/2001/XMLSchema#string'))) {
          binding.datatype = term.datatype.value;
        }
        if (term.language) {
          binding['xml:lang'] = term.language;
        }
        return binding;
      case 'BlankNode':
        return { type: 'bnode', value: term.value };
      default:
        return { type: 'literal', value: term.value };
    }
  }

  _formatApiContext(results, resourceType) {
    const context = {
      resourceType,
      properties: {},
      required: [],
      optional: [],
      examples: {}
    };
    
    for (const binding of results.results.bindings || []) {
      const property = binding.property?.value;
      const value = binding.value?.value;
      const required = binding.required?.value === 'true';
      
      if (property && value) {
        if (!context.properties[property]) {
          context.properties[property] = {
            values: [],
            required,
            examples: []
          };
        }
        
        context.properties[property].values.push(value);
        
        if (required) {
          context.required.push(property);
        } else {
          context.optional.push(property);
        }
      }
    }
    
    return context;
  }

  _formatComplianceContext(results, requirementType) {
    const context = {
      requirementType,
      requirements: [],
      byLevel: {},
      byCategory: {}
    };
    
    for (const binding of results.results.bindings || []) {
      const requirement = {
        uri: binding.requirement?.value,
        level: binding.level?.value,
        category: binding.category?.value,
        description: binding.description?.value,
        applicable: binding.applicable?.value
      };
      
      context.requirements.push(requirement);
      
      // Group by level
      if (requirement.level) {
        if (!context.byLevel[requirement.level]) {
          context.byLevel[requirement.level] = [];
        }
        context.byLevel[requirement.level].push(requirement);
      }
      
      // Group by category
      if (requirement.category) {
        if (!context.byCategory[requirement.category]) {
          context.byCategory[requirement.category] = [];
        }
        context.byCategory[requirement.category].push(requirement);
      }
    }
    
    return context;
  }

  _buildValidationQuery(rule, targetEntities) {
    let query = rule.sparqlQuery || rule.query;
    
    // Replace target entity placeholders
    if (targetEntities.length > 0) {
      const entityList = targetEntities.map(e => `<${e}>`).join(' ');
      query = query.replace(/{{TARGET_ENTITIES}}/g, entityList);
    }
    
    return query;
  }

  _evaluateValidationResults(results, rule) {
    const bindings = results.results?.bindings || [];
    
    switch (rule.type) {
      case 'existence':
        return bindings.length > 0;
      case 'absence':
        return bindings.length === 0;
      case 'count':
        return bindings.length >= (rule.minCount || 1);
      case 'uniqueness':
        const values = new Set(bindings.map(b => JSON.stringify(b)));
        return values.size === bindings.length;
      default:
        return bindings.length > 0;
    }
  }

  _generateQueryId() {
    return `sparql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _getCachedResult(query) {
    const cacheKey = require('crypto').createHash('md5').update(query).digest('hex');
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
      return cached.result;
    }
    
    // Remove expired entry
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return null;
  }

  _cacheResult(query, result) {
    const cacheKey = require('crypto').createHash('md5').update(query).digest('hex');
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Prevent memory leaks
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 100; i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }
  }

  _updateMetrics(context, executionTime, success) {
    const currentAvg = this.metrics.averageExecutionTime;
    const totalQueries = this.metrics.totalQueries;
    
    this.metrics.averageExecutionTime = 
      (currentAvg * (totalQueries - 1) + executionTime) / totalQueries;
    
    // Store query statistics
    this.queryStats.set(context.queryId, {
      executionTime,
      success,
      timestamp: Date.now()
    });
    
    // Limit stats size
    if (this.queryStats.size > 1000) {
      const entries = Array.from(this.queryStats.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 100; i++) {
        this.queryStats.delete(entries[i][0]);
      }
    }
  }

  initializeQueryTemplates() {
    // Impact Analysis Template
    this.queryTemplates.set('impact-analysis', {
      name: 'impact-analysis',
      description: 'Analyze impact of changes on related entities',
      category: 'analysis',
      parameters: [
        { name: 'entityUri', required: true, validation: /^https?:\/\// },
        { name: 'maxDepth', required: false, validation: /^\d+$/ },
        { name: 'limit', required: false, validation: /^\d+$/ }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?entity ?relationship ?impactLevel ?timestamp WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom|prov:wasInfluencedBy|^prov:wasInfluencedBy){1,{{maxDepth:5}}} ?entity .
          ?entity ?relationship <{{entityUri}}> .
          
          OPTIONAL { ?entity kgen:lastModified ?timestamp }
          
          # Calculate impact level based on relationship depth and frequency
          BIND(1.0 / ?depth AS ?impactLevel)
        }
        ORDER BY DESC(?impactLevel) ?timestamp
        LIMIT {{limit:1000}}
      `
    });

    // Forward Lineage Template
    this.queryTemplates.set('forward-lineage', {
      name: 'forward-lineage',
      description: 'Get forward lineage showing derived entities',
      category: 'provenance',
      parameters: [
        { name: 'entityUri', required: true, validation: /^https?:\/\// },
        { name: 'maxDepth', required: false, validation: /^\d+$/ },
        { name: 'limit', required: false, validation: /^\d+$/ }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity ?derivedEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> (^prov:wasDerivedFrom){1,{{maxDepth:10}}} ?derivedEntity .
          ?derivedEntity prov:wasDerivedFrom ?entity .
          ?derivedEntity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        }
        ORDER BY ?timestamp
        LIMIT {{limit:1000}}
      `
    });

    // Backward Lineage Template  
    this.queryTemplates.set('backward-lineage', {
      name: 'backward-lineage', 
      description: 'Get backward lineage showing source entities',
      category: 'provenance',
      parameters: [
        { name: 'entityUri', required: true, validation: /^https?:\/\// },
        { name: 'maxDepth', required: false, validation: /^\d+$/ },
        { name: 'limit', required: false, validation: /^\d+$/ }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity ?sourceEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom){1,{{maxDepth:10}}} ?sourceEntity .
          ?entity prov:wasDerivedFrom ?sourceEntity .
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit:1000}}
      `
    });

    // Bidirectional Lineage Template
    this.queryTemplates.set('bidirectional-lineage', {
      name: 'bidirectional-lineage',
      description: 'Get complete lineage in both directions',
      category: 'provenance', 
      parameters: [
        { name: 'entityUri', required: true, validation: /^https?:\/\// },
        { name: 'maxDepth', required: false, validation: /^\d+$/ },
        { name: 'limit', required: false, validation: /^\d+$/ }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity ?relatedEntity ?activity ?agent ?timestamp ?direction WHERE {
          {
            <{{entityUri}}> (prov:wasDerivedFrom){1,{{maxDepth:5}}} ?relatedEntity .
            ?entity prov:wasDerivedFrom ?relatedEntity .
            BIND("backward" AS ?direction)
          } UNION {
            <{{entityUri}}> (^prov:wasDerivedFrom){1,{{maxDepth:5}}} ?relatedEntity .
            ?relatedEntity prov:wasDerivedFrom ?entity .
            BIND("forward" AS ?direction)
          }
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        }
        ORDER BY ?direction ?timestamp
        LIMIT {{limit:2000}}
      `
    });

    console.log(`[SPARQL Engine] Initialized ${this.queryTemplates.size} query templates`);
  }
}

export default KgenSparqlEngine;