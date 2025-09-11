/**
 * KGEN Frontmatter Parser
 * 
 * Parses YAML frontmatter from template files
 * Supports KGEN-specific metadata for artifact generation
 */

import yaml from 'yaml';

export class FrontmatterParser {
  constructor(options = {}) {
    this.options = {
      delimiter: '---',
      ...options
    };
  }

  /**
   * Parse frontmatter from template content
   * @param {string} content - Template content with potential frontmatter
   * @returns {Object} Parsed result with content and data
   */
  parse(content) {
    if (!content || typeof content !== 'string') {
      return { content: content || '', data: {} };
    }

    const delimiter = this.options.delimiter;
    
    // Check if content starts with frontmatter delimiter
    if (!content.startsWith(delimiter)) {
      return { content, data: {} };
    }

    // Find closing delimiter
    const endDelimiterIndex = content.indexOf(delimiter, delimiter.length);
    
    if (endDelimiterIndex === -1) {
      // No closing delimiter found, treat as regular content
      return { content, data: {} };
    }

    try {
      // Extract frontmatter and content
      const frontmatterRaw = content.slice(delimiter.length, endDelimiterIndex).trim();
      const bodyContent = content.slice(endDelimiterIndex + delimiter.length).replace(/^\n/, '');

      // Parse YAML frontmatter
      const data = frontmatterRaw ? yaml.parse(frontmatterRaw) : {};

      return {
        content: bodyContent,
        data: this.validateAndNormalize(data)
      };

    } catch (error) {
      throw new Error(`Failed to parse frontmatter: ${error.message}`);
    }
  }

  /**
   * Validate and normalize frontmatter data for KGEN
   * @param {Object} data - Raw frontmatter data
   * @returns {Object} Validated and normalized data
   */
  validateAndNormalize(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const normalized = { ...data };

    // Normalize 'to' field for output path
    if (normalized.to && typeof normalized.to === 'string') {
      normalized.outputPath = normalized.to;
    }

    // Validate operation modes
    if (normalized.inject) {
      normalized.operationMode = 'inject';
    } else if (normalized.append) {
      normalized.operationMode = 'append';
    } else if (normalized.prepend) {
      normalized.operationMode = 'prepend';
    } else if (normalized.lineAt) {
      normalized.operationMode = 'lineAt';
      normalized.lineNumber = parseInt(normalized.lineAt, 10);
    } else {
      normalized.operationMode = 'write';
    }

    // Validate skipIf conditions
    if (normalized.skipIf && typeof normalized.skipIf !== 'string') {
      delete normalized.skipIf;
    }

    // Validate chmod permissions
    if (normalized.chmod) {
      if (typeof normalized.chmod === 'string') {
        normalized.chmod = parseInt(normalized.chmod, 8);
      } else if (typeof normalized.chmod !== 'number') {
        delete normalized.chmod;
      }
    }

    // Validate shell commands
    if (normalized.sh && !Array.isArray(normalized.sh)) {
      if (typeof normalized.sh === 'string') {
        normalized.sh = [normalized.sh];
      } else {
        delete normalized.sh;
      }
    }

    return normalized;
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