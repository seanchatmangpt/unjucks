/**
 * KGEN Frontmatter Parser - Reusable and enhanced
 * 
 * Extracted and simplified from legacy frontmatter-parser.js
 * Focused on KGEN-specific needs with RDF/SPARQL support
 */

import yaml from 'yaml';

export class FrontmatterParser {
  constructor(options = {}) {
    this.options = {
      enableValidation: options.enableValidation || false,
      strictMode: options.strictMode || false,
      delimiter: '---',
      ...options
    };
  }

  /**
   * Parse template content with frontmatter
   * Enhanced to handle SPARQL/RDF content properly
   */
  async parse(templateContent) {
    // Handle empty or whitespace-only content
    if (!templateContent || typeof templateContent !== 'string' || templateContent.trim().length === 0) {
      return {
        frontmatter: {},
        content: templateContent || '',
        hasValidFrontmatter: false
      };
    }

    // Enhanced frontmatter regex that properly handles SPARQL content
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false
      };
    }

    try {
      // Pre-process frontmatter to handle SPARQL queries safely
      const processedFrontmatterText = this.preprocessSparqlFrontmatter(match[1]);
      
      const frontmatter = yaml.parse(processedFrontmatterText, {
        keepUndefined: true,
        strict: this.options.strictMode
      }) || {};
      
      // Post-process to restore SPARQL content
      const processedFrontmatter = this.postprocessSparqlFrontmatter(frontmatter);
      const content = match[2].trim();

      const result = {
        frontmatter: processedFrontmatter || {},
        content,
        hasValidFrontmatter: true
      };

      // Validate if enabled
      if (this.options.enableValidation) {
        const validation = this.validate(processedFrontmatter);
        if (!validation.valid) {
          result.validationErrors = validation.errors;
        }
      }

      return result;

    } catch (error) {
      console.warn('Warning: Invalid YAML frontmatter, treating as content:', error.message);
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
        parseError: error.message
      };
    }
  }

  /**
   * Pre-process frontmatter to safely handle SPARQL queries in YAML
   */
  preprocessSparqlFrontmatter(frontmatterText) {
    // Handle multiline SPARQL queries using literal block scalar (|)
    return frontmatterText.replace(
      /^(\s*(?:sparql|query|rdf|turtle):\s*)([\s\S]*?)(?=^\s*[a-zA-Z_]|\s*$)/gm,
      (match, header, content) => {
        // If content doesn't start with | or >, add | for literal block
        if (!content.trim().startsWith('|') && !content.trim().startsWith('>')) {
          const trimmedContent = content.trim();
          if (this.isSparqlLikeContent(trimmedContent)) {
            return header + '|\n' + content.split('\n').map(line => 
              line.trim() ? '  ' + line : line
            ).join('\n');
          }
        }
        return match;
      }
    );
  }

  /**
   * Post-process parsed frontmatter to restore SPARQL content
   */
  postprocessSparqlFrontmatter(frontmatter) {
    const result = { ...frontmatter };
    
    // Clean up SPARQL/RDF content
    ['sparql', 'query', 'rdf', 'turtle'].forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    });

    // Handle RDF prefixes array
    if (result.rdf && typeof result.rdf === 'object') {
      if (Array.isArray(result.rdf.prefixes)) {
        result.rdf.prefixes = result.rdf.prefixes.map(prefix => {
          return typeof prefix === 'string' ? prefix.trim() : prefix;
        });
      }
    }

    return result;
  }

  /**
   * Check if content looks like SPARQL
   */
  isSparqlLikeContent(content) {
    const sparqlKeywords = [
      'SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE', 'INSERT', 'DELETE',
      'PREFIX', 'WHERE', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH'
    ];
    
    const upperContent = content.toUpperCase();
    return sparqlKeywords.some(keyword => upperContent.includes(keyword));
  }

  /**
   * Validate frontmatter configuration
   */
  validate(frontmatter) {
    const errors = [];

    // Check mutually exclusive injection options
    const injectionModes = [
      frontmatter.inject,
      frontmatter.append,
      frontmatter.prepend,
      frontmatter.lineAt !== undefined
    ].filter(Boolean);

    if (injectionModes.length > 1) {
      errors.push('Only one injection mode allowed: inject, append, prepend, or lineAt');
    }

    // Validate injection modes require inject: true
    if ((frontmatter.before || frontmatter.after) && !frontmatter.inject) {
      errors.push('before/after requires inject: true');
    }

    // Validate lineAt is a positive number
    if (frontmatter.lineAt !== undefined && 
        (typeof frontmatter.lineAt !== 'number' || frontmatter.lineAt < 1)) {
      errors.push('lineAt must be a positive number (1-based line numbers)');
    }

    // Validate chmod format
    if (frontmatter.chmod !== undefined) {
      if (typeof frontmatter.chmod === 'string') {
        if (!/^[0-7]{3,4}$/.test(frontmatter.chmod)) {
          errors.push("chmod string must be octal format (e.g., '755', '0644')");
        }
      } else if (typeof frontmatter.chmod === 'number' && 
                 (frontmatter.chmod < 0 || frontmatter.chmod > 0o777)) {
        errors.push('chmod number must be between 0 and 0o777');
      }
    }

    // Validate RDF configuration
    if (frontmatter.rdf && typeof frontmatter.rdf === 'object') {
      if (!frontmatter.rdf.source && !frontmatter.rdf.prefixes) {
        errors.push("RDF configuration requires a 'source' property or 'prefixes' array");
      }
      if (frontmatter.rdf.type && 
          !['file', 'inline', 'uri'].includes(frontmatter.rdf.type)) {
        errors.push("RDF type must be 'file', 'inline', or 'uri'");
      }
      if (frontmatter.rdf.prefixes && !Array.isArray(frontmatter.rdf.prefixes)) {
        errors.push('RDF prefixes must be an array');
      }
    }

    // Validate inline SPARQL queries
    if (frontmatter.sparql && typeof frontmatter.sparql === 'string') {
      const sparqlContent = frontmatter.sparql.trim();
      if (sparqlContent && !this.isValidSparqlSyntax(sparqlContent)) {
        errors.push('Invalid SPARQL query syntax in frontmatter');
      }
    }

    // Validate RDF base URI format
    if (frontmatter.rdfBaseUri && !this.isValidUri(frontmatter.rdfBaseUri)) {
      errors.push('rdfBaseUri must be a valid URI');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Basic SPARQL syntax validation
   */
  isValidSparqlSyntax(sparqlQuery) {
    if (!sparqlQuery || typeof sparqlQuery !== 'string') return false;
    
    const query = sparqlQuery.trim().toUpperCase();
    const hasQueryType = /^(SELECT|CONSTRUCT|ASK|DESCRIBE|INSERT|DELETE)/.test(query);
    if (!hasQueryType) return false;
    
    // For SELECT/CONSTRUCT queries, check for WHERE clause
    if (query.startsWith('SELECT') || query.startsWith('CONSTRUCT')) {
      return query.includes('WHERE');
    }
    
    return true;
  }

  /**
   * Check if URI is valid
   */
  isValidUri(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      // Also accept relative URIs or namespace patterns
      return uri.includes(':') || uri.startsWith('/');
    }
  }

  /**
   * Determine the operation mode based on frontmatter
   */
  getOperationMode(frontmatter) {
    if (frontmatter.lineAt !== undefined) {
      return { mode: 'lineAt', lineNumber: frontmatter.lineAt };
    }

    if (frontmatter.append) {
      return { mode: 'append' };
    }

    if (frontmatter.prepend) {
      return { mode: 'prepend' };
    }

    if (frontmatter.inject) {
      if (frontmatter.before) {
        return { mode: 'inject', target: frontmatter.before };
      }
      if (frontmatter.after) {
        return { mode: 'inject', target: frontmatter.after };
      }
      return { mode: 'inject' };
    }

    return { mode: 'write' };
  }

  /**
   * Check if generation should be skipped based on skipIf condition
   */
  shouldSkip(frontmatter, variables) {
    if (!frontmatter.skipIf || typeof frontmatter.skipIf !== 'string' || 
        frontmatter.skipIf.trim().length === 0) {
      return false;
    }

    try {
      const condition = frontmatter.skipIf.trim();

      // Check for simple variable existence: skipIf: "variableName"
      if (variables[condition] !== undefined) {
        return Boolean(variables[condition]);
      }

      // Check for negation: skipIf: "!variableName"
      if (condition.startsWith('!')) {
        const varName = condition.slice(1);
        return !variables[varName];
      }

      // Check for equality: skipIf: "variableName==value"
      const equalityMatch = condition.match(/^(\w+)\s*==\s*(.+)$/);
      if (equalityMatch) {
        const [, varName, value] = equalityMatch;
        const actualValue = variables[varName];
        const expectedValue = value.replace(/^["'](.*)["']$/, '$1');
        return String(actualValue) === expectedValue;
      }

      // Check for inequality: skipIf: "variableName!=value"
      const inequalityMatch = condition.match(/^(\w+)\s*!=\s*(.+)$/);
      if (inequalityMatch) {
        const [, varName, value] = inequalityMatch;
        const actualValue = variables[varName];
        const expectedValue = value.replace(/^["'](.*)["']$/, '$1');
        return String(actualValue) !== expectedValue;
      }

      return false;

    } catch (error) {
      console.warn(`Warning: Error evaluating skipIf condition: ${frontmatter.skipIf}`, error);
      return false;
    }
  }

  /**
   * Normalize chmod value to octal number
   */
  normalizeChmod(chmod) {
    if (typeof chmod === 'number') {
      return chmod;
    }

    // Handle string format like '755' or '0755'
    const parsed = chmod.startsWith('0') 
      ? Number.parseInt(chmod, 8)
      : Number.parseInt(chmod, 8);

    return parsed;
  }

  /**
   * Extract RDF configuration from frontmatter
   */
  getRDFConfig(frontmatter) {
    if (frontmatter.rdf) {
      if (typeof frontmatter.rdf === 'string') {
        return { type: 'file', source: frontmatter.rdf };
      }
      return frontmatter.rdf;
    }

    if (frontmatter.turtle) {
      if (typeof frontmatter.turtle === 'string') {
        return {
          type: 'file',
          source: frontmatter.turtle,
          format: 'text/turtle'
        };
      }
      return { ...frontmatter.turtle, format: 'text/turtle' };
    }

    if (frontmatter.turtleData || frontmatter.rdfData) {
      return {
        type: 'inline',
        source: frontmatter.turtleData || frontmatter.rdfData,
        format: 'text/turtle'
      };
    }

    return null;
  }

  /**
   * Check if frontmatter contains RDF configuration
   */
  hasRDFConfig(frontmatter) {
    return !!(
      frontmatter.rdf ||
      frontmatter.turtle ||
      frontmatter.turtleData ||
      frontmatter.rdfData ||
      frontmatter.sparql ||
      frontmatter.query
    );
  }

  /**
   * Serialize frontmatter data back to YAML
   * @param {Object} data - Frontmatter data
   * @returns {string} YAML frontmatter string
   */
  stringify(data) {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return '';
    }

    const delimiter = this.options.delimiter;
    const yamlContent = yaml.stringify(data).trim();
    
    return `${delimiter}\n${yamlContent}\n${delimiter}\n`;
  }

  /**
   * Extract template variables from frontmatter and content
   * @param {string} content - Template content
   * @returns {Array<string>} List of template variables
   */
  extractVariables(content) {
    const { content: body, data: frontmatter } = this.parse(content);
    const variables = new Set();

    // Extract variables from frontmatter values
    this.extractVariablesFromObject(frontmatter, variables);

    // Extract variables from template body using regex
    const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
    let match;
    
    while ((match = variableRegex.exec(body)) !== null) {
      const variable = match[1].split('.')[0]; // Get root variable name
      variables.add(variable);
    }

    // Extract variables from filters and functions
    const filterRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\|/g;
    while ((match = filterRegex.exec(body)) !== null) {
      const variable = match[1].split('.')[0];
      variables.add(variable);
    }

    return Array.from(variables).sort();
  }

  /**
   * Recursively extract variables from object values
   * @param {Object} obj - Object to scan
   * @param {Set} variables - Set to collect variables
   */
  extractVariablesFromObject(obj, variables) {
    if (!obj || typeof obj !== 'object') return;

    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
        let match;
        while ((match = variableRegex.exec(value)) !== null) {
          const variable = match[1].split('.')[0];
          variables.add(variable);
        }
      } else if (typeof value === 'object') {
        this.extractVariablesFromObject(value, variables);
      }
    }
  }

  /**
   * Validate that all required variables are provided in context
   * @param {string} content - Template content
   * @param {Object} context - Template context
   * @returns {Array<string>} List of missing variables
   */
  validateContext(content, context = {}) {
    const requiredVariables = this.extractVariables(content);
    const providedVariables = Object.keys(context);
    
    return requiredVariables.filter(variable => 
      !providedVariables.includes(variable) &&
      !this.isBuiltinVariable(variable)
    );
  }

  /**
   * Check if variable is a built-in template variable
   * @param {string} variable - Variable name
   * @returns {boolean} True if built-in variable
   */
  isBuiltinVariable(variable) {
    const builtins = ['meta', 'kgen', 'loop', 'range', 'caller'];
    return builtins.includes(variable);
  }
}