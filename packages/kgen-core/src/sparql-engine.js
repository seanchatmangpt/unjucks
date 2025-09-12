/**
 * SPARQL Query Engine for KGEN - Production Implementation
 * 
 * Provides comprehensive SPARQL query execution with:
 * - Full SELECT, CONSTRUCT, ASK, DESCRIBE query support
 * - Template variable resolution from RDF graphs
 * - Context extraction for code generation
 * - Impact analysis and validation queries
 * - Integration with graph processor and provenance system
 */

import { consola } from 'consola';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';
import { GraphProcessor } from './rdf/graph-processor.js';
import { SparqlInterface } from './rdf/sparql-interface.js';
import { ProvenanceQueries } from './provenance/queries/sparql.js';

export class SparqlEngine {
  constructor(options = {}) {
    this.logger = consola.withTag('sparql-engine');
    this.options = {
      enableCaching: options.enableCaching !== false,
      maxCacheSize: options.maxCacheSize || 5000,
      queryTimeout: options.queryTimeout || 60000,
      maxResults: options.maxResults || 50000,
      enableOptimization: options.enableOptimization !== false,
      enableProvenance: options.enableProvenance !== false,
      ...options
    };

    // Initialize components
    this.graphProcessor = options.graphProcessor || new GraphProcessor(options.graph);
    this.sparqlInterface = new SparqlInterface(options.sparql);
    
    if (this.options.enableProvenance) {
      this.provenanceQueries = new ProvenanceQueries(this.graphProcessor.store, options.provenance);
    }

    // Query parser and generator
    this.sparqlParser = new SparqlParser();
    this.sparqlGenerator = new SparqlGenerator();

    // Query cache and metrics
    this.queryCache = new Map();
    this.metrics = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalExecutionTime: 0,
      errorCount: 0
    };

    // Initialize query templates
    this.queryTemplates = this._initializeQueryTemplates();
    
    this.logger.success('SPARQL Engine initialized');
  }

  /**
   * Execute SPARQL query with comprehensive result processing
   * @param {string} query - SPARQL query string
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Query results with metadata
   */
  async executeQuery(query, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      this.logger.debug('Executing SPARQL query');
      
      // Validate and parse query
      const parsedQuery = this._parseAndValidateQuery(query);
      
      // Check cache
      const cacheKey = this._generateCacheKey(query, options);
      if (this.options.enableCaching && !options.skipCache && this.queryCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        const cached = this.queryCache.get(cacheKey);
        this.logger.debug('Returning cached query result');
        return { ...cached, cached: true };
      }
      
      this.metrics.cacheMisses++;
      
      // Optimize query if enabled
      if (this.options.enableOptimization) {
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
      
      // Process and enrich results
      const enrichedResults = await this._enrichResults(results, parsedQuery, options);
      
      // Cache results
      if (this.options.enableCaching && this.queryCache.size < this.options.maxCacheSize) {
        this.queryCache.set(cacheKey, enrichedResults);
      }
      
      // Update metrics
      const executionTime = this.getDeterministicTimestamp() - startTime;
      this.metrics.queriesExecuted++;
      this.metrics.totalExecutionTime += executionTime;
      
      this.logger.success(`Query executed in ${executionTime}ms: ${results.results?.bindings?.length || 0} results`);
      
      return {
        ...enrichedResults,
        executionTime,
        cached: false,
        queryType: parsedQuery.queryType
      };
      
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('SPARQL query execution failed:', error);
      throw new Error(`SPARQL execution error: ${error.message}`);
    }
  }

  /**
   * Extract template variables from RDF graph using SPARQL queries
   * @param {string} templatePath - Template path or identifier
   * @param {Object} context - Context for variable resolution
   * @returns {Promise<Object>} Template variables extracted from graph
   */
  async extractTemplateVariables(templatePath, context = {}) {
    try {
      this.logger.debug(`Extracting template variables for: ${templatePath}`);
      
      const variables = {};
      
      // Query for template-specific variables
      const templateQuery = this.queryTemplates.templateVariables
        .replace('{{templatePath}}', templatePath);
      
      const templateResults = await this.executeQuery(templateQuery, { skipCache: context.skipCache });
      
      // Process template variable bindings
      for (const binding of templateResults.results?.bindings || []) {
        const varName = binding.variable?.value;
        const varValue = binding.value?.value;
        const varType = binding.type?.value || 'string';
        
        if (varName) {
          variables[varName] = {
            value: this._coerceValue(varValue, varType),
            type: varType,
            source: 'graph'
          };
        }
      }
      
      // Query for context-specific variables if context provided
      if (context.entityUri || context.artifactType) {
        const contextQuery = this.queryTemplates.contextVariables
          .replace('{{entityUri}}', context.entityUri || '')
          .replace('{{artifactType}}', context.artifactType || '');
        
        const contextResults = await this.executeQuery(contextQuery, { skipCache: context.skipCache });
        
        for (const binding of contextResults.results?.bindings || []) {
          const varName = binding.variable?.value;
          const varValue = binding.value?.value;
          const varType = binding.type?.value || 'string';
          
          if (varName) {
            variables[varName] = {
              value: this._coerceValue(varValue, varType),
              type: varType,
              source: 'context'
            };
          }
        }
      }
      
      // Merge with provided context
      const mergedVariables = { ...variables };
      for (const [key, value] of Object.entries(context)) {
        if (!['skipCache', 'entityUri', 'artifactType'].includes(key)) {
          mergedVariables[key] = {
            value: value,
            type: typeof value,
            source: 'provided'
          };
        }
      }
      
      this.logger.success(`Extracted ${Object.keys(mergedVariables).length} template variables`);
      return mergedVariables;
      
    } catch (error) {
      this.logger.error('Template variable extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract context information for code generation
   * @param {string} entityUri - Entity URI to extract context for
   * @param {Object} options - Context extraction options
   * @returns {Promise<Object>} Context data for template processing
   */
  async extractContext(entityUri, options = {}) {
    try {
      this.logger.debug(`Extracting context for entity: ${entityUri}`);
      
      const context = {
        entity: entityUri,
        properties: {},
        relationships: {},
        metadata: {},
        provenance: null
      };
      
      // Extract entity properties
      const propertiesQuery = this.queryTemplates.entityProperties
        .replace('{{entityUri}}', entityUri);
      
      const propertiesResults = await this.executeQuery(propertiesQuery);
      
      for (const binding of propertiesResults.results?.bindings || []) {
        const property = binding.property?.value;
        const value = binding.value?.value;
        const type = binding.type?.value;
        
        if (property) {
          context.properties[property] = {
            value: this._coerceValue(value, type),
            type: type || 'string'
          };
        }
      }
      
      // Extract relationships
      const relationshipsQuery = this.queryTemplates.entityRelationships
        .replace('{{entityUri}}', entityUri);
      
      const relationshipsResults = await this.executeQuery(relationshipsQuery);
      
      for (const binding of relationshipsResults.results?.bindings || []) {
        const relation = binding.relation?.value;
        const target = binding.target?.value;
        const direction = binding.direction?.value || 'outgoing';
        
        if (relation) {
          if (!context.relationships[relation]) {
            context.relationships[relation] = { outgoing: [], incoming: [] };
          }
          context.relationships[relation][direction].push(target);
        }
      }
      
      // Extract metadata
      const metadataQuery = this.queryTemplates.entityMetadata
        .replace('{{entityUri}}', entityUri);
      
      const metadataResults = await this.executeQuery(metadataQuery);
      
      for (const binding of metadataResults.results?.bindings || []) {
        const key = binding.key?.value;
        const value = binding.value?.value;
        
        if (key) {
          context.metadata[key] = value;
        }
      }
      
      // Extract provenance information if enabled
      if (this.options.enableProvenance && this.provenanceQueries) {
        try {
          const lineage = await this.provenanceQueries.getEntityLineage(entityUri, {
            maxDepth: options.provenanceDepth || 3
          });
          context.provenance = lineage;
        } catch (error) {
          this.logger.warn('Provenance extraction failed:', error.message);
        }
      }
      
      this.logger.success(`Extracted context with ${Object.keys(context.properties).length} properties and ${Object.keys(context.relationships).length} relationships`);
      return context;
      
    } catch (error) {
      this.logger.error('Context extraction failed:', error);
      throw error;
    }
  }

  /**
   * Perform impact analysis using SPARQL queries
   * @param {string} entityUri - Entity to analyze impact for
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Impact analysis results
   */
  async analyzeImpact(entityUri, options = {}) {
    try {
      this.logger.debug(`Analyzing impact for entity: ${entityUri}`);
      
      const impact = {
        entity: entityUri,
        directDependents: [],
        indirectDependents: [],
        dependencies: [],
        impactScore: 0,
        riskLevel: 'low'
      };
      
      // Find direct dependents
      const directQuery = this.queryTemplates.directDependents
        .replace('{{entityUri}}', entityUri)
        .replace('{{maxDepth}}', options.maxDepth || '1');
      
      const directResults = await this.executeQuery(directQuery);
      impact.directDependents = directResults.results?.bindings?.map(b => ({
        uri: b.dependent?.value,
        relation: b.relation?.value,
        type: b.type?.value
      })) || [];
      
      // Find indirect dependents (transitive)
      const indirectQuery = this.queryTemplates.indirectDependents
        .replace('{{entityUri}}', entityUri)
        .replace('{{maxDepth}}', options.maxDepth || '5');
      
      const indirectResults = await this.executeQuery(indirectQuery);
      impact.indirectDependents = indirectResults.results?.bindings?.map(b => ({
        uri: b.dependent?.value,
        relation: b.relation?.value,
        depth: parseInt(b.depth?.value || '0')
      })) || [];
      
      // Find dependencies
      const dependenciesQuery = this.queryTemplates.entityDependencies
        .replace('{{entityUri}}', entityUri);
      
      const dependenciesResults = await this.executeQuery(dependenciesQuery);
      impact.dependencies = dependenciesResults.results?.bindings?.map(b => ({
        uri: b.dependency?.value,
        relation: b.relation?.value,
        critical: b.critical?.value === 'true'
      })) || [];
      
      // Calculate impact score
      impact.impactScore = this._calculateImpactScore(impact);
      impact.riskLevel = this._determineRiskLevel(impact.impactScore);
      
      this.logger.success(`Impact analysis complete: ${impact.impactScore} score, ${impact.riskLevel} risk`);
      return impact;
      
    } catch (error) {
      this.logger.error('Impact analysis failed:', error);
      throw error;
    }
  }

  /**
   * Validate RDF graph integrity using SPARQL
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateGraph(options = {}) {
    try {
      this.logger.debug('Validating graph integrity');
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        checks: {}
      };
      
      // Run validation checks
      const validationChecks = {
        orphanedNodes: this.queryTemplates.orphanedNodes,
        brokenReferences: this.queryTemplates.brokenReferences,
        missingRequiredProperties: this.queryTemplates.missingRequiredProperties,
        duplicateEntities: this.queryTemplates.duplicateEntities,
        cyclicDependencies: this.queryTemplates.cyclicDependencies
      };
      
      for (const [checkName, query] of Object.entries(validationChecks)) {
        try {
          const results = await this.executeQuery(query, { skipCache: true });
          const issues = results.results?.bindings || [];
          
          validation.checks[checkName] = {
            passed: issues.length === 0,
            issueCount: issues.length,
            issues: issues.slice(0, 100) // Limit issues to prevent memory issues
          };
          
          if (issues.length > 0) {
            validation.isValid = false;
            if (['orphanedNodes', 'brokenReferences'].includes(checkName)) {
              validation.errors.push(`${checkName}: ${issues.length} issues found`);
            } else {
              validation.warnings.push(`${checkName}: ${issues.length} issues found`);
            }
          }
        } catch (error) {
          validation.warnings.push(`Validation check ${checkName} failed: ${error.message}`);
        }
      }
      
      // Calculate overall health score
      const passedChecks = Object.values(validation.checks).filter(c => c.passed).length;
      const totalChecks = Object.keys(validation.checks).length;
      validation.healthScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
      
      this.logger.success(`Graph validation complete: ${validation.healthScore}% health score`);
      return validation;
      
    } catch (error) {
      this.logger.error('Graph validation failed:', error);
      throw error;
    }
  }

  /**
   * Get predefined query templates
   * @returns {Object} Available query templates
   */
  getQueryTemplates() {
    return { ...this.queryTemplates };
  }

  /**
   * Get engine statistics and metrics
   * @returns {Object} Engine metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.queryCache.size,
      maxCacheSize: this.options.maxCacheSize,
      hitRate: this.metrics.queriesExecuted > 0 
        ? this.metrics.cacheHits / this.metrics.queriesExecuted 
        : 0,
      averageExecutionTime: this.metrics.queriesExecuted > 0
        ? this.metrics.totalExecutionTime / this.metrics.queriesExecuted
        : 0,
      graphSize: this.graphProcessor.store.size
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    this.logger.debug('Query cache cleared');
  }

  // Private methods

  _parseAndValidateQuery(query) {
    try {
      const parsed = this.sparqlParser.parse(query);
      
      // Basic validation
      if (!parsed.where && parsed.queryType !== 'ASK') {
        throw new Error('Query must have a WHERE clause');
      }
      
      // Check for potentially expensive operations
      const queryString = typeof query === 'string' ? query : this.sparqlGenerator.stringify(parsed);
      if (queryString.includes('.*') && !queryString.includes('LIMIT')) {
        this.logger.warn('Query contains .* without LIMIT, performance may be affected');
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Query parsing failed: ${error.message}`);
    }
  }

  _optimizeQuery(parsedQuery) {
    // Add default LIMIT if none specified for SELECT queries
    if (parsedQuery.queryType === 'SELECT' && !parsedQuery.limit) {
      parsedQuery.limit = this.options.maxResults;
      this.logger.debug('Added default LIMIT to SELECT query');
    }
    
    // Order optimization: put more selective patterns first
    if (parsedQuery.where) {
      // This is a simplified optimization
      // A full implementation would analyze selectivity
    }
  }

  async _executeSelectQuery(parsedQuery, options) {
    return await this.sparqlInterface.select(this.graphProcessor.store, 
      this.sparqlGenerator.stringify(parsedQuery), options);
  }

  async _executeConstructQuery(parsedQuery, options) {
    return await this.sparqlInterface.construct(this.graphProcessor.store,
      this.sparqlGenerator.stringify(parsedQuery), options);
  }

  async _executeAskQuery(parsedQuery, options) {
    const result = await this.sparqlInterface.ask(this.graphProcessor.store,
      this.sparqlGenerator.stringify(parsedQuery), options);
    return { type: 'boolean', boolean: result };
  }

  async _executeDescribeQuery(parsedQuery, options) {
    return await this.sparqlInterface.describe(this.graphProcessor.store,
      this.sparqlGenerator.stringify(parsedQuery), options);
  }

  async _enrichResults(results, parsedQuery, options) {
    // Add metadata and context to results
    return {
      ...results,
      query: {
        type: parsedQuery.queryType,
        optimized: this.options.enableOptimization,
        cached: false
      },
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        resultCount: results.results?.bindings?.length || 0,
        graphSize: this.graphProcessor.store.size
      }
    };
  }

  _coerceValue(value, type) {
    if (!value || !type) return value;
    
    switch (type.toLowerCase()) {
      case 'integer':
      case 'int':
        return parseInt(value, 10);
      case 'float':
      case 'double':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  _calculateImpactScore(impact) {
    const directWeight = 10;
    const indirectWeight = 5;
    const dependencyWeight = 2;
    
    return (impact.directDependents.length * directWeight) +
           (impact.indirectDependents.length * indirectWeight) +
           (impact.dependencies.length * dependencyWeight);
  }

  _determineRiskLevel(score) {
    if (score >= 100) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  _generateCacheKey(query, options) {
    const key = typeof query === 'string' ? query : this.sparqlGenerator.stringify(query);
    const optionsStr = JSON.stringify(options, Object.keys(options).sort());
    return `${key}:${optionsStr}`;
  }

  _initializeQueryTemplates() {
    return {
      // Template variable queries
      templateVariables: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX tmpl: <http://kgen.enterprise/template/>
        
        SELECT ?variable ?value ?type WHERE {
          ?template tmpl:path "{{templatePath}}" .
          ?template tmpl:hasVariable ?var .
          ?var tmpl:name ?variable .
          ?var tmpl:value ?value .
          OPTIONAL { ?var tmpl:type ?type }
        }
      `,
      
      contextVariables: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX ctx: <http://kgen.enterprise/context/>
        
        SELECT ?variable ?value ?type WHERE {
          {
            ?entity a ?entityType .
            ?entity ctx:hasContextVariable ?var .
            FILTER(?entity = <{{entityUri}}>)
          } UNION {
            ?artifact a <{{artifactType}}> .
            ?artifact ctx:hasContextVariable ?var .
          }
          ?var ctx:name ?variable .
          ?var ctx:value ?value .
          OPTIONAL { ?var ctx:type ?type }
        }
      `,
      
      // Context extraction queries
      entityProperties: `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?property ?value ?type WHERE {
          <{{entityUri}}> ?property ?value .
          OPTIONAL { ?value rdf:type ?type }
          FILTER(?property != rdf:type)
        }
      `,
      
      entityRelationships: `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?relation ?target ?direction WHERE {
          {
            <{{entityUri}}> ?relation ?target .
            BIND("outgoing" AS ?direction)
          } UNION {
            ?target ?relation <{{entityUri}}> .
            BIND("incoming" AS ?direction)
          }
          FILTER(?relation != rdf:type)
          FILTER(isURI(?target))
        }
      `,
      
      entityMetadata: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX dc: <http://purl.org/dc/elements/1.1/>
        PREFIX dcterms: <http://purl.org/dc/terms/>
        
        SELECT ?key ?value WHERE {
          <{{entityUri}}> ?prop ?value .
          FILTER(?prop IN (dc:title, dc:description, dcterms:created, 
                          dcterms:modified, kgen:version, kgen:status))
          BIND(REPLACE(STR(?prop), "^.*[/#]", "") AS ?key)
        }
      `,
      
      // Impact analysis queries
      directDependents: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX dep: <http://kgen.enterprise/dependency/>
        
        SELECT ?dependent ?relation ?type WHERE {
          ?dependent ?relation <{{entityUri}}> .
          OPTIONAL { ?dependent a ?type }
        } LIMIT {{maxDepth}}
      `,
      
      indirectDependents: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX dep: <http://kgen.enterprise/dependency/>
        
        SELECT ?dependent ?relation ?depth WHERE {
          <{{entityUri}}> (^?relation)+ ?dependent .
          # Calculate depth (simplified)
          BIND("1" AS ?depth)
        } LIMIT {{maxDepth}}
      `,
      
      entityDependencies: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX dep: <http://kgen.enterprise/dependency/>
        
        SELECT ?dependency ?relation ?critical WHERE {
          <{{entityUri}}> ?relation ?dependency .
          OPTIONAL { 
            ?rel a dep:CriticalDependency .
            BIND(true AS ?critical)
          }
          FILTER(isURI(?dependency))
        }
      `,
      
      // Validation queries
      orphanedNodes: `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?node WHERE {
          ?node a ?type .
          FILTER NOT EXISTS { ?node ?prop ?value . FILTER(?prop != rdf:type) }
          FILTER NOT EXISTS { ?subject ?prop ?node . FILTER(?prop != rdf:type) }
        }
      `,
      
      brokenReferences: `
        SELECT ?subject ?predicate ?object WHERE {
          ?subject ?predicate ?object .
          FILTER(isURI(?object))
          FILTER NOT EXISTS { ?object ?p ?v }
        }
      `,
      
      missingRequiredProperties: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        
        SELECT ?entity ?property WHERE {
          ?entity a ?type .
          ?type sh:property ?propShape .
          ?propShape sh:path ?property .
          ?propShape sh:minCount ?min .
          FILTER(?min > 0)
          FILTER NOT EXISTS { ?entity ?property ?value }
        }
      `,
      
      duplicateEntities: `
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?entity1 ?entity2 ?identifier WHERE {
          ?entity1 kgen:identifier ?identifier .
          ?entity2 kgen:identifier ?identifier .
          FILTER(?entity1 != ?entity2)
        }
      `,
      
      cyclicDependencies: `
        PREFIX dep: <http://kgen.enterprise/dependency/>
        
        SELECT ?entity WHERE {
          ?entity (dep:dependsOn)+ ?entity .
        }
      `
    };
  }

  /**
   * Health check for the SPARQL engine
   * @returns {Object} Health status
   */
  healthCheck() {
    return {
      status: 'healthy',
      components: {
        graphProcessor: this.graphProcessor.healthCheck(),
        sparqlInterface: this.sparqlInterface.getStats(),
        provenance: this.provenanceQueries ? 'enabled' : 'disabled'
      },
      metrics: this.getMetrics(),
      cache: {
        size: this.queryCache.size,
        maxSize: this.options.maxCacheSize,
        usage: (this.queryCache.size / this.options.maxCacheSize) * 100
      }
    };
  }
}

export default SparqlEngine;