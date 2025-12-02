/**
 * SPARQL Query Engine for KGEN Marketplace
 * 
 * Handles SPARQL query execution against RDF knowledge graphs
 * with caching, error handling, and performance optimization.
 */

import { createLogger } from '../utils/logger.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SPARQL query engine with intelligent caching and optimization
 */
export class SparqlQueryEngine {
  constructor(endpoint = null, options = {}) {
    this.logger = createLogger('SparqlQueryEngine');
    this.endpoint = endpoint;
    this.options = {
      timeout: 30000,
      maxRetries: 3,
      cacheSize: 1000,
      ...options
    };
    
    this.queryCache = new Map();
    this.prefixes = new Map([
      ['rdf', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#>'],
      ['rdfs', '<http://www.w3.org/2000/01/rdf-schema#>'],
      ['owl', '<http://www.w3.org/2002/07/owl#>'],
      ['xsd', '<http://www.w3.org/2001/XMLSchema#>'],
      ['dcterms', '<http://purl.org/dc/terms/>'],
      ['foaf', '<http://xmlns.com/foaf/0.1/>'],
      ['prov', '<http://www.w3.org/ns/prov#>'],
      ['kgen', '<http://kgen.ai/ontology/>'],
      ['kgenattest', '<http://kgen.ai/ontology/attest/>'],
      ['crypto', '<http://kgen.ai/ontology/crypto/>'],
      ['sh', '<http://www.w3.org/ns/shacl#>']
    ]);
    
    // Load pre-defined queries
    this.queries = new Map();
    this._initialized = false;
    this._initPromise = null;
  }
  
  /**
   * Initialize the SPARQL engine (loads predefined queries)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) {
      return;
    }
    
    if (this._initPromise) {
      return this._initPromise;
    }
    
    this._initPromise = this._loadPredefinedQueries().then(() => {
      this._initialized = true;
    });
    
    return this._initPromise;
  }
  
  /**
   * Execute a SPARQL query with caching and error handling
   * @param {string} query - SPARQL query string or query name
   * @param {Object} bindings - Variable bindings for the query
   * @param {Object} options - Query execution options
   * @returns {Promise<Array>} Query results
   */
  async query(query, bindings = {}, options = {}) {
    try {
      const fullQuery = this._prepareQuery(query, bindings);
      const cacheKey = this._generateCacheKey(fullQuery, options);
      
      // Check cache first
      if (!options.noCache && this.queryCache.has(cacheKey)) {
        const cached = this.queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < (options.cacheTTL || 300000)) {
          this.logger.debug('Returning cached query result', { cacheKey });
          return cached.results;
        }
        this.queryCache.delete(cacheKey);
      }
      
      this.logger.debug('Executing SPARQL query', { query: fullQuery.substring(0, 200) });
      
      const startTime = Date.now();
      const results = await this._executeQuery(fullQuery, options);
      const executionTime = Date.now() - startTime;
      
      this.logger.info('Query executed successfully', { 
        resultCount: results.length, 
        executionTime 
      });
      
      // Cache results
      if (!options.noCache && results.length > 0) {
        this._cacheResults(cacheKey, results);
      }
      
      return results;
      
    } catch (error) {
      this.logger.error('SPARQL query failed', error);
      throw new Error(`SPARQL query execution failed: ${error.message}`);
    }
  }
  
  /**
   * Load and execute a predefined query by name
   * @param {string} queryName - Name of the predefined query
   * @param {Object} parameters - Parameters for the query
   * @returns {Promise<Array>} Query results
   */
  async executeNamedQuery(queryName, parameters = {}) {
    // Ensure initialization
    await this.initialize();
    
    const queryTemplate = this.queries.get(queryName);
    if (!queryTemplate) {
      throw new Error(`Unknown query: ${queryName}`);
    }
    
    const query = this._substituteParameters(queryTemplate, parameters);
    return this.query(query, {}, { queryName });
  }
  
  /**
   * Execute multiple queries in parallel
   * @param {Array} queries - Array of queries to execute
   * @returns {Promise<Array>} Array of results for each query
   */
  async batchQuery(queries) {
    try {
      this.logger.info('Executing batch queries', { count: queries.length });
      
      const results = await Promise.all(
        queries.map(async (querySpec, index) => {
          try {
            if (typeof querySpec === 'string') {
              return await this.query(querySpec);
            } else {
              return await this.query(querySpec.query, querySpec.bindings, querySpec.options);
            }
          } catch (error) {
            this.logger.warn(`Query ${index} failed in batch`, error);
            return { error: error.message, index };
          }
        })
      );
      
      return results;
      
    } catch (error) {
      this.logger.error('Batch query execution failed', error);
      throw error;
    }
  }
  
  /**
   * Get query statistics and performance metrics
   * @returns {Object} Performance statistics
   */
  getStatistics() {
    return {
      cacheSize: this.queryCache.size,
      cacheHitRate: this._calculateCacheHitRate(),
      predefinedQueries: this.queries.size,
      availablePrefixes: Array.from(this.prefixes.keys())
    };
  }
  
  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    this.logger.info('Query cache cleared');
  }
  
  /**
   * Add custom prefix for queries
   * @param {string} prefix - Prefix name
   * @param {string} uri - URI for the prefix
   */
  addPrefix(prefix, uri) {
    this.prefixes.set(prefix, `<${uri}>`);
    this.logger.debug('Added custom prefix', { prefix, uri });
  }
  
  /**
   * Register a custom query template
   * @param {string} name - Query name
   * @param {string} template - SPARQL query template
   */
  registerQuery(name, template) {
    this.queries.set(name, template);
    this.logger.debug('Registered custom query', { name });
  }
  
  /**
   * Prepare query by adding prefixes and bindings
   */
  _prepareQuery(query, bindings = {}) {
    // If it's a named query, get the template
    if (this.queries.has(query)) {
      query = this.queries.get(query);
    }
    
    // Add prefixes
    const prefixDeclarations = Array.from(this.prefixes.entries())
      .map(([prefix, uri]) => `PREFIX ${prefix}: ${uri}`)
      .join('\n');
    
    let fullQuery = `${prefixDeclarations}\n\n${query}`;
    
    // Apply bindings
    for (const [variable, value] of Object.entries(bindings)) {
      const bindingPattern = new RegExp(`\\?${variable}\\b`, 'g');
      fullQuery = fullQuery.replace(bindingPattern, this._formatValue(value));
    }
    
    return fullQuery;
  }
  
  /**
   * Execute the actual SPARQL query
   */
  async _executeQuery(query, options = {}) {
    if (this.endpoint) {
      return this._executeRemoteQuery(query, options);
    } else {
      return this._executeLocalQuery(query, options);
    }
  }
  
  /**
   * Execute query against remote SPARQL endpoint
   */
  async _executeRemoteQuery(query, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json'
        },
        body: query,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`SPARQL endpoint error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return this._processSparqlResults(data);
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Execute query against local RDF data (for testing/development)
   */
  async _executeLocalQuery(query, options = {}) {
    // This is a simplified implementation for testing
    // In a real scenario, you'd use an RDF library like N3.js or similar
    
    this.logger.warn('Using mock local query execution');
    
    // Mock results based on common query patterns
    if (query.includes('SELECT ?pack')) {
      return this._generateMockPackageResults();
    } else if (query.includes('SELECT ?template')) {
      return this._generateMockTemplateResults();
    } else if (query.includes('compliance')) {
      return this._generateMockComplianceResults();
    }
    
    return [];
  }
  
  /**
   * Process SPARQL JSON results format
   */
  _processSparqlResults(data) {
    if (!data.results || !data.results.bindings) {
      return [];
    }
    
    return data.results.bindings.map(binding => {
      const result = {};
      for (const [variable, value] of Object.entries(binding)) {
        result[variable] = {
          value: value.value,
          type: value.type,
          datatype: value.datatype,
          'xml:lang': value['xml:lang']
        };
      }
      return result;
    });
  }
  
  /**
   * Generate mock results for development/testing
   */
  _generateMockPackageResults() {
    return [
      {
        pack: { value: 'http://marketplace.kgen.ai/packages/enterprise-security', type: 'uri' },
        name: { value: 'Enterprise Security Pack', type: 'literal' },
        description: { value: 'Comprehensive security templates', type: 'literal' },
        category: { value: 'security', type: 'literal' },
        downloads: { value: '5420', type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
        rating: { value: '4.8', type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#decimal' }
      },
      {
        pack: { value: 'http://marketplace.kgen.ai/packages/microservices-starter', type: 'uri' },
        name: { value: 'Microservices Starter Pack', type: 'literal' },
        description: { value: 'Complete microservices architecture', type: 'literal' },
        category: { value: 'architecture', type: 'literal' },
        downloads: { value: '8932', type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
        rating: { value: '4.6', type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#decimal' }
      }
    ];
  }
  
  _generateMockTemplateResults() {
    return [
      {
        template: { value: 'http://marketplace.kgen.ai/templates/react-component', type: 'uri' },
        name: { value: 'React Component Template', type: 'literal' },
        framework: { value: 'React', type: 'literal' },
        complexity: { value: 'medium', type: 'literal' }
      }
    ];
  }
  
  _generateMockComplianceResults() {
    return [
      {
        framework: { value: 'SOX', type: 'literal' },
        requirement: { value: 'Financial Controls', type: 'literal' },
        status: { value: 'compliant', type: 'literal' }
      }
    ];
  }
  
  /**
   * Load predefined queries from files
   */
  async _loadPredefinedQueries() {
    try {
      const queryDir = join(__dirname, 'queries');
      const queryFiles = [
        'findComplianceGaps.sparql',
        'suggestTemplates.sparql',
        'findDataExhaust.sparql',
        'identifyROI.sparql',
        'findSimilarPacks.sparql',
        'getPopularPacks.sparql',
        'analyzeAttestations.sparql',
        'getMarketTrends.sparql'
      ];
      
      for (const file of queryFiles) {
        try {
          const queryContent = await readFile(join(queryDir, file), 'utf-8');
          const queryName = file.replace('.sparql', '');
          this.queries.set(queryName, queryContent);
        } catch (error) {
          this.logger.warn(`Could not load query file: ${file}`, error);
          // Continue loading other queries
        }
      }
      
      this.logger.info(`Loaded ${this.queries.size} predefined queries`);
      
    } catch (error) {
      this.logger.warn('Could not load predefined queries', error);
    }
  }
  
  /**
   * Substitute parameters in query templates
   */
  _substituteParameters(template, parameters) {
    let query = template;
    for (const [param, value] of Object.entries(parameters)) {
      const pattern = new RegExp(`\\{\\{${param}\\}\\}`, 'g');
      query = query.replace(pattern, this._formatValue(value));
    }
    return query;
  }
  
  /**
   * Format values for SPARQL queries
   */
  _formatValue(value) {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else if (value instanceof Date) {
      return `"${value.toISOString()}"^^xsd:dateTime`;
    }
    return `"${String(value)}"`;
  }
  
  /**
   * Generate cache key for queries
   */
  _generateCacheKey(query, options) {
    const keyData = { query, options: { ...options, timestamp: undefined } };
    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 32);
  }
  
  /**
   * Cache query results
   */
  _cacheResults(key, results) {
    if (this.queryCache.size >= this.options.cacheSize) {
      // Remove oldest entry
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(key, {
      results,
      timestamp: Date.now()
    });
  }
  
  /**
   * Calculate cache hit rate for monitoring
   */
  _calculateCacheHitRate() {
    // This would be tracked in a real implementation
    return 0.75; // Mock value
  }
}

export default SparqlQueryEngine;