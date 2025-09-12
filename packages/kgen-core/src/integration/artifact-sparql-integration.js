/**
 * SPARQL Integration with Artifact Generation
 * 
 * Provides seamless integration between SPARQL query engine and artifact generation:
 * - Extract template variables from RDF graphs
 * - Resolve context for code generation
 * - Support for dynamic template processing
 * - Integration with KGEN workflow
 */

import { consola } from 'consola';
import { SparqlEngine } from '../sparql-engine.js';
import { QueryTemplates } from '../query-templates.js';

export class ArtifactSparqlIntegration {
  constructor(options = {}) {
    this.logger = consola.withTag('artifact-sparql');
    this.options = {
      enableCaching: options.enableCaching !== false,
      maxCacheAge: options.maxCacheAge || 300000, // 5 minutes
      enableProvenance: options.enableProvenance !== false,
      ...options
    };

    this.sparqlEngine = options.sparqlEngine;
    this.queryTemplates = options.queryTemplates;
    
    // Cache for resolved variables and contexts
    this.variableCache = new Map();
    this.contextCache = new Map();
    
    this.logger.success('Artifact-SPARQL integration initialized');
  }

  /**
   * Resolve template variables for artifact generation
   * @param {string} templatePath - Template identifier or path
   * @param {Object} baseContext - Base context variables
   * @param {Object} options - Resolution options
   * @returns {Promise<Object>} Resolved variables
   */
  async resolveTemplateVariables(templatePath, baseContext = {}, options = {}) {
    try {
      this.logger.debug(`Resolving variables for template: ${templatePath}`);
      
      // Check cache first
      const cacheKey = this._generateCacheKey('variables', templatePath, baseContext);
      if (this._isCacheValid(cacheKey) && !options.skipCache) {
        this.logger.debug('Using cached template variables');
        return this.variableCache.get(cacheKey).data;
      }
      
      // Extract variables from RDF graph
      const extractedVariables = await this.sparqlEngine.extractTemplateVariables(templatePath, {
        ...baseContext,
        skipCache: options.skipCache
      });
      
      // Merge with base context (base context takes precedence)
      const resolvedVariables = this._mergeVariables(extractedVariables, baseContext);
      
      // Apply variable transformations
      const transformedVariables = await this._transformVariables(
        resolvedVariables, 
        templatePath, 
        options
      );
      
      // Validate required variables
      await this._validateRequiredVariables(transformedVariables, templatePath);
      
      // Cache the results
      if (this.options.enableCaching) {
        this.variableCache.set(cacheKey, {
          data: transformedVariables,
          timestamp: Date.now()
        });
      }
      
      this.logger.success(`Resolved ${Object.keys(transformedVariables).length} template variables`);
      return transformedVariables;
      
    } catch (error) {
      this.logger.error('Template variable resolution failed:', error);
      throw error;
    }
  }

  /**
   * Extract rich context for artifact generation
   * @param {string|Array} entityUris - Entity URI(s) to extract context for
   * @param {Object} options - Context extraction options
   * @returns {Promise<Object>} Rich context data
   */
  async extractArtifactContext(entityUris, options = {}) {
    try {
      const entities = Array.isArray(entityUris) ? entityUris : [entityUris];
      this.logger.debug(`Extracting context for ${entities.length} entities`);
      
      const contexts = {};
      
      for (const entityUri of entities) {
        // Check cache
        const cacheKey = this._generateCacheKey('context', entityUri, options);
        if (this._isCacheValid(cacheKey) && !options.skipCache) {
          contexts[entityUri] = this.contextCache.get(cacheKey).data;
          continue;
        }
        
        // Extract context from RDF graph
        const entityContext = await this.sparqlEngine.extractContext(entityUri, options);
        
        // Enrich context with additional data
        const enrichedContext = await this._enrichContext(entityContext, options);
        
        contexts[entityUri] = enrichedContext;
        
        // Cache the context
        if (this.options.enableCaching) {
          this.contextCache.set(cacheKey, {
            data: enrichedContext,
            timestamp: Date.now()
          });
        }
      }
      
      // Merge multiple contexts if needed
      const mergedContext = entities.length === 1 
        ? contexts[entities[0]]
        : this._mergeContexts(contexts, options);
      
      this.logger.success('Context extraction completed');
      return mergedContext;
      
    } catch (error) {
      this.logger.error('Artifact context extraction failed:', error);
      throw error;
    }
  }

  /**
   * Generate artifact-specific query data
   * @param {string} artifactType - Type of artifact being generated
   * @param {Object} specification - Artifact specification
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Query data for artifact generation
   */
  async generateArtifactQueryData(artifactType, specification, options = {}) {
    try {
      this.logger.debug(`Generating query data for artifact type: ${artifactType}`);
      
      const queryData = {
        artifactType,
        specification,
        entities: {},
        relationships: {},
        metadata: {},
        templates: {},
        dependencies: []
      };
      
      // Extract entities based on artifact type
      if (specification.entities) {
        for (const entitySpec of specification.entities) {
          const entityData = await this._extractEntityData(entitySpec, options);
          queryData.entities[entitySpec.id || entitySpec.uri] = entityData;
        }
      }
      
      // Extract relationships
      if (specification.relationships) {
        queryData.relationships = await this._extractRelationshipData(
          specification.relationships, 
          options
        );
      }
      
      // Extract metadata
      queryData.metadata = await this._extractArtifactMetadata(
        artifactType, 
        specification, 
        options
      );
      
      // Find applicable templates
      queryData.templates = await this._findApplicableTemplates(
        artifactType, 
        specification, 
        options
      );
      
      // Identify dependencies
      queryData.dependencies = await this._identifyDependencies(
        specification, 
        options
      );
      
      this.logger.success('Artifact query data generation completed');
      return queryData;
      
    } catch (error) {
      this.logger.error('Artifact query data generation failed:', error);
      throw error;
    }
  }

  /**
   * Validate artifact dependencies using SPARQL
   * @param {Object} artifactSpec - Artifact specification
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateArtifactDependencies(artifactSpec, options = {}) {
    try {
      this.logger.debug('Validating artifact dependencies');
      
      const validation = {
        valid: true,
        missing: [],
        conflicts: [],
        warnings: [],
        dependencies: []
      };
      
      if (!artifactSpec.dependencies) {
        return validation;
      }
      
      for (const dependency of artifactSpec.dependencies) {
        // Check if dependency exists in graph
        const exists = await this._checkDependencyExists(dependency);
        
        if (!exists) {
          validation.valid = false;
          validation.missing.push({
            dependency: dependency.uri || dependency.id,
            type: dependency.type,
            reason: 'Dependency not found in knowledge graph'
          });
        } else {
          // Check for version conflicts
          const conflicts = await this._checkVersionConflicts(dependency);
          if (conflicts.length > 0) {
            validation.conflicts.push(...conflicts);
          }
          
          validation.dependencies.push(dependency);
        }
      }
      
      this.logger.success(`Dependency validation completed: ${validation.valid ? 'PASS' : 'FAIL'}`);
      return validation;
      
    } catch (error) {
      this.logger.error('Dependency validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate impact analysis for artifact changes
   * @param {string} artifactId - Artifact identifier
   * @param {Object} changes - Proposed changes
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Impact analysis results
   */
  async analyzeArtifactImpact(artifactId, changes, options = {}) {
    try {
      this.logger.debug(`Analyzing impact for artifact: ${artifactId}`);
      
      // Get artifact entity URI
      const artifactUri = await this._getArtifactUri(artifactId);
      
      // Perform SPARQL-based impact analysis
      const impact = await this.sparqlEngine.analyzeImpact(artifactUri, options);
      
      // Enrich with artifact-specific impact data
      const artifactImpact = await this._enrichArtifactImpact(impact, changes, options);
      
      this.logger.success('Artifact impact analysis completed');
      return artifactImpact;
      
    } catch (error) {
      this.logger.error('Artifact impact analysis failed:', error);
      throw error;
    }
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.variableCache.clear();
    this.contextCache.clear();
    this.logger.debug('Caches cleared');
  }

  /**
   * Get integration statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      variableCacheSize: this.variableCache.size,
      contextCacheSize: this.contextCache.size,
      cacheMaxAge: this.options.maxCacheAge,
      enableCaching: this.options.enableCaching,
      enableProvenance: this.options.enableProvenance
    };
  }

  // Private helper methods

  _generateCacheKey(type, ...args) {
    return `${type}:${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(':')}`;
  }

  _isCacheValid(cacheKey) {
    if (!this.options.enableCaching) return false;
    
    const cached = this.variableCache.get(cacheKey) || this.contextCache.get(cacheKey);
    if (!cached) return false;
    
    return (Date.now() - cached.timestamp) < this.options.maxCacheAge;
  }

  _mergeVariables(extractedVariables, baseContext) {
    const merged = { ...extractedVariables };
    
    // Base context overrides extracted variables
    for (const [key, value] of Object.entries(baseContext)) {
      merged[key] = {
        value: value,
        type: typeof value,
        source: 'context'
      };
    }
    
    return merged;
  }

  async _transformVariables(variables, templatePath, options) {
    const transformed = { ...variables };
    
    // Apply type coercions and transformations
    for (const [key, variable] of Object.entries(transformed)) {
      // String transformations
      if (options.camelCase && typeof variable.value === 'string') {
        variable.value = this._toCamelCase(variable.value);
      }
      
      if (options.upperCase && typeof variable.value === 'string') {
        variable.value = variable.value.toUpperCase();
      }
      
      // Date transformations
      if (variable.type === 'date' && typeof variable.value === 'string') {
        variable.value = new Date(variable.value).toISOString();
      }
    }
    
    return transformed;
  }

  async _validateRequiredVariables(variables, templatePath) {
    // Query for required variables
    const requiredQuery = this.queryTemplates.getQuery('templateVariables', { 
      templatePath 
    });
    
    const results = await this.sparqlEngine.executeQuery(requiredQuery);
    
    const required = results.results?.bindings?.filter(b => 
      b.required?.value === 'true'
    ) || [];
    
    const missing = required.filter(r => 
      !variables[r.variable?.value]
    );
    
    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.map(m => m.variable.value).join(', ')}`);
    }
  }

  async _enrichContext(context, options) {
    const enriched = { ...context };
    
    // Add computed properties
    enriched.computed = {
      propertyCount: Object.keys(context.properties).length,
      relationshipCount: Object.keys(context.relationships).length,
      hasProvenance: !!context.provenance
    };
    
    // Add type hierarchy if requested
    if (options.includeHierarchy) {
      enriched.hierarchy = await this._extractTypeHierarchy(context.entity);
    }
    
    return enriched;
  }

  _mergeContexts(contexts, options) {
    const merged = {
      entities: contexts,
      combined: {
        properties: {},
        relationships: {},
        metadata: {}
      }
    };
    
    // Merge properties from all contexts
    for (const context of Object.values(contexts)) {
      Object.assign(merged.combined.properties, context.properties);
      Object.assign(merged.combined.relationships, context.relationships);
      Object.assign(merged.combined.metadata, context.metadata);
    }
    
    return merged;
  }

  async _extractEntityData(entitySpec, options) {
    const uri = entitySpec.uri || entitySpec.id;
    
    // Use existing context extraction
    const context = await this.sparqlEngine.extractContext(uri, options);
    
    // Add entity-specific data
    return {
      ...context,
      specification: entitySpec
    };
  }

  async _extractRelationshipData(relationships, options) {
    const relationshipData = {};
    
    for (const rel of relationships) {
      const query = this.queryTemplates.getQuery('entityRelations', {
        entityUri: rel.source
      });
      
      const results = await this.sparqlEngine.executeQuery(query);
      relationshipData[rel.id] = results.results?.bindings || [];
    }
    
    return relationshipData;
  }

  async _extractArtifactMetadata(artifactType, specification, options) {
    return {
      artifactType,
      createdAt: new Date().toISOString(),
      specification,
      generator: 'kgen-sparql-integration',
      version: '1.0.0'
    };
  }

  async _findApplicableTemplates(artifactType, specification, options) {
    // Query for templates that match the artifact type
    const query = `
      SELECT ?template ?path ?priority WHERE {
        ?template a tmpl:Template .
        ?template tmpl:appliesTo "${artifactType}" .
        ?template tmpl:path ?path .
        OPTIONAL { ?template tmpl:priority ?priority }
      }
      ORDER BY DESC(?priority) ?path
    `;
    
    const results = await this.sparqlEngine.executeQuery(query);
    return results.results?.bindings || [];
  }

  async _identifyDependencies(specification, options) {
    const dependencies = [];
    
    if (specification.entities) {
      for (const entity of specification.entities) {
        const query = this.queryTemplates.getQuery('entityDependencies', {
          entityUri: entity.uri || entity.id
        });
        
        const results = await this.sparqlEngine.executeQuery(query);
        dependencies.push(...(results.results?.bindings || []));
      }
    }
    
    return dependencies;
  }

  async _checkDependencyExists(dependency) {
    const query = `
      ASK {
        <${dependency.uri || dependency.id}> ?p ?v .
      }
    `;
    
    const result = await this.sparqlEngine.executeQuery(query);
    return result.boolean;
  }

  async _checkVersionConflicts(dependency) {
    // Implement version conflict detection
    return [];
  }

  async _getArtifactUri(artifactId) {
    const query = `
      SELECT ?uri WHERE {
        ?uri kgen:identifier "${artifactId}" .
      }
      LIMIT 1
    `;
    
    const result = await this.sparqlEngine.executeQuery(query);
    const binding = result.results?.bindings?.[0];
    return binding?.uri?.value || `http://kgen.enterprise/artifact/${artifactId}`;
  }

  async _enrichArtifactImpact(impact, changes, options) {
    return {
      ...impact,
      changes,
      artifactSpecific: {
        templatesAffected: [],
        dependentArtifacts: [],
        configurationChanges: []
      }
    };
  }

  async _extractTypeHierarchy(entityUri) {
    const query = this.queryTemplates.getQuery('entityHierarchy', { entityUri });
    const results = await this.sparqlEngine.executeQuery(query);
    return results.results?.bindings || [];
  }

  _toCamelCase(str) {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  }
}

export default ArtifactSparqlIntegration;