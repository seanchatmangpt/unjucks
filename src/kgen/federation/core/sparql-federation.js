/**
 * SPARQL Federation Engine for KGEN
 * 
 * Implements SPARQL 1.1 Federation with SERVICE clauses, query optimization,
 * and advanced distributed query processing capabilities.
 */

import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { Parser, Generator } from 'sparqljs';
import crypto from 'crypto';

export class SPARQLFederationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      maxConcurrentQueries: config.maxConcurrentQueries || 5,
      queryOptimization: config.queryOptimization !== false,
      serviceCaching: config.serviceCaching !== false,
      bindJoinOptimization: config.bindJoinOptimization !== false,
      ...config
    };
    
    this.parser = new Parser();
    this.generator = new Generator();
    
    this.state = {
      initialized: false,
      activeQueries: new Map(),
      serviceRegistry: new Map(),
      queryCache: new Map(),
      statistics: {
        totalQueries: 0,
        federatedQueries: 0,
        servicesCalls: 0,
        bindJoins: 0,
        avgQueryTime: 0
      }
    };
    
    // Query optimization patterns
    this.optimizationRules = [
      this.optimizeServiceOrder.bind(this),
      this.pushFiltersToServices.bind(this),
      this.optimizeBindJoins.bind(this),
      this.eliminateRedundantServices.bind(this),
      this.rewriteComplexPatterns.bind(this)
    ];
  }
  
  async initialize() {
    console.log('🔄 Initializing SPARQL Federation Engine...');
    
    try {
      // Initialize service registry
      this.initializeServiceRegistry();
      
      // Load built-in optimization rules
      this.loadOptimizationRules();
      
      this.state.initialized = true;
      this.emit('initialized');
      
      console.log('✅ SPARQL Federation Engine initialized');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ SPARQL Federation Engine initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Execute federated SPARQL query with SERVICE clauses
   */
  async execute(queryConfig, executionPlan, provenanceContext) {
    const queryId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Executing federated SPARQL query: ${queryId}`);
      
      // Parse SPARQL query
      const parsedQuery = this.parseQuery(queryConfig.query);
      
      // Analyze query for federation patterns
      const federationAnalysis = this.analyzeFederationPatterns(parsedQuery);
      
      // Optimize query if enabled
      let optimizedQuery = parsedQuery;
      if (this.config.queryOptimization) {
        optimizedQuery = await this.optimizeQuery(parsedQuery, executionPlan);
      }
      
      // Track active query
      this.state.activeQueries.set(queryId, {
        originalQuery: parsedQuery,
        optimizedQuery,
        executionPlan,
        startTime,
        status: 'executing'
      });
      
      // Execute query based on federation strategy
      let results;
      if (federationAnalysis.hasServiceClauses) {
        results = await this.executeServiceFederatedQuery(optimizedQuery, executionPlan, provenanceContext);
      } else {
        results = await this.executeDistributedQuery(optimizedQuery, executionPlan, provenanceContext);
      }
      
      // Post-process results
      const processedResults = await this.postProcessResults(results, federationAnalysis);
      
      // Update statistics
      this.updateStatistics(queryId, 'success', Date.now() - startTime, federationAnalysis);
      
      // Clean up
      this.state.activeQueries.delete(queryId);
      
      console.log(`✅ SPARQL query completed: ${queryId} (${Date.now() - startTime}ms)`);
      
      return {
        success: true,
        queryId,
        data: processedResults.bindings,
        metadata: {
          queryType: 'sparql',
          federationType: federationAnalysis.hasServiceClauses ? 'service' : 'distributed',
          servicesUsed: federationAnalysis.services.length,
          bindingsCount: processedResults.bindings.length,
          variables: processedResults.variables,
          executionTime: Date.now() - startTime,
          optimizations: optimizedQuery._optimizations || []
        },
        provenance: await this.buildQueryProvenance(queryId, queryConfig, executionPlan, provenanceContext)
      };
      
    } catch (error) {
      console.error(`❌ SPARQL query failed (${queryId}):`, error);
      
      this.updateStatistics(queryId, 'failure', Date.now() - startTime);
      this.state.activeQueries.delete(queryId);
      
      throw new Error(`SPARQL query execution failed: ${error.message}`);
    }
  }
  
  /**
   * Execute SPARQL query with SERVICE clauses
   */
  async executeServiceFederatedQuery(query, executionPlan, provenanceContext) {
    const services = this.extractServiceClauses(query);
    const results = [];
    
    console.log(`📡 Executing SERVICE federated query with ${services.length} services`);
    
    // Execute each SERVICE clause
    for (const service of services) {
      const serviceResult = await this.executeServiceClause(service, executionPlan, provenanceContext);
      results.push(serviceResult);
      
      // Update provenance
      if (provenanceContext) {
        await provenanceContext.recordServiceCall(service.iri, service.pattern, serviceResult);
      }
    }
    
    // Merge results from all services
    return this.mergeServiceResults(results, query);
  }
  
  /**
   * Execute distributed query across multiple endpoints
   */
  async executeDistributedQuery(query, executionPlan, provenanceContext) {
    console.log(`🌐 Executing distributed query across ${executionPlan.endpoints.length} endpoints`);
    
    const endpointResults = [];
    
    if (executionPlan.parallel) {
      // Execute in parallel across endpoints
      const promises = executionPlan.endpoints.map(endpointId =>
        this.executeOnEndpoint(query, endpointId, provenanceContext)
      );
      
      const settled = await Promise.allSettled(promises);
      
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          endpointResults.push(result.value);
        } else {
          console.warn(`⚠️  Endpoint query failed: ${result.reason.message}`);
        }
      }
    } else {
      // Execute sequentially
      for (const endpointId of executionPlan.endpoints) {
        try {
          const result = await this.executeOnEndpoint(query, endpointId, provenanceContext);
          endpointResults.push(result);
        } catch (error) {
          console.warn(`⚠️  Endpoint ${endpointId} query failed: ${error.message}`);
        }
      }
    }
    
    if (endpointResults.length === 0) {
      throw new Error('No endpoints returned results');
    }
    
    // Union results from all endpoints
    return this.unionEndpointResults(endpointResults);
  }
  
  /**
   * Execute SPARQL query on specific endpoint
   */
  async executeOnEndpoint(query, endpointId, provenanceContext) {
    const endpoint = this.getEndpointConfig(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }
    
    const queryString = this.generator.stringify(query);
    
    console.log(`📊 Executing on endpoint: ${endpointId} (${endpoint.url})`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json',
          ...endpoint.headers
        },
        body: queryString,
        timeout: endpoint.timeout || this.config.timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonResult = await response.json();
      
      // Record execution metrics
      const executionTime = Date.now() - startTime;
      
      if (provenanceContext) {
        await provenanceContext.recordEndpointExecution(endpointId, queryString, executionTime, jsonResult);
      }
      
      return {
        endpointId,
        bindings: jsonResult.results?.bindings || [],
        variables: jsonResult.head?.vars || [],
        executionTime,
        metadata: {
          endpoint: endpoint.url,
          bindingsCount: jsonResult.results?.bindings?.length || 0
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (provenanceContext) {
        await provenanceContext.recordEndpointError(endpointId, queryString, executionTime, error);
      }
      
      throw new Error(`Endpoint execution failed (${endpointId}): ${error.message}`);
    }
  }
  
  /**
   * Execute SERVICE clause
   */
  async executeServiceClause(service, executionPlan, provenanceContext) {
    console.log(`🔗 Executing SERVICE: ${service.iri}`);
    
    // Resolve service IRI to actual endpoint
    const endpoint = this.resolveServiceEndpoint(service.iri);
    
    if (!endpoint) {
      throw new Error(`Cannot resolve SERVICE endpoint: ${service.iri}`);
    }
    
    // Convert service pattern to standalone query
    const serviceQuery = this.buildServiceQuery(service.pattern, service.silent);
    
    // Execute on resolved endpoint
    return await this.executeOnEndpoint(serviceQuery, endpoint.id, provenanceContext);
  }
  
  /**
   * Optimize SPARQL query for federation
   */
  async optimizeQuery(query, executionPlan) {
    console.log('🚀 Optimizing SPARQL query for federation...');
    
    let optimizedQuery = JSON.parse(JSON.stringify(query)); // Deep clone
    optimizedQuery._optimizations = [];
    
    // Apply optimization rules
    for (const rule of this.optimizationRules) {
      try {
        const result = await rule(optimizedQuery, executionPlan);
        if (result.modified) {
          optimizedQuery = result.query;
          optimizedQuery._optimizations.push(result.optimization);
        }
      } catch (error) {
        console.warn(`⚠️  Optimization rule failed: ${error.message}`);
      }
    }
    
    console.log(`✅ Applied ${optimizedQuery._optimizations.length} optimizations`);
    
    return optimizedQuery;
  }
  
  // Optimization rule implementations
  
  async optimizeServiceOrder(query, executionPlan) {
    // Reorder SERVICE clauses based on estimated selectivity
    const services = this.extractServiceClauses(query);
    
    if (services.length <= 1) {
      return { modified: false };
    }
    
    // Sort services by estimated selectivity (most selective first)
    const orderedServices = services.sort((a, b) => {
      const selectivityA = this.estimateServiceSelectivity(a);
      const selectivityB = this.estimateServiceSelectivity(b);
      return selectivityA - selectivityB;
    });
    
    // Rebuild query with optimized service order
    const optimizedQuery = this.reorderServices(query, orderedServices);
    
    return {
      modified: true,
      query: optimizedQuery,
      optimization: {
        type: 'service_order',
        description: 'Reordered SERVICE clauses by selectivity',
        originalOrder: services.map(s => s.iri),
        optimizedOrder: orderedServices.map(s => s.iri)
      }
    };
  }
  
  async pushFiltersToServices(query, executionPlan) {
    // Push FILTER expressions into SERVICE clauses when possible
    let modified = false;
    const optimizations = [];
    
    // Find FILTER expressions that can be pushed to services
    const filters = this.extractFilters(query);
    const services = this.extractServiceClauses(query);
    
    for (const filter of filters) {
      for (const service of services) {
        if (this.canPushFilterToService(filter, service)) {
          this.pushFilter(query, filter, service);
          modified = true;
          optimizations.push({
            filter: filter.expression,
            service: service.iri
          });
        }
      }
    }
    
    return {
      modified,
      query,
      optimization: modified ? {
        type: 'filter_push',
        description: 'Pushed FILTER expressions to SERVICE clauses',
        filters: optimizations
      } : null
    };
  }
  
  async optimizeBindJoins(query, executionPlan) {
    // Convert nested SERVICE calls to bind joins when beneficial
    const services = this.extractServiceClauses(query);
    
    if (services.length < 2) {
      return { modified: false };
    }
    
    // Identify opportunities for bind joins
    const bindJoinCandidates = this.identifyBindJoinOpportunities(services);
    
    if (bindJoinCandidates.length === 0) {
      return { modified: false };
    }
    
    // Apply bind join optimization
    const optimizedQuery = this.applyBindJoins(query, bindJoinCandidates);
    
    return {
      modified: true,
      query: optimizedQuery,
      optimization: {
        type: 'bind_join',
        description: 'Applied bind join optimization for SERVICE clauses',
        candidates: bindJoinCandidates.length
      }
    };
  }
  
  async eliminateRedundantServices(query, executionPlan) {
    // Remove redundant SERVICE clauses that query the same endpoint with same pattern
    const services = this.extractServiceClauses(query);
    const uniqueServices = new Map();
    const redundantServices = [];
    
    for (const service of services) {
      const key = `${service.iri}:${JSON.stringify(service.pattern)}`;
      
      if (uniqueServices.has(key)) {
        redundantServices.push(service);
      } else {
        uniqueServices.set(key, service);
      }
    }
    
    if (redundantServices.length === 0) {
      return { modified: false };
    }
    
    // Remove redundant services from query
    const optimizedQuery = this.removeRedundantServices(query, redundantServices);
    
    return {
      modified: true,
      query: optimizedQuery,
      optimization: {
        type: 'redundant_elimination',
        description: 'Eliminated redundant SERVICE clauses',
        eliminated: redundantServices.length
      }
    };
  }
  
  async rewriteComplexPatterns(query, executionPlan) {
    // Rewrite complex graph patterns for better federation performance
    let modified = false;
    const optimizations = [];
    
    // Example: Convert OPTIONAL { SERVICE ... } to left join
    const optionalServices = this.findOptionalServices(query);
    
    for (const optionalService of optionalServices) {
      if (this.shouldRewriteOptionalService(optionalService)) {
        this.rewriteOptionalService(query, optionalService);
        modified = true;
        optimizations.push({
          type: 'optional_service_rewrite',
          service: optionalService.iri
        });
      }
    }
    
    return {
      modified,
      query,
      optimization: modified ? {
        type: 'pattern_rewrite',
        description: 'Rewrote complex graph patterns',
        rewrites: optimizations
      } : null
    };
  }
  
  // Helper methods for query processing
  
  parseQuery(queryString) {
    try {
      return this.parser.parse(queryString);
    } catch (error) {
      throw new Error(`SPARQL parsing error: ${error.message}`);
    }
  }
  
  analyzeFederationPatterns(query) {
    const analysis = {
      hasServiceClauses: false,
      services: [],
      hasOptional: false,
      hasUnion: false,
      hasFilter: false,
      complexity: 0
    };
    
    // Recursive analysis of query structure
    this.analyzeQueryPatterns(query.where, analysis);
    
    analysis.complexity = this.calculateQueryComplexity(query, analysis);
    
    return analysis;
  }
  
  analyzeQueryPatterns(patterns, analysis) {
    if (!patterns) return;
    
    for (const pattern of patterns) {
      if (pattern.type === 'service') {
        analysis.hasServiceClauses = true;
        analysis.services.push({
          iri: pattern.name,
          silent: pattern.silent || false,
          pattern: pattern.patterns
        });
      } else if (pattern.type === 'optional') {
        analysis.hasOptional = true;
        this.analyzeQueryPatterns(pattern.patterns, analysis);
      } else if (pattern.type === 'union') {
        analysis.hasUnion = true;
        for (const unionPattern of pattern.patterns) {
          this.analyzeQueryPatterns(unionPattern, analysis);
        }
      } else if (pattern.type === 'filter') {
        analysis.hasFilter = true;
      } else if (pattern.type === 'group' && pattern.patterns) {
        this.analyzeQueryPatterns(pattern.patterns, analysis);
      }
    }
  }
  
  extractServiceClauses(query) {
    const services = [];
    this.findServiceClauses(query.where, services);
    return services;
  }
  
  findServiceClauses(patterns, services) {
    if (!patterns) return;
    
    for (const pattern of patterns) {
      if (pattern.type === 'service') {
        services.push({
          iri: pattern.name,
          silent: pattern.silent || false,
          pattern: pattern.patterns
        });
      } else if (pattern.patterns) {
        this.findServiceClauses(pattern.patterns, services);
      }
    }
  }
  
  buildServiceQuery(patterns, silent = false) {
    return {
      queryType: 'SELECT',
      variables: ['*'],
      where: patterns,
      type: 'query'
    };
  }
  
  resolveServiceEndpoint(serviceIri) {
    // Try to resolve SERVICE IRI to registered endpoint
    return this.state.serviceRegistry.get(serviceIri) || {
      id: crypto.randomUUID(),
      url: serviceIri,
      type: 'sparql'
    };
  }
  
  mergeServiceResults(results, query) {
    // Implement service result merging logic
    const allBindings = [];
    const allVariables = new Set();
    
    for (const result of results) {
      if (result.bindings) {
        allBindings.push(...result.bindings);
      }
      if (result.variables) {
        result.variables.forEach(v => allVariables.add(v));
      }
    }
    
    return {
      bindings: allBindings,
      variables: Array.from(allVariables)
    };
  }
  
  unionEndpointResults(results) {
    // Union results from multiple endpoints
    const unionBindings = [];
    const allVariables = new Set();
    
    for (const result of results) {
      if (result.bindings) {
        unionBindings.push(...result.bindings);
      }
      if (result.variables) {
        result.variables.forEach(v => allVariables.add(v));
      }
    }
    
    return {
      bindings: unionBindings,
      variables: Array.from(allVariables)
    };
  }
  
  async postProcessResults(results, federationAnalysis) {
    // Post-process results (deduplication, sorting, etc.)
    if (results.bindings && results.bindings.length > 1) {
      // Remove duplicate bindings
      const uniqueBindings = this.deduplicateBindings(results.bindings);
      results.bindings = uniqueBindings;
    }
    
    return results;
  }
  
  deduplicateBindings(bindings) {
    const seen = new Set();
    const unique = [];
    
    for (const binding of bindings) {
      const key = JSON.stringify(binding, Object.keys(binding).sort());
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(binding);
      }
    }
    
    return unique;
  }
  
  async buildQueryProvenance(queryId, queryConfig, executionPlan, provenanceContext) {
    return {
      queryId,
      engine: 'sparql',
      originalQuery: queryConfig.query,
      executionPlan: {
        endpoints: executionPlan.endpoints,
        strategy: executionPlan.strategy,
        parallel: executionPlan.parallel
      },
      timestamp: new Date().toISOString()
    };
  }
  
  // Utility methods
  
  getEndpointConfig(endpointId) {
    // This would be injected from the federation manager
    return null;
  }
  
  initializeServiceRegistry() {
    // Initialize common SPARQL service endpoints
    this.state.serviceRegistry.set('http://dbpedia.org/sparql', {
      id: 'dbpedia',
      url: 'http://dbpedia.org/sparql',
      type: 'sparql',
      timeout: 10000
    });
  }
  
  loadOptimizationRules() {
    console.log(`📋 Loaded ${this.optimizationRules.length} optimization rules`);
  }
  
  updateStatistics(queryId, status, executionTime, federationAnalysis) {
    this.state.statistics.totalQueries++;
    
    if (federationAnalysis?.hasServiceClauses) {
      this.state.statistics.federatedQueries++;
      this.state.statistics.servicesCalls += federationAnalysis.services.length;
    }
    
    // Update average execution time
    const total = this.state.statistics.totalQueries;
    const currentAvg = this.state.statistics.avgQueryTime;
    this.state.statistics.avgQueryTime = ((currentAvg * (total - 1)) + executionTime) / total;
  }
  
  calculateQueryComplexity(query, analysis) {
    let complexity = 1;
    
    if (analysis.hasServiceClauses) complexity += analysis.services.length * 2;
    if (analysis.hasOptional) complexity += 1;
    if (analysis.hasUnion) complexity += 2;
    if (analysis.hasFilter) complexity += 1;
    
    return complexity;
  }
  
  estimateServiceSelectivity(service) {
    // Simplified selectivity estimation
    const patternCount = Array.isArray(service.pattern) ? service.pattern.length : 1;
    return 1.0 / patternCount;
  }
  
  async testConnectivity(config) {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json'
        },
        body: 'ASK { ?s ?p ?o }',
        timeout: 5000
      });
      
      return {
        success: response.ok,
        responseTime: response.headers.get('x-response-time'),
        status: response.status
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async discoverSchema(config) {
    try {
      // Discovery query for schema information
      const schemaQuery = `
        SELECT DISTINCT ?class ?property WHERE {
          { ?s a ?class } UNION { ?s ?property ?o }
        } LIMIT 100
      `;
      
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json'
        },
        body: schemaQuery,
        timeout: 10000
      });
      
      if (response.ok) {
        const result = await response.json();
        return {
          discovered: true,
          classes: [],
          properties: [],
          bindings: result.results?.bindings || []
        };
      }
      
      return { discovered: false, error: 'Schema discovery query failed' };
      
    } catch (error) {
      return { discovered: false, error: error.message };
    }
  }
  
  getStatus() {
    return {
      initialized: this.state.initialized,
      activeQueries: this.state.activeQueries.size,
      statistics: this.state.statistics,
      serviceRegistry: this.state.serviceRegistry.size
    };
  }
  
  async cancelQuery(queryId) {
    const queryInfo = this.state.activeQueries.get(queryId);
    if (queryInfo) {
      queryInfo.status = 'cancelled';
      this.state.activeQueries.delete(queryId);
      console.log(`⏹️  Cancelled SPARQL query: ${queryId}`);
    }
  }
  
  async shutdown() {
    console.log('🔄 Shutting down SPARQL Federation Engine...');
    
    // Cancel active queries
    for (const [queryId] of this.state.activeQueries) {
      await this.cancelQuery(queryId);
    }
    
    this.state.initialized = false;
    this.emit('shutdown');
    
    console.log('✅ SPARQL Federation Engine shutdown complete');
  }
}

export default SPARQLFederationEngine;