/**
 * SPARQL Command Line Interface for KGEN
 * 
 * Provides command-line access to SPARQL query execution with:
 * - Interactive query execution
 * - Template variable extraction
 * - Context extraction for artifacts
 * - Query result formatting and export
 * - Integration with KGEN workflow
 */

import { consola } from 'consola';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { SparqlEngine } from '../sparql-engine.js';
import { QueryTemplates } from '../query-templates.js';
import { GraphProcessor } from '../rdf/graph-processor.js';

export class SparqlCommand {
  constructor(options = {}) {
    this.logger = consola.withTag('sparql-cli');
    this.options = {
      outputFormat: 'json',
      maxResults: 1000,
      enablePrettyPrint: true,
      enableProvenance: true,
      ...options
    };

    // Initialize components
    this.graphProcessor = null;
    this.sparqlEngine = null;
    this.queryTemplates = null;
  }

  /**
   * Initialize SPARQL engine with graph data
   * @param {string} graphPath - Path to RDF graph file
   * @param {Object} options - Initialization options
   */
  async initialize(graphPath, options = {}) {
    try {
      this.logger.info(`Initializing SPARQL engine with graph: ${graphPath}`);
      
      // Initialize graph processor
      this.graphProcessor = new GraphProcessor(options.graph);
      
      // Load RDF data if path provided
      if (graphPath) {
        const graphData = await readFile(graphPath, 'utf-8');
        const format = this._detectFormat(graphPath);
        
        const parseResult = await this.graphProcessor.parseRDF(graphData, format);
        this.graphProcessor.addQuads(parseResult.quads);
        
        this.logger.success(`Loaded ${parseResult.count} triples from ${graphPath}`);
      }
      
      // Initialize SPARQL engine
      this.sparqlEngine = new SparqlEngine({
        ...options,
        graphProcessor: this.graphProcessor
      });
      
      // Initialize query templates
      this.queryTemplates = new QueryTemplates(options.templates);
      
      this.logger.success('SPARQL engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize SPARQL engine:', error);
      throw error;
    }
  }

  /**
   * Execute a SPARQL query from command line
   * @param {string} query - SPARQL query string or file path
   * @param {Object} options - Execution options
   */
  async executeQuery(query, options = {}) {
    try {
      this._ensureInitialized();
      
      // Check if query is a file path
      let queryString = query;
      if (query.endsWith('.sparql') || query.endsWith('.rq')) {
        queryString = await readFile(resolve(query), 'utf-8');
        this.logger.info(`Loaded query from file: ${query}`);
      }
      
      // Execute query
      this.logger.info('Executing SPARQL query...');
      const startTime = this.getDeterministicTimestamp();
      
      const results = await this.sparqlEngine.executeQuery(queryString, {
        maxResults: options.limit || this.options.maxResults,
        skipCache: options.noCache,
        ...options
      });
      
      const executionTime = this.getDeterministicTimestamp() - startTime;
      
      // Format and display results
      await this._displayResults(results, options);
      
      // Save results if output file specified
      if (options.output) {
        await this._saveResults(results, options.output, options.format);
      }
      
      this.logger.success(`Query executed in ${executionTime}ms`);
      return results;
      
    } catch (error) {
      this.logger.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a predefined query template
   * @param {string} templateName - Name of the query template
   * @param {Object} variables - Variables for template substitution
   * @param {Object} options - Execution options
   */
  async executeTemplate(templateName, variables = {}, options = {}) {
    try {
      this._ensureInitialized();
      
      this.logger.info(`Executing template query: ${templateName}`);
      
      // Get query from template
      const queryString = this.queryTemplates.getQuery(templateName, variables);
      
      // Execute query
      return await this.executeQuery(queryString, options);
      
    } catch (error) {
      this.logger.error('Template execution failed:', error);
      throw error;
    }
  }

  /**
   * Extract template variables for artifact generation
   * @param {string} templatePath - Path to template
   * @param {Object} context - Context for variable resolution
   * @param {Object} options - Extraction options
   */
  async extractVariables(templatePath, context = {}, options = {}) {
    try {
      this._ensureInitialized();
      
      this.logger.info(`Extracting variables for template: ${templatePath}`);
      
      const variables = await this.sparqlEngine.extractTemplateVariables(templatePath, context);
      
      // Format variables for display
      if (options.verbose) {
        this._displayVariables(variables);
      }
      
      // Save variables if output specified
      if (options.output) {
        await this._saveVariables(variables, options.output);
      }
      
      this.logger.success(`Extracted ${Object.keys(variables).length} template variables`);
      return variables;
      
    } catch (error) {
      this.logger.error('Variable extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract context for entity
   * @param {string} entityUri - Entity URI
   * @param {Object} options - Context extraction options
   */
  async extractContext(entityUri, options = {}) {
    try {
      this._ensureInitialized();
      
      this.logger.info(`Extracting context for entity: ${entityUri}`);
      
      const context = await this.sparqlEngine.extractContext(entityUri, options);
      
      // Display context if verbose
      if (options.verbose) {
        this._displayContext(context);
      }
      
      // Save context if output specified
      if (options.output) {
        await this._saveContext(context, options.output);
      }
      
      this.logger.success('Context extraction completed');
      return context;
      
    } catch (error) {
      this.logger.error('Context extraction failed:', error);
      throw error;
    }
  }

  /**
   * Analyze impact of changes to entity
   * @param {string} entityUri - Entity URI
   * @param {Object} options - Analysis options
   */
  async analyzeImpact(entityUri, options = {}) {
    try {
      this._ensureInitialized();
      
      this.logger.info(`Analyzing impact for entity: ${entityUri}`);
      
      const impact = await this.sparqlEngine.analyzeImpact(entityUri, options);
      
      // Display impact analysis
      this._displayImpact(impact);
      
      // Save impact analysis if output specified
      if (options.output) {
        await this._saveImpact(impact, options.output);
      }
      
      return impact;
      
    } catch (error) {
      this.logger.error('Impact analysis failed:', error);
      throw error;
    }
  }

  /**
   * Validate graph integrity
   * @param {Object} options - Validation options
   */
  async validateGraph(options = {}) {
    try {
      this._ensureInitialized();
      
      this.logger.info('Validating graph integrity...');
      
      const validation = await this.sparqlEngine.validateGraph(options);
      
      // Display validation results
      this._displayValidation(validation);
      
      // Save validation results if output specified
      if (options.output) {
        await this._saveValidation(validation, options.output);
      }
      
      return validation;
      
    } catch (error) {
      this.logger.error('Graph validation failed:', error);
      throw error;
    }
  }

  /**
   * List available query templates
   * @param {string} category - Optional category filter
   */
  listTemplates(category = null) {
    this._ensureInitialized();
    
    const templates = category 
      ? this.queryTemplates.getTemplatesByCategory(category)
      : this.queryTemplates.templates;
    
    console.log('\\nAvailable Query Templates:');
    console.log('=' .repeat(50));
    
    for (const [name, template] of Object.entries(templates)) {
      const preview = template.split('\\n').find(line => line.trim().startsWith('SELECT')) || 
                     template.split('\\n')[1] || 'No preview available';
      console.log(`${name}:`);
      console.log(`  ${preview.trim()}`);
      console.log();
    }
  }

  /**
   * Show engine statistics
   */
  showStats() {
    this._ensureInitialized();
    
    const stats = this.sparqlEngine.getMetrics();
    const graphStats = this.graphProcessor.getStats();
    
    console.log('\\nSPARQL Engine Statistics:');
    console.log('=' .repeat(50));
    console.log(`Queries executed: ${stats.queriesExecuted}`);
    console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
    console.log(`Average query time: ${stats.averageExecutionTime.toFixed(2)}ms`);
    console.log(`Graph size: ${stats.graphSize} triples`);
    console.log(`Cache size: ${stats.cacheSize}/${stats.maxCacheSize}`);
    console.log();
    
    console.log('Graph Statistics:');
    console.log('-' .repeat(30));
    console.log(`Total quads: ${graphStats.totalQuads}`);
    console.log(`Subjects: ${graphStats.subjects}`);
    console.log(`Predicates: ${graphStats.predicates}`);
    console.log(`Objects: ${graphStats.objects}`);
    console.log(`Named graphs: ${graphStats.graphs}`);
  }

  /**
   * Interactive query shell
   */
  async interactive() {
    this._ensureInitialized();
    
    console.log('\\n🔍 KGEN SPARQL Interactive Shell');
    console.log('Type queries or commands. Use .help for assistance, .exit to quit.\\n');
    
    // Simple interactive implementation
    // In a real implementation, you'd use readline or similar
    this.logger.info('Interactive mode would be implemented here');
  }

  // Private helper methods

  _ensureInitialized() {
    if (!this.sparqlEngine) {
      throw new Error('SPARQL engine not initialized. Call initialize() first.');
    }
  }

  _detectFormat(filePath) {
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

  async _displayResults(results, options = {}) {
    if (!results.results?.bindings?.length) {
      console.log('No results found.');
      return;
    }
    
    const format = options.format || this.options.outputFormat;
    
    switch (format) {
      case 'json':
        console.log(JSON.stringify(results, null, options.pretty ? 2 : 0));
        break;
      case 'table':
        this._displayTable(results.results.bindings);
        break;
      case 'csv':
        this._displayCSV(results.results.bindings);
        break;
      default:
        console.log(JSON.stringify(results, null, 2));
    }
  }

  _displayTable(bindings) {
    if (!bindings.length) return;
    
    // Get column headers
    const headers = Object.keys(bindings[0]);
    
    // Calculate column widths
    const widths = headers.map(h => 
      Math.max(h.length, ...bindings.map(b => String(b[h]?.value || '').length))
    );
    
    // Display header
    console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
    console.log(widths.map(w => '-'.repeat(w)).join('-+-'));
    
    // Display rows
    for (const binding of bindings) {
      const row = headers.map((h, i) => 
        String(binding[h]?.value || '').padEnd(widths[i])
      );
      console.log(row.join(' | '));
    }
  }

  _displayCSV(bindings) {
    if (!bindings.length) return;
    
    const headers = Object.keys(bindings[0]);
    console.log(headers.join(','));
    
    for (const binding of bindings) {
      const row = headers.map(h => `"${binding[h]?.value || ''}"`);
      console.log(row.join(','));
    }
  }

  _displayVariables(variables) {
    console.log('\\nExtracted Variables:');
    console.log('=' .repeat(40));
    
    for (const [name, info] of Object.entries(variables)) {
      console.log(`${name}: ${info.value} (${info.type}) [${info.source}]`);
    }
  }

  _displayContext(context) {
    console.log('\\nEntity Context:');
    console.log('=' .repeat(40));
    console.log(`Entity: ${context.entity}`);
    console.log(`Properties: ${Object.keys(context.properties).length}`);
    console.log(`Relationships: ${Object.keys(context.relationships).length}`);
    console.log(`Metadata: ${Object.keys(context.metadata).length}`);
    if (context.provenance) {
      console.log(`Provenance: ${context.provenance.lineage.length} lineage entries`);
    }
  }

  _displayImpact(impact) {
    console.log('\\nImpact Analysis:');
    console.log('=' .repeat(40));
    console.log(`Entity: ${impact.entity}`);
    console.log(`Impact Score: ${impact.impactScore}`);
    console.log(`Risk Level: ${impact.riskLevel}`);
    console.log(`Direct Dependents: ${impact.directDependents.length}`);
    console.log(`Indirect Dependents: ${impact.indirectDependents.length}`);
    console.log(`Dependencies: ${impact.dependencies.length}`);
  }

  _displayValidation(validation) {
    console.log('\\nGraph Validation:');
    console.log('=' .repeat(40));
    console.log(`Overall Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`Health Score: ${validation.healthScore.toFixed(2)}%`);
    console.log(`Errors: ${validation.errors.length}`);
    console.log(`Warnings: ${validation.warnings.length}`);
    
    if (validation.errors.length > 0) {
      console.log('\\nErrors:');
      validation.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('\\nWarnings:');
      validation.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
  }

  async _saveResults(results, outputPath, format = 'json') {
    const data = format === 'json' 
      ? JSON.stringify(results, null, 2)
      : this._formatResults(results, format);
    
    await writeFile(outputPath, data, 'utf-8');
    this.logger.success(`Results saved to ${outputPath}`);
  }

  async _saveVariables(variables, outputPath) {
    const data = JSON.stringify(variables, null, 2);
    await writeFile(outputPath, data, 'utf-8');
    this.logger.success(`Variables saved to ${outputPath}`);
  }

  async _saveContext(context, outputPath) {
    const data = JSON.stringify(context, null, 2);
    await writeFile(outputPath, data, 'utf-8');
    this.logger.success(`Context saved to ${outputPath}`);
  }

  async _saveImpact(impact, outputPath) {
    const data = JSON.stringify(impact, null, 2);
    await writeFile(outputPath, data, 'utf-8');
    this.logger.success(`Impact analysis saved to ${outputPath}`);
  }

  async _saveValidation(validation, outputPath) {
    const data = JSON.stringify(validation, null, 2);
    await writeFile(outputPath, data, 'utf-8');
    this.logger.success(`Validation results saved to ${outputPath}`);
  }

  _formatResults(results, format) {
    // Implement additional format conversions as needed
    return JSON.stringify(results, null, 2);
  }
}

export default SparqlCommand;