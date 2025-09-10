/**
 * Variable Extractor
 * 
 * Extracts variables from templates, infers types, generates CLI flags,
 * and provides variable validation and transformation capabilities.
 */

import { Logger } from '../utils/logger.js';

/**
 * Variable Extractor and CLI Generator
 * 
 * Handles comprehensive variable extraction from template content,
 * type inference, CLI flag generation, and validation rules.
 */
export class VariableExtractor {
  /**
   * Initialize the variable extractor
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.typeInference - Type inference rules
   */
  constructor(options = {}) {
    this.logger = options.logger || new Logger();
    this.typeInference = {
      boolean: /^(with|is|has|enable|disable|should|can|will)[A-Z]/,
      array: /\[\]$|Items$|List$|s$/,
      object: /Config$|Options$|Settings$|Data$/,
      number: /^(count|size|length|index|id|num)/i,
      ...options.typeInference
    };
    
    this.extractionCache = new Map();
  }

  /**
   * Extract all variables from template content and frontmatter
   * @param {string} content - Template content
   * @param {Object} frontmatter - Template frontmatter
   * @param {string} templatePath - Template file path for context
   * @returns {Object} Extraction result with variables and metadata
   */
  extract(content, frontmatter, templatePath = '') {
    try {
      this.logger.debug('Extracting variables', { templatePath });

      // Check cache first
      const cacheKey = this.generateCacheKey(content, frontmatter);
      if (this.extractionCache.has(cacheKey)) {
        return this.extractionCache.get(cacheKey);
      }

      const variables = new Map();
      const context = {
        templatePath,
        content,
        frontmatter
      };

      // Extract from different sources
      this.extractFromContent(variables, content, context);
      this.extractFromFrontmatter(variables, frontmatter, context);
      this.extractFromMetadata(variables, frontmatter.meta, context);

      // Convert to array and enrich with metadata
      const variableArray = Array.from(variables.values())
        .map(variable => this.enrichVariable(variable, context))
        .sort((a, b) => {
          // Sort by: required first, then alphabetically
          if (a.required !== b.required) {
            return a.required ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      const result = {
        variables: variableArray,
        statistics: this.generateStatistics(variableArray),
        cliFlags: this.generateCliFlags(variableArray),
        validationRules: this.generateValidationRules(variableArray)
      };

      // Cache the result
      this.extractionCache.set(cacheKey, result);

      this.logger.debug('Variable extraction complete', {
        templatePath,
        count: variableArray.length,
        types: result.statistics.types
      });

      return result;

    } catch (error) {
      this.logger.error('Variable extraction failed', {
        templatePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract variables from template content
   * @param {Map} variables - Variables map to populate
   * @param {string} content - Template content
   * @param {Object} context - Extraction context
   */
  extractFromContent(variables, content, context) {
    // Define extraction patterns
    const patterns = {
      simple: {
        regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'simple',
          required: true,
          source: 'content'
        })
      },
      
      filtered: {
        regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
        processor: (match, varName, filterName) => ({
          name: varName,
          usage: 'filtered',
          filter: filterName,
          required: true,
          source: 'content'
        })
      },
      
      conditional: {
        regex: /\{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'conditional',
          required: false,
          source: 'content'
        })
      },
      
      negatedConditional: {
        regex: /\{%\s*if\s+not\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'negated_conditional',
          required: false,
          source: 'content'
        })
      },
      
      loop: {
        regex: /\{%\s*for\s+\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'loop',
          required: true,
          source: 'content'
        })
      },
      
      propertyAccess: {
        regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'property',
          required: true,
          source: 'content'
        })
      },
      
      arrayAccess: {
        regex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\[[\d\w]+\]\s*\}\}/g,
        processor: (match, varName) => ({
          name: varName,
          usage: 'array',
          required: true,
          source: 'content'
        })
      }
    };

    // Process each pattern
    for (const [patternName, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const variable = pattern.processor(...match);
        this.mergeVariable(variables, variable, context);
      }
    }
  }

  /**
   * Extract variables from frontmatter
   * @param {Map} variables - Variables map to populate
   * @param {Object} frontmatter - Template frontmatter
   * @param {Object} context - Extraction context
   */
  extractFromFrontmatter(variables, frontmatter, context) {
    // Extract from output path
    if (frontmatter.to) {
      this.extractFromTemplate(variables, frontmatter.to, {
        ...context,
        usage: 'path',
        required: true,
        source: 'frontmatter.to'
      });
    }

    // Extract from conditional logic
    if (frontmatter.skipIf && typeof frontmatter.skipIf === 'string') {
      this.extractFromTemplate(variables, frontmatter.skipIf, {
        ...context,
        usage: 'condition',
        required: false,
        source: 'frontmatter.skipIf'
      });
    }

    // Extract from shell command
    if (frontmatter.sh) {
      this.extractFromTemplate(variables, frontmatter.sh, {
        ...context,
        usage: 'shell',
        required: true,
        source: 'frontmatter.sh'
      });
    }

    // Extract from injection patterns
    ['before', 'after', 'replace'].forEach(directive => {
      if (frontmatter[directive]) {
        this.extractFromTemplate(variables, frontmatter[directive], {
          ...context,
          usage: 'injection',
          required: true,
          source: `frontmatter.${directive}`
        });
      }
    });
  }

  /**
   * Extract variables from metadata section
   * @param {Map} variables - Variables map to populate
   * @param {Object} metadata - Template metadata
   * @param {Object} context - Extraction context
   */
  extractFromMetadata(variables, metadata, context) {
    if (!metadata?.variables) return;

    metadata.variables.forEach(metaVar => {
      const variable = {
        name: metaVar.name,
        type: metaVar.type || 'string',
        required: metaVar.required !== false,
        default: metaVar.default,
        description: metaVar.description,
        usage: 'metadata',
        source: 'frontmatter.meta.variables',
        validation: metaVar.validation
      };

      this.mergeVariable(variables, variable, context);
    });
  }

  /**
   * Extract variables from template string
   * @param {Map} variables - Variables map to populate
   * @param {string} template - Template string
   * @param {Object} context - Extraction context
   */
  extractFromTemplate(variables, template, context) {
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]+)?\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = {
        name: match[1],
        usage: context.usage,
        required: context.required,
        source: context.source
      };

      this.mergeVariable(variables, variable, context);
    }
  }

  /**
   * Merge variable into collection, handling conflicts
   * @param {Map} variables - Variables map
   * @param {Object} variable - Variable to merge
   * @param {Object} context - Extraction context
   */
  mergeVariable(variables, variable, context) {
    const existing = variables.get(variable.name);

    if (existing) {
      // Merge properties, preferring more specific information
      const merged = {
        ...existing,
        ...variable,
        usage: this.mergeUsage(existing.usage, variable.usage),
        required: existing.required || variable.required,
        sources: [...(existing.sources || [existing.source]), variable.source]
      };

      variables.set(variable.name, merged);
    } else {
      variables.set(variable.name, {
        ...variable,
        sources: [variable.source]
      });
    }
  }

  /**
   * Merge usage types
   * @param {string} existing - Existing usage
   * @param {string} newUsage - New usage
   * @returns {string} Merged usage
   */
  mergeUsage(existing, newUsage) {
    const priority = {
      metadata: 4,
      property: 3,
      filtered: 3,
      simple: 2,
      conditional: 1,
      path: 2,
      shell: 2,
      injection: 2
    };

    return (priority[newUsage] || 0) > (priority[existing] || 0) ? newUsage : existing;
  }

  /**
   * Enrich variable with inferred type and metadata
   * @param {Object} variable - Variable to enrich
   * @param {Object} context - Extraction context
   * @returns {Object} Enriched variable
   */
  enrichVariable(variable, context) {
    const enriched = { ...variable };

    // Infer type if not specified
    if (!enriched.type) {
      enriched.type = this.inferType(variable, context);
    }

    // Generate description if missing
    if (!enriched.description) {
      enriched.description = this.generateDescription(variable);
    }

    // Generate default value if appropriate
    if (enriched.default === undefined && !enriched.required) {
      enriched.default = this.generateDefault(enriched.type);
    }

    // Add CLI flag name
    enriched.cliFlag = this.generateCliFlag(enriched.name);

    // Add validation rules
    enriched.validation = this.generateValidation(enriched);

    return enriched;
  }

  /**
   * Infer variable type from name and usage
   * @param {Object} variable - Variable object
   * @param {Object} context - Extraction context
   * @returns {string} Inferred type
   */
  inferType(variable, context) {
    const name = variable.name;
    const content = context.content;

    // Check explicit type inference rules
    for (const [type, pattern] of Object.entries(this.typeInference)) {
      if (pattern.test(name)) {
        return type;
      }
    }

    // Context-based inference
    if (variable.usage === 'conditional' || variable.usage === 'negated_conditional') {
      return 'boolean';
    }

    if (variable.usage === 'loop' || variable.usage === 'array') {
      return 'array';
    }

    if (variable.usage === 'property') {
      return 'object';
    }

    // Content-based inference
    if (content) {
      // Array usage patterns
      if (content.includes(`${name}.length`) || content.includes(`${name}.map`) || 
          content.includes(`${name}.forEach`) || content.includes(`for ${name}`)) {
        return 'array';
      }

      // Object usage patterns
      if (content.includes(`${name}.`) && !content.includes(`${name}.length`)) {
        return 'object';
      }

      // Number usage patterns
      if (content.includes(`${name} + `) || content.includes(`${name} - `) ||
          content.includes(`${name} * `) || content.includes(`${name} / `)) {
        return 'number';
      }
    }

    // Default to string
    return 'string';
  }

  /**
   * Generate variable description
   * @param {Object} variable - Variable object
   * @returns {string} Generated description
   */
  generateDescription(variable) {
    const typeDescriptions = {
      string: 'text value',
      boolean: 'true/false flag',
      number: 'numeric value',
      array: 'list of items',
      object: 'configuration object'
    };

    const usageDescriptions = {
      simple: 'Variable',
      filtered: 'Filtered variable',
      conditional: 'Conditional flag',
      loop: 'Array for iteration',
      property: 'Object with properties',
      path: 'Path component',
      shell: 'Shell command parameter',
      injection: 'Injection pattern parameter'
    };

    const typeDesc = typeDescriptions[variable.type] || 'value';
    const usageDesc = usageDescriptions[variable.usage] || 'Variable';

    return `${usageDesc}: ${variable.name} (${typeDesc})`;
  }

  /**
   * Generate default value for type
   * @param {string} type - Variable type
   * @returns {any} Default value
   */
  generateDefault(type) {
    const defaults = {
      string: '',
      boolean: false,
      number: 0,
      array: [],
      object: {}
    };

    return defaults[type];
  }

  /**
   * Generate CLI flag name
   * @param {string} varName - Variable name
   * @returns {string} CLI flag name
   */
  generateCliFlag(varName) {
    // Convert camelCase to kebab-case
    return varName.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  /**
   * Generate validation rules for variable
   * @param {Object} variable - Variable object
   * @returns {Object} Validation rules
   */
  generateValidation(variable) {
    const rules = {
      type: variable.type,
      required: variable.required
    };

    // Type-specific validation
    switch (variable.type) {
      case 'string':
        if (variable.usage === 'path') {
          rules.pattern = '^[a-zA-Z0-9._/-]+$';
          rules.message = 'Must be a valid path';
        }
        break;

      case 'boolean':
        rules.values = [true, false];
        break;

      case 'number':
        rules.min = 0;
        break;

      case 'array':
        rules.minItems = 0;
        break;
    }

    return rules;
  }

  /**
   * Generate CLI flags configuration
   * @param {Array} variables - Variables array
   * @returns {Object} CLI flags configuration
   */
  generateCliFlags(variables) {
    const flags = {};

    variables.forEach(variable => {
      flags[variable.cliFlag] = {
        type: this.mapTypeToCliType(variable.type),
        description: variable.description,
        required: variable.required,
        default: variable.default,
        alias: this.generateAlias(variable.name)
      };
    });

    return flags;
  }

  /**
   * Map variable type to CLI type
   * @param {string} type - Variable type
   * @returns {string} CLI type
   */
  mapTypeToCliType(type) {
    const mapping = {
      string: 'string',
      boolean: 'boolean',
      number: 'number',
      array: 'array',
      object: 'string' // JSON string
    };

    return mapping[type] || 'string';
  }

  /**
   * Generate CLI alias for variable
   * @param {string} varName - Variable name
   * @returns {string|undefined} Alias or undefined
   */
  generateAlias(varName) {
    // Generate single letter alias for common patterns
    const commonAliases = {
      name: 'n',
      type: 't',
      path: 'p',
      output: 'o',
      input: 'i',
      config: 'c',
      debug: 'd',
      verbose: 'v',
      force: 'f',
      help: 'h'
    };

    return commonAliases[varName.toLowerCase()];
  }

  /**
   * Generate validation rules for all variables
   * @param {Array} variables - Variables array
   * @returns {Object} Validation rules
   */
  generateValidationRules(variables) {
    return {
      required: variables.filter(v => v.required).map(v => v.name),
      types: Object.fromEntries(
        variables.map(v => [v.name, v.type])
      ),
      defaults: Object.fromEntries(
        variables.filter(v => v.default !== undefined).map(v => [v.name, v.default])
      )
    };
  }

  /**
   * Generate statistics about extracted variables
   * @param {Array} variables - Variables array
   * @returns {Object} Statistics object
   */
  generateStatistics(variables) {
    const stats = {
      total: variables.length,
      required: variables.filter(v => v.required).length,
      optional: variables.filter(v => !v.required).length,
      types: {},
      usage: {},
      sources: {}
    };

    variables.forEach(variable => {
      // Count by type
      stats.types[variable.type] = (stats.types[variable.type] || 0) + 1;
      
      // Count by usage
      stats.usage[variable.usage] = (stats.usage[variable.usage] || 0) + 1;
      
      // Count by source
      if (variable.sources) {
        variable.sources.forEach(source => {
          stats.sources[source] = (stats.sources[source] || 0) + 1;
        });
      }
    });

    return stats;
  }

  /**
   * Generate cache key for extraction result
   * @param {string} content - Template content
   * @param {Object} frontmatter - Template frontmatter
   * @returns {string} Cache key
   */
  generateCacheKey(content, frontmatter) {
    const contentHash = this.simpleHash(content);
    const frontmatterHash = this.simpleHash(JSON.stringify(frontmatter));
    return `${contentHash}-${frontmatterHash}`;
  }

  /**
   * Simple hash function for caching
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear extraction cache
   */
  clearCache() {
    this.extractionCache.clear();
  }

  /**
   * Get extraction statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      cacheSize: this.extractionCache.size,
      typeInferenceRules: Object.keys(this.typeInference).length
    };
  }
}