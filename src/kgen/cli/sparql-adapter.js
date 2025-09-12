/**
 * SPARQL CLI Adapter for kgen Commands
 * 
 * Adapts existing SPARQL engines for CLI-friendly operations including:
 * - Graph indexing (kgen graph index)
 * - Template generation queries
 * - Graph diff impact analysis
 * - Artifact dependency resolution
 */

import { EventEmitter } from 'events';
import { ProvenanceQueries } from '../provenance/queries/sparql.js';
import { QueryEngine } from '../query/engine.js';
import { Store, DataFactory, Parser as N3Parser } from 'n3';
import consola from 'consola';
import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const { namedNode, literal } = DataFactory;

export class SparqlCliAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // CLI-specific configuration
      outputFormat: 'json', // json, csv, turtle, table
      enableVerbose: false,
      enableProgress: false,
      
      // Indexing configuration
      indexOutputDir: '.kgen/index',
      maxIndexSize: 1000000, // Max entries in index
      
      // Query performance
      queryTimeout: 30000,
      maxResults: 10000,
      enableQueryCache: true,
      
      // Template analysis
      templatePatterns: [
        'http://kgen.enterprise/template/',
        'http://xmlns.com/foaf/0.1/Document'
      ],
      
      ...config
    };
    
    this.logger = consola.withTag('sparql-cli');
    
    // Initialize components
    this.store = new Store();
    this.queryEngine = new QueryEngine({
      enableSPARQL: true,
      enableQueryOptimization: true,
      queryTimeout: this.config.queryTimeout,
      maxResultSize: this.config.maxResults
    });
    
    this.provenanceQueries = new ProvenanceQueries(this.store, {
      maxResults: this.config.maxResults,
      queryTimeout: this.config.queryTimeout,
      enableQueryOptimization: true
    });
    
    // Query templates for CLI operations
    this.cliQueryTemplates = this._initializeCliQueries();
    
    // Index cache
    this.indexCache = new Map();
    
    // Progress tracking
    this.progressCallback = null;
  }

  /**
   * Initialize the CLI adapter
   */
  async initialize() {
    try {
      this.logger.info('Initializing SPARQL CLI adapter...');
      
      await this.queryEngine.initialize();
      
      // Ensure index directory exists
      if (!existsSync(this.config.indexOutputDir)) {
        await mkdir(this.config.indexOutputDir, { recursive: true });
      }
      
      this.logger.success('SPARQL CLI adapter initialized');
      
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Failed to initialize SPARQL CLI adapter:', error);
      throw error;
    }
  }

  /**
   * Load RDF data from file or string
   * @param {string} input - File path or RDF string
   * @param {Object} options - Loading options
   */
  async loadGraph(input, options = {}) {
    try {
      const format = options.format || 'turtle';
      let rdfData;
      
      if (existsSync(input)) {
        // Load from file
        this.logger.debug(`Loading RDF from file: ${input}`);
        rdfData = await readFile(input, 'utf8');
      } else {
        // Treat as RDF string
        rdfData = input;
      }
      
      // Parse and load into store
      const parser = new N3Parser({ format });
      const quads = parser.parse(rdfData);
      
      this.store.addQuads(quads);
      
      // Load into query engine if available
      if (this.queryEngine.loadRDF) {
        await this.queryEngine.loadRDF(rdfData, format);
      }
      
      this.logger.success(`Loaded ${quads.length} triples into graph`);
      
      this.emit('graph:loaded', {
        tripleCount: quads.length,
        format,
        source: existsSync(input) ? input : 'string'
      });
      
      return {
        tripleCount: quads.length,
        format,
        graphHash: this._calculateGraphHash(rdfData)
      };
      
    } catch (error) {
      this.logger.error('Failed to load graph:', error);
      throw error;
    }
  }

  /**
   * Execute kgen graph index command
   * Build machine-readable index mapping subjects to artifacts
   */
  async executeGraphIndex(graphPath, options = {}) {
    try {
      this.logger.info(`Building graph index for: ${graphPath}`);
      
      const startTime = this.getDeterministicTimestamp();
      
      // Load graph if not already loaded
      if (this.store.size === 0) {
        await this.loadGraph(graphPath, options);
      }
      
      // Build comprehensive index
      const index = {
        metadata: {
          graphPath,
          timestamp: this.getDeterministicDate().toISOString(),
          tripleCount: this.store.size,
          graphHash: await this._getGraphHash(graphPath),
          kgenVersion: '1.0.0'
        },
        subjects: {},
        artifacts: {},
        templates: {},
        dependencies: {},
        statistics: {}
      };
      
      // Index subjects to artifacts mapping
      await this._indexSubjectArtifacts(index);
      
      // Index template relationships
      await this._indexTemplateRelationships(index);
      
      // Index dependency graph
      await this._indexDependencies(index);
      
      // Calculate statistics
      await this._calculateIndexStatistics(index);
      
      // Write index to disk
      const indexPath = path.join(this.config.indexOutputDir, 'graph-index.json');
      await writeFile(indexPath, JSON.stringify(index, null, 2));
      
      // Also create subject mapping file
      const subjectMapPath = path.join(this.config.indexOutputDir, 'subject-artifact-map.json');
      await writeFile(subjectMapPath, JSON.stringify(index.subjects, null, 2));
      
      const executionTime = this.getDeterministicTimestamp() - startTime;
      
      this.logger.success(`Graph index built in ${executionTime}ms`);
      this.logger.info(`Index written to: ${indexPath}`);
      
      this.emit('index:built', {
        indexPath,
        subjectMapPath,
        executionTime,
        statistics: index.statistics
      });
      
      if (this.config.outputFormat === 'json') {
        return index;
      } else {
        return this._formatOutput(index, this.config.outputFormat);
      }
      
    } catch (error) {
      this.logger.error('Failed to build graph index:', error);
      throw error;
    }
  }

  /**
   * Execute template generation queries
   * Find templates and their context requirements
   */
  async executeTemplateQueries(templateUri, options = {}) {
    try {
      this.logger.info(`Executing template queries for: ${templateUri}`);
      
      const queries = {
        templateInfo: this.cliQueryTemplates.templateInfo.replace('{{templateUri}}', templateUri),
        templateContext: this.cliQueryTemplates.templateContext.replace('{{templateUri}}', templateUri),
        templateDependencies: this.cliQueryTemplates.templateDependencies.replace('{{templateUri}}', templateUri),
        requiredProperties: this.cliQueryTemplates.requiredProperties.replace('{{templateUri}}', templateUri)
      };
      
      const results = {};
      
      for (const [queryName, query] of Object.entries(queries)) {
        try {
          const result = await this.provenanceQueries.executeQuery(query, options);
          results[queryName] = this._processQueryResults(result, queryName);
        } catch (error) {
          this.logger.warn(`Template query ${queryName} failed:`, error);
          results[queryName] = { error: error.message };
        }
      }
      
      this.emit('template:analyzed', {
        templateUri,
        results,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      return results;
      
    } catch (error) {
      this.logger.error('Failed to execute template queries:', error);
      throw error;
    }
  }

  /**
   * Execute graph diff impact analysis
   * Analyze changes between two graphs and their artifact impact
   */
  async executeGraphDiff(baseGraphPath, targetGraphPath, options = {}) {
    try {
      this.logger.info(`Analyzing graph diff impact: ${baseGraphPath} -> ${targetGraphPath}`);
      
      // Load base graph
      const baseStore = new Store();
      const baseRdf = await readFile(baseGraphPath, 'utf8');
      const baseParser = new N3Parser();
      baseStore.addQuads(baseParser.parse(baseRdf));
      
      // Load target graph  
      const targetStore = new Store();
      const targetRdf = await readFile(targetGraphPath, 'utf8');
      const targetParser = new N3Parser();
      targetStore.addQuads(targetParser.parse(targetRdf));
      
      // Calculate diff
      const baseQuads = baseStore.getQuads();
      const targetQuads = targetStore.getQuads();
      
      const baseSet = new Set(baseQuads.map(q => this._quadToString(q)));
      const targetSet = new Set(targetQuads.map(q => this._quadToString(q)));
      
      const added = targetQuads.filter(q => !baseSet.has(this._quadToString(q)));
      const removed = baseQuads.filter(q => !targetSet.has(this._quadToString(q)));
      
      // Analyze impact on artifacts
      const impactAnalysis = await this._analyzeArtifactImpact(added, removed, options);
      
      const diff = {
        metadata: {
          baseGraph: baseGraphPath,
          targetGraph: targetGraphPath,
          timestamp: this.getDeterministicDate().toISOString(),
          baseHash: this._calculateGraphHash(baseRdf),
          targetHash: this._calculateGraphHash(targetRdf)
        },
        changes: {
          added: added.length,
          removed: removed.length,
          modified: 0 // Could be calculated with more sophisticated diff
        },
        triples: {
          added: added.map(q => this._quadToTriple(q)),
          removed: removed.map(q => this._quadToTriple(q))
        },
        impact: impactAnalysis
      };
      
      this.emit('diff:analyzed', {
        baseGraph: baseGraphPath,
        targetGraph: targetGraphPath,
        changes: diff.changes,
        impactedArtifacts: impactAnalysis.artifacts?.length || 0
      });
      
      return diff;
      
    } catch (error) {
      this.logger.error('Failed to execute graph diff:', error);
      throw error;
    }
  }

  /**
   * Execute artifact dependency resolution
   * Find all dependencies for given artifacts
   */
  async executeArtifactDependencies(artifactUris, options = {}) {
    try {
      this.logger.info(`Resolving dependencies for ${artifactUris.length} artifacts`);
      
      const dependencies = {
        metadata: {
          timestamp: this.getDeterministicDate().toISOString(),
          inputArtifacts: artifactUris.length
        },
        artifacts: {}
      };
      
      for (const artifactUri of artifactUris) {
        const query = this.cliQueryTemplates.artifactDependencies
          .replace('{{artifactUri}}', artifactUri)
          .replace('{{maxDepth}}', options.maxDepth || '10');
        
        try {
          const result = await this.provenanceQueries.executeQuery(query, options);
          dependencies.artifacts[artifactUri] = {
            dependencies: this._processDependencyResults(result),
            directDependencies: 0,
            transitiveDependencies: 0
          };
          
          // Count dependencies
          const deps = dependencies.artifacts[artifactUri].dependencies;
          dependencies.artifacts[artifactUri].directDependencies = deps.filter(d => d.depth === 1).length;
          dependencies.artifacts[artifactUri].transitiveDependencies = deps.filter(d => d.depth > 1).length;
          
        } catch (error) {
          this.logger.warn(`Dependency resolution failed for ${artifactUri}:`, error);
          dependencies.artifacts[artifactUri] = { error: error.message };
        }
      }
      
      this.emit('dependencies:resolved', {
        inputArtifacts: artifactUris.length,
        resolvedArtifacts: Object.keys(dependencies.artifacts).length,
        timestamp: dependencies.metadata.timestamp
      });
      
      return dependencies;
      
    } catch (error) {
      this.logger.error('Failed to resolve artifact dependencies:', error);
      throw error;
    }
  }

  /**
   * Execute custom SPARQL query with CLI output formatting
   */
  async executeQuery(query, options = {}) {
    try {
      this.logger.debug('Executing custom SPARQL query');
      
      const result = await this.provenanceQueries.executeQuery(query, {
        ...options,
        maxResults: options.limit || this.config.maxResults
      });
      
      const formattedResult = {
        metadata: {
          timestamp: this.getDeterministicDate().toISOString(),
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
          resultCount: result.results?.bindings?.length || 0,
          executionTime: result.executionTime || 0
        },
        results: result
      };
      
      this.emit('query:executed', {
        resultCount: formattedResult.metadata.resultCount,
        executionTime: formattedResult.metadata.executionTime
      });
      
      if (options.format) {
        return this._formatOutput(formattedResult, options.format);
      }
      
      return formattedResult;
      
    } catch (error) {
      this.logger.error('Failed to execute SPARQL query:', error);
      throw error;
    }
  }

  /**
   * Get CLI adapter status
   */
  getStatus() {
    const queryEngineStatus = this.queryEngine.getStatus();
    const provenanceStats = this.provenanceQueries.getQueryStatistics();
    
    return {
      adapter: {
        version: '1.0.0',
        initialized: true,
        graphLoaded: this.store.size > 0
      },
      store: {
        tripleCount: this.store.size,
        indexCacheSize: this.indexCache.size
      },
      queryEngine: queryEngineStatus,
      provenance: provenanceStats,
      configuration: {
        outputFormat: this.config.outputFormat,
        queryTimeout: this.config.queryTimeout,
        maxResults: this.config.maxResults,
        indexOutputDir: this.config.indexOutputDir
      }
    };
  }

  // Private methods

  _initializeCliQueries() {
    return {
      templateInfo: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT ?template ?name ?description ?type ?version WHERE {
          <{{templateUri}}> a kgen:Template ;
                          foaf:name ?name ;
                          rdfs:comment ?description .
          OPTIONAL { <{{templateUri}}> kgen:templateType ?type }
          OPTIONAL { <{{templateUri}}> kgen:version ?version }
          BIND(<{{templateUri}}> AS ?template)
        }
      `,
      
      templateContext: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?property ?required ?dataType ?description WHERE {
          <{{templateUri}}> kgen:requiresProperty ?property .
          OPTIONAL { ?property kgen:required ?required }
          OPTIONAL { ?property rdfs:range ?dataType }
          OPTIONAL { ?property rdfs:comment ?description }
        }
      `,
      
      templateDependencies: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?dependency ?dependencyType ?version WHERE {
          <{{templateUri}}> kgen:dependsOn ?dependency .
          OPTIONAL { ?dependency a ?dependencyType }
          OPTIONAL { ?dependency kgen:version ?version }
        }
      `,
      
      requiredProperties: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?property ?label ?dataType ?required ?defaultValue WHERE {
          <{{templateUri}}> kgen:requiresProperty ?property .
          OPTIONAL { ?property rdfs:label ?label }
          OPTIONAL { ?property rdfs:range ?dataType }
          OPTIONAL { ?property kgen:required ?required }
          OPTIONAL { ?property kgen:defaultValue ?defaultValue }
        }
      `,
      
      artifactDependencies: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?artifact ?dependency ?relation ?depth WHERE {
          <{{artifactUri}}> (prov:wasDerivedFrom|kgen:dependsOn)* ?artifact .
          ?artifact (prov:wasDerivedFrom|kgen:dependsOn) ?dependency .
          OPTIONAL { ?artifact kgen:dependencyType ?relation }
        } LIMIT {{maxDepth}}
      `
    };
  }

  async _indexSubjectArtifacts(index) {
    const quads = this.store.getQuads();
    const subjectArtifactMap = {};
    
    for (const quad of quads) {
      const subject = quad.subject.value;
      
      if (!subjectArtifactMap[subject]) {
        subjectArtifactMap[subject] = {
          subject,
          properties: [],
          types: [],
          artifacts: [],
          templates: []
        };
      }
      
      // Add property
      subjectArtifactMap[subject].properties.push({
        predicate: quad.predicate.value,
        object: quad.object.value,
        objectType: quad.object.termType
      });
      
      // Check for type information
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        subjectArtifactMap[subject].types.push(quad.object.value);
      }
      
      // Check for artifact relationships
      if (this._isArtifactRelation(quad.predicate.value)) {
        subjectArtifactMap[subject].artifacts.push(quad.object.value);
      }
      
      // Check for template relationships
      if (this._isTemplateRelation(quad.predicate.value)) {
        subjectArtifactMap[subject].templates.push(quad.object.value);
      }
    }
    
    index.subjects = subjectArtifactMap;
    
    // Create reverse artifact-to-subject mapping
    const artifactSubjectMap = {};
    for (const [subject, data] of Object.entries(subjectArtifactMap)) {
      for (const artifact of data.artifacts) {
        if (!artifactSubjectMap[artifact]) {
          artifactSubjectMap[artifact] = [];
        }
        artifactSubjectMap[artifact].push(subject);
      }
    }
    
    index.artifacts = artifactSubjectMap;
  }

  async _indexTemplateRelationships(index) {
    const templateQuery = `
      PREFIX kgen: <http://kgen.enterprise/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?template ?name ?type ?artifact WHERE {
        ?template a kgen:Template .
        OPTIONAL { ?template foaf:name ?name }
        OPTIONAL { ?template kgen:templateType ?type }
        OPTIONAL { ?template kgen:generates ?artifact }
      }
    `;
    
    try {
      const result = await this.provenanceQueries.executeQuery(templateQuery);
      const templates = {};
      
      for (const binding of result.results?.bindings || []) {
        const templateUri = binding.template?.value;
        if (!templateUri) continue;
        
        if (!templates[templateUri]) {
          templates[templateUri] = {
            uri: templateUri,
            name: binding.name?.value,
            type: binding.type?.value,
            artifacts: []
          };
        }
        
        if (binding.artifact?.value) {
          templates[templateUri].artifacts.push(binding.artifact.value);
        }
      }
      
      index.templates = templates;
    } catch (error) {
      this.logger.warn('Failed to index template relationships:', error);
      index.templates = {};
    }
  }

  async _indexDependencies(index) {
    const dependencyQuery = `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX kgen: <http://kgen.enterprise/>
      
      SELECT ?source ?target ?relation WHERE {
        ?source (prov:wasDerivedFrom|kgen:dependsOn|kgen:requires) ?target .
        OPTIONAL { ?source kgen:dependencyType ?relation }
      }
    `;
    
    try {
      const result = await this.provenanceQueries.executeQuery(dependencyQuery);
      const dependencies = {};
      
      for (const binding of result.results?.bindings || []) {
        const source = binding.source?.value;
        const target = binding.target?.value;
        const relation = binding.relation?.value || 'dependsOn';
        
        if (!source || !target) continue;
        
        if (!dependencies[source]) {
          dependencies[source] = [];
        }
        
        dependencies[source].push({
          target,
          relation,
          type: 'direct'
        });
      }
      
      index.dependencies = dependencies;
    } catch (error) {
      this.logger.warn('Failed to index dependencies:', error);
      index.dependencies = {};
    }
  }

  async _calculateIndexStatistics(index) {
    const stats = {
      subjects: Object.keys(index.subjects).length,
      artifacts: Object.keys(index.artifacts).length,
      templates: Object.keys(index.templates).length,
      dependencies: Object.keys(index.dependencies).length,
      totalProperties: 0,
      uniquePredicates: new Set(),
      typeDistribution: {}
    };
    
    // Calculate property statistics
    for (const subjectData of Object.values(index.subjects)) {
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
  }

  async _analyzeArtifactImpact(addedQuads, removedQuads, options = {}) {
    const impactedSubjects = new Set();
    const impactedArtifacts = new Set();
    
    // Analyze added quads
    for (const quad of addedQuads) {
      impactedSubjects.add(quad.subject.value);
    }
    
    // Analyze removed quads
    for (const quad of removedQuads) {
      impactedSubjects.add(quad.subject.value);
    }
    
    // Map subjects to artifacts using index
    if (this.indexCache.has('subject-artifact-map')) {
      const subjectMap = this.indexCache.get('subject-artifact-map');
      
      for (const subject of impactedSubjects) {
        if (subjectMap[subject]?.artifacts) {
          for (const artifact of subjectMap[subject].artifacts) {
            impactedArtifacts.add(artifact);
          }
        }
      }
    }
    
    return {
      impactedSubjects: Array.from(impactedSubjects),
      artifacts: Array.from(impactedArtifacts),
      estimatedRebuildRequired: impactedArtifacts.size > 0,
      riskLevel: this._calculateRiskLevel(impactedArtifacts.size, impactedSubjects.size)
    };
  }

  _processQueryResults(result, queryType) {
    const bindings = result.results?.bindings || [];
    
    switch (queryType) {
      case 'templateInfo':
        return bindings.map(b => ({
          template: b.template?.value,
          name: b.name?.value,
          description: b.description?.value,
          type: b.type?.value,
          version: b.version?.value
        }));
        
      case 'templateContext':
        return bindings.map(b => ({
          property: b.property?.value,
          required: b.required?.value === 'true',
          dataType: b.dataType?.value,
          description: b.description?.value
        }));
        
      default:
        return bindings;
    }
  }

  _processDependencyResults(result) {
    const bindings = result.results?.bindings || [];
    
    return bindings.map(b => ({
      dependency: b.dependency?.value,
      relation: b.relation?.value || 'dependsOn',
      depth: parseInt(b.depth?.value || '1')
    }));
  }

  _isArtifactRelation(predicate) {
    const artifactPredicates = [
      'http://kgen.enterprise/generates',
      'http://kgen.enterprise/produces',
      'http://www.w3.org/ns/prov#wasGeneratedBy',
      'http://kgen.enterprise/artifact'
    ];
    
    return artifactPredicates.includes(predicate);
  }

  _isTemplateRelation(predicate) {
    return this.config.templatePatterns.some(pattern => 
      predicate.includes(pattern) || predicate.includes('template')
    );
  }

  _calculateGraphHash(rdfData) {
    return crypto.createHash('sha256').update(rdfData).digest('hex');
  }

  async _getGraphHash(graphPath) {
    if (existsSync(graphPath)) {
      const data = await readFile(graphPath, 'utf8');
      return this._calculateGraphHash(data);
    }
    return null;
  }

  _quadToString(quad) {
    return `${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`;
  }

  _quadToTriple(quad) {
    return {
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value,
      objectType: quad.object.termType
    };
  }

  _calculateRiskLevel(artifactCount, subjectCount) {
    if (artifactCount > 10 || subjectCount > 50) return 'high';
    if (artifactCount > 5 || subjectCount > 20) return 'medium';
    return 'low';
  }

  _formatOutput(data, format) {
    switch (format) {
      case 'csv':
        return this._formatAsCsv(data);
      case 'table':
        return this._formatAsTable(data);
      case 'turtle':
        return this._formatAsTurtle(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  _formatAsCsv(data) {
    // Simple CSV formatting for results
    if (data.results?.results?.bindings) {
      const bindings = data.results.results.bindings;
      if (bindings.length === 0) return '';
      
      const headers = Object.keys(bindings[0]);
      const csvRows = [headers.join(',')];
      
      for (const binding of bindings) {
        const row = headers.map(header => 
          binding[header]?.value || ''
        );
        csvRows.push(row.join(','));
      }
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(data);
  }

  _formatAsTable(data) {
    // Simple table formatting - in a real implementation, 
    // could use libraries like cli-table3
    return JSON.stringify(data, null, 2);
  }

  _formatAsTurtle(data) {
    // Convert results back to Turtle format
    // This would require more sophisticated implementation
    return '# Turtle output not fully implemented\n' + JSON.stringify(data);
  }
}

export default SparqlCliAdapter;