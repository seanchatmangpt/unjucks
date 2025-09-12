/**
 * Enhanced Query Methods - Additional methods for the SPARQL Query Engine
 * 
 * Provides RDF loading, template context extraction, validation, 
 * and other advanced query engine capabilities.
 */

import { Consola } from 'consola';
import { Parser as N3Parser } from 'n3';

export class EnhancedQueryMethods {
  constructor(queryEngine) {
    this.queryEngine = queryEngine;
    this.logger = new Consola({ tag: 'enhanced-query' });
  }

  /**
   * Load RDF data from file
   * @param {string} filePath - Path to RDF file
   * @param {string} format - RDF format (turtle, n3, nt, etc.)
   */
  async loadRDFFromFile(filePath, format = 'turtle') {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath, 'utf8');
      await this.loadRDFFromString(data, format);
      this.logger.success(`Loaded RDF data from ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to load RDF from file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load RDF data from URL
   * @param {string} url - URL to RDF resource
   * @param {string} format - RDF format
   */
  async loadRDFFromURL(url, format = 'turtle') {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.text();
      await this.loadRDFFromString(data, format);
      this.logger.success(`Loaded RDF data from ${url}`);
    } catch (error) {
      this.logger.error(`Failed to load RDF from URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load RDF data from string
   * @param {string} data - RDF data string
   * @param {string} format - RDF format
   */
  async loadRDFFromString(data, format = 'turtle') {
    try {
      const parser = new N3Parser({ format });
      const quads = parser.parse(data);
      
      for (const quad of quads) {
        this.queryEngine.queryStore.addQuad(quad);
      }
      
      this.logger.info(`Added ${quads.length} RDF triples to store`);
      
      // Update statistics if enabled
      if (this.queryEngine.config.enableStatistics) {
        await this.queryEngine.queryOptimizer._collectStatistics(this.queryEngine.queryStore);
      }
      
    } catch (error) {
      this.logger.error(`Failed to parse RDF data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a template query pattern
   * @param {string} patternName - Name of the query pattern
   * @param {Object} parameters - Parameters for the pattern
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Query results
   */
  async executeTemplatePattern(patternName, parameters = {}, options = {}) {
    try {
      const pattern = this.queryEngine.templatePatterns.getPattern(patternName, parameters);
      this.logger.info(`Executing template pattern: ${patternName}`);
      
      return await this.queryEngine.executeSPARQL(pattern.sparql, {
        ...options,
        templatePattern: patternName
      });
      
    } catch (error) {
      this.logger.error(`Template pattern execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template context data using predefined patterns
   * @param {string} templateUri - URI of the template
   * @param {Object} options - Options for context extraction
   * @returns {Promise<Object>} Template context data
   */
  async getTemplateContext(templateUri, options = {}) {
    try {
      this.logger.info(`Extracting context for template: ${templateUri}`);
      
      const context = {};
      
      // Get template metadata
      const metadata = await this.executeTemplatePattern('get_template_metadata', { template: templateUri });
      context.metadata = this._processMetadataResults(metadata.results.bindings);
      
      // Get template variables
      const variables = await this.executeTemplatePattern('extract_template_variables', { template: templateUri });
      context.variables = this._processVariableResults(variables.results.bindings);
      
      // Get variable dependencies if requested
      if (options.includeDependencies) {
        const dependencies = await this.executeTemplatePattern('get_variable_dependencies', { template: templateUri });
        context.dependencies = this._processDependencyResults(dependencies.results.bindings);
      }
      
      // Get related templates if requested
      if (options.includeRelated) {
        const related = await this.executeTemplatePattern('find_related_templates', { template: templateUri });
        context.relatedTemplates = this._processRelatedResults(related.results.bindings);
      }
      
      return context;
      
    } catch (error) {
      this.logger.error(`Template context extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate template context against constraints
   * @param {string} templateUri - URI of the template
   * @param {Object} providedContext - Context values to validate
   * @returns {Promise<Object>} Validation results
   */
  async validateTemplateContext(templateUri, providedContext = {}) {
    try {
      const validationQuery = this.queryEngine.templatePatterns.createContextValidationQuery(templateUri, providedContext);
      const results = await this.queryEngine.executeSPARQL(validationQuery);
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        variables: {}
      };
      
      for (const binding of results.results.bindings) {
        const varName = binding.name?.value;
        const isRequired = binding.required?.value === 'true';
        const isProvided = binding.provided?.value === 'true';
        const isValid = binding.valid?.value === 'true';
        const issue = binding.issue?.value;
        
        validation.variables[varName] = {
          required: isRequired,
          provided: isProvided,
          valid: isValid
        };
        
        if (!isValid && issue) {
          validation.isValid = false;
          validation.errors.push({
            variable: varName,
            message: issue
          });
        }
      }
      
      return validation;
      
    } catch (error) {
      this.logger.error(`Template context validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find templates similar to given variable patterns
   * @param {Array} variableNames - Variable names to match
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Similar templates
   */
  async findSimilarTemplates(variableNames, options = {}) {
    try {
      const minMatchCount = options.minMatchCount || Math.ceil(variableNames.length * 0.5);
      const query = this.queryEngine.templatePatterns.createSimilarTemplatesQuery(variableNames, minMatchCount);
      
      const results = await this.queryEngine.executeSPARQL(query);
      
      return results.results.bindings.map(binding => ({
        template: binding.template?.value,
        name: binding.templateName?.value,
        matchCount: parseInt(binding.matchCount?.value || '0'),
        similarity: parseFloat(binding.similarity?.value || '0')
      }));
      
    } catch (error) {
      this.logger.error(`Similar templates search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get comprehensive template analytics
   * @param {string} templateUri - Template URI (optional, for specific template)
   * @returns {Promise<Object>} Analytics data
   */
  async getTemplateAnalytics(templateUri = null) {
    try {
      const analytics = {
        totalTemplates: 0,
        totalVariables: 0,
        usageStats: [],
        popularTemplates: [],
        variableDistribution: {},
        categoryDistribution: {}
      };

      // Get usage statistics
      const usageResults = await this.executeTemplatePattern('get_template_usage_stats');
      analytics.usageStats = usageResults.results.bindings.map(binding => ({
        template: binding.template?.value,
        name: binding.name?.value,
        usageCount: parseInt(binding.usageCount?.value || '0'),
        lastUsed: binding.lastUsed?.value,
        avgRenderTime: parseFloat(binding.avgRenderTime?.value || '0')
      }));

      analytics.totalTemplates = analytics.usageStats.length;
      analytics.popularTemplates = analytics.usageStats
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      // If specific template requested, get detailed analytics
      if (templateUri) {
        analytics.templateSpecific = await this._getTemplateSpecificAnalytics(templateUri);
      }

      return analytics;
      
    } catch (error) {
      this.logger.error(`Template analytics failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export query engine data in various formats
   * @param {string} format - Export format (json, turtle, n3, etc.)
   * @param {Object} options - Export options
   * @returns {Promise<string>} Exported data
   */
  async exportData(format = 'json', options = {}) {
    try {
      const data = {
        metadata: {
          exportDate: this.getDeterministicDate().toISOString(),
          tripleCount: this.queryEngine.queryStore.size,
          format: format
        },
        statistics: this.queryEngine.queryOptimizer.statistics ? 
          Object.fromEntries(this.queryEngine.queryOptimizer.statistics) : {},
        queryMetrics: this.queryEngine.queryMetrics
      };

      if (options.includeTriples) {
        // Export RDF triples
        const triples = [];
        for (const quad of this.queryEngine.queryStore) {
          triples.push({
            subject: quad.subject.value,
            predicate: quad.predicate.value,
            object: quad.object.value,
            graph: quad.graph?.value
          });
        }
        data.triples = triples;
      }

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      } else {
        // Use result serializer for RDF formats
        const rdfResults = {
          triples: Array.from(this.queryEngine.queryStore)
        };
        return await this.queryEngine.resultSerializer.serialize(rdfResults, format, options);
      }
      
    } catch (error) {
      this.logger.error(`Data export failed: ${error.message}`);
      throw error;
    }
  }

  // Helper methods for processing query results

  _processMetadataResults(bindings) {
    const metadata = {};
    for (const binding of bindings) {
      const property = binding.property?.value;
      const value = binding.value?.value;
      if (property && value) {
        // Extract property name from URI
        const propertyName = property.split(/[#/]/).pop();
        metadata[propertyName] = value;
      }
    }
    return metadata;
  }

  _processVariableResults(bindings) {
    const variables = [];
    for (const binding of bindings) {
      variables.push({
        uri: binding.variable?.value,
        name: binding.name?.value,
        type: binding.type?.value,
        description: binding.description?.value,
        defaultValue: binding.defaultValue?.value,
        required: binding.required?.value === 'true'
      });
    }
    return variables;
  }

  _processDependencyResults(bindings) {
    const dependencies = [];
    for (const binding of bindings) {
      dependencies.push({
        source: binding.sourceVar?.value,
        target: binding.targetVar?.value,
        type: binding.dependencyType?.value
      });
    }
    return dependencies;
  }

  _processRelatedResults(bindings) {
    const related = [];
    for (const binding of bindings) {
      related.push({
        template: binding.relatedTemplate?.value,
        name: binding.name?.value,
        relation: binding.relation?.value
      });
    }
    return related;
  }

  async _getTemplateSpecificAnalytics(templateUri) {
    try {
      const context = await this.getTemplateContext(templateUri, {
        includeDependencies: true,
        includeRelated: true
      });

      return {
        variableCount: context.variables?.length || 0,
        dependencyCount: context.dependencies?.length || 0,
        relatedCount: context.relatedTemplates?.length || 0,
        complexity: this._calculateTemplateComplexity(context),
        metadata: context.metadata
      };
    } catch (error) {
      this.logger.warn(`Failed to get specific analytics for ${templateUri}:`, error.message);
      return {};
    }
  }

  _calculateTemplateComplexity(context) {
    let complexity = 0;
    
    // Base complexity from variable count
    complexity += (context.variables?.length || 0) * 1;
    
    // Add complexity for dependencies
    complexity += (context.dependencies?.length || 0) * 2;
    
    // Add complexity for computed variables
    const computedVars = context.variables?.filter(v => v.computed) || [];
    complexity += computedVars.length * 3;
    
    // Normalize to 0-10 scale
    return Math.min(10, Math.max(1, Math.round(complexity / 2)));
  }
}

export default EnhancedQueryMethods;