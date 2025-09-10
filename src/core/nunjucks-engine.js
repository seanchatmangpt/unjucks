/**
 * Nunjucks Rendering Engine
 * 
 * Enhanced Nunjucks environment with custom filters for semantic web,
 * API documentation, LaTeX processing, and advanced code generation.
 */

import nunjucks from 'nunjucks';
import { Logger } from '../utils/logger.js';

/**
 * Enhanced Nunjucks Rendering Engine
 * 
 * Provides template rendering with custom filters for various domains
 * including semantic web, API docs, LaTeX, and naming conventions.
 */
export class NunjucksEngine {
  /**
   * Initialize the Nunjucks rendering engine
   * @param {Object} options - Configuration options
   * @param {string} options.templatesDir - Templates directory path
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.autoescape - Enable auto-escaping
   * @param {boolean} options.throwOnUndefined - Throw on undefined variables
   */
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || '_templates';
    this.logger = options.logger || new Logger();
    this.autoescape = options.autoescape !== false;
    this.throwOnUndefined = options.throwOnUndefined !== false;
    
    this.renderCache = new Map();
    this.initialized = false;
    
    this.initialize();
  }

  /**
   * Initialize the Nunjucks environment and register filters
   */
  initialize() {
    if (this.initialized) return;

    // Create Nunjucks environment
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.templatesDir, {
        noCache: false,
        watch: false
      }),
      {
        autoescape: this.autoescape,
        throwOnUndefined: this.throwOnUndefined,
        trimBlocks: true,
        lstripBlocks: true
      }
    );

    // Register all custom filters
    this.registerNamingFilters();
    this.registerSemanticFilters();
    this.registerApiFilters();
    this.registerLatexFilters();
    this.registerUtilityFilters();
    this.registerCodeGenerationFilters();

    this.initialized = true;

    this.logger.debug('Nunjucks engine initialized', {
      templatesDir: this.templatesDir,
      autoescape: this.autoescape,
      filters: Object.keys(this.env.filters).length
    });
  }

  /**
   * Register naming convention filters
   */
  registerNamingFilters() {
    // Pascal Case: "user_name" → "UserName"
    this.env.addFilter('pascalCase', (str) => {
      if (!str) return str;
      return str
        .replace(/[_-](.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, char => char.toUpperCase());
    });

    // Camel Case: "user_name" → "userName"
    this.env.addFilter('camelCase', (str) => {
      if (!str) return str;
      return str
        .replace(/[_-](.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, char => char.toLowerCase());
    });

    // Kebab Case: "UserName" → "user-name"
    this.env.addFilter('kebabCase', (str) => {
      if (!str) return str;
      return str
        .replace(/([A-Z])/g, '-$1')
        .replace(/^-/, '')
        .toLowerCase()
        .replace(/[_\s]+/g, '-');
    });

    // Snake Case: "UserName" → "user_name"
    this.env.addFilter('snakeCase', (str) => {
      if (!str) return str;
      return str
        .replace(/([A-Z])/g, '_$1')
        .replace(/^_/, '')
        .toLowerCase()
        .replace(/[-\s]+/g, '_');
    });

    // Constant Case: "userName" → "USER_NAME"
    this.env.addFilter('constantCase', (str) => {
      if (!str) return str;
      return str
        .replace(/([A-Z])/g, '_$1')
        .replace(/^_/, '')
        .toUpperCase()
        .replace(/[-\s]+/g, '_');
    });

    // Dot Case: "userName" → "user.name"
    this.env.addFilter('dotCase', (str) => {
      if (!str) return str;
      return str
        .replace(/([A-Z])/g, '.$1')
        .replace(/^\./, '')
        .toLowerCase()
        .replace(/[_-\s]+/g, '.');
    });
  }

  /**
   * Register semantic web and RDF filters
   */
  registerSemanticFilters() {
    // Extract label from RDF URI: "http://example.org/Person" → "Person"
    this.env.addFilter('rdfLabel', (uri) => {
      if (!uri || typeof uri !== 'string') return uri;
      
      // Handle hash fragments
      if (uri.includes('#')) {
        return uri.split('#').pop();
      }
      
      // Handle path segments
      const segments = uri.split('/');
      return segments[segments.length - 1] || uri;
    });

    // Generate RDF comment with proper escaping
    this.env.addFilter('rdfComment', (text, lang = 'en') => {
      if (!text) return text;
      
      const escaped = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      
      return `"${escaped}"@${lang}`;
    });

    // Format RDF property with proper namespace
    this.env.addFilter('rdfProperty', (property, namespace = '') => {
      if (!property) return property;
      
      if (namespace && !property.includes(':') && !property.startsWith('http')) {
        return `${namespace}:${property}`;
      }
      
      return property;
    });

    // Generate semantic ID from text
    this.env.addFilter('semanticId', (text, namespace = '') => {
      if (!text) return text;
      
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      return namespace ? `${namespace}:${id}` : id;
    });

    // Create concept map notation
    this.env.addFilter('conceptMap', (concept, relations = []) => {
      if (!concept) return concept;
      
      let map = `[${concept}]`;
      
      if (relations.length > 0) {
        const relationStr = relations
          .map(rel => `--${rel.predicate}-->[${rel.object}]`)
          .join(' ');
        map += ` ${relationStr}`;
      }
      
      return map;
    });
  }

  /**
   * Register API documentation filters
   */
  registerApiFilters() {
    // Generate API documentation comment
    this.env.addFilter('apiDoc', (endpoint, method = 'GET') => {
      if (!endpoint) return endpoint;
      
      return `/**
 * ${method.toUpperCase()} ${endpoint}
 * 
 * @api {${method.toLowerCase()}} ${endpoint}
 * @apiName ${this.env.getFilter('pascalCase')(endpoint.replace(/[\/{}]/g, ''))}
 * @apiGroup API
 */`;
    });

    // Convert to Swagger/OpenAPI type
    this.env.addFilter('swaggerType', (jsType) => {
      const typeMap = {
        string: 'string',
        number: 'number',
        boolean: 'boolean',
        array: 'array',
        object: 'object',
        date: 'string',
        undefined: 'string'
      };
      
      return typeMap[jsType] || 'string';
    });

    // Generate JSON Schema
    this.env.addFilter('jsonSchema', (obj, title = 'Schema') => {
      if (!obj || typeof obj !== 'object') {
        return JSON.stringify({ type: 'string' }, null, 2);
      }
      
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title,
        properties: {},
        required: []
      };
      
      Object.entries(obj).forEach(([key, value]) => {
        const type = Array.isArray(value) ? 'array' : typeof value;
        schema.properties[key] = { type: this.env.getFilter('swaggerType')(type) };
        
        if (value !== undefined && value !== null) {
          schema.required.push(key);
        }
      });
      
      return JSON.stringify(schema, null, 2);
    });

    // Format HTTP status message
    this.env.addFilter('httpStatus', (code) => {
      const statusMap = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        422: 'Unprocessable Entity',
        500: 'Internal Server Error'
      };
      
      return statusMap[code] || 'Unknown Status';
    });
  }

  /**
   * Register LaTeX and mathematical formatting filters
   */
  registerLatexFilters() {
    // Escape LaTeX special characters
    this.env.addFilter('texEscape', (text) => {
      if (!text || typeof text !== 'string') return text;
      
      const escapeMap = {
        '\\': '\\textbackslash{}',
        '{': '\\{',
        '}': '\\}',
        '$': '\\$',
        '&': '\\&',
        '%': '\\%',
        '#': '\\#',
        '^': '\\textasciicircum{}',
        '_': '\\_',
        '~': '\\textasciitilde{}',
        '<': '\\textless{}',
        '>': '\\textgreater{}'
      };
      
      return text.replace(/[\\{}$&%#^_~<>]/g, char => escapeMap[char] || char);
    });

    // Format mathematical expressions for LaTeX
    this.env.addFilter('mathJax', (expression) => {
      if (!expression) return expression;
      
      // Wrap in math delimiters if not already wrapped
      if (!expression.includes('$') && !expression.includes('\\(')) {
        return `$${expression}$`;
      }
      
      return expression;
    });

    // Generate TikZ diagram code
    this.env.addFilter('tikzDiagram', (nodes, edges = []) => {
      if (!nodes || !Array.isArray(nodes)) return '';
      
      let tikz = '\\begin{tikzpicture}\n';
      
      // Add nodes
      nodes.forEach((node, index) => {
        tikz += `  \\node (${node.id || index}) at (${node.x || index}, ${node.y || 0}) {${node.label || node}};\n`;
      });
      
      // Add edges
      edges.forEach(edge => {
        tikz += `  \\draw[->] (${edge.from}) -- (${edge.to});\n`;
      });
      
      tikz += '\\end{tikzpicture}';
      
      return tikz;
    });

    // Format bibliography entry
    this.env.addFilter('bibEntry', (entry) => {
      if (!entry || typeof entry !== 'object') return '';
      
      const { type = 'article', key, author, title, journal, year, pages } = entry;
      
      let bibTeX = `@${type}{${key},\n`;
      if (author) bibTeX += `  author = {${author}},\n`;
      if (title) bibTeX += `  title = {${title}},\n`;
      if (journal) bibTeX += `  journal = {${journal}},\n`;
      if (year) bibTeX += `  year = {${year}},\n`;
      if (pages) bibTeX += `  pages = {${pages}},\n`;
      bibTeX += '}';
      
      return bibTeX;
    });
  }

  /**
   * Register utility and helper filters
   */
  registerUtilityFilters() {
    // Deep merge objects
    this.env.addFilter('merge', (obj1, obj2) => {
      if (!obj1 || !obj2) return obj1 || obj2;
      return { ...obj1, ...obj2 };
    });

    // Get array of object keys
    this.env.addFilter('objectKeys', (obj) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.keys(obj);
    });

    // Get array of object values
    this.env.addFilter('objectValues', (obj) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.values(obj);
    });

    // Format file size
    this.env.addFilter('fileSize', (bytes) => {
      if (!bytes || typeof bytes !== 'number') return '0 B';
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    });

    // Format duration in human readable format
    this.env.addFilter('duration', (ms) => {
      if (!ms || typeof ms !== 'number') return '0ms';
      
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
      
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    });

    // Pluralize word based on count
    this.env.addFilter('pluralize', (word, count = 0, plural = null) => {
      if (count === 1) return word;
      return plural || (word + 's');
    });
  }

  /**
   * Register code generation specific filters
   */
  registerCodeGenerationFilters() {
    // Generate import statement
    this.env.addFilter('importStatement', (module, imports = [], from = true) => {
      if (!module) return '';
      
      if (imports.length === 0) {
        return from ? `import '${module}';` : `const ${module} = require('${module}');`;
      }
      
      const importList = Array.isArray(imports) ? imports.join(', ') : imports;
      
      if (from) {
        return `import { ${importList} } from '${module}';`;
      } else {
        return `const { ${importList} } = require('${module}');`;
      }
    });

    // Generate function signature
    this.env.addFilter('functionSignature', (name, params = [], returnType = 'void', async = false) => {
      const asyncKeyword = async ? 'async ' : '';
      const paramList = Array.isArray(params) ? params.join(', ') : params;
      const returnTypeAnnotation = returnType !== 'void' ? `: ${returnType}` : '';
      
      return `${asyncKeyword}function ${name}(${paramList})${returnTypeAnnotation}`;
    });

    // Generate class definition
    this.env.addFilter('classDefinition', (name, extends_ = null, implements_ = []) => {
      let definition = `class ${name}`;
      
      if (extends_) {
        definition += ` extends ${extends_}`;
      }
      
      if (implements_.length > 0) {
        const implementsList = Array.isArray(implements_) ? implements_.join(', ') : implements_;
        definition += ` implements ${implementsList}`;
      }
      
      return definition;
    });

    // Generate JSDoc comment
    this.env.addFilter('jsDoc', (description, params = [], returns = null) => {
      let doc = '/**\n';
      doc += ` * ${description}\n`;
      
      if (params.length > 0) {
        doc += ' *\n';
        params.forEach(param => {
          doc += ` * @param {${param.type || 'any'}} ${param.name} ${param.description || ''}\n`;
        });
      }
      
      if (returns) {
        doc += ` * @returns {${returns.type || 'any'}} ${returns.description || ''}\n`;
      }
      
      doc += ' */';
      
      return doc;
    });

    // Format code block with language
    this.env.addFilter('codeBlock', (code, language = 'javascript') => {
      if (!code) return '';
      
      return `\`\`\`${language}\n${code}\n\`\`\``;
    });
  }

  /**
   * Render template with variables
   * @param {string} templatePath - Path to template file (relative to templates dir)
   * @param {Object} variables - Template variables
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} Rendered content
   */
  async render(templatePath, variables = {}, options = {}) {
    try {
      this.logger.debug('Rendering template', {
        templatePath,
        variableCount: Object.keys(variables).length
      });

      // Check cache if enabled
      const cacheKey = this.generateCacheKey(templatePath, variables);
      if (!options.noCache && this.renderCache.has(cacheKey)) {
        this.logger.debug('Using cached render result', { templatePath });
        return this.renderCache.get(cacheKey);
      }

      // Add global variables
      const contextVariables = {
        ...variables,
        _timestamp: new Date().toISOString(),
        _templatePath: templatePath,
        _variables: Object.keys(variables)
      };

      // Render template
      const rendered = await new Promise((resolve, reject) => {
        this.env.render(templatePath, contextVariables, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      // Cache result if enabled
      if (!options.noCache) {
        this.renderCache.set(cacheKey, rendered);
      }

      this.logger.debug('Template rendering complete', {
        templatePath,
        outputLength: rendered.length
      });

      return rendered;

    } catch (error) {
      this.logger.error('Template rendering failed', {
        templatePath,
        error: error.message,
        variables: Object.keys(variables)
      });
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Render template string directly
   * @param {string} templateString - Template string content
   * @param {Object} variables - Template variables
   * @returns {Promise<string>} Rendered content
   */
  async renderString(templateString, variables = {}) {
    try {
      this.logger.debug('Rendering template string', {
        stringLength: templateString.length,
        variableCount: Object.keys(variables).length
      });

      const contextVariables = {
        ...variables,
        _timestamp: new Date().toISOString()
      };

      const rendered = await new Promise((resolve, reject) => {
        this.env.renderString(templateString, contextVariables, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      return rendered;

    } catch (error) {
      this.logger.error('Template string rendering failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate cache key for rendered template
   * @param {string} templatePath - Template path
   * @param {Object} variables - Template variables
   * @returns {string} Cache key
   */
  generateCacheKey(templatePath, variables) {
    const variablesHash = JSON.stringify(variables);
    return `${templatePath}:${this.simpleHash(variablesHash)}`;
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
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clear render cache
   */
  clearCache() {
    this.renderCache.clear();
  }

  /**
   * Get list of available filters
   * @returns {Array<string>} Filter names
   */
  getAvailableFilters() {
    return Object.keys(this.env.filters).sort();
  }

  /**
   * Get rendering statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      cacheSize: this.renderCache.size,
      filtersCount: Object.keys(this.env.filters).length,
      templatesDir: this.templatesDir
    };
  }
}