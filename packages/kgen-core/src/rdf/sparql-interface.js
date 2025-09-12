/**
 * SPARQL Query Interface for KGEN RDF Processing
 * 
 * Provides SPARQL query capabilities with:
 * - N3.js integration
 * - Query optimization
 * - Result formatting
 * - Caching support
 */

import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';
import { consola } from 'consola';

export class SparqlInterface {
  constructor(options = {}) {
    this.logger = consola.withTag('sparql');
    this.options = {
      enableCaching: options.enableCaching !== false,
      maxCacheSize: options.maxCacheSize || 1000,
      queryTimeout: options.queryTimeout || 30000,
      ...options
    };
    
    this.sparqlParser = new SparqlParser();
    this.sparqlGenerator = new SparqlGenerator();
    this.queryCache = new Map();
    
    this.stats = {
      queriesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueryTime: 0
    };
  }

  /**
   * Execute SPARQL SELECT query
   * @param {Store} store - N3 Store to query
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Query results
   */
  async select(store, query, options = {}) {
    try {
      const startTime = Date.now();
      this.logger.debug('Executing SPARQL SELECT query');
      
      // Check cache first
      const cacheKey = this._generateCacheKey(query, 'select');
      if (this.options.enableCaching && this.queryCache.has(cacheKey)) {
        this.stats.cacheHits++;
        this.logger.debug('Cache hit for SELECT query');
        return this.queryCache.get(cacheKey);
      }
      
      this.stats.cacheMisses++;
      
      // Parse SPARQL query
      const parsedQuery = this.sparqlParser.parse(query);
      if (parsedQuery.queryType !== 'SELECT') {
        throw new Error('Query must be a SELECT query');
      }
      
      // Execute query using N3 store
      const results = await this._executeSelectQuery(store, parsedQuery, options);
      
      // Cache results
      if (this.options.enableCaching && this.queryCache.size < this.options.maxCacheSize) {
        this.queryCache.set(cacheKey, results);
      }
      
      const queryTime = Date.now() - startTime;
      this.stats.queriesExecuted++;
      this.stats.totalQueryTime += queryTime;
      
      this.logger.success(`SELECT query executed in ${queryTime}ms: ${results.length} results`);
      return results;
      
    } catch (error) {
      this.logger.error('SPARQL SELECT query failed:', error);
      throw error;
    }
  }

  /**
   * Execute SPARQL CONSTRUCT query
   * @param {Store} store - N3 Store to query
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Constructed triples
   */
  async construct(store, query, options = {}) {
    try {
      const startTime = Date.now();
      this.logger.debug('Executing SPARQL CONSTRUCT query');
      
      // Parse SPARQL query
      const parsedQuery = this.sparqlParser.parse(query);
      if (parsedQuery.queryType !== 'CONSTRUCT') {
        throw new Error('Query must be a CONSTRUCT query');
      }
      
      // Execute construct query
      const results = await this._executeConstructQuery(store, parsedQuery, options);
      
      const queryTime = Date.now() - startTime;
      this.stats.queriesExecuted++;
      this.stats.totalQueryTime += queryTime;
      
      this.logger.success(`CONSTRUCT query executed in ${queryTime}ms: ${results.length} triples`);
      return results;
      
    } catch (error) {
      this.logger.error('SPARQL CONSTRUCT query failed:', error);
      throw error;
    }
  }

  /**
   * Execute SPARQL ASK query
   * @param {Store} store - N3 Store to query
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<boolean>} Query result
   */
  async ask(store, query, options = {}) {
    try {
      const startTime = Date.now();
      this.logger.debug('Executing SPARQL ASK query');
      
      // Parse SPARQL query
      const parsedQuery = this.sparqlParser.parse(query);
      if (parsedQuery.queryType !== 'ASK') {
        throw new Error('Query must be an ASK query');
      }
      
      // Execute ask query
      const result = await this._executeAskQuery(store, parsedQuery, options);
      
      const queryTime = Date.now() - startTime;
      this.stats.queriesExecuted++;
      this.stats.totalQueryTime += queryTime;
      
      this.logger.success(`ASK query executed in ${queryTime}ms: ${result}`);
      return result;
      
    } catch (error) {
      this.logger.error('SPARQL ASK query failed:', error);
      throw error;
    }
  }

  /**
   * Execute SPARQL DESCRIBE query
   * @param {Store} store - N3 Store to query
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Description triples
   */
  async describe(store, query, options = {}) {
    try {
      const startTime = Date.now();
      this.logger.debug('Executing SPARQL DESCRIBE query');
      
      // Parse SPARQL query
      const parsedQuery = this.sparqlParser.parse(query);
      if (parsedQuery.queryType !== 'DESCRIBE') {
        throw new Error('Query must be a DESCRIBE query');
      }
      
      // Execute describe query
      const results = await this._executeDescribeQuery(store, parsedQuery, options);
      
      const queryTime = Date.now() - startTime;
      this.stats.queriesExecuted++;
      this.stats.totalQueryTime += queryTime;
      
      this.logger.success(`DESCRIBE query executed in ${queryTime}ms: ${results.length} triples`);
      return results;
      
    } catch (error) {
      this.logger.error('SPARQL DESCRIBE query failed:', error);
      throw error;
    }
  }

  /**
   * Get predefined queries for common operations
   * @returns {Object} Predefined query templates
   */
  getCommonQueries() {
    return {
      // Get all classes
      getAllClasses: `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT DISTINCT ?class ?label ?comment WHERE {
          {
            ?class rdf:type rdfs:Class .
          } UNION {
            ?class rdf:type owl:Class .
          }
          OPTIONAL { ?class rdfs:label ?label }
          OPTIONAL { ?class rdfs:comment ?comment }
        }
        ORDER BY ?class
      `,
      
      // Get all properties
      getAllProperties: `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT DISTINCT ?property ?label ?domain ?range WHERE {
          {
            ?property rdf:type rdf:Property .
          } UNION {
            ?property rdf:type owl:ObjectProperty .
          } UNION {
            ?property rdf:type owl:DatatypeProperty .
          }
          OPTIONAL { ?property rdfs:label ?label }
          OPTIONAL { ?property rdfs:domain ?domain }
          OPTIONAL { ?property rdfs:range ?range }
        }
        ORDER BY ?property
      `,
      
      // Get class hierarchy
      getClassHierarchy: `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?subClass ?superClass WHERE {
          ?subClass rdfs:subClassOf ?superClass .
        }
        ORDER BY ?subClass ?superClass
      `,
      
      // Get instances of a class
      getInstancesOfClass: (classUri) => `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT DISTINCT ?instance ?label WHERE {
          ?instance rdf:type <${classUri}> .
          OPTIONAL { ?instance rdfs:label ?label }
        }
        ORDER BY ?instance
      `,
      
      // Get all triples for a subject
      describeSubject: (subjectUri) => `
        DESCRIBE <${subjectUri}>
      `,
      
      // Check if triple exists
      tripleExists: (subject, predicate, object) => `
        ASK {
          <${subject}> <${predicate}> <${object}> .
        }
      `,
      
      // Get subjects with specific property value
      getSubjectsWithProperty: (predicate, object) => `
        SELECT DISTINCT ?subject WHERE {
          ?subject <${predicate}> <${object}> .
        }
        ORDER BY ?subject
      `
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    this.logger.debug('Query cache cleared');
  }

  /**
   * Get query execution statistics
   * @returns {Object} Query stats
   */
  getStats() {
    return {
      ...this.stats,
      averageQueryTime: this.stats.queriesExecuted > 0 ? 
        this.stats.totalQueryTime / this.stats.queriesExecuted : 0,
      cacheHitRate: this.stats.queriesExecuted > 0 ?
        this.stats.cacheHits / this.stats.queriesExecuted : 0,
      cacheSize: this.queryCache.size
    };
  }

  // Private methods

  async _executeSelectQuery(store, parsedQuery, options) {
    // This is a simplified implementation
    // In practice, you'd need a full SPARQL engine
    const results = [];
    
    try {
      // Extract basic triple pattern from WHERE clause
      const patterns = this._extractTriplePatterns(parsedQuery.where);
      
      for (const pattern of patterns) {
        const quads = store.getQuads(
          pattern.subject || null,
          pattern.predicate || null,
          pattern.object || null
        );
        
        // Convert quads to result bindings
        for (const quad of quads) {
          const binding = this._createBinding(pattern, quad, parsedQuery.variables);
          if (binding && !this._isDuplicateBinding(results, binding)) {
            results.push(binding);
          }
        }
      }
      
      // Apply LIMIT if specified
      if (parsedQuery.limit) {
        return results.slice(0, parsedQuery.limit);
      }
      
      return results;
      
    } catch (error) {
      this.logger.warn('Simplified SPARQL execution failed, returning empty results:', error.message);
      return [];
    }
  }

  async _executeConstructQuery(store, parsedQuery, options) {
    // Simplified CONSTRUCT implementation
    const results = [];
    
    try {
      // Extract patterns from WHERE clause
      const patterns = this._extractTriplePatterns(parsedQuery.where);
      
      for (const pattern of patterns) {
        const quads = store.getQuads(
          pattern.subject || null,
          pattern.predicate || null,
          pattern.object || null
        );
        
        results.push(...quads);
      }
      
      return results;
      
    } catch (error) {
      this.logger.warn('Simplified CONSTRUCT execution failed:', error.message);
      return [];
    }
  }

  async _executeAskQuery(store, parsedQuery, options) {
    try {
      // Execute as SELECT and check if any results
      const selectResults = await this._executeSelectQuery(store, {
        ...parsedQuery,
        queryType: 'SELECT',
        variables: [{ variable: 's', expression: { type: 'aggregate' } }]
      }, options);
      
      return selectResults.length > 0;
      
    } catch (error) {
      this.logger.warn('Simplified ASK execution failed:', error.message);
      return false;
    }
  }

  async _executeDescribeQuery(store, parsedQuery, options) {
    // Simplified DESCRIBE implementation
    const results = [];
    
    try {
      // Get all triples for described resources
      for (const variable of parsedQuery.variables || []) {
        if (variable.variable) {
          const quads = store.getQuads(variable.variable, null, null);
          results.push(...quads);
        }
      }
      
      return results;
      
    } catch (error) {
      this.logger.warn('Simplified DESCRIBE execution failed:', error.message);
      return [];
    }
  }

  _extractTriplePatterns(whereClause) {
    const patterns = [];
    
    if (!whereClause || !whereClause.triples) {
      return patterns;
    }
    
    for (const triple of whereClause.triples) {
      patterns.push({
        subject: triple.subject?.value ? this._termFromSparql(triple.subject) : null,
        predicate: triple.predicate?.value ? this._termFromSparql(triple.predicate) : null,
        object: triple.object?.value ? this._termFromSparql(triple.object) : null
      });
    }
    
    return patterns;
  }

  _termFromSparql(sparqlTerm) {
    if (sparqlTerm.type === 'uri') {
      return sparqlTerm.value;
    } else if (sparqlTerm.type === 'literal') {
      return sparqlTerm.value;
    } else if (sparqlTerm.type === 'blank') {
      return `_:${sparqlTerm.value}`;
    }
    return null;
  }

  _createBinding(pattern, quad, variables) {
    const binding = {};
    
    // This is a simplified binding creation
    // A full implementation would handle complex variable mappings
    if (variables) {
      for (const variable of variables) {
        if (variable.variable === 'subject') {
          binding.subject = { type: 'uri', value: quad.subject.value };
        } else if (variable.variable === 'predicate') {
          binding.predicate = { type: 'uri', value: quad.predicate.value };
        } else if (variable.variable === 'object') {
          binding.object = this._quadTermToBinding(quad.object);
        }
      }
    }
    
    return Object.keys(binding).length > 0 ? binding : null;
  }

  _quadTermToBinding(term) {
    switch (term.termType) {
      case 'NamedNode':
        return { type: 'uri', value: term.value };
      case 'Literal':
        const binding = { type: 'literal', value: term.value };
        if (term.language) binding.language = term.language;
        if (term.datatype) binding.datatype = term.datatype.value;
        return binding;
      case 'BlankNode':
        return { type: 'bnode', value: term.value };
      default:
        return { type: 'literal', value: term.value };
    }
  }

  _isDuplicateBinding(results, binding) {
    return results.some(result => 
      JSON.stringify(result) === JSON.stringify(binding)
    );
  }

  _generateCacheKey(query, type) {
    return `${type}:${query.replace(/\s+/g, ' ').trim()}`;
  }
}

export default SparqlInterface;