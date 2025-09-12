/**
 * CLI Integration for KGEN SPARQL Engine
 * 
 * Provides command-line interface integration for the working SPARQL engine
 */

import { consola } from 'consola';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import SimpleSparqlEngine from './simple-sparql-engine.js';
import SemanticHasher from './semantic-hasher.js';

export class CliIntegration {
  constructor(options = {}) {
    this.config = {
      outputFormat: 'json',
      enableVerbose: false,
      indexOutputDir: '.kgen/index',
      queryTimeout: 30000,
      maxResults: 10000,
      ...options
    };
    
    this.logger = consola.withTag('sparql-cli');
    this.sparqlEngine = null;
    this.semanticHasher = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (this.config.enableVerbose) {
        this.logger.info('Initializing SPARQL CLI integration...');
      }
      
      // Initialize engines
      this.sparqlEngine = new SimpleSparqlEngine({
        maxResultSize: this.config.maxResults,
        queryTimeout: this.config.queryTimeout
      });
      
      this.semanticHasher = new SemanticHasher({
        performanceTarget: 10,
        normalizeBlankNodes: true
      });
      
      // Initialize engine
      await this.sparqlEngine.initialize();
      
      // Ensure output directories exist
      await mkdir(this.config.indexOutputDir, { recursive: true });
      
      this.initialized = true;
      
      if (this.config.enableVerbose) {
        this.logger.success('SPARQL CLI integration initialized');
      }
      
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Failed to initialize CLI integration:', error);
      throw error;
    }
  }

  async loadGraph(input, options = {}) {
    try {
      this._ensureInitialized();
      
      const format = options.format || this._detectFormat(input);
      let rdfData;
      
      if (existsSync(input)) {
        if (this.config.enableVerbose) {
          this.logger.debug(`Loading RDF from file: ${input}`);
        }
        rdfData = await readFile(input, 'utf8');
      } else {
        rdfData = input;
      }
      
      // Load into SPARQL engine
      const loadResult = await this.sparqlEngine.loadRdfData(rdfData, format);
      
      if (this.config.enableVerbose) {
        this.logger.success(`Loaded ${loadResult.loaded} triples into graph`);
      }
      
      return {
        tripleCount: loadResult.loaded,
        totalTriples: loadResult.total,
        format,
        graphHash: await this._calculateGraphHash(rdfData)
      };
      
    } catch (error) {
      this.logger.error('Failed to load graph:', error);
      throw error;
    }
  }

  async executeQuery(query, options = {}) {
    try {
      this._ensureInitialized();
      
      if (this.config.enableVerbose) {
        this.logger.debug('Executing SPARQL query');
      }
      
      const startTime = performance.now();
      const results = await this.sparqlEngine.executeQuery(query, {
        format: options.format || this.config.outputFormat,
        maxResults: options.limit || this.config.maxResults,
        skipCache: options.noCache
      });
      const executionTime = performance.now() - startTime;
      
      if (this.config.enableVerbose) {
        this.logger.success(`Query executed in ${executionTime.toFixed(2)}ms`);
      }
      
      // Save results if output file specified
      if (options.output) {
        await this._saveResults(results, options.output, options.format || this.config.outputFormat);
      }
      
      return {
        results,
        metadata: {
          executionTime: executionTime.toFixed(2),
          resultCount: this._getResultCount(results),
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to execute query:', error);
      throw error;
    }
  }

  async executeGraphIndex(graphPath, options = {}) {
    try {
      this._ensureInitialized();
      
      if (this.config.enableVerbose) {
        this.logger.info(`Building graph index for: ${graphPath}`);
      }
      
      const startTime = performance.now();
      
      // Load graph if not already loaded
      if (this.sparqlEngine.store.size === 0) {
        await this.loadGraph(graphPath, options);
      }
      
      // Build comprehensive index
      const index = await this._buildGraphIndex(graphPath);
      
      // Write index files
      await mkdir(this.config.indexOutputDir, { recursive: true });
      
      const indexPath = path.join(this.config.indexOutputDir, 'graph-index.json');
      const subjectMapPath = path.join(this.config.indexOutputDir, 'subject-artifact-map.json');
      
      await writeFile(indexPath, JSON.stringify(index, null, 2));
      await writeFile(subjectMapPath, JSON.stringify(index.subjects, null, 2));
      
      const executionTime = performance.now() - startTime;
      
      if (this.config.enableVerbose) {
        this.logger.success(`Graph index built in ${executionTime.toFixed(2)}ms`);
      }
      
      return {
        index,
        files: {
          indexPath,
          subjectMapPath
        },
        metrics: {
          executionTime: executionTime.toFixed(2),
          tripleCount: this.sparqlEngine.store.size,
          subjects: Object.keys(index.subjects).length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to build graph index:', error);
      throw error;
    }
  }

  async generateSemanticHash(input, options = {}) {
    try {
      this._ensureInitialized();
      
      if (this.config.enableVerbose) {
        this.logger.info('Generating semantic hash...');
      }
      
      let quads;
      
      if (typeof input === 'string' && existsSync(input)) {
        // Load from file
        await this.loadGraph(input, options);
        quads = this.sparqlEngine.store.getQuads();
      } else if (Array.isArray(input)) {
        // Use provided quads
        quads = input;
      } else {
        // Get from current store
        quads = this.sparqlEngine.store.getQuads();
      }
      
      const hashResult = await this.semanticHasher.generateHash(quads);
      
      if (this.config.enableVerbose) {
        this.logger.success(`Hash generated in ${hashResult.metadata.processingTime}ms`);
      }
      
      return hashResult;
      
    } catch (error) {
      this.logger.error('Failed to generate semantic hash:', error);
      throw error;
    }
  }

  async executeTemplateQueries(templateUri, options = {}) {
    try {
      this._ensureInitialized();
      
      if (this.config.enableVerbose) {
        this.logger.info(`Executing template queries for: ${templateUri}`);
      }
      
      // Query for template information
      const templateInfoQuery = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?property ?value WHERE {
          <${templateUri}> ?property ?value .
        }
      `;
      
      const templateInfo = await this.sparqlEngine.executeQuery(templateInfoQuery);
      
      // Query for template context
      const contextQuery = `
        SELECT ?subject ?predicate ?object WHERE {
          ?subject ?predicate <${templateUri}> .
        }
        UNION
        {
          <${templateUri}> ?predicate ?object .
        }
      `;
      
      const templateContext = await this.sparqlEngine.executeQuery(contextQuery);
      
      return {
        templateInfo: templateInfo.results?.bindings || [],
        templateContext: templateContext.results?.bindings || [],
        templateDependencies: [],
        requiredProperties: this._extractRequiredProperties(templateInfo.results?.bindings || [])
      };
      
    } catch (error) {
      this.logger.error('Failed to execute template queries:', error);
      throw error;
    }
  }

  async executeArtifactDependencies(artifactUris, options = {}) {
    try {
      this._ensureInitialized();
      
      if (this.config.enableVerbose) {
        this.logger.info(`Resolving dependencies for ${artifactUris.length} artifacts`);
      }
      
      const result = {
        metadata: {
          timestamp: new Date().toISOString(),
          inputArtifacts: artifactUris.length
        },
        artifacts: {}
      };
      
      // Query dependencies for each artifact
      for (const uri of artifactUris) {
        const dependencyQuery = `
          SELECT ?dependency WHERE {
            <${uri}> <http://kgen.enterprise/dependsOn> ?dependency .
          }
          UNION
          {
            ?dependency <http://kgen.enterprise/dependsOn> <${uri}> .
          }
        `;
        
        const dependencies = await this.sparqlEngine.executeQuery(dependencyQuery);
        
        result.artifacts[uri] = {
          dependencies: dependencies.results?.bindings?.map(b => b.dependency?.value) || [],
          directDependencies: dependencies.results?.bindings?.length || 0,
          transitiveDependencies: 0 // Would need recursive query for full implementation
        };
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to resolve artifact dependencies:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      integration: {
        version: '1.0.0',
        initialized: this.initialized,
        graphLoaded: this.sparqlEngine?.store.size > 0
      },
      sparqlEngine: this.sparqlEngine?.getStatus() || null,
      configuration: {
        outputFormat: this.config.outputFormat,
        queryTimeout: this.config.queryTimeout,
        maxResults: this.config.maxResults,
        indexOutputDir: this.config.indexOutputDir
      }
    };
  }

  // Private methods
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CLI integration not initialized. Call initialize() first.');
    }
  }

  _detectFormat(filePath) {
    if (!filePath || typeof filePath !== 'string') return 'turtle';
    
    const ext = filePath.split('.').pop().toLowerCase();
    switch (ext) {
      case 'ttl': return 'turtle';
      case 'nt': return 'n-triples';
      case 'n3': return 'n3';
      case 'rdf': case 'xml': return 'rdfxml';
      case 'jsonld': return 'jsonld';
      default: return 'turtle';
    }
  }

  async _calculateGraphHash(rdfData) {
    return this.semanticHasher.generateHash(
      this.sparqlEngine.store.getQuads()
    ).then(result => result.hash);
  }

  async _buildGraphIndex(graphPath) {
    const index = {
      metadata: {
        graphPath,
        timestamp: new Date().toISOString(),
        tripleCount: this.sparqlEngine.store.size,
        graphHash: await this._calculateGraphHash(),
        kgenVersion: '1.0.0'
      },
      subjects: {},
      artifacts: {},
      templates: {},
      dependencies: {},
      statistics: {}
    };
    
    // Build subject index
    const quads = this.sparqlEngine.store.getQuads();
    const subjectMap = {};
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          subject,
          properties: [],
          types: [],
          artifacts: [],
          templates: []
        };
      }
      
      subjectMap[subject].properties.push({
        predicate: quad.predicate.value,
        object: quad.object.value,
        objectType: quad.object.termType
      });
      
      // Check for type information
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        subjectMap[subject].types.push(quad.object.value);
      }
      
      // Check for template types
      if (quad.object.value === 'http://kgen.enterprise/Template') {
        index.templates[subject] = {
          uri: subject,
          name: null,
          type: 'Template',
          artifacts: []
        };
      }
    }
    
    index.subjects = subjectMap;
    
    // Calculate statistics
    const stats = {
      subjects: Object.keys(subjectMap).length,
      templates: Object.keys(index.templates).length,
      totalProperties: 0,
      uniquePredicates: new Set(),
      typeDistribution: {}
    };
    
    for (const subjectData of Object.values(subjectMap)) {
      stats.totalProperties += subjectData.properties.length;
      
      for (const prop of subjectData.properties) {
        stats.uniquePredicates.add(prop.predicate);
      }
      
      for (const type of subjectData.types) {
        stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + 1;
      }
    }
    
    stats.uniquePredicates = stats.uniquePredicates.size;
    index.statistics = stats;
    
    return index;
  }

  _getResultCount(results) {
    if (results.results?.bindings) {
      return results.results.bindings.length;
    }
    if (results.type === 'ask') {
      return results.boolean ? 1 : 0;
    }
    if (results.quads) {
      return results.quads.length;
    }
    return 0;
  }

  _extractRequiredProperties(bindings) {
    const required = [];
    for (const binding of bindings) {
      if (binding.property?.value.includes('required') && binding.value?.value === 'true') {
        required.push(binding.property.value);
      }
    }
    return required;
  }

  async _saveResults(results, outputPath, format = 'json') {
    let data;
    
    switch (format.toLowerCase()) {
      case 'json':
        data = JSON.stringify(results, null, 2);
        break;
      case 'csv':
        data = this._formatAsCSV(results);
        break;
      case 'xml':
        data = this._formatAsXML(results);
        break;
      default:
        data = JSON.stringify(results, null, 2);
    }
    
    await writeFile(outputPath, data, 'utf-8');
    
    if (this.config.enableVerbose) {
      this.logger.success(`Results saved to ${outputPath}`);
    }
  }

  _formatAsCSV(results) {
    if (!results.results?.bindings?.length) return '';
    
    const vars = results.head?.vars || Object.keys(results.results.bindings[0]);
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

  _formatAsXML(results) {
    // Basic XML formatting - could be enhanced
    return JSON.stringify(results, null, 2);
  }
}

export default CliIntegration;