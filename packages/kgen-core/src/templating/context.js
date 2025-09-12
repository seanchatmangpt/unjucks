/**
 * KGEN Template Context Builder
 * 
 * Builds enhanced context for template rendering with RDF graph integration
 * Connects RDF data to template variables for semantic code generation
 */

export class TemplateContext {
  constructor(options = {}) {
    this.options = {
      enableRDFIntegration: options.enableRDFIntegration !== false,
      includeMetadata: options.includeMetadata !== false,
      enableFallbacks: options.enableFallbacks !== false,
      debug: options.debug || false,
      ...options
    };
  }

  /**
   * Build enhanced context from variables, RDF data, and frontmatter
   */
  async buildContext({ variables = {}, rdfData = null, frontmatter = {}, templatePath = '' }) {
    const context = { ...variables };

    // Add RDF graph data if available
    if (rdfData && this.options.enableRDFIntegration) {
      await this.integrateRDFData(context, rdfData, frontmatter);
    }

    // Add metadata context
    if (this.options.includeMetadata) {
      context._kgen = this.buildMetadataContext(frontmatter, templatePath);
    }

    // Add utility functions
    context._utils = this.buildUtilityContext();

    // Add environment information
    context._env = this.buildEnvironmentContext();

    return context;
  }

  /**
   * Integrate RDF graph data into template context
   */
  async integrateRDFData(context, rdfData, frontmatter) {
    // Extract RDF configuration from frontmatter
    const rdfConfig = this.extractRDFConfig(frontmatter);
    
    if (!rdfConfig) {
      // If no specific RDF config, make all RDF data available
      context.rdf = rdfData;
      return;
    }

    try {
      // Execute SPARQL query if specified
      if (rdfConfig.sparql || frontmatter.sparql) {
        const query = rdfConfig.sparql || frontmatter.sparql;
        const results = await this.executeSPARQLQuery(rdfData, query);
        context.queryResults = results;
        context.sparqlResults = results; // Alias for compatibility
      }

      // Extract entities based on subject patterns
      if (rdfConfig.subjects || frontmatter.subjects) {
        const subjects = Array.isArray(rdfConfig.subjects) ? rdfConfig.subjects : [rdfConfig.subjects];
        context.entities = await this.extractEntities(rdfData, subjects);
      }

      // Extract specific properties
      if (rdfConfig.properties) {
        context.properties = await this.extractProperties(rdfData, rdfConfig.properties);
      }

      // Make full RDF data available for custom queries
      context.rdf = rdfData;

    } catch (error) {
      console.warn('RDF integration failed:', error.message);
      if (this.options.enableFallbacks) {
        context.rdf = rdfData; // Fallback to raw data
      }
    }
  }

  /**
   * Extract RDF configuration from frontmatter
   */
  extractRDFConfig(frontmatter) {
    // Check for RDF configuration in frontmatter
    if (frontmatter.rdf && typeof frontmatter.rdf === 'object') {
      return frontmatter.rdf;
    }

    // Check for inline SPARQL
    if (frontmatter.sparql) {
      return { sparql: frontmatter.sparql };
    }

    // Check for subject patterns
    if (frontmatter.subjects) {
      return { subjects: frontmatter.subjects };
    }

    return null;
  }

  /**
   * Execute SPARQL query against RDF data (simplified)
   */
  async executeSPARQLQuery(rdfData, query) {
    // This is a simplified SPARQL execution
    // In a full implementation, you'd use a proper SPARQL engine
    
    if (!rdfData || !rdfData.quads) {
      return [];
    }

    try {
      // Simple pattern matching for basic SELECT queries
      if (query.toUpperCase().includes('SELECT')) {
        return this.executeSelectQuery(rdfData.quads, query);
      }
      
      // For complex queries, return raw quads for now
      return rdfData.quads.map(quad => ({
        subject: quad.subject.value,
        predicate: quad.predicate.value,
        object: quad.object.value,
        objectType: quad.object.termType
      }));

    } catch (error) {
      console.warn('SPARQL query execution failed:', error.message);
      return [];
    }
  }

  /**
   * Simple SELECT query execution
   */
  executeSelectQuery(quads, query) {
    // Extract variable names from SELECT clause
    const selectMatch = query.match(/SELECT\s+(.+?)\s+WHERE/i);
    if (!selectMatch) return [];

    const variables = selectMatch[1].split(/\s+/).map(v => v.replace('?', ''));
    
    // Simple triple pattern matching
    const results = [];
    const bindings = new Map();

    for (const quad of quads) {
      const result = {};
      
      // Map quad components to variables (simplified)
      if (variables.includes('subject') || variables.includes('s')) {
        result.subject = quad.subject.value;
      }
      if (variables.includes('predicate') || variables.includes('p')) {
        result.predicate = quad.predicate.value;
      }
      if (variables.includes('object') || variables.includes('o')) {
        result.object = quad.object.value;
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Extract entities from RDF data based on subject patterns
   */
  async extractEntities(rdfData, subjectPatterns) {
    const entities = [];

    if (!rdfData || !rdfData.quads) return entities;

    const matchingSubjects = new Set();

    // Find subjects matching patterns
    for (const quad of rdfData.quads) {
      const subject = quad.subject.value;
      
      for (const pattern of subjectPatterns) {
        if (subject.includes(pattern) || subject.match(new RegExp(pattern))) {
          matchingSubjects.add(subject);
        }
      }
    }

    // Extract data for each matching subject
    for (const subject of matchingSubjects) {
      const entity = await this.extractEntityData(rdfData.quads, subject);
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Extract data for a specific entity/subject
   */
  async extractEntityData(quads, subjectUri) {
    const entity = {
      uri: subjectUri,
      properties: {},
      relationships: []
    };

    // Get all quads for this subject
    const subjectQuads = quads.filter(q => q.subject.value === subjectUri);

    for (const quad of subjectQuads) {
      const predicate = quad.predicate.value;
      const object = quad.object.value;
      const objectType = quad.object.termType;

      // Extract local name from predicate URI
      const predicateLocalName = this.extractLocalName(predicate);

      // Store as property
      if (objectType === 'Literal') {
        entity.properties[predicateLocalName] = object;
      } else {
        // Store as relationship
        entity.relationships.push({
          predicate: predicateLocalName,
          object: object,
          objectType
        });
      }
    }

    return entity;
  }

  /**
   * Extract properties based on configuration
   */
  async extractProperties(rdfData, propertyConfig) {
    const properties = {};

    if (!rdfData || !rdfData.quads) return properties;

    for (const [key, predicateUri] of Object.entries(propertyConfig)) {
      const values = [];
      
      for (const quad of rdfData.quads) {
        if (quad.predicate.value === predicateUri) {
          values.push({
            subject: quad.subject.value,
            object: quad.object.value,
            objectType: quad.object.termType
          });
        }
      }
      
      properties[key] = values;
    }

    return properties;
  }

  /**
   * Extract local name from URI
   */
  extractLocalName(uri) {
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const separator = Math.max(lastSlash, lastHash);
    return separator > 0 ? uri.substring(separator + 1) : uri;
  }

  /**
   * Build metadata context
   */
  buildMetadataContext(frontmatter, templatePath) {
    return {
      template: templatePath,
      frontmatter,
      generatedAt: this.getDeterministicDate().toISOString(),
      timestamp: this.getDeterministicTimestamp(),
      version: '1.0.0',
      operationMode: this.getOperationMode(frontmatter),
      outputPath: frontmatter.to || null
    };
  }

  /**
   * Build utility context with helper functions
   */
  buildUtilityContext() {
    return {
      // String utilities
      camelCase: (str) => str.replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
                             .replace(/^(.)/, (_, char) => char.toLowerCase()),
      
      pascalCase: (str) => str.replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
                              .replace(/^(.)/, (_, char) => char.toUpperCase()),
      
      kebabCase: (str) => str.replace(/([A-Z])/g, '-$1')
                             .toLowerCase()
                             .replace(/^-/, ''),
      
      snakeCase: (str) => str.replace(/([A-Z])/g, '_$1')
                             .toLowerCase()
                             .replace(/^_/, ''),

      // URI utilities
      localName: (uri) => this.extractLocalName(uri),
      
      namespace: (uri) => {
        const lastSlash = uri.lastIndexOf('/');
        const lastHash = uri.lastIndexOf('#');
        const separator = Math.max(lastSlash, lastHash);
        return separator > 0 ? uri.substring(0, separator + 1) : uri;
      },

      // Array utilities
      unique: (arr) => [...new Set(arr)],
      sortBy: (arr, key) => arr.sort((a, b) => (a[key] > b[key] ? 1 : -1)),

      // Date utilities
      now: () => this.getDeterministicDate().toISOString(),
      timestamp: () => this.getDeterministicTimestamp()
    };
  }

  /**
   * Build environment context
   */
  buildEnvironmentContext() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      workingDirectory: process.cwd()
    };
  }

  /**
   * Get operation mode from frontmatter
   */
  getOperationMode(frontmatter) {
    if (frontmatter.lineAt !== undefined) {
      return { mode: 'lineAt', lineNumber: frontmatter.lineAt };
    }
    if (frontmatter.append) return { mode: 'append' };
    if (frontmatter.prepend) return { mode: 'prepend' };
    if (frontmatter.inject) return { mode: 'inject' };
    return { mode: 'write' };
  }

  /**
   * Validate template context
   */
  validateContext(context, requiredVariables = []) {
    const missing = [];
    
    for (const variable of requiredVariables) {
      if (!(variable in context)) {
        missing.push(variable);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

export default TemplateContext;