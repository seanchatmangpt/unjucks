/**
 * KGEN SPARQL Query Engine - Fixed Version
 * 
 * Enhanced SPARQL query processing engine with N3.js integration,
 * ported from working implementation with performance optimizations.
 */

import { EventEmitter } from 'events';
import { Store, DataFactory, Parser, Writer } from 'n3';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';
import crypto from 'crypto';
import { consola } from 'consola';

const { namedNode, literal, blankNode, quad } = DataFactory;

export class KgenSparqlEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableSPARQL: true,
      enableSemanticSearch: true,
      enableOptimization: true,
      queryTimeout: 30000,
      maxResultSize: 10000,
      enableQueryCache: true,
      cacheTTL: 600000,
      enableContextExtraction: true,
      maxContextEntities: 1000,
      contextImportanceThreshold: 0.1,
      enableProvenanceQueries: true,
      maxProvenanceDepth: 10,
      supportedFormats: ['json', 'xml', 'csv', 'turtle', 'n-triples'],
      defaultFormat: 'json',
      ...config
    };
    
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer();
    this.sparqlParser = new SparqlParser();
    this.sparqlGenerator = new SparqlGenerator();
    
    this.queryCache = new Map();
    this.queryStats = new Map();
    this.activeQueries = new Map();
    this.entityCache = new Map();
    this.propertyCache = new Map();
    this.classCache = new Map();
    this.queryTemplates = new Map();
    
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      contextExtractions: 0,
      formatConversions: 0
    };
    
    this.initializeQueryTemplates();
  }

  async initialize(options = {}) {
    try {
      consola.info('Initializing SPARQL engine...');
      
      if (options.rdfData) {
        await this.loadRdfData(options.rdfData, options.format || 'turtle');
      }
      
      if (options.ontologies) {
        await this.loadOntologies(options.ontologies);
      }
      
      this.state = 'ready';
      consola.success('SPARQL engine ready for queries');
      
      return { 
        status: 'success', 
        message: 'SPARQL engine initialized',
        storeSize: this.store.size,
        templatesLoaded: this.queryTemplates.size
      };
      
    } catch (error) {
      consola.error('SPARQL Engine initialization failed:', error);
      this.state = 'error';
      throw error;
    }
  }

  async executeQuery(query, options = {}) {
    const queryId = this._generateQueryId();
    const startTime = this._getDeterministicTimestamp();
    
    try {
      consola.debug(`Executing query ${queryId}`);
      this.metrics.totalQueries++;
      
      if (this.config.enableQueryCache && !options.skipCache) {
        const cached = this._getCachedResult(query);
        if (cached) {
          this.metrics.cacheHits++;
          this.emit('query:cache_hit', { queryId, query });
          return this._formatResults(cached, options.format || this.config.defaultFormat);
        }
        this.metrics.cacheMisses++;
      }
      
      const parsedQuery = this.sparqlParser.parse(query);
      
      const context = {
        queryId,
        query,
        parsedQuery,
        startTime,
        timeout: options.timeout || this.config.queryTimeout,
        maxResults: options.maxResults || this.config.maxResultSize,
        extractContext: options.extractContext || this.config.enableContextExtraction
      };
      
      this.activeQueries.set(queryId, context);
      
      let results;
      switch (parsedQuery.queryType) {
        case 'SELECT':
          results = await this._executeSelectQuery(context);
          break;
        case 'CONSTRUCT':
          results = await this._executeConstructQuery(context);
          break;
        case 'ASK':
          results = await this._executeAskQuery(context);
          break;
        case 'DESCRIBE':
          results = await this._executeDescribeQuery(context);
          break;
        default:
          throw new Error(`Unsupported query type: ${parsedQuery.queryType}`);
      }
      
      if (context.extractContext && parsedQuery.queryType === 'SELECT') {
        results.templateContext = this._extractTemplateContext(results, options);
        this.metrics.contextExtractions++;
      }
      
      const executionTime = this._getDeterministicTimestamp() - startTime;
      results.metadata = {
        queryId,
        executionTime,
        resultCount: this._getResultCount(results, parsedQuery.queryType),
        fromCache: false,
        queryType: parsedQuery.queryType
      };
      
      if (this.config.enableQueryCache && !options.skipCache) {
        this._cacheResult(query, results);
      }
      
      this._updateMetrics(context, executionTime, true);
      this.activeQueries.delete(queryId);
      this.metrics.successfulQueries++;
      
      this.emit('query:completed', { 
        queryId, 
        executionTime, 
        resultCount: results.metadata.resultCount 
      });
      
      return this._formatResults(results, options.format || this.config.defaultFormat);
      
    } catch (error) {
      const executionTime = this._getDeterministicTimestamp() - startTime;
      this._updateMetrics({ queryId, query }, executionTime, false);
      this.activeQueries.delete(queryId);
      
      this.metrics.failedQueries++;
      consola.error(`Query ${queryId} failed:`, error);
      this.emit('query:failed', { queryId, error, executionTime });
      throw error;
    }
  }

  async _executeSelectQuery(context) {
    const { parsedQuery } = context;
    const results = {
      head: { vars: [] },
      results: { bindings: [] }
    };
    
    try {
      if (parsedQuery.variables) {
        results.head.vars = parsedQuery.variables
          .filter(v => v.variable || v.expression)
          .map(v => v.variable || `expression_${Math.random().toString(36).substr(2, 5)}`);
      }
      
      const bindings = await this._evaluateWhereClause(parsedQuery.where, context);
      
      let processedBindings = bindings;
      
      if (parsedQuery.order && parsedQuery.order.length > 0) {
        processedBindings = this._applyOrderBy(processedBindings, parsedQuery.order);
      }
      
      if (parsedQuery.offset) {
        processedBindings = processedBindings.slice(parsedQuery.offset);
      }
      
      if (parsedQuery.limit) {
        processedBindings = processedBindings.slice(0, parsedQuery.limit);
      }
      
      results.results.bindings = processedBindings.slice(0, context.maxResults);
      
      return results;
      
    } catch (error) {
      consola.error('SELECT query execution failed:', error);
      throw error;
    }
  }

  async _executeConstructQuery(context) {
    const { parsedQuery } = context;
    
    try {
      const bindings = await this._evaluateWhereClause(parsedQuery.where, context);
      const constructedQuads = [];
      
      for (const binding of bindings) {
        for (const template of parsedQuery.template || []) {
          try {
            const quad = this._instantiateTriplePattern(template, binding);
            if (quad) {
              constructedQuads.push(quad);
            }
          } catch (error) {
            consola.warn('Failed to instantiate triple pattern:', error.message);
          }
        }
      }
      
      return {
        type: 'construct',
        quads: constructedQuads,
        count: constructedQuads.length
      };
      
    } catch (error) {
      consola.error('CONSTRUCT query execution failed:', error);
      throw error;
    }
  }

  async _executeAskQuery(context) {
    try {
      const bindings = await this._evaluateWhereClause(context.parsedQuery.where, context);
      
      return {
        type: 'ask',
        boolean: bindings.length > 0
      };
      
    } catch (error) {
      consola.error('ASK query execution failed:', error);
      throw error;
    }
  }

  async _executeDescribeQuery(context) {
    const { parsedQuery } = context;
    
    try {
      const describedQuads = [];
      let resources = [];
      
      if (parsedQuery.variables) {
        const bindings = await this._evaluateWhereClause(parsedQuery.where, context);
        
        for (const binding of bindings) {
          for (const variable of parsedQuery.variables) {
            if (variable.variable && binding[variable.variable]) {
              resources.push(binding[variable.variable].value);
            }
          }
        }
      } else {
        resources = parsedQuery.variables || [];
      }
      
      for (const resource of resources) {
        const resourceNode = namedNode(resource);
        const subjectQuads = this.store.getQuads(resourceNode, null, null);
        describedQuads.push(...subjectQuads);
        const objectQuads = this.store.getQuads(null, null, resourceNode);
        describedQuads.push(...objectQuads);
      }
      
      const uniqueQuads = Array.from(new Set(describedQuads.map(q => q.toString())))
        .map(str => describedQuads.find(q => q.toString() === str));
      
      return {
        type: 'describe',
        quads: uniqueQuads,
        count: uniqueQuads.length
      };
      
    } catch (error) {
      consola.error('DESCRIBE query execution failed:', error);
      throw error;
    }
  }

  async _evaluateWhereClause(whereClause, context) {
    if (!whereClause) return [];
    
    const bindings = [];
    
    if (whereClause.type === 'bgp' && whereClause.triples) {
      const results = await this._evaluateBasicGraphPattern(whereClause.triples, context);
      bindings.push(...results);
    }
    
    if (whereClause.type === 'group' && whereClause.patterns) {
      for (const pattern of whereClause.patterns) {
        const patternResults = await this._evaluateWhereClause(pattern, context);
        bindings.push(...patternResults);
      }
    }
    
    return bindings;
  }

  async _evaluateBasicGraphPattern(triples, context) {
    const bindings = [];
    
    for (const triple of triples) {
      const quads = this.store.getQuads(
        this._termFromPattern(triple.subject),
        this._termFromPattern(triple.predicate),
        this._termFromPattern(triple.object)
      );
      
      for (const quad of quads) {
        const binding = this._createBindingFromQuad(triple, quad);
        if (binding && !this._isDuplicateBinding(bindings, binding)) {
          bindings.push(binding);
        }
      }
    }
    
    return bindings.slice(0, context.maxResults);
  }

  _termFromPattern(patternTerm) {
    if (!patternTerm) return null;
    
    switch (patternTerm.termType) {
      case 'Variable':
        return null;
      case 'NamedNode':
        return namedNode(patternTerm.value);
      case 'Literal':
        return literal(patternTerm.value, patternTerm.language || patternTerm.datatype);
      case 'BlankNode':
        return blankNode(patternTerm.value);
      default:
        return null;
    }
  }

  _createBindingFromQuad(pattern, quad) {
    const binding = {};
    
    if (pattern.subject.termType === 'Variable') {
      binding[pattern.subject.value] = this._termToBinding(quad.subject);
    }
    
    if (pattern.predicate.termType === 'Variable') {
      binding[pattern.predicate.value] = this._termToBinding(quad.predicate);
    }
    
    if (pattern.object.termType === 'Variable') {
      binding[pattern.object.value] = this._termToBinding(quad.object);
    }
    
    return Object.keys(binding).length > 0 ? binding : null;
  }

  _termToBinding(term) {
    switch (term.termType) {
      case 'NamedNode':
        return { type: 'uri', value: term.value };
      case 'Literal':
        const binding = { type: 'literal', value: term.value };
        if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
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

  async loadRdfData(data, format = 'turtle') {
    consola.info('Loading RDF data...');
    
    try {
      const parser = new Parser({ format, factory: DataFactory });
      const quads = parser.parse(data);
      
      this.store.addQuads(quads);
      
      consola.success(`Loaded ${quads.length} triples (total: ${this.store.size})`);
      return { loaded: quads.length, total: this.store.size };
      
    } catch (error) {
      consola.error('Failed to load RDF data:', error);
      throw error;
    }
  }

  _formatResults(results, format = 'json') {
    this.metrics.formatConversions++;
    
    switch (format.toLowerCase()) {
      case 'json':
        return results;
      case 'xml':
        return this._formatAsXML(results);
      case 'csv':
        return this._formatAsCSV(results);
      case 'turtle':
      case 'ttl':
        return this._formatAsTurtle(results);
      case 'n-triples':
      case 'nt':
        return this._formatAsNTriples(results);
      default:
        consola.warn(`Unsupported format: ${format}, returning JSON`);
        return results;
    }
  }

  _formatAsXML(results) {
    if (results.type === 'ask') {
      return `<?xml version="1.0"?>
<sparql xmlns="http://www.w3.org/2005/sparql-results#">
  <boolean>${results.boolean}</boolean>
</sparql>`;
    }
    
    if (results.head && results.results) {
      let xml = `<?xml version="1.0"?>
<sparql xmlns="http://www.w3.org/2005/sparql-results#">
  <head>
${results.head.vars.map(v => `    <variable name="${v}"/>`).join('\n')}
  </head>
  <results>
`;
      
      for (const binding of results.results.bindings) {
        xml += '    <result>\n';
        for (const [variable, value] of Object.entries(binding)) {
          xml += `      <binding name="${variable}">`;
          if (value.type === 'uri') {
            xml += `<uri>${value.value}</uri>`;
          } else if (value.type === 'literal') {
            const attrs = [];
            if (value.datatype) attrs.push(`datatype="${value.datatype}"`);
            if (value['xml:lang']) attrs.push(`xml:lang="${value['xml:lang']}"`);
            xml += `<literal${attrs.length ? ' ' + attrs.join(' ') : ''}>${value.value}</literal>`;
          } else {
            xml += `<bnode>${value.value}</bnode>`;
          }
          xml += '</binding>\n';
        }
        xml += '    </result>\n';
      }
      
      xml += '  </results>\n</sparql>';
      return xml;
    }
    
    return '<?xml version="1.0"?><sparql xmlns="http://www.w3.org/2005/sparql-results#"></sparql>';
  }

  _formatAsCSV(results) {
    if (!results.head || !results.results) {
      return '';
    }
    
    const vars = results.head.vars;
    let csv = vars.join(',') + '\n';
    
    for (const binding of results.results.bindings) {
      const row = vars.map(variable => {
        const value = binding[variable];
        return value ? `"${value.value.replace(/"/g, '""')}"` : '';
      });
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  _formatAsTurtle(results) {
    if (results.quads) {
      const writer = new Writer();
      return writer.quadsToString(results.quads);
    }
    return '';
  }

  _formatAsNTriples(results) {
    if (results.quads) {
      return results.quads.map(quad => {
        const subject = this._termToNTriples(quad.subject);
        const predicate = this._termToNTriples(quad.predicate);
        const object = this._termToNTriples(quad.object);
        return `${subject} ${predicate} ${object} .`;
      }).join('\n');
    }
    return '';
  }

  _termToNTriples(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        let result = `"${term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        return result;
      default:
        return term.value;
    }
  }

  _getResultCount(results, queryType) {
    switch (queryType) {
      case 'SELECT':
        return results.results?.bindings?.length || 0;
      case 'CONSTRUCT':
      case 'DESCRIBE':
        return results.quads?.length || 0;
      case 'ASK':
        return results.boolean ? 1 : 0;
      default:
        return 0;
    }
  }

  initializeQueryTemplates() {
    this.queryTemplates.set('list-classes', {
      name: 'list-classes',
      sparql: `
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
      `
    });

    this.queryTemplates.set('list-properties', {
      name: 'list-properties',
      sparql: `
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
      `
    });

    consola.info(`Initialized ${this.queryTemplates.size} query templates`);
  }

  _extractTemplateContext(results, options = {}) {
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
    
    const entityUris = new Set();
    
    for (const binding of results.results.bindings) {
      for (const [variable, term] of Object.entries(binding)) {
        if (term.type === 'uri') {
          entityUris.add(term.value);
        }
      }
    }
    
    for (const uri of Array.from(entityUris).slice(0, this.config.maxContextEntities)) {
      context.entities.push({
        uri,
        type: 'Entity',
        importance: 0.5
      });
    }
    
    context.statistics = {
      entityCount: context.entities.length,
      resultCount: results.results.bindings.length,
      extractionTime: Date.now()
    };
    
    return context;
  }

  _generateQueryId() {
    return `sparql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _getDeterministicTimestamp() {
    return Date.now();
  }

  _getCachedResult(query) {
    const cacheKey = crypto.createHash('md5').update(query).digest('hex');
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
      return cached.result;
    }
    
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return null;
  }

  _cacheResult(query, result) {
    const cacheKey = crypto.createHash('md5').update(query).digest('hex');
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  _updateMetrics(context, executionTime, success) {
    const currentAvg = this.metrics.averageExecutionTime;
    const totalQueries = this.metrics.totalQueries;
    
    this.metrics.averageExecutionTime = 
      (currentAvg * (totalQueries - 1) + executionTime) / totalQueries;
  }

  _isDuplicateBinding(bindings, binding) {
    return bindings.some(b => JSON.stringify(b) === JSON.stringify(binding));
  }

  getStatus() {
    return {
      state: this.state,
      activeQueries: this.activeQueries.size,
      cachedQueries: this.queryCache.size,
      templates: this.queryTemplates.size,
      storeSize: this.store.size,
      metrics: this.metrics
    };
  }

  async shutdown() {
    this.queryCache.clear();
    this.entityCache.clear();
    this.propertyCache.clear();
    this.classCache.clear();
    this.activeQueries.clear();
    
    consola.info('SPARQL engine shutdown complete');
  }
}

export default KgenSparqlEngine;