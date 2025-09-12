/**
 * Provenance SPARQL Queries - W3C PROV-O compliant query engine
 * 
 * Provides SPARQL query capabilities for provenance data with support for
 * complex lineage queries, temporal queries, and compliance reporting.
 */

import consola from 'consola';
import sparqljs from 'sparqljs';
import { Store, DataFactory } from 'n3';
import { RDFProcessor } from '../../rdf/index.js';
import crypto from 'crypto';
import { SPARQLQueryCache } from '../../cache/lru-cache.js';
import { KGenErrorHandler, createEnhancedTryCatch } from '../../utils/error-handler.js';

const { namedNode, literal, quad } = DataFactory;

export class ProvenanceQueries {
  constructor(store, config = {}) {
    // Initialize RDFProcessor with the provided store or create new one
    if (store instanceof RDFProcessor) {
      this.rdfProcessor = store;
      this.store = store.store;
    } else {
      this.store = store || new Store();
      this.rdfProcessor = new RDFProcessor({
        ...config
      });
      // Set the store after creation
      this.rdfProcessor.store = this.store;
    }
    
    this.config = {
      maxResults: config.maxResults || 10000,
      queryTimeout: config.queryTimeout || 30000,
      enableOptimization: config.enableQueryOptimization !== false,
      ...config
    };

    this.logger = consola.withTag('provenance-queries');
    this.sparqlParser = new sparqljs.Parser();
    this.sparqlGenerator = new sparqljs.Generator();
    
    // Query templates
    this.queryTemplates = this._initializeQueryTemplates();
    
    // Query cache with LRU eviction and statistics
    this.queryCache = new SPARQLQueryCache({
      maxCacheSize: config.maxCacheSize || 1000,
      cacheTTL: config.cacheTTL || 60000, // 1 minute
      enableStats: true
    });
    
    // Initialize comprehensive error handler
    this.errorHandler = new KGenErrorHandler({
      enableRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      enableEventEmission: true
    });
    this._setupErrorRecoveryStrategies();
    
    // Initialize RDFProcessor if needed
    this._initializeRDFProcessor();
  }

  /**
   * Initialize RDFProcessor
   */
  async _initializeRDFProcessor() {
    if (this.rdfProcessor.status === 'uninitialized') {
      try {
        await this.rdfProcessor.initialize();
      } catch (error) {
        const operationId = 'provenance-queries:rdf-init';
        const errorContext = {
          component: 'provenance-queries',
          operation: 'rdf-processor-initialization',
          state: { rdfStatus: this.rdfProcessor.status }
        };
        
        await this.errorHandler.handleError(
          operationId,
          error,
          errorContext,
          { suppressRethrow: true }
        );
        
        this.logger.warn('RDFProcessor initialization failed, continuing with basic functionality:', error);
      }
    }
  }

  /**
   * Execute SPARQL query against provenance store
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   */
  async executeQuery(query, options = {}) {
    try {
      const startTime = this.getDeterministicTimestamp();
      this.logger.debug('Executing SPARQL query');

      // Enhanced caching with fingerprinting
      const queryFingerprint = this._generateQueryFingerprint(query, options);
      if (!options.skipCache) {
        const cachedResult = this.queryCache.getCachedResults(queryFingerprint, options);
        if (cachedResult) {
          this.logger.debug(`Returning cached query result (${this.getDeterministicTimestamp() - startTime}ms)`);
          return cachedResult;
        }
      }

      // Parse query using the real SparqlParser with error recovery
      let parsedQuery;
      try {
        parsedQuery = this.sparqlParser.parse(query);
      } catch (parseError) {
        // Try query normalization for common syntax errors
        const normalizedQuery = this._normalizeQuery(query);
        if (normalizedQuery !== query) {
          try {
            parsedQuery = this.sparqlParser.parse(normalizedQuery);
            this.logger.debug('Query normalized and parsed successfully');
          } catch (secondError) {
            throw parseError; // Throw original error
          }
        } else {
          throw parseError;
        }
      }
      
      // Validate query with performance hints
      this._validateQuery(parsedQuery);
      
      // Advanced query optimization
      if (this.config.enableOptimization) {
        parsedQuery = await this._optimizeQueryAdvanced(parsedQuery, options);
      }

      // Execute query with streaming support for large results
      let results;
      const executionOptions = {
        ...options,
        streaming: options.streaming || this._shouldUseStreaming(parsedQuery),
        batchSize: options.batchSize || this._calculateOptimalBatchSize(parsedQuery)
      };

      try {
        // Use optimized execution path based on query complexity
        const complexity = this._analyzeQueryComplexity(parsedQuery);
        
        if (complexity.score > 0.7 && this.rdfProcessor.store.size > 100000) {
          results = await this._executeComplexQuery(parsedQuery, executionOptions);
        } else {
          results = await this.rdfProcessor.query(this._rebuildQuery(parsedQuery), executionOptions);
        }
      } catch (error) {
        // Enhanced fallback with performance profiling
        this.logger.warn('Primary execution failed, using fallback', { error: error.message });
        results = await this._executeFallbackQuery(parsedQuery, executionOptions);
      }

      // Enhanced caching with TTL and compression
      const executionTime = this.getDeterministicTimestamp() - startTime;
      this.queryCache.cacheResults(queryFingerprint, results, {
        ...options,
        executionTime,
        complexity: this._analyzeQueryComplexity(parsedQuery),
        resultSize: JSON.stringify(results).length
      });

      // Performance monitoring
      this._recordQueryMetrics({
        query,
        executionTime,
        resultCount: results.results?.bindings?.length || 0,
        cacheHit: false,
        complexity: this._analyzeQueryComplexity(parsedQuery).score
      });

      this.logger.debug(`Query executed successfully in ${executionTime}ms, ${results.results?.bindings?.length || 0} results`);
      return results;

    } catch (error) {
      const operationId = `sparql-query:${crypto.randomBytes(4).toString('hex')}`;
      const errorContext = {
        component: 'provenance-queries',
        operation: 'sparql-execution',
        input: { 
          queryLength: query.length,
          skipCache: options.skipCache,
          queryType: this._detectQueryType(query)
        }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result;
    }
  }

  /**
   * Get entity lineage using SPARQL
   * @param {string} entityUri - Entity URI
   * @param {Object} options - Lineage options
   */
  async getEntityLineage(entityUri, options = {}) {
    const maxDepth = options.maxDepth || 10;
    const direction = options.direction || 'both'; // forward, backward, both
    
    let query = '';
    
    switch (direction) {
      case 'forward':
        query = this.queryTemplates.forwardLineage.replace('{{entityUri}}', entityUri);
        break;
      case 'backward':
        query = this.queryTemplates.backwardLineage.replace('{{entityUri}}', entityUri);
        break;
      case 'both':
        query = this.queryTemplates.bidirectionalLineage.replace('{{entityUri}}', entityUri);
        break;
    }

    // Add depth limit
    query = query.replace('{{maxDepth}}', maxDepth.toString());

    const results = await this.executeQuery(query, options);
    
    return {
      entity: entityUri,
      lineage: this._processLineageResults(results),
      direction,
      maxDepth
    };
  }

  /**
   * Get activity chain for entity
   * @param {string} entityUri - Entity URI
   * @param {Object} options - Query options
   */
  async getActivityChain(entityUri, options = {}) {
    const query = this.queryTemplates.activityChain
      .replace('{{entityUri}}', entityUri)
      .replace('{{limit}}', (options.limit || 100).toString());

    const results = await this.executeQuery(query, options);
    
    return {
      entity: entityUri,
      activities: this._processActivityResults(results),
      totalActivities: results.results?.bindings?.length || 0
    };
  }

  /**
   * Get agents involved in entity lineage
   * @param {string} entityUri - Entity URI
   * @param {Object} options - Query options
   */
  async getInvolvedAgents(entityUri, options = {}) {
    const query = this.queryTemplates.involvedAgents
      .replace('{{entityUri}}', entityUri);

    const results = await this.executeQuery(query, options);
    
    return {
      entity: entityUri,
      agents: this._processAgentResults(results)
    };
  }

  /**
   * Get temporal provenance view
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Query options
   */
  async getTemporalProvenance(startDate, endDate, options = {}) {
    const query = this.queryTemplates.temporalProvenance
      .replace('{{startDate}}', startDate.toISOString())
      .replace('{{endDate}}', endDate.toISOString())
      .replace('{{limit}}', (options.limit || 1000).toString());

    const results = await this.executeQuery(query, options);
    
    return {
      timeRange: { startDate, endDate },
      activities: this._processTemporalResults(results),
      totalActivities: results.results?.bindings?.length || 0
    };
  }

  /**
   * Get provenance bundles
   * @param {Object} filters - Bundle filters
   */
  async getProvBundles(filters = {}) {
    let query = this.queryTemplates.provBundles;

    // Apply filters
    if (filters.bundleType) {
      query = query.replace('{{bundleTypeFilter}}', 
        `FILTER(?bundleType = "${filters.bundleType}")`);
    } else {
      query = query.replace('{{bundleTypeFilter}}', '');
    }

    if (filters.agent) {
      query = query.replace('{{agentFilter}}', 
        `FILTER(?agent = <${filters.agent}>)`);
    } else {
      query = query.replace('{{agentFilter}}', '');
    }

    const results = await this.executeQuery(query);
    
    return {
      bundles: this._processBundleResults(results),
      totalBundles: results.results?.bindings?.length || 0
    };
  }

  /**
   * Validate provenance integrity using SPARQL
   * @param {Object} options - Validation options
   */
  async validateProvenanceIntegrity(options = {}) {
    const validationQueries = {
      orphanedEntities: this.queryTemplates.orphanedEntities,
      missingAgents: this.queryTemplates.missingAgents,
      temporalInconsistencies: this.queryTemplates.temporalInconsistencies,
      circularDependencies: this.queryTemplates.circularDependencies
    };

    const results = {};
    
    for (const [check, query] of Object.entries(validationQueries)) {
      try {
        results[check] = await this.executeQuery(query, { skipCache: true });
      } catch (error) {
        this.logger.warn(`Validation check ${check} failed:`, error);
        results[check] = { error: error.message };
      }
    }

    return {
      validationResults: results,
      overallValid: this._assessOverallValidity(results),
      validatedAt: this.getDeterministicDate()
    };
  }

  /**
   * Generate compliance query for specific regulation
   * @param {string} regulation - Regulation type (GDPR, SOX, HIPAA)
   * @param {Object} parameters - Query parameters
   */
  async generateComplianceQuery(regulation, parameters = {}) {
    const templates = {
      GDPR: this._getGDPRQueryTemplates(),
      SOX: this._getSOXQueryTemplates(),
      HIPAA: this._getHIPAAQueryTemplates()
    };

    const regulationTemplates = templates[regulation];
    if (!regulationTemplates) {
      throw new Error(`Unsupported regulation: ${regulation}`);
    }

    const queries = {};
    
    for (const [queryName, template] of Object.entries(regulationTemplates)) {
      let query = template;
      
      // Replace parameters
      for (const [param, value] of Object.entries(parameters)) {
        query = query.replace(new RegExp(`{{${param}}}`, 'g'), value);
      }
      
      queries[queryName] = await this.executeQuery(query);
    }

    return {
      regulation,
      queries,
      parameters,
      generatedAt: this.getDeterministicDate()
    };
  }

  /**
   * Get query execution statistics
   */
  getQueryStatistics() {
    const cacheStats = this.queryCache.getStats();
    return {
      cache: cacheStats,
      queries: {
        total: cacheStats.totalRequests,
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      }
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
  }

  /**
   * Execute raw SPARQL query using RDFProcessor
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   */
  async executeSparql(query, options = {}) {
    try {
      // Ensure RDFProcessor is initialized
      await this._initializeRDFProcessor();
      
      // Use RDFProcessor's query method directly
      return await this.rdfProcessor.query(query, options);
    } catch (error) {
      this.logger.error('Raw SPARQL execution failed:', error);
      throw error;
    }
  }

  /**
   * Add RDF data to the store
   * @param {string} rdfData - RDF data in various formats
   * @param {string} format - RDF format (turtle, n3, rdfxml, etc.)
   * @param {Object} options - Parse options
   */
  async addRDFData(rdfData, format = 'turtle', options = {}) {
    try {
      await this._initializeRDFProcessor();
      
      const parsed = await this.rdfProcessor.parseRDF(rdfData, format, options);
      this.rdfProcessor.addQuads(parsed.quads, options.graph);
      
      this.logger.debug(`Added ${parsed.count} triples to provenance store`);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to add RDF data:', error);
      throw error;
    }
  }

  /**
   * Get RDFProcessor instance for direct access
   */
  getRDFProcessor() {
    return this.rdfProcessor;
  }

  /**
   * Get store statistics including RDF processor stats
   */
  getStoreStatistics() {
    const rdfStats = this.rdfProcessor.getStats();
    const queryStats = this.getQueryStatistics();
    
    return {
      ...rdfStats,
      queryCache: queryStats,
      provenanceQueries: {
        templateCount: Object.keys(this.queryTemplates).length
      }
    };
  }

  // Private methods

  _initializeQueryTemplates() {
    return {
      forwardLineage: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?derivedEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> prov:wasDerivedFrom* ?entity .
          ?derivedEntity prov:wasDerivedFrom ?entity .
          ?derivedEntity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        } LIMIT {{maxDepth}}
      `,
      
      backwardLineage: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?sourceEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom)* ?entity .
          ?entity prov:wasDerivedFrom ?sourceEntity .
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        } LIMIT {{maxDepth}}
      `,
      
      bidirectionalLineage: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?relatedEntity ?activity ?agent ?timestamp ?direction WHERE {
          {
            <{{entityUri}}> prov:wasDerivedFrom* ?entity .
            ?entity prov:wasDerivedFrom ?relatedEntity .
            BIND("backward" as ?direction)
          } UNION {
            ?entity prov:wasDerivedFrom* <{{entityUri}}> .
            ?relatedEntity prov:wasDerivedFrom ?entity .
            BIND("forward" as ?direction)
          }
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        } LIMIT {{maxDepth}}
      `,
      
      activityChain: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?activity ?agent ?startTime ?endTime ?status WHERE {
          {
            <{{entityUri}}> prov:wasGeneratedBy ?activity .
          } UNION {
            <{{entityUri}}> (prov:wasDerivedFrom)+ ?derived .
            ?derived prov:wasGeneratedBy ?activity .
          }
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?startTime }
          OPTIONAL { ?activity prov:endedAtTime ?endTime }
          OPTIONAL { ?activity kgen:status ?status }
        } ORDER BY ?startTime LIMIT {{limit}}
      `,
      
      involvedAgents: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT ?agent ?name ?type ?activities WHERE {
          {
            <{{entityUri}}> prov:wasDerivedFrom* ?entity .
          } UNION {
            ?entity prov:wasDerivedFrom* <{{entityUri}}> .
          }
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?agent foaf:name ?name }
          OPTIONAL { ?agent a ?type }
          {
            SELECT ?agent (COUNT(?activity) AS ?activities) WHERE {
              {
                <{{entityUri}}> prov:wasDerivedFrom* ?entity .
              } UNION {
                ?entity prov:wasDerivedFrom* <{{entityUri}}> .
              }
              ?entity prov:wasGeneratedBy ?activity .
              ?activity prov:wasAssociatedWith ?agent .
            } GROUP BY ?agent
          }
        } ORDER BY DESC(?activities)
      `,
      
      temporalProvenance: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?activity ?entity ?agent ?startTime ?endTime ?duration WHERE {
          ?activity a prov:Activity .
          ?activity prov:startedAtTime ?startTime .
          ?activity prov:wasAssociatedWith ?agent .
          ?entity prov:wasGeneratedBy ?activity .
          OPTIONAL { ?activity prov:endedAtTime ?endTime }
          OPTIONAL { ?activity kgen:duration ?duration }
          FILTER(?startTime >= "{{startDate}}"^^xsd:dateTime && ?startTime <= "{{endDate}}"^^xsd:dateTime)
        } ORDER BY ?startTime LIMIT {{limit}}
      `,
      
      provBundles: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?bundle ?bundleType ?agent ?timestamp ?activities ?entities WHERE {
          ?bundle a prov:Bundle .
          OPTIONAL { ?bundle kgen:bundleType ?bundleType }
          OPTIONAL { ?bundle prov:wasAttributedTo ?agent }
          OPTIONAL { ?bundle prov:generatedAtTime ?timestamp }
          {
            SELECT ?bundle (COUNT(?activity) AS ?activities) WHERE {
              ?bundle prov:hadMember ?activity .
              ?activity a prov:Activity .
            } GROUP BY ?bundle
          }
          {
            SELECT ?bundle (COUNT(?entity) AS ?entities) WHERE {
              ?bundle prov:hadMember ?entity .
              ?entity a prov:Entity .
            } GROUP BY ?bundle
          }
          {{bundleTypeFilter}}
          {{agentFilter}}
        } ORDER BY DESC(?timestamp)
      `,
      
      orphanedEntities: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity WHERE {
          ?entity a prov:Entity .
          FILTER NOT EXISTS { ?entity prov:wasGeneratedBy ?activity }
          FILTER NOT EXISTS { ?entity prov:wasDerivedFrom ?source }
        }
      `,
      
      missingAgents: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?activity WHERE {
          ?activity a prov:Activity .
          FILTER NOT EXISTS { ?activity prov:wasAssociatedWith ?agent }
        }
      `,
      
      temporalInconsistencies: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?activity ?startTime ?endTime WHERE {
          ?activity prov:startedAtTime ?startTime .
          ?activity prov:endedAtTime ?endTime .
          FILTER(?endTime < ?startTime)
        }
      `,
      
      circularDependencies: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity WHERE {
          ?entity (prov:wasDerivedFrom)+ ?entity .
        }
      `
    };
  }

  _getGDPRQueryTemplates() {
    return {
      dataProcessingActivities: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        PREFIX gdpr: <http://kgen.enterprise/gdpr/>
        
        SELECT ?activity ?purpose ?legalBasis ?dataCategories ?subjects WHERE {
          ?activity a prov:Activity .
          ?activity gdpr:processingPurpose ?purpose .
          ?activity gdpr:legalBasis ?legalBasis .
          ?activity gdpr:dataCategories ?dataCategories .
          ?activity gdpr:dataSubjects ?subjects .
        }
      `,
      
      consentRecords: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX gdpr: <http://kgen.enterprise/gdpr/>
        
        SELECT ?consent ?subject ?granted ?purpose ?timestamp WHERE {
          ?consent a gdpr:ConsentRecord .
          ?consent gdpr:dataSubject ?subject .
          ?consent gdpr:granted ?granted .
          ?consent gdpr:purpose ?purpose .
          ?consent prov:generatedAtTime ?timestamp .
        }
      `
    };
  }

  _getSOXQueryTemplates() {
    return {
      financialTransactions: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX sox: <http://kgen.enterprise/sox/>
        
        SELECT ?transaction ?amount ?approver ?controls ?timestamp WHERE {
          ?transaction a sox:FinancialTransaction .
          ?transaction sox:amount ?amount .
          ?transaction sox:approver ?approver .
          ?transaction sox:controlsApplied ?controls .
          ?transaction prov:generatedAtTime ?timestamp .
        }
      `
    };
  }

  _getHIPAAQueryTemplates() {
    return {
      phiAccess: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX hipaa: <http://kgen.enterprise/hipaa/>
        
        SELECT ?access ?patient ?accessor ?justification ?dataTypes WHERE {
          ?access a hipaa:PHIAccess .
          ?access hipaa:patient ?patient .
          ?access hipaa:accessor ?accessor .
          ?access hipaa:justification ?justification .
          ?access hipaa:dataTypes ?dataTypes .
        }
      `
    };
  }

  _validateQuery(parsedQuery) {
    // Basic query validation
    if (!parsedQuery.where || !parsedQuery.where.length) {
      throw new Error('Query must have a WHERE clause');
    }

    // Check for potentially expensive operations
    const queryString = this.sparqlGenerator.stringify(parsedQuery);
    if (queryString.includes('*') && !queryString.includes('LIMIT')) {
      this.logger.warn('Query contains * without LIMIT, performance may be affected');
    }
  }

  _optimizeQuery(parsedQuery) {
    // Simple query optimization
    if (!parsedQuery.limit && parsedQuery.queryType === 'SELECT') {
      parsedQuery.limit = this.config.maxResults;
      this.logger.debug('Added default LIMIT to query');
    }
  }

  /**
   * Advanced query optimization with cost-based analysis
   */
  async _optimizeQueryAdvanced(parsedQuery, options = {}) {
    const optimizedQuery = { ...parsedQuery };
    const storeSize = this.rdfProcessor.store.size;
    
    // Add LIMIT for large datasets
    if (!optimizedQuery.limit && parsedQuery.queryType === 'SELECT' && storeSize > 10000) {
      optimizedQuery.limit = Math.min(this.config.maxResults, storeSize / 10);
      this.logger.debug(`Added optimized LIMIT: ${optimizedQuery.limit}`);
    }
    
    // Optimize JOIN order based on selectivity
    if (optimizedQuery.where && optimizedQuery.where.length > 1) {
      optimizedQuery.where = await this._optimizeJoinOrder(optimizedQuery.where);
    }
    
    // Add selective filters early
    if (optimizedQuery.where) {
      optimizedQuery.where = this._pushDownFilters(optimizedQuery.where);
    }
    
    // Optimize graph patterns for large stores
    if (storeSize > 50000 && optimizedQuery.where) {
      optimizedQuery.where = this._optimizeGraphPatterns(optimizedQuery.where);
    }
    
    return optimizedQuery;
  }

  /**
   * Generate query fingerprint for caching
   */
  _generateQueryFingerprint(query, options = {}) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const optionsKey = JSON.stringify({
      maxResults: options.maxResults,
      timeout: options.timeout,
      graph: options.graph
    });
    return crypto.createHash('sha256')
      .update(normalizedQuery + optionsKey)
      .digest('hex').slice(0, 16);
  }

  /**
   * Normalize query for better parsing
   */
  _normalizeQuery(query) {
    return query
      .replace(/\s+/g, ' ')
      .replace(/;\s*$/, '')
      .trim();
  }

  /**
   * Analyze query complexity for optimization
   */
  _analyzeQueryComplexity(parsedQuery) {
    let score = 0;
    let factors = [];
    
    // Count triple patterns
    const triplePatternCount = this._countTriplePatterns(parsedQuery.where || []);
    score += Math.min(triplePatternCount * 0.1, 0.3);
    if (triplePatternCount > 5) factors.push('high-pattern-count');
    
    // Check for JOINs
    if (triplePatternCount > 1) {
      score += 0.2;
      factors.push('joins');
    }
    
    // Check for OPTIONAL clauses
    if (this._hasOptionalClauses(parsedQuery.where || [])) {
      score += 0.3;
      factors.push('optional-clauses');
    }
    
    // Check for UNION clauses
    if (this._hasUnionClauses(parsedQuery.where || [])) {
      score += 0.2;
      factors.push('union-clauses');
    }
    
    // Check for aggregation
    if (parsedQuery.group || parsedQuery.having) {
      score += 0.2;
      factors.push('aggregation');
    }
    
    // Missing LIMIT adds complexity
    if (!parsedQuery.limit && parsedQuery.queryType === 'SELECT') {
      score += 0.1;
      factors.push('no-limit');
    }
    
    return {
      score: Math.min(score, 1.0),
      factors,
      triplePatternCount,
      estimatedResultSize: this._estimateResultSize(parsedQuery)
    };
  }

  /**
   * Determine if streaming should be used
   */
  _shouldUseStreaming(parsedQuery) {
    const complexity = this._analyzeQueryComplexity(parsedQuery);
    const storeSize = this.rdfProcessor.store.size;
    
    return complexity.score > 0.5 || 
           complexity.estimatedResultSize > 1000 || 
           storeSize > 100000;
  }

  /**
   * Calculate optimal batch size for processing
   */
  _calculateOptimalBatchSize(parsedQuery) {
    const complexity = this._analyzeQueryComplexity(parsedQuery);
    const storeSize = this.rdfProcessor.store.size;
    
    if (storeSize < 1000) return 100;
    if (storeSize < 10000) return 500;
    if (complexity.score > 0.7) return 200;
    return 1000;
  }

  /**
   * Execute complex query with optimizations
   */
  async _executeComplexQuery(parsedQuery, options = {}) {
    this.logger.debug('Using complex query execution path');
    
    // Break down complex queries into simpler parts
    if (parsedQuery.queryType === 'SELECT') {
      return await this._executeSelectOptimized(parsedQuery, options);
    }
    
    // Fallback to standard execution
    return await this.rdfProcessor.query(this._rebuildQuery(parsedQuery), options);
  }

  /**
   * Optimized SELECT execution with batching
   */
  async _executeSelectOptimized(parsedQuery, options = {}) {
    const batchSize = options.batchSize || 1000;
    const allBindings = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore && allBindings.length < (parsedQuery.limit || this.config.maxResults)) {
      const batchQuery = {
        ...parsedQuery,
        limit: Math.min(batchSize, (parsedQuery.limit || this.config.maxResults) - allBindings.length),
        offset: offset
      };
      
      const batchResults = await this.rdfProcessor.query(this._rebuildQuery(batchQuery), {
        ...options,
        streaming: false // Disable streaming for batches
      });
      
      const bindings = batchResults.results?.bindings || [];
      allBindings.push(...bindings);
      
      hasMore = bindings.length === batchSize;
      offset += bindings.length;
      
      // Yield control to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return {
      results: { bindings: allBindings },
      head: { vars: this.extractVariables(parsedQuery.variables) }
    };
  }

  /**
   * Enhanced fallback execution
   */
  async _executeFallbackQuery(parsedQuery, options = {}) {
    // Try individual query type execution with enhanced error handling
    switch (parsedQuery.queryType) {
      case 'SELECT':
        return await this._executeSelectQuery(parsedQuery, options);
      case 'CONSTRUCT':
        return await this._executeConstructQuery(parsedQuery, options);
      case 'ASK':
        return await this._executeAskQuery(parsedQuery, options);
      case 'DESCRIBE':
        return await this._executeDescribeQuery(parsedQuery, options);
      default:
        throw new Error(`Unsupported query type: ${parsedQuery.queryType}`);
    }
  }

  /**
   * Rebuild query from parsed representation
   */
  _rebuildQuery(parsedQuery) {
    try {
      return this.sparqlGenerator.stringify(parsedQuery);
    } catch (error) {
      this.logger.warn('Failed to rebuild query, using simplified approach', error);
      return this._buildSimpleQuery(parsedQuery);
    }
  }

  /**
   * Record query performance metrics
   */
  _recordQueryMetrics(metrics) {
    // Store metrics for performance analysis
    if (!this.queryMetrics) this.queryMetrics = [];
    
    const record = {
      timestamp: this.getDeterministicDate(),
      ...metrics
    };
    
    this.queryMetrics.push(record);
    
    // Keep only recent metrics (last 1000 queries)
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
    
    // Emit metrics for monitoring
    this.emit('query-metrics', record);
  }

  /**
   * Get query performance statistics
   */
  getQueryPerformanceStats() {
    if (!this.queryMetrics || this.queryMetrics.length === 0) {
      return { message: 'No metrics available' };
    }
    
    const metrics = this.queryMetrics;
    const executionTimes = metrics.map(m => m.executionTime);
    const complexityScores = metrics.map(m => m.complexity || 0);
    
    return {
      totalQueries: metrics.length,
      avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      avgComplexity: complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length,
      cacheHitRate: metrics.filter(m => m.cacheHit).length / metrics.length,
      recentQueries: metrics.slice(-10).map(m => ({
        executionTime: m.executionTime,
        resultCount: m.resultCount,
        complexity: m.complexity
      }))
    };
  }

  async _executeSelectQuery(parsedQuery, options) {
    try {
      // Use RDFProcessor's real SPARQL execution
      const results = await this.rdfProcessor.executeSelect(parsedQuery, {
        maxResults: parsedQuery.limit || this.config.maxResults,
        ...options
      });
      
      return results;
    } catch (error) {
      this.logger.error('SELECT query execution failed:', error);
      throw error;
    }
  }

  async _executeConstructQuery(parsedQuery, options) {
    try {
      // Use RDFProcessor's real CONSTRUCT execution
      const constructedQuads = await this.rdfProcessor.executeConstruct(parsedQuery, options);
      
      return {
        type: 'construct',
        triples: constructedQuads
      };
    } catch (error) {
      this.logger.error('CONSTRUCT query execution failed:', error);
      throw error;
    }
  }

  async _executeAskQuery(parsedQuery, options) {
    try {
      // Use RDFProcessor's real ASK execution
      const result = await this.rdfProcessor.executeAsk(parsedQuery, options);
      
      return {
        type: 'boolean',
        ...result
      };
    } catch (error) {
      this.logger.error('ASK query execution failed:', error);
      throw error;
    }
  }

  async _executeDescribeQuery(parsedQuery, options) {
    try {
      // Use RDFProcessor's real DESCRIBE execution
      const describedTriples = await this.rdfProcessor.executeDescribe(parsedQuery, options);
      
      return {
        type: 'describe',
        triples: describedTriples
      };
    } catch (error) {
      this.logger.error('DESCRIBE query execution failed:', error);
      throw error;
    }
  }

  _createBinding(term, variable) {
    // Create SPARQL binding using real RDF DataFactory methods
    const binding = {};
    
    if (term.termType === 'NamedNode') {
      binding[variable] = {
        type: 'uri',
        value: term.value
      };
    } else if (term.termType === 'Literal') {
      binding[variable] = {
        type: 'literal',
        value: term.value,
        datatype: term.datatype?.value,
        'xml:lang': term.language
      };
    } else if (term.termType === 'BlankNode') {
      binding[variable] = {
        type: 'bnode',
        value: term.value
      };
    }
    
    return binding;
  }

  _extractVariables(parsedQuery) {
    // Extract variables from SELECT query
    if (parsedQuery.variables) {
      return parsedQuery.variables.map(v => v.value || v);
    }
    return [];
  }

  // Cache methods now handled by SPARQLQueryCache

  _processLineageResults(results) {
    // Process lineage query results into structured format
    const lineage = [];
    
    for (const binding of results.results?.bindings || []) {
      lineage.push({
        entity: binding.entity?.value,
        relatedEntity: binding.relatedEntity?.value || binding.derivedEntity?.value,
        activity: binding.activity?.value,
        agent: binding.agent?.value,
        timestamp: binding.timestamp?.value,
        direction: binding.direction?.value || 'forward'
      });
    }
    
    return lineage;
  }

  _processActivityResults(results) {
    const activities = [];
    
    for (const binding of results.results?.bindings || []) {
      activities.push({
        activity: binding.activity?.value,
        agent: binding.agent?.value,
        startTime: binding.startTime?.value,
        endTime: binding.endTime?.value,
        status: binding.status?.value
      });
    }
    
    return activities;
  }

  _processAgentResults(results) {
    const agents = [];
    
    for (const binding of results.results?.bindings || []) {
      agents.push({
        agent: binding.agent?.value,
        name: binding.name?.value,
        type: binding.type?.value,
        activities: parseInt(binding.activities?.value || '0')
      });
    }
    
    return agents;
  }

  _processTemporalResults(results) {
    const activities = [];
    
    for (const binding of results.results?.bindings || []) {
      activities.push({
        activity: binding.activity?.value,
        entity: binding.entity?.value,
        agent: binding.agent?.value,
        startTime: binding.startTime?.value,
        endTime: binding.endTime?.value,
        duration: binding.duration?.value
      });
    }
    
    return activities;
  }

  _processBundleResults(results) {
    const bundles = [];
    
    for (const binding of results.results?.bindings || []) {
      bundles.push({
        bundle: binding.bundle?.value,
        bundleType: binding.bundleType?.value,
        agent: binding.agent?.value,
        timestamp: binding.timestamp?.value,
        activities: parseInt(binding.activities?.value || '0'),
        entities: parseInt(binding.entities?.value || '0')
      });
    }
    
    return bundles;
  }

  _assessOverallValidity(results) {
    // Assess overall validity based on validation results
    for (const [check, result] of Object.entries(results)) {
      if (result.error || (result.results?.bindings?.length > 0)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get error handling statistics
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }
  
  /**
   * Setup error recovery strategies
   */
  _setupErrorRecoveryStrategies() {
    // SPARQL parsing error recovery
    this.errorHandler.registerRecoveryStrategy('syntax', async (errorContext, options) => {
      this.logger.info('Attempting SPARQL syntax error recovery');
      
      if (errorContext.context.operation === 'sparql-execution') {
        // Could attempt query simplification or syntax correction
        return { success: false, reason: 'SPARQL syntax errors require manual correction' };
      }
      
      return { success: false, reason: 'Syntax error not recoverable' };
    });
    
    // Timeout error recovery
    this.errorHandler.registerRecoveryStrategy('timeout', async (errorContext, options) => {
      this.logger.info('Attempting query timeout recovery');
      
      // Could implement query simplification or result limiting
      const newTimeout = (options.timeout || this.config.queryTimeout) * 1.5;
      
      return {
        success: true,
        reason: 'Query timeout increased',
        newOptions: { ...options, timeout: newTimeout }
      };
    });
    
    // Store unavailable recovery
    this.errorHandler.registerRecoveryStrategy('store_unavailable', async (errorContext, options) => {
      this.logger.info('Attempting store availability recovery');
      
      // Try to reinitialize RDF processor
      try {
        await this._initializeRDFProcessor();
        return { success: true, reason: 'RDF processor reinitialized' };
      } catch (reinitError) {
        return { success: false, reason: `Store reinitialization failed: ${reinitError.message}` };
      }
    });
  }

  // Helper methods for query optimization
  
  /**
   * Count triple patterns in WHERE clause
   */
  _countTriplePatterns(whereClause) {
    let count = 0;
    for (const clause of whereClause) {
      if (clause.type === 'bgp') {
        count += clause.triples ? clause.triples.length : 0;
      } else if (clause.type === 'group') {
        count += this._countTriplePatterns(clause.patterns || []);
      }
    }
    return count;
  }

  /**
   * Check for OPTIONAL clauses
   */
  _hasOptionalClauses(whereClause) {
    return whereClause.some(clause => 
      clause.type === 'optional' || 
      (clause.patterns && this._hasOptionalClauses(clause.patterns))
    );
  }

  /**
   * Check for UNION clauses
   */
  _hasUnionClauses(whereClause) {
    return whereClause.some(clause => 
      clause.type === 'union' || 
      (clause.patterns && this._hasUnionClauses(clause.patterns))
    );
  }

  /**
   * Estimate result size based on query patterns
   */
  _estimateResultSize(parsedQuery) {
    const storeSize = this.rdfProcessor.store.size;
    const patternCount = this._countTriplePatterns(parsedQuery.where || []);
    
    if (patternCount === 0) return 0;
    if (patternCount === 1) return Math.min(storeSize / 10, 1000);
    
    // Rough estimation based on join selectivity
    let estimation = storeSize / Math.pow(10, patternCount - 1);
    
    // Apply LIMIT if present
    if (parsedQuery.limit) {
      estimation = Math.min(estimation, parsedQuery.limit);
    }
    
    return Math.max(1, Math.floor(estimation));
  }

  /**
   * Optimize join order based on selectivity heuristics
   */
  async _optimizeJoinOrder(whereClause) {
    // Simple heuristic: put more selective patterns first
    const patterns = [...whereClause];
    
    return patterns.sort((a, b) => {
      const selectivityA = this._estimatePatternSelectivity(a);
      const selectivityB = this._estimatePatternSelectivity(b);
      return selectivityA - selectivityB;
    });
  }

  /**
   * Estimate pattern selectivity
   */
  _estimatePatternSelectivity(pattern) {
    let selectivity = 1.0;
    
    // More specific patterns have lower selectivity
    if (pattern.subject && pattern.subject.termType !== 'Variable') {
      selectivity *= 0.1;
    }
    if (pattern.predicate && pattern.predicate.termType !== 'Variable') {
      selectivity *= 0.1;
    }
    if (pattern.object && pattern.object.termType !== 'Variable') {
      selectivity *= 0.1;
    }
    
    return selectivity;
  }

  /**
   * Push down filters for early evaluation
   */
  _pushDownFilters(whereClause) {
    const filters = [];
    const patterns = [];
    
    for (const clause of whereClause) {
      if (clause.type === 'filter') {
        filters.push(clause);
      } else {
        patterns.push(clause);
      }
    }
    
    // Place filters after their dependent patterns
    return [...patterns, ...filters];
  }

  /**
   * Optimize graph patterns for large stores
   */
  _optimizeGraphPatterns(whereClause) {
    // Group related patterns together
    const grouped = new Map();
    const ungrouped = [];
    
    for (const pattern of whereClause) {
      if (pattern.subject && pattern.subject.termType === 'Variable') {
        const varName = pattern.subject.value;
        if (!grouped.has(varName)) {
          grouped.set(varName, []);
        }
        grouped.get(varName).push(pattern);
      } else {
        ungrouped.push(pattern);
      }
    }
    
    // Flatten grouped patterns with ungrouped ones
    const result = [];
    for (const [varName, patterns] of grouped) {
      result.push(...patterns);
    }
    result.push(...ungrouped);
    
    return result;
  }

  /**
   * Build simple query string
   */
  _buildSimpleQuery(parsedQuery) {
    const { queryType, variables = [], where = [], limit } = parsedQuery;
    
    let query = `${queryType} `;
    
    if (queryType === 'SELECT') {
      if (variables.length > 0) {
        query += variables.map(v => `?${v.variable ? v.variable.value : v.value}`).join(' ');
      } else {
        query += '*';
      }
    }
    
    query += ' WHERE { ';
    
    // Simplified WHERE clause generation
    for (const pattern of where.slice(0, 5)) {
      if (pattern.subject) {
        query += this._termToString(pattern.subject) + ' ';
      }
      if (pattern.predicate) {
        query += this._termToString(pattern.predicate) + ' ';
      }
      if (pattern.object) {
        query += this._termToString(pattern.object) + ' . ';
      }
    }
    
    query += ' }';
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    return query;
  }

  /**
   * Convert term to string representation
   */
  _termToString(term) {
    if (!term) return '?unknown';
    
    if (term.termType === 'Variable') {
      return '?' + term.value;
    } else if (term.termType === 'NamedNode') {
      return '<' + term.value + '>';
    } else if (term.termType === 'Literal') {
      return '"' + term.value + '"';
    }
    
    return '?unknown';
  }
}

export default ProvenanceQueries;