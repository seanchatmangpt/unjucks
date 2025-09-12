/**
 * Template Query Patterns - Pre-built SPARQL query patterns for template context extraction
 * 
 * Provides a library of optimized SPARQL query patterns for common template operations
 * including variable extraction, context population, and metadata retrieval.
 */

import { Consola } from 'consola';

export class TemplateQueryPatterns {
  constructor(config = {}) {
    this.config = {
      defaultNamespaces: {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'skos': 'http://www.w3.org/2004/02/skos/core#',
        'dct': 'http://purl.org/dc/terms/',
        'foaf': 'http://xmlns.com/foaf/0.1/',
        'kgen': 'http://kgen.dev/ontology#',
        'template': 'http://kgen.dev/template#'
      },
      ...config
    };
    
    this.logger = new Consola({ tag: 'template-query-patterns' });
    this.patterns = new Map();
    this.customPatterns = new Map();
    
    this._initializeBuiltInPatterns();
  }

  /**
   * Initialize built-in query patterns
   */
  _initializeBuiltInPatterns() {
    // Variable extraction patterns
    this.patterns.set('extract_template_variables', {
      name: 'Extract Template Variables',
      description: 'Extract all variables defined in a template',
      sparql: this._buildSPARQL(`
        SELECT DISTINCT ?variable ?name ?type ?description ?defaultValue ?required WHERE {
          ?template template:hasVariable ?variable .
          ?variable template:name ?name ;
                   template:type ?type .
          OPTIONAL { ?variable template:description ?description }
          OPTIONAL { ?variable template:defaultValue ?defaultValue }
          OPTIONAL { ?variable template:required ?required }
        }
        ORDER BY ?name
      `),
      parameters: ['template']
    });

    this.patterns.set('get_template_metadata', {
      name: 'Get Template Metadata',
      description: 'Retrieve metadata information about a template',
      sparql: this._buildSPARQL(`
        SELECT ?property ?value WHERE {
          ?template ?property ?value .
          FILTER(?property IN (
            template:name, template:description, template:version,
            template:author, template:license, template:category,
            dct:created, dct:modified, dct:title
          ))
        }
      `),
      parameters: ['template']
    });

    this.patterns.set('find_templates_by_category', {
      name: 'Find Templates by Category',
      description: 'Find all templates in a specific category',
      sparql: this._buildSPARQL(`
        SELECT ?template ?name ?description WHERE {
          ?template rdf:type template:Template ;
                   template:category ?category ;
                   template:name ?name .
          OPTIONAL { ?template template:description ?description }
        }
        ORDER BY ?name
      `),
      parameters: ['category']
    });

    this.patterns.set('get_variable_dependencies', {
      name: 'Get Variable Dependencies',
      description: 'Find dependencies between template variables',
      sparql: this._buildSPARQL(`
        SELECT ?sourceVar ?targetVar ?dependencyType WHERE {
          ?template template:hasVariable ?sourceVar .
          ?sourceVar template:dependsOn ?targetVar ;
                    template:dependencyType ?dependencyType .
        }
      `),
      parameters: ['template']
    });

    this.patterns.set('get_template_context', {
      name: 'Get Template Context',
      description: 'Retrieve complete context for template rendering',
      sparql: this._buildSPARQL(`
        SELECT ?variable ?name ?value ?type ?source WHERE {
          {
            # Direct variable values
            ?template template:hasVariable ?variable .
            ?variable template:name ?name ;
                     template:value ?value ;
                     template:type ?type .
            BIND(\"direct\" as ?source)
          } UNION {
            # Context-provided values  
            ?template template:hasContext ?context .
            ?context template:provides ?variable .
            ?variable template:name ?name ;
                     template:value ?value ;
                     template:type ?type .
            BIND(\"context\" as ?source)
          } UNION {
            # Computed values
            ?template template:hasVariable ?variable .
            ?variable template:name ?name ;
                     template:computedFrom ?computation ;
                     template:type ?type .
            ?computation template:result ?value .
            BIND(\"computed\" as ?source)
          }
        }
        ORDER BY ?name
      `),
      parameters: ['template']
    });

    this.patterns.set('validate_template_constraints', {
      name: 'Validate Template Constraints',
      description: 'Check template constraints and validation rules',
      sparql: this._buildSPARQL(`
        SELECT ?variable ?constraint ?rule ?valid ?message WHERE {
          ?template template:hasVariable ?variable .
          ?variable template:hasConstraint ?constraint .
          ?constraint template:rule ?rule ;
                     template:isValid ?valid .
          OPTIONAL { ?constraint template:message ?message }
        }
      `),
      parameters: ['template']
    });

    this.patterns.set('find_related_templates', {
      name: 'Find Related Templates',
      description: 'Find templates related to a given template',
      sparql: this._buildSPARQL(`
        SELECT DISTINCT ?relatedTemplate ?name ?relation WHERE {
          {
            ?template template:extends ?relatedTemplate .
            ?relatedTemplate template:name ?name .
            BIND(\"extends\" as ?relation)
          } UNION {
            ?template template:includes ?relatedTemplate .
            ?relatedTemplate template:name ?name .
            BIND(\"includes\" as ?relation)
          } UNION {
            ?template template:similarTo ?relatedTemplate .
            ?relatedTemplate template:name ?name .
            BIND(\"similar\" as ?relation)
          } UNION {
            ?relatedTemplate template:extends ?template .
            ?relatedTemplate template:name ?name .
            BIND(\"extended_by\" as ?relation)
          }
        }
        ORDER BY ?relation ?name
      `),
      parameters: ['template']
    });

    this.patterns.set('get_template_usage_stats', {
      name: 'Get Template Usage Statistics',
      description: 'Retrieve usage statistics for templates',
      sparql: this._buildSPARQL(`
        SELECT ?template ?name ?usageCount ?lastUsed ?avgRenderTime WHERE {
          ?template rdf:type template:Template ;
                   template:name ?name .
          OPTIONAL { ?template template:usageCount ?usageCount }
          OPTIONAL { ?template template:lastUsed ?lastUsed }
          OPTIONAL { ?template template:avgRenderTime ?avgRenderTime }
        }
        ORDER BY DESC(?usageCount) ?name
      `),
      parameters: []
    });

    this.patterns.set('search_templates_by_variables', {
      name: 'Search Templates by Variables',
      description: 'Find templates that use specific variable patterns',
      sparql: this._buildSPARQL(`
        SELECT DISTINCT ?template ?name ?score WHERE {
          ?template rdf:type template:Template ;
                   template:name ?name ;
                   template:hasVariable ?variable .
          ?variable template:name ?variableName .
          
          # Score based on variable name similarity
          BIND(
            IF(regex(?variableName, ?searchPattern, \"i\"), 3,
            IF(contains(lcase(?variableName), lcase(?searchTerm)), 2,
            IF(contains(lcase(?name), lcase(?searchTerm)), 1, 0)))
            as ?score
          )
          
          FILTER(?score > 0)
        }
        ORDER BY DESC(?score) ?name
      `),
      parameters: ['searchPattern', 'searchTerm']
    });

    this.patterns.set('get_template_hierarchy', {
      name: 'Get Template Hierarchy',
      description: 'Retrieve template inheritance hierarchy',
      sparql: this._buildSPARQL(`
        SELECT ?level ?template ?name ?parent WHERE {
          {
            ?template rdf:type template:Template ;
                     template:name ?name .
            FILTER NOT EXISTS { ?template template:extends ?parent }
            BIND(0 as ?level)
            BIND(?template as ?root)
          } UNION {
            ?template rdf:type template:Template ;
                     template:name ?name ;
                     template:extends ?parent .
            ?parent template:name ?parentName .
            # This would need recursive querying for full hierarchy
            BIND(1 as ?level)
          }
        }
        ORDER BY ?level ?name
      `),
      parameters: []
    });

    this.logger.info(`Initialized ${this.patterns.size} built-in query patterns`);
  }

  /**
   * Get a query pattern by name
   * @param {string} patternName - Name of the pattern
   * @param {Object} parameters - Parameters to substitute in the query
   * @returns {Object} Query pattern with substituted parameters
   */
  getPattern(patternName, parameters = {}) {
    const pattern = this.patterns.get(patternName) || this.customPatterns.get(patternName);
    
    if (!pattern) {
      throw new Error(`Query pattern not found: ${patternName}`);\n    }\n    \n    let sparql = pattern.sparql;\n    \n    // Substitute parameters\n    for (const [key, value] of Object.entries(parameters)) {\n      const placeholder = new RegExp(`\\\\?${key}\\\\b`, 'g');\n      sparql = sparql.replace(placeholder, this._formatValue(value));\n    }\n    \n    return {\n      ...pattern,\n      sparql,\n      substitutedParameters: parameters\n    };\n  }\n\n  /**\n   * Register a custom query pattern\n   * @param {string} name - Pattern name\n   * @param {Object} pattern - Pattern definition\n   */\n  registerPattern(name, pattern) {\n    if (!pattern.sparql) {\n      throw new Error('Pattern must include SPARQL query');\n    }\n    \n    this.customPatterns.set(name, {\n      name: pattern.name || name,\n      description: pattern.description || '',\n      sparql: this._buildSPARQL(pattern.sparql),\n      parameters: pattern.parameters || [],\n      category: pattern.category || 'custom'\n    });\n    \n    this.logger.info(`Registered custom pattern: ${name}`);\n  }\n\n  /**\n   * List all available patterns\n   * @param {string} category - Optional category filter\n   * @returns {Array} List of pattern information\n   */\n  listPatterns(category = null) {\n    const patterns = [];\n    \n    for (const [name, pattern] of this.patterns) {\n      if (!category || pattern.category === category) {\n        patterns.push({\n          name,\n          title: pattern.name,\n          description: pattern.description,\n          parameters: pattern.parameters,\n          category: pattern.category || 'builtin'\n        });\n      }\n    }\n    \n    for (const [name, pattern] of this.customPatterns) {\n      if (!category || pattern.category === category) {\n        patterns.push({\n          name,\n          title: pattern.name,\n          description: pattern.description,\n          parameters: pattern.parameters,\n          category: pattern.category\n        });\n      }\n    }\n    \n    return patterns.sort((a, b) => a.name.localeCompare(b.name));\n  }\n\n  /**\n   * Create a parameterized query for template variable extraction\n   * @param {string} templateUri - URI of the template\n   * @param {Array} variableNames - Specific variables to extract\n   * @returns {string} SPARQL query\n   */\n  createVariableExtractionQuery(templateUri, variableNames = null) {\n    let filterClause = '';\n    \n    if (variableNames && variableNames.length > 0) {\n      const nameList = variableNames.map(name => `\"${name}\"`).join(', ');\n      filterClause = `FILTER(?name IN (${nameList}))`;\n    }\n    \n    return this._buildSPARQL(`\n      SELECT ?variable ?name ?type ?value ?description ?required ?computed WHERE {\n        <${templateUri}> template:hasVariable ?variable .\n        ?variable template:name ?name ;\n                 template:type ?type .\n        \n        OPTIONAL { ?variable template:value ?value }\n        OPTIONAL { ?variable template:description ?description }\n        OPTIONAL { ?variable template:required ?required }\n        OPTIONAL { \n          ?variable template:computedFrom ?computation .\n          BIND(true as ?computed)\n        }\n        \n        ${filterClause}\n      }\n      ORDER BY ?required DESC, ?name\n    `);\n  }\n\n  /**\n   * Create a query for template context validation\n   * @param {string} templateUri - URI of the template\n   * @param {Object} providedContext - Context values to validate\n   * @returns {string} SPARQL query\n   */\n  createContextValidationQuery(templateUri, providedContext = {}) {\n    const providedVars = Object.keys(providedContext);\n    const contextTriples = providedVars.map(varName => {\n      const value = providedContext[varName];\n      return `    BIND(\"${varName}\" as ?providedName${varName})\n    BIND(${this._formatValue(value)} as ?providedValue${varName})`;\n    }).join('\\n');\n    \n    return this._buildSPARQL(`\n      SELECT ?variable ?name ?required ?provided ?valid ?issue WHERE {\n        <${templateUri}> template:hasVariable ?variable .\n        ?variable template:name ?name .\n        OPTIONAL { ?variable template:required ?required }\n        \n        # Check if variable is provided in context\n${contextTriples}\n        \n        BIND(\n          ${providedVars.map(varName => \n            `IF(?name = \"${varName}\", true, `\n          ).join('')}false${')'.repeat(providedVars.length)}\n          as ?provided\n        )\n        \n        BIND(\n          IF(?required = true && !?provided, false,\n          IF(?provided, true, true))\n          as ?valid\n        )\n        \n        BIND(\n          IF(?required = true && !?provided, \"Missing required variable\",\n          \"\")\n          as ?issue\n        )\n      }\n      ORDER BY ?required DESC, ?name\n    `);\n  }\n\n  /**\n   * Create a query for finding templates with similar variables\n   * @param {Array} variableNames - Variable names to match\n   * @param {number} minMatchCount - Minimum number of variables that must match\n   * @returns {string} SPARQL query\n   */\n  createSimilarTemplatesQuery(variableNames, minMatchCount = 1) {\n    const varFilters = variableNames.map(name => \n      `?variable template:name \"${name}\"`\n    ).join(' || ');\n    \n    return this._buildSPARQL(`\n      SELECT ?template ?templateName ?matchCount ?similarity WHERE {\n        {\n          SELECT ?template (COUNT(DISTINCT ?variable) as ?matchCount) WHERE {\n            ?template rdf:type template:Template ;\n                     template:hasVariable ?variable .\n            ?variable template:name ?varName .\n            \n            FILTER(${varFilters})\n          }\n          GROUP BY ?template\n          HAVING(?matchCount >= ${minMatchCount})\n        }\n        \n        ?template template:name ?templateName .\n        \n        # Calculate similarity score\n        BIND(?matchCount / ${variableNames.length} as ?similarity)\n      }\n      ORDER BY DESC(?similarity) DESC(?matchCount) ?templateName\n    `);\n  }\n\n  /**\n   * Build SPARQL query with namespace prefixes\n   * @param {string} query - SPARQL query body\n   * @returns {string} Complete SPARQL query with prefixes\n   */\n  _buildSPARQL(query) {\n    const prefixes = Object.entries(this.config.defaultNamespaces)\n      .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`)\n      .join('\\n');\n    \n    return `${prefixes}\\n\\n${query.trim()}`;\n  }\n\n  /**\n   * Format a value for SPARQL query substitution\n   * @param {*} value - Value to format\n   * @returns {string} SPARQL-formatted value\n   */\n  _formatValue(value) {\n    if (value === null || value === undefined) {\n      return 'UNDEF';\n    }\n    \n    if (typeof value === 'string') {\n      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {\n        return `<${value}>`;\n      }\n      return `\"${value.replace(/\"/g, '\\\\\"')}\"`;\n    }\n    \n    if (typeof value === 'number') {\n      return value.toString();\n    }\n    \n    if (typeof value === 'boolean') {\n      return value.toString();\n    }\n    \n    if (value instanceof Date) {\n      return `\"${value.toISOString()}\"^^xsd:dateTime`;\n    }\n    \n    // Default: convert to string literal\n    return `\"${String(value).replace(/\"/g, '\\\\\"')}\"`;\n  }\n\n  /**\n   * Generate template-specific queries based on template analysis\n   * @param {Object} template - Template object or URI\n   * @returns {Object} Generated queries for the template\n   */\n  async generateTemplateQueries(template) {\n    const templateUri = typeof template === 'string' ? template : template.uri;\n    \n    const queries = {\n      // Core queries\n      getMetadata: this.getPattern('get_template_metadata', { template: templateUri }),\n      getVariables: this.getPattern('extract_template_variables', { template: templateUri }),\n      getContext: this.getPattern('get_template_context', { template: templateUri }),\n      \n      // Validation queries\n      validateConstraints: this.getPattern('validate_template_constraints', { template: templateUri }),\n      \n      // Relationship queries\n      getRelated: this.getPattern('find_related_templates', { template: templateUri }),\n      getDependencies: this.getPattern('get_variable_dependencies', { template: templateUri }),\n      \n      // Custom extraction query\n      extractAllData: this._buildSPARQL(`\n        SELECT * WHERE {\n          <${templateUri}> ?predicate ?object .\n          OPTIONAL {\n            ?object ?subPredicate ?subObject .\n            FILTER(isBlank(?object))\n          }\n        }\n      `)\n    };\n    \n    return queries;\n  }\n\n  /**\n   * Create a query builder for complex template queries\n   * @param {string} templateUri - Template URI\n   * @returns {TemplateQueryBuilder} Query builder instance\n   */\n  createQueryBuilder(templateUri) {\n    return new TemplateQueryBuilder(templateUri, this);\n  }\n}\n\n/**\n * Template Query Builder for constructing complex queries\n */\nclass TemplateQueryBuilder {\n  constructor(templateUri, patterns) {\n    this.templateUri = templateUri;\n    this.patterns = patterns;\n    this.selectClauses = [];\n    this.whereClauses = [];\n    this.optionalClauses = [];\n    this.filterClauses = [];\n    this.orderClauses = [];\n    this.limitValue = null;\n  }\n\n  /**\n   * Add variables to SELECT clause\n   */\n  select(...variables) {\n    this.selectClauses.push(...variables);\n    return this;\n  }\n\n  /**\n   * Add WHERE clause patterns\n   */\n  where(pattern) {\n    this.whereClauses.push(pattern);\n    return this;\n  }\n\n  /**\n   * Add OPTIONAL clause patterns\n   */\n  optional(pattern) {\n    this.optionalClauses.push(pattern);\n    return this;\n  }\n\n  /**\n   * Add FILTER conditions\n   */\n  filter(condition) {\n    this.filterClauses.push(condition);\n    return this;\n  }\n\n  /**\n   * Add ORDER BY clause\n   */\n  orderBy(...expressions) {\n    this.orderClauses.push(...expressions);\n    return this;\n  }\n\n  /**\n   * Set LIMIT\n   */\n  limit(count) {\n    this.limitValue = count;\n    return this;\n  }\n\n  /**\n   * Build the complete SPARQL query\n   */\n  build() {\n    const select = this.selectClauses.length > 0 ? \n      this.selectClauses.join(' ') : '*';\n    \n    let query = `SELECT ${select} WHERE {\\n`;\n    \n    // Add template binding\n    query += `  BIND(<${this.templateUri}> as ?template)\\n`;\n    \n    // Add WHERE clauses\n    for (const clause of this.whereClauses) {\n      query += `  ${clause}\\n`;\n    }\n    \n    // Add OPTIONAL clauses\n    for (const clause of this.optionalClauses) {\n      query += `  OPTIONAL { ${clause} }\\n`;\n    }\n    \n    // Add FILTER clauses\n    for (const clause of this.filterClauses) {\n      query += `  FILTER(${clause})\\n`;\n    }\n    \n    query += '}';\n    \n    // Add ORDER BY\n    if (this.orderClauses.length > 0) {\n      query += `\\nORDER BY ${this.orderClauses.join(' ')}`;\n    }\n    \n    // Add LIMIT\n    if (this.limitValue) {\n      query += `\\nLIMIT ${this.limitValue}`;\n    }\n    \n    return this.patterns._buildSPARQL(query);\n  }\n}\n\nexport default TemplateQueryPatterns;"