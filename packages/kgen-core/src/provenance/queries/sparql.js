/**
 * Provenance SPARQL Queries - W3C PROV-O compliant query engine
 * 
 * Provides SPARQL query capabilities for provenance data with support for
 * complex lineage queries, temporal queries, and compliance reporting.
 */

import consola from 'consola';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';
import { Store, DataFactory } from 'n3';
import crypto from 'crypto';

const { namedNode, literal, quad } = DataFactory;

export class ProvenanceQueries {
  constructor(store, config = {}) {
    this.store = store;
    this.config = {
      maxResults: config.maxResults || 10000,
      queryTimeout: config.queryTimeout || 30000,
      enableOptimization: config.enableQueryOptimization !== false,
      ...config
    };

    this.logger = consola.withTag('provenance-queries');
    this.sparqlParser = new SparqlParser();
    this.sparqlGenerator = new SparqlGenerator();
    
    // Query templates
    this.queryTemplates = this._initializeQueryTemplates();
    
    // Query cache
    this.queryCache = new Map();
    this.cacheSize = 0;
    this.maxCacheSize = config.maxCacheSize || 1000;
  }

  /**
   * Execute SPARQL query against provenance store
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   */
  async executeQuery(query, options = {}) {
    try {
      this.logger.debug('Executing SPARQL query');

      // Check cache first
      const cacheKey = this._generateCacheKey(query, options);
      if (this.queryCache.has(cacheKey) && !options.skipCache) {
        this.logger.debug('Returning cached query result');
        return this.queryCache.get(cacheKey);
      }

      // Parse query
      const parsedQuery = this.sparqlParser.parse(query);
      
      // Validate query
      this._validateQuery(parsedQuery);
      
      // Optimize query if enabled
      if (this.config.enableOptimization) {
        this._optimizeQuery(parsedQuery);
      }

      // Execute query based on type
      let results;
      switch (parsedQuery.queryType) {
        case 'SELECT':
          results = await this._executeSelectQuery(parsedQuery, options);
          break;
        case 'CONSTRUCT':
          results = await this._executeConstructQuery(parsedQuery, options);
          break;
        case 'ASK':
          results = await this._executeAskQuery(parsedQuery, options);
          break;
        case 'DESCRIBE':
          results = await this._executeDescribeQuery(parsedQuery, options);
          break;
        default:
          throw new Error(`Unsupported query type: ${parsedQuery.queryType}`);
      }

      // Cache results
      this._cacheResults(cacheKey, results);

      this.logger.debug(`Query executed successfully, ${results.results?.bindings?.length || 0} results`);
      return results;

    } catch (error) {
      this.logger.error('Failed to execute SPARQL query:', error);
      throw error;
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
    return {
      cacheSize: this.queryCache.size,
      maxCacheSize: this.maxCacheSize,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      totalQueries: this.cacheHits + this.cacheMisses,
      averageExecutionTime: this.totalExecutionTime / this.totalQueries || 0
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    this.cacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // Private methods

  _initializeQueryTemplates() {
    return {
      forwardLineage: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?derivedEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom)* ?entity .
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
            <{{entityUri}}> (prov:wasDerivedFrom)* ?entity .
            ?entity prov:wasDerivedFrom ?relatedEntity .
            BIND("backward" AS ?direction)
          } UNION {
            <{{entityUri}}> (^prov:wasDerivedFrom)* ?entity .
            ?relatedEntity prov:wasDerivedFrom ?entity .
            BIND("forward" AS ?direction)
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
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom)* ?entity .
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?agent foaf:name ?name }
          OPTIONAL { ?agent a ?type }
          {
            SELECT ?agent (COUNT(?activity) AS ?activities) WHERE {
              <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom)* ?entity .
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

  async _executeSelectQuery(parsedQuery, options) {
    const bindings = [];
    
    // Mock SPARQL execution - in real implementation, this would use a SPARQL engine
    const quads = this.store.getQuads();
    
    // Basic pattern matching simulation
    for (const quad of quads) {
      // Simple pattern matching logic would go here
      // This is a simplified implementation
      const binding = this._createBinding(quad, parsedQuery);
      if (binding) {
        bindings.push(binding);
      }
    }

    return {
      head: { vars: this._extractVariables(parsedQuery) },
      results: { bindings: bindings.slice(0, parsedQuery.limit || this.config.maxResults) }
    };
  }

  async _executeConstructQuery(parsedQuery, options) {
    // CONSTRUCT query implementation
    const constructedQuads = [];
    
    // This would construct new triples based on the query
    return {
      type: 'construct',
      triples: constructedQuads
    };
  }

  async _executeAskQuery(parsedQuery, options) {
    // ASK query implementation
    const quads = this.store.getQuads();
    
    // Simple existence check
    const exists = quads.length > 0;
    
    return {
      type: 'boolean',
      boolean: exists
    };
  }

  async _executeDescribeQuery(parsedQuery, options) {
    // DESCRIBE query implementation
    const describedTriples = [];
    
    return {
      type: 'describe',
      triples: describedTriples
    };
  }

  _createBinding(quad, parsedQuery) {
    // Create variable bindings from quad
    // This is a simplified implementation
    return {
      subject: { type: 'uri', value: quad.subject.value },
      predicate: { type: 'uri', value: quad.predicate.value },
      object: quad.object.termType === 'Literal' 
        ? { type: 'literal', value: quad.object.value }
        : { type: 'uri', value: quad.object.value }
    };
  }

  _extractVariables(parsedQuery) {
    // Extract variables from SELECT query
    if (parsedQuery.variables) {
      return parsedQuery.variables.map(v => v.value || v);
    }
    return [];
  }

  _generateCacheKey(query, options) {
    const optionsString = JSON.stringify(options, null, 0);
    return crypto.createHash('sha256').update(query + optionsString).digest('hex');
  }

  _cacheResults(key, results) {
    if (this.queryCache.size >= this.maxCacheSize) {
      // Simple LRU eviction
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }

    this.queryCache.set(key, {
      ...results,
      cachedAt: this.getDeterministicDate()
    });
  }

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
}

export default ProvenanceQueries;