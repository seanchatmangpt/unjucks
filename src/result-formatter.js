/**
 * KGEN SPARQL Result Formatter
 * 
 * Advanced SPARQL result formatter with template context building,
 * multi-format serialization, and streaming capabilities.
 */

import { EventEmitter } from 'events';

export class KgenResultFormatter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      defaultFormat: 'json',
      enableStreaming: true,
      maxMemoryResults: 10000,
      enableTemplateContext: true,
      contextExtractionDepth: 3,
      formatValidation: true,
      ...config
    };
    
    // Format processors
    this.formatProcessors = new Map();
    this.templateContextBuilders = new Map();
    this.streamingSerializers = new Map();
    
    this.initializeFormatProcessors();
    this.initializeTemplateContextBuilders();
  }

  /**
   * Format SPARQL results to specified output format with template context
   */
  async formatResults(results, format = 'json', options = {}) {
    try {
      console.log(`[Result Formatter] Formatting ${results.results?.bindings?.length || 0} results to ${format}`);
      
      const opts = { ...this.config, ...options };
      
      // Build template context if enabled
      if (opts.enableTemplateContext && results.results?.bindings) {
        results.templateContext = await this.buildTemplateContext(results, opts);
        this.emit('context:built', { 
          resultCount: results.results.bindings.length,
          contextEntities: results.templateContext.entities?.length || 0 
        });
      }
      
      // Format results using appropriate processor
      const processor = this.formatProcessors.get(format.toLowerCase());
      if (!processor) {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      const formatted = await processor.call(this, results, opts);
      
      // Validate format if enabled
      if (opts.formatValidation) {
        this.validateFormat(formatted, format);
      }
      
      this.emit('format:completed', { 
        format, 
        resultCount: results.results?.bindings?.length || 0,
        outputSize: formatted.length 
      });
      
      return formatted;
      
    } catch (error) {
      console.error('[Result Formatter] Formatting failed:', error);
      this.emit('format:error', { format, error });
      throw error;
    }
  }

  /**
   * Build comprehensive template context from SPARQL results
   */
  async buildTemplateContext(results, options = {}) {
    try {
      const context = {
        entities: [],
        properties: new Map(),
        relationships: [],
        patterns: [],
        statistics: {},
        templateVariables: new Map(),
        renderingHints: {},
        metadata: {
          extractedAt: new Date().toISOString(),
          resultCount: results.results?.bindings?.length || 0,
          extractionDepth: options.contextExtractionDepth || this.config.contextExtractionDepth
        }
      };
      
      // Extract entities and their contexts
      const entityUris = this.extractEntityUris(results);
      for (const uri of entityUris.slice(0, options.maxContextEntities || 1000)) {
        const entityContext = await this.buildEntityContext(uri, results, options);
        if (entityContext) {
          context.entities.push(entityContext);
        }
      }
      
      // Extract property patterns
      context.properties = this.extractPropertyPatterns(results);
      
      // Extract relationship patterns
      context.relationships = this.extractRelationshipPatterns(results);
      
      // Detect common patterns
      context.patterns = this.detectDataPatterns(results, context);
      
      // Build template variables
      context.templateVariables = this.buildTemplateVariables(results, context, options);
      
      // Generate rendering hints
      context.renderingHints = this.generateRenderingHints(context, options);
      
      // Calculate statistics
      context.statistics = this.calculateContextStatistics(context, results);
      
      return context;
      
    } catch (error) {
      console.error('[Result Formatter] Template context building failed:', error);
      throw error;
    }
  }

  /**
   * Extract entity URIs from SPARQL results
   */
  extractEntityUris(results) {
    const entityUris = new Set();
    
    if (!results.results?.bindings) {
      return Array.from(entityUris);
    }
    
    for (const binding of results.results.bindings) {
      for (const [variable, term] of Object.entries(binding)) {
        if (term.type === 'uri' && this.isEntityUri(term.value)) {
          entityUris.add(term.value);
        }
      }
    }
    
    return Array.from(entityUris);
  }

  /**
   * Build context for a specific entity
   */
  async buildEntityContext(uri, results, options = {}) {
    try {
      const entityContext = {
        uri,
        label: null,
        type: null,
        properties: [],
        relationships: [],
        importance: 0,
        templateRelevance: {},
        renderingHints: {}
      };
      
      // Extract properties from results
      for (const binding of results.results?.bindings || []) {
        for (const [variable, term] of Object.entries(binding)) {
          if (term.type === 'uri' && term.value === uri) {
            // This binding involves our entity
            const property = this.extractPropertyFromBinding(binding, variable, uri);
            if (property) {
              entityContext.properties.push(property);
            }
          }
        }
      }
      
      // Determine entity type and label
      entityContext.type = this.determineEntityType(entityContext.properties);
      entityContext.label = this.extractEntityLabel(entityContext.properties);
      
      // Calculate importance based on property count and connections
      entityContext.importance = this.calculateEntityImportance(entityContext, results);
      
      // Generate template relevance scores
      entityContext.templateRelevance = this.calculateTemplateRelevance(entityContext, options);
      
      // Generate rendering hints
      entityContext.renderingHints = this.generateEntityRenderingHints(entityContext);
      
      return entityContext;
      
    } catch (error) {
      console.warn(`[Result Formatter] Failed to build context for entity: ${uri}`, error);
      return null;
    }
  }

  /**
   * Extract property patterns from results
   */
  extractPropertyPatterns(results) {
    const propertyMap = new Map();
    
    if (!results.results?.bindings) {
      return propertyMap;
    }
    
    for (const binding of results.results.bindings) {
      for (const [variable, term] of Object.entries(binding)) {
        // Look for predicate patterns
        if (variable.toLowerCase().includes('property') || 
            variable.toLowerCase().includes('predicate') || 
            variable.toLowerCase().includes('relation')) {
          
          if (term.type === 'uri') {
            const property = term.value;
            
            if (!propertyMap.has(property)) {
              propertyMap.set(property, {
                uri: property,
                frequency: 0,
                domains: new Set(),
                ranges: new Set(),
                label: this.extractLocalName(property),
                usage: []
              });
            }
            
            const propertyInfo = propertyMap.get(property);
            propertyInfo.frequency++;
            propertyInfo.usage.push(binding);
          }
        }
      }
    }
    
    // Convert Sets to Arrays for serialization
    for (const [property, info] of propertyMap.entries()) {
      info.domains = Array.from(info.domains);
      info.ranges = Array.from(info.ranges);
    }
    
    return propertyMap;
  }

  /**
   * Extract relationship patterns from results
   */
  extractRelationshipPatterns(results) {
    const relationships = [];
    
    if (!results.results?.bindings) {
      return relationships;
    }
    
    for (const binding of results.results.bindings) {
      // Look for subject-predicate-object patterns
      const subject = this.findTermByRole(binding, ['subject', 'source', 'from']);
      const predicate = this.findTermByRole(binding, ['predicate', 'property', 'relation']);
      const object = this.findTermByRole(binding, ['object', 'target', 'to']);
      
      if (subject && predicate && object) {
        relationships.push({
          subject: subject.value,
          predicate: predicate.value,
          object: object.value,
          subjectType: subject.type,
          objectType: object.type,
          strength: 1, // Could be calculated based on frequency
          direction: 'forward'
        });
      }
    }
    
    return relationships;
  }

  /**
   * Detect common data patterns in results
   */
  detectDataPatterns(results, context) {
    const patterns = [];
    
    // Entity-Attribute-Value pattern
    if (this.detectEAVPattern(results)) {
      patterns.push({
        type: 'entity-attribute-value',
        confidence: 0.8,
        description: 'Entity-Attribute-Value pattern detected',
        templateSuggestion: 'Use EAV template for flexible data modeling'
      });
    }
    
    // Hierarchical pattern
    if (this.detectHierarchicalPattern(results)) {
      patterns.push({
        type: 'hierarchical',
        confidence: 0.7,
        description: 'Hierarchical relationship pattern detected',
        templateSuggestion: 'Use tree structure templates for nested data'
      });
    }
    
    // CRUD pattern
    if (this.detectCRUDPattern(results, context)) {
      patterns.push({
        type: 'crud-operations',
        confidence: 0.9,
        description: 'CRUD operation pattern detected',
        templateSuggestion: 'Use CRUD controller templates'
      });
    }
    
    // RESTful API pattern
    if (this.detectRESTPattern(results)) {
      patterns.push({
        type: 'rest-api',
        confidence: 0.8,
        description: 'RESTful API pattern detected',
        templateSuggestion: 'Use REST endpoint templates'
      });
    }
    
    return patterns;
  }

  /**
   * Build template variables from extracted context
   */
  buildTemplateVariables(results, context, options = {}) {
    const variables = new Map();
    
    // Entity-based variables
    for (const entity of context.entities) {
      const entityName = this.extractLocalName(entity.uri);
      const className = this.toClassName(entityName);
      const variableName = this.toVariableName(entityName);
      
      variables.set('entityName', entityName);
      variables.set('className', className);
      variables.set('variableName', variableName);
      variables.set('entityUri', entity.uri);
      variables.set('entityType', entity.type);
      variables.set('entityLabel', entity.label || entityName);
      
      // Property-based variables
      const properties = entity.properties.map(prop => ({
        name: this.toPropertyName(prop.predicate),
        type: this.inferPropertyType(prop),
        required: prop.required || false,
        description: prop.label || '',
        example: prop.example || this.generatePropertyExample(prop)
      }));
      
      variables.set('properties', properties);
      variables.set('requiredProperties', properties.filter(p => p.required));
      variables.set('optionalProperties', properties.filter(p => !p.required));
    }
    
    // Pattern-based variables
    for (const pattern of context.patterns) {
      switch (pattern.type) {
        case 'crud-operations':
          variables.set('supportsCRUD', true);
          variables.set('crudOperations', ['create', 'read', 'update', 'delete']);
          break;
        case 'rest-api':
          variables.set('isRESTful', true);
          variables.set('httpMethods', ['GET', 'POST', 'PUT', 'DELETE']);
          break;
        case 'hierarchical':
          variables.set('isHierarchical', true);
          variables.set('hierarchyDepth', this.calculateHierarchyDepth(context));
          break;
      }
    }
    
    // Context-specific variables
    variables.set('timestamp', new Date().toISOString());
    variables.set('contextHash', this.generateContextHash(context));
    variables.set('resultCount', results.results?.bindings?.length || 0);
    
    return variables;
  }

  /**
   * Generate rendering hints for templates
   */
  generateRenderingHints(context, options = {}) {
    const hints = {
      suggestedTemplates: [],
      renderingOrder: [],
      complexity: 'low',
      estimatedSize: 'small',
      recommendedFormat: 'standard',
      optimizations: []
    };
    
    const entityCount = context.entities.length;
    const relationshipCount = context.relationships.length;
    
    // Determine complexity
    if (entityCount > 10 || relationshipCount > 20) {
      hints.complexity = 'high';
      hints.estimatedSize = 'large';
      hints.optimizations.push('pagination', 'lazy-loading');
    } else if (entityCount > 5 || relationshipCount > 10) {
      hints.complexity = 'medium';
      hints.estimatedSize = 'medium';
      hints.optimizations.push('caching');
    }
    
    // Suggest templates based on patterns
    for (const pattern of context.patterns) {
      switch (pattern.type) {
        case 'crud-operations':
          hints.suggestedTemplates.push('crud-controller', 'crud-service', 'crud-model');
          break;
        case 'rest-api':
          hints.suggestedTemplates.push('rest-endpoint', 'openapi-spec', 'api-client');
          break;
        case 'hierarchical':
          hints.suggestedTemplates.push('tree-structure', 'nested-model');
          break;
        case 'entity-attribute-value':
          hints.suggestedTemplates.push('flexible-model', 'dynamic-form');
          break;
      }
    }
    
    // Determine rendering order
    hints.renderingOrder = this.calculateRenderingOrder(context);
    
    return hints;
  }

  /**
   * Calculate context statistics
   */
  calculateContextStatistics(context, results) {
    return {
      totalEntities: context.entities.length,
      totalProperties: context.properties.size,
      totalRelationships: context.relationships.length,
      totalPatterns: context.patterns.length,
      averageEntityComplexity: this.calculateAverageEntityComplexity(context),
      relationshipDensity: this.calculateRelationshipDensity(context),
      patternConfidence: this.calculateAveragePatternConfidence(context),
      extractionEfficiency: {
        entitiesPerResult: context.entities.length / (results.results?.bindings?.length || 1),
        propertiesPerEntity: context.properties.size / (context.entities.length || 1),
        relationshipsPerEntity: context.relationships.length / (context.entities.length || 1)
      }
    };
  }

  // Format processors

  initializeFormatProcessors() {
    this.formatProcessors.set('json', this._formatToJSON);
    this.formatProcessors.set('template-json', this._formatToTemplateJSON);
    this.formatProcessors.set('xml', this._formatToXML);
    this.formatProcessors.set('csv', this._formatToCSV);
    this.formatProcessors.set('tsv', this._formatToTSV);
    this.formatProcessors.set('yaml', this._formatToYAML);
    this.formatProcessors.set('turtle', this._formatToTurtle);
    this.formatProcessors.set('table', this._formatToTable);
    this.formatProcessors.set('template-context', this._formatToTemplateContext);
  }

  async _formatToJSON(results, options) {
    const output = {
      head: {
        vars: results.head?.vars || []
      },
      results: {
        bindings: results.results?.bindings || []
      }
    };
    
    // Add template context if available
    if (results.templateContext) {
      output.templateContext = this._serializeTemplateContext(results.templateContext);
    }
    
    // Add metadata
    if (results.metadata) {
      output.metadata = results.metadata;
    }
    
    const indent = options.pretty ? 2 : 0;
    return JSON.stringify(output, null, indent);
  }

  async _formatToTemplateJSON(results, options) {
    const templateContext = results.templateContext || {};
    const variables = templateContext.templateVariables || new Map();
    
    const output = {
      variables: Object.fromEntries(variables),
      entities: templateContext.entities || [],
      patterns: templateContext.patterns || [],
      hints: templateContext.renderingHints || {},
      metadata: {
        generatedAt: new Date().toISOString(),
        resultCount: results.results?.bindings?.length || 0,
        contextEntities: templateContext.entities?.length || 0
      }
    };
    
    const indent = options.pretty ? 2 : 0;
    return JSON.stringify(output, null, indent);
  }

  async _formatToXML(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sparql xmlns="http://www.w3.org/2005/sparql-results#">\n';
    
    // Head section
    xml += '  <head>\n';
    for (const variable of vars) {
      xml += `    <variable name="${this._escapeXML(variable)}"/>\n`;
    }
    xml += '  </head>\n';
    
    // Results section
    xml += '  <results>\n';
    
    for (const binding of bindings) {
      xml += '    <result>\n';
      
      for (const variable of vars) {
        if (binding[variable]) {
          const term = binding[variable];
          xml += `      <binding name="${this._escapeXML(variable)}">\n`;
          
          switch (term.type) {
            case 'uri':
              xml += `        <uri>${this._escapeXML(term.value)}</uri>\n`;
              break;
            case 'literal':
              if (term.datatype) {
                xml += `        <literal datatype="${this._escapeXML(term.datatype)}">${this._escapeXML(term.value)}</literal>\n`;
              } else if (term['xml:lang']) {
                xml += `        <literal xml:lang="${this._escapeXML(term['xml:lang'])}">${this._escapeXML(term.value)}</literal>\n`;
              } else {
                xml += `        <literal>${this._escapeXML(term.value)}</literal>\n`;
              }
              break;
            case 'bnode':
              xml += `        <bnode>${this._escapeXML(term.value)}</bnode>\n`;
              break;
          }
          
          xml += '      </binding>\n';
        }
      }
      
      xml += '    </result>\n';
    }
    
    xml += '  </results>\n';
    
    // Add template context if available
    if (results.templateContext) {
      xml += '  <templateContext>\n';
      xml += this._serializeTemplateContextToXML(results.templateContext);
      xml += '  </templateContext>\n';
    }
    
    xml += '</sparql>\n';
    
    return xml;
  }

  async _formatToCSV(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    if (vars.length === 0) return '';
    
    const separator = options.separator || ',';
    const quote = options.quote || '"';
    
    // Header row
    let csv = vars.map(variable => this._escapeCSV(variable, quote)).join(separator) + '\n';
    
    // Data rows
    for (const binding of bindings) {
      const row = vars.map(variable => {
        const term = binding[variable];
        if (!term) return '';
        
        let value = term.value;
        
        // Add type information if requested
        if (options.includeTypes && term.type !== 'literal') {
          value = `${value} [${term.type}]`;
        }
        
        return this._escapeCSV(value, quote);
      });
      
      csv += row.join(separator) + '\n';
    }
    
    return csv;
  }

  async _formatToTSV(results, options) {
    return await this._formatToCSV(results, {
      ...options,
      separator: '\t',
      quote: '',
    });
  }

  async _formatToYAML(results, options) {
    const output = {
      head: {
        vars: results.head?.vars || []
      },
      results: {
        bindings: results.results?.bindings || []
      }
    };
    
    if (results.templateContext) {
      output.templateContext = this._serializeTemplateContext(results.templateContext);
    }
    
    // Simple YAML serialization (in production, would use a proper YAML library)
    return this._objectToYAML(output, 0);
  }

  async _formatToTurtle(results, options) {
    const bindings = results.results?.bindings || [];
    
    let turtle = '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n';
    turtle += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n';
    turtle += '@prefix kgen: <http://kgen.enterprise/> .\n\n';
    
    // Convert bindings to RDF triples
    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i];
      const subject = `<http://kgen.enterprise/result/${i}>`;
      
      turtle += `${subject}\n`;
      
      for (const [variable, term] of Object.entries(binding)) {
        const predicate = `kgen:${variable}`;
        let object;
        
        switch (term.type) {
          case 'uri':
            object = `<${term.value}>`;
            break;
          case 'literal':
            if (term.datatype) {
              object = `"${this._escapeTurtle(term.value)}"^^<${term.datatype}>`;
            } else if (term['xml:lang']) {
              object = `"${this._escapeTurtle(term.value)}"@${term['xml:lang']}`;
            } else {
              object = `"${this._escapeTurtle(term.value)}"`;
            }
            break;
          case 'bnode':
            object = `_:${term.value}`;
            break;
          default:
            object = `"${this._escapeTurtle(term.value)}"`;
        }
        
        turtle += `  ${predicate} ${object} ;\n`;
      }
      
      turtle = turtle.slice(0, -2) + ' .\n\n'; // Replace last semicolon with period
    }
    
    return turtle;
  }

  async _formatToTable(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    if (vars.length === 0) return '';
    
    // Calculate column widths
    const widths = vars.map(variable => variable.length);
    
    for (const binding of bindings) {
      vars.forEach((variable, index) => {
        const term = binding[variable];
        const value = term ? term.value : '';
        widths[index] = Math.max(widths[index], value.length);
      });
    }
    
    // Create table
    let table = '';
    
    // Header
    const headerRow = vars.map((variable, index) => 
      variable.padEnd(widths[index])
    ).join(' | ');
    
    table += headerRow + '\n';
    table += vars.map((_, index) => '-'.repeat(widths[index])).join('-|-') + '\n';
    
    // Data rows
    for (const binding of bindings) {
      const row = vars.map((variable, index) => {
        const term = binding[variable];
        const value = term ? term.value : '';
        return value.padEnd(widths[index]);
      }).join(' | ');
      
      table += row + '\n';
    }
    
    return table;
  }

  async _formatToTemplateContext(results, options) {
    if (!results.templateContext) {
      throw new Error('No template context available for formatting');
    }
    
    return JSON.stringify(this._serializeTemplateContext(results.templateContext), null, 2);
  }

  // Template context builders

  initializeTemplateContextBuilders() {
    this.templateContextBuilders.set('api', this._buildApiContext);
    this.templateContextBuilders.set('model', this._buildModelContext);
    this.templateContextBuilders.set('controller', this._buildControllerContext);
    this.templateContextBuilders.set('schema', this._buildSchemaContext);
    this.templateContextBuilders.set('crud', this._buildCrudContext);
  }

  // Helper methods

  isEntityUri(uri) {
    // Simple heuristic to determine if URI represents an entity
    return uri.includes('entity') || 
           uri.includes('resource') || 
           uri.includes('instance') ||
           !uri.includes('property') && !uri.includes('predicate');
  }

  extractPropertyFromBinding(binding, variable, entityUri) {
    for (const [var, term] of Object.entries(binding)) {
      if (var !== variable && term.type === 'uri' && var.includes('predicate')) {
        return {
          predicate: term.value,
          object: binding.object?.value,
          objectType: binding.object?.type,
          label: this.extractLocalName(term.value)
        };
      }
    }
    return null;
  }

  determineEntityType(properties) {
    for (const prop of properties) {
      if (prop.predicate.includes('type') || prop.predicate.includes('rdf-syntax-ns#type')) {
        return prop.object || 'Unknown';
      }
    }
    return 'Entity';
  }

  extractEntityLabel(properties) {
    const labelProperties = ['label', 'name', 'title'];
    
    for (const prop of properties) {
      for (const labelProp of labelProperties) {
        if (prop.predicate.includes(labelProp)) {
          return prop.object;
        }
      }
    }
    
    return null;
  }

  calculateEntityImportance(entityContext, results) {
    // Simple importance calculation based on property count and frequency
    const propertyCount = entityContext.properties.length;
    const frequency = this.countEntityOccurrences(entityContext.uri, results);
    
    return Math.min((propertyCount * 0.1) + (frequency * 0.05), 1.0);
  }

  countEntityOccurrences(entityUri, results) {
    let count = 0;
    
    for (const binding of results.results?.bindings || []) {
      for (const term of Object.values(binding)) {
        if (term.type === 'uri' && term.value === entityUri) {
          count++;
        }
      }
    }
    
    return count;
  }

  calculateTemplateRelevance(entityContext, options) {
    const relevance = {};
    
    // Calculate relevance scores for different template types
    if (entityContext.type.includes('User') || entityContext.type.includes('Person')) {
      relevance.user = 0.9;
      relevance.authentication = 0.8;
      relevance.profile = 0.7;
    }
    
    if (entityContext.properties.some(p => p.predicate.includes('price') || p.predicate.includes('cost'))) {
      relevance.ecommerce = 0.8;
      relevance.product = 0.7;
    }
    
    if (entityContext.properties.length > 10) {
      relevance.crud = 0.8;
      relevance.complex_model = 0.7;
    }
    
    return relevance;
  }

  generateEntityRenderingHints(entityContext) {
    const hints = {
      complexity: 'low',
      suggestedComponents: [],
      displayProperties: [],
      formFields: []
    };
    
    const propertyCount = entityContext.properties.length;
    
    if (propertyCount > 15) {
      hints.complexity = 'high';
      hints.suggestedComponents.push('accordion', 'tabs', 'pagination');
    } else if (propertyCount > 8) {
      hints.complexity = 'medium';
      hints.suggestedComponents.push('grouped-fields');
    }
    
    // Suggest display properties (first 5 most important)
    hints.displayProperties = entityContext.properties
      .slice(0, 5)
      .map(p => this.toPropertyName(p.predicate));
    
    // Suggest form fields based on property types
    hints.formFields = entityContext.properties.map(prop => ({
      name: this.toPropertyName(prop.predicate),
      type: this.inferPropertyType(prop),
      required: prop.required || false,
      label: prop.label || this.toPropertyName(prop.predicate)
    }));
    
    return hints;
  }

  findTermByRole(binding, possibleRoles) {
    for (const role of possibleRoles) {
      if (binding[role]) {
        return binding[role];
      }
      
      // Try variations
      for (const [variable, term] of Object.entries(binding)) {
        if (variable.toLowerCase().includes(role.toLowerCase())) {
          return term;
        }
      }
    }
    return null;
  }

  detectEAVPattern(results) {
    const bindings = results.results?.bindings || [];
    let eavCount = 0;
    
    for (const binding of bindings) {
      const hasEntity = Object.keys(binding).some(k => k.includes('entity') || k.includes('subject'));
      const hasAttribute = Object.keys(binding).some(k => k.includes('attribute') || k.includes('property'));
      const hasValue = Object.keys(binding).some(k => k.includes('value') || k.includes('object'));
      
      if (hasEntity && hasAttribute && hasValue) {
        eavCount++;
      }
    }
    
    return eavCount > bindings.length * 0.5; // More than 50% of bindings follow EAV pattern
  }

  detectHierarchicalPattern(results) {
    const bindings = results.results?.bindings || [];
    let hierarchyCount = 0;
    
    for (const binding of bindings) {
      const hasParent = Object.keys(binding).some(k => 
        k.includes('parent') || k.includes('super') || k.includes('broader'));
      const hasChild = Object.keys(binding).some(k => 
        k.includes('child') || k.includes('sub') || k.includes('narrower'));
      
      if (hasParent || hasChild) {
        hierarchyCount++;
      }
    }
    
    return hierarchyCount > bindings.length * 0.3; // More than 30% show hierarchy
  }

  detectCRUDPattern(results, context) {
    const operations = ['create', 'read', 'update', 'delete', 'insert', 'select', 'modify'];
    let operationCount = 0;
    
    const allText = JSON.stringify(results).toLowerCase();
    
    for (const operation of operations) {
      if (allText.includes(operation)) {
        operationCount++;
      }
    }
    
    return operationCount >= 2; // At least 2 CRUD operations mentioned
  }

  detectRESTPattern(results) {
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
    const restTerms = ['endpoint', 'resource', 'api', 'http'];
    
    const allText = JSON.stringify(results).toLowerCase();
    
    let methodCount = 0;
    let termCount = 0;
    
    for (const method of httpMethods) {
      if (allText.includes(method)) {
        methodCount++;
      }
    }
    
    for (const term of restTerms) {
      if (allText.includes(term)) {
        termCount++;
      }
    }
    
    return methodCount >= 2 && termCount >= 1;
  }

  calculateHierarchyDepth(context) {
    // Simple depth calculation based on relationship chains
    let maxDepth = 1;
    
    for (const relationship of context.relationships) {
      if (relationship.predicate.includes('parent') || 
          relationship.predicate.includes('child') ||
          relationship.predicate.includes('subClassOf')) {
        maxDepth = Math.max(maxDepth, 2); // Minimum hierarchy depth
      }
    }
    
    return maxDepth;
  }

  generateContextHash(context) {
    const contextString = JSON.stringify({
      entityCount: context.entities.length,
      propertyCount: context.properties.size,
      patterns: context.patterns.map(p => p.type).sort()
    });
    
    // Simple hash function (in production, would use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  calculateRenderingOrder(context) {
    // Simple ordering based on entity importance and dependencies
    return context.entities
      .sort((a, b) => b.importance - a.importance)
      .map(e => this.extractLocalName(e.uri));
  }

  calculateAverageEntityComplexity(context) {
    if (context.entities.length === 0) return 0;
    
    const totalComplexity = context.entities.reduce((sum, entity) => {
      return sum + entity.properties.length;
    }, 0);
    
    return totalComplexity / context.entities.length;
  }

  calculateRelationshipDensity(context) {
    if (context.entities.length <= 1) return 0;
    
    const maxPossibleRelationships = context.entities.length * (context.entities.length - 1);
    return context.relationships.length / maxPossibleRelationships;
  }

  calculateAveragePatternConfidence(context) {
    if (context.patterns.length === 0) return 0;
    
    const totalConfidence = context.patterns.reduce((sum, pattern) => {
      return sum + (pattern.confidence || 0);
    }, 0);
    
    return totalConfidence / context.patterns.length;
  }

  extractLocalName(uri) {
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const splitIndex = Math.max(lastSlash, lastHash);
    
    return splitIndex >= 0 ? uri.substring(splitIndex + 1) : uri;
  }

  toClassName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, '');
  }

  toVariableName(name) {
    return name.charAt(0).toLowerCase() + name.slice(1).replace(/[-_]/g, '');
  }

  toPropertyName(predicate) {
    const localName = this.extractLocalName(predicate);
    return this.toVariableName(localName);
  }

  inferPropertyType(property) {
    const value = property.object;
    
    if (!value) return 'string';
    
    if (/^\d+$/.test(value)) return 'integer';
    if (/^\d*\.\d+$/.test(value)) return 'float';
    if (/^(true|false)$/i.test(value)) return 'boolean';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (property.objectType === 'uri') return 'reference';
    
    return 'string';
  }

  generatePropertyExample(property) {
    const type = this.inferPropertyType(property);
    
    switch (type) {
      case 'integer': return '123';
      case 'float': return '123.45';
      case 'boolean': return 'true';
      case 'date': return '2023-12-01';
      case 'reference': return 'http://example.org/entity/1';
      default: return 'example value';
    }
  }

  _serializeTemplateContext(context) {
    return {
      entities: context.entities,
      properties: Object.fromEntries(context.properties),
      relationships: context.relationships,
      patterns: context.patterns,
      statistics: context.statistics,
      templateVariables: Object.fromEntries(context.templateVariables),
      renderingHints: context.renderingHints,
      metadata: context.metadata
    };
  }

  _serializeTemplateContextToXML(context) {
    let xml = '';
    
    xml += '    <entities>\n';
    for (const entity of context.entities) {
      xml += `      <entity uri="${this._escapeXML(entity.uri)}" type="${this._escapeXML(entity.type)}" importance="${entity.importance}"/>\n`;
    }
    xml += '    </entities>\n';
    
    xml += '    <patterns>\n';
    for (const pattern of context.patterns) {
      xml += `      <pattern type="${this._escapeXML(pattern.type)}" confidence="${pattern.confidence}"/>\n`;
    }
    xml += '    </patterns>\n';
    
    return xml;
  }

  _escapeXML(text) {
    if (typeof text !== 'string') return text;
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _escapeCSV(value, quote) {
    if (typeof value !== 'string') return value;
    
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return quote + value.replace(new RegExp(quote, 'g'), quote + quote) + quote;
    }
    
    return value;
  }

  _escapeTurtle(text) {
    if (typeof text !== 'string') return text;
    
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  _objectToYAML(obj, indent) {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          yaml += `${spaces}${key}:\n`;
          for (const item of value) {
            if (typeof item === 'object') {
              yaml += `${spaces}- \n${this._objectToYAML(item, indent + 1)}`;
            } else {
              yaml += `${spaces}- ${item}\n`;
            }
          }
        } else {
          yaml += `${spaces}${key}:\n${this._objectToYAML(value, indent + 1)}`;
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }

  validateFormat(formatted, format) {
    try {
      switch (format) {
        case 'json':
        case 'template-json':
        case 'template-context':
          JSON.parse(formatted);
          break;
        case 'xml':
          // Basic XML validation (would use proper parser in production)
          if (!formatted.includes('<?xml') || !formatted.includes('</sparql>')) {
            throw new Error('Invalid XML format');
          }
          break;
        // Add other format validations as needed
      }
    } catch (error) {
      throw new Error(`Format validation failed for ${format}: ${error.message}`);
    }
  }
}

export default KgenResultFormatter;